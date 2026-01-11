# QuickBooks Current Implementation Analysis

## Document Overview

This document provides a comprehensive analysis of the current QuickBooks implementation in the Clarity CRM Frontend, including the `initializeQuickBooks` function, FileMaker script integration, existing API client, and UI integration points.

**Status**: Current Implementation (Pre-Migration)
**Last Updated**: 2026-01-10
**Related Documents**:
- `README.md` - QuickBooks overview and migration goals
- `requirements.md` - Detailed migration requirements

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [FileMaker Integration](#filemaker-integration)
3. [QuickBooks API Client](#quickbooks-api-client)
4. [Invoice Generation Service](#invoice-generation-service)
5. [UI Integration Points](#ui-integration-points)
6. [Data Flow](#data-flow)
7. [Authentication Mechanisms](#authentication-mechanisms)
8. [Limitations and Pain Points](#limitations-and-pain-points)

---

## Architecture Overview

The current QuickBooks implementation operates in a **dual-environment architecture**:

1. **FileMaker WebViewer** (LEGACY - being phased out)
   - Embedded in FileMaker with fm-gofer bridge
   - Direct FileMaker script calls via `window.FileMaker.PerformScript`
   - Uses `initializeQuickBooks` function for invoicing

2. **Standalone Web App** (PRIMARY FOCUS)
   - Independent web application with Supabase authentication
   - Direct backend API integration with HMAC authentication
   - Modern QuickBooks API client (`quickbooksApi.js`)

### Environment Detection

The application automatically detects its runtime environment on startup:

**File**: `src/components/auth/SignIn.jsx`
- Detects FileMaker via `window.FileMaker` object
- Falls back to Supabase authentication for web app
- Sets environment context via `setEnvironmentContext()`

**File**: `src/services/dataService.js`
```javascript
ENVIRONMENT_TYPES.FILEMAKER  // Running in FileMaker WebViewer
ENVIRONMENT_TYPES.WEBAPP     // Standalone web application
```

---

## FileMaker Integration

### 1. initializeQuickBooks Function

**Location**: `src/api/fileMaker.js:447-501`

**Purpose**: Sends unbilled financial records to FileMaker for QuickBooks processing.

**Function Signature**:
```javascript
/**
 * Initializes QuickBooks for a specific customer
 * Sends unbilled records to QB for processing
 *
 * @param {Object|string} params - Either a customer ID string or an object with customer and record details
 * @param {string} params.custId - The ID of the customer to process in QuickBooks
 * @param {Array} [params.records] - Array of record IDs to process in QuickBooks (legacy format)
 * @param {Object} [params.recordsByProject] - Object mapping project IDs to arrays of record IDs
 * @returns {Promise} A promise that resolves when the script completes
 */
export async function initializeQuickBooks(params)
```

**Implementation Details** (lines 447-501):

```javascript
export async function initializeQuickBooks(params) {
    // Handle both string (backward compatibility) and object formats
    const isObject = typeof params === 'object' && params !== null;
    const customerId = isObject ? params.custId : params;

    console.log("QuickBooks initialization details:", {
        customerId,
        isObject,
        paramsType: typeof params,
        hasRecordsByProject: isObject && !!params.recordsByProject,
        recordsByProjectKeys: isObject ? Object.keys(params.recordsByProject || {}) : []
    });

    if (!customerId) {
        throw new Error('Customer ID is required for QuickBooks initialization');
    }

    return new Promise((resolve, reject) => {
        try {
            if (typeof FileMaker === "undefined" || !FileMaker.PerformScript) {
                const error = new Error("FileMaker object is unavailable");
                error.code = "FM_UNAVAILABLE";
                reject(error);
                return;
            }

            // Prepare the payload based on the input format
            let payload;
            if (isObject) {
                // New format: pass an object with customer ID and record IDs (grouped by project or flat)
                payload = JSON.stringify(params);
            } else {
                // Legacy format: just pass the customer ID as a string
                payload = customerId;
            }

            console.log("Sending QuickBooks payload:", payload);

            try {
                // Call the FileMaker script with the payload
                FileMaker.PerformScript("Initialize QB via JS", payload);
            } catch (scriptError) {
                console.error("Error executing FileMaker script:", scriptError);
                throw scriptError;
            }

            // Since this is a fire-and-forget operation, resolve immediately
            resolve({ status: "success", message: "QuickBooks initialization requested" });
        } catch (error) {
            console.error("Error initializing QuickBooks:", error);
            error.code = "QB_INIT_ERROR";
            reject(error);
        }
    });
}
```

**Key Characteristics**:
- **Backward Compatible**: Supports both string (customer ID only) and object (with record details) formats
- **Fire-and-Forget**: Resolves immediately after calling FileMaker script
- **No Response Data**: Does not return invoice details or confirmation from QuickBooks
- **FileMaker Dependency**: Only works in FileMaker WebViewer environment
- **Limited Error Handling**: Cannot detect QuickBooks API errors from FileMaker script

### 2. FileMaker Script: "Initialize QB via JS"

**Behavior** (inferred from frontend calls):
- Receives customer ID and optionally record IDs
- Processes records grouped by project (if `recordsByProject` provided)
- Creates QuickBooks invoice(s) via FileMaker's QuickBooks integration
- Updates `f_billed` status in `devRecords` layout
- **No response sent back to JavaScript** - fire-and-forget operation

**Data Flow**:
```
Frontend (initializeQuickBooks)
  → FileMaker.PerformScript("Initialize QB via JS", payload)
    → FileMaker Script
      → QuickBooks Desktop/Online API (via FileMaker)
        → Create Invoice
        → Update devRecords.f_billed = 1
```

### 3. FileMaker Data Structures

**Layout**: `devRecords` (Layouts.RECORDS)

**Key Fields**:
- `__ID`: Unique UUID identifier
- `_custID`: Customer ID (foreign key)
- `_projectID`: Project ID (foreign key)
- `DateStart`: Record date
- `month`: Month number
- `year`: Year
- `weekNo`: Week number
- `f_billed`: Billing status (0 = unbilled, 1 = billed)
- Amount/rate/hours fields for billable time tracking

**File**: `src/api/financialRecords.js:1-497`

Financial records are fetched from FileMaker using queries like:
```javascript
// Fetch unpaid records
query = [{ "f_billed": "0" }]

// Fetch by date range
query = [{ "DateStart": "01/01/2024...01/31/2024" }]

// Fetch by month/year
query = [{ "month": "1", "year": "2024" }]
```

---

## QuickBooks API Client

### 1. Modern API Client (Backend Integration)

**Location**: `src/api/quickbooksApi.js:1-610`

**Architecture**:
- **Backend API**: `https://api.claritybusinesssolutions.ca/quickbooks/*`
- **Authentication**: HMAC-SHA256 signature-based (M2M)
- **Organization Scoping**: `X-Organization-ID` header
- **Environment Variables**:
  - `VITE_API_URL`: Backend API URL
  - `VITE_SECRET_KEY`: HMAC secret key
  - `VITE_CLARITY_INTEGRATION_ORG_ID`: Organization ID

**Key Functions**:

#### Authorization Operations
```javascript
getQBOAuthorizationUrl()           // Get OAuth URL
handleQBOOAuthCallback(code, state, realmId)  // Handle callback
refreshQBOToken()                   // Refresh access token
validateQBOCredentials()            // Validate current credentials
```

#### Company Operations
```javascript
getQBOCompanyInfo()                 // Get company information
```

#### Customer Operations
```javascript
listQBOCustomers(params)            // List all customers
getQBOCustomer(customerId)          // Get specific customer
createQBOCustomer(customerData)     // Create new customer
updateQBOCustomer(customerData)     // Update existing customer
deleteQBOCustomer(customerId)       // Delete customer
searchQBOCustomers(params)          // Search by name/email
```

#### Invoice Operations
```javascript
listQBOInvoices(params)             // List all invoices
getQBOInvoice(invoiceId)            // Get specific invoice
createQBOInvoice(invoiceData)       // Create new invoice
updateQBOInvoice(invoiceData)       // Update existing invoice
deleteQBOInvoice(invoiceId)         // Delete invoice
sendQBOInvoiceEmail(invoiceId, email) // Send invoice via email
```

#### Other Entity Operations
```javascript
listQBOBills(params)                // Bill management
listQBOItems(params)                // Item management
listQBOVendors(params)              // Vendor management
executeQBOQuery(query)              // Custom SQL-like queries
```

#### Webhook Operations
```javascript
getQBOWebhookStats()                // Get webhook statistics
listQBOWebhookEvents()              // List webhook events
testQBOWebhook(testData)            // Test webhook functionality
clearQBOWebhookEvents()             // Clear webhook events
```

### 2. Authentication Implementation

**File**: `src/api/quickbooksApi.js:31-60`

```javascript
const generateAuthHeader = async (payload = '') => {
  const secretKey = import.meta.env.VITE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('VITE_SECRET_KEY not available. Check environment variables.');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${timestamp}.${payload}`;

  // Use Web Crypto API for HMAC-SHA256
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

**Request Format** (lines 70-185):
```javascript
const makeRequest = async (endpoint, method = 'GET', data = null, options = {}) => {
  const payload = (method !== 'GET' && data) ? JSON.stringify(data) : '';
  const authHeader = await generateAuthHeader(payload);
  const orgId = import.meta.env.VITE_CLARITY_INTEGRATION_ORG_ID;

  const headers = {
    'Authorization': authHeader,
    'X-Organization-ID': orgId,
    'Content-Type': 'application/json',
    ...options.headers
  };

  const url = `${BACKEND_API_URL}/quickbooks${endpoint}`;
  const response = await fetch(url, requestOptions);

  // Error handling and response parsing...
};
```

### 3. Deprecated Edge Function Client

**Location**: `src/api/quickbooksEdgeFunction.js:1-14`

**Status**: Intentionally disabled with error throw
```javascript
throw new Error(
  'Deprecated QuickBooks Edge client (quickbooksEdgeFunction.js) was imported. ' +
  'Migrate to src/api/quickbooksApi.js which targets /quickbooks/* endpoints.'
)
```

This file prevents accidental usage of the old Supabase Edge Function approach.

---

## Invoice Generation Service

**Location**: `src/services/invoiceGenerationService.js:1-384`

**Purpose**: Advanced invoice payload generation with business logic for QuickBooks Online.

### Business Rules

1. **Document Number Format**: `{qboID}{YY}{MM}{NNN}`
   - `qboID`: QuickBooks customer ID
   - `YY`: Last 2 digits of year
   - `MM`: Month with leading zero (01-12)
   - `NNN`: Invoice count for customer this month, starting at 001

2. **Tax Codes**:
   - Tax Code 3: Non-CAD currencies (USD, EUR, etc.)
   - Tax Code 4: CAD currency

3. **Due Date**: Net 30 (EoM next month)
   - 30 days from invoice date
   - Then end of that month

4. **Email Delivery**: Automatic via `BillEmail` and `DeliveryInfo` fields

### Key Functions

#### 1. Generate Invoice Payload
**Location**: Lines 26-84

```javascript
export const generateInvoicePayload = async (salesRecords, qboCustomer, options = {}) => {
  // Extract customer currency (default to CAD)
  const customerCurrency = qboCustomer.CurrencyRef?.value || 'CAD';
  const customerCurrencyName = getCurrencyName(customerCurrency);

  // Generate document number (qboID+YY+MM+NNN)
  const docNumber = await generateDocumentNumber(qboCustomer.Id, salesRecords);

  // Calculate due date (EOM of latest item date + 1 month)
  const dueDate = calculateDueDate(salesRecords);

  // Determine tax code based on currency
  const taxCodeRef = getTaxCodeForCurrency(customerCurrency);

  // Get appropriate item reference based on currency
  const itemRef = getItemRefForCurrency(customerCurrency);

  // Group sales records by description and unit price for line items
  const lineItems = generateLineItems(salesRecords, itemRef, taxCodeRef);

  // Build the complete invoice payload
  const invoicePayload = {
    BillEmail: {
      Address: qboCustomer.PrimaryEmailAddr?.Address || options.defaultEmail || ''
    },
    CurrencyRef: {
      name: customerCurrencyName,
      value: customerCurrency
    },
    CustomerRef: {
      name: qboCustomer.DisplayName || qboCustomer.Name,
      value: qboCustomer.Id
    },
    DeliveryInfo: {
      DeliveryType: 'Email'
    },
    DocNumber: docNumber,
    DueDate: dueDate,
    GlobalTaxCalculation: 'TaxExcluded',
    Line: lineItems
  };

  return invoicePayload;
};
```

#### 2. Document Number Generation
**Location**: Lines 92-110

```javascript
const generateDocumentNumber = async (qboCustomerId, salesRecords) => {
  const latestDate = getLatestDate(salesRecords);
  const year = latestDate.getFullYear().toString().slice(-2); // YY
  const month = (latestDate.getMonth() + 1).toString().padStart(2, '0'); // MM

  // Query existing invoices for this customer and month
  const invoiceNumber = await getNextInvoiceSequence(qboCustomerId, latestDate);

  const docNumber = `${qboCustomerId}${year}${month}${invoiceNumber}`;
  return docNumber;
};
```

#### 3. Next Invoice Sequence
**Location**: Lines 118-162

```javascript
const getNextInvoiceSequence = async (qboCustomerId, invoiceDate) => {
  const year = invoiceDate.getFullYear();
  const month = invoiceDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startDate = firstDay.toISOString().split('T')[0];
  const endDate = lastDay.toISOString().split('T')[0];

  // Use the new invoice listing endpoint with customer filtering
  const invoiceResult = await listQBOInvoices({
    customer_id: qboCustomerId,
    max_results: 100
  });

  // Filter invoices by date range
  let existingInvoiceCount = 0;
  if (invoiceResult && invoiceResult.invoices) {
    const filteredInvoices = invoiceResult.invoices.filter(invoice => {
      const invoiceDate = invoice.TxnDate;
      return invoiceDate >= startDate && invoiceDate <= endDate;
    });
    existingInvoiceCount = filteredInvoices.length;
  }

  // Generate next sequence number (existing count + 1, padded to 3 digits)
  const nextSequence = (existingInvoiceCount + 1).toString().padStart(3, '0');
  return nextSequence;
};
```

#### 4. Tax Code and Item Mapping
**Location**: Lines 206-225

```javascript
const getTaxCodeForCurrency = (currency) => {
  // Business rule: taxCodeRef 3 for non-CAD, taxCodeRef 4 for CAD
  return currency === 'CAD' ? 4 : 3;
};

const getItemRefForCurrency = (currency) => {
  const itemMapping = {
    CAD: { name: 'Development CAD', value: '3' },
    USD: { name: 'Development USD', value: '7' },
    EUR: { name: 'Development EUR', value: '8' }
  };

  return itemMapping[currency] || itemMapping.CAD;
};
```

#### 5. Line Item Generation
**Location**: Lines 249-306

```javascript
const generateLineItems = (salesRecords, itemRef, taxCodeRef) => {
  // Group records by description and unit price
  const groupedRecords = new Map();

  salesRecords.forEach(record => {
    const description = record.product_name || 'Development';
    const unitPrice = Number(record.unit_price) || 0;
    const quantity = Number(record.quantity) || 0;
    const totalPrice = Number(record.total_price) || 0;

    const key = `${description}|${unitPrice}`;

    if (groupedRecords.has(key)) {
      const existing = groupedRecords.get(key);
      existing.totalQuantity += quantity;
      existing.totalAmount += totalPrice;
    } else {
      groupedRecords.set(key, {
        description,
        unitPrice,
        totalQuantity: quantity,
        totalAmount: totalPrice
      });
    }
  });

  // Convert grouped records to line items
  const lineItems = Array.from(groupedRecords.values()).map((group, index) => {
    const calculatedQuantity = group.unitPrice > 0
      ? group.totalAmount / group.unitPrice
      : group.totalQuantity;

    return {
      Amount: Math.round(group.totalAmount * 100) / 100,
      Description: group.description,
      DetailType: 'SalesItemLineDetail',
      LineNum: index + 1,
      SalesItemLineDetail: {
        ItemRef: itemRef,
        Qty: Math.round(calculatedQuantity * 100) / 100,
        TaxCodeRef: {
          value: taxCodeRef
        },
        UnitPrice: Math.round(group.unitPrice * 100) / 100
      }
    };
  });

  return lineItems;
};
```

#### 6. Validation and Logging
**Location**: Lines 314-378

```javascript
export const validateInvoiceData = (salesRecords, qboCustomer) => {
  const errors = [];

  // Validate sales records
  if (!salesRecords || !Array.isArray(salesRecords) || salesRecords.length === 0) {
    errors.push('Sales records are required and must be a non-empty array');
  }

  // Validate QuickBooks customer
  if (!qboCustomer || !qboCustomer.Id) {
    errors.push('QuickBooks customer is required with Id');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const formatInvoiceForLogging = (invoicePayload) => {
  const summary = {
    docNumber: invoicePayload.DocNumber,
    customer: invoicePayload.CustomerRef?.name,
    currency: invoicePayload.CurrencyRef?.value,
    dueDate: invoicePayload.DueDate,
    lineCount: invoicePayload.Line?.length || 0,
    totalAmount: invoicePayload.Line?.reduce((sum, line) => sum + (line.Amount || 0), 0) || 0,
    email: invoicePayload.BillEmail?.Address
  };

  return `Invoice Summary: ${JSON.stringify(summary, null, 2)}`;
};
```

---

## UI Integration Points

### 1. CustomerSalesTable Component

**Location**: `src/components/financial/CustomerSalesTable.jsx:1-150`

**Purpose**: Displays customer sales records with QuickBooks invoice creation capability.

**Key Features**:
- Customer search using `searchQBOCustomers(params)` (lines 105-137)
- Invoice generation via `generateInvoicePayload()` service
- Invoice creation via `createQBOInvoice()` API
- Email delivery via `sendQBOInvoiceEmail()`
- Record status updates via `updateFinancialRecordBilledStatus()`

**Search Implementation** (lines 105-137):
```javascript
const searchQBOCustomerAdvanced = useCallback(async (searchName) => {
  console.log(`🔍 Searching for QuickBooks customer: "${searchName}"`);

  try {
    const searchParams = {
      name: searchName,
      active_only: true,
      max_results: 20
    };

    const result = await searchQBOCustomers(searchParams);

    if (result?.customers && result.customers.length > 0) {
      console.log(`✅ Found ${result.customers.length} customer(s)`);
      return result.customers;
    } else {
      console.log(`❌ No customers found for "${searchName}"`);
      return [];
    }
  } catch (error) {
    console.error('🚨 Customer search error:', error);
    return [];
  }
}, []);
```

**Invoice Creation Flow**:
1. User selects customer sales records
2. Search for matching QBO customer via `searchQBOCustomers()`
3. If not found, prompt to create via `CreateQBOCustomerModal`
4. Generate invoice payload via `generateInvoicePayload()`
5. Create invoice via `createQBOInvoice()`
6. Send invoice email via `sendQBOInvoiceEmail()`
7. Update record statuses via `updateFinancialRecordBilledStatus()`
8. Refresh UI data

### 2. FinancialActivity Component

**Location**: `src/components/financial/FinancialActivity.jsx:1-375`

**Purpose**: Main financial management interface with activity tracking and data synchronization.

**Key Features**:
- Timeframe-based data fetching (today, week, month, quarter, year)
- Customer and project filtering
- Invoice status updates
- Integration with `FinancialSyncPanel` for data synchronization

**Tab Structure** (lines 163-187):
```javascript
{[
  { id: 'activity', label: 'Financial Activity' },
  { id: 'sync', label: 'Data Synchronization' }
].map((tab) => (
  <button
    key={tab.id}
    onClick={() => setActiveTab(tab.id)}
    className={activeTab === tab.id ? 'active' : 'inactive'}
  >
    {tab.label}
  </button>
))}
```

**Components Used**:
- `TimeframeSelector`: Date range selection
- `FinancialChart`: Visual data representation
- `CustomerList`: Customer selection and invoice management
- `CustomerSalesTable`: Detailed sales records
- `FinancialSyncPanel`: FileMaker/Supabase synchronization

### 3. FinancialSyncPanel Component

**Location**: `src/components/financial/FinancialSyncPanel.jsx`

**Purpose**: Synchronizes financial data between FileMaker (`devRecords`) and Supabase (`customer_sales`).

**Data Flow**:
```
FileMaker devRecords
  ↓ (fetchRecordsForDateRange)
  ↓ (processFinancialData)
  ↓ (compareRecords)
  ↓ (synchronizeFinancialRecords)
Supabase customer_sales
```

**Key Service**: `financialSyncService.js`

### 4. CreateQBOCustomerModal Component

**Location**: `src/components/financial/CreateQBOCustomerModal.jsx`

**Purpose**: Creates new QuickBooks customer when no match is found during invoice generation.

**API Integration**:
- `createQBOCustomer(customerData)` - Creates customer in QuickBooks
- Form fields map to QBO Customer object structure

---

## Data Flow

### Current Invoice Creation Flow (FileMaker Path)

```
1. User selects customer records in Financial Activity UI
   ↓
2. User clicks "Send to QuickBooks" button
   ↓
3. Frontend calls initializeQuickBooks(customerId)
   ↓
4. FileMaker.PerformScript("Initialize QB via JS", customerId)
   ↓
5. FileMaker Script processes:
   - Fetches unbilled records for customer
   - Groups records by project (if applicable)
   - Creates QB invoice(s) via FileMaker's QB integration
   - Updates devRecords.f_billed = 1
   ↓
6. Fire-and-forget - No response to frontend
   ↓
7. User must manually verify in QuickBooks or FileMaker
```

**Pain Points**:
- No confirmation of invoice creation
- No error handling for QB API failures
- Cannot retrieve invoice details or ID
- No way to send invoice email from frontend
- Dependent on FileMaker environment

### Modern Invoice Creation Flow (Web App Path)

```
1. User selects customer sales records in CustomerSalesTable
   ↓
2. Frontend searches for QBO customer:
   - searchQBOCustomers({ name: customerName })
   ↓
3. If customer not found:
   - Open CreateQBOCustomerModal
   - createQBOCustomer(customerData)
   ↓
4. Generate invoice payload:
   - generateInvoicePayload(salesRecords, qboCustomer)
   - Includes: DocNumber, DueDate, TaxCode, LineItems
   ↓
5. Create invoice in QuickBooks:
   - createQBOInvoice(invoicePayload)
   - Returns: Invoice object with Id, DocNumber, TotalAmt
   ↓
6. Send invoice email:
   - sendQBOInvoiceEmail(invoiceId, email)
   ↓
7. Update record billing status:
   - updateFinancialRecordBilledStatus(recordId, 1)
   - Or: update Supabase customer_sales.inv_id
   ↓
8. Display success confirmation to user
   - Show invoice number, total, email sent confirmation
   ↓
9. Refresh financial data in UI
```

**Advantages**:
- Full error handling and user feedback
- Invoice details returned to frontend
- Email delivery integrated
- Record status updates trackable
- Works in any environment (not FileMaker-dependent)

---

## Authentication Mechanisms

### 1. FileMaker Authentication

**Method**: FileMaker Data API credentials
**Storage**: Environment variables
```
VITE_FM_URL=https://server.claritybusinesssolutions.ca/fmi/data/v1
VITE_FM_DATABASE=clarityCRM
VITE_FM_USER=<username>
VITE_FM_PASSWORD=<password>
```

**Limitations**:
- Credentials stored in frontend environment
- No token refresh mechanism
- Session management handled by FileMaker

### 2. Backend API Authentication

**Method**: HMAC-SHA256 signature
**Implementation**: `src/api/quickbooksApi.js:31-60`

**Algorithm**:
```
1. Generate timestamp: timestamp = floor(Date.now() / 1000)
2. Create message: message = "{timestamp}.{payload}"
3. Generate signature: signature = HMAC-SHA256(secretKey, message)
4. Create header: "Bearer {signature}.{timestamp}"
```

**Headers Required**:
```javascript
{
  'Authorization': 'Bearer {signature}.{timestamp}',
  'X-Organization-ID': '{orgId}',
  'Content-Type': 'application/json'
}
```

**Environment Variables**:
```
VITE_SECRET_KEY=<hmac-secret>
VITE_CLARITY_INTEGRATION_ORG_ID=<org-id>
```

**Advantages**:
- Stateless authentication
- Request integrity verification
- No tokens to refresh
- Organization-scoped requests

### 3. QuickBooks OAuth (Backend-Managed)

**Flow**: OAuth 2.0 authorization code flow
**Scope**: Backend handles token storage and refresh

**Frontend Functions**:
```javascript
// 1. Get authorization URL
const { authorization_url, state } = await getQBOAuthorizationUrl();

// 2. Redirect user to QuickBooks login
window.location.href = authorization_url;

// 3. Handle callback (backend processes)
await handleQBOOAuthCallback(code, state, realmId);

// 4. Validate credentials
const isValid = await validateQBOCredentials();

// 5. Refresh token (if needed)
await refreshQBOToken();
```

**Token Management**: Backend-only
- Access tokens stored securely on backend
- Refresh tokens handled automatically
- Frontend never sees QuickBooks tokens

---

## Limitations and Pain Points

### 1. FileMaker Integration Limitations

**initializeQuickBooks Function**:
- ✗ Fire-and-forget operation (no response data)
- ✗ Cannot detect QuickBooks API errors
- ✗ No invoice ID or details returned
- ✗ Cannot send invoice email from frontend
- ✗ Only works in FileMaker WebViewer environment
- ✗ No progress feedback for user
- ✗ Dependent on FileMaker script implementation

**Data Synchronization**:
- ✗ Manual sync required between FileMaker and Supabase
- ✗ Potential data inconsistencies
- ✗ No real-time updates
- ✗ Complex dual-write patterns needed

### 2. Architecture Pain Points

**Dual Environment Complexity**:
- ✗ Two separate code paths for FileMaker vs Web App
- ✗ Difficult to test and maintain
- ✗ Environment detection can fail
- ✗ Feature parity challenges

**Legacy Debt**:
- ✗ FileMaker-specific layouts and scripts
- ✗ Hardcoded field names (e.g., `f_billed`, `_custID`)
- ✗ No type safety or validation on FileMaker data
- ✗ Limited query capabilities

### 3. Invoice Generation Gaps

**Current FileMaker Path**:
- ✗ No document number generation in frontend
- ✗ No tax code logic in frontend
- ✗ No due date calculation in frontend
- ✗ No line item grouping/optimization
- ✗ Cannot customize invoice before creation

**Modern Web App Path** (Improvements Made):
- ✓ Advanced document number generation
- ✓ Currency-based tax code selection
- ✓ Net 30 due date calculation
- ✓ Line item grouping and optimization
- ✓ Validation before invoice creation
- ✓ Email delivery integration
- ✓ Full error handling

### 4. User Experience Issues

**FileMaker Path**:
- ✗ No confirmation of success/failure
- ✗ Must switch to FileMaker or QuickBooks to verify
- ✗ No invoice preview
- ✗ Cannot edit invoice before sending
- ✗ No email delivery status

**Web App Path** (Better):
- ✓ Immediate success/failure feedback
- ✓ Invoice details displayed in UI
- ✓ Invoice preview possible
- ✓ Email delivery confirmation
- ✓ Error messages with actionable guidance

### 5. Data Consistency Challenges

**FileMaker-Supabase Sync**:
- ✗ Case-sensitive ID matching issues
- ✗ Timestamp format differences
- ✗ Orphaned records in either system
- ✗ No conflict resolution strategy
- ✗ Manual sync triggers required

**Record Status Tracking**:
- ✗ FileMaker uses `f_billed` field
- ✗ Supabase uses `inv_id` field
- ✗ No unified status model
- ✗ Difficult to track invoice lifecycle

### 6. Migration Blockers

**To Fully Remove FileMaker**:
- ✗ `devRecords` layout still primary data source
- ✗ Financial record CRUD still uses FileMaker API
- ✗ Some UI components assume FileMaker environment
- ✗ No full migration of historical data yet
- ✗ Business processes still reference FileMaker

**Backend Requirements**:
- ✗ Need backend endpoints for financial record CRUD
- ✗ Need invoice creation endpoint with business logic
- ✗ Need customer matching/creation logic
- ✗ Need webhook handling for QuickBooks updates

---

## Code References

### Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/api/fileMaker.js` | 447-501 | `initializeQuickBooks` function |
| `src/api/quickbooksApi.js` | 1-610 | Modern QB API client |
| `src/services/invoiceGenerationService.js` | 1-384 | Invoice payload generation |
| `src/components/financial/CustomerSalesTable.jsx` | 1-150 | Sales table with QB integration |
| `src/components/financial/FinancialActivity.jsx` | 1-375 | Main financial UI |
| `src/services/financialSyncService.js` | 1-695 | FileMaker-Supabase sync |
| `src/api/financialRecords.js` | 1-497 | Financial record CRUD |
| `src/api/index.js` | 8 | Export of `initializeQuickBooks` |

### Environment Detection

| File | Lines | Purpose |
|------|-------|---------|
| `src/components/auth/SignIn.jsx` | - | Environment detection on startup |
| `src/services/dataService.js` | - | Environment type constants |
| `src/api/fileMaker.js` | 269-282 | Environment-aware data routing |

### Authentication

| File | Lines | Purpose |
|------|-------|---------|
| `src/api/quickbooksApi.js` | 31-60 | HMAC auth header generation |
| `src/api/quickbooksApi.js` | 70-185 | Authenticated request wrapper |
| `src/api/fileMaker.js` | 43-86 | Backend auth for FileMaker fallback |

---

## Next Steps

This analysis forms the foundation for:

1. **Migration Requirements** (`requirements.md`)
   - Define new backend endpoints
   - Specify data models and validation
   - Document API contracts

2. **Implementation Plan**
   - Backend endpoint development
   - Frontend refactoring to remove FileMaker dependencies
   - Data migration strategy
   - Testing and validation

3. **Deprecation Strategy**
   - Phase out `initializeQuickBooks` FileMaker path
   - Migrate all UI to modern QB API client
   - Remove FileMaker environment detection
   - Archive legacy code

---

## Conclusion

The current QuickBooks implementation is in a **transition state**:

**Legacy Path (FileMaker)**:
- Simple fire-and-forget integration
- Limited functionality and feedback
- Dependent on FileMaker environment
- Being phased out

**Modern Path (Web App)**:
- Full-featured QB API client
- Advanced invoice generation with business logic
- Comprehensive error handling and user feedback
- Environment-agnostic
- Primary focus for new development

The migration goal is to **fully deprecate the FileMaker path** and standardize on the modern web app approach, with backend support for all QuickBooks operations.
