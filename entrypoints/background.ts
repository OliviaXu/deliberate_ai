import { defineBackground } from 'wxt/utils/define-background';
import { registerLearningCycleMessageHandlers } from '../src/background/learning-cycle-messages';
import { registerReflectionMessageHandlers } from '../src/background/reflection-messages';
import { registerThinkingJournalActionHandler } from '../src/background/thinking-journal-action';
import { registerResurfacingMessageHandlers } from '../src/background/resurfacing-messages';
import { ResurfacingService } from '../src/background/resurfacing-service';
import { LearningCycleStore } from '../src/shared/learning-cycle-store';
import { ReflectionStore } from '../src/shared/reflection-store';

export default defineBackground(() => {
  console.info('Deliberate AI background worker started');
  const learningCycleStore = new LearningCycleStore();
  const reflectionStore = new ReflectionStore();

  registerLearningCycleMessageHandlers(learningCycleStore);
  registerReflectionMessageHandlers(reflectionStore);
  registerResurfacingMessageHandlers(new ResurfacingService({ learningCycleStore, reflectionStore }));
  registerThinkingJournalActionHandler();
});
