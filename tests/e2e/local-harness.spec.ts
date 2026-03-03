import { chromium, expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { LEARNING_CYCLES_STORAGE_KEY } from '../../src/shared/learning-cycle-store';

const extensionPath = path.resolve(process.cwd(), '.output/chrome-mv3');
const harnessPath = path.resolve(process.cwd(), 'tests/harness/index.html');
const harnessHtml = fs.readFileSync(harnessPath, 'utf8');
const primaryThreadUrl = 'https://gemini.google.com/app/threads/test-thread';
const secondaryThreadUrl = 'https://gemini.google.com/app/threads/another-thread';

async function launchExtensionContext(userDataDir: string): Promise<import('@playwright/test').BrowserContext> {
  return chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  });
}

async function setupHarness(
  context: import('@playwright/test').BrowserContext,
  threadUrl: string = primaryThreadUrl
): Promise<import('@playwright/test').Page> {
  await context.route('https://gemini.google.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: harnessHtml
    });
  });

  const page = await context.newPage();
  await page.goto(threadUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.getAttribute('data-deliberate-active') === 'true');
  return page;
}

async function getServiceWorker(context: import('@playwright/test').BrowserContext): Promise<import('@playwright/test').Worker> {
  return context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker', { timeout: 10_000 }));
}

async function getExtensionId(context: import('@playwright/test').BrowserContext): Promise<string> {
  const sw = await getServiceWorker(context);
  return new URL(sw.url()).host;
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

async function writeRecords(context: import('@playwright/test').BrowserContext, records: unknown[]): Promise<void> {
  const sw = await getServiceWorker(context);
  await sw.evaluate(
    async ({ storageKey, nextRecords }) => {
      const chromeApi = (globalThis as { chrome?: { storage?: { local?: { set: (items: Record<string, unknown>) => Promise<void> } } } }).chrome;
      await chromeApi?.storage?.local?.set({ [storageKey]: nextRecords });
    },
    { storageKey: LEARNING_CYCLES_STORAGE_KEY, nextRecords: records }
  );
}

async function expectModal(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('[data-testid="deliberate-mode-modal"]')).toBeVisible();
}

async function expectNoModal(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForTimeout(200);
  await expect(page.locator('[data-testid="deliberate-mode-modal"]')).toHaveCount(0);
}

async function resetNativeSendState(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const state = document.getElementById('native-send-state');
    if (state) state.textContent = 'idle';
  });
  await expect(page.locator('#native-send-state')).toHaveText('idle');
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

async function sendDelegationPrompt(page: import('@playwright/test').Page, prompt: string): Promise<void> {
  await page.locator('#composer').fill(prompt);
  await page.locator('#send').click();
  await expectModal(page);
  await page.locator('[data-testid="deliberate-mode-option-delegation"]').click();
  await expect(page.locator('#native-send-state')).toHaveText('sent');
}

async function sendPromptExpectBypass(page: import('@playwright/test').Page, prompt: string): Promise<void> {
  await page.locator('#composer').fill(prompt);
  await page.locator('#composer').press('Enter');
  await expect(page.locator('#native-send-state')).toHaveText('sent');
  await expectNoModal(page);
}

test.describe.configure({ mode: 'serial' });

test('local harness shows mode modal once per thread and bypasses later sends', async ({}, testInfo) => {
  test.skip(!fs.existsSync(path.join(extensionPath, 'manifest.json')), 'Run `npm run build` first to create .output/chrome-mv3.');

  const userDataDir = path.resolve(process.cwd(), `.tmp/playwright-thread-once-${testInfo.workerIndex}-${Date.now()}`);
  const context = await launchExtensionContext(userDataDir);
  try {
    const page = await setupHarness(context, primaryThreadUrl);
    await clearRecords(context);

    await sendProblemSolvingPrompt(
      page,
      'Core problem: choose a rollout strategy',
      'I suspect staged rollout with guardrails and explicit rollback criteria is best because it limits blast radius while preserving learning velocity.'
    );

    await expect
      .poll(async () => {
        const records = await readRecords(context);
        return records.length;
      })
      .toBe(1);

    await resetNativeSendState(page);
    await sendPromptExpectBypass(page, 'Follow-up in same thread should bypass modal');

    await expect
      .poll(async () => {
        const records = await readRecords(context);
        return records.length;
      })
      .toBe(1);

    await page.goto(secondaryThreadUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.getAttribute('data-deliberate-active') === 'true');
    await resetNativeSendState(page);
    await sendDelegationPrompt(page, 'New thread should require one initial mode selection');

    await expect
      .poll(async () => {
        const records = await readRecords(context);
        return records.length;
      })
      .toBe(2);

    const records = await readRecords(context);
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ threadId: '/app/threads/test-thread', mode: 'problem_solving' }),
        expect.objectContaining({ threadId: '/app/threads/another-thread', mode: 'delegation' })
      ])
    );
  } finally {
    await context.close();
  }
});

test('local harness bypasses modal after browser restart when thread already has entry', async ({}, testInfo) => {
  test.skip(process.env.E2E_PERSISTENT !== '1', 'Set E2E_PERSISTENT=1 to run restart persistence check.');
  test.skip(!fs.existsSync(path.join(extensionPath, 'manifest.json')), 'Run `npm run build` first to create .output/chrome-mv3.');

  const userDataDir = path.resolve(process.cwd(), `.tmp/playwright-thread-once-persistent-${testInfo.workerIndex}-${Date.now()}`);
  {
    const firstContext = await launchExtensionContext(userDataDir);
    try {
      const page = await setupHarness(firstContext, primaryThreadUrl);
      await clearRecords(firstContext);
      await sendDelegationPrompt(page, 'First send in thread should show modal');
      await expect
        .poll(async () => {
          const records = await readRecords(firstContext);
          return records.length;
        })
        .toBe(1);
    } finally {
      await firstContext.close();
    }
  }

  {
    const secondContext = await launchExtensionContext(userDataDir);
    try {
      const page = await setupHarness(secondContext, primaryThreadUrl);
      await resetNativeSendState(page);
      await sendPromptExpectBypass(page, 'After restart, same thread should bypass modal');
      const records = await readRecords(secondContext);
      expect(records).toHaveLength(1);
    } finally {
      await secondContext.close();
    }
  }
});

test('thinking journal renders seeded entries and supports mode filters', async ({}, testInfo) => {
  test.skip(!fs.existsSync(path.join(extensionPath, 'manifest.json')), 'Run `npm run build` first to create .output/chrome-mv3.');

  const userDataDir = path.resolve(process.cwd(), `.tmp/playwright-thinking-journal-${testInfo.workerIndex}-${Date.now()}`);
  const context = await launchExtensionContext(userDataDir);
  try {
    await clearRecords(context);

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    await writeRecords(context, [
      {
        id: 'problem-1',
        timestamp: now - dayMs,
        platform: 'gemini',
        threadId: '/app/threads/test-thread',
        mode: 'problem_solving',
        prompt: 'Diagnose this production incident quickly'
      },
      {
        id: 'learning-1',
        timestamp: now - 2 * dayMs,
        platform: 'gemini',
        threadId: '/app/threads/test-thread',
        mode: 'learning',
        prompt: 'Explain OAuth PKCE simply',
        priorKnowledgeNote: 'I already know OAuth basics'
      },
      {
        id: 'old-entry',
        timestamp: now - 10 * dayMs,
        platform: 'gemini',
        threadId: '/app/threads/old',
        mode: 'delegation',
        prompt: 'This should not render because it is out of range'
      }
    ]);

    const extensionId = await getExtensionId(context);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/thinking-journal.html`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Thinking Journal' })).toBeVisible();
    await expect(page.getByText('A quiet view of your thinking.')).toBeVisible();

    await expect(page.getByText('This should not render because it is out of range')).toHaveCount(0);
    await expect(page.getByText('Your Hypothesis')).toBeVisible();
    await expect(page.getByText('No hypothesis recorded.')).toBeVisible();
    await expect(page.getByText('Initial Context')).toBeVisible();
    await expect(page.getByText('I already know OAuth basics')).toBeVisible();

    await page.getByRole('button', { name: 'Learning' }).click();
    await expect(page.locator('[data-testid="thinking-journal-card"]')).toHaveCount(1);
    await expect(page.getByText('🧑‍🎓 Learning')).toBeVisible();
    await expect(page.getByText('🤔 Problem-Solving')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
