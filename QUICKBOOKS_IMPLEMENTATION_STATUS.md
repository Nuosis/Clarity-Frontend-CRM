# QuickBooks Integration - Implementation Status

**Last Updated:** 2026-01-15
**Status:** ⚠️ Partially Ready - Phase 1 Can Start, Phase 2 Blocked

## Quick Summary

### ✅ What Works (Can Implement Now)
- **OAuth Token Storage**: `integration_tokens` table exists and ready
- **QuickBooks Connection Flow**: Can implement OAuth authorization
- **Token Management**: Refresh tokens, expiry tracking available
- **Connection Status**: Can check if organization has QuickBooks connected

### ❌ What's Blocked (Waiting on Backend)
- **Invoice Generation**: Missing QuickBooks columns in `customer_sales` table
- **Billing Status Tracking**: No `is_billed` column
- **Invoice Reference**: No `quickbooks_invoice_id` column
- **Sync Tracking**: No `quickbooks_synced_at` column

## Database Schema Status

### ✅ integration_tokens Table (READY)
Used for QuickBooks OAuth token storage with `provider = 'quickbooks'`

**Key Fields:**
- `access_token`, `refresh_token` - OAuth credentials
- `expires_at` - Token expiration timestamp
- `realm_id` - QuickBooks Company ID
- `organization_id` - Multi-tenant support
- `meta_data` - JSONB for additional config (can store QB settings temporarily)

**Indexes:**
- Unique constraint: One token per organization per provider

### ❌ customer_sales Table (MISSING QB COLUMNS)
Needs 4 additional columns for QuickBooks integration:

**Missing Columns:**
1. `is_billed` BOOLEAN - Track if sale has been invoiced
2. `quickbooks_invoice_id` TEXT - QB Invoice ID reference
3. `quickbooks_synced_at` TIMESTAMP - Last sync timestamp
4. `billed_at` TIMESTAMP - When sale was marked as billed

**Missing Indexes:**
1. `idx_customer_sales_qb_invoice` - Fast lookup by QB invoice ID
2. `idx_customer_sales_unbilled_qb` - Efficient unbilled sales filtering

### ❓ organization_quickbooks_config Table (OPTIONAL)
**Status:** Does not exist, but NOT required for Phase 1

**Workaround:** Use `integration_tokens.meta_data` JSONB field to store config:
```json
{
  "auto_sync_enabled": false,
  "sync_frequency": "manual",
  "default_income_account_ref": "80",
  "tax_code_ref": "TAX",
  "customer_mapping": {}
}
```

## Implementation Phases

### Phase 1: OAuth & Connection (CAN START NOW ✅)

**Backend API Endpoints:**
- `POST /api/quickbooks/oauth/authorize` - Initiate OAuth flow
- `GET /api/quickbooks/oauth/callback` - Handle OAuth callback
- `POST /api/quickbooks/oauth/refresh` - Refresh expired token
- `GET /api/quickbooks/connection/status` - Check connection status
- `DELETE /api/quickbooks/connection` - Disconnect QuickBooks

**Frontend Components:**
- QuickBooks connection settings panel
- "Connect to QuickBooks" button
- Connection status indicator
- Disconnect functionality
- Token expiry warnings

**Data Flow:**
1. User clicks "Connect to QuickBooks"
2. Frontend calls `/api/quickbooks/oauth/authorize`
3. Backend redirects to QuickBooks OAuth
4. User authorizes app
5. QuickBooks redirects to `/api/quickbooks/oauth/callback`
6. Backend stores token in `integration_tokens` with `provider='quickbooks'`
7. Frontend shows "Connected" status

### Phase 2: Invoicing & Billing (BLOCKED ❌)

**Blocked Until:** Backend deploys customer_sales schema migration

**Backend API Endpoints (BLOCKED):**
- `POST /api/quickbooks/invoices/create` - Generate QB invoice from sales
- `GET /api/quickbooks/invoices/{id}` - Fetch QB invoice details
- `POST /api/sales/{id}/bill` - Mark sale as billed
- `GET /api/sales/unbilled` - List unbilled sales for invoicing

**Frontend Components (BLOCKED):**
- "Generate Invoice" button on unbilled sales
- Billing status badges (Billed/Unbilled)
- Invoice reference links to QuickBooks
- Unbilled sales report/filter
- Bulk invoice generation

**Required Schema:**
```sql
ALTER TABLE customer_sales
ADD COLUMN is_billed BOOLEAN DEFAULT FALSE,
ADD COLUMN quickbooks_invoice_id TEXT,
ADD COLUMN quickbooks_synced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN billed_at TIMESTAMP WITH TIME ZONE;
```

### Phase 3: Advanced Features (FUTURE)

**Optional Enhancements:**
- Dedicated `organization_quickbooks_config` table (instead of meta_data)
- Automated invoice sync scheduling
- Bulk invoicing workflows
- QuickBooks invoice reconciliation
- Multi-currency support
- Tax code mapping UI

## Backend Team Action Items

### HIGH PRIORITY (Required for Phase 2)
1. **Deploy customer_sales Migration:**
   - Add 4 QuickBooks columns (is_billed, quickbooks_invoice_id, quickbooks_synced_at, billed_at)
   - Create 2 indexes (qb_invoice, unbilled_qb)
   - Add check constraints (is_billed = TRUE requires billed_at)

2. **Update RLS Policies:**
   - Verify billing role can update is_billed, billed_at
   - Test organization scoping on new columns

### MEDIUM PRIORITY (Nice to Have)
1. **Document integration_tokens Usage:**
   - QuickBooks token storage pattern
   - Example queries for common operations
   - Token encryption details (if implemented)

2. **Decide on Config Storage:**
   - Option A: Keep using `meta_data` field (simpler)
   - Option B: Create `organization_quickbooks_config` table (more normalized)

## Frontend Team Action Items

### CAN START NOW (Phase 1)
1. ✅ Implement QuickBooks OAuth flow
2. ✅ Build connection settings UI
3. ✅ Add connection status indicators
4. ✅ Implement disconnect functionality
5. ✅ Handle token refresh transparently

### WAITING ON BACKEND (Phase 2)
1. ⏳ Build billing status UI components
2. ⏳ Implement invoice generation features
3. ⏳ Add unbilled sales filtering
4. ⏳ Create invoice reference links
5. ⏳ Build bulk invoicing tools

## Testing Checklist

### Phase 1 Testing (Can Test Now)
- [ ] QuickBooks OAuth connection succeeds
- [ ] Token stored correctly in `integration_tokens`
- [ ] `realm_id` captured from OAuth callback
- [ ] Connection status displays correctly
- [ ] Disconnect removes token
- [ ] Token refresh works before expiry
- [ ] Organization scoping prevents cross-org access

### Phase 2 Testing (After Schema Deployment)
- [ ] Sales marked as billed correctly
- [ ] QuickBooks invoice ID stored
- [ ] Unbilled sales filter works
- [ ] Invoice generation creates QB invoice
- [ ] Sync timestamp updated correctly
- [ ] Billed sales cannot be modified (RLS policy)

## Verification Scripts

### Check Token Storage (Should Pass)
```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'integration_tokens');\""
```
**Expected:** `t` (true)

### Check QuickBooks Columns (Should Fail Currently)
```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT column_name FROM information_schema.columns WHERE table_name = 'customer_sales' AND column_name IN ('is_billed', 'quickbooks_invoice_id');\""
```
**Expected:** `0 rows` (columns don't exist yet)

### After Backend Deployment (Should Pass)
```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'customer_sales' AND column_name IN ('is_billed', 'quickbooks_invoice_id', 'quickbooks_synced_at', 'billed_at');\""
```
**Expected:** `4 rows` (all columns present)

## Related Documentation

- **Full Verification Report:** `BACKEND_SCHEMA_VERIFICATION_QUICKBOOKS.md`
- **QuickBooks API Docs:** https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/invoice
- **OAuth 2.0 Guide:** https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0

## Decision Log

### 2026-01-15: Use integration_tokens Instead of Dedicated Table
**Decision:** Use existing `integration_tokens` table with `provider = 'quickbooks'`
**Rationale:**
- Table already exists and has all required fields
- Supports multiple integrations (not just QuickBooks)
- Less schema complexity
- Organization scoping already implemented

**Trade-offs:**
- Slightly less explicit naming
- Generic schema may not enforce QB-specific constraints

### 2026-01-15: Defer Config Table Decision
**Decision:** Use `meta_data` JSONB field for Phase 1, decide on dedicated table later
**Rationale:**
- Unblocks Phase 1 implementation
- Can migrate to dedicated table later if needed
- Avoids premature optimization

**Next Step:** Backend team to decide if `organization_quickbooks_config` table is worth creating

---

**End of Status Report**
