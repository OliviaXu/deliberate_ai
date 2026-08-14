import { describe, expect, it } from 'vitest';
import type { LearningCycleRecord, ReflectionRecord } from '../../src/shared/types';
import {
  buildResurfacingCandidate,
  selectResurfacingLearningCycle
} from '../../src/background/resurfacing-selection';
import { JOURNAL_WINDOW_MS } from '../../src/thinking-journal/journal-window';

const NOW = Date.UTC(2026, 7, 13, 12, 0, 0);

function learningRecord(overrides: Partial<LearningCycleRecord> = {}): LearningCycleRecord {
  return {
    id: 'learning-1',
    occurredAt: NOW - JOURNAL_WINDOW_MS - 1,
    platform: 'gemini',
    threadId: '/app/learning-1',
    mode: 'learning',
    prompt: 'Explain this topic',
    startingPoint: 'Original starting point',
    ...overrides
  } as LearningCycleRecord;
}

function reflection(overrides: Partial<ReflectionRecord> = {}): ReflectionRecord {
  return {
    id: 'reflection-1',
    occurredAt: NOW - 1_000,
    learningCycleId: 'learning-1',
    score: 75,
    notes: 'Latest written reflection',
    ...overrides
  };
}

describe('selectResurfacingCandidate', () => {
  it('selects only reflection-eligible records strictly older than the journal window', () => {
    const records = [
      learningRecord({ id: 'old', occurredAt: NOW - JOURNAL_WINDOW_MS - 1 }),
      learningRecord({ id: 'boundary', occurredAt: NOW - JOURNAL_WINDOW_MS }),
      learningRecord({ id: 'recent', occurredAt: NOW - JOURNAL_WINDOW_MS + 1 }),
      learningRecord({ id: 'delegation', mode: 'delegation' } as Partial<LearningCycleRecord>)
    ];

    expect(selectResurfacingLearningCycle(records, NOW, () => 0)?.id).toBe('old');
  });

  it('requires non-whitespace authored material and preserves the selected text verbatim', () => {
    const records = [
      learningRecord({ id: 'blank-learning', startingPoint: '  \n ' }),
      learningRecord({
        id: 'problem',
        mode: 'problem_solving',
        startingPoint: '  Keep my spacing  '
      })
    ];

    const selected = selectResurfacingLearningCycle(records, NOW, () => 0);
    expect(selected && buildResurfacingCandidate(selected, [])).toEqual({
      learningCycleId: 'problem',
      excerpt: '  Keep my spacing  '
    });
  });

  it('selects from learning-cycle material before loading the latest written reflection for the chosen record', () => {
    const record = learningRecord({ id: 'problem', mode: 'problem_solving', startingPoint: 'Prediction' });
    const reflections = [
      reflection({ id: 'older-written', learningCycleId: 'problem', occurredAt: 100, notes: 'Older reflection' }),
      reflection({ id: 'newer-blank', learningCycleId: 'problem', occurredAt: 300, notes: '   ' }),
      reflection({ id: 'latest-written', learningCycleId: 'problem', occurredAt: 200, notes: '  New reflection  ' })
    ];

    const selected = selectResurfacingLearningCycle([record], NOW, () => 0);
    expect(selected && buildResurfacingCandidate(selected, reflections)).toEqual({
      learningCycleId: 'problem',
      excerpt: '  New reflection  '
    });
  });

  it('does not join reflections into pool eligibility when a learning cycle has no starting material', () => {
    const blankLearning = learningRecord({ id: 'blank-learning', startingPoint: undefined });
    const writtenReflection = reflection({
      learningCycleId: 'blank-learning',
      notes: 'This later reflection does not make the entry eligible.'
    });

    expect(selectResurfacingLearningCycle([blankLearning], NOW, () => 0)).toBeNull();
    expect(writtenReflection.notes).toBeTruthy();
  });

  it('randomly chooses among unseen entries before previously surfaced entries', () => {
    const records = [
      learningRecord({ id: 'seen', resurfacing: { lastSurfacedAt: 10 } }),
      learningRecord({ id: 'unseen-a' }),
      learningRecord({ id: 'unseen-b' })
    ];

    expect(selectResurfacingLearningCycle(records, NOW, () => 0.99)?.id).toBe('unseen-b');
  });

  it('randomly chooses among entries tied for the least recent presentation', () => {
    const records = [
      learningRecord({ id: 'oldest-a', resurfacing: { lastSurfacedAt: 10 } }),
      learningRecord({ id: 'newer', resurfacing: { lastSurfacedAt: 20 } }),
      learningRecord({ id: 'oldest-b', resurfacing: { lastSurfacedAt: 10 } })
    ];

    expect(selectResurfacingLearningCycle(records, NOW, () => 0.99)?.id).toBe('oldest-b');
  });

  it('allows a single previously surfaced entry to repeat', () => {
    const record = learningRecord({ resurfacing: { lastSurfacedAt: NOW - 10 } });

    const selected = selectResurfacingLearningCycle([record], NOW, () => 0);
    expect(selected && buildResurfacingCandidate(selected, [])).toEqual({
      learningCycleId: 'learning-1',
      excerpt: 'Original starting point'
    });
  });

  it('excludes suppressed entries before applying recency selection', () => {
    const records = [
      learningRecord({ id: 'suppressed-unseen', resurfacing: { lastSurfacedAt: 0, suppressedAt: NOW - 1 } }),
      learningRecord({ id: 'available', resurfacing: { lastSurfacedAt: 10 } })
    ];

    expect(selectResurfacingLearningCycle(records, NOW, () => 0)?.id).toBe('available');
  });
});
