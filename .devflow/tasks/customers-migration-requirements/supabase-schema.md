# Supabase Schema Documentation - Customers and Related Tables

## Overview

This document provides a comprehensive analysis of the Supabase database schema for customers and all related tables. This schema represents the **target state** for the migration from FileMaker to Supabase-only architecture.

**Database**: PostgreSQL (via Supabase)
**Container**: `supabase-db`
**User**: `postgres`
**Database Name**: `postgres`
**Schema**: `public`
**Total Customer Records**: 104 (as of 2026-01-10)

## Table of Contents

1. [Core Customers Table](#core-customers-table)
2. [Related Tables](#related-tables)
3. [Relationships and Foreign Keys](#relationships-and-foreign-keys)
4. [Indexes and Performance](#indexes-and-performance)
5. [Data Samples](#data-samples)
6. [Multi-Tenancy](#multi-tenancy)
7. [Edge Cases and Constraints](#edge-cases-and-constraints)

---

## Core Customers Table

### `customers`

Primary table storing customer/contact records with multi-tenancy support.

#### Schema

| Column Name | Data Type | Nullable | Default | Description |
|------------|-----------|----------|---------|-------------|
| `id` | `uuid` | NO | - | Primary key (UUID) |
| `name` | `text` | YES | - | Legacy full name field (may be deprecated) |
| `created_at` | `timestamp with time zone` | YES | `now()` | Record creation timestamp |
| `updated_at` | `timestamp with time zone` | YES | `now()` | Last modification timestamp |
| `first_name` | `text` | YES | - | Individual's first name |
| `last_name` | `text` | YES | - | Individual's last name |
| `business_name` | `text` | YES | - | Company/business name |
| `type` | `customertype` (enum) | NO | - | Customer classification |
| `organization_id` | `uuid` | YES | - | Multi-tenancy org reference |

#### Customer Type Enum Values

```sql
CREATE TYPE customertype AS ENUM (
  'FAMILY',
  'FRIEND',
  'COLLEAGUE',
  'CUSTOMER',
  'STAFF',
  'prospect',  -- lowercase variant
  'PROSPECT'   -- uppercase variant
);
```

**Note**: The enum has both `prospect` and `PROSPECT` - indicates potential data consistency issue.

#### Constraints

- **Primary Key**: `customers_pkey` on `id`
- **Foreign Key**: `customers_organization_id_fkey` → `organizations(id)`
- **NOT NULL**: `id`, `type`

#### Business Rules

1. **Name Fields**: Either `business_name` OR (`first_name` + `last_name`) should be populated
2. **Type Classification**: Must be one of the enum values
3. **Organization Scoping**: `organization_id` enables multi-tenant data isolation
4. **Timestamps**: Automatically managed by database triggers

#### Sample Data

```json
{
  "id": "bdaf47fe-c964-469c-aaec-7cfdd5b18a58",
  "name": null,
  "first_name": null,
  "last_name": null,
  "business_name": "Citrus-O",
  "type": "CUSTOMER",
  "organization_id": null,
  "created_at": "2025-07-16T01:17:45.575927Z",
  "updated_at": "2025-07-16T01:17:45.575927Z"
}
```

---

## Related Tables

### `customer_email`

Stores email addresses for customers with unique constraint.

#### Schema

| Column Name | Data Type | Nullable | Default | Description |
|------------|-----------|----------|---------|-------------|
| `id` | `uuid` | NO | - | Primary key |
| `customer_id` | `uuid` | NO | - | Foreign key to customers |
| `email` | `text` | NO | - | Email address (UNIQUE) |
| `is_primary` | `boolean` | YES | - | Primary email flag |
| `created_at` | `timestamp with time zone` | YES | `now()` | Creation timestamp |
| `updated_at` | `timestamp with time zone` | YES | `now()` | Update timestamp |

#### Constraints

- **Primary Key**: `customer_email_pkey` on `id`
- **Foreign Key**: `customer_email_customer_id_fkey` → `customers(id)`
- **Unique**: `uq_customer_email_email` on `email` (prevents duplicate emails)
- **NOT NULL**: `id`, `customer_id`, `email`

#### Business Rules

1. **Unique Emails**: Each email can only exist once in the table (global uniqueness)
2. **One Primary**: Only one email per customer should have `is_primary = true`
3. **Cascade Deletes**: Deleting a customer should cascade to emails (verify RLS)

#### Sample Data

```json
{
  "id": "d5081ef7-43f9-4a30-9100-243d29b1a798",
  "customer_id": "4ea14fcf-fa44-44b8-863a-1b6d83951c70",
  "email": "phil@doublet.ca",
  "is_primary": true,
  "created_at": "2025-07-16T01:20:00Z",
  "updated_at": "2025-07-16T01:20:00Z"
}
```

---

### `customer_phone`

Stores phone numbers for customers with type classification.

#### Schema

| Column Name | Data Type | Nullable | Default | Description |
|------------|-----------|----------|---------|-------------|
| `id` | `uuid` | NO | - | Primary key |
| `customer_id` | `uuid` | NO | - | Foreign key to customers |
| `phone` | `text` | NO | - | Phone number (UNIQUE) |
| `type` | `text` | YES | - | Phone type (mobile, work, home, etc.) |
| `is_primary` | `boolean` | YES | - | Primary phone flag |
| `created_at` | `timestamp with time zone` | YES | `now()` | Creation timestamp |
| `updated_at` | `timestamp with time zone` | YES | `now()` | Update timestamp |

#### Constraints

- **Primary Key**: `customer_phone_pkey` on `id`
- **Foreign Key**: `customer_phone_customer_id_fkey` → `customers(id)`
- **Unique**: `uq_customer_phone_phone` on `phone` (prevents duplicate numbers)
- **NOT NULL**: `id`, `customer_id`, `phone`

#### Business Rules

1. **Unique Phone Numbers**: Each phone number can only exist once (global uniqueness)
2. **Type Values**: No enum defined - `type` is free text (potential data inconsistency)
3. **One Primary**: Only one phone per customer should have `is_primary = true`
4. **Format Validation**: Phone numbers appear to include country codes (e.g., `+14035403139`)

#### Sample Data

```json
{
  "id": "e1a933c2-6059-48df-8b90-90e469d8ce3c",
  "customer_id": "4ea14fcf-fa44-44b8-863a-1b6d83951c70",
  "phone": "+14035403139",
  "type": null,
  "is_primary": true,
  "created_at": "2025-07-16T01:20:00Z",
  "updated_at": "2025-07-16T01:20:00Z"
}
```

---

### `customer_address`

Stores physical addresses for customers.

#### Schema

| Column Name | Data Type | Nullable | Default | Description |
|------------|-----------|----------|---------|-------------|
| `id` | `uuid` | NO | - | Primary key |
| `customer_id` | `uuid` | NO | - | Foreign key to customers |
| `address_line1` | `text` | YES | - | Street address line 1 |
| `address_line2` | `text` | YES | - | Street address line 2 (suite, apt, etc.) |
| `city` | `text` | NO | - | City name |
| `state` | `text` | NO | - | State/province code |
| `postal_code` | `text` | YES | - | ZIP/postal code |
| `country` | `text` | YES | - | Country name or code |
| `created_at` | `timestamp with time zone` | YES | `now()` | Creation timestamp |
| `updated_at` | `timestamp with time zone` | YES | `now()` | Update timestamp |

#### Constraints

- **Primary Key**: `customer_address_pkey` on `id`
- **Foreign Key**: `customer_address_customer_id_fkey` → `customers(id)`
- **NOT NULL**: `id`, `customer_id`, `city`, `state`

#### Business Rules

1. **Required Fields**: `city` and `state` are mandatory
2. **Optional Details**: `address_line1`, `postal_code`, `country` can be null
3. **Multiple Addresses**: No unique constraint - customers can have multiple addresses
4. **No Primary Flag**: Unlike email/phone, no `is_primary` field (may need to add)

#### Sample Data

```json
{
  "id": "3cc58379-ef8b-48ec-b7af-d42c7c619887",
  "customer_id": "a23b3f2c-f42b-4811-89fd-620f23984ae8",
  "address_line1": "456 Pandora Avenue Suite W01",
  "address_line2": null,
  "city": "Victoria",
  "state": "BC",
  "postal_code": "V8W 0E3",
  "country": null,
  "created_at": "2025-07-16T01:20:00Z",
  "updated_at": "2025-07-16T01:20:00Z"
}
```

---

### `customer_contacts`

Links customers to contacts (from the `contacts` table) with relationship metadata.

#### Schema

| Column Name | Data Type | Nullable | Default | Description |
|------------|-----------|----------|---------|-------------|
| `id` | `uuid` | NO | - | Primary key |
| `customer_id` | `uuid` | NO | - | Foreign key to customers |
| `contact_id` | `uuid` | NO | - | Foreign key to contacts |
| `relationship_type` | `character varying` | NO | - | Type of relationship |
| `is_primary` | `character varying` | NO | - | Primary contact flag (string, not boolean!) |
| `sync_source` | `character varying` | NO | - | Source system for sync tracking |
| `confidence_score` | `character varying` | YES | - | Confidence in relationship match |
| `created_at` | `timestamp with time zone` | YES | - | Creation timestamp |
| `updated_at` | `timestamp with time zone` | YES | - | Update timestamp |

#### Constraints

- **Primary Key**: `customer_contacts_pkey` on `id`
- **Foreign Keys**:
  - `customer_contacts_customer_id_fkey` → `customers(id)`
  - `customer_contacts_contact_id_fkey` → `contacts(id)`
- **Unique**: `idx_customer_contacts_unique` on `(customer_id, contact_id)` - prevents duplicate links
- **NOT NULL**: `id`, `customer_id`, `contact_id`, `relationship_type`, `is_primary`, `sync_source`

#### Indexes

```sql
CREATE INDEX idx_customer_contacts_customer_id ON customer_contacts (customer_id);
CREATE INDEX idx_customer_contacts_contact_id ON customer_contacts (contact_id);
CREATE INDEX idx_customer_contacts_relationship_type ON customer_contacts (relationship_type);
CREATE INDEX idx_customer_contacts_is_primary ON customer_contacts (is_primary);
CREATE INDEX idx_customer_contacts_created_at ON customer_contacts (created_at);
CREATE UNIQUE INDEX idx_customer_contacts_unique ON customer_contacts (customer_id, contact_id);
```

#### Business Rules

1. **One Link Per Pair**: A customer-contact pair can only exist once
2. **String Boolean Issue**: `is_primary` is `character varying` instead of `boolean` (data type issue)
3. **Sync Tracking**: `sync_source` and `confidence_score` suggest external integration (iCloud/CardDAV)
4. **Relationship Types**: No enum defined - free text field

#### Related Table: `contacts`

The `contacts` table stores contact information in a JSONB format:

| Column Name | Data Type | Description |
|------------|-----------|-------------|
| `id` | `uuid` | Primary key |
| `icloud_uid` | `character varying` | iCloud unique identifier |
| `carddav_etag` | `character varying` | CardDAV entity tag |
| `carddav_url` | `character varying` | CardDAV URL |
| `contact_data` | `jsonb` | Contact information (structured JSON) |
| `source` | `character varying` | Data source (iCloud, manual, etc.) |
| `status` | `character varying` | Contact status |
| `created_at` | `timestamp with time zone` | Creation timestamp |
| `updated_at` | `timestamp with time zone` | Update timestamp |
| `last_synced_at` | `timestamp with time zone` | Last sync timestamp |

**Note**: `contact_data` JSONB field structure needs investigation for field mapping.

#### Current Data Status

**Empty Table**: Query returned 0 rows, indicating this feature may not be actively used yet.

---

### `customer_sales`

Stores sales transactions and product purchases for customers.

#### Schema

| Column Name | Data Type | Nullable | Default | Description |
|------------|-----------|----------|---------|-------------|
| `id` | `uuid` | NO | - | Primary key |
| `customer_id` | `uuid` | NO | - | Foreign key to customers |
| `product_id` | `uuid` | YES | - | Foreign key to products (optional) |
| `product_name` | `text` | NO | - | Product name (denormalized) |
| `quantity` | `numeric` | NO | - | Quantity sold |
| `unit_price` | `numeric` | NO | - | Price per unit |
| `total_price` | `numeric` | NO | - | Total transaction amount |
| `created_at` | `timestamp with time zone` | NO | `now()` | Creation timestamp |
| `updated_at` | `timestamp with time zone` | NO | `now()` | Update timestamp |
| `organization_id` | `uuid` | NO | - | Multi-tenancy org reference |
| `date` | `date` | NO | - | Transaction date |
| `inv_id` | `text` | YES | - | Invoice ID reference |
| `financial_id` | `uuid` | YES | - | QuickBooks/financial system ID (UNIQUE) |
| `configuration_data` | `jsonb` | YES | - | Flexible configuration (workflow status, etc.) |

#### Constraints

- **Primary Key**: `customer_sales_pkey` on `id`
- **Foreign Keys**:
  - `customer_sales_customer_id_fkey` → `customers(id)`
  - `customer_sales_product_id_fkey` → `products(id)`
  - `customer_sales_organization_id_fkey` → `organizations(id)`
- **Unique**: `customer_sales_financial_id_key` on `financial_id`
- **NOT NULL**: `id`, `customer_id`, `product_name`, `quantity`, `unit_price`, `total_price`, `created_at`, `updated_at`, `organization_id`, `date`

#### Indexes

```sql
CREATE INDEX idx_customer_sales_workflow_status
  ON customer_sales ((configuration_data->>'workflow_status'))
  WHERE configuration_data IS NOT NULL;
```

**Note**: Partial index on JSONB field for workflow status queries.

#### Business Rules

1. **Product Reference**: `product_id` is optional, but `product_name` is required (denormalized for historical accuracy)
2. **Financial Integration**: `financial_id` links to QuickBooks/accounting system (unique constraint)
3. **Multi-Tenancy**: `organization_id` is required (NOT NULL)
4. **Workflow Tracking**: `configuration_data->>'workflow_status'` is indexed for query performance
5. **Fractional Quantities**: `quantity` can be decimal (e.g., 0.5, 0.1)

#### Sample Data

```json
{
  "id": "f5233acd-7c79-4d77-a8ad-97d9e6f5f5a1",
  "customer_id": "ee672b19-5196-411a-9a57-75d0671f2a42",
  "product_id": null,
  "product_name": "CW:Coastland",
  "quantity": 0.5,
  "unit_price": 100,
  "total_price": 50,
  "date": "2025-05-05",
  "inv_id": null,
  "financial_id": null,
  "organization_id": "...",
  "configuration_data": null,
  "created_at": "2025-05-05T00:00:00Z",
  "updated_at": "2025-05-05T00:00:00Z"
}
```

---

## Relationships and Foreign Keys

### Entity-Relationship Diagram (Textual)

```
organizations (id) ───┐
                      ├──< customers (organization_id)
                      │       │
                      │       ├──< customer_email (customer_id)
                      │       ├──< customer_phone (customer_id)
                      │       ├──< customer_address (customer_id)
                      │       ├──< customer_contacts (customer_id)
                      │       └──< customer_sales (customer_id)
                      │
                      └──< customer_sales (organization_id)

products (id) ────< customer_sales (product_id)

contacts (id) ────< customer_contacts (contact_id)
```

### Foreign Key Summary

| Child Table | Column | Parent Table | Parent Column | Constraint Name |
|------------|--------|--------------|---------------|-----------------|
| `customers` | `organization_id` | `organizations` | `id` | `customers_organization_id_fkey` |
| `customer_email` | `customer_id` | `customers` | `id` | `customer_email_customer_id_fkey` |
| `customer_phone` | `customer_id` | `customers` | `id` | `customer_phone_customer_id_fkey` |
| `customer_address` | `customer_id` | `customers` | `id` | `customer_address_customer_id_fkey` |
| `customer_contacts` | `customer_id` | `customers` | `id` | `customer_contacts_customer_id_fkey` |
| `customer_contacts` | `contact_id` | `contacts` | `id` | `customer_contacts_contact_id_fkey` |
| `customer_sales` | `customer_id` | `customers` | `id` | `customer_sales_customer_id_fkey` |
| `customer_sales` | `product_id` | `products` | `id` | `customer_sales_product_id_fkey` |
| `customer_sales` | `organization_id` | `organizations` | `id` | `customer_sales_organization_id_fkey` |

---

## Indexes and Performance

### `customers`
- `customers_pkey` (UNIQUE BTREE on `id`)

### `customer_email`
- `customer_email_pkey` (UNIQUE BTREE on `id`)
- `uq_customer_email_email` (UNIQUE BTREE on `email`)

### `customer_phone`
- `customer_phone_pkey` (UNIQUE BTREE on `id`)
- `uq_customer_phone_phone` (UNIQUE BTREE on `phone`)

### `customer_address`
- `customer_address_pkey` (UNIQUE BTREE on `id`)

### `customer_contacts`
- `customer_contacts_pkey` (UNIQUE BTREE on `id`)
- `idx_customer_contacts_customer_id` (BTREE on `customer_id`)
- `idx_customer_contacts_contact_id` (BTREE on `contact_id`)
- `idx_customer_contacts_relationship_type` (BTREE on `relationship_type`)
- `idx_customer_contacts_is_primary` (BTREE on `is_primary`)
- `idx_customer_contacts_created_at` (BTREE on `created_at`)
- `idx_customer_contacts_unique` (UNIQUE BTREE on `customer_id, contact_id`)

### `customer_sales`
- `customer_sales_pkey` (UNIQUE BTREE on `id`)
- `customer_sales_financial_id_key` (UNIQUE BTREE on `financial_id`)
- `idx_customer_sales_workflow_status` (BTREE on `configuration_data->>'workflow_status'` WHERE `configuration_data IS NOT NULL`)

### Performance Considerations

1. **Missing Indexes**:
   - `customer_email.customer_id` - should add for JOIN performance
   - `customer_phone.customer_id` - should add for JOIN performance
   - `customer_address.customer_id` - should add for JOIN performance
   - `customers.organization_id` - should add for multi-tenant queries

2. **Existing Optimizations**:
   - `customer_contacts` is heavily indexed for relationship queries
   - `customer_sales` has partial JSONB index for workflow queries
   - Email and phone uniqueness enforced at database level

3. **Query Patterns**:
   - Customer detail pages will JOIN all related tables (5-6 JOINs)
   - Organization scoping requires filtering on `organization_id`
   - Primary email/phone lookups are common (use `is_primary = true`)

---

## Data Samples

### Complete Customer Record (with relations)

```sql
-- Main customer
SELECT * FROM customers WHERE id = '4ea14fcf-fa44-44b8-863a-1b6d83951c70';
-- Returns: name, first_name, last_name, business_name, type, organization_id

-- Emails
SELECT * FROM customer_email WHERE customer_id = '4ea14fcf-fa44-44b8-863a-1b6d83951c70';
-- Returns: phil@doublet.ca (is_primary: true)

-- Phones
SELECT * FROM customer_phone WHERE customer_id = '4ea14fcf-fa44-44b8-863a-1b6d83951c70';
-- Returns: +14035403139 (is_primary: true)

-- Addresses
SELECT * FROM customer_address WHERE customer_id = '4ea14fcf-fa44-44b8-863a-1b6d83951c70';
-- Returns: address_line1, city, state, postal_code, country

-- Contacts (relationships)
SELECT * FROM customer_contacts WHERE customer_id = '4ea14fcf-fa44-44b8-863a-1b6d83951c70';
-- Returns: 0 rows (feature not actively used)

-- Sales transactions
SELECT * FROM customer_sales WHERE customer_id = '4ea14fcf-fa44-44b8-863a-1b6d83951c70';
-- Returns: product purchases, quantities, prices, dates
```

---

## Multi-Tenancy

### Organization Scoping

**Tables with `organization_id`**:
- `customers.organization_id` (nullable)
- `customer_sales.organization_id` (NOT NULL)

**Tables WITHOUT `organization_id`**:
- `customer_email` (scoped via `customer_id`)
- `customer_phone` (scoped via `customer_id`)
- `customer_address` (scoped via `customer_id`)
- `customer_contacts` (scoped via `customer_id`)

### Implications

1. **Row-Level Security (RLS)**: Must enforce organization scoping on `customers` table
2. **Child Table Access**: Child tables inherit scoping through foreign key to `customers`
3. **Sales Transactions**: `customer_sales` has explicit `organization_id` (may differ from customer's org?)
4. **Data Isolation**: Need RLS policies to prevent cross-organization data access

### Questions for Backend Team

1. Why does `customer_sales.organization_id` exist separately from `customers.organization_id`?
2. Should `customers.organization_id` be NOT NULL?
3. Are there scenarios where a customer belongs to no organization?
4. How should RLS policies handle null `organization_id`?

---

## Edge Cases and Constraints

### Data Quality Issues

1. **Enum Case Inconsistency**:
   - `customertype` enum has both `prospect` and `PROSPECT`
   - Recommendation: Standardize to uppercase or lowercase

2. **Boolean as String**:
   - `customer_contacts.is_primary` is `character varying` instead of `boolean`
   - Recommendation: Migrate to `boolean` type

3. **Missing Primary Flags**:
   - `customer_address` has no `is_primary` field
   - May need to add if customers have multiple addresses

4. **Phone Type Free Text**:
   - `customer_phone.type` has no enum constraint
   - Recommendation: Create enum for (mobile, work, home, fax, other)

### Unique Constraint Challenges

1. **Global Email Uniqueness**:
   - `customer_email.email` is UNIQUE across all customers
   - Issue: Same email cannot be used by multiple customers (e.g., shared family email)
   - Recommendation: Consider composite unique constraint `(customer_id, email)` instead

2. **Global Phone Uniqueness**:
   - `customer_phone.phone` is UNIQUE across all customers
   - Issue: Same phone cannot be shared (e.g., office number)
   - Recommendation: Consider composite unique constraint `(customer_id, phone)` instead

### Migration Considerations

1. **FileMaker ID Mapping**:
   - FileMaker uses `__ID` (integer) and `recordId`
   - Supabase uses UUIDs
   - Need mapping table: `filemaker_customer_mapping (fm_id, supabase_uuid)`

2. **Dual-Write Synchronization**:
   - Current system writes to FileMaker first, then Supabase
   - Migration must handle:
     - Failed Supabase writes
     - Orphaned FileMaker records
     - Timestamp drift between systems

3. **Null Organization IDs**:
   - Many customers have `organization_id = null`
   - Migration plan must decide:
     - Assign to default organization?
     - Create "legacy" organization?
     - Allow null during transition?

4. **Customer Contacts Table**:
   - Currently empty (0 rows)
   - May be for future feature
   - Verify before implementing frontend logic

### Testing Scenarios

1. **Unique Constraint Violations**:
   - Attempt to add duplicate email/phone
   - Verify error handling in UI

2. **Multi-Primary Emails**:
   - Ensure only one email per customer has `is_primary = true`
   - Test toggling primary email

3. **Orphaned Records**:
   - Delete customer and verify cascade to related tables
   - Check RLS policies prevent access to deleted customer data

4. **Organization Scoping**:
   - Test cross-organization data access attempts
   - Verify RLS policies block unauthorized reads/writes

5. **Sales Total Calculations**:
   - Verify `total_price = quantity * unit_price`
   - Test decimal quantity edge cases

---

## Verification Commands

### List All Customer-Related Tables

```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'customer%' ORDER BY tablename;\""
```

### Check Table Existence

```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'customers');\""
```

### Describe Table Structure

```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"\\d+ customers\""
```

### Get Foreign Keys

```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name FROM information_schema.table_constraints AS tc JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'customers';\""
```

### Get Indexes

```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'customers';\""
```

---

## Related Documentation

- **Backend Change Protocol**: See CLAUDE.md for backend modification requirements
- **Supabase Verification Guide**: `.roo/rules/SUPABASE_DATABASE_VERIFICATION.md`
- **Backend Integration**: `BACKEND_INTEGRATION_GUIDE.md`
- **Migration Vision**: `vision.md`
- **Workflow Documentation**: `workflows.md`

---

## Recommendations for Backend Team

### Schema Improvements

1. **Add Indexes**:
   ```sql
   CREATE INDEX idx_customer_email_customer_id ON customer_email(customer_id);
   CREATE INDEX idx_customer_phone_customer_id ON customer_phone(customer_id);
   CREATE INDEX idx_customer_address_customer_id ON customer_address(customer_id);
   CREATE INDEX idx_customers_organization_id ON customers(organization_id);
   ```

2. **Fix Data Types**:
   ```sql
   ALTER TABLE customer_contacts ALTER COLUMN is_primary TYPE boolean USING is_primary::boolean;
   ```

3. **Standardize Enum**:
   ```sql
   -- Remove lowercase 'prospect' variant
   -- Standardize all values to uppercase
   ```

4. **Add Missing Fields**:
   ```sql
   ALTER TABLE customer_address ADD COLUMN is_primary boolean DEFAULT false;
   ```

5. **Relax Unique Constraints** (if business rules allow):
   ```sql
   -- Consider changing to composite unique constraints
   -- DROP CONSTRAINT uq_customer_email_email;
   -- CREATE UNIQUE INDEX uq_customer_email ON customer_email(customer_id, email);
   ```

### RLS Policies Needed

1. `customers`: Filter by `organization_id` matching user's organization
2. `customer_email`: Allow if linked `customer.organization_id` matches
3. `customer_phone`: Allow if linked `customer.organization_id` matches
4. `customer_address`: Allow if linked `customer.organization_id` matches
5. `customer_contacts`: Allow if linked `customer.organization_id` matches
6. `customer_sales`: Filter by `organization_id` matching user's organization

### API Endpoints Required

See `api-contracts.md` (to be created) for detailed specifications.

---

**Document Version**: 1.0
**Last Updated**: 2026-01-10
**Author**: Claude Code (Automated Schema Investigation)
**Status**: Complete - Ready for Review
