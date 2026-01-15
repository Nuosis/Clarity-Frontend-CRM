# Update & Delete Notes Implementation Guide

## Quick Reference for Developers

### Architecture Overview

```
User Interface (Components)
    ↓
Handler Functions (Component callbacks)
    ↓
Hook Layer (useNote.js)
    ↓
Service Layer (noteService.js)
    ↓
API Layer (api/notes.js)
    ↓
Backend API (/projects/notes/{id})
```

---

## Update Note Implementation

### 1. Service Layer: `noteService.js`

```javascript
export async function updateNoteById(noteId, data) {
    if (!noteId) {
        throw new Error('Note ID is required');
    }

    if (!data || (!data.content && !data.note && !data.type)) {
        throw new Error('Update data is required (content or type)');
    }

    const result = await updateNote(noteId, data);
    return transformBackendNote(result);
}
```

**Purpose:** Validates input, calls API, transforms response
**Returns:** Normalized note object with camelCase fields

### 2. Hook Layer: `useNote.js`

```javascript
const handleNoteUpdate = useCallback(async (noteId, data) => {
    if (!noteId) {
        const errorMessage = 'Note ID is required';
        showError(errorMessage);
        return null;
    }

    if (!data || (!data.content && !data.note && !data.type)) {
        const errorMessage = 'Update data is required (content or type)';
        showError(errorMessage);
        return null;
    }

    try {
        setLoading(true);
        setError(null);

        const result = await updateNoteById(noteId, data);

        if (!result?.id) {
            throw new Error('Failed to update note: No ID returned');
        }

        console.log('[useNote] Note updated successfully:', { id: result.id });
        return result;
    } catch (err) {
        const errorMessage = err.response?.data?.message || err.message || 'Error updating note';
        setError(errorMessage);
        showError(errorMessage);
        console.error('[useNote] handleNoteUpdate error:', err);
        return null;
    } finally {
        setLoading(false);
    }
}, [showError]);
```

**Purpose:** User-facing wrapper with loading states and error handling
**Returns:** Note object on success, null on error

### 3. Component Layer: `ProjectNotesTab.jsx`

```javascript
// State
const [editingNoteId, setEditingNoteId] = useState(null);
const [editContent, setEditContent] = useState('');

// Handlers
const handleStartEdit = (noteId, currentContent) => {
    setEditingNoteId(noteId);
    setEditContent(currentContent);
};

const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditContent('');
};

const handleSaveEdit = async (noteId) => {
    if (!editContent.trim()) {
        return;
    }

    try {
        const result = await handleNoteUpdate(noteId, { content: editContent.trim() });
        if (result) {
            await loadProjectDetails(project.id);
            setEditingNoteId(null);
            setEditContent('');
        }
    } catch (error) {
        console.error('Error updating note:', error);
    }
};

// UI
const isEditing = editingNoteId === noteId;

{isEditing ? (
    <div className="space-y-2">
        <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full p-2 rounded border resize-none"
            rows={4}
            disabled={noteLoading}
        />
        <div className="flex gap-2">
            <button
                onClick={() => handleSaveEdit(noteId)}
                disabled={noteLoading || !editContent.trim()}
                className="px-3 py-1 bg-primary text-white rounded hover:bg-primary-hover disabled:opacity-50"
            >
                {noteLoading ? 'Saving...' : 'Save'}
            </button>
            <button
                onClick={handleCancelEdit}
                disabled={noteLoading}
                className="px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
            >
                Cancel
            </button>
        </div>
    </div>
) : (
    <div className="flex justify-between items-start">
        <p className="text-gray-700">{noteContent}</p>
        <div className="flex gap-2 ml-4">
            <button
                onClick={() => handleStartEdit(noteId, noteContent)}
                data-testid={`edit-note-${noteId}`}
            >
                Edit
            </button>
        </div>
    </div>
)}
```

---

## Delete Note Implementation

### 1. Service Layer: `noteService.js`

```javascript
export async function deleteNoteById(noteId) {
    if (!noteId) {
        throw new Error('Note ID is required');
    }

    return await deleteNote(noteId);
}
```

**Purpose:** Validates input and calls API
**Returns:** Deletion result from backend

### 2. Hook Layer: `useNote.js`

```javascript
const handleNoteDelete = useCallback(async (noteId) => {
    if (!noteId) {
        const errorMessage = 'Note ID is required';
        showError(errorMessage);
        return false;
    }

    try {
        setLoading(true);
        setError(null);

        await deleteNoteById(noteId);

        console.log('[useNote] Note deleted successfully:', { id: noteId });
        return true;
    } catch (err) {
        const errorMessage = err.response?.data?.message || err.message || 'Error deleting note';
        setError(errorMessage);
        showError(errorMessage);
        console.error('[useNote] handleNoteDelete error:', err);
        return false;
    } finally {
        setLoading(false);
    }
}, [showError]);
```

**Purpose:** User-facing wrapper with loading states and error handling
**Returns:** Boolean success status

### 3. Component Layer: `ProjectNotesTab.jsx`

```javascript
const handleDelete = async (noteId) => {
    if (!window.confirm('Are you sure you want to delete this note?')) {
        return;
    }

    try {
        const success = await handleNoteDelete(noteId);
        if (success) {
            await loadProjectDetails(project.id);
        }
    } catch (error) {
        console.error('Error deleting note:', error);
    }
};

// UI
<button
    onClick={() => handleDelete(noteId)}
    disabled={noteLoading}
    data-testid={`delete-note-${noteId}`}
>
    Delete
</button>
```

---

## Usage Examples

### Update a Project Note

```javascript
// In ProjectNotesTab component
const { handleNoteUpdate } = useNote();

// Update note content
await handleNoteUpdate(noteId, { content: 'Updated content' });

// Update note type
await handleNoteUpdate(noteId, { type: 'important' });

// Update both
await handleNoteUpdate(noteId, {
    content: 'Updated content',
    type: 'important'
});
```

### Delete a Project Note

```javascript
// In ProjectNotesTab component
const { handleNoteDelete } = useNote();

// Delete a note
const success = await handleNoteDelete(noteId);
if (success) {
    // Refresh data
    await loadProjectDetails(projectId);
}
```

### Update a Task Note

```javascript
// In TaskList component
const { handleNoteUpdate } = useNote();

const handleUpdateNote = useCallback(async (noteId, data) => {
    try {
        const result = await handleNoteUpdate(noteId, data);
        return result;
    } catch (error) {
        console.error('Error updating note:', error);
        throw error;
    }
}, [handleNoteUpdate]);

// Pass to TaskItem via TaskSection
<TaskSection
    handleUpdateNote={handleUpdateNote}
    // ... other props
/>
```

---

## API Reference

### `noteService.updateNoteById(noteId, data)`

**Parameters:**
- `noteId` (string, required) - UUID of the note
- `data` (object, required) - Update payload
  - `content` or `note` (string, optional) - New note content
  - `type` (string, optional) - Note type

**Returns:** `Promise<Object>` - Normalized note object

**Throws:**
- Error if noteId is missing
- Error if data is invalid
- Network errors from backend

### `noteService.deleteNoteById(noteId)`

**Parameters:**
- `noteId` (string, required) - UUID of the note

**Returns:** `Promise<Object>` - Deletion result

**Throws:**
- Error if noteId is missing
- Network errors from backend

### `useNote.handleNoteUpdate(noteId, data)`

**Parameters:**
- `noteId` (string, required) - UUID of the note
- `data` (object, required) - Update payload
  - `content` or `note` (string, optional) - New note content
  - `type` (string, optional) - Note type

**Returns:** `Promise<Object|null>` - Note object on success, null on error

**Side Effects:**
- Sets loading state
- Shows error in SnackBar on failure
- Logs to console

### `useNote.handleNoteDelete(noteId)`

**Parameters:**
- `noteId` (string, required) - UUID of the note

**Returns:** `Promise<boolean>` - true on success, false on error

**Side Effects:**
- Sets loading state
- Shows error in SnackBar on failure
- Logs to console

---

## Error Handling

### Common Error Cases

#### 1. Empty Content
```javascript
// Frontend validation prevents this
<button
    onClick={() => handleSaveEdit(noteId)}
    disabled={!editContent.trim()}
>
    Save
</button>
```

#### 2. Network Failure
```javascript
// Caught in hook, shown in SnackBar
try {
    const result = await updateNoteById(noteId, data);
} catch (err) {
    showError('Error updating note');
    console.error('[useNote] handleNoteUpdate error:', err);
}
```

#### 3. Invalid Note ID (404)
```javascript
// Backend returns 404, caught in hook
const errorMessage = err.response?.data?.message || 'Error updating note';
showError(errorMessage);
```

#### 4. Missing Organization Context (401/403)
```javascript
// Backend returns auth error, caught in hook
const errorMessage = err.response?.data?.message || 'Error updating note';
showError(errorMessage);
// User should re-authenticate
```

---

## Testing Checklist

### Update Note Testing
- [ ] Edit mode activates on "Edit" click
- [ ] Textarea shows current content
- [ ] Content can be modified
- [ ] Save button disabled when empty
- [ ] Save updates note immediately
- [ ] Changes persist after page refresh
- [ ] Cancel exits edit mode without saving
- [ ] Network errors show SnackBar message
- [ ] Loading state prevents duplicate requests

### Delete Note Testing
- [ ] Confirmation dialog appears
- [ ] Dialog can be cancelled
- [ ] Confirmation deletes note
- [ ] Note removed from UI immediately
- [ ] Deletion persists after page refresh
- [ ] Network errors show SnackBar message
- [ ] Last note delete shows empty state

---

## UI Patterns

### Hover-Revealed Buttons

```javascript
// Parent div
<div className="flex justify-between items-start">
    <p className="flex-1">{noteContent}</p>
    <div className="flex gap-2 ml-4">
        {/* Buttons always rendered but visible on hover */}
        <button>Edit</button>
        <button>Delete</button>
    </div>
</div>
```

**CSS:** Buttons are always in DOM, use opacity for reveal

### Inline Editing

```javascript
// Toggle between view and edit mode
{isEditing ? (
    <EditMode />
) : (
    <ViewMode />
)}
```

**Benefits:**
- No modal popup
- Context preserved
- Faster UX

### Confirmation Dialog

```javascript
if (!window.confirm('Are you sure you want to delete this note?')) {
    return;
}
// Proceed with delete
```

**Benefits:**
- No extra dependencies
- Familiar UX
- Keyboard accessible

---

## PropTypes Reference

### ProjectNotesTab
```javascript
PropTypes = {
    project: PropTypes.shape({
        id: PropTypes.string.isRequired,
        notes: PropTypes.arrayOf(PropTypes.shape({
            id: PropTypes.string,
            content: PropTypes.string,
            // ... other fields
        }))
    }).isRequired,
    darkMode: PropTypes.bool.isRequired
}
```

### TaskItem
```javascript
PropTypes = {
    task: PropTypes.shape({
        id: PropTypes.string.isRequired,
        // ... other fields
    }).isRequired,
    handleUpdateNote: PropTypes.func.isRequired,
    handleDeleteNote: PropTypes.func.isRequired,
    // ... other props
}
```

---

## Dark Mode Support

All UI elements support dark mode via conditional classes:

```javascript
<textarea
    className={`
        w-full p-2 rounded border resize-none
        ${darkMode
            ? 'bg-gray-700 border-gray-600 text-gray-200'
            : 'bg-white border-gray-300 text-gray-900'}
    `}
/>
```

---

## Performance Considerations

1. **Memoized Components:** TaskItem and TaskSection are memoized
2. **Debounced Operations:** Loading state prevents duplicate requests
3. **Optimized Re-fetches:** Only refresh affected entity
4. **No Re-renders on Hover:** CSS opacity, not React state
5. **Minimal State:** Only editingNoteId and editContent

---

## Accessibility (A11Y)

1. **Keyboard Navigation:** All buttons focusable
2. **Screen Readers:** Descriptive button text
3. **Focus Management:** Focus preserved during edit
4. **Color Contrast:** WCAG AA compliant
5. **Confirmation Dialogs:** Keyboard operable

---

## Common Issues and Solutions

### Issue: Save button not working
**Solution:** Check if content is empty (button should be disabled)

### Issue: Delete not removing note
**Solution:** Check if confirmation was accepted, verify network request

### Issue: Changes not persisting
**Solution:** Verify `loadProjectDetails()` or `handleTaskSelect()` is called after update

### Issue: Edit mode not exiting
**Solution:** Check if `setEditingNoteId(null)` is called after successful save

### Issue: Buttons not appearing on hover
**Solution:** Verify parent div has proper flex layout and button styling

---

## Further Reading

- [E2E_UPDATE_DELETE_TEST_PLAN.md](./E2E_UPDATE_DELETE_TEST_PLAN.md) - Comprehensive test cases
- [TSK0012_COMPLETION_SUMMARY.md](./TSK0012_COMPLETION_SUMMARY.md) - Implementation details
- [NOTES_BACKEND_INTEGRATION.md](../../docs/NOTES_BACKEND_INTEGRATION.md) - Overall architecture

---

**Document Version:** 1.0
**Last Updated:** 2026-01-15
**Status:** Complete
