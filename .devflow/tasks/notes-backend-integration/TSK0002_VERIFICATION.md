# TSK0002 Verification Checklist

**Task:** Update src/api/notes.js with backend API functions
**Date:** 2026-01-15
**Status:** ✅ COMPLETE

## Code Quality Verification

### ✅ Function Signatures Match Requirements
- [x] `createNote(data)` - Accepts explicit FKs
- [x] `fetchNotesByProject(projectId, options)` - With pagination
- [x] `fetchNotesByTask(taskId, options)` - With pagination
- [x] `fetchNotesByCustomer(customerId, options)` - With pagination
- [x] `updateNote(noteId, data)` - Partial updates
- [x] `deleteNote(noteId)` - By ID
- [x] `fetchProjectNotes(projectId, options)` - Legacy alias

### ✅ Backend Integration
- [x] Uses `dataService.post()` for CREATE
- [x] Uses `dataService.get()` for READ
- [x] Uses `dataService.patch()` for UPDATE
- [x] Uses `dataService.delete()` for DELETE
- [x] HMAC auth added automatically via interceptors
- [x] X-Organization-ID header added automatically

### ✅ Database Schema Compliance
- [x] Uses explicit foreign keys (project_id, customer_id, task_id)
- [x] Does NOT use polymorphic entity_type/entity_id
- [x] Uses 'note' field (not 'content') in payload
- [x] Does NOT send 'author' field (backend sets created_by)
- [x] Validates exactly ONE parent FK provided
- [x] Checks organization scope before create

### ✅ Error Handling
- [x] No catch blocks that swallow errors
- [x] All errors throw with descriptive messages
- [x] Parameter validation via `validateParams()`
- [x] Organization scope validation
- [x] Parent FK validation (exactly one required)
- [x] No silent failures detected

### ✅ Backward Compatibility
- [x] FileMaker environment detection
- [x] FileMaker code paths maintained
- [x] Legacy function names preserved
- [x] Accepts both 'note' and 'content' fields

### ✅ Documentation
- [x] Comprehensive JSDoc for all functions
- [x] Parameter types documented
- [x] Return types documented
- [x] Schema constraints noted
- [x] Backend behavior documented

### ✅ Build Verification
- [x] Project builds successfully
- [x] No import errors
- [x] No syntax errors
- [x] No TypeScript errors (strict mode)

## Endpoint Verification

### Backend API Endpoints Used (All Verified)
```
POST   /projects/{project_id}/notes     ✅ Matches backend
POST   /tasks/{task_id}/notes           ✅ Matches backend
POST   /customers/{customer_id}/notes   ✅ Matches backend
GET    /projects/{project_id}/notes     ✅ Matches backend
GET    /tasks/{task_id}/notes           ✅ Matches backend
GET    /customers/{customer_id}/notes   ✅ Matches backend
PATCH  /projects/notes/{note_id}        ✅ Matches backend
DELETE /projects/notes/{note_id}        ✅ Matches backend
```

**Source:** NOTES_BACKEND_SCHEMA_VERIFICATION_REPORT.md (TSK0001)

## Data Flow Verification

### Create Note - Golden Path
```javascript
// Frontend call
createNote({
  note: "Test note",
  project_id: "uuid-1234",
  type: "general"
})

// Transforms to backend request
POST /projects/uuid-1234/notes
Headers: {
  Authorization: Bearer {hmac-signature}.{timestamp}
  X-Organization-ID: {org-uuid}
  Content-Type: application/json
}
Body: {
  note: "Test note",
  type: "general",
  project_id: "uuid-1234",
  customer_id: null,
  task_id: null
}

// Backend automatically adds:
// - organization_id (from header)
// - created_by (from JWT)
// - created_at (timestamp)
// - updated_at (timestamp)
```

### Fetch Notes - Golden Path
```javascript
// Frontend call
fetchNotesByProject("uuid-1234", { limit: 10, offset: 0 })

// Transforms to backend request
GET /projects/uuid-1234/notes?limit=10&offset=0
Headers: {
  Authorization: Bearer {hmac-signature}.{timestamp}
  X-Organization-ID: {org-uuid}
}

// Backend returns array of notes
[
  {
    id: "note-uuid",
    organization_id: "org-uuid",
    note: "Test note",
    type: "general",
    project_id: "uuid-1234",
    customer_id: null,
    task_id: null,
    created_by: "user-uuid",
    updated_by: null,
    created_at: "2026-01-15T...",
    updated_at: "2026-01-15T..."
  }
]
```

### Update Note - Golden Path
```javascript
// Frontend call
updateNote("note-uuid", {
  note: "Updated content",
  type: "important"
})

// Transforms to backend request
PATCH /projects/notes/note-uuid
Headers: {
  Authorization: Bearer {hmac-signature}.{timestamp}
  X-Organization-ID: {org-uuid}
  Content-Type: application/json
}
Body: {
  note: "Updated content",
  type: "important"
}

// Backend automatically updates:
// - updated_by (from JWT)
// - updated_at (timestamp)
```

### Delete Note - Golden Path
```javascript
// Frontend call
deleteNote("note-uuid")

// Transforms to backend request
DELETE /projects/notes/note-uuid
Headers: {
  Authorization: Bearer {hmac-signature}.{timestamp}
  X-Organization-ID: {org-uuid}
}

// Backend returns deletion confirmation
```

## Edge Cases Handled

### ✅ Multiple Parent FKs
```javascript
createNote({
  note: "Test",
  project_id: "uuid-1",
  customer_id: "uuid-2"  // ERROR!
})
// Throws: "Only one of project_id, customer_id, or task_id should be provided"
```

### ✅ No Parent FK
```javascript
createNote({
  note: "Test"
  // Missing all parent FKs
})
// Throws: "One of project_id, customer_id, or task_id is required for creating notes"
```

### ✅ Missing Organization Context
```javascript
// When env.authentication.user.supabaseOrgID is null
createNote({ note: "Test", project_id: "uuid-1" })
// Throws: "Organization context required for creating notes. Please authenticate."
```

### ✅ FileMaker Environment Fallback
```javascript
// When env.type === ENVIRONMENT_TYPES.FILEMAKER
createNote({ note: "Test", project_id: "uuid-1" })
// Routes to FileMaker bridge via handleFileMakerOperation()
```

## Security Verification

### ✅ No Hardcoded Secrets
- [x] No API keys in code
- [x] No hardcoded tokens
- [x] No credentials in comments

### ✅ HMAC Authentication
- [x] All backend calls use dataService (auto HMAC)
- [x] No manual auth header construction
- [x] Timestamp included in signature

### ✅ Organization Scoping
- [x] Organization ID validated before create
- [x] Organization ID sent via header
- [x] RLS policies enforced by backend

### ✅ Input Validation
- [x] Required parameters validated
- [x] Parent FK constraints validated
- [x] No SQL injection vectors
- [x] No XSS vectors

## Standing Constraints Compliance

- [x] **HMAC Auth:** All backend calls use dataService with auto HMAC
- [x] **Backward Compatible:** FileMaker paths maintained
- [x] **No FileMaker in Webapp:** Environment detection works
- [x] **Error Logging:** All errors throw (not swallowed)
- [x] **Service Layer:** Data transformation will be in noteService (TSK0005)
- [x] **Pagination:** Supported via options param
- [x] **No 'author' Field:** Omitted from payload per schema report

## Not Yet Tested (Requires Runtime Environment)

The following cannot be verified without a running environment:
- ⏳ Actual HMAC signature generation
- ⏳ Backend API response format
- ⏳ JWT token extraction
- ⏳ RLS policy enforcement
- ⏳ Database constraint validation

**These will be tested in TSK0010, TSK0011, TSK0012 (E2E testing)**

## Known Limitations (By Design)

1. **No JWT Auth Support:** Functions only work with HMAC (SharedSecretBearer). The `/api/notes` endpoints (JWT auth) are not supported.

2. **Single Endpoint for Update/Delete:** Uses `/projects/notes/{id}` regardless of parent entity type. Backend routing handles this correctly.

3. **No GET by ID Function:** Not required by current use cases. Can be added if needed.

4. **No Batch Operations:** Create/update/delete work on single notes only.

## Artifacts Generated

- ✅ `src/api/notes.js` - Updated with 7 functions
- ✅ `TSK0002_IMPLEMENTATION_SUMMARY.md` - Implementation details
- ✅ `TSK0002_VERIFICATION.md` - This verification checklist

## Next Task Ready

✅ **TSK0003** can now proceed - `fetchNotesByProject()` is ready to import

---

**Verification completed:** 2026-01-15
**All checks passed:** ✅ YES
**Ready for E2E testing:** ✅ YES (after TSK0005-TSK0008)
