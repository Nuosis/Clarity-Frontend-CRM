# Customers Migration Plan - FileMaker to Supabase

## Document Purpose

This document provides a comprehensive, actionable migration plan for transitioning the Customers feature from FileMaker-primary to Supabase-only architecture. It includes data backfill strategy, cutover procedures, rollback plans, validation steps, and monitoring requirements.

**Document Version**: 1.0
**Last Updated**: 2026-01-10
**Task Reference**: TSK0009 - Create migration plan
**Dependencies**: TSK0008 (ID reconciliation strategy), TSK0005 (API contracts), TSK0004 (Field mapping)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Migration Prerequisites](#migration-prerequisites)
3. [Migration Phases](#migration-phases)
4. [Data Backfill Strategy](#data-backfill-strategy)
5. [ID Reconciliation Implementation](#id-reconciliation-implementation)
6. [Cutover Approach](#cutover-approach)
7. [Validation & Reconciliation](#validation--reconciliation)
8. [Rollback Procedures](#rollback-procedures)
9. [Performance Benchmarks](#performance-benchmarks)
10. [Risk Assessment & Mitigation](#risk-assessment--mitigation)
11. [Post-Migration Monitoring](#post-migration-monitoring)
12. [Success Criteria](#success-criteria)
13. [Team Responsibilities](#team-responsibilities)

---

## Executive Summary

### Migration Scope

**Feature**: Customers (core CRM entity)
**Current State**: FileMaker-primary with partial dual-write to Supabase
**Target State**: Supabase-only (FileMaker deprecated)
**Estimated Customer Count**: ~50-100 active customers
**Related Tables**: 5 tables (customers, customer_email, customer_phone, customer_address, customer_organization)
**Dependent Features**: Projects, Tasks, Proposals, Financial Records, Marketing Campaigns

### Key Strategy Decisions

1. **ID Mapping**: Direct UUID mapping (FileMaker `__ID` → Supabase `customers.id`)
   - **Rationale**: No lookup table needed, preserves foreign key references
   - **Reference**: [id-reconciliation-strategy.md](./id-reconciliation-strategy.md)

2. **Cutover Method**: Feature flag with gradual rollout
   - **Rationale**: Safe rollback, phased testing, reduced risk
   - **Implementation**: Environment variable `VITE_USE_SUPABASE_CUSTOMERS`

3. **Dual-Write Enhancement**: Complete CREATE/UPDATE/DELETE coverage before migration
   - **Current Gap**: Only UPDATE operations sync to Supabase
   - **Reference**: [dual-write-analysis.md](./dual-write-analysis.md#data-synchronization-gaps)

4. **Backend-First Architecture**: All operations through backend API
   - **Rationale**: Transactional consistency, security, single source of truth
   - **Reference**: [api-contracts.md](./api-contracts.md)

### Critical Path Timeline

**Total Duration**: 4-6 weeks (includes backend implementation)

| Phase | Duration | Start | End | Dependencies |
|-------|----------|-------|-----|--------------|
| **Phase 1**: Backend Preparation | 1-2 weeks | Week 1 | Week 2 | Backend team availability |
| **Phase 2**: Dual-Write Completion | 1 week | Week 2 | Week 3 | Phase 1 complete |
| **Phase 3**: Data Backfill | 3-5 days | Week 3 | Week 3 | Phases 1-2 complete |
| **Phase 4**: Frontend Refactor | 1 week | Week 3 | Week 4 | Phase 2 complete |
| **Phase 5**: Gradual Rollout | 1-2 weeks | Week 4 | Week 6 | All phases complete |
| **Phase 6**: Cleanup | 1 week | Week 6+ | Week 7+ | 100% cutover validated |

### Risk Level Assessment

**Overall Risk**: Medium

**Risk Factors**:
- ✅ **Low Risk**: Dual-write already partially implemented
- ✅ **Low Risk**: UUID-based ID reconciliation is straightforward
- ⚠️ **Medium Risk**: ~15+ dependent features rely on customer data
- ⚠️ **Medium Risk**: Incomplete dual-write coverage creates data divergence
- ❌ **High Risk**: No existing retry mechanism for failed Supabase writes

**Mitigation**: Feature flag enables instant rollback, gradual rollout limits blast radius

---

## Migration Prerequisites

### Backend Requirements

**Backend Change Request Document Required**: Yes

Per CLAUDE.md Backend Change Protocol, the following changes require formal backend change request:

#### 1. Database Schema Changes

**Required Schema Modifications**:

```sql
-- Add missing active status field
ALTER TABLE customers ADD COLUMN is_active BOOLEAN DEFAULT true;
CREATE INDEX idx_customers_active ON customers(is_active) WHERE is_active = true;

-- Add primary contact name field (from FileMaker ContactPerson)
ALTER TABLE customers ADD COLUMN primary_contact_name TEXT;

-- Add financial data JSONB column (from FileMaker chargeRate, f_USD, etc.)
ALTER TABLE customers ADD COLUMN financial_data JSONB DEFAULT '{}'::jsonb;
CREATE INDEX idx_customers_financial_data ON customers USING gin(financial_data);

-- Add credentials storage (encrypted, from FileMaker dbPath, dbUserName, dbPasword)
ALTER TABLE customers ADD COLUMN encrypted_credentials JSONB DEFAULT '{}'::jsonb;

-- Update customer_phone to add ON DELETE CASCADE (currently missing)
ALTER TABLE customer_phone DROP CONSTRAINT customer_phone_customer_id_fkey;
ALTER TABLE customer_phone ADD CONSTRAINT customer_phone_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

-- Update customer_address to add ON DELETE CASCADE (currently missing)
ALTER TABLE customer_address DROP CONSTRAINT customer_address_customer_id_fkey;
ALTER TABLE customer_address ADD CONSTRAINT customer_address_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

-- Add unique constraint for primary email per customer
CREATE UNIQUE INDEX idx_customer_email_primary
  ON customer_email(customer_id)
  WHERE is_primary = true;

-- Add unique constraint for primary phone per customer
CREATE UNIQUE INDEX idx_customer_phone_primary
  ON customer_phone(customer_id)
  WHERE is_primary = true;
```

**Rationale**:
- `is_active`: Required for status toggle operations (FileMaker `f_active` field)
- `primary_contact_name`: Preserves FileMaker `ContactPerson` data
- `financial_data`: Stores charge rates, currency flags, prepay amounts
- `encrypted_credentials`: Secure storage for database credentials
- Foreign key cascades: Prevent orphaned records on customer deletion
- Unique constraints: Enforce data integrity for primary contacts

#### 2. RLS Policy Implementation

**Required Policies** (per [authorization.md](./authorization.md)):

```sql
-- customers table policies
CREATE POLICY "Users can view customers in their organization"
  ON customers FOR SELECT
  TO authenticated
  USING (organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid);

CREATE POLICY "Admins can insert customers in their organization"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'staff')
  );

CREATE POLICY "Admins and staff can update customers in their organization"
  ON customers FOR UPDATE
  TO authenticated
  USING (organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'staff')
  );

CREATE POLICY "Admins can delete customers in their organization"
  ON customers FOR DELETE
  TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Similar policies required for customer_email, customer_phone, customer_address, customer_contacts
-- (Full policy specifications in authorization.md)
```

#### 3. Backend API Endpoints

**Required Endpoints** (per [api-contracts.md](./api-contracts.md)):

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/api/customers` | GET | List customers (paginated, filtered) | **Critical** |
| `/api/customers/:id` | GET | Get customer by ID with related data | **Critical** |
| `/api/customers` | POST | Create customer with related records | **Critical** |
| `/api/customers/:id` | PATCH | Update customer and related records | **Critical** |
| `/api/customers/:id` | DELETE | Delete customer (soft or hard) | **Critical** |
| `/api/customers/:id/toggle-status` | POST | Toggle active/inactive status | **High** |
| `/api/customers/batch` | POST | Batch create customers (for migration) | **Critical** |
| `/api/customers/search` | GET | Search customers by name/email/phone | **High** |
| `/api/customers/validate` | POST | Validate customer data before save | **Medium** |
| `/api/customers/migration/status` | GET | Get migration reconciliation status | **Medium** |
| `/api/customers/stats` | GET | Get customer statistics/aggregates | **Low** |

**Implementation Requirements**:
- All endpoints must enforce organization scoping via JWT claims
- All mutations must use database transactions (atomic updates)
- All endpoints must support idempotency keys for retries
- All responses must follow standardized error format

#### 4. Migration Script & Reconciliation Endpoint

**Required Backend Utilities**:

```python
# Backend migration script (one-time execution)
# Location: backend/scripts/migrate_customers_from_filemaker.py

async def migrate_customers_from_filemaker():
    """
    Export all customers from FileMaker and import to Supabase

    Steps:
    1. Export FileMaker customers via FileMaker Data API
    2. Transform to Supabase schema (apply field mappings)
    3. Validate data integrity (UUIDs, required fields, formats)
    4. Batch insert to Supabase (preserve UUIDs)
    5. Insert related records (emails, phones, addresses)
    6. Generate reconciliation report
    7. Log discrepancies and errors

    Returns:
        MigrationReport with counts, errors, warnings
    """
    pass

# Backend reconciliation endpoint
# Location: backend/api/customers/reconcile.py

@router.get("/api/customers/migration/reconcile")
async def reconcile_customers(
    current_user: User = Depends(get_current_user)
):
    """
    Compare FileMaker vs Supabase customer data for discrepancies

    Returns:
        {
          "total_filemaker": 52,
          "total_supabase": 50,
          "missing_in_supabase": ["uuid-1", "uuid-2"],
          "missing_in_filemaker": [],
          "data_mismatches": [
            {
              "customer_id": "uuid-3",
              "field": "business_name",
              "filemaker_value": "Acme Corp",
              "supabase_value": "Acme Corporation"
            }
          ]
        }
    """
    pass
```

**Backend Change Request Deliverable**:
Create `BACKEND_CHANGE_REQUEST_002_CUSTOMERS_MIGRATION.md` with:
- Complete SQL schema changes
- RLS policy specifications
- API endpoint contracts (request/response formats)
- Migration script pseudocode
- Testing requirements (unit, integration, E2E)
- Rollback plan for each change
- Performance impact analysis

**Approval Requirement**: Wait for backend team approval before proceeding with Phase 2

### Frontend Prerequisites

#### 1. Complete Dual-Write Coverage

**Current State** ([dual-write-analysis.md](./dual-write-analysis.md)):
- ✅ UPDATE: Syncs to Supabase (src/hooks/useCustomer.js:112-177)
- ❌ CREATE: FileMaker-only (no Supabase sync)
- ❌ DELETE: FileMaker-only (orphans Supabase records)
- ❌ STATUS_TOGGLE: FileMaker-only (no `is_active` field in Supabase)

**Required Changes**:

**1. Add Dual-Write for Customer CREATE**:
```javascript
// src/hooks/useCustomer.js
const handleCustomerCreate = useCallback(async (customerData) => {
  // Step 1: Create in FileMaker (primary)
  const fmResult = await createCustomer(formattedData);

  // Step 2: Create in Supabase (dual-write)
  if (user && user.supabaseOrgID && fmResult.success) {
    try {
      const supabaseResult = await createCustomerInSupabase(
        customerData,
        fmResult.data.__ID, // Use FileMaker UUID
        user
      );
      if (!supabaseResult.success) {
        console.error('Failed to dual-write customer to Supabase');
        // Queue for retry
        await queueFailedDualWrite('create', fmResult.data.__ID, customerData);
      }
    } catch (error) {
      console.error('Error dual-writing customer:', error);
      await queueFailedDualWrite('create', fmResult.data.__ID, customerData);
    }
  }

  return fmResult;
}, [user, createCustomerInSupabase]);
```

**2. Add Dual-Write for Customer DELETE**:
```javascript
// src/hooks/useCustomer.js
const handleCustomerDelete = useCallback(async (customerId, recordId) => {
  // Step 1: Delete in FileMaker (primary)
  const fmResult = await deleteCustomer(recordId);

  // Step 2: Delete in Supabase (dual-write)
  if (user && user.supabaseOrgID && fmResult.success) {
    try {
      await deleteCustomerInSupabase(customerId, user);
    } catch (error) {
      console.error('Failed to delete customer from Supabase:', error);
      // Queue for reconciliation
      await queueOrphanedRecord('customer', customerId);
    }
  }

  return fmResult;
}, [user, deleteCustomerInSupabase]);
```

**3. Add Dual-Write for STATUS_TOGGLE** (blocked until schema change):
```javascript
// src/hooks/useCustomer.js
const handleCustomerStatusToggle = useCallback(async (customerId, recordId, active) => {
  // Step 1: Toggle in FileMaker (f_active field)
  const fmResult = await toggleCustomerStatus(recordId, active);

  // Step 2: Toggle in Supabase (is_active field - REQUIRES SCHEMA CHANGE)
  if (user && user.supabaseOrgID && fmResult.success) {
    try {
      await updateCustomerInSupabase(
        customerId,
        { is_active: active },
        user
      );
    } catch (error) {
      console.error('Failed to sync customer status to Supabase:', error);
    }
  }

  return fmResult;
}, [user, updateCustomerInSupabase]);
```

**Code References**:
- CREATE: src/hooks/useCustomer.js:83-107
- DELETE: src/hooks/useCustomer.js:217-243
- STATUS_TOGGLE: src/hooks/useCustomer.js:182-212

#### 2. Implement Retry Queue for Failed Dual-Writes

**Requirement**: Persist failed Supabase writes for retry

**Implementation Strategy**:

```javascript
// src/services/dualWriteQueue.js
import { openDB } from 'idb';

const DB_NAME = 'clarity_dual_write_queue';
const STORE_NAME = 'failed_operations';

class DualWriteQueue {
  async init() {
    this.db = await openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
      }
    });
  }

  async enqueue(operation, customerId, data) {
    await this.db.add(STORE_NAME, {
      operation,      // 'create', 'update', 'delete', 'toggle_status'
      customerId,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending'
    });
  }

  async processQueue() {
    const pending = await this.db.getAll(STORE_NAME);
    for (const item of pending.filter(i => i.status === 'pending')) {
      try {
        // Retry operation
        await this.retryOperation(item);
        await this.db.delete(STORE_NAME, item.id);
      } catch (error) {
        // Increment retry count, exponential backoff
        item.retryCount++;
        if (item.retryCount > 5) {
          item.status = 'failed';
        }
        await this.db.put(STORE_NAME, item);
      }
    }
  }

  async retryOperation(item) {
    // Implementation based on operation type
    switch (item.operation) {
      case 'create':
        return await createCustomerInSupabase(item.data, item.customerId, user);
      case 'update':
        return await updateCustomerInSupabase(item.customerId, item.data, user);
      case 'delete':
        return await deleteCustomerInSupabase(item.customerId, user);
      case 'toggle_status':
        return await updateCustomerInSupabase(item.customerId, { is_active: item.data.active }, user);
    }
  }
}

export const dualWriteQueue = new DualWriteQueue();

// Auto-retry on app startup and every 5 minutes
dualWriteQueue.init().then(() => {
  dualWriteQueue.processQueue();
  setInterval(() => dualWriteQueue.processQueue(), 5 * 60 * 1000);
});
```

**Usage**:
```javascript
// In dual-write error handlers
import { dualWriteQueue } from '@/services/dualWriteQueue';

catch (error) {
  console.error('Dual-write failed, queueing for retry:', error);
  await dualWriteQueue.enqueue('create', customerId, customerData);
}
```

#### 3. Staging Environment Setup

**Requirements**:
- ✅ Supabase staging project configured
- ✅ Backend API staging environment deployed
- ✅ Test organization created in staging
- ✅ Sample FileMaker data exported for testing
- ✅ Frontend configured to use staging API (`VITE_API_URL=staging`)

**Validation**:
- Can create/update/delete customers via staging backend API
- RLS policies enforce organization scoping
- JWT claims correctly populated with `organization_id` and `role`

---

## Migration Phases

### Phase 1: Backend Preparation (1-2 weeks)

**Owner**: Backend team
**Status Gate**: Backend change request approved

#### Tasks

1. **Schema Changes** (2-3 days)
   - [ ] Add `customers.is_active` column with index
   - [ ] Add `customers.primary_contact_name` column
   - [ ] Add `customers.financial_data` JSONB column with GIN index
   - [ ] Add `customers.encrypted_credentials` JSONB column
   - [ ] Add ON DELETE CASCADE to customer_phone and customer_address FKs
   - [ ] Add unique indexes for primary email/phone per customer
   - [ ] Run migrations on staging database
   - [ ] Verify no data loss or integrity violations

2. **RLS Policies Implementation** (2-3 days)
   - [ ] Create SELECT, INSERT, UPDATE, DELETE policies for `customers`
   - [ ] Create policies for `customer_email`, `customer_phone`, `customer_address`
   - [ ] Create policies for `customer_contacts`, `customer_organization`
   - [ ] Test policies with multiple organizations and roles
   - [ ] Verify cross-organization access is blocked
   - [ ] Document policy behavior and edge cases

3. **Backend API Endpoints** (5-7 days)
   - [ ] Implement `GET /api/customers` (list with pagination, filtering, sorting)
   - [ ] Implement `GET /api/customers/:id` (get with related data)
   - [ ] Implement `POST /api/customers` (create with transaction)
   - [ ] Implement `PATCH /api/customers/:id` (update with transaction)
   - [ ] Implement `DELETE /api/customers/:id` (soft or hard delete)
   - [ ] Implement `POST /api/customers/:id/toggle-status`
   - [ ] Implement `POST /api/customers/batch` (for migration)
   - [ ] Implement `GET /api/customers/search`
   - [ ] Implement `GET /api/customers/migration/reconcile`
   - [ ] Add idempotency key support for all mutations
   - [ ] Add request validation (JSON schema or Pydantic)
   - [ ] Add error handling with standardized error codes
   - [ ] Write unit tests for all endpoints (>80% coverage)
   - [ ] Write integration tests for transactions

4. **Migration Script Development** (3-4 days)
   - [ ] Implement FileMaker export function (via Data API)
   - [ ] Implement data transformation (field mapping)
   - [ ] Implement validation (UUIDs, required fields, formats)
   - [ ] Implement batch insert with error handling
   - [ ] Implement reconciliation report generation
   - [ ] Test script on staging with sample data
   - [ ] Document script usage and error recovery

**Deliverables**:
- Database migrations committed and deployed to staging
- All API endpoints implemented and passing tests
- Migration script tested on staging environment
- Backend change request marked complete

**Acceptance Criteria**:
- All schema changes applied successfully (no rollbacks)
- RLS policies enforced (verified with test users)
- All critical API endpoints return correct responses (validated via Postman/curl)
- Migration script successfully imports 50+ test customers
- No data loss or integrity violations detected

### Phase 2: Dual-Write Completion (1 week)

**Owner**: Frontend team
**Status Gate**: Phase 1 complete

#### Tasks

1. **Implement Dual-Write for CREATE** (1-2 days)
   - [ ] Update `src/hooks/useCustomer.js:handleCustomerCreate` to sync to Supabase
   - [ ] Call `createCustomerInSupabase` after successful FileMaker create
   - [ ] Queue failed dual-writes for retry
   - [ ] Add SnackBar notification for dual-write failures
   - [ ] Test create flow end-to-end (FileMaker + Supabase)

2. **Implement Dual-Write for DELETE** (1 day)
   - [ ] Update `src/hooks/useCustomer.js:handleCustomerDelete` to sync to Supabase
   - [ ] Call `deleteCustomerInSupabase` after successful FileMaker delete
   - [ ] Handle orphaned records (log for reconciliation)
   - [ ] Test delete flow end-to-end

3. **Implement Dual-Write for STATUS_TOGGLE** (1 day)
   - [ ] Wait for backend schema change (customers.is_active added)
   - [ ] Update `src/hooks/useCustomer.js:handleCustomerStatusToggle` to sync to Supabase
   - [ ] Update `updateCustomerInSupabase` to support `is_active` field
   - [ ] Test status toggle flow end-to-end

4. **Implement Retry Queue** (2 days)
   - [ ] Create `src/services/dualWriteQueue.js` with IndexedDB storage
   - [ ] Implement `enqueue`, `processQueue`, `retryOperation` methods
   - [ ] Add automatic retry on app startup and periodic intervals
   - [ ] Add UI for viewing failed operations (admin-only)
   - [ ] Test retry logic with network failures

5. **Testing & Validation** (2 days)
   - [ ] Test all CRUD operations with dual-write enabled
   - [ ] Verify FileMaker and Supabase data stay in sync
   - [ ] Test retry queue with simulated network failures
   - [ ] Test with multiple users concurrently
   - [ ] Verify RLS policies prevent cross-organization access

**Deliverables**:
- All customer operations (CREATE, UPDATE, DELETE, STATUS_TOGGLE) sync to Supabase
- Retry queue implemented and tested
- No data divergence detected in 50+ test operations

**Acceptance Criteria**:
- 100% of customer operations successfully dual-write to Supabase
- Failed dual-writes are queued and retried automatically
- Retry queue recovers from network failures
- No data loss detected in stress testing

### Phase 3: Data Backfill (3-5 days)

**Owner**: Backend team + Frontend team
**Status Gate**: Phases 1-2 complete

#### Tasks

1. **Pre-Migration Validation** (1 day)
   - [ ] Export all FileMaker customers via Data API
   - [ ] Validate all customers have valid UUIDs (`__ID` field)
   - [ ] Check for duplicate UUIDs (should be 0)
   - [ ] Validate email and phone formats
   - [ ] Verify all customers have `organization_id` mapping
   - [ ] Generate pre-migration report (counts, data quality metrics)

2. **Data Transformation** (1 day)
   - [ ] Run transformation script (FileMaker → Supabase format)
   - [ ] Apply field mappings per [data-model-mapping.md](./data-model-mapping.md)
   - [ ] Normalize phone numbers (E.164 format)
   - [ ] Normalize email addresses (lowercase)
   - [ ] Validate transformed data (schema compliance)
   - [ ] Generate transformation report (warnings, errors)

3. **Staging Import** (1 day)
   - [ ] Import transformed data to staging Supabase
   - [ ] Verify record counts match FileMaker export
   - [ ] Run foreign key integrity checks
   - [ ] Test queries via backend API
   - [ ] Generate staging import report

4. **Production Import** (1 day)
   - [ ] Schedule maintenance window (optional, depends on cutover strategy)
   - [ ] Import transformed data to production Supabase
   - [ ] Verify record counts match FileMaker export
   - [ ] Run foreign key integrity checks
   - [ ] Run reconciliation queries (compare FileMaker vs Supabase)
   - [ ] Generate production import report

5. **Post-Import Validation** (1 day)
   - [ ] Compare customer counts (FileMaker vs Supabase)
   - [ ] Spot-check 20 random customers for data accuracy
   - [ ] Verify all emails/phones/addresses linked correctly
   - [ ] Check for orphaned records (should be 0)
   - [ ] Run backend API tests against migrated data
   - [ ] Sign off on data migration completion

**Deliverables**:
- All FileMaker customers imported to Supabase
- Related data (emails, phones, addresses) linked correctly
- Reconciliation report showing 100% data integrity
- Migration script artifacts (export JSON, transformation logs, import report)

**Acceptance Criteria**:
- Customer count in Supabase matches FileMaker (±0)
- 100% of UUIDs preserved (FileMaker `__ID` = Supabase `customers.id`)
- No orphaned records detected
- Spot-check sample shows 100% data accuracy
- All foreign key constraints satisfied

### Phase 4: Frontend Refactor (1 week)

**Owner**: Frontend team
**Status Gate**: Phase 3 complete

#### Tasks

1. **Feature Flag Implementation** (1 day)
   - [ ] Add `VITE_USE_SUPABASE_CUSTOMERS` environment variable
   - [ ] Update `src/api/customers.js` to route based on flag
   - [ ] Create routing layer: `if (USE_SUPABASE) { backend API } else { FileMaker }`
   - [ ] Test feature flag toggle (enable/disable)
   - [ ] Document feature flag usage

2. **Backend API Integration** (2-3 days)
   - [ ] Update `fetchCustomers` to call `GET /api/customers`
   - [ ] Update `fetchCustomerById` to call `GET /api/customers/:id`
   - [ ] Update `createCustomer` to call `POST /api/customers`
   - [ ] Update `updateCustomer` to call `PATCH /api/customers/:id`
   - [ ] Update `deleteCustomer` to call `DELETE /api/customers/:id`
   - [ ] Update `toggleCustomerStatus` to call `POST /api/customers/:id/toggle-status`
   - [ ] Update response transformations to match backend API format
   - [ ] Add error handling for backend API errors
   - [ ] Add retry logic for network failures

3. **State Management Updates** (1-2 days)
   - [ ] Update `useCustomer` hook to handle backend API responses
   - [ ] Remove `recordId` from customer state (Supabase uses `id` only)
   - [ ] Update `customerService.js` to transform backend API data
   - [ ] Update `AppStateContext` to handle Supabase customer structure
   - [ ] Test state updates with backend API

4. **UI Component Updates** (1-2 days)
   - [ ] Update `CustomerDetails.jsx` to display Supabase customer data
   - [ ] Update `CustomerForm.jsx` to submit to backend API
   - [ ] Update `CustomerList.jsx` to paginate with backend API
   - [ ] Update `CustomerSearch.jsx` to use backend search endpoint
   - [ ] Test all UI interactions with feature flag enabled

5. **Testing** (2 days)
   - [ ] Test all customer CRUD operations with feature flag enabled
   - [ ] Test pagination, filtering, sorting
   - [ ] Test search functionality
   - [ ] Test status toggle
   - [ ] Test error handling (network failures, validation errors)
   - [ ] Test with multiple users concurrently
   - [ ] Verify RLS policies work correctly (cross-org isolation)

**Deliverables**:
- Feature flag implemented and tested
- All customer operations routed to backend API when flag enabled
- UI fully functional with Supabase backend
- No breaking changes detected

**Acceptance Criteria**:
- All customer CRUD operations work with feature flag enabled
- Performance meets targets (list < 500ms, detail < 200ms)
- No JavaScript errors in console
- UI correctly displays all customer data fields
- Validation errors displayed correctly

### Phase 5: Gradual Rollout (1-2 weeks)

**Owner**: Product team + Frontend team
**Status Gate**: Phase 4 complete

#### Tasks

1. **Internal Testing** (3-5 days)
   - [ ] Enable feature flag for internal users only
   - [ ] Monitor error logs for issues
   - [ ] Monitor performance metrics
   - [ ] Collect user feedback on bugs/issues
   - [ ] Fix critical bugs (if any)
   - [ ] Run daily reconciliation checks (FileMaker vs Supabase)

2. **10% Rollout** (2-3 days)
   - [ ] Enable feature flag for 10% of users (via A/B testing or cohort)
   - [ ] Monitor error rates, latency, throughput
   - [ ] Monitor reconciliation status (data divergence)
   - [ ] Collect user feedback
   - [ ] Fix issues and iterate

3. **50% Rollout** (2-3 days)
   - [ ] Enable feature flag for 50% of users
   - [ ] Continue monitoring metrics
   - [ ] Run load tests to validate performance at scale
   - [ ] Fix performance issues (if any)

4. **100% Rollout** (1-2 days)
   - [ ] Enable feature flag for 100% of users
   - [ ] Monitor for 24-48 hours
   - [ ] Verify all users on Supabase backend
   - [ ] Run final reconciliation check
   - [ ] Sign off on cutover completion

**Deliverables**:
- 100% of users migrated to Supabase backend
- No critical bugs or performance issues
- Data consistency validated (FileMaker vs Supabase)

**Acceptance Criteria**:
- Feature flag enabled for 100% of users
- Error rate < 0.5% for all customer operations
- Performance targets met (p95 latency < 1s)
- No user-reported critical bugs
- Data reconciliation shows < 1% divergence (acceptable drift)

### Phase 6: Cleanup (1 week)

**Owner**: Frontend team + Backend team
**Status Gate**: 100% rollout validated for 1 week

#### Tasks

1. **Remove FileMaker Code** (2-3 days)
   - [ ] Remove feature flag from `.env` (make Supabase the default)
   - [ ] Remove FileMaker fallback code from `src/api/customers.js`
   - [ ] Remove dual-write logic from `src/hooks/useCustomer.js`
   - [ ] Remove FileMaker-specific transformations (`formatCustomerForFileMaker`)
   - [ ] Remove `recordId` references from codebase (search for `recordId` usage)
   - [ ] Remove FileMaker dependencies (if no other features use them)
   - [ ] Update imports and clean up dead code

2. **Documentation Updates** (1 day)
   - [ ] Update `README.md` to remove FileMaker customer references
   - [ ] Update `CLAUDE.md` to mark customers as Supabase-only
   - [ ] Archive migration plan and related docs
   - [ ] Document API usage for future developers
   - [ ] Update architecture diagrams

3. **Data Archival** (1 day)
   - [ ] Export final FileMaker customer snapshot
   - [ ] Archive FileMaker export in secure storage (30-90 day retention)
   - [ ] Disable FileMaker dual-write permanently
   - [ ] Remove FileMaker customer layout (optional, after retention period)

4. **Final Testing** (1 day)
   - [ ] Verify all customer operations still work post-cleanup
   - [ ] Run regression tests
   - [ ] Build and deploy final version
   - [ ] Monitor for 48 hours post-cleanup

**Deliverables**:
- FileMaker code removed from codebase
- Documentation updated
- FileMaker data archived
- Clean build with no warnings or errors

**Acceptance Criteria**:
- No FileMaker references in customer-related code
- Build succeeds with no errors
- All tests passing
- No user-reported issues after cleanup

---

## Data Backfill Strategy

### Overview

**Goal**: Migrate all FileMaker customers to Supabase while preserving IDs, relationships, and data integrity

**Approach**: One-time batch import using backend migration script

**Key Principle**: Direct UUID mapping (FileMaker `__ID` → Supabase `customers.id`)

### Step-by-Step Process

#### Step 1: Export FileMaker Data

**Method**: FileMaker Data API via backend script

**Backend Script**:
```python
import requests
import json

FM_SERVER = "https://server.claritybusinesssolutions.ca"
FM_DATABASE = "clarityCRM"
FM_LAYOUT = "devCustomers"
FM_USER = os.getenv("FM_USER")
FM_PASSWORD = os.getenv("FM_PASSWORD")

async def export_filemaker_customers():
    # Authenticate with FileMaker
    auth_response = requests.post(
        f"{FM_SERVER}/fmi/data/v1/databases/{FM_DATABASE}/sessions",
        auth=(FM_USER, FM_PASSWORD)
    )
    fm_token = auth_response.json()["response"]["token"]

    # Export all customers
    find_response = requests.post(
        f"{FM_SERVER}/fmi/data/v1/databases/{FM_DATABASE}/layouts/{FM_LAYOUT}/_find",
        headers={"Authorization": f"Bearer {fm_token}"},
        json={"query": [{"__ID": "*"}]}
    )

    customers = find_response.json()["response"]["data"]

    # Save export
    with open("filemaker_customers_export.json", "w") as f:
        json.dump(customers, f, indent=2)

    # Logout
    requests.delete(
        f"{FM_SERVER}/fmi/data/v1/databases/{FM_DATABASE}/sessions/{fm_token}"
    )

    return customers
```

**Export Format**:
```json
[
  {
    "fieldData": {
      "__ID": "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
      "Name": "Acme Corporation",
      "Email": "contact@acme.com",
      "phone": "+1 (403) 555-1234",
      "Address": "123 Main St",
      "City": "Calgary",
      "State": "AB",
      "PostalCode": "T2P 1K3",
      "Country": "Canada",
      "ContactPerson": "John Doe",
      "f_active": "1",
      "chargeRate": "150",
      "f_USD": "1",
      "f_EUR": "0",
      "f_prePay": "1000",
      "fundsAvailable": "750",
      "~creationTimestamp": "2023-01-15T10:30:00",
      "~modificationTimestamp": "2025-12-01T14:45:00"
    },
    "recordId": "42"
  }
]
```

#### Step 2: Transform Data

**Transformation Rules** (per [data-model-mapping.md](./data-model-mapping.md)):

```python
def transform_filemaker_to_supabase(fm_customers, organization_id):
    transformed = []

    for fm_record in fm_customers:
        fm_data = fm_record["fieldData"]

        # Core customer record
        customer = {
            "id": fm_data["__ID"],  # Direct UUID mapping
            "business_name": fm_data["Name"],
            "name": None,  # DEPRECATED field
            "first_name": None,
            "last_name": None,
            "type": "CUSTOMER",  # All FileMaker customers are type CUSTOMER
            "is_active": fm_data.get("f_active") == "1",
            "primary_contact_name": fm_data.get("ContactPerson"),
            "organization_id": organization_id,
            "created_at": fm_data.get("~creationTimestamp"),
            "updated_at": fm_data.get("~modificationTimestamp"),

            # Financial data (JSONB)
            "financial_data": {
                "charge_rate": float(fm_data.get("chargeRate", 0)),
                "currencies": {
                    "usd": fm_data.get("f_USD") == "1",
                    "eur": fm_data.get("f_EUR") == "1"
                },
                "prepay_amount": float(fm_data.get("f_prePay", 0)),
                "funds_available": float(fm_data.get("fundsAvailable", 0))
            },

            # Credentials (JSONB, encrypted)
            "encrypted_credentials": {
                "db_path": fm_data.get("dbPath"),
                "db_username": fm_data.get("dbUserName"),
                # Note: Store encrypted, not plaintext
                "db_password_encrypted": encrypt(fm_data.get("dbPasword"))
            } if fm_data.get("dbPath") else {}
        }

        # Related email record
        emails = []
        if fm_data.get("Email"):
            emails.append({
                "customer_id": fm_data["__ID"],
                "email": fm_data["Email"].lower(),  # Normalize to lowercase
                "is_primary": True,
                "email_type": "work"
            })

        # Related phone record
        phones = []
        if fm_data.get("phone"):
            phones.append({
                "customer_id": fm_data["__ID"],
                "phone": normalize_phone(fm_data["phone"]),  # E.164 format
                "is_primary": True,
                "phone_type": "office"
            })

        # Related address record
        addresses = []
        if fm_data.get("City") and fm_data.get("State"):
            addresses.append({
                "customer_id": fm_data["__ID"],
                "address_line1": fm_data.get("Address", ""),
                "address_line2": None,
                "city": fm_data["City"],
                "state": fm_data["State"],
                "postal_code": fm_data.get("PostalCode", ""),
                "country": fm_data.get("Country", "")
            })

        transformed.append({
            "customer": customer,
            "emails": emails,
            "phones": phones,
            "addresses": addresses
        })

    return transformed
```

**Normalization Functions**:

```python
import re
import phonenumbers

def normalize_phone(phone_str):
    """Convert phone to E.164 format"""
    try:
        parsed = phonenumbers.parse(phone_str, "US")  # Default US region
        return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except:
        return phone_str  # Return as-is if parsing fails

def encrypt(plaintext):
    """Encrypt sensitive data (implementation depends on backend crypto library)"""
    # Use Fernet, AES, or backend encryption service
    from cryptography.fernet import Fernet
    key = os.getenv("ENCRYPTION_KEY")
    f = Fernet(key)
    return f.encrypt(plaintext.encode()).decode()
```

#### Step 3: Validate Transformed Data

**Validation Checks**:

```python
import uuid
import re

def validate_transformed_data(transformed_customers):
    errors = []
    warnings = []

    seen_ids = set()

    for idx, record in enumerate(transformed_customers):
        customer = record["customer"]

        # 1. Check UUID validity
        try:
            uuid.UUID(customer["id"])
        except ValueError:
            errors.append(f"Customer {idx}: Invalid UUID '{customer['id']}'")

        # 2. Check for duplicate UUIDs
        if customer["id"] in seen_ids:
            errors.append(f"Customer {idx}: Duplicate UUID '{customer['id']}'")
        seen_ids.add(customer["id"])

        # 3. Check required fields
        if not customer["business_name"] or customer["business_name"].strip() == "":
            errors.append(f"Customer {idx}: Missing business_name")

        if not customer["organization_id"]:
            errors.append(f"Customer {idx}: Missing organization_id")

        # 4. Validate email format
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        for email in record["emails"]:
            if not re.match(email_regex, email["email"]):
                warnings.append(f"Customer {idx}: Invalid email format '{email['email']}'")

        # 5. Validate phone format (E.164)
        e164_regex = r'^\+[1-9]\d{1,14}$'
        for phone in record["phones"]:
            if not re.match(e164_regex, phone["phone"]):
                warnings.append(f"Customer {idx}: Phone not in E.164 format '{phone['phone']}'")

        # 6. Check timestamps
        if customer.get("created_at") and not is_valid_timestamp(customer["created_at"]):
            warnings.append(f"Customer {idx}: Invalid created_at timestamp")

    return {"errors": errors, "warnings": warnings}

def is_valid_timestamp(ts_str):
    from dateutil.parser import parse
    try:
        parse(ts_str)
        return True
    except:
        return False
```

**Validation Report**:
```json
{
  "total_customers": 52,
  "valid_customers": 50,
  "errors": [
    "Customer 23: Invalid UUID 'invalid-uuid-format'",
    "Customer 45: Missing business_name"
  ],
  "warnings": [
    "Customer 10: Phone not in E.164 format '+1 (403) 555-1234'",
    "Customer 18: Invalid email format 'bad-email@'"
  ],
  "action_required": "Fix 2 errors before import"
}
```

**Action on Validation Failure**:
- **Errors**: Fix in FileMaker or transformation script, re-export, re-validate
- **Warnings**: Review and decide whether to fix or accept

#### Step 4: Import to Supabase (Staging First)

**Method**: Backend API batch endpoint

**Backend Endpoint Implementation**:
```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

router = APIRouter()

@router.post("/api/customers/batch")
async def batch_create_customers(
    customers: List[CustomerBatchCreate],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Batch create customers with related records in a single transaction

    Request body:
    [
      {
        "customer": {...},
        "emails": [...],
        "phones": [...],
        "addresses": [...]
      }
    ]

    Returns:
    {
      "success": true,
      "data": {
        "inserted": 50,
        "failed": 0,
        "errors": []
      }
    }
    """
    inserted = 0
    failed = 0
    errors = []

    for batch_item in customers:
        try:
            async with db.begin():  # Start transaction
                # Insert customer
                customer = Customer(**batch_item.customer)
                db.add(customer)
                await db.flush()  # Get ID before committing

                # Insert emails
                for email_data in batch_item.emails:
                    email = CustomerEmail(**email_data)
                    db.add(email)

                # Insert phones
                for phone_data in batch_item.phones:
                    phone = CustomerPhone(**phone_data)
                    db.add(phone)

                # Insert addresses
                for address_data in batch_item.addresses:
                    address = CustomerAddress(**address_data)
                    db.add(address)

                # Link to organization
                org_link = CustomerOrganization(
                    customer_id=customer.id,
                    organization_id=current_user.organization_id
                )
                db.add(org_link)

                await db.commit()
                inserted += 1

        except Exception as e:
            await db.rollback()
            failed += 1
            errors.append({
                "customer_id": batch_item.customer.get("id"),
                "error": str(e)
            })

    return {
        "success": failed == 0,
        "data": {
            "inserted": inserted,
            "failed": failed,
            "errors": errors
        }
    }
```

**Import Script Usage**:
```bash
# Import to staging
curl -X POST "https://api-staging.claritybusinesssolutions.ca/api/customers/batch" \
  -H "Authorization: Bearer {hmac_signature}.{timestamp}" \
  -H "Content-Type: application/json" \
  -d @transformed_customers.json

# Response:
{
  "success": true,
  "data": {
    "inserted": 52,
    "failed": 0,
    "errors": []
  }
}
```

#### Step 5: Verify Import

**Verification Queries**:

```sql
-- 1. Check record counts
SELECT 'Customers' AS entity, COUNT(*) AS count
FROM customers
WHERE organization_id = 'org-uuid'
UNION ALL
SELECT 'Emails', COUNT(*)
FROM customer_email
WHERE customer_id IN (SELECT id FROM customers WHERE organization_id = 'org-uuid')
UNION ALL
SELECT 'Phones', COUNT(*)
FROM customer_phone
WHERE customer_id IN (SELECT id FROM customers WHERE organization_id = 'org-uuid')
UNION ALL
SELECT 'Addresses', COUNT(*)
FROM customer_address
WHERE customer_id IN (SELECT id FROM customers WHERE organization_id = 'org-uuid');

-- Expected output:
-- Customers: 52
-- Emails: 48 (some customers may not have emails)
-- Phones: 50
-- Addresses: 45

-- 2. Check for orphaned emails (should be 0)
SELECT COUNT(*) AS orphaned_emails
FROM customer_email ce
LEFT JOIN customers c ON c.id = ce.customer_id
WHERE c.id IS NULL;

-- 3. Check for orphaned phones (should be 0)
SELECT COUNT(*) AS orphaned_phones
FROM customer_phone cp
LEFT JOIN customers c ON c.id = cp.customer_id
WHERE c.id IS NULL;

-- 4. Check for orphaned addresses (should be 0)
SELECT COUNT(*) AS orphaned_addresses
FROM customer_address ca
LEFT JOIN customers c ON c.id = ca.customer_id
WHERE c.id IS NULL;

-- 5. Check for customers without organization link (should be 0)
SELECT COUNT(*) AS customers_without_org
FROM customers c
LEFT JOIN customer_organization co ON co.customer_id = c.id
WHERE co.customer_id IS NULL;

-- 6. Check for duplicate UUIDs (should be 0)
SELECT id, COUNT(*) AS duplicates
FROM customers
GROUP BY id
HAVING COUNT(*) > 1;

-- 7. Spot-check data accuracy (sample 10 random customers)
SELECT id, business_name, is_active, created_at
FROM customers
WHERE organization_id = 'org-uuid'
ORDER BY RANDOM()
LIMIT 10;
```

**Reconciliation Report**:

```python
async def generate_reconciliation_report(org_id):
    """Compare FileMaker export vs Supabase import"""

    # Load FileMaker export
    with open("filemaker_customers_export.json") as f:
        fm_customers = json.load(f)

    # Query Supabase
    sb_customers = await db.query(Customer).filter_by(organization_id=org_id).all()

    fm_ids = {c["fieldData"]["__ID"] for c in fm_customers}
    sb_ids = {c.id for c in sb_customers}

    report = {
        "filemaker_count": len(fm_customers),
        "supabase_count": len(sb_customers),
        "missing_in_supabase": list(fm_ids - sb_ids),
        "extra_in_supabase": list(sb_ids - fm_ids),
        "data_mismatches": []
    }

    # Spot-check 20 random customers for data accuracy
    sample = random.sample(list(fm_ids & sb_ids), min(20, len(fm_ids)))
    for customer_id in sample:
        fm_customer = next(c for c in fm_customers if c["fieldData"]["__ID"] == customer_id)
        sb_customer = next(c for c in sb_customers if c.id == customer_id)

        if fm_customer["fieldData"]["Name"] != sb_customer.business_name:
            report["data_mismatches"].append({
                "customer_id": customer_id,
                "field": "business_name",
                "filemaker_value": fm_customer["fieldData"]["Name"],
                "supabase_value": sb_customer.business_name
            })

        if (fm_customer["fieldData"].get("f_active") == "1") != sb_customer.is_active:
            report["data_mismatches"].append({
                "customer_id": customer_id,
                "field": "is_active",
                "filemaker_value": fm_customer["fieldData"].get("f_active"),
                "supabase_value": sb_customer.is_active
            })

    return report
```

**Expected Reconciliation Report**:
```json
{
  "filemaker_count": 52,
  "supabase_count": 52,
  "missing_in_supabase": [],
  "extra_in_supabase": [],
  "data_mismatches": []
}
```

**Action on Discrepancies**:
- **Missing in Supabase**: Re-run import for those customers
- **Extra in Supabase**: Investigate (may be web app-created customers)
- **Data Mismatches**: Fix transformation script and re-import

#### Step 6: Production Import

**Process**:
1. Schedule maintenance window (optional, depends on cutover strategy)
2. Run same import process on production Supabase
3. Verify reconciliation report
4. Enable feature flag for testing
5. Monitor for issues

**Rollback Plan**: See [Rollback Procedures](#rollback-procedures)

---

## ID Reconciliation Implementation

### Direct UUID Mapping Strategy

**Strategy**: Use FileMaker `__ID` (UUID) directly as Supabase `customers.id`

**Rationale**:
- No lookup table required
- Preserves foreign key references automatically
- Simplifies migration logic
- Fast UUID queries in PostgreSQL

**Reference**: [id-reconciliation-strategy.md](./id-reconciliation-strategy.md)

### Implementation Details

**During Migration**:
```python
# Preserve FileMaker UUID as Supabase ID
customer_data = {
    "id": filemaker_customer["__ID"],  # Direct mapping
    "business_name": filemaker_customer["Name"],
    # ...
}
```

**After Migration** (Supabase-only mode):
```javascript
// All operations use UUID only (no recordId)
const customer = await fetchCustomerById(customerId);  // UUID-based query
await updateCustomer(customerId, data);                // UUID-based update
await deleteCustomer(customerId);                      // UUID-based delete
```

### Code Refactoring Requirements

**Remove `recordId` References**:

**Files to Update**:
- `src/api/customers.js` (lines 50, 86, 130)
- `src/hooks/useCustomer.js` (line 165)
- `src/services/customerService.js` (lines 18-19)

**Example Refactor**:

**Before** (FileMaker mode):
```javascript
// src/api/customers.js
export async function updateCustomer(customerId, data) {
  return handleFileMakerOperation(async () => {
    return await updateRecordInFileMaker({
      layout: Layouts.CUSTOMERS,
      recordId: customerId,  // Uses recordId (integer)
      fieldData: data
    });
  });
}
```

**After** (Supabase mode):
```javascript
// src/api/customers.js
export async function updateCustomer(customerId, data) {
  return backendAPI.patch(`/api/customers/${customerId}`, data);  // Uses UUID
}
```

### Foreign Key Preservation

**Related Tables** that reference `customers.id`:

| Table | FK Column | Preserved? |
|-------|-----------|------------|
| `customer_email` | `customer_id` | ✅ Yes (same UUID) |
| `customer_phone` | `customer_id` | ✅ Yes (same UUID) |
| `customer_address` | `customer_id` | ✅ Yes (same UUID) |
| `customer_contacts` | `customer_id` | ✅ Yes (same UUID) |
| `customer_organization` | `customer_id` | ✅ Yes (same UUID) |
| `projects` | `customer_id` | ✅ Yes (same UUID) |
| `proposals` | `customer_id` | ✅ Yes (same UUID) |
| `customer_sales` | `customer_id` | ✅ Yes (same UUID) |

**Migration Impact**: **Zero** - All foreign keys automatically valid because UUIDs are preserved

---

## Cutover Approach

### Recommended: Feature Flag with Gradual Rollout

**Strategy**: Use environment variable to toggle between FileMaker and Supabase backends

**Advantages**:
- ✅ Safe rollback (disable flag)
- ✅ Gradual testing with real users
- ✅ Monitor metrics per cohort
- ✅ Limit blast radius of issues

**Disadvantages**:
- ⚠️ More complex code (dual paths)
- ⚠️ Requires A/B testing infrastructure (or manual flag per user)

### Implementation

#### 1. Environment Variable

**Add to `.env`**:
```bash
# Feature flag for Supabase customers migration
VITE_USE_SUPABASE_CUSTOMERS=false  # Default: FileMaker
```

#### 2. API Router Layer

**Update `src/api/customers.js`**:

```javascript
const USE_SUPABASE = import.meta.env.VITE_USE_SUPABASE_CUSTOMERS === 'true';

export async function fetchCustomers() {
  if (USE_SUPABASE) {
    // Supabase backend API
    const response = await backendAPI.get('/api/customers', {
      params: { include_related: true }
    });
    return response.data;
  } else {
    // FileMaker fallback
    return handleFileMakerOperation(async () => {
      return await fetchDataFromFileMaker({
        layout: Layouts.CUSTOMERS,
        action: Actions.READ,
        query: [{ "__ID": "*" }]
      });
    });
  }
}

export async function fetchCustomerById(customerId) {
  if (USE_SUPABASE) {
    const response = await backendAPI.get(`/api/customers/${customerId}`);
    return response.data;
  } else {
    return handleFileMakerOperation(async () => {
      return await fetchDataFromFileMaker({
        layout: Layouts.CUSTOMERS,
        action: Actions.READ,
        query: [{ "__ID": customerId }]
      });
    });
  }
}

export async function createCustomer(customerData) {
  if (USE_SUPABASE) {
    const response = await backendAPI.post('/api/customers', customerData);
    return response.data;
  } else {
    return handleFileMakerOperation(async () => {
      return await createRecordInFileMaker({
        layout: Layouts.CUSTOMERS,
        fieldData: customerData
      });
    });
  }
}

export async function updateCustomer(customerId, customerData) {
  if (USE_SUPABASE) {
    const response = await backendAPI.patch(`/api/customers/${customerId}`, customerData);
    return response.data;
  } else {
    return handleFileMakerOperation(async () => {
      return await updateRecordInFileMaker({
        layout: Layouts.CUSTOMERS,
        recordId: customerId,  // Note: FileMaker expects recordId here
        fieldData: customerData
      });
    });
  }
}

export async function deleteCustomer(customerId) {
  if (USE_SUPABASE) {
    const response = await backendAPI.delete(`/api/customers/${customerId}`);
    return response.data;
  } else {
    return handleFileMakerOperation(async () => {
      return await deleteRecordFromFileMaker({
        layout: Layouts.CUSTOMERS,
        recordId: customerId
      });
    });
  }
}

export async function toggleCustomerStatus(customerId, active) {
  if (USE_SUPABASE) {
    const response = await backendAPI.post(`/api/customers/${customerId}/toggle-status`, {
      is_active: active
    });
    return response.data;
  } else {
    return handleFileMakerOperation(async () => {
      return await updateRecordInFileMaker({
        layout: Layouts.CUSTOMERS,
        recordId: customerId,
        fieldData: { f_active: active ? "1" : "0" }
      });
    });
  }
}
```

#### 3. Response Transformation

**Update `src/services/customerService.js`**:

```javascript
export function processCustomerData(rawCustomer) {
  // Check if data is from FileMaker or Supabase
  const isFileMaker = rawCustomer.fieldData !== undefined;

  if (isFileMaker) {
    // FileMaker format
    return {
      id: rawCustomer.fieldData.__ID,
      recordId: rawCustomer.recordId,  // Keep for FileMaker updates
      name: rawCustomer.fieldData.Name,
      email: rawCustomer.fieldData.Email,
      phone: rawCustomer.fieldData.phone,
      // ...
    };
  } else {
    // Supabase format
    return {
      id: rawCustomer.id,
      // No recordId in Supabase mode
      name: rawCustomer.business_name,
      email: rawCustomer.emails?.[0]?.email,
      phone: rawCustomer.phones?.[0]?.phone,
      // ...
    };
  }
}
```

### Rollout Phases

#### Phase 1: Internal Testing (3-5 days)

**Configuration**:
```bash
# .env.development
VITE_USE_SUPABASE_CUSTOMERS=true
```

**Scope**: Internal users only (5-10 users)

**Monitoring**:
- Watch error logs for backend API failures
- Check console for JavaScript errors
- Monitor latency metrics
- Collect user feedback via Slack

**Exit Criteria**:
- No critical bugs
- All CRUD operations working
- Performance acceptable (< 1s latency)

#### Phase 2: 10% Rollout (2-3 days)

**Configuration**:
```javascript
// Implement A/B testing logic
const USE_SUPABASE = import.meta.env.VITE_USE_SUPABASE_CUSTOMERS === 'true'
  || (user.id % 10 === 0);  // 10% of users based on user ID
```

**Scope**: 10% of external users (~5-10 users)

**Monitoring**:
- Error rate by cohort (Supabase vs FileMaker)
- Latency p50, p95, p99 by cohort
- Data consistency (reconciliation checks)

**Exit Criteria**:
- Error rate < 1%
- Latency within acceptable range
- No data loss reported

#### Phase 3: 50% Rollout (2-3 days)

**Configuration**:
```javascript
const USE_SUPABASE = import.meta.env.VITE_USE_SUPABASE_CUSTOMERS === 'true'
  || (user.id % 2 === 0);  // 50% of users
```

**Scope**: 50% of external users

**Monitoring**: Same as 10% rollout

**Exit Criteria**: Same as 10% rollout

#### Phase 4: 100% Rollout (1-2 days)

**Configuration**:
```bash
# .env.production
VITE_USE_SUPABASE_CUSTOMERS=true
```

**Scope**: All users

**Monitoring**: Monitor for 24-48 hours before declaring success

**Exit Criteria**:
- Error rate < 0.5%
- No user-reported critical bugs
- Data reconciliation shows < 1% divergence

### Alternative: Hard Cutover

**When to Use**: If gradual rollout is not feasible (no A/B infrastructure)

**Process**:
1. Test thoroughly in staging
2. Schedule maintenance window (late Friday night)
3. Deploy backend changes
4. Run data migration script
5. Deploy frontend changes (feature flag enabled)
6. Monitor for 24 hours
7. Rollback if critical issues

**Advantages**: Simpler code, faster cleanup

**Disadvantages**: Higher risk, difficult rollback

---

## Validation & Reconciliation

### Pre-Migration Validation

**Goal**: Ensure FileMaker data is ready for migration

**Validation Checks**:

```python
async def pre_migration_validation():
    """Run before importing to Supabase"""

    # Load FileMaker export
    fm_customers = load_filemaker_export()

    report = {
        "total_customers": len(fm_customers),
        "validation_errors": [],
        "validation_warnings": []
    }

    for idx, customer in enumerate(fm_customers):
        fm_data = customer["fieldData"]

        # 1. Check for valid UUID
        if not is_valid_uuid(fm_data.get("__ID")):
            report["validation_errors"].append({
                "customer_index": idx,
                "error": "Invalid or missing __ID",
                "value": fm_data.get("__ID")
            })

        # 2. Check for required fields
        if not fm_data.get("Name"):
            report["validation_errors"].append({
                "customer_index": idx,
                "error": "Missing required field: Name"
            })

        # 3. Check email format
        if fm_data.get("Email") and not is_valid_email(fm_data["Email"]):
            report["validation_warnings"].append({
                "customer_index": idx,
                "warning": "Invalid email format",
                "value": fm_data["Email"]
            })

        # 4. Check phone format
        if fm_data.get("phone") and not is_valid_phone(fm_data["phone"]):
            report["validation_warnings"].append({
                "customer_index": idx,
                "warning": "Phone not in E.164 format",
                "value": fm_data["phone"]
            })

        # 5. Check for duplicate UUIDs
        # (handled by set-based check separately)

    # Check for duplicate UUIDs
    uuids = [c["fieldData"]["__ID"] for c in fm_customers if c["fieldData"].get("__ID")]
    duplicates = [uid for uid in set(uuids) if uuids.count(uid) > 1]
    if duplicates:
        report["validation_errors"].append({
            "error": "Duplicate UUIDs found",
            "uuids": duplicates
        })

    # Determine if migration can proceed
    report["can_proceed"] = len(report["validation_errors"]) == 0

    return report
```

**Expected Output**:
```json
{
  "total_customers": 52,
  "validation_errors": [],
  "validation_warnings": [
    {
      "customer_index": 12,
      "warning": "Phone not in E.164 format",
      "value": "+1 (403) 555-1234"
    }
  ],
  "can_proceed": true
}
```

**Action on Validation Failure**:
- **Errors**: Fix in FileMaker or transformation script, re-validate
- **Warnings**: Review and decide whether to fix or accept

### Post-Migration Reconciliation

**Goal**: Verify FileMaker and Supabase data match after migration

**Reconciliation Queries**:

```sql
-- 1. Count comparison
SELECT
  'FileMaker' AS system,
  COUNT(*) AS customer_count,
  COUNT(CASE WHEN f_active = '1' THEN 1 END) AS active_count
FROM filemaker_customers_export
UNION ALL
SELECT
  'Supabase',
  COUNT(*),
  COUNT(CASE WHEN is_active = true THEN 1 END)
FROM customers
WHERE organization_id = 'org-uuid';

-- Expected: Counts should match exactly

-- 2. Missing customers (in FileMaker but not Supabase)
SELECT fm.__ID, fm.Name
FROM filemaker_customers_export fm
LEFT JOIN customers sb ON sb.id = fm.__ID::uuid
WHERE sb.id IS NULL;

-- Expected: 0 rows

-- 3. Extra customers (in Supabase but not FileMaker)
SELECT sb.id, sb.business_name
FROM customers sb
LEFT JOIN filemaker_customers_export fm ON fm.__ID::uuid = sb.id
WHERE fm.__ID IS NULL
  AND sb.organization_id = 'org-uuid';

-- Expected: May have rows (web app-created customers)

-- 4. Data mismatches (spot-check 50 random customers)
SELECT
  sb.id,
  'business_name' AS field,
  fm.Name AS filemaker_value,
  sb.business_name AS supabase_value
FROM customers sb
JOIN filemaker_customers_export fm ON fm.__ID::uuid = sb.id
WHERE sb.business_name != fm.Name
  AND sb.organization_id = 'org-uuid'
ORDER BY RANDOM()
LIMIT 50;

-- Expected: 0 rows (or acceptable differences)

-- 5. Orphaned related records
SELECT 'Orphaned Emails' AS issue, COUNT(*)
FROM customer_email ce
LEFT JOIN customers c ON c.id = ce.customer_id
WHERE c.id IS NULL
UNION ALL
SELECT 'Orphaned Phones', COUNT(*)
FROM customer_phone cp
LEFT JOIN customers c ON c.id = cp.customer_id
WHERE c.id IS NULL
UNION ALL
SELECT 'Orphaned Addresses', COUNT(*)
FROM customer_address ca
LEFT JOIN customers c ON c.id = ca.customer_id
WHERE c.id IS NULL;

-- Expected: All counts = 0
```

**Reconciliation Report Template**:

```markdown
# Customer Migration Reconciliation Report

**Date**: 2026-01-XX
**Performed By**: [Name]
**Organization**: [Org Name]

## Summary

| Metric | FileMaker | Supabase | Match? |
|--------|-----------|----------|--------|
| Total Customers | 52 | 52 | ✅ |
| Active Customers | 48 | 48 | ✅ |
| Inactive Customers | 4 | 4 | ✅ |
| Emails | 50 | 50 | ✅ |
| Phones | 51 | 51 | ✅ |
| Addresses | 45 | 45 | ✅ |

## Discrepancies

### Missing in Supabase (0)
None

### Extra in Supabase (2)
- `uuid-web-1`: "Web App Customer 1" (created in web app, not in FileMaker)
- `uuid-web-2`: "Web App Customer 2" (created in web app, not in FileMaker)

**Action**: No action needed (expected)

### Data Mismatches (0)
None

### Orphaned Records (0)
None

## Spot-Check Sample (20 customers)

All 20 randomly selected customers verified:
- business_name matches Name ✅
- is_active matches f_active ✅
- Emails match ✅
- Phones match ✅

## Conclusion

✅ Migration successful
✅ Data integrity verified
✅ Ready for Supabase-only mode

**Sign-off**: [Name], [Date]
```

### Ongoing Reconciliation (During Dual-Write Period)

**Goal**: Detect data divergence between FileMaker and Supabase

**Frequency**: Daily (automated job)

**Reconciliation Script**:

```javascript
// scripts/daily-reconciliation.js
import { fetchCustomers as fetchFileMakerCustomers } from './filemaker-api';
import { query } from './supabase-api';

async function dailyReconciliation(organizationId) {
  const report = {
    timestamp: new Date().toISOString(),
    organization_id: organizationId,
    discrepancies: []
  };

  // Fetch from both systems
  const fmCustomers = await fetchFileMakerCustomers();
  const sbCustomers = await query('customers', {
    filter: { organization_id: organizationId }
  });

  // Compare counts
  if (fmCustomers.length !== sbCustomers.length) {
    report.discrepancies.push({
      type: 'count_mismatch',
      filemaker_count: fmCustomers.length,
      supabase_count: sbCustomers.length,
      diff: Math.abs(fmCustomers.length - sbCustomers.length)
    });
  }

  // Spot-check 10 random customers for data accuracy
  const sample = fmCustomers.slice(0, 10);
  for (const fmCustomer of sample) {
    const sbCustomer = sbCustomers.find(c => c.id === fmCustomer.id);

    if (!sbCustomer) {
      report.discrepancies.push({
        type: 'missing_in_supabase',
        customer_id: fmCustomer.id,
        business_name: fmCustomer.name
      });
      continue;
    }

    if (fmCustomer.name !== sbCustomer.business_name) {
      report.discrepancies.push({
        type: 'data_mismatch',
        customer_id: fmCustomer.id,
        field: 'business_name',
        filemaker_value: fmCustomer.name,
        supabase_value: sbCustomer.business_name
      });
    }
  }

  // Send report if discrepancies found
  if (report.discrepancies.length > 0) {
    await sendAlertEmail(report);
  }

  return report;
}
```

**Alert Threshold**:
- **Warning**: 1-5% divergence (< 3 customers out of 52)
- **Critical**: > 5% divergence (> 3 customers)

**Action on Alert**:
- Investigate root cause (failed dual-write, race condition, bug)
- Run manual reconciliation to fix discrepancies
- Update dual-write logic to prevent recurrence

---

## Rollback Procedures

### Rollback Scenario 1: Feature Flag Rollback (Within 24 Hours)

**Trigger**: Critical bugs, data corruption, performance issues

**Impact**: Low (instant rollback)

**Procedure**:

1. **Disable Feature Flag**:
   ```bash
   # Update .env or environment variable
   VITE_USE_SUPABASE_CUSTOMERS=false
   ```

2. **Redeploy Frontend** (if env vars not hot-reloaded):
   ```bash
   npm run build
   npm run deploy
   ```

3. **Verify Rollback**:
   - All users see FileMaker data
   - Customer operations route to FileMaker
   - No JavaScript errors in console

4. **Investigate Issues**:
   - Review error logs
   - Identify root cause
   - Fix bugs in Supabase backend or frontend code

5. **Sync Changes Made During Supabase-Enabled Period**:
   ```javascript
   // Identify customers created/updated in Supabase during outage
   const supabaseOnlyChanges = await query('customers', {
     filter: {
       organization_id: orgId,
       updated_at: { gte: rollbackTimestamp }
     }
   });

   // Manually sync to FileMaker
   for (const customer of supabaseOnlyChanges) {
     await syncCustomerToFileMaker(customer);
   }
   ```

6. **Re-enable When Ready**:
   - Fix issues
   - Test in staging
   - Re-enable feature flag

**Data Implications**:
- Customers created in Supabase-only mode may be lost (if not dual-written to FileMaker)
- Need manual reconciliation for changes made during outage period

### Rollback Scenario 2: Partial Rollback (After 24 Hours)

**Trigger**: Major issues discovered after rollout complete

**Impact**: Medium (requires code revert)

**Procedure**:

1. **Revert Frontend Code**:
   ```bash
   git revert <commit-hash-of-migration>
   git push origin main
   npm run build
   npm run deploy
   ```

2. **Verify Users on FileMaker**:
   - Check feature flag is disabled
   - Verify customer operations work

3. **Export Supabase Changes**:
   ```sql
   -- Export customers created/updated since cutover
   SELECT * FROM customers
   WHERE organization_id = 'org-uuid'
     AND (created_at >= 'cutover-timestamp' OR updated_at >= 'cutover-timestamp')
   ORDER BY created_at;
   ```

4. **Import to FileMaker**:
   ```javascript
   // Sync Supabase changes back to FileMaker
   for (const customer of supabaseChanges) {
     await createOrUpdateFileMakerCustomer(customer);
   }
   ```

5. **Reconcile Data**:
   - Run reconciliation report
   - Fix discrepancies manually

6. **Re-plan Migration**:
   - Document lessons learned
   - Address root causes
   - Re-test before next attempt

**Complexity**: High - requires bi-directional sync

### Rollback Scenario 3: Full Rollback (Last Resort)

**Trigger**: Unrecoverable data corruption, complete system failure

**Impact**: High (data loss possible)

**Procedure**:

1. **Restore FileMaker from Backup**:
   ```bash
   # If FileMaker data was modified during migration
   ssh marcus@backend.claritybusinesssolutions.ca "restore-filemaker-backup.sh"
   ```

2. **Revert All Code Changes**:
   ```bash
   git revert <range-of-commits>
   git push origin main
   npm run build
   npm run deploy
   ```

3. **Drop Supabase Customer Tables** (optional):
   ```sql
   -- Mark as archived instead of dropping
   UPDATE customers SET archived_at = now() WHERE organization_id = 'org-uuid';
   ```

4. **Re-assess Migration Strategy**:
   - Full retrospective
   - Identify systemic issues
   - Consider alternative approaches

**Note**: This should be extremely rare with proper testing and gradual rollout

### Rollback Decision Matrix

| Issue Severity | Time Since Cutover | Recommended Rollback |
|---------------|-------------------|---------------------|
| **Critical** (data loss) | < 24 hours | Feature flag rollback |
| **Critical** | > 24 hours | Partial rollback + manual sync |
| **Major** (bugs, no data loss) | < 24 hours | Feature flag rollback |
| **Major** | > 24 hours | Fix forward (hot patch) |
| **Minor** (UI glitches) | Any | Fix forward |
| **Performance** (slowness) | < 24 hours | Feature flag rollback |
| **Performance** | > 24 hours | Optimize, then retry |

---

## Performance Benchmarks

### Target Performance Metrics

| Operation | FileMaker (Current) | Supabase (Target) | Improvement |
|-----------|-------------------|------------------|-------------|
| List customers (50) | 250-550ms | < 200ms | 2-3x faster |
| Get customer by ID | 105-310ms | < 100ms | 2-3x faster |
| Create customer | 200-400ms | < 150ms | 2x faster |
| Update customer | 550-1200ms (dual-write) | < 200ms | 5x faster |
| Delete customer | 150-300ms | < 100ms | 2x faster |
| Search customers | 300-600ms | < 150ms | 3x faster |

**Rationale for Targets**:
- Supabase queries use indexed UUIDs (fast primary key lookups)
- Backend API reduces network round-trips (batch operations)
- No dual-write overhead in Supabase-only mode

### Performance Testing Plan

**Load Testing**:

```bash
# Use Apache Bench or k6 for load testing
k6 run load-test.js
```

**Load Test Script** (`load-test.js`):
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 10 },  // Ramp up to 10 users
    { duration: '5m', target: 10 },  // Stay at 10 users
    { duration: '2m', target: 20 },  // Ramp up to 20 users
    { duration: '5m', target: 20 },  // Stay at 20 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
};

export default function () {
  // List customers
  let listResponse = http.get('https://api.claritybusinesssolutions.ca/api/customers', {
    headers: { 'Authorization': generateAuthHeader() }
  });
  check(listResponse, {
    'list status is 200': (r) => r.status === 200,
    'list response time < 200ms': (r) => r.timings.duration < 200,
  });

  // Get customer by ID
  let customerId = JSON.parse(listResponse.body).data.customers[0].id;
  let getResponse = http.get(`https://api.claritybusinesssolutions.ca/api/customers/${customerId}`, {
    headers: { 'Authorization': generateAuthHeader() }
  });
  check(getResponse, {
    'get status is 200': (r) => r.status === 200,
    'get response time < 100ms': (r) => r.timings.duration < 100,
  });

  sleep(1);
}
```

**Performance Metrics to Track**:
- Response time (p50, p95, p99)
- Throughput (requests per second)
- Error rate
- Database query time
- Cache hit rate (if caching implemented)

**Acceptance Criteria**:
- p95 latency < 300ms for all operations
- Error rate < 0.5%
- Throughput > 50 req/s (for 50 concurrent users)

### Database Query Optimization

**Indexes Required** (verify in backend schema):

```sql
-- Primary key index (automatic)
CREATE UNIQUE INDEX customers_pkey ON customers(id);

-- Organization scoping index (for RLS)
CREATE INDEX idx_customers_org ON customers(organization_id);

-- Active status index (for filtering)
CREATE INDEX idx_customers_active ON customers(is_active) WHERE is_active = true;

-- Business name index (for search/autocomplete)
CREATE INDEX idx_customers_business_name ON customers USING gin(to_tsvector('english', business_name));

-- Combined org + type index (for common queries)
CREATE INDEX idx_customers_org_type ON customers(organization_id, type);

-- Created_at index (for sorting)
CREATE INDEX idx_customers_created_at ON customers(created_at DESC);

-- Related tables indexes
CREATE INDEX idx_customer_email_customer_id ON customer_email(customer_id);
CREATE INDEX idx_customer_phone_customer_id ON customer_phone(customer_id);
CREATE INDEX idx_customer_address_customer_id ON customer_address(customer_id);
```

**Query Performance Validation**:

```sql
-- Explain analyze for common queries
EXPLAIN ANALYZE
SELECT c.*, ce.email, cp.phone
FROM customers c
LEFT JOIN customer_email ce ON ce.customer_id = c.id AND ce.is_primary = true
LEFT JOIN customer_phone cp ON cp.customer_id = c.id AND cp.is_primary = true
WHERE c.organization_id = 'org-uuid'
  AND c.is_active = true
ORDER BY c.business_name
LIMIT 50;

-- Expected: Index scan on idx_customers_org, execution time < 10ms
```

---

## Risk Assessment & Mitigation

### Risk Matrix

| Risk ID | Risk Description | Likelihood | Impact | Severity | Mitigation Strategy | Owner |
|---------|-----------------|------------|--------|----------|-------------------|-------|
| R001 | Data loss during migration | Low | High | **High** | Test on staging first, validate counts, keep FM backup for 90 days | Backend |
| R002 | UUID conflicts/collisions | Very Low | High | Medium | Pre-migration validation, check for duplicates | Backend |
| R003 | Performance degradation | Medium | Medium | **Medium** | Load testing, query optimization, indexes | Backend |
| R004 | Incomplete dual-write coverage | High | High | **High** | Complete CREATE/DELETE/STATUS dual-write before migration | Frontend |
| R005 | User disruption during cutover | Low | High | **Medium** | Gradual rollout, feature flag for instant rollback | Product |
| R006 | Foreign key integrity violations | Low | High | **Medium** | Validate foreign keys pre-migration, test cascade deletes | Backend |
| R007 | Timezone/timestamp conversion errors | Low | Medium | Low | Test timestamp conversions, verify timezone consistency | Backend |
| R008 | Missing field mappings | Low | Medium | Low | Complete field audit, map all FM fields to Supabase | Frontend |
| R009 | RLS policy bypass | Very Low | Critical | **High** | Test RLS with multiple organizations, verify cross-org isolation | Backend |
| R010 | Retry queue overflow | Medium | Medium | **Medium** | Monitor queue size, implement max retry limit, alert on failures | Frontend |
| R011 | Backend API rate limiting | Low | Medium | Low | Implement request throttling, optimize batch operations | Backend |
| R012 | Network failures during migration | Medium | Medium | **Medium** | Retry logic, transaction rollback, idempotency keys | Backend |

### High-Priority Risk Mitigation

#### R001: Data Loss During Migration

**Mitigation Steps**:
1. ✅ Test migration script on staging with full dataset clone
2. ✅ Validate record counts pre/post migration (must match exactly)
3. ✅ Keep FileMaker backup for 90 days (daily snapshots)
4. ✅ Run reconciliation report and spot-checks before declaring success
5. ✅ Implement rollback procedure (tested in staging)

**Validation**:
- Run migration on staging 3 times successfully
- Verify 100% data integrity in staging
- Document rollback procedure with step-by-step commands

#### R004: Incomplete Dual-Write Coverage

**Mitigation Steps**:
1. ✅ Complete dual-write for CREATE, DELETE, STATUS_TOGGLE operations
2. ✅ Implement retry queue for failed Supabase writes
3. ✅ Add integration tests for all dual-write scenarios
4. ✅ Monitor dual-write success rate (target: 100%)
5. ✅ Run daily reconciliation checks during dual-write period

**Validation**:
- All customer operations successfully dual-write in 100+ test operations
- Retry queue recovers from simulated network failures
- Reconciliation report shows 0% divergence after 1 week

#### R009: RLS Policy Bypass

**Mitigation Steps**:
1. ✅ Implement RLS policies for all customer tables
2. ✅ Test with multiple organizations (verify cross-org isolation)
3. ✅ Test with multiple roles (admin, staff, read_only, external)
4. ✅ Use service role only in backend (never expose to frontend)
5. ✅ Audit RLS policy effectiveness with penetration testing

**Validation**:
- Create 2+ test organizations with separate users
- Verify users cannot access other org's customers (via Supabase client)
- Attempt direct Supabase queries from frontend (should fail)
- Verify backend API enforces organization scoping

---

## Post-Migration Monitoring

### Metrics to Track

**Application Metrics**:

| Metric | Target | Alert Threshold | Tool |
|--------|--------|----------------|------|
| Customer list latency (p95) | < 300ms | > 1000ms | Backend monitoring |
| Customer detail latency (p95) | < 200ms | > 500ms | Backend monitoring |
| Create customer latency (p95) | < 300ms | > 1000ms | Backend monitoring |
| Update customer latency (p95) | < 300ms | > 1000ms | Backend monitoring |
| Error rate (all operations) | < 0.5% | > 1% | Backend monitoring |
| Throughput (req/s) | > 50 | < 20 | Backend monitoring |

**Data Metrics**:

| Metric | Target | Alert Threshold | Tool |
|--------|--------|----------------|------|
| Customer count (daily) | Stable ± 5% | > 10% change | Automated script |
| Data divergence (FM vs SB) | < 1% | > 5% | Daily reconciliation |
| Orphaned records | 0 | > 0 | Daily reconciliation |
| Failed dual-writes in queue | < 5 | > 20 | Frontend monitoring |

**User Metrics**:

| Metric | Target | Alert Threshold | Tool |
|--------|--------|----------------|------|
| User-reported bugs | < 2/week | > 5/week | Support tickets |
| User satisfaction | > 4/5 | < 3/5 | User survey |
| Customer operation success rate | > 99% | < 95% | Backend logs |

### Monitoring Tools

**Backend Monitoring**:
- Application Performance Monitoring (APM): DataDog, New Relic, or Sentry
- Database monitoring: Supabase dashboard, pg_stat_statements
- Error tracking: Sentry

**Frontend Monitoring**:
- JavaScript error tracking: Sentry
- Performance monitoring: Lighthouse, WebPageTest
- User session recording: LogRocket, FullStory

**Alerting**:
- Slack notifications for critical alerts
- Email digest for warnings
- PagerDuty for critical production issues

### Monitoring Dashboard

**Create Grafana/Supabase Dashboard**:

**Panel 1: Customer Operations Latency**
- Line chart: p50, p95, p99 latency over time
- Breakdown by operation type (list, get, create, update, delete)

**Panel 2: Error Rate**
- Line chart: error rate over time
- Breakdown by error type (4xx, 5xx, network, validation)

**Panel 3: Throughput**
- Line chart: requests per second
- Breakdown by operation type

**Panel 4: Data Consistency**
- Gauge: % divergence between FileMaker and Supabase
- Table: Top 10 discrepancies

**Panel 5: Retry Queue**
- Gauge: Current queue size
- Line chart: Queue size over time

### Alerting Rules

**Critical Alerts** (immediate action required):

```yaml
- name: customer_api_error_rate_high
  condition: error_rate > 5%
  window: 5 minutes
  action: Slack @engineering, PagerDuty

- name: customer_api_latency_high
  condition: p95_latency > 2000ms
  window: 5 minutes
  action: Slack @engineering

- name: data_divergence_critical
  condition: divergence_percent > 10%
  window: 1 day
  action: Slack @engineering, Email @product

- name: rls_policy_bypass_detected
  condition: cross_org_access_attempts > 0
  window: 1 minute
  action: Slack @security, PagerDuty
```

**Warning Alerts** (investigate within 24 hours):

```yaml
- name: customer_api_latency_degraded
  condition: p95_latency > 1000ms
  window: 15 minutes
  action: Slack @engineering

- name: retry_queue_growing
  condition: queue_size > 50
  window: 1 hour
  action: Slack @engineering

- name: data_divergence_moderate
  condition: divergence_percent > 5%
  window: 1 day
  action: Slack @engineering
```

### Post-Migration Review

**Schedule**: 1 week after 100% cutover

**Agenda**:
1. Review metrics (latency, error rate, throughput)
2. Review data consistency (reconciliation report)
3. Review user feedback (support tickets, satisfaction survey)
4. Identify issues encountered and how resolved
5. Document lessons learned
6. Plan for future migrations (Projects, Tasks, etc.)

**Deliverable**: Post-Migration Report with recommendations for next migration

---

## Success Criteria

### Migration Success Checklist

**Pre-Migration**:
- [ ] Backend schema changes deployed and verified
- [ ] RLS policies implemented and tested
- [ ] All backend API endpoints implemented and passing tests
- [ ] Migration script tested successfully on staging
- [ ] Dual-write completed for CREATE/UPDATE/DELETE/STATUS operations
- [ ] Retry queue implemented and tested
- [ ] Pre-migration validation passed (no errors)

**Migration Execution**:
- [ ] FileMaker data exported successfully
- [ ] Data transformation completed without errors
- [ ] Data imported to Supabase (staging and production)
- [ ] Post-migration reconciliation shows 100% data integrity
- [ ] All foreign key constraints satisfied
- [ ] No orphaned records detected

**Post-Migration**:
- [ ] Feature flag enabled for 100% of users
- [ ] Error rate < 0.5% for all customer operations
- [ ] Performance targets met (p95 latency < 300ms)
- [ ] Data consistency maintained (< 1% divergence)
- [ ] No critical user-reported bugs
- [ ] RLS policies enforced (verified with cross-org tests)
- [ ] Rollback procedure tested and documented

**Cleanup**:
- [ ] FileMaker code removed from codebase
- [ ] Documentation updated
- [ ] FileMaker data archived
- [ ] Build succeeds with no errors or warnings
- [ ] All tests passing
- [ ] Post-migration review completed

### Quantitative Success Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Data migration completeness | 100% | ___ | ⏳ |
| Data accuracy (spot-check) | 100% | ___ | ⏳ |
| Customer operations success rate | > 99% | ___ | ⏳ |
| Error rate | < 0.5% | ___ | ⏳ |
| p95 latency (list) | < 300ms | ___ | ⏳ |
| p95 latency (detail) | < 200ms | ___ | ⏳ |
| User satisfaction | > 4/5 | ___ | ⏳ |
| Rollback time (if needed) | < 15 minutes | ___ | ⏳ |

**Sign-off Criteria**:
- All targets met for 1 week consecutively
- No critical bugs or data loss
- Team consensus on migration success

---

## Team Responsibilities

### Backend Team

**Responsibilities**:
- Implement database schema changes
- Implement RLS policies
- Implement backend API endpoints
- Write migration script
- Test on staging environment
- Monitor backend performance
- Respond to backend alerts

**Key Contacts**:
- Backend Lead: [Name]
- Database Admin: [Name]

**Communication**:
- Daily standups during migration period
- Slack channel: #customers-migration

### Frontend Team

**Responsibilities**:
- Complete dual-write coverage
- Implement retry queue
- Implement feature flag routing
- Update UI components
- Test all user workflows
- Monitor frontend errors
- Respond to frontend alerts

**Key Contacts**:
- Frontend Lead: [Name]

**Communication**:
- Daily standups during migration period
- Slack channel: #customers-migration

### Product Team

**Responsibilities**:
- Define success criteria
- Coordinate rollout schedule
- Collect user feedback
- Triage user-reported issues
- Make go/no-go decisions
- Sign off on migration completion

**Key Contacts**:
- Product Manager: [Name]

**Communication**:
- Weekly sync meetings
- Slack channel: #customers-migration

### DevOps Team

**Responsibilities**:
- Set up monitoring dashboards
- Configure alerting rules
- Manage environment variables
- Coordinate deployments
- Provide rollback support

**Key Contacts**:
- DevOps Lead: [Name]

**Communication**:
- On-demand support during migration
- Slack channel: #devops

---

## Appendix: Related Documentation

### Migration Analysis Documents

- [ID Reconciliation Strategy](./id-reconciliation-strategy.md) - UUID mapping strategy and implementation
- [Dual-Write Analysis](./dual-write-analysis.md) - Current dual-write patterns and gaps
- [Data Model Mapping](./data-model-mapping.md) - Field-by-field FileMaker to Supabase mapping
- [API Endpoint Contracts](./api-contracts.md) - Backend API specifications
- [Authorization Requirements](./authorization.md) - RLS policies and permissions
- [Supabase Schema](./supabase-schema.md) - Complete Supabase database schema

### Project Documentation

- [CLAUDE.md](../../CLAUDE.md) - Project overview and Backend Change Protocol
- [README.md](../../README.md) - General project information
- [BACKEND_INTEGRATION_GUIDE.md](../../BACKEND_INTEGRATION_GUIDE.md) - Backend API integration patterns

### Code References

**Dual-Write Implementation**:
- `src/hooks/useCustomer.js` (lines 112-177) - Customer update dual-write
- `src/hooks/useSupabaseCustomer.js` (lines 45-152) - Create customer in Supabase
- `src/hooks/useSupabaseCustomer.js` (lines 203-367) - Update customer in Supabase
- `src/services/dualWriteService.js` - Service-based dual-write pattern

**API Layer**:
- `src/api/customers.js` - FileMaker customer API
- `src/services/dataService.js` - HMAC authentication and backend API calls
- `src/services/supabaseService.js` - Supabase client wrapper

**State Management**:
- `src/context/AppStateContext.jsx` - Global customer state
- `src/hooks/useCustomer.js` - Customer CRUD operations hook

---

## Document Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-10 | Claude Agent | Initial comprehensive migration plan document |

---

**Document Status**: ✅ Complete and ready for review

**Next Steps**:
1. Review migration plan with backend team
2. Create backend change request document (BACKEND_CHANGE_REQUEST_002_CUSTOMERS_MIGRATION.md)
3. Get backend team approval for schema changes and API endpoints
4. Begin Phase 1: Backend Preparation
