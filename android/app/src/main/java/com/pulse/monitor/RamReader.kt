package com.pulse.monitor

import android.app.ActivityManager
import android.content.Context
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

/**
 * System-wide RAM via ActivityManager.MemoryInfo (spec §6).
 * usedBytes is explicitly defined as total - available.
 */
object RamReader {
  fun read(context: Context): WritableMap {
    val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    val info = ActivityManager.MemoryInfo()
    am.getMemoryInfo(info)

    val total = info.totalMem
    val avail = info.availMem
    val used = total - avail

    return Arguments.createMap().apply {
      putDouble("totalBytes", total.toDouble())
      putDouble("availableBytes", avail.toDouble())
      putDouble("usedBytes", used.toDouble())
      putBoolean("lowMemory", info.lowMemory)
      putDouble("timestamp", System.currentTimeMillis().toDouble())
    }
  }
}
