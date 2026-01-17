# Current Implementation

This document describes the current FileMaker-based implementation of the Customers feature, including frontend call graphs, code architecture, and dual-write behavior.

## Frontend Call Graph

### 1. Fetch All Customers

```
User Action: Navigate to Customers section in sidebar
    ↓
useCustomer().loadCustomers()  [src/hooks/useCustomer.js:42-58]
    ↓
fetchCustomers()  [src/api/customers.js:7-17]
    ↓
handleFileMakerOperation(() => {
    fetchDataFromFileMaker({
        layout: "devCustomers",
        action: "READ",
        query: [{ "__ID": "*" }]
    })
})  [src/api/fileMaker.js]
    ↓
FileMaker Data API: GET /fmi/data/v1/databases/clarityCRM/layouts/devCustomers/records
    ↓
processCustomerData(result)  [src/services/customerService.js:10-23]
    - Maps fieldData to flat structure
    - Converts __ID to id
    - Converts f_active ("1"/"0") to boolean isActive
    - Extracts timestamps
    ↓
sortCustomers(processedCustomers)  [src/services/customerService.js:39-48]
    - Sorts by active status (active first)
    - Then sorts by Name alphabetically
    ↓
setCustomers(sortedCustomers) → State updated
    ↓
UI Renders: CustomerList component displays sorted customers
```

### 2. Fetch Customer By ID

```
User Action: Click customer from list
    ↓
useCustomer().handleCustomerSelect(customerId)  [src/hooks/useCustomer.js:63-78]
    ↓
fetchCustomerById(customerId)  [src/api/customers.js:24-36]
    ↓
handleFileMakerOperation(() => {
    fetchDataFromFileMaker({
        layout: "devCustomers",
        action: "READ",
        query: [{ "__ID": customerId }]
    })
})  [src/api/fileMaker.js]
    ↓
FileMaker Data API: GET /fmi/data/v1/databases/clarityCRM/layouts/devCustomers/records?query=...
    ↓
processCustomerData(result)  [src/services/customerService.js:10-23]
    ↓
setSelectedCustomer(processedCustomer[0]) → State updated
    ↓
UI Renders: CustomerDetails component displays customer details
```

### 3. Create Customer (FileMaker Only - No Dual-Write)

```
User Action: Click "Add Customer" → Fill form → Submit
    ↓
useCustomer().handleCustomerCreate(customerData)  [src/hooks/useCustomer.js:83-107]
    ↓
validateCustomerData(customerData)  [src/services/customerService.js:55-74]
    - Validates: Name required, Email format, Phone format
    - Returns { isValid, errors }
    ↓
formatCustomerForFileMaker(customerData)  [src/services/customerService.js:101-110]
    - Converts: name → Name, email → Email, isActive → f_active ("1"/"0")
    ↓
createCustomer(formattedData)  [src/api/customers.js:64-76]
    ↓
handleFileMakerOperation(() => {
    fetchDataFromFileMaker({
        layout: "devCustomers",
        action: "CREATE",
        fieldData: data
    })
})  [src/api/fileMaker.js]
    ↓
FileMaker Data API: POST /fmi/data/v1/databases/clarityCRM/layouts/devCustomers/records
    ↓
loadCustomers() → Reload full list to get new customer
    ↓
⚠️ NO SUPABASE WRITE - Customer only exists in FileMaker
```

### 4. Update Customer (Dual-Write to Supabase)

```
User Action: Edit customer fields → Submit
    ↓
useCustomer().handleCustomerUpdate(customerId, customerData)  [src/hooks/useCustomer.js:112-177]
    ↓
validateCustomerData(customerData)  [src/services/customerService.js:55-74]
    ↓
formatCustomerForFileMaker(customerData)  [src/services/customerService.js:101-110]
    ↓
updateCustomer(customerId, formattedData)  [src/api/customers.js:44-57]
    ↓
handleFileMakerOperation(() => {
    fetchDataFromFileMaker({
        layout: "devCustomers",
        action: "UPDATE",
        recordId: customerId,  ⚠️ Note: Uses FileMaker recordId, not __ID
        fieldData: data
    })
})  [src/api/fileMaker.js]
    ↓
FileMaker Data API: PATCH /fmi/data/v1/databases/clarityCRM/layouts/devCustomers/records/{recordId}
    ↓
✓ FileMaker Update Successful
    ↓
Backend API update only (Supabase dual-write removed from frontend)
    ↓
setCustomers() → Update local state
    ↓
UI Updates: Customer details reflect new data
```

### 5. Toggle Customer Status

```
User Action: Click status toggle switch
    ↓
useCustomer().handleCustomerStatusToggle(recordId, active)  [src/hooks/useCustomer.js:182-212]
    ↓
toggleCustomerStatus(recordId, active)  [src/api/customers.js:84-99]
    ↓
handleFileMakerOperation(() => {
    fetchDataFromFileMaker({
        layout: "devCustomers",
        action: "UPDATE",
        recordId: recordId,  ⚠️ Uses FileMaker recordId
        fieldData: { f_active: active ? "1" : "0" }
    })
})  [src/api/fileMaker.js]
    ↓
FileMaker Data API: PATCH /fmi/data/v1/databases/clarityCRM/layouts/devCustomers/records/{recordId}
    ↓
✓ FileMaker Update Successful
    ↓
setCustomers() → Update local state (find by recordId)
    ↓
⚠️ NO SUPABASE WRITE - Status change not synced
```

### 6. Delete Customer

```
User Action: Click delete button → Confirm
    ↓
useCustomer().handleCustomerDelete(recordId)  [src/hooks/useCustomer.js:217-243]
    ↓
deleteCustomer(recordId)  [src/api/customers.js:122-134]
    ↓
handleFileMakerOperation(() => {
    fetchDataFromFileMaker({
        layout: "devCustomers",
        action: "DELETE",
        recordId: recordId  ⚠️ Uses FileMaker recordId
    })
})  [src/api/fileMaker.js]
    ↓
FileMaker Data API: DELETE /fmi/data/v1/databases/clarityCRM/layouts/devCustomers/records/{recordId}
    ↓
✓ FileMaker Delete Successful
    ↓
setCustomers() → Filter out deleted customer by recordId
    ↓
⚠️ NO SUPABASE WRITE - Orphaned customer records remain in Supabase
```

## Code Architecture

### Layer 1: UI Components

**src/components/customers/CustomerDetails.jsx**
- Displays customer information in tabbed interface
- Tabs: Overview, Projects, Tasks, Financial, Notes, Links
- Uses `useCustomer()` hook for state/operations
- Handles customer edit/delete actions

**src/components/customers/CustomerForm.jsx**
- Form for creating/editing customers
- Fields: Name*, Email, Phone, Address (City, State, PostalCode, Country), ContactPerson
- Client-side validation (Name required, Email format, Phone format)
- Calls `handleCustomerCreate()` or `handleCustomerUpdate()`

**src/components/customers/CustomerHeader.jsx**
- Customer name and status display
- Status toggle switch
- Edit and delete buttons
- Uses `handleCustomerStatusToggle()`

**src/components/customers/CustomerTabs.jsx**
- Tab navigation for customer sections
- Shows counts for related entities (Projects, Tasks)

**src/components/customers/CustomerSettings.jsx**
- Customer-specific settings (not widely used)

### Layer 2: Custom Hooks

**src/hooks/useCustomer.js** (268 lines)
- **Primary customer management hook**
- State: `customers`, `selectedCustomer`, `loading`, `error`, `stats`
- Operations:
  - `loadCustomers()` - Fetch all customers
  - `handleCustomerSelect(customerId)` - Select customer by ID
  - `handleCustomerCreate(customerData)` - Create new customer
  - `handleCustomerUpdate(customerId, customerData)` - Update customer
  - `handleCustomerStatusToggle(recordId, active)` - Toggle active status
  - `handleCustomerDelete(recordId)` - Delete customer
- Backend API is the source of truth in web app mode (no frontend Supabase dual-write)

### Layer 3: Services

**src/services/customerService.js** (162 lines)
- **Business logic and data processing**
- `processCustomerData(data)` - Transform FileMaker response to UI format:
  ```javascript
  {
    ...customer.fieldData,
    id: customer.fieldData.__ID,
    recordId: customer.recordId,
    isActive: customer.fieldData.f_active === "1" || customer.fieldData.f_active === 1,
    createdAt: customer.fieldData['~creationTimestamp'],
    modifiedAt: customer.fieldData['~modificationTimestamp']
  }
  ```
- `validateCustomerData(data)` - Validation rules:
  - Name required (cannot be empty/whitespace)
  - Email format (regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
  - Phone format (regex: `/^\+?[\d\s-()]+$/`)
  - Returns `{ isValid, errors }`
- `formatCustomerForFileMaker(data)` - Transform UI data to FileMaker format:
  ```javascript
  {
    Name: data.name,
    Email: data.email,
    Phone: data.phone,
    f_active: data.isActive ? "1" : "0",
    ContactPerson: data.contactPerson
  }
  ```
- `sortCustomers(customers)` - Sort by active status (active first), then by Name
- `calculateCustomerStats(customers)` - Returns `{ total, active, inactive, activePercentage }`

**src/services/dualWriteService.js** (359 lines)
- **NOT USED FOR CUSTOMER CRUD** (used for timer→financial record sync)
- Primary use case: When task timer stops → create financial record in both FileMaker and Supabase
- Could be extended to handle customer dual-writes, but currently customer updates handle dual-write manually in `useCustomer.js`

### Layer 4: API Layer

**src/api/customers.js** (135 lines)
- **Direct FileMaker API calls**
- All functions use `handleFileMakerOperation()` wrapper for error handling
- All functions use `fetchDataFromFileMaker()` which routes through fm-gofer bridge

**Key Functions:**
- `fetchCustomers()` - Query all customers (`query: [{ "__ID": "*" }]`)
- `fetchCustomerById(customerId)` - Query single customer by `__ID`
- `createCustomer(data)` - Create new customer (FileMaker only, no Supabase)
- `updateCustomer(customerId, data)` - Update customer by `recordId`
- `toggleCustomerStatus(customerId, active)` - Update `f_active` field by `recordId`
- `fetchActiveCustomers()` - Query customers where `f_active = "1"`
- `deleteCustomer(customerId)` - Delete customer by `recordId`

**src/api/fileMaker.js** (501 lines)
- `fetchDataFromFileMaker(params)` - **Environment-aware routing** (lines 263-282)
  - Detects environment via `isFileMakerEnvironment()` or app context attribute
  - **FileMaker Environment**: Uses fm-gofer library to communicate with FileMaker WebViewer
  - **Web App Environment**: Routes to `callBackendAPI()` which converts FileMaker-style params to REST API calls
- `callBackendAPI(params)` - Backend API adapter (lines 93-239)
  - Converts FileMaker actions (read/create/update/delete) to HTTP requests
  - Routes to `https://api.claritybusinesssolutions.ca/filemaker/{layout}/...`
  - Generates HMAC-SHA256 authentication headers
  - Transforms responses back to FileMaker-compatible format
- `handleFileMakerNativeCall(params)` - FileMaker bridge implementation (lines 291-351)
  - Uses fm-gofer for async operations or FileMaker.PerformScript for sync
  - Handles retries (30 attempts, 100ms intervals)
  - Error handling with categorized error codes

### Layer 5: Supabase Service

**src/services/supabaseService.js**
- Singleton service for Supabase operations
- Generic CRUD operations: `query()`, `insert()`, `update()`, `remove()`
- Routes through backend API for HMAC authentication:
  - Frontend → Backend API (`/api/supabase/{operation}`) → Supabase
  - HMAC signature validation on backend
- No customer-specific logic (generic table operations)

## Environment Architecture

### Dual-Environment Support

The application supports two runtime environments, automatically detected:

**FileMaker WebViewer Environment:**
- Detected via `window.FileMaker` object or `FMGofer.PerformScript`
- Uses fm-gofer bridge for direct FileMaker communication
- Data flows: Frontend → fm-gofer → FileMaker WebViewer → FileMaker Data API
- Typical use: Embedded in FileMaker desktop application

**Web App Environment:**
- Detected when FileMaker bridge is unavailable
- Routes all FileMaker-style API calls through backend API
- Data flows: Frontend → Backend API (`/filemaker/*`) → FileMaker Server
- Backend handles authentication and FileMaker Data API communication
- Typical use: Standalone web browser access

**Environment Detection** (src/api/fileMaker.js:263-282):
```javascript
// Check for explicit environment context
const appElement = document.querySelector('[data-app-environment]');
const appEnvironment = appElement?.getAttribute('data-app-environment');

// Use context if available, otherwise auto-detect
const useFileMakerBridge = appEnvironment === 'filemaker' ||
    (appEnvironment === null && isFileMakerEnvironment());

if (useFileMakerBridge) {
    return await handleFileMakerNativeCall(params);
} else {
    return await callBackendAPI(params);
}
```

**Backend API Mapping** (src/api/fileMaker.js:93-239):
| FileMaker Action | HTTP Method | Endpoint |
|-----------------|-------------|----------|
| READ (all) | GET | `/filemaker/{layout}/records` |
| READ (by ID) | GET | `/filemaker/{layout}/records/{recordId}` |
| READ (query) | POST | `/filemaker/{layout}/_find` |
| CREATE | POST | `/filemaker/{layout}/records` |
| UPDATE | PATCH | `/filemaker/{layout}/records/{recordId}` |
| DELETE | DELETE | `/filemaker/{layout}/records/{recordId}` |

**Authentication:**
- FileMaker Environment: No auth needed (trusted WebViewer context)
- Web App Environment: HMAC-SHA256 signature required (Bearer token)
  - Format: `Bearer {signature}.{timestamp}`
  - Message: `{timestamp}.{JSON.stringify(requestData)}`
  - Secret: `VITE_SECRET_KEY` from environment

## Data Flow Patterns

### FileMaker-Primary Pattern (Current State)

**Path 1: FileMaker WebViewer Environment**
```
UI Component
    ↓
useCustomer Hook (state management)
    ↓
API Layer (src/api/customers.js)
    ↓
fileMaker.js → fetchDataFromFileMaker()
    ↓
Environment Detection: isFileMakerEnvironment() = true
    ↓
handleFileMakerNativeCall() → fm-gofer bridge
    ↓
FileMaker WebViewer (PerformScript)
    ↓
FileMaker Data API
    ↓
FileMaker Database (devCustomers layout)
```

**Path 2: Web App Environment**
```
UI Component
    ↓
useCustomer Hook (state management)
    ↓
API Layer (src/api/customers.js)
    ↓
fileMaker.js → fetchDataFromFileMaker()
    ↓
Environment Detection: isFileMakerEnvironment() = false
    ↓
callBackendAPI() → Convert FM params to REST
    ↓
Backend API (https://api.claritybusinesssolutions.ca/filemaker/devCustomers/...)
    ↓ (HMAC Auth)
FileMaker Data API (server-side)
    ↓
FileMaker Database (devCustomers layout)
```

### ID Usage Patterns

**FileMaker `__ID`** (UUID):
- Used for: Querying customers (`fetchCustomers`, `fetchCustomerById`)
- Stored in UI state as: `customer.id`
- Maps to: Supabase `customers.id`

**FileMaker `recordId`** (Internal FM record ID):
- Used for: Updates and deletes (`updateCustomer`, `toggleCustomerStatus`, `deleteCustomer`)
- Stored in UI state as: `customer.recordId`
- **No Supabase equivalent** - internal to FileMaker

**Problem**: Inconsistent usage causes confusion:
- `fetchCustomerById(customerId)` expects `__ID`
- `updateCustomer(customerId, data)` expects `recordId`
- `handleCustomerStatusToggle(recordId, active)` expects `recordId`

## FileMaker Layout: devCustomers

### Known Fields (from code inspection)

**Core Fields:**
- `__ID` (text/UUID) - Primary identifier, globally unique
- `Name` (text) - Customer name (business name)
- `Email` (text) - Email address
- `Phone` (text) - Phone number
- `f_active` (text: "1" or "0") - Active status (boolean as string)
- `ContactPerson` (text) - Contact person name

**Address Fields:**
- `Address` (text) - Street address
- `City` (text) - City
- `State` (text) - State/Province
- `PostalCode` (text) - Postal/Zip code
- `Country` (text) - Country

**System Fields:**
- `~creationTimestamp` (timestamp) - Created timestamp
- `~modificationTimestamp` (timestamp) - Last modified timestamp
- `recordId` (internal) - FileMaker record ID

### Unknown Fields (may exist)

Based on typical CRM systems, may include:
- Industry/Vertical
- Account Manager/Owner
- Customer Type (residential, commercial, enterprise)
- Tags/Categories
- Custom fields

**Action Item**: Full field audit needed from FileMaker layout to ensure complete migration.

## Supabase Schema (Current State)

### customers table

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY,                    -- Maps to FileMaker __ID
  name TEXT,                              -- ⚠️ Not currently populated (legacy field)
  business_name TEXT,                     -- Maps to FileMaker Name
  first_name TEXT,                        -- Not used in FileMaker integration
  last_name TEXT,                         -- Not used in FileMaker integration
  type customertype NOT NULL,             -- Hardcoded as 'CUSTOMER' in dual-write
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### customer_email table

```sql
CREATE TABLE customer_email (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### customer_phone table

```sql
CREATE TABLE customer_phone (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id),
  phone TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### customer_address table

```sql
CREATE TABLE customer_address (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id),
  address_line1 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### customer_organization table (many-to-many)

```sql
CREATE TABLE customer_organization (
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (customer_id, organization_id)
);
```

### Related Tables (not directly managed by customer code)

- `customer_contacts` - Contact persons (1:many) - **Not currently populated**
- `customer_settings` - Customer-specific settings - **Not currently used**
- `customer_sales` - Financial records (1:many) - **Managed by financial/timer code**
- `customer_user` - User associations (many:many)
- `service_agreements` - Service contracts (1:many)
- `links` - URL links associated with customer
- `sms_participants` - SMS conversation participants

## Dual-Write Behavior Analysis

### When Dual-Write Occurs

✅ **Customer Update** (src/hooks/useCustomer.js:112-177):
- Triggered by: User edits customer details
- FileMaker operation: `UPDATE` on `devCustomers`
- Supabase operations:
  1. Update `customers.business_name`
  2. Update/Insert `customer_email`
  3. Update/Insert `customer_phone`
  4. Update/Insert `customer_address`
- Conditions: Only if `user.supabaseOrgID` exists
- Error handling: Logs warning if Supabase fails, doesn't fail entire operation

### When Dual-Write Does NOT Occur

❌ **Customer Create**:
- Only writes to FileMaker
- **Gap**: New customers not available in Supabase-dependent features

❌ **Customer Status Toggle**:
- Only updates FileMaker `f_active`
- **Gap**: Supabase `customers` table doesn't have active/status field

❌ **Customer Delete**:
- Only deletes from FileMaker
- **Gap**: Orphaned records in Supabase (customers, customer_email, customer_phone, customer_address)

### Dual-Write Consistency Issues

1. **Partial Failures**: If Supabase update fails, customer is in inconsistent state
   - FileMaker has new data
   - Supabase has old data
   - No retry mechanism
   - No reconciliation process

2. **Organization Scoping**: Customers created by users without `supabaseOrgID` are FileMaker-only
   - Creates "invisible" customers in Supabase-dependent features
   - No way to backfill these customers later

3. **ID Mismatch**:
   - Customer create uses FileMaker-generated UUID for `__ID`
   - Supabase customer would use same UUID (if dual-write existed)
   - But since create doesn't dual-write, IDs can diverge

## Edge Cases & Current Limitations

### 1. Concurrent Updates
- **Scenario**: Two users edit same customer simultaneously
- **Current Behavior**: Last write wins (both FileMaker and Supabase)
- **Problem**: No optimistic locking, no conflict detection
- **Impact**: Data loss on race conditions

### 2. Offline/Network Failures
- **Scenario**: Network fails after FileMaker update, before Supabase update
- **Current Behavior**: FileMaker updated, Supabase stale
- **Problem**: No retry mechanism, no queue
- **Impact**: Data inconsistency persists until next update

### 3. Customer Without Supabase OrgID
- **Scenario**: User without `supabaseOrgID` creates/updates customer
- **Current Behavior**: FileMaker-only operation
- **Problem**: Customer invisible to Supabase-dependent features
- **Impact**: Broken workflows (financial reports, proposals, etc.)

### 4. FileMaker recordId vs __ID
- **Scenario**: Code uses wrong ID for operation
- **Current Behavior**: API call fails or operates on wrong record
- **Problem**: Inconsistent ID usage across codebase
- **Impact**: Bugs in update/delete operations

### 5. Related Data Not Synced
- **Scenario**: Customer has multiple emails/phones in FileMaker (unclear if supported)
- **Current Behavior**: Only last email/phone synced to Supabase
- **Problem**: Dual-write assumes 1:1 relationships
- **Impact**: Data loss if FileMaker supports multiple emails/phones

### 6. Customer Deletion
- **Scenario**: Customer deleted from FileMaker
- **Current Behavior**: Supabase records orphaned
- **Problem**: No cascading delete, no cleanup
- **Impact**: Stale data, referential integrity issues

## Performance Characteristics

### Current Performance (FileMaker-Primary)

**Customer List Load** (`loadCustomers`):
- FileMaker API call: ~200-500ms (depends on network + FM server load)
- Processing: ~10-50ms (processCustomerData + sortCustomers)
- **Total**: ~250-550ms for ~50 customers

**Customer Detail Load** (`handleCustomerSelect`):
- FileMaker API call: ~100-300ms (single record query)
- Processing: ~5-10ms
- **Total**: ~105-310ms

**Customer Update** (`handleCustomerUpdate`):
- FileMaker update: ~150-400ms
- Supabase update (if org scoped):
  - customers table update: ~100-200ms
  - email query + update/insert: ~100-200ms
  - phone query + update/insert: ~100-200ms
  - address query + update/insert: ~100-200ms
  - **Total Supabase**: ~400-800ms (sequential operations)
- **Total**: ~550-1200ms

**Performance Issues**:
1. Supabase updates are sequential (not batched)
2. Query-then-update pattern for email/phone/address (N+1 queries)
3. No caching of customer list (always fetch from FileMaker)

## Dependencies on Customer Data

### Features That Query Customers

1. **Projects** - Foreign key to customer
   - Uses customer data for project creation
   - Displays customer name in project details

2. **Tasks** - Indirect via projects
   - Timer tracks time against customer (via project)

3. **Financial Records** - Foreign key to customer
   - Billing tied to customer
   - Financial reports group by customer

4. **Proposals** - Associated with customer
   - Proposal creation requires customer selection

5. **Notes/Links** - Can be associated with customer

## Code References Summary

| File | Lines | Purpose |
|------|-------|---------|
| `src/api/customers.js` | 135 | FileMaker API calls |
| `src/services/customerService.js` | 162 | Business logic, validation, formatting |
| `src/hooks/useCustomer.js` | 268 | Main customer hook, backend API operations |
| `src/services/dualWriteService.js` | 359 | Generic dual-write (not used for customers) |
| `src/components/customers/CustomerDetails.jsx` | ~300 | Customer detail view |
| `src/components/customers/CustomerForm.jsx` | ~200 | Create/edit form |
| `src/components/customers/CustomerHeader.jsx` | ~100 | Header with status toggle |
| `src/components/customers/CustomerTabs.jsx` | ~150 | Tab navigation |

**Total**: ~2,161 lines of customer-related code

## Backend FileMaker Proxy

The backend API provides FileMaker proxy endpoints that abstract the FileMaker Data API:

**Base URL**: `https://api.claritybusinesssolutions.ca/filemaker/`

**Available Endpoints** (inferred from src/api/fileMaker.js:104-148):
```
GET    /filemaker/{layout}/records              - List all records (limit: 100)
GET    /filemaker/{layout}/records/{recordId}   - Get specific record
POST   /filemaker/{layout}/_find                - Find records with query
POST   /filemaker/{layout}/records              - Create record
PATCH  /filemaker/{layout}/records/{recordId}   - Update record
DELETE /filemaker/{layout}/records/{recordId}   - Delete record
```

**Request Format** (CREATE/UPDATE):
```json
{
  "fields": {
    "Name": "Acme Corp",
    "Email": "contact@acme.com",
    "f_active": "1"
  }
}
```

**Response Format** (FileMaker-compatible):
```json
{
  "response": {
    "recordId": "123",
    "data": [
      {
        "fieldData": { ... },
        "recordId": "123"
      }
    ],
    "dataInfo": {}
  },
  "messages": [{ "code": "0", "message": "OK" }]
}
```

**Authentication**: HMAC-SHA256 signature in Authorization header

**Error Responses**:
- 403: Authentication failure (invalid HMAC)
- 404: Record not found
- 500: FileMaker server error

## Security Considerations

### HMAC Authentication

**Implementation** (src/api/fileMaker.js:43-86):
- Algorithm: HMAC-SHA256
- Message format: `{timestamp}.{JSON.stringify(requestData)}`
- Secret: `VITE_SECRET_KEY` environment variable
- Header format: `Bearer {hexSignature}.{timestamp}`

**Security Issues**:
1. **Client-Side Secret**: `VITE_SECRET_KEY` is bundled in frontend JavaScript
   - Visible in browser dev tools and source code
   - Anyone can generate valid HMAC signatures
   - Not suitable for production security
   - **Recommendation**: Use session-based JWT tokens instead

2. **No Timestamp Validation**: Backend doesn't validate timestamp freshness
   - Replay attacks possible
   - No expiration window enforced

3. **Fallback Modes**: Dev/fallback tokens used when crypto unavailable
   - Lines 47-49: `Bearer dev-token.{timestamp}`
   - Lines 54-56: `Bearer fallback-token.{timestamp}`
   - May bypass security if backend accepts these

### Environment Variable Exposure

**Frontend Environment Variables** (from CLAUDE.md):
- `VITE_SECRET_KEY` - HMAC secret (⚠️ client-exposed)
- `VITE_SUPABASE_ANON_KEY` - Supabase public key (expected)
- `VITE_SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key (⚠️ should be server-only)
- `VITE_FM_USER`, `VITE_FM_PASSWORD` - FileMaker credentials (⚠️ if used client-side)

**Security Risks**:
- Service role keys should NEVER be in frontend code
- FileMaker credentials should be server-only
- HMAC secrets are ineffective when client-exposed

## Next Steps

1. **Complete Field Audit**: Verify all FileMaker `devCustomers` fields
2. **Backend API Design**: Define unified endpoints to replace direct FM/Supabase calls
3. **Migration Strategy**: Plan data backfill from FileMaker to Supabase
4. **Fix Dual-Write Gaps**: Implement dual-write for create/delete operations
5. **Frontend Refactor**: Update hooks/components to use backend API
6. **Security Audit**: Review HMAC implementation and environment variable usage
