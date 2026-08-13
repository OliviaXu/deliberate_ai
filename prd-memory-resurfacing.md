# Memory Resurfacing — Early PRD

**Status:** MVP alignment · **Goal:** Ship the smallest experience that lets us feel whether resurfacing past thinking is valuable.

## Problem

Current reflections and the Thinking Journal require the user to remember an old conversation or deliberately open the journal. Useful thoughts are captured but rarely influence future thinking.

## Product thesis

If Deliberate AI quietly resurfaces meaningful past thinking during an activity the user already performs, the journal can become a living history of changing beliefs rather than an archive.

## Core experience

1. An older thought becomes eligible to resurface.
2. On a supported AI chat, a subtle one-line glint appears at the upper-right edge of the composer:

   > **A thought returned —** Small experiments reveal resistance faster than … ↗

3. The glint contains no timestamp or dismiss control. It stays outside the transcript and is visually attributable to Deliberate AI.
4. Clicking it opens the Thinking Journal with that entry featured above the normal seven-day list.
5. The featured entry reuses the existing journal-card visual rather than introducing a new card design.

## Composer placement and timing

- Anchor the glint to the same composer region used by the existing reflection hint, but align it on the right so the reflection hint retains the left side.
- On a reflection-eligible thread, give the existing reflection hint a short head start before revealing the glint.
- If the thread will not show a reflection hint—for example, delegation mode or an already-completed reflection—reveal the glint after the same short page delay.
- Use one simple fixed delay for the MVP; the exact duration is an implementation choice rather than a product requirement.
- Showing the excerpt counts as a successful resurfacing; clicking is optional.

## Thinking Journal

- Add an **A thought returned** label above the featured existing card.
- Keep the card's current prompt, prediction or prior knowledge, reflection, mode, date, and original-chat link presentation.
- Place **Recent thinking — Last 7 days** below it unchanged.
- Add a low-emphasis **Another thought** action so dogfooding can sample another candidate without waiting for another chat visit.

## What gets shown

1. Build the pool from reflection-eligible learning-cycle entries older than the journal's seven-day window.
2. Exclude suppressed entries and entries without a non-empty prediction or prior-knowledge note. Reflections do not determine pool eligibility for the MVP.
3. Prefer entries never resurfaced before; choose randomly among them. If none remain, randomly choose among the least recently surfaced entries.
4. For the glint text, use the latest written reflection, otherwise the prediction, otherwise the prior-knowledge note.
5. Show the selected text verbatim and truncate it visually; do not use AI summarization or ranking.

For the MVP, selection recency is a preference rather than a repetition guard. A single eligible entry may therefore resurface again, and tied candidates are left to the random selection policy above.

## Resurfacing state

Learning-cycle entries and reflections remain canonical, and the displayed excerpt is derived from their current content at selection time. For the MVP, keep only `lastSurfacedAt` on an optional nested `resurfacing` object. It tells selection which entries are unseen or least recently shown.

Phase 1.5 may add `suppressedAt` to the same object. We do not need `lastOpenedAt` unless opening behavior later drives selection or a concrete evaluation need. Split this state into a separate store only when scheduling, event history, or a more complex algorithm becomes a distinct model. The MVP does not copy excerpts into stored candidate records.

## Phase 1A — Resurface and revisit

- Select one eligible past entry.
- Show the composer glint.
- Open the selected entry at the top of the Thinking Journal.
- Record when each entry is presented.
- Do not add a new reflection yet.

Review the surface, content quality, and journal transition before adding in-journal sampling.

## Phase 1B — Sample another thought

- Add the low-emphasis **Another thought** action to the featured journal entry.
- Reuse the same selection policy and record the newly presented entry.
- Allow the same entry to return when it is the only eligible candidate.

For dogfooding, do not add a day-level cadence yet. Show at most one glint per eligible AI-page visit and never replace it automatically on the same page. This phase evaluates the surface, content quality, and journal transition—not final notification frequency.

## Phase 1.5 — Control resurfacing

- Add a low-emphasis **Don't resurface this** action to eligible journal cards.
- Once suppressed, the action becomes **Allow resurfacing** so the decision is reversible.
- Filter suppressed entries before selection. Suppression may advance to **Another thought** in the journal, but it does not push a replacement into the AI chat.
- After dogfooding candidate quality, introduce and tune the automatic day-level cadence.

## Phase 2 — Reflect again

- Add **What do you believe now?** to the featured journal entry.
- Append a new timestamped reflection linked to the same learning-cycle entry.
- Preserve and display earlier reflections as a history rather than overwriting them.
- Build the revisit interaction inside the Thinking Journal. Reuse the existing reflection model and relevant visual language where helpful, without moving the current in-chat modal into the journal.
- Decide during Phase 2 design whether the current learning-delta score remains useful alongside free text.

## Outside the MVP

- Native notifications, extension badges, or a popup inbox.
- User-configurable cadence or formal spaced repetition.
- Multiple queued memories.
- AI-generated summaries or quality scoring.
- Editing or deleting historical content.
- Analytics UI, charts, streaks, or gamification.

## What we need to learn

1. Is the glint noticeable without feeling intrusive?
2. Is the surfaced text meaningful without added explanation?
3. Does opening the existing journal card feel like a natural continuation?
4. After Phase 1, do we need suppression before adding reflection?
5. Do we want to reread only, or add another reflection layer?
6. After several returns, does the experience feel inspiring or repetitive?
