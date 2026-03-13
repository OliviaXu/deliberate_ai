import { StorageClient } from './storage';
import type { ReflectionRecord } from './types';

export const REFLECTIONS_STORAGE_KEY = 'deliberate.reflections.v1';

export class ReflectionStore {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly storage = new StorageClient()) {}

  async append(record: ReflectionRecord): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      const current = await this.listRaw();
      await this.storage.set(REFLECTIONS_STORAGE_KEY, [...current, record]);
    });
    await this.writeQueue;
  }

  async hasCompletedReflectionForThread(threadId: string): Promise<boolean> {
    const current = await this.listRaw();
    return current.some((record) => record.threadId === threadId && record.status === 'completed');
  }

  private async listRaw(): Promise<ReflectionRecord[]> {
    const raw = await this.storage.get<unknown>(REFLECTIONS_STORAGE_KEY);
    return Array.isArray(raw) ? (raw as ReflectionRecord[]) : [];
  }
}
