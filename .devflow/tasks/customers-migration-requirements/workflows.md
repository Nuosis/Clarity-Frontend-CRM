# Customers Migration Requirements Workflows

## Documentation Creation Flow

```mermaid
graph TD
    A[Create Folder Structure] --> B[Investigate Current Implementation]
    A --> C[Investigate Supabase Schema]
    B --> D[Document Current Implementation]
    C --> E[Analyze Related Tables]
    D --> F[Map Data Models]
    E --> F
    F --> G[Define API Contracts]
    B --> H[Analyze Dual-Write]
    H --> I[Design ID Reconciliation]
    F --> I
    I --> J[Create Migration Plan]
    D --> K[Document Edge Cases]
    G --> K
    C --> L[Document Authorization]
    K --> M[Define Acceptance Criteria]
    J --> M
    G --> M
    M --> N[Review & Validate]
    D --> N
    F --> N
    G --> N
    L --> N
    J --> N
```

## Current Implementation Analysis

```mermaid
sequenceDiagram
    participant UI as UI Components
    participant Hook as useCustomer Hook
    participant API as customers.js API
    participant FM as FileMaker Bridge
    participant SB as Supabase (Sync)

    UI->>Hook: loadCustomers()
    Hook->>API: fetchCustomers()
    API->>FM: fetchDataFromFileMaker(devCustomers)
    FM-->>API: FileMaker Response
    API-->>Hook: Raw Data
    Hook->>Hook: processCustomerData()
    Hook->>Hook: sortCustomers()
    Hook-->>UI: Processed Customers

    Note over FM,SB: Dual-Write Pattern
    UI->>Hook: handleCustomerUpdate(id, data)
    Hook->>API: updateCustomer(id, data)
    API->>FM: Update in FileMaker
    FM-->>API: Success
    Hook->>SB: updateCustomerInSupabase()
    SB-->>Hook: Sync Success
    Hook-->>UI: Update Complete
```

## Data Model Mapping Process

```mermaid
flowchart LR
    A[FileMaker devCustomers] --> B[Identify All Fields]
    B --> C[Map to Supabase customers]
    C --> D[Map to Related Tables]
    D --> E[customer_contacts]
    D --> F[customer_email]
    D --> G[customer_phone]
    D --> H[customer_address]
    D --> I[customer_sales]
    E --> J[Document Relationships]
    F --> J
    G --> J
    H --> J
    I --> J
    J --> K[Define Constraints]
    K --> L[Data Model Mapping Doc]
```

## API Contract Definition

```mermaid
flowchart TD
    A[Current API Operations] --> B[List Customers]
    A --> C[Get Customer by ID]
    A --> D[Create Customer]
    A --> E[Update Customer]
    A --> F[Delete Customer]
    A --> G[Toggle Status]
    A --> H[Filter Active]

    B --> I[Define Endpoint]
    C --> I
    D --> I
    E --> I
    F --> I
    G --> I
    H --> I

    I --> J[Request Format]
    I --> K[Response Format]
    I --> L[Error Handling]
    I --> M[Auth Requirements]

    J --> N[API Contracts Doc]
    K --> N
    L --> N
    M --> N
```

## Migration Strategy

```mermaid
flowchart TD
    A[Analyze Current Data] --> B[Export FileMaker Data]
    B --> C[Transform Data Format]
    C --> D[Map IDs]
    D --> E[Create Lookup Table]
    E --> F[Load to Supabase]
    F --> G[Validate Data]
    G --> H{Valid?}
    H -->|No| I[Fix Issues]
    I --> F
    H -->|Yes| J[Update Relationships]
    J --> K[Test Cutover]
    K --> L{Success?}
    L -->|No| M[Rollback]
    M --> N[Fix Issues]
    N --> K
    L -->|Yes| O[Production Cutover]
    O --> P[Monitor]
```

## ID Reconciliation Flow

```mermaid
graph LR
    A[FileMaker __ID] --> B[UUID Generation]
    A --> C[recordId]
    B --> D[Supabase UUID]
    C --> E[FileMaker Internal ID]
    D --> F[Primary Key]
    B --> G[ID Mapping Table]
    C --> G
    G --> H[Lookup Service]
    H --> I[Frontend Compatibility]
```

## Task Dependencies

```mermaid
gantt
    title Customers Migration Requirements Tasks
    dateFormat YYYY-MM-DD
    section Setup
    Create Folder Structure           :done, t1, 2026-01-10, 1d
    section Investigation
    Document Current Implementation   :t2, after t1, 2d
    Investigate Supabase Schema      :t3, after t1, 1d
    Analyze Dual-Write Patterns      :t7, after t2, 1d
    section Mapping
    Map Data Models                   :t4, after t2 t3, 2d
    Design ID Reconciliation         :t8, after t4 t7, 1d
    section Specification
    Define API Contracts             :t5, after t2 t4, 2d
    Document Authorization           :t6, after t3, 1d
    Document Edge Cases              :t10, after t2 t5, 1d
    section Planning
    Create Migration Plan            :t9, after t8, 2d
    Define Acceptance Criteria       :t11, after t5 t9 t10, 1d
    section Validation
    Review & Validate                :t12, after t2 t4 t5 t6 t9 t11, 1d
```

## Documentation Review Process

```mermaid
flowchart TD
    A[All Docs Created] --> B[Self Review]
    B --> C{Complete?}
    C -->|No| D[Add Missing Content]
    D --> B
    C -->|Yes| E{Consistent?}
    E -->|No| F[Fix Inconsistencies]
    F --> B
    E -->|Yes| G{Actionable?}
    G -->|No| H[Add Details/Examples]
    H --> B
    G -->|Yes| I[Ready for Backend Team]
```
