# Multi-Platform Support Plan

## Summary
Expand Deliberate AI from a Gemini-only extension into a multi-platform extension that can support `chatgpt.com` and future AI chat surfaces without reworking the core reflection product flow each time.

The current repo already has a good feature-first split. The main gap is that platform-specific behavior is embedded inside shared seams:
- host matching and content-script boot
- thread identity parsing
- composer discovery and anchoring
- send interception and replay

This plan keeps the existing feature modules shared and introduces a narrow `platforms` layer for site-specific DOM and URL behavior.

## Goals
1. Add `chatgpt.com` support without forking the whole content flow.
2. Make future platform additions mostly additive:
   1. add a platform folder
   2. register it once
   3. add platform tests
3. Keep reflection, learning-cycle, and thinking-journal product logic shared.
4. Remove Gemini-specific assumptions from shared identity and store boundaries.

## Non-Goals
1. No redesign of the reflection product itself.
2. No cross-platform UX divergence unless a host requires it.
3. No generic "universal DOM abstraction" beyond the real seams needed today.
4. No platform-specific analytics or remote configuration.

## Current-State Assessment
### What is already in good shape
1. The mode-selection and reflection flow is mostly platform-agnostic.
2. Local persistence and thinking-journal behavior are largely feature-driven, not host-driven.
3. Runtime messaging between content and background is already simple and reusable.

### Where Gemini is currently hard-coded
1. Content-script matches and host permissions are Gemini-only.
2. Thread identity utilities live in shared code but encode Gemini constants and URL rules.
3. Composer lookup, anchor selection, and send-button heuristics are Gemini-specific.
4. Reflection-hint attachment imports Gemini composer helpers directly.
5. Dev scripts and E2E flows are named and scoped around Gemini.

### Primary architectural risk for multi-platform
The biggest blocker is thread identity.

Today the code persists `platform`, but several caches and store lookups still operate on raw `threadId` alone. That is safe for a single platform, but it becomes unsafe once multiple platforms can have overlapping path-like identifiers or different placeholder semantics.

Multi-platform support should never query or cache by `threadId` without platform context.

## Desired End State
After this refactor, adding a new platform should require:
1. Creating `src/platforms/<platform>/` with thread and composer behavior.
2. Exporting that platform from a single registry.
3. Adding platform-specific unit tests and a harness or smoke spec.
4. Optionally adding dev scripts for live manual or CDP-backed testing.

Core feature code should not need per-platform branches for standard behavior.

## Proposed Architecture
### 1. Keep the feature split
Keep shared feature code where it already belongs:
- mode modal
- reflection modal
- reflection eligibility logic
- learning-cycle flow
- journal rendering and storage

Do not move those features under platform folders.

### 2. Introduce a `platforms` layer
Add a new `src/platforms/` directory that owns only site-specific concerns.

Suggested structure:

```text
src/
  platforms/
    index.ts
    types.ts
    gemini/
      definition.ts
      thread.ts
      composer.ts
    chatgpt/
      definition.ts
      thread.ts
      composer.ts
  content/
    start-content.ts
    platform-send-interceptor.ts
    reflection-hint.ts
    mode-modal.ts
    reflection-modal.ts
  shared/
    platform-id.ts
    thread-ref.ts
    types.ts
```

### 3. Add a platform registry
Create a single registry that exports all known platforms and their match patterns.

The registry should drive:
1. content-script match patterns
2. manifest host permissions
3. runtime platform resolution by URL
4. background thread-resolution strategy lookup

This keeps "add a new platform" to one registration point instead of editing several unrelated files.

### 4. Replace raw thread IDs with a platform-aware thread model
Recommended shape:

```ts
type PlatformId = 'gemini' | 'chatgpt';

type ThreadRef =
  | { platform: PlatformId; state: 'pending' }
  | { platform: PlatformId; state: 'resolved'; id: string };
```

Derived helper:

```ts
function toThreadKey(thread: Extract<ThreadRef, { state: 'resolved' }>): string {
  return `${thread.platform}:${thread.id}`;
}
```

Why:
1. It avoids using Gemini placeholder strings as shared truth.
2. It makes pending vs resolved state explicit.
3. It prevents cache and lookup collisions across platforms.
4. It keeps persisted facts canonical instead of encoding host-specific magic values inside plain strings.

If the explicit `ThreadRef` migration feels too large for the first pass, the minimum acceptable fallback is:
1. keep `platform`
2. keep `threadId`
3. introduce a derived `threadKey = platform + ':' + threadId`
4. update every cache and store lookup to use `platform + threadId`, never `threadId` alone

### 5. Make send interception generic, with platform behavior injected
Refactor the current Gemini send interceptor into a platform-driven interceptor.

Shared interceptor responsibilities:
1. listen for keydown and click capture events
2. block native send
3. emit intercepted submit intents
4. manage replay allowance
5. manage single-flight replay state

Platform responsibilities:
1. find composer
2. resolve composer near an event target
3. read prompt text from composer
4. identify send button
5. locate anchor for hint placement
6. resolve current thread from URL
7. resolve a concrete thread from tab updates when possible

### 6. Keep platform heuristics local
Do not create generic helpers for arbitrary DOM shapes.

Each platform folder should own:
1. selectors
2. DOM traversal rules
3. send-button heuristics
4. thread URL parsing rules

This keeps future platform work readable and limits blast radius when a host changes its UI.

### 7. Make background thread resolution platform-aware
The pending-thread tracker should resolve concrete thread identity using the platform associated with the record being tracked.

That means the tracker should no longer assume:
1. Gemini host
2. Gemini placeholder thread format
3. Gemini URL prefix rules

### 8. Keep shared UI shared
The visual components should remain shared unless a platform forces a layout-specific difference:
1. mode modal
2. reflection modal
3. reflection hint visuals

Only the attachment point and surrounding DOM anchoring should be platform-specific.

## Platform Contract
Each platform definition should provide a narrow contract similar to:

```ts
interface PlatformDefinition {
  id: PlatformId;
  matches: string[];
  resolveThread(url: string): ThreadRef;
  resolveConcreteThread(url?: string): Extract<ThreadRef, { state: 'resolved' }> | null;
  findComposer(root?: ParentNode): HTMLElement | null;
  resolveComposerNear(node: Element | null): HTMLElement | null;
  findComposerAnchor(composer: HTMLElement): HTMLElement | null;
  isSendButton(button: HTMLButtonElement): boolean;
  readPrompt(composer: HTMLElement): string;
}
```

This contract is intentionally small. It should expand only when a second concrete platform requires a new shared seam.

## ChatGPT Findings
Observed directly on a signed-in `chatgpt.com` session on March 22, 2026.

### Verified surface details
1. Signed-in home state loads at `https://chatgpt.com/`.
2. Existing conversation links use `/c/<id>` URLs.
3. New conversations transition from `/` to `/c/<id>` after submit.
4. The visible live composer is `div.ProseMirror[role="textbox"]`.
5. A hidden fallback textarea is also present as `textarea[name="prompt-textarea"][placeholder="Ask anything"]`.
6. The composer sits inside `form.group/composer`.
7. `button[data-testid="send-button"][aria-label="Send prompt"]` is absent when the composer is empty and appears once draft text exists.
8. The visible send button is enabled when unsent draft text is present.

### Implementation implications
1. ChatGPT placeholder-thread detection can treat `/` as the pending new-chat state.
2. ChatGPT concrete-thread detection should treat `/c/<id>` as resolved thread identity.
3. ChatGPT composer resolution should target the visible ProseMirror textbox first, not the hidden fallback textarea.
4. Prompt extraction may still want a fallback path that checks `textarea[name="prompt-textarea"]`, but the visible ProseMirror node appears to be the primary interaction target.
5. Send-button detection can use `button[data-testid="send-button"]` as the strongest current selector, with `aria-label="Send prompt"` as a secondary check.

## File-Level Plan
### New files
1. `/Users/koala/Fun/deliberate_ai/multi-platform-prd.md`
2. `/Users/koala/Fun/deliberate_ai/src/platforms/index.ts`
3. `/Users/koala/Fun/deliberate_ai/src/platforms/types.ts`
4. `/Users/koala/Fun/deliberate_ai/src/platforms/gemini/definition.ts`
5. `/Users/koala/Fun/deliberate_ai/src/platforms/gemini/thread.ts`
6. `/Users/koala/Fun/deliberate_ai/src/platforms/gemini/composer.ts`
7. `/Users/koala/Fun/deliberate_ai/src/platforms/chatgpt/definition.ts`
8. `/Users/koala/Fun/deliberate_ai/src/platforms/chatgpt/thread.ts`
9. `/Users/koala/Fun/deliberate_ai/src/platforms/chatgpt/composer.ts`
10. `/Users/koala/Fun/deliberate_ai/src/shared/thread-ref.ts`

### Existing files to refactor
1. `/Users/koala/Fun/deliberate_ai/wxt.config.ts`
2. `/Users/koala/Fun/deliberate_ai/entrypoints/content.ts`
3. `/Users/koala/Fun/deliberate_ai/src/content/index.ts`
4. `/Users/koala/Fun/deliberate_ai/src/content/send-interceptor.ts`
5. `/Users/koala/Fun/deliberate_ai/src/content/reflection-hint.ts`
6. `/Users/koala/Fun/deliberate_ai/src/content/learning-cycle-flow.ts`
7. `/Users/koala/Fun/deliberate_ai/src/shared/types.ts`
8. `/Users/koala/Fun/deliberate_ai/src/shared/learning-cycle-store.ts`
9. `/Users/koala/Fun/deliberate_ai/src/background/learning-cycle-messages.ts`
10. `/Users/koala/Fun/deliberate_ai/src/background/pending-thread-resolution.ts`

### Tests and fixtures to reorganize
1. `/Users/koala/Fun/deliberate_ai/tests/harness/index.html`
2. `/Users/koala/Fun/deliberate_ai/tests/e2e/local-harness.spec.ts`
3. `/Users/koala/Fun/deliberate_ai/tests/e2e/gemini-smoke.spec.ts`
4. `/Users/koala/Fun/deliberate_ai/tests/unit/thread-id.test.ts`
5. `/Users/koala/Fun/deliberate_ai/tests/unit/gemini-composer.test.ts`

## Phase Plan
### Phase 1: Extract Gemini into the platform layer without behavior changes
1. Add `PlatformId` and the platform registry.
2. Move Gemini thread and composer logic under `src/platforms/gemini/`.
3. Update content boot to resolve the current platform from the registry.
4. Keep Gemini as the only active platform during this phase.

Outcome:
The architecture changes, but user-visible behavior stays the same.

### Phase 2: Make thread identity and storage platform-aware
1. Introduce `ThreadRef` or the fallback `threadKey`.
2. Update caches in content to key by platform-aware identity.
3. Update `LearningCycleStore` queries and background resolution to use platform-aware identity.
4. Remove Gemini-only placeholder assumptions from shared code.

Outcome:
Shared code no longer assumes a single platform.

### Phase 3: Add ChatGPT support
1. Add `src/platforms/chatgpt/` with URL and composer behavior.
2. Add `chatgpt.com` to the platform registry.
3. Add ChatGPT harness fixtures and unit tests.
4. Add a ChatGPT smoke or manual verification path.

Outcome:
The extension runs against both Gemini and ChatGPT with the same core feature flow.

### Phase 4: Normalize tooling for future platforms
1. Rename or regroup Gemini-only scripts under a platform-aware pattern.
2. Split tests into shared behavior tests plus per-platform fixture tests.
3. Update README sections to describe platform-specific setup more cleanly.

Outcome:
Adding a third platform is mostly additive and operationally clear.

## TDD Workflow
Each phase should follow a strict red -> green -> refactor sequence.

### Phase 1 TDD
1. Red
   1. Add tests that prove Gemini behavior still works when resolved through a platform definition.
   2. Add tests for registry-driven match and platform lookup behavior.
2. Green
   1. Implement the minimal platform registry and Gemini definition extraction.
3. Refactor
   1. Remove old direct Gemini imports from shared seams once tests are green.

### Phase 2 TDD
1. Red
   1. Add tests that fail when two platforms share the same raw `threadId` string but should remain isolated.
   2. Add tests for pending-thread resolution using platform-aware identity.
2. Green
   1. Implement `ThreadRef` or `threadKey` and update store/query paths.
3. Refactor
   1. Remove remaining raw `threadId` cache keys in shared code.

### Phase 3 TDD
1. Red
   1. Add ChatGPT thread parsing tests.
   2. Add ChatGPT composer and send-button detection tests.
   3. Add a harness or smoke test that verifies mode interception and replay on ChatGPT.
2. Green
   1. Implement the ChatGPT platform adapter.
3. Refactor
   1. Tighten shared platform contracts only if ChatGPT reveals a real second use case.

## Recommended Test Layout
```text
tests/
  unit/
    platforms/
      gemini/
        thread.test.ts
        composer.test.ts
      chatgpt/
        thread.test.ts
        composer.test.ts
    content/
      platform-send-interceptor.test.ts
    shared/
      learning-cycle-store.test.ts
  harness/
    platforms/
      gemini/index.html
      chatgpt/index.html
  e2e/
    platforms/
      gemini/local-harness.spec.ts
      chatgpt/local-harness.spec.ts
      gemini/smoke.spec.ts
      chatgpt/smoke.spec.ts
```

Use shared helpers for cross-platform behavior assertions, but keep each platform's DOM fixture separate.

## Acceptance Criteria
1. The extension can be built with host permissions and content-script matches sourced from a single platform registry.
2. Shared feature code no longer imports Gemini-specific thread or composer helpers directly.
3. Store lookups and runtime caches no longer key by raw `threadId` alone.
4. Gemini behavior remains unchanged after extraction into the platform layer.
5. ChatGPT can intercept prompt submission, show the mode modal, and resume prompt submission after selection.
6. Reflection hint placement remains stable on each supported platform.
7. Adding a new platform requires mostly additive work in `src/platforms/<platform>/` and tests.

## Risks
1. Chat surfaces can change DOM structure frequently, especially composer and send-button markup.
2. Placeholder-thread behavior may differ by platform and may not map neatly to the current Gemini flow.
3. Live smoke coverage may require per-platform signed-in browser profiles and custom setup.
4. Over-abstraction is a real risk; the shared contract should grow only when a second concrete platform forces it.

## Open Questions
1. Should the first multi-platform storage migration use explicit `ThreadRef`, or should it land the smaller `threadKey` step first?
2. Should all supported platforms share one content entrypoint with registry-driven matching, or should each platform get its own content entrypoint that calls a shared boot function?
3. Do we want platform badges to appear in the Thinking Journal once multiple platforms are supported, or remain hidden there?
4. Should dev scripts move immediately to generic names, or stay Gemini-specific until ChatGPT live testing exists?

## Recommendation
Start with the smallest architecture move that creates a real seam:
1. extract Gemini into `src/platforms/gemini`
2. introduce the platform registry
3. make thread lookup platform-aware

That gets the repo ready for ChatGPT without prematurely building a large framework.
