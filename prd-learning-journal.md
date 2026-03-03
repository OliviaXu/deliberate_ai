# Thinking Journal Plan (Two Phases, Build Phase 1 Now)

## Summary
Implement a standalone **Thinking Journal** tab in two phases:
1. **Phase 1 (now):** prompt/mode/initial-thought timeline only.
2. **Phase 2 (later):** reflection visualization (pending/completed/calibration/note).

This plan uses mode emojis exactly as requested: **🤔 😌 🧑‍🎓**.

## Naming + Artifact Decisions
1. UI/product name remains **Thinking Journal**.
2. Plan document file path is **`/Users/koala/Fun/deliberate_ai/prd-learning-journal.md`**.
3. No legacy alternate naming anywhere.

## Phase 1 Scope (Implement Now)
1. Clicking extension icon opens a dedicated tab: `thinking-journal.html` (no popup).
2. Header:
   1. Title: `Thinking Journal`
   2. Subtext: `A quiet view of your thinking.`
3. Timeline defaults to **past 7 days only**.
4. Filters (client-side):
   1. `All`
   2. `Problem-Solving`
   3. `Delegation`
   4. `Learning`
5. Card structure:
   1. Formatted date/time (`Mar 2, 2026 — 11:42 AM` style)
   2. Mode badge:
      - `🤔 Problem-Solving`
      - `😌 Delegation`
      - `🧑‍🎓 Learning`
   3. `Prompt` section with 3-line truncation + `Show more`
   4. Mode-specific thought content:
      - Problem-Solving: `Your Hypothesis` from `prediction`, fallback `No hypothesis recorded.`
      - Learning: `Initial Context` from `priorKnowledgeNote` when present
      - Delegation: no extra thought block
6. Read-only page (no edit/delete/export).

## Phase 2 Scope (Deferred)
1. Reflection-related fields and rendering.
2. `Pending Reflection` filter.
3. Calibration bar and reflection note.
4. Snooze-related display.

## Data Rules (Phase 1)
1. Source: `chrome.storage.local` key `deliberate.learningCycles.v1`.
2. Include only entries with `timestamp >= now - 7 days`.
3. Sort newest first.
4. Filtering happens on client only.
5. Do not display platform.

## File-Level Implementation Plan (Phase 1)
1. Action routing:
   - `/Users/koala/Fun/deliberate_ai/entrypoints/background.ts`
2. Remove popup path:
   - `/Users/koala/Fun/deliberate_ai/entrypoints/popup/index.html`
   - `/Users/koala/Fun/deliberate_ai/entrypoints/popup/main.tsx`
   - `/Users/koala/Fun/deliberate_ai/src/popup/PopupApp.tsx`
3. Add journal page:
   - `/Users/koala/Fun/deliberate_ai/entrypoints/thinking-journal.html`
   - `/Users/koala/Fun/deliberate_ai/entrypoints/thinking-journal/main.tsx`
   - `/Users/koala/Fun/deliberate_ai/src/thinking-journal/ThinkingJournalApp.tsx`
   - `/Users/koala/Fun/deliberate_ai/src/thinking-journal/view-model.ts`
   - `/Users/koala/Fun/deliberate_ai/src/thinking-journal/thinking-journal.css`
4. Add plan doc:
   - `/Users/koala/Fun/deliberate_ai/prd-learning-journal.md`

## Interfaces / Types
1. Add internal read-model only:
   1. `ThinkingJournalFilter = "all" | "problem_solving" | "delegation" | "learning"`
   2. `ThinkingJournalEntry` (normalized render model)
2. No storage schema mutation in Phase 1.

## TDD Workflow (Required)
1. **Red**
   1. `tests/unit/background-thinking-journal-action.test.ts`
      - action click opens `thinking-journal.html`
   2. `tests/unit/thinking-journal-view-model.test.ts`
      - 7-day window
      - newest-first ordering
      - all four filters
      - hypothesis fallback
      - learning context conditional rendering data
   3. `tests/unit/thinking-journal-app.test.tsx`
      - header/subtext
      - mode badges with requested emojis
      - prompt truncation + Show more
      - filter interaction updates visible cards
2. **Green**
   1. Implement minimal routing + page + view-model to satisfy tests.
3. **Refactor**
   1. Extract formatting/filter helpers, keep tests green.

## Acceptance Criteria (Phase 1)
1. Extension icon opens `thinking-journal.html`.
2. Timeline shows only last 7 days.
3. Filters (`All`, `Problem-Solving`, `Delegation`, `Learning`) work.
4. Problem-Solving shows `Your Hypothesis` and fallback when missing.
5. Mode badges use `🤔 😌 🧑‍🎓`.
6. UI remains calm/minimal and non-analytic.

## Assumptions
1. Reflection implementation is intentionally excluded until Phase 2.
2. File naming can differ from product naming (`prd-learning-journal.md` with Thinking Journal content).
