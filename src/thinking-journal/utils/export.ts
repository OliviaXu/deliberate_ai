import type { ThinkingJournalEntryRecord } from './entry-record';

const CSV_HEADER = [
  'entry_timestamp_iso',
  'mode',
  'prompt',
  'url',
  'starting_point',
  'reflection_timestamp_iso',
  'surprise_score',
  'reflection_notes'
];

export function buildThinkingJournalExportCsv(rows: ThinkingJournalEntryRecord[]): string {
  const lines = [CSV_HEADER.join(',')];

  for (const row of [...rows].sort((a, b) => b.occurredAt - a.occurredAt)) {
    const reflections = row.reflections.length > 0
      ? [...row.reflections].sort((a, b) => a.occurredAt - b.occurredAt)
      : [undefined];

    for (const reflection of reflections) {
      lines.push([
        toIso(row.occurredAt),
        row.mode,
        row.prompt,
        row.url ?? '',
        row.startingPoint ?? '',
        reflection ? toIso(reflection.occurredAt) : '',
        reflection ? String(reflection.score) : '',
        reflection?.notes ?? ''
      ]
        .map(escapeCsvValue)
        .join(','));
    }
  }

  return lines.join('\n');
}

export function buildThinkingJournalExportFilename(now = new Date()): string {
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `thinking-journal-history-${year}-${month}-${day}.csv`;
}

function toIso(occurredAt: number): string {
  return new Date(occurredAt).toISOString();
}

function escapeCsvValue(value: string): string {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}
