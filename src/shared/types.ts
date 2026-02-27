export type SubmitSource = 'enter_key' | 'send_button';
export type InteractionMode = 'delegation' | 'problem_solving' | 'learning';

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

export interface LearningCycleListMessage {
  type: 'learning-cycle:list';
}

export type LearningCycleRuntimeMessage = LearningCycleAppendMessage | LearningCycleListMessage;

export interface LearningCycleListResponse {
  ok: true;
  records: LearningCycleRecord[];
}

export interface LearningCycleAckResponse {
  ok: true;
}

export type Unsubscribe = () => void;
