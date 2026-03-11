import { loadDebugConfig } from '../shared/debug-config';
import { Logger } from '../shared/logger';
import { resolveThreadId } from '../shared/thread-id';
import type {
  InteractionMode,
  InterceptedSubmitIntent,
  LearningCycleRecord,
  LearningCycleRuntimeMessage,
  ReflectionEligibleInteractionMode
} from '../shared/types';
import { getContentNowMs } from './clock';
import { handleModeSubmission } from './learning-cycle-flow';
import { ReflectionEligibilityTracker } from './reflection-eligibility';
import { ModeSelectionModal } from './mode-modal';
import { ReflectionHint } from './reflection-hint';
import { GeminiSendInterceptor } from './send-interceptor';
import { isThreadIdCacheable, shouldCheckPersistentThreadEntries } from './thread-entry-policy';

const DUE_AFTER_MS = 5 * 60 * 1000;
const ACTIVE_FOLLOW_UP_THRESHOLD = 3;

const logger = new Logger(loadDebugConfig());
const interceptor = new GeminiSendInterceptor(logger);
const modal = new ModeSelectionModal();
const reflectionHint = new ReflectionHint();
const reflectionEligibility = new ReflectionEligibilityTracker();
const threadRecordCache = new Map<string, LearningCycleRecord | null>();
const pendingThreadRecordChecks = new Map<string, Promise<LearningCycleRecord | null>>();
let awaitingNewThreadFollowUp = false;
let interceptionCount = 0;
let busyDropCount = 0;
let modalOpen = false;
// Guard to keep modal/check/capture flow single-flight.
let handlingIntercept = false;

interceptor.onIntercept((intent) => {
  interceptionCount += 1;
  logger.info('submit-intent-detected', intent);
  if (handlingIntercept) {
    // Risk note:
    // This submit was already preventDefault'd by the interceptor and is dropped here.
    // We avoid replaying from this branch because replaying a newer intent can overwrite
    // interceptor internal state and cause the older in-flight intent replay to fail.
    // Keep this instrumented so we can quantify real-world frequency before redesigning.
    busyDropCount += 1;
    logger.info('submit-intent-dropped-while-busy', {
      busyDropCount,
      threadId: resolveThreadId(intent.url),
      interceptionId: intent.interceptionId
    });
    setDomState(interceptionCount, modalOpen);
    return;
  }

  handlingIntercept = true;
  void handleIntercept(intent).finally(() => {
    handlingIntercept = false;
    modalOpen = false;
    setDomState(interceptionCount, false);
    void refreshReflectionHintForCurrentThread();
  });
});

interceptor.start();
setDomState(interceptionCount, false);
void refreshReflectionHintForCurrentThread();
startReflectionHintWatcher();

async function handleIntercept(intent: InterceptedSubmitIntent): Promise<void> {
  const threadId = resolveThreadId(intent.url);
  const threadRecord = await resolveThreadRecord(threadId);
  if (threadRecord) {
    if (!maybeStartActiveCandidateFromNewThread(threadId, threadRecord)) {
      reflectionEligibility.observeFollowUpSubmission(threadId);
    }
    const replayAttempted = interceptor.resume(intent);
    logger.info('thread-entry-modal-bypassed', {
      source: 'thread-record',
      threadId,
      replayAttempted,
      interceptionId: intent.interceptionId
    });
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
    if (isModeEligibleForReflectionHint(result.record.mode)) {
      awaitingNewThreadFollowUp = true;
    }

    if (isThreadIdCacheable(threadId)) {
      threadRecordCache.set(threadId, result.record);
      logger.info('thread-entry-modal-consumed', {
        threadId,
        interceptionId: intent.interceptionId,
        mode: result.record.mode
      });
    }
  }
}

function setDomState(count: number, isModalOpen: boolean): void {
  document.documentElement.setAttribute('data-deliberate-active', 'true');
  document.documentElement.setAttribute('data-deliberate-signal-count', String(count));
  document.documentElement.setAttribute('data-deliberate-modal-open', String(isModalOpen));
  document.documentElement.setAttribute('data-deliberate-busy-drop-count', String(busyDropCount));
}

function sendRuntimeMessage(message: LearningCycleRuntimeMessage): Promise<unknown> | undefined {
  const chromeApi = (globalThis as { chrome?: { runtime?: { sendMessage?: (payload: unknown) => Promise<unknown> | unknown } } }).chrome;
  const send = chromeApi?.runtime?.sendMessage;
  if (!send) return undefined;
  return Promise.resolve(send(message));
}

async function refreshReflectionHintForCurrentThread(): Promise<void> {
  const threadId = resolveThreadId(window.location.href);
  let threadRecord = threadRecordCache.get(threadId);
  if (threadRecord === undefined) {
    threadRecord = await resolveThreadRecord(threadId);
  }

  reflectionHint.updateVisibilityForThread(threadId, isReflectionDueForThread(threadId, threadRecord));
}

function isModeEligibleForReflectionHint(mode: InteractionMode): mode is ReflectionEligibleInteractionMode {
  return mode === 'problem_solving' || mode === 'learning';
}

function startReflectionHintWatcher(): void {
  window.setInterval(() => {
    void refreshReflectionHintForCurrentThread();
  }, 1_000);
}

function maybeStartActiveCandidateFromNewThread(threadId: string, threadRecord: LearningCycleRecord): boolean {
  if (!awaitingNewThreadFollowUp) return false;
  if (!isModeEligibleForReflectionHint(threadRecord.mode)) return false;
  reflectionEligibility.startTrackingThread(threadId);
  awaitingNewThreadFollowUp = false;
  return true;
}

function isReflectionDueForThread(threadId: string, threadRecord: LearningCycleRecord | null | undefined): boolean {
  if (!threadRecord) return false;
  if (!isModeEligibleForReflectionHint(threadRecord.mode)) return false;

  if (reflectionEligibility.getTrackedSubmitCount(threadId) >= ACTIVE_FOLLOW_UP_THRESHOLD) {
    return true;
  }

  return getContentNowMs() - threadRecord.timestamp >= DUE_AFTER_MS;
}

async function resolveThreadRecord(threadId: string): Promise<LearningCycleRecord | null> {
  if (!shouldCheckPersistentThreadEntries(threadId)) {
    return null;
  }

  if (threadRecordCache.has(threadId)) {
    return threadRecordCache.get(threadId) ?? null;
  }

  const pending = pendingThreadRecordChecks.get(threadId);
  if (pending) {
    return pending;
  }

  const check = Promise.resolve(
    sendRuntimeMessage({
      type: 'learning-cycle:thread-record',
      threadId
    })
  )
    .then((response) => {
      const record =
        response && typeof response === 'object' && 'record' in response
          ? (response as { record: LearningCycleRecord | null }).record
          : null;
      if (record) {
        threadRecordCache.set(threadId, record);
      }
      return record;
    })
    .catch((error) => {
      logger.error('thread-record-check-failed', { threadId, error: String(error) });
      return null;
    })
    .finally(() => {
      pendingThreadRecordChecks.delete(threadId);
    });

  pendingThreadRecordChecks.set(threadId, check);
  return check;
}
