import { chromium } from '@playwright/test';

const EXTENSION_NAME = process.env.CLAUDE_EXTENSION_NAME || 'Deliberate AI';
const cdpPort = process.env.CLAUDE_CDP_PORT || '9224';
const cdpUrl = process.env.CLAUDE_CDP_URL || `http://127.0.0.1:${cdpPort}`;

async function main() {
  const browser = await chromium.connectOverCDP(cdpUrl).catch(() => null);
  if (!browser) {
    console.error(`Could not connect to ${cdpUrl}. Start Chrome with "npm run claude:open" first.`);
    process.exit(1);
  }

  const context = browser.contexts()[0];
  if (!context) {
    console.error('No Chrome context was available over CDP.');
    process.exit(1);
  }

  const page =
    context.pages().find((candidate) => candidate.url().startsWith('chrome://extensions')) ??
    (await context.newPage());

  if (!page.url().startsWith('chrome://extensions')) {
    await page.goto('chrome://extensions/');
  }

  await page.waitForFunction(
    (name) => {
      const manager = document.querySelector('extensions-manager');
      const itemList = manager?.shadowRoot?.querySelector('#items-list');
      const items = itemList?.shadowRoot?.querySelectorAll('extensions-item');
      return Array.from(items || []).some((item) => {
        const root = item.shadowRoot;
        const extensionName = root?.querySelector('#name')?.textContent?.trim();
        return extensionName === name;
      });
    },
    EXTENSION_NAME,
    { timeout: 15_000 }
  );

  const reloaded = await page.evaluate((name) => {
    const manager = document.querySelector('extensions-manager');
    const itemList = manager?.shadowRoot?.querySelector('#items-list');
    const items = itemList?.shadowRoot?.querySelectorAll('extensions-item');

    for (const item of Array.from(items || [])) {
      const root = item.shadowRoot;
      const extensionName = root?.querySelector('#name')?.textContent?.trim();
      if (extensionName !== name) continue;
      const reloadButton = root?.querySelector('#dev-reload-button');
      if (!(reloadButton instanceof HTMLElement)) return false;
      reloadButton.click();
      return true;
    }

    return false;
  }, EXTENSION_NAME);

  if (!reloaded) {
    console.error(`Could not find a reload button for "${EXTENSION_NAME}" on chrome://extensions.`);
    process.exit(1);
  }

  console.log(`Reloaded "${EXTENSION_NAME}" in the attached Chrome session.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
