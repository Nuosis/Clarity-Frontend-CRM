# Tasks Backend Integration - Workflows

## Overall Implementation Flow

```mermaid
graph TD
    A[Audit Components TSK0001] --> B[Create Mappers TSK0002]
    B --> C[Implement Task Endpoints TSK0003]
    B --> D[Implement Timer Endpoints TSK0004]
    C --> E[Update Service Layer TSK0005]
    D --> E
    C --> F[Update Validation TSK0006]
    E --> G[Update List Components TSK0007]
    E --> H[Update Detail Components TSK0008]
    F --> I[Update Form Components TSK0009]
    D --> J[Update Timer UI TSK0010]
    D --> K[Financial Record Integration TSK0011]
    E --> K
    C --> L[Update Mocks TSK0012]
    D --> L
    C --> M[API Tests TSK0013]
    D --> M
    L --> M
    E --> N[Service Tests TSK0014]
    L --> N
    K --> O[Integration Tests TSK0015]
    L --> O
    M --> P[Ready for QA]
    N --> P
    O --> P
```

## Task Lifecycle Data Flow

```mermaid
sequenceDiagram
    participant UI as Task UI Component
    participant Hook as useTask Hook
    participant Service as taskService.js
    participant API as api/tasks.js
    participant Backend as Backend API
    participant Mapper as Data Mappers

    Note over UI,Mapper: CREATE TASK FLOW
    UI->>Hook: createTask(formData)
    Hook->>Service: createNewTask(params)
    Service->>Service: validateTaskData()
    Service->>Mapper: mapTaskToBackend(data)
    Mapper-->>Service: backendFormat
    Service->>API: createTask(backendData)
    API->>API: generateBackendAuthHeader()
    API->>Backend: POST /api/tasks
    Backend-->>API: {success, data}
    API->>Mapper: mapTaskFromBackend(response)
    Mapper-->>API: frontendFormat
    API-->>Service: taskData
    Service-->>Hook: createdTask
    Hook-->>UI: Update state
```

## Timer Lifecycle Flow

```mermaid
sequenceDiagram
    participant UI as Timer UI
    participant Service as taskService.js
    participant API as api/tasks.js
    participant Backend as Backend API
    participant DB as Supabase DB

    Note over UI,DB: TIMER START FLOW
    UI->>Service: startTimer(task)
    Service->>API: startTaskTimer(taskId)
    API->>Backend: POST /api/tasks/{id}/timer/start
    Backend->>DB: Check for active timer
    alt Active timer exists
        DB-->>Backend: Active timer found
        Backend-->>API: 409 Conflict
        API-->>Service: Error: Timer already active
        Service-->>UI: Show error + existing timer
    else No active timer
        DB-->>Backend: No active timer
        Backend->>DB: INSERT into task_timers
        DB-->>Backend: Timer created
        Backend-->>API: 201 Created {timer}
        API-->>Service: timerData
        Service-->>UI: Update state with active timer
    end

    Note over UI,DB: TIMER STOP FLOW
    UI->>Service: stopTimer(params)
    Service->>API: stopTaskTimer(timerId, workDesc, adj)
    API->>Backend: POST /api/tasks/{id}/timer/stop
    Backend->>DB: BEGIN TRANSACTION
    Backend->>DB: UPDATE task_timers SET end_time
    Backend->>DB: Check project fixed_price
    alt Fixed-price project
        Backend->>DB: COMMIT (no financial record)
        DB-->>Backend: Timer stopped
        Backend-->>API: {timer, financial_record: null}
    else Regular project
        Backend->>DB: INSERT into customer_sales
        Backend->>DB: UPDATE tasks actual_hours
        Backend->>DB: COMMIT
        DB-->>Backend: Timer + financial record created
        Backend-->>API: {timer, financial_record}
    end
    API-->>Service: stopResult
    Service-->>UI: Update state + show summary
```

## Error Handling Flow

```mermaid
graph TD
    A[API Call] --> B{Success?}
    B -->|Yes| C[Map Response]
    C --> D[Return Data]
    B -->|No| E{Error Type?}
    E -->|400 Validation| F[Show Field Errors]
    E -->|404 Not Found| G[Show Not Found Message]
    E -->|409 Conflict| H[Show Conflict Message]
    E -->|401 Auth| I[Redirect to Login]
    E -->|500 Server| J[Show Retry Option]
    F --> K[Update UI State]
    G --> K
    H --> K
    I --> L[Clear Auth State]
    J --> M[Log Error + Show Generic Message]
    K --> N[User Fixes Issue]
    L --> O[User Re-authenticates]
    M --> P[User Retries or Contacts Support]
```

## Concurrency Control Flow

```mermaid
stateDiagram-v2
    [*] --> NoActiveTimer: Staff has no active timer
    NoActiveTimer --> StartingTimer: User clicks Start
    StartingTimer --> CheckingDB: API call to backend
    CheckingDB --> ActiveTimer: No existing timer found
    CheckingDB --> ConflictDetected: Existing timer found
    ConflictDetected --> ShowExistingTimer: Display existing timer info
    ShowExistingTimer --> NoActiveTimer: User stops existing timer
    ActiveTimer --> TimerRunning: Timer started successfully
    TimerRunning --> PausedTimer: User pauses
    PausedTimer --> TimerRunning: User resumes
    TimerRunning --> StoppingTimer: User stops
    PausedTimer --> StoppingTimer: User stops while paused
    StoppingTimer --> CreatingFinancialRecord: Timer stopped
    CreatingFinancialRecord --> FinancialRecordSuccess: Record created
    CreatingFinancialRecord --> FinancialRecordFailure: Creation failed
    FinancialRecordSuccess --> NoActiveTimer: Complete
    FinancialRecordFailure --> RetryFinancialRecord: Log error + retry
    RetryFinancialRecord --> FinancialRecordSuccess: Retry succeeds
    RetryFinancialRecord --> ManualIntervention: Retry fails
    ManualIntervention --> [*]: Admin resolves
```

## Data Mapping Strategy

```mermaid
graph LR
    A[FileMaker Data] --> B[Mapper Function]
    B --> C[Backend API Format]
    C --> D[Backend Processing]
    D --> E[Backend Response]
    E --> F[Mapper Function]
    F --> G[Frontend Format]
    G --> H[UI Components]

    subgraph "Mapper Responsibilities"
    B
    F
    end

    subgraph "ID Conversions"
    I[recordId] --> J[UUID]
    K[__ID] --> J
    J --> L[id field]
    end

    subgraph "Type Conversions"
    M["'1'/'0' strings"] --> N[true/false]
    O[FM timestamps] --> P[ISO 8601]
    end
```

## Testing Strategy Flow

```mermaid
graph TD
    A[Unit Tests] --> B[API Layer Tests]
    A --> C[Service Layer Tests]
    A --> D[Component Tests]
    B --> E[Integration Tests]
    C --> E
    D --> E
    E --> F[E2E Tests]
    F --> G[Manual QA]
    G --> H{Pass?}
    H -->|Yes| I[Deploy to Staging]
    H -->|No| J[Fix Issues]
    J --> A
    I --> K[Staging Verification]
    K --> L{Pass?}
    L -->|Yes| M[Deploy to Production]
    L -->|No| J
    M --> N[Monitor Production]
    N --> O{Issues?}
    O -->|Yes| P[Rollback if Critical]
    O -->|No| Q[Success]
    P --> J
```

## Rollout Strategy

```mermaid
graph TD
    A[Development Complete] --> B[All Tests Pass]
    B --> C[Deploy to Staging]
    C --> D[Staging Verification]
    D --> E{Feature Flag Ready?}
    E -->|Yes| F[Deploy to Prod with Flag OFF]
    E -->|No| G[Add Feature Flag]
    G --> F
    F --> H[Enable for Internal Users 10%]
    H --> I{Issues Found?}
    I -->|Yes| J[Fix Issues]
    J --> A
    I -->|No| K[Enable for 25% Users]
    K --> L{Issues Found?}
    L -->|Yes| J
    L -->|No| M[Enable for 50% Users]
    M --> N{Issues Found?}
    N -->|Yes| J
    N -->|No| O[Enable for 100% Users]
    O --> P[Monitor for 1 Week]
    P --> Q{All Stable?}
    Q -->|Yes| R[Remove Feature Flag]
    Q -->|No| S[Rollback to FileMaker]
    R --> T[Remove FileMaker Code]
    S --> J
```
