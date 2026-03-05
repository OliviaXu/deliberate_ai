import { describe, expect, it } from 'vitest';
import { isThreadIdCacheable, shouldCheckPersistentThreadEntries } from '../../src/content/thread-entry-policy';

describe('thread-entry-policy', () => {
  it('treats concrete Gemini thread ids as cacheable/queryable', () => {
    expect(isThreadIdCacheable('/app/threads/123')).toBe(true);
    expect(isThreadIdCacheable('/app/532b342f83b8e91e')).toBe(true);
    expect(shouldCheckPersistentThreadEntries('/app/threads/123')).toBe(true);
    expect(shouldCheckPersistentThreadEntries('/app/532b342f83b8e91e')).toBe(true);
  });

  it('treats placeholder and unknown thread ids as non-cacheable/non-queryable', () => {
    expect(isThreadIdCacheable('/app')).toBe(false);
    expect(isThreadIdCacheable('unknown')).toBe(false);
    expect(isThreadIdCacheable('/')).toBe(false);

    expect(shouldCheckPersistentThreadEntries('/app')).toBe(false);
    expect(shouldCheckPersistentThreadEntries('unknown')).toBe(false);
    expect(shouldCheckPersistentThreadEntries('/')).toBe(false);
  });
});
