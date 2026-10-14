/**
 * Foreground historical sampling (spec §11, §16).
 *
 * Periodically reads RAM/battery/storage/thermal and writes one SQLite row.
 * Pauses automatically when the app is backgrounded (Android suspends the
 * JS timer anyway; we also stop explicitly to avoid catch-up bursts).
 * Background WorkManager capture is Phase 6.
 */

import { AppState, AppStateStatus, NativeEventSubscription } from 'react-native';
import { DeviceMonitor } from '../native/DeviceMonitor';
import { insertSample } from '../database/repository';
import type { BatteryReading, RamReading, StorageReading, ThermalReading } from '../native/types';

export type SamplingState = 'stopped' | 'running' | 'paused';

const DEFAULT_INTERVAL_MS = 60_000; // 1 sample / minute — battery-friendly

class SamplingService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private appStateSub: NativeEventSubscription | null = null;
  private inFlight = false;
  private intervalMs = DEFAULT_INTERVAL_MS;

  state: SamplingState = 'stopped';
  lastError: string | null = null;
  lastSampleAt: number | null = null;
  sampleCountSession = 0;
  /** Notified after each successful insert / state change. */
  onUpdate: (() => void) | null = null;

  start(intervalMs: number = DEFAULT_INTERVAL_MS): void {
    if (this.timer != null) {
      return;
    }
    this.intervalMs = intervalMs;
    this.state = 'running';
    this.lastError = null;
    this.timer = setInterval(() => this.tick(), this.intervalMs);
    this.appStateSub = AppState.addEventListener('change', this.onAppState);
    this.tick(); // immediate first sample
    this.onUpdate?.();
  }

  stop(): void {
    if (this.timer != null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.appStateSub?.remove();
    this.appStateSub = null;
    this.state = 'stopped';
    this.onUpdate?.();
  }

  /** Restart with a new interval (Settings change). */
  restart(intervalMs?: number): void {
    const ms = intervalMs ?? this.intervalMs;
    this.stop();
    this.start(ms);
  }

  private onAppState = (status: AppStateStatus): void => {
    if (status === 'active' && this.state === 'paused') {
      this.state = 'running';
      this.timer = setInterval(() => this.tick(), this.intervalMs);
      this.onUpdate?.();
    } else if (
      (status === 'background' || status === 'inactive') &&
      this.state === 'running'
    ) {
      if (this.timer != null) {
        clearInterval(this.timer);
        this.timer = null;
      }
      this.state = 'paused';
      this.onUpdate?.();
    }
  };

  private async tick(): Promise<void> {
    if (this.inFlight) {
      return;
    }
    this.inFlight = true;
    try {
      const [ram, battery, storage, thermal] = await Promise.all([
        DeviceMonitor.getRamReading(),
        DeviceMonitor.getBatteryReading(),
        DeviceMonitor.getStorageReading(),
        DeviceMonitor.getThermalReading(),
      ]);

      if (ram == null || battery == null || storage == null) {
        // Native missing — skip quietly; screens already show unavailable.
        return;
      }

      await insertSample(buildSample(ram, battery, storage, thermal, Date.now()));
      this.lastSampleAt = Date.now();
      this.sampleCountSession += 1;
      this.lastError = null;
      this.onUpdate?.();
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e);
      this.onUpdate?.();
    } finally {
      this.inFlight = false;
    }
  }
}

export function buildSample(
  ram: RamReading,
  battery: BatteryReading,
  storage: StorageReading,
  thermal: ThermalReading | null,
  ts: number,
) {
  return {
    ts,
    ramTotal: ram.totalBytes,
    ramAvail: ram.availableBytes,
    ramUsed: ram.usedBytes,
    lowMemory: ram.lowMemory,
    batteryPct: battery.percent,
    batteryTemp: battery.temperatureC,
    batteryVoltage: battery.voltageMv,
    batteryStatus: battery.status,
    batteryHealth: battery.health,
    storageTotal: storage.totalBytes,
    storageUsed: storage.usedBytes,
    storageFree: storage.freeBytes,
    thermalStatus: thermal?.status ?? null,
    thermalHeadroom: thermal?.thermalHeadroom ?? null,
  };
}

export const samplingService = new SamplingService();
