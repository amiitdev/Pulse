/**
 * Offline rule-based diagnostic engine (spec §12).
 * Every finding shows: measurement, trigger, explanation, next action,
 * limitation. No fake AI scores, no invented causes.
 */

import type {
  BatteryReading,
  DiagnosticFinding,
  RamReading,
  StorageReading,
  ThermalReading,
} from '../native/types';

export interface DiagnosticInput {
  ram: RamReading | null;
  battery: BatteryReading | null;
  storage: StorageReading | null;
  thermal: ThermalReading | null;
  /** Recent storage samples for trend, oldest→newest. */
  storageHistory?: Array<{ ts: number; usedBytes: number }>;
  /** Previous battery percent for drain estimate. */
  batteryPrev?: { pct: number; ts: number } | null;
}

export function evaluate(input: DiagnosticInput): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = [];
  const { ram, battery, storage, thermal } = input;

  // ── Storage low ────────────────────────────────────────────────
  if (storage && storage.totalBytes > 0) {
    const freePct = (storage.freeBytes / storage.totalBytes) * 100;
    if (freePct < 5) {
      findings.push({
        id: 'storage-critical',
        title: 'Storage critically low',
        measurement: `${freePct.toFixed(1)}% free (${fmt(storage.freeBytes)})`,
        trigger: 'free space < 5% of total',
        explanation:
          'Below 5% free, Android struggles to write app data and may close apps unexpectedly.',
        nextAction:
          'Open Storage Explorer → Large files, review downloads and videos you no longer need.',
        limitation:
          'Pulse never deletes files itself — you confirm every deletion.',
        severity: 'danger',
      });
    } else if (freePct < 15) {
      findings.push({
        id: 'storage-low',
        title: 'Storage getting low',
        measurement: `${freePct.toFixed(1)}% free (${fmt(storage.freeBytes)})`,
        trigger: 'free space < 15% of total',
        explanation:
          'Plenty of apps and the OS need headroom for caches and updates.',
        nextAction:
          'Check large files in Storage Explorer before it becomes critical.',
        limitation: 'Exact free-space needs vary by manufacturer.',
        severity: 'warn',
      });
    }

    // ── Storage growth trend ─────────────────────────────────────
    const hist = input.storageHistory ?? [];
    if (hist.length >= 3) {
      const first = hist[0];
      const last = hist[hist.length - 1];
      const growth = last.usedBytes - first.usedBytes;
      const hours = (last.ts - first.ts) / 3_600_000;
      if (hours >= 1 && growth > 512 * 1024 * 1024) {
        findings.push({
          id: 'storage-growth',
          title: 'Storage consumption rising',
          measurement: `+${fmt(growth)} over ${hours.toFixed(1)}h`,
          trigger: 'used storage grew > 512 MB within the recorded window',
          explanation:
            'Something is writing a lot of data — often downloads, offline maps, or app caches.',
          nextAction:
            'Sort Storage Explorer by size and inspect the newest large files.',
          limitation:
            'Pulse cannot attribute growth to a specific app without per-app write telemetry, which Android does not expose.',
          severity: 'info',
        });
      }
    }
  }

  // ── Thermal ────────────────────────────────────────────────────
  if (thermal?.status != null) {
    const severe = ['severe', 'critical', 'emergency', 'shutdown'];
    if (severe.includes(thermal.status)) {
      findings.push({
        id: 'thermal-high',
        title: 'Device reporting thermal stress',
        measurement: `thermal status: ${thermal.status}`,
        trigger: `PowerManager thermal status is "${thermal.status}"`,
        explanation:
          'The OS is throttling performance to protect hardware. Expect slower apps and possible charging limits.',
        nextAction:
          'Stop sustained workloads (games, camera, hotspot), remove the case, let the phone cool.',
        limitation:
          'This is the OS thermal zone status, not a skin-temperature reading — exact °C is usually unavailable to apps.',
        severity: thermal.status === 'severe' ? 'warn' : 'danger',
      });
    }
  }

  // ── Battery drain ──────────────────────────────────────────────
  if (
    battery?.percent != null &&
    input.batteryPrev?.pct != null &&
    battery.timestamp > input.batteryPrev.ts
  ) {
    const drop = input.batteryPrev.pct - battery.percent;
    const minutes = (battery.timestamp - input.batteryPrev.ts) / 60_000;
    if (minutes >= 5 && drop >= 5) {
      const perHour = (drop / minutes) * 60;
      findings.push({
        id: 'battery-drain',
        title: 'Faster battery drain observed',
        measurement: `−${drop}% in ${minutes.toFixed(0)}min (~${perHour.toFixed(0)}%/h)`,
        trigger: '≥5% drop over ≥5 minutes of recorded samples',
        explanation:
          'Pulse reports the observed percentage change only — it cannot name the responsible app without system battery-stats access.',
        nextAction:
          'Check Android Settings → Battery for the system’s own per-app breakdown.',
        limitation:
          'This is an observation, not a diagnosis. Screen-on time and signal strength can fully explain the drop.',
        severity: perHour >= 20 ? 'warn' : 'info',
      });
    }
  }

  // ── Low memory ─────────────────────────────────────────────────
  if (ram) {
    const usedPct = (ram.usedBytes / ram.totalBytes) * 100;
    if (ram.lowMemory) {
      findings.push({
        id: 'low-memory',
        title: 'System under memory pressure',
        measurement: `lowMemory=true, ${usedPct.toFixed(0)}% used`,
        trigger: 'ActivityManager.MemoryInfo.lowMemory is true',
        explanation:
          'Android is actively reclaiming memory — background apps may be closing and UI can stutter.',
        nextAction:
          'Close heavy apps from the App Inspector (kill background) or restart the phone.',
        limitation:
          'High usage alone is normal on Linux; only lowMemory indicates real pressure.',
        severity: 'warn',
      });
    } else if (usedPct >= 92) {
      findings.push({
        id: 'ram-high',
        title: 'High memory utilization',
        measurement: `${usedPct.toFixed(0)}% used (${fmt(ram.usedBytes)} of ${fmt(ram.totalBytes)})`,
        trigger: 'used / total ≥ 92% while lowMemory is false',
        explanation:
          'Busy memory is normal — the kernel prefers using RAM over leaving it idle. Without lowMemory this is usually fine.',
        nextAction:
          'No action needed unless apps feel slow. Check RAM Monitor for the trend.',
        limitation:
          'This is system-wide. Per-app RAM is not available to normal apps.',
        severity: 'info',
      });
    }
  }

  return findings;
}

function fmt(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${Math.round(gb * 10) / 10} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}
