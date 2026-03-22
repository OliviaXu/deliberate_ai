import { bootContentApp } from './bootstrap';
import { readHarnessNowMs } from './harness-clock';

void bootContentApp({ now: readHarnessNowMs });
