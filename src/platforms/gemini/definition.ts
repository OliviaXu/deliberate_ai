import type { PlatformDefinition } from '../types';
import {
  findGeminiComposer,
  findGeminiComposerAnchor,
  isGeminiSendButton,
  readGeminiPrompt,
  resolveGeminiComposerNear
} from './composer';
import {
  GEMINI_HOST,
  isConcreteGeminiThreadId,
  isPlaceholderGeminiThreadId,
  resolveConcreteGeminiThreadId,
  resolveGeminiThreadId
} from './thread';

export const geminiPlatform: PlatformDefinition = {
  id: 'gemini',
  hosts: [GEMINI_HOST],
  matches: ['https://gemini.google.com/*'],
  resolveThreadId: resolveGeminiThreadId,
  isPlaceholderThreadId: isPlaceholderGeminiThreadId,
  isConcreteThreadId: isConcreteGeminiThreadId,
  resolveConcreteThreadId: resolveConcreteGeminiThreadId,
  findComposer: findGeminiComposer,
  resolveComposerNear: resolveGeminiComposerNear,
  findComposerAnchor: findGeminiComposerAnchor,
  isSendButton: isGeminiSendButton,
  readPrompt: readGeminiPrompt
};
