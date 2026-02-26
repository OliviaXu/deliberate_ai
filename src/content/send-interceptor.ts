import type { InterceptedSubmitIntent, SubmitSource, Unsubscribe } from '../shared/types';
import type { Logger } from '../shared/logger';

interface InternalSubmitIntent extends InterceptedSubmitIntent {
  button: HTMLButtonElement | null;
  composer: HTMLElement | null;
}

const COMPOSER_MATCH_SELECTOR = [
  '#composer',
  'textarea',
  '.ql-editor.textarea[contenteditable="true"][role="textbox"]',
  '[contenteditable="true"][role="textbox"][aria-label*="prompt"][aria-label*="Gemini"]'
].join(', ');

const COMPOSER_CONTEXTUAL_LOOKUP_SELECTOR = 'rich-textarea [contenteditable="true"][role="textbox"]';
// Include a wrapper-based selector for lookup paths where the event target is nested inside Gemini's rich-textarea.
const COMPOSER_LOOKUP_SELECTOR = [COMPOSER_MATCH_SELECTOR, COMPOSER_CONTEXTUAL_LOOKUP_SELECTOR].join(', ');

export class GeminiSendInterceptor {
  constructor(private readonly logger?: Pick<Logger, 'debug' | 'info'>) {}

  private readonly handlers = new Set<(intent: InterceptedSubmitIntent) => void>();
  private started = false;
  private interceptionId = 0;
  // One-shot gate used to let our synthetic "resume send" event pass through.
  private bypassNextInterception = false;
  private lastIntent: InternalSubmitIntent | null = null;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.isSubmitKeyEvent(event)) return;
    const eventComposer = this.resolveComposerFromEvent(event);
    if (!eventComposer) {
      this.logger?.debug('composer-resolution-enter-fallback-to-active');
    }

    const composer = eventComposer ?? this.resolveActiveComposer();
    if (!composer) return;
    this.intercept(event, 'enter_key', composer, null);
  };

  private readonly onClick = (event: MouseEvent): void => {
    const button = this.resolveButtonFromEvent(event);
    if (!button) return;
    if (this.isDisabled(button)) return;
    if (!this.isSendButton(button)) return;
    const composer = this.resolveActiveComposer();
    if (!composer) {
      this.logger?.debug('composer-resolution-click-none');
    }
    this.intercept(event, 'send_button', composer, button);
  };

  start(): void {
    if (this.started) return;
    document.addEventListener('keydown', this.onKeyDown, true);
    document.addEventListener('click', this.onClick, true);
    this.started = true;
  }

  stop(): void {
    if (!this.started) return;
    document.removeEventListener('keydown', this.onKeyDown, true);
    document.removeEventListener('click', this.onClick, true);
    this.started = false;
  }

  onIntercept(handler: (intent: InterceptedSubmitIntent) => void): Unsubscribe {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  resume(intent: InterceptedSubmitIntent): boolean {
    const internalIntent = this.resolveIntentForResume(intent);
    if (!internalIntent) return false;
    // The next matching event is expected to be our own replayed send.
    this.bypassNextInterception = true;

    const resumed =
      internalIntent.source === 'send_button'
        ? this.tryResumeByButtonThenEnter(internalIntent)
        : this.tryResumeByClickThenEnter(internalIntent);

    if (!resumed) {
      this.bypassNextInterception = false;
    }

    return resumed;
  }

  private intercept(
    event: Event,
    source: SubmitSource,
    composer: HTMLElement | null,
    button: HTMLButtonElement | null
  ): void {
    if (this.consumeBypassIfSet()) return;

    const intent = this.createIntent(source, composer, button);
    if (!intent.hasPromptInput) {
      this.logger?.debug('prompt-input-missing-best-effort', { source });
    }

    this.blockNativeSend(event);
    this.emitIntent(intent);
  }

  private blockNativeSend(event: Event): void {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  private createIntent(
    source: SubmitSource,
    composer: HTMLElement | null,
    button: HTMLButtonElement | null
  ): InternalSubmitIntent {
    this.interceptionId += 1;
    return {
      source,
      timestamp: Date.now(),
      url: window.location.href,
      platform: 'gemini',
      hasPromptInput: this.hasPromptInput(composer),
      interceptionId: this.interceptionId,
      button,
      composer
    };
  }

  private emitIntent(intent: InternalSubmitIntent): void {
    this.lastIntent = intent;
    const publicIntent: InterceptedSubmitIntent = {
      source: intent.source,
      timestamp: intent.timestamp,
      url: intent.url,
      platform: intent.platform,
      hasPromptInput: intent.hasPromptInput,
      interceptionId: intent.interceptionId
    };
    this.handlers.forEach((handler) => handler(publicIntent));
  }

  private resolveIntentForResume(intent: InterceptedSubmitIntent): InternalSubmitIntent | null {
    if (this.lastIntent && this.lastIntent.interceptionId === intent.interceptionId) return this.lastIntent;
    return null;
  }

  private consumeBypassIfSet(): boolean {
    // Consume-on-read keeps bypass strictly one-shot and prevents stale unlocks.
    const shouldBypass = this.bypassNextInterception;
    this.bypassNextInterception = false;
    return shouldBypass;
  }

  private tryResumeByButtonThenEnter(intent: InternalSubmitIntent): boolean {
    if (this.resumeByClick(intent.button)) return true;
    this.logger?.info('resume-fallback-button-to-enter', { interceptionId: intent.interceptionId });
    return this.resumeByEnter(intent.composer);
  }

  private tryResumeByClickThenEnter(intent: InternalSubmitIntent): boolean {
    if (this.resumeByClick(this.resolveSendButton())) return true;
    this.logger?.info('resume-fallback-click-to-enter', { interceptionId: intent.interceptionId });
    return this.resumeByEnter(intent.composer);
  }

  private resumeByClick(button: HTMLButtonElement | null): boolean {
    if (!(button instanceof HTMLButtonElement)) return false;
    if (!button.isConnected) return false;
    if (this.isDisabled(button)) return false;
    button.click();
    return true;
  }

  private resumeByEnter(composer: HTMLElement | null): boolean {
    if (!(composer instanceof HTMLElement)) return false;
    if (!composer.isConnected) return false;
    composer.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true
    });
    composer.dispatchEvent(event);
    return true;
  }

  private hasPromptInput(composer: HTMLElement | null): boolean {
    if (!composer) return false;
    return this.getComposerText(composer).trim().length > 0;
  }

  private getComposerText(composer: HTMLElement): string {
    if (composer instanceof HTMLTextAreaElement) {
      return composer.value;
    }

    if (composer.matches('[contenteditable="true"][role="textbox"]')) {
      return composer.textContent || '';
    }

    return '';
  }

  private isSubmitKeyEvent(event: KeyboardEvent): boolean {
    if (event.key !== 'Enter') return false;
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return false;
    if (event.isComposing) return false;
    return true;
  }

  private resolveComposerFromEvent(event: KeyboardEvent): HTMLElement | null {
    const target = event.target;
    if (target instanceof HTMLElement) {
      return this.resolveComposerNear(target);
    }
    return null;
  }

  private resolveActiveComposer(): HTMLElement | null {
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      const composer = this.resolveComposerNear(active);
      if (composer) return composer;
      this.logger?.debug('composer-resolution-active-miss');
    }
    this.logger?.debug('composer-resolution-no-active-composer');
    return null;
  }

  private resolveComposerNear(element: HTMLElement): HTMLElement | null {
    if (element.matches(COMPOSER_MATCH_SELECTOR)) return element;
    return element.closest<HTMLElement>(COMPOSER_LOOKUP_SELECTOR);
  }

  private resolveSendButton(): HTMLButtonElement | null {
    const buttons = Array.from(document.querySelectorAll('button'));
    const matched = buttons.find((candidate) => candidate instanceof HTMLButtonElement && this.isSendButton(candidate));
    return matched instanceof HTMLButtonElement ? matched : null;
  }

  private resolveButtonFromEvent(event: MouseEvent): HTMLButtonElement | null {
    const target = event.target as HTMLElement | null;
    if (!target) return null;
    const button = target.closest('button');
    return button instanceof HTMLButtonElement ? button : null;
  }

  private isDisabled(button: HTMLButtonElement): boolean {
    return button.disabled || button.getAttribute('aria-disabled') === 'true';
  }

  private isSendButton(button: HTMLButtonElement): boolean {
    if (button.matches('button.send-button, button.submit, #send')) return true;

    const icon = button.querySelector('mat-icon[fonticon="send"], .send-button-icon');
    if (icon) return true;

    const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
    const testId = (button.getAttribute('data-test-id') || '').toLowerCase();
    const classes = button.className.toLowerCase();
    const text = (button.textContent || '').toLowerCase().trim();

    return (
      ariaLabel.includes('send') ||
      testId.includes('send') ||
      classes.includes('send-button') ||
      classes.includes('submit') ||
      text === 'send'
    );
  }
}
