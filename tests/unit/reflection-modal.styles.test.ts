import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('reflection-modal styles', () => {
  it('leans on shared neutral dialog tokens instead of hard-coded accent colors', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/content/reflection-modal.css'), 'utf8');

    expect(css).toContain('background: var(--deliberate-panel-bg);');
    expect(css).toContain('background: var(--deliberate-input-bg);');
    expect(css).toContain('background: var(--deliberate-action-bg);');
    expect(css).toContain('color: var(--deliberate-action-text);');
    expect(css).not.toContain('#1976d2');
    expect(css).not.toContain('#1565c0');
    expect(css).not.toContain('#115293');
    expect(css).not.toContain('#90caf9');
  });

  it('uses one shared content inset for slider, cards, and footer actions', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/content/reflection-modal.css'), 'utf8');

    expect(css).toContain('--deliberate-reflection-content-inset: var(--deliberate-space-3);');
    expect(css).toContain('margin-inline: var(--deliberate-reflection-content-inset);');
    expect(css).toContain('padding-inline: 0;');
  });

  it('keeps the lower context section visually flat and cancel lower contrast', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/content/reflection-modal.css'), 'utf8');

    expect(css).toContain('.deliberate-reflection-context-section--supporting {');
    expect(css).toContain('border: 0;');
    expect(css).toContain('background: transparent;');
    expect(css).toContain('color: var(--deliberate-text-muted);');
  });

  it('keeps the slider row as a compact cluster instead of a stretched band', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/content/reflection-modal.css'), 'utf8');

    expect(css).toContain('--deliberate-reflection-scale-track-width: 220px;');
    expect(css).toContain('.deliberate-reflection-scale-row {');
    expect(css).toContain('justify-self: start;');
    expect(css).toContain('grid-template-columns: max-content var(--deliberate-reflection-scale-track-width) max-content;');
    expect(css).toContain('width: fit-content;');
    expect(css).toContain('gap: 8px;');
    expect(css).toContain('margin-inline-start: var(--deliberate-reflection-content-inset);');
  });

  it('softens the reflection placeholder so it does not compete with the title', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/content/reflection-modal.css'), 'utf8');

    expect(css).toContain('.deliberate-reflection-notes.deliberate-input {');
    expect(css).toContain('padding-top: 12px;');
    expect(css).toContain('.deliberate-reflection-notes.deliberate-input::placeholder {');
    expect(css).toContain('color: color-mix(in srgb, var(--deliberate-placeholder) 64%, transparent);');
    expect(css).toContain('font-size: 14px;');
  });

  it('keeps Claude styling split by explicit light and dark theme selectors', () => {
    const tokensCss = readFileSync(resolve(process.cwd(), 'src/content/mode-modal.tokens.css'), 'utf8');
    const hintCss = readFileSync(resolve(process.cwd(), 'src/content/reflection-hint.css'), 'utf8');

    expect(tokensCss).toContain("[data-deliberate-platform-skin='claude'][data-deliberate-theme='light']");
    expect(tokensCss).toContain("[data-deliberate-platform-skin='claude'][data-deliberate-theme='dark']");
    expect(hintCss).toContain(".deliberate-reflection-hint[data-deliberate-platform-skin='claude'][data-deliberate-theme='light']");
    expect(hintCss).toContain(".deliberate-reflection-hint[data-deliberate-platform-skin='claude'][data-deliberate-theme='dark']");
  });

  it('routes textarea focus highlighting through deliberate tokens instead of host blue chrome', () => {
    const modeCss = readFileSync(resolve(process.cwd(), 'src/content/mode-modal.css'), 'utf8');

    expect(modeCss).toContain('.deliberate-input-shell:focus-within {');
    expect(modeCss).toContain('border-color: var(--deliberate-action-bg);');
    expect(modeCss).toContain('box-shadow: none;');
    expect(modeCss).toContain('.deliberate-input:focus,');
    expect(modeCss).toContain('.deliberate-input:focus-visible {');
    expect(modeCss).toContain('outline: none;');
    expect(modeCss).toContain('box-shadow: none;');
  });
});
