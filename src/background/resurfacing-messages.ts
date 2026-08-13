import type { ResurfacingService } from './resurfacing-service';
import type { ResurfacingPresentNextResponse, ResurfacingRuntimeMessage } from '../shared/types';

interface RuntimeApi {
  getURL(path: string): string;
  onMessage: {
    addListener(
      listener: (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean | void
    ): void;
    removeListener?(
      listener: (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean | void
    ): void;
  };
}

interface ChromeApi {
  runtime: RuntimeApi;
  tabs: {
    create(details: { url: string }): Promise<unknown> | unknown;
  };
}

function isResurfacingMessage(message: unknown): message is ResurfacingRuntimeMessage {
  if (!message || typeof message !== 'object') return false;
  const type = (message as { type?: unknown }).type;
  return type === 'resurfacing:present-next' || type === 'resurfacing:open-journal';
}

export function registerResurfacingMessageHandlers(
  service: Pick<ResurfacingService, 'presentNext'>,
  chromeApi: ChromeApi = (globalThis as unknown as { chrome: ChromeApi }).chrome
): () => void {
  const listener = (
    message: unknown,
    _sender: unknown,
    sendResponse: (response: unknown) => void
  ): boolean | void => {
    if (!isResurfacingMessage(message)) return undefined;

    if (message.type === 'resurfacing:present-next') {
      void service
        .presentNext()
        .then((candidate) => {
          const response: ResurfacingPresentNextResponse = { candidate };
          sendResponse(response);
        })
        .catch((error) => sendResponse({ error: String(error) }));
      return true;
    }

    const path = `thinking-journal.html?featured=${encodeURIComponent(message.learningCycleRecordId)}`;
    const url = chromeApi.runtime.getURL(path);
    void Promise.resolve(chromeApi.tabs.create({ url }))
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ error: String(error) }));
    return true;
  };

  chromeApi.runtime.onMessage.addListener(listener);
  return () => chromeApi.runtime.onMessage.removeListener?.(listener);
}
