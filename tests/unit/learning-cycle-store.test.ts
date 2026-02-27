import { beforeEach, describe, expect, it } from 'vitest';
import type { LearningCycleRecord } from '../../src/shared/types';
import { LearningCycleStore } from '../../src/shared/learning-cycle-store';

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
  beforeEach(() => {
    const data: Record<string, unknown> = {};
    (globalThis as { chrome?: unknown }).chrome = {
      storage: {
        local: {
          async set(items: Record<string, unknown>) {
            Object.assign(data, items);
          },
          async get(key: string) {
            return { [key]: data[key] };
          }
        }
      }
    };
  });

  it('appends and lists records in order', async () => {
    const store = new LearningCycleStore();
    await store.append(makeRecord({ id: '1' }));
    await store.append(makeRecord({ id: '2', mode: 'learning', priorKnowledgeNote: 'I know basics' }));

    const records = await store.list();
    expect(records).toHaveLength(2);
    expect(records[0]?.id).toBe('1');
    expect(records[1]?.id).toBe('2');
    expect(records[1]).toMatchObject({
      mode: 'learning',
      priorKnowledgeNote: 'I know basics'
    });
  });

  it('recovers to empty list when stored value is invalid', async () => {
    const chromeApi = (globalThis as { chrome?: { storage?: { local?: { set: (items: Record<string, unknown>) => Promise<void> } } } })
      .chrome;
    await chromeApi?.storage?.local?.set({ 'deliberate.learningCycles.v1': { nope: true } });

    const store = new LearningCycleStore();
    const records = await store.list();
    expect(records).toEqual([]);
  });
});
