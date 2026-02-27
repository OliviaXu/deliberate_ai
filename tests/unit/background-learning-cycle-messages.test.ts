import { describe, expect, it, vi } from 'vitest';
import type { LearningCycleRecord } from '../../src/shared/types';
import { registerLearningCycleMessageHandlers } from '../../src/background/learning-cycle-messages';

function makeRecord(overrides: Partial<LearningCycleRecord> = {}): LearningCycleRecord {
  const base: LearningCycleRecord = {
    id: 'id-1',
    timestamp: Date.now(),
    platform: 'gemini',
    threadId: '/app/thread',
    mode: 'delegation',
    prompt: 'draft'
  };
  return { ...base, ...overrides } as LearningCycleRecord;
}

describe('registerLearningCycleMessageHandlers', () => {
  it('registers append handler', async () => {
    const append = vi.fn(async () => undefined);
    const onMessage = vi.fn();

    registerLearningCycleMessageHandlers(
      { append },
      {
        runtime: {
          onMessage: {
            addListener: onMessage
          }
        }
      }
    );

    expect(onMessage).toHaveBeenCalledOnce();
    const listener = onMessage.mock.calls[0]?.[0];
    if (!listener) throw new Error('Expected listener');

    await expect(listener({ type: 'learning-cycle:append', record: makeRecord() })).resolves.toEqual({ ok: true });
    expect(append).toHaveBeenCalledOnce();
  });
});
