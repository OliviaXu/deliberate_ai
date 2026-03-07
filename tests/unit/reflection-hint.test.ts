import { describe, expect, it, vi } from 'vitest';
import { ReflectionHint } from '../../src/content/reflection-hint';

function setupComposer(): HTMLTextAreaElement {
  document.body.innerHTML = `
    <main>
      <section id="composer-shell">
        <textarea id="composer"></textarea>
      </section>
    </main>
  `;

  const composer = document.getElementById('composer');
  if (!(composer instanceof HTMLTextAreaElement)) throw new Error('Expected textarea composer');
  return composer;
}

describe('ReflectionHint', () => {
  it('keeps placeholder hint visible and promotes it to the first concrete thread', () => {
    setupComposer();
    const hint = new ReflectionHint();

    hint.trackThread('/app');
    hint.sync('/app');
    expect(document.querySelector('[data-testid="deliberate-reflection-hint"]')).toBeTruthy();

    hint.sync('/app/threads/thread-a');
    expect(document.querySelector('[data-testid="deliberate-reflection-hint"]')).toBeTruthy();

    hint.sync('/app/threads/thread-b');
    expect(document.querySelector('[data-testid="deliberate-reflection-hint"]')).toBeNull();

    hint.sync('/app/threads/thread-a');
    expect(document.querySelector('[data-testid="deliberate-reflection-hint"]')).toBeTruthy();
  });

  it('tracks multiple threads per tab and re-shows when navigating back', () => {
    setupComposer();
    const hint = new ReflectionHint();

    hint.trackThread('/app/thread-a');
    hint.sync('/app/thread-a');
    expect(document.querySelector('[data-testid="deliberate-reflection-hint"]')).toBeTruthy();

    hint.sync('/app/thread-b');
    expect(document.querySelector('[data-testid="deliberate-reflection-hint"]')).toBeNull();

    hint.trackThread('/app/thread-b');
    hint.sync('/app/thread-b');
    expect(document.querySelector('[data-testid="deliberate-reflection-hint"]')).toBeTruthy();

    hint.sync('/app/thread-a');
    expect(document.querySelector('[data-testid="deliberate-reflection-hint"]')).toBeTruthy();
  });

  it('logs review interaction without hiding hint', () => {
    setupComposer();
    const onReview = vi.fn();
    const hint = new ReflectionHint({ onReview });

    hint.trackThread('/app/thread-a');
    hint.sync('/app/thread-a');

    const reviewButton = document.querySelector('[data-testid="deliberate-reflection-hint-review"]');
    if (!(reviewButton instanceof HTMLButtonElement)) throw new Error('Expected review button');
    reviewButton.click();

    expect(onReview).toHaveBeenCalledWith('/app/thread-a');
    expect(document.querySelector('[data-testid="deliberate-reflection-hint"]')).toBeTruthy();
  });
});
