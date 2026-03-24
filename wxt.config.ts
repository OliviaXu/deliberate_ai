import { defineConfig } from 'wxt';
import { ACTIVE_PLATFORM_MATCH_PATTERNS } from './src/platforms';

export default defineConfig({
  modules: [],
  manifest: {
    name: 'Deliberate AI',
    description: 'Pause. Predict. Then Prompt.',
    action: {
      default_title: 'Open Thinking Journal'
    },
    permissions: ['storage'],
    host_permissions: ACTIVE_PLATFORM_MATCH_PATTERNS
  }
});
