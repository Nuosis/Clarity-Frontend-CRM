# Links Backend Integration - Workflows

## Implementation Flow

```mermaid
graph TD
    A[Start: Verify Backend APIs] --> B[TSK0001: Test Endpoints]
    B --> C{APIs Available?}
    C -->|No| D[Block: Wait for Backend]
    C -->|Yes| E[TSK0002: Refactor API Layer]
    E --> F[TSK0003: Update Service Layer]
    F --> G[TSK0004: Update Processing Functions]
    F --> H[TSK0005: Enhance useLink Hook]
    H --> I[TSK0006: Update ProjectLinksTab]
    H --> J[TSK0007: Update Task Links]
    G --> I
    G --> J
    I --> K[TSK0008: Add Edit/Delete UI]
    J --> K
    E --> L[TSK0009: Update Tests]
    F --> L
    H --> L
    I --> M[TSK0010: Integration Testing]
    J --> M
    K --> M
    L --> M
    M --> N{All Tests Pass?}
    N -->|No| O[Fix Issues]
    O --> M
    N -->|Yes| P[Complete]
```

## Data Flow: Create Link (New Backend)

```mermaid
sequenceDiagram
    participant User
    participant ProjectLinksTab
    participant useLink
    participant linkService
    participant linksAPI
    participant Backend
    participant Database

    User->>ProjectLinksTab: Click "New Link"
    ProjectLinksTab->>User: Show TextInput
    User->>ProjectLinksTab: Enter URL
    ProjectLinksTab->>useLink: handleLinkCreate(projectId, url)

    useLink->>useLink: Validate URL
    useLink->>useLink: Parse GitHub URL (if applicable)
    useLink->>linkService: createNewLink(projectId, url, 'project')

    linkService->>linkService: Validate inputs
    linkService->>linksAPI: createLink({ project_id, link })

    linksAPI->>linksAPI: Generate HMAC auth header
    linksAPI->>Backend: POST /links { project_id, link }

    Backend->>Backend: Validate request
    Backend->>Backend: Check authorization
    Backend->>Database: INSERT INTO links
    Database-->>Backend: Return inserted record

    Backend-->>linksAPI: 201 Created { id, link, created_at, ... }
    linksAPI-->>linkService: LinkResponse
    linkService-->>useLink: Formatted link object

    useLink->>useLink: Augment with GitHub metadata (if applicable)
    useLink-->>ProjectLinksTab: Return new link

    ProjectLinksTab->>ProjectLinksTab: Update local state
    ProjectLinksTab->>User: Display new link
```

## Data Flow: List Links (New Backend)

```mermaid
sequenceDiagram
    participant ProjectLinksTab
    participant useProject
    participant projectService
    participant linksAPI
    participant Backend
    participant Database

    ProjectLinksTab->>useProject: loadProjectDetails(projectId)
    useProject->>projectService: fetchProject(projectId)
    projectService->>linksAPI: getLinks({ project_id: projectId })

    linksAPI->>linksAPI: Generate HMAC auth header
    linksAPI->>Backend: GET /links?project_id={projectId}

    Backend->>Backend: Check authorization
    Backend->>Database: SELECT * FROM links WHERE project_id = $1
    Database-->>Backend: Return links array

    Backend-->>linksAPI: 200 OK [LinkResponse, LinkResponse, ...]
    linksAPI-->>projectService: Links array

    projectService->>projectService: processProjectLinks(links)
    projectService-->>useProject: Formatted links

    useProject->>useProject: Update project state
    useProject-->>ProjectLinksTab: Project with links

    ProjectLinksTab->>ProjectLinksTab: Render links in grid
```

## Schema Migration Flow

```mermaid
graph LR
    A[FileMaker Format] -->|Transform| B[Backend Format]

    A1["__ID: FM_UUID"] -.->|Map| B1["id: UUID"]
    A2["link: URL"] -->|Direct| B2["link: URL"]
    A3["_fkID: Polymorphic"] -->|Split| B3["project_id: UUID"]
    A3 -->|Split| B4["task_id: UUID"]
    A3 -->|Split| B5["customer_id: UUID"]
    A4["~creationTimestamp"] -->|Format| B6["created_at: ISO8601"]
    A5["~modificationTimestamp"] -->|Format| B7["updated_at: ISO8601"]
    A6["~CreatedBy: Username"] -.->|Lookup| B8["created_by: UUID"]

    B9["organization_id: UUID"] -.->|New Field| B
    B10["updated_by: UUID"] -.->|New Field| B

    style A fill:#f9f,stroke:#333,stroke-width:2px
    style B fill:#9f9,stroke:#333,stroke-width:2px
    style A1 fill:#fcc
    style A2 fill:#fcc
    style A3 fill:#fcc
    style A4 fill:#fcc
    style A5 fill:#fcc
    style A6 fill:#fcc
    style B1 fill:#cfc
    style B2 fill:#cfc
    style B3 fill:#cfc
    style B4 fill:#cfc
    style B5 fill:#cfc
    style B6 fill:#cfc
    style B7 fill:#cfc
    style B8 fill:#cfc
    style B9 fill:#ff9
    style B10 fill:#ff9
```

## API Layer Refactor

```mermaid
graph TD
    A["BEFORE: links.js"] -->|Calls| B[FileMaker devLinks]
    A -->|Uses| C[fm-gofer bridge]

    D["AFTER: links.js"] -->|Calls| E[Backend /links]
    D -->|Uses| F[HMAC Auth]

    E --> E1[GET /links?filters]
    E --> E2[POST /links]
    E --> E3[PATCH /links/:id]
    E --> E4[DELETE /links/:id]

    style A fill:#fcc,stroke:#333,stroke-width:2px
    style B fill:#fcc
    style C fill:#fcc
    style D fill:#cfc,stroke:#333,stroke-width:2px
    style E fill:#cfc
    style F fill:#cfc
```

## Error Handling Flow

```mermaid
graph TD
    A[API Call] --> B{Success?}
    B -->|Yes| C[Return LinkResponse]
    B -->|No| D{Error Type}

    D -->|401/403| E[Auth Error]
    D -->|404| F[Not Found]
    D -->|422| G[Validation Error]
    D -->|500| H[Server Error]
    D -->|Network| I[Network Error]

    E --> J[Show: Authentication failed]
    F --> K[Show: Link not found]
    G --> L[Show: Invalid input]
    H --> M[Show: Server error, try again]
    I --> N[Show: Network error, check connection]

    J --> O[Revert Optimistic Update]
    K --> O
    L --> O
    M --> O
    N --> O

    O --> P[Log Error to Console]
    P --> Q[Update Error State]
```

## Testing Strategy

```mermaid
graph TD
    A[Testing Phases] --> B[Unit Tests]
    A --> C[Integration Tests]
    A --> D[Manual Tests]

    B --> B1[API Functions]
    B --> B2[Service Functions]
    B --> B3[Hook Operations]
    B --> B4[Processing Functions]

    C --> C1[Create Link Flow]
    C --> C2[List Links Flow]
    C --> C3[Update Link Flow]
    C --> C4[Delete Link Flow]
    C --> C5[GitHub Integration]

    D --> D1[UI Interactions]
    D --> D2[Error Handling]
    D --> D3[Optimistic Updates]
    D --> D4[Multi-Entity Support]

    B1 --> E{All Pass?}
    B2 --> E
    B3 --> E
    B4 --> E
    C1 --> E
    C2 --> E
    C3 --> E
    C4 --> E
    C5 --> E
    D1 --> E
    D2 --> E
    D3 --> E
    D4 --> E

    E -->|No| F[Fix Issues]
    E -->|Yes| G[Ready for Deployment]
    F --> A
```

## Deployment Strategy

```mermaid
graph TD
    A[Pre-Deployment] --> B[Verify Backend Ready]
    B --> C[Backend Migration Complete?]
    C -->|No| D[Wait for Backend]
    C -->|Yes| E[Deploy Frontend]

    E --> F[Feature Flag: Use Backend]
    F --> G{Environment}

    G -->|Development| H[Enable Backend API]
    G -->|Staging| I[Enable Backend API]
    G -->|Production| J[Gradual Rollout]

    J --> K[Monitor Errors]
    K --> L{Errors?}
    L -->|Yes| M[Rollback to FileMaker]
    L -->|No| N[Increase Traffic %]

    N --> O{100% Traffic?}
    O -->|No| K
    O -->|Yes| P[Remove FileMaker Code]

    H --> Q[Test All Features]
    I --> Q
    P --> Q

    Q --> R[Complete]
```
