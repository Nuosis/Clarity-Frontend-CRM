# Tasks & Timer - Data Model Mapping

## Overview

This document maps FileMaker layouts and fields to Supabase tables and columns for the Tasks and Timer feature migration.

## Entity Relationships

```
customers (Supabase)
    ↓ 1:N
projects (Supabase)
    ↓ 1:N
tasks (Supabase)
    ↓ 1:N
time_entries (Supabase)
    ↓ 1:1
customer_sales (Supabase)
```

## FileMaker → Supabase Mapping

### Tasks (devTasks → tasks)

| FileMaker Field | Type | Supabase Column | Type | Notes |
|---|---|---|---|---|
| `__ID` | Number | `filemaker_task_id` | TEXT | Original FM ID for reference |
| - | - | `id` | UUID | New Supabase primary key |
| `_projectID` | Number (FK) | `project_id` | UUID (FK) | Maps to projects(id) |
| `_staffID` | Number (FK) | `staff_id` | UUID (FK) | Maps to staff(id) or users(id) |
| `task` | Text | `title` | TEXT | Task title/description |
| `type` | Text | `task_type` | TEXT | Task category |
| `f_completed` | Number (0/1) | `is_completed` | BOOLEAN | Completion status |
| `notes` | Text | `notes` | TEXT | Additional notes |
| `DateCreated` | Date | `created_at` | TIMESTAMPTZ | Auto-set on insert |
| `DateModified` | Date | `updated_at` | TIMESTAMPTZ | Auto-update trigger |
| - | - | `organization_id` | UUID (FK) | For RLS scoping |
| - | - | `customer_id` | UUID (FK) | Denormalized from project |
| - | - | `estimated_hours` | NUMERIC | Optional estimation |
| - | - | `actual_hours` | NUMERIC | Sum from time_entries |
| - | - | `status` | TEXT | 'pending', 'in_progress', 'completed', 'cancelled' |
| - | - | `priority` | INTEGER | Task priority (1-5) |
| - | - | `due_date` | DATE | Optional due date |

**Indexes Needed:**
- `project_id` (frequent filtering)
- `staff_id` (assigned tasks query)
- `organization_id` (RLS)
- `is_completed` (active tasks filter)
- `customer_id` (customer task rollup)

**Constraints:**
- `project_id` NOT NULL (tasks must belong to project)
- `organization_id` NOT NULL (RLS requirement)
- Foreign keys: `project_id`, `staff_id`, `customer_id`, `organization_id`
- Check: `priority BETWEEN 1 AND 5`

---

### Time Entries (dapiRecords → time_entries)

| FileMaker Field | Type | Supabase Column | Type | Notes |
|---|---|---|---|---|
| `__ID` | Number | `filemaker_record_id` | TEXT | Original FM ID for reference |
| - | - | `id` | UUID | New Supabase primary key |
| `_taskID` | Number (FK) | `task_id` | UUID (FK) | Maps to tasks(id) |
| `_projectID` | Number (FK) | `project_id` | UUID (FK) | Maps to projects(id) |
| `_custID` | Number (FK) | `customer_id` | UUID (FK) | Maps to customers(id) |
| `_staffID` | Number (FK) | `staff_id` | UUID (FK) | Maps to staff(id) |
| `TimeStart` | Time (HH:MM:SS) | `start_time` | TIMESTAMPTZ | Combined with DateStart |
| `DateStart` | Date (MM/DD/YYYY) | `start_time` | TIMESTAMPTZ | Combined with TimeStart |
| `TimeEnd` | Time (HH:MM:SS) | `end_time` | TIMESTAMPTZ | Combined with DateStart (or next day) |
| `Work Performed` | Text | `description` | TEXT | Work description |
| `TimeAdjust` | Number (seconds) | `adjustment_seconds` | INTEGER | Manual time adjustment |
| Duration (calc) | Number (minutes) | `duration_minutes` | NUMERIC | Calculated: (end_time - start_time - adjustment) / 60 |
| BillableAmount (calc) | Number | `billable_amount` | NUMERIC(10,2) | Calculated: duration * hourly_rate |
| - | - | `organization_id` | UUID (FK) | For RLS scoping |
| - | - | `hourly_rate` | NUMERIC(10,2) | Rate at time of entry |
| - | - | `is_billable` | BOOLEAN | Default true |
| - | - | `status` | TEXT | 'active', 'paused', 'completed' |
| - | - | `pause_duration_seconds` | INTEGER | Total pause time |
| - | - | `created_at` | TIMESTAMPTZ | Auto-set on insert |
| - | - | `updated_at` | TIMESTAMPTZ | Auto-update trigger |
| - | - | `completed_at` | TIMESTAMPTZ | When timer stopped |

**Indexes Needed:**
- `task_id` (timer lookup by task)
- `project_id` (project time rollup)
- `customer_id` (customer billing queries)
- `staff_id` (staff timesheet)
- `organization_id` (RLS)
- `status` (active timers query)
- `start_time` (date range queries)
- Composite: `(staff_id, status)` for active timer check

**Constraints:**
- `task_id` NOT NULL (time entries must have task)
- `project_id` NOT NULL (denormalized for performance)
- `customer_id` NOT NULL (denormalized for billing)
- `staff_id` NOT NULL (who performed work)
- `organization_id` NOT NULL (RLS requirement)
- `start_time` NOT NULL (timer must have start)
- `end_time` NULL when status='active' or 'paused'
- Check: `end_time IS NULL OR end_time > start_time`
- Check: `duration_minutes >= 0`
- Check: `status IN ('active', 'paused', 'completed')`
- Foreign keys: `task_id`, `project_id`, `customer_id`, `staff_id`, `organization_id`

**Unique Constraint:**
- One active timer per (staff_id, status='active') to prevent duplicate active timers

---

### Financial Records (dapiRecords → customer_sales)

**Note:** Time entries create corresponding `customer_sales` records on timer stop. This is a 1:1 relationship.

| FileMaker Field | Type | Supabase Column | Type | Notes |
|---|---|---|---|---|
| `__ID` | Number | `filemaker_record_id` | TEXT | Original FM ID (same as time_entry) |
| - | - | `id` | UUID | Supabase primary key |
| - | - | `time_entry_id` | UUID (FK) | Maps to time_entries(id) |
| `_custID` | Number (FK) | `customer_id` | UUID (FK) | Maps to customers(id) |
| `_projectID` | Number (FK) | `project_id` | UUID (FK) | Maps to projects(id) |
| `_taskID` | Number (FK) | `task_id` | UUID (FK) | Maps to tasks(id) (nullable) |
| `_staffID` | Number (FK) | `staff_id` | UUID (FK) | Maps to staff(id) |
| `DateStart` | Date | `date` | DATE | Service date |
| `Work Performed` | Text | `description` | TEXT | Work description |
| Duration (calc) | Number (minutes) | `duration` | NUMERIC | Same as time_entries.duration_minutes |
| BillableAmount (calc) | Number | `amount` | NUMERIC(10,2) | Billable amount |
| - | - | `organization_id` | UUID (FK) | For RLS scoping |
| - | - | `status` | TEXT | 'draft', 'invoiced', 'paid' |
| - | - | `is_billable` | BOOLEAN | Default true |
| - | - | `invoice_id` | UUID (FK) | When invoiced (nullable) |
| - | - | `quickbooks_id` | TEXT | QB integration (nullable) |
| - | - | `created_at` | TIMESTAMPTZ | Auto-set on insert |
| - | - | `updated_at` | TIMESTAMPTZ | Auto-update trigger |

**Indexes Needed:**
- `time_entry_id` (1:1 relationship)
- `customer_id` (customer billing)
- `project_id` (project billing)
- `organization_id` (RLS)
- `date` (date range queries)
- `status` (unbilled/unpaid queries)
- Composite: `(customer_id, status)` for customer billing queries

**Constraints:**
- `customer_id` NOT NULL
- `organization_id` NOT NULL
- `date` NOT NULL
- `amount >= 0`
- `status IN ('draft', 'invoiced', 'paid')`
- Foreign keys: `time_entry_id`, `customer_id`, `project_id`, `task_id`, `staff_id`, `organization_id`, `invoice_id`
- Unique: `time_entry_id` (one sale per time entry)

---

## Supporting Tables

### filemaker_id_mappings

Used during migration and dual-write to correlate FileMaker IDs with Supabase UUIDs.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `organization_id` | UUID (FK) | For scoping |
| `entity_type` | TEXT | 'task', 'time_entry', 'customer', 'project', 'staff' |
| `filemaker_id` | TEXT | Original FileMaker __ID |
| `supabase_uuid` | UUID | Corresponding Supabase record ID |
| `created_at` | TIMESTAMPTZ | When mapping created |

**Indexes:**
- Composite unique: `(entity_type, filemaker_id)`
- `supabase_uuid` (reverse lookup)
- `organization_id` (RLS)

---

## Data Type Conversions

### Time/Date Handling

**FileMaker Format:**
- Time: `"14:30:00"` (HH:MM:SS string)
- Date: `"01/10/2026"` (MM/DD/YYYY string)

**Supabase Format:**
- TIMESTAMPTZ: `"2026-01-10T14:30:00+00:00"` (ISO 8601 UTC)

**Conversion Logic:**
```javascript
// FileMaker → Supabase
function convertFileMakerDateTime(date, time) {
  // Parse MM/DD/YYYY
  const [month, day, year] = date.split('/').map(Number);
  // Parse HH:MM:SS
  const [hours, minutes, seconds] = time.split(':').map(Number);

  // Create date in local timezone
  const localDate = new Date(year, month - 1, day, hours, minutes, seconds);

  // Convert to UTC ISO string
  return localDate.toISOString();
}

// Supabase → FileMaker (for backwards compatibility)
function convertSupabaseToFileMaker(timestamptz) {
  const date = new Date(timestamptz);

  return {
    date: `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`,
    time: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
  };
}
```

### Boolean Conversion

**FileMaker:** `0` (false), `1` (true)
**Supabase:** `false`, `true`

```javascript
// FM → Supabase
const isCompleted = fmRecord.f_completed === 1;

// Supabase → FM
const f_completed = sbRecord.is_completed ? 1 : 0;
```

### Numeric Precision

**Duration:**
- FileMaker: Calculated field (minutes)
- Supabase: `NUMERIC` (exact decimal)

**Billable Amount:**
- FileMaker: Calculated field (currency)
- Supabase: `NUMERIC(10,2)` (dollars and cents)

---

## Schema DDL

### tasks Table

```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,

  title TEXT NOT NULL,
  task_type TEXT,
  notes TEXT,

  is_completed BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),

  estimated_hours NUMERIC(10,2),
  actual_hours NUMERIC(10,2),
  due_date DATE,

  filemaker_task_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_customer_id ON tasks(customer_id);
CREATE INDEX idx_tasks_staff_id ON tasks(staff_id);
CREATE INDEX idx_tasks_organization_id ON tasks(organization_id);
CREATE INDEX idx_tasks_is_completed ON tasks(is_completed);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_filemaker_id ON tasks(filemaker_task_id);

-- Updated_at trigger
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### time_entries Table

```sql
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,

  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  description TEXT,

  adjustment_seconds INTEGER NOT NULL DEFAULT 0,
  pause_duration_seconds INTEGER NOT NULL DEFAULT 0,
  duration_minutes NUMERIC(10,2),

  hourly_rate NUMERIC(10,2),
  billable_amount NUMERIC(10,2),
  is_billable BOOLEAN NOT NULL DEFAULT true,

  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),

  filemaker_record_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,

  CONSTRAINT end_time_after_start CHECK (end_time IS NULL OR end_time > start_time),
  CONSTRAINT duration_non_negative CHECK (duration_minutes IS NULL OR duration_minutes >= 0)
);

-- Indexes
CREATE INDEX idx_time_entries_task_id ON time_entries(task_id);
CREATE INDEX idx_time_entries_project_id ON time_entries(project_id);
CREATE INDEX idx_time_entries_customer_id ON time_entries(customer_id);
CREATE INDEX idx_time_entries_staff_id ON time_entries(staff_id);
CREATE INDEX idx_time_entries_organization_id ON time_entries(organization_id);
CREATE INDEX idx_time_entries_status ON time_entries(status);
CREATE INDEX idx_time_entries_start_time ON time_entries(start_time);
CREATE INDEX idx_time_entries_staff_status ON time_entries(staff_id, status);
CREATE INDEX idx_time_entries_filemaker_id ON time_entries(filemaker_record_id);

-- Unique constraint: one active timer per staff member
CREATE UNIQUE INDEX idx_one_active_timer_per_staff ON time_entries(staff_id) WHERE status = 'active';

-- Updated_at trigger
CREATE TRIGGER update_time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### customer_sales Updates

```sql
-- Add time_entry_id column to existing customer_sales table
ALTER TABLE customer_sales ADD COLUMN time_entry_id UUID REFERENCES time_entries(id) ON DELETE SET NULL;

-- Add unique constraint
CREATE UNIQUE INDEX idx_customer_sales_time_entry_id ON customer_sales(time_entry_id) WHERE time_entry_id IS NOT NULL;

-- Add index
CREATE INDEX idx_customer_sales_time_entry ON customer_sales(time_entry_id);
```

---

## Migration Considerations

### ID Reconciliation

**Step 1:** Extract all FileMaker IDs and create mapping table
```sql
INSERT INTO filemaker_id_mappings (organization_id, entity_type, filemaker_id, supabase_uuid)
SELECT
  'org-uuid',
  'task',
  __ID::text,
  gen_random_uuid()
FROM filemaker_tasks;
```

**Step 2:** Use mappings during data import
```sql
INSERT INTO tasks (id, project_id, title, ...)
SELECT
  m.supabase_uuid,
  pm.supabase_uuid,  -- project mapping
  ft.task,
  ...
FROM filemaker_tasks ft
JOIN filemaker_id_mappings m ON m.filemaker_id = ft.__ID::text AND m.entity_type = 'task'
JOIN filemaker_id_mappings pm ON pm.filemaker_id = ft._projectID::text AND pm.entity_type = 'project';
```

### Time Entry Duration Calculation

FileMaker calculates duration automatically. For Supabase, use a trigger or application logic:

```sql
CREATE OR REPLACE FUNCTION calculate_time_entry_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.end_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
    -- Calculate duration in minutes
    NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60.0
                           - (NEW.adjustment_seconds / 60.0)
                           - (NEW.pause_duration_seconds / 60.0);

    -- Ensure non-negative
    NEW.duration_minutes := GREATEST(NEW.duration_minutes, 0);

    -- Calculate billable amount
    IF NEW.hourly_rate IS NOT NULL THEN
      NEW.billable_amount := (NEW.duration_minutes / 60.0) * NEW.hourly_rate;
    END IF;

    -- Set completed_at timestamp
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
      NEW.completed_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_duration_before_update
  BEFORE INSERT OR UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION calculate_time_entry_duration();
```

### Actual Hours Rollup

Tasks should show `actual_hours` as sum of related time entries:

```sql
CREATE OR REPLACE FUNCTION update_task_actual_hours()
RETURNS TRIGGER AS $$
BEGIN
  -- Update parent task's actual_hours
  UPDATE tasks
  SET actual_hours = (
    SELECT COALESCE(SUM(duration_minutes) / 60.0, 0)
    FROM time_entries
    WHERE task_id = NEW.task_id
      AND status = 'completed'
  )
  WHERE id = NEW.task_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_task_hours_after_time_entry
  AFTER INSERT OR UPDATE ON time_entries
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION update_task_actual_hours();
```

---

## Summary

**Total Tables:**
- `tasks` (new/updated)
- `time_entries` (new)
- `customer_sales` (updated with `time_entry_id`)
- `filemaker_id_mappings` (migration support)

**Total Columns:**
- tasks: 18 columns
- time_entries: 20 columns
- customer_sales: +1 column

**Foreign Key Relationships:**
- tasks → projects, customers, staff, organizations
- time_entries → tasks, projects, customers, staff, organizations
- customer_sales → time_entries

**Indexes:** 25+ indexes for performance
**Triggers:** 4 triggers (updated_at, duration calculation, actual hours rollup)
