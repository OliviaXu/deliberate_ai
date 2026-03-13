import { INTERACTION_MODES, type InteractionMode, type LearningCycleRecord } from '../../shared/types';

const JOURNAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const LONG_PROMPT_CHAR_THRESHOLD = 220;

export type ThinkingJournalFilter = 'all' | InteractionMode;

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
}

export function buildThinkingJournalEntries(records: LearningCycleRecord[], nowMs: number): ThinkingJournalEntry[] {
  const cutoffMs = nowMs - JOURNAL_WINDOW_MS;

  return records
    .filter((record) => typeof record.timestamp === 'number' && record.timestamp >= cutoffMs)
    .sort((a, b) => b.timestamp - a.timestamp)
    .map((record) => toThinkingJournalEntry(record));
}

export function filterThinkingJournalEntries(
  entries: ThinkingJournalEntry[],
  filter: ThinkingJournalFilter
): ThinkingJournalEntry[] {
  if (filter === 'all') return entries;
  return entries.filter((entry) => entry.mode === filter);
}

export function formatJournalTimestamp(timestamp: number, locale = 'en-US', timeZone?: string): string {
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(timeZone ? { timeZone } : {})
  });

  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {})
  });

  return `${dateFormatter.format(timestamp)} — ${timeFormatter.format(timestamp)}`;
}

function toThinkingJournalEntry(record: LearningCycleRecord): ThinkingJournalEntry {
  const base: ThinkingJournalEntry = {
    id: record.id,
    timestamp: record.timestamp,
    dateLabel: formatJournalTimestamp(record.timestamp),
    mode: record.mode,
    modeLabel: modeLabel(record.mode),
    modeEmoji: modeEmoji(record.mode),
    prompt: record.prompt,
    promptIsLong: record.prompt.length > LONG_PROMPT_CHAR_THRESHOLD
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
