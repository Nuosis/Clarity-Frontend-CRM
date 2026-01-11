# Tasks & Timer - Acceptance Criteria and Test Plan

## Overview

This document defines the acceptance criteria for the Tasks and Timer migration from FileMaker to Supabase, including functional test cases, edge cases, performance requirements, and success metrics. Special attention is given to timer semantics, race conditions, partial failures, and financial record reconciliation.

## Acceptance Criteria

### AC1: Schema Migration

**Criteria**: Supabase schema must support all task and timer functionality currently implemented in FileMaker

**Verification**:
- ✅ `tasks` table exists with all required columns
- ✅ `time_entries` table exists with timer state tracking
- ✅ `customer_sales` table updated with `time_entry_id` column
- ✅ `filemaker_id_mappings` table exists for ID reconciliation
- ✅ All indexes created for performance (project_id, staff_id, organization_id, status)
- ✅ Unique constraint: one active timer per staff member
- ✅ Check constraints enforce business rules (duration >= 0, status values)
- ✅ Foreign keys have appropriate CASCADE/RESTRICT behaviors
- ✅ `updated_at` triggers auto-update on modifications
- ✅ Duration calculation trigger on time_entries
- ✅ Actual hours rollup trigger on tasks

**Test Query**:
```sql
-- Verify tasks table structure
\d+ tasks

-- Verify time_entries table structure
\d+ time_entries

-- Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('tasks', 'time_entries')
ORDER BY tablename, indexname;

-- Verify unique constraint on active timer
SELECT indexname, indexdef
FROM pg_indexes
WHERE indexname = 'idx_one_active_timer_per_staff';

-- Verify foreign keys
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('tasks', 'time_entries');

-- Verify triggers
SELECT tgname, tgrelid::regclass, tgtype
FROM pg_trigger
WHERE tgrelid::regclass::text IN ('tasks', 'time_entries')
  AND tgname NOT LIKE 'RI_ConstraintTrigger%'
ORDER BY tgrelid::regclass::text, tgname;
```

---

### AC2: Data Migration Completeness

**Criteria**: All FileMaker tasks and timer records must be migrated without data loss

**Verification**:
- ✅ Task count matches: FileMaker count = Supabase count (~10,000 tasks)
- ✅ Time entry count matches: FileMaker count = Supabase count (~50,000 records)
- ✅ All task titles, types, notes migrated successfully
- ✅ All completion statuses preserved (f_completed → is_completed)
- ✅ All task assignments (staff_id) correctly mapped to Supabase UUIDs
- ✅ All project relationships preserved
- ✅ All time entry descriptions ("Work Performed") migrated
- ✅ All timestamps preserved and converted to ISO 8601 UTC
- ✅ All time adjustments (TimeAdjust) preserved as adjustment_seconds
- ✅ All durations and billable amounts recalculated correctly
- ✅ No orphaned tasks (all have valid project_id, organization_id)
- ✅ No orphaned time entries (all have valid task_id, staff_id)
- ✅ FileMaker IDs preserved in filemaker_task_id, filemaker_record_id

**Test Queries**:
```sql
-- Count validation
SELECT
  (SELECT COUNT(*) FROM filemaker_tasks_backup) AS filemaker_task_count,
  (SELECT COUNT(*) FROM tasks) AS supabase_task_count,
  (SELECT COUNT(*) FROM filemaker_records_backup) AS filemaker_time_count,
  (SELECT COUNT(*) FROM time_entries) AS supabase_time_count;

-- Completion status distribution
SELECT
  COUNT(*) FILTER (WHERE is_completed = true) AS completed_tasks,
  COUNT(*) FILTER (WHERE is_completed = false) AS active_tasks,
  COUNT(*) FILTER (WHERE status = 'completed') AS status_completed,
  COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress')) AS status_active
FROM tasks;

-- Time entry status distribution
SELECT
  COUNT(*) FILTER (WHERE status = 'completed') AS completed_entries,
  COUNT(*) FILTER (WHERE status = 'active') AS active_entries,
  COUNT(*) FILTER (WHERE status = 'paused') AS paused_entries
FROM time_entries;

-- Verify task-to-time-entry relationships
SELECT
  t.id,
  t.title,
  COUNT(te.id) AS time_entry_count,
  SUM(te.duration_minutes) AS total_minutes,
  t.actual_hours,
  (SUM(te.duration_minutes) / 60.0) AS calculated_hours
FROM tasks t
LEFT JOIN time_entries te ON te.task_id = t.id AND te.status = 'completed'
GROUP BY t.id, t.title, t.actual_hours
HAVING ABS(t.actual_hours - (SUM(te.duration_minutes) / 60.0)) > 0.01
ORDER BY ABS(t.actual_hours - (SUM(te.duration_minutes) / 60.0)) DESC
LIMIT 10;
-- Should return 0 rows (actual_hours should match calculated)

-- Verify no orphaned tasks
SELECT COUNT(*) FROM tasks
WHERE organization_id IS NULL OR project_id IS NULL;
-- Should return 0

-- Verify no orphaned time entries
SELECT COUNT(*) FROM time_entries
WHERE task_id NOT IN (SELECT id FROM tasks);
-- Should return 0

-- Verify customer_sales records created for completed time entries
SELECT
  COUNT(*) FILTER (WHERE cs.id IS NOT NULL) AS has_customer_sale,
  COUNT(*) FILTER (WHERE cs.id IS NULL) AS missing_customer_sale
FROM time_entries te
LEFT JOIN customer_sales cs ON cs.time_entry_id = te.id
WHERE te.status = 'completed';
-- missing_customer_sale should be 0
```

---

### AC3: Backend API Endpoints

**Criteria**: All task CRUD and timer operations functional via REST API or RPC functions

**Verification**:

**Task Endpoints:**
- ✅ GET /tasks - Returns filtered task list (project_id, staff_id, status, include_completed)
- ✅ GET /tasks/:id - Returns single task with active timer info
- ✅ POST /tasks - Creates task with validation
- ✅ PATCH /tasks/:id - Updates task fields
- ✅ POST /tasks/:id/toggle-completion - Toggles completion status
- ✅ DELETE /tasks/:id - Deletes task (with constraint checks)

**Timer Endpoints:**
- ✅ POST /time-entries/start - Starts timer with idempotency
- ✅ POST /time-entries/:id/pause - Pauses timer (optional, or client-side only)
- ✅ POST /time-entries/:id/resume - Resumes timer
- ✅ POST /time-entries/:id/stop - Stops timer and creates customer_sales record atomically
- ✅ PATCH /time-entries/:id/adjust - Adjusts completed time entry
- ✅ GET /time-entries/active - Gets active timer for staff member
- ✅ GET /time-entries - Lists time entries with filters

**RPC Functions:**
- ✅ stop_timer_and_create_sale(entry_uuid, description, adjustment_secs, pause_secs) - Atomic operation
- ✅ calculate_task_actual_hours(task_uuid) - Recalculates task hours
- ✅ get_staff_active_timer(staff_uuid) - Concurrency check

**Authentication & Errors:**
- ✅ HMAC authentication required on all endpoints
- ✅ 400 errors for invalid input
- ✅ 401 errors for invalid/expired HMAC signature
- ✅ 403 errors for unauthorized access
- ✅ 404 errors for non-existent resources
- ✅ 409 errors for conflicts (duplicate active timer, concurrent updates)

**Test Cases**: See "Backend API Tests" section below

---

### AC4: Row-Level Security

**Criteria**: Users can only access tasks/timers for entities in their organization

**Verification**:
- ✅ Users in Org A cannot read tasks from Org B
- ✅ Users in Org A cannot create tasks for Org B projects
- ✅ Users in Org A cannot update/delete Org B tasks
- ✅ Staff members can only start timers for themselves (unless Admin/Manager)
- ✅ Staff members can only stop their own timers (unless Admin/Manager)
- ✅ Admins/Managers can manage team tasks and timers
- ✅ Anonymous users cannot access any tasks/timers
- ✅ Service role can access all tasks (for admin operations)
- ✅ RLS policies apply to time_entries table
- ✅ Cannot create time entry for task in different organization

**Test Cases**: See "RLS Tests" section below

---

### AC5: Frontend Integration

**Criteria**: Existing UI workflows function identically with Supabase backend

**Verification**:

**Task Management:**
- ✅ `src/api/tasks.js` uses backend API instead of FileMaker
- ✅ Task list displays correctly for project
- ✅ Creating new task works via TaskList component
- ✅ Updating task title/notes works inline
- ✅ Toggling task completion works
- ✅ Task deletion works with confirmation
- ✅ Task filtering (completed/active) works
- ✅ Task sorting works correctly
- ✅ Actual hours display updates when timers complete

**Timer Operations:**
- ✅ TaskTimer component starts timer correctly
- ✅ Timer displays elapsed time in real-time
- ✅ Pause button pauses timer (local state)
- ✅ Resume button resumes timer
- ✅ Time adjustment buttons (±6 min) work correctly
- ✅ Stop dialog prompts for "Work Performed" description
- ✅ Stop timer creates time entry AND customer_sales record
- ✅ Timer stop updates task actual_hours
- ✅ Active timer persists across page refresh (localStorage)
- ✅ Active timer indicator shows on task list
- ✅ Cannot start timer if one already active (shows existing timer)
- ✅ Keyboard shortcut (Cmd/Ctrl+S) stops timer quickly

**Error Handling:**
- ✅ Error handling displays user-friendly messages
- ✅ Loading states show during operations
- ✅ Optimistic UI updates work correctly
- ✅ Rollback on error (e.g., timer start fails)

**Dual-Write Removal:**
- ✅ `dualWriteService.js` no longer called (deprecated)
- ✅ `financialSyncService.js` no longer needed for tasks/timers
- ✅ No FileMaker bridge calls for task/timer operations
- ✅ All operations go directly to Supabase backend

**Test Cases**: See "Frontend UI Tests" section below

---

### AC6: Timer Semantics and Business Rules

**Criteria**: Timer behavior matches FileMaker implementation exactly

**Verification**:

**Timer Start:**
- ✅ Idempotent: starting timer twice returns existing timer (no duplicate)
- ✅ Concurrency: only one active timer per staff member globally
- ✅ Auto-populates project_id, customer_id from task
- ✅ Fetches and stores staff hourly_rate at start time
- ✅ Creates time_entry with status='active'
- ✅ Timestamps in UTC

**Timer Pause/Resume:**
- ✅ Pause tracking accumulates total pause time
- ✅ Multiple pause/resume cycles supported
- ✅ Pause time sent to backend on stop (as part of adjustment)
- ✅ Alternative: pause tracking can be client-side only

**Timer Stop:**
- ✅ Prompts for "Work Performed" description
- ✅ Accepts time adjustment (positive or negative seconds)
- ✅ Accepts pause duration (accumulated pauses)
- ✅ Calculates duration: (end_time - start_time - adjustment - pause) / 60
- ✅ Duration must be >= 0 (validation error if negative)
- ✅ Calculates billable_amount: (duration / 60) * hourly_rate
- ✅ Atomically creates customer_sales record with same data
- ✅ Updates task actual_hours
- ✅ Sets time_entry status='completed'
- ✅ Sets completed_at timestamp
- ✅ Returns both time_entry and customer_sale in response

**Time Adjustment:**
- ✅ ±6 minute buttons work correctly
- ✅ Adjustment accumulated in local state
- ✅ Sent to backend on stop as adjustment_seconds
- ✅ Can be positive (time added) or negative (time subtracted)
- ✅ Post-stop adjustment updates duration, billable_amount, customer_sales

**Concurrency and Race Conditions:**
- ✅ Two simultaneous timer starts for same staff → second returns existing timer (idempotent)
- ✅ Timer stop while another user stopping → pessimistic lock (FOR UPDATE) prevents duplicate
- ✅ Task update while timer active → allowed (no conflict)
- ✅ Task deletion while timer active → blocked (foreign key constraint)
- ✅ Browser refresh with active timer → timer state recovered from localStorage + backend

**Test Cases**: See "Timer Semantics Tests" section below

---

### AC7: Financial Record Integration

**Criteria**: Timer stop creates accurate customer_sales records for billing

**Verification**:
- ✅ Each completed time_entry has exactly one customer_sales record
- ✅ customer_sales.time_entry_id links back to time_entry.id
- ✅ customer_sales.amount matches time_entry.billable_amount
- ✅ customer_sales.duration matches time_entry.duration_minutes
- ✅ customer_sales.description matches time_entry.description
- ✅ customer_sales.date = time_entry.start_time::DATE
- ✅ customer_sales.customer_id, project_id, task_id match time_entry
- ✅ customer_sales.status = 'draft' by default
- ✅ customer_sales.is_billable = true by default
- ✅ Updating time_entry adjustment updates corresponding customer_sales record
- ✅ Cannot delete time_entry if customer_sale is invoiced (invoice_id NOT NULL)
- ✅ QuickBooks integration can sync customer_sales as before

**Test Queries**:
```sql
-- Verify 1:1 relationship
SELECT
  COUNT(DISTINCT te.id) AS time_entries,
  COUNT(DISTINCT cs.id) AS customer_sales,
  COUNT(*) FILTER (WHERE cs.id IS NULL) AS missing_sales
FROM time_entries te
LEFT JOIN customer_sales cs ON cs.time_entry_id = te.id
WHERE te.status = 'completed';
-- missing_sales should be 0

-- Verify amount consistency
SELECT
  te.id AS time_entry_id,
  te.billable_amount AS te_amount,
  cs.amount AS cs_amount,
  ABS(te.billable_amount - cs.amount) AS difference
FROM time_entries te
JOIN customer_sales cs ON cs.time_entry_id = te.id
WHERE ABS(te.billable_amount - cs.amount) > 0.01
ORDER BY difference DESC
LIMIT 10;
-- Should return 0 rows (amounts should match exactly)

-- Verify duration consistency
SELECT
  te.id AS time_entry_id,
  te.duration_minutes AS te_duration,
  cs.duration AS cs_duration,
  ABS(te.duration_minutes - cs.duration) AS difference
FROM time_entries te
JOIN customer_sales cs ON cs.time_entry_id = te.id
WHERE ABS(te.duration_minutes - cs.duration) > 0.01
ORDER BY difference DESC
LIMIT 10;
-- Should return 0 rows
```

---

## Test Suites

### Test Suite 1: Backend API Tests

#### TS1.1: Task CRUD Operations

**TC1.1.1: Create Task**
```bash
# Request
POST /tasks
{
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "staff_id": "770g0622-g41d-63f6-c938-668877662222",
  "title": "Implement feature X",
  "task_type": "Development",
  "priority": 3
}

# Expected: 201 Created
{
  "success": true,
  "data": {
    "id": "new-task-uuid",
    "title": "Implement feature X",
    "is_completed": false,
    "status": "pending",
    "customer_id": "auto-populated-from-project"
  }
}
```

**TC1.1.2: Create Task - Invalid Project**
```bash
# Request
POST /tasks
{
  "project_id": "non-existent-uuid",
  "title": "Test task"
}

# Expected: 400 Bad Request
{
  "success": false,
  "error": "Project does not exist or does not belong to your organization",
  "error_code": "VALIDATION_ERROR"
}
```

**TC1.1.3: Get Tasks for Project**
```bash
# Request
GET /tasks?project_id=550e8400-e29b-41d4-a716-446655440000&include_completed=false

# Expected: 200 OK
{
  "success": true,
  "data": [
    { "id": "...", "title": "...", "is_completed": false }
  ],
  "meta": { "count": 5, "total": 15 }
}
```

**TC1.1.4: Update Task**
```bash
# Request
PATCH /tasks/123e4567-e89b-12d3-a456-426614174000
{
  "title": "Updated title",
  "status": "in_progress"
}

# Expected: 200 OK
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "title": "Updated title",
    "status": "in_progress"
  }
}
```

**TC1.1.5: Toggle Task Completion**
```bash
# Request
POST /tasks/123e4567-e89b-12d3-a456-426614174000/toggle-completion
{
  "completed": true
}

# Expected: 200 OK
{
  "success": true,
  "data": {
    "is_completed": true,
    "status": "completed"
  }
}
```

**TC1.1.6: Cannot Complete Task with Active Timer**
```bash
# Setup: Start timer for task
POST /time-entries/start
{ "task_id": "123e4567-e89b-12d3-a456-426614174000" }

# Request
POST /tasks/123e4567-e89b-12d3-a456-426614174000/toggle-completion
{ "completed": true }

# Expected: 400 Bad Request
{
  "success": false,
  "error": "Cannot complete task with active timer",
  "error_code": "TIMER_ACTIVE"
}
```

---

#### TS1.2: Timer Operations

**TC1.2.1: Start Timer**
```bash
# Request
POST /time-entries/start
{
  "task_id": "123e4567-e89b-12d3-a456-426614174000",
  "description": "Starting work on feature"
}

# Expected: 201 Created
{
  "success": true,
  "data": {
    "id": "time-entry-uuid",
    "task_id": "123e4567-e89b-12d3-a456-426614174000",
    "start_time": "2026-01-10T16:30:00Z",
    "status": "active",
    "hourly_rate": 150.00
  }
}
```

**TC1.2.2: Start Timer - Idempotency (Timer Already Active)**
```bash
# Setup: Timer already active
POST /time-entries/start
{ "task_id": "123e4567-e89b-12d3-a456-426614174000" }

# Request (repeat)
POST /time-entries/start
{ "task_id": "123e4567-e89b-12d3-a456-426614174000" }

# Expected: 200 OK (same timer returned)
{
  "success": true,
  "data": {
    "id": "same-time-entry-uuid",
    "task_id": "123e4567-e89b-12d3-a456-426614174000",
    "start_time": "2026-01-10T16:30:00Z",
    "status": "active"
  }
}
```

**TC1.2.3: Start Timer - Staff Has Active Timer for Different Task**
```bash
# Setup: Staff has active timer for task A
POST /time-entries/start
{ "task_id": "task-a-uuid" }

# Request: Start timer for task B
POST /time-entries/start
{ "task_id": "task-b-uuid" }

# Expected: 400 Bad Request
{
  "success": false,
  "error": "Staff member already has an active timer for task A",
  "error_code": "TIMER_ALREADY_ACTIVE",
  "details": {
    "existing_timer_id": "time-entry-uuid",
    "existing_task_id": "task-a-uuid"
  }
}
```

**TC1.2.4: Get Active Timer**
```bash
# Request
GET /time-entries/active?staff_id=770g0622-g41d-63f6-c938-668877662222

# Expected: 200 OK
{
  "success": true,
  "data": {
    "id": "time-entry-uuid",
    "task_id": "123e4567-e89b-12d3-a456-426614174000",
    "task_title": "Implement feature X",
    "start_time": "2026-01-10T14:00:00Z",
    "elapsed_seconds": 3600
  }
}
```

**TC1.2.5: Stop Timer**
```bash
# Request
POST /time-entries/time-entry-uuid/stop
{
  "description": "Completed user login flow",
  "adjustment_seconds": 360,
  "pause_duration_seconds": 120
}

# Expected: 200 OK
{
  "success": true,
  "data": {
    "time_entry": {
      "id": "time-entry-uuid",
      "end_time": "2026-01-10T17:30:00Z",
      "duration_minutes": 204.0,
      "billable_amount": 510.00,
      "status": "completed"
    },
    "customer_sale": {
      "id": "sale-uuid",
      "time_entry_id": "time-entry-uuid",
      "amount": 510.00,
      "duration": 204.0,
      "status": "draft"
    }
  }
}
```

**TC1.2.6: Stop Timer - Negative Duration**
```bash
# Request
POST /time-entries/time-entry-uuid/stop
{
  "description": "Work done",
  "adjustment_seconds": 10000,  # 10000 seconds > elapsed time
  "pause_duration_seconds": 5000
}

# Expected: 400 Bad Request
{
  "success": false,
  "error": "Cannot stop timer with negative duration",
  "error_code": "DURATION_NEGATIVE"
}
```

**TC1.2.7: Stop Timer - Already Completed**
```bash
# Setup: Timer already stopped
POST /time-entries/time-entry-uuid/stop
{ "description": "Done" }

# Request (repeat)
POST /time-entries/time-entry-uuid/stop
{ "description": "Done again" }

# Expected: 400 Bad Request
{
  "success": false,
  "error": "Time entry not found or already completed",
  "error_code": "ALREADY_COMPLETED"
}
```

**TC1.2.8: Adjust Time Entry**
```bash
# Request
PATCH /time-entries/time-entry-uuid/adjust
{
  "adjustment_seconds": 720,
  "description": "Updated description"
}

# Expected: 200 OK
{
  "success": true,
  "data": {
    "adjustment_seconds": 720,
    "duration_minutes": 192.0,
    "billable_amount": 480.00
  }
}
```

**TC1.2.9: Cannot Adjust Invoiced Time Entry**
```bash
# Setup: Time entry has been invoiced
UPDATE customer_sales SET invoice_id = 'inv-123' WHERE time_entry_id = 'time-entry-uuid';

# Request
PATCH /time-entries/time-entry-uuid/adjust
{ "adjustment_seconds": 600 }

# Expected: 400 Bad Request
{
  "success": false,
  "error": "Cannot adjust time entry that has been invoiced",
  "error_code": "ENTRY_INVOICED"
}
```

---

### Test Suite 2: RLS Policy Tests

**TC2.1: Cross-Organization Task Access**
```sql
-- Setup: User A in Org 1, Task belongs to Org 2
SET LOCAL jwt.claims.organization_id = 'org-1-uuid';

-- Attempt to read task from Org 2
SELECT * FROM tasks WHERE id = 'org-2-task-uuid';

-- Expected: 0 rows returned (RLS blocks)
```

**TC2.2: Staff Cannot Start Timer for Another Staff**
```sql
-- Setup: User A (staff) tries to create timer for User B
SET LOCAL jwt.claims.sub = 'user-a-uuid';
SET LOCAL jwt.claims.organization_id = 'org-1-uuid';

-- Attempt to insert time entry with different staff_id
INSERT INTO time_entries (task_id, staff_id, start_time, organization_id)
VALUES ('task-uuid', 'user-b-uuid', now(), 'org-1-uuid');

-- Expected: RLS policy violation (INSERT blocked)
```

**TC2.3: Admin Can Start Timer for Staff**
```sql
-- Setup: User A is admin
SET LOCAL jwt.claims.sub = 'admin-uuid';
SET LOCAL jwt.claims.organization_id = 'org-1-uuid';
SET LOCAL jwt.claims.user_metadata.role = 'admin';

-- Attempt to insert time entry for staff member
INSERT INTO time_entries (task_id, staff_id, start_time, organization_id)
VALUES ('task-uuid', 'staff-uuid', now(), 'org-1-uuid');

-- Expected: Success (admin allowed)
```

**TC2.4: Cannot Create Task for Project in Different Org**
```sql
-- Setup: User in Org 1, Project in Org 2
SET LOCAL jwt.claims.organization_id = 'org-1-uuid';

-- Attempt to create task for Org 2 project
INSERT INTO tasks (project_id, organization_id, title)
VALUES ('org-2-project-uuid', 'org-1-uuid', 'Test task');

-- Expected: Trigger raises exception (organization mismatch)
```

---

### Test Suite 3: Timer Semantics Tests

**TC3.1: Race Condition - Simultaneous Timer Starts**
```bash
# Thread 1: Start timer
POST /time-entries/start
{ "task_id": "task-uuid" }

# Thread 2: Start timer (simultaneously)
POST /time-entries/start
{ "task_id": "task-uuid" }

# Expected:
# - Thread 1: 201 Created (new timer)
# - Thread 2: 200 OK (returns Thread 1's timer, idempotent)
# - Database has exactly 1 active timer for staff
```

**TC3.2: Race Condition - Simultaneous Timer Stops**
```bash
# Setup: Active timer exists
# Thread 1: Stop timer
POST /time-entries/timer-uuid/stop
{ "description": "Done" }

# Thread 2: Stop timer (simultaneously)
POST /time-entries/timer-uuid/stop
{ "description": "Done" }

# Expected:
# - Thread 1: 200 OK (timer stopped, customer_sale created)
# - Thread 2: 400 Bad Request (already completed)
# - Database has exactly 1 customer_sales record
```

**TC3.3: Pause/Resume Accumulation**
```javascript
// Timer started at 10:00:00
// User pauses at 10:15:00 (15 min elapsed)
// User resumes at 10:20:00 (5 min paused)
// User pauses again at 10:25:00 (5 min elapsed)
// User resumes at 10:35:00 (10 min paused)
// User stops at 10:40:00 (5 min elapsed)

// Total elapsed: 40 minutes
// Total work time: 15 + 5 + 5 = 25 minutes
// Total pause time: 5 + 10 = 15 minutes

// Stop request:
POST /time-entries/timer-uuid/stop
{
  "description": "Work done",
  "pause_duration_seconds": 900  // 15 minutes
}

// Expected duration_minutes: (40 * 60 - 900) / 60 = 25 minutes
```

**TC3.4: Time Adjustment Calculation**
```javascript
// Timer: 10:00:00 to 12:00:00 (2 hours = 120 minutes)
// User adds +6 min, then -6 min, then +6 min
// Net adjustment: +6 minutes

// Stop request:
POST /time-entries/timer-uuid/stop
{
  "description": "Done",
  "adjustment_seconds": 360,  // +6 minutes
  "pause_duration_seconds": 0
}

// Expected duration_minutes: (120 + 6) = 126 minutes
```

**TC3.5: Browser Refresh with Active Timer**
```javascript
// 1. Start timer
POST /time-entries/start
{ "task_id": "task-uuid" }
// Response: { id: "timer-uuid", start_time: "10:00:00Z" }

// 2. Store in localStorage
localStorage.setItem('activeTimer', JSON.stringify({
  recordId: "timer-uuid",
  taskId: "task-uuid",
  TimeStart: "10:00:00"
}));

// 3. User refreshes browser at 10:30:00

// 4. On mount, fetch active timer
GET /time-entries/active
// Response: { id: "timer-uuid", start_time: "10:00:00Z", elapsed_seconds: 1800 }

// 5. UI resumes countdown from 30 minutes
```

**TC3.6: Offline/Reconnect Scenario**
```javascript
// 1. Timer active, user goes offline at 10:15:00
// 2. Client timer continues ticking locally
// 3. User clicks stop at 10:45:00 (30 min elapsed locally)
// 4. Stop request fails (offline)
// 5. User reconnects at 11:00:00
// 6. Retry stop request

POST /time-entries/timer-uuid/stop
{
  "description": "Done",
  "pause_duration_seconds": 0
}

// Server calculates: 11:00:00 - 10:00:00 = 60 minutes
// Client expected: 30 minutes

// Expected: Server time wins (60 minutes), client time ignored
// UI should warn user about time discrepancy
```

---

### Test Suite 4: Frontend UI Tests

**TC4.1: Task List Display**
```
Given: User views project with 10 tasks (5 active, 5 completed)
When: Page loads
Then:
  - Task list shows 10 tasks
  - Active tasks displayed first
  - Completed tasks displayed below (greyed out)
  - Each task shows title, assigned staff, actual hours
  - Active timer indicator shows if timer running
```

**TC4.2: Create Task**
```
Given: User on project details page
When: User clicks "Add Task" button
  And: Fills in form (title: "Test task", type: "Development")
  And: Clicks "Save"
Then:
  - API request sent to POST /tasks
  - New task appears in list
  - Task has status "pending"
  - Success notification shown
```

**TC4.3: Toggle Task Completion**
```
Given: Task is active (is_completed = false)
When: User clicks completion checkbox
Then:
  - Checkbox shows loading state
  - API request sent to POST /tasks/:id/toggle-completion
  - Task status updates to "completed"
  - Task moves to completed section
  - Actual hours displayed
```

**TC4.4: Start Timer**
```
Given: Task has no active timer
When: User clicks "Start Timer" button
Then:
  - API request sent to POST /time-entries/start
  - Timer starts counting up from 00:00:00
  - Timer controls show (pause, stop, adjust)
  - Timer indicator shows on task in list
  - Other tasks' start buttons disabled (one timer at a time)
```

**TC4.5: Start Timer - Already Active**
```
Given: Staff has active timer for Task A
When: User clicks "Start Timer" on Task B
Then:
  - Warning dialog shown: "You have an active timer for Task A. Stop it first?"
  - User can navigate to Task A or cancel
  - Timer for Task B does not start
```

**TC4.6: Pause Timer**
```
Given: Timer is running
When: User clicks "Pause" button
Then:
  - Timer stops incrementing
  - Pause button changes to "Resume"
  - Pause time tracked in local state
  - No API call made (client-side only)
```

**TC4.7: Resume Timer**
```
Given: Timer is paused
When: User clicks "Resume" button
Then:
  - Timer resumes incrementing
  - Resume button changes to "Pause"
  - Accumulated pause time preserved
```

**TC4.8: Adjust Time (+6 min)**
```
Given: Timer is running, elapsed time is 30:00
When: User clicks "+6 min" button
Then:
  - Elapsed time changes to 36:00
  - Adjustment tracked in local state (+360 seconds)
  - No API call made
```

**TC4.9: Adjust Time (-6 min)**
```
Given: Timer is running, elapsed time is 30:00
When: User clicks "-6 min" button
Then:
  - Elapsed time changes to 24:00
  - Adjustment tracked in local state (-360 seconds)
```

**TC4.10: Stop Timer - Success**
```
Given: Timer running for 1 hour
When: User clicks "Stop" button
  And: Enters description: "Completed login feature"
  And: Clicks "Save & Stop"
Then:
  - Stop dialog shows
  - API request sent to POST /time-entries/:id/stop
  - Timer stops
  - Success notification: "Time entry saved: 1.0 hours"
  - Timer controls hidden
  - Task actual_hours updates to include this entry
  - Other tasks' start buttons re-enabled
```

**TC4.11: Stop Timer - Keyboard Shortcut**
```
Given: Timer running
When: User presses Cmd/Ctrl+S (while timer focused)
Then:
  - Stop dialog shows immediately
  - Same flow as TC4.10
```

**TC4.12: Stop Timer - Validation Error**
```
Given: Timer running for 5 minutes
  And: User adjusted time by -10 minutes (net negative)
When: User clicks "Stop"
  And: Clicks "Save & Stop"
Then:
  - API returns 400 error (negative duration)
  - Error message shown: "Timer duration cannot be negative"
  - Timer remains active
  - User can adjust time again or cancel
```

**TC4.13: Page Refresh with Active Timer**
```
Given: Timer running for 30 minutes
When: User refreshes browser
Then:
  - Page reloads
  - Timer state recovered from localStorage
  - API called to fetch active timer
  - Timer resumes counting from 30 minutes
  - Pause/adjustment state preserved if stored
```

**TC4.14: View Time Entries for Task**
```
Given: Task has 3 completed time entries
When: User views task details
Then:
  - Time entries list shows 3 entries
  - Each entry shows: date, description, duration, amount
  - Total hours displayed (sum of all entries)
  - Entries sorted by date (newest first)
```

---

### Test Suite 5: Edge Cases and Error Handling

**TC5.1: Negative Duration After Adjustments**
```
Scenario: User adjusts time so much that duration would be negative
Given: Timer ran for 10 minutes
When: User adjusts -20 minutes and stops
Then: Error shown "Duration cannot be negative"
```

**TC5.2: Timer Across Midnight**
```
Scenario: Timer started before midnight, stopped after
Given: Timer started at 23:45:00 on 2026-01-10
When: User stops at 00:15:00 on 2026-01-11
Then:
  - Duration calculated correctly: 30 minutes
  - customer_sales.date = 2026-01-10 (start date)
  - Timestamps stored in UTC (no timezone issues)
```

**TC5.3: Task Deleted While Timer Active**
```
Scenario: Admin deletes task while timer running
Given: Staff has active timer for task
When: Admin tries to delete task
Then:
  - Error: "Cannot delete task with active timer" OR
  - Task soft-deleted, timer continues until stopped
```

**TC5.4: Project Deleted While Timer Active**
```
Scenario: Admin deletes project while timer running on task
Given: Staff has active timer for task in project
When: Admin tries to delete project
Then:
  - Error: "Cannot delete project with active timers"
  - Or: Cascade delete prevented by foreign key constraint
```

**TC5.5: Staff Deleted/Deactivated While Timer Active**
```
Scenario: Staff member deleted while their timer is active
Given: Staff has active timer
When: Admin deactivates/deletes staff account
Then:
  - Timer remains in database (staff_id foreign key ON DELETE RESTRICT) OR
  - Timer auto-stopped with note "Staff account deactivated"
```

**TC5.6: Concurrent Task Updates**
```
Scenario: Two users update same task simultaneously
Given: Task with current status "pending"
When: User A sets status to "in_progress"
  And: User B sets status to "completed" (simultaneously)
Then:
  - Optimistic locking or last-write-wins
  - updated_at timestamp updated
  - Possible conflict notification to User A
```

**TC5.7: Network Timeout on Timer Stop**
```
Scenario: Network request times out during timer stop
Given: Timer active for 1 hour
When: User clicks stop, network fails
Then:
  - Error notification shown
  - Timer remains active (not stopped locally)
  - User can retry stop
  - No duplicate customer_sales record created
```

**TC5.8: Partial Failure - Timer Stopped but Customer Sale Failed**
```
Scenario: RPC function stops timer but fails to create customer_sale
Given: Timer active
When: stop_timer_and_create_sale RPC called
  And: time_entry update succeeds
  And: customer_sales insert fails (e.g., constraint violation)
Then:
  - Transaction rolled back (ACID)
  - time_entry remains active
  - Error returned to client
  - User can retry
```

**TC5.9: Zero-Duration Timer**
```
Scenario: User starts and immediately stops timer
Given: Timer just started (0 seconds elapsed)
When: User stops timer immediately
Then:
  - Duration calculated as 0 minutes
  - Billable amount = 0
  - customer_sales record created with amount = 0
  - No error (valid use case)
```

**TC5.10: Missing Hourly Rate**
```
Scenario: Staff member has no hourly rate set
Given: Staff hourly_rate is NULL
When: User starts timer
Then:
  - Timer starts successfully
  - hourly_rate stored as NULL in time_entry
When: User stops timer
Then:
  - billable_amount calculated as NULL or 0
  - Warning shown: "No hourly rate set for staff member"
```

---

### Test Suite 6: Performance and Scalability

**TC6.1: Large Task List Performance**
```
Given: Project has 1,000 tasks
When: User loads task list
Then:
  - API responds within 500ms
  - Pagination used (50 tasks per page)
  - UI renders without lag
  - Indexes on project_id, status used
```

**TC6.2: High Volume Time Entry Queries**
```
Given: Database has 100,000 time entries
When: User queries time entries for date range (1 month)
Then:
  - Query completes within 1 second
  - Index on start_time used
  - Results limited to 500 entries (pagination)
```

**TC6.3: Concurrent Timer Operations**
```
Given: 100 staff members with active timers
When: 50 staff members stop timers simultaneously
Then:
  - All stop operations complete within 5 seconds
  - No deadlocks
  - All customer_sales records created correctly
  - Database connection pool not exhausted
```

**TC6.4: Task Actual Hours Calculation**
```
Given: Task has 100 time entries
When: New time entry completed
Then:
  - actual_hours trigger updates task
  - Update completes within 100ms
  - Aggregate query uses index on (task_id, status)
```

**TC6.5: Rate Limiting**
```
Given: User makes 10 timer start requests in 1 minute
When: User makes 11th request
Then:
  - 429 Too Many Requests returned
  - Retry-After header included
  - User shown friendly message: "Too many requests, please wait"
```

---

### Test Suite 7: Migration Validation Tests

**TC7.1: Historical Data Integrity**
```sql
-- Verify all FileMaker tasks migrated
SELECT
  fm.task_count,
  sb.task_count,
  fm.task_count - sb.task_count AS missing_count
FROM
  (SELECT COUNT(*) AS task_count FROM filemaker_tasks_backup) fm,
  (SELECT COUNT(*) AS task_count FROM tasks) sb;

-- Expected: missing_count = 0
```

**TC7.2: ID Mapping Validation**
```sql
-- Verify all FileMaker IDs mapped
SELECT
  COUNT(*) AS unmapped_tasks
FROM filemaker_tasks_backup fm
WHERE NOT EXISTS (
  SELECT 1 FROM tasks sb
  WHERE sb.filemaker_task_id = fm.__ID::text
);

-- Expected: unmapped_tasks = 0
```

**TC7.3: Relationship Integrity**
```sql
-- Verify all time entries link to valid tasks
SELECT COUNT(*) AS orphaned_entries
FROM time_entries te
WHERE NOT EXISTS (
  SELECT 1 FROM tasks t WHERE t.id = te.task_id
);

-- Expected: orphaned_entries = 0
```

**TC7.4: Financial Record Reconciliation**
```sql
-- Verify all completed time entries have customer_sales
SELECT
  COUNT(*) FILTER (WHERE cs.id IS NOT NULL) AS with_sale,
  COUNT(*) FILTER (WHERE cs.id IS NULL) AS without_sale
FROM time_entries te
LEFT JOIN customer_sales cs ON cs.time_entry_id = te.id
WHERE te.status = 'completed';

-- Expected: without_sale = 0
```

**TC7.5: Duration Calculation Validation**
```sql
-- Compare FileMaker vs Supabase duration calculations
SELECT
  fm.recordId,
  fm.duration_minutes AS fm_duration,
  sb.duration_minutes AS sb_duration,
  ABS(fm.duration_minutes - sb.duration_minutes) AS diff
FROM filemaker_records_backup fm
JOIN time_entries sb ON sb.filemaker_record_id = fm.__ID::text
WHERE ABS(fm.duration_minutes - sb.duration_minutes) > 0.1
ORDER BY diff DESC
LIMIT 10;

-- Expected: 0 rows (durations should match within 0.1 minutes)
```

---

## Success Metrics

### Functional Metrics
- ✅ 100% of tasks migrated successfully
- ✅ 100% of time entries migrated successfully
- ✅ 100% of customer_sales records created for completed timers
- ✅ 0 orphaned records (all foreign keys valid)
- ✅ 0 data loss during migration

### Performance Metrics
- ✅ Task list loads in < 500ms (1,000 tasks)
- ✅ Timer start completes in < 200ms
- ✅ Timer stop completes in < 500ms (including customer_sales creation)
- ✅ Time entry queries complete in < 1s (100,000 records)
- ✅ API endpoints respond within SLA (p95 < 1s)

### Reliability Metrics
- ✅ 0 duplicate active timers per staff (uniqueness enforced)
- ✅ 0 duplicate customer_sales records (1:1 relationship enforced)
- ✅ 0 negative durations (constraint enforced)
- ✅ 0 race conditions in concurrent timer operations
- ✅ 100% idempotency on timer start

### Security Metrics
- ✅ 100% RLS policy coverage (all tables protected)
- ✅ 0 cross-organization data leaks
- ✅ 100% HMAC authentication on API endpoints
- ✅ 0 unauthorized timer starts/stops

### Migration Metrics
- ✅ dualWriteService.js deprecated and removed
- ✅ financialSyncService.js deprecated for tasks/timers
- ✅ 0 FileMaker bridge calls for task/timer operations
- ✅ 100% of frontend code refactored to use Supabase backend

---

## Rollback Plan

### Rollback Triggers
- Data integrity violations (orphaned records, foreign key errors)
- Performance degradation (queries > 5s, API errors > 10%)
- Security issues (RLS bypass, unauthorized access)
- Critical bugs (timer duplicates, negative durations, missing customer_sales)

### Rollback Steps
1. **Immediate**: Disable new timer starts (feature flag)
2. **Revert Frontend**: Deploy previous version (uses FileMaker)
3. **Preserve Data**: Export Supabase time_entries created during rollout
4. **Dual-Write**: Re-enable dualWriteService.js for completed timers
5. **Backfill**: Import new time_entries to FileMaker
6. **Validate**: Ensure FileMaker is source of truth again
7. **Investigate**: Analyze root cause, fix issues
8. **Retry**: Plan new migration attempt with fixes

### Data Preservation
- All Supabase time_entries during rollout period exported to JSON
- All customer_sales records backed up
- FileMaker data remains intact (read-only during migration)
- ID mappings preserved for future migration attempts

---

## Test Execution Checklist

### Pre-Migration
- [ ] Backend schema deployed to staging
- [ ] RLS policies tested on staging
- [ ] API endpoints tested with Postman/automated tests
- [ ] Load testing completed (1,000 concurrent timers)
- [ ] Security testing completed (penetration test, RLS bypass attempts)
- [ ] Frontend integration tested on staging
- [ ] Migration scripts tested on sample data (100 tasks, 500 time entries)
- [ ] Rollback procedure validated on staging

### During Migration
- [ ] Monitor error rates (target: < 0.1%)
- [ ] Monitor API latency (target: p95 < 1s)
- [ ] Monitor database CPU/memory (target: < 70%)
- [ ] Monitor active timer count (validate no duplicates)
- [ ] Monitor customer_sales creation (1:1 with completed time_entries)
- [ ] Monitor frontend error logs
- [ ] Validate ID mapping completeness

### Post-Migration
- [ ] Run all validation queries (AC2, AC6, AC7)
- [ ] Verify task count matches FileMaker
- [ ] Verify time entry count matches FileMaker
- [ ] Verify all relationships intact
- [ ] User acceptance testing (5 staff members, 1 week)
- [ ] Performance benchmarking (compare to FileMaker baseline)
- [ ] Remove FileMaker bridge code for tasks/timers
- [ ] Deprecate dualWriteService.js
- [ ] Update documentation
- [ ] Celebrate! 🎉

---

## Code References

**Frontend:**
- `src/api/tasks.js`: Task CRUD, timer start/stop (317 lines) - **TO BE REFACTORED**
- `src/components/tasks/TaskTimer.jsx`: Timer UI component (353 lines) - **TO BE UPDATED**
- `src/components/tasks/TaskList.jsx`: Task management UI - **TO BE UPDATED**
- `src/services/dualWriteService.js`: Dual-write wrapper (359 lines) - **TO BE DEPRECATED**
- `src/services/financialSyncService.js`: FileMaker ↔ Supabase reconciliation - **TO BE DEPRECATED**

**Backend (to be implemented):**
- `backend/api/tasks.py`: Task CRUD endpoints
- `backend/api/time_entries.py`: Timer operation endpoints
- `backend/rpc/stop_timer_and_create_sale.sql`: Atomic RPC function
- `backend/migrations/001_tasks_schema.sql`: Schema DDL
- `backend/migrations/002_tasks_data.sql`: Data migration script

**Database:**
- `public.tasks`: Task storage
- `public.time_entries`: Timer/time entry storage
- `public.customer_sales`: Financial records (updated with time_entry_id)
- `public.filemaker_id_mappings`: ID reconciliation table

---

## Status

**Phase 1: Requirements Documentation** ✅ COMPLETE

**Next Phase:** Backend Implementation (Schema + API endpoints + RPC functions)
