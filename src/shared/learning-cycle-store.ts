import { StorageClient } from './storage';
import type { LearningCycleRecord } from './types';

export const LEARNING_CYCLES_STORAGE_KEY = 'deliberate.learningCycles.v1';

export class LearningCycleStore {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly storage = new StorageClient()) {}

  async append(record: LearningCycleRecord): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      const current = await this.listRaw();
      await this.storage.set(LEARNING_CYCLES_STORAGE_KEY, [...current, record]);
    });
    await this.writeQueue;
  }

  async hasAnyForThread(threadId: string): Promise<boolean> {
    // We store all records under one key, so per-thread checks require loading this whole array.
    // Consider adding an in-memory cache (with invalidation) to avoid repeated storage reads.
    const current = await this.listRaw();
    return current.some((record) => record.threadId === threadId);
  }

  private async listRaw(): Promise<LearningCycleRecord[]> {
    const raw = await this.storage.get<unknown>(LEARNING_CYCLES_STORAGE_KEY);
    return Array.isArray(raw) ? (raw as LearningCycleRecord[]) : [];
  }
}
