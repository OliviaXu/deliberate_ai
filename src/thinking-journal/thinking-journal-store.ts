import { LEARNING_CYCLES_STORAGE_KEY } from '../shared/learning-cycle-store';
import { StorageClient } from '../shared/storage';
import type { LearningCycleRecord } from '../shared/types';
import { buildThinkingJournalEntries, type ThinkingJournalEntry } from './utils/entries';

export async function loadThinkingJournalEntries(
  nowMs = Date.now(),
  storage = new StorageClient()
): Promise<ThinkingJournalEntry[]> {
  const raw = await storage.get<unknown>(LEARNING_CYCLES_STORAGE_KEY);
  const records = Array.isArray(raw) ? (raw as LearningCycleRecord[]) : [];
  return buildThinkingJournalEntries(records, nowMs);
}
