export type SubmitSource = 'enter_key' | 'send_button';
export const INTERACTION_MODES = {
  DELEGATION: 'delegation',
  PROBLEM_SOLVING: 'problem_solving',
  LEARNING: 'learning'
} as const;
export type InteractionMode = (typeof INTERACTION_MODES)[keyof typeof INTERACTION_MODES];
export type ReflectionEligibleInteractionMode =
  | typeof INTERACTION_MODES.PROBLEM_SOLVING
  | typeof INTERACTION_MODES.LEARNING;
export const REFLECTION_ELIGIBLE_INTERACTION_MODES = [
  INTERACTION_MODES.PROBLEM_SOLVING,
  INTERACTION_MODES.LEARNING
] as const;
export type ReflectionDueStatus = 'none' | 'due';
export type ReflectionScore = 0 | 25 | 50 | 75 | 100;

export interface SubmitSignal {
  source: SubmitSource;
  timestamp: number;
  url: string;
  platform: 'gemini';
}

export interface InterceptedSubmitIntent extends SubmitSignal {
  interceptionId: number;
  prompt: string;
}

export type LogLevel = 'off' | 'error' | 'info' | 'debug';

export interface DebugConfig {
  enabled: boolean;
  level: LogLevel;
}

interface LearningCycleBase {
  id: string;
  timestamp: number;
  platform: 'gemini';
  threadId: string;
  prompt: string;
}

export interface DelegationLearningCycleRecord extends LearningCycleBase {
  mode: typeof INTERACTION_MODES.DELEGATION;
}

export interface ProblemSolvingLearningCycleRecord extends LearningCycleBase {
  mode: typeof INTERACTION_MODES.PROBLEM_SOLVING;
  prediction: string;
}

export interface LearningLearningCycleRecord extends LearningCycleBase {
  mode: typeof INTERACTION_MODES.LEARNING;
  priorKnowledgeNote?: string;
}

export type LearningCycleRecord =
  | DelegationLearningCycleRecord
  | ProblemSolvingLearningCycleRecord
  | LearningLearningCycleRecord;

export type ReflectionEligibleLearningCycleRecord = ProblemSolvingLearningCycleRecord | LearningLearningCycleRecord;

export function isReflectionEligibleMode(mode: InteractionMode): mode is ReflectionEligibleInteractionMode {
  return mode === INTERACTION_MODES.PROBLEM_SOLVING || mode === INTERACTION_MODES.LEARNING;
}

export function isReflectionEligibleRecord(
  record: LearningCycleRecord
): record is ReflectionEligibleLearningCycleRecord {
  return isReflectionEligibleMode(record.mode);
}

export interface DelegationLearningCycleSubmission {
  mode: typeof INTERACTION_MODES.DELEGATION;
}

export interface ProblemSolvingLearningCycleSubmission {
  mode: typeof INTERACTION_MODES.PROBLEM_SOLVING;
  prediction: string;
}

export interface LearningLearningCycleSubmission {
  mode: typeof INTERACTION_MODES.LEARNING;
  priorKnowledgeNote?: string;
}

export type LearningCycleSubmission =
  | DelegationLearningCycleSubmission
  | ProblemSolvingLearningCycleSubmission
  | LearningLearningCycleSubmission;

export interface LearningCycleAppendMessage {
  type: 'learning-cycle:append';
  record: LearningCycleRecord;
}

export interface LearningCycleThreadRecordMessage {
  type: 'learning-cycle:thread-record';
  threadId: string;
}

interface ReflectionBase {
  id: string;
  timestamp: number;
  threadId: string;
}

export interface CompletedReflectionRecord extends ReflectionBase {
  status: 'completed';
  score: ReflectionScore;
  notes?: string;
}

export type ReflectionRecord = CompletedReflectionRecord;

export interface ReflectionSubmission {
  score: ReflectionScore;
  notes?: string;
}

export type LearningCycleRuntimeMessage =
  | LearningCycleAppendMessage
  | LearningCycleThreadRecordMessage;

export interface ReflectionAppendMessage {
  type: 'reflection:append';
  record: ReflectionRecord;
}

export interface ReflectionThreadHasCompletedMessage {
  type: 'reflection:thread-has-completed';
  threadId: string;
}

export type ReflectionRuntimeMessage = ReflectionAppendMessage | ReflectionThreadHasCompletedMessage;

export type BackgroundRuntimeMessage = LearningCycleRuntimeMessage | ReflectionRuntimeMessage;

export type Unsubscribe = () => void;
