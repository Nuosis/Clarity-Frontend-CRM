# Backend Change Request: Timer Operations API with Idempotency & Concurrency Control

**Request ID:** BACKEND_CHANGE_REQUEST_002_TIMER_OPERATIONS
**Date:** 2026-01-10
**Requester:** Frontend Team (via Claude)
**Priority:** High
**Target Release:** Q1 2026
**Depends On:** BACKEND_CHANGE_REQUEST_001_TASKS_API (tasks and task_timers tables)

---

## Executive Summary

This change request specifies the detailed implementation requirements for timer operation endpoints with a focus on **idempotency**, **concurrency control**, and **state validation**. While BACKEND_CHANGE_REQUEST_001_TASKS_API defined the basic timer endpoints, this document specifies the advanced requirements needed to handle race conditions, duplicate requests, network retries, and partial failures in production.

**Critical Requirements:**
- **Idempotency**: Duplicate timer start/stop requests must not create duplicate records
- **Concurrency Control**: Prevent race conditions when multiple clients attempt simultaneous operations
- **State Validation**: Enforce timer state machine rules at the database level
- **Atomic Operations**: Timer stop + financial record creation must be transactional
- **Offline Support**: Handle requests from clients that were offline during state changes

**Impact:**
- Database: Additional unique constraints, database locks, transaction isolation
- API: Idempotency keys, optimistic locking, conflict resolution
- Performance: Row-level locking may increase contention under high load

---

## Table of Contents

1. [Timer State Machine Enforcement](#timer-state-machine-enforcement)
2. [Idempotency Requirements](#idempotency-requirements)
3. [Concurrency Control Strategy](#concurrency-control-strategy)
4. [API Endpoint Specifications](#api-endpoint-specifications)
5. [Transaction Management](#transaction-management)
6. [Error Handling & Recovery](#error-handling--recovery)
7. [Testing Requirements](#testing-requirements)
8. [Performance Considerations](#performance-considerations)

---

## Timer State Machine Enforcement

### State Definitions

Timer records follow a strict state machine with three states:

```
┌─────────┐
│  IDLE   │ (no active timer record)
└────┬────┘
     │ START (creates record with end_time = NULL)
     ↓
┌──────────┐
│ RUNNING  │ (record exists, end_time = NULL, pause_start_time = NULL)
└────┬─────┘
     │ PAUSE (sets pause_start_time)
     ↓
┌──────────┐
│ PAUSED   │ (record exists, end_time = NULL, pause_start_time != NULL)
└────┬─────┘
     │ RESUME (clears pause_start_time, accumulates pause_duration)
     │
     ↓──────────────────┐
┌──────────┐            │
│ RUNNING  │←───────────┘
└────┬─────┘
     │ STOP (sets end_time, calculates billable_hours)
     ↓
┌───────────┐
│ COMPLETED │ (record exists, end_time != NULL)
└───────────┘
```

### Database State Constraints

**Add to task_timers table from BACKEND_CHANGE_REQUEST_001:**

```sql
-- State tracking columns (ADD to existing schema)
ALTER TABLE task_timers ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'paused', 'completed'));

ALTER TABLE task_timers ADD COLUMN IF NOT EXISTS pause_start_time TIMESTAMPTZ;
ALTER TABLE task_timers ADD COLUMN IF NOT EXISTS total_pause_duration_seconds INTEGER DEFAULT 0;

-- State consistency constraints
ALTER TABLE task_timers ADD CONSTRAINT task_timers_state_consistency CHECK (
  -- If completed, must have end_time
  (status = 'completed' AND end_time IS NOT NULL) OR
  -- If active or paused, must NOT have end_time
  (status IN ('active', 'paused') AND end_time IS NULL)
);

ALTER TABLE task_timers ADD CONSTRAINT task_timers_pause_consistency CHECK (
  -- If paused, must have pause_start_time
  (status = 'paused' AND pause_start_time IS NOT NULL) OR
  -- If not paused, must NOT have pause_start_time
  (status != 'paused' AND pause_start_time IS NULL)
);

-- Prevent multiple active/paused timers per staff member
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_timer_per_staff
  ON task_timers(staff_id)
  WHERE status IN ('active', 'paused');
```

**Code Reference:** Current client-side state machine in `src/hooks/useTask.js:28-45`, `.devflow/tasks/tasks-migration-requirements/TIMER_LIFECYCLE_STATE_MACHINE.md:48-101`

### State Transition Rules

| Current State | Allowed Operations | Forbidden Operations |
|---------------|-------------------|---------------------|
| IDLE (no timer) | START | PAUSE, RESUME, STOP, ADJUST |
| RUNNING | PAUSE, STOP, ADJUST | START, RESUME |
| PAUSED | RESUME, STOP, ADJUST | START, PAUSE |
| COMPLETED | (none) | START, PAUSE, RESUME, STOP, ADJUST |

**Enforcement:** All state transitions must be validated by the backend API with appropriate error codes for invalid transitions.

---

## Idempotency Requirements

### Overview

Timer operations must be **idempotent** to handle:
- Network retries (client didn't receive response)
- Duplicate form submissions
- Offline queue replay (same request sent twice)
- Browser back/forward causing re-POST

### Idempotency Key Strategy

**Client-Generated Idempotency Keys:**

All timer mutation operations (START, STOP, PAUSE, RESUME) must accept an optional `idempotency_key` header or request parameter:

```http
POST /api/tasks/{task_id}/timer/start
X-Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "staff_id": "staff-uuid",
  "organization_id": "org-uuid"
}
```

**Idempotency Key Format:**
- Client-generated UUID v4
- Valid for 24 hours after first use
- Stored in database table for deduplication

**Idempotency Table Schema:**

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
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',

  -- Index for cleanup
  INDEX idx_idempotency_expires_at ON api_idempotency_keys(expires_at)
);

-- Automatic cleanup of expired keys
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS void AS $$
BEGIN
  DELETE FROM api_idempotency_keys
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Run cleanup daily
SELECT cron.schedule(
  'cleanup-idempotency-keys',
  '0 2 * * *', -- 2 AM daily
  $$SELECT cleanup_expired_idempotency_keys()$$
);
```

### Idempotency Behavior

**First Request:**
1. Check if `idempotency_key` exists in `api_idempotency_keys`
2. If NOT exists, execute operation normally
3. Store request + response in `api_idempotency_keys`
4. Return response with `201 Created` or `200 OK`

**Duplicate Request:**
1. Check if `idempotency_key` exists in `api_idempotency_keys`
2. If EXISTS, retrieve cached response
3. Return cached response with same status code
4. Add header: `X-Idempotency-Replay: true`

**Example Implementation:**

```python
async def start_timer_with_idempotency(
    task_id: UUID,
    staff_id: UUID,
    organization_id: UUID,
    idempotency_key: Optional[UUID] = None
):
    # Check idempotency key
    if idempotency_key:
        cached = await get_idempotency_response(idempotency_key)
        if cached:
            return Response(
                status_code=cached['status'],
                content=cached['body'],
                headers={'X-Idempotency-Replay': 'true'}
            )

    # Execute operation (with transaction)
    async with transaction():
        timer = await create_timer_record(task_id, staff_id, organization_id)

        # Store idempotency key
        if idempotency_key:
            await store_idempotency_response(
                idempotency_key,
                endpoint='/api/tasks/{}/timer/start'.format(task_id),
                method='POST',
                status=201,
                body=timer.dict()
            )

        return Response(status_code=201, content=timer.dict())
```

**Code Reference:** Frontend currently does NOT send idempotency keys. This is a NEW requirement. Current timer start in `src/api/tasks.js:121-178`, stop in `src/api/tasks.js:189-213`.

---

## Concurrency Control Strategy

### Problem Statement

Race conditions can occur when:
1. **Double-start:** User clicks "Start" twice rapidly
2. **Concurrent start:** User has app open in multiple tabs/devices
3. **Stop during pause:** User clicks "Stop" while another request is pausing
4. **Network delays:** Slow network causes overlapping requests

### Solution: Optimistic Locking with Database Constraints

**Approach:**
- Use PostgreSQL unique constraints to prevent duplicate active timers
- Use row-level locking (`SELECT ... FOR UPDATE`) during state transitions
- Return specific error codes for conflict scenarios

### Implementation

#### 1. Start Timer with Concurrency Control

```sql
-- Pseudocode for START operation
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Check for existing active timer (with lock)
SELECT id, status
FROM task_timers
WHERE staff_id = :staff_id
  AND status IN ('active', 'paused')
FOR UPDATE NOWAIT; -- Fail fast if another transaction has lock

-- If row exists, abort with 409 CONFLICT
IF FOUND THEN
  ROLLBACK;
  RETURN {
    error: 'ACTIVE_TIMER_EXISTS',
    message: 'Staff member already has an active timer',
    active_timer_id: existing_timer.id
  };
END IF;

-- Create new timer (unique index prevents duplicates)
INSERT INTO task_timers (
  id, task_id, project_id, customer_id, staff_id, organization_id,
  start_time, status
) VALUES (
  gen_random_uuid(), :task_id, :project_id, :customer_id, :staff_id, :org_id,
  NOW(), 'active'
) RETURNING *;

COMMIT;
```

**Error Handling:**

- `409 CONFLICT` if active timer exists
- `423 LOCKED` if `FOR UPDATE NOWAIT` fails (another transaction in progress)
- `500 INTERNAL ERROR` if unique constraint violation (race condition edge case)

**Code Reference:** Frontend expects single active timer enforcement from `src/hooks/useTask.js:204-235`. Backend must enforce this at database level.

#### 2. Stop Timer with Concurrency Control

```sql
-- Pseudocode for STOP operation
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Lock the timer record
SELECT id, status, start_time, adjustment_seconds, project_id, customer_id
FROM task_timers
WHERE id = :timer_id
FOR UPDATE NOWAIT;

-- Validate state
IF status = 'completed' THEN
  ROLLBACK;
  RETURN {error: 'TIMER_ALREADY_STOPPED', message: 'Timer has already been stopped'};
END IF;

-- Calculate final pause duration if currently paused
IF status = 'paused' AND pause_start_time IS NOT NULL THEN
  total_pause_duration_seconds := total_pause_duration_seconds +
    EXTRACT(EPOCH FROM (NOW() - pause_start_time));
END IF;

-- Update timer record
UPDATE task_timers
SET
  status = 'completed',
  end_time = NOW(),
  work_performed = :work_performed,
  adjustment_seconds = :adjustment_seconds,
  total_pause_duration_seconds = total_pause_duration_seconds,
  pause_start_time = NULL,
  billable_hours = ROUND(
    (EXTRACT(EPOCH FROM (NOW() - start_time)) - total_pause_duration_seconds + :adjustment_seconds) / 3600.0,
    2
  ),
  updated_at = NOW()
WHERE id = :timer_id
RETURNING *;

-- Check if project is fixed-price
SELECT fixed_price
FROM projects
WHERE id = :project_id;

-- Create financial record only if NOT fixed-price
IF fixed_price = 0 OR fixed_price IS NULL THEN
  INSERT INTO customer_sales (
    financial_id, organization_id, customer_id, product_name,
    quantity, unit_price, total_price, date, time_entry_id
  ) VALUES (
    gen_random_uuid(), :org_id, :customer_id, :product_name,
    billable_hours, :hourly_rate, billable_hours * :hourly_rate,
    start_time::date, :timer_id
  );
END IF;

COMMIT;
```

**Idempotency Consideration:** If STOP is called twice with same `idempotency_key`, return cached response instead of error.

**Code Reference:** Current stop logic in `src/services/taskService.js:67-131`, financial record logic in `src/services/taskService.js:82-128`.

#### 3. Pause/Resume with Concurrency Control

**Pause Operation:**

```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Lock the timer
SELECT id, status, pause_start_time
FROM task_timers
WHERE id = :timer_id
FOR UPDATE NOWAIT;

-- Validate state
IF status != 'active' THEN
  ROLLBACK;
  RETURN {error: 'INVALID_STATE', message: 'Can only pause an active timer'};
END IF;

-- Update to paused
UPDATE task_timers
SET
  status = 'paused',
  pause_start_time = NOW(),
  updated_at = NOW()
WHERE id = :timer_id
RETURNING *;

COMMIT;
```

**Resume Operation:**

```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Lock the timer
SELECT id, status, pause_start_time, total_pause_duration_seconds
FROM task_timers
WHERE id = :timer_id
FOR UPDATE NOWAIT;

-- Validate state
IF status != 'paused' THEN
  ROLLBACK;
  RETURN {error: 'INVALID_STATE', message: 'Can only resume a paused timer'};
END IF;

-- Calculate pause duration and accumulate
pause_duration := EXTRACT(EPOCH FROM (NOW() - pause_start_time));

UPDATE task_timers
SET
  status = 'active',
  pause_start_time = NULL,
  total_pause_duration_seconds = total_pause_duration_seconds + pause_duration,
  updated_at = NOW()
WHERE id = :timer_id
RETURNING *;

COMMIT;
```

**Code Reference:** Current pause/resume in `src/hooks/useTask.js:279-301`. Currently client-side only, needs server-side implementation.

### Lock Timeout Configuration

```python
# Application configuration
DB_LOCK_TIMEOUT = 5000  # 5 seconds in milliseconds

# Set per-transaction
await conn.execute("SET LOCAL lock_timeout = '5s'")
```

If lock cannot be acquired within 5 seconds, return `423 LOCKED` error with retry-after header.

---

## API Endpoint Specifications

### 1. Start Timer (Idempotent)

**Endpoint:** `POST /api/tasks/{task_id}/timer/start`

**Request Headers:**
```http
Authorization: Bearer {hmac_signature}.{timestamp}
X-Idempotency-Key: {uuid-v4} (optional)
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
  "id": "timer-uuid",
  "task_id": "task-uuid",
  "project_id": "project-uuid",
  "customer_id": "customer-uuid",
  "staff_id": "staff-uuid",
  "organization_id": "org-uuid",
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
Same as above, with additional header:
```http
X-Idempotency-Replay: true
```

**Error Responses:**

```json
// 409 CONFLICT - Active timer exists
{
  "error": "ACTIVE_TIMER_EXISTS",
  "message": "Staff member already has an active timer",
  "code": "ACTIVE_TIMER_EXISTS",
  "details": {
    "active_timer_id": "existing-timer-uuid",
    "task_id": "existing-task-uuid"
  }
}

// 423 LOCKED - Concurrent request in progress
{
  "error": "RESOURCE_LOCKED",
  "message": "Timer operation in progress, please retry",
  "code": "RESOURCE_LOCKED",
  "retry_after_seconds": 2
}

// 404 NOT FOUND - Task not found
{
  "error": "TASK_NOT_FOUND",
  "message": "Task with id {task_id} not found",
  "code": "TASK_NOT_FOUND"
}

// 400 BAD REQUEST - Validation error
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid request parameters",
  "code": "VALIDATION_ERROR",
  "details": {
    "staff_id": "Invalid UUID format"
  }
}
```

**Business Logic:**
1. Validate `idempotency_key` (if provided), return cached response if exists
2. Begin serializable transaction
3. Fetch task to get `project_id`
4. Fetch project to get `customer_id`
5. Check for active timer with `SELECT ... FOR UPDATE NOWAIT`
6. If exists, return `409 CONFLICT` with active timer details
7. Create timer record with `status = 'active'`
8. Store idempotency response (if key provided)
9. Commit transaction
10. Return timer record

**Concurrency Safety:** Unique index `idx_one_active_timer_per_staff` prevents duplicate active timers even in race conditions.

---

### 2. Stop Timer (Idempotent, Atomic)

**Endpoint:** `POST /api/tasks/{task_id}/timer/stop`

**Request Headers:**
```http
Authorization: Bearer {hmac_signature}.{timestamp}
X-Idempotency-Key: {uuid-v4} (optional but RECOMMENDED)
Content-Type: application/json
```

**Request Body:**
```json
{
  "timer_id": "timer-uuid",
  "work_performed": "Implemented authentication logic",
  "adjustment_seconds": 360,
  "save_immediately": false
}
```

**Success Response (200 OK):**
```json
{
  "timer": {
    "id": "timer-uuid",
    "task_id": "task-uuid",
    "project_id": "project-uuid",
    "customer_id": "customer-uuid",
    "staff_id": "staff-uuid",
    "organization_id": "org-uuid",
    "start_time": "2026-01-10T14:30:00Z",
    "end_time": "2026-01-10T16:45:00Z",
    "status": "completed",
    "pause_start_time": null,
    "total_pause_duration_seconds": 300,
    "work_performed": "Implemented authentication logic",
    "billable_hours": 2.25,
    "adjustment_seconds": 360,
    "is_billable": true,
    "financial_record_id": "sales-record-uuid",
    "created_at": "2026-01-10T14:30:00Z",
    "updated_at": "2026-01-10T16:45:00Z"
  },
  "financial_record": {
    "id": "sales-record-uuid",
    "created": true,
    "product_name": "CLARITYBUSINESS:Website",
    "quantity": 2.25,
    "unit_price": 150.00,
    "total_price": 337.50
  }
}
```

**Error Responses:**

```json
// 409 CONFLICT - Timer already stopped
{
  "error": "TIMER_ALREADY_STOPPED",
  "message": "Timer has already been stopped",
  "code": "TIMER_ALREADY_STOPPED",
  "details": {
    "timer_id": "timer-uuid",
    "end_time": "2026-01-10T16:45:00Z"
  }
}

// 400 BAD REQUEST - Invalid adjustment
{
  "error": "INVALID_ADJUSTMENT",
  "message": "Adjustment must be in 6-minute (360 second) increments",
  "code": "INVALID_ADJUSTMENT",
  "details": {
    "adjustment_seconds": 123,
    "valid_increments": [0, 360, 720, 1080, -360, -720]
  }
}

// 423 LOCKED - Concurrent operation
{
  "error": "RESOURCE_LOCKED",
  "message": "Timer is being modified by another request",
  "code": "RESOURCE_LOCKED",
  "retry_after_seconds": 2
}

// 500 INTERNAL ERROR - Financial record creation failed
{
  "error": "FINANCIAL_RECORD_FAILED",
  "message": "Timer stopped but financial record creation failed",
  "code": "FINANCIAL_RECORD_FAILED",
  "details": {
    "timer_id": "timer-uuid",
    "error": "Customer lookup failed"
  }
}
```

**Business Logic:**
1. Validate `idempotency_key`, return cached if exists
2. Validate `adjustment_seconds % 360 === 0`
3. Begin serializable transaction
4. Lock timer record with `SELECT ... FOR UPDATE NOWAIT`
5. Validate `status IN ('active', 'paused')`
6. Calculate final `total_pause_duration_seconds` if currently paused
7. Update timer: set `end_time`, `status = 'completed'`, calculate `billable_hours`
8. Fetch project to check `fixed_price`
9. **If NOT fixed-price:** Create `customer_sales` record atomically
10. Store idempotency response
11. Commit transaction (atomic: timer + financial record)
12. Return timer + financial record details

**Atomicity Guarantee:** Timer stop and financial record creation happen in same transaction. If financial record fails, timer stop is rolled back.

**Code Reference:** Current non-atomic implementation in `src/services/taskService.js:67-131`. Backend MUST make this atomic.

---

### 3. Pause Timer (Idempotent)

**Endpoint:** `POST /api/tasks/{task_id}/timer/pause`

**Request Headers:**
```http
Authorization: Bearer {hmac_signature}.{timestamp}
X-Idempotency-Key: {uuid-v4} (optional)
Content-Type: application/json
```

**Request Body:**
```json
{
  "timer_id": "timer-uuid"
}
```

**Success Response (200 OK):**
```json
{
  "id": "timer-uuid",
  "task_id": "task-uuid",
  "status": "paused",
  "pause_start_time": "2026-01-10T15:00:00Z",
  "total_pause_duration_seconds": 0,
  "updated_at": "2026-01-10T15:00:00Z"
}
```

**Error Responses:**

```json
// 400 BAD REQUEST - Invalid state
{
  "error": "INVALID_STATE",
  "message": "Can only pause an active timer",
  "code": "INVALID_STATE",
  "details": {
    "current_status": "completed",
    "allowed_statuses": ["active"]
  }
}

// 409 CONFLICT - Already paused
{
  "error": "TIMER_ALREADY_PAUSED",
  "message": "Timer is already paused",
  "code": "TIMER_ALREADY_PAUSED"
}
```

**Idempotency:** If timer is already paused and same `idempotency_key` is sent, return `200 OK` with current state (not error).

**Code Reference:** Currently client-side only in `src/hooks/useTask.js:279-301`. This is NEW server-side functionality.

---

### 4. Resume Timer (Idempotent)

**Endpoint:** `POST /api/tasks/{task_id}/timer/resume`

**Request Headers:**
```http
Authorization: Bearer {hmac_signature}.{timestamp}
X-Idempotency-Key: {uuid-v4} (optional)
Content-Type: application/json
```

**Request Body:**
```json
{
  "timer_id": "timer-uuid"
}
```

**Success Response (200 OK):**
```json
{
  "id": "timer-uuid",
  "task_id": "task-uuid",
  "status": "active",
  "pause_start_time": null,
  "total_pause_duration_seconds": 450,
  "updated_at": "2026-01-10T15:10:00Z"
}
```

**Error Responses:**

```json
// 400 BAD REQUEST - Invalid state
{
  "error": "INVALID_STATE",
  "message": "Can only resume a paused timer",
  "code": "INVALID_STATE",
  "details": {
    "current_status": "active",
    "allowed_statuses": ["paused"]
  }
}
```

**Idempotency:** If timer is already active (resumed) and same `idempotency_key` is sent, return `200 OK` with current state.

**Code Reference:** Currently client-side only in `src/hooks/useTask.js:279-301`.

---

### 5. Adjust Timer (Idempotent)

**Endpoint:** `PATCH /api/tasks/{task_id}/timer/adjust`

**Request Headers:**
```http
Authorization: Bearer {hmac_signature}.{timestamp}
X-Idempotency-Key: {uuid-v4} (optional)
Content-Type: application/json
```

**Request Body:**
```json
{
  "timer_id": "timer-uuid",
  "adjustment_delta_seconds": 360
}
```

**Note:** `adjustment_delta_seconds` is the change to apply, not the absolute value. Pass `360` to add 6 minutes, `-360` to subtract 6 minutes.

**Success Response (200 OK):**
```json
{
  "id": "timer-uuid",
  "adjustment_seconds": 720,
  "updated_at": "2026-01-10T15:15:00Z"
}
```

**Error Responses:**

```json
// 400 BAD REQUEST - Invalid increment
{
  "error": "INVALID_ADJUSTMENT",
  "message": "Adjustment must be in 6-minute (360 second) increments",
  "code": "INVALID_ADJUSTMENT",
  "details": {
    "adjustment_delta_seconds": 123,
    "valid_values": [360, -360, 720, -720, "etc."]
  }
}

// 400 BAD REQUEST - Timer completed
{
  "error": "INVALID_STATE",
  "message": "Cannot adjust a completed timer",
  "code": "INVALID_STATE"
}
```

**Business Logic:**
1. Validate `adjustment_delta_seconds % 360 === 0`
2. Lock timer with `SELECT ... FOR UPDATE NOWAIT`
3. Validate `status IN ('active', 'paused')`
4. Update: `adjustment_seconds = adjustment_seconds + adjustment_delta_seconds`
5. Return updated timer

**Idempotency:** Use `idempotency_key` to prevent double-adjustment from retry.

**Code Reference:** Current client-side adjustment in `src/hooks/useTask.js:303-317`. Backend must enforce increment validation from `src/services/taskService.js:619-622`.

---

### 6. Get Active Timer (No Idempotency Key Needed)

**Endpoint:** `GET /api/tasks/timers/active?staff_id={staff_id}`

**Query Parameters:**
- `staff_id` (UUID, required)
- `organization_id` (UUID, optional) - Filter by organization

**Response (200 OK):**
```json
{
  "timer": {
    "id": "timer-uuid",
    "task_id": "task-uuid",
    "status": "active",
    "start_time": "2026-01-10T14:30:00Z",
    "pause_start_time": null,
    "total_pause_duration_seconds": 0,
    "adjustment_seconds": 0
  }
}
```

**Response (404 Not Found):**
```json
{
  "timer": null,
  "message": "No active timer found for staff member"
}
```

**Purpose:** Used on app initialization to restore timer state from server. Handles case where client localStorage is stale.

**Code Reference:** Frontend expects this for initialization.

---

## Transaction Management

### ACID Guarantees

All timer operations must provide:

- **Atomicity**: Timer stop + financial record creation happen together or not at all
- **Consistency**: State machine rules enforced at all times
- **Isolation**: Serializable isolation level prevents anomalies
- **Durability**: Committed operations survive crashes

### Transaction Isolation Level

```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
-- Timer operations here
COMMIT;
```

**Why Serializable:**
- Prevents phantom reads (new timer created between checks)
- Prevents non-repeatable reads (timer state changes mid-transaction)
- Guarantees state machine consistency

**Trade-off:** Higher contention, more retries under load. Monitor retry rates in production.

### Transaction Timeout

```python
# Set transaction timeout to prevent long-running locks
await conn.execute("SET LOCAL statement_timeout = '10s'")
```

If transaction takes > 10 seconds, rollback and return `500 INTERNAL ERROR`.

### Savepoints for Partial Rollback

```sql
BEGIN TRANSACTION;

-- Stop timer
UPDATE task_timers SET ... ;
SAVEPOINT after_timer_stop;

-- Try to create financial record
BEGIN
  INSERT INTO customer_sales ... ;
EXCEPTION WHEN OTHERS THEN
  -- Rollback financial record but keep timer stop
  ROLLBACK TO SAVEPOINT after_timer_stop;
  -- Log error but continue
  RAISE WARNING 'Financial record creation failed: %', SQLERRM;
END;

COMMIT;
```

**Decision:** Should financial record failure rollback timer stop?

**Recommendation:** YES - Make it atomic. Current frontend handles errors gracefully (`src/services/taskService.js:124-127`) but backend should prevent partial state.

---

## Error Handling & Recovery

### Error Code Summary

| Error Code | HTTP Status | Retry Safe | Description |
|-----------|-------------|------------|-------------|
| `ACTIVE_TIMER_EXISTS` | 409 | No | Staff already has active timer |
| `TIMER_ALREADY_STOPPED` | 409 | Yes | Timer already completed |
| `TIMER_ALREADY_PAUSED` | 409 | Yes | Timer already paused |
| `INVALID_STATE` | 400 | No | State transition not allowed |
| `INVALID_ADJUSTMENT` | 400 | No | Adjustment not in 6-min increments |
| `RESOURCE_LOCKED` | 423 | Yes | Concurrent operation in progress |
| `TASK_NOT_FOUND` | 404 | No | Task doesn't exist |
| `TIMER_NOT_FOUND` | 404 | No | Timer doesn't exist |
| `VALIDATION_ERROR` | 400 | No | Request validation failed |
| `FINANCIAL_RECORD_FAILED` | 500 | No | Financial record creation failed |
| `DATABASE_ERROR` | 500 | Maybe | Database operation failed |
| `AUTHENTICATION_ERROR` | 401 | No | HMAC auth failed |

### Retry Headers

For `423 LOCKED` errors, include:

```http
Retry-After: 2
X-Retry-Max-Attempts: 3
```

### Client Retry Strategy

**Frontend Implementation Guidance:**

```javascript
async function startTimerWithRetry(taskId, staffId, organizationId, maxRetries = 3) {
  const idempotencyKey = uuidv4(); // Generate once, reuse for retries

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`/api/tasks/${taskId}/timer/start`, {
        method: 'POST',
        headers: {
          'X-Idempotency-Key': idempotencyKey,
          'Authorization': generateHMACAuth(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ staff_id: staffId, organization_id: organizationId })
      });

      if (response.status === 423) {
        // Resource locked, retry after delay
        const retryAfter = parseInt(response.headers.get('Retry-After') || '2');
        await sleep(retryAfter * 1000);
        continue;
      }

      if (response.status === 409) {
        // Active timer exists, fetch it
        const error = await response.json();
        return { timer: await fetchTimer(error.details.active_timer_id) };
      }

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return await response.json();

    } catch (error) {
      if (attempt === maxRetries) throw error;
      await sleep(1000 * attempt); // Exponential backoff
    }
  }
}
```

**Code Reference:** Frontend will need to implement retry logic in `src/api/tasks.js`.

---

## Testing Requirements

### Unit Tests

**State Machine Tests:**

```python
def test_start_timer_idempotency():
    """Starting timer twice with same idempotency key returns same response"""
    key = uuid4()
    response1 = start_timer(task_id, staff_id, idempotency_key=key)
    response2 = start_timer(task_id, staff_id, idempotency_key=key)

    assert response1.status_code == 201
    assert response2.status_code == 201
    assert response1.json()['id'] == response2.json()['id']
    assert response2.headers['X-Idempotency-Replay'] == 'true'

def test_start_timer_prevents_duplicate_active():
    """Cannot start two timers for same staff"""
    timer1 = start_timer(task1_id, staff_id)
    assert timer1.status_code == 201

    timer2 = start_timer(task2_id, staff_id)
    assert timer2.status_code == 409
    assert timer2.json()['code'] == 'ACTIVE_TIMER_EXISTS'

def test_stop_timer_atomicity():
    """Timer stop and financial record creation are atomic"""
    timer = start_timer(task_id, staff_id)

    # Mock financial record failure
    with patch('create_financial_record', side_effect=Exception('DB error')):
        response = stop_timer(timer['id'], work_performed="Test")
        assert response.status_code == 500

    # Verify timer is NOT stopped (rolled back)
    timer = get_timer(timer['id'])
    assert timer['status'] == 'active'
    assert timer['end_time'] is None

def test_invalid_state_transitions():
    """Invalid state transitions return 400 error"""
    # Pause without active timer
    response = pause_timer(non_existent_timer_id)
    assert response.status_code == 404

    # Resume active timer (not paused)
    timer = start_timer(task_id, staff_id)
    response = resume_timer(timer['id'])
    assert response.status_code == 400
    assert response.json()['code'] == 'INVALID_STATE'

    # Stop already stopped timer
    stop_timer(timer['id'], work_performed="Test")
    response = stop_timer(timer['id'], work_performed="Test again")
    assert response.status_code == 409
    assert response.json()['code'] == 'TIMER_ALREADY_STOPPED'
```

### Concurrency Tests

```python
def test_concurrent_timer_start():
    """Concurrent start requests result in only one timer"""
    import asyncio

    async def start():
        return await start_timer_async(task_id, staff_id)

    # Launch 10 concurrent start requests
    results = await asyncio.gather(*[start() for _ in range(10)])

    # Exactly one should succeed with 201
    successes = [r for r in results if r.status_code == 201]
    conflicts = [r for r in results if r.status_code == 409]

    assert len(successes) == 1
    assert len(conflicts) == 9

    # Verify only one timer exists
    timers = get_timers_by_staff(staff_id)
    assert len(timers) == 1

def test_concurrent_stop_with_idempotency():
    """Concurrent stop requests with same idempotency key are safe"""
    timer = start_timer(task_id, staff_id)
    key = uuid4()

    async def stop():
        return await stop_timer_async(timer['id'], idempotency_key=key)

    # Launch 5 concurrent stop requests with SAME key
    results = await asyncio.gather(*[stop() for _ in range(5)])

    # All should return 200 OK (due to idempotency)
    assert all(r.status_code == 200 for r in results)

    # All should return same timer ID
    timer_ids = [r.json()['timer']['id'] for r in results]
    assert len(set(timer_ids)) == 1

    # Verify only one financial record created
    sales = get_customer_sales_by_timer(timer['id'])
    assert len(sales) == 1
```

### Load Tests

```python
def test_timer_operations_under_load():
    """Timer operations perform adequately under concurrent load"""
    import concurrent.futures

    # 100 staff members
    staff_ids = [create_staff() for _ in range(100)]

    # Each starts a timer concurrently
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        futures = [
            executor.submit(start_timer, task_id, staff_id)
            for staff_id in staff_ids
        ]
        results = [f.result() for f in futures]

    # All should succeed
    assert all(r.status_code == 201 for r in results)

    # All timers should be unique
    timer_ids = [r.json()['id'] for r in results]
    assert len(set(timer_ids)) == 100

    # Measure latency
    latencies = [r.elapsed.total_seconds() for r in results]
    assert max(latencies) < 5.0  # P100 < 5 seconds
    assert np.percentile(latencies, 95) < 1.0  # P95 < 1 second
```

**Code Reference:** No existing backend tests. These must be created from scratch.

---

## Performance Considerations

### Database Indexes

**Required Indexes:**

```sql
-- Already defined in BACKEND_CHANGE_REQUEST_001_TASKS_API
CREATE INDEX idx_task_timers_staff_id ON task_timers(staff_id);
CREATE INDEX idx_task_timers_task_id ON task_timers(task_id);

-- Unique partial index for active timer enforcement
CREATE UNIQUE INDEX idx_one_active_timer_per_staff
  ON task_timers(staff_id)
  WHERE status IN ('active', 'paused');

-- Idempotency key lookup
CREATE INDEX idx_idempotency_expires_at
  ON api_idempotency_keys(expires_at);
```

**Query Performance Expectations:**

| Operation | Expected Latency (P95) | Index Used |
|-----------|----------------------|------------|
| Start timer (check active) | < 50ms | `idx_one_active_timer_per_staff` |
| Stop timer (lock timer) | < 100ms | Primary key |
| Get active timer | < 20ms | `idx_one_active_timer_per_staff` |
| Idempotency key lookup | < 10ms | Primary key on `idempotency_key` |

### Connection Pool Configuration

```python
# Recommended pool settings
DB_POOL_MIN_SIZE = 10
DB_POOL_MAX_SIZE = 50
DB_POOL_MAX_OVERFLOW = 10
DB_POOL_TIMEOUT = 30  # seconds
DB_POOL_RECYCLE = 3600  # 1 hour
```

### Lock Contention Monitoring

**Monitor lock wait events:**

```sql
-- Monitor lock waits in production
SELECT
  pg_stat_activity.pid,
  pg_stat_activity.query,
  pg_locks.locktype,
  pg_locks.mode,
  pg_locks.granted,
  age(now(), pg_stat_activity.query_start) AS query_duration
FROM pg_stat_activity
JOIN pg_locks ON pg_stat_activity.pid = pg_locks.pid
WHERE NOT pg_locks.granted
ORDER BY query_duration DESC;
```

**Alert if lock wait time exceeds 2 seconds.**

### Optimistic Locking Alternative

**If row-level locking causes too much contention:**

Consider optimistic locking with version column:

```sql
ALTER TABLE task_timers ADD COLUMN version INTEGER DEFAULT 1;

-- Update with version check
UPDATE task_timers
SET
  status = 'completed',
  version = version + 1
WHERE id = :timer_id
  AND version = :expected_version
RETURNING *;

-- If 0 rows updated, version mismatch (concurrent update)
```

**Trade-off:** Simpler locking, but clients must retry on version mismatch.

---

## Migration Plan

### Phase 1: Database Schema (Week 1)
- [ ] Add `status`, `pause_start_time`, `total_pause_duration_seconds` to `task_timers`
- [ ] Add state consistency constraints
- [ ] Create `api_idempotency_keys` table
- [ ] Create unique index for active timer enforcement
- [ ] Test on staging environment

### Phase 2: API Implementation (Week 2-3)
- [ ] Implement idempotency middleware
- [ ] Implement START endpoint with concurrency control
- [ ] Implement STOP endpoint with atomicity
- [ ] Implement PAUSE/RESUME endpoints
- [ ] Implement ADJUST endpoint
- [ ] Add comprehensive error handling

### Phase 3: Testing (Week 4)
- [ ] Unit tests for state machine
- [ ] Concurrency tests (parallel requests)
- [ ] Load tests (100+ concurrent users)
- [ ] Idempotency tests (duplicate requests)
- [ ] Error recovery tests

### Phase 4: Frontend Integration (Week 5)
- [ ] Update `src/api/tasks.js` to send idempotency keys
- [ ] Implement retry logic for `423 LOCKED` errors
- [ ] Handle new error codes (`ACTIVE_TIMER_EXISTS`, etc.)
- [ ] Remove client-side pause/resume localStorage (use server state)

### Phase 5: Deployment (Week 6)
- [ ] Deploy to staging
- [ ] Monitor lock contention metrics
- [ ] Run load tests in staging
- [ ] Deploy to production during low-traffic window
- [ ] Monitor error rates and retry rates

---

## Rollback Plan

**If concurrency issues arise in production:**

1. **Immediate:** Revert API to non-locking version (allow duplicates temporarily)
2. **Database:** Drop unique constraint `idx_one_active_timer_per_staff`
3. **Cleanup:** Run script to deduplicate any duplicate timers created during incident
4. **Investigation:** Analyze lock wait logs to identify bottleneck
5. **Fix:** Implement optimistic locking or adjust transaction isolation
6. **Redeploy:** With fix in place

---

## Questions for Backend Team

1. **Transaction Isolation:** Is SERIALIZABLE isolation acceptable, or prefer REPEATABLE READ with manual locking?
2. **Atomicity:** Should financial record failure rollback timer stop, or allow partial success?
3. **Idempotency TTL:** Is 24 hours appropriate for idempotency key expiration?
4. **Lock Timeout:** Is 5 seconds reasonable for lock timeout, or too aggressive?
5. **Performance:** What is acceptable P95 latency for timer start/stop under load?
6. **Monitoring:** What metrics should be exposed (lock wait time, retry rate, idempotency cache hit rate)?
7. **Pause/Resume:** Should pause/resume be server-side (as specified) or remain client-side?
8. **Offline Support:** How to handle clients that were offline during timer operations?

---

## Success Metrics

**Deployment is successful if:**

- ✅ Zero duplicate active timers created in 30 days
- ✅ Zero partial failures (timer stopped without financial record)
- ✅ < 1% of requests result in `423 LOCKED` error
- ✅ P95 latency for timer operations < 500ms under normal load
- ✅ Idempotency cache hit rate > 10% (indicates effective retry handling)
- ✅ Zero data inconsistencies between timers and financial records
- ✅ State machine violations = 0 (no invalid state transitions)

---

## Approval Checklist

- [ ] Schema changes reviewed and approved
- [ ] Idempotency strategy validated
- [ ] Concurrency control approach agreed upon
- [ ] Transaction atomicity requirements confirmed
- [ ] Error codes documented and approved
- [ ] Performance benchmarks defined
- [ ] Testing plan comprehensive
- [ ] Rollback procedure tested
- [ ] Frontend team notified of idempotency key requirement
- [ ] Monitoring and alerting configured

---

**Document Version:** 1.0
**Status:** Awaiting Backend Team Approval
**Last Updated:** 2026-01-10
**Related Documents:**
- BACKEND_CHANGE_REQUEST_001_TASKS_API.md
- .devflow/tasks/tasks-migration-requirements/TIMER_LIFECYCLE_STATE_MACHINE.md
- .devflow/tasks/tasks-migration-requirements/FINANCIAL_RECORD_GENERATION.md
- requirements/tasks/acceptance-criteria.md
