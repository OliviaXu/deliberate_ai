import { describe, expect, it, vi } from 'vitest';
import type { LearningCycleRecord } from '../../src/shared/types';
import { JOURNAL_WINDOW_MS } from '../../src/thinking-journal/journal-window';
import { ResurfacingService } from '../../src/background/resurfacing-service';

const NOW = Date.UTC(2026, 7, 13, 12, 0, 0);

function eligibleRecord(overrides: Partial<LearningCycleRecord> = {}): LearningCycleRecord {
  return {
    id: 'record-1',
    timestamp: NOW - JOURNAL_WINDOW_MS - 1,
    platform: 'gemini',
    threadId: '/app/record-1',
    mode: 'learning',
    prompt: 'Explain this',
    priorKnowledgeNote: 'Starting point',
    ...overrides
  } as LearningCycleRecord;
}

describe('ResurfacingService', () => {
  it('persists presentation before returning the selected candidate', async () => {
    const calls: string[] = [];
    const markResurfaced = vi.fn(async () => {
      calls.push('mark');
      return true;
    });
    const service = new ResurfacingService({
      learningCycleStore: { listAll: async () => [eligibleRecord()], markResurfaced },
      reflectionStore: { listAll: async () => [] },
      now: () => NOW,
      random: () => 0
    });

    const candidate = await service.presentNext();
    calls.push('returned');

    expect(candidate).toEqual({ learningCycleRecordId: 'record-1', excerpt: 'Starting point' });
    expect(markResurfaced).toHaveBeenCalledWith('record-1', NOW);
    expect(calls).toEqual(['mark', 'returned']);
  });

  it('does not load reflections when no learning-cycle candidate exists', async () => {
    const listReflections = vi.fn(async () => []);
    const noCandidate = new ResurfacingService({
      learningCycleStore: { listAll: async () => [], markResurfaced: vi.fn(async () => false) },
      reflectionStore: { listAll: listReflections },
      now: () => NOW
    });
    await expect(noCandidate.presentNext()).resolves.toBeNull();
    expect(listReflections).not.toHaveBeenCalled();
  });

  it('returns null when the selected record cannot be updated', async () => {
    const missingRecord = new ResurfacingService({
      learningCycleStore: { listAll: async () => [eligibleRecord()], markResurfaced: vi.fn(async () => false) },
      reflectionStore: { listAll: async () => [] },
      now: () => NOW
    });
    await expect(missingRecord.presentNext()).resolves.toBeNull();
  });

  it('does not serialize independent presentation requests in the service', async () => {
    let activeMarks = 0;
    let maximumActiveMarks = 0;
    const markResurfaced = vi.fn(async () => {
      activeMarks += 1;
      maximumActiveMarks = Math.max(maximumActiveMarks, activeMarks);
      await Promise.resolve();
      activeMarks -= 1;
      return true;
    });
    const service = new ResurfacingService({
      learningCycleStore: { listAll: async () => [eligibleRecord()], markResurfaced },
      reflectionStore: { listAll: async () => [] },
      now: () => NOW
    });

    await Promise.all([service.presentNext(), service.presentNext()]);

    expect(markResurfaced).toHaveBeenCalledTimes(2);
    expect(maximumActiveMarks).toBe(2);
  });
});
