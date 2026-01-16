# Notes Feature - UI Workflows and Render Decision Logic

## Overview

This document describes the conditional rendering patterns, state-dependent UI, and branching logic for the Notes feature across project and task contexts. The Notes feature renders differently based on loading states, data availability, pagination state, edit mode, and dark mode theme.

---

## 1. Render Decision Tree

### ProjectNotesTab Component Decision Flow

```mermaid
flowchart TD
    Start[ProjectNotesTab Entry] --> CheckNewNoteInput{showNewNoteInput?}
    CheckNewNoteInput -->|true| RenderTextInputModal[Render TextInput Modal]
    CheckNewNoteInput -->|false| SkipModal[Skip Modal]

    SkipModal --> CheckNotesExist{allNotes.length > 0?}
    CheckNotesExist -->|false| RenderEmptyState[Render Empty State: "No notes added yet"]
    CheckNotesExist -->|true| RenderNotesList[Render Notes List]

    RenderNotesList --> ForEachNote[For Each Note]
    ForEachNote --> CheckEditingState{editingNoteId === noteId?}

    CheckEditingState -->|true| RenderEditMode[Render Edit Mode]
    CheckEditingState -->|false| RenderDisplayMode[Render Display Mode]

    RenderEditMode --> CheckLoadingInEdit{noteLoading?}
    CheckLoadingInEdit -->|true| DisableEditControls[Disable Save/Cancel Buttons]
    CheckLoadingInEdit -->|false| EnableEditControls[Enable Save/Cancel Buttons]

    RenderDisplayMode --> CheckMetadata{noteAuthor OR noteCreatedAt?}
    CheckMetadata -->|true| ShowMetadata[Show Author/Date Line]
    CheckMetadata -->|false| HideMetadata[Hide Metadata Line]

    ShowMetadata --> CheckPagination{pagination.hasMore?}
    CheckMetadata --> CheckPagination
    HideMetadata --> CheckPagination

    CheckPagination -->|true| ShowLoadMoreButton[Show "Load More Notes" Button]
    CheckPagination -->|false| HideLoadMoreButton[Hide Load More Button]

    ShowLoadMoreButton --> CheckLoadingOnPagination{noteLoading?}
    CheckLoadingOnPagination -->|true| DisableLoadMore[Disable & Show "Loading..."]
    CheckLoadingOnPagination -->|false| EnableLoadMore[Enable & Show "Load More Notes"]

    RenderEmptyState --> EndRender[End Render]
    HideLoadMoreButton --> EndRender
    DisableLoadMore --> EndRender
    EnableLoadMore --> EndRender
```

### TaskItem Component Decision Flow (Notes Section)

```mermaid
flowchart TD
    TaskStart[TaskItem Expand Triggered] --> CheckExpanded{isExpanded?}
    CheckExpanded -->|false| HideDetails[Hide Task Details - max-h-0]
    CheckExpanded -->|true| ShowDetails[Show Task Details - max-h-96]

    ShowDetails --> CheckTaskLoading{isLoading?}
    CheckTaskLoading -->|true| ShowLoadingText[Show "Loading task details..."]
    CheckTaskLoading -->|false| CheckTaskNotes{taskNotes.length > 0?}

    CheckTaskNotes -->|false| SkipNotesSection[Skip Notes Section]
    CheckTaskNotes -->|true| RenderTaskNotesSection[Render Notes Section]

    RenderTaskNotesSection --> ForEachTaskNote[For Each Note]
    ForEachTaskNote --> CheckTaskNoteEditState{editingNoteId === note.id?}

    CheckTaskNoteEditState -->|true| RenderTaskNoteEdit[Render Textarea Edit Mode]
    CheckTaskNoteEditState -->|false| RenderTaskNoteDisplay[Render Display with Hover Controls]

    RenderTaskNoteDisplay --> CheckHover[Group Hover State]
    CheckHover --> ShowEditDeleteButtons[Show Edit/Delete - opacity-0 to opacity-100 on hover]

    RenderTaskNotesSection --> CheckTaskNotesPagination{notesPagination.hasMore?}
    CheckTaskNotesPagination -->|true| ShowTaskLoadMore[Show "Load More Notes" Button]
    CheckTaskNotesPagination -->|false| HideTaskLoadMore[Hide Load More]

    ShowTaskLoadMore --> CheckTaskNotesLoading{notesLoading?}
    CheckTaskNotesLoading -->|true| DisableTaskLoadMore[Disable & Show "Loading..."]
    CheckTaskNotesLoading -->|false| EnableTaskLoadMore[Enable & Show "Load More Notes"]

    SkipNotesSection --> CheckNewNoteInput{showNoteInput?}
    HideTaskLoadMore --> CheckNewNoteInput
    DisableTaskLoadMore --> CheckNewNoteInput
    EnableTaskLoadMore --> CheckNewNoteInput

    CheckNewNoteInput -->|true| RenderNewNoteInput[Render TextInput Modal]
    CheckNewNoteInput -->|false| SkipNewNoteInput[Skip Note Input]

    RenderNewNoteInput --> EndTaskRender[End Task Render]
    SkipNewNoteInput --> EndTaskRender
    HideDetails --> EndTaskRender
    ShowLoadingText --> EndTaskRender
```

---

## 2. Render Branch Table

### ProjectNotesTab Render Branches

| Condition | Component Rendered | Key Props | File:Line |
|-----------|-------------------|-----------|-----------|
| `showNewNoteInput === true` | `TextInput` modal | `title="Add Note"`, `onSubmit`, `onCancel` | ProjectNotesTab.jsx:102-123 |
| `allNotes.length === 0` | Empty state div | `"No notes added yet"` | ProjectNotesTab.jsx:243-247 |
| `allNotes.length > 0` | Notes list container | `space-y-4` | ProjectNotesTab.jsx:124-242 |
| `editingNoteId === noteId` | Textarea edit mode | `value={editContent}`, `disabled={noteLoading}` | ProjectNotesTab.jsx:143-178 |
| `editingNoteId !== noteId` | Display mode | Note content + Edit/Delete buttons | ProjectNotesTab.jsx:179-220 |
| `noteAuthor \|\| noteCreatedAt` | Metadata line | `"By {author} • {date}"` | ProjectNotesTab.jsx:212-218 |
| `pagination.hasMore === true` | "Load More" button | `onClick={handleLoadMore}`, `disabled={noteLoading}` | ProjectNotesTab.jsx:224-241 |
| `noteLoading === true` (on "New Note" button) | Button shows "Adding..." | `disabled={true}` | ProjectNotesTab.jsx:94-100 |
| `noteLoading === true` (on "Load More") | Button shows "Loading..." | `disabled={true}` | ProjectNotesTab.jsx:238 |
| `darkMode === true` | Dark theme styles | `bg-gray-800`, `border-gray-700`, `text-gray-300` | ProjectNotesTab.jsx:140, 150, etc. |
| `darkMode === false` | Light theme styles | `bg-white`, `border-gray-200`, `text-gray-700` | ProjectNotesTab.jsx:140, 152, etc. |

### TaskItem Render Branches (Notes)

| Condition | Component Rendered | Key Props | File:Line |
|-----------|-------------------|-----------|-----------|
| `isExpanded === false` | Collapsed view | `max-h-0 opacity-0` | TaskItem.jsx:106-109 |
| `isExpanded === true` | Expanded view | `max-h-96 opacity-100` | TaskItem.jsx:106-109 |
| `isLoading === true` | Loading text | `"Loading task details..."` | TaskItem.jsx:111-117 |
| `taskNotes.length > 0` | Notes section | Title + list + max-h-\[105px\] scrollable | TaskItem.jsx:120-250 |
| `editingNoteId === note.id` | Inline edit textarea | `value={editContent}`, 2 rows | TaskItem.jsx:132-177 |
| `editingNoteId !== note.id` | Display mode with hover controls | `opacity-0 group-hover:opacity-100` | TaskItem.jsx:178-227 |
| `notesPagination.hasMore === true` | "Load More" button | `onClick={handleLoadMoreNotes}` | TaskItem.jsx:231-248 |
| `notesLoading === true` | Load More shows "Loading..." | `disabled={true}` | TaskItem.jsx:242 |
| `showNoteInput === true` | `TextInput` modal | `title="Add Note"` | TaskItem.jsx:427-442 |
| `darkMode === true` | Dark theme styles | `bg-gray-700`, `text-gray-300` | TaskItem.jsx:139-141, etc. |
| `darkMode === false` | Light theme styles | `bg-white`, `text-gray-900` | TaskItem.jsx:142, etc. |

### TextInput Modal Render Branches

| Condition | Component Rendered | Key Props | File:Line |
|-----------|-------------------|-----------|-----------|
| Modal always renders as full-screen overlay | Fixed overlay + centered modal | `fixed inset-0 bg-black bg-opacity-50 z-50` | TextInput.jsx:24 |
| `!text.trim()` (empty input) | Submit button disabled | `disabled={true}`, `opacity-50 cursor-not-allowed` | TextInput.jsx:59-63 |
| `text.trim()` (valid input) | Submit button enabled | `hover:bg-primary-hover` | TextInput.jsx:62 |
| `darkMode === true` | Dark theme modal | `bg-gray-800`, `bg-gray-700`, `text-white` | TextInput.jsx:28, 38 |
| `darkMode === false` | Light theme modal | `bg-white`, `border-gray-300`, `text-gray-900` | TextInput.jsx:28, 39 |

---

## 3. Derived State

### ProjectNotesTab Component

| Variable | Computation Logic | Controls | Source |
|----------|-------------------|----------|--------|
| `pagination` | `getPagination('project', project.id)` from `useNote` hook | Whether "Load More" button renders; initial pagination state | ProjectNotesTab.jsx:23 |
| `allNotes` | Initialized from `project.notes`, updated by `handleLoadMore` appending | Which render branch: empty state vs notes list | ProjectNotesTab.jsx:9, 26-30, 36-38 |
| `noteId` | `note.id \|\| note.fieldData?.__ID` | Key for React list rendering; determines which note is being edited | ProjectNotesTab.jsx:128 |
| `noteContent` | `note.content \|\| note.fieldData?.note` | Displayed note text in both edit and display modes | ProjectNotesTab.jsx:129 |
| `noteAuthor` | `note.author \|\| note.createdBy` | Metadata line visibility and content | ProjectNotesTab.jsx:130 |
| `noteCreatedAt` | `note.createdAt \|\| note.created_at` | Metadata line visibility and content | ProjectNotesTab.jsx:131 |
| `isEditing` | `editingNoteId === noteId` | Whether note renders in edit mode or display mode | ProjectNotesTab.jsx:133 |
| `pagination.hasMore` | Derived from backend API response (notes.length >= limit) | Whether "Load More" button renders | useNote.js:174 |

### TaskItem Component

| Variable | Computation Logic | Controls | Source |
|----------|-------------------|----------|--------|
| `notesPagination` | `selectedTask ? getPagination('task', selectedTask.id) : null` | "Load More" button visibility in task notes | TaskList.jsx:654 |
| `allTaskNotes` | State synced with `taskNotes` from hook via `useEffect` | Which notes display in expanded task view | TaskList.jsx:656-661 |
| `isExpanded` | Local state toggled by chevron button | Whether task details section is visible | TaskItem.jsx:37, 46-52 |
| `isEditing` (note) | `editingNoteId === note.id` | Inline edit mode vs display mode | TaskItem.jsx:131 |
| `isEditingLink` | `editingLinkId === link.id` | Link edit mode vs display mode | TaskItem.jsx:263 |
| `task.isCompleted` | Prop from parent | Whether "Start Timer" button shows | TaskItem.jsx:89 |

### useNote Hook

| Variable | Computation Logic | Controls | Source |
|----------|-------------------|----------|--------|
| `loading` | Set during async operations (`handleNoteCreate`, `handleFetchNotes`, etc.) | Button disabled states, loading text display | useNote.js:9, 88, 150, etc. |
| `error` | Set when operations fail | Error messages (handled by SnackBar context) | useNote.js:10, 102, etc. |
| `paginationByEntity` | Object keyed by `"{entityType}-{entityId}"` | Pagination state isolated per entity instance | useNote.js:13, 23-31 |
| `currentPagination` | `getPagination(entityType, entityId)` in `handleFetchNotes` | Calculates next offset for "Load More" | useNote.js:153 |
| `offset` | `fetchOptions.append ? currentPagination.offset + currentPagination.limit : 0` | Which page of notes to fetch | useNote.js:156 |

---

## 4. Loading & Error States

### Loading States

**ProjectNotesTab:**
- **`noteLoading === true` on "New Note" button**: Button text changes from "New Note" to "Adding...", button disabled (ProjectNotesTab.jsx:97-99)
- **`noteLoading === true` on "Load More" button**: Button text changes to "Loading...", button disabled with `opacity-50 cursor-not-allowed` (ProjectNotesTab.jsx:238, 235)
- **`noteLoading === true` in edit mode**: Save/Cancel buttons disabled, textarea disabled (ProjectNotesTab.jsx:155, 160, 167)

**TaskItem:**
- **`isLoading === true` in expanded task**: Shows `"Loading task details..."` text instead of notes/links/timer sections (TaskItem.jsx:111-117)
- **`notesLoading === true` on "Load More" button**: Button shows "Loading...", disabled state (TaskItem.jsx:242-243)
- **Hook-level `loading` from `useNote`**: Propagated up through `TaskList` and passed to `TaskItem` (TaskList.jsx:651)

**TextInput Modal:**
- No explicit loading state - relies on parent component disabling the trigger button

### Empty States

**ProjectNotesTab:**
- **No notes exist** (`allNotes.length === 0`): Centered text `"No notes added yet"` with gray styling (ProjectNotesTab.jsx:243-247)
- **Styling varies by theme**: Dark mode uses `text-gray-400`, light mode uses `text-gray-500`

**TaskItem:**
- **No notes exist** (`taskNotes.length === 0`): Notes section is completely skipped (not rendered) (TaskItem.jsx:120-250)
- **No links exist** (`taskLinks.length === 0`): Links section is skipped (TaskItem.jsx:251-370)
- **No timer records** (`timerRecords.length === 0`): Timer summary section is skipped (TaskItem.jsx:372-391)

**TaskSection:**
- **No tasks in section** (`!tasks?.length`): Centered empty state box with message (e.g., "No active tasks") (TaskList.jsx:524-535)
- **Styling varies by theme**: Dark mode uses `bg-gray-800 border-gray-700 text-gray-400`, light mode uses `bg-gray-50 border-gray-200 text-gray-500`

### Error Handling

**useNote Hook Error Pattern:**
- Errors caught in try/catch blocks in all CRUD operations (create, fetch, update, delete)
- `error` state variable set with error message
- `showError(errorMessage)` called to display SnackBar notification
- Error logged to console with context (useNote.js:101-104, 181-184, 228-232, 262-266)

**Component-level Error Handling:**
- **ProjectNotesTab**: Wraps async operations in try/catch, logs to console (ProjectNotesTab.jsx:109-117, 62-71, 80-87)
- **TaskItem**: Uses SnackBar context `showError()` for user feedback (TaskItem.jsx:44, 96, 154, 211, etc.)
- **TaskList**: Error boundary wrapper applied at export (TaskList.jsx:930-936)

### Skeleton/Placeholder Patterns

**No skeleton loaders implemented** - the Notes feature uses:
- Simple loading text states
- Button label changes ("Adding...", "Loading...")
- Disabled states with opacity changes
- Full component hide/show based on loading flags

---

## 5. User Role Variations

**Current Implementation: NO role-based access control for notes UI**

The Notes feature currently has **no user role differentiation** in the frontend UI. All notes operations (create, read, update, delete) are available to all authenticated users, subject to organization-scoped RLS policies enforced by the backend.

### Observations:

1. **No role checks in components**: Neither `ProjectNotesTab.jsx` nor `TaskItem.jsx` check user roles before rendering CRUD controls
2. **No role state in hooks**: `useNote.js` does not consume or check user role from `useAppState` or auth context
3. **Backend handles authorization**: All access control is enforced via:
   - JWT `organization_id` claim (ensures org-scoped access)
   - RLS policies on Supabase `notes` table (per authorization.md spec)
   - Backend API HMAC authentication
4. **User metadata tracked**: `created_by` and `updated_by` fields store user IDs from JWT, but do not restrict edit/delete operations in frontend

### Potential Future Role Variations (Not Currently Implemented):

If role-based UI control were added, expected variations might be:

| Role | Create | View All | Edit Own | Edit Any | Delete Own | Delete Any |
|------|--------|----------|----------|----------|------------|------------|
| Admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Manager | ✓ | ✓ | ✓ | ✓ | ✓ | ? |
| Member | ✓ | ✓ | ✓ | ? | ✓ | ? |
| Viewer | ? | ✓ | ? | ? | ? | ? |

**Notes:**
- Currently, all users see the same UI (Edit/Delete buttons always visible on notes)
- Authorization relies entirely on backend RLS + org scoping
- No "own vs any" distinction in current implementation

---

## 6. Re-render Triggers

### ProjectNotesTab Component

**Component re-renders when:**

1. **`project` prop changes** (reference equality check)
   - Source: Parent component passing new project object (ProjectNotesTab.jsx:253-271, PropTypes)
   - Effect: `useEffect` at line 26-30 updates `allNotes` state

2. **`darkMode` prop changes**
   - Source: AppLayout theme context (ProjectNotesTab.jsx:270)
   - Effect: Conditional CSS classes update across all rendered elements

3. **Local state changes:**
   - `showNewNoteInput` toggled (lines 95, 114, 120)
   - `allNotes` updated (lines 28, 37)
   - `editingNoteId` changed (lines 46, 51, 67)
   - `editContent` changed (line 47)

4. **Hook state changes:**
   - `noteLoading` from `useNote` (line 18)
   - `pagination` object from `useNote` (line 23)

5. **Parent forces re-render** after note operations:
   - `loadProjectDetails(project.id)` called after create/update/delete (lines 65, 83)
   - This fetches fresh project data including notes array

**React.memo optimization:**
- Component wrapped in `React.memo` (line 273)
- Re-renders prevented if `project` and `darkMode` props haven't changed (shallow comparison)

### TaskItem Component

**Component re-renders when:**

1. **Any prop changes** (extensive prop list, TaskItem.jsx:469-497):
   - `task`, `darkMode`, `onStatusChange`, `onExpand`
   - `taskNotes`, `taskLinks`, `timerRecords`
   - `isLoading`, handler functions
   - `notesPagination`, `notesLoading`

2. **Local state changes:**
   - `isExpanded` toggled (line 48)
   - `showNoteInput` toggled (lines 394, 436, 441)
   - `showLinkInput` toggled (lines 405, 453, 458)
   - `editingNoteId`, `editContent` (lines 151, 164, 191, 192)
   - `editingLinkId`, `editLinkUrl` (lines 286, 298, 332, 333)

3. **Hook context changes:**
   - `showError` from SnackBarContext (line 44)

4. **Callback dependency updates:**
   - `toggleExpand` callback recreated if `isExpanded` or `task.id` or `onExpand` change (line 53)

**React.memo optimization:**
- Component wrapped in `React.memo` with custom display name (line 16)
- Prevents re-renders if props haven't changed

### TaskList Component

**Component re-renders when:**

1. **Props change:**
   - `projectId`, `customerId`, `onTaskStatusChange`, `onTaskUpdate` (TaskList.jsx:600-605)

2. **AppState context changes:**
   - `darkMode` from `useTheme` (line 606)
   - `user`, `selectedProject` from `useAppState` (line 607)

3. **Hook state changes:**
   - `activeTasks`, `completedTasks` from `useTask` (line 631, 632)
   - `taskNotes`, `taskLinks`, `timerRecords` from `useTask` (lines 625-627)
   - `selectedTask`, `timer` from `useTask` (lines 629, 630)
   - `loading` from `useNote`, `useLink`, `useTask` (line 651)
   - `notesPagination` derived from `getPagination` (line 654)

4. **Local state changes:**
   - `showCompleted` toggled (line 879)
   - `showNewTaskForm` toggled (line 804, 819)
   - `editingTask` changed (line 789, 831)
   - `allTaskNotes` updated (line 659)

5. **Effect triggers:**
   - `taskNotes` changes trigger `allTaskNotes` sync (lines 657-661)

**React.memo optimization:**
- Component wrapped in `React.memo` at export (line 930)

### useNote Hook

**Hook triggers component re-renders via state changes:**

1. **`loading` state changes** (useNote.js:88, 107, 150, 186, etc.)
   - Set to `true` at start of operations
   - Set to `false` in `finally` blocks
   - Causes re-render in consuming components (button disabled states, etc.)

2. **`error` state changes** (lines 89, 151, 217, 254)
   - Set when operations fail
   - Not directly consumed by components (handled via SnackBar)

3. **`paginationByEntity` state changes** (lines 39-48)
   - Updated by `updatePagination` after fetch operations (line 171-176)
   - Causes `getPagination` to return new object → re-render if used in component

**Hook does NOT cause re-renders for:**
- Success responses (returned directly, not stored in state)
- Console logs
- SnackBar calls (handled by separate context)

### useProject Hook

**Hook triggers re-renders when notes are refreshed:**

1. **`loadProjectDetails(projectId)` called** (useProject.js:97-135)
   - Fetches project with nested notes from backend
   - Updates `projects` state array (lines 122-128)
   - Updates `selectedProject` if it matches (lines 366-368, 411-413, 506-507)

2. **ProjectNotesTab calls `loadProjectDetails` after CRUD operations:**
   - After create: line 113
   - After update: line 65
   - After delete: line 83

**Result:** Fresh notes array propagated to `ProjectNotesTab` via `project.notes` prop → component re-renders with new data

---

## Summary

The Notes feature uses a **state-driven conditional rendering approach** with clear branching logic:

1. **Loading states** control button labels and disabled states
2. **Empty states** show when no data exists (varies by context: project vs task)
3. **Edit mode** is controlled by local `editingNoteId` state (inline editing)
4. **Pagination** is managed per-entity in the `useNote` hook with "Load More" pattern
5. **Dark mode** affects all styling via conditional CSS classes
6. **No role-based UI variations** - all users see same controls (authorization enforced by backend)

Key patterns:
- **Dual data format support**: Components handle both backend API format (`note.content`, `note.createdAt`) and legacy FileMaker format (`note.fieldData.note`)
- **Per-entity pagination**: Each project/task has isolated pagination state
- **Hover-revealed controls**: Edit/Delete buttons appear on hover in task notes (opacity transitions)
- **Modal-based input**: All note creation uses `TextInput` modal overlay
- **Optimistic UI**: No optimistic updates - always refetch after mutations
