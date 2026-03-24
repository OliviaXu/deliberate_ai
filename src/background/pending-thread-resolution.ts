import { PLACEHOLDER_GEMINI_THREAD_ID, resolveConcreteGeminiThreadId } from '../platforms/gemini/thread';
import type { LearningCycleStore } from '../shared/learning-cycle-store';

interface TabsChangeInfo {
  url?: string;
  status?: string;
}

interface TabLike {
  id?: number;
  url?: string;
}

export interface TabsApi {
  onUpdated?: {
    addListener(listener: (tabId: number, changeInfo: TabsChangeInfo, tab: TabLike) => void): void;
    removeListener?(listener: (tabId: number, changeInfo: TabsChangeInfo, tab: TabLike) => void): void;
  };
}

interface PendingResolution {
  recordId: string;
  fromThreadId: string;
  timeoutId: ReturnType<typeof setTimeout>;
  resolving: boolean;
}

export interface PendingThreadResolutionTracker {
  trackPlaceholder(recordId: string, tabId: number): void;
  dispose(): void;
}

interface LoggerLike {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

interface CreatePendingThreadResolutionTrackerParams {
  store: Pick<LearningCycleStore, 'resolveThreadIdForRecord'>;
  tabs?: TabsApi;
  pendingResolutionTimeoutMs?: number;
  logger?: LoggerLike;
}

const DEFAULT_PENDING_RESOLUTION_TIMEOUT_MS = 15_000;
const defaultLogger: LoggerLike = {
  debug: (message, meta) => console.debug(message, meta),
  info: (message, meta) => console.info(message, meta),
  error: (message, meta) => console.error(message, meta)
};

export function createPendingThreadResolutionTracker(
  params: CreatePendingThreadResolutionTrackerParams
): PendingThreadResolutionTracker {
  const { store, tabs, logger = defaultLogger } = params;
  const pendingResolutionTimeoutMs = params.pendingResolutionTimeoutMs ?? DEFAULT_PENDING_RESOLUTION_TIMEOUT_MS;
  const pendingByTab = new Map<number, PendingResolution>();

  const removePending = (tabId: number, recordId: string): void => {
    const pending = pendingByTab.get(tabId);
    if (!pending) return;
    if (pending.recordId !== recordId) return;

    clearTimeout(pending.timeoutId);
    pendingByTab.delete(tabId);
  };

  const readPending = (tabId: number): PendingResolution | undefined => pendingByTab.get(tabId);

  const buildResolutionLogMeta = (tabId: number, pending: PendingResolution, toThreadId: string) => ({
    tabId,
    recordId: pending.recordId,
    fromThreadId: pending.fromThreadId,
    toThreadId
  });

  const logTabsEvent = (tabId: number, toThreadId: string, changeInfo: TabsChangeInfo, tab: TabLike): void => {
    logger.debug('thread-id-resolution-tabs-event', {
      tabId,
      toThreadId,
      url: changeInfo.url ?? tab.url,
      status: changeInfo.status
    });
  };

  const logResolutionResult = (updated: boolean, meta: ReturnType<typeof buildResolutionLogMeta>): void => {
    if (updated) {
      logger.info('thread-id-resolution-success', meta);
      return;
    }
    logger.debug('thread-id-resolution-noop', meta);
  };

  const handleTabsUpdated = (tabId: number, changeInfo: TabsChangeInfo, tab: TabLike): void => {
    const toThreadId = resolveConcreteGeminiThreadId(changeInfo.url ?? tab.url);
    if (!toThreadId) return;

    const pending = readPending(tabId);
    if (!pending) return;

    logTabsEvent(tabId, toThreadId, changeInfo, tab);

    if (pending.resolving) return;
    pending.resolving = true;

    const resolutionMeta = buildResolutionLogMeta(tabId, pending, toThreadId);
    logger.debug('thread-id-resolution-attempt', resolutionMeta);

    void store
      .resolveThreadIdForRecord(pending.recordId, pending.fromThreadId, toThreadId)
      .then((updated) => {
        logResolutionResult(updated, resolutionMeta);
        removePending(tabId, pending.recordId);
      })
      .catch((error) => {
        const latest = readPending(tabId);
        if (latest?.recordId === pending.recordId) {
          latest.resolving = false;
        }
        logger.error('thread-id-resolution-failed', { ...resolutionMeta, error: String(error) });
      });
  };

  tabs?.onUpdated?.addListener(handleTabsUpdated);

  return {
    trackPlaceholder(recordId: string, tabId: number): void {
      const existing = pendingByTab.get(tabId);
      if (existing) {
        removePending(tabId, existing.recordId);
      }
      const timeoutId = setTimeout(() => {
        const latest = readPending(tabId);
        if (latest?.recordId !== recordId) return;
        removePending(tabId, recordId);
        logger.info('thread-id-resolution-timeout', {
          tabId,
          recordId,
          fromThreadId: PLACEHOLDER_GEMINI_THREAD_ID,
          timeoutMs: pendingResolutionTimeoutMs
        });
      }, pendingResolutionTimeoutMs);

      pendingByTab.set(tabId, {
        recordId,
        fromThreadId: PLACEHOLDER_GEMINI_THREAD_ID,
        timeoutId,
        resolving: false
      });
    },
    dispose(): void {
      pendingByTab.forEach((pending, tabId) => {
        removePending(tabId, pending.recordId);
      });
      tabs?.onUpdated?.removeListener?.(handleTabsUpdated);
    }
  };
}
