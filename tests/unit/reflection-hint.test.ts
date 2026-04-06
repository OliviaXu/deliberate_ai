import { describe, expect, it, vi } from 'vitest';
import { ReflectionHint } from '../../src/content/reflection-hint';
import { claudePlatform } from '../../src/platforms/claude/definition';
import { chatgptPlatform } from '../../src/platforms/chatgpt/definition';
import { geminiPlatform } from '../../src/platforms/gemini/definition';

function setupGeminiComposer(): HTMLDivElement {
  document.body.innerHTML = `
    <main>
      <input-container class="input-gradient">
        <input-area-v2 class="ui-improvements-phase-1">
          <div class="input-area">
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
                      ></div>
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

function setupChatGPTComposer(): HTMLDivElement {
  document.body.innerHTML = `
    <main>
      <section class="conversation-shell">
        <form class="group composer">
          <div class="composer-shell">
            <div class="composer-input">
              <div
                class="ProseMirror"
                contenteditable="true"
                role="textbox"
                aria-label="Ask anything"
              >
                <p>draft prompt</p>
              </div>
            </div>
            <button type="button" data-testid="send-button" aria-label="Send prompt">Send</button>
          </div>
        </form>
      </section>
    </main>
  `;

  const composer = document.querySelector('.ProseMirror');
  if (!(composer instanceof HTMLDivElement)) throw new Error('Expected ChatGPT composer');
  return composer;
}

describe('ReflectionHint', () => {
  it('marks the hint with the Claude platform skin when rendered on Claude', () => {
    document.body.style.backgroundColor = 'rgb(255, 255, 255)';
    document.body.innerHTML = `
      <main>
        <fieldset>
          <div
            class="tiptap ProseMirror"
            contenteditable="true"
            role="textbox"
            data-testid="chat-input"
          ></div>
        </fieldset>
      </main>
    `;
    const hint = new ReflectionHint({ platform: claudePlatform });

    hint.updateVisibilityForThread('/chat/thread-a', true);

    const root = document.querySelector('[data-testid="deliberate-reflection-hint"]');
    expect(root?.getAttribute('data-deliberate-platform-skin')).toBe('claude');
    expect(root?.getAttribute('data-deliberate-theme')).toBe('light');
    document.body.style.backgroundColor = '';
  });

  it('uses dark theme styling for the hint when the page background is dark', () => {
    document.body.style.backgroundColor = 'rgb(15, 23, 42)';
    setupGeminiComposer();
    const hint = new ReflectionHint({ platform: geminiPlatform });

    hint.updateVisibilityForThread('/app/thread-a', true);

    const root = document.querySelector('[data-testid="deliberate-reflection-hint"]');
    expect(root?.getAttribute('data-deliberate-theme')).toBe('dark');
    document.body.style.backgroundColor = '';
  });

  it('shows and hides the hint based on the computed due state for the current thread', () => {
    setupGeminiComposer();
    const hint = new ReflectionHint({ platform: geminiPlatform });

    hint.updateVisibilityForThread('/app/threads/thread-a', false);
    expect(document.querySelector('[data-testid="deliberate-reflection-hint"]')).toBeNull();

    hint.updateVisibilityForThread('/app/threads/thread-a', true);
    expect(document.querySelector('[data-testid="deliberate-reflection-hint"]')).toBeTruthy();

    hint.updateVisibilityForThread('/app/threads/thread-a', false);
    expect(document.querySelector('[data-testid="deliberate-reflection-hint"]')).toBeNull();
  });

  it('anchors the hint as a floating overlay inside the composer shell', () => {
    const composer = setupGeminiComposer();
    const hint = new ReflectionHint({ platform: geminiPlatform });

    hint.updateVisibilityForThread('/app/thread-a', true);

    const root = document.querySelector('[data-testid="deliberate-reflection-hint"]');
    if (!(root instanceof HTMLDivElement)) throw new Error('Expected hint root');
    expect(root.classList.contains('deliberate-reflection-hint--floaty')).toBe(true);

    const shell = document.querySelector('.input-area');
    if (!(shell instanceof HTMLElement)) throw new Error('Expected Gemini input-area shell');

    expect(root.parentElement).toBe(shell);
    expect(shell.classList.contains('deliberate-reflection-hint-anchor')).toBe(true);
    expect(root.parentElement).not.toBe(composer.parentElement);
  });

  it('prefers the real Gemini input-area shell over inner wrappers and broader page containers', () => {
    const composer = setupGeminiComposer();
    const hint = new ReflectionHint({ platform: geminiPlatform });

    hint.updateVisibilityForThread('/app/thread-a', true);

    const root = document.querySelector('[data-testid="deliberate-reflection-hint"]');
    if (!(root instanceof HTMLDivElement)) throw new Error('Expected hint root');

    const shell = document.querySelector('.input-area');
    if (!(shell instanceof HTMLElement)) throw new Error('Expected Gemini input-area shell');
    const outerContainer = document.querySelector('input-container');
    if (!(outerContainer instanceof HTMLElement)) throw new Error('Expected outer input-container');

    expect(root.parentElement).toBe(shell);
    expect(shell.classList.contains('deliberate-reflection-hint-anchor')).toBe(true);
    expect(root.parentElement).not.toBe(composer.parentElement);
    expect(root.parentElement).not.toBe(outerContainer);
  });

  it('anchors the hint to the ChatGPT composer form shell', () => {
    const composer = setupChatGPTComposer();
    const hint = new ReflectionHint({ platform: chatgptPlatform });

    hint.updateVisibilityForThread('/c/thread-a', true);

    const root = document.querySelector('[data-testid="deliberate-reflection-hint"]');
    if (!(root instanceof HTMLDivElement)) throw new Error('Expected hint root');

    const shell = document.querySelector('form.group.composer');
    if (!(shell instanceof HTMLElement)) throw new Error('Expected ChatGPT composer shell');

    expect(root.classList.contains('deliberate-reflection-hint--floaty')).toBe(true);
    expect(root.parentElement).toBe(shell);
    expect(shell.classList.contains('deliberate-reflection-hint-anchor')).toBe(true);
    expect(root.parentElement).not.toBe(composer.parentElement);
  });

  it('logs review interaction without hiding hint', () => {
    setupGeminiComposer();
    const onReview = vi.fn();
    const hint = new ReflectionHint({ platform: geminiPlatform, onReview });

    hint.updateVisibilityForThread('/app/thread-a', true);

    const label = document.querySelector('.deliberate-reflection-hint__label');
    if (!(label instanceof HTMLSpanElement)) throw new Error('Expected hint label');
    expect(label.textContent).toBe('Time to');

    const reviewButton = document.querySelector('[data-testid="deliberate-reflection-hint-review"]');
    if (!(reviewButton instanceof HTMLButtonElement)) throw new Error('Expected review button');
    expect(reviewButton.textContent).toBe('reflect');
    expect(reviewButton.classList.contains('deliberate-reflection-hint__review--subtle')).toBe(true);
    reviewButton.click();

    expect(onReview).toHaveBeenCalledWith('/app/thread-a');
    expect(document.querySelector('[data-testid="deliberate-reflection-hint"]')).toBeTruthy();
  });
});
