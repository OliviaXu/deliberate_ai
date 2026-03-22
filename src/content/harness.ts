import { startContentApp } from './app';
import { readHarnessNowMs } from './harness-clock';

void startContentApp({ now: readHarnessNowMs });
