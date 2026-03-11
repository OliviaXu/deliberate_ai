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

  async resolveThreadIdForRecord(recordId: string, fromThreadId: string, toThreadId: string): Promise<boolean> {
    let updated = false;

    this.writeQueue = this.writeQueue.then(async () => {
      const current = await this.listRaw();
      const index = current.findIndex((record) => record.id === recordId && record.threadId === fromThreadId);
      if (index < 0) return;

      const next = [...current];
      next[index] = { ...next[index], threadId: toThreadId } as LearningCycleRecord;
      await this.storage.set(LEARNING_CYCLES_STORAGE_KEY, next);
      updated = true;
    });

    await this.writeQueue;
    return updated;
  }

  async getLatestForThread(threadId: string): Promise<LearningCycleRecord | null> {
    const current = await this.listRaw();
    const matches = current
      .filter((record) => record.threadId === threadId)
      .sort((a, b) => b.timestamp - a.timestamp);

    return matches[0] ?? null;
  }

  private async listRaw(): Promise<LearningCycleRecord[]> {
    const raw = await this.storage.get<unknown>(LEARNING_CYCLES_STORAGE_KEY);
    return Array.isArray(raw) ? (raw as LearningCycleRecord[]) : [];
  }
}
