import { describe, expect, it, vi } from 'vitest';
import type { InterceptedSubmitIntent, LearningCycleSubmission } from '../../src/shared/types';
import { handleModeSubmission } from '../../src/content/learning-cycle-flow';

const baseIntent: InterceptedSubmitIntent = {
  source: 'enter_key',
  timestamp: 1730000000000,
  url: 'https://gemini.google.com/app/threads/123',
  platform: 'gemini',
  interceptionId: 10,
  prompt: 'What is the best rollout sequence?'
};

describe('handleModeSubmission', () => {
  it('dispatches storage append without blocking replay', async () => {
    let resolveMessage: (() => void) | undefined;
    const sendMessage = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveMessage = resolve;
        })
    );
    const resume = vi.fn(() => true);
    const info = vi.fn();
    const error = vi.fn();
    const submission: LearningCycleSubmission = { mode: 'delegation' };

    const result = handleModeSubmission({
      intent: baseIntent,
      submission,
      sendMessage,
      resume,
      logger: { info, error }
    });

    expect(sendMessage).toHaveBeenCalledOnce();
    expect(resume).toHaveBeenCalledOnce();
    expect(result.replayAttempted).toBe(true);

    resolveMessage?.();
    await Promise.resolve();
    expect(error).not.toHaveBeenCalled();
  });

  it('includes problem-solving prediction in stored record payload', () => {
    const sendMessage = vi.fn<(message: unknown) => Promise<void>>(async () => undefined);
    const resume = vi.fn(() => true);

    handleModeSubmission({
      intent: baseIntent,
      submission: { mode: 'problem_solving', prediction: 'x'.repeat(100) },
      sendMessage,
      resume,
      logger: { info: vi.fn(), error: vi.fn() }
    });

    const payload = sendMessage.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      type: 'learning-cycle:append',
      record: {
        mode: 'problem_solving',
        prediction: 'x'.repeat(100),
        prompt: 'What is the best rollout sequence?',
        threadId: '/app/threads/123'
      }
    });
  });
});
