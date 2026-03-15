import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InterceptedSubmitIntent, ReflectionEligibleLearningCycleRecord, ReflectionSubmission } from '../../src/shared/types';

const updateVisibilityForThread = vi.fn();
const startTrackingThread = vi.fn();
const observeFollowUpSubmission = vi.fn();
const getTrackedSubmitCount = vi.fn(() => 0);
const modalOpen = vi.fn(async () => ({ mode: 'learning' as const }));
const reflectionModalOpen = vi.fn<(record: ReflectionEligibleLearningCycleRecord) => Promise<ReflectionSubmission | null>>(async () => null);
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
let reviewHandler: ((threadId: string) => Promise<void> | void) | null = null;
const runtimeSendMessage = vi.fn<(message: unknown) => Promise<unknown>>(async () => ({ record: null }));

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
    constructor(options?: { onReview?: (threadId: string) => Promise<void> | void }) {
      reviewHandler = options?.onReview ?? null;
    }

    updateVisibilityForThread = updateVisibilityForThread;
  }
}));

vi.mock('../../src/content/reflection-modal', () => ({
  ReflectionModal: class {
    open = reflectionModalOpen;
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
    getTrackedSubmitCount.mockImplementation(() => 0);
    modalOpen.mockImplementation(async () => ({ mode: 'learning' as const }));
    reflectionModalOpen.mockReset();
    reflectionModalOpen.mockImplementation(async () => null);
    handleModeSubmission.mockImplementation(async () => ({
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
    runtimeSendMessage.mockReset();
    runtimeSendMessage.mockImplementation(async () => ({ record: null }));
    interceptHandler = null;
    intervalCallback = null;
    reviewHandler = null;
    window.history.replaceState({}, '', '/app');
    document.documentElement.removeAttribute('data-deliberate-now-ms');
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

  it('does not query persistent entries for placeholder thread ids after the first eligible append', async () => {
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
      const payload = message as { type?: string; threadId?: string; learningCycleRecordId?: string };
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

  it('opens the reflection modal for a due thread and hides the cue after completion persists', async () => {
    document.documentElement.setAttribute('data-deliberate-now-ms', String(2_000_000));
    window.history.replaceState({}, '', '/app/threads/thread-a');
    runtimeSendMessage.mockImplementation(async (message: unknown) => {
      const payload = message as { type?: string; threadId?: string; learningCycleRecordId?: string };
      if (payload.type === 'learning-cycle:thread-record' && payload.threadId === '/app/threads/thread-a') {
        return {
          record: {
            id: 'record-1',
            timestamp: 0,
            platform: 'gemini',
            threadId: '/app/threads/thread-a',
            prompt: 'Teach me staged rollout tradeoffs',
            mode: 'learning',
            priorKnowledgeNote: 'I know feature flags already.'
          }
        };
      }

      if (payload.type === 'reflection:record-has-completed' && payload.learningCycleRecordId === 'record-1') {
        return { hasCompletedReflection: false };
      }

      if (payload.type === 'reflection:append') {
        return { ok: true };
      }

      return { record: null };
    });
    reflectionModalOpen.mockResolvedValueOnce({
      score: 75,
      notes: 'I should anchor the comparison around rollback criteria sooner.'
    });

    await import('../../src/content/index');
    await flushAsyncWork();

    expect(updateVisibilityForThread).toHaveBeenLastCalledWith('/app/threads/thread-a', true);
    expect(reviewHandler).toBeTruthy();

    await reviewHandler?.('/app/threads/thread-a');
    await flushAsyncWork();

    expect(reflectionModalOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: '/app/threads/thread-a',
        mode: 'learning'
      })
    );
    expect(runtimeSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'reflection:append',
        record: expect.objectContaining({
          threadId: '/app/threads/thread-a',
          learningCycleRecordId: 'record-1',
          status: 'completed',
          score: 75,
          notes: 'I should anchor the comparison around rollback criteria sooner.'
        })
      })
    );
    expect(runtimeSendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'reflection:append',
        record: expect.objectContaining({
          platform: 'gemini'
        })
      })
    );
    expect(updateVisibilityForThread).toHaveBeenLastCalledWith('/app/threads/thread-a', false);
  });

  it('omits blank reflection notes from the appended record', async () => {
    document.documentElement.setAttribute('data-deliberate-now-ms', String(2_000_000));
    window.history.replaceState({}, '', '/app/threads/thread-a');
    runtimeSendMessage.mockImplementation(async (message: unknown) => {
      const payload = message as { type?: string; threadId?: string; learningCycleRecordId?: string };
      if (payload.type === 'learning-cycle:thread-record' && payload.threadId === '/app/threads/thread-a') {
        return {
          record: {
            id: 'record-1',
            timestamp: 0,
            platform: 'gemini',
            threadId: '/app/threads/thread-a',
            prompt: 'Teach me staged rollout tradeoffs',
            mode: 'learning',
            priorKnowledgeNote: 'I know feature flags already.'
          }
        };
      }

      if (payload.type === 'reflection:record-has-completed' && payload.learningCycleRecordId === 'record-1') {
        return { hasCompletedReflection: false };
      }

      if (payload.type === 'reflection:append') {
        return { ok: true };
      }

      return { record: null };
    });
    reflectionModalOpen.mockResolvedValueOnce({
      score: 75,
      notes: '   '
    });

    await import('../../src/content/index');
    await flushAsyncWork();

    await reviewHandler?.('/app/threads/thread-a');
    await flushAsyncWork();

    expect(runtimeSendMessage).toHaveBeenCalledWith({
      type: 'reflection:append',
      record: expect.objectContaining({
        threadId: '/app/threads/thread-a',
        learningCycleRecordId: 'record-1',
        status: 'completed',
        score: 75
      })
    });
    expect(runtimeSendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'reflection:append',
        record: expect.objectContaining({
          notes: expect.any(String)
        })
      })
    );
  });

  it('opens the reflection modal without re-checking completion status at review time', async () => {
    document.documentElement.setAttribute('data-deliberate-now-ms', String(2_000_000));
    window.history.replaceState({}, '', '/app/threads/thread-a');
    let completionStatusChecks = 0;
    runtimeSendMessage.mockImplementation(async (message: unknown) => {
      const payload = message as { type?: string; threadId?: string; learningCycleRecordId?: string };
      if (payload.type === 'learning-cycle:thread-record' && payload.threadId === '/app/threads/thread-a') {
        return {
          record: {
            id: 'record-1',
            timestamp: 0,
            platform: 'gemini',
            threadId: '/app/threads/thread-a',
            prompt: 'Teach me staged rollout tradeoffs',
            mode: 'learning',
            priorKnowledgeNote: 'I know feature flags already.'
          }
        };
      }

      if (payload.type === 'reflection:record-has-completed' && payload.learningCycleRecordId === 'record-1') {
        completionStatusChecks += 1;
        return { hasCompletedReflection: completionStatusChecks > 1 };
      }

      if (payload.type === 'reflection:append') {
        return { ok: true };
      }

      return { record: null };
    });
    reflectionModalOpen.mockResolvedValueOnce({
      score: 75,
      notes: 'I should anchor the comparison around rollback criteria sooner.'
    });

    await import('../../src/content/index');
    await flushAsyncWork();

    await reviewHandler?.('/app/threads/thread-a');
    await flushAsyncWork();

    expect(completionStatusChecks).toBe(1);
    expect(reflectionModalOpen).toHaveBeenCalledOnce();
    expect(runtimeSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'reflection:append',
        record: expect.objectContaining({
          threadId: '/app/threads/thread-a',
          learningCycleRecordId: 'record-1',
          status: 'completed',
          score: 75
        })
      })
    );
  });

  it('opens the reflection modal without re-checking due status at review time', async () => {
    document.documentElement.setAttribute('data-deliberate-now-ms', String(2_000_000));
    window.history.replaceState({}, '', '/app/threads/thread-a');
    runtimeSendMessage.mockImplementation(async (message: unknown) => {
      const payload = message as { type?: string; threadId?: string; learningCycleRecordId?: string };
      if (payload.type === 'learning-cycle:thread-record' && payload.threadId === '/app/threads/thread-a') {
        return {
          record: {
            id: 'record-1',
            timestamp: 0,
            platform: 'gemini',
            threadId: '/app/threads/thread-a',
            prompt: 'Teach me staged rollout tradeoffs',
            mode: 'learning',
            priorKnowledgeNote: 'I know feature flags already.'
          }
        };
      }

      if (payload.type === 'reflection:record-has-completed' && payload.learningCycleRecordId === 'record-1') {
        return { hasCompletedReflection: false };
      }

      if (payload.type === 'reflection:append') {
        return { ok: true };
      }

      return { record: null };
    });
    reflectionModalOpen.mockResolvedValueOnce({
      score: 75,
      notes: 'I should anchor the comparison around rollback criteria sooner.'
    });

    await import('../../src/content/index');
    await flushAsyncWork();

    document.documentElement.setAttribute('data-deliberate-now-ms', String(1));

    await reviewHandler?.('/app/threads/thread-a');
    await flushAsyncWork();

    expect(reflectionModalOpen).toHaveBeenCalledOnce();
    expect(runtimeSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'reflection:append',
        record: expect.objectContaining({
          threadId: '/app/threads/thread-a',
          learningCycleRecordId: 'record-1',
          status: 'completed',
          score: 75
        })
      })
    );
  });

  it('keeps the cue visible when the reflection modal closes without submission', async () => {
    document.documentElement.setAttribute('data-deliberate-now-ms', String(2_000_000));
    window.history.replaceState({}, '', '/app/threads/thread-a');
    runtimeSendMessage.mockImplementation(async (message: unknown) => {
      const payload = message as { type?: string; threadId?: string; learningCycleRecordId?: string };
      if (payload.type === 'learning-cycle:thread-record' && payload.threadId === '/app/threads/thread-a') {
        return {
          record: {
            id: 'record-1',
            timestamp: 0,
            platform: 'gemini',
            threadId: '/app/threads/thread-a',
            prompt: 'Teach me staged rollout tradeoffs',
            mode: 'learning',
            priorKnowledgeNote: 'I know feature flags already.'
          }
        };
      }

      if (payload.type === 'reflection:record-has-completed' && payload.learningCycleRecordId === 'record-1') {
        return { hasCompletedReflection: false };
      }

      return { record: null };
    });
    reflectionModalOpen.mockResolvedValueOnce(null);

    await import('../../src/content/index');
    await flushAsyncWork();

    await reviewHandler?.('/app/threads/thread-a');
    await flushAsyncWork();

    const threadSpecificVisibilityCalls = updateVisibilityForThread.mock.calls.filter(([currentThreadId]) => currentThreadId === '/app/threads/thread-a');

    expect(reflectionModalOpen).toHaveBeenCalledOnce();
    expect(runtimeSendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'reflection:append' }));
    expect(updateVisibilityForThread).toHaveBeenLastCalledWith('/app/threads/thread-a', true);
    expect(threadSpecificVisibilityCalls).toEqual([['/app/threads/thread-a', true]]);
  });

  it('does not force a hint refresh when reflection append fails', async () => {
    document.documentElement.setAttribute('data-deliberate-now-ms', String(2_000_000));
    window.history.replaceState({}, '', '/app/threads/thread-a');
    runtimeSendMessage.mockImplementation(async (message: unknown) => {
      const payload = message as { type?: string; threadId?: string; learningCycleRecordId?: string };
      if (payload.type === 'learning-cycle:thread-record' && payload.threadId === '/app/threads/thread-a') {
        return {
          record: {
            id: 'record-1',
            timestamp: 0,
            platform: 'gemini',
            threadId: '/app/threads/thread-a',
            prompt: 'Teach me staged rollout tradeoffs',
            mode: 'learning',
            priorKnowledgeNote: 'I know feature flags already.'
          }
        };
      }

      if (payload.type === 'reflection:record-has-completed' && payload.learningCycleRecordId === 'record-1') {
        return { hasCompletedReflection: false };
      }

      if (payload.type === 'reflection:append') {
        return { ok: false };
      }

      return { record: null };
    });
    reflectionModalOpen.mockResolvedValueOnce({
      score: 75,
      notes: 'I should anchor the comparison around rollback criteria sooner.'
    });

    await import('../../src/content/index');
    await flushAsyncWork();

    await reviewHandler?.('/app/threads/thread-a');
    await flushAsyncWork();

    const threadSpecificVisibilityCalls = updateVisibilityForThread.mock.calls.filter(([currentThreadId]) => currentThreadId === '/app/threads/thread-a');

    expect(reflectionModalOpen).toHaveBeenCalledOnce();
    expect(runtimeSendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'reflection:append' }));
    expect(updateVisibilityForThread).toHaveBeenLastCalledWith('/app/threads/thread-a', true);
    expect(threadSpecificVisibilityCalls).toEqual([['/app/threads/thread-a', true]]);
  });
});
