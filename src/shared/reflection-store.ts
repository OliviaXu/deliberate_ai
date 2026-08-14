import { StorageClient } from './storage';
import type { ReflectionRecord } from './types';
import { REFLECTIONS_STORAGE_KEY } from './schema-migration-v2';

export { REFLECTIONS_STORAGE_KEY } from './schema-migration-v2';

export class ReflectionStore {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly storage = new StorageClient()) {}

  async listAll(): Promise<ReflectionRecord[]> {
    return this.listRaw();
  }

  async append(record: ReflectionRecord): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      const current = await this.listRaw();
      if (current.some((existing) => existing.id === record.id)) return;
      await this.storage.set(REFLECTIONS_STORAGE_KEY, [...current, record]);
    });
    await this.writeQueue;
  }

  async hasCompletedReflectionForRecord(learningCycleId: string): Promise<boolean> {
    const current = await this.listRaw();
    return current.some((record) => record.learningCycleId === learningCycleId);
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
    && typeof record.occurredAt === 'number'
    && typeof record.learningCycleId === 'string'
    && (record.score === 0 || record.score === 25 || record.score === 50 || record.score === 75 || record.score === 100)
    && (record.notes === undefined || typeof record.notes === 'string');
}
