import { StorageClient } from './storage';
import type { LearningCycleRecord, PlatformThreadIdentity } from './types';

export const LEARNING_CYCLES_STORAGE_KEY = 'deliberate.learningCycles.v1';

export class LearningCycleStore {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly storage = new StorageClient()) {}

  async listAll(): Promise<LearningCycleRecord[]> {
    return this.listRaw();
  }

  async append(record: LearningCycleRecord): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      const current = await this.listRaw();
      await this.storage.set(LEARNING_CYCLES_STORAGE_KEY, [...current, record]);
    });
    await this.writeQueue;
  }

  async markResurfaced(recordId: string, lastSurfacedAt: number): Promise<boolean> {
    let updated = false;

    this.writeQueue = this.writeQueue.then(async () => {
      const current = await this.listRaw();
      const index = current.findIndex((record) => record.id === recordId);
      if (index < 0) return;

      const record = current[index]!;
      const next = [...current];
      next[index] = {
        ...record,
        resurfacing: { ...record.resurfacing, lastSurfacedAt }
      } as LearningCycleRecord;
      await this.storage.set(LEARNING_CYCLES_STORAGE_KEY, next);
      updated = true;
    });

    await this.writeQueue;
    return updated;
  }

  async setResurfacingSuppressed(recordId: string, suppressed: boolean, changedAt: number): Promise<boolean> {
    let updated = false;

    this.writeQueue = this.writeQueue.then(async () => {
      const current = await this.listRaw();
      const index = current.findIndex((record) => record.id === recordId);
      if (index < 0) return;

      const record = current[index]!;
      const resurfacing = { ...record.resurfacing };
      if (suppressed) resurfacing.suppressedAt = changedAt;
      else delete resurfacing.suppressedAt;

      const next = [...current];
      next[index] = {
        ...record,
        ...(Object.keys(resurfacing).length > 0 ? { resurfacing } : {})
      } as LearningCycleRecord;
      await this.storage.set(LEARNING_CYCLES_STORAGE_KEY, next);
      updated = true;
    });

    await this.writeQueue;
    return updated;
  }

  async resolveThreadIdForRecord(
    recordId: string,
    fromThread: PlatformThreadIdentity,
    toThreadId: string,
    toUrl?: string
  ): Promise<boolean> {
    let updated = false;

    this.writeQueue = this.writeQueue.then(async () => {
      const current = await this.listRaw();
      const index = current.findIndex(
        (record) =>
          record.id === recordId && record.platform === fromThread.platform && record.threadId === fromThread.threadId
      );
      if (index < 0) return;

      const next = [...current];
      next[index] = {
        ...next[index],
        threadId: toThreadId,
        ...(toUrl ? { url: toUrl } : {})
      } as LearningCycleRecord;
      await this.storage.set(LEARNING_CYCLES_STORAGE_KEY, next);
      updated = true;
    });

    await this.writeQueue;
    return updated;
  }

  async getLatestForThread(thread: PlatformThreadIdentity): Promise<LearningCycleRecord | null> {
    const current = await this.listRaw();
    const matches = current
      .filter((record) => record.platform === thread.platform && record.threadId === thread.threadId)
      .sort((a, b) => b.timestamp - a.timestamp);

    return matches[0] ?? null;
  }

  private async listRaw(): Promise<LearningCycleRecord[]> {
    const raw = await this.storage.get<unknown>(LEARNING_CYCLES_STORAGE_KEY);
    return Array.isArray(raw) ? (raw as LearningCycleRecord[]) : [];
  }
}
