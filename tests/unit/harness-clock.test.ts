import { afterEach, describe, expect, it, vi } from 'vitest';
import { HARNESS_NOW_ATTRIBUTE, readHarnessNowMs } from '../../src/content/harness-clock';

describe('readHarnessNowMs', () => {
  afterEach(() => {
    document.documentElement.removeAttribute(HARNESS_NOW_ATTRIBUTE);
    vi.restoreAllMocks();
  });

  it('reads a numeric harness override from the document root', () => {
    document.documentElement.setAttribute(HARNESS_NOW_ATTRIBUTE, '1700000000000');

    expect(readHarnessNowMs()).toBe(1_700_000_000_000);
  });

  it('falls back to Date.now when the harness override is missing', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);

    expect(readHarnessNowMs()).toBe(1234);
  });

  it('falls back to Date.now when the harness override is invalid', () => {
    document.documentElement.setAttribute(HARNESS_NOW_ATTRIBUTE, 'not-a-number');
    vi.spyOn(Date, 'now').mockReturnValue(4321);

    expect(readHarnessNowMs()).toBe(4321);
  });
});
