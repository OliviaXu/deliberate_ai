import { defineBackground } from 'wxt/utils/define-background';
import { registerLearningCycleMessageHandlers } from '../src/background/learning-cycle-messages';
import { registerThinkingJournalActionHandler } from '../src/background/thinking-journal-action';
import { LearningCycleStore } from '../src/shared/learning-cycle-store';

export default defineBackground(() => {
  console.info('Deliberate AI background worker started');
  registerLearningCycleMessageHandlers(new LearningCycleStore());
  registerThinkingJournalActionHandler();
});
