package com.pulse.monitor

import android.content.ContentResolver
import android.content.ContentUris
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.io.File
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap

/**
 * MediaStore-backed file explorer (spec §8).
 * Queries Images / Video / Audio / Files collections separately — the single
 * Files("external") query is empty on many OEMs without runtime media
 * permissions. Categories by MIME/extension; sorted by size.
 *
 * Performance:
 *  - SQL LIMIT is pushed into the cursor via QUERY_ARG_LIMIT (API 30+) or
 *    the deprecated "LIMIT n" suffix in sortOrder (pre-30, still honoured
 *    by the MediaProvider).
 *  - Results are cached per (category, limit) for 30 s so tab switches are
 *    instant. Cache is cleared on delete / explicit invalidate().
 */
object FileScanner {

  data class FileRow(
    val id: Long,
    val uri: String,
    val name: String,
    val size: Long,
    val mime: String?,
    val dateModified: Long,
    val category: String,
    val extension: String,
  )

  private const val CACHE_TTL_MS = 30_000L

  private class CacheEntry(val rows: WritableArray, val at: Long)

  private val cache = ConcurrentHashMap<String, CacheEntry>()

  fun invalidateCache() {
    cache.clear()
  }

  private val VIDEO = setOf("mp4", "mkv", "avi", "mov", "webm", "3gp", "flv", "wmv", "m4v", "ts", "mpeg", "mpg")
  private val AUDIO = setOf("mp3", "wav", "ogg", "m4a", "aac", "flac", "amr", "wma", "opus")
  private val IMAGE = setOf("jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "heif", "svg", "ico", "tiff")
  private val DOC = setOf("pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf", "odt", "ods", "odp", "md", "epub")
  private val ARCHIVE = setOf("zip", "rar", "7z", "tar", "gz", "bz2", "xz", "iso")
  private val APK = setOf("apk", "xapk", "apks", "aab")

  fun categoryFor(name: String, mime: String?): String {
    val ext = name.substringAfterLast('.', "").lowercase(Locale.US)
    if (ext in APK) return "apk"
    if (ext in ARCHIVE) return "archive"
    if (ext in VIDEO) return "video"
    if (ext in AUDIO) return "audio"
    if (ext in IMAGE) return "image"
    if (ext in DOC) return "document"
    val m = mime?.lowercase(Locale.US) ?: ""
    return when {
      m.startsWith("video/") -> "video"
      m.startsWith("audio/") -> "audio"
      m.startsWith("image/") -> "image"
      m.startsWith("application/pdf") || m.startsWith("text/") -> "document"
      m.startsWith("application/vnd.android.package-archive") -> "apk"
      m.startsWith("application/zip") || m.startsWith("application/x-") -> "archive"
      else -> "other"
    }
  }

  /** Which MediaStore collections to hit for a given filter. */
  private fun collectionsFor(category: String?): List<Uri> = when (category) {
    "image" -> listOf(MediaStore.Images.Media.EXTERNAL_CONTENT_URI)
    "video" -> listOf(MediaStore.Video.Media.EXTERNAL_CONTENT_URI)
    "audio" -> listOf(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI)
    "download" -> listOf(MediaStore.Downloads.EXTERNAL_CONTENT_URI)
    "apk", "archive", "document", "other", null ->
      listOf(MediaStore.Files.getContentUri("external"))
    else -> listOf(MediaStore.Files.getContentUri("external"))
  }

  fun scan(context: Context, category: String?, limit: Int): WritableArray {
    val cacheKey = "${category ?: "all"}|$limit"
    cache[cacheKey]?.let { entry ->
      if (System.currentTimeMillis() - entry.at < CACHE_TTL_MS) {
        return entry.rows
      }
    }

    val rows = ArrayList<FileRow>()
    val seenIds = HashSet<Long>()
    val projection = arrayOf(
      MediaStore.Files.FileColumns._ID,
      MediaStore.Files.FileColumns.DISPLAY_NAME,
      MediaStore.Files.FileColumns.SIZE,
      MediaStore.Files.FileColumns.MIME_TYPE,
      MediaStore.Files.FileColumns.DATE_MODIFIED,
      MediaStore.Files.FileColumns.DATA,
    )

    val selection: String?
    val args: Array<String>?
    when (category) {
      "download" -> {
        selection = "${MediaStore.Files.FileColumns.DATA} LIKE ?"
        args = arrayOf("%/Download%")
      }
      "apk" -> {
        selection =
          "(${MediaStore.Files.FileColumns.MIME_TYPE} = ? OR ${MediaStore.Files.FileColumns.DATA} LIKE ?)"
        args = arrayOf(
          "application/vnd.android.package-archive",
          "%.apk",
        )
      }
      else -> {
        selection = null
        args = null
      }
    }

    for (uri in collectionsFor(category)) {
      try {
        queryWithLimit(context, uri, projection, selection, args, limit) { c ->
          val idIdx = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns._ID)
          val nameIdx = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DISPLAY_NAME)
          val sizeIdx = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.SIZE)
          val mimeIdx = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.MIME_TYPE)
          val dateIdx = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DATE_MODIFIED)
          val pathIdx = c.getColumnIndex(MediaStore.Files.FileColumns.DATA)

          while (c.moveToNext()) {
            if (rows.size >= limit) break
            val id = c.getLong(idIdx)
            if (!seenIds.add(id)) continue
            val size = if (c.isNull(sizeIdx)) 0L else c.getLong(sizeIdx)
            if (size <= 0L) continue
            val name = c.getString(nameIdx) ?: continue
            val mime = if (c.isNull(mimeIdx)) null else c.getString(mimeIdx)
            val path = if (pathIdx >= 0 && !c.isNull(pathIdx)) c.getString(pathIdx) else null

            val cat = when {
              category != null && category != "download" && category != "all" -> category
              path != null && path.contains("/Download", ignoreCase = true) -> "download"
              else -> categoryFor(name, mime)
            }
            // When filtering by an explicit category, enforce it.
            if (
              category != null &&
              category != "download" &&
              category != "all" &&
              cat != category
            ) {
              continue
            }

            val contentUri = try {
              ContentUris.withAppendedId(uri, id).toString()
            } catch (_: Exception) {
              continue
            }

            rows.add(
              FileRow(
                id = id,
                uri = contentUri,
                name = name,
                size = size,
                mime = mime,
                dateModified = (if (c.isNull(dateIdx)) 0L else c.getLong(dateIdx)) * 1000L,
                category = cat,
                extension = name.substringAfterLast('.', "").lowercase(Locale.US),
              ),
            )
          }
        }
      } catch (_: Exception) {
        // Collection missing on this OEM / volume — continue.
      }
    }

    // Fallback: if MediaStore returned nothing, try direct file walk of
    // public dirs that are readable without special permission on API 29+
    // via getExternalFilesDir-style paths — actually those are app-private.
    // Instead scan /sdcard Download + common folders with java.io as last resort.
    if (rows.isEmpty()) {
      scanFilesystemFallback(rows, seenIds, limit, category)
    }

    val out = Arguments.createArray()
    rows.sortedByDescending { it.size }.take(limit).forEach { r ->
      out.pushMap(
        Arguments.createMap().apply {
          putDouble("id", r.id.toDouble())
          putString("uri", r.uri)
          putString("name", r.name)
          putDouble("size", r.size.toDouble())
          putString("mime", r.mime)
          putDouble("dateModified", r.dateModified.toDouble())
          putString("category", r.category)
          putString("extension", r.extension)
        },
      )
    }
    cache[cacheKey] = CacheEntry(out, System.currentTimeMillis())
    return out
  }

  /**
   * Version-safe MediaStore query with SQL LIMIT.
   * API 30+: QUERY_ARG_LIMIT Bundle (true SQL LIMIT).
   * Pre-30:  deprecated "LIMIT n" in sortOrder — still honoured by
   *          MediaProvider on every OEM we care about, and it's the only
   *          portable way to cap a ContentResolver query before 30.
   */
  private inline fun queryWithLimit(
    context: Context,
    uri: Uri,
    projection: Array<String>,
    selection: String?,
    args: Array<String>?,
    limit: Int,
    block: (android.database.Cursor) -> Unit,
  ) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      val bundle = Bundle().apply {
        putString(ContentResolver.QUERY_ARG_SQL_SELECTION, selection)
        if (args != null) {
          putStringArray(ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS, args)
        }
        putString(
          ContentResolver.QUERY_ARG_SQL_SORT_ORDER,
          "${MediaStore.Files.FileColumns.SIZE} DESC",
        )
        putInt(ContentResolver.QUERY_ARG_LIMIT, limit)
      }
      context.contentResolver.query(uri, projection, bundle, null)?.use(block)
    } else {
      @Suppress("DEPRECATION")
      context.contentResolver.query(
        uri,
        projection,
        selection,
        args,
        "${MediaStore.Files.FileColumns.SIZE} DESC LIMIT $limit",
      )?.use(block)
    }
  }

  /**
   * Last-resort walk of world-readable public directories.
   * Used when MediaStore is empty (permission not yet granted).
   */
  private fun scanFilesystemFallback(
    rows: ArrayList<FileRow>,
    seen: HashSet<Long>,
    limit: Int,
    category: String?,
  ) {
    val roots = listOfNotNull(
      File("/sdcard/Download"),
      File("/storage/emulated/0/Download"),
      File("/sdcard/DCIM"),
      File("/storage/emulated/0/DCIM"),
      File("/sdcard/Pictures"),
      File("/storage/emulated/0/Pictures"),
      File("/sdcard/Movies"),
      File("/storage/emulated/0/Movies"),
      File("/sdcard/Music"),
      File("/storage/emulated/0/Music"),
      File("/sdcard/Documents"),
      File("/storage/emulated/0/Documents"),
    )
    var fakeId = -1L
    for (root in roots) {
      if (!root.isDirectory || !root.canRead()) continue
      try {
        root.walkTopDown()
          .filter { it.isFile && it.length() > 0 }
          .forEach { f ->
            if (rows.size >= limit) return
            val name = f.name
            val cat = categoryFor(name, null)
            if (category != null && category != "all" && cat != category) return@forEach
            val id = fakeId--
            seen.add(id)
            rows.add(
              FileRow(
                id = id,
                uri = Uri.fromFile(f).toString(),
                name = name,
                size = f.length(),
                mime = null,
                dateModified = f.lastModified(),
                category = cat,
                extension = name.substringAfterLast('.', "").lowercase(Locale.US),
              ),
            )
          }
      } catch (_: Exception) {
        // Restricted directory — skip.
      }
    }
  }

  fun categoryTotals(context: Context): WritableMap {
    val all = scan(context, null, 5_000)
    val totals = HashMap<String, Pair<Long, Int>>()
    for (i in 0 until all.size()) {
      val m = all.getMap(i) ?: continue
      val cat = m.getString("category") ?: "other"
      val size = m.getDouble("size").toLong()
      val prev = totals[cat] ?: (0L to 0)
      totals[cat] = (prev.first + size) to (prev.second + 1)
    }
    return Arguments.createMap().apply {
      for ((cat, pair) in totals) {
        val entry = Arguments.createMap().apply {
          putDouble("bytes", pair.first.toDouble())
          putInt("count", pair.second)
        }
        putMap(cat, entry)
      }
    }
  }

  /** Delete via trash (Q+) or direct file delete. Returns true if requested. */
  fun delete(context: Context, uriString: String, id: Long): Boolean {
    // File:// fallback path from filesystem walk.
    if (uriString.startsWith("file://")) {
      return try {
        File(Uri.parse(uriString).path ?: return false).delete()
      } catch (_: Exception) {
        false
      }
    }
    val uri = Uri.parse(uriString)
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      try {
        val pi = MediaStore.createTrashRequest(
          context.contentResolver,
          listOf(uri),
          true,
        )
        pi.send()
        true
      } catch (_: Exception) {
        try {
          context.contentResolver.delete(uri, null, null) > 0
        } catch (_: Exception) {
          false
        }
      }
    } else {
      try {
        context.contentResolver.delete(uri, null, null) > 0
      } catch (_: Exception) {
        false
      }
    }
  }
}
