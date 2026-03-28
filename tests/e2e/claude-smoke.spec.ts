import fs from 'node:fs';
import path from 'node:path';
import { chromium, expect, test } from '@playwright/test';
import { PLACEHOLDER_CLAUDE_THREAD_ID } from '../../src/platforms/claude/definition';

const extensionPath = path.resolve(process.cwd(), '.output/chrome-mv3');
const CLAUDE_APP_URL = 'https://claude.ai/new';

test.describe.configure({ mode: 'serial' });

function expectExtensionBuilt(): void {
  test.skip(!fs.existsSync(path.join(extensionPath, 'manifest.json')), 'Run `npm run build` first to create .output/chrome-mv3.');
}

async function connectToClaudeContext(): Promise<import('@playwright/test').BrowserContext | null> {
  expectExtensionBuilt();

  const cdpPort = process.env.CLAUDE_CDP_PORT || '9224';
  const cdpUrl = process.env.CLAUDE_CDP_URL || `http://127.0.0.1:${cdpPort}`;
  const browser = await chromium.connectOverCDP(cdpUrl).catch(() => null);
  if (!browser) {
    test.skip(true, `Could not connect to ${cdpUrl}. Start Chrome on Claude with the extension loaded and keep that window open.`);
    return null;
  }

  const context =
    browser.contexts().find((candidate) =>
      candidate.pages().some((page) => {
        try {
          return new URL(page.url()).host === 'claude.ai';
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
    test.skip(true, 'No Chrome context was available over CDP. Start a Claude Chrome session with the extension loaded and try again.');
    return null;
  }

  return context;
}

async function openClaudePage(
  context: import('@playwright/test').BrowserContext,
  url: string = CLAUDE_APP_URL
): Promise<import('@playwright/test').Page> {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/claude\.ai/, { timeout: 15_000 });
      await expect(getComposer(page)).toBeVisible({ timeout: 15_000 });
      await expectDeliberateActive(page);
      return page;
    } catch (error) {
      if (!page.isClosed()) await page.close();
      if (attempt === 5) throw error;
    }
  }

  throw new Error('Failed to open a Claude page with the Deliberate AI content script attached.');
}

function getComposer(page: import('@playwright/test').Page): import('@playwright/test').Locator {
  return page.locator('div.tiptap.ProseMirror[role="textbox"][data-testid="chat-input"]').first();
}

function getSendButton(page: import('@playwright/test').Page): import('@playwright/test').Locator {
  return page.locator('button[aria-label="Send message"]').first();
}

function getModal(page: import('@playwright/test').Page): import('@playwright/test').Locator {
  return page.locator('[data-testid="deliberate-mode-modal"]');
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
        message: 'Expected the Deliberate AI content script to mark the Claude page as active.'
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
        message: `Expected the Claude submit interception counter to increase after ${source}.`
      }
    )
    .toBeGreaterThan(beforeCount);
}

async function readComposerText(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    const composer = document.querySelector('div.tiptap.ProseMirror[role="textbox"][data-testid="chat-input"]');
    return composer?.textContent || '';
  });
}

function makePrompt(label: string): string {
  return `Deliberate AI Claude E2E ${label} ${Date.now()} Reply with exactly OK.`;
}

function getPromptToken(prompt: string): string {
  return prompt.match(/\d{13}/)?.[0] ?? prompt;
}

async function typePrompt(page: import('@playwright/test').Page, prompt: string): Promise<void> {
  const composer = getComposer(page);
  await clearClaudeComposer(page);
  await composer.click();
  await page.keyboard.type(prompt, { delay: 20 });
  await expect.poll(async () => readComposerText(page), { timeout: 10_000 }).toContain(getPromptToken(prompt));
}

async function clearClaudeComposer(page: import('@playwright/test').Page): Promise<void> {
  const composer = getComposer(page);
  await composer.click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.press('Backspace');
}

async function expectModalOpen(page: import('@playwright/test').Page): Promise<void> {
  await expect(getModal(page)).toBeVisible({ timeout: 10_000 });
  await expect
    .poll(
      async () => page.evaluate(() => document.documentElement.getAttribute('data-deliberate-modal-open')),
      {
        timeout: 10_000,
        message: 'Expected the Deliberate AI modal to open after intercepting the Claude submit.'
      }
    )
    .toBe('true');
}

async function continueWithDelegation(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('[data-testid="deliberate-mode-option-delegation"]').click();
  await expect(getModal(page)).toHaveCount(0, { timeout: 10_000 });
}

async function waitForConcreteClaudeThread(
  context: import('@playwright/test').BrowserContext,
  timeoutMs: number
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const page of context.pages()) {
      const url = page.url();
      try {
        const parsed = new URL(url);
        if (parsed.host === 'claude.ai' && parsed.pathname.startsWith('/chat/') && parsed.pathname !== PLACEHOLDER_CLAUDE_THREAD_ID) {
          return `${parsed.origin}${parsed.pathname}`;
        }
      } catch {}
    }

    await context.waitForEvent('page', { timeout: 500 }).catch(() => null);
  }

  return null;
}

async function expectConcreteClaudeThread(
  context: import('@playwright/test').BrowserContext
): Promise<string> {
  const threadUrl = await waitForConcreteClaudeThread(context, 30_000);
  if (threadUrl) {
    return threadUrl;
  }

  const urls = context.pages().map((page) => page.url());
  throw new Error(`Expected Claude to open a concrete thread, but only saw pages: ${urls.join(', ')}`);
}

test('injects on Claude new chat and intercepts Enter before resuming native send', async () => {
  const context = await connectToClaudeContext();
  if (!context) return;

  const page = await openClaudePage(context);
  const prompt = makePrompt('enter');
  const beforeCount = await getSignalCount(page);

  await typePrompt(page, prompt);
  await page.keyboard.press('Enter');

  await waitForSignalIncrement(page, beforeCount, 'pressing Enter in the Claude composer');
  await expectModalOpen(page);
  await expect.poll(async () => new URL(page.url()).pathname, { timeout: 10_000 }).toBe(PLACEHOLDER_CLAUDE_THREAD_ID);
  await expect.poll(async () => readComposerText(page), { timeout: 10_000 }).toContain(getPromptToken(prompt));
  await continueWithDelegation(page);
  await expectConcreteClaudeThread(context);
});

test('injects on Claude new chat and intercepts send-button click before resuming native send', async () => {
  const context = await connectToClaudeContext();
  if (!context) return;

  const page = await openClaudePage(context);
  const prompt = makePrompt('click');
  const beforeCount = await getSignalCount(page);

  await typePrompt(page, prompt);
  await expect(getSendButton(page)).toBeVisible({ timeout: 10_000 });
  await expect(getSendButton(page)).toBeEnabled({ timeout: 10_000 });
  await getSendButton(page).click();

  await waitForSignalIncrement(page, beforeCount, 'clicking the Claude send button');
  await expectModalOpen(page);
  await expect.poll(async () => new URL(page.url()).pathname, { timeout: 10_000 }).toBe(PLACEHOLDER_CLAUDE_THREAD_ID);
  await continueWithDelegation(page);
  await expectConcreteClaudeThread(context);
});
