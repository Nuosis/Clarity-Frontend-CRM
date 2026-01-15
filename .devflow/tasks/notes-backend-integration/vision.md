# Notes Backend Integration - Vision

## Overview
Integrate the frontend notes functionality with the newly deployed backend notes API endpoints, transitioning from FileMaker-based storage to Supabase-backed API calls with HMAC authentication.

## Background
The backend team has implemented comprehensive notes API endpoints at `/api/notes` with full CRUD support, pagination, filtering, and organization scoping. The frontend currently uses FileMaker's `devNotes` layout for all note operations. This feature will migrate the frontend to use the new backend APIs.

## Goals
1. **Replace FileMaker calls** with backend API calls for all note operations
2. **Maintain feature parity** - all existing functionality continues to work
3. **Add support for new capabilities** - pagination, filtering, update/delete operations
4. **Ensure data consistency** - notes display correctly across projects, tasks, and customers
5. **Preserve UI/UX** - minimal user-facing changes to existing note interfaces

## Success Criteria
- ✅ Notes render correctly for projects and tasks
- ✅ Create note operation succeeds via backend API
- ✅ Update note operation works (new capability)
- ✅ Delete note operation works (new capability)
- ✅ Pagination handles large note lists (>50 notes)
- ✅ Error handling provides clear feedback
- ✅ All existing tests pass
- ✅ No FileMaker calls remain in notes code paths

## Technical Approach

### API Endpoints to Use
**Primary endpoints** (from OpenAPI spec):
- `GET /api/notes?project_id={id}&limit=50&offset=0` - List project notes
- `GET /api/notes?task_id={id}&limit=50&offset=0` - List task notes
- `GET /api/notes?customer_id={id}&limit=50&offset=0` - List customer notes
- `POST /api/notes` - Create note
- `PATCH /api/notes/{note_id}` - Update note
- `DELETE /api/notes/{note_id}` - Delete note

**Authentication**: All requests use HMAC-SHA256 via `dataService.generateBackendAuthHeader()`

### Data Model Mapping

**Backend Response Schema** (`NoteResponse`):
```json
{
  "id": "uuid",
  "org_id": "uuid",
  "note": "string",
  "type": "string",
  "customer_id": "uuid | null",
  "project_id": "uuid | null",
  "task_id": "uuid | null",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

**Frontend Internal Format** (current):
```javascript
{
  id: "uuid",
  recordId: "string", // REMOVE - FileMaker concept
  content: "string", // Map from backend "note"
  type: "string",
  createdAt: "datetime",
  modifiedAt: "datetime", // Map from backend "updated_at"
  createdBy: "string" // Currently not in backend schema
}
```

**Mapping Strategy**:
- `backend.note` → `frontend.content`
- `backend.created_at` → `frontend.createdAt`
- `backend.updated_at` → `frontend.modifiedAt`
- Remove `recordId` field (FileMaker artifact)
- Handle `createdBy` absence gracefully (may add to backend later)

### Pagination Strategy
- **Default**: Load 50 notes per page
- **Lazy loading**: Load more when user scrolls/clicks "Load More"
- **State management**: Track `hasMore`, `offset`, `loading` per entity
- **Implementation**: Add pagination state to `useNote` hook

### Files to Modify

#### 1. API Layer (`src/api/notes.js`)
**Current**: FileMaker CRUD operations
**New**: Backend API wrapper functions
- `fetchNotesByProject(projectId, limit=50, offset=0)`
- `fetchNotesByTask(taskId, limit=50, offset=0)`
- `fetchNotesByCustomer(customerId, limit=50, offset=0)`
- `createNote({ note, type, project_id?, task_id?, customer_id? })`
- `updateNote(noteId, { note?, type? })`
- `deleteNote(noteId)`

#### 2. Project API (`src/api/projects.js`)
**Update**: `fetchProjectNotes(projectId)`
- Call `fetchNotesByProject()` from notes.js
- Return processed data in expected format

#### 3. Task API (`src/api/tasks.js`)
**Update**: `fetchTaskNotes(taskId)`
- Call `fetchNotesByTask()` from notes.js
- Return processed data in expected format

#### 4. Service Layer (`src/services/noteService.js`)
**Update**: Data transformation logic
- `processNotes(backendResponse)` - Transform backend format to frontend format
- `createNewNote(entityType, entityId, noteContent, type)` - New signature
- Remove FileMaker-specific processing

#### 5. Hooks (`src/hooks/useNote.js`)
**Update**: Note operations hook
- Add pagination state
- Handle new API response format
- Add `handleNoteUpdate()` operation
- Add `handleNoteDelete()` operation
- Error handling for new error formats

#### 6. Components (minimal changes)
**Verify compatibility**:
- `src/components/projects/ProjectNotesTab.jsx`
- `src/components/tasks/TaskList.jsx`
- Update data access if field names changed

### Error Handling
**Backend Error Format** (from OpenAPI):
```json
{
  "detail": "Error message"
}
```

**Frontend Error Handling**:
- Map backend errors to user-friendly messages
- Display via SnackBar context
- Log full error details to console for debugging
- Graceful degradation for partial failures

### Testing Strategy
1. **Unit tests**: API functions, data transformation
2. **Integration tests**: End-to-end note CRUD flows
3. **Manual testing**:
   - Create note on project → verify display
   - Create note on task → verify display
   - Update note → verify changes persist
   - Delete note → verify removal
   - Pagination → verify "Load More" works
4. **Edge cases**:
   - Empty note lists
   - Large note lists (>200 notes)
   - Network errors
   - Invalid note IDs

## Dependencies
- ✅ Backend notes API endpoints deployed
- ✅ Notes table in Supabase with data migrated
- ✅ RLS policies applied
- ✅ HMAC authentication working

## Risks
1. **Data format mismatch** - Backend schema differs from requirements
   - Mitigation: Verify actual backend schema via API testing
2. **Missing `created_by` field** - Backend may not track author
   - Mitigation: Handle gracefully, may add later
3. **Pagination performance** - Large offset queries slow
   - Mitigation: Acceptable for MVP, can optimize later
4. **Breaking UI changes** - Field name changes break components
   - Mitigation: Maintain field name compatibility in service layer

## Out of Scope
- Realtime note updates (Supabase subscriptions)
- Rich text formatting
- Note attachments
- Advanced search/filtering UI
- Customer notes UI (API ready, UI deferred)

## Future Enhancements
- Add realtime subscriptions for collaborative editing
- Implement rich text editor
- Add file attachments to notes
- Build customer notes interface
- Add note templates and categories
- Implement note mentions (@user)
