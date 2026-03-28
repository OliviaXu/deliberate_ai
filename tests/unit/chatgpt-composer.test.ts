import { describe, expect, it } from 'vitest';
import {
  findChatGPTComposer,
  findChatGPTComposerAnchor,
  isChatGPTSendButton,
  readChatGPTPrompt,
  resolveChatGPTComposerNear
} from '../../src/platforms/chatgpt/composer';

function setupChatGPTComposer(): HTMLDivElement {
  document.body.innerHTML = `
    <main>
      <form class="group composer">
        <div class="composer-shell">
          <div class="composer-input">
            <div
              class="ProseMirror"
              contenteditable="true"
              role="textbox"
              aria-label="Ask anything"
            >
              <p>draft prompt</p>
            </div>
            <textarea name="prompt-textarea" placeholder="Ask anything" hidden>fallback prompt</textarea>
          </div>
          <button type="button" data-testid="send-button" aria-label="Send prompt">Send</button>
        </div>
      </form>
    </main>
  `;

  const composer = document.querySelector('.ProseMirror');
  if (!(composer instanceof HTMLDivElement)) throw new Error('Expected ChatGPT composer');
  return composer;
}

describe('ChatGPT composer helpers', () => {
  it('finds the visible ProseMirror composer and reads its prompt text', () => {
    const composer = setupChatGPTComposer();

    expect(findChatGPTComposer()).toBe(composer);
    expect(resolveChatGPTComposerNear(composer)).toBe(composer);
    expect(readChatGPTPrompt(composer)).toBe('draft prompt');
  });

  it('resolves the composer from nearby descendants inside the form shell', () => {
    setupChatGPTComposer();
    const paragraph = document.querySelector('.ProseMirror p');
    if (!(paragraph instanceof HTMLParagraphElement)) throw new Error('Expected ChatGPT paragraph');

    expect(resolveChatGPTComposerNear(paragraph)).toBe(document.querySelector('.ProseMirror'));
  });

  it('anchors reflection UI to the nearest composer form shell', () => {
    const composer = setupChatGPTComposer();

    expect(findChatGPTComposerAnchor(composer)).toBe(document.querySelector('form.group.composer'));
  });

  it('identifies the ChatGPT send button by data-testid and send labeling', () => {
    setupChatGPTComposer();
    const button = document.querySelector('button[data-testid="send-button"]');
    if (!(button instanceof HTMLButtonElement)) throw new Error('Expected ChatGPT send button');

    expect(isChatGPTSendButton(button)).toBe(true);
  });
});
