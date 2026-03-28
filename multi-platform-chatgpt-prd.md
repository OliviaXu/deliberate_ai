# Multi-Platform ChatGPT Support PRD

## Status
Phases 1 through 5 of the original multi-platform plan are now implemented in the repo.

This document is kept as a scoped record of the ChatGPT expansion work that established the current multi-platform foundation. New platform work should build on that foundation instead of reopening the original Gemini-to-ChatGPT migration plan.

## Summary
Deliberate AI successfully expanded from Gemini-only behavior to a shared multi-platform seam that supports both Gemini and ChatGPT while keeping the reflection product flow shared.

The important architectural outcomes that landed were:
- a platform registry that drives host matching and runtime platform resolution
- platform-specific thread and composer behavior under `src/platforms/`
- platform-aware persistence and background resolution
- shared interception, mode modal, and reflection flows reused across Gemini and ChatGPT

## What Landed
### Shared platform foundation
1. `src/platforms/index.ts` now acts as the registration point for active platforms.
2. `src/platforms/types.ts` defines the current platform contract.
3. `src/shared/platform-id.ts` and shared store boundaries now treat platform as part of thread identity.
4. Shared content flow resolves the active platform at runtime rather than importing Gemini-specific helpers directly.

### ChatGPT-specific support
1. ChatGPT thread parsing and composer behavior live under `src/platforms/chatgpt/`.
2. `chatgpt.com` is part of the active registry and manifest-driven match flow.
3. ChatGPT prompt interception, replay, persistence, and reflection behavior now ride the shared seam.
4. Live ChatGPT smoke coverage exists in `tests/e2e/chatgpt-smoke.spec.ts`.

### Product parity reached
1. ChatGPT can intercept prompt submission and open the mode modal before native send.
2. ChatGPT learning-cycle records persist using platform-aware thread identity.
3. ChatGPT new-chat placeholder state resolves to a concrete thread after send.
4. Reflection hint and reflection completion behavior work on ChatGPT threads through the shared UI layer.

## ChatGPT Surface Findings
Observed directly on a signed-in `chatgpt.com` session on March 22, 2026.

### Verified details
1. Signed-in home state loads at `https://chatgpt.com/`.
2. Existing conversation links use `/c/<id>` URLs.
3. New conversations transition from `/` to `/c/<id>` after submit.
4. The visible live composer is `div.ProseMirror[role="textbox"]`.
5. A hidden fallback textarea is also present as `textarea[name="prompt-textarea"]`.
6. The visible send button can be targeted with `button[data-testid="send-button"]`, with `aria-label="Send prompt"` as a useful fallback.

### Implementation implications
1. `/` is the placeholder new-chat route for ChatGPT.
2. `/c/<id>` is the concrete thread route for ChatGPT.
3. Prompt extraction should prefer the visible ProseMirror composer and only fall back to the hidden textarea when needed.

## Files That Became Part Of The Foundation
### Core platform seam
1. `/Users/koala/Fun/deliberate_ai/src/platforms/index.ts`
2. `/Users/koala/Fun/deliberate_ai/src/platforms/types.ts`
3. `/Users/koala/Fun/deliberate_ai/src/shared/platform-id.ts`
4. `/Users/koala/Fun/deliberate_ai/src/shared/thread-path.ts`

### Gemini extraction
1. `/Users/koala/Fun/deliberate_ai/src/platforms/gemini/definition.ts`
2. `/Users/koala/Fun/deliberate_ai/src/platforms/gemini/composer.ts`

### ChatGPT support
1. `/Users/koala/Fun/deliberate_ai/src/platforms/chatgpt/definition.ts`
2. `/Users/koala/Fun/deliberate_ai/src/platforms/chatgpt/composer.ts`
3. `/Users/koala/Fun/deliberate_ai/tests/e2e/chatgpt-smoke.spec.ts`

## Remaining Follow-On Work
The original plan's "normalize tooling for future platforms" phase is still the right umbrella for the next expansion step.

That follow-on work now means:
1. use the ChatGPT-shaped platform seam as the baseline for Claude
2. add Claude-specific live scripts and E2E coverage alongside Gemini and ChatGPT
3. keep future platform additions mostly additive instead of reopening shared architecture

## Recommendation
Treat this document as the historical record for the Gemini-to-ChatGPT expansion.

New platform planning should happen in a separate platform-specific PRD so that:
1. already-shipped ChatGPT work stays stable as reference material
2. Claude planning can focus on the current repo shape instead of the pre-refactor state
3. new TDD and E2E tasks stay scoped to Claude-specific unknowns
