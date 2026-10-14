import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../components/ScreenContainer';
import { EmptyState } from '../components/EmptyState';
import { LineChart, ChartPoint } from '../components/LineChart';
import { StatusBadge } from '../components/StatusBadge';
import { useTheme } from '../theme/useTheme';
import { RangeKey, RANGES } from '../database/schema';
import {
  clearSamples,
  countSamples,
  queryDaily,
  queryRange,
} from '../database/repository';
import { samplingService } from '../services/samplingService';
import { exportAndShare } from '../services/exportService';
import type { ChartRow, DailySummary } from '../native/types';
import { formatDateTime, formatPercent } from '../utils/format';

const RANGE_KEYS: RangeKey[] = ['1h', '6h', '24h', '7d', '30d'];

export function HistoryScreen() {
  const { theme } = useTheme();
  const [range, setRange] = useState<RangeKey>('1h');
  const [rows, setRows] = useState<ChartRow[]>([]);
  const [daily, setDaily] = useState<DailySummary[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const to = Date.now();
    const from = to - RANGES[range];
    const [chartRows, dailyRows, total] = await Promise.all([
      queryRange(from, to, 120),
      queryDaily(from, to),
      countSamples(),
    ]);
    setRows(chartRows ?? []);
    setDaily(dailyRows ?? []);
    setCount(total);
    setLoading(false);
  }, [range]);

  useEffect(() => {
    load();
    samplingService.onUpdate = () => {
      // Refresh the active window after each background insert.
      load();
    };
    return () => {
      samplingService.onUpdate = null;
    };
  }, [load]);

  const onClear = () => {
    Alert.alert(
      'Delete all history?',
      'Every recorded sample on this device will be removed. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            clearSamples().then(() => load());
          },
        },
      ],
    );
  };

  const ramPoints: ChartPoint[] = rows
    .filter(r => r.ramPct != null)
    .map(r => ({ x: r.ts, y: r.ramPct as number }));
  const batPoints: ChartPoint[] = rows
    .filter(r => r.batPct != null)
    .map(r => ({ x: r.ts, y: r.batPct as number }));
  const stoPoints: ChartPoint[] = rows
    .filter(r => r.stoPct != null)
    .map(r => ({ x: r.ts, y: r.stoPct as number }));

  const samplingBadge =
    samplingService.state === 'running'
      ? { label: `Sampling · ${count ?? 0} rows`, tone: 'ok' as const }
      : samplingService.state === 'paused'
        ? { label: 'Paused (app in background)', tone: 'warn' as const }
        : { label: 'Sampler stopped', tone: 'neutral' as const };

  return (
    <ScreenContainer
      title="History & Reports"
      subtitle="Local SQLite — never leaves your phone">
      <View style={styles.badgeRow}>
        <StatusBadge label={samplingBadge.label} tone={samplingBadge.tone} />
        <StatusBadge
          label={`Window: ${range}`}
          tone="info"
          dot={false}
        />
      </View>

      <View style={styles.filterRow}>
        {RANGE_KEYS.map(key => {
          const active = key === range;
          return (
            <Pressable
              key={key}
              onPress={() => setRange(key)}
              accessibilityRole="button"
              accessibilityLabel={`Show last ${key}`}
              style={({ pressed }) => [
                styles.filterChip,
                {
                  backgroundColor: active
                    ? theme.colors.accent
                    : theme.colors.surfaceRaised,
                  borderColor: active ? theme.colors.accent : theme.colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}>
              <Text
                style={[
                  styles.filterLabel,
                  { color: active ? theme.colors.accentText : theme.colors.textSecondary },
                ]}>
                {key}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.exportRow}>
        <Pressable
          onPress={() => {
            const to = Date.now();
            exportAndShare('csv', to - RANGES[range], to).catch(() => {});
          }}
          accessibilityRole="button"
          accessibilityLabel="Export CSV"
          style={({ pressed }) => [
            styles.exportBtn,
            {
              backgroundColor: theme.colors.surfaceRaised,
              borderColor: theme.colors.border,
              opacity: pressed ? 0.8 : 1,
            },
          ]}>
          <Text style={[styles.exportLabel, { color: theme.colors.textPrimary }]}>
            Export CSV
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            const to = Date.now();
            exportAndShare('json', to - RANGES[range], to).catch(() => {});
          }}
          accessibilityRole="button"
          accessibilityLabel="Export JSON"
          style={({ pressed }) => [
            styles.exportBtn,
            {
              backgroundColor: theme.colors.surfaceRaised,
              borderColor: theme.colors.border,
              opacity: pressed ? 0.8 : 1,
            },
          ]}>
          <Text style={[styles.exportLabel, { color: theme.colors.textPrimary }]}>
            Export JSON
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <EmptyState compact title="Loading samples…" message="Querying local SQLite." />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No samples in this window"
          message={
            count != null && count > 0
              ? `You have ${count} row(s) overall, but none in the last ${range}. Keep the app open — a sample is recorded every minute.`
              : 'Pulse records RAM, battery, storage and thermal readings once per minute while the app is open. Check back in a minute.'
          }
        />
      ) : (
        <>
          <ChartCard
            title="RAM utilization %"
            points={ramPoints}
            color={theme.colors.accent}
            theme={theme}
          />
          <ChartCard
            title="Battery %"
            points={batPoints}
            color={theme.colors.ok}
            theme={theme}
          />
          <ChartCard
            title="Storage used %"
            points={stoPoints}
            color={theme.colors.info}
            theme={theme}
          />
        </>
      )}

      {daily.length > 0 && (
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
            Daily summary
          </Text>
          {daily.slice(0, 7).map(d => (
            <View key={d.dayKey} style={styles.dailyRow}>
              <Text
                style={[
                  styles.dailyDay,
                  theme.typography.caption,
                  { color: theme.colors.textSecondary },
                ]}>
                Day {Math.floor(d.dayKey)}
              </Text>
              <Text
                style={[
                  styles.dailyStats,
                  theme.typography.caption,
                  { color: theme.colors.textPrimary },
                ]}>
                RAM {formatPercent(d.ramPct, true)} · Batt {d.batMin}–
                {d.batMax}% · {d.n} samples
              </Text>
            </View>
          ))}
        </View>
      )}

      {rows.length > 0 && (
        <Pressable
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel="Delete all history"
          style={({ pressed }) => [
            styles.clearBtn,
            {
              borderColor: theme.colors.danger,
              opacity: pressed ? 0.7 : 1,
            },
          ]}>
          <Text style={[styles.clearLabel, { color: theme.colors.danger }]}>
            Delete all history
          </Text>
        </Pressable>
      )}

      {rows.length > 0 && (
        <Text
          style={[
            styles.footer,
            theme.typography.micro,
            { color: theme.colors.textTertiary },
          ]}>
          Latest sample:{' '}
          {rows.length > 0 ? formatDateTime(rows[rows.length - 1].ts) : '—'}
        </Text>
      )}
    </ScreenContainer>
  );
}

function ChartCard({
  title,
  points,
  color,
  theme,
}: {
  title: string;
  points: ChartPoint[];
  color: string;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
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
        {title}
      </Text>
      <LineChart
        data={points}
        color={color}
        yMin={0}
        yMax={100}
        emptyText="No points in range"
        accessibilityLabel={title}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  exportRow: {
    flexDirection: 'row',
    gap: 8,
  },
  exportBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 10,
  },
  cardTitle: {},
  dailyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#262630',
  },
  dailyDay: {
    fontWeight: '600',
  },
  dailyStats: {
    flexShrink: 1,
    textAlign: 'right',
  },
  clearBtn: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  clearLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    textAlign: 'center',
    marginTop: 4,
  },
});
