import fs from 'node:fs';
import path from 'node:path';
import { chromium, expect, test } from '@playwright/test';

async function clearGeminiComposer(page: import('@playwright/test').Page): Promise<void> {
  const composer = page.getByRole('textbox', { name: /enter a prompt for gemini/i });
  await composer.click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.press('Backspace');
}

test('loads extension on Gemini and emits normalized submit signals', async () => {
  test.setTimeout(60_000);
  const extensionPath = path.resolve(process.cwd(), '.output/chrome-mv3');
  test.skip(!fs.existsSync(path.join(extensionPath, 'manifest.json')), 'Run `npm run build` first to create .output/chrome-mv3.');

  const cdpPort = process.env.GEMINI_CDP_PORT || '9222';
  const cdpUrl = process.env.GEMINI_CDP_URL || `http://127.0.0.1:${cdpPort}`;
  const browser = await chromium.connectOverCDP(cdpUrl).catch(() => null);
  if (!browser) {
    test.skip(true, `Could not connect to ${cdpUrl}. Start Chrome with \`npm run gemini:open\` and keep that window open.`);
    return;
  }

  const context = browser.contexts()[0];
  if (!context) {
    test.skip(true, 'No Chrome context was available over CDP. Restart with `npm run gemini:open` and try again.');
    return;
  }

  const page = await context.newPage();
  await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded' });

  const isGemini = new URL(page.url()).host === 'gemini.google.com';
  test.skip(!isGemini, 'Gemini redirected to auth flow. Sign into Gemini in the Chrome window opened by `npm run gemini:open`.');

  const composer = page.getByRole('textbox', { name: /enter a prompt for gemini/i });
  await expect(composer).toBeVisible({ timeout: 15_000 });
  await clearGeminiComposer(page);

  await expect
    .poll(
      async () =>
        page.evaluate(() => ({
          active: document.documentElement.getAttribute('data-deliberate-active'),
          count: document.documentElement.getAttribute('data-deliberate-signal-count')
        })),
      {
        timeout: 15_000,
        message: 'Expected the Deliberate AI content script to mark the Gemini page as active.'
      }
    )
    .toMatchObject({ active: 'true' });

  const beforeCount = await page.evaluate(() => {
    const raw = document.documentElement.getAttribute('data-deliberate-signal-count');
    return Number(raw || 0);
  });

  await composer.click();
  await composer.pressSequentially('Deliberate AI Gemini smoke test prompt', { delay: 50 });

  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const textbox = document.querySelector('[role="textbox"][aria-label*="Gemini"]');
          return textbox?.textContent || '';
        }),
      {
        timeout: 10_000,
        message: 'Expected the Gemini composer to contain the typed smoke prompt before submitting.'
      }
    )
    .toContain('Deliberate AI Gemini smoke test prompt');

  await composer.press('Enter');

  await expect
    .poll(
      async () => {
        const raw = await page.evaluate(() => document.documentElement.getAttribute('data-deliberate-signal-count'));
        return Number(raw || 0);
      },
      {
        timeout: 15_000,
        message: 'Expected the Gemini submit interception counter to increase after pressing Enter in the composer.'
      }
    )
    .toBeGreaterThan(beforeCount);

  const signalCount = await page.evaluate(() => {
    const raw = document.documentElement.getAttribute('data-deliberate-signal-count');
    return Number(raw || 0);
  });

  expect(signalCount).toBeGreaterThanOrEqual(beforeCount + 1);
  await expect
    .poll(
      async () => page.evaluate(() => document.documentElement.getAttribute('data-deliberate-modal-open')),
      {
        timeout: 10_000,
        message: 'Expected the Deliberate AI modal to open after intercepting the Gemini submit.'
      }
    )
    .toBe('true');
});
