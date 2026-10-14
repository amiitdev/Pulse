package com.pulse.monitor

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

/**
 * Battery reading via the sticky ACTION_BATTERY_CHANGED intent +
 * BatteryManager capacity property (spec §7).
 * Unavailable properties are null — never fabricated.
 */
object BatteryReader {

  fun read(context: Context): WritableMap {
    val sticky = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    val bm = context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager

    // Prefer the fuel-gauge capacity; fall back to level/scale.
    var percent: Int? = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
      .takeIf { it in 0..100 }
    if (sticky != null && percent == null) {
      val level = sticky.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
      val scale = sticky.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
      if (level >= 0 && scale > 0) {
        percent = Math.round(level * 100f / scale)
      }
    }

    val statusInt = sticky?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
    val plugged = sticky?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0
    // EXTRA_TEMPERATURE is tenths of a degree Celsius.
    val tempTenths = sticky?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Int.MIN_VALUE) ?: Int.MIN_VALUE
    val voltageMv = sticky?.getIntExtra(BatteryManager.EXTRA_VOLTAGE, -1) ?: -1
    val healthInt = sticky?.getIntExtra(BatteryManager.EXTRA_HEALTH, -1) ?: -1

    return Arguments.createMap().apply {
      if (percent != null) putInt("percent", percent) else putNull("percent")
      putString("status", statusString(statusInt))
      putString("charger", chargerString(plugged))
      if (tempTenths != Int.MIN_VALUE && tempTenths > 0) {
        putDouble("temperatureC", tempTenths / 10.0)
      } else {
        putNull("temperatureC")
      }
      if (voltageMv > 0) putInt("voltageMv", voltageMv) else putNull("voltageMv")
      putString("health", healthString(healthInt))
      putDouble("timestamp", System.currentTimeMillis().toDouble())
    }
  }

  private fun statusString(status: Int): String = when (status) {
    BatteryManager.BATTERY_STATUS_CHARGING -> "charging"
    BatteryManager.BATTERY_STATUS_DISCHARGING -> "discharging"
    BatteryManager.BATTERY_STATUS_FULL -> "full"
    BatteryManager.BATTERY_STATUS_NOT_CHARGING -> "not_charging"
    else -> "unknown"
  }

  private fun chargerString(plugged: Int): String? = when {
    plugged and BatteryManager.BATTERY_PLUGGED_AC != 0 -> "ac"
    plugged and BatteryManager.BATTERY_PLUGGED_USB != 0 -> "usb"
    plugged and BatteryManager.BATTERY_PLUGGED_WIRELESS != 0 -> "wireless"
    else -> null
  }

  private fun healthString(health: Int): String? = when (health) {
    BatteryManager.BATTERY_HEALTH_GOOD -> "good"
    BatteryManager.BATTERY_HEALTH_OVERHEAT -> "overheat"
    BatteryManager.BATTERY_HEALTH_DEAD -> "dead"
    BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE -> "over_voltage"
    BatteryManager.BATTERY_HEALTH_UNSPECIFIED_FAILURE -> "failure"
    BatteryManager.BATTERY_HEALTH_COLD -> "cold"
    else -> null
  }
}
