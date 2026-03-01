import { loadDebugConfig } from '../shared/debug-config';
import { Logger } from '../shared/logger';
import { resolveThreadId } from '../shared/thread-id';
import type { InterceptedSubmitIntent, LearningCycleRuntimeMessage } from '../shared/types';
import { handleModeSubmission } from './learning-cycle-flow';
import { ModeSelectionModal } from './mode-modal';
import { GeminiSendInterceptor } from './send-interceptor';

const logger = new Logger(loadDebugConfig());
const interceptor = new GeminiSendInterceptor(logger);
const modal = new ModeSelectionModal();
const threadModalDecisionCache = new Map<string, 'skip'>();
const pendingThreadChecks = new Map<string, Promise<boolean>>();
let interceptionCount = 0;
let modalOpen = false;
let handlingIntercept = false;

interceptor.onIntercept((intent) => {
  interceptionCount += 1;
  logger.info('submit-intent-detected', intent);
  if (handlingIntercept) return;

  handlingIntercept = true;
  void handleIntercept(intent).finally(() => {
    handlingIntercept = false;
    modalOpen = false;
    setDomState(interceptionCount, false);
  });
});

interceptor.start();
setDomState(interceptionCount, false);

async function handleIntercept(intent: InterceptedSubmitIntent): Promise<void> {
  const threadId = resolveThreadId(intent.url);

  if (threadModalDecisionCache.get(threadId) === 'skip') {
    const replayAttempted = interceptor.resume(intent);
    logger.info('thread-entry-modal-bypassed', {
      source: 'memory-cache',
      threadId,
      replayAttempted,
      interceptionId: intent.interceptionId
    });
    return;
  }

  const shouldShowModal = await resolveShouldShowModal(threadId);
  if (!shouldShowModal) {
    const replayAttempted = interceptor.resume(intent);
    logger.info('thread-entry-modal-bypassed', {
      source: 'persistent-records',
      threadId,
      replayAttempted,
      interceptionId: intent.interceptionId
    });

    if (replayAttempted) {
      threadModalDecisionCache.set(threadId, 'skip');
    }
    return;
  }

  modalOpen = true;
  setDomState(interceptionCount, true);

  const submission = await modal.open();
  logger.info('mode-selected', { mode: submission.mode, interceptionId: intent.interceptionId });

  const result = await handleModeSubmission({
    intent,
    submission,
    sendMessage: sendRuntimeMessage,
    resume: (value) => interceptor.resume(value),
    logger
  });

  if (result.replayAttempted && result.appendSucceeded) {
    threadModalDecisionCache.set(threadId, 'skip');
    logger.info('thread-entry-modal-consumed', {
      threadId,
      interceptionId: intent.interceptionId,
      mode: result.record.mode
    });
  }
}

async function resolveShouldShowModal(threadId: string): Promise<boolean> {
  if (threadModalDecisionCache.get(threadId) === 'skip') return false;

  const pending = pendingThreadChecks.get(threadId);
  if (pending) return pending;

  const check = Promise.resolve(
    sendRuntimeMessage({
      type: 'learning-cycle:thread-has-entry',
      threadId
    })
  )
    .then((response) => {
      if (!isThreadHasEntryResponse(response)) return true;
      if (!response.hasEntry) return true;
      threadModalDecisionCache.set(threadId, 'skip');
      return false;
    })
    .catch((error) => {
      logger.error('thread-entry-check-failed', { threadId, error: String(error) });
      return true;
    })
    .finally(() => {
      pendingThreadChecks.delete(threadId);
    });

  pendingThreadChecks.set(threadId, check);
  return check;
}

function isThreadHasEntryResponse(value: unknown): value is { hasEntry: boolean } {
  if (!value || typeof value !== 'object') return false;
  return typeof (value as { hasEntry?: unknown }).hasEntry === 'boolean';
}

function setDomState(count: number, isModalOpen: boolean): void {
  document.documentElement.setAttribute('data-deliberate-active', 'true');
  document.documentElement.setAttribute('data-deliberate-signal-count', String(count));
  document.documentElement.setAttribute('data-deliberate-modal-open', String(isModalOpen));
}

function sendRuntimeMessage(message: LearningCycleRuntimeMessage): Promise<unknown> | undefined {
  const chromeApi = (globalThis as { chrome?: { runtime?: { sendMessage?: (payload: unknown) => Promise<unknown> | unknown } } }).chrome;
  const send = chromeApi?.runtime?.sendMessage;
  if (!send) return undefined;
  return Promise.resolve(send(message));
}
