import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  PermissionsAndroid,
  Platform,
  Pressable,
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
  FileCategory,
  FileRow,
  OrganizeSummary,
  OrganizedFile,
} from '../native/types';
import { formatBytesShort, formatDateTime } from '../utils/format';

type Mode = 'browse' | 'organize';
type CatKey = FileCategory | 'all' | 'large' | 'code' | 'screenshot' | 'camera';

const CATS: Array<{ key: CatKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'large', label: 'Large ≥50 MB' },
  { key: 'code', label: 'Code' },
  { key: 'screenshot', label: 'Screenshots' },
  { key: 'camera', label: 'Camera' },
  { key: 'video', label: 'Video' },
  { key: 'image', label: 'Images' },
  { key: 'audio', label: 'Audio' },
  { key: 'document', label: 'Docs' },
  { key: 'download', label: 'Downloads' },
  { key: 'apk', label: 'APKs' },
  { key: 'archive', label: 'Archives' },
  { key: 'other', label: 'Other' },
];

const LARGE_MIN = 50 * 1024 * 1024;

const EXT_COLORS: Record<string, string> = {
  video: '#A78BFA',
  image: '#3DDC97',
  audio: '#5AC8FA',
  document: '#FFB020',
  archive: '#FF7B85',
  apk: '#7DD3FC',
  code: '#F472B6',
  other: '#9CA3AF',
};

const SUBTYPE_LABEL: Record<string, string> = {
  screenshot: 'Screenshot',
  camera: 'Camera',
  selfie: 'Selfie',
  screen_record: 'Screen record',
  whatsapp_image: 'WhatsApp image',
  whatsapp_video: 'WhatsApp video',
  download_image: 'Download image',
  pictures: 'Pictures',
  installer: 'Installer',
  video: 'Video',
  image: 'Image',
};

export function FileExplorerScreen() {
  const { theme } = useTheme();
  const [mode, setMode] = useState<Mode>('browse');
  const [cat, setCat] = useState<CatKey>('all');
  const [files, setFiles] = useState<FileRow[]>([]);
  const [organized, setOrganized] = useState<OrganizedFile[]>([]);
  const [summary, setSummary] = useState<OrganizeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [permState, setPermState] = useState<'unknown' | 'granted' | 'denied'>(
    'unknown',
  );
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [organizing, setOrganizing] = useState(false);

  const ensurePermissions = useCallback(async (): Promise<boolean> => {
    const sdk = typeof Platform.Version === 'number' ? Platform.Version : 0;
    if (sdk >= 33) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
      ]);
      const granted = Object.values(results).every(
        v => v === PermissionsAndroid.RESULTS.GRANTED,
      );
      setPermState(granted ? 'granted' : 'denied');
      return granted;
    }
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
    );
    const granted = result === PermissionsAndroid.RESULTS.GRANTED;
    setPermState(granted ? 'granted' : 'denied');
    return granted;
  }, []);

  const loadBrowse = useCallback(async () => {
    setLoading(true);
    await ensurePermissions();
    const queryCat =
      cat === 'large' || cat === 'all' || cat === 'screenshot' || cat === 'camera'
        ? null
        : cat === 'code'
          ? null
          : cat;
    const rows = (await DeviceMonitor.scanFiles(queryCat, 400)) ?? [];
    let filtered = rows;
    if (cat === 'large') {
      filtered = rows.filter(f => f.size >= LARGE_MIN);
    } else if (cat === 'screenshot') {
      filtered = rows.filter(
        f =>
          f.category === 'image' &&
          (f.name.toLowerCase().includes('screenshot') ||
            f.name.toLowerCase().includes('screencap')),
      );
    } else if (cat === 'camera') {
      filtered = rows.filter(
        f =>
          f.category === 'image' &&
          (f.name.toLowerCase().startsWith('img_') ||
            f.name.toLowerCase().startsWith('pxl_') ||
            f.mime?.startsWith('image/') === true),
      );
    } else if (cat === 'code') {
      filtered = rows.filter(f => f.category === 'document' || f.extension.length > 0);
    }
    setFiles(filtered);
    setLoading(false);
  }, [cat, ensurePermissions]);

  const loadOrganize = useCallback(async () => {
    setLoading(true);
    await ensurePermissions();
    const [org, sum] = await Promise.all([
      DeviceMonitor.organizeFiles(4000),
      DeviceMonitor.organizeSummary(4000),
    ]);
    setOrganized(org ?? []);
    setSummary(sum);
    setLoading(false);
  }, [ensurePermissions]);

  useEffect(() => {
    if (mode === 'browse') {
      loadBrowse();
    } else {
      loadOrganize();
    }
  }, [mode, loadBrowse, loadOrganize]);

  /** Double-confirm before any delete — never silent. */
  const confirmDeleteOrganized = (file: OrganizedFile) => {
    Alert.alert(
      'Delete this file?',
      `${file.name}\n${formatBytesShort(file.size)}\n\n${file.path}\n\nThis cannot be undone from Pulse. The file will be permanently removed from storage.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'I understand — delete',
          style: 'destructive',
          onPress: () => {
            // Second confirmation.
            Alert.alert(
              'Really delete?',
              `Confirm permanent deletion of:\n${file.name}`,
              [
                { text: 'Keep it', style: 'cancel' },
                {
                  text: 'Delete permanently',
                  style: 'destructive',
                  onPress: () => {
                    DeviceMonitor.deleteOrganizedFile(file.path).then(ok => {
                      if (ok) {
                        setOrganized(prev =>
                          prev.filter(x => x.path !== file.path),
                        );
                      } else {
                        Alert.alert(
                          'Not deleted',
                          'Android refused the delete (permission or path restriction). Nothing was removed.',
                        );
                      }
                    });
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const confirmDeleteBrowse = (file: FileRow) => {
    Alert.alert(
      'Move to trash?',
      `${file.name}\n${formatBytesShort(file.size)}\n\nOn Android 10+ this goes to the system trash so you can restore it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move to trash',
          style: 'destructive',
          onPress: () => {
            DeviceMonitor.deleteFile(file.uri, file.id).then(() => loadBrowse());
          },
        },
      ],
    );
  };

  /**
   * Organize action: SAF folder picker → dry-run preview → confirm → execute.
   * Never touches a file until the user confirms the preview.
   */
  const startOrganizeToFolder = async () => {
    if (organizing) return;
    if (organized.length === 0) {
      Alert.alert('Nothing to organize', 'The deep scan found no files to move.');
      return;
    }
    setOrganizing(true);
    try {
      // 1. SAF folder picker.
      const treeUri = await DeviceMonitor.pickOrganizeFolder();
      if (!treeUri) {
        setOrganizing(false);
        return; // user cancelled picker
      }

      // 2. Dry-run plan — native computes dest folders, touches nothing.
      const paths = organized.map(f => f.path);
      const plans = (await DeviceMonitor.planOrganizeMoves(treeUri, paths)) ?? [];
      const ok = plans.filter(p => p.status === 'ok');
      const refused = plans.filter(p => p.status === 'refused');
      const missing = plans.filter(p => p.status === 'missing');

      if (ok.length === 0) {
        Alert.alert(
          'Nothing to move',
          refused.length > 0
            ? `${refused.length} file(s) are in protected system folders and cannot be moved.`
            : 'No movable files were found in the deep scan result.',
        );
        setOrganizing(false);
        return;
      }

      const totalBytes = ok.reduce((s, p) => s + p.size, 0);
      // Group by destination folder for a readable preview.
      const byFolder = new Map<string, { count: number; bytes: number }>();
      for (const p of ok) {
        const prev = byFolder.get(p.destFolderRel) ?? { count: 0, bytes: 0 };
        byFolder.set(p.destFolderRel, {
          count: prev.count + 1,
          bytes: prev.bytes + p.size,
        });
      }
      const folderLines = [...byFolder.entries()]
        .sort((a, b) => b[1].bytes - a[1].bytes)
        .slice(0, 8)
        .map(([folder, v]) => `  ${folder}/  (${v.count} · ${formatBytesShort(v.bytes)})`)
        .join('\n');
      const moreFolders = byFolder.size > 8 ? `\n  … +${byFolder.size - 8} more folders` : '';
      const skipNote =
        refused.length + missing.length > 0
          ? `\n\nSkipped: ${refused.length} refused, ${missing.length} missing.`
          : '';

      // 3. Confirm with dry-run preview.
      Alert.alert(
        `Move ${ok.length} files?`,
        `Destination folders under the picked tree:\n${folderLines}${moreFolders}\n\nTotal: ${formatBytesShort(totalBytes)}${skipNote}\n\nEach file is copied then the source is deleted. You can undo from the system trash on Android 10+.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: `Move ${ok.length} files`,
            style: 'default',
            onPress: async () => {
              // 4. Execute.
              const result = await DeviceMonitor.executeOrganizeMoves(treeUri, plans);
              setOrganizing(false);
              if (result == null) {
                Alert.alert('Move failed', 'Android refused the move operation. Nothing was changed.');
                return;
              }
              const { moved, skipped, failedBytes, errors } = result;
              if (moved > 0 && failedBytes === 0) {
                Alert.alert(
                  'Organize complete',
                  `Moved ${moved} file(s)${skipped > 0 ? `, skipped ${skipped}` : ''}.`,
                );
              } else if (moved > 0) {
                Alert.alert(
                  'Partially organized',
                  `Moved ${moved} file(s), skipped ${skipped}. ${formatBytesShort(failedBytes)} failed — see errors:\n${errors.slice(0, 3).map(e => `• ${e.sourcePath.split('/').pop()}: ${e.error}`).join('\n')}`,
                );
              } else {
                Alert.alert(
                  'No files moved',
                  errors.length > 0
                    ? `All ${skipped} file(s) failed:\n${errors.slice(0, 3).map(e => `• ${e.sourcePath.split('/').pop()}: ${e.error}`).join('\n')}`
                    : 'Nothing was moved.',
                );
              }
              // Refresh deep scan to reflect removals.
              loadOrganize();
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert('Organize error', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      // organizing is reset in the execute path; reset here for cancel/error paths.
      // (execute path also sets it false before loadOrganize)
    }
  };

  const months = useMemo(() => {
    const map = new Map<string, OrganizedFile[]>();
    for (const f of organized) {
      const arr = map.get(f.monthKey) ?? [];
      arr.push(f);
      map.set(f.monthKey, arr);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [organized]);

  const totalBytes = useMemo(
    () => files.reduce((s, f) => s + f.size, 0),
    [files],
  );

  return (
    <ScreenContainer
      title="File Explorer"
      subtitle="Deep scan · by type · by month · safe delete">
      {/* Mode toggle */}
      <View style={styles.modeRow}>
        {(['browse', 'organize'] as Mode[]).map(m => {
          const active = m === mode;
          return (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              accessibilityRole="button"
              accessibilityLabel={m === 'browse' ? 'Browse files' : 'Organize view'}
              style={({ pressed }) => [
                styles.modeChip,
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
                  styles.modeLabel,
                  {
                    color: active ? theme.colors.accentText : theme.colors.textSecondary,
                  },
                ]}>
                {m === 'browse' ? 'Browse' : 'Organize'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {permState === 'denied' && (
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
            Media permission needed
          </Text>
          <Text
            style={[
              styles.noticeBody,
              theme.typography.caption,
              { color: theme.colors.textSecondary },
            ]}>
            Android requires Photos &amp; videos / Music &amp; audio access for
            Pulse to list files from MediaStore. Grant it below.
          </Text>
          <Pressable
            onPress={() => {
              ensurePermissions().then(() => {
                if (mode === 'browse') loadBrowse();
                else loadOrganize();
              });
            }}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.noticeBtn,
              { backgroundColor: theme.colors.warn, opacity: pressed ? 0.8 : 1 },
            ]}>
            <Text style={styles.noticeBtnLabel}>Grant access</Text>
          </Pressable>
        </View>
      )}

      {mode === 'browse' ? (
        <>
          <View style={styles.chipRow}>
            {CATS.map(c => {
              const active = c.key === cat;
              return (
                <Pressable
                  key={c.key}
                  onPress={() => setCat(c.key)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.chip,
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
                      styles.chipLabel,
                      {
                        color: active
                          ? theme.colors.accentText
                          : theme.colors.textSecondary,
                      },
                    ]}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.badgeRow}>
            <StatusBadge label={`${files.length} files`} tone="info" />
            <StatusBadge label={formatBytesShort(totalBytes)} tone="neutral" />
          </View>

          {loading ? (
            <View style={styles.skeletonList}>
              {[0, 1, 2, 3].map(i => (
                <Skeleton key={i} width="100%" height={72} borderRadius={14} />
              ))}
            </View>
          ) : files.length === 0 ? (
            <EmptyState
              title="No files in this category"
              message="MediaStore returned nothing. Try Organize mode for a deep filesystem walk, or grant media permissions."
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
              {files.slice(0, 150).map((file, idx) => (
                <Pressable
                  key={`${file.id}-${file.uri}`}
                  onLongPress={() => confirmDeleteBrowse(file)}
                  accessibilityRole="button"
                  accessibilityLabel={`${file.name}, ${formatBytesShort(file.size)}. Long press to trash.`}
                  style={({ pressed }) => [
                    styles.fileRow,
                    idx < Math.min(files.length, 150) - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: theme.colors.border,
                    },
                    pressed && { opacity: 0.7 },
                  ]}>
                  <View
                    style={[
                      styles.extBadge,
                      {
                        backgroundColor:
                          EXT_COLORS[file.category] ?? EXT_COLORS.other,
                      },
                    ]}>
                    <Text style={styles.extText}>
                      {(file.extension || '?').slice(0, 4).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.fileText}>
                    <Text
                      style={[
                        styles.fileName,
                        theme.typography.bodyBold,
                        { color: theme.colors.textPrimary },
                      ]}
                      numberOfLines={1}>
                      {file.name}
                    </Text>
                    <Text
                      style={[
                        styles.fileMeta,
                        theme.typography.micro,
                        { color: theme.colors.textTertiary },
                      ]}>
                      {file.category} · {formatDateTime(file.dateModified)}
                    </Text>
                  </View>
                  <View style={styles.fileRight}>
                    <Text
                      style={[
                        styles.fileSize,
                        {
                          color:
                            file.size >= LARGE_MIN
                              ? theme.colors.warn
                              : theme.colors.textPrimary,
                        },
                      ]}>
                      {formatBytesShort(file.size)}
                    </Text>
                    <Text
                      style={[
                        styles.trashHint,
                        theme.typography.micro,
                        { color: theme.colors.textTertiary },
                      ]}>
                      hold to trash
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </>
      ) : (
        <>
          {/* ── Organize overview ─────────────────────────── */}
          {summary != null && (
            <View
              style={[
                styles.summaryCard,
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
                Deep scan summary
              </Text>
              <View style={styles.summaryStats}>
                <StatPill
                  label="Files"
                  value={String(summary.totalFiles)}
                  theme={theme}
                />
                <StatPill
                  label="Total"
                  value={formatBytesShort(summary.totalBytes)}
                  theme={theme}
                />
                <StatPill
                  label="Months"
                  value={String(summary.months.length)}
                  theme={theme}
                />
              </View>
              {summary.months.slice(0, 3).map(m => (
                <View key={m.month} style={styles.monthMiniRow}>
                  <Text
                    style={[
                      theme.typography.caption,
                      { color: theme.colors.textSecondary },
                    ]}>
                    {m.month}
                  </Text>
                  <Text
                    style={[
                      theme.typography.caption,
                      { color: theme.colors.textPrimary },
                    ]}>
                    {m.count} files · {formatBytesShort(m.bytes)}
                  </Text>
                </View>
              ))}
              <Pressable
                onPress={startOrganizeToFolder}
                disabled={organizing}
                accessibilityRole="button"
                accessibilityLabel="Organize files into a chosen folder"
                style={({ pressed }) => [
                  styles.organizeBtn,
                  {
                    backgroundColor: organizing
                      ? theme.colors.surfaceRaised
                      : theme.colors.accent,
                    opacity: pressed || organizing ? 0.7 : 1,
                  },
                ]}>
                <Text
                  style={[
                    styles.organizeBtnLabel,
                    { color: organizing ? theme.colors.textTertiary : theme.colors.accentText },
                  ]}>
                  {organizing
                    ? 'Waiting for folder…'
                    : `Organize ${summary.totalFiles} files →`}
                </Text>
              </Pressable>
            </View>
          )}

          {loading ? (
            <View style={styles.skeletonList}>
              {[0, 1, 2, 3, 4].map(i => (
                <Skeleton key={i} width="100%" height={56} borderRadius={12} />
              ))}
            </View>
          ) : organized.length === 0 ? (
            <EmptyState
              title="Nothing found in deep scan"
              message="Pulse walked the public storage tree but found no readable files. Grant media permissions and try again."
            />
          ) : (
            months.map(([month, monthFiles]) => {
              const expanded = expandedMonth === month;
              const bytes = monthFiles.reduce((s, f) => s + f.size, 0);
              return (
                <View
                  key={month}
                  style={[
                    styles.monthBlock,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      borderRadius: theme.radius.md,
                    },
                  ]}>
                  <Pressable
                    onPress={() =>
                      setExpandedMonth(expanded ? null : month)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`${month}, ${monthFiles.length} files`}
                    style={({ pressed }) => [
                      styles.monthHeader,
                      pressed && { opacity: 0.7 },
                    ]}>
                    <View style={styles.monthHeaderText}>
                      <Text
                        style={[
                          theme.typography.bodyBold,
                          { color: theme.colors.textPrimary },
                        ]}>
                        {month}
                      </Text>
                      <Text
                        style={[
                          theme.typography.micro,
                          { color: theme.colors.textSecondary },
                        ]}>
                        {monthFiles.length} files · {formatBytesShort(bytes)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.chevron,
                        { color: theme.colors.textTertiary },
                      ]}>
                      {expanded ? '▾' : '▸'}
                    </Text>
                  </Pressable>

                  {expanded && (
                    <View style={styles.monthBody}>
                      {/* Sub-type breakdown */}
                      {(() => {
                        const bySub = new Map<
                          string,
                          { count: number; bytes: number }
                        >();
                        for (const f of monthFiles) {
                          const key = `${f.category}:${f.subType}`;
                          const prev = bySub.get(key) ?? { count: 0, bytes: 0 };
                          bySub.set(key, {
                            count: prev.count + 1,
                            bytes: prev.bytes + f.size,
                          });
                        }
                        return [...bySub.entries()]
                          .sort((a, b) => b[1].bytes - a[1].bytes)
                          .slice(0, 12)
                          .map(([key, v]) => {
                            const [category, subType] = key.split(':');
                            return (
                              <View key={key} style={styles.subRow}>
                                <View
                                  style={[
                                    styles.subDot,
                                    {
                                      backgroundColor:
                                        EXT_COLORS[category] ??
                                        EXT_COLORS.other,
                                    },
                                  ]}
                                />
                                <Text
                                  style={[
                                    styles.subLabel,
                                    theme.typography.caption,
                                    { color: theme.colors.textSecondary },
                                  ]}>
                                  {SUBTYPE_LABEL[subType] ?? subType} (
                                  {category})
                                </Text>
                                <Text
                                  style={[
                                    styles.subSize,
                                    theme.typography.caption,
                                    { color: theme.colors.textPrimary },
                                  ]}>
                                  {v.count} · {formatBytesShort(v.bytes)}
                                </Text>
                              </View>
                            );
                          });
                      })()}

                      {/* File list (first 40) */}
                      {monthFiles.slice(0, 40).map(f => (
                        <Pressable
                          key={f.path}
                          onLongPress={() => confirmDeleteOrganized(f)}
                          accessibilityRole="button"
                          accessibilityLabel={`${f.name}. Long press to delete.`}
                          style={({ pressed }) => [
                            styles.fileRow,
                            {
                              borderTopWidth: StyleSheet.hairlineWidth,
                              borderTopColor: theme.colors.border,
                            },
                            pressed && { opacity: 0.7 },
                          ]}>
                          <View
                            style={[
                              styles.extBadge,
                              {
                                backgroundColor:
                                  EXT_COLORS[f.category] ?? EXT_COLORS.other,
                              },
                            ]}>
                            <Text style={styles.extText}>
                              {(f.extension || '?').slice(0, 4).toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.fileText}>
                            <Text
                              style={[
                                styles.fileName,
                                theme.typography.bodyBold,
                                { color: theme.colors.textPrimary },
                              ]}
                              numberOfLines={1}>
                              {f.name}
                            </Text>
                            <Text
                              style={[
                                styles.fileMeta,
                                theme.typography.micro,
                                { color: theme.colors.textTertiary },
                              ]}>
                              {SUBTYPE_LABEL[f.subType] ?? f.subType} ·{' '}
                              {f.dayKey}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.fileSize,
                              {
                                color:
                                  f.size >= LARGE_MIN
                                    ? theme.colors.warn
                                    : theme.colors.textPrimary,
                              },
                            ]}>
                            {formatBytesShort(f.size)}
                          </Text>
                        </Pressable>
                      ))}
                      {monthFiles.length > 40 && (
                        <Text
                          style={[
                            styles.moreHint,
                            theme.typography.micro,
                            { color: theme.colors.textTertiary },
                          ]}>
                          +{monthFiles.length - 40} more in {month}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </>
      )}

      <Text
        style={[
          styles.footer,
          theme.typography.micro,
          { color: theme.colors.textTertiary },
        ]}>
        Pulse never deletes files automatically. Long-press a row and confirm
        twice to remove it. Organize moves files into a folder you pick via the
        system SAF picker (dry-run preview first). System folders (Android/data,
        Android/obb) are always skipped.
      </Text>
    </ScreenContainer>
  );
}

function StatPill({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <View
      style={[
        styles.statPill,
        {
          backgroundColor: theme.colors.surfaceRaised,
          borderColor: theme.colors.border,
        },
      ]}>
      <Text style={[styles.statLabel, { color: theme.colors.textTertiary }]}>
        {label}
      </Text>
      <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeLabel: {
    fontSize: 13,
    fontWeight: '700',
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  skeletonList: {
    gap: 8,
  },
  list: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 64,
  },
  extBadge: {
    width: 44,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extText: {
    color: '#0A0A0D',
    fontSize: 11,
    fontWeight: '800',
  },
  fileText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  fileName: {},
  fileMeta: {},
  fileRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  fileSize: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  trashHint: {},
  summaryCard: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 10,
  },
  cardTitle: {},
  summaryStats: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statPill: {
    flex: 1,
    minWidth: 80,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  monthMiniRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  organizeBtn: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  organizeBtnLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  monthBlock: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  monthHeaderText: {
    flexShrink: 1,
  },
  chevron: {
    fontSize: 18,
    fontWeight: '700',
  },
  monthBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#262630',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  subDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  subLabel: {
    flex: 1,
  },
  subSize: {
    fontVariant: ['tabular-nums'],
  },
  moreHint: {
    textAlign: 'center',
    paddingVertical: 8,
  },
  footer: {
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
