import { describe, expect, it } from 'vitest';
import type { LearningCycleRecord, ReflectionRecord } from '../../src/shared/types';
import {
  buildThinkingJournalEntryViews,
  buildRecentThinkingJournalEntryViews,
  filterThinkingJournalEntryViews,
  formatJournalReflectionTimestamp,
  formatJournalTimestamp
} from '../../src/thinking-journal/utils/entry-view';
import { buildThinkingJournalEntryRecords } from '../../src/thinking-journal/utils/entry-record';

const NOW_MS = Date.UTC(2026, 2, 3, 12, 0, 0);
const DAY_MS = 24 * 60 * 60 * 1000;

function makeRecord(overrides: Partial<LearningCycleRecord> = {}): LearningCycleRecord {
  const base: LearningCycleRecord = {
    id: '1',
    occurredAt: NOW_MS,
    platform: 'gemini',
    url: 'https://gemini.google.com/app/threads/default',
    threadId: '/app/threads/default',
    mode: 'delegation',
    prompt: 'Draft a response for me'
  };
  return { ...base, ...overrides } as LearningCycleRecord;
}

function makeReflection(overrides: Partial<ReflectionRecord> = {}): ReflectionRecord {
  return {
    id: 'reflection-1',
    occurredAt: NOW_MS,
    learningCycleId: '1',
    score: 75,
    ...overrides
  };
}

describe('buildThinkingJournalEntryViews', () => {
  it('keeps only entries from the last 7 days and sorts newest first', () => {
    const records: LearningCycleRecord[] = [
      makeRecord({ id: 'newest', occurredAt: NOW_MS - DAY_MS }),
      makeRecord({
        id: 'problem',
        occurredAt: NOW_MS - 2 * DAY_MS,
        mode: 'problem_solving',
        startingPoint: 'Root cause is a race condition'
      }),
      makeRecord({
        id: 'learning',
        occurredAt: NOW_MS - 3 * DAY_MS,
        mode: 'learning',
        startingPoint: 'I understand the basics'
      }),
      makeRecord({ id: 'old', occurredAt: NOW_MS - 9 * DAY_MS })
    ];

    const entries = buildRecentThinkingJournalEntryViews(records, [], NOW_MS);
    expect(entries.map((entry) => entry.id)).toEqual(['newest', 'problem', 'learning']);
  });

  it('maps learning initial context when available', () => {
    const entries = buildThinkingJournalEntryViews(
      buildThinkingJournalEntryRecords(
      [
        makeRecord({
          id: 'learning',
          mode: 'learning',
          occurredAt: NOW_MS,
          startingPoint: 'I know OAuth basics'
        })
      ],
      []
      )
    );

    expect(entries[0]?.initialContext).toBe('I know OAuth basics');
  });

  it('carries resurfacing suppression into the journal view', () => {
    const entries = buildThinkingJournalEntryViews(buildThinkingJournalEntryRecords([
      makeRecord({ resurfacing: { lastSurfacedAt: 1234, suppressedAt: 5678 } })
    ], []));
    expect(entries[0]?.resurfacingSuppressed).toBe(true);
  });

  it('carries through the original thread URL when present', () => {
    const entries = buildThinkingJournalEntryViews(
      buildThinkingJournalEntryRecords(
        [
          makeRecord({
            id: 'learning',
            mode: 'learning',
            url: 'https://gemini.google.com/app/threads/thread-123',
            occurredAt: NOW_MS
          })
        ],
        []
      )
    );

    expect(entries[0]?.url).toBe('https://gemini.google.com/app/threads/thread-123');
  });

  it('uses fallback hypothesis when problem-solving startingPoint is missing', () => {
    const record = makeRecord({
      id: 'problem-missing-startingPoint',
      mode: 'problem_solving',
      occurredAt: NOW_MS
    }) as unknown as LearningCycleRecord;

    delete (record as { startingPoint?: string }).startingPoint;

    const entries = buildThinkingJournalEntryViews(buildThinkingJournalEntryRecords([record], []));
    expect(entries).toHaveLength(1);
    expect(entries[0]?.mode).toBe('problem_solving');
    expect(entries[0]?.hypothesis).toBe('No hypothesis recorded.');
  });

  it('attaches a completed reflection to the directly linked learning-cycle record', () => {
    const entries = buildThinkingJournalEntryViews(
      buildThinkingJournalEntryRecords(
      [
        makeRecord({
          id: 'problem-1',
          threadId: '/app/threads/thread-a',
          mode: 'problem_solving',
          occurredAt: NOW_MS - 2 * DAY_MS,
          startingPoint: 'Likely a stale cache key.'
        })
      ],
      [
        makeReflection({
          id: 'reflection-a',
          learningCycleId: 'problem-1',
          occurredAt: NOW_MS - DAY_MS,
          score: 50,
          notes: 'The issue was actually an expired token.'
        })
      ]
      )
    );

    expect(entries[0]?.reflections[0]).toMatchObject({
      occurredAt: NOW_MS - DAY_MS,
      dateLabel: formatJournalReflectionTimestamp(NOW_MS - DAY_MS),
      score: 50,
      notes: 'The issue was actually an expired token.'
    });
  });

  it('matches reflections by learning-cycle foreign key even when other records share the thread', () => {
    const entries = buildThinkingJournalEntryViews(
      buildThinkingJournalEntryRecords(
      [
        makeRecord({
          id: 'problem-older',
          threadId: '/app/threads/thread-a',
          mode: 'problem_solving',
          occurredAt: NOW_MS - 3 * DAY_MS,
          startingPoint: 'Maybe stale cache.'
        }),
        makeRecord({
          id: 'learning-newer',
          threadId: '/app/threads/thread-a',
          mode: 'learning',
          occurredAt: NOW_MS - DAY_MS,
          startingPoint: 'I know the rollout basics.'
        })
      ],
      [
        makeReflection({
          id: 'reflection-direct',
          learningCycleId: 'problem-older',
          occurredAt: NOW_MS - 1000,
          score: 100,
          notes: 'The cache was fine. The auth token was stale.'
        })
      ]
      )
    );

    expect(entries.find((entry) => entry.id === 'problem-older')?.reflections[0]).toMatchObject({
      score: 100,
      notes: 'The cache was fine. The auth token was stale.'
    });
    expect(entries.find((entry) => entry.id === 'learning-newer')?.reflections).toEqual([]);
  });

  it('keeps the learning-cycle occurredAt as the sort anchor even when a matched reflection is newer', () => {
    const entries = buildThinkingJournalEntryViews(
      buildThinkingJournalEntryRecords(
      [
        makeRecord({
          id: 'newer-learning',
          threadId: '/app/threads/thread-b',
          mode: 'learning',
          occurredAt: NOW_MS - DAY_MS,
          startingPoint: 'I know the basics.'
        }),
        makeRecord({
          id: 'older-problem',
          threadId: '/app/threads/thread-a',
          mode: 'problem_solving',
          occurredAt: NOW_MS - 3 * DAY_MS,
          startingPoint: 'Likely an indexing issue.'
        })
      ],
      [
        makeReflection({
          id: 'reflection-a',
          learningCycleId: 'older-problem',
          occurredAt: NOW_MS - 1000,
          score: 100
        })
      ]
      )
    );

    expect(entries.map((entry) => entry.id)).toEqual(['newer-learning', 'older-problem']);
    expect(entries[1]?.reflections[0]?.score).toBe(100);
  });

  it('drops unmatched reflections and preserves all direct reflections per eligible record', () => {
    const entries = buildRecentThinkingJournalEntryViews(
      [
        makeRecord({
          id: 'delegation-1',
          threadId: '/app/threads/thread-delegation',
          mode: 'delegation',
          occurredAt: NOW_MS - 2 * DAY_MS
        }),
        makeRecord({
          id: 'problem-1',
          threadId: '/app/threads/thread-problem',
          mode: 'problem_solving',
          occurredAt: NOW_MS - 3 * DAY_MS,
          startingPoint: 'Maybe the queue is backed up.'
        }),
        makeRecord({
          id: 'old-learning',
          threadId: '/app/threads/thread-old',
          mode: 'learning',
          occurredAt: NOW_MS - 9 * DAY_MS,
          startingPoint: 'I remember the general flow.'
        })
      ],
      [
        makeReflection({
          id: 'reflection-delegation',
          learningCycleId: 'delegation-1',
          occurredAt: NOW_MS - DAY_MS,
          score: 25
        }),
        makeReflection({
          id: 'reflection-old-1',
          learningCycleId: 'problem-1',
          occurredAt: NOW_MS - 2 * DAY_MS,
          score: 25
        }),
        makeReflection({
          id: 'reflection-old-2',
          learningCycleId: 'problem-1',
          occurredAt: NOW_MS - DAY_MS,
          score: 75,
          notes: 'The bottleneck was downstream, not the queue.'
        }),
        makeReflection({
          id: 'reflection-out-of-window',
          learningCycleId: 'old-learning',
          occurredAt: NOW_MS - DAY_MS,
          score: 50
        }),
        makeReflection({
          id: 'reflection-unmatched',
          learningCycleId: 'missing-record',
          occurredAt: NOW_MS - DAY_MS,
          score: 100
        })
      ],
      NOW_MS
    );

    expect(entries.map((entry) => entry.id)).toEqual(['delegation-1', 'problem-1']);
    expect(entries[0]?.reflections).toEqual([]);
    expect(entries[1]?.reflections).toEqual([
      expect.objectContaining({ score: 25 }),
      expect.objectContaining({
        score: 75,
        notes: 'The bottleneck was downstream, not the queue.'
      })
    ]);
  });
});

describe('filterThinkingJournalEntries', () => {
  const entries = buildThinkingJournalEntryViews(
    buildThinkingJournalEntryRecords(
    [
      makeRecord({ id: 'delegation', occurredAt: NOW_MS, mode: 'delegation' }),
      makeRecord({
        id: 'problem',
        occurredAt: NOW_MS - DAY_MS,
        mode: 'problem_solving',
        startingPoint: 'Likely a caching bug'
      }),
      makeRecord({ id: 'learning', occurredAt: NOW_MS - 2 * DAY_MS, mode: 'learning' })
    ],
    [
      makeReflection({
        id: 'reflection-problem',
        learningCycleId: 'problem',
        occurredAt: NOW_MS - DAY_MS / 2,
        score: 25
      })
    ],
    )
  );

  it('filters by each supported mode', () => {
    expect(filterThinkingJournalEntryViews(entries, { mode: 'all', withReflectionOnly: false }).map((entry) => entry.id)).toEqual([
      'delegation',
      'problem',
      'learning'
    ]);
    expect(filterThinkingJournalEntryViews(entries, { mode: 'problem_solving', withReflectionOnly: false }).map((entry) => entry.id)).toEqual([
      'problem'
    ]);
    expect(filterThinkingJournalEntryViews(entries, { mode: 'delegation', withReflectionOnly: false }).map((entry) => entry.id)).toEqual([
      'delegation'
    ]);
    expect(filterThinkingJournalEntryViews(entries, { mode: 'learning', withReflectionOnly: false }).map((entry) => entry.id)).toEqual([
      'learning'
    ]);
  });

  it('can further restrict results to entries with matched reflections', () => {
    expect(filterThinkingJournalEntryViews(entries, { mode: 'all', withReflectionOnly: true }).map((entry) => entry.id)).toEqual(['problem']);
    expect(filterThinkingJournalEntryViews(entries, { mode: 'problem_solving', withReflectionOnly: true }).map((entry) => entry.id)).toEqual([
      'problem'
    ]);
    expect(filterThinkingJournalEntryViews(entries, { mode: 'learning', withReflectionOnly: true })).toEqual([]);
  });
});

describe('formatJournalTimestamp', () => {
  it('formats in the expected calm journal style', () => {
    const value = formatJournalTimestamp(Date.UTC(2026, 2, 2, 16, 42, 0), 'en-US', 'UTC');
    expect(value).toBe('Mar 2');
  });
});
