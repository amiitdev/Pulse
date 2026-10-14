<div align="center">

# ❤️‍🔥 Pulse

### Premium Android Device Monitor

**Live RAM · Battery · Storage · CPU · Thermal · App Inspector · File Explorer · History**

*Built with React Native + Kotlin — real OS APIs, honest data, zero fake numbers.*

</div>

---

## ✨ What is Pulse?

Pulse is a **native Android diagnostic tool** that reads *real* device metrics through Android system APIs and presents them in a polished, dark-first UI.

There is **one golden rule**贯穿 the entire codebase:

> **Every number comes from a real Android API. If the OS doesn't expose it, the field is `null` — never fabricated.**

Per-app live RAM, per-core CPU frequency, battery health — if Android hides it from normal apps, Pulse shows **"Unavailable"** instead of inventing a value.

---

## 📱 Screens

| Screen | What it shows |
|---|---|
| **Home** | Device identity, live RAM/Battery/Storage gauges, diagnostic findings, session summary |
| **RAM** | Total / used / available, low-memory flag, history chart |
| **Battery** | %, status, charger type, temperature, voltage, health (when exposed) |
| **Storage** | Total / used / free, category breakdown |
| **CPU · Thermal** | Cores, load average, thermal status + headroom, gaming session mode |
| **App Inspector** | Storage & usage-time rankings, **real background processes** (UsageStats events), stop / cache actions |
| **File Explorer** | MediaStore-backed browse by category, deep filesystem organize by month, SAF folder-move with dry-run preview, safe trash delete |
| **History** | SQLite-sampled time-series charts (RAM / battery / storage over time) |
| **Settings** | Sampling interval, history retention, about |

---

## 🏗 How it was built — from scratch

### 1. Environment & scaffold

```
Node 24 · Java 21 · Android SDK 37 · Gradle 9.4 · Kotlin 2.2
React Native 0.87.1 (New Architecture + Hermes enabled)
```

Project was bootstrapped with `@react-native-community/cli` (installed globally to avoid npm's `EALLOWSCRIPTS` env-var injection bug on npm 11).

### 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| UI framework | **React Native 0.87** | One codebase, native performance, New Architecture (Fabric + TurboModules) |
| Language (JS) | **TypeScript 6** | Full type safety across the JS↔Kotlin contract |
| Language (native) | **Kotlin 2.2** | First-class Android language, coroutines, null-safety |
| Navigation | **React Navigation 7** (bottom tabs) | Industry standard, typed routes |
| Charts / gauges | **react-native-svg 15** | Custom circular gauges + line charts, no heavy chart lib |
| History storage | **SQLite** (via Kotlin `SQLiteOpenHelper`) | Local time-series, no network |
| Settings | **AsyncStorage** | Lightweight key-value persistence |
| Background sampling | **AndroidX WorkManager** | Deferrable, battery-friendly periodic work |
| Bridge | **ReactContextBaseJavaModule** (classic bridge) | Simple, stable, works with New Arch |

### 3. Folder structure

```
Pulse/
├── App.tsx                          # Entry: animated splash → DB init → navigation
├── ARCHITECTURE.md                  # Full architecture + phase log
│
├── src/
│   ├── components/                  # Reusable UI
│   │   ├── CircularGauge.tsx        #   SVG arc gauge (RAM/Battery/Storage)
│   │   ├── LineChart.tsx            #   SVG time-series chart
│   │   ├── MetricCard.tsx           #   Stat card with label + value + trend
│   │   ├── StatusBadge.tsx          #   Tone-coloured pill badge
│   │   ├── EmptyState.tsx           #   Friendly "nothing here" placeholder
│   │   ├── Skeleton.tsx             #   Shimmer loading placeholder
│   │   ├── ScreenContainer.tsx      #   Safe-area + title + scroll wrapper
│   │   ├── SplashOverlay.tsx        #   Animated launch splash (pulse rings + wordmark)
│   │   └── TabBarIcon.tsx           #   Tab icon helper
│   │
│   ├── screens/                     # One file per tab / detail screen
│   │   ├── DashboardScreen.tsx      #   Home: identity + live gauges + findings
│   │   ├── RamScreen.tsx
│   │   ├── BatteryScreen.tsx
│   │   ├── StorageScreen.tsx
│   │   ├── CpuThermalScreen.tsx
│   │   ├── AppInspectorScreen.tsx   #   App list, Background tab, Stop/Cache actions
│   │   ├── FileExplorerScreen.tsx   #   Browse + Organize + SAF move + delete
│   │   ├── HistoryScreen.tsx        #   SQLite-backed charts
│   │   └── SettingsScreen.tsx
│   │
│   ├── native/                      # JS ↔ Kotlin contract
│   │   ├── DeviceMonitor.ts         #   Typed facade over NativeModules.PulseDeviceMonitor
│   │   └── types.ts                 #   All shared interfaces (null-able = honest)
│   │
│   ├── database/
│   │   ├── schema.ts                #   SQLite table definitions
│   │   └── repository.ts            #   init / insert / query / clear
│   │
│   ├── services/
│   │   ├── samplingService.ts       #   Periodic snapshot → SQLite
│   │   ├── diagnosticEngine.ts      #   Offline rule engine (thresholds → findings)
│   │   ├── sessionManager.ts        #   Gaming-session state machine
│   │   ├── exportService.ts         #   CSV / JSON export
│   │   └── settingsStore.ts         #   AsyncStorage-backed settings
│   │
│   ├── navigation/
│   │   ├── RootNavigator.tsx        #   Bottom-tab navigator
│   │   └── types.ts                 #   Typed route params
│   │
│   ├── theme/
│   │   ├── colors.ts                #   Charcoal + coral palette, dark/light
│   │   ├── spacing.ts               #   4-pt spacing scale
│   │   ├── typography.ts            #   Type ramp
│   │   ├── useTheme.ts              #   Theme hook
│   │   └── index.ts
│   │
│   ├── hooks/
│   │   └── useNativeReading.ts      #   Poll a native getter on an interval
│   │
│   └── utils/
│       └── format.ts                #   formatBytes, formatDuration, formatDateTime
│
├── android/                         # Native Android project
│   └── app/src/main/
│       ├── AndroidManifest.xml      #   Permissions (UsageStats, Media, Kill…)
│       ├── java/com/pulse/
│       │   ├── MainActivity.kt      #   ReactActivity entry
│       │   ├── MainApplication.kt   #   RN host + package registration
│       │   ├── monitor/             #   ★ Pure-Kotlin readers (no React imports)
│       │   │   ├── RamReader.kt         # ActivityManager.MemoryInfo
│       │   │   ├── BatteryReader.kt     # BatteryManager + ACTION_BATTERY_CHANGED
│       │   │   ├── StorageReader.kt     # StatFs
│       │   │   ├── ThermalReader.kt     # PowerManager thermal APIs
│       │   │   ├── CpuReader.kt         # /proc + Runtime
│       │   │   ├── DeviceInfoReader.kt  # Build + Runtime
│       │   │   ├── AppUsageReader.kt    # UsageStatsManager (usage + background events)
│       │   │   ├── AppActioner.kt       # kill / cache / settings intents
│       │   │   ├── FileScanner.kt       # MediaStore queries + SQL LIMIT + cache
│       │   │   ├── FileOrganizer.kt     # Deep walk + SAF plan/execute moves
│       │   │   └── PulseDatabase.kt     # SQLite history
│       │   └── pulse/
│       │       ├── PulseDeviceMonitorModule.kt  # ★ Bridge surface (thin)
│       │       └── PulsePackage.kt
│       └── res/
│           ├── drawable/
│           │   ├── ic_launcher_background.xml   # Adaptive-icon bg
│           │   ├── ic_launcher_foreground.png   # Heart-pulse glyph
│           │   └── splash_background.png        # Launch window bg
│           ├── mipmap-*/            # Launcher icons (48–192 px)
│           ├── mipmap-anydpi-v26/   # Adaptive icon XML (API 26+)
│           └── values/styles.xml    # AppTheme (black status/nav bars)
│
└── __tests__/                       # Jest tests
    ├── App.test.tsx
    └── diagnosticEngine.test.ts
```

### 4. The native bridge contract

Every getter follows the same pattern:

```
Kotlin reader (pure object)  →  Bridge module (@ReactMethod)  →  TS facade  →  Screen
```

- Kotlin readers are **plain objects** with no React imports — fully unit-testable.
- The bridge module is **thin** — just try/catch + delegate.
- The TS facade resolves to `null` on any failure (missing module, unsupported API, binder death) so screens render an explicit "Unavailable" state — **never a fake number**.

### 5. Key features & how they work

#### 🟢 Animated splash screen
Built with React Native's `Animated` API + `react-native-svg` (no Expo dependency — this is a bare RN project). Radiating pulse rings, heart-pulse glyph with ECG stroke draw-on, wordmark rise-in, then a 480 ms fade into the dashboard. The native window background is a matching `splash_background.png` so the handoff is seamless.

#### 📊 Live monitoring
`samplingService` polls Kotlin readers every N seconds (configurable 30 s – 15 min), composes a `SystemSnapshot`, writes it to SQLite, and pushes it to screens via a lightweight subscription.

#### 🧠 Diagnostic engine
`diagnosticEngine.ts` is a pure-function rule engine. Each rule has:
- **trigger** — the measurement + threshold that fired it
- **explanation** — what it means in plain language
- **nextAction** — what the user can do
- **limitation** — what Pulse *cannot* know (honesty)

Rules fire on real thresholds (e.g. RAM > 85 %, storage < 15 % free, thermal status ≥ moderate).

#### 🗂 File Explorer
- **Browse** — MediaStore queries per collection (Images / Video / Audio / Files), with **SQL LIMIT** pushed into the cursor (`QUERY_ARG_LIMIT` on API 30+, `LIMIT n` in sortOrder on older). Results cached per `(category, limit)` for 30 s.
- **Organize** — deep recursive walk of external storage, categorised by extension + path heuristics, grouped by month.
- **SAF move** — `ACTION_OPEN_DOCUMENT_TREE` picker → dry-run plan (`planMoves`, touches nothing) → user confirms → `executeMoves` creates dirs via `DocumentsContract`, copies bytes, deletes sources.
- **Delete** — MediaStore trash on Q+, double-confirm dialog, never automatic.

#### ⚡ Background processes
`AppUsageReader.readBackground()` walks today's `UsageStatsManager.queryEvents` (no StorageStats — fast), tracks last background/foreground timestamps per package, and returns non-system apps sorted by recency with a `stillInBackground` flag.

#### 🛑 Stop / Cache
- **Stop** — `ActivityManager.killBackgroundProcesses` with optimistic UI removal + immediate success alert + delayed background refresh.
- **Cache** — Pulse clears only its *own* cache. For other apps it opens the system storage page (Android reserves that for the system).

---

## 🧪 Testing & quality

```bash
npm test          # 9 Jest tests (diagnosticEngine + App smoke)
npx tsc --noEmit  # TypeScript strict
npx eslint .      # ESLint (RN config)
```

---

## 📦 Build & install

### Debug (with Metro)

```bash
npm start                 # Terminal 1 — Metro bundler
adb reverse tcp:8081 tcp:8081
npm run android           # Terminal 2 — build + install + launch
```

### Release APK

```bash
cd android
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
adb install -r app-release.apk
```

The release build:
- Embeds the JS bundle (no Metro needed on device)
- Is signed with a local release keystore (`pulse-release.keystore`, gitignored)
- Has `versionName 1.0.0` / `versionCode 1`

---

## 🔐 Permissions

| Permission | Why |
|---|---|
| `PACKAGE_USAGE_STATS` | Usage time + real background-process events (user grants via Settings → Usage access) |
| `KILL_BACKGROUND_PROCESSES` | Stop background apps the user explicitly chooses |
| `READ_MEDIA_IMAGES/VIDEO/AUDIO` | MediaStore file explorer (scoped — no All Files Access) |
| `READ_EXTERNAL_STORAGE` (≤ API 32) | Legacy media read |
| `INTERNET` | Metro debugging only (release has no network dependency) |
| `QUERY_ALL_PACKAGES` | List installed apps for the inspector |

Pulse **never** requests `MANAGE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`, or accessibility privileges.

---

## 📋 Roadmap

- [x] Phase 1 — Environment, scaffold, debug APK
- [x] Phase 2 — Navigation, theme, components, dashboard
- [x] Phase 3 — Kotlin RAM + device readers, bridge
- [x] Phase 4 — Battery + storage + thermal + CPU
- [x] Phase 5 — SQLite history + charts + sampling
- [x] Phase 6 — Diagnostics engine + gaming session
- [x] Phase 7 — App Inspector, kill/cache, File Explorer, organize, export, settings
- [x] Phase 8 — Tests, lint clean, release APK
- [ ] Phase 9 — WorkManager background sampling, CSV export polish, light theme

---

## 📄 License

MIT — do whatever you want, attribution appreciated.

---

<div align="center">

**Built with ❤️‍🔥 by [Amit Kumar](mailto:amitkumar.devnode@gmail.com)**

*Real APIs. Honest data. Beautiful UI.*

</div>
