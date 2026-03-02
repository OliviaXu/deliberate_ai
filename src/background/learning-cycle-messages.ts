import type { LearningCycleStore } from '../shared/learning-cycle-store';
import type { LearningCycleRuntimeMessage } from '../shared/types';

interface RuntimeApi {
  onMessage: {
    addListener(listener: (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean | void): void;
  };
}

interface ChromeApi {
  runtime?: RuntimeApi;
}

function isRuntimeMessage(message: unknown): message is LearningCycleRuntimeMessage {
  if (!message || typeof message !== 'object') return false;
  const maybe = message as { type?: string };
  return maybe.type === 'learning-cycle:append' || maybe.type === 'learning-cycle:thread-has-entry';
}

export function registerLearningCycleMessageHandlers(
  store: Pick<LearningCycleStore, 'append' | 'hasAnyForThread'>,
  chromeApi: ChromeApi = (globalThis as { chrome?: ChromeApi }).chrome || {}
): void {
  chromeApi.runtime?.onMessage.addListener((message: unknown, _sender: unknown, sendResponse: (response: unknown) => void) => {
    if (!isRuntimeMessage(message)) return undefined;

    if (message.type === 'learning-cycle:thread-has-entry') {
      void store
        .hasAnyForThread(message.threadId)
        .then((hasEntry) => sendResponse({ hasEntry }))
        .catch((error) => sendResponse({ error: String(error) }));
      return true;
    }

    void store
      .append(message.record)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ error: String(error) }));
    return true;
  });
}
