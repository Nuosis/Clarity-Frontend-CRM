# Backend Change Request: QuickBooks Migration to Supabase

**Request ID:** BACKEND_CHANGE_REQUEST_001_QUICKBOOKS_MIGRATION
**Date:** 2026-01-11
**Requester:** Frontend Team (via Claude)
**Priority:** High
**Target Release:** Q1 2026

---

## Executive Summary

This change request outlines the backend infrastructure changes required to migrate QuickBooks Online (QBO) integration from FileMaker-dependent operations to a fully Supabase-backed architecture. This migration enables standalone web app QuickBooks functionality, eliminates FileMaker script dependencies, and provides real-time user feedback for invoice operations.

**Impact:**
- **Database:** Two new tables (`quickbooks_tokens`, `organization_quickbooks_config`), schema updates to `customer_sales` table, RLS policies, triggers, and indexes
- **API:** All QuickBooks endpoints already exist and are working (no API changes required)
- **Performance:** Improved invoice generation with real-time feedback, automatic token refresh, comprehensive error handling
- **Data Volume:** ~20-50 organizations × ~100-500 customer sales records per org
- **Migration:** One-time data migration from FileMaker `devRecords` layout to Supabase `customer_sales` table

**Dependencies:**
- Organization structure must be stable (`organizations` table exists)
- User authentication system must provide `organization_id` in JWT claims
- Existing QuickBooks backend API endpoints must remain functional
- Customer sales data must be synchronized from FileMaker before cutover

**Status Note:**
- ✅ Backend QuickBooks API endpoints already implemented and working
- ⚠️ Database schema changes required for token storage and configuration
- ⏳ Frontend implementation waiting on backend schema deployment

---

## Table of Contents

1. [Database Schema Changes](#database-schema-changes)
2. [Row Level Security (RLS) Policies](#row-level-security-rls-policies)
3. [Database Triggers](#database-triggers)
4. [API Endpoints](#api-endpoints)
5. [Indexes](#indexes)
6. [Migration Script](#migration-script)
7. [Testing Requirements](#testing-requirements)
8. [Rollback Plan](#rollback-plan)
9. [Performance Considerations](#performance-considerations)
10. [Frontend Implementation Status](#frontend-implementation-status)
11. [Related Documentation](#related-documentation)

---

## Database Schema Changes

### 1. Create `quickbooks_tokens` Table

**Purpose:** Secure storage of QuickBooks OAuth 2.0 credentials per organization

**Rationale:**
- Current system has no persistent token storage (tokens lost on script completion)
- Backend API endpoints require stored tokens for automatic refresh
- Multi-tenant isolation requires organization-scoped token management
- Security best practice: tokens never exposed to frontend

```sql
CREATE TABLE quickbooks_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- OAuth Credentials (encrypted at rest)
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,

  -- QuickBooks Company Identification
  realm_id TEXT NOT NULL,
  company_name TEXT,

  -- Connection State
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_validated_at TIMESTAMPTZ,

  -- OAuth Flow State (CSRF protection)
  oauth_state TEXT,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT quickbooks_tokens_org_unique UNIQUE (organization_id),
  CONSTRAINT quickbooks_tokens_realm_unique UNIQUE (realm_id)
);

-- Indexes
CREATE INDEX idx_quickbooks_tokens_org ON quickbooks_tokens(organization_id);
CREATE INDEX idx_quickbooks_tokens_realm ON quickbooks_tokens(realm_id);
CREATE INDEX idx_quickbooks_tokens_expires ON quickbooks_tokens(expires_at)
  WHERE is_active = true;

-- Comments
COMMENT ON TABLE quickbooks_tokens IS 'OAuth 2.0 credentials for QuickBooks Online integration per organization';
COMMENT ON COLUMN quickbooks_tokens.access_token IS 'OAuth access token (1 hour lifespan)';
COMMENT ON COLUMN quickbooks_tokens.refresh_token IS 'OAuth refresh token (100 day lifespan)';
COMMENT ON COLUMN quickbooks_tokens.expires_at IS 'Access token expiration timestamp';
COMMENT ON COLUMN quickbooks_tokens.realm_id IS 'QuickBooks Company ID';
COMMENT ON COLUMN quickbooks_tokens.oauth_state IS 'CSRF validation state during OAuth flow';
```

**Validation Rules:**
- `access_token`: Required (NOT NULL), encrypted at rest
- `refresh_token`: Required (NOT NULL), encrypted at rest
- `expires_at`: Required (NOT NULL), must be future timestamp on insert
- `realm_id`: Required (NOT NULL), unique across all organizations
- `organization_id`: Required (NOT NULL), must reference valid organization, unique (one QB connection per org)
- `is_active`: Defaults to true, set to false on disconnection

**Frontend Integration:**
- Frontend NEVER accesses this table directly
- Frontend initiates OAuth flow via backend API: `GET /quickbooks/authorize`
- Backend stores tokens after OAuth callback: `POST /quickbooks/oauth/callback`
- Frontend checks connection status via: `POST /quickbooks/validate`

**Code References:**
- OAuth flow: `src/api/quickbooksApi.js:195-216`
- Token refresh: `src/api/quickbooksApi.js:218-226`
- Data model spec: `requirements/quickbooks/data-model-mapping.md:50-106`

---

### 2. Create `organization_quickbooks_config` Table

**Purpose:** Store QuickBooks-specific configuration and business rules per organization

**Rationale:**
- Current implementation has hardcoded tax codes, item IDs, and invoice rules
- Different organizations may have different QuickBooks setups
- Configuration should be database-driven, not code-driven
- Enables multi-tenant flexibility without code changes

```sql
CREATE TABLE organization_quickbooks_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- QuickBooks Company Info
  realm_id TEXT NOT NULL,
  company_name TEXT,

  -- Default Invoice Settings
  default_currency TEXT NOT NULL DEFAULT 'CAD',
  default_payment_terms TEXT NOT NULL DEFAULT 'Net 30',
  default_email_delivery BOOLEAN NOT NULL DEFAULT true,

  -- Tax Configuration (Canada-specific)
  cad_tax_code INTEGER NOT NULL DEFAULT 4,
  non_cad_tax_code INTEGER NOT NULL DEFAULT 3,

  -- Item/Service IDs by Currency
  cad_item_id TEXT NOT NULL DEFAULT '3',
  cad_item_name TEXT NOT NULL DEFAULT 'Development CAD',
  usd_item_id TEXT NOT NULL DEFAULT '7',
  usd_item_name TEXT NOT NULL DEFAULT 'Development USD',
  eur_item_id TEXT NOT NULL DEFAULT '8',
  eur_item_name TEXT NOT NULL DEFAULT 'Development EUR',

  -- Invoice Numbering Format
  invoice_number_format TEXT NOT NULL DEFAULT '{qboCustomerId}{YY}{MM}{NNN}',

  -- Sync Settings
  auto_sync_enabled BOOLEAN NOT NULL DEFAULT true,
  sync_frequency_hours INTEGER NOT NULL DEFAULT 24,
  last_sync_at TIMESTAMPTZ,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT org_qb_config_org_unique UNIQUE (organization_id),
  CONSTRAINT org_qb_config_currency_valid CHECK (default_currency IN ('CAD', 'USD', 'EUR'))
);

-- Indexes
CREATE INDEX idx_org_qb_config_org ON organization_quickbooks_config(organization_id);
CREATE INDEX idx_org_qb_config_realm ON organization_quickbooks_config(realm_id);

-- Comments
COMMENT ON TABLE organization_quickbooks_config IS 'QuickBooks configuration and business rules per organization';
COMMENT ON COLUMN organization_quickbooks_config.realm_id IS 'Links to quickbooks_tokens.realm_id';
COMMENT ON COLUMN organization_quickbooks_config.cad_tax_code IS 'QB tax code for CAD currency invoices (default: 4)';
COMMENT ON COLUMN organization_quickbooks_config.non_cad_tax_code IS 'QB tax code for non-CAD currency invoices (default: 3)';
COMMENT ON COLUMN organization_quickbooks_config.cad_item_id IS 'QB Item ID for CAD development services (default: 3)';
COMMENT ON COLUMN organization_quickbooks_config.invoice_number_format IS 'Format: {qboCustomerId}{YY}{MM}{NNN}';
```

**Validation Rules:**
- `organization_id`: Required (NOT NULL), unique (one config per org)
- `realm_id`: Required (NOT NULL), must match `quickbooks_tokens.realm_id`
- `default_currency`: Must be 'CAD', 'USD', or 'EUR'
- `cad_tax_code`, `non_cad_tax_code`: Must be positive integers
- `cad_item_id`, `usd_item_id`, `eur_item_id`: Required (NOT NULL)
- `sync_frequency_hours`: Must be >= 1

**Migration from Hardcoded Values:**
Current hardcoded values in `src/services/invoiceGenerationService.js`:
- Tax codes: Line 206-209 (`currency === 'CAD' ? 4 : 3`)
- Item IDs: Line 216-225 (CAD=3, USD=7, EUR=8)
- Invoice format: Line 87-110 (`{qboCustomerId}{YY}{MM}{NNN}`)

**Frontend Integration:**
- Frontend reads config via backend API: `GET /api/organizations/{org_id}/quickbooks/config`
- Admin users can update via: `PUT /api/organizations/{org_id}/quickbooks/config`
- Invoice generation service uses config for tax codes, item IDs, format

**Code References:**
- Current hardcoded values: `src/services/invoiceGenerationService.js:206-225`
- Data model spec: `requirements/quickbooks/data-model-mapping.md:168-234`

---

### 3. Update `customer_sales` Table Schema

**Purpose:** Add QuickBooks synchronization tracking fields

**Background:**
- `customer_sales` table already exists in Supabase (verified via SSH)
- Current schema missing QB invoice tracking and billed status
- Need to track QB invoice ID, sync status, and billing state

```sql
-- Add QuickBooks tracking columns to existing customer_sales table
ALTER TABLE customer_sales
  ADD COLUMN IF NOT EXISTS quickbooks_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS quickbooks_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_billed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billed_at TIMESTAMPTZ;

-- Add index for unbilled records query
CREATE INDEX IF NOT EXISTS idx_customer_sales_unbilled
  ON customer_sales(customer_id, is_billed)
  WHERE is_billed = false;

-- Add index for QB sync status
CREATE INDEX IF NOT EXISTS idx_customer_sales_qb_invoice
  ON customer_sales(quickbooks_invoice_id)
  WHERE quickbooks_invoice_id IS NOT NULL;

-- Comments
COMMENT ON COLUMN customer_sales.quickbooks_invoice_id IS 'QuickBooks invoice ID after successful creation';
COMMENT ON COLUMN customer_sales.quickbooks_synced_at IS 'Timestamp when record was synced to QuickBooks';
COMMENT ON COLUMN customer_sales.is_billed IS 'Whether record has been included in a QuickBooks invoice';
COMMENT ON COLUMN customer_sales.billed_at IS 'Timestamp when record was marked as billed';
```

**Validation Rules:**
- `is_billed`: Defaults to false, set to true after invoice creation
- `quickbooks_invoice_id`: Set after successful QB invoice creation
- `quickbooks_synced_at`: Automatically set when `quickbooks_invoice_id` is populated
- `billed_at`: Automatically set when `is_billed` transitions from false to true

**Migration from FileMaker:**
- FileMaker `devRecords.f_billed` maps to `is_billed`
- FileMaker `devRecords.__ID` preserved in `id` field (UUID format)
- FileMaker `devRecords.financial_id` deprecated (use UUID `id` instead)

**Frontend Integration:**
- Frontend queries unbilled records: `SELECT * FROM customer_sales WHERE customer_id = ? AND is_billed = false`
- Frontend updates billed status after invoice creation
- Frontend displays QB invoice ID in sales table UI

**Code References:**
- Current FileMaker field mappings: `requirements/quickbooks/README.md:136-163`
- Customer sales service: `src/services/customerSalesService.js`
- Data model spec: `requirements/quickbooks/data-model-mapping.md:588-658`

---

### 4. Verify Existing Schema Compatibility

**Tables Already Exist (No Changes Required):**

**`organizations` Table:**
- Already exists with `id`, `name`, `secret` columns
- Used for multi-tenant isolation
- `secret` field used for HMAC authentication

**`customers` Table:**
- Already exists in Supabase
- Synchronized from FileMaker `devCustomers` layout
- Contains `quickbooks_customer_id` column for QB integration
- RLS policies enforce organization scoping

**Verification Commands:**
```bash
# Verify organizations table
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"\\d+ organizations\""

# Verify customers table
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"\\d+ customers\""

# Verify customer_sales table
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"\\d+ customer_sales\""
```

**Code References:**
- SSH verification patterns: `CLAUDE.md:191-209`
- Database verification guide: `.roo/rules/SUPABASE_DATABASE_VERIFICATION.md`

---

## Row Level Security (RLS) Policies

### 1. `quickbooks_tokens` RLS Policies

**Purpose:** Ensure organization isolation for OAuth tokens

```sql
-- Enable RLS
ALTER TABLE quickbooks_tokens ENABLE ROW LEVEL SECURITY;

-- Read Policy: Users can only read tokens for their organization
CREATE POLICY quickbooks_tokens_select ON quickbooks_tokens
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_profile
      WHERE user_id = auth.uid()
    )
  );

-- Insert Policy: Service role only (backend handles OAuth)
CREATE POLICY quickbooks_tokens_insert ON quickbooks_tokens
  FOR INSERT
  WITH CHECK (false);  -- Only backend via service role

-- Update Policy: Service role only (backend handles token refresh)
CREATE POLICY quickbooks_tokens_update ON quickbooks_tokens
  FOR UPDATE
  USING (false);  -- Only backend via service role

-- Delete Policy: Admins can disconnect QuickBooks for their org
CREATE POLICY quickbooks_tokens_delete ON quickbooks_tokens
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_profile
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );
```

**Rationale:**
- Frontend can read connection status (SELECT) but never raw tokens
- Only backend service role can insert/update tokens (security)
- Admins can disconnect QB connection (DELETE)
- Multi-tenant isolation via `user_profile.organization_id`

**Testing Requirements:**
- ✅ User can query if their org has QB connected (count, exists check)
- ✅ User CANNOT read token values (access_token, refresh_token should be NULL in result)
- ❌ User CANNOT insert tokens directly (must fail)
- ❌ User CANNOT update tokens directly (must fail)
- ✅ Admin can delete their org's QB connection
- ❌ User CANNOT access tokens for other organizations (must return empty)

---

### 2. `organization_quickbooks_config` RLS Policies

**Purpose:** Allow users to read config, admins to modify

```sql
-- Enable RLS
ALTER TABLE organization_quickbooks_config ENABLE ROW LEVEL SECURITY;

-- Read Policy: Users can read config for their organization
CREATE POLICY org_qb_config_select ON organization_quickbooks_config
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_profile
      WHERE user_id = auth.uid()
    )
  );

-- Insert Policy: Admins can create config for their organization
CREATE POLICY org_qb_config_insert ON organization_quickbooks_config
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM user_profile
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- Update Policy: Admins can modify config for their organization
CREATE POLICY org_qb_config_update ON organization_quickbooks_config
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_profile
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- Delete Policy: Admins can delete config for their organization
CREATE POLICY org_qb_config_delete ON organization_quickbooks_config
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_profile
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );
```

**Rationale:**
- All users can read QB configuration (needed for invoice generation)
- Only admins can create/update/delete configuration
- Multi-tenant isolation via `user_profile.organization_id`

**Testing Requirements:**
- ✅ User can read their org's QB config
- ✅ Admin can insert new config
- ✅ Admin can update existing config
- ❌ Non-admin user CANNOT update config (must fail)
- ❌ User CANNOT access config for other organizations (must return empty)

---

### 3. `customer_sales` RLS Policies

**Existing Policies (Assumed):**
```sql
-- Verify existing RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'customer_sales';
```

**Required Policies (if not already present):**
```sql
-- Enable RLS
ALTER TABLE customer_sales ENABLE ROW LEVEL SECURITY;

-- Read Policy: Users can only read sales for their organization's customers
CREATE POLICY customer_sales_select ON customer_sales
  FOR SELECT
  USING (
    customer_id IN (
      SELECT id
      FROM customers
      WHERE organization_id IN (
        SELECT organization_id
        FROM user_profile
        WHERE user_id = auth.uid()
      )
    )
  );

-- Update Policy: Users can update sales for their organization's customers
CREATE POLICY customer_sales_update ON customer_sales
  FOR UPDATE
  USING (
    customer_id IN (
      SELECT id
      FROM customers
      WHERE organization_id IN (
        SELECT organization_id
        FROM user_profile
        WHERE user_id = auth.uid()
      )
    )
  );
```

**Testing Requirements:**
- ✅ User can read customer_sales for their org's customers
- ✅ User can update `is_billed` and `quickbooks_invoice_id` fields
- ❌ User CANNOT access customer_sales for other organizations

---

## Database Triggers

### 1. `updated_at` Timestamp Trigger

**Purpose:** Automatically update `updated_at` column on row modifications

```sql
-- Create trigger function (if not already exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to quickbooks_tokens
CREATE TRIGGER update_quickbooks_tokens_updated_at
  BEFORE UPDATE ON quickbooks_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply to organization_quickbooks_config
CREATE TRIGGER update_org_qb_config_updated_at
  BEFORE UPDATE ON organization_quickbooks_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

### 2. `billed_at` Timestamp Trigger

**Purpose:** Automatically set `billed_at` when `is_billed` transitions to true

```sql
CREATE OR REPLACE FUNCTION set_billed_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- If is_billed is changing from false to true, set billed_at
  IF NEW.is_billed = true AND (OLD.is_billed IS NULL OR OLD.is_billed = false) THEN
    NEW.billed_at = NOW();
  END IF;

  -- If is_billed is changing from true to false, clear billed_at
  IF NEW.is_billed = false AND OLD.is_billed = true THEN
    NEW.billed_at = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customer_sales_set_billed_at
  BEFORE UPDATE ON customer_sales
  FOR EACH ROW
  WHEN (OLD.is_billed IS DISTINCT FROM NEW.is_billed)
  EXECUTE FUNCTION set_billed_at_timestamp();
```

---

### 3. `quickbooks_synced_at` Timestamp Trigger

**Purpose:** Automatically set `quickbooks_synced_at` when `quickbooks_invoice_id` is populated

```sql
CREATE OR REPLACE FUNCTION set_qb_synced_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- If quickbooks_invoice_id is being set (from NULL to non-NULL), set synced_at
  IF NEW.quickbooks_invoice_id IS NOT NULL AND OLD.quickbooks_invoice_id IS NULL THEN
    NEW.quickbooks_synced_at = NOW();
  END IF;

  -- If quickbooks_invoice_id is being cleared, clear synced_at
  IF NEW.quickbooks_invoice_id IS NULL AND OLD.quickbooks_invoice_id IS NOT NULL THEN
    NEW.quickbooks_synced_at = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customer_sales_set_qb_synced_at
  BEFORE UPDATE ON customer_sales
  FOR EACH ROW
  WHEN (OLD.quickbooks_invoice_id IS DISTINCT FROM NEW.quickbooks_invoice_id)
  EXECUTE FUNCTION set_qb_synced_at_timestamp();
```

---

## API Endpoints

### Summary: No New Endpoints Required

**Status:** ✅ All QuickBooks API endpoints are **already implemented and working** in production.

**Base URL:** `https://api.claritybusinesssolutions.ca/quickbooks`

**Existing Endpoints:**

**OAuth & Initialization:**
- `GET /quickbooks/authorize` - Initialize OAuth flow
- `POST /quickbooks/oauth/callback` - Handle OAuth callback
- `POST /quickbooks/token/refresh` - Refresh access token
- `POST /quickbooks/validate` - Validate credentials

**Customer Management:**
- `GET /quickbooks/customers` - List QB customers
- `GET /quickbooks/customers/{id}` - Get specific customer
- `POST /quickbooks/customers` - Create QB customer
- `PUT /quickbooks/customers/{id}` - Update QB customer
- `POST /quickbooks/customers/search` - Search customers

**Invoice Operations:**
- `GET /quickbooks/invoices` - List QB invoices
- `GET /quickbooks/invoices/{id}` - Get specific invoice
- `POST /quickbooks/invoices` - Create QB invoice
- `PUT /quickbooks/invoices/{id}` - Update QB invoice
- `POST /quickbooks/invoices/{id}/send` - Email invoice to customer

**Reference Data:**
- `GET /quickbooks/company` - Get company info
- `GET /quickbooks/items` - List items/services
- `POST /quickbooks/query` - Execute custom query

**Complete Documentation:**
- API contracts: `.devflow/tasks/quickbooks-migration-requirements/api-contracts.md`
- Frontend client: `src/api/quickbooksApi.js`
- Authorization spec: `requirements/quickbooks/authorization.md`

**Backend Changes Required:**
- ✅ Endpoints already implement token storage and refresh
- ⚠️ Endpoints may need minor updates to use new schema tables
- ⚠️ Endpoints should read config from `organization_quickbooks_config` table
- ⚠️ Endpoints should update `customer_sales.is_billed` after invoice creation

---

## Indexes

### Performance Optimization Indexes

All indexes are defined inline with table creation (see [Database Schema Changes](#database-schema-changes)):

**`quickbooks_tokens` Indexes:**
- `idx_quickbooks_tokens_org` on `organization_id` (foreign key lookup)
- `idx_quickbooks_tokens_realm` on `realm_id` (QB company lookup)
- `idx_quickbooks_tokens_expires` on `expires_at` WHERE `is_active = true` (token refresh job)

**`organization_quickbooks_config` Indexes:**
- `idx_org_qb_config_org` on `organization_id` (foreign key lookup)
- `idx_org_qb_config_realm` on `realm_id` (QB company lookup)

**`customer_sales` Indexes:**
- `idx_customer_sales_unbilled` on `(customer_id, is_billed)` WHERE `is_billed = false` (invoice generation queries)
- `idx_customer_sales_qb_invoice` on `quickbooks_invoice_id` WHERE `quickbooks_invoice_id IS NOT NULL` (QB sync status)

**Rationale:**
- Unbilled records query is critical path for invoice generation
- Organization scoping queries are frequent (multi-tenant architecture)
- Token expiration checks run on scheduled job (hourly)
- Partial indexes reduce index size and improve performance

---

## Migration Script

### Overview

**Purpose:** Migrate existing financial records from FileMaker to Supabase and deploy new schema

**Prerequisites:**
- Backend database access (service role)
- FileMaker API credentials
- Backup of existing data completed
- Schema changes deployed to dev environment

### Migration Steps

```sql
-- ============================================
-- QUICKBOOKS MIGRATION SCRIPT
-- Version: 1.0
-- Date: 2026-01-11
-- ============================================

-- Step 1: Create new tables
-- (Run all CREATE TABLE statements from "Database Schema Changes" section)

-- Step 2: Create indexes
-- (Run all CREATE INDEX statements from "Database Schema Changes" section)

-- Step 3: Create RLS policies
-- (Run all RLS policy statements from "Row Level Security" section)

-- Step 4: Create triggers
-- (Run all trigger creation statements from "Database Triggers" section)

-- Step 5: Alter existing customer_sales table
ALTER TABLE customer_sales
  ADD COLUMN IF NOT EXISTS quickbooks_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS quickbooks_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_billed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billed_at TIMESTAMPTZ;

-- Step 6: Migrate FileMaker f_billed status to Supabase
-- (This step requires data migration from FileMaker devRecords)
-- Backend team will execute via data migration script

UPDATE customer_sales cs
SET
  is_billed = true,
  billed_at = NOW()
WHERE cs.id IN (
  -- Map from FileMaker devRecords where f_billed = 1
  -- Requires JOIN with FileMaker sync table or manual mapping
  SELECT supabase_id FROM filemaker_migration_map WHERE fm_billed = 1
);

-- Step 7: Create default QB config for existing organizations
INSERT INTO organization_quickbooks_config (
  organization_id,
  realm_id,
  company_name,
  default_currency,
  default_payment_terms,
  default_email_delivery,
  cad_tax_code,
  non_cad_tax_code,
  cad_item_id,
  cad_item_name,
  usd_item_id,
  usd_item_name,
  eur_item_id,
  eur_item_name,
  invoice_number_format,
  auto_sync_enabled,
  sync_frequency_hours
)
SELECT
  o.id AS organization_id,
  'PENDING' AS realm_id,  -- Must be updated after QB OAuth
  'Pending Connection' AS company_name,
  'CAD' AS default_currency,
  'Net 30' AS default_payment_terms,
  true AS default_email_delivery,
  4 AS cad_tax_code,
  3 AS non_cad_tax_code,
  '3' AS cad_item_id,
  'Development CAD' AS cad_item_name,
  '7' AS usd_item_id,
  'Development USD' AS usd_item_name,
  '8' AS eur_item_id,
  'Development EUR' AS eur_item_name,
  '{qboCustomerId}{YY}{MM}{NNN}' AS invoice_number_format,
  true AS auto_sync_enabled,
  24 AS sync_frequency_hours
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM organization_quickbooks_config WHERE organization_id = o.id
);

-- Step 8: Verify migration
SELECT
  'quickbooks_tokens' AS table_name,
  COUNT(*) AS row_count
FROM quickbooks_tokens
UNION ALL
SELECT
  'organization_quickbooks_config',
  COUNT(*)
FROM organization_quickbooks_config
UNION ALL
SELECT
  'customer_sales (unbilled)',
  COUNT(*)
FROM customer_sales
WHERE is_billed = false;

-- Step 9: Verify RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('quickbooks_tokens', 'organization_quickbooks_config', 'customer_sales')
ORDER BY tablename, policyname;

-- Step 10: Verify triggers
SELECT
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('quickbooks_tokens', 'organization_quickbooks_config', 'customer_sales')
ORDER BY event_object_table, trigger_name;
```

### Data Migration from FileMaker

**Separate Migration Script Required:**

The backend team will need to execute a data migration from FileMaker `devRecords` to Supabase `customer_sales`. This is beyond the scope of this schema change request.

**Migration Requirements:**
- Map FileMaker `__ID` to Supabase `customer_sales.id` (preserve UUID if possible)
- Map FileMaker `f_billed` to Supabase `customer_sales.is_billed`
- Preserve all financial record fields (date, amount, product_name, etc.)
- Set `billed_at` timestamp for records where `f_billed = 1`

**Frontend Responsibility:**
- Frontend code: `src/services/financialSyncService.js` (lines 1-300+)
- Frontend can assist with data extraction from FileMaker API
- Backend team owns the data loading into Supabase

---

## Testing Requirements

### 1. Schema Validation Tests

**Objective:** Verify all schema changes are deployed correctly

**Test Cases:**

```sql
-- TC1: Verify quickbooks_tokens table exists
SELECT EXISTS (
  SELECT FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename = 'quickbooks_tokens'
);
-- Expected: true

-- TC2: Verify organization_quickbooks_config table exists
SELECT EXISTS (
  SELECT FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename = 'organization_quickbooks_config'
);
-- Expected: true

-- TC3: Verify customer_sales columns added
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'customer_sales'
  AND column_name IN ('quickbooks_invoice_id', 'quickbooks_synced_at', 'is_billed', 'billed_at');
-- Expected: 4 rows returned

-- TC4: Verify unique constraints
SELECT
  constraint_name,
  table_name
FROM information_schema.table_constraints
WHERE table_name IN ('quickbooks_tokens', 'organization_quickbooks_config')
  AND constraint_type = 'UNIQUE';
-- Expected: quickbooks_tokens_org_unique, quickbooks_tokens_realm_unique, org_qb_config_org_unique

-- TC5: Verify foreign key constraints
SELECT
  constraint_name,
  table_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name IN ('quickbooks_tokens', 'organization_quickbooks_config')
  AND constraint_type = 'FOREIGN KEY';
-- Expected: Foreign keys to organizations table
```

---

### 2. RLS Policy Tests

**Objective:** Verify row-level security policies enforce organization isolation

**Test Cases:**

```sql
-- TC6: Test quickbooks_tokens RLS isolation
-- Setup: Create test users in different orgs
-- Verify: User A cannot see User B's tokens

-- TC7: Test org_qb_config RLS isolation
-- Setup: Create test configs for different orgs
-- Verify: User A cannot see User B's config

-- TC8: Test admin-only update policies
-- Setup: Create regular user and admin user
-- Verify: Regular user cannot update config
-- Verify: Admin user can update config

-- TC9: Test service role bypass
-- Setup: Use service role credentials
-- Verify: Service role can insert/update all tables
```

**Frontend Integration Tests:**

```javascript
// TC10: Frontend cannot read raw tokens
const { data, error } = await supabase
  .from('quickbooks_tokens')
  .select('access_token, refresh_token')
  .single();
// Expected: access_token and refresh_token should be NULL or policy blocks query

// TC11: Frontend can check connection status
const { data, error } = await supabase
  .from('quickbooks_tokens')
  .select('is_active, expires_at, company_name')
  .eq('organization_id', currentOrgId)
  .single();
// Expected: Returns connection status without raw tokens

// TC12: Frontend can read QB config
const { data, error } = await supabase
  .from('organization_quickbooks_config')
  .select('*')
  .eq('organization_id', currentOrgId)
  .single();
// Expected: Returns full config for user's org
```

---

### 3. Trigger Tests

**Objective:** Verify triggers automatically maintain timestamp fields

**Test Cases:**

```sql
-- TC13: Test updated_at trigger on quickbooks_tokens
INSERT INTO quickbooks_tokens (organization_id, access_token, refresh_token, expires_at, realm_id)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'test_token',
  'test_refresh',
  NOW() + INTERVAL '1 hour',
  'test_realm'
);

-- Wait 1 second
SELECT pg_sleep(1);

UPDATE quickbooks_tokens
SET access_token = 'new_token'
WHERE realm_id = 'test_realm';

SELECT
  created_at,
  updated_at,
  updated_at > created_at AS updated_correctly
FROM quickbooks_tokens
WHERE realm_id = 'test_realm';
-- Expected: updated_correctly = true

-- TC14: Test billed_at trigger on customer_sales
UPDATE customer_sales
SET is_billed = true
WHERE id = 'test-sales-record-id';

SELECT
  is_billed,
  billed_at,
  billed_at IS NOT NULL AS billed_at_set
FROM customer_sales
WHERE id = 'test-sales-record-id';
-- Expected: billed_at_set = true

-- TC15: Test quickbooks_synced_at trigger on customer_sales
UPDATE customer_sales
SET quickbooks_invoice_id = 'QB-INV-123'
WHERE id = 'test-sales-record-id';

SELECT
  quickbooks_invoice_id,
  quickbooks_synced_at,
  quickbooks_synced_at IS NOT NULL AS synced_at_set
FROM customer_sales
WHERE id = 'test-sales-record-id';
-- Expected: synced_at_set = true
```

---

### 4. Index Performance Tests

**Objective:** Verify indexes improve query performance

**Test Cases:**

```sql
-- TC16: Test unbilled records query performance
EXPLAIN ANALYZE
SELECT * FROM customer_sales
WHERE customer_id = 'test-customer-id'
  AND is_billed = false;
-- Expected: Uses idx_customer_sales_unbilled index
-- Expected: Execution time < 100ms

-- TC17: Test QB token lookup performance
EXPLAIN ANALYZE
SELECT * FROM quickbooks_tokens
WHERE organization_id = 'test-org-id';
-- Expected: Uses idx_quickbooks_tokens_org index
-- Expected: Execution time < 50ms

-- TC18: Test QB config lookup performance
EXPLAIN ANALYZE
SELECT * FROM organization_quickbooks_config
WHERE organization_id = 'test-org-id';
-- Expected: Uses idx_org_qb_config_org index
-- Expected: Execution time < 50ms
```

---

### 5. Integration Tests

**Objective:** Verify end-to-end QuickBooks workflow with new schema

**Test Cases:**

**TC19: OAuth Flow Integration**
1. Frontend calls `GET /quickbooks/authorize`
2. Backend generates OAuth URL with state token
3. Frontend redirects user to QuickBooks
4. User approves connection
5. QuickBooks redirects to callback with code
6. Frontend calls `POST /quickbooks/oauth/callback`
7. Backend exchanges code for tokens
8. Backend stores tokens in `quickbooks_tokens` table
9. Backend creates default config in `organization_quickbooks_config`
10. Frontend calls `POST /quickbooks/validate`
11. Verify connection status shows connected
12. Verify frontend cannot read raw tokens

**Expected Result:** OAuth flow completes successfully, tokens stored securely, connection validated

**TC20: Invoice Generation Integration**
1. Create test customer_sales records (is_billed = false)
2. Frontend queries unbilled records
3. Frontend calls backend API to create QB invoice
4. Backend generates invoice payload from customer_sales
5. Backend uses config from `organization_quickbooks_config` for tax codes, item IDs
6. Backend calls QuickBooks API to create invoice
7. Backend updates customer_sales: set is_billed = true, quickbooks_invoice_id = result
8. Verify triggers set billed_at and quickbooks_synced_at
9. Frontend queries unbilled records again
10. Verify previously billed records no longer appear

**Expected Result:** Invoice created successfully, customer_sales updated, unbilled query excludes billed records

**TC21: Token Refresh Integration**
1. Create expired token in `quickbooks_tokens` (expires_at = NOW() - 1 hour)
2. Frontend calls any QB API endpoint
3. Backend detects expired token
4. Backend calls `POST /quickbooks/token/refresh`
5. Backend updates `quickbooks_tokens` with new tokens
6. Backend retries original API request
7. Verify original request succeeds
8. Verify updated_at timestamp changed

**Expected Result:** Token refresh happens transparently, user request succeeds without error

---

### 6. Security Tests

**Objective:** Verify no security vulnerabilities introduced

**Test Cases:**

**TC22: Token Encryption at Rest**
- Verify `access_token` and `refresh_token` columns are encrypted in database
- Verify encryption keys are stored securely (not in codebase)

**TC23: HMAC Authentication**
- Verify all backend API requests require valid HMAC signature
- Verify expired signatures (>5 minutes) are rejected
- Verify tampered signatures are rejected

**TC24: Organization Isolation**
- Verify User A (Org 1) cannot access QB tokens for Org 2
- Verify User A (Org 1) cannot access QB config for Org 2
- Verify User A (Org 1) cannot access customer_sales for Org 2

**TC25: SQL Injection Protection**
- Test API endpoints with SQL injection payloads
- Verify all queries use parameterized statements
- Verify no raw SQL concatenation

**TC26: XSS Protection**
- Test QB company name field with XSS payload
- Test QB invoice description field with XSS payload
- Verify output is sanitized before display

---

## Rollback Plan

### Rollback Scenarios

**Scenario 1: Schema deployment fails**
- **Impact:** Cannot proceed with migration
- **Action:** Fix SQL errors, redeploy schema
- **Rollback:** Drop new tables, restore from backup

**Scenario 2: RLS policies block legitimate access**
- **Impact:** Users cannot access QB features
- **Action:** Fix RLS policy logic, redeploy
- **Rollback:** Disable RLS temporarily, fix policies

**Scenario 3: Frontend integration breaks production**
- **Impact:** Invoice generation fails, users blocked
- **Action:** Revert frontend deployment
- **Rollback:** Restore FileMaker script-based flow

**Scenario 4: Data migration corrupts existing records**
- **Impact:** Financial data inconsistent
- **Action:** Restore database from backup
- **Rollback:** Restore to pre-migration backup

---

### Rollback Procedures

#### 1. Emergency Rollback: Revert to FileMaker Flow

**Purpose:** Immediate rollback if new system fails in production

**Steps:**

```javascript
// 1. Redeploy previous version of frontend
git checkout <previous-commit-hash>
npm run build
npm run upload

// 2. Re-enable FileMaker script calls in code
// src/api/fileMaker.js:447-501
export async function initializeQuickBooks(params) {
  // Restore original FileMaker script call
  return new Promise((resolve, reject) => {
    if (!window.FileMaker) {
      reject(new Error('FileMaker not available'));
      return;
    }
    FileMaker.PerformScript("Initialize QB via JS", JSON.stringify(params));
    resolve({ status: "success", message: "QuickBooks initialization requested" });
  });
}

// 3. Disable new backend API calls
// Comment out quickbooksApi.js imports in affected components
```

**Verification:**
- Confirm FileMaker script executes successfully
- Verify invoices are created in QuickBooks
- Check FileMaker `devRecords.f_billed` updates correctly

**Timeline:** 15-30 minutes

---

#### 2. Schema Rollback: Drop New Tables

**Purpose:** Remove new schema if it causes issues

**Steps:**

```sql
-- Drop new tables (cascade will remove dependent objects)
DROP TABLE IF EXISTS organization_quickbooks_config CASCADE;
DROP TABLE IF EXISTS quickbooks_tokens CASCADE;

-- Remove columns from customer_sales
ALTER TABLE customer_sales
  DROP COLUMN IF EXISTS quickbooks_invoice_id,
  DROP COLUMN IF EXISTS quickbooks_synced_at,
  DROP COLUMN IF EXISTS is_billed,
  DROP COLUMN IF EXISTS billed_at;

-- Drop triggers
DROP TRIGGER IF EXISTS customer_sales_set_billed_at ON customer_sales;
DROP TRIGGER IF EXISTS customer_sales_set_qb_synced_at ON customer_sales;

-- Drop trigger functions
DROP FUNCTION IF EXISTS set_billed_at_timestamp();
DROP FUNCTION IF EXISTS set_qb_synced_at_timestamp();
```

**Verification:**
```sql
-- Verify tables removed
SELECT tablename FROM pg_tables WHERE tablename IN ('quickbooks_tokens', 'organization_quickbooks_config');
-- Expected: 0 rows

-- Verify customer_sales columns removed
SELECT column_name FROM information_schema.columns
WHERE table_name = 'customer_sales'
  AND column_name IN ('quickbooks_invoice_id', 'is_billed');
-- Expected: 0 rows
```

**Timeline:** 5-10 minutes

---

#### 3. Data Rollback: Restore from Backup

**Purpose:** Restore database to pre-migration state

**Steps:**

```bash
# 1. Stop application traffic to database
# (Coordinate with DevOps team)

# 2. Restore from backup
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db pg_restore -U postgres -d postgres -c /backups/pre-qb-migration.backup"

# 3. Verify restoration
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT COUNT(*) FROM customer_sales;\""

# 4. Resume application traffic
```

**Verification:**
- Verify row counts match pre-migration state
- Verify sample records contain expected data
- Verify no new schema tables exist

**Timeline:** 30-60 minutes (depends on database size)

---

### Rollback Decision Criteria

**Roll back if:**
- ❌ More than 10% of invoice generation attempts fail
- ❌ Users report data loss or corruption
- ❌ RLS policies prevent legitimate access
- ❌ Performance degrades significantly (>2x slower)
- ❌ Security vulnerability discovered
- ❌ Critical bug blocks core functionality

**Do NOT roll back if:**
- ✅ Minor UI bugs (can be fixed forward)
- ✅ Edge case errors (<5% of operations)
- ✅ Performance slightly slower but acceptable
- ✅ Non-critical features broken

---

## Performance Considerations

### Expected Query Performance

**Unbilled Records Query:**
```sql
-- Used by invoice generation flow
SELECT * FROM customer_sales
WHERE customer_id = '...'
  AND is_billed = false
ORDER BY date_start ASC;
```
- **Expected:** < 100ms for 1000 unbilled records
- **Index:** `idx_customer_sales_unbilled` on `(customer_id, is_billed)`
- **Optimization:** Partial index (WHERE is_billed = false) reduces index size

**QB Connection Status Query:**
```sql
-- Used by frontend to check if QB is connected
SELECT is_active, expires_at, company_name
FROM quickbooks_tokens
WHERE organization_id = '...';
```
- **Expected:** < 50ms
- **Index:** `idx_quickbooks_tokens_org` on `organization_id`

**QB Config Lookup:**
```sql
-- Used by invoice generation to get tax codes, item IDs
SELECT * FROM organization_quickbooks_config
WHERE organization_id = '...';
```
- **Expected:** < 50ms
- **Index:** `idx_org_qb_config_org` on `organization_id`

---

### Scalability Considerations

**Data Volume Estimates:**
- Organizations: ~20-50
- Customers per org: ~100-500
- Customer sales records per org per month: ~500-2000
- Unbilled records per customer: ~10-50

**Storage Estimates:**
- `quickbooks_tokens`: ~5 KB per org × 50 orgs = 250 KB
- `organization_quickbooks_config`: ~2 KB per org × 50 orgs = 100 KB
- `customer_sales` new columns: ~100 bytes per record × 100K records = 10 MB

**Query Load Estimates:**
- Invoice generation: ~5-10 requests per day per org
- Token validation: ~1 request per hour per org
- Config lookup: ~5-10 requests per day per org

**Conclusion:** Performance impact is minimal. Schema changes add negligible storage and query overhead.

---

### Optimization Recommendations

**Database:**
- ✅ Use partial indexes on `is_billed = false` (already implemented)
- ✅ Use BRIN index on `customer_sales.created_at` if time-based queries are frequent
- ✅ Consider materialized view for frequently queried unbilled totals (future optimization)

**Application:**
- ✅ Cache QB config in application memory (TTL: 1 hour)
- ✅ Use connection pooling for database queries
- ✅ Implement retry logic with exponential backoff for QB API calls

**Monitoring:**
- ✅ Track invoice generation latency (target: <5s average)
- ✅ Track QB API error rate (target: <5%)
- ✅ Alert on token expiration within 24 hours
- ✅ Alert on failed token refresh

---

## Frontend Implementation Status

### Current Implementation

**Frontend Code Already Written:**
- ✅ QuickBooks API client: `src/api/quickbooksApi.js` (lines 1-610)
- ✅ Invoice generation service: `src/services/invoiceGenerationService.js` (lines 1-450+)
- ✅ Financial sync service: `src/services/financialSyncService.js` (lines 1-300+)
- ✅ Customer sales service: `src/services/customerSalesService.js`

**Frontend Waiting on Backend Schema:**
- ⏳ Cannot query `quickbooks_tokens` table (does not exist yet)
- ⏳ Cannot query `organization_quickbooks_config` table (does not exist yet)
- ⏳ Cannot update `customer_sales.is_billed` column (does not exist yet)
- ⏳ Cannot track `quickbooks_invoice_id` (column does not exist yet)

**Frontend Migration Plan:**
Once backend schema is deployed, frontend will:
1. Update `useCustomerSales` hook to query `is_billed` instead of FileMaker `f_billed`
2. Update invoice generation flow to use backend API instead of FileMaker script
3. Update UI to display invoice details (number, total, QB invoice ID)
4. Remove FileMaker `initializeQuickBooks` function calls
5. Add QB connection status indicator in UI
6. Add QB configuration panel for admins

**No Frontend Code Changes Until Backend Approval:**
Per Backend Change Protocol (CLAUDE.md:87-136), frontend MUST NOT:
- ❌ Implement code assuming new schema exists
- ❌ Deploy frontend changes dependent on new schema
- ❌ Test against production database

Frontend WILL:
- ✅ Document dependencies on new schema (in code comments)
- ✅ Prepare implementation assuming approved schema
- ✅ Test against dev environment once schema deployed
- ✅ Coordinate cutover with backend team

---

## Related Documentation

### Requirements Documentation

**Primary Documents:**
- `requirements/quickbooks/README.md` - QuickBooks integration overview and migration objectives
- `requirements/quickbooks/data-model-mapping.md` - Complete data model specification (this request is based on this)
- `requirements/quickbooks/authorization.md` - OAuth flow and security requirements
- `.devflow/tasks/quickbooks-migration-requirements/api-contracts.md` - Backend API endpoint specifications
- `.devflow/tasks/quickbooks-migration-requirements/migration-plan.md` - Frontend migration strategy
- `.devflow/tasks/quickbooks-migration-requirements/acceptance-criteria.md` - Test plan and success criteria

**Supporting Documents:**
- `requirements/quickbooks/current-implementation.md` - Analysis of existing FileMaker-based system
- `CLAUDE.md` - Project guidelines and Backend Change Protocol (lines 87-136)

### Frontend Code References

**QuickBooks Integration:**
- `src/api/quickbooksApi.js` (lines 1-610) - Backend API client
- `src/api/fileMaker.js` (lines 447-501) - Legacy FileMaker script calls (to be deprecated)
- `src/services/invoiceGenerationService.js` (lines 1-450+) - Invoice payload generation
- `src/services/financialSyncService.js` (lines 1-300+) - FileMaker ↔ Supabase sync

**Data Services:**
- `src/services/customerSalesService.js` - Customer sales CRUD operations
- `src/hooks/useCustomerSales.js` - React hook for customer sales data

**UI Components:**
- `src/components/financial/CustomerSalesTable.jsx` - Display financial records
- `src/components/financial/InvoiceGenerationPanel.jsx` - Invoice generation UI
- `src/components/financial/QuickBooksStatusIndicator.jsx` - Connection status (to be created)

### Backend API Documentation

**API Specification:**
- OpenAPI Spec: `https://api.claritybusinesssolutions.ca/openapi.json`
- Interactive Docs: `https://api.claritybusinesssolutions.ca/docs`
- Base URL: `https://api.claritybusinesssolutions.ca/quickbooks`

**Authentication:**
- HMAC-SHA256 signature-based auth
- Format: `Authorization: Bearer {signature}.{timestamp}`
- Organization header: `X-Organization-ID: {org-uuid}`
- Reference: `src/services/dataService.js:generateBackendAuthHeader()`

---

## Backend Team Action Items

### Immediate Actions (Pre-Deployment)

1. **Review Schema Changes**
   - [ ] Review all CREATE TABLE statements
   - [ ] Review RLS policies for security
   - [ ] Review trigger logic
   - [ ] Approve or request changes

2. **Plan Deployment**
   - [ ] Schedule deployment window
   - [ ] Coordinate with frontend team
   - [ ] Prepare backup strategy
   - [ ] Plan rollback procedure

3. **Test in Dev Environment**
   - [ ] Deploy schema to dev database
   - [ ] Run all test cases (from Testing Requirements section)
   - [ ] Verify RLS policies work correctly
   - [ ] Verify triggers fire correctly
   - [ ] Performance test queries

### Deployment Actions

4. **Deploy to Production**
   - [ ] Backup production database
   - [ ] Run migration script
   - [ ] Verify schema deployment
   - [ ] Verify RLS policies enabled
   - [ ] Verify indexes created

5. **Data Migration (if needed)**
   - [ ] Migrate FileMaker financial records to customer_sales
   - [ ] Map `f_billed` to `is_billed`
   - [ ] Preserve historical invoice data
   - [ ] Verify data integrity

### Post-Deployment Actions

6. **Verify and Monitor**
   - [ ] Run integration tests
   - [ ] Monitor QB API error rates
   - [ ] Monitor invoice generation latency
   - [ ] Monitor token refresh operations

7. **Notify Frontend Team**
   - [ ] Confirm schema deployment complete
   - [ ] Provide dev environment access
   - [ ] Coordinate frontend cutover
   - [ ] Support frontend integration testing

---

## Approval and Sign-Off

**Backend Team Lead:** _____________________________ Date: _______

**Frontend Team Lead:** _____________________________ Date: _______

**DevOps Team Lead:** _____________________________ Date: _______

**Product Owner:** _____________________________ Date: _______

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-11 | Frontend Team (Claude) | Initial backend change request |

---

**END OF BACKEND CHANGE REQUEST**
