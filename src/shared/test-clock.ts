export const TEST_CLOCK_GET_MESSAGE_TYPE = 'deliberate:clock:get';
export const TEST_CLOCK_GLOBAL_KEY = '__deliberateTestClock';

export interface TestClockGetResponse {
  nowMs: number | null;
}

export interface TestClockGetMessage {
  type: typeof TEST_CLOCK_GET_MESSAGE_TYPE;
}

export interface TestClockControl {
  setNowMs(nowMs: number | null): Promise<void>;
}
