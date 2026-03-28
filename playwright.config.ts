import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium-local',
      testMatch: /local-harness\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'chromium-gemini-smoke',
      testMatch: /gemini-smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'chromium-chatgpt-smoke',
      testMatch: /chatgpt-smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'chromium-claude-smoke',
      testMatch: /claude-smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
