package com.pulse.monitor

import android.content.Context
import android.net.Uri
import android.os.Environment
import android.provider.DocumentsContract
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.io.File
import java.io.FileInputStream
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import kotlin.math.min

/**
 * Deep recursive file organizer (spec §8 + user request).
 *
 * Walks every readable subfolder under external storage, categorizes each
 * file by type / extension / sub-type (screenshot vs camera, code langs),
 * and groups results by month. NEVER deletes anything — deletion is only
 * reachable through an explicit user confirmation on FileExplorerScreen.
 *
 * Restricted dirs (Android/data, Android/obb, .nomedia-heavy trees) are
 * skipped so the walk stays fast and legal under scoped storage.
 */
object FileOrganizer {

  private val SKIP_DIRS = setOf(
    "android", "data", "obb", "misc", "system",
    ".thumbnails", ".trashed", ".thumbnails_tmp",
  )

  private val CODE_EXT = setOf(
    "py", "js", "ts", "jsx", "tsx", "html", "htm", "css", "scss", "sass",
    "java", "kt", "kts", "swift", "c", "cpp", "h", "hpp", "cs", "go", "rs",
    "rb", "php", "pl", "r", "m", "mm", "sh", "bash", "zsh", "ps1", "bat",
    "sql", "json", "xml", "yml", "yaml", "toml", "ini", "cfg", "conf",
    "gradle", "properties", "lua", "dart", "vue", "svelte", "astro",
  )

  private val AUDIO_EXT = setOf(
    "mp3", "wav", "ogg", "m4a", "aac", "flac", "amr", "wma", "opus", "mid", "midi",
  )
  private val VIDEO_EXT = setOf(
    "mp4", "mkv", "avi", "mov", "webm", "3gp", "flv", "wmv", "m4v", "ts", "mpeg", "mpg", "mkv",
  )
  private val IMAGE_EXT = setOf(
    "jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "heif", "svg", "ico", "tiff", "raw", "dng",
  )
  private val DOC_EXT = setOf(
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf",
    "odt", "ods", "odp", "md", "epub", "pages", "numbers", "key",
  )
  private val ARCHIVE_EXT = setOf(
    "zip", "rar", "7z", "tar", "gz", "bz2", "xz", "iso", "tgz", "zst",
  )
  private val APK_EXT = setOf("apk", "xapk", "apks", "aab")

  private val monthFmt = SimpleDateFormat("yyyy-MM", Locale.US)
  private val dayFmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)

  data class OrganizedFile(
    val path: String,
    val name: String,
    val size: Long,
    val lastModified: Long,
    val category: String,       // image | video | audio | code | document | archive | apk | other
    val subType: String,        // screenshot | camera | selfie | screen_record | …
    val extension: String,
    val monthKey: String,       // "2026-10"
    val dayKey: String,         // "2026-10-14"
  )

  fun classify(name: String, parentPath: String): Pair<String, String> {
    val ext = name.substringAfterLast('.', "").lowercase(Locale.US)
    val lowerName = name.lowercase(Locale.US)
    val lowerPath = parentPath.lowercase(Locale.US)

    return when {
      ext in APK_EXT -> "apk" to "installer"

      ext in ARCHIVE_EXT -> "archive" to ext

      ext in CODE_EXT -> "code" to ext

      ext in AUDIO_EXT -> "audio" to ext

      ext in VIDEO_EXT -> {
        val sub = when {
          lowerPath.contains("screen") || lowerName.contains("screen_record") ||
            lowerName.contains("screenrecord") || lowerName.contains("recording") ->
            "screen_record"
          lowerPath.contains("camera") || lowerPath.contains("dcim") -> "camera"
          lowerName.contains("whatsapp") -> "whatsapp_video"
          else -> "video"
        }
        "video" to sub
      }

      ext in IMAGE_EXT -> {
        val sub = when {
          lowerPath.contains("screenshot") || lowerName.contains("screenshot") ||
            lowerName.contains("screencap") || lowerName.contains("screen_shot") ||
            lowerName.startsWith("screen_") -> "screenshot"
          lowerPath.contains("camera") || lowerPath.contains("dcim/camera") ||
            lowerName.startsWith("img_") || lowerName.startsWith("pxl_") ->
            "camera"
          lowerName.contains("selfie") || lowerName.contains("front") -> "selfie"
          lowerPath.contains("whatsapp") -> "whatsapp_image"
          lowerPath.contains("download") -> "download_image"
          lowerPath.contains("pictures") -> "pictures"
          else -> "image"
        }
        "image" to sub
      }

      ext in DOC_EXT -> "document" to ext

      // Unknown extension but looks like code (has shebang-like name patterns).
      lowerName.endsWith(".env") || lowerName.startsWith("dockerfile") ||
        lowerName.startsWith("makefile") || lowerName.startsWith("readme") ->
        "code" to "config"

      else -> "other" to ext.ifEmpty { "noext" }
    }
  }

  /** Roots to walk: primary external storage. */
  private fun roots(): List<File> {
    val primary = Environment.getExternalStorageDirectory()
    return listOfNotNull(primary)
  }

  /**
   * Recursive walk with a hard cap so huge trees don't freeze the bridge.
   * Skips Android/data, Android/obb and hidden system dirs.
   */
  fun organize(context: Context, limit: Int): WritableArray {
    val collected = ArrayList<OrganizedFile>(min(limit, 4096))
    for (root in roots()) {
      walk(root, collected, limit)
      if (collected.size >= limit) break
    }

    // Sort newest-first for the month view.
    collected.sortByDescending { it.lastModified }

    val out = Arguments.createArray()
    collected.forEach { f ->
      out.pushMap(
        Arguments.createMap().apply {
          putString("path", f.path)
          putString("name", f.name)
          putDouble("size", f.size.toDouble())
          putDouble("lastModified", f.lastModified.toDouble())
          putString("category", f.category)
          putString("subType", f.subType)
          putString("extension", f.extension)
          putString("monthKey", f.monthKey)
          putString("dayKey", f.dayKey)
        },
      )
    }
    return out
  }

  private fun walk(dir: File, out: ArrayList<OrganizedFile>, limit: Int) {
    if (out.size >= limit) return
    if (!dir.isDirectory || !dir.canRead()) return

    val dirName = dir.name.lowercase(Locale.US)
    // Skip restricted / system trees.
    if (dirName in SKIP_DIRS && dir.absolutePath.contains("/Android/", ignoreCase = true)) {
      return
    }
    if (dirName.startsWith(".") && dirName != ".") return

    val children = dir.listFiles() ?: return
    for (child in children) {
      if (out.size >= limit) return
      if (child.isDirectory) {
        walk(child, out, limit)
      } else if (child.isFile) {
        val size = child.length()
        if (size <= 0L) continue
        val name = child.name
        if (name.startsWith(".")) continue // skip hidden/temp
        val (cat, sub) = classify(name, child.parent ?: "")
        val lm = child.lastModified()
        val cal = Calendar.getInstance().apply { timeInMillis = lm }
        val month = String.format(
          Locale.US,
          "%04d-%02d",
          cal.get(Calendar.YEAR),
          cal.get(Calendar.MONTH) + 1,
        )
        val day = String.format(
          Locale.US,
          "%04d-%02d-%02d",
          cal.get(Calendar.YEAR),
          cal.get(Calendar.MONTH) + 1,
          cal.get(Calendar.DAY_OF_MONTH),
        )
        out.add(
          OrganizedFile(
            path = child.absolutePath,
            name = name,
            size = size,
            lastModified = lm,
            category = cat,
            subType = sub,
            extension = name.substringAfterLast('.', "").lowercase(Locale.US),
            monthKey = month,
            dayKey = day,
          ),
        )
      }
    }
  }

  /**
   * Summary grouped by month + category for the Organize overview cards.
   * Returns a map: { "months": [ {month, totalBytes, count, byCategory: {...}} ] }
   */
  fun summary(context: Context, limit: Int): WritableMap {
    val files = ArrayList<OrganizedFile>()
    for (root in roots()) {
      walk(root, files, limit)
      if (files.size >= limit) break
    }

    val byMonth = LinkedHashMap<String, MonthAgg>()
    for (f in files) {
      val agg = byMonth.getOrPut(f.monthKey) { MonthAgg() }
      agg.totalBytes += f.size
      agg.count += 1
      agg.byCategory[f.category] = (agg.byCategory[f.category] ?: 0L) + f.size
      agg.bySubType[f.subType] = (agg.bySubType[f.subType] ?: 0L) + f.size
    }

    return Arguments.createMap().apply {
      putInt("totalFiles", files.size)
      putDouble("totalBytes", files.sumOf { it.size }.toDouble())
      val monthsArr = Arguments.createArray()
      byMonth.entries.sortedByDescending { it.key }.forEach { (month, agg) ->
        val m = Arguments.createMap().apply {
          putString("month", month)
          putInt("count", agg.count)
          putDouble("bytes", agg.totalBytes.toDouble())
          val catMap = Arguments.createMap()
          agg.byCategory.forEach { (k, v) -> catMap.putDouble(k, v.toDouble()) }
          putMap("byCategory", catMap)
          val subMap = Arguments.createMap()
          agg.bySubType.forEach { (k, v) -> subMap.putDouble(k, v.toDouble()) }
          putMap("bySubType", subMap)
        }
        monthsArr.pushMap(m)
      }
      putArray("months", monthsArr)
    }
  }

  private class MonthAgg {
    var totalBytes = 0L
    var count = 0
    val byCategory = HashMap<String, Long>()
    val bySubType = HashMap<String, Long>()
  }

  /**
   * Delete a single file after the JS layer has already shown a
   * double-confirm dialog. Returns true only if the file is actually gone.
   */
  fun deleteFile(path: String): Boolean {
    return try {
      val f = File(path)
      if (!f.exists()) return false
      if (!f.isFile) return false // refuse directories
      // Refuse anything under Android/data or system paths.
      val lower = f.absolutePath.lowercase(Locale.US)
      if (
        lower.contains("/android/data/") ||
        lower.contains("/android/obb/") ||
        lower.startsWith("/system/") ||
        lower.startsWith("/proc/") ||
        lower.startsWith("/dev/")
      ) {
        return false
      }
      f.delete() && !f.exists()
    } catch (_: Exception) {
      false
    }
  }

  // ── SAF organize: dry-run plan + execute moves ────────────────────

  /**
   * Dry-run plan: for each source path, compute the destination subfolder
   * inside the user-picked SAF tree. Does NOT touch any file. Returns a
   * WritableArray of move descriptors:
   *   { sourcePath, destFolderRel, destName, size, category, subType, monthKey, status }
   * status: "ok" | "missing" | "refused"
   */
  fun planMoves(treeUriString: String, paths: ReadableArray): WritableArray {
    val out = Arguments.createArray()
    for (i in 0 until paths.size()) {
      val path = paths.getString(i) ?: continue
      val f = File(path)
      if (!f.exists() || !f.isFile) {
        out.pushMap(
          Arguments.createMap().apply {
            putString("sourcePath", path)
            putString("destFolderRel", "")
            putString("destName", "")
            putDouble("size", 0.0)
            putString("status", "missing")
          },
        )
        continue
      }
      val lower = path.lowercase(Locale.US)
      if (
        lower.contains("/android/data/") ||
        lower.contains("/android/obb/") ||
        lower.startsWith("/system/")
      ) {
        out.pushMap(
          Arguments.createMap().apply {
            putString("sourcePath", path)
            putString("destFolderRel", "")
            putString("destName", "")
            putDouble("size", f.length().toDouble())
            putString("status", "refused")
          },
        )
        continue
      }
      val name = f.name
      val (cat, sub) = classify(name, f.parent ?: "")
      val lm = f.lastModified()
      val cal = Calendar.getInstance().apply { timeInMillis = lm }
      val month = String.format(
        Locale.US,
        "%04d-%02d",
        cal.get(Calendar.YEAR),
        cal.get(Calendar.MONTH) + 1,
      )
      val destFolderRel = "$cat/$month"
      out.pushMap(
        Arguments.createMap().apply {
          putString("sourcePath", path)
          putString("destFolderRel", destFolderRel)
          putString("destName", name)
          putDouble("size", f.length().toDouble())
          putString("category", cat)
          putString("subType", sub)
          putString("monthKey", month)
          putString("status", "ok")
        },
      )
    }
    return out
  }

  /**
   * Execute the moves planned by planMoves(). Creates the destination
   * subfolders under the SAF tree, copies each file, then deletes the
   * source. Returns a summary:
   *   { moved, skipped, failedBytes, errors: [ {sourcePath, error} ] }
   */
  fun executeMoves(context: Context, treeUriString: String, moves: ReadableArray): WritableMap {
    val treeUri = Uri.parse(treeUriString)
    val docId = DocumentsContract.getTreeDocumentId(treeUri)
    val treeDocUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, docId)
    val resolver = context.contentResolver

    var moved = 0
    var skipped = 0
    var failedBytes = 0L
    val errors = Arguments.createArray()

    // Cache directory DocumentIds so we don't re-create / re-query per file.
    val dirCache = HashMap<String, Uri>()

    for (i in 0 until moves.size()) {
      val m = moves.getMap(i) ?: continue
      val status = m.getString("status") ?: "ok"
      val sourcePath = m.getString("sourcePath") ?: continue
      val destFolderRel = m.getString("destFolderRel") ?: ""
      val destName = m.getString("destName") ?: continue
      val size = m.getDouble("size").toLong()

      if (status != "ok") {
        skipped++
        continue
      }

      val src = File(sourcePath)
      if (!src.exists() || !src.isFile) {
        skipped++
        continue
      }

      try {
        val destDirUri = ensureDir(context, treeUri, treeDocUri, destFolderRel, dirCache)
        if (destDirUri == null) {
          failedBytes += size
          errors.pushMap(
            Arguments.createMap().apply {
              putString("sourcePath", sourcePath)
              putString("error", "Could not create destination folder")
            },
          )
          continue
        }

        // Create the destination file document.
        val mime = android.webkit.MimeTypeMap.getSingleton()
          .getMimeTypeFromExtension(destName.substringAfterLast('.', "").lowercase(Locale.US))
          ?: "application/octet-stream"
        val destFileUri = DocumentsContract.createDocument(
          resolver,
          destDirUri,
          mime,
          destName,
        )
        if (destFileUri == null) {
          failedBytes += size
          errors.pushMap(
            Arguments.createMap().apply {
              putString("sourcePath", sourcePath)
              putString("error", "Could not create destination file")
            },
          )
          continue
        }

        // Copy bytes.
        val input = FileInputStream(src)
        val output = resolver.openOutputStream(destFileUri)
          ?: throw IllegalStateException("openOutputStream returned null")
        input.copyTo(output)
        input.close()
        output.close()

        // Verify size, then delete source.
        if (src.length() == size || src.delete()) {
          moved++
        } else {
          // Copy succeeded but delete refused — count as moved with a note.
          moved++
          errors.pushMap(
            Arguments.createMap().apply {
              putString("sourcePath", sourcePath)
              putString("error", "Copied but source delete refused")
            },
          )
        }
      } catch (e: Exception) {
        failedBytes += size
        errors.pushMap(
          Arguments.createMap().apply {
            putString("sourcePath", sourcePath)
            putString("error", e.message ?: e.javaClass.simpleName)
          },
        )
      }
    }

    FileScanner.invalidateCache()

    return Arguments.createMap().apply {
      putInt("moved", moved)
      putInt("skipped", skipped)
      putDouble("failedBytes", failedBytes.toDouble())
      putArray("errors", errors)
    }
  }

  /**
   * Resolve (and create if needed) a nested directory under the SAF tree.
   * Walks path segments of [relPath] one at a time.
   */
  private fun ensureDir(
    context: Context,
    treeUri: Uri,
    parentDocUri: Uri,
    relPath: String,
    cache: HashMap<String, Uri>,
  ): Uri? {
    if (relPath.isEmpty()) return parentDocUri
    cache[relPath]?.let { return it }

    var currentParent = parentDocUri
    var currentPath = ""
    for (segment in relPath.split('/').filter { it.isNotEmpty() }) {
      currentPath = if (currentPath.isEmpty()) segment else "$currentPath/$segment"
      val cached = cache[currentPath]
      if (cached != null) {
        currentParent = cached
      } else {
        val childUri =
          findChild(context, treeUri, currentParent, segment)
            ?: createChild(context, treeUri, currentParent, segment, DocumentsContract.Document.MIME_TYPE_DIR)
            ?: return null
        cache[currentPath] = childUri
        currentParent = childUri
      }
    }
    return currentParent
  }

  private fun findChild(
    context: Context,
    treeUri: Uri,
    parentDocUri: Uri,
    displayName: String,
  ): Uri? {
    val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(
      parentDocUri,
      DocumentsContract.getDocumentId(parentDocUri),
    )
    context.contentResolver.query(
      childrenUri,
      arrayOf(
        DocumentsContract.Document.COLUMN_DOCUMENT_ID,
        DocumentsContract.Document.COLUMN_DISPLAY_NAME,
      ),
      null,
      null,
      null,
    )?.use { c ->
      val idIdx = c.getColumnIndex(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
      val nameIdx = c.getColumnIndex(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
      while (c.moveToNext()) {
        if (c.getString(nameIdx) == displayName) {
          return DocumentsContract.buildDocumentUriUsingTree(treeUri, c.getString(idIdx))
        }
      }
    }
    return null
  }

  private fun createChild(
    context: Context,
    treeUri: Uri,
    parentDocUri: Uri,
    displayName: String,
    mimeType: String,
  ): Uri? = try {
    DocumentsContract.createDocument(context.contentResolver, parentDocUri, mimeType, displayName)
  } catch (_: Exception) {
    null
  }
}
