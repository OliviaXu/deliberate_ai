import type { ThinkingJournalEntryRecord } from './entry-record';

const CSV_HEADER = [
  'entry_timestamp_iso',
  'mode',
  'prompt',
  'starting_point',
  'reflection_timestamp_iso',
  'surprise_score',
  'reflection_notes'
];

export function buildThinkingJournalExportCsv(rows: ThinkingJournalEntryRecord[]): string {
  const lines = [
    CSV_HEADER.join(','),
    ...rows.map((row) =>
      [
        toIso(row.timestamp),
        row.mode,
        row.prompt,
        row.startingPoint ?? '',
        row.reflection ? toIso(row.reflection.timestamp) : '',
        row.reflection ? String(row.reflection.score) : '',
        row.reflection?.notes ?? ''
      ]
        .map(escapeCsvValue)
        .join(',')
    )
  ];

  return lines.join('\n');
}

export function buildThinkingJournalExportFilename(now = new Date()): string {
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `thinking-journal-history-${year}-${month}-${day}.csv`;
}

function toIso(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function escapeCsvValue(value: string): string {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}
