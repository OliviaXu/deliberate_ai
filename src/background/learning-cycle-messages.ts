import type { LearningCycleRuntimeMessage } from '../shared/types';
import type { LearningCycleStore } from '../shared/learning-cycle-store';

interface RuntimeApi {
  onMessage: {
    addListener(listener: (message: unknown) => unknown): void;
  };
}

interface ChromeApi {
  runtime?: RuntimeApi;
}

function isRuntimeMessage(message: unknown): message is LearningCycleRuntimeMessage {
  if (!message || typeof message !== 'object') return false;
  const maybe = message as { type?: string };
  return maybe.type === 'learning-cycle:append';
}

export function registerLearningCycleMessageHandlers(
  store: Pick<LearningCycleStore, 'append'>,
  chromeApi: ChromeApi = (globalThis as { chrome?: ChromeApi }).chrome || {}
): void {
  chromeApi.runtime?.onMessage.addListener(async (message: unknown) => {
    if (!isRuntimeMessage(message)) return undefined;
    await store.append(message.record);
    return { ok: true };
  });
}
