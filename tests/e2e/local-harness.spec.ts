import { chromium, expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { LEARNING_CYCLES_STORAGE_KEY } from '../../src/shared/learning-cycle-store';

const extensionPath = path.resolve(process.cwd(), '.output/chrome-mv3');
const harnessPath = path.resolve(process.cwd(), 'tests/harness/index.html');
const harnessHtml = fs.readFileSync(harnessPath, 'utf8');
const harnessUrl = 'https://gemini.google.com/app/threads/test-thread';

async function launchExtensionContext(userDataDir: string): Promise<import('@playwright/test').BrowserContext> {
  return chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  });
}

async function setupHarness(context: import('@playwright/test').BrowserContext): Promise<import('@playwright/test').Page> {
  await context.route('https://gemini.google.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: harnessHtml
    });
  });

  const page = await context.newPage();
  await page.goto(harnessUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.getAttribute('data-deliberate-active') === 'true');
  return page;
}

async function getServiceWorker(context: import('@playwright/test').BrowserContext): Promise<import('@playwright/test').Worker> {
  return context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker', { timeout: 10_000 }));
}

async function clearRecords(context: import('@playwright/test').BrowserContext): Promise<void> {
  const sw = await getServiceWorker(context);
  await sw.evaluate(async (storageKey) => {
    const chromeApi = (globalThis as { chrome?: { storage?: { local?: { set: (items: Record<string, unknown>) => Promise<void> } } } }).chrome;
    await chromeApi?.storage?.local?.set({ [storageKey]: [] });
  }, LEARNING_CYCLES_STORAGE_KEY);
}

async function readRecords(context: import('@playwright/test').BrowserContext): Promise<unknown[]> {
  const sw = await getServiceWorker(context);
  const records = await sw.evaluate(async (storageKey) => {
    const chromeApi = (globalThis as {
      chrome?: { storage?: { local?: { get: (key: string) => Promise<Record<string, unknown>> } } };
    }).chrome;
    const raw = (await chromeApi?.storage?.local?.get(storageKey)) || {};
    const value = raw[storageKey];
    return Array.isArray(value) ? value : [];
  }, LEARNING_CYCLES_STORAGE_KEY);
  return records as unknown[];
}

async function expectModal(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('[data-testid="deliberate-mode-modal"]')).toBeVisible();
}

async function resetNativeSendState(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const state = document.getElementById('native-send-state');
    if (state) state.textContent = 'idle';
  });
  await expect(page.locator('#native-send-state')).toHaveText('idle');
}

async function sendDelegationPrompt(page: import('@playwright/test').Page, prompt: string): Promise<void> {
  await page.locator('#composer').fill(prompt);
  await page.locator('#composer').press('Enter');
  await expectModal(page);
  await page.locator('[data-testid="deliberate-mode-option-delegation"]').click();
  await expect(page.locator('#native-send-state')).toHaveText('sent');
}

async function sendProblemSolvingPrompt(page: import('@playwright/test').Page, prompt: string, prediction: string): Promise<void> {
  await page.locator('#composer').fill(prompt);
  await page.locator('#send').click();
  await expectModal(page);
  await page.locator('[data-testid="deliberate-mode-option-problem_solving"]').click();
  await page.locator('[data-testid="deliberate-mode-detail-input"]').fill(prediction);
  await page.locator('[data-testid="deliberate-mode-continue"]').click();
  await expect(page.locator('#native-send-state')).toHaveText('sent');
}

async function sendLearningPrompt(page: import('@playwright/test').Page, prompt: string, note: string): Promise<void> {
  await page.locator('#composer').fill(prompt);
  await page.locator('#send').click();
  await expectModal(page);
  await page.locator('[data-testid="deliberate-mode-option-learning"]').click();
  await page.locator('[data-testid="deliberate-mode-detail-input"]').fill(note);
  await page.locator('[data-testid="deliberate-mode-continue"]').click();
  await expect(page.locator('#native-send-state')).toHaveText('sent');
}

async function runThreeModePrompts(page: import('@playwright/test').Page): Promise<void> {
  await sendDelegationPrompt(page, 'Delegate: summarize this release checklist');
  await resetNativeSendState(page);
  await sendProblemSolvingPrompt(
    page,
    'Core problem: choose a rollout strategy',
    'I suspect staged rollout with guardrails and explicit rollback criteria is best because it limits blast radius while preserving learning velocity.'
  );
  await resetNativeSendState(page);
  await sendLearningPrompt(page, 'Learning: explain CAP tradeoffs', 'I already know CAP basics but want concrete system examples.');
}

test.describe.configure({ mode: 'serial' });

test('local harness stores one learning cycle per mode and survives reload', async ({}, testInfo) => {
  test.skip(!fs.existsSync(path.join(extensionPath, 'manifest.json')), 'Run `npm run build` first to create .output/chrome-mv3.');

  const userDataDir = path.resolve(process.cwd(), `.tmp/playwright-phase2-local-${testInfo.workerIndex}-${Date.now()}`);
  const context = await launchExtensionContext(userDataDir);
  try {
    const page = await setupHarness(context);
    await clearRecords(context);

    await runThreeModePrompts(page);

    await expect
      .poll(async () => {
        const records = await readRecords(context);
        return records.length;
      })
      .toBe(3);

    let records = await readRecords(context);
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mode: 'delegation',
          threadId: '/app/threads/test-thread',
          prompt: 'Delegate: summarize this release checklist'
        }),
        expect.objectContaining({
          mode: 'problem_solving',
          prediction: expect.stringContaining('staged rollout'),
          prompt: 'Core problem: choose a rollout strategy'
        }),
        expect.objectContaining({
          mode: 'learning',
          priorKnowledgeNote: 'I already know CAP basics but want concrete system examples.',
          prompt: 'Learning: explain CAP tradeoffs'
        })
      ])
    );

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.getAttribute('data-deliberate-active') === 'true');
    records = await readRecords(context);
    expect(records).toHaveLength(3);
  } finally {
    await context.close();
  }
});

test('local harness records survive browser restart', async ({}, testInfo) => {
  test.skip(process.env.E2E_PERSISTENT !== '1', 'Set E2E_PERSISTENT=1 to run restart persistence check.');
  test.skip(!fs.existsSync(path.join(extensionPath, 'manifest.json')), 'Run `npm run build` first to create .output/chrome-mv3.');

  const userDataDir = path.resolve(process.cwd(), `.tmp/playwright-phase2-persistent-${testInfo.workerIndex}-${Date.now()}`);
  {
    const firstContext = await launchExtensionContext(userDataDir);
    try {
      const page = await setupHarness(firstContext);
      await clearRecords(firstContext);
      await runThreeModePrompts(page);
      await expect
        .poll(async () => {
          const records = await readRecords(firstContext);
          return records.length;
        })
        .toBe(3);
    } finally {
      await firstContext.close();
    }
  }

  {
    const secondContext = await launchExtensionContext(userDataDir);
    try {
      await setupHarness(secondContext);
      const records = await readRecords(secondContext);
      expect(records).toHaveLength(3);
      expect(records.map((record) => (record as { mode?: string }).mode)).toEqual([
        'delegation',
        'problem_solving',
        'learning'
      ]);
    } finally {
      await secondContext.close();
    }
  }
});
