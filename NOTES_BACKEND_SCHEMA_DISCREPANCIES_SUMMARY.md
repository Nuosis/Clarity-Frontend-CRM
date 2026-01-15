# Notes Backend Schema Discrepancies - Quick Summary

## 🚨 CRITICAL FINDINGS

The OpenAPI specification does NOT match the actual database schema for the `notes` table. This prevents the current API from working.

## Schema Comparison Table

| Field | OpenAPI Spec | Actual Database | Status |
|-------|-------------|----------------|--------|
| Entity relationship | `entity_type` (string)<br>`entity_id` (uuid) | `customer_id` (uuid)<br>`project_id` (uuid)<br>`task_id` (uuid) | ❌ **BLOCKER** |
| Content field (request) | `content` (string) | `note` (text) | ⚠️ Needs transformation |
| Content field (response) | `note` (string) | `note` (text) | ✅ Matches |
| Author/Creator | `author` (string, nullable) | `created_by` (uuid, FK to users)<br>`updated_by` (uuid, FK to users) | ❌ **BLOCKER** |
| Organization ID (response) | `org_id` (uuid) | `organization_id` (uuid) | ⚠️ Needs transformation |

## Error Messages Encountered

### 1. Author Field Error
```json
{
  "code": "INTERNAL_ERROR",
  "message": "Failed to insert: Could not find the 'author' column of 'notes' in the schema cache"
}
```
**Cause:** Backend tries to insert `author` string field, but database has `created_by` UUID field.

### 2. Entity ID Error
```json
{
  "code": "INTERNAL_ERROR",
  "message": "Failed to select: column notes.entity_id does not exist"
}
```
**Cause:** Backend tries to query `entity_id` column, but database uses separate `customer_id`, `project_id`, `task_id` columns.

## Required Backend Changes

### Option A: Transform at API Layer (Recommended)
Backend needs to transform between API contract and database:

**Request Transformation:**
```python
# API receives
{
  "entity_type": "project",
  "entity_id": "abc-123",
  "content": "Note text",
  "author": "ignored"
}

# Backend inserts to DB
{
  "project_id": "abc-123",      # Set based on entity_type
  "customer_id": None,
  "task_id": None,
  "note": "Note text",          # content → note
  "created_by": <user_id>,      # From JWT, ignore author
  "organization_id": <org_id>   # From X-Organization-ID header
}
```

**Response Transformation:**
```python
# Database returns
{
  "id": "xyz-789",
  "organization_id": "org-456",
  "note": "Note text",
  "project_id": "abc-123",
  "customer_id": None,
  "task_id": None,
  "created_by": "user-789",
  ...
}

# Backend responds
{
  "id": "xyz-789",
  "org_id": "org-456",          # organization_id → org_id
  "note": "Note text",
  "project_id": "abc-123",
  "customer_id": None,
  "task_id": None,
  "created_by": "user-789",
  ...
}
```

### Option B: Update OpenAPI Spec + Frontend
Change API to match database schema exactly (breaking change).

## Required Frontend Changes (If Backend Implements Option A)

**Current Code (Won't Work):**
```javascript
const payload = {
    entity_type: 'project',
    entity_id: projectId,
    content: 'Note text',
    author: 'User Name'  // ❌ Backend can't use this
};
```

**Updated Code (Will Work):**
```javascript
const payload = {
    entity_type: 'project',
    entity_id: projectId,
    content: 'Note text'
    // No author field - backend uses JWT user ID
};
```

## Endpoints Tested

### ✅ Working (with caveats)
- Authentication: HMAC + X-Organization-ID header works
- Organization scoping: Correctly enforced

### ❌ Broken (schema mismatch)
- `POST /projects/{id}/notes` - Fails on `author` field
- `GET /projects/{id}/notes` - Fails on `entity_id` query
- All CRUD operations blocked by schema issues

### ⏭️ Not Tested
- `/api/notes/*` endpoints (require JWT auth, not just HMAC)

## Next Steps

1. **Backend Team:** Choose Option A or B
2. **Backend Team:** Implement transformation layer OR update OpenAPI spec
3. **Frontend Team:** Update `src/api/notes.js` based on backend decision
4. **Both Teams:** Re-run integration tests
5. **Both Teams:** Update documentation

## Testing Script

Run comprehensive backend verification:
```bash
node test-notes-backend-schema.js
```

## Full Documentation

See `NOTES_BACKEND_SCHEMA_VERIFICATION_REPORT.md` for complete details.

---

**Date:** 2026-01-15
**Severity:** CRITICAL - Blocks all notes functionality
**Impact:** Cannot create, read, update, or delete notes via backend API
