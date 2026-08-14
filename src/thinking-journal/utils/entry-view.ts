import { INTERACTION_MODES, type InteractionMode, type ReflectionScore } from '../../shared/types';
import {
  buildThinkingJournalEntryRecords,
  problemSolvingStartingPointFallback,
  type ThinkingJournalEntryRecord,
  type ThinkingJournalEntryRecordReflection
} from './entry-record';
import type { LearningCycleRecord, ReflectionRecord } from '../../shared/types';
import { JOURNAL_WINDOW_MS } from '../journal-window';

const LONG_PROMPT_CHAR_THRESHOLD = 220;

export type ThinkingJournalEntryViewFilter = 'all' | InteractionMode;
export interface ThinkingJournalEntryViewFilters {
  mode: ThinkingJournalEntryViewFilter;
  withReflectionOnly: boolean;
}

export interface ThinkingJournalEntryViewReflection {
  occurredAt: number;
  dateLabel: string;
  score: ReflectionScore;
  notes?: string;
}

export interface ThinkingJournalEntryView {
  id: string;
  occurredAt: number;
  dateLabel: string;
  mode: InteractionMode;
  modeLabel: string;
  modeEmoji: string;
  url?: string;
  prompt: string;
  promptIsLong: boolean;
  hypothesis?: string;
  initialContext?: string;
  reflections: ThinkingJournalEntryViewReflection[];
  resurfacingSuppressed?: boolean;
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
    buildThinkingJournalEntryRecords(records, reflections).filter((entryRecord) => entryRecord.occurredAt >= cutoffMs)
  );
}

export function filterThinkingJournalEntryViews(
  entryViews: ThinkingJournalEntryView[],
  filters: ThinkingJournalEntryViewFilters
): ThinkingJournalEntryView[] {
  const modeFiltered = filters.mode === 'all' ? entryViews : entryViews.filter((entryView) => entryView.mode === filters.mode);
  if (!filters.withReflectionOnly) return modeFiltered;
  return modeFiltered.filter((entryView) => entryView.reflections.length > 0);
}

export function formatJournalTimestamp(occurredAt: number, locale = 'en-US', timeZone?: string): string {
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    ...(timeZone ? { timeZone } : {})
  });

  return dateFormatter.format(occurredAt);
}

export function formatJournalReflectionTimestamp(occurredAt: number, locale = 'en-US', timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(timeZone ? { timeZone } : {})
  }).format(occurredAt);
}

function toThinkingJournalEntryView(entryRecord: ThinkingJournalEntryRecord): ThinkingJournalEntryView {
  const base: ThinkingJournalEntryView = {
    id: entryRecord.id,
    occurredAt: entryRecord.occurredAt,
    dateLabel: formatJournalTimestamp(entryRecord.occurredAt),
    mode: entryRecord.mode,
    modeLabel: modeLabel(entryRecord.mode),
    modeEmoji: modeEmoji(entryRecord.mode),
    ...(entryRecord.url ? { url: entryRecord.url } : {}),
    prompt: entryRecord.prompt,
    promptIsLong: entryRecord.prompt.length > LONG_PROMPT_CHAR_THRESHOLD,
    reflections: entryRecord.reflections.map(toThinkingJournalEntryViewReflection),
    ...(entryRecord.resurfacingSuppressed ? { resurfacingSuppressed: true } : {}),
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
    occurredAt: reflection.occurredAt,
    dateLabel: formatJournalReflectionTimestamp(reflection.occurredAt),
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
