import { defineConfig } from 'wxt';

export default defineConfig({
  modules: [],
  manifest: {
    name: 'Deliberate AI',
    description: 'Pause. Predict. Then Prompt.',
    action: {
      default_title: 'Open Thinking Journal'
    },
    permissions: ['storage'],
    host_permissions: ['https://gemini.google.com/*']
  }
});
