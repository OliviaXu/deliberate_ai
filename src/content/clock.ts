export function getContentNowMs(): number {
  const value = document.documentElement.getAttribute('data-deliberate-now-ms');
  if (!value) return Date.now();

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}
