import { describe, expect, it } from 'vitest';
import { JOURNAL_WINDOW_MS } from '../../src/thinking-journal/journal-window';

describe('thinking journal window', () => {
  it('shows the most recent seven days', () => {
    expect(JOURNAL_WINDOW_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
