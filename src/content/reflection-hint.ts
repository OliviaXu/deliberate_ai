import { isConcreteGeminiThreadId, isPlaceholderGeminiThreadId } from '../shared/thread-id';

interface ReflectionHintOptions {
  onReview?: (threadId: string) => void;
}

const COMPOSER_SELECTOR = [
  '#composer',
  'textarea',
  '.ql-editor.textarea[contenteditable="true"][role="textbox"]',
  '[contenteditable="true"][role="textbox"][aria-label*="prompt"][aria-label*="Gemini"]',
  'rich-textarea [contenteditable="true"][role="textbox"]'
].join(', ');

export class ReflectionHint {
  private readonly trackedConcreteThreads = new Set<string>();
  private hasPendingPlaceholderHint = false;
  private root: HTMLDivElement | null = null;
  private currentThreadId = 'unknown';
  private readonly onReview: (threadId: string) => void;

  constructor(options: ReflectionHintOptions = {}) {
    this.onReview =
      options.onReview ||
      ((threadId) => {
        console.info('deliberate-reflection-hint-review', { threadId });
      });
  }

  markThreadEligibleForHint(threadId: string): void {
    if (!threadId || threadId === 'unknown') return;
    if (isPlaceholderGeminiThreadId(threadId)) {
      this.hasPendingPlaceholderHint = true;
      return;
    }
    if (isConcreteGeminiThreadId(threadId)) {
      this.trackedConcreteThreads.add(threadId);
    }
  }

  updateVisibilityForThread(threadId: string): void {
    this.currentThreadId = threadId;
    if (this.hasPendingPlaceholderHint && isConcreteGeminiThreadId(threadId)) {
      this.trackedConcreteThreads.add(threadId);
      this.hasPendingPlaceholderHint = false;
    }

    if (!this.shouldShowForThread(threadId)) {
      this.detach();
      return;
    }

    this.attachNearComposer(threadId);
  }

  private attachNearComposer(threadId: string): void {
    const root = this.getOrCreateRoot();
    root.setAttribute('data-deliberate-thread-id', threadId);

    const composer = document.querySelector<HTMLElement>(COMPOSER_SELECTOR);
    const parent = composer?.parentElement;
    if (parent && composer) {
      parent.insertBefore(root, composer);
      return;
    }

    document.body.appendChild(root);
  }

  private detach(): void {
    this.root?.remove();
  }

  private shouldShowForThread(threadId: string): boolean {
    if (isPlaceholderGeminiThreadId(threadId)) {
      return this.hasPendingPlaceholderHint;
    }
    return this.trackedConcreteThreads.has(threadId);
  }

  private getOrCreateRoot(): HTMLDivElement {
    if (this.root) return this.root;

    const root = document.createElement('div');
    root.id = 'deliberate-reflection-hint-root';
    root.setAttribute('data-testid', 'deliberate-reflection-hint');
    root.className = 'deliberate-reflection-hint';

    const label = document.createElement('span');
    label.className = 'deliberate-reflection-hint__label';
    label.textContent = 'Reflection available';

    const reviewButton = document.createElement('button');
    reviewButton.type = 'button';
    reviewButton.className = 'deliberate-reflection-hint__review';
    reviewButton.setAttribute('data-testid', 'deliberate-reflection-hint-review');
    reviewButton.textContent = 'Review';
    reviewButton.addEventListener('click', () => {
      this.onReview(this.currentThreadId);
    });

    root.append(label, reviewButton);
    this.root = root;
    return root;
  }
}
