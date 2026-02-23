import { describe, expect, it, vi } from 'vitest';
import { GeminiInterceptDetector } from '../../src/content/intercept-detector';

describe('GeminiInterceptDetector', () => {
  it('emits enter_key on Enter submit intent', () => {
    document.body.innerHTML = '<textarea>hello</textarea>';
    const detector = new GeminiInterceptDetector();
    const handler = vi.fn();

    detector.onSignal(handler);
    detector.start();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);
    const firstSignal = handler.mock.calls[0]?.[0];
    expect(firstSignal).toBeDefined();
    if (!firstSignal) throw new Error('Expected first signal payload');
    expect(firstSignal.source).toBe('enter_key');
    expect(firstSignal.hasPromptInput).toBe(true);

    detector.stop();
  });

  it('emits send_button on send button click', () => {
    document.body.innerHTML = '<button aria-label="Send message">Send</button>';
    const detector = new GeminiInterceptDetector();
    const handler = vi.fn();

    detector.onSignal(handler);
    detector.start();

    const button = document.querySelector('button') as HTMLButtonElement;
    button.click();

    expect(handler).toHaveBeenCalledTimes(1);
    const firstSignal = handler.mock.calls[0]?.[0];
    expect(firstSignal).toBeDefined();
    if (!firstSignal) throw new Error('Expected first signal payload');
    expect(firstSignal.source).toBe('send_button');

    detector.stop();
  });

  it('emits send_button for Gemini icon-only submit button shape', () => {
    document.body.innerHTML = `
      <button class="send-button submit" aria-label="Send message" aria-disabled="false">
        <mat-icon fonticon="send" class="send-button-icon"></mat-icon>
      </button>
    `;
    const detector = new GeminiInterceptDetector();
    const handler = vi.fn();

    detector.onSignal(handler);
    detector.start();

    const icon = document.querySelector('mat-icon') as HTMLElement;
    icon.click();

    expect(handler).toHaveBeenCalledTimes(1);
    const firstSignal = handler.mock.calls[0]?.[0];
    expect(firstSignal).toBeDefined();
    if (!firstSignal) throw new Error('Expected first signal payload');
    expect(firstSignal.source).toBe('send_button');

    detector.stop();
  });

  it('ignores disabled send button', () => {
    document.body.innerHTML = `
      <button class="send-button submit" aria-label="Send message" aria-disabled="true">
        <mat-icon fonticon="send" class="send-button-icon"></mat-icon>
      </button>
    `;
    const detector = new GeminiInterceptDetector();
    const handler = vi.fn();

    detector.onSignal(handler);
    detector.start();

    const button = document.querySelector('button') as HTMLButtonElement;
    button.click();

    expect(handler).not.toHaveBeenCalled();

    detector.stop();
  });

  it('ignores non-submit keys and buttons', () => {
    document.body.innerHTML = '<textarea>hello</textarea><button aria-label="Attach file">Attach</button>';
    const detector = new GeminiInterceptDetector();
    const handler = vi.fn();

    detector.onSignal(handler);
    detector.start();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', bubbles: true }));
    (document.querySelector('button') as HTMLButtonElement).click();

    expect(handler).not.toHaveBeenCalled();

    detector.stop();
  });
});
