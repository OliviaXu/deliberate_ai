import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InterceptedSubmitIntent } from '../../src/shared/types';

const updateVisibilityForThread = vi.fn();
const startTrackingThread = vi.fn();
const observeFollowUpSubmission = vi.fn();
const getTrackedSubmitCount = vi.fn(() => 0);
const modalOpen = vi.fn(async () => ({ mode: 'learning' as const }));
const handleModeSubmission = vi.fn(async () => ({
  replayAttempted: true,
  appendSucceeded: true,
  record: {
    id: 'record-1',
    timestamp: 123,
    platform: 'gemini' as const,
    threadId: '/app',
    prompt: 'First prompt',
    mode: 'learning' as const
  }
}));

let interceptHandler: ((intent: InterceptedSubmitIntent) => void) | null = null;
let intervalCallback: (() => void) | null = null;
const runtimeSendMessage = vi.fn<(message: unknown) => Promise<{ record: unknown | null }>>(async () => ({ record: null }));

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

vi.mock('../../src/shared/debug-config', () => ({
  loadDebugConfig: () => ({})
}));

vi.mock('../../src/shared/logger', () => ({
  Logger: class {
    info(): void {}
    error(): void {}
  }
}));

vi.mock('../../src/content/send-interceptor', () => ({
  GeminiSendInterceptor: class {
    onIntercept(handler: (intent: InterceptedSubmitIntent) => void): void {
      interceptHandler = handler;
    }

    start(): void {}

    resume(): boolean {
      return true;
    }
  }
}));

vi.mock('../../src/content/mode-modal', () => ({
  ModeSelectionModal: class {
    open = modalOpen;
  }
}));

vi.mock('../../src/content/learning-cycle-flow', () => ({
  handleModeSubmission
}));

vi.mock('../../src/content/reflection-hint', () => ({
  ReflectionHint: class {
    updateVisibilityForThread = updateVisibilityForThread;
  }
}));

vi.mock('../../src/content/reflection-eligibility', () => ({
  ReflectionEligibilityTracker: class {
    startTrackingThread = startTrackingThread;
    observeFollowUpSubmission = observeFollowUpSubmission;
    getTrackedSubmitCount = getTrackedSubmitCount;
  }
}));

describe('content reflection hint refresh', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    interceptHandler = null;
    intervalCallback = null;
    window.history.replaceState({}, '', '/app');
    vi.spyOn(window, 'setInterval').mockImplementation((callback: TimerHandler) => {
      intervalCallback = callback as () => void;
      return 1 as unknown as ReturnType<typeof setInterval>;
    });
    (globalThis as { chrome?: unknown }).chrome = {
      runtime: {
        sendMessage: runtimeSendMessage
      }
    };
  });

  it('does not refresh hint visibility immediately after the first eligible append', async () => {
    await import('../../src/content/index');

    expect(updateVisibilityForThread).toHaveBeenCalledTimes(1);
    expect(runtimeSendMessage).not.toHaveBeenCalled();
    expect(interceptHandler).toBeTruthy();

    interceptHandler?.({
      source: 'enter_key',
      timestamp: 123,
      url: 'https://gemini.google.com/app',
      platform: 'gemini',
      interceptionId: 1,
      prompt: 'First prompt'
    });

    await flushAsyncWork();

    expect(startTrackingThread).not.toHaveBeenCalled();
    expect(runtimeSendMessage).not.toHaveBeenCalled();
    expect(updateVisibilityForThread).toHaveBeenCalledTimes(2);
    expect(updateVisibilityForThread).toHaveBeenNthCalledWith(2, '/app', false);
  });

  it('starts active tracking on the first bypassed concrete-thread submit using the persisted thread record timestamp', async () => {
    runtimeSendMessage.mockImplementation(async (message: unknown) => {
      const payload = message as { type?: string; threadId?: string };
      if (payload.type === 'learning-cycle:thread-record' && payload.threadId === '/app/threads/thread-a') {
        return {
          record: {
            id: 'record-1',
            timestamp: 999,
            platform: 'gemini',
            threadId: '/app/threads/thread-a',
            prompt: 'First prompt',
            mode: 'learning'
          }
        };
      }
      return { record: null };
    });

    await import('../../src/content/index');

    interceptHandler?.({
      source: 'enter_key',
      timestamp: 123,
      url: 'https://gemini.google.com/app',
      platform: 'gemini',
      interceptionId: 1,
      prompt: 'First prompt'
    });

    await flushAsyncWork();

    window.history.replaceState({}, '', '/app/threads/thread-a');

    interceptHandler?.({
      source: 'enter_key',
      timestamp: 2_000,
      url: 'https://gemini.google.com/app/threads/thread-a',
      platform: 'gemini',
      interceptionId: 2,
      prompt: 'Second turn'
    });

    await flushAsyncWork();

    expect(startTrackingThread).toHaveBeenCalledWith('/app/threads/thread-a');
  });

  it('retries a missing thread record on later refreshes and then starts tracking from the cached record', async () => {
    let threadRecordRequestCount = 0;
    runtimeSendMessage.mockImplementation(async (message: unknown) => {
      const payload = message as { type?: string; threadId?: string };
      if (payload.type === 'learning-cycle:thread-record' && payload.threadId === '/app/threads/thread-a') {
        threadRecordRequestCount += 1;
        if (threadRecordRequestCount === 1) {
          return { record: null };
        }

        return {
          record: {
            id: 'record-1',
            timestamp: 999,
            platform: 'gemini',
            threadId: '/app/threads/thread-a',
            prompt: 'First prompt',
            mode: 'learning'
          }
        };
      }
      return { record: null };
    });

    await import('../../src/content/index');

    interceptHandler?.({
      source: 'enter_key',
      timestamp: 123,
      url: 'https://gemini.google.com/app',
      platform: 'gemini',
      interceptionId: 1,
      prompt: 'First prompt'
    });

    await flushAsyncWork();

    window.history.replaceState({}, '', '/app/threads/thread-a');
    intervalCallback?.();
    await flushAsyncWork();

    expect(threadRecordRequestCount).toBe(1);

    intervalCallback?.();
    await flushAsyncWork();

    expect(threadRecordRequestCount).toBe(2);

    interceptHandler?.({
      source: 'enter_key',
      timestamp: 2_000,
      url: 'https://gemini.google.com/app/threads/thread-a',
      platform: 'gemini',
      interceptionId: 2,
      prompt: 'Second turn'
    });

    await flushAsyncWork();

    expect(threadRecordRequestCount).toBe(2);
    expect(startTrackingThread).toHaveBeenCalledWith('/app/threads/thread-a');
  });

  it('renders once after resolving a missing thread record for hint refresh', async () => {
    runtimeSendMessage.mockImplementation(async (message: unknown) => {
      const payload = message as { type?: string; threadId?: string };
      if (payload.type === 'learning-cycle:thread-record' && payload.threadId === '/app/threads/thread-a') {
        return {
          record: {
            id: 'record-1',
            timestamp: 999,
            platform: 'gemini',
            threadId: '/app/threads/thread-a',
            prompt: 'First prompt',
            mode: 'learning'
          }
        };
      }
      return { record: null };
    });

    await import('../../src/content/index');

    window.history.replaceState({}, '', '/app/threads/thread-a');

    intervalCallback?.();
    await flushAsyncWork();

    const threadSpecificVisibilityCalls = updateVisibilityForThread.mock.calls.filter(([threadId]) => threadId === '/app/threads/thread-a');
    expect(threadSpecificVisibilityCalls).toEqual([['/app/threads/thread-a', true]]);
  });
});
