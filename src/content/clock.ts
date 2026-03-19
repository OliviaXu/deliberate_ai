import {
  TEST_CLOCK_GET_MESSAGE_TYPE,
  type TestClockGetMessage,
  type TestClockGetResponse
} from '../shared/test-clock';

interface RuntimeApi {
  sendMessage?: (payload: unknown) => Promise<unknown> | unknown;
}

interface ChromeApi {
  runtime?: RuntimeApi;
}

function normalizeNowMs(value: unknown): number | null {
  return Number.isFinite(value) ? (value as number) : null;
}

export function createContentClock(chromeApi: ChromeApi = (globalThis as { chrome?: ChromeApi }).chrome || {}) {
  let overrideNowMs: number | null = null;

  return {
    async init(): Promise<void> {
      const runtimeApi = chromeApi.runtime;

      const send = runtimeApi?.sendMessage;
      if (!send) return;

      const response = await Promise.resolve(
        send({
          type: TEST_CLOCK_GET_MESSAGE_TYPE
        } satisfies TestClockGetMessage)
      ).catch(() => undefined);

      const maybeResponse = response && typeof response === 'object' ? (response as TestClockGetResponse) : undefined;
      overrideNowMs = normalizeNowMs(maybeResponse?.nowMs);
    },
    now(): number {
      return overrideNowMs ?? Date.now();
    }
  };
}

const defaultClock = createContentClock();

export async function initializeContentClock(): Promise<void> {
  await defaultClock.init();
}

export function getContentNowMs(): number {
  return defaultClock.now();
}
