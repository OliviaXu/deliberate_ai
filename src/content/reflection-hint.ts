import type { PlatformDefinition } from '../platforms';
import { resolveDeliberateTheme } from './theme';

interface ReflectionHintOptions {
  onReview?: (threadId: string) => Promise<void> | void;
  platform: Pick<PlatformDefinition, 'appearance' | 'findComposer' | 'findComposerAnchor'>;
}

export class ReflectionHint {
  private root: HTMLDivElement | null = null;
  private anchor: HTMLElement | null = null;
  private currentThreadId = 'unknown';
  private readonly platform: Pick<PlatformDefinition, 'appearance' | 'findComposer' | 'findComposerAnchor'>;
  private readonly onReview: (threadId: string) => Promise<void> | void;

  constructor(options: ReflectionHintOptions) {
    this.platform = options.platform;
    this.onReview =
      options.onReview ||
      ((threadId) => {
        console.info('deliberate-reflection-hint-review', { threadId });
      });
  }

  updateVisibilityForThread(threadId: string, visible: boolean): void {
    this.currentThreadId = threadId;
    if (!visible) {
      this.detach();
      return;
    }

    this.attachNearComposer(threadId);
  }

  private attachNearComposer(threadId: string): void {
    const root = this.getOrCreateRoot();
    root.setAttribute('data-deliberate-thread-id', threadId);
    root.setAttribute('data-deliberate-theme', resolveDeliberateTheme());

    const composer = this.platform.findComposer();
    const anchor = composer ? this.platform.findComposerAnchor(composer) : null;
    if (anchor) {
      if (this.anchor && this.anchor !== anchor) {
        this.anchor.classList.remove('deliberate-reflection-hint-anchor');
      }
      anchor.classList.add('deliberate-reflection-hint-anchor');
      anchor.appendChild(root);
      this.anchor = anchor;
      return;
    }

    if (this.anchor) {
      this.anchor.classList.remove('deliberate-reflection-hint-anchor');
      this.anchor = null;
    }
    document.body.appendChild(root);
  }

  private detach(): void {
    this.root?.remove();
    if (this.anchor) {
      this.anchor.classList.remove('deliberate-reflection-hint-anchor');
      this.anchor = null;
    }
  }

  private getOrCreateRoot(): HTMLDivElement {
    if (this.root) return this.root;

    const root = document.createElement('div');
    root.id = 'deliberate-reflection-hint-root';
    root.setAttribute('data-testid', 'deliberate-reflection-hint');
    root.setAttribute('data-deliberate-platform-skin', this.platform.appearance.skin);
    root.className = 'deliberate-reflection-hint deliberate-reflection-hint--floaty';

    const label = document.createElement('span');
    label.className = 'deliberate-reflection-hint__label';
    label.textContent = 'Time to';

    const reviewButton = document.createElement('button');
    reviewButton.type = 'button';
    reviewButton.className = 'deliberate-reflection-hint__review deliberate-reflection-hint__review--subtle';
    reviewButton.setAttribute('data-testid', 'deliberate-reflection-hint-review');
    reviewButton.textContent = 'reflect';
    reviewButton.addEventListener('click', () => {
      void this.onReview(this.currentThreadId);
    });

    root.append(label, reviewButton);
    this.root = root;
    return root;
  }
}
