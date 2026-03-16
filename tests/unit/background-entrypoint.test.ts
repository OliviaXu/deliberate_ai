import { beforeEach, describe, expect, it, vi } from 'vitest';

const defineBackground = vi.fn((callback: () => void) => {
  callback();
  return callback;
});
const registerLearningCycleMessageHandlers = vi.fn();
const registerReflectionMessageHandlers = vi.fn();
const registerThinkingJournalActionHandler = vi.fn();

const learningCycleStoreInstance = {
  append: vi.fn(),
  resolveThreadIdForRecord: vi.fn(),
  getLatestForThread: vi.fn()
};
const reflectionStoreInstance = {
  append: vi.fn(),
  hasCompletedReflectionForRecord: vi.fn()
};

const LearningCycleStore = vi.fn(() => learningCycleStoreInstance);
const ReflectionStore = vi.fn(() => reflectionStoreInstance);

vi.mock('wxt/utils/define-background', () => ({
  defineBackground
}));

vi.mock('../../src/background/learning-cycle-messages', () => ({
  registerLearningCycleMessageHandlers
}));

vi.mock('../../src/background/reflection-messages', () => ({
  registerReflectionMessageHandlers
}));

vi.mock('../../src/background/thinking-journal-action', () => ({
  registerThinkingJournalActionHandler
}));

vi.mock('../../src/shared/learning-cycle-store', () => ({
  LearningCycleStore
}));

vi.mock('../../src/shared/reflection-store', () => ({
  ReflectionStore
}));

describe('background entrypoint', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('passes the store instances directly into the background message handlers', async () => {
    await import('../../entrypoints/background');

    expect(defineBackground).toHaveBeenCalledOnce();
    expect(LearningCycleStore).toHaveBeenCalledOnce();
    expect(ReflectionStore).toHaveBeenCalledOnce();
    expect(registerLearningCycleMessageHandlers).toHaveBeenCalledWith(learningCycleStoreInstance);
    expect(registerReflectionMessageHandlers).toHaveBeenCalledWith(reflectionStoreInstance);
    expect(registerThinkingJournalActionHandler).toHaveBeenCalledOnce();
  });
});
