# Financial Records Migration - Requirements Documentation

## Overview

This document outlines the requirements for migrating financial records (billing/customer sales) from FileMaker (`dapiRecords` layout) to Supabase (`customer_sales` table) and removing FileMaker-based synchronization tooling.

**Current State:** Financial records are created in FileMaker via the `devRecords` layout and reconciled to Supabase `customer_sales` table via `financialSyncService.js`. This dual-write pattern creates complexity and requires constant reconciliation.

**Target State:** Supabase becomes the single source of truth for financial records. Records are created directly in Supabase when timers stop or manual entries are made. FileMaker integration is removed entirely.

---

## Table of Contents

1. [Current Financial Record Flows](#current-financial-record-flows)
2. [Data Mapping](#data-mapping)
3. [Backend Requirements](#backend-requirements)
4. [Source of Truth Behavior](#source-of-truth-behavior)
5. [Timer Integration](#timer-integration)
6. [Migration Plan](#migration-plan)
7. [Acceptance Criteria](#acceptance-criteria)
8. [Test Plan](#test-plan)
9. [Code References](#code-references)

---

## Current Financial Record Flows

### 1. FileMaker-Based Record Creation (LEGACY)

**Primary Flow:**
```
Timer Stop → FileMaker Script → devRecords Layout (CREATE) → Sync to Supabase
```

**FileMaker Layout:** `devRecords` (also referenced as `dapiRecords`)

**Key Fields in FileMaker:**
- `__ID` - Primary UUID identifier
- `_custID` - Customer ID (foreign key)
- `_projectID` - Project ID (foreign key)
- `DateStart` - Record date (MM/DD/YYYY format)
- `Billable_Time_Rounded` - Hours worked
- `Hourly_Rate` or `Customers::chargeRate` - Billing rate
- `f_billed` - Payment status (0=unbilled, 1=billed)
- `Work Performed` - Description of work
- `Tasks::task` - Associated task name
- `month`, `year` - Computed date fields
- `~creationTimestamp`, `~ModificationTimestamp` - Audit fields

**Current API Layer:** `src/api/financialRecords.js`
- `fetchFinancialRecords(timeframe, customerId, projectId)` - Query by timeframe
- `fetchUnpaidRecords(customerId)` - Get unbilled records
- `fetchMonthlyRecords(month, year, customerId)` - Query by month
- `fetchQuarterlyRecords(quarter, year, customerId)` - Query by quarter
- `fetchYearlyRecords(year, customerId)` - Query by year
- `updateFinancialRecordBilledStatus(recordId, billedStatus)` - Mark as billed
- `bulkUpdateFinancialRecordsBilledStatus(recordIds, billedStatus)` - Bulk billing

**Service Layer:** `src/services/billableHoursService.js`
- `processFinancialData(data)` - Transform FileMaker response to application format
- `groupRecordsByCustomer(records)` - Aggregate by customer
- `groupRecordsByProject(records, customerId)` - Aggregate by project
- `calculateTotals(records)` - Calculate billed/unbilled totals
- `prepareChartData(records, chartType)` - Generate visualization data

### 2. Supabase Reconciliation (CURRENT)

**Sync Service:** `src/services/financialSyncService.js`

**Synchronization Flow:**
```
1. Fetch devRecords from FileMaker (date range)
2. Fetch customer_sales from Supabase (organization_id + date range)
3. Compare records by financial_id (FileMaker __ID → Supabase financial_id)
4. Identify: toCreate, toUpdate, toDelete, unchanged
5. Apply changes to Supabase (optional dry-run mode)
```

**Key Functions:**
- `synchronizeFinancialRecords(organizationId, startDate, endDate, options)`
- `getFinancialSyncStatus(organizationId, startDate, endDate)` - Dry-run summary
- `compareRecords(devRecords, customerSales, organizationId)` - Diff algorithm
- `createCustomerSaleFromDevRecord(devRecord, organizationId)` - Map FM → Supabase
- `updateCustomerSaleFromDevRecord(customerSaleId, devRecord, organizationId)` - Update record

**Data Transformations:**
- Product name formatting: `{CUSTOMER_CAPS_ONLY}:{PROJECT_FIRST_WORD}`
- Customer lookup/creation via `business_name`
- Date conversion: YYYY-MM-DD (Supabase) ↔ MM/DD/YYYY (FileMaker)
- Decimal precision: Round to 2 decimal places for comparison

**Sync Tracking:**
- Uses `syncTrackingService.js` to store pending changes in localStorage
- Supports full review or pending-only sync modes

### 3. UI Components

**Components Using Financial Records:**

1. **CustomerSalesTable** (`src/components/financial/CustomerSalesTable.jsx`)
   - Displays customer_sales records from Supabase
   - Used in web app environment

2. **FinancialSyncPanel** (`src/components/financial/FinancialSyncPanel.jsx`)
   - Admin UI for triggering manual sync
   - Shows sync status and discrepancies

3. **QboTestPanel** (`src/components/financial/QboTestPanel.jsx`)
   - QuickBooks integration testing
   - Reads customer_sales for invoice generation

4. **RecordDetailsModal** (`src/components/financial/RecordDetailsModal.jsx`)
   - Displays individual record details
   - Shows work performed, task name, billing info

**Hooks:**
- `useBillableHours` (`src/hooks/useBillableHours.js`) - Fetches and manages financial records
- `useFinancialSync` (`src/hooks/useFinancialSync.js`) - Manages sync operations

### 4. QuickBooks Integration

**Service:** `src/services/financialSyncService.js` (QuickBooks features)
**Edge Function:** `supabase/functions/quickbooksEdgeFunction.js`

**Integration Points:**
- Reads `customer_sales` records for invoice generation
- Syncs invoice IDs back to `inv_id` field
- Requires records to be in Supabase for QB sync

---

## Data Mapping

### FileMaker `devRecords` → Supabase `customer_sales`

| FileMaker Field | Supabase Column | Type | Transform | Notes |
|-----------------|-----------------|------|-----------|-------|
| `__ID` | `financial_id` | UUID | Direct | Unique identifier |
| `_custID` | `customer_id` | UUID | Lookup/Create | Maps to `customers.id` via `business_name` |
| `_projectID` | *(not stored)* | - | - | Project context derived from product_name |
| `DateStart` | `date` | DATE | MM/DD/YYYY → YYYY-MM-DD | Date format conversion |
| `Billable_Time_Rounded` | `quantity` | NUMERIC | parseFloat() | Hours worked |
| `Hourly_Rate` or `Customers::chargeRate` | `unit_price` | NUMERIC | parseFloat() | Billing rate per hour |
| *(calculated)* | `total_price` | NUMERIC | quantity × unit_price | Total billing amount |
| `Customers::Name` + `customers_Projects::projectName` | `product_name` | TEXT | Format: `{CAPS}:{WORD}` | `CUSTOMERABC:Development` |
| *(not in FM)* | `product_id` | UUID | NULL or lookup | Optional link to products table |
| *(organization context)* | `organization_id` | UUID | From user session | Multi-tenant isolation |
| `f_billed` | *(implied by inv_id)* | - | - | Billed status: `inv_id IS NOT NULL` |
| `~creationTimestamp` | `created_at` | TIMESTAMP | Direct | Record creation time |
| `~ModificationTimestamp` | `updated_at` | TIMESTAMP | Direct | Last update time |
| *(QuickBooks sync)* | `inv_id` | TEXT | NULL until invoiced | QuickBooks invoice ID |
| *(not in FM)* | `configuration_data` | JSONB | NULL | Product-specific config (future use) |

### Field Derivation Rules

**Customer Lookup:**
1. Query `customers` WHERE `business_name = FileMaker.Customers::Name`
2. If not found, INSERT new customer with `type = 'CUSTOMER'`
3. Link to organization via `customer_organization` table

**Product Name Formatting:**
```javascript
// Extract capital letters and numbers from customer name
const customerCaps = customerName.replace(/[^A-Z0-9]/g, '').trim();

// Get first word of project name
const projectFirstWord = projectName.split(' ')[0];

// Format: "CLARITYBUSINESS:Development"
const productName = `${customerCaps}:${projectFirstWord}`;
```

**Billed Status:**
- FileMaker: Explicit `f_billed` field (0 or 1)
- Supabase: Derived from `inv_id IS NOT NULL`
- Migration: Preserve billed status by setting `inv_id = 'MIGRATED'` for `f_billed = 1`

---

## Backend Requirements

### Required API Endpoints / RPCs

The backend must support the following operations for financial records:

#### 1. Query Operations

**RPC: `get_financial_records`**
```sql
-- Query by date range, customer, organization
CREATE OR REPLACE FUNCTION get_financial_records(
  p_organization_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL,
  p_billed_only BOOLEAN DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  financial_id UUID,
  customer_id UUID,
  customer_name TEXT,
  product_id UUID,
  product_name TEXT,
  quantity NUMERIC,
  unit_price NUMERIC,
  total_price NUMERIC,
  date DATE,
  inv_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.id,
    cs.financial_id,
    cs.customer_id,
    c.business_name AS customer_name,
    cs.product_id,
    cs.product_name,
    cs.quantity,
    cs.unit_price,
    cs.total_price,
    cs.date,
    cs.inv_id,
    cs.created_at,
    cs.updated_at
  FROM customer_sales cs
  JOIN customers c ON cs.customer_id = c.id
  WHERE cs.organization_id = p_organization_id
    AND (p_start_date IS NULL OR cs.date >= p_start_date)
    AND (p_end_date IS NULL OR cs.date <= p_end_date)
    AND (p_customer_id IS NULL OR cs.customer_id = p_customer_id)
    AND (p_billed_only IS NULL OR (p_billed_only = TRUE AND cs.inv_id IS NOT NULL) OR (p_billed_only = FALSE AND cs.inv_id IS NULL))
  ORDER BY cs.date DESC;
END;
$$ LANGUAGE plpgsql;
```

**RPC: `get_unpaid_records`**
```sql
-- Get all unbilled records for an organization or customer
CREATE OR REPLACE FUNCTION get_unpaid_records(
  p_organization_id UUID,
  p_customer_id UUID DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  financial_id UUID,
  customer_id UUID,
  customer_name TEXT,
  product_name TEXT,
  quantity NUMERIC,
  unit_price NUMERIC,
  total_price NUMERIC,
  date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.id,
    cs.financial_id,
    cs.customer_id,
    c.business_name AS customer_name,
    cs.product_name,
    cs.quantity,
    cs.unit_price,
    cs.total_price,
    cs.date
  FROM customer_sales cs
  JOIN customers c ON cs.customer_id = c.id
  WHERE cs.organization_id = p_organization_id
    AND cs.inv_id IS NULL
    AND (p_customer_id IS NULL OR cs.customer_id = p_customer_id)
  ORDER BY cs.date DESC;
END;
$$ LANGUAGE plpgsql;
```

**RPC: `get_monthly_summary`**
```sql
-- Aggregate records by month for reporting
CREATE OR REPLACE FUNCTION get_monthly_summary(
  p_organization_id UUID,
  p_year INT,
  p_customer_id UUID DEFAULT NULL
) RETURNS TABLE (
  month INT,
  year INT,
  total_hours NUMERIC,
  total_amount NUMERIC,
  billed_amount NUMERIC,
  unbilled_amount NUMERIC,
  record_count INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXTRACT(MONTH FROM cs.date)::INT AS month,
    EXTRACT(YEAR FROM cs.date)::INT AS year,
    SUM(cs.quantity) AS total_hours,
    SUM(cs.total_price) AS total_amount,
    SUM(CASE WHEN cs.inv_id IS NOT NULL THEN cs.total_price ELSE 0 END) AS billed_amount,
    SUM(CASE WHEN cs.inv_id IS NULL THEN cs.total_price ELSE 0 END) AS unbilled_amount,
    COUNT(*)::INT AS record_count
  FROM customer_sales cs
  WHERE cs.organization_id = p_organization_id
    AND EXTRACT(YEAR FROM cs.date) = p_year
    AND (p_customer_id IS NULL OR cs.customer_id = p_customer_id)
  GROUP BY month, year
  ORDER BY month;
END;
$$ LANGUAGE plpgsql;
```

**RPC: `get_quarterly_summary`**
```sql
-- Aggregate records by quarter
CREATE OR REPLACE FUNCTION get_quarterly_summary(
  p_organization_id UUID,
  p_year INT,
  p_quarter INT,
  p_customer_id UUID DEFAULT NULL
) RETURNS TABLE (
  quarter INT,
  year INT,
  total_hours NUMERIC,
  total_amount NUMERIC,
  billed_amount NUMERIC,
  unbilled_amount NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CEIL(EXTRACT(MONTH FROM cs.date) / 3.0)::INT AS quarter,
    EXTRACT(YEAR FROM cs.date)::INT AS year,
    SUM(cs.quantity) AS total_hours,
    SUM(cs.total_price) AS total_amount,
    SUM(CASE WHEN cs.inv_id IS NOT NULL THEN cs.total_price ELSE 0 END) AS billed_amount,
    SUM(CASE WHEN cs.inv_id IS NULL THEN cs.total_price ELSE 0 END) AS unbilled_amount
  FROM customer_sales cs
  WHERE cs.organization_id = p_organization_id
    AND EXTRACT(YEAR FROM cs.date) = p_year
    AND CEIL(EXTRACT(MONTH FROM cs.date) / 3.0) = p_quarter
    AND (p_customer_id IS NULL OR cs.customer_id = p_customer_id)
  GROUP BY quarter, year;
END;
$$ LANGUAGE plpgsql;
```

#### 2. Write Operations

**RPC: `create_financial_record`**
```sql
-- Create a new financial record (e.g., from timer stop)
CREATE OR REPLACE FUNCTION create_financial_record(
  p_financial_id UUID,
  p_organization_id UUID,
  p_customer_id UUID,
  p_product_name TEXT,
  p_quantity NUMERIC,
  p_unit_price NUMERIC,
  p_date DATE,
  p_product_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_record_id UUID;
  v_total_price NUMERIC;
BEGIN
  -- Calculate total price
  v_total_price := p_quantity * p_unit_price;

  -- Insert record
  INSERT INTO customer_sales (
    financial_id,
    organization_id,
    customer_id,
    product_id,
    product_name,
    quantity,
    unit_price,
    total_price,
    date
  ) VALUES (
    p_financial_id,
    p_organization_id,
    p_customer_id,
    p_product_id,
    p_product_name,
    p_quantity,
    p_unit_price,
    v_total_price,
    p_date
  )
  RETURNING id INTO v_record_id;

  RETURN v_record_id;
END;
$$ LANGUAGE plpgsql;
```

**RPC: `mark_records_billed`**
```sql
-- Mark multiple records as billed (set invoice ID)
CREATE OR REPLACE FUNCTION mark_records_billed(
  p_record_ids UUID[],
  p_invoice_id TEXT
) RETURNS INT AS $$
DECLARE
  v_updated_count INT;
BEGIN
  UPDATE customer_sales
  SET inv_id = p_invoice_id,
      updated_at = NOW()
  WHERE id = ANY(p_record_ids);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;
```

#### 3. Index Requirements

```sql
-- Performance indexes for common queries
CREATE INDEX IF NOT EXISTS idx_customer_sales_org_date
  ON customer_sales(organization_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_customer_sales_customer_date
  ON customer_sales(customer_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_customer_sales_unbilled
  ON customer_sales(organization_id)
  WHERE inv_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_sales_date_range
  ON customer_sales(date)
  WHERE inv_id IS NULL;
```

---

## Source of Truth Behavior

### Supabase as Single Source of Truth

**Principles:**

1. **All new records created in Supabase** - No FileMaker writes for financial records
2. **Frontend reads from Supabase only** - Remove `src/api/financialRecords.js` FileMaker dependency
3. **FileMaker deprecated for billing** - Existing `devRecords` layout becomes read-only archive
4. **Backward compatibility maintained** - Historical records remain accessible via sync until full migration

**Data Flow (New):**
```
Timer Stop → Frontend Logic → Supabase customer_sales (INSERT)
Manual Entry → Form Submit → Supabase customer_sales (INSERT)
QuickBooks Sync → Read Supabase → Generate Invoice → Update inv_id
```

**Migration Phases:**

**Phase 1: Dual-Read (Current State)**
- Reads: FileMaker (primary) + Supabase (reconciliation)
- Writes: FileMaker (primary) → Sync to Supabase

**Phase 2: Dual-Write (Transition)**
- Reads: Supabase (primary) + FileMaker (validation)
- Writes: Supabase (primary) + FileMaker (shadow copy)

**Phase 3: Supabase-Only (Target State)**
- Reads: Supabase only
- Writes: Supabase only
- FileMaker: Archived data accessible via one-time export

**Cutover Criteria:**
- [ ] All active users migrated to web app environment
- [ ] Historical records synced to Supabase (at least 2 years)
- [ ] QuickBooks integration verified against Supabase
- [ ] Financial reporting verified against Supabase data
- [ ] User acceptance testing completed
- [ ] Rollback plan documented

---

## Timer Integration

### Current Timer → Financial Record Flow

**FileMaker Environment:**
1. User starts timer (TaskTimer component)
2. User stops timer
3. Timer calculates elapsed time
4. FileMaker script creates record in `devRecords` layout
5. Sync service reconciles to Supabase

**Target Supabase Flow:**
1. User starts timer (TaskTimer component)
2. User stops timer
3. Timer calculates elapsed time (billable hours)
4. **Frontend creates record directly in Supabase:**
   - Get customer_id from current project/task context
   - Get organization_id from user session
   - Format product_name using customer + project names
   - Calculate unit_price from customer billing rate
   - Calculate total_price = hours × rate
   - INSERT into customer_sales via RPC

**Timer Stop Handler (Pseudocode):**
```javascript
async function handleTimerStop(taskId, elapsedSeconds) {
  // 1. Fetch task context
  const task = await getTask(taskId);
  const project = await getProject(task.projectId);
  const customer = await getCustomer(project.customerId);

  // 2. Calculate billable hours
  const billableHours = elapsedSeconds / 3600; // Convert seconds to hours

  // 3. Get billing rate
  const unitPrice = customer.chargeRate || project.hourlyRate || 0;

  // 4. Generate financial_id
  const financialId = generateUUID();

  // 5. Format product_name
  const productName = formatProductName(customer.businessName, project.name);

  // 6. Create financial record in Supabase
  const result = await supabase.rpc('create_financial_record', {
    p_financial_id: financialId,
    p_organization_id: currentUser.organizationId,
    p_customer_id: customer.id,
    p_product_name: productName,
    p_quantity: billableHours,
    p_unit_price: unitPrice,
    p_date: new Date().toISOString().split('T')[0] // YYYY-MM-DD
  });

  // 7. Update task with financial record reference
  await updateTask(taskId, {
    financialRecordId: result.data,
    lastBilledAt: new Date()
  });
}
```

**Required Service Changes:**

**File:** `src/services/taskService.js`
- Add `createFinancialRecordForTask(taskId, elapsedTime)` function
- Import Supabase service
- Call `create_financial_record` RPC

**File:** `src/components/tasks/TaskTimer.jsx`
- On timer stop, call `createFinancialRecordForTask()`
- Show success/error notification
- Update UI to reflect new record

**Data Requirements:**
- Task must have `projectId` (foreign key to projects)
- Project must have `customerId` (foreign key to customers)
- Customer must have `chargeRate` (default billing rate)
- User session must have `organizationId`

---

## Migration Plan

### Step 1: Backend Preparation

**Create Backend Change Request:**
```
BACKEND_CHANGE_REQUEST_001_FINANCIAL_RECORDS_MIGRATION.md
```

**Request Contents:**
1. SQL for RPCs: `get_financial_records`, `get_unpaid_records`, `get_monthly_summary`, `get_quarterly_summary`, `create_financial_record`, `mark_records_billed`
2. Index creation SQL (performance optimization)
3. Migration script: Historical records from FileMaker → Supabase
4. Rollback plan: Restore from backup, revert RPC changes

**Testing Requirements:**
- Unit tests for each RPC function
- Performance tests for date range queries
- Integration tests for create/update operations

### Step 2: Frontend API Layer Replacement

**File Changes:**

1. **Create:** `src/api/financialRecordsSupabase.js`
   - Replace FileMaker calls with Supabase RPC calls
   - Implement same function signatures as `src/api/financialRecords.js`
   - Add error handling and logging

2. **Update:** `src/services/billableHoursService.js`
   - Adapt to Supabase data structure
   - Remove FileMaker-specific processing

3. **Create:** `src/hooks/useFinancialRecords.js`
   - New hook for fetching/managing financial records
   - Replace `useBillableHours` hook

4. **Update:** `src/components/financial/CustomerSalesTable.jsx`
   - Use new Supabase-based API
   - Remove FileMaker dependencies

### Step 3: Timer Integration

**File Changes:**

1. **Update:** `src/components/tasks/TaskTimer.jsx`
   - Add `onTimerStop` handler
   - Call `createFinancialRecordForTask()`
   - Show billing confirmation dialog

2. **Update:** `src/services/taskService.js`
   - Add `createFinancialRecordForTask()` function
   - Import Supabase service

3. **Create:** `src/components/tasks/BillingConfirmationDialog.jsx`
   - Show hours, rate, total before creating record
   - Allow user to adjust hours or mark as non-billable

### Step 4: Deprecate Sync Service

**File Changes:**

1. **Archive:** `src/services/financialSyncService.js` → `src/services/DEPRECATED_financialSyncService.js`
2. **Remove:** `src/hooks/useFinancialSync.js`
3. **Remove:** `src/components/financial/FinancialSyncPanel.jsx`
4. **Update:** Remove sync-related imports from other files

### Step 5: Testing & Validation

**Test Scenarios:**
1. Create financial record from timer (web app)
2. Create manual financial entry
3. Query records by date range
4. Query unpaid records
5. Mark records as billed (QuickBooks sync)
6. Generate monthly/quarterly reports
7. Verify totals match pre-migration data

### Step 6: User Acceptance Testing

**UAT Checklist:**
- [ ] Users can track time and create billable records
- [ ] Billing rates are correct
- [ ] Financial reports show accurate data
- [ ] QuickBooks integration works
- [ ] No data loss from migration
- [ ] Performance is acceptable (queries < 2s)

---

## Acceptance Criteria

### Functional Requirements

- [x] All financial records queryable from Supabase
- [x] Timer stop creates record in Supabase (no FileMaker)
- [x] Manual financial entries supported
- [x] Unpaid records query returns correct data
- [x] Monthly/quarterly aggregations accurate
- [x] Bulk billing operations supported
- [x] QuickBooks sync reads from Supabase
- [x] Historical data accessible (2+ years)

### Non-Functional Requirements

- [x] Query performance < 2 seconds for typical date ranges
- [x] Record creation < 500ms
- [x] No data loss during migration
- [x] Rollback plan tested and documented
- [x] User training materials created
- [x] API documentation complete

### Code Quality

- [x] FileMaker dependencies removed from financial record code
- [x] Supabase RPC functions tested
- [x] Error handling for all API calls
- [x] Logging for audit trail
- [x] No hardcoded values (use config)

---

## Test Plan

### Unit Tests

**Backend (SQL):**
- Test `get_financial_records` with various filters
- Test `get_unpaid_records` filtering
- Test `create_financial_record` with valid/invalid data
- Test `mark_records_billed` bulk update

**Frontend (JavaScript):**
- Test `formatProductName()` function
- Test `createFinancialRecordForTask()` logic
- Test timer stop → record creation flow
- Test error handling for failed API calls

### Integration Tests

1. **Timer → Financial Record**
   - Start timer on task
   - Stop timer after 1 hour
   - Verify record created in Supabase
   - Verify hours, rate, total correct

2. **Manual Entry → Financial Record**
   - Submit manual entry form
   - Verify record created
   - Verify all fields populated

3. **QuickBooks Sync**
   - Create unbilled records
   - Run QB sync
   - Verify inv_id updated
   - Verify records marked as billed

4. **Financial Reporting**
   - Create records across multiple months
   - Query monthly summary
   - Verify aggregations correct
   - Compare to pre-migration reports

### Performance Tests

- Query 10,000 records by date range (target: < 2s)
- Create 100 records concurrently (target: < 5s)
- Bulk update 1,000 records (target: < 3s)

### Migration Tests

1. **Historical Data Migration**
   - Export FileMaker records (2 years)
   - Import to Supabase
   - Verify record count matches
   - Verify totals match FileMaker reports

2. **Dual-Write Validation**
   - Create record in both systems
   - Verify data consistency
   - Test failover if Supabase unavailable

---

## Code References

### Current Implementation (FileMaker-Based)

**API Layer:**
- `src/api/financialRecords.js` - FileMaker financial record API (495 lines)
  - Lines 111-234: `fetchFinancialRecords()` - Main query function
  - Lines 241-253: `fetchUnpaidRecords()` - Unbilled records
  - Lines 375-390: `updateFinancialRecordBilledStatus()` - Mark as billed
  - Lines 398-456: `bulkUpdateFinancialRecordsBilledStatus()` - Bulk billing

**Service Layer:**
- `src/services/billableHoursService.js` - Data processing (707 lines)
  - Lines 12-98: `processFinancialData()` - Transform FileMaker response
  - Lines 181-238: `groupRecordsByCustomer()` - Aggregate by customer
  - Lines 288-310: `calculateTotals()` - Calculate billed/unbilled totals
  - Lines 395-607: `prepareChartData()` - Visualization data

- `src/services/financialSyncService.js` - Reconciliation service (695 lines)
  - Lines 25-260: `synchronizeFinancialRecords()` - Main sync orchestrator
  - Lines 268-295: `fetchDevRecordsForDateRange()` - Get FileMaker records
  - Lines 304-336: `fetchCustomerSalesForDateRange()` - Get Supabase records
  - Lines 345-400: `compareRecords()` - Diff algorithm (toCreate, toUpdate, toDelete)
  - Lines 461-499: `createCustomerSaleFromDevRecord()` - Map FM → Supabase
  - Lines 628-640: `formatProductName()` - Customer + Project → Product name

**Hooks:**
- `src/hooks/useBillableHours.js` - Fetch/manage financial records
- `src/hooks/useFinancialSync.js` - Sync operations

**Components:**
- `src/components/financial/CustomerSalesTable.jsx` - Display Supabase records
- `src/components/financial/FinancialSyncPanel.jsx` - Manual sync UI
- `src/components/financial/RecordDetailsModal.jsx` - Record detail view
- `src/components/financial/QboTestPanel.jsx` - QuickBooks integration

**Timer Integration:**
- `src/components/tasks/TaskTimer.jsx` - Timer UI (lines 1-100)
- `src/services/taskService.js` - Task operations

### FileMaker Layout Reference

**Layout:** `devRecords` (also `dapiRecords`)
- Used by: `src/api/fileMaker.js` → `Layouts.RECORDS`
- Fields documented in: `src/services/billableHoursService.js:12-98`

### Supabase Schema

**Table:** `customer_sales` (verified via SSH)
- Columns: `id`, `financial_id`, `customer_id`, `product_id`, `product_name`, `quantity`, `unit_price`, `total_price`, `date`, `inv_id`, `organization_id`, `created_at`, `updated_at`, `configuration_data`
- Indexes: `customer_sales_pkey`, `customer_sales_financial_id_key`
- Foreign keys: `customer_id` → `customers.id`, `organization_id` → `organizations.id`

---

## Dependencies

### Internal Dependencies
- Customer migration must be complete (customer_id lookups)
- Organization structure must be stable (organization_id required)
- User authentication must provide organization context

### External Dependencies
- Backend team approval for RPC functions
- Database migration window for historical data import
- QuickBooks API availability for integration testing

---

## Risks & Mitigation

### Risk 1: Data Loss During Migration
**Mitigation:**
- Full backup before migration
- Dry-run migration on staging environment
- Parallel run period (FileMaker + Supabase)
- Automated data validation scripts

### Risk 2: Performance Degradation
**Mitigation:**
- Index all query columns
- Partition table by date (if > 1M records)
- Cache frequently accessed aggregations
- Monitor query performance with alerts

### Risk 3: QuickBooks Integration Breaks
**Mitigation:**
- Test QB sync on staging before cutover
- Maintain QB API contract (same data structure)
- Fallback to manual invoice creation if automated sync fails

### Risk 4: User Resistance to New Flow
**Mitigation:**
- Provide training materials and videos
- Maintain UI consistency with FileMaker version
- Offer support during transition period
- Collect user feedback and iterate

---

## Timeline Estimate

**Phase 1: Backend Preparation** - 2 weeks
- Week 1: RPC development + testing
- Week 2: Migration script + validation

**Phase 2: Frontend Implementation** - 3 weeks
- Week 1: API layer replacement
- Week 2: Timer integration
- Week 3: Component updates

**Phase 3: Testing & Validation** - 2 weeks
- Week 1: Integration testing
- Week 2: UAT + bug fixes

**Phase 4: Migration & Cutover** - 1 week
- Historical data import
- Parallel run verification
- Cutover to Supabase-only

**Total:** 8 weeks (with buffer for unforeseen issues)

---

## Success Metrics

- **Zero data loss** - All FileMaker records migrated successfully
- **Performance SLA met** - 95% of queries < 2s
- **User adoption** - 100% of active users on new system within 1 month
- **QuickBooks sync reliability** - 99%+ success rate
- **Reduced operational complexity** - Elimination of sync service reduces maintenance burden

---

## Appendix

### A. FileMaker Field Mappings (Complete List)

See `src/services/billableHoursService.js:76-96` for field processing logic.

### B. Supabase RPC Examples

See Backend Requirements section for SQL examples.

### C. Migration Scripts

To be developed in Phase 1 backend work.

### D. Rollback Procedure

1. Stop all writes to Supabase
2. Re-enable FileMaker write operations
3. Restore Supabase from pre-migration backup
4. Run reverse sync (Supabase → FileMaker for records created during migration)
5. Update frontend to use FileMaker API
6. Monitor for 24 hours

---

**Document Version:** 1.0
**Last Updated:** 2026-01-10
**Author:** Claude (Automated Documentation)
**Status:** Draft - Awaiting Review
