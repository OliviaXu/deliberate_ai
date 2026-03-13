import { beforeEach, describe, expect, it } from 'vitest';
import type { ReflectionRecord } from '../../src/shared/types';
import { REFLECTIONS_STORAGE_KEY, ReflectionStore } from '../../src/shared/reflection-store';

function makeReflection(overrides: Partial<ReflectionRecord> = {}): ReflectionRecord {
  return {
    id: 'reflection-1',
    timestamp: 1,
    threadId: '/app/threads/thread-a',
    status: 'completed',
    score: 75,
    ...overrides
  };
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

  it('reports whether a thread already has a completed reflection', async () => {
    const store = new ReflectionStore();

    await store.append(makeReflection({ threadId: '/app/threads/thread-a' }));
    await store.append(makeReflection({ id: 'reflection-2', threadId: '/app/threads/thread-b', score: 25 }));

    await expect(store.hasCompletedReflectionForThread('/app/threads/thread-a')).resolves.toBe(true);
    await expect(store.hasCompletedReflectionForThread('/app/threads/thread-missing')).resolves.toBe(false);
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
});
