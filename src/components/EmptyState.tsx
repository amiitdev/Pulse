import React, { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface Props {
  title: string;
  message: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  /** Compact variant for embedding inside cards/charts. */
  compact?: boolean;
}

/**
 * Empty / unavailable / permission-explanation state (spec §4).
 * Message must say what is actually happening — no fake data.
 */
export function EmptyState({
  title,
  message,
  icon,
  actionLabel,
  onAction,
  compact = false,
}: Props) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { paddingVertical: compact ? theme.spacing.lg : theme.spacing.xxl },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`${title}. ${message}`}>
      {icon != null && <View style={styles.icon}>{icon}</View>}
      <Text
        style={[
          styles.title,
          theme.typography.bodyBold,
          { color: theme.colors.textPrimary },
        ]}>
        {title}
      </Text>
      <Text
        style={[
          styles.message,
          theme.typography.caption,
          { color: theme.colors.textSecondary },
        ]}>
        {message}
      </Text>
      {actionLabel != null && onAction != null && (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => [
            styles.action,
            {
              backgroundColor: theme.colors.accent,
              opacity: pressed ? 0.85 : 1,
            },
          ]}>
          <Text style={[styles.actionLabel, { color: theme.colors.accentText }]}>
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  icon: {
    marginBottom: 4,
  },
  title: {
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    maxWidth: 320,
  },
  action: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    minHeight: 44,
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
});
