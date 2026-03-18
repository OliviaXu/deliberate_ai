import { INTERACTION_MODES, type ReflectionEligibleLearningCycleRecord, type ReflectionScore, type ReflectionSubmission } from '../shared/types';

const MODAL_ROOT_ID = 'deliberate-reflection-modal-root';
const SCORES: ReflectionScore[] = [0, 25, 50, 75, 100];
const DEFAULT_REFLECTION_SCORE: ReflectionScore = 25;

export class ReflectionModal {
  private pending: Promise<ReflectionSubmission | null> | null = null;

  open(record: ReflectionEligibleLearningCycleRecord): Promise<ReflectionSubmission | null> {
    if (this.pending) return this.pending;
    this.pending = this.render(record);
    return this.pending;
  }

  private render(record: ReflectionEligibleLearningCycleRecord): Promise<ReflectionSubmission | null> {
    return new Promise<ReflectionSubmission | null>((resolve) => {
      const existing = document.getElementById(MODAL_ROOT_ID);
      if (existing) existing.remove();

      const root = document.createElement('div');
      root.id = MODAL_ROOT_ID;
      root.setAttribute('data-testid', 'deliberate-reflection-modal');
      root.setAttribute('data-deliberate-theme', this.resolveTheme());

      const panel = document.createElement('section');
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-labelledby', 'deliberate-reflection-modal-title');
      panel.className = 'deliberate-panel deliberate-reflection-panel';

      const header = document.createElement('div');
      header.className = 'deliberate-reflection-header';

      const title = document.createElement('h2');
      title.id = 'deliberate-reflection-modal-title';
      title.className = 'deliberate-title deliberate-reflection-title';
      title.textContent = 'How much did this update your thinking?';
      header.appendChild(title);

      const notesLabel = document.createElement('label');
      notesLabel.className = 'deliberate-reflection-section-label';
      notesLabel.setAttribute('for', 'deliberate-reflection-notes');
      notesLabel.setAttribute('data-testid', 'deliberate-reflection-notes-label');
      notesLabel.textContent = 'Reflection';

      const notes = document.createElement('textarea');
      notes.id = 'deliberate-reflection-notes';
      notes.className = 'deliberate-input deliberate-reflection-notes';
      notes.rows = 4;
      notes.placeholder = 'What surprised you or changed your mind?';
      notes.setAttribute('data-testid', 'deliberate-reflection-notes');

      const notesShell = document.createElement('div');
      notesShell.className = 'deliberate-input-shell deliberate-reflection-notes-shell deliberate-reflection-notes-shell--primary';
      notesShell.appendChild(notes);

      const notesSection = document.createElement('section');
      notesSection.className = 'deliberate-reflection-notes-section';
      notesSection.setAttribute('data-testid', 'deliberate-reflection-notes-section');
      notesSection.append(notesLabel, notesShell);

      const minStop = document.createElement('span');
      minStop.className = 'deliberate-reflection-scale-endpoint';
      minStop.setAttribute('data-testid', 'deliberate-reflection-scale-min');
      minStop.textContent = 'No update';

      const maxStop = document.createElement('span');
      maxStop.className = 'deliberate-reflection-scale-endpoint';
      maxStop.setAttribute('data-testid', 'deliberate-reflection-scale-max');
      maxStop.textContent = 'Major update';

      const scaleRail = document.createElement('div');
      scaleRail.className = 'deliberate-reflection-scale-rail';
      scaleRail.setAttribute('data-testid', 'deliberate-reflection-scale-track');

      const scaleFill = document.createElement('div');
      scaleFill.className = 'deliberate-reflection-scale-fill';
      scaleFill.setAttribute('data-testid', 'deliberate-reflection-scale-fill');

      const scaleInput = document.createElement('input');
      scaleInput.type = 'range';
      scaleInput.min = '0';
      scaleInput.max = '100';
      scaleInput.step = '1';
      scaleInput.value = String(DEFAULT_REFLECTION_SCORE);
      scaleInput.className = 'deliberate-reflection-scale-input';
      scaleInput.setAttribute('data-testid', 'deliberate-reflection-scale-input');
      scaleInput.setAttribute('aria-label', 'Learning delta');

      const scaleTrackShell = document.createElement('div');
      scaleTrackShell.className = 'deliberate-reflection-scale-track-shell';
      scaleTrackShell.append(scaleRail, scaleFill, scaleInput);

      const scaleRow = document.createElement('div');
      scaleRow.className = 'deliberate-reflection-scale-row';
      scaleRow.setAttribute('data-testid', 'deliberate-reflection-scale-row');
      scaleRow.append(minStop, scaleTrackShell, maxStop);

      const scaleSection = document.createElement('section');
      scaleSection.className = 'deliberate-reflection-scale-section';
      scaleSection.setAttribute('data-testid', 'deliberate-reflection-scale-section');
      scaleSection.append(scaleRow);

      const contextSection = document.createElement('section');
      contextSection.className = 'deliberate-reflection-context-section deliberate-reflection-context-section--supporting';
      contextSection.setAttribute('data-testid', 'deliberate-reflection-context-section');
      const contextValue = this.getContextValue(record);
      if (contextValue) {
        contextSection.appendChild(
          this.makeMetaRow({
            label: this.getContextLabel(record.mode),
            value: contextValue,
            labelTestId: 'deliberate-reflection-context-label',
            valueTestId: 'deliberate-reflection-context-value'
          })
        );
      } else {
        contextSection.classList.add('deliberate-reflection-context-section--prompt-only');
      }
      contextSection.appendChild(
        this.makeMetaRow({
          label: `Prompt (${this.formatTimestamp(record.timestamp)})`,
          value: record.prompt,
          labelTestId: 'deliberate-reflection-prompt-label',
          valueTestId: 'deliberate-reflection-prompt-value',
          mutedLabel: true
        })
      );

      const actions = document.createElement('div');
      actions.className = 'deliberate-reflection-actions';
      actions.setAttribute('data-testid', 'deliberate-reflection-actions');
      if (!contextValue) {
        actions.classList.add('deliberate-reflection-actions--prompt-only');
      }

      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.className = 'deliberate-reflection-cancel-button';
      cancelButton.setAttribute('data-testid', 'deliberate-reflection-cancel');
      cancelButton.textContent = 'Cancel';
      cancelButton.addEventListener('click', () => this.finish(root, resolve, null));
      actions.appendChild(cancelButton);

      const submitButton = document.createElement('button');
      submitButton.type = 'button';
      submitButton.className = 'deliberate-reflection-submit-button';
      submitButton.setAttribute('data-testid', 'deliberate-reflection-submit');
      submitButton.setAttribute('aria-label', 'Submit reflection');
      submitButton.textContent = 'Done';
      submitButton.disabled = false;
      actions.appendChild(submitButton);

      let sliderValue = Number(DEFAULT_REFLECTION_SCORE);
      const syncSliderProgress = (): void => {
        scaleTrackShell.style.setProperty('--deliberate-reflection-scale-progress', String(sliderValue / 100));
      };
      syncSliderProgress();

      scaleInput.addEventListener('input', () => {
        sliderValue = Number(scaleInput.value);
        syncSliderProgress();
      });

      scaleInput.addEventListener('change', () => {
        sliderValue = quantizeReflectionScore(Number(scaleInput.value));
        scaleInput.value = String(sliderValue);
        syncSliderProgress();
      });

      submitButton.addEventListener('click', () => {
        const score = quantizeReflectionScore(sliderValue);
        const trimmedNotes = notes.value.trim();
        this.finish(
          root,
          resolve,
          trimmedNotes ? { score, notes: trimmedNotes } : { score }
        );
      });

      root.addEventListener('click', (event) => {
        if (event.target === root) {
          this.finish(root, resolve, null);
        }
      });

      panel.append(header, scaleSection, notesSection, contextSection, actions);
      root.appendChild(panel);
      document.body.appendChild(root);
    });
  }

  private makeMetaRow(params: {
    label: string;
    value: string;
    labelTestId?: string;
    valueTestId?: string;
    mutedLabel?: boolean;
    mutedValue?: boolean;
  }): HTMLElement {
    const { label, value, labelTestId, valueTestId, mutedLabel = false, mutedValue = false } = params;
    const row = document.createElement('div');
    row.className =
      mutedLabel || mutedValue
        ? 'deliberate-reflection-meta-row deliberate-reflection-meta-row--muted'
        : 'deliberate-reflection-meta-row';

    const labelEl = document.createElement('p');
    labelEl.className = mutedLabel
      ? 'deliberate-reflection-meta-label deliberate-reflection-meta-label--muted'
      : 'deliberate-reflection-meta-label';
    labelEl.textContent = label;
    if (labelTestId) {
      labelEl.setAttribute('data-testid', labelTestId);
    }

    const valueEl = document.createElement('p');
    valueEl.className = mutedValue
      ? 'deliberate-reflection-meta-value deliberate-reflection-meta-value--muted'
      : 'deliberate-reflection-meta-value';
    valueEl.textContent = value;
    if (valueTestId) {
      valueEl.setAttribute('data-testid', valueTestId);
    }

    row.append(labelEl, valueEl);
    return row;
  }

  private getContextLabel(mode: ReflectionEligibleLearningCycleRecord['mode']): string {
    return mode === INTERACTION_MODES.PROBLEM_SOLVING ? 'Prediction' : 'Prior context';
  }

  private getContextValue(record: ReflectionEligibleLearningCycleRecord): string | null {
    return record.mode === INTERACTION_MODES.PROBLEM_SOLVING
      ? this.normalizeOptionalText(record.prediction)
      : null;
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private formatTimestamp(timestamp: number): string {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(timestamp);
  }

  private finish(
    root: HTMLDivElement,
    resolve: (submission: ReflectionSubmission | null) => void,
    submission: ReflectionSubmission | null
  ): void {
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

function quantizeReflectionScore(value: number): ReflectionScore {
  if (value < 12.5) return 0;
  if (value < 37.5) return 25;
  if (value < 62.5) return 50;
  if (value < 87.5) return 75;
  return 100;
}
