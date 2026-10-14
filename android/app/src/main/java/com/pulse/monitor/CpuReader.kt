package com.pulse.monitor

import android.content.Context
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import java.io.File

/**
 * CPU info + best-effort load estimate (spec §9).
 * /proc/loadavg is readable on production kernels; per-core /sys frequencies
 * usually are not — those fields stay null.
 */
object CpuReader {

  fun read(context: Context): WritableMap {
    val cores = Runtime.getRuntime().availableProcessors()
    val abis = Build.SUPPORTED_ABIS.joinToString(",")
    val arch = System.getProperty("os.arch") ?: Build.SUPPORTED_ABIS.firstOrNull()

    // 1-minute load average from /proc/loadavg: "0.52 0.58 0.59 2/1543 12345"
    var load1: Double? = null
    try {
      val line = File("/proc/loadavg").readText().trim()
      load1 = line.split(" ").getOrNull(0)?.toDoubleOrNull()
    } catch (_: Exception) {
      // Restricted kernel — leave null.
    }

    // Rough utilization estimate: load1 / cores, clamped 0..100.
    // Documented as an ESTIMATE — not true instantaneous CPU%.
    val loadEstimatePct: Int? = load1?.let { l ->
      ((l / cores) * 100.0).coerceIn(0.0, 100.0).toInt()
    }

    return Arguments.createMap().apply {
      putInt("cores", cores)
      putString("abis", abis)
      putString("arch", arch)
      if (load1 != null) putDouble("loadAvg1m", load1) else putNull("loadAvg1m")
      if (loadEstimatePct != null) putInt("loadEstimatePct", loadEstimatePct) else putNull("loadEstimatePct")
      putBoolean("loadIsEstimate", true)
      // Per-core frequencies are not exposed to normal apps on most kernels.
      putNull("freqKHz")
      putDouble("timestamp", System.currentTimeMillis().toDouble())
    }
  }
}
