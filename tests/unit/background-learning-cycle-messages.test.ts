import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLACEHOLDER_GEMINI_THREAD_ID } from '../../src/shared/thread-id';
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('appends records for append messages', async () => {
    const append = vi.fn(async () => undefined);
    const hasAnyForThread = vi.fn(async () => false);
    const resolveThreadIdForRecord = vi.fn(async () => false);
    const onMessage = vi.fn();

    registerLearningCycleMessageHandlers(
      { append, hasAnyForThread, resolveThreadIdForRecord },
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

    await expect(
      new Promise((resolve) => {
        listener({ type: 'learning-cycle:append', record: makeRecord() }, {}, resolve);
      })
    ).resolves.toEqual({ ok: true });
    expect(append).toHaveBeenCalledOnce();
    expect(hasAnyForThread).not.toHaveBeenCalled();
    expect(resolveThreadIdForRecord).not.toHaveBeenCalled();
  });

  it('returns thread entry presence for lookup messages', async () => {
    const append = vi.fn(async () => undefined);
    const hasAnyForThread = vi.fn(async () => true);
    const resolveThreadIdForRecord = vi.fn(async () => false);
    const onMessage = vi.fn();

    registerLearningCycleMessageHandlers(
      { append, hasAnyForThread, resolveThreadIdForRecord },
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
        listener({ type: 'learning-cycle:thread-has-entry', threadId: '/app/thread' }, {}, resolve);
      })
    ).resolves.toEqual({ hasEntry: true });
    expect(hasAnyForThread).toHaveBeenCalledWith('/app/thread');
    expect(append).not.toHaveBeenCalled();
    expect(resolveThreadIdForRecord).not.toHaveBeenCalled();
  });

  it('tracks placeholder records through pending tracker when sender tab is present', async () => {
    const append = vi.fn(async () => undefined);
    const hasAnyForThread = vi.fn(async () => false);
    const resolveThreadIdForRecord = vi.fn(async () => false);
    const onMessage = vi.fn();
    const trackPlaceholder = vi.fn();
    const trackerFactory = vi.fn(() => ({ trackPlaceholder, dispose: vi.fn() }));

    registerLearningCycleMessageHandlers(
      { append, hasAnyForThread, resolveThreadIdForRecord },
      {
        runtime: {
          onMessage: {
            addListener: onMessage
          }
        }
      },
      { trackerFactory }
    );

    const messageListener = onMessage.mock.calls[0]?.[0];
    if (!messageListener) throw new Error('Expected listener');

    await expect(
      new Promise((resolve) => {
        messageListener(
          { type: 'learning-cycle:append', record: makeRecord({ threadId: PLACEHOLDER_GEMINI_THREAD_ID, id: 'record-1' }) },
          { tab: { id: 101 } },
          resolve
        );
      })
    ).resolves.toEqual({ ok: true });

    expect(trackerFactory).toHaveBeenCalledOnce();
    expect(trackPlaceholder).toHaveBeenCalledWith('record-1', 101);
  });

  it('does not track placeholder records without sender tab id', async () => {
    const append = vi.fn(async () => undefined);
    const hasAnyForThread = vi.fn(async () => false);
    const resolveThreadIdForRecord = vi.fn(async () => false);
    const onMessage = vi.fn();
    const trackPlaceholder = vi.fn();
    const trackerFactory = vi.fn(() => ({ trackPlaceholder, dispose: vi.fn() }));

    registerLearningCycleMessageHandlers(
      { append, hasAnyForThread, resolveThreadIdForRecord },
      {
        runtime: {
          onMessage: {
            addListener: onMessage
          }
        }
      },
      { trackerFactory }
    );

    const messageListener = onMessage.mock.calls[0]?.[0];
    if (!messageListener) throw new Error('Expected listener');

    await expect(
      new Promise((resolve) => {
        messageListener(
          { type: 'learning-cycle:append', record: makeRecord({ threadId: PLACEHOLDER_GEMINI_THREAD_ID, id: 'record-2' }) },
          {},
          resolve
        );
      })
    ).resolves.toEqual({ ok: true });

    expect(trackPlaceholder).not.toHaveBeenCalled();
  });

  it('does not track placeholder records when sender tab id is not a valid integer', async () => {
    const append = vi.fn(async () => undefined);
    const hasAnyForThread = vi.fn(async () => false);
    const resolveThreadIdForRecord = vi.fn(async () => false);
    const onMessage = vi.fn();
    const trackPlaceholder = vi.fn();
    const trackerFactory = vi.fn(() => ({ trackPlaceholder, dispose: vi.fn() }));

    registerLearningCycleMessageHandlers(
      { append, hasAnyForThread, resolveThreadIdForRecord },
      {
        runtime: {
          onMessage: {
            addListener: onMessage
          }
        }
      },
      { trackerFactory }
    );

    const messageListener = onMessage.mock.calls[0]?.[0];
    if (!messageListener) throw new Error('Expected listener');

    await expect(
      new Promise((resolve) => {
        messageListener(
          { type: 'learning-cycle:append', record: makeRecord({ threadId: PLACEHOLDER_GEMINI_THREAD_ID, id: 'record-2a' }) },
          { tab: { id: Number.NaN } },
          resolve
        );
      })
    ).resolves.toEqual({ ok: true });

    expect(trackPlaceholder).not.toHaveBeenCalled();
  });

  it('does not track non-placeholder thread ids', async () => {
    const append = vi.fn(async () => undefined);
    const hasAnyForThread = vi.fn(async () => false);
    const resolveThreadIdForRecord = vi.fn(async () => false);
    const onMessage = vi.fn();
    const trackPlaceholder = vi.fn();
    const trackerFactory = vi.fn(() => ({ trackPlaceholder, dispose: vi.fn() }));

    registerLearningCycleMessageHandlers(
      { append, hasAnyForThread, resolveThreadIdForRecord },
      {
        runtime: {
          onMessage: {
            addListener: onMessage
          }
        }
      },
      { trackerFactory }
    );

    const messageListener = onMessage.mock.calls[0]?.[0];
    if (!messageListener) throw new Error('Expected listener');

    await expect(
      new Promise((resolve) => {
        messageListener(
          { type: 'learning-cycle:append', record: makeRecord({ threadId: '/app/threads/real', id: 'record-3' }) },
          { tab: { id: 303 } },
          resolve
        );
      })
    ).resolves.toEqual({ ok: true });

    expect(trackPlaceholder).not.toHaveBeenCalled();
  });

  it('returns cleanup that disposes tracker and detaches runtime listener', () => {
    const append = vi.fn(async () => undefined);
    const hasAnyForThread = vi.fn(async () => false);
    const resolveThreadIdForRecord = vi.fn(async () => false);
    const addListener = vi.fn();
    const removeListener = vi.fn();
    const dispose = vi.fn();
    const trackerFactory = vi.fn(() => ({ trackPlaceholder: vi.fn(), dispose }));

    const cleanup = registerLearningCycleMessageHandlers(
      { append, hasAnyForThread, resolveThreadIdForRecord },
      {
        runtime: {
          onMessage: {
            addListener,
            removeListener
          }
        }
      },
      { trackerFactory }
    );

    expect(addListener).toHaveBeenCalledOnce();
    const registeredListener = addListener.mock.calls[0]?.[0];
    expect(typeof registeredListener).toBe('function');

    cleanup();

    expect(dispose).toHaveBeenCalledOnce();
    expect(removeListener).toHaveBeenCalledWith(registeredListener);
  });
});
