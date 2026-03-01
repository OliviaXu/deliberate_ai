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
  it('appends records for append messages', async () => {
    const append = vi.fn(async () => undefined);
    const hasAnyForThread = vi.fn(async () => false);
    const onMessage = vi.fn();

    registerLearningCycleMessageHandlers(
      { append, hasAnyForThread },
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
    expect(hasAnyForThread).not.toHaveBeenCalled();
  });

  it('returns thread entry presence for lookup messages', async () => {
    const append = vi.fn(async () => undefined);
    const hasAnyForThread = vi.fn(async () => true);
    const onMessage = vi.fn();

    registerLearningCycleMessageHandlers(
      { append, hasAnyForThread },
      {
        runtime: {
          onMessage: {
            addListener: onMessage
          }
        }
      }
    );

    const listener = onMessage.mock.calls[0]?.[0];
    if (!listener) throw new Error('Expected listener');

    await expect(listener({ type: 'learning-cycle:thread-has-entry', threadId: '/app/thread' })).resolves.toEqual({
      hasEntry: true
    });
    expect(hasAnyForThread).toHaveBeenCalledWith('/app/thread');
    expect(append).not.toHaveBeenCalled();
  });
});
