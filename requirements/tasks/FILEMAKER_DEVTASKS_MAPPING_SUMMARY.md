# FileMaker devTasks to Supabase Mapping - Summary Report

**Date:** 2026-01-10
**Task:** Map FileMaker devTasks layout to Supabase schema
**Status:** ✅ Verified and Documented

## Executive Summary

This document provides a complete mapping between the FileMaker `devTasks` layout and the target Supabase `tasks` table schema. The analysis confirms that:

1. **Supabase `tasks` table does NOT exist** - needs to be created
2. **Related task tables exist**: `tasks_scheduled`, `tasks_paused`, `task_dependencies`, `task_executions`, `task_state_transitions`, `task_templates`, `task_execution_steps`, `task_rollback_actions`
3. **Comprehensive mapping documentation exists** in `requirements/tasks/data-model-mapping.md`
4. **Current implementation documented** in `requirements/tasks/current-implementation.md`

---

## FileMaker Layout: devTasks

**Layout Constant:** `Layouts.TASKS = 'devTasks'`
**File Reference:** `src/api/fileMaker.js:414`
**API Implementation:** `src/api/tasks.js`

### Field Structure

Based on code analysis from `src/api/tasks.js` and existing documentation:

| FileMaker Field | Data Type | Usage in Code | Description |
|-----------------|-----------|---------------|-------------|
| `__ID` | Number | Primary key | FileMaker internal record ID |
| `_projectID` | Number (FK) | Foreign key | Links to devProjects layout |
| `_staffID` | Number (FK) | Foreign key | Assigned staff member |
| `task` | Text | Task title | Main task description/title |
| `type` | Text | Task category | Task type classification |
| `f_completed` | Number | Boolean (0/1) | Completion status flag |
| `notes` | Text | Additional info | Extended task notes |
| `DateCreated` | Date | Auto-timestamp | Record creation date |
| `DateModified` | Date | Auto-timestamp | Last modification date |

### Code Evidence

**Task Creation** (`src/api/tasks.js:46-70`):
```javascript
createTask(data) {
  const params = {
    layout: Layouts.TASKS,  // 'devTasks'
    action: Actions.CREATE,
    fieldData: data
  };
}
```

**Task Update** (`src/api/tasks.js:78-91`):
```javascript
updateTask(taskId, data) {
  const params = {
    layout: Layouts.TASKS,
    action: Actions.UPDATE,
    recordId: taskId,
    fieldData: data
  };
}
```

**Status Toggle** (`src/api/tasks.js:99-114`):
```javascript
updateTaskStatus(taskId, completed) {
  const params = {
    layout: Layouts.TASKS,
    action: Actions.UPDATE,
    recordId: taskId,
    fieldData: {
      f_completed: completed ? 1 : 0  // Boolean conversion
    }
  };
}
```

---

## Target Supabase Schema: tasks

**Current Status:** ❌ Table does not exist
**Verification:** SSH query to `supabase-db` returned `f` (false)

```bash
ssh marcus@backend.claritybusinesssolutions.ca \
  "docker exec supabase-db psql -U postgres -d postgres \
  -c \"SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tasks');\""
# Result: f (false)
```

### Proposed Schema (from data-model-mapping.md)

```sql
CREATE TABLE tasks (
  -- Primary Keys
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filemaker_task_id TEXT,  -- Original FM __ID for migration

  -- Foreign Keys
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,

  -- Core Fields
  title TEXT NOT NULL,  -- Maps from FileMaker 'task' field
  task_type TEXT,       -- Maps from FileMaker 'type' field
  notes TEXT,           -- Direct mapping

  -- Status & Completion
  is_completed BOOLEAN NOT NULL DEFAULT false,  -- Maps from f_completed (0/1 → false/true)
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),

  -- Time Tracking
  estimated_hours NUMERIC(10,2),
  actual_hours NUMERIC(10,2),  -- Calculated from time_entries rollup
  due_date DATE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),  -- Maps from DateCreated
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()   -- Maps from DateModified
);
```

---

## Field-by-Field Mapping

### Primary Key Mapping

| FileMaker | Supabase | Transformation |
|-----------|----------|----------------|
| `__ID` (Number) | `filemaker_task_id` (TEXT) | Convert to string, store for reference |
| N/A | `id` (UUID) | New primary key: `gen_random_uuid()` |

### Foreign Key Mapping

| FileMaker Field | Type | Supabase Field | Type | Transformation Required |
|-----------------|------|----------------|------|------------------------|
| `_projectID` | Number | `project_id` | UUID | ✅ Lookup via `filemaker_id_mappings` |
| `_staffID` | Number | `staff_id` | UUID | ✅ Lookup via `filemaker_id_mappings` |
| N/A | - | `customer_id` | UUID | ✅ Denormalized from project relationship |
| N/A | - | `organization_id` | UUID | ✅ Required for RLS, from user context |

**ID Resolution Strategy:**
```sql
-- Example ID mapping lookup
SELECT supabase_uuid
FROM filemaker_id_mappings
WHERE entity_type = 'project'
  AND filemaker_id = '12345'::text;
```

### Core Data Fields

| FileMaker Field | Type | Supabase Field | Type | Notes |
|-----------------|------|----------------|------|-------|
| `task` | Text | `title` | TEXT NOT NULL | Direct mapping, field name change |
| `type` | Text | `task_type` | TEXT | Direct mapping, field name change |
| `notes` | Text | `notes` | TEXT | Direct mapping, same name |

### Boolean Conversion

| FileMaker Field | Values | Supabase Field | Values | Conversion Logic |
|-----------------|--------|----------------|--------|------------------|
| `f_completed` | 0, 1 | `is_completed` | false, true | `fmValue === 1 ? true : false` |

**Code Evidence** (`src/api/tasks.js:108`):
```javascript
f_completed: completed ? 1 : 0  // Supabase boolean → FM integer
```

**Reverse Conversion:**
```javascript
const isCompleted = fmRecord.f_completed === 1;
```

### Timestamp Conversion

| FileMaker Field | Format | Supabase Field | Format | Conversion |
|-----------------|--------|----------------|--------|------------|
| `DateCreated` | MM/DD/YYYY | `created_at` | TIMESTAMPTZ (ISO 8601) | Parse and convert to UTC |
| `DateModified` | MM/DD/YYYY | `updated_at` | TIMESTAMPTZ (ISO 8601) | Parse and convert to UTC |

**Conversion Function:**
```javascript
function convertFileMakerDate(dateString) {
  // Input: "01/10/2026" (MM/DD/YYYY)
  const [month, day, year] = dateString.split('/').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toISOString(); // Output: "2026-01-10T00:00:00.000Z"
}
```

### New Fields (Supabase-only)

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `status` | TEXT | 'pending' | Enhanced state machine: pending → in_progress → completed/cancelled |
| `priority` | INTEGER | 3 | Task prioritization (1=highest, 5=lowest) |
| `estimated_hours` | NUMERIC(10,2) | NULL | Time estimation for planning |
| `actual_hours` | NUMERIC(10,2) | NULL | Calculated from `time_entries` rollup |
| `due_date` | DATE | NULL | Optional deadline tracking |
| `customer_id` | UUID | (from project) | Denormalized for query performance |
| `organization_id` | UUID | (from context) | Required for Row-Level Security |

---

## Indexes

**Performance-Critical Indexes:**

```sql
-- Primary lookup patterns
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_customer_id ON tasks(customer_id);
CREATE INDEX idx_tasks_staff_id ON tasks(staff_id);
CREATE INDEX idx_tasks_organization_id ON tasks(organization_id);

-- Filtering indexes
CREATE INDEX idx_tasks_is_completed ON tasks(is_completed);
CREATE INDEX idx_tasks_status ON tasks(status);

-- Migration support
CREATE INDEX idx_tasks_filemaker_id ON tasks(filemaker_task_id);
```

**Query Patterns Supported:**
- Fetch all tasks for a project: `WHERE project_id = ?`
- Fetch active tasks: `WHERE is_completed = false`
- Fetch assigned tasks: `WHERE staff_id = ? AND is_completed = false`
- Migration reconciliation: `WHERE filemaker_task_id = ?`

---

## Constraints

### NOT NULL Constraints

```sql
-- Required fields
project_id NOT NULL          -- Tasks must belong to project
organization_id NOT NULL     -- RLS requirement
title NOT NULL               -- Task must have description
is_completed NOT NULL        -- Explicit true/false (no NULL ambiguity)
status NOT NULL              -- Always has explicit status
created_at NOT NULL          -- Always record creation time
updated_at NOT NULL          -- Always record modification time
```

### CHECK Constraints

```sql
-- Status must be valid
CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))

-- Priority must be 1-5
CHECK (priority BETWEEN 1 AND 5)
```

### Foreign Key Constraints

```sql
FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
```

**Cascade Behavior:**
- **Delete project** → Delete all project tasks (CASCADE)
- **Delete customer** → Delete all customer tasks (CASCADE)
- **Delete staff** → Set tasks to unassigned (SET NULL)
- **Delete organization** → Delete all organization tasks (CASCADE)

---

## Triggers

### Auto-Update Timestamp

```sql
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Behavior:** Automatically set `updated_at = now()` on every UPDATE operation

### Actual Hours Rollup

```sql
-- Trigger on time_entries table
CREATE TRIGGER update_task_hours_after_time_entry
  AFTER INSERT OR UPDATE ON time_entries
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION update_task_actual_hours();
```

**Function Logic:**
```sql
CREATE OR REPLACE FUNCTION update_task_actual_hours()
RETURNS TRIGGER AS $$
BEGIN
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
```

---

## Related Tables

### time_entries (Timer Records)

**FileMaker Layout:** `dapiRecords` (Layouts.RECORDS)
**Relationship:** 1 task → N time_entries

```sql
CREATE TABLE time_entries (
  id UUID PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  -- ... other fields
);
```

### customer_sales (Financial Records)

**Relationship:** 1 time_entry → 1 customer_sales

```sql
ALTER TABLE customer_sales
ADD COLUMN time_entry_id UUID REFERENCES time_entries(id);
```

---

## Migration Strategy

### Phase 1: Schema Creation

```sql
-- Create tasks table with indexes and constraints
-- Create triggers for auto-update and rollup calculations
```

### Phase 2: Data Migration

1. **Create ID mappings** for all entities (tasks, projects, staff, customers)
2. **Extract FileMaker data** from devTasks layout
3. **Transform data** using mapping functions
4. **Load into Supabase** with proper UUID references
5. **Verify data integrity** with reconciliation queries

### Phase 3: Dual-Write Period

- FileMaker remains source of truth
- Supabase receives writes via `dualWriteService.js`
- Periodic reconciliation to fix discrepancies

### Phase 4: Cutover

- Switch read operations to Supabase
- Deprecate FileMaker writes
- Remove dual-write service

---

## API Integration Points

### Current FileMaker API Usage

**File:** `src/api/tasks.js`

**Functions:**
- `fetchTasks(projectId, query)` → READ from devTasks
- `fetchTasksForProject(projectId)` → READ with filter
- `createTask(data)` → CREATE in devTasks
- `updateTask(taskId, data)` → UPDATE in devTasks
- `updateTaskStatus(taskId, completed)` → UPDATE f_completed
- `updateTaskNotes(taskId, notes)` → UPDATE notes

### Future Supabase API

**Backend Endpoint:** `https://api.claritybusinesssolutions.ca/api/tasks`

**Expected Operations:**
- `GET /api/tasks?project_id={uuid}` → Fetch tasks by project
- `POST /api/tasks` → Create new task
- `PATCH /api/tasks/{uuid}` → Update task
- `DELETE /api/tasks/{uuid}` → Delete task

**Authentication:** HMAC-SHA256 via `generateBackendAuthHeader()`

---

## Data Transformation Examples

### Example 1: FileMaker Task → Supabase Task

**FileMaker Record:**
```json
{
  "__ID": "12345",
  "_projectID": "67890",
  "_staffID": "11111",
  "task": "Implement user authentication",
  "type": "Development",
  "f_completed": 0,
  "notes": "Use JWT tokens",
  "DateCreated": "01/05/2026",
  "DateModified": "01/10/2026"
}
```

**Supabase Record:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "filemaker_task_id": "12345",
  "organization_id": "org-uuid-123",
  "project_id": "proj-uuid-from-mapping-67890",
  "customer_id": "cust-uuid-from-project",
  "staff_id": "staff-uuid-from-mapping-11111",
  "title": "Implement user authentication",
  "task_type": "Development",
  "notes": "Use JWT tokens",
  "is_completed": false,
  "status": "pending",
  "priority": 3,
  "estimated_hours": null,
  "actual_hours": null,
  "due_date": null,
  "created_at": "2026-01-05T00:00:00.000Z",
  "updated_at": "2026-01-10T00:00:00.000Z"
}
```

### Example 2: Task Status Update

**FileMaker Update:**
```javascript
{
  layout: "devTasks",
  recordId: "12345",
  fieldData: {
    f_completed: 1
  }
}
```

**Supabase Update:**
```sql
UPDATE tasks
SET
  is_completed = true,
  status = 'completed',
  updated_at = now()
WHERE filemaker_task_id = '12345';
```

---

## Known Issues & Limitations

### 1. ID Reconciliation Complexity
- **Issue:** FileMaker uses integer IDs, Supabase uses UUIDs
- **Impact:** Requires mapping table and lookup logic
- **Mitigation:** `filemaker_id_mappings` table with indexes

### 2. Denormalized customer_id
- **Issue:** FileMaker stores customer via project relationship only
- **Impact:** Must fetch customer_id from project on task creation
- **Mitigation:** Store customer_id in tasks table for performance

### 3. Status Enum Mismatch
- **Issue:** FileMaker only has `f_completed` (binary), Supabase has richer status
- **Impact:** Loss of in-progress state during migration
- **Mitigation:** Map: f_completed=0 → 'pending', f_completed=1 → 'completed'

### 4. Time Zone Handling
- **Issue:** FileMaker stores local dates, Supabase expects UTC timestamps
- **Impact:** Potential timezone conversion errors
- **Mitigation:** Explicit conversion logic with timezone awareness

### 5. Actual Hours Calculation
- **Issue:** FileMaker calculates on-the-fly, Supabase needs trigger-based rollup
- **Impact:** Performance overhead on time_entries insert/update
- **Mitigation:** Use trigger with COALESCE to handle NULL gracefully

---

## Verification Checklist

### ✅ Completed
- [x] Verify Supabase tasks table existence (Result: does not exist)
- [x] Document FileMaker devTasks field structure
- [x] Map all FileMaker fields to Supabase columns
- [x] Document data type conversions
- [x] Identify indexes needed
- [x] Define constraints (NOT NULL, CHECK, FK)
- [x] Design triggers (updated_at, actual_hours)
- [x] Review existing documentation accuracy

### ⏳ Pending (Backend Team)
- [ ] Create Supabase tasks table schema
- [ ] Create filemaker_id_mappings table
- [ ] Implement update_updated_at_column() function
- [ ] Implement update_task_actual_hours() function
- [ ] Create all indexes
- [ ] Set up Row-Level Security policies
- [ ] Backend API endpoint implementation

### 📋 Frontend Tasks (After Backend Complete)
- [ ] Update src/api/tasks.js to use Supabase
- [ ] Implement ID mapping service
- [ ] Update TaskList.jsx for new schema
- [ ] Update TaskTimer.jsx for new relationships
- [ ] Test task CRUD operations
- [ ] Test timer → time_entry → customer_sales flow

---

## References

**Code Files:**
- `src/api/tasks.js:1-317` - Task API operations
- `src/api/fileMaker.js:414` - Layout constants
- `src/services/dualWriteService.js` - Dual-write implementation

**Documentation:**
- `requirements/tasks/data-model-mapping.md` - Complete schema design
- `requirements/tasks/current-implementation.md` - Current implementation analysis
- `requirements/tasks/migration-plan.md` - Migration strategy

**Database Verification:**
```bash
ssh marcus@backend.claritybusinesssolutions.ca \
  "docker exec supabase-db psql -U postgres -d postgres -c '\\d+ tasks'"
```

---

**Document Version:** 1.0
**Last Updated:** 2026-01-10
**Next Review:** After backend schema creation
