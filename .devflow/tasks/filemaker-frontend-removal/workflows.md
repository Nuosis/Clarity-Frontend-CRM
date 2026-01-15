# FileMaker Frontend Removal - Workflows

## Overview Workflow

```mermaid
graph TD
    A[Start: FileMaker Removal] --> B[Phase 1: Prerequisites]
    B --> C[Phase 2: Feature API Updates]
    C --> D[Phase 3: Core Infrastructure]
    D --> E[Phase 4: Cleanup]
    E --> F[Phase 5: Finalization]
    F --> G[Complete: Supabase-Only Frontend]

    B --> B1[Verify Backend APIs]
    B --> B2[Audit Codebase]
    B --> B3[Create Feature Flags]

    C --> C1[Update All API Layers]
    C --> C2[Update Services]
    C --> C3[Test Each Feature]

    D --> D1[Remove Environment Detection]
    D --> D2[Simplify Auth Flow]
    D --> D3[Update Data Service]

    E --> E1[Remove FileMaker Files]
    E --> E2[Remove Dependencies]
    E --> E3[Update Documentation]

    F --> F1[Remove Feature Flags]
    F --> F2[Final Testing]
    F --> F3[Migration Report]
```

## Phase 1: Prerequisites & Planning

```mermaid
graph LR
    A[TSK0001: Verify Backend APIs] --> B[TSK0002: Audit Codebase]
    B --> C[TSK0003: Create Feature Flags]

    A --> A1[Check Customers API]
    A --> A2[Check Projects API]
    A --> A3[Check Tasks API]
    A --> A4[Check Notes API]
    A --> A5[Check Links API]
    A --> A6[Check Financial API]
    A --> A7[Check QuickBooks API]

    B --> B1[Inventory API Calls]
    B --> B2[Inventory Auth Code]
    B --> B3[Inventory Environment Detection]
    B --> B4[Inventory Config]
    B --> B5[Create Audit Report]

    C --> C1[Create useFeatureFlag Hook]
    C --> C2[Create FeatureFlagProvider]
    C --> C3[Add Flag Controls]
```

## Phase 2: Feature API Migration

```mermaid
graph TD
    A[Feature API Updates] --> B[TSK0004: Customers API]
    A --> C[TSK0005: Projects API]
    A --> D[TSK0006: Tasks API]
    A --> E[TSK0007: Notes API]
    A --> F[TSK0008: Links API]
    A --> G[TSK0009: Financial Records API]
    A --> H[TSK0010: QuickBooks API]

    B --> B1[Replace fetchCustomers]
    B --> B2[Replace fetchCustomerById]
    B --> B3[Replace createCustomer]
    B --> B4[Replace updateCustomer]
    B --> B5[Add Feature Flag]
    B --> B6[Test Customers Flow]

    D --> D1[Replace Task CRUD]
    D --> D2[Replace Timer Operations]
    D --> D3[Update Financial Record Creation]
    D --> D4[Add Feature Flag]
    D --> D5[Test Tasks & Timer]

    H --> H1[Remove FM Script Calls]
    H --> H2[Add Backend QB Endpoints]
    H --> H3[Update Financial UI]
    H --> H4[Test QB Integration]
```

## Phase 3: Core Infrastructure Removal

```mermaid
graph TD
    A[Core Infrastructure] --> B[Service Layer]
    A --> C[Authentication]
    A --> D[Data Routing]

    B --> B1[TSK0011: Update dualWriteService]
    B --> B2[TSK0012: Remove FM Reconciliation]
    B --> B3[TSK0013: Update initializationService]

    C --> C1[TSK0014: Update SignIn Component]
    C --> C2[Remove FileMaker Auth Flow]
    C --> C3[Remove window.FileMaker Check]
    C --> C4[Keep Only Supabase Auth]

    D --> D1[TSK0015: Simplify dataService]
    D --> D2[Remove ENVIRONMENT_TYPES.FILEMAKER]
    D --> D3[Remove AUTH_METHODS.FILEMAKER]
    D --> D4[Remove Environment Context]
    D --> D5[Single API Path]

    B1 --> E[TSK0016: Remove useFileMakerBridge]
    E --> F[TSK0017: Delete FileMaker API Files]
```

## Phase 4: Dependencies & Documentation

```mermaid
graph LR
    A[Cleanup Phase] --> B[TSK0018: Remove fm-gofer]
    A --> C[TSK0019: Remove FM Env Vars]
    A --> D[TSK0020: Remove FM Deploy Scripts]

    A --> E[Documentation]
    E --> E1[TSK0021: Update CLAUDE.md]
    E --> E2[TSK0022: Update README.md]

    E1 --> E1A[Remove FM Architecture]
    E1 --> E1B[Update Development Guidelines]
    E1 --> E1C[Add Migration History]

    B --> B1[Edit package.json]
    B --> B2[Run npm install]
    B --> B3[Verify Build]
```

## Phase 5: Testing & Finalization

```mermaid
graph TD
    A[Testing Phase] --> B[TSK0023: Update Test Mocks]
    B --> C[TSK0024: Full Regression Tests]
    C --> D[TSK0025: Remove Feature Flags]

    B --> B1[Remove FM Fixtures]
    B --> B2[Add Backend API Mocks]
    B --> B3[Update Test Data Shapes]

    C --> C1[Test Authentication]
    C --> C2[Test Customers CRUD]
    C --> C3[Test Projects CRUD]
    C --> C4[Test Tasks & Timer]
    C --> C5[Test Notes & Links]
    C --> C6[Test Financial Records]
    C --> C7[Test QuickBooks Integration]
    C --> C8[Test User Workflows]

    C --> E{All Tests Pass?}
    E -->|Yes| D
    E -->|No| F[Fix Issues]
    F --> C

    D --> D1[Remove Feature Flag System]
    D --> D2[Hard-Code Backend Paths]
    D --> D3[Final Cleanup]
    D --> D4[Create Migration Report]
```

## Data Flow: Before vs After

### Before (Dual Environment)
```mermaid
graph TD
    A[App Start] --> B{Environment Detection}
    B -->|FileMaker| C[FileMaker Auth]
    B -->|Web App| D[Supabase Auth]

    C --> E[dataService Routes]
    D --> E

    E --> F{Request Type}
    F -->|FileMaker Env| G[fm-gofer Bridge]
    F -->|Web App| H[Backend API]

    G --> I[FileMaker Layouts]
    H --> J[Supabase + Backend]

    I --> K[dualWriteService]
    K --> J
```

### After (Supabase-Only)
```mermaid
graph TD
    A[App Start] --> B[Supabase Auth]
    B --> C[dataService]
    C --> D[Backend API + Supabase]
    D --> E[Features]

    E --> E1[Customers]
    E --> E2[Projects]
    E --> E3[Tasks]
    E --> E4[Notes]
    E --> E5[Links]
    E --> E6[Financial Records]
    E --> E7[QuickBooks]
```

## API Migration Pattern

```mermaid
graph LR
    A[FileMaker API Call] --> B{Feature Flag}
    B -->|use_filemaker=true| C[fm-gofer Bridge]
    B -->|use_filemaker=false| D[Backend API]

    C --> E[FileMaker Layout]
    D --> F[Supabase + Backend]

    E --> G[Response Normalization]
    F --> G

    G --> H[Return to Component]

    style C fill:#ffcccc
    style E fill:#ffcccc
    style D fill:#ccffcc
    style F fill:#ccffcc
```

## Authentication Flow: Before vs After

### Before
```mermaid
sequenceDiagram
    participant User
    participant SignIn
    participant EnvDetect as Environment Detection
    participant FMBridge as FileMaker Bridge
    participant Supabase

    User->>SignIn: Load App
    SignIn->>EnvDetect: Check window.FileMaker

    alt FileMaker Environment
        EnvDetect->>FMBridge: Use FileMaker Auth
        FMBridge->>SignIn: Authenticated
    else Web App
        EnvDetect->>Supabase: Use Supabase Auth
        Supabase->>SignIn: Authenticated
    end

    SignIn->>User: Show App
```

### After
```mermaid
sequenceDiagram
    participant User
    participant SignIn
    participant Supabase
    participant Backend

    User->>SignIn: Load App
    SignIn->>Supabase: Authenticate
    Supabase->>SignIn: JWT Token
    SignIn->>Backend: Verify Session
    Backend->>SignIn: User Context
    SignIn->>User: Show App
```

## Service Layer Refactoring

```mermaid
graph TD
    A[Service Layer Before] --> B[dualWriteService]
    A --> C[financialSyncService]
    A --> D[dataService]

    B --> B1[Write to FileMaker]
    B --> B2[Write to Supabase]
    B --> B3[Reconcile]

    C --> C1[Fetch from FileMaker]
    C --> C2[Fetch from Supabase]
    C --> C3[Merge & Dedupe]

    D --> D1[Route by Environment]
    D --> D2[FileMaker Path]
    D --> D3[Supabase Path]

    E[Service Layer After] --> F[dataService Simplified]
    F --> F1[Single Backend Path]
    F --> F2[Supabase + Backend API]

    style B fill:#ffcccc
    style C fill:#ffcccc
    style D2 fill:#ffcccc
    style F fill:#ccffcc
```

## Dependency Graph

```mermaid
graph TD
    TSK0001[Verify Backend APIs] --> TSK0003[Feature Flags]
    TSK0002[Audit] --> TSK0003

    TSK0003 --> TSK0004[Customers API]
    TSK0003 --> TSK0005[Projects API]
    TSK0003 --> TSK0006[Tasks API]
    TSK0003 --> TSK0007[Notes API]
    TSK0003 --> TSK0008[Links API]
    TSK0003 --> TSK0009[Financial API]
    TSK0003 --> TSK0010[QuickBooks API]

    TSK0004 --> TSK0011[dualWriteService]
    TSK0005 --> TSK0011
    TSK0006 --> TSK0011

    TSK0009 --> TSK0012[financialSyncService]

    TSK0004 --> TSK0013[initializationService]
    TSK0005 --> TSK0013
    TSK0006 --> TSK0013
    TSK0007 --> TSK0013
    TSK0008 --> TSK0013
    TSK0009 --> TSK0013

    TSK0013 --> TSK0014[SignIn Component]
    TSK0014 --> TSK0015[dataService]

    TSK0015 --> TSK0016[Remove Hook]
    TSK0016 --> TSK0017[Delete FM Files]
    TSK0010 --> TSK0017
    TSK0017 --> TSK0018[Remove Dependency]

    TSK0015 --> TSK0019[Remove Env Vars]
    TSK0015 --> TSK0020[Remove Deploy Scripts]
    TSK0015 --> TSK0021[Update CLAUDE.md]
    TSK0021 --> TSK0022[Update README]

    TSK0004 --> TSK0023[Update Tests]
    TSK0005 --> TSK0023
    TSK0006 --> TSK0023
    TSK0007 --> TSK0023
    TSK0008 --> TSK0023
    TSK0009 --> TSK0023

    TSK0023 --> TSK0024[Regression Tests]
    TSK0024 --> TSK0025[Finalization]

    style TSK0001 fill:#ffcccc
    style TSK0024 fill:#ccffcc
    style TSK0025 fill:#ccffcc
```
