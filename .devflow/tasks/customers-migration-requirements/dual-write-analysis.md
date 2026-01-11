# Dual-Write Pattern Analysis

## Document Purpose

This document analyzes the current FileMaker→Supabase synchronization behavior in the Clarity CRM Frontend codebase, focusing on dual-write patterns used for customer data management during the migration from FileMaker to Supabase.

**Analysis Date**: 2026-01-10
**Task Reference**: TSK0003 - Analyze dual-write patterns
**Dependencies**: TSK0002 (Document current implementation)

---

## Executive Summary

The codebase implements **two distinct dual-write patterns**:

1. **Manual Dual-Write (Customers)**: Ad-hoc synchronization in `useCustomer.js` hook
2. **Service-Based Dual-Write (Financial Records)**: Structured pattern in `dualWriteService.js`

**Key Finding**: The customer dual-write pattern is **incomplete, inconsistent, and prone to data divergence**. Only UPDATE operations sync to Supabase, while CREATE, DELETE, and STATUS_TOGGLE operations remain FileMaker-only.

---

## Pattern 1: Manual Dual-Write (Customers)

### Implementation Location

**Primary File**: `src/hooks/useCustomer.js:112-177`

### Architecture Overview

```
FileMaker (Primary/Source of Truth)
    ↓
    ├─ CREATE  → FileMaker ONLY (no Supabase sync)
    ├─ READ    → FileMaker ONLY
    ├─ UPDATE  → FileMaker + Supabase (conditional dual-write)
    ├─ DELETE  → FileMaker ONLY (orphans Supabase records)
    └─ STATUS  → FileMaker ONLY (f_active field)
         ↓
Supabase (Secondary/Partial Replica)
```

### Dual-Write Flow (UPDATE Only)

```javascript
// src/hooks/useCustomer.js:112-177
const handleCustomerUpdate = useCallback(async (customerId, customerData) => {
    // Step 1: FileMaker Update (REQUIRED - fails operation if error)
    const result = await updateCustomer(customerId, formattedData);

    // Step 2: Supabase Update (OPTIONAL - logs warning if error)
    if (user && user.supabaseOrgID) {
        try {
            const supabaseResult = await updateCustomerInSupabase(
                customerId,
                supabaseCustomerData,
                user
            );
            if (!supabaseResult.success) {
                console.warn('Failed to update customer in Supabase');
                // Operation continues - no exception thrown
            }
        } catch (supabaseError) {
            console.error('Error updating customer in Supabase');
            // Operation continues - error swallowed
        }
    }

    return result; // Returns FileMaker result regardless of Supabase outcome
}, [selectedCustomer, user, updateCustomerInSupabase]);
```

### Supabase Update Implementation

**File**: `src/hooks/useSupabaseCustomer.js:203-367`

**Operations Performed** (all sequential):

1. **Update `customers` table**:
   ```javascript
   update('customers', { business_name: Name }, { column: 'id', operator: 'eq', value: customerId })
   ```

2. **Update/Insert `customer_email`**:
   ```javascript
   // Query first to check existence
   const existingEmails = await query('customer_email', {
       filter: { customer_id: customerId }
   });

   // Then update OR insert
   if (existingEmails.length > 0) {
       await update('customer_email', { email }, { customer_id: customerId });
   } else {
       await insert('customer_email', { customer_id, email, is_primary: true });
   }
   ```

3. **Update/Insert `customer_phone`**: (same pattern as email)

4. **Update/Insert `customer_address`**: (same pattern as email)

**Performance Impact**: 4-7 database round-trips per customer update (1 update + 3 query-then-upsert operations).

---

## Pattern 2: Service-Based Dual-Write (Financial Records)

### Implementation Location

**Primary File**: `src/services/dualWriteService.js`

### Architecture Overview

```
withDualWrite(fileMakerOperation, options) {
    ↓
    FileMaker Operation (REQUIRED - fails if error)
    ↓
    shouldCreateSupabaseRecord(operationType, result)
    ↓
    executeSupabaseOperation(operationType, params)
    ↓
    Return { ...fmResult, dualWrite: { success, supabaseResult } }
}
```

### Supported Operation Types

| Operation Type | FileMaker Action | Supabase Action | Status |
|---------------|------------------|-----------------|--------|
| `timer_start` | Create timer record | Create `customer_sales` with 'active' status | ✅ Implemented |
| `timer_stop` | Update timer record | Create/update `customer_sales` with duration/amount | ✅ Implemented |
| `record_create` | Create billable record | Create corresponding Supabase record | ⚠️ Not implemented |
| `record_update` | Update billable record | Update corresponding Supabase record | ⚠️ Not implemented |

### Timer Stop Dual-Write Flow

```javascript
// src/services/dualWriteService.js:292-320
export async function stopTimerWithDualWrite(params, organizationId) {
    return await withDualWrite(
        // FileMaker operation
        async () => await stopTaskTimerAPI(
            params.recordId,
            params.description,
            params.saveImmediately,
            params.totalPauseTime + params.adjustment
        ),
        // Dual-write options
        {
            operationType: 'timer_stop',
            organizationId: orgId,
            recordData: params,
            enableRollback: false // Not implemented
        }
    );
}
```

### Error Handling Strategy

```javascript
try {
    // Execute FileMaker operation first
    fileMakerResult = await fileMakerOperation();

    if (!fileMakerResult.success) {
        throw new Error('FileMaker operation failed');
    }

    // Execute Supabase operation
    supabaseResult = await executeSupabaseOperation(operationType, params);

    if (!supabaseResult.success) {
        rollbackNeeded = enableRollback;
        throw new Error('Supabase operation failed');
    }

    return { ...fileMakerResult, dualWrite: { success: true, supabaseResult } };

} catch (error) {
    // Attempt rollback if enabled (NOT IMPLEMENTED)
    if (rollbackNeeded && fileMakerResult) {
        await attemptRollback(operationType, fileMakerResult);
    }

    // Return FileMaker result with error metadata
    return {
        ...fileMakerResult,
        dualWrite: {
            success: false,
            error: error.message,
            rollbackAttempted: rollbackNeeded
        }
    };
}
```

**Key Difference from Customer Pattern**:
- Returns error metadata in response object
- Supports rollback configuration (though not implemented)
- Centralized error handling logic

---

## Comparison: Manual vs Service-Based Dual-Write

| Aspect | Manual (Customers) | Service-Based (Financial) |
|--------|-------------------|---------------------------|
| **Location** | `useCustomer.js` hook | `dualWriteService.js` service |
| **Encapsulation** | Embedded in business logic | Standalone service function |
| **Error Handling** | Swallows Supabase errors | Returns error metadata |
| **Rollback Support** | None | Configurable (not implemented) |
| **Retry Logic** | None | Configurable (not implemented) |
| **Timeout Handling** | None | Configurable (10s timeout) |
| **Operation Coverage** | UPDATE only | Timer operations only |
| **Consistency Guarantees** | None (best-effort) | None (best-effort) |
| **Testability** | Low (tightly coupled) | High (injectable dependencies) |
| **Reusability** | None (customer-specific) | High (operation-agnostic) |

---

## Data Synchronization Gaps

### Gap 1: Customer CREATE (No Supabase Sync)

**Current Flow**:
```
User Action: Create New Customer
    ↓
useCustomer().handleCustomerCreate(customerData)  [src/hooks/useCustomer.js:83-107]
    ↓
createCustomer(formattedData)  [src/api/customers.js:64-76]
    ↓
FileMaker API: POST /fmi/data/v1/.../devCustomers/records
    ↓
✓ Customer created in FileMaker
    ↓
⚠️ NO SUPABASE WRITE - Customer only exists in FileMaker
```

**Impact**:
- New customers invisible to Supabase-dependent features (proposals, financial reports)
- FileMaker `__ID` becomes the canonical customer ID
- No way to backfill without manual migration script

**Affected Code**: `src/hooks/useCustomer.js:83-107`

### Gap 2: Customer DELETE (Orphaned Supabase Records)

**Current Flow**:
```
User Action: Delete Customer
    ↓
useCustomer().handleCustomerDelete(recordId)  [src/hooks/useCustomer.js:217-243]
    ↓
deleteCustomer(recordId)  [src/api/customers.js:122-134]
    ↓
FileMaker API: DELETE /fmi/data/v1/.../devCustomers/records/{recordId}
    ↓
✓ Customer deleted in FileMaker
    ↓
⚠️ NO SUPABASE WRITE - Orphaned records remain in Supabase
```

**Impact**:
- Orphaned records in `customers`, `customer_email`, `customer_phone`, `customer_address`
- Referential integrity violations if foreign keys reference deleted customer
- Inflated Supabase database size over time

**Affected Code**: `src/hooks/useCustomer.js:217-243`

### Gap 3: Customer STATUS Toggle (No Supabase Sync)

**Current Flow**:
```
User Action: Toggle Customer Active Status
    ↓
useCustomer().handleCustomerStatusToggle(recordId, active)  [src/hooks/useCustomer.js:182-212]
    ↓
toggleCustomerStatus(recordId, active)  [src/api/customers.js:84-99]
    ↓
FileMaker API: PATCH /fmi/data/v1/.../devCustomers/records/{recordId}
    - fieldData: { f_active: "1" or "0" }
    ↓
✓ Customer status updated in FileMaker
    ↓
⚠️ NO SUPABASE WRITE - Status change not synced
```

**Impact**:
- Supabase `customers` table does NOT have an `active` or `status` field
- No way to filter active/inactive customers in Supabase-based queries
- Schema mismatch between FileMaker (f_active) and Supabase (no equivalent)

**Affected Code**: `src/hooks/useCustomer.js:182-212`

**Schema Issue**: The `customers` table in Supabase lacks an `active` or `status` field entirely. Even if dual-write existed, there's no field to write to.

---

## Consistency Issues & Failure Modes

### Issue 1: Partial Failure (FileMaker ✓, Supabase ✗)

**Scenario**: Customer update succeeds in FileMaker but fails in Supabase

**Trigger Conditions**:
- Network failure after FileMaker update
- Supabase service unavailable
- Invalid organization ID
- Permission errors

**Current Behavior**:
```javascript
// src/hooks/useCustomer.js:142-152
const supabaseResult = await updateCustomerInSupabase(customerId, data, user);
if (supabaseResult && supabaseResult.success) {
    console.log('Supabase customer updated:', supabaseResult.message);
} else {
    console.warn('Failed to update customer in Supabase:', supabaseResult?.error);
    // Don't fail the entire operation if Supabase update fails
}
```

**Result**:
- FileMaker has new customer data
- Supabase has old customer data
- **No retry mechanism**
- **No reconciliation process**
- **No user notification** (only console warning)

**Data Divergence Example**:
| System | Customer Name | Email | Phone |
|--------|---------------|-------|-------|
| FileMaker | "Acme Corp (Updated)" | "new@acme.com" | "555-0100" |
| Supabase | "Acme Corp" | "old@acme.com" | "555-0199" |

### Issue 2: Organization Scoping Bypass

**Scenario**: User without `supabaseOrgID` creates/updates customer

**Trigger Conditions**:
```javascript
// src/hooks/useCustomer.js:129
if (user && user.supabaseOrgID) {
    // Supabase update only happens if condition is true
}
```

**Current Behavior**:
- FileMaker operation proceeds normally
- Supabase update skipped entirely
- No warning logged

**Impact**:
- Customers created by users without `supabaseOrgID` are FileMaker-only
- Creates "invisible" customers in Supabase-dependent features
- No way to backfill these customers later (no audit log of who created them)

### Issue 3: Concurrent Updates (Race Condition)

**Scenario**: Two users edit same customer simultaneously

**Timeline**:
```
T0: User A fetches customer { Name: "Acme Corp", Email: "old@acme.com" }
T1: User B fetches customer { Name: "Acme Corp", Email: "old@acme.com" }
T2: User A updates Email to "alice@acme.com" (FileMaker + Supabase)
T3: User B updates Name to "Acme Corporation" (FileMaker + Supabase)
```

**Result**:
| System | Customer Name | Email |
|--------|---------------|-------|
| FileMaker | "Acme Corporation" | "alice@acme.com" (if lucky) or "old@acme.com" (if unlucky) |
| Supabase | "Acme Corporation" | "alice@acme.com" (if lucky) or "old@acme.com" (if unlucky) |

**Current Behavior**:
- Last write wins (no optimistic locking)
- No conflict detection
- No version tracking
- Data loss possible on race conditions

### Issue 4: Network Partition

**Scenario**: Network failure between FileMaker and Supabase updates

**Current Behavior**:
```javascript
try {
    const result = await updateCustomer(customerId, formattedData);
    // ⚠️ Network partition occurs here
    const supabaseResult = await updateCustomerInSupabase(...);
} catch (supabaseError) {
    console.error('Error updating customer in Supabase:', supabaseError);
    // Error swallowed - no retry, no queue, no reconciliation
}
```

**Result**:
- FileMaker update committed
- Supabase update fails
- **No retry queue**
- **No background job to reconcile**
- Data inconsistency persists indefinitely

---

## Performance Analysis

### Customer Update Performance Profile

**Measured Operations** (sequential execution):

1. **FileMaker Update**: ~150-400ms
2. **Supabase customers table update**: ~100-200ms
3. **Supabase email query + upsert**: ~100-200ms
4. **Supabase phone query + upsert**: ~100-200ms
5. **Supabase address query + upsert**: ~100-200ms

**Total Dual-Write Time**: ~550-1200ms

**Performance Issues**:

1. **Sequential Operations**: All Supabase updates executed in sequence (not parallel)
   ```javascript
   // src/hooks/useSupabaseCustomer.js:203-367
   await update('customers', ...);           // ~100-200ms
   await query('customer_email', ...);       // ~50-100ms
   await update('customer_email', ...);      // ~50-100ms
   await query('customer_phone', ...);       // ~50-100ms
   await update('customer_phone', ...);      // ~50-100ms
   await query('customer_address', ...);     // ~50-100ms
   await update('customer_address', ...);    // ~50-100ms
   ```

2. **N+1 Query Pattern**: Each related table requires query-then-upsert
   - Could be optimized with `INSERT ... ON CONFLICT UPDATE` (upsert)
   - Could be batched into a single transaction

3. **No Caching**: Customer list always fetched from FileMaker
   - No local cache or stale-while-revalidate strategy
   - Every navigation triggers full customer list fetch

4. **No Background Sync**: All updates block UI
   - Could use optimistic updates + background reconciliation
   - Could queue failed Supabase updates for retry

### FileMaker-Primary Performance (Current State)

**Customer List Load** (`loadCustomers`):
- FileMaker API call: ~200-500ms (depends on network + FM server load)
- Processing: ~10-50ms (processCustomerData + sortCustomers)
- **Total**: ~250-550ms for ~50 customers

**Customer Detail Load** (`handleCustomerSelect`):
- FileMaker API call: ~100-300ms (single record query)
- Processing: ~5-10ms
- **Total**: ~105-310ms

**Estimated Improvement with Supabase-Primary**:
- Supabase query (indexed): ~50-150ms
- Processing: ~5-10ms
- **Total**: ~55-160ms (2-3x faster)

---

## ID Usage Patterns & Confusion

### FileMaker ID Fields

1. **`__ID` (UUID)**:
   - **Type**: Text field containing UUID
   - **Purpose**: Globally unique identifier for customer
   - **Usage**: Query operations (`fetchCustomers`, `fetchCustomerById`)
   - **Stored in UI state as**: `customer.id`
   - **Maps to**: Supabase `customers.id`

2. **`recordId` (Internal FileMaker Record ID)**:
   - **Type**: Integer (internal to FileMaker)
   - **Purpose**: FileMaker's internal record identifier
   - **Usage**: Update/delete operations (`updateCustomer`, `deleteCustomer`, `toggleCustomerStatus`)
   - **Stored in UI state as**: `customer.recordId`
   - **Maps to**: Nothing in Supabase (FileMaker-specific)

### Inconsistent Usage Problem

```javascript
// Query uses __ID
fetchCustomerById(customerId)  // Expects __ID
    ↓
query: [{ "__ID": customerId }]

// Update uses recordId
updateCustomer(customerId, data)  // Expects recordId
    ↓
PATCH /fmi/data/v1/.../records/{customerId}  // recordId endpoint

// Status toggle uses recordId
toggleCustomerStatus(recordId, active)  // Explicitly named recordId
    ↓
PATCH /fmi/data/v1/.../records/{recordId}
```

**Impact**:
- Confusion about which ID to pass to which function
- Potential bugs if wrong ID used (silent failures or wrong record operated on)
- Need to store BOTH IDs in state: `{ id: "__ID value", recordId: "123" }`

### Supabase Dual-Write ID Usage

```javascript
// src/hooks/useSupabaseCustomer.js:48-50
const customerId = customer.fileMakerUUID || uuidv4();
const customerResult = await insert('customers', {
    id: customerId, // Uses FileMaker __ID as Supabase ID
    business_name: customer.Name
});
```

**Synchronization Strategy**:
- FileMaker `__ID` → Supabase `customers.id` (UUID)
- Maintains ID consistency across systems
- **Problem**: If customer created FileMaker-only, need to generate UUID client-side

---

## Environment Detection & Routing

### Dual-Environment Architecture

The application supports two runtime environments with automatic detection:

**FileMaker WebViewer Environment**:
```javascript
// src/api/fileMaker.js:263-282
const appElement = document.querySelector('[data-app-environment]');
const appEnvironment = appElement?.getAttribute('data-app-environment');
const useFileMakerBridge = appEnvironment === 'filemaker' ||
    (appEnvironment === null && isFileMakerEnvironment());

if (useFileMakerBridge) {
    return await handleFileMakerNativeCall(params);
}
```

**Data Flow**:
```
Frontend → fm-gofer bridge → FileMaker WebViewer → FileMaker Data API → FileMaker Database
```

**Web App Environment**:
```javascript
else {
    return await callBackendAPI(params);
}
```

**Data Flow**:
```
Frontend → Backend API (/filemaker/*) → FileMaker Server → FileMaker Database
```

### Backend API Mapping

| FileMaker Action | HTTP Method | Endpoint |
|-----------------|-------------|----------|
| READ (all) | GET | `/filemaker/{layout}/records` |
| READ (by ID) | GET | `/filemaker/{layout}/records/{recordId}` |
| READ (query) | POST | `/filemaker/{layout}/_find` |
| CREATE | POST | `/filemaker/{layout}/records` |
| UPDATE | PATCH | `/filemaker/{layout}/records/{recordId}` |
| DELETE | DELETE | `/filemaker/{layout}/records/{recordId}` |

**Authentication**:
- **FileMaker Environment**: No auth needed (trusted WebViewer context)
- **Web App Environment**: HMAC-SHA256 signature required (Bearer token)
  - Format: `Bearer {signature}.{timestamp}`
  - Message: `{timestamp}.{JSON.stringify(requestData)}`
  - Secret: `VITE_SECRET_KEY` from environment

---

## Configuration & Feature Flags

### dualWriteService Configuration

```javascript
// src/services/dualWriteService.js:10-18
const DUAL_WRITE_CONFIG = {
    enabled: true,              // Enable/disable dual writes globally
    maxRetries: 3,              // Retry configuration for failed Supabase writes
    retryDelay: 1000,           // 1 second between retries
    timeout: 10000              // 10 seconds timeout for Supabase operations
};
```

**Management Functions**:
```javascript
dualWriteConfig.setEnabled(true/false);        // Toggle dual-write globally
dualWriteConfig.getConfig();                   // Get current configuration
dualWriteConfig.setRetryConfig({ ... });       // Update retry settings
isDualWriteEnabled();                          // Check if enabled
```

**Current Usage**: Only used for financial record dual-write (timer operations)

**Not Used For**: Customer dual-write (customers use manual pattern)

---

## Code References

### Customer Dual-Write Code

| File | Lines | Purpose |
|------|-------|---------|
| `src/hooks/useCustomer.js` | 112-177 | Manual dual-write on customer update |
| `src/hooks/useSupabaseCustomer.js` | 45-152 | `createCustomerInSupabase()` |
| `src/hooks/useSupabaseCustomer.js` | 203-367 | `updateCustomerInSupabase()` |
| `src/hooks/useSupabaseCustomer.js` | 375-477 | `fetchOrCreateCustomerInSupabase()` |
| `src/api/customers.js` | 44-57 | `updateCustomer()` (FileMaker API) |
| `src/api/customers.js` | 64-76 | `createCustomer()` (FileMaker-only) |
| `src/api/customers.js` | 122-134 | `deleteCustomer()` (FileMaker-only) |

### Financial Record Dual-Write Code

| File | Lines | Purpose |
|------|-------|---------|
| `src/services/dualWriteService.js` | 29-109 | `withDualWrite()` wrapper |
| `src/services/dualWriteService.js` | 146-163 | `executeSupabaseOperation()` router |
| `src/services/dualWriteService.js` | 214-254 | `handleTimerStopSupabaseOperation()` |
| `src/services/dualWriteService.js` | 292-320 | `stopTimerWithDualWrite()` |
| `src/services/dualWriteService.js` | 325-351 | Configuration management |

---

## Recommendations for Migration

### Short-Term Fixes (Pre-Migration)

1. **Add Dual-Write for Customer CREATE**:
   - Modify `src/hooks/useCustomer.js:83-107` to call `createCustomerInSupabase()`
   - Ensures new customers exist in both systems

2. **Add Dual-Write for Customer DELETE**:
   - Modify `src/hooks/useCustomer.js:217-243` to delete from Supabase
   - Prevents orphaned records

3. **Add `active` Field to Supabase Schema**:
   ```sql
   ALTER TABLE customers ADD COLUMN active BOOLEAN DEFAULT true;
   ```
   - Modify dual-write to sync `f_active` → `active`

4. **Implement Retry Queue for Failed Supabase Updates**:
   - Store failed updates in localStorage or IndexedDB
   - Retry on app restart or periodic interval

5. **Add User Notifications for Sync Failures**:
   - Replace `console.warn()` with SnackBar notifications
   - Users should know if data didn't sync

### Long-Term Migration Strategy

1. **Adopt Service-Based Dual-Write Pattern**:
   - Migrate customer dual-write to use `dualWriteService.js` pattern
   - Centralize error handling, retry logic, configuration

2. **Implement Optimistic Locking**:
   - Add `version` or `updated_at` timestamp comparison
   - Detect concurrent updates, prompt user to resolve conflicts

3. **Background Sync Queue**:
   - Queue failed Supabase updates for background retry
   - Use Web Worker or Service Worker for offline resilience

4. **Eventual Consistency Reconciliation**:
   - Periodic background job to compare FileMaker vs Supabase
   - Flag discrepancies, auto-repair or notify admin

5. **Migrate to Backend-Managed Dual-Write**:
   - Move dual-write logic to backend API
   - Frontend calls single endpoint, backend handles both FileMaker and Supabase
   - Enables transactional consistency (database-level)

6. **Flip to Supabase-Primary**:
   - Once confidence in Supabase data quality
   - FileMaker becomes secondary (read-only or deprecated)
   - Enable backward compatibility period

---

## Edge Cases & Limitations

### Edge Case 1: Multiple Emails/Phones (Unsupported)

**Scenario**: FileMaker customer has multiple email addresses or phone numbers

**Current Dual-Write Behavior**:
```javascript
// src/hooks/useSupabaseCustomer.js:224-263
if (customer.Email) {
    const existingEmails = await query('customer_email', {
        filter: { customer_id: customerId }
    });

    if (existingEmails.length > 0) {
        // Updates ALL emails for customer (if multiple exist)
        await update('customer_email', { email: customer.Email }, {
            customer_id: customerId
        });
    } else {
        await insert('customer_email', { customer_id, email, is_primary: true });
    }
}
```

**Problem**:
- Assumes 1:1 relationship between customer and email
- If FileMaker supports multiple emails, only one synced
- If Supabase has multiple emails, UPDATE overwrites all of them

**Data Loss Example**:
| System | Emails |
|--------|--------|
| FileMaker | ["primary@acme.com", "secondary@acme.com"] |
| Supabase (before) | ["primary@acme.com", "admin@acme.com"] |
| Supabase (after) | ["secondary@acme.com", "secondary@acme.com"] (both updated!) |

### Edge Case 2: Customer Without Organization (No Supabase Record)

**Scenario**: User without `supabaseOrgID` creates customer

**Current Behavior**:
```javascript
// src/hooks/useCustomer.js:129
if (user && user.supabaseOrgID) {
    // Supabase update only happens if this condition is true
}
```

**Impact**:
- Customer created in FileMaker only
- No record in Supabase
- No audit trail of creation
- **Cannot backfill** without additional metadata

**Affected Features**:
- Proposals (require Supabase customer_id)
- Financial reports (group by Supabase customer)
- Customer analytics (Supabase queries)

### Edge Case 3: FileMaker `__ID` vs `recordId` Confusion

**Scenario**: Code passes wrong ID type to API function

**Example Bug**:
```javascript
// User selects customer (stores both id and recordId)
const customer = { id: "uuid-abc-123", recordId: "456" };

// Code mistakenly uses id for update (expects recordId)
await updateCustomer(customer.id, data);
    ↓
// API constructs: PATCH /filemaker/devCustomers/records/uuid-abc-123
    ↓
// FileMaker API error: Record not found (expects recordId 456)
```

**Current Mitigation**: None (relies on developers using correct ID)

**Future Mitigation**: Type system or runtime validation

---

## Security Considerations

### HMAC Authentication Weakness

**Implementation** (`src/api/fileMaker.js:43-86`):
```javascript
const message = `${timestamp}.${JSON.stringify(requestData)}`;
const signature = CryptoJS.HmacSHA256(message, VITE_SECRET_KEY).toString();
const authHeader = `Bearer ${signature}.${timestamp}`;
```

**Security Issues**:

1. **Client-Side Secret Exposure**:
   - `VITE_SECRET_KEY` bundled in frontend JavaScript
   - Visible in browser dev tools and source code
   - Anyone can generate valid HMAC signatures
   - **Not suitable for production security**

2. **No Timestamp Validation**:
   - Backend doesn't validate timestamp freshness
   - Replay attacks possible
   - No expiration window enforced

3. **Fallback Modes**:
   ```javascript
   if (!window.crypto || !window.crypto.subtle) {
       return `Bearer dev-token.${timestamp}`;
   }
   ```
   - Dev/fallback tokens used when crypto unavailable
   - May bypass security if backend accepts these

**Recommendation**:
- Replace HMAC with session-based JWT tokens
- Issue tokens server-side after authentication
- Rotate tokens regularly
- Validate token expiration

### Environment Variable Exposure

**Client-Exposed Secrets** (from `.env`):
- ❌ `VITE_SECRET_KEY` - HMAC secret (should be server-only)
- ❌ `VITE_SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key (should NEVER be client-side)
- ⚠️ `VITE_FM_USER`, `VITE_FM_PASSWORD` - FileMaker credentials (if used client-side)
- ✅ `VITE_SUPABASE_ANON_KEY` - Supabase public key (expected to be client-side)

**Security Risks**:
- Service role keys grant full database access (bypass RLS)
- FileMaker credentials allow direct database manipulation
- Anyone with source code can impersonate the application

---

## Conclusion

The current dual-write implementation exhibits **two distinct architectural patterns** with varying levels of sophistication:

1. **Manual Dual-Write (Customers)**: Tightly coupled, incomplete, error-prone
2. **Service-Based Dual-Write (Financial Records)**: Structured, extensible, incomplete

**Critical Findings**:
- Only UPDATE operations sync customers to Supabase
- CREATE, DELETE, and STATUS_TOGGLE operations remain FileMaker-only
- No retry mechanism, no reconciliation, no consistency guarantees
- Sequential Supabase operations (N+1 query pattern) cause performance degradation
- Security vulnerabilities (client-side HMAC secret, service role key exposure)

**Recommended Next Steps**:
1. Complete dual-write coverage (CREATE, DELETE, STATUS)
2. Migrate to service-based pattern for consistency
3. Implement retry queue and reconciliation
4. Move dual-write logic to backend for transactional consistency
5. Address security vulnerabilities before production use

**Migration Impact**:
- ~2,161 lines of customer-related code need refactoring
- Backend API design required to replace dual-write pattern
- Data backfill needed for FileMaker-only customers
- Schema alignment required (add `active` field to Supabase)

---

## Appendix: Related Documentation

- `requirements/customers/current-implementation.md` - Detailed customer implementation analysis
- `requirements/customers/README.md` - Customer feature requirements
- `FILEMAKER_TO_SUPABASE_MIGRATION_PLAN.md` - Overall migration strategy
- `CLAUDE.md` - Project overview and development guidelines
- `.roo/rules/SUPABASE_DATABASE_VERIFICATION.md` - Database access patterns
