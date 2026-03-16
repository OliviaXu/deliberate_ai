import { defineBackground } from 'wxt/utils/define-background';
import { registerLearningCycleMessageHandlers } from '../src/background/learning-cycle-messages';
import { registerReflectionMessageHandlers } from '../src/background/reflection-messages';
import { registerThinkingJournalActionHandler } from '../src/background/thinking-journal-action';
import { LearningCycleStore } from '../src/shared/learning-cycle-store';
import { ReflectionStore } from '../src/shared/reflection-store';

export default defineBackground(() => {
  console.info('Deliberate AI background worker started');
  const learningCycleStore = new LearningCycleStore();
  const reflectionStore = new ReflectionStore();

<<<<<<< HEAD
  registerLearningCycleMessageHandlers({
    append: (record) => learningCycleStore.append(record),
    resolveThreadIdForRecord: (recordId, fromThreadId, toThreadId) =>
      learningCycleStore.resolveThreadIdForRecord(recordId, fromThreadId, toThreadId),
    getLatestForThread: (threadId) => learningCycleStore.getLatestForThread(threadId)
  });
  registerReflectionMessageHandlers({
    append: (record) => reflectionStore.append(record),
    hasCompletedReflectionForRecord: (learningCycleRecordId) => reflectionStore.hasCompletedReflectionForRecord(learningCycleRecordId)
  });
=======
  registerLearningCycleMessageHandlers(learningCycleStore);
  registerReflectionMessageHandlers(reflectionStore);
>>>>>>> 1fcb1e6 (Simplify background store registration)
  registerThinkingJournalActionHandler();
});
