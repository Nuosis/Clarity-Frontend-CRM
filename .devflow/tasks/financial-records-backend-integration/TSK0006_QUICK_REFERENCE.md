# TSK0006 Quick Reference: CustomerSalesTable Supabase Migration

## Summary
Updated `CustomerSalesTable` component to use Supabase `customer_sales` schema and `mark_records_billed` RPC for QuickBooks invoice generation workflow.

## Key Changes

### 1. Customer Name Field
```javascript
// OLD (FileMaker):
const customerName = record.customers?.business_name

// NEW (Supabase with fallback):
const customerName = record.customer_name || record.customers?.business_name
```

### 2. Invoice Status Check
```javascript
// OLD (FileMaker):
const billed = record.f_billed === 1

// NEW (Supabase):
const billed = record.inv_id !== null
```

### 3. QuickBooks Invoice Update

#### OLD Approach (FileMaker)
```javascript
// Per-record loop with UUID lookup
recordsToInvoice.map(async (record) => {
  // Update Supabase
  await update('customer_sales', { inv_id: qboInvoiceId }, { id: record.id });

  // Look up FileMaker record by UUID
  const fmRecord = await fetchFinancialRecordByUUID(record.financial_id);
  const recordId = fmRecord.response.data[0].recordId;

  // Update FileMaker
  await updateFinancialRecordBilledStatus(recordId, 1);
});
```

#### NEW Approach (Supabase)
```javascript
// Single RPC call with actual QB invoice ID
const recordIds = recordsToInvoice.map(r => r.id);
const supabase = getSupabaseClient();

await supabase.rpc('mark_records_billed', {
  p_record_ids: recordIds,
  p_invoice_id: qboInvoiceId  // Actual QB ID like "6495"
});
```

## Data Fields Reference

| Field | Supabase Schema | FileMaker Legacy | Notes |
|-------|----------------|------------------|-------|
| Record ID | `id` | `recordId` | Supabase UUID (primary key) |
| Financial ID | `financial_id` | `__ID` | UUID for tracking |
| Customer Name | `customer_name` | `customers.business_name` | Joined field from customers table |
| Invoice Status | `inv_id` | `f_billed` | null = unbilled, "6495" = billed |
| Date | `date` (YYYY-MM-DD) | `DateStart` (MM/DD/YYYY) | Format differs |
| Quantity | `quantity` | `Billable_Time_Rounded` | Billable hours |
| Unit Price | `unit_price` | `Hourly_Rate` | Rate per hour |
| Total | `total_price` | Calculated | Pre-calculated |
| Product | `product_name` | N/A | "CUSTOMERCAPS:ProjectName" |

## RPC Function: mark_records_billed

### Signature
```sql
mark_records_billed(
  p_record_ids uuid[],
  p_invoice_id text
) RETURNS integer
```

### Usage
```javascript
const { data, error } = await supabase.rpc('mark_records_billed', {
  p_record_ids: ['uuid-1', 'uuid-2', 'uuid-3'],
  p_invoice_id: 'QB_INVOICE_6495'
});

// Returns: number of records updated
```

### What It Does
1. Updates `inv_id` = `p_invoice_id` for all records in `p_record_ids`
2. Sets `updated_at` = current timestamp
3. Returns count of updated records
4. Enforces organization scoping via RLS

## Invoice Generation Flow

### Step-by-Step
1. **Filter unbilled records**: `records.filter(r => r.inv_id === null)`
2. **Find/create QB customer**: Search QB by `customer_name`
3. **Generate invoice payload**: Map records to QB line items
4. **Create QB invoice**: Call `createQBOInvoice()` → get `qboInvoiceId`
5. **Mark records billed**: Call `mark_records_billed` RPC with actual QB invoice ID
6. **Send invoice email**: Call `sendQBOInvoiceEmail(qboInvoiceId)`
7. **Refresh data**: Call `onRefresh()` to reload unbilled records

### Error Handling
- QB customer not found → Show CreateQBOCustomerModal
- Multiple QB customers → Prompt user to select
- Invoice creation fails → Throw error, don't update records
- RPC update fails → Throw error, show alert
- Email send fails → Warn but don't fail (invoice created successfully)

## Files Modified
- `src/components/financial/CustomerSalesTable.jsx` - Component updates
- `src/hooks/useSalesActivity.js` - Hook updates
- `.devflow/tasks/financial-records-backend-integration/tasks.json` - Task tracking

## Testing Checklist
- [ ] Customer name displays correctly
- [ ] Unbilled records show as "Uninvoiced"
- [ ] Billed records show as "Invoiced"
- [ ] QB invoice creation succeeds
- [ ] Records marked with actual QB invoice ID (not "BILLED")
- [ ] Records disappear from unbilled list after invoicing
- [ ] Organization scoping enforced (can't see other org records)

## Common Issues

### Issue: Customer name shows "Unknown Customer"
**Cause**: `customer_name` field missing in normalized response
**Fix**: Ensure `get_financial_records` RPC joins customers table

### Issue: Records not marked as billed after invoice creation
**Cause**: RPC call failed or organization_id mismatch
**Fix**: Check Supabase logs, verify JWT includes organization_id

### Issue: All records show generic "BILLED" invoice ID
**Cause**: Using `updateFinancialRecordBilledStatus(id, 1)` wrapper
**Fix**: Use direct RPC call with actual QB invoice ID

## Related Tasks
- TSK0001: Financial records API client migration ✅
- TSK0002: billableHoursService updates ✅
- TSK0005: Timer record creation ✅
- TSK0007: FinancialActivity component (partially done via useSalesActivity)
- TSK0013: End-to-end QB invoice testing (next)
