import { defineContentScript } from 'wxt/utils/define-content-script';
import '../src/content';
import { ACTIVE_PLATFORM_MATCH_PATTERNS } from '../src/platforms';

export default defineContentScript({
  matches: ACTIVE_PLATFORM_MATCH_PATTERNS,
  runAt: 'document_idle',
  main() {
    // Side-effect import boots the observe-only detector.
  }
});
