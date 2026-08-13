import { LearningCycleStore } from '../shared/learning-cycle-store';
import { ReflectionStore } from '../shared/reflection-store';
import type { LearningCycleRecord, ReflectionRecord } from '../shared/types';
import { JOURNAL_WINDOW_MS } from './journal-window';
import { buildThinkingJournalEntryRecords, type ThinkingJournalEntryRecord } from './utils/entry-record';

interface ThinkingJournalStoreDependencies {
  learningCycleStore?: Pick<LearningCycleStore, 'listAll'>;
  reflectionStore?: Pick<ReflectionStore, 'listAll'>;
}

export interface ThinkingJournalPage {
  recentEntries: ThinkingJournalEntryRecord[];
  featuredEntry?: ThinkingJournalEntryRecord;
}

export async function loadThinkingJournalPage(
  featuredEntryId: string | undefined,
  nowMs = Date.now(),
  dependencies: ThinkingJournalStoreDependencies = {}
): Promise<ThinkingJournalPage> {
  const { records, reflections } = await loadThinkingJournalHistoryData(dependencies);
  const cutoffMs = nowMs - JOURNAL_WINDOW_MS;
  const entryRecords = buildThinkingJournalEntryRecords(records, reflections);
  const featuredEntry = featuredEntryId
    ? entryRecords.find((entry) => entry.id === featuredEntryId)
    : undefined;

  return {
    recentEntries: entryRecords.filter((entry) => entry.timestamp >= cutoffMs),
    ...(featuredEntry ? { featuredEntry } : {})
  };
}

export async function loadThinkingJournalExportRows(
  dependencies: ThinkingJournalStoreDependencies = {}
): Promise<ThinkingJournalEntryRecord[]> {
  const { records, reflections } = await loadThinkingJournalHistoryData(dependencies);
  return buildThinkingJournalEntryRecords(records, reflections);
}

async function loadThinkingJournalHistoryData(
  dependencies: ThinkingJournalStoreDependencies
): Promise<{ records: LearningCycleRecord[]; reflections: ReflectionRecord[] }> {
  const learningCycleStore = dependencies.learningCycleStore ?? new LearningCycleStore();
  const reflectionStore = dependencies.reflectionStore ?? new ReflectionStore();
  const [rawRecords, rawReflections] = await Promise.all([learningCycleStore.listAll(), reflectionStore.listAll()]);
  const records = Array.isArray(rawRecords) ? (rawRecords as LearningCycleRecord[]) : [];
  const reflections = Array.isArray(rawReflections) ? (rawReflections as ReflectionRecord[]) : [];
  return { records, reflections };
}
