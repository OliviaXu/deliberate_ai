import { test, expect } from '@playwright/test';
import path from 'node:path';

test('local harness keeps native send behavior for Enter', async ({ page }) => {
  const harnessPath = path.resolve(process.cwd(), 'tests/harness/index.html');
  await page.goto(`file://${harnessPath}`);

  await page.locator('#composer').press('Enter');

  await expect(page.locator('#native-send-state')).toHaveText('sent');
});

test('local harness keeps native send behavior for send button click', async ({ page }) => {
  const harnessPath = path.resolve(process.cwd(), 'tests/harness/index.html');
  await page.goto(`file://${harnessPath}`);

  await page.locator('#send').click();

  await expect(page.locator('#native-send-state')).toHaveText('sent');
});
