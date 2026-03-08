import { describe, expect, it, vi } from 'vitest';
import { GeminiSendInterceptor } from '../../src/content/send-interceptor';

function setupGeminiHarness(options: { includeSendButton?: boolean; includeComposer?: boolean } = {}): {
  composer: HTMLDivElement | null;
  button: HTMLButtonElement | null;
  state: HTMLParagraphElement;
} {
  const { includeSendButton = true, includeComposer = true } = options;
  document.body.innerHTML = `
    <input-container class="input-gradient">
      <input-area-v2 class="ui-improvements-phase-1">
        <div class="input-area">
          ${
            includeSendButton
              ? `
            <button class="send-button" aria-label="Send message">
              <mat-icon fonticon="send"></mat-icon>
            </button>
          `
              : ''
          }
          ${
            includeComposer
              ? `
            <div class="text-input-field">
              <div class="text-input-field_textarea-wrapper">
                <div class="text-input-field-main-area">
                  <div class="text-input-field_textarea-inner">
                    <rich-textarea class="text-input-field_textarea">
                      <div class="ql-editor textarea new-input-ui" contenteditable="true" role="textbox" aria-label="Enter a prompt for Gemini">draft</div>
                    </rich-textarea>
                  </div>
                </div>
              </div>
            </div>
          `
              : ''
          }
        </div>
      </input-area-v2>
    </input-container>
    <p id="state">idle</p>
  `;

  const composer = document.querySelector('.ql-editor.textarea.new-input-ui');
  const button = document.querySelector('button.send-button');
  const state = document.querySelector('#state');
  if (!(state instanceof HTMLParagraphElement)) throw new Error('Expected state element');

  return {
    composer: composer instanceof HTMLDivElement ? composer : null,
    button: button instanceof HTMLButtonElement ? button : null,
    state
  };
}

describe('GeminiSendInterceptor', () => {
  it('blocks Enter submit and emits an interception intent', () => {
    const { composer, state } = setupGeminiHarness({ includeSendButton: false });
    if (!(composer instanceof HTMLDivElement)) throw new Error('Expected Gemini composer');
    composer.focus();
    composer.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      if (event.defaultPrevented) return;
      state.textContent = 'sent';
    });

    const interceptor = new GeminiSendInterceptor();
    const handler = vi.fn();
    interceptor.onIntercept(handler);
    interceptor.start();

    composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(state.textContent).toBe('idle');
    const intent = handler.mock.calls[0]?.[0];
    expect(intent?.prompt).toBe('draft');

    interceptor.stop();
  });

  it('resumes blocked send once without reopening interception loop', () => {
    const { composer, state } = setupGeminiHarness({ includeSendButton: false });
    if (!(composer instanceof HTMLDivElement)) throw new Error('Expected Gemini composer');
    composer.focus();
    composer.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      if (event.defaultPrevented) return;
      state.textContent = 'sent';
    });

    const interceptor = new GeminiSendInterceptor();
    const handler = vi.fn();
    interceptor.onIntercept(handler);
    interceptor.start();

    composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    const intent = handler.mock.calls[0]?.[0];
    if (!intent) throw new Error('Expected interception intent');

    const resumed = interceptor.resume(intent);

    expect(resumed).toBe(true);
    expect(state.textContent).toBe('sent');
    expect(handler).toHaveBeenCalledTimes(1);

    interceptor.stop();
  });

  it('prefers click replay for enter-origin intents when send button exists', () => {
    const { composer, button, state } = setupGeminiHarness();
    if (!(composer instanceof HTMLDivElement)) throw new Error('Expected Gemini composer');
    if (!(button instanceof HTMLButtonElement)) throw new Error('Expected send button');
    let clickCount = 0;

    composer.focus();
    composer.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      if (event.defaultPrevented) return;
      state.textContent = 'sent-enter';
    });
    button.addEventListener('click', (event) => {
      if (event.defaultPrevented) return;
      clickCount += 1;
      state.textContent = 'sent-click';
    });

    const interceptor = new GeminiSendInterceptor();
    const handler = vi.fn();
    interceptor.onIntercept(handler);
    interceptor.start();

    composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    const intent = handler.mock.calls[0]?.[0];
    if (!intent) throw new Error('Expected interception intent');

    expect(interceptor.resume(intent)).toBe(true);
    expect(clickCount).toBe(1);
    expect(state.textContent).toBe('sent-click');

    interceptor.stop();
  });

  it('blocks send button click and resumes after mode selection path', () => {
    const { button, state } = setupGeminiHarness();
    if (!(button instanceof HTMLButtonElement)) throw new Error('Expected send button');
    button.addEventListener('click', (event) => {
      if (event.defaultPrevented) return;
      state.textContent = 'sent';
    });

    const interceptor = new GeminiSendInterceptor();
    const handler = vi.fn();
    interceptor.onIntercept(handler);
    interceptor.start();

    button.click();
    const intent = handler.mock.calls[0]?.[0];
    if (!intent) throw new Error('Expected interception intent');

    expect(state.textContent).toBe('idle');
    expect(interceptor.resume(intent)).toBe(true);
    expect(state.textContent).toBe('sent');

    interceptor.stop();
  });

  it('intercepts send button click even when composer cannot be resolved', () => {
    const { button, state } = setupGeminiHarness({ includeComposer: false });
    if (!(button instanceof HTMLButtonElement)) throw new Error('Expected send button');
    button.addEventListener('click', (event) => {
      if (event.defaultPrevented) return;
      state.textContent = 'sent';
    });

    const interceptor = new GeminiSendInterceptor();
    const handler = vi.fn();
    interceptor.onIntercept(handler);
    interceptor.start();

    button.click();

    expect(handler).toHaveBeenCalledTimes(1);
    const firstIntent = handler.mock.calls[0]?.[0];
    expect(firstIntent).toBeDefined();
    if (!firstIntent) throw new Error('Expected interception intent');
    expect(firstIntent.prompt).toBe('');
    expect(state.textContent).toBe('idle');

    interceptor.stop();
  });

  it('does not intercept Enter pressed inside the mode modal detail textarea', () => {
    document.body.innerHTML = `
      <div class="ql-editor textarea new-input-ui" contenteditable="true" role="textbox" aria-label="Enter a prompt for Gemini">draft</div>
      <div id="deliberate-mode-modal-root">
        <textarea data-testid="deliberate-mode-detail-input">detail note</textarea>
      </div>
    `;
    const modalInput = document.querySelector('[data-testid="deliberate-mode-detail-input"]') as HTMLTextAreaElement;

    const interceptor = new GeminiSendInterceptor();
    const handler = vi.fn();
    interceptor.onIntercept(handler);
    interceptor.start();

    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    modalInput.dispatchEvent(enter);

    expect(handler).not.toHaveBeenCalled();
    expect(enter.defaultPrevented).toBe(false);

    interceptor.stop();
  });

  it('does not intercept send-like button clicks inside the mode modal', () => {
    document.body.innerHTML = `
      <div class="ql-editor textarea new-input-ui" contenteditable="true" role="textbox" aria-label="Enter a prompt for Gemini">draft</div>
      <div id="deliberate-mode-modal-root">
        <button id="modal-submit" class="submit">Send</button>
      </div>
      <p id="state">idle</p>
    `;
    const modalSubmit = document.querySelector('#modal-submit') as HTMLButtonElement;
    const state = document.querySelector('#state') as HTMLParagraphElement;
    modalSubmit.addEventListener('click', () => {
      state.textContent = 'modal-clicked';
    });

    const interceptor = new GeminiSendInterceptor();
    const handler = vi.fn();
    interceptor.onIntercept(handler);
    interceptor.start();

    modalSubmit.click();

    expect(handler).not.toHaveBeenCalled();
    expect(state.textContent).toBe('modal-clicked');

    interceptor.stop();
  });
});
