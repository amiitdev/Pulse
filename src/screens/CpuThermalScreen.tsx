import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../components/ScreenContainer';
import { MetricCard } from '../components/MetricCard';
import { LineChart } from '../components/LineChart';
import { StatusBadge } from '../components/StatusBadge';
import { useTheme } from '../theme/useTheme';
import { useNativeReading } from '../hooks/useNativeReading';
import { DeviceMonitor } from '../native/DeviceMonitor';
import type { CpuInfo, ThermalReading } from '../native/types';
import { formatDuration } from '../utils/format';
import { sessionManager, SessionState } from '../services/sessionManager';

export function CpuThermalScreen() {
  const { theme } = useTheme();
  const cpu = useNativeReading<CpuInfo>(() => DeviceMonitor.getCpuInfo(), {
    refreshMs: 10000,
  });
  const thermal = useNativeReading<ThermalReading>(
    () => DeviceMonitor.getThermalReading(),
    { refreshMs: 10000 },
  );
  const [, setTick] = useState(0);
  const session: SessionState = sessionManager.state;

  useEffect(() => {
    sessionManager.onUpdate = () => setTick(t => t + 1);
    return () => {
      sessionManager.onUpdate = null;
    };
  }, []);

  const thermalTone =
    thermal.data?.status == null
      ? 'neutral'
      : ['none'].includes(thermal.data.status)
        ? 'ok'
        : ['light', 'moderate'].includes(thermal.data.status)
          ? 'warn'
          : 'danger';

  const startSession = () => {
    sessionManager.start(5000);
    setTick(t => t + 1);
  };
  const stopSession = () => {
    sessionManager.stop();
    setTick(t => t + 1);
    Alert.alert(
      'Session saved',
      `${session.sampleCount} samples over ${formatDuration(
        sessionManager.durationMs(),
      )}. Charts and a summary are below — full History view has the long-term graphs.`,
    );
  };

  return (
    <ScreenContainer
      title="CPU & Thermal"
      subtitle="Processor info, thermal status, gaming sessions">
      <View style={styles.grid}>
        <MetricCard
          label="Cores"
          value={cpu.data?.cores != null ? String(cpu.data.cores) : null}
          tone="info"
          loading={cpu.loading}
          unavailableNote="Runtime.availableProcessors"
          updatedAt={cpu.data?.timestamp ?? null}
        />
        <MetricCard
          label="ABI"
          value={cpu.data?.abis?.split(',')?.[0] ?? null}
          tone="neutral"
          loading={cpu.loading}
          unavailableNote="Build.SUPPORTED_ABIS"
          updatedAt={cpu.data?.timestamp ?? null}
        />
        <MetricCard
          label="Load (est.)"
          value={cpu.data?.loadEstimatePct != null ? `${cpu.data.loadEstimatePct}%` : null}
          tone={cpu.data && cpu.data.loadEstimatePct! > 80 ? 'warn' : 'neutral'}
          loading={cpu.loading}
          unavailableNote="/proc/loadavg not readable"
          caption="loadavg ÷ cores — an estimate, not true instantaneous CPU%"
          updatedAt={cpu.data?.timestamp ?? null}
        />
        <MetricCard
          label="Thermal"
          value={thermal.data?.status ?? null}
          tone={thermalTone}
          loading={thermal.loading}
          unavailableNote="PowerManager thermal status (API 29+)"
          updatedAt={thermal.data?.timestamp ?? null}
        />
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
          },
        ]}>
        <View style={styles.rowBetween}>
          <Text
            style={[
              styles.cardTitle,
              theme.typography.bodyBold,
              { color: theme.colors.textPrimary },
            ]}>
            Thermal history
          </Text>
          {thermal.data?.thermalHeadroom != null && (
            <StatusBadge
              label={`Headroom ${(thermal.data.thermalHeadroom * 100).toFixed(0)}%`}
              tone="warn"
            />
          )}
        </View>
        <LineChart
          data={null}
          emptyText="Session samples populate thermal graph"
          color={theme.colors.warn}
          yMin={0}
          yMax={7}
          accessibilityLabel="Thermal status level over time"
        />
      </View>

      {/* ── Gaming / heavy-use session ─────────────────────── */}
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
            styles.cardTitle,
            theme.typography.bodyBold,
            { color: theme.colors.textPrimary },
          ]}>
          Gaming / heavy-use session
        </Text>

        {session.active ? (
          <View style={styles.sessionActive}>
            <View style={styles.sessionStats}>
              <MetricCard
                label="Duration"
                value={formatDuration(sessionManager.durationMs())}
                compact
              />
              <MetricCard
                label="Samples"
                value={String(session.sampleCount)}
                compact
              />
              <MetricCard
                label="Battery now"
                value={session.lastPct != null ? `${session.lastPct}%` : '—'}
                tone={
                  session.firstPct != null &&
                  session.lastPct != null &&
                  session.firstPct - session.lastPct >= 5
                    ? 'warn'
                    : 'ok'
                }
                caption={
                  session.firstPct != null
                    ? `started ${session.firstPct}%`
                    : undefined
                }
                compact
              />
              <MetricCard
                label="RAM now"
                value={
                  session.lastRamPct != null
                    ? `${Math.round(session.lastRamPct)}%`
                    : '—'
                }
                tone="warn"
                caption={
                  session.firstRamPct != null
                    ? `started ${Math.round(session.firstRamPct)}%`
                    : undefined
                }
                compact
              />
            </View>
            <Pressable
              onPress={stopSession}
              accessibilityRole="button"
              accessibilityLabel="Stop session"
              style={({ pressed }) => [
                styles.sessionBtn,
                {
                  backgroundColor: theme.colors.danger,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}>
              <Text style={styles.sessionBtnLabel}>Stop session</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text
              style={[
                styles.sessionHint,
                theme.typography.caption,
                { color: theme.colors.textSecondary },
              ]}>
              Record RAM, battery and thermal every 5s while you game. Compare
              first vs last readings and generate a report. Android may still
              throttle background work — this is best-effort, not a guarantee
              of uninterrupted capture.
            </Text>
            <Pressable
              onPress={startSession}
              accessibilityRole="button"
              accessibilityLabel="Start session"
              style={({ pressed }) => [
                styles.sessionBtn,
                {
                  backgroundColor: theme.colors.accent,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}>
              <Text style={styles.sessionBtnLabel}>Start session</Text>
            </Pressable>
            {session.sampleCount > 0 && (
              <Text
                style={[
                  styles.sessionHint,
                  theme.typography.micro,
                  { color: theme.colors.textTertiary },
                ]}>
                Last session: {session.sampleCount} samples over{' '}
                {formatDuration(
                  (session.stoppedAt ?? Date.now()) -
                    (session.startedAt ?? Date.now()),
                )}
                . Battery {session.firstPct}% → {session.lastPct}%. RAM{' '}
                {session.firstRamPct != null
                  ? `${Math.round(session.firstRamPct)}%`
                  : '—'}{' '}
                →{' '}
                {session.lastRamPct != null
                  ? `${Math.round(session.lastRamPct)}%`
                  : '—'}
                .
              </Text>
            )}
          </>
        )}
      </View>

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
            styles.cardTitle,
            theme.typography.bodyBold,
            { color: theme.colors.textPrimary },
          ]}>
          Honest limitations
        </Text>
        <Text
          style={[
            styles.cardBody,
            theme.typography.body,
            { color: theme.colors.textSecondary },
          ]}>
          CPU frequency files under /sys are unreadable on most production
          kernels. Per-core utilization is not exposed to normal apps — the
          load figure is a 1-minute load average divided by core count, clearly
          labeled as an estimate. Thermal status comes from PowerManager (API
          29+); exact sensor °C is usually unavailable. No FPS or GPU stats are
          claimed.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 10,
  },
  cardTitle: {},
  cardBody: {},
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sessionActive: {
    gap: 12,
  },
  sessionStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sessionHint: {},
  sessionBtn: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionBtnLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
