import { afterEach, describe, expect, it, vi } from 'vitest';
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
    vi.useRealTimers();
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

  it('resolves pending /app records from tabs.onUpdated concrete Gemini URL', async () => {
    const append = vi.fn(async () => undefined);
    const hasAnyForThread = vi.fn(async () => false);
    const resolveThreadIdForRecord = vi.fn(async () => true);
    const onMessage = vi.fn();
    const onTabsUpdated = vi.fn();

    registerLearningCycleMessageHandlers(
      { append, hasAnyForThread, resolveThreadIdForRecord },
      {
        runtime: {
          onMessage: {
            addListener: onMessage
          }
        },
        tabs: {
          onUpdated: {
            addListener: onTabsUpdated
          }
        }
      }
    );

    const messageListener = onMessage.mock.calls[0]?.[0];
    const tabsUpdatedListener = onTabsUpdated.mock.calls[0]?.[0];
    if (!messageListener || !tabsUpdatedListener) throw new Error('Expected listeners');

    await expect(
      new Promise((resolve) => {
        messageListener({ type: 'learning-cycle:append', record: makeRecord({ threadId: '/app', id: 'record-1' }) }, { tab: { id: 101 } }, resolve);
      })
    ).resolves.toEqual({ ok: true });

    tabsUpdatedListener(
      101,
      { url: 'https://gemini.google.com/app/532b342f83b8e91e', status: 'complete' },
      { id: 101, url: 'https://gemini.google.com/app/532b342f83b8e91e' }
    );

    await vi.waitFor(() => {
      expect(resolveThreadIdForRecord).toHaveBeenCalledWith('record-1', '/app', '/app/532b342f83b8e91e');
    });
  });

  it('dedupes duplicate tabs.onUpdated events while resolution is in-flight', async () => {
    let release: ((value: boolean) => void) | undefined;
    const append = vi.fn(async () => undefined);
    const hasAnyForThread = vi.fn(async () => false);
    const resolveThreadIdForRecord = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          release = resolve;
        })
    );
    const onMessage = vi.fn();
    const onTabsUpdated = vi.fn();

    registerLearningCycleMessageHandlers(
      { append, hasAnyForThread, resolveThreadIdForRecord },
      {
        runtime: {
          onMessage: {
            addListener: onMessage
          }
        },
        tabs: {
          onUpdated: {
            addListener: onTabsUpdated
          }
        }
      }
    );

    const messageListener = onMessage.mock.calls[0]?.[0];
    const tabsUpdatedListener = onTabsUpdated.mock.calls[0]?.[0];
    if (!messageListener || !tabsUpdatedListener) throw new Error('Expected listeners');

    await expect(
      new Promise((resolve) => {
        messageListener({ type: 'learning-cycle:append', record: makeRecord({ threadId: '/app', id: 'record-2' }) }, { tab: { id: 202 } }, resolve);
      })
    ).resolves.toEqual({ ok: true });

    tabsUpdatedListener(202, { url: 'https://gemini.google.com/app/xyz', status: 'loading' }, { id: 202 });
    tabsUpdatedListener(202, { url: 'https://gemini.google.com/app/xyz', status: 'complete' }, { id: 202 });
    expect(resolveThreadIdForRecord).toHaveBeenCalledTimes(1);

    release?.(true);
    await vi.waitFor(() => {
      expect(resolveThreadIdForRecord).toHaveBeenCalledTimes(1);
    });
  });

  it('evicts unresolved pending records after timeout', async () => {
    vi.useFakeTimers();
    const append = vi.fn(async () => undefined);
    const hasAnyForThread = vi.fn(async () => false);
    const resolveThreadIdForRecord = vi.fn(async () => true);
    const onMessage = vi.fn();
    const onTabsUpdated = vi.fn();

    registerLearningCycleMessageHandlers(
      { append, hasAnyForThread, resolveThreadIdForRecord },
      {
        runtime: {
          onMessage: {
            addListener: onMessage
          }
        },
        tabs: {
          onUpdated: {
            addListener: onTabsUpdated
          }
        }
      },
      { pendingResolutionTimeoutMs: 50 }
    );

    const messageListener = onMessage.mock.calls[0]?.[0];
    const tabsUpdatedListener = onTabsUpdated.mock.calls[0]?.[0];
    if (!messageListener || !tabsUpdatedListener) throw new Error('Expected listeners');

    await expect(
      new Promise((resolve) => {
        messageListener({ type: 'learning-cycle:append', record: makeRecord({ threadId: '/app', id: 'record-3' }) }, { tab: { id: 303 } }, resolve);
      })
    ).resolves.toEqual({ ok: true });

    await vi.advanceTimersByTimeAsync(51);

    tabsUpdatedListener(303, { url: 'https://gemini.google.com/app/late-thread', status: 'complete' }, { id: 303 });
    await vi.waitFor(() => {
      expect(resolveThreadIdForRecord).not.toHaveBeenCalled();
    });
  });
});
