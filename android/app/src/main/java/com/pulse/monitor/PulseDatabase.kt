package com.pulse.monitor

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap

/**
 * Local time-series store for monitoring samples (spec §11).
 * One row per sampling tick; all sizes bytes, times epoch ms.
 * Downsampled queries keep chart payloads small regardless of retention.
 */
class PulseDatabase(context: Context) :
  SQLiteOpenHelper(context.applicationContext, DB_NAME, null, DB_VERSION) {

  companion object {
    const val DB_NAME = "pulse.db"
    const val DB_VERSION = 1
    const val TABLE = "samples"
  }

  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL(
      """
      CREATE TABLE IF NOT EXISTS $TABLE (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER NOT NULL,
        ram_total INTEGER,
        ram_avail INTEGER,
        ram_used INTEGER,
        low_memory INTEGER,
        battery_pct INTEGER,
        battery_temp REAL,
        battery_voltage INTEGER,
        battery_status TEXT,
        battery_health TEXT,
        storage_total INTEGER,
        storage_used INTEGER,
        storage_free INTEGER,
        thermal_status TEXT,
        thermal_headroom REAL
      )
      """.trimIndent(),
    )
    db.execSQL("CREATE INDEX IF NOT EXISTS idx_samples_ts ON $TABLE(ts)")
  }

  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
    // v1 — future migrations land here (spec §18 database migration tests).
  }

  fun insertSample(map: ReadableMap): Double {
    val values = ContentValues().apply {
      put("ts", map.doubleOr("ts", System.currentTimeMillis().toDouble()).toLong())
      putLongOrNull("ram_total", map.longOrNull("ramTotal"))
      putLongOrNull("ram_avail", map.longOrNull("ramAvail"))
      putLongOrNull("ram_used", map.longOrNull("ramUsed"))
      // lowMemory arrives as a JS boolean — store 0/1.
      if (map.hasKey("lowMemory") && !map.isNull("lowMemory")) {
        put("low_memory", if (map.getBoolean("lowMemory")) 1 else 0)
      } else {
        putNull("low_memory")
      }
      putIntOrNull("battery_pct", map.intOrNull("batteryPct"))
      putDoubleOrNull("battery_temp", map.doubleOrNull("batteryTemp"))
      putIntOrNull("battery_voltage", map.intOrNull("batteryVoltage"))
      putStringOrNull("battery_status", map.stringOrNull("batteryStatus"))
      putStringOrNull("battery_health", map.stringOrNull("batteryHealth"))
      putLongOrNull("storage_total", map.longOrNull("storageTotal"))
      putLongOrNull("storage_used", map.longOrNull("storageUsed"))
      putLongOrNull("storage_free", map.longOrNull("storageFree"))
      putStringOrNull("thermal_status", map.stringOrNull("thermalStatus"))
      putDoubleOrNull("thermal_headroom", map.doubleOrNull("thermalHeadroom"))
    }
    return writableDatabase.insertOrThrow(TABLE, null, values).toDouble()
  }

  /**
   * Time-bucketed averages for charts. `maxPoints` caps payload size so a
   * 30-day range never ships tens of thousands of rows to JS.
   */
  fun queryDownsampled(fromTs: Long, toTs: Long, maxPoints: Int): WritableArray {
    val span = (toTs - fromTs).coerceAtLeast(1L)
    val bucketMs = (span / maxPoints.coerceAtLeast(1)).coerceAtLeast(1L)
    val db = readableDatabase
    val out = Arguments.createArray()

    db.rawQuery(
      """
      SELECT
        MIN(ts) AS ts,
        AVG(CASE WHEN ram_total > 0 THEN ram_used * 100.0 / ram_total END) AS ram_pct,
        AVG(battery_pct) AS bat_pct,
        AVG(CASE WHEN storage_total > 0 THEN storage_used * 100.0 / storage_total END) AS sto_pct,
        COUNT(*) AS n
      FROM $TABLE
      WHERE ts >= ? AND ts <= ?
      GROUP BY ts / ?
      ORDER BY ts ASC
      """.trimIndent(),
      arrayOf(fromTs.toString(), toTs.toString(), bucketMs.toString()),
    ).use { c ->
      while (c.moveToNext()) {
        val row = Arguments.createMap().apply {
          putDouble("ts", c.getDouble(0))
          putNullableDouble(this, "ramPct", c, 1)
          putNullableDouble(this, "batPct", c, 2)
          putNullableDouble(this, "stoPct", c, 3)
          putInt("n", c.getInt(4))
        }
        out.pushMap(row)
      }
    }
    return out
  }

  /** Per-day aggregates for the History summary list (spec §11). */
  fun queryDaily(fromTs: Long, toTs: Long): WritableArray {
    val db = readableDatabase
    val out = Arguments.createArray()
    db.rawQuery(
      """
      SELECT
        ts / 86400000 AS day,
        AVG(CASE WHEN ram_total > 0 THEN ram_used * 100.0 / ram_total END) AS ram_pct,
        MIN(battery_pct) AS bat_min,
        MAX(battery_pct) AS bat_max,
        AVG(CASE WHEN storage_total > 0 THEN storage_used * 100.0 / storage_total END) AS sto_pct,
        COUNT(*) AS n
      FROM $TABLE
      WHERE ts >= ? AND ts <= ?
      GROUP BY day
      ORDER BY day DESC
      """.trimIndent(),
      arrayOf(fromTs.toString(), toTs.toString()),
    ).use { c ->
      while (c.moveToNext()) {
        val row = Arguments.createMap().apply {
          putDouble("dayKey", c.getDouble(0))
          putNullableDouble(this, "ramPct", c, 1)
          putInt("batMin", c.getInt(2))
          putInt("batMax", c.getInt(3))
          putNullableDouble(this, "stoPct", c, 4)
          putInt("n", c.getInt(5))
        }
        out.pushMap(row)
      }
    }
    return out
  }

  fun count(): Double {
    readableDatabase.rawQuery("SELECT COUNT(*) FROM $TABLE", null).use { c ->
      return if (c.moveToFirst()) c.getDouble(0) else 0.0
    }
  }

  fun clearAll(): Double {
    val n = writableDatabase.delete(TABLE, null, null).toDouble()
    writableDatabase.execSQL("VACUUM")
    return n
  }

  // ── ContentValues / ReadableMap helpers ──────────────────────────

  private fun ReadableMap.doubleOr(key: String, default: Double): Double =
    if (hasKey(key) && !isNull(key)) getDouble(key) else default

  private fun ReadableMap.longOrNull(key: String): Long? =
    if (hasKey(key) && !isNull(key)) getDouble(key).toLong() else null

  private fun ReadableMap.intOrNull(key: String): Int? =
    if (hasKey(key) && !isNull(key)) getInt(key) else null

  private fun ReadableMap.doubleOrNull(key: String): Double? =
    if (hasKey(key) && !isNull(key)) getDouble(key) else null

  private fun ReadableMap.stringOrNull(key: String): String? =
    if (hasKey(key) && !isNull(key)) getString(key) else null

  private fun ContentValues.putLongOrNull(key: String, value: Long?) {
    if (value == null) putNull(key) else put(key, value)
  }

  private fun ContentValues.putIntOrNull(key: String, value: Int?) {
    if (value == null) putNull(key) else put(key, value)
  }

  private fun ContentValues.putDoubleOrNull(key: String, value: Double?) {
    if (value == null) putNull(key) else put(key, value)
  }

  private fun ContentValues.putStringOrNull(key: String, value: String?) {
    if (value == null) putNull(key) else put(key, value)
  }

  private fun putNullableDouble(map: WritableMap, key: String, c: android.database.Cursor, col: Int) {
    if (c.isNull(col)) map.putNull(key) else map.putDouble(key, c.getDouble(col))
  }
}
