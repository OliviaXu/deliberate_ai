import { beforeEach, describe, expect, it } from 'vitest';
import type { LearningCycleRecord } from '../../src/shared/types';
import { LEARNING_CYCLES_STORAGE_KEY, LearningCycleStore } from '../../src/shared/learning-cycle-store';

function makeRecord(overrides: Partial<LearningCycleRecord> = {}): LearningCycleRecord {
  const base: LearningCycleRecord = {
    id: '1',
    timestamp: 1,
    platform: 'gemini',
    threadId: '/app/abc',
    mode: 'delegation',
    prompt: 'draft prompt'
  };
  return { ...base, ...overrides } as LearningCycleRecord;
}

describe('LearningCycleStore', () => {
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

  it('appends records in order', async () => {
    const store = new LearningCycleStore();
    await store.append(makeRecord({ id: '1' }));
    await store.append(makeRecord({ id: '2', mode: 'learning', priorKnowledgeNote: 'I know basics' }));

    const records = (storageData[LEARNING_CYCLES_STORAGE_KEY] as LearningCycleRecord[] | undefined) || [];
    expect(records).toHaveLength(2);
    expect(records[0]?.id).toBe('1');
    expect(records[1]?.id).toBe('2');
    expect(records[1]).toMatchObject({
      mode: 'learning',
      priorKnowledgeNote: 'I know basics'
    });
  });

  it('does not lose records when append calls overlap', async () => {
    const store = new LearningCycleStore();

    await Promise.all([store.append(makeRecord({ id: '1' })), store.append(makeRecord({ id: '2' })), store.append(makeRecord({ id: '3' }))]);

    const records = (storageData[LEARNING_CYCLES_STORAGE_KEY] as LearningCycleRecord[] | undefined) || [];
    expect(records).toHaveLength(3);
    expect(records.map((record) => record.id)).toEqual(['1', '2', '3']);
  });

  it('recovers to empty array when stored value is invalid', async () => {
    const chromeApi = (globalThis as { chrome?: { storage?: { local?: { set: (items: Record<string, unknown>) => Promise<void> } } } })
      .chrome;
    await chromeApi?.storage?.local?.set({ 'deliberate.learningCycles.v1': { nope: true } });

    const store = new LearningCycleStore();
    await store.append(makeRecord({ id: 'first' }));
    const records = (storageData[LEARNING_CYCLES_STORAGE_KEY] as LearningCycleRecord[] | undefined) || [];
    expect(records).toHaveLength(1);
    expect(records[0]?.id).toBe('first');
  });

  it('reports thread-level records', async () => {
    const store = new LearningCycleStore();
    await store.append(makeRecord({ id: '1', threadId: '/app/threads/one' }));
    await store.append(makeRecord({ id: '2', threadId: '/app/threads/two' }));

    await expect(store.getLatestForThread({ platform: 'gemini', threadId: '/app/threads/one' })).resolves.toMatchObject({ id: '1' });
    await expect(store.getLatestForThread({ platform: 'gemini', threadId: '/app/threads/missing' })).resolves.toBeNull();
  });

  it('lists all stored records', async () => {
    const store = new LearningCycleStore();
    await store.append(makeRecord({ id: '1', threadId: '/app/threads/one' }));
    await store.append(makeRecord({ id: '2', threadId: '/app/threads/two' }));

    await expect(store.listAll()).resolves.toEqual([
      expect.objectContaining({ id: '1', threadId: '/app/threads/one' }),
      expect.objectContaining({ id: '2', threadId: '/app/threads/two' })
    ]);
  });

  it('resolves a placeholder thread id for a specific record', async () => {
    const store = new LearningCycleStore();
    await store.append(makeRecord({ id: '1', threadId: '/app' }));
    await store.append(makeRecord({ id: '2', threadId: '/app/threads/other' }));

    await expect(
      store.resolveThreadIdForRecord('1', { platform: 'gemini', threadId: '/app' }, '/app/532b342f83b8e91e')
    ).resolves.toBe(true);

    const records = (storageData[LEARNING_CYCLES_STORAGE_KEY] as LearningCycleRecord[] | undefined) || [];
    expect(records[0]?.threadId).toBe('/app/532b342f83b8e91e');
    expect(records[1]?.threadId).toBe('/app/threads/other');
  });

  it('does not resolve when expected fromThreadId no longer matches', async () => {
    const store = new LearningCycleStore();
    await store.append(makeRecord({ id: '1', threadId: '/app/threads/already-final' }));

    await expect(
      store.resolveThreadIdForRecord('1', { platform: 'gemini', threadId: '/app' }, '/app/532b342f83b8e91e')
    ).resolves.toBe(false);
  });

  it('returns the latest learning-cycle interaction for a thread regardless of mode', async () => {
    const store = new LearningCycleStore();
    await store.append(
      makeRecord({ id: 'learning-1', threadId: '/app/threads/one', timestamp: 20, mode: 'learning', priorKnowledgeNote: 'I know the basics' })
    );
    await store.append(
      makeRecord({
        id: 'delegation-1',
        threadId: '/app/threads/one',
        timestamp: 30,
        mode: 'delegation'
      })
    );

    await expect(store.getLatestForThread({ platform: 'gemini', threadId: '/app/threads/one' })).resolves.toMatchObject({
      id: 'delegation-1',
      mode: 'delegation'
    });
    await expect(store.getLatestForThread({ platform: 'gemini', threadId: '/app/threads/missing' })).resolves.toBeNull();
  });

  it('isolates thread lookups when two platforms share the same raw thread id', async () => {
    const store = new LearningCycleStore();
    await store.append(makeRecord({ id: 'gemini-record', platform: 'gemini', threadId: '/shared/thread', timestamp: 10 }));
    await store.append(makeRecord({ id: 'chatgpt-record', platform: 'chatgpt', threadId: '/shared/thread', timestamp: 20 }));

    await expect(store.getLatestForThread({ platform: 'gemini', threadId: '/shared/thread' })).resolves.toMatchObject({
      id: 'gemini-record',
      platform: 'gemini'
    });
    await expect(store.getLatestForThread({ platform: 'chatgpt', threadId: '/shared/thread' })).resolves.toMatchObject({
      id: 'chatgpt-record',
      platform: 'chatgpt'
    });
  });
});
