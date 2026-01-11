# QuickBooks Integration Documentation

## Overview

This document describes how billable time from task timers flows to QuickBooks Online (QBO) invoice generation and what the timer migration to Supabase means for QuickBooks integration.

**Last Updated:** 2026-01-10
**Status:** Active - FileMaker devRecords → Supabase customer_sales → QuickBooks Online

---

## Table of Contents

1. [Data Flow Overview](#data-flow-overview)
2. [Timer to Financial Record Flow](#timer-to-financial-record-flow)
3. [Customer Sales to QuickBooks Flow](#customer-sales-to-quickbooks-flow)
4. [Invoice Generation Service](#invoice-generation-service)
5. [QuickBooks API Integration](#quickbooks-api-integration)
6. [Migration Impact on QB Integration](#migration-impact-on-qb-integration)
7. [Error Handling and Retry Logic](#error-handling-and-retry-logic)
8. [Testing and Verification](#testing-and-verification)

---

## Data Flow Overview

### High-Level Architecture

```
┌─────────────────┐
│   Task Timer    │
│  (TaskTimer.jsx)│
└────────┬────────┘
         │
         │ Stop Timer
         ▼
┌─────────────────────────┐
│  taskService.stopTimer()│
│  (taskService.js:67-131)│
└────────┬────────────────┘
         │
         │ Create Financial Record
         ▼
┌──────────────────────────────────┐
│     FileMaker devRecords         │
│   (Source of Truth for Time)     │
│  Fields: TimeStart, TimeEnd,     │
│  TimeAdjust, _taskID, _staffID   │
└────────┬─────────────────────────┘
         │
         │ Dual-Write (if not fixed-price)
         ▼
┌──────────────────────────────────┐
│   Supabase customer_sales        │
│   (Derived Dataset for Billing)  │
│  Fields: quantity, unit_price,   │
│  total_price, customer_id        │
└────────┬─────────────────────────┘
         │
         │ Manual Invoice Generation
         ▼
┌──────────────────────────────────┐
│  CustomerSalesTable Component    │
│  (CustomerSalesTable.jsx)        │
│  User clicks "QBO Invoice" btn   │
└────────┬─────────────────────────┘
         │
         │ Generate Invoice Payload
         ▼
┌──────────────────────────────────┐
│  invoiceGenerationService.js     │
│  generateInvoicePayload()        │
│  Business Rules: DocNumber,      │
│  Tax Codes, Due Date (Net 30)    │
└────────┬─────────────────────────┘
         │
         │ Create QBO Invoice
         ▼
┌──────────────────────────────────┐
│    QuickBooks Online API         │
│    POST /quickbooks/invoices     │
│    (via quickbooksApi.js)        │
└────────┬─────────────────────────┘
         │
         │ Update Invoice Status
         ▼
┌──────────────────────────────────┐
│  Update customer_sales.inv_id    │
│  Update devRecords.f_billed = 1  │
│  (Supabase + FileMaker sync)     │
└──────────────────────────────────┘
```

### Key Components

| Component | File Path | Responsibility |
|-----------|-----------|----------------|
| **TaskTimer** | `src/components/tasks/TaskTimer.jsx` | UI for timer start/stop/pause |
| **taskService** | `src/services/taskService.js` | Timer stop logic, financial record creation |
| **salesService** | `src/services/salesService.js` | Create customer_sales from devRecords |
| **invoiceGenerationService** | `src/services/invoiceGenerationService.js` | Generate QBO invoice payloads |
| **quickbooksApi** | `src/api/quickbooksApi.js` | QBO API client with HMAC auth |
| **CustomerSalesTable** | `src/components/financial/CustomerSalesTable.jsx` | UI for invoice generation |
| **financialSyncService** | `src/services/financialSyncService.js` | Reconcile devRecords with customer_sales |

---

## Timer to Financial Record Flow

### 1. Timer Stop Triggers Financial Record Creation

**Code Reference:** `src/services/taskService.js:67-131`

When a user stops a timer via the TaskTimer component, the following sequence occurs:

#### Step 1: Stop Timer API Call

```javascript
// src/services/taskService.js:67-131
export const stopTimer = async (task, notes = '') => {
  const timerState = getTimerState(task.id);

  // Calculate billable time
  const endTime = new Date();
  const elapsedSeconds = Math.floor((endTime - timerState.startTime) / 1000);
  const totalPauseSeconds = timerState.totalPauseTime || 0;
  const adjustmentSeconds = (timerState.adjustment || 0) * 60;
  const billableSeconds = elapsedSeconds - totalPauseSeconds + adjustmentSeconds;

  // Create FileMaker time entry record (devRecords)
  const result = await stopTaskTimer(
    task.id,
    timerState.recordId,
    formatTime(endTime),
    adjustmentSeconds,
    notes
  );

  // Check if project is fixed-price
  const project = await fetchProject(task.projectId);
  const isFixedPrice = project?.f_fixedPrice > 0;

  // If NOT fixed-price, create sales record
  if (!isFixedPrice && result.success) {
    await createSaleFromFinancialRecord(result.data);
  }

  clearTimerState(task.id);
  return result;
};
```

**Key Business Logic:**

1. **Billable Time Calculation:**
   - `Billable Time = Elapsed Time - Total Pause Time + Manual Adjustment`
   - Adjustments are in 6-minute (360-second) increments
   - Formula: `billableSeconds = elapsedSeconds - totalPauseSeconds + adjustmentSeconds`

2. **Fixed-Price Project Detection:**
   - `taskService.js:104-111` - Checks `customers_Projects::f_fixedPrice`
   - If `f_fixedPrice > 0`, **skips** `customer_sales` creation
   - Timer record is still created in FileMaker for tracking
   - Revenue recognition happens at project milestones (50% start, 50% completion)

3. **FileMaker Record Creation:**
   - Layout: `devRecords`
   - Fields populated:
     - `TimeStart`: HH:MM:SS format
     - `TimeEnd`: HH:MM:SS format
     - `DateStart`: MM/DD/YYYY format
     - `TimeAdjust`: Adjustment in seconds
     - `Work Performed`: Notes from stop dialog
     - `_taskID`: Foreign key to task
     - `_staffID`: Foreign key to staff
     - `_projectID`: Foreign key to project
     - `_custID`: Foreign key to customer

**Code Reference:** `src/api/tasks.js:121-213`

#### Step 2: Create Sales Record (if not fixed-price)

**Code Reference:** `src/services/salesService.js:1-100`

```javascript
// src/services/salesService.js
export const createSaleFromFinancialRecord = async (financialRecord) => {
  // 1. Extract data from devRecords
  const billableHours = financialRecord.Billable_Time_Rounded / 3600; // Convert seconds to hours
  const hourlyRate = financialRecord.Hourly_Rate;
  const totalAmount = billableHours * hourlyRate;

  // 2. Format product name: "CUSTOMERCAPS:ProjectFirstWord"
  const productName = formatProductName(
    financialRecord.customerName,
    financialRecord.projectName
  );

  // 3. Get or create customer in Supabase
  const customerId = await getOrCreateCustomerId(
    financialRecord.customerName,
    organizationId
  );

  // 4. Insert into Supabase customer_sales
  const saleData = {
    financial_id: financialRecord.__ID,        // FileMaker UUID
    customer_id: customerId,                   // Supabase customer UUID
    organization_id: organizationId,
    product_name: productName,                 // "CBS:Website"
    quantity: billableHours,                   // 2.5 hours
    unit_price: hourlyRate,                    // $150.00/hr
    total_price: totalAmount,                  // $375.00
    date: formatDate(financialRecord.DateStart), // YYYY-MM-DD
    inv_id: null                               // Set when invoiced
  };

  return await insert('customer_sales', saleData);
};
```

**Product Name Formatting Logic:**

```javascript
// src/services/financialSyncService.js:628-640
function formatProductName(customerName, projectName) {
  // Extract capital letters and numbers from customer name
  const customerNameFormatted = (customerName || '')
    .replace(/[^A-Z0-9]/g, '')  // Keep only capital letters and numbers
    .trim();

  // Get the first word of the project name
  const projectNameFirstWord = projectName ?
    projectName.split(' ')[0] : '';

  // Concatenate with a colon
  return `${customerNameFormatted}:${projectNameFirstWord}`;
}
```

**Examples:**
- Customer: "Clarity Business Solutions" → "CBS"
- Project: "Website Redesign Phase 2" → "Website"
- Product Name: **"CBS:Website"**

---

## Customer Sales to QuickBooks Flow

### Overview

The flow from `customer_sales` table to QuickBooks invoices is **manual and user-initiated** through the Financial Activity UI. This is NOT automatic when timers stop.

### 1. User Interface Entry Point

**Code Reference:** `src/components/financial/CustomerSalesTable.jsx:270-340`

Users navigate to:
1. **Sidebar → Financial Activity** (or click customer financial icon)
2. Select timeframe (Today, This Week, This Month, etc.)
3. View `customer_sales` records grouped by customer and product
4. Click **"QBO Invoice"** button for a customer

### 2. Invoice Generation Workflow

```
User clicks "QBO Invoice" button
         ↓
┌─────────────────────────────────────────┐
│ 1. Find QBO Customer                    │
│    searchQBOCustomers(customerName)     │
│    - Search by business_name            │
│    - Active customers only              │
│    - Max 20 results                     │
└────────┬────────────────────────────────┘
         │
         ├─ Not Found → Show Create Customer Modal
         │
         ├─ 1 Match → Use that customer
         │
         └─ Multiple → User selects from list
         ↓
┌─────────────────────────────────────────┐
│ 2. Filter Uninvoiced Records            │
│    records.filter(r => r.inv_id === null)│
└────────┬────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 3. Validate Invoice Data                │
│    validateInvoiceData(records, customer)│
│    - Check required fields              │
│    - Validate amounts                   │
└────────┬────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 4. Generate Invoice Payload             │
│    generateInvoicePayload()             │
│    - DocNumber: {qboID}{YY}{MM}{NNN}    │
│    - Tax Code: 4 (CAD) or 3 (non-CAD)   │
│    - Due Date: Net 30 EOM               │
│    - Line Items: Grouped by product     │
└────────┬────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 5. Create QBO Invoice                   │
│    createQBOInvoice(payload)            │
│    POST /quickbooks/invoices            │
└────────┬────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 6. Update Invoice Status                │
│    - Update customer_sales.inv_id       │
│    - Update devRecords.f_billed = 1     │
└────────┬────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 7. Send Invoice Email (Optional)        │
│    sendQBOInvoiceEmail(invoiceId)       │
│    POST /quickbooks/send-invoice/{id}   │
└─────────────────────────────────────────┘
```

---

## Invoice Generation Service

### Business Rules

**Code Reference:** `src/services/invoiceGenerationService.js`

The `invoiceGenerationService` implements sophisticated business logic for QuickBooks invoice generation:

#### 1. Document Number Generation

**Format:** `{qboCustomerId}{YY}{MM}{NNN}`

```javascript
// src/services/invoiceGenerationService.js:92-110
const generateDocumentNumber = async (qboCustomerId, salesRecords) => {
  // Get the latest date from sales records
  const latestDate = getLatestDate(salesRecords);
  const year = latestDate.getFullYear().toString().slice(-2); // Last 2 digits
  const month = (latestDate.getMonth() + 1).toString().padStart(2, '0');

  // Query existing invoices for this customer and month
  const invoiceNumber = await getNextInvoiceSequence(qboCustomerId, latestDate);

  return `${qboCustomerId}${year}${month}${invoiceNumber}`;
};
```

**Example:**
- QBO Customer ID: `12`
- Year: `2026` → `26`
- Month: `January` → `01`
- Invoice count this month: `3` → `003`
- **DocNumber: `122601003`**

#### 2. Tax Code Determination

**Code Reference:** `src/services/invoiceGenerationService.js:206-209`

```javascript
const getTaxCodeForCurrency = (currency) => {
  // Business rule: taxCodeRef 3 for non-CAD, taxCodeRef 4 for CAD
  return currency === 'CAD' ? 4 : 3;
};
```

**Tax Codes:**
- **CAD (Canadian Dollar):** Tax Code `4` (includes HST/GST)
- **USD (US Dollar):** Tax Code `3` (tax exempt)
- **EUR (Euro):** Tax Code `3` (tax exempt)

#### 3. Due Date Calculation (Net 30 EOM)

**Code Reference:** `src/services/invoiceGenerationService.js:169-189`

**Business Rule:** Net 30 means 30 days from invoice date, then end of that month.

```javascript
const calculateDueDate = (salesRecords) => {
  // Net 30 means 30 days from today (invoice date)
  const today = new Date();
  const thirtyDaysFromNow = new Date(today);
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  // Get the end of the month for the date that is 30 days from now
  const dueDate = new Date(
    thirtyDaysFromNow.getFullYear(),
    thirtyDaysFromNow.getMonth() + 1,
    0
  );

  return dueDate.toISOString().split('T')[0]; // YYYY-MM-DD
};
```

**Example:**
- Invoice Date: January 10, 2026
- 30 days later: February 9, 2026
- End of that month: **February 28, 2026**

#### 4. Line Item Grouping

**Code Reference:** `src/services/invoiceGenerationService.js:249-306`

Sales records are grouped by **product name** and **unit price** to consolidate line items:

```javascript
const generateLineItems = (salesRecords, itemRef, taxCodeRef) => {
  // Group records by description and unit price
  const groupedRecords = new Map();

  salesRecords.forEach(record => {
    const description = record.product_name || 'Development';
    const unitPrice = Number(record.unit_price) || 0;
    const key = `${description}|${unitPrice}`;

    if (groupedRecords.has(key)) {
      const existing = groupedRecords.get(key);
      existing.totalQuantity += Number(record.quantity);
      existing.totalAmount += Number(record.total_price);
    } else {
      groupedRecords.set(key, {
        description,
        unitPrice,
        totalQuantity: Number(record.quantity),
        totalAmount: Number(record.total_price)
      });
    }
  });

  // Convert to QBO line items
  return Array.from(groupedRecords.values()).map((group, index) => ({
    Amount: Math.round(group.totalAmount * 100) / 100,
    Description: group.description,
    DetailType: 'SalesItemLineDetail',
    LineNum: index + 1,
    SalesItemLineDetail: {
      ItemRef: itemRef,
      Qty: Math.round(group.totalQuantity * 100) / 100,
      TaxCodeRef: { value: taxCodeRef },
      UnitPrice: Math.round(group.unitPrice * 100) / 100
    }
  }));
};
```

**Example Grouping:**

Input `customer_sales` records:
```
1. CBS:Website | 2.5 hrs × $150/hr = $375
2. CBS:Website | 3.0 hrs × $150/hr = $450
3. CBS:Database | 1.5 hrs × $200/hr = $300
```

Grouped line items:
```
Line 1: CBS:Website | 5.5 hrs × $150/hr = $825
Line 2: CBS:Database | 1.5 hrs × $200/hr = $300
```

#### 5. Item Reference Mapping

**Code Reference:** `src/services/invoiceGenerationService.js:216-225`

```javascript
const getItemRefForCurrency = (currency) => {
  const itemMapping = {
    CAD: { name: 'Development CAD', value: '3' },
    USD: { name: 'Development USD', value: '7' },
    EUR: { name: 'Development EUR', value: '8' }
  };

  return itemMapping[currency] || itemMapping.CAD;
};
```

**QuickBooks Items:**
- **Development CAD** (ID: 3) - For Canadian customers
- **Development USD** (ID: 7) - For US customers
- **Development EUR** (ID: 8) - For European customers

### Complete Invoice Payload Example

```json
{
  "BillEmail": {
    "Address": "contact@customer.com"
  },
  "CurrencyRef": {
    "name": "Canadian Dollar",
    "value": "CAD"
  },
  "CustomerRef": {
    "name": "Clarity Business Solutions",
    "value": "12"
  },
  "DeliveryInfo": {
    "DeliveryType": "Email"
  },
  "DocNumber": "122601003",
  "DueDate": "2026-02-28",
  "GlobalTaxCalculation": "TaxExcluded",
  "Line": [
    {
      "Amount": 825.00,
      "Description": "CBS:Website",
      "DetailType": "SalesItemLineDetail",
      "LineNum": 1,
      "SalesItemLineDetail": {
        "ItemRef": {
          "name": "Development CAD",
          "value": "3"
        },
        "Qty": 5.5,
        "TaxCodeRef": {
          "value": 4
        },
        "UnitPrice": 150.00
      }
    },
    {
      "Amount": 300.00,
      "Description": "CBS:Database",
      "DetailType": "SalesItemLineDetail",
      "LineNum": 2,
      "SalesItemLineDetail": {
        "ItemRef": {
          "name": "Development CAD",
          "value": "3"
        },
        "Qty": 1.5,
        "TaxCodeRef": {
          "value": 4
        },
        "UnitPrice": 200.00
      }
    }
  ]
}
```

---

## QuickBooks API Integration

### API Architecture

**Code Reference:** `src/api/quickbooksApi.js`

The QuickBooks API client uses HMAC-SHA256 authentication to communicate with the Clarity backend API, which proxies requests to QuickBooks Online.

#### Authentication Flow

```javascript
// src/api/quickbooksApi.js:31-60
const generateAuthHeader = async (payload = '') => {
  const secretKey = import.meta.env.VITE_SECRET_KEY;
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${timestamp}.${payload}`;

  // HMAC-SHA256 signature
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return `Bearer ${signatureHex}.${timestamp}`;
};
```

#### Request Headers

All QuickBooks API requests include:

```javascript
{
  'Authorization': 'Bearer {hmac_signature}.{timestamp}',
  'X-Organization-ID': import.meta.env.VITE_CLARITY_INTEGRATION_ORG_ID,
  'Content-Type': 'application/json'
}
```

### Key API Endpoints

#### 1. Search Customers

**Code Reference:** `src/api/quickbooksApi.js:302-312`

```javascript
export const searchQBOCustomers = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const endpoint = queryString ? `/customers/search?${queryString}` : '/customers/search';
  return await makeRequest(endpoint);
};
```

**Usage:**
```javascript
const result = await searchQBOCustomers({
  name: "Clarity Business Solutions",
  active_only: true,
  max_results: 20
});
```

**Response:**
```json
{
  "customers": [
    {
      "Id": "12",
      "DisplayName": "Clarity Business Solutions",
      "PrimaryEmailAddr": {
        "Address": "contact@clarity.com"
      },
      "CurrencyRef": {
        "value": "CAD",
        "name": "Canadian Dollar"
      },
      "Active": true
    }
  ]
}
```

#### 2. Create Invoice

**Code Reference:** `src/api/quickbooksApi.js:343-345`

```javascript
export const createQBOInvoice = async (invoiceData) => {
  return await makeRequest('/invoices', 'POST', invoiceData);
};
```

**Backend Endpoint:** `POST https://api.claritybusinesssolutions.ca/quickbooks/invoices`

**Response:**
```json
{
  "invoice": {
    "Id": "1234",
    "DocNumber": "122601003",
    "TxnDate": "2026-01-10",
    "DueDate": "2026-02-28",
    "TotalAmt": 1125.00,
    "Balance": 1125.00,
    "EmailStatus": "NotSet",
    "CustomerRef": {
      "value": "12",
      "name": "Clarity Business Solutions"
    }
  }
}
```

#### 3. Send Invoice Email

**Code Reference:** `src/api/quickbooksApi.js:548-554`

```javascript
export const sendQBOInvoiceEmail = async (invoiceId, sendToEmail = null) => {
  let endpoint = `/send-invoice/${invoiceId}`;
  if (sendToEmail) {
    endpoint += `?sendTo=${encodeURIComponent(sendToEmail)}`;
  }
  return await makeRequest(endpoint, 'POST');
};
```

**Backend Endpoint:** `POST https://api.claritybusinesssolutions.ca/quickbooks/send-invoice/{invoiceId}`

### API Error Handling

**Code Reference:** `src/api/quickbooksApi.js:124-163`

The API client includes comprehensive error handling:

```javascript
if (!response.ok) {
  const errorText = await response.text();
  let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

  try {
    const errorData = JSON.parse(errorText);
    errorMessage = errorData.detail ||
                   errorData.message ||
                   errorData.error ||
                   errorText ||
                   errorMessage;
  } catch {
    errorMessage = errorText || errorMessage;
  }

  const error = new Error(errorMessage);
  error.status = response.status;
  error.statusText = response.statusText;
  error.responseData = errorData;
  throw error;
}
```

**Common Error Scenarios:**

| Error Code | Cause | Resolution |
|------------|-------|------------|
| 401 Unauthorized | Invalid/expired HMAC signature | Regenerate auth header with current timestamp |
| 403 Forbidden | Organization ID mismatch | Verify VITE_CLARITY_INTEGRATION_ORG_ID |
| 404 Not Found | Invalid customer/invoice ID | Search for customer first |
| 422 Validation Error | Invalid invoice payload | Validate data before sending |
| 500 Internal Server Error | QBO API failure | Retry with exponential backoff |

---

## Migration Impact on QB Integration

### Current State: FileMaker + Supabase Dual-Write

**Architecture:**
```
Timer Stop
    ↓
FileMaker devRecords (PRIMARY)
    ↓
Supabase customer_sales (SECONDARY)
    ↓
QuickBooks Online Invoices
```

**Characteristics:**
- FileMaker is source of truth for time tracking
- Supabase `customer_sales` is derived/synchronized dataset
- QuickBooks reads from `customer_sales` table
- Manual invoice generation process
- Dual-write coordination via `dualWriteService.js`

### Future State: Supabase-Only with Backend API

**Target Architecture:**
```
Timer Stop
    ↓
Backend API (/api/tasks/{id}/timer/stop)
    ↓
Supabase time_entries (PRIMARY)
    ↓
Supabase customer_sales (DERIVED via trigger/function)
    ↓
QuickBooks Online Invoices
```

### Migration Phases

#### Phase 1: Preparation (Current)

**Status:** ✅ Complete

**Deliverables:**
- [x] Document current QB integration flow
- [x] Map FileMaker devRecords to Supabase time_entries
- [x] Document invoice generation business logic
- [x] Verify customer_sales table schema
- [x] Define backend API contracts

**QB Integration Impact:** None - continues using current flow

#### Phase 2: Backend API Implementation

**Status:** ⏳ Pending Backend Team

**Tasks:**
1. Create `tasks` and `task_timers` tables in Supabase
2. Implement timer API endpoints:
   - `POST /api/tasks/{id}/timer/start`
   - `POST /api/tasks/{id}/timer/stop`
   - `POST /api/tasks/{id}/timer/pause`
   - `POST /api/tasks/{id}/timer/resume`
3. Implement financial record generation on timer stop
4. Create database trigger to populate `customer_sales` from `time_entries`

**QB Integration Impact:** None - dual-write continues

**Code Changes Required:**

```javascript
// BEFORE (current)
// src/services/taskService.js:67-131
const result = await stopTaskTimer(task.id, recordId, endTime, adjustment, notes);
if (!isFixedPrice) {
  await createSaleFromFinancialRecord(result.data);
}

// AFTER (post-migration)
// New backend API call
const result = await stopTimer({
  task_id: task.id,
  end_time: endTime.toISOString(),
  adjustment_seconds: adjustmentSeconds,
  notes: notes
});
// Backend automatically creates time_entry AND customer_sales via trigger
```

#### Phase 3: Dual-Write with Backend API

**Status:** ⏳ Planned

**Tasks:**
1. Frontend calls **both** FileMaker AND backend API
2. Verify data consistency between systems
3. Monitor error rates and performance
4. Build reconciliation tools

**QB Integration Impact:** None - reads from same `customer_sales` table

**Dual-Write Logic:**

```javascript
// Pseudo-code for Phase 3
async function stopTimerDualWrite(task, notes) {
  const results = await Promise.allSettled([
    stopTaskTimerFileMaker(task, notes),   // Legacy
    stopTaskTimerBackend(task, notes)      // New
  ]);

  if (results[0].status === 'rejected' && results[1].status === 'rejected') {
    throw new Error('Both timer stop operations failed');
  }

  // Log inconsistencies for reconciliation
  if (results[0].value?.financial_id !== results[1].value?.time_entry_id) {
    await logInconsistency({
      filemaker_id: results[0].value?.financial_id,
      supabase_id: results[1].value?.time_entry_id,
      task_id: task.id
    });
  }

  return results[1].status === 'fulfilled' ? results[1].value : results[0].value;
}
```

#### Phase 4: Supabase-Only (Read from Backend)

**Status:** ⏳ Planned

**Tasks:**
1. Migrate all historical `devRecords` to `time_entries`
2. Switch frontend to backend API only
3. Disable FileMaker timer operations
4. Monitor QB invoice generation

**QB Integration Impact:** **CRITICAL - Must verify customer_sales trigger**

**Verification Checklist:**
- [ ] Confirm `time_entries` → `customer_sales` trigger works
- [ ] Verify `financial_id` mapping is correct
- [ ] Test fixed-price project logic (no sales record creation)
- [ ] Validate product name formatting matches
- [ ] Confirm hourly rate resolution logic
- [ ] Test invoice generation end-to-end
- [ ] Verify `inv_id` updates propagate correctly

#### Phase 5: Decommission FileMaker Timers

**Status:** ⏳ Future

**Tasks:**
1. Archive FileMaker devRecords table
2. Remove dual-write code
3. Update documentation
4. Final reconciliation report

**QB Integration Impact:** None - fully migrated to Supabase

### Critical Dependencies for QB Integration

The QuickBooks integration depends on the following data being correctly populated in `customer_sales`:

#### 1. customer_sales Schema Requirements

**Table:** `customer_sales`

| Column | Type | Source | Required for QB | Notes |
|--------|------|--------|-----------------|-------|
| `id` | UUID | Auto-generated | No | Supabase primary key |
| `financial_id` | UUID | `time_entries.id` | **YES** | Links to time entry |
| `customer_id` | UUID | `time_entries.customer_id` | **YES** | Maps to QBO customer |
| `organization_id` | UUID | `time_entries.organization_id` | **YES** | Multi-tenant isolation |
| `product_name` | TEXT | Calculated | **YES** | "CBS:Website" format |
| `quantity` | NUMERIC | `billable_hours` | **YES** | Hours (e.g., 2.5) |
| `unit_price` | NUMERIC | `hourly_rate` | **YES** | Rate (e.g., 150.00) |
| `total_price` | NUMERIC | `quantity × unit_price` | **YES** | Amount (e.g., 375.00) |
| `date` | DATE | `time_entries.start_time::date` | **YES** | Invoice grouping |
| `inv_id` | TEXT | NULL → QBO Invoice ID | **YES** | Tracks billing status |
| `created_at` | TIMESTAMPTZ | Auto-generated | No | Audit trail |
| `updated_at` | TIMESTAMPTZ | Auto-generated | No | Audit trail |

#### 2. Product Name Formatting

**Must match current logic:**

```sql
-- PostgreSQL function to match formatProductName()
CREATE OR REPLACE FUNCTION format_product_name(
  customer_name TEXT,
  project_name TEXT
) RETURNS TEXT AS $$
DECLARE
  customer_caps TEXT;
  project_first_word TEXT;
BEGIN
  -- Extract capital letters and numbers from customer name
  customer_caps := regexp_replace(customer_name, '[^A-Z0-9]', '', 'g');

  -- Get first word of project name
  project_first_word := split_part(project_name, ' ', 1);

  -- Concatenate with colon
  RETURN customer_caps || ':' || project_first_word;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

#### 3. Fixed-Price Project Handling

**Critical Business Logic:**

The migration **must** preserve the fixed-price project logic:

```sql
-- Example trigger logic for customer_sales insertion
CREATE OR REPLACE FUNCTION create_customer_sale_from_time_entry()
RETURNS TRIGGER AS $$
DECLARE
  project_fixed_price NUMERIC;
  hourly_rate NUMERIC;
  billable_hours NUMERIC;
  product_name TEXT;
BEGIN
  -- Get project fixed price
  SELECT fixed_price INTO project_fixed_price
  FROM projects
  WHERE id = NEW.project_id;

  -- Skip customer_sales creation if fixed-price project
  IF project_fixed_price > 0 THEN
    RETURN NEW;
  END IF;

  -- Calculate billable hours (in hours, not seconds)
  billable_hours := NEW.billable_hours_seconds / 3600.0;

  -- Get hourly rate (project → staff → organization)
  SELECT COALESCE(
    p.hourly_rate,
    s.hourly_rate,
    o.default_hourly_rate,
    0
  ) INTO hourly_rate
  FROM time_entries te
  LEFT JOIN projects p ON te.project_id = p.id
  LEFT JOIN staff s ON te.staff_id = s.id
  LEFT JOIN organizations o ON te.organization_id = o.id
  WHERE te.id = NEW.id;

  -- Format product name
  SELECT format_product_name(c.business_name, p.name)
  INTO product_name
  FROM customers c
  JOIN projects p ON p.customer_id = c.id
  WHERE p.id = NEW.project_id;

  -- Insert customer_sales record
  INSERT INTO customer_sales (
    financial_id,
    customer_id,
    organization_id,
    product_name,
    quantity,
    unit_price,
    total_price,
    date,
    inv_id
  ) VALUES (
    NEW.id,
    NEW.customer_id,
    NEW.organization_id,
    product_name,
    billable_hours,
    hourly_rate,
    billable_hours * hourly_rate,
    NEW.start_time::date,
    NULL
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_customer_sale_from_time_entry
  AFTER INSERT ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION create_customer_sale_from_time_entry();
```

### Migration Risk Assessment

#### High-Risk Areas for QB Integration

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Product name format mismatch** | Invoices have wrong line item descriptions | Comprehensive testing with real customer data |
| **Fixed-price logic broken** | Incorrect revenue recognition, double billing | Automated tests for fixed-price projects |
| **Hourly rate resolution incorrect** | Wrong amounts on invoices | Validate rate fallback logic (project → staff → org) |
| **customer_sales trigger failure** | Missing line items on invoices | Database-level constraint enforcement |
| **Time zone handling** | Dates off by one day | Use UTC consistently, convert at display layer |
| **Decimal precision loss** | Rounding errors in amounts | Use NUMERIC type, round at final step only |

#### Testing Requirements

**Pre-Migration Testing:**

1. **Unit Tests:**
   - [ ] Product name formatting
   - [ ] Hourly rate resolution
   - [ ] Billable hours calculation
   - [ ] Fixed-price detection

2. **Integration Tests:**
   - [ ] Timer stop → time_entry creation
   - [ ] time_entry → customer_sales trigger
   - [ ] customer_sales → QBO invoice
   - [ ] Invoice email delivery

3. **End-to-End Tests:**
   - [ ] Complete flow: Timer → Invoice → Email
   - [ ] Fixed-price project: Timer only, no sales record
   - [ ] Multiple currencies (CAD, USD, EUR)
   - [ ] Multi-month invoice generation

4. **Data Migration Tests:**
   - [ ] Historical devRecords → time_entries
   - [ ] Reconciliation: FileMaker vs Supabase
   - [ ] No data loss verification
   - [ ] Foreign key integrity

**Post-Migration Monitoring:**

1. **Metrics:**
   - Invoice creation success rate (target: >99%)
   - customer_sales trigger execution time (target: <100ms)
   - QBO API error rate (target: <1%)
   - Email delivery rate (target: >95%)

2. **Alerts:**
   - Missing customer_sales records (time_entry exists but no sale)
   - Fixed-price projects incorrectly creating sales records
   - QBO API failures
   - HMAC authentication failures

3. **Reconciliation:**
   - Daily: Compare FileMaker devRecords count vs Supabase time_entries
   - Weekly: Verify customer_sales totals match expected revenue
   - Monthly: Reconcile QBO invoices with customer_sales inv_id

---

## Error Handling and Retry Logic

### Invoice Creation Error Handling

**Code Reference:** `src/components/financial/CustomerSalesTable.jsx:270-450`

The invoice creation workflow includes comprehensive error handling:

#### Error Serialization

```javascript
// src/components/financial/CustomerSalesTable.jsx:15-74
const serializeError = (error) => {
  if (!error) return 'Unknown error occurred';
  if (typeof error === 'string') return error;

  // Try common error message fields
  const messageFields = [
    'detail',
    'message',
    'error',
    'statusText',
    'data.message',
    'response.data.detail'
  ];

  for (const field of messageFields) {
    const value = field.split('.').reduce((obj, key) => obj?.[key], error);
    if (value && typeof value === 'string') return value.trim();
  }

  // Handle QuickBooks fault format
  if (error.Fault?.Error?.[0]?.Detail) {
    return error.Fault.Error[0].Detail;
  }

  return 'Error occurred but could not be serialized';
};
```

#### Common Error Scenarios

**1. Customer Not Found in QuickBooks**

```javascript
const qboCustomers = await searchQBOCustomers({ name: customerName });

if (qboCustomers.length === 0) {
  console.log(`Customer "${customerName}" not found in QuickBooks`);
  setShowCreateCustomerModal(true);
  return;
}
```

**Resolution:** Show modal to create customer in QBO

**2. Multiple Customer Matches**

```javascript
if (qboCustomers.length > 1) {
  const selectedIndex = prompt(
    `Multiple matching customers found. Select one:\n${customerOptions}`,
    '1'
  );
  selectedQboCustomer = qboCustomers[parseInt(selectedIndex) - 1];
}
```

**Resolution:** User selects correct customer

**3. All Records Already Invoiced**

```javascript
const recordsToInvoice = records.filter(r => r.inv_id === null);

if (recordsToInvoice.length === 0) {
  alert('All records are already invoiced');
  return;
}
```

**Resolution:** No action taken, user informed

**4. Invoice Validation Failure**

```javascript
const validation = validateInvoiceData(recordsToInvoice, selectedQboCustomer);

if (!validation.isValid) {
  alert(`Invoice validation failed:\n${validation.errors.join('\n')}`);
  return;
}
```

**Resolution:** User corrects data issues

**5. QBO API Failure**

```javascript
try {
  const invoiceResult = await createQBOInvoice(invoicePayload);
} catch (error) {
  console.error('Failed to create invoice:', error);
  alert(`Invoice creation failed: ${serializeError(error)}`);
  return;
}
```

**Resolution:** Error displayed to user, operation rolled back

### Retry Logic

**Current Implementation:** No automatic retry for invoice creation

**Recommended Enhancement:**

```javascript
async function createInvoiceWithRetry(payload, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Invoice creation attempt ${attempt}/${maxRetries}`);
      return await createQBOInvoice(payload);
    } catch (error) {
      lastError = error;

      // Don't retry validation errors (4xx)
      if (error.status >= 400 && error.status < 500) {
        throw error;
      }

      // Exponential backoff for 5xx errors
      if (attempt < maxRetries) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`Retrying after ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}
```

### Status Update Rollback

**Current Issue:** If invoice creation succeeds but status update fails, records remain unbilled in the system even though they appear on a QBO invoice.

**Mitigation:**

```javascript
try {
  // 1. Create invoice
  const invoiceResult = await createQBOInvoice(invoicePayload);
  const invoiceId = invoiceResult.invoice.Id;

  // 2. Update customer_sales records
  const updatePromises = recordsToInvoice.map(record =>
    update('customer_sales', { inv_id: invoiceId }, { id: record.id })
  );
  await Promise.all(updatePromises);

  // 3. Update FileMaker billed status
  const fmUpdatePromises = recordsToInvoice.map(record =>
    updateFinancialRecordBilledStatus(record.financial_id, 1)
  );
  await Promise.all(fmUpdatePromises);

} catch (error) {
  console.error('Status update failed after invoice creation:', error);

  // Log for manual reconciliation
  await logManualReconciliationRequired({
    invoiceId,
    recordIds: recordsToInvoice.map(r => r.id),
    error: serializeError(error)
  });

  alert(`Invoice created but status update failed. Invoice ID: ${invoiceId}. Please contact support.`);
}
```

---

## Testing and Verification

### Manual Testing Workflow

#### Test Case 1: Standard Hourly Project Invoice

**Prerequisites:**
- Active project with hourly billing
- Task with completed timer entries
- Customer exists in QuickBooks

**Steps:**
1. Start timer on task
2. Work for 2.5 hours
3. Stop timer, add notes
4. Verify `devRecords` entry created
5. Verify `customer_sales` entry created
6. Navigate to Financial Activity
7. Select customer
8. Click "QBO Invoice" button
9. Verify invoice created in QuickBooks
10. Verify `inv_id` populated in `customer_sales`
11. Verify `f_billed = 1` in `devRecords`

**Expected Result:**
- Invoice DocNumber: `{qboId}{YY}{MM}{NNN}`
- Line item: "{CUSTOMER}:{PROJECT}" × 2.5 hrs × hourly rate
- Due date: Net 30 EOM
- Tax code: 4 (CAD) or 3 (non-CAD)
- Email sent to customer

#### Test Case 2: Fixed-Price Project (No Invoice)

**Prerequisites:**
- Project with `f_fixedPrice > 0`
- Task assigned to fixed-price project

**Steps:**
1. Start timer on task
2. Work for 3 hours
3. Stop timer, add notes
4. Verify `devRecords` entry created
5. Verify `customer_sales` entry **NOT** created
6. Navigate to Financial Activity
7. Verify customer has no unbilled records

**Expected Result:**
- Timer recorded in FileMaker
- No `customer_sales` record
- No invoice line item
- Revenue recognized at project milestones

#### Test Case 3: Multiple Currencies

**Prerequisites:**
- Customers with CAD, USD, EUR currencies
- Timer entries for each customer

**Steps:**
1. Create invoices for each currency
2. Verify tax codes:
   - CAD → Tax Code 4
   - USD → Tax Code 3
   - EUR → Tax Code 3
3. Verify item references:
   - CAD → Development CAD (ID: 3)
   - USD → Development USD (ID: 7)
   - EUR → Development EUR (ID: 8)

**Expected Result:**
- Correct tax treatment per currency
- Correct item mapping
- Currency displayed on invoice

### Automated Testing

#### Unit Tests

**Product Name Formatting:**

```javascript
// tests/services/invoiceGenerationService.test.js
import { formatProductName } from '../services/financialSyncService';

describe('formatProductName', () => {
  test('extracts capitals and first word', () => {
    expect(formatProductName('Clarity Business Solutions', 'Website Redesign'))
      .toBe('CBS:Website');
  });

  test('handles lowercase customer names', () => {
    expect(formatProductName('acme corp', 'Database Migration'))
      .toBe('ACMECORP:Database');
  });

  test('handles special characters', () => {
    expect(formatProductName('ABC-XYZ Inc.', 'Mobile App'))
      .toBe('ABCXYZ:Mobile');
  });

  test('handles single-word projects', () => {
    expect(formatProductName('Test Co', 'Consulting'))
      .toBe('TESTCO:Consulting');
  });
});
```

**Billable Hours Calculation:**

```javascript
describe('calculateBillableHours', () => {
  test('standard calculation without pause or adjustment', () => {
    const startTime = new Date('2026-01-10T09:00:00Z');
    const endTime = new Date('2026-01-10T11:30:00Z');
    const pauseSeconds = 0;
    const adjustmentSeconds = 0;

    const billable = calculateBillableSeconds(startTime, endTime, pauseSeconds, adjustmentSeconds);
    expect(billable).toBe(9000); // 2.5 hours = 9000 seconds
  });

  test('with pause time subtracted', () => {
    const startTime = new Date('2026-01-10T09:00:00Z');
    const endTime = new Date('2026-01-10T11:30:00Z');
    const pauseSeconds = 900; // 15 minutes
    const adjustmentSeconds = 0;

    const billable = calculateBillableSeconds(startTime, endTime, pauseSeconds, adjustmentSeconds);
    expect(billable).toBe(8100); // 2.25 hours
  });

  test('with positive adjustment (add time)', () => {
    const startTime = new Date('2026-01-10T09:00:00Z');
    const endTime = new Date('2026-01-10T11:00:00Z');
    const pauseSeconds = 0;
    const adjustmentSeconds = 360; // +6 minutes

    const billable = calculateBillableSeconds(startTime, endTime, pauseSeconds, adjustmentSeconds);
    expect(billable).toBe(7560); // 2.1 hours
  });
});
```

#### Integration Tests

**Timer Stop → Customer Sales:**

```javascript
describe('Timer Stop Integration', () => {
  test('creates customer_sales record for hourly project', async () => {
    // Setup
    const task = await createTestTask({ projectType: 'hourly' });
    const timer = await startTimer(task.id);

    // Wait 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Stop timer
    const result = await stopTimer(task.id, 'Test work');

    // Verify devRecords
    expect(result.success).toBe(true);
    expect(result.data.TimeStart).toBeDefined();
    expect(result.data.TimeEnd).toBeDefined();

    // Verify customer_sales
    const sales = await query('customer_sales', {
      eq: { column: 'financial_id', value: result.data.__ID }
    });

    expect(sales.data).toHaveLength(1);
    expect(sales.data[0].quantity).toBeGreaterThan(0);
    expect(sales.data[0].inv_id).toBeNull();
  });

  test('skips customer_sales for fixed-price project', async () => {
    // Setup
    const task = await createTestTask({ projectType: 'fixed-price' });
    const timer = await startTimer(task.id);

    // Stop timer
    const result = await stopTimer(task.id, 'Test work');

    // Verify devRecords exists
    expect(result.success).toBe(true);

    // Verify customer_sales DOES NOT exist
    const sales = await query('customer_sales', {
      eq: { column: 'financial_id', value: result.data.__ID }
    });

    expect(sales.data).toHaveLength(0);
  });
});
```

#### End-to-End Tests (Playwright)

```javascript
// e2e/invoice-generation.spec.js
import { test, expect } from '@playwright/test';

test.describe('QuickBooks Invoice Generation', () => {
  test('complete invoice workflow', async ({ page }) => {
    // Login
    await page.goto('/');
    await page.fill('input[name="email"]', 'test@clarity.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button:has-text("Sign In")');

    // Navigate to Financial Activity
    await page.click('text=Financial Activity');
    await page.waitForSelector('table');

    // Select customer
    await page.click('tr:has-text("Clarity Business Solutions")');

    // Verify unbilled records present
    await expect(page.locator('tr[data-inv-id="null"]')).toHaveCount(5);

    // Click QBO Invoice button
    await page.click('button:has-text("QBO Invoice")');

    // Wait for success message
    await expect(page.locator('text=Invoice created successfully')).toBeVisible();

    // Verify records marked as billed
    await page.reload();
    await expect(page.locator('tr[data-inv-id="null"]')).toHaveCount(0);
  });
});
```

### Verification Queries

#### Check Customer Sales Without Invoices

```sql
-- Unbilled customer_sales records
SELECT
  cs.id,
  cs.financial_id,
  c.business_name AS customer,
  cs.product_name,
  cs.quantity,
  cs.unit_price,
  cs.total_price,
  cs.date,
  cs.inv_id
FROM customer_sales cs
JOIN customers c ON cs.customer_id = c.id
WHERE cs.inv_id IS NULL
ORDER BY cs.date DESC;
```

#### Verify FileMaker Sync Status

```sql
-- customer_sales records without matching devRecords
SELECT cs.*
FROM customer_sales cs
WHERE NOT EXISTS (
  SELECT 1
  FROM devRecords dr
  WHERE dr.__ID = cs.financial_id
);
```

#### Check Invoice Totals

```sql
-- Total invoiced vs unbilled per customer
SELECT
  c.business_name,
  SUM(CASE WHEN cs.inv_id IS NOT NULL THEN cs.total_price ELSE 0 END) AS invoiced,
  SUM(CASE WHEN cs.inv_id IS NULL THEN cs.total_price ELSE 0 END) AS unbilled,
  SUM(cs.total_price) AS total
FROM customer_sales cs
JOIN customers c ON cs.customer_id = c.id
GROUP BY c.business_name
ORDER BY unbilled DESC;
```

---

## Summary

### Key Integration Points

1. **Timer Stop → Financial Record**
   - Location: `taskService.js:67-131`
   - Creates FileMaker `devRecords` entry
   - Conditionally creates `customer_sales` entry (hourly projects only)

2. **Financial Record → Customer Sales**
   - Location: `salesService.js`
   - Product name formatting: "CUSTOMERCAPS:ProjectFirstWord"
   - Hourly rate resolution: project → staff → organization
   - Fixed-price detection skips creation

3. **Customer Sales → QuickBooks Invoice**
   - Location: `CustomerSalesTable.jsx`, `invoiceGenerationService.js`
   - Manual user-initiated process
   - Customer search, invoice generation, email delivery
   - Updates `inv_id` and `f_billed` fields

4. **QuickBooks API Communication**
   - Location: `quickbooksApi.js`
   - HMAC-SHA256 authentication
   - Backend proxy to QBO API
   - Comprehensive error handling

### Migration Considerations

**Critical Success Factors:**

1. ✅ **Product name formatting** must match exactly
2. ✅ **Fixed-price logic** must be preserved in database trigger
3. ✅ **Hourly rate resolution** must follow same priority
4. ✅ **customer_sales trigger** must be reliable and fast
5. ✅ **Time zone handling** must be consistent (UTC)
6. ✅ **Decimal precision** must not introduce rounding errors

**Post-Migration Verification:**

- [ ] All timer stops create correct `customer_sales` records
- [ ] Fixed-price projects correctly skip sales records
- [ ] Invoice generation produces identical results
- [ ] Email delivery continues to work
- [ ] Status updates propagate correctly
- [ ] Historical data reconciliation complete

### Next Steps

1. **Backend Team:** Implement timer API endpoints (TSK0009, TSK0010)
2. **Backend Team:** Create `customer_sales` trigger logic (TSK0011)
3. **QA Team:** Develop comprehensive test suite (TSK0013)
4. **DevOps:** Set up monitoring and alerting
5. **Frontend Team:** Implement backend API client (post-approval)

---

## References

### Documentation

- [TASK_CRUD_OPERATIONS.md](./TASK_CRUD_OPERATIONS.md) - Task CRUD documentation
- [TIMER_LIFECYCLE_STATE_MACHINE.md](./TIMER_LIFECYCLE_STATE_MACHINE.md) - Timer state machine
- [FINANCIAL_RECORD_GENERATION.md](./FINANCIAL_RECORD_GENERATION.md) - Financial record flow
- [FINANCIAL_SYNC_RECONCILIATION.md](./FINANCIAL_SYNC_RECONCILIATION.md) - Sync logic
- [BACKEND_CHANGE_REQUEST_001_TASKS_API.md](./BACKEND_CHANGE_REQUEST_001_TASKS_API.md) - Backend API spec
- [BACKEND_CHANGE_REQUEST_002_TIMER_OPERATIONS.md](./BACKEND_CHANGE_REQUEST_002_TIMER_OPERATIONS.md) - Timer API spec
- [BACKEND_BUSINESS_LOGIC_REQUIREMENTS.md](./BACKEND_BUSINESS_LOGIC_REQUIREMENTS.md) - Business logic
- [MIGRATION_STRATEGY.md](./MIGRATION_STRATEGY.md) - Migration plan

### Code Files

- `src/services/taskService.js` - Timer stop logic
- `src/services/salesService.js` - Customer sales creation
- `src/services/invoiceGenerationService.js` - Invoice payload generation
- `src/services/financialSyncService.js` - Sync reconciliation
- `src/api/quickbooksApi.js` - QBO API client
- `src/api/tasks.js` - FileMaker task API
- `src/api/financialRecords.js` - FileMaker financial API
- `src/components/tasks/TaskTimer.jsx` - Timer UI
- `src/components/financial/CustomerSalesTable.jsx` - Invoice generation UI

### External Resources

- [QuickBooks Online API Documentation](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/invoice)
- [HMAC-SHA256 Authentication Spec](https://tools.ietf.org/html/rfc2104)
- [Backend API OpenAPI Spec](https://api.claritybusinesssolutions.ca/openapi.json)

---

**Document Version:** 1.0
**Last Updated:** 2026-01-10
**Author:** Claude (Autonomous Task Execution)
**Status:** Complete - Ready for Review
