/** User preferences persisted with AsyncStorage (spec §7, §17). */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PulseSettings {
  /** Historical sampling interval in ms. */
  samplingIntervalMs: number;
  /** Keep samples newer than this (ms). 0 = keep forever. */
  retentionMs: number;
  /** 'dark' | 'light' — dark is the spec default. */
  theme: 'dark' | 'light';
}

export const DEFAULT_SETTINGS: PulseSettings = {
  samplingIntervalMs: 60_000,
  retentionMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  theme: 'dark',
};

const KEY = 'pulse.settings.v1';

export const SAMPLING_OPTIONS = [
  { label: '30 seconds', value: 30_000 },
  { label: '1 minute', value: 60_000 },
  { label: '5 minutes', value: 300_000 },
  { label: '15 minutes', value: 900_000 },
] as const;

export const RETENTION_OPTIONS = [
  { label: '7 days', value: 7 * 24 * 60 * 60 * 1000 },
  { label: '30 days', value: 30 * 24 * 60 * 60 * 1000 },
  { label: '90 days', value: 90 * 24 * 60 * 60 * 1000 },
  { label: 'Keep forever', value: 0 },
] as const;

export async function loadSettings(): Promise<PulseSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<PulseSettings>;
    return {
      samplingIntervalMs:
        typeof parsed.samplingIntervalMs === 'number'
          ? parsed.samplingIntervalMs
          : DEFAULT_SETTINGS.samplingIntervalMs,
      retentionMs:
        typeof parsed.retentionMs === 'number'
          ? parsed.retentionMs
          : DEFAULT_SETTINGS.retentionMs,
      theme: parsed.theme === 'light' ? 'light' : 'dark',
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(s: PulseSettings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
}
