# Tasks + Timer Migration Requirements Workflows

## Documentation Workflow

```mermaid
graph TD
    A[Start: Phase 1 Requirements] --> B[Create Directory Structure]
    B --> C[Document Current Behavior]
    C --> C1[Task CRUD Operations]
    C --> C2[Timer Lifecycle]
    C --> C3[Financial Record Generation]

    C1 --> D[Map Data Models]
    C2 --> D
    C3 --> D

    D --> D1[FileMaker devTasks → Supabase tasks]
    D --> D2[FileMaker devRecords → Supabase time_entries]
    D --> D3[Dual-Write Mechanism]

    D1 --> E[Define Backend Requirements]
    D2 --> E
    D3 --> E

    E --> E1[Task CRUD API Endpoints]
    E --> E2[Timer Operation API Endpoints]
    E --> E3[Business Logic Rules]

    E1 --> F[Create Migration Strategy]
    E2 --> F
    E3 --> F

    F --> G[Define Test Cases]
    G --> H[Backend Change Request]
    H --> I[End: Documentation Complete]
```

## Current Timer Operation Flow

```mermaid
sequenceDiagram
    participant UI as TaskTimer Component
    participant Hook as useTask Hook
    participant Service as taskService
    participant API as tasks.js API
    participant FM as FileMaker (devRecords)
    participant Dual as dualWriteService
    participant SB as Supabase (customer_sales)

    UI->>Hook: onStart()
    Hook->>Service: startTimer(task)
    Service->>API: startTaskTimer(taskId, task)
    API->>FM: CREATE in devRecords
    Note over FM: Creates record with<br/>TimeStart, _taskID, _projectID,<br/>_staffID, _custID
    FM-->>API: recordId
    API-->>Service: timer record
    Service-->>Hook: timer state
    Hook-->>UI: Update UI (timer running)

    Note over UI: User works on task<br/>(time elapses)

    UI->>Hook: onStop(description)
    Hook->>Service: stopTimer(params, orgId)
    Service->>API: stopTaskTimer(recordId, description, ...)
    API->>FM: UPDATE in devRecords
    Note over FM: Updates with TimeEnd,<br/>Work Performed, TimeAdjust
    FM-->>API: Updated record
    API-->>Service: Result

    Service->>API: fetchFinancialRecordByRecordId(recordId)
    API->>FM: READ from devRecords
    FM-->>API: Financial record
    API-->>Service: Financial data

    alt Not Fixed-Price Project
        Service->>Dual: createSaleFromFinancialRecord(financialId, orgId)
        Dual->>SB: INSERT into customer_sales
        Note over SB: Creates sale with<br/>quantity, unit_price,<br/>total_price, date
        SB-->>Dual: Sale record
        Dual-->>Service: Success
    else Fixed-Price Project
        Note over Service: Skip customer_sales creation
    end

    Service-->>Hook: Complete result
    Hook-->>UI: Update UI (timer stopped)
```

## Target Timer Operation Flow (Future)

```mermaid
sequenceDiagram
    participant UI as TaskTimer Component
    participant Hook as useTask Hook
    participant API as Backend API
    participant DB as Supabase DB
    participant Logic as Backend Logic

    UI->>Hook: onStart()
    Hook->>API: POST /api/tasks/{id}/timer/start
    Note over API: HMAC Authentication
    API->>Logic: Validate task state
    Logic->>DB: Check for active timer
    DB-->>Logic: No active timer
    Logic->>DB: INSERT into time_entries
    Note over DB: status='active'<br/>start_time=NOW()
    DB-->>Logic: time_entry record
    Logic-->>API: Timer started
    API-->>Hook: { timer_id, start_time }
    Hook-->>UI: Update UI (timer running)

    Note over UI: User works on task

    UI->>Hook: onStop(description)
    Hook->>API: POST /api/tasks/{id}/timer/stop
    API->>Logic: Validate timer state
    Logic->>DB: UPDATE time_entries
    Note over DB: status='completed'<br/>end_time=NOW()<br/>description=...
    DB-->>Logic: Updated record

    Logic->>Logic: Calculate billable time
    Logic->>Logic: Check project billing type

    alt Billable (Not Fixed-Price)
        Logic->>DB: INSERT into customer_sales
        Note over DB: From time_entry data
        DB-->>Logic: Sale record
    else Fixed-Price
        Note over Logic: Skip sale creation
    end

    Logic-->>API: Timer stopped + sale created
    API-->>Hook: Complete result
    Hook-->>UI: Update UI (timer stopped)
```

## Data Model Transformation

```mermaid
graph LR
    subgraph FileMaker
        A1[devTasks Layout]
        A2[devRecords Layout]
    end

    subgraph Transformation
        B1[Field Mapping]
        B2[Data Validation]
        B3[Type Conversion]
    end

    subgraph Supabase
        C1[tasks table]
        C2[time_entries table]
        C3[customer_sales table]
    end

    A1 -->|Map fields| B1
    A2 -->|Map fields| B1
    B1 -->|Validate| B2
    B2 -->|Convert| B3
    B3 -->|Insert| C1
    B3 -->|Insert| C2
    B3 -->|Insert| C3
```

## Migration Workflow

```mermaid
graph TD
    A[Start Migration] --> B[Phase 1: Requirements<br/>Document Current System]
    B --> C{Schema<br/>Exists?}

    C -->|No| D[Phase 2: Backend Change Request]
    C -->|Yes| E[Phase 2: Backend API Implementation]

    D --> E
    E --> F[Phase 3: Frontend Migration]
    F --> G[Phase 4: Data Migration]

    G --> G1[Export FileMaker Data]
    G1 --> G2[Transform & Validate]
    G2 --> G3[Import to Supabase]
    G3 --> G4[Reconcile & Verify]

    G4 --> H{Data Valid?}
    H -->|No| G2
    H -->|Yes| I[Phase 5: Remove Dual-Write]

    I --> I1[Remove dualWriteService]
    I --> I2[Remove FileMaker Bridge]
    I --> I3[Clean Up Code]

    I3 --> J[Migration Complete]
```

## Test Scenario Workflows

### Timer Race Condition Test

```mermaid
graph TD
    A[Timer Running] --> B{User Action}
    B -->|Stop Button| C[Stop Request 1]
    B -->|Network Retry| D[Stop Request 2]

    C --> E{Backend State Check}
    D --> E

    E -->|Timer Active| F[Process Stop]
    E -->|Timer Already Stopped| G[Return Idempotent Response]

    F --> H[Update time_entry]
    H --> I[Create customer_sales if needed]
    I --> J[Return Success]

    G --> J
    J --> K[UI Updated Once]
```

### Offline Timer Recovery

```mermaid
graph TD
    A[Timer Started Online] --> B[Network Lost]
    B --> C[Timer Running Locally]
    C --> D[User Clicks Stop]
    D --> E{Network Available?}

    E -->|Yes| F[Send Stop Request]
    E -->|No| G[Queue Stop Request]

    G --> H[Store in localStorage]
    H --> I[Wait for Network]
    I --> J{Network Restored?}

    J -->|Yes| F
    J -->|No| I

    F --> K[Backend Validates]
    K --> L{Timer State Valid?}
    L -->|Yes| M[Process Stop]
    L -->|No| N[Reject with Error]

    M --> O[Success]
    N --> P[UI Shows Error]
    P --> Q[User Retry]
```

## Documentation Dependencies

```mermaid
graph LR
    A[Task CRUD Docs] --> D[Backend API Spec]
    B[Timer Lifecycle Docs] --> D
    C[Financial Record Docs] --> D

    E[FileMaker Schema] --> F[Data Model Mapping]
    F --> G[Supabase Schema Spec]

    D --> H[Backend Change Request]
    G --> H

    I[Dual-Write Analysis] --> J[Migration Strategy]
    J --> K[Test Cases]

    H --> L[Phase 2: Implementation]
    K --> L
```
