# Financial Records Backend Integration - Workflows

## Overview

This document describes the data flow and integration workflows for migrating financial records from FileMaker to Supabase backend APIs.

## Current State: FileMaker-Primary

```mermaid
graph TD
    A[Timer Stop] --> B[FileMaker Script]
    B --> C[devRecords Layout]
    C --> D[financialSyncService]
    D --> E[Supabase customer_sales]

    F[UI Query] --> G[financialRecords API]
    G --> H[FileMaker devRecords]
    H --> I[billableHoursService Transform]
    I --> J[UI Components]

    K[Mark Billed] --> L[Update FileMaker f_billed]
    L --> D
```

**Problems:**
- FileMaker is single source of truth (bottleneck)
- Dual-write synchronization is complex and error-prone
- No direct aggregation queries (must fetch all records and compute in JS)
- Date format conversions required at multiple layers

## Target State: Supabase-Native

```mermaid
graph TD
    A[Timer Stop] --> B[create_financial_record RPC]
    B --> C[Supabase customer_sales]

    D[UI Query] --> E[financialRecords API]
    E --> F[get_financial_records RPC]
    F --> C
    F --> G[UI Components]

    H[Mark Billed] --> I[mark_records_billed RPC]
    I --> C

    J[Aggregations] --> K[get_monthly_summary RPC]
    K --> C
    K --> G
```

**Benefits:**
- Supabase is single source of truth
- No synchronization needed
- Database-level aggregations for better performance
- Consistent date format (YYYY-MM-DD)
- RLS enforcement at database level

## Migration Workflow

### Phase 1: API Layer Replacement

```mermaid
sequenceDiagram
    participant UI as UI Component
    participant API as financialRecords API
    participant SB as Supabase RPC
    participant DB as customer_sales Table

    UI->>API: fetchFinancialRecords(timeframe, customerId)
    API->>API: Calculate start_date, end_date from timeframe
    API->>API: Get organization_id from user session
    API->>SB: get_financial_records(org_id, start_date, end_date, customer_id, billed_only)
    SB->>DB: Query with filters + JOIN customers
    DB-->>SB: Records with customer_name
    SB-->>API: RPC result
    API->>API: Normalize response (add compatibility fields if needed)
    API-->>UI: Processed records
```

**Key Changes:**
1. API translates timeframe to date range
2. RPC call includes organization_id for RLS
3. Response includes customer_name already joined
4. Dates are in YYYY-MM-DD format

### Phase 2: Record Creation

```mermaid
sequenceDiagram
    participant Timer as TaskTimer Component
    participant Task as taskService
    participant API as financialRecords API
    participant SB as Supabase RPC
    participant DB as customer_sales Table

    Timer->>Task: stopTimer(taskId, elapsedSeconds)
    Task->>Task: Fetch task, project, customer context
    Task->>Task: Calculate billable_hours = elapsedSeconds / 3600
    Task->>Task: Get unit_price from customer.charge_rate or project.hourly_rate
    Task->>Task: Generate financial_id = UUID()
    Task->>Task: Format product_name = "CUSTOMERCAPS:ProjectWord"
    Task->>API: createFinancialRecord(financial_id, org_id, customer_id, product_name, quantity, unit_price, date)
    API->>SB: create_financial_record(...)
    SB->>SB: Validate inputs
    SB->>SB: Calculate total_price = quantity × unit_price
    SB->>DB: INSERT INTO customer_sales
    DB-->>SB: Record ID
    SB-->>API: Record ID
    API-->>Task: Success
    Task-->>Timer: Timer stopped, record created
```

**Key Changes:**
1. Timer directly calls Supabase RPC (no FileMaker script)
2. Validation happens at database level
3. total_price calculated automatically by RPC
4. No dual-write synchronization needed

### Phase 3: Marking Records Billed

```mermaid
sequenceDiagram
    participant UI as CustomerSalesTable
    participant QB as QuickBooks API
    participant API as financialRecords API
    participant SB as Supabase RPC
    participant DB as customer_sales Table

    UI->>UI: User selects unbilled records
    UI->>QB: createQBOInvoice(records)
    QB-->>UI: QuickBooks invoice_id
    UI->>API: markRecordsBilled(record_ids[], invoice_id)
    API->>SB: mark_records_billed(record_ids[], invoice_id)
    SB->>DB: UPDATE customer_sales SET inv_id = invoice_id, updated_at = NOW() WHERE id IN (...)
    DB-->>SB: Updated count
    SB-->>API: Updated count
    API-->>UI: Success (count)
    UI->>UI: Refresh unpaid records list
```

**Key Changes:**
1. Bulk update in single RPC call
2. Sets inv_id instead of f_billed flag
3. Automatic updated_at timestamp
4. Returns count of updated records

### Phase 4: Aggregation Queries

```mermaid
sequenceDiagram
    participant UI as FinancialChart
    participant API as financialRecords API
    participant SB as Supabase RPC
    participant DB as customer_sales Table

    UI->>API: getMonthlySummary(year)
    API->>API: Get organization_id from session
    API->>SB: get_monthly_summary(org_id, year)
    SB->>DB: SELECT month, SUM(total_price), SUM(CASE inv_id...), COUNT(*) GROUP BY month
    DB-->>SB: Aggregated results by month
    SB-->>API: Month-by-month totals
    API-->>UI: Chart data
    UI->>UI: Render chart with billed/unbilled breakdown
```

**Benefits:**
- Database-level aggregation (much faster than JS reduce)
- Single query returns all needed data
- No need to fetch all records and compute totals in frontend

## Data Flow Comparison

### FileMaker Approach (Old)

```mermaid
graph LR
    A[FileMaker devRecords] -->|Raw FM data| B[fetchDataFromFileMaker]
    B -->|FM response| C[processFinancialData]
    C -->|Transform fields| D[Date conversion MM/DD → YYYY-MM-DD]
    D -->|Transform types| E[f_billed → isBilled boolean]
    E -->|Join relations| F[Lookup customer name]
    F -->|Final shape| G[UI Components]
```

**Problems:**
- Multiple transformation steps
- Expensive relation lookups
- Inconsistent field names across layers

### Supabase Approach (New)

```mermaid
graph LR
    A[Supabase customer_sales] -->|RPC call| B[get_financial_records]
    B -->|Joined data| C[Minimal normalization]
    C -->|UI shape| D[UI Components]
```

**Benefits:**
- Customer name pre-joined by RPC
- Dates already in correct format
- Minimal transformation needed
- Consistent field names

## Error Handling Workflow

```mermaid
sequenceDiagram
    participant UI as UI Component
    participant API as financialRecords API
    participant SB as Supabase RPC

    UI->>API: fetchFinancialRecords(...)
    API->>SB: get_financial_records(...)

    alt Missing organization_id
        SB-->>API: Error: organization_id required
        API-->>UI: Error: User session invalid
        UI->>UI: Redirect to login
    else RLS policy violation
        SB-->>API: Error: Row-level security policy
        API-->>UI: Error: Insufficient permissions
        UI->>UI: Display permission error
    else FK constraint violation (create_financial_record)
        SB-->>API: Error: Foreign key constraint customer_id
        API-->>UI: Error: Customer not found
        UI->>UI: Display error, suggest customer lookup
    else Success
        SB-->>API: Records
        API-->>UI: Success
        UI->>UI: Display records
    end
```

## Testing Workflow

```mermaid
graph TD
    A[Unit Tests] --> B[Test RPC calls with mocks]
    B --> C[Verify data transformations]

    D[Integration Tests] --> E[Test with real Supabase dev instance]
    E --> F[Verify RLS policies]
    F --> G[Test CRUD operations]

    H[E2E Tests] --> I[Test complete invoice flow]
    I --> J[Timer stop → record creation]
    J --> K[Fetch unbilled records]
    K --> L[Create QB invoice]
    L --> M[Mark records billed]
    M --> N[Verify records marked]
```

## Rollback Workflow (If Needed)

```mermaid
graph TD
    A[Detect Issue] --> B{Can be fixed quickly?}
    B -->|Yes| C[Deploy hotfix]
    B -->|No| D[Revert API layer to FileMaker calls]
    D --> E[Re-enable financialSyncService dual-write]
    E --> F[Sync recent records from FileMaker to Supabase]
    F --> G[Investigate issue in staging]
    G --> H[Fix and re-deploy]
```

**Rollback Strategy:**
- Keep FileMaker code commented (don't delete immediately)
- Supabase data remains intact (no data loss)
- Can fall back to FileMaker reads while keeping Supabase writes
- Re-enable sync service if needed for consistency

## Performance Optimization

### Query Performance

```mermaid
graph TD
    A[User requests financial records] --> B{Query type?}

    B -->|Date range filter| C[Use idx_customer_sales_org_date index]
    C --> D[Fast scan on organization_id, date]

    B -->|Unbilled only| E[Use idx_customer_sales_unbilled index]
    E --> F[Fast scan WHERE inv_id IS NULL]

    B -->|Customer-specific| G[Use idx_customer_sales_customer_date index]
    G --> H[Fast scan on customer_id, date]

    B -->|Monthly aggregation| I[Use get_monthly_summary RPC]
    I --> J[Database-level GROUP BY]

    D --> K[Return results < 500ms]
    F --> K
    H --> K
    J --> K
```

**Backend Indexes (Already Deployed):**
- `idx_customer_sales_org_date` - Primary query pattern
- `idx_customer_sales_customer_date` - Customer-specific queries
- `idx_customer_sales_unbilled` - Unpaid records queries
- `idx_customer_sales_date_month_year` - Aggregation support

## Security & Authorization

```mermaid
graph TD
    A[User makes request] --> B[Extract JWT from Supabase session]
    B --> C[RPC function receives organization_id param]
    C --> D{RLS Policy Check}

    D -->|Pass| E[Query filtered by organization_id]
    E --> F[Return only authorized records]

    D -->|Fail| G[Return error: policy violation]

    H[create_financial_record] --> I{Validate customer belongs to org}
    I -->|Yes| J[Insert record]
    I -->|No| K[Raise exception: Customer not in org]
```

**RLS Policies (Backend):**
- All queries automatically filtered by organization_id
- Users can only see records for their organization
- Cross-organization access prevented at database level
