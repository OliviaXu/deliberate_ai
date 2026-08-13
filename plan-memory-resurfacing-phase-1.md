# Phase 1 — Resurface and Revisit Delivery Plan

## Summary

Deliver memory resurfacing in two milestones:

1. Select a past thought, show the composer glint, and open the thought as a featured Thinking Journal card.
2. Let the user request another thought from the featured journal view.

Selection recency is a preference, not a repetition guard. A single eligible thought may resurface repeatedly.

## Selection model and interfaces

- Keep learning-cycle records under their existing storage key and add optional `resurfacing: { lastSurfacedAt: number }` state.
- Expose `resurfacing:present-next`, returning `{ learningCycleRecordId, excerpt } | null`.
- Build the candidate pool from reflection-eligible learning-cycle records strictly older than the journal's seven-day window.
- Require non-whitespace prediction or prior-knowledge material for pool eligibility. A reflection does not determine eligibility.
- Select a learning-cycle record before looking up its excerpt:
  - randomly choose among records that have never surfaced;
  - after all records have surfaced, randomly choose among records tied for the oldest `lastSurfacedAt`;
  - do not exclude the current or most recently surfaced record.
- For the selected record's excerpt, prefer its latest non-empty reflection, then prediction, then prior-knowledge note.
- Trim text only to determine whether it is empty; display the original text verbatim and truncate it visually.
- Serialize selection and persistence in the background, record `lastSurfacedAt` before returning, and preserve concurrent learning-cycle updates.
- Expose `resurfacing:open-journal` to open `thinking-journal.html?featured=<encoded-id>` in a new tab.

## Milestone 1 — Glint and featured revisit

### TDD sequence

1. Add failing selection and persistence tests covering:
   - the seven-day boundary;
   - eligible learning-cycle modes;
   - whitespace-only material;
   - excerpt precedence;
   - unseen random selection;
   - least-recent selection;
   - repeating singleton selection;
   - persistence and serialized requests.
2. Implement the selector, learning-cycle update operation, background service, and runtime handlers.
3. Add failing composer tests, then implement one presentation request after a fixed two-second delay per content-script lifetime.
4. Add failing journal tests, then load the query-selected historical record above the normal recent feed using the reusable journal-card component.
5. Verify unit tests, typecheck, build, and local E2E before reviewing the milestone.

### Experience

- Keep the existing reflection hint left-aligned and render the resurfacing glint on the composer's right side.
- Present “A thought returned —”, a visually truncated verbatim excerpt, and `↗` as one accessible button.
- Do not show a timestamp or dismissal control.
- Do not retry or replace the glint during same-page thread navigation.
- Keep the glint visible after it opens the featured journal tab.
- Render “A thought returned” and the selected historical card above “Recent thinking — Last 7 days.”
- Keep the featured card independent of recent-feed filters.
- Preserve the unfeatured journal experience for extension-action visits and invalid record IDs.

## Milestone 2 — Another thought

### TDD sequence

1. Add failing store, service, React, and E2E tests for requesting another candidate, recording its presentation, replacing the featured card, and updating the `featured` query parameter.
2. Reuse `resurfacing:present-next` without an exclusion parameter.
3. Replace the featured card and URL after a successful selection.
4. If selection returns no candidate or fails, retain the current card and show a quiet retryable error.
5. Verify unit tests, typecheck, build, and local E2E before reviewing the milestone.

### Experience

- Place a clearly visible secondary “Another thought” button at the lower right of the featured card.
- Use a neutral light border, white background, dark text, and no native button shadow.
- Keep the recent feed, filters, and export behavior unchanged.
- Allow a one-entry pool to present the same thought again and update its `lastSurfacedAt`.

## E2E acceptance scenarios

- Seed recent and historical entries plus multiple reflections.
- Verify the glint appears only after the delay and uses the latest written reflection verbatim.
- Verify presentation time is persisted and only one glint is selected during the page lifetime.
- Click the glint and capture the new extension tab with the selected historical card featured above the recent list.
- Request another thought and verify the card, URL, and stored presentation state change.
- Verify a one-entry pool may select and present the same thought again.

## Assumptions and deferred work

- The shared content integration applies the feature to all supported AI platforms.
- A page visit is one content-script lifetime; SPA thread changes do not create new resurfacing opportunities.
- Suppression, cadence controls, analytics, and follow-up reflection remain outside Phase 1.
- Reload the Gemini extension immediately before any later Gemini smoke E2E run.
