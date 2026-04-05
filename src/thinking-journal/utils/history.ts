import { INTERACTION_MODES, isReflectionEligibleRecord, type InteractionMode, type LearningCycleRecord, type ReflectionRecord, type ReflectionScore } from '../../shared/types';

const PROBLEM_SOLVING_STARTING_POINT_FALLBACK = 'No hypothesis recorded.';

export interface ThinkingJournalEntryRecordReflection {
  timestamp: number;
  score: ReflectionScore;
  notes?: string;
}

export interface ThinkingJournalEntryRecord {
  id: string;
  timestamp: number;
  mode: InteractionMode;
  prompt: string;
  startingPoint?: string;
  reflection?: ThinkingJournalEntryRecordReflection;
}

export function buildThinkingJournalEntryRecords(
  records: LearningCycleRecord[],
  reflections: ReflectionRecord[]
): ThinkingJournalEntryRecord[] {
  const sortedRecords = records
    .filter((record) => typeof record.timestamp === 'number')
    .sort((a, b) => b.timestamp - a.timestamp);
  const reflectionsByRecordId = buildReflectionMap(sortedRecords, reflections);

  return sortedRecords.map((record) => toThinkingJournalEntryRecord(record, reflectionsByRecordId.get(record.id)));
}

export function problemSolvingStartingPointFallback(): string {
  return PROBLEM_SOLVING_STARTING_POINT_FALLBACK;
}

function buildReflectionMap(
  records: LearningCycleRecord[],
  reflections: ReflectionRecord[]
): Map<string, ReflectionRecord> {
  const eligibleRecordIds = new Set(records.filter(isReflectionEligibleRecord).map((record) => record.id));
  const reflectionsByRecordId = new Map<string, ReflectionRecord>();

  for (const reflection of reflections) {
    const directRecordId = reflection.learningCycleRecordId?.trim();
    if (!directRecordId || !eligibleRecordIds.has(directRecordId)) continue;

    const existing = reflectionsByRecordId.get(directRecordId);
    if (!existing || reflection.timestamp > existing.timestamp) {
      reflectionsByRecordId.set(directRecordId, reflection);
    }
  }

  return reflectionsByRecordId;
}

function toThinkingJournalEntryRecord(
  record: LearningCycleRecord,
  reflection?: ReflectionRecord
): ThinkingJournalEntryRecord {
  return {
    id: record.id,
    timestamp: record.timestamp,
    mode: record.mode,
    prompt: record.prompt,
    ...toStartingPoint(record),
    ...(reflection ? { reflection: toThinkingJournalEntryRecordReflection(reflection) } : {})
  };
}

function toStartingPoint(record: LearningCycleRecord): { startingPoint?: string } {
  if (record.mode === INTERACTION_MODES.PROBLEM_SOLVING) {
    const startingPoint = record.prediction?.trim() || PROBLEM_SOLVING_STARTING_POINT_FALLBACK;
    return { startingPoint };
  }

  if (record.mode === INTERACTION_MODES.LEARNING) {
    const startingPoint = record.priorKnowledgeNote?.trim();
    return startingPoint ? { startingPoint } : {};
  }

  return {};
}

function toThinkingJournalEntryRecordReflection(reflection: ReflectionRecord): ThinkingJournalEntryRecordReflection {
  const notes = reflection.notes?.trim();
  return {
    timestamp: reflection.timestamp,
    score: reflection.score,
    ...(notes ? { notes } : {})
  };
}
