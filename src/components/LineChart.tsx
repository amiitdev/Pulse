import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';
import { formatClock } from '../utils/format';

export interface ChartPoint {
  /** Epoch ms of the sample. */
  x: number;
  /** Value on the y-axis (e.g. percent 0..100). */
  y: number;
}

interface Props {
  data: ChartPoint[] | null;
  height?: number;
  color?: string;
  /** Shown when fewer than 2 points exist. */
  emptyText?: string;
  /** Force this y-range; otherwise derived from data (0..100 friendly). */
  yMin?: number;
  yMax?: number;
  /** Accessibility label, e.g. "RAM utilization over time". */
  accessibilityLabel?: string;
}

const PAD_LEFT = 36;
const PAD_RIGHT = 10;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;

/**
 * Lightweight line chart drawn with react-native-svg (spec §2).
 * Handles < 2 samples with an explicit empty state — no fabricated curve.
 */
export function LineChart({
  data,
  height = 180,
  color,
  emptyText = 'Not enough samples yet',
  yMin,
  yMax,
  accessibilityLabel,
}: Props) {
  const { theme } = useTheme();
  const [width, setWidth] = useState(0);
  const stroke = color ?? theme.colors.accent;
  const points = data ?? [];
  const hasData = points.length >= 2 && width > 0;

  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width);

  const minY = yMin ?? Math.min(...points.map(p => p.y), 0);
  const maxY = yMax ?? Math.max(...points.map(p => p.y), 100);
  const spanY = maxY - minY || 1;
  const minX = points[0]?.x ?? 0;
  const maxX = points[points.length - 1]?.x ?? 1;
  const spanX = maxX - minX || 1;

  const plotW = width - PAD_LEFT - PAD_RIGHT;
  const plotH = height - PAD_TOP - PAD_BOTTOM;

  const toPx = (p: ChartPoint) => ({
    x: PAD_LEFT + ((p.x - minX) / spanX) * plotW,
    y: PAD_TOP + (1 - (p.y - minY) / spanY) * plotH,
  });

  const px = points.map(toPx);
  const last = px[px.length - 1];
  const gridYs = [PAD_TOP, PAD_TOP + plotH / 2, PAD_TOP + plotH];
  const gridValues = [maxY, (maxY + minY) / 2, minY];

  return (
    <View
      onLayout={onLayout}
      style={[styles.container, { height }]}
      accessibilityRole="image"
      accessibilityLabel={
        accessibilityLabel ?? `${points.length} samples over time`
      }>
      {hasData ? (
        <Svg width={width} height={height}>
          {gridYs.map((y, i) => (
            <Line
              key={`g${i}`}
              x1={PAD_LEFT}
              y1={y}
              x2={width - PAD_RIGHT}
              y2={y}
              stroke={theme.colors.border}
              strokeWidth={1}
              strokeDasharray={i === 2 ? undefined : '3 5'}
            />
          ))}
          <Polyline
            points={px.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={stroke}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Circle cx={last.x} cy={last.y} r={4} fill={stroke} />
        </Svg>
      ) : (
        <View style={styles.empty} pointerEvents="none">
          <Text
            style={[styles.emptyText, { color: theme.colors.textTertiary }]}>
            {emptyText}
          </Text>
        </View>
      )}

      {/* Axis labels live outside Svg for simpler text layout */}
      {hasData && (
        <>
          {gridValues.map((v, i) => (
            <Text
              key={`yl${i}`}
              style={[
                styles.yLabel,
                {
                  top: gridYs[i] - 8,
                  color: theme.colors.textTertiary,
                },
              ]}>
              {Math.round(v)}
            </Text>
          ))}
          <Text
            style={[
              styles.xLabel,
              { left: PAD_LEFT, color: theme.colors.textTertiary },
            ]}>
            {formatClock(minX)}
          </Text>
          <Text
            style={[
              styles.xLabel,
              styles.xLabelRight,
              {
                right: PAD_RIGHT,
                color: theme.colors.textTertiary,
              },
            ]}>
            {formatClock(maxX)}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
  yLabel: {
    position: 'absolute',
    left: 0,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  xLabel: {
    position: 'absolute',
    bottom: 2,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  xLabelRight: {
    textAlign: 'right',
  },
});
