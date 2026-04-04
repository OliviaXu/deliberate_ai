import { describe, expect, it } from 'vitest';
import type { LearningCycleRecord, ReflectionRecord } from '../../src/shared/types';
import { buildThinkingJournalHistoryRows } from '../../src/thinking-journal/utils/history';

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
    learningCycleRecordId: '1',
    status: 'completed',
    score: 75,
    ...overrides
  };
}

describe('buildThinkingJournalHistoryRows', () => {
  it('includes stored history outside the journal window and sorts newest first', () => {
    const rows = buildThinkingJournalHistoryRows(
      [
        makeRecord({ id: 'recent', timestamp: NOW_MS - DAY_MS }),
        makeRecord({ id: 'historical', timestamp: NOW_MS - 10 * DAY_MS, mode: 'learning', priorKnowledgeNote: 'Old context' })
      ],
      []
    );

    expect(rows.map((row) => row.id)).toEqual(['recent', 'historical']);
    expect(rows[1]).toMatchObject({
      id: 'historical',
      startingPoint: 'Old context'
    });
  });

  it('normalizes starting_point for learning and problem-solving records', () => {
    const problem = makeRecord({
      id: 'problem',
      mode: 'problem_solving',
      prediction: 'Check auth first.'
    });
    const learning = makeRecord({
      id: 'learning',
      mode: 'learning',
      priorKnowledgeNote: 'I know OAuth basics.'
    });
    const missingProblemPrediction = makeRecord({
      id: 'problem-fallback',
      mode: 'problem_solving'
    }) as LearningCycleRecord;

    delete (missingProblemPrediction as { prediction?: string }).prediction;

    const rows = buildThinkingJournalHistoryRows([problem, learning, missingProblemPrediction], []);

    expect(rows.find((row) => row.id === 'problem')?.startingPoint).toBe('Check auth first.');
    expect(rows.find((row) => row.id === 'learning')?.startingPoint).toBe('I know OAuth basics.');
    expect(rows.find((row) => row.id === 'problem-fallback')?.startingPoint).toBe('No hypothesis recorded.');
  });

  it('links only the latest valid reflection for eligible records', () => {
    const rows = buildThinkingJournalHistoryRows(
      [
        makeRecord({
          id: 'problem',
          mode: 'problem_solving',
          timestamp: NOW_MS - 2 * DAY_MS,
          prediction: 'Maybe stale cache.'
        }),
        makeRecord({
          id: 'delegation',
          mode: 'delegation',
          timestamp: NOW_MS - DAY_MS
        })
      ],
      [
        makeReflection({
          id: 'older-reflection',
          learningCycleRecordId: 'problem',
          timestamp: NOW_MS - DAY_MS,
          score: 25
        }),
        makeReflection({
          id: 'newer-reflection',
          learningCycleRecordId: 'problem',
          timestamp: NOW_MS - DAY_MS / 2,
          score: 100,
          notes: 'The auth token was stale.'
        }),
        makeReflection({
          id: 'delegation-reflection',
          learningCycleRecordId: 'delegation',
          timestamp: NOW_MS - DAY_MS / 3,
          score: 50
        }),
        makeReflection({
          id: 'missing-record-reflection',
          learningCycleRecordId: 'missing',
          timestamp: NOW_MS - DAY_MS / 4,
          score: 75
        })
      ]
    );

    expect(rows.find((row) => row.id === 'problem')?.reflection).toMatchObject({
      score: 100,
      notes: 'The auth token was stale.'
    });
    expect(rows.find((row) => row.id === 'delegation')?.reflection).toBeUndefined();
  });
});
