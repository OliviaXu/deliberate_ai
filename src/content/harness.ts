import { bootContentApp } from './bootstrap';
import { readHarnessNowMs } from './harness-clock';
import { geminiPlatform } from '../platforms/gemini/definition';

void bootContentApp({ now: readHarnessNowMs, platform: geminiPlatform });
