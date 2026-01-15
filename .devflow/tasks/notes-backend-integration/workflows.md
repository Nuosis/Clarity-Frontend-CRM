# Notes Backend Integration - Workflows

## High-Level Migration Flow

```mermaid
graph TD
    A[Start: FileMaker Notes] --> B[Verify Backend API]
    B --> C[Update API Layer]
    C --> D[Update Service Layer]
    D --> E[Update Hook Layer]
    E --> F[Verify UI Components]
    F --> G[End-to-End Testing]
    G --> H[Cleanup FileMaker Code]
    H --> I[Complete: Supabase Notes]

    style A fill:#ff6b6b
    style I fill:#51cf66
    style B fill:#ffd43b
    style C fill:#74c0fc
    style D fill:#74c0fc
    style E fill:#74c0fc
    style F fill:#a9e34b
    style G fill:#a9e34b
    style H fill:#dee2e6
```

## Create Note Flow (Before Migration)

```mermaid
sequenceDiagram
    actor User
    participant UI as ProjectNotesTab
    participant Hook as useNote Hook
    participant Service as noteService
    participant API as notes.js
    participant FM as FileMaker devNotes

    User->>UI: Click "New Note"
    UI->>UI: Show TextInput
    User->>UI: Enter note content
    UI->>Hook: handleNoteCreate(projectId, content)
    Hook->>Service: createNewNote(projectId, content, 'general')
    Service->>API: createNote({ note, fkId, type })
    API->>FM: CREATE on devNotes layout
    FM-->>API: { recordId: "123" }
    API-->>Service: FileMaker response
    Service-->>Hook: Created note
    Hook->>UI: Reload project details
    UI->>UI: Fetch all project data
    UI-->>User: Note appears in list
```

## Create Note Flow (After Migration)

```mermaid
sequenceDiagram
    actor User
    participant UI as ProjectNotesTab
    participant Hook as useNote Hook
    participant Service as noteService
    participant API as notes.js
    participant Backend as /api/notes
    participant DB as Supabase DB

    User->>UI: Click "New Note"
    UI->>UI: Show TextInput
    User->>UI: Enter note content
    UI->>Hook: handleNoteCreate(projectId, content)
    Hook->>Service: createNewNote('project', projectId, content, 'general')
    Service->>API: createNote({ note, type, project_id })
    API->>Backend: POST /api/notes (HMAC auth)
    Backend->>DB: INSERT note with org_id from JWT
    DB-->>Backend: { id, note, project_id, created_at, ... }
    Backend-->>API: NoteResponse
    API-->>Service: Backend response
    Service->>Service: processNotes() - transform to frontend format
    Service-->>Hook: { id, content, createdAt, ... }
    Hook->>UI: Update notes state (append new note)
    UI-->>User: Note appears in list immediately
```

## List Notes Flow (After Migration)

```mermaid
sequenceDiagram
    actor User
    participant UI as ProjectNotesTab
    participant Project as useProject Hook
    participant API as projects.js
    participant NotesAPI as notes.js
    participant Backend as /api/notes
    participant DB as Supabase DB

    User->>UI: Select project
    UI->>Project: loadProjectDetails(projectId)
    Project->>API: fetchProjectNotes(projectId)
    API->>NotesAPI: fetchNotesByProject(projectId, 50, 0)
    NotesAPI->>Backend: GET /api/notes?project_id=X&limit=50&offset=0
    Backend->>DB: SELECT notes WHERE project_id=X (with RLS)
    DB-->>Backend: [ { id, note, type, ... }, ... ]
    Backend-->>NotesAPI: NoteListResponse { notes, total, limit, offset }
    NotesAPI->>NotesAPI: processNotes() - transform data
    NotesAPI-->>API: Processed notes array
    API-->>Project: Notes data
    Project->>UI: Update project state
    UI-->>User: Display notes list
```

## Update Note Flow (New Capability)

```mermaid
sequenceDiagram
    actor User
    participant UI as ProjectNotesTab
    participant Hook as useNote Hook
    participant API as notes.js
    participant Backend as /api/notes
    participant DB as Supabase DB

    User->>UI: Click "Edit" on note
    UI->>UI: Show edit form with current content
    User->>UI: Modify note content
    UI->>Hook: handleNoteUpdate(noteId, newContent)
    Hook->>API: updateNote(noteId, { note: newContent })
    API->>Backend: PATCH /api/notes/{noteId} (HMAC auth)
    Backend->>DB: UPDATE notes SET note=X, updated_at=NOW()
    DB-->>Backend: Updated note record
    Backend-->>API: NoteResponse
    API-->>Hook: Updated note
    Hook->>UI: Update note in list
    UI-->>User: Note content updated
```

## Delete Note Flow (New Capability)

```mermaid
sequenceDiagram
    actor User
    participant UI as ProjectNotesTab
    participant Hook as useNote Hook
    participant API as notes.js
    participant Backend as /api/notes
    participant DB as Supabase DB

    User->>UI: Click "Delete" on note
    UI->>UI: Show confirmation dialog
    User->>UI: Confirm deletion
    UI->>Hook: handleNoteDelete(noteId)
    Hook->>API: deleteNote(noteId)
    API->>Backend: DELETE /api/notes/{noteId} (HMAC auth)
    Backend->>DB: DELETE FROM notes WHERE id=X
    DB-->>Backend: Deletion confirmed
    Backend-->>API: 204 No Content
    API-->>Hook: Success
    Hook->>UI: Remove note from list
    UI-->>User: Note removed
```

## Pagination Flow (New Capability)

```mermaid
sequenceDiagram
    actor User
    participant UI as ProjectNotesTab
    participant Hook as useNote Hook
    participant API as notes.js
    participant Backend as /api/notes

    Note over UI: Initial load shows first 50 notes
    UI-->>User: Notes 1-50 displayed
    UI-->>User: "Load More" button visible

    User->>UI: Click "Load More"
    UI->>Hook: loadMoreNotes()
    Hook->>API: fetchNotesByProject(projectId, 50, 50)
    API->>Backend: GET /api/notes?project_id=X&limit=50&offset=50
    Backend-->>API: NoteListResponse { notes: [...], total: 127, offset: 50 }
    API-->>Hook: Notes 51-100
    Hook->>UI: Append to existing notes
    UI-->>User: Notes 1-100 displayed

    alt More notes available
        UI-->>User: "Load More" still visible
    else All notes loaded
        UI-->>User: "Load More" hidden
    end
```

## Error Handling Flow

```mermaid
sequenceDiagram
    actor User
    participant UI as Component
    participant Hook as useNote Hook
    participant API as notes.js
    participant Backend as /api/notes

    User->>UI: Attempt to create note
    UI->>Hook: handleNoteCreate(...)
    Hook->>API: createNote(...)
    API->>Backend: POST /api/notes

    alt Validation Error
        Backend-->>API: 400 { detail: "Note content required" }
        API-->>Hook: Error response
        Hook->>Hook: Log to console
        Hook->>UI: showError("Note content required")
        UI-->>User: SnackBar error message
    else Authentication Error
        Backend-->>API: 401 { detail: "Invalid auth" }
        API-->>Hook: Error response
        Hook->>Hook: Log to console
        Hook->>UI: showError("Authentication failed")
        UI-->>User: SnackBar error + possible re-auth
    else Network Error
        API-->>Hook: Network timeout
        Hook->>Hook: Log to console
        Hook->>UI: showError("Network error, please try again")
        UI-->>User: SnackBar error message
    else Success
        Backend-->>API: 201 { id, note, ... }
        API-->>Hook: Created note
        Hook->>UI: Update notes list
        UI-->>User: Note appears in list
    end
```

## Data Transformation Flow

```mermaid
graph LR
    A[Backend Response] --> B{processNotes}
    B --> C[Transform Fields]
    C --> D[Sort by Date]
    D --> E[Frontend Format]

    subgraph Backend Format
    A1["{ id, note, type, project_id, created_at, updated_at }"]
    end

    subgraph Transform
    C1["note → content"]
    C2["created_at → createdAt"]
    C3["updated_at → modifiedAt"]
    end

    subgraph Frontend Format
    E1["{ id, content, type, createdAt, modifiedAt }"]
    end

    A1 --> A
    C --> C1
    C --> C2
    C --> C3
    E --> E1
```

## Task Sequence

```mermaid
gantt
    title Notes Backend Integration Timeline
    dateFormat  YYYY-MM-DD
    section Preparation
    Verify backend API           :done, t1, 2026-01-13, 1d
    section API Layer
    Update notes.js              :active, t2, after t1, 1d
    Update projects.js           :t3, after t2, 1d
    Update tasks.js              :t4, after t2, 1d
    section Service Layer
    Update noteService.js        :t5, after t1, 1d
    section Hook Layer
    Update useNote.js            :t6, after t2 t5, 1d
    section Components
    Verify ProjectNotesTab       :t7, after t3 t5 t6, 1d
    Verify TaskList              :t8, after t4 t5 t6, 1d
    Add pagination UI            :t9, after t7 t8, 1d
    section Testing
    Test project notes           :t10, after t7, 1d
    Test task notes              :t11, after t8, 1d
    Test update/delete           :t12, after t6, 1d
    section Cleanup
    Remove FileMaker code        :t13, after t10 t11 t12, 1d
    Update documentation         :t14, after t13, 1d
```

## Critical Path Dependencies

```mermaid
graph TD
    TSK0001[Verify Backend API] --> TSK0002[Update notes.js]
    TSK0001 --> TSK0005[Update noteService.js]

    TSK0002 --> TSK0003[Update projects.js]
    TSK0002 --> TSK0004[Update tasks.js]
    TSK0002 --> TSK0006[Update useNote.js]

    TSK0005 --> TSK0006
    TSK0005 --> TSK0007[Verify ProjectNotesTab]
    TSK0005 --> TSK0008[Verify TaskList]

    TSK0003 --> TSK0007
    TSK0004 --> TSK0008
    TSK0006 --> TSK0007
    TSK0006 --> TSK0008

    TSK0007 --> TSK0009[Add Pagination]
    TSK0008 --> TSK0009

    TSK0007 --> TSK0010[Test Project Notes]
    TSK0008 --> TSK0011[Test Task Notes]
    TSK0006 --> TSK0012[Test Update/Delete]

    TSK0010 --> TSK0013[Remove FileMaker]
    TSK0011 --> TSK0013
    TSK0012 --> TSK0013

    TSK0013 --> TSK0014[Update Docs]

    style TSK0001 fill:#ffd43b
    style TSK0002 fill:#74c0fc
    style TSK0005 fill:#74c0fc
    style TSK0006 fill:#74c0fc
    style TSK0010 fill:#a9e34b
    style TSK0011 fill:#a9e34b
    style TSK0012 fill:#a9e34b
    style TSK0014 fill:#dee2e6
```
