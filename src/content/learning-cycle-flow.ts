import { INTERACTION_MODES } from '../shared/types';
import type {
  InterceptedSubmitIntent,
  LearningCycleRecord,
  LearningCycleRuntimeMessage,
  LearningCycleSubmission
} from '../shared/types';
import { resolveThreadId } from '../shared/thread-id';

type ResumeFn = (intent: InterceptedSubmitIntent) => boolean;
type SendMessageFn = (message: LearningCycleRuntimeMessage) => Promise<unknown> | unknown;

interface LoggerLike {
  info(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

interface HandleModeSubmissionParams {
  intent: InterceptedSubmitIntent;
  submission: LearningCycleSubmission;
  sendMessage: SendMessageFn;
  resume: ResumeFn;
  logger: LoggerLike;
}

interface HandleModeSubmissionResult {
  replayAttempted: boolean;
  appendSucceeded: boolean;
  record: LearningCycleRecord;
}

function createLearningCycleRecord(intent: InterceptedSubmitIntent, submission: LearningCycleSubmission): LearningCycleRecord {
  const base = {
    id: `${intent.timestamp}-${intent.interceptionId}`,
    timestamp: intent.timestamp,
    platform: intent.platform,
    threadId: resolveThreadId(intent.url),
    prompt: intent.prompt
  } as const;

  if (submission.mode === INTERACTION_MODES.PROBLEM_SOLVING) {
    return {
      ...base,
      mode: INTERACTION_MODES.PROBLEM_SOLVING,
      prediction: submission.prediction
    };
  }

  if (submission.mode === INTERACTION_MODES.LEARNING) {
    return submission.priorKnowledgeNote
      ? {
          ...base,
          mode: INTERACTION_MODES.LEARNING,
          priorKnowledgeNote: submission.priorKnowledgeNote
        }
      : {
          ...base,
          mode: INTERACTION_MODES.LEARNING
        };
  }

  return {
    ...base,
    mode: INTERACTION_MODES.DELEGATION
  };
}

export async function handleModeSubmission(params: HandleModeSubmissionParams): Promise<HandleModeSubmissionResult> {
  const { intent, submission, sendMessage, resume, logger } = params;
  const record = createLearningCycleRecord(intent, submission);
  const replayAttempted = resume(intent);

  logger.info('send-replay-attempted', {
    replayAttempted,
    deliveryNotVerified: true,
    source: intent.source,
    interceptionId: intent.interceptionId
  });

  if (!replayAttempted) {
    return { replayAttempted, appendSucceeded: false, record };
  }

  try {
    const response = await Promise.resolve(
      sendMessage({
        type: 'learning-cycle:append',
        record
      })
    );

    if (isOkResponse(response)) {
      return { replayAttempted, appendSucceeded: true, record };
    }
  } catch (error) {
    logger.error('learning-cycle-append-failed', { error: String(error) });
    return { replayAttempted, appendSucceeded: false, record };
  }

  logger.error('learning-cycle-append-dispatch-failed', { reason: 'missing-ok-response' });
  return { replayAttempted, appendSucceeded: false, record };
}

function isOkResponse(response: unknown): response is { ok: true } {
  if (!response || typeof response !== 'object') return false;
  return (response as { ok?: boolean }).ok === true;
}
