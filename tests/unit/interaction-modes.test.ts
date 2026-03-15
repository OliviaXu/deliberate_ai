import { describe, expect, it } from 'vitest';
import {
  INTERACTION_MODES,
  isReflectionEligibleMode,
  isReflectionEligibleRecord,
  REFLECTION_ELIGIBLE_INTERACTION_MODES
} from '../../src/shared/types';

describe('interaction mode constants', () => {
  it('exports the canonical interaction mode values', () => {
    expect(INTERACTION_MODES).toEqual({
      DELEGATION: 'delegation',
      PROBLEM_SOLVING: 'problem_solving',
      LEARNING: 'learning'
    });
  });

  it('exports the reflection-eligible interaction mode values', () => {
    expect(REFLECTION_ELIGIBLE_INTERACTION_MODES).toEqual([
      INTERACTION_MODES.PROBLEM_SOLVING,
      INTERACTION_MODES.LEARNING
    ]);
  });

  it('identifies reflection-eligible interaction modes', () => {
    expect(isReflectionEligibleMode(INTERACTION_MODES.PROBLEM_SOLVING)).toBe(true);
    expect(isReflectionEligibleMode(INTERACTION_MODES.LEARNING)).toBe(true);
    expect(isReflectionEligibleMode(INTERACTION_MODES.DELEGATION)).toBe(false);
  });

  it('identifies reflection-eligible learning-cycle records', () => {
    expect(
      isReflectionEligibleRecord({
        id: 'problem',
        timestamp: 1,
        platform: 'gemini',
        threadId: 'thread-1',
        mode: INTERACTION_MODES.PROBLEM_SOLVING,
        prompt: 'Investigate this failure',
        prediction: 'It is a cache issue'
      })
    ).toBe(true);

    expect(
      isReflectionEligibleRecord({
        id: 'learning',
        timestamp: 2,
        platform: 'gemini',
        threadId: 'thread-2',
        mode: INTERACTION_MODES.LEARNING,
        prompt: 'Teach me this API',
        priorKnowledgeNote: 'I know the basics'
      })
    ).toBe(true);

    expect(
      isReflectionEligibleRecord({
        id: 'delegation',
        timestamp: 3,
        platform: 'gemini',
        threadId: 'thread-3',
        mode: INTERACTION_MODES.DELEGATION,
        prompt: 'Write this for me'
      })
    ).toBe(false);
  });
});
