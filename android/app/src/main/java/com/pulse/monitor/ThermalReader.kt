package com.pulse.monitor

import android.content.Context
import android.os.Build
import android.os.PowerManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

/**
 * Thermal status via PowerManager (spec §9).
 * APIs are gated: status requires API 29, headroom API 30.
 * Unsupported => null fields.
 */
object ThermalReader {

  fun read(context: Context): WritableMap {
    val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    var status: String? = null
    var headroom: Double? = null

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      status = statusString(pm.currentThermalStatus)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      // Window of seconds to average over; -1 means the platform declined
      // to report headroom for this device.
      val raw = pm.getThermalHeadroom(10)
      if (raw >= 0f) headroom = raw.toDouble()
    }

    return Arguments.createMap().apply {
      putString("status", status)
      if (headroom != null) putDouble("thermalHeadroom", headroom) else putNull("thermalHeadroom")
      putDouble("timestamp", System.currentTimeMillis().toDouble())
    }
  }

  private fun statusString(thermalStatus: Int): String? = when (thermalStatus) {
    PowerManager.THERMAL_STATUS_NONE -> "none"
    PowerManager.THERMAL_STATUS_LIGHT -> "light"
    PowerManager.THERMAL_STATUS_MODERATE -> "moderate"
    PowerManager.THERMAL_STATUS_SEVERE -> "severe"
    PowerManager.THERMAL_STATUS_CRITICAL -> "critical"
    PowerManager.THERMAL_STATUS_EMERGENCY -> "emergency"
    PowerManager.THERMAL_STATUS_SHUTDOWN -> "shutdown"
    else -> null
  }
}
