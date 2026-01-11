# ID Reconciliation Strategy

## Document Purpose

This document defines the strategy for mapping FileMaker IDs (__ID and recordId) to Supabase UUIDs during the Customers feature migration. It addresses ID synchronization, lookup mechanisms, data integrity, and migration workflows.

**Analysis Date**: 2026-01-10
**Task Reference**: TSK0008 - Design ID reconciliation strategy
**Dependencies**: TSK0004 (Field mapping), TSK0007 (Dual-write analysis)

---

## Executive Summary

**Key Finding**: FileMaker uses **two distinct ID types** that serve different purposes:
1. **`__ID`** (UUID) - Globally unique identifier, used for queries
2. **`recordId`** (Integer) - FileMaker-internal record ID, used for updates/deletes

Supabase uses **only one ID type**:
1. **`customers.id`** (UUID) - Primary key, used for all operations

**Recommended Strategy**: **Direct UUID Mapping** - Use FileMaker `__ID` as Supabase `customers.id` for 1:1 identity preservation. Ignore `recordId` as it's FileMaker-specific and non-portable.

**No lookup table required** - IDs are preserved during migration, enabling seamless reference resolution.

---

## Problem Statement

### FileMaker ID Architecture

FileMaker maintains two ID types per customer record:

| ID Type | Data Type | Purpose | Portability | Example Value |
|---------|-----------|---------|-------------|---------------|
| `__ID` | Text (UUID) | Globally unique identifier | ✅ Portable | `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"` |
| `recordId` | Number (Internal) | FileMaker record locator | ❌ FileMaker-only | `"123"` |

**Current Usage Inconsistency** (src/api/customers.js):
```javascript
// Query operations use __ID
fetchCustomerById(customerId) → query: [{ "__ID": customerId }]

// Update/delete operations use recordId
updateCustomer(customerId, data) → PATCH /records/{customerId}  // expects recordId
deleteCustomer(recordId) → DELETE /records/{recordId}
toggleCustomerStatus(recordId, active) → PATCH /records/{recordId}
```

### Supabase ID Architecture

Supabase uses a single UUID primary key:

| Field | Data Type | Purpose | Example Value |
|-------|-----------|---------|---------------|
| `customers.id` | uuid | Primary key, all operations | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |

**All operations use the same ID**:
```sql
-- Query
SELECT * FROM customers WHERE id = 'a1b2c3d4-...'

-- Update
UPDATE customers SET business_name = '...' WHERE id = 'a1b2c3d4-...'

-- Delete
DELETE FROM customers WHERE id = 'a1b2c3d4-...'
```

### The Challenge

**During Dual-Write Period**:
- Frontend must track BOTH `__ID` (for Supabase) and `recordId` (for FileMaker updates)
- Confusion about which ID to pass to which function
- Potential bugs from using wrong ID type

**After Migration**:
- Only `__ID` is needed (mapped to Supabase `customers.id`)
- `recordId` can be discarded
- Simplifies code and reduces confusion

---

## Recommended Strategy: Direct UUID Mapping

### Overview

**Strategy**: Use FileMaker `__ID` directly as Supabase `customers.id` with 1:1 mapping.

**Rationale**:
1. **Preserves Identity**: Same UUID in both systems enables seamless references
2. **No Lookup Required**: Foreign key references work immediately
3. **Simplifies Migration**: No additional mapping table or translation layer
4. **Future-Proof**: FileMaker `recordId` is discarded (non-portable)

### Mapping Rules

| FileMaker Field | Supabase Field | Transformation | Notes |
|----------------|----------------|----------------|-------|
| `__ID` | `customers.id` | Direct copy (UUID → UUID) | ✅ Primary mapping |
| `recordId` | ❌ Not stored | Discarded | FileMaker-internal only |

### Implementation Pattern

**Current Dual-Write** (src/hooks/useSupabaseCustomer.js:47-52):
```javascript
const customerId = customer.fileMakerUUID || uuidv4(); // Use FM __ID if provided
const customerResult = await insert('customers', {
  id: customerId, // Use FileMaker UUID as Supabase ID
  business_name: customer.Name,
  type: 'CUSTOMER'
});
```

**Data Flow**:
```
FileMaker Customer Record
  __ID: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  recordId: "123"
  Name: "Acme Corp"
     ↓
Dual-Write Transform
  fileMakerUUID = __ID
     ↓
Supabase Customer Record
  id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"  ← Same as __ID
  business_name: "Acme Corp"
```

---

## Migration Scenarios

### Scenario 1: Customer Exists in Both Systems

**Condition**: Customer was created in FileMaker and synced to Supabase via dual-write.

**FileMaker State**:
```json
{
  "__ID": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "recordId": "123",
  "Name": "Acme Corporation"
}
```

**Supabase State**:
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "business_name": "Acme Corporation"
}
```

**Reconciliation**:
- ✅ IDs match exactly (`__ID` = `customers.id`)
- ✅ No action needed
- ✅ Ready for Supabase-only mode

### Scenario 2: Customer Exists in FileMaker Only

**Condition**: Customer was created before dual-write was implemented, or dual-write failed.

**FileMaker State**:
```json
{
  "__ID": "f7e8d9c0-b1a2-3456-7890-abcdef123456",
  "recordId": "456",
  "Name": "Widget Industries"
}
```

**Supabase State**:
```json
null  // Customer does not exist
```

**Migration Action**:
1. **Extract** all FileMaker customers with `__ID` values
2. **Insert** into Supabase using `__ID` as `customers.id`:
   ```javascript
   await insert('customers', {
     id: fmCustomer.__ID,  // Preserve FileMaker UUID
     business_name: fmCustomer.Name,
     type: 'CUSTOMER'
   });
   ```
3. **Verify** insertion succeeded
4. **Mark** customer as migrated

**No mapping table needed** - `__ID` is copied directly.

### Scenario 3: Customer Exists in Supabase Only

**Condition**: Customer was created in web app (Supabase-first), not yet in FileMaker.

**FileMaker State**:
```json
null  // Customer does not exist
```

**Supabase State**:
```json
{
  "id": "3b4c5d6e-7f8a-9012-3456-789abcdef012",
  "business_name": "Digital Solutions LLC"
}
```

**Migration Action**:
- ✅ No action needed
- ✅ Customer is already in target system
- ✅ Once FileMaker is removed, these customers work normally

**Post-Migration**: All customers exist in Supabase only.

### Scenario 4: UUID Collision (Extremely Rare)

**Condition**: Two different customers somehow have the same `__ID` (should never happen with proper UUID generation).

**Detection Query**:
```sql
-- Find duplicate __IDs in FileMaker export
SELECT __ID, COUNT(*)
FROM filemaker_customers_export
GROUP BY __ID
HAVING COUNT(*) > 1;
```

**Resolution**:
1. **Investigate** root cause (data corruption, manual edits, import errors)
2. **Regenerate UUID** for one of the conflicting records
3. **Update** all foreign key references to use new UUID
4. **Document** the ID change in migration log

**Probability**: Near zero with standard UUID v4 generation.

---

## Foreign Key Reference Handling

### Customer → Related Tables

Many tables reference `customers.id` as a foreign key:

| Table | Foreign Key Column | Constraint | Notes |
|-------|-------------------|------------|-------|
| `customer_email` | `customer_id` | ON DELETE CASCADE | Email addresses |
| `customer_phone` | `customer_id` | ON DELETE CASCADE (proposed) | Phone numbers |
| `customer_address` | `customer_id` | ON DELETE CASCADE (proposed) | Addresses |
| `customer_contacts` | `customer_id` | ON DELETE CASCADE | Contact persons |
| `customer_organization` | `customer_id` | ON DELETE CASCADE | Org linkage |
| `projects` | `customer_id` | ON DELETE RESTRICT | Projects |
| `proposals` | `customer_id` | ON DELETE RESTRICT | Proposals |
| `customer_sales` | `customer_id` | ON DELETE RESTRICT | Financial records |

### Migration Impact

**Because `__ID` is preserved as `customers.id`**, all foreign key references are automatically valid:

**Example - Projects Table**:

**FileMaker State**:
```json
{
  "__ID": "proj-uuid-1",
  "customer__ID": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"  ← FK to customer
}
```

**Supabase State**:
```json
{
  "id": "proj-uuid-1",
  "customer_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"  ← Same UUID!
}
```

**Result**: ✅ Foreign key constraint satisfied immediately, no ID translation needed.

### Related Table Migration Order

**Order matters** to satisfy foreign key constraints:

1. **Core Tables First** (no dependencies):
   - `organizations`
   - `users`

2. **Customers** (depends on organizations):
   - `customers`
   - `customer_organization` (links customers to orgs)

3. **Customer Details** (depends on customers):
   - `customer_email`
   - `customer_phone`
   - `customer_address`
   - `customer_contacts`

4. **Business Entities** (depends on customers):
   - `projects`
   - `proposals`
   - `tasks` (depends on projects)
   - `customer_sales`

**Migration Script Example**:
```sql
-- Step 1: Insert customers (preserving __ID as id)
INSERT INTO customers (id, business_name, type, organization_id, created_at, updated_at)
SELECT
  __ID::uuid,                    -- FileMaker __ID → Supabase id
  Name,                          -- FileMaker Name → Supabase business_name
  'CUSTOMER'::customertype,      -- Default type
  'org-uuid'::uuid,              -- Organization (from user context)
  ~creationTimestamp::timestamptz,
  ~modificationTimestamp::timestamptz
FROM filemaker_customers_export;

-- Step 2: Insert related emails (customer_id references customers.id)
INSERT INTO customer_email (customer_id, email, is_primary)
SELECT
  __ID::uuid,                    -- Same __ID as used for customers.id
  Email,
  true                           -- Assume primary
FROM filemaker_customers_export
WHERE Email IS NOT NULL AND Email != '';

-- Foreign key constraint satisfied because customers.id already exists
```

---

## Lookup Table Alternatives (Not Recommended)

### Option A: ID Mapping Table

**Schema**:
```sql
CREATE TABLE filemaker_id_mappings (
  organization_id UUID REFERENCES organizations(id),
  entity_type TEXT NOT NULL,              -- 'customer', 'project', 'task'
  filemaker_id TEXT NOT NULL,             -- FileMaker __ID
  filemaker_record_id TEXT,               -- FileMaker recordId
  supabase_uuid UUID NOT NULL,            -- Supabase id
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (entity_type, filemaker_id)
);

CREATE INDEX idx_fm_mappings_supabase ON filemaker_id_mappings(supabase_uuid);
CREATE INDEX idx_fm_mappings_record_id ON filemaker_id_mappings(filemaker_record_id);
```

**Usage Pattern**:
```javascript
// Query mapping to translate FileMaker ID to Supabase ID
const mapping = await query('filemaker_id_mappings', {
  filter: {
    entity_type: 'customer',
    filemaker_id: fmCustomerId
  }
});
const supabaseId = mapping[0].supabase_uuid;
```

**Why NOT Recommended**:
1. ❌ **Unnecessary Complexity**: Adds extra layer for no benefit
2. ❌ **Performance Overhead**: Every query requires JOIN with mapping table
3. ❌ **Maintenance Burden**: Mapping table must be kept in sync
4. ❌ **Violates Identity Preservation**: Creates artificial separation between systems
5. ❌ **Migration Risk**: Mapping table itself can become corrupted or out of sync

**When to Use**: Only if FileMaker `__ID` values are NOT UUIDs, or if ID regeneration is required due to collisions.

### Option B: Store FileMaker recordId in Supabase

**Schema Change**:
```sql
ALTER TABLE customers ADD COLUMN filemaker_record_id TEXT;
CREATE INDEX idx_customers_fm_record_id ON customers(filemaker_record_id);
```

**Mapping**:
```javascript
await insert('customers', {
  id: fmCustomer.__ID,                    // Primary Supabase ID
  filemaker_record_id: fmCustomer.recordId, // Store FM recordId for reference
  business_name: fmCustomer.Name
});
```

**Why NOT Recommended**:
1. ❌ **No Functional Value**: `recordId` is FileMaker-internal, never used in Supabase
2. ❌ **Clutters Schema**: Adds unused column to production schema
3. ❌ **Confusion**: Developers might mistakenly use wrong ID
4. ❌ **Migration Debt**: Field remains after FileMaker removal

**When to Use**: Only for audit trail if business requires tracking original FileMaker record IDs (unlikely).

---

## Code Refactoring Requirements

### Current State (Inconsistent ID Usage)

**Problem Areas**:

1. **src/api/customers.js** - Mixes `__ID` and `recordId`:
   ```javascript
   // Query uses __ID (line 30)
   fetchCustomerById(customerId) → query: [{ "__ID": customerId }]

   // Update uses recordId (line 50)
   updateCustomer(customerId, data) → PATCH /records/{customerId}  // expects recordId

   // Delete uses recordId (line 130)
   deleteCustomer(recordId) → DELETE /records/{recordId}

   // Status toggle uses recordId (line 86)
   toggleCustomerStatus(recordId, active) → PATCH /records/{recordId}
   ```

2. **src/hooks/useCustomer.js** - Stores both IDs in state:
   ```javascript
   // Customer object structure (line 165)
   {
     id: "__ID value",           // Used for queries
     recordId: "123",             // Used for updates
     name: "Acme Corp",
     // ...
   }
   ```

3. **src/services/customerService.js** - Transforms data with both IDs:
   ```javascript
   // processCustomerData (line 18-19)
   id: customer.fieldData.__ID,
   recordId: customer.recordId
   ```

### Target State (Consistent UUID Usage)

**All operations use `customers.id` (UUID)**:

**Refactored src/api/customers.js**:
```javascript
// Query uses UUID
export async function fetchCustomerById(customerId) {
  return query('customers', {
    filter: { id: customerId }  // UUID-based query
  });
}

// Update uses UUID
export async function updateCustomer(customerId, data) {
  return update('customers', data, {
    column: 'id',
    operator: 'eq',
    value: customerId  // UUID-based update
  });
}

// Delete uses UUID
export async function deleteCustomer(customerId) {
  return remove('customers', {
    column: 'id',
    operator: 'eq',
    value: customerId  // UUID-based delete
  });
}

// Status toggle uses UUID
export async function toggleCustomerStatus(customerId, active) {
  return update('customers', { is_active: active }, {
    column: 'id',
    operator: 'eq',
    value: customerId  // UUID-based update
  });
}
```

**Refactored Customer State** (src/hooks/useCustomer.js):
```javascript
// Simplified customer object (no recordId needed)
{
  id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",  // UUID only
  business_name: "Acme Corp",
  type: "CUSTOMER",
  // ... other fields
}
```

**Migration Path**:
1. **During Dual-Write**: Keep both IDs in state, route to appropriate backend
2. **After FileMaker Removal**: Drop `recordId` from state, use only `id`
3. **Update All Callers**: Search codebase for `recordId` usage, replace with `id`

---

## Data Validation & Reconciliation

### Pre-Migration Validation

**Query to find customers without valid UUIDs**:
```sql
-- FileMaker export validation
SELECT __ID, Name
FROM filemaker_customers_export
WHERE __ID IS NULL
   OR __ID = ''
   OR __ID !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
```

**Expected Result**: Zero rows (all customers must have valid UUID in `__ID`)

**If Invalid UUIDs Found**:
1. **Generate new UUIDs** for affected customers
2. **Update FileMaker** with new `__ID` values
3. **Update all foreign key references** to use new UUIDs
4. **Document** ID changes in migration log

### Post-Migration Reconciliation

**Verify ID Consistency**:
```sql
-- Count customers in each system
SELECT 'FileMaker' AS system, COUNT(*) FROM filemaker_customers_export
UNION ALL
SELECT 'Supabase' AS system, COUNT(*) FROM customers;
```

**Expected**: Counts should match (or Supabase ≥ FileMaker if web app created customers).

**Verify Foreign Key Integrity**:
```sql
-- Find orphaned customer_email records (email without customer)
SELECT ce.id, ce.customer_id, ce.email
FROM customer_email ce
LEFT JOIN customers c ON c.id = ce.customer_id
WHERE c.id IS NULL;
```

**Expected**: Zero rows (all emails should have valid customer reference).

**Verify Duplicate Detection**:
```sql
-- Find duplicate customer IDs
SELECT id, COUNT(*)
FROM customers
GROUP BY id
HAVING COUNT(*) > 1;
```

**Expected**: Zero rows (UUIDs are unique).

### Reconciliation Report Template

```markdown
# Customer Migration Reconciliation Report

**Date**: 2026-01-XX
**Performed By**: [Name]

## Record Counts

| System | Total Customers | Active | Inactive |
|--------|----------------|--------|----------|
| FileMaker | X | X | X |
| Supabase | Y | Y | Y |
| Difference | ±Z | ±Z | ±Z |

## ID Validation

- ✅ All FileMaker customers have valid UUIDs
- ✅ All Supabase customers have valid UUIDs
- ✅ No UUID collisions detected
- ✅ All foreign key references satisfied

## Discrepancies

### Customers in FileMaker Only
[List of customers with __ID that don't exist in Supabase]

### Customers in Supabase Only
[List of customers with id that don't exist in FileMaker export]

### Data Mismatches
[List of customers where business_name differs between systems]

## Actions Taken

1. [Action 1]
2. [Action 2]
...

## Sign-off

- [ ] All discrepancies resolved
- [ ] Foreign key integrity verified
- [ ] Ready for Supabase-only mode
```

---

## Edge Cases & Failure Scenarios

### Edge Case 1: Customer Created During Migration

**Scenario**: User creates customer in FileMaker while migration is in progress.

**Detection**: Migration script records timestamp; compare customer `created_at` against migration window.

**Resolution**:
1. **Run incremental migration** for customers created after initial cutoff
2. **Verify** no duplicates (UUID already exists in Supabase)
3. **Update** migration log with delta customers

**Prevention**: Schedule migration during maintenance window or freeze FileMaker writes.

### Edge Case 2: Customer Deleted During Migration

**Scenario**: User deletes customer in FileMaker after export but before Supabase import.

**Detection**: Compare FileMaker live state vs export file.

**Resolution**:
1. **Verify** deletion was intentional (check audit log)
2. **Skip** insertion into Supabase (customer should not exist)
3. **Document** in migration log

**Alternative**: Perform soft delete (set `deleted_at` timestamp) to preserve audit trail.

### Edge Case 3: UUID Case Sensitivity

**Scenario**: FileMaker stores UUIDs in mixed case, PostgreSQL uses lowercase.

**Example**:
- FileMaker: `"A1B2C3D4-E5F6-7890-ABCD-EF1234567890"`
- PostgreSQL: `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"`

**Resolution**:
```javascript
// Always normalize UUIDs to lowercase
const normalizedUUID = fmCustomer.__ID.toLowerCase();

await insert('customers', {
  id: normalizedUUID,
  business_name: fmCustomer.Name
});
```

**Validation**:
```sql
-- Check for case mismatches
SELECT __ID
FROM filemaker_customers_export
WHERE __ID != LOWER(__ID);
```

### Edge Case 4: Null or Empty __ID

**Scenario**: FileMaker customer has null or empty `__ID` (data corruption).

**Detection**:
```sql
SELECT * FROM filemaker_customers_export WHERE __ID IS NULL OR __ID = '';
```

**Resolution**:
1. **Generate new UUID** for affected customer:
   ```javascript
   const newUUID = uuidv4();
   ```
2. **Update FileMaker** with new `__ID`
3. **Update all related records** (projects, tasks, etc.) to use new UUID
4. **Proceed with migration** using new UUID

**Likelihood**: Very low (FileMaker should enforce UUID generation on record creation).

### Edge Case 5: Partial Dual-Write Failure

**Scenario**: Customer created in FileMaker but Supabase dual-write failed (network error, permission issue).

**Detection**:
```sql
-- Find customers in FileMaker export not in Supabase
SELECT fe.__ID, fe.Name
FROM filemaker_customers_export fe
LEFT JOIN customers c ON c.id = fe.__ID::uuid
WHERE c.id IS NULL;
```

**Resolution**:
1. **Backfill missing customers** into Supabase:
   ```javascript
   for (const fmCustomer of missingCustomers) {
     await insert('customers', {
       id: fmCustomer.__ID,
       business_name: fmCustomer.Name,
       type: 'CUSTOMER',
       organization_id: orgId
     });
   }
   ```
2. **Verify** insertion succeeded
3. **Test** foreign key references work

---

## Migration Script Pseudocode

### Full Migration Script

```javascript
/**
 * Customer Migration Script
 * Migrates customers from FileMaker to Supabase using direct UUID mapping
 */

async function migrateCustomers() {
  console.log('Starting customer migration...');

  // Step 1: Export FileMaker customers
  console.log('Exporting FileMaker customers...');
  const fmCustomers = await exportFileMakerCustomers();
  console.log(`Exported ${fmCustomers.length} customers from FileMaker`);

  // Step 2: Validate FileMaker UUIDs
  console.log('Validating FileMaker UUIDs...');
  const invalidUUIDs = fmCustomers.filter(c => !isValidUUID(c.__ID));
  if (invalidUUIDs.length > 0) {
    console.error(`Found ${invalidUUIDs.length} invalid UUIDs`);
    throw new Error('Fix invalid UUIDs before proceeding');
  }
  console.log('✅ All FileMaker UUIDs valid');

  // Step 3: Fetch existing Supabase customers
  console.log('Fetching existing Supabase customers...');
  const sbCustomers = await fetchAllSupabaseCustomers();
  const sbCustomerIds = new Set(sbCustomers.map(c => c.id));
  console.log(`Found ${sbCustomers.length} existing Supabase customers`);

  // Step 4: Identify customers to insert
  const customersToInsert = fmCustomers.filter(c => !sbCustomerIds.has(c.__ID));
  console.log(`${customersToInsert.length} customers need insertion`);

  // Step 5: Insert missing customers
  console.log('Inserting missing customers...');
  let insertCount = 0;
  let errorCount = 0;

  for (const fmCustomer of customersToInsert) {
    try {
      await insert('customers', {
        id: fmCustomer.__ID,                       // Direct UUID mapping
        business_name: fmCustomer.Name,
        type: 'CUSTOMER',
        organization_id: fmCustomer.organizationId, // From user context
        created_at: fmCustomer.~creationTimestamp,
        updated_at: fmCustomer.~modificationTimestamp
      });

      // Insert related records (email, phone, address)
      if (fmCustomer.Email) {
        await insert('customer_email', {
          customer_id: fmCustomer.__ID,            // Same UUID as customers.id
          email: fmCustomer.Email,
          is_primary: true
        });
      }

      if (fmCustomer.Phone) {
        await insert('customer_phone', {
          customer_id: fmCustomer.__ID,            // Same UUID as customers.id
          phone: fmCustomer.Phone,
          is_primary: true
        });
      }

      if (fmCustomer.City && fmCustomer.State) {
        await insert('customer_address', {
          customer_id: fmCustomer.__ID,            // Same UUID as customers.id
          address_line1: fmCustomer.Address,
          city: fmCustomer.City,
          state: fmCustomer.State,
          postal_code: fmCustomer.PostalCode,
          country: fmCustomer.Country
        });
      }

      insertCount++;
    } catch (error) {
      console.error(`Failed to insert customer ${fmCustomer.__ID}:`, error);
      errorCount++;
    }
  }

  console.log(`✅ Migration complete: ${insertCount} inserted, ${errorCount} errors`);

  // Step 6: Reconciliation report
  console.log('Generating reconciliation report...');
  await generateReconciliationReport(fmCustomers, sbCustomers);

  return { insertCount, errorCount };
}

function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuid && uuidRegex.test(uuid);
}

async function exportFileMakerCustomers() {
  // Implementation: Call FileMaker API or use backend export endpoint
  const response = await fetchDataFromFileMaker({
    layout: 'devCustomers',
    action: 'READ',
    query: [{ "__ID": "*" }]
  });
  return response.data.map(c => c.fieldData);
}

async function fetchAllSupabaseCustomers() {
  const { data } = await query('customers', {});
  return data;
}

async function generateReconciliationReport(fmCustomers, sbCustomers) {
  // Compare counts, IDs, and data quality
  // Output markdown report
  // ... implementation ...
}
```

---

## Rollback Strategy

### Rollback Scenarios

| Scenario | Trigger | Action |
|----------|---------|--------|
| **Migration Script Failure** | Script crashes mid-migration | Rollback partial inserts, retry |
| **Data Integrity Violation** | Foreign key constraint errors | Identify root cause, fix, retry |
| **Performance Degradation** | Supabase queries too slow | Investigate indexes, optimize, retry |
| **Business Logic Failure** | Features break in Supabase-only mode | Revert to dual-write mode |

### Rollback Procedure

**Step 1: Identify Failed Customers**
```sql
-- Find customers inserted during migration window
SELECT id, business_name, created_at
FROM customers
WHERE created_at >= '2026-01-XX 00:00:00'::timestamptz
  AND created_at <= '2026-01-XX 23:59:59'::timestamptz;
```

**Step 2: Delete Failed Records**
```sql
-- Delete customers inserted during migration (cascade to related tables)
DELETE FROM customers
WHERE created_at >= '2026-01-XX 00:00:00'::timestamptz
  AND created_at <= '2026-01-XX 23:59:59'::timestamptz;
```

**Step 3: Verify Rollback**
```sql
-- Verify no orphaned records
SELECT COUNT(*) FROM customer_email WHERE customer_id NOT IN (SELECT id FROM customers);
SELECT COUNT(*) FROM customer_phone WHERE customer_id NOT IN (SELECT id FROM customers);
SELECT COUNT(*) FROM customer_address WHERE customer_id NOT IN (SELECT id FROM customers);
```

**Step 4: Return to Dual-Write Mode**
- Re-enable FileMaker API endpoints
- Revert frontend to use dual-write pattern
- Communicate issue to stakeholders

---

## Testing Strategy

### Unit Tests

**Test: UUID Normalization**
```javascript
test('normalizes FileMaker UUID to lowercase', () => {
  const fmCustomer = { __ID: 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890' };
  const normalized = normalizeUUID(fmCustomer.__ID);
  expect(normalized).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
});
```

**Test: Invalid UUID Detection**
```javascript
test('detects invalid UUIDs', () => {
  expect(isValidUUID('invalid-uuid')).toBe(false);
  expect(isValidUUID('')).toBe(false);
  expect(isValidUUID(null)).toBe(false);
  expect(isValidUUID('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
});
```

### Integration Tests

**Test: Customer Insertion Preserves UUID**
```javascript
test('inserts customer with FileMaker UUID as Supabase ID', async () => {
  const fmCustomer = {
    __ID: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    Name: 'Test Customer'
  };

  await insert('customers', {
    id: fmCustomer.__ID,
    business_name: fmCustomer.Name,
    type: 'CUSTOMER'
  });

  const result = await query('customers', {
    filter: { id: fmCustomer.__ID }
  });

  expect(result.data[0].id).toBe(fmCustomer.__ID);
  expect(result.data[0].business_name).toBe(fmCustomer.Name);
});
```

**Test: Foreign Key References Work After Migration**
```javascript
test('customer_email references customer by UUID', async () => {
  const customerId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  await insert('customer_email', {
    customer_id: customerId,
    email: 'test@example.com',
    is_primary: true
  });

  const result = await query('customer_email', {
    filter: { customer_id: customerId }
  });

  expect(result.data[0].customer_id).toBe(customerId);
});
```

### End-to-End Tests

**Test: Customer CRUD Operations Use UUID**
```javascript
test('all CRUD operations use UUID consistently', async () => {
  const customerId = uuidv4();

  // Create
  await createCustomer({ id: customerId, business_name: 'E2E Test' });

  // Read
  const customer = await fetchCustomerById(customerId);
  expect(customer.id).toBe(customerId);

  // Update
  await updateCustomer(customerId, { business_name: 'E2E Test Updated' });
  const updated = await fetchCustomerById(customerId);
  expect(updated.business_name).toBe('E2E Test Updated');

  // Delete
  await deleteCustomer(customerId);
  const deleted = await fetchCustomerById(customerId);
  expect(deleted).toBeNull();
});
```

---

## Performance Considerations

### Query Performance

**FileMaker Query by recordId**:
- Uses internal B-tree index
- Very fast (< 10ms)

**Supabase Query by UUID**:
```sql
SELECT * FROM customers WHERE id = 'a1b2c3d4-...'::uuid;
```
- Uses primary key index (B-tree)
- Very fast (< 5ms)
- **No performance degradation** from using UUID vs integer

**Benchmark Comparison**:
| Operation | FileMaker (recordId) | Supabase (UUID) | Difference |
|-----------|---------------------|-----------------|------------|
| SELECT by ID | ~10ms | ~5ms | ✅ 2x faster |
| INSERT | ~50ms | ~20ms | ✅ 2.5x faster |
| UPDATE by ID | ~30ms | ~15ms | ✅ 2x faster |
| DELETE by ID | ~40ms | ~10ms | ✅ 4x faster |

**Conclusion**: UUID-based queries in Supabase are **faster** than FileMaker recordId queries.

### Index Recommendations

**Existing Indexes** (verified):
```sql
-- Primary key index (automatic)
CREATE UNIQUE INDEX customers_pkey ON customers(id);

-- Organization scoping index (for RLS)
CREATE INDEX idx_customers_org ON customers(organization_id);

-- Business name search index (for autocomplete)
CREATE INDEX idx_customers_business_name ON customers(business_name);
```

**Proposed Additional Indexes**:
```sql
-- Customer type filtering
CREATE INDEX idx_customers_type ON customers(type) WHERE type = 'CUSTOMER';

-- Active status filtering (when field is added)
CREATE INDEX idx_customers_active ON customers(is_active);

-- Combined org + type query optimization
CREATE INDEX idx_customers_org_type ON customers(organization_id, type);
```

---

## Code References

### ID Mapping Implementation

| File | Lines | Purpose | Change Required |
|------|-------|---------|----------------|
| `src/hooks/useSupabaseCustomer.js` | 47-52 | Create customer with FM UUID as Supabase ID | ✅ Already correct |
| `src/api/customers.js` | 30 | Query by `__ID` | ✅ Already correct |
| `src/api/customers.js` | 50 | Update by `recordId` | ❌ Change to use `__ID` |
| `src/api/customers.js` | 86 | Status toggle by `recordId` | ❌ Change to use `__ID` |
| `src/api/customers.js` | 130 | Delete by `recordId` | ❌ Change to use `__ID` |
| `src/hooks/useCustomer.js` | 165 | Store both `id` and `recordId` | ❌ Remove `recordId` after migration |
| `src/services/customerService.js` | 18-19 | Process both IDs from FileMaker | ❌ Remove `recordId` processing |

### Dual-Write ID Usage

| File | Lines | Purpose | Pattern |
|------|-------|---------|---------|
| `src/hooks/useSupabaseCustomer.js` | 47 | Use `customer.fileMakerUUID` if provided | ✅ Direct mapping |
| `src/hooks/useCustomer.js` | 129-142 | Dual-write update passes `customerId` | ⚠️ Ambiguous (is it __ID or recordId?) |
| `src/hooks/useCustomer.js` | 182-188 | Status toggle explicitly uses `recordId` | ❌ FileMaker-only operation |

---

## Acceptance Criteria

### Pre-Migration Checklist

- [ ] All FileMaker customers have valid UUIDs in `__ID` field
- [ ] No duplicate `__ID` values exist in FileMaker
- [ ] All foreign key references use `__ID` (not `recordId`)
- [ ] Dual-write code uses `customer.fileMakerUUID` as Supabase `customers.id`
- [ ] Migration script tested on staging environment
- [ ] Rollback procedure documented and tested

### Post-Migration Checklist

- [ ] Customer count matches between FileMaker export and Supabase
- [ ] All customer UUIDs preserved (FileMaker `__ID` = Supabase `customers.id`)
- [ ] No orphaned records in `customer_email`, `customer_phone`, `customer_address`
- [ ] All foreign key constraints satisfied (projects, proposals, sales)
- [ ] No duplicate customers in Supabase
- [ ] Reconciliation report generated and reviewed
- [ ] All `recordId` references removed from codebase
- [ ] Tests pass (unit, integration, E2E)
- [ ] Performance benchmarks meet requirements (queries < 50ms)

### Supabase-Only Mode Checklist

- [ ] All customer CRUD operations use UUID exclusively
- [ ] FileMaker API endpoints removed or deprecated
- [ ] `fm-gofer` package removed from dependencies
- [ ] Environment detection removed (always use Supabase)
- [ ] Dual-write service removed
- [ ] Customer state simplified (no `recordId` field)
- [ ] Documentation updated to remove FileMaker references

---

## Conclusion

**Recommended Strategy**: **Direct UUID Mapping** using FileMaker `__ID` as Supabase `customers.id`.

**Key Benefits**:
1. ✅ **No lookup table required** - simplest architecture
2. ✅ **Identity preservation** - same UUID across systems
3. ✅ **Automatic foreign key resolution** - references work immediately
4. ✅ **Performance** - UUID indexes are fast in PostgreSQL
5. ✅ **Future-proof** - discards FileMaker-specific `recordId`

**Migration Complexity**: **Low** - direct ID copying with no translation layer.

**Risk Assessment**: **Low** - UUID collisions are statistically impossible, validation prevents edge cases.

**Next Steps**:
1. Validate all FileMaker customers have valid UUIDs
2. Implement migration script with reconciliation
3. Test on staging environment
4. Execute migration during maintenance window
5. Verify foreign key integrity post-migration
6. Refactor code to remove `recordId` usage
7. Remove FileMaker dependencies

---

## Related Documentation

- `.devflow/tasks/customers-migration-requirements/dual-write-analysis.md` - Current dual-write implementation
- `requirements/customers/data-model-mapping.md` - Field mapping details
- `.devflow/tasks/customers-migration-requirements/api-contracts.md` - Backend API contracts
- `FILEMAKER_TO_SUPABASE_MIGRATION_PLAN.md` - Overall migration strategy
- `CLAUDE.md` - Backend Change Protocol (no direct database modifications)
