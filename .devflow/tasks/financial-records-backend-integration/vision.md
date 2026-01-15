# Feature: Financial Records Backend Integration

## Overview

Integrate the financial records frontend with the new backend Supabase RPC APIs that have been deployed. This migration moves financial records from FileMaker-primary to Supabase-native, removing FileMaker dependencies for billing and invoicing operations.

## Goals

1. **Replace FileMaker API calls** with Supabase RPC functions for financial records operations
2. **Update data mapping layer** to handle Supabase schema instead of FileMaker layout fields
3. **Maintain UI compatibility** - No breaking changes to existing components
4. **Preserve business logic** - Keep all existing billing, invoicing, and QuickBooks integration behavior
5. **Remove dual-write complexity** - Simplify financial sync service now that Supabase is primary

## Success Criteria

- Financial records load from `get_financial_records` RPC with correct date filtering
- Unpaid records query uses `get_unpaid_records` RPC
- Monthly/quarterly/yearly summaries use aggregation RPCs
- Create financial record flow uses `create_financial_record` RPC
- Mark records as billed uses `mark_records_billed` RPC
- All existing UI components display correct data
- QuickBooks integration continues to work
- Tests pass with new backend integration

## Technical Approach

### Backend RPC Functions (Already Deployed)

The following Supabase RPC functions are already deployed and available:

1. **`get_financial_records(p_organization_id, p_start_date, p_end_date, p_customer_id, p_billed_only)`**
   - Replaces: `fetchFinancialRecords()`, `fetchMonthlyRecords()`, `fetchQuarterlyRecords()`, `fetchYearlyRecords()`
   - Returns: Records with customer name joined, ordered by date DESC

2. **`get_unpaid_records(p_organization_id, p_customer_id)`**
   - Replaces: `fetchUnpaidRecords()`
   - Returns: All unbilled records (inv_id IS NULL)

3. **`get_monthly_summary(p_organization_id, p_start_date, p_end_date, p_customer_id)`**
   - New capability: Monthly aggregations
   - Returns: Month-by-month totals with billed/unbilled breakdowns

4. **`get_quarterly_summary(p_organization_id, p_year, p_quarter, p_customer_id)`**
   - New capability: Quarterly aggregations
   - Returns: Quarter totals with billed/unbilled breakdowns

5. **`get_yearly_summary(p_organization_id, p_year, p_customer_id)`**
   - New capability: Yearly aggregations
   - Returns: Annual totals with billed/unbilled breakdowns

6. **`create_financial_record(...)`**
   - Replaces: FileMaker record creation
   - Validates inputs, calculates total_price, inserts record

7. **`mark_records_billed(p_record_ids, p_invoice_id)`**
   - Replaces: `bulkUpdateFinancialRecordsBilledStatus()`
   - Bulk operation to mark multiple records as billed

### Data Model Changes

**FileMaker Layout (`devRecords`)** → **Supabase Table (`customer_sales`)**

| FileMaker Field | Supabase Column | Transform |
|-----------------|-----------------|-----------|
| `__ID` | `financial_id` | Direct (UUID correlation key) |
| `_custID` | `customer_id` | FK to customers.id |
| `DateStart` | `date` | MM/DD/YYYY → YYYY-MM-DD |
| `Billable_Time_Rounded` | `quantity` | parseFloat() |
| `Hourly_Rate` | `unit_price` | parseFloat() |
| *(calculated)* | `total_price` | quantity × unit_price |
| `Customers::Name` + `customers_Projects::projectName` | `product_name` | Format: `{CAPS}:{WORD}` |
| `f_billed` | `inv_id` | 0=NULL, 1='MIGRATED' or QB ID |
| `~creationTimestamp` | `created_at` | Timestamp |
| `~ModificationTimestamp` | `updated_at` | Timestamp |

### Files to Modify

1. **API Layer**
   - `src/api/financialRecords.js` - Replace all FileMaker calls with Supabase RPC calls

2. **Service Layer**
   - `src/services/billableHoursService.js` - Update data processing for Supabase schema
   - `src/services/salesService.js` - Update for new API contracts
   - `src/services/financialSyncService.js` - Simplify now that Supabase is primary (or remove if obsolete)

3. **UI Components** (verify compatibility)
   - `src/components/financial/CustomerSalesTable.jsx`
   - `src/components/financial/FinancialActivity.jsx`
   - `src/components/financial/FinancialChart.jsx`
   - `src/components/financial/RecordModal.jsx`
   - `src/components/financial/RecordDetailsModal.jsx`

4. **Hooks** (if any need updates)
   - `src/hooks/useBillableHours.js`

5. **Tests**
   - Update tests to use Supabase mocks instead of FileMaker mocks
   - Add test fixtures matching Supabase RPC response format

### Migration Strategy

**Phase 1: API Layer Replacement (Core)**
- Replace FileMaker API calls with Supabase RPC in `financialRecords.js`
- Maintain same function signatures for backward compatibility
- Add response normalization layer

**Phase 2: Service Layer Updates**
- Update `billableHoursService.js` to process Supabase-shaped data
- Update `salesService.js` for new contracts
- Simplify or remove `financialSyncService.js` dual-write logic

**Phase 3: Component Validation**
- Test all financial UI components
- Fix any data shape mismatches
- Ensure QuickBooks integration still works

**Phase 4: Testing & Cleanup**
- Update test fixtures
- Add integration tests for RPC calls
- Remove obsolete FileMaker code paths

## Dependencies

- **Backend Deployment:** ✅ Complete - All RPC functions deployed
- **Customer Migration:** Customers table must be populated for FK constraints
- **Organization Context:** User session must include organization_id

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Data shape mismatch causes UI breaks | High | Add normalization layer in API client |
| QuickBooks integration breaks | High | Test QB invoice generation separately |
| Date format conversion issues | Medium | Use robust date parsing with validation |
| Missing customer references | Medium | Handle FK violations gracefully |
| Performance regression on large queries | Low | Backend has proper indexes |

## Rollback Plan

If issues are discovered:
1. Revert API layer changes to FileMaker calls
2. Keep Supabase schema intact (no data loss)
3. Re-enable `financialSyncService.js` dual-write if needed

## Related Documentation

- `requirements/financial-records/BACKEND_CHANGE_REQUEST_001_FINANCIAL_RECORDS_MIGRATION.md` - Backend schema and RPC specifications
- `requirements/financial-records/api-contracts.md` - API contract definitions
- `requirements/financial-records/data-model-mapping.md` - Field mapping details
- `requirements/financial-records/current-implementation.md` - Current FileMaker implementation
