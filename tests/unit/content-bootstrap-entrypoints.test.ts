import { beforeEach, describe, expect, it, vi } from 'vitest';
import { geminiPlatform } from '../../src/platforms/gemini/definition';

const bootContentApp = vi.fn();
const readHarnessNowMs = vi.fn(() => 1234);

vi.mock('../../src/content/bootstrap', () => ({
  bootContentApp
}));

vi.mock('../../src/content/harness-clock', () => ({
  readHarnessNowMs
}));

describe('content bootstrap entry modules', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('boots the production content app through the shared bootstrap', async () => {
    await import('../../src/content/index');

    expect(bootContentApp).toHaveBeenCalledOnce();
    expect(bootContentApp).toHaveBeenCalledWith({ now: Date.now });
  });

  it('boots the harness content app through the shared bootstrap', async () => {
    await import('../../src/content/harness');

    expect(bootContentApp).toHaveBeenCalledOnce();
    expect(bootContentApp).toHaveBeenCalledWith({
      now: readHarnessNowMs,
      platform: expect.objectContaining({ id: geminiPlatform.id })
    });
  });
});
