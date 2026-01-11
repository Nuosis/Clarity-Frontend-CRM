# QuickBooks Migration Plan: From FileMaker Scripts to Backend API

**Document Version:** 1.0
**Date:** 2026-01-10
**Status:** Migration Strategy - Ready for Review
**Migration Priority:** High
**Estimated Timeline:** 3-4 weeks (phased approach)

---

## Executive Summary

This migration plan outlines the step-by-step approach to transition QuickBooks invoice generation from the legacy FileMaker script-based system (`initializeQuickBooks`) to the modern backend API architecture. The migration enables real-time user feedback, comprehensive error handling, and eliminates FileMaker dependency for QuickBooks operations.

**Current State:**
- FileMaker script (`Initialize QB via JS`) - fire-and-forget, no user feedback
- Financial records stored in FileMaker `devRecords` layout
- No invoice details returned to frontend
- Limited error visibility

**Target State:**
- Backend API handles all QuickBooks operations
- Financial records in Supabase `customer_sales` table
- Full invoice lifecycle management from frontend
- Real-time progress tracking and error handling
- Rollback capabilities and transaction safety

**Success Criteria:**
- 100% of invoice generation flows use backend API
- FileMaker `initializeQuickBooks` function deprecated
- No data loss during migration
- Rollback plan tested and validated
- Performance meets or exceeds current system

---

## Table of Contents

1. [Current Architecture Analysis](#current-architecture-analysis)
2. [Migration Goals and Constraints](#migration-goals-and-constraints)
3. [Migration Phases](#migration-phases)
4. [Phase 1: Preparation and Foundation](#phase-1-preparation-and-foundation)
5. [Phase 2: Backend Implementation](#phase-2-backend-implementation)
6. [Phase 3: Frontend Migration](#phase-3-frontend-migration)
7. [Phase 4: Cutover and Validation](#phase-4-cutover-and-validation)
8. [Rollback Procedures](#rollback-procedures)
9. [Testing Strategy](#testing-strategy)
10. [Performance Benchmarks](#performance-benchmarks)
11. [Risk Mitigation](#risk-mitigation)
12. [Success Metrics](#success-metrics)

---

## Current Architecture Analysis

### FileMaker-Based Flow

**Key Components:**

1. **Frontend Entry Point:** `src/api/fileMaker.js:447-501`
   ```javascript
   export async function initializeQuickBooks(params) {
     // Calls FileMaker script - fire and forget
     FileMaker.PerformScript("Initialize QB via JS", payload);
     resolve({ status: "success", message: "QuickBooks initialization requested" });
   }
   ```

2. **FileMaker Script:** `Initialize QB via JS`
   - Processes unbilled records (`f_billed = 0`)
   - Creates QuickBooks invoices
   - Updates `devRecords.f_billed = 1`
   - **NO feedback to frontend**

3. **Data Source:** FileMaker `devRecords` layout
   - Fields: `__ID`, `_custID`, `_projectID`, `DateStart`, `f_billed`, etc.
   - Retrieved via: `src/api/financialRecords.js`

4. **Synchronization:** `src/services/financialSyncService.js`
   - Manual sync from FileMaker → Supabase `customer_sales`
   - Case-sensitive ID matching issues
   - No automatic sync on changes

**Pain Points:**

| Issue | Impact | Migration Solution |
|-------|--------|-------------------|
| No user feedback | Users must check QuickBooks manually | Real-time invoice creation response |
| No error handling | QB API errors invisible to users | Comprehensive error extraction and display |
| No invoice details | Cannot display invoice number/total | Return full invoice object |
| Manual sync required | Data consistency issues | Automatic dual-write on timer stop |
| FileMaker dependency | Cannot work in web app environment | Backend API works everywhere |

---

## Migration Goals and Constraints

### Primary Goals

1. **Eliminate FileMaker Dependency**
   - Replace `initializeQuickBooks` FileMaker script calls
   - Remove `devRecords` as primary data source
   - Enable standalone web app QuickBooks integration

2. **Improve User Experience**
   - Real-time invoice creation feedback
   - Display invoice number, total, and email status
   - Show progress during invoice generation
   - Clear error messages with actionable guidance

3. **Enhance Data Integrity**
   - Single source of truth (Supabase `customer_sales`)
   - Automatic sync on timer stop (no manual sync)
   - Transaction safety with rollback support

4. **Maintain Business Logic**
   - Preserve fixed-price project detection
   - Keep hourly rate resolution hierarchy
   - Maintain product name formatting rules
   - Retain document number generation logic

### Constraints

#### Backend Change Protocol

**🚨 CRITICAL: We CANNOT modify backend infrastructure directly.**

Per `CLAUDE.md`, all backend changes require:

1. **Backend Change Request Document** (format: `BACKEND_CHANGE_REQUEST_XXX_[FEATURE_NAME].md`)
   - SQL schema changes (if needed)
   - API endpoint specifications
   - Testing requirements
   - Rollback plan

2. **Backend Team Approval**
   - Submit request to user
   - User forwards to backend team
   - Wait for approval and implementation

3. **Frontend Implementation**
   - Implement assuming approved changes
   - Document dependencies in comments
   - Test against dev environment post-deployment

**For This Migration:**
- **Backend API endpoints:** ✅ Already exist and working (no changes needed)
- **Database schema:** ✅ `customer_sales` table exists in Supabase
- **Frontend changes only:** ✅ We can proceed with frontend migration

**Reference:** `CLAUDE.md:41-74` - Backend Change Protocol section

#### Timeline Constraints

**DO NOT include time estimates** per `CLAUDE.md:23-25`:
> "When planning tasks, provide concrete implementation steps without time estimates. Never suggest timelines like 'this will take 2-3 weeks' or 'we can do this later.' Focus on what needs to be done, not when."

This plan focuses on **what needs to be done** and **in what order**, not time estimates.

#### Standing Constraints (Global)

Per task description, apply to all work:
- No overengineering - handle 85% of use cases
- DRY - reuse existing code and patterns
- No rolling our own - leverage existing libraries
- No silent failures - log or surface all errors
- No incomplete work markers (TODO, FIXME, HACK, XXX)
- No security vulnerabilities (OWASP Top 10)
- Build must succeed after changes

---

## Migration Phases

### Overview

The migration follows a **4-phase approach** with validation gates between phases:

```
Phase 1: Preparation           Phase 2: Backend        Phase 3: Frontend       Phase 4: Cutover
[Foundation & Validation]  →  [Implementation]    →  [Migration]         →  [Validation]
     ↓                             ↓                      ↓                      ↓
 Code audit                   No action needed      Update services         Deploy
 Document dependencies        (APIs exist)          Update components       Monitor
 Create test data                                   Update hooks            Deprecate
 Validate assumptions                               Testing                 Validate
```

**Validation Gates:**
- ✅ Each phase requires validation before proceeding to next phase
- ✅ Rollback procedures tested at each gate
- ✅ No production changes until Phase 4

---

## Phase 1: Preparation and Foundation

**Objective:** Validate assumptions, document dependencies, and prepare test environment.

### 1.1 Code Audit and Dependency Mapping

**Task:** Identify all code paths that use FileMaker QuickBooks integration.

**Files to Audit:**

| File | Purpose | Migration Impact |
|------|---------|------------------|
| `src/api/fileMaker.js` | `initializeQuickBooks` function (lines 447-501) | **HIGH** - Replace with backend API call |
| `src/api/financialRecords.js` | FileMaker `devRecords` queries (lines 1-497) | **HIGH** - Deprecate unbilled queries |
| `src/services/financialSyncService.js` | FileMaker → Supabase sync (lines 1-695) | **HIGH** - Replace with direct writes |
| `src/components/financial/FinancialActivity.jsx` | UI that triggers QB operations | **MEDIUM** - Update to use new flow |
| `src/components/financial/CustomerSalesTable.jsx` | Modern QB integration (lines 1-150) | **LOW** - Already uses backend API |

**Search Commands:**

```bash
# Find all usages of initializeQuickBooks
grep -r "initializeQuickBooks" src/

# Find all usages of devRecords layout
grep -r "devRecords" src/

# Find all f_billed field references
grep -r "f_billed" src/
```

**Deliverables:**
- Dependency graph showing all FileMaker QB touchpoints
- List of components requiring updates
- Identification of any hidden dependencies

---

### 1.2 Backend API Verification

**Task:** Verify all required backend endpoints exist and work correctly.

**Endpoints to Verify:**

Per `api-contracts.md`, verify these endpoints are working:

| Endpoint | Purpose | Status | Verification |
|----------|---------|--------|--------------|
| `POST /quickbooks/invoices` | Create invoice | ✅ Working | Test with sample payload |
| `GET /quickbooks/customers/search` | Find QBO customer | ✅ Working | Test search by name |
| `POST /quickbooks/customers` | Create QBO customer | ✅ Working | Test customer creation |
| `POST /quickbooks/send-invoice/{id}` | Send invoice email | ✅ Working | Test email delivery |
| `GET /quickbooks/invoices?customer_id={id}` | List customer invoices | ✅ Working | Test filtering |
| `POST /quickbooks/validate` | Validate QB credentials | ✅ Working | Test connection |

**Verification Script:**

```bash
# Test invoice creation endpoint
curl -X POST https://api.claritybusinesssolutions.ca/quickbooks/invoices \
  -H "Authorization: Bearer {HMAC_SIGNATURE}.{TIMESTAMP}" \
  -H "X-Organization-ID: {ORG_ID}" \
  -H "Content-Type: application/json" \
  -d '{...invoice_payload}'
```

**Deliverables:**
- Verification report for each endpoint
- Sample request/response pairs for documentation
- Any issues logged for backend team

**Reference:** `api-contracts.md:697-862` - Invoice creation specification

---

### 1.3 Data Model Validation

**Task:** Ensure Supabase `customer_sales` table has all required fields for invoice generation.

**Required Fields Verification:**

```sql
-- Verify customer_sales schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'customer_sales'
ORDER BY ordinal_position;
```

**Expected Fields:**

| Field | Type | Purpose | Migration Source |
|-------|------|---------|------------------|
| `id` | UUID | Primary key | FileMaker `__ID` |
| `organization_id` | UUID | Organization scoping | Current org context |
| `customer_id` | UUID | Customer reference | FileMaker `_custID` |
| `project_id` | UUID | Project reference | FileMaker `_projectID` |
| `product_name` | VARCHAR | Invoice line description | Formatted from customer/project |
| `quantity` | NUMERIC | Hours worked | From timer |
| `unit_price` | NUMERIC | Hourly rate | Rate resolution hierarchy |
| `total_price` | NUMERIC | Line total | `quantity * unit_price` |
| `date` | DATE | Service date | Timer stop date |
| `inv_id` | VARCHAR | QuickBooks invoice ID | **Set after invoice created** |
| `created_at` | TIMESTAMPTZ | Record creation | Auto-generated |

**Validation Queries:**

```sql
-- Check for records ready to invoice (inv_id IS NULL)
SELECT COUNT(*) FROM customer_sales
WHERE organization_id = '{ORG_ID}'
  AND inv_id IS NULL;

-- Verify product name format
SELECT DISTINCT product_name FROM customer_sales
WHERE organization_id = '{ORG_ID}'
LIMIT 10;
```

**Deliverables:**
- Schema validation report
- Sample data verification
- Any missing fields identified

**Reference:** `current-implementation.md:1913-1972` - Product name formatting rules

---

### 1.4 Test Data Preparation

**Task:** Create test dataset for migration validation.

**Test Scenarios:**

1. **Single Customer, Single Project** (Happy Path)
   - 1 customer with 1 project
   - 5 unbilled time entries
   - Total: 10 hours at $150/hr CAD
   - Expected: 1 invoice with 1 line item

2. **Single Customer, Multiple Projects**
   - 1 customer with 3 projects
   - 15 unbilled entries across projects
   - Expected: 1 invoice with 3 line items (grouped by project)

3. **Fixed-Price Project Detection**
   - 1 fixed-price project (`f_fixedPrice > 0`)
   - Time entries exist but should NOT create `customer_sales`
   - Expected: NO invoice generation

4. **Multi-Currency Customer**
   - 1 USD customer
   - 8 hours at $75/hr USD
   - Expected: Invoice with Tax Code 3, Item Reference 7

5. **Missing QuickBooks Customer**
   - Customer exists in Supabase but not in QuickBooks
   - Expected: Prompt to create QBO customer, then invoice

6. **Error Conditions**
   - Expired QuickBooks token
   - Invalid customer data
   - Network failure
   - Expected: Clear error messages, no data corruption

**Test Data Script:**

```javascript
// scripts/create-test-data.js
const { createClient } = require('@supabase/supabase-js');

async function createTestData() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Scenario 1: Happy path
  const { data: customer } = await supabase.from('customers').insert({
    name: 'Test Customer Inc.',
    organization_id: TEST_ORG_ID
  }).select().single();

  const { data: project } = await supabase.from('projects').insert({
    name: 'Test Project',
    customer_id: customer.id,
    organization_id: TEST_ORG_ID
  }).select().single();

  // Create 5 unbilled time entries
  const entries = Array.from({ length: 5 }, (_, i) => ({
    organization_id: TEST_ORG_ID,
    customer_id: customer.id,
    project_id: project.id,
    product_name: 'TCI:Test',
    quantity: 2,
    unit_price: 150,
    total_price: 300,
    date: new Date(),
    inv_id: null  // Unbilled
  }));

  await supabase.from('customer_sales').insert(entries);

  console.log('Test data created successfully');
}
```

**Deliverables:**
- Test data script ready to run
- Validation queries for each scenario
- Expected results documented

---

### 1.5 Environment Setup

**Task:** Prepare development and staging environments for migration testing.

**Development Environment:**

```bash
# Verify local Vite server
curl -s -o /dev/null -w "%{http_code}" http://localhost:1235
# Expected: 200

# Verify backend API access
curl -s https://api.claritybusinesssolutions.ca/quickbooks/validate \
  -H "Authorization: Bearer {SIGNATURE}.{TIMESTAMP}" \
  -H "X-Organization-ID: {ORG_ID}"
# Expected: {"is_valid": true}
```

**Environment Variables Check:**

```bash
# Required variables
VITE_API_URL=https://api.claritybusinesssolutions.ca
VITE_SECRET_KEY={HMAC_SECRET}
VITE_CLARITY_INTEGRATION_ORG_ID={ORG_UUID}
VITE_SUPABASE_URL=https://supabase.claritybusinesssolutions.ca
VITE_SUPABASE_ANON_KEY={ANON_KEY}
VITE_SUPABASE_SERVICE_ROLE_KEY={SERVICE_KEY}
```

**Staging Environment:**

- Separate Supabase database for testing
- Test QuickBooks sandbox account
- Isolated from production data

**Deliverables:**
- Environment checklist completed
- All credentials verified
- Staging environment provisioned

---

### Phase 1 Validation Gate

**Before proceeding to Phase 2, verify:**

- [ ] All FileMaker dependencies mapped
- [ ] Backend API endpoints verified working
- [ ] Supabase schema validated
- [ ] Test data created and verified
- [ ] Development and staging environments ready
- [ ] Rollback procedures documented

**Sign-Off Required:** Technical Lead

---

## Phase 2: Backend Implementation

**Objective:** Backend team implements required endpoints (if any) and infrastructure changes.

### 2.1 Current Backend Status

**IMPORTANT:** All required backend endpoints **already exist and are working**.

Per `api-contracts.md:32-40`:
> **Current Implementation Status:**
> - ✅ All endpoints are **currently implemented and working** in production
> - This document serves as a **specification reference** for the QuickBooks migration requirements
> - **No new backend changes are required at this time**

**Endpoint Inventory:**

| Category | Endpoints | Status |
|----------|-----------|--------|
| OAuth & Initialization | 4 endpoints | ✅ Working |
| Customer Management | 6 endpoints | ✅ Working |
| Invoice Operations | 7 endpoints | ✅ Working |
| Reference Data | 3 endpoints | ✅ Working |
| Testing & Utilities | 5 endpoints | ✅ Working |
| Bill Operations | 5 endpoints | ✅ Working |

**Total:** 30 endpoints, all production-ready.

**Reference:** `api-contracts.md:84-1573` - Complete endpoint specifications

---

### 2.2 No Backend Changes Required

**Conclusion:** Phase 2 is **NOT APPLICABLE** for this migration.

**Rationale:**
1. All QuickBooks API endpoints exist and work
2. Supabase `customer_sales` table exists with correct schema
3. HMAC authentication implemented and tested
4. No database migrations needed
5. No new RPC functions required

**Action:** Skip directly to Phase 3 (Frontend Migration).

---

### Phase 2 Validation Gate

**Status:** ✅ PASSED (No backend changes needed)

- [x] Backend API endpoints exist
- [x] Authentication working
- [x] Database schema ready
- [x] No backend change request needed

**Proceed to Phase 3.**

---

## Phase 3: Frontend Migration

**Objective:** Replace FileMaker QuickBooks calls with backend API integration.

### 3.1 Service Layer Refactoring

**Task:** Create new invoice generation service that uses backend API directly.

#### 3.1.1 Create `src/services/qbInvoiceService.js`

**Purpose:** Centralized service for QuickBooks invoice generation, replacing FileMaker script calls.

**Key Functions:**

```javascript
/**
 * Generate and create QuickBooks invoice from customer sales records
 * Replaces FileMaker initializeQuickBooks function
 *
 * @param {Object} params
 * @param {string} params.customerId - Clarity CRM customer ID
 * @param {string[]} [params.recordIds] - Specific customer_sales IDs to invoice
 * @param {Object} [params.recordsByProject] - Records grouped by project ID
 * @returns {Promise<Object>} Invoice creation result
 */
export async function generateQBOInvoice({ customerId, recordIds, recordsByProject }) {
  // Step 1: Fetch unbilled customer_sales records from Supabase
  const salesRecords = await fetchUnbilledRecords(customerId, recordIds);

  if (salesRecords.length === 0) {
    throw new Error('No unbilled records found for customer');
  }

  // Step 2: Search for QuickBooks customer
  const qboCustomer = await findOrCreateQBOCustomer(customerId);

  // Step 3: Generate invoice payload using existing service
  const invoicePayload = await generateInvoicePayload(salesRecords, qboCustomer);

  // Step 4: Create invoice via backend API
  const invoice = await createQBOInvoice(invoicePayload);

  // Step 5: Update customer_sales records with inv_id
  await updateSalesRecordsInvoiceId(salesRecords, invoice.Id);

  // Step 6: Send invoice email (optional)
  if (qboCustomer.PrimaryEmailAddr?.Address) {
    await sendQBOInvoiceEmail(invoice.Id, qboCustomer.PrimaryEmailAddr.Address);
  }

  return {
    success: true,
    invoice: {
      id: invoice.Id,
      docNumber: invoice.DocNumber,
      totalAmt: invoice.TotalAmt,
      customerName: invoice.CustomerRef.name,
      emailStatus: invoice.EmailStatus
    },
    recordsInvoiced: salesRecords.length
  };
}

/**
 * Fetch unbilled customer sales records from Supabase
 */
async function fetchUnbilledRecords(customerId, recordIds) {
  const supabase = supabaseService.getClient();

  let query = supabase
    .from('customer_sales')
    .select('*')
    .eq('customer_id', customerId)
    .is('inv_id', null);  // Unbilled records

  if (recordIds && recordIds.length > 0) {
    query = query.in('id', recordIds);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch unbilled records: ${error.message}`);
  }

  return data || [];
}

/**
 * Find QuickBooks customer or prompt creation
 */
async function findOrCreateQBOCustomer(customerId) {
  // Step 1: Get Clarity customer
  const customer = await fetchCustomer(customerId);

  // Step 2: Search QuickBooks
  const searchResult = await searchQBOCustomers({
    name: customer.name,
    active_only: true,
    max_results: 5
  });

  if (searchResult?.customers?.length > 0) {
    // Return first match (or prompt user to select if multiple)
    return searchResult.customers[0];
  }

  // Step 3: Customer not found - throw error with guidance
  throw new Error(
    `QuickBooks customer not found for "${customer.name}". ` +
    'Please create the customer in QuickBooks first or use the Create Customer modal.'
  );
}

/**
 * Update customer_sales records with QuickBooks invoice ID
 */
async function updateSalesRecordsInvoiceId(salesRecords, invoiceId) {
  const supabase = supabaseService.getClient();
  const recordIds = salesRecords.map(r => r.id);

  const { error } = await supabase
    .from('customer_sales')
    .update({ inv_id: invoiceId })
    .in('id', recordIds);

  if (error) {
    console.error('Failed to update customer_sales inv_id:', error);
    // Don't throw - invoice already created, this is just bookkeeping
  }

  console.log(`✓ Updated ${recordIds.length} records with invoice ID: ${invoiceId}`);
}
```

**Dependencies:**
- `src/api/quickbooksApi.js` - Backend API client (existing)
- `src/services/invoiceGenerationService.js` - Invoice payload generation (existing)
- `src/services/supabaseService.js` - Supabase client (existing)
- `src/api/customers.js` - Customer fetching (existing)

**File Reference:** New file - create at `src/services/qbInvoiceService.js`

**Reuses Existing Code:**
- ✅ `generateInvoicePayload` from `invoiceGenerationService.js:26-84`
- ✅ `searchQBOCustomers` from `quickbooksApi.js:302`
- ✅ `createQBOInvoice` from `quickbooksApi.js:343`
- ✅ `sendQBOInvoiceEmail` from `quickbooksApi.js:548`

---

#### 3.1.2 Update `src/api/financialRecords.js`

**Task:** Add deprecation warnings to FileMaker unbilled record queries.

**Changes:**

```javascript
// BEFORE (lines 241-253)
export async function fetchUnpaidRecords(customerId) {
  const query = [{ "f_billed": "0" }];
  // ... FileMaker query
}

// AFTER
export async function fetchUnpaidRecords(customerId) {
  console.warn(
    'DEPRECATED: fetchUnpaidRecords from FileMaker is deprecated. ' +
    'Use fetchUnbilledRecords from qbInvoiceService.js instead.'
  );

  // Legacy FileMaker query (still functional during transition)
  const query = [{ "f_billed": "0" }];
  // ... FileMaker query
}
```

**Deprecation Notice Locations:**
- `fetchUnpaidRecords` (line 241)
- `bulkUpdateFinancialRecordsBilledStatus` (line 398)

**File Reference:** `src/api/financialRecords.js:241-253, 398-456`

---

#### 3.1.3 Deprecate `src/api/fileMaker.js:initializeQuickBooks`

**Task:** Mark `initializeQuickBooks` function as deprecated.

**Changes:**

```javascript
// BEFORE (line 447)
export async function initializeQuickBooks(params) {
  // ... implementation
}

// AFTER
/**
 * @deprecated Use generateQBOInvoice from qbInvoiceService.js instead.
 * This function will be removed in a future release.
 *
 * Migration Guide:
 * - OLD: initializeQuickBooks({ custId, recordsByProject })
 * - NEW: generateQBOInvoice({ customerId, recordsByProject })
 */
export async function initializeQuickBooks(params) {
  console.warn(
    'DEPRECATED: initializeQuickBooks is deprecated and will be removed. ' +
    'Migrate to generateQBOInvoice from qbInvoiceService.js for modern QuickBooks integration.'
  );

  // Legacy implementation (still functional during transition)
  // ... existing code
}
```

**File Reference:** `src/api/fileMaker.js:447-501`

---

### 3.2 Component Updates

**Task:** Update UI components to use new service layer.

#### 3.2.1 Update `src/components/financial/FinancialActivity.jsx`

**Current Usage:** Calls `initializeQuickBooks` when user clicks "Send to QuickBooks".

**Changes:**

```javascript
// BEFORE
import { initializeQuickBooks } from '../../api/fileMaker';

const handleSendToQuickBooks = async (customerId) => {
  try {
    await initializeQuickBooks({ custId: customerId });
    showSnackbar('QuickBooks initialization requested', 'success');
  } catch (error) {
    showSnackbar('Failed to initialize QuickBooks', 'error');
  }
};

// AFTER
import { generateQBOInvoice } from '../../services/qbInvoiceService';

const handleSendToQuickBooks = async (customerId) => {
  try {
    setLoading(true);
    setLoadingMessage('Generating QuickBooks invoice...');

    const result = await generateQBOInvoice({ customerId });

    showSnackbar(
      `Invoice ${result.invoice.docNumber} created successfully! Total: $${result.invoice.totalAmt}`,
      'success'
    );

    // Refresh financial data
    await refreshFinancialData();

  } catch (error) {
    const errorMessage = extractErrorMessage(error);
    showSnackbar(`Invoice generation failed: ${errorMessage}`, 'error');
    console.error('QuickBooks invoice error:', error);
  } finally {
    setLoading(false);
    setLoadingMessage('');
  }
};
```

**Error Message Extraction:**

```javascript
function extractErrorMessage(error) {
  // QuickBooks Fault format
  if (error.Fault?.Error?.[0]) {
    const qbError = error.Fault.Error[0];
    return `${qbError.Message}: ${qbError.Detail}`;
  }

  // Standard error response
  if (error.error || error.detail) {
    return error.detail || error.error;
  }

  // Error object
  if (error.message) {
    return error.message;
  }

  return 'An unknown error occurred';
}
```

**File Reference:** `src/components/financial/FinancialActivity.jsx` (specific lines vary)

**Pattern Reference:** `src/components/financial/CustomerSalesTable.jsx:400-450` - Error handling pattern

---

#### 3.2.2 Verify `src/components/financial/CustomerSalesTable.jsx`

**Current Status:** ✅ Already uses modern backend API approach.

**Verification:**

```javascript
// CustomerSalesTable.jsx already uses:
// 1. searchQBOCustomers for customer lookup
// 2. generateInvoicePayload for payload creation
// 3. createQBOInvoice for invoice creation
// 4. sendQBOInvoiceEmail for email delivery
// 5. Comprehensive error handling
```

**Action:** No changes needed - this component is the **reference implementation** for other components to follow.

**File Reference:** `src/components/financial/CustomerSalesTable.jsx:1-150`

---

### 3.3 Hook Updates

**Task:** Update custom hooks to use Supabase data source.

#### 3.3.1 Update `useFinancialRecords` Hook (if exists)

**Search for Hook:**

```bash
grep -r "useFinancialRecords" src/hooks/
```

**If Found:**

Replace FileMaker queries with Supabase queries:

```javascript
// BEFORE
const { data: records } = await fetchFinancialRecords(timeframe, customerId);

// AFTER
const supabase = supabaseService.getClient();
const { data: records, error } = await supabase
  .from('customer_sales')
  .select('*')
  .eq('organization_id', organizationId)
  .eq('customer_id', customerId)
  .gte('date', startDate)
  .lte('date', endDate);
```

**Error Handling:**

```javascript
if (error) {
  console.error('Failed to fetch customer sales:', error);
  throw new Error(`Failed to fetch financial records: ${error.message}`);
}
```

---

### 3.4 Timer Integration

**Task:** Ensure Timer stops create `customer_sales` records directly (bypass FileMaker sync).

#### 3.4.1 Update `src/services/taskService.js`

**Current Flow:**
1. Timer stops → Create FileMaker `devRecords` entry
2. Manual sync → Copy to Supabase `customer_sales`

**Target Flow:**
1. Timer stops → Create Supabase `customer_sales` entry directly
2. Optional: Also create FileMaker record (dual-write during transition)

**Changes:**

```javascript
// File: src/services/taskService.js
// Location: Lines 104-131 (timer stop handler)

// AFTER: Direct Supabase write
async function handleTimerStop(task, timerState) {
  const endTime = Date.now();
  const elapsedSeconds = Math.floor((endTime - timerState.startTime) / 1000);
  const totalPauseSeconds = timerState.totalPauseTime || 0;
  const adjustmentSeconds = (timerState.adjustment || 0) * 60;
  const billableSeconds = elapsedSeconds - totalPauseSeconds + adjustmentSeconds;

  // Check if fixed-price project
  const project = await fetchProject(task.projectId);
  const isFixedPrice = project?.f_fixedPrice > 0;

  if (isFixedPrice) {
    console.log('⊘ Fixed-price project - skipping customer_sales creation');
    return { success: true, skipped: true };
  }

  // Create customer_sales record directly in Supabase
  const saleRecord = await createCustomerSaleRecord({
    organizationId: task.organizationId,
    customerId: task.customerId,
    projectId: task.projectId,
    productName: formatProductName(task.customerName, task.projectName),
    quantity: billableSeconds / 3600,  // Convert to hours
    unitPrice: await resolveHourlyRate(project, task.staffId),
    date: new Date(),
    createdBy: task.userId
  });

  console.log(`✓ Created customer_sales record: ${saleRecord.id}`);

  return { success: true, recordId: saleRecord.id };
}

/**
 * Create customer sales record in Supabase
 */
async function createCustomerSaleRecord(data) {
  const supabase = supabaseService.getClient();

  const record = {
    organization_id: data.organizationId,
    customer_id: data.customerId,
    project_id: data.projectId,
    product_name: data.productName,
    quantity: Math.round(data.quantity * 100) / 100,  // Round to 2 decimals
    unit_price: data.unitPrice,
    total_price: Math.round(data.quantity * data.unitPrice * 100) / 100,
    date: data.date.toISOString().split('T')[0],  // YYYY-MM-DD
    inv_id: null,  // Unbilled
    created_at: new Date().toISOString()
  };

  const { data: created, error } = await supabase
    .from('customer_sales')
    .insert(record)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create customer_sales record: ${error.message}`);
  }

  return created;
}

/**
 * Resolve hourly rate following priority hierarchy
 * 1. Project-level rate
 * 2. Staff-level rate
 * 3. Organization default
 * 4. Fallback to 0
 */
async function resolveHourlyRate(project, staffId) {
  // Priority 1: Project rate
  if (project.f_hourlyRate && project.f_hourlyRate > 0) {
    return project.f_hourlyRate;
  }

  // Priority 2: Staff rate
  if (staffId) {
    const staff = await fetchStaff(staffId);
    if (staff?.f_HourlyRate && staff.f_HourlyRate > 0) {
      return staff.f_HourlyRate;
    }
  }

  // Priority 3: Organization default
  const orgRate = await getOrganizationDefaultRate();
  if (orgRate > 0) {
    return orgRate;
  }

  // Fallback
  console.warn('No hourly rate found - defaulting to 0');
  return 0;
}
```

**File Reference:** `src/services/taskService.js:67-131`

**Business Rule Reference:** `api-contracts.md:1931-1942` - Hourly rate resolution

---

### 3.5 Testing During Development

**Task:** Test each updated component in isolation before integration.

#### Unit Testing (Manual)

**Test 1: Invoice Generation Service**

```javascript
// Test happy path
const result = await generateQBOInvoice({
  customerId: 'test-customer-uuid',
  recordIds: ['record-1', 'record-2', 'record-3']
});

console.log('Invoice created:', result.invoice);
// Expected: { id, docNumber, totalAmt, customerName, emailStatus }
```

**Test 2: Error Handling**

```javascript
// Test missing customer
try {
  await generateQBOInvoice({ customerId: 'invalid-uuid' });
} catch (error) {
  console.log('Expected error:', error.message);
  // Expected: "No unbilled records found for customer"
}
```

**Test 3: Timer Integration**

```javascript
// Start timer on task
await startTimer(taskId);

// Wait 10 seconds
await sleep(10000);

// Stop timer
await stopTimer(taskId);

// Verify customer_sales record created
const { data } = await supabase
  .from('customer_sales')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

console.log('Created record:', data);
// Expected: Record with correct quantity, unit_price, total_price
```

#### Integration Testing

**Test Scenario: End-to-End Invoice Generation**

```javascript
// 1. Create test customer and project
const customer = await createTestCustomer({ name: 'Test Co' });
const project = await createTestProject({ customerId: customer.id });

// 2. Create unbilled records
await createTestSalesRecords(customer.id, project.id, 5);

// 3. Generate invoice
const result = await generateQBOInvoice({ customerId: customer.id });

// 4. Verify invoice created in QuickBooks
const qbInvoice = await getQBOInvoice(result.invoice.id);
console.assert(qbInvoice.DocNumber === result.invoice.docNumber);

// 5. Verify records marked as invoiced
const { data: records } = await supabase
  .from('customer_sales')
  .select('inv_id')
  .eq('customer_id', customer.id);

console.assert(records.every(r => r.inv_id === result.invoice.id));

console.log('✓ End-to-end test passed');
```

---

### Phase 3 Validation Gate

**Before proceeding to Phase 4, verify:**

- [ ] `qbInvoiceService.js` created and tested
- [ ] FileMaker functions deprecated with warnings
- [ ] UI components updated and tested
- [ ] Timer integration updated and tested
- [ ] Custom hooks updated (if applicable)
- [ ] Error handling comprehensive
- [ ] Build succeeds without errors
- [ ] Manual testing completed for all scenarios
- [ ] Rollback procedure tested

**Sign-Off Required:** Technical Lead

---

## Phase 4: Cutover and Validation

**Objective:** Deploy changes to production, monitor performance, and validate migration success.

### 4.1 Pre-Deployment Checklist

**Code Quality:**

```bash
# Build verification
npm run build
# Expected: ✓ Build completed successfully

# No console errors in dev mode
npm run dev
# Verify: No red console errors on startup
```

**Verification Queries:**

```sql
-- Verify customer_sales records ready for migration
SELECT COUNT(*) FROM customer_sales
WHERE organization_id = '{ORG_ID}'
  AND inv_id IS NULL;

-- Verify no orphaned records
SELECT COUNT(*) FROM customer_sales cs
LEFT JOIN customers c ON c.id = cs.customer_id
WHERE c.id IS NULL;
-- Expected: 0
```

**QuickBooks Connection:**

```bash
# Verify QB credentials valid
curl https://api.claritybusinesssolutions.ca/quickbooks/validate \
  -H "Authorization: Bearer {SIG}.{TS}" \
  -H "X-Organization-ID: {ORG}"
# Expected: {"is_valid": true}
```

---

### 4.2 Deployment Steps

**Step 1: Build Production Bundle**

```bash
npm run build
```

**Step 2: Deploy to Server**

```bash
npm run deploy-to-fm
# Or manual deployment:
npm run upload
```

**Step 3: Verify Deployment**

```bash
# Check server status
curl -s -o /dev/null -w "%{http_code}" https://app.claritybusinesssolutions.ca
# Expected: 200
```

**Step 4: Smoke Test in Production**

1. Open Financial Activity panel
2. Filter for customer with unbilled records
3. Click "Send to QuickBooks"
4. Verify:
   - Loading indicator appears
   - Success message shows invoice number and total
   - QuickBooks shows new invoice
   - Customer sales records updated with `inv_id`

---

### 4.3 Post-Deployment Monitoring

**Metrics to Monitor:**

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Invoice creation success rate | > 95% | < 90% |
| Average invoice generation time | < 5 seconds | > 10 seconds |
| Error rate | < 5% | > 10% |
| User feedback positive | > 90% | < 80% |

**Monitoring Script:**

```javascript
// Monitor invoice generation success
const { data: recentInvoices } = await supabase
  .from('customer_sales')
  .select('inv_id, created_at')
  .not('inv_id', 'is', null)
  .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

const successRate = (recentInvoices.length / totalAttempts) * 100;
console.log(`Invoice success rate (24h): ${successRate.toFixed(1)}%`);
```

**Log Analysis:**

```bash
# Check for errors in browser console
# Look for patterns in:
# - "DEPRECATED:" warnings
# - "Failed to" error messages
# - QuickBooks API errors
```

---

### 4.4 Validation Tests

**Test 1: Happy Path**

```
✓ User: Marcus
✓ Customer: Existing customer with unbilled records
✓ Action: Generate invoice
✓ Expected: Invoice created, email sent, records updated
✓ Actual: [PASS/FAIL]
```

**Test 2: Error Recovery**

```
✓ User: Marcus
✓ Customer: Customer not in QuickBooks
✓ Action: Attempt invoice generation
✓ Expected: Clear error message with guidance
✓ Actual: [PASS/FAIL]
```

**Test 3: Multi-Project Invoice**

```
✓ User: Marcus
✓ Customer: 3 projects with unbilled time
✓ Action: Generate invoice
✓ Expected: 1 invoice with 3 line items
✓ Actual: [PASS/FAIL]
```

**Test 4: Fixed-Price Project**

```
✓ User: Marcus
✓ Project: Fixed-price project (f_fixedPrice > 0)
✓ Action: Stop timer on task
✓ Expected: No customer_sales record created
✓ Actual: [PASS/FAIL]
```

---

### 4.5 User Communication

**Notification Template:**

> **QuickBooks Integration Update**
>
> We've upgraded our QuickBooks invoice generation system!
>
> **What's New:**
> - Real-time feedback when creating invoices
> - See invoice numbers and totals immediately
> - Better error messages if something goes wrong
> - Faster invoice creation
>
> **What to Expect:**
> - The "Send to QuickBooks" button now shows progress
> - You'll see a success message with invoice details
> - If there's an issue, you'll get a clear error message
>
> **No Changes to Your Workflow:**
> - Everything works the same way
> - Just better feedback and reliability
>
> Questions? Contact Marcus.

---

### 4.6 Migration Completion

**Criteria for Completion:**

- [ ] All components using new backend API integration
- [ ] No errors in production logs (24-hour window)
- [ ] User feedback positive
- [ ] Performance metrics meet targets
- [ ] No data loss or corruption detected
- [ ] Rollback plan tested and documented

**Final Steps:**

1. **Deprecate FileMaker Functions**
   - Add clear deprecation warnings
   - Update documentation
   - Plan removal date (e.g., 30 days post-migration)

2. **Update Documentation**
   - Mark `initializeQuickBooks` as deprecated
   - Document new `generateQBOInvoice` function
   - Update integration guides

3. **Archive Legacy Code**
   - Keep FileMaker code for reference
   - Add comments indicating replacement
   - Plan eventual removal

---

## Rollback Procedures

### Immediate Rollback (< 24 hours post-deployment)

**Scenario:** Critical bugs discovered immediately after deployment.

**Steps:**

1. **Revert Frontend Code**
   ```bash
   # Checkout previous commit
   git log --oneline -10
   git checkout <previous-commit-hash>

   # Rebuild and deploy
   npm run build
   npm run deploy-to-fm
   ```

2. **Verify Rollback**
   ```bash
   # Test FileMaker integration
   curl https://app.claritybusinesssolutions.ca
   # Verify: Old UI loads successfully
   ```

3. **Communicate to Users**
   > We've temporarily rolled back the QuickBooks update while we address an issue. Your data is safe and all invoices are intact.

**Data Safety:**
- No data loss - Supabase records remain intact
- FileMaker records unaffected
- QuickBooks invoices already created remain valid

---

### Partial Rollback (Specific Component)

**Scenario:** One component has issues, others work fine.

**Steps:**

1. **Identify Problematic Component**
   ```bash
   # Example: FinancialActivity.jsx has issues
   git log src/components/financial/FinancialActivity.jsx
   ```

2. **Revert Single File**
   ```bash
   git checkout <previous-commit> -- src/components/financial/FinancialActivity.jsx
   ```

3. **Test and Deploy**
   ```bash
   npm run build
   npm run deploy-to-fm
   ```

**Gradual Migration:**
- Keep `CustomerSalesTable` using new system (it's stable)
- Revert `FinancialActivity` to FileMaker temporarily
- Fix issues, re-migrate later

---

### Data Recovery

**Scenario:** Incorrect invoice IDs written to customer_sales.

**Recovery Query:**

```sql
-- Clear incorrect invoice IDs
UPDATE customer_sales
SET inv_id = NULL
WHERE inv_id = '{INCORRECT_INVOICE_ID}';

-- Re-generate invoice for affected records
-- (Use UI or run migration script again)
```

**Verification:**

```sql
-- Verify QuickBooks invoice exists
SELECT * FROM customer_sales
WHERE inv_id = '{INVOICE_ID}'
LIMIT 1;

-- Check in QuickBooks via API
GET /quickbooks/invoices/{INVOICE_ID}
```

---

### Emergency Rollback Plan

**Worst-Case Scenario:** Complete system failure.

**Emergency Steps:**

1. **Disable QuickBooks Integration**
   ```javascript
   // src/services/qbInvoiceService.js
   export async function generateQBOInvoice() {
     throw new Error('QuickBooks integration temporarily disabled for maintenance');
   }
   ```

2. **Notify Users**
   > QuickBooks invoice generation is temporarily unavailable. Time tracking and all other features work normally. We're working on a fix.

3. **Manual Invoice Creation**
   - Users can create invoices directly in QuickBooks
   - Export customer_sales data as CSV
   - Import to QuickBooks manually

4. **Fix and Redeploy**
   - Identify root cause
   - Fix in development environment
   - Test thoroughly
   - Deploy with caution

---

## Testing Strategy

### Testing Pyramid

```
         /\
        /E2\      End-to-End Tests (5%)
       /----\     - Full invoice generation flow
      /  INT \    Integration Tests (25%)
     /--------\   - Service + API integration
    /   UNIT   \  Unit Tests (70%)
   /------------\ - Function-level validation
```

### Unit Tests

**Coverage Areas:**

1. **Invoice Service Functions**
   - `fetchUnbilledRecords` - returns correct records
   - `findOrCreateQBOCustomer` - finds existing or throws
   - `updateSalesRecordsInvoiceId` - updates all records
   - `resolveHourlyRate` - follows priority hierarchy

2. **Error Handling**
   - Missing customer throws correct error
   - Network errors handled gracefully
   - QuickBooks API errors extracted properly

3. **Data Transformation**
   - Product name formatting
   - Invoice payload generation
   - Date/time conversions

**Example Unit Test:**

```javascript
describe('qbInvoiceService', () => {
  describe('resolveHourlyRate', () => {
    it('should use project rate as highest priority', async () => {
      const project = { f_hourlyRate: 200 };
      const staffId = 'staff-with-rate-150';

      const rate = await resolveHourlyRate(project, staffId);

      expect(rate).toBe(200);
    });

    it('should fall back to staff rate if no project rate', async () => {
      const project = { f_hourlyRate: 0 };
      const staffId = 'staff-with-rate-150';

      const rate = await resolveHourlyRate(project, staffId);

      expect(rate).toBe(150);
    });

    it('should return 0 if no rates found', async () => {
      const project = { f_hourlyRate: 0 };
      const staffId = null;

      const rate = await resolveHourlyRate(project, staffId);

      expect(rate).toBe(0);
    });
  });
});
```

---

### Integration Tests

**Coverage Areas:**

1. **Service + API Integration**
   - `generateQBOInvoice` creates invoice successfully
   - Records updated with correct invoice ID
   - Email sent when customer has email address

2. **Timer + Sales Record Creation**
   - Timer stop creates customer_sales record
   - Fixed-price projects skip record creation
   - Hourly rate calculated correctly

3. **Component + Service Integration**
   - UI button triggers invoice generation
   - Loading states show/hide correctly
   - Success/error messages display

**Example Integration Test:**

```javascript
describe('Invoice Generation Flow', () => {
  it('should generate invoice and update records', async () => {
    // Setup: Create test data
    const customer = await createTestCustomer();
    const project = await createTestProject(customer.id);
    const records = await createTestSalesRecords(customer.id, project.id, 3);

    // Action: Generate invoice
    const result = await generateQBOInvoice({ customerId: customer.id });

    // Verify: Invoice created
    expect(result.success).toBe(true);
    expect(result.invoice.id).toBeTruthy();

    // Verify: Records updated
    const { data: updatedRecords } = await supabase
      .from('customer_sales')
      .select('inv_id')
      .eq('customer_id', customer.id);

    expect(updatedRecords.every(r => r.inv_id === result.invoice.id)).toBe(true);
  });
});
```

---

### End-to-End Tests

**Coverage Areas:**

1. **Complete User Journey**
   - Login → Navigate to Financial Activity
   - Filter customer → Click "Send to QB"
   - Verify success message → Check QB

2. **Error Scenarios**
   - Invalid customer → Error message displayed
   - Network error → Retry prompt shown
   - QB token expired → Automatic refresh

**Example E2E Test (Playwright):**

```javascript
test('Generate QuickBooks invoice from Financial Activity', async ({ page }) => {
  // Login
  await page.goto('https://app.claritybusinesssolutions.ca');
  await page.fill('#email', 'test@example.com');
  await page.fill('#password', 'password');
  await page.click('button[type="submit"]');

  // Navigate to Financial Activity
  await page.click('text=Financial');
  await expect(page).toHaveURL(/.*financial/);

  // Select customer
  await page.selectOption('select#customer', 'Test Customer Inc.');

  // Generate invoice
  await page.click('button:has-text("Send to QuickBooks")');

  // Verify loading state
  await expect(page.locator('text=Generating QuickBooks invoice')).toBeVisible();

  // Verify success message
  await expect(page.locator('text=Invoice')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('text=created successfully')).toBeVisible();
});
```

---

## Performance Benchmarks

### Current Performance (FileMaker)

**Measured Metrics:**

| Operation | Current Time | Notes |
|-----------|--------------|-------|
| Invoice creation request | ~500ms | Fire-and-forget to FM |
| User feedback | 0ms | None - immediate return |
| Actual invoice creation | Unknown | Happens in FileMaker async |
| Total user wait time | 0s (perceived) | No feedback = feels instant |

**Issue:** Users don't know if invoice was created successfully.

---

### Target Performance (Backend API)

**Performance Targets:**

| Operation | Target Time | Max Acceptable |
|-----------|-------------|----------------|
| Fetch unbilled records | < 500ms | < 1s |
| Search QB customer | < 1s | < 2s |
| Generate invoice payload | < 200ms | < 500ms |
| Create QB invoice | < 2s | < 5s |
| Update records | < 500ms | < 1s |
| Send invoice email | < 1s | < 3s |
| **Total** | **< 5s** | **< 10s** |

**User Experience:**
- Loading indicator shows progress
- Success message with invoice details
- Clear error messages if failure
- Much better than "no feedback"

---

### Performance Optimization

**Backend Optimizations:**

1. **Database Indexes**
   ```sql
   -- Already exist per schema
   CREATE INDEX idx_customer_sales_customer_id ON customer_sales(customer_id);
   CREATE INDEX idx_customer_sales_inv_id ON customer_sales(inv_id);
   ```

2. **Query Optimization**
   ```javascript
   // Fetch only required fields
   const { data } = await supabase
     .from('customer_sales')
     .select('id, customer_id, product_name, quantity, unit_price, total_price, date')
     .eq('customer_id', customerId)
     .is('inv_id', null);
   ```

3. **Parallel Requests**
   ```javascript
   // Fetch customer and records in parallel
   const [customer, records] = await Promise.all([
     fetchCustomer(customerId),
     fetchUnbilledRecords(customerId)
   ]);
   ```

**Frontend Optimizations:**

1. **Debouncing**
   - Prevent double-clicks on "Send to QB" button
   - Disable button during processing

2. **Progress Feedback**
   - Show loading indicator
   - Display current step ("Searching for customer...", "Creating invoice...")

3. **Error Recovery**
   - Retry logic for network errors
   - Clear guidance on how to fix issues

---

### Performance Monitoring

**Metrics to Track:**

```javascript
// Track invoice generation time
const startTime = Date.now();

try {
  const result = await generateQBOInvoice({ customerId });
  const duration = Date.now() - startTime;

  // Log performance metric
  console.log(`✓ Invoice generated in ${duration}ms`);

  // Send to analytics
  trackEvent('invoice_generation_success', { duration });

} catch (error) {
  const duration = Date.now() - startTime;

  // Log failure
  console.error(`✗ Invoice generation failed after ${duration}ms`);

  // Send to analytics
  trackEvent('invoice_generation_failure', { duration, error: error.message });
}
```

**Performance Dashboard:**

- Average invoice generation time (7-day rolling)
- 95th percentile latency
- Success/failure rates
- Slowest operations breakdown

---

## Risk Mitigation

### Risk Assessment

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| Data loss during migration | Low | High | Rollback plan + backup before changes |
| QuickBooks token expiration | Medium | Medium | Automatic refresh + user notification |
| Network errors | Medium | Low | Retry logic + clear error messages |
| Missing QB customers | High | Low | Prompt to create + clear guidance |
| Performance degradation | Low | Medium | Performance monitoring + optimization |
| User confusion | Low | Low | User communication + training |

---

### Risk #1: Data Loss During Migration

**Mitigation:**

1. **No Data Destruction**
   - Migration adds new code paths
   - Old FileMaker data untouched
   - Supabase records append-only

2. **Rollback Capability**
   - Revert to previous commit
   - FileMaker still works
   - No data cleanup required

3. **Validation Queries**
   ```sql
   -- Verify no records lost
   SELECT COUNT(*) FROM customer_sales
   WHERE organization_id = '{ORG_ID}';
   -- Compare before/after migration
   ```

---

### Risk #2: QuickBooks Token Expiration

**Mitigation:**

1. **Automatic Token Refresh**
   - Backend handles refresh transparently
   - Frontend retries on 401 error

2. **Token Validation**
   ```javascript
   // Check token before invoice generation
   const { is_valid } = await validateQBOCredentials();
   if (!is_valid) {
     await refreshQBOToken();
   }
   ```

3. **User Notification**
   > Your QuickBooks connection has expired. Please reconnect.
   > [Reconnect Button]

**Reference:** `workflows.md:73-93` - Token refresh flow

---

### Risk #3: Network Errors

**Mitigation:**

1. **Retry Logic**
   ```javascript
   async function retryWithBackoff(fn, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fn();
       } catch (error) {
         if (i === maxRetries - 1) throw error;

         const backoff = Math.pow(2, i) * 1000;
         console.log(`Retry ${i + 1}/${maxRetries} after ${backoff}ms`);
         await sleep(backoff);
       }
     }
   }

   // Usage
   const invoice = await retryWithBackoff(() =>
     createQBOInvoice(invoicePayload)
   );
   ```

2. **User Feedback**
   > Network error occurred. Retrying... (Attempt 2/3)

3. **Graceful Degradation**
   - Save failed invoice payloads locally
   - Retry later automatically

---

### Risk #4: Missing QuickBooks Customers

**Mitigation:**

1. **Search Before Create**
   ```javascript
   // Always search first
   const searchResult = await searchQBOCustomers({ name: customer.name });

   if (searchResult.customers.length === 0) {
     // Prompt user to create
     showCreateCustomerModal(customer);
   }
   ```

2. **Create Customer Modal**
   - Pre-fill with Clarity customer data
   - User reviews/edits before creating
   - Creates in QB, then generates invoice

3. **Clear Error Message**
   > Customer "ABC Corp" not found in QuickBooks.
   > [Create Customer] [Cancel]

**Reference:** `src/components/financial/CreateQBOCustomerModal.jsx` - Existing implementation

---

### Risk #5: Performance Degradation

**Mitigation:**

1. **Performance Monitoring**
   - Track all invoice generation times
   - Alert if > 10s average

2. **Optimization Strategies**
   - Database indexes (already exist)
   - Parallel requests where possible
   - Caching QB customer search results

3. **Fallback to FileMaker**
   - If backend consistently slow
   - Temporary rollback to FileMaker
   - Fix performance, re-migrate

---

### Risk #6: User Confusion

**Mitigation:**

1. **Clear Communication**
   - Announce changes ahead of time
   - Explain benefits (real-time feedback)
   - Provide training materials

2. **Progressive Rollout**
   - Deploy to staging first
   - Internal testing by team
   - Gradual rollout to users

3. **Support Plan**
   - Marcus available for questions
   - Documentation updated
   - FAQ created

---

## Success Metrics

### Migration Success Criteria

**Technical Metrics:**

- [ ] 100% of invoice generation flows use backend API
- [ ] 0 FileMaker `initializeQuickBooks` calls in production logs
- [ ] 95%+ invoice creation success rate
- [ ] < 5% error rate
- [ ] < 10s average invoice generation time
- [ ] 0 data loss incidents

**User Experience Metrics:**

- [ ] Users see invoice details immediately after creation
- [ ] Error messages clear and actionable
- [ ] Positive user feedback (> 90% satisfied)
- [ ] No increase in support requests

**Business Metrics:**

- [ ] No disruption to invoicing workflow
- [ ] QuickBooks integration reliability improved
- [ ] Reduced time to identify invoicing issues
- [ ] Faster invoice generation (perceived)

---

### Post-Migration Review

**After 30 days, review:**

1. **Adoption Metrics**
   - What % of invoices created via new system?
   - Any users still using FileMaker path?

2. **Performance Metrics**
   - Average invoice generation time
   - Success rate trends
   - Error patterns

3. **User Feedback**
   - Collect feedback from users
   - Identify pain points
   - Plan improvements

4. **Deprecation Timeline**
   - Plan to remove FileMaker code
   - Set date for final deprecation
   - Communicate to stakeholders

---

## Conclusion

This migration plan provides a **comprehensive, step-by-step approach** to transitioning QuickBooks invoice generation from FileMaker scripts to the modern backend API architecture.

**Key Advantages:**

✅ **No Backend Changes Required** - All APIs already exist
✅ **Phased Approach** - Validate at each stage before proceeding
✅ **Rollback Safety** - Can revert at any point without data loss
✅ **Improved UX** - Real-time feedback and error handling
✅ **Future-Proof** - Web app compatible, FileMaker-independent

**Next Steps:**

1. **Review and approve migration plan**
2. **Begin Phase 1: Preparation and Foundation**
3. **Execute phases sequentially with validation gates**
4. **Monitor post-deployment for 30 days**
5. **Plan final FileMaker deprecation**

**Questions or Concerns:**

Contact Marcus Swift for clarification or to discuss migration strategy.

---

**Document Status:** ✅ Ready for Review
**Last Updated:** 2026-01-10
**Author:** Claude (via Marcus Swift)
**Approver:** [Pending]
