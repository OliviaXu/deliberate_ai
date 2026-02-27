import { StorageClient } from './storage';
import type { LearningCycleRecord } from './types';

export const LEARNING_CYCLES_STORAGE_KEY = 'deliberate.learningCycles.v1';

export class LearningCycleStore {
  constructor(private readonly storage = new StorageClient()) {}

  async append(record: LearningCycleRecord): Promise<void> {
    const current = await this.list();
    await this.storage.set(LEARNING_CYCLES_STORAGE_KEY, [...current, record]);
  }

  async list(): Promise<LearningCycleRecord[]> {
    const raw = await this.storage.get<unknown>(LEARNING_CYCLES_STORAGE_KEY);
    return Array.isArray(raw) ? (raw as LearningCycleRecord[]) : [];
  }
}
