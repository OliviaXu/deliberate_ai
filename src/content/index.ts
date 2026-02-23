import { loadDebugConfig } from '../shared/debug-config';
import { Logger } from '../shared/logger';
import { GeminiInterceptDetector } from './intercept-detector';

const logger = new Logger(loadDebugConfig());
const detector = new GeminiInterceptDetector();
let signalCount = 0;

detector.onSignal((signal) => {
  signalCount += 1;
  setDomState(signalCount);
  logger.info('submit-intent-detected', signal);
});

detector.start();
setDomState(signalCount);

function setDomState(count: number): void {
  document.documentElement.setAttribute('data-deliberate-active', 'true');
  document.documentElement.setAttribute('data-deliberate-signal-count', String(count));
}
