import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LEARNING_CYCLES_V1_STORAGE_KEY,
  LEARNING_CYCLES_STORAGE_KEY,
  REFLECTIONS_V1_STORAGE_KEY,
  REFLECTIONS_STORAGE_KEY,
  SCHEMA_MIGRATION_STORAGE_KEY,
  migrateLocalStorageToV2
} from '../../src/shared/schema-migration-v2';

describe('local v2 schema migration', () => {
  let storageData: Record<string, unknown>;
  let set: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storageData = {};
    set = vi.fn(async (items: Record<string, unknown>) => Object.assign(storageData, items));
    (globalThis as { chrome?: unknown }).chrome = {
      storage: { local: { set, async get() { return { ...storageData }; } } }
    };
  });

  it('converts every mode, optional fields, reflection history, and resurfacing state', async () => {
    storageData[LEARNING_CYCLES_V1_STORAGE_KEY] = [
      { id: 'd', timestamp: 1, platform: 'chatgpt', threadId: '/c/new', prompt: 'Delegate', mode: 'delegation' },
      { id: 'p', timestamp: 2, platform: 'claude', threadId: '/chat/p', url: 'https://claude.ai/chat/p', prompt: 'Solve', mode: 'problem_solving', prediction: '  Suspect cache  ', resurfacing: { lastSurfacedAt: 7, suppressedAt: 8 } },
      { id: 'l1', timestamp: 3, platform: 'gemini', threadId: '/app/l1', prompt: 'Learn', mode: 'learning', priorKnowledgeNote: '  basics  ' },
      { id: 'l2', timestamp: 4, platform: 'gemini', threadId: '/app/l2', prompt: 'Learn more', mode: 'learning' }
    ];
    storageData[REFLECTIONS_V1_STORAGE_KEY] = [
      { id: 'r1', timestamp: 5, learningCycleRecordId: 'p', threadId: 'legacy', status: 'completed', score: 75, notes: 'Written' },
      { id: 'r2', timestamp: 6, learningCycleRecordId: 'p', status: 'completed', score: 25 }
    ];

    await migrateLocalStorageToV2();

    expect(storageData[LEARNING_CYCLES_STORAGE_KEY]).toEqual([
      { id: 'd', occurredAt: 1, platform: 'chatgpt', threadId: '/c/new', prompt: 'Delegate', mode: 'delegation' },
      { id: 'p', occurredAt: 2, platform: 'claude', threadId: '/chat/p', url: 'https://claude.ai/chat/p', prompt: 'Solve', mode: 'problem_solving', startingPoint: '  Suspect cache  ', resurfacing: { lastSurfacedAt: 7, suppressedAt: 8 } },
      { id: 'l1', occurredAt: 3, platform: 'gemini', threadId: '/app/l1', prompt: 'Learn', mode: 'learning', startingPoint: '  basics  ' },
      { id: 'l2', occurredAt: 4, platform: 'gemini', threadId: '/app/l2', prompt: 'Learn more', mode: 'learning' }
    ]);
    expect(storageData[REFLECTIONS_STORAGE_KEY]).toEqual([
      { id: 'r1', occurredAt: 5, learningCycleId: 'p', score: 75, notes: 'Written' },
      { id: 'r2', occurredAt: 6, learningCycleId: 'p', score: 25 }
    ]);
    expect(set).toHaveBeenCalledTimes(1);
    expect(storageData[SCHEMA_MIGRATION_STORAGE_KEY]).toEqual({
      completed: true,
      learningCycles: { input: 4, output: 4, dropped: 0 },
      reflections: { input: 2, output: 2, dropped: 0 }
    });
  });

  it('drops invalid, dangling, legacy, and duplicate records deterministically', async () => {
    storageData[LEARNING_CYCLES_V1_STORAGE_KEY] = [
      { id: 'kept', timestamp: 1, platform: 'gemini', threadId: '/app/x', prompt: 'P', mode: 'learning' },
      { id: 'kept', timestamp: 2, platform: 'gemini', threadId: '/app/y', prompt: 'Duplicate', mode: 'learning' },
      { id: 'invalid', timestamp: 3, platform: 'gemini', threadId: '/app/z', prompt: 'P', mode: 'problem_solving', prediction: '   ' }
    ];
    storageData[REFLECTIONS_V1_STORAGE_KEY] = [
      { id: 'valid', timestamp: 4, learningCycleRecordId: 'kept', status: 'completed', score: 100 },
      { id: 'valid', timestamp: 5, learningCycleRecordId: 'kept', status: 'completed', score: 75 },
      { id: 'dangling', timestamp: 6, learningCycleRecordId: 'missing', status: 'completed', score: 50 },
      { id: 'legacy', timestamp: 7, threadId: '/app/x', status: 'completed', score: 25 },
      { id: 'invalid-score', timestamp: 8, learningCycleRecordId: 'kept', status: 'completed', score: 33 }
    ];

    await migrateLocalStorageToV2();

    expect(storageData[LEARNING_CYCLES_STORAGE_KEY]).toHaveLength(1);
    expect(storageData[REFLECTIONS_STORAGE_KEY]).toEqual([
      { id: 'valid', occurredAt: 4, learningCycleId: 'kept', score: 100 }
    ]);
    expect(storageData[SCHEMA_MIGRATION_STORAGE_KEY]).toMatchObject({
      learningCycles: { input: 3, output: 1, dropped: 2 },
      reflections: { input: 5, output: 1, dropped: 4 }
    });
  });

  it('regenerates partial output, then treats a later invocation as a separate restart', async () => {
    storageData[LEARNING_CYCLES_V1_STORAGE_KEY] = [
      { id: 'source', timestamp: 1, platform: 'chatgpt', threadId: '/c/x', prompt: 'P', mode: 'delegation' }
    ];
    storageData[LEARNING_CYCLES_STORAGE_KEY] = [{ id: 'partial' }];

    await migrateLocalStorageToV2();
    expect(storageData[LEARNING_CYCLES_STORAGE_KEY]).toEqual([
      { id: 'source', occurredAt: 1, platform: 'chatgpt', threadId: '/c/x', prompt: 'P', mode: 'delegation' }
    ]);

    const completedV2 = structuredClone(storageData[LEARNING_CYCLES_STORAGE_KEY]);
    storageData[LEARNING_CYCLES_V1_STORAGE_KEY] = [];
    storageData[REFLECTIONS_V1_STORAGE_KEY] = [{ id: 'late-v1-record' }];
    await migrateLocalStorageToV2();
    expect(storageData[LEARNING_CYCLES_STORAGE_KEY]).toEqual(completedV2);
    expect(storageData[REFLECTIONS_STORAGE_KEY]).toEqual([]);
    expect(set).toHaveBeenCalledTimes(1);
  });

  it('retries from untouched v1 after an atomic write failure and logs only the successful migration', async () => {
    storageData[LEARNING_CYCLES_V1_STORAGE_KEY] = [
      { id: 'source', timestamp: 1, platform: 'gemini', threadId: '/app', prompt: 'P', mode: 'learning' }
    ];
    const migrationLog = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    set.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(migrateLocalStorageToV2()).rejects.toThrow('storage unavailable');
    expect(storageData[SCHEMA_MIGRATION_STORAGE_KEY]).toBeUndefined();
    expect(migrationLog).not.toHaveBeenCalled();

    await migrateLocalStorageToV2();
    expect(storageData[LEARNING_CYCLES_STORAGE_KEY]).toEqual([
      { id: 'source', occurredAt: 1, platform: 'gemini', threadId: '/app', prompt: 'P', mode: 'learning' }
    ]);
    expect(migrationLog).toHaveBeenCalledOnce();
    expect(migrationLog).toHaveBeenCalledWith(
      'Deliberate AI local storage migration to v2 completed',
      expect.objectContaining({
        learningCycles: { input: 1, output: 1, dropped: 0 },
        reflections: { input: 0, output: 0, dropped: 0 }
      })
    );

    await migrateLocalStorageToV2();
    expect(migrationLog).toHaveBeenCalledOnce();
    migrationLog.mockRestore();
  });
});
