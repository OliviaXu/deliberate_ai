# Thinking Journal Plan

## Summary
Implement the **Thinking Journal** as a calm, read-only timeline in phases.

1. **Phase 1 (implemented):** show learning-cycle records only.
2. **Phase 2 (next):** add completed reflections onto the existing learning-cycle cards.

Mode emojis remain exactly: **🤔 😌 🧑‍🎓**.

## Phase 1 (Implemented)
1. Clicking the extension icon opens `thinking-journal.html`.
2. Header:
   1. Title: `Thinking Journal`
   2. Subtext: `A quiet view of your thinking.`
3. Timeline defaults to **past 7 days only**.
4. Filters:
   1. `All`
   2. `Problem-Solving`
   3. `Delegation`
   4. `Learning`
5. Interaction entry cards:
   1. Formatted timestamp (`Mar 2, 2026 — 11:42 AM`)
   2. Mode badge:
      - `🤔 Problem-Solving`
      - `😌 Delegation`
      - `🧑‍🎓 Learning`
   3. `Prompt` with 3-line truncation + `Show more`
   4. Problem-Solving: `Your Hypothesis` from `prediction`, fallback `No hypothesis recorded.`
   5. Learning: `Initial Context` from `priorKnowledgeNote` when present
6. Read-only page:
   1. No edit/delete/export
   2. No reflection rendering yet

## Phase 2 (Next): Reflection Sections
1. Keep one primary card per learning-cycle record.
2. Add a `Reflection` section inside the card when a completed reflection can be matched.
3. Show reflections only for eligible modes:
   1. `problem_solving`
   2. `learning`
4. The card remains anchored to the original interaction timestamp and mode badge.
5. The reflection section should:
   1. Use a simple `Reflection` label
   2. Do **not** show a reflection timestamp line
   3. Communicate reflection score visually (no required numeric label); current UI uses the spark visual mapped from persisted score (`0 | 25 | 50 | 75 | 100`)
   4. Show the optional reflection note when present
6. Reuse the existing prompt and hypothesis/prior-context content already shown on the card; do not duplicate them inside the reflection section.
7. Do not create a separate reflection card when the source learning-cycle card is already present.
8. Add a secondary filter control:
   1. `With reflection only`
   2. This applies on top of the existing mode filter, not instead of it
9. Reflection sections remain read-only:
   1. No in-journal submission
   2. No edit/delete
   3. No pending/due cue controls

## Deferred
1. Pending or due reflection states in the journal
2. Dismissed reflections
3. Snooze-related display
4. Analytics, charts, or rollups

## Data Rules
1. Phase 1 source:
   1. `chrome.storage.local` key `deliberate.learningCycles.v1`
2. Phase 2 adds:
   1. `chrome.storage.local` key `deliberate.reflections.v1`
3. The 7-day journal window remains anchored to learning-cycle record timestamps.
4. Sort cards newest first by learning-cycle timestamp.
5. Filtering stays client-side by originating interaction mode, plus the `With reflection only` toggle.
6. Do not display platform.
7. Reflection sections are created only from persisted **completed** reflections.
8. Because reflection records currently store `threadId` but not `learningCycleId`, match each reflection to the latest eligible interaction in the same thread at or before the reflection timestamp.
9. If no matching eligible interaction can be resolved, omit that reflection from the journal instead of guessing.
10. If a reflection exists for a learning-cycle record outside the 7-day learning-cycle window, do not surface it on its own.

## File-Level Plan For Phase 2
1. Expand journal loading and entry enrichment:
   - `/Users/koala/Fun/deliberate_ai/src/thinking-journal/thinking-journal-store.ts`
   - `/Users/koala/Fun/deliberate_ai/src/thinking-journal/utils/entries.ts`
2. Update rendering:
   - `/Users/koala/Fun/deliberate_ai/src/thinking-journal/ThinkingJournalApp.tsx`
3. Reuse shared reflection storage/types:
   - `/Users/koala/Fun/deliberate_ai/src/shared/reflection-store.ts`
   - `/Users/koala/Fun/deliberate_ai/src/shared/types.ts`

## Interfaces / Types For Phase 2
1. Keep `ThinkingJournalFilter = "all" | InteractionMode`.
2. Add a secondary boolean filter for `withReflectionOnly`.
3. Keep one primary journal entry model per learning-cycle record.
4. Add optional reflection render data to that model:
   1. Reflection timestamp
   2. Score
   3. Optional notes
5. No storage schema mutation for this phase.

## TDD Workflow For Phase 2
1. **Red**
   1. `tests/unit/thinking-journal-view-model.test.ts`
      - enriches learning-cycle entries with matched reflections
      - keeps the 7-day window anchored to learning-cycle timestamps
      - preserves newest-first ordering by learning-cycle timestamp
      - filters by mode plus `withReflectionOnly`
      - drops reflections that cannot be matched to an eligible interaction
   2. `tests/unit/thinking-journal-app.test.tsx`
      - renders one card with an optional reflection section
      - keeps reflection score as a visual signal (spark), with optional note
      - does not render a reflected timestamp text line
      - keeps prompt truncation behavior for the prompt block
      - toggles `With reflection only`
2. **Green**
   1. Implement the minimal store, view-model, and rendering changes to satisfy tests.
3. **Refactor**
   1. Extract matching, score-label, and filter helpers, keep tests green.

## Acceptance Criteria For Phase 2
1. Timeline still shows only the last 7 days.
2. Cards for eligible `problem_solving` and `learning` entries show a reflection section when a completed reflection is matched.
3. Reflection sections do not show a reflected timestamp text line.
4. Reflection score is presented in some user-facing way; visual-only representation is acceptable (current spark mapping).
5. Delegation entries never show reflection sections.
6. The `With reflection only` filter works alongside the existing mode filter.
7. UI remains calm, minimal, and read-only.

## Assumptions
1. Phase 1 behavior remains unchanged.
2. Reflection completion is already persisted elsewhere; the journal only reads it in Phase 2.
3. The journal should mirror the current shipped reflection model from main as of March 13, 2026: completed reflections only, no pending/due timeline entries yet.
