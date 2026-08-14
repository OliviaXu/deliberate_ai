import { INTERACTION_MODES, isReflectionEligibleRecord, type InteractionMode, type LearningCycleRecord, type ReflectionRecord, type ReflectionScore } from '../../shared/types';
import { resolveLearningCycleRecordUrl } from './record-url';

const PROBLEM_SOLVING_STARTING_POINT_FALLBACK = 'No hypothesis recorded.';

export interface ThinkingJournalEntryRecordReflection {
  occurredAt: number;
  score: ReflectionScore;
  notes?: string;
}

export interface ThinkingJournalEntryRecord {
  id: string;
  occurredAt: number;
  mode: InteractionMode;
  url?: string;
  prompt: string;
  startingPoint?: string;
  reflections: ThinkingJournalEntryRecordReflection[];
  resurfacingSuppressed?: boolean;
}

export function buildThinkingJournalEntryRecords(
  records: LearningCycleRecord[],
  reflections: ReflectionRecord[]
): ThinkingJournalEntryRecord[] {
  const sortedRecords = [...records].sort((a, b) => b.occurredAt - a.occurredAt);
  const reflectionsByRecordId = buildReflectionMap(sortedRecords, reflections);

  return sortedRecords.map((record) => toThinkingJournalEntryRecord(record, reflectionsByRecordId.get(record.id) ?? []));
}

export function problemSolvingStartingPointFallback(): string {
  return PROBLEM_SOLVING_STARTING_POINT_FALLBACK;
}

function buildReflectionMap(
  records: LearningCycleRecord[],
  reflections: ReflectionRecord[]
): Map<string, ReflectionRecord[]> {
  const eligibleRecordIds = new Set(records.filter(isReflectionEligibleRecord).map((record) => record.id));
  const reflectionsByRecordId = new Map<string, ReflectionRecord[]>();

  for (const reflection of reflections) {
    const normalizedRecordId = reflection.learningCycleId.trim();
    if (!normalizedRecordId || !eligibleRecordIds.has(normalizedRecordId)) continue;

    const existing = reflectionsByRecordId.get(normalizedRecordId) ?? [];
    reflectionsByRecordId.set(normalizedRecordId, [...existing, reflection]);
  }

  for (const linkedReflections of reflectionsByRecordId.values()) {
    linkedReflections.sort((a, b) => a.occurredAt - b.occurredAt);
  }
  return reflectionsByRecordId;
}

function toThinkingJournalEntryRecord(
  record: LearningCycleRecord,
  reflections: ReflectionRecord[]
): ThinkingJournalEntryRecord {
  const url = resolveLearningCycleRecordUrl(record);

  return {
    id: record.id,
    occurredAt: record.occurredAt,
    mode: record.mode,
    ...(url ? { url } : {}),
    prompt: record.prompt,
    reflections: reflections.map(toThinkingJournalEntryRecordReflection),
    ...(record.resurfacing?.suppressedAt !== undefined ? { resurfacingSuppressed: true } : {}),
    ...toStartingPoint(record)
  };
}

function toStartingPoint(record: LearningCycleRecord): { startingPoint?: string } {
  if (record.mode === INTERACTION_MODES.PROBLEM_SOLVING) {
    const startingPoint = record.startingPoint?.trim() || PROBLEM_SOLVING_STARTING_POINT_FALLBACK;
    return { startingPoint };
  }

  if (record.mode === INTERACTION_MODES.LEARNING) {
    const startingPoint = record.startingPoint?.trim();
    return startingPoint ? { startingPoint } : {};
  }

  return {};
}

function toThinkingJournalEntryRecordReflection(reflection: ReflectionRecord): ThinkingJournalEntryRecordReflection {
  const notes = reflection.notes?.trim();
  return {
    occurredAt: reflection.occurredAt,
    score: reflection.score,
    ...(notes ? { notes } : {})
  };
}
