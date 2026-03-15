import { describe, expect, it } from 'vitest';
import type { LearningCycleRecord, ReflectionRecord } from '../../src/shared/types';
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

function makeReflection(overrides: Partial<ReflectionRecord> = {}): ReflectionRecord {
  return {
    id: 'reflection-1',
    timestamp: NOW_MS,
    threadId: '/app/threads/default',
    status: 'completed',
    score: 75,
    ...overrides
  };
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

    const entries = buildThinkingJournalEntries(records, [], NOW_MS);
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
      [],
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

    const entries = buildThinkingJournalEntries([record], [], NOW_MS);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.mode).toBe('problem_solving');
    expect(entries[0]?.hypothesis).toBe('No hypothesis recorded.');
  });

  it('attaches a completed reflection to the latest eligible learning-cycle record in the same thread', () => {
    const entries = buildThinkingJournalEntries(
      [
        makeRecord({
          id: 'problem-1',
          threadId: '/app/threads/thread-a',
          mode: 'problem_solving',
          timestamp: NOW_MS - 2 * DAY_MS,
          prediction: 'Likely a stale cache key.'
        })
      ],
      [
        makeReflection({
          id: 'reflection-a',
          threadId: '/app/threads/thread-a',
          timestamp: NOW_MS - DAY_MS,
          score: 50,
          notes: 'The issue was actually an expired token.'
        })
      ],
      NOW_MS
    );

    expect(entries[0]?.reflection).toMatchObject({
      timestamp: NOW_MS - DAY_MS,
      dateLabel: formatJournalTimestamp(NOW_MS - DAY_MS),
      score: 50,
      notes: 'The issue was actually an expired token.'
    });
  });

  it('keeps the learning-cycle timestamp as the sort anchor even when a matched reflection is newer', () => {
    const entries = buildThinkingJournalEntries(
      [
        makeRecord({
          id: 'newer-learning',
          threadId: '/app/threads/thread-b',
          mode: 'learning',
          timestamp: NOW_MS - DAY_MS,
          priorKnowledgeNote: 'I know the basics.'
        }),
        makeRecord({
          id: 'older-problem',
          threadId: '/app/threads/thread-a',
          mode: 'problem_solving',
          timestamp: NOW_MS - 3 * DAY_MS,
          prediction: 'Likely an indexing issue.'
        })
      ],
      [
        makeReflection({
          id: 'reflection-a',
          threadId: '/app/threads/thread-a',
          timestamp: NOW_MS - 1000,
          score: 100
        })
      ],
      NOW_MS
    );

    expect(entries.map((entry) => entry.id)).toEqual(['newer-learning', 'older-problem']);
    expect(entries[1]?.reflection?.score).toBe(100);
  });

  it('drops reflections that cannot be matched to an eligible interaction and prefers the latest matched reflection', () => {
    const entries = buildThinkingJournalEntries(
      [
        makeRecord({
          id: 'delegation-1',
          threadId: '/app/threads/thread-delegation',
          mode: 'delegation',
          timestamp: NOW_MS - 2 * DAY_MS
        }),
        makeRecord({
          id: 'problem-1',
          threadId: '/app/threads/thread-problem',
          mode: 'problem_solving',
          timestamp: NOW_MS - 3 * DAY_MS,
          prediction: 'Maybe the queue is backed up.'
        }),
        makeRecord({
          id: 'old-learning',
          threadId: '/app/threads/thread-old',
          mode: 'learning',
          timestamp: NOW_MS - 9 * DAY_MS,
          priorKnowledgeNote: 'I remember the general flow.'
        })
      ],
      [
        makeReflection({
          id: 'reflection-delegation',
          threadId: '/app/threads/thread-delegation',
          timestamp: NOW_MS - DAY_MS,
          score: 25
        }),
        makeReflection({
          id: 'reflection-old-1',
          threadId: '/app/threads/thread-problem',
          timestamp: NOW_MS - 2 * DAY_MS,
          score: 25
        }),
        makeReflection({
          id: 'reflection-old-2',
          threadId: '/app/threads/thread-problem',
          timestamp: NOW_MS - DAY_MS,
          score: 75,
          notes: 'The bottleneck was downstream, not the queue.'
        }),
        makeReflection({
          id: 'reflection-out-of-window',
          threadId: '/app/threads/thread-old',
          timestamp: NOW_MS - DAY_MS,
          score: 50
        }),
        makeReflection({
          id: 'reflection-unmatched',
          threadId: '/app/threads/thread-missing',
          timestamp: NOW_MS - DAY_MS,
          score: 100
        })
      ],
      NOW_MS
    );

    expect(entries.map((entry) => entry.id)).toEqual(['delegation-1', 'problem-1']);
    expect(entries[0]?.reflection).toBeUndefined();
    expect(entries[1]?.reflection).toMatchObject({
      score: 75,
      notes: 'The bottleneck was downstream, not the queue.'
    });
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
    [
      makeReflection({
        id: 'reflection-problem',
        threadId: '/app/threads/default',
        timestamp: NOW_MS - DAY_MS / 2,
        score: 25
      })
    ],
    NOW_MS
  );

  it('filters by each supported mode', () => {
    expect(filterThinkingJournalEntries(entries, { mode: 'all', withReflectionOnly: false }).map((entry) => entry.id)).toEqual([
      'delegation',
      'problem',
      'learning'
    ]);
    expect(filterThinkingJournalEntries(entries, { mode: 'problem_solving', withReflectionOnly: false }).map((entry) => entry.id)).toEqual([
      'problem'
    ]);
    expect(filterThinkingJournalEntries(entries, { mode: 'delegation', withReflectionOnly: false }).map((entry) => entry.id)).toEqual([
      'delegation'
    ]);
    expect(filterThinkingJournalEntries(entries, { mode: 'learning', withReflectionOnly: false }).map((entry) => entry.id)).toEqual([
      'learning'
    ]);
  });

  it('can further restrict results to entries with matched reflections', () => {
    expect(filterThinkingJournalEntries(entries, { mode: 'all', withReflectionOnly: true }).map((entry) => entry.id)).toEqual(['problem']);
    expect(filterThinkingJournalEntries(entries, { mode: 'problem_solving', withReflectionOnly: true }).map((entry) => entry.id)).toEqual([
      'problem'
    ]);
    expect(filterThinkingJournalEntries(entries, { mode: 'learning', withReflectionOnly: true })).toEqual([]);
  });
});

describe('formatJournalTimestamp', () => {
  it('formats in the expected calm journal style', () => {
    const value = formatJournalTimestamp(Date.UTC(2026, 2, 2, 16, 42, 0), 'en-US', 'UTC');
    expect(value).toBe('Mar 2');
  });
});
