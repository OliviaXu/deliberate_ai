import type { PlatformDefinition } from './types';
import type { PlatformId } from '../shared/platform-id';
import { claudePlatform } from './claude/definition';
import { chatgptPlatform } from './chatgpt/definition';
import { geminiPlatform } from './gemini/definition';

const ACTIVE_PLATFORMS = [geminiPlatform, chatgptPlatform, claudePlatform] as const satisfies readonly PlatformDefinition[];

export const ACTIVE_PLATFORM_IDS = ACTIVE_PLATFORMS.map((platform) => platform.id);
export const ACTIVE_PLATFORM_MATCH_PATTERNS = ACTIVE_PLATFORMS.flatMap((platform) => [...platform.matches]);

export function resolvePlatformById(platformId: PlatformId): PlatformDefinition | null {
  return ACTIVE_PLATFORMS.find((platform) => platform.id === platformId) ?? null;
}

export function resolvePlatformFromUrl(url: string): PlatformDefinition | null {
  try {
    const { host } = new URL(url);
    return ACTIVE_PLATFORMS.find((platform) => platform.hosts.includes(host)) ?? null;
  } catch {
    return null;
  }
}

export { geminiPlatform };
export { chatgptPlatform };
export { claudePlatform };
export type { PlatformDefinition } from './types';
