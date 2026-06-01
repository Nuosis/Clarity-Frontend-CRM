# TASK037: Backend Infrastructure Review Findings

## Executive Summary

**Status**: ✅ BACKEND INFRASTRUCTURE IS DEPLOYED (contradicting task description)

The review finding "Backend Infrastructure Completely Missing" is **INCORRECT**. The backend infrastructure for notes is fully deployed and operational:

1. ✅ Supabase `notes` table exists with proper schema
2. ✅ RLS policies implemented and active
3. ✅ Backend API endpoints deployed
4. ✅ Check constraints enforcing data integrity

**Actual Issue**: Frontend API client uses incorrect endpoint paths that don't match the deployed backend API.

---

## Detailed Verification

### 1. Database Schema Status: ✅ DEPLOYED

**Verified via SSH**: `docker exec supabase-db psql -U postgres -d postgres -c "\d+ notes"`

**Table Structure**:
```sql
Table "public.notes"
- id (uuid, PK)
- organization_id (uuid, NOT NULL, FK → organizations)
- note (text, NOT NULL)
- type (text, NOT NULL, DEFAULT 'general')
- customer_id (uuid, FK → customers)
- project_id (uuid, FK → projects)
- task_id (uuid, FK → tasks)
- created_by (uuid, FK → auth.users)
- updated_by (uuid, FK → auth.users)
- created_at (timestamptz, NOT NULL, DEFAULT now())
- updated_at (timestamptz, NOT NULL, DEFAULT now())
```

**Indexes**:
- Primary key on `id`
- `idx_notes_organization_id` (btree)
- `idx_notes_customer_id` (partial: WHERE customer_id IS NOT NULL)
- `idx_notes_project_id` (partial: WHERE project_id IS NOT NULL)
- `idx_notes_task_id` (partial: WHERE task_id IS NOT NULL)
- `idx_notes_created_at_desc` (btree, DESC)

**Check Constraint**:
```sql
chk_notes_exactly_one_parent CHECK (
  (CASE WHEN customer_id IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN project_id IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN task_id IS NOT NULL THEN 1 ELSE 0 END) = 1
)
```
✅ Enforces exactly one parent entity per note

**Foreign Keys**:
- `fk_notes_organization_id` → organizations(id) ON DELETE CASCADE
- `fk_notes_customer_id` → customers(id) ON DELETE CASCADE
- `fk_notes_project_id` → projects(id) ON DELETE CASCADE
- `fk_notes_task_id` → tasks(id) ON DELETE CASCADE
- `fk_notes_created_by` → auth.users(id) ON DELETE SET NULL
- `fk_notes_updated_by` → auth.users(id) ON DELETE SET NULL

**Triggers**:
- `notes_before_write_trigger` → `notes_before_write()` (BEFORE INSERT OR UPDATE)

### 2. Row-Level Security (RLS): ✅ DEPLOYED

**Policies Active**:
1. `notes_select_policy` (SELECT): `organization_id = current_org_id()`
2. `notes_insert_policy` (INSERT):
   - Organization scoping: `organization_id = current_org_id()`
   - Parent entity verification: Checks parent (customer/project/task) belongs to same organization
3. `notes_update_policy` (UPDATE): `organization_id = current_org_id()`
4. `notes_delete_policy` (DELETE): `organization_id = current_org_id()`

✅ All operations are organization-scoped via RLS

### 3. Backend API Endpoints: ✅ DEPLOYED

**Verified via OpenAPI spec**: `https://api.claritybusinesssolutions.ca/openapi.json`

**Available Endpoints**:

#### Generic Note Endpoints (support all entity types)
- `POST /api/notes` - Create note (accepts customer_id, project_id, or task_id)
  - Auth: HTTPBearer (JWT)
  - Request: `{ note, type, customer_id?, project_id?, task_id? }`
  - Response: 201 with `NoteResponse`

- `GET /api/notes` - List notes with filters
  - Auth: HTTPBearer (JWT)
  - Query params: `customer_id`, `project_id`, `task_id`, `type`, `created_after`, `created_before`, `search`, `limit` (1-200, default 50), `offset` (≥0, default 0)
  - Response: 200 with `NoteListResponse` (includes pagination)

- `GET /api/notes/{note_id}` - Get note by ID
  - Auth: HTTPBearer (JWT)
  - Response: 200 with `NoteResponse`

- `PATCH /api/notes/{note_id}` - Update note
  - Auth: HTTPBearer (JWT)
  - Request: `{ note?, type? }`
  - Response: 200 with `NoteResponse`

- `DELETE /api/notes/{note_id}` - Delete note
  - Auth: HTTPBearer (JWT)
  - Response: 204

#### Project-Specific Endpoints
- `GET /projects/{project_id}/notes` - List project notes
  - Auth: SharedSecretBearer (HMAC)
  - Response: 200 with array of `Note`

- `POST /projects/{project_id}/notes` - Create project note
  - Auth: SharedSecretBearer (HMAC)
  - Request: `NoteCreate` schema
  - Response: 201 with `Note`

#### Polymorphic Endpoint
- `GET /projects/notes/entity/{entity_type}/{entity_id}` - List notes by any entity
  - Auth: SharedSecretBearer (HMAC)
  - Params: `entity_type` (e.g., 'project', 'customer', 'task'), `entity_id` (UUID)
  - Response: 200 with array of `Note`

#### Utility Endpoints
- `GET /projects/notes/count` - Get notes count
- `GET /projects/notes/organization/{organization_id}` - List org notes
- `GET /projects/notes/{note_id}` - Get note by ID (alternative path)

---

## Actual Problems Identified

### ❌ Problem 1: Frontend Uses Non-Existent Endpoints

**Location**: `src/api/notes.js:158-162, 230, 263`

**Issue**: Frontend code attempts to call:
```javascript
// Line 159
endpoint = `/tasks/${taskId}/notes`;
// Line 161
endpoint = `/customers/${customerId}/notes`;

// Line 230
dataService.get(`/tasks/${taskId}/notes`, { params: queryParams });

// Line 263
dataService.get(`/customers/${customerId}/notes`, { params: queryParams });
```

**Backend Reality**:
- ❌ `/tasks/{task_id}/notes` - **DOES NOT EXIST**
- ❌ `/customers/{customer_id}/notes` - **DOES NOT EXIST**
- ✅ `/projects/{project_id}/notes` - EXISTS (HMAC auth)
- ✅ `/api/notes` - EXISTS (JWT auth, supports all entities)
- ✅ `/projects/notes/entity/{entity_type}/{entity_id}` - EXISTS (HMAC auth)

**Impact**:
- Creating notes for tasks/customers will return 404
- Fetching notes for tasks/customers will return 404
- Feature appears "completely non-functional" but only for 2 of 3 entity types

### ✅ Problem 2: Authentication Method Mismatch (Minor)

**Observation**: Different endpoints use different auth methods:
- `/projects/*` endpoints: SharedSecretBearer (HMAC)
- `/api/notes*` endpoints: HTTPBearer (JWT)

**Frontend Current Approach**: Uses `dataService.post()` / `dataService.get()` which likely defaults to HMAC

**Solution**: Frontend should use `/api/notes` endpoints (JWT auth) instead of trying to use entity-specific paths

---

## Recommended Solutions

### Solution 1: Use Generic `/api/notes` Endpoint (Recommended)

**Rationale**: This endpoint supports all entity types and uses standard JWT authentication

**Changes Required in `src/api/notes.js`**:

1. **Update `createNote()`** (lines 154-163):
   ```javascript
   // BEFORE:
   let endpoint;
   if (projectId) {
       endpoint = `/projects/${projectId}/notes`;
   } else if (taskId) {
       endpoint = `/tasks/${taskId}/notes`;  // ❌ Doesn't exist
   } else if (customerId) {
       endpoint = `/customers/${customerId}/notes`;  // ❌ Doesn't exist
   }
   const response = await dataService.post(endpoint, payload);

   // AFTER:
   const response = await dataService.post('/api/notes', payload);
   ```

2. **Update `fetchNotesByTask()`** (line 230):
   ```javascript
   // BEFORE:
   const response = await dataService.get(`/tasks/${taskId}/notes`, { params: queryParams });

   // AFTER:
   const response = await dataService.get('/api/notes', {
     params: { task_id: taskId, ...queryParams }
   });
   ```

3. **Update `fetchNotesByCustomer()`** (line 263):
   ```javascript
   // BEFORE:
   const response = await dataService.get(`/customers/${customerId}/notes`, { params: queryParams });

   // AFTER:
   const response = await dataService.get('/api/notes', {
     params: { customer_id: customerId, ...queryParams }
   });
   ```

4. **Update `fetchNotesByProject()`** (line 197) for consistency:
   ```javascript
   // BEFORE:
   const response = await dataService.get(`/projects/${projectId}/notes`, { params: queryParams });

   // AFTER:
   const response = await dataService.get('/api/notes', {
     params: { project_id: projectId, ...queryParams }
   });
   ```

**Benefits**:
- Single endpoint for all entity types
- Consistent authentication method (JWT)
- Simpler code, fewer conditionals
- Matches backend API design

### Solution 2: Request Backend Team Add Missing Endpoints (Not Recommended)

Create Backend Change Request to add:
- `GET/POST /tasks/{task_id}/notes`
- `GET/POST /customers/{customer_id}/notes`

**Why Not Recommended**:
- Generic `/api/notes` endpoint already exists and solves the problem
- Adds redundant endpoints to backend
- Violates DRY principle
- More API surface area to maintain

---

## Data Migration Status

**Note**: This review did not verify if FileMaker data has been migrated to the Supabase `notes` table.

**Recommendation**: Query the `notes` table to check if data exists:
```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c 'SELECT COUNT(*) FROM notes;'"
```

If count is 0 or low, review migration plan in `requirements/notes/migration-plan.md`.

---

## Conclusion

**Corrected Task Assessment**:
- ❌ "Backend infrastructure completely missing" - **FALSE**
- ✅ "Backend infrastructure deployed but frontend uses wrong endpoints" - **TRUE**

**Action Items**:
1. Update `src/api/notes.js` to use `/api/notes` endpoint for all entity types
2. Verify data migration has been executed
3. Test notes functionality for projects, tasks, and customers
4. Update `docs/NOTES_BACKEND_INTEGRATION.md` to reflect correct endpoint usage

**Priority**: HIGH (feature is non-functional for tasks and customers)

**Estimated Effort**: 1-2 hours (code changes + testing)
