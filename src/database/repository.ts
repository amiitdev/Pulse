/** Thin typed wrappers over the native SQLite module (spec §11). */

import { DeviceMonitor } from '../native/DeviceMonitor';
import type { ChartRow, DailySummary, SampleInsert } from '../native/types';

export async function initDatabase(): Promise<boolean> {
  return (await DeviceMonitor.dbInit()) === true;
}

export async function insertSample(sample: SampleInsert): Promise<number | null> {
  return DeviceMonitor.dbInsertSample(sample);
}

export async function queryRange(
  fromTs: number,
  toTs: number,
  maxPoints = 120,
): Promise<ChartRow[] | null> {
  return DeviceMonitor.dbQueryRange(fromTs, toTs, maxPoints);
}

export async function queryDaily(
  fromTs: number,
  toTs: number,
): Promise<DailySummary[] | null> {
  return DeviceMonitor.dbQueryDaily(fromTs, toTs);
}

export async function countSamples(): Promise<number | null> {
  return DeviceMonitor.dbCount();
}

export async function clearSamples(): Promise<number | null> {
  return DeviceMonitor.dbClear();
}
