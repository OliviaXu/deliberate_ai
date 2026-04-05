import { INTERACTION_MODES, type InteractionMode, type ReflectionScore } from '../../shared/types';
import {
  buildThinkingJournalEntryRecords,
  problemSolvingStartingPointFallback,
  type ThinkingJournalEntryRecord,
  type ThinkingJournalEntryRecordReflection
} from './history';
import type { LearningCycleRecord, ReflectionRecord } from '../../shared/types';

const JOURNAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const LONG_PROMPT_CHAR_THRESHOLD = 220;

export type ThinkingJournalEntryViewFilter = 'all' | InteractionMode;
export interface ThinkingJournalEntryViewFilters {
  mode: ThinkingJournalEntryViewFilter;
  withReflectionOnly: boolean;
}

export interface ThinkingJournalEntryViewReflection {
  timestamp: number;
  dateLabel: string;
  score: ReflectionScore;
  notes?: string;
}

export interface ThinkingJournalEntryView {
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
  reflection?: ThinkingJournalEntryViewReflection;
}

export function buildThinkingJournalEntryViews(
  entryRecords: ThinkingJournalEntryRecord[]
): ThinkingJournalEntryView[] {
  return entryRecords.map((entryRecord) => toThinkingJournalEntryView(entryRecord));
}

export function buildRecentThinkingJournalEntryViews(
  records: LearningCycleRecord[],
  reflections: ReflectionRecord[],
  nowMs: number
): ThinkingJournalEntryView[] {
  const cutoffMs = nowMs - JOURNAL_WINDOW_MS;
  return buildThinkingJournalEntryViews(
    buildThinkingJournalEntryRecords(records, reflections).filter((entryRecord) => entryRecord.timestamp >= cutoffMs)
  );
}

export function filterThinkingJournalEntryViews(
  entryViews: ThinkingJournalEntryView[],
  filters: ThinkingJournalEntryViewFilters
): ThinkingJournalEntryView[] {
  const modeFiltered = filters.mode === 'all' ? entryViews : entryViews.filter((entryView) => entryView.mode === filters.mode);
  if (!filters.withReflectionOnly) return modeFiltered;
  return modeFiltered.filter((entryView) => entryView.reflection !== undefined);
}

export function formatJournalTimestamp(timestamp: number, locale = 'en-US', timeZone?: string): string {
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    ...(timeZone ? { timeZone } : {})
  });

  return dateFormatter.format(timestamp);
}

function toThinkingJournalEntryView(entryRecord: ThinkingJournalEntryRecord): ThinkingJournalEntryView {
  const base: ThinkingJournalEntryView = {
    id: entryRecord.id,
    timestamp: entryRecord.timestamp,
    dateLabel: formatJournalTimestamp(entryRecord.timestamp),
    mode: entryRecord.mode,
    modeLabel: modeLabel(entryRecord.mode),
    modeEmoji: modeEmoji(entryRecord.mode),
    prompt: entryRecord.prompt,
    promptIsLong: entryRecord.prompt.length > LONG_PROMPT_CHAR_THRESHOLD,
    ...(entryRecord.reflection ? { reflection: toThinkingJournalEntryViewReflection(entryRecord.reflection) } : {})
  };

  if (entryRecord.mode === INTERACTION_MODES.PROBLEM_SOLVING) {
    return {
      ...base,
      hypothesis: entryRecord.startingPoint || problemSolvingStartingPointFallback()
    };
  }

  if (entryRecord.mode === INTERACTION_MODES.LEARNING) {
    return {
      ...base,
      ...(entryRecord.startingPoint ? { initialContext: entryRecord.startingPoint } : {})
    };
  }

  return base;
}

function toThinkingJournalEntryViewReflection(
  reflection: ThinkingJournalEntryRecordReflection
): ThinkingJournalEntryViewReflection {
  return {
    timestamp: reflection.timestamp,
    dateLabel: formatJournalTimestamp(reflection.timestamp),
    score: reflection.score,
    ...(reflection.notes ? { notes: reflection.notes } : {})
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
