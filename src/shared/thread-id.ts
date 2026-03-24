import { resolvePlatformFromUrl } from '../platforms';

export {
  GEMINI_APP_PREFIX,
  GEMINI_HOST,
  PLACEHOLDER_GEMINI_THREAD_ID,
  isConcreteGeminiThreadId,
  isPlaceholderGeminiThreadId,
  resolveConcreteGeminiThreadId
} from '../platforms/gemini/thread';

export function resolveThreadId(url: string): string {
  return resolvePlatformFromUrl(url)?.resolveThreadId(url) ?? 'unknown';
}
