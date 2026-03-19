import { loadDebugConfig } from '../shared/debug-config';
import { Logger } from '../shared/logger';
import { isConcreteGeminiThreadId, resolveThreadId } from '../shared/thread-id';
import type {
  BackgroundRuntimeMessage,
  InterceptedSubmitIntent,
  LearningCycleRecord,
  ReflectionEligibleLearningCycleRecord,
  ReflectionRecord,
  ReflectionSubmission
} from '../shared/types';
import { isReflectionEligibleMode, isReflectionEligibleRecord } from '../shared/types';
import { getContentNowMs, initializeContentClock } from './clock';
import { handleModeSubmission } from './learning-cycle-flow';
import { ReflectionEligibilityTracker } from './reflection-eligibility';
import { ReflectionHint } from './reflection-hint';
import { ReflectionModal } from './reflection-modal';
import { ModeSelectionModal } from './mode-modal';
import { GeminiSendInterceptor } from './send-interceptor';

const DUE_AFTER_MS = 5 * 60 * 1000;
const ACTIVE_FOLLOW_UP_THRESHOLD = 3;

interface CachedThreadState {
  learningCycleRecord?: LearningCycleRecord | null;
  completedReflection?: {
    learningCycleRecordId: string;
    hasCompleted: boolean;
  };
}

const logger = new Logger(loadDebugConfig());
const interceptor = new GeminiSendInterceptor(logger);
const modeModal = new ModeSelectionModal();
const reflectionModal = new ReflectionModal();
const reflectionHint = new ReflectionHint({ onReview: (threadId) => handleReflectionReview(threadId) });
const reflectionEligibility = new ReflectionEligibilityTracker();
const threadStateCache = new Map<string, CachedThreadState>();
const pendingLearningCycleRecordChecks = new Map<string, Promise<LearningCycleRecord | null>>();
const pendingReflectionCompletionChecks = new Map<string, Promise<boolean>>();
let awaitingNewThreadFollowUp = false;
let interceptionCount = 0;
let busyDropCount = 0;
let modalOpen = false;
// Guard to keep modal/check/capture flow single-flight.
let handlingIntercept = false;

async function startContent(): Promise<void> {
  interceptor.onIntercept(onInterceptedSubmit);
  await initializeContentClock();
  interceptor.start();
  setDomState(interceptionCount, false);
  void refreshReflectionHintForCurrentThread();
  startReflectionHintWatcher();
}

function onInterceptedSubmit(intent: InterceptedSubmitIntent): void {
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
      threadId: resolveThreadId(intent.url)
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
}

async function handleIntercept(intent: InterceptedSubmitIntent): Promise<void> {
  const threadId = resolveThreadId(intent.url);
  const learningCycleRecord = await resolveLearningCycleRecord(threadId);
  if (learningCycleRecord) {
    if (!maybeStartActiveCandidateFromNewThread(threadId, learningCycleRecord)) {
      reflectionEligibility.observeFollowUpSubmission(threadId);
    }
    const replayAttempted = interceptor.resume(intent);
    logger.info('thread-entry-modal-bypassed', {
      source: 'thread-record',
      threadId,
      replayAttempted
    });
    return;
  }

  modalOpen = true;
  setDomState(interceptionCount, true);

  const submission = await modeModal.open();
  logger.info('mode-selected', { mode: submission.mode });

  const result = await handleModeSubmission({
    intent,
    submission,
    sendMessage: sendRuntimeMessage,
    resume: (value) => interceptor.resume(value),
    logger
  });

  if (result.replayAttempted && result.appendSucceeded) {
    if (isReflectionEligibleMode(result.record.mode)) {
      awaitingNewThreadFollowUp = true;
    }

    if (isThreadIdCacheable(threadId)) {
      setCachedLearningCycleRecord(threadId, result.record);
      if (isReflectionEligibleMode(result.record.mode)) {
        setCachedReflectionCompletion(result.record.id, threadId, false);
      }
      logger.info('thread-entry-modal-consumed', {
        threadId,
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

function maybeStartActiveCandidateFromNewThread(threadId: string, learningCycleRecord: LearningCycleRecord): boolean {
  if (!awaitingNewThreadFollowUp) return false;
  if (!isReflectionEligibleRecord(learningCycleRecord)) return false;
  reflectionEligibility.startTrackingThread(threadId);
  awaitingNewThreadFollowUp = false;
  return true;
}

function startReflectionHintWatcher(): void {
  window.setInterval(() => {
    void refreshReflectionHintForCurrentThread();
  }, 1_000);
}

async function refreshReflectionHintForCurrentThread(): Promise<void> {
  await refreshReflectionHintForThread(resolveThreadId(window.location.href));
}

async function refreshReflectionHintForThread(threadId: string): Promise<void> {
  const learningCycleRecord = await resolveLearningCycleRecord(threadId);
  if (!learningCycleRecord || !isReflectionEligibleRecord(learningCycleRecord)) {
    reflectionHint.updateVisibilityForThread(threadId, false);
    return;
  }

  const hasCompletedReflection = await resolveRecordHasCompletedReflection(learningCycleRecord);
  reflectionHint.updateVisibilityForThread(
    threadId,
    !hasCompletedReflection && isReflectionDueForThread(threadId, learningCycleRecord)
  );
}

function isReflectionDueForThread(
  threadId: string,
  learningCycleRecord: ReflectionEligibleLearningCycleRecord
): boolean {
  if (reflectionEligibility.getTrackedSubmitCount(threadId) >= ACTIVE_FOLLOW_UP_THRESHOLD) {
    return true;
  }

  return getContentNowMs() - learningCycleRecord.timestamp >= DUE_AFTER_MS;
}

async function handleReflectionReview(threadId: string): Promise<void> {
  const learningCycleRecord = await resolveLearningCycleRecord(threadId);
  if (!learningCycleRecord || !isReflectionEligibleRecord(learningCycleRecord)) {
    reflectionHint.updateVisibilityForThread(threadId, false);
    return;
  }

  const submission = await reflectionModal.open(learningCycleRecord);
  if (!submission) {
    return;
  }

  const response = await Promise.resolve(
    sendRuntimeMessage({
      type: 'reflection:append',
      record: createReflectionRecord(learningCycleRecord, submission)
    })
  ).catch((error) => {
    logger.error('reflection-append-failed', { threadId, error: String(error) });
    return null;
  });

  if (response && typeof response === 'object' && (response as { ok?: boolean }).ok === true) {
    setCachedReflectionCompletion(learningCycleRecord.id, threadId, true);
    reflectionHint.updateVisibilityForThread(threadId, false);
    logger.info('reflection-completed', { threadId, mode: learningCycleRecord.mode });
    return;
  }
}

function createReflectionRecord(
  learningCycleRecord: ReflectionEligibleLearningCycleRecord,
  submission: ReflectionSubmission
): ReflectionRecord {
  const timestamp = getContentNowMs();
  const notes = submission.notes?.trim();

  return {
    id: `${learningCycleRecord.id}:${timestamp}`,
    timestamp,
    threadId: learningCycleRecord.threadId,
    learningCycleRecordId: learningCycleRecord.id,
    status: 'completed',
    score: submission.score,
    ...(notes ? { notes } : {})
  };
}

function setCachedLearningCycleRecord(threadId: string, learningCycleRecord: LearningCycleRecord | null): void {
  const current = threadStateCache.get(threadId) ?? {};
  threadStateCache.set(threadId, { ...current, learningCycleRecord });
}

function setCachedReflectionCompletion(learningCycleRecordId: string, threadId: string, hasCompleted: boolean): void {
  const current = threadStateCache.get(threadId) ?? {};
  threadStateCache.set(threadId, {
    ...current,
    completedReflection: {
      learningCycleRecordId,
      hasCompleted
    }
  });
}

async function resolveLearningCycleRecord(threadId: string): Promise<LearningCycleRecord | null> {
  if (!isThreadIdCacheable(threadId)) {
    return null;
  }

  const cachedLearningCycleRecord = threadStateCache.get(threadId)?.learningCycleRecord;
  if (cachedLearningCycleRecord !== undefined) {
    return cachedLearningCycleRecord;
  }

  const pending = pendingLearningCycleRecordChecks.get(threadId);
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
      const learningCycleRecord =
        response && typeof response === 'object' && 'record' in response
          ? (response as { record: LearningCycleRecord | null }).record
          : null;
      if (learningCycleRecord) {
        setCachedLearningCycleRecord(threadId, learningCycleRecord);
      }
      return learningCycleRecord;
    })
    .catch((error) => {
      logger.error('thread-record-check-failed', { threadId, error: String(error) });
      return null;
    })
    .finally(() => {
      pendingLearningCycleRecordChecks.delete(threadId);
    });

  pendingLearningCycleRecordChecks.set(threadId, check);
  return check;
}

async function resolveRecordHasCompletedReflection(learningCycleRecord: ReflectionEligibleLearningCycleRecord): Promise<boolean> {
  const cachedValue = threadStateCache.get(learningCycleRecord.threadId)?.completedReflection;
  if (cachedValue?.learningCycleRecordId === learningCycleRecord.id) {
    return cachedValue.hasCompleted;
  }

  const pending = pendingReflectionCompletionChecks.get(learningCycleRecord.id);
  if (pending) {
    return pending;
  }

  const check = Promise.resolve(
    sendRuntimeMessage({
      type: 'reflection:record-has-completed',
      learningCycleRecordId: learningCycleRecord.id
    })
  )
    .then((response) => {
      const hasCompletedReflection =
        response && typeof response === 'object' && 'hasCompletedReflection' in response
          ? Boolean((response as { hasCompletedReflection?: unknown }).hasCompletedReflection)
          : false;
      setCachedReflectionCompletion(learningCycleRecord.id, learningCycleRecord.threadId, hasCompletedReflection);
      return hasCompletedReflection;
    })
    .catch((error) => {
      logger.error('reflection-record-status-check-failed', {
        learningCycleRecordId: learningCycleRecord.id,
        threadId: learningCycleRecord.threadId,
        error: String(error)
      });
      return false;
    })
    .finally(() => {
      pendingReflectionCompletionChecks.delete(learningCycleRecord.id);
    });

  pendingReflectionCompletionChecks.set(learningCycleRecord.id, check);
  return check;
}

function sendRuntimeMessage(message: BackgroundRuntimeMessage): Promise<unknown> | undefined {
  const chromeApi = (globalThis as { chrome?: { runtime?: { sendMessage?: (payload: unknown) => Promise<unknown> | unknown } } }).chrome;
  const send = chromeApi?.runtime?.sendMessage;
  if (!send) return undefined;
  return Promise.resolve(send(message));
}

function isThreadIdCacheable(threadId: string): boolean {
  return isConcreteGeminiThreadId(threadId);
}

void startContent();
