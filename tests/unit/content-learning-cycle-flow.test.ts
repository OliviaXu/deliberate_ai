import { describe, expect, it, vi } from 'vitest';
import type { InterceptedSubmitIntent, LearningCycleSubmission } from '../../src/shared/types';
import { handleModeSubmission } from '../../src/content/learning-cycle-flow';

const baseIntent: InterceptedSubmitIntent = {
  source: 'enter_key',
  timestamp: 1730000000000,
  url: 'https://gemini.google.com/app/threads/123',
  platform: 'gemini',
  prompt: 'What is the best rollout sequence?'
};

describe('handleModeSubmission', () => {
  it('replays first, then appends, and reports success', async () => {
    const sendMessage = vi.fn<(message: unknown) => Promise<{ ok: true }>>(async () => ({ ok: true }));
    const resume = vi.fn(() => true);
    const info = vi.fn();
    const error = vi.fn();
    const submission: LearningCycleSubmission = { mode: 'delegation' };

    const result = await handleModeSubmission({
      intent: baseIntent,
      submission,
      sendMessage,
      resume,
      logger: { info, error }
    });

    expect(resume).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledOnce();

    const resumeCall = resume.mock.invocationCallOrder[0];
    const sendCall = sendMessage.mock.invocationCallOrder[0];
    expect(typeof resumeCall).toBe('number');
    expect(typeof sendCall).toBe('number');
    expect(resumeCall!).toBeLessThan(sendCall!);

    expect(result.replayAttempted).toBe(true);
    expect(result.appendSucceeded).toBe(true);
    expect(error).not.toHaveBeenCalled();
  });

  it('does not append when replay fails', async () => {
    const sendMessage = vi.fn<(message: unknown) => Promise<{ ok: true }>>(async () => ({ ok: true }));
    const resume = vi.fn(() => false);

    const result = await handleModeSubmission({
      intent: baseIntent,
      submission: { mode: 'delegation' },
      sendMessage,
      resume,
      logger: { info: vi.fn(), error: vi.fn() }
    });

    expect(result.replayAttempted).toBe(false);
    expect(result.appendSucceeded).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('includes problem-solving prediction in append payload', async () => {
    const sendMessage = vi.fn<(message: unknown) => Promise<{ ok: true }>>(async () => ({ ok: true }));
    const resume = vi.fn(() => true);
    const randomUuid = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000000');

    await handleModeSubmission({
      intent: baseIntent,
      submission: { mode: 'problem_solving', prediction: 'x'.repeat(100) },
      sendMessage,
      resume,
      logger: { info: vi.fn(), error: vi.fn() }
    });

    const payload = sendMessage.mock.calls[0]?.[0];
    expect(payload).toBeDefined();
    expect(payload).toMatchObject({
      type: 'learning-cycle:append',
      record: {
        id: '00000000-0000-4000-8000-000000000000',
        mode: 'problem_solving',
        prediction: 'x'.repeat(100),
        prompt: 'What is the best rollout sequence?',
        threadId: '/app/threads/123'
      }
    });
    expect(randomUuid).toHaveBeenCalledOnce();
  });

  it('resolves thread ids from the active platform instead of URL host matching', async () => {
    const sendMessage = vi.fn<(message: unknown) => Promise<{ ok: true }>>(async () => ({ ok: true }));
    const resume = vi.fn(() => true);
    const randomUuid = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111');

    await handleModeSubmission({
      intent: {
        ...baseIntent,
        url: 'https://deliberate-harness.test/app/threads/test-thread'
      },
      submission: { mode: 'delegation' },
      sendMessage,
      resume,
      logger: { info: vi.fn(), error: vi.fn() }
    });

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'learning-cycle:append',
      record: expect.objectContaining({
        id: '11111111-1111-4111-8111-111111111111',
        threadId: '/app/threads/test-thread'
      })
    });
    expect(randomUuid).toHaveBeenCalledOnce();
  });

  it('reports append failure when runtime response is not ok', async () => {
    const result = await handleModeSubmission({
      intent: baseIntent,
      submission: { mode: 'delegation' },
      sendMessage: vi.fn<(message: unknown) => Promise<{ nope: true }>>(async () => ({ nope: true })),
      resume: vi.fn(() => true),
      logger: { info: vi.fn(), error: vi.fn() }
    });

    expect(result.replayAttempted).toBe(true);
    expect(result.appendSucceeded).toBe(false);
  });
});
