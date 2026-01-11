# Data Model Mapping - FileMaker to Supabase

## Overview

This document provides a comprehensive field-by-field mapping from the FileMaker `devCustomers` layout to Supabase database tables. This mapping serves as the specification for migrating customer data from FileMaker-primary architecture to Supabase-only architecture.

**Source System**: FileMaker Server (Layout: `devCustomers`)
**Target System**: Supabase PostgreSQL (Schema: `public`)
**Migration Type**: Field-level mapping with data type transformations
**Document Version**: 1.0
**Last Updated**: 2026-01-10

---

## Table of Contents

1. [FileMaker Schema](#filemaker-schema)
2. [Mapping Tables](#mapping-tables)
3. [Data Transformations](#data-transformations)
4. [Complex Mappings](#complex-mappings)
5. [Unmapped Fields](#unmapped-fields)
6. [Migration Considerations](#migration-considerations)
7. [Code References](#code-references)

---

## FileMaker Schema

### devCustomers Layout

The `devCustomers` layout is the primary FileMaker table for customer records. Field names are discovered from code inspection across the frontend application.

#### Complete Field List

| FileMaker Field | Data Type | Nullable | Default | Description | Code Reference |
|----------------|-----------|----------|---------|-------------|----------------|
| `__ID` | Text (UUID) | NO | auto | Primary identifier, globally unique | src/api/customers.js:12 |
| `Name` | Text | NO | - | Customer/business name | src/components/customers/CustomerForm.jsx:27 |
| `OBSI_ClientNo` | Text | YES | - | Client number (possibly OBSI reference) | src/components/customers/CustomerForm.jsx:28 |
| `Email` | Text | YES | - | Primary email address | src/components/customers/CustomerForm.jsx:31 |
| `phone` | Text | YES | - | Primary phone number | src/components/customers/CustomerForm.jsx:32 |
| `chargeRate` | Number | YES | - | Hourly charge rate | src/components/customers/CustomerForm.jsx:35 |
| `f_USD` | Boolean ("1"/"0") | YES | "0" | USD currency flag | src/components/customers/CustomerForm.jsx:36 |
| `f_EUR` | Boolean ("1"/"0") | YES | "0" | EUR currency flag | src/components/customers/CustomerForm.jsx:37 |
| `f_prePay` | Number | YES | 0 | Prepayment amount | src/components/customers/CustomerForm.jsx:38 |
| `fundsAvailable` | Number | YES | 0 | Available prepaid funds | src/components/customers/CustomerForm.jsx:39 |
| `dbPath` | Text | YES | - | Database path (for hosted clients) | src/components/customers/CustomerForm.jsx:42 |
| `dbUserName` | Text | YES | - | Database username | src/components/customers/CustomerForm.jsx:43 |
| `dbPasword` | Text | YES | - | Database password (typo in original) | src/components/customers/CustomerForm.jsx:44 |
| `f_active` | Text ("1"/"0") | NO | "1" | Active status flag | src/components/customers/CustomerForm.jsx:47 |
| `ContactPerson` | Text | YES | - | Contact person name | src/services/customerService.js:107 |
| `Address` | Text | YES | - | Street address | src/services/customerService.js:126 |
| `City` | Text | YES | - | City name | src/services/customerService.js:127 |
| `State` | Text | YES | - | State/province code | src/services/customerService.js:128 |
| `PostalCode` | Text | YES | - | ZIP/postal code | src/services/customerService.js:129 |
| `Country` | Text | YES | - | Country name or code | src/services/customerService.js:130 |
| `~creationTimestamp` | Timestamp | AUTO | now() | FileMaker creation timestamp | src/services/customerService.js:20 |
| `~modificationTimestamp` | Timestamp | AUTO | now() | FileMaker modification timestamp | src/services/customerService.js:21 |

#### FileMaker Data Type Conventions

- **Text**: FileMaker text fields, typically unbounded
- **Number**: Numeric fields (can be integer or decimal)
- **Boolean as Text**: "1" for true, "0" for false
- **Timestamp**: FileMaker timestamp format (ISO 8601)
- **UUID**: Text field containing UUID v4 string

---

## Mapping Tables

### Core Customer Mapping

Maps `devCustomers` → `customers` table

| FileMaker Field | Supabase Table | Supabase Column | Data Type | Transformation | Notes |
|----------------|----------------|-----------------|-----------|----------------|-------|
| `__ID` | `customers` | `id` | `uuid` | Direct copy | Primary key, must be preserved |
| `Name` | `customers` | `business_name` | `text` | Direct copy | Business/customer name |
| `Name` | `customers` | `name` | `text` | **DEPRECATED** | Legacy field, set to NULL |
| - | `customers` | `first_name` | `text` | NULL | Not used in FileMaker integration |
| - | `customers` | `last_name` | `text` | NULL | Not used in FileMaker integration |
| `f_active` | `customers` | **MISSING** | - | - | **SCHEMA GAP**: No active/status field in Supabase |
| - | `customers` | `type` | `customertype` | Hardcode: `'CUSTOMER'` | Enum value, all FM customers are 'CUSTOMER' |
| - | `customers` | `organization_id` | `uuid` | Lookup from user context | Multi-tenancy requirement |
| `~creationTimestamp` | `customers` | `created_at` | `timestamptz` | Parse timestamp | Auto-managed in Supabase |
| `~modificationTimestamp` | `customers` | `updated_at` | `timestamptz` | Parse timestamp | Auto-managed in Supabase |

**Transformation Notes:**
- `f_active` has no Supabase equivalent - requires schema change or use of soft-delete pattern
- `organization_id` must be determined from user context during migration
- FileMaker customers without organization mapping should be assigned to default org

---

### Email Mapping

Maps `devCustomers.Email` → `customer_email` table

| FileMaker Field | Supabase Table | Supabase Column | Data Type | Transformation | Notes |
|----------------|----------------|-----------------|-----------|----------------|-------|
| `Email` | `customer_email` | `email` | `text` | Direct copy | Primary email address |
| `__ID` | `customer_email` | `customer_id` | `uuid` | Foreign key from `customers.id` | Links to parent customer |
| - | `customer_email` | `id` | `uuid` | Generate UUID | Auto-generated primary key |
| - | `customer_email` | `is_primary` | `boolean` | Hardcode: `true` | FileMaker has single email |
| `~creationTimestamp` | `customer_email` | `created_at` | `timestamptz` | Parse timestamp | Inherit from customer |
| `~modificationTimestamp` | `customer_email` | `updated_at` | `timestamptz` | Parse timestamp | Inherit from customer |

**Transformation Rules:**
1. Only create `customer_email` record if `Email` is non-empty
2. `is_primary` always set to `true` (FileMaker supports single email)
3. Email must be unique across all customers (enforced by `uq_customer_email_email`)

**Edge Cases:**
- **Empty Email**: Skip creation, customer has no email records
- **Duplicate Email**: Migration will fail due to unique constraint - requires deduplication strategy
- **Invalid Email Format**: Should validate before migration

---

### Phone Mapping

Maps `devCustomers.phone` → `customer_phone` table

| FileMaker Field | Supabase Table | Supabase Column | Data Type | Transformation | Notes |
|----------------|----------------|-----------------|-----------|----------------|-------|
| `phone` | `customer_phone` | `phone` | `text` | Direct copy | Primary phone number |
| `__ID` | `customer_phone` | `customer_id` | `uuid` | Foreign key from `customers.id` | Links to parent customer |
| - | `customer_phone` | `id` | `uuid` | Generate UUID | Auto-generated primary key |
| - | `customer_phone` | `type` | `text` | NULL or 'mobile' | FileMaker doesn't specify type |
| - | `customer_phone` | `is_primary` | `boolean` | Hardcode: `true` | FileMaker has single phone |
| `~creationTimestamp` | `customer_phone` | `created_at` | `timestamptz` | Parse timestamp | Inherit from customer |
| `~modificationTimestamp` | `customer_phone` | `updated_at` | `timestamptz` | Parse timestamp | Inherit from customer |

**Transformation Rules:**
1. Only create `customer_phone` record if `phone` is non-empty
2. `is_primary` always set to `true` (FileMaker supports single phone)
3. Phone must be unique across all customers (enforced by `uq_customer_phone_phone`)
4. `type` field is optional - can be NULL or inferred as 'mobile'

**Edge Cases:**
- **Empty Phone**: Skip creation, customer has no phone records
- **Duplicate Phone**: Migration will fail due to unique constraint - requires deduplication strategy
- **Format Variations**: Phone numbers may have inconsistent formatting (+1, spaces, dashes)

---

### Address Mapping

Maps `devCustomers` address fields → `customer_address` table

| FileMaker Field | Supabase Table | Supabase Column | Data Type | Transformation | Notes |
|----------------|----------------|-----------------|-----------|----------------|-------|
| `Address` | `customer_address` | `address_line1` | `text` | Direct copy | Street address |
| - | `customer_address` | `address_line2` | `text` | NULL | FileMaker has single address field |
| `City` | `customer_address` | `city` | `text` | Direct copy | **REQUIRED** in Supabase |
| `State` | `customer_address` | `state` | `text` | Direct copy | **REQUIRED** in Supabase |
| `PostalCode` | `customer_address` | `postal_code` | `text` | Direct copy | Optional |
| `Country` | `customer_address` | `country` | `text` | Direct copy | Optional |
| `__ID` | `customer_address` | `customer_id` | `uuid` | Foreign key from `customers.id` | Links to parent customer |
| - | `customer_address` | `id` | `uuid` | Generate UUID | Auto-generated primary key |
| `~creationTimestamp` | `customer_address` | `created_at` | `timestamptz` | Parse timestamp | Inherit from customer |
| `~modificationTimestamp` | `customer_address` | `updated_at` | `timestamptz` | Parse timestamp | Inherit from customer |

**Transformation Rules:**
1. Only create `customer_address` record if at least one address field is non-empty
2. If creating record, `city` and `state` are REQUIRED (NOT NULL constraint)
3. If `city` or `state` is empty in FileMaker, use placeholder: "Unknown" or skip record creation

**Edge Cases:**
- **Partial Address**: FileMaker may have `City` but no `State` - violates Supabase constraint
- **Missing Required Fields**: If `City` or `State` is empty, must either:
  - Skip address creation (customer has no address)
  - Use placeholder value: "Unknown"
  - Fail migration and require manual data cleanup

**Recommendation**: Query FileMaker for records with missing `City` or `State` before migration

---

### Financial/Configuration Mapping

FileMaker financial fields currently have **NO SUPABASE EQUIVALENT**. These require new table or JSONB storage.

| FileMaker Field | Supabase Table | Supabase Column | Data Type | Transformation | Status |
|----------------|----------------|-----------------|-----------|----------------|--------|
| `chargeRate` | **UNMAPPED** | - | - | - | **MISSING** |
| `f_USD` | **UNMAPPED** | - | - | - | **MISSING** |
| `f_EUR` | **UNMAPPED** | - | - | - | **MISSING** |
| `f_prePay` | **UNMAPPED** | - | - | - | **MISSING** |
| `fundsAvailable` | **UNMAPPED** | - | - | - | **MISSING** |

**Proposed Solution**: Add JSONB field to `customers` table:

```sql
ALTER TABLE customers ADD COLUMN financial_data jsonb;
```

**JSONB Structure**:
```json
{
  "charge_rate": 100.00,
  "currencies": {
    "usd": true,
    "eur": false
  },
  "prepay_amount": 500.00,
  "funds_available": 250.00
}
```

**Alternative**: Create `customer_financial` table with structured columns (preferred for queryability)

---

### Database Credentials Mapping

FileMaker database credential fields currently have **NO SUPABASE EQUIVALENT**.

| FileMaker Field | Supabase Table | Supabase Column | Data Type | Transformation | Status |
|----------------|----------------|-----------------|-----------|----------------|--------|
| `dbPath` | **UNMAPPED** | - | - | - | **MISSING** |
| `dbUserName` | **UNMAPPED** | - | - | - | **MISSING** |
| `dbPasword` | **UNMAPPED** | - | - | - | **MISSING** (typo preserved from FileMaker) |

**Proposed Solution**: Add JSONB field to `customers` table:

```sql
ALTER TABLE customers ADD COLUMN database_credentials jsonb;
```

**JSONB Structure** (encrypted):
```json
{
  "path": "/path/to/database.fmp12",
  "username": "admin",
  "password_encrypted": "...", // Encrypt before storage
  "last_verified": "2026-01-10T10:00:00Z"
}
```

**Security Considerations**:
- **DO NOT STORE PLAINTEXT PASSWORDS**
- Encrypt passwords using backend encryption service
- Consider using HashiCorp Vault or AWS Secrets Manager
- Implement field-level encryption for JSONB

---

### Other Metadata

| FileMaker Field | Supabase Table | Supabase Column | Data Type | Transformation | Status |
|----------------|----------------|-----------------|-----------|----------------|--------|
| `OBSI_ClientNo` | **UNMAPPED** | - | - | - | **MISSING** |
| `ContactPerson` | **UNMAPPED** | - | - | - | **MISSING** (should map to `customer_contacts`?) |

**OBSI_ClientNo**: Unknown business purpose - may be external reference number
- **Proposed**: Add to `customers` JSONB field or create `obsi_client_no` column

**ContactPerson**: Should map to `customer_contacts` table?
- Current Supabase schema has `customer_contacts` linking to separate `contacts` table
- FileMaker has simple text field, not structured contact
- **Proposed**: Add `contact_person_name` text column to `customers` table

---

## Data Transformations

### Boolean Conversion

FileMaker stores booleans as text: "1" (true) or "0" (false)
Supabase uses native `boolean` type

**Transformation Logic**:
```javascript
// FileMaker → Supabase
function fmBoolToSupabase(fmValue) {
  return fmValue === "1" || fmValue === 1;
}

// Supabase → FileMaker
function supabaseBoolToFM(value) {
  return value ? "1" : "0";
}
```

**Fields Requiring Conversion**:
- `f_active` → (unmapped, but would convert to boolean)
- `f_USD` → `financial_data.currencies.usd`
- `f_EUR` → `financial_data.currencies.eur`

**Code Reference**: src/services/customerService.js:19

---

### Timestamp Conversion

FileMaker uses ISO 8601 timestamps, Supabase uses `timestamptz`

**Transformation Logic**:
```javascript
// FileMaker → Supabase
function fmTimestampToSupabase(fmTimestamp) {
  return new Date(fmTimestamp).toISOString();
}
```

**Fields Requiring Conversion**:
- `~creationTimestamp` → `created_at`
- `~modificationTimestamp` → `updated_at`

**Edge Cases**:
- FileMaker timestamps may be in local timezone
- Supabase stores as UTC
- Must ensure consistent timezone handling

---

### UUID Preservation

FileMaker `__ID` must be preserved as Supabase `customers.id`

**Transformation Logic**:
```javascript
// Direct copy, validate format
function validateUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
```

**Requirements**:
- Must be valid UUID v4 format
- Must be unique across all customers
- Cannot be null or empty

**Code Reference**: src/services/customerService.js:17

---

### Email Normalization

Email addresses should be normalized before storage

**Transformation Logic**:
```javascript
function normalizeEmail(email) {
  if (!email) return null;
  return email.trim().toLowerCase();
}
```

**Validation**:
```javascript
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
```

**Code Reference**: src/services/customerService.js:114-116

---

### Phone Normalization

Phone numbers should be normalized to consistent format

**Transformation Logic**:
```javascript
function normalizePhone(phone) {
  if (!phone) return null;
  // Remove all non-numeric except leading +
  return phone.replace(/(?!^\+)\D/g, '');
}
```

**Validation**:
```javascript
function isValidPhone(phone) {
  const phoneRegex = /^\+?[\d\s-()]+$/;
  return phoneRegex.test(phone);
}
```

**Code Reference**: src/services/customerService.js:119-121

**Recommendations**:
- Store in E.164 format: `+14035403139`
- Validate country code
- Consider using libphonenumber for robust parsing

---

## Complex Mappings

### One-to-Many Decomposition

FileMaker stores single values; Supabase normalizes into separate tables

**Pattern**: `devCustomers` (1) → `customer_email` (many), `customer_phone` (many), `customer_address` (many)

**Example Migration**:
```sql
-- Source: FileMaker record
{
  "__ID": "bdaf47fe-c964-469c-aaec-7cfdd5b18a58",
  "Name": "Citrus-O",
  "Email": "contact@citruso.com",
  "phone": "+14035551234",
  "City": "Calgary",
  "State": "AB"
}

-- Target: Supabase customers
INSERT INTO customers (id, business_name, type, organization_id)
VALUES ('bdaf47fe-c964-469c-aaec-7cfdd5b18a58', 'Citrus-O', 'CUSTOMER', 'org-uuid');

-- Target: Supabase customer_email
INSERT INTO customer_email (customer_id, email, is_primary)
VALUES ('bdaf47fe-c964-469c-aaec-7cfdd5b18a58', 'contact@citruso.com', true);

-- Target: Supabase customer_phone
INSERT INTO customer_phone (customer_id, phone, is_primary)
VALUES ('bdaf47fe-c964-469c-aaec-7cfdd5b18a58', '+14035551234', true);

-- Target: Supabase customer_address
INSERT INTO customer_address (customer_id, city, state)
VALUES ('bdaf47fe-c964-469c-aaec-7cfdd5b18a58', 'Calgary', 'AB');
```

---

### Conditional Field Mapping

Some Supabase records should only be created if FileMaker fields are populated

**Rules**:
1. **customer_email**: Only create if `Email IS NOT NULL AND Email != ''`
2. **customer_phone**: Only create if `phone IS NOT NULL AND phone != ''`
3. **customer_address**: Only create if `City IS NOT NULL AND State IS NOT NULL`

**Migration Pseudocode**:
```python
def migrate_customer(fm_customer):
    # Always create customer record
    supabase.insert('customers', {
        'id': fm_customer['__ID'],
        'business_name': fm_customer['Name'],
        'type': 'CUSTOMER',
        'organization_id': get_org_id(fm_customer)
    })

    # Conditionally create email
    if fm_customer.get('Email'):
        supabase.insert('customer_email', {
            'customer_id': fm_customer['__ID'],
            'email': normalize_email(fm_customer['Email']),
            'is_primary': True
        })

    # Conditionally create phone
    if fm_customer.get('phone'):
        supabase.insert('customer_phone', {
            'customer_id': fm_customer['__ID'],
            'phone': normalize_phone(fm_customer['phone']),
            'is_primary': True
        })

    # Conditionally create address (requires both city and state)
    if fm_customer.get('City') and fm_customer.get('State'):
        supabase.insert('customer_address', {
            'customer_id': fm_customer['__ID'],
            'address_line1': fm_customer.get('Address'),
            'city': fm_customer['City'],
            'state': fm_customer['State'],
            'postal_code': fm_customer.get('PostalCode'),
            'country': fm_customer.get('Country')
        })
```

---

### Organization Assignment

Every Supabase customer requires `organization_id` (nullable in schema, but required for multi-tenancy)

**Assignment Strategies**:

1. **User Context** (current dual-write approach):
   - When user updates customer, use `user.supabaseOrgID`
   - **Code Reference**: src/hooks/useCustomer.js:124

2. **Default Organization** (migration approach):
   - Create "Legacy FileMaker Customers" organization
   - Assign all migrated customers to this org
   - Allow users to reassign later

3. **Lookup Table** (if mappings exist):
   - Use FileMaker field or external mapping table
   - Map FileMaker customers to Supabase organizations

**Recommendation**: Use strategy #2 (default organization) for initial migration, then implement org reassignment workflow

---

## Unmapped Fields

### FileMaker Fields WITHOUT Supabase Mapping

These fields exist in FileMaker but have no corresponding Supabase column:

| FileMaker Field | Data Type | Usage | Recommendation |
|----------------|-----------|-------|----------------|
| `f_active` | Text ("1"/"0") | Active/inactive status | **Add `status` or `is_active` column to `customers`** |
| `chargeRate` | Number | Hourly billing rate | **Add `customer_financial` table or JSONB column** |
| `f_USD` | Boolean | USD currency flag | **Add to financial JSONB** |
| `f_EUR` | Boolean | EUR currency flag | **Add to financial JSONB** |
| `f_prePay` | Number | Prepayment amount | **Add to financial JSONB** |
| `fundsAvailable` | Number | Available funds | **Add to financial JSONB** |
| `dbPath` | Text | Database file path | **Add JSONB column for credentials** |
| `dbUserName` | Text | Database username | **Add JSONB column for credentials** |
| `dbPasword` | Text | Database password (typo) | **Add JSONB column for credentials (encrypted!)** |
| `OBSI_ClientNo` | Text | External client number | **Add column or JSONB to `customers`** |
| `ContactPerson` | Text | Contact person name | **Add `contact_person_name` column or link to `customer_contacts`** |

---

### Supabase Fields WITHOUT FileMaker Source

These fields exist in Supabase but have no FileMaker equivalent:

| Supabase Table | Supabase Column | Data Type | Recommendation |
|----------------|-----------------|-----------|----------------|
| `customers` | `name` | text | **Set to NULL** (deprecated field) |
| `customers` | `first_name` | text | **Set to NULL** (not used in FM integration) |
| `customers` | `last_name` | text | **Set to NULL** (not used in FM integration) |
| `customer_phone` | `type` | text | **Set to NULL or infer as 'mobile'** |
| `customer_address` | `address_line2` | text | **Set to NULL** (FM has single address field) |

---

## Migration Considerations

### Data Quality Issues

#### 1. Duplicate Emails/Phones

**Problem**: Supabase enforces unique constraints on `customer_email.email` and `customer_phone.phone`

**Impact**: If multiple FileMaker customers share the same email/phone, migration will fail

**Detection Query** (FileMaker):
```sql
-- Find duplicate emails
SELECT Email, COUNT(*) as count
FROM devCustomers
WHERE Email IS NOT NULL AND Email != ''
GROUP BY Email
HAVING COUNT(*) > 1;

-- Find duplicate phones
SELECT phone, COUNT(*) as count
FROM devCustomers
WHERE phone IS NOT NULL AND phone != ''
GROUP BY phone
HAVING COUNT(*) > 1;
```

**Resolution Strategies**:
1. **Manual Cleanup**: Before migration, deduplicate in FileMaker
2. **Suffix Strategy**: Append suffix to duplicates (e.g., `email+1@domain.com`)
3. **Skip Duplicates**: Only migrate first occurrence, log others
4. **Relax Constraint**: Change Supabase unique constraint to composite `(customer_id, email)`

**Recommendation**: Strategy #1 (manual cleanup) - ensures data integrity

---

#### 2. Missing Required Fields

**Problem**: Supabase `customer_address` requires `city` and `state` (NOT NULL)

**Impact**: FileMaker records with missing `City` or `State` will fail address migration

**Detection Query** (FileMaker):
```sql
SELECT __ID, Name, City, State
FROM devCustomers
WHERE (City IS NULL OR City = '') OR (State IS NULL OR State = '');
```

**Resolution Strategies**:
1. **Skip Address**: Don't create `customer_address` record for these customers
2. **Placeholder Values**: Use "Unknown" for missing city/state
3. **Schema Change**: Make `city` and `state` nullable in Supabase

**Recommendation**: Strategy #1 (skip address) - preserves data integrity

---

#### 3. Invalid UUIDs

**Problem**: FileMaker `__ID` must be valid UUID v4 format

**Impact**: Invalid UUIDs will cause primary key constraint violations

**Detection Logic**:
```javascript
function validateUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
```

**Resolution Strategies**:
1. **Generate New UUIDs**: Replace invalid UUIDs, maintain mapping table
2. **Fix FileMaker**: Correct invalid UUIDs in FileMaker before migration
3. **Fail Migration**: Abort and require manual intervention

**Recommendation**: Strategy #2 (fix FileMaker) - ensures data consistency

---

### ID Reconciliation

#### FileMaker ID Types

FileMaker uses TWO identifier fields:
1. **`__ID`** (UUID): Global unique identifier, used for queries
2. **`recordId`** (Internal): FileMaker internal record ID, used for updates/deletes

**Current Code Inconsistency**:
- `fetchCustomerById(customerId)` expects `__ID` (src/api/customers.js:24)
- `updateCustomer(customerId, data)` expects `recordId` (src/api/customers.js:44)
- `deleteCustomer(customerId)` expects `recordId` (src/api/customers.js:122)

**Supabase ID**:
- Only uses `customers.id` (UUID), which maps to FileMaker `__ID`

#### Migration Strategy

**During Migration**:
1. Use FileMaker `__ID` as Supabase `customers.id`
2. Store FileMaker `recordId` in mapping table (optional, for rollback)

**Mapping Table** (optional):
```sql
CREATE TABLE filemaker_id_mapping (
  supabase_customer_id UUID PRIMARY KEY REFERENCES customers(id),
  filemaker_uuid TEXT NOT NULL,      -- FileMaker __ID
  filemaker_record_id TEXT NOT NULL, -- FileMaker recordId
  migrated_at TIMESTAMPTZ DEFAULT now()
);
```

**Post-Migration**:
- Update frontend code to use consistent ID field
- Remove `recordId` usage from API calls
- Use UUID for all operations

**Code Reference**: requirements/customers/current-implementation.md:472-486

---

### Organization Scoping

#### Current State

- FileMaker has no organization concept
- Supabase `customers.organization_id` is nullable
- Dual-write uses `user.supabaseOrgID` when available

#### Migration Decision Points

**Question 1**: Should all FileMaker customers be assigned to single organization?
- **Option A**: Yes, create "Legacy" organization
- **Option B**: No, leave `organization_id` NULL
- **Option C**: Use mapping logic to determine organization

**Question 2**: Should `organization_id` become NOT NULL?
- **Option A**: Yes, enforce multi-tenancy from day 1
- **Option B**: No, allow NULL during transition period

**Recommendations**:
- **Short-term**: Use Option A (Legacy organization) to simplify migration
- **Long-term**: Make `organization_id` NOT NULL after org assignment workflow

#### RLS Implications

If `organization_id` is required for RLS policies:
```sql
-- RLS policy requires organization scoping
CREATE POLICY customer_org_isolation ON customers
  FOR ALL USING (organization_id = current_user_organization());
```

**Impact**: Customers with `organization_id = NULL` will be invisible

**Solution**: Ensure all customers have valid `organization_id` before enabling RLS

---

### Performance Considerations

#### Migration Volume

**Estimated Records** (based on Supabase data):
- Customers: ~104 records (current Supabase count)
- FileMaker may have more (unknown without query)

**Related Records** (per customer):
- customer_email: 1 record (if email exists)
- customer_phone: 1 record (if phone exists)
- customer_address: 1 record (if address exists)

**Total Inserts**: ~104 customers × 4 tables = ~416 inserts (max)

**Migration Time**: < 1 minute for current volume

#### Batch Strategy

**Recommended Batch Size**: 50 customers per transaction

**Migration Pseudocode**:
```python
def migrate_customers_batch(fm_customers, batch_size=50):
    for i in range(0, len(fm_customers), batch_size):
        batch = fm_customers[i:i+batch_size]

        with transaction():
            for fm_customer in batch:
                migrate_customer(fm_customer)

        log_progress(i, len(fm_customers))
```

**Rollback Strategy**: Each batch is atomic - if batch fails, previous batches remain

---

### Validation Requirements

#### Pre-Migration Validation

Run these checks BEFORE migrating data:

1. **UUID Validation**:
   ```sql
   -- FileMaker: Find invalid UUIDs
   SELECT __ID, Name FROM devCustomers
   WHERE __ID NOT REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
   ```

2. **Duplicate Email Check**:
   ```sql
   SELECT Email, COUNT(*) FROM devCustomers
   WHERE Email IS NOT NULL AND Email != ''
   GROUP BY Email HAVING COUNT(*) > 1;
   ```

3. **Duplicate Phone Check**:
   ```sql
   SELECT phone, COUNT(*) FROM devCustomers
   WHERE phone IS NOT NULL AND phone != ''
   GROUP BY phone HAVING COUNT(*) > 1;
   ```

4. **Missing Required Fields**:
   ```sql
   -- Check for missing Name
   SELECT __ID FROM devCustomers WHERE Name IS NULL OR Name = '';

   -- Check for addresses missing city/state
   SELECT __ID, Name, City, State FROM devCustomers
   WHERE (City IS NULL OR City = '' OR State IS NULL OR State = '')
     AND (City IS NOT NULL OR State IS NOT NULL OR Address IS NOT NULL);
   ```

#### Post-Migration Validation

Run these checks AFTER migration:

1. **Record Count Match**:
   ```sql
   -- Supabase: Count migrated customers
   SELECT COUNT(*) FROM customers WHERE type = 'CUSTOMER';

   -- Compare with FileMaker count
   ```

2. **Email Integrity**:
   ```sql
   -- Verify all emails linked to valid customers
   SELECT e.email FROM customer_email e
   LEFT JOIN customers c ON e.customer_id = c.id
   WHERE c.id IS NULL;
   ```

3. **Phone Integrity**:
   ```sql
   -- Verify all phones linked to valid customers
   SELECT p.phone FROM customer_phone p
   LEFT JOIN customers c ON p.customer_id = c.id
   WHERE c.id IS NULL;
   ```

4. **Address Integrity**:
   ```sql
   -- Verify all addresses linked to valid customers
   SELECT a.id FROM customer_address a
   LEFT JOIN customers c ON a.customer_id = c.id
   WHERE c.id IS NULL;
   ```

5. **Organization Assignment**:
   ```sql
   -- Check for NULL organization_id (if required)
   SELECT COUNT(*) FROM customers WHERE organization_id IS NULL;
   ```

---

## Code References

### FileMaker Field Discovery

| File Path | Lines | Purpose |
|-----------|-------|---------|
| src/components/customers/CustomerForm.jsx | 25-48 | Form field definitions (Name, Email, phone, chargeRate, etc.) |
| src/services/customerService.js | 10-23 | FileMaker response processing (__ID, f_active, timestamps) |
| src/services/customerService.js | 101-110 | FileMaker field formatting (Name, Email, Phone, f_active, ContactPerson) |
| src/services/customerService.js | 124-134 | Address field usage (Address, City, State, PostalCode, Country) |
| src/api/customers.js | 1-135 | FileMaker API calls and layout constants |

### Supabase Mapping Logic

| File Path | Lines | Purpose |
|-----------|-------|---------|
| src/hooks/useSupabaseCustomer.js | 203-367 | Dual-write update logic (customers, customer_email, customer_phone, customer_address) |
| src/hooks/useSupabaseCustomer.js | 57-125 | Customer creation logic with organization linking |
| src/hooks/useCustomer.js | 112-177 | Dual-write orchestration during customer update |

### Data Transformations

| File Path | Lines | Purpose |
|-----------|-------|---------|
| src/services/customerService.js | 19 | Boolean conversion (f_active string to isActive boolean) |
| src/services/customerService.js | 20-21 | Timestamp extraction (~creationTimestamp, ~modificationTimestamp) |
| src/services/customerService.js | 17 | UUID mapping (__ID to id) |
| src/services/customerService.js | 114-121 | Email and phone validation regex |

### Schema Documentation

| File Path | Purpose |
|-----------|---------|
| .devflow/tasks/customers-migration-requirements/supabase-schema.md | Complete Supabase schema for customers and related tables |
| requirements/customers/current-implementation.md | FileMaker implementation details and dual-write behavior |

---

## Backend Change Request

### Required Schema Changes

**File**: `BACKEND_CHANGE_REQUEST_001_CUSTOMER_SCHEMA_COMPLETION.md`

**Summary**: Add missing columns and tables to support full FileMaker field migration

**Changes Required**:

1. **Add `customers.is_active` column**:
   ```sql
   ALTER TABLE customers ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
   CREATE INDEX idx_customers_is_active ON customers(is_active);
   ```

2. **Add `customers.contact_person_name` column**:
   ```sql
   ALTER TABLE customers ADD COLUMN contact_person_name TEXT;
   ```

3. **Add `customers.obsi_client_no` column**:
   ```sql
   ALTER TABLE customers ADD COLUMN obsi_client_no TEXT;
   CREATE INDEX idx_customers_obsi_client_no ON customers(obsi_client_no);
   ```

4. **Add `customers.financial_data` column**:
   ```sql
   ALTER TABLE customers ADD COLUMN financial_data JSONB;
   CREATE INDEX idx_customers_financial_data ON customers USING GIN (financial_data);
   ```

5. **Add `customers.database_credentials` column**:
   ```sql
   ALTER TABLE customers ADD COLUMN database_credentials JSONB;
   -- Encrypt this field at rest using Supabase field-level encryption
   ```

6. **Add missing indexes**:
   ```sql
   CREATE INDEX idx_customer_email_customer_id ON customer_email(customer_id);
   CREATE INDEX idx_customer_phone_customer_id ON customer_phone(customer_id);
   CREATE INDEX idx_customer_address_customer_id ON customer_address(customer_id);
   CREATE INDEX idx_customers_organization_id ON customers(organization_id);
   ```

7. **Make `customer_address` fields nullable**:
   ```sql
   ALTER TABLE customer_address ALTER COLUMN city DROP NOT NULL;
   ALTER TABLE customer_address ALTER COLUMN state DROP NOT NULL;
   ```

8. **Fix `customer_contacts.is_primary` data type**:
   ```sql
   ALTER TABLE customer_contacts ALTER COLUMN is_primary TYPE boolean USING is_primary::boolean;
   ```

**Testing Requirements**:
- Validate JSONB structure for `financial_data` and `database_credentials`
- Test encryption for `database_credentials`
- Verify indexes improve query performance
- Ensure RLS policies work with new columns

**Rollback Plan**:
```sql
-- Reverse migrations
ALTER TABLE customers DROP COLUMN is_active;
ALTER TABLE customers DROP COLUMN contact_person_name;
ALTER TABLE customers DROP COLUMN obsi_client_no;
ALTER TABLE customers DROP COLUMN financial_data;
ALTER TABLE customers DROP COLUMN database_credentials;
-- Drop indexes
-- Restore NOT NULL constraints on customer_address
```

---

## Document Status

**Status**: Complete - Ready for Backend Review
**Next Steps**:
1. Backend team reviews schema changes
2. Create migration scripts for data backfill
3. Implement validation queries
4. Test migration on staging environment

**Related Documents**:
- [Supabase Schema](./supabase-schema.md)
- [Current Implementation](../../requirements/customers/current-implementation.md)
- [Migration Plan](./migration-plan.md) (to be created)
- [API Contracts](./api-contracts.md) (to be created)
