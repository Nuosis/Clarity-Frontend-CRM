# Financial Records - API Contracts

## Overview

This document defines the API contracts for financial records operations in the Supabase-backed system. All operations use Supabase RPC (Remote Procedure Call) functions for database interactions.

**Backend Type:** Supabase PostgreSQL RPC Functions
**Authentication:** Supabase JWT (via `auth.jwt()` in RLS policies)
**Authorization:** Organization-scoped via RLS policies

---

## Table of Contents

1. [Query Operations](#query-operations)
2. [Write Operations](#write-operations)
3. [Summary/Aggregation Operations](#summaryaggregation-operations)
4. [Error Handling](#error-handling)
5. [Frontend Integration Examples](#frontend-integration-examples)

---

## Query Operations

### 1. Get Financial Records (Filtered Query)

**RPC Function:** `get_financial_records`

**Purpose:** Retrieve financial records with flexible filtering by date range, customer, and billing status.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `p_organization_id` | UUID | Yes | - | Organization identifier (for RLS) |
| `p_start_date` | DATE | No | NULL | Start of date range (inclusive) |
| `p_end_date` | DATE | No | NULL | End of date range (inclusive) |
| `p_customer_id` | UUID | No | NULL | Filter by specific customer |
| `p_billed_only` | BOOLEAN | No | NULL | Filter by billing status (true=billed, false=unbilled, null=all) |

**Returns:** Table with columns:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Supabase primary key |
| `financial_id` | UUID | FileMaker correlation ID (unique) |
| `customer_id` | UUID | Customer foreign key |
| `customer_name` | TEXT | Customer business name (joined) |
| `product_id` | UUID | Product foreign key (nullable) |
| `product_name` | TEXT | Product/service name |
| `quantity` | NUMERIC | Hours worked (decimal) |
| `unit_price` | NUMERIC | Hourly rate |
| `total_price` | NUMERIC | Total amount (quantity × unit_price) |
| `date` | DATE | Record date |
| `inv_id` | TEXT | Invoice ID (NULL=unbilled) |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

**Ordering:** `date DESC, created_at DESC` (newest first)

**Frontend Usage:**

```javascript
// Get all unbilled records for organization in January 2026
const { data, error } = await supabase.rpc('get_financial_records', {
  p_organization_id: currentUser.organizationId,
  p_start_date: '2026-01-01',
  p_end_date: '2026-01-31',
  p_billed_only: false
});

if (error) throw error;
console.log(data); // Array of financial records
```

**Example Response:**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "financial_id": "550e8400-e29b-41d4-a716-446655440002",
    "customer_id": "550e8400-e29b-41d4-a716-446655440003",
    "customer_name": "Clarity Business Solutions",
    "product_id": null,
    "product_name": "CLARITYBUSINESS:Development",
    "quantity": 8.5,
    "unit_price": 150.00,
    "total_price": 1275.00,
    "date": "2026-01-15",
    "inv_id": null,
    "created_at": "2026-01-15T18:30:00Z",
    "updated_at": "2026-01-15T18:30:00Z"
  }
]
```

**Performance:** Indexed on `organization_id, date DESC` for fast queries.

---

### 2. Get Unpaid Records

**RPC Function:** `get_unpaid_records`

**Purpose:** Retrieve all unbilled financial records for invoicing.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `p_organization_id` | UUID | Yes | - | Organization identifier |
| `p_customer_id` | UUID | No | NULL | Filter by specific customer |

**Returns:** Table with columns:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Supabase primary key |
| `financial_id` | UUID | FileMaker correlation ID |
| `customer_id` | UUID | Customer foreign key |
| `customer_name` | TEXT | Customer business name |
| `product_name` | TEXT | Product/service name |
| `quantity` | NUMERIC | Hours worked |
| `unit_price` | NUMERIC | Hourly rate |
| `total_price` | NUMERIC | Total amount |
| `date` | DATE | Record date |

**Filter Logic:** `inv_id IS NULL` (unbilled records only)

**Ordering:** `date DESC` (newest first)

**Frontend Usage:**

```javascript
// Get all unbilled records for a specific customer
const { data, error } = await supabase.rpc('get_unpaid_records', {
  p_organization_id: currentUser.organizationId,
  p_customer_id: 'customer-uuid-here'
});

// Calculate total unbilled amount
const totalUnbilled = data.reduce((sum, record) => sum + parseFloat(record.total_price), 0);
console.log(`Total unbilled: $${totalUnbilled.toFixed(2)}`);
```

**Example Response:**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "financial_id": "550e8400-e29b-41d4-a716-446655440002",
    "customer_id": "550e8400-e29b-41d4-a716-446655440003",
    "customer_name": "ABC Corporation",
    "product_name": "ABCCORP:Website",
    "quantity": 12.0,
    "unit_price": 125.00,
    "total_price": 1500.00,
    "date": "2026-01-10"
  }
]
```

**Performance:** Indexed on `organization_id WHERE inv_id IS NULL` for fast unbilled queries.

---

## Summary/Aggregation Operations

### 3. Get Monthly Summary

**RPC Function:** `get_monthly_summary`

**Purpose:** Aggregate financial records by month for reporting and charts.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `p_organization_id` | UUID | Yes | - | Organization identifier |
| `p_year` | INT | Yes | - | Year to query (e.g., 2026) |
| `p_customer_id` | UUID | No | NULL | Filter by specific customer |

**Returns:** Table with columns:

| Column | Type | Description |
|--------|------|-------------|
| `month` | INT | Month number (1-12) |
| `year` | INT | Year (echoed from input) |
| `total_hours` | NUMERIC | Total hours worked |
| `total_amount` | NUMERIC | Total billing amount |
| `billed_amount` | NUMERIC | Amount already billed |
| `unbilled_amount` | NUMERIC | Amount not yet billed |
| `record_count` | INT | Number of records |

**Ordering:** `month ASC` (January to December)

**Frontend Usage:**

```javascript
// Get monthly summary for 2026
const { data, error } = await supabase.rpc('get_monthly_summary', {
  p_organization_id: currentUser.organizationId,
  p_year: 2026
});

// Prepare chart data
const chartData = {
  labels: data.map(m => monthNames[m.month - 1]),
  datasets: [
    {
      label: 'Billed',
      data: data.map(m => m.billed_amount)
    },
    {
      label: 'Unbilled',
      data: data.map(m => m.unbilled_amount)
    }
  ]
};
```

**Example Response:**

```json
[
  {
    "month": 1,
    "year": 2026,
    "total_hours": 120.5,
    "total_amount": 18075.00,
    "billed_amount": 12000.00,
    "unbilled_amount": 6075.00,
    "record_count": 45
  },
  {
    "month": 2,
    "year": 2026,
    "total_hours": 98.0,
    "total_amount": 14700.00,
    "billed_amount": 14700.00,
    "unbilled_amount": 0.00,
    "record_count": 38
  }
]
```

**Performance:** Uses date extraction for grouping; indexed on `date` for fast aggregation.

---

### 4. Get Quarterly Summary

**RPC Function:** `get_quarterly_summary`

**Purpose:** Aggregate financial records by quarter for reporting.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `p_organization_id` | UUID | Yes | - | Organization identifier |
| `p_year` | INT | Yes | - | Year to query |
| `p_quarter` | INT | Yes | - | Quarter number (1-4) |
| `p_customer_id` | UUID | No | NULL | Filter by specific customer |

**Returns:** Table with columns:

| Column | Type | Description |
|--------|------|-------------|
| `quarter` | INT | Quarter number (1-4) |
| `year` | INT | Year |
| `total_hours` | NUMERIC | Total hours worked |
| `total_amount` | NUMERIC | Total billing amount |
| `billed_amount` | NUMERIC | Amount already billed |
| `unbilled_amount` | NUMERIC | Amount not yet billed |
| `record_count` | INT | Number of records |

**Quarter Calculation:** `CEIL(EXTRACT(MONTH FROM date) / 3.0)`
- Q1: January - March (months 1-3)
- Q2: April - June (months 4-6)
- Q3: July - September (months 7-9)
- Q4: October - December (months 10-12)

**Frontend Usage:**

```javascript
// Get Q1 2026 summary
const { data, error } = await supabase.rpc('get_quarterly_summary', {
  p_organization_id: currentUser.organizationId,
  p_year: 2026,
  p_quarter: 1
});

console.log(`Q1 2026 Total: $${data[0].total_amount}`);
```

**Example Response:**

```json
[
  {
    "quarter": 1,
    "year": 2026,
    "total_hours": 350.5,
    "total_amount": 52575.00,
    "billed_amount": 40000.00,
    "unbilled_amount": 12575.00,
    "record_count": 125
  }
]
```

---

### 5. Get Yearly Summary

**RPC Function:** `get_yearly_summary`

**Purpose:** Aggregate financial records by year for annual reporting.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `p_organization_id` | UUID | Yes | - | Organization identifier |
| `p_year` | INT | Yes | - | Year to query |
| `p_customer_id` | UUID | No | NULL | Filter by specific customer |

**Returns:** Table with columns:

| Column | Type | Description |
|--------|------|-------------|
| `year` | INT | Year |
| `total_hours` | NUMERIC | Total hours worked |
| `total_amount` | NUMERIC | Total billing amount |
| `billed_amount` | NUMERIC | Amount already billed |
| `unbilled_amount` | NUMERIC | Amount not yet billed |
| `record_count` | INT | Number of records |

**Frontend Usage:**

```javascript
// Get 2026 annual summary
const { data, error } = await supabase.rpc('get_yearly_summary', {
  p_organization_id: currentUser.organizationId,
  p_year: 2026
});

console.log(`2026 Annual Revenue: $${data[0].total_amount}`);
```

**Example Response:**

```json
[
  {
    "year": 2026,
    "total_hours": 1450.0,
    "total_amount": 217500.00,
    "billed_amount": 180000.00,
    "unbilled_amount": 37500.00,
    "record_count": 520
  }
]
```

---

## Write Operations

### 6. Create Financial Record

**RPC Function:** `create_financial_record`

**Purpose:** Create a new financial record (e.g., from timer stop or manual entry).

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `p_financial_id` | UUID | Yes | - | Unique identifier (correlation key) |
| `p_organization_id` | UUID | Yes | - | Organization identifier |
| `p_customer_id` | UUID | Yes | - | Customer foreign key |
| `p_product_name` | TEXT | Yes | - | Product/service name |
| `p_quantity` | NUMERIC | Yes | - | Hours worked (must be > 0) |
| `p_unit_price` | NUMERIC | Yes | - | Hourly rate (must be >= 0) |
| `p_date` | DATE | Yes | - | Record date (YYYY-MM-DD) |
| `p_product_id` | UUID | No | NULL | Optional product foreign key |

**Returns:** UUID (the created record's `id`)

**Validation Rules:**
- `financial_id` must be unique (enforced by constraint)
- `quantity` must be > 0
- `unit_price` must be >= 0
- `total_price` calculated automatically: `quantity × unit_price` (rounded to 2 decimals)

**Frontend Usage:**

```javascript
// Create financial record from timer stop
async function handleTimerStop(taskId, elapsedSeconds) {
  // 1. Fetch context
  const task = await getTask(taskId);
  const project = await getProject(task.projectId);
  const customer = await getCustomer(project.customerId);

  // 2. Calculate billable hours
  const billableHours = Math.round((elapsedSeconds / 3600) * 100) / 100; // Round to 2 decimals

  // 3. Get billing rate
  const unitPrice = customer.chargeRate || project.hourlyRate || 0;

  // 4. Generate financial_id
  const financialId = crypto.randomUUID();

  // 5. Format product_name
  const productName = formatProductName(customer.businessName, project.name);

  // 6. Create financial record
  const { data, error } = await supabase.rpc('create_financial_record', {
    p_financial_id: financialId,
    p_organization_id: currentUser.organizationId,
    p_customer_id: customer.id,
    p_product_name: productName,
    p_quantity: billableHours,
    p_unit_price: unitPrice,
    p_date: new Date().toISOString().split('T')[0] // YYYY-MM-DD
  });

  if (error) throw error;
  console.log(`Created financial record: ${data}`);

  return data; // Returns record ID
}
```

**Example Request:**

```javascript
const { data, error } = await supabase.rpc('create_financial_record', {
  p_financial_id: '550e8400-e29b-41d4-a716-446655440000',
  p_organization_id: '550e8400-e29b-41d4-a716-446655440001',
  p_customer_id: '550e8400-e29b-41d4-a716-446655440002',
  p_product_name: 'CLARITYBUSINESS:Development',
  p_quantity: 8.5,
  p_unit_price: 150.00,
  p_date: '2026-01-15'
});
```

**Example Response:**

```json
"550e8400-e29b-41d4-a716-446655440003"
```

**Error Responses:**
- `financial_id is required` - Missing financial_id
- `organization_id is required` - Missing organization_id
- `customer_id is required` - Missing customer_id
- `product_name is required` - Missing or empty product_name
- `quantity must be greater than 0` - Invalid quantity
- `unit_price cannot be negative` - Invalid unit_price
- `duplicate key value violates unique constraint` - financial_id already exists

---

### 7. Mark Records Billed

**RPC Function:** `mark_records_billed`

**Purpose:** Mark multiple records as billed by setting invoice ID (bulk operation).

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `p_record_ids` | UUID[] | Yes | - | Array of record IDs to mark as billed |
| `p_invoice_id` | TEXT | Yes | - | Invoice identifier (e.g., 'QB-12345' or 'MANUAL-001') |

**Returns:** INT (number of records updated)

**Side Effects:**
- Sets `inv_id = p_invoice_id` for all specified records
- Updates `updated_at = NOW()` for all specified records

**Frontend Usage:**

```javascript
// Mark records as billed after QuickBooks invoice generation
async function markRecordsAsBilled(recordIds, qbInvoiceId) {
  const { data, error } = await supabase.rpc('mark_records_billed', {
    p_record_ids: recordIds,
    p_invoice_id: `QB-${qbInvoiceId}`
  });

  if (error) throw error;
  console.log(`Marked ${data} records as billed`);

  return data; // Returns count of updated records
}
```

**Example Request:**

```javascript
const { data, error } = await supabase.rpc('mark_records_billed', {
  p_record_ids: [
    '550e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440003'
  ],
  p_invoice_id: 'QB-12345'
});
```

**Example Response:**

```json
3
```

**Error Responses:**
- `record_ids array is required and cannot be empty` - Missing or empty array
- `invoice_id is required` - Missing or empty invoice_id

---

## Error Handling

### Common Error Patterns

**1. Authentication Error:**
```json
{
  "code": "PGRST301",
  "message": "JWT expired"
}
```

**Solution:** Refresh Supabase session token.

**2. RLS Policy Violation:**
```json
{
  "code": "42501",
  "message": "new row violates row-level security policy"
}
```

**Solution:** Ensure `organization_id` matches user's organization context.

**3. Foreign Key Violation:**
```json
{
  "code": "23503",
  "message": "insert or update on table \"customer_sales\" violates foreign key constraint"
}
```

**Solution:** Verify customer_id exists in customers table.

**4. Unique Constraint Violation:**
```json
{
  "code": "23505",
  "message": "duplicate key value violates unique constraint \"customer_sales_financial_id_key\""
}
```

**Solution:** Generate new unique `financial_id` (use UUID v4).

**5. Function Not Found:**
```json
{
  "code": "42883",
  "message": "function get_financial_records(...) does not exist"
}
```

**Solution:** Backend RPC functions not deployed yet; wait for backend team.

---

## Frontend Integration Examples

### React Hook for Financial Records

```javascript
// src/hooks/useFinancialRecords.js
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseService';

export function useFinancialRecords(organizationId, filters = {}) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc('get_financial_records', {
        p_organization_id: organizationId,
        p_start_date: filters.startDate || null,
        p_end_date: filters.endDate || null,
        p_customer_id: filters.customerId || null,
        p_billed_only: filters.billedOnly !== undefined ? filters.billedOnly : null
      });

      if (error) throw error;
      setRecords(data || []);
    } catch (err) {
      setError(err);
      console.error('Failed to fetch financial records:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId, filters]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  return { records, loading, error, refresh: fetchRecords };
}
```

### Service Layer for Record Creation

```javascript
// src/services/financialRecordService.js
import { supabase } from './supabaseService';

export async function createFinancialRecordForTask(taskId, elapsedSeconds) {
  // 1. Fetch task context
  const { data: task } = await supabase
    .from('tasks')
    .select('*, projects(*), projects.customers(*)')
    .eq('id', taskId)
    .single();

  if (!task) throw new Error('Task not found');

  // 2. Calculate billable hours
  const billableHours = Math.round((elapsedSeconds / 3600) * 100) / 100;

  // 3. Get billing rate
  const unitPrice = task.projects.customers.charge_rate || task.projects.hourly_rate || 0;

  // 4. Generate financial_id
  const financialId = crypto.randomUUID();

  // 5. Format product_name
  const customerCaps = task.projects.customers.business_name.replace(/[^A-Z0-9]/g, '').trim();
  const projectFirstWord = task.projects.name.split(' ')[0];
  const productName = `${customerCaps}:${projectFirstWord}`;

  // 6. Get organization_id from user session
  const { data: { user } } = await supabase.auth.getUser();
  const organizationId = user.user_metadata.organization_id;

  // 7. Create financial record
  const { data, error } = await supabase.rpc('create_financial_record', {
    p_financial_id: financialId,
    p_organization_id: organizationId,
    p_customer_id: task.projects.customer_id,
    p_product_name: productName,
    p_quantity: billableHours,
    p_unit_price: unitPrice,
    p_date: new Date().toISOString().split('T')[0]
  });

  if (error) throw error;

  return data; // Returns record ID
}
```

---

## Performance Considerations

### Query Performance Targets

- **Simple queries** (date range, customer filter): < 500ms
- **Aggregation queries** (monthly, quarterly): < 1000ms
- **Record creation**: < 200ms
- **Bulk updates** (mark as billed): < 500ms for 100 records

### Optimization Strategies

1. **Use Indexes:** All queries indexed on frequently filtered columns
2. **Limit Result Sets:** Add pagination for large date ranges
3. **Cache Aggregations:** Store monthly summaries in separate table for historical data
4. **Connection Pooling:** Use Supabase pooler for high-concurrency scenarios

---

**Document Version:** 1.0
**Last Updated:** 2026-01-11
**Status:** Phase 1 Requirements Documentation
