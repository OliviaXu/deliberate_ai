export type SubmitSource = 'enter_key' | 'send_button';
export type InteractionMode = 'delegation' | 'problem_solving' | 'learning';
export type ReflectionEligibleInteractionMode = Extract<InteractionMode, 'problem_solving' | 'learning'>;
export type ReflectionStatus = 'none' | 'due';

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
  mode: 'delegation';
}

export interface ProblemSolvingLearningCycleRecord extends LearningCycleBase {
  mode: 'problem_solving';
  prediction: string;
}

export interface LearningLearningCycleRecord extends LearningCycleBase {
  mode: 'learning';
  priorKnowledgeNote?: string;
}

export type LearningCycleRecord =
  | DelegationLearningCycleRecord
  | ProblemSolvingLearningCycleRecord
  | LearningLearningCycleRecord;

export type ReflectionEligibleLearningCycleRecord = ProblemSolvingLearningCycleRecord | LearningLearningCycleRecord;

export interface DelegationLearningCycleSubmission {
  mode: 'delegation';
}

export interface ProblemSolvingLearningCycleSubmission {
  mode: 'problem_solving';
  prediction: string;
}

export interface LearningLearningCycleSubmission {
  mode: 'learning';
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

export interface HistoricalReflectionCandidate {
  learningCycleId: string;
  mode: ReflectionEligibleInteractionMode;
  capturedAt: number;
}

export type LearningCycleRuntimeMessage =
  | LearningCycleAppendMessage
  | LearningCycleThreadRecordMessage;

export type Unsubscribe = () => void;
