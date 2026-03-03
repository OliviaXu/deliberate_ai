import { describe, expect, it } from 'vitest';
import type { LearningCycleRecord } from '../../src/shared/types';
import { buildThinkingJournalEntries, filterThinkingJournalEntries, formatJournalTimestamp } from '../../src/thinking-journal/utils/entries';

const NOW_MS = Date.UTC(2026, 2, 3, 12, 0, 0);
const DAY_MS = 24 * 60 * 60 * 1000;

function makeRecord(overrides: Partial<LearningCycleRecord> = {}): LearningCycleRecord {
  const base: LearningCycleRecord = {
    id: '1',
    timestamp: NOW_MS,
    platform: 'gemini',
    threadId: '/app/threads/default',
    mode: 'delegation',
    prompt: 'Draft a response for me'
  };
  return { ...base, ...overrides } as LearningCycleRecord;
}

describe('buildThinkingJournalEntries', () => {
  it('keeps only entries from the last 7 days and sorts newest first', () => {
    const records: LearningCycleRecord[] = [
      makeRecord({ id: 'newest', timestamp: NOW_MS - DAY_MS }),
      makeRecord({
        id: 'problem',
        timestamp: NOW_MS - 2 * DAY_MS,
        mode: 'problem_solving',
        prediction: 'Root cause is a race condition'
      }),
      makeRecord({
        id: 'learning',
        timestamp: NOW_MS - 3 * DAY_MS,
        mode: 'learning',
        priorKnowledgeNote: 'I understand the basics'
      }),
      makeRecord({ id: 'old', timestamp: NOW_MS - 9 * DAY_MS })
    ];

    const entries = buildThinkingJournalEntries(records, NOW_MS);
    expect(entries.map((entry) => entry.id)).toEqual(['newest', 'problem', 'learning']);
  });

  it('maps learning initial context when available', () => {
    const entries = buildThinkingJournalEntries(
      [
        makeRecord({
          id: 'learning',
          mode: 'learning',
          timestamp: NOW_MS,
          priorKnowledgeNote: 'I know OAuth basics'
        })
      ],
      NOW_MS
    );

    expect(entries[0]?.initialContext).toBe('I know OAuth basics');
  });

  it('uses fallback hypothesis when problem-solving prediction is missing', () => {
    const record = makeRecord({
      id: 'problem-missing-prediction',
      mode: 'problem_solving',
      timestamp: NOW_MS
    }) as unknown as LearningCycleRecord;

    delete (record as { prediction?: string }).prediction;

    const entries = buildThinkingJournalEntries([record], NOW_MS);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.mode).toBe('problem_solving');
    expect(entries[0]?.hypothesis).toBe('No hypothesis recorded.');
  });
});

describe('filterThinkingJournalEntries', () => {
  const entries = buildThinkingJournalEntries(
    [
      makeRecord({ id: 'delegation', timestamp: NOW_MS, mode: 'delegation' }),
      makeRecord({
        id: 'problem',
        timestamp: NOW_MS - DAY_MS,
        mode: 'problem_solving',
        prediction: 'Likely a caching bug'
      }),
      makeRecord({ id: 'learning', timestamp: NOW_MS - 2 * DAY_MS, mode: 'learning' })
    ],
    NOW_MS
  );

  it('filters by each supported mode', () => {
    expect(filterThinkingJournalEntries(entries, 'all').map((entry) => entry.id)).toEqual(['delegation', 'problem', 'learning']);
    expect(filterThinkingJournalEntries(entries, 'problem_solving').map((entry) => entry.id)).toEqual(['problem']);
    expect(filterThinkingJournalEntries(entries, 'delegation').map((entry) => entry.id)).toEqual(['delegation']);
    expect(filterThinkingJournalEntries(entries, 'learning').map((entry) => entry.id)).toEqual(['learning']);
  });
});

describe('formatJournalTimestamp', () => {
  it('formats in the expected calm journal style', () => {
    const value = formatJournalTimestamp(Date.UTC(2026, 2, 2, 16, 42, 0), 'en-US', 'UTC');
    expect(value).toBe('Mar 2, 2026 — 4:42 PM');
  });
});
