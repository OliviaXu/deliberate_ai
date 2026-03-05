import type { InteractionMode, LearningCycleSubmission } from '../shared/types';

const MODAL_ROOT_ID = 'deliberate-mode-modal-root';
const PROBLEM_SOLVING_MIN_CHARS = 100;

export class ModeSelectionModal {
  private pending: Promise<LearningCycleSubmission> | null = null;

  open(): Promise<LearningCycleSubmission> {
    if (this.pending) return this.pending;
    this.pending = this.render();
    return this.pending;
  }

  private render(): Promise<LearningCycleSubmission> {
    return new Promise<LearningCycleSubmission>((resolve) => {
      const existing = document.getElementById(MODAL_ROOT_ID);
      if (existing) existing.remove();

      const root = document.createElement('div');
      root.id = MODAL_ROOT_ID;
      root.setAttribute('data-testid', 'deliberate-mode-modal');
      root.setAttribute('data-deliberate-theme', this.resolveTheme());

      const panel = document.createElement('section');
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.className = 'deliberate-panel';

      this.renderModeSelection({
        panel,
        root,
        resolve
      });
      root.appendChild(panel);
      document.body.appendChild(root);
    });
  }

  private renderModeSelection(params: {
    panel: HTMLElement;
    root: HTMLDivElement;
    resolve: (submission: LearningCycleSubmission) => void;
  }): void {
    const { panel, root, resolve } = params;
    panel.replaceChildren();

    const title = document.createElement('h2');
    title.textContent = "I'm trying to";
    title.className = 'deliberate-title';
    panel.appendChild(title);

    const stack = document.createElement('div');
    stack.className = 'deliberate-mode-stack';
    stack.appendChild(this.makeModeButton('delegation', 'delegate a mundane task', () => this.finish(root, resolve, { mode: 'delegation' })));
    stack.appendChild(
      this.makeModeButton('problem_solving', 'solve a core problem', () => this.renderProblemSolvingDetails(panel, root, resolve))
    );
    stack.appendChild(this.makeModeButton('learning', 'learn / explore', () => this.renderLearningDetails(panel, root, resolve)));
    panel.appendChild(stack);
  }

  private makeModeButton(mode: InteractionMode, label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('data-testid', `deliberate-mode-option-${mode}`);
    button.className = 'deliberate-mode-button';
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  private renderProblemSolvingDetails(
    panel: HTMLElement,
    root: HTMLDivElement,
    resolve: (submission: LearningCycleSubmission) => void
  ): void {
    panel.replaceChildren();

    const card = document.createElement('div');
    card.className = 'deliberate-detail-card';

    const input = this.makeTextarea('My current thinking is... (at least 100 characters)', 'deliberate-mode-detail-input');
    const inputShell = document.createElement('div');
    inputShell.className = 'deliberate-input-shell';
    inputShell.appendChild(input);

    const count = document.createElement('p');
    count.setAttribute('data-testid', 'deliberate-mode-char-count');
    count.className = 'deliberate-count';
    count.textContent = `0 / ${PROBLEM_SOLVING_MIN_CHARS}`;

    const continueButton = this.makeContinueButton();
    this.setContinueButtonEnabled(continueButton, false);
    const submit = (): void => {
      this.finish(root, resolve, {
        mode: 'problem_solving',
        prediction: input.value.trim()
      });
    };
    continueButton.addEventListener('click', submit);
    this.bindEnterToContinue(input, continueButton, submit);
    inputShell.appendChild(continueButton);
    card.appendChild(inputShell);
    card.appendChild(count);
    panel.appendChild(card);

    input.addEventListener('input', () => {
      const current = input.value.trim().length;
      count.textContent = `${current} / ${PROBLEM_SOLVING_MIN_CHARS}`;
      this.setContinueButtonEnabled(continueButton, current >= PROBLEM_SOLVING_MIN_CHARS);
    });
  }

  private renderLearningDetails(
    panel: HTMLElement,
    root: HTMLDivElement,
    resolve: (submission: LearningCycleSubmission) => void
  ): void {
    panel.replaceChildren();

    const card = document.createElement('div');
    card.className = 'deliberate-detail-card';

    const input = this.makeTextarea('What I already know...', 'deliberate-mode-detail-input');
    const inputShell = document.createElement('div');
    inputShell.className = 'deliberate-input-shell';
    inputShell.appendChild(input);

    const continueButton = this.makeContinueButton();
    this.setContinueButtonEnabled(continueButton, true);
    const submit = (): void => {
      const priorKnowledgeNote = input.value.trim();
      this.finish(root, resolve, priorKnowledgeNote ? { mode: 'learning', priorKnowledgeNote } : { mode: 'learning' });
    };
    continueButton.addEventListener('click', submit);
    this.bindEnterToContinue(input, continueButton, submit);
    inputShell.appendChild(continueButton);
    card.appendChild(inputShell);
    panel.appendChild(card);
  }

  private makeTextarea(placeholder: string, testId: string): HTMLTextAreaElement {
    const input = document.createElement('textarea');
    input.setAttribute('data-testid', testId);
    input.placeholder = placeholder;
    input.rows = 5;
    input.className = 'deliberate-input';
    return input;
  }

  private makeContinueButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('data-testid', 'deliberate-mode-continue');
    button.setAttribute('aria-label', 'Continue');
    button.title = 'Continue';
    button.className = 'deliberate-continue';
    button.textContent = '➤';
    return button;
  }

  private setContinueButtonEnabled(button: HTMLButtonElement, enabled: boolean): void {
    button.disabled = !enabled;
    button.classList.toggle('deliberate-continue--enabled', enabled);
    button.classList.toggle('deliberate-continue--disabled', !enabled);
    button.classList.toggle('deliberate-continue--hidden', !enabled);
    button.setAttribute('aria-hidden', String(!enabled));
  }

  private bindEnterToContinue(input: HTMLTextAreaElement, button: HTMLButtonElement, submit: () => void): void {
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
      if (button.disabled) return;
      event.preventDefault();
      submit();
    });
  }

  private finish(root: HTMLDivElement, resolve: (submission: LearningCycleSubmission) => void, submission: LearningCycleSubmission): void {
    root.remove();
    this.pending = null;
    resolve(submission);
  }

  private resolveTheme(): 'light' | 'dark' {
    const bodyLuminance = this.readLuminance(window.getComputedStyle(document.body).backgroundColor);
    const documentLuminance = this.readLuminance(window.getComputedStyle(document.documentElement).backgroundColor);
    const luminance = bodyLuminance ?? documentLuminance;

    if (typeof luminance === 'number') {
      return luminance < 0.42 ? 'dark' : 'light';
    }

    if (typeof window.matchMedia !== 'function') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private readLuminance(color: string): number | null {
    const normalized = color.trim().toLowerCase();
    if (normalized === 'transparent') return null;

    const match = normalized.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?/i);
    if (!match) return null;
    const alpha = typeof match[4] === 'string' ? Number(match[4]) : 1;
    if (Number.isFinite(alpha) && alpha <= 0.05) return null;

    const red = Number(match[1]);
    const green = Number(match[2]);
    const blue = Number(match[3]);
    return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  }
}
