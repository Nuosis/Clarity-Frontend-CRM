# TSK0009: Financial Records API - Quick Reference

## API Endpoints Mapping

### Before (Supabase RPC)
```javascript
import { getSupabaseClient } from '../services/supabaseService';

const supabase = getSupabaseClient();
const { data, error } = await supabase.rpc('get_financial_records', {
  p_organization_id: organizationId,
  p_start_date: startDate,
  p_end_date: endDate,
  p_customer_id: customerId,
  p_billed_only: billedOnly
});
```

### After (Backend API)
```javascript
import { dataService } from '../services/dataService';

const data = await dataService.get('/api/financial-records/query', {
  start_date: startDate,
  end_date: endDate,
  customer_id: customerId,
  project_id: projectId,  // ✅ NEW: Now supports project filtering
  billed_only: billedOnly
});
// Organization scoping and HMAC auth handled automatically by dataService
```

## Function Usage Examples

### Fetch Financial Records
```javascript
import { fetchFinancialRecords } from '../api/financialRecords';

// Fetch today's records
const todayRecords = await fetchFinancialRecords('today');

// Fetch unpaid records for a customer
const unpaidRecords = await fetchFinancialRecords('unpaid', customerId);

// Fetch this month's records for a project
const monthRecords = await fetchFinancialRecords('thisMonth', customerId, projectId);
```

### Create Financial Record
```javascript
import { createFinancialRecord } from '../api/financialRecords';

const record = await createFinancialRecord({
  financialId: uuidv4(),
  customerId: 'customer-uuid',
  projectId: 'project-uuid',  // ✅ NEW: Optional project linking
  productName: 'ACME:WebDevelopment',
  quantity: 8.5,
  unitPrice: 150.00,
  date: '2026-01-15'
});
```

### Mark Records as Billed
```javascript
import { bulkUpdateFinancialRecordsBilledStatus } from '../api/financialRecords';

// Mark records as billed
const result = await bulkUpdateFinancialRecordsBilledStatus(
  ['record-id-1', 'record-id-2'],
  1  // 1 = billed, 0 = unbilled
);

console.log(`Updated ${result.successCount} records`);
```

### Fetch Summaries
```javascript
import {
  fetchMonthlySummary,
  fetchQuarterlySummary,
  fetchYearlySummary
} from '../api/financialRecords';

// Monthly summary for 2026
const monthly = await fetchMonthlySummary(2026);

// Q1 2026 summary
const quarterly = await fetchQuarterlySummary(2026, 1);

// Full year 2026 summary
const yearly = await fetchYearlySummary(2026);
```

## Response Format Changes

### Backend API Response (FinancialRecordResponse)
```javascript
{
  id: "uuid",                    // Record ID
  financial_id: "uuid",          // Idempotent financial ID
  organization_id: "uuid",       // Organization scoping
  customer_id: "uuid",           // Customer reference
  project_id: "uuid" | null,     // ✅ NEW: Project reference
  product_id: "uuid" | null,     // Product reference
  product_name: "string",        // Product/service name
  quantity: "123.45",            // ⚠️ String (parsed to float)
  unit_price: "150.00",          // ⚠️ String (parsed to float)
  total_price: "18517.50",       // ⚠️ String (parsed to float)
  date: "2026-01-15",            // YYYY-MM-DD
  inv_id: "string" | null,       // Invoice ID if billed
  billing_status: "billed" | "unbilled",  // ✅ NEW: Explicit status
  created_at: "2026-01-15T12:00:00Z",
  updated_at: "2026-01-15T12:00:00Z",
  time_entry_id: "uuid" | null,  // ✅ NEW: Timer linkage
  configuration_data: {} | null  // ✅ NEW: Product config
}
```

### Normalized Response (Legacy Format)
```javascript
{
  response: {
    data: [
      {
        fieldData: {
          __ID: "uuid",               // financial_id
          _custID: "uuid",            // customer_id
          _projectID: "uuid" | null,  // ✅ NEW: project_id
          DateStart: "01/15/2026",    // Converted to MM/DD/YYYY
          Billable_Time_Rounded: 123.45,  // Parsed float
          Hourly_Rate: 150.00,        // Parsed float
          'Customers::Name': null,    // ⚠️ Not available from backend
          f_billed: 1,                // 0 or 1 (derived from inv_id)
          product_name: "string",
          total_price: 18517.50,      // Parsed float
          financial_id: "uuid",
          inv_id: "string" | null,
          billing_status: "billed",   // ✅ NEW
          time_entry_id: "uuid" | null,  // ✅ NEW
          configuration_data: {}      // ✅ NEW
        },
        recordId: "uuid"
      }
    ]
  }
}
```

## Key Differences

### ✅ New Features
1. **Project Filtering**: Can filter by `project_id` in queries
2. **Billing Status Enum**: Explicit `billing_status` field
3. **Time Entry Link**: `time_entry_id` for timer integration
4. **Configuration Data**: `configuration_data` for product metadata

### ⚠️ Breaking Changes
1. **Customer Name**: No longer included in response (requires separate lookup)
2. **Number Types**: Backend returns strings, frontend parses to floats
3. **Organization ID**: Automatically scoped, not in response

### 🗑️ Deprecated
1. **fetchFinancialRecordByRecordId()**: Use query endpoints instead
2. **fetchFinancialRecordByUUID()**: Use query endpoints instead

## Migration Checklist

- [x] Replace all Supabase RPC calls with backend API
- [x] Update data transformation for backend schema
- [x] Parse string numbers to floats in normalization
- [x] Add project_id support to create/query functions
- [x] Update billing status functions for backend API
- [x] Deprecate get-by-ID functions with warnings
- [x] Verify build compiles successfully
- [x] Test all query timeframes (today, week, month, quarter, year)
- [ ] Update UI components to handle missing customer_name
- [ ] Migrate callers of deprecated get-by-ID functions
- [ ] Monitor performance in production
- [ ] Update financialSyncService (TSK0012)

## Common Patterns

### Environment-Aware Routing
```javascript
// dataService automatically routes based on environment
// No need for manual environment checks
const data = await dataService.get('/api/financial-records/query', params);
```

### Error Handling
```javascript
try {
  const records = await fetchFinancialRecords('today');
} catch (error) {
  console.error('[FinancialRecords] Error:', error);
  // Backend errors include status code and message
  // dataService throws standard Error objects
}
```

### Date Formatting
```javascript
// Backend expects YYYY-MM-DD
const date = '2026-01-15';

// Frontend displays MM/DD/YYYY (via convertSupabaseToFileMaker)
const displayDate = convertSupabaseToFileMaker(date); // "01/15/2026"
```

## Related Files

- **API Client**: `src/api/financialRecords.js`
- **Data Service**: `src/services/dataService.js`
- **Billable Hours Service**: `src/services/billableHoursService.js`
- **Feature Flags**: `src/context/FeatureFlagContext.jsx`

## Support

For questions or issues:
1. Check `TSK0009_COMPLETION_SUMMARY.md` for detailed migration notes
2. Review backend API spec: `https://api.claritybusinesssolutions.ca/docs`
3. Refer to similar migrations: Notes (`TSK0007`), Customers (`TSK0004`)
