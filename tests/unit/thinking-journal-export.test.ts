import { describe, expect, it } from 'vitest';
import type { ThinkingJournalEntryRecord } from '../../src/thinking-journal/utils/history';
import { buildThinkingJournalExportCsv, buildThinkingJournalExportFilename } from '../../src/thinking-journal/utils/export';

function makeRow(overrides: Partial<ThinkingJournalEntryRecord> = {}): ThinkingJournalEntryRecord {
  return {
    id: 'row-1',
    timestamp: Date.UTC(2026, 2, 2, 16, 42, 0),
    mode: 'learning',
    prompt: 'Explain OAuth PKCE simply.',
    ...(overrides.startingPoint !== undefined ? { startingPoint: overrides.startingPoint } : { startingPoint: 'I know "basic", OAuth' }),
    reflection: {
      timestamp: Date.UTC(2026, 2, 3, 9, 15, 0),
      score: 75,
      notes: 'Line one\nLine "two", with comma'
    },
    ...overrides
  };
}

describe('buildThinkingJournalExportCsv', () => {
  it('emits the expected header and escapes CSV values', () => {
    const csv = buildThinkingJournalExportCsv([
      makeRow(),
      {
        id: 'row-2',
        timestamp: Date.UTC(2026, 2, 2, 16, 42, 0),
        mode: 'delegation',
        prompt: 'Draft a short update'
      }
    ]);

    expect(csv).toContain(
      'entry_timestamp_iso,mode,prompt,starting_point,reflection_timestamp_iso,surprise_score,reflection_notes'
    );
    expect(csv).toContain('"I know ""basic"", OAuth"');
    expect(csv).toContain('"Line one\nLine ""two"", with comma"');
    expect(csv).toContain('2026-03-02T16:42:00.000Z,delegation,Draft a short update,,,,');
  });
});

describe('buildThinkingJournalExportFilename', () => {
  it('uses the local date in the expected filename shape', () => {
    const filename = buildThinkingJournalExportFilename(new Date(2026, 3, 4, 9, 30, 0));
    expect(filename).toBe('thinking-journal-history-2026-04-04.csv');
  });
});
