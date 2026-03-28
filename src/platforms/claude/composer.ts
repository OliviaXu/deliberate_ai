const CLAUDE_COMPOSER_SELECTOR = 'div.tiptap.ProseMirror[role="textbox"][data-testid="chat-input"]';
const CLAUDE_ANCHOR_SELECTORS = ['fieldset', '[data-testid="chat-input"] + div', '[class*="rounded"]'];

export function findClaudeComposer(root: ParentNode = document): HTMLElement | null {
  return root.querySelector<HTMLElement>(CLAUDE_COMPOSER_SELECTOR);
}

export function resolveClaudeComposerNear(element: Element | null): HTMLElement | null {
  if (element instanceof HTMLElement && element.matches(CLAUDE_COMPOSER_SELECTOR)) return element;

  let current = element instanceof HTMLElement ? element : null;
  while (current) {
    const composer = findClaudeComposer(current);
    if (composer) return composer;
    current = current.parentElement;
  }

  return findClaudeComposer();
}

export function findClaudeComposerAnchor(composer: HTMLElement): HTMLElement | null {
  for (const selector of CLAUDE_ANCHOR_SELECTORS) {
    const anchor = composer.closest<HTMLElement>(selector);
    if (anchor) return anchor;
  }

  return composer.parentElement;
}

export function isClaudeSendButton(button: HTMLButtonElement): boolean {
  if (button.matches('button[aria-label="Send message"]')) return true;

  const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
  const text = (button.textContent || '').toLowerCase().trim();

  return ariaLabel.includes('send message') || text === 'send';
}

export function readClaudePrompt(composer: HTMLElement): string {
  return composer.textContent?.trim() || '';
}

export { CLAUDE_ANCHOR_SELECTORS, CLAUDE_COMPOSER_SELECTOR };
