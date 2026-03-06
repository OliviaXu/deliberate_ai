import type { LearningCycleStore } from '../shared/learning-cycle-store';
import { isPlaceholderGeminiThreadId } from '../shared/thread-id';
import type { LearningCycleRuntimeMessage } from '../shared/types';
import { createPendingThreadResolutionTracker, type PendingThreadResolutionTracker, type TabsApi } from './pending-thread-resolution';

interface RuntimeApi {
  onMessage: {
    addListener(
      listener: (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean | void
    ): void;
    removeListener?(
      listener: (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean | void
    ): void;
  };
}

interface ChromeApi {
  runtime?: RuntimeApi;
  tabs?: TabsApi;
}

interface RegisterLearningCycleMessageHandlersOptions {
  pendingResolutionTimeoutMs?: number;
  trackerFactory?: (params: PendingTrackerFactoryParams) => PendingThreadResolutionTracker;
}

type PendingTrackerFactoryParams = Parameters<typeof createPendingThreadResolutionTracker>[0];

function isRuntimeMessage(message: unknown): message is LearningCycleRuntimeMessage {
  if (!message || typeof message !== 'object') return false;
  const maybe = message as { type?: string };
  return maybe.type === 'learning-cycle:append' || maybe.type === 'learning-cycle:thread-has-entry';
}

const DEFAULT_PENDING_RESOLUTION_TIMEOUT_MS = 15_000;

export function registerLearningCycleMessageHandlers(
  store: Pick<LearningCycleStore, 'append' | 'hasAnyForThread' | 'resolveThreadIdForRecord'>,
  chromeApi: ChromeApi = (globalThis as { chrome?: ChromeApi }).chrome || {},
  options: RegisterLearningCycleMessageHandlersOptions = {}
): () => void {
  const trackerParams: PendingTrackerFactoryParams = {
    store,
    pendingResolutionTimeoutMs: options.pendingResolutionTimeoutMs ?? DEFAULT_PENDING_RESOLUTION_TIMEOUT_MS,
    ...(chromeApi.tabs ? { tabs: chromeApi.tabs } : {})
  };
  const buildPendingTracker = options.trackerFactory ?? createPendingThreadResolutionTracker;
  const pendingTracker = buildPendingTracker(trackerParams);

  const handleThreadHasEntryMessage = (
    message: Extract<LearningCycleRuntimeMessage, { type: 'learning-cycle:thread-has-entry' }>,
    sendResponse: (response: unknown) => void
  ): boolean => {
    void store
      .hasAnyForThread(message.threadId)
      .then((hasEntry) => sendResponse({ hasEntry }))
      .catch((error) => sendResponse({ error: String(error) }));
    return true;
  };

  const handleAppendMessage = (
    message: Extract<LearningCycleRuntimeMessage, { type: 'learning-cycle:append' }>,
    sender: unknown,
    sendResponse: (response: unknown) => void
  ): boolean => {
    void store
      .append(message.record)
      .then(() => {
        trackPendingPlaceholderFromSender(message, sender, pendingTracker);
        sendResponse({ ok: true });
      })
      .catch((error) => sendResponse({ error: String(error) }));
    return true;
  };

  const runtimeMessageListener = (
    message: unknown,
    sender: unknown,
    sendResponse: (response: unknown) => void
  ): boolean | void => {
    if (!isRuntimeMessage(message)) return undefined;

    switch (message.type) {
      case 'learning-cycle:thread-has-entry':
        return handleThreadHasEntryMessage(message, sendResponse);
      case 'learning-cycle:append':
        return handleAppendMessage(message, sender, sendResponse);
      default:
        return undefined;
    }
  };

  chromeApi.runtime?.onMessage.addListener(runtimeMessageListener);

  return () => {
    pendingTracker.dispose();
    chromeApi.runtime?.onMessage.removeListener?.(runtimeMessageListener);
  };
}

function trackPendingPlaceholderFromSender(
  message: Extract<LearningCycleRuntimeMessage, { type: 'learning-cycle:append' }>,
  sender: unknown,
  pendingTracker: Pick<PendingThreadResolutionTracker, 'trackPlaceholder'>
): void {
  if (!isPlaceholderGeminiThreadId(message.record.threadId)) return;
  if (!sender || typeof sender !== 'object') return;
  const tabId = (sender as { tab?: { id?: unknown } }).tab?.id;
  if (!isInteger(tabId)) return;
  pendingTracker.trackPlaceholder(message.record.id, tabId);
}

function isInteger(value: unknown): value is number {
  return Number.isInteger(value);
}
