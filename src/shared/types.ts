import type { PlatformId } from './platform-id';

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
  occurredAt: number;
  url: string;
  platform: PlatformId;
}

export interface InterceptedSubmitIntent extends SubmitSignal {
  prompt: string;
}

export interface PlatformThreadIdentity {
  platform: PlatformId;
  threadId: string;
}

export type LogLevel = 'off' | 'error' | 'info' | 'debug';

export interface DebugConfig {
  enabled: boolean;
  level: LogLevel;
}

interface LearningCycleBase extends PlatformThreadIdentity {
  id: string;
  occurredAt: number;
  url?: string;
  prompt: string;
  resurfacing?: {
    lastSurfacedAt?: number;
    suppressedAt?: number;
  };
}

export interface DelegationLearningCycleRecord extends LearningCycleBase {
  mode: typeof INTERACTION_MODES.DELEGATION;
}

export interface ProblemSolvingLearningCycleRecord extends LearningCycleBase {
  mode: typeof INTERACTION_MODES.PROBLEM_SOLVING;
  startingPoint: string;
}

export interface LearningLearningCycleRecord extends LearningCycleBase {
  mode: typeof INTERACTION_MODES.LEARNING;
  startingPoint?: string;
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
  startingPoint: string;
}

export interface LearningLearningCycleSubmission {
  mode: typeof INTERACTION_MODES.LEARNING;
  startingPoint?: string;
}

export type LearningCycleSubmission =
  | DelegationLearningCycleSubmission
  | ProblemSolvingLearningCycleSubmission
  | LearningLearningCycleSubmission;

export interface LearningCycleAppendMessage {
  type: 'learning-cycle:append';
  record: LearningCycleRecord;
}

export interface LearningCycleThreadRecordMessage extends PlatformThreadIdentity {
  type: 'learning-cycle:thread-record';
}

export interface ResurfacingCandidate {
  learningCycleId: string;
  excerpt: string;
}

export interface ResurfacingPresentNextMessage {
  type: 'resurfacing:present-next';
}

export interface ResurfacingPresentNextResponse {
  candidate: ResurfacingCandidate | null;
}

export interface ResurfacingOpenJournalMessage {
  type: 'resurfacing:open-journal';
  learningCycleId: string;
}

export interface ResurfacingSetSuppressedMessage {
  type: 'resurfacing:set-suppressed';
  learningCycleId: string;
  suppressed: boolean;
}

export type ResurfacingRuntimeMessage =
  | ResurfacingPresentNextMessage
  | ResurfacingOpenJournalMessage
  | ResurfacingSetSuppressedMessage;

interface ReflectionBase {
  id: string;
  occurredAt: number;
  learningCycleId: string;
}

export interface CompletedReflectionRecord extends ReflectionBase {
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

export interface ReflectionRecordHasCompletedMessage {
  type: 'reflection:record-has-completed';
  learningCycleId: string;
}

export type ReflectionRuntimeMessage = ReflectionAppendMessage | ReflectionRecordHasCompletedMessage;

export type BackgroundRuntimeMessage = LearningCycleRuntimeMessage | ReflectionRuntimeMessage | ResurfacingRuntimeMessage;

export type Unsubscribe = () => void;
