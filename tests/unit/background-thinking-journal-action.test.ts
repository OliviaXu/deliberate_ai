import { describe, expect, it, vi } from 'vitest';
import { registerThinkingJournalActionHandler } from '../../src/background/thinking-journal-action';

describe('registerThinkingJournalActionHandler', () => {
  it('opens the thinking journal tab when the extension action is clicked', async () => {
    const addListener = vi.fn();
    const create = vi.fn(async () => ({}));
    const getURL = vi.fn((path: string) => `chrome-extension://test/${path}`);

    registerThinkingJournalActionHandler({
      action: { onClicked: { addListener } },
      tabs: { create },
      runtime: { getURL }
    });

    expect(addListener).toHaveBeenCalledOnce();
    const listener = addListener.mock.calls[0]?.[0] as (() => Promise<void>) | undefined;
    expect(listener).toBeTypeOf('function');

    await listener?.();

    expect(getURL).toHaveBeenCalledWith('thinking-journal.html');
    expect(create).toHaveBeenCalledWith({ url: 'chrome-extension://test/thinking-journal.html' });
  });
});
