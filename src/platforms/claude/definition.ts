import type { PlatformDefinition } from '../types';
import {
  isConcretePathThreadId,
  isPlaceholderPathThreadId,
  resolveConcretePathThreadId,
  resolvePathThreadId
} from '../../shared/thread-path';
import {
  findClaudeComposer,
  findClaudeComposerAnchor,
  isClaudeSendButton,
  readClaudePrompt,
  resolveClaudeComposerNear
} from './composer';

export const PLACEHOLDER_CLAUDE_THREAD_ID = '/new';
export const CLAUDE_HOST = 'claude.ai';
export const CLAUDE_THREAD_PREFIX = '/chat/';

export const claudePlatform: PlatformDefinition = {
  id: 'claude',
  hosts: [CLAUDE_HOST],
  matches: ['https://claude.ai/*'],
  resolveThreadId: (url) => resolvePathThreadId(url, 'unknown'),
  isPlaceholderThreadId: (threadId) => isPlaceholderPathThreadId(threadId, PLACEHOLDER_CLAUDE_THREAD_ID),
  isConcreteThreadId: (threadId) => isConcretePathThreadId(threadId, CLAUDE_THREAD_PREFIX),
  resolveConcreteThreadId: (url) =>
    resolveConcretePathThreadId(url, {
      host: CLAUDE_HOST,
      concretePrefix: CLAUDE_THREAD_PREFIX
    }),
  findComposer: findClaudeComposer,
  resolveComposerNear: resolveClaudeComposerNear,
  findComposerAnchor: findClaudeComposerAnchor,
  isSendButton: isClaudeSendButton,
  readPrompt: readClaudePrompt
};
