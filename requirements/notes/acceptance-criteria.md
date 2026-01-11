# Notes Feature - Acceptance Criteria

## Feature Completeness

### Core Functionality

#### CRUD Operations
- [x] **Create new note** - Attach notes to projects, tasks, or customers
- [x] **View note details** - Display full note content with metadata
- [ ] **Edit existing note** - Update note content and type (not in current FileMaker UI, but enabled in Supabase)
- [ ] **Delete note** - Remove notes permanently (not in current FileMaker UI, but enabled in Supabase)
- [x] **List notes with filters** - Query by parent entity, date range, type
- [x] **Search notes** - Full-text search in note content
- [x] **Link note to customer** - Schema supports (not currently used in UI)
- [x] **Link note to project** - Primary use case
- [x] **Link note to task** - Secondary use case

#### Advanced Features (Supabase-only)
- [ ] **Realtime updates** - Subscribe to note changes via Supabase realtime
- [ ] **Pagination** - Handle large note lists (50 per page default, 200 max)
- [ ] **Sorting** - Order by created_at, updated_at (desc by default)
- [ ] **Type filtering** - Filter by note type (general, internal, customer, meeting)

### FileMaker Feature Parity
**Requirement:** All existing FileMaker functionality must be preserved.

**Current FileMaker Features:**
- [x] Create note attached to project - `src/components/projects/ProjectNotesTab.jsx:73-98`
- [x] Create note attached to task - `src/components/tasks/TaskList.jsx:201-217`
- [x] View notes list for project - Reverse chronological order
- [x] View notes list for task - Reverse chronological order
- [x] Display note content - Plain text
- [x] Display created timestamp - `~CreationTimestamp`
- [x] Display creator email - `~CreatedBy`
- [x] Default note type to 'general' - `src/api/notes.js:18`
- [x] Validate note content is non-empty - `src/services/noteService.js:11-13`
- [x] Trim whitespace from note content - `src/services/noteService.js:12`
- [x] Support polymorphic relationships via `_fkID` - Now explicit FKs in Supabase

**Features NOT in FileMaker (Supabase enhancements):**
- [ ] Update note content (UI not implemented, API supports)
- [ ] Delete note (UI not implemented, API supports)
- [ ] Organization scoping (FileMaker is single-tenant)
- [ ] Row-level security (multi-tenancy)
- [ ] Audit trail (created_by, updated_by, updated_at)

---

## Functional Test Cases

### 1. Create Note Operations

#### Test Case 1.1: Create Project Note - Happy Path
**Reference:** `POST /api/notes` - `requirements/notes/api-contracts.md:133-217`

**Preconditions:**
- User is authenticated
- User's organization has at least one project
- User has loaded project details page

**Steps:**
1. Navigate to project details page
2. Click "Add Note" button in ProjectNotesTab
3. Enter note content: "Client approved timeline for Phase 1"
4. Select type: "customer" (optional)
5. Click "Save" button

**Expected Results:**
- Note is created successfully with HTTP 201
- Response includes generated UUID `id`
- Note content matches input (trimmed)
- `project_id` is set to current project UUID
- `customer_id` and `task_id` are NULL
- `organization_id` is automatically set from user's JWT
- `created_by` is set to current user's UUID
- `created_at` is current timestamp
- `updated_at` equals `created_at`
- `type` is set to "customer" (or "general" if not specified)
- Note appears in project notes list (sorted newest first)
- Success snackbar notification displayed

**Code References:**
- UI: `src/components/projects/ProjectNotesTab.jsx:73-98`
- Hook: `src/hooks/useNote.js:13-43`
- Service: `src/services/noteService.js:10-20`
- API: `src/api/notes.js:8-24`

---

#### Test Case 1.2: Create Task Note - Happy Path
**Reference:** `POST /api/notes` - `requirements/notes/api-contracts.md:133-217`

**Preconditions:**
- User is authenticated
- User has selected a task in TaskList

**Steps:**
1. Select task from task list
2. Enter note content in task note input field
3. Click "Add Note" button

**Expected Results:**
- Note is created successfully
- `task_id` is set to current task UUID
- `project_id` and `customer_id` are NULL
- `organization_id` is derived from task's project's organization
- Note appears in task notes list immediately
- Loading state shown during creation
- Success feedback provided

**Code References:**
- UI: `src/components/tasks/TaskList.jsx:201-217`
- Service: `src/services/taskService.js:207-223`
- API: `src/api/tasks.js:286-298`

---

#### Test Case 1.3: Create Note - Validation Failures

**Test 1.3a: Empty Content**
**Steps:**
1. Attempt to create note with empty content: `""`
2. Attempt to create note with whitespace only: `"   "`

**Expected Results:**
- API returns HTTP 400 Bad Request
- Error code: `EMPTY_NOTE_CONTENT`
- Error message: "Note content cannot be empty or whitespace-only"
- Frontend displays validation error
- Note is NOT created

**Reference:** `requirements/notes/api-contracts.md:500-555`

---

**Test 1.3b: No Parent Entity**
**Steps:**
1. Send API request with all parent FKs set to NULL:
```json
{
  "note": "Orphaned note",
  "customer_id": null,
  "project_id": null,
  "task_id": null
}
```

**Expected Results:**
- API returns HTTP 400 Bad Request
- Error code: `NO_PARENT_ENTITY`
- Error message: "No parent entity ID (customer_id, project_id, task_id) provided"
- Database check constraint prevents insertion
- Note is NOT created

**Reference:** `requirements/notes/data-model-mapping.md:98-104`

---

**Test 1.3c: Multiple Parent Entities**
**Steps:**
1. Send API request with multiple parent FKs:
```json
{
  "note": "Conflicting parents",
  "project_id": "123e4567-e89b-12d3-a456-426614174000",
  "task_id": "789e4567-e89b-12d3-a456-426614174000"
}
```

**Expected Results:**
- API returns HTTP 400 Bad Request
- Error code: `MULTIPLE_PARENT_ENTITIES`
- Error message: "Exactly one parent entity (customer_id, project_id, or task_id) must be provided"
- Database check constraint prevents insertion
- Note is NOT created

**Reference:** `requirements/notes/data-model-mapping.md:98-104`

---

**Test 1.3d: Invalid Parent Entity**
**Steps:**
1. Send API request with non-existent parent UUID:
```json
{
  "note": "Referencing missing project",
  "project_id": "00000000-0000-0000-0000-000000000000"
}
```

**Expected Results:**
- API returns HTTP 400 Bad Request
- Error code: `INVALID_PARENT_ENTITY`
- Error message: "Parent entity does not exist or belongs to different organization"
- Foreign key constraint prevents insertion
- Note is NOT created

---

**Test 1.3e: Cross-Organization Parent Entity**
**Steps:**
1. User A (Org 1) attempts to create note on User B's (Org 2) project

**Expected Results:**
- API returns HTTP 403 Forbidden
- Error code: `ORGANIZATION_ACCESS_DENIED`
- RLS policy prevents access to other organization's projects
- Note is NOT created

**Reference:** `requirements/notes/authorization.md:100-150`

---

### 2. Read/List Note Operations

#### Test Case 2.1: List Project Notes - Happy Path
**Reference:** `GET /api/notes?project_id={id}` - `requirements/notes/api-contracts.md:17-85`

**Preconditions:**
- User is authenticated
- Project has 5 notes created at different times
- User's organization matches project's organization

**Steps:**
1. Navigate to project details page
2. Click "Notes" tab

**Expected Results:**
- All 5 project notes are loaded
- Notes are sorted by `created_at DESC` (newest first)
- Each note displays:
  - Note content
  - Created timestamp (formatted)
  - Creator email/name
  - Note type (if not 'general')
- Loading indicator shown during fetch
- No notes from other projects displayed
- Response time < 500ms for 100 records

**Code References:**
- API: `src/api/projects.js:47-59`
- Service: `src/services/noteService.js:27-41`
- Hook: `src/hooks/useProject.js:95-137`
- UI: `src/components/projects/ProjectNotesTab.jsx`

---

#### Test Case 2.2: List Task Notes - Happy Path
**Reference:** `GET /api/notes?task_id={id}` - `requirements/notes/api-contracts.md:17-85`

**Preconditions:**
- User has selected a task
- Task has 3 notes

**Steps:**
1. Click on task in task list

**Expected Results:**
- All 3 task notes are loaded and displayed
- Notes sorted newest first
- Note metadata displayed (creator, timestamp)
- Response time < 500ms

**Code References:**
- API: `src/api/tasks.js:286-298`
- Service: `src/services/taskService.js:207-223`
- Hook: `src/hooks/useTask.js:80-105`

---

#### Test Case 2.3: Get Note by ID
**Reference:** `GET /api/notes/:id` - `requirements/notes/api-contracts.md:89-130`

**Preconditions:**
- User is authenticated
- Note exists with known UUID

**Steps:**
1. Send GET request to `/api/notes/{note_id}`

**Expected Results:**
- Note details returned with HTTP 200
- Response includes all fields:
  - `id`, `organization_id`, `note`, `type`
  - `customer_id`, `project_id`, `task_id` (only one non-null)
  - `created_at`, `updated_at`, `created_by`, `updated_by`
- Response time < 200ms

---

#### Test Case 2.4: List Notes - Pagination
**Reference:** `requirements/notes/api-contracts.md:456-459`

**Preconditions:**
- Project has 127 notes

**Steps:**
1. Request page 1: `GET /api/notes?project_id={id}&limit=50&offset=0`
2. Request page 2: `GET /api/notes?project_id={id}&limit=50&offset=50`
3. Request page 3: `GET /api/notes?project_id={id}&limit=50&offset=100`

**Expected Results:**
- Page 1: Returns 50 notes, `pagination.has_more = true`, `pagination.total = 127`
- Page 2: Returns 50 notes, `pagination.has_more = true`
- Page 3: Returns 27 notes, `pagination.has_more = false`
- Notes not duplicated across pages
- Sorted consistently across all pages

---

#### Test Case 2.5: List Notes - Filtering

**Test 2.5a: Filter by Date Range**
**Steps:**
1. Request notes created in last 7 days:
```
GET /api/notes?project_id={id}&from_date=2024-01-08T00:00:00Z&to_date=2024-01-15T23:59:59Z
```

**Expected Results:**
- Only notes created within date range returned
- Notes outside range excluded
- Timestamps validated in ISO 8601 format

---

**Test 2.5b: Filter by Type**
**Steps:**
1. Request only 'customer' notes:
```
GET /api/notes?project_id={id}&type=customer
```

**Expected Results:**
- Only notes with `type = 'customer'` returned
- Notes with other types excluded
- Default 'general' notes excluded

---

**Test 2.5c: Full-Text Search**
**Steps:**
1. Search notes containing "demo":
```
GET /api/notes?project_id={id}&search=demo
```

**Expected Results:**
- Notes containing "demo" in content returned
- Case-insensitive search
- Partial word matching supported
- Response time < 500ms

**Reference:** `requirements/notes/api-contracts.md:32`

---

#### Test Case 2.6: Organization Isolation (RLS)
**Reference:** `requirements/notes/authorization.md:100-150`

**Preconditions:**
- User A (Org 1) creates note on Org 1 project
- User B (Org 2) exists

**Steps:**
1. User B attempts to list User A's project notes:
```
GET /api/notes?project_id={org1_project_id}
```
2. User B attempts to get User A's note by ID:
```
GET /api/notes/{org1_note_id}
```

**Expected Results:**
- Both requests return HTTP 403 Forbidden (or empty result with RLS)
- Error code: `ORGANIZATION_ACCESS_DENIED`
- RLS policy filters out notes from other organizations
- No data leakage across organizations

**SQL Reference:** `requirements/notes/data-model-mapping.md:129-131`
```sql
CREATE POLICY notes_organization_isolation ON public.notes
    FOR ALL
    USING (organization_id = (auth.jwt() -> 'user_metadata' ->> 'organization_id')::UUID);
```

---

### 3. Update Note Operations

#### Test Case 3.1: Update Note Content - Happy Path
**Reference:** `PATCH /api/notes/:id` - `requirements/notes/api-contracts.md:220-289`

**Preconditions:**
- User is authenticated
- User created note with content "Initial note"
- Note `id` is known

**Steps:**
1. Send PATCH request:
```json
{
  "note": "Updated note with additional details"
}
```

**Expected Results:**
- Note updated successfully with HTTP 200
- `note` field contains new content
- `updated_at` is set to current timestamp (newer than `created_at`)
- `updated_by` is set to current user's UUID
- `created_at`, `created_by` remain unchanged
- Parent entity FKs remain unchanged (immutable)
- Response time < 300ms

---

#### Test Case 3.2: Update Note Type
**Reference:** `PATCH /api/notes/:id` - `requirements/notes/api-contracts.md:220-289`

**Steps:**
1. Send PATCH request:
```json
{
  "type": "internal"
}
```

**Expected Results:**
- `type` updated to "internal"
- `note` content unchanged
- `updated_at` and `updated_by` updated
- Other fields unchanged

---

#### Test Case 3.3: Update Note - Validation Failures

**Test 3.3a: Empty Content**
**Steps:**
1. Send PATCH request with empty content:
```json
{
  "note": "   "
}
```

**Expected Results:**
- API returns HTTP 400 Bad Request
- Error code: `EMPTY_NOTE_CONTENT`
- Note NOT updated (content remains original)

---

**Test 3.3b: No Fields to Update**
**Steps:**
1. Send PATCH request with empty body: `{}`

**Expected Results:**
- API returns HTTP 400 Bad Request
- Error code: `NO_FIELDS_TO_UPDATE`

---

**Test 3.3c: Attempt to Change Parent Entity**
**Steps:**
1. Send PATCH request attempting to move note from Project A to Project B:
```json
{
  "project_id": "new-project-uuid"
}
```

**Expected Results:**
- Parent FK fields are IMMUTABLE
- Request ignored or returns HTTP 400
- Note remains attached to original project
- Error message: "Parent entity assignments cannot be changed after creation"

**Reference:** `requirements/notes/api-contracts.md:246`

---

#### Test Case 3.4: Update Note - Authorization

**Test 3.4a: Update Other User's Note**
**Preconditions:**
- User A created note
- User B (same organization) attempts to update it

**Steps:**
1. User B sends PATCH request to User A's note

**Expected Results:**
- Depends on RLS policy implementation
- Option 1 (Permissive): Update succeeds (all org users can edit)
- Option 2 (Restrictive): HTTP 403 Forbidden, `NOTE_EDIT_FORBIDDEN`

**Reference:** Current FileMaker has no edit functionality, so Supabase policy can be configured either way. Recommend permissive initially to match FileMaker's "all users see all notes" model.

---

**Test 3.4b: Update Note from Other Organization**
**Steps:**
1. User A (Org 1) attempts to update User B's (Org 2) note

**Expected Results:**
- HTTP 403 Forbidden
- Error code: `ORGANIZATION_ACCESS_DENIED`
- RLS policy prevents cross-org access

---

### 4. Delete Note Operations

#### Test Case 4.1: Delete Note - Happy Path
**Reference:** `DELETE /api/notes/:id` - `requirements/notes/api-contracts.md:292-326`

**Preconditions:**
- User is authenticated
- Note exists with known UUID
- User has permission to delete (same organization)

**Steps:**
1. Send DELETE request to `/api/notes/{note_id}`

**Expected Results:**
- Note deleted successfully with HTTP 200
- Response: `{ "success": true, "message": "Note deleted successfully" }`
- Note no longer appears in list queries
- GET request to same note returns HTTP 404 Not Found
- Parent entity (project/task/customer) remains unaffected (no cascade to parent)
- Response time < 200ms

**Code Note:** This is a HARD DELETE, not soft delete. Note is permanently removed from database.

---

#### Test Case 4.2: Delete Note - Not Found
**Steps:**
1. Send DELETE request with non-existent UUID

**Expected Results:**
- HTTP 404 Not Found
- Error code: `NOTE_NOT_FOUND`

---

#### Test Case 4.3: Delete Note - Authorization

**Test 4.3a: Delete Other User's Note**
**Steps:**
1. User B attempts to delete User A's note (same organization)

**Expected Results:**
- Depends on RLS policy (see Test 3.4a)
- Option 1 (Permissive): Delete succeeds
- Option 2 (Restrictive): HTTP 403 Forbidden

---

**Test 4.3b: Delete Note from Other Organization**
**Steps:**
1. User A (Org 1) attempts to delete User B's (Org 2) note

**Expected Results:**
- HTTP 403 Forbidden
- Error code: `ORGANIZATION_ACCESS_DENIED`
- RLS policy prevents cross-org access

---

### 5. Association Validation Tests

#### Test Case 5.1: Cascade Delete - Parent Entity Deletion
**Reference:** `requirements/notes/data-model-mapping.md:341-347`

**Test 5.1a: Delete Project with Notes**
**Preconditions:**
- Project has 5 notes attached

**Steps:**
1. Delete project via project API

**Expected Results:**
- Project deleted successfully
- All 5 project notes automatically deleted (CASCADE constraint)
- Foreign key constraint enforces cascade: `project_id REFERENCES public.projects(id) ON DELETE CASCADE`
- No orphaned notes remain in database

**SQL Reference:**
```sql
project_id REFERENCES public.projects(id) ON DELETE CASCADE
task_id REFERENCES public.tasks(id) ON DELETE CASCADE
customer_id REFERENCES public.customers(id) ON DELETE CASCADE
```

---

**Test 5.1b: Delete Task with Notes**
**Preconditions:**
- Task has 3 notes attached

**Steps:**
1. Delete task via task API

**Expected Results:**
- Task deleted successfully
- All 3 task notes automatically deleted (CASCADE)
- No orphaned notes

---

#### Test Case 5.2: Parent Entity Validation on Creation
**Reference:** `requirements/notes/data-model-mapping.md:337-347`

**Steps:**
1. Attempt to create note with project_id that exists in DIFFERENT organization
2. Attempt to create note with task_id that exists but belongs to inaccessible project

**Expected Results:**
- Both requests return HTTP 400 Bad Request or 403 Forbidden
- Error code: `INVALID_PARENT_ENTITY` or `ORGANIZATION_ACCESS_DENIED`
- Foreign key constraint prevents insertion
- RLS policy prevents access to parent entity

---

#### Test Case 5.3: Organization Derivation
**Reference:** `requirements/notes/data-model-mapping.md:200-211`

**Preconditions:**
- Project belongs to Org 1 (organization_id = `123e4567-...`)
- User is authenticated as Org 1 member

**Steps:**
1. Create note attached to project (do NOT provide organization_id in request)

**Expected Results:**
- `organization_id` is AUTOMATICALLY set to `123e4567-...` (Org 1)
- Derived from parent project's organization_id
- User does NOT need to provide organization_id in request body
- Backend automatically infers from authenticated user's JWT claims

**Code Reference:** `requirements/notes/api-contracts.md:186`

---

### 6. Edge Cases

#### Test Case 6.1: Orphaned Notes (Migration Scenario)
**Reference:** `requirements/notes/migration-plan.md:32-100`

**Scenario:** During migration, some FileMaker notes have `_fkID` values that don't match any project, task, or customer in Supabase.

**Migration Script Handling:**
1. Attempt to match `_fkID` to projects (most common)
2. If not found, check tasks
3. If not found, check customers
4. If no parent found, log as orphaned

**Expected Results:**
- Orphaned notes logged to migration error report
- Orphaned notes either:
  - Option A: Skipped during migration (logged for manual review)
  - Option B: Inserted into special `orphaned_notes` table
  - Option C: Attached to "Unknown" placeholder entity
- Migration does NOT fail due to orphaned notes
- Orphaned note count < 5% of total notes (quality threshold)

**Reference:** `requirements/notes/data-model-mapping.md:443-445`

---

#### Test Case 6.2: Concurrent Note Creation
**Scenario:** Two users create notes on the same project simultaneously

**Steps:**
1. User A creates note: "User A's note" at 14:30:00.000Z
2. User B creates note: "User B's note" at 14:30:00.050Z (50ms later)

**Expected Results:**
- Both notes created successfully with unique UUIDs
- Both notes appear in project notes list
- Notes sorted by creation timestamp (User B's appears first if DESC)
- No race conditions or lost updates
- PostgreSQL ACID guarantees ensure both inserts succeed

---

#### Test Case 6.3: Maximum Content Length
**Steps:**
1. Create note with 10,000 characters of content
2. Create note with 100,000 characters of content

**Expected Results:**
- Both notes created successfully
- PostgreSQL `TEXT` type has no practical limit (1GB max)
- Frontend may impose UI limits for UX (recommend max 10,000 chars)
- Content stored and retrieved without truncation

**Schema Reference:** `requirements/notes/data-model-mapping.md:289-300`

---

#### Test Case 6.4: Special Characters and Encoding
**Steps:**
1. Create note with content:
```
"Special chars: <script>alert('XSS')</script>, 日本語, émojis 🎉, quotes \"\" '', newlines \n\n"
```

**Expected Results:**
- Content stored exactly as provided (no HTML escaping in database)
- Special characters preserved (UTF-8 encoding)
- XSS protection handled at UI rendering layer (not database layer)
- Newlines preserved in TEXT field
- No SQL injection possible (parameterized queries)

**Security Note:** Input sanitization for XSS MUST occur in frontend rendering, not during storage.

---

#### Test Case 6.5: Null and Default Values
**Steps:**
1. Create note with minimal data (omit optional fields):
```json
{
  "note": "Minimal note",
  "project_id": "123e4567-..."
}
```

**Expected Results:**
- Note created with defaults:
  - `id`: Auto-generated UUID
  - `type`: 'general' (default)
  - `customer_id`: NULL
  - `task_id`: NULL
  - `created_at`: NOW()
  - `updated_at`: NOW() (equals created_at)
  - `created_by`: Current user UUID (from auth.uid())
  - `updated_by`: Current user UUID
  - `organization_id`: Derived from user's JWT

**Reference:** `requirements/notes/data-model-mapping.md:486-498`

---

#### Test Case 6.6: Note Type Flexibility
**Reference:** `requirements/notes/data-model-mapping.md:302-310`

**Steps:**
1. Create notes with various types:
   - "general"
   - "internal"
   - "customer"
   - "meeting"
   - "custom_type_123"

**Expected Results:**
- All notes created successfully
- No enum constraint on `type` field (allows flexibility)
- Future enhancement: Add check constraint or enum for known types
- Invalid/unknown types stored as-is (no validation initially)

---

#### Test Case 6.7: Timestamp Precision
**Steps:**
1. Create note
2. Immediately update note (within 1ms)
3. Compare `created_at` vs `updated_at`

**Expected Results:**
- Both timestamps use PostgreSQL `TIMESTAMPTZ` type
- Precision: Microseconds (6 decimal places)
- `updated_at` > `created_at` (even for sub-second updates)
- Timestamps stored in UTC
- Example format: `2024-01-15T14:30:00.123456Z`

**Reference:** `requirements/notes/data-model-mapping.md:313-333`

---

### 7. Performance Requirements

#### Test Case 7.1: Response Time Benchmarks
**Reference:** `requirements/notes/api-contracts.md:443-454`

| Operation | Target | Maximum | Test Scenario |
|-----------|--------|---------|---------------|
| List notes (< 50 records) | < 200ms | < 500ms | Project with 30 notes |
| List notes (50-100 records) | < 300ms | < 700ms | Project with 75 notes |
| Get note by ID | < 100ms | < 200ms | Single note lookup |
| Create note | < 200ms | < 300ms | Standard note creation |
| Update note | < 200ms | < 300ms | Update content only |
| Delete note | < 150ms | < 200ms | Hard delete operation |

**Test Method:**
- Use backend server in production environment
- Measure server-side processing time (exclude network latency)
- Run 10 iterations, report average and p95
- All measurements with indexes in place

---

#### Test Case 7.2: Index Performance Validation
**Reference:** `requirements/notes/data-model-mapping.md:113-123`

**Preconditions:**
- Database has 10,000+ notes across multiple organizations

**Test Queries:**
```sql
-- Query 1: Project notes (should use idx_notes_project_created)
EXPLAIN ANALYZE
SELECT * FROM notes
WHERE project_id = '123e4567-...'
ORDER BY created_at DESC;

-- Query 2: Organization filter (should use idx_notes_organization_id)
EXPLAIN ANALYZE
SELECT * FROM notes
WHERE organization_id = '456e4567-...'
AND type = 'general';

-- Query 3: Task notes (should use idx_notes_task_id partial index)
EXPLAIN ANALYZE
SELECT * FROM notes
WHERE task_id = '789e4567-...';
```

**Expected Results:**
- All queries use indexes (no sequential scans)
- Query 1 uses composite index `idx_notes_project_created`
- Query 2 uses `idx_notes_organization_id` + `idx_notes_type`
- Query 3 uses partial index `idx_notes_task_id`
- Execution time < 50ms for 10,000 records

**Verification Command:**
```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"EXPLAIN ANALYZE SELECT * FROM notes WHERE project_id = '123e4567-...' ORDER BY created_at DESC;\""
```

---

#### Test Case 7.3: Pagination Efficiency
**Steps:**
1. Load page 1 (offset 0, limit 50) - measure time
2. Load page 10 (offset 450, limit 50) - measure time
3. Load page 20 (offset 950, limit 50) - measure time

**Expected Results:**
- Page 1: < 200ms
- Page 10: < 300ms (offset penalty)
- Page 20: < 400ms (larger offset penalty)
- All pages use index (no full table scan)

**Note:** For very large datasets (>10,000 records), consider cursor-based pagination instead of offset.

---

#### Test Case 7.4: Realtime Subscription Performance
**Reference:** `requirements/notes/api-contracts.md:371-440`

**Steps:**
1. Subscribe to project notes changes:
```javascript
supabaseService.client
  .channel('project_notes_changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'notes',
    filter: `project_id=eq.${projectId}`
  }, handleNoteChange)
  .subscribe();
```
2. Create 10 notes rapidly (1 per second)

**Expected Results:**
- All 10 INSERT events received via subscription
- Event latency < 100ms from database commit to client notification
- Payload includes full note record in `payload.new`
- Events received in correct order
- No missed events
- RLS policies apply to subscription (only org notes received)

---

### 8. Data Migration Validation

#### Test Case 8.1: Pre-Migration Validation
**Reference:** `requirements/notes/migration-plan.md:14-30`

**Steps:**
1. Run dependency checks:
```bash
# Verify parent entities migrated
SELECT COUNT(*) FROM public.projects;    -- Should be > 0
SELECT COUNT(*) FROM public.tasks;       -- Should be > 0
SELECT COUNT(*) FROM public.customers;   -- Should be > 0
SELECT COUNT(*) FROM auth.users;         -- Should be > 0
```

**Expected Results:**
- All parent entity tables exist and have data
- No migration starts until dependencies satisfied
- Migration script exits with error if dependencies missing

---

#### Test Case 8.2: Migration Record Count Validation
**Reference:** `requirements/notes/migration-plan.md:32-100`

**Steps:**
1. Count FileMaker notes: `SELECT COUNT(*) FROM devNotes`
2. Run migration script
3. Count Supabase notes: `SELECT COUNT(*) FROM public.notes`
4. Compare counts

**Expected Results:**
- Supabase count >= FileMaker count - orphaned notes
- Orphaned notes < 5% of total
- Migration log shows:
  - Total FileMaker records
  - Successfully migrated
  - Orphaned (no parent entity found)
  - Failed (validation errors)

---

#### Test Case 8.3: Parent Entity Type Detection
**Reference:** `requirements/notes/data-model-mapping.md:178-189`

**Migration Algorithm Test:**
```javascript
// For each FileMaker note with _fkID
1. Check if _fkID exists in projects table → Set project_id
2. Else check if _fkID exists in tasks table → Set task_id
3. Else check if _fkID exists in customers table → Set customer_id
4. Else mark as orphaned
```

**Test Data:**
- Note A: `_fkID` matches project UUID → Expect `project_id` set
- Note B: `_fkID` matches task UUID → Expect `task_id` set
- Note C: `_fkID` matches customer UUID → Expect `customer_id` set
- Note D: `_fkID` matches nothing → Expect orphaned

**Expected Results:**
- 100% accurate parent type detection
- Exactly one FK set per note (check constraint validates)
- No notes with multiple parents
- No notes with zero parents (except orphaned, which are logged)

---

#### Test Case 8.4: User Mapping Validation
**Reference:** `requirements/notes/data-model-mapping.md:191-199`

**Steps:**
1. Export FileMaker note with `~CreatedBy = "john@example.com"`
2. Lookup user in Supabase: `SELECT id FROM auth.users WHERE email = 'john@example.com'`
3. Migrate note
4. Verify `created_by` UUID matches user lookup

**Expected Results:**
- `created_by` set to correct user UUID
- If email not found in auth.users:
  - Use fallback MIGRATION_USER_UUID
  - Log unmapped user for review
- `updated_by` initially equals `created_by` (no edit history in FileMaker)

---

#### Test Case 8.5: Timestamp Conversion
**Reference:** `requirements/notes/data-model-mapping.md:213-218`

**Steps:**
1. Export FileMaker note with:
   - `~CreationTimestamp = "01/15/2024 14:30:00"` (FileMaker format)
   - `~ModificationTimestamp = "01/15/2024 16:45:00"`
2. Migrate note
3. Query Supabase note

**Expected Results:**
- `created_at = "2024-01-15T14:30:00.000Z"` (ISO 8601, UTC)
- `updated_at = "2024-01-15T16:45:00.000Z"`
- Timezone conversion applied (FileMaker server timezone → UTC)
- Millisecond precision preserved (if available in FileMaker)

**Conversion Code:**
```javascript
created_at = TIMESTAMP '01/15/2024 14:30:00' AT TIME ZONE 'America/Toronto' AT TIME ZONE 'UTC'
```

---

#### Test Case 8.6: Organization ID Derivation
**Reference:** `requirements/notes/data-model-mapping.md:200-211`

**Steps:**
1. FileMaker note has `_fkID` pointing to project
2. Project in Supabase has `organization_id = "abc123-..."`
3. Migrate note

**Expected Results:**
- Note's `organization_id` set to "abc123-..." (derived from project)
- For task notes: Lookup task → Get task's project → Get project's organization
- All notes MUST have organization_id (NOT NULL constraint)
- Migration fails if organization cannot be determined

**Algorithm:**
```sql
-- Derive organization from parent entity
organization_id = (
  SELECT organization_id FROM projects WHERE id = project_id
  UNION
  SELECT p.organization_id FROM tasks t JOIN projects p ON t.project_id = p.id WHERE t.id = task_id
  UNION
  SELECT organization_id FROM customers WHERE id = customer_id
)
```

---

#### Test Case 8.7: Migration Rollback
**Reference:** `requirements/notes/migration-plan.md` (Appendix B)

**Steps:**
1. Start migration (insert 100 notes)
2. Encounter critical error at note 101
3. Trigger rollback

**Expected Results:**
- Transaction rolled back
- All 100 inserted notes removed
- Database state returns to pre-migration
- FileMaker notes unchanged (read-only during migration)
- Migration can be re-run after fixing error

**Implementation:** Use PostgreSQL transactions:
```sql
BEGIN;
-- Insert all notes
-- If any error: ROLLBACK;
-- If success: COMMIT;
```

---

#### Test Case 8.8: Post-Migration Data Integrity Check
**Reference:** `requirements/notes/migration-plan.md` (Validation section)

**Validation Queries:**
```sql
-- 1. Check all notes have exactly one parent
SELECT COUNT(*) FROM notes
WHERE (
  (customer_id IS NOT NULL)::int +
  (project_id IS NOT NULL)::int +
  (task_id IS NOT NULL)::int
) != 1;
-- Expected: 0 records

-- 2. Check all notes have organization_id
SELECT COUNT(*) FROM notes WHERE organization_id IS NULL;
-- Expected: 0 records

-- 3. Check all notes have valid creator
SELECT COUNT(*) FROM notes n
LEFT JOIN auth.users u ON n.created_by = u.id
WHERE n.created_by IS NOT NULL AND u.id IS NULL;
-- Expected: 0 records (all creators exist)

-- 4. Check parent entity foreign keys valid
SELECT COUNT(*) FROM notes n
LEFT JOIN projects p ON n.project_id = p.id
WHERE n.project_id IS NOT NULL AND p.id IS NULL;
-- Expected: 0 records (all projects exist)

-- 5. Check organization consistency
SELECT COUNT(*) FROM notes n
JOIN projects p ON n.project_id = p.id
WHERE n.organization_id != p.organization_id;
-- Expected: 0 records (org matches parent)
```

**Expected Results:**
- All validation queries return 0 (no integrity violations)
- If any query returns > 0, migration is INVALID and must be rolled back

---

### 9. User Acceptance Criteria

#### User Scenario 9.1: Create Project Note from Project Details
**Reference:** `src/components/projects/ProjectNotesTab.jsx`

**Given:** User is viewing project details for "Website Redesign" project
**When:**
1. User clicks "Notes" tab
2. User sees existing notes list (sorted newest first)
3. User clicks "Add Note" button or text input field
4. User types: "Client approved homepage mockups. Proceeding to development."
5. User clicks "Save" or presses Enter

**Then:**
- Note is saved successfully
- Success notification appears: "Note added successfully"
- New note appears at top of notes list
- Note displays:
  - Content: "Client approved homepage mockups. Proceeding to development."
  - Created timestamp: "Just now" or "2 minutes ago"
  - Creator: Current user's name/email
- Note input field is cleared
- User can immediately add another note
- No page reload required (optimistic update)

---

#### User Scenario 9.2: Create Task Note from Task List
**Reference:** `src/components/tasks/TaskList.jsx`

**Given:** User has selected task "Fix login bug" from task list
**When:**
1. User sees task details panel
2. User sees "Notes" section with existing notes (if any)
3. User clicks "Add Note" text input
4. User types: "Bug reproduced on staging. Root cause: session timeout not handled."
5. User clicks "Add" button

**Then:**
- Note is saved to task
- Note appears in task notes list
- Task notes sorted by newest first
- Success feedback provided (snackbar or inline)
- Input cleared for next note

---

#### User Scenario 9.3: View Notes Across Multiple Projects
**Given:** User manages 5 active projects, each with 10-20 notes
**When:**
1. User navigates between projects via sidebar
2. User clicks "Notes" tab on each project

**Then:**
- Each project shows ONLY its own notes (no cross-contamination)
- Notes load quickly (< 500ms per project)
- Sorting is consistent (newest first)
- No notes from other organizations visible (RLS enforced)

---

#### User Scenario 9.4: Edit Note (Future Enhancement)
**Note:** Not currently implemented in FileMaker UI, but API supports it.

**Given:** User created note with typo: "Client requested featrue demo"
**When:**
1. User clicks "Edit" icon on note
2. User corrects typo: "Client requested feature demo"
3. User clicks "Save"

**Then:**
- Note updated successfully
- Corrected content displayed
- "Updated at" timestamp shows recent time
- "Updated by" shows current user
- Original creation timestamp preserved

---

#### User Scenario 9.5: Search Notes (Future Enhancement)
**Given:** User has 200+ notes across all projects
**When:**
1. User enters "invoice" in notes search box
2. User presses Enter

**Then:**
- All notes containing "invoice" displayed
- Notes from all projects shown (within user's organization)
- Results show project/task context
- Search is case-insensitive
- Results paginated if > 50 matches

---

### 10. Security and Authorization

#### Test Case 10.1: HMAC Authentication Validation
**Reference:** `requirements/notes/api-contracts.md:6-12`

**Steps:**
1. Send request WITHOUT Authorization header
2. Send request with INVALID signature
3. Send request with EXPIRED timestamp (> 5 minutes old)
4. Send request with VALID HMAC

**Expected Results:**
1. No auth header → HTTP 401, `MISSING_AUTH_HEADER`
2. Invalid signature → HTTP 401, `INVALID_AUTH_SIGNATURE`
3. Expired timestamp → HTTP 401, `EXPIRED_AUTH_TOKEN`
4. Valid HMAC → HTTP 200, request succeeds

**Code Reference:** `src/services/dataService.js:generateBackendAuthHeader()`

---

#### Test Case 10.2: JWT Authentication Validation
**Reference:** `requirements/notes/authorization.md:65-97`

**Steps:**
1. Send Supabase query with INVALID JWT
2. Send query with EXPIRED JWT
3. Send query with VALID JWT but missing `organization_id` in user_metadata
4. Send query with VALID JWT

**Expected Results:**
1. Invalid JWT → Supabase error, authentication failed
2. Expired JWT → 401 Unauthorized, must refresh token
3. Missing org_id → RLS policy fails, no results (or error)
4. Valid JWT → Query succeeds, results scoped to user's organization

---

#### Test Case 10.3: SQL Injection Prevention
**Steps:**
1. Attempt to inject SQL via note content:
```json
{
  "note": "'; DROP TABLE notes; --",
  "project_id": "123e4567-..."
}
```
2. Attempt to inject via search parameter:
```
GET /api/notes?search=' OR '1'='1
```

**Expected Results:**
- Note created with literal content `'; DROP TABLE notes; --` (no execution)
- Search returns notes matching literal string (no SQL injection)
- Parameterized queries prevent all SQL injection
- Input treated as data, never as code

---

#### Test Case 10.4: XSS Prevention
**Steps:**
1. Create note with XSS payload:
```json
{
  "note": "<script>alert('XSS')</script>",
  "project_id": "123e4567-..."
}
```
2. Display note in UI

**Expected Results:**
- Note stored as-is in database (no server-side sanitization)
- UI renders content as TEXT (not HTML)
- React automatically escapes content: `&lt;script&gt;alert('XSS')&lt;/script&gt;`
- No JavaScript execution in browser
- Content displayed literally to user

**Frontend Responsibility:** Always render user content as text, never as HTML (use `textContent`, not `innerHTML`).

---

#### Test Case 10.5: RLS Policy Enforcement
**Reference:** `requirements/notes/authorization.md:100-150`

**Test 10.5a: SELECT Policy**
```sql
-- RLS Policy
CREATE POLICY notes_organization_isolation ON public.notes
    FOR SELECT
    USING (organization_id = (auth.jwt() -> 'user_metadata' ->> 'organization_id')::UUID);
```

**Steps:**
1. User A (Org 1) queries: `SELECT * FROM notes`

**Expected Results:**
- Only notes with `organization_id = Org 1` returned
- Notes from Org 2, Org 3, etc. filtered out
- RLS policy applied automatically (transparent to user)

---

**Test 10.5b: INSERT Policy**
**Steps:**
1. User A (Org 1) attempts to insert note with `organization_id = Org 2`

**Expected Results:**
- INSERT blocked by RLS policy
- Error: RLS policy violation
- User cannot create notes in other organizations

**Note:** Frontend should NOT allow user to specify organization_id. It should be automatically set from JWT.

---

**Test 10.5c: UPDATE Policy**
**Steps:**
1. User A (Org 1) attempts to update note from Org 2

**Expected Results:**
- UPDATE blocked (note not visible to user due to SELECT policy)
- RLS prevents cross-org updates

---

**Test 10.5d: DELETE Policy**
**Steps:**
1. User A (Org 1) attempts to delete note from Org 2

**Expected Results:**
- DELETE blocked (note not visible to user)
- RLS prevents cross-org deletions

---

### 11. Error Handling and Edge Cases

#### Test Case 11.1: Network Failure Scenarios

**Test 11.1a: Request Timeout**
**Steps:**
1. Simulate slow network (> 30 seconds)
2. Create note

**Expected Results:**
- Request times out
- Frontend shows error: "Request timed out. Please try again."
- User can retry operation
- No partial data saved

---

**Test 11.1b: Connection Lost Mid-Request**
**Steps:**
1. Start note creation
2. Disconnect network before response received
3. Reconnect network

**Expected Results:**
- Frontend shows error: "Connection lost. Please check your network."
- User can retry operation
- Backend may have completed request (check idempotency)
- Consider retry with exponential backoff

---

#### Test Case 11.2: Server Error Scenarios

**Test 11.2a: 500 Internal Server Error**
**Steps:**
1. Trigger server error (e.g., database connection failure)

**Expected Results:**
- HTTP 500 response
- Error code: `INTERNAL_SERVER_ERROR`
- Frontend displays: "Something went wrong. Please try again later."
- Error logged to monitoring system
- User notified to contact support if persists

---

**Test 11.2b: 503 Service Unavailable**
**Steps:**
1. Database is offline or overloaded

**Expected Results:**
- HTTP 503 response
- Error code: `DATABASE_UNAVAILABLE`
- Frontend displays: "Service temporarily unavailable. Please try again in a moment."
- Automatic retry after 5 seconds (with exponential backoff)
- Max 3 retries before giving up

---

#### Test Case 11.3: Optimistic Concurrency
**Scenario:** Two users edit the same note simultaneously

**Steps:**
1. User A loads note: "Initial content"
2. User B loads same note: "Initial content"
3. User A updates to: "User A's changes"
4. User B updates to: "User B's changes"

**Expected Results:**
- **Current behavior (last write wins):**
  - User A's update succeeds
  - User B's update succeeds (overwrites User A's changes)
  - Final content: "User B's changes"
  - No conflict detection (acceptable for MVP)

- **Future enhancement (optimistic locking):**
  - User B's update fails: "Note has been modified by another user"
  - User B sees latest content and can re-apply changes
  - Use `updated_at` timestamp for version checking

---

#### Test Case 11.4: Rate Limiting (If Implemented)
**Steps:**
1. Create 100 notes in rapid succession (< 1 second)

**Expected Results:**
- If rate limiting enabled:
  - Requests throttled after threshold (e.g., 10 req/sec)
  - HTTP 429 Too Many Requests
  - Retry-After header indicates wait time
- If no rate limiting:
  - All requests succeed
  - Database handles load (test performance impact)

---

### 12. Performance Benchmarks

#### Test Case 12.1: Load Testing
**Reference:** `requirements/notes/api-contracts.md:443-454`

**Scenario:** 100 concurrent users creating notes

**Test Setup:**
- 100 simulated users
- Each user creates 10 notes sequentially
- Total: 1,000 note creations

**Expected Results:**
- 95th percentile response time < 500ms
- 99th percentile response time < 1000ms
- No failed requests (100% success rate)
- Database connection pool handles concurrency
- No deadlocks or race conditions

**Tool:** Use JMeter, Locust, or Artillery for load testing

---

#### Test Case 12.2: Database Query Performance
**Preconditions:**
- Database has 50,000 notes across 10 organizations

**Queries to Benchmark:**
1. `SELECT * FROM notes WHERE project_id = ? ORDER BY created_at DESC LIMIT 50`
2. `SELECT * FROM notes WHERE organization_id = ? AND type = 'general' LIMIT 50`
3. `SELECT * FROM notes WHERE task_id = ?`
4. `SELECT * FROM notes WHERE note ILIKE '%search_term%' LIMIT 50`

**Expected Results:**
- Query 1: < 50ms (uses composite index)
- Query 2: < 75ms (uses two indexes)
- Query 3: < 30ms (uses partial index)
- Query 4: < 200ms (full-text search, slower)

**Optimization:** For Query 4, consider adding PostgreSQL full-text search index:
```sql
CREATE INDEX idx_notes_fulltext ON notes USING GIN (to_tsvector('english', note));
```

---

#### Test Case 12.3: Realtime Subscription Scalability
**Scenario:** 50 users subscribed to same project's notes

**Steps:**
1. 50 users subscribe to project notes channel
2. Create 1 note
3. Measure time for all 50 users to receive event

**Expected Results:**
- All 50 users receive INSERT event
- Median latency: < 100ms
- Max latency: < 500ms
- No dropped events
- Supabase Realtime handles fanout efficiently

---

### 13. Accessibility Requirements

#### Test Case 13.1: Keyboard Navigation
**Steps:**
1. Navigate to notes list using Tab key
2. Focus on note input field
3. Type note content
4. Press Enter to submit
5. Tab to next note item
6. Press Delete key on focused note

**Expected Results:**
- All interactive elements keyboard accessible
- Focus indicators visible (outline or border)
- Logical tab order (top to bottom)
- Enter key submits form
- Escape key cancels edit/creation
- Arrow keys navigate list items

---

#### Test Case 13.2: Screen Reader Support
**Steps:**
1. Enable screen reader (VoiceOver, JAWS, NVDA)
2. Navigate notes list
3. Create new note

**Expected Results:**
- Notes list announced: "Notes list, 5 items"
- Each note announced with content, creator, timestamp
- Form labels announced: "Note content, text input"
- Submit button announced: "Save note, button"
- Success message announced: "Note added successfully"

**ARIA Requirements:**
```html
<ul role="list" aria-label="Project notes">
  <li role="listitem">
    <span aria-label="Note content">...</span>
    <span aria-label="Created by John Doe on January 15, 2024">...</span>
  </li>
</ul>

<label for="note-input">Note content</label>
<input id="note-input" type="text" aria-required="true" />
```

---

#### Test Case 13.3: Color Contrast (WCAG AA)
**Steps:**
1. Measure color contrast ratios for:
   - Note content text vs background
   - Timestamp text vs background
   - Input field border vs background
   - Focus indicator vs background

**Expected Results:**
- Normal text (< 18pt): Contrast ratio ≥ 4.5:1
- Large text (≥ 18pt or bold 14pt): Contrast ratio ≥ 3:1
- UI components (borders, icons): Contrast ratio ≥ 3:1
- Focus indicators: Contrast ratio ≥ 3:1

**Tool:** Use Chrome DevTools Color Picker or WebAIM Contrast Checker

---

### 14. Browser Compatibility

#### Test Case 14.1: Cross-Browser Functional Testing
**Browsers to Test:**
- Chrome (latest) - Primary
- Firefox (latest)
- Safari (latest) - macOS/iOS
- Edge (latest)

**Test Matrix:**
| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Create note | ✓ | ✓ | ✓ | ✓ |
| View notes list | ✓ | ✓ | ✓ | ✓ |
| Edit note | ✓ | ✓ | ✓ | ✓ |
| Delete note | ✓ | ✓ | ✓ | ✓ |
| Search notes | ✓ | ✓ | ✓ | ✓ |
| Realtime updates | ✓ | ✓ | ✓ | ✓ |

**Expected Results:**
- All features work identically across browsers
- No JavaScript errors in console
- UI renders correctly (no layout issues)
- Performance acceptable on all browsers

---

#### Test Case 14.2: Mobile Browser Testing
**Devices:**
- iOS Safari (iPhone 12+)
- Chrome on Android (Pixel 6+)

**Test Cases:**
- Create note on mobile (touch input)
- View notes list (scrollable)
- Edit note (on-screen keyboard)
- Responsive design (vertical/horizontal orientation)

**Expected Results:**
- Touch targets ≥ 44x44px (iOS guideline)
- Input fields zoom correctly (font-size ≥ 16px to prevent auto-zoom)
- Keyboard appears/disappears smoothly
- No horizontal scrolling
- Performance acceptable on mobile networks

---

### 15. Deployment and Rollback

#### Test Case 15.1: Pre-Deployment Checklist
**Reference:** Backend Change Protocol - `CLAUDE.md:10-49`

- [ ] Backend schema deployed to Supabase
- [ ] Indexes created and verified
- [ ] RLS policies enabled and tested
- [ ] Triggers created (updated_at auto-update)
- [ ] Backend API endpoints implemented and tested
- [ ] Frontend code reviewed and merged
- [ ] Environment variables configured
- [ ] Migration script tested on staging data
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured
- [ ] Team notified of deployment window

---

#### Test Case 15.2: Post-Deployment Smoke Tests
**Immediately after deployment:**

**Test 1: Health Check**
```bash
curl https://api.claritybusinesssolutions.ca/health
# Expected: {"status": "healthy"}
```

**Test 2: Create Note**
```bash
curl -X POST https://api.claritybusinesssolutions.ca/api/notes \
  -H "Authorization: Bearer {HMAC_SIGNATURE}" \
  -H "Content-Type: application/json" \
  -d '{"note": "Deployment test note", "project_id": "{TEST_PROJECT_ID}"}'
# Expected: HTTP 200, note created
```

**Test 3: List Notes**
```bash
curl https://api.claritybusinesssolutions.ca/api/notes?project_id={TEST_PROJECT_ID} \
  -H "Authorization: Bearer {HMAC_SIGNATURE}"
# Expected: HTTP 200, test note in results
```

**Test 4: Verify RLS**
- Login as User A (Org 1)
- Create note on Org 1 project
- Login as User B (Org 2)
- Verify User B cannot see User A's note

**Expected Results:**
- All smoke tests pass
- No errors in application logs
- No errors in database logs
- Monitoring dashboards show healthy metrics

---

#### Test Case 15.3: Rollback Procedure
**Scenario:** Critical bug discovered after deployment

**Rollback Steps:**
1. **Frontend Rollback:**
   - Revert to previous Git commit
   - Rebuild and redeploy frontend
   - Verify previous version loads correctly

2. **Backend API Rollback:**
   - Revert backend code to previous version
   - Restart backend services
   - Verify API endpoints respond

3. **Database Rollback (if schema changed):**
   - **DANGER:** Cannot easily undo table/column changes
   - Option 1: Restore from backup (data loss risk)
   - Option 2: Forward-fix with new migration
   - **Prevention:** Test schema changes thoroughly before deployment

**Test Rollback:**
- Verify old frontend works with old backend
- Verify data integrity maintained
- No orphaned records or broken foreign keys

---

### 16. Monitoring and Alerting

#### Test Case 16.1: Error Rate Monitoring
**Metrics to Track:**
- Note creation error rate (target: < 1%)
- Note read error rate (target: < 0.1%)
- 500 errors per minute (alert threshold: > 5/min)
- Database connection failures (alert: any)

**Alerting Rules:**
- If error rate > 5% for 5 minutes → Page on-call engineer
- If database unavailable → Immediate page
- If response time p95 > 1s for 10 minutes → Warning alert

---

#### Test Case 16.2: Performance Monitoring
**Metrics to Track:**
- Average response time per endpoint
- p50, p95, p99 response times
- Requests per second
- Database query execution time
- Realtime subscription count

**Dashboards:**
- Real-time request volume graph
- Error rate trend (last 24 hours)
- Response time heatmap
- Database connection pool usage

---

### 17. Documentation Validation

#### Test Case 17.1: API Documentation Accuracy
**Steps:**
1. Review API documentation: `requirements/notes/api-contracts.md`
2. Test each documented endpoint
3. Verify request/response schemas match documentation
4. Check error codes documented vs actual

**Expected Results:**
- All documented endpoints exist and work
- Request schemas accepted as documented
- Response schemas match documentation exactly
- Error codes match catalog in `api-contracts.md:495-538`

---

#### Test Case 17.2: User Documentation Completeness
**Required Documentation:**
- [ ] How to create a note
- [ ] How to view notes for a project/task
- [ ] How to edit a note (when UI implemented)
- [ ] How to delete a note (when UI implemented)
- [ ] How to search notes (when implemented)
- [ ] Troubleshooting common errors
- [ ] FAQ: "Where did my note go?" (org scoping)
- [ ] FAQ: "Can I move a note to another project?" (No, immutable)

---

## Success Metrics

### Quantitative Targets
- [x] **100% FileMaker feature parity** - All create/view functionality preserved
- [ ] **99.9% uptime** - Less than 43 minutes downtime per month
- [ ] **< 1% error rate** - 99% of requests succeed
- [ ] **< 500ms average response time** - Fast user experience
- [ ] **Zero data loss during migration** - All FileMaker notes migrated successfully
- [ ] **< 5% orphaned notes** - Parent entity detection ≥ 95% successful

### Qualitative Targets
- [ ] **Positive user feedback** - Users prefer new system over FileMaker
- [ ] **No critical bugs in first week** - Stable post-deployment
- [ ] **Users complete tasks without support** - Intuitive UI
- [ ] **Feature adoption rate > 80%** - Users actively creating notes
- [ ] **No security incidents** - RLS policies effective, no data leaks

---

## References

### Code References
- **API Layer:** `src/api/notes.js`, `src/api/projects.js:47-59`, `src/api/tasks.js:286-298`
- **Service Layer:** `src/services/noteService.js`, `src/services/taskService.js:207-223`
- **Hooks:** `src/hooks/useNote.js`, `src/hooks/useProject.js:95-137`, `src/hooks/useTask.js:80-105`
- **UI Components:** `src/components/projects/ProjectNotesTab.jsx`, `src/components/tasks/TaskList.jsx`

### Documentation References
- **Data Model:** `requirements/notes/data-model-mapping.md`
- **API Contracts:** `requirements/notes/api-contracts.md`
- **Authorization:** `requirements/notes/authorization.md`
- **Migration Plan:** `requirements/notes/migration-plan.md`
- **Current Implementation:** `requirements/notes/current-implementation.md`

### Database References
- **Table:** `public.notes`
- **Container:** `supabase-db`
- **Database:** `postgres`
- **User:** `postgres`

### Testing Resources
- **Backend API:** `https://api.claritybusinesssolutions.ca`
- **API Docs:** `https://api.claritybusinesssolutions.ca/docs`
- **OpenAPI Spec:** `https://api.claritybusinesssolutions.ca/openapi.json`

---

## Notes

### Critical Requirements for Sign-Off
1. All CRUD operations tested and working
2. Organization isolation (RLS) verified with multi-tenant data
3. Migration validation: Record counts match, no data loss
4. Performance benchmarks met (response times, query performance)
5. Security tested (SQL injection, XSS, auth validation)
6. Cross-browser compatibility verified
7. Accessibility requirements met (keyboard nav, screen readers)
8. Error handling graceful for all error scenarios
9. Rollback plan tested and documented
10. User documentation complete and accurate

### Future Enhancements (Post-MVP)
- Rich text note editor (Markdown or WYSIWYG)
- Note attachments (files, images)
- @mentions and notifications
- Note templates for common types
- Full-text search with highlighting
- Note versioning/edit history
- Note categories/tags system
- Note privacy levels (internal vs customer-visible)
- Batch operations (bulk delete, bulk export)
- Note analytics (most active projects, note volume trends)

### Known Limitations (Acceptable for MVP)
- No edit/delete UI (FileMaker parity maintained, API supports it)
- No conflict resolution for concurrent edits (last write wins)
- Offset-based pagination (less efficient for very large datasets)
- No full-text search index initially (can be added if search becomes slow)
- No rate limiting (rely on infrastructure-level controls)
- No note type validation (enum constraint deferred to future)

---

**Document Status:** Complete - Ready for Backend Team Review
**Last Updated:** 2026-01-10
**Author:** Requirements documentation for Notes migration
**Approval Required From:** Backend team, QA team, Product owner
