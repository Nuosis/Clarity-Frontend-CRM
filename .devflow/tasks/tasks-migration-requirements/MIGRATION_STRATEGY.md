# Historical Tasks and Timer Records Migration Strategy

**Document Version:** 1.0
**Date:** 2026-01-10
**Status:** Draft - Awaiting Backend Team Approval
**Task Reference:** TSK0012 - Create migration strategy document

---

## Executive Summary

This document defines the comprehensive strategy for migrating historical tasks and timer/financial records from FileMaker to Supabase. The migration will transfer approximately **10,000+ tasks** and **50,000+ timer records** with complete referential integrity, zero data loss, and minimal disruption to users.

**Key Migration Characteristics:**
- **Approach:** Big-bang historical data migration followed by dual-write period
- **Estimated Data Volume:** 10,000 tasks, 50,000 timer records
- **Critical Dependencies:** Projects, Customers, Staff tables must exist in Supabase
- **ID Strategy:** Direct UUID mapping from FileMaker `__ID` to Supabase primary keys
- **Reconciliation:** Multi-phase validation with automated consistency checks
- **Rollback:** Supported via backup snapshots and migration reversal scripts
- **Target Completion:** Q1 2026

**Migration Phases:**
1. **Phase 0:** Schema deployment and validation (2 weeks)
2. **Phase 1:** Historical data migration (1 week)
3. **Phase 2:** Dual-write implementation (2 weeks)
4. **Phase 3:** Validation and reconciliation (2 weeks)
5. **Phase 4:** Cutover to Supabase-only (1 week)
6. **Phase 5:** Cleanup and decommission (1 week)

---

## Table of Contents

1. [Background and Context](#background-and-context)
2. [Migration Goals and Success Criteria](#migration-goals-and-success-criteria)
3. [Data Inventory and Assessment](#data-inventory-and-assessment)
4. [ID Reconciliation Strategy](#id-reconciliation-strategy)
5. [Data Transformation Requirements](#data-transformation-requirements)
6. [Migration Phases](#migration-phases)
7. [Reconciliation and Validation Strategy](#reconciliation-and-validation-strategy)
8. [Risk Assessment and Mitigation](#risk-assessment-and-mitigation)
9. [Rollback Plan](#rollback-plan)
10. [Code References](#code-references)
11. [Next Steps and Approval Requirements](#next-steps-and-approval-requirements)

---

## Background and Context

### Current State

**FileMaker Implementation** (Source of Truth):
- **Tasks:** Stored in `devTasks` layout (~10,000 records)
- **Timer Records:** Stored in `devRecords` layout (~50,000 records)
- **Financial Records:** Generated on timer stop, synced to Supabase `customer_sales`
- **API Layer:** FileMaker Data API via `src/api/tasks.js`, `src/api/financialRecords.js`
- **Business Logic:** `src/services/taskService.js`, `src/services/financialSyncService.js`
- **UI Components:** `src/components/tasks/TaskTimer.jsx`, `src/components/tasks/TaskDetails.jsx`

**Supabase Status:**
- ❌ No `tasks` table exists (automation tables only: `tasks_scheduled`, `task_executions`, etc.)
- ❌ No `time_entries` table exists
- ✅ `customer_sales` table exists and receives financial records from timer stops
- ✅ `projects`, `customers`, `organizations` tables exist
- ⚠️ Partial dual-write exists via `dualWriteService.js` (defined but not actively used)

**Key Documentation References:**
- **Task CRUD:** `.devflow/tasks/tasks-migration-requirements/TASK_CRUD_OPERATIONS.md`
- **Timer Lifecycle:** `.devflow/tasks/tasks-migration-requirements/TIMER_LIFECYCLE_STATE_MACHINE.md`
- **Financial Records:** `.devflow/tasks/tasks-migration-requirements/FINANCIAL_RECORD_GENERATION.md`
- **Field Mappings:**
  - `requirements/tasks/FILEMAKER_DEVTASKS_MAPPING_SUMMARY.md`
  - `.devflow/tasks/tasks-migration-requirements/DEVRECORDS_SUPABASE_MAPPING.md`
- **API Contracts:** `requirements/tasks/BACKEND_CHANGE_REQUEST_001_TASKS_API.md`
- **Timer Operations:** `.devflow/tasks/tasks-migration-requirements/BACKEND_CHANGE_REQUEST_002_TIMER_OPERATIONS.md`

### Why Migrate?

1. **Supabase-First Architecture:** New features are Supabase-only per CLAUDE.md
2. **Simplified Data Model:** Eliminate dual-system complexity
3. **Improved Performance:** Proper indexing and database optimization
4. **Better Scalability:** PostgreSQL handles time-series data better than FileMaker
5. **Unified Financial Reporting:** All billable hours in one system
6. **Deprecate Dual-Write Services:** Remove `dualWriteService.js` and `financialSyncService.js`

---

## Migration Goals and Success Criteria

### Primary Goals

1. **100% Data Migration:** All tasks and timer records migrated without loss
2. **Referential Integrity:** All foreign keys resolved correctly
3. **Zero Downtime:** Users can continue working during migration
4. **Rollback Capability:** Ability to revert if issues arise
5. **Performance Parity:** Supabase queries perform as fast or faster than FileMaker

### Success Criteria

**Data Accuracy:**
- ✅ Row count matches: FileMaker tasks = Supabase tasks
- ✅ Row count matches: FileMaker records = Supabase time_entries
- ✅ 100% of tasks have valid project references
- ✅ 100% of timer records have valid task/project/customer references
- ✅ Financial record totals match between FileMaker and Supabase

**Functional Requirements:**
- ✅ Users can create/update/complete tasks in Supabase
- ✅ Timers can start/stop/pause/adjust successfully
- ✅ Financial records generate correctly on timer stop
- ✅ Fixed-price projects correctly skip sales record creation
- ✅ Billable hours calculations match FileMaker results

**Performance Requirements:**
- ✅ Task list loads in < 500ms (P95)
- ✅ Timer start/stop operations < 500ms (P95)
- ✅ Historical timer queries < 2s for 1-year date range

**Business Continuity:**
- ✅ No data loss during migration
- ✅ No disruption to active timers
- ✅ QuickBooks integration continues to function
- ✅ Financial reconciliation remains accurate

---

## Data Inventory and Assessment

### Tasks Data (devTasks Layout)

**Estimated Volume:** ~10,000 records

**Field Inventory:**

| FileMaker Field | Data Type | Nullable | Usage | Validation Notes |
|-----------------|-----------|----------|-------|------------------|
| `__ID` | Text (UUID) | No | Primary key | All records have valid UUIDs |
| `_projectID` | Text (UUID) | No | FK to projects | Must exist in Supabase projects table |
| `_staffID` | Text (UUID) | No | FK to staff | Must exist in staff/users table |
| `task` | Text | No | Task title | Max 200 chars, required |
| `type` | Text | Yes | Task category | Optional (e.g., "General", "Development") |
| `f_completed` | Number (0/1) | No | Boolean status | Convert to true/false |
| `notes` | Text | Yes | Task notes | Optional, unlimited length |
| `DateCreated` | Date | No | Creation timestamp | MM/DD/YYYY format |
| `DateModified` | Date | No | Modification timestamp | MM/DD/YYYY format |

**Data Quality Checks Required:**
```sql
-- Verify all tasks have valid project references
SELECT COUNT(*) FROM devTasks WHERE _projectID NOT IN (SELECT id FROM projects);
-- Expected: 0

-- Verify all tasks have valid staff references
SELECT COUNT(*) FROM devTasks WHERE _staffID NOT IN (SELECT id FROM users);
-- Expected: 0

-- Check for NULL critical fields
SELECT COUNT(*) FROM devTasks WHERE __ID IS NULL OR _projectID IS NULL OR task IS NULL;
-- Expected: 0

-- Identify orphaned tasks (projects deleted in FileMaker but not in Supabase)
SELECT __ID, task, _projectID FROM devTasks
WHERE _projectID NOT IN (SELECT filemaker_project_id FROM projects);
```

### Timer/Financial Records Data (devRecords Layout)

**Estimated Volume:** ~50,000 records

**Field Inventory:**

| FileMaker Field | Data Type | Nullable | Purpose | Validation Notes |
|-----------------|-----------|----------|---------|------------------|
| `__ID` | Text (UUID) | No | Primary key | All records have valid UUIDs |
| `~recordId` | Number | No | FileMaker internal ID | Used for updates, discard after migration |
| `_taskID` | Text (UUID) | No | FK to tasks | Must exist after task migration |
| `_staffID` | Text (UUID) | No | FK to staff | Must exist in staff/users table |
| `_projectID` | Text (UUID) | No | FK to projects | Must exist in Supabase projects |
| `_custID` | Text (UUID) | No | FK to customers | Must exist in Supabase customers |
| `TimeStart` | Time | No | Start time (HH:MM:SS) | Combine with DateStart |
| `TimeEnd` | Time | Yes | End time (HH:MM:SS) | NULL for active timers, combine with DateStart |
| `DateStart` | Date | No | Start date (MM/DD/YYYY) | Convert to ISO 8601 |
| `TimeAdjust` | Number | Yes | Adjustment (seconds) | Default 0, multiples of 360 (6 min) |
| `Work Performed` | Text | Yes | Description | Optional, set on timer stop |
| `Billable_Time_Rounded` | Number (calc) | Yes | Calculated hours | FileMaker calculation field |
| `Hourly_Rate` | Number | Yes | Billing rate | From project or staff |
| `f_billed` | Number (0/1) | No | Billed status | Convert to boolean |
| `month` | Number (calc) | Yes | Month (1-12) | Extracted from DateStart |
| `year` | Number (calc) | Yes | Year | Extracted from DateStart |

**Related Fields (via FileMaker relationships):**

| Field Path | Purpose | Usage |
|------------|---------|-------|
| `Customers::Name` | Customer name | Financial record display |
| `customers_Projects::projectName` | Project name | Financial record display |
| `customers_Projects::f_fixedPrice` | Fixed-price flag | Skip sales record if > 0 |
| `Tasks::task` | Task title | Financial record display |

**Data Quality Checks Required:**
```sql
-- Verify all records have valid task references (after task migration)
SELECT COUNT(*) FROM devRecords WHERE _taskID NOT IN (SELECT filemaker_task_id FROM tasks);
-- Expected: 0 (or acceptable orphan count)

-- Verify all records have valid customer references
SELECT COUNT(*) FROM devRecords WHERE _custID NOT IN (SELECT id FROM customers);
-- Expected: 0

-- Check for incomplete timers (TimeEnd is NULL but not currently active)
SELECT COUNT(*) FROM devRecords WHERE TimeEnd IS NULL;
-- Review these - may be abandoned timers

-- Verify date/time integrity
SELECT COUNT(*) FROM devRecords WHERE DateStart IS NULL OR TimeStart IS NULL;
-- Expected: 0

-- Check TimeAdjust multiples (should be multiples of 360 seconds = 6 minutes)
SELECT COUNT(*) FROM devRecords WHERE TimeAdjust % 360 != 0;
-- Flag for manual review
```

### Dependency Analysis

**Required Pre-Migration:**
1. ✅ `projects` table populated in Supabase
2. ✅ `customers` table populated in Supabase
3. ✅ `organizations` table populated in Supabase
4. ✅ `users` or `staff` table populated in Supabase
5. ❌ `tasks` table created in Supabase (backend change request required)
6. ❌ `time_entries` table created in Supabase (backend change request required)

**Referential Integrity Chain:**
```
organizations → customers → projects → tasks → time_entries → customer_sales
                              ↓                      ↓
                           users/staff            users/staff
```

---

## ID Reconciliation Strategy

### Overview

**Strategy:** Direct UUID mapping from FileMaker `__ID` to Supabase primary keys with 1:1 identity preservation.

**Rationale:**
- FileMaker `__ID` is a portable UUID, not internal FileMaker ID
- No lookup table needed - direct mapping simplifies migration
- Foreign key references work immediately after migration
- FileMaker `~recordId` is discarded (FileMaker-specific, non-portable)

### Mapping Rules

#### Tasks Mapping

| FileMaker Field | Supabase Column | Transformation | Notes |
|-----------------|-----------------|----------------|-------|
| `__ID` | `tasks.filemaker_task_id` | Direct copy (UUID) | Preserved for reference |
| `__ID` | `tasks.task_id` | Direct copy (UUID) | Used for frontend queries |
| (generated) | `tasks.id` | New UUID | Supabase internal primary key |

**Important:** We store FileMaker `__ID` in TWO columns:
- `tasks.filemaker_task_id` - For historical tracking and debugging
- `tasks.task_id` - For frontend code compatibility (matches current usage)

#### Time Entries Mapping

| FileMaker Field | Supabase Column | Transformation | Notes |
|-----------------|-----------------|----------------|-------|
| `__ID` | `time_entries.filemaker_record_id` | Direct copy (UUID) | Preserved for reference |
| (generated) | `time_entries.id` | New UUID | Supabase internal primary key |

#### Foreign Key Resolution

**Tasks → Projects:**
```sql
-- FileMaker _projectID maps to Supabase projects.id
-- Projects were migrated earlier, IDs preserved
INSERT INTO tasks (project_id, ...)
SELECT p.id, ...
FROM filemaker_tasks ft
JOIN projects p ON p.filemaker_project_id = ft._projectID;
```

**Time Entries → Tasks:**
```sql
-- FileMaker _taskID maps to Supabase tasks.task_id
INSERT INTO time_entries (task_id, ...)
SELECT t.id, ...
FROM filemaker_time_entries fte
JOIN tasks t ON t.filemaker_task_id = fte._taskID;
```

**Time Entries → Customer Sales (existing):**
```sql
-- Link migrated time_entries to existing customer_sales records
UPDATE customer_sales cs
SET time_entry_id = te.id
FROM time_entries te
WHERE cs.financial_id = te.filemaker_record_id;
```

### ID Mapping Verification Queries

```sql
-- Verify all tasks resolved project references
SELECT COUNT(*) FROM tasks WHERE project_id IS NULL;
-- Expected: 0

-- Verify all time_entries resolved task references
SELECT COUNT(*) FROM time_entries WHERE task_id IS NULL;
-- Expected: 0

-- Verify all customer_sales linked to time_entries
SELECT COUNT(*) FROM customer_sales
WHERE financial_id IS NOT NULL
  AND time_entry_id IS NULL;
-- Expected: 0 (or acceptable orphan count for pre-migration records)

-- Find orphaned tasks (project not in Supabase)
SELECT t.task_id, t.filemaker_task_id, t.project_id
FROM tasks t
LEFT JOIN projects p ON t.project_id = p.id
WHERE p.id IS NULL;
-- Expected: 0 or manual review required
```

---

## Data Transformation Requirements

### Tasks Transformation (devTasks → tasks)

**Field-by-Field Transformations:**

| Source Field | Target Column | Transformation Logic | Code Example |
|--------------|---------------|----------------------|--------------|
| `__ID` | `filemaker_task_id`, `task_id` | Direct copy | `task_id: record.__ID` |
| `_projectID` | `project_id` | Lookup Supabase project UUID | `JOIN projects p ON p.filemaker_project_id = _projectID` |
| `_staffID` | `staff_id` | Lookup Supabase user UUID | `JOIN users u ON u.filemaker_staff_id = _staffID` |
| `task` | `task` (title) | Direct copy | `task: record.task` |
| `type` | `type` | Direct copy or NULL | `type: record.type || null` |
| `f_completed` | `is_completed` | Convert 0/1 to boolean | `is_completed: record.f_completed === 1` |
| `notes` | `notes` | Direct copy or NULL | `notes: record.notes || null` |
| `DateCreated` | `created_at` | Parse MM/DD/YYYY to ISO 8601 | `new Date(record.DateCreated).toISOString()` |
| `DateModified` | `updated_at` | Parse MM/DD/YYYY to ISO 8601 | `new Date(record.DateModified).toISOString()` |
| (derived) | `organization_id` | Lookup from project | `SELECT organization_id FROM projects WHERE id = project_id` |
| (derived) | `customer_id` | Lookup from project | `SELECT customer_id FROM projects WHERE id = project_id` |
| (derived) | `status` | Derive from is_completed | `is_completed ? 'completed' : 'in_progress'` |
| (derived) | `priority` | Default value | `'active'` |
| `f_completed` | `completed_at` | Set if completed | `is_completed ? updated_at : null` |

**Transformation Script Example:**

```javascript
// src/scripts/migrateTasksToSupabase.js
import { supabase } from '../services/supabaseService';
import { fetchTasksForProject } from '../api/tasks';

async function transformTask(fileMakerTask, projectLookup, staffLookup) {
  const project = projectLookup[fileMakerTask._projectID];
  if (!project) {
    throw new Error(`Project not found for task ${fileMakerTask.__ID}`);
  }

  return {
    filemaker_task_id: fileMakerTask.__ID,
    task_id: fileMakerTask.__ID, // Use same UUID for frontend compatibility
    task: fileMakerTask.task,
    type: fileMakerTask.type || null,
    project_id: project.id,
    staff_id: staffLookup[fileMakerTask._staffID]?.id || null,
    organization_id: project.organization_id,
    customer_id: project.customer_id,
    is_completed: fileMakerTask.f_completed === 1,
    status: fileMakerTask.f_completed === 1 ? 'completed' : 'in_progress',
    priority: 'active',
    notes: fileMakerTask.notes || null,
    created_at: parseFileMakerDate(fileMakerTask.DateCreated),
    updated_at: parseFileMakerDate(fileMakerTask.DateModified),
    completed_at: fileMakerTask.f_completed === 1
      ? parseFileMakerDate(fileMakerTask.DateModified)
      : null,
  };
}

function parseFileMakerDate(dateString) {
  // FileMaker format: MM/DD/YYYY
  // Convert to ISO 8601: YYYY-MM-DDTHH:mm:ss.sssZ
  const [month, day, year] = dateString.split('/');
  return new Date(`${year}-${month}-${day}`).toISOString();
}
```

### Timer Records Transformation (devRecords → time_entries)

**Field-by-Field Transformations:**

| Source Field(s) | Target Column | Transformation Logic | Code Example |
|-----------------|---------------|----------------------|--------------|
| `__ID` | `filemaker_record_id` | Direct copy | `filemaker_record_id: record.__ID` |
| `_taskID` | `task_id` | Lookup Supabase task UUID | `JOIN tasks t ON t.filemaker_task_id = _taskID` |
| `_projectID` | `project_id` | Lookup Supabase project UUID | `JOIN projects p ON p.id = task.project_id` |
| `_custID` | `customer_id` | Lookup Supabase customer UUID | `JOIN customers c ON c.id = project.customer_id` |
| `_staffID` | `staff_id` | Lookup Supabase user UUID | `JOIN users u ON u.filemaker_staff_id = _staffID` |
| `DateStart` + `TimeStart` | `start_time` | Combine date + time to TIMESTAMPTZ | See below |
| `DateStart` + `TimeEnd` | `end_time` | Combine date + time to TIMESTAMPTZ | See below |
| `TimeAdjust` | `adjustment_seconds` | Direct copy (int) | `adjustment_seconds: record.TimeAdjust || 0` |
| `Work Performed` | `description` | Direct copy or NULL | `description: record['Work Performed'] || null` |
| (calculated) | `duration_minutes` | Calculate from start/end/adjust | `(end_time - start_time - adjustment) / 60` |
| `Hourly_Rate` | `hourly_rate` | Direct copy or lookup | `hourly_rate: parseFloat(record.Hourly_Rate)` |
| `f_billed` | `is_billed` | Convert 0/1 to boolean | `is_billed: record.f_billed === 1` |
| `TimeEnd` | `status` | Derive status | `TimeEnd ? 'completed' : 'active'` |
| (derived) | `organization_id` | Lookup from project | Same as task's organization_id |
| (calculated) | `billable_hours` | Calculate | `(end_time - start_time - adjustment) / 3600` |
| (calculated) | `billable_amount` | Calculate | `billable_hours * hourly_rate` |
| (assumed) | `pause_duration_seconds` | Default 0 | `0` (not tracked in FileMaker) |
| `~creationTimestamp` | `created_at` | Parse timestamp | `new Date(record['~creationTimestamp']).toISOString()` |
| `~modificationTimestamp` | `updated_at` | Parse timestamp | `new Date(record['~modificationTimestamp']).toISOString()` |
| `TimeEnd` | `completed_at` | Set if completed | `TimeEnd ? end_time : null` |

**DateTime Combination Logic:**

FileMaker stores date and time separately. Supabase uses TIMESTAMPTZ. Combine them:

```javascript
function combineFileMakerDateTime(dateString, timeString) {
  // dateString: "01/15/2024" (MM/DD/YYYY)
  // timeString: "14:30:00" (HH:MM:SS)

  if (!dateString || !timeString) {
    return null;
  }

  const [month, day, year] = dateString.split('/');
  const [hours, minutes, seconds] = timeString.split(':');

  // Construct ISO 8601 timestamp
  // Assume UTC or organization timezone
  const timestamp = new Date(
    parseInt(year),
    parseInt(month) - 1, // JS months are 0-indexed
    parseInt(day),
    parseInt(hours),
    parseInt(minutes),
    parseInt(seconds)
  );

  return timestamp.toISOString(); // "2024-01-15T14:30:00.000Z"
}

// Handle overnight timers (end time on next day)
function calculateEndTime(startDate, startTime, endTime) {
  const startDateTime = combineFileMakerDateTime(startDate, startTime);
  const startHour = parseInt(startTime.split(':')[0]);
  const endHour = parseInt(endTime.split(':')[0]);

  // If end hour < start hour, timer crossed midnight
  const nextDay = endHour < startHour;

  if (nextDay) {
    const [month, day, year] = startDate.split('/');
    const nextDayDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day) + 1);
    const nextDateString = `${nextDayDate.getMonth() + 1}/${nextDayDate.getDate()}/${nextDayDate.getFullYear()}`;
    return combineFileMakerDateTime(nextDateString, endTime);
  } else {
    return combineFileMakerDateTime(startDate, endTime);
  }
}
```

**Transformation Script Example:**

```javascript
// src/scripts/migrateTimersToSupabase.js
import { supabase } from '../services/supabaseService';

async function transformTimeEntry(fileMakerRecord, taskLookup, projectLookup) {
  const task = taskLookup[fileMakerRecord._taskID];
  if (!task) {
    console.warn(`Task not found for timer ${fileMakerRecord.__ID}, skipping...`);
    return null; // Skip orphaned timer
  }

  const project = projectLookup[task.project_id];
  const startTime = combineFileMakerDateTime(
    fileMakerRecord.DateStart,
    fileMakerRecord.TimeStart
  );
  const endTime = fileMakerRecord.TimeEnd
    ? calculateEndTime(
        fileMakerRecord.DateStart,
        fileMakerRecord.TimeStart,
        fileMakerRecord.TimeEnd
      )
    : null;

  const adjustmentSeconds = parseInt(fileMakerRecord.TimeAdjust || 0);
  const durationMinutes = endTime
    ? ((new Date(endTime) - new Date(startTime)) / 1000 - adjustmentSeconds) / 60
    : null;

  const hourlyRate = parseFloat(fileMakerRecord.Hourly_Rate || 0);
  const billableHours = durationMinutes ? durationMinutes / 60 : null;
  const billableAmount = billableHours ? billableHours * hourlyRate : null;

  return {
    filemaker_record_id: fileMakerRecord.__ID,
    task_id: task.id,
    project_id: task.project_id,
    customer_id: task.customer_id,
    staff_id: task.staff_id,
    organization_id: task.organization_id,
    start_time: startTime,
    end_time: endTime,
    adjustment_seconds: adjustmentSeconds,
    description: fileMakerRecord['Work Performed'] || null,
    duration_minutes: durationMinutes,
    hourly_rate: hourlyRate,
    billable_hours: billableHours,
    billable_amount: billableAmount,
    is_billed: fileMakerRecord.f_billed === 1,
    status: endTime ? 'completed' : 'active',
    pause_duration_seconds: 0, // Not tracked in FileMaker
    created_at: new Date(fileMakerRecord['~creationTimestamp']).toISOString(),
    updated_at: new Date(fileMakerRecord['~modificationTimestamp']).toISOString(),
    completed_at: endTime,
  };
}
```

### Data Validation Rules

**Pre-Migration Validation:**

```javascript
function validateTaskData(task) {
  const errors = [];

  // Required fields
  if (!task.task || task.task.length === 0) {
    errors.push('Task title is required');
  }
  if (task.task && task.task.length > 200) {
    errors.push('Task title exceeds 200 characters');
  }
  if (!task.project_id) {
    errors.push('Project ID is required');
  }
  if (!task.organization_id) {
    errors.push('Organization ID is required');
  }

  // Data integrity
  if (!task.created_at || isNaN(new Date(task.created_at))) {
    errors.push('Invalid created_at timestamp');
  }
  if (!task.updated_at || isNaN(new Date(task.updated_at))) {
    errors.push('Invalid updated_at timestamp');
  }

  return errors;
}

function validateTimeEntryData(entry) {
  const errors = [];

  // Required fields
  if (!entry.task_id) {
    errors.push('Task ID is required');
  }
  if (!entry.start_time || isNaN(new Date(entry.start_time))) {
    errors.push('Invalid start_time timestamp');
  }
  if (!entry.staff_id) {
    errors.push('Staff ID is required');
  }

  // Business logic validation
  if (entry.end_time && new Date(entry.end_time) < new Date(entry.start_time)) {
    errors.push('End time cannot be before start time');
  }
  if (entry.adjustment_seconds && entry.adjustment_seconds % 360 !== 0) {
    errors.push('Adjustment must be in 6-minute increments (360 seconds)');
  }
  if (entry.status === 'completed' && !entry.end_time) {
    errors.push('Completed entries must have end_time');
  }
  if (entry.billable_amount && entry.billable_amount < 0) {
    errors.push('Billable amount cannot be negative');
  }

  return errors;
}
```

---

## Migration Phases

### Phase 0: Preparation (Weeks 1-2)

#### 0.1 Backend Schema Deployment

**Deliverables:**
- Deploy `tasks` table to Supabase production
- Deploy `time_entries` table to Supabase production
- Add `time_entry_id` column to `customer_sales` table
- Create indexes, constraints, triggers, RLS policies

**SQL Scripts Required:**
1. `001_tasks_schema.sql` - Tasks table DDL
2. `002_time_entries_schema.sql` - Time entries table DDL
3. `003_customer_sales_extension.sql` - Add time_entry_id FK
4. `004_indexes.sql` - Performance indexes
5. `005_rls_policies.sql` - Row-level security
6. `006_triggers.sql` - Auto-update triggers

**Validation:**
```bash
# Verify tables exist
ssh marcus@backend.claritybusinesssolutions.ca \
  "docker exec supabase-db psql -U postgres -d postgres \
  -c \"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('tasks', 'time_entries');\""

# Verify indexes
ssh marcus@backend.claritybusinesssolutions.ca \
  "docker exec supabase-db psql -U postgres -d postgres \
  -c \"SELECT indexname FROM pg_indexes WHERE tablename IN ('tasks', 'time_entries');\""

# Verify RLS enabled
ssh marcus@backend.claritybusinesssolutions.ca \
  "docker exec supabase-db psql -U postgres -d postgres \
  -c \"SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('tasks', 'time_entries');\""
```

**Backend Change Requests:**
- ✅ Already created: `requirements/tasks/BACKEND_CHANGE_REQUEST_001_TASKS_API.md`
- ✅ Already created: `.devflow/tasks/tasks-migration-requirements/BACKEND_CHANGE_REQUEST_002_TIMER_OPERATIONS.md`
- ✅ Already created: `.devflow/tasks/tasks-migration-requirements/BACKEND_BUSINESS_LOGIC_REQUIREMENTS.md`

**Approval Required:** Backend team must approve and deploy schemas before Phase 1.

#### 0.2 Data Export from FileMaker

**Export Tasks:**
```bash
# Export all tasks to JSON
node src/scripts/exportFileMakerTasks.js > data/filemaker_tasks_export.json

# Export script pseudocode:
# 1. Fetch all tasks from devTasks layout
# 2. Process task data using processTaskData()
# 3. Write to JSON file with metadata (export date, record count)
```

**Export Time Entries:**
```bash
# Export all time entries to JSON
node src/scripts/exportFileMakerTimeEntries.js > data/filemaker_time_entries_export.json

# Export script pseudocode:
# 1. Fetch all records from devRecords layout
# 2. Process financial data using processFinancialData()
# 3. Include related fields (customer name, project name, fixed price)
# 4. Write to JSON file with metadata
```

**Data Quality Report:**
```bash
# Generate data quality report
node src/scripts/analyzeExportedData.js

# Report should include:
# - Total task count
# - Total time entry count
# - Orphaned tasks (invalid project references)
# - Orphaned timers (invalid task references)
# - Active timers (TimeEnd is NULL)
# - Data validation errors
# - Duplicate check results
```

#### 0.3 Dependency Verification

**Verify Projects Migrated:**
```sql
-- Check that all FileMaker projects exist in Supabase
SELECT COUNT(*) FROM (
  SELECT DISTINCT _projectID FROM filemaker_tasks_export
) fm
WHERE NOT EXISTS (
  SELECT 1 FROM projects p WHERE p.filemaker_project_id = fm._projectID
);
-- Expected: 0
```

**Verify Customers Migrated:**
```sql
-- Check that all FileMaker customers exist in Supabase
SELECT COUNT(*) FROM (
  SELECT DISTINCT _custID FROM filemaker_time_entries_export
) fm
WHERE NOT EXISTS (
  SELECT 1 FROM customers c WHERE c.id = fm._custID
);
-- Expected: 0
```

**Verify Staff/Users Exist:**
```sql
-- Check that all staff exist in Supabase
SELECT COUNT(*) FROM (
  SELECT DISTINCT _staffID FROM filemaker_tasks_export
) fm
WHERE NOT EXISTS (
  SELECT 1 FROM users u WHERE u.filemaker_staff_id = fm._staffID
);
-- Expected: 0
```

### Phase 1: Historical Data Migration (Week 3)

#### 1.1 Migrate Tasks

**Migration Script:** `src/scripts/migrateTasksToSupabase.js`

**Process:**
1. Load exported tasks from JSON
2. Build lookup tables for projects, staff, organizations
3. Transform each task using `transformTask()`
4. Validate transformed data using `validateTaskData()`
5. Batch insert into Supabase `tasks` table (500 records per batch)
6. Log migration results (success count, error count, skipped count)
7. Generate reconciliation report

**Batch Insert Example:**
```javascript
async function batchInsertTasks(tasks, batchSize = 500) {
  const results = { success: 0, errors: [] };

  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);

    const { data, error } = await supabase
      .from('tasks')
      .insert(batch)
      .select();

    if (error) {
      results.errors.push({ batch: i / batchSize, error });
      console.error(`Batch ${i / batchSize} failed:`, error);
    } else {
      results.success += data.length;
      console.log(`Batch ${i / batchSize} succeeded: ${data.length} tasks`);
    }
  }

  return results;
}
```

**Success Criteria:**
- ✅ Row count matches FileMaker
- ✅ 100% of tasks have valid project_id
- ✅ 0 validation errors
- ✅ All foreign keys resolved

#### 1.2 Migrate Time Entries

**Migration Script:** `src/scripts/migrateTimeEntriesToSupabase.js`

**Process:**
1. Load exported time entries from JSON
2. Build lookup tables for tasks, projects, customers, staff
3. Transform each entry using `transformTimeEntry()`
4. Validate transformed data using `validateTimeEntryData()`
5. Handle orphaned timers (log and skip or assign to default task)
6. Batch insert into Supabase `time_entries` table (500 records per batch)
7. Link to existing `customer_sales` records via `financial_id`
8. Generate reconciliation report

**Orphaned Timer Handling:**
```javascript
async function handleOrphanedTimer(timer) {
  // Option 1: Skip orphaned timers
  console.warn(`Orphaned timer ${timer.filemaker_record_id} - task ${timer._taskID} not found`);
  return null;

  // Option 2: Create placeholder task (not recommended)
  // const placeholderTask = await createPlaceholderTask(timer);
  // return transformTimeEntry(timer, { [timer._taskID]: placeholderTask }, ...);
}
```

**Customer Sales Linkage:**
```javascript
async function linkTimeEntriesToCustomerSales() {
  // Update customer_sales.time_entry_id for migrated records
  const { data, error } = await supabase.rpc('link_time_entries_to_sales', {
    /* Links based on financial_id = filemaker_record_id */
  });

  if (error) {
    console.error('Failed to link time entries to customer_sales:', error);
  } else {
    console.log(`Linked ${data.length} customer_sales records to time_entries`);
  }
}
```

**Success Criteria:**
- ✅ Row count matches FileMaker (minus acceptable orphans)
- ✅ 100% of time entries have valid task_id
- ✅ All completed timers have end_time
- ✅ Billable amounts match FileMaker calculations
- ✅ customer_sales linkage complete

### Phase 2: Dual-Write Implementation (Weeks 4-5)

**Goal:** Ensure new tasks/timers write to both FileMaker and Supabase during transition.

#### 2.1 Update Task Service

**Modify:** `src/services/taskService.js`

**Changes Required:**
```javascript
// Before: FileMaker-only
export async function createTask(taskData) {
  return await createTaskAPI(taskData); // FileMaker only
}

// After: Dual-write
export async function createTask(taskData, organizationId) {
  // Step 1: Create in FileMaker (source of truth during transition)
  const fmResult = await createTaskAPI(taskData);

  // Step 2: Create in Supabase
  try {
    const supabaseTask = transformTaskForSupabase(fmResult, organizationId);
    const { data, error } = await supabase.from('tasks').insert(supabaseTask).select();

    if (error) {
      console.error('Supabase task creation failed:', error);
      // Don't throw - FileMaker succeeded, log for reconciliation
    }
  } catch (err) {
    console.error('Dual-write error:', err);
  }

  return fmResult;
}
```

#### 2.2 Update Timer Operations

**Modify:** `src/services/taskService.js:stopTimer()`

**Changes Required:**
```javascript
// Existing implementation already has partial dual-write
// (creates customer_sales on timer stop)
// Extend to also create time_entries record

export async function stopTimer(params, organizationId = null) {
  // Step 1: Stop timer in FileMaker
  const result = await stopTaskTimerAPI(...);

  // Step 2: Create time_entry in Supabase
  if (result && result.response) {
    const orgId = organizationId || window.state?.user?.supabaseOrgID;
    const financialRecord = await fetchFinancialRecordByRecordId(params.recordId);

    // Check fixed-price logic
    const fixedPrice = parseFloat(financialRecord.response.data[0].fieldData["customers_Projects::f_fixedPrice"] || 0);

    // Create time_entry (always)
    const timeEntry = await createTimeEntryFromFinancialRecord(financialRecord, orgId);

    // Create customer_sales (only if not fixed-price)
    if (fixedPrice === 0) {
      await createSaleFromFinancialRecord(financialRecord.response.data[0].fieldData.__ID, orgId);
    }
  }

  return result;
}
```

#### 2.3 Monitoring and Logging

**Add dual-write monitoring:**
```javascript
// src/services/dualWriteMonitor.js
export class DualWriteMonitor {
  static logSuccess(operation, fmId, supabaseId) {
    console.log(`[DualWrite Success] ${operation}: FM=${fmId}, SB=${supabaseId}`);
  }

  static logFailure(operation, fmId, error) {
    console.error(`[DualWrite Failure] ${operation}: FM=${fmId}`, error);
    // Send to error tracking service (Sentry, etc.)
  }

  static async reconcileDailyWrites() {
    // Compare FileMaker writes vs Supabase writes for the day
    // Report discrepancies
  }
}
```

**Success Criteria:**
- ✅ New tasks appear in both FileMaker and Supabase
- ✅ New timers appear in both systems
- ✅ Fixed-price logic still works correctly
- ✅ No user-facing errors
- ✅ Dual-write success rate > 99%

### Phase 3: Validation and Reconciliation (Weeks 6-7)

#### 3.1 Data Integrity Checks

**Run comprehensive validation:**

```sql
-- Task count reconciliation
SELECT
  (SELECT COUNT(*) FROM filemaker_tasks_export) AS fm_count,
  (SELECT COUNT(*) FROM tasks WHERE filemaker_task_id IS NOT NULL) AS sb_count,
  (SELECT COUNT(*) FROM tasks WHERE filemaker_task_id IS NOT NULL) -
  (SELECT COUNT(*) FROM filemaker_tasks_export) AS difference;

-- Time entry count reconciliation
SELECT
  (SELECT COUNT(*) FROM filemaker_time_entries_export) AS fm_count,
  (SELECT COUNT(*) FROM time_entries WHERE filemaker_record_id IS NOT NULL) AS sb_count,
  (SELECT COUNT(*) FROM time_entries WHERE filemaker_record_id IS NOT NULL) -
  (SELECT COUNT(*) FROM filemaker_time_entries_export) AS difference;

-- Billable hours reconciliation
SELECT
  SUM(fm.billable_hours) AS fm_total_hours,
  SUM(sb.billable_hours) AS sb_total_hours,
  SUM(sb.billable_hours) - SUM(fm.billable_hours) AS difference
FROM filemaker_time_entries_export fm
JOIN time_entries sb ON sb.filemaker_record_id = fm.__ID;

-- Customer sales linkage check
SELECT COUNT(*) FROM customer_sales
WHERE financial_id IS NOT NULL
  AND time_entry_id IS NULL;
-- Expected: 0
```

#### 3.2 Business Logic Validation

**Test fixed-price project logic:**
```sql
-- Verify no sales records created for fixed-price projects
SELECT te.*, cs.id AS sales_id
FROM time_entries te
JOIN tasks t ON te.task_id = t.id
JOIN projects p ON t.project_id = p.id
LEFT JOIN customer_sales cs ON cs.time_entry_id = te.id
WHERE p.fixed_price > 0;
-- Expected: cs.id should be NULL for all rows
```

**Test timer calculations:**
```javascript
// Compare FileMaker vs Supabase calculations
async function validateTimerCalculations() {
  const fileMakerRecords = await fetchAllFinancialRecords();
  const supabaseEntries = await supabase.from('time_entries').select('*');

  const discrepancies = [];

  for (const fm of fileMakerRecords) {
    const sb = supabaseEntries.find(e => e.filemaker_record_id === fm.__ID);
    if (!sb) continue;

    const fmHours = parseFloat(fm.Billable_Time_Rounded);
    const sbHours = parseFloat(sb.billable_hours);
    const diff = Math.abs(fmHours - sbHours);

    if (diff > 0.01) { // Allow 1 minute rounding difference
      discrepancies.push({ fm_id: fm.__ID, fm_hours: fmHours, sb_hours: sbHours, diff });
    }
  }

  console.log(`Found ${discrepancies.length} calculation discrepancies`);
  return discrepancies;
}
```

#### 3.3 User Acceptance Testing

**Test Scenarios:**
1. Create new task in web app → Verify in both systems
2. Start timer → Verify timer state persists
3. Stop timer → Verify financial record created
4. Stop timer on fixed-price project → Verify no sales record
5. Adjust timer (6-minute increments) → Verify adjustment saved
6. Complete task → Verify completion status synced
7. View historical timers → Verify migrated data displays correctly
8. Generate billable hours report → Verify totals match FileMaker

**Success Criteria:**
- ✅ All test scenarios pass
- ✅ No data discrepancies found
- ✅ User feedback positive
- ✅ Performance acceptable

### Phase 4: Cutover to Supabase-Only (Week 8)

#### 4.1 Backend API Deployment

**Deploy Backend APIs:**
- Deploy 12 REST endpoints from BACKEND_CHANGE_REQUEST_001
- Deploy timer operation RPCs from BACKEND_CHANGE_REQUEST_002
- Enable HMAC authentication
- Deploy business logic from BACKEND_BUSINESS_LOGIC_REQUIREMENTS

**Validation:**
```bash
# Test task creation
curl -X POST https://api.claritybusinesssolutions.ca/api/tasks \
  -H "Authorization: Bearer {HMAC_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"task": "Test task", "project_id": "...", ...}'

# Test timer start
curl -X POST https://api.claritybusinesssolutions.ca/api/tasks/{task_id}/timer/start \
  -H "Authorization: Bearer {HMAC_TOKEN}"

# Test timer stop
curl -X POST https://api.claritybusinesssolutions.ca/api/tasks/{task_id}/timer/stop \
  -H "Authorization: Bearer {HMAC_TOKEN}" \
  -d '{"description": "Work completed", "adjustment": 360}'
```

#### 4.2 Frontend Code Migration

**Update API Layer:** `src/api/tasks.js`

```javascript
// Before: FileMaker API
export async function createTask(data) {
  return await makeFileMakerRequest({
    layout: Layouts.TASKS,
    action: Actions.CREATE,
    fieldData: data
  });
}

// After: Backend API
export async function createTask(data) {
  const authHeader = dataService.generateBackendAuthHeader();

  const response = await axios.post(
    `${import.meta.env.VITE_API_URL}/api/tasks`,
    data,
    { headers: { Authorization: authHeader } }
  );

  return response.data;
}
```

**Update Service Layer:** `src/services/taskService.js`

```javascript
// Remove FileMaker-specific logic
// Remove dual-write logic
// Use backend API directly

export async function stopTimer(params) {
  // Backend API handles everything: timer stop + financial record + sales
  return await stopTaskTimerAPI(params.taskId, {
    description: params.description,
    adjustment: params.adjustment
  });
}
```

#### 4.3 Feature Flag Rollout

**Gradual rollout using feature flags:**

```javascript
// src/services/featureFlags.js
export const FEATURES = {
  USE_SUPABASE_TASKS: {
    enabled: true, // Flip to true after validation
    rolloutPercentage: 100, // Start at 10%, gradually increase
  }
};

// src/services/taskService.js
export async function createTask(data, organizationId) {
  if (FEATURES.USE_SUPABASE_TASKS.enabled) {
    // Use new Supabase backend API
    return await createTaskViaBackendAPI(data);
  } else {
    // Fallback to FileMaker (legacy)
    return await createTaskViaFileMaker(data);
  }
}
```

**Rollout Plan:**
1. Week 8 Day 1: 10% of users
2. Week 8 Day 2: 25% of users
3. Week 8 Day 3: 50% of users
4. Week 8 Day 4: 75% of users
5. Week 8 Day 5: 100% of users

**Monitoring:**
- Error rates per feature flag cohort
- Performance metrics (latency, throughput)
- User feedback and support tickets

**Success Criteria:**
- ✅ Error rate < 0.1%
- ✅ Performance within SLA (P95 < 500ms)
- ✅ No critical bugs reported
- ✅ User feedback neutral or positive

### Phase 5: Cleanup and Decommission (Week 9)

#### 5.1 Remove Dual-Write Code

**Delete or deprecate:**
- `src/services/dualWriteService.js` (no longer needed)
- `src/services/financialSyncService.js` (replaced by backend)
- FileMaker-specific logic in `taskService.js`

**Update Documentation:**
- Update CLAUDE.md to reflect Supabase-only tasks
- Archive FileMaker documentation
- Update API documentation

#### 5.2 Remove FileMaker Dependencies

**Update Dependencies:**
```javascript
// Remove FileMaker imports
// import { makeFileMakerRequest } from '../api/fileMaker';

// Keep only Supabase/Backend imports
import { supabase } from '../services/supabaseService';
import { dataService } from '../services/dataService';
```

#### 5.3 Performance Optimization

**Add indexes based on usage patterns:**
```sql
-- Add composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_user_status
  ON tasks(staff_id, is_completed, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_time_entries_billing
  ON time_entries(customer_id, is_billed, start_time DESC)
  WHERE is_billed = false;
```

**Analyze and optimize slow queries:**
```sql
-- Analyze query performance
EXPLAIN ANALYZE
SELECT * FROM tasks
WHERE project_id = '...' AND is_completed = false
ORDER BY created_at DESC;
```

#### 5.4 Final Validation

**Run final reconciliation:**
```bash
node src/scripts/finalReconciliation.js

# Should verify:
# - No FileMaker writes in last 7 days
# - All Supabase writes successful
# - Data integrity maintained
# - Performance metrics acceptable
```

**Success Criteria:**
- ✅ All FileMaker code removed
- ✅ All dual-write code removed
- ✅ Documentation updated
- ✅ Performance optimized
- ✅ Final validation passed

---

## Reconciliation and Validation Strategy

### Multi-Phase Validation Approach

**Phase 1: Pre-Migration Validation**
- Verify FileMaker data quality
- Check foreign key dependencies
- Identify orphaned records
- Validate data types and formats

**Phase 2: Post-Migration Validation**
- Row count reconciliation
- Foreign key integrity checks
- Business logic validation
- Calculation verification

**Phase 3: Ongoing Validation (Dual-Write Period)**
- Daily reconciliation reports
- Discrepancy alerts
- Automatic correction scripts
- Manual review queue

**Phase 4: Final Validation (Post-Cutover)**
- Historical data integrity
- New data accuracy
- Performance benchmarks
- User acceptance

### Reconciliation Queries

**Task Reconciliation:**

```sql
-- Count reconciliation
WITH fm_counts AS (
  SELECT COUNT(*) AS total FROM filemaker_tasks_export
),
sb_counts AS (
  SELECT COUNT(*) AS total FROM tasks WHERE filemaker_task_id IS NOT NULL
)
SELECT
  fm.total AS filemaker_count,
  sb.total AS supabase_count,
  sb.total - fm.total AS difference
FROM fm_counts fm, sb_counts sb;

-- Status reconciliation
SELECT
  fm.is_completed AS fm_completed,
  COUNT(*) AS fm_count,
  sb.is_completed AS sb_completed,
  COUNT(*) AS sb_count
FROM filemaker_tasks_export fm
JOIN tasks sb ON sb.filemaker_task_id = fm.__ID
GROUP BY fm.is_completed, sb.is_completed
HAVING fm.is_completed != sb.is_completed;
-- Expected: 0 rows
```

**Time Entry Reconciliation:**

```sql
-- Billable hours reconciliation
SELECT
  te.filemaker_record_id,
  fm.billable_hours AS fm_hours,
  te.billable_hours AS sb_hours,
  ABS(fm.billable_hours - te.billable_hours) AS difference
FROM time_entries te
JOIN filemaker_time_entries_export fm ON fm.__ID = te.filemaker_record_id
WHERE ABS(fm.billable_hours - te.billable_hours) > 0.01
ORDER BY difference DESC;
-- Expected: 0 rows (or acceptable rounding differences)

-- Duration calculation verification
SELECT
  te.filemaker_record_id,
  te.start_time,
  te.end_time,
  te.adjustment_seconds,
  te.duration_minutes AS calculated_duration,
  EXTRACT(EPOCH FROM (te.end_time - te.start_time)) / 60 - (te.adjustment_seconds / 60) AS expected_duration,
  ABS(te.duration_minutes - (EXTRACT(EPOCH FROM (te.end_time - te.start_time)) / 60 - (te.adjustment_seconds / 60))) AS difference
FROM time_entries te
WHERE te.end_time IS NOT NULL
  AND ABS(te.duration_minutes - (EXTRACT(EPOCH FROM (te.end_time - te.start_time)) / 60 - (te.adjustment_seconds / 60))) > 1;
-- Expected: 0 rows (allow 1-minute tolerance)
```

**Customer Sales Linkage:**

```sql
-- Verify all financial records linked to time entries
SELECT
  cs.id AS sales_id,
  cs.financial_id,
  cs.time_entry_id,
  te.filemaker_record_id
FROM customer_sales cs
LEFT JOIN time_entries te ON cs.time_entry_id = te.id
WHERE cs.financial_id IS NOT NULL
  AND cs.time_entry_id IS NULL;
-- Expected: 0 rows

-- Verify amounts match
SELECT
  cs.financial_id,
  cs.amount AS sales_amount,
  te.billable_amount AS time_entry_amount,
  ABS(cs.amount - te.billable_amount) AS difference
FROM customer_sales cs
JOIN time_entries te ON cs.time_entry_id = te.id
WHERE ABS(cs.amount - te.billable_amount) > 0.01;
-- Expected: 0 rows
```

### Automated Reconciliation Scripts

**Daily Reconciliation During Dual-Write:**

```javascript
// src/scripts/dailyReconciliation.js
import { supabase } from '../services/supabaseService';
import { fetchRecordsForDateRange } from '../api/financialRecords';
import { fetchTasksForProject } from '../api/tasks';

async function reconcileDailyWrites() {
  const today = new Date().toISOString().split('T')[0];

  // Fetch today's writes from FileMaker
  const fmTasks = await fetchTasksCreatedToday();
  const fmTimers = await fetchTimersCreatedToday();

  // Fetch today's writes from Supabase
  const { data: sbTasks } = await supabase
    .from('tasks')
    .select('*')
    .gte('created_at', today)
    .is('filemaker_task_id', null); // New Supabase-only tasks

  const { data: sbTimers } = await supabase
    .from('time_entries')
    .select('*')
    .gte('created_at', today)
    .is('filemaker_record_id', null); // New Supabase-only timers

  // Compare and report discrepancies
  const report = {
    date: today,
    tasks: {
      fileMaker: fmTasks.length,
      supabase: sbTasks.length,
      discrepancy: fmTasks.length - sbTasks.length
    },
    timers: {
      fileMaker: fmTimers.length,
      supabase: sbTimers.length,
      discrepancy: fmTimers.length - sbTimers.length
    }
  };

  if (report.tasks.discrepancy !== 0 || report.timers.discrepancy !== 0) {
    console.error('Daily reconciliation discrepancy detected:', report);
    // Send alert to team
  } else {
    console.log('Daily reconciliation passed:', report);
  }

  return report;
}
```

### Discrepancy Resolution Workflow

**When discrepancies are found:**

1. **Log the discrepancy:** Record in `migration_discrepancies` table
2. **Categorize severity:** Critical (data loss), High (calculation error), Medium (orphan), Low (metadata)
3. **Auto-correct if possible:** Run correction script for known issues
4. **Manual review queue:** Critical and High severity items require human review
5. **Track resolution:** Update discrepancy status and resolution notes
6. **Prevent recurrence:** Add validation to prevent future occurrences

**Correction Script Example:**

```javascript
async function correctOrphanedTimers() {
  // Find time entries with missing task references
  const { data: orphans } = await supabase
    .from('time_entries')
    .select('*')
    .is('task_id', null);

  for (const timer of orphans) {
    // Attempt to resolve task via filemaker_record_id lookup
    const fmRecord = fileMakerRecords.find(r => r.__ID === timer.filemaker_record_id);

    if (fmRecord && fmRecord._taskID) {
      const { data: task } = await supabase
        .from('tasks')
        .select('id')
        .eq('filemaker_task_id', fmRecord._taskID)
        .single();

      if (task) {
        // Correct the orphan
        await supabase
          .from('time_entries')
          .update({ task_id: task.id })
          .eq('id', timer.id);

        console.log(`Corrected orphaned timer ${timer.id}`);
      }
    }
  }
}
```

---

## Risk Assessment and Mitigation

### High-Risk Areas

#### Risk 1: Data Loss During Migration

**Description:** Tasks or timers could be lost during bulk migration due to script errors or network issues.

**Probability:** Low
**Impact:** Critical
**Mitigation:**
- Batch inserts with retry logic
- Transaction-based migrations (rollback on error)
- Export backups before migration
- Validate row counts after each batch
- Keep FileMaker as source of truth until final validation

#### Risk 2: Foreign Key Resolution Failures

**Description:** Tasks or timers reference projects/customers/staff that don't exist in Supabase.

**Probability:** Medium
**Impact:** High
**Mitigation:**
- Pre-migration dependency validation
- Fail fast on missing references
- Create lookup tables for all dependencies
- Log and skip orphaned records (manual review)
- Reconciliation phase catches orphans

#### Risk 3: Calculation Discrepancies

**Description:** Billable hours, amounts, or durations calculated differently in Supabase vs FileMaker.

**Probability:** Medium
**Impact:** High
**Mitigation:**
- Unit tests for calculation functions
- Side-by-side validation during dual-write
- Automated discrepancy detection
- Manual review of high-value discrepancies
- Document acceptable tolerance (e.g., 1-minute rounding)

#### Risk 4: Active Timer Disruption

**Description:** Users with active timers during cutover lose timer state or data.

**Probability:** Medium
**Impact:** Medium
**Mitigation:**
- Identify active timers before cutover
- Notify users to stop timers before maintenance window
- Migrate active timer state to Supabase localStorage format
- Validate active timer count before/after cutover
- Provide manual timer adjustment tool if needed

#### Risk 5: Performance Degradation

**Description:** Supabase queries slower than FileMaker, impacting user experience.

**Probability:** Low
**Impact:** Medium
**Mitigation:**
- Pre-deployment performance testing with production data volume
- Proper indexing strategy (see Phase 0)
- Query optimization before cutover
- Caching layer for frequently accessed data
- Gradual rollout with performance monitoring

#### Risk 6: Fixed-Price Logic Failure

**Description:** Fixed-price projects incorrectly generate sales records after migration.

**Probability:** Low
**Impact:** High
**Mitigation:**
- Preserve fixed-price detection logic (src/services/taskService.js:104-111)
- Test fixed-price scenarios during UAT
- Automated tests for fixed-price logic
- Post-migration audit of fixed-price projects
- Alert on unexpected sales records

#### Risk 7: QuickBooks Integration Breakage

**Description:** Changes to financial records break QuickBooks sync or invoice generation.

**Probability:** Low
**Impact:** High
**Mitigation:**
- Maintain customer_sales schema compatibility
- Test QuickBooks integration in staging
- Validate invoice generation after migration
- Keep financial reconciliation service intact
- Gradual rollout allows early detection

### Risk Response Plan

**For each risk category:**

1. **Monitor:** Set up alerts for risk indicators
2. **Detect:** Automated validation catches issues early
3. **Respond:** Predefined response procedures
4. **Escalate:** Critical issues escalate to backend team
5. **Document:** Log all incidents and resolutions

---

## Rollback Plan

### Rollback Triggers

**Initiate rollback if:**
- Data loss exceeds 0.1% of records
- Critical foreign key failures exceed 1%
- Calculation discrepancies exceed 5%
- Active timer disruption affects > 10 users
- Performance degradation > 50% slower than FileMaker
- Critical bugs identified during feature flag rollout

### Rollback Procedures

#### Phase 1-2 Rollback (Historical Migration)

**If migration scripts fail:**

1. **Stop migration script immediately**
2. **Rollback Supabase inserts:**
   ```sql
   -- Delete all migrated tasks
   DELETE FROM tasks WHERE filemaker_task_id IS NOT NULL;

   -- Delete all migrated time entries
   DELETE FROM time_entries WHERE filemaker_record_id IS NOT NULL;

   -- Unlink customer_sales
   UPDATE customer_sales SET time_entry_id = NULL WHERE time_entry_id IS NOT NULL;
   ```
3. **Restore from backup if needed:**
   ```bash
   # Restore Supabase snapshot from before migration
   ssh marcus@backend.claritybusinesssolutions.ca \
     "docker exec supabase-db pg_restore -U postgres -d postgres /backups/pre_migration_backup.sql"
   ```
4. **Investigate root cause**
5. **Fix migration script**
6. **Retry migration**

**Data Preservation:**
- FileMaker remains source of truth
- No FileMaker data deleted
- Supabase rollback only affects new tables

#### Phase 3-4 Rollback (Dual-Write / Cutover)

**If dual-write issues detected:**

1. **Disable Supabase writes via feature flag:**
   ```javascript
   FEATURES.USE_SUPABASE_TASKS.enabled = false;
   ```
2. **Revert to FileMaker-only operations**
3. **Log all Supabase write failures for later reconciliation**
4. **Continue operating on FileMaker**
5. **Investigate and fix dual-write issues**
6. **Re-enable Supabase writes when stable**

**If cutover issues detected:**

1. **Immediate rollback to FileMaker backend:**
   ```javascript
   // Emergency feature flag disable
   FEATURES.USE_SUPABASE_TASKS.enabled = false;
   FEATURES.USE_SUPABASE_TASKS.rolloutPercentage = 0;
   ```
2. **Notify users of temporary service degradation**
3. **Revert frontend to FileMaker API calls**
4. **Restore FileMaker as primary data source**
5. **Sync any Supabase-only writes back to FileMaker (if possible)**
6. **Investigate backend API issues**
7. **Fix and retest before re-attempting cutover**

**Data Preservation:**
- FileMaker data intact
- Supabase data preserved but inactive
- Manual reconciliation required for writes during rollback window

### Rollback Testing

**Pre-migration rollback drill:**
- Simulate migration failure scenarios
- Practice rollback procedures
- Validate backup restoration
- Document rollback duration and complexity

**Expected Rollback Times:**
- Phase 1-2 rollback: < 1 hour (database rollback)
- Phase 3-4 rollback: < 15 minutes (feature flag toggle)

---

## Code References

### Key Files for Migration

**API Layer:**
- `src/api/tasks.js` - Task CRUD operations (FileMaker → Backend API)
- `src/api/financialRecords.js` - Timer/financial record operations
- `src/api/fileMaker.js` - FileMaker Data API wrapper (to be deprecated)

**Service Layer:**
- `src/services/taskService.js:67-131` - Timer stop + financial record creation
- `src/services/taskService.js:265-305` - TASK_FIELDS validation schema
- `src/services/dualWriteService.js` - Dual-write orchestration (unused, to be removed)
- `src/services/financialSyncService.js` - FileMaker ↔ Supabase sync (to be deprecated)
- `src/services/billableHoursService.js` - Financial calculations
- `src/services/salesService.js` - Customer sales creation

**UI Components:**
- `src/components/tasks/TaskTimer.jsx` - Timer UI and state machine
- `src/components/tasks/TaskDetails.jsx` - Task display
- `src/components/tasks/TaskForm.jsx` - Task creation/editing

**Hooks:**
- `src/hooks/useTask.js:204-317` - Task and timer operations

### Database Schema References

**Supabase Tables (to be created):**
- `tasks` - Defined in `requirements/tasks/BACKEND_CHANGE_REQUEST_001_TASKS_API.md:46-99`
- `time_entries` - Defined in `requirements/tasks/data-model-mapping.md:59-99`
- `customer_sales` (existing) - Receives financial records from timer stops

**FileMaker Layouts:**
- `devTasks` - Task storage (Layouts.TASKS = 'devTasks' in `src/api/fileMaker.js:414`)
- `devRecords` - Timer/financial record storage
- `devNotes` - Task notes (related)
- `devLinks` - Task links (related)

---

## Next Steps and Approval Requirements

### Immediate Actions Required

1. **Backend Team Review and Approval:**
   - Review `BACKEND_CHANGE_REQUEST_001_TASKS_API.md`
   - Review `BACKEND_CHANGE_REQUEST_002_TIMER_OPERATIONS.md`
   - Review `BACKEND_BUSINESS_LOGIC_REQUIREMENTS.md`
   - Approve database schema changes
   - Commit to API endpoint implementation timeline

2. **Schema Deployment (Phase 0.1):**
   - Deploy `tasks` table to Supabase production
   - Deploy `time_entries` table to Supabase production
   - Add `time_entry_id` column to `customer_sales`
   - Create indexes, constraints, triggers, RLS policies
   - Validation testing

3. **Migration Script Development:**
   - Develop `exportFileMakerTasks.js`
   - Develop `exportFileMakerTimeEntries.js`
   - Develop `migrateTasksToSupabase.js`
   - Develop `migrateTimeEntriesToSupabase.js`
   - Develop `dailyReconciliation.js`
   - Unit test all scripts

4. **Data Quality Assessment:**
   - Export FileMaker data
   - Run data quality checks
   - Identify and resolve orphaned records
   - Verify dependencies migrated
   - Generate pre-migration report

### Decision Points

**Decision 1: Migration Timeline**
- **Question:** When to start Phase 0 (schema deployment)?
- **Stakeholders:** Backend team, product team
- **Deadline:** TBD

**Decision 2: Orphaned Record Handling**
- **Question:** Skip orphaned timers or create placeholder tasks?
- **Recommendation:** Skip and log for manual review
- **Stakeholders:** Product team
- **Deadline:** Before Phase 1

**Decision 3: Feature Flag Rollout Speed**
- **Question:** How fast to roll out Supabase backend (10% → 100%)?
- **Recommendation:** 5 days (10% → 25% → 50% → 75% → 100%)
- **Stakeholders:** Product team, engineering team
- **Deadline:** During Phase 4

**Decision 4: FileMaker Deprecation**
- **Question:** When to fully decommission FileMaker tasks/timers?
- **Recommendation:** 2 weeks after successful cutover
- **Stakeholders:** Backend team, operations team
- **Deadline:** Phase 5

### Success Metrics

**Migration Success:**
- ✅ 100% of tasks migrated (minus acceptable orphans)
- ✅ 100% of timer records migrated
- ✅ 0% data loss
- ✅ Calculation accuracy within 1-minute tolerance
- ✅ All foreign keys resolved

**Cutover Success:**
- ✅ Error rate < 0.1% post-cutover
- ✅ Performance within SLA (P95 < 500ms)
- ✅ No rollback required
- ✅ User satisfaction maintained
- ✅ QuickBooks integration stable

**Decommission Success:**
- ✅ FileMaker dual-write code removed
- ✅ Documentation updated
- ✅ Performance optimized
- ✅ Team trained on new system

---

## Appendix: Migration Checklist

### Pre-Migration Checklist

- [ ] Backend team approved schema changes
- [ ] `tasks` table deployed to Supabase production
- [ ] `time_entries` table deployed to Supabase production
- [ ] Indexes, constraints, triggers created
- [ ] RLS policies enabled
- [ ] Migration scripts developed and tested
- [ ] FileMaker data exported
- [ ] Data quality checks passed
- [ ] Dependency verification complete
- [ ] Rollback procedures tested
- [ ] Team trained on migration process

### Migration Execution Checklist

- [ ] Phase 0 complete: Schema deployed and validated
- [ ] Phase 1 complete: Tasks migrated successfully
- [ ] Phase 1 complete: Time entries migrated successfully
- [ ] Phase 1 validation: Row counts match
- [ ] Phase 1 validation: Foreign keys resolved
- [ ] Phase 2 complete: Dual-write implemented
- [ ] Phase 2 validation: New tasks write to both systems
- [ ] Phase 2 validation: New timers write to both systems
- [ ] Phase 3 complete: Reconciliation passed
- [ ] Phase 3 validation: No discrepancies found
- [ ] Phase 4 complete: Backend API deployed
- [ ] Phase 4 complete: Frontend cutover complete
- [ ] Phase 4 validation: 100% rollout successful
- [ ] Phase 5 complete: Dual-write code removed
- [ ] Phase 5 complete: FileMaker dependencies removed
- [ ] Phase 5 validation: Final reconciliation passed

### Post-Migration Checklist

- [ ] All users migrated to Supabase backend
- [ ] FileMaker tasks/timers read-only or archived
- [ ] Documentation updated
- [ ] Team trained on new system
- [ ] Performance optimized
- [ ] Monitoring in place
- [ ] Success metrics achieved
- [ ] Stakeholders notified of completion

---

**Document End**

**Next Actions:**
1. Submit to backend team for schema approval
2. Review with product team for timeline alignment
3. Begin Phase 0 preparation

**Questions or Feedback:** Contact frontend team or file issue in project tracker.
