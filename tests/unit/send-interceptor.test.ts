import { describe, expect, it, vi } from 'vitest';
import { GeminiSendInterceptor } from '../../src/content/send-interceptor';

describe('GeminiSendInterceptor', () => {
  it('blocks Enter submit and emits an interception intent', () => {
    document.body.innerHTML = '<textarea id="composer">draft</textarea><p id="state">idle</p>';
    const composer = document.querySelector('#composer') as HTMLTextAreaElement;
    const state = document.querySelector('#state') as HTMLParagraphElement;
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
    document.body.innerHTML = '<textarea id="composer">draft</textarea><p id="state">idle</p>';
    const composer = document.querySelector('#composer') as HTMLTextAreaElement;
    const state = document.querySelector('#state') as HTMLParagraphElement;
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
    document.body.innerHTML = '<textarea id="composer">draft</textarea><button id="send" aria-label="Send">Send</button><p id="state">idle</p>';
    const composer = document.querySelector('#composer') as HTMLTextAreaElement;
    const button = document.querySelector('#send') as HTMLButtonElement;
    const state = document.querySelector('#state') as HTMLParagraphElement;
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
    document.body.innerHTML = '<textarea id="composer">draft</textarea><button id="send" aria-label="Send">Send</button><p id="state">idle</p>';
    const button = document.querySelector('#send') as HTMLButtonElement;
    const state = document.querySelector('#state') as HTMLParagraphElement;
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
    document.body.innerHTML = '<button id="send" aria-label="Send">Send</button><p id="state">idle</p>';
    const button = document.querySelector('#send') as HTMLButtonElement;
    const state = document.querySelector('#state') as HTMLParagraphElement;
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
});
