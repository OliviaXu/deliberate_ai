import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

async function gotoHarnessWithContentScript(page: import('@playwright/test').Page): Promise<void> {
  const harnessPath = path.resolve(process.cwd(), 'tests/harness/index.html');
  const contentScriptPath = path.resolve(process.cwd(), '.output/chrome-mv3/content-scripts/content.js');

  test.skip(!fs.existsSync(contentScriptPath), 'Run `npm run build` first to create .output/chrome-mv3/content-scripts/content.js.');

  await page.goto(`file://${harnessPath}`);
  await page.addScriptTag({ path: contentScriptPath });
  await page.waitForFunction(() => document.documentElement.getAttribute('data-deliberate-active') === 'true');
}

test('local harness blocks Enter send until mode selection, then resumes', async ({ page }) => {
  await gotoHarnessWithContentScript(page);

  await page.locator('#composer').focus();
  await page.locator('#composer').press('Enter');
  await expect(page.locator('[data-testid="deliberate-mode-modal"]')).toBeVisible();
  await expect(page.locator('#native-send-state')).toHaveText('idle');
  await page.locator('[data-testid="deliberate-mode-option-delegation"]').click();
  await expect(page.locator('#native-send-state')).toHaveText('sent');
});

test('local harness blocks send click until mode selection, then resumes', async ({ page }) => {
  await gotoHarnessWithContentScript(page);

  await page.locator('#send').click();
  await expect(page.locator('[data-testid="deliberate-mode-modal"]')).toBeVisible();
  await expect(page.locator('#native-send-state')).toHaveText('idle');
  await page.locator('[data-testid="deliberate-mode-option-learning"]').click();
  await expect(page.locator('#native-send-state')).toHaveText('sent');
});

test('local harness opens modal on every send action', async ({ page }) => {
  await gotoHarnessWithContentScript(page);

  await page.locator('#send').click();
  await expect(page.locator('[data-testid="deliberate-mode-modal"]')).toBeVisible();
  await page.locator('[data-testid="deliberate-mode-option-problem_solving"]').click();
  await expect(page.locator('#native-send-state')).toHaveText('sent');

  await page.evaluate(() => {
    const state = document.getElementById('native-send-state');
    if (state) state.textContent = 'idle';
  });

  await page.locator('#send').click();
  await expect(page.locator('[data-testid="deliberate-mode-modal"]')).toBeVisible();
});
