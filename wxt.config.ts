import { defineConfig } from 'wxt';

export default defineConfig({
  modules: [],
  manifest: {
    name: 'Deliberate AI',
    description: 'Pause. Predict. Then Prompt.',
    permissions: ['storage'],
    host_permissions: ['https://gemini.google.com/*']
  }
});
