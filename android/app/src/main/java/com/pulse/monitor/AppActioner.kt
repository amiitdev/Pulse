package com.pulse.monitor

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import java.io.File

/**
 * User-controlled maintenance actions (spec §8, §17).
 * Only what Android allows a normal app to do — never system-only APIs.
 */
object AppActioner {

  /** Kill background processes of another app (frees RAM it holds). */
  fun killBackgroundApp(context: Context, packageName: String): Boolean {
    val am = context.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
    am.killBackgroundProcesses(packageName)
    return true
  }

  /** Recursive size of a directory in bytes. */
  fun dirSize(dir: File?): Long {
    if (dir == null || !dir.exists()) return 0L
    var total = 0L
    dir.walkBottomUp().forEach { f ->
      if (f.isFile) total += f.length()
    }
    return total
  }

  /**
   * Clear Pulse's own webview/file caches.
   * Does NOT touch codeCacheDir — deleting it while V8/Hermes is running
   * fails or crashes. Returns bytes freed.
   */
  fun clearOwnCache(context: Context): Long {
    val before = ownCacheBytes(context)
    var freed = 0L

    // Empty the contents of cacheDir, keep the directory itself.
    context.cacheDir?.listFiles()?.forEach { child ->
      val size = dirSize(child)
      if (child.deleteRecursively()) {
        freed += size
      }
    }

    // External cache (getExternalCacheDir) — optional, may be null.
    context.externalCacheDir?.listFiles()?.forEach { child ->
      val size = dirSize(child)
      if (child.deleteRecursively()) {
        freed += size
      }
    }

    return if (freed > 0) freed else before
  }

  /** Own app cache size in bytes (for display before clearing). */
  fun ownCacheBytes(context: Context): Long =
    dirSize(context.cacheDir) + dirSize(context.externalCacheDir)

  /** Intent that opens another app's storage/settings page (user clears cache there). */
  fun openAppStorageSettings(context: Context, packageName: String) {
    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
      data = Uri.fromParts("package", packageName, null)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    context.startActivity(intent)
  }

  fun summaryMap(ownCacheBytes: Long): WritableMap =
    Arguments.createMap().apply {
      putDouble("ownCacheBytes", ownCacheBytes.toDouble())
      putBoolean("canClearOtherAppCache", false)
    }
}
