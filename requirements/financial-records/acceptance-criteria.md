# Financial Records - Acceptance Criteria and Test Plan

## Overview

This document defines the acceptance criteria for migrating financial records from FileMaker to Supabase as the authoritative source, including functional requirements, test cases, performance targets, and success metrics.

---

## Table of Contents

1. [Functional Acceptance Criteria](#functional-acceptance-criteria)
2. [Non-Functional Acceptance Criteria](#non-functional-acceptance-criteria)
3. [Test Plan](#test-plan)
4. [Performance Benchmarks](#performance-benchmarks)
5. [Success Metrics](#success-metrics)

---

## Functional Acceptance Criteria

### AC1: Backend RPC Functions Deployed

**Criteria**: All required Supabase RPC functions operational in production

**Verification**:
- ✅ `get_financial_records` - Query with filters (date range, customer, billing status)
- ✅ `get_unpaid_records` - Unbilled records query
- ✅ `get_monthly_summary` - Monthly aggregations
- ✅ `get_quarterly_summary` - Quarterly aggregations
- ✅ `get_yearly_summary` - Yearly aggregations
- ✅ `create_financial_record` - Create new record
- ✅ `mark_records_billed` - Bulk billing update
- ✅ All functions return correct data structure
- ✅ All functions enforce organization isolation

---

### AC2: Timer Integration Functional

**Criteria**: Timer stop creates financial records directly in Supabase (no FileMaker scripts)

**Verification**:
- ✅ `createFinancialRecordForTask()` function creates record in Supabase
- ✅ Billing hours calculated correctly from elapsed seconds
- ✅ Billing rate retrieved from customer or project
- ✅ Product name formatted correctly (`{CAPS}:{WORD}`)
- ✅ Organization ID injected from JWT token
- ✅ Success notification shown to user
- ✅ Error handling prevents data loss
- ✅ No FileMaker scripts called during timer stop

---

### AC3: All Financial Records Queryable from Supabase

**Criteria**: Users can query financial records with full filtering capabilities

**Verification**:
- ✅ Query by date range returns correct records
- ✅ Query by customer filters correctly
- ✅ Query by billing status (billed/unbilled) works
- ✅ Unpaid records query returns only unbilled records
- ✅ Monthly/quarterly/yearly aggregations accurate

---

### AC4: Historical Data Migrated

**Criteria**: All FileMaker records migrated without data loss

**Verification**:
- ✅ Record count matches FileMaker
- ✅ Total amounts match FileMaker reports (< 0.01% variance)
- ✅ Billed status preserved
- ✅ All customer references valid
- ✅ Date formats converted correctly

---

### AC5: QuickBooks Integration Works

**Criteria**: QB sync reads from Supabase and updates records

**Verification**:
- ✅ Unbilled records queryable for invoice generation
- ✅ Invoice IDs written back to Supabase
- ✅ Records marked as billed after sync
- ✅ No duplicate invoices created

---

### AC6: Row-Level Security Enforced

**Criteria**: Users can only access records from their organization

**Verification**:
- ✅ Cross-organization queries return empty results
- ✅ Cannot create records for other organizations
- ✅ Cannot update other organizations' records
- ✅ RLS policies tested and verified

---

## Non-Functional Acceptance Criteria

### AC7: Performance Targets Met

**Criteria**: All queries complete within acceptable time limits

**Performance Targets**:

| Operation | Target |
|-----------|--------|
| Simple query (date range) | < 1s |
| Unpaid records query | < 0.5s |
| Monthly summary | < 1s |
| Record creation | < 0.5s |
| Bulk update (100 records) | < 1s |

---

### AC8: Code Quality Standards

**Criteria**: Code follows project standards and best practices

**Verification**:
- ✅ FileMaker dependencies removed from financial code
- ✅ Supabase RPC functions tested (90%+ coverage)
- ✅ Error handling for all API calls
- ✅ Logging for audit trail
- ✅ No hardcoded values (use config)
- ✅ No TODO/FIXME markers in production code

---

### AC9: Rollback Plan Tested

**Criteria**: Can rollback to FileMaker if critical issues occur

**Verification**:
- ✅ Rollback procedure documented
- ✅ Rollback tested on staging
- ✅ Rollback can complete within 30 minutes
- ✅ Data sync for rollback gap tested

---

## Test Plan

### Unit Tests

**Test Files:**
- `src/services/financialRecordService.test.js`
- `src/hooks/useFinancialRecords.test.js`
- `src/api/financialRecordsSupabase.test.js`

**Test Cases:**
- createFinancialRecordForTask() creates record correctly
- fetchFinancialRecords() returns filtered results
- Error handling for missing data
- Error handling for invalid JWT

**Coverage Target:** 90%+

---

### Integration Tests

**Test Scenarios:**

1. **Timer → Financial Record:**
   - Start timer, stop after 1 hour
   - Verify record created with correct data

2. **QuickBooks Sync:**
   - Create unbilled records
   - Run QB sync
   - Verify inv_id updated

3. **Financial Reporting:**
   - Create records across multiple months
   - Query monthly summary
   - Verify aggregations correct

---

### Performance Tests

**Test Scenarios:**
- Query 10,000 records (target: < 2s)
- Create 100 records concurrently (target: < 5s)
- Bulk update 1,000 records (target: < 3s)

---

### User Acceptance Testing

**UAT Checklist:**
- [ ] Users can track time and create billable records
- [ ] Billing rates are correct
- [ ] Financial reports show accurate data
- [ ] QuickBooks integration works
- [ ] No data loss from migration
- [ ] Performance is acceptable

**Duration:** 2 weeks
**Sign-off:** Product Owner + 80%+ user satisfaction

---

## Performance Benchmarks

**Baseline (FileMaker):**
- Query 1 month: ~3-5 seconds
- Unpaid records: ~2-3 seconds

**Target (Supabase):**
- Query 1 month: < 1 second (3-5x improvement)
- Unpaid records: < 0.5 seconds (4-6x improvement)

---

## Success Metrics

1. **Zero Data Loss:** 100% of records migrated
2. **Performance:** 95% of queries < 2s
3. **User Adoption:** 100% migrated within 1 month
4. **QuickBooks Reliability:** 99%+ success rate
5. **Operational Efficiency:** FileMaker sync retired
6. **Error Rate:** < 1% for financial operations

---

**Document Version:** 1.0
**Last Updated:** 2026-01-11
**Status:** Phase 1 Requirements Documentation
