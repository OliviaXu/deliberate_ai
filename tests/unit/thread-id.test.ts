import { describe, expect, it } from 'vitest';
import { resolveThreadId } from '../../src/shared/thread-id';

describe('resolveThreadId', () => {
  it('uses URL pathname for Gemini thread identity', () => {
    expect(resolveThreadId('https://gemini.google.com/app/threads/123?hl=en')).toBe('/app/threads/123');
  });

  it('falls back to unknown for invalid urls', () => {
    expect(resolveThreadId('not-a-url')).toBe('unknown');
  });
});
