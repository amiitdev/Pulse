package com.pulse.monitor

import android.os.Environment
import android.os.StatFs
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

/** Internal filesystem stats via StatFs (spec §8). */
object StorageReader {

  fun read(): WritableMap {
    val stat = StatFs(Environment.getDataDirectory().path)
    val blockSize = stat.blockSizeLong
    val total = stat.blockCountLong * blockSize
    val avail = stat.availableBlocksLong * blockSize
    val used = total - avail

    return Arguments.createMap().apply {
      putDouble("totalBytes", total.toDouble())
      putDouble("freeBytes", avail.toDouble())
      putDouble("usedBytes", used.toDouble())
      putDouble("timestamp", System.currentTimeMillis().toDouble())
    }
  }
}
