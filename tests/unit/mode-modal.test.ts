import { describe, expect, it } from 'vitest';
import { ModeSelectionModal } from '../../src/content/mode-modal';

describe('ModeSelectionModal', () => {
  it('marks the root with the Claude platform skin when requested', () => {
    document.body.innerHTML = '';
    const modal = new ModeSelectionModal({ platformSkin: 'claude' });

    void modal.open();

    const modalRoot = document.querySelector('[data-testid="deliberate-mode-modal"]');
    expect(modalRoot?.getAttribute('data-deliberate-platform-skin')).toBe('claude');
  });

  it('delegation resolves immediately on mode selection', async () => {
    document.body.innerHTML = '';
    const modal = new ModeSelectionModal();
    const selectionPromise = modal.open();

    const modalRoot = document.querySelector('[data-testid="deliberate-mode-modal"]');
    expect(modalRoot).toBeTruthy();

    const option = document.querySelector('[data-testid="deliberate-mode-option-delegation"]');
    expect(option).toBeTruthy();
    (option as HTMLButtonElement).click();

    await expect(selectionPromise).resolves.toEqual({
      mode: 'delegation'
    });
    expect(document.querySelector('[data-testid="deliberate-mode-modal"]')).toBeNull();
  });

  it('problem solving requires at least 100 chars before continue', async () => {
    document.body.innerHTML = '';
    const modal = new ModeSelectionModal();
    const pending = modal.open();

    (document.querySelector('[data-testid="deliberate-mode-option-problem_solving"]') as HTMLButtonElement).click();

    const input = document.querySelector('[data-testid="deliberate-mode-detail-input"]') as HTMLTextAreaElement;
    const continueButton = document.querySelector('[data-testid="deliberate-mode-continue"]') as HTMLButtonElement;

    expect(input).toBeTruthy();
    expect(continueButton.disabled).toBe(true);

    input.value = 'short text';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(continueButton.disabled).toBe(true);

    input.value = 'x'.repeat(100);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(continueButton.disabled).toBe(false);

    continueButton.click();
    await expect(pending).resolves.toEqual({
      mode: 'problem_solving',
      prediction: 'x'.repeat(100)
    });
  });

  it('learning mode accepts optional prior knowledge note', async () => {
    document.body.innerHTML = '';
    const modal = new ModeSelectionModal();
    const pending = modal.open();

    (document.querySelector('[data-testid="deliberate-mode-option-learning"]') as HTMLButtonElement).click();

    const input = document.querySelector('[data-testid="deliberate-mode-detail-input"]') as HTMLTextAreaElement;
    const continueButton = document.querySelector('[data-testid="deliberate-mode-continue"]') as HTMLButtonElement;

    expect(input).toBeTruthy();
    expect(continueButton.disabled).toBe(false);

    continueButton.click();
    await expect(pending).resolves.toEqual({
      mode: 'learning'
    });
  });

  it('learning details submit on Enter', async () => {
    document.body.innerHTML = '';
    const modal = new ModeSelectionModal();
    const pending = modal.open();

    (document.querySelector('[data-testid="deliberate-mode-option-learning"]') as HTMLButtonElement).click();

    const input = document.querySelector('[data-testid="deliberate-mode-detail-input"]') as HTMLTextAreaElement;
    input.value = 'Existing context';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

    await expect(pending).resolves.toEqual({
      mode: 'learning',
      priorKnowledgeNote: 'Existing context'
    });
  });

  it('reuses the same pending promise while already open', async () => {
    document.body.innerHTML = '';
    const modal = new ModeSelectionModal();
    const first = modal.open();
    const second = modal.open();

    expect(first).toBe(second);
    (document.querySelector('[data-testid="deliberate-mode-option-delegation"]') as HTMLButtonElement).click();
    await expect(first).resolves.toEqual({
      mode: 'delegation'
    });
  });
});
