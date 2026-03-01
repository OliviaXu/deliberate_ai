export function resolveThreadId(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname || 'unknown';
  } catch {
    return 'unknown';
  }
}
