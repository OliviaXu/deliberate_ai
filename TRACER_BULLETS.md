# Deliberate AI Tracer-Bullet Plan (TDD)

## Phase 1: Core domain rules

- Test file: `/Users/koala/Fun/deliberate_ai/test/core.test.js`
- Goal:
  - Validate mode/prediction requirements
  - Build prompt entry shape
  - Label score semantics (`0` wildly off, `1` no new information)
  - Apply reflection payload
- Done when:
  - Core pure functions are stable and reused by UI scripts

## Phase 2: Session state machine

- Test file: `/Users/koala/Fun/deliberate_ai/test/session.test.js`
- Goal:
  - Unlock session only with valid intent input
  - Capture only first non-empty prompt
  - Re-lock immediately after capture
  - Support cancel/reset path
- Done when:
  - Content script delegates state transitions to `src/session.js`

## Phase 3: Browser capture flow

- Manual tracer test on ChatGPT and Gemini:
  1. Focus prompt input -> gate appears.
  2. Select `core` without prediction -> blocked.
  3. Add prediction, unlock, send prompt -> first prompt stored.
  4. Try second prompt -> gate appears again.
- Done when:
  - Behavior is repeatable on both sites.

## Phase 4: Reflection workflow

- Manual tracer test in popup:
  1. Open popup after at least one prompt capture.
  2. Find entry under `Pending Reflection`.
  3. Add note + move slider + save.
  4. Entry moves to `Recent Reflections`.
- Done when:
  - Reflection persistence and score labeling are reliable.

## Phase 5: Heuristic hardening

- Manual tracer regression:
  - Send by Enter key and send-button click.
  - Ensure prompt field detection still works after site UI updates.
- Done when:
  - No obvious false positives/false negatives in normal usage.
