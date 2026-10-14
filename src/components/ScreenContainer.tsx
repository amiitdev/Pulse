import React, { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';

interface Props {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  /** Extra bottom padding so content clears the tab bar. */
  contentStyle?: object;
}

/**
 * Standard screen chrome: safe-area aware header, consistent spacing,
 * optional scrolling. Keeps the 8 screens visually uniform (spec §4).
 */
export function ScreenContainer({
  title,
  subtitle,
  right,
  children,
  scroll = true,
  contentStyle,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const header = (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text
          accessibilityRole="header"
          style={[
            styles.title,
            theme.typography.title,
            { color: theme.colors.textPrimary },
          ]}>
          {title}
        </Text>
        {subtitle != null && (
          <Text
            style={[
              styles.subtitle,
              theme.typography.caption,
              { color: theme.colors.textSecondary },
            ]}>
            {subtitle}
          </Text>
        )}
      </View>
      {right != null && <View>{right}</View>}
    </View>
  );

  if (!scroll) {
    return (
      <View
        style={[
          styles.root,
          {
            backgroundColor: theme.colors.background,
            paddingTop: insets.top + theme.spacing.sm,
          },
        ]}>
        {header}
        <View style={[styles.body, contentStyle]}>{children}</View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + theme.spacing.sm,
        },
      ]}>
      {header}
      <ScrollView
        style={styles.body}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: theme.spacing.xxl * 2 },
          contentStyle,
        ]}
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  headerText: {
    flexShrink: 1,
  },
  title: {},
  subtitle: {
    marginTop: 2,
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
});
