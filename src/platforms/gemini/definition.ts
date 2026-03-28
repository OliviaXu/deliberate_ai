import type { PlatformDefinition } from '../types';
import {
  isConcretePathThreadId,
  isPlaceholderPathThreadId,
  resolveConcretePathThreadId,
  resolvePathThreadId
} from '../../shared/thread-path';
import {
  findGeminiComposer,
  findGeminiComposerAnchor,
  isGeminiSendButton,
  readGeminiPrompt,
  resolveGeminiComposerNear
} from './composer';

export const PLACEHOLDER_GEMINI_THREAD_ID = '/app';
export const GEMINI_HOST = 'gemini.google.com';
export const GEMINI_APP_PREFIX = '/app/';

export const geminiPlatform: PlatformDefinition = {
  id: 'gemini',
  hosts: [GEMINI_HOST],
  matches: ['https://gemini.google.com/*'],
  resolveThreadId: (url) => resolvePathThreadId(url, 'unknown'),
  isPlaceholderThreadId: (threadId) => isPlaceholderPathThreadId(threadId, PLACEHOLDER_GEMINI_THREAD_ID),
  isConcreteThreadId: (threadId) => isConcretePathThreadId(threadId, GEMINI_APP_PREFIX),
  resolveConcreteThreadId: (url) =>
    resolveConcretePathThreadId(url, {
      host: GEMINI_HOST,
      concretePrefix: GEMINI_APP_PREFIX
    }),
  findComposer: findGeminiComposer,
  resolveComposerNear: resolveGeminiComposerNear,
  findComposerAnchor: findGeminiComposerAnchor,
  isSendButton: isGeminiSendButton,
  readPrompt: readGeminiPrompt
};
