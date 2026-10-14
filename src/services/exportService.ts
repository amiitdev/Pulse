/** CSV / JSON export of local samples (spec §11, §17). */

import { Share } from 'react-native';
import { queryRange } from '../database/repository';
import { formatDateTime } from '../utils/format';

const HEADER =
  'bucket_start_ms,iso_time,ram_util_pct,battery_pct,storage_used_pct,samples_in_bucket';

export async function buildCsv(fromTs: number, toTs: number): Promise<string> {
  const rows = await queryRange(fromTs, toTs, 2000);
  if (rows == null) {
    throw new Error('Could not read local history (native module unavailable).');
  }
  const lines = [HEADER];
  for (const r of rows) {
    lines.push(
      [
        r.ts,
        new Date(r.ts).toISOString(),
        r.ramPct != null ? r.ramPct.toFixed(2) : '',
        r.batPct != null ? r.batPct.toFixed(2) : '',
        r.stoPct != null ? r.stoPct.toFixed(2) : '',
        r.n,
      ].join(','),
    );
  }
  return lines.join('\n');
}

export async function buildJson(fromTs: number, toTs: number): Promise<string> {
  const rows = await queryRange(fromTs, toTs, 2000);
  if (rows == null) {
    throw new Error('Could not read local history (native module unavailable).');
  }
  return JSON.stringify(
    {
      app: 'Pulse',
      exportedAt: new Date().toISOString(),
      from: formatDateTime(fromTs),
      to: formatDateTime(toTs),
      note:
        'Percentages are bucketed averages from local SQLite. No data left the device until you shared this file.',
      samples: rows,
    },
    null,
    2,
  );
}

export async function shareText(
  content: string,
  filename: string,
): Promise<void> {
  await Share.share({ message: content, title: filename });
}

export async function exportAndShare(
  format: 'csv' | 'json',
  fromTs: number,
  toTs: number,
): Promise<void> {
  const content =
    format === 'csv'
      ? await buildCsv(fromTs, toTs)
      : await buildJson(fromTs, toTs);
  await shareText(content, `pulse-history.${format}`);
}
