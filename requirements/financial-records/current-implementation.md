# Financial Records - Current Implementation

## Overview

Financial records (billing/customer sales) are currently stored in FileMaker's `devRecords` layout (also referenced as `dapiRecords`) and reconciled to Supabase's `customer_sales` table via a dual-write synchronization service.

**Primary Data Source:** FileMaker `devRecords` layout
**Secondary Data Source:** Supabase `customer_sales` table (reconciliation target)
**Sync Mechanism:** `financialSyncService.js` periodic reconciliation

---

## FileMaker Integration

### Layout: devRecords (dapiRecords)

**Fields:**
- `__ID` - Primary UUID identifier (maps to `financial_id` in Supabase)
- `_custID` - Customer ID (foreign key to customers)
- `_projectID` - Project ID (foreign key to projects)
- `DateStart` - Record date (MM/DD/YYYY format)
- `Billable_Time_Rounded` - Hours worked (decimal)
- `Hourly_Rate` or `Customers::chargeRate` - Billing rate per hour
- `f_billed` - Payment status (0=unbilled, 1=billed)
- `Work Performed` - Description of work performed
- `Tasks::task` - Associated task name
- `month`, `year` - Computed date fields for reporting
- `~creationTimestamp` - Auto-generated creation timestamp
- `~ModificationTimestamp` - Auto-generated modification timestamp

### FileMaker Operations

**Primary Flow:**
```
Timer Stop → FileMaker Script → devRecords Layout (CREATE) → Sync to Supabase
```

**Record Creation (Legacy):**
1. User starts timer on task (TaskTimer component)
2. User stops timer
3. Timer calculates elapsed time in seconds
4. FileMaker script executes to create record in `devRecords` layout
5. Record includes: customer ID, project ID, hours, rate, date, work description
6. Sync service later reconciles record to Supabase `customer_sales`

---

## Frontend Architecture

### API Layer

**File:** `src/api/financialRecords.js` (495 lines)

#### Functions

**`fetchFinancialRecords(timeframe, customerId, projectId)`** (Lines 111-234)
- **Purpose**: Query financial records by timeframe and optional filters
- **Parameters**:
  - `timeframe` - Time range (e.g., 'thisMonth', 'lastQuarter', 'thisYear')
  - `customerId` - Optional customer filter (UUID)
  - `projectId` - Optional project filter (UUID)
- **Returns**: Promise resolving to array of financial records
- **Implementation**: Calls FileMaker layout `devRecords` with date range query

```javascript
export async function fetchFinancialRecords(timeframe, customerId, projectId) {
    validateParams({ timeframe }, ['timeframe']);

    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.RECORDS,
            action: Actions.READ,
            query: [
                {
                    DateStart: `>=${startDate}`,
                    DateStart: `<=${endDate}`,
                    ...(customerId && { _custID: customerId }),
                    ...(projectId && { _projectID: projectId })
                }
            ],
            sort: [{ fieldName: 'DateStart', sortOrder: 'descend' }]
        };

        return await fetchDataFromFileMaker(params);
    });
}
```

**`fetchUnpaidRecords(customerId)`** (Lines 241-253)
- **Purpose**: Get all unbilled records for a customer or organization
- **Parameters**: `customerId` - Optional customer filter
- **Returns**: Promise resolving to array of unpaid records
- **Implementation**: Queries FileMaker WHERE `f_billed = 0`

**`fetchMonthlyRecords(month, year, customerId)`** (Lines 255-285)
- **Purpose**: Query records for a specific month
- **Parameters**:
  - `month` - Month number (1-12)
  - `year` - Year (YYYY)
  - `customerId` - Optional customer filter
- **Returns**: Promise resolving to monthly records

**`fetchQuarterlyRecords(quarter, year, customerId)`** (Lines 287-320)
- **Purpose**: Query records for a specific quarter
- **Parameters**:
  - `quarter` - Quarter number (1-4)
  - `year` - Year (YYYY)
  - `customerId` - Optional customer filter
- **Returns**: Promise resolving to quarterly records

**`fetchYearlyRecords(year, customerId)`** (Lines 322-348)
- **Purpose**: Query records for a specific year
- **Parameters**:
  - `year` - Year (YYYY)
  - `customerId` - Optional customer filter
- **Returns**: Promise resolving to yearly records

**`updateFinancialRecordBilledStatus(recordId, billedStatus)`** (Lines 375-390)
- **Purpose**: Mark a single record as billed/unbilled
- **Parameters**:
  - `recordId` - Record UUID
  - `billedStatus` - Boolean (true=billed, false=unbilled)
- **Returns**: Promise resolving to update result
- **Implementation**: Updates FileMaker `f_billed` field (0 or 1)

**`bulkUpdateFinancialRecordsBilledStatus(recordIds, billedStatus)`** (Lines 398-456)
- **Purpose**: Mark multiple records as billed/unbilled in batch
- **Parameters**:
  - `recordIds` - Array of record UUIDs
  - `billedStatus` - Boolean (true=billed, false=unbilled)
- **Returns**: Promise resolving to bulk update results
- **Implementation**: Iterates through records, updates each in FileMaker

---

## Service Layer

### billableHoursService.js (707 lines)

**File:** `src/services/billableHoursService.js`

#### Functions

**`processFinancialData(data)`** (Lines 12-98)
- **Purpose**: Transform FileMaker response to application format
- **Parameters**: `data` - Raw FileMaker response
- **Returns**: Processed array of financial records
- **Implementation**:
  - Maps FileMaker field names to application field names
  - Converts date formats (MM/DD/YYYY → YYYY-MM-DD)
  - Parses numeric fields (quantity, unit_price, total_price)
  - Derives billed status from `f_billed` field

```javascript
export function processFinancialData(data) {
    if (!data || !Array.isArray(data)) return [];

    return data.map(record => ({
        id: record.__ID,
        financial_id: record.__ID,
        customer_id: record._custID,
        customer_name: record['Customers::Name'],
        project_id: record._projectID,
        project_name: record['customers_Projects::projectName'],
        task_name: record['Tasks::task'],
        work_performed: record['Work Performed'],
        quantity: parseFloat(record.Billable_Time_Rounded || 0),
        unit_price: parseFloat(record.Hourly_Rate || record['Customers::chargeRate'] || 0),
        total_price: parseFloat(record.Billable_Time_Rounded || 0) * parseFloat(record.Hourly_Rate || record['Customers::chargeRate'] || 0),
        date: convertDateFormat(record.DateStart), // MM/DD/YYYY → YYYY-MM-DD
        billed: record.f_billed === '1' || record.f_billed === 1,
        created_at: record['~creationTimestamp'],
        updated_at: record['~modificationTimestamp']
    }));
}
```

**`groupRecordsByCustomer(records)`** (Lines 181-238)
- **Purpose**: Aggregate records by customer for reporting
- **Parameters**: `records` - Array of financial records
- **Returns**: Object mapping customer_id to aggregated data
- **Implementation**:
  - Groups records by customer_id
  - Calculates total hours per customer
  - Calculates total amount per customer
  - Separates billed/unbilled amounts

**`groupRecordsByProject(records, customerId)`** (Lines 288-310)
- **Purpose**: Aggregate records by project within a customer
- **Parameters**:
  - `records` - Array of financial records
  - `customerId` - Customer UUID to filter by
- **Returns**: Object mapping project_id to aggregated data

**`calculateTotals(records)`** (Lines 288-310)
- **Purpose**: Calculate aggregate totals for a set of records
- **Parameters**: `records` - Array of financial records
- **Returns**: Object with `totalHours`, `totalAmount`, `billedAmount`, `unbilledAmount`
- **Implementation**:
  - Sums `quantity` field for total hours
  - Sums `total_price` field for total amount
  - Separates billed/unbilled based on `billed` field

**`prepareChartData(records, chartType)`** (Lines 395-607)
- **Purpose**: Generate visualization data for charts
- **Parameters**:
  - `records` - Array of financial records
  - `chartType` - Chart type ('monthly', 'quarterly', 'yearly', 'byCustomer', 'byProject')
- **Returns**: Chart-ready data structure
- **Implementation**:
  - Groups data by time period or entity
  - Formats data for Chart.js or similar libraries
  - Includes labels, datasets, colors

---

## Synchronization Service

### financialSyncService.js (695 lines)

**File:** `src/services/financialSyncService.js`

#### Primary Functions

**`synchronizeFinancialRecords(organizationId, startDate, endDate, options)`** (Lines 25-260)
- **Purpose**: Main orchestrator for syncing FileMaker records to Supabase
- **Parameters**:
  - `organizationId` - Organization UUID (for RLS)
  - `startDate` - Start of date range (YYYY-MM-DD)
  - `endDate` - End of date range (YYYY-MM-DD)
  - `options` - Configuration object:
    - `dryRun` - Boolean (preview changes without applying)
    - `fullReview` - Boolean (review all records, not just changes)
- **Returns**: Promise resolving to sync result summary
- **Implementation**:
  1. Fetch devRecords from FileMaker (date range)
  2. Fetch customer_sales from Supabase (organization_id + date range)
  3. Compare records using `compareRecords()` diff algorithm
  4. Apply changes: toCreate, toUpdate, toDelete
  5. Return summary of actions taken

```javascript
export async function synchronizeFinancialRecords(organizationId, startDate, endDate, options = {}) {
    const { dryRun = false, fullReview = false } = options;

    try {
        // Step 1: Fetch FileMaker records
        const devRecords = await fetchDevRecordsForDateRange(startDate, endDate);

        // Step 2: Fetch Supabase records
        const customerSales = await fetchCustomerSalesForDateRange(organizationId, startDate, endDate);

        // Step 3: Compare and identify changes
        const comparison = compareRecords(devRecords, customerSales, organizationId);

        // Step 4: Apply changes (if not dry run)
        if (!dryRun) {
            await applyChanges(comparison);
        }

        // Step 5: Return summary
        return {
            toCreate: comparison.toCreate.length,
            toUpdate: comparison.toUpdate.length,
            toDelete: comparison.toDelete.length,
            unchanged: comparison.unchanged.length,
            errors: comparison.errors
        };
    } catch (error) {
        logger.error('Sync failed:', error);
        throw error;
    }
}
```

**`getFinancialSyncStatus(organizationId, startDate, endDate)`** (Lines 268-295)
- **Purpose**: Dry-run summary of sync differences
- **Parameters**: Same as `synchronizeFinancialRecords` but always dry-run
- **Returns**: Object with counts of toCreate, toUpdate, toDelete, unchanged

**`fetchDevRecordsForDateRange(startDate, endDate)`** (Lines 268-295)
- **Purpose**: Fetch FileMaker records for date range
- **Parameters**: Date range (YYYY-MM-DD format)
- **Returns**: Array of FileMaker records
- **Implementation**: Calls `fetchFinancialRecords()` from API layer

**`fetchCustomerSalesForDateRange(organizationId, startDate, endDate)`** (Lines 304-336)
- **Purpose**: Fetch Supabase records for date range
- **Parameters**: Organization ID and date range
- **Returns**: Array of Supabase customer_sales records
- **Implementation**: Direct Supabase query with RLS filter

```javascript
export async function fetchCustomerSalesForDateRange(organizationId, startDate, endDate) {
    const { data, error } = await supabase
        .from('customer_sales')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
}
```

**`compareRecords(devRecords, customerSales, organizationId)`** (Lines 345-400)
- **Purpose**: Diff algorithm to identify sync changes
- **Parameters**:
  - `devRecords` - FileMaker records
  - `customerSales` - Supabase records
  - `organizationId` - Organization UUID
- **Returns**: Object with `toCreate`, `toUpdate`, `toDelete`, `unchanged` arrays
- **Implementation**:
  1. Index customer_sales by `financial_id`
  2. For each devRecord:
     - If not in Supabase: `toCreate`
     - If in Supabase but fields differ: `toUpdate`
     - If in Supabase and identical: `unchanged`
  3. For each customer_sales record not in devRecords: `toDelete`
  4. Compare fields with rounding for numeric precision

```javascript
export function compareRecords(devRecords, customerSales, organizationId) {
    const toCreate = [];
    const toUpdate = [];
    const toDelete = [];
    const unchanged = [];

    // Index customer_sales by financial_id
    const salesIndex = new Map(
        customerSales.map(sale => [sale.financial_id, sale])
    );

    // Compare each devRecord
    for (const devRecord of devRecords) {
        const financialId = devRecord.__ID;
        const existingSale = salesIndex.get(financialId);

        if (!existingSale) {
            toCreate.push(devRecord);
        } else {
            // Compare fields (with decimal rounding)
            if (recordsAreDifferent(devRecord, existingSale)) {
                toUpdate.push({ devRecord, existingSale });
            } else {
                unchanged.push(existingSale);
            }
            salesIndex.delete(financialId); // Mark as processed
        }
    }

    // Remaining salesIndex entries are orphans (to delete)
    toDelete.push(...salesIndex.values());

    return { toCreate, toUpdate, toDelete, unchanged };
}
```

**`createCustomerSaleFromDevRecord(devRecord, organizationId)`** (Lines 461-499)
- **Purpose**: Map FileMaker record to Supabase record structure
- **Parameters**:
  - `devRecord` - FileMaker record object
  - `organizationId` - Organization UUID
- **Returns**: Supabase-ready record object
- **Implementation**:
  - Lookup customer_id by business_name
  - Create customer if not found
  - Format product_name using customer + project names
  - Convert date format (MM/DD/YYYY → YYYY-MM-DD)
  - Calculate total_price = quantity × unit_price
  - Set inv_id = 'MIGRATED' if f_billed = 1

```javascript
export async function createCustomerSaleFromDevRecord(devRecord, organizationId) {
    // 1. Lookup/create customer
    const customerName = devRecord['Customers::Name'];
    let customerId = await lookupOrCreateCustomer(customerName, organizationId);

    // 2. Format product_name
    const projectName = devRecord['customers_Projects::projectName'];
    const productName = formatProductName(customerName, projectName);

    // 3. Parse numeric fields
    const quantity = parseFloat(devRecord.Billable_Time_Rounded || 0);
    const unitPrice = parseFloat(devRecord.Hourly_Rate || devRecord['Customers::chargeRate'] || 0);
    const totalPrice = quantity * unitPrice;

    // 4. Convert date
    const date = convertDateToISO(devRecord.DateStart); // MM/DD/YYYY → YYYY-MM-DD

    // 5. Preserve billed status
    const invId = (devRecord.f_billed === '1' || devRecord.f_billed === 1) ? 'MIGRATED' : null;

    // 6. Build record
    return {
        financial_id: devRecord.__ID,
        organization_id: organizationId,
        customer_id: customerId,
        product_name: productName,
        quantity: quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        date: date,
        inv_id: invId,
        created_at: devRecord['~creationTimestamp'],
        updated_at: devRecord['~modificationTimestamp']
    };
}
```

**`updateCustomerSaleFromDevRecord(customerSaleId, devRecord, organizationId)`** (Lines 507-545)
- **Purpose**: Update existing Supabase record from FileMaker data
- **Parameters**:
  - `customerSaleId` - Supabase record UUID
  - `devRecord` - FileMaker record object
  - `organizationId` - Organization UUID
- **Returns**: Updated record object
- **Implementation**: Similar to create, but updates existing record

**`formatProductName(customerName, projectName)`** (Lines 628-640)
- **Purpose**: Generate product_name field from customer + project
- **Parameters**:
  - `customerName` - Customer business name
  - `projectName` - Project name
- **Returns**: Formatted string (e.g., "CLARITYBUSINESS:Development")
- **Implementation**:
  - Extract capital letters and numbers from customer name
  - Get first word of project name
  - Format as `{CAPS}:{WORD}`

```javascript
export function formatProductName(customerName, projectName) {
    // Extract capital letters and numbers only
    const customerCaps = customerName.replace(/[^A-Z0-9]/g, '').trim();

    // Get first word of project name
    const projectFirstWord = projectName.split(' ')[0];

    // Combine: "CLARITYBUSINESS:Development"
    return `${customerCaps}:${projectFirstWord}`;
}
```

---

## Hooks

### useBillableHours.js

**File:** `src/hooks/useBillableHours.js`

**Purpose**: React hook for fetching and managing financial records in components

**Exports**:
- `useBillableHours(timeframe, customerId, projectId)` - Hook for fetching records
- Returns: `{ records, loading, error, refresh }`

**Implementation**:
```javascript
export function useBillableHours(timeframe, customerId, projectId) {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchRecords = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchFinancialRecords(timeframe, customerId, projectId);
            const processed = processFinancialData(data);
            setRecords(processed);
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [timeframe, customerId, projectId]);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    return { records, loading, error, refresh: fetchRecords };
}
```

### useFinancialSync.js

**File:** `src/hooks/useFinancialSync.js`

**Purpose**: React hook for managing sync operations

**Exports**:
- `useFinancialSync(organizationId)` - Hook for sync operations
- Returns: `{ syncStatus, runSync, loading, error }`

---

## UI Components

### CustomerSalesTable.jsx

**File:** `src/components/financial/CustomerSalesTable.jsx`

**Purpose**: Display customer_sales records from Supabase (web app environment)

**Features**:
- Displays records in tabular format
- Columns: Date, Customer, Project, Hours, Rate, Total, Billed Status
- Sorting and filtering capabilities
- Supports marking records as billed/unbilled
- Integrated with QuickBooks sync

### FinancialSyncPanel.jsx

**File:** `src/components/financial/FinancialSyncPanel.jsx`

**Purpose**: Admin UI for triggering manual FileMaker → Supabase sync

**Features**:
- Date range selector
- Preview sync changes (dry-run)
- Execute sync
- Show sync status and discrepancies (toCreate, toUpdate, toDelete counts)
- Error handling and retry

### RecordDetailsModal.jsx

**File:** `src/components/financial/RecordDetailsModal.jsx`

**Purpose**: Display detailed view of a single financial record

**Features**:
- Shows all record fields
- Work performed description
- Task name
- Billing information
- Created/updated timestamps
- Edit capability (admin only)

### QboTestPanel.jsx

**File:** `src/components/financial/QboTestPanel.jsx`

**Purpose**: QuickBooks integration testing UI

**Features**:
- Test QB connection
- Generate invoices from customer_sales records
- Sync invoice IDs back to records
- Error handling for QB API failures

---

## Timer Integration (Current)

### TaskTimer.jsx

**File:** `src/components/tasks/TaskTimer.jsx`

**Current Flow:**
1. User clicks "Start Timer" button on task
2. Component tracks elapsed time in seconds
3. User clicks "Stop Timer" button
4. **FileMaker script executes** to create record in `devRecords` layout
5. Sync service later reconciles to Supabase

**Limitation:** Timer stop depends on FileMaker script execution, preventing web app from operating independently.

---

## QuickBooks Integration

### Service: financialSyncService.js (QB Features)

**Functions:**
- `generateQuickBooksInvoice(customerId, recordIds)` - Generate QB invoice from records
- `syncInvoiceIdToRecords(recordIds, invoiceId)` - Update records with QB invoice ID

### Edge Function: quickbooksEdgeFunction.js

**File:** `supabase/functions/quickbooksEdgeFunction.js`

**Purpose**: Supabase Edge Function for QuickBooks API operations

**Features**:
- OAuth token management
- Create invoice in QuickBooks
- Read customer_sales records from Supabase
- Return invoice ID for storage

---

## Data Transformations

### Date Format Conversion

**FileMaker:** MM/DD/YYYY (e.g., "01/15/2026")
**Supabase:** YYYY-MM-DD (e.g., "2026-01-15")

**Function:** `convertDateFormat(dateString)`

### Product Name Formatting

**Rule:** Extract capital letters from customer name + first word of project name

**Examples:**
- Customer: "Clarity Business Solutions", Project: "Development Work" → "CLARITYBUSINESS:Development"
- Customer: "ABC Corp", Project: "Website Redesign" → "ABCCORP:Website"

### Billed Status Mapping

**FileMaker:** `f_billed` field (0 or 1)
**Supabase:** `inv_id` field (NULL=unbilled, value=billed)

**Migration Rule:**
- If `f_billed = 1`, set `inv_id = 'MIGRATED'`
- If `f_billed = 0`, set `inv_id = NULL`

### Decimal Precision

**Rule:** Round to 2 decimal places for comparison to avoid floating-point drift

**Function:** `roundToTwoDecimals(value)`

---

## Sync Tracking

### syncTrackingService.js

**File:** `src/services/syncTrackingService.js`

**Purpose**: Store pending sync changes in localStorage for review

**Functions**:
- `savePendingChanges(changes)` - Save sync preview to localStorage
- `loadPendingChanges()` - Load saved changes
- `clearPendingChanges()` - Clear after sync applied

**Use Case:** Allow users to review sync changes across sessions before applying

---

## Known Issues & Limitations

### Issue 1: Dual-Source Data Complexity

**Problem:** Financial records exist in two systems (FileMaker + Supabase), requiring constant reconciliation.

**Impact:** Increased complexity, potential data drift, sync failures can cause discrepancies.

### Issue 2: Timer Dependency on FileMaker

**Problem:** Timer stop operation requires FileMaker script execution, preventing standalone web app operation.

**Impact:** Web app users cannot create financial records without FileMaker environment.

### Issue 3: Product Name Format Ambiguity

**Problem:** Product name formatting relies on string manipulation that can produce ambiguous results (multiple projects with same first word).

**Impact:** Difficult to map product_name back to specific project without additional context.

### Issue 4: Customer Lookup/Creation Race Conditions

**Problem:** Sync service looks up customers by business_name and creates if not found, which can cause duplicates if multiple syncs run concurrently.

**Impact:** Duplicate customer records in Supabase if not properly handled.

### Issue 5: No Task → Financial Record Link

**Problem:** Financial records don't store task_id reference, only derived task name string.

**Impact:** Cannot query financial records by task, cannot link records back to tasks for audit trail.

---

## Dependencies

### Internal Dependencies
- Customer data must exist in Supabase (customer_id lookups)
- Organization structure must be stable (organization_id required for RLS)
- User authentication must provide organization context

### External Dependencies
- FileMaker server availability (for sync operations)
- Supabase availability (for record storage)
- QuickBooks API availability (for invoice generation)

---

## Code References

### Primary Files

1. **API Layer:**
   - `src/api/financialRecords.js` (495 lines) - FileMaker API calls

2. **Service Layer:**
   - `src/services/billableHoursService.js` (707 lines) - Data processing
   - `src/services/financialSyncService.js` (695 lines) - Reconciliation logic

3. **Hooks:**
   - `src/hooks/useBillableHours.js` - Financial records hook
   - `src/hooks/useFinancialSync.js` - Sync operations hook

4. **Components:**
   - `src/components/financial/CustomerSalesTable.jsx` - Display records
   - `src/components/financial/FinancialSyncPanel.jsx` - Sync UI
   - `src/components/financial/RecordDetailsModal.jsx` - Detail view
   - `src/components/financial/QboTestPanel.jsx` - QuickBooks integration
   - `src/components/tasks/TaskTimer.jsx` - Timer UI

5. **Supabase:**
   - `supabase/functions/quickbooksEdgeFunction.js` - QB Edge Function

### FileMaker Layout Reference

**Layout:** `devRecords` (also `dapiRecords`)
**Used by:** `src/api/fileMaker.js` → `Layouts.RECORDS`
**Fields documented in:** `src/services/billableHoursService.js:12-98`

---

**Document Version:** 1.0
**Last Updated:** 2026-01-11
**Status:** Phase 1 Requirements Documentation
