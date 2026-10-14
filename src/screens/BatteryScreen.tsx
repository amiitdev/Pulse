import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../components/ScreenContainer';
import { MetricCard } from '../components/MetricCard';
import { LineChart } from '../components/LineChart';
import { StatusBadge } from '../components/StatusBadge';
import { useTheme } from '../theme/useTheme';
import { useNativeReading } from '../hooks/useNativeReading';
import { DeviceMonitor } from '../native/DeviceMonitor';
import type { BatteryReading } from '../native/types';
import { formatTemperatureC, formatVoltage } from '../utils/format';

export function BatteryScreen() {
  const { theme } = useTheme();
  const { data, loading } = useNativeReading<BatteryReading>(
    () => DeviceMonitor.getBatteryReading(),
    { refreshMs: 5000 },
  );

  const statusTone =
    data?.status === 'charging'
      ? 'ok'
      : data?.status === 'discharging'
        ? 'info'
        : 'neutral';

  return (
    <ScreenContainer
      title="Battery Lab"
      subtitle="BatteryManager + battery status broadcasts">
      <View style={styles.badgeRow}>
        <StatusBadge
          label={data ? data.status : 'Waiting for Phase 4'}
          tone={data ? statusTone : 'neutral'}
        />
        <StatusBadge
          label={data?.charger ? `Source: ${data.charger}` : 'Charger unknown'}
          tone={data?.charger ? 'ok' : 'neutral'}
        />
      </View>

      <View style={styles.grid}>
        <MetricCard
          label="Charge"
          value={data?.percent != null ? String(data.percent) : null}
          unit={data?.percent != null ? '%' : undefined}
          tone={
            data?.percent != null && data.percent <= 20 ? 'danger' : 'ok'
          }
          loading={loading}
          unavailableNote="BatteryManager reading arrives in Phase 4"
          updatedAt={data?.timestamp ?? null}
        />
        <MetricCard
          label="Temperature"
          value={
            data?.temperatureC != null
              ? formatTemperatureC(data.temperatureC)
              : null
          }
          tone={
            data?.temperatureC != null && data.temperatureC > 40
              ? 'danger'
              : 'neutral'
          }
          loading={loading}
          unavailableNote="Not all devices expose EXTRA_TEMPERATURE"
          caption="Reported by the fuel gauge, not a skin sensor"
          updatedAt={data?.timestamp ?? null}
        />
        <MetricCard
          label="Voltage"
          value={data?.voltageMv != null ? formatVoltage(data.voltageMv) : null}
          tone="neutral"
          loading={loading}
          unavailableNote="Unavailable until Phase 4"
          updatedAt={data?.timestamp ?? null}
        />
        <MetricCard
          label="Health"
          value={data?.health ?? null}
          tone={data?.health === 'good' ? 'ok' : 'neutral'}
          loading={loading}
          unavailableNote="Manufacturer-reported health in Phase 4"
          caption="Only genuine values from the OS — never estimated here"
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
          Charge & discharge history
        </Text>
        <LineChart
          data={null}
          emptyText="Percentage samples start in Phase 5"
          color={theme.colors.ok}
          accessibilityLabel="Battery percentage over time"
        />
        <Text style={[styles.body, theme.typography.caption, { color: theme.colors.textTertiary }]}>
          Drain rate and time-remaining estimates are computed only after
          enough reliable observations exist — they will be labeled as
          estimates.
        </Text>
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
          About battery health
        </Text>
        <Text style={[styles.body, theme.typography.body, { color: theme.colors.textSecondary }]}>
          <Text style={styles.strong}>Health</Text> here is what the device
          itself reports (via BatteryManager). Many modern phones withhold
          degradation data from apps entirely — when the platform hides it,
          this screen shows “unavailable” rather than guessing a capacity
          percentage.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
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
  strong: {
    fontWeight: '700',
    color: '#F4F4F7',
  },
});
