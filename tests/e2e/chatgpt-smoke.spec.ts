import fs from 'node:fs';
import path from 'node:path';
import { chromium, expect, test } from '@playwright/test';
import { PLACEHOLDER_CHATGPT_THREAD_ID } from '../../src/platforms/chatgpt/definition';
import { LEARNING_CYCLES_STORAGE_KEY } from '../../src/shared/learning-cycle-store';
import type { LearningCycleRecord } from '../../src/shared/types';

const extensionPath = path.resolve(process.cwd(), '.output/chrome-mv3');
const CHATGPT_APP_URL = 'https://chatgpt.com/';
let cachedExtensionId: string | null = null;

test.describe.configure({ mode: 'serial' });

function expectExtensionBuilt(): void {
  test.skip(!fs.existsSync(path.join(extensionPath, 'manifest.json')), 'Run `npm run build` first to create .output/chrome-mv3.');
}

async function connectToChatGPTContext(): Promise<import('@playwright/test').BrowserContext | null> {
  expectExtensionBuilt();

  const cdpPort = process.env.CHATGPT_CDP_PORT || '9223';
  const cdpUrl = process.env.CHATGPT_CDP_URL || `http://127.0.0.1:${cdpPort}`;
  const browser = await chromium.connectOverCDP(cdpUrl).catch(() => null);
  if (!browser) {
    test.skip(true, `Could not connect to ${cdpUrl}. Start Chrome with \`npm run chatgpt:open\` and keep that window open.`);
    return null;
  }

  const context =
    browser.contexts().find((candidate) =>
      candidate.pages().some((page) => {
        try {
          return new URL(page.url()).host === 'chatgpt.com';
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
    test.skip(true, 'No Chrome context was available over CDP. Restart with `npm run chatgpt:open` and try again.');
    return null;
  }

  return context;
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

async function openChatGPTPage(
  context: import('@playwright/test').BrowserContext,
  url: string = CHATGPT_APP_URL
): Promise<import('@playwright/test').Page> {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const page = await openPageWithRetries(context, url, (actualUrl) => {
      try {
        return new URL(actualUrl).host === 'chatgpt.com';
      } catch {
        return false;
      }
    });

    try {
      await expect(page).toHaveURL(/chatgpt\.com/, { timeout: 15_000 });
      await expect(await getComposer(page)).toBeVisible({ timeout: 15_000 });
      await expectDeliberateActive(page);
      return page;
    } catch (error) {
      if (!page.isClosed()) await page.close();
      if (attempt === 5) throw error;
    }
  }

  throw new Error('Failed to open a ChatGPT page with the Deliberate AI content script attached.');
}

async function getComposer(page: import('@playwright/test').Page): Promise<import('@playwright/test').Locator> {
  return page.locator('div.ProseMirror[role="textbox"]').first();
}

function getSendButton(page: import('@playwright/test').Page): import('@playwright/test').Locator {
  return page.locator('button[data-testid="send-button"], button[aria-label="Send prompt"]').first();
}

function getModal(page: import('@playwright/test').Page): import('@playwright/test').Locator {
  return page.locator('[data-testid="deliberate-mode-modal"]');
}

function makePrompt(label: string): string {
  return `Deliberate AI ChatGPT E2E ${label} ${Date.now()} Reply with exactly OK.`;
}

function getPromptToken(prompt: string): string {
  return prompt.match(/\d{13}/)?.[0] ?? prompt;
}

function resolveConcreteChatGPTUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.host !== 'chatgpt.com') return null;
    if (parsed.pathname === PLACEHOLDER_CHATGPT_THREAD_ID) return null;
    if (!parsed.pathname.startsWith('/c/')) return null;
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return null;
  }
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
        message: 'Expected the Deliberate AI content script to mark the ChatGPT page as active.'
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
        message: `Expected the ChatGPT submit interception counter to increase after ${source}.`
      }
    )
    .toBeGreaterThan(beforeCount);
}

async function readComposerText(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    const proseMirror = document.querySelector('div.ProseMirror[role="textbox"]');
    if (proseMirror?.textContent) return proseMirror.textContent;

    const textarea = document.querySelector('textarea[name="prompt-textarea"]');
    if (textarea instanceof HTMLTextAreaElement && textarea.value) return textarea.value;
    return '';
  });
}

async function typePrompt(page: import('@playwright/test').Page, prompt: string): Promise<void> {
  const composer = await getComposer(page);
  await composer.click();
  await page.keyboard.type(prompt, { delay: 20 });
  await expect.poll(async () => readComposerText(page), { timeout: 10_000 }).toContain(getPromptToken(prompt));
}

async function expectModalOpen(page: import('@playwright/test').Page): Promise<void> {
  await expect(getModal(page)).toBeVisible({ timeout: 10_000 });
  await expect
    .poll(
      async () => page.evaluate(() => document.documentElement.getAttribute('data-deliberate-modal-open')),
      {
        timeout: 10_000,
        message: 'Expected the Deliberate AI modal to open after intercepting the ChatGPT submit.'
      }
    )
    .toBe('true');
}

async function openModalViaSendButton(page: import('@playwright/test').Page, prompt: string): Promise<void> {
  const beforeCount = await getSignalCount(page);
  await typePrompt(page, prompt);
  const sendButton = getSendButton(page);
  await expect(sendButton).toBeVisible({ timeout: 10_000 });
  await expect(sendButton).toBeEnabled({ timeout: 10_000 });
  await sendButton.click();
  await waitForSignalIncrement(page, beforeCount, 'clicking the ChatGPT send button');
  await expectModalOpen(page);
}

async function expectNativeSendBlocked(page: import('@playwright/test').Page, prompt: string): Promise<void> {
  await expect(getModal(page)).toBeVisible({ timeout: 10_000 });
  await expect.poll(async () => new URL(page.url()).pathname, { timeout: 10_000 }).toBe(PLACEHOLDER_CHATGPT_THREAD_ID);
  await expect.poll(async () => readComposerText(page), { timeout: 10_000 }).toContain(getPromptToken(prompt));
}

async function waitForResolvedThread(page: import('@playwright/test').Page, timeoutMs: number): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const concreteUrl = resolveConcreteChatGPTUrl(page.url());

    if (concreteUrl) {
      return concreteUrl;
    }

    await page.waitForTimeout(500);
  }

  return null;
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

test('ChatGPT injects on the live page and intercepts the real send button before native submission', async () => {
  test.setTimeout(60_000);
  const context = await connectToChatGPTContext();
  if (!context) return;

  const page = await openChatGPTPage(context);
  try {
    const prompt = makePrompt('send-button');
    await openModalViaSendButton(page, prompt);
    await expectNativeSendBlocked(page, prompt);

    await expect(page.locator('[data-testid="deliberate-mode-option-delegation"]')).toBeVisible();
    await expect(page.locator('[data-testid="deliberate-mode-option-problem_solving"]')).toBeVisible();
    await expect(page.locator('[data-testid="deliberate-mode-option-learning"]')).toBeVisible();
  } finally {
    await page.close();
  }
});

test('ChatGPT resumes the intercepted send into a concrete thread after mode selection', async () => {
  test.setTimeout(180_000);
  const context = await connectToChatGPTContext();
  if (!context) return;

  const page = await openChatGPTPage(context);
  try {
    await clearRecords(context);
    const prompt = makePrompt('delegation-resume');
    await openModalViaSendButton(page, prompt);
    await expect.poll(async () => (await readRecords(context)).length, { timeout: 10_000 }).toBe(0);
    await page.locator('[data-testid="deliberate-mode-option-delegation"]').click();

    await expect
      .poll(async () => (await readRecords(context))[0] ?? null, {
        timeout: 30_000,
        message: 'Expected ChatGPT to append a learning-cycle record after the resumed send starts.'
      })
      .toMatchObject({
        platform: 'chatgpt',
        threadId: PLACEHOLDER_CHATGPT_THREAD_ID,
        mode: 'delegation',
        prompt
      });

    const resolvedThreadUrl = await waitForResolvedThread(page, 60_000);
    if (!resolvedThreadUrl) {
      throw new Error('ChatGPT resumed the intercepted send, but the run never reached a concrete /c/<id> thread URL.');
    }

    const resolvedRecord = await expect
      .poll(async () => (await readRecords(context))[0] ?? null, {
        timeout: 60_000,
        message: 'Expected the stored ChatGPT learning-cycle record to resolve to the concrete /c/<id> thread.'
      })
      .toMatchObject({
        platform: 'chatgpt',
        threadId: new URL(resolvedThreadUrl).pathname,
        mode: 'delegation',
        prompt
      });

    await expect(getModal(page)).toHaveCount(0, { timeout: 15_000 });
    expect(new URL(resolvedThreadUrl).pathname).toMatch(/^\/c\/.+/);
  } finally {
    await page.close();
  }
});
