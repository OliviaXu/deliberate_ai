import { describe, expect, it } from 'vitest';
import type { ThinkingJournalEntryRecord } from '../../src/thinking-journal/utils/entry-record';
import { buildThinkingJournalExportCsv, buildThinkingJournalExportFilename } from '../../src/thinking-journal/utils/export';

function makeRow(overrides: Partial<ThinkingJournalEntryRecord> = {}): ThinkingJournalEntryRecord {
  return {
    id: 'row-1',
    timestamp: Date.UTC(2026, 2, 2, 16, 42, 0),
    mode: 'learning',
    prompt: 'Explain OAuth PKCE simply.',
    ...(overrides.startingPoint !== undefined ? { startingPoint: overrides.startingPoint } : { startingPoint: 'I know "basic", OAuth' }),
    reflections: [{
      timestamp: Date.UTC(2026, 2, 3, 9, 15, 0),
      score: 75,
      notes: 'Line one\nLine "two", with comma'
    }],
    ...overrides
  };
}

describe('buildThinkingJournalExportCsv', () => {
  it('emits the expected header and escapes CSV values', () => {
    const csv = buildThinkingJournalExportCsv([
      makeRow({ url: 'https://gemini.google.com/app/threads/thread-123' }),
      {
        id: 'row-2',
        timestamp: Date.UTC(2026, 2, 2, 16, 42, 0),
        mode: 'delegation',
        prompt: 'Draft a short update',
        reflections: []
      }
    ]);

    expect(csv).toContain(
      'entry_timestamp_iso,mode,prompt,url,starting_point,reflection_timestamp_iso,surprise_score,reflection_notes'
    );
    expect(csv).toContain('https://gemini.google.com/app/threads/thread-123');
    expect(csv).toContain('"I know ""basic"", OAuth"');
    expect(csv).toContain('"Line one\nLine ""two"", with comma"');
    expect(csv).toContain('2026-03-02T16:42:00.000Z,delegation,Draft a short update,,,,,');
  });

  it('exports one row per reflection with newest entries first and each reflection history oldest first', () => {
    const csv = buildThinkingJournalExportCsv([
      {
        id: 'older-entry',
        timestamp: Date.UTC(2026, 2, 1, 8, 0, 0),
        mode: 'delegation',
        prompt: 'Older entry',
        reflections: []
      },
      {
        id: 'newest-entry',
        timestamp: Date.UTC(2026, 2, 5, 8, 0, 0),
        mode: 'learning',
        prompt: 'Newest entry',
        reflections: [
          {
            timestamp: Date.UTC(2026, 2, 7, 9, 0, 0),
            score: 100,
            notes: 'Second reflection'
          },
          {
            timestamp: Date.UTC(2026, 2, 6, 9, 0, 0),
            score: 25,
            notes: 'First reflection'
          }
        ]
      }
    ]);

    expect(csv.split('\n')).toEqual([
      'entry_timestamp_iso,mode,prompt,url,starting_point,reflection_timestamp_iso,surprise_score,reflection_notes',
      '2026-03-05T08:00:00.000Z,learning,Newest entry,,,2026-03-06T09:00:00.000Z,25,First reflection',
      '2026-03-05T08:00:00.000Z,learning,Newest entry,,,2026-03-07T09:00:00.000Z,100,Second reflection',
      '2026-03-01T08:00:00.000Z,delegation,Older entry,,,,,'
    ]);
  });
});

describe('buildThinkingJournalExportFilename', () => {
  it('uses the local date in the expected filename shape', () => {
    const filename = buildThinkingJournalExportFilename(new Date(2026, 3, 4, 9, 30, 0));
    expect(filename).toBe('thinking-journal-history-2026-04-04.csv');
  });
});
