import { describe, expect, it, vi } from 'vitest';
import { ResurfacingGlint } from '../../src/content/resurfacing-glint';
import { geminiPlatform } from '../../src/platforms/gemini/definition';

function setupComposer(): HTMLElement {
  document.body.innerHTML = `
    <main>
      <input-container class="input-gradient">
        <input-area-v2><div class="input-area">
          <div class="ql-editor textarea new-input-ui" contenteditable="true" role="textbox" aria-label="Enter a prompt for Gemini"></div>
        </div></input-area-v2>
      </input-container>
    </main>
  `;
  const anchor = document.querySelector('.input-area');
  if (!(anchor instanceof HTMLElement)) throw new Error('Expected composer anchor');
  return anchor;
}

describe('ResurfacingGlint', () => {
  it('renders the verbatim excerpt on the right side of the composer', () => {
    const anchor = setupComposer();
    const glint = new ResurfacingGlint({ platform: geminiPlatform, onOpen: vi.fn() });

    glint.show({ learningCycleRecordId: 'record-1', excerpt: '  Keep original spacing  ' });

    const root = document.querySelector('[data-testid="deliberate-resurfacing-glint"]');
    expect(root?.parentElement).toBe(anchor);
    expect(anchor.classList.contains('deliberate-resurfacing-glint-anchor')).toBe(true);
    expect(root?.getAttribute('data-deliberate-platform-skin')).toBe('default');
    expect(document.querySelector('[data-testid="deliberate-resurfacing-glint-excerpt"]')?.textContent).toBe(
      '  Keep original spacing  '
    );
    expect(root?.textContent).toContain('A thought returned —');
    expect(root?.textContent).toContain('↗');
    expect(root?.textContent).not.toMatch(/ago|2026/);
  });

  it('opens the selected record without removing the glint', () => {
    setupComposer();
    const onOpen = vi.fn();
    const glint = new ResurfacingGlint({ platform: geminiPlatform, onOpen });
    glint.show({ learningCycleRecordId: 'record-1', excerpt: 'Past thought' });

    const button = document.querySelector('[data-testid="deliberate-resurfacing-glint"]');
    if (!(button instanceof HTMLButtonElement)) throw new Error('Expected glint button');
    button.click();

    expect(onOpen).toHaveBeenCalledWith('record-1');
    expect(document.querySelector('[data-testid="deliberate-resurfacing-glint"]')).toBeTruthy();
  });

  it('clears the previous composer anchor when falling back to the document body', () => {
    const anchor = setupComposer();
    let composerAvailable = true;
    const platform = {
      appearance: geminiPlatform.appearance,
      findComposer: () => (composerAvailable ? geminiPlatform.findComposer() : null),
      findComposerAnchor: geminiPlatform.findComposerAnchor
    };
    const glint = new ResurfacingGlint({ platform, onOpen: vi.fn() });
    glint.show({ learningCycleRecordId: 'record-1', excerpt: 'Past thought' });

    composerAvailable = false;
    glint.show({ learningCycleRecordId: 'record-2', excerpt: 'Another thought' });

    expect(anchor.classList.contains('deliberate-resurfacing-glint-anchor')).toBe(false);
    expect(document.querySelector('[data-testid="deliberate-resurfacing-glint"]')?.parentElement).toBe(document.body);
  });

  it('moves a body fallback to the composer when the anchor appears later', () => {
    document.body.innerHTML = '';
    const glint = new ResurfacingGlint({ platform: geminiPlatform, onOpen: vi.fn() });
    glint.show({ learningCycleRecordId: 'record-1', excerpt: 'Past thought' });
    expect(document.querySelector('[data-testid="deliberate-resurfacing-glint"]')?.parentElement).toBe(document.body);

    const anchor = setupComposer();
    glint.refreshAnchor();

    expect(document.querySelector('[data-testid="deliberate-resurfacing-glint"]')?.parentElement).toBe(anchor);
  });
});
