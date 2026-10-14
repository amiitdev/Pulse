import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';
import { Skeleton } from './Skeleton';
import { clamp } from '../utils/format';

interface Props {
  size?: number;
  strokeWidth?: number;
  /** 0..1 progress, or null when unavailable. */
  progress: number | null;
  /** Center text, e.g. "73". */
  value: string;
  unit?: string;
  /** Caption under the value, e.g. "RAM". */
  caption?: string;
  color?: string;
  loading?: boolean;
}

/**
 * Elegant circular gauge (spec §4).
 * All typography scales with `size` so "100%" never overflows the ring,
 * even on narrow screens or with large system font-scale.
 * Unavailable progress => dashed track + dash center, never a fake arc.
 */
export function CircularGauge({
  size = 132,
  strokeWidth = 10,
  progress,
  value,
  unit,
  caption,
  color,
  loading = false,
}: Props) {
  const { theme } = useTheme();
  const accent = color ?? theme.colors.accent;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const hasProgress = progress != null && isFinite(progress);
  const clamped = hasProgress ? clamp(progress, 0, 1) : 0;
  const dashOffset = circumference * (1 - clamped);

  // Typography scales with the gauge so text always fits inside the ring.
  const valueFont = Math.max(13, Math.round(size * 0.24));
  const unitFont = Math.max(9, Math.round(size * 0.11));
  const captionFont = Math.max(9, Math.round(size * 0.095));
  const sidePad = Math.max(6, Math.round(size * 0.06));

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: 100,
        ...(hasProgress ? { now: Math.round(clamped * 100) } : {}),
      }}
      accessibilityLabel={
        caption
          ? `${caption}: ${hasProgress ? `${value}${unit ?? ''}` : 'unavailable'}`
          : value
      }>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={theme.colors.track}
            strokeWidth={strokeWidth}
            fill="none"
            {...(hasProgress
              ? {}
              : { strokeDasharray: '3 7', strokeLinecap: 'round' as const })}
          />
          {hasProgress && (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={accent}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={dashOffset}
            />
          )}
        </G>
      </Svg>

      <View
        style={[styles.center, { paddingHorizontal: sidePad }]}
        pointerEvents="none">
        {loading ? (
          <Skeleton
            width={Math.round(size * 0.55)}
            height={Math.round(size * 0.2)}
          />
        ) : (
          <View style={styles.valueRow}>
            <Text
              style={[
                styles.value,
                {
                  fontSize: valueFont,
                  lineHeight: Math.round(valueFont * 1.15),
                  color: hasProgress
                    ? theme.colors.textPrimary
                    : theme.colors.textTertiary,
                },
              ]}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
              numberOfLines={1}>
              {value}
            </Text>
            {unit != null && unit !== '' && (
              <Text
                style={[
                  styles.unit,
                  {
                    fontSize: unitFont,
                    color: theme.colors.textSecondary,
                  },
                ]}
                numberOfLines={1}>
                {unit}
              </Text>
            )}
          </View>
        )}
        {caption != null && (
          <Text
            style={[
              styles.caption,
              {
                fontSize: captionFont,
                color: theme.colors.textSecondary,
              },
            ]}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            numberOfLines={1}>
            {caption}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  value: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
    textAlign: 'center',
  },
  unit: {
    fontWeight: '600',
    marginLeft: 1,
  },
  caption: {
    fontWeight: '500',
    textAlign: 'center',
  },
});
