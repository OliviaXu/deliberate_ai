import { LearningCycleStore } from '../shared/learning-cycle-store';
import { ReflectionStore } from '../shared/reflection-store';
import type { LearningCycleRecord, ReflectionRecord } from '../shared/types';
import { buildThinkingJournalEntries, type ThinkingJournalEntry } from './utils/entries';

interface ThinkingJournalStoreDependencies {
  learningCycleStore?: Pick<LearningCycleStore, 'listAll'>;
  reflectionStore?: Pick<ReflectionStore, 'listAll'>;
}

export async function loadThinkingJournalEntries(
  nowMs = Date.now(),
  dependencies: ThinkingJournalStoreDependencies = {}
): Promise<ThinkingJournalEntry[]> {
  const learningCycleStore = dependencies.learningCycleStore ?? new LearningCycleStore();
  const reflectionStore = dependencies.reflectionStore ?? new ReflectionStore();
  const rawRecords = await learningCycleStore.listAll();
  const rawReflections = await reflectionStore.listAll();
  const records = Array.isArray(rawRecords) ? (rawRecords as LearningCycleRecord[]) : [];
  const reflections = Array.isArray(rawReflections) ? (rawReflections as ReflectionRecord[]) : [];
  return buildThinkingJournalEntries(records, reflections, nowMs);
}
