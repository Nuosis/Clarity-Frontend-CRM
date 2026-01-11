# Dual-Write Mechanism Documentation

**Version:** 1.0
**Last Updated:** 2026-01-10
**Status:** Current Implementation Analysis
**Related Documents:**
- FINANCIAL_RECORD_GENERATION.md (Timer stop flow)
- .devflow/tasks/customers-migration-requirements/dual-write-analysis.md (Customer dual-write pattern)
- TIMER_LIFECYCLE.md (Timer state machine)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [withDualWrite Wrapper](#withdualwrite-wrapper)
4. [Operation Types](#operation-types)
5. [Timer Stop Implementation](#timer-stop-implementation)
6. [Error Handling and Resilience](#error-handling-and-resilience)
7. [Configuration](#configuration)
8. [Current Usage Status](#current-usage-status)
9. [Code References](#code-references)

---

## Overview

### Purpose

The dual-write mechanism ensures data consistency between FileMaker (legacy system) and Supabase (target system) during the migration period. It provides a structured pattern for operations that must persist to both systems, with FileMaker as the primary source of truth.

### Design Philosophy

**FileMaker-First Strategy:**
- FileMaker operations execute first and must succeed
- Supabase writes are secondary and non-blocking
- FileMaker result is always returned, regardless of Supabase outcome
- Supabase failures are logged but do not fail the overall operation

**Current State (2026-01-10):**
- Service is **defined** but **not actively used** in production code
- No components currently call `stopTimerWithDualWrite()` or `withDualWrite()`
- Financial record synchronization happens through `createSaleFromFinancialRecord()` called directly from `taskService.stopTimer()`

---

## Architecture

### System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Application Layer                             │
│  (Components, Hooks, Services)                                   │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  │ Calls withDualWrite()
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              dualWriteService.js (Orchestration)                 │
│                                                                   │
│  ┌─────────────────────────────────────────────────┐            │
│  │ withDualWrite(fileMakerOperation, options)       │            │
│  │                                                   │            │
│  │  1. Execute FileMaker operation (REQUIRED)       │            │
│  │  2. Check if Supabase record needed              │            │
│  │  3. Execute Supabase operation (OPTIONAL)        │            │
│  │  4. Return result with dual-write metadata       │            │
│  └─────────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
        │                                              │
        │ FileMaker API Call                           │ Supabase API Call
        ▼                                              ▼
┌─────────────────┐                          ┌─────────────────────┐
│   FileMaker     │                          │      Supabase       │
│  (Primary DB)   │                          │   (Secondary DB)    │
│                 │                          │                     │
│  devRecords     │                          │  customer_sales     │
│  devCustomers   │                          │  customers          │
│  devProjects    │                          │  projects           │
│  devTasks       │                          │  tasks              │
└─────────────────┘                          └─────────────────────┘
```

### Data Flow Pattern

```
User Action (e.g., Timer Stop)
    ↓
taskService.stopTimer()
    ↓
FileMaker API: stopTaskTimerAPI()
    ↓
[Success?] ──No──> Return error
    │
   Yes
    ↓
taskService: Check fixed-price flag
    ↓
[Fixed-Price?] ──Yes──> Skip sales record creation
    │
   No
    ↓
salesService.createSaleFromFinancialRecord()
    ↓
Supabase: Insert customer_sales record
    ↓
[Success?] ──No──> Log error, return FileMaker result
    │
   Yes
    ↓
Return success with both results
```

---

## withDualWrite Wrapper

### Function Signature

**Location:** `src/services/dualWriteService.js:29-109`

```javascript
export async function withDualWrite(fileMakerOperation, options = {}) {
    const {
        operationType,      // 'timer_start' | 'timer_stop' | 'record_create' | 'record_update'
        organizationId,     // Supabase organization UUID
        recordData,         // Additional data for Supabase operation
        enableRollback = false  // Rollback flag (NOT IMPLEMENTED)
    } = options;

    // Returns:
    // {
    //     ...fileMakerResult,
    //     dualWrite: {
    //         success: true/false,
    //         supabaseResult: { ... },
    //         operationType: string,
    //         error?: string
    //     }
    // }
}
```

### Execution Steps

#### Step 1: Configuration Check

```javascript
if (!DUAL_WRITE_CONFIG.enabled) {
    console.log('[DualWrite] Dual-write disabled, executing FileMaker operation only');
    return await fileMakerOperation();
}
```

**Location:** `src/services/dualWriteService.js:37-40`

If dual-write is disabled globally, only FileMaker operation executes.

#### Step 2: Execute FileMaker Operation

```javascript
console.log('[DualWrite] Executing FileMaker operation...');
fileMakerResult = await fileMakerOperation();

// Check if FileMaker operation was successful
if (!fileMakerResult || (fileMakerResult.messages && fileMakerResult.messages[0]?.code !== '0')) {
    throw new Error(`FileMaker operation failed: ${fileMakerResult?.messages?.[0]?.message || 'Unknown error'}`);
}
```

**Location:** `src/services/dualWriteService.js:48-56`

**Critical Behavior:**
- FileMaker operation executes first
- FileMaker failure throws error immediately
- No Supabase operation attempted if FileMaker fails
- FileMaker success code must be '0'

#### Step 3: Determine if Supabase Record Needed

```javascript
if (shouldCreateSupabaseRecord(operationType, fileMakerResult)) {
    console.log('[DualWrite] Executing Supabase operation...');
    supabaseResult = await executeSupabaseOperation(operationType, {
        fileMakerResult,
        organizationId,
        recordData
    });
}
```

**Location:** `src/services/dualWriteService.js:59-66`

Uses `shouldCreateSupabaseRecord()` to determine if Supabase write is needed based on operation type and FileMaker result.

#### Step 4: Handle Supabase Operation

```javascript
if (!supabaseResult?.success) {
    rollbackNeeded = enableRollback;
    throw new Error(`Supabase operation failed: ${supabaseResult?.error || 'Unknown error'}`);
}
```

**Location:** `src/services/dualWriteService.js:67-70`

**Critical Behavior:**
- Supabase failure is caught in try/catch
- Error is logged but FileMaker result is still returned
- Rollback flag is set (but rollback is not implemented)

#### Step 5: Return Result

```javascript
// Success case
return {
    ...fileMakerResult,
    dualWrite: {
        success: true,
        supabaseResult,
        operationType
    }
};

// Error case
return {
    ...fileMakerResult,
    dualWrite: {
        success: false,
        error: error.message,
        supabaseResult,
        operationType,
        rollbackAttempted: rollbackNeeded
    }
};
```

**Location:** `src/services/dualWriteService.js:73-107`

**Result Structure:**
- Always includes original FileMaker result
- Adds `dualWrite` metadata object
- Indicates success/failure of dual-write coordination
- Includes Supabase result if attempted

---

## Operation Types

### Supported Operations

**Location:** `src/services/dualWriteService.js:117-138`

| Operation Type | FileMaker Action | Supabase Action | Status |
|---------------|------------------|-----------------|--------|
| `timer_start` | Create timer record in devRecords | Create `customer_sales` with status='active' | ✅ Implemented |
| `timer_stop` | Update timer record with end time | Create/update `customer_sales` with duration/amount | ✅ Implemented |
| `record_create` | Create billable record | Create corresponding Supabase record | ⚠️ Stub only |
| `record_update` | Update billable record | Update corresponding Supabase record | ⚠️ Stub only |

### Operation Decision Logic

**Function:** `shouldCreateSupabaseRecord(operationType, fileMakerResult)`

**Location:** `src/services/dualWriteService.js:117-138`

```javascript
function shouldCreateSupabaseRecord(operationType, fileMakerResult) {
    switch (operationType) {
        case 'timer_start':
            // Create Supabase record if timer was successfully started
            return fileMakerResult?.response && fileMakerResult.messages?.[0]?.code === '0';

        case 'timer_stop':
            // Only create Supabase record if timer was successfully stopped
            return fileMakerResult?.response && fileMakerResult.messages?.[0]?.code === '0';

        case 'record_create':
            // Create Supabase record for new billable records
            return fileMakerResult?.response?.recordId;

        case 'record_update':
            // Create/update Supabase record for updated billable records
            return fileMakerResult?.response;

        default:
            return false;
    }
}
```

**Decision Criteria:**
1. **timer_start/timer_stop**: Check for successful FileMaker response (code '0')
2. **record_create**: Check for presence of recordId in response
3. **record_update**: Check for presence of response object
4. **Unknown operations**: Return false (skip Supabase write)

---

## Timer Stop Implementation

### timer_stop Operation Type

The `timer_stop` operation is the most critical and fully-implemented dual-write pattern, as it creates billable customer_sales records from time tracking data.

### Handler Function

**Function:** `handleTimerStopSupabaseOperation(fileMakerResult, organizationId)`

**Location:** `src/services/dualWriteService.js:214-254`

#### Step 1: Extract Financial Record ID

```javascript
let financialId = null;

// Try to get financial ID from the response
if (fileMakerResult.response?.data?.[0]?.fieldData?.__ID) {
    financialId = fileMakerResult.response.data[0].fieldData.__ID;
} else if (fileMakerResult.response?.recordId) {
    // If we have recordId, we need to fetch the financial record to get the __ID
    const { fetchFinancialRecordByRecordId } = await import('../api/financialRecords');
    try {
        const financialRecord = await fetchFinancialRecordByRecordId(fileMakerResult.response.recordId);
        if (financialRecord?.response?.data?.[0]?.fieldData?.__ID) {
            financialId = financialRecord.response.data[0].fieldData.__ID;
        }
    } catch (fetchError) {
        console.error('[DualWrite] Error fetching financial record by recordId:', fetchError);
    }
}
```

**Location:** `src/services/dualWriteService.js:216-233`

**Logic:**
1. First try to extract `__ID` directly from FileMaker result
2. If not present, use `recordId` to fetch the full financial record
3. Extract `__ID` from the fetched record
4. If extraction fails at any point, throw error

#### Step 2: Validate Required Data

```javascript
if (!financialId) {
    throw new Error('Could not determine financial record ID from FileMaker result');
}

if (!organizationId) {
    throw new Error('Organization ID is required for Supabase operation');
}
```

**Location:** `src/services/dualWriteService.js:235-241`

**Validation:**
- `financialId` must be present (UUID from FileMaker `__ID` field)
- `organizationId` must be provided (UUID from user context)

#### Step 3: Create Customer Sales Record

```javascript
console.log(`[DualWrite] Creating sales record for financial ID: ${financialId}`);
return await createSaleFromFinancialRecord(financialId, organizationId);
```

**Location:** `src/services/dualWriteService.js:244-245`

Delegates to `salesService.createSaleFromFinancialRecord()` for the actual Supabase insertion.

### Convenience Function: stopTimerWithDualWrite

**Location:** `src/services/dualWriteService.js:292-320`

```javascript
export async function stopTimerWithDualWrite(params, organizationId = null) {
    const { stopTaskTimerAPI } = await import('../api/tasks');

    // Get organization ID from params or global state
    const orgId = organizationId || (window.state?.user?.supabaseOrgID);

    if (!orgId) {
        console.warn('[DualWrite] No organization ID found, proceeding with FileMaker-only operation');
    }

    return await withDualWrite(
        // FileMaker operation
        async () => {
            return await stopTaskTimerAPI(
                params.recordId,
                params.description,
                params.saveImmediately,
                params.totalPauseTime + params.adjustment
            );
        },
        // Dual-write options
        {
            operationType: 'timer_stop',
            organizationId: orgId,
            recordData: params,
            enableRollback: false // Rollback not implemented yet
        }
    );
}
```

**Purpose:** Provides a drop-in replacement for `stopTaskTimerAPI()` that includes dual-write coordination.

**Parameters:**
- `params.recordId` (string): Timer recordId to stop
- `params.description` (string): Work description
- `params.saveImmediately` (boolean): Skip description prompt
- `params.totalPauseTime` (number): Pause time in seconds
- `params.adjustment` (number): Time adjustment in seconds
- `organizationId` (string, optional): Supabase organization ID

**Organization ID Resolution:**
1. Use provided `organizationId` parameter if present
2. Fall back to `window.state?.user?.supabaseOrgID`
3. If neither available, log warning and proceed FileMaker-only

**Current Status:** ⚠️ **NOT USED** - No components call this function yet

---

## Error Handling and Resilience

### Error Scenarios

#### 1. FileMaker Operation Fails

**Behavior:**
```javascript
if (!fileMakerResult || (fileMakerResult.messages && fileMakerResult.messages[0]?.code !== '0')) {
    throw new Error(`FileMaker operation failed: ${fileMakerResult?.messages?.[0]?.message || 'Unknown error'}`);
}
```

**Location:** `src/services/dualWriteService.js:54-56`

**Result:**
- Error is thrown immediately
- No Supabase operation attempted
- Caller receives error
- No data written to either system

#### 2. Supabase Operation Fails

**Behavior:**
```javascript
try {
    supabaseResult = await executeSupabaseOperation(operationType, params);

    if (!supabaseResult?.success) {
        rollbackNeeded = enableRollback;
        throw new Error(`Supabase operation failed: ${supabaseResult?.error || 'Unknown error'}`);
    }
} catch (error) {
    console.error(`[DualWrite] Dual-write operation failed:`, error);

    return {
        ...fileMakerResult,
        dualWrite: {
            success: false,
            error: error.message,
            supabaseResult,
            operationType,
            rollbackAttempted: rollbackNeeded
        }
    };
}
```

**Location:** `src/services/dualWriteService.js:59-107`

**Result:**
- Error is caught and logged
- FileMaker result is returned successfully
- Caller receives FileMaker data with `dualWrite.success = false`
- Data written to FileMaker only (potential inconsistency)

#### 3. Missing Organization ID

**Behavior:**
```javascript
const orgId = organizationId || (window.state?.user?.supabaseOrgID);

if (!orgId) {
    console.warn('[DualWrite] No organization ID found, proceeding with FileMaker-only operation');
}
```

**Location:** `src/services/dualWriteService.js:296-299`

**Result:**
- Warning logged
- FileMaker operation proceeds
- Supabase operation will fail (caught and logged)
- FileMaker result returned successfully

#### 4. Financial Record ID Not Found

**Behavior:**
```javascript
if (!financialId) {
    throw new Error('Could not determine financial record ID from FileMaker result');
}
```

**Location:** `src/services/dualWriteService.js:235-237`

**Result:**
- Error is caught in try/catch
- FileMaker result returned with `dualWrite.success = false`
- No Supabase record created

### Rollback Mechanism

**Current Status:** ⚠️ **NOT IMPLEMENTED**

**Function:** `attemptRollback(operationType, fileMakerResult)`

**Location:** `src/services/dualWriteService.js:279-284`

```javascript
async function attemptRollback(operationType, fileMakerResult) {
    console.log(`[DualWrite] Rollback not implemented for operation: ${operationType}`);
    // Rollback implementation would depend on the specific operation
    // For timer operations, this might involve reversing the timer state
    // For record operations, this might involve deleting or reverting the record
}
```

**Note:** Rollback is logged but not executed. FileMaker changes are permanent even if Supabase fails.

### Retry Logic

**Current Status:** ⚠️ **NOT IMPLEMENTED**

**Configuration:**
```javascript
const DUAL_WRITE_CONFIG = {
    enabled: true,
    maxRetries: 3,        // Not currently used
    retryDelay: 1000,     // Not currently used
    timeout: 10000,       // Not currently used
};
```

**Location:** `src/services/dualWriteService.js:10-18`

**Note:** Retry configuration exists but is not implemented in the code flow.

---

## Configuration

### Global Configuration Object

**Location:** `src/services/dualWriteService.js:10-18`

```javascript
const DUAL_WRITE_CONFIG = {
    // Enable/disable dual writes globally
    enabled: true,

    // Retry configuration for failed Supabase writes (NOT IMPLEMENTED)
    maxRetries: 3,
    retryDelay: 1000,  // 1 second

    // Timeout for Supabase operations (NOT IMPLEMENTED)
    timeout: 10000,    // 10 seconds
};
```

### Configuration API

**Location:** `src/services/dualWriteService.js:325-351`

#### Enable/Disable Dual-Write

```javascript
import { dualWriteConfig } from './dualWriteService';

// Disable dual-write globally
dualWriteConfig.setEnabled(false);

// Enable dual-write globally
dualWriteConfig.setEnabled(true);
```

**Function:** `dualWriteConfig.setEnabled(enabled)`

**Location:** `src/services/dualWriteService.js:330-333`

**Effect:** When disabled, `withDualWrite()` executes only the FileMaker operation and returns immediately.

#### Get Current Configuration

```javascript
import { dualWriteConfig } from './dualWriteService';

const config = dualWriteConfig.getConfig();
console.log(config);
// {
//     enabled: true,
//     maxRetries: 3,
//     retryDelay: 1000,
//     timeout: 10000
// }
```

**Function:** `dualWriteConfig.getConfig()`

**Location:** `src/services/dualWriteService.js:339-341`

#### Update Retry Configuration

```javascript
import { dualWriteConfig } from './dualWriteService';

dualWriteConfig.setRetryConfig({
    maxRetries: 5,
    retryDelay: 2000,
    timeout: 15000
});
```

**Function:** `dualWriteConfig.setRetryConfig(retryConfig)`

**Location:** `src/services/dualWriteService.js:347-350`

**Note:** This updates the configuration object but retry logic is not implemented.

#### Check if Dual-Write is Enabled

```javascript
import { isDualWriteEnabled } from './dualWriteService';

if (isDualWriteEnabled()) {
    console.log('Dual-write is currently enabled');
}
```

**Function:** `isDualWriteEnabled()`

**Location:** `src/services/dualWriteService.js:357-359`

---

## Current Usage Status

### Implementation Status

**Service Definition:** ✅ Complete
**Active Usage:** ❌ Not used in production code
**Alternative Pattern:** ✅ Direct `createSaleFromFinancialRecord()` calls

### Actual Timer Stop Flow (Current Production)

**Location:** `src/services/taskService.js:67-131`

```javascript
export async function stopTimer(params, organizationId = null) {
    // 1. Stop timer in FileMaker
    const result = await stopTaskTimerAPI(
        params.recordId,
        params.description,
        params.saveImmediately,
        params.totalPauseTime + params.adjustment
    );

    // 2. If successful, create customer_sales record
    if (result && result.response) {
        const orgId = organizationId || (window.state?.user?.supabaseOrgID);

        if (!orgId) {
            console.warn('No organization ID found, skipping sales record creation');
            return result;
        }

        // 3. Fetch financial record and check fixed-price flag
        let financialId;
        try {
            const financialRecord = await fetchFinancialRecordByRecordId(params.recordId);
            if (financialRecord?.response?.data?.[0]) {
                financialId = financialRecord.response.data[0].fieldData.__ID;

                // Check if fixed-price project
                const fixedPrice = parseFloat(
                    financialRecord.response.data[0].fieldData["customers_Projects::f_fixedPrice"] || 0
                );

                if (fixedPrice > 0) {
                    console.log('Skipping sales record creation for fixed-price project');
                    financialId = null;
                }
            }
        } catch (fetchError) {
            console.error('Error fetching financial record by recordId:', fetchError);
        }

        // 4. Create sales record if financialId exists
        if (financialId) {
            try {
                const salesResult = await createSaleFromFinancialRecord(financialId, orgId);
                console.log('Sales record created:', salesResult);
            } catch (salesError) {
                console.error('Failed to create sales record:', salesError);
                // Continue despite error - FileMaker operation succeeded
            }
        }
    }

    return result;
}
```

**Pattern:**
1. FileMaker operation first
2. Check fixed-price flag
3. Call `createSaleFromFinancialRecord()` directly
4. Errors logged but don't fail operation

**Why Not Using `withDualWrite()`:**
- Fixed-price detection happens before Supabase write
- `withDualWrite()` doesn't support conditional writes based on business logic
- Current pattern provides more control over when Supabase writes occur

### Search Results for Usage

**Command:** `grep -r "withDualWrite\|stopTimerWithDualWrite" src/`

**Files Found:**
- `src/services/dualWriteService.js` (definition only)

**Files NOT Found:**
- No components use `stopTimerWithDualWrite()`
- No services call `withDualWrite()` directly
- No hooks reference dual-write functions

---

## Code References

### Core Functions

| Function | File | Lines | Purpose |
|----------|------|-------|---------|
| `withDualWrite` | src/services/dualWriteService.js | 29-109 | Main dual-write wrapper |
| `shouldCreateSupabaseRecord` | src/services/dualWriteService.js | 117-138 | Determine if Supabase write needed |
| `executeSupabaseOperation` | src/services/dualWriteService.js | 146-163 | Route to operation-specific handler |
| `handleTimerStartSupabaseOperation` | src/services/dualWriteService.js | 172-206 | Timer start Supabase logic |
| `handleTimerStopSupabaseOperation` | src/services/dualWriteService.js | 214-254 | Timer stop Supabase logic |
| `handleRecordSupabaseOperation` | src/services/dualWriteService.js | 263-271 | Generic record operation (stub) |
| `attemptRollback` | src/services/dualWriteService.js | 279-284 | Rollback handler (not implemented) |
| `stopTimerWithDualWrite` | src/services/dualWriteService.js | 292-320 | Convenience function for timer stop |
| `dualWriteConfig.setEnabled` | src/services/dualWriteService.js | 330-333 | Enable/disable dual-write |
| `dualWriteConfig.getConfig` | src/services/dualWriteService.js | 339-341 | Get current configuration |
| `dualWriteConfig.setRetryConfig` | src/services/dualWriteService.js | 347-350 | Update retry settings |
| `isDualWriteEnabled` | src/services/dualWriteService.js | 357-359 | Check if dual-write enabled |

### Related Functions (Actual Production Pattern)

| Function | File | Lines | Purpose |
|----------|------|-------|---------|
| `stopTimer` | src/services/taskService.js | 67-131 | Actual timer stop orchestration |
| `createSaleFromFinancialRecord` | src/services/salesService.js | 1383-1524 | Create customer_sales from financial record |
| `fetchFinancialRecordByRecordId` | src/api/financialRecords.js | 336-348 | Get financial record by recordId |
| `stopTaskTimerAPI` | src/api/tasks.js | 189-213 | FileMaker timer stop API call |

### Configuration Exports

```javascript
// From dualWriteService.js
export { withDualWrite };                    // Line 29
export { stopTimerWithDualWrite };           // Line 292
export { dualWriteConfig };                  // Line 325
export { isDualWriteEnabled };               // Line 357
```

### Import Usage Examples

```javascript
// Import the dual-write wrapper
import { withDualWrite } from './dualWriteService';

// Import the convenience function
import { stopTimerWithDualWrite } from './dualWriteService';

// Import configuration API
import { dualWriteConfig, isDualWriteEnabled } from './dualWriteService';

// Import for sales record creation (current pattern)
import { createSaleFromFinancialRecord } from './salesService';
```

---

## Migration Recommendations

### Short-Term (Current Phase)

1. **Continue using current pattern** in `taskService.stopTimer()`:
   - FileMaker operation first
   - Fixed-price detection
   - Direct `createSaleFromFinancialRecord()` call
   - Error handling without blocking FileMaker success

2. **Keep `withDualWrite()` available** for future operations that don't need custom business logic

3. **Document discrepancies** between FileMaker and Supabase for reconciliation

### Medium-Term (Migration Active)

1. **Implement retry logic** for failed Supabase writes:
   ```javascript
   // Add to executeSupabaseOperation()
   let retries = 0;
   while (retries < DUAL_WRITE_CONFIG.maxRetries) {
       try {
           return await performSupabaseWrite();
       } catch (error) {
           retries++;
           if (retries >= DUAL_WRITE_CONFIG.maxRetries) throw error;
           await sleep(DUAL_WRITE_CONFIG.retryDelay);
       }
   }
   ```

2. **Add reconciliation tracking**:
   - Log failed dual-writes to separate table
   - Background job to retry failed writes
   - Daily reconciliation report

3. **Implement timeouts** for Supabase operations

### Long-Term (Supabase Primary)

1. **Reverse the priority**:
   - Make Supabase the primary write target
   - Keep FileMaker writes as backup
   - Alert on FileMaker write failures

2. **Implement rollback logic**:
   - Delete/revert Supabase records if FileMaker fails
   - Maintain transaction integrity

3. **Phase out FileMaker writes**:
   - After validation period, stop writing to FileMaker
   - Keep FileMaker read-only for historical data

---

**End of Document**
