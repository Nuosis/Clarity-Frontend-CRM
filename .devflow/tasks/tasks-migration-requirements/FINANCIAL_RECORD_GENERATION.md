# Financial Record Generation Documentation

**Version:** 1.0
**Last Updated:** 2026-01-10
**Status:** Current Implementation (FileMaker Primary with Supabase Dual-Write)

## Overview

This document describes how timer stop operations trigger financial record creation in FileMaker and the subsequent dual-write synchronization to Supabase's `customer_sales` table. The flow includes fixed-price project detection, customer_sales insertion, and dual-write orchestration.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Financial Record Creation Flow](#financial-record-creation-flow)
3. [Fixed-Price Project Detection](#fixed-price-project-detection)
4. [Customer Sales Record Creation](#customer-sales-record-creation)
5. [Dual-Write Orchestration](#dual-write-orchestration)
6. [Data Structures](#data-structures)
7. [Code References](#code-references)
8. [Migration Considerations](#migration-considerations)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Timer Stop Flow                          │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  taskService.stopTimer (taskService.js:67-131)                   │
│  - Stops FileMaker timer via API                                 │
│  - Validates timer record                                        │
│  - Applies time adjustments and pause time                       │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  Financial Record Lookup (taskService.js:96-115)                │
│  - Fetches financial record by recordId                          │
│  - Extracts financial ID (__ID)                                  │
│  - Checks project fixed-price setting                            │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                        ┌─────────────────┐
                        │ Fixed Price > 0? │
                        └─────────────────┘
                          │              │
                         Yes             No
                          │              │
                          ▼              ▼
                    ┌──────────┐  ┌─────────────────────────────┐
                    │  SKIP    │  │ Create customer_sales       │
                    │  (line   │  │ (createSaleFromFinancial    │
                    │  110)    │  │  Record - salesService.js:  │
                    └──────────┘  │  1383-1524)                 │
                                  └─────────────────────────────┘
                                                │
                                                ▼
                    ┌─────────────────────────────────────────────┐
                    │  Supabase customer_sales Record Created     │
                    │  - Links to FileMaker via financial_id      │
                    │  - Stores hours, rate, total_price          │
                    │  - Links to customer and organization       │
                    └─────────────────────────────────────────────┘
```

### Key Data Stores

- **FileMaker devRecords Layout**: Primary source for financial/timer records
- **Supabase customer_sales Table**: Synchronized sales records for billing
- **FileMaker devCustomers Layout**: Customer data (business_name)
- **Supabase customers Table**: Customer records with organization links

---

## Financial Record Creation Flow

### Step 1: Timer Stop Initiates Record Creation

**Location:** `src/services/taskService.js:67-131`

```javascript
export async function stopTimer(params, organizationId = null) {
    // Stop the timer in FileMaker
    const result = await stopTaskTimerAPI(
        params.recordId,
        params.description,
        params.saveImmediately,
        params.totalPauseTime + params.adjustment
    );

    // If timer successfully stopped, proceed with sales record creation
    if (result && result.response) {
        // ... financial record creation logic
    }

    return result;
}
```

**Parameters:**
- `params.recordId` (string, required): FileMaker recordId of the timer record
- `params.description` (string): Work description for the timer
- `params.saveImmediately` (boolean): Skip description prompt if true
- `params.totalPauseTime` (number): Total pause time in seconds
- `params.adjustment` (number): Manual time adjustment in seconds (must be 6-minute increments)
- `organizationId` (string, optional): Supabase organization ID

**FileMaker API Call:**
- Endpoint: `stopTaskTimerAPI` (src/api/tasks.js:10)
- Layout: `devRecords` (dapiRecords script)
- Action: Update timer record with end time and adjustments
- Returns: `{ response: { ... }, messages: [...] }`

### Step 2: Retrieve Financial Record ID

**Location:** `src/services/taskService.js:96-115`

```javascript
// Declare financialId variable
let financialId;

try {
    console.log(`Fetching financial record by recordId: ${params.recordId}`);
    const financialRecord = await fetchFinancialRecordByRecordId(params.recordId);

    if (financialRecord && financialRecord.response &&
        financialRecord.response.data &&
        financialRecord.response.data.length > 0) {
        financialId = financialRecord.response.data[0].fieldData.__ID;
        console.log(`Found financial ID from record lookup: ${financialId}`);

        // Check if this is a fixed-price project
        const fixedPrice = parseFloat(
            financialRecord.response.data[0].fieldData["customers_Projects::f_fixedPrice"] || 0
        );
        console.log(`Project fixed price value: ${fixedPrice}`);

        if (fixedPrice > 0) {
            console.log('Skipping sales record creation for fixed-price project');
            financialId = null; // Prevent sales record creation
        }
    }
} catch (fetchError) {
    console.error('Error fetching financial record by recordId:', fetchError);
}
```

**FileMaker API Call:**
- Function: `fetchFinancialRecordByRecordId` (src/api/financialRecords.js:336-348)
- Layout: `devRecords` (Layouts.RECORDS)
- Query: `{ "~recordId": recordId }`
- Returns FileMaker field data including:
  - `__ID`: UUID financial record ID
  - `customers_Projects::f_fixedPrice`: Project fixed-price setting

---

## Fixed-Price Project Detection

**Location:** `src/services/taskService.js:108-112`

### Business Logic

Fixed-price projects should NOT generate billable sales records because:
1. The project is billed at a flat rate, not hourly
2. Time tracking is for internal project management only
3. Invoicing is handled separately based on project milestones or completion

### Detection Logic

```javascript
const fixedPrice = parseFloat(
    financialRecord.response.data[0].fieldData["customers_Projects::f_fixedPrice"] || 0
);
console.log(`Project fixed price value: ${fixedPrice}`);

if (fixedPrice > 0) {
    console.log('Skipping sales record creation for fixed-price project');
    financialId = null; // Prevent sales record creation
}
```

**Field Mapping:**
- **FileMaker Field:** `customers_Projects::f_fixedPrice` (related field from devProjects layout)
- **Data Type:** Number (currency)
- **Default:** 0
- **Logic:** If `f_fixedPrice > 0`, timer records are NOT converted to sales records

### Fixed-Price Detection Flow

```
Timer Stop → Fetch Financial Record → Extract f_fixedPrice
                                              │
                          ┌───────────────────┴───────────────────┐
                          ▼                                       ▼
                    fixedPrice > 0                          fixedPrice = 0
                          │                                       │
                          ▼                                       ▼
                Set financialId = null                Create customer_sales
                          │                                       │
                          ▼                                       ▼
                    Return result                       Insert into Supabase
                (no sales record)                    (billable time tracked)
```

---

## Customer Sales Record Creation

**Location:** `src/services/salesService.js:1383-1524`

### Function: `createSaleFromFinancialRecord`

```javascript
export async function createSaleFromFinancialRecord(financialId, organizationId) {
    // 1. Fetch the specific financial record
    const result = await fetchFinancialRecords('unpaid', null, null);
    const financialRecords = processFinancialData(result);
    const record = financialRecords.find(r => r.id === financialId);

    // 2. Skip if already billed
    if (record.billed) {
        return { success: true, data: null, message: 'Record is already billed' };
    }

    // 3. Format product/service name
    const customerNameFormatted = (record.customerName || '')
        .replace(/[^A-Z0-9]/g, '')  // Keep only capital letters and numbers
        .trim();
    const projectNameFirstWord = record.projectName ?
        record.projectName.split(' ')[0] : '';
    const productService = `${customerNameFormatted}:${projectNameFirstWord}`;

    // 4. Look up or create Supabase customer
    let supabaseCustomerId = await lookupOrCreateCustomer(
        record.customerName,
        organizationId
    );

    // 5. Create the sale data
    const saleData = {
        financial_id: record.id,
        customer_id: supabaseCustomerId,
        organization_id: organizationId,
        product_name: productService,
        quantity: record.hours,
        unit_price: record.rate,
        total_price: record.amount,
        date: record.date
    };

    // 6. Insert into Supabase
    const insertResult = await insert('customer_sales', saleData);

    return {
        success: true,
        data: insertResult.data[0],
        message: 'Sales record created successfully'
    };
}
```

### Product Name Formatting

**Format:** `{CUSTOMER_CAPITALS}:{PROJECT_FIRST_WORD}`

**Examples:**
- Customer: "Clarity Business Solutions", Project: "Website Redesign" → `CBS:Website`
- Customer: "ABC Company 123", Project: "Database Migration" → `ABC123:Database`

**Logic (salesService.js:1426-1436):**
```javascript
// Extract capital letters and numbers from customer name
const customerNameFormatted = (record.customerName || '')
    .replace(/[^A-Z0-9]/g, '')  // Keep only capital letters and numbers
    .trim();

// Get the first word of the project name
const projectNameFirstWord = record.projectName ?
    record.projectName.split(' ')[0] : '';

// Concatenate with a colon
const productService = `${customerNameFormatted}:${projectNameFirstWord}`;
```

### Customer Lookup and Creation

**Location:** `src/services/salesService.js:1441-1491`

```javascript
// Look up if a customer exists where business_name = record.customerName
const customerResult = await query('customers', {
    select: '*',
    eq: {
        column: 'business_name',
        value: record.customerName
    }
});

if (customerResult.success && customerResult.data && customerResult.data.length > 0) {
    // Customer exists - verify organization link
    supabaseCustomerId = customerResult.data[0].id;

    // Check if customer is linked to organization
    const linkResult = await query('customer_organization', {
        select: '*',
        filter: {
            column: 'customer_id',
            operator: 'eq',
            value: supabaseCustomerId
        }
    });

    const isLinked = linkResult.success &&
                    linkResult.data &&
                    linkResult.data.some(link => link.organization_id === organizationId);

    if (!isLinked) {
        // Link customer to organization
        await insert('customer_organization', {
            customer_id: supabaseCustomerId,
            organization_id: organizationId
        });
    }
} else {
    // Customer doesn't exist - create it
    const newCustomerResult = await insert('customers', {
        business_name: record.customerName
    });

    supabaseCustomerId = newCustomerResult.data[0].id;

    // Link customer to organization
    await insert('customer_organization', {
        customer_id: supabaseCustomerId,
        organization_id: organizationId
    });
}
```

### Sales Record Data Structure

```javascript
const saleData = {
    financial_id: record.id,           // UUID from FileMaker __ID field
    customer_id: supabaseCustomerId,   // UUID from Supabase customers table
    organization_id: organizationId,   // UUID from window.state.user.supabaseOrgID
    product_name: productService,      // "CBS:Website" format
    quantity: record.hours,            // Decimal (hours worked)
    unit_price: record.rate,           // Decimal (hourly rate)
    total_price: record.amount,        // Decimal (hours * rate)
    date: record.date                  // Date (from financial record)
};
```

---

## Dual-Write Orchestration

**Location:** `src/services/dualWriteService.js`

### Design Pattern

The dual-write service provides a wrapper for FileMaker operations that also writes to Supabase, ensuring data consistency across both systems during the migration period.

### `withDualWrite` Wrapper

**Location:** `src/services/dualWriteService.js:29-109`

```javascript
export async function withDualWrite(fileMakerOperation, options = {}) {
    const {
        operationType,
        organizationId,
        recordData,
        enableRollback = false
    } = options;

    if (!DUAL_WRITE_CONFIG.enabled) {
        return await fileMakerOperation();
    }

    let fileMakerResult = null;
    let supabaseResult = null;

    try {
        // Step 1: Execute FileMaker operation first (primary source)
        fileMakerResult = await fileMakerOperation();

        // Check if FileMaker operation was successful
        if (!fileMakerResult ||
            (fileMakerResult.messages && fileMakerResult.messages[0]?.code !== '0')) {
            throw new Error(`FileMaker operation failed`);
        }

        // Step 2: Execute corresponding Supabase operation
        if (shouldCreateSupabaseRecord(operationType, fileMakerResult)) {
            supabaseResult = await executeSupabaseOperation(operationType, {
                fileMakerResult,
                organizationId,
                recordData
            });

            if (!supabaseResult?.success) {
                rollbackNeeded = enableRollback;
                throw new Error(`Supabase operation failed`);
            }
        }

        return {
            ...fileMakerResult,
            dualWrite: {
                success: true,
                supabaseResult,
                operationType
            }
        };

    } catch (error) {
        console.error(`[DualWrite] Dual-write operation failed:`, error);

        return {
            ...fileMakerResult,
            dualWrite: {
                success: false,
                error: error.message,
                supabaseResult,
                operationType
            }
        };
    }
}
```

### Timer Stop Dual-Write Handler

**Location:** `src/services/dualWriteService.js:209-254`

```javascript
async function handleTimerStopSupabaseOperation(fileMakerResult, organizationId) {
    try {
        // Extract financial record ID from FileMaker result
        let financialId = null;

        // Try to get financial ID from the response
        if (fileMakerResult.response?.data?.[0]?.fieldData?.__ID) {
            financialId = fileMakerResult.response.data[0].fieldData.__ID;
        } else if (fileMakerResult.response?.recordId) {
            // If we have recordId, fetch the financial record to get the __ID
            const { fetchFinancialRecordByRecordId } = await import('../api/financialRecords');
            const financialRecord = await fetchFinancialRecordByRecordId(
                fileMakerResult.response.recordId
            );
            if (financialRecord?.response?.data?.[0]?.fieldData?.__ID) {
                financialId = financialRecord.response.data[0].fieldData.__ID;
            }
        }

        if (!financialId) {
            throw new Error('Could not determine financial record ID from FileMaker result');
        }

        if (!organizationId) {
            throw new Error('Organization ID is required for Supabase operation');
        }

        // Create sales record in Supabase
        console.log(`[DualWrite] Creating sales record for financial ID: ${financialId}`);
        return await createSaleFromFinancialRecord(financialId, organizationId);

    } catch (error) {
        console.error('[DualWrite] Timer stop Supabase operation failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
```

### Dual-Write Configuration

**Location:** `src/services/dualWriteService.js:10-18`

```javascript
const DUAL_WRITE_CONFIG = {
    enabled: true,              // Enable/disable dual writes globally
    maxRetries: 3,              // Retry configuration for failed Supabase writes
    retryDelay: 1000,           // 1 second
    timeout: 10000,             // 10 seconds timeout for Supabase operations
};
```

### Error Handling Strategy

1. **FileMaker Failure**: Operation fails immediately, no Supabase write attempted
2. **Supabase Failure**: FileMaker operation succeeds, Supabase error logged but not thrown
3. **Rollback**: Not implemented (enableRollback always false)
4. **Idempotency**: `financial_id` has UNIQUE constraint in customer_sales table

---

## Data Structures

### Supabase `customer_sales` Table Schema

```sql
CREATE TABLE customer_sales (
    id                  UUID PRIMARY KEY,
    customer_id         UUID NOT NULL REFERENCES customers(id),
    product_id          UUID REFERENCES products(id),
    product_name        TEXT NOT NULL,
    quantity            NUMERIC NOT NULL,
    unit_price          NUMERIC NOT NULL,
    total_price         NUMERIC NOT NULL,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    date                DATE NOT NULL,
    inv_id              TEXT,
    financial_id        UUID UNIQUE,
    configuration_data  JSONB
);

-- Indexes
CREATE UNIQUE INDEX customer_sales_financial_id_key ON customer_sales (financial_id);
CREATE INDEX idx_customer_sales_workflow_status ON customer_sales
    ((configuration_data->>'workflow_status'))
    WHERE configuration_data IS NOT NULL;
```

### FileMaker `devRecords` Layout Fields

**Financial Record Fields (used in timer stop flow):**
- `__ID` (text): UUID for the financial record (maps to `customer_sales.financial_id`)
- `~recordId` (text): FileMaker internal record ID
- `DateStart` (date): Start date of the timer
- `Billable_Time_Rounded` (number): Hours worked (rounded)
- `Hourly_Rate` (number): Hourly rate for the work
- `f_billed` (number): Billing status (0 = unbilled, 1 = billed)
- `Work Performed` (text): Description of work performed
- `customers_Projects::f_fixedPrice` (number): Project fixed-price setting (related field)
- `Customers::Name` (text): Customer name (related field)
- `customers_Projects::projectName` (text): Project name (related field)

### Field Mappings: FileMaker → Supabase

| FileMaker Field | Supabase Field | Data Type | Notes |
|----------------|----------------|-----------|-------|
| `__ID` | `financial_id` | UUID | Unique identifier linking FileMaker to Supabase |
| `Billable_Time_Rounded` | `quantity` | NUMERIC | Hours worked |
| `Hourly_Rate` | `unit_price` | NUMERIC | Rate per hour |
| `(Billable_Time_Rounded * Hourly_Rate)` | `total_price` | NUMERIC | Calculated total |
| `DateStart` | `date` | DATE | Work date |
| `Customers::Name` (formatted) + `customers_Projects::projectName` (first word) | `product_name` | TEXT | Format: `{CAPITALS}:{FIRST_WORD}` |
| `Customers::Name` (lookup) | `customer_id` | UUID | References `customers.id` via business_name lookup |
| `window.state.user.supabaseOrgID` | `organization_id` | UUID | References `organizations.id` |
| N/A | `inv_id` | TEXT | Set to NULL initially (updated when invoiced) |
| N/A | `product_id` | UUID | Set to NULL (financial records don't reference products) |
| N/A | `configuration_data` | JSONB | Set to NULL (not used for timer-based sales) |

---

## Code References

### Core Functions

| Function | File | Lines | Purpose |
|----------|------|-------|---------|
| `stopTimer` | src/services/taskService.js | 67-131 | Main timer stop orchestration |
| `fetchFinancialRecordByRecordId` | src/api/financialRecords.js | 336-348 | Retrieve financial record by recordId |
| `createSaleFromFinancialRecord` | src/services/salesService.js | 1383-1524 | Create customer_sales record from financial data |
| `withDualWrite` | src/services/dualWriteService.js | 29-109 | Dual-write wrapper for FileMaker operations |
| `handleTimerStopSupabaseOperation` | src/services/dualWriteService.js | 209-254 | Timer-specific Supabase operation handler |
| `processFinancialData` | src/services/billableHoursService.js | (imported) | Process raw FileMaker financial data |
| `insert` | src/services/supabaseService.js | (imported) | Supabase insert operation |
| `query` | src/services/supabaseService.js | (imported) | Supabase query operation |

### FileMaker API Functions

| Function | File | Lines | Purpose |
|----------|------|-------|---------|
| `stopTaskTimerAPI` | src/api/tasks.js | 10 | Stop timer in FileMaker devRecords layout |
| `fetchFinancialRecords` | src/api/financialRecords.js | 111-234 | Fetch financial records by timeframe |
| `fetchDataFromFileMaker` | src/api/fileMaker.js | (core) | Base FileMaker API communication |

### Fixed-Price Logic

**Location:** `src/services/taskService.js:104-112`
```javascript
// Check if this is a fixed-price project
const fixedPrice = parseFloat(
    financialRecord.response.data[0].fieldData["customers_Projects::f_fixedPrice"] || 0
);
console.log(`Project fixed price value: ${fixedPrice}`);

if (fixedPrice > 0) {
    console.log('Skipping sales record creation for fixed-price project');
    financialId = null; // Prevent sales record creation
}
```

### Product Name Formatting

**Location:** `src/services/salesService.js:1426-1436`
```javascript
// Extract capital letters and numbers from customer name
const customerNameFormatted = (record.customerName || '')
    .replace(/[^A-Z0-9]/g, '')
    .trim();

// Get the first word of the project name
const projectNameFirstWord = record.projectName ?
    record.projectName.split(' ')[0] : '';

// Concatenate with a colon
const productService = `${customerNameFormatted}:${projectNameFirstWord}`;
```

### Organization ID Resolution

**Location:** `src/services/taskService.js:86-91`
```javascript
// Get the organization ID from the parameter or from the global state
const orgId = organizationId || (window.state?.user?.supabaseOrgID);

if (!orgId) {
    console.warn('No organization ID found, skipping sales record creation');
    return result;
}
```

---

## Migration Considerations

### Current System Limitations

1. **No Retry Mechanism**: If Supabase write fails, the error is logged but not retried
2. **No Rollback**: FileMaker operation cannot be rolled back if Supabase fails
3. **Manual Reconciliation**: Discrepancies between FileMaker and Supabase require manual investigation
4. **Organization ID Dependency**: Requires `window.state.user.supabaseOrgID` to be set

### Data Consistency Guarantees

1. **Primary Source**: FileMaker is the source of truth during migration
2. **Idempotent Writes**: `financial_id` UNIQUE constraint prevents duplicate sales records
3. **Foreign Key Constraints**: Ensures customer and organization exist before inserting sales record
4. **Skip Already Billed**: Records with `billed = true` are not re-created

### Migration Strategy Recommendations

#### Phase 1: Dual-Write Mode (Current)
- **Status**: Active
- **Behavior**: All timer stops write to both FileMaker and Supabase
- **Risk**: Supabase failures logged but don't block FileMaker operations
- **Monitoring**: Check logs for `[DualWrite]` errors

#### Phase 2: Supabase Primary
- **Trigger**: After all historical data migrated and validated
- **Change**: Make Supabase the primary write target
- **Rollback**: Keep FileMaker writes as backup
- **Validation**: Compare daily totals between systems

#### Phase 3: FileMaker Read-Only
- **Trigger**: After 30 days of successful Supabase-primary operation
- **Change**: Stop writing to FileMaker
- **Access**: Keep FileMaker accessible for historical data queries
- **Archive**: Plan for FileMaker data archival strategy

### Fixed-Price Project Handling in Migration

**Current Behavior:**
- Fixed-price projects (f_fixedPrice > 0) do NOT create customer_sales records
- Timer data is still tracked in FileMaker for project management

**Migration Requirement:**
- Ensure Supabase backend enforces same fixed-price logic
- Option 1: Check project fixed-price flag before creating sales record
- Option 2: Store fixed-price flag in projects table and validate server-side
- Option 3: Create sales records with `quantity = 0` and `total_price = 0` for tracking

**Recommendation:** Option 2 (server-side validation) for data integrity

### Edge Cases and Error Scenarios

#### 1. Missing Organization ID
**Scenario:** `window.state.user.supabaseOrgID` is null/undefined
**Current Behavior:** Skip Supabase write, log warning, return FileMaker result
**Migration Solution:** Require organization ID, fail timer stop if missing

#### 2. Customer Doesn't Exist in Supabase
**Scenario:** FileMaker customer not yet synced to Supabase
**Current Behavior:** Create new customer record with business_name lookup
**Migration Solution:** Pre-sync all customers before enabling dual-write

#### 3. Duplicate Financial ID
**Scenario:** Attempt to create sales record with existing financial_id
**Current Behavior:** Supabase INSERT fails due to UNIQUE constraint
**Migration Solution:** Check for existing record before INSERT (implemented in createSalesFromUnbilledFinancials)

#### 4. FileMaker Succeeds, Supabase Fails
**Scenario:** Network issue, database constraint violation
**Current Behavior:** FileMaker operation succeeds, Supabase error logged
**Migration Solution:** Implement background reconciliation job to retry failed writes

#### 5. Fixed-Price Project Changed Mid-Timer
**Scenario:** Project fixed-price flag changed while timer is running
**Current Behavior:** Uses fixed-price value at timer stop time
**Migration Solution:** Document as expected behavior, validate during reconciliation

### Reconciliation Strategy

**Daily Reconciliation Job:**
1. Query FileMaker for all financial records where `f_billed = 0`
2. Query Supabase for all customer_sales where `inv_id IS NULL`
3. Compare record counts and totals by customer
4. Identify missing records (in FileMaker but not Supabase)
5. Retry failed Supabase writes for missing records
6. Generate reconciliation report with discrepancies

**Implementation Reference:** `src/services/salesService.js:1119-1292` (`createSalesFromUnbilledFinancials`)

### Testing Requirements for Migration

1. **Timer Stop with Fixed-Price Project**: Verify no sales record created
2. **Timer Stop with Hourly Project**: Verify sales record created with correct data
3. **Customer Lookup**: Verify existing customer is linked, not duplicated
4. **Customer Creation**: Verify new customer is created and linked to organization
5. **Product Name Formatting**: Verify correct format with various customer/project names
6. **Duplicate Prevention**: Verify idempotency when stopping same timer multiple times
7. **Error Handling**: Verify FileMaker success even when Supabase fails
8. **Organization ID Missing**: Verify graceful skip with warning log

---

## Appendix: Example Flows

### Example 1: Hourly Project Timer Stop

**Input:**
- Timer recordId: "12345"
- Description: "Implemented login feature"
- Total pause time: 300 seconds (5 minutes)
- Adjustment: 0 seconds
- Organization ID: "550e8400-e29b-41d4-a716-446655440000"

**FileMaker Financial Record:**
```json
{
  "__ID": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "~recordId": "12345",
  "DateStart": "01/10/2026",
  "Billable_Time_Rounded": 2.5,
  "Hourly_Rate": 150,
  "f_billed": 0,
  "Work Performed": "Implemented login feature",
  "customers_Projects::f_fixedPrice": 0,
  "Customers::Name": "Clarity Business Solutions",
  "customers_Projects::projectName": "Website Redesign"
}
```

**Supabase customer_sales Record Created:**
```json
{
  "id": "a3c2f1e0-5b7a-4d9e-8f6c-1a2b3c4d5e6f",
  "financial_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "customer_id": "b1d2e3f4-a5b6-c7d8-e9f0-1a2b3c4d5e6f",
  "organization_id": "550e8400-e29b-41d4-a716-446655440000",
  "product_name": "CBS:Website",
  "quantity": 2.5,
  "unit_price": 150,
  "total_price": 375,
  "date": "2026-01-10",
  "inv_id": null,
  "product_id": null,
  "configuration_data": null,
  "created_at": "2026-01-10T20:30:00Z",
  "updated_at": "2026-01-10T20:30:00Z"
}
```

### Example 2: Fixed-Price Project Timer Stop

**Input:**
- Timer recordId: "67890"
- Description: "Database schema design"
- Total pause time: 0 seconds
- Adjustment: 360 seconds (6 minutes)
- Organization ID: "550e8400-e29b-41d4-a716-446655440000"

**FileMaker Financial Record:**
```json
{
  "__ID": "9d8e7f6a-5b4c-3d2e-1f0a-9b8c7d6e5f4a",
  "~recordId": "67890",
  "DateStart": "01/10/2026",
  "Billable_Time_Rounded": 3.0,
  "Hourly_Rate": 150,
  "f_billed": 0,
  "Work Performed": "Database schema design",
  "customers_Projects::f_fixedPrice": 5000,
  "Customers::Name": "ABC Company",
  "customers_Projects::projectName": "Database Migration"
}
```

**Supabase customer_sales Record Created:**
**NONE** - Fixed-price project detected, sales record creation skipped

**Console Output:**
```
Fetching financial record by recordId: 67890
Found financial ID from record lookup: 9d8e7f6a-5b4c-3d2e-1f0a-9b8c7d6e5f4a
Project fixed price value: 5000
Skipping sales record creation for fixed-price project
Could not find financial record ID in timer stop result or by recordId lookup, or project is fixed-price
```

---

**End of Document**
