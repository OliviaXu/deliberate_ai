import {
  INTERACTION_MODES,
  isReflectionEligibleRecord,
  type InteractionMode,
  type LearningCycleRecord,
  type ReflectionEligibleLearningCycleRecord,
  type ReflectionRecord,
  type ReflectionScore
} from '../../shared/types';

const JOURNAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const LONG_PROMPT_CHAR_THRESHOLD = 220;

export type ThinkingJournalFilter = 'all' | InteractionMode;
export interface ThinkingJournalFilters {
  mode: ThinkingJournalFilter;
  withReflectionOnly: boolean;
}

export interface ThinkingJournalReflection {
  timestamp: number;
  dateLabel: string;
  score: ReflectionScore;
  notes?: string;
}

export interface ThinkingJournalEntry {
  id: string;
  timestamp: number;
  dateLabel: string;
  mode: InteractionMode;
  modeLabel: string;
  modeEmoji: string;
  prompt: string;
  promptIsLong: boolean;
  hypothesis?: string;
  initialContext?: string;
  reflection?: ThinkingJournalReflection;
}

export function buildThinkingJournalEntries(
  records: LearningCycleRecord[],
  reflections: ReflectionRecord[],
  nowMs: number
): ThinkingJournalEntry[] {
  const cutoffMs = nowMs - JOURNAL_WINDOW_MS;
  const windowedRecords = records
    .filter((record) => typeof record.timestamp === 'number' && record.timestamp >= cutoffMs)
    .sort((a, b) => b.timestamp - a.timestamp);
  const reflectionsByRecordId = buildReflectionMap(windowedRecords, reflections);

  return windowedRecords.map((record) => toThinkingJournalEntry(record, reflectionsByRecordId.get(record.id)));
}

export function filterThinkingJournalEntries(
  entries: ThinkingJournalEntry[],
  filters: ThinkingJournalFilters
): ThinkingJournalEntry[] {
  const modeFiltered = filters.mode === 'all' ? entries : entries.filter((entry) => entry.mode === filters.mode);
  if (!filters.withReflectionOnly) return modeFiltered;
  return modeFiltered.filter((entry) => entry.reflection !== undefined);
}

export function formatJournalTimestamp(timestamp: number, locale = 'en-US', timeZone?: string): string {
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    ...(timeZone ? { timeZone } : {})
  });

  return dateFormatter.format(timestamp);
}

function buildReflectionMap(
  records: LearningCycleRecord[],
  reflections: ReflectionRecord[]
): Map<string, ReflectionRecord> {
  const eligibleRecords = records.filter(isReflectionEligibleRecord);
  const reflectionsByRecordId = new Map<string, ReflectionRecord>();

  for (const reflection of reflections) {
    const matchedRecord = findMatchedRecord(eligibleRecords, reflection);
    if (!matchedRecord) continue;

    const existing = reflectionsByRecordId.get(matchedRecord.id);
    if (!existing || reflection.timestamp > existing.timestamp) {
      reflectionsByRecordId.set(matchedRecord.id, reflection);
    }
  }

  return reflectionsByRecordId;
}

function findMatchedRecord(
  records: ReflectionEligibleLearningCycleRecord[],
  reflection: ReflectionRecord
): ReflectionEligibleLearningCycleRecord | null {
  let match: ReflectionEligibleLearningCycleRecord | null = null;

  for (const record of records) {
    if (record.threadId !== reflection.threadId) continue;
    if (record.timestamp > reflection.timestamp) continue;
    if (!match || record.timestamp > match.timestamp) {
      match = record;
    }
  }

  return match;
}

function toThinkingJournalEntry(record: LearningCycleRecord, reflection?: ReflectionRecord): ThinkingJournalEntry {
  const base: ThinkingJournalEntry = {
    id: record.id,
    timestamp: record.timestamp,
    dateLabel: formatJournalTimestamp(record.timestamp),
    mode: record.mode,
    modeLabel: modeLabel(record.mode),
    modeEmoji: modeEmoji(record.mode),
    prompt: record.prompt,
    promptIsLong: record.prompt.length > LONG_PROMPT_CHAR_THRESHOLD,
    ...(reflection ? { reflection: toThinkingJournalReflection(reflection) } : {})
  };

  if (record.mode === INTERACTION_MODES.PROBLEM_SOLVING) {
    const prediction = record.prediction?.trim();
    return {
      ...base,
      hypothesis: prediction || 'No hypothesis recorded.'
    };
  }

  if (record.mode === INTERACTION_MODES.LEARNING) {
    const initialContext = record.priorKnowledgeNote?.trim();
    return {
      ...base,
      ...(initialContext ? { initialContext } : {})
    };
  }

  return base;
}

function toThinkingJournalReflection(reflection: ReflectionRecord): ThinkingJournalReflection {
  const notes = reflection.notes?.trim();
  return {
    timestamp: reflection.timestamp,
    dateLabel: formatJournalTimestamp(reflection.timestamp),
    score: reflection.score,
    ...(notes ? { notes } : {})
  };
}

function modeLabel(mode: InteractionMode): string {
  if (mode === INTERACTION_MODES.PROBLEM_SOLVING) return 'Problem-Solving';
  if (mode === INTERACTION_MODES.DELEGATION) return 'Delegation';
  return 'Learning';
}

function modeEmoji(mode: InteractionMode): string {
  if (mode === INTERACTION_MODES.PROBLEM_SOLVING) return '🤔';
  if (mode === INTERACTION_MODES.DELEGATION) return '😌';
  return '🧑‍🎓';
}
