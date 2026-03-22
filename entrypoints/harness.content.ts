import { defineContentScript } from 'wxt/utils/define-content-script';
import '../src/content/harness';

export default defineContentScript({
  matches: ['https://deliberate-harness.test/*'],
  runAt: 'document_idle',
  main() {
    // Side-effect import boots the shared content app with harness dependencies.
  }
});
