import { evaluate } from '../src/services/diagnosticEngine';
import type {
  BatteryReading,
  RamReading,
  StorageReading,
  ThermalReading,
} from '../src/native/types';

const now = 1_700_000_000_000;

function ram(used: number, total: number, low = false): RamReading {
  return {
    totalBytes: total,
    availableBytes: total - used,
    usedBytes: used,
    lowMemory: low,
    timestamp: now,
  };
}

function storage(used: number, total: number): StorageReading {
  return {
    totalBytes: total,
    freeBytes: total - used,
    usedBytes: used,
    timestamp: now,
  };
}

function battery(pct: number, ts = now): BatteryReading {
  return {
    percent: pct,
    status: 'discharging',
    charger: null,
    temperatureC: null,
    voltageMv: null,
    health: null,
    timestamp: ts,
  };
}

function thermal(status: ThermalReading['status']): ThermalReading {
  return { status, thermalHeadroom: null, timestamp: now };
}

describe('diagnosticEngine', () => {
  it('flags critical storage when free < 5%', () => {
    const findings = evaluate({
      ram: null,
      battery: null,
      storage: storage(980, 1000),
      thermal: null,
    });
    const critical = findings.find(x => x.id === 'storage-critical');
    expect(critical).toBeDefined();
    expect(critical!.severity).toBe('danger');
    expect(critical!.measurement).toContain('% free');
    expect(critical!.nextAction.length).toBeGreaterThan(10);
    expect(critical!.limitation.length).toBeGreaterThan(10);
  });

  it('does not flag storage when plenty free', () => {
    const findings = evaluate({
      ram: null,
      battery: null,
      storage: storage(100, 1000),
      thermal: null,
    });
    expect(findings.find(f => f.id.startsWith('storage'))).toBeUndefined();
  });

  it('flags severe thermal status', () => {
    const findings = evaluate({
      ram: null,
      battery: null,
      storage: null,
      thermal: thermal('severe'),
    });
    expect(findings.some(f => f.id === 'thermal-high')).toBe(true);
  });

  it('ignores mild thermal status', () => {
    const findings = evaluate({
      ram: null,
      battery: null,
      storage: null,
      thermal: thermal('light'),
    });
    expect(findings.find(f => f.id === 'thermal-high')).toBeUndefined();
  });

  it('flags low memory when lowMemory=true', () => {
    const findings = evaluate({
      ram: ram(950, 1000, true),
      battery: null,
      storage: null,
      thermal: null,
    });
    expect(findings.some(f => f.id === 'low-memory')).toBe(true);
  });

  it('reports battery drain only with enough drop and time', () => {
    const findings = evaluate({
      ram: null,
      battery: battery(80, now + 10 * 60_000),
      storage: null,
      thermal: null,
      batteryPrev: { pct: 95, ts: now },
    });
    expect(findings.some(f => f.id === 'battery-drain')).toBe(true);
  });

  it('does not flag drain for tiny changes', () => {
    const findings = evaluate({
      ram: null,
      battery: battery(94, now + 10 * 60_000),
      storage: null,
      thermal: null,
      batteryPrev: { pct: 95, ts: now },
    });
    expect(findings.find(f => f.id === 'battery-drain')).toBeUndefined();
  });

  it('returns empty for healthy readings', () => {
    const findings = evaluate({
      ram: ram(400, 8000),
      battery: battery(80),
      storage: storage(200, 1000),
      thermal: thermal('none'),
    });
    expect(findings).toHaveLength(0);
  });
});
