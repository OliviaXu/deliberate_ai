import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('resurfacing glint styles', () => {
  it('uses slightly larger type and a translucent blurred backing', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/content/resurfacing-glint.css'), 'utf8');

    expect(css).toContain('text-[13px]');
    expect(css).toContain('background: rgba(255, 255, 255, 0.76);');
    expect(css).toContain('backdrop-filter: blur(10px) saturate(140%);');
    expect(css).toContain('-webkit-backdrop-filter: blur(10px) saturate(140%);');
  });
});
