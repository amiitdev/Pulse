/** SQLite schema contract shared by Kotlin + TS (spec §11). */

export const SAMPLES_TABLE = 'samples';

export interface SampleColumns {
  id: number;
  ts: number;
  ram_total: number | null;
  ram_avail: number | null;
  ram_used: number | null;
  low_memory: number | null;
  battery_pct: number | null;
  battery_temp: number | null;
  battery_voltage: number | null;
  battery_status: string | null;
  battery_health: string | null;
  storage_total: number | null;
  storage_used: number | null;
  storage_free: number | null;
  thermal_status: string | null;
  thermal_headroom: number | null;
}

export const RANGES = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
} as const;

export type RangeKey = keyof typeof RANGES;
