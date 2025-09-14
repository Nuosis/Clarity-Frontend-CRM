# DevTeam UI/UX Design Blueprint — Scratchpad

Purpose: traceable analysis, decisions, risks, and coverage mapping for the “DevTeam Autonomous Execution Engine” UI/UX blueprint.

## 1) Key insights distilled from each source doc

- Information Architecture
  - [docs/DevTeam/core_docs/INFORMATION_ARCHITECTURE.md](docs/DevTeam/core_docs/INFORMATION_ARCHITECTURE.md)
  - PM-first, customer-centric grouping; progressive disclosure; essential metrics always visible; real-time via WebSockets every 5s; extends TaskList, not replaces.
- Architecture Design
  - [docs/DevTeam/core_docs/devTeam_architecture_design.md](docs/DevTeam/core_docs/devTeam_architecture_design.md)
  - Multi-customer dashboard + orchestrator; stop-point control; intelligent error resolution; explicit component sketches like [MultiCustomerDashboard()](docs/DevTeam/core_docs/devTeam_architecture_design.md:207) and [LiveExecutionMonitor()](docs/DevTeam/core_docs/devTeam_architecture_design.md:329); Redux slice examples (e.g., [selectCustomer()](docs/DevTeam/core_docs/devTeam_architecture_design.md:472), [updateExecutionState()](docs/DevTeam/core_docs/devTeam_architecture_design.md:478)).
- DevTeam Charter
  - [docs/DevTeam/core_docs/devTeam_charter.md](docs/DevTeam/core_docs/devTeam_charter.md)
  - Vision: autonomous progression with PM oversight; success metrics (≥80% autonomous, 5+ customers); roles (admin/manager/team_member/client).
- PRD
  - [docs/DevTeam/core_docs/devTeam_prd.md](docs/DevTeam/core_docs/devTeam_prd.md)
  - Functional: Multi-customer dashboard, live tracking, stop points, task injection, error-solving; NFRs for performance, security, responsive, WCAG AA.
- Navigation Schema
  - [docs/DevTeam/design/navigation_schema.md](docs/DevTeam/design/navigation_schema.md)
  - Top-level “DevTeam” with sub-areas: Dashboard, Execution Management, Task Injection Queue, Analytics, Configuration; integration inside TaskList; Redux navigation state.
- Integration Patterns
  - [docs/DevTeam/design/integration_patterns.md](docs/DevTeam/design/integration_patterns.md)
  - Feature-flagged augmentation of TaskList; DevTeam API patterns; WebSocket service; store wiring; error boundary; testing patterns.
- Content Inventory
  - [docs/DevTeam/design/content_inventory.md](docs/DevTeam/design/content_inventory.md)
  - PM essential metrics, on-demand details; error resolution content; scalability KPIs; update frequencies (5s/30s/5m).
- Scalability Framework
  - [docs/DevTeam/design/scalability_framework.md](docs/DevTeam/design/scalability_framework.md)
  - Capacity 5+ executions; essential metrics for cards; virtualization/memo patterns; normalized Redux; SLA targets.
- Task Injection Workflows
  - [docs/DevTeam/design/task_injection_workflows.md](docs/DevTeam/design/task_injection_workflows.md)
  - Priority/Replace/Positional; PM approval UI with impact assessment; rollback; monitoring and notifications.
- Error Resolution Workflows
  - [docs/DevTeam/design/error_resolution_workflows.md](docs/DevTeam/design/error_resolution_workflows.md)
  - Severity classification; intelligent retries; escalation rules; PM approval for critical; learning loop; dashboards.
- User Personas
  - [docs/DevTeam/design/user_personas.md](docs/DevTeam/design/user_personas.md)
  - PM (Sarah) needs high-level status and control; Developer (Alex) needs deep diagnostics and logs; role-based emphasis.
- Autonomous Execution Workflows
  - [docs/DevTeam/workflows/devTeam_autonomous_execution_workflows.md](docs/DevTeam/workflows/devTeam_autonomous_execution_workflows.md)
  - End-to-end loop; repository prep; DAG-based code-change workflow; hybrid error-resolution via injection; TaskList entry point.
- DevTeam Integration Patterns (workflows)
  - [docs/DevTeam/workflows/devTeam_integration_patterns.md](docs/DevTeam/workflows/devTeam_integration_patterns.md)
  - GenAI Launchpad integration; service deps (Ollama/Aider); UI control entry inside TaskList; Redux slice example wiring.
- Frontend Design Blueprint context
  - [ai_docs/context/design_blueprint.md](ai_docs/context/design_blueprint.md)
  - Current app stack, layout, Redux in proposals domain, tech debt in hooks; adhere to Redux-first and performance patterns.
- Auth guide (integration constraint)
  - [docs/FRONTEND_AUTHENTICATION_COMPREHENSIVE_GUIDE.md](docs/FRONTEND_AUTHENTICATION_COMPREHENSIVE_GUIDE.md)
  - Role-based access integration; leverage existing auth and guard patterns.

## 2) Decisions log (what/why)

- Navigation
  - Add top-level “DevTeam” with routes: /devteam (dashboard), /devteam/executions/:customerId, /devteam/approvals, /devteam/analytics, /devteam/config; rationale: mirrors [docs/DevTeam/design/navigation_schema.md](docs/DevTeam/design/navigation_schema.md).
- Information hierarchy
  - Customer-first cards with 6 essential metrics; progressive disclosure panes; rationale: aligns with IA and scalability docs.
- Component boundaries
  - Card-level components (CustomerExecutionCard), monitoring (LiveExecutionMonitor), control panels (StopPointControl, TaskInjectionModal), analytics widgets; rationale: reuse + performance; follows [MultiCustomerDashboard()](docs/DevTeam/core_docs/devTeam_architecture_design.md:207) and [LiveExecutionMonitor()](docs/DevTeam/core_docs/devTeam_architecture_design.md:329).
- State slices
  - Data slices: executions, customers, taskInjection, errors; UI slices: navigation filters, modal state; rationale: separation of concerns and normalized data as per scalability.
- Real-time model
  - WebSocket → action mapping → store updates → memoized selectors; rationale: low-latency, scalable updates (5s cadence).
- Entry integration
  - Non-disruptive TaskList extension with feature flag; rationale: keep existing workflows intact per integration patterns.
- Role-based gating
  - PM access to approvals and capacity; developer access to deep logs; shared dashboard read; rationale: personas + auth guide.

## 3) Risks, gaps, and assumptions

- Risks
  - Overlap with existing custom hooks (tech debt): ensure DevTeam uses Redux to avoid further divergence (see [ai_docs/context/design_blueprint.md](ai_docs/context/design_blueprint.md)).
  - WebSocket load at scale: mitigate with throttling/batching (scalability framework).
  - Docker/runner availability UX: clear empty and degraded states required.
- Gaps
  - No finalized backend endpoints in repo; UI must be API-contract-tolerant and feature-flagged.
  - Missing finalized Redux slice files for DevTeam; blueprint specifies boundaries and names.
- Assumptions
  - Auth roles: admin, manager (PM), team_member (developer) enforced per existing auth.
  - 5-second update is acceptable; 30-second rollups for heavier metrics.
  - TaskList remains the primary integration point ([src/components/tasks/TaskList.jsx](src/components/tasks/TaskList.jsx)).

## 4) Coverage matrix draft (workflows/personas → sections/pages/components)

- Multi-Customer Dashboard
  - Pages: /devteam (PM: full control, Dev: read)
  - Components: CustomerExecutionCard, SystemHealthBadge, ResourceUtilizationWidget, StatusChips, NotificationsBell
  - Final doc: see “Page Architecture”, “Component Library Specification”.
- Execution Management (Customer Deep-Dive)
  - Pages: /devteam/executions/:customerId
  - Components: ExecutionHeader, [LiveExecutionMonitor()](docs/DevTeam/core_docs/devTeam_architecture_design.md:329), TaskProgressGrid, LogsViewer, ArtifactsList, StopPointControl
  - Final doc: see “Workflow-Specific Interface Design”.
- Task Injection UI
  - Pages: /devteam/approvals (queue), modal from deep-dive
  - Components: TaskInjectionModal, ImpactAssessmentPanel, ApprovalQueue
  - Final doc: see “Workflow-Specific Interface Design” and “Interaction and State Patterns”.
- Error Resolution UI
  - Pages: /devteam/errors (optional), integrated in deep-dive
  - Components: ErrorSummaryCard, ErrorDetailPanel, ResolutionApproachSelector
  - Final doc: see “Workflow-Specific Interface Design” and “Real-Time Updates and Observability”.
- Performance/Resource Monitoring
  - Pages: integrated on /devteam and /devteam/analytics
  - Components: ResourceUtilizationWidget, PerformanceTrendsChart
  - Final doc: see “Responsive Design Specifications” and “Real-Time Updates and Observability”.
- Stop Point Controls
  - Pages: deep-dive
  - Components: StopPointControl, ConfirmStopDialog
  - Final doc: see “Interaction and State Patterns”.
- Logs/Artifacts
  - Pages: deep-dive, artifacts panel
  - Components: LogsViewer, ArtifactsList
  - Final doc: see “Interaction and State Patterns”.
- Approvals
  - Pages: /devteam/approvals
  - Components: ApprovalQueue, ApprovalDecisionPanel
  - Final doc: see “Page Architecture” and “Component Library Specification”.

## 5) TODOs for follow-up validation

- Confirm backend endpoints naming and payloads for:
  - Executions list/state, stop-point operations, task injection, approvals, metrics.
- Align role-based guards with current auth implementation in:
  - [docs/FRONTEND_AUTHENTICATION_COMPREHENSIVE_GUIDE.md](docs/FRONTEND_AUTHENTICATION_COMPREHENSIVE_GUIDE.md).
- Define design tokens for new status chips/badges to ensure WCAG AA.
- Validate log volume constraints and retention for LogsViewer.
- Verify feature flags and rollout plan within navigation:
  - “DEVTEAM_ENABLED”, “DEVTEAM_TASK_INJECTION”, “DEVTEAM_MULTI_CUSTOMER”.

## 6) Pointers to blueprint sections

- Final blueprint path: [docs/DevTeam/core_docs/devTeam_design_blueprint.md](docs/DevTeam/core_docs/devTeam_design_blueprint.md)
- Cross-reference anchors in final:
  - Executive Summary → section 1
  - User Role Analysis → section 2
  - Page Architecture (routes, access) → section 3
  - Component Library Specification (props/state) → section 4
  - Layout System Design → section 5
  - Workflow-Specific Interface Design → section 6
  - Responsive Design Specifications → section 7
  - Interaction and State Patterns (loading/error/empty; chips/badges) → section 8
  - Real-Time Updates and Observability (WS→Redux) → section 9
  - Accessibility and Compliance → section 10
  - Technical Implementation Notes (React/Redux/WebSocket) → section 11
  - Validation and Success Criteria → section 12
  - Appendix Coverage Matrix → section 13

## 7) Reference constructs to reuse in blueprint (grounded in sources)

- Redux thunks/actions
  - [initializeCustomerExecution()](docs/DevTeam/core_docs/devTeam_architecture_design.md:425)
  - [stopCustomerExecution()](docs/DevTeam/core_docs/devTeam_architecture_design.md:437)
  - [fetchCustomerExecutionState()](docs/DevTeam/core_docs/devTeam_architecture_design.md:449)
  - [selectCustomer()](docs/DevTeam/core_docs/devTeam_architecture_design.md:472)
  - [updateExecutionState()](docs/DevTeam/core_docs/devTeam_architecture_design.md:478)
  - [updateCustomerStatus()](docs/DevTeam/core_docs/devTeam_architecture_design.md:486)
  - [addRealTimeUpdate()](docs/DevTeam/core_docs/devTeam_architecture_design.md:494)
- Components (spec examples)
  - [MultiCustomerDashboard()](docs/DevTeam/core_docs/devTeam_architecture_design.md:207)
  - [LiveExecutionMonitor()](docs/DevTeam/core_docs/devTeam_architecture_design.md:329)
- TaskList integration entry
  - [src/components/tasks/TaskList.jsx](src/components/tasks/TaskList.jsx)
