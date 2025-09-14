# DevTeam Feature Implementation — Work Breakdown Structure (WBS)

Scope: Deliver the DevTeam Autonomous Execution Engine in phased increments, integrated non-disruptively into existing CRM UI and architecture.

Priorities (per directive):
- Phase 1: Code-change workflow + core task execution with STOP-ON-ERROR
- Phase 2: Task injection
- Phase 3: Error solving
- Auth simplification: Single authenticated user ⇒ treat as admin (full access). Role-based gating deferred.

Grounding (key sources):
- [devTeam_design_blueprint.md](docs/DevTeam/core_docs/devTeam_design_blueprint.md:1)
- [devTeam_charter.md](docs/DevTeam/core_docs/devTeam_charter.md:30)
- [INFORMATION_ARCHITECTURE.md](docs/DevTeam/core_docs/INFORMATION_ARCHITECTURE.md:1)

Integration constraints:
- Non-disruptive augmentation of Task UI at [TaskList.jsx](src/components/tasks/TaskList.jsx:77)
- Redux-first, createAsyncThunk for all async ops; no new custom data-fetch hooks
- WebSocket channel /devteam with backoff, throttle/batch per design


## Phase 1 — Core Execution With Stop-On-Error (MVP)

Outcome:
- Deterministic pipeline: SELECT → PREP → IMPLEMENT → VERIFY
- On any failure in IMPLEMENT or VERIFY, STOP (no automatic retries)
- UI integration inside existing tasks view; minimal new components
- Redux slice for devTeam execution state and logs
- Runner API contracts used: /prep, /implement, /verify (assume server running)

WBS Tree (Phase 1):

1) Feature Flag & UI Entry
- 1.1 Add DEVTEAM_ENABLED flag in config; read via [src/config.js](src/config.js)
- 1.2 Gate “DevTeam Executions” tab/section in [TaskList.jsx](src/components/tasks/TaskList.jsx:77) (non-disruptive)
- 1.3 Minimal route/state hook-up (no global router changes required for MVP; integrate within Task UI)

2) Redux State & Actions
- 2.1 Create devTeam slice (planned path): src/store/slices/devTeamSlice.js
  - State: customers/byId, executions.byCustomerId, logs.byCustomerId, connection, status {autonomous|initializing|task-executing|error|paused|completed}
  - Actions: updateExecutionProgress, setWebSocketConnected, appendLog, setStatus, setStopPoint, setActiveCustomer
- 2.2 Thunks:
  - initExecution(customerId), resumeExecution(customerId), pauseExecution(customerId)
  - setStopPoint({customerId, taskId})
  - runNextTask({customerId}) — orchestrates SELECT→PREP→IMPLEMENT→VERIFY, STOP on error
  - connectWs(), disconnectWs() for live logs/status

3) Services (API + WS)
- 3.1 devTeamRunnerService (planned path): src/services/devTeamRunnerService.js
  - prep({repoUrl, taskId, idempotencyKey}) → POST /prep
  - implement({taskId, branch, tool, criteria}) → POST /implement
  - verify({taskId, branch, criteria}) → POST /verify
- 3.2 devTeamWebSocketService (planned path): src/services/devTeamWebSocketService.js
  - connect('/ws/devteam'), dispatch batched: execution-update, execution-log
  - Reconnect with backoff, throttle updates

4) SELECT Logic (Task Selection)
- 4.1 Read tasks_list.md from repo via runner (delegate to runner to parse & return first incomplete atomic task)
- 4.2 Ensure dependencies satisfied (runner-provided)
- 4.3 Produce task payload {id, title, deps[], criteria[]}

5) PREP Logic
- 5.1 Ensure local repo exists (runner does clone/prepare)
- 5.2 Create task branch: task/<id>-<kebab-title>
- 5.3 Capture logs; set status INITIALIZING

6) IMPLEMENT Logic
- 6.1 Tool default: Aider for minimal diffs (per blueprint)
- 6.2 Capture diff, stdout/stderr, artifacts; set status TASK-EXECUTING
- 6.3 On implement failure ⇒ set status ERROR and STOP

7) VERIFY Logic
- 7.1 MVP checks subset:
  - test.coverage (unit tests touched scope ok to run)
  - type.strict (tsc/pyright as applicable; for frontend, tsc if present; else skip)
  - doc.updated (ensure required doc anchors updated if touched; lenient in MVP)
- 7.2 On verify failure ⇒ set status ERROR and STOP
- 7.3 On success ⇒ mark task complete; update UI progress; auto-advance is NOT enabled in Phase 1 (explicit runNextTask call only)

8) STOP-ON-ERROR Semantics
- 8.1 Any failure in IMPLEMENT/VERIFY halts progression (no retries)
- 8.2 UI shows error summary with last logs and failing step
- 8.3 Developer can Resume from same task after manual fix (Phase 1 limited to re-run)

9) UI Components (Minimal)
- 9.1 DevTeamExecutionsTab (embedded in TaskList area)
  - Shows essential metrics (status, progress, currentTask)
  - Actions: Initialize, Resume, Pause, Set Stop Point, Run Next Task
- 9.2 ExecutionHeader: customer, status, controls
- 9.3 LiveExecutionMonitor: basic stats + live logs tail
- 9.4 LogsViewer: capped buffer (1k lines), follow tail toggle
- 9.5 StopPointControl: input/select for “stop after task X.X.X.X”

10) Telemetry & Observability (MVP)
- 10.1 Append-only client logs per customer (1k lines cap)
- 10.2 Basic metrics derived via selectors
- 10.3 WS connection indicator (connected/disconnected)

11) Documentation
- 11.1 Feature flag usage and UI entry point
- 11.2 Execution pipeline overview (Phase 1 limits)
- 11.3 cURL examples for /prep, /implement, /verify (manual verification)

Deliverables (Phase 1):
- Redux slice: devTeamSlice with actions/selectors
- Thunks: init/resume/pause/runNextTask/connectWs
- Services: devTeamRunnerService, devTeamWebSocketService
- UI: embedded DevTeamExecutionsTab with controls, LogsViewer
- Docs: feature flags, pipeline overview, curl tests

Open Decisions (Phase 1):
- Runner base URL and auth shape (env/config)
- Target repo(s) and tasks_list.md location
- Minimal VERIFY criteria exact set (finalize subset)
- Feature flag default (DEVTEAM_ENABLED default false for prod)


## Phase 2 — Task Injection (Add-On)

Outcome:
- PM-style task injection deferred; for single-admin MVP, allow basic “Priority” injection without approvals
- UI: TaskInjectionButton opens modal; ImpactAssessmentPanel basic (timeline-only)
- State: taskInjection queue in devTeam slice
- Thunks: requestInjection, listPendingInjections, approveInjection (auto), applyInjection

WBS Tree (Phase 2):
- 1) Extend slice with taskInjection state and reducers
- 2) Implement injection APIs via runner/backend (PRIORITY only, immediate)
- 3) UI modal for injection with type=PRIORITY, minimal fields
- 4) Update runNextTask to respect injected head-of-queue tasks
- 5) Docs and tests


## Phase 3 — Error Solving (Add-On)

Outcome:
- Intelligent error resolution loop (bounded attempts) — but per directive, implement later
- Thunks: errorSolveOnce, errorSolveLoop (max N attempts), capture patches
- UI: ErrorSummaryCard + ErrorDetailPanel; Retry button
- Criteria: rerun VERIFY after each patch; on failure, escalate to STOP

WBS Tree (Phase 3):
- 1) Extend slice with errorResolution state
- 2) Implement error-solve endpoint contracts
- 3) UI for error details and single-click retry
- 4) Observability: artifacts and patch summaries
- 5) Docs and tests


## Dependencies & Sequencing

- A) Foundation
  - A1 Feature flag & UI gating → depends on config → [TaskList.jsx](src/components/tasks/TaskList.jsx:77)
  - A2 Redux slice scaffolding → [src/store/index.js](src/store/index.js)

- B) Services & WS
  - B1 devTeamRunnerService before thunks (init, runNextTask)
  - B2 devTeamWebSocketService before LiveExecutionMonitor

- C) Pipeline
  - C1 SELECT depends on runner task enumeration
  - C2 PREP depends on SELECT
  - C3 IMPLEMENT depends on PREP
  - C4 VERIFY depends on IMPLEMENT

- D) UI
  - D1 ExecutionHeader and LogsViewer depend on WS + slice
  - D2 StopPointControl depends on slice/thunk setStopPoint

- E) Docs/Tests after core functions are wired


## Sprint / Iteration Plan (Focused on Phase 1)

Sprint 1 (Foundation + Skeleton)
- DEVTEAM_ENABLED gating in UI
- devTeam slice scaffolding, selectors
- devTeamRunnerService skeleton, connect initExecution
- DevTeamExecutionsTab basic render in [TaskList.jsx](src/components/tasks/TaskList.jsx:77)
- Definition of Done: UI tab visible when flag enabled; initExecution updates state

Sprint 2 (Pipeline & WS)
- Implement runNextTask with SELECT→PREP→IMPLEMENT→VERIFY (STOP-ON-ERROR)
- LiveExecutionMonitor + LogsViewer wired to WS
- stopPoint in state + control wiring
- Definition of Done: Single “run next task” flow executes, logs visible, errors stop pipeline

Sprint 3 (Hardening & Tests)
- Improve VERIFY subset + error summary UI
- Pause/Resume handling
- Unit tests (slice, thunks); service tests with mocked fetch; cURL scripts
- Docs v1 for Phase 1 usage
- Definition of Done: Green tests, documented cURL flows, stable STOP-ON-ERROR behavior


## User Stories (Phase 1)

US-01 Initialize Execution (Admin)
- As an admin, I can initialize autonomous execution for a customer project from the tasks screen, so I can start the pipeline.
- Acceptance:
  - Given DEVTEAM_ENABLED, the DevTeam tab is visible in [TaskList.jsx](src/components/tasks/TaskList.jsx:77)
  - Clicking Initialize calls /prep and sets status INITIALIZING
  - Errors are shown inline and logged in LogsViewer

US-02 Run Next Task (Admin)
- As an admin, I can trigger “Run Next Task” to execute SELECT→PREP→IMPLEMENT→VERIFY for the next incomplete task.
- Acceptance:
  - On implement/verify failure, status=ERROR and STOP (no auto-advance)
  - On success, progress increases and the UI shows updated metrics
  - Logs buffer shows execution steps with timestamps

US-03 Stop Point Delegation (Admin)
- As an admin, I can set “stop after task X.X.X.X” to bound execution.
- Acceptance:
  - Stop point persisted in state; when reached, status=PAUSED
  - UI control allows clearing/changing stop point

US-04 Live Logs & Status (Admin)
- As an admin, I can see live logs and execution status updates in near real-time.
- Acceptance:
  - WS connection indicator
  - Logs capped to 1k lines, follow tail toggle
  - Status chips reflect {initializing|task-executing|error|paused|completed}


## Test Plan (Phase 1)

Strategy:
- Unit tests: devTeamSlice reducers; thunks with mocked services
- Integration: thunks calling runner service with mocked responses
- Manual/cURL verification (per rules):
  - /prep (happy path + error)
  - /implement (happy path + error)
  - /verify (happy path + failing criterion)
- UI smoke: rendering of tab, basic actions enabled/disabled states

Exit criteria:
- STOP-ON-ERROR enforced in all fail paths
- Green unit/integration tests for pipeline thunks
- cURL scripts verified against runner (assume server running)


## CI/CD & Quality Gates (Phase 1)

- Keep existing pipeline; add npm test step for new slice/thunks
- Pre-merge checks:
  - Unit/integration tests green
  - Lint passes
- No new infra; do not modify environment files (per rules)


## Risks & Mitigations

- R1 Runner/API ambiguity (URL/auth) → Mitigation: config-driven base URL, fail-fast with clear error; add cURL doc
- R2 Criteria variability in VERIFY → Mitigation: MVP subset; expand later
- R3 WS noise/perf → Mitigation: throttle/batch; cap logs
- R4 Over-engineering → Mitigation: Phase 1 minimal UI/logic; defer auto-advance and complex approvals


## Progress Tracking

- Metrics:
  - # of successful runNextTask executions
  - STOP-ON-ERROR rate correctness (no unintended progression)
  - WS uptime for session (%), max logs length adherence
- Artifacts:
  - Execution logs per customer (in-memory; persisted later)
- Status reporting:
  - StatusChip mapping per blueprint (active/error/paused/completed)


## Implementation Notes

Planned files (no abandonment of existing code):
- [src/components/tasks/TaskList.jsx](src/components/tasks/TaskList.jsx:77) — inject DevTeamExecutionsTab under feature flag
- src/components/devteam/DevTeamExecutionsTab.jsx — minimal Phase 1 UI (new)
- src/components/devteam/LogsViewer.jsx — reusable log viewer (new)
- src/store/slices/devTeamSlice.js — Redux Toolkit slice (new)
- [src/store/index.js](src/store/index.js) — register slice
- src/services/devTeamRunnerService.js — REST client (new)
- src/services/devTeamWebSocketService.js — WS client (new)

Note: Keep new files minimal, cohesive, and reusable. Avoid duplicating libs. Follow established Redux slice patterns from proposals domain.


## Open Decisions (to finalize before coding)

- Runner base URL + auth (env key name, e.g. DEVTEAM_RUNNER_BASE_URL)
- Repo URL mapping per customer (static config for MVP)
- VERIFY criterion subset and commands (document exact list)
- Feature flag defaults for dev/test/prod


## Appendices

A) Reference blueprints
- WS flow: see “Real-Time Updates and Observability” in [devTeam_design_blueprint.md](docs/DevTeam/core_docs/devTeam_design_blueprint.md:113)
- UI inventory/components: [devTeam_design_blueprint.md](docs/DevTeam/core_docs/devTeam_design_blueprint.md:33)
- IA navigation and TaskList extension: [INFORMATION_ARCHITECTURE.md](docs/DevTeam/core_docs/INFORMATION_ARCHITECTURE.md:184)

B) STOP-ON-ERROR definition
- Any non-OK from /implement or /verify causes:
  - setStatus(ERROR), appendLog(summary), no further task selection
  - UI reflects error; user can resume later (re-run)