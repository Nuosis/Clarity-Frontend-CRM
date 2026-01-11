# Financial Records - Data Model Mapping

## Overview

This document maps FileMaker's `devRecords` (also known as `dapiRecords`) layout to Supabase's `customer_sales` table structure, including field transformations, data type conversions, and business logic for migration.

---

## Table Mapping

**Source:** FileMaker layout `devRecords` / `dapiRecords`
**Target:** Supabase table `customer_sales`

---

## Field Mappings

### Primary Fields

| FileMaker Field | Supabase Column | Type | Transform | Notes |
|-----------------|-----------------|------|-----------|-------|
| `__ID` | `financial_id` | UUID | Direct | Unique identifier, used as correlation key between systems |
| *(auto-generated)* | `id` | UUID | Generated | Supabase primary key (auto-generated, different from financial_id) |
| `_custID` | `customer_id` | UUID | Lookup/Create | Foreign key to `customers.id`, lookup by `business_name` |
| `_projectID` | *(not stored)* | - | Derived | Project context derived from product_name; not directly stored |
| `DateStart` | `date` | DATE | Format Conversion | MM/DD/YYYY → YYYY-MM-DD |
| `Billable_Time_Rounded` | `quantity` | NUMERIC(10,2) | parseFloat() | Hours worked (decimal, 2 places) |
| `Hourly_Rate` or `Customers::chargeRate` | `unit_price` | NUMERIC(10,2) | parseFloat() | Billing rate per hour |
| *(calculated)* | `total_price` | NUMERIC(10,2) | quantity × unit_price | Total billing amount (computed) |
| `Customers::Name` + `customers_Projects::projectName` | `product_name` | TEXT | Format Function | `{CAPS}:{WORD}` format |
| *(not in FM)* | `product_id` | UUID | NULL | Optional link to products table (future use) |
| *(organization context)* | `organization_id` | UUID | From Session | Multi-tenant isolation (RLS) |
| `f_billed` | *(implied by inv_id)* | - | Conditional Mapping | f_billed=1 → inv_id='MIGRATED', f_billed=0 → inv_id=NULL |
| `~creationTimestamp` | `created_at` | TIMESTAMPTZ | Direct | Record creation timestamp |
| `~ModificationTimestamp` | `updated_at` | TIMESTAMPTZ | Direct | Last update timestamp |
| *(QuickBooks sync)* | `inv_id` | TEXT | NULL or QB ID | QuickBooks invoice ID (NULL=unbilled, value=billed) |
| *(not in FM)* | `configuration_data` | JSONB | NULL | Product-specific configuration (future extensibility) |
| `Work Performed` | *(not stored)* | - | Omitted | Work description not stored in customer_sales (stored in time_entries?) |
| `Tasks::task` | *(not stored)* | - | Omitted | Task name not stored in customer_sales (stored in time_entries?) |

---

## Field Transformation Rules

### 1. Primary Key: `__ID` → `financial_id`

**FileMaker:** `__ID` (UUID, primary key in devRecords)
**Supabase:** `financial_id` (UUID, unique constraint)

**Mapping:**
- Direct copy of `__ID` value
- Used as correlation key for sync operations
- Supabase also generates separate `id` (primary key) for internal use

**Migration Rule:**
```sql
-- Unique constraint to prevent duplicates
ALTER TABLE customer_sales ADD CONSTRAINT customer_sales_financial_id_key UNIQUE (financial_id);
```

**Sync Logic:**
- Compare records by `financial_id` to identify changes (toCreate, toUpdate, toDelete)

---

### 2. Customer Reference: `_custID` → `customer_id`

**FileMaker:** `_custID` (UUID, foreign key to Customers table)
**Supabase:** `customer_id` (UUID, foreign key to `customers.id`)

**Mapping Challenge:** FileMaker uses internal customer IDs that don't match Supabase UUIDs.

**Migration Strategy:**

1. **Lookup by Business Name:**
   ```javascript
   const customerName = devRecord['Customers::Name'];
   const { data, error } = await supabase
       .from('customers')
       .select('id')
       .eq('business_name', customerName)
       .eq('organization_id', organizationId)
       .single();

   if (data) {
       customerId = data.id;
   }
   ```

2. **Create if Not Found:**
   ```javascript
   if (!data) {
       const { data: newCustomer, error } = await supabase
           .from('customers')
           .insert({
               business_name: customerName,
               type: 'CUSTOMER',
               organization_id: organizationId
           })
           .select('id')
           .single();

       customerId = newCustomer.id;
   }
   ```

3. **Link to Organization:**
   ```javascript
   await supabase
       .from('customer_organization')
       .insert({
           customer_id: customerId,
           organization_id: organizationId
       });
   ```

**Foreign Key Constraint:**
```sql
ALTER TABLE customer_sales
ADD CONSTRAINT customer_sales_customer_id_fkey
FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
```

---

### 3. Date Field: `DateStart` → `date`

**FileMaker:** `DateStart` (TEXT, format MM/DD/YYYY)
**Supabase:** `date` (DATE, format YYYY-MM-DD)

**Transformation Function:**
```javascript
function convertDateFormat(dateString) {
    // Input: "01/15/2026"
    // Output: "2026-01-15"

    if (!dateString || dateString === '') return null;

    const parts = dateString.split('/');
    if (parts.length !== 3) return null;

    const month = parts[0].padStart(2, '0');
    const day = parts[1].padStart(2, '0');
    const year = parts[2];

    return `${year}-${month}-${day}`;
}
```

**Examples:**
- `"01/15/2026"` → `"2026-01-15"`
- `"12/01/2025"` → `"2025-12-01"`
- `"5/3/2026"` → `"2026-05-03"`

**Validation:**
- Reject invalid dates (e.g., "13/01/2026")
- Reject empty or null dates (skip record or use current date)

---

### 4. Numeric Fields: Hours & Rates

#### Hours: `Billable_Time_Rounded` → `quantity`

**FileMaker:** `Billable_Time_Rounded` (NUMBER, decimal)
**Supabase:** `quantity` (NUMERIC(10,2), decimal)

**Transformation:**
```javascript
const quantity = parseFloat(devRecord.Billable_Time_Rounded || 0);
// Round to 2 decimal places for consistency
const roundedQuantity = Math.round(quantity * 100) / 100;
```

**Validation:**
- Reject negative hours
- Warn if hours > 24 (likely data entry error)
- Default to 0 if missing or invalid

#### Rate: `Hourly_Rate` / `Customers::chargeRate` → `unit_price`

**FileMaker:** `Hourly_Rate` (NUMBER) or `Customers::chargeRate` (NUMBER, fallback)
**Supabase:** `unit_price` (NUMERIC(10,2), decimal)

**Transformation:**
```javascript
const unitPrice = parseFloat(
    devRecord.Hourly_Rate ||
    devRecord['Customers::chargeRate'] ||
    0
);
// Round to 2 decimal places
const roundedUnitPrice = Math.round(unitPrice * 100) / 100;
```

**Business Rule:** Prefer task-specific `Hourly_Rate` over customer default `chargeRate`.

#### Total: *(calculated)* → `total_price`

**FileMaker:** Not explicitly stored (calculated on the fly)
**Supabase:** `total_price` (NUMERIC(10,2), stored)

**Calculation:**
```javascript
const totalPrice = quantity * unitPrice;
// Round to 2 decimal places
const roundedTotalPrice = Math.round(totalPrice * 100) / 100;
```

**Validation:**
- Must equal `quantity × unit_price` (enforce with trigger or constraint)
- Never negative (both quantity and unit_price must be >= 0)

**Database Trigger (Optional):**
```sql
CREATE OR REPLACE FUNCTION calculate_total_price()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_price := ROUND((NEW.quantity * NEW.unit_price)::NUMERIC, 2);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customer_sales_calculate_total
BEFORE INSERT OR UPDATE ON customer_sales
FOR EACH ROW
EXECUTE FUNCTION calculate_total_price();
```

---

### 5. Product Name: `Customers::Name` + `customers_Projects::projectName` → `product_name`

**FileMaker:** Two related fields via relationships
- `Customers::Name` - Customer business name
- `customers_Projects::projectName` - Project name

**Supabase:** `product_name` (TEXT, single field)

**Formatting Rule:**
```javascript
function formatProductName(customerName, projectName) {
    // Step 1: Extract capital letters and numbers from customer name
    const customerCaps = customerName.replace(/[^A-Z0-9]/g, '').trim();

    // Step 2: Get first word of project name
    const projectFirstWord = projectName.split(' ')[0];

    // Step 3: Combine with colon separator
    return `${customerCaps}:${projectFirstWord}`;
}
```

**Examples:**

| Customer Name | Project Name | product_name |
|---------------|--------------|--------------|
| Clarity Business Solutions | Development Work | CLARITYBUSINESS:Development |
| ABC Corporation | Website Redesign Project | ABCCORPORATION:Website |
| Smith & Co. | Marketing Campaign | SMITHCO:Marketing |
| 123 Industries | Server Maintenance | 123INDUSTRIES:Server |

**Limitations:**
- Ambiguity if multiple projects start with same word
- No reverse mapping from product_name to specific project_id
- Information loss (full project name not preserved)

**Recommendation:** Store `project_id` as separate field in future schema enhancement.

---

### 6. Billed Status: `f_billed` → `inv_id`

**FileMaker:** `f_billed` (NUMBER, 0 or 1)
- `0` = Unbilled
- `1` = Billed (invoice generated)

**Supabase:** `inv_id` (TEXT, nullable)
- `NULL` = Unbilled
- `'MIGRATED'` = Billed (migrated from FileMaker)
- `'QB-12345'` = Billed (QuickBooks invoice ID)

**Mapping Logic:**
```javascript
function mapBilledStatus(fBilledValue) {
    if (fBilledValue === '1' || fBilledValue === 1 || fBilledValue === true) {
        return 'MIGRATED'; // Preserve billed status from FileMaker
    } else {
        return null; // Unbilled
    }
}
```

**Query Pattern:**
```sql
-- Get unbilled records
SELECT * FROM customer_sales WHERE inv_id IS NULL;

-- Get billed records
SELECT * FROM customer_sales WHERE inv_id IS NOT NULL;

-- Get QuickBooks-synced records
SELECT * FROM customer_sales WHERE inv_id LIKE 'QB-%';

-- Get migrated billed records
SELECT * FROM customer_sales WHERE inv_id = 'MIGRATED';
```

**Migration Consideration:**
- Historical billed records retain `inv_id = 'MIGRATED'` to distinguish from QuickBooks-generated invoices
- Future QuickBooks syncs update `inv_id` with actual QB invoice ID (e.g., `'QB-12345'`)

---

### 7. Organization Context: *(implicit)* → `organization_id`

**FileMaker:** Organization context implicit in database instance
**Supabase:** `organization_id` (UUID, explicit foreign key)

**Source:** User session context at time of sync/creation
```javascript
const organizationId = currentUser.organizationId;
```

**Foreign Key Constraint:**
```sql
ALTER TABLE customer_sales
ADD CONSTRAINT customer_sales_organization_id_fkey
FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
```

**RLS Policy:**
```sql
-- Users can only see records for their organization
CREATE POLICY customer_sales_org_isolation ON customer_sales
FOR SELECT USING (organization_id = auth.jwt() ->> 'organization_id');
```

---

### 8. Timestamps: `~creationTimestamp` / `~modificationTimestamp` → `created_at` / `updated_at`

**FileMaker:**
- `~creationTimestamp` (TIMESTAMP, auto-generated on create)
- `~modificationTimestamp` (TIMESTAMP, auto-updated on modify)

**Supabase:**
- `created_at` (TIMESTAMPTZ, default NOW())
- `updated_at` (TIMESTAMPTZ, trigger-updated)

**Mapping:**
- Preserve original timestamps during migration
- For new records, use Supabase defaults

**Migration Logic:**
```javascript
const record = {
    // ... other fields
    created_at: devRecord['~creationTimestamp'] || new Date().toISOString(),
    updated_at: devRecord['~modificationTimestamp'] || new Date().toISOString()
};
```

**Database Trigger:**
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customer_sales_updated_at
BEFORE UPDATE ON customer_sales
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

---

## Fields Not Mapped

### Fields in FileMaker but NOT in Supabase

| FileMaker Field | Reason Not Mapped | Alternative Storage |
|-----------------|-------------------|---------------------|
| `_projectID` | Redundant (derived from product_name) | Consider adding in schema enhancement |
| `Work Performed` | Belongs in time_entries table | Store in related time_entries record |
| `Tasks::task` | Belongs in time_entries table | Store in related time_entries record |
| `month` | Computed from DateStart | Extract from `date` field via SQL |
| `year` | Computed from DateStart | Extract from `date` field via SQL |

**SQL Extraction Example:**
```sql
-- Extract month and year from date field
SELECT
    EXTRACT(MONTH FROM date) AS month,
    EXTRACT(YEAR FROM date) AS year
FROM customer_sales;
```

### Fields in Supabase but NOT in FileMaker

| Supabase Column | Purpose | Default Value |
|-----------------|---------|---------------|
| `id` | Primary key (auto-generated) | UUID (auto) |
| `product_id` | Optional link to products table | NULL |
| `configuration_data` | Product-specific config (JSON) | NULL |

---

## Schema Enhancement Recommendations

### 1. Add `project_id` Column

**Problem:** Project context lost in product_name formatting.

**Solution:**
```sql
ALTER TABLE customer_sales ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX idx_customer_sales_project ON customer_sales(project_id);
```

**Benefit:** Direct queries by project, better audit trail.

---

### 2. Create Separate `time_entries` Table

**Problem:** Work description and task name not stored in customer_sales.

**Solution:**
```sql
CREATE TABLE time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_sale_id UUID REFERENCES customer_sales(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    work_performed TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Benefit:** Preserve detailed work logs, link financial records to tasks.

---

### 3. Enforce Data Integrity with Check Constraints

```sql
-- Ensure quantity is non-negative
ALTER TABLE customer_sales ADD CONSTRAINT customer_sales_quantity_positive CHECK (quantity >= 0);

-- Ensure unit_price is non-negative
ALTER TABLE customer_sales ADD CONSTRAINT customer_sales_unit_price_positive CHECK (unit_price >= 0);

-- Ensure total_price matches quantity × unit_price
ALTER TABLE customer_sales ADD CONSTRAINT customer_sales_total_price_valid
CHECK (ABS(total_price - (quantity * unit_price)) < 0.01);
```

---

## Migration Data Validation

### Validation Rules

1. **Required Fields:**
   - `financial_id` (unique, not null)
   - `organization_id` (not null, valid FK)
   - `customer_id` (not null, valid FK)
   - `date` (not null, valid date)
   - `quantity` (not null, >= 0)
   - `unit_price` (not null, >= 0)
   - `total_price` (not null, equals quantity × unit_price)

2. **Optional Fields:**
   - `product_id` (nullable, valid FK if present)
   - `inv_id` (nullable)
   - `configuration_data` (nullable)

3. **Computed Fields:**
   - `id` (auto-generated by Supabase)
   - `created_at` (default NOW() or migrated timestamp)
   - `updated_at` (default NOW() or migrated timestamp)

### Validation Script

```javascript
function validateRecord(record) {
    const errors = [];

    // Required fields
    if (!record.financial_id) errors.push('financial_id is required');
    if (!record.organization_id) errors.push('organization_id is required');
    if (!record.customer_id) errors.push('customer_id is required');
    if (!record.date) errors.push('date is required');
    if (record.quantity == null) errors.push('quantity is required');
    if (record.unit_price == null) errors.push('unit_price is required');
    if (record.total_price == null) errors.push('total_price is required');

    // Numeric constraints
    if (record.quantity < 0) errors.push('quantity must be non-negative');
    if (record.unit_price < 0) errors.push('unit_price must be non-negative');

    // Total price validation
    const expectedTotal = Math.round((record.quantity * record.unit_price) * 100) / 100;
    const actualTotal = Math.round(record.total_price * 100) / 100;
    if (Math.abs(expectedTotal - actualTotal) > 0.01) {
        errors.push(`total_price mismatch: expected ${expectedTotal}, got ${actualTotal}`);
    }

    return errors;
}
```

---

## Indexes for Performance

### Recommended Indexes

```sql
-- Primary key (auto-created)
CREATE UNIQUE INDEX customer_sales_pkey ON customer_sales(id);

-- Unique constraint on financial_id (correlation key)
CREATE UNIQUE INDEX customer_sales_financial_id_key ON customer_sales(financial_id);

-- Query by organization + date range (most common query)
CREATE INDEX idx_customer_sales_org_date ON customer_sales(organization_id, date DESC);

-- Query by customer + date range
CREATE INDEX idx_customer_sales_customer_date ON customer_sales(customer_id, date DESC);

-- Query unbilled records (WHERE inv_id IS NULL)
CREATE INDEX idx_customer_sales_unbilled ON customer_sales(organization_id) WHERE inv_id IS NULL;

-- Query by date range only (for reports)
CREATE INDEX idx_customer_sales_date_range ON customer_sales(date DESC) WHERE inv_id IS NULL;

-- Foreign key indexes (for join performance)
CREATE INDEX idx_customer_sales_customer_id ON customer_sales(customer_id);
CREATE INDEX idx_customer_sales_organization_id ON customer_sales(organization_id);
```

---

## Summary

**Total Fields Mapped:** 13 core fields
**Fields Transformed:** 8 (date, numeric, product_name, billed status, etc.)
**Fields Omitted:** 4 (work_performed, task name, computed month/year, project_id)
**Schema Enhancements Recommended:** 3 (project_id, time_entries table, check constraints)

**Migration Complexity:** Medium
- Requires customer lookup/creation logic
- Date format conversion
- Product name formatting
- Billed status conditional mapping
- Decimal precision handling

---

**Document Version:** 1.0
**Last Updated:** 2026-01-11
**Status:** Phase 1 Requirements Documentation
