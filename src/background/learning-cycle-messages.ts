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
  return maybe.type === 'learning-cycle:append' || maybe.type === 'learning-cycle:list';
}

export function registerLearningCycleMessageHandlers(
  store: Pick<LearningCycleStore, 'append' | 'list'>,
  chromeApi: ChromeApi = (globalThis as { chrome?: ChromeApi }).chrome || {}
): void {
  chromeApi.runtime?.onMessage.addListener(async (message: unknown) => {
    if (!isRuntimeMessage(message)) return undefined;

    if (message.type === 'learning-cycle:append') {
      await store.append(message.record);
      return { ok: true };
    }

    return {
      ok: true,
      records: await store.list()
    };
  });
}
