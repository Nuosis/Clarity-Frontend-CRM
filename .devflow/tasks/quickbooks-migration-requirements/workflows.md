# QuickBooks Migration Requirements - Workflows

## Current QuickBooks Flow (FileMaker-Dependent)

```mermaid
sequenceDiagram
    participant UI as Financial UI Panel
    participant FM as FileMaker API
    participant FMS as FileMaker Script
    participant QB as QuickBooks

    UI->>FM: initializeQuickBooks(params)
    Note over FM: params: {custId, recordsByProject}
    FM->>FMS: FileMaker.PerformScript("Initialize QB via JS", payload)
    Note over FMS: Fire-and-forget execution
    FMS->>QB: Process unbilled records
    QB-->>FMS: (async response)
    Note over UI: No feedback to user
```

## Target QuickBooks Flow (Backend-Driven)

```mermaid
sequenceDiagram
    participant UI as Financial UI Panel
    participant API as Backend API
    participant SB as Supabase
    participant QB as QuickBooks

    UI->>API: POST /quickbooks/initialize
    Note over API: HMAC authentication<br/>Organization scoping
    API->>SB: Fetch QB tokens for org
    SB-->>API: OAuth tokens
    API->>QB: Check token validity
    alt Token expired
        API->>QB: Refresh token
        QB-->>API: New tokens
        API->>SB: Update stored tokens
    end
    API->>QB: Process unbilled records
    QB-->>API: Invoice created
    API-->>UI: Success response with invoice ID
    Note over UI: User feedback displayed
```

## OAuth Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as Frontend
    participant API as Backend API
    participant SB as Supabase
    participant QB as QuickBooks

    User->>UI: Click "Connect QuickBooks"
    UI->>API: GET /quickbooks/authorize
    API-->>UI: Authorization URL + state
    UI->>QB: Redirect to QB OAuth
    QB->>User: Login & authorize
    QB-->>UI: Redirect with code & state
    UI->>API: POST /quickbooks/oauth/callback
    Note over API: Validate state<br/>Exchange code for tokens
    API->>QB: Exchange authorization code
    QB-->>API: Access + refresh tokens
    API->>SB: Store tokens with org_id
    SB-->>API: Tokens saved
    API-->>UI: Connection successful
    UI->>User: Display success message
```

## Token Refresh Flow

```mermaid
sequenceDiagram
    participant API as Backend API
    participant SB as Supabase
    participant QB as QuickBooks

    API->>SB: Fetch QB tokens for org
    SB-->>API: Current tokens
    API->>QB: API request with access token
    alt Token valid
        QB-->>API: Success response
    else Token expired (401)
        API->>QB: Refresh token request
        QB-->>API: New access + refresh tokens
        API->>SB: Update stored tokens
        SB-->>API: Tokens updated
        API->>QB: Retry original request
        QB-->>API: Success response
    end
```

## Invoice Generation Flow

```mermaid
sequenceDiagram
    participant UI as Financial UI Panel
    participant API as Backend API
    participant SB as Supabase
    participant QB as QuickBooks

    UI->>API: POST /quickbooks/initialize
    Note over UI,API: Params: customer_id, record_ids
    API->>SB: Fetch unbilled records
    SB-->>API: Financial records
    API->>SB: Fetch/validate QB customer
    alt Customer exists in QB
        SB-->>API: QB customer ID
    else Customer not in QB
        API->>QB: Create customer
        QB-->>API: New customer ID
        API->>SB: Store QB customer mapping
    end
    API->>QB: Create invoice with line items
    QB-->>API: Invoice created
    API->>SB: Update records as billed
    SB-->>API: Records updated
    API-->>UI: Success with invoice URL
    UI->>User: Display success message
```

## Error Handling Flow

```mermaid
flowchart TD
    Start[QB Operation Request] --> Auth{Valid<br/>Credentials?}
    Auth -->|No| GetTokens[Fetch from Supabase]
    GetTokens --> CheckTokens{Tokens<br/>Exist?}
    CheckTokens -->|No| Error1[Return: Not Connected]
    CheckTokens -->|Yes| ValidateTokens{Token<br/>Valid?}
    Auth -->|Yes| ValidateTokens

    ValidateTokens -->|No| Refresh[Refresh Token]
    Refresh --> RefreshSuccess{Refresh<br/>Succeeded?}
    RefreshSuccess -->|No| Error2[Return: Reauthorization Needed]
    RefreshSuccess -->|Yes| UpdateTokens[Update Supabase]

    ValidateTokens -->|Yes| Execute[Execute QB Operation]
    UpdateTokens --> Execute

    Execute --> QBSuccess{QB API<br/>Success?}
    QBSuccess -->|Yes| UpdateDB[Update Database]
    UpdateDB --> Success[Return Success]

    QBSuccess -->|No| Retry{Retry<br/>Count < 3?}
    Retry -->|Yes| Wait[Wait with backoff]
    Wait --> Execute
    Retry -->|No| Error3[Return: Operation Failed]

    Error1 --> End
    Error2 --> End
    Error3 --> End
    Success --> End
```

## Implementation Phases

```mermaid
gantt
    title QuickBooks Migration Timeline
    dateFormat YYYY-MM-DD
    section Phase 1: Requirements
    Create documentation structure    :done, p1t1, 2026-01-10, 1d
    Document current implementation   :p1t2, after p1t1, 2d
    Define API contracts              :p1t3, after p1t2, 2d
    Create backend change request     :p1t4, after p1t3, 1d

    section Phase 2: Backend (Backend Team)
    Implement QB initialization       :p2t1, after p1t4, 5d
    Implement token management        :p2t2, after p2t1, 3d
    Testing and validation            :p2t3, after p2t2, 2d

    section Phase 3: Frontend
    Replace FileMaker calls           :p3t1, after p2t3, 3d
    Update error handling             :p3t2, after p3t1, 2d
    User acceptance testing           :p3t3, after p3t2, 2d

    section Phase 4: Cutover
    Deploy to staging                 :p4t1, after p3t3, 1d
    Production deployment             :p4t2, after p4t1, 1d
    Monitor and validate              :p4t3, after p4t2, 3d
```
