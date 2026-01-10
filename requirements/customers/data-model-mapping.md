# Data Model Mapping

This document provides a comprehensive field-by-field mapping between FileMaker's `devCustomers` layout and Supabase's customers and related tables.

## Overview

**Source**: FileMaker Database `clarityCRM`, Layout `devCustomers`
**Target**: Supabase database, tables: `customers`, `customer_email`, `customer_phone`, `customer_address`, `customer_organization`

**Key Challenges**:
1. FileMaker uses flat table structure (all fields in one layout)
2. Supabase uses normalized structure (separate tables for email, phone, address)
3. FileMaker uses string-based booleans ("1"/"0"), Supabase uses proper booleans
4. FileMaker `recordId` (internal ID) has no Supabase equivalent
5. Active/status tracking differs between systems

## FileMaker devCustomers Layout Fields

### Primary Identifiers

| FileMaker Field | Type | Description | Sample Value |
|----------------|------|-------------|--------------|
| `__ID` | Text (UUID) | Globally unique identifier | `"a1b2c3d4-e5f6-7890-abcd-1234567890ab"` |
| `recordId` | Number (Internal) | FileMaker internal record ID | `"42"` (string in API responses) |

### Core Customer Fields

| FileMaker Field | Type | Required | Description | Sample Value |
|----------------|------|----------|-------------|--------------|
| `Name` | Text | ✅ Yes | Customer/Business name | `"Acme Corporation"` |
| `Email` | Text | No | Primary email address | `"contact@acme.com"` |
| `Phone` | Text | No | Primary phone number | `"+1 (555) 123-4567"` |
| `ContactPerson` | Text | No | Primary contact person name | `"John Doe"` |
| `f_active` | Text | No | Active status ("1" = active, "0" = inactive) | `"1"` |

### Address Fields

| FileMaker Field | Type | Required | Description | Sample Value |
|----------------|------|----------|-------------|--------------|
| `Address` | Text | No | Street address | `"123 Main St, Suite 100"` |
| `City` | Text | No | City | `"San Francisco"` |
| `State` | Text | No | State/Province | `"CA"` |
| `PostalCode` | Text | No | Postal/Zip code | `"94105"` |
| `Country` | Text | No | Country | `"USA"` |

### System Fields

| FileMaker Field | Type | Auto-Managed | Description | Sample Value |
|----------------|------|--------------|-------------|--------------|
| `~creationTimestamp` | Timestamp | ✅ Yes | Record creation timestamp | `"2023-01-15T10:30:00"` |
| `~modificationTimestamp` | Timestamp | ✅ Yes | Last modification timestamp | `"2023-12-01T14:45:00"` |

### Potential Additional Fields (Unverified)

These fields may exist but are not currently used in the frontend code:

| Potential Field | Expected Type | Purpose |
|----------------|---------------|---------|
| `Industry` | Text | Customer industry/vertical |
| `CustomerType` | Text | Type classification (residential, commercial, etc.) |
| `AccountOwner` | Text | Assigned account manager |
| `Notes` | Text (Long) | Internal notes about customer |
| `Website` | Text (URL) | Customer website |
| `TaxID` | Text | Tax identification number |
| `PaymentTerms` | Text/Number | Default payment terms (NET 30, etc.) |

**Action Required**: Complete field audit from FileMaker layout definition.

## Supabase Database Schema

### customers Table

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY,                       -- PK
  name TEXT,                                 -- Legacy field (not used)
  business_name TEXT,                        -- Active field
  first_name TEXT,                           -- Not used in FM integration
  last_name TEXT,                            -- Not used in FM integration
  type customertype NOT NULL,                -- Enum: 'CUSTOMER', 'PROSPECT', etc.
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_customers_org ON customers(organization_id);
CREATE INDEX idx_customers_business_name ON customers(business_name);
```

### customer_email Table

```sql
CREATE TABLE customer_email (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE ON UPDATE CASCADE,
  email TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  email_type TEXT,                          -- 'work', 'personal', etc. (optional)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_customer_email_customer ON customer_email(customer_id);
CREATE INDEX idx_customer_email_primary ON customer_email(customer_id, is_primary);
```

### customer_phone Table

```sql
CREATE TABLE customer_phone (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id),
  phone TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  phone_type TEXT,                          -- 'mobile', 'office', 'fax', etc. (optional)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_customer_phone_customer ON customer_phone(customer_id);
CREATE INDEX idx_customer_phone_primary ON customer_phone(customer_id, is_primary);
```

### customer_address Table

```sql
CREATE TABLE customer_address (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id),
  address_line1 TEXT,
  address_line2 TEXT,                       -- Not currently used
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  is_primary BOOLEAN DEFAULT false,         -- Not currently used
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_customer_address_customer ON customer_address(customer_id);
```

### customer_organization Table (Many-to-Many)

```sql
CREATE TABLE customer_organization (
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE ON UPDATE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (customer_id, organization_id)
);

CREATE INDEX idx_customer_org_customer ON customer_organization(customer_id);
CREATE INDEX idx_customer_org_org ON customer_organization(organization_id);
```

### customer_contacts Table (Not Currently Used)

```sql
CREATE TABLE customer_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  title TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Note**: This table exists but is not populated by current dual-write code. FileMaker `ContactPerson` field is not mapped to this table.

## Field Mapping: FileMaker → Supabase

### customers Table Mapping

| FM Field | Supabase Field | Data Type Transform | Notes |
|----------|----------------|---------------------|-------|
| `__ID` | `id` | UUID → UUID | Direct mapping, primary key |
| `Name` | `business_name` | Text → Text | ⚠️ `name` field exists but not used |
| `~creationTimestamp` | `created_at` | FM Timestamp → TIMESTAMPTZ | May need timezone conversion |
| `~modificationTimestamp` | `updated_at` | FM Timestamp → TIMESTAMPTZ | May need timezone conversion |
| N/A (hardcoded) | `type` | N/A → 'CUSTOMER' | Always set to 'CUSTOMER' enum value |
| N/A (from user context) | `organization_id` | N/A → UUID | Set from `user.supabaseOrgID` |
| N/A | `first_name` | N/A | Not used in FileMaker integration |
| N/A | `last_name` | N/A | Not used in FileMaker integration |

**Data Transformations**:
```javascript
// Current mapping (src/hooks/useSupabaseCustomer.js:49-53)
{
  id: customer.fileMakerUUID || uuidv4(),    // Use FM __ID if provided
  business_name: customer.Name,               // Map Name to business_name
  type: 'CUSTOMER'                            // Hardcoded enum value
  // organization_id set separately via linkCustomerToOrganization()
}
```

### customer_email Table Mapping

| FM Field | Supabase Field | Data Type Transform | Notes |
|----------|----------------|---------------------|-------|
| `__ID` | `customer_id` | UUID → UUID (FK) | Links to customers.id |
| `Email` | `email` | Text → Text | Direct mapping |
| N/A (hardcoded) | `is_primary` | N/A → true | Always true (single email assumption) |
| N/A | `id` | N/A → UUID | Auto-generated primary key |
| N/A | `email_type` | N/A | Not used (optional field) |

**Data Transformations**:
```javascript
// Current mapping (src/hooks/useSupabaseCustomer.js:100-109)
{
  customer_id: supabaseCustomerId,   // FK to customers.id
  email: customer.Email,              // Direct mapping
  is_primary: true                    // Always true (single email)
}
```

**Current Limitation**: FileMaker appears to support only one email per customer. If multiple emails exist, only the last one is synced.

### customer_phone Table Mapping

| FM Field | Supabase Field | Data Type Transform | Notes |
|----------|----------------|---------------------|-------|
| `__ID` | `customer_id` | UUID → UUID (FK) | Links to customers.id |
| `Phone` | `phone` | Text → Text | Direct mapping (no formatting) |
| N/A (hardcoded) | `is_primary` | N/A → true | Always true (single phone assumption) |
| N/A | `id` | N/A → UUID | Auto-generated primary key |
| N/A | `phone_type` | N/A | Not used (optional field) |

**Data Transformations**:
```javascript
// Current mapping (src/hooks/useSupabaseCustomer.js:112-122)
{
  customer_id: supabaseCustomerId,   // FK to customers.id
  phone: customer.Phone,              // Direct mapping (no formatting)
  is_primary: true                    // Always true (single phone)
}
```

**Current Limitation**: FileMaker appears to support only one phone per customer. No phone number formatting/normalization is applied.

### customer_address Table Mapping

| FM Field | Supabase Field | Data Type Transform | Notes |
|----------|----------------|---------------------|-------|
| `__ID` | `customer_id` | UUID → UUID (FK) | Links to customers.id |
| `Address` | `address_line1` | Text → Text | Direct mapping |
| `City` | `city` | Text → Text | Direct mapping |
| `State` | `state` | Text → Text | Direct mapping |
| `PostalCode` | `postal_code` | Text → Text | Direct mapping |
| `Country` | `country` | Text → Text | Direct mapping |
| N/A | `address_line2` | N/A | Not used (no FM field) |
| N/A | `is_primary` | N/A | Not set (optional field) |
| N/A | `id` | N/A → UUID | Auto-generated primary key |

**Data Transformations**:
```javascript
// Current mapping (src/hooks/useSupabaseCustomer.js:126-138)
{
  customer_id: supabaseCustomerId,      // FK to customers.id
  address_line1: customer.Address || '', // Direct mapping, default to empty
  city: customer.City || '',             // Direct mapping, default to empty
  state: customer.State || '',           // Direct mapping, default to empty
  postal_code: customer.PostalCode || '', // Direct mapping, default to empty
  country: customer.Country || ''         // Direct mapping, default to empty
}
```

**Conditional Logic**: Address is only created if `City` AND `State` are both present (src/hooks/useSupabaseCustomer.js:126).

### customer_contacts Table Mapping (Not Implemented)

| FM Field | Supabase Field | Data Type Transform | Notes |
|----------|----------------|---------------------|-------|
| `__ID` | `customer_id` | UUID → UUID (FK) | Links to customers.id |
| `ContactPerson` | `first_name` + `last_name` | Text → Split? | **Not currently mapped** |
| N/A | `email` | N/A | Could use same as customer_email |
| N/A | `phone` | N/A | Could use same as customer_phone |
| N/A | `title` | N/A | Not available in FileMaker |
| N/A (hardcoded) | `is_primary` | N/A → true | If implemented |

**Gap**: FileMaker `ContactPerson` field is not currently synced to Supabase. This table exists but is not used.

### customer_organization Table Mapping

| FM Field | Supabase Field | Data Type Transform | Notes |
|----------|----------------|---------------------|-------|
| `__ID` | `customer_id` | UUID → UUID (FK) | Links to customers.id |
| N/A (from user context) | `organization_id` | N/A → UUID | From `user.supabaseOrgID` |

**Data Transformations**:
```javascript
// Current mapping (src/hooks/useSupabaseCustomer.js:162-165)
{
  customer_id: customerId,             // FK to customers.id (FM __ID)
  organization_id: organizationId      // From user.supabaseOrgID
}
```

**Purpose**: Links customer to organization for multi-tenancy and data scoping.

## Active Status Mapping (Missing in Supabase)

| FM Field | Supabase Field | Status |
|----------|----------------|--------|
| `f_active` ("1"/"0") | **❌ NO EQUIVALENT** | Gap in Supabase schema |

**Problem**: FileMaker tracks active/inactive customers via `f_active` field. Supabase `customers` table has no corresponding field.

**Options**:
1. **Add `is_active` boolean to customers table** (Recommended)
   ```sql
   ALTER TABLE customers ADD COLUMN is_active BOOLEAN DEFAULT true;
   CREATE INDEX idx_customers_active ON customers(is_active);
   ```

2. **Use soft delete pattern** (Alternative)
   ```sql
   ALTER TABLE customers ADD COLUMN deleted_at TIMESTAMPTZ;
   CREATE INDEX idx_customers_deleted ON customers(deleted_at);
   ```

3. **Use status enum** (Most flexible)
   ```sql
   CREATE TYPE customer_status AS ENUM ('active', 'inactive', 'archived', 'suspended');
   ALTER TABLE customers ADD COLUMN status customer_status DEFAULT 'active';
   CREATE INDEX idx_customers_status ON customers(status);
   ```

**Current Workaround**: Active status toggle only updates FileMaker, not Supabase.

## Data Type Conversions

### String Boolean → Boolean

**FileMaker**: `"1"` (active), `"0"` (inactive)
**Supabase**: `true`, `false`

```javascript
// Current conversion (src/services/customerService.js:19)
isActive: customer.fieldData.f_active === "1" || customer.fieldData.f_active === 1

// Reverse conversion (src/services/customerService.js:106)
f_active: data.isActive ? "1" : "0"
```

### FileMaker Timestamp → PostgreSQL TIMESTAMPTZ

**FileMaker Format**: `"2023-01-15T10:30:00"` (ISO 8601, but timezone may be implicit)
**Supabase Format**: TIMESTAMPTZ (timestamp with timezone)

```javascript
// Current handling (src/services/customerService.js:20-21)
createdAt: customer.fieldData['~creationTimestamp'],
modifiedAt: customer.fieldData['~modificationTimestamp']

// May need explicit timezone conversion:
new Date(customer.fieldData['~creationTimestamp']).toISOString()
```

**Potential Issue**: If FileMaker timestamps don't include timezone info, conversions may be incorrect for users in different timezones.

### UUID → UUID

**FileMaker**: Text field containing UUID string
**Supabase**: Native UUID type

```javascript
// Direct mapping (no conversion needed)
id: customer.fieldData.__ID
```

**Important**: UUIDs must be lowercase in Supabase queries.

## ID Reconciliation Strategy

### Problem Statement

FileMaker has two identifiers:
1. `__ID` (UUID, globally unique, used for queries)
2. `recordId` (Internal FileMaker record ID, used for updates/deletes)

Supabase has:
1. `id` (UUID, primary key)
2. No equivalent to FileMaker `recordId`

### Current Mapping

| FileMaker ID | Supabase ID | Use Case |
|-------------|-------------|----------|
| `__ID` (UUID) | `customers.id` (UUID) | ✅ Direct 1:1 mapping |
| `recordId` (internal) | **❌ NO MAPPING** | FM-specific, not portable |

### Recommended Strategy

**Option 1: Ignore `recordId`** (Recommended)
- Use `__ID` for all operations
- Update frontend to consistently use `__ID` instead of `recordId`
- Supabase never needs to know about FileMaker `recordId`

```javascript
// Frontend refactor needed
// OLD (inconsistent):
updateCustomer(recordId, data)        // Uses recordId
toggleCustomerStatus(recordId, active) // Uses recordId
deleteCustomer(recordId)               // Uses recordId

// NEW (consistent):
updateCustomer(__ID, data)             // Uses __ID
toggleCustomerStatus(__ID, active)     // Uses __ID
deleteCustomer(__ID)                   // Uses __ID
```

**Option 2: Store `recordId` in Supabase** (Not recommended)
- Add `filemaker_record_id` text field to `customers` table
- Maintain mapping for backward compatibility
- Creates unnecessary coupling to FileMaker

### Migration Impact

During migration, when customers exist in both systems:
- **FileMaker __ID** = **Supabase customers.id** (must match exactly)
- No additional mapping table needed
- Query customers by `id` in both systems using same UUID value

## Schema Gaps & Required Changes

### 1. Active Status Field (High Priority)

**Gap**: No `is_active` or `status` field in `customers` table.

**Backend Change Request**:
```sql
ALTER TABLE customers ADD COLUMN is_active BOOLEAN DEFAULT true;
CREATE INDEX idx_customers_active ON customers(is_active);
```

**Justification**: Current frontend code toggles active status in FileMaker. Supabase must support this workflow.

### 2. Multiple Emails/Phones Support (Medium Priority)

**Gap**: Current dual-write assumes 1:1 relationship (customer → email/phone).

**Question**: Does FileMaker support multiple emails/phones per customer?

**If YES**: Update dual-write logic to handle multiple records
**If NO**: Current implementation is correct

**Backend Change Request**:
- Add unique constraint to prevent duplicate emails for same customer
```sql
ALTER TABLE customer_email ADD CONSTRAINT unique_customer_email UNIQUE (customer_id, email);
ALTER TABLE customer_phone ADD CONSTRAINT unique_customer_phone UNIQUE (customer_id, phone);
```

### 3. Contact Person Normalization (Low Priority)

**Gap**: FileMaker `ContactPerson` field not mapped to `customer_contacts` table.

**Options**:
1. Map `ContactPerson` to single record in `customer_contacts` with `is_primary=true`
2. Parse `ContactPerson` into `first_name`/`last_name` (if formatted)
3. Store as simple text field on `customers` table (if no rich contact management needed)

**Recommended**: Add `primary_contact_name` text field to `customers` table for simplicity.

```sql
ALTER TABLE customers ADD COLUMN primary_contact_name TEXT;
```

### 4. Name Field Clarity (Low Priority)

**Gap**: `customers` table has both `name` and `business_name` fields.

**Current State**:
- `name` - not used
- `business_name` - actively used

**Backend Change Request**:
- Remove deprecated `name` field OR
- Enforce usage of `business_name` with CHECK constraint

```sql
-- Option 1: Remove deprecated field
ALTER TABLE customers DROP COLUMN name;

-- Option 2: Add CHECK constraint
ALTER TABLE customers ADD CONSTRAINT name_is_null CHECK (name IS NULL);
```

### 5. Address Line 2 (Low Priority)

**Gap**: FileMaker has no equivalent for `address_line2`.

**Current State**: `address_line2` field exists in Supabase but is never populated.

**Recommendation**: Keep field for future use (no change needed).

## Reverse Mapping: Supabase → FileMaker

For read operations after migration (Supabase-first):

| Supabase Field | FM Field | Transform | Notes |
|---------------|----------|-----------|-------|
| `customers.id` | `__ID` | UUID → UUID | Direct mapping |
| `customers.business_name` | `Name` | Text → Text | Direct mapping |
| `customers.created_at` | `~creationTimestamp` | TIMESTAMPTZ → ISO 8601 | Timezone conversion may be needed |
| `customers.updated_at` | `~modificationTimestamp` | TIMESTAMPTZ → ISO 8601 | Timezone conversion may be needed |
| `customers.is_active` | `f_active` | Boolean → "1"/"0" | Proposed field |
| `customer_email.email` (is_primary) | `Email` | Text → Text | Use primary email only |
| `customer_phone.phone` (is_primary) | `Phone` | Text → Text | Use primary phone only |
| `customer_address.address_line1` | `Address` | Text → Text | Direct mapping |
| `customer_address.city` | `City` | Text → Text | Direct mapping |
| `customer_address.state` | `State` | Text → Text | Direct mapping |
| `customer_address.postal_code` | `PostalCode` | Text → Text | Direct mapping |
| `customer_address.country` | `Country` | Text → Text | Direct mapping |

**Note**: Reverse mapping will not be needed after full migration (FileMaker removal).

## Data Validation Rules

### FileMaker Validation (Current)

Implemented in `src/services/customerService.js:55-74`:

1. **Name**: Required, cannot be empty or whitespace
   ```javascript
   if (!data.Name?.trim()) errors.push('Customer name is required')
   ```

2. **Email**: Optional, but if provided must match format
   ```javascript
   /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
   ```

3. **Phone**: Optional, but if provided must match format
   ```javascript
   /^\+?[\d\s-()]+$/.test(phone)
   ```

### Recommended Supabase Validation

Backend should enforce:

1. **business_name**: NOT NULL, minimum length 1
   ```sql
   ALTER TABLE customers ALTER COLUMN business_name SET NOT NULL;
   ALTER TABLE customers ADD CONSTRAINT business_name_not_empty CHECK (length(trim(business_name)) > 0);
   ```

2. **email**: Valid format, no duplicates per customer
   ```sql
   ALTER TABLE customer_email ADD CONSTRAINT email_format CHECK (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$');
   ALTER TABLE customer_email ADD CONSTRAINT unique_customer_email UNIQUE (customer_id, email);
   ```

3. **phone**: Valid format
   ```sql
   ALTER TABLE customer_phone ADD CONSTRAINT phone_format CHECK (phone ~* '^\+?[\d\s\-\(\)]+$');
   ```

4. **organization_id**: Required for multi-tenancy
   ```sql
   ALTER TABLE customers ALTER COLUMN organization_id SET NOT NULL;
   ```

## Referential Integrity

### Current State (Supabase)

- ✅ `customer_email.customer_id` → `customers.id` (ON DELETE CASCADE)
- ✅ `customer_phone.customer_id` → `customers.id` (No CASCADE specified, default RESTRICT)
- ✅ `customer_address.customer_id` → `customers.id` (No CASCADE specified, default RESTRICT)
- ✅ `customer_organization.customer_id` → `customers.id` (ON DELETE CASCADE)
- ✅ `customers.organization_id` → `organizations.id` (No CASCADE specified, default RESTRICT)

### Recommended Changes

Add consistent CASCADE behavior:

```sql
-- Ensure all customer-related tables cascade delete
ALTER TABLE customer_phone DROP CONSTRAINT customer_phone_customer_id_fkey;
ALTER TABLE customer_phone ADD CONSTRAINT customer_phone_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE customer_address DROP CONSTRAINT customer_address_customer_id_fkey;
ALTER TABLE customer_address ADD CONSTRAINT customer_address_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
```

**Justification**: When customer is deleted, related records (email, phone, address) should be automatically removed.

## Summary of Required Backend Changes

1. **Add `is_active` boolean to customers table** (High Priority)
2. **Add unique constraints to customer_email and customer_phone** (Medium Priority)
3. **Add `primary_contact_name` text field to customers table** (Medium Priority)
4. **Make `organization_id` NOT NULL on customers** (High Priority)
5. **Add CHECK constraints for data validation** (Medium Priority)
6. **Update foreign key CASCADE behavior** (Low Priority)
7. **Remove or constrain deprecated `name` field** (Low Priority)

See [API Contracts](./api-contracts.md) for backend endpoint specifications that will implement these mappings.
