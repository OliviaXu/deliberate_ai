import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LearningCycleRecord, ReflectionRecord } from '../../src/shared/types';
import {
  loadThinkingJournalPage,
  loadThinkingJournalExportRows
} from '../../src/thinking-journal/thinking-journal-store';

afterEach(() => {
  vi.restoreAllMocks();
});

function makeLearningCycleRecord(overrides: Partial<LearningCycleRecord> = {}): LearningCycleRecord {
  const base: LearningCycleRecord = {
    id: 'record-1',
    timestamp: Date.UTC(2026, 2, 12, 12, 0, 0),
    platform: 'gemini',
    threadId: '/app/threads/default',
    mode: 'delegation',
    prompt: 'Draft a short update'
  };

  return { ...base, ...overrides } as LearningCycleRecord;
}

function makeReflectionRecord(overrides: Partial<ReflectionRecord> = {}): ReflectionRecord {
  return {
    id: 'reflection-1',
    timestamp: Date.UTC(2026, 2, 12, 12, 30, 0),
    threadId: '/app/threads/default',
    learningCycleRecordId: 'record-1',
    status: 'completed',
    score: 75,
    ...overrides
  };
}

describe('loadThinkingJournalPage recent entries', () => {
  it('loads both stores and returns only entries from the last 7 days', async () => {
    const nowMs = Date.UTC(2026, 2, 12, 12, 0, 0);
    const dayMs = 24 * 60 * 60 * 1000;
    const listAll = vi.fn<() => Promise<LearningCycleRecord[]>>(async () => [
      {
        id: 'recent-learning',
        timestamp: nowMs - dayMs,
        platform: 'gemini',
        threadId: '/app/threads/recent',
        mode: 'learning',
        prompt: 'Explain token refresh.',
        priorKnowledgeNote: 'I know access tokens expire.'
      },
      {
        id: 'old-problem',
        timestamp: nowMs - 10 * dayMs,
        platform: 'gemini',
        threadId: '/app/threads/old',
        mode: 'problem_solving',
        prompt: 'Diagnose the auth outage',
        prediction: 'Tokens might be expired.'
      }
    ]);
    const listAllReflections = vi.fn<() => Promise<ReflectionRecord[]>>(async () => [
      {
        id: 'reflection-1',
        timestamp: nowMs - dayMs / 2,
        threadId: '/app/threads/old',
        learningCycleRecordId: 'old-problem',
        status: 'completed',
        score: 75,
        notes: 'It was token expiry.'
      }
    ]);

    const { recentEntries: entries } = await loadThinkingJournalPage(undefined, nowMs, {
      learningCycleStore: { listAll },
      reflectionStore: { listAll: listAllReflections }
    });

    expect(listAll).toHaveBeenCalledOnce();
    expect(listAllReflections).toHaveBeenCalledOnce();
    expect(entries.map((entry) => entry.id)).toEqual(['recent-learning']);
    expect(entries[0]).toMatchObject({
      id: 'recent-learning',
      startingPoint: 'I know access tokens expire.'
    });
  });

  it('still attaches reflections for recent eligible records without materializing full export history', async () => {
    const nowMs = Date.UTC(2026, 2, 12, 12, 0, 0);
    const dayMs = 24 * 60 * 60 * 1000;

    const { recentEntries: entries } = await loadThinkingJournalPage(undefined, nowMs, {
      learningCycleStore: {
        listAll: vi.fn<() => Promise<LearningCycleRecord[]>>(async () => [
          makeLearningCycleRecord({
            id: 'recent-problem',
            timestamp: nowMs - dayMs,
            threadId: '/app/threads/recent',
            mode: 'problem_solving',
            prompt: 'Diagnose the auth outage',
            prediction: 'Tokens might be expired.'
          }),
          makeLearningCycleRecord({
            id: 'old-problem',
            timestamp: nowMs - 10 * dayMs,
            threadId: '/app/threads/old',
            mode: 'problem_solving',
            prompt: 'Investigate the older incident',
            prediction: 'Maybe stale cache.'
          })
        ])
      },
      reflectionStore: {
        listAll: vi.fn<() => Promise<ReflectionRecord[]>>(async () => [
          makeReflectionRecord({
            id: 'reflection-recent',
            timestamp: nowMs - dayMs / 2,
            threadId: '/app/threads/recent',
            learningCycleRecordId: 'recent-problem',
            score: 75,
            notes: 'It was token expiry.'
          }),
          makeReflectionRecord({
            id: 'reflection-old',
            timestamp: nowMs - dayMs / 3,
            threadId: '/app/threads/old',
            learningCycleRecordId: 'old-problem',
            score: 50,
            notes: 'The older issue was stale cache.'
          })
        ])
      }
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'recent-problem',
      reflection: {
        score: 75,
        notes: 'It was token expiry.'
      }
    });
  });

  it('returns an empty list when either store returns an invalid value', async () => {
    const nowMs = Date.UTC(2026, 2, 12, 12, 0, 0);
    const { recentEntries: entries } = await loadThinkingJournalPage(undefined, nowMs, {
      learningCycleStore: { listAll: vi.fn(async () => ({ nope: true } as unknown as LearningCycleRecord[])) },
      reflectionStore: { listAll: vi.fn(async () => ({ nope: true } as unknown as ReflectionRecord[])) }
    });

    expect(entries).toEqual([]);
  });
});

describe('loadThinkingJournalExportRows', () => {
  it('loads the full normalized history for CSV export', async () => {
    const nowMs = Date.UTC(2026, 2, 12, 12, 0, 0);
    const dayMs = 24 * 60 * 60 * 1000;

    const rows = await loadThinkingJournalExportRows({
      learningCycleStore: {
        listAll: vi.fn<() => Promise<LearningCycleRecord[]>>(async () => [
          makeLearningCycleRecord({
            id: 'recent-learning',
            timestamp: nowMs - dayMs,
            threadId: '/app/threads/recent',
            mode: 'learning',
            prompt: 'Explain token refresh.',
            priorKnowledgeNote: 'I know access tokens expire.'
          }),
          makeLearningCycleRecord({
            id: 'old-problem',
            timestamp: nowMs - 10 * dayMs,
            threadId: '/app/threads/old',
            mode: 'problem_solving',
            prompt: 'Diagnose the auth outage',
            prediction: 'Tokens might be expired.'
          })
        ])
      },
      reflectionStore: {
        listAll: vi.fn<() => Promise<ReflectionRecord[]>>(async () => [
          makeReflectionRecord({
            id: 'reflection-1',
            timestamp: nowMs - dayMs / 2,
            threadId: '/app/threads/old',
            learningCycleRecordId: 'old-problem',
            score: 75,
            notes: 'It was token expiry.'
          })
        ])
      }
    });

    expect(rows.map((row) => row.id)).toEqual(['recent-learning', 'old-problem']);
    expect(rows[1]).toMatchObject({
      startingPoint: 'Tokens might be expired.',
      reflection: {
        score: 75,
        notes: 'It was token expiry.'
      }
    });
  });
});

describe('loadThinkingJournalPage', () => {
  it('loads a historical featured entry and the recent feed from one store snapshot', async () => {
    const nowMs = Date.UTC(2026, 2, 12, 12, 0, 0);
    const dayMs = 24 * 60 * 60 * 1000;
    const listAll = vi.fn(async () => [
      makeLearningCycleRecord({ id: 'recent', timestamp: nowMs - dayMs, prompt: 'Recent prompt' }),
      makeLearningCycleRecord({
        id: 'featured',
        timestamp: nowMs - 10 * dayMs,
        mode: 'learning',
        priorKnowledgeNote: 'Historical context',
        prompt: 'Historical prompt'
      })
    ]);
    const listAllReflections = vi.fn(async () => [
      makeReflectionRecord({ learningCycleRecordId: 'featured', notes: 'Historical reflection' })
    ]);

    const page = await loadThinkingJournalPage('featured', nowMs, {
      learningCycleStore: { listAll },
      reflectionStore: { listAll: listAllReflections }
    });

    expect(listAll).toHaveBeenCalledOnce();
    expect(listAllReflections).toHaveBeenCalledOnce();
    expect(page.recentEntries.map((entry) => entry.id)).toEqual(['recent']);
    expect(page.featuredEntry).toMatchObject({
      id: 'featured',
      prompt: 'Historical prompt',
      reflection: { notes: 'Historical reflection' }
    });
  });

  it('keeps the recent feed and omits the feature when the requested id is invalid', async () => {
    const nowMs = Date.UTC(2026, 2, 12, 12, 0, 0);
    const page = await loadThinkingJournalPage('missing', nowMs, {
      learningCycleStore: { listAll: vi.fn(async () => [makeLearningCycleRecord({ id: 'recent' })]) },
      reflectionStore: { listAll: vi.fn(async () => []) }
    });

    expect(page.recentEntries).toHaveLength(1);
    expect(page.featuredEntry).toBeUndefined();
  });
});
