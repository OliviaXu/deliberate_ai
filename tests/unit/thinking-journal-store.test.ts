import { describe, expect, it, vi } from 'vitest';
import type { LearningCycleRecord, ReflectionRecord } from '../../src/shared/types';
import { loadThinkingJournalEntries } from '../../src/thinking-journal/thinking-journal-store';

describe('loadThinkingJournalEntries', () => {
  it('delegates loading to both stores and enriches matched reflections', async () => {
    const nowMs = Date.UTC(2026, 2, 3, 12, 0, 0);
    const dayMs = 24 * 60 * 60 * 1000;
    const listAll = vi.fn<() => Promise<LearningCycleRecord[]>>(async () => [
      {
        id: 'problem',
        timestamp: nowMs - dayMs,
        platform: 'gemini',
        threadId: '/app/threads/abc',
        mode: 'problem_solving',
        prompt: 'Investigate this production incident',
        prediction: ''
      }
    ]);
    const listAllReflections = vi.fn<() => Promise<ReflectionRecord[]>>(async () => [
      {
        id: 'reflection-1',
        timestamp: nowMs - dayMs / 2,
        threadId: '/app/threads/abc',
        learningCycleRecordId: 'problem',
        status: 'completed',
        score: 75,
        notes: 'I should have checked the auth token path first.'
      }
    ]);

    const entries = await loadThinkingJournalEntries(nowMs, {
      learningCycleStore: { listAll },
      reflectionStore: { listAll: listAllReflections }
    });
    expect(listAll).toHaveBeenCalledOnce();
    expect(listAllReflections).toHaveBeenCalledOnce();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'problem',
      mode: 'problem_solving',
      hypothesis: 'No hypothesis recorded.',
      reflection: {
        score: 75,
        notes: 'I should have checked the auth token path first.'
      }
    });
  });

  it('returns an empty list when the learning-cycle store returns an invalid value', async () => {
    const nowMs = Date.UTC(2026, 2, 3, 12, 0, 0);
    const listAll = vi.fn(async () => ({ nope: true } as unknown as LearningCycleRecord[]));
    const listAllReflections = vi.fn(async () => [] as ReflectionRecord[]);

    const entries = await loadThinkingJournalEntries(nowMs, {
      learningCycleStore: { listAll },
      reflectionStore: { listAll: listAllReflections }
    });
    expect(entries).toEqual([]);
  });

  it('ignores invalid reflection-store results and still returns mapped learning-cycle entries', async () => {
    const nowMs = Date.UTC(2026, 2, 3, 12, 0, 0);
    const dayMs = 24 * 60 * 60 * 1000;
    const listAll = vi.fn<() => Promise<LearningCycleRecord[]>>(async () => [
      {
        id: 'learning',
        timestamp: nowMs - dayMs,
        platform: 'gemini',
        threadId: '/app/threads/abc',
        mode: 'learning',
        prompt: 'Explain token refresh.',
        priorKnowledgeNote: 'I know access tokens expire.'
      }
    ]);
    const listAllReflections = vi.fn(async () => ({ nope: true } as unknown as ReflectionRecord[]));

    const entries = await loadThinkingJournalEntries(nowMs, {
      learningCycleStore: { listAll },
      reflectionStore: { listAll: listAllReflections }
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'learning',
      mode: 'learning',
      initialContext: 'I know access tokens expire.'
    });
    expect(entries[0]?.reflection).toBeUndefined();
  });
});
