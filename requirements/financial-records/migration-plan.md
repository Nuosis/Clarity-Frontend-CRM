# Financial Records - Migration Plan

## Overview

This document outlines the step-by-step plan to migrate financial records from FileMaker to Supabase as the single source of truth, including timer integration and sync service retirement.

**Current State:** FileMaker-primary with Supabase reconciliation
**Target State:** Supabase-only with timer-driven record creation

---

## Table of Contents

1. [Migration Phases](#migration-phases)
2. [Phase 1: Backend Preparation](#phase-1-backend-preparation)
3. [Phase 2: Frontend API Layer Replacement](#phase-2-frontend-api-layer-replacement)
4. [Phase 3: Timer Integration](#phase-3-timer-integration)
5. [Phase 4: Deprecate Sync Service](#phase-4-deprecate-sync-service)
6. [Phase 5: Testing & Validation](#phase-5-testing--validation)
7. [Phase 6: Deployment & Cutover](#phase-6-deployment--cutover)
8. [Rollback Plan](#rollback-plan)

---

## Migration Phases

### Overview

| Phase | Description | Duration | Dependencies |
|-------|-------------|----------|--------------|
| 1 | Backend Preparation | 2 weeks | Backend team |
| 2 | Frontend API Layer Replacement | 1 week | Phase 1 complete |
| 3 | Timer Integration | 1 week | Phase 2 complete |
| 4 | Deprecate Sync Service | 3 days | Phase 3 complete |
| 5 | Testing & Validation | 2 weeks | Phase 4 complete |
| 6 | Deployment & Cutover | 1 week | Phase 5 complete, User Acceptance |

**Total Estimated Duration:** 7-8 weeks

---

## Phase 1: Backend Preparation

### 1.1 Backend Change Request

**Task:** Submit BACKEND_CHANGE_REQUEST_001_FINANCIAL_RECORDS_MIGRATION.md

**Contents:**
- RPC function definitions (SQL)
- Index creation statements
- Migration script for historical data
- Testing requirements
- Rollback plan

**Status:** ✅ Complete (document created)

### 1.2 RPC Function Development

**Tasks:**
- [ ] Implement `get_financial_records` RPC
- [ ] Implement `get_unpaid_records` RPC
- [ ] Implement `get_monthly_summary` RPC
- [ ] Implement `get_quarterly_summary` RPC
- [ ] Implement `create_financial_record` RPC
- [ ] Implement `mark_records_billed` RPC

**Validation:**
- Unit tests for each RPC function
- Edge case testing (null values, invalid inputs)
- Performance testing (query times < 2s)

### 1.3 Index Creation

**Tasks:**
- [ ] Create index: `idx_customer_sales_org_date`
- [ ] Create index: `idx_customer_sales_customer_date`
- [ ] Create index: `idx_customer_sales_unbilled`
- [ ] Create index: `idx_customer_sales_date_range`

**Validation:**
- EXPLAIN ANALYZE queries to verify index usage
- Benchmark queries before and after indexes

### 1.4 Historical Data Migration

**Task:** Migrate FileMaker `devRecords` to Supabase `customer_sales`

**Migration Script:**
```javascript
// scripts/migrate-financial-records.js
async function migrateFinancialRecords() {
  // 1. Fetch all devRecords from FileMaker (date range: 2 years)
  const startDate = '2024-01-01';
  const endDate = '2026-01-31';
  const devRecords = await fetchDevRecordsForDateRange(startDate, endDate);

  // 2. Transform each record
  for (const devRecord of devRecords) {
    const customerSale = await createCustomerSaleFromDevRecord(devRecord, organizationId);
    
    // 3. Insert into Supabase (upsert to handle duplicates)
    const { error } = await supabase
      .from('customer_sales')
      .upsert(customerSale, { onConflict: 'financial_id' });

    if (error) {
      console.error(`Failed to migrate record ${devRecord.__ID}:`, error);
    }
  }

  console.log(`Migrated ${devRecords.length} records`);
}
```

**Validation:**
- Compare record counts: FileMaker vs Supabase
- Verify totals match: `SUM(total_price)` in both systems
- Spot-check 10-20 records for data accuracy

**Deliverables:**
- [ ] Migration script tested on staging
- [ ] Historical data validated (counts, totals match)
- [ ] Migration runbook documented

---

## Phase 2: Frontend API Layer Replacement

### 2.1 Create Supabase API Layer

**File:** `src/api/financialRecordsSupabase.js`

**Tasks:**
- [ ] Implement `fetchFinancialRecords()` using `get_financial_records` RPC
- [ ] Implement `fetchUnpaidRecords()` using `get_unpaid_records` RPC
- [ ] Implement `fetchMonthlySummary()` using `get_monthly_summary` RPC
- [ ] Implement `fetchQuarterlySummary()` using `get_quarterly_summary` RPC
- [ ] Implement `createFinancialRecord()` using `create_financial_record` RPC
- [ ] Implement `markRecordsBilled()` using `mark_records_billed` RPC

**Example Implementation:**
```javascript
export async function fetchFinancialRecords(organizationId, filters = {}) {
  const { data, error } = await supabase.rpc('get_financial_records', {
    p_organization_id: organizationId,
    p_start_date: filters.startDate || null,
    p_end_date: filters.endDate || null,
    p_customer_id: filters.customerId || null,
    p_billed_only: filters.billedOnly || null
  });

  if (error) throw error;
  return data;
}
```

### 2.2 Update Service Layer

**File:** `src/services/billableHoursService.js`

**Tasks:**
- [ ] Remove FileMaker-specific processing logic
- [ ] Adapt `processFinancialData()` for Supabase data structure
- [ ] Update `groupRecordsByCustomer()` for new data format
- [ ] Update `calculateTotals()` for new data format
- [ ] Test all service functions with Supabase data

### 2.3 Create New Hooks

**File:** `src/hooks/useFinancialRecords.js`

**Tasks:**
- [ ] Implement `useFinancialRecords()` hook
- [ ] Implement `useUnpaidRecords()` hook
- [ ] Implement `useMonthlySummary()` hook
- [ ] Replace `useBillableHours` with `useFinancialRecords` in components

**Example Hook:**
```javascript
export function useFinancialRecords(organizationId, filters) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchRecords() {
      setLoading(true);
      try {
        const data = await fetchFinancialRecords(organizationId, filters);
        setRecords(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (organizationId) {
      fetchRecords();
    }
  }, [organizationId, filters]);

  return { records, loading, error };
}
```

### 2.4 Update UI Components

**Files:**
- `src/components/financial/CustomerSalesTable.jsx`
- `src/components/financial/RecordDetailsModal.jsx`
- `src/components/financial/QboTestPanel.jsx`

**Tasks:**
- [ ] Replace FileMaker API calls with Supabase API calls
- [ ] Update data structure references
- [ ] Test all components with Supabase data

---

## Phase 3: Timer Integration

### 3.1 Timer Stop Handler

**File:** `src/components/tasks/TaskTimer.jsx`

**Tasks:**
- [ ] Add `onTimerStop` handler to create financial record
- [ ] Fetch task context (customer_id, project, billing rate)
- [ ] Calculate billable hours from elapsed seconds
- [ ] Call `create_financial_record` RPC
- [ ] Show success/error notification
- [ ] Update UI to reflect new record

**Implementation:**
```javascript
async function handleTimerStop() {
  try {
    // 1. Calculate billable hours
    const hours = Math.round((elapsedSeconds / 3600) * 100) / 100;

    // 2. Fetch task context
    const task = await getTask(taskId);
    const project = await getProject(task.project_id);
    const customer = await getCustomer(project.customer_id);

    // 3. Get billing rate
    const rate = customer.charge_rate || project.hourly_rate || 0;

    // 4. Format product name
    const productName = formatProductName(customer.business_name, project.name);

    // 5. Create financial record
    const recordId = await createFinancialRecord({
      financial_id: crypto.randomUUID(),
      organization_id: currentUser.organization_id,
      customer_id: customer.id,
      product_name: productName,
      quantity: hours,
      unit_price: rate,
      date: new Date().toISOString().split('T')[0]
    });

    // 6. Show success notification
    showNotification('Financial record created successfully');

    // 7. Link record to task (optional)
    await updateTask(taskId, { last_billed_at: new Date() });

  } catch (error) {
    showNotification('Failed to create financial record: ' + error.message, 'error');
  }
}
```

### 3.2 Billing Confirmation Dialog

**File:** `src/components/tasks/BillingConfirmationDialog.jsx`

**Tasks:**
- [ ] Create modal component
- [ ] Show hours, rate, total before creating record
- [ ] Allow user to adjust hours or mark as non-billable
- [ ] Integrate with timer stop flow

**UI Elements:**
- Hours worked: `[input field]`
- Billing rate: `$[rate]/hour`
- Total amount: `$[total]`
- Mark as non-billable: `[checkbox]`
- Buttons: `[Create Record]` `[Cancel]`

### 3.3 Service Layer Integration

**File:** `src/services/taskService.js`

**Tasks:**
- [ ] Add `createFinancialRecordForTask()` function
- [ ] Import Supabase service
- [ ] Handle errors gracefully

---

## Phase 4: Deprecate Sync Service

### 4.1 Archive Sync Service

**Tasks:**
- [ ] Rename `src/services/financialSyncService.js` to `DEPRECATED_financialSyncService.js`
- [ ] Add deprecation notice at top of file
- [ ] Remove from active imports

### 4.2 Remove Sync UI

**Tasks:**
- [ ] Delete `src/components/financial/FinancialSyncPanel.jsx`
- [ ] Delete `src/hooks/useFinancialSync.js`
- [ ] Remove sync-related routes and navigation items

### 4.3 Update Documentation

**Tasks:**
- [ ] Update README.md to reflect Supabase-only architecture
- [ ] Remove sync service references from CLAUDE.md
- [ ] Add migration completion notice

---

## Phase 5: Testing & Validation

### 5.1 Unit Tests

**Backend (SQL):**
- [ ] Test `get_financial_records` with various filters
- [ ] Test `get_unpaid_records` filtering
- [ ] Test `create_financial_record` validation
- [ ] Test `mark_records_billed` bulk update

**Frontend (JavaScript):**
- [ ] Test `formatProductName()` function
- [ ] Test `createFinancialRecordForTask()` logic
- [ ] Test timer stop → record creation flow
- [ ] Test error handling for failed API calls

### 5.2 Integration Tests

**Test Scenarios:**
1. **Timer → Financial Record**
   - Start timer on task
   - Stop timer after 1 hour
   - Verify record created in Supabase
   - Verify hours, rate, total correct

2. **Manual Entry → Financial Record**
   - Submit manual entry form
   - Verify record created
   - Verify all fields populated

3. **QuickBooks Sync**
   - Create unbilled records
   - Run QB sync
   - Verify inv_id updated
   - Verify records marked as billed

4. **Financial Reporting**
   - Create records across multiple months
   - Query monthly summary
   - Verify aggregations correct
   - Compare to pre-migration reports

### 5.3 Performance Tests

**Benchmarks:**
- [ ] Query 10,000 records by date range (target: < 2s)
- [ ] Create 100 records concurrently (target: < 5s)
- [ ] Bulk update 1,000 records (target: < 3s)

### 5.4 User Acceptance Testing

**UAT Checklist:**
- [ ] Users can track time and create billable records
- [ ] Billing rates are correct
- [ ] Financial reports show accurate data
- [ ] QuickBooks integration works
- [ ] No data loss from migration
- [ ] Performance is acceptable (queries < 2s)

---

## Phase 6: Deployment & Cutover

### 6.1 Pre-Deployment Checklist

- [ ] All backend RPC functions deployed to production
- [ ] All indexes created on production database
- [ ] Historical data migrated and validated
- [ ] Frontend code deployed to staging
- [ ] UAT completed and signed off
- [ ] Rollback plan tested
- [ ] User training materials created

### 6.2 Deployment Steps

1. **Backend Deployment (Backend Team)**
   - Deploy RPC functions to production Supabase
   - Create indexes
   - Run migration script for historical data
   - Verify migration success

2. **Frontend Deployment**
   - Deploy frontend code to production
   - Update environment variables if needed
   - Monitor error logs

3. **Verification**
   - Test timer stop creates records in Supabase
   - Test financial queries return correct data
   - Test QuickBooks sync works
   - Monitor performance metrics

### 6.3 Cutover Criteria

**Go/No-Go Decision:**
- [ ] All backend changes deployed successfully
- [ ] Historical data migrated with 100% accuracy
- [ ] UAT completed with no critical issues
- [ ] Rollback plan tested and ready
- [ ] On-call support available for 48 hours

### 6.4 Post-Deployment Monitoring

**Metrics to Monitor:**
- API error rates (target: < 1%)
- Query response times (target: < 2s)
- Record creation success rate (target: > 99%)
- User-reported issues (target: < 5 per day)

**Monitoring Duration:** 2 weeks

---

## Rollback Plan

### Scenario 1: Backend RPC Functions Fail

**Symptoms:**
- High error rates from RPC calls
- Query timeouts
- Data integrity issues

**Rollback Steps:**
1. Revert RPC function deployments
2. Re-enable FileMaker API in frontend (toggle feature flag)
3. Restore Supabase from pre-migration backup
4. Investigate root cause

**Estimated Rollback Time:** 2 hours

### Scenario 2: Data Migration Issues

**Symptoms:**
- Record counts don't match
- Totals are incorrect
- Missing records

**Rollback Steps:**
1. Stop all writes to Supabase
2. Restore Supabase from pre-migration backup
3. Re-run migration script with fixes
4. Re-validate data

**Estimated Rollback Time:** 4 hours

### Scenario 3: Timer Integration Breaks

**Symptoms:**
- Timer stop fails to create records
- Records created with incorrect data
- Users unable to track time

**Rollback Steps:**
1. Revert frontend code to pre-timer-integration version
2. Re-enable FileMaker script for timer stop
3. Fix timer integration code
4. Re-deploy

**Estimated Rollback Time:** 1 hour

---

## Success Metrics

**Quantitative:**
- Zero data loss (100% of FileMaker records migrated)
- 95% of queries < 2s response time
- 99%+ success rate for record creation
- 100% of active users on new system within 1 month

**Qualitative:**
- Users report no disruption to workflows
- QuickBooks sync reliability maintained
- Reduced operational complexity (no sync service)

---

**Document Version:** 1.0
**Last Updated:** 2026-01-11
**Status:** Phase 1 Requirements Documentation
