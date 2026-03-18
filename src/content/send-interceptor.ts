import type { InterceptedSubmitIntent, SubmitSource, Unsubscribe } from '../shared/types';
import type { Logger } from '../shared/logger';
import { getContentNowMs } from './clock';
import { findGeminiComposer, isGeminiComposerElement, resolveGeminiComposerNear } from './gemini-composer';

interface InternalSubmitIntent extends InterceptedSubmitIntent {
  button: HTMLButtonElement | null;
  composer: HTMLElement | null;
}

interface ResumableSubmitIntent {
  emittedIntent: InterceptedSubmitIntent;
  replayIntent: InternalSubmitIntent;
}

const DELIBERATE_MODAL_ROOT_SELECTOR = '#deliberate-mode-modal-root, #deliberate-reflection-modal-root';

export class GeminiSendInterceptor {
  constructor(private readonly logger?: Pick<Logger, 'debug' | 'info'>) {}

  private readonly handlers = new Set<(intent: InterceptedSubmitIntent) => void>();
  private started = false;
  // One-shot gate used to let our synthetic "resume send" event pass through.
  private bypassNextInterception = false;
  private lastResumableIntent: ResumableSubmitIntent | null = null;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.isSubmitKeyEvent(event)) return;
    if (this.isEventWithinDeliberateModal(event.target)) return;
    const eventComposer = this.resolveComposerFromEvent(event);
    if (!eventComposer) {
      this.logger?.debug('composer-resolution-enter-fallback-to-active');
    }

    const composer = eventComposer ?? this.resolveActiveComposer();
    if (!composer) return;
    if (!event.isTrusted && !this.bypassNextInterception) return;
    this.intercept(event, 'enter_key', composer, null);
  };

  private readonly onClick = (event: MouseEvent): void => {
    if (this.isEventWithinDeliberateModal(event.target)) return;
    const button = this.resolveButtonFromEvent(event);
    if (!button) return;
    if (this.isDisabled(button)) return;
    if (!this.isSendButton(button)) return;
    if (!event.isTrusted && !this.bypassNextInterception) return;
    const composer = this.resolveComposerForClick(button);
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
    if (!intent.prompt.trim()) {
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
    const prompt = composer ? this.getComposerText(composer) : '';
    return {
      source,
      timestamp: getContentNowMs(),
      url: window.location.href,
      platform: 'gemini',
      prompt,
      button,
      composer
    };
  }

  private emitIntent(intent: InternalSubmitIntent): void {
    const emittedIntent: InterceptedSubmitIntent = {
      source: intent.source,
      timestamp: intent.timestamp,
      url: intent.url,
      platform: intent.platform,
      prompt: intent.prompt
    };
    this.lastResumableIntent = {
      emittedIntent,
      replayIntent: intent
    };
    this.handlers.forEach((handler) => handler(emittedIntent));
  }

  private resolveIntentForResume(intent: InterceptedSubmitIntent): InternalSubmitIntent | null {
    if (this.lastResumableIntent?.emittedIntent !== intent) return null;
    return this.lastResumableIntent.replayIntent;
  }

  private consumeBypassIfSet(): boolean {
    // Consume-on-read keeps bypass strictly one-shot and prevents stale unlocks.
    const shouldBypass = this.bypassNextInterception;
    this.bypassNextInterception = false;
    return shouldBypass;
  }

  private tryResumeByButtonThenEnter(intent: InternalSubmitIntent): boolean {
    if (this.resumeByClick(intent.button)) return true;
    this.logger?.info('resume-fallback-button-to-enter');
    return this.resumeByEnter(intent.composer);
  }

  private tryResumeByClickThenEnter(intent: InternalSubmitIntent): boolean {
    if (this.resumeByClick(this.resolveSendButton())) return true;
    this.logger?.info('resume-fallback-click-to-enter');
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

  private isEventWithinDeliberateModal(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(target.closest(DELIBERATE_MODAL_ROOT_SELECTOR));
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

  private resolveComposerForClick(button: HTMLButtonElement): HTMLElement | null {
    const activeComposer = this.resolveActiveComposer();
    if (activeComposer) return activeComposer;

    const nearbyComposer = this.resolveComposerNear(button);
    if (nearbyComposer) return nearbyComposer;

    const firstComposer = findGeminiComposer();
    if (firstComposer) return firstComposer;

    return null;
  }

  private resolveComposerNear(element: HTMLElement): HTMLElement | null {
    if (isGeminiComposerElement(element)) return element;
    return resolveGeminiComposerNear(element);
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
