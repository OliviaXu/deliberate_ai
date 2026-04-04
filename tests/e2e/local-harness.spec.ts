import { chromium, expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { HARNESS_NOW_ATTRIBUTE } from '../../src/content/harness-clock';
import { LEARNING_CYCLES_STORAGE_KEY } from '../../src/shared/learning-cycle-store';
import { REFLECTIONS_STORAGE_KEY } from '../../src/shared/reflection-store';

const extensionPath = path.resolve(process.cwd(), '.output/chrome-mv3');
const harnessPath = path.resolve(process.cwd(), 'tests/harness/index.html');
const harnessHtml = fs.readFileSync(harnessPath, 'utf8');
const harnessOrigin = 'https://deliberate-harness.test';
const primaryThreadUrl = `${harnessOrigin}/app/threads/test-thread`;
const secondaryThreadUrl = `${harnessOrigin}/app/threads/another-thread`;
const tertiaryThreadUrl = `${harnessOrigin}/app/threads/turn-threshold-thread`;
const PERSISTENT_CONTEXT_LAUNCH_ATTEMPTS = 3;

async function launchExtensionContext(userDataDir: string): Promise<import('@playwright/test').BrowserContext> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= PERSISTENT_CONTEXT_LAUNCH_ATTEMPTS; attempt += 1) {
    try {
      return await chromium.launchPersistentContext(userDataDir, {
        channel: 'chromium',
        headless: true,
        ignoreDefaultArgs: ['--disable-extensions'],
        args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
      });
    } catch (error) {
      lastError = error;
      if (attempt === PERSISTENT_CONTEXT_LAUNCH_ATTEMPTS) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw lastError;
}

async function setupHarness(
  context: import('@playwright/test').BrowserContext,
  threadUrl: string = primaryThreadUrl,
  nowMs?: number
): Promise<import('@playwright/test').Page> {
  await context.route(`${harnessOrigin}/**`, async (route) => {
    const body =
      nowMs === undefined
        ? harnessHtml
        : harnessHtml.replace('<html lang="en">', `<html lang="en" ${HARNESS_NOW_ATTRIBUTE}="${String(nowMs)}">`);
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body
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
  await sw.evaluate(async ({ learningCyclesStorageKey, reflectionsStorageKey }) => {
    const chromeApi = (globalThis as { chrome?: { storage?: { local?: { set: (items: Record<string, unknown>) => Promise<void> } } } }).chrome;
    await chromeApi?.storage?.local?.set({
      [learningCyclesStorageKey]: [],
      [reflectionsStorageKey]: []
    });
  }, { learningCyclesStorageKey: LEARNING_CYCLES_STORAGE_KEY, reflectionsStorageKey: REFLECTIONS_STORAGE_KEY });
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

async function readReflectionRecords(context: import('@playwright/test').BrowserContext): Promise<unknown[]> {
  const sw = await getServiceWorker(context);
  const records = await sw.evaluate(async (storageKey) => {
    const chromeApi = (globalThis as {
      chrome?: { storage?: { local?: { get: (key: string) => Promise<Record<string, unknown>> } } };
    }).chrome;
    const raw = (await chromeApi?.storage?.local?.get(storageKey)) || {};
    const value = raw[storageKey];
    return Array.isArray(value) ? value : [];
  }, REFLECTIONS_STORAGE_KEY);
  return records as unknown[];
}

async function setHarnessNow(page: import('@playwright/test').Page, nowMs: number): Promise<void> {
  await page.evaluate(
    ({ attribute, value }) => {
      document.documentElement.setAttribute(attribute, String(value));
    },
    { attribute: HARNESS_NOW_ATTRIBUTE, value: nowMs }
  );
}

async function clearHarnessNow(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate((attribute) => {
    document.documentElement.removeAttribute(attribute);
  }, HARNESS_NOW_ATTRIBUTE);
}

async function expectModal(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('[data-testid="deliberate-mode-modal"]')).toBeVisible();
}

async function expectNoModal(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForTimeout(200);
  await expect(page.locator('[data-testid="deliberate-mode-modal"]')).toHaveCount(0);
}

async function expectHintVisible(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('[data-testid="deliberate-reflection-hint"]')).toBeVisible();
}

async function expectHintHidden(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('[data-testid="deliberate-reflection-hint"]')).toHaveCount(0);
}

async function expectReflectionModal(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('[data-testid="deliberate-reflection-modal"]')).toBeVisible();
}

async function submitReflection(page: import('@playwright/test').Page, score: '0' | '25' | '50' | '75' | '100', notes?: string): Promise<void> {
  await expectReflectionModal(page);
  await page.locator('[data-testid="deliberate-reflection-scale-input"]').fill(score);
  if (notes) {
    await page.locator('[data-testid="deliberate-reflection-notes"]').fill(notes);
  }
  await page.locator('[data-testid="deliberate-reflection-submit"]').click();
  await expect(page.locator('[data-testid="deliberate-reflection-modal"]')).toHaveCount(0);
}

async function navigateThreadInPlace(page: import('@playwright/test').Page, threadUrl: string): Promise<void> {
  await page.evaluate((nextUrl) => {
    history.pushState({}, '', nextUrl);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, threadUrl);
}

async function resetNativeSendState(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const state = document.getElementById('native-send-state');
    if (state) state.textContent = 'idle';
  });
  await expect(page.locator('#native-send-state')).toHaveText('idle');
}

async function sendProblemSolvingPrompt(page: import('@playwright/test').Page, prompt: string, prediction: string): Promise<void> {
  const composer = page.getByRole('textbox', { name: /enter a prompt for gemini/i });
  await composer.fill(prompt);
  await page.getByRole('button', { name: /send message/i }).click();
  await expectModal(page);
  await page.locator('[data-testid="deliberate-mode-option-problem_solving"]').click();
  await page.locator('[data-testid="deliberate-mode-detail-input"]').fill(prediction);
  await page.locator('[data-testid="deliberate-mode-continue"]').click();
  await expect(page.locator('#native-send-state')).toHaveText('sent');
}

async function sendDelegationPrompt(page: import('@playwright/test').Page, prompt: string): Promise<void> {
  const composer = page.getByRole('textbox', { name: /enter a prompt for gemini/i });
  await composer.fill(prompt);
  await page.getByRole('button', { name: /send message/i }).click();
  await expectModal(page);
  await page.locator('[data-testid="deliberate-mode-option-delegation"]').click();
  await expect(page.locator('#native-send-state')).toHaveText('sent');
}

async function sendLearningPrompt(page: import('@playwright/test').Page, prompt: string, initialContext: string): Promise<void> {
  const composer = page.getByRole('textbox', { name: /enter a prompt for gemini/i });
  await composer.fill(prompt);
  await page.getByRole('button', { name: /send message/i }).click();
  await expectModal(page);
  await page.locator('[data-testid="deliberate-mode-option-learning"]').click();
  await page.locator('[data-testid="deliberate-mode-detail-input"]').fill(initialContext);
  await page.locator('[data-testid="deliberate-mode-continue"]').click();
  await expect(page.locator('#native-send-state')).toHaveText('sent');
}

async function sendPromptExpectBypass(page: import('@playwright/test').Page, prompt: string): Promise<void> {
  const composer = page.getByRole('textbox', { name: /enter a prompt for gemini/i });
  await composer.fill(prompt);
  await composer.press('Enter');
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

test('local harness gates reflection hint on due status and scopes it per thread', async ({}, testInfo) => {
  test.skip(!fs.existsSync(path.join(extensionPath, 'manifest.json')), 'Run `npm run build` first to create .output/chrome-mv3.');

  const userDataDir = path.resolve(process.cwd(), `.tmp/playwright-thread-hint-${testInfo.workerIndex}-${Date.now()}`);
  const context = await launchExtensionContext(userDataDir);
  let page: import('@playwright/test').Page | undefined;
  try {
    await clearRecords(context);
    const nowMs = 1_800_000_000_000;
    page = await setupHarness(context, primaryThreadUrl, nowMs);
    if (!page) throw new Error('Expected harness page');
    const harnessPage = page;

    await sendLearningPrompt(
      harnessPage,
      'Teach me the tradeoffs of staged rollouts',
      'I already know the basic feature-flag rollout pattern.'
    );
    await expectHintHidden(harnessPage);

    await setHarnessNow(harnessPage, nowMs + 5 * 60 * 1000 + 1_000);
    await expect
      .poll(async () => harnessPage.locator('[data-testid="deliberate-reflection-hint"]').count())
      .toBe(1);
    await expectHintVisible(harnessPage);

    await navigateThreadInPlace(harnessPage, secondaryThreadUrl);
    await expectHintHidden(harnessPage);

    await resetNativeSendState(harnessPage);
    await sendDelegationPrompt(harnessPage, 'New thread should require one initial mode selection');
    await expectHintHidden(harnessPage);

    await navigateThreadInPlace(harnessPage, tertiaryThreadUrl);
    await resetNativeSendState(harnessPage);
    await sendProblemSolvingPrompt(
      harnessPage,
      'How should I phase this rollout?',
      'Start with a feature flag, release to a small cohort first, watch explicit rollback signals, and expand only after the metrics stay healthy.'
    );
    await expectHintHidden(harnessPage);

    await resetNativeSendState(harnessPage);
    await sendPromptExpectBypass(harnessPage, 'follow-up prompt 1');
    await expectHintHidden(harnessPage);

    await resetNativeSendState(harnessPage);
    await sendPromptExpectBypass(harnessPage, 'follow-up prompt 2');
    await expectHintHidden(harnessPage);

    await resetNativeSendState(harnessPage);
    await sendPromptExpectBypass(harnessPage, 'follow-up prompt 3');
    await expectHintVisible(harnessPage);

    await expect
      .poll(async () =>
        harnessPage.evaluate(() => {
          const hint = document.querySelector('[data-testid="deliberate-reflection-hint"]');
          const anchor = hint?.parentElement;
          return {
            hintParentTag: anchor?.tagName || null,
            anchored: anchor?.classList.contains('deliberate-reflection-hint-anchor') || false,
            anchorIsInputArea: anchor?.classList.contains('input-area') || false
          };
        })
      )
      .toEqual({
        hintParentTag: 'DIV',
        anchored: true,
        anchorIsInputArea: true
      });

    await harnessPage.locator('[data-testid="deliberate-reflection-hint-review"]').click();
    await expectReflectionModal(harnessPage);
    await harnessPage.locator('[data-testid="deliberate-reflection-cancel"]').click();
    await expect(harnessPage.locator('[data-testid="deliberate-reflection-modal"]')).toHaveCount(0);
    await expectHintVisible(harnessPage);

    await navigateThreadInPlace(harnessPage, secondaryThreadUrl);
    await expectHintHidden(harnessPage);

    await navigateThreadInPlace(harnessPage, primaryThreadUrl);
    await expectHintVisible(harnessPage);
  } finally {
    if (page) {
      await clearHarnessNow(page);
    }
    await context.close();
  }
});

test('local harness shows historical due hint without persisted turn counters and only in eligible threads', async ({}, testInfo) => {
  test.skip(!fs.existsSync(path.join(extensionPath, 'manifest.json')), 'Run `npm run build` first to create .output/chrome-mv3.');

  const userDataDir = path.resolve(process.cwd(), `.tmp/playwright-thread-historical-hint-${testInfo.workerIndex}-${Date.now()}`);
  const context = await launchExtensionContext(userDataDir);
  let page: import('@playwright/test').Page | undefined;
  try {
    await clearRecords(context);

    const nowMs = 1_900_000_000_000;
    await writeRecords(context, [
      {
        id: 'historical-learning',
        timestamp: nowMs - 6 * 60 * 1000,
        platform: 'gemini',
        threadId: '/app/threads/test-thread',
        mode: 'learning',
        prompt: 'Explain when staged rollouts are counterproductive',
        priorKnowledgeNote: 'I know the basics of feature flags already.'
      },
      {
        id: 'historical-delegation',
        timestamp: nowMs - 6 * 60 * 1000,
        platform: 'gemini',
        threadId: '/app/threads/another-thread',
        mode: 'delegation',
        prompt: 'Write the rollout plan for me'
      }
    ]);

    page = await setupHarness(context, primaryThreadUrl, nowMs);
    if (!page) throw new Error('Expected harness page');

    await expectHintVisible(page);

    await navigateThreadInPlace(page, secondaryThreadUrl);
    await expectHintHidden(page);

    await navigateThreadInPlace(page, primaryThreadUrl);
    await expectHintVisible(page);
  } finally {
    if (page) {
      await clearHarnessNow(page);
    }
    await context.close();
  }
});

test('local harness submits a due reflection and persists completion for an active-thread path', async ({}, testInfo) => {
  test.skip(!fs.existsSync(path.join(extensionPath, 'manifest.json')), 'Run `npm run build` first to create .output/chrome-mv3.');

  const userDataDir = path.resolve(process.cwd(), `.tmp/playwright-thread-reflection-active-${testInfo.workerIndex}-${Date.now()}`);
  const context = await launchExtensionContext(userDataDir);
  try {
    const page = await setupHarness(context, tertiaryThreadUrl);
    await clearRecords(context);

    await sendProblemSolvingPrompt(
      page,
      'How should I phase this rollout?',
      'Start with a feature flag, release to a small cohort first, watch explicit rollback signals, and expand only after the metrics stay healthy.'
    );
    await expectHintHidden(page);

    await resetNativeSendState(page);
    await sendPromptExpectBypass(page, 'follow-up prompt 1');
    await expectHintHidden(page);

    await resetNativeSendState(page);
    await sendPromptExpectBypass(page, 'follow-up prompt 2');
    await expectHintHidden(page);

    await resetNativeSendState(page);
    await sendPromptExpectBypass(page, 'follow-up prompt 3');
    await expectHintVisible(page);

    await page.locator('[data-testid="deliberate-reflection-hint-review"]').click();
    await submitReflection(
      page,
      '75',
      'I should make rollback signals explicit before I compare rollout shapes.'
    );
    await expectHintHidden(page);

    await expect
      .poll(async () => {
        const records = await readReflectionRecords(context);
        return records;
      })
      .toEqual([
        expect.objectContaining({
          threadId: '/app/threads/turn-threshold-thread',
          learningCycleRecordId: expect.any(String),
          status: 'completed',
          score: 75,
          notes: 'I should make rollback signals explicit before I compare rollout shapes.'
        })
      ]);

    await navigateThreadInPlace(page, secondaryThreadUrl);
    await expectHintHidden(page);

    await navigateThreadInPlace(page, tertiaryThreadUrl);
    await expectHintHidden(page);
  } finally {
    await context.close();
  }
});

test('local harness submits a due reflection and persists completion for a historical path', async ({}, testInfo) => {
  test.skip(!fs.existsSync(path.join(extensionPath, 'manifest.json')), 'Run `npm run build` first to create .output/chrome-mv3.');

  const userDataDir = path.resolve(process.cwd(), `.tmp/playwright-thread-reflection-historical-${testInfo.workerIndex}-${Date.now()}`);
  const context = await launchExtensionContext(userDataDir);
  let page: import('@playwright/test').Page | undefined;
  try {
    await clearRecords(context);

    const nowMs = 1_900_000_000_000;
    await writeRecords(context, [
      {
        id: 'historical-learning',
        timestamp: nowMs - 6 * 60 * 1000,
        platform: 'gemini',
        threadId: '/app/threads/test-thread',
        mode: 'learning',
        prompt: 'Explain when staged rollouts are counterproductive',
        priorKnowledgeNote: 'I know the basics of feature flags already.'
      }
    ]);

    page = await setupHarness(context, primaryThreadUrl, nowMs);
    if (!page) throw new Error('Expected harness page');
    await expectHintVisible(page);

    await page.locator('[data-testid="deliberate-reflection-hint-review"]').click();
    await submitReflection(page, '50');
    await expectHintHidden(page);

    await expect
      .poll(async () => {
        const records = await readReflectionRecords(context);
        return records;
      })
      .toEqual([
        expect.objectContaining({
          threadId: '/app/threads/test-thread',
          learningCycleRecordId: 'historical-learning',
          status: 'completed',
          score: 50
        })
      ]);

    await navigateThreadInPlace(page, secondaryThreadUrl);
    await expectHintHidden(page);

    await navigateThreadInPlace(page, primaryThreadUrl);
    await expectHintHidden(page);
  } finally {
    if (page) {
      await clearHarnessNow(page);
    }
    await context.close();
  }
});

test('local harness bypasses modal in a fresh browser context when thread already has entry', async ({}, testInfo) => {
  test.skip(!fs.existsSync(path.join(extensionPath, 'manifest.json')), 'Run `npm run build` first to create .output/chrome-mv3.');

  const runId = `${testInfo.workerIndex}-${Date.now()}`;
  const firstUserDataDir = path.resolve(process.cwd(), `.tmp/playwright-thread-once-seed-${runId}`);
  const secondUserDataDir = path.resolve(process.cwd(), `.tmp/playwright-thread-once-fresh-${runId}`);
  let seededRecords: unknown[] = [];

  {
    const firstContext = await launchExtensionContext(firstUserDataDir);
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
      seededRecords = await readRecords(firstContext);
    } finally {
      await firstContext.close();
    }
  }

  {
    const secondContext = await launchExtensionContext(secondUserDataDir);
    try {
      await writeRecords(secondContext, seededRecords);
      const page = await setupHarness(secondContext, primaryThreadUrl);
      await resetNativeSendState(page);
      await sendPromptExpectBypass(page, 'Fresh browser context should still bypass modal');
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
    await expect(page.getByText('A quiet view of your thinking')).toBeVisible();

    await expect(page.getByText('This should not render because it is out of range')).toHaveCount(0);
    await expect(page.getByText('Your Hypothesis')).toBeVisible();
    await expect(page.getByText('No hypothesis recorded.')).toBeVisible();
    await expect(page.getByText('Starting Point')).toBeVisible();
    await expect(page.getByText('I already know OAuth basics')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download full history as CSV' })).toBeVisible();

    await page.getByRole('button', { name: 'Learning' }).click();
    await expect(page.locator('[data-testid="thinking-journal-card"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="thinking-journal-card-mode-badge-label"]')).toHaveText('Learning');
    await expect(page.locator('[data-testid="thinking-journal-card-mode-badge-label"]').getByText('Problem-Solving')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Download full history as CSV' })).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('thinking journal exports full history as csv', async ({}, testInfo) => {
  test.skip(!fs.existsSync(path.join(extensionPath, 'manifest.json')), 'Run `npm run build` first to create .output/chrome-mv3.');

  const userDataDir = path.resolve(process.cwd(), `.tmp/playwright-thinking-journal-export-${testInfo.workerIndex}-${Date.now()}`);
  const context = await launchExtensionContext(userDataDir);
  try {
    await clearRecords(context);

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    await writeRecords(context, [
      {
        id: 'recent-learning',
        timestamp: now - dayMs,
        platform: 'gemini',
        threadId: '/app/threads/test-thread',
        mode: 'learning',
        prompt: 'Explain OAuth PKCE simply',
        priorKnowledgeNote: 'I already know OAuth basics'
      },
      {
        id: 'old-problem',
        timestamp: now - 10 * dayMs,
        platform: 'gemini',
        threadId: '/app/threads/old-thread',
        mode: 'problem_solving',
        prompt: 'Diagnose the auth outage',
        prediction: 'Tokens might be expired'
      }
    ]);

    const sw = await getServiceWorker(context);
    await sw.evaluate(
      async ({ storageKey, nextRecords }) => {
        const chromeApi = (globalThis as { chrome?: { storage?: { local?: { set: (items: Record<string, unknown>) => Promise<void> } } } }).chrome;
        await chromeApi?.storage?.local?.set({ [storageKey]: nextRecords });
      },
      {
        storageKey: REFLECTIONS_STORAGE_KEY,
        nextRecords: [
          {
            id: 'reflection-1',
            timestamp: now - dayMs / 2,
            threadId: '/app/threads/old-thread',
            learningCycleRecordId: 'old-problem',
            status: 'completed',
            score: 75,
            notes: 'It was token expiry.'
          }
        ]
      }
    );

    const extensionId = await getExtensionId(context);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/thinking-journal.html`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Diagnose the auth outage')).toHaveCount(0);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download full history as CSV' }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    const csv = downloadPath ? fs.readFileSync(downloadPath, 'utf8') : '';

    expect(await download.suggestedFilename()).toMatch(/^thinking-journal-history-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv).toContain('entry_timestamp_iso,mode,prompt,starting_point,reflection_timestamp_iso,surprise_score,reflection_notes');
    expect(csv).toContain('Explain OAuth PKCE simply');
    expect(csv).toContain('Diagnose the auth outage');
    expect(csv).toContain('Tokens might be expired');
    expect(csv).toContain('It was token expiry.');
  } finally {
    await context.close();
  }
});
