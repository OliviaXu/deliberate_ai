import type { LearningCycleStore } from '../shared/learning-cycle-store';
import { resolvePlatformById } from '../platforms';
import type { LearningCycleRuntimeMessage, PlatformThreadIdentity } from '../shared/types';
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
  return maybe.type === 'learning-cycle:append' || maybe.type === 'learning-cycle:thread-record';
}

const DEFAULT_PENDING_RESOLUTION_TIMEOUT_MS = 15_000;

export function registerLearningCycleMessageHandlers(
  store: Pick<LearningCycleStore, 'append' | 'resolveThreadIdForRecord' | 'getLatestForThread'>,
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

  const handleThreadRecordMessage = (
    message: Extract<LearningCycleRuntimeMessage, { type: 'learning-cycle:thread-record' }>,
    sendResponse: (response: unknown) => void
  ): boolean => {
    void store
      .getLatestForThread({ platform: message.platform, threadId: message.threadId })
      .then((record) => sendResponse({ record }))
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
      case 'learning-cycle:append':
        return handleAppendMessage(message, sender, sendResponse);
      case 'learning-cycle:thread-record':
        return handleThreadRecordMessage(message, sendResponse);
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
  const thread = getRecordThreadIdentity(message);
  const platform = resolvePlatformById(thread.platform);
  if (!platform?.isPlaceholderThreadId(thread.threadId)) return;
  if (!sender || typeof sender !== 'object') return;
  const tabId = (sender as { tab?: { id?: unknown } }).tab?.id;
  if (!isInteger(tabId)) return;
  pendingTracker.trackPlaceholder(message.record.id, tabId, thread);
}

function isInteger(value: unknown): value is number {
  return Number.isInteger(value);
}

function getRecordThreadIdentity(
  message: Extract<LearningCycleRuntimeMessage, { type: 'learning-cycle:append' }>
): PlatformThreadIdentity {
  return {
    platform: message.record.platform,
    threadId: message.record.threadId
  };
}
