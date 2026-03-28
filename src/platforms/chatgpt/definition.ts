import type { PlatformDefinition } from '../types';
import {
  findChatGPTComposer,
  findChatGPTComposerAnchor,
  isChatGPTSendButton,
  readChatGPTPrompt,
  resolveChatGPTComposerNear
} from './composer';
import {
  CHATGPT_HOST,
  isConcreteChatGPTThreadId,
  isPlaceholderChatGPTThreadId,
  resolveChatGPTThreadId,
  resolveConcreteChatGPTThreadId
} from './thread';

export const chatgptPlatform: PlatformDefinition = {
  id: 'chatgpt',
  hosts: [CHATGPT_HOST],
  matches: ['https://chatgpt.com/*'],
  resolveThreadId: resolveChatGPTThreadId,
  isPlaceholderThreadId: isPlaceholderChatGPTThreadId,
  isConcreteThreadId: isConcreteChatGPTThreadId,
  resolveConcreteThreadId: resolveConcreteChatGPTThreadId,
  findComposer: findChatGPTComposer,
  resolveComposerNear: resolveChatGPTComposerNear,
  findComposerAnchor: findChatGPTComposerAnchor,
  isSendButton: isChatGPTSendButton,
  readPrompt: readChatGPTPrompt
};
