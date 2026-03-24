import { describe, expect, it } from 'vitest';
import {
  GEMINI_APP_PREFIX,
  GEMINI_HOST,
  PLACEHOLDER_GEMINI_THREAD_ID,
  isConcreteGeminiThreadId,
  isPlaceholderGeminiThreadId,
  resolveConcreteGeminiThreadId
} from '../../src/platforms/gemini/thread';
import { geminiPlatform } from '../../src/platforms/gemini/definition';

describe('resolveThreadId', () => {
  it('exports Gemini thread identity constants', () => {
    expect(PLACEHOLDER_GEMINI_THREAD_ID).toBe('/app');
    expect(GEMINI_HOST).toBe('gemini.google.com');
    expect(GEMINI_APP_PREFIX).toBe('/app/');
  });

  it('uses URL pathname for Gemini thread identity', () => {
    expect(geminiPlatform.resolveThreadId('https://gemini.google.com/app/threads/123?hl=en')).toBe('/app/threads/123');
  });

  it('falls back to unknown for invalid urls', () => {
    expect(geminiPlatform.resolveThreadId('not-a-url')).toBe('unknown');
  });

  it('resolves concrete Gemini thread ids from full URLs', () => {
    expect(resolveConcreteGeminiThreadId('https://gemini.google.com/app/abc123?hl=en')).toBe('/app/abc123');
    expect(resolveConcreteGeminiThreadId('https://gemini.google.com/app/threads/abc123')).toBe('/app/threads/abc123');
  });

  it('does not resolve concrete thread ids for placeholder or non-Gemini URLs', () => {
    expect(resolveConcreteGeminiThreadId('https://gemini.google.com/app')).toBeUndefined();
    expect(resolveConcreteGeminiThreadId('https://example.com/app/abc123')).toBeUndefined();
    expect(resolveConcreteGeminiThreadId('bad-url')).toBeUndefined();
  });

  it('classifies placeholder and concrete Gemini thread ids', () => {
    expect(isPlaceholderGeminiThreadId('/app')).toBe(true);
    expect(isPlaceholderGeminiThreadId('/app/abc123')).toBe(false);
    expect(isPlaceholderGeminiThreadId('unknown')).toBe(false);

    expect(isConcreteGeminiThreadId('/app/abc123')).toBe(true);
    expect(isConcreteGeminiThreadId('/app/threads/abc123')).toBe(true);
    expect(isConcreteGeminiThreadId('/app')).toBe(false);
    expect(isConcreteGeminiThreadId('unknown')).toBe(false);
  });
});
