const GEMINI_COMPOSER_SELECTOR = '.ql-editor.textarea.new-input-ui[role="textbox"]';
const GEMINI_ANCHOR_SELECTORS = ['.input-area', 'input-area-v2', 'fieldset.input-area-container'];

export function findGeminiComposer(root: ParentNode = document): HTMLElement | null {
  return root.querySelector<HTMLElement>(GEMINI_COMPOSER_SELECTOR);
}

export function resolveGeminiComposerNear(element: Element | null): HTMLElement | null {
  if (element instanceof HTMLElement && element.matches(GEMINI_COMPOSER_SELECTOR)) return element;

  let current = element instanceof HTMLElement ? element : null;
  while (current) {
    if (current.tagName === 'RICH-TEXTAREA') {
      return findGeminiComposer(current);
    }
    current = current.parentElement;
  }

  return findGeminiComposer();
}

export function findGeminiComposerAnchor(composer: HTMLElement): HTMLElement | null {
  for (const selector of GEMINI_ANCHOR_SELECTORS) {
    const anchor = composer.closest<HTMLElement>(selector);
    if (anchor) return anchor;
  }

  return composer.parentElement;
}

export function isGeminiSendButton(button: HTMLButtonElement): boolean {
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

export function readGeminiPrompt(composer: HTMLElement): string {
  if (composer instanceof HTMLTextAreaElement) {
    return composer.value;
  }

  if (composer.matches('[contenteditable="true"][role="textbox"]')) {
    return composer.textContent || '';
  }

  return '';
}

export { GEMINI_ANCHOR_SELECTORS, GEMINI_COMPOSER_SELECTOR };
