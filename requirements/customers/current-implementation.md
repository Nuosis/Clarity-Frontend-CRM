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
IF user.supabaseOrgID exists:
    ↓
    updateCustomerInSupabase(customerId, supabaseCustomerData, user)  [src/hooks/useSupabaseCustomer.js:203-367]
        ↓
        1. Update customers table (business_name)
            update('customers', { business_name: Name }, { id: customerId })  [supabaseService.js]
                ↓
            Backend API: POST /api/supabase/update
                ↓
            Supabase SQL: UPDATE customers SET business_name = $1 WHERE id = $2

        2. Update/Create customer_email
            query('customer_email', { filter: { customer_id: customerId } })
                ↓
            IF email exists:
                update('customer_email', { email }, { customer_id: customerId })
            ELSE:
                insert('customer_email', { customer_id, email, is_primary: true })

        3. Update/Create customer_phone
            query('customer_phone', { filter: { customer_id: customerId } })
                ↓
            IF phone exists:
                update('customer_phone', { phone }, { customer_id: customerId })
            ELSE:
                insert('customer_phone', { customer_id, phone, is_primary: true })

        4. Update/Create customer_address
            query('customer_address', { filter: { customer_id: customerId } })
                ↓
            IF address exists:
                update('customer_address', addressData, { customer_id: customerId })
            ELSE:
                insert('customer_address', { customer_id, ...addressData })
    ↓
    ✓ Supabase Update Successful (or warn if fails, don't fail entire operation)
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
  - `handleCustomerUpdate(customerId, customerData)` - Update customer + dual-write to Supabase
  - `handleCustomerStatusToggle(recordId, active)` - Toggle active status
  - `handleCustomerDelete(recordId)` - Delete customer
- **Dual-Write Logic**: Lines 112-177
  - Updates FileMaker first
  - If successful + `user.supabaseOrgID` exists → calls `updateCustomerInSupabase()`
  - Doesn't fail entire operation if Supabase update fails (logs warning)

**src/hooks/useSupabaseCustomer.js** (487 lines)
- **Supabase-specific operations** (not directly called by UI, used by useCustomer)
- `createCustomerInSupabase(customer, user)`:
  - Creates customer record (id, business_name, type='CUSTOMER')
  - Links to organization (customer_organization table)
  - Creates related records (email, phone, address)
- `updateCustomerInSupabase(customerId, customer, user)`:
  - Updates customers.business_name
  - Updates/creates customer_email (query first, update or insert)
  - Updates/creates customer_phone (query first, update or insert)
  - Updates/creates customer_address (query first, update or insert)
- `fetchOrCreateCustomerInSupabase(customer, user)`:
  - Query customers by business_name
  - If not found → create customer
  - If found → ensure linked to organization

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

**src/api/fileMaker.js**
- `fetchDataFromFileMaker(params)` - Low-level FileMaker bridge call
- Uses fm-gofer library to communicate with FileMaker WebViewer
- Handles authentication, layout routing, query formatting

### Layer 5: Supabase Service

**src/services/supabaseService.js**
- Singleton service for Supabase operations
- Generic CRUD operations: `query()`, `insert()`, `update()`, `remove()`
- Routes through backend API for HMAC authentication:
  - Frontend → Backend API (`/api/supabase/{operation}`) → Supabase
  - HMAC signature validation on backend
- No customer-specific logic (generic table operations)

## Data Flow Patterns

### FileMaker-Primary Pattern (Current State)

```
UI Component
    ↓
useCustomer Hook (state management)
    ↓
API Layer (src/api/customers.js)
    ↓
FileMaker Bridge (fm-gofer)
    ↓
FileMaker Data API
    ↓
FileMaker Database (devCustomers layout)

[Optional Dual-Write on Update Only]
    ↓
useSupabaseCustomer Hook
    ↓
supabaseService.js (generic CRUD)
    ↓
Backend API (/api/supabase/update)
    ↓
Supabase Database (customers + related tables)
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

### Impact of Missing Dual-Write

If customer is FileMaker-only (not in Supabase):
- Can't create proposals (requires Supabase customer_id)
- Financial reports won't show customer data
- Can't associate notes/links in Supabase

## Code References Summary

| File | Lines | Purpose |
|------|-------|---------|
| `src/api/customers.js` | 135 | FileMaker API calls |
| `src/services/customerService.js` | 162 | Business logic, validation, formatting |
| `src/hooks/useCustomer.js` | 268 | Main customer hook, dual-write on update |
| `src/hooks/useSupabaseCustomer.js` | 487 | Supabase operations for customers |
| `src/services/dualWriteService.js` | 359 | Generic dual-write (not used for customers) |
| `src/components/customers/CustomerDetails.jsx` | ~300 | Customer detail view |
| `src/components/customers/CustomerForm.jsx` | ~200 | Create/edit form |
| `src/components/customers/CustomerHeader.jsx` | ~100 | Header with status toggle |
| `src/components/customers/CustomerTabs.jsx` | ~150 | Tab navigation |

**Total**: ~2,161 lines of customer-related code

## Next Steps

1. **Complete Field Audit**: Verify all FileMaker `devCustomers` fields
2. **Backend API Design**: Define unified endpoints to replace direct FM/Supabase calls
3. **Migration Strategy**: Plan data backfill from FileMaker to Supabase
4. **Fix Dual-Write Gaps**: Implement dual-write for create/delete operations
5. **Frontend Refactor**: Update hooks/components to use backend API
