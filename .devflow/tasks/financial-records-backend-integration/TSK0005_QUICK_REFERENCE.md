# TSK0005 Quick Reference: Timer Financial Record Creation

## Summary
Timer stop now creates financial records via Supabase `create_financial_record` RPC when backend doesn't return one.

## Key Functions

### 1. createFinancialRecord() - API Layer
**Location:** `src/api/financialRecords.js`

```javascript
await createFinancialRecord({
    financialId: 'uuid-v4',
    customerId: 'customer-uuid',
    productName: 'CUSTOMERCAPS:ProjectWord',
    quantity: 2.5, // billable hours
    unitPrice: 150.00,
    date: '2026-01-15',
    productId: null // optional
});
```

**Parameters:**
- `financialId` (UUID v4) - Unique identifier
- `customerId` (UUID) - Customer foreign key
- `productName` (string) - Format: CUSTOMERCAPS:ProjectFirstWord
- `quantity` (number) - Billable hours (> 0)
- `unitPrice` (number) - Hourly rate (>= 0)
- `date` (string) - YYYY-MM-DD format
- `productId` (UUID, optional) - Product foreign key

**Returns:** UUID of created record

### 2. formatProductName() - Service Layer
**Location:** `src/services/taskService.js`

```javascript
formatProductName("Clarity Business Solutions", "Web Development")
// Returns: "CLARITYBUSINESS:Web"
```

**Algorithm:**
1. Extract capitals and numbers from customer name
2. Take first word from project name
3. Join with colon

### 3. createFinancialRecordFromTimeEntry() - Service Layer
**Location:** `src/services/taskService.js`

```javascript
await createFinancialRecordFromTimeEntry(timeEntry, organizationId)
```

**Flow:**
1. Validate: customer_id, is_billable, duration
2. Calculate billable hours (minutes / 60, rounded to 2 decimals)
3. Fetch customer name from Supabase
4. Fetch project name from Supabase
5. Format product name
6. Generate financial_id (UUID v4)
7. Call createFinancialRecord RPC
8. Return record ID or null

**Returns:** UUID or null (non-billable/fixed-price)

### 4. stopTimer() - Service Layer (Updated)
**Location:** `src/services/taskService.js`

**New Logic:**
```javascript
const result = await stopTaskTimerAPI(...);

if (result.time_entry) {
    if (result.financial_record) {
        // Backend created it - use it
    } else if (result.time_entry.is_billable && orgId) {
        // Create via RPC
        const recordId = await createFinancialRecordFromTimeEntry(...);
        result.financial_record = { id: recordId };
    }
}

return result;
```

## Product Name Examples

| Customer | Project | Product Name |
|----------|---------|--------------|
| Clarity Business Solutions | Web Development | CLARITYBUSINESS:Web |
| ABC Corp. | Marketing Campaign | ABCCORP:Marketing |
| Tech-StartUp Inc | Mobile App v2 | TECHSTARTUPINC:Mobile |
| 123 Company | Support Services | 123COMPANY:Support |

## Billable Hours Calculation

```javascript
// Example: 127 minutes timer
const billableHours = Math.round((127 / 60) * 100) / 100;
// Result: 2.12 hours
```

**Formula:** `round((minutes / 60) * 100) / 100`
- Converts to hours
- Rounds to 2 decimal places

## Error Handling

### Non-Critical (Timer Stop Succeeds)
- ❌ Missing customer name → Uses "CUSTOMER"
- ❌ Missing project name → Uses "Project"
- ❌ Financial record creation fails → Logs warning
- ❌ Missing organization ID → Logs warning
- ❌ Non-billable entry → No record created
- ❌ Fixed-price project → No record created

### Critical (Timer Stop Fails)
- ❌ Invalid timer record ID → Throws error
- ❌ Adjustment not 6-minute increment → Throws error
- ❌ stopTaskTimerAPI fails → Throws error

## Data Sources

**Time Entry Data (from backend):**
- customer_id
- project_id
- duration_minutes
- hourly_rate
- is_billable

**Customer Data (from Supabase):**
- business_name

**Project Data (from Supabase):**
- name or projectName

**Organization ID:**
- From `window.state.user.supabaseOrgID` or parameter

## Backend Compatibility

| Backend Behavior | Frontend Action |
|-----------------|-----------------|
| Returns financial_record | Use it (no changes) |
| Returns null financial_record | Create via RPC |
| Returns error | Retry then fail |

**Backward Compatible:** ✅ Works with both old and new backend

## When Records Are Created

✅ **Created:**
- is_billable = true
- duration_minutes > 0
- customer_id exists
- organization_id available
- Backend didn't create one

❌ **Not Created:**
- Non-billable entry
- Fixed-price project
- Duration = 0
- Missing customer
- Missing org context
- Backend already created one

## Logging

**Success:**
```
[Task Service] ✓ Financial record created via RPC, ID: <uuid>
```

**Skipped:**
```
[Task Service] ⚠ No financial record created (non-billable or fixed-price)
```

**Error:**
```
[Task Service] ✗ Failed to create financial record via RPC: <error>
[Task Service] Timer stopped but financial record creation failed
```

## Testing Checklist

- [ ] Timer stop with billable hours
- [ ] Timer stop with non-billable hours
- [ ] Fixed-price project (no record)
- [ ] Missing customer (graceful failure)
- [ ] Missing project (uses default name)
- [ ] Missing organization ID (no record)
- [ ] Backend returns financial_record (use it)
- [ ] Backend returns null (create via RPC)
- [ ] RPC failure (timer stop succeeds)

## Common Issues

**Issue:** "Customer not found"
- **Cause:** Customer ID invalid or deleted
- **Solution:** Verify customer exists in Supabase
- **Impact:** Timer stop succeeds, no financial record

**Issue:** "Missing organization ID"
- **Cause:** User session lacks supabaseOrgID
- **Solution:** Verify authentication and JWT claims
- **Impact:** Timer stop succeeds, no financial record

**Issue:** "Product name is required"
- **Cause:** Empty customer name and project name
- **Solution:** Use fallback values (CUSTOMER:Project)
- **Impact:** Rare edge case, should never occur

## Quick Debug Commands

**Check if RPC exists:**
```sql
SELECT proname FROM pg_proc WHERE proname = 'create_financial_record';
```

**Check organization ID in session:**
```javascript
console.log(window.state?.user?.supabaseOrgID);
```

**Check customer exists:**
```sql
SELECT id, business_name FROM customers WHERE id = '<customer-uuid>';
```

**Check project exists:**
```sql
SELECT id, name, projectName FROM projects WHERE id = '<project-uuid>';
```

## Related Files

**Modified:**
- `src/api/financialRecords.js` - Added createFinancialRecord()
- `src/services/taskService.js` - Added helpers + updated stopTimer()

**Unchanged:**
- `src/components/tasks/TaskTimer.jsx` - No changes needed
- `src/api/tasks.js` - No changes needed

## Next Steps

After TSK0005:
- TSK0006: Update CustomerSalesTable for new data shapes
- TSK0007: Update FinancialChart component
- TSK0008: Test QuickBooks integration
- TSK0009: Remove obsolete FileMaker code paths
