import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThinkingJournalApp } from '../../src/thinking-journal/thinking-journal-app';
import * as thinkingJournalStore from '../../src/thinking-journal/thinking-journal-store';
import type { ThinkingJournalEntryRecord } from '../../src/thinking-journal/utils/entry-record';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function makeLongPrompt(): string {
  return 'This is a long prompt '.repeat(40).trim();
}

function makeEntries(): ThinkingJournalEntryRecord[] {
  return [
    {
      id: 'a',
      occurredAt: Date.UTC(2026, 2, 2, 16, 42, 0),
      url: 'https://gemini.google.com/app/threads/problem-a',
      mode: 'problem_solving',
      prompt: makeLongPrompt(),
      startingPoint: 'I suspect query caching is stale.',
      reflections: [{
        occurredAt: Date.UTC(2026, 2, 3, 9, 15, 0),
        score: 75,
        notes: 'The real issue was token expiration, not cache invalidation.'
      }]
    },
    {
      id: 'b',
      occurredAt: Date.UTC(2026, 2, 2, 12, 0, 0),
      url: 'https://gemini.google.com/app/threads/learning-b',
      mode: 'learning',
      prompt: 'Explain OAuth PKCE simply.',
      startingPoint: 'I know basic OAuth terms.',
      reflections: []
    },
    {
      id: 'c',
      occurredAt: Date.UTC(2026, 2, 1, 8, 0, 0),
      mode: 'delegation',
      prompt: 'Draft this status update.',
      reflections: []
    }
  ];
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function makeExportRows(): ThinkingJournalEntryRecord[] {
  return [
    {
      id: 'history-a',
      occurredAt: Date.UTC(2026, 2, 2, 16, 42, 0),
      mode: 'problem_solving',
      prompt: 'Investigate the auth outage',
      startingPoint: 'Tokens might be expired.',
      reflections: [{
        occurredAt: Date.UTC(2026, 2, 3, 9, 15, 0),
        score: 75,
        notes: 'It was token expiry.'
      }]
    },
    {
      id: 'history-b',
      occurredAt: Date.UTC(2026, 1, 20, 12, 0, 0),
      mode: 'delegation',
      prompt: 'Draft this status update.',
      reflections: []
    }
  ];
}

async function render(
  entries: ThinkingJournalEntryRecord[],
  props: Partial<React.ComponentProps<typeof ThinkingJournalApp>> = {}
): Promise<void> {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const loadPage = props.loadPage ?? vi.fn(async () => ({ recentEntries: entries }));
  await act(async () => {
    root?.render(<ThinkingJournalApp {...props} loadPage={loadPage} />);
  });
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

describe('ThinkingJournalApp', () => {
  it('uses Tailwind utility classes for layout and controls', async () => {
    await render(makeEntries());

    const main = document.querySelector('main');
    expect(main).toBeTruthy();
    expect(main?.className).toContain('max-w-[860px]');
    expect(main?.className).toContain('px-5');
    expect(main?.className).toContain('font-journal');

    const filterShell = document.querySelector('[aria-label="Thinking Journal filters"]');
    expect(filterShell).toBeTruthy();
    expect(filterShell?.className).toContain('border-b');
    expect(filterShell?.className).not.toContain('bg-[#fafbfd]');

    const filterGroups = document.querySelector('[data-testid="thinking-journal-filter-groups"]');
    expect(filterGroups).toBeTruthy();
    expect(filterGroups?.className).toContain('justify-between');

    const allFilter = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('All'));
    expect(allFilter).toBeTruthy();
    expect(allFilter?.className).toContain('rounded-[15px]');
    expect(allFilter?.className).toContain('bg-white');
    expect(allFilter?.className).not.toContain('border-[#d6e0ea]');
    expect(allFilter?.className).toContain('text-[#2f4257]');
    expect(allFilter?.className).toContain('font-semibold');
    expect(allFilter?.className).toContain('font-journal');

    const delegationFilter = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Delegation')
    );
    expect(delegationFilter).toBeTruthy();
    expect(delegationFilter?.className).toContain('hover:bg-white');
    expect(delegationFilter?.className).toContain('hover:text-[#2f4257]');
    expect(delegationFilter?.className).not.toContain('hover:border-[#d6e0ea]');

    const delegationEmoji = document.querySelector('[data-testid="thinking-journal-filter-emoji-delegation"]');
    expect(delegationEmoji).toBeTruthy();
    expect(delegationEmoji?.className).toContain('text-[0.88rem]');
    expect(delegationEmoji?.className).toContain('[filter:grayscale(0.45)_saturate(0.55)]');
    expect(delegationEmoji?.className).toContain('group-hover:[filter:none]');

    const reflectionOnlyFilter = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'With reflection');
    expect(reflectionOnlyFilter).toBeTruthy();
    expect(reflectionOnlyFilter?.parentElement?.className).toContain('md:ml-auto');

    const firstCard = document.querySelector('[data-testid="thinking-journal-card"]');
    expect(firstCard?.className).toContain('p-2.5');
  });

  it('renders header and mode badges with requested emojis', async () => {
    await render(makeEntries());

    expect(document.body.textContent).toContain('Thinking Journal');
    expect(document.body.textContent).toContain('A quiet view of your thinking');
    expect(
      Array.from(document.querySelectorAll('button')).some((button) => button.textContent?.includes('Problem-Solving'))
    ).toBe(true);
    expect(Array.from(document.querySelectorAll('button')).some((button) => button.textContent?.includes('Delegation'))).toBe(true);
    expect(Array.from(document.querySelectorAll('button')).some((button) => button.textContent?.includes('Learning'))).toBe(true);
  });

  it('features a returned thought above the recent feed with a prominent Another thought action', async () => {
    const featuredEntry: ThinkingJournalEntryRecord = {
      ...makeEntries()[0]!,
      id: 'featured',
      prompt: 'Historical featured prompt',
      occurredAt: Date.UTC(2026, 1, 1)
    };
    await render(makeEntries(), {
      loadPage: async () => ({ recentEntries: makeEntries(), featuredEntry })
    });

    const featured = document.querySelector('[data-testid="thinking-journal-featured"]');
    const recent = document.querySelector('[data-testid="thinking-journal-recent"]');
    expect(featured?.textContent).toContain('A thought returned');
    expect(featured?.textContent).toContain('Historical featured prompt');
    expect(recent?.textContent).toContain('Recent thinking — Last 7 days');
    if (!featured || !recent) throw new Error('Expected featured and recent journal sections');
    expect(featured.compareDocumentPosition(recent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const returnedHeading = featured.querySelector('[data-testid="thinking-journal-featured-heading"]');
    const recentHeading = recent.querySelector('h2');
    expect(returnedHeading?.className).toContain('text-[1rem]');
    expect(recentHeading?.className).toContain('text-[1rem]');
    const anotherThought = Array.from(featured.querySelectorAll('button')).find(
      (button) => button.textContent === 'Another thought'
    );
    expect(anotherThought).toBeTruthy();
    expect(anotherThought?.className).toContain('appearance-none');
    expect(anotherThought?.className).toContain('rounded-[14px]');
    expect(anotherThought?.className).toContain('border-solid');
    expect(anotherThought?.className).toContain('border-[#e1e3e6]');
    expect(anotherThought?.className).toContain('bg-white');
    expect(anotherThought?.className).toContain('font-medium');
    expect(anotherThought?.className).not.toContain('font-semibold');
    expect(anotherThought?.className).toContain('shadow-none');
    expect(anotherThought?.className).toContain('text-[#52657e]');
    expect(anotherThought?.className).toContain('order-2');
    expect(anotherThought?.parentElement?.className).toContain('justify-end');
  });

  it('optimistically toggles suppression only on the featured card without replacing it or its URL', async () => {
    const featuredEntry: ThinkingJournalEntryRecord = {
      ...makeEntries()[0]!,
      id: 'featured',
      prompt: 'Keep this thought visible'
    };
    const setSuppressed = vi.fn(async () => undefined);
    window.history.replaceState({}, '', '/thinking-journal.html?featured=featured');
    await render(makeEntries(), {
      loadPage: async () => ({ recentEntries: makeEntries(), featuredEntry }),
      setSuppressed
    });

    expect(document.querySelector('[data-testid="thinking-journal-recent"]')?.textContent).not.toContain('Don’t resurface this');
    const action = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('Don’t resurface this'));
    const anotherThought = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Another thought');
    const featuredCard = action?.closest('[data-testid="thinking-journal-card"]');
    const reflectAgain = Array.from(featuredCard?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent === 'Reflect again'
    );
    expect(featuredCard).toBeTruthy();
    expect(action?.closest('[data-testid="thinking-journal-featured"]')).toBeTruthy();
    expect(action?.parentElement).toBe(reflectAgain?.parentElement);
    expect(action?.parentElement?.getAttribute('data-testid')).toBe('thinking-journal-featured-card-actions');
    expect(action?.parentElement).not.toBe(anotherThought?.parentElement);
    expect(action?.className).toContain('border-[#e1e3e6]');
    expect(action?.className).toContain('font-medium');
    expect(action?.className).not.toContain('font-semibold');
    expect(action?.className).toContain('text-[#52657e]');
    expect(action?.className).toContain('shadow-none');
    expect(action?.textContent).toBe('Don’t resurface this');
    await act(async () => action?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(setSuppressed).toHaveBeenCalledWith('featured', true);
    expect(document.querySelector('[data-testid="thinking-journal-featured"]')?.textContent).toContain('Keep this thought visible');
    expect(document.body.textContent).toContain('Allow resurfacing');
    expect(window.location.search).toBe('?featured=featured');

    const allowAction = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('Allow resurfacing'));
    await act(async () => allowAction?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(setSuppressed).toHaveBeenLastCalledWith('featured', false);
    expect(document.body.textContent).toContain('Don’t resurface this');
  });

  it('logs suppression failures without showing recovery UI', async () => {
    const error = new Error('storage failed');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await render([], {
      loadPage: async () => ({ recentEntries: [], featuredEntry: { ...makeEntries()[0]!, id: 'featured' } }),
      setSuppressed: vi.fn(async () => { throw error; })
    });

    const action = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('Don’t resurface this'));
    await act(async () => action?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(consoleError).toHaveBeenCalledWith('Failed to update resurfacing suppression.', error);
    expect(document.body.textContent).toContain('Don’t resurface this');
    expect(document.body.textContent).not.toContain('Allow resurfacing');
    expect(document.body.textContent).not.toContain('Try again');
    consoleError.mockRestore();
  });

  it('replaces the featured card and URL with another presented thought', async () => {
    const firstFeaturedEntry: ThinkingJournalEntryRecord = {
      ...makeEntries()[0]!,
      id: 'featured-first',
      prompt: 'First returned thought'
    };
    const nextFeaturedEntry: ThinkingJournalEntryRecord = {
      ...makeEntries()[1]!,
      id: 'featured-next',
      prompt: 'Next returned thought'
    };
    const loadPage = vi
      .fn<(featuredEntryId: string | undefined) => Promise<thinkingJournalStore.ThinkingJournalPage>>()
      .mockResolvedValueOnce({ recentEntries: makeEntries(), featuredEntry: firstFeaturedEntry })
      .mockResolvedValueOnce({ recentEntries: makeEntries(), featuredEntry: nextFeaturedEntry });
    const presentNext = vi.fn(async () => ({
      learningCycleId: 'featured-next',
      excerpt: 'Next returned thought'
    }));
    window.history.replaceState({}, '', '/thinking-journal.html?featured=featured-first');

    await render([], { featuredEntryId: 'featured-first', loadPage, presentNext });
    const anotherThought = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Another thought'
    );
    await act(async () => {
      anotherThought?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(presentNext).toHaveBeenCalledWith();
    expect(loadPage).toHaveBeenLastCalledWith('featured-next');
    expect(document.querySelector('[data-testid="thinking-journal-featured"]')?.textContent).toContain(
      'Next returned thought'
    );
    expect(document.querySelector('[data-testid="thinking-journal-featured"]')?.textContent).not.toContain(
      'First returned thought'
    );
    expect(window.location.search).toBe('?featured=featured-next');
  });

  it('retains the featured card and offers retry when another thought cannot be presented', async () => {
    const firstFeaturedEntry: ThinkingJournalEntryRecord = {
      ...makeEntries()[0]!,
      id: 'featured-first',
      prompt: 'Keep this returned thought'
    };
    const nextFeaturedEntry: ThinkingJournalEntryRecord = {
      ...makeEntries()[1]!,
      id: 'featured-next',
      prompt: 'Retry found this thought'
    };
    const loadPage = vi
      .fn<(featuredEntryId: string | undefined) => Promise<thinkingJournalStore.ThinkingJournalPage>>()
      .mockResolvedValueOnce({ recentEntries: makeEntries(), featuredEntry: firstFeaturedEntry })
      .mockResolvedValueOnce({ recentEntries: makeEntries(), featuredEntry: nextFeaturedEntry });
    const presentNext = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ learningCycleId: 'featured-next', excerpt: 'Retry found this thought' });

    await render([], { featuredEntryId: 'featured-first', loadPage, presentNext });
    let anotherThought = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Another thought'
    );
    await act(async () => {
      anotherThought?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('[data-testid="thinking-journal-featured"]')?.textContent).toContain(
      'Keep this returned thought'
    );
    expect(document.querySelector('[data-testid="thinking-journal-another-error"]')?.textContent).toContain('Try again');

    anotherThought = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Another thought'
    );
    await act(async () => {
      anotherThought?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('[data-testid="thinking-journal-featured"]')?.textContent).toContain(
      'Retry found this thought'
    );
    expect(document.querySelector('[data-testid="thinking-journal-another-error"]')).toBeNull();
  });

  it('keeps the featured thought visible when recent-feed filters change', async () => {
    const featuredEntry: ThinkingJournalEntryRecord = {
      ...makeEntries()[0]!,
      id: 'featured',
      prompt: 'Historical featured prompt'
    };
    await render(makeEntries(), {
      loadPage: async () => ({ recentEntries: makeEntries(), featuredEntry })
    });

    const learningFilter = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Learning')
    );
    act(() => learningFilter?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(document.querySelector('[data-testid="thinking-journal-featured"]')?.textContent).toContain(
      'Historical featured prompt'
    );
    expect(document.querySelectorAll('[data-testid="thinking-journal-recent"] [data-testid="thinking-journal-card"]')).toHaveLength(1);
  });

  it('renders an in-card reflection section when reflection data is present', async () => {
    await render(makeEntries());

    const dateTitle = document.querySelector('[data-testid="thinking-journal-date-title"]');
    expect(dateTitle).toBeTruthy();
    expect(dateTitle?.className).toContain('text-[1rem]');
    expect(dateTitle?.className).toContain('text-[#707b88]');

    const promptTitle = document.querySelector('[data-testid="thinking-journal-prompt-title"]');
    expect(promptTitle).toBeTruthy();
    expect(promptTitle?.textContent).toContain('This is a long prompt');

    const cardHeader = document.querySelector('[data-testid="thinking-journal-card-header"]');
    expect(cardHeader).toBeTruthy();
    expect(cardHeader?.className).toContain('items-center');

    const headerBadge = document.querySelector('[data-testid="thinking-journal-card-mode-badge"]');
    expect(headerBadge).toBeTruthy();
    expect(headerBadge?.textContent).toContain('Problem-Solving');
    expect(headerBadge?.className).toContain('rounded-[15px]');
    expect(headerBadge?.className).toContain('bg-[#f7f9fb]');
    expect(headerBadge?.className).not.toContain('border-[#e9eef3]');
    expect(headerBadge?.className).toContain('text-[#5f7182]');
    expect(headerBadge?.className).toContain('font-medium');
    expect(headerBadge?.className).toContain('text-[0.92rem]');

    const headerBadgeGroup = document.querySelector('[data-testid="thinking-journal-card-badge-group"]');
    expect(headerBadgeGroup).toBeTruthy();
    expect(headerBadgeGroup?.contains(headerBadge as Node)).toBe(true);

    const headerBadgeLabel = document.querySelector('[data-testid="thinking-journal-card-mode-badge-label"]');
    expect(headerBadgeLabel).toBeTruthy();

    const headerBadgeEmoji = document.querySelector('[data-testid="thinking-journal-card-mode-badge-emoji"]');
    expect(headerBadgeEmoji).toBeTruthy();
    expect(headerBadgeEmoji?.className).toContain('text-[0.88rem]');

    const columns = document.querySelector('[data-testid="thinking-journal-card-columns"]');
    expect(columns).toBeTruthy();
    expect(columns?.className).toContain('md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.88fr)]');

    const supportingColumn = document.querySelector('[data-testid="thinking-journal-supporting-column"]');
    expect(supportingColumn).toBeTruthy();
    expect(supportingColumn?.className).toContain('gap-2');

    const reflectionSection = document.querySelector('[data-testid="thinking-journal-reflection"]');
    expect(reflectionSection).toBeTruthy();
    expect(reflectionSection?.textContent).toContain('Reflections');
    expect(reflectionSection?.textContent).toContain('The real issue was token expiration, not cache invalidation.');
    expect(reflectionSection?.textContent).not.toContain('Reflected');
    expect(reflectionSection?.textContent).not.toContain('Update 75');
    expect(reflectionSection?.textContent).not.toContain('75');

    const reflectionHeader = document.querySelector('[data-testid="thinking-journal-reflection-header"]');
    expect(reflectionHeader).toBeTruthy();
    expect(reflectionHeader?.className).not.toContain('items-center');
    expect(reflectionHeader?.className).not.toContain('gap-1');

    const reflectionSpark = document.querySelector('[data-testid="thinking-journal-reflection-spark"]');
    expect(reflectionSpark).toBeTruthy();
    expect(reflectionSpark?.getAttribute('data-level')).toBe('4');
    expect(reflectionSpark?.className).toContain('h-5');
    expect(headerBadgeGroup?.contains(reflectionSpark as Node)).toBe(false);
    expect(headerBadge?.contains(reflectionSpark)).toBe(false);
    expect(reflectionHeader?.contains(reflectionSpark)).toBe(false);
    expect(reflectionSection?.contains(reflectionSpark as Node)).toBe(true);

    const reflectionNotes = document.querySelector('[data-testid="thinking-journal-reflection-notes"]');
    expect(reflectionNotes?.className).toContain('text-[#213040]');
    expect(reflectionNotes?.className).toContain('leading-[1.6]');
    expect(reflectionNotes?.className).not.toContain('mt-1.5');
    expect(reflectionNotes?.className).not.toContain('text-[1rem]');
    expect(document.body.textContent).not.toContain('PromptExplain OAuth PKCE simply.');
  });

  it('renders the prompt as a link when an entry URL is available', async () => {
    await render(makeEntries());

    const promptLink = document.querySelector('[data-testid="thinking-journal-entry-link"]');
    expect(promptLink).toBeTruthy();
    expect(promptLink?.getAttribute('href')).toBe('https://gemini.google.com/app/threads/problem-a');
    expect(promptLink?.getAttribute('target')).toBe('_blank');
    expect(promptLink?.className).toContain('no-underline');
    expect(promptLink?.getAttribute('aria-label')).toBe('Open chat from Mar 2');

    const promptLinkIcon = document.querySelector('[data-testid="thinking-journal-entry-link-icon"]');
    expect(promptLinkIcon).toBeTruthy();
    expect(promptLinkIcon?.textContent).toBe('↗');
  });

  it('does not show a spark in the mode badge when there is no reflection', async () => {
    await render(makeEntries());

    const cards = Array.from(document.querySelectorAll('[data-testid="thinking-journal-card"]'));
    const learningCard = cards.find((card) => card.textContent?.includes('Learning'));
    expect(learningCard).toBeTruthy();

    const learningBadge = learningCard?.querySelector('[data-testid="thinking-journal-card-mode-badge"]');
    expect(learningBadge).toBeTruthy();
    expect(learningBadge?.querySelector('[data-testid="thinking-journal-reflection-spark"]')).toBeNull();
  });

  it('toggles long prompt expansion with Show more', async () => {
    await render(makeEntries());

    const toggle = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Show more');
    expect(toggle).toBeTruthy();

    act(() => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.textContent).toContain('Show less');
  });

  it('filters entries by selected mode', async () => {
    await render(makeEntries());

    const learningFilter = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('Learning'));
    expect(learningFilter).toBeTruthy();

    act(() => {
      learningFilter?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const cards = document.querySelectorAll('[data-testid="thinking-journal-card"]');
    expect(cards).toHaveLength(1);
    expect(cards[0]?.textContent).toContain('Learning');
    expect(cards[0]?.textContent).not.toContain('😌 Delegation');
  });

  it('can restrict the list to entries with reflections only', async () => {
    await render(makeEntries());

    const reflectionOnlyFilter = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'With reflection');
    expect(reflectionOnlyFilter).toBeTruthy();

    act(() => {
      reflectionOnlyFilter?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const cards = document.querySelectorAll('[data-testid="thinking-journal-card"]');
    expect(cards).toHaveLength(1);
    expect(cards[0]?.textContent).toContain('Problem-Solving');
    expect(cards[0]?.querySelector('[data-testid="thinking-journal-card-mode-badge-label"]')?.textContent).toBe(
      'Problem-Solving'
    );
  });

  it('applies reflection-only filtering on top of the selected mode filter', async () => {
    await render(makeEntries());

    const learningFilter = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('Learning'));
    const reflectionOnlyFilter = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'With reflection');

    act(() => {
      learningFilter?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      reflectionOnlyFilter?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelectorAll('[data-testid="thinking-journal-card"]')).toHaveLength(0);
    expect(document.body.textContent).toContain('No entries in the last 7 days.');
  });

  it('loads an empty page through loadPage', async () => {
    const loadPage = vi.fn(async () => ({ recentEntries: [] }));
    const loadExportRows = vi.fn(async () => []);
    await render([], { loadPage, loadExportRows });

    expect(document.body.textContent).not.toContain('Loading entries...');
    expect(document.body.textContent).toContain('No entries in the last 7 days.');
    expect(loadPage).toHaveBeenCalledWith(undefined);
    expect(loadExportRows).not.toHaveBeenCalled();
  });

  it('renders the end-of-list CSV export action in the default non-empty feed', async () => {
    await render(makeEntries());

    expect(Array.from(document.querySelectorAll('button')).some((button) => button.textContent === 'Download full history as CSV')).toBe(true);
  });

  it('renders the CSV export action when only historical entries exist outside the 7-day feed', async () => {
    await render([], { loadExportRows: async () => makeExportRows() });
    expect(document.body.textContent).toContain('No entries in the last 7 days.');
    expect(Array.from(document.querySelectorAll('button')).some((button) => button.textContent === 'Download full history as CSV')).toBe(true);
  });

  it('loads the page on mount and defers export history until click', async () => {
    const loadPageSpy = vi.spyOn(thinkingJournalStore, 'loadThinkingJournalPage').mockResolvedValue({ recentEntries: [] });
    const loadExportRowsSpy = vi.spyOn(thinkingJournalStore, 'loadThinkingJournalExportRows').mockResolvedValue(makeExportRows());

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<ThinkingJournalApp />);
    });

    expect(loadPageSpy).toHaveBeenCalledWith(undefined);
    expect(loadExportRowsSpy).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('No entries in the last 7 days.');
    expect(Array.from(document.querySelectorAll('button')).some((button) => button.textContent === 'Download full history as CSV')).toBe(true);
  });

  it('hides the end-of-list CSV export action outside the default feed state', async () => {
    await render(makeEntries());

    const learningFilter = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('Learning'));
    const reflectionOnlyFilter = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'With reflection');

    act(() => {
      learningFilter?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.textContent).not.toContain('Download full history as CSV');

    act(() => {
      const allFilter = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'All');
      allFilter?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      reflectionOnlyFilter?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.textContent).not.toContain('Download full history as CSV');
  });

  it('downloads a CSV built from full stored history instead of the visible cards', async () => {
    const exportRows = makeExportRows();
    const loadExportRows = vi.fn(async () => exportRows);
    const createObjectURL = vi.fn((blob: Blob) => {
      Object.assign(globalThis, { __lastExportBlob: blob });
      return 'blob:journal-export';
    });
    const revokeObjectURL = vi.fn();
    const clickSpy = vi.fn();
    const anchorClick = HTMLAnchorElement.prototype.click;

    Object.assign(URL, { createObjectURL, revokeObjectURL });
    HTMLAnchorElement.prototype.click = clickSpy;

    try {
      await render(makeEntries(), { loadExportRows });

      const downloadButton = Array.from(document.querySelectorAll('button')).find(
        (button) => button.textContent === 'Download full history as CSV'
      );

      await act(async () => {
        downloadButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(loadExportRows).toHaveBeenCalledOnce();
      expect(createObjectURL).toHaveBeenCalledOnce();
      expect(clickSpy).toHaveBeenCalledOnce();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:journal-export');

      const exportedBlob = (globalThis as { __lastExportBlob?: Blob }).__lastExportBlob;
      expect(exportedBlob).toBeTruthy();
      expect(exportedBlob?.type).toBe('text/csv;charset=utf-8');
    } finally {
      HTMLAnchorElement.prototype.click = anchorClick;
      delete (globalThis as { __lastExportBlob?: Blob }).__lastExportBlob;
    }
  });

  it('renders complete reflection history on every card and offers Reflect again only for the featured card', async () => {
    const recentEntry = {
      id: 'recent-reflected',
      occurredAt: Date.UTC(2026, 2, 4, 12, 0, 0),
      mode: 'learning',
      prompt: 'Recent learning prompt',
      reflections: [
        { occurredAt: Date.UTC(2026, 2, 4, 13, 0, 0), score: 25, notes: 'Recent reflection' }
      ]
    } as unknown as ThinkingJournalEntryRecord;
    const featuredEntry = {
      id: 'featured-reflected',
      occurredAt: Date.UTC(2026, 1, 20, 12, 0, 0),
      mode: 'problem_solving',
      prompt: 'Historical problem',
      startingPoint: 'The cache is stale.',
      reflections: [
        { occurredAt: Date.UTC(2026, 1, 21, 9, 0, 0), score: 25, notes: 'First reflection' },
        { occurredAt: Date.UTC(2026, 2, 1, 15, 30, 0), score: 100, notes: 'Second reflection' }
      ]
    } as unknown as ThinkingJournalEntryRecord;

    await render([], {
      featuredEntryId: featuredEntry.id,
      loadPage: async () => ({ recentEntries: [recentEntry], featuredEntry })
    });

    const featured = document.querySelector('[data-testid="thinking-journal-featured"]');
    const recent = document.querySelector('[data-testid="thinking-journal-recent"]');
    expect(featured?.textContent).toContain('First reflection');
    expect(featured?.textContent).toContain('Second reflection');
    expect(featured?.textContent?.indexOf('First reflection')).toBeLessThan(
      featured?.textContent?.indexOf('Second reflection') ?? -1
    );
    expect(recent?.textContent).toContain('Recent reflection');
    expect(featured?.querySelectorAll('[data-testid="thinking-journal-reflection-spark"]')).toHaveLength(2);
    expect(featured?.textContent).toContain('Small update');
    expect(featured?.textContent).toContain('Major update');
    expect(featured?.textContent).not.toContain('Learning delta');
    expect(featured?.textContent).not.toContain('No update — Major update');
    const reflectAgain = Array.from(featured?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent === 'Reflect again'
    );
    expect(reflectAgain?.className).toContain('border-[#e1e3e6]');
    expect(reflectAgain?.className).toContain('rounded-[14px]');
    expect(Array.from(recent?.querySelectorAll('button') ?? []).some((button) => button.textContent === 'Reflect again')).toBe(false);
  });

  it('requires written thoughts and appends a canonical reflection from the inline form', async () => {
    const randomUuid = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('33333333-3333-4333-8333-333333333333');
    const featuredEntry = {
      id: 'featured-reflected',
      occurredAt: Date.UTC(2026, 1, 20, 12, 0, 0),
      mode: 'learning',
      prompt: 'Historical learning prompt',
      reflections: []
    } as unknown as ThinkingJournalEntryRecord;
    const appendReflection = vi.fn(async () => undefined);

    await render([], {
      featuredEntryId: featuredEntry.id,
      loadPage: async () => ({ recentEntries: [], featuredEntry }),
      appendReflection,
      now: () => Date.UTC(2026, 2, 5, 10, 45, 0)
    });

    const reflectAgain = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Reflect again'
    );
    act(() => reflectAgain?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const featuredCardActions = document.querySelector('[data-testid="thinking-journal-featured-card-actions"]');
    const persistentReflectAgain = Array.from(featuredCardActions?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent === 'Reflect again'
    );
    expect(persistentReflectAgain).toBeTruthy();
    expect(persistentReflectAgain?.getAttribute('aria-expanded')).toBe('true');
    expect(featuredCardActions?.textContent).toContain('Don’t resurface this');
    const textarea = document.querySelector('[data-testid="thinking-journal-reflect-notes"]') as HTMLTextAreaElement;
    const score = document.querySelector('[data-testid="thinking-journal-reflect-score"]') as HTMLInputElement;
    const save = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Save reflection'
    ) as HTMLButtonElement;
    expect(textarea.placeholder).toBe('Thoughts?');
    expect(textarea.getAttribute('aria-label')).toBe('Thoughts?');
    expect(textarea.className).toContain('box-border');
    expect(textarea.className).toContain('max-w-full');
    expect(textarea.className).toContain('p-3');
    expect(textarea.className).not.toContain('px-4');
    expect(textarea.className).toContain('text-[0.88rem]');
    expect(textarea.className).not.toContain('text-[0.9rem]');
    expect(textarea.className).not.toContain('text-[0.95rem]');
    expect(document.querySelector('#thinking-journal-reflect-heading-featured-reflected')).toBeNull();
    const scoreRow = document.querySelector('[data-testid="thinking-journal-reflect-score-row"]');
    expect(scoreRow?.textContent).toBe('No updateMajor update');
    expect(scoreRow?.className).toContain('items-center');
    expect(scoreRow?.className).toContain('leading-none');
    expect(score.className).toContain('thinking-journal-reflect-score');
    expect(document.body.textContent).not.toContain('How much did your thinking change?');
    expect(document.body.textContent).toContain('No update');
    expect(document.body.textContent).toContain('Major update');
    expect(score.compareDocumentPosition(textarea)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    const editor = textarea.parentElement;
    expect(editor?.className).toContain('px-2');
    expect(save.disabled).toBe(true);

    await act(async () => {
      textarea.value = '  I now think incentives mattered more than process.  ';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      score.value = '100';
      score.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(save.disabled).toBe(false);

    await act(async () => {
      save.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(appendReflection).toHaveBeenCalledWith({
      id: '33333333-3333-4333-8333-333333333333',
      occurredAt: Date.UTC(2026, 2, 5, 10, 45, 0),
      learningCycleId: 'featured-reflected',
      score: 100,
      notes: 'I now think incentives mattered more than process.'
    });
    expect(document.querySelector('[data-testid="thinking-journal-reflect-notes"]')).toBeNull();
    expect(document.querySelector('[data-testid="thinking-journal-featured"]')?.textContent).toContain(
      'I now think incentives mattered more than process.'
    );
    randomUuid.mockRestore();
  });

  it('retains the inline reflection draft after a failed save and discards it when another thought loads', async () => {
    const firstFeatured = {
      id: 'featured-first',
      occurredAt: Date.UTC(2026, 1, 20, 12, 0, 0),
      mode: 'learning',
      prompt: 'First thought',
      reflections: []
    } as unknown as ThinkingJournalEntryRecord;
    const nextFeatured = {
      ...firstFeatured,
      id: 'featured-next',
      prompt: 'Next thought'
    };
    const loadPage = vi
      .fn<(featuredEntryId: string | undefined) => Promise<thinkingJournalStore.ThinkingJournalPage>>()
      .mockResolvedValueOnce({ recentEntries: [], featuredEntry: firstFeatured })
      .mockResolvedValueOnce({ recentEntries: [], featuredEntry: nextFeatured });
    const appendReflection = vi.fn(async () => {
      throw new Error('storage failed');
    });

    await render([], {
      featuredEntryId: firstFeatured.id,
      loadPage,
      appendReflection,
      presentNext: async () => ({ learningCycleId: nextFeatured.id, excerpt: 'Next thought' })
    });

    act(() => {
      Array.from(document.querySelectorAll('button'))
        .find((button) => button.textContent === 'Reflect again')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const textarea = document.querySelector('[data-testid="thinking-journal-reflect-notes"]') as HTMLTextAreaElement;
    await act(async () => {
      textarea.value = 'Keep this draft after failure';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      Array.from(document.querySelectorAll('button'))
        .find((button) => button.textContent === 'Save reflection')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.querySelector('[data-testid="thinking-journal-reflect-error"]')?.textContent).toContain('Try again');
    expect((document.querySelector('[data-testid="thinking-journal-reflect-notes"]') as HTMLTextAreaElement).value).toBe(
      'Keep this draft after failure'
    );

    await act(async () => {
      Array.from(document.querySelectorAll('button'))
        .find((button) => button.textContent === 'Another thought')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.textContent).toContain('Next thought');
    expect(document.querySelector('[data-testid="thinking-journal-reflect-notes"]')).toBeNull();
  });

  it('discards an inline reflection draft when Reflect again collapses the editor and disables the form while saving', async () => {
    const featuredEntry = {
      id: 'featured-controls',
      occurredAt: Date.UTC(2026, 1, 20, 12, 0, 0),
      mode: 'learning',
      prompt: 'Historical learning prompt',
      reflections: []
    } as unknown as ThinkingJournalEntryRecord;
    let finishAppend: (() => void) | undefined;
    const appendReflection = vi.fn(
      () => new Promise<void>((resolve) => {
        finishAppend = resolve;
      })
    );

    await render([], {
      featuredEntryId: featuredEntry.id,
      loadPage: async () => ({ recentEntries: [], featuredEntry }),
      appendReflection
    });

    act(() => {
      Array.from(document.querySelectorAll('button'))
        .find((button) => button.textContent === 'Reflect again')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    let textarea = document.querySelector('[data-testid="thinking-journal-reflect-notes"]') as HTMLTextAreaElement;
    act(() => {
      textarea.value = 'Discard this draft';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      Array.from(document.querySelectorAll('button'))
        .find((button) => button.textContent === 'Reflect again')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.querySelector('[data-testid="thinking-journal-reflect-notes"]')).toBeNull();
    expect(document.body.textContent).not.toContain('Cancel');
    expect(
      Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Reflect again')
        ?.getAttribute('aria-expanded')
    ).toBe('false');

    act(() => {
      Array.from(document.querySelectorAll('button'))
        .find((button) => button.textContent === 'Reflect again')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    textarea = document.querySelector('[data-testid="thinking-journal-reflect-notes"]') as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
    await act(async () => {
      textarea.value = 'Save this thought';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      Array.from(document.querySelectorAll('button'))
        .find((button) => button.textContent === 'Save reflection')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(textarea.disabled).toBe(true);
    expect(Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Saving…')).toBeTruthy();
    expect(
      Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Reflect again')
        ?.hasAttribute('disabled')
    ).toBe(true);
    expect(Array.from(document.querySelectorAll('button')).some((button) => button.textContent === 'Cancel')).toBe(false);

    await act(async () => finishAppend?.());
    expect(document.querySelector('[data-testid="thinking-journal-reflect-notes"]')).toBeNull();
  });
});
