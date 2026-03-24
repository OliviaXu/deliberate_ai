import { describe, expect, it } from 'vitest';
import contentScript from '../../entrypoints/content';
import * as platforms from '../../src/platforms';
import { ACTIVE_PLATFORM_IDS, ACTIVE_PLATFORM_MATCH_PATTERNS, resolvePlatformFromUrl } from '../../src/platforms';
import { geminiPlatform } from '../../src/platforms/gemini/definition';

describe('platform registry', () => {
  it('keeps Gemini as the only active platform during phase 1', () => {
    expect(ACTIVE_PLATFORM_IDS).toEqual(['gemini']);
    expect(resolvePlatformFromUrl('https://gemini.google.com/app')).toBe(geminiPlatform);
  });

  it('does not expose getActivePlatforms from the registry module', () => {
    expect('getActivePlatforms' in platforms).toBe(false);
  });

  it('resolves Gemini URLs through the registry and ignores unsupported hosts', () => {
    expect(resolvePlatformFromUrl('https://gemini.google.com/app')).toBe(geminiPlatform);
    expect(resolvePlatformFromUrl('https://chatgpt.com/')).toBeNull();
    expect(resolvePlatformFromUrl('not-a-url')).toBeNull();
  });

  it('exposes placeholder-thread classification on the public platform contract', () => {
    expect(geminiPlatform.isPlaceholderThreadId('/app')).toBe(true);
    expect(geminiPlatform.isPlaceholderThreadId('/app/thread-a')).toBe(false);
  });

  it('drives content script matches from the active registry', () => {
    expect(contentScript.matches).toEqual(ACTIVE_PLATFORM_MATCH_PATTERNS);
  });
});
