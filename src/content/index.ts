import { loadDebugConfig } from '../shared/debug-config';
import { Logger } from '../shared/logger';
import type { LearningCycleRuntimeMessage } from '../shared/types';
import { handleModeSubmission } from './learning-cycle-flow';
import { ModeSelectionModal } from './mode-modal';
import { GeminiSendInterceptor } from './send-interceptor';

const logger = new Logger(loadDebugConfig());
const interceptor = new GeminiSendInterceptor(logger);
const modal = new ModeSelectionModal();
let interceptionCount = 0;
let modalOpen = false;

interceptor.onIntercept((intent) => {
  interceptionCount += 1;
  setDomState(interceptionCount, true);
  logger.info('submit-intent-detected', intent);
  if (modalOpen) return;

  modalOpen = true;
  void modal
    .open()
    .then((submission) => {
      logger.info('mode-selected', { mode: submission.mode, interceptionId: intent.interceptionId });
      handleModeSubmission({
        intent,
        submission,
        sendMessage: sendRuntimeMessage,
        resume: (value) => interceptor.resume(value),
        logger
      });
    })
    .finally(() => {
      modalOpen = false;
      setDomState(interceptionCount, false);
    });
});

interceptor.start();
setDomState(interceptionCount, false);

function setDomState(count: number, isModalOpen: boolean): void {
  document.documentElement.setAttribute('data-deliberate-active', 'true');
  document.documentElement.setAttribute('data-deliberate-signal-count', String(count));
  document.documentElement.setAttribute('data-deliberate-modal-open', String(isModalOpen));
}

function sendRuntimeMessage(message: LearningCycleRuntimeMessage): Promise<unknown> | undefined {
  const chromeApi = (globalThis as { chrome?: { runtime?: { sendMessage?: (payload: unknown) => Promise<unknown> | unknown } } }).chrome;
  const send = chromeApi?.runtime?.sendMessage;
  if (!send) return undefined;
  return Promise.resolve(send(message));
}
