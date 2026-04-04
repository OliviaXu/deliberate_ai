import {
  INTERACTION_MODES,
  type InteractionMode,
  type ReflectionScore
} from '../../shared/types';
import { buildThinkingJournalHistoryRows, problemSolvingStartingPointFallback, type ThinkingJournalHistoryReflection, type ThinkingJournalHistoryRow } from './history';
import type { LearningCycleRecord, ReflectionRecord } from '../../shared/types';

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
  return buildThinkingJournalHistoryRows(records, reflections)
    .filter((row) => row.timestamp >= cutoffMs)
    .map((row) => toThinkingJournalEntry(row));
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

function toThinkingJournalEntry(row: ThinkingJournalHistoryRow): ThinkingJournalEntry {
  const base: ThinkingJournalEntry = {
    id: row.id,
    timestamp: row.timestamp,
    dateLabel: formatJournalTimestamp(row.timestamp),
    mode: row.mode,
    modeLabel: modeLabel(row.mode),
    modeEmoji: modeEmoji(row.mode),
    prompt: row.prompt,
    promptIsLong: row.prompt.length > LONG_PROMPT_CHAR_THRESHOLD,
    ...(row.reflection ? { reflection: toThinkingJournalReflection(row.reflection) } : {})
  };

  if (row.mode === INTERACTION_MODES.PROBLEM_SOLVING) {
    return {
      ...base,
      hypothesis: row.startingPoint || problemSolvingStartingPointFallback()
    };
  }

  if (row.mode === INTERACTION_MODES.LEARNING) {
    return {
      ...base,
      ...(row.startingPoint ? { initialContext: row.startingPoint } : {})
    };
  }

  return base;
}

function toThinkingJournalReflection(reflection: ThinkingJournalHistoryReflection): ThinkingJournalReflection {
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
