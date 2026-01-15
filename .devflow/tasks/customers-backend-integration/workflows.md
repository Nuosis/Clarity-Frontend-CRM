# Customer Backend Integration Workflows

This document provides visual workflows for the customer backend integration implementation.

## Implementation Flow

```mermaid
graph TD
    A[Start: Customer Backend Integration] --> B[TSK0001: Create Backend API Client]
    B --> C[TSK0002: Environment-Aware Routing]
    B --> D[TSK0003: Data Transformations]

    D --> E[TSK0004: Update customerService]
    C --> F[TSK0005: Update useCustomer Hook]
    E --> F

    F --> G[TSK0006: Add Search]
    F --> H[TSK0007: Update CustomerDetails]
    F --> I[TSK0008: Update CustomerForm]

    C --> J[TSK0009: Organization Context]
    J --> K[TSK0010: Error Handling]
    F --> K

    F --> L[TSK0011: Pagination Support]

    E --> M[TSK0012: Unit Tests]
    C --> N[TSK0013: Integration Tests]

    M --> O[TSK0014: Documentation]
    N --> O

    H --> P[TSK0015: E2E Testing]
    I --> P
    K --> P
    L --> P

    P --> Q[Complete]

    style A fill:#e1f5ff
    style Q fill:#d4edda
    style B fill:#fff3cd
    style C fill:#fff3cd
    style D fill:#fff3cd
    style E fill:#fff3cd
    style F fill:#fff3cd
    style J fill:#fff3cd
    style K fill:#fff3cd
```

## Data Flow: Web App Environment

```mermaid
sequenceDiagram
    participant UI as Customer Component
    participant Hook as useCustomer Hook
    participant API as Customer API Client
    participant DS as dataService
    participant Backend as Backend API

    UI->>Hook: Load customers
    Hook->>API: fetchCustomers()
    API->>DS: getEnvironmentContext()
    DS-->>API: {type: 'webapp', auth: {...}}
    API->>DS: generateBackendAuthHeader()
    DS-->>API: JWT token
    API->>Backend: GET /api/customers<br/>Authorization: Bearer {JWT}<br/>X-Organization-ID: {org_id}
    Backend-->>API: {customers: [...], total: 100}
    API->>Hook: Processed response
    Hook->>UI: Update state with customers

    Note over UI,Backend: All requests include JWT + Org ID
```

## Data Flow: FileMaker Environment

```mermaid
sequenceDiagram
    participant UI as Customer Component
    participant Hook as useCustomer Hook
    participant API as Customer API Client
    participant DS as dataService
    participant FM as FileMaker Bridge

    UI->>Hook: Load customers
    Hook->>API: fetchCustomers()
    API->>DS: getEnvironmentContext()
    DS-->>API: {type: 'filemaker', auth: {...}}
    API->>FM: FMGofer.PerformScript()<br/>'JS * Fetch Data'<br/>{layout: 'devCustomers'}
    FM-->>API: FileMaker response
    API->>Hook: Processed FileMaker data
    Hook->>UI: Update state with customers

    Note over UI,FM: FileMaker path unchanged
```

## Data Transformation Flow

```mermaid
flowchart TD
    A[Backend Response] --> B{Data Source?}
    B -->|Backend API| C[Process Backend Format]
    B -->|FileMaker| D[Process FileMaker Format]

    C --> E[Extract Nested Data]
    E --> F[Emails Array]
    E --> G[Phones Array]
    E --> H[Addresses Array]

    F --> I[Find Primary Email]
    G --> J[Find Primary Phone]
    H --> K[Find Primary Address]

    D --> L[Flat Fields]
    L --> M[Single Email]
    L --> N[Single Phone]
    L --> O[Address Fields]

    I --> P[Unified Customer Object]
    J --> P
    K --> P
    M --> P
    N --> P
    O --> P

    P --> Q[UI Component]

    style A fill:#e1f5ff
    style Q fill:#d4edda
    style C fill:#fff3cd
    style D fill:#fff3cd
```

## Customer Create Workflow

```mermaid
sequenceDiagram
    participant User
    participant Form as CustomerForm
    participant Hook as useCustomer Hook
    participant API as Customer API
    participant Backend

    User->>Form: Fill customer details
    User->>Form: Add email
    User->>Form: Add phone
    User->>Form: Add address
    User->>Form: Submit form

    Form->>Form: Validate fields
    Form->>Hook: handleCustomerCreate(data)
    Hook->>Hook: validateCustomerData(data)
    Hook->>Hook: Format for backend

    Hook->>API: createCustomer(formattedData)
    API->>Backend: POST /api/customers<br/>{name, business_name, type,<br/>emails: [...], phones: [...], addresses: [...]}

    Backend-->>API: 201 Created<br/>{id, ...customerData}
    API-->>Hook: Success response
    Hook->>Hook: Update local state
    Hook-->>Form: Customer created
    Form->>User: Show success message

    Note over Hook,Backend: Organization ID auto-assigned from JWT
```

## Customer Update Workflow

```mermaid
sequenceDiagram
    participant User
    participant Form as CustomerForm
    participant Hook as useCustomer Hook
    participant API as Customer API
    participant Backend

    User->>Form: Edit customer details
    User->>Form: Modify email
    User->>Form: Submit form

    Form->>Hook: handleCustomerUpdate(id, data)
    Hook->>Hook: Validate changes
    Hook->>Hook: Format for backend

    Hook->>API: updateCustomer(id, formattedData)
    API->>Backend: PATCH /api/customers/{id}<br/>{...partial updates}

    Backend-->>API: 200 OK<br/>{id, ...updatedCustomer}
    API-->>Hook: Success response
    Hook->>Hook: Update local state
    Hook-->>Form: Customer updated
    Form->>User: Show success message

    Note over Backend: Related records (emails, phones)<br/>updated transactionally
```

## Error Handling Flow

```mermaid
flowchart TD
    A[API Request] --> B{Response Status}

    B -->|200/201| C[Success]
    B -->|400| D[Validation Error]
    B -->|401| E[Auth Error]
    B -->|403| F[Permission Error]
    B -->|404| G[Not Found]
    B -->|500| H[Server Error]
    B -->|Network| I[Network Error]

    C --> J[Update State]
    C --> K[Show Success]

    D --> L[Extract Field Errors]
    L --> M[Highlight Form Fields]
    L --> N[Show Error Message]

    E --> O[Clear Auth Token]
    O --> P[Redirect to Login]

    F --> Q[Show Permission Denied]
    F --> R[Log Security Event]

    G --> S[Show Not Found]
    G --> T[Refresh List]

    H --> U[Show Server Error]
    H --> V[Offer Retry]

    I --> W[Show Offline Message]
    I --> X[Queue for Retry]

    style C fill:#d4edda
    style D fill:#f8d7da
    style E fill:#f8d7da
    style F fill:#f8d7da
    style G fill:#fff3cd
    style H fill:#f8d7da
    style I fill:#f8d7da
```

## Environment Detection Flow

```mermaid
flowchart TD
    A[App Initialization] --> B{window.FileMaker exists?}

    B -->|Yes| C[FileMaker Environment]
    B -->|No| D[Web App Environment]

    C --> E[Set ENVIRONMENT_TYPES.FILEMAKER]
    C --> F[Set AUTH_METHODS.FILEMAKER]
    C --> G[Initialize FMGofer]

    D --> H[Set ENVIRONMENT_TYPES.WEBAPP]
    D --> I[Set AUTH_METHODS.SUPABASE]
    D --> J[Initialize Supabase]

    G --> K[Route to FileMaker Bridge]
    J --> L[Route to Backend API]

    K --> M[Customer Operations]
    L --> M

    style C fill:#fff3cd
    style D fill:#e1f5ff
    style M fill:#d4edda
```

## Pagination Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as Customer List UI
    participant Hook as useCustomer Hook
    participant API as Customer API
    participant Backend

    User->>UI: Load page 1
    UI->>Hook: loadCustomers(limit=50, offset=0)
    Hook->>API: fetchCustomers({limit: 50, offset: 0})
    API->>Backend: GET /api/customers?limit=50&offset=0
    Backend-->>API: {customers: [...], total: 250}
    API-->>Hook: Response with pagination metadata
    Hook->>UI: Update state (page 1/5)

    User->>UI: Click "Next Page"
    UI->>Hook: loadCustomers(limit=50, offset=50)
    Hook->>API: fetchCustomers({limit: 50, offset: 50})
    API->>Backend: GET /api/customers?limit=50&offset=50
    Backend-->>API: {customers: [...], total: 250}
    API-->>Hook: Response with pagination metadata
    Hook->>UI: Update state (page 2/5)

    Note over User,Backend: Pagination only in web app environment
```

## Search Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as Search Input
    participant Hook as useCustomer Hook
    participant API as Customer API
    participant Backend

    User->>UI: Type "acme"
    UI->>UI: Debounce 300ms
    UI->>Hook: handleSearch("acme")
    Hook->>API: searchCustomers("acme")
    API->>Backend: GET /api/customers/search?q=acme&limit=20
    Backend-->>API: {results: [...]}
    API-->>Hook: Search results
    Hook->>UI: Update search results state
    UI->>User: Display matching customers

    User->>UI: Clear search
    UI->>Hook: handleSearch("")
    Hook->>Hook: Clear search results
    Hook->>UI: Show all customers

    Note over UI,Backend: Debouncing prevents excessive API calls
```

## Testing Strategy Flow

```mermaid
flowchart TD
    A[Testing Strategy] --> B[Unit Tests]
    A --> C[Integration Tests]
    A --> D[E2E Tests]

    B --> E[Data Transformations]
    B --> F[Validation Functions]
    B --> G[Helper Utilities]

    C --> H[API Client]
    C --> I[Hook Logic]
    C --> J[Service Layer]

    D --> K[FileMaker Environment]
    D --> L[Web App Environment]

    K --> M[CRUD Operations]
    K --> N[Error Scenarios]

    L --> M
    L --> N
    L --> O[Pagination]
    L --> P[Search]

    E --> Q[Run Tests]
    F --> Q
    G --> Q
    H --> Q
    I --> Q
    J --> Q
    M --> Q
    N --> Q
    O --> Q
    P --> Q

    Q --> R{All Pass?}
    R -->|Yes| S[Deploy]
    R -->|No| T[Fix Issues]
    T --> Q

    style S fill:#d4edda
    style T fill:#f8d7da
```
