import { describe, expect, it, vi } from 'vitest';
import { registerResurfacingMessageHandlers } from '../../src/background/resurfacing-messages';
import type { ResurfacingCandidate } from '../../src/shared/types';

function setup(serviceResult: ResurfacingCandidate | null = null) {
  const addListener = vi.fn();
  const create = vi.fn(async () => ({}));
  const getURL = vi.fn((path: string) => `chrome-extension://test/${path}`);
  const presentNext = vi.fn(async () => serviceResult);

  registerResurfacingMessageHandlers(
    { presentNext },
    {
      runtime: { onMessage: { addListener }, getURL },
      tabs: { create }
    }
  );

  const listener = addListener.mock.calls[0]?.[0];
  if (!listener) throw new Error('Expected listener');
  return { listener, presentNext, create, getURL };
}

describe('registerResurfacingMessageHandlers', () => {
  it('returns the next presented candidate', async () => {
    const candidate = { learningCycleRecordId: 'record-1', excerpt: 'A past thought' };
    const { listener, presentNext } = setup(candidate);

    await expect(
      new Promise((resolve) => listener({ type: 'resurfacing:present-next' }, {}, resolve))
    ).resolves.toEqual({ candidate });
    expect(presentNext).toHaveBeenCalledOnce();
  });

  it('opens the selected journal entry in a new tab with an encoded id', async () => {
    const { listener, create, getURL } = setup();

    await expect(
      new Promise((resolve) =>
        listener({ type: 'resurfacing:open-journal', learningCycleRecordId: 'record / one' }, {}, resolve)
      )
    ).resolves.toEqual({ ok: true });

    expect(getURL).toHaveBeenCalledWith('thinking-journal.html?featured=record%20%2F%20one');
    expect(create).toHaveBeenCalledWith({ url: 'chrome-extension://test/thinking-journal.html?featured=record%20%2F%20one' });
  });

  it('ignores unrelated runtime messages', () => {
    const { listener } = setup();
    expect(listener({ type: 'learning-cycle:append' }, {}, vi.fn())).toBeUndefined();
  });
});
