# Links - Data Model Mapping

## Overview

This document maps the FileMaker `devLinks` layout schema to the Supabase `links` table, identifies gaps, and specifies required schema changes.

## FileMaker Schema: devLinks Layout

### Fields

| Field Name | Type | Nullable | Description | Auto-Generated |
|------------|------|----------|-------------|----------------|
| `__ID` | Text (UUID) | No | Primary key | Yes (FileMaker) |
| `link` | Text | No | The URL string | No |
| `_fkID` | Text (UUID) | No | Foreign key to parent entity (polymorphic) | No |
| `~creationTimestamp` | Timestamp | No | Record creation timestamp | Yes (FileMaker) |
| `~modificationTimestamp` | Timestamp | No | Last modification timestamp | Yes (FileMaker) |
| `~CreatedBy` | Text | No | Username of creator | Yes (FileMaker) |

### Constraints

- **Primary Key**: `__ID`
- **Required Fields**: `link`, `_fkID`
- **No Foreign Key Enforcement**: `_fkID` is not validated against any table
- **No Uniqueness Constraints**: Duplicate URLs allowed
- **No Length Limits**: Text fields are effectively unlimited in FileMaker

### Association Pattern

FileMaker uses a **polymorphic association** via `_fkID`:
- `_fkID` can reference:
  - Project `__ID` (from `devProjects` layout)
  - Task `__ID` (from `devTasks` layout)
  - Customer `__ID` (from `devCustomers` layout)
- No explicit type field - association determined by querying parent entities
- Frontend code filters links by matching `_fkID` to parent entity ID

## Supabase Schema: links Table (Current)

### Columns

| Column Name | Type | Nullable | Default | Description |
|-------------|------|----------|---------|-------------|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `customer_id` | UUID | **No** | - | Foreign key to customers table |
| `organization_id` | UUID | Yes | - | Foreign key to organizations table |
| `project_id` | UUID | Yes | - | Foreign key to projects table |
| `link` | VARCHAR(2048) | No | - | The URL string |
| `created_at` | TIMESTAMPTZ | No | `now()` | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | `now()` | Last modification timestamp |

### Indexes

- `links_pkey` - Primary key on `id`
- `idx_links_customer_id` - B-tree index on `customer_id`
- `idx_links_organization_id` - B-tree index on `organization_id`
- `idx_links_project_id` - B-tree index on `project_id`

### Foreign Keys

- `links_customer_id_fkey` - `customer_id` REFERENCES `customers(id)` ON DELETE CASCADE
- `links_organization_id_fkey` - `organization_id` REFERENCES `organizations(id)` ON DELETE CASCADE
- **No project_id constraint** - Likely intentional for flexibility

### Constraints

- **Primary Key**: `id`
- **NOT NULL**: `id`, `customer_id`, `link`, `created_at`, `updated_at`
- **Length Limit**: `link` limited to 2048 characters
- **No Check Constraints**: No enforcement of "exactly one parent"

## Schema Gaps and Incompatibilities

### Critical Issues

1. **Missing task_id Column**
   - Current: No support for task associations
   - FileMaker: Tasks use `_fkID` to link to tasks
   - **Impact**: Cannot migrate task links without schema change
   - **Required**: Add `task_id UUID` column with foreign key to `tasks(id)`

2. **customer_id NOT NULL Constraint**
   - Current: Every link must have a `customer_id`
   - FileMaker: Links can exist for projects/tasks without explicit customer
   - **Impact**: Cannot create project-only or task-only links
   - **Required**: Make `customer_id` nullable (`ALTER COLUMN customer_id DROP NOT NULL`)

3. **No Polymorphic Constraint**
   - Current: All parent FKs can be NULL or multiple can be set
   - Expected: Exactly one parent entity should be set
   - **Impact**: Data integrity risk - links could have no parent or multiple parents
   - **Required**: Add check constraint to enforce exactly one non-null parent

### Minor Gaps

4. **No created_by/modified_by Tracking**
   - FileMaker: `~CreatedBy` tracks creator username
   - Supabase: No equivalent column
   - **Impact**: Audit trail lost
   - **Recommendation**: Add `created_by UUID` and `updated_by UUID` columns (optional)

5. **URL Length Limit**
   - FileMaker: Unlimited text field
   - Supabase: 2048 characters
   - **Impact**: Very long URLs may fail migration
   - **Mitigation**: Validate during migration, expand if needed

6. **No Modification Timestamp Auto-Update**
   - FileMaker: Auto-updates `~modificationTimestamp`
   - Supabase: Has `updated_at` column but no trigger
   - **Impact**: `updated_at` won't auto-update on modifications
   - **Recommendation**: Add trigger to update `updated_at` on row changes

## Field Mapping

### FileMaker → Supabase Mapping

| FileMaker Field | Supabase Column | Transformation | Notes |
|-----------------|-----------------|----------------|-------|
| `__ID` | `id` | Ignore (new UUID generated) | FileMaker UUIDs not compatible |
| `link` | `link` | Direct mapping | Validate length ≤ 2048 chars |
| `_fkID` | `project_id`, `task_id`, or `customer_id` | **Requires parent type detection** | Must determine which entity `_fkID` references |
| `~creationTimestamp` | `created_at` | Timestamp conversion | Preserve original creation time |
| `~modificationTimestamp` | `updated_at` | Timestamp conversion | Preserve modification time |
| `~CreatedBy` | *(unmapped)* | Lost in migration | No equivalent column (unless added) |

### Parent Entity Detection Logic

To migrate `_fkID` to the correct Supabase foreign key:

```sql
-- Pseudocode for migration logic
FOR EACH link IN filemaker_links:
  fm_id = link._fkID

  -- Check if _fkID matches a customer
  IF EXISTS (SELECT 1 FROM customers WHERE filemaker_id = fm_id):
    link.customer_id = (SELECT id FROM customers WHERE filemaker_id = fm_id)

  -- Check if _fkID matches a project
  ELSE IF EXISTS (SELECT 1 FROM projects WHERE filemaker_id = fm_id):
    link.project_id = (SELECT id FROM projects WHERE filemaker_id = fm_id)

  -- Check if _fkID matches a task
  ELSE IF EXISTS (SELECT 1 FROM tasks WHERE filemaker_id = fm_id):
    link.task_id = (SELECT id FROM tasks WHERE filemaker_id = fm_id)

  -- Orphaned link - log for manual review
  ELSE:
    LOG "Orphaned link: " + link.__ID + " references unknown _fkID: " + fm_id
    SKIP or ASSIGN TO default customer
END FOR
```

## Required Schema Changes

### 1. Add task_id Column

```sql
ALTER TABLE links
ADD COLUMN task_id UUID;

ALTER TABLE links
ADD CONSTRAINT links_task_id_fkey
  FOREIGN KEY (task_id)
  REFERENCES tasks(id)
  ON DELETE CASCADE;

CREATE INDEX idx_links_task_id ON links(task_id);
```

### 2. Make customer_id Nullable

```sql
ALTER TABLE links
ALTER COLUMN customer_id DROP NOT NULL;
```

### 3. Add Check Constraint for Exactly One Parent

```sql
ALTER TABLE links
ADD CONSTRAINT links_exactly_one_parent CHECK (
  (
    (customer_id IS NOT NULL AND project_id IS NULL AND task_id IS NULL)
    OR
    (project_id IS NOT NULL AND customer_id IS NULL AND task_id IS NULL)
    OR
    (task_id IS NOT NULL AND customer_id IS NULL AND project_id IS NULL)
  )
);
```

### 4. Optional: Add Audit Columns

```sql
ALTER TABLE links
ADD COLUMN created_by UUID,
ADD COLUMN updated_by UUID;

ALTER TABLE links
ADD CONSTRAINT links_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES users(id)
  ON DELETE SET NULL;

ALTER TABLE links
ADD CONSTRAINT links_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES users(id)
  ON DELETE SET NULL;
```

### 5. Optional: Add updated_at Trigger

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_links_updated_at
BEFORE UPDATE ON links
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

## Revised Supabase Schema

After applying all required changes:

```sql
CREATE TABLE links (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent entity foreign keys (exactly one must be non-null)
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,

  -- Link data
  link VARCHAR(2048) NOT NULL,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Ensure exactly one parent is set
  CONSTRAINT links_exactly_one_parent CHECK (
    (customer_id IS NOT NULL AND project_id IS NULL AND task_id IS NULL AND organization_id IS NULL)
    OR
    (project_id IS NOT NULL AND customer_id IS NULL AND task_id IS NULL AND organization_id IS NULL)
    OR
    (task_id IS NOT NULL AND customer_id IS NULL AND project_id IS NULL AND organization_id IS NULL)
    OR
    (organization_id IS NOT NULL AND customer_id IS NULL AND project_id IS NULL AND task_id IS NULL)
  )
);

-- Indexes
CREATE INDEX idx_links_customer_id ON links(customer_id);
CREATE INDEX idx_links_organization_id ON links(organization_id);
CREATE INDEX idx_links_project_id ON links(project_id);
CREATE INDEX idx_links_task_id ON links(task_id);
CREATE INDEX idx_links_created_at ON links(created_at);

-- Trigger for updated_at
CREATE TRIGGER update_links_updated_at
BEFORE UPDATE ON links
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

## Data Type Compatibility

| FileMaker Type | Supabase Type | Compatibility | Notes |
|----------------|---------------|---------------|-------|
| Text (UUID) | UUID | **Requires conversion** | FileMaker UUIDs may not be RFC-compliant |
| Text | VARCHAR(2048) | **Partial** | Length limit in Supabase |
| Timestamp | TIMESTAMPTZ | **Compatible** | Timezone handling needed |
| Text (username) | UUID (user reference) | **Incompatible** | Username → user_id lookup required |

## Migration Data Transformations

### ID Conversion

```javascript
// FileMaker UUIDs may need regeneration
// Do NOT preserve FileMaker __ID in Supabase
// Let Supabase generate new UUIDs via DEFAULT gen_random_uuid()
```

### Timestamp Conversion

```javascript
// FileMaker timestamps to PostgreSQL TIMESTAMPTZ
const created_at = new Date(filemake_record['~creationTimestamp']).toISOString();
const updated_at = new Date(filemaker_record['~modificationTimestamp']).toISOString();
```

### URL Validation

```javascript
// Validate URL length before insert
if (filemaker_record.link.length > 2048) {
  console.warn(`Link URL exceeds 2048 chars: ${filemaker_record.__ID}`);
  // Option 1: Truncate
  // Option 2: Use URL shortener
  // Option 3: Increase VARCHAR limit
  // Option 4: Skip and log
}

// Validate URL format
try {
  new URL(filemaker_record.link);
} catch {
  console.warn(`Invalid URL format: ${filemaker_record.link}`);
  // Skip or fix
}
```

### Creator Username Lookup

```javascript
// If adding created_by column:
const creator_username = filemaker_record['~CreatedBy'];
const creator_user = await db.query(
  'SELECT id FROM users WHERE username = $1',
  [creator_username]
);
const created_by = creator_user?.id || null;
```

## Row-Level Security Implications

After schema changes, RLS policies must account for all parent entity types:

```sql
-- Example RLS policy for viewing links
CREATE POLICY "Users can view links for entities they can access"
ON links FOR SELECT
USING (
  -- Customer-level access
  (customer_id IN (SELECT id FROM customers WHERE organization_id = current_org_id()))
  OR
  -- Project-level access
  (project_id IN (SELECT id FROM projects WHERE organization_id = current_org_id()))
  OR
  -- Task-level access
  (task_id IN (SELECT id FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE organization_id = current_org_id())))
  OR
  -- Organization-level access
  (organization_id = current_org_id())
);
```

## Validation Queries

After migration, run these queries to verify data integrity:

```sql
-- Verify no links have multiple parents
SELECT * FROM links
WHERE (customer_id IS NOT NULL)::int
  + (project_id IS NOT NULL)::int
  + (task_id IS NOT NULL)::int
  + (organization_id IS NOT NULL)::int > 1;

-- Verify all links have exactly one parent
SELECT * FROM links
WHERE (customer_id IS NOT NULL)::int
  + (project_id IS NOT NULL)::int
  + (task_id IS NOT NULL)::int
  + (organization_id IS NOT NULL)::int = 0;

-- Verify all foreign keys reference existing records
SELECT COUNT(*) FROM links
WHERE customer_id IS NOT NULL
  AND customer_id NOT IN (SELECT id FROM customers);

SELECT COUNT(*) FROM links
WHERE project_id IS NOT NULL
  AND project_id NOT IN (SELECT id FROM projects);

SELECT COUNT(*) FROM links
WHERE task_id IS NOT NULL
  AND task_id NOT IN (SELECT id FROM tasks);

-- Verify URL lengths
SELECT COUNT(*) FROM links WHERE LENGTH(link) > 2048;

-- Compare counts
SELECT COUNT(*) FROM filemaker_links; -- Should match
SELECT COUNT(*) FROM links;           -- Total migrated
```

## Summary

**Critical Changes Required:**
1. ✅ Add `task_id` column with foreign key
2. ✅ Make `customer_id` nullable
3. ✅ Add check constraint for exactly one parent

**Recommended Changes:**
4. ⚠️ Add `created_by` and `updated_by` audit columns
5. ⚠️ Add trigger for `updated_at` auto-update
6. ⚠️ Consider increasing `link` VARCHAR limit if needed

**Migration Complexity:**
- **Medium**: Requires parent entity type detection logic
- **Dependency**: Must migrate customers, projects, tasks FIRST to have UUID mapping
- **Risk**: Orphaned links if parent entities not found
