import { describe, expect, it } from 'vitest';
import {
  findGeminiComposer,
  findGeminiComposerAnchor,
  resolveGeminiComposerNear
} from '../../src/platforms/gemini/composer';

function setupGeminiComposer(): HTMLDivElement {
  document.body.innerHTML = `
    <main>
      <input-container class="input-gradient">
        <input-area-v2 class="ui-improvements-phase-1">
          <div class="input-area">
            <button class="send-button" aria-label="Send message">
              <mat-icon fonticon="send"></mat-icon>
            </button>
            <div class="text-input-field">
              <div class="text-input-field_textarea-wrapper">
                <div class="text-input-field-main-area">
                  <div class="text-input-field_textarea-inner">
                    <rich-textarea class="text-input-field_textarea">
                      <div
                        class="ql-editor textarea new-input-ui"
                        contenteditable="true"
                        role="textbox"
                        aria-label="Enter a prompt for Gemini"
                      >
                        draft prompt
                      </div>
                    </rich-textarea>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </input-area-v2>
      </input-container>
    </main>
  `;

  const composer = document.querySelector('.ql-editor.textarea.new-input-ui');
  if (!(composer instanceof HTMLDivElement)) throw new Error('Expected Gemini composer');
  return composer;
}

describe('gemini-composer helpers', () => {
  it('finds the live Gemini composer element', () => {
    const composer = setupGeminiComposer();

    expect(findGeminiComposer()).toBe(composer);
    expect(resolveGeminiComposerNear(composer)).toBe(composer);
  });

  it('resolves the input-area shell as the preferred anchor', () => {
    const composer = setupGeminiComposer();
    const anchor = findGeminiComposerAnchor(composer);

    expect(anchor).toBe(document.querySelector('.input-area'));
    expect(anchor).not.toBe(document.querySelector('input-container'));
  });

  it('resolves the composer from nearby Gemini descendants', () => {
    setupGeminiComposer();
    const richTextarea = document.querySelector('rich-textarea');
    if (!(richTextarea instanceof HTMLElement)) throw new Error('Expected rich-textarea');

    expect(resolveGeminiComposerNear(richTextarea)).toBe(document.querySelector('.ql-editor.textarea.new-input-ui'));
  });
});
