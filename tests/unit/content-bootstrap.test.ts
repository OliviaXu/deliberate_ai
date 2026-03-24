import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlatformDefinition } from '../../src/platforms';

const startContentApp = vi.fn();
const resolvePlatformFromUrl = vi.fn();

vi.mock('../../src/content/app', () => ({
  startContentApp
}));

vi.mock('../../src/platforms', () => ({
  resolvePlatformFromUrl
}));

function createPlatformStub(): PlatformDefinition {
  return {
    id: 'gemini',
    hosts: ['gemini.google.com'],
    matches: ['https://gemini.google.com/*'],
    resolveThreadId: () => '/app/threads/stub',
    isPlaceholderThreadId: () => false,
    isConcreteThreadId: () => true,
    resolveConcreteThreadId: () => '/app/threads/stub',
    findComposer: () => null,
    resolveComposerNear: () => null,
    findComposerAnchor: () => null,
    isSendButton: () => false,
    readPrompt: () => ''
  };
}

describe('bootContentApp', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('resolves the current platform through the registry before starting the content app', async () => {
    const platform = createPlatformStub();
    resolvePlatformFromUrl.mockReturnValue(platform);

    const { bootContentApp } = await import('../../src/content/bootstrap');
    bootContentApp({ now: Date.now });

    expect(resolvePlatformFromUrl).toHaveBeenCalledWith(window.location.href);
    expect(startContentApp).toHaveBeenCalledWith({ now: Date.now, platform });
  });

  it('does not start the content app when the registry has no platform for the current URL', async () => {
    resolvePlatformFromUrl.mockReturnValue(null);

    const { bootContentApp } = await import('../../src/content/bootstrap');
    bootContentApp({ now: Date.now });

    expect(resolvePlatformFromUrl).toHaveBeenCalledWith(window.location.href);
    expect(startContentApp).not.toHaveBeenCalled();
  });

  it('uses an explicitly provided platform instead of resolving from the current URL', async () => {
    const platform = createPlatformStub();
    resolvePlatformFromUrl.mockReturnValue(null);

    const { bootContentApp } = await import('../../src/content/bootstrap');
    bootContentApp({ now: Date.now, platform });

    expect(resolvePlatformFromUrl).not.toHaveBeenCalled();
    expect(startContentApp).toHaveBeenCalledWith({ now: Date.now, platform });
  });
});
