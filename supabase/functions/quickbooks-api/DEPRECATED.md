# DEPRECATED: QuickBooks API Edge Function

**⚠️ This Supabase Edge Function is deprecated and should no longer be used.**

## Migration Information

This QuickBooks API edge function has been replaced with a new implementation that uses the Clarity backend API with proper HMAC-SHA256 authentication.

### New Implementation Location
- **File**: `src/api/quickbooksApi.js`
- **Import**: `import { functionName } from '../api'`

### Key Changes
1. **Authentication**: Now uses HMAC-SHA256 signature-based authentication instead of Supabase auth
2. **Backend**: Connects directly to the Clarity backend API (`https://api.claritybusinesssolutions.ca/quickbooks/`)
3. **Error Handling**: Improved error handling and response formatting
4. **Performance**: Better performance and reliability
5. **Additional Features**: More comprehensive QuickBooks operations available

### Migration Guide
Replace any imports from this edge function:

```javascript
// ❌ Old (deprecated)
import { supabase } from '../supabase'
const response = await supabase.functions.invoke('quickbooks-api', { ... })

// ✅ New (recommended)
import { getQBOCompanyInfo, listQBOCustomers } from '../api'
const companyInfo = await getQBOCompanyInfo()
const customers = await listQBOCustomers()
```

### Function Mapping
All functions from the old edge function are available in the new API with the same names:
- `getQBOCompanyInfo()`
- `listQBOCustomers()`
- `getQBOCustomer(id)`
- `createQBOCustomer(data)`
- `updateQBOCustomer(data)`
- `listQBOInvoices()`
- `getQBOInvoice(id)`
- `createQBOInvoice(data)`
- `updateQBOInvoice(data)`
- `executeQBOQuery(query)`
- And many more...

### Timeline
- **Deprecated**: January 2025
- **Removal**: This edge function will be removed in a future release

### Support
For questions about migration, see:
- `docs/FRONTEND_AUTHENTICATION_COMPREHENSIVE_GUIDE.md`
- `src/api/quickbooksApi.js` for implementation details