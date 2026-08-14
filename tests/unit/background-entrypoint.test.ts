import { beforeEach, describe, expect, it, vi } from 'vitest';

const defineBackground = vi.fn((callback: () => void) => {
  callback();
  return callback;
});
const registerLearningCycleMessageHandlers = vi.fn();
const registerReflectionMessageHandlers = vi.fn();
const registerResurfacingMessageHandlers = vi.fn();
const registerThinkingJournalActionHandler = vi.fn();
const migrateLocalStorageToV2 = vi.fn<() => Promise<void>>(async () => undefined);

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
const resurfacingServiceInstance = { presentNext: vi.fn() };
const ResurfacingService = vi.fn(() => resurfacingServiceInstance);

vi.mock('wxt/utils/define-background', () => ({
  defineBackground
}));

vi.mock('../../src/background/learning-cycle-messages', () => ({
  registerLearningCycleMessageHandlers
}));

vi.mock('../../src/background/reflection-messages', () => ({
  registerReflectionMessageHandlers
}));

vi.mock('../../src/background/resurfacing-messages', () => ({
  registerResurfacingMessageHandlers
}));

vi.mock('../../src/background/resurfacing-service', () => ({
  ResurfacingService
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

vi.mock('../../src/shared/schema-migration-v2', () => ({
  migrateLocalStorageToV2
}));

describe('background entrypoint', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('finishes migration before constructing stores and registering handlers', async () => {
    let finishMigration!: () => void;
    migrateLocalStorageToV2.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishMigration = resolve;
    }));
    await import('../../entrypoints/background');

    expect(defineBackground).toHaveBeenCalledOnce();
    expect(migrateLocalStorageToV2).toHaveBeenCalledOnce();
    expect(LearningCycleStore).not.toHaveBeenCalled();

    finishMigration();
    await vi.waitFor(() => expect(LearningCycleStore).toHaveBeenCalledOnce());
    expect(LearningCycleStore).toHaveBeenCalledOnce();
    expect(ReflectionStore).toHaveBeenCalledOnce();
    expect(registerLearningCycleMessageHandlers).toHaveBeenCalledWith(learningCycleStoreInstance);
    expect(registerReflectionMessageHandlers).toHaveBeenCalledWith(reflectionStoreInstance);
    expect(ResurfacingService).toHaveBeenCalledWith({
      learningCycleStore: learningCycleStoreInstance,
      reflectionStore: reflectionStoreInstance
    });
    expect(registerResurfacingMessageHandlers).toHaveBeenCalledWith(resurfacingServiceInstance);
    expect(registerThinkingJournalActionHandler).toHaveBeenCalledOnce();
  });
});
