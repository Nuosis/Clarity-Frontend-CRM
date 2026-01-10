# Teams Supabase Migration - Workflows

## Overview

This document describes the workflows for migrating the Teams feature from FileMaker to Supabase.

## Implementation Flow

```mermaid
graph TD
    A[Start: Teams Migration] --> B[TSK0001: Create Requirements Docs]
    B --> C[TSK0002: Create Backend Change Request]
    C --> D[Submit to Backend Team]
    D --> E{Backend Approved?}
    E -->|No| F[Revise Request]
    F --> D
    E -->|Yes| G[TSK0003: Backend Implementation]
    G --> H[Backend Creates Schema]
    H --> I[Backend Creates API Endpoints]
    I --> J[Backend Testing Complete]
    J --> K[TSK0004: Create Migration Script]
    K --> L[TSK0005: Refactor API Layer]
    L --> M[TSK0006: Update Service Layer]
    M --> N[TSK0007: Verify Hooks]
    N --> O[TSK0008: Test Components]
    O --> P[TSK0009: Execute Migration]
    P --> Q[TSK0010: Validate Migration]
    Q --> R{Migration Valid?}
    R -->|No| S[Fix Issues & Re-migrate]
    S --> P
    R -->|Yes| T[TSK0011: Integration Testing]
    T --> U{Tests Pass?}
    U -->|No| V[Fix Bugs]
    V --> T
    U -->|Yes| W[TSK0012: Update Documentation]
    W --> X[Complete: Teams on Supabase]
```

## Backend Change Request Flow

```mermaid
sequenceDiagram
    participant FE as Frontend Team
    participant Doc as Change Request Doc
    participant User as User/PM
    participant BE as Backend Team
    participant DB as Database

    FE->>Doc: Create BACKEND_CHANGE_REQUEST_002
    Doc->>Doc: Define Schema
    Doc->>Doc: Define API Endpoints
    Doc->>Doc: Define Authorization
    Doc->>Doc: Define Migration Plan
    FE->>User: Submit Change Request
    User->>BE: Forward to Backend Team
    BE->>BE: Review Request
    BE->>User: Approval/Questions
    User->>FE: Feedback
    FE->>Doc: Update if needed
    BE->>DB: Create Schema
    BE->>BE: Implement API Endpoints
    BE->>BE: Add Tests
    BE->>User: Deployment Complete
    User->>FE: Backend Ready Signal
    FE->>FE: Proceed with Frontend Work
```

## Data Migration Workflow

```mermaid
graph TD
    A[Start Migration] --> B[Backup FileMaker Data]
    B --> C[Fetch Teams from devTeams]
    C --> D[Fetch Staff from devStaff]
    D --> E[Fetch Memberships from devTeamMembers]
    E --> F[Fetch Project Assignments]
    F --> G[Map Organization IDs]
    G --> H[Transform to Supabase Schema]
    H --> I[Insert Teams]
    I --> J[Insert Staff]
    J --> K[Insert Team Members]
    K --> L[Update Project team_id]
    L --> M[Validation Script]
    M --> N{Data Valid?}
    N -->|No| O[Generate Error Report]
    O --> P[Manual Review]
    P --> Q[Fix Data Issues]
    Q --> H
    N -->|Yes| R[Generate Success Report]
    R --> S[Migration Complete]
```

## Frontend Refactoring Workflow

```mermaid
graph LR
    A[API Layer] --> B[Update teams.js]
    B --> C[Remove FileMaker imports]
    C --> D[Add Backend API calls]
    D --> E[Update error handling]

    E --> F[Service Layer]
    F --> G[Update teamService.js]
    G --> H[Update data processing]
    H --> I[Handle Backend response format]

    I --> J[Hook Layer]
    J --> K[Verify useTeam.js]
    K --> L[Test state management]
    L --> M[Update if needed]

    M --> N[Component Layer]
    N --> O[Test TeamDetails.jsx]
    O --> P[Test TeamForm.jsx]
    P --> Q[Update data rendering]

    Q --> R[Integration Testing]
```

## Team CRUD Operations (Post-Migration)

```mermaid
sequenceDiagram
    participant UI as UI Component
    participant Hook as useTeam Hook
    participant API as teams.js API
    participant Backend as Backend API
    participant DB as Supabase DB

    Note over UI,DB: Create Team Flow
    UI->>Hook: handleTeamCreate(teamData)
    Hook->>API: createTeam(teamData)
    API->>Backend: POST /teams
    Backend->>DB: INSERT INTO teams
    DB->>Backend: Return team record
    Backend->>API: Return team JSON
    API->>Hook: Return processed team
    Hook->>Hook: Update teams state
    Hook->>UI: Return team object

    Note over UI,DB: Assign Staff to Team Flow
    UI->>Hook: handleAssignStaffToTeam(staffIds, role)
    Hook->>API: assignStaffToTeam(teamId, staffId, role)
    API->>Backend: POST /teams/{id}/members
    Backend->>DB: INSERT INTO team_members
    DB->>Backend: Return member record
    Backend->>API: Return member JSON
    API->>Hook: Return processed member
    Hook->>Hook: Update teamStaff state
    Hook->>UI: Return member object

    Note over UI,DB: Fetch Team Details Flow
    UI->>Hook: handleTeamSelect(teamId)
    Hook->>API: fetchTeamById(teamId)
    API->>Backend: GET /teams/{id}
    Backend->>DB: SELECT from teams
    DB->>Backend: Return team data
    Hook->>API: fetchTeamStaff(teamId)
    API->>Backend: GET /teams/{id}/members
    Backend->>DB: SELECT from team_members JOIN staff
    DB->>Backend: Return members data
    Hook->>API: fetchTeamProjects(teamId)
    API->>Backend: GET /teams/{id}/projects
    Backend->>DB: SELECT from projects WHERE team_id
    DB->>Backend: Return projects data
    Backend->>API: Return all data
    API->>Hook: Return processed data
    Hook->>Hook: Update state (team, staff, projects)
    Hook->>UI: Render team details
```

## Authorization Flow

```mermaid
graph TD
    A[User Request] --> B[Extract Auth Token]
    B --> C[Backend Validates Token]
    C --> D{Token Valid?}
    D -->|No| E[Return 401 Unauthorized]
    D -->|Yes| F[Extract User & Organization]
    F --> G[Apply RLS Policies]
    G --> H{Resource belongs to Org?}
    H -->|No| I[Return 403 Forbidden]
    H -->|Yes| J{User has Permission?}
    J -->|No| I
    J -->|Yes| K[Execute Database Query]
    K --> L[Return Scoped Data]
```

## Testing Workflow

```mermaid
graph TD
    A[Start Testing] --> B[Unit Tests]
    B --> C[Test API Functions]
    C --> D[Test Service Functions]
    D --> E[Test Hook Operations]

    E --> F[Integration Tests]
    F --> G[Test Team CRUD Flow]
    G --> H[Test Staff Assignment Flow]
    H --> I[Test Project Assignment Flow]

    I --> J[Data Validation]
    J --> K[Compare Record Counts]
    K --> L[Verify Relationships]
    L --> M[Check Data Integrity]

    M --> N[UI Testing]
    N --> O[Test Team List]
    O --> P[Test Team Details]
    P --> Q[Test Team Form]
    Q --> R[Test Staff Management]

    R --> S{All Tests Pass?}
    S -->|No| T[Fix Issues]
    T --> B
    S -->|Yes| U[Testing Complete]
```

## Rollback Workflow

```mermaid
graph TD
    A[Issue Detected] --> B{Severity?}
    B -->|Critical| C[Immediate Rollback]
    B -->|High| D[Assess Impact]
    D --> E{Can Fix Quickly?}
    E -->|Yes| F[Apply Fix]
    F --> G[Monitor]
    E -->|No| C

    C --> H[Revert Frontend Code]
    H --> I[Switch to FileMaker API]
    I --> J[Deploy Previous Version]
    J --> K[Verify Functionality]
    K --> L[Post-Mortem Analysis]
    L --> M[Plan Fix]
    M --> N[Re-attempt Migration]
```

## Key Decision Points

### 1. Backend Schema Approval
- **Decision**: Schema design meets requirements
- **Criteria**: Supports all FileMaker operations, proper indexing, RLS policies defined
- **Approvers**: Backend team, database admin
- **Impact**: Blocks all frontend work

### 2. Migration Data Validation
- **Decision**: Migration was successful
- **Criteria**: 100% record transfer, all relationships intact, no data corruption
- **Approvers**: Frontend team, QA
- **Impact**: Determines if we can proceed or must re-migrate

### 3. Integration Testing Approval
- **Decision**: All workflows function correctly
- **Criteria**: CRUD operations work, UI components render correctly, no regressions
- **Approvers**: Frontend team, QA, stakeholders
- **Impact**: Determines production readiness

## Dependencies

### External Dependencies
- Backend team availability (TSK0003)
- Database admin for schema review
- QA team for comprehensive testing

### Internal Dependencies
- TSK0001 → TSK0002 (Requirements must be complete before change request)
- TSK0002 → TSK0003 (Change request must be approved before backend work)
- TSK0003 → TSK0004, TSK0005 (Backend must be ready before frontend/migration work)
- TSK0005 → TSK0006 → TSK0007 → TSK0008 (Frontend layers depend on each other)
- TSK0004 + TSK0008 → TSK0009 (Migration requires both script and frontend ready)
- TSK0009 → TSK0010 (Validation requires migration complete)
- TSK0010 → TSK0011 (Integration testing requires valid data)
- TSK0011 → TSK0012 (Documentation updated after testing passes)

## Timeline

```mermaid
gantt
    title Teams Migration Timeline
    dateFormat  YYYY-MM-DD
    section Requirements
    TSK0001 Requirements Docs          :done, req1, 2026-01-10, 2d
    TSK0002 Backend Change Request     :done, req2, after req1, 2d
    section Backend Work
    TSK0003 Backend Implementation     :crit, be1, after req2, 7d
    section Frontend Work
    TSK0004 Migration Script           :fe1, after be1, 3d
    TSK0005 Refactor API Layer         :fe2, after be1, 2d
    TSK0006 Update Service Layer       :fe3, after fe2, 1d
    TSK0007 Verify Hooks               :fe4, after fe3, 1d
    TSK0008 Test Components            :fe5, after fe4, 2d
    section Migration & Testing
    TSK0009 Execute Migration          :crit, mig1, after fe1 fe5, 1d
    TSK0010 Validate Migration         :crit, val1, after mig1, 1d
    TSK0011 Integration Testing        :crit, test1, after val1, 3d
    section Documentation
    TSK0012 Update Documentation       :doc1, after test1, 1d
```
