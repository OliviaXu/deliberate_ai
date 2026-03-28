import { describe, expect, it } from 'vitest';
import {
  CHATGPT_HOST,
  CHATGPT_THREAD_PREFIX,
  PLACEHOLDER_CHATGPT_THREAD_ID,
  isConcreteChatGPTThreadId,
  isPlaceholderChatGPTThreadId,
} from '../../src/platforms/chatgpt/thread';
import { resolveConcreteChatGPTThreadId } from '../../src/platforms/chatgpt/thread';
import {
  GEMINI_APP_PREFIX as GEMINI_APP_PREFIX_VALUE,
  GEMINI_HOST as GEMINI_HOST_VALUE,
  PLACEHOLDER_GEMINI_THREAD_ID as PLACEHOLDER_GEMINI_THREAD_ID_VALUE,
  isConcreteGeminiThreadId as isConcreteGeminiThreadIdValue,
  isPlaceholderGeminiThreadId as isPlaceholderGeminiThreadIdValue,
  resolveConcreteGeminiThreadId as resolveConcreteGeminiThreadIdValue
} from '../../src/platforms/gemini/thread';
import { chatgptPlatform } from '../../src/platforms/chatgpt/definition';
import { geminiPlatform } from '../../src/platforms/gemini/definition';

describe('resolveThreadId', () => {
  it('exports Gemini thread identity constants', () => {
    expect(PLACEHOLDER_GEMINI_THREAD_ID_VALUE).toBe('/app');
    expect(GEMINI_HOST_VALUE).toBe('gemini.google.com');
    expect(GEMINI_APP_PREFIX_VALUE).toBe('/app/');
  });

  it('uses URL pathname for Gemini thread identity', () => {
    expect(geminiPlatform.resolveThreadId('https://gemini.google.com/app/threads/123?hl=en')).toBe('/app/threads/123');
  });

  it('falls back to unknown for invalid urls', () => {
    expect(geminiPlatform.resolveThreadId('not-a-url')).toBe('unknown');
  });

  it('resolves concrete Gemini thread ids from full URLs', () => {
    expect(resolveConcreteGeminiThreadIdValue('https://gemini.google.com/app/abc123?hl=en')).toBe('/app/abc123');
    expect(resolveConcreteGeminiThreadIdValue('https://gemini.google.com/app/threads/abc123')).toBe('/app/threads/abc123');
  });

  it('does not resolve concrete thread ids for placeholder or non-Gemini URLs', () => {
    expect(resolveConcreteGeminiThreadIdValue('https://gemini.google.com/app')).toBeUndefined();
    expect(resolveConcreteGeminiThreadIdValue('https://example.com/app/abc123')).toBeUndefined();
    expect(resolveConcreteGeminiThreadIdValue('bad-url')).toBeUndefined();
  });

  it('classifies placeholder and concrete Gemini thread ids', () => {
    expect(isPlaceholderGeminiThreadIdValue('/app')).toBe(true);
    expect(isPlaceholderGeminiThreadIdValue('/app/abc123')).toBe(false);
    expect(isPlaceholderGeminiThreadIdValue('unknown')).toBe(false);

    expect(isConcreteGeminiThreadIdValue('/app/abc123')).toBe(true);
    expect(isConcreteGeminiThreadIdValue('/app/threads/abc123')).toBe(true);
    expect(isConcreteGeminiThreadIdValue('/app')).toBe(false);
    expect(isConcreteGeminiThreadIdValue('unknown')).toBe(false);
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
    expect(resolveConcreteChatGPTThreadId('https://chatgpt.com/c/abc123')).toBe('/c/abc123');
    expect(resolveConcreteChatGPTThreadId('https://chatgpt.com/c/abc123?model=gpt-5')).toBe('/c/abc123');
  });

  it('does not resolve concrete ChatGPT thread ids for placeholder or non-ChatGPT URLs', () => {
    expect(resolveConcreteChatGPTThreadId('https://chatgpt.com/')).toBeUndefined();
    expect(resolveConcreteChatGPTThreadId('https://example.com/c/abc123')).toBeUndefined();
    expect(resolveConcreteChatGPTThreadId('bad-url')).toBeUndefined();
  });

  it('classifies placeholder and concrete ChatGPT thread ids', () => {
    expect(isPlaceholderChatGPTThreadId('/')).toBe(true);
    expect(isPlaceholderChatGPTThreadId('/c/abc123')).toBe(false);
    expect(isPlaceholderChatGPTThreadId('unknown')).toBe(false);

    expect(isConcreteChatGPTThreadId('/c/abc123')).toBe(true);
    expect(isConcreteChatGPTThreadId('/')).toBe(false);
    expect(isConcreteChatGPTThreadId('unknown')).toBe(false);
  });
});
