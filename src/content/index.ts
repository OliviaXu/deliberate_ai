import { loadDebugConfig } from '../shared/debug-config';
import { Logger } from '../shared/logger';
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
  void modal.open().then((mode) => {
    logger.info('mode-selected', { mode, interceptionId: intent.interceptionId });
    const replayAttempted = interceptor.resume(intent);
    logger.info('send-replay-attempted', {
      replayAttempted,
      deliveryNotVerified: true,
      source: intent.source,
      interceptionId: intent.interceptionId
    });
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
