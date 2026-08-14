import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('thinking journal reflection score styles', () => {
  it('uses a compact custom range in the reflection spark color family', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/thinking-journal/thinking-journal.css'), 'utf8');

    expect(css).toContain('.thinking-journal-reflect-score::-webkit-slider-runnable-track');
    expect(css).toContain('.thinking-journal-reflect-score::-webkit-slider-thumb');
    expect(css).toContain('--thinking-journal-reflect-progress');
    expect(css).toContain('#c08d45');
    expect(css).toContain('#c98e3b');
    expect(css).toContain('#dedbd4');
    expect(css).not.toContain('accent-color');
  });
});
