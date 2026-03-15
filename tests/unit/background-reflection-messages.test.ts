import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReflectionRecord } from '../../src/shared/types';
import { registerReflectionMessageHandlers } from '../../src/background/reflection-messages';

function makeReflection(overrides: Partial<ReflectionRecord> = {}): ReflectionRecord {
  return {
    id: 'reflection-1',
    timestamp: Date.now(),
    threadId: '/app/thread',
    learningCycleRecordId: 'record-1',
    status: 'completed',
    score: 50,
    ...overrides
  };
}

describe('registerReflectionMessageHandlers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('appends reflection records for reflection messages', async () => {
    const append = vi.fn(async () => undefined);
    const hasCompletedReflectionForRecord = vi.fn(async () => false);
    const onMessage = vi.fn();
    const reflection = makeReflection({ timestamp: 123 });

    registerReflectionMessageHandlers(
      { append, hasCompletedReflectionForRecord },
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

    await expect(
      new Promise((resolve) => {
        listener({ type: 'reflection:append', record: reflection }, {}, resolve);
      })
    ).resolves.toEqual({ ok: true });

    expect(append).toHaveBeenCalledWith(reflection);
    expect(hasCompletedReflectionForRecord).not.toHaveBeenCalled();
  });

  it('returns whether a learning-cycle record already has a completed reflection', async () => {
    const append = vi.fn(async () => undefined);
    const hasCompletedReflectionForRecord = vi.fn(async () => true);
    const onMessage = vi.fn();

    registerReflectionMessageHandlers(
      { append, hasCompletedReflectionForRecord },
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

    await expect(
      new Promise((resolve) => {
        listener({ type: 'reflection:record-has-completed', learningCycleRecordId: 'record-1' }, {}, resolve);
      })
    ).resolves.toEqual({ hasCompletedReflection: true });

    expect(hasCompletedReflectionForRecord).toHaveBeenCalledWith('record-1');
    expect(append).not.toHaveBeenCalled();
  });

  it('returns cleanup that detaches the runtime listener', () => {
    const append = vi.fn(async () => undefined);
    const hasCompletedReflectionForRecord = vi.fn(async () => false);
    const addListener = vi.fn();
    const removeListener = vi.fn();

    const cleanup = registerReflectionMessageHandlers(
      { append, hasCompletedReflectionForRecord },
      {
        runtime: {
          onMessage: {
            addListener,
            removeListener
          }
        }
      }
    );

    expect(addListener).toHaveBeenCalledOnce();
    const registeredListener = addListener.mock.calls[0]?.[0];
    expect(typeof registeredListener).toBe('function');

    cleanup();

    expect(removeListener).toHaveBeenCalledWith(registeredListener);
  });
});
