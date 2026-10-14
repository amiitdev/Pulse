/**
 * TS facade over the Kotlin native modules.
 *
 * Phase 3–5: the Kotlin side is linked. Every getter still resolves to
 * `null` on failure (unsupported property / missing module) so screens
 * render an explicit unavailable state — never a fabricated number.
 */

import { NativeModules, Platform } from 'react-native';
import type {
  AppPermissionSummary,
  AppUsageRow,
  BackgroundAppRow,
  BatteryReading,
  ChartRow,
  CpuInfo,
  DailySummary,
  DeviceInfo,
  FileCategoryTotals,
  FileRow,
  OrganizeMovePlan,
  OrganizeMoveResult,
  OrganizeSummary,
  OrganizedFile,
  RamReading,
  SampleInsert,
  StorageReading,
  ThermalReading,
} from './types';

interface PulseNativeModule {
  getDeviceInfo(): Promise<DeviceInfo | null>;
  getRamReading(): Promise<RamReading | null>;
  getBatteryReading(): Promise<BatteryReading | null>;
  getStorageReading(): Promise<StorageReading | null>;
  getThermalReading(): Promise<ThermalReading | null>;

  dbInit(): Promise<boolean>;
  dbInsertSample(sample: SampleInsert): Promise<number>;
  dbQueryRange(fromTs: number, toTs: number, maxPoints: number): Promise<ChartRow[]>;
  dbQueryDaily(fromTs: number, toTs: number): Promise<DailySummary[]>;
  dbCount(): Promise<number>;
  dbClear(): Promise<number>;

  getAppUsage(): Promise<AppUsageRow[] | null>;
  getBackgroundApps(limit: number): Promise<BackgroundAppRow[] | null>;
  getTopApps(sortBy: string, limit: number): Promise<AppUsageRow[] | null>;
  getAppPermissionSummary(): Promise<AppPermissionSummary | null>;

  killBackgroundApp(packageName: string): Promise<boolean>;
  clearOwnCache(): Promise<number>;
  getOwnCacheBytes(): Promise<number>;
  openAppStorageSettings(packageName: string): Promise<boolean>;

  getCpuInfo(): Promise<CpuInfo | null>;
  scanFiles(category: string | null, limit: number): Promise<FileRow[] | null>;
  getFileCategoryTotals(): Promise<FileCategoryTotals | null>;
  deleteFile(uri: string, id: number): Promise<boolean>;

  organizeFiles(limit: number): Promise<OrganizedFile[] | null>;
  organizeSummary(limit: number): Promise<OrganizeSummary | null>;
  deleteOrganizedFile(path: string): Promise<boolean>;

  pickOrganizeFolder(): Promise<string | null>;
  planOrganizeMoves(treeUri: string, paths: string[]): Promise<OrganizeMovePlan[] | null>;
  executeOrganizeMoves(treeUri: string, moves: OrganizeMovePlan[]): Promise<OrganizeMoveResult | null>;
}

const nativeModule = NativeModules.PulseDeviceMonitor as
  | PulseNativeModule
  | undefined;

async function callOrNull<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!nativeModule) {
    return null;
  }
  try {
    return await fn();
  } catch {
    // Unsupported property / transient binder failure -> honest null.
    return null;
  }
}

export const DeviceMonitor = {
  /** True once the Kotlin module is linked. */
  isNativeAvailable(): boolean {
    return nativeModule != null;
  },

  getDeviceInfo(): Promise<DeviceInfo | null> {
    return callOrNull(() => nativeModule!.getDeviceInfo());
  },

  getRamReading(): Promise<RamReading | null> {
    return callOrNull(() => nativeModule!.getRamReading());
  },

  getBatteryReading(): Promise<BatteryReading | null> {
    return callOrNull(() => nativeModule!.getBatteryReading());
  },

  getStorageReading(): Promise<StorageReading | null> {
    return callOrNull(() => nativeModule!.getStorageReading());
  },

  getThermalReading(): Promise<ThermalReading | null> {
    return callOrNull(() => nativeModule!.getThermalReading());
  },

  dbInit(): Promise<boolean | null> {
    return callOrNull(() => nativeModule!.dbInit());
  },

  dbInsertSample(sample: SampleInsert): Promise<number | null> {
    return callOrNull(() => nativeModule!.dbInsertSample(sample));
  },

  dbQueryRange(
    fromTs: number,
    toTs: number,
    maxPoints = 120,
  ): Promise<ChartRow[] | null> {
    return callOrNull(() => nativeModule!.dbQueryRange(fromTs, toTs, maxPoints));
  },

  dbQueryDaily(fromTs: number, toTs: number): Promise<DailySummary[] | null> {
    return callOrNull(() => nativeModule!.dbQueryDaily(fromTs, toTs));
  },

  dbCount(): Promise<number | null> {
    return callOrNull(() => nativeModule!.dbCount());
  },

  dbClear(): Promise<number | null> {
    return callOrNull(() => nativeModule!.dbClear());
  },

  getAppUsage(): Promise<AppUsageRow[] | null> {
    return callOrNull(() => nativeModule!.getAppUsage());
  },

  getBackgroundApps(limit = 40): Promise<BackgroundAppRow[] | null> {
    return callOrNull(() => nativeModule!.getBackgroundApps(limit));
  },

  getTopApps(
    sortBy: 'storage' | 'usage' = 'storage',
    limit = 15,
  ): Promise<AppUsageRow[] | null> {
    return callOrNull(() => nativeModule!.getTopApps(sortBy, limit));
  },

  getAppPermissionSummary(): Promise<AppPermissionSummary | null> {
    return callOrNull(() => nativeModule!.getAppPermissionSummary());
  },

  killBackgroundApp(packageName: string): Promise<boolean | null> {
    return callOrNull(() => nativeModule!.killBackgroundApp(packageName));
  },

  clearOwnCache(): Promise<number | null> {
    return callOrNull(() => nativeModule!.clearOwnCache());
  },

  getOwnCacheBytes(): Promise<number | null> {
    return callOrNull(() => nativeModule!.getOwnCacheBytes());
  },

  openAppStorageSettings(packageName: string): Promise<boolean | null> {
    return callOrNull(() => nativeModule!.openAppStorageSettings(packageName));
  },

  getCpuInfo(): Promise<CpuInfo | null> {
    return callOrNull(() => nativeModule!.getCpuInfo());
  },

  scanFiles(
    category: string | null,
    limit = 200,
  ): Promise<FileRow[] | null> {
    return callOrNull(() => nativeModule!.scanFiles(category, limit));
  },

  getFileCategoryTotals(): Promise<FileCategoryTotals | null> {
    return callOrNull(() => nativeModule!.getFileCategoryTotals());
  },

  deleteFile(uri: string, id: number): Promise<boolean | null> {
    return callOrNull(() => nativeModule!.deleteFile(uri, id));
  },

  organizeFiles(limit = 3000): Promise<OrganizedFile[] | null> {
    return callOrNull(() => nativeModule!.organizeFiles(limit));
  },

  organizeSummary(limit = 3000): Promise<OrganizeSummary | null> {
    return callOrNull(() => nativeModule!.organizeSummary(limit));
  },

  deleteOrganizedFile(path: string): Promise<boolean | null> {
    return callOrNull(() => nativeModule!.deleteOrganizedFile(path));
  },

  pickOrganizeFolder(): Promise<string | null> {
    return callOrNull(() => nativeModule!.pickOrganizeFolder());
  },

  planOrganizeMoves(
    treeUri: string,
    paths: string[],
  ): Promise<OrganizeMovePlan[] | null> {
    return callOrNull(() => nativeModule!.planOrganizeMoves(treeUri, paths));
  },

  executeOrganizeMoves(
    treeUri: string,
    moves: OrganizeMovePlan[],
  ): Promise<OrganizeMoveResult | null> {
    return callOrNull(() => nativeModule!.executeOrganizeMoves(treeUri, moves));
  },
};

/**
 * Device identity available from React Native itself (Platform constants).
 * Used as a fallback; the native module supplies the authoritative values.
 */
export function getLocalDeviceInfo(): DeviceInfo {
  const constants =
    (Platform.constants as Record<string, unknown> | undefined) ?? {};
  const apiLevel =
    typeof Platform.Version === 'number' ? Platform.Version : null;

  const str = (v: unknown): string | null =>
    typeof v === 'string' && v.length > 0 ? v : null;

  return {
    brand: str(constants.Brand),
    model: str(constants.Model),
    manufacturer: str(constants.Manufacturer),
    androidVersion: str(constants.Version) ?? str(constants.Release),
    apiLevel,
    abis: Array.isArray(constants.SupportedABIs)
      ? (constants.SupportedABIs as string[])
      : null,
    cpuCores: null, // exposed by Kotlin module (Runtime.availableProcessors)
    timestamp: Date.now(),
  };
}

export type {
  DeviceInfo,
  RamReading,
  BatteryReading,
  StorageReading,
  ThermalReading,
  SampleInsert,
  ChartRow,
  DailySummary,
  AppUsageRow,
  BackgroundAppRow,
  AppPermissionSummary,
  CpuInfo,
  FileRow,
  FileCategoryTotals,
  OrganizedFile,
  OrganizeSummary,
  OrganizeMovePlan,
  OrganizeMoveResult,
};
