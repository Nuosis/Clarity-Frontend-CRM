# Backend Change Request: Tasks & Timer Migration - Master Document

**Request ID:** BACKEND_CHANGE_REQUEST_MASTER_TASKS_TIMER_MIGRATION
**Date:** 2026-01-10
**Requester:** Frontend Team (via Claude)
**Priority:** HIGH
**Target Release:** Q1 2026
**Status:** Awaiting Backend Team Approval

---

## Executive Summary

This master change request document consolidates all backend infrastructure requirements for migrating the complete tasks and timer system from FileMaker to Supabase. This is the definitive reference document for backend team implementation and should be reviewed before any schema changes or API development begins.

### What This Migration Includes

- **Database Schema:** Two new tables (`tasks`, `time_entries`) with complete indexes, constraints, and triggers
- **REST API:** 18 endpoints for task CRUD, timer operations, and financial record integration
- **Business Logic:** Fixed-price detection, financial record generation, timer state machine enforcement
- **Data Migration:** ~10,000 historical tasks and ~50,000 timer records from FileMaker
- **Concurrency Control:** Idempotency keys, row-level locking, state machine validation
- **Financial Integration:** Atomic timer stop + customer_sales record creation

### Impact Analysis

| Component | Impact | Details |
|-----------|--------|---------|
| **Database** | NEW TABLES | `tasks`, `time_entries`, `api_idempotency_keys` |
| **API Endpoints** | 18 NEW | Complete task/timer CRUD with HMAC auth |
| **Performance** | IMPROVED | Proper PostgreSQL indexing vs FileMaker |
| **Data Volume** | ~60K RECORDS | 10K tasks + 50K timer entries to migrate |
| **Dependencies** | CRITICAL | Requires `projects`, `customers`, `customer_sales` tables |
| **Development Effort** | 6-8 WEEKS | Schema + API + Testing + Migration |
| **Risk Level** | MEDIUM-HIGH | Complex business logic, financial record atomicity |

### Key Dependencies

✅ **REQUIRED** (Must exist before implementation):
- `projects` table with `id`, `customer_id`, `fixed_price` fields (VERIFIED)
- `customers` table with `id`, `name` fields (VERIFIED)
- `customer_sales` table with `financial_id`, `customer_id`, `product_name`, `quantity`, `unit_price` (VERIFIED)
- `organizations` table with `id` field (VERIFIED)
- Staff/team members table (⚠️ **NEEDS VERIFICATION** - schema unknown)

❌ **NOT YET IMPLEMENTED** (This request creates):
- `tasks` table
- `time_entries` table
- `api_idempotency_keys` table
- Timer operation endpoints
- Financial record generation business logic

---

## Table of Contents

1. [Database Schema](#1-database-schema)
2. [API Endpoints](#2-api-endpoints)
3. [Business Logic Requirements](#3-business-logic-requirements)
4. [Concurrency & Idempotency](#4-concurrency--idempotency)
5. [Data Migration Plan](#5-data-migration-plan)
6. [Testing Requirements](#6-testing-requirements)
7. [Rollback & Contingency](#7-rollback--contingency)
8. [Approval & Next Steps](#8-approval--next-steps)

---

## 1. Database Schema

### 1.1 Tasks Table

**Purpose:** Stores task records (work items assigned to projects)

**Source:** FileMaker `devTasks` layout
**Target:** Supabase `tasks` table
**Estimated Volume:** ~10,000 records

```sql
CREATE TABLE IF NOT EXISTS tasks (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core fields
  task_id UUID NOT NULL UNIQUE, -- Frontend-generated UUID (maps to FileMaker __ID)
  task TEXT NOT NULL CHECK (char_length(task) > 0 AND char_length(task) <= 200),
  type TEXT,

  -- Relationships
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  staff_id UUID NOT NULL, -- FK to staff/team table (schema TBD)
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Status
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  priority TEXT DEFAULT 'active' CHECK (priority IN ('active', 'high', 'low')),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Calculated field for actual hours (from time_entries)
  actual_hours NUMERIC(10,2) DEFAULT 0.00
);

-- Indexes for performance
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_staff_id ON tasks(staff_id);
CREATE INDEX idx_tasks_organization_id ON tasks(organization_id);
CREATE INDEX idx_tasks_task_id ON tasks(task_id);
CREATE INDEX idx_tasks_is_completed ON tasks(is_completed);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);

-- Composite index for common queries
CREATE INDEX idx_tasks_project_status
  ON tasks(project_id, is_completed, created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.is_completed = TRUE AND OLD.is_completed = FALSE THEN
    NEW.completed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at_trigger
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tasks_updated_at();

-- Actual hours rollup trigger
CREATE OR REPLACE FUNCTION update_task_actual_hours()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tasks
  SET actual_hours = (
    SELECT COALESCE(SUM(billable_hours), 0)
    FROM time_entries
    WHERE task_id = NEW.task_id
  )
  WHERE task_id = NEW.task_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER time_entry_rollup_trigger
  AFTER INSERT OR UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_task_actual_hours();
```

**Field Mappings from FileMaker:**

| FileMaker Field | Supabase Field | Type Conversion | Notes |
|-----------------|----------------|-----------------|-------|
| `__ID` | `task_id` | String → UUID | Direct 1:1 mapping |
| `task` | `task` | String → TEXT | Max 200 chars |
| `type` | `type` | String → TEXT | Optional |
| `_projectID` | `project_id` | String → UUID | FK to projects |
| `_staffID` | `staff_id` | String → UUID | FK to staff |
| `f_completed` | `is_completed` | 0/1 → BOOLEAN | 0=false, 1=true |
| `f_priority` | `priority` | String → TEXT | Default: 'active' |
| `~creationTimestamp` | `created_at` | Timestamp → TIMESTAMPTZ | ISO 8601 |
| `~modificationTimestamp` | `updated_at` | Timestamp → TIMESTAMPTZ | ISO 8601 |

**Code References:**
- Current CRUD operations: `src/services/taskService.js:414-491`
- Validation rules: `src/services/taskService.js:265-376`
- FileMaker API calls: `src/api/tasks.js:53-114`

---

### 1.2 Time Entries Table

**Purpose:** Stores timer records (time tracking for billable hours)

**Source:** FileMaker `devRecords` layout
**Target:** Supabase `time_entries` table
**Estimated Volume:** ~50,000 records

```sql
CREATE TABLE IF NOT EXISTS time_entries (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  staff_id UUID NOT NULL, -- FK to staff table (schema TBD)
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Timer data
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,

  -- State tracking
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  pause_start_time TIMESTAMPTZ,
  total_pause_duration_seconds INTEGER DEFAULT 0,

  -- Work description
  work_performed TEXT,

  -- Time calculations
  billable_hours NUMERIC(10,2),
  adjustment_seconds INTEGER DEFAULT 0 CHECK (adjustment_seconds % 360 = 0),

  -- Financial integration
  financial_record_id UUID REFERENCES customer_sales(id),
  is_billable BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT time_entries_time_check CHECK (end_time IS NULL OR end_time > start_time),

  -- State consistency
  CONSTRAINT time_entries_state_consistency CHECK (
    (status = 'completed' AND end_time IS NOT NULL) OR
    (status IN ('active', 'paused') AND end_time IS NULL)
  ),

  CONSTRAINT time_entries_pause_consistency CHECK (
    (status = 'paused' AND pause_start_time IS NOT NULL) OR
    (status != 'paused' AND pause_start_time IS NULL)
  )
);

-- Indexes
CREATE INDEX idx_time_entries_task_id ON time_entries(task_id);
CREATE INDEX idx_time_entries_project_id ON time_entries(project_id);
CREATE INDEX idx_time_entries_customer_id ON time_entries(customer_id);
CREATE INDEX idx_time_entries_staff_id ON time_entries(staff_id);
CREATE INDEX idx_time_entries_organization_id ON time_entries(organization_id);
CREATE INDEX idx_time_entries_start_time ON time_entries(start_time DESC);
CREATE INDEX idx_time_entries_financial_record_id ON time_entries(financial_record_id);

-- Active timer queries (critical performance index)
CREATE UNIQUE INDEX idx_one_active_timer_per_staff
  ON time_entries(staff_id)
  WHERE status IN ('active', 'paused');

-- Billable hours calculation trigger
CREATE OR REPLACE FUNCTION update_time_entry_billable_hours()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();

  -- Calculate billable hours when timer stops
  IF NEW.end_time IS NOT NULL AND OLD.end_time IS NULL THEN
    NEW.billable_hours = ROUND(
      (
        EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time))
        - COALESCE(NEW.total_pause_duration_seconds, 0)
        + COALESCE(NEW.adjustment_seconds, 0)
      ) / 3600.0,
      2
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER time_entries_updated_at_trigger
  BEFORE UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_time_entry_billable_hours();
```

**Field Mappings from FileMaker:**

| FileMaker Field | Supabase Field | Type Conversion | Notes |
|-----------------|----------------|-----------------|-------|
| `__ID` | `id` | String → UUID | Primary key |
| `_taskID` | `task_id` | String → UUID | FK to tasks |
| `_projectID` | `project_id` | String → UUID | FK to projects |
| `_custID` | `customer_id` | String → UUID | FK to customers |
| `_staffID` | `staff_id` | String → UUID | FK to staff |
| `DateStart` + `TimeStart` | `start_time` | Date+Time → TIMESTAMPTZ | Combine fields |
| `DateStart` + `TimeEnd` | `end_time` | Date+Time → TIMESTAMPTZ | Combine fields, NULL if running |
| `Work Performed` | `work_performed` | String → TEXT | Work description |
| `TimeAdjust` | `adjustment_seconds` | Number → INTEGER | Already in seconds |
| `Billable_Time_Rounded` | `billable_hours` | Number → NUMERIC | 2 decimal precision |
| N/A | `status` | N/A → TEXT | NEW: 'active', 'paused', 'completed' |
| N/A | `pause_start_time` | N/A → TIMESTAMPTZ | NEW: Pause tracking |
| N/A | `total_pause_duration_seconds` | N/A → INTEGER | NEW: Cumulative pause time |

**Code References:**
- Timer start/stop logic: `src/services/taskService.js:55-131`
- Timer state management: `src/hooks/useTask.js:204-317`
- FileMaker record creation: `src/api/tasks.js:121-213`
- Financial record generation: `src/services/taskService.js:82-128`

---

### 1.3 API Idempotency Keys Table

**Purpose:** Prevents duplicate operations from network retries and concurrent requests

**New Requirement:** Not in FileMaker, required for production-grade API

```sql
CREATE TABLE IF NOT EXISTS api_idempotency_keys (
  idempotency_key UUID PRIMARY KEY,

  -- Request metadata
  endpoint TEXT NOT NULL,
  request_method TEXT NOT NULL,
  request_body JSONB,

  -- Response cache
  response_status INTEGER NOT NULL,
  response_body JSONB NOT NULL,

  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Index for cleanup queries
CREATE INDEX idx_idempotency_expires_at ON api_idempotency_keys(expires_at);

-- Automatic cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS void AS $$
BEGIN
  DELETE FROM api_idempotency_keys
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule daily cleanup (requires pg_cron extension)
-- Backend team: Implement cleanup job via your preferred method
```

**Idempotency Behavior:**
- First request: Execute operation, cache response for 24 hours
- Duplicate request: Return cached response with `X-Idempotency-Replay: true` header
- Expired key: Execute operation normally (key expired)

**Code Reference:** No current implementation. Frontend will need to generate UUID idempotency keys in `src/api/tasks.js`.

---

## 2. API Endpoints

### 2.1 Task CRUD Endpoints (8 endpoints)

All endpoints require HMAC-SHA256 authentication (see section 2.8).

#### 2.1.1 Create Task

```
POST /api/tasks
```

**Request Body:**
```json
{
  "task_id": "uuid",           // Required: Frontend-generated UUID
  "task": "string",            // Required: 1-200 chars
  "project_id": "uuid",        // Required: FK to projects
  "staff_id": "uuid",          // Required: FK to staff
  "organization_id": "uuid",   // Required: FK to organizations
  "type": "string",            // Optional
  "priority": "active"         // Optional: 'active', 'high', 'low'
}
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "task_id": "uuid",
  "task": "string",
  "project_id": "uuid",
  "staff_id": "uuid",
  "organization_id": "uuid",
  "type": "string",
  "priority": "active",
  "is_completed": false,
  "actual_hours": 0.00,
  "created_at": "2026-01-10T14:30:00Z",
  "updated_at": "2026-01-10T14:30:00Z",
  "completed_at": null
}
```

**Validation Rules:**
- `task_id`: Must be unique UUID (frontend-generated)
- `task`: Required, 1-200 characters, non-empty after trim
- `project_id`: Must exist in `projects` table and belong to `organization_id`
- `staff_id`: Must exist in staff table and belong to `organization_id`
- `priority`: Must be 'active', 'high', or 'low' (default: 'active')

**Error Codes:**
- `400 VALIDATION_ERROR`: Invalid request data
- `404 PROJECT_NOT_FOUND`: project_id doesn't exist
- `404 STAFF_NOT_FOUND`: staff_id doesn't exist
- `409 DUPLICATE_TASK_ID`: task_id already exists

**Code Reference:** Frontend implementation in `src/services/taskService.js:414-467`

---

#### 2.1.2 Get Tasks by Project

```
GET /api/tasks?project_id={uuid}&is_completed={bool}&staff_id={uuid}&limit={int}&offset={int}
```

**Query Parameters:**
- `project_id` (required): UUID
- `is_completed` (optional): boolean filter
- `staff_id` (optional): UUID filter
- `priority` (optional): 'active', 'high', 'low'
- `limit` (optional): Max results (default: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response (200 OK):**
```json
{
  "tasks": [
    {
      "id": "uuid",
      "task_id": "uuid",
      "task": "string",
      "project_id": "uuid",
      "staff_id": "uuid",
      "organization_id": "uuid",
      "type": "string",
      "priority": "active",
      "is_completed": false,
      "actual_hours": 2.50,
      "created_at": "2026-01-10T14:30:00Z",
      "updated_at": "2026-01-10T14:30:00Z",
      "completed_at": null
    }
  ],
  "total": 25,
  "limit": 100,
  "offset": 0
}
```

**Sorting:**
- Active tasks (is_completed=false) BEFORE completed tasks
- Within each group: Newest first (created_at DESC)

**SQL Implementation:**
```sql
SELECT * FROM tasks
WHERE project_id = :project_id
  AND (:is_completed IS NULL OR is_completed = :is_completed)
  AND (:staff_id IS NULL OR staff_id = :staff_id)
ORDER BY is_completed ASC, created_at DESC
LIMIT :limit OFFSET :offset;
```

**Code Reference:** Frontend sorting logic in `src/services/taskService.js:645-658`

---

#### 2.1.3 Get Task by ID

```
GET /api/tasks/{task_id}
```

**Path Parameters:**
- `task_id`: UUID (frontend-generated task_id, not database id)

**Response (200 OK):** Same as Create Task response

**Error Codes:**
- `404 TASK_NOT_FOUND`: Task doesn't exist

---

#### 2.1.4 Update Task

```
PATCH /api/tasks/{task_id}
```

**Request Body (partial update):**
```json
{
  "task": "Updated task name",    // Optional
  "type": "Bug Fix",              // Optional
  "priority": "high"              // Optional
}
```

**Allowed Fields:**
- `task`, `type`, `priority`

**Forbidden Fields (immutable):**
- `task_id`, `project_id`, `organization_id`, `is_completed` (use status endpoint)

**Response (200 OK):** Updated task object

**Error Codes:**
- `400 FORBIDDEN_FIELD`: Attempted to update immutable field
- `404 TASK_NOT_FOUND`: Task doesn't exist

**Code Reference:** Frontend update logic in `src/services/taskService.js:479-491`

---

#### 2.1.5 Update Task Completion Status

```
PATCH /api/tasks/{task_id}/status
```

**Request Body:**
```json
{
  "is_completed": true
}
```

**Business Logic:**
- When `is_completed` changes from `false` to `true`: Set `completed_at = NOW()`
- When `is_completed` changes from `true` to `false`: Set `completed_at = NULL`

**Response (200 OK):**
```json
{
  "id": "uuid",
  "task_id": "uuid",
  "is_completed": true,
  "completed_at": "2026-01-10T15:30:00Z",
  "updated_at": "2026-01-10T15:30:00Z"
}
```

**Code Reference:** Frontend completion toggle in `src/api/tasks.js:99-114`

---

#### 2.1.6 Delete Task

```
DELETE /api/tasks/{task_id}
```

**Business Rules:**
- Check if task has associated time_entries
- If time_entries exist with `financial_record_id`, prevent deletion (return 409 CONFLICT)
- Otherwise, allow deletion (consider soft delete vs hard delete)

**Response (204 No Content)**

**Error Codes:**
- `404 TASK_NOT_FOUND`: Task doesn't exist
- `409 CONFLICT`: Task has financial records, cannot delete

**Note:** Current frontend does NOT implement task deletion. Tasks are only marked as completed. This endpoint is for data cleanup/admin use.

---

#### 2.1.7 Get Task Notes

```
GET /api/tasks/{task_id}/notes
```

**Response (200 OK):**
```json
{
  "notes": [
    {
      "id": "uuid",
      "task_id": "uuid",
      "content": "Note content",
      "type": "general",
      "created_by": "username",
      "created_at": "2026-01-10T14:30:00Z",
      "updated_at": "2026-01-10T14:30:00Z"
    }
  ],
  "total": 3
}
```

**Sorting:** Newest first (created_at DESC)

**Note:** Notes table schema not defined in this request. Assume exists or will be created separately.

**Code Reference:** Frontend notes fetching in `src/api/tasks.js:286-298`

---

#### 2.1.8 Get Task Links

```
GET /api/tasks/{task_id}/links
```

**Response (200 OK):**
```json
{
  "links": [
    {
      "id": "uuid",
      "task_id": "uuid",
      "url": "https://example.com",
      "created_at": "2026-01-10T14:30:00Z"
    }
  ],
  "total": 2
}
```

**Note:** Links table schema not defined in this request. Assume exists or will be created separately.

**Code Reference:** Frontend links fetching in `src/api/tasks.js:305-317`

---

### 2.2 Timer Operation Endpoints (6 endpoints)

All timer operations support optional `X-Idempotency-Key` header for safe retries.

#### 2.2.1 Start Timer (CRITICAL - Idempotent)

```
POST /api/tasks/{task_id}/timer/start
```

**Request Headers:**
```
Authorization: Bearer {hmac}.{timestamp}
X-Idempotency-Key: {uuid}  // OPTIONAL but RECOMMENDED
Content-Type: application/json
```

**Request Body:**
```json
{
  "staff_id": "uuid",
  "organization_id": "uuid"
}
```

**Success Response (201 Created):**
```json
{
  "id": "uuid",
  "task_id": "uuid",
  "project_id": "uuid",
  "customer_id": "uuid",
  "staff_id": "uuid",
  "organization_id": "uuid",
  "start_time": "2026-01-10T14:30:00Z",
  "end_time": null,
  "status": "active",
  "pause_start_time": null,
  "total_pause_duration_seconds": 0,
  "billable_hours": null,
  "adjustment_seconds": 0,
  "is_billable": true,
  "created_at": "2026-01-10T14:30:00Z",
  "updated_at": "2026-01-10T14:30:00Z"
}
```

**Idempotent Response (201 Created):**
- Same response body
- Additional header: `X-Idempotency-Replay: true`

**Business Logic:**
1. Check idempotency key cache, return cached response if exists
2. Begin SERIALIZABLE transaction
3. Fetch task to get `project_id`
4. Fetch project to get `customer_id`
5. Check for active timer with `SELECT ... FOR UPDATE NOWAIT` on staff_id
6. If active timer exists, return `409 CONFLICT` with existing timer details
7. Create time_entry record with `status = 'active'`, `start_time = NOW()`
8. Store idempotency response (if key provided)
9. Commit transaction
10. Return timer record

**Concurrency Safety:**
- Unique index `idx_one_active_timer_per_staff` prevents duplicate active timers
- Row-level locking prevents race conditions
- SERIALIZABLE isolation prevents phantom reads

**Error Codes:**
- `409 ACTIVE_TIMER_EXISTS`: Staff already has active/paused timer
  ```json
  {
    "error": "ACTIVE_TIMER_EXISTS",
    "code": "ACTIVE_TIMER_EXISTS",
    "message": "Staff member already has an active timer",
    "details": {
      "active_timer_id": "uuid",
      "task_id": "uuid"
    }
  }
  ```
- `423 RESOURCE_LOCKED`: Concurrent operation in progress, retry with exponential backoff
  ```json
  {
    "error": "RESOURCE_LOCKED",
    "code": "RESOURCE_LOCKED",
    "message": "Timer operation in progress, please retry",
    "retry_after_seconds": 2
  }
  ```
- `404 TASK_NOT_FOUND`: Task doesn't exist
- `400 VALIDATION_ERROR`: Invalid request parameters

**Code Reference:** Frontend timer start in `src/api/tasks.js:121-178`, business logic in `src/services/taskService.js:55-60`

---

#### 2.2.2 Stop Timer (CRITICAL - Idempotent, Atomic)

```
POST /api/tasks/{task_id}/timer/stop
```

**Request Headers:**
```
Authorization: Bearer {hmac}.{timestamp}
X-Idempotency-Key: {uuid}  // STRONGLY RECOMMENDED
Content-Type: application/json
```

**Request Body:**
```json
{
  "timer_id": "uuid",
  "work_performed": "Implemented authentication logic",
  "adjustment_seconds": 360,    // Must be multiple of 360 (6 minutes)
  "save_immediately": false
}
```

**Required Fields:**
- `timer_id`: UUID of timer to stop

**Optional Fields:**
- `work_performed`: Work description (default: "Time logged" if save_immediately=true)
- `adjustment_seconds`: Manual time adjustment in 6-minute increments (default: 0)
- `save_immediately`: If true, use default description (default: false)

**Success Response (200 OK):**
```json
{
  "timer": {
    "id": "uuid",
    "task_id": "uuid",
    "project_id": "uuid",
    "customer_id": "uuid",
    "staff_id": "uuid",
    "organization_id": "uuid",
    "start_time": "2026-01-10T14:30:00Z",
    "end_time": "2026-01-10T16:45:00Z",
    "status": "completed",
    "pause_start_time": null,
    "total_pause_duration_seconds": 300,
    "work_performed": "Implemented authentication logic",
    "billable_hours": 2.25,
    "adjustment_seconds": 360,
    "is_billable": true,
    "financial_record_id": "uuid",
    "created_at": "2026-01-10T14:30:00Z",
    "updated_at": "2026-01-10T16:45:00Z"
  },
  "financial_record": {
    "id": "uuid",
    "created": true,
    "product_name": "CLARITYBUSINESS:Website",
    "quantity": 2.25,
    "unit_price": 150.00,
    "total_price": 337.50
  }
}
```

**Business Logic (ATOMIC TRANSACTION):**
1. Validate idempotency key, return cached response if exists
2. Validate `adjustment_seconds % 360 === 0`
3. Begin SERIALIZABLE transaction
4. Lock timer record with `SELECT ... FOR UPDATE NOWAIT`
5. Validate `status IN ('active', 'paused')` (cannot stop completed timer)
6. If currently paused, calculate final pause duration:
   ```sql
   total_pause_duration_seconds = total_pause_duration_seconds +
     EXTRACT(EPOCH FROM (NOW() - pause_start_time))
   ```
7. Calculate billable hours:
   ```sql
   billable_hours = ROUND(
     (EXTRACT(EPOCH FROM (end_time - start_time)) - total_pause_duration_seconds + adjustment_seconds) / 3600.0,
     2
   )
   ```
8. Update timer:
   ```sql
   UPDATE time_entries SET
     status = 'completed',
     end_time = NOW(),
     work_performed = :work_performed,
     adjustment_seconds = :adjustment_seconds,
     total_pause_duration_seconds = :total_pause_duration,
     pause_start_time = NULL,
     billable_hours = :billable_hours
   WHERE id = :timer_id
   ```
9. Fetch project to check `fixed_price` field
10. **FIXED-PRICE DETECTION LOGIC (CRITICAL):**
    ```sql
    SELECT fixed_price FROM projects WHERE id = :project_id;
    ```
    - **IF `fixed_price > 0` OR `fixed_price IS NOT NULL`:** SKIP financial record creation
    - **ELSE:** Create financial record in `customer_sales` table
11. **IF NOT FIXED-PRICE:** Create financial record atomically:
    ```sql
    INSERT INTO customer_sales (
      financial_id, organization_id, customer_id,
      product_name, quantity, unit_price, total_price, date, time_entry_id
    ) VALUES (
      gen_random_uuid(),
      :organization_id,
      :customer_id,
      format_product_name(:customer_name, :project_name), -- See section 3.3
      :billable_hours,
      :hourly_rate, -- Fetch from staff record
      :billable_hours * :hourly_rate,
      :start_time::date,
      :timer_id
    )
    RETURNING *;
    ```
12. Link financial_record_id to timer if created
13. Store idempotency response
14. **COMMIT TRANSACTION** (timer + financial record created atomically)
15. Return timer + financial record details

**Atomicity Guarantee:**
- If financial record creation fails, entire transaction rolls back
- Timer remains in 'active' or 'paused' state
- User can retry stop operation
- Idempotency key prevents duplicate financial records on retry

**Product Name Format:** `CUSTOMERCAPS:ProjectFirstWord`
- Example: Customer "Clarity Business Solutions", Project "Website Redesign" → `CLARITYBUSINESS:Website`
- See section 3.3 for detailed formatting rules

**Hourly Rate Resolution:**
1. Try project-specific rate (if projects.hourly_rate exists)
2. Fallback to staff.hourly_rate
3. Fallback to organization.default_hourly_rate
4. If all NULL, return error `400 HOURLY_RATE_MISSING`

**Error Codes:**
- `409 TIMER_ALREADY_STOPPED`: Timer status is 'completed'
  ```json
  {
    "error": "TIMER_ALREADY_STOPPED",
    "code": "TIMER_ALREADY_STOPPED",
    "message": "Timer has already been stopped",
    "details": {
      "timer_id": "uuid",
      "end_time": "2026-01-10T16:45:00Z"
    }
  }
  ```
- `400 INVALID_ADJUSTMENT`: Adjustment not multiple of 360
  ```json
  {
    "error": "INVALID_ADJUSTMENT",
    "code": "INVALID_ADJUSTMENT",
    "message": "Adjustment must be in 6-minute (360 second) increments",
    "details": {
      "adjustment_seconds": 123,
      "valid_increments": [0, 360, 720, 1080, -360, -720]
    }
  }
  ```
- `423 RESOURCE_LOCKED`: Concurrent operation in progress
- `404 TIMER_NOT_FOUND`: Timer doesn't exist
- `500 FINANCIAL_RECORD_FAILED`: Financial record creation failed (transaction rolled back)

**Code Reference:**
- Current stop logic: `src/services/taskService.js:67-131`
- Fixed-price detection: `src/services/taskService.js:104-111`
- Financial record creation: `src/services/taskService.js:82-128`

---

#### 2.2.3 Pause Timer (NEW - Idempotent)

```
POST /api/tasks/{task_id}/timer/pause
```

**Request Body:**
```json
{
  "timer_id": "uuid"
}
```

**Success Response (200 OK):**
```json
{
  "id": "uuid",
  "task_id": "uuid",
  "status": "paused",
  "pause_start_time": "2026-01-10T15:00:00Z",
  "total_pause_duration_seconds": 0,
  "updated_at": "2026-01-10T15:00:00Z"
}
```

**Business Logic:**
1. Begin SERIALIZABLE transaction
2. Lock timer with `SELECT ... FOR UPDATE NOWAIT`
3. Validate `status = 'active'` (can only pause active timer)
4. Update timer:
   ```sql
   UPDATE time_entries SET
     status = 'paused',
     pause_start_time = NOW()
   WHERE id = :timer_id
   ```
5. Commit transaction
6. Return updated timer

**Idempotency:** If timer already paused and same idempotency key sent, return 200 OK with current state (not error).

**Error Codes:**
- `400 INVALID_STATE`: Timer is not in 'active' state
  ```json
  {
    "error": "INVALID_STATE",
    "code": "INVALID_STATE",
    "message": "Can only pause an active timer",
    "details": {
      "current_status": "completed",
      "allowed_statuses": ["active"]
    }
  }
  ```
- `409 TIMER_ALREADY_PAUSED`: Timer already paused (without idempotency key)

**Code Reference:** Currently client-side only in `src/hooks/useTask.js:279-301`. This is NEW server-side functionality.

---

#### 2.2.4 Resume Timer (NEW - Idempotent)

```
POST /api/tasks/{task_id}/timer/resume
```

**Request Body:**
```json
{
  "timer_id": "uuid"
}
```

**Success Response (200 OK):**
```json
{
  "id": "uuid",
  "task_id": "uuid",
  "status": "active",
  "pause_start_time": null,
  "total_pause_duration_seconds": 450,
  "updated_at": "2026-01-10T15:10:00Z"
}
```

**Business Logic:**
1. Begin SERIALIZABLE transaction
2. Lock timer with `SELECT ... FOR UPDATE NOWAIT`
3. Validate `status = 'paused'` (can only resume paused timer)
4. Calculate pause duration:
   ```sql
   pause_duration = EXTRACT(EPOCH FROM (NOW() - pause_start_time))
   ```
5. Update timer:
   ```sql
   UPDATE time_entries SET
     status = 'active',
     pause_start_time = NULL,
     total_pause_duration_seconds = total_pause_duration_seconds + pause_duration
   WHERE id = :timer_id
   ```
6. Commit transaction
7. Return updated timer

**Idempotency:** If timer already active (resumed) and same idempotency key sent, return 200 OK with current state.

**Error Codes:**
- `400 INVALID_STATE`: Timer is not in 'paused' state
  ```json
  {
    "error": "INVALID_STATE",
    "code": "INVALID_STATE",
    "message": "Can only resume a paused timer",
    "details": {
      "current_status": "active",
      "allowed_statuses": ["paused"]
    }
  }
  ```

**Code Reference:** Currently client-side only in `src/hooks/useTask.js:279-301`.

---

#### 2.2.5 Adjust Timer (NEW - Idempotent)

```
PATCH /api/tasks/{task_id}/timer/adjust
```

**Request Body:**
```json
{
  "timer_id": "uuid",
  "adjustment_delta_seconds": 360  // Positive or negative, must be multiple of 360
}
```

**Note:** `adjustment_delta_seconds` is the CHANGE to apply, not absolute value.
- Pass `360` to add 6 minutes
- Pass `-360` to subtract 6 minutes

**Success Response (200 OK):**
```json
{
  "id": "uuid",
  "adjustment_seconds": 720,  // Total adjustment after applying delta
  "updated_at": "2026-01-10T15:15:00Z"
}
```

**Business Logic:**
1. Validate `adjustment_delta_seconds % 360 === 0`
2. Lock timer with `SELECT ... FOR UPDATE NOWAIT`
3. Validate `status IN ('active', 'paused')` (cannot adjust completed timer)
4. Update:
   ```sql
   UPDATE time_entries SET
     adjustment_seconds = adjustment_seconds + :adjustment_delta_seconds
   WHERE id = :timer_id
   ```
5. Return updated timer

**Idempotency:** Use idempotency key to prevent double-adjustment from retry.

**Error Codes:**
- `400 INVALID_ADJUSTMENT`: Delta not multiple of 360
- `400 INVALID_STATE`: Cannot adjust completed timer

**Code Reference:** Current client-side adjustment in `src/hooks/useTask.js:303-317`, validation in `src/services/taskService.js:619-622`.

---

#### 2.2.6 Get Active Timer

```
GET /api/tasks/timers/active?staff_id={uuid}&organization_id={uuid}
```

**Query Parameters:**
- `staff_id` (required): UUID
- `organization_id` (optional): UUID filter

**Success Response (200 OK):**
```json
{
  "timer": {
    "id": "uuid",
    "task_id": "uuid",
    "status": "active",
    "start_time": "2026-01-10T14:30:00Z",
    "pause_start_time": null,
    "total_pause_duration_seconds": 0,
    "adjustment_seconds": 0
  }
}
```

**No Active Timer (404 Not Found):**
```json
{
  "timer": null,
  "message": "No active timer found for staff member"
}
```

**Purpose:** Used on app initialization to restore timer state from server. Handles case where client localStorage is stale or cleared.

**SQL Implementation:**
```sql
SELECT * FROM time_entries
WHERE staff_id = :staff_id
  AND status IN ('active', 'paused')
  AND (:organization_id IS NULL OR organization_id = :organization_id)
ORDER BY start_time DESC
LIMIT 1;
```

**Code Reference:** Frontend expects this for initialization. No current backend implementation.

---

#### 2.2.7 Get Timers by Task

```
GET /api/tasks/{task_id}/timers?active_only={bool}
```

**Query Parameters:**
- `active_only` (optional): If true, only return timers with `status IN ('active', 'paused')`

**Response (200 OK):**
```json
{
  "timers": [
    {
      "id": "uuid",
      "task_id": "uuid",
      "project_id": "uuid",
      "customer_id": "uuid",
      "staff_id": "uuid",
      "organization_id": "uuid",
      "start_time": "2026-01-10T14:30:00Z",
      "end_time": "2026-01-10T16:45:00Z",
      "status": "completed",
      "work_performed": "Work description",
      "billable_hours": 2.25,
      "adjustment_seconds": 360,
      "is_billable": true,
      "financial_record_id": "uuid",
      "created_at": "2026-01-10T14:30:00Z",
      "updated_at": "2026-01-10T16:45:00Z"
    }
  ],
  "total": 5
}
```

**Sorting:** Most recent first (start_time DESC)

**Code Reference:** Frontend implementation in `src/api/tasks.js:220-232`

---

### 2.3 Financial Integration Endpoint

#### Get Customer Sales by Timer

```
GET /api/customer_sales?time_entry_id={uuid}
```

**Query Parameters:**
- `time_entry_id` (required): UUID of time entry

**Response (200 OK):**
```json
{
  "sales": [
    {
      "id": "uuid",
      "financial_id": "uuid",
      "customer_id": "uuid",
      "product_name": "CLARITYBUSINESS:Website",
      "quantity": 2.25,
      "unit_price": 150.00,
      "total_price": 337.50,
      "date": "2026-01-10",
      "time_entry_id": "uuid",
      "inv_id": null,
      "created_at": "2026-01-10T16:45:00Z"
    }
  ],
  "total": 1
}
```

**Purpose:** Verify financial record creation, reconciliation queries, debugging

**Note:** Assumes customer_sales endpoint already exists. If not, this should be created.

---

### 2.4 Authentication (HMAC-SHA256)

All API endpoints require HMAC-SHA256 authentication following the existing backend pattern.

**Request Header:**
```
Authorization: Bearer {signature}.{timestamp}
```

**Signature Generation (Frontend):**
```javascript
const timestamp = Math.floor(Date.now() / 1000);
const message = `${timestamp}.${JSON.stringify(requestBody)}`;
const signature = CryptoJS.HmacSHA256(message, SECRET_KEY).toString();
const authHeader = `Bearer ${signature}.${timestamp}`;
```

**Backend Validation:**
1. Extract signature and timestamp from Authorization header
2. Verify timestamp is within 5 minutes of current server time (prevent replay attacks)
3. Reconstruct message using timestamp and request body: `{timestamp}.{json_body}`
4. Calculate expected signature: `HMAC-SHA256(message, SECRET_KEY)`
5. Compare signatures using constant-time comparison
6. Reject request if:
   - Signatures don't match → `401 AUTHENTICATION_ERROR`
   - Timestamp > 5 minutes stale → `401 AUTHENTICATION_ERROR`
   - Authorization header missing → `401 AUTHENTICATION_ERROR`

**Environment Variable:**
- `SECRET_KEY` - Shared secret for HMAC signing (must match frontend `VITE_SECRET_KEY`)

**Error Response (401 Unauthorized):**
```json
{
  "error": "AUTHENTICATION_ERROR",
  "code": "AUTHENTICATION_ERROR",
  "message": "HMAC authentication failed",
  "details": {
    "reason": "Invalid signature" // or "Timestamp expired"
  }
}
```

**Code Reference:** Frontend implementation in `src/services/dataService.js:61-105`

---

## 3. Business Logic Requirements

### 3.1 Fixed-Price Project Detection

**Critical Business Rule:** Tasks on fixed-price projects should NOT generate financial records when timers stop.

**Rationale:** Fixed-price projects have predetermined costs. Individual timer entries are for internal tracking only, not billing.

**Implementation:**

```sql
-- Check if project is fixed-price
SELECT
  id,
  fixed_price,
  customer_id,
  organization_id
FROM projects
WHERE id = :project_id;

-- Decision logic
IF fixed_price IS NOT NULL AND fixed_price > 0 THEN
  -- Project is fixed-price
  -- Skip customer_sales record creation
  -- Continue recording time_entry for internal tracking
  financial_record_created = false;
ELSE
  -- Project is hourly/T&M
  -- Create customer_sales record
  financial_record_created = true;
END IF;
```

**Database Schema Requirement:**
- `projects` table MUST have `fixed_price` column
- Type: NUMERIC or DECIMAL (can be NULL)
- If NULL or 0: Project is hourly (create financial records)
- If > 0: Project is fixed-price (skip financial records)

**Frontend Reference:**
```javascript
// Current detection logic in src/services/taskService.js:104-111
const fixedPrice = parseFloat(
  financialRecord.response.data[0].fieldData["customers_Projects::f_fixedPrice"] || 0
);
if (fixedPrice > 0) {
    console.log('Skipping sales record creation for fixed-price project');
    financialId = null; // Prevent sales record creation
}
```

**Backend Must:**
1. Check fixed_price BEFORE creating customer_sales record
2. Log decision (fixed-price vs hourly) for audit trail
3. Continue recording time_entry regardless of project type
4. Return `financial_record: { created: false, reason: "FIXED_PRICE_PROJECT" }` in stop timer response

---

### 3.2 Billable Hours Calculation

**Formula:**
```
billable_hours = ROUND(
  (elapsed_seconds - pause_seconds + adjustment_seconds) / 3600,
  2
)

Where:
  elapsed_seconds = EXTRACT(EPOCH FROM (end_time - start_time))
  pause_seconds = total_pause_duration_seconds
  adjustment_seconds = adjustment_seconds (manual adjustment)
```

**Example:**
- Start: 2026-01-10 14:00:00
- Pause: 2026-01-10 15:00:00 (1 hour elapsed)
- Resume: 2026-01-10 15:15:00 (15 minutes paused)
- Stop: 2026-01-10 17:00:00 (2 more hours elapsed)
- Adjustment: +360 seconds (+6 minutes)

```
elapsed_seconds = (17:00 - 14:00) = 10800 seconds (3 hours)
pause_seconds = 900 seconds (15 minutes)
adjustment_seconds = 360 seconds (6 minutes)

billable_hours = (10800 - 900 + 360) / 3600 = 10260 / 3600 = 2.85 hours
```

**Precision:** ALWAYS round to 2 decimal places (0.01 hour = 36 seconds)

**Trigger Implementation:**
```sql
CREATE OR REPLACE FUNCTION update_time_entry_billable_hours()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.end_time IS NOT NULL AND OLD.end_time IS NULL THEN
    NEW.billable_hours = ROUND(
      (
        EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time))
        - COALESCE(NEW.total_pause_duration_seconds, 0)
        + COALESCE(NEW.adjustment_seconds, 0)
      ) / 3600.0,
      2
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Code Reference:** Current calculation in `src/services/taskService.js:91-95`

---

### 3.3 Product Name Formatting

**Critical for QuickBooks Integration**

**Format:** `CUSTOMERCAPS:ProjectFirstWord`

**Rules:**
1. Customer Name: Convert to UPPERCASE, remove spaces
2. Project Name: Take first word only, capitalize first letter
3. Concatenate with colon separator

**Examples:**
- Customer: "Clarity Business Solutions", Project: "Website Redesign" → `CLARITYBUSINESS:Website`
- Customer: "ABC Corp", Project: "Mobile App Development Phase 2" → `ABCCORP:Mobile`
- Customer: "john's shop", Project: "inventory system" → `JOHN'SSHOP:Inventory`

**SQL Function:**
```sql
CREATE OR REPLACE FUNCTION format_product_name(customer_name TEXT, project_name TEXT)
RETURNS TEXT AS $$
DECLARE
  customer_upper TEXT;
  project_first_word TEXT;
BEGIN
  -- Remove spaces and convert to uppercase
  customer_upper := REPLACE(UPPER(customer_name), ' ', '');

  -- Extract first word and capitalize
  project_first_word := INITCAP(SPLIT_PART(project_name, ' ', 1));

  -- Concatenate
  RETURN customer_upper || ':' || project_first_word;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

**Usage in Financial Record Creation:**
```sql
INSERT INTO customer_sales (
  financial_id, organization_id, customer_id,
  product_name, quantity, unit_price, total_price, date
) VALUES (
  gen_random_uuid(),
  :organization_id,
  :customer_id,
  format_product_name(
    (SELECT name FROM customers WHERE id = :customer_id),
    (SELECT name FROM projects WHERE id = :project_id)
  ),
  :billable_hours,
  :hourly_rate,
  :billable_hours * :hourly_rate,
  :start_time::date
);
```

**Code Reference:** Product name formatting in financial records migration doc `requirements/financial-records/BACKEND_CHANGE_REQUEST_001_FINANCIAL_RECORDS_MIGRATION.md:567`

---

### 3.4 Hourly Rate Resolution

**Priority Order:**
1. Project-specific rate (if `projects.hourly_rate` exists and not NULL)
2. Staff member rate (if `staff.hourly_rate` exists and not NULL)
3. Organization default rate (if `organizations.default_hourly_rate` exists and not NULL)
4. ERROR: Return `400 HOURLY_RATE_MISSING` if all are NULL

**SQL Implementation:**
```sql
SELECT
  COALESCE(
    p.hourly_rate,
    s.hourly_rate,
    o.default_hourly_rate
  ) AS hourly_rate
FROM projects p
JOIN staff s ON s.id = :staff_id
JOIN organizations o ON o.id = :organization_id
WHERE p.id = :project_id;

-- If result is NULL, return error
IF hourly_rate IS NULL THEN
  RAISE EXCEPTION 'HOURLY_RATE_MISSING: No hourly rate configured for project, staff, or organization';
END IF;
```

**Error Response (400 Bad Request):**
```json
{
  "error": "HOURLY_RATE_MISSING",
  "code": "HOURLY_RATE_MISSING",
  "message": "Cannot calculate billable amount: No hourly rate configured",
  "details": {
    "project_id": "uuid",
    "staff_id": "uuid",
    "organization_id": "uuid",
    "checked": ["project.hourly_rate", "staff.hourly_rate", "organization.default_hourly_rate"]
  }
}
```

**Note:** Current frontend assumes hourly rate exists. This is a defensive backend requirement.

---

### 3.5 Timer State Machine Enforcement

**States:**
- `IDLE`: No timer record exists for staff (or all timers completed)
- `RUNNING`: Timer record exists with `status = 'active'`, `end_time = NULL`
- `PAUSED`: Timer record exists with `status = 'paused'`, `end_time = NULL`, `pause_start_time != NULL`
- `COMPLETED`: Timer record exists with `status = 'completed'`, `end_time != NULL`

**Valid State Transitions:**

```
IDLE → START → RUNNING
RUNNING → PAUSE → PAUSED
PAUSED → RESUME → RUNNING
RUNNING → STOP → COMPLETED
PAUSED → STOP → COMPLETED
RUNNING → ADJUST → RUNNING
PAUSED → ADJUST → PAUSED
```

**Invalid State Transitions (Return 400 INVALID_STATE):**

```
IDLE → PAUSE/RESUME/STOP/ADJUST
RUNNING → START/RESUME
PAUSED → START/PAUSE
COMPLETED → Any operation
```

**Database Constraints:**
```sql
-- State consistency
ALTER TABLE time_entries ADD CONSTRAINT time_entries_state_consistency CHECK (
  (status = 'completed' AND end_time IS NOT NULL) OR
  (status IN ('active', 'paused') AND end_time IS NULL)
);

-- Pause consistency
ALTER TABLE time_entries ADD CONSTRAINT time_entries_pause_consistency CHECK (
  (status = 'paused' AND pause_start_time IS NOT NULL) OR
  (status != 'paused' AND pause_start_time IS NULL)
);

-- One active timer per staff
CREATE UNIQUE INDEX idx_one_active_timer_per_staff
  ON time_entries(staff_id)
  WHERE status IN ('active', 'paused');
```

**Code Reference:** State machine documentation in `.devflow/tasks/tasks-migration-requirements/TIMER_LIFECYCLE_STATE_MACHINE.md`

---

### 3.6 Validation Rules Summary

**Task Validation:**
- `task`: Required, 1-200 characters, non-empty after trim
- `project_id`: Required, must exist, must belong to organization_id
- `staff_id`: Required, must exist, must belong to organization_id
- `priority`: Optional, must be 'active', 'high', or 'low' (default: 'active')
- `type`: Optional, max 100 characters

**Timer Validation:**
- `adjustment_seconds`: Must be multiple of 360 (6 minutes)
- `start_time`: Required, cannot be in future
- `end_time`: Must be > start_time
- `work_performed`: Required on stop (unless save_immediately=true)
- Only one active/paused timer per staff at a time

**Code Reference:** Validation logic in `src/services/taskService.js:265-376`

---

## 4. Concurrency & Idempotency

### 4.1 Idempotency Strategy

**All mutation operations SHOULD accept optional `X-Idempotency-Key` header:**
- POST /api/tasks
- POST /api/tasks/{task_id}/timer/start
- POST /api/tasks/{task_id}/timer/stop
- POST /api/tasks/{task_id}/timer/pause
- POST /api/tasks/{task_id}/timer/resume
- PATCH /api/tasks/{task_id}/timer/adjust
- PATCH /api/tasks/{task_id}
- PATCH /api/tasks/{task_id}/status

**Idempotency Key Format:**
- Client-generated UUID v4
- Valid for 24 hours after first use
- Stored in `api_idempotency_keys` table

**Behavior:**
1. **First Request:**
   - Execute operation normally
   - Store request + response in idempotency table
   - Return response with HTTP 201/200

2. **Duplicate Request (same key within 24h):**
   - Retrieve cached response
   - Return cached response with same status code
   - Add header: `X-Idempotency-Replay: true`
   - Do NOT execute operation again

3. **Expired Key (>24h):**
   - Treat as new request
   - Execute operation normally

**Implementation Pseudocode:**
```python
async def handle_request_with_idempotency(request, operation):
    idempotency_key = request.headers.get('X-Idempotency-Key')

    if idempotency_key:
        cached = await get_cached_response(idempotency_key)
        if cached and not cached.expired():
            return Response(
                status=cached.status,
                body=cached.body,
                headers={'X-Idempotency-Replay': 'true'}
            )

    # Execute operation
    response = await operation()

    if idempotency_key:
        await cache_response(
            key=idempotency_key,
            endpoint=request.path,
            method=request.method,
            status=response.status,
            body=response.body,
            expires_at=now() + timedelta(hours=24)
        )

    return response
```

**Why This Matters:**
- Network retries don't create duplicate timers
- Browser back/forward doesn't duplicate operations
- Offline queue replay is safe
- Concurrent requests from multiple tabs handled gracefully

**Code Reference:** No current implementation. Frontend will need to implement in `src/api/tasks.js`.

---

### 4.2 Concurrency Control

**Problem:** Race conditions when multiple clients attempt simultaneous operations:
- Double-click "Start Timer"
- Multiple browser tabs open
- Slow network causing overlapping requests
- Timer stop during concurrent pause operation

**Solution:** Row-Level Locking + Database Constraints

**Approach:**
1. Use `SELECT ... FOR UPDATE NOWAIT` to lock records
2. Use unique constraints to prevent duplicates
3. Use SERIALIZABLE transaction isolation
4. Return `423 RESOURCE_LOCKED` on lock timeout

**Example: Prevent Duplicate Active Timers**

```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Check for existing active timer (with lock)
SELECT id, status
FROM time_entries
WHERE staff_id = :staff_id
  AND status IN ('active', 'paused')
FOR UPDATE NOWAIT; -- Fail fast if locked

IF FOUND THEN
  ROLLBACK;
  RETURN {error: 'ACTIVE_TIMER_EXISTS', active_timer_id: existing_timer.id};
END IF;

-- Create new timer (unique index prevents race condition)
INSERT INTO time_entries (...) VALUES (...);

COMMIT;
```

**Lock Timeout Configuration:**
```sql
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '10s';
```

**Error Response (423 Locked):**
```json
{
  "error": "RESOURCE_LOCKED",
  "code": "RESOURCE_LOCKED",
  "message": "Timer operation in progress, please retry",
  "retry_after_seconds": 2
}
```

**Frontend Retry Logic:**
```javascript
async function startTimerWithRetry(taskId, staffId, maxRetries = 3) {
  const idempotencyKey = uuidv4(); // Generate once, reuse for retries

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('/api/tasks/${taskId}/timer/start', {
        headers: { 'X-Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ staff_id: staffId })
      });

      if (response.status === 423) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '2');
        await sleep(retryAfter * 1000);
        continue; // Retry
      }

      return await response.json();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await sleep(1000 * attempt); // Exponential backoff
    }
  }
}
```

**Code Reference:** Concurrency requirements in `.devflow/tasks/tasks-migration-requirements/BACKEND_CHANGE_REQUEST_002_TIMER_OPERATIONS.md`

---

### 4.3 Transaction Atomicity

**Critical Requirement:** Timer stop + financial record creation MUST be atomic.

**Current Problem:** Frontend creates timer record and financial record in separate API calls. If financial record creation fails, timer is already stopped (partial failure).

**Backend Solution:**
```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- 1. Stop timer
UPDATE time_entries SET
  status = 'completed',
  end_time = NOW(),
  billable_hours = ...
WHERE id = :timer_id;

-- 2. Check fixed-price
SELECT fixed_price FROM projects WHERE id = :project_id;

-- 3. Create financial record (if not fixed-price)
IF NOT fixed_price THEN
  INSERT INTO customer_sales (...) VALUES (...);
  -- If this fails, entire transaction rolls back
  -- Timer remains in 'active' state
END IF;

COMMIT; -- Both operations succeed or neither does
```

**Success Scenarios:**
- ✅ Timer stopped, financial record created (hourly project)
- ✅ Timer stopped, no financial record (fixed-price project)

**Failure Scenarios:**
- ❌ Timer stopped, financial record failed → **ROLLBACK**, timer stays active
- ❌ Timer stop failed → **ROLLBACK**, timer stays active
- User can retry operation safely

**Idempotency Protection:**
- If retry after rollback, idempotency key prevents duplicate attempt
- User sees consistent state

**Code Reference:** Current non-atomic implementation in `src/services/taskService.js:67-131`

---

## 5. Data Migration Plan

### 5.1 Migration Overview

**Objective:** Transfer all historical tasks and timer records from FileMaker to Supabase with zero data loss and complete referential integrity.

**Data Volume:**
- **Tasks:** ~10,000 records from FileMaker `devTasks` layout
- **Timer Records:** ~50,000 records from FileMaker `devRecords` layout
- **Financial Records:** Already in Supabase `customer_sales` (no migration needed)

**Migration Approach:**
- Big-bang historical data migration (read-only export from FileMaker)
- Followed by dual-write period (write to both systems)
- Final cutover to Supabase-only

**Target Timeline:** Q1 2026 (6-8 weeks from schema approval)

---

### 5.2 ID Reconciliation Strategy

**Critical Decision:** Direct UUID mapping (1:1 identity preservation)

**FileMaker → Supabase ID Mapping:**

| FileMaker Field | Supabase Field | Strategy |
|-----------------|----------------|----------|
| `devTasks.__ID` | `tasks.task_id` | Direct copy (FileMaker UUID becomes Supabase UUID) |
| `devRecords.__ID` | `time_entries.id` | Direct copy (FileMaker UUID becomes Supabase UUID) |
| `devTasks._projectID` | `tasks.project_id` | Lookup via `filemaker_id_mappings` table |
| `devRecords._taskID` | `time_entries.task_id` | Use `tasks.task_id` (1:1 with FileMaker __ID) |

**No Lookup Table Needed:** Tasks use direct UUID mapping from FileMaker `__ID` to Supabase `task_id`.

**filemaker_id_mappings Table (for Projects/Customers):**

```sql
-- Only needed if projects/customers don't use direct UUID mapping
CREATE TABLE IF NOT EXISTS filemaker_id_mappings (
  filemaker_id TEXT PRIMARY KEY,
  supabase_id UUID NOT NULL,
  table_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_filemaker_mappings_supabase_id ON filemaker_id_mappings(supabase_id);
CREATE INDEX idx_filemaker_mappings_table ON filemaker_id_mappings(table_name);
```

**Migration Script Example:**
```javascript
// Task migration
const fmTasks = await fetchFileMakerTasks(); // From devTasks layout

for (const fmTask of fmTasks) {
  const supabaseTask = {
    task_id: fmTask.__ID, // Direct UUID mapping
    task: fmTask.task,
    type: fmTask.type,
    project_id: await resolveProjectId(fmTask._projectID), // Lookup
    staff_id: await resolveStaffId(fmTask._staffID),       // Lookup
    organization_id: await resolveOrgId(fmTask.organization),
    is_completed: fmTask.f_completed === '1',
    priority: fmTask.f_priority || 'active',
    created_at: parseFileMakerTimestamp(fmTask['~creationTimestamp']),
    updated_at: parseFileMakerTimestamp(fmTask['~modificationTimestamp']),
    completed_at: fmTask.f_completed === '1' ? parseFileMakerTimestamp(fmTask['~modificationTimestamp']) : null
  };

  await supabase.from('tasks').insert(supabaseTask);
}
```

**Code Reference:** Complete migration strategy in `.devflow/tasks/tasks-migration-requirements/MIGRATION_STRATEGY.md`

---

### 5.3 Data Transformation Requirements

#### Tasks Transformation

**FileMaker → Supabase Field Mapping:**

```javascript
function transformTask(fmTask) {
  return {
    task_id: fmTask.__ID,  // UUID string
    task: fmTask.task.trim(),  // Remove whitespace
    type: fmTask.type || null,
    project_id: resolveProjectId(fmTask._projectID),
    staff_id: resolveStaffId(fmTask._staffID),
    organization_id: resolveOrganizationId(fmTask.organization),
    is_completed: fmTask.f_completed === '1' || fmTask.f_completed === 1,  // Boolean conversion
    priority: fmTask.f_priority || 'active',  // Default to 'active'
    created_at: parseFileMakerTimestamp(fmTask['~creationTimestamp']),  // ISO 8601
    updated_at: parseFileMakerTimestamp(fmTask['~modificationTimestamp']),
    completed_at: (fmTask.f_completed === '1' || fmTask.f_completed === 1)
      ? parseFileMakerTimestamp(fmTask['~modificationTimestamp'])
      : null,
    actual_hours: 0.00  // Will be recalculated from time_entries
  };
}
```

**Timestamp Conversion:**
```javascript
function parseFileMakerTimestamp(fmTimestamp) {
  // FileMaker format: "MM/DD/YYYY HH:MM:SS"
  // Target format: "YYYY-MM-DDTHH:MM:SSZ" (ISO 8601)

  const [date, time] = fmTimestamp.split(' ');
  const [month, day, year] = date.split('/');
  const [hours, minutes, seconds] = time.split(':');

  return new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hours),
    parseInt(minutes),
    parseInt(seconds)
  ).toISOString();
}
```

---

#### Time Entries Transformation

**FileMaker → Supabase Field Mapping:**

```javascript
function transformTimeEntry(fmRecord) {
  // Combine FileMaker date + time fields into PostgreSQL TIMESTAMPTZ
  const startTime = combineDateTime(fmRecord.DateStart, fmRecord.TimeStart);
  const endTime = fmRecord.TimeEnd
    ? combineDateTime(fmRecord.DateStart, fmRecord.TimeEnd)
    : null;

  return {
    id: fmRecord.__ID,  // UUID string
    task_id: fmRecord._taskID,  // Resolves to tasks.task_id
    project_id: resolveProjectId(fmRecord._projectID),
    customer_id: resolveCustomerId(fmRecord._custID),
    staff_id: resolveStaffId(fmRecord._staffID),
    organization_id: resolveOrganizationId(fmRecord.organization),
    start_time: startTime,
    end_time: endTime,
    status: endTime ? 'completed' : 'active',  // NEW: Derive status
    pause_start_time: null,  // NEW: No pause data in FileMaker
    total_pause_duration_seconds: 0,  // NEW: No pause data in FileMaker
    work_performed: fmRecord['Work Performed'] || 'Time logged',
    billable_hours: parseFloat(fmRecord.Billable_Time_Rounded) || 0.00,
    adjustment_seconds: parseInt(fmRecord.TimeAdjust) || 0,
    financial_record_id: await resolveFinancialRecordId(fmRecord.__ID),  // Lookup in customer_sales
    is_billable: true,
    created_at: parseFileMakerTimestamp(fmRecord['~creationTimestamp']),
    updated_at: parseFileMakerTimestamp(fmRecord['~modificationTimestamp'])
  };
}

function combineDateTime(fmDate, fmTime) {
  // FileMaker date: "MM/DD/YYYY"
  // FileMaker time: "HH:MM:SS"
  // Target: "YYYY-MM-DDTHH:MM:SSZ"

  const [month, day, year] = fmDate.split('/');
  const [hours, minutes, seconds] = fmTime.split(':');

  return new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hours),
    parseInt(minutes),
    parseInt(seconds)
  ).toISOString();
}
```

**Financial Record Linkage:**
```javascript
async function resolveFinancialRecordId(timerRecordId) {
  // Find customer_sales record linked to this timer
  const { data } = await supabase
    .from('customer_sales')
    .select('id')
    .eq('financial_id', timerRecordId)  // Assumes financial_id maps to FileMaker __ID
    .single();

  return data?.id || null;
}
```

**Code Reference:** Complete field mappings in `.devflow/tasks/tasks-migration-requirements/DEVRECORDS_SUPABASE_MAPPING.md`

---

### 5.4 Migration Phases

#### Phase 0: Schema Deployment (Week 1-2)
- ✅ Backend team reviews and approves this change request
- ✅ Create `tasks`, `time_entries`, `api_idempotency_keys` tables in staging
- ✅ Create all indexes, triggers, constraints
- ✅ Test schema with sample data
- ✅ Verify query performance (indexes used correctly)
- ✅ Deploy to production (tables empty)

#### Phase 1: Historical Data Migration (Week 3)
- ✅ Export all tasks from FileMaker `devTasks` layout
- ✅ Export all timer records from FileMaker `devRecords` layout
- ✅ Transform data (see section 5.3)
- ✅ Resolve all foreign keys (projects, customers, staff)
- ✅ Batch insert into Supabase staging (validate)
- ✅ Run reconciliation queries (see section 5.5)
- ✅ Deploy to production (read-only import)
- ✅ Verify counts match FileMaker

#### Phase 2: API Implementation (Week 4-5)
- ✅ Implement all 18 API endpoints
- ✅ Implement HMAC authentication
- ✅ Implement idempotency middleware
- ✅ Implement business logic (fixed-price, financial records)
- ✅ Unit test all endpoints
- ✅ Integration test end-to-end flows
- ✅ Performance test with 100+ concurrent users
- ✅ Deploy to staging

#### Phase 3: Dual-Write Implementation (Week 6)
- ✅ Update `src/api/tasks.js` to write to BOTH FileMaker AND Supabase
- ✅ Monitor for discrepancies
- ✅ Run daily reconciliation queries
- ✅ Fix any sync issues
- ✅ Deploy to production (dual-write enabled)
- ✅ Monitor for 1-2 weeks

#### Phase 4: Validation & Reconciliation (Week 7)
- ✅ Verify row counts match between systems
- ✅ Verify financial records match
- ✅ Verify no duplicate timers
- ✅ Verify billable hours calculations correct
- ✅ User acceptance testing
- ✅ Fix any data issues

#### Phase 5: Cutover to Supabase-Only (Week 8)
- ✅ Update `src/api/tasks.js` to use Supabase ONLY
- ✅ Remove FileMaker writes
- ✅ Monitor production for 3 days
- ✅ If successful, proceed to cleanup
- ✅ If issues, rollback to dual-write (see section 7.2)

#### Phase 6: Cleanup & Decommission (Week 9)
- ✅ Archive FileMaker task data
- ✅ Remove `dualWriteService.js` (no longer needed)
- ✅ Remove `financialSyncService.js` (no longer needed)
- ✅ Update documentation
- ✅ Remove FileMaker API credentials from env
- ✅ Celebrate! 🎉

**Code Reference:** Detailed migration plan in `.devflow/tasks/tasks-migration-requirements/MIGRATION_STRATEGY.md`

---

### 5.5 Reconciliation Queries

**Row Count Validation:**
```sql
-- Count tasks in Supabase
SELECT COUNT(*) FROM tasks;

-- Count tasks in FileMaker (via export)
-- Expected: Counts should match

-- Count time entries
SELECT COUNT(*) FROM time_entries;

-- Count by status
SELECT status, COUNT(*) FROM time_entries GROUP BY status;
```

**Foreign Key Integrity:**
```sql
-- Check for orphaned task records
SELECT t.task_id, t.project_id
FROM tasks t
LEFT JOIN projects p ON t.project_id = p.id
WHERE p.id IS NULL;
-- Expected: 0 rows

-- Check for orphaned time entries
SELECT te.id, te.task_id
FROM time_entries te
LEFT JOIN tasks t ON te.task_id = t.task_id
WHERE t.task_id IS NULL;
-- Expected: 0 rows
```

**Billable Hours Validation:**
```sql
-- Compare actual_hours on tasks vs sum of time_entries
SELECT
  t.task_id,
  t.actual_hours AS task_hours,
  COALESCE(SUM(te.billable_hours), 0) AS calculated_hours,
  ABS(t.actual_hours - COALESCE(SUM(te.billable_hours), 0)) AS difference
FROM tasks t
LEFT JOIN time_entries te ON te.task_id = t.task_id
GROUP BY t.task_id, t.actual_hours
HAVING ABS(t.actual_hours - COALESCE(SUM(te.billable_hours), 0)) > 0.01;
-- Expected: 0 rows (or small rounding differences)
```

**Financial Record Linkage:**
```sql
-- Verify financial records created for non-fixed-price projects
SELECT
  te.id AS time_entry_id,
  te.billable_hours,
  p.fixed_price,
  cs.id AS customer_sales_id
FROM time_entries te
JOIN tasks t ON t.task_id = te.task_id
JOIN projects p ON p.id = t.project_id
LEFT JOIN customer_sales cs ON cs.id = te.financial_record_id
WHERE te.status = 'completed'
  AND (p.fixed_price IS NULL OR p.fixed_price = 0)
  AND cs.id IS NULL;
-- Expected: 0 rows (all non-fixed-price completed timers should have financial records)
```

**Duplicate Timer Detection:**
```sql
-- Check for duplicate active timers per staff
SELECT staff_id, COUNT(*) AS active_timers
FROM time_entries
WHERE status IN ('active', 'paused')
GROUP BY staff_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

---

## 6. Testing Requirements

### 6.1 Unit Tests

**Database Schema Tests:**
- ✅ Tasks table constraints enforce validation rules
- ✅ Time entries state consistency constraints work
- ✅ Unique index prevents duplicate active timers
- ✅ Triggers calculate billable_hours correctly
- ✅ Triggers update actual_hours rollup correctly
- ✅ Foreign key constraints prevent orphaned records

**API Endpoint Tests:**
- ✅ Create task with valid data returns 201
- ✅ Create task with invalid data returns 400
- ✅ Create task with duplicate task_id returns 409
- ✅ Get tasks by project returns sorted results
- ✅ Update task with forbidden fields returns 400
- ✅ Update task completion status sets completed_at
- ✅ Start timer creates active timer
- ✅ Start timer when active exists returns 409
- ✅ Stop timer creates financial record (non-fixed-price)
- ✅ Stop timer skips financial record (fixed-price)
- ✅ Stop timer with invalid adjustment returns 400
- ✅ Pause/Resume transitions work correctly
- ✅ Adjust timer validates 6-minute increments

**Business Logic Tests:**
- ✅ Fixed-price detection works correctly
- ✅ Billable hours calculation handles pause time
- ✅ Product name formatting matches spec
- ✅ Hourly rate resolution follows priority order
- ✅ State machine transitions enforced

---

### 6.2 Integration Tests

**End-to-End Task Lifecycle:**
```javascript
test('Complete task lifecycle with hourly project', async () => {
  // 1. Create task
  const task = await createTask({
    task_id: uuidv4(),
    task: 'Test task',
    project_id: hourlyProjectId,
    staff_id: staffId,
    organization_id: orgId
  });
  expect(task.id).toBeDefined();

  // 2. Start timer
  const timer = await startTimer(task.task_id, staffId);
  expect(timer.status).toBe('active');

  // 3. Wait 1 second
  await sleep(1000);

  // 4. Stop timer
  const result = await stopTimer(timer.id, {
    work_performed: 'Testing',
    adjustment_seconds: 0
  });

  // 5. Verify timer stopped
  expect(result.timer.status).toBe('completed');
  expect(result.timer.billable_hours).toBeGreaterThan(0);

  // 6. Verify financial record created
  expect(result.financial_record.created).toBe(true);
  expect(result.financial_record.product_name).toMatch(/^[A-Z]+:[A-Z]/);

  // 7. Verify task actual_hours updated
  const updatedTask = await getTask(task.task_id);
  expect(updatedTask.actual_hours).toBeCloseTo(result.timer.billable_hours);

  // 8. Mark task complete
  await updateTaskStatus(task.task_id, { is_completed: true });
  const completedTask = await getTask(task.task_id);
  expect(completedTask.is_completed).toBe(true);
  expect(completedTask.completed_at).toBeDefined();
});
```

**Fixed-Price Project Test:**
```javascript
test('Timer on fixed-price project does not create financial record', async () => {
  const task = await createTask({
    task_id: uuidv4(),
    task: 'Fixed-price task',
    project_id: fixedPriceProjectId,  // Project with fixed_price > 0
    staff_id: staffId,
    organization_id: orgId
  });

  const timer = await startTimer(task.task_id, staffId);
  await sleep(1000);

  const result = await stopTimer(timer.id, {
    work_performed: 'Testing fixed-price'
  });

  // Timer should stop
  expect(result.timer.status).toBe('completed');

  // But NO financial record created
  expect(result.financial_record.created).toBe(false);
  expect(result.financial_record.reason).toBe('FIXED_PRICE_PROJECT');

  // Time entry still recorded for tracking
  expect(result.timer.billable_hours).toBeGreaterThan(0);
});
```

**Concurrency Test:**
```javascript
test('Concurrent timer start requests handled correctly', async () => {
  const task = await createTask({ /* ... */ });

  // Launch 10 concurrent start requests
  const promises = Array(10).fill(null).map(() =>
    startTimer(task.task_id, staffId)
  );

  const results = await Promise.allSettled(promises);

  // Exactly one should succeed
  const succeeded = results.filter(r => r.status === 'fulfilled');
  const failed = results.filter(r => r.status === 'rejected');

  expect(succeeded.length).toBe(1);
  expect(failed.length).toBe(9);

  // All failures should be 409 ACTIVE_TIMER_EXISTS
  failed.forEach(r => {
    expect(r.reason.code).toBe('ACTIVE_TIMER_EXISTS');
  });
});
```

---

### 6.3 Performance Tests

**Load Test Scenario:**
```javascript
test('Handle 100 concurrent timer operations', async () => {
  // Create 100 staff members and tasks
  const staffIds = await createStaffMembers(100);
  const tasks = await createTasks(staffIds);

  const startTime = Date.now();

  // Start 100 timers concurrently
  const promises = tasks.map((task, i) =>
    startTimer(task.task_id, staffIds[i])
  );

  const results = await Promise.all(promises);
  const endTime = Date.now();

  // All should succeed
  expect(results.length).toBe(100);
  results.forEach(r => expect(r.status).toBe('active'));

  // Performance expectations
  const totalTime = endTime - startTime;
  const avgLatency = totalTime / 100;

  expect(avgLatency).toBeLessThan(500); // P95 < 500ms
  expect(totalTime).toBeLessThan(10000); // Complete within 10 seconds
});
```

**Query Performance:**
```sql
-- Test index usage
EXPLAIN ANALYZE
SELECT * FROM tasks
WHERE project_id = '123e4567-e89b-12d3-a456-426614174000'
  AND is_completed = false
ORDER BY created_at DESC
LIMIT 100;

-- Expected: Index Scan using idx_tasks_project_status
-- Expected: Execution time < 50ms
```

---

### 6.4 Idempotency Tests

```javascript
test('Idempotency key prevents duplicate timer creation', async () => {
  const task = await createTask({ /* ... */ });
  const idempotencyKey = uuidv4();

  // First request
  const timer1 = await startTimer(task.task_id, staffId, {
    headers: { 'X-Idempotency-Key': idempotencyKey }
  });

  // Duplicate request with same key
  const timer2 = await startTimer(task.task_id, staffId, {
    headers: { 'X-Idempotency-Key': idempotencyKey }
  });

  // Same timer returned
  expect(timer1.id).toBe(timer2.id);
  expect(timer2.headers['X-Idempotency-Replay']).toBe('true');

  // Only one timer exists in database
  const timers = await getTimersByStaff(staffId);
  expect(timers.length).toBe(1);
});
```

---

## 7. Rollback & Contingency

### 7.1 Rollback Triggers

**When to Rollback:**
- Data corruption detected during migration
- Performance degradation in production (queries > 2 seconds)
- Duplicate timers created despite constraints
- Financial record creation failures > 1%
- User-reported data inconsistencies
- Critical bugs discovered post-deployment

**Decision Matrix:**

| Issue | Severity | Action |
|-------|----------|--------|
| Minor UI bug | Low | Fix forward, no rollback |
| Slow query (100-500ms) | Medium | Optimize index, monitor |
| Duplicate timers created | HIGH | Rollback to Phase 4 (dual-write) |
| Financial records missing | CRITICAL | Rollback to Phase 3, investigate |
| Data loss detected | CRITICAL | Full rollback, restore from backup |

---

### 7.2 Rollback Procedures

#### Rollback from Phase 5 (Supabase-Only) to Phase 4 (Dual-Write)

**Scenario:** Supabase-only mode has issues, revert to dual-write.

**Steps:**
1. **Immediate:** Update `src/api/tasks.js` to re-enable FileMaker writes
2. **Deploy:** Push hotfix to production (5-10 minutes)
3. **Verify:** Confirm writes going to both systems
4. **Investigate:** Identify root cause of issue
5. **Fix:** Implement fix in development
6. **Test:** Verify fix in staging
7. **Redeploy:** Attempt Phase 5 cutover again

**Code Changes:**
```javascript
// In src/api/tasks.js

// BEFORE (Supabase-only)
export async function createTask(taskData) {
  return await supabaseService.from('tasks').insert(taskData);
}

// AFTER (Dual-write rollback)
export async function createTask(taskData) {
  // Write to FileMaker
  await fileMakerApi.createRecord('devTasks', taskData);

  // Write to Supabase
  await supabaseService.from('tasks').insert(taskData);

  return taskData;
}
```

**Downtime:** < 15 minutes

---

#### Rollback from Phase 4 (Dual-Write) to Phase 3 (FileMaker-Only)

**Scenario:** Dual-write causing data inconsistencies, revert to FileMaker-only.

**Steps:**
1. **Immediate:** Update `src/api/tasks.js` to disable Supabase writes
2. **Deploy:** Push hotfix to production
3. **Verify:** Confirm writes going to FileMaker only
4. **Analyze:** Export Supabase data, compare with FileMaker
5. **Cleanup:** Delete inconsistent Supabase records
6. **Fix:** Implement fix for dual-write logic
7. **Retry:** Re-enable dual-write with fix

**Downtime:** < 15 minutes

---

#### Full Schema Rollback

**Scenario:** Critical database corruption, need to drop tables and restore.

**Steps:**
1. **Backup:** Create snapshot of Supabase database
2. **Drop Tables:**
   ```sql
   DROP TABLE IF EXISTS time_entries CASCADE;
   DROP TABLE IF EXISTS tasks CASCADE;
   DROP TABLE IF EXISTS api_idempotency_keys CASCADE;
   DROP FUNCTION IF EXISTS update_tasks_updated_at() CASCADE;
   DROP FUNCTION IF EXISTS update_time_entry_billable_hours() CASCADE;
   DROP FUNCTION IF EXISTS update_task_actual_hours() CASCADE;
   ```
3. **Restore FileMaker:** Ensure FileMaker is source of truth
4. **Update Frontend:** Revert to FileMaker API calls
5. **Deploy:** Push rollback to production
6. **Verify:** Confirm app functioning normally
7. **Investigate:** Root cause analysis
8. **Fix:** Address issues before retry

**Downtime:** 30-60 minutes

**Data Loss:** Minimal (FileMaker remains source of truth during migration)

---

### 7.3 Backup Strategy

**Pre-Migration Backups:**
- ✅ Export all FileMaker tasks to CSV/JSON
- ✅ Export all FileMaker timer records to CSV/JSON
- ✅ Snapshot Supabase database before migration
- ✅ Document row counts and checksums

**Continuous Backups:**
- ✅ Daily automated Supabase backups (Point-in-time recovery)
- ✅ FileMaker backups unchanged (existing schedule)
- ✅ Store backups in separate cloud storage (S3/GCS)

**Restore Testing:**
- ✅ Test restore procedure in staging environment
- ✅ Verify backup integrity weekly
- ✅ Document restore time (target: < 1 hour)

---

### 7.4 Monitoring & Alerting

**Key Metrics to Monitor:**

| Metric | Alert Threshold | Action |
|--------|----------------|--------|
| Duplicate active timers | > 0 | Critical alert, investigate immediately |
| Timer stop failure rate | > 1% | Page on-call, check logs |
| Financial record creation failure | > 0.1% | Alert team, review transactions |
| API latency (P95) | > 1 second | Optimize queries, check indexes |
| Database lock timeouts | > 5% | Reduce lock contention, review isolation level |
| Idempotency cache hit rate | < 5% | Monitor (expected in normal operation) |
| Row count discrepancy (dual-write) | > 10 rows | Alert team, run reconciliation |

**Logging Requirements:**
- ✅ Log all timer state transitions (start/pause/resume/stop)
- ✅ Log fixed-price vs hourly decision for each timer stop
- ✅ Log financial record creation success/failure
- ✅ Log all validation failures with details
- ✅ Log all authentication failures
- ✅ Log all database lock timeouts

**Dashboard:**
- Real-time timer operations per minute
- Active timers count by organization
- Financial record creation rate
- Error rate by endpoint
- Database query performance (P50, P95, P99)

---

## 8. Approval & Next Steps

### 8.1 Backend Team Questions

**Critical Questions Requiring Answers:**

1. **Staff Table Schema:**
   - What is the exact schema for the staff/team members table?
   - What field stores the hourly rate?
   - How is staff linked to organizations?

2. **Fixed-Price Field:**
   - Does `projects` table have a `fixed_price` or `f_fixedPrice` field?
   - What is the data type? (NUMERIC, DECIMAL, BOOLEAN?)
   - Is NULL treated as hourly (0) or fixed-price?

3. **Transaction Isolation:**
   - Is SERIALIZABLE isolation acceptable for timer operations?
   - Or prefer REPEATABLE READ with manual locking?

4. **Atomicity Decision:**
   - Should financial record failure rollback timer stop?
   - Or allow partial success (timer stopped, financial record failed)?
   - Current recommendation: Atomic (rollback both)

5. **Idempotency TTL:**
   - Is 24 hours appropriate for idempotency key expiration?
   - Or prefer shorter (1 hour) or longer (7 days)?

6. **Performance SLA:**
   - What is acceptable P95 latency for timer start/stop under load?
   - Target: < 500ms under 100 concurrent users

7. **Pause/Resume:**
   - Should pause/resume be server-side (as specified)?
   - Or remain client-side for simplicity?
   - Current recommendation: Server-side for consistency

8. **Monitoring:**
   - What metrics should be exposed?
   - Lock wait time, retry rate, idempotency cache hit rate?

---

### 8.2 Approval Checklist

**Before Backend Implementation Begins:**

- [ ] Backend team has reviewed complete document
- [ ] All questions in section 8.1 answered
- [ ] Staff table schema verified and documented
- [ ] Fixed-price field confirmed in projects table
- [ ] Database naming conventions agreed upon (snake_case vs camelCase)
- [ ] Transaction isolation level approved
- [ ] Atomicity strategy approved
- [ ] Performance SLA defined
- [ ] Testing plan approved
- [ ] Rollback procedures validated
- [ ] Migration timeline feasible (Q1 2026)
- [ ] Frontend team notified of API contracts
- [ ] DevOps notified of deployment requirements
- [ ] Security review complete (HMAC auth, SQL injection prevention)
- [ ] Compliance review complete (GDPR, audit logging)

---

### 8.3 Next Steps

**Phase 0: Pre-Implementation (Week 1)**
1. ✅ Backend team reviews this document
2. ✅ Answer all critical questions (section 8.1)
3. ✅ Verify dependencies (projects, customers, staff tables)
4. ✅ Create detailed implementation tickets
5. ✅ Assign backend developers
6. ✅ Set up staging environment

**Phase 1: Schema Development (Week 2)**
1. ✅ Create tables in staging database
2. ✅ Create indexes, triggers, constraints
3. ✅ Test schema with sample data
4. ✅ Run performance benchmarks
5. ✅ Deploy to production (empty tables)
6. ✅ Update API documentation

**Phase 2: API Development (Week 3-5)**
1. ✅ Implement all 18 endpoints
2. ✅ Implement HMAC authentication
3. ✅ Implement idempotency middleware
4. ✅ Implement business logic (fixed-price, financial records)
5. ✅ Write unit tests (90% coverage target)
6. ✅ Write integration tests
7. ✅ Performance testing (100+ concurrent users)
8. ✅ Deploy to staging
9. ✅ Frontend integration testing

**Phase 3: Data Migration (Week 6)**
1. ✅ Export FileMaker data
2. ✅ Transform data (see section 5.3)
3. ✅ Import to staging
4. ✅ Run reconciliation queries
5. ✅ Fix any data issues
6. ✅ Import to production (historical data)
7. ✅ Verify counts match

**Phase 4: Dual-Write (Week 7)**
1. ✅ Frontend updates to write both systems
2. ✅ Monitor for discrepancies
3. ✅ Daily reconciliation queries
4. ✅ Fix sync issues

**Phase 5: Cutover (Week 8)**
1. ✅ Frontend updates to Supabase-only
2. ✅ Remove FileMaker writes
3. ✅ Monitor production (3 days)
4. ✅ User acceptance testing
5. ✅ If successful, proceed to cleanup
6. ✅ If issues, rollback (section 7.2)

**Phase 6: Cleanup (Week 9)**
1. ✅ Archive FileMaker data
2. ✅ Remove dual-write services
3. ✅ Update documentation
4. ✅ Remove FileMaker credentials
5. ✅ Celebrate! 🎉

---

### 8.4 Success Criteria

**Migration is SUCCESSFUL if:**

✅ **Data Integrity:**
- Zero data loss (all tasks and timers migrated)
- Zero orphaned records (all foreign keys resolve)
- Billable hours calculations match FileMaker

✅ **Performance:**
- P95 latency < 500ms for all operations
- Database queries use indexes (no sequential scans)
- No lock timeout errors in normal operation

✅ **Correctness:**
- Fixed-price projects do NOT create financial records
- Hourly projects DO create financial records
- Product name formatting matches spec
- Timer state machine prevents invalid transitions

✅ **Reliability:**
- Zero duplicate active timers
- Zero partial failures (timer stopped without financial record)
- Idempotency prevents duplicate operations

✅ **User Experience:**
- No user-facing errors during migration
- Timer operations feel responsive (< 1 second)
- Financial records appear immediately after timer stop

---

## 9. Document References

**Supporting Documentation:**

1. **CLAUDE.md** - Project-wide backend change protocol
2. **TASK_CRUD_OPERATIONS.md** - Current task CRUD implementation
3. **TIMER_LIFECYCLE_STATE_MACHINE.md** - Timer state machine documentation
4. **FINANCIAL_RECORD_GENERATION.md** - Financial record creation flow
5. **FILEMAKER_DEVTASKS_MAPPING_SUMMARY.md** - Tasks field mappings
6. **DEVRECORDS_SUPABASE_MAPPING.md** - Timer records field mappings
7. **BACKEND_CHANGE_REQUEST_001_TASKS_API.md** - API endpoint specifications
8. **BACKEND_CHANGE_REQUEST_002_TIMER_OPERATIONS.md** - Concurrency & idempotency
9. **BACKEND_BUSINESS_LOGIC_REQUIREMENTS.md** - Validation rules
10. **MIGRATION_STRATEGY.md** - Complete migration plan
11. **DUAL_WRITE_MECHANISM.md** - Dual-write service documentation
12. **FINANCIAL_SYNC_RECONCILIATION.md** - Reconciliation logic
13. **TIMER_EDGE_CASE_TEST_CASES.md** - Edge case test scenarios
14. **QUICKBOOKS_INTEGRATION.md** - QuickBooks invoice generation

**Code References:**
- `src/services/taskService.js` - Task business logic
- `src/api/tasks.js` - FileMaker API calls
- `src/hooks/useTask.js` - Timer state management
- `src/components/tasks/TaskTimer.jsx` - Timer UI component
- `src/services/dataService.js` - HMAC authentication
- `src/services/dualWriteService.js` - Dual-write coordination
- `src/services/financialSyncService.js` - Financial record sync

---

## 10. Contact & Communication

**Slack Channel:** `#tasks-migration`

**Key Stakeholders:**
- **Frontend Team Lead:** [Contact Info]
- **Backend Team Lead:** [Contact Info]  ← **PRIMARY REVIEWER**
- **Database Administrator:** [Contact Info]
- **DevOps Lead:** [Contact Info]
- **Product Manager:** [Contact Info]

**Meeting Schedule:**
- **Weekly Sync:** Mondays 10am - Migration status review
- **Daily Standups:** During Phase 2-5 (API dev, migration, dual-write)
- **Go/No-Go Meeting:** Before Phase 5 cutover

**Communication Protocol:**
- **Questions:** Post in #tasks-migration Slack channel
- **Urgent Issues:** Page on-call via PagerDuty
- **Change Requests:** Update this document, notify in Slack
- **Status Updates:** Post weekly summary in Slack

---

## 11. Glossary

**Terms Used in This Document:**

- **FileMaker:** Legacy database system (source of truth for tasks/timers)
- **Supabase:** PostgreSQL-based backend (migration target)
- **devTasks:** FileMaker layout storing task records
- **devRecords:** FileMaker layout storing timer/financial records
- **Fixed-Price Project:** Project with predetermined cost (timers don't create financial records)
- **Hourly Project:** Project billed by time (timers create financial records)
- **customer_sales:** Supabase table storing billable line items
- **Idempotency Key:** Client-generated UUID preventing duplicate operations
- **HMAC:** Hash-based Message Authentication Code (API authentication method)
- **Dual-Write:** Writing to both FileMaker and Supabase during migration
- **Billable Hours:** Calculated time: (elapsed - pause + adjustment) / 3600
- **Time Entry:** Single timer record from start to stop
- **State Machine:** Timer states (IDLE, RUNNING, PAUSED, COMPLETED) with transition rules

---

**Document Version:** 1.0
**Status:** ⏳ Awaiting Backend Team Approval
**Last Updated:** 2026-01-10
**Next Review Date:** Upon backend team feedback

**Prepared By:** Frontend Team (via Claude)
**Reviewed By:** _Pending_
**Approved By:** _Pending_

---

## Appendix: Quick Reference

### Essential SQL DDL

```sql
-- Tasks table (copy-paste ready)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL UNIQUE,
  task TEXT NOT NULL CHECK (char_length(task) > 0 AND char_length(task) <= 200),
  type TEXT,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  staff_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  priority TEXT DEFAULT 'active' CHECK (priority IN ('active', 'high', 'low')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  actual_hours NUMERIC(10,2) DEFAULT 0.00
);

-- Time entries table (copy-paste ready)
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  staff_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  pause_start_time TIMESTAMPTZ,
  total_pause_duration_seconds INTEGER DEFAULT 0,
  work_performed TEXT,
  billable_hours NUMERIC(10,2),
  adjustment_seconds INTEGER DEFAULT 0 CHECK (adjustment_seconds % 360 = 0),
  financial_record_id UUID REFERENCES customer_sales(id),
  is_billable BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT time_entries_time_check CHECK (end_time IS NULL OR end_time > start_time),
  CONSTRAINT time_entries_state_consistency CHECK (
    (status = 'completed' AND end_time IS NOT NULL) OR
    (status IN ('active', 'paused') AND end_time IS NULL)
  ),
  CONSTRAINT time_entries_pause_consistency CHECK (
    (status = 'paused' AND pause_start_time IS NOT NULL) OR
    (status != 'paused' AND pause_start_time IS NULL)
  )
);

-- Critical unique index
CREATE UNIQUE INDEX idx_one_active_timer_per_staff
  ON time_entries(staff_id)
  WHERE status IN ('active', 'paused');
```

### API Endpoint Summary

```
Tasks:
  POST   /api/tasks                         Create task
  GET    /api/tasks?project_id={uuid}       List tasks
  GET    /api/tasks/{task_id}               Get task
  PATCH  /api/tasks/{task_id}               Update task
  PATCH  /api/tasks/{task_id}/status        Complete/uncomplete
  DELETE /api/tasks/{task_id}               Delete task
  GET    /api/tasks/{task_id}/notes         Get notes
  GET    /api/tasks/{task_id}/links         Get links

Timers:
  POST   /api/tasks/{task_id}/timer/start   Start timer
  POST   /api/tasks/{task_id}/timer/stop    Stop timer (ATOMIC)
  POST   /api/tasks/{task_id}/timer/pause   Pause timer
  POST   /api/tasks/{task_id}/timer/resume  Resume timer
  PATCH  /api/tasks/{task_id}/timer/adjust  Adjust time
  GET    /api/tasks/timers/active           Get active timer
  GET    /api/tasks/{task_id}/timers        List timers

All require: Authorization: Bearer {hmac}.{timestamp}
All support: X-Idempotency-Key: {uuid} (optional)
```

### Business Rules Cheat Sheet

```
Fixed-Price Detection:
  IF projects.fixed_price > 0 THEN skip customer_sales
  ELSE create customer_sales

Billable Hours:
  (end_time - start_time - pause_duration + adjustment) / 3600

Product Name:
  UPPERCASE(REMOVE_SPACES(customer)) + ":" + CAPITALIZE(FIRST_WORD(project))

Hourly Rate Priority:
  1. project.hourly_rate
  2. staff.hourly_rate
  3. organization.default_hourly_rate
  4. ERROR if all NULL

Adjustment Validation:
  adjustment_seconds % 360 === 0 (6-minute increments)

Active Timer Limit:
  One active OR paused timer per staff member (enforced by unique index)
```

---

**END OF MASTER BACKEND CHANGE REQUEST**

**Next Action:** Backend team review and approval
