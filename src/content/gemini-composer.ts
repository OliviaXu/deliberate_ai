const GEMINI_COMPOSER_SELECTOR = '.ql-editor.textarea.new-input-ui[role="textbox"]';
const GEMINI_ANCHOR_SELECTORS = ['.input-area', 'input-area-v2', 'fieldset.input-area-container'];

export function findGeminiComposer(root: ParentNode = document): HTMLElement | null {
  return root.querySelector<HTMLElement>(GEMINI_COMPOSER_SELECTOR);
}

export function isGeminiComposerElement(element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement && element.matches(GEMINI_COMPOSER_SELECTOR);
}

export function resolveGeminiComposerNear(element: Element | null): HTMLElement | null {
  if (isGeminiComposerElement(element)) return element;

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

export { GEMINI_ANCHOR_SELECTORS, GEMINI_COMPOSER_SELECTOR };
