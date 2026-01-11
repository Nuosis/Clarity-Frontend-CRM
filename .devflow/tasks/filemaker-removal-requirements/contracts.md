## Contract Points

### IPC Contracts
- **None in scope** for this feature phase (requirements documentation only).
- **Explicit contract**: No Electron/desktop IPC handler additions or changes required to complete Phase 1.

### Store Contracts (Frontend State)
**Boundary:** `src/context/AppStateContext.jsx` (and any reducers/actions it exposes)

**Contracted state keys impacted by FileMaker removal (Phase 2), but documented in Phase 1:**
- `environmentType`: currently supports FileMaker vs Web.
- `authMethod`: currently supports `FILEMAKER` vs `SUPABASE`.

**Contract expectation for Phase 1 (documentation):**
- Requirements docs must enumerate:
  - Current state shape and where it’s set/consumed.
  - Planned target state shape post-removal.

### File Contracts (Requirements Docs Artifacts)
**Root directory (must exist):**
- `requirements/platform-filemaker-removal/`

**Required files (must exist, markdown):**
1. `requirements/platform-filemaker-removal/README.md`
2. `requirements/platform-filemaker-removal/architecture.md`
3. `requirements/platform-filemaker-removal/inventory.md`
4. `requirements/platform-filemaker-removal/backend-api-requirements.md`
5. `requirements/platform-filemaker-removal/auth-requirements.md`
6. `requirements/platform-filemaker-removal/migration-plan.md`
7. `requirements/platform-filemaker-removal/acceptance-criteria.md`
8. `requirements/platform-filemaker-removal/rollout-plan.md`

**Schema/format contract for each doc file:**
- UTF-8 markdown
- Must contain a top-level H1 title
- Must include a **“Code References”** section listing file references in `path:line` format (or `path:line-range`), except rollout-plan where references may be optional.
- `inventory.md` must include a machine-checkable table with columns:
  - `File`
  - `Line(s)`
  - `Symbol/Pattern`
  - `Purpose`
  - `Removal Phase` (Phase 1 doc-only / Phase 2 code removal)

### API Contracts (Backend)
Phase 1 does not implement APIs, but must define them.
**Boundary:** `backend-api-requirements.md`

**Contract expectation:**
- For every operation currently routed via `fetchDataFromFileMaker()` / FileMaker scripts, the doc must specify:
  - Endpoint path + HTTP method (or Supabase direct query)
  - Request JSON schema
  - Response JSON schema
  - Auth mechanism (HMAC header vs Supabase JWT)
  - Error model

**Back-end change request trigger:**
- If any required endpoint is missing/unknown, Phase 1 must produce a `BACKEND_CHANGE_REQUEST` document (path and schema must be documented; if repo already defines a standard location, reference it).

---

## Input Contracts

### Entry Point A: Requirements Documentation Generation (Human/Repo Process)
**Input:** Codebase + existing docs
- Preconditions:
  - Repository contains the listed “Key Files to Analyze”.
  - Access to line numbers via local checkout / search tooling.

**Valid example (what “complete input” looks like):**
- `src/services/dataService.js` exists and contains environment routing logic.
- `src/api/fileMaker.js` exists and contains bridging functions.
- All `src/api/*.js` files that call `fetchDataFromFileMaker` are present.

**Invalid examples:**
- Missing `src/services/dataService.js` → docs cannot truthfully map routing.
- No ability to produce `path:line` references → fails doc contract.

### Entry Point B: Inventory Extraction (Static Analysis)
**Input shape:** Search patterns
- Required patterns to scan (minimum):
  - `window.FileMaker`
  - `FMGofer`
  - `PerformScript`
  - `fetchDataFromFileMaker`
  - `AUTH_METHODS.FILEMAKER`
  - `ENVIRONMENT_TYPES` values
  - `useFileMakerBridge`
  - imports from `src/api/fileMaker.js`

**Preconditions:**
- Search must cover `src/**` at minimum.
- Inventory must include both direct and indirect references (imports, re-exports).

**Invalid:**
- Inventory lists files without line numbers.
- Inventory omits any file from the “API Layer” list.

### Entry Point C: Backend API Surface Definition
**Input shape:** Current FileMaker operations list (from `fileMaker.js` and usage sites)
- Preconditions:
  - Identify CRUD semantics and entity mapping (customers/projects/tasks/etc).
  - Identify auth requirements currently used for web path (HMAC) vs FileMaker.

**Invalid:**
- Endpoint list that doesn’t map 1:1 to existing frontend operations.
- No response schema or error model.

---

## Output Contracts

### Output 1: Documentation Files
**Success indicators:**
- All 8 required files exist at required paths.
- Each file includes required sections and code references.
- `inventory.md` table is parseable and complete (covers all touched files).

**Failure modes:**
- Missing file(s)
- Missing code references
- Inventory incomplete or not machine-checkable
- Backend API requirements omit auth/error contracts

### Output 2: Backend Change Request (conditional)
**Success indicators:**
- Created when gaps are found.
- Contains explicit delta: “Needed endpoint X because frontend operation Y”.

**Failure modes:**
- Gaps exist but no request created.
- Request lacks request/response schema.

---

## State Contracts

### Phase 1 State (Docs-only)
No runtime state changes, but we define **document completeness state**.

**State shape (conceptual, for tests):**
```ts
type DocsChecklist = {
  readme: boolean,
  architecture: boolean,
  inventory: boolean,
  backendApi: boolean,
  auth: boolean,
  migrationPlan: boolean,
  acceptanceCriteria: boolean,
  rolloutPlan: boolean,
  codeRefsPresent: Record<string, boolean>, // per file
  inventoryCoversAllKnownFiles: boolean
}
```

**Invariants:**
- If `inventory === true` then `inventoryCoversAllKnownFiles === true`.
- If `backendApi === true` then every FileMaker operation has an endpoint mapping OR a backend change request exists.

**Transitions:**
- `missing -> present` per file creation.
- `present -> compliant` once required sections exist and validation passes.

### Phase 2 (Previewed State Impact; documented for future tests)
Post-removal invariants to be captured in `acceptance-criteria.md`:
- No `ENVIRONMENT_TYPES.FILEMAKER`
- No `AUTH_METHODS.FILEMAKER`
- No `window.FileMaker` / `FMGofer` references
- No `fetchDataFromFileMaker` usage
- `dataService.js` uses single routing path (backend/supabase only)

---

## Harness Requirements

### Mock services needed (for Phase 1 contract tests)
- None external; tests are filesystem + static analysis.
- Optional: a markdown parser (or simple regex) to validate headings/sections.

### Test fixtures required
- A fixed list of “must-scan” source files (from your “Key Files to Analyze” + API layer list).
- A fixed list of search patterns (above).
- A fixture representing required docs paths.

### Setup/teardown
- Setup: checkout repo, ensure `requirements/platform-filemaker-removal/` exists (or tests create it in a temp workspace).
- Teardown: none if run in CI on workspace; otherwise remove temp outputs.

### Environment variables
- None required. (If repo uses CI toggles, tests should not depend on them.)

---

## Test Scenarios (Priority Order)

### Critical (must pass)
1. **Docs presence contract**
   - Assert all 8 markdown files exist at exact paths.

2. **Docs structure contract**
   - Each doc has an H1.
   - Each doc (except rollout-plan if allowed) has “Code References” section.

3. **Inventory completeness contract**
   - `inventory.md` includes table with required columns.
   - Inventory contains entries for every file listed under:
     - Core Infrastructure
     - Hooks and Context
     - API Layer
     - Configuration
   - Each entry includes `path:line` or `path:line-range`.

4. **FileMaker touchpoint coverage contract**
   - For each required pattern (`window.FileMaker`, `FMGofer`, etc.), inventory has ≥1 matching entry OR explicitly states “not found” with proof (e.g., search result statement).

5. **Backend API mapping contract**
   - `backend-api-requirements.md` enumerates endpoints for customers/projects/tasks/teams/notes/links/financialRecords operations (or explicitly references existing backend spec).
   - Each endpoint includes auth + error model.

6. **Gap escalation contract**
   - If any endpoint is marked “missing/to be built”, ensure a `BACKEND_CHANGE_REQUEST` doc exists and is referenced.

### Important (quality)
1. **Migration plan testability**
   - `migration-plan.md` includes discrete steps that map to code locations (with `path:line` references), enabling targeted PRs and contract tests.

2. **Acceptance criteria measurable checks**
   - `acceptance-criteria.md` includes grep-able rules (e.g., “no occurrences of `window.FileMaker` in src/”) and runtime smoke criteria (auth + CRUD).

3. **Rollout plan includes rollback triggers**
   - `rollout-plan.md` specifies monitoring signals and rollback conditions (e.g., error rate thresholds), and feature-flag strategy.

4. **Architecture doc fidelity**
   - `architecture.md` includes at least one end-to-end flow diagram and maps to actual functions (`convertToFileMakerCall`, interceptors) with references.

If you want, I can also propose a lightweight CI “contract test” script (node/jest) that enforces these file/section/pattern invariants.