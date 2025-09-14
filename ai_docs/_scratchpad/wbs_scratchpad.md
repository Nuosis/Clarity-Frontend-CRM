# DevTeam WBS Scratchpad

Scope: Implementation planning for DevTeam feature (WBS, stories, sprints, testing).

Source docs:
- [devTeam_design_blueprint.md](docs/DevTeam/core_docs/devTeam_design_blueprint.md:1)
- [devTeam_charter.md](docs/DevTeam/core_docs/devTeam_charter.md:30)
- [INFORMATION_ARCHITECTURE.md](docs/DevTeam/core_docs/INFORMATION_ARCHITECTURE.md:1)

Product stance (user directives):
- Phase 1: Code-change workflow + core task execution with stop-on-error.
- Phase 2: Task injection.
- Phase 3: Error solving.
- Single authenticated user => admin (full access); RBAC defers.

Integration constraints:
- Non-disruptive extension of [TaskList.jsx](src/components/tasks/TaskList.jsx:77) via feature flag.
- Redux-first; thunks for async; no custom data-fetch hooks.
- WebSocket for live updates (batched/throttled).

Phase 1 (MVP) focus:
- Deterministic pipeline: SELECT → PREP → IMPLEMENT → VERIFY; STOP on first failure.
- Stop-point delegation: “stop after task X.X.X.X”.
- Minimal UI: Initialize/Resume/Pause/Stop-point controls; live logs; progress.
- State: devTeam slice with executions and logs; selectors for essential metrics.
- Backend contract: /prep, /implement, /verify; assume server running.

Open decisions to confirm:
- Target repo(s) and tasks_list.md path.
- Runner base URL and auth mechanism.
- Acceptance criteria subset for VERIFY in Phase 1.
- Feature flag names and default values.

Next actions:
- Build WBS aligned to phases and constraints.
- Draft user stories with acceptance criteria.
- Sequence into sprints (Phase 1 first).
- Define testing strategy (unit/integration; cURL verification).

Notes: Keep plans consistent with existing codebase; avoid new infra that breaks current app.