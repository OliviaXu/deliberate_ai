import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResurfacingCandidate } from '../../src/shared/types';

const show = vi.fn<(candidate: ResurfacingCandidate) => void>();
const refreshAnchor = vi.fn();
const loggerError = vi.fn();
let openHandler: ((recordId: string) => Promise<void> | void) | undefined;
const resurfacingCandidate: ResurfacingCandidate = {
  learningCycleId: 'old-1',
  excerpt: 'A past thought'
};
const runtimeSendMessage = vi.fn<(message: unknown) => Promise<unknown>>(async (message: unknown) => {
  const type = (message as { type?: string }).type;
  if (type === 'resurfacing:present-next') {
    return { candidate: resurfacingCandidate };
  }
  return { record: null };
});

vi.mock('../../src/shared/debug-config', () => ({ loadDebugConfig: () => ({}) }));
vi.mock('../../src/shared/logger', () => ({
  Logger: class {
    info(): void {}
    error = loggerError;
  }
}));
vi.mock('../../src/content/send-interceptor', () => ({
  SendInterceptor: class {
    onIntercept(): void {}
    start(): void {}
  }
}));
vi.mock('../../src/content/mode-modal', () => ({ ModeSelectionModal: class {} }));
vi.mock('../../src/content/reflection-modal', () => ({ ReflectionModal: class {} }));
vi.mock('../../src/content/reflection-hint', () => ({
  ReflectionHint: class { updateVisibilityForThread(): void {} }
}));
vi.mock('../../src/content/reflection-eligibility', () => ({
  ReflectionEligibilityTracker: class { getTrackedSubmitCount(): number { return 0; } }
}));
vi.mock('../../src/content/resurfacing-glint', () => ({
  ResurfacingGlint: class {
    show = show;
    refreshAnchor = refreshAnchor;
    constructor(options: { onOpen: (recordId: string) => Promise<void> | void }) {
      openHandler = options.onOpen;
    }
  }
}));

describe('content resurfacing glint lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    openHandler = undefined;
    window.history.replaceState({}, '', '/app');
    (globalThis as { chrome?: unknown }).chrome = { runtime: { sendMessage: runtimeSendMessage } };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('requests and shows at most one candidate after the fixed page delay', async () => {
    const { startContentApp, RESURFACING_GLINT_DELAY_MS } = await import('../../src/content/app');
    const platform = {
      id: 'gemini',
      appearance: { skin: 'gemini' },
      resolveThreadId: () => '/app',
      isConcreteThreadId: () => false,
      findComposer: () => null,
      findComposerAnchor: () => null
    } as never;

    await startContentApp({ now: () => Date.now(), platform });
    await vi.advanceTimersByTimeAsync(RESURFACING_GLINT_DELAY_MS - 1);
    expect(runtimeSendMessage).not.toHaveBeenCalledWith({ type: 'resurfacing:present-next' });

    await vi.advanceTimersByTimeAsync(1);
    expect(runtimeSendMessage).toHaveBeenCalledWith({ type: 'resurfacing:present-next' });
    expect(show).toHaveBeenCalledWith({ learningCycleId: 'old-1', excerpt: 'A past thought' });
    expect(show.mock.calls[0]?.[0]).toBe(resurfacingCandidate);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(
      runtimeSendMessage.mock.calls.filter(([message]) => (message as { type?: string }).type === 'resurfacing:present-next')
    ).toHaveLength(1);
  });

  it('opens the selected journal entry when the glint callback fires', async () => {
    const { startContentApp } = await import('../../src/content/app');
    const platform = {
      id: 'gemini', appearance: { skin: 'gemini' }, resolveThreadId: () => '/app', isConcreteThreadId: () => false,
      findComposer: () => null, findComposerAnchor: () => null
    } as never;

    await startContentApp({ now: () => Date.now(), platform });
    await openHandler?.('old / 1');

    expect(runtimeSendMessage).toHaveBeenCalledWith({
      type: 'resurfacing:open-journal',
      learningCycleId: 'old / 1'
    });
  });

  it('does not reinterpret a resolved journal response as a transport error', async () => {
    runtimeSendMessage.mockResolvedValueOnce({ error: 'tabs unavailable' });
    const { startContentApp } = await import('../../src/content/app');
    const platform = {
      id: 'gemini', appearance: { skin: 'gemini' }, resolveThreadId: () => '/app', isConcreteThreadId: () => false,
      findComposer: () => null, findComposerAnchor: () => null
    } as never;

    await startContentApp({ now: () => Date.now(), platform });
    await openHandler?.('old-1');

    expect(loggerError).not.toHaveBeenCalledWith('resurfacing-journal-open-failed', expect.anything());
  });

  it('does not reinterpret a resolved presentation response as a transport error', async () => {
    runtimeSendMessage.mockResolvedValueOnce({ error: 'storage unavailable' });
    const { startContentApp, RESURFACING_GLINT_DELAY_MS } = await import('../../src/content/app');
    const platform = {
      id: 'gemini', appearance: { skin: 'gemini' }, resolveThreadId: () => '/app', isConcreteThreadId: () => false,
      findComposer: () => null, findComposerAnchor: () => null
    } as never;

    await startContentApp({ now: () => Date.now(), platform });
    await vi.advanceTimersByTimeAsync(RESURFACING_GLINT_DELAY_MS);

    expect(loggerError).not.toHaveBeenCalledWith('resurfacing-presentation-failed', expect.anything());
    expect(show).not.toHaveBeenCalled();
  });
});
