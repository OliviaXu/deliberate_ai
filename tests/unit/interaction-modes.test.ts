import { describe, expect, it } from 'vitest';
import {
  INTERACTION_MODES,
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
});
