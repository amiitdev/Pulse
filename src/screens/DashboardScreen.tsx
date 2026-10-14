import React, { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { ScreenContainer } from '../components/ScreenContainer';
import { MetricCard } from '../components/MetricCard';
import { CircularGauge } from '../components/CircularGauge';
import { StatusBadge } from '../components/StatusBadge';
import { TabBarIcon, IconName } from '../components/TabBarIcon';
import { useTheme } from '../theme/useTheme';
import { useNativeReading } from '../hooks/useNativeReading';
import { DeviceMonitor, getLocalDeviceInfo } from '../native/DeviceMonitor';
import type { RootTabParamList } from '../navigation/types';
import type {
  BatteryReading,
  CpuInfo,
  DiagnosticFinding,
  RamReading,
  StorageReading,
  ThermalReading,
} from '../native/types';
import { evaluate } from '../services/diagnosticEngine';
import { countSamples } from '../database/repository';
import { formatBytesShort } from '../utils/format';

type Nav = BottomTabNavigationProp<RootTabParamList>;

const SHORTCUTS: Array<{
  route: keyof RootTabParamList;
  label: string;
  icon: IconName;
}> = [
  { route: 'Ram', label: 'RAM', icon: 'memory' },
  { route: 'Battery', label: 'Battery', icon: 'battery' },
  { route: 'Storage', label: 'Storage', icon: 'storage' },
  { route: 'CpuThermal', label: 'CPU·Thermal', icon: 'cpu' },
  { route: 'AppInspector', label: 'Apps', icon: 'apps' },
  { route: 'FileExplorer', label: 'Files', icon: 'storage' },
  { route: 'History', label: 'History', icon: 'history' },
  { route: 'Settings', label: 'Settings', icon: 'settings' },
];

export function DashboardScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();

  const [device, setDevice] = useState(() => getLocalDeviceInfo());
  const [findings, setFindings] = useState<DiagnosticFinding[]>([]);
  const [sampleCount, setSampleCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    DeviceMonitor.getDeviceInfo().then(info => {
      if (!cancelled && info != null) {
        setDevice(info);
      }
    });
    countSamples().then(c => {
      if (!cancelled) setSampleCount(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const ram = useNativeReading<RamReading>(() => DeviceMonitor.getRamReading(), {
    refreshMs: 5000,
  });
  const battery = useNativeReading<BatteryReading>(
    () => DeviceMonitor.getBatteryReading(),
    { refreshMs: 5000 },
  );
  const storage = useNativeReading<StorageReading>(
    () => DeviceMonitor.getStorageReading(),
    { refreshMs: 15000 },
  );
  const thermal = useNativeReading<ThermalReading>(
    () => DeviceMonitor.getThermalReading(),
    { refreshMs: 30000 },
  );
  const cpu = useNativeReading<CpuInfo>(() => DeviceMonitor.getCpuInfo(), {
    refreshMs: 30000,
  });

  // Recompute diagnostics whenever a live reading lands.
  useEffect(() => {
    setFindings(
      evaluate({
        ram: ram.data,
        battery: battery.data,
        storage: storage.data,
        thermal: thermal.data,
      }),
    );
  }, [ram.data, battery.data, storage.data, thermal.data]);

  const ramPct =
    ram.data != null && ram.data.totalBytes > 0
      ? ram.data.usedBytes / ram.data.totalBytes
      : null;
  const batteryPct =
    battery.data?.percent != null ? battery.data.percent / 100 : null;
  const storagePct =
    storage.data != null && storage.data.totalBytes > 0
      ? storage.data.usedBytes / storage.data.totalBytes
      : null;

  const { width: windowWidth } = useWindowDimensions();
  const gaugeSize = Math.max(
    84,
    Math.min(132, Math.floor((windowWidth - 32 - 32 - 16) / 3)),
  );

  return (
    <ScreenContainer
      title="Pulse"
      subtitle={`${device.brand ?? ''} ${device.model ?? ''}`.trim() || 'Device'}
      right={
        <Pressable
          onPress={() => navigation.navigate('Settings')}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          style={({ pressed }) => [
            styles.headerBtn,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}>
          <TabBarIcon name="settings" color={theme.colors.textSecondary} size={20} />
        </Pressable>
      }>
      {/* ── Device identity ─────────────────────────────── */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.lg,
          },
        ]}>
        <View style={styles.rowBetween}>
          <View style={styles.deviceTextBlock}>
            <Text
              style={[
                styles.deviceName,
                theme.typography.heading,
                { color: theme.colors.textPrimary },
              ]}
              numberOfLines={1}>
              {device.model ?? 'Unknown model'}
            </Text>
            <Text
              style={[
                styles.deviceSub,
                theme.typography.caption,
                { color: theme.colors.textSecondary },
              ]}>
              {[device.brand, device.manufacturer]
                .filter((v, i, arr) => v != null && arr.indexOf(v) === i)
                .join(' · ') || 'Brand unavailable'}
            </Text>
          </View>
          <StatusBadge label="This device" tone="info" />
        </View>

        <View style={styles.chipRow}>
          <InfoChip
            label="Android"
            value={device.androidVersion ?? '—'}
            theme={theme}
          />
          <InfoChip
            label="API level"
            value={device.apiLevel != null ? String(device.apiLevel) : '—'}
            theme={theme}
          />
          <InfoChip
            label="ABI"
            value={device.abis?.[0] ?? cpu.data?.abis?.split(',')[0] ?? '—'}
            theme={theme}
          />
          <InfoChip
            label="Cores"
            value={cpu.data?.cores != null ? String(cpu.data.cores) : '—'}
            theme={theme}
          />
        </View>
      </View>

      {/* ── Live gauges ──────────────────────────────────── */}
      <View
        style={[
          styles.card,
          styles.gaugeRow,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.lg,
          },
        ]}>
        <CircularGauge
          size={gaugeSize}
          strokeWidth={Math.max(7, Math.round(gaugeSize / 14))}
          progress={ramPct}
          value={ramPct != null ? String(Math.round(ramPct * 100)) : '—'}
          unit={ramPct != null ? '%' : undefined}
          caption="RAM"
          color={theme.colors.accent}
          loading={ram.loading}
        />
        <CircularGauge
          size={gaugeSize}
          strokeWidth={Math.max(7, Math.round(gaugeSize / 14))}
          progress={batteryPct}
          value={batteryPct != null ? String(Math.round(batteryPct * 100)) : '—'}
          unit={batteryPct != null ? '%' : undefined}
          caption="Battery"
          color={theme.colors.ok}
          loading={battery.loading}
        />
        <CircularGauge
          size={gaugeSize}
          strokeWidth={Math.max(7, Math.round(gaugeSize / 14))}
          progress={storagePct}
          value={storagePct != null ? String(Math.round(storagePct * 100)) : '—'}
          unit={storagePct != null ? '%' : undefined}
          caption="Storage"
          color={theme.colors.info}
          loading={storage.loading}
        />
      </View>

      <Text
        style={[
          styles.section,
          theme.typography.caption,
          { color: theme.colors.textSecondary },
        ]}>
        {ram.data != null
          ? `Live via ActivityManager · ${sampleCount ?? '…'} history samples`
          : 'Live gauges connect to the Kotlin modules.'}
      </Text>

      {/* ── Detail metrics ──────────────────────────────── */}
      <View style={styles.grid}>
        <MetricCard
          label="RAM available"
          value={ram.data ? formatBytesShort(ram.data.availableBytes) : null}
          tone={ram.data?.lowMemory ? 'danger' : 'ok'}
          loading={ram.loading}
          unavailableNote="Native reading unavailable"
          updatedAt={ram.data?.timestamp ?? null}
        />
        <MetricCard
          label="Battery"
          value={
            battery.data?.percent != null
              ? `${battery.data.percent}%`
              : null
          }
          unit={battery.data?.status}
          tone={battery.data?.status === 'charging' ? 'ok' : 'neutral'}
          loading={battery.loading}
          unavailableNote="BatteryManager unavailable"
          updatedAt={battery.data?.timestamp ?? null}
        />
        <MetricCard
          label="Storage free"
          value={storage.data ? formatBytesShort(storage.data.freeBytes) : null}
          tone={
            storage.data && storage.data.freeBytes < 5 * 1024 ** 3
              ? 'danger'
              : 'info'
          }
          loading={storage.loading}
          unavailableNote="StatFs unavailable"
          updatedAt={storage.data?.timestamp ?? null}
        />
        <MetricCard
          label="Thermal"
          value={thermal.data?.status ?? null}
          tone={
            thermal.data?.status == null
              ? 'neutral'
              : ['none'].includes(thermal.data.status)
                ? 'ok'
                : ['light', 'moderate'].includes(thermal.data.status)
                  ? 'warn'
                  : 'danger'
          }
          loading={thermal.loading}
          unavailableNote="PowerManager thermal API"
          updatedAt={thermal.data?.timestamp ?? null}
        />
      </View>

      {/* ── Diagnostics ──────────────────────────────────── */}
      <Text
        style={[
          styles.section,
          theme.typography.caption,
          { color: theme.colors.textSecondary },
        ]}>
        Diagnostics
      </Text>
      {findings.length === 0 ? (
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
            },
          ]}>
          <Text
            style={[
              theme.typography.body,
              { color: theme.colors.textSecondary },
            ]}>
            No issues detected from the current readings. The offline rule
            engine checks storage headroom, thermal status, battery drain
            trends and memory pressure — every finding shows its measurement,
            trigger and limitations.
          </Text>
        </View>
      ) : (
        findings.map(f => (
          <Pressable
            key={f.id}
            onPress={() => navigation.navigate('History')}
            accessibilityRole="button"
            accessibilityLabel={f.title}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor:
                  f.severity === 'danger'
                    ? theme.colors.danger
                    : f.severity === 'warn'
                      ? theme.colors.warn
                      : theme.colors.border,
                borderRadius: theme.radius.md,
                opacity: pressed ? 0.85 : 1,
              },
            ]}>
            <View style={styles.rowBetween}>
            <Text
              style={[
                styles.findingTitle,
                theme.typography.bodyBold,
                { color: theme.colors.textPrimary },
              ]}>
              {f.title}
            </Text>
              <StatusBadge
                label={f.severity}
                tone={
                  f.severity === 'danger'
                    ? 'danger'
                    : f.severity === 'warn'
                      ? 'warn'
                      : 'info'
                }
              />
            </View>
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.accent },
              ]}>
              {f.measurement}
            </Text>
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.textSecondary },
              ]}>
              {f.explanation}
            </Text>
            <Text
              style={[
                theme.typography.micro,
                { color: theme.colors.textTertiary },
              ]}>
              Next: {f.nextAction}
              {'\n'}
              Limit: {f.limitation}
            </Text>
          </Pressable>
        ))
      )}

      {/* ── Session status ──────────────────────────────── */}
      <MetricCard
        label="Monitoring session"
        value={sampleCount != null ? `${sampleCount} samples stored` : null}
        tone="neutral"
        caption="Historical sampler records every minute while the app is open. Gaming session mode is on CPU·Thermal."
        onPress={() => navigation.navigate('CpuThermal')}
        compact
      />

      {/* ── Shortcuts ───────────────────────────────────── */}
      <Text
        style={[
          styles.section,
          theme.typography.caption,
          { color: theme.colors.textSecondary },
        ]}>
        Explore
      </Text>
      <View style={styles.shortcutGrid}>
        {SHORTCUTS.map(s => (
          <Pressable
            key={s.route}
            onPress={() => navigation.navigate(s.route)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${s.label}`}
            style={({ pressed }) => [
              styles.shortcut,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}>
            <TabBarIcon name={s.icon} color={theme.colors.accent} size={22} />
            <Text
              style={[styles.shortcutLabel, { color: theme.colors.textPrimary }]}
              numberOfLines={1}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScreenContainer>
  );
}

function InfoChip({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: theme.colors.surfaceRaised,
          borderColor: theme.colors.border,
        },
      ]}>
      <Text style={[styles.chipLabel, { color: theme.colors.textTertiary }]}>
        {label}
      </Text>
      <Text style={[styles.chipValue, { color: theme.colors.textPrimary }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 10,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  deviceName: {},
  deviceTextBlock: {
    flexShrink: 1,
  },
  deviceSub: {
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 78,
  },
  chipLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  gaugeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 20,
  },
  section: {
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  findingTitle: {
    flexShrink: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  shortcutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  shortcut: {
    width: 104,
    minHeight: 76,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  shortcutLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
