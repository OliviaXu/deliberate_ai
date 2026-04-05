import { LearningCycleStore } from '../shared/learning-cycle-store';
import { ReflectionStore } from '../shared/reflection-store';
import type { LearningCycleRecord, ReflectionRecord } from '../shared/types';
import { buildThinkingJournalEntryRecords, type ThinkingJournalEntryRecord } from './utils/history';

interface ThinkingJournalStoreDependencies {
  learningCycleStore?: Pick<LearningCycleStore, 'listAll'>;
  reflectionStore?: Pick<ReflectionStore, 'listAll'>;
}

const JOURNAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function loadRecentThinkingJournalEntries(
  nowMs = Date.now(),
  dependencies: ThinkingJournalStoreDependencies = {}
): Promise<ThinkingJournalEntryRecord[]> {
  const { records, reflections } = await loadThinkingJournalHistoryData(dependencies);
  const cutoffMs = nowMs - JOURNAL_WINDOW_MS;
  const recentRecords = records.filter((record) => typeof record.timestamp === 'number' && record.timestamp >= cutoffMs);
  return buildThinkingJournalEntryRecords(recentRecords, reflections);
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
