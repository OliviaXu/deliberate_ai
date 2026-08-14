import { describe, expect, it, vi } from 'vitest';
import { registerResurfacingMessageHandlers } from '../../src/background/resurfacing-messages';
import type { ResurfacingCandidate } from '../../src/shared/types';

function setup(serviceResult: ResurfacingCandidate | null = null) {
  const addListener = vi.fn();
  const create = vi.fn(async () => ({}));
  const getURL = vi.fn((path: string) => `chrome-extension://test/${path}`);
  const presentNext = vi.fn(async () => serviceResult);
  const setSuppressed = vi.fn(async () => undefined);

  registerResurfacingMessageHandlers(
    { presentNext, setSuppressed },
    {
      runtime: { onMessage: { addListener }, getURL },
      tabs: { create }
    }
  );

  const listener = addListener.mock.calls[0]?.[0];
  if (!listener) throw new Error('Expected listener');
  return { listener, presentNext, setSuppressed, create, getURL };
}

describe('registerResurfacingMessageHandlers', () => {
  it('returns the next presented candidate', async () => {
    const candidate = { learningCycleId: 'record-1', excerpt: 'A past thought' };
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
        listener({ type: 'resurfacing:open-journal', learningCycleId: 'record / one' }, {}, resolve)
      )
    ).resolves.toEqual({ ok: true });

    expect(getURL).toHaveBeenCalledWith('thinking-journal.html?featured=record%20%2F%20one');
    expect(create).toHaveBeenCalledWith({ url: 'chrome-extension://test/thinking-journal.html?featured=record%20%2F%20one' });
  });

  it('ignores unrelated runtime messages', () => {
    const { listener } = setup();
    expect(listener({ type: 'learning-cycle:append' }, {}, vi.fn())).toBeUndefined();
  });

  it('reports successful suppression persistence', async () => {
    const { listener, setSuppressed } = setup();
    const sendResponse = vi.fn();

    expect(listener({
      type: 'resurfacing:set-suppressed',
      learningCycleId: 'record-1',
      suppressed: true
    }, {}, sendResponse)).toBe(true);

    await vi.waitFor(() => expect(setSuppressed).toHaveBeenCalledWith('record-1', true));
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });

  it('reports suppression persistence failures', async () => {
    const { listener, setSuppressed } = setup();
    const error = new Error('storage failed');
    setSuppressed.mockRejectedValueOnce(error);

    await expect(new Promise((resolve) => listener({
      type: 'resurfacing:set-suppressed',
      learningCycleId: 'record-1',
      suppressed: true
    }, {}, resolve))).resolves.toEqual({ error: String(error) });
  });

  it('ignores malformed suppression requests', () => {
    const { listener, setSuppressed } = setup();
    expect(listener({ type: 'resurfacing:set-suppressed', learningCycleId: '', suppressed: 'yes' }, {}, vi.fn())).toBeUndefined();
    expect(setSuppressed).not.toHaveBeenCalled();
  });
});
