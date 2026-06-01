# Notes API Endpoint Correction Guide

## Quick Reference

### Current (Broken) vs. Correct Endpoints

| Operation | Entity | Current (❌ Broken) | Correct (✅ Working) |
|-----------|--------|-------------------|-------------------|
| Create note | Task | `POST /tasks/{id}/notes` | `POST /api/notes` with `task_id` in body |
| Create note | Customer | `POST /customers/{id}/notes` | `POST /api/notes` with `customer_id` in body |
| Create note | Project | `POST /projects/{id}/notes` | Works ✅ OR use `POST /api/notes` |
| Fetch notes | Task | `GET /tasks/{id}/notes` | `GET /api/notes?task_id={id}` |
| Fetch notes | Customer | `GET /customers/{id}/notes` | `GET /api/notes?customer_id={id}` |
| Fetch notes | Project | `GET /projects/{id}/notes` | Works ✅ OR use `GET /api/notes?project_id={id}` |
| Update note | Any | `PATCH /projects/notes/{id}` | `PATCH /api/notes/{id}` |
| Delete note | Any | `DELETE /projects/notes/{id}` | `DELETE /api/notes/{id}` |

---

## Code Changes Required

### File: `src/api/notes.js`

#### 1. Fix `createNote()` Function (Lines 154-165)

**Before**:
```javascript
// Use appropriate endpoint based on parent entity
let endpoint;
if (projectId) {
    endpoint = `/projects/${projectId}/notes`;
} else if (taskId) {
    endpoint = `/tasks/${taskId}/notes`;  // ❌ 404 - Doesn't exist
} else if (customerId) {
    endpoint = `/customers/${customerId}/notes`;  // ❌ 404 - Doesn't exist
}

const response = await dataService.post(endpoint, payload);
```

**After**:
```javascript
// Use generic /api/notes endpoint (supports all entity types)
const response = await dataService.post('/api/notes', payload);
```

**Rationale**: The generic endpoint accepts `project_id`, `task_id`, or `customer_id` in the request body and routes appropriately.

---

#### 2. Fix `fetchNotesByTask()` Function (Line 230)

**Before**:
```javascript
const response = await dataService.get(`/tasks/${taskId}/notes`, { params: queryParams });
// ❌ Returns 404 - /tasks/{id}/notes endpoint doesn't exist
```

**After**:
```javascript
const response = await dataService.get('/api/notes', {
    params: {
        task_id: taskId,
        ...queryParams  // includes limit, offset
    }
});
```

**Backend API Support**: `GET /api/notes?task_id={uuid}&limit={n}&offset={n}`

---

#### 3. Fix `fetchNotesByCustomer()` Function (Line 263)

**Before**:
```javascript
const response = await dataService.get(`/customers/${customerId}/notes`, { params: queryParams });
// ❌ Returns 404 - /customers/{id}/notes endpoint doesn't exist
```

**After**:
```javascript
const response = await dataService.get('/api/notes', {
    params: {
        customer_id: customerId,
        ...queryParams  // includes limit, offset
    }
});
```

**Backend API Support**: `GET /api/notes?customer_id={uuid}&limit={n}&offset={n}`

---

#### 4. (Optional) Update `fetchNotesByProject()` for Consistency (Line 197)

**Current** (works but inconsistent):
```javascript
const response = await dataService.get(`/projects/${projectId}/notes`, { params: queryParams });
// ✅ Works - this endpoint exists
```

**Recommended** (for consistency):
```javascript
const response = await dataService.get('/api/notes', {
    params: {
        project_id: projectId,
        ...queryParams  // includes limit, offset
    }
});
```

**Rationale**: Using the same endpoint for all entity types simplifies maintenance and ensures consistent behavior.

---

#### 5. Update `updateNote()` Function (Line 333)

**Before**:
```javascript
const response = await dataService.patch(`/projects/notes/${noteId}`, payload);
```

**After**:
```javascript
const response = await dataService.patch(`/api/notes/${noteId}`, payload);
```

**Backend API Support**: `PATCH /api/notes/{note_id}`

---

#### 6. Update `deleteNote()` Function (Line 359)

**Before**:
```javascript
const response = await dataService.delete(`/projects/notes/${noteId}`);
```

**After**:
```javascript
const response = await dataService.delete(`/api/notes/${noteId}`);
```

**Backend API Support**: `DELETE /api/notes/{note_id}`

---

## Backend API Specification

### Endpoint: `POST /api/notes`

**Purpose**: Create a note attached to any entity (project, task, or customer)

**Authentication**: HTTPBearer (JWT)

**Request Body**:
```json
{
  "note": "Note content here",
  "type": "general",  // optional, defaults to "general"
  "project_id": "uuid",  // ONE of these three required
  "task_id": "uuid",     // (mutually exclusive)
  "customer_id": "uuid"  //
}
```

**Response** (201 Created):
```json
{
  "id": "uuid",
  "organization_id": "uuid",
  "note": "Note content here",
  "type": "general",
  "project_id": "uuid",
  "task_id": null,
  "customer_id": null,
  "created_by": "uuid",
  "updated_by": null,
  "created_at": "2026-01-24T...",
  "updated_at": "2026-01-24T..."
}
```

---

### Endpoint: `GET /api/notes`

**Purpose**: List notes with optional filtering and pagination

**Authentication**: HTTPBearer (JWT)

**Query Parameters**:
- `project_id` (uuid, optional) - Filter by project
- `task_id` (uuid, optional) - Filter by task
- `customer_id` (uuid, optional) - Filter by customer
- `type` (string, optional) - Filter by note type
- `created_after` (datetime, optional) - Filter by creation date
- `created_before` (datetime, optional) - Filter by creation date
- `search` (string, optional) - Search note content
- `limit` (integer, 1-200, default 50) - Max results per page
- `offset` (integer, ≥0, default 0) - Pagination offset

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "uuid",
      "organization_id": "uuid",
      "note": "Note content",
      "type": "general",
      "project_id": "uuid",
      "task_id": null,
      "customer_id": null,
      "created_by": "uuid",
      "updated_by": null,
      "created_at": "2026-01-24T...",
      "updated_at": "2026-01-24T..."
    }
  ],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0,
    "has_more": true
  }
}
```

---

### Endpoint: `PATCH /api/notes/{note_id}`

**Purpose**: Update note content or type

**Authentication**: HTTPBearer (JWT)

**Request Body**:
```json
{
  "note": "Updated content",  // optional
  "type": "important"         // optional
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "note": "Updated content",
  "type": "important",
  "updated_by": "uuid",
  "updated_at": "2026-01-24T...",
  ...
}
```

---

### Endpoint: `DELETE /api/notes/{note_id}`

**Purpose**: Hard delete a note

**Authentication**: HTTPBearer (JWT)

**Response**: 204 No Content

---

## Authentication

All `/api/notes/*` endpoints use **HTTPBearer (JWT)** authentication, NOT HMAC.

The JWT token is automatically included by `dataService` if the user is authenticated.

**Organization Scoping**: The `organization_id` is automatically extracted from the JWT claims by the backend. No need to include it in request bodies or headers.

**User Tracking**: `created_by` and `updated_by` are automatically set from the JWT token by the backend.

---

## Testing Commands

### Test Create Note (Task)
```bash
curl -X POST https://api.claritybusinesssolutions.ca/api/notes \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "note": "Test note for task",
    "type": "general",
    "task_id": "TASK_UUID_HERE"
  }'
```

### Test Fetch Notes (Customer)
```bash
curl -X GET "https://api.claritybusinesssolutions.ca/api/notes?customer_id=CUSTOMER_UUID&limit=10&offset=0" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test Update Note
```bash
curl -X PATCH https://api.claritybusinesssolutions.ca/api/notes/NOTE_UUID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "note": "Updated note content"
  }'
```

### Test Delete Note
```bash
curl -X DELETE https://api.claritybusinesssolutions.ca/api/notes/NOTE_UUID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Implementation Checklist

- [ ] Update `createNote()` to use `POST /api/notes`
- [ ] Update `fetchNotesByTask()` to use `GET /api/notes?task_id=`
- [ ] Update `fetchNotesByCustomer()` to use `GET /api/notes?customer_id=`
- [ ] Update `fetchNotesByProject()` to use `GET /api/notes?project_id=` (optional)
- [ ] Update `updateNote()` to use `PATCH /api/notes/{id}`
- [ ] Update `deleteNote()` to use `DELETE /api/notes/{id}`
- [ ] Test create note for all entity types
- [ ] Test fetch notes for all entity types
- [ ] Test update note
- [ ] Test delete note
- [ ] Update `docs/NOTES_BACKEND_INTEGRATION.md` with correct endpoints
- [ ] Add JSDoc comments explaining endpoint choices

---

## Benefits of This Approach

1. **Single Source of Truth**: One endpoint (`/api/notes`) for all entity types
2. **Consistent Authentication**: All operations use JWT (no HMAC complexity)
3. **Flexible Filtering**: Query parameters support complex filtering
4. **Simpler Code**: No conditional logic for entity-specific paths
5. **Future-Proof**: Easy to add new entity types (e.g., proposals, contracts)
6. **Better Error Handling**: Consistent error responses across all operations
7. **Pagination Support**: Built-in pagination with `limit` and `offset`

---

## Related Documentation

- Original requirements: `requirements/notes/api-contracts.md`
- Backend integration guide: `docs/NOTES_BACKEND_INTEGRATION.md`
- Migration plan: `requirements/notes/migration-plan.md`
- OpenAPI spec: `https://api.claritybusinesssolutions.ca/openapi.json`
