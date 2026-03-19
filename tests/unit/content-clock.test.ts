import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContentClock } from '../../src/content/clock';

describe('createContentClock', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the background override loaded during init', async () => {
    const sendMessage = vi.fn(async () => ({ nowMs: 1_700_000_000_000 }));
    const clock = createContentClock({
      runtime: {
        sendMessage
      }
    });

    await clock.init();

    expect(sendMessage).toHaveBeenCalledWith({ type: 'deliberate:clock:get' });
    expect(clock.now()).toBe(1_700_000_000_000);
  });

  it('keeps the initial override value until the page is reinitialized', async () => {
    const clock = createContentClock({
      runtime: {
        sendMessage: vi.fn(async () => ({ nowMs: 55 }))
      }
    });

    await clock.init();
    expect(clock.now()).toBe(55);
  });

  it('falls back to Date.now when runtime access is unavailable or malformed', async () => {
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(1234);
    const clock = createContentClock({
      runtime: {
        sendMessage: vi.fn(async () => ({ nowMs: 'bad-value' }))
      }
    });

    await clock.init();

    expect(clock.now()).toBe(1234);
    dateNow.mockRestore();
  });

  it('keeps startup alive when the initial runtime lookup fails', async () => {
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(4321);
    const clock = createContentClock({
      runtime: {
        sendMessage: vi.fn(async () => {
          throw new Error('worker unavailable');
        })
      }
    });

    await expect(clock.init()).resolves.toBeUndefined();
    expect(clock.now()).toBe(4321);
    dateNow.mockRestore();
  });
});
