import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThinkingJournalApp } from '../../src/thinking-journal/ThinkingJournalApp';
import * as thinkingJournalStore from '../../src/thinking-journal/thinking-journal-store';
import type { ThinkingJournalEntry } from '../../src/thinking-journal/utils/entries';
import type { ThinkingJournalHistoryRow } from '../../src/thinking-journal/utils/history';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function makeLongPrompt(): string {
  return 'This is a long prompt '.repeat(40).trim();
}

function makeEntries(): ThinkingJournalEntry[] {
  return [
    {
      id: 'a',
      timestamp: Date.UTC(2026, 2, 2, 16, 42, 0),
      mode: 'problem_solving',
      modeLabel: 'Problem-Solving',
      modeEmoji: '🤔',
      prompt: makeLongPrompt(),
      promptIsLong: true,
      hypothesis: 'I suspect query caching is stale.',
      dateLabel: 'Mar 2',
      reflection: {
        timestamp: Date.UTC(2026, 2, 3, 9, 15, 0),
        dateLabel: 'Mar 3',
        score: 75,
        notes: 'The real issue was token expiration, not cache invalidation.'
      }
    },
    {
      id: 'b',
      timestamp: Date.UTC(2026, 2, 2, 12, 0, 0),
      mode: 'learning',
      modeLabel: 'Learning',
      modeEmoji: '🧑‍🎓',
      prompt: 'Explain OAuth PKCE simply.',
      promptIsLong: false,
      initialContext: 'I know basic OAuth terms.',
      dateLabel: 'Mar 2'
    },
    {
      id: 'c',
      timestamp: Date.UTC(2026, 2, 1, 8, 0, 0),
      mode: 'delegation',
      modeLabel: 'Delegation',
      modeEmoji: '😌',
      prompt: 'Draft this status update.',
      promptIsLong: false,
      dateLabel: 'Mar 1'
    }
  ];
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function makeExportRows(): ThinkingJournalHistoryRow[] {
  return [
    {
      id: 'history-a',
      timestamp: Date.UTC(2026, 2, 2, 16, 42, 0),
      mode: 'problem_solving',
      prompt: 'Investigate the auth outage',
      startingPoint: 'Tokens might be expired.',
      reflection: {
        timestamp: Date.UTC(2026, 2, 3, 9, 15, 0),
        score: 75,
        notes: 'It was token expiry.'
      }
    },
    {
      id: 'history-b',
      timestamp: Date.UTC(2026, 1, 20, 12, 0, 0),
      mode: 'delegation',
      prompt: 'Draft this status update.'
    }
  ];
}

function render(
  entries: ThinkingJournalEntry[],
  props: Partial<React.ComponentProps<typeof ThinkingJournalApp>> = {}
): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(<ThinkingJournalApp preloadedEntries={entries} {...props} />);
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
  it('uses Tailwind utility classes for layout and controls', () => {
    render(makeEntries());

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

  it('renders header and mode badges with requested emojis', () => {
    render(makeEntries());

    expect(document.body.textContent).toContain('Thinking Journal');
    expect(document.body.textContent).toContain('A quiet view of your thinking');
    expect(
      Array.from(document.querySelectorAll('button')).some((button) => button.textContent?.includes('Problem-Solving'))
    ).toBe(true);
    expect(Array.from(document.querySelectorAll('button')).some((button) => button.textContent?.includes('Delegation'))).toBe(true);
    expect(Array.from(document.querySelectorAll('button')).some((button) => button.textContent?.includes('Learning'))).toBe(true);
  });

  it('renders an in-card reflection section when reflection data is present', () => {
    render(makeEntries());

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
    expect(reflectionSection?.textContent).toContain('Reflection');
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
    expect(headerBadgeGroup?.contains(reflectionSpark as Node)).toBe(true);
    expect(headerBadge?.contains(reflectionSpark)).toBe(false);
    expect(reflectionHeader?.contains(reflectionSpark)).toBe(false);

    const reflectionNotes = document.querySelector('[data-testid="thinking-journal-reflection-notes"]');
    expect(reflectionNotes?.className).toContain('text-[#213040]');
    expect(reflectionNotes?.className).toContain('leading-[1.6]');
    expect(reflectionNotes?.className).not.toContain('mt-1.5');
    expect(reflectionNotes?.className).not.toContain('text-[1rem]');
    expect(document.body.textContent).not.toContain('PromptExplain OAuth PKCE simply.');
  });

  it('does not show a spark in the mode badge when there is no reflection', () => {
    render(makeEntries());

    const cards = Array.from(document.querySelectorAll('[data-testid="thinking-journal-card"]'));
    const learningCard = cards.find((card) => card.textContent?.includes('Learning'));
    expect(learningCard).toBeTruthy();

    const learningBadge = learningCard?.querySelector('[data-testid="thinking-journal-card-mode-badge"]');
    expect(learningBadge).toBeTruthy();
    expect(learningBadge?.querySelector('[data-testid="thinking-journal-reflection-spark"]')).toBeNull();
  });

  it('toggles long prompt expansion with Show more', () => {
    render(makeEntries());

    const toggle = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Show more');
    expect(toggle).toBeTruthy();

    act(() => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.textContent).toContain('Show less');
  });

  it('filters entries by selected mode', () => {
    render(makeEntries());

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

  it('can restrict the list to entries with reflections only', () => {
    render(makeEntries());

    const reflectionOnlyFilter = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'With reflection');
    expect(reflectionOnlyFilter).toBeTruthy();

    act(() => {
      reflectionOnlyFilter?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const cards = document.querySelectorAll('[data-testid="thinking-journal-card"]');
    expect(cards).toHaveLength(1);
    expect(cards[0]?.textContent).toContain('Problem-Solving');
    expect(cards[0]?.textContent).not.toContain('Learning');
    expect(cards[0]?.textContent).not.toContain('Delegation');
  });

  it('applies reflection-only filtering on top of the selected mode filter', () => {
    render(makeEntries());

    const learningFilter = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('Learning'));
    const reflectionOnlyFilter = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'With reflection');

    act(() => {
      learningFilter?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      reflectionOnlyFilter?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelectorAll('[data-testid="thinking-journal-card"]')).toHaveLength(0);
    expect(document.body.textContent).toContain('No entries in the last 7 days.');
  });

  it('does not fetch or show loading when preloaded entries are provided as an empty list', () => {
    const loadSpy = vi.spyOn(thinkingJournalStore, 'loadThinkingJournalEntries');
    render([]);

    expect(loadSpy).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('Loading entries...');
    expect(document.body.textContent).toContain('No entries in the last 7 days.');
  });

  it('renders the end-of-list CSV export action in the default non-empty feed', () => {
    render(makeEntries());

    expect(Array.from(document.querySelectorAll('button')).some((button) => button.textContent === 'Download full history as CSV')).toBe(true);
  });

  it('renders the CSV export action when only historical entries exist outside the 7-day feed', async () => {
    render([], { loadExportRows: async () => makeExportRows() });

    expect(document.body.textContent).toContain('No entries in the last 7 days.');
    await act(async () => {});
    expect(Array.from(document.querySelectorAll('button')).some((button) => button.textContent === 'Download full history as CSV')).toBe(true);
  });

  it('hides the end-of-list CSV export action outside the default feed state', () => {
    render(makeEntries());

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
      render(makeEntries(), { loadExportRows });

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
});
