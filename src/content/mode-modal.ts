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
    title.textContent = 'What kind of thinking is this?';
    title.className = 'deliberate-title';

    panel.appendChild(title);
    panel.appendChild(this.makeModeButton('delegation', 'Delegating a mundane task', () => this.finish(root, resolve, { mode: 'delegation' })));
    panel.appendChild(
      this.makeModeButton('problem_solving', 'Solving a core problem', () => this.renderProblemSolvingDetails(panel, root, resolve))
    );
    panel.appendChild(this.makeModeButton('learning', 'Learning / exploring', () => this.renderLearningDetails(panel, root, resolve)));
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
    panel.appendChild(this.makeSubheading('State your current hypothesis'));
    panel.appendChild(this.makeHint(`At least ${PROBLEM_SOLVING_MIN_CHARS} characters.`));

    const input = this.makeTextarea('What do you currently believe is the answer?', 'deliberate-mode-detail-input');
    panel.appendChild(input);

    const count = document.createElement('p');
    count.setAttribute('data-testid', 'deliberate-mode-char-count');
    count.className = 'deliberate-count';
    count.textContent = `0 / ${PROBLEM_SOLVING_MIN_CHARS}`;
    panel.appendChild(count);

    const continueButton = this.makeContinueButton();
    this.setContinueButtonEnabled(continueButton, false);
    continueButton.addEventListener('click', () => {
      this.finish(root, resolve, {
        mode: 'problem_solving',
        prediction: input.value.trim()
      });
    });
    panel.appendChild(continueButton);

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
    panel.appendChild(this.makeSubheading('Capture prior knowledge (optional)'));
    panel.appendChild(this.makeHint('What do you already know about this?'));

    const input = this.makeTextarea('What do you already know about this?', 'deliberate-mode-detail-input');
    panel.appendChild(input);

    const continueButton = this.makeContinueButton();
    this.setContinueButtonEnabled(continueButton, true);
    continueButton.addEventListener('click', () => {
      const priorKnowledgeNote = input.value.trim();
      this.finish(root, resolve, priorKnowledgeNote ? { mode: 'learning', priorKnowledgeNote } : { mode: 'learning' });
    });
    panel.appendChild(continueButton);
  }

  private makeSubheading(text: string): HTMLElement {
    const title = document.createElement('h2');
    title.textContent = text;
    title.className = 'deliberate-subheading';
    return title;
  }

  private makeHint(text: string): HTMLElement {
    const hint = document.createElement('p');
    hint.textContent = text;
    hint.className = 'deliberate-hint';
    return hint;
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
    button.className = 'deliberate-continue';
    button.textContent = 'Continue';
    return button;
  }

  private setContinueButtonEnabled(button: HTMLButtonElement, enabled: boolean): void {
    button.disabled = !enabled;
    button.classList.toggle('deliberate-continue--enabled', enabled);
    button.classList.toggle('deliberate-continue--disabled', !enabled);
  }

  private finish(root: HTMLDivElement, resolve: (submission: LearningCycleSubmission) => void, submission: LearningCycleSubmission): void {
    root.remove();
    this.pending = null;
    resolve(submission);
  }
}
