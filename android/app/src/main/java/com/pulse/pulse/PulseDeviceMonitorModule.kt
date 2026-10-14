package com.pulse.pulse

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule
import com.pulse.monitor.AppActioner
import com.pulse.monitor.AppUsageReader
import com.pulse.monitor.BatteryReader
import com.pulse.monitor.CpuReader
import com.pulse.monitor.DeviceInfoReader
import com.pulse.monitor.FileOrganizer
import com.pulse.monitor.FileScanner
import com.pulse.monitor.PulseDatabase
import com.pulse.monitor.RamReader
import com.pulse.monitor.StorageReader
import com.pulse.monitor.ThermalReader

/**
 * Single bridge surface for Pulse (spec §14).
 * Delegates to pure reader objects so this class stays thin.
 * All promises resolve real OS values or reject — never fabricated data.
 */
@ReactModule(name = PulseDeviceMonitorModule.NAME)
class PulseDeviceMonitorModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val NAME = "PulseDeviceMonitor"
    private const val REQ_PICK_FOLDER = 0x5011
  }

  private val db by lazy { PulseDatabase(reactApplicationContext) }

  override fun getName(): String = NAME

  // ── SAF folder picker (organize destination) ─────────────────────

  private var pendingFolderPick: Promise? = null

  private val activityListener: ActivityEventListener =
    object : BaseActivityEventListener() {
      override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?,
      ) {
        if (requestCode != REQ_PICK_FOLDER) return
        val p = pendingFolderPick
        pendingFolderPick = null
        if (resultCode == Activity.RESULT_OK && data?.data != null) {
          val uri = data.data!!
          try {
            // Persist read+write so future organize runs don't re-prompt.
            reactApplicationContext.contentResolver.takePersistableUriPermission(
              uri,
              Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION,
            )
          } catch (_: Exception) {
            // Some providers don't support persistable grants — still usable this session.
          }
          p?.resolve(uri.toString())
        } else {
          p?.resolve(null) // user cancelled — not an error
        }
      }
    }

  init {
    reactApplicationContext.addActivityEventListener(activityListener)
  }

  @ReactMethod
  fun pickOrganizeFolder(promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("E_NO_ACTIVITY", "No foreground activity to launch SAF picker")
      return
    }
    if (pendingFolderPick != null) {
      promise.reject("E_PICK_BUSY", "A folder picker is already open")
      return
    }
    pendingFolderPick = promise
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
      addFlags(
        Intent.FLAG_GRANT_READ_URI_PERMISSION or
          Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
          Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION,
      )
    }
    try {
      @Suppress("DEPRECATION")
      activity.startActivityForResult(intent, REQ_PICK_FOLDER)
    } catch (e: Exception) {
      pendingFolderPick = null
      promise.reject("E_PICK_FAILED", e.message, e)
    }
  }

  // ── Readings ─────────────────────────────────────────────────────

  @ReactMethod
  fun getDeviceInfo(promise: Promise) =
    resolveMap(promise) { DeviceInfoReader.read(reactApplicationContext) }

  @ReactMethod
  fun getRamReading(promise: Promise) =
    resolveMap(promise) { RamReader.read(reactApplicationContext) }

  @ReactMethod
  fun getBatteryReading(promise: Promise) =
    resolveMap(promise) { BatteryReader.read(reactApplicationContext) }

  @ReactMethod
  fun getStorageReading(promise: Promise) =
    resolveMap(promise) { StorageReader.read() }

  @ReactMethod
  fun getThermalReading(promise: Promise) =
    resolveMap(promise) { ThermalReader.read(reactApplicationContext) }

  // ── SQLite history (spec §11) ────────────────────────────────────

  @ReactMethod
  fun dbInit(promise: Promise) {
    try {
      db.readableDatabase
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_DB_INIT", e.message, e)
    }
  }

  @ReactMethod
  fun dbInsertSample(sample: ReadableMap, promise: Promise) {
    try {
      promise.resolve(db.insertSample(sample))
    } catch (e: Exception) {
      promise.reject("E_DB_INSERT", e.message, e)
    }
  }

  @ReactMethod
  fun dbQueryRange(fromTs: Double, toTs: Double, maxPoints: Double, promise: Promise) {
    try {
      promise.resolve(db.queryDownsampled(fromTs.toLong(), toTs.toLong(), maxPoints.toInt()))
    } catch (e: Exception) {
      promise.reject("E_DB_QUERY", e.message, e)
    }
  }

  @ReactMethod
  fun dbQueryDaily(fromTs: Double, toTs: Double, promise: Promise) {
    try {
      promise.resolve(db.queryDaily(fromTs.toLong(), toTs.toLong()))
    } catch (e: Exception) {
      promise.reject("E_DB_DAILY", e.message, e)
    }
  }

  @ReactMethod
  fun dbCount(promise: Promise) {
    try {
      promise.resolve(db.count())
    } catch (e: Exception) {
      promise.reject("E_DB_COUNT", e.message, e)
    }
  }

  @ReactMethod
  fun dbClear(promise: Promise) {
    try {
      promise.resolve(db.clearAll())
    } catch (e: Exception) {
      promise.reject("E_DB_CLEAR", e.message, e)
    }
  }

  // ── Per-app consumers (spec §10) ─────────────────────────────────

  @ReactMethod
  fun getAppUsage(promise: Promise) {
    try {
      promise.resolve(AppUsageReader.read(reactApplicationContext))
    } catch (e: Exception) {
      promise.reject("E_APP_USAGE", e.message, e)
    }
  }

  @ReactMethod
  fun getBackgroundApps(limit: Double, promise: Promise) {
    try {
      promise.resolve(AppUsageReader.readBackground(reactApplicationContext, limit.toInt()))
    } catch (e: Exception) {
      promise.reject("E_BG_APPS", e.message, e)
    }
  }

  @ReactMethod
  fun getTopApps(sortBy: String, limit: Double, promise: Promise) {
    try {
      promise.resolve(
        AppUsageReader.readTopBy(reactApplicationContext, sortBy, limit.toInt()),
      )
    } catch (e: Exception) {
      promise.reject("E_TOP_APPS", e.message, e)
    }
  }

  @ReactMethod
  fun getAppPermissionSummary(promise: Promise) {
    try {
      promise.resolve(AppUsageReader.permissionSummary(reactApplicationContext))
    } catch (e: Exception) {
      promise.reject("E_APP_PERMS", e.message, e)
    }
  }

  // ── Maintenance actions (kill / cache) ───────────────────────────

  @ReactMethod
  fun killBackgroundApp(packageName: String, promise: Promise) {
    try {
      val ok = AppActioner.killBackgroundApp(reactApplicationContext, packageName)
      promise.resolve(ok)
    } catch (e: Exception) {
      promise.reject("E_KILL", e.message, e)
    }
  }

  @ReactMethod
  fun clearOwnCache(promise: Promise) {
    try {
      val freed = AppActioner.clearOwnCache(reactApplicationContext)
      promise.resolve(freed.toDouble())
    } catch (e: Exception) {
      promise.reject("E_CACHE", e.message, e)
    }
  }

  @ReactMethod
  fun getOwnCacheBytes(promise: Promise) {
    try {
      promise.resolve(AppActioner.ownCacheBytes(reactApplicationContext).toDouble())
    } catch (e: Exception) {
      promise.reject("E_CACHE_SIZE", e.message, e)
    }
  }

  @ReactMethod
  fun openAppStorageSettings(packageName: String, promise: Promise) {
    try {
      AppActioner.openAppStorageSettings(reactApplicationContext, packageName)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_OPEN_SETTINGS", e.message, e)
    }
  }

  // ── CPU ──────────────────────────────────────────────────────────

  @ReactMethod
  fun getCpuInfo(promise: Promise) =
    resolveMap(promise) { CpuReader.read(reactApplicationContext) }

  // ── File explorer ────────────────────────────────────────────────

  @ReactMethod
  fun scanFiles(category: String?, limit: Double, promise: Promise) {
    try {
      val cat = if (category.isNullOrEmpty() || category == "all") null else category
      promise.resolve(FileScanner.scan(reactApplicationContext, cat, limit.toInt()))
    } catch (e: Exception) {
      promise.reject("E_SCAN", e.message, e)
    }
  }

  @ReactMethod
  fun getFileCategoryTotals(promise: Promise) {
    try {
      promise.resolve(FileScanner.categoryTotals(reactApplicationContext))
    } catch (e: Exception) {
      promise.reject("E_FILE_TOTALS", e.message, e)
    }
  }

  @ReactMethod
  fun deleteFile(uri: String, id: Double, promise: Promise) {
    try {
      val ok = FileScanner.delete(reactApplicationContext, uri, id.toLong())
      if (ok) FileScanner.invalidateCache()
      promise.resolve(ok)
    } catch (e: Exception) {
      promise.reject("E_DELETE", e.message, e)
    }
  }

  // ── Deep organize (user request) ─────────────────────────────────

  @ReactMethod
  fun organizeFiles(limit: Double, promise: Promise) {
    try {
      promise.resolve(FileOrganizer.organize(reactApplicationContext, limit.toInt()))
    } catch (e: Exception) {
      promise.reject("E_ORGANIZE", e.message, e)
    }
  }

  @ReactMethod
  fun organizeSummary(limit: Double, promise: Promise) {
    try {
      promise.resolve(FileOrganizer.summary(reactApplicationContext, limit.toInt()))
    } catch (e: Exception) {
      promise.reject("E_ORG_SUMMARY", e.message, e)
    }
  }

  @ReactMethod
  fun deleteOrganizedFile(path: String, promise: Promise) {
    try {
      // Path-based delete only after the JS layer has double-confirmed.
      val ok = FileOrganizer.deleteFile(path)
      promise.resolve(ok)
    } catch (e: Exception) {
      promise.reject("E_ORG_DELETE", e.message, e)
    }
  }

  // ── SAF organize: dry-run plan + execute moves ────────────────────

  @ReactMethod
  fun planOrganizeMoves(treeUri: String, paths: com.facebook.react.bridge.ReadableArray, promise: Promise) {
    try {
      promise.resolve(FileOrganizer.planMoves(treeUri, paths))
    } catch (e: Exception) {
      promise.reject("E_ORG_PLAN", e.message, e)
    }
  }

  @ReactMethod
  fun executeOrganizeMoves(treeUri: String, moves: com.facebook.react.bridge.ReadableArray, promise: Promise) {
    try {
      promise.resolve(FileOrganizer.executeMoves(reactApplicationContext, treeUri, moves))
    } catch (e: Exception) {
      promise.reject("E_ORG_EXECUTE", e.message, e)
    }
  }

  private inline fun resolveMap(promise: Promise, block: () -> com.facebook.react.bridge.WritableMap) {
    try {
      promise.resolve(block())
    } catch (e: Exception) {
      promise.reject("E_PULSE", e.message, e)
    }
  }
}
