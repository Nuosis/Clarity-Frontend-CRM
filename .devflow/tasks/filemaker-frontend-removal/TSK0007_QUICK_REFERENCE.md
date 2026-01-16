# TSK0007 Quick Reference - Notes API

**Status**: ✅ Complete (Already Implemented)

## API Endpoints

### Create Note
```javascript
import { createNote } from '../api/notes';

// Project note
await createNote({
  note: 'Note content',
  type: 'general',
  project_id: 'project-uuid'
});

// Task note
await createNote({
  note: 'Note content',
  type: 'general',
  task_id: 'task-uuid'
});

// Customer note
await createNote({
  note: 'Note content',
  type: 'general',
  customer_id: 'customer-uuid'
});
```

### Fetch Notes
```javascript
import { fetchNotesByProject, fetchNotesByTask, fetchNotesByCustomer } from '../api/notes';

// With pagination
const notes = await fetchNotesByProject('project-uuid', {
  limit: 50,
  offset: 0
});
```

### Update Note
```javascript
import { updateNote } from '../api/notes';

await updateNote('note-uuid', {
  note: 'Updated content',
  type: 'important'
});
```

### Delete Note
```javascript
import { deleteNote } from '../api/notes';

await deleteNote('note-uuid');
```

## Service Layer (Recommended)

```javascript
import {
  createNewNote,
  fetchNotesByProject,
  updateNoteById,
  deleteNoteById
} from '../services/noteService';

// Create (auto-transforms response)
const note = await createNewNote('project', 'project-uuid', 'Note content');

// Fetch (auto-transforms all notes)
const notes = await fetchNotesByProject('project-uuid');

// Update (auto-transforms response)
const updated = await updateNoteById('note-uuid', { content: 'New content' });

// Delete
await deleteNoteById('note-uuid');
```

## Data Transformation

### Backend Format (snake_case)
```json
{
  "id": "uuid",
  "note": "Content here",
  "type": "general",
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-01-15T10:00:00Z",
  "created_by": "user-uuid",
  "updated_by": null,
  "organization_id": "org-uuid",
  "project_id": "project-uuid",
  "customer_id": null,
  "task_id": null
}
```

### Frontend Format (camelCase)
```json
{
  "id": "uuid",
  "content": "Content here",
  "type": "general",
  "createdAt": "2026-01-15T10:00:00Z",
  "updatedAt": "2026-01-15T10:00:00Z",
  "createdBy": "user-uuid",
  "updatedBy": null,
  "organizationId": "org-uuid",
  "projectId": "project-uuid",
  "customerId": null,
  "taskId": null,
  "fieldData": {
    "__ID": "uuid",
    "note": "Content here"
  }
}
```

## Feature Flags

```javascript
// Already enabled in FeatureFlagContext.jsx
use_backend_project_notes: true,
use_backend_task_notes: true,
```

## Files Modified

- ✅ `src/api/notes.js` - Backend API client
- ✅ `src/services/noteService.js` - Data transformations
- ✅ `src/hooks/useNote.js` - State management
- ✅ `src/context/FeatureFlagContext.jsx` - Feature flags

## Key Patterns

### Environment-Aware Routing (via dataService)
```javascript
// notes.js
import { dataService } from '../services/dataService';

// dataService automatically handles:
// - FileMaker environment → FileMaker bridge
// - Web app environment → Backend API
const response = await dataService.post('/projects/123/notes', payload);
```

### Multi-Entity Support
```javascript
// Exactly ONE foreign key must be provided
const payload = {
  note: 'Content',
  type: 'general',
  project_id: 'uuid',  // OR
  customer_id: null,   // OR
  task_id: null        // OR
};
```

### Organization Scoping
```javascript
// Automatic via dataService
// X-Organization-ID header added from JWT claims
// No manual implementation needed
```

## Testing

### Build Verification
```bash
npm run build
# ✓ built in 2.51s
```

### Manual Testing
1. Start dev server: `npm run dev`
2. Navigate to project → Notes tab
3. Create/edit/delete notes
4. Verify display and functionality

## Documentation

- `docs/NOTES_BACKEND_INTEGRATION.md` - Full integration guide
- `TSK0007_COMPLETION_SUMMARY.md` - Completion details
- API comments in `src/api/notes.js` - Inline documentation

---
**Last Updated**: 2026-01-15
