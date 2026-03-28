const CHATGPT_COMPOSER_SELECTOR = 'div.ProseMirror[role="textbox"]';
const CHATGPT_TEXTAREA_SELECTOR = 'textarea[name="prompt-textarea"]';
const CHATGPT_COMPOSER_ANCHOR_SELECTORS = ['form.group.composer', 'form[data-type="unified-composer"]', 'form'];

export function findChatGPTComposer(root: ParentNode = document): HTMLElement | null {
  return root.querySelector<HTMLElement>(CHATGPT_COMPOSER_SELECTOR);
}

export function resolveChatGPTComposerNear(element: Element | null): HTMLElement | null {
  if (element instanceof HTMLElement && element.matches(CHATGPT_COMPOSER_SELECTOR)) return element;

  let current = element instanceof HTMLElement ? element : null;
  while (current) {
    const composer = findChatGPTComposer(current);
    if (composer) return composer;
    current = current.parentElement;
  }

  return findChatGPTComposer();
}

export function findChatGPTComposerAnchor(composer: HTMLElement): HTMLElement | null {
  for (const selector of CHATGPT_COMPOSER_ANCHOR_SELECTORS) {
    const anchor = composer.closest<HTMLElement>(selector);
    if (anchor) return anchor;
  }

  return composer.parentElement;
}

export function isChatGPTSendButton(button: HTMLButtonElement): boolean {
  if (button.matches('button[data-testid="send-button"]')) return true;

  const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
  const testId = (button.getAttribute('data-testid') || '').toLowerCase();
  const text = (button.textContent || '').toLowerCase().trim();

  return testId.includes('send-button') || ariaLabel.includes('send prompt') || text === 'send';
}

export function readChatGPTPrompt(composer: HTMLElement): string {
  const prompt = composer.textContent?.trim();
  if (prompt) return prompt;

  const textarea = composer.parentElement?.querySelector<HTMLTextAreaElement>(CHATGPT_TEXTAREA_SELECTOR);
  return textarea?.value || '';
}

export { CHATGPT_COMPOSER_SELECTOR, CHATGPT_TEXTAREA_SELECTOR };
