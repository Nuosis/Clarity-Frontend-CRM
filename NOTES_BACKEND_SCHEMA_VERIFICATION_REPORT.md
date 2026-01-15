# Notes Backend Schema Verification Report

**Date:** 2026-01-15
**Task:** Verify backend schema and test API endpoints for notes feature

## Executive Summary

Backend API endpoints for notes have been tested against the actual database schema. **CRITICAL DISCREPANCIES FOUND** between the OpenAPI specification and the actual database implementation.

## Endpoints Tested

### Primary Endpoints (HMAC Auth)
- `POST /projects/{project_id}/notes` - Create project note
- `GET /projects/{project_id}/notes` - List project notes
- `GET /projects/notes/{note_id}` - Get note by ID
- `PATCH /projects/notes/{note_id}` - Update note
- `DELETE /projects/notes/{note_id}` - Delete note

### Alternative Endpoints (JWT Auth - NOT TESTED)
- `POST /api/notes`
- `GET /api/notes`
- `GET /api/notes/{note_id}`
- `PATCH /api/notes/{note_id}`
- `DELETE /api/notes/{note_id}`

**Note:** The `/api/notes` endpoints require JWT authentication and were not successfully tested. The `/projects/*` endpoints use HMAC authentication (SharedSecretBearer) and match what the frontend actually uses.

## Authentication Requirements

### Successful Method (Implemented in Frontend)
```javascript
headers: {
  'Authorization': `Bearer ${hmacSignature}.${timestamp}`,  // HMAC-SHA256
  'X-Organization-ID': organizationId,                     // Org scoping
  'Content-Type': 'application/json'
}
```

### Failed Methods
- HMAC only (without X-Organization-ID) → 400 "ORG_REQUIRED"
- X-Organization-ID only (without HMAC) → Would fail auth

## Database Schema (Actual)

From `supabase-db` container, `notes` table:

```sql
Table "public.notes"
Column          | Type                     | Nullable | Default
----------------+--------------------------+----------+-------------------
id              | uuid                     | NOT NULL | gen_random_uuid()
organization_id | uuid                     | NOT NULL |
note            | text                     | NOT NULL |
type            | text                     | NOT NULL | 'general'::text
customer_id     | uuid                     | NULL     |
project_id      | uuid                     | NULL     |
task_id         | uuid                     | NULL     |
created_by      | uuid                     | NULL     |
updated_by      | uuid                     | NULL     |
created_at      | timestamp with time zone | NOT NULL | now()
updated_at      | timestamp with time zone | NOT NULL | now()
```

### Constraints
- **Primary Key:** `id`
- **Check Constraint:** `chk_notes_exactly_one_parent` - Exactly ONE of (customer_id, project_id, task_id) must be non-null
- **Foreign Keys:**
  - `customer_id` → `customers(id)` ON DELETE CASCADE
  - `project_id` → `projects(id)` ON DELETE CASCADE
  - `task_id` → `tasks(id)` ON DELETE CASCADE
  - `created_by` → `auth.users(id)` ON DELETE SET NULL
  - `updated_by` → `auth.users(id)` ON DELETE SET NULL
  - `organization_id` → `organizations(id)` ON DELETE CASCADE

### RLS Policies
- `notes_select_policy`: Can select if `organization_id = current_org_id()`
- `notes_insert_policy`: Can insert if org matches AND parent entity belongs to org
- `notes_update_policy`: Can update if `organization_id = current_org_id()`
- `notes_delete_policy`: Can delete if `organization_id = current_org_id()`

## OpenAPI Spec (Expected)

### NoteCreate Schema
```json
{
  "entity_type": "string",        // ❌ NOT IN DATABASE
  "entity_id": "uuid",            // ❌ NOT IN DATABASE
  "organization_id": "uuid",      // ✓ EXISTS
  "content": "string",            // ✗ DB uses "note"
  "author": "string"              // ❌ DB uses "created_by" (uuid)
}
```

### NoteResponse Schema
```json
{
  "id": "uuid",
  "org_id": "uuid",               // ✗ DB uses "organization_id"
  "note": "string",
  "type": "string",
  "customer_id": "uuid",
  "project_id": "uuid",
  "task_id": "uuid",
  "created_by": "uuid",
  "updated_by": "uuid",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

## CRITICAL DISCREPANCIES

### 1. Polymorphic vs Explicit Foreign Keys

**OpenAPI Spec Assumes:**
- Polymorphic relationship using `entity_type` + `entity_id`
- Example: `{ entity_type: "project", entity_id: "uuid" }`

**Database Actually Has:**
- Three explicit nullable foreign keys: `customer_id`, `project_id`, `task_id`
- Constraint ensures exactly ONE is non-null
- No `entity_type` or `entity_id` columns exist

**Impact:** Backend API cannot accept `entity_id` + `entity_type` in request body.

### 2. Author Field Type Mismatch

**OpenAPI Spec:**
- `author`: string (nullable) - User name or ID as string

**Database:**
- `created_by`: uuid (nullable) - Foreign key to `auth.users(id)`
- `updated_by`: uuid (nullable) - Foreign key to `auth.users(id)`

**Impact:** Backend API rejects `author` field entirely with error:
```
Could not find the 'author' column of 'notes' in the schema cache
```

### 3. Content vs Note Field Name

**OpenAPI Request:**
- Uses `content` field in NoteCreate/NoteUpdate schemas

**Database:**
- Column is named `note`

**OpenAPI Response:**
- Correctly uses `note` field in NoteResponse

**Impact:** Field name transformation required in backend (request accepts `content`, stores as `note`).

### 4. Organization ID Field Name

**OpenAPI Response:**
- Uses `org_id` in NoteResponse

**Database:**
- Column is named `organization_id`

**Impact:** Field name transformation in backend (DB `organization_id` → API `org_id`).

## Test Results

### Test Execution

```bash
node test-notes-backend-schema.js
```

| Test | Endpoint | Status | Error |
|------|----------|--------|-------|
| 1 | POST /projects/{id}/notes | ❌ FAILED | `author` column not found |
| 2 | GET /projects/{id}/notes | ❌ FAILED | `entity_id` column not found |
| 3 | GET /projects/notes/{id} | ⏭️ SKIPPED | No note created |
| 4 | PATCH /projects/notes/{id} | ⏭️ SKIPPED | No note created |
| 5 | DELETE /projects/notes/{id} | ⏭️ SKIPPED | No note created |
| 6 | Org Scoping Test | ✅ PASSED | Correctly enforced |

### Error Messages

**Test 1 - POST /projects/{id}/notes:**
```json
{
  "code": "INTERNAL_ERROR",
  "message": "Failed to insert into table 'notes': {'message': \"Could not find the 'author' column of 'notes' in the schema cache\", 'code': 'PGRST204'}"
}
```

**Test 2 - GET /projects/{id}/notes:**
```json
{
  "code": "INTERNAL_ERROR",
  "message": "Failed to select from table 'notes': {'message': 'column notes.entity_id does not exist', 'code': '42703'}"
}
```

## Frontend Implementation (Current)

From `src/api/notes.js`:

```javascript
// Create note - uses /projects/{project_id}/notes
const payload = {
    entity_type: data.entity_type || 'project',
    entity_id: projectId,
    organization_id: env.authentication.user.supabaseOrgID,
    content: data.content || data.note,
    author: data.author || null  // ❌ Will fail - DB doesn't have this
};

const response = await dataService.post(`/projects/${projectId}/notes`, payload);
```

**PROBLEM:** Frontend sends `entity_type`, `entity_id`, and `author` which don't exist in database.

## Required Backend Fixes

The backend API layer needs to transform between the OpenAPI spec and database schema:

### 1. Request Transformation (API → Database)

```python
# Incoming request
{
  "entity_type": "project",
  "entity_id": "uuid",
  "content": "Note text",
  "author": "User name"  # Optional
}

# Transform to database insert
{
  "project_id": "uuid",      # Based on entity_type
  "customer_id": None,
  "task_id": None,
  "note": "Note text",       # content → note
  "created_by": user_id,     # From JWT, not author string
  "organization_id": org_id  # From X-Organization-ID header
}
```

### 2. Response Transformation (Database → API)

```python
# Database record
{
  "id": "uuid",
  "organization_id": "uuid",
  "note": "Note text",
  "project_id": "uuid",
  "customer_id": None,
  "task_id": None,
  "created_by": "user-uuid",
  "updated_by": "user-uuid",
  "created_at": "2026-01-15T...",
  "updated_at": "2026-01-15T..."
}

# Transform to API response
{
  "id": "uuid",
  "org_id": "uuid",          # organization_id → org_id
  "note": "Note text",
  "type": "general",
  "project_id": "uuid",
  "customer_id": None,
  "task_id": None,
  "created_by": "user-uuid",
  "updated_by": "user-uuid",
  "created_at": "2026-01-15T...",
  "updated_at": "2026-01-15T..."
}
```

### 3. created_by Population

Backend should:
1. Extract user ID from JWT token
2. Set `created_by` = user ID (not accept `author` from request)
3. Set `updated_by` = user ID on PATCH requests

## Required Frontend Fixes

While backend transformations would make the API work "as documented," the frontend should be updated to match the actual database schema:

```javascript
// CURRENT (incorrect)
const payload = {
    entity_type: 'project',
    entity_id: projectId,
    content: 'Note text',
    author: 'User name'
};

// RECOMMENDED (matches DB)
const payload = {
    project_id: projectId,
    customer_id: null,
    task_id: null,
    note: 'Note text',
    // created_by will be set by backend from JWT
};
```

## Recommendations

### Option 1: Fix Backend API Layer (Recommended)
- Add request/response transformations in backend
- Keep OpenAPI spec as-is (polymorphic design)
- Frontend continues using current API contracts
- **Pros:** No frontend changes, cleaner API design
- **Cons:** Backend complexity, transformation overhead

### Option 2: Update OpenAPI Spec + Frontend
- Change OpenAPI spec to match database schema
- Update frontend to send `project_id`/`customer_id`/`task_id` directly
- Remove `author` field, rely on JWT-derived `created_by`
- **Pros:** No transformation layer, simpler backend
- **Cons:** Frontend breaking changes, less flexible API

### Option 3: Hybrid Approach
- Backend accepts BOTH formats (polymorphic OR explicit)
- Frontend gradually migrates to explicit format
- **Pros:** Backward compatible during migration
- **Cons:** Most complex, dual code paths

## Next Steps

1. ✅ **COMPLETED:** Document schema discrepancies (this report)
2. ⏳ **PENDING:** Backend team to implement transformation layer OR update OpenAPI spec
3. ⏳ **PENDING:** Frontend team to update API clients based on backend decision
4. ⏳ **PENDING:** Re-run integration tests after backend fixes
5. ⏳ **PENDING:** Update frontend components to handle `created_by` UUID instead of `author` string

## Files Modified

- `test-notes-backend-schema.js` - Comprehensive backend API verification script
- `NOTES_BACKEND_SCHEMA_VERIFICATION_REPORT.md` - This report

## References

- Database schema: `supabase-db` container, `public.notes` table
- OpenAPI spec: https://api.claritybusinesssolutions.ca/openapi.json
- Frontend API client: `src/api/notes.js`
- Frontend service: `src/services/dataService.js`
- Backend API: https://api.claritybusinesssolutions.ca/projects/{id}/notes

---

**Report generated:** 2026-01-15
**Backend API version:** Unknown (no version endpoint checked)
**Frontend version:** 1.1.0
