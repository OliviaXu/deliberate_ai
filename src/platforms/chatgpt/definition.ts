import type { PlatformDefinition } from '../types';
import {
  isConcretePathThreadId,
  isPlaceholderPathThreadId,
  resolveConcretePathThreadId,
  resolvePathThreadId
} from '../../shared/thread-path';
import {
  findChatGPTComposer,
  findChatGPTComposerAnchor,
  isChatGPTSendButton,
  readChatGPTPrompt,
  resolveChatGPTComposerNear
} from './composer';

export const PLACEHOLDER_CHATGPT_THREAD_ID = '/';
export const CHATGPT_HOST = 'chatgpt.com';
export const CHATGPT_THREAD_PREFIX = '/c/';

export const chatgptPlatform: PlatformDefinition = {
  id: 'chatgpt',
  hosts: [CHATGPT_HOST],
  matches: ['https://chatgpt.com/*'],
  resolveThreadId: (url) => resolvePathThreadId(url, 'unknown'),
  isPlaceholderThreadId: (threadId) => isPlaceholderPathThreadId(threadId, PLACEHOLDER_CHATGPT_THREAD_ID),
  isConcreteThreadId: (threadId) => isConcretePathThreadId(threadId, CHATGPT_THREAD_PREFIX),
  resolveConcreteThreadId: (url) =>
    resolveConcretePathThreadId(url, {
      host: CHATGPT_HOST,
      concretePrefix: CHATGPT_THREAD_PREFIX
    }),
  findComposer: findChatGPTComposer,
  resolveComposerNear: resolveChatGPTComposerNear,
  findComposerAnchor: findChatGPTComposerAnchor,
  isSendButton: isChatGPTSendButton,
  readPrompt: readChatGPTPrompt
};
