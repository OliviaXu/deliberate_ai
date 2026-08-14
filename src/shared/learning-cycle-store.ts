import { StorageClient } from './storage';
import type { LearningCycleRecord, PlatformThreadIdentity } from './types';
import { LEARNING_CYCLES_STORAGE_KEY } from './schema-migration-v2';

export { LEARNING_CYCLES_STORAGE_KEY } from './schema-migration-v2';

export class LearningCycleStore {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly storage = new StorageClient()) {}

  async listAll(): Promise<LearningCycleRecord[]> {
    return this.listRaw();
  }

  async append(record: LearningCycleRecord): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      const current = await this.listRaw();
      if (current.some((existing) => existing.id === record.id)) return;
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
      .sort((a, b) => b.occurredAt - a.occurredAt);

    return matches[0] ?? null;
  }

  private async listRaw(): Promise<LearningCycleRecord[]> {
    const raw = await this.storage.get<unknown>(LEARNING_CYCLES_STORAGE_KEY);
    return Array.isArray(raw) ? raw.filter(isLearningCycleRecord) : [];
  }
}

function isLearningCycleRecord(value: unknown): value is LearningCycleRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || record.id.length === 0
    || typeof record.occurredAt !== 'number' || !Number.isFinite(record.occurredAt)
    || (record.platform !== 'chatgpt' && record.platform !== 'claude' && record.platform !== 'gemini')
    || typeof record.threadId !== 'string' || record.threadId.length === 0
    || typeof record.prompt !== 'string'
    || (record.url !== undefined && typeof record.url !== 'string')
    || !isResurfacingState(record.resurfacing)) return false;

  if (record.mode === 'delegation') return record.startingPoint === undefined;
  if (record.mode === 'problem_solving') {
    return typeof record.startingPoint === 'string' && record.startingPoint.trim().length > 0;
  }
  return record.mode === 'learning'
    && (record.startingPoint === undefined || typeof record.startingPoint === 'string');
}

function isResurfacingState(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const resurfacing = value as Record<string, unknown>;
  return (resurfacing.lastSurfacedAt === undefined
      || (typeof resurfacing.lastSurfacedAt === 'number' && Number.isFinite(resurfacing.lastSurfacedAt)))
    && (resurfacing.suppressedAt === undefined
      || (typeof resurfacing.suppressedAt === 'number' && Number.isFinite(resurfacing.suppressedAt)));
}
