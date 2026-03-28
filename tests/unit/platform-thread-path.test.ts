import { describe, expect, it } from 'vitest';
import {
  isConcretePathThreadId,
  isPlaceholderPathThreadId,
  resolveConcretePathThreadId,
  resolvePathThreadId
} from '../../src/shared/thread-path';

describe('platform thread path helpers', () => {
  it('resolves URL pathnames and falls back when the URL is invalid', () => {
    expect(resolvePathThreadId('https://chatgpt.com/c/thread-1', '/')).toBe('/c/thread-1');
    expect(resolvePathThreadId('https://chatgpt.com', '/')).toBe('/');
    expect(resolvePathThreadId('not-a-url', 'unknown')).toBe('unknown');
  });

  it('classifies placeholder and concrete thread ids from provided rules', () => {
    expect(isPlaceholderPathThreadId('/', '/')).toBe(true);
    expect(isPlaceholderPathThreadId('/c/thread-1', '/')).toBe(false);

    expect(isConcretePathThreadId('/c/thread-1', '/c/')).toBe(true);
    expect(isConcretePathThreadId('/', '/c/')).toBe(false);
  });

  it('resolves concrete thread ids only when the host and prefix match', () => {
    expect(
      resolveConcretePathThreadId('https://chatgpt.com/c/thread-1?model=gpt-5', {
        host: 'chatgpt.com',
        concretePrefix: '/c/'
      })
    ).toBe('/c/thread-1');

    expect(
      resolveConcretePathThreadId('https://chatgpt.com/', {
        host: 'chatgpt.com',
        concretePrefix: '/c/'
      })
    ).toBeUndefined();

    expect(
      resolveConcretePathThreadId('https://example.com/c/thread-1', {
        host: 'chatgpt.com',
        concretePrefix: '/c/'
      })
    ).toBeUndefined();
  });
});
