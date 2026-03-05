import { isConcreteGeminiThreadId } from '../shared/thread-id';

export function isThreadIdCacheable(threadId: string): boolean {
  return isConcreteGeminiThreadId(threadId);
}

export function shouldCheckPersistentThreadEntries(threadId: string): boolean {
  return isThreadIdCacheable(threadId);
}
