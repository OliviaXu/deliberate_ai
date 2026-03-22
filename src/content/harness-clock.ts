export const HARNESS_NOW_ATTRIBUTE = 'data-deliberate-now-ms';

export function readHarnessNowMs(): number {
  const value = document.documentElement.getAttribute(HARNESS_NOW_ATTRIBUTE);
  if (value === null) {
    return Date.now();
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}
