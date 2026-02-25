import { describe, expect, it } from 'vitest';
import { ModeSelectionModal } from '../../src/content/mode-modal';

describe('ModeSelectionModal', () => {
  it('requires mode selection and resolves to selected mode', async () => {
    document.body.innerHTML = '';
    const modal = new ModeSelectionModal();
    const selectionPromise = modal.open();

    const modalRoot = document.querySelector('[data-testid="deliberate-mode-modal"]');
    expect(modalRoot).toBeTruthy();

    const option = document.querySelector('[data-testid="deliberate-mode-option-learning"]');
    expect(option).toBeTruthy();
    (option as HTMLButtonElement).click();

    await expect(selectionPromise).resolves.toBe('learning');
    expect(document.querySelector('[data-testid="deliberate-mode-modal"]')).toBeNull();
  });

  it('reuses the same pending promise while already open', async () => {
    document.body.innerHTML = '';
    const modal = new ModeSelectionModal();
    const first = modal.open();
    const second = modal.open();

    expect(first).toBe(second);
    (document.querySelector('[data-testid="deliberate-mode-option-delegation"]') as HTMLButtonElement).click();
    await expect(first).resolves.toBe('delegation');
  });
});
