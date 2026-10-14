import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../components/ScreenContainer';
import { MetricCard } from '../components/MetricCard';
import { LineChart } from '../components/LineChart';
import { useTheme } from '../theme/useTheme';
import { useNativeReading } from '../hooks/useNativeReading';
import { DeviceMonitor } from '../native/DeviceMonitor';
import type { RamReading } from '../native/types';
import { formatBytesShort, formatPercent } from '../utils/format';

export function RamScreen() {
  const { theme } = useTheme();
  const { data, loading } = useNativeReading<RamReading>(
    () => DeviceMonitor.getRamReading(),
    { refreshMs: 5000 },
  );

  return (
    <ScreenContainer
      title="RAM Monitor"
      subtitle="System memory via ActivityManager.MemoryInfo">
      <View style={styles.grid}>
        <MetricCard
          label="Used"
          value={data ? formatBytesShort(data.usedBytes) : null}
          tone="warn"
          loading={loading}
          unavailableNote="Kotlin RamMonitorModule arrives in Phase 3"
          caption="used = total − available"
          updatedAt={data?.timestamp ?? null}
        />
        <MetricCard
          label="Available"
          value={data ? formatBytesShort(data.availableBytes) : null}
          tone="ok"
          loading={loading}
          unavailableNote="Kotlin RamMonitorModule arrives in Phase 3"
          updatedAt={data?.timestamp ?? null}
        />
        <MetricCard
          label="Total"
          value={data ? formatBytesShort(data.totalBytes) : null}
          tone="neutral"
          loading={loading}
          unavailableNote="Kotlin RamMonitorModule arrives in Phase 3"
          updatedAt={data?.timestamp ?? null}
        />
        <MetricCard
          label="Utilization"
          value={
            data ? formatPercent(data.usedBytes / data.totalBytes) : null
          }
          tone={
            data && data.usedBytes / data.totalBytes > 0.9 ? 'danger' : 'warn'
          }
          loading={loading}
          unavailableNote="Kotlin RamMonitorModule arrives in Phase 3"
          updatedAt={data?.timestamp ?? null}
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
        <Text
          style={[
            styles.cardTitle,
            theme.typography.bodyBold,
            { color: theme.colors.textPrimary },
          ]}>
          Utilization over time
        </Text>
        <LineChart
          data={null}
          emptyText="History recording starts in Phase 5"
          color={theme.colors.accent}
          accessibilityLabel="RAM utilization over time"
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
        <Text
          style={[
            styles.cardTitle,
            theme.typography.bodyBold,
            { color: theme.colors.textPrimary },
          ]}>
          Reading memory pressure
        </Text>
        <Text style={[styles.body, theme.typography.body, { color: theme.colors.textSecondary }]}>
          Android reports <Text style={styles.strong}>lowMemory</Text> when the
          system is under global memory pressure. When it is true, the OS is
          actively reclaiming memory — closing caches and possibly background
          processes.
        </Text>
        <Text style={[styles.body, theme.typography.body, { color: theme.colors.textSecondary }]}>
          <Text style={styles.strong}>High usage is not a problem by itself.</Text>{' '}
          Linux-based systems keep memory busy on purpose: unused RAM is wasted
          RAM. “Used” here means total − available, and available already
          excludes memory the kernel can reclaim quickly — so a phone showing
          85% used with no lag and no lowMemory flag is behaving normally.
        </Text>
        <Text style={[styles.body, theme.typography.body, { color: theme.colors.textSecondary }]}>
          This screen reports <Text style={styles.strong}>system-wide</Text>{' '}
          numbers only. Per-process memory of other apps requires privileges
          this app does not request, so it is never shown here.
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
  body: {
    marginTop: 2,
  },
  strong: {
    fontWeight: '700',
    color: '#F4F4F7',
  },
});
