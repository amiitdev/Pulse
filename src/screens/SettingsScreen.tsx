import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { ScreenContainer } from '../components/ScreenContainer';
import { StatusBadge } from '../components/StatusBadge';
import { useTheme } from '../theme/useTheme';
import {
  loadSettings,
  saveSettings,
  PulseSettings,
  SAMPLING_OPTIONS,
  RETENTION_OPTIONS,
} from '../services/settingsStore';
import { samplingService } from '../services/samplingService';
import { exportAndShare } from '../services/exportService';
import { countSamples } from '../database/repository';

export function SettingsScreen() {
  const { theme } = useTheme();
  const [settings, setSettings] = useState<PulseSettings | null>(null);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    loadSettings().then(setSettings);
    countSamples().then(setCount);
  }, []);

  const update = async (patch: Partial<PulseSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    await saveSettings(next);
    if (patch.samplingIntervalMs != null) {
      samplingService.restart(patch.samplingIntervalMs);
    }
    if (patch.retentionMs != null && patch.retentionMs > 0) {
      countSamples().then(setCount);
    }
  };

  if (settings == null) {
    return (
      <ScreenContainer title="Settings" subtitle="Loading…">
        <Text style={{ color: theme.colors.textSecondary }}>…</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      title="Settings"
      subtitle="Sampling, retention, theme, about">
      {/* ── Sampling ─────────────────────────────────────── */}
      <Section title="Historical sampling" theme={theme}>
        <Text
          style={[
            styles.hint,
            theme.typography.caption,
            { color: theme.colors.textSecondary },
          ]}>
          How often a row is written to local SQLite while the app is open.
          Background WorkManager capture is not enabled by default (battery).
        </Text>
        <View style={styles.optionRow}>
          {SAMPLING_OPTIONS.map(opt => {
            const active = opt.value === settings.samplingIntervalMs;
            return (
              <Pressable
                key={opt.value}
                onPress={() => update({ samplingIntervalMs: opt.value })}
                accessibilityRole="button"
                accessibilityLabel={`Sample every ${opt.label}`}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: active
                      ? theme.colors.accent
                      : theme.colors.surfaceRaised,
                    borderColor: active
                      ? theme.colors.accent
                      : theme.colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}>
                <Text
                  style={[
                    styles.optionLabel,
                    {
                      color: active
                        ? theme.colors.accentText
                        : theme.colors.textSecondary,
                    },
                  ]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <StatusBadge
          label={
            samplingService.state === 'running'
              ? `Sampling active · ${count ?? 0} rows`
              : samplingService.state === 'paused'
                ? 'Paused (app backgrounded)'
                : 'Stopped'
          }
          tone={
            samplingService.state === 'running'
              ? 'ok'
              : samplingService.state === 'paused'
                ? 'warn'
                : 'neutral'
          }
        />
      </Section>

      {/* ── Retention ────────────────────────────────────── */}
      <Section title="History retention" theme={theme}>
        <Text
          style={[
            styles.hint,
            theme.typography.caption,
            { color: theme.colors.textSecondary },
          ]}>
          Samples older than this window are eligible for automatic deletion.
          You can always delete everything from History.
        </Text>
        <View style={styles.optionRow}>
          {RETENTION_OPTIONS.map(opt => {
            const active = opt.value === settings.retentionMs;
            return (
              <Pressable
                key={opt.value}
                onPress={() => update({ retentionMs: opt.value })}
                accessibilityRole="button"
                accessibilityLabel={`Keep ${opt.label}`}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: active
                      ? theme.colors.accent
                      : theme.colors.surfaceRaised,
                    borderColor: active
                      ? theme.colors.accent
                      : theme.colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}>
                <Text
                  style={[
                    styles.optionLabel,
                    {
                      color: active
                        ? theme.colors.accentText
                        : theme.colors.textSecondary,
                    },
                  ]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      {/* ── Theme ────────────────────────────────────────── */}
      <Section title="Appearance" theme={theme}>
        <View style={styles.rowBetween}>
          <View style={styles.rowTextBlock}>
            <Text
              style={[
                theme.typography.bodyBold,
                { color: theme.colors.textPrimary },
              ]}>
              Dark (AMOLED) theme
            </Text>
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.textSecondary },
              ]}>
              Deep charcoal with coral accents. Light theme is available as a
              fallback palette.
            </Text>
          </View>
          <Switch
            value={settings.theme === 'dark'}
            onValueChange={v => update({ theme: v ? 'dark' : 'light' })}
            trackColor={{
              false: theme.colors.track,
              true: theme.colors.accent,
            }}
            thumbColor="#FFFFFF"
            accessibilityLabel="Dark theme"
          />
        </View>
        {settings.theme === 'light' && (
          <StatusBadge
            label="Light palette selected — screens currently render dark until Phase 7 theme wiring is complete on every screen."
            tone="warn"
            dot={false}
          />
        )}
      </Section>

      {/* ── Export ───────────────────────────────────────── */}
      <Section title="Export & share" theme={theme}>
        <Text
          style={[
            styles.hint,
            theme.typography.caption,
            { color: theme.colors.textSecondary },
          ]}>
          Export the last 24 hours of local samples. Nothing is uploaded —
          the share sheet hands the file to whatever app you choose.
        </Text>
        <View style={styles.optionRow}>
          <Pressable
            onPress={() => {
              const to = Date.now();
              exportAndShare('csv', to - 24 * 3600_000, to).catch(e =>
                Alert.alert('Export failed', String(e)),
              );
            }}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: theme.colors.accent,
                opacity: pressed ? 0.8 : 1,
              },
            ]}>
            <Text style={[styles.optionLabel, { color: theme.colors.accentText }]}>
              Share CSV
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              const to = Date.now();
              exportAndShare('json', to - 24 * 3600_000, to).catch(e =>
                Alert.alert('Export failed', String(e)),
              );
            }}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: theme.colors.surfaceRaised,
                borderColor: theme.colors.border,
                borderWidth: StyleSheet.hairlineWidth,
                opacity: pressed ? 0.8 : 1,
              },
            ]}>
            <Text style={[styles.optionLabel, { color: theme.colors.textPrimary }]}>
              Share JSON
            </Text>
          </Pressable>
        </View>
      </Section>

      {/* ── Privacy / about ──────────────────────────────── */}
      <Section title="Privacy" theme={theme}>
        <Text
          style={[
            styles.hint,
            theme.typography.body,
            { color: theme.colors.textSecondary },
          ]}>
          Pulse has no account, no cloud backend and no analytics. History
          lives in a local SQLite database on this device. Nothing is uploaded
          unless you explicitly share an export.
        </Text>
      </Section>

      <Section title="About" theme={theme}>
        <Text
          style={[
            styles.hint,
            theme.typography.caption,
            { color: theme.colors.textSecondary },
          ]}>
          Pulse · v0.1.0 (Phase 5–7)
          {'\n'}
          React Native 0.87 · Kotlin native modules · SQLite
          {'\n'}
          Package com.pulse · minSdk 24 · targetSdk 36
        </Text>
      </Section>
    </ScreenContainer>
  );
}

function Section({
  title,
  theme,
  children,
}: {
  title: string;
  theme: ReturnType<typeof useTheme>['theme'];
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.section,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
        },
      ]}>
      <Text
        style={[
          styles.sectionTitle,
          theme.typography.bodyBold,
          { color: theme.colors.textPrimary },
        ]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {},
  hint: {},
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 40,
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowTextBlock: {
    flexShrink: 1,
  },
});
