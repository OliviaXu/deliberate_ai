import { describe, expect, it } from 'vitest';
import contentScript from '../../entrypoints/content';
import * as platforms from '../../src/platforms';
import { ACTIVE_PLATFORM_IDS, ACTIVE_PLATFORM_MATCH_PATTERNS, resolvePlatformFromUrl } from '../../src/platforms';
import { chatgptPlatform } from '../../src/platforms/chatgpt/definition';
import { geminiPlatform } from '../../src/platforms/gemini/definition';

describe('platform registry', () => {
  it('keeps Gemini and ChatGPT registered as active platforms for the shared seam', () => {
    expect(ACTIVE_PLATFORM_IDS).toEqual(['gemini', 'chatgpt']);
    expect(resolvePlatformFromUrl('https://gemini.google.com/app')).toBe(geminiPlatform);
    expect(resolvePlatformFromUrl('https://chatgpt.com/')).toBe(chatgptPlatform);
  });

  it('does not expose getActivePlatforms from the registry module', () => {
    expect('getActivePlatforms' in platforms).toBe(false);
  });

  it('resolves supported URLs through the registry and ignores unsupported hosts', () => {
    expect(resolvePlatformFromUrl('https://gemini.google.com/app')).toBe(geminiPlatform);
    expect(resolvePlatformFromUrl('https://chatgpt.com/')).toBe(chatgptPlatform);
    expect(resolvePlatformFromUrl('not-a-url')).toBeNull();
  });

  it('exposes placeholder-thread classification on the public platform contract', () => {
    expect(geminiPlatform.isPlaceholderThreadId('/app')).toBe(true);
    expect(geminiPlatform.isPlaceholderThreadId('/app/thread-a')).toBe(false);
  });

  it('drives content script matches from the active registry', () => {
    expect(contentScript.matches).toEqual(ACTIVE_PLATFORM_MATCH_PATTERNS);
    expect(ACTIVE_PLATFORM_MATCH_PATTERNS).toContain('https://chatgpt.com/*');
  });
});
