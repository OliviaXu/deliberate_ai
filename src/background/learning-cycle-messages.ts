import type { LearningCycleStore } from '../shared/learning-cycle-store';
import { isPlaceholderGeminiThreadId, PLACEHOLDER_GEMINI_THREAD_ID, resolveConcreteGeminiThreadId } from '../shared/thread-id';
import type { LearningCycleRuntimeMessage } from '../shared/types';

interface RuntimeApi {
  onMessage: {
    addListener(
      listener: (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean | void
    ): void;
  };
}

interface TabsChangeInfo {
  url?: string;
  status?: string;
}

interface TabLike {
  id?: number;
  url?: string;
}

interface TabsApi {
  onUpdated?: {
    addListener(listener: (tabId: number, changeInfo: TabsChangeInfo, tab: TabLike) => void): void;
  };
}

interface ChromeApi {
  runtime?: RuntimeApi;
  tabs?: TabsApi;
}

interface RegisterLearningCycleMessageHandlersOptions {
  pendingResolutionTimeoutMs?: number;
}

interface PendingResolution {
  recordId: string;
  fromThreadId: string;
  timeoutId: ReturnType<typeof setTimeout>;
  resolving: boolean;
}

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
): void {
  const pendingResolutionTimeoutMs = options.pendingResolutionTimeoutMs ?? DEFAULT_PENDING_RESOLUTION_TIMEOUT_MS;
  const pendingByTab = new Map<number, Map<string, PendingResolution>>();

  const removePending = (tabId: number, recordId: string): void => {
    const pendingForTab = pendingByTab.get(tabId);
    if (!pendingForTab) return;
    const pending = pendingForTab.get(recordId);
    if (!pending) return;

    clearTimeout(pending.timeoutId);
    pendingForTab.delete(recordId);
    if (pendingForTab.size === 0) {
      pendingByTab.delete(tabId);
    }
  };

  const registerPending = (recordId: string, tabId: number): void => {
    removePending(tabId, recordId);
    const timeoutId = setTimeout(() => {
      const pendingForTab = pendingByTab.get(tabId);
      if (!pendingForTab?.has(recordId)) return;
      removePending(tabId, recordId);
      console.info('thread-id-resolution-timeout', {
        tabId,
        recordId,
        fromThreadId: PLACEHOLDER_GEMINI_THREAD_ID,
        timeoutMs: pendingResolutionTimeoutMs
      });
    }, pendingResolutionTimeoutMs);

    const pendingForTab = pendingByTab.get(tabId) ?? new Map<string, PendingResolution>();
    pendingForTab.set(recordId, {
      recordId,
      fromThreadId: PLACEHOLDER_GEMINI_THREAD_ID,
      timeoutId,
      resolving: false
    });
    pendingByTab.set(tabId, pendingForTab);
  };

  chromeApi.tabs?.onUpdated?.addListener((tabId: number, changeInfo: TabsChangeInfo, tab: TabLike) => {
    const toThreadId = resolveConcreteGeminiThreadId(changeInfo.url ?? tab.url);
    if (!toThreadId) return;

    const pendingForTab = pendingByTab.get(tabId);
    if (!pendingForTab || pendingForTab.size === 0) return;

    console.info('thread-id-resolution-tabs-event', {
      tabId,
      toThreadId,
      url: changeInfo.url ?? tab.url,
      status: changeInfo.status,
      pendingCount: pendingForTab.size
    });

    pendingForTab.forEach((pending) => {
      if (pending.resolving) return;
      pending.resolving = true;

      console.info('thread-id-resolution-attempt', {
        tabId,
        recordId: pending.recordId,
        fromThreadId: pending.fromThreadId,
        toThreadId
      });

      void store
        .resolveThreadIdForRecord(pending.recordId, pending.fromThreadId, toThreadId)
        .then((updated) => {
          if (updated) {
            console.info('thread-id-resolution-success', {
              tabId,
              recordId: pending.recordId,
              fromThreadId: pending.fromThreadId,
              toThreadId
            });
          } else {
            console.info('thread-id-resolution-noop', {
              tabId,
              recordId: pending.recordId,
              fromThreadId: pending.fromThreadId,
              toThreadId
            });
          }
          removePending(tabId, pending.recordId);
        })
        .catch((error) => {
          pending.resolving = false;
          console.error('thread-id-resolution-failed', {
            tabId,
            recordId: pending.recordId,
            fromThreadId: pending.fromThreadId,
            toThreadId,
            error: String(error)
          });
        });
    });
  });

  chromeApi.runtime?.onMessage.addListener((message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => {
    if (!isRuntimeMessage(message)) return undefined;

    if (message.type === 'learning-cycle:thread-has-entry') {
      void store
        .hasAnyForThread(message.threadId)
        .then((hasEntry) => sendResponse({ hasEntry }))
        .catch((error) => sendResponse({ error: String(error) }));
      return true;
    }

    void store
      .append(message.record)
      .then(() => {
        if (isPlaceholderGeminiThreadId(message.record.threadId)) {
          const tabId = getTabId(sender);
          if (typeof tabId === 'number') {
            registerPending(message.record.id, tabId);
          }
        }
        sendResponse({ ok: true });
      })
      .catch((error) => sendResponse({ error: String(error) }));
    return true;
  });
}

function getTabId(sender: unknown): number | undefined {
  if (!sender || typeof sender !== 'object') return undefined;
  const tabId = (sender as { tab?: { id?: unknown } }).tab?.id;
  return typeof tabId === 'number' ? tabId : undefined;
}
