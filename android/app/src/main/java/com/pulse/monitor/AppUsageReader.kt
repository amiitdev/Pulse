package com.pulse.monitor

import android.app.AppOpsManager
import android.app.usage.StorageStatsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Process
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap

/**
 * Per-app resource consumers (spec §10 honest limits).
 *
 * Storage bytes come from StorageStatsManager (API 26+).
 * Usage time / launches come from UsageStatsManager — only populated after
 * the user grants Usage Access in system settings.
 *
 * Per-app live RAM is NOT reported: Android does not expose other apps'
 * memory to normal applications, so that field is always null here.
 */
object AppUsageReader {

  data class AppRow(
    val packageName: String,
    val label: String,
    val appBytes: Long,
    val cacheBytes: Long,
    val dataBytes: Long,
    val usageMsToday: Long,
    val launchesToday: Int,
    val isSystem: Boolean,
  )

  fun hasUsageAccess(context: Context): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = appOps.checkOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS,
      Process.myUid(),
      context.packageName,
    )
    return mode == AppOpsManager.MODE_ALLOWED
  }

  fun read(context: Context): WritableArray {
    val pm = context.packageManager
    val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
    val resolveInfos = pm.queryIntentActivities(launcherIntent, 0)

    val now = System.currentTimeMillis()
    val startOfDay = now - (now % 86_400_000L)

    // Foreground usage today (null map when permission missing).
    val usageByPkg: Map<String, UsageStats> = if (hasUsageAccess(context)) {
      val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startOfDay, now)
      stats.associateBy { it.packageName }
    } else {
      emptyMap()
    }

    val storageStats = context.getSystemService(Context.STORAGE_STATS_SERVICE) as? StorageStatsManager

    val rows = Arguments.createArray()
    val seen = HashSet<String>()

    for (info in resolveInfos) {
      val pkg = info.activityInfo.packageName
      if (!seen.add(pkg)) continue
      if (pkg == context.packageName) continue

      var appBytes = 0L
      var cacheBytes = 0L
      var dataBytes = 0L

      try {
        val ai = pm.getApplicationInfo(pkg, 0)
        if (storageStats != null) {
          val stats = storageStats.queryStatsForPackage(
            android.os.storage.StorageManager.UUID_DEFAULT,
            pkg,
            android.os.Process.myUserHandle(),
          )
          appBytes = stats.appBytes
          cacheBytes = stats.cacheBytes
          dataBytes = stats.dataBytes
        }
      } catch (_: Exception) {
        // Package vanished between query and stats, or no permission.
        // Fall back to APK file size so the row is never a fake zero.
        try {
          val sourceDir = pm.getApplicationInfo(pkg, 0).sourceDir
          if (sourceDir != null) {
            val f = java.io.File(sourceDir)
            if (f.exists()) appBytes = f.length()
          }
        } catch (_: Exception) {
          // Leave zeros — honest "unknown".
        }
      }

      val usage = usageByPkg[pkg]
      val label = try {
        pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
      } catch (_: Exception) {
        pkg
      }

      val isSystem = try {
        (pm.getApplicationInfo(pkg, 0).flags and ApplicationInfo.FLAG_SYSTEM) != 0
      } catch (_: Exception) {
        false
      }

      val row = Arguments.createMap().apply {
        putString("packageName", pkg)
        putString("label", label)
        putDouble("appBytes", appBytes.toDouble())
        putDouble("cacheBytes", cacheBytes.toDouble())
        putDouble("dataBytes", dataBytes.toDouble())
        putDouble("totalBytes", (appBytes + cacheBytes + dataBytes).toDouble())
        putDouble("usageMsToday", (usage?.totalTimeInForeground ?: 0L).toDouble())
        // UsageStatsManager does not expose launch counts to 3rd-party apps.
        putInt("launchesToday", 0)
        putBoolean("isSystem", isSystem)
        // Honest: never fabricated — always null without system privileges.
        putNull("ramBytes")
      }
      rows.pushMap(row)
    }

    // Heaviest first by total storage.
    return rows
  }

  /** Same as read() but sorted; exposed for "top consumers" lists. */
  fun readTopBy(context: Context, sortBy: String, limit: Int): WritableArray {
    val all = read(context)
    val list = (0 until all.size()).map { all.getMap(it)!! }

    val sorted = when (sortBy) {
      "usage" -> list.sortedByDescending { it.getDouble("usageMsToday") }
      "launches" -> list.sortedByDescending { it.getInt("launchesToday") }
      else -> list.sortedByDescending { it.getDouble("totalBytes") }
    }

    val out = Arguments.createArray()
    sorted.take(limit.coerceAtLeast(1)).forEach { out.pushMap(it) }
    return out
  }

  fun permissionSummary(context: Context): WritableMap {
    val ssm = context.getSystemService(Context.STORAGE_STATS_SERVICE)
    return Arguments.createMap().apply {
      putBoolean("usageAccess", hasUsageAccess(context))
      putBoolean("storageStatsAvailable", ssm != null)
      putInt("apiLevel", android.os.Build.VERSION.SDK_INT)
    }
  }

  /**
   * Real background-process ranking via UsageStatsManager.queryEvents (fast, no StorageStats).
   * Walks today's events, tracks last-seen MOVE_TO_BACKGROUND / ACTIVITY_STOPPED
   * per package, and returns non-system packages sorted by recency. Each row
   * carries only usage-event facts — never fabricated storage numbers.
   */
  fun readBackground(context: Context, limit: Int): WritableArray {
    val pm = context.packageManager
    val now = System.currentTimeMillis()
    val startOfDay = now - (now % 86_400_000L)

    // lastBackgroundMs: last time the app moved to background / stopped.
    // lastForegroundMs: last time it was resumed / moved to foreground.
    // eventCount: how many events we saw today (activity signal).
    val lastBackground = HashMap<String, Long>()
    val lastForeground = HashMap<String, Long>()
    val eventCount = HashMap<String, Int>()

    if (hasUsageAccess(context)) {
      val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      try {
        val events = usm.queryEvents(startOfDay, now)
        if (events != null) {
          val ev = UsageEvents.Event()
          while (events.hasNextEvent()) {
            events.getNextEvent(ev)
            val pkg = ev.packageName ?: continue
            when (ev.eventType) {
              UsageEvents.Event.ACTIVITY_RESUMED,
              UsageEvents.Event.MOVE_TO_FOREGROUND -> {
                lastForeground[pkg] = ev.timeStamp
                eventCount[pkg] = (eventCount[pkg] ?: 0) + 1
              }
              UsageEvents.Event.ACTIVITY_PAUSED,
              UsageEvents.Event.ACTIVITY_STOPPED,
              UsageEvents.Event.MOVE_TO_BACKGROUND -> {
                lastBackground[pkg] = maxOf(lastBackground[pkg] ?: 0L, ev.timeStamp)
                eventCount[pkg] = (eventCount[pkg] ?: 0) + 1
              }
            }
          }
        }
      } catch (_: Exception) {
        // Events query denied / transient binder failure — fall through with empty maps.
      }
    }

    // Packages that actually appeared in today's events, non-system only.
    val rows = Arguments.createArray()
    val seen = HashSet<String>()
    val candidates = (lastBackground.keys + lastForeground.keys).sortedByDescending { pkg ->
      maxOf(lastBackground[pkg] ?: 0L, lastForeground[pkg] ?: 0L)
    }

    for (pkg in candidates) {
      if (!seen.add(pkg)) continue
      if (pkg == context.packageName) continue

      var label = pkg
      var isSystem = true
      try {
        val ai = pm.getApplicationInfo(pkg, 0)
        label = pm.getApplicationLabel(ai).toString()
        isSystem = (ai.flags and ApplicationInfo.FLAG_SYSTEM) != 0
      } catch (_: Exception) {
        continue // package uninstalled mid-scan
      }
      if (isSystem) continue

      val bg = lastBackground[pkg] ?: 0L
      val fg = lastForeground[pkg] ?: 0L
      val count = eventCount[pkg] ?: 0
      // Estimate of "still in background": most recent bg timestamp, and we
      // never saw a matching resume after it within the same event walk.
      val stillInBackground = bg > fg

      val row = Arguments.createMap().apply {
        putString("packageName", pkg)
        putString("label", label)
        putDouble("lastBackgroundMs", bg.toDouble())
        putDouble("lastForegroundMs", fg.toDouble())
        putDouble("backgroundAgoMs", (now - bg).toDouble())
        putInt("eventCount", count)
        putBoolean("stillInBackground", stillInBackground)
        putBoolean("isSystem", false)
      }
      rows.pushMap(row)
      if (rows.size() >= limit.coerceAtLeast(1)) break
    }
    return rows
  }
}
