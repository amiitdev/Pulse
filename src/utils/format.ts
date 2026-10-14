/**
 * Unit-safe formatting helpers.
 * Every metric shown in the UI goes through these so units stay consistent
 * across screens, history, and exports (spec §14 "consistent units").
 */

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

/**
 * Format a byte count with a human unit.
 * Definition: used = total - available (documented in RamScreen, spec §6).
 */
export function formatBytes(bytes: number | null | undefined): {
  value: string;
  unit: string;
} {
  if (bytes == null || !isFinite(bytes) || bytes < 0) {
    return { value: '—', unit: '' };
  }
  if (bytes >= GB) {
    return { value: trim(bytes / GB), unit: 'GB' };
  }
  if (bytes >= MB) {
    return { value: trim(bytes / MB), unit: 'MB' };
  }
  if (bytes >= KB) {
    return { value: trim(bytes / KB), unit: 'KB' };
  }
  return { value: String(Math.round(bytes)), unit: 'B' };
}

export function formatBytesShort(bytes: number | null | undefined): string {
  const { value, unit } = formatBytes(bytes);
  return unit ? `${value} ${unit}` : value;
}

function trim(n: number): string {
  // One decimal, but drop ".0" for whole numbers (e.g. 8.0 GB -> 8 GB)
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** 0..1 or 0..100 -> "73%". Accepts either; pass `alreadyPercent`. */
export function formatPercent(
  value: number | null | undefined,
  alreadyPercent = false,
): string {
  if (value == null || !isFinite(value)) {
    return '—';
  }
  const pct = alreadyPercent ? value : value * 100;
  return `${Math.round(pct)}%`;
}

/**
 * Android battery temperature is exposed in tenths of a degree Celsius
 * by BatteryManager.EXTRA_TEMPERATURE. Accepts °C directly too.
 */
export function formatTemperatureC(tenthsOfC: number | null | undefined): string {
  if (tenthsOfC == null || !isFinite(tenthsOfC)) {
    return '—';
  }
  const c = Math.abs(tenthsOfC) > 200 ? tenthsOfC / 10 : tenthsOfC;
  return `${Math.round(c)}°C`;
}

/** Millivolts -> volts, e.g. 4123 -> "4.12 V". */
export function formatVoltage(mv: number | null | undefined): string {
  if (mv == null || !isFinite(mv)) {
    return '—';
  }
  return `${(mv / 1000).toFixed(2)} V`;
}

/** Milliseconds duration -> "1h 24m" / "5m 12s" / "42s". */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !isFinite(ms) || ms < 0) {
    return '—';
  }
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  if (m > 0) {
    return `${m}m ${s}s`;
  }
  return `${s}s`;
}

/** Epoch ms -> local time "14:03:21" (charts, last-updated labels). */
export function formatClock(epochMs: number | null | undefined): string {
  if (epochMs == null || !isFinite(epochMs)) {
    return '—';
  }
  const d = new Date(epochMs);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Epoch ms -> "14 Oct, 14:03" for history lists. */
export function formatDateTime(epochMs: number | null | undefined): string {
  if (epochMs == null || !isFinite(epochMs)) {
    return '—';
  }
  const d = new Date(epochMs);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()} ${months[d.getMonth()]}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Clamp helper used by gauges/charts. */
export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
