# Links Migration Requirements - Workflows

## Overview

This document outlines the workflow for documenting Links migration requirements from FileMaker to Supabase.

## Requirements Documentation Workflow

```mermaid
graph TD
    A[Start: Links Migration Requirements] --> B[TSK0001: Document Current Implementation]
    B --> C[TSK0002: Create Data Model Mapping]
    C --> D[TSK0003: Define API Contracts]
    C --> E[TSK0004: Document Authorization]
    C --> F[TSK0007: Backend Change Request]
    D --> G[TSK0005: Create Migration Plan]
    E --> G
    B --> H[TSK0006: Define Acceptance Criteria]
    D --> H

    F --> I{Backend Team Review}
    I -->|Approved| J[Phase 2: Implementation]
    I -->|Changes Requested| F

    G --> K[TSK0008: Create README]
    H --> K
    D --> K
    E --> K

    K --> L[Requirements Complete]
    L --> M[Handoff to Backend Team]
    M --> J

    style B fill:#e1f5ff
    style C fill:#e1f5ff
    style D fill:#e1f5ff
    style G fill:#e1f5ff
    style F fill:#fff3cd
    style I fill:#fff3cd
    style J fill:#d4edda
```

## Current Links Implementation Flow

```mermaid
sequenceDiagram
    participant UI as ProjectLinksTab / TaskList
    participant Hook as useLink.handleLinkCreate()
    participant Service as linkService.createNewLink()
    participant API as links.createLink()
    participant FM as FileMaker (devLinks)

    UI->>Hook: Create link for project/task
    Hook->>Hook: Validate URL
    Hook->>Hook: Parse GitHub URL (optional)
    Hook->>Service: createNewLink(fkId, url)
    Service->>Service: URL validation
    Service->>API: createLink({ fkId, link })
    API->>FM: POST to devLinks layout
    FM-->>API: { recordId, ... }
    API-->>Service: FileMaker response
    Service-->>Hook: { response: { recordId } }
    Hook->>Hook: Build link object with metadata
    Hook-->>UI: { id, url, createdAt, metadata? }
    UI->>UI: Refresh project/task details
```

## Proposed Supabase Implementation Flow

```mermaid
sequenceDiagram
    participant UI as ProjectLinksTab / TaskList
    participant Hook as useLink.handleLinkCreate()
    participant Service as linkService.createNewLink()
    participant API as links.createLink()
    participant Backend as Backend API/Supabase

    UI->>Hook: Create link for project/task
    Hook->>Hook: Validate URL
    Hook->>Hook: Parse GitHub URL (optional)
    Hook->>Service: createNewLink(fkId, url)
    Service->>Service: URL validation
    Service->>API: createLink({ project_id/task_id, link })
    API->>Backend: POST /links
    Backend->>Backend: Validate parent entity exists
    Backend->>Backend: Insert into links table
    Backend-->>API: { id, link, project_id, created_at }
    API-->>Service: Supabase response
    Service-->>Hook: { id, url, created_at }
    Hook->>Hook: Build link object with metadata
    Hook-->>UI: { id, url, createdAt, metadata? }
    UI->>UI: Refresh project/task details
```

## Data Migration Workflow

```mermaid
graph TD
    A[Extract from FileMaker devLinks] --> B[Export to JSON/CSV]
    B --> C[Load FileMaker data]

    C --> D[For each link record]
    D --> E{Determine parent type}
    E -->|Project| F[Look up project_id in Supabase]
    E -->|Task| G[Look up task_id in Supabase]
    E -->|Customer| H[Look up customer_id in Supabase]

    F --> I[Build Supabase record]
    G --> I
    H --> I

    I --> J{Valid parent found?}
    J -->|Yes| K[Add to batch insert]
    J -->|No| L[Log orphaned link]

    K --> M{Batch size reached?}
    M -->|Yes| N[Bulk insert to Supabase]
    M -->|No| D

    N --> O{More records?}
    O -->|Yes| D
    O -->|No| P[Final batch insert]

    L --> Q[Review orphaned links]
    P --> R[Validation queries]
    R --> S[Compare counts]
    S --> T{Migration successful?}
    T -->|Yes| U[Complete]
    T -->|No| V[Review errors and retry]

    style N fill:#d4edda
    style P fill:#d4edda
    style L fill:#f8d7da
    style V fill:#fff3cd
```

## Schema Change Workflow

```mermaid
graph TD
    A[TSK0007: Create Backend Change Request] --> B[Document Required Changes]
    B --> C[Submit to User]
    C --> D[User forwards to Backend Team]
    D --> E{Backend Review}

    E -->|Approved| F[Backend implements changes]
    E -->|Needs revision| G[Update change request]
    G --> C

    F --> H[Add task_id column]
    H --> I[Modify constraints]
    I --> J[Create indexes]
    J --> K[Test in dev environment]
    K --> L{Tests pass?}

    L -->|Yes| M[Deploy to staging]
    L -->|No| N[Fix issues]
    N --> K

    M --> O[Validation]
    O --> P[Deploy to production]
    P --> Q[Update documentation]
    Q --> R[Notify frontend team]
    R --> S[Phase 2 can begin]

    style F fill:#d4edda
    style P fill:#d4edda
    style N fill:#fff3cd
    style G fill:#fff3cd
```

## Implementation Phases

### Phase 1: Requirements Documentation (Current)

1. **TSK0001**: Document current FileMaker implementation
   - API calls and data flow
   - UI components and user workflows
   - Service layer processing

2. **TSK0002**: Map FileMaker to Supabase data model
   - Field mappings
   - Identify schema gaps
   - Document required changes

3. **TSK0003**: Define API contracts
   - Endpoint specifications
   - Request/response formats
   - Validation rules

4. **TSK0004**: Document authorization requirements
   - RLS policies
   - Organization scoping
   - Access control

5. **TSK0005**: Create migration plan
   - Data export process
   - ID mapping strategy
   - Import and validation

6. **TSK0006**: Define acceptance criteria
   - Test cases
   - Edge cases
   - Success metrics

7. **TSK0007**: Backend change request
   - Schema modifications
   - Migration impact
   - Rollback plan

8. **TSK0008**: Create overview README
   - Quick reference
   - Link all documentation

### Phase 2: Backend Implementation (Future)

1. **Backend Team**: Review and approve requirements
2. **Backend Team**: Implement schema changes
3. **Backend Team**: Create API endpoints/RPCs
4. **Backend Team**: Implement RLS policies
5. **Backend Team**: Create migration scripts
6. **Backend Team**: Test in dev environment
7. **Backend Team**: Deploy to staging
8. **Backend Team**: Validate migration
9. **Backend Team**: Deploy to production

### Phase 3: Frontend Implementation (Future)

1. **Frontend Team**: Update `src/api/links.js` to use Supabase
2. **Frontend Team**: Update environment detection logic
3. **Frontend Team**: Test UI workflows
4. **Frontend Team**: Validate data integrity
5. **Frontend Team**: Deploy and monitor

## Key Decision Points

1. **Schema Design**: Single table with nullable FKs vs. junction tables
   - Decision: Use existing `links` table with added `task_id` column
   - Rationale: Simpler, matches current Supabase pattern

2. **API Style**: REST endpoints vs. PostgreSQL functions
   - Decision: To be determined by backend team
   - Recommendation: REST for consistency with other features

3. **Migration Strategy**: One-time bulk import vs. incremental
   - Decision: One-time bulk import after cutover
   - Rationale: Cleaner, ensures data consistency

4. **Constraint Enforcement**: Database-level vs. application-level
   - Decision: Database-level check constraint
   - Rationale: Data integrity guarantee

## Success Metrics

- All FileMaker links migrated to Supabase
- Zero orphaned links (all have valid parent associations)
- UI functionality unchanged (transparent to users)
- No downtime during migration
- Backend API response times < 200ms
- All acceptance criteria passing
