# Notes Backend Integration - UI Workflows

## 1. Render Decision Tree

### Project Notes Tab Render Flow

```mermaid
flowchart TD
    Start[ProjectNotesTab Entry] --> CheckLoading{noteLoading?}
    CheckLoading -->|true| DisableButtons[Disable New Note button]
    CheckLoading -->|false| EnableButtons[Enable New Note button]

    DisableButtons --> CheckNewNoteForm{showNewNoteInput?}
    EnableButtons --> CheckNewNoteForm

    CheckNewNoteForm -->|true| RenderTextInput[Render TextInput component]
    CheckNewNoteForm -->|false| SkipTextInput[Skip TextInput]

    RenderTextInput --> CheckNotesList{allNotes.length > 0?}
    SkipTextInput --> CheckNotesList

    CheckNotesList -->|false| EmptyState[Render 'No notes added yet']
    CheckNotesList -->|true| RenderNotesList[Render notes list]

    RenderNotesList --> ForEachNote{For each note}
    ForEachNote --> CheckEditing{editingNoteId === noteId?}

    CheckEditing -->|true| RenderEditMode[Render textarea + Save/Cancel]
    CheckEditing -->|false| RenderViewMode[Render note content + Edit/Delete]

    RenderEditMode --> CheckSaveEnabled{editContent.trim() exists?}
    CheckSaveEnabled -->|true| EnableSave[Enable Save button]
    CheckSaveEnabled -->|false| DisableSave[Disable Save button]

    EnableSave --> CheckMetadata{noteAuthor OR noteCreatedAt exists?}
    DisableSave --> CheckMetadata
    RenderViewMode --> CheckMetadata

    CheckMetadata -->|true| RenderMetadata[Render author + date]
    CheckMetadata -->|false| SkipMetadata[Skip metadata]

    RenderMetadata --> CheckPagination{pagination.hasMore?}
    SkipMetadata --> CheckPagination

    CheckPagination -->|true| RenderLoadMore[Render Load More button]
    CheckPagination -->|false| EndRender[End render]

    RenderLoadMore --> EndRender

    style Start fill:#4CAF50
    style EmptyState fill:#FFC107
    style RenderNotesList fill:#2196F3
    style RenderEditMode fill:#FF9800
    style RenderViewMode fill:#03A9F4
    style RenderLoadMore fill:#9C27B0
    style EndRender fill:#4CAF50
```

### Task Notes Render Flow (within TaskItem)

```mermaid
flowchart TD
    TaskExpand[Task expanded] --> CheckLoading{isLoading?}
    CheckLoading -->|true| LoadingState[Show 'Loading task details...']
    CheckLoading -->|false| CheckTaskNotes{taskNotes.length > 0?}

    CheckTaskNotes -->|false| SkipNotes[Skip notes section]
    CheckTaskNotes -->|true| RenderNotesSection[Render Notes section]

    RenderNotesSection --> ForEachTaskNote{For each note}
    ForEachTaskNote --> CheckNoteEditing{editingNoteId === note.id?}

    CheckNoteEditing -->|true| RenderNoteEdit[Render textarea + Save/Cancel]
    CheckNoteEditing -->|false| RenderNoteView[Render note + hover buttons]

    RenderNoteEdit --> CheckSaveValid{editContent.trim() exists?}
    CheckSaveValid -->|true| EnableNoteSave[Enable Save]
    CheckSaveValid -->|false| DisableNoteSave[Disable Save]

    EnableNoteSave --> CheckTaskPagination{notesPagination.hasMore?}
    DisableNoteSave --> CheckTaskPagination
    RenderNoteView --> CheckTaskPagination

    CheckTaskPagination -->|true| ShowLoadMoreTask[Show Load More Notes button]
    CheckTaskPagination -->|false| CheckShowNoteInput{showNoteInput?}

    ShowLoadMoreTask --> CheckShowNoteInput
    CheckShowNoteInput -->|true| RenderNewNoteInput[Render TextInput for new note]
    CheckShowNoteInput -->|false| RenderActionButtons[Render New Note/New Link/Status buttons]

    RenderNewNoteInput --> End[End render]
    RenderActionButtons --> End
    LoadingState --> End
    SkipNotes --> End

    style TaskExpand fill:#4CAF50
    style LoadingState fill:#FFC107
    style RenderNotesSection fill:#2196F3
    style RenderNoteEdit fill:#FF9800
    style RenderNoteView fill:#03A9F4
    style ShowLoadMoreTask fill:#9C27B0
    style End fill:#4CAF50
```

## 2. Render Branch Table

### ProjectNotesTab Component

| Condition | Component Rendered | Key Props | File:Line |
|-----------|-------------------|-----------|-----------|
| `showNewNoteInput === true` | TextInput | `title="Add Note"`, `onSubmit`, `onCancel` | ProjectNotesTab.jsx:111-130 |
| `allNotes?.length === 0` | Empty state div | N/A | ProjectNotesTab.jsx:252-255 |
| `allNotes?.length > 0` | Notes list container | N/A | ProjectNotesTab.jsx:132-250 |
| `editingNoteId === noteId` (per note) | Edit mode textarea + buttons | `value={editContent}`, `disabled={noteLoading}` | ProjectNotesTab.jsx:151-186 |
| `editingNoteId !== noteId` (per note) | View mode note + actions | `onClick` handlers for edit/delete | ProjectNotesTab.jsx:188-228 |
| `noteAuthor OR noteCreatedAt exists` | Metadata section | Author name, formatted date | ProjectNotesTab.jsx:220-226 |
| `pagination.hasMore === true` | Load More button | `onClick={handleLoadMore}`, `disabled={noteLoading}` | ProjectNotesTab.jsx:232-249 |
| `noteLoading === true` (Save button) | "Saving..." text | N/A | ProjectNotesTab.jsx:171 |
| `noteLoading === false` (Save button) | "Save" text | N/A | ProjectNotesTab.jsx:171 |
| `noteLoading === true` (New Note button) | "Adding..." text | N/A | ProjectNotesTab.jsx:107 |
| `noteLoading === true` (Load More) | "Loading..." text | N/A | ProjectNotesTab.jsx:246 |
| `!editContent.trim()` | Disabled Save button | `disabled={true}` | ProjectNotesTab.jsx:168 |

### TaskItem Component (Notes Section)

| Condition | Component Rendered | Key Props | File:Line |
|-----------|-------------------|-----------|-----------|
| `isExpanded === false` | Collapsed state (max-height: 0) | `className` with opacity-0 | TaskItem.jsx:106-109 |
| `isExpanded === true` | Expanded state (max-height: 96) | `className` with opacity-100 | TaskItem.jsx:106-109 |
| `isLoading === true` | Loading message | "Loading task details..." | TaskItem.jsx:111-117 |
| `taskNotes?.length > 0` | Notes section | N/A | TaskItem.jsx:120-250 |
| `editingNoteId === note.id` (per note) | Edit mode textarea + buttons | `value={editContent}`, rows=2 | TaskItem.jsx:132-177 |
| `editingNoteId !== note.id` (per note) | View mode note + hover actions | Group hover for edit/delete | TaskItem.jsx:178-226 |
| `notesPagination?.hasMore === true` | Load More Notes button | `onClick={handleLoadMoreNotes}`, `disabled={notesLoading}` | TaskItem.jsx:231-248 |
| `showNoteInput === true` | TextInput for new note | `title="Add Note"`, `onSubmit`, `onCancel` | TaskItem.jsx:427-442 |
| `!editContent.trim()` | Disabled Save button | `disabled={true}` | TaskItem.jsx:157 |
| `notesLoading === true` | "Loading..." text (Load More) | N/A | TaskItem.jsx:245 |
| `!task.isCompleted` | Start Timer button visible | `onClick` handler | TaskItem.jsx:89-103 |
| `task.isCompleted` | No Start Timer button | N/A | TaskItem.jsx:89 |

### TaskList Component

| Condition | Component Rendered | Key Props | File:Line |
|-----------|-------------------|-----------|-----------|
| `showNewTaskForm === true` | TaskForm component | `projectId`, `customerId`, `onSubmit` | TaskList.jsx:821-829 |
| `editingTask !== null` | TaskForm for editing | `task={editingTask}`, `onSubmit` | TaskList.jsx:832-841 |
| `timer?.recordId && selectedTask` | TaskTimer component | `task={selectedTask}`, `timer={timer}` | TaskList.jsx:844-855 |
| `activeTasks present` | TaskSection for active | `tasks={activeTasks}`, `emptyMessage` | TaskList.jsx:858-881 |
| `completedTasks?.length > 0` | Show/Hide toggle button | `onClick={setShowCompleted}` | TaskList.jsx:884-896 |
| `showCompleted === true` | TaskSection for completed | `tasks={completedTasks}` | TaskList.jsx:898-923 |
| `!projectId OR !effectiveCustomerId` | Disabled New Task button | `disabled={true}` | TaskList.jsx:814 |

## 3. Derived State

### ProjectNotesTab Component

| Variable | Computation Logic | Controls | Source |
|----------|-------------------|----------|--------|
| `pagination` | `getPagination('project', project.id)` | Load More button visibility, offset/limit | useNote.js:23-31 |
| `noteId` | `note.id \|\| note.fieldData?.__ID` | Note key, edit/delete targeting | ProjectNotesTab.jsx:136 |
| `noteContent` | `note.content \|\| note.fieldData?.note` | Displayed note text | ProjectNotesTab.jsx:137 |
| `noteAuthor` | `note.author \|\| note.createdBy` | Author display in metadata | ProjectNotesTab.jsx:138 |
| `noteCreatedAt` | `note.createdAt \|\| note.created_at` | Date display in metadata | ProjectNotesTab.jsx:139 |
| `isEditing` | `editingNoteId === noteId` | Edit mode vs view mode render | ProjectNotesTab.jsx:141 |
| `allNotes` | Synced from `project.notes` via useEffect | Notes list rendering | ProjectNotesTab.jsx:27-38 |

### TaskItem Component

| Variable | Computation Logic | Controls | Source |
|----------|-------------------|----------|--------|
| `isExpanded` | Local state toggled by expand button | Visibility of task details | TaskItem.jsx:37 |
| `isEditing` | `editingNoteId === note.id` | Note edit mode vs view mode | TaskItem.jsx:131 |
| `isEditingLink` | `editingLinkId === link.id` | Link edit mode vs view mode | TaskItem.jsx:263 |
| `linkUrl` | `link.url \|\| link.link` | Link href attribute | TaskItem.jsx:261 |
| `displayText` | `link.title \|\| linkUrl` | Link text display | TaskItem.jsx:262 |
| `totalTime` | `formatDuration(timerRecords.reduce(...))` | Timer total display | TaskItem.jsx:379 |
| `timerStatus` | Check for `active` or `paused` in records | Timer status indicator color/text | TaskItem.jsx:381-387 |

### TaskList Component

| Variable | Computation Logic | Controls | Source |
|----------|-------------------|----------|--------|
| `effectiveCustomerId` | `customerId \|\| selectedProject?.customer_id \|\| selectedProject?._custID` | Task creation availability | TaskList.jsx:614 |
| `loading` | `taskLoading \|\| noteLoading \|\| linkLoading` | Global loading state | TaskList.jsx:652 |
| `notesPagination` | `getPagination('task', selectedTask.id)` | Load More visibility for task notes | TaskList.jsx:655 |
| `allTaskNotes` | Synced from `taskNotes` via useEffect | Task notes list rendering | TaskList.jsx:658-669 |

### useNote Hook

| Variable | Computation Logic | Controls | Source |
|----------|-------------------|----------|--------|
| `paginationByEntity` | Map keyed by `${entityType}-${entityId}` | Per-entity pagination state isolation | useNote.js:13 |
| `currentPagination` | `paginationByEntity[key] \|\| defaultPagination` | Offset/limit for fetch operations | useNote.js:23-31 |
| `entityType` | Signature detection: first param in enum OR default 'project' | API routing (project/task/customer) | useNote.js:67-78 |
| `fetchOptions.offset` | `append ? current.offset + current.limit : 0` | "Load More" pagination offset calculation | useNote.js:156 |

## 4. Loading & Error States

### Loading States

#### ProjectNotesTab
- **Global Loading**: `noteLoading` from `useNote` hook
  - Disables "New Note" button (line 105)
  - Shows "Adding..." text on button (line 107)
  - Disables edit textarea (line 163)
  - Shows "Saving..." on Save button (line 171)
  - Shows "Loading..." on Load More button (line 246)
  - Disables Load More button (line 236)

#### TaskItem
- **Task Detail Loading**: `isLoading` prop
  - Shows "Loading task details..." placeholder (line 111-117)
  - Prevents task detail rendering until loaded

- **Notes Loading**: `notesLoading` prop
  - Shows "Loading..." on Load More Notes button (line 245)
  - Disables Load More Notes button (line 235)

#### TaskList
- **Composite Loading**: `loading = taskLoading || noteLoading || linkLoading`
  - Passed to TaskSection as `isLoading` prop (line 868)
  - Controls task-level loading states

### Error States

#### Error Handling Pattern
All operations use SnackBar context for error display:

- **Create Note Error**:
  ```javascript
  catch (error) {
    showError('Error creating note');
    console.error('Error creating note:', error);
  }
  ```
  - Location: ProjectNotesTab.jsx:124, TaskItem.jsx:438

- **Update Note Error**:
  - Shows "Error updating note" via SnackBar
  - Location: ProjectNotesTab.jsx:78, TaskItem.jsx:154

- **Delete Note Error**:
  - Shows "Error deleting note" via SnackBar
  - Location: ProjectNotesTab.jsx:94, TaskItem.jsx:211

- **Load More Error**:
  - Console error only, no user notification
  - Location: ProjectNotesTab.jsx:48, TaskList.jsx:679

#### useNote Hook Error Handling
- Stores error in `error` state variable (useNote.js:10)
- Extracts message from `err.response?.data?.message || err.message`
- Shows via SnackBar: `showError(errorMessage)`
- Console logs full error for debugging
- Lines: 101-104, 199-202, 247-250, 280-283

### Empty States

#### ProjectNotesTab Empty State
- **Condition**: `allNotes?.length === 0` or falsy
- **Render**: Gray centered text "No notes added yet"
- **Styling**: Different colors for light/dark mode
- **Location**: ProjectNotesTab.jsx:252-255

#### TaskSection Empty State
- **Condition**: `!tasks?.length`
- **Render**: Gray bordered box with custom `emptyMessage` prop
- **Examples**: "No active tasks", "No completed tasks"
- **Location**: TaskList.jsx:524-535

#### Task Notes Empty State
- **Condition**: `taskNotes?.length === 0` or falsy
- **Render**: Notes section not rendered at all
- **Fallback**: Action buttons always visible (New Note/New Link)
- **Location**: TaskItem.jsx:120

### Skeleton/Placeholder Patterns

**No skeleton states used.** Loading states use:
1. Text messages ("Loading task details...")
2. Disabled buttons with loading text ("Adding...", "Saving...", "Loading...")
3. Opacity/cursor changes on disabled elements

## 5. User Role Variations

### No Explicit Role-Based Rendering

The Notes feature does **not** implement user role-based UI variations. All authenticated users see the same UI elements:

- All users can create, edit, delete notes
- No admin-only features
- No read-only user modes
- No permission checks in UI layer

### Implicit Organization Scoping

While not visible in UI, backend enforces organization scoping:
- **JWT Claims**: `organization_id` from authenticated user
- **RLS Policies**: Database-level filtering by organization
- **HMAC Auth**: All backend requests include org context
- **Impact**: Users only see notes for their organization

### User Context Variables

Available from `useAppState()` hook:
- `user.userID` - Used for task assignment (TaskList.jsx:825)
- `user.organization_id` - Not directly used in UI, passed via JWT
- No role field referenced in notes components

## 6. Re-render Triggers

### ProjectNotesTab Component

#### Props Changes
- `project.id` change → Re-sync notes, reset pagination (useEffect line 27)
- `project.notes` change → Update `allNotes` state (useEffect line 28)
- `darkMode` change → Re-render with new theme classes

#### State Changes
- `showNewNoteInput` → Toggle TextInput visibility
- `editingNoteId` → Switch note between view/edit mode
- `editContent` → Update textarea value
- `allNotes` → Re-render notes list
- `noteLoading` (from hook) → Update button states/text

#### Hook Subscriptions
- `useNote()` hook state changes:
  - `loading` → Button disabled states
  - `paginationByEntity` → Load More visibility

- `useProject()` hook (via parent):
  - `project` object updates after note operations

### TaskItem Component

#### Props Changes
- `task.id` change → Re-fetch task details on expand
- `taskNotes` change → Re-render notes section
- `taskLinks` change → Re-render links section
- `timerRecords` change → Update timer display
- `notesPagination` change → Toggle Load More button
- `notesLoading` change → Update Load More button state
- `isLoading` change → Toggle loading placeholder

#### State Changes
- `isExpanded` → Expand/collapse task details
- `showNoteInput` → Show/hide new note form
- `showLinkInput` → Show/hide new link form
- `editingNoteId` → Switch note edit mode
- `editContent` → Update note textarea
- `editingLinkId` → Switch link edit mode
- `editLinkUrl` → Update link input

### TaskList Component

#### Props Changes
- `projectId` change → Re-fetch all tasks via `useTask` hook
- `customerId` change → Affects task creation availability
- `onTaskStatusChange` callback change → Re-bind event handlers
- `onTaskUpdate` callback change → Re-bind event handlers

#### State Changes
- `showCompleted` → Toggle completed tasks section
- `showNewTaskForm` → Show/hide task creation form
- `editingTask` → Show/hide task edit form
- `allTaskNotes` → Re-render task notes in expanded items

#### Hook Subscriptions
- `useTask(projectId)`:
  - `activeTasks` → Re-render active section
  - `completedTasks` → Re-render completed section
  - `selectedTask` → Update expanded task state
  - `taskNotes` → Update `allTaskNotes` state
  - `timer` → Show/hide TaskTimer component
  - `loading` → Global loading state

- `useNote()`:
  - `loading` → Affects composite loading state
  - `paginationByEntity` → Per-task Load More visibility

- `useLink()`:
  - `loading` → Affects composite loading state

- `useAppState()`:
  - `selectedProject` → Derives `effectiveCustomerId`
  - `user` → Used for staffId in task creation

### useNote Hook

#### Re-render Triggers for Consumers
- `loading` state change → Button disabled states
- `error` state change → Error display
- `paginationByEntity` state change → Load More visibility

#### Internal State Updates
- `handleNoteCreate()` → Sets `loading`, clears `error`
- `handleFetchNotes()` → Sets `loading`, updates `paginationByEntity`
- `handleNoteUpdate()` → Sets `loading`, clears `error`
- `handleNoteDelete()` → Sets `loading`, clears `error`
- `updatePagination()` → Updates `paginationByEntity` map

## 7. Conditional Rendering Anti-Patterns Avoided

### Good Patterns Used

1. **Memoization**: Components wrapped in `React.memo()` (TaskItem, TaskSection, TaskList)
   - Prevents unnecessary re-renders when parent updates

2. **Stable References**: `useCallback()` for all event handlers
   - Prevents child re-renders due to function identity changes

3. **Progressive Disclosure**: Hover states for edit/delete buttons
   - Reduces visual clutter, improves UX

4. **Dual-Format Support**: Backward compatible field accessors
   - `note.content || note.fieldData?.note`
   - Supports both backend API and legacy FileMaker formats

5. **Per-Entity Pagination**: Map-based pagination state
   - `paginationByEntity['project-123']`
   - Enables multiple simultaneous note lists without conflicts

6. **Signature Flexibility**: Dual-signature function support
   - New: `handleNoteCreate(entityType, entityId, content, type)`
   - Legacy: `handleNoteCreate(entityId, content, type)`
   - Enables incremental migration without breaking changes

### Potential Optimizations

1. **Virtualization**: No virtualization for long note lists
   - Currently loads all fetched notes into DOM
   - Could use `react-window` for 200+ notes

2. **Optimistic Updates**: Not implemented
   - All operations wait for server response
   - Could immediately update UI, rollback on error

3. **Debouncing**: No debouncing on pagination
   - Rapid "Load More" clicks could cause duplicate requests
   - Could add debounce to `handleLoadMore`

4. **Error Boundaries**: Only used at TaskList root
   - Individual note render errors could crash entire list
   - Could wrap each note in error boundary
