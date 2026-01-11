# QuickBooks Integration Migration - Requirements Documentation

## Overview

This document outlines the current QuickBooks Online (QBO) integration, its dependencies on FileMaker financial records, and the requirements for migrating to a Supabase-only architecture.

**Current State:** QuickBooks integration depends on FileMaker `devRecords` layout as the source of financial data. Records are synced to Supabase `customer_sales` table, then used to generate QuickBooks invoices.

**Target State:** QuickBooks integration operates entirely on Supabase `customer_sales` table as the single source of truth. FileMaker dependency is removed, and invoice generation flows directly from Supabase.

---

## Table of Contents

1. [Current QuickBooks Integration Architecture](#current-quickbooks-integration-architecture)
2. [FileMaker Dependencies](#filemaker-dependencies)
3. [Data Flow and Transformations](#data-flow-and-transformations)
4. [Backend API Integration](#backend-api-integration)
5. [Migration Requirements](#migration-requirements)
6. [Acceptance Criteria](#acceptance-criteria)
7. [Test Plan](#test-plan)
8. [Code References](#code-references)

---

## Current QuickBooks Integration Architecture

### 1. Backend API Layer

**API Client:** `src/api/quickbooksApi.js`

**Authentication:** HMAC-SHA256 signature-based authentication
- Secret key: `VITE_SECRET_KEY` (from environment)
- Format: `Bearer {signature}.{timestamp}`
- Organization ID header: `X-Organization-ID`

**Base URL:** `https://api.claritybusinesssolutions.ca/quickbooks`

**Key Operations:**

**Authorization Operations:**
- `getQBOAuthorizationUrl()` - Get OAuth URL for QuickBooks connection (Line 195)
- `handleQBOOAuthCallback(code, state, realmId)` - Handle OAuth callback (Line 206)
- `refreshQBOToken()` - Refresh expired tokens (Line 218)
- `validateQBOCredentials()` - Validate QuickBooks connection (Line 226)

**Customer Operations:**
- `listQBOCustomers(params)` - List all QBO customers (Line 251)
- `getQBOCustomer(customerId)` - Get specific customer (Line 262)
- `createQBOCustomer(customerData)` - Create new customer (Line 271)
- `updateQBOCustomer(customerData)` - Update customer (Line 280)
- `searchQBOCustomers(params)` - Search by name/email (Line 302)

**Invoice Operations:**
- `listQBOInvoices(params)` - List all invoices (Line 323)
- `getQBOInvoice(invoiceId)` - Get specific invoice (Line 334)
- `createQBOInvoice(invoiceData)` - Create new invoice (Line 343)
- `updateQBOInvoice(invoiceData)` - Update invoice (Line 350)
- `sendQBOInvoiceEmail(invoiceId, sendToEmail)` - Email invoice (Line 548)

**Company & Other Operations:**
- `getQBOCompanyInfo()` - Get company information (Line 238)
- `listQBOItems(params)` - List items/services (Line 425)
- `executeQBOQuery(query)` - Custom SQL-like queries (Line 455)

**Deprecated File:** `src/api/quickbooksEdgeFunction.js` - Intentionally disabled, throws error if imported

### 2. Invoice Generation Service

**Service:** `src/services/invoiceGenerationService.js`

**Purpose:** Generates complete QuickBooks invoice payloads from financial records with advanced business logic.

**Key Function:**
```javascript
generateInvoicePayload(salesRecords, qboCustomer, options)
```

**Business Rules:**

**Document Number Format:** (Line 87-110)
- Format: `{qboCustomerId}{YY}{MM}{NNN}`
- Example: `123452601001` (Customer 12345, January 2026, invoice #1)
- Sequence number determined by querying existing invoices for customer in the month
- Starts at 001 and increments for each invoice

**Tax Code Selection:** (Line 206-209)
- CAD currency: Tax code 4
- Non-CAD currencies (USD, EUR): Tax code 3

**Due Date Calculation:** (Line 169-189)
- Net 30 (EOM next month): 30 days from invoice date, then end of that month
- Example: Invoice on Jan 15 → 30 days = Feb 14 → EOM = Feb 28/29

**Item Mapping by Currency:** (Line 216-225)
- CAD: "Development CAD" (Item ID: 3)
- USD: "Development USD" (Item ID: 7)
- EUR: "Development EUR" (Item ID: 8)

**Line Item Generation:** (Line 249-306)
- Groups sales records by `product_name` and `unit_price`
- Aggregates quantity and total amount for grouped items
- Rounds all monetary values to 2 decimal places
- Each line item includes:
  - Amount (total price)
  - Description (product_name from sales record)
  - Quantity (hours)
  - Unit Price (rate)
  - Tax Code Reference
  - Item Reference (based on currency)

**Invoice Payload Structure:**
```javascript
{
  BillEmail: { Address: customer.email },
  CurrencyRef: { name: "Canadian Dollar", value: "CAD" },
  CustomerRef: { name: customer.name, value: customer.id },
  DeliveryInfo: { DeliveryType: "Email" },
  DocNumber: "123452601001",
  DueDate: "2026-02-28",
  GlobalTaxCalculation: "TaxExcluded",
  Line: [/* line items */]
}
```

**Supporting Functions:**
- `validateInvoiceData(salesRecords, qboCustomer)` - Validation before generation (Line 314)
- `formatInvoiceForLogging(invoicePayload)` - Debug output (Line 361)

---

## FileMaker Dependencies

### 1. Financial Records Source

**Current Dependency:** QuickBooks invoice generation relies on financial data from FileMaker `devRecords` layout.

**FileMaker API Integration:** `src/api/financialRecords.js`

**Key FileMaker Functions Used by QuickBooks Flow:**

**Fetching Records for Invoice Generation:**
```javascript
// Fetch unbilled records for a customer
fetchUnpaidRecords(customerId)  // Line 241
// Returns records where f_billed = 0

// Fetch records by date range
fetchRecordsForDateRange(startDate, endDate)  // Line 464
// Used by financialSyncService for synchronization
```

**Updating Billed Status:**
```javascript
// Mark single record as billed
updateFinancialRecordBilledStatus(recordId, billedStatus = 1)  // Line 375

// Mark multiple records as billed (bulk)
bulkUpdateFinancialRecordsBilledStatus(recordIds, billedStatus = 1)  // Line 398
// Processes in batches of 10 records
```

**FileMaker Field Mapping:**
- `__ID` → `financial_id` (UUID, primary key mapping to Supabase)
- `_custID` → Customer lookup reference
- `_projectID` → Project reference
- `DateStart` → `date` (MM/DD/YYYY → YYYY-MM-DD conversion)
- `Billable_Time_Rounded` → `quantity` (hours)
- `Hourly_Rate` or `Customers::chargeRate` → `unit_price` (rate)
- `f_billed` → Billing status (0=unbilled, 1=billed)
- `Work Performed` → Description field
- `Tasks::task` → Associated task name

### 2. Financial Synchronization Service

**Service:** `src/services/financialSyncService.js`

**Purpose:** Reconciles FileMaker `devRecords` with Supabase `customer_sales` table.

**Critical for QuickBooks:** This service ensures `customer_sales` table (used by QuickBooks) stays in sync with FileMaker source data.

**Key Functions:**

**Synchronization:** (Line 25-260)
```javascript
synchronizeFinancialRecords(organizationId, startDate, endDate, options)
```
- Fetches devRecords from FileMaker for date range (Line 268-295)
- Fetches customer_sales from Supabase for same date range (Line 304-336)
- Compares records by `financial_id` (case-insensitive) (Line 345-400)
- Identifies: toCreate, toUpdate, toDelete, unchanged
- Applies changes to Supabase (Line 122-196)
- Supports dry-run mode for preview

**Comparison Logic:** (Line 345-400)
- Creates map of customer_sales by `financial_id` (lowercase for case-insensitive matching)
- For each FileMaker record:
  - If not in Supabase → mark for creation
  - If exists but different → mark for update
  - If identical → mark as unchanged
- Remaining Supabase records (not in FileMaker) → mark for deletion (if deleteOrphaned=true)

**Change Detection:** (Line 409-453)
```javascript
identifyChanges(devRecord, customerSale, organizationId)
```
- Compares quantity (hours) - rounded to 2 decimals
- Compares unit_price (rate) - rounded to 2 decimals
- Compares total_price (amount) - rounded to 2 decimals
- Compares date (YYYY-MM-DD format)
- Compares product_name (formatted)
- Compares customer_id (ensures match)

**Data Transformations:**

**Product Name Formatting:** (Line 628-640)
```javascript
formatProductName(customerName, projectName)
```
- Extracts capital letters and numbers from customer name
- Takes first word of project name
- Format: `{CUSTOMER_CAPS}:{PROJECT_FIRST_WORD}`
- Example: "ABC Company" + "Website Redesign" → "ABC:Website"

**Customer Management:** (Line 552-590)
```javascript
getOrCreateCustomerId(customerName, organizationId)
```
- Searches Supabase `customers` table by `business_name`
- Creates customer if not found (type: 'CUSTOMER')
- Links customer to organization via `customer_organization` table (Line 598-620)

**Record Creation:** (Line 461-499)
```javascript
createCustomerSaleFromDevRecord(devRecord, organizationId)
```
- Maps FileMaker fields to Supabase schema
- Inserts into `customer_sales` table with:
  - `financial_id` (from devRecord.id)
  - `customer_id` (looked up/created)
  - `organization_id`
  - `product_name` (formatted)
  - `quantity`, `unit_price`, `total_price`
  - `date` (YYYY-MM-DD format)

**Record Update:** (Line 508-544)
```javascript
updateCustomerSaleFromDevRecord(customerSaleId, devRecord, organizationId)
```
- Updates existing customer_sales record with latest FileMaker data

### 3. Invoice Generation Workflow Dependencies

**Current Flow:**
```
1. User selects unbilled records (FileMaker source via fetchUnpaidRecords)
2. Records synced to Supabase customer_sales via financialSyncService
3. Invoice generated from customer_sales data via invoiceGenerationService
4. Invoice sent to QuickBooks via quickbooksApi
5. Records marked as billed in FileMaker via updateFinancialRecordBilledStatus
```

**Critical FileMaker Dependencies:**
1. **Source Data:** FileMaker `devRecords` is the authoritative source
2. **Billing Status:** `f_billed` field maintained in FileMaker
3. **Record IDs:** FileMaker `__ID` field maps to Supabase `financial_id`
4. **Timer Integration:** New records created in FileMaker when timers stop

---

## Data Flow and Transformations

### 1. Current End-to-End Invoice Generation Flow

**Step 1: User Initiates Invoice Creation**
- Component: `src/components/financial/QboTestPanel.jsx` or similar UI
- User selects customer and unbilled records

**Step 2: Fetch Unbilled Records from FileMaker**
```javascript
// src/api/financialRecords.js:241
const result = await fetchUnpaidRecords(customerId);
```
- Queries FileMaker `devRecords` layout
- Filter: `f_billed = 0`
- Returns FileMaker response with fieldData

**Step 3: Process FileMaker Response**
```javascript
// src/services/billableHoursService.js
const processedRecords = processFinancialData(result);
```
- Transforms FileMaker response to application format
- Normalizes field names and data types

**Step 4: Sync to Supabase (if needed)**
```javascript
// src/services/financialSyncService.js:25
const syncResult = await synchronizeFinancialRecords(
  organizationId,
  startDate,
  endDate
);
```
- Ensures `customer_sales` table has latest data
- Creates/updates records based on FileMaker source

**Step 5: Fetch QuickBooks Customer**
```javascript
// src/api/quickbooksApi.js:302
const qboCustomers = await searchQBOCustomers({
  name: customerName
});
```
- Searches QuickBooks for matching customer
- Creates customer if not found via `createQBOCustomer`

**Step 6: Generate Invoice Payload**
```javascript
// src/services/invoiceGenerationService.js:26
const invoicePayload = await generateInvoicePayload(
  salesRecords,
  qboCustomer,
  options
);
```
- Applies business rules (doc number, tax codes, due date)
- Generates line items from sales records
- Returns complete QuickBooks invoice payload

**Step 7: Create Invoice in QuickBooks**
```javascript
// src/api/quickbooksApi.js:343
const createdInvoice = await createQBOInvoice(invoicePayload);
```
- Sends invoice to QuickBooks API via backend
- Returns created invoice with QuickBooks ID

**Step 8: Update FileMaker Billed Status**
```javascript
// src/api/financialRecords.js:398
await bulkUpdateFinancialRecordsBilledStatus(recordIds, 1);
```
- Marks records as billed (`f_billed = 1`) in FileMaker
- Updates in batches of 10 records

**Step 9: Email Invoice (Optional)**
```javascript
// src/api/quickbooksApi.js:548
await sendQBOInvoiceEmail(invoiceId, customerEmail);
```
- Sends invoice via QuickBooks email delivery

### 2. Data Transformation Map

**FileMaker → Application Format:**
```javascript
// src/services/billableHoursService.js (processFinancialData)
{
  id: fieldData.__ID,                    // UUID
  customerId: fieldData._custID,         // Customer FK
  customerName: fieldData["Customers::Business Name"],
  projectId: fieldData._projectID,       // Project FK
  projectName: fieldData["Projects::Project"],
  date: fieldData.DateStart,             // MM/DD/YYYY
  hours: fieldData.Billable_Time_Rounded,
  rate: fieldData.Hourly_Rate || fieldData["Customers::chargeRate"],
  amount: hours * rate,                  // Calculated
  billed: fieldData.f_billed,            // 0 or 1
  description: fieldData["Work Performed"],
  taskName: fieldData["Tasks::task"]
}
```

**Application Format → Supabase customer_sales:**
```javascript
// src/services/financialSyncService.js:470-479
{
  financial_id: record.id,               // UUID from FileMaker
  customer_id: lookupCustomerId(),       // Supabase customer UUID
  organization_id: organizationId,       // Supabase org UUID
  product_name: formatProductName(),     // "{CAPS}:{FIRST_WORD}"
  quantity: record.hours,                // Decimal
  unit_price: record.rate,               // Decimal
  total_price: record.amount,            // Decimal
  date: "YYYY-MM-DD",                    // ISO format
  inv_id: null,                          // QuickBooks invoice ID (set later)
  created_at: "ISO timestamp",           // Auto
  updated_at: "ISO timestamp"            // Auto
}
```

**Supabase customer_sales → QuickBooks Invoice Line Item:**
```javascript
// src/services/invoiceGenerationService.js:284-297
{
  Amount: record.total_price,            // Rounded to 2 decimals
  Description: record.product_name,      // Product/service description
  DetailType: "SalesItemLineDetail",
  LineNum: index + 1,                    // Sequential
  SalesItemLineDetail: {
    ItemRef: {                           // Based on currency
      name: "Development CAD",           // CAD/USD/EUR
      value: "3"                         // Item ID (3/7/8)
    },
    Qty: record.quantity,                // Hours (rounded to 2 decimals)
    TaxCodeRef: { value: 4 },            // 4=CAD, 3=non-CAD
    UnitPrice: record.unit_price         // Rate (rounded to 2 decimals)
  }
}
```

### 3. Supabase Schema Requirements

**Table: customer_sales**

**Current Schema Used by QuickBooks:**
```sql
CREATE TABLE customer_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  financial_id TEXT UNIQUE,              -- Maps to FileMaker __ID
  customer_id UUID REFERENCES customers(id),
  organization_id UUID REFERENCES organizations(id),
  product_id UUID REFERENCES products(id),  -- Optional
  product_name TEXT NOT NULL,            -- Required for invoices
  quantity DECIMAL NOT NULL,             -- Hours worked
  unit_price DECIMAL NOT NULL,           -- Billing rate
  total_price DECIMAL NOT NULL,          -- Calculated amount
  date DATE NOT NULL,                    -- Service date
  inv_id TEXT,                           -- QuickBooks invoice ID
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes needed for QuickBooks operations
CREATE INDEX idx_customer_sales_financial_id ON customer_sales(financial_id);
CREATE INDEX idx_customer_sales_org_date ON customer_sales(organization_id, date);
CREATE INDEX idx_customer_sales_customer ON customer_sales(customer_id);
CREATE INDEX idx_customer_sales_unbilled ON customer_sales(organization_id)
  WHERE inv_id IS NULL;
```

**RLS Policies Required:**
- Organization-scoped access (all queries include `organization_id`)
- Read access for authenticated users in organization
- Write access for invoice generation service

---

## Backend API Integration

### 1. Backend API Endpoints

**Base URL:** `https://api.claritybusinesssolutions.ca`

**Documentation:**
- OpenAPI spec: `https://api.claritybusinesssolutions.ca/openapi.json`
- Interactive docs: `https://api.claritybusinesssolutions.ca/docs`

**QuickBooks Endpoints:**

**Authorization:**
- `GET /quickbooks/authorize` - Get OAuth authorization URL
- `POST /quickbooks/oauth/callback` - Handle OAuth callback
- `POST /quickbooks/token/refresh` - Refresh access token
- `POST /quickbooks/validate` - Validate credentials

**Company:**
- `GET /quickbooks/company-info` - Get company information

**Customers:**
- `GET /quickbooks/customers` - List customers (supports pagination)
- `GET /quickbooks/customers/{customerId}` - Get customer by ID
- `POST /quickbooks/customers` - Create customer
- `PUT /quickbooks/customers` - Update customer (requires Id in payload)
- `DELETE /quickbooks/customers/{customerId}` - Delete customer
- `GET /quickbooks/customers/search?name={name}&email={email}` - Search customers

**Invoices:**
- `GET /quickbooks/invoices` - List invoices (supports `customer_id`, `max_results`)
- `GET /quickbooks/invoices/{invoiceId}` - Get invoice by ID
- `POST /quickbooks/invoices` - Create invoice
- `PUT /quickbooks/invoices` - Update invoice (requires Id in payload)
- `DELETE /quickbooks/invoices/{invoiceId}` - Delete invoice
- `POST /quickbooks/send-invoice/{invoiceId}` - Send invoice via email

**Items/Services:**
- `GET /quickbooks/items` - List items/services

**Query:**
- `POST /quickbooks/query` - Execute custom SQL-like query

### 2. Authentication Implementation

**HMAC-SHA256 Signature Generation:** `src/api/quickbooksApi.js:31-60`

```javascript
const generateAuthHeader = async (payload = '') => {
  const secretKey = import.meta.env.VITE_SECRET_KEY;
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${timestamp}.${payload}`;

  // Web Crypto API for HMAC-SHA256
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return `Bearer ${signatureHex}.${timestamp}`;
};
```

**Request Headers:**
- `Authorization: Bearer {signature}.{timestamp}`
- `X-Organization-ID: {organizationId}` (from `VITE_CLARITY_INTEGRATION_ORG_ID`)
- `Content-Type: application/json`

**Payload for Signature:**
- GET requests: Empty string `""`
- POST/PUT requests: Exact JSON string sent in body (must match exactly)

### 3. Error Handling

**Error Response Format:** (Line 124-162)
```javascript
{
  status: 401,                           // HTTP status code
  statusText: "Unauthorized",            // Status text
  message: "Invalid signature",          // Extracted error message
  responseData: { /* parsed JSON */ },   // Full error response
  responseText: "raw error text"         // Raw response
}
```

**Error Message Extraction Priority:**
1. `errorData.detail`
2. `errorData.message`
3. `errorData.error`
4. `errorData.error_description`
5. `errorData.errors[0]` (array)
6. Raw error text
7. Default HTTP status message

**Dev Mode Debugging:** (Line 116-119, 144-152, 172-182)
- Console logs all requests: `[QBO] fetch {url} {method} {endpoint}`
- Console logs all errors with full response data
- Includes stack traces

---

## Migration Requirements

### 1. Remove FileMaker Dependencies

**Objective:** Eliminate all FileMaker integration points from QuickBooks invoice generation workflow.

**Required Changes:**

**A. Financial Records Source**
- **Current:** `fetchUnpaidRecords(customerId)` from FileMaker
- **Target:** Query Supabase `customer_sales` table directly
- **New Query:** `SELECT * FROM customer_sales WHERE organization_id = ? AND inv_id IS NULL AND customer_id = ?`

**B. Billed Status Updates**
- **Current:** `updateFinancialRecordBilledStatus(recordId, 1)` in FileMaker
- **Target:** Update `customer_sales.inv_id` field in Supabase
- **New Update:** `UPDATE customer_sales SET inv_id = ?, updated_at = NOW() WHERE id IN (?)`

**C. Record Synchronization**
- **Current:** `financialSyncService.js` reconciles FileMaker → Supabase
- **Target:** Remove synchronization service entirely
- **Impact:** No more dual-write pattern, Supabase is single source

**D. Data Creation**
- **Current:** Records created in FileMaker when timers stop
- **Target:** Records created directly in Supabase `customer_sales`
- **Requires:** Timer integration updates (see Timer Integration section)

### 2. Supabase-Only Invoice Generation

**New Workflow:**
```
1. Query Supabase customer_sales for unbilled records (inv_id IS NULL)
2. Fetch/create QuickBooks customer
3. Generate invoice payload from customer_sales records
4. Create invoice in QuickBooks
5. Update customer_sales.inv_id with QuickBooks invoice ID
6. Optionally send invoice email
```

**Required Service Changes:**

**A. Create useCustomerSales Hook** (NEW)
```javascript
// src/hooks/useCustomerSales.js
export const useCustomerSales = () => {
  // Fetch unbilled records for customer
  const fetchUnbilledRecords = async (customerId, organizationId) => {
    return await query('customer_sales', {
      select: '*',
      filters: [
        { type: 'eq', column: 'organization_id', value: organizationId },
        { type: 'eq', column: 'customer_id', value: customerId },
        { type: 'is', column: 'inv_id', value: null }
      ],
      order: { column: 'date', ascending: true }
    });
  };

  // Fetch records by date range
  const fetchRecordsByDateRange = async (organizationId, startDate, endDate) => {
    return await query('customer_sales', {
      select: '*, customers(business_name)',
      filters: [
        { type: 'eq', column: 'organization_id', value: organizationId },
        { type: 'gte', column: 'date', value: startDate },
        { type: 'lte', column: 'date', value: endDate }
      ],
      order: { column: 'date', ascending: true }
    });
  };

  // Mark records as billed
  const markAsBilled = async (recordIds, invoiceId) => {
    return await update('customer_sales',
      { inv_id: invoiceId },
      { id: { in: recordIds } }
    );
  };

  return { fetchUnbilledRecords, fetchRecordsByDateRange, markAsBilled };
};
```

**B. Update invoiceGenerationService.js**
- Remove FileMaker data format assumptions
- Expect Supabase `customer_sales` schema directly
- No transformation needed (data already in correct format)

**C. Update QBO UI Components**
- Replace `fetchUnpaidRecords()` calls with `useCustomerSales.fetchUnbilledRecords()`
- Replace `bulkUpdateFinancialRecordsBilledStatus()` with `useCustomerSales.markAsBilled()`
- Remove FileMaker bridge references

### 3. Timer Integration Migration

**Current Timer Flow:**
```
Timer Stop → FileMaker Script → devRecords CREATE → Sync to Supabase
```

**Target Timer Flow:**
```
Timer Stop → Direct Supabase INSERT → customer_sales table
```

**Required Changes:**

**A. Timer Stop Handler**
- **Current:** Calls FileMaker script via fm-gofer bridge
- **Target:** Calls Supabase insert directly

**B. Data Collection**
```javascript
// When timer stops, collect:
{
  customer_id: selectedCustomer.id,      // Supabase customer UUID
  organization_id: currentOrg.id,        // Supabase org UUID
  product_name: formatProductName(customer, project),
  quantity: elapsedHours,                // Decimal hours
  unit_price: project.billingRate || customer.defaultRate,
  total_price: quantity * unit_price,
  date: new Date().toISOString().split('T')[0],  // YYYY-MM-DD
  inv_id: null                           // Unbilled initially
}
```

**C. Insert to Supabase**
```javascript
const result = await insert('customer_sales', recordData);
```

**D. Remove FileMaker Timer Integration**
- Identify timer components/services using FileMaker bridge
- Replace with direct Supabase calls
- Remove fm-gofer timer-related code

### 4. Deprecate Financial Sync Service

**Files to Remove/Archive:**
- `src/services/financialSyncService.js` - Entire file (695 lines)
- `src/services/syncTrackingService.js` - localStorage sync tracking
- `src/hooks/useFinancialSync.js` - React hook for sync operations
- `src/components/financial/FinancialSyncPanel.jsx` - UI for sync
- `scripts/sync-missing-records.js` - Utility script

**Files to Update:**
- `src/api/financialRecords.js` - Remove or mark as deprecated
- `src/services/billableHoursService.js` - Remove FileMaker data transformation
- `src/services/dualWriteService.js` - Remove financial records dual-write logic

**Database Changes:**
- `customer_sales.financial_id` field becomes optional (no longer links to FileMaker)
- Keep field for historical data, but new records won't populate it

### 5. Backend Requirements

**No Backend Changes Required** - QuickBooks integration is already backend-ready:
- Backend API endpoints already exist at `/quickbooks/*`
- Authentication (HMAC-SHA256) already implemented
- Frontend already uses backend API (not edge functions)
- Supabase `customer_sales` table already exists and is used

**Optional Backend Enhancements:**
- Add endpoint: `GET /quickbooks/unbilled-records/{customerId}` - Fetch unbilled customer_sales
- Add endpoint: `POST /quickbooks/generate-invoice` - Generate invoice from customer_sales IDs
- Add endpoint: `PUT /quickbooks/mark-billed` - Bulk update inv_id for records

---

## Acceptance Criteria

### 1. FileMaker Independence

- [ ] Invoice generation does not query FileMaker at any point
- [ ] Invoice generation fetches data exclusively from Supabase `customer_sales`
- [ ] No calls to `src/api/financialRecords.js` FileMaker functions
- [ ] No usage of `financialSyncService.js`
- [ ] Timer stop creates records directly in Supabase (not FileMaker)

### 2. Functional Equivalence

- [ ] Can fetch unbilled records from Supabase for a customer
- [ ] Can generate invoice payload from Supabase records (same format as before)
- [ ] Can create invoice in QuickBooks with correct:
  - Document number (format: `{qboId}{YY}{MM}{NNN}`)
  - Tax codes (3 for non-CAD, 4 for CAD)
  - Due dates (Net 30 EOM)
  - Line items (grouped by product_name and unit_price)
  - Currency-specific items (CAD/USD/EUR)
- [ ] Can mark records as billed by updating `inv_id` in Supabase
- [ ] Can send invoice email via QuickBooks

### 3. Data Integrity

- [ ] All existing `customer_sales` records preserved during migration
- [ ] Historical `financial_id` values retained (for audit trail)
- [ ] New records created without `financial_id` (optional field)
- [ ] Invoice amounts match sales record totals (rounded to 2 decimals)
- [ ] Customer associations maintained (Supabase customer_id)
- [ ] Organization isolation enforced (RLS policies)

### 4. UI/UX Consistency

- [ ] QuickBooks integration UI works identically to before
- [ ] Users can select unbilled records and generate invoices
- [ ] Error messages are clear and actionable
- [ ] Loading states shown during API calls
- [ ] Success confirmations displayed after invoice creation
- [ ] Invoice preview shows correct data before submission

### 5. Code Quality

- [ ] No FileMaker imports in QuickBooks-related files
- [ ] No references to `fm-gofer` bridge in invoice flow
- [ ] Deprecated files marked with clear deprecation notices
- [ ] New Supabase hooks follow established patterns
- [ ] Error handling consistent with project standards
- [ ] Console logs removed or gated by dev mode

---

## Test Plan

### 1. Unit Tests (Manual Verification)

**Test: Fetch Unbilled Records from Supabase**
- Query `customer_sales` WHERE `inv_id IS NULL` AND `customer_id = {testCustomer}`
- Verify records returned match expected schema
- Verify organization_id filtering works
- Verify date ordering (ascending)

**Test: Generate Invoice Payload**
- Input: Array of customer_sales records + QBO customer object
- Expected Output: Valid QuickBooks invoice payload
- Verify: DocNumber format, tax codes, due date, line items

**Test: Mark Records as Billed**
- Update `customer_sales` SET `inv_id = {testInvoiceId}` WHERE `id IN ({recordIds})`
- Verify records updated correctly
- Verify updated_at timestamp changed

### 2. Integration Tests (Manual Verification)

**Test: Complete Invoice Generation Flow**
```
1. Query unbilled records for test customer
2. Verify records fetched from Supabase (not FileMaker)
3. Generate invoice payload
4. Create invoice in QuickBooks Sandbox
5. Verify invoice created with correct data
6. Update records with QuickBooks invoice ID
7. Verify records marked as billed (inv_id populated)
```

**Expected Result:** Invoice created successfully, records marked as billed

**Test: Invoice Email Delivery**
```
1. Create test invoice
2. Send invoice email via QuickBooks
3. Verify email sent (check QuickBooks UI)
```

**Expected Result:** Email delivered to customer

**Test: Multiple Invoices for Same Customer**
```
1. Create invoice for customer in month 1
2. Create invoice for same customer in month 1 again
3. Verify document numbers increment (001, 002)
```

**Expected Result:** Document numbers sequential within month

### 3. Data Migration Verification

**Test: Historical Data Integrity**
```sql
-- Verify all historical records retained
SELECT COUNT(*) FROM customer_sales
WHERE financial_id IS NOT NULL;

-- Expected: Same count as before migration

-- Verify no data loss
SELECT COUNT(*) FROM customer_sales
WHERE financial_id IS NULL AND created_at < '{migration_date}';

-- Expected: 0 (no historical records missing financial_id)
```

**Test: New Records Without FileMaker ID**
```sql
-- Create new record via timer stop
-- Verify record created with NULL financial_id
SELECT * FROM customer_sales
WHERE financial_id IS NULL AND created_at > '{migration_date}';

-- Expected: New records present, financial_id = NULL
```

### 4. Edge Cases

**Test: Zero-Dollar Invoice**
- Create invoice with records totaling $0.00
- Verify QuickBooks accepts invoice
- Expected: Invoice created or appropriate error

**Test: Multi-Currency Invoice**
- Create invoice with CAD customer records
- Verify tax code = 4, item = "Development CAD" (ID: 3)
- Create invoice with USD customer records
- Verify tax code = 3, item = "Development USD" (ID: 7)

**Test: Duplicate Invoice Prevention**
- Attempt to create invoice with already-billed records (inv_id populated)
- Expected: Records filtered out or error shown

**Test: Missing QuickBooks Customer**
- Generate invoice for customer not in QuickBooks
- Verify customer created automatically
- Verify invoice uses newly created customer ID

### 5. Performance Tests

**Test: Bulk Invoice Generation**
- Select 50+ unbilled records
- Generate invoice
- Verify performance acceptable (<5 seconds)

**Test: Date Range Query Performance**
- Query customer_sales for 1-year date range
- Verify query completes in <2 seconds
- Verify index usage (explain plan)

### 6. Error Handling Tests

**Test: QuickBooks API Failure**
- Simulate QuickBooks API error (invalid credentials)
- Verify error message displayed to user
- Verify records NOT marked as billed

**Test: Supabase Query Failure**
- Simulate Supabase connection error
- Verify error message displayed
- Verify graceful degradation

**Test: Invalid Invoice Data**
- Attempt to create invoice with missing required fields
- Expected: Validation error with clear message

---

## Code References

### 1. QuickBooks Integration Files

**API Layer:**
- `src/api/quickbooksApi.js` - QuickBooks API client (610 lines)
- `src/api/quickbooksEdgeFunction.js` - Deprecated edge function client (14 lines)

**Services:**
- `src/services/invoiceGenerationService.js` - Invoice payload generation (384 lines)

**Components:**
- `src/components/financial/QboTestPanel.jsx` - QuickBooks testing UI
- `src/components/financial/CreateQBOCustomerModal.jsx` - Customer creation modal

### 2. FileMaker Integration Files (TO BE DEPRECATED)

**API Layer:**
- `src/api/financialRecords.js` - FileMaker financial records API (497 lines)
- `src/api/fileMaker.js` - FileMaker bridge utilities

**Services:**
- `src/services/financialSyncService.js` - FileMaker ↔ Supabase sync (695 lines)
- `src/services/billableHoursService.js` - FileMaker data processing
- `src/services/syncTrackingService.js` - Sync state in localStorage
- `src/services/dualWriteService.js` - Dual-write pattern utilities

**Hooks:**
- `src/hooks/useFinancialSync.js` - React hook for sync operations

**Components:**
- `src/components/financial/FinancialSyncPanel.jsx` - Sync UI
- `src/components/financial/CustomerSalesTable.jsx` - Display financial records

**Scripts:**
- `scripts/sync-missing-records.js` - Utility for manual sync

### 3. Supabase Integration Files

**Services:**
- `src/services/supabaseService.js` - Supabase client singleton
- `src/services/salesService.js` - Customer sales operations

**Hooks (TO BE CREATED):**
- `src/hooks/useCustomerSales.js` - NEW: Customer sales operations

### 4. Configuration

**Environment Variables:**
```
# QuickBooks
VITE_QB_CLIENT_ID=<QuickBooks OAuth client ID>
VITE_QB_CLIENT_SECRET=<QuickBooks OAuth secret>

# Backend API
VITE_API_URL=https://api.claritybusinesssolutions.ca
VITE_SECRET_KEY=<HMAC signing secret>
VITE_CLARITY_INTEGRATION_ORG_ID=<Organization UUID>

# Supabase
VITE_SUPABASE_URL=https://supabase.claritybusinesssolutions.ca
VITE_SUPABASE_ANON_KEY=<Public anon key>
VITE_SUPABASE_SERVICE_ROLE_KEY=<Service role key>
```

### 5. Database Schema

**Supabase Tables:**
- `customer_sales` - Financial records (source for invoices)
- `customers` - Customer master data
- `customer_organization` - Customer-organization links
- `organizations` - Organization master data

**FileMaker Layouts (TO BE REMOVED FROM INVOICE FLOW):**
- `devRecords` - Financial records layout
- `devCustomers` - Customer layout

---

## Next Steps

### 1. Planning Phase
- [ ] Review this requirements document
- [ ] Identify additional edge cases
- [ ] Validate Supabase schema completeness
- [ ] Confirm backend API is production-ready

### 2. Implementation Phase (REQUIRES BACKEND TEAM APPROVAL)
- [ ] Create `useCustomerSales` hook
- [ ] Update invoice generation to use Supabase exclusively
- [ ] Update timer integration to write to Supabase
- [ ] Update UI components to remove FileMaker calls
- [ ] Add deprecation notices to FileMaker files

### 3. Testing Phase
- [ ] Execute test plan against Supabase data
- [ ] Verify invoice generation in QuickBooks Sandbox
- [ ] Validate data integrity
- [ ] Performance testing on large datasets

### 4. Deployment Phase
- [ ] Deploy Supabase schema changes (if any)
- [ ] Deploy frontend code changes
- [ ] Monitor for errors in production
- [ ] Communicate changes to users

### 5. Cleanup Phase
- [ ] Archive FileMaker sync service files
- [ ] Remove FileMaker API calls
- [ ] Update documentation
- [ ] Remove deprecated environment variables

---

## Related Documentation

- `requirements/financial-records/README.md` - Financial records migration overview
- `requirements/financial-records/BACKEND_CHANGE_REQUEST_001_FINANCIAL_RECORDS_MIGRATION.md` - Backend schema changes
- `BACKEND_INTEGRATION_GUIDE.md` - Backend API integration patterns
- `CLAUDE.md` - Project overview and backend change protocol
- `docs/reference/QUICKBOOKS_ENDPOINTS_REFERENCE.md` - QuickBooks API reference examples

---

**Document Version:** 1.0.0
**Last Updated:** 2026-01-10
**Author:** AI Assistant (Claude)
**Status:** Draft - Awaiting Review
