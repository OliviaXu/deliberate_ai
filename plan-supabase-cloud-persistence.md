# Supabase Cloud Persistence Delivery Plan

## Summary

Add an opt-in **Cloud sync** mode while retaining **Local only** as the default. Complete the local v2 schema migration first, then tackle the riskiest Supabase concerns—authentication and row-level security—before implementing reconciliation and continuous cross-device sync.

Learning cycles remain mutable snapshots. Reflections are immutable one-to-many events. Every phase follows red → green → refactor and ends with an independent E2E tracer bullet.

## Canonical v2 models

```ts
interface LearningCycleBaseV2 {
  id: string;
  occurredAt: number;
  platform: PlatformId;
  threadId: string;
  url?: string;
  prompt: string;
  resurfacing?: {
    lastSurfacedAt?: number;
    suppressedAt?: number;
  };
}

interface DelegationLearningCycleV2 extends LearningCycleBaseV2 {
  mode: 'delegation';
}

interface ProblemSolvingLearningCycleV2 extends LearningCycleBaseV2 {
  mode: 'problem_solving';
  startingPoint: string;
}

interface LearningLearningCycleV2 extends LearningCycleBaseV2 {
  mode: 'learning';
  startingPoint?: string;
}

type LearningCycleV2 =
  | DelegationLearningCycleV2
  | ProblemSolvingLearningCycleV2
  | LearningLearningCycleV2;

interface ReflectionV2 {
  id: string;
  learningCycleId: string;
  occurredAt: number;
  score: 0 | 25 | 50 | 75 | 100;
  notes?: string;
}
```

Decisions:

- Keep `url` as the original or resolved AI-conversation URL.
- Consolidate `prediction` and `priorKnowledgeNote` into `startingPoint`.
  - `problem_solving`: required and non-empty.
  - `learning`: optional.
  - `delegation`: absent.
- Rename domain-event `timestamp` to `occurredAt`.
- Rename `learningCycleRecordId` to `learningCycleId`.
- Remove reflection `status`; the presence of a reflection means it was completed.
- Do not store `threadId` on reflections; the learning-cycle association is sufficient.
- Permit unlimited reflections per learning cycle.
- Treat all IDs as opaque strings. Preserve migrated IDs exactly; generate new learning-cycle and reflection IDs with `crypto.randomUUID()` and never parse meaning from them.
- Version storage keys rather than individual records:
  - `deliberate.learningCycles.v2`
  - `deliberate.reflections.v2`
  - `deliberate.schemaMigration.v2`

## Supabase schema

TypeScript stores event times as Unix milliseconds. The cloud adapter converts them to and from PostgreSQL `timestamptz` values.

### `learning_cycles`

| Column | Type | Rules |
|---|---|---|
| `user_id` | `uuid` | Owner; defaults to `auth.uid()` and references `auth.users(id)` |
| `id` | `text` | Opaque client-generated ID |
| `occurred_at` | `timestamptz` | Original interaction time |
| `platform` | `text` | `chatgpt`, `claude`, or `gemini` |
| `thread_id` | `text` | Required; may begin as the existing placeholder |
| `url` | `text null` | Original or resolved conversation URL |
| `prompt` | `text` | Required |
| `mode` | `text` | `delegation`, `problem_solving`, or `learning` |
| `starting_point` | `text null` | Required for problem solving, optional for learning, absent for delegation |
| `last_surfaced_at` | `timestamptz null` | Latest presentation time |
| `suppressed_at` | `timestamptz null` | Present only while suppressed |
| `suppression_changed_at` | `timestamptz null` | Cloud reconciliation metadata, including ordering an unsuppress action |
| `created_at` | `timestamptz` | Supabase insertion time; defaults to `now()` |
| `updated_at` | `timestamptz` | Server-maintained mutable-row update time |

Constraints:

- Primary key `(user_id, id)`.
- `user_id` references `auth.users(id)` with account-deletion cascading.
- A mode-aware check constraint enforces the `starting_point` rules.
- A platform check constraint accepts the currently supported platform IDs.

### `reflections`

| Column | Type | Rules |
|---|---|---|
| `user_id` | `uuid` | Owner; defaults to `auth.uid()` |
| `id` | `text` | Opaque reflection-event ID |
| `learning_cycle_id` | `text` | Required, non-unique association |
| `occurred_at` | `timestamptz` | Reflection completion time |
| `score` | `smallint` | One of `0`, `25`, `50`, `75`, `100` |
| `notes` | `text null` | Empty or whitespace-only notes normalize to `null` |
| `created_at` | `timestamptz` | Supabase insertion time; defaults to `now()` |

Constraints:

- Primary key `(user_id, id)`.
- Foreign key `(user_id, learning_cycle_id)` references `learning_cycles(user_id, id)`.
- No uniqueness constraint on `learning_cycle_id`.
- No `updated_at`; reflections are append-only.

### Initial index policy

Create no explicit secondary indexes. The two composite primary keys automatically provide indexes beginning with `user_id`, which is sufficient for the initial RLS owner filtering and record-by-ID operations.

Deterministic reflection ordering remains `ORDER BY occurred_at, id`; correctness does not require a supporting index for the initially small, fully fetched dataset.

Add an index only with a concrete cloud query and a verified query plan:

- Server-side journal pagination: `(user_id, occurred_at desc, id)`.
- Per-cycle reflection retrieval: `(user_id, learning_cycle_id, occurred_at, id)`.
- Direct cloud thread lookup: `(user_id, platform, thread_id, occurred_at desc)`.
- Cloud-side resurfacing selection: an index derived from that selection query.

Normal thread lookup, journal ordering, reflection grouping, and resurfacing selection continue against the downloaded local store, so none of those secondary indexes are needed now.

## Authentication, secrets, and RLS

### Authentication experience

- Use a Supabase email verification code: `signInWithOtp` sends the code and `verifyOtp` exchanges it for a session.
- Configure the Supabase email template with `{{ .Token }}` so the user enters a code in the extension; no redirect flow is required.
- Do not create or retain a permanent user password.
- Persist the Supabase access and refresh session through a custom async storage adapter backed by `chrome.storage.local`.
- Bind a browser profile's local dataset to the first Supabase user who enables sync. Block a different account from enabling sync until a future explicit account-switch or local-reset workflow exists.

### Secret handling

- Bundle only the Supabase project URL and publishable key. They are public client configuration, not secrets.
- Never include the service-role key or database password in extension code, build output, committed files, or browser storage.
- Keep administrative credentials only in local or CI secret storage used for migrations and security tests.
- Add host permission only for the exact Supabase project origin.

### RLS and database privileges

- Enable RLS on both tables.
- Derive ownership only from `(select auth.uid()) = user_id`; do not use editable user metadata.
- Give `authenticated` users:
  - `SELECT` and `INSERT` on both tables;
  - column-limited `UPDATE` on the mutable learning-cycle thread and resurfacing fields;
  - no reflection update;
  - no delete in this release.
- Give `anon` no table access.
- Require `auth.uid() = user_id` in insert `WITH CHECK` policies.
- Require `auth.uid() = user_id` in both `USING` and `WITH CHECK` clauses for learning-cycle updates.
- Use the composite reflection foreign key to prevent cross-owner associations.
- Add security-invoker RPCs for atomic, operation-specific updates:
  - resolve a placeholder thread ID and URL;
  - advance `last_surfaced_at` without time regression;
  - set or clear suppression only when the incoming action is newer.

## Phase 0 — Local v2 schema and one-time launch migration

### Characterization and failing tests

1. Add green characterization tests around current v1 behavior before refactoring:
   - journal history and ordering;
   - reflection eligibility and due timing;
   - multiple reflections per learning cycle;
   - resurfacing selection and excerpt precedence;
   - suppression and unsuppression;
   - URL reconstruction;
   - CSV export.
2. Add failing migration and v2-store tests covering:
   - every interaction mode and optional-field combination;
   - `prediction` and `priorKnowledgeNote` conversion to `startingPoint`;
   - zero, one, and multiple reflections per cycle;
   - score-only and written reflections;
   - placeholder and resolved threads;
   - present and missing URLs;
   - all combinations of `lastSurfacedAt` and `suppressedAt`;
   - invalid, dangling, and legacy reflection records;
   - duplicate IDs;
   - restart, partial failure, and repeated-launch behavior.
3. Add parity tests that run the same fixtures through current v1 behavior and migrated v2 behavior, asserting identical user-visible journal, reflection, resurfacing, URL, and export results except for the intentional schema renames.

### Implementation

1. Run migration on background launch before registering runtime handlers.
2. Convert:
   - `timestamp` → `occurredAt`;
   - `prediction` or `priorKnowledgeNote` → `startingPoint`;
   - `learningCycleRecordId` → `learningCycleId`;
   - remove reflection `status` and any unused legacy `threadId`.
3. Preserve valid IDs, URLs, thread identities, complete reflection histories, and resurfacing state.
4. Drop invalid or dangling reflections and record input, output, and dropped counts in the migration marker.
5. Write both v2 arrays and the completed marker in one `chrome.storage.local.set` call.
6. Make migration deterministic and restart-safe:
   - without a completed marker, regenerate v2 from untouched v1 data;
   - with the marker, read and write only v2;
   - never append migrated records onto an earlier partial result.
7. Retain v1 keys as unused rollback data for the first release; never merge from them after successful migration.
8. Update stores, runtime messages, journal grouping, export, due logic, and resurfacing behavior to use the v2 contracts.
9. Make local inserts idempotent by ID.

### Phase gate and E2E tracer bullet

- Run the entire existing unit suite against v2, not only migration tests.
- Run typecheck, build, and the full local E2E suite.
- Seed v1 storage through the real browser harness with all three modes, resolved and placeholder threads, multiple reflections, URL data, and suppression state.
- Launch through the real background startup, verify all user-visible behavior from v2, restart, and prove the migration neither reruns nor duplicates records.
- Block the phase if any current user-visible behavior changes outside the intentional schema changes.

## Phase 1 — Supabase authentication and security boundary

### TDD sequence

1. Add failing database tests that inspect RLS enablement, policies, grants, foreign keys, immutable reflection permissions, and RPC privileges.
2. Add failing integration tests using anon, user A, and user B sessions:
   - anon cannot read or write;
   - each user sees only their rows;
   - spoofed `user_id` is rejected;
   - user B cannot attach a reflection to user A's cycle;
   - reflections cannot be updated or deleted;
   - immutable learning-cycle columns cannot be updated;
   - stale operation-specific updates cannot regress newer state.
3. Implement the Supabase migration containing tables, constraints, policies, grants, server timestamps, and RPCs.
4. Add the Supabase client, `chrome.storage.local` auth adapter, email-code sign-in, sign-out, and session refresh.
5. Add a minimal Cloud persistence panel to the Thinking Journal showing signed-out, verification-code, signed-in, and error states.
6. Refactor while keeping the database and extension tests green.

### E2E tracer bullet

Sign in as user A through the extension, insert and read one learning cycle plus one reflection, reload and retain the session, then prove user B and anon cannot observe or alter either row. Run this automatically against local Supabase and once against the hosted free-tier project before Phase 2.

## Phase 2 — Opt-in initial reconciliation

### TDD sequence

1. Add failing reconciliation tests for local-only, cloud-only, matching duplicates, conflicting duplicates, multiple reflections, mutable learning-cycle state, pagination, partial failure, and rerun safety.
2. Add two persistence modes:
   - **Local only**: default; no content leaves the browser.
   - **Cloud sync**: explicit opt-in after authentication.
3. On first enable:
   - require completed local v2 migration;
   - bind the dataset to the authenticated user;
   - fetch every cloud row with pagination;
   - insert missing local rows into cloud;
   - download missing cloud rows locally;
   - reconcile matching learning cycles with operation-specific rules.
4. For duplicate inserts:
   - use `ON CONFLICT DO NOTHING`;
   - fetch the existing row;
   - accept it only when immutable content matches;
   - report a per-record conflict rather than overwriting mismatched content.
5. Reconcile mutable learning-cycle fields as follows:
   - a concrete thread identity beats a placeholder;
   - two different concrete identities produce a conflict;
   - `lastSurfacedAt` takes the maximum;
   - suppression uses `suppression_changed_at` ordering;
   - reflections are never updated or merged in place.
6. Mark Cloud sync enabled only after reconciliation completes. Partial inserts remain safe because reconciliation is idempotent.
7. Expose **Sync now**, last successful sync time, and a quiet “needs attention” state.
8. Disabling sync stops network work but retains local and cloud data.

### E2E tracer bullet

Seed a migrated local dataset with all modes, multiple reflections, original URLs, and suppression. Enable Cloud sync, then use a fresh extension profile signed into the same account to download it and reconstruct the same journal, URLs, reflection history, and resurfacing behavior.

## Phase 3 — Continuous and offline-safe synchronization

### Domain-write and outbox contract

“After writes” means after each successful local domain mutation initiated by the extension:

- create a learning cycle;
- resolve its thread ID and URL;
- add a reflection;
- record resurfacing;
- suppress or unsuppress resurfacing.

For Cloud sync mode, perform this sequence:

1. Atomically update the v2 domain record in `chrome.storage.local` and enqueue an account-bound cloud operation.
2. Acknowledge the local mutation without waiting for the network.
3. Ask the background worker to flush queued operations to Supabase.
4. Remove an operation only after Supabase acknowledges it or confirms that the identical result already exists.

This does not apply to arbitrary extension-storage writes and does not mean flushing after a Supabase write.

### TDD sequence

1. Add failing tests for cloud-enabled creation, each mutable update, retries, offline behavior, reordered operations, duplicate delivery, session expiry, sign-out, and service-worker restart.
2. Implement the account-bound outbox separately from canonical domain records.
3. Flush after local domain mutations, on background startup, when the journal opens, and through **Sync now**:
   - record creation uses idempotent inserts;
   - thread resolution uses the conditional RPC;
   - resurfacing time advances monotonically;
   - suppression set or clear carries its action time.
4. Pull remote changes after flushing and validate Supabase responses at the external boundary before writing local v2 state.
5. Quarantine invalid remote rows and immutable ID conflicts from local state, log without content bodies, and surface “needs attention.”
6. Signing out stops flushing but retains the account-bound queue. Resume it only when the same user signs back in.

### E2E tracer bullet

Device A creates a learning cycle, adds two reflections, and changes suppression while temporarily offline. After reconnecting, Device B syncs and sees the complete ordered history and latest state. Retry the delivery and prove that no duplicate row is created.

## Verification and rollout gates

For every phase:

1. Add or update tests for the agreed behavior.
2. Run at least one relevant test red before production implementation.
3. Implement the minimum behavior required to reach green.
4. Refactor while keeping focused tests green.
5. Run focused tests, the full unit suite, typecheck, build, and the phase's E2E tracer.
6. Reload the Gemini extension before every Gemini E2E run unless the loaded build is certainly current.
7. Review the implementation after unit and E2E verification, report findings, and wait for the user to select fixes.
8. Commit only after explicit user approval.

Before hosted rollout, also:

- run the anon/user-A/user-B RLS matrix against the hosted project;
- inspect database policies and grants from system catalogs;
- run Supabase's security checks;
- audit the built extension bundle for forbidden administrative credentials;
- verify that Local only produces no Supabase network traffic.

## Assumptions and deferred work

- Cloud content is queryable plaintext protected by TLS, Supabase-managed storage encryption, authentication, and RLS; it is not end-to-end encrypted.
- Local only remains fully functional without an account or network connection.
- The initial product supports one cloud account per browser profile.
- Reflection editing and deletion, learning-cycle deletion, account switching, realtime subscriptions, sharing, and automatic random-day delivery remain deferred.
- The persistence layer exposes ordered records suitable for the later spaced-repetition experience, but this plan does not define that scheduling experience.
