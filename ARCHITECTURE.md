# Pulse — Architecture (Phase 1)

> Phase 1 output: environment verified, versions selected, project created, debug APK built.

## 1. Environment & Version Matrix

Verified on this machine (2026-10-14):

| Component | Detected | Required by RN 0.87 | Status |
|---|---|---|---|
| Node.js | 24.19.0 | >= 22.11 | ✅ |
| npm | 11.17.0 | — | ✅ |
| Java (OpenJDK) | 21.0.10 | 17+ | ✅ |
| Android SDK platforms | 34, 35, 36, 37 | compileSdk 37 | ✅ |
| Android build-tools | 34–37.0.0 | — | ✅ |
| cmdline-tools | 10.0 | — | ✅ |
| adb | 34.0.4 | — | ✅ |
| Gradle (wrapper) | 9.4.1 | supports Java 21 | ✅ |
| Android Gradle Plugin | managed by RN template | — | ✅ |
| Kotlin | 2.2.0 | — | ✅ |
| Disk free | 34 GB | ~5 GB/build cache | ✅ |
| RAM | 7.1 GB | gradle heap 2 GB | ✅ (tight) |

### Selected dependency versions

| Dependency | Version | Purpose |
|---|---|---|
| react-native | 0.87.1 (latest stable) | app framework |
| react | 19.2.3 | UI runtime |
| typescript | ^6.0.3 | type safety |
| @react-navigation/native + bottom-tabs | 7.x | navigation (Phase 2) |
| react-native-svg | 15.x | gauges + custom charts (Phase 2) |
| @react-native-async-storage/async-storage | 3.x | settings (Phase 7) |
| SQLite library | to be verified in Phase 5 | history storage |
| AndroidX WorkManager | via native Kotlin | background sampling (Phase 6) |

New Architecture is **enabled** (`newArchEnabled=true`), Hermes **enabled**,
minSdk **24**, targetSdk **36**, package id **com.pulse**.

### Environment quirk solved in Phase 1

```
npx injects:  npm_config_allow_scripts=<~/.npmrc list>
      │
      ▼
RN CLI spawns:  npm install --save --save-exact <template>
      │
      ▼
npm 11.17:  EALLOWSCRIPTS  (env-sourced --allow-scripts is illegal
            for project-scoped installs)
```

**Fix:** installed `@react-native-community/cli@20.2.0` globally (binary
`rnc-cli`), so the CLI runs *outside* npx and the env var is never injected.
Use `rnc-cli` instead of `npx react-native` for init-type commands.

## 2. High-Level Architecture

```
┌────────────────────────── React Native (TypeScript) ──────────────────────────┐
│                                                                               │
│  screens/                     features/                 services/            │
│  ├─ DashboardScreen           ├─ ram/       (hooks)     ├─ samplingService    │
│  ├─ RamScreen                 ├─ battery/               ├─ reportService      │
│  ├─ BatteryScreen             ├─ storage/               └─ diagnosticEngine   │
│  ├─ StorageScreen             ├─ thermal/                                   │
│  ├─ CpuThermalScreen          ├─ apps/                  database/            │
│  ├─ AppInspectorScreen        ├─ diagnostics/           ├─ schema.ts          │
│  ├─ HistoryScreen             └─ gaming/                └─ repository.ts      │
│  └─ SettingsScreen                                                        │
│                                                                               │
│  components/ (MetricCard, CircularGauge, LineChart, StatusBadge, EmptyState)  │
│  theme/  navigation/  hooks/  utils/                                          │
└───────────────────────────────┬───────────────────────────────────────────────┘
                                │  typed JSON contract (native/DeviceMonitor.ts)
                                │  TurboModule / NativeModules bridge
┌───────────────────────────────┴───────────────────────────────────────────────┐
│                              Kotlin (android/)                                │
│                                                                               │
│  DeviceInfoModule      RamMonitorModule     BatteryMonitorModule              │
│  StorageMonitorModule  ThermalMonitorModule AppInspectorModule                │
│  ┌─────────────────────────────────────────────────────────────────┐          │
│  │ SystemSampler — single source of periodic readings (lifecycle-  │          │
│  │ aware, thread-safe, main-thread safe)                           │          │
│  └─────────────────────────────────────────────────────────────────┘          │
│  MonitoringSessionManager — gaming session state machine                      │
│  SamplingWorker (WorkManager) — deferrable historical sampling                │
│                                                                               │
│  Android APIs: ActivityManager · BatteryManager · StatFs · Build ·            │
│                PowerManager(thermal) · UsageStatsManager(optional) · SAF      │
└───────────────────────────────────────────────────────────────────────────────┘
```

## 3. Kotlin Module Responsibilities

| Module | Android API | Returns |
|---|---|---|
| DeviceInfoModule | `Build`, `Runtime` | model, brand, Android version, API level, cores, ABI |
| RamMonitorModule | `ActivityManager.MemoryInfo` | total/available/used bytes, lowMemory flag |
| BatteryMonitorModule | `BatteryManager` + `ACTION_BATTERY_CHANGED` | %, status, charger, temp (tenths °C), voltage, health |
| StorageMonitorModule | `StatFs`, MediaStore, SAF | total/used/free bytes per volume |
| ThermalMonitorModule | `PowerManager` thermal status APIs | status level, headroom (nullable) |
| SystemSampler | composes the above | one timestamped snapshot object |
| MonitoringSessionManager | session state | start/stop, duration, samples buffer |

Rules (spec §14): typed returns, consistent units (bytes + epoch ms),
nullable for unsupported properties, lifecycle-aware subscriptions,
explicit cleanup, thread-safe state, no invented values.

### Illustrative data contract (RAM)

```json
{
  "totalBytes": 8589934592,
  "availableBytes": 3221225472,
  "usedBytes": 5368709120,
  "lowMemory": false,
  "timestamp": 1790000000000
}
```

All fields obtained from real APIs; unavailable values are `null`, never faked.

## 4. Planned Source Tree

```
Pulse/
├── ARCHITECTURE.md          ← this file
├── src/
│   ├── components/          MetricCard, CircularGauge, LineChart, StatusBadge, EmptyState
│   ├── screens/             8 screens (spec §4)
│   ├── features/            ram/ battery/ storage/ thermal/ apps/ diagnostics/ gaming/
│   ├── native/              DeviceMonitor.ts, types.ts   (bridge + contracts)
│   ├── database/            schema.ts, repository.ts     (Phase 5)
│   ├── services/            samplingService, reportService, diagnosticEngine
│   ├── navigation/          typed bottom-tab navigator
│   ├── hooks/               useInterval, usePermission, useMetric...
│   ├── theme/               colors (charcoal + coral), spacing, typography
│   └── utils/               formatBytes, formatDuration, units
├── android/app/src/main/java/com/pulse/
│   ├── MainActivity.kt, MainApplication.kt   (template)
│   └── pulse/                ← native modules added in Phase 3+
└── __tests__/               jest tests
```

## 5. Phase Map

| Phase | Goal | Main files | Verified when |
|---|---|---|---|
| 1 ✅ | environment, versions, scaffold | project + this doc | `assembleDebug` ✅, `tsc` ✅, `jest` ✅ |
| 2 ✅ | navigation, theme, components, dashboard layout | `src/navigation`, `src/theme`, `src/components`, 8 screens | tsc/eslint/jest ✅, APK ✅, **live on device (iQOO I2305, Android 16)** ✅ |
| 3 ✅ | Kotlin RAM + device readers, bridge | `monitor/*Reader.kt`, `PulseDeviceMonitorModule.kt` | live gauges on device ✅ |
| 4 ✅ | battery + storage + thermal + CPU | same module + `CpuReader.kt`, `ThermalReader.kt` | Battery/Storage/CPU screens live ✅ |
| 5 ✅ | SQLite history + charts + sampling | `PulseDatabase.kt`, `samplingService`, `repository` | 90+ rows on device, History charts ✅ |
| 6 ✅ | diagnostics engine + gaming session | `diagnosticEngine.ts`, `sessionManager.ts` | Dashboard findings fire on real thresholds ✅ |
| 7 ✅ | App Inspector, kill/cache, File Explorer, organize, export, settings | `AppActioner.kt`, `FileScanner.kt`, `FileOrganizer.kt`, screens | Usage Access granted, 400 files / 21.7 GB listed, Stop/Cache work ✅ |
| 8 ✅ | tests, lint clean, release-ready debug APK | `__tests__/`, README | 9 jest tests pass, tsc/eslint clean, APK installs ✅ |
| 3 | real RAM readings via Kotlin | `RamMonitorModule.kt`, `native/DeviceMonitor.ts`, RamScreen | values match `adb shell cat /proc/meminfo` |
| 4 | battery + storage | `BatteryMonitorModule.kt`, `StorageMonitorModule.kt` | % matches status bar; StatFs matches settings |
| 5 | SQLite history + graphs | `database/`, samplingService, HistoryScreen | rows written, charts read them |
| 6 | CPU/thermal, diagnostics, gaming sessions | `ThermalMonitorModule.kt`, diagnosticEngine, session manager | rules fire with real thresholds |
| 7 | app inspector, export, permissions, settings | AppInspector, reportService, SettingsScreen | CSV/JSON export works |
| 8 | tests, fixes, release APK, docs | tests + `assembleRelease` | release build + checklist |

## 6. Honest Limitations (locked in from spec)

- Per-app live RAM / battery: **not available** without system privileges → never shown.
- Thermal/CPU frequency: device-dependent → render `null` as "Unavailable".
- Battery health: manufacturer-reported only where exposed; estimates labeled as estimates.
- Background sampling: Android may delay WorkManager; no promise of second-by-second data.
- Storage: scoped storage — no `MANAGE_EXTERNAL_STORAGE`; SAF for user-picked folders.
