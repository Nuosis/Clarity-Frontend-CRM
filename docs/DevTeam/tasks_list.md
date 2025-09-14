# DevTeam — Treed Tasklist (Generated from WBS)
Generated: 2025-09-14
Storage: docs/DevTeam/workflows/tasks_list.md
Notes: Each Phase/Task/Subtask lists Dependencies. Atomic actions are numeric; validation/verification/documentation are lettered.

Phase 1 — Core Execution With Stop-On-Error (MVP) (Dependencies: [src/config.js](src/config.js), [src/components/tasks/TaskList.jsx](src/components/tasks/TaskList.jsx:77), [src/store/index.js](src/store/index.js))

1.1 Feature Flag & UI Entry (Dependencies: [src/config.js](src/config.js), [src/components/tasks/TaskList.jsx](src/components/tasks/TaskList.jsx:77))
1.1.1 Add DEVTEAM_ENABLED flag to [src/config.js](src/config.js) with default false and JSDoc.
1.1.2 Export DEVTEAM_RUNNER_BASE_URL in [src/config.js](src/config.js) with placeholder value and JSDoc.
1.1.3 Gate a DevTeam tab/section in [src/components/tasks/TaskList.jsx](src/components/tasks/TaskList.jsx:77) behind DEVTEAM_ENABLED.
1.1.4 Render placeholder “DevTeamExecutionsTab” container when DEVTEAM_ENABLED is true.
1.1.5 UI integration constraints and placement within existing Tasks UI.
1.1.5.1 Integrate the DevTeam tab within the existing Tasks UI (no standalone route).
1.1.5.2 Confirm there are no global router changes introduced by the DevTeam tab.
1.1.A Validate outputs of Task 1.1
1.1.B Verify correctness of Task 1.1 against acceptance criteria
    - <criterion 1: DevTeam UI is feature-gated; tab/section renders only when DEVTEAM_ENABLED=true; hidden when false>  [source: devTeam_design_blueprint.md](docs/DevTeam/core_docs/devTeam_design_blueprint.md)
    - <criterion 2: Integration is non-disruptive to existing Tasks UI; no global router changes introduced>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
    - <criterion 3: Feature flag default is false for production builds>  [source: devTeam_wbs.md](docs/DevTeam/core_docs/devTeam_wbs.md)
    - <criterion 4: Initial render performance of the Tasks view remains within ≤2s>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
    - <criterion 5: Accessibility baseline met (WCAG 2.1 AA for new tab/controls)>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
1.1.C Document results of Task 1.1 in task_outcomes.md

1.2 Redux State & Actions (Dependencies: [src/store/index.js](src/store/index.js))
1.2.1 Create file src/store/slices/devTeamSlice.js with slice scaffold exporting reducer and actions.
1.2.2 Define initialState with customers.byId, executions.byCustomerId, logs.byCustomerId, connection, status.
1.2.3 Implement reducers.
1.2.3.1 Implement updateExecutionProgress reducer.
1.2.3.2 Implement setWebSocketConnected reducer.
1.2.3.3 Implement appendLog reducer.
1.2.3.4 Implement setStatus reducer.
1.2.3.5 Implement setStopPoint reducer.
1.2.3.6 Implement setActiveCustomer reducer.
1.2.4 Define thunks with createAsyncThunk.
1.2.4.1 Implement initExecution thunk.
1.2.4.2 Implement resumeExecution thunk.
1.2.4.3 Implement pauseExecution thunk.
1.2.4.4 Implement setStopPoint thunk.
1.2.4.5 Implement runNextTask thunk.
1.2.4.6 Implement connectWs thunk.
1.2.4.7 Implement disconnectWs thunk.
1.2.5 Register devTeam reducer in [src/store/index.js](src/store/index.js).
1.2.6 Add memoized selectors file src/store/slices/devTeamSelectors.js for UI metrics.
1.2.A Validate outputs of Task 1.2
1.2.B Verify correctness of Task 1.2 against acceptance criteria
    - <criterion 1: Redux Toolkit is used for all shared state and async operations (createAsyncThunk); no custom data-fetch hooks>  [source: devTeam_wbs.md](docs/DevTeam/core_docs/devTeam_wbs.md)
    - <criterion 2: Slice state includes customers.byId, executions.byCustomerId, logs.byCustomerId, connection, status>  [source: devTeam_wbs.md](docs/DevTeam/core_docs/devTeam_wbs.md)
    - <criterion 3: Thunks set loading/error consistently and handle rejected promises without unhandled rejections>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
    - <criterion 4: Selectors enable essential metrics derivation without redundant recomputation>  [source: devTeam_design_blueprint.md](docs/DevTeam/core_docs/devTeam_design_blueprint.md)
    - <criterion 5: Unit test coverage for reducers/selectors/thunks ≥80%>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
    - <criterion 6: Idempotent state transitions (re-running same completed step is a no-op)>  [source: devTeam_architecture_design.md](docs/DevTeam/core_docs/devTeam_architecture_design.md)
1.2.C Document results of Task 1.2 in task_outcomes.md

1.3 Services (API + WS) (Dependencies: [src/config.js](src/config.js))
1.3.1 Create file src/services/devTeamRunnerService.js and export a configured HTTP client.
1.3.2 Implement prep({repoUrl, taskId, idempotencyKey}) → POST /prep with base URL from [src/config.js](src/config.js).
1.3.3 Implement implement({taskId, branch, tool, criteria}) → POST /implement.
1.3.4 Implement verify({taskId, branch, criteria}) → POST /verify.
1.3.5 Create file src/services/devTeamWebSocketService.js exporting connect('/ws/devteam') with backoff and throttling.
1.3.5.1 Implement exponential backoff for reconnect attempts.
1.3.5.2 Implement client-side throttling/debouncing of high-frequency events.
1.3.6 Dispatch batched events to slice actions.
1.3.6.1 Map 'execution-update' events to updateExecutionProgress.
1.3.6.2 Map 'execution-log' events to appendLog.
1.3.A Validate outputs of Task 1.3
1.3.B Verify correctness of Task 1.3 against acceptance criteria
    - <criterion 1: Runner base URL is configurable via DEVTEAM_RUNNER_BASE_URL; calls respect this base>  [source: devTeam_wbs.md](docs/DevTeam/core_docs/devTeam_wbs.md)
    - <criterion 2: All runner POST calls include idempotencyKey and return idempotent results>  [source: devTeam_architecture_design.md](docs/DevTeam/core_docs/devTeam_architecture_design.md)
    - <criterion 3: WebSocket client implements exponential backoff on disconnect and recovers without UI freeze>  [source: devTeam_design_blueprint.md](docs/DevTeam/core_docs/devTeam_design_blueprint.md)
    - <criterion 4: High-frequency WS events are throttled/batched client-side to protect UI performance>  [source: devTeam_design_blueprint.md](docs/DevTeam/core_docs/devTeam_design_blueprint.md)
    - <criterion 5: Real-time updates visible in UI within ≤500ms from event receipt>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
    - <criterion 6: Logs emitted by services redact secrets and sensitive tokens>  [source: devTeam_architecture_design.md](docs/DevTeam/core_docs/devTeam_architecture_design.md)
1.3.C Document results of Task 1.3 in task_outcomes.md

1.4 SELECT Logic (Task Selection) (Dependencies: 1.3 Services)
1.4.1 In runNextTask thunk, call runner to obtain next incomplete atomic task payload.
1.4.2 Ensure dependency satisfaction is delegated to runner; handle null result gracefully.
1.4.3 Persist selected task in executions.byCustomerId[current].currentTask.
1.4.A Validate outputs of Task 1.4
1.4.B Verify correctness of Task 1.4 against acceptance criteria
    - <criterion 1: SELECT obtains the first incomplete atomic task from tasks_list.md via runner>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
    - <criterion 2: Dependency satisfaction is enforced by the runner; UI/state handle null (no task) gracefully>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
    - <criterion 3: Selected task persisted at executions.byCustomerId[current].currentTask>  [source: devTeam_wbs.md](docs/DevTeam/core_docs/devTeam_wbs.md)
    - <criterion 4: Selection is deterministic for a given repository state>  [source: devTeam_architecture_design.md](docs/DevTeam/core_docs/devTeam_architecture_design.md)
1.4.C Document results of Task 1.4 in task_outcomes.md

1.5 PREP Logic (Dependencies: 1.4 SELECT, 1.3 Services)
1.5.1 In initExecution thunk, call runner prep with repoUrl, taskId, idempotencyKey.
1.5.2 Execution state during prep.
1.5.2.1 Set status to INITIALIZING during prep.
1.5.2.2 Append prep-related logs to the customer logs buffer.
1.5.3 Compute task branch name task/<id>-<kebab-title> and store with execution.
1.5.A Validate outputs of Task 1.5
1.5.B Verify correctness of Task 1.5 against acceptance criteria
    - <criterion 1: PREP ensures local repository exists (clone or update) before proceeding>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
    - <criterion 2: Branch is created using policy task/<taskId>-<kebab-title>>  [source: devTeam_architecture_design.md](docs/DevTeam/core_docs/devTeam_architecture_design.md)
    - <criterion 3: Execution status transitions to INITIALIZING during PREP and emits logs>  [source: devTeam_wbs.md](docs/DevTeam/core_docs/devTeam_wbs.md)
    - <criterion 4: Runner healthcheck is reachable prior to PREP (GET /healthz)>  [source: devTeam_charter.md](docs/DevTeam/core_docs/devTeam_charter.md)
1.5.C Document results of Task 1.5 in task_outcomes.md

1.6 IMPLEMENT Logic (Dependencies: 1.5 PREP)
1.6.1 In runNextTask thunk, call runner implement with taskId, branch, default tool=Aider.
1.6.2 Handle implement response artifacts.
1.6.2.1 Capture diff/stdout/stderr from response.
1.6.2.2 Append implement artifacts to the logs buffer.
1.6.3 On non-OK implement, set status=ERROR and STOP (do not proceed to verify).
1.6.A Validate outputs of Task 1.6
1.6.B Verify correctness of Task 1.6 against acceptance criteria
    - <criterion 1: Default tool is Aider; minimal, file-scoped diffs are captured as artifacts>  [source: devTeam_architecture_design.md](docs/DevTeam/core_docs/devTeam_architecture_design.md)
    - <criterion 2: Implement response captures diff/stdout/stderr and appends to logs buffer>  [source: devTeam_wbs.md](docs/DevTeam/core_docs/devTeam_wbs.md)
    - <criterion 3: On non-OK implement, status=ERROR and pipeline stops (no VERIFY)>  [source: devTeam_wbs.md](docs/DevTeam/core_docs/devTeam_wbs.md)
    - <criterion 4: Logs/outputs contain no secrets or disallowed content>  [source: devTeam_architecture_design.md](docs/DevTeam/core_docs/devTeam_architecture_design.md)
1.6.C Document results of Task 1.6 in task_outcomes.md

1.7 VERIFY Logic (Dependencies: 1.6 IMPLEMENT)
1.7.1 In runNextTask thunk, call runner verify with criteria subset (test.coverage, type.strict, doc.updated).
1.7.2 On non-OK verify, set status=ERROR and STOP.
1.7.3 On verify success, persist completion and progress updates.
1.7.3.1 Mark current task complete.
1.7.3.2 Update execution progress metrics.
1.7.A Validate outputs of Task 1.7
1.7.B Verify correctness of Task 1.7 against acceptance criteria
    - <criterion 1: test.coverage meets project threshold (≥80% for touched scope)>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
    - <criterion 2: type.strict passes with 0 TypeScript errors (if applicable)>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
    - <criterion 3: doc.updated — task_outcomes.md and related docs updated for the task>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
    - <criterion 4: On verify failure, status=ERROR and pipeline stops; on success, progress metrics update>  [source: devTeam_wbs.md](docs/DevTeam/core_docs/devTeam_wbs.md)
1.7.C Document results of Task 1.7 in task_outcomes.md

1.8 STOP-ON-ERROR Semantics (Dependencies: 1.6, 1.7)
1.8.1 Ensure runNextTask early-returns on error state for customer execution.
1.8.2 Render error summary panel in DevTeamExecutionsTab showing last logs and failing step.
1.8.3 Implement resumeExecution to re-run pipeline starting from current task after manual fix.
1.8.A Validate outputs of Task 1.8
1.8.B Verify correctness of Task 1.8 against acceptance criteria
    - <criterion 1: Any implement/verify failure prevents subsequent SELECT; runNextTask early-returns>  [source: devTeam_wbs.md](docs/DevTeam/core_docs/devTeam_wbs.md)
    - <criterion 2: Error summary panel renders last logs and failing step for the customer>  [source: devTeam_wbs.md](docs/DevTeam/core_docs/devTeam_wbs.md)
    - <criterion 3: resumeExecution restarts from current task after manual fix; prior completed tasks not duplicated (idempotent)>  [source: devTeam_architecture_design.md](docs/DevTeam/core_docs/devTeam_architecture_design.md)
1.8.C Document results of Task 1.8 in task_outcomes.md

1.9 UI Components (Minimal) (Dependencies: 1.2 Slice, 1.3 WS)
1.9.1 Create file src/components/devteam/DevTeamExecutionsTab.jsx rendering status, progress, currentTask, and controls.
1.9.2 Create file src/components/devteam/LogsViewer.jsx.
1.9.2.1 Implement capped buffer (1k lines).
1.9.2.2 Implement follow tail toggle.
1.9.3 Add StopPointControl UI within DevTeamExecutionsTab to set/clear stop point.
1.9.4 Show WS connection indicator; wire to setWebSocketConnected.
1.9.A Validate outputs of Task 1.9
1.9.B Verify correctness of Task 1.9 against acceptance criteria
    - <criterion 1: DevTeamExecutionsTab shows status, progress %, currentTask, controls as specified>  [source: devTeam_design_blueprint.md](docs/DevTeam/core_docs/devTeam_design_blueprint.md)
    - <criterion 2: LogsViewer enforces 1k-line cap and supports follow-tail toggle>  [source: devTeam_wbs.md](docs/DevTeam/core_docs/devTeam_wbs.md)
    - <criterion 3: WS connection indicator reflects real connection state>  [source: devTeam_wbs.md](docs/DevTeam/core_docs/devTeam_wbs.md)
    - <criterion 4: Real-time updates render within ≤500ms from event>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
    - <criterion 5: Logs region announces updates with aria-live="polite">  [source: devTeam_design_blueprint.md](docs/DevTeam/core_docs/devTeam_design_blueprint.md)
1.9.C Document results of Task 1.9 in task_outcomes.md

1.10 Telemetry & Observability (Dependencies: 1.2 Slice)
1.10.1 Implement append-only logs buffer per customer capped to 1000 entries.
1.10.2 Implement memoized selectors for basic metrics (progress %, current status).
1.10.3 Display WS connection indicator state in UI.
1.10.A Validate outputs of Task 1.10
1.10.B Verify correctness of Task 1.10 against acceptance criteria
    - <criterion 1: Append-only logs buffer per customer capped to 1000 entries with FIFO trimming>  [source: devTeam_wbs.md](docs/DevTeam/core_docs/devTeam_wbs.md)
    - <criterion 2: Memoized selectors produce progress % and current status without excessive recomputation>  [source: devTeam_design_blueprint.md](docs/DevTeam/core_docs/devTeam_design_blueprint.md)
    - <criterion 3: WS connection indicator state is exposed to UI and accurate>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
    - <criterion 4: Logs omit secrets/PII; comply with security logging policy>  [source: devTeam_architecture_design.md](docs/DevTeam/core_docs/devTeam_architecture_design.md)
1.10.C Document results of Task 1.10 in task_outcomes.md

1.11 Documentation (Dependencies: 1.1–1.10)
1.11.1 Create docs/DevTeam/workflows/devteam_phase1.md describing feature flag and UI entry.
1.11.2 Document pipeline overview and STOP-ON-ERROR behavior.
1.11.3 Create docs/DevTeam/workflows/devteam_runner_curl.md with cURL examples for /prep, /implement, /verify.
1.11.A Validate outputs of Task 1.11
1.11.B Verify correctness of Task 1.11 against acceptance criteria
     - <criterion 1: devteam_phase1.md documents feature flag, UI entry, and STOP-ON-ERROR pipeline>  [source: devTeam_wbs.md](docs/DevTeam/core_docs/devTeam_wbs.md)
     - <criterion 2: cURL examples for /prep, /implement, /verify execute successfully (200/ok) against runner>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
     - <criterion 3: Documentation updated idempotently and linked from task_outcomes.md>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
1.11.C Document results of Task 1.11 in task_outcomes.md

Phase 2 — Task Injection (Dependencies: Phase 1 complete, [src/store/slices/devTeamSlice.js](src/store/slices/devTeamSlice.js), UI components)

2.1 Extend Slice with Task Injection (Dependencies: 1.2 Slice)
2.1.1 Add taskInjection queue state and reducers to devTeamSlice.js.
2.1.2 Implement thunks.
2.1.2.1 Implement requestInjection thunk.
2.1.2.2 Implement listPendingInjections thunk.
2.1.2.3 Implement approveInjection (auto) thunk.
2.1.2.4 Implement applyInjection thunk.
2.1.A Validate outputs of Task 2.1
2.1.B Verify correctness of Task 2.1 against acceptance criteria
     - <criterion 1: devTeamSlice includes taskInjection queue state and reducers; no regression to Phase 1 state>  [source: devTeam_wbs.md](docs/DevTeam/core_docs/devTeam_wbs.md)
     - <criterion 2: Thunks implemented with createAsyncThunk (requestInjection, listPendingInjections, approveInjection, applyInjection)>  [source: devTeam_wbs.md](docs/DevTeam/core_docs/devTeam_wbs.md)
     - <criterion 3: Unit test coverage (reducers/thunks) ≥80%; zero unhandled rejections>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
     - <criterion 4: State transitions are idempotent for duplicate requests>  [source: devTeam_architecture_design.md](docs/DevTeam/core_docs/devTeam_architecture_design.md)
2.1.C Document results of Task 2.1 in task_outcomes.md

2.2 Injection APIs (Dependencies: 1.3 Services)
2.2.1 Add runner client methods for injection endpoints (PRIORITY immediate).
2.2.2 Wire thunks to new service methods.
2.2.A Validate outputs of Task 2.2
2.2.B Verify correctness of Task 2.2 against acceptance criteria
     - <criterion 1: Runner client exposes injection endpoints; PRIORITY type available immediately>  [source: devTeam_wbs.md](docs/DevTeam/core_docs/devTeam_wbs.md)
     - <criterion 2: Requests include idempotencyKey; responses mapped to slice state consistently>  [source: devTeam_architecture_design.md](docs/DevTeam/core_docs/devTeam_architecture_design.md)
     - <criterion 3: End-to-end: requestInjection → (auto)approveInjection → applyInjection updates queue and UI>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
2.2.C Document results of Task 2.2 in task_outcomes.md

2.3 UI Modal for Injection (Dependencies: 2.1, 2.2)
2.3.1 Add TaskInjectionButton to DevTeamExecutionsTab.
2.3.2 Implement modal with type=PRIORITY and minimal fields.
2.3.A Validate outputs of Task 2.3
2.3.B Verify correctness of Task 2.3 against acceptance criteria
     - <criterion 1: TaskInjectionModal supports type=PRIORITY with minimal required fields and validation>  [source: devTeam_wbs.md](docs/DevTeam/core_docs/devTeam_wbs.md)
     - <criterion 2: Submission triggers requestInjection flow and shows confirmation/impact summary>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
     - <criterion 3: Modal is accessible (focus trap, keyboard, labels) and consistent with app styling>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
2.3.C Document results of Task 2.3 in task_outcomes.md

2.4 Update runNextTask to Respect Injected Tasks (Dependencies: 2.1)
2.4.1 Modify selection logic to check head-of-queue for injected tasks.
2.4.A Validate outputs of Task 2.4
2.4.B Verify correctness of Task 2.4 against acceptance criteria
     - <criterion 1: runNextTask checks head-of-queue for injected tasks before normal selection>  [source: devTeam_wbs.md](docs/DevTeam/core_docs/devTeam_wbs.md)
     - <criterion 2: STOP-ON-ERROR semantics preserved when executing injected tasks>  [source: devTeam_wbs.md](docs/DevTeam/core_docs/devTeam_wbs.md)
     - <criterion 3: Progress/logs correctly attribute execution to injected task>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
2.4.C Document results of Task 2.4 in task_outcomes.md

2.5 Docs and Tests (Dependencies: 2.1–2.4)
2.5.1 Update devteam_phase2.md describing injection flow.
2.5.2 Add unit tests for injection features.
2.5.2.1 Add unit tests for injection reducers.
2.5.2.2 Add unit tests for injection thunks.
2.5.A Validate outputs of Task 2.5
2.5.B Verify correctness of Task 2.5 against acceptance criteria
     - <criterion 1: devteam_phase2.md documents injection flow and approval behavior>  [source: devTeam_wbs.md](docs/DevTeam/core_docs/devTeam_wbs.md)
     - <criterion 2: Unit tests cover injection reducers and thunks with ≥80% coverage>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
     - <criterion 3: cURL (or mocked) examples validate injection endpoints>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
2.5.C Document results of Task 2.5 in task_outcomes.md

Phase 3 — Error Solving (Dependencies: Phase 2 complete)

3.1 Extend Slice with errorResolution state (Dependencies: 1.2 Slice)
3.1.1 Add errorResolution state and reducers to devTeamSlice.js.
3.1.1.1 Add errorResolution state to initialState.
3.1.1.2 Implement errorResolution reducers.
3.1.2 Implement thunks.
3.1.2.1 Implement errorSolveOnce thunk.
3.1.2.2 Implement errorSolveLoop (bounded attempts) thunk.
3.1.A Validate outputs of Task 3.1
3.1.B Verify correctness of Task 3.1 against acceptance criteria
     - <criterion 1: errorResolution state present; reducers manage active errors and history>  [source: devTeam_wbs.md](docs/DevTeam/core_docs/devTeam_wbs.md)
     - <criterion 2: errorSolveOnce and errorSolveLoop implemented with bounded attempts (≤3) and exponential backoff>  [source: devTeam_architecture_design.md](docs/DevTeam/core_docs/devTeam_architecture_design.md)
     - <criterion 3: On unresolved errors, escalation flag set for human intervention>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
3.1.C Document results of Task 3.1 in task_outcomes.md

3.2 Error-Solve Endpoint Contracts (Dependencies: 1.3 Services)
3.2.1 Add runner client methods for error-solve endpoints.
3.2.2 Capture patches/artifacts in logs buffer.
3.2.A Validate outputs of Task 3.2
3.2.B Verify correctness of Task 3.2 against acceptance criteria
     - <criterion 1: error-solve endpoints integrated; failures classified and routed to strategies>  [source: devTeam_architecture_design.md](docs/DevTeam/core_docs/devTeam_architecture_design.md)
     - <criterion 2: Patches/artifacts captured and appended to logs buffer>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
     - <criterion 3: Successful auto-resolution resumes execution; otherwise escalate>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
3.2.C Document results of Task 3.2 in task_outcomes.md

3.3 UI for Error Details and Retry (Dependencies: 3.1)
3.3.1 Add ErrorSummaryCard component to DevTeamExecutionsTab.
3.3.2 Add ErrorDetailPanel component to DevTeamExecutionsTab.
3.3.3 Add “Retry” button to trigger errorSolveOnce.
3.3.A Validate outputs of Task 3.3
3.3.B Verify correctness of Task 3.3 against acceptance criteria
     - <criterion 1: ErrorSummaryCard and ErrorDetailPanel render actionable details and statuses>  [source: devTeam_design_blueprint.md](docs/DevTeam/core_docs/devTeam_design_blueprint.md)
     - <criterion 2: “Retry” button triggers errorSolveOnce; UI reflects attempt outcomes>  [source: devTeam_wbs.md](docs/DevTeam/core_docs/devTeam_wbs.md)
     - <criterion 3: Components meet accessibility requirements (keyboard, focus, ARIA)>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
3.3.C Document results of Task 3.3 in task_outcomes.md

3.4 Observability: Artifacts and Patch Summaries (Dependencies: 3.2)
3.4.1 Persist patch summaries and artifact links in execution logs.
3.4.A Validate outputs of Task 3.4
3.4.B Verify correctness of Task 3.4 against acceptance criteria
     - <criterion 1: Patch summaries and artifact links persisted in execution logs and visible in UI>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
     - <criterion 2: Logs remain within retention caps and continue to redact secrets>  [source: devTeam_architecture_design.md](docs/DevTeam/core_docs/devTeam_architecture_design.md)
3.4.C Document results of Task 3.4 in task_outcomes.md

3.5 Docs and Tests (Dependencies: 3.1–3.4)
3.5.1 Create devteam_phase3.md documenting error solving loop and limits.
3.5.2 Add unit tests for error resolution features.
3.5.2.1 Add unit tests for errorResolution reducers.
3.5.2.2 Add unit tests for errorSolveOnce and errorSolveLoop thunks.
3.5.A Validate outputs of Task 3.5
3.5.B Verify correctness of Task 3.5 against acceptance criteria
     - <criterion 1: devteam_phase3.md documents error-solving loop, limits, and escalation paths>  [source: devTeam_wbs.md](docs/DevTeam/core_docs/devTeam_wbs.md)
     - <criterion 2: Unit tests cover errorResolution reducers and thunks with ≥80% coverage>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
     - <criterion 3: Example flows demonstrate auto-resolution success and escalation cases>  [source: devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
3.5.C Document results of Task 3.5 in task_outcomes.md

Appendix — Sequencing & Cross-Cutting Dependencies
- Foundation: 1.1 Feature flag & UI gating depends on [src/config.js](src/config.js) and [src/components/tasks/TaskList.jsx](src/components/tasks/TaskList.jsx:77).
- Redux scaffolding: register in [src/store/index.js](src/store/index.js) before UI wiring.
- Services before thunks and WS-bound components.
- Pipeline order: SELECT → PREP → IMPLEMENT → VERIFY with STOP-ON-ERROR.