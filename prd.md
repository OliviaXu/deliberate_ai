# Deliberate AI — PRD (v1.2)

## 1. Product Overview

**Working Name:** Deliberate AI  
**Tagline:** Pause. Predict. Then Prompt.

Deliberate AI is a Chrome extension for `gemini.google.com` that adds a lightweight pause before prompt submission to encourage intentional AI use and self-awareness in problem-solving and learning.

v1.2 focuses on a prediction/context -> reflection loop for problem-solving and learning interactions, without enforcement, gamification, analytics, or dashboards.

## 2. Product Goal (v1.2)

Build self-awareness around:
- When AI is used for delegation vs core thinking
- How personal predictions evolve after AI interaction
- Cognitive calibration over time

Deliberate AI is not a discipline tool and not a productivity optimizer. It is a reflection mirror.

## 3. Target Platforms

- `gemini.google.com`

## 4. Core User Flow

### 4.1 Prompt Interception

**Trigger condition:**
- User clicks Send, or
- User presses Enter to submit a prompt

The extension intercepts submission and shows a lightweight mode-selection modal.

### 4.2 Mode Selection (Required)

Prompt:
> What kind of thinking is this?

Options:
- Delegating a mundane task
- Solving a core problem
- Learning / exploring

User must select one option before prompt submission continues.

### 4.3 Mode Flows

#### A. Delegation Mode (Mundane Tasks)
- User selects `Delegating a mundane task`
- No extra friction
- Prompt is sent immediately
- Interaction is stored locally (required)

Stored fields include:
- Timestamp
- Platform
- Thread ID
- Mode
- Original prompt

#### B. Problem-Solving Mode (Core Thinking)
- User selects `Solving a core problem`
- Prediction field is required:
  - "What do you currently believe is the answer? What is your hypothesis?"
- Minimum length: 100 characters
- Prompt cannot be sent until prediction is valid

After submit, store:
- Timestamp
- Platform
- Thread ID
- Original prompt
- Prediction
- Mode

#### C. Learning / Exploration Mode
- Optional field:
  - "What do you already know about this?"
- Prompt is sent immediately
- Data is stored locally

## 5. Reflection System (v1.2 Scope)

### 5.1 Reflection Trigger (Background Eligibility)

A reflection uses a two-path eligibility model for eligible interactions (`problem_solving` and `learning`), with no persisted turn counters:

- Active-thread path (content-script memory, same tab session):
  - Turn tracking begins on the second prompt submission in the same thread after the initial eligible interaction prompt
  - At least 3 tracked prompt submissions in that thread, or
  - At least 5 minutes since the initial eligible interaction prompt timestamp
- Historical-thread fallback path (no in-memory turn history available):
  - At least 5 minutes since the initial eligible interaction prompt
  - This reuses the persisted learning-cycle timestamp and does not recover active-session turn counts

Implementation note for v1.2:
- Eligible interaction modes are `problem_solving` and `learning`
- Content-script runtime memory is keyed by `thread_id`
- For each thread, track only the latest unresolved eligible interaction in memory once second-turn tracking has started:
  - `learningCycleId`
  - `mode`
  - `capturedAt` (persisted learning-cycle timestamp for both active and historical time-based checks)
  - `followUpSubmissionsObserved`
  - computed `status`
- Recompute status at runtime on these events:
  - eligible interaction captured
  - second-turn tracking started for the current thread
  - subsequent prompt submission observed in the current thread
  - thread navigation within the tab
  - historical-thread lookup result received
  - periodic time check while a tracked interaction is still within the 5-minute waiting window
- Status rules:
  - `none`: no eligible unresolved interaction is currently due
  - `due`: active-thread path or historical-thread path is satisfied
- Hint visibility is derived only from the current thread's computed status being `due`
- `completed` / `dismissed` are deferred to Phase 5, when reflection actions are actually persisted

### 5.2 Reflection Surfacing (Subtle, In-Thread)

- No automatic reflection modal interruption
- No icon-color nudge for reflection urgency in v1.2
- A subtle inline cue appears near the input box only when the current thread has a due reflection

Example cue:
- `Reflection available`
- `Review` action

The cue should be ambient and not block primary chat flow.

### 5.3 Reflection Modal

Opened only when user clicks `Review` in-thread (or opens reflection from extension UI, if present).

Display:
- Original prompt
- User prediction or initial context note, depending on mode
- Timestamp

Prompt:
> How much did this interaction update your thinking?

Score scale:
- 0 = Nothing new learned
- 25 = Minor nuance
- 50 = Meaningful update
- 75 = Major reframing
- 100 = Learned a ton / highly surprising

Optional notes:
- What surprised you?
- What would you think differently next time?

Buttons:
- Submit reflection
- Dismiss (this thread only)

## 6. Thread Identity and Scope

`thread_id` is a conversation identifier, not a tab identifier.

It is used to:
- Group interactions by conversation
- Evaluate reflection eligibility per conversation
- Scope dismiss behavior to a specific conversation
- Show reflection cue only in the relevant conversation

## 7. Data Storage (Local Only)

Store per interaction:
- Date/timestamp
- Platform
- Thread ID
- Mode
- Original prompt
- Prediction (problem-solving mode only)
- Learning-context note (learning mode, optional)

Store per reflection action:
- Reflection score (if completed)
- Reflection notes (if provided)
- Reflection status (`completed` or `dismissed`)

Constraints:
- Local storage only
- No cloud sync
- No analytics/telemetry
- No external data transmission

Derived runtime states (not persisted as counters/status snapshots):
- `none`: no due reflection yet
- `due`: eligible by active-thread or historical fallback rules
- `completed` / `dismissed`: deferred until reflection actions are persisted in Phase 5

## 8. Extension Icon Behavior (v1.2)

- Do not use icon color states to signal pending reflection urgency
- Keep icon behavior neutral/minimal
- Reflection prompt timing should be conveyed primarily in-thread near the composer

## 9. Non-Goals (Strict v1.2 Exclusions)

- No dashboards
- No charts
- No streaks
- No performance analysis
- No AI-generated meta insights
- No required reflection gate before next eligible prompt
- No gamification
- No snooze functionality

## 10. Success Criteria (v1.2)

Qualitative:
- User consistently pauses before submitting core problem-solving prompts
- User completes at least 50% of due reflections

Subjective:
- User reports increased awareness of outsourcing thinking
- User notices calibration patterns over time

## 11. UX Principles

- Gentle, not punitive
- Minimal visual noise
- Keyboard-friendly
- Fast (target under 2 seconds for interruption flow)
- Reflection should feel curious, not judgmental
- Avoid interrupting primary chat flow once prompt is sent

## 12. Open Questions (Deferred)

- Weekly review mode?
- Calibration trend tracking?
- Mode distribution stats?
- Pattern detection?
- End-of-day reflection batch?

Out of scope for v1.2.

## 13. Implementation Phases (Tracer Bullets)

Each phase should deliver a thin vertical slice that can be run end-to-end on `gemini.google.com`.

### Phase 0: Extension Skeleton + Safe Intercept
- Build MV3 scaffold (manifest, content script, popup placeholder, storage utility)
- Detect Gemini send actions (Enter/click) without changing behavior
- Add debug logging toggle

Tracer bullet E2E:
- Load extension and send a prompt on Gemini
- Confirm interception events are detected
- Confirm native send still works unchanged

### Phase 1: Minimal Pause Modal
- Block send once and show a lightweight mode-selection modal
- Require mode selection before continuing
- Resume original send path after selection

Tracer bullet E2E:
- Send action opens modal every time
- Cannot continue without selecting a mode
- Selected mode allows prompt to send successfully

### Phase 2: Mode Logic + Local Persistence
- `delegation`: immediate send + store prompt/mode/thread/timestamp
- `problem_solving`: require >=100-char prediction before send + store
- `learning`: optional prior-knowledge note + store
- Persist records in `chrome.storage.local`

Tracer bullet E2E:
- Execute one prompt for each mode
- Verify stored records are correct
- Reload page/browser and confirm data persists

### Phase 3: Hint Visual Exploration + Thread Scoping
- Implement Gemini `thread_id` extraction strategy for stable in-thread scoping
- Introduce subtle in-thread reflection hint UI and interaction affordance
- Show hint immediately after eligible interaction capture for visual/placement validation (no eligibility gate yet)

Tracer bullet E2E:
- Start an eligible interaction
- Verify hint appears in the originating thread and not in another thread
- Validate placement, copy, and dismissibility of the hint visual

### Phase 4: Reflection Eligibility Engine
- Implement active-thread eligibility in content-script memory:
  - start turn tracking on the second prompt submission in same thread (same tab session) after an eligible interaction
  - >=3 tracked prompt submissions in same thread, or
  - >=5 minutes elapsed since the initial eligible interaction prompt timestamp
- Implement historical-thread fallback eligibility:
  - >=5 minutes elapsed since initial eligible interaction prompt
- Runtime implementation shape:
  - maintain a per-thread in-memory candidate for the latest unresolved eligible interaction after second-turn tracking starts
  - increment tracked submission count only from live submit interception in the active tab session
  - on page reload/open, recover only from persisted interaction records and use their original timestamps
  - compute `none -> due` at runtime instead of persisting counters or snapshots
  - render the hint only when the current thread's candidate is computed as `due`
- Compute status transitions at runtime: `none -> due`
- Gate hint visibility on computed `due` status instead of always-on visual exploration

Tracer bullet E2E:
- Create active eligible/non-eligible threads for `problem_solving` and `learning` and verify 3-turn or 5-minute behavior
- Reload/open historical thread and verify fallback due behavior without persisted turn counters
- Verify due status appears only in correct thread contexts

### Phase 5: Reflection Modal + Persistence
- Finalize in-thread cue behavior for due interactions
- `Review` action opens reflection modal
- Collect learning-delta score (0/25/50/75/100) and optional notes
- Persist reflection actions (`completed` or `dismissed`) and suppress re-prompting for that interaction

Tracer bullet E2E:
- Reach due state in one thread via active or historical path
- Submit reflection and verify persisted completion + cue removal
- Dismiss reflection and verify persisted dismissal + no repeated due cue for that interaction

### Phase 6: UX Hardening + Failure Safety
- Ensure fail-open if selectors/interception fail
- Keyboard navigation and focus handling
- Prevent duplicate listeners and stale-thread errors
- Validate interruption performance target

Tracer bullet E2E:
- Run full flow on fresh and reloaded sessions
- Test keyboard-only operation
- Confirm send path remains reliable under failure conditions

### Phase 7: Private Beta Packaging
- Remove debug-only UI paths
- Add concise tester checklist
- Package extension for manual install

Tracer bullet E2E:
- Install in a clean Chrome profile
- Complete capture -> reflection flow without developer tooling
