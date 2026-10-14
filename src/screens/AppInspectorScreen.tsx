import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenContainer } from '../components/ScreenContainer';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { Skeleton } from '../components/Skeleton';
import { useTheme } from '../theme/useTheme';
import { DeviceMonitor } from '../native/DeviceMonitor';
import type {
  AppPermissionSummary,
  AppSortKey,
  AppUsageRow,
  BackgroundAppRow,
} from '../native/types';
import { formatBytesShort, formatDuration } from '../utils/format';

const SORTS: Array<{ key: AppSortKey | 'killable'; label: string }> = [
  { key: 'storage', label: 'Storage' },
  { key: 'usage', label: 'Usage time' },
  { key: 'killable', label: 'Background' },
];

function hueFor(pkg: string): string {
  let h = 0;
  for (let i = 0; i < pkg.length; i++) {
    h = (h * 31 + pkg.charCodeAt(i)) % 360;
  }
  return `hsl(${h}, 55%, 42%)`;
}

function agoShort(ms: number): string {
  if (ms < 60_000) return 'just now';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function AppInspectorScreen() {
  const { theme } = useTheme();
  const [apps, setApps] = useState<AppUsageRow[]>([]);
  const [bgApps, setBgApps] = useState<BackgroundAppRow[]>([]);
  const [perms, setPerms] = useState<AppPermissionSummary | null>(null);
  const [sort, setSort] = useState<AppSortKey | 'killable'>('storage');
  const [ownCache, setOwnCache] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [permissionSummary, cache] = await Promise.all([
      DeviceMonitor.getAppPermissionSummary(),
      DeviceMonitor.getOwnCacheBytes(),
    ]);
    setPerms(permissionSummary);
    setOwnCache(cache);

    if (sort === 'killable') {
      // Real background processes via UsageStats events — fast, no StorageStats.
      const bg = (await DeviceMonitor.getBackgroundApps(40)) ?? [];
      setBgApps(bg);
      setApps([]);
    } else {
      const rows = (await DeviceMonitor.getTopApps(sort, 25)) ?? [];
      setApps(rows);
      setBgApps([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [sort]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const openUsageSettings = () => {
    Linking.sendIntent('android.settings.USAGE_ACCESS_SETTINGS').catch(() => {});
  };

  /**
   * Stop: optimistic removal + immediate success Alert + delayed refresh.
   * The kill binder call is fire-and-forget; we don't block the UI on it.
   */
  const killApp = (app: AppUsageRow | BackgroundAppRow) => {
    Alert.alert(
      `Stop ${app.label}?`,
      'Android will reclaim this app’s background memory. The app is not uninstalled — it restarts when you open it again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop background',
          style: 'destructive',
          onPress: () => {
            // 1. Optimistic removal — instant feedback.
            setApps(prev => prev.filter(a => a.packageName !== app.packageName));
            setBgApps(prev => prev.filter(a => a.packageName !== app.packageName));
            // 2. Immediate success Alert.
            Alert.alert('Stopped', `${app.label} background stopped.`);
            // 3. Fire the binder call; delayed refresh after OS settles.
            DeviceMonitor.killBackgroundApp(app.packageName);
            setTimeout(() => {
              DeviceMonitor.getOwnCacheBytes().then(setOwnCache);
              // Re-fetch in background without blocking the optimistic UI.
              if (sort === 'killable') {
                DeviceMonitor.getBackgroundApps(40).then(bg => {
                  if (bg) setBgApps(bg);
                });
              } else {
                DeviceMonitor.getTopApps(sort, 25).then(rows => {
                  if (rows) setApps(rows);
                });
              }
            }, 1500);
          },
        },
      ],
    );
  };

  /**
   * Cache clear: optimistic zeroing + immediate success Alert + delayed refresh.
   */
  const clearCache = () => {
    Alert.alert(
      'Clear Pulse cache?',
      'Temporary files Pulse created are deleted. Other apps’ caches cannot be cleared by Pulse — Android reserves that for the system (use Cache button on each row).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            // 1. Optimistic zero — button label updates instantly.
            const prevCache = ownCache;
            setOwnCache(0);
            // 2. Immediate success Alert (we already know the intent succeeded
            //    as soon as the user confirmed; the binder call is fire-and-forget).
            if (prevCache != null && prevCache > 0) {
              Alert.alert(
                'Cache cleared',
                `Freed ${formatBytesShort(prevCache)} of Pulse cache.`,
              );
            } else {
              Alert.alert(
                'Cache already empty',
                'Pulse had no temporary cache files to delete.',
              );
            }
            // 3. Fire the binder call; delayed refresh of the real number.
            DeviceMonitor.clearOwnCache();
            setTimeout(() => {
              DeviceMonitor.getOwnCacheBytes().then(freed => {
                if (freed != null) setOwnCache(freed);
              });
            }, 1200);
          },
        },
      ],
    );
  };

  const openOtherCache = (app: AppUsageRow) => {
    DeviceMonitor.openAppStorageSettings(app.packageName);
  };

  return (
    <ScreenContainer
      title="App Inspector"
      subtitle="Footprint, usage time, free RAM & cache"
      right={
        <Pressable
          onPress={clearCache}
          accessibilityRole="button"
          accessibilityLabel="Clear Pulse cache"
          style={({ pressed }) => [
            styles.cacheBtn,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}>
          <Text style={[styles.cacheBtnLabel, { color: theme.colors.warn }]}>
            Clear cache
            {ownCache != null && ownCache > 0
              ? ` ${formatBytesShort(ownCache)}`
              : ''}
          </Text>
        </Pressable>
      }>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={theme.colors.accent}
          />
        }>
        <View style={styles.badgeRow}>
          <StatusBadge
            label={
              perms?.usageAccess
                ? 'Usage Access granted'
                : 'Usage Access not granted'
            }
            tone={perms?.usageAccess ? 'ok' : 'warn'}
          />
          <StatusBadge
            label={
              perms?.storageStatsAvailable
                ? 'Storage stats ready'
                : 'No StorageStats'
            }
            tone={perms?.storageStatsAvailable ? 'info' : 'neutral'}
            dot={false}
          />
        </View>

        {perms != null && !perms.usageAccess && (
          <View
            style={[
              styles.notice,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.warn,
                borderRadius: theme.radius.md,
              },
            ]}>
            <Text
              style={[
                styles.noticeTitle,
                theme.typography.bodyBold,
                { color: theme.colors.warn },
              ]}>
              Enable Usage Access for better rankings
            </Text>
            <Text
              style={[
                styles.noticeBody,
                theme.typography.caption,
                { color: theme.colors.textSecondary },
              ]}>
              Storage sizes work without it. Usage time needs the special Usage
              Access permission — you control it in system settings.
            </Text>
            <Pressable
              onPress={openUsageSettings}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.noticeBtn,
                { backgroundColor: theme.colors.warn, opacity: pressed ? 0.8 : 1 },
              ]}>
              <Text style={styles.noticeBtnLabel}>Open settings</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.sortRow}>
          {SORTS.map(s => {
            const active = s.key === sort;
            return (
              <Pressable
                key={s.key}
                onPress={() => setSort(s.key)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.sortChip,
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
                    styles.sortLabel,
                    {
                      color: active
                        ? theme.colors.accentText
                        : theme.colors.textSecondary,
                    },
                  ]}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.skeletonList}>
            {[0, 1, 2, 3, 4].map(i => (
              <Skeleton key={i} width="100%" height={68} borderRadius={14} />
            ))}
          </View>
        ) : sort === 'killable' ? (
          bgApps.length === 0 ? (
            <EmptyState
              title="No background activity today"
              message={
                perms?.usageAccess
                  ? 'No non-system apps recorded background events today.'
                  : 'Usage Access is required to see real background processes. Grant it in system settings, then pull to refresh.'
              }
            />
          ) : (
            <View
              style={[
                styles.list,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.md,
                },
              ]}>
              {bgApps.map((app, idx) => (
                <View
                  key={app.packageName}
                  style={[
                    styles.appRow,
                    idx < bgApps.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: theme.colors.border,
                    },
                  ]}>
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: hueFor(app.packageName) },
                    ]}
                    accessibilityElementsHidden>
                    <Text style={styles.avatarLetter}>
                      {app.label.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.appText}>
                    <Text
                      style={[
                        styles.appLabel,
                        theme.typography.bodyBold,
                        { color: theme.colors.textPrimary },
                      ]}
                      numberOfLines={1}>
                      {app.label}
                    </Text>
                    <Text
                      style={[
                        styles.appPkg,
                        theme.typography.micro,
                        { color: theme.colors.textTertiary },
                      ]}
                      numberOfLines={1}>
                      {app.packageName}
                    </Text>
                    <View style={styles.appStats}>
                      <Text
                        style={[
                          styles.appStat,
                          theme.typography.micro,
                          {
                            color: app.stillInBackground
                              ? theme.colors.warn
                              : theme.colors.textSecondary,
                          },
                        ]}>
                        {app.stillInBackground
                          ? '● in background'
                          : `bg ${agoShort(app.backgroundAgoMs)}`}
                      </Text>
                      <Text
                        style={[
                          styles.appStat,
                          theme.typography.micro,
                          { color: theme.colors.textSecondary },
                        ]}>
                        · {app.eventCount} events
                      </Text>
                    </View>
                  </View>

                  <View style={styles.rowActions}>
                    <Pressable
                      onPress={() => killApp(app)}
                      accessibilityRole="button"
                      accessibilityLabel={`Stop ${app.label} background`}
                      style={({ pressed }) => [
                        styles.miniBtn,
                        {
                          borderColor: theme.colors.danger,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}>
                      <Text
                        style={[styles.miniBtnLabel, { color: theme.colors.danger }]}>
                        Stop
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        DeviceMonitor.openAppStorageSettings(app.packageName)
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${app.label} storage settings`}
                      style={({ pressed }) => [
                        styles.miniBtn,
                        {
                          borderColor: theme.colors.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.miniBtnLabel,
                          { color: theme.colors.textSecondary },
                        ]}>
                        Cache
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )
        ) : apps.length === 0 ? (
          <EmptyState
            title="No apps found"
            message="Android did not return launcher apps matching this filter."
          />
        ) : (
          <View
            style={[
              styles.list,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.md,
              },
            ]}>
            {apps.map((app, idx) => (
              <View
                key={app.packageName}
                style={[
                  styles.appRow,
                  idx < apps.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.colors.border,
                  },
                ]}>
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: hueFor(app.packageName) },
                  ]}
                  accessibilityElementsHidden>
                  <Text style={styles.avatarLetter}>
                    {app.label.charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.appText}>
                  <Text
                    style={[
                      styles.appLabel,
                      theme.typography.bodyBold,
                      { color: theme.colors.textPrimary },
                    ]}
                    numberOfLines={1}>
                    {app.label}
                  </Text>
                  <Text
                    style={[
                      styles.appPkg,
                      theme.typography.micro,
                      { color: theme.colors.textTertiary },
                    ]}
                    numberOfLines={1}>
                    {app.packageName}
                  </Text>
                  <View style={styles.appStats}>
                    <Text
                      style={[
                        styles.appStat,
                        theme.typography.micro,
                        { color: theme.colors.textSecondary },
                      ]}>
                      {app.totalBytes > 0
                        ? formatBytesShort(app.totalBytes)
                        : 'Size n/a'}
                    </Text>
                    {app.usageMsToday > 0 && (
                      <Text
                        style={[
                          styles.appStat,
                          theme.typography.micro,
                          { color: theme.colors.textSecondary },
                        ]}>
                        · {formatDuration(app.usageMsToday)} fg
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.rowActions}>
                  {!app.isSystem && (
                    <Pressable
                      onPress={() => killApp(app)}
                      accessibilityRole="button"
                      accessibilityLabel={`Stop ${app.label} background`}
                      style={({ pressed }) => [
                        styles.miniBtn,
                        {
                          borderColor: theme.colors.danger,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}>
                      <Text
                        style={[styles.miniBtnLabel, { color: theme.colors.danger }]}>
                        Stop
                      </Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => openOtherCache(app)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${app.label} storage settings`}
                    style={({ pressed }) => [
                      styles.miniBtn,
                      {
                        borderColor: theme.colors.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.miniBtnLabel,
                        { color: theme.colors.textSecondary },
                      ]}>
                      Cache
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

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
            Honest limits
          </Text>
          <Text
            style={[
              styles.cardBody,
              theme.typography.body,
              { color: theme.colors.textSecondary },
            ]}>
            <Text style={styles.strong}>Background</Text> uses
            UsageStatsManager.queryEvents — real foreground/background
            transitions Android recorded today, no StorageStats involved, so it
            loads instantly.{'\n\n'}
            <Text style={styles.strong}>Stop</Text> uses
            ActivityManager.killBackgroundProcesses — it reclaims background
            memory; the app restarts next time you open it.{'\n\n'}
            <Text style={styles.strong}>Cache</Text> for other apps opens the
            system storage page — Android does not let normal apps clear
            another app’s cache. Pulse only clears its own cache directly.{'\n\n'}
            <Text style={styles.strong}>Per-app RAM</Text> is never shown;
            Android does not expose it to regular apps. Usage time is the
            honest proxy for battery impact.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  cacheBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 36,
    justifyContent: 'center',
  },
  cacheBtnLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  notice: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 8,
    marginBottom: 4,
  },
  noticeTitle: {},
  noticeBody: {},
  noticeBtn: {
    alignSelf: 'flex-start',
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeBtnLabel: {
    color: '#1A1A1A',
    fontSize: 13,
    fontWeight: '700',
  },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  sortChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  skeletonList: {
    gap: 8,
  },
  list: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 4,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  appText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  appLabel: {},
  appPkg: {},
  appStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  appStat: {},
  rowActions: {
    gap: 6,
    alignItems: 'flex-end',
  },
  miniBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 30,
    justifyContent: 'center',
  },
  miniBtnLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 8,
    marginTop: 4,
  },
  cardTitle: {},
  cardBody: {},
  strong: {
    fontWeight: '700',
    color: '#F4F4F7',
  },
});
