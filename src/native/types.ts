/**
 * Kotlin <-> TypeScript data contract (spec §14).
 *
 * Rules:
 *  - All sizes are bytes, all times are epoch milliseconds.
 *  - Every field that Android may not expose is `null`-able.
 *  - `null` means "genuinely unavailable" — never fabricate a value.
 */

export interface DeviceInfo {
  brand: string | null;
  model: string | null;
  manufacturer: string | null;
  androidVersion: string | null;
  apiLevel: number | null;
  abis: string[] | null;
  cpuCores: number | null;
  timestamp: number;
}

export interface RamReading {
  totalBytes: number;
  availableBytes: number;
  /** Definition: usedBytes = totalBytes - availableBytes (spec §6). */
  usedBytes: number;
  lowMemory: boolean;
  timestamp: number;
}

export type BatteryStatus =
  | 'charging'
  | 'discharging'
  | 'full'
  | 'not_charging'
  | 'unknown';

export type BatteryHealth =
  | 'good'
  | 'overheat'
  | 'dead'
  | 'over_voltage'
  | 'failure'
  | 'cold'
  | 'unknown'
  | null;

export interface BatteryReading {
  /** 0..100, null when the device does not report it. */
  percent: number | null;
  status: BatteryStatus;
  /** e.g. "ac", "usb", "wireless" — null when unknown. */
  charger: string | null;
  /** Degrees Celsius, null when not exposed by this device. */
  temperatureC: number | null;
  /** Millivolts, null when not exposed. */
  voltageMv: number | null;
  /** Manufacturer-reported health; null when the platform hides it. */
  health: BatteryHealth;
  timestamp: number;
}

export interface StorageReading {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  timestamp: number;
}

export type ThermalStatus =
  | 'none'
  | 'light'
  | 'moderate'
  | 'severe'
  | 'critical'
  | 'emergency'
  | 'shutdown'
  | null;

export interface ThermalReading {
  status: ThermalStatus;
  /** 0..1 headroom, only where PowerManager exposes it. */
  thermalHeadroom: number | null;
  timestamp: number;
}

/** Aggregate snapshot used by the sampler and gaming sessions. */
export interface SystemSnapshot {
  device: DeviceInfo | null;
  ram: RamReading | null;
  battery: BatteryReading | null;
  storage: StorageReading | null;
  thermal: ThermalReading | null;
  timestamp: number;
}

/** One row handed to the native SQLite layer (Phase 5). */
export interface SampleInsert {
  ts: number;
  ramTotal: number | null;
  ramAvail: number | null;
  ramUsed: number | null;
  lowMemory: boolean | null;
  batteryPct: number | null;
  batteryTemp: number | null;
  batteryVoltage: number | null;
  batteryStatus: string | null;
  batteryHealth: string | null;
  storageTotal: number | null;
  storageUsed: number | null;
  storageFree: number | null;
  thermalStatus: string | null;
  thermalHeadroom: number | null;
}

/** Time-bucketed chart point from dbQueryRange. */
export interface ChartRow {
  ts: number;
  ramPct: number | null;
  batPct: number | null;
  stoPct: number | null;
  n: number;
}

/** Per-day aggregate from dbQueryDaily. */
export interface DailySummary {
  dayKey: number;
  ramPct: number | null;
  batMin: number;
  batMax: number;
  stoPct: number | null;
  n: number;
}

/** One installed app's resource footprint (spec §10). */
export interface AppUsageRow {
  packageName: string;
  label: string;
  appBytes: number;
  cacheBytes: number;
  dataBytes: number;
  totalBytes: number;
  usageMsToday: number;
  /** UsageStatsManager does not expose launch counts — always 0. */
  launchesToday: number;
  isSystem: boolean;
  /** Always null without system privileges — never fabricated. */
  ramBytes: number | null;
}

export interface AppPermissionSummary {
  usageAccess: boolean;
  storageStatsAvailable: boolean;
  apiLevel: number;
}

/** One real background-process row from UsageStats events (no StorageStats). */
export interface BackgroundAppRow {
  packageName: string;
  label: string;
  lastBackgroundMs: number;
  lastForegroundMs: number;
  backgroundAgoMs: number;
  eventCount: number;
  stillInBackground: boolean;
  isSystem: boolean;
}

export type AppSortKey = 'storage' | 'usage';

/** CPU snapshot from /proc + Build (spec §9). */
export interface CpuInfo {
  cores: number;
  abis: string | null;
  arch: string | null;
  loadAvg1m: number | null;
  /** Rough load/cores estimate — labeled as estimate, never exact. */
  loadEstimatePct: number | null;
  loadIsEstimate: boolean;
  /** Null — per-core freq not exposed to normal apps. */
  freqKHz: number | null;
  timestamp: number;
}

export type FileCategory =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'archive'
  | 'apk'
  | 'download'
  | 'other';

export interface FileRow {
  id: number;
  uri: string;
  name: string;
  size: number;
  mime: string | null;
  dateModified: number;
  category: FileCategory | string;
  extension: string;
}

export interface FileCategoryTotal {
  bytes: number;
  count: number;
}

export type FileCategoryTotals = Partial<Record<string, FileCategoryTotal>>;

/** One file from the deep recursive organizer. */
export interface OrganizedFile {
  path: string;
  name: string;
  size: number;
  lastModified: number;
  category: string;
  subType: string;
  extension: string;
  monthKey: string; // "2026-10"
  dayKey: string; // "2026-10-14"
}

export interface OrganizeMonthSummary {
  month: string;
  count: number;
  bytes: number;
  byCategory: Record<string, number>;
  bySubType: Record<string, number>;
}

export interface OrganizeSummary {
  totalFiles: number;
  totalBytes: number;
  months: OrganizeMonthSummary[];
}

/** One planned move from the SAF dry-run preview. */
export interface OrganizeMovePlan {
  sourcePath: string;
  destFolderRel: string;
  destName: string;
  size: number;
  category?: string;
  subType?: string;
  monthKey?: string;
  status: 'ok' | 'missing' | 'refused';
}

/** Result of executing a batch of organize moves. */
export interface OrganizeMoveResult {
  moved: number;
  skipped: number;
  failedBytes: number;
  errors: Array<{ sourcePath: string; error: string }>;
}

/** One diagnostic finding from the offline rule engine (spec §12). */
export interface DiagnosticFinding {
  id: string;
  title: string;
  measurement: string;
  trigger: string;
  explanation: string;
  nextAction: string;
  limitation: string;
  severity: 'info' | 'warn' | 'danger';
}
