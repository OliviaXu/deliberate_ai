import { beforeEach, describe, expect, it } from 'vitest';
import type { ReflectionRecord } from '../../src/shared/types';
import { REFLECTIONS_STORAGE_KEY, ReflectionStore } from '../../src/shared/reflection-store';

function makeReflection(overrides: Partial<ReflectionRecord> = {}): ReflectionRecord {
  return {
    id: 'reflection-1',
    timestamp: 1,
    threadId: '/app/threads/thread-a',
    learningCycleRecordId: 'record-1',
    status: 'completed',
    score: 75,
    ...overrides
  };
}

function makeLegacyReflection(overrides: Partial<ReflectionRecord> = {}): ReflectionRecord {
  const reflection = makeReflection(overrides);
  delete (reflection as { learningCycleRecordId?: string }).learningCycleRecordId;
  return reflection;
}

describe('ReflectionStore', () => {
  let storageData: Record<string, unknown>;

  beforeEach(() => {
    storageData = {};
    (globalThis as { chrome?: unknown }).chrome = {
      storage: {
        local: {
          async set(items: Record<string, unknown>) {
            Object.assign(storageData, items);
          },
          async get(key: string) {
            return { [key]: storageData[key] };
          }
        }
      }
    };
  });

  it('appends completed reflections in order', async () => {
    const store = new ReflectionStore();

    await store.append(makeReflection({ id: 'reflection-1' }));
    await store.append(makeReflection({ id: 'reflection-2', notes: 'I should compare against rollback metrics first.' }));

    const records = (storageData[REFLECTIONS_STORAGE_KEY] as ReflectionRecord[] | undefined) || [];
    expect(records).toHaveLength(2);
    expect(records[0]?.id).toBe('reflection-1');
    expect(records[1]).toMatchObject({
      id: 'reflection-2',
      notes: 'I should compare against rollback metrics first.'
    });
  });

  it('reports whether a learning-cycle record already has a completed reflection', async () => {
    const store = new ReflectionStore();

    await store.append(makeReflection({ learningCycleRecordId: 'record-a', threadId: '/app/threads/thread-a' }));
    await store.append(
      makeReflection({
        id: 'reflection-2',
        learningCycleRecordId: 'record-b',
        threadId: '/app/threads/thread-b',
        score: 25
      })
    );

    await expect(store.hasCompletedReflectionForRecord('record-a')).resolves.toBe(true);
    await expect(store.hasCompletedReflectionForRecord('record-missing')).resolves.toBe(false);
  });

  it('does not treat legacy thread-only reflections as completed for record-based lookups', async () => {
    const store = new ReflectionStore();

    await store.append(
      makeLegacyReflection({
        threadId: '/app/threads/thread-a'
      })
    );

    await expect(store.hasCompletedReflectionForRecord('record-a')).resolves.toBe(false);
  });

  it('recovers to an empty reflection list when stored value is invalid', async () => {
    const chromeApi = (globalThis as { chrome?: { storage?: { local?: { set: (items: Record<string, unknown>) => Promise<void> } } } })
      .chrome;
    await chromeApi?.storage?.local?.set({ [REFLECTIONS_STORAGE_KEY]: { nope: true } });

    const store = new ReflectionStore();
    await store.append(makeReflection({ id: 'reflection-3' }));

    const records = (storageData[REFLECTIONS_STORAGE_KEY] as ReflectionRecord[] | undefined) || [];
    expect(records).toHaveLength(1);
    expect(records[0]?.id).toBe('reflection-3');
  });

  it('lists all stored reflections', async () => {
    const store = new ReflectionStore();

    await store.append(makeReflection({ id: 'reflection-1', threadId: '/app/threads/thread-a' }));
    await store.append(makeReflection({ id: 'reflection-2', threadId: '/app/threads/thread-b', score: 25 }));

    await expect(store.listAll()).resolves.toEqual([
      expect.objectContaining({ id: 'reflection-1', threadId: '/app/threads/thread-a' }),
      expect.objectContaining({ id: 'reflection-2', threadId: '/app/threads/thread-b', score: 25 })
    ]);
  });
});
