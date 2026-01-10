# Notes Migration Requirements - Workflows

## Documentation Creation Workflow

```mermaid
graph TD
    A[Start: Create Directory Structure] --> B[Analyze Current Implementation]
    B --> C[Document FileMaker Schema]
    B --> D[Document Frontend Code]
    B --> E[Document UI Flows]

    C --> F[Design Supabase Schema]
    D --> F
    E --> F

    F --> G[Define API Contracts]
    F --> H[Design Authorization Model]
    F --> I[Plan Data Migration]

    G --> J[Create Acceptance Criteria]
    E --> J

    H --> K[Write README Overview]
    I --> K
    J --> K

    K --> L[Review & Validate]
    L --> M{Complete?}
    M -->|No| N[Address Gaps]
    N --> L
    M -->|Yes| O[Submit to Backend Team]
```

## Current Notes Implementation Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as ProjectNotesTab/TaskList
    participant Hook as useNote
    participant Service as noteService
    participant API as notes.js
    participant FM as FileMaker devNotes

    User->>UI: Click "New Note"
    UI->>UI: Show TextInput
    User->>UI: Enter note text & submit
    UI->>Hook: handleNoteCreate(fkId, noteContent)
    Hook->>Service: createNewNote(fkId, note, type)
    Service->>API: createNote(data)
    API->>FM: fetchDataFromFileMaker(layout: devNotes, action: CREATE)
    FM-->>API: {response: {recordId}}
    API-->>Service: result
    Service-->>Hook: result
    Hook-->>UI: created note object
    UI->>UI: Reload parent entity
    UI->>User: Display updated notes list
```

## Notes Data Flow (Current)

```mermaid
flowchart LR
    subgraph Frontend
        A[User Input] --> B[useNote Hook]
        B --> C[noteService]
        C --> D[notes API]
    end

    subgraph FileMaker
        D --> E[devNotes Layout]
        E --> F[Notes Table]
    end

    subgraph Display
        F --> G[loadProjectDetails]
        G --> H[processNotes]
        H --> I[ProjectNotesTab/TaskList]
        I --> A
    end

    style F fill:#f9f,stroke:#333,stroke-width:2px
    style I fill:#9ff,stroke:#333,stroke-width:2px
```

## Proposed Supabase Architecture

```mermaid
erDiagram
    NOTES ||--o{ PROJECTS : "belongs_to"
    NOTES ||--o{ TASKS : "belongs_to"
    NOTES ||--o{ CUSTOMERS : "belongs_to"
    NOTES {
        uuid id PK
        text note
        varchar type
        uuid project_id FK "nullable"
        uuid task_id FK "nullable"
        uuid customer_id FK "nullable"
        timestamptz created_at
        uuid created_by
        timestamptz updated_at
        uuid organization_id FK
    }
    PROJECTS {
        uuid id PK
        text name
    }
    TASKS {
        uuid id PK
        text task
    }
    CUSTOMERS {
        uuid id PK
        text name
    }
```

## Migration Workflow

```mermaid
flowchart TD
    A[Export Notes from FileMaker] --> B[Load Existing Entity Mappings]
    B --> C{For Each Note}
    C --> D[Identify Parent Type]
    D --> E{Parent Type?}

    E -->|Project| F[Map _fkID to project UUID]
    E -->|Task| G[Map _fkID to task UUID]
    E -->|Customer| H[Map _fkID to customer UUID]

    F --> I[Create Note Record]
    G --> I
    H --> I

    I --> J{More Notes?}
    J -->|Yes| C
    J -->|No| K[Validate Migrations]

    K --> L{All Valid?}
    L -->|No| M[Review Errors]
    M --> N[Manual Resolution]
    N --> K
    L -->|Yes| O[Migration Complete]

    style A fill:#f96,stroke:#333,stroke-width:2px
    style O fill:#9f6,stroke:#333,stroke-width:2px
    style M fill:#ff9,stroke:#333,stroke-width:2px
```

## Backend Implementation Dependencies

```mermaid
graph LR
    A[Notes Requirements Docs] --> B[Backend Reviews]
    B --> C[Schema Design Approval]
    B --> D[API Contract Agreement]

    C --> E[Create Supabase Migration]
    D --> F[Implement Backend Endpoints]
    E --> G[Apply Migration to Dev]
    F --> G

    G --> H[Create RLS Policies]
    H --> I[Backend Testing]
    I --> J{Tests Pass?}
    J -->|No| K[Fix Issues]
    K --> I
    J -->|Yes| L[Deploy to Staging]

    L --> M[Data Migration Scripts]
    M --> N[Migrate Historical Data]
    N --> O[Validate Migration]
    O --> P{Valid?}
    P -->|No| Q[Rollback & Fix]
    Q --> M
    P -->|Yes| R[Backend Ready for Frontend]

    R --> S[Frontend Phase 2: Update notes.js API calls]

    style A fill:#9cf,stroke:#333,stroke-width:2px
    style R fill:#9f6,stroke:#333,stroke-width:2px
    style Q fill:#f96,stroke:#333,stroke-width:2px
```

## API Request Flow (Proposed)

```mermaid
sequenceDiagram
    participant UI as Frontend UI
    participant API as notes.js
    participant Backend as Backend API
    participant Supabase as Supabase DB

    Note over UI,Supabase: Create Note Flow
    UI->>API: createNote({note, type, project_id})
    API->>Backend: POST /notes with HMAC auth
    Backend->>Backend: Validate HMAC signature
    Backend->>Backend: Validate org access
    Backend->>Supabase: INSERT into notes
    Supabase->>Supabase: Check RLS policies
    Supabase-->>Backend: Note record
    Backend-->>API: {id, note, type, created_at, ...}
    API-->>UI: Created note

    Note over UI,Supabase: List Notes Flow
    UI->>API: fetchProjectNotes(project_id)
    API->>Backend: GET /notes?project_id=xxx
    Backend->>Backend: Validate HMAC
    Backend->>Supabase: SELECT notes WHERE project_id=xxx
    Supabase->>Supabase: Apply RLS filters
    Supabase-->>Backend: Notes array
    Backend-->>API: {notes: [...]}
    API-->>UI: Processed notes list
```

## Task Execution Order

The tasks should be executed in the following optimal order:

1. **Foundation** (TSK0001): Create directory structure
2. **Analysis Phase** (TSK0002, TSK0003): Document current implementation and UI flows
3. **Design Phase** (TSK0004, TSK0005, TSK0006): Data model, API contracts, authorization
4. **Migration Phase** (TSK0007): Plan data migration
5. **Validation Phase** (TSK0008): Acceptance criteria
6. **Documentation Phase** (TSK0009): README overview
7. **Review Phase** (TSK0010): Final validation

Tasks TSK0004, TSK0005, TSK0006 can be worked on in parallel after TSK0002 is complete.
