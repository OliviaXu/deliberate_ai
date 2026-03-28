import { describe, expect, it } from 'vitest';
import {
  findClaudeComposer,
  findClaudeComposerAnchor,
  isClaudeSendButton,
  readClaudePrompt,
  resolveClaudeComposerNear
} from '../../src/platforms/claude/composer';

function setupClaudeComposer(): HTMLDivElement {
  document.body.innerHTML = `
    <main>
      <fieldset class="flex w-full min-w-0 flex-col">
        <div class="rounded-5xl border border-border-300 bg-bg-000">
          <div
            class="tiptap ProseMirror"
            contenteditable="true"
            role="textbox"
            data-testid="chat-input"
            aria-label="Write your prompt to Claude"
          >
            <p>draft prompt</p>
          </div>
          <button type="button" aria-label="Send message">Send</button>
        </div>
      </fieldset>
    </main>
  `;

  const composer = document.querySelector('[data-testid="chat-input"]');
  if (!(composer instanceof HTMLDivElement)) throw new Error('Expected Claude composer');
  return composer;
}

describe('Claude composer helpers', () => {
  it('finds the visible Claude composer and reads its prompt text', () => {
    const composer = setupClaudeComposer();

    expect(findClaudeComposer()).toBe(composer);
    expect(resolveClaudeComposerNear(composer)).toBe(composer);
    expect(readClaudePrompt(composer)).toBe('draft prompt');
  });

  it('resolves the composer from nearby descendants inside the fieldset shell', () => {
    setupClaudeComposer();
    const paragraph = document.querySelector('[data-testid="chat-input"] p');
    if (!(paragraph instanceof HTMLParagraphElement)) throw new Error('Expected Claude paragraph');

    expect(resolveClaudeComposerNear(paragraph)).toBe(document.querySelector('[data-testid="chat-input"]'));
  });

  it('anchors reflection UI to the nearest fieldset', () => {
    const composer = setupClaudeComposer();

    expect(findClaudeComposerAnchor(composer)).toBe(document.querySelector('fieldset'));
  });

  it('identifies the Claude send button by send labeling', () => {
    setupClaudeComposer();
    const button = document.querySelector('button[aria-label="Send message"]');
    if (!(button instanceof HTMLButtonElement)) throw new Error('Expected Claude send button');

    expect(isClaudeSendButton(button)).toBe(true);
  });
});
