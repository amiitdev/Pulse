/**
 * Gaming / heavy-use session tracker (spec §13).
 * Faster in-session sampling overlaid on the global 1-min sampler.
 * Session rows reuse the same SQLite table; we mark start/end and
 * query the window for the report.
 */

import { AppState, NativeEventSubscription } from 'react-native';
import { DeviceMonitor } from '../native/DeviceMonitor';
import { insertSample } from '../database/repository';
import { buildSample } from './samplingService';

export interface SessionState {
  active: boolean;
  startedAt: number | null;
  stoppedAt: number | null;
  sampleCount: number;
  firstPct: number | null;
  lastPct: number | null;
  firstRamPct: number | null;
  lastRamPct: number | null;
}

const IDLE: SessionState = {
  active: false,
  startedAt: null,
  stoppedAt: null,
  sampleCount: 0,
  firstPct: null,
  lastPct: null,
  firstRamPct: null,
  lastRamPct: null,
};

class SessionManager {
  state: SessionState = { ...IDLE };
  private timer: ReturnType<typeof setInterval> | null = null;
  private sub: NativeEventSubscription | null = null;
  private inFlight = false;
  onUpdate: (() => void) | null = null;

  start(intervalMs = 5_000): void {
    if (this.state.active) return;
    this.state = {
      active: true,
      startedAt: Date.now(),
      stoppedAt: null,
      sampleCount: 0,
      firstPct: null,
      lastPct: null,
      firstRamPct: null,
      lastRamPct: null,
    };
    this.timer = setInterval(() => this.tick(), intervalMs);
    this.sub = AppState.addEventListener('change', s => {
      if (s !== 'active' && this.timer != null) {
        clearInterval(this.timer);
        this.timer = null;
      } else if (s === 'active' && this.state.active && this.timer == null) {
        this.timer = setInterval(() => this.tick(), intervalMs);
      }
    });
    this.tick();
    this.onUpdate?.();
  }

  stop(): void {
    if (!this.state.active) return;
    if (this.timer != null) clearInterval(this.timer);
    this.timer = null;
    this.sub?.remove();
    this.sub = null;
    this.state = { ...this.state, active: false, stoppedAt: Date.now() };
    this.onUpdate?.();
  }

  durationMs(): number {
    if (this.state.startedAt == null) return 0;
    const end = this.state.stoppedAt ?? Date.now();
    return end - this.state.startedAt;
  }

  private async tick(): Promise<void> {
    if (this.inFlight || !this.state.active) return;
    this.inFlight = true;
    try {
      const [ram, battery, storage, thermal] = await Promise.all([
        DeviceMonitor.getRamReading(),
        DeviceMonitor.getBatteryReading(),
        DeviceMonitor.getStorageReading(),
        DeviceMonitor.getThermalReading(),
      ]);
      if (!ram || !battery || !storage) return;

      const sample = buildSample(ram, battery, storage, thermal, Date.now());
      await insertSample(sample);

      const batPct = battery.percent;
      const ramPct =
        ram.totalBytes > 0 ? (ram.usedBytes / ram.totalBytes) * 100 : null;

      this.state = {
        ...this.state,
        sampleCount: this.state.sampleCount + 1,
        firstPct: this.state.firstPct ?? batPct,
        lastPct: batPct ?? this.state.lastPct,
        firstRamPct: this.state.firstRamPct ?? ramPct,
        lastRamPct: ramPct ?? this.state.lastRamPct,
      };
      this.onUpdate?.();
    } catch {
      // Sample failures are non-fatal; charts tolerate gaps.
    } finally {
      this.inFlight = false;
    }
  }
}

export const sessionManager = new SessionManager();
