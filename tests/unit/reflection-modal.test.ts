import { describe, expect, it } from 'vitest';
import type { ReflectionEligibleLearningCycleRecord } from '../../src/shared/types';
import { ReflectionModal } from '../../src/content/reflection-modal';

function makeLearningCycleRecord(
  overrides: Partial<ReflectionEligibleLearningCycleRecord> = {}
): ReflectionEligibleLearningCycleRecord {
  return {
    id: 'record-1',
    timestamp: Date.UTC(2026, 2, 12, 14, 30, 0),
    platform: 'gemini',
    threadId: '/app/threads/thread-a',
    prompt: 'Teach me when staged rollouts backfire.',
    mode: 'learning',
    priorKnowledgeNote: 'I know the basics of feature flags already.',
    ...overrides
  } as ReflectionEligibleLearningCycleRecord;
}

describe('ReflectionModal', () => {
  it('defaults the learning delta to 25 and includes optional notes', async () => {
    document.body.innerHTML = '';
    document.body.style.backgroundColor = 'rgb(255, 255, 255)';
    const modal = new ReflectionModal();
    const pending = modal.open(makeLearningCycleRecord());

    const panel = document.querySelector('[role="dialog"]');
    expect(panel?.classList.contains('deliberate-panel')).toBe(true);
    const root = document.querySelector('[data-testid="deliberate-reflection-modal"]');
    expect(root?.getAttribute('data-deliberate-theme')).toBe('light');

    const title = document.querySelector('#deliberate-reflection-modal-title');
    expect(title?.classList.contains('deliberate-title')).toBe(true);

    const scaleInput = document.querySelector('[data-testid="deliberate-reflection-scale-input"]') as HTMLInputElement;
    expect(scaleInput).toBeTruthy();
    expect(scaleInput.type).toBe('range');
    expect(scaleInput.step).toBe('1');
    expect(scaleInput.value).toBe('25');

    expect(document.querySelector('[data-testid="deliberate-reflection-close"]')).toBeNull();

    const notes = document.querySelector('[data-testid="deliberate-reflection-notes"]') as HTMLTextAreaElement;
    expect(notes.classList.contains('deliberate-input')).toBe(true);
    expect(notes.parentElement?.classList.contains('deliberate-input-shell')).toBe(true);
    expect(notes.parentElement?.classList.contains('deliberate-reflection-notes-shell--primary')).toBe(true);
    expect(notes.placeholder).toBe('What surprised you or changed your mind?');

    const notesSection = document.querySelector('[data-testid="deliberate-reflection-notes-section"]');
    const scoreSection = document.querySelector('[data-testid="deliberate-reflection-scale-section"]');
    const metaSection = document.querySelector('[data-testid="deliberate-reflection-context-section"]');
    expect(metaSection?.classList.contains('deliberate-reflection-context-section--supporting')).toBe(true);
    expect(scoreSection?.compareDocumentPosition(notesSection as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(notesSection?.compareDocumentPosition(metaSection as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(document.querySelector('[data-testid="deliberate-reflection-scale-label"]')).toBeNull();
    expect(document.querySelector('[data-testid="deliberate-reflection-notes-label"]')?.textContent).toBe('Reflection');
    expect(document.querySelector('[data-testid="deliberate-reflection-scale-track"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="deliberate-reflection-scale-fill"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="deliberate-reflection-scale-current"]')).toBeNull();
    expect(document.querySelector('[data-testid="deliberate-reflection-scale-min"]')?.textContent).toBe('No update');
    expect(document.querySelector('[data-testid="deliberate-reflection-scale-max"]')?.textContent).toBe('Major update');
    expect(document.querySelector('[data-testid="deliberate-reflection-scale-stop-25"]')).toBeNull();
    const scaleRow = document.querySelector('[data-testid="deliberate-reflection-scale-row"]');
    expect(scaleRow?.textContent).toContain('No update');
    expect(scaleRow?.textContent).toContain('Major update');

    const submitButton = document.querySelector('[data-testid="deliberate-reflection-submit"]') as HTMLButtonElement;
    expect(submitButton.disabled).toBe(false);
    expect(submitButton.textContent).toBe('Done');
    expect(submitButton.classList.contains('deliberate-reflection-submit-button')).toBe(true);
    const cancelButton = document.querySelector('[data-testid="deliberate-reflection-cancel"]') as HTMLButtonElement;
    expect(cancelButton.textContent).toBe('Cancel');
    expect(cancelButton.classList.contains('deliberate-reflection-cancel-button')).toBe(true);
    expect(notes.parentElement?.contains(submitButton)).toBe(false);
    const actions = document.querySelector('[data-testid="deliberate-reflection-actions"]');
    expect(actions?.contains(submitButton)).toBe(true);
    expect(actions?.contains(cancelButton)).toBe(true);
    expect(actions?.classList.contains('deliberate-reflection-actions')).toBe(true);

    scaleInput.value = '74';
    scaleInput.dispatchEvent(new Event('input', { bubbles: true }));

    notes.value = 'I should compare rollout learning goals against blast-radius risk earlier.';
    notes.dispatchEvent(new Event('input', { bubbles: true }));

    submitButton.click();

    await expect(pending).resolves.toEqual({
      score: 75,
      notes: 'I should compare rollout learning goals against blast-radius risk earlier.'
    });
    document.body.style.backgroundColor = '';
  });

  it('renders prompt and prior context as multiline text blocks instead of textareas', async () => {
    document.body.innerHTML = '';
    const modal = new ReflectionModal();
    const pending = modal.open(
      makeLearningCycleRecord({
        prompt: 'Line one of the prompt.\nLine two of the prompt.',
        priorKnowledgeNote: 'Context line one.\nContext line two.'
      })
    );

    const textareas = Array.from(document.querySelectorAll('textarea'));
    expect(textareas).toHaveLength(1);
    expect(textareas[0]?.getAttribute('data-testid')).toBe('deliberate-reflection-notes');

    const promptValue = document.querySelector('[data-testid="deliberate-reflection-prompt-value"]');
    const contextValue = document.querySelector('[data-testid="deliberate-reflection-context-value"]');
    const promptLabel = document.querySelector('[data-testid="deliberate-reflection-prompt-label"]');

    expect(promptValue?.textContent).toBe('Line one of the prompt.\nLine two of the prompt.');
    expect(contextValue?.textContent).toBe('Context line one.\nContext line two.');
    expect(promptLabel?.textContent).toContain('Prompt (');
    expect(promptLabel?.classList.contains('deliberate-reflection-meta-label--muted')).toBe(true);

    (document.querySelector('[data-testid="deliberate-reflection-cancel"]') as HTMLButtonElement).click();
    await expect(pending).resolves.toBeNull();
  });

  it('omits the prior context row when its value is blank', async () => {
    document.body.innerHTML = '';
    const modal = new ReflectionModal();
    const pending = modal.open(
      makeLearningCycleRecord({
        priorKnowledgeNote: '   '
      })
    );

    expect(document.querySelector('[data-testid="deliberate-reflection-context-value"]')).toBeNull();
    expect(document.querySelector('[data-testid="deliberate-reflection-context-label"]')).toBeNull();
    expect(document.querySelector('[data-testid="deliberate-reflection-prompt-value"]')?.textContent).toBe(
      'Teach me when staged rollouts backfire.'
    );

    (document.querySelector('[data-testid="deliberate-reflection-cancel"]') as HTMLButtonElement).click();
    await expect(pending).resolves.toBeNull();
  });

  it('closes without resolving the reflection when cancel is used', async () => {
    document.body.innerHTML = '';
    const modal = new ReflectionModal();
    const pending = modal.open(makeLearningCycleRecord({ mode: 'problem_solving', prediction: 'Start with a canary cohort first.' }));

    (document.querySelector('[data-testid="deliberate-reflection-cancel"]') as HTMLButtonElement).click();

    await expect(pending).resolves.toBeNull();
    expect(document.querySelector('[data-testid="deliberate-reflection-modal"]')).toBeNull();
  });

  it('reuses the same pending promise while already open', async () => {
    document.body.innerHTML = '';
    const modal = new ReflectionModal();
    const first = modal.open(makeLearningCycleRecord());
    const second = modal.open(makeLearningCycleRecord({ id: 'record-2' }));

    expect(first).toBe(second);
    const scaleInput = document.querySelector('[data-testid="deliberate-reflection-scale-input"]') as HTMLInputElement;
    scaleInput.value = '62';
    scaleInput.dispatchEvent(new Event('input', { bubbles: true }));
    (document.querySelector('[data-testid="deliberate-reflection-submit"]') as HTMLButtonElement).click();

    await expect(first).resolves.toEqual({ score: 50 });
  });

  it('uses dark theme styling when the page background is dark', async () => {
    document.body.innerHTML = '';
    document.body.style.backgroundColor = 'rgb(15, 23, 42)';

    const modal = new ReflectionModal();
    const pending = modal.open(makeLearningCycleRecord());
    const root = document.querySelector('[data-testid="deliberate-reflection-modal"]');

    expect(root?.getAttribute('data-deliberate-theme')).toBe('dark');
    expect(document.querySelector('[data-testid="deliberate-reflection-context-section"]')?.classList.contains('deliberate-reflection-context-section--supporting')).toBe(true);

    (document.querySelector('[data-testid="deliberate-reflection-cancel"]') as HTMLButtonElement).click();
    await expect(pending).resolves.toBeNull();
    document.body.style.backgroundColor = '';
  });
});
