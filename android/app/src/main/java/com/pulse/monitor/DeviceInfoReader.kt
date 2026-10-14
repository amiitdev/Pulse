package com.pulse.monitor

import android.content.Context
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

/** Device identity from Build + Runtime (spec §5). */
object DeviceInfoReader {

  fun read(context: Context): WritableMap {
    val runtime = Runtime.getRuntime()
    return Arguments.createMap().apply {
      putString("brand", Build.BRAND)
      putString("model", Build.MODEL)
      putString("manufacturer", Build.MANUFACTURER)
      putString("androidVersion", Build.VERSION.RELEASE)
      putInt("apiLevel", Build.VERSION.SDK_INT)
      val abis = Arguments.createArray()
      Build.SUPPORTED_ABIS.forEach { abis.pushString(it) }
      putArray("abis", abis)
      putInt("cpuCores", runtime.availableProcessors())
      putDouble("timestamp", System.currentTimeMillis().toDouble())
    }
  }
}
