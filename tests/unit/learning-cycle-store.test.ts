import { beforeEach, describe, expect, it } from 'vitest';
import type { LearningCycleRecord } from '../../src/shared/types';
import { LEARNING_CYCLES_STORAGE_KEY, LearningCycleStore } from '../../src/shared/learning-cycle-store';

function makeRecord(overrides: Partial<LearningCycleRecord> = {}): LearningCycleRecord {
  const base: LearningCycleRecord = {
    id: '1',
    occurredAt: 1,
    platform: 'gemini',
    url: 'https://gemini.google.com/app/abc',
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
    await store.append(makeRecord({ id: '2', mode: 'learning', startingPoint: 'I know basics' }));

    const records = (storageData[LEARNING_CYCLES_STORAGE_KEY] as LearningCycleRecord[] | undefined) || [];
    expect(records).toHaveLength(2);
    expect(records[0]?.id).toBe('1');
    expect(records[1]?.id).toBe('2');
    expect(records[1]).toMatchObject({
      mode: 'learning',
      startingPoint: 'I know basics'
    });
  });

  it('does not lose records when append calls overlap', async () => {
    const store = new LearningCycleStore();

    await Promise.all([store.append(makeRecord({ id: '1' })), store.append(makeRecord({ id: '2' })), store.append(makeRecord({ id: '3' }))]);

    const records = (storageData[LEARNING_CYCLES_STORAGE_KEY] as LearningCycleRecord[] | undefined) || [];
    expect(records).toHaveLength(3);
    expect(records.map((record) => record.id)).toEqual(['1', '2', '3']);
  });

  it('makes repeated inserts with the same id idempotent', async () => {
    const store = new LearningCycleStore();
    await store.append(makeRecord({ id: 'same', prompt: 'first' }));
    await store.append(makeRecord({ id: 'same', prompt: 'second' }));

    expect(storageData[LEARNING_CYCLES_STORAGE_KEY]).toEqual([
      expect.objectContaining({ id: 'same', prompt: 'first' })
    ]);
  });

  it('recovers to empty array when stored value is invalid', async () => {
    const chromeApi = (globalThis as { chrome?: { storage?: { local?: { set: (items: Record<string, unknown>) => Promise<void> } } } })
      .chrome;
    await chromeApi?.storage?.local?.set({ [LEARNING_CYCLES_STORAGE_KEY]: { nope: true } });

    const store = new LearningCycleStore();
    await store.append(makeRecord({ id: 'first' }));
    const records = (storageData[LEARNING_CYCLES_STORAGE_KEY] as LearningCycleRecord[] | undefined) || [];
    expect(records).toHaveLength(1);
    expect(records[0]?.id).toBe('first');
  });

  it('filters malformed records read from persisted v2 storage', async () => {
    storageData[LEARNING_CYCLES_STORAGE_KEY] = [
      makeRecord({ id: 'valid-delegation' }),
      { ...makeRecord({ id: 'missing-starting-point' }), mode: 'problem_solving' },
      { ...makeRecord({ id: 'wrong-platform' }), platform: 'other' },
      { ...makeRecord({ id: 'invalid-resurfacing' }), resurfacing: { suppressedAt: 'yesterday' } },
      makeRecord({ id: 'valid-learning', mode: 'learning', startingPoint: 'Known context' })
    ];

    await expect(new LearningCycleStore().listAll()).resolves.toEqual([
      expect.objectContaining({ id: 'valid-delegation' }),
      expect.objectContaining({ id: 'valid-learning', mode: 'learning', startingPoint: 'Known context' })
    ]);
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

  it('records a resurfacing presentation without replacing concurrent record changes', async () => {
    const store = new LearningCycleStore();
    await store.append(makeRecord({ id: 'featured', mode: 'learning', startingPoint: 'Starting point' }));

    await Promise.all([
      store.markResurfaced('featured', 1234),
      store.append(makeRecord({ id: 'new-record' }))
    ]);

    const records = (storageData[LEARNING_CYCLES_STORAGE_KEY] as LearningCycleRecord[] | undefined) || [];
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      id: 'featured',
      mode: 'learning',
      startingPoint: 'Starting point',
      resurfacing: { lastSurfacedAt: 1234 }
    });
    expect(records[1]?.id).toBe('new-record');
  });

  it('reports when the requested resurfacing record no longer exists', async () => {
    const store = new LearningCycleStore();

    await expect(store.markResurfaced('missing', 1234)).resolves.toBe(false);
  });

  it('sets and clears suppression without losing presentation state or concurrent writes', async () => {
    const store = new LearningCycleStore();
    await store.append(makeRecord({
      id: 'featured',
      mode: 'learning',
      startingPoint: 'Starting point',
      resurfacing: { lastSurfacedAt: 1234 }
    }));

    await Promise.all([
      store.setResurfacingSuppressed('featured', true, 5678),
      store.append(makeRecord({ id: 'new-record' }))
    ]);

    let records = storageData[LEARNING_CYCLES_STORAGE_KEY] as LearningCycleRecord[];
    expect(records[0]?.resurfacing).toEqual({ lastSurfacedAt: 1234, suppressedAt: 5678 });
    expect(records[1]?.id).toBe('new-record');

    await expect(store.setResurfacingSuppressed('featured', false, 9999)).resolves.toBe(true);
    records = storageData[LEARNING_CYCLES_STORAGE_KEY] as LearningCycleRecord[];
    expect(records[0]?.resurfacing).toEqual({ lastSurfacedAt: 1234 });
  });

  it('reports when a suppression target no longer exists', async () => {
    const store = new LearningCycleStore();
    await expect(store.setResurfacingSuppressed('missing', true, 5678)).resolves.toBe(false);
  });

  it('resolves a placeholder thread id for a specific record', async () => {
    const store = new LearningCycleStore();
    await store.append(makeRecord({ id: '1', url: 'https://gemini.google.com/app', threadId: '/app' }));
    await store.append(makeRecord({ id: '2', threadId: '/app/threads/other' }));

    await expect(
      store.resolveThreadIdForRecord(
        '1',
        { platform: 'gemini', threadId: '/app' },
        '/app/532b342f83b8e91e',
        'https://gemini.google.com/app/532b342f83b8e91e'
      )
    ).resolves.toBe(true);

    const records = (storageData[LEARNING_CYCLES_STORAGE_KEY] as LearningCycleRecord[] | undefined) || [];
    expect(records[0]?.threadId).toBe('/app/532b342f83b8e91e');
    expect(records[0]?.url).toBe('https://gemini.google.com/app/532b342f83b8e91e');
    expect(records[1]?.threadId).toBe('/app/threads/other');
  });

  it('does not resolve when expected fromThreadId no longer matches', async () => {
    const store = new LearningCycleStore();
    await store.append(makeRecord({ id: '1', threadId: '/app/threads/already-final' }));

    await expect(
      store.resolveThreadIdForRecord(
        '1',
        { platform: 'gemini', threadId: '/app' },
        '/app/532b342f83b8e91e',
        'https://gemini.google.com/app/532b342f83b8e91e'
      )
    ).resolves.toBe(false);
  });

  it('returns the latest learning-cycle interaction for a thread regardless of mode', async () => {
    const store = new LearningCycleStore();
    await store.append(
      makeRecord({ id: 'learning-1', threadId: '/app/threads/one', occurredAt: 20, mode: 'learning', startingPoint: 'I know the basics' })
    );
    await store.append(
      makeRecord({
        id: 'delegation-1',
        threadId: '/app/threads/one',
        occurredAt: 30,
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
    await store.append(makeRecord({ id: 'gemini-record', platform: 'gemini', threadId: '/shared/thread', occurredAt: 10 }));
    await store.append(makeRecord({ id: 'chatgpt-record', platform: 'chatgpt', threadId: '/shared/thread', occurredAt: 20 }));

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
