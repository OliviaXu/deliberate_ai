import { StorageClient } from './storage';
import type { ReflectionRecord } from './types';

export const REFLECTIONS_STORAGE_KEY = 'deliberate.reflections.v1';

export class ReflectionStore {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly storage = new StorageClient()) {}

  async listAll(): Promise<ReflectionRecord[]> {
    return this.listRaw();
  }

  async append(record: ReflectionRecord): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      const current = await this.listRaw();
      await this.storage.set(REFLECTIONS_STORAGE_KEY, [...current, record]);
    });
    await this.writeQueue;
  }

  async hasCompletedReflectionForRecord(learningCycleRecordId: string): Promise<boolean> {
    const current = await this.listRaw();
    return current.some((record) => record.status === 'completed' && record.learningCycleRecordId === learningCycleRecordId);
  }

  private async listRaw(): Promise<ReflectionRecord[]> {
    const raw = await this.storage.get<unknown>(REFLECTIONS_STORAGE_KEY);
    return Array.isArray(raw) ? raw.filter(isReflectionRecord) : [];
  }
}

function isReflectionRecord(value: unknown): value is ReflectionRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<Record<keyof ReflectionRecord, unknown>>;
  return typeof record.id === 'string'
    && typeof record.timestamp === 'number'
    && typeof record.learningCycleRecordId === 'string'
    && record.status === 'completed'
    && (record.score === 0 || record.score === 25 || record.score === 50 || record.score === 75 || record.score === 100)
    && (record.notes === undefined || typeof record.notes === 'string');
}
