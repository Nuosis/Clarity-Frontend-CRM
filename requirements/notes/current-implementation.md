# Notes Feature - Current Implementation

## Overview
Notes are text-based records attached to projects and tasks in Clarity CRM. They provide a way to capture customer communications, internal discussions, and important context throughout the project lifecycle.

## FileMaker Implementation

### Layout: devNotes
The notes feature uses the FileMaker layout `devNotes` as defined in `src/api/fileMaker.js:416`:

```javascript
export const Layouts = {
    NOTES: 'devNotes',
    // ... other layouts
};
```

### FileMaker Fields
Based on the API usage and service processing, the devNotes layout contains:

**Core Fields:**
- `__ID` - Unique identifier (primary key)
- `note` - The note content (text)
- `_fkID` - Foreign key to parent record (project or task)
- `type` - Note type/category (defaults to 'general')

**System Fields:**
- `~CreationTimestamp` - When the note was created
- `~ModificationTimestamp` - When the note was last modified
- `~CreatedBy` - User who created the note

### Data Relationships
Notes are polymorphic - they can be attached to multiple entity types via the `_fkID` field:
- **Projects**: `_fkID` contains the project's `recordId`
- **Tasks**: `_fkID` contains the task's `__ID`

The relationship is established through query filtering rather than explicit FileMaker relationships.

## Frontend Architecture

### API Layer

#### File: `src/api/notes.js`
Provides the foundational API for note operations.

**Functions:**
- `createNote(data)` - Creates a new note record
  - Parameters: `{ note, fkId, type }`
  - Returns: FileMaker response with new `recordId`
  - Location: `src/api/notes.js:8-24`

**Example Usage:**
```javascript
const params = {
    layout: Layouts.NOTES,
    action: Actions.CREATE,
    fieldData: {
        note: data.note,
        _fkID: data.fkId,
        type: data.type || 'general'
    }
};
```

#### File: `src/api/projects.js`
Provides project-specific note retrieval.

**Functions:**
- `fetchProjectNotes(projectId)` - Fetches all notes for a project
  - Query: `[{ "_fkID": projectId }]`
  - Location: `src/api/projects.js:47-57`

#### File: `src/api/tasks.js`
Provides task-specific note retrieval.

**Functions:**
- `fetchTaskNotes(taskId)` - Fetches all notes for a task
  - Query: `[{ "_fkID": taskId }]`
  - Location: `src/api/tasks.js:286-298`

### Service Layer

#### File: `src/services/noteService.js`
Business logic layer for note operations.

**Functions:**
1. `createNewNote(fkId, note, type)` - Validates and creates a note
   - Validates: `fkId` and `note.trim()` are required
   - Trims note content before saving
   - Defaults type to 'general'
   - Location: `src/services/noteService.js:10-20`

2. `processNotes(data)` - Transforms raw FileMaker data to frontend format
   - Maps FileMaker fields to frontend structure
   - Sorts by creation date (newest first)
   - Location: `src/services/noteService.js:27-41`

**Data Transformation:**
```javascript
// FileMaker format
{
    fieldData: {
        __ID: "123",
        note: "Note content",
        ~CreationTimestamp: "2024-01-10 10:30:00",
        ~CreatedBy: "user@example.com"
    },
    recordId: "456"
}

// Frontend format
{
    id: "123",
    recordId: "456",
    content: "Note content",
    createdAt: "2024-01-10 10:30:00",
    createdBy: "user@example.com"
}
```

#### File: `src/services/taskService.js`
Task-specific note processing.

**Functions:**
- `loadTaskDetails(taskId)` - Loads all task data including notes
  - Uses Promise.all for parallel fetching
  - Location: `src/services/taskService.js:35-47`

- `processTaskNotes(data)` - Transforms task notes data
  - Includes type field mapping
  - Sorts by creation date (newest first)
  - Location: `src/services/taskService.js:207-223`

**Extended Data Transformation:**
```javascript
// Processed task note
{
    id: note.fieldData.__ID,
    recordId: note.recordId,
    content: note.fieldData.note,
    type: note.fieldData.type || 'general',
    createdAt: note.fieldData['~CreationTimestamp'],
    modifiedAt: note.fieldData['~ModificationTimestamp'],
    createdBy: note.fieldData['~CreatedBy']
}
```

### Hooks Layer

#### File: `src/hooks/useNote.js`
React hook for note CRUD operations.

**State Management:**
- `loading` - Boolean flag for async operations
- `error` - Error message from failed operations

**Operations:**
- `handleNoteCreate(fkId, noteContent, type)` - Creates a note with UI feedback
  - Validates inputs before calling service
  - Shows error snackbar on failure
  - Returns processed note object or null
  - Location: `src/hooks/useNote.js:13-43`

**Return Value:**
```javascript
{
    loading,          // Boolean
    error,            // String or null
    handleNoteCreate, // Function
    clearError        // Function
}
```

#### File: `src/hooks/useProject.js`
Project hook that integrates notes loading.

**Functions:**
- `loadProjectDetails(projectId)` - Loads project data including notes
  - Fetches from `devNotes` layout with project filter
  - Stores raw notes data in project state
  - Location: `src/hooks/useProject.js:95-136`

**Integration Pattern:**
```javascript
const [images, links, objectives, steps, notes] = await Promise.all([
    fetchProjectRelatedData([projectId], 'devProjectImages'),
    fetchProjectRelatedData([projectId], 'devProjectLinks'),
    fetchProjectRelatedData([projectId], 'devProjectObjectives'),
    fetchProjectRelatedData([projectId], 'devProjectObjSteps'),
    fetchProjectRelatedData([projectId], 'devNotes')
]);

const processedNotes = notes.response?.data || [];
```

#### File: `src/hooks/useTask.js`
Task hook that manages task notes state.

**State Management:**
- `taskNotes` - Array of notes for selected task
- Updated when task is selected via `handleTaskSelect`

**Functions:**
- `handleTaskSelect(taskId)` - Loads task and its notes
  - Calls `loadTaskDetails(taskId)` from taskService
  - Updates `taskNotes` state with processed notes
  - Location: `src/hooks/useTask.js:80-105`

## UI Components

### ProjectNotesTab Component

#### File: `src/components/projects/ProjectNotesTab.jsx`
Displays and manages notes for a project.

**Props:**
- `project` - Project object with notes array
  - `project.recordId` - Used for creating new notes
  - `project.notes` - Array of note objects
- `darkMode` - Boolean for theme styling

**Features:**
1. **Display Notes** - Shows existing notes in cards
   - Location: `src/components/projects/ProjectNotesTab.jsx:45-58`
   - Format: `note.fieldData.note`
   - Sorted by creation date (newest first)

2. **Create Note** - "New Note" button with inline form
   - Location: `src/components/projects/ProjectNotesTab.jsx:16-23`
   - Uses `TextInput` component for input
   - Calls `handleNoteCreate(project.recordId, noteContent)`
   - Reloads project details after creation

3. **Empty State** - Shows when no notes exist
   - Location: `src/components/projects/ProjectNotesTab.jsx:60-62`
   - Message: "No notes added yet"

**User Flow:**
1. User clicks "New Note" button
2. Inline text input appears
3. User enters note content and clicks "Create"
4. `handleNoteCreate` called with project recordId
5. On success, project details reloaded
6. Input form hidden, new note appears in list

**Data Format:**
```javascript
// Expected note structure in project.notes
{
    fieldData: {
        __ID: "123",
        note: "Note content"
    }
}
```

### TaskList Component

#### File: `src/components/tasks/TaskList.jsx`
Container component managing task display and operations.

**Notes Integration:**
- Location: `src/components/tasks/TaskList.jsx:344-560`
- Manages `taskNotes` state from useTask hook
- Passes `handleCreateNote` to TaskItem components
- Provides note creation callback wrapped with task refresh

**Callback Flow:**
```javascript
const handleCreateNote = useCallback(async (fkId, noteContent) => {
    const result = await handleNoteCreate(fkId, noteContent);
    if (result) {
        await handleTaskSelect(fkId); // Refresh task details
    }
    return result;
}, [handleNoteCreate, handleTaskSelect]);
```
Location: `src/components/tasks/TaskList.jsx:386-398`

### TaskItem Component

#### File: `src/components/tasks/TaskList.jsx`
Individual task display with expandable details section.

**Props:**
- `task` - Task object
- `taskNotes` - Array of notes for this task
- `handleCreateNote` - Function to create new note

**Notes Display:**
- Location: `src/components/tasks/TaskList.jsx:108-131`
- Shows when task is expanded and notes exist
- Displays in scrollable container (max-height: 105px)
- Format: `note.content` (processed format)

**Notes Creation:**
- Location: `src/components/tasks/TaskList.jsx:167-177`
- "New Note" button in expanded section
- Inline TextInput component for entry
- Location: `src/components/tasks/TaskList.jsx:201-217`

**User Flow:**
1. User expands task (clicks arrow)
2. Task details load via `onExpand(task.id)`
3. Notes display in "Notes" section if any exist
4. User clicks "New Note" button
5. TextInput component appears inline
6. User enters note and clicks "Create"
7. `handleCreateNote(task.id, note)` called
8. Task details refresh via `onExpand(task.id)`
9. TextInput hidden, new note appears

**Data Display:**
```javascript
<div className="space-y-2">
    {taskNotes.map(note => (
        <p key={note.id} className="text-sm pl-2 border-l-2">
            {note.content}
        </p>
    ))}
</div>
```

## Current Data Flow

### Creating a Note (Project)

1. **User Action**: Click "New Note" in ProjectNotesTab
2. **Component**: Show TextInput component
3. **User Input**: Enter note content, click "Create"
4. **Hook**: `useNote.handleNoteCreate(project.recordId, noteContent)`
   - Validates input
   - Calls `noteService.createNewNote()`
5. **Service**: `noteService.createNewNote(fkId, note, 'general')`
   - Validates and trims content
   - Calls `api/notes.createNote()`
6. **API**: `notes.createNote({ note, fkId, type })`
   - Sends to FileMaker `devNotes` layout
   - Action: CREATE
7. **Response**: FileMaker returns `{ response: { recordId } }`
8. **Reload**: `useProject.loadProjectDetails(project.recordId)`
   - Fetches updated notes from devNotes
9. **Update**: Component re-renders with new note

### Creating a Note (Task)

1. **User Action**: Expand task, click "New Note" in TaskItem
2. **Component**: Show TextInput component
3. **User Input**: Enter note content, click "Create"
4. **Callback**: `TaskList.handleCreateNote(task.id, note)`
5. **Hook**: `useNote.handleNoteCreate(task.id, noteContent)`
   - Same validation and service call as project
6. **Service/API**: Same flow as project notes
7. **Reload**: `useTask.handleTaskSelect(task.id)`
   - Calls `taskService.loadTaskDetails(task.id)`
   - Fetches notes via `fetchTaskNotes(task.id)`
8. **Processing**: `taskService.processTaskNotes(data)`
9. **State**: Updates `taskNotes` state in useTask
10. **Update**: Component re-renders with new note

### Loading Notes (Project)

1. **Trigger**: Project selection or details refresh
2. **Hook**: `useProject.loadProjectDetails(projectId)`
3. **API**: Parallel fetch including:
   ```javascript
   fetchProjectRelatedData([projectId], 'devNotes')
   ```
4. **Query**: FileMaker query `[{ "_fkID": projectId }]`
5. **Storage**: Raw notes stored as `project.notes`
6. **Display**: ProjectNotesTab accesses `project.notes`
7. **Format**: Uses FileMaker structure directly:
   ```javascript
   note.fieldData.note
   note.fieldData.__ID
   ```

### Loading Notes (Task)

1. **Trigger**: Task expansion via `handleTaskSelect(taskId)`
2. **Hook**: `useTask.handleTaskSelect(taskId)`
3. **Service**: `taskService.loadTaskDetails(taskId)`
4. **API**: `fetchTaskNotes(taskId)` with query `[{ "_fkID": taskId }]`
5. **Processing**: `taskService.processTaskNotes(data)`
   - Maps to frontend format
   - Sorts by creation date
6. **State**: Updates `taskNotes` in useTask hook
7. **Propagation**: Passed as prop to TaskItem components
8. **Display**: Renders processed format:
   ```javascript
   note.content
   note.id
   note.createdAt
   ```

## Current CRUD Operations

### Create (Supported)
- **API**: `createNote(data)` in `src/api/notes.js`
- **Service**: `createNewNote(fkId, note, type)` in `src/services/noteService.js`
- **Hook**: `handleNoteCreate(fkId, noteContent, type)` in `src/hooks/useNote.js`
- **UI**: Available in ProjectNotesTab and TaskItem components

### Read (Supported)
- **API**:
  - `fetchProjectNotes(projectId)` in `src/api/projects.js`
  - `fetchTaskNotes(taskId)` in `src/api/tasks.js`
- **Service**:
  - `processNotes(data)` in `src/services/noteService.js`
  - `processTaskNotes(data)` in `src/services/taskService.js`
- **Hook**: Integrated into `useProject` and `useTask` hooks
- **UI**: Displayed in ProjectNotesTab and TaskItem components

### Update (Not Supported)
- No edit functionality exists in current implementation
- Notes cannot be modified after creation

### Delete (Not Supported)
- No delete functionality exists in current implementation
- Notes are permanent once created

## Data Access Patterns

### Query Pattern
All note queries use the same FileMaker pattern:
```javascript
{
    layout: Layouts.NOTES,  // 'devNotes'
    action: Actions.READ,
    query: [{ "_fkID": parentId }]  // Project or task ID
}
```

### Filtering
- **Client-side**: No additional filtering after FileMaker query
- **Server-side**: FileMaker filters by `_fkID` field
- **Sorting**: Client-side sort by creation date (newest first)

### Caching
- **Projects**: Notes cached in project state until refresh
- **Tasks**: Notes cached in `taskNotes` state per selected task
- **Invalidation**: Manual refresh when new note created

## Error Handling

### Validation Errors
- Missing `fkId`: "Task ID and note content are required"
- Empty note content: Trimmed and validated
- Location: `src/services/noteService.js:11-13`

### API Errors
- FileMaker operation failures caught and logged
- Error displayed via SnackBar context
- Location: `src/hooks/useNote.js:35-38`

### User Feedback
- Loading states during creation
- Error messages via snackbar notifications
- Success indicated by new note appearing in list

## Integration Points

### With Projects
- Notes displayed in ProjectNotesTab
- Loaded with project details
- Attached via project `recordId`
- Location: `src/components/projects/ProjectNotesTab.jsx`

### With Tasks
- Notes displayed in expanded TaskItem
- Loaded when task selected
- Attached via task `__ID`
- Location: `src/components/tasks/TaskList.jsx`

### With Users
- Creator tracked via `~CreatedBy` system field
- Displayed in processed notes (task notes only)
- No explicit user relationship in data model

### With Organizations
- No organization scoping in current implementation
- All users see all notes for entities they can access
- Relies on FileMaker permissions

## Performance Considerations

### Loading Strategy
- **Lazy Loading**: Notes loaded when project/task details viewed
- **Parallel Fetching**: Notes fetched with other related data (Promise.all)
- **No Pagination**: All notes loaded at once

### Current Limitations
- No limit on notes per entity
- No pagination for large note lists
- Entire note content loaded (no truncation)
- Re-fetches all notes on every refresh

## UI/UX Patterns

### Consistency
- Both project and task notes use TextInput component
- Similar visual styling (cards with borders)
- Consistent "New Note" button placement

### Dark Mode Support
- All note components support dark mode
- Color scheme defined via props
- Conditional CSS classes based on `darkMode` prop

### Accessibility
- Semantic HTML structure
- Text inputs with placeholders
- Error messages announced via snackbar

## Known Issues & Limitations

1. **No Edit Capability**: Notes cannot be modified after creation
2. **No Delete Capability**: Notes are permanent
3. **No Rich Text**: Plain text only
4. **No Attachments**: Cannot attach files to notes
5. **Limited Metadata**: Only creation timestamp and user tracked
6. **Data Format Inconsistency**:
   - Project notes use raw FileMaker format (`note.fieldData.note`)
   - Task notes use processed format (`note.content`)
7. **No Search/Filter**: Cannot search within notes
8. **No Categories**: Type field exists but not used in UI
9. **No Organization Scoping**: No RLS or organization boundaries
10. **No Versioning**: No edit history or audit trail

## Migration Considerations

### Data Preservation Required
- All existing notes must be migrated
- Preserve creation timestamps and creators
- Maintain parent relationships (project/task)

### Feature Parity Goals
- Match or exceed current functionality
- Add edit and delete capabilities
- Implement organization scoping
- Support rich text formatting
- Add search and filtering

### Breaking Changes Expected
- Data format standardization needed
- API contract changes for CRUD operations
- RLS policies will restrict cross-org access

## Code References

### API Layer
- `src/api/notes.js` - Core notes API
- `src/api/projects.js:47-57` - Project notes query
- `src/api/tasks.js:286-298` - Task notes query
- `src/api/fileMaker.js:416` - Layout definition

### Service Layer
- `src/services/noteService.js` - Note business logic
- `src/services/taskService.js:35-47` - Task details loading
- `src/services/taskService.js:207-223` - Task notes processing

### Hook Layer
- `src/hooks/useNote.js` - Note operations hook
- `src/hooks/useProject.js:95-136` - Project details with notes
- `src/hooks/useTask.js:80-105` - Task selection with notes

### Component Layer
- `src/components/projects/ProjectNotesTab.jsx` - Project notes UI
- `src/components/tasks/TaskList.jsx:108-131` - Task notes display
- `src/components/tasks/TaskList.jsx:201-217` - Task notes creation

## Summary

The current notes implementation is a simple, read-mostly system built on FileMaker's devNotes layout. It provides basic create and read functionality for both projects and tasks through a polymorphic foreign key relationship. The system lacks edit/delete capabilities, organization scoping, and advanced features like search or rich text. Migration to Supabase will require data format standardization, implementation of full CRUD operations, and addition of RLS policies for multi-tenancy support.
