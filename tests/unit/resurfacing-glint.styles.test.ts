import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('resurfacing glint styles', () => {
  it('uses 14px type with breathing room above and slightly beyond the composer right edge', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/content/resurfacing-glint.css'), 'utf8');

    expect(css).toContain('top: -30px;');
    expect(css).toContain('right: -12px;');
    expect(css).toContain('text-[14px]');
    expect(css).toContain('background: rgba(255, 255, 255, 0.76);');
    expect(css).toContain('backdrop-filter: blur(10px) saturate(140%);');
    expect(css).toContain('-webkit-backdrop-filter: blur(10px) saturate(140%);');
    expect(css).toContain('box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);');
  });
});
