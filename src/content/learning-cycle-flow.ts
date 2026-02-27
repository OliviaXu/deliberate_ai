import type {
  InterceptedSubmitIntent,
  LearningCycleRecord,
  LearningCycleRuntimeMessage,
  LearningCycleSubmission
} from '../shared/types';

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
  record: LearningCycleRecord;
}

function resolveThreadId(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname || 'unknown';
  } catch {
    return 'unknown';
  }
}

function createLearningCycleRecord(intent: InterceptedSubmitIntent, submission: LearningCycleSubmission): LearningCycleRecord {
  const base = {
    id: `${intent.timestamp}-${intent.interceptionId}`,
    timestamp: intent.timestamp,
    platform: intent.platform,
    threadId: resolveThreadId(intent.url),
    prompt: intent.prompt
  } as const;

  if (submission.mode === 'problem_solving') {
    return {
      ...base,
      mode: 'problem_solving',
      prediction: submission.prediction
    };
  }

  if (submission.mode === 'learning') {
    return submission.priorKnowledgeNote
      ? {
          ...base,
          mode: 'learning',
          priorKnowledgeNote: submission.priorKnowledgeNote
        }
      : {
          ...base,
          mode: 'learning'
        };
  }

  return {
    ...base,
    mode: 'delegation'
  };
}

export function handleModeSubmission(params: HandleModeSubmissionParams): HandleModeSubmissionResult {
  const { intent, submission, sendMessage, resume, logger } = params;
  const record = createLearningCycleRecord(intent, submission);

  try {
    const maybePromise = sendMessage({
      type: 'learning-cycle:append',
      record
    });
    void Promise.resolve(maybePromise).catch((error) => {
      logger.error('learning-cycle-append-failed', { error: String(error) });
    });
  } catch (error) {
    logger.error('learning-cycle-append-dispatch-failed', { error: String(error) });
  }

  const replayAttempted = resume(intent);
  logger.info('send-replay-attempted', {
    replayAttempted,
    deliveryNotVerified: true,
    source: intent.source,
    interceptionId: intent.interceptionId
  });

  return { replayAttempted, record };
}
