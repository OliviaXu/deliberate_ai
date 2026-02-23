import fs from 'node:fs';
import path from 'node:path';
import { chromium, expect, test } from '@playwright/test';

test('loads extension on Gemini and emits normalized submit signals', async () => {
  const extensionPath = path.resolve(process.cwd(), '.output/chrome-mv3');
  test.skip(!fs.existsSync(path.join(extensionPath, 'manifest.json')), 'Run `npm run build` first to create .output/chrome-mv3.');

  const userDataDir = process.env.GEMINI_USER_DATA_DIR || path.resolve(process.cwd(), '.tmp/playwright-gemini-profile');
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  });

  try {
    const serviceWorker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const extensionId = new URL(serviceWorker.url()).host;
    expect(extensionId).toBeTruthy();

    const page = await context.newPage();
    await page.goto('https://gemini.google.com/', { waitUntil: 'domcontentloaded' });

    const isGemini = new URL(page.url()).host === 'gemini.google.com';
    test.skip(!isGemini, 'Gemini redirected to auth flow. Provide a signed-in profile with GEMINI_USER_DATA_DIR.');

    await page.waitForFunction(
      () => document.documentElement.getAttribute('data-deliberate-active') === 'true',
      { timeout: 10_000 }
    );
    const testStateReady = await page.evaluate(
      () => document.documentElement.getAttribute('data-deliberate-active') === 'true'
    );
    expect(testStateReady).toBe(true);

    const keydownDefaultPrevented = await page.evaluate(() => {
      const evt = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      document.dispatchEvent(evt);
      return evt.defaultPrevented;
    });
    expect(keydownDefaultPrevented).toBe(false);

    await page.evaluate(() => {
      const btn = document.createElement('button');
      btn.setAttribute('aria-label', 'Send');
      btn.textContent = 'Send';
      btn.id = 'deliberate-test-send';
      document.body.appendChild(btn);
    });
    await page.click('#deliberate-test-send');

    const signalCount = await page.evaluate(() => {
      const raw = document.documentElement.getAttribute('data-deliberate-signal-count');
      return Number(raw || 0);
    });

    expect(signalCount).toBeGreaterThanOrEqual(2);
  } finally {
    await context.close();
  }
});
