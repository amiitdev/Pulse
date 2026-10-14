import React, { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ColorTone, toneColor, useTheme } from '../theme/useTheme';
import { Skeleton } from './Skeleton';
import { formatClock } from '../utils/format';

interface Props {
  label: string;
  /** Pre-formatted value. null/undefined => explicit unavailable state. */
  value?: string | number | null;
  unit?: string;
  tone?: ColorTone;
  loading?: boolean;
  /** Why is the value unavailable? Shown under the dash. */
  unavailableNote?: string;
  /** Small explanatory line (e.g. definition of "used"). */
  caption?: string;
  /** Epoch ms of the reading; shows "14:03:21". */
  updatedAt?: number | null;
  onPress?: () => void;
  rightAccessory?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
}

/**
 * Primary statistic card: label, value+unit, status tone, last-updated time.
 * Renders skeletons while loading and an explicit dash + reason when the
 * reading is unavailable (spec §5: never substitute fabricated values).
 */
export function MetricCard({
  label,
  value,
  unit,
  tone = 'neutral',
  loading = false,
  unavailableNote,
  caption,
  updatedAt,
  onPress,
  rightAccessory,
  children,
  compact = false,
}: Props) {
  const { theme } = useTheme();
  const accent = toneColor(theme.colors, tone);
  const isUnavailable = !loading && (value == null || value === '');

  const body = (
    <View style={[styles.inner, compact && { paddingVertical: theme.spacing.md }]}>
      <View style={styles.headerRow}>
        <Text
          style={[
            styles.label,
            theme.typography.caption,
            { color: theme.colors.textSecondary },
          ]}
          numberOfLines={1}>
          {label}
        </Text>
        {rightAccessory}
      </View>

      {loading ? (
        <Skeleton width={110} height={30} style={styles.skeletonValue} />
      ) : isUnavailable ? (
        <View style={styles.valueRow}>
          <Text
            style={[
              styles.value,
              theme.typography.display,
              styles.valueSize,
              { color: theme.colors.textTertiary },
            ]}>
            —
          </Text>
        </View>
      ) : (
        <View style={styles.valueRow}>
          <Text
            accessibilityLabel={`${label}: ${String(value)}${unit ? ` ${unit}` : ''}`}
            style={[
              styles.value,
              theme.typography.display,
              styles.valueSize,
              { color: theme.colors.textPrimary },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {String(value)}
          </Text>
          {unit != null && unit !== '' && (
            <Text
              style={[styles.unit, { color: accent }]}
              accessibilityElementsHidden>
              {unit}
            </Text>
          )}
        </View>
      )}

      {isUnavailable && unavailableNote != null && (
        <Text
          style={[styles.note, theme.typography.micro, { color: theme.colors.textTertiary }]}
          numberOfLines={2}>
          {unavailableNote}
        </Text>
      )}

      {caption != null && (
        <Text
          style={[styles.caption, theme.typography.micro, { color: theme.colors.textTertiary }]}
          numberOfLines={3}>
          {caption}
        </Text>
      )}

      <Text
        style={[styles.updated, theme.typography.micro, { color: theme.colors.textTertiary }]}>
        {updatedAt == null ? 'Not updated yet' : `Updated ${formatClock(updatedAt)}`}
      </Text>

      {children}
    </View>
  );

  const containerStyle = [
    styles.card,
    {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
    },
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [...containerStyle, pressed && { opacity: 0.85 }]}>
        {body}
      </Pressable>
    );
  }

  return <View style={containerStyle}>{body}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    minWidth: 150,
    flexGrow: 1,
    flexBasis: '46%',
  },
  inner: {
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    flexShrink: 1,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    fontVariant: ['tabular-nums'],
  },
  skeletonValue: {
    marginTop: 6,
  },
  valueSize: {
    fontSize: 28,
    lineHeight: 32,
  },
  unit: {
    fontSize: 15,
    fontWeight: '700',
  },
  note: {
    marginTop: 2,
  },
  caption: {
    marginTop: 2,
  },
  updated: {
    marginTop: 6,
  },
});
