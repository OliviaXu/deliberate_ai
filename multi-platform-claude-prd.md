# Multi-Platform Claude Support PRD

## Summary
Add `claude.ai` support on top of the multi-platform seam that already exists for Gemini and ChatGPT.

Unlike the earlier ChatGPT work, Claude support should not start from a Gemini-only codebase. The repo now already has:
- a platform registry
- shared send interception
- platform-aware thread persistence
- a live ChatGPT smoke-test pattern

Claude support should therefore be mostly additive:
1. add a Claude platform adapter
2. register it once
3. add Claude-specific tests and scripts
4. reuse the existing shared product flow

## Goals
1. Add `claude.ai` support without reopening the shared architecture that ChatGPT already validated.
2. Keep mode modal, learning-cycle flow, reflection flow, and journal behavior shared.
3. Reuse the current platform contract unless Claude reveals a real missing seam.
4. Add Claude-specific live E2E coverage similar to the ChatGPT smoke test.

## Non-Goals
1. No redesign of the reflection product itself.
2. No generalized abstraction beyond the current platform seam unless Claude forces it.
3. No broad tooling rewrite before the Claude thin slice works.
4. No attempt to support every Claude surface on day one beyond the standard `claude.ai` chat flow.

## Current Foundation Already In Place
### Architecture that Claude can reuse
1. `src/platforms/index.ts` already resolves active platforms from URL and drives active matches.
2. `src/platforms/types.ts` already defines the platform adapter shape.
3. `src/content/send-interceptor.ts` already injects platform behavior for composer lookup, prompt reading, and send-button detection.
4. Shared storage and background resolution already persist records with `platform` plus `threadId`.
5. ChatGPT has already proven that a ProseMirror-based platform can fit the current seam.

### Operational pattern Claude can reuse
1. Gemini and ChatGPT already use CDP-backed live smoke tests.
2. `tests/e2e/chatgpt-smoke.spec.ts` is the closest test pattern for Claude because both surfaces use contenteditable rich-text composers.
3. `package.json` already establishes the naming convention for platform-specific `open`, `reload-extension`, and `test:e2e:<platform>` scripts.

## Claude Findings
Observed directly on a signed-in `claude.ai` session via Playwright over CDP on March 27, 2026.

### Verified thread and route details
1. Signed-in new chat loads at `https://claude.ai/new`.
2. The pathname for the new-chat placeholder state is `/new`.
3. Existing conversation links on the page use `/chat/<uuid>` URLs.
4. Concrete Claude thread identity should therefore be modeled as `/chat/<uuid>`.
5. I did not submit the probe draft, so the exact post-send transition from `/new` to `/chat/<uuid>` is strongly implied by the live sidebar links but should still be asserted by the first live smoke test.

### Verified composer details
1. The live composer is `div.tiptap.ProseMirror[role="textbox"][data-testid="chat-input"]`.
2. The composer has `aria-label="Write your prompt to Claude"`.
3. The composer is `contenteditable="true"`.
4. Prompt text is readable from the ProseMirror node's text content.

### Verified anchor details
1. The composer sits inside a `fieldset.flex.w-full.min-w-0.flex-col`.
2. The nearest stable attachment strategy appears to be:
   1. prefer the nearest `fieldset`
   2. otherwise fall back to the rounded composer container or parent element
3. The send button and model selector both live inside the same fieldset subtree as the composer.

### Verified send-button details
1. Once draft text exists, a nearby button appears with `aria-label="Send message"`.
2. The probe did not surface a stable `data-testid` for the send button.
3. The send button class list looks generated and should not be the primary selector.
4. `button[aria-label="Send message"]` is the strongest current selector.
5. The button reported `disabled: false` once draft text existed.

## Claude Platform Adapter Recommendation
Claude appears to fit the existing platform contract without a mandatory contract expansion.

Recommended constants:

```ts
export const CLAUDE_HOST = 'claude.ai';
export const PLACEHOLDER_CLAUDE_THREAD_ID = '/new';
export const CLAUDE_THREAD_PREFIX = '/chat/';
```

Recommended composer strategy:

```ts
const CLAUDE_COMPOSER_SELECTOR =
  'div.tiptap.ProseMirror[role="textbox"][data-testid="chat-input"]';
```

Recommended anchor strategy:
1. nearest `fieldset`
2. otherwise nearest stable composer container
3. otherwise `composer.parentElement`

Recommended send-button strategy:
1. primary: `button[aria-label="Send message"]`
2. secondary heuristic: `aria-label` contains `send message`

Recommended prompt strategy:
1. use `composer.textContent?.trim()`
2. do not assume a hidden textarea fallback unless a later probe reveals one

## Proposed File Plan
### New production files
1. `/Users/koala/Fun/deliberate_ai/src/platforms/claude/definition.ts`
2. `/Users/koala/Fun/deliberate_ai/src/platforms/claude/composer.ts`

### Existing production files to update
1. `/Users/koala/Fun/deliberate_ai/src/shared/platform-id.ts`
2. `/Users/koala/Fun/deliberate_ai/src/platforms/index.ts`
3. `/Users/koala/Fun/deliberate_ai/wxt.config.ts`

### New test and tooling files
1. `/Users/koala/Fun/deliberate_ai/tests/e2e/claude-smoke.spec.ts`
2. `/Users/koala/Fun/deliberate_ai/tests/unit/claude-composer.test.ts`
3. `/Users/koala/Fun/deliberate_ai/scripts/bootstrap-claude-profile.mjs`
4. `/Users/koala/Fun/deliberate_ai/scripts/reload-claude-extension.mjs`

### Existing files to update for tooling
1. `/Users/koala/Fun/deliberate_ai/package.json`

## Why Claude Should Get A Separate E2E Test
Yes, Claude should have its own live E2E test, just like ChatGPT.

Reasons:
1. Claude has a distinct host, route scheme, and signed-in profile requirements.
2. Claude uses different placeholder and concrete thread routes than ChatGPT.
3. Claude's send button relies on different selectors than ChatGPT.
4. Reflection and pending-thread resolution should be proven on the real site, not inferred from shared code.

Recommended script shape:
1. `npm run claude:open`
2. `npm run claude:reload-extension`
3. `npm run test:e2e:claude`

## Phase Plan
Implementation should follow strict TDD within each phase.

### Discovery: Claude Probe Baseline
This discovery work is already partially complete.

1. Re-verify the signed-in Claude surface before implementation starts.
2. Confirm whether sending a new Claude prompt transitions from `/new` to `/chat/<uuid>`.
3. Confirm whether Enter and send-button clicks both use the same composer and send behavior.
4. Record any textarea fallback, model-specific differences, or disabled-button nuances if they appear.

E2E tracer bullet:
- Attach Playwright over CDP to a signed-in Claude session and assert:
  - `/new` is the new-chat state
  - `/chat/<uuid>` links exist
  - `div.ProseMirror.tiptap[role="textbox"][data-testid="chat-input"]` exists
  - `button[aria-label="Send message"]` appears when draft text exists

Outcome:
Claude implementation starts from observed behavior rather than guesses.

### Phase 1: Add Claude Platform Thin Slice
1. Add `claude` to `PlatformId`.
2. Add `src/platforms/claude/` with thread and composer behavior.
3. Register `claude.ai` in the platform registry and active matches.
4. Verify extension injection and submit interception on Claude.

E2E tracer bullet:
- On `claude.ai/new`, the extension injects, intercepts Enter or send from the Claude composer, opens the mode modal, and resumes native send.

Outcome:
Claude can participate in the shared mode-interception flow.

### Phase 2: Add Claude Persistence And Thread Resolution
1. Persist Claude learning-cycle records with `platform: 'claude'`.
2. Treat `/new` as the pending thread state.
3. Resolve placeholder records to `/chat/<uuid>` after native send completes and the concrete URL materializes.
4. Extend Claude smoke coverage to assert the placeholder-to-concrete transition.

E2E tracer bullet:
- On Claude, a new conversation starts at `/new`, the learning-cycle record is captured as pending, and after submit the stored record resolves to `/chat/<uuid>`.

Outcome:
Claude reaches parity with Gemini and ChatGPT for thread resolution and persistence.

### Phase 3: Add Claude Reflection Parity
1. Anchor the reflection hint near the Claude composer fieldset.
2. Reuse the shared reflection modal and runtime messaging.
3. Verify due-state visibility and reflection completion behavior on Claude threads.

E2E tracer bullet:
- On a Claude thread with an eligible learning-cycle record, the reflection hint anchors near the composer, opens the reflection modal, and completion persists and hides the hint.

Outcome:
Claude reaches feature parity for reflection behavior.

### Phase 4: Normalize Tooling
1. Add Claude profile bootstrap and extension reload scripts.
2. Add a dedicated Claude smoke command to `package.json`.
3. Document the three live-platform flows more clearly:
   1. Gemini
   2. ChatGPT
   3. Claude

E2E tracer bullet:
- Gemini, ChatGPT, and Claude can each be exercised through their own live smoke script without changing shared product code.

Outcome:
Claude becomes a first-class platform in both code and test tooling.

## TDD Workflow
### Phase 1 TDD
1. Red
   1. Add unit tests for Claude thread parsing.
   2. Add unit tests for Claude composer, anchor, and send-button detection.
   3. Add a failing smoke skeleton for Claude interception.
2. Green
   1. Implement the minimal Claude platform adapter and registry wiring.
3. Refactor
   1. Tighten selectors and naming only after tests pass.

### Phase 2 TDD
1. Red
   1. Add failing coverage for `/new` placeholder tracking and `/chat/<uuid>` resolution.
2. Green
   1. Implement the minimal pending-thread resolution support for Claude.
3. Refactor
   1. Keep placeholder and concrete-route handling explicit at the call site if that stays clearer than helper indirection.

### Phase 3 TDD
1. Red
   1. Add failing coverage for Claude reflection hint placement and reflection completion.
2. Green
   1. Implement the minimal adapter-specific anchoring needed for Claude.
3. Refactor
   1. Keep shared UI shared and leave only anchoring logic in the platform adapter.

## Recommended Test Layout
```text
tests/
  unit/
    claude-composer.test.ts
    thread-id.test.ts
  e2e/
    claude-smoke.spec.ts
```

The Claude smoke should initially mirror the structure of `tests/e2e/chatgpt-smoke.spec.ts`, because that test already proves the right kind of real-site, signed-in, CDP-backed flow.

## Acceptance Criteria
1. `claude.ai` is sourced from the platform registry and active match list.
2. The extension injects on `https://claude.ai/new`.
3. Claude submit interception works from both Enter and send-button submit paths.
4. Claude learning-cycle records persist under `platform: 'claude'`.
5. Placeholder Claude threads created at `/new` resolve to concrete `/chat/<uuid>` identities after send.
6. Reflection hint placement remains stable near the Claude composer.
7. A dedicated Claude live smoke test exists alongside the Gemini and ChatGPT smoke tests.

## Risks
1. Claude may change ProseMirror or send-button markup without notice.
2. The exact post-send transition from `/new` to `/chat/<uuid>` still needs to be asserted end to end.
3. Signed-in live testing depends on a dedicated Claude browser profile and extension reload flow.
4. If Claude later requires a submit primitive beyond button click replay, the platform contract may need to grow.

## Open Questions
1. Should Claude get its own CDP port and profile bootstrap scripts immediately, or should the first smoke temporarily reuse the current ChatGPT profile pattern?
2. Should we add a dedicated `src/platforms/claude/thread.ts`, or keep Claude path rules inline in `definition.ts` until a second concrete need emerges?
3. Do we want the first Claude smoke to stop after interception, or go all the way through persistence and reflection in one serial spec?

## Recommendation
Proceed with a dedicated Claude implementation track and a dedicated Claude live smoke test.

The ChatGPT work already paid down the architecture cost. Claude should now be treated as a focused additive platform integration, not as another broad multi-platform refactor.
