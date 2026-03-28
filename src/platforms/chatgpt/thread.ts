export const PLACEHOLDER_CHATGPT_THREAD_ID = '/';
export const CHATGPT_HOST = 'chatgpt.com';
export const CHATGPT_THREAD_PREFIX = '/c/';

export function resolveChatGPTThreadId(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname || PLACEHOLDER_CHATGPT_THREAD_ID;
  } catch {
    return 'unknown';
  }
}

export function isPlaceholderChatGPTThreadId(threadId: string): boolean {
  return threadId === PLACEHOLDER_CHATGPT_THREAD_ID;
}

export function isConcreteChatGPTThreadId(threadId: string): boolean {
  return threadId.startsWith(CHATGPT_THREAD_PREFIX) && threadId.length > CHATGPT_THREAD_PREFIX.length;
}

export function resolveConcreteChatGPTThreadId(url: string | undefined): string | undefined {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    if (parsed.host !== CHATGPT_HOST) return undefined;
    return isConcreteChatGPTThreadId(parsed.pathname) ? parsed.pathname : undefined;
  } catch {
    return undefined;
  }
}
