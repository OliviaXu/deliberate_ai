import { defineContentScript } from 'wxt/utils/define-content-script';
import '../src/content/mode-modal.tokens.css';
import '../src/content/mode-modal.css';
import '../src/content/reflection-hint.css';
import '../src/content/reflection-modal.css';
import '../src/content/harness';

export default defineContentScript({
  matches: ['https://deliberate-harness.test/*'],
  runAt: 'document_idle',
  main() {
    // Side-effect import boots the shared content app with harness dependencies.
  }
});
