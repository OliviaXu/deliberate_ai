import { LearningCycleStore } from '../shared/learning-cycle-store';
import { ReflectionStore } from '../shared/reflection-store';
import type { LearningCycleRecord, ReflectionRecord } from '../shared/types';
import { buildThinkingJournalEntries, type ThinkingJournalEntry } from './utils/entries';
import { buildThinkingJournalHistoryRows, type ThinkingJournalHistoryRow } from './utils/history';

interface ThinkingJournalStoreDependencies {
  learningCycleStore?: Pick<LearningCycleStore, 'listAll'>;
  reflectionStore?: Pick<ReflectionStore, 'listAll'>;
}

export async function loadThinkingJournalEntries(
  nowMs = Date.now(),
  dependencies: ThinkingJournalStoreDependencies = {}
): Promise<ThinkingJournalEntry[]> {
  const { records, reflections } = await loadThinkingJournalHistoryData(dependencies);
  return buildThinkingJournalEntries(records, reflections, nowMs);
}

export async function loadThinkingJournalExportRows(
  dependencies: ThinkingJournalStoreDependencies = {}
): Promise<ThinkingJournalHistoryRow[]> {
  const { records, reflections } = await loadThinkingJournalHistoryData(dependencies);
  return buildThinkingJournalHistoryRows(records, reflections);
}

async function loadThinkingJournalHistoryData(
  dependencies: ThinkingJournalStoreDependencies
): Promise<{ records: LearningCycleRecord[]; reflections: ReflectionRecord[] }> {
  const learningCycleStore = dependencies.learningCycleStore ?? new LearningCycleStore();
  const reflectionStore = dependencies.reflectionStore ?? new ReflectionStore();
  const rawRecords = await learningCycleStore.listAll();
  const rawReflections = await reflectionStore.listAll();
  const records = Array.isArray(rawRecords) ? (rawRecords as LearningCycleRecord[]) : [];
  const reflections = Array.isArray(rawReflections) ? (rawReflections as ReflectionRecord[]) : [];
  return { records, reflections };
}
