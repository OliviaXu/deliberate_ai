import { defineContentScript } from 'wxt/utils/define-content-script';
import '../src/content';

export default defineContentScript({
  matches: ['https://gemini.google.com/*'],
  runAt: 'document_idle',
  main() {
    // Side-effect import boots the observe-only detector.
  }
});
