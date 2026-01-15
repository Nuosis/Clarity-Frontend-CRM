# Projects Backend Integration Workflows

## Implementation Flow

This document visualizes the implementation workflow for migrating projects from FileMaker to the new backend API.

## Overall Architecture Flow

```mermaid
graph TB
    subgraph "Frontend Components"
        UI[Project UI Components]
        Hook[useProject Hook]
        Service[projectService]
        API[projects.js API Layer]
    end

    subgraph "Backend API"
        REST[REST Endpoints]
        DB[(Supabase Database)]
    end

    UI -->|Uses| Hook
    Hook -->|Calls| Service
    Hook -->|Calls| API
    Service -->|Transforms| API
    API -->|HMAC Auth| REST
    REST -->|RLS Queries| DB
```

## Data Flow: List Projects

```mermaid
sequenceDiagram
    participant UI as ProjectList Component
    participant Hook as useProject Hook
    participant API as projects.js
    participant Backend as Backend API
    participant DB as Supabase DB

    UI->>Hook: loadProjects(customerId)
    Hook->>API: listByCustomer(customerId)
    API->>Backend: GET /projects/customer/{customer_id}
    Note over API,Backend: With HMAC auth header
    Backend->>DB: SELECT * FROM projects WHERE customer_id = $1
    DB-->>Backend: Project rows
    Backend-->>API: JSON response
    API->>Hook: Processed projects array
    Hook->>UI: Update state with projects
```

## Data Flow: Load Project Details

```mermaid
sequenceDiagram
    participant UI as ProjectDetails Component
    participant Hook as useProject Hook
    participant API as projects.js
    participant Backend as Backend API
    participant DB as Supabase DB

    UI->>Hook: handleProjectSelect(projectId)
    Hook->>API: getWithDetails(projectId)
    API->>Backend: GET /projects/{project_id}/detail
    Note over API,Backend: Single endpoint with nested data
    Backend->>DB: SELECT with JOINs (objectives, steps, images, notes)
    DB-->>Backend: Nested project data
    Backend-->>API: ProjectWithDetails JSON
    API->>Hook: Processed project with all related data
    Hook->>UI: Update selectedProject state
```

## Data Flow: Create Project

```mermaid
sequenceDiagram
    participant UI as ProjectCreationForm
    participant Hook as useProject Hook
    participant Service as projectService
    participant API as projects.js
    participant Backend as Backend API
    participant DB as Supabase DB

    UI->>Hook: handleProjectCreate(formData)
    Hook->>Service: validateProjectData(formData)
    Service-->>Hook: Validation result
    Hook->>Service: formatProjectForBackend(formData)
    Service-->>Hook: Transformed data
    Hook->>API: create(projectData)
    API->>Backend: POST /projects
    Note over API,Backend: With HMAC auth + project data
    Backend->>DB: INSERT INTO projects
    Note over Backend,DB: May trigger sales generation
    DB-->>Backend: New project record
    Backend-->>API: Created project JSON
    API-->>Hook: New project object
    Hook->>Hook: Update projects state
    Hook->>UI: Success notification
```

## Data Flow: Update Project Status

```mermaid
sequenceDiagram
    participant UI as ProjectDetails
    participant Hook as useProject Hook
    participant API as projects.js
    participant Backend as Backend API
    participant DB as Supabase DB

    UI->>Hook: handleProjectStatusChange(projectId, newStatus)
    Hook->>API: updateStatus(projectId, newStatus)
    API->>Backend: PATCH /projects/{project_id}/status
    Note over API,Backend: With HMAC auth + {status: "completed"}
    Backend->>DB: UPDATE projects SET status = $1
    DB-->>Backend: Updated project
    Backend-->>API: Updated project JSON
    API-->>Hook: Updated project
    Hook->>Hook: Update local state optimistically
    Hook->>UI: Reflect new status
```

## Data Flow: Manage Objectives

```mermaid
sequenceDiagram
    participant UI as ObjectivesTab
    participant Hook as useProject Hook
    participant API as projects.js
    participant Backend as Backend API
    participant DB as Supabase DB

    UI->>Hook: handleObjectiveCreate(projectId, objectiveText)
    Hook->>API: createObjective({project_id, objective, status})
    API->>Backend: POST /objectives
    Note over API,Backend: With HMAC auth
    Backend->>DB: INSERT INTO project_objectives
    DB-->>Backend: New objective record
    Backend-->>API: Created objective JSON
    API-->>Hook: New objective
    Hook->>Hook: Update project.objectives
    Hook->>UI: Show new objective
```

## Implementation Task Flow

```mermaid
graph TD
    Start[Start Implementation] --> T1[TSK0001: Core API Operations]
    T1 --> T2[TSK0002: Objectives API]
    T1 --> T3[TSK0003: Images/Links/Notes API]

    T2 --> T4[TSK0004: Service Layer Core]
    T3 --> T4

    T4 --> T5[TSK0005: Service Layer Related]

    T5 --> T6[TSK0006: Hook Load Ops]
    T6 --> T7[TSK0007: Hook CRUD Ops]
    T7 --> T8[TSK0008: Hook Objectives]
    T8 --> T9[TSK0009: Hook Business Logic]

    T9 --> T10[TSK0010: ProjectDetails Component]
    T9 --> T11[TSK0011: List/Creation Components]
    T9 --> T12[TSK0012: Objectives Tab]
    T9 --> T13[TSK0013: Images/Links/Notes Tabs]

    T10 --> T14[TSK0014: Related Features]
    T11 --> T14
    T12 --> T14
    T13 --> T14

    T14 --> T15[TSK0015: Tests & Fixtures]
    T15 --> End[Complete]
```

## Field Mapping Reference

### FileMaker → Backend Schema

```mermaid
graph LR
    subgraph "FileMaker Fields"
        FM1[__ID]
        FM2[projectName]
        FM3[_custID]
        FM4[value]
        FM5[dateStart]
        FM6[dateEnd]
        FM7[f_fixedPrice]
        FM8[f_subscription]
        FM9[status: Open/Closed]
    end

    subgraph "Backend Fields"
        BE1[id]
        BE2[name]
        BE3[customer_id]
        BE4[budget]
        BE5[start_date]
        BE6[target_end_date]
        BE7[is_fixed_price]
        BE8[is_subscription]
        BE9[status: active/completed]
    end

    FM1 --> BE1
    FM2 --> BE2
    FM3 --> BE3
    FM4 --> BE4
    FM5 --> BE5
    FM6 --> BE6
    FM7 --> BE7
    FM8 --> BE8
    FM9 --> BE9
```

## Testing Flow

```mermaid
graph TD
    T1[Unit Tests: API Layer] --> T2[Unit Tests: Service Layer]
    T2 --> T3[Unit Tests: Hook Layer]
    T3 --> T4[Integration Tests: Component + Hook]
    T4 --> T5[E2E Tests: Full User Workflows]

    T5 --> V1{All Tests Pass?}
    V1 -->|No| Fix[Fix Issues]
    Fix --> T1
    V1 -->|Yes| Deploy[Ready for Deployment]
```

## Error Handling Flow

```mermaid
graph TD
    API[API Call] --> Check{Success?}
    Check -->|Yes| Return[Return Data]
    Check -->|No| Type{Error Type}

    Type -->|401/403| Auth[Auth Error]
    Type -->|404| NotFound[Not Found]
    Type -->|400| Validation[Validation Error]
    Type -->|500| Server[Server Error]
    Type -->|Network| Network[Network Error]

    Auth --> Display[Show Auth Error to User]
    NotFound --> Display[Show Not Found Message]
    Validation --> Display[Show Validation Errors]
    Server --> Display[Show Server Error]
    Network --> Display[Show Network Error]

    Display --> Log[Log Error Details]
    Log --> Cleanup[Cleanup State]
```

## Rollback Strategy

```mermaid
graph TD
    Issue[Issue Detected] --> Assess{Critical?}

    Assess -->|Yes| Emergency[Emergency Rollback]
    Assess -->|No| Monitor[Continue Monitoring]

    Emergency --> Flag[Set Feature Flag to FileMaker]
    Flag --> Verify[Verify FileMaker Works]
    Verify --> Investigate[Investigate Issue]

    Monitor --> Metrics{Metrics OK?}
    Metrics -->|No| Emergency
    Metrics -->|Yes| Continue[Continue with Backend]
```

## Notes

- All API calls use HMAC authentication via `dataService.generateBackendAuthHeader()`
- Backend endpoints return standardized JSON responses
- Error handling should be consistent across all operations
- Loading states should be managed at hook level
- Optimistic updates for better UX (update local state immediately, rollback on error)
- The `/projects/{project_id}/detail` endpoint may return nested data, reducing number of API calls
- Business logic (fixed-price, subscription sales generation) may be backend-side - verify with backend team
