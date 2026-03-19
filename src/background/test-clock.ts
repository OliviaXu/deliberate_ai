import {
  TEST_CLOCK_GET_MESSAGE_TYPE,
  TEST_CLOCK_GLOBAL_KEY,
  type TestClockControl,
  type TestClockGetMessage
} from '../shared/test-clock';

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

function isTestClockGetMessage(message: unknown): message is TestClockGetMessage {
  if (!message || typeof message !== 'object') return false;
  return (message as { type?: unknown }).type === TEST_CLOCK_GET_MESSAGE_TYPE;
}

export function createBackgroundTestClockController(
  chromeApi: ChromeApi = (globalThis as { chrome?: ChromeApi }).chrome || {},
  globalScope: Record<string, unknown> = globalThis as Record<string, unknown>
): TestClockControl & { dispose(): void } {
  let nowMs: number | null = null;

  const runtimeListener = (message: unknown, sender: unknown, sendResponse: (response: unknown) => void): void => {
    if (!isTestClockGetMessage(message)) return;

    sendResponse({ nowMs });
  };

  chromeApi.runtime?.onMessage.addListener(runtimeListener);

  const controller: TestClockControl & { dispose(): void } = {
    async setNowMs(nextNowMs: number | null): Promise<void> {
      nowMs = Number.isFinite(nextNowMs) ? nextNowMs : null;
    },
    dispose(): void {
      chromeApi.runtime?.onMessage.removeListener?.(runtimeListener);
    }
  };

  globalScope[TEST_CLOCK_GLOBAL_KEY] = controller as TestClockControl;
  return controller;
}
