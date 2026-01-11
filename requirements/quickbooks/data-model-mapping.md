# QuickBooks Data Model Mapping

## Document Overview

This document provides a comprehensive mapping of QuickBooks Online (QBO) integration data model requirements, including token storage, organization configuration, entity mappings, and Supabase schema specifications.

**Purpose:** Define the complete data architecture needed to migrate QuickBooks integration from FileMaker-dependent to Supabase-only operation.

**Scope:** Token management, organization configuration, QB entity mappings, financial data structures, and required database schema changes.

---

## Table of Contents

1. [Token Storage Requirements](#token-storage-requirements)
2. [Organization Configuration](#organization-configuration)
3. [QuickBooks Entity Mappings](#quickbooks-entity-mappings)
4. [Supabase Schema Requirements](#supabase-schema-requirements)
5. [Data Transformation Mappings](#data-transformation-mappings)
6. [Backend Change Requirements](#backend-change-requirements)

---

## Token Storage Requirements

### 1. OAuth Token Structure

QuickBooks OAuth 2.0 tokens must be stored securely per organization. Based on backend API schema:

**Token Response Schema** (Reference: `api__quickbooks_api__TokenResponse`)

```typescript
interface QuickBooksTokenResponse {
  access_token: string;      // OAuth 2.0 access token
  refresh_token: string;     // OAuth 2.0 refresh token
  expires_at: string;        // ISO 8601 timestamp
  realm_id?: string | null;  // QuickBooks company ID (optional)
}
```

**Source:** Backend API OpenAPI spec (`/quickbooks/token/refresh` endpoint)

### 2. Required Token Table Schema

**Table Name:** `quickbooks_tokens`

**Purpose:** Store OAuth credentials and connection state per organization

```sql
CREATE TABLE quickbooks_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- OAuth Credentials
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- QuickBooks Company Identification
  realm_id TEXT NOT NULL,
  company_name TEXT,

  -- Connection State
  is_active BOOLEAN DEFAULT true,
  last_validated_at TIMESTAMP WITH TIME ZONE,

  -- OAuth Flow State
  oauth_state TEXT,  -- CSRF validation state during OAuth flow

  -- Audit Fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT quickbooks_tokens_org_unique UNIQUE(organization_id),
  CONSTRAINT quickbooks_tokens_realm_unique UNIQUE(realm_id)
);

-- Indexes
CREATE INDEX idx_quickbooks_tokens_org ON quickbooks_tokens(organization_id);
CREATE INDEX idx_quickbooks_tokens_realm ON quickbooks_tokens(realm_id);
CREATE INDEX idx_quickbooks_tokens_expires ON quickbooks_tokens(expires_at)
  WHERE is_active = true;
```

**RLS Policies Required:**

```sql
-- Read: Users can only read tokens for their organization
CREATE POLICY quickbooks_tokens_select ON quickbooks_tokens
  FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_profile WHERE user_id = auth.uid()
  ));

-- Insert: Service role only (backend handles OAuth)
CREATE POLICY quickbooks_tokens_insert ON quickbooks_tokens
  FOR INSERT
  WITH CHECK (false);  -- Only backend via service role

-- Update: Service role only (backend handles token refresh)
CREATE POLICY quickbooks_tokens_update ON quickbooks_tokens
  FOR UPDATE
  USING (false);  -- Only backend via service role
```

### 3. Token Lifecycle Management

**OAuth Authorization Flow** (Reference: `src/api/quickbooksApi.js:195-211`)

```javascript
// Step 1: Get authorization URL
const { authorization_url, state } = await getQBOAuthorizationUrl();
// Backend endpoint: GET /quickbooks/authorize
// Returns: { authorization_url: string, state: string }

// Step 2: User redirects to QuickBooks, approves connection

// Step 3: Handle OAuth callback
const tokenResponse = await handleQBOOAuthCallback(code, state, realmId);
// Backend endpoint: POST /quickbooks/oauth/callback
// Request: { code: string, state: string, realm_id?: string }
// Response: QuickBooksTokenResponse
```

**Token Refresh Flow** (Reference: `src/api/quickbooksApi.js:218-220`)

```javascript
// Automatic refresh when token expires
const refreshedToken = await refreshQBOToken();
// Backend endpoint: POST /quickbooks/token/refresh
// Response: QuickBooksTokenResponse
```

**Token Validation** (Reference: `src/api/quickbooksApi.js:226-228`)

```javascript
// Validate connection is still active
const validation = await validateQBOCredentials();
// Backend endpoint: POST /quickbooks/validate
// Response: { valid: boolean, company_info?: object }
```

**Backend Responsibility:**
- Backend stores tokens in `quickbooks_tokens` table
- Backend handles token refresh automatically before expiry
- Frontend never sees raw tokens (security best practice)
- Frontend only checks connection status via validation endpoint

---

## Organization Configuration

### 1. Current Organization Schema

**Table:** `organizations` (Reference: SSH query result)

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  secret UUID  -- Used for HMAC authentication
);
```

### 2. Required QuickBooks Configuration Fields

**New Table:** `organization_quickbooks_config`

**Purpose:** Store QuickBooks-specific configuration per organization

```sql
CREATE TABLE organization_quickbooks_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- QuickBooks Company Info
  realm_id TEXT NOT NULL,  -- Links to quickbooks_tokens
  company_name TEXT,

  -- Default Invoice Settings
  default_currency TEXT DEFAULT 'CAD',  -- CAD, USD, EUR
  default_payment_terms TEXT DEFAULT 'Net 30',
  default_email_delivery BOOLEAN DEFAULT true,

  -- Tax Configuration (Canada-specific)
  cad_tax_code INTEGER DEFAULT 4,       -- Tax code for CAD invoices
  non_cad_tax_code INTEGER DEFAULT 3,   -- Tax code for non-CAD invoices

  -- Item/Service IDs by Currency (Reference: invoiceGenerationService.js:219-221)
  cad_item_id TEXT DEFAULT '3',         -- "Development CAD"
  usd_item_id TEXT DEFAULT '7',         -- "Development USD"
  eur_item_id TEXT DEFAULT '8',         -- "Development EUR"

  -- Invoice Numbering
  invoice_number_format TEXT DEFAULT '{qboCustomerId}{YY}{MM}{NNN}',

  -- Sync Settings
  auto_sync_enabled BOOLEAN DEFAULT true,
  sync_frequency_hours INTEGER DEFAULT 24,
  last_sync_at TIMESTAMP WITH TIME ZONE,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT org_qb_config_unique UNIQUE(organization_id)
);

-- Indexes
CREATE INDEX idx_org_qb_config_org ON organization_quickbooks_config(organization_id);
CREATE INDEX idx_org_qb_config_realm ON organization_quickbooks_config(realm_id);
```

**RLS Policies:**

```sql
-- Users can read config for their organization
CREATE POLICY org_qb_config_select ON organization_quickbooks_config
  FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_profile WHERE user_id = auth.uid()
  ));

-- Only admins can modify config
CREATE POLICY org_qb_config_update ON organization_quickbooks_config
  FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM user_profile
    WHERE user_id = auth.uid() AND role = 'admin'
  ));
```

### 3. Configuration Usage in Code

**Current Implementation** (Reference: `src/services/invoiceGenerationService.js:206-225`)

```javascript
// Tax code selection (Line 206-209)
const getTaxCodeForCurrency = (currency) => {
  return currency === 'CAD' ? 4 : 3;
};

// Item selection by currency (Line 216-225)
const getItemRefForCurrency = (currencyCode) => {
  const items = {
    CAD: { name: 'Development CAD', value: '3' },
    USD: { name: 'Development USD', value: '7' },
    EUR: { name: 'Development EUR', value: '8' }
  };
  return items[currencyCode] || items.CAD;
};
```

**Future Implementation (from org config):**

```javascript
// Fetch from organization_quickbooks_config table
const config = await getOrganizationQBConfig(organizationId);

const getTaxCodeForCurrency = (currency) => {
  return currency === 'CAD' ? config.cad_tax_code : config.non_cad_tax_code;
};

const getItemRefForCurrency = (currencyCode) => {
  const itemIds = {
    CAD: config.cad_item_id,
    USD: config.usd_item_id,
    EUR: config.eur_item_id
  };
  return itemIds[currencyCode] || config.cad_item_id;
};
```

---

## QuickBooks Entity Mappings

### 1. Customer Mapping

**QuickBooks Customer → Supabase Customer**

**Source:** Backend API endpoints (Reference: `src/api/quickbooksApi.js:251-283`)

```javascript
// QuickBooks Customer Structure
{
  Id: "123",                          // QuickBooks customer ID
  DisplayName: "ABC Company",         // Display name
  CompanyName: "ABC Company Inc",     // Legal name
  PrimaryEmailAddr: {
    Address: "billing@abc.com"
  },
  PrimaryPhone: {
    FreeFormNumber: "416-555-1234"
  },
  BillAddr: {
    Line1: "123 Main St",
    City: "Toronto",
    CountrySubDivisionCode: "ON",
    PostalCode: "M5V 1A1",
    Country: "Canada"
  },
  CurrencyRef: {
    value: "CAD",                     // Currency code
    name: "Canadian Dollar"
  },
  Balance: 0,                         // Account balance
  SyncToken: "0"                      // For optimistic locking
}
```

**Supabase Customer Mapping:**

```javascript
// customer_sales.customer_id → customers table
{
  id: "uuid",                         // Supabase customer UUID
  business_name: "ABC Company",       // From DisplayName
  email: "billing@abc.com",           // From PrimaryEmailAddr
  phone: "416-555-1234",              // From PrimaryPhone
  qbo_customer_id: "123",             // QuickBooks customer ID
  qbo_sync_token: "0",                // For update operations
  currency: "CAD",                    // From CurrencyRef
  organization_id: "uuid"             // Organization link
}
```

**Required Schema Change for customers table:**

```sql
ALTER TABLE customers ADD COLUMN IF NOT EXISTS qbo_customer_id TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS qbo_sync_token TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'CAD';

CREATE UNIQUE INDEX idx_customers_qbo_id ON customers(qbo_customer_id)
  WHERE qbo_customer_id IS NOT NULL;
```

### 2. Invoice Mapping

**QuickBooks Invoice Structure**

**Source:** Backend API and invoice generation service (Reference: `src/services/invoiceGenerationService.js:55-78`)

```javascript
// Complete QuickBooks Invoice Payload
{
  BillEmail: {
    Address: "billing@abc.com"        // Customer email
  },
  CurrencyRef: {
    value: "CAD",                     // CAD, USD, EUR
    name: "Canadian Dollar"
  },
  CustomerRef: {
    value: "123",                     // QuickBooks customer ID
    name: "ABC Company"
  },
  DocNumber: "1234526001001",         // Format: {qboId}{YY}{MM}{NNN}
  TxnDate: "2026-01-15",              // Invoice date (YYYY-MM-DD)
  DueDate: "2026-02-28",              // Due date (Net 30 EOM)
  Line: [                             // Line items array
    {
      Amount: 1500.00,                // Line total
      Description: "ABC:Website",     // Product/service description
      DetailType: "SalesItemLineDetail",
      LineNum: 1,
      SalesItemLineDetail: {
        ItemRef: {
          name: "Development CAD",
          value: "3"                  // Item ID (3=CAD, 7=USD, 8=EUR)
        },
        Qty: 20.00,                   // Hours worked
        TaxCodeRef: {
          value: 4                    // Tax code (4=CAD, 3=non-CAD)
        },
        UnitPrice: 75.00              // Hourly rate
      }
    }
  ],
  TxnTaxDetail: {
    TxnTaxCodeRef: {
      value: 4                        // Tax code reference
    }
  }
}
```

**Invoice Tracking in Supabase:**

Current approach marks sales records with invoice ID:

```javascript
// customer_sales.inv_id stores QuickBooks invoice ID
{
  id: "uuid",
  customer_id: "uuid",
  organization_id: "uuid",
  product_name: "ABC:Website",
  quantity: 20.00,
  unit_price: 75.00,
  total_price: 1500.00,
  date: "2026-01-15",
  inv_id: "145",                      // QuickBooks invoice ID
  financial_id: "uuid"                // Links to FileMaker (deprecated)
}
```

**Recommended: Add invoice tracking table:**

```sql
CREATE TABLE quickbooks_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- QuickBooks Invoice Data
  qbo_invoice_id TEXT NOT NULL,       -- QuickBooks invoice ID
  qbo_doc_number TEXT NOT NULL,       -- Invoice document number
  qbo_sync_token TEXT,                -- For update operations

  -- Customer Reference
  customer_id UUID REFERENCES customers(id),
  qbo_customer_id TEXT NOT NULL,      -- QuickBooks customer ID

  -- Invoice Details
  currency TEXT DEFAULT 'CAD',
  total_amount DECIMAL NOT NULL,
  tax_amount DECIMAL DEFAULT 0,

  -- Dates
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,

  -- Status
  status TEXT DEFAULT 'draft',        -- draft, sent, paid, void
  balance DECIMAL,                    -- Outstanding balance

  -- Email Delivery
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMP WITH TIME ZONE,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT qb_invoices_org_qbo_unique UNIQUE(organization_id, qbo_invoice_id)
);

-- Indexes
CREATE INDEX idx_qb_invoices_org ON quickbooks_invoices(organization_id);
CREATE INDEX idx_qb_invoices_customer ON quickbooks_invoices(customer_id);
CREATE INDEX idx_qb_invoices_qbo_id ON quickbooks_invoices(qbo_invoice_id);
CREATE INDEX idx_qb_invoices_date ON quickbooks_invoices(invoice_date);
CREATE INDEX idx_qb_invoices_status ON quickbooks_invoices(organization_id, status);
```

**Link customer_sales to invoices:**

```sql
-- Add invoice tracking to customer_sales
ALTER TABLE customer_sales ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES quickbooks_invoices(id);
ALTER TABLE customer_sales ADD COLUMN IF NOT EXISTS billed_status TEXT DEFAULT 'unbilled';

CREATE INDEX idx_customer_sales_invoice ON customer_sales(invoice_id);
CREATE INDEX idx_customer_sales_billed ON customer_sales(organization_id, billed_status);
```

### 3. Item/Service Mapping

**QuickBooks Items** (Reference: `src/services/invoiceGenerationService.js:216-221`)

```javascript
// Item IDs by currency
const QUICKBOOKS_ITEMS = {
  CAD: { name: 'Development CAD', value: '3' },
  USD: { name: 'Development USD', value: '7' },
  EUR: { name: 'Development EUR', value: '8' }
};
```

**Storage:** Should be in `organization_quickbooks_config` table (see Organization Configuration section)

**Backend API Endpoint:** `GET /quickbooks/items` (Reference: `src/api/quickbooksApi.js:425`)

```javascript
export const listQBOItems = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const endpoint = queryString ? `/items?${queryString}` : '/items';
  return await makeRequest(endpoint);
};
```

---

## Supabase Schema Requirements

### 1. Current Schema Analysis

**Table:** `customer_sales` (Reference: SSH query result)

**Current Structure:**

```sql
CREATE TABLE customer_sales (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id),
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  date DATE NOT NULL,
  inv_id TEXT,                        -- QuickBooks invoice ID
  financial_id UUID UNIQUE,           -- FileMaker __ID (deprecated)
  configuration_data JSONB
);
```

**Indexes:**

```sql
-- Current indexes
CREATE INDEX idx_customer_sales_financial_id ON customer_sales(financial_id);
CREATE INDEX idx_customer_sales_workflow_status ON customer_sales(
  (configuration_data->>'workflow_status')
) WHERE configuration_data IS NOT NULL;
```

### 2. Required Schema Enhancements

**Purpose:** Support Supabase-only QuickBooks operations without FileMaker dependency

```sql
-- Add QuickBooks-specific fields
ALTER TABLE customer_sales
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES quickbooks_invoices(id),
  ADD COLUMN IF NOT EXISTS billed_status TEXT DEFAULT 'unbilled',
  ADD COLUMN IF NOT EXISTS qbo_line_num INTEGER,  -- Line number in QB invoice
  ADD COLUMN IF NOT EXISTS billing_description TEXT,  -- Override product_name for invoices
  ADD COLUMN IF NOT EXISTS tax_code INTEGER;  -- QB tax code (3 or 4)

-- Update inv_id to be deprecated (use invoice_id instead)
COMMENT ON COLUMN customer_sales.inv_id IS
  'DEPRECATED: Use invoice_id FK instead. Kept for backward compatibility.';

COMMENT ON COLUMN customer_sales.financial_id IS
  'DEPRECATED: FileMaker __ID field. Will be removed after migration.';

-- Add indexes for QuickBooks operations
CREATE INDEX idx_customer_sales_invoice ON customer_sales(invoice_id);
CREATE INDEX idx_customer_sales_billed ON customer_sales(organization_id, billed_status);
CREATE INDEX idx_customer_sales_org_date ON customer_sales(organization_id, date);
CREATE INDEX idx_customer_sales_customer ON customer_sales(customer_id);
CREATE INDEX idx_customer_sales_unbilled ON customer_sales(organization_id)
  WHERE billed_status = 'unbilled';

-- Update constraints
ALTER TABLE customer_sales
  ALTER COLUMN financial_id DROP NOT NULL,  -- Make optional for new records
  ADD CONSTRAINT check_billed_status
    CHECK (billed_status IN ('unbilled', 'pending', 'billed', 'voided'));
```

### 3. New Tables Required

**Summary of new tables needed:**

1. `quickbooks_tokens` - OAuth token storage (see Token Storage Requirements)
2. `organization_quickbooks_config` - QB configuration per org (see Organization Configuration)
3. `quickbooks_invoices` - Invoice tracking (see QuickBooks Entity Mappings)

**Additional Supporting Table:** `quickbooks_sync_log`

```sql
CREATE TABLE quickbooks_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Sync Operation
  operation TEXT NOT NULL,            -- 'invoice_create', 'customer_sync', etc.
  entity_type TEXT NOT NULL,          -- 'invoice', 'customer', 'item'
  entity_id TEXT,                     -- QuickBooks entity ID

  -- Status
  status TEXT NOT NULL,               -- 'success', 'failed', 'partial'
  error_message TEXT,

  -- Timing
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,

  -- Details
  records_processed INTEGER DEFAULT 0,
  records_successful INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,

  -- Request/Response (for debugging)
  request_payload JSONB,
  response_payload JSONB,

  CONSTRAINT check_sync_status CHECK (status IN ('success', 'failed', 'partial'))
);

-- Indexes
CREATE INDEX idx_qb_sync_org ON quickbooks_sync_log(organization_id);
CREATE INDEX idx_qb_sync_started ON quickbooks_sync_log(started_at DESC);
CREATE INDEX idx_qb_sync_status ON quickbooks_sync_log(organization_id, status);
```

### 4. RLS Policy Requirements

**All new tables must have RLS enabled:**

```sql
-- Enable RLS
ALTER TABLE quickbooks_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_quickbooks_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks_sync_log ENABLE ROW LEVEL SECURITY;

-- Policies for quickbooks_invoices
CREATE POLICY qb_invoices_select ON quickbooks_invoices
  FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_profile WHERE user_id = auth.uid()
  ));

CREATE POLICY qb_invoices_insert ON quickbooks_invoices
  FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM user_profile WHERE user_id = auth.uid()
  ));

CREATE POLICY qb_invoices_update ON quickbooks_invoices
  FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM user_profile WHERE user_id = auth.uid()
  ));

-- Policies for quickbooks_sync_log
CREATE POLICY qb_sync_log_select ON quickbooks_sync_log
  FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_profile WHERE user_id = auth.uid()
  ));

CREATE POLICY qb_sync_log_insert ON quickbooks_sync_log
  FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM user_profile WHERE user_id = auth.uid()
  ));
```

---

## Data Transformation Mappings

### 1. FileMaker → Supabase Migration

**Current Transformation** (Reference: `src/services/financialSyncService.js:461-499`)

```javascript
// FileMaker devRecord → Supabase customer_sales
function mapFileMakerToSupabase(devRecord, organizationId) {
  return {
    financial_id: devRecord.id,                    // FileMaker __ID (UUID)
    customer_id: lookupCustomerId(devRecord),      // Supabase customer UUID
    organization_id: organizationId,               // Organization UUID
    product_name: formatProductName(               // "CAPS:FIRST_WORD"
      devRecord.customerName,
      devRecord.projectName
    ),
    quantity: devRecord.hours,                     // Decimal (billable hours)
    unit_price: devRecord.rate,                    // Decimal (hourly rate)
    total_price: devRecord.amount,                 // Decimal (calculated)
    date: formatDate(devRecord.date),              // YYYY-MM-DD
    inv_id: devRecord.invoiceId || null,           // QB invoice ID if billed
    created_at: 'NOW()',
    updated_at: 'NOW()'
  };
}
```

**Product Name Formatting** (Reference: `src/services/financialSyncService.js:628-640`)

```javascript
function formatProductName(customerName, projectName) {
  // Extract capital letters and numbers from customer name
  const customerCaps = customerName
    .split('')
    .filter(char => /[A-Z0-9]/.test(char))
    .join('');

  // Take first word of project name
  const projectFirst = projectName.split(' ')[0];

  // Format: "{CAPS}:{FIRST_WORD}"
  return `${customerCaps}:${projectFirst}`;
}

// Example: "ABC Company" + "Website Redesign" → "ABC:Website"
```

### 2. Supabase → QuickBooks Invoice

**Line Item Generation** (Reference: `src/services/invoiceGenerationService.js:249-306`)

```javascript
function generateLineItems(salesRecords, itemRef, taxCodeRef) {
  return salesRecords.map((record, index) => ({
    Amount: parseFloat(record.total_price).toFixed(2),
    Description: record.product_name,              // From customer_sales
    DetailType: "SalesItemLineDetail",
    LineNum: index + 1,
    SalesItemLineDetail: {
      ItemRef: {
        name: itemRef.name,                        // "Development CAD/USD/EUR"
        value: itemRef.value                       // "3", "7", or "8"
      },
      Qty: parseFloat(record.quantity).toFixed(2),
      TaxCodeRef: {
        value: taxCodeRef                          // 3 or 4
      },
      UnitPrice: parseFloat(record.unit_price).toFixed(2)
    }
  }));
}
```

**Document Number Generation** (Reference: `src/services/invoiceGenerationService.js:87-110`)

```javascript
async function generateDocumentNumber(qboCustomerId, salesRecords) {
  // Format: {qboCustomerId}{YY}{MM}{NNN}

  // Get invoice date (latest record date)
  const invoiceDate = new Date(Math.max(...salesRecords.map(r => new Date(r.date))));
  const year = invoiceDate.getFullYear().toString().slice(-2);
  const month = String(invoiceDate.getMonth() + 1).padStart(2, '0');

  // Query existing invoices for this customer in this month
  const existingInvoices = await listQBOInvoices({
    customer_id: qboCustomerId,
    max_results: 1000
  });

  const monthPrefix = `${qboCustomerId}${year}${month}`;
  const monthInvoices = existingInvoices.filter(inv =>
    inv.DocNumber && inv.DocNumber.startsWith(monthPrefix)
  );

  // Sequence number starts at 001
  const sequenceNum = String(monthInvoices.length + 1).padStart(3, '0');

  return `${monthPrefix}${sequenceNum}`;
}

// Example: Customer 12345, January 2026, first invoice → "1234526001001"
```

**Due Date Calculation** (Reference: `src/services/invoiceGenerationService.js:169-189`)

```javascript
function calculateDueDate(salesRecords) {
  // Business rule: Net 30 (EOM next month)
  // 30 days from invoice date, then end of that month

  const invoiceDate = new Date(Math.max(...salesRecords.map(r => new Date(r.date))));

  // Add 30 days
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + 30);

  // Move to end of month
  const year = dueDate.getFullYear();
  const month = dueDate.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  dueDate.setDate(lastDay);

  return dueDate.toISOString().split('T')[0];  // YYYY-MM-DD
}

// Example: Invoice Jan 15 → +30 days = Feb 14 → EOM = Feb 28/29
```

### 3. Field-by-Field Mapping

**Complete transformation chain:**

```
FileMaker devRecord
  ├─ __ID → customer_sales.financial_id (UUID) [DEPRECATED]
  ├─ _custID → lookup → customer_sales.customer_id (UUID)
  ├─ Customers::Business Name + Projects::Project → customer_sales.product_name (TEXT)
  ├─ Billable_Time_Rounded → customer_sales.quantity (NUMERIC)
  ├─ Hourly_Rate → customer_sales.unit_price (NUMERIC)
  ├─ (hours * rate) → customer_sales.total_price (NUMERIC)
  ├─ DateStart → customer_sales.date (DATE)
  └─ f_billed → customer_sales.billed_status (TEXT)

customer_sales record
  ├─ product_name → QB Invoice Line.Description
  ├─ quantity → QB Invoice Line.SalesItemLineDetail.Qty
  ├─ unit_price → QB Invoice Line.SalesItemLineDetail.UnitPrice
  ├─ total_price → QB Invoice Line.Amount
  ├─ date → QB Invoice.TxnDate (latest record)
  ├─ customer_id → lookup QB customer → QB Invoice.CustomerRef
  └─ organization config → QB Invoice.Line.SalesItemLineDetail.ItemRef

QB Invoice Response
  ├─ Id → quickbooks_invoices.qbo_invoice_id
  ├─ DocNumber → quickbooks_invoices.qbo_doc_number
  ├─ SyncToken → quickbooks_invoices.qbo_sync_token
  └─ customer_sales records → update invoice_id, billed_status = 'billed'
```

---

## Backend Change Requirements

### Summary of Required Backend Changes

**⚠️ CRITICAL:** All schema changes must follow the Backend Change Protocol defined in CLAUDE.md.

**Required Changes:**

1. **New Tables:**
   - `quickbooks_tokens` - OAuth token storage with encryption
   - `organization_quickbooks_config` - QB configuration per organization
   - `quickbooks_invoices` - Invoice tracking and status
   - `quickbooks_sync_log` - Audit log for sync operations

2. **Schema Modifications:**
   - `customers` table: Add `qbo_customer_id`, `qbo_sync_token`, `currency`
   - `customer_sales` table: Add `invoice_id`, `billed_status`, `qbo_line_num`, `billing_description`, `tax_code`
   - `customer_sales` table: Make `financial_id` nullable for new records

3. **Indexes Required:**
   - See detailed index specifications in each table schema above
   - Focus on organization scoping and unbilled record queries

4. **RLS Policies:**
   - Organization-scoped access for all new tables
   - Service role access for token operations
   - Admin-only access for configuration changes

5. **Backend API Endpoints (existing):**
   - All endpoints documented in `src/api/quickbooksApi.js` already exist
   - Backend handles token storage and refresh automatically
   - Frontend uses HMAC authentication for all requests

### Backend Change Request Document

**Location:** To be created as `BACKEND_CHANGE_REQUEST_003_QUICKBOOKS_SCHEMA.md`

**Contents should include:**
- Complete SQL DDL for all new tables
- ALTER TABLE statements for schema modifications
- Index creation statements
- RLS policy definitions
- Migration script for existing `inv_id` data to new structure
- Rollback plan for each change
- Testing requirements (token encryption, RLS enforcement, sync operations)

### Migration Impact

**Data Migration Required:**

1. **Existing `customer_sales.inv_id` → `quickbooks_invoices`:**
   - Create `quickbooks_invoices` records for all existing invoices
   - Update `customer_sales.invoice_id` to reference new records
   - Keep `inv_id` for backward compatibility during transition

2. **Customer QB IDs:**
   - Query QuickBooks API for all customers
   - Match by business name and email
   - Store QB customer IDs in `customers.qbo_customer_id`

3. **FileMaker Dependency Removal:**
   - Phase out `financial_id` field (make nullable, add deprecation comment)
   - Update sync service to work without FileMaker source
   - Maintain dual-write temporarily for rollback safety

**Code Impact Assessment:**

```javascript
// Files requiring updates (no code changes yet - document only):

// 1. Token management
src/api/quickbooksApi.js:31-60      // Update token handling to use backend storage
src/services/authService.js          // Add QB connection status checks

// 2. Invoice generation
src/services/invoiceGenerationService.js:206-225  // Load from org config table
src/services/financialSyncService.js              // Remove FileMaker dependency

// 3. Customer syncing
src/api/customers.js                 // Add QB customer ID field handling
src/services/customerService.js      // QB customer matching logic

// 4. Billing workflow
src/components/financial/QboTestPanel.jsx  // Update to use new billed_status field
src/api/financialRecords.js:398      // Replace FileMaker billed status update
```

---

## Implementation Checklist

**Backend Team (Required First):**
- [ ] Create `quickbooks_tokens` table with encryption
- [ ] Create `organization_quickbooks_config` table
- [ ] Create `quickbooks_invoices` table
- [ ] Create `quickbooks_sync_log` table
- [ ] Modify `customers` table (add QB fields)
- [ ] Modify `customer_sales` table (add invoice tracking)
- [ ] Implement all RLS policies
- [ ] Create migration script for existing data
- [ ] Deploy to dev environment for testing

**Frontend Team (After Backend Deployment):**
- [ ] Update QB API client for new token flow
- [ ] Migrate invoice generation to use org config
- [ ] Update billing workflow for new status field
- [ ] Remove FileMaker dependencies from sync service
- [ ] Add QB connection status UI components
- [ ] Update customer sync to store QB IDs
- [ ] Add invoice tracking UI
- [ ] Comprehensive testing against dev environment

---

## Code References

All references verified against actual codebase:

**Authentication & API:**
- `src/api/quickbooksApi.js:31-60` - HMAC authentication
- `src/api/quickbooksApi.js:195-228` - OAuth flow endpoints
- `src/api/quickbooksApi.js:251-425` - Customer & invoice operations

**Invoice Generation:**
- `src/services/invoiceGenerationService.js:25-78` - Main payload generation
- `src/services/invoiceGenerationService.js:87-110` - Document number format
- `src/services/invoiceGenerationService.js:169-189` - Due date calculation
- `src/services/invoiceGenerationService.js:206-225` - Tax codes & item IDs
- `src/services/invoiceGenerationService.js:249-306` - Line item generation

**Financial Sync:**
- `src/services/financialSyncService.js:24-99` - Sync orchestration
- `src/services/financialSyncService.js:409-453` - Change detection
- `src/services/financialSyncService.js:461-499` - Record creation
- `src/services/financialSyncService.js:628-640` - Product name formatting

**Backend API Specification:**
- OpenAPI: `https://api.claritybusinesssolutions.ca/openapi.json`
- Token response schema: `api__quickbooks_api__TokenResponse`
- OAuth callback schema: `OAuthCallbackRequest`

**Database Verification:**
- `organizations` table structure: SSH query `\d+ organizations`
- `customer_sales` table structure: SSH query `\d+ customer_sales`

---

## Document Version

**Version:** 1.0.0
**Created:** 2026-01-10
**Author:** Claude Code
**Status:** Draft - Awaiting Backend Team Review

**Next Steps:**
1. Review this document with backend team
2. Create `BACKEND_CHANGE_REQUEST_003_QUICKBOOKS_SCHEMA.md` with full DDL
3. Backend team implements and deploys schema changes
4. Frontend team updates code to use new schema
5. Comprehensive testing before production deployment
