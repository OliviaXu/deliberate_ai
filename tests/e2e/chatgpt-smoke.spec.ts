import fs from 'node:fs';
import path from 'node:path';
import { chromium, expect, test } from '@playwright/test';

const extensionPath = path.resolve(process.cwd(), '.output/chrome-mv3');
const CHATGPT_APP_URL = 'https://chatgpt.com/';

test.describe.configure({ mode: 'serial' });

function expectExtensionBuilt(): void {
  test.skip(!fs.existsSync(path.join(extensionPath, 'manifest.json')), 'Run `npm run build` first to create .output/chrome-mv3.');
}

async function connectToChatGptContext(): Promise<import('@playwright/test').BrowserContext | null> {
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

async function openChatGptPage(
  context: import('@playwright/test').BrowserContext,
  url: string = CHATGPT_APP_URL
): Promise<import('@playwright/test').Page> {
  const page = await openPageWithRetries(context, url, (actualUrl) => {
    try {
      return new URL(actualUrl).host === 'chatgpt.com';
    } catch {
      return false;
    }
  });

  await expect(page).toHaveURL(/chatgpt\.com/, { timeout: 15_000 });
  return page;
}

async function collectChatGptSurface(page: import('@playwright/test').Page): Promise<{
  title: string;
  url: string;
  inputCandidates: Array<Record<string, unknown>>;
  sendButtonCandidates: Array<Record<string, unknown>>;
}> {
  return page.evaluate(() => {
    const describeElement = (element: Element) => ({
      tagName: element.tagName.toLowerCase(),
      role: element.getAttribute('role'),
      ariaLabel: element.getAttribute('aria-label'),
      placeholder: element.getAttribute('placeholder'),
      testId: element.getAttribute('data-testid'),
      name: element.getAttribute('name'),
      classes: element instanceof HTMLElement ? element.className : element.getAttribute('class'),
      text: (element.textContent || '').trim().slice(0, 120)
    });

    const inputCandidates = Array.from(
      document.querySelectorAll('textarea, [role="textbox"], [contenteditable="true"]')
    )
      .slice(0, 12)
      .map((element: Element) => describeElement(element));

    const sendButtonCandidates = Array.from(document.querySelectorAll('button'))
      .filter((element: Element) => {
        const label = `${element.getAttribute('aria-label') || ''} ${(element.textContent || '').trim()}`.toLowerCase();
        return label.includes('send');
      })
      .slice(0, 12)
      .map((element: Element) => describeElement(element));

    return {
      title: document.title,
      url: window.location.href,
      inputCandidates,
      sendButtonCandidates
    };
  });
}

test('chatgpt probe reports candidate composer controls from a signed-in session', async () => {
  const context = await connectToChatGptContext();
  test.skip(!context, 'ChatGPT context not available');
  if (!context) return;

  const page = await openChatGptPage(context);

  await expect
    .poll(
      async () => {
        const surface = await collectChatGptSurface(page);
        return surface.inputCandidates.length;
      },
      {
        timeout: 15_000,
        message: 'Expected ChatGPT to expose at least one textbox, textarea, or contenteditable candidate.'
      }
    )
    .toBeGreaterThan(0);

  const surface = await collectChatGptSurface(page);
  console.log(`CHATGPT_SURFACE ${JSON.stringify(surface, null, 2)}`);
});
