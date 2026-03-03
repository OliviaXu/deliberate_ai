import { beforeEach, describe, expect, it } from 'vitest';
import { LEARNING_CYCLES_STORAGE_KEY } from '../../src/shared/learning-cycle-store';
import { loadThinkingJournalEntries } from '../../src/thinking-journal/thinking-journal-store';

describe('loadThinkingJournalEntries', () => {
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

  it('loads and maps records from chrome local storage', async () => {
    const nowMs = Date.UTC(2026, 2, 3, 12, 0, 0);
    const dayMs = 24 * 60 * 60 * 1000;

    storageData[LEARNING_CYCLES_STORAGE_KEY] = [
      {
        id: 'problem',
        timestamp: nowMs - dayMs,
        platform: 'gemini',
        threadId: '/app/threads/abc',
        mode: 'problem_solving',
        prompt: 'Investigate this production incident'
      }
    ];

    const entries = await loadThinkingJournalEntries(nowMs);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'problem',
      mode: 'problem_solving',
      hypothesis: 'No hypothesis recorded.'
    });
  });

  it('returns an empty list when storage value is invalid', async () => {
    const nowMs = Date.UTC(2026, 2, 3, 12, 0, 0);
    storageData[LEARNING_CYCLES_STORAGE_KEY] = { nope: true };

    const entries = await loadThinkingJournalEntries(nowMs);
    expect(entries).toEqual([]);
  });
});
