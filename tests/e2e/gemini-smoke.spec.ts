import fs from 'node:fs';
import path from 'node:path';
import { chromium, expect, test } from '@playwright/test';
import { LEARNING_CYCLES_STORAGE_KEY } from '../../src/shared/learning-cycle-store';
import { PLACEHOLDER_GEMINI_THREAD_ID } from '../../src/shared/thread-id';
import type { LearningCycleRecord } from '../../src/shared/types';

const extensionPath = path.resolve(process.cwd(), '.output/chrome-mv3');
const GEMINI_APP_URL = 'https://gemini.google.com/app';
let cachedExtensionId: string | null = null;
let cachedResolvedThread:
  | {
      threadUrl: string;
      record: LearningCycleRecord;
      prompt: string;
    }
  | null = null;

test.describe.configure({ mode: 'serial' });

function expectExtensionBuilt(): void {
  test.skip(!fs.existsSync(path.join(extensionPath, 'manifest.json')), 'Run `npm run build` first to create .output/chrome-mv3.');
}

async function connectToGeminiContext(): Promise<import('@playwright/test').BrowserContext | null> {
  expectExtensionBuilt();

  const cdpPort = process.env.GEMINI_CDP_PORT || '9222';
  const cdpUrl = process.env.GEMINI_CDP_URL || `http://127.0.0.1:${cdpPort}`;
  const browser = await chromium.connectOverCDP(cdpUrl).catch(() => null);
  if (!browser) {
    test.skip(true, `Could not connect to ${cdpUrl}. Start Chrome with \`npm run gemini:open\` and keep that window open.`);
    return null;
  }

  const context =
    browser.contexts().find((candidate) =>
      candidate.pages().some((page) => {
        try {
          return new URL(page.url()).host === 'gemini.google.com';
        } catch {
          return false;
        }
      })
    ) ??
    browser.contexts().find((candidate) =>
      candidate.serviceWorkers().some((worker) => worker.url().startsWith('chrome-extension://'))
    ) ??
    browser.contexts()[0];
  if (!context) {
    test.skip(true, 'No Chrome context was available over CDP. Restart with `npm run gemini:open` and try again.');
    return null;
  }

  return context;
}

async function openGeminiPage(
  context: import('@playwright/test').BrowserContext,
  url: string = GEMINI_APP_URL
): Promise<import('@playwright/test').Page> {
  const expectedConcreteUrl = resolveConcreteGeminiUrl(url);
  const page = await openPageWithRetries(context, url, (actualUrl) => {
    try {
      return new URL(actualUrl).host === 'gemini.google.com';
    } catch {
      return false;
    }
  });

  await expect(getComposer(page)).toBeVisible({ timeout: 15_000 });
  if (expectedConcreteUrl) {
    await expect
      .poll(
        async () => resolveConcreteGeminiUrl(page.url()),
        {
          timeout: 15_000,
          message: `Expected Gemini to finish restoring concrete thread URL ${expectedConcreteUrl}.`
        }
      )
      .toBe(expectedConcreteUrl);
  }
  await expectDeliberateActive(page);
  return page;
}

async function openPageWithRetries(
  context: import('@playwright/test').BrowserContext,
  url: string,
  isExpectedUrl: (actualUrl: string) => boolean
): Promise<import('@playwright/test').Page> {
  let page: import('@playwright/test').Page | null = null;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      if (isExpectedUrl(page.url())) {
        return page;
      }
    } catch (error) {
      const interrupted = String(error).includes('interrupted by another navigation');
      if (!page.isClosed()) await page.close();
      if (!interrupted || attempt === 5) throw error;
      continue;
    }

    if (!page.isClosed()) await page.close();
  }

  throw new Error(`Failed to open the expected page for ${url} in the attached Chrome context.`);
}

function getComposer(page: import('@playwright/test').Page): import('@playwright/test').Locator {
  return page.getByRole('textbox', { name: /enter a prompt for gemini/i });
}

function getSendButton(page: import('@playwright/test').Page): import('@playwright/test').Locator {
  return page.getByRole('button', { name: /send message/i });
}

function getModal(page: import('@playwright/test').Page): import('@playwright/test').Locator {
  return page.locator('[data-testid="deliberate-mode-modal"]');
}

function makePrompt(label: string): string {
  return `Deliberate AI Gemini E2E ${label} ${Date.now()}`;
}

function getPromptToken(prompt: string): string {
  return prompt.match(/\d{13}/)?.[0] ?? prompt;
}

function resolveConcreteGeminiUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.host !== 'gemini.google.com') return null;
    if (parsed.pathname === PLACEHOLDER_GEMINI_THREAD_ID) return null;
    return url;
  } catch {
    return null;
  }
}

async function readComposerText(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    const textbox = document.querySelector('[role="textbox"][aria-label*="Gemini"]');
    return textbox?.textContent || '';
  });
}

async function clearGeminiComposer(page: import('@playwright/test').Page): Promise<void> {
  const composer = getComposer(page);
  await composer.click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.press('Backspace');
}

async function expectDeliberateActive(page: import('@playwright/test').Page): Promise<void> {
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
}

async function getSignalCount(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const raw = document.documentElement.getAttribute('data-deliberate-signal-count');
    return Number(raw || 0);
  });
}

async function waitForSignalIncrement(page: import('@playwright/test').Page, beforeCount: number, source: string): Promise<void> {
  await expect
    .poll(
      async () => getSignalCount(page),
      {
        timeout: 15_000,
        message: `Expected the Gemini submit interception counter to increase after ${source}.`
      }
    )
    .toBeGreaterThan(beforeCount);
}

async function expectComposerText(page: import('@playwright/test').Page, prompt: string): Promise<void> {
  const expectedFragment = getPromptToken(prompt);
  await expect
    .poll(
      async () => readComposerText(page),
      {
        timeout: 10_000,
        message: 'Expected the Gemini composer to contain the typed prompt token before submitting.'
      }
    )
    .toContain(expectedFragment);
}

async function expectNativeSendBlocked(page: import('@playwright/test').Page, prompt: string): Promise<void> {
  const token = getPromptToken(prompt);
  await expect(getModal(page)).toBeVisible({ timeout: 10_000 });
  await expect.poll(async () => new URL(page.url()).pathname, { timeout: 10_000 }).toBe(PLACEHOLDER_GEMINI_THREAD_ID);
  await expect(getComposer(page)).toContainText(token, { timeout: 10_000 });
}

async function typePrompt(page: import('@playwright/test').Page, prompt: string): Promise<void> {
  const composer = getComposer(page);
  await clearGeminiComposer(page);
  await composer.click();
  await composer.pressSequentially(prompt, { delay: 50 });
  await expectComposerText(page, prompt);
}

async function expectModalOpen(page: import('@playwright/test').Page): Promise<void> {
  await expect(getModal(page)).toBeVisible({ timeout: 10_000 });
  await expect
    .poll(
      async () => page.evaluate(() => document.documentElement.getAttribute('data-deliberate-modal-open')),
      {
        timeout: 10_000,
        message: 'Expected the Deliberate AI modal to open after intercepting the Gemini submit.'
      }
    )
    .toBe('true');
}

async function openModalViaEnter(page: import('@playwright/test').Page, prompt: string): Promise<void> {
  const beforeCount = await getSignalCount(page);
  await typePrompt(page, prompt);
  await getComposer(page).press('Enter');
  await waitForSignalIncrement(page, beforeCount, 'pressing Enter in the composer');
  await expectModalOpen(page);
}

async function openModalViaSendButton(page: import('@playwright/test').Page, prompt: string): Promise<void> {
  const beforeCount = await getSignalCount(page);
  await typePrompt(page, prompt);
  const sendButton = getSendButton(page);
  await expect(sendButton).toBeVisible({ timeout: 10_000 });
  await expect(sendButton).toBeEnabled({ timeout: 10_000 });
  await sendButton.click();
  await waitForSignalIncrement(page, beforeCount, 'clicking the Gemini send button');
  await expectModalOpen(page);
}

async function getExtensionId(context: import('@playwright/test').BrowserContext): Promise<string> {
  if (cachedExtensionId) return cachedExtensionId;
  const deadline = Date.now() + 45_000;

  while (Date.now() < deadline) {
    const contexts = context.browser()?.contexts() ?? [context];
    const serviceWorker = contexts.flatMap((candidate) => candidate.serviceWorkers())[0];
    if (serviceWorker) {
      cachedExtensionId = new URL(serviceWorker.url()).host;
      return cachedExtensionId;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error('Timed out waiting for the Deliberate AI extension service worker over CDP.');
}

async function readRecords(context: import('@playwright/test').BrowserContext): Promise<LearningCycleRecord[]> {
  const extensionId = await getExtensionId(context);
  const page = await openPageWithRetries(
    context,
    `chrome-extension://${extensionId}/thinking-journal.html`,
    (actualUrl) => actualUrl.startsWith(`chrome-extension://${extensionId}/`)
  );
  try {
    const records = await page.evaluate(async (storageKey) => {
      const chromeApi = (globalThis as {
        chrome?: { storage?: { local?: { get: (key: string) => Promise<Record<string, unknown>> } } };
      }).chrome;
      const raw = (await chromeApi?.storage?.local?.get(storageKey)) || {};
      const value = raw[storageKey];
      return Array.isArray(value) ? value : [];
    }, LEARNING_CYCLES_STORAGE_KEY);
    return records as LearningCycleRecord[];
  } finally {
    await page.close();
  }
}

async function writeRecords(context: import('@playwright/test').BrowserContext, records: LearningCycleRecord[]): Promise<void> {
  const extensionId = await getExtensionId(context);
  const page = await openPageWithRetries(
    context,
    `chrome-extension://${extensionId}/thinking-journal.html`,
    (actualUrl) => actualUrl.startsWith(`chrome-extension://${extensionId}/`)
  );
  try {
    await page.evaluate(
      async ({ storageKey, nextRecords }) => {
        const chromeApi = (globalThis as {
          chrome?: { storage?: { local?: { set: (items: Record<string, unknown>) => Promise<void> } } };
        }).chrome;
        await chromeApi?.storage?.local?.set({ [storageKey]: nextRecords });
      },
      { storageKey: LEARNING_CYCLES_STORAGE_KEY, nextRecords: records }
    );
  } finally {
    await page.close();
  }
}

async function clearRecords(context: import('@playwright/test').BrowserContext): Promise<void> {
  await writeRecords(context, []);
}

async function waitForResolvedThread(
  context: import('@playwright/test').BrowserContext,
  page: import('@playwright/test').Page,
  timeoutMs: number
): Promise<{ threadUrl: string; record: LearningCycleRecord } | null> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const [record] = await readRecords(context);
    const concreteUrl = resolveConcreteGeminiUrl(page.url());

    if (record && record.threadId !== PLACEHOLDER_GEMINI_THREAD_ID && concreteUrl) {
      return {
        threadUrl: concreteUrl,
        record
      };
    }

    await page.waitForTimeout(500);
  }

  return null;
}

async function submitDelegationAfterEnterIntercept(
  context: import('@playwright/test').BrowserContext,
  page: import('@playwright/test').Page,
  prompt: string
): Promise<{ threadUrl: string; record: LearningCycleRecord }> {
  await openModalViaEnter(page, prompt);
  await page.locator('[data-testid="deliberate-mode-option-delegation"]').click();

  await expect
    .poll(async () => (await readRecords(context)).length, {
      timeout: 30_000,
      message: 'Expected the Enter-origin Gemini resume path to append a learning cycle record.'
    })
    .toBe(1);

  const resolved = await waitForResolvedThread(context, page, 30_000);
  if (!resolved) {
    throw new Error('Gemini resumed the Enter-origin send, but the run never reached a concrete thread URL.');
  }

  return resolved;
}

async function createResolvedDelegationThread(context: import('@playwright/test').BrowserContext): Promise<{
  threadUrl: string;
  record: LearningCycleRecord;
  prompt: string;
}> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await clearRecords(context);
    const page = await openGeminiPage(context);

    try {
      const prompt = `${makePrompt(`delegation-first-attempt-${attempt}`)} Reply with exactly OK.`;
      const resolved = await submitDelegationAfterEnterIntercept(context, page, prompt);
      return { ...resolved, prompt };
    } finally {
      if (!page.isClosed()) await page.close();
    }
  }

  throw new Error('Gemini did append a record from /app, but the run never reached a concrete thread URL on either attempt.');
}

async function getResolvedDelegationThread(context: import('@playwright/test').BrowserContext): Promise<{
  threadUrl: string;
  record: LearningCycleRecord;
  prompt: string;
}> {
  if (cachedResolvedThread) return cachedResolvedThread;
  cachedResolvedThread = await createResolvedDelegationThread(context);
  return cachedResolvedThread;
}

test('intercepts Enter on Gemini and renders the real mode choices', async () => {
  test.setTimeout(60_000);
  const context = await connectToGeminiContext();
  if (!context) return;

  const page = await openGeminiPage(context);
  try {
    await clearRecords(context);
    const prompt = makePrompt('enter-modal');
    await openModalViaEnter(page, prompt);
    await expectNativeSendBlocked(page, prompt);

    await expect(page.locator('[data-testid="deliberate-mode-option-delegation"]')).toBeVisible();
    await expect(page.locator('[data-testid="deliberate-mode-option-problem_solving"]')).toBeVisible();
    await expect(page.locator('[data-testid="deliberate-mode-option-learning"]')).toBeVisible();
    await expect.poll(async () => (await readRecords(context)).length).toBe(0);
  } finally {
    await page.close();
  }
});

test('intercepts the real Gemini send button before native submission', async () => {
  test.setTimeout(60_000);
  const context = await connectToGeminiContext();
  if (!context) return;

  const page = await openGeminiPage(context);
  try {
    await clearRecords(context);
    const prompt = makePrompt('send-button');
    await openModalViaSendButton(page, prompt);
    await expectNativeSendBlocked(page, prompt);
    await expect.poll(async () => (await readRecords(context)).length).toBe(0);
  } finally {
    await page.close();
  }
});

test('enforces the problem-solving detail threshold on the live Gemini modal', async () => {
  test.setTimeout(60_000);
  const context = await connectToGeminiContext();
  if (!context) return;

  const page = await openGeminiPage(context);
  try {
    await clearRecords(context);
    await openModalViaEnter(page, makePrompt('problem-solving'));

    await page.locator('[data-testid="deliberate-mode-option-problem_solving"]').click();
    const detailInput = page.locator('[data-testid="deliberate-mode-detail-input"]');
    const continueButton = page.locator('[data-testid="deliberate-mode-continue"]');

    await expect(detailInput).toBeVisible();
    await expect(continueButton).toBeDisabled();

    await detailInput.fill('x'.repeat(99));
    await expect(continueButton).toBeDisabled();

    await detailInput.fill('x'.repeat(100));
    await expect(continueButton).toBeEnabled();
  } finally {
    await page.close();
  }
});

test('renders the learning note flow on the live Gemini modal', async () => {
  test.setTimeout(60_000);
  const context = await connectToGeminiContext();
  if (!context) return;

  const page = await openGeminiPage(context);
  try {
    await clearRecords(context);
    await openModalViaEnter(page, makePrompt('learning'));

    await page.locator('[data-testid="deliberate-mode-option-learning"]').click();
    const detailInput = page.locator('[data-testid="deliberate-mode-detail-input"]');
    const continueButton = page.locator('[data-testid="deliberate-mode-continue"]');

    await expect(detailInput).toBeVisible();
    await expect(continueButton).toBeEnabled();

    await detailInput.fill('I already know the basics.');
    await expect(continueButton).toBeEnabled();
    await expect.poll(async () => (await readRecords(context)).length).toBe(0);
  } finally {
    await page.close();
  }
});

test('resumes an Enter-intercepted Gemini send into a real thread', async () => {
  test.setTimeout(180_000);
  const context = await connectToGeminiContext();
  if (!context) return;

  const { threadUrl, record, prompt: firstPrompt } = await getResolvedDelegationThread(context);
  expect(record).toMatchObject({
    mode: 'delegation',
    prompt: firstPrompt,
    platform: 'gemini'
  });
  expect(record.threadId).not.toBe(PLACEHOLDER_GEMINI_THREAD_ID);
  expect(new URL(threadUrl).pathname).toBe(record.threadId);
  await expect.poll(async () => (await readRecords(context)).length).toBe(1);
});
