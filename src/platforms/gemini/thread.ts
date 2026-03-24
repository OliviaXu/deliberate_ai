export const PLACEHOLDER_GEMINI_THREAD_ID = '/app';
export const GEMINI_HOST = 'gemini.google.com';
export const GEMINI_APP_PREFIX = '/app/';

export function resolveGeminiThreadId(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function isPlaceholderGeminiThreadId(threadId: string): boolean {
  return threadId === PLACEHOLDER_GEMINI_THREAD_ID;
}

export function isConcreteGeminiThreadId(threadId: string): boolean {
  return threadId.startsWith(GEMINI_APP_PREFIX) && threadId.length > GEMINI_APP_PREFIX.length;
}

export function resolveConcreteGeminiThreadId(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.host !== GEMINI_HOST) return undefined;
    return isConcreteGeminiThreadId(parsed.pathname) ? parsed.pathname : undefined;
  } catch {
    return undefined;
  }
}
