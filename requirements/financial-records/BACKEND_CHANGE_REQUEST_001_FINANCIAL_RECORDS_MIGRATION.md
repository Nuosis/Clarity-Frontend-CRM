# Backend Change Request: Financial Records Migration

**Request ID:** BACKEND_CHANGE_REQUEST_001_FINANCIAL_RECORDS_MIGRATION
**Date:** 2026-01-10
**Requester:** Frontend Team (via Claude)
**Priority:** High
**Target Release:** Q1 2026

---

## Executive Summary

This change request outlines the backend infrastructure changes required to migrate financial records (customer billing/sales) from FileMaker to Supabase as the single source of truth.

**Impact:**
- **Database:** New RPC functions, indexes, and migration script
- **API:** No REST endpoint changes (using Supabase RPC)
- **Performance:** Improved query performance with proper indexing
- **Data Volume:** ~50,000 historical records to migrate (estimate)

**Dependencies:**
- Customer migration must be complete (`customers` table populated)
- Organization structure must be stable
- `customer_sales` table already exists (verified)

---

## Table of Contents

1. [Database Schema Changes](#database-schema-changes)
2. [RPC Functions](#rpc-functions)
3. [Indexes](#indexes)
4. [Migration Script](#migration-script)
5. [Testing Requirements](#testing-requirements)
6. [Rollback Plan](#rollback-plan)
7. [Performance Considerations](#performance-considerations)

---

## Database Schema Changes

### No Schema Changes Required

The `customer_sales` table already exists with the correct structure:

```sql
-- Verified schema (no changes needed)
Table: customer_sales
Columns:
  - id: UUID (PK)
  - financial_id: UUID (UNIQUE) -- Maps to FileMaker __ID
  - customer_id: UUID (FK → customers.id)
  - product_id: UUID (FK → products.id, nullable)
  - product_name: TEXT (NOT NULL)
  - quantity: NUMERIC (NOT NULL) -- Hours worked
  - unit_price: NUMERIC (NOT NULL) -- Hourly rate
  - total_price: NUMERIC (NOT NULL) -- Calculated: quantity × unit_price
  - date: DATE (NOT NULL)
  - inv_id: TEXT (nullable) -- QuickBooks invoice ID
  - organization_id: UUID (FK → organizations.id)
  - created_at: TIMESTAMPTZ (default: NOW())
  - updated_at: TIMESTAMPTZ (default: NOW())
  - configuration_data: JSONB (nullable)

Existing Indexes:
  - customer_sales_pkey (id)
  - customer_sales_financial_id_key (financial_id UNIQUE)
  - idx_customer_sales_workflow_status (configuration_data ->> 'workflow_status')

Existing Constraints:
  - FK: customer_id → customers(id)
  - FK: organization_id → organizations(id)
  - FK: product_id → products(id)
```

**Action:** None required - schema is already correct.

---

## RPC Functions

### 1. `get_financial_records` - Query with Filters

**Purpose:** Retrieve financial records by date range, customer, organization, and billing status.

**SQL:**
```sql
CREATE OR REPLACE FUNCTION get_financial_records(
  p_organization_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL,
  p_billed_only BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  financial_id UUID,
  customer_id UUID,
  customer_name TEXT,
  product_id UUID,
  product_name TEXT,
  quantity NUMERIC,
  unit_price NUMERIC,
  total_price NUMERIC,
  date DATE,
  inv_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.id,
    cs.financial_id,
    cs.customer_id,
    c.business_name AS customer_name,
    cs.product_id,
    cs.product_name,
    cs.quantity,
    cs.unit_price,
    cs.total_price,
    cs.date,
    cs.inv_id,
    cs.created_at,
    cs.updated_at
  FROM customer_sales cs
  INNER JOIN customers c ON cs.customer_id = c.id
  WHERE cs.organization_id = p_organization_id
    AND (p_start_date IS NULL OR cs.date >= p_start_date)
    AND (p_end_date IS NULL OR cs.date <= p_end_date)
    AND (p_customer_id IS NULL OR cs.customer_id = p_customer_id)
    AND (
      p_billed_only IS NULL
      OR (p_billed_only = TRUE AND cs.inv_id IS NOT NULL)
      OR (p_billed_only = FALSE AND cs.inv_id IS NULL)
    )
  ORDER BY cs.date DESC, cs.created_at DESC;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_financial_records TO authenticated;
```

**Usage Example:**
```javascript
// Get all unbilled records for organization in date range
const { data, error } = await supabase.rpc('get_financial_records', {
  p_organization_id: '123e4567-e89b-12d3-a456-426614174000',
  p_start_date: '2026-01-01',
  p_end_date: '2026-01-31',
  p_billed_only: false
});
```

---

### 2. `get_unpaid_records` - Unbilled Records Query

**Purpose:** Get all unbilled financial records for an organization or customer.

**SQL:**
```sql
CREATE OR REPLACE FUNCTION get_unpaid_records(
  p_organization_id UUID,
  p_customer_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  financial_id UUID,
  customer_id UUID,
  customer_name TEXT,
  product_name TEXT,
  quantity NUMERIC,
  unit_price NUMERIC,
  total_price NUMERIC,
  date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.id,
    cs.financial_id,
    cs.customer_id,
    c.business_name AS customer_name,
    cs.product_name,
    cs.quantity,
    cs.unit_price,
    cs.total_price,
    cs.date
  FROM customer_sales cs
  INNER JOIN customers c ON cs.customer_id = c.id
  WHERE cs.organization_id = p_organization_id
    AND cs.inv_id IS NULL
    AND (p_customer_id IS NULL OR cs.customer_id = p_customer_id)
  ORDER BY cs.date DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_unpaid_records TO authenticated;
```

---

### 3. `get_monthly_summary` - Monthly Aggregations

**Purpose:** Aggregate financial records by month for reporting and charting.

**SQL:**
```sql
CREATE OR REPLACE FUNCTION get_monthly_summary(
  p_organization_id UUID,
  p_year INT,
  p_customer_id UUID DEFAULT NULL
)
RETURNS TABLE (
  month INT,
  year INT,
  total_hours NUMERIC,
  total_amount NUMERIC,
  billed_amount NUMERIC,
  unbilled_amount NUMERIC,
  record_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXTRACT(MONTH FROM cs.date)::INT AS month,
    EXTRACT(YEAR FROM cs.date)::INT AS year,
    COALESCE(SUM(cs.quantity), 0) AS total_hours,
    COALESCE(SUM(cs.total_price), 0) AS total_amount,
    COALESCE(SUM(CASE WHEN cs.inv_id IS NOT NULL THEN cs.total_price ELSE 0 END), 0) AS billed_amount,
    COALESCE(SUM(CASE WHEN cs.inv_id IS NULL THEN cs.total_price ELSE 0 END), 0) AS unbilled_amount,
    COUNT(*)::INT AS record_count
  FROM customer_sales cs
  WHERE cs.organization_id = p_organization_id
    AND EXTRACT(YEAR FROM cs.date) = p_year
    AND (p_customer_id IS NULL OR cs.customer_id = p_customer_id)
  GROUP BY EXTRACT(MONTH FROM cs.date), EXTRACT(YEAR FROM cs.date)
  ORDER BY month;
END;
$$;

GRANT EXECUTE ON FUNCTION get_monthly_summary TO authenticated;
```

---

### 4. `get_quarterly_summary` - Quarterly Aggregations

**Purpose:** Aggregate financial records by quarter for reporting.

**SQL:**
```sql
CREATE OR REPLACE FUNCTION get_quarterly_summary(
  p_organization_id UUID,
  p_year INT,
  p_quarter INT,
  p_customer_id UUID DEFAULT NULL
)
RETURNS TABLE (
  quarter INT,
  year INT,
  total_hours NUMERIC,
  total_amount NUMERIC,
  billed_amount NUMERIC,
  unbilled_amount NUMERIC,
  record_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    CEIL(EXTRACT(MONTH FROM cs.date) / 3.0)::INT AS quarter,
    EXTRACT(YEAR FROM cs.date)::INT AS year,
    COALESCE(SUM(cs.quantity), 0) AS total_hours,
    COALESCE(SUM(cs.total_price), 0) AS total_amount,
    COALESCE(SUM(CASE WHEN cs.inv_id IS NOT NULL THEN cs.total_price ELSE 0 END), 0) AS billed_amount,
    COALESCE(SUM(CASE WHEN cs.inv_id IS NULL THEN cs.total_price ELSE 0 END), 0) AS unbilled_amount,
    COUNT(*)::INT AS record_count
  FROM customer_sales cs
  WHERE cs.organization_id = p_organization_id
    AND EXTRACT(YEAR FROM cs.date) = p_year
    AND CEIL(EXTRACT(MONTH FROM cs.date) / 3.0) = p_quarter
    AND (p_customer_id IS NULL OR cs.customer_id = p_customer_id)
  GROUP BY quarter, year;
END;
$$;

GRANT EXECUTE ON FUNCTION get_quarterly_summary TO authenticated;
```

---

### 5. `create_financial_record` - Create New Record

**Purpose:** Create a new financial record (e.g., from timer stop).

**SQL:**
```sql
CREATE OR REPLACE FUNCTION create_financial_record(
  p_financial_id UUID,
  p_organization_id UUID,
  p_customer_id UUID,
  p_product_name TEXT,
  p_quantity NUMERIC,
  p_unit_price NUMERIC,
  p_date DATE,
  p_product_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record_id UUID;
  v_total_price NUMERIC;
BEGIN
  -- Calculate total price
  v_total_price := ROUND((p_quantity * p_unit_price)::NUMERIC, 2);

  -- Validate inputs
  IF p_financial_id IS NULL THEN
    RAISE EXCEPTION 'financial_id is required';
  END IF;

  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required';
  END IF;

  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'customer_id is required';
  END IF;

  IF p_product_name IS NULL OR p_product_name = '' THEN
    RAISE EXCEPTION 'product_name is required';
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'quantity must be greater than 0';
  END IF;

  IF p_unit_price < 0 THEN
    RAISE EXCEPTION 'unit_price cannot be negative';
  END IF;

  -- Insert record
  INSERT INTO customer_sales (
    financial_id,
    organization_id,
    customer_id,
    product_id,
    product_name,
    quantity,
    unit_price,
    total_price,
    date
  ) VALUES (
    p_financial_id,
    p_organization_id,
    p_customer_id,
    p_product_id,
    p_product_name,
    p_quantity,
    p_unit_price,
    v_total_price,
    p_date
  )
  RETURNING id INTO v_record_id;

  RETURN v_record_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_financial_record TO authenticated;
```

---

### 6. `mark_records_billed` - Bulk Billing Update

**Purpose:** Mark multiple records as billed by setting invoice ID.

**SQL:**
```sql
CREATE OR REPLACE FUNCTION mark_records_billed(
  p_record_ids UUID[],
  p_invoice_id TEXT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INT;
BEGIN
  -- Validate inputs
  IF p_record_ids IS NULL OR array_length(p_record_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'record_ids array is required and cannot be empty';
  END IF;

  IF p_invoice_id IS NULL OR p_invoice_id = '' THEN
    RAISE EXCEPTION 'invoice_id is required';
  END IF;

  -- Update records
  UPDATE customer_sales
  SET inv_id = p_invoice_id,
      updated_at = NOW()
  WHERE id = ANY(p_record_ids);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN v_updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_records_billed TO authenticated;
```

---

### 7. `get_yearly_summary` - Yearly Aggregations

**Purpose:** Aggregate financial records by year for annual reporting.

**SQL:**
```sql
CREATE OR REPLACE FUNCTION get_yearly_summary(
  p_organization_id UUID,
  p_year INT,
  p_customer_id UUID DEFAULT NULL
)
RETURNS TABLE (
  year INT,
  total_hours NUMERIC,
  total_amount NUMERIC,
  billed_amount NUMERIC,
  unbilled_amount NUMERIC,
  record_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXTRACT(YEAR FROM cs.date)::INT AS year,
    COALESCE(SUM(cs.quantity), 0) AS total_hours,
    COALESCE(SUM(cs.total_price), 0) AS total_amount,
    COALESCE(SUM(CASE WHEN cs.inv_id IS NOT NULL THEN cs.total_price ELSE 0 END), 0) AS billed_amount,
    COALESCE(SUM(CASE WHEN cs.inv_id IS NULL THEN cs.total_price ELSE 0 END), 0) AS unbilled_amount,
    COUNT(*)::INT AS record_count
  FROM customer_sales cs
  WHERE cs.organization_id = p_organization_id
    AND EXTRACT(YEAR FROM cs.date) = p_year
    AND (p_customer_id IS NULL OR cs.customer_id = p_customer_id)
  GROUP BY EXTRACT(YEAR FROM cs.date);
END;
$$;

GRANT EXECUTE ON FUNCTION get_yearly_summary TO authenticated;
```

---

## Indexes

### New Indexes for Performance

```sql
-- Index for organization + date range queries (most common)
CREATE INDEX IF NOT EXISTS idx_customer_sales_org_date
  ON customer_sales(organization_id, date DESC)
  WHERE date IS NOT NULL;

-- Index for customer-specific queries
CREATE INDEX IF NOT EXISTS idx_customer_sales_customer_date
  ON customer_sales(customer_id, date DESC)
  WHERE date IS NOT NULL;

-- Index for unbilled records queries
CREATE INDEX IF NOT EXISTS idx_customer_sales_unbilled
  ON customer_sales(organization_id, date DESC)
  WHERE inv_id IS NULL;

-- Index for date-based filtering (supports monthly/quarterly aggregations)
CREATE INDEX IF NOT EXISTS idx_customer_sales_date_month_year
  ON customer_sales(
    EXTRACT(YEAR FROM date),
    EXTRACT(MONTH FROM date),
    organization_id
  );

-- Index for financial_id lookups (used during migration reconciliation)
-- NOTE: Already exists as UNIQUE constraint: customer_sales_financial_id_key
-- No action needed

-- Composite index for customer + billing status queries
CREATE INDEX IF NOT EXISTS idx_customer_sales_customer_billed
  ON customer_sales(customer_id, (inv_id IS NOT NULL))
  INCLUDE (date, total_price);
```

**Estimated Index Sizes:**
- Assuming 50,000 records, total index overhead: ~5-10 MB
- Query performance improvement: 10-100x for date range queries

---

## Migration Script

### Historical Data Migration from FileMaker

**Script:** `migrate_financial_records.sql`

```sql
-- Migration script to import historical financial records from FileMaker
-- This script assumes a temporary staging table has been populated with FileMaker data

-- Step 1: Create staging table
CREATE TEMP TABLE IF NOT EXISTS temp_filemaker_records (
  fm_id UUID,                    -- FileMaker __ID
  fm_customer_id TEXT,           -- FileMaker _custID
  fm_project_id TEXT,            -- FileMaker _projectID
  fm_date TEXT,                  -- FileMaker DateStart (MM/DD/YYYY format)
  fm_hours NUMERIC,              -- FileMaker Billable_Time_Rounded
  fm_rate NUMERIC,               -- FileMaker Hourly_Rate
  fm_customer_name TEXT,         -- FileMaker Customers::Name
  fm_project_name TEXT,          -- FileMaker customers_Projects::projectName
  fm_billed INT,                 -- FileMaker f_billed (0 or 1)
  fm_work_performed TEXT,        -- FileMaker "Work Performed"
  fm_created_at TIMESTAMPTZ,     -- FileMaker ~creationTimestamp
  fm_modified_at TIMESTAMPTZ     -- FileMaker ~ModificationTimestamp
);

-- Step 2: Insert records into customer_sales (only if they don't already exist)
INSERT INTO customer_sales (
  financial_id,
  organization_id,
  customer_id,
  product_name,
  quantity,
  unit_price,
  total_price,
  date,
  inv_id,
  created_at,
  updated_at
)
SELECT
  fm.fm_id AS financial_id,
  '{{ORGANIZATION_ID}}' AS organization_id, -- Replace with actual organization ID
  c.id AS customer_id,
  -- Format product name: CUSTOMERCAPS:ProjectFirstWord
  (REGEXP_REPLACE(fm.fm_customer_name, '[^A-Z0-9]', '', 'g') || ':' || SPLIT_PART(fm.fm_project_name, ' ', 1)) AS product_name,
  fm.fm_hours AS quantity,
  fm.fm_rate AS unit_price,
  ROUND((fm.fm_hours * fm.fm_rate)::NUMERIC, 2) AS total_price,
  TO_DATE(fm.fm_date, 'MM/DD/YYYY') AS date,
  CASE WHEN fm.fm_billed = 1 THEN 'MIGRATED' ELSE NULL END AS inv_id,
  COALESCE(fm.fm_created_at, NOW()) AS created_at,
  COALESCE(fm.fm_modified_at, NOW()) AS updated_at
FROM temp_filemaker_records fm
LEFT JOIN customers c ON c.business_name = fm.fm_customer_name
WHERE fm.fm_id IS NOT NULL
  AND c.id IS NOT NULL -- Only migrate records with valid customer mapping
  AND NOT EXISTS (
    SELECT 1 FROM customer_sales cs WHERE cs.financial_id = fm.fm_id
  );

-- Step 3: Report migration results
SELECT
  (SELECT COUNT(*) FROM temp_filemaker_records) AS total_filemaker_records,
  (SELECT COUNT(*) FROM customer_sales WHERE financial_id IN (SELECT fm_id FROM temp_filemaker_records)) AS migrated_records,
  (SELECT COUNT(*) FROM temp_filemaker_records WHERE fm_id NOT IN (SELECT financial_id FROM customer_sales)) AS failed_records;

-- Step 4: Identify records that failed to migrate (for manual review)
SELECT
  fm.fm_id,
  fm.fm_customer_name,
  fm.fm_project_name,
  fm.fm_date,
  fm.fm_hours,
  fm.fm_rate,
  'Customer not found: ' || fm.fm_customer_name AS failure_reason
FROM temp_filemaker_records fm
LEFT JOIN customers c ON c.business_name = fm.fm_customer_name
WHERE c.id IS NULL;

-- Step 5: Clean up
DROP TABLE IF EXISTS temp_filemaker_records;
```

**Pre-Migration Validation:**
```sql
-- Verify customer mappings before migration
SELECT
  fm.fm_customer_name,
  COUNT(*) AS record_count,
  CASE WHEN c.id IS NOT NULL THEN 'MAPPED' ELSE 'MISSING' END AS mapping_status
FROM temp_filemaker_records fm
LEFT JOIN customers c ON c.business_name = fm.fm_customer_name
GROUP BY fm.fm_customer_name, c.id
ORDER BY record_count DESC;
```

---

## Testing Requirements

### Unit Tests

**Test Cases:**

1. **`get_financial_records`**
   - Test with valid organization_id
   - Test with date range filters
   - Test with customer_id filter
   - Test with billed_only = true/false
   - Test with no matching records (empty result)
   - Test with NULL date range (all records)

2. **`get_unpaid_records`**
   - Test unbilled records only
   - Test with customer filter
   - Test empty result

3. **`get_monthly_summary`**
   - Test aggregation correctness (sum of hours, amounts)
   - Test with multiple months
   - Test with customer filter

4. **`create_financial_record`**
   - Test successful creation
   - Test validation errors (NULL values)
   - Test negative quantity (should fail)
   - Test duplicate financial_id (should fail due to UNIQUE constraint)

5. **`mark_records_billed`**
   - Test bulk update
   - Test with empty array (should fail)
   - Test with non-existent record IDs (should succeed with 0 updated)

**SQL Test Script:**
```sql
-- Example unit test for get_financial_records
DO $$
DECLARE
  v_org_id UUID := '123e4567-e89b-12d3-a456-426614174000';
  v_result_count INT;
BEGIN
  -- Test 1: Get all records for organization
  SELECT COUNT(*) INTO v_result_count
  FROM get_financial_records(v_org_id, NULL, NULL, NULL, NULL);

  RAISE NOTICE 'Test 1: Found % records for organization', v_result_count;

  -- Test 2: Get unbilled records only
  SELECT COUNT(*) INTO v_result_count
  FROM get_financial_records(v_org_id, NULL, NULL, NULL, FALSE);

  RAISE NOTICE 'Test 2: Found % unbilled records', v_result_count;
END $$;
```

### Integration Tests

1. **End-to-End Record Creation**
   - Frontend calls `create_financial_record` RPC
   - Verify record exists in database
   - Verify all fields populated correctly

2. **Query Performance**
   - Load 10,000+ test records
   - Query by date range (1 year)
   - Measure execution time (target: < 2s)

3. **Migration Validation**
   - Migrate sample FileMaker dataset
   - Verify record count matches
   - Verify totals match (sum of hours, amounts)
   - Verify customer mappings correct

### Performance Tests

**Load Test Scenarios:**
```sql
-- Insert 10,000 test records
INSERT INTO customer_sales (
  financial_id, organization_id, customer_id, product_name,
  quantity, unit_price, total_price, date
)
SELECT
  gen_random_uuid(),
  '{{ORG_ID}}',
  (SELECT id FROM customers LIMIT 1 OFFSET (random() * 100)::int),
  'TEST:Record' || i,
  (random() * 10)::NUMERIC(10,2),
  100.00,
  (random() * 1000)::NUMERIC(10,2),
  CURRENT_DATE - (random() * 365)::int
FROM generate_series(1, 10000) AS i;

-- Test query performance
EXPLAIN ANALYZE
SELECT * FROM get_financial_records(
  '{{ORG_ID}}',
  CURRENT_DATE - INTERVAL '1 year',
  CURRENT_DATE,
  NULL,
  NULL
);
```

**Expected Results:**
- Query execution time: < 500ms for 10,000 records
- Index usage: Should use `idx_customer_sales_org_date`
- No sequential scans

---

## Rollback Plan

### Rollback Procedure

**If RPC functions fail in production:**

1. **Immediate Rollback:**
```sql
-- Drop problematic RPC functions
DROP FUNCTION IF EXISTS get_financial_records(UUID, DATE, DATE, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS get_unpaid_records(UUID, UUID);
DROP FUNCTION IF EXISTS get_monthly_summary(UUID, INT, UUID);
DROP FUNCTION IF EXISTS get_quarterly_summary(UUID, INT, INT, UUID);
DROP FUNCTION IF EXISTS get_yearly_summary(UUID, INT, UUID);
DROP FUNCTION IF EXISTS create_financial_record(UUID, UUID, UUID, TEXT, NUMERIC, NUMERIC, DATE, UUID);
DROP FUNCTION IF EXISTS mark_records_billed(UUID[], TEXT);

-- Drop new indexes
DROP INDEX IF EXISTS idx_customer_sales_org_date;
DROP INDEX IF EXISTS idx_customer_sales_customer_date;
DROP INDEX IF EXISTS idx_customer_sales_unbilled;
DROP INDEX IF EXISTS idx_customer_sales_date_month_year;
DROP INDEX IF EXISTS idx_customer_sales_customer_billed;
```

2. **Restore Backup:**
```sql
-- If data corruption occurred during migration
-- Restore customer_sales table from pre-migration backup
-- (Backup command to be run before migration):
-- pg_dump -U postgres -d postgres -t customer_sales --data-only > customer_sales_backup.sql

-- Restore:
TRUNCATE customer_sales CASCADE;
\i customer_sales_backup.sql
```

3. **Frontend Rollback:**
   - Revert frontend code to use FileMaker API
   - Re-enable `financialSyncService.js`
   - Notify users of temporary FileMaker dependency

**Rollback Testing:**
- Test rollback procedure on staging environment
- Verify backup restore completes successfully
- Confirm frontend can revert to FileMaker integration

---

## Performance Considerations

### Query Optimization

**Index Strategy:**
- Primary queries: Organization + Date range → Use `idx_customer_sales_org_date`
- Customer queries: Customer + Date → Use `idx_customer_sales_customer_date`
- Unbilled queries: Organization + NULL inv_id → Use `idx_customer_sales_unbilled`
- Aggregations: Extract date parts → Use `idx_customer_sales_date_month_year`

**Expected Query Plans:**
```
QUERY PLAN for get_financial_records (date range):
→ Index Scan using idx_customer_sales_org_date
  Filter: date >= '2026-01-01' AND date <= '2026-01-31'
  Rows: ~1000 (estimated for 1 month)
→ Nested Loop Join with customers table
  Execution Time: ~50ms
```

### Scaling Considerations

**Current Volume:** ~50,000 records (estimated)
**Growth Rate:** ~2,000 records/month
**5-Year Projection:** ~170,000 records

**Partitioning Strategy (if needed):**
```sql
-- Partition by year if table exceeds 500,000 records
CREATE TABLE customer_sales_2026 PARTITION OF customer_sales
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE TABLE customer_sales_2027 PARTITION OF customer_sales
  FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');
```

**Archival Strategy:**
- Archive records older than 7 years to separate table
- Maintain indexes only on active partitions

---

## Approval Checklist

Before approving this change request, verify:

- [ ] RPC functions reviewed and tested on staging
- [ ] Indexes created and query plans verified
- [ ] Migration script tested with sample data
- [ ] Rollback procedure tested and documented
- [ ] Performance benchmarks meet SLA (< 2s for queries)
- [ ] Security review completed (SECURITY DEFINER functions)
- [ ] Database backup scheduled before migration
- [ ] Frontend team notified of RPC function signatures
- [ ] Deployment window scheduled (low-traffic period)
- [ ] Monitoring alerts configured for new queries

---

## Deployment Steps

1. **Pre-Deployment (1 week before):**
   - Review and approve change request
   - Schedule deployment window (weekend preferred)
   - Notify frontend team of RPC availability date
   - Create database backup

2. **Deployment (Day of):**
   - **Step 1:** Create indexes (10 minutes)
   - **Step 2:** Create RPC functions (5 minutes)
   - **Step 3:** Test RPCs with sample queries (15 minutes)
   - **Step 4:** Run migration script for historical data (30-60 minutes)
   - **Step 5:** Validate migration results (15 minutes)
   - **Step 6:** Notify frontend team of completion

3. **Post-Deployment (1 week after):**
   - Monitor query performance metrics
   - Review slow query logs
   - Collect user feedback
   - Address any issues

**Estimated Downtime:** None (backward compatible)

---

## Questions & Clarifications

**Q1:** Should we set a default `organization_id` for historical records without organization context?
**A:** Yes, use the primary organization ID for all migrated records. Manual reassignment can be done later if needed.

**Q2:** How should we handle FileMaker records with missing customer IDs?
**A:** These records should be flagged for manual review and NOT migrated automatically. Create a report of failed migrations for data cleanup.

**Q3:** Should `create_financial_record` validate that the customer belongs to the organization?
**A:** Yes, add a check to ensure `customer_id` is linked to `organization_id` via `customer_organization` table.

**Updated `create_financial_record` with validation:**
```sql
-- Add validation check
IF NOT EXISTS (
  SELECT 1 FROM customer_organization co
  WHERE co.customer_id = p_customer_id
    AND co.organization_id = p_organization_id
) THEN
  RAISE EXCEPTION 'Customer % does not belong to organization %', p_customer_id, p_organization_id;
END IF;
```

---

## Contact

**Frontend Team Lead:** [Contact Info]
**Backend Team Lead:** [Contact Info]
**Database Administrator:** [Contact Info]

**Slack Channel:** #financial-records-migration

---

**Document Version:** 1.0
**Status:** Awaiting Backend Team Approval
**Last Updated:** 2026-01-10
