import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { ScreenContainer } from '../components/ScreenContainer';
import { MetricCard } from '../components/MetricCard';
import { LineChart, ChartPoint } from '../components/LineChart';
import { useTheme } from '../theme/useTheme';
import { useNativeReading } from '../hooks/useNativeReading';
import { DeviceMonitor } from '../native/DeviceMonitor';
import type { RootTabParamList } from '../navigation/types';
import type { StorageReading } from '../native/types';
import { formatBytesShort, formatPercent } from '../utils/format';
import { queryRange } from '../database/repository';
import { samplingService } from '../services/samplingService';

export function StorageScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { data, loading } = useNativeReading<StorageReading>(
    () => DeviceMonitor.getStorageReading(),
    { refreshMs: 15000 },
  );
  const [growth, setGrowth] = useState<ChartPoint[]>([]);

  useEffect(() => {
    const load = () => {
      const to = Date.now();
      queryRange(to - 24 * 3600_000, to, 120).then(rows => {
        setGrowth(
          (rows ?? [])
            .filter(r => r.stoPct != null)
            .map(r => ({ x: r.ts, y: r.stoPct as number })),
        );
      });
    };
    load();
    samplingService.onUpdate = load;
    return () => {
      samplingService.onUpdate = null;
    };
  }, []);

  return (
    <ScreenContainer
      title="Storage Explorer"
      subtitle="StatFs filesystem statistics + scoped file access">
      <View style={styles.grid}>
        <MetricCard
          label="Used"
          value={data ? formatBytesShort(data.usedBytes) : null}
          tone="warn"
          loading={loading}
          unavailableNote="StatFs reading arrives in Phase 4"
          updatedAt={data?.timestamp ?? null}
        />
        <MetricCard
          label="Free"
          value={data ? formatBytesShort(data.freeBytes) : null}
          tone="ok"
          loading={loading}
          unavailableNote="StatFs reading arrives in Phase 4"
          updatedAt={data?.timestamp ?? null}
        />
        <MetricCard
          label="Total"
          value={data ? formatBytesShort(data.totalBytes) : null}
          tone="neutral"
          loading={loading}
          unavailableNote="StatFs reading arrives in Phase 4"
          updatedAt={data?.timestamp ?? null}
        />
        <MetricCard
          label="Usage"
          value={data ? formatPercent(data.usedBytes / data.totalBytes) : null}
          tone="info"
          loading={loading}
          unavailableNote="StatFs reading arrives in Phase 4"
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
          Storage growth
        </Text>
        <LineChart
          data={growth}
          emptyText="Storage % appears here after the first history samples"
          color={theme.colors.info}
          yMin={0}
          yMax={100}
          accessibilityLabel="Storage usage over time"
        />
      </View>

      <Pressable
        onPress={() => navigation.navigate('FileExplorer')}
        accessibilityRole="button"
        accessibilityLabel="Open File Explorer"
        style={({ pressed }) => [
          styles.explorerBtn,
          {
            backgroundColor: theme.colors.accent,
            opacity: pressed ? 0.85 : 1,
          },
        ]}>
        <Text style={styles.explorerLabel}>Open File Explorer</Text>
        <Text style={styles.explorerSub}>
          Large files · by type · safe trash delete
        </Text>
      </Pressable>

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
          About file access
        </Text>
        <Text style={[styles.body, theme.typography.body, { color: theme.colors.textSecondary }]}>
          Pulse uses MediaStore (scoped storage) — the same store the system
          Files app sees. All Files Access is never requested. Deletion goes
          through the platform trash on Android 10+ so you can restore
          mistakes. Large-file ranking is real MediaStore sizes, not estimates.
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
  body: {},
  explorerBtn: {
    minHeight: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  explorerLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  explorerSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '500',
  },
});
