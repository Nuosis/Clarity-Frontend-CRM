# TSK0002: Update src/api/notes.js - Implementation Summary

**Date:** 2026-01-15
**Status:** ✅ COMPLETE
**Actual Effort:** 45 minutes

## Overview

Successfully updated `src/api/notes.js` to use backend API with HMAC authentication, replacing legacy FileMaker-only implementation. All functions now support dual-environment architecture (FileMaker + Backend API).

## Functions Implemented

### 1. `createNote(data)`
**Purpose:** Create a new note for project/customer/task

**Key Changes:**
- ✅ Accepts explicit foreign keys: `project_id`, `customer_id`, `task_id`
- ✅ Validates exactly ONE parent FK is provided (matches DB constraint)
- ✅ Uses `note` field (not `content`) in payload
- ✅ Removes unsupported `author` field (backend sets `created_by` from JWT)
- ✅ Automatically determines endpoint based on parent entity:
  - `/projects/{id}/notes`
  - `/tasks/{id}/notes`
  - `/customers/{id}/notes`

**Signature:**
```javascript
createNote({
  note: string,           // or 'content' (alias)
  project_id?: string,    // ONE of these required
  customer_id?: string,
  task_id?: string,
  type?: string          // default: 'general'
})
```

### 2. `fetchNotesByProject(projectId, options)`
**Purpose:** Fetch notes for a project with optional pagination

**Features:**
- ✅ Endpoint: `GET /projects/{project_id}/notes`
- ✅ Supports `limit` and `offset` query params
- ✅ FileMaker fallback maintained

**Signature:**
```javascript
fetchNotesByProject(projectId, { limit?, offset? })
```

### 3. `fetchNotesByTask(taskId, options)`
**Purpose:** Fetch notes for a task

**Features:**
- ✅ Endpoint: `GET /tasks/{task_id}/notes`
- ✅ Supports pagination
- ✅ FileMaker fallback maintained

### 4. `fetchNotesByCustomer(customerId, options)`
**Purpose:** Fetch notes for a customer

**Features:**
- ✅ Endpoint: `GET /customers/{customer_id}/notes`
- ✅ Supports pagination
- ✅ FileMaker fallback maintained

### 5. `updateNote(noteId, data)`
**Purpose:** Update an existing note

**Key Changes:**
- ✅ Uses PATCH (not PUT) for partial updates
- ✅ Endpoint: `PATCH /projects/notes/{note_id}`
- ✅ Supports updating `note` content and `type`
- ✅ Backend automatically sets `updated_by` from JWT

**Signature:**
```javascript
updateNote(noteId, {
  note?: string,        // or 'content' (alias)
  type?: string
})
```

### 6. `deleteNote(noteId)`
**Purpose:** Delete a note by ID

**Features:**
- ✅ Endpoint: `DELETE /projects/notes/{note_id}`
- ✅ FileMaker fallback maintained

### 7. `fetchProjectNotes(projectId, options)` (Legacy alias)
**Purpose:** Backward compatibility alias

**Note:** Deprecated, redirects to `fetchNotesByProject()`

## Database Schema Compliance

Implemented payload structure matches actual Supabase database schema:

```javascript
// Database columns
{
  id: uuid,
  organization_id: uuid,     // Set by backend from X-Organization-ID header
  note: text,                // NOT 'content'
  type: text,                // default: 'general'
  customer_id: uuid | null,  // Exactly ONE of these must be non-null
  project_id: uuid | null,
  task_id: uuid | null,
  created_by: uuid | null,   // Set by backend from JWT
  updated_by: uuid | null,   // Set by backend from JWT
  created_at: timestamp,
  updated_at: timestamp
}
```

## Authentication Flow

All backend API calls use `dataService` methods which automatically:

1. ✅ Add HMAC-SHA256 signature: `Authorization: Bearer {signature}.{timestamp}`
2. ✅ Add organization context: `X-Organization-ID: {org_id}`
3. ✅ Set Content-Type: `application/json`

**No manual auth headers required in API functions.**

## Validation Rules Implemented

1. ✅ **Parent Entity Validation:** Exactly ONE of (project_id, customer_id, task_id) must be provided
2. ✅ **Organization Scope Check:** Validates `supabaseOrgID` exists in environment context
3. ✅ **Parameter Validation:** Uses `validateParams()` for required parameters

## Error Handling

All functions:
- ✅ Throw descriptive errors for missing parameters
- ✅ Throw errors for missing organization context
- ✅ Throw errors when multiple parent FKs provided
- ✅ Propagate backend API errors to caller

## Backward Compatibility

- ✅ FileMaker environment detection via `getEnvironmentContext()`
- ✅ All functions maintain FileMaker code paths
- ✅ Legacy `fetchProjectNotes()` alias preserved
- ✅ Accepts both `note` and `content` field names (for gradual migration)

## Documentation

All functions include:
- ✅ Comprehensive JSDoc comments
- ✅ Parameter type annotations
- ✅ Return type documentation
- ✅ Schema constraint notes
- ✅ Backend behavior notes (e.g., `created_by` auto-population)

## Build Verification

✅ **Build Status:** SUCCESS
```
npm run build
✓ 1128 modules transformed.
dist/index.html  2,062.38 kB │ gzip: 607.55 kB
✓ built in 2.37s
```

## Critical Schema Insights (from TSK0001)

Based on backend verification, implemented payload structure avoids these known issues:

❌ **NOT USED:**
- `entity_type` / `entity_id` (polymorphic - doesn't exist in DB)
- `author` (string - DB uses `created_by` uuid)
- `content` field in request payload (DB column is `note`)

✅ **USED:**
- Explicit foreign keys: `project_id`, `customer_id`, `task_id`
- `note` field for content
- Organization context from header (not payload)
- User context from JWT (not payload)

## Next Steps (Dependent Tasks)

- ⏳ TSK0003: Update `src/api/projects.js` to use `fetchNotesByProject()`
- ⏳ TSK0004: Update `src/api/tasks.js` to use `fetchNotesByTask()`
- ⏳ TSK0005: Update `src/services/noteService.js` data transformation
- ⏳ TSK0006: Update `src/hooks/useNote.js` for backend operations

## Files Modified

- ✅ `src/api/notes.js` - Complete rewrite of all functions

## References

- Backend verification report: `NOTES_BACKEND_SCHEMA_VERIFICATION_REPORT.md`
- Database schema: `supabase-db` container, `public.notes` table
- OpenAPI spec: https://api.claritybusinesssolutions.ca/openapi.json
- Data service: `src/services/dataService.js`

---

**Task completed:** 2026-01-15T00:30:00Z
**Build verified:** ✅ SUCCESS
