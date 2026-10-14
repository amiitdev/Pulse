import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ColorTone, toneColor, useTheme } from '../theme/useTheme';

interface Props {
  label: string;
  tone?: ColorTone;
  /** Small colored dot before the label. */
  dot?: boolean;
}

/** Compact status pill used across cards and summaries. */
export function StatusBadge({ label, tone = 'neutral', dot = true }: Props) {
  const { theme } = useTheme();
  const color = toneColor(theme.colors, tone);

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Status: ${label}`}
      style={[
        styles.badge,
        { backgroundColor: theme.colors.surfaceRaised, borderColor: color },
      ]}>
      {dot && <View style={[styles.dot, { backgroundColor: color }]} />}
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
});
