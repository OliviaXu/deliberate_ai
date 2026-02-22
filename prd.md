# Deliberate AI — PRD (v1.2)

## 1. Product Overview

**Working Name:** Deliberate AI  
**Tagline:** Pause. Predict. Then Prompt.

Deliberate AI is a Chrome extension for `gemini.google.com` that adds a lightweight pause before prompt submission to encourage intentional AI use and self-awareness in problem-solving.

v1.2 focuses on a prediction -> reflection loop for problem-solving, without enforcement, gamification, analytics, or dashboards.

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

A reflection becomes due only when both are true for the same thread:
- At least 3 assistant responses in that conversation
- At least 5 minutes since the initial problem-solving prompt

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
- User prediction
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
- Reflection score (if completed)
- Reflection notes (if provided)
- Reflection status (`none`, `due`, `completed`, `dismissed`)

Constraints:
- Local storage only
- No cloud sync
- No analytics/telemetry
- No external data transmission

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
- No required reflection gate before next problem-solving prompt
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

### Phase 3: Thread Model + Assistant Turn Counting
- Implement Gemini `thread_id` extraction strategy
- Track assistant response count per thread
- Link assistant turns to captured problem-solving entries

Tracer bullet E2E:
- Start a problem-solving interaction
- Continue until 3 assistant responses
- Verify counters and thread scoping are correct

### Phase 4: Reflection Eligibility Engine
- Mark reflection as due only when both are true:
  - >=3 assistant responses in the same thread
  - >=5 minutes elapsed since initial problem-solving prompt
- Implement status transitions: `none -> due -> completed | dismissed`

Tracer bullet E2E:
- Create eligible and non-eligible threads
- Verify due status appears only when both conditions are met

### Phase 5: In-Thread Cue + Reflection Modal
- Show subtle cue near composer only when current thread has due reflection
- `Review` action opens reflection modal
- Collect learning-delta score (0/25/50/75/100) and optional notes
- Support submit and dismiss

Tracer bullet E2E:
- Reach due state in one thread
- Verify cue appears only in that thread
- Submit reflection and verify status update + cue removal

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
