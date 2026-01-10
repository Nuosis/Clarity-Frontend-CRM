# FileMaker Removal Requirements - Workflows

## Overview

This document describes the workflow for documenting FileMaker removal requirements. This is Phase 1 of a two-phase process - Phase 2 will be the actual implementation.

## Task Execution Flow

```mermaid
graph TD
    A[Start: Requirements Documentation] --> B[TSK0001: Create README]
    B --> C[TSK0002: Document Architecture]
    C --> D[TSK0003: Create Inventory]

    D --> E[TSK0004: Backend API Requirements]
    E --> F{New Backend<br/>Endpoints<br/>Needed?}
    F -->|Yes| G[Create BACKEND_CHANGE_REQUEST]
    F -->|No| H[Document Existing Endpoints]
    G --> I[TSK0005: Auth Requirements]
    H --> I

    I --> J[TSK0006: Migration Plan]
    J --> K[TSK0007: Acceptance Criteria]
    K --> L[TSK0008: Rollout Plan]
    L --> M[End: Documentation Complete]

    M --> N{Requirements<br/>Approved?}
    N -->|Yes| O[Phase 2: Create Implementation Feature]
    N -->|No| P[Revise Documentation]
    P --> B
```

## Current Architecture Analysis Flow

```mermaid
graph LR
    A[Request Initiated] --> B{Environment<br/>Detected?}
    B -->|FileMaker| C[Check window.FileMaker]
    B -->|Web App| D[Check Supabase Auth]

    C --> E{FMGofer<br/>Available?}
    E -->|Yes| F[Use FMGofer.PerformScript]
    E -->|No| G[Use FileMaker.PerformScript]

    D --> H[Generate HMAC Token]
    H --> I[Call Backend API]

    F --> J[FileMaker Script Response]
    G --> J
    I --> K[Backend API Response]

    J --> L[Parse and Return Data]
    K --> L
```

## Target Architecture (Post-Migration)

```mermaid
graph LR
    A[Request Initiated] --> B[Supabase Auth Check]
    B --> C{Auth Valid?}
    C -->|No| D[Redirect to Login]
    C -->|Yes| E{Direct Supabase<br/>or Backend?}

    E -->|Supabase Table| F[Query Supabase Directly]
    E -->|Backend Logic| G[Generate HMAC Token]

    F --> H[Return Data]
    G --> I[Call Backend API]
    I --> H
```

## Authentication Flow Changes

### Current (Dual Authentication)

```mermaid
graph TD
    A[App Starts] --> B[SignIn Component]
    B --> C{Detect<br/>Environment}

    C -->|FileMaker Detected| D[Auto-authenticate via Bridge]
    D --> E[Load FileMaker User Context]
    E --> F[Fetch Supabase User ID]

    C -->|Web App| G[Show Login Form]
    G --> H[Supabase Email/Password]
    H --> I[Load User Context]

    F --> J[App Initialized]
    I --> J
```

### Target (Supabase-Only)

```mermaid
graph TD
    A[App Starts] --> B[SignIn Component]
    B --> C[Show Login Form]
    C --> D[Supabase Email/Password Auth]
    D --> E{Auth Success?}
    E -->|No| F[Show Error]
    F --> C
    E -->|Yes| G[Load User Context]
    G --> H[Initialize App]
```

## Data Service Simplification

### Current (Environment-Aware Routing)

```mermaid
graph TD
    A[API Call] --> B[dataService Request]
    B --> C[Request Interceptor]
    C --> D{Environment<br/>Type?}

    D -->|FileMaker| E[Mark as FM Request]
    E --> F[Response Interceptor]
    F --> G[convertToFileMakerCall]
    G --> H[FMGofer.PerformScript]

    D -->|Web App| I[Generate HMAC Auth]
    I --> J[Add to Headers]
    J --> K[Send to Backend]

    H --> L[Return Response]
    K --> L
```

### Target (Simplified Backend-Only)

```mermaid
graph TD
    A[API Call] --> B[dataService Request]
    B --> C[Generate HMAC Auth]
    C --> D[Add to Headers]
    D --> E[Send to Backend/Supabase]
    E --> F[Return Response]
```

## Documentation Dependencies

```mermaid
graph TD
    A[README.md<br/>Overview] --> B[architecture.md<br/>Current State]
    A --> C[inventory.md<br/>Touchpoints]

    B --> D[backend-api-requirements.md<br/>API Needs]
    C --> D

    D --> E[auth-requirements.md<br/>Auth Changes]

    E --> F[migration-plan.md<br/>Step-by-Step]

    F --> G[acceptance-criteria.md<br/>Success Metrics]
    F --> H[rollout-plan.md<br/>Deployment Strategy]
```

## Task Workflow Details

### TSK0001-0003: Foundation Documentation
**Purpose**: Understand and document what exists today

1. Analyze current codebase
2. Map environment detection logic
3. Document routing mechanisms
4. Create comprehensive inventory
5. Reference actual code with file:line patterns

### TSK0004: Backend API Requirements
**Purpose**: Define what backend must support

**Critical Decision Point**: If new backend endpoints are needed, create a `BACKEND_CHANGE_REQUEST` document per CLAUDE.md protocol.

Workflow:
1. Review all `fetchDataFromFileMaker` operations
2. Map FileMaker layouts to backend endpoints
3. Document CRUD operations needed
4. Check if endpoints exist (review OpenAPI spec)
5. If gaps found → Create BACKEND_CHANGE_REQUEST
6. If complete → Document existing endpoint usage

### TSK0005-0006: Planning Documentation
**Purpose**: Define how to execute the migration

1. Document authentication changes
2. Create step-by-step migration plan
3. Identify risks and mitigation strategies
4. Define rollback procedures

### TSK0007-0008: Success Criteria
**Purpose**: Define "done" and safe deployment

1. Write acceptance tests requirements
2. Define deployment phases
3. Create monitoring requirements
4. Plan user communication

## Handoff to Phase 2 Implementation

Once all documentation is complete and approved:

1. **Create new feature**: `filemaker-removal-implementation`
2. **Reference this documentation**: All implementation tasks reference requirements docs
3. **Follow migration plan**: Execute steps from migration-plan.md
4. **Validate against criteria**: Use acceptance-criteria.md for testing
5. **Deploy per rollout plan**: Follow rollout-plan.md strategy

## Critical Success Factors

- **Thoroughness**: Don't miss any FileMaker references
- **Backend Protocol**: Follow BACKEND_CHANGE_REQUEST process
- **Code References**: Use file:line format for all references
- **Risk Documentation**: Identify all risks before implementation
- **User Impact**: Consider how changes affect users
