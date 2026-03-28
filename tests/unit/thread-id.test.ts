import { describe, expect, it } from 'vitest';
import {
  CHATGPT_HOST,
  CHATGPT_THREAD_PREFIX,
  PLACEHOLDER_CHATGPT_THREAD_ID,
} from '../../src/platforms/chatgpt/definition';
import { chatgptPlatform } from '../../src/platforms/chatgpt/definition';
import {
  GEMINI_APP_PREFIX,
  GEMINI_HOST,
  PLACEHOLDER_GEMINI_THREAD_ID,
  geminiPlatform
} from '../../src/platforms/gemini/definition';

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
    expect(geminiPlatform.resolveConcreteThreadId('https://gemini.google.com/app/abc123?hl=en')).toBe('/app/abc123');
    expect(geminiPlatform.resolveConcreteThreadId('https://gemini.google.com/app/threads/abc123')).toBe('/app/threads/abc123');
  });

  it('does not resolve concrete thread ids for placeholder or non-Gemini URLs', () => {
    expect(geminiPlatform.resolveConcreteThreadId('https://gemini.google.com/app')).toBeUndefined();
    expect(geminiPlatform.resolveConcreteThreadId('https://example.com/app/abc123')).toBeUndefined();
    expect(geminiPlatform.resolveConcreteThreadId('bad-url')).toBeUndefined();
  });

  it('classifies placeholder and concrete Gemini thread ids', () => {
    expect(geminiPlatform.isPlaceholderThreadId('/app')).toBe(true);
    expect(geminiPlatform.isPlaceholderThreadId('/app/abc123')).toBe(false);
    expect(geminiPlatform.isPlaceholderThreadId('unknown')).toBe(false);

    expect(geminiPlatform.isConcreteThreadId('/app/abc123')).toBe(true);
    expect(geminiPlatform.isConcreteThreadId('/app/threads/abc123')).toBe(true);
    expect(geminiPlatform.isConcreteThreadId('/app')).toBe(false);
    expect(geminiPlatform.isConcreteThreadId('unknown')).toBe(false);
  });

  it('exports ChatGPT thread identity constants', () => {
    expect(PLACEHOLDER_CHATGPT_THREAD_ID).toBe('/');
    expect(CHATGPT_HOST).toBe('chatgpt.com');
    expect(CHATGPT_THREAD_PREFIX).toBe('/c/');
  });

  it('uses URL pathname for ChatGPT thread identity', () => {
    expect(chatgptPlatform.resolveThreadId('https://chatgpt.com/c/abc123?model=gpt-5')).toBe('/c/abc123');
  });

  it('resolves concrete ChatGPT thread ids from full URLs', () => {
    expect(chatgptPlatform.resolveConcreteThreadId('https://chatgpt.com/c/abc123')).toBe('/c/abc123');
    expect(chatgptPlatform.resolveConcreteThreadId('https://chatgpt.com/c/abc123?model=gpt-5')).toBe('/c/abc123');
  });

  it('does not resolve concrete ChatGPT thread ids for placeholder or non-ChatGPT URLs', () => {
    expect(chatgptPlatform.resolveConcreteThreadId('https://chatgpt.com/')).toBeUndefined();
    expect(chatgptPlatform.resolveConcreteThreadId('https://example.com/c/abc123')).toBeUndefined();
    expect(chatgptPlatform.resolveConcreteThreadId('bad-url')).toBeUndefined();
  });

  it('classifies placeholder and concrete ChatGPT thread ids', () => {
    expect(chatgptPlatform.isPlaceholderThreadId('/')).toBe(true);
    expect(chatgptPlatform.isPlaceholderThreadId('/c/abc123')).toBe(false);
    expect(chatgptPlatform.isPlaceholderThreadId('unknown')).toBe(false);

    expect(chatgptPlatform.isConcreteThreadId('/c/abc123')).toBe(true);
    expect(chatgptPlatform.isConcreteThreadId('/')).toBe(false);
    expect(chatgptPlatform.isConcreteThreadId('unknown')).toBe(false);
  });
});
