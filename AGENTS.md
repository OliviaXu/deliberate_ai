# AGENTS.md

## Planning + TDD Rule
- After plan alignment (especially in Plan mode), reshape the plan to a TDD workflow before implementation.
- Required order:
  1. Define or update test cases for the agreed behavior.
  2. Implement failing tests first and run them (red).
  3. Implement the minimal code required to pass tests (green).
  4. Refactor while keeping tests green.
- Do not start production implementation before at least one relevant failing test exists, unless the user explicitly asks to skip TDD.

## Readability Rule
- Prefer explicit call-site logic over one-off helper indirection when the helper does not add a real concept.
- Remove defensive checks if the caller already establishes the invariant, but keep type safety and runtime boundaries honest.
- Name things after the actual domain type instead of ad hoc aliases.
- Centralize repeated domain literals only when it improves readability and reduces duplication.
- Separate persisted facts from transient session heuristics; keep the persisted shape canonical and derive phase-specific behavior at the edge.
- Prefer abstractions that match the current invariant and current phase; defer future-model indirection until a second concrete representation actually exists.
- Treat missing-data caching as a separate policy decision from caching real records; do not conflate "no data yet" with canonical persisted truth.

## Gemini E2E Rule
- Before running Gemini E2E tests, run `npm run gemini:reload-extension` unless you are absolutely sure there have been no code changes since the last Gemini E2E run and the loaded extension still matches the current build.
