import type { SubmitSignal, Unsubscribe } from '../shared/types';

export interface InterceptDetector {
  start(): void;
  stop(): void;
  onSignal(handler: (signal: SubmitSignal) => void): Unsubscribe;
}

export class GeminiInterceptDetector implements InterceptDetector {
  private readonly handlers = new Set<(signal: SubmitSignal) => void>();
  private started = false;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter') return;
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;

    this.emit('enter_key');
  };

  private readonly onClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const button = target.closest('button');
    if (!button) return;
    if (this.isDisabled(button)) return;
    if (!this.isSendButton(button)) return;

    this.emit('send_button');
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

  onSignal(handler: (signal: SubmitSignal) => void): Unsubscribe {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  private emit(source: SubmitSignal['source']): void {
    const signal: SubmitSignal = {
      source,
      timestamp: Date.now(),
      url: window.location.href,
      platform: 'gemini',
      hasPromptInput: this.hasPromptInput()
    };

    this.handlers.forEach((handler) => handler(signal));
  }

  private hasPromptInput(): boolean {
    const textarea = document.querySelector('textarea');
    if (textarea instanceof HTMLTextAreaElement) {
      return textarea.value.trim().length > 0;
    }

    const textbox = document.querySelector<HTMLElement>('[contenteditable="true"][role="textbox"], div[contenteditable="true"]');
    if (!textbox) return false;
    return (textbox.textContent || '').trim().length > 0;
  }

  private isDisabled(button: HTMLButtonElement): boolean {
    return button.disabled || button.getAttribute('aria-disabled') === 'true';
  }

  private isSendButton(button: HTMLButtonElement): boolean {
    // Gemini-specific markers observed in production DOM.
    if (button.matches('button.send-button, button.submit')) return true;

    const icon = button.querySelector('mat-icon[fonticon="send"], .send-button-icon');
    if (icon) return true;

    // Generic fallbacks across possible UI changes.
    const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
    const testId = (button.getAttribute('data-test-id') || '').toLowerCase();
    const classes = button.className.toLowerCase();
    const jslog = (button.getAttribute('jslog') || '').toLowerCase();
    const text = (button.textContent || '').toLowerCase().trim();

    return (
      ariaLabel.includes('send') ||
      testId.includes('send') ||
      classes.includes('send-button') ||
      classes.includes('submit') ||
      jslog.includes('generic_click') ||
      text === 'send'
    );
  }
}
