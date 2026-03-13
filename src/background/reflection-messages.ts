import type { ReflectionStore } from '../shared/reflection-store';
import type { ReflectionRuntimeMessage } from '../shared/types';

interface RuntimeApi {
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
  runtime?: RuntimeApi;
}

function isReflectionRuntimeMessage(message: unknown): message is ReflectionRuntimeMessage {
  if (!message || typeof message !== 'object') return false;
  const maybe = message as { type?: string };
  return maybe.type === 'reflection:append' || maybe.type === 'reflection:thread-has-completed';
}

export function registerReflectionMessageHandlers(
  store: Pick<ReflectionStore, 'append' | 'hasCompletedReflectionForThread'>,
  chromeApi: ChromeApi = (globalThis as { chrome?: ChromeApi }).chrome || {}
): () => void {
  const runtimeMessageListener = (
    message: unknown,
    _sender: unknown,
    sendResponse: (response: unknown) => void
  ): boolean | void => {
    if (!isReflectionRuntimeMessage(message)) return undefined;

    switch (message.type) {
      case 'reflection:append':
        void store
          .append(message.record)
          .then(() => sendResponse({ ok: true }))
          .catch((error) => sendResponse({ error: String(error) }));
        return true;
      case 'reflection:thread-has-completed':
        void store
          .hasCompletedReflectionForThread(message.threadId)
          .then((hasCompletedReflection) => sendResponse({ hasCompletedReflection }))
          .catch((error) => sendResponse({ error: String(error) }));
        return true;
      default:
        return undefined;
    }
  };

  chromeApi.runtime?.onMessage.addListener(runtimeMessageListener);

  return () => {
    chromeApi.runtime?.onMessage.removeListener?.(runtimeMessageListener);
  };
}
