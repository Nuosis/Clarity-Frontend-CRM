# Backend Schema Verification - QuickBooks Integration

**Date:** 2026-01-15
**Verification Status:** ⚠️ PARTIALLY DEPLOYED

## Summary

The backend database schema for QuickBooks integration is **partially deployed**:
- ✅ Token storage exists via generic `integration_tokens` table (supports QuickBooks via `provider = 'quickbooks'`)
- ❌ Organization-specific QuickBooks configuration table does NOT exist
- ❌ Customer sales QuickBooks billing columns do NOT exist

## Verification Results

### 1. QuickBooks Tokens Storage
**Table Name:** `integration_tokens` (Generic integration tokens table)
**Status:** ✅ EXISTS (Can be used for QuickBooks via `provider = 'quickbooks'`)

**Actual Schema:**
```sql
CREATE TABLE integration_tokens (
    id UUID PRIMARY KEY,
    user_id UUID,                              -- Optional for user-level tokens
    organization_id UUID,                       -- Organization ID for multi-tenant support
    provider VARCHAR(50) NOT NULL,              -- e.g., 'quickbooks', 'stripe'
    access_token TEXT NOT NULL,                 -- OAuth access token (encrypted)
    refresh_token TEXT NOT NULL,                -- OAuth refresh token (encrypted)
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    realm_id VARCHAR(255),                      -- Provider-specific company ID (QuickBooks Company ID)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    meta_data JSONB,                            -- Additional provider-specific data

    -- Indexes
    UNIQUE(provider, organization_id) WHERE user_id IS NULL,  -- One token per provider per org
    UNIQUE(user_id, provider, organization_id) WHERE user_id IS NOT NULL  -- One token per user per provider per org
);
```

**QuickBooks Usage Pattern:**
- Use `provider = 'quickbooks'` for QuickBooks OAuth tokens
- Organization-level tokens: Set `organization_id`, leave `user_id` NULL
- User-level tokens: Set both `user_id` and `organization_id`
- `realm_id` stores QuickBooks Company ID (realmId from OAuth callback)
- `meta_data` can store additional QuickBooks config (e.g., sandbox mode, API base URL)

**Verification Command:**
```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"\\d+ integration_tokens\""
```

**Result:** ✅ Table exists with all required fields for QuickBooks OAuth

**Note:** This is a **better design** than a QuickBooks-specific table, as it supports multiple integrations (Stripe, Mailchimp, etc.) with a single schema.

---

### 2. Organization QuickBooks Config Table
**Table Name:** `organization_quickbooks_config`
**Status:** ❌ DOES NOT EXIST

**Expected Schema:**
```sql
CREATE TABLE organization_quickbooks_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    auto_sync_enabled BOOLEAN DEFAULT FALSE,
    sync_frequency TEXT DEFAULT 'manual',
    default_item_account_ref TEXT,
    default_income_account_ref TEXT,
    tax_code_ref TEXT,
    customer_mapping JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id)
);
```

**Verification Command:**
```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'organization_quickbooks_config');\""
```

**Result:** `f` (false - table does not exist)

---

### 3. Customer Sales Table - QuickBooks Columns
**Table Name:** `customer_sales`
**Status:** ❌ COLUMNS MISSING

**Current Schema:**
The `customer_sales` table exists but is missing the following required QuickBooks columns:
- `is_billed` (BOOLEAN)
- `quickbooks_invoice_id` (TEXT)
- `quickbooks_synced_at` (TIMESTAMP WITH TIME ZONE)
- `billed_at` (TIMESTAMP WITH TIME ZONE)

**Expected Additional Columns:**
```sql
ALTER TABLE customer_sales
ADD COLUMN is_billed BOOLEAN DEFAULT FALSE,
ADD COLUMN quickbooks_invoice_id TEXT,
ADD COLUMN quickbooks_synced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN billed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_customer_sales_qb_invoice ON customer_sales(quickbooks_invoice_id) WHERE quickbooks_invoice_id IS NOT NULL;
CREATE INDEX idx_customer_sales_unbilled ON customer_sales(organization_id, is_billed) WHERE is_billed = FALSE;
```

**Current Columns:**
- id (uuid)
- customer_id (uuid)
- product_id (uuid)
- product_name (text)
- quantity (numeric)
- unit_price (numeric)
- total_price (numeric)
- created_at (timestamp with time zone)
- updated_at (timestamp with time zone)
- organization_id (uuid)
- date (date)
- inv_id (text) - Legacy FileMaker invoice ID
- financial_id (uuid)
- configuration_data (jsonb)
- time_entry_id (uuid)
- project_id (uuid)

**Verification Command:**
```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"\\d+ customer_sales\""
```

**Result:** Table exists with legacy schema only - no QuickBooks columns present

---

## Missing Schema Elements Summary

### Tables Status:
1. ✅ **Token Storage Available** - `integration_tokens` table exists and can be used for QuickBooks OAuth (use `provider = 'quickbooks'`)
2. ❌ **Config Table Missing** - `organization_quickbooks_config` does not exist (may use `meta_data` in `integration_tokens` as alternative)

### Columns Missing (4):
**customer_sales table:**
1. ❌ `is_billed` - Boolean flag indicating if sale has been billed
2. ❌ `quickbooks_invoice_id` - QuickBooks invoice ID reference
3. ❌ `quickbooks_synced_at` - Timestamp of last QuickBooks sync
4. ❌ `billed_at` - Timestamp when sale was marked as billed

### Indexes Missing (2):
1. ❌ `idx_customer_sales_qb_invoice` - Index on quickbooks_invoice_id
2. ❌ `idx_customer_sales_unbilled` - Composite index on organization_id + is_billed

---

## Impact Assessment

### Frontend Implementation Status:

#### ✅ Can Implement (Token Storage Available):
1. **QuickBooks OAuth flow** - Use `integration_tokens` table with `provider = 'quickbooks'`
2. **Token refresh management** - `expires_at`, `refresh_token` fields available
3. **Basic QuickBooks connection** - `realm_id` stores Company ID

#### ⚠️ Workaround Available (Use meta_data field):
1. **QuickBooks settings storage** - Can use `meta_data` JSONB field in `integration_tokens` instead of separate config table
   - Store: `auto_sync_enabled`, `sync_frequency`, account refs, tax codes, customer mapping
   - Trade-off: Less normalized, but avoids additional table

#### ❌ Blocked (Customer Sales Schema Missing):
1. **Cannot track billing status** - No `is_billed` column in customer_sales
2. **Cannot link to QuickBooks invoices** - No `quickbooks_invoice_id` column
3. **Cannot display sync status** - No `quickbooks_synced_at` column
4. **Cannot filter unbilled sales efficiently** - No `is_billed` index for efficient queries
5. **Cannot mark sales as billed** - No `billed_at` timestamp column

### Backend API Endpoints Status:

#### ✅ Can Implement:
- `/api/quickbooks/oauth/authorize` - Use `integration_tokens` table
- `/api/quickbooks/oauth/callback` - Use `integration_tokens` table
- `/api/quickbooks/oauth/refresh` - Use `integration_tokens` table
- `/api/quickbooks/connection/status` - Check `integration_tokens` for provider='quickbooks'

#### ⚠️ Can Implement with Workaround:
- `/api/quickbooks/config` - Use `integration_tokens.meta_data` field (not ideal but functional)

#### ❌ Blocked:
- `/api/quickbooks/invoices/create` - Requires customer_sales QuickBooks columns to track invoice IDs
- `/api/quickbooks/invoices/sync` - Requires `quickbooks_synced_at` column
- `/api/sales/{id}/bill` - Requires `is_billed`, `billed_at` columns
- `/api/sales/unbilled` - Requires `is_billed` column for filtering

### Feature Capabilities Status:

#### ✅ Can Implement:
- QuickBooks OAuth connection and authorization
- Token refresh management
- Connection status display
- Disconnect QuickBooks functionality

#### ⚠️ Can Implement with Workaround:
- Organization-level config management (via meta_data instead of dedicated table)

#### ❌ Blocked Until Schema Deployed:
- Invoice generation from sales records
- Billing status tracking and updates
- Sync status monitoring per sale
- QuickBooks invoice lookup and reference
- Unbilled sales filtering and reporting
- Billed sales history and audit trail

---

## Required Actions

### Backend Team Actions Required:

#### HIGH PRIORITY (Blocks Core Features):
1. **Deploy customer_sales Schema Migration:**
   ```sql
   ALTER TABLE customer_sales
   ADD COLUMN is_billed BOOLEAN DEFAULT FALSE,
   ADD COLUMN quickbooks_invoice_id TEXT,
   ADD COLUMN quickbooks_synced_at TIMESTAMP WITH TIME ZONE,
   ADD COLUMN billed_at TIMESTAMP WITH TIME ZONE;

   CREATE INDEX idx_customer_sales_qb_invoice
   ON customer_sales(quickbooks_invoice_id)
   WHERE quickbooks_invoice_id IS NOT NULL;

   CREATE INDEX idx_customer_sales_unbilled_qb
   ON customer_sales(organization_id, is_billed, date)
   WHERE is_billed = FALSE;
   ```

2. **Update RLS Policies for customer_sales:**
   - Verify existing policies allow access to new columns
   - Test billing status updates (should be restricted to admin/billing roles)

3. **Verify Constraints:**
   - Add check constraint: `is_billed = TRUE` requires `billed_at IS NOT NULL`
   - Add check constraint: `quickbooks_invoice_id IS NOT NULL` requires `is_billed = TRUE`

#### MEDIUM PRIORITY (Optional - Can Use Workaround):
1. **Consider organization_quickbooks_config Table:**
   - **Option A:** Use `integration_tokens.meta_data` field (simpler, already available)
   - **Option B:** Create dedicated table for better normalization and validation
   - Decision needed: Is dedicated config table worth the additional complexity?

2. **Document integration_tokens Usage Pattern:**
   - Add documentation for QuickBooks OAuth token storage
   - Example queries for common operations (get token, refresh token, check expiry)
   - RLS policy verification for organization scoping

#### LOW PRIORITY (Already Functional):
1. **Test integration_tokens for QuickBooks:**
   - Verify `provider = 'quickbooks'` constraint works
   - Test uniqueness constraints (one token per org)
   - Verify token encryption (if implemented)

### Frontend Team Actions:

#### Can Implement Now (Phase 1 - OAuth & Connection):
1. ✅ **Implement QuickBooks OAuth flow** - Use `integration_tokens` table
2. ✅ **Connection status UI** - Check for existing QuickBooks token
3. ✅ **Disconnect functionality** - Delete QuickBooks token
4. ✅ **Token refresh handling** - Backend should auto-refresh before expiry

#### Blocked Until customer_sales Migration (Phase 2 - Invoicing):
1. ⏳ **Billing status UI components** - Requires `is_billed` column
2. ⏳ **Invoice generation features** - Requires `quickbooks_invoice_id` column
3. ⏳ **Unbilled sales filtering** - Requires `is_billed` index
4. ⏳ **Sync status display** - Requires `quickbooks_synced_at` column

### Recommended Implementation Strategy:

**Phase 1: OAuth & Connection (Can Start Now)**
- Implement QuickBooks OAuth flow using `integration_tokens`
- Store config in `meta_data` field temporarily
- Build connection status UI
- Test token refresh mechanism

**Phase 2: Invoicing & Billing (After customer_sales Migration)**
- Wait for backend to deploy customer_sales columns
- Implement billing status tracking
- Build invoice generation UI
- Add unbilled sales reporting

**Phase 3: Advanced Features (Optional)**
- Migrate config from `meta_data` to dedicated table (if backend team creates it)
- Add bulk invoicing features
- Implement sync scheduling
- Add QuickBooks invoice reconciliation

---

## Verification Commands Reference

### Token Storage Verification
```bash
# Check if integration_tokens table exists
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'integration_tokens');\""

# View integration_tokens schema
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"\\d+ integration_tokens\""

# Check for existing QuickBooks tokens (example query)
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT id, organization_id, provider, realm_id, expires_at FROM integration_tokens WHERE provider = 'quickbooks';\""
```

### Config Table Verification
```bash
# Check if organization_quickbooks_config exists (should be false)
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'organization_quickbooks_config');\""
```

### Customer Sales Schema Verification
```bash
# View customer_sales schema
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"\\d+ customer_sales\""

# Check for QuickBooks columns in customer_sales (should return 0 rows currently)
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customer_sales' AND column_name IN ('is_billed', 'quickbooks_invoice_id', 'quickbooks_synced_at', 'billed_at');\""

# List all indexes on customer_sales
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'customer_sales' ORDER BY indexname;\""

# Check for QuickBooks-specific indexes (should return 0 rows currently)
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'customer_sales' AND indexname LIKE '%qb%' OR indexname LIKE '%quickbooks%';\""
```

---

## Related Documentation

- **Backend Change Request:** `BACKEND_CHANGE_REQUEST_003_QUICKBOOKS_INTEGRATION.md` (if exists)
- **QuickBooks Integration Spec:** TBD
- **API Documentation:** TBD

---

## Next Steps

1. **Escalate to Backend Team:**
   - Share this verification report
   - Request schema deployment timeline
   - Coordinate deployment to dev/staging/production

2. **Create Backend Change Request (if not exists):**
   - Document complete schema requirements
   - Include all table definitions, constraints, indexes
   - Add RLS policy specifications
   - Define rollback plan

3. **Update Project Task Status:**
   - Mark schema verification task as complete
   - Mark dependent frontend tasks as blocked
   - Add backend deployment task to project

4. **Monitor Deployment:**
   - Re-run verification commands after backend deployment
   - Update this document with deployment confirmation
   - Unblock frontend implementation tasks

---

## Deployment Checklist

### Pre-Deployment:
- [ ] Backend change request reviewed and approved
- [ ] Migration scripts created and tested in dev
- [ ] RLS policies defined and tested
- [ ] Rollback plan documented

### Deployment:
- [ ] Dev environment migration successful
- [ ] Dev environment verification successful
- [ ] Staging environment migration successful
- [ ] Staging environment verification successful
- [ ] Production environment migration successful
- [ ] Production environment verification successful

### Post-Deployment:
- [ ] All tables exist and accessible
- [ ] All columns exist with correct types
- [ ] All indexes created
- [ ] RLS policies active and working
- [ ] Organization scoping verified
- [ ] Frontend team notified
- [ ] Documentation updated

---

**End of Report**
