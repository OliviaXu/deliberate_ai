import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThinkingJournalApp } from '../../src/thinking-journal/ThinkingJournalApp';
import * as thinkingJournalStore from '../../src/thinking-journal/thinking-journal-store';
import type { ThinkingJournalEntry } from '../../src/thinking-journal/utils/entries';

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
      dateLabel: 'Mar 2, 2026 — 4:42 PM'
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
      dateLabel: 'Mar 2, 2026 — 12:00 PM'
    },
    {
      id: 'c',
      timestamp: Date.UTC(2026, 2, 1, 8, 0, 0),
      mode: 'delegation',
      modeLabel: 'Delegation',
      modeEmoji: '😌',
      prompt: 'Draft this status update.',
      promptIsLong: false,
      dateLabel: 'Mar 1, 2026 — 8:00 AM'
    }
  ];
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function render(entries: ThinkingJournalEntry[]): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(<ThinkingJournalApp preloadedEntries={entries} />);
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

    const allFilter = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'All');
    expect(allFilter).toBeTruthy();
    expect(allFilter?.className).toContain('rounded-[15px]');
    expect(allFilter?.className).toContain('shadow-none');
  });

  it('renders header and mode badges with requested emojis', () => {
    render(makeEntries());

    expect(document.body.textContent).toContain('Thinking Journal');
    expect(document.body.textContent).toContain('A quiet view of your thinking.');
    expect(document.body.textContent).toContain('🤔 Problem-Solving');
    expect(document.body.textContent).toContain('😌 Delegation');
    expect(document.body.textContent).toContain('🧑‍🎓 Learning');
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

    const learningFilter = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Learning');
    expect(learningFilter).toBeTruthy();

    act(() => {
      learningFilter?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const cards = document.querySelectorAll('[data-testid="thinking-journal-card"]');
    expect(cards).toHaveLength(1);
    expect(document.body.textContent).toContain('🧑‍🎓 Learning');
    expect(document.body.textContent).not.toContain('😌 Delegation');
  });

  it('does not fetch or show loading when preloaded entries are provided as an empty list', () => {
    const loadSpy = vi.spyOn(thinkingJournalStore, 'loadThinkingJournalEntries');
    render([]);

    expect(loadSpy).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('Loading entries...');
    expect(document.body.textContent).toContain('No entries in the last 7 days.');
  });
});
