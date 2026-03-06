import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPendingThreadResolutionTracker } from '../../src/background/pending-thread-resolution';

describe('createPendingThreadResolutionTracker', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('resolves pending /app records from tabs.onUpdated concrete Gemini URL', async () => {
    const resolveThreadIdForRecord = vi.fn(async () => true);
    const addListener = vi.fn();

    const tracker = createPendingThreadResolutionTracker({
      store: { resolveThreadIdForRecord },
      tabs: {
        onUpdated: {
          addListener
        }
      }
    });

    const tabsUpdatedListener = addListener.mock.calls[0]?.[0];
    if (!tabsUpdatedListener) throw new Error('Expected tabs listener');

    tracker.trackPlaceholder('record-1', 101);
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
    const resolveThreadIdForRecord = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          release = resolve;
        })
    );
    const addListener = vi.fn();

    const tracker = createPendingThreadResolutionTracker({
      store: { resolveThreadIdForRecord },
      tabs: {
        onUpdated: {
          addListener
        }
      }
    });

    const tabsUpdatedListener = addListener.mock.calls[0]?.[0];
    if (!tabsUpdatedListener) throw new Error('Expected tabs listener');

    tracker.trackPlaceholder('record-2', 202);
    tabsUpdatedListener(202, { url: 'https://gemini.google.com/app/xyz', status: 'loading' }, { id: 202 });
    tabsUpdatedListener(202, { url: 'https://gemini.google.com/app/xyz', status: 'complete' }, { id: 202 });
    expect(resolveThreadIdForRecord).toHaveBeenCalledTimes(1);

    release?.(true);
    await vi.waitFor(() => {
      expect(resolveThreadIdForRecord).toHaveBeenCalledTimes(1);
    });
  });

  it('tracks only the latest pending placeholder per tab', async () => {
    const resolveThreadIdForRecord = vi.fn(async () => true);
    const addListener = vi.fn();

    const tracker = createPendingThreadResolutionTracker({
      store: { resolveThreadIdForRecord },
      tabs: {
        onUpdated: {
          addListener
        }
      }
    });

    const tabsUpdatedListener = addListener.mock.calls[0]?.[0];
    if (!tabsUpdatedListener) throw new Error('Expected tabs listener');

    tracker.trackPlaceholder('record-old', 707);
    tracker.trackPlaceholder('record-new', 707);

    tabsUpdatedListener(
      707,
      { url: 'https://gemini.google.com/app/threads/latest', status: 'complete' },
      { id: 707, url: 'https://gemini.google.com/app/threads/latest' }
    );

    await vi.waitFor(() => {
      expect(resolveThreadIdForRecord).toHaveBeenCalledTimes(1);
      expect(resolveThreadIdForRecord).toHaveBeenCalledWith('record-new', '/app', '/app/threads/latest');
    });
  });

  it('evicts unresolved pending records after timeout', async () => {
    vi.useFakeTimers();
    const resolveThreadIdForRecord = vi.fn(async () => true);
    const addListener = vi.fn();

    const tracker = createPendingThreadResolutionTracker({
      store: { resolveThreadIdForRecord },
      tabs: {
        onUpdated: {
          addListener
        }
      },
      pendingResolutionTimeoutMs: 50
    });

    const tabsUpdatedListener = addListener.mock.calls[0]?.[0];
    if (!tabsUpdatedListener) throw new Error('Expected tabs listener');

    tracker.trackPlaceholder('record-3', 303);
    await vi.advanceTimersByTimeAsync(51);
    tabsUpdatedListener(303, { url: 'https://gemini.google.com/app/late-thread', status: 'complete' }, { id: 303 });

    await vi.waitFor(() => {
      expect(resolveThreadIdForRecord).not.toHaveBeenCalled();
    });
  });

  it('uses debug logs for tabs events and resolution attempts', async () => {
    const resolveThreadIdForRecord = vi.fn(async () => true);
    const addListener = vi.fn();
    const debug = vi.fn();
    const info = vi.fn();

    const tracker = createPendingThreadResolutionTracker({
      store: { resolveThreadIdForRecord },
      tabs: {
        onUpdated: {
          addListener
        }
      },
      logger: { debug, info, error: vi.fn() }
    });

    const tabsUpdatedListener = addListener.mock.calls[0]?.[0];
    if (!tabsUpdatedListener) throw new Error('Expected tabs listener');

    tracker.trackPlaceholder('record-4', 404);
    tabsUpdatedListener(404, { url: 'https://gemini.google.com/app/abc', status: 'complete' }, { id: 404 });

    await vi.waitFor(() => {
      expect(debug).toHaveBeenCalledWith(
        'thread-id-resolution-tabs-event',
        expect.objectContaining({ tabId: 404, toThreadId: '/app/abc' })
      );
      expect(debug).toHaveBeenCalledWith(
        'thread-id-resolution-attempt',
        expect.objectContaining({ tabId: 404, recordId: 'record-4', toThreadId: '/app/abc' })
      );
      expect(info).toHaveBeenCalledWith(
        'thread-id-resolution-success',
        expect.objectContaining({ tabId: 404, recordId: 'record-4', toThreadId: '/app/abc' })
      );
    });
  });
});
