# Tasks & Timer - API Contracts

## Overview

This document specifies the backend API endpoints and RPC functions required to support the Tasks and Timer feature in Supabase-only mode.

## Authentication

All endpoints require HMAC-SHA256 authentication:
- Header: `Authorization: Bearer {signature}.{timestamp}`
- Signature generated from request body + timestamp + secret key
- Organization scoping via JWT or header parameter

## Base URL

**Production:** `https://api.claritybusinesssolutions.ca`
**Development:** `http://localhost:8000` (proxied via Vite)

---

## Task Management Endpoints

### 1. List Tasks for Project

**Endpoint:** `GET /tasks`
**Query Parameters:**
- `project_id` (required): UUID of the project
- `include_completed` (optional): Boolean, default `false`
- `staff_id` (optional): Filter by assigned staff
- `status` (optional): Filter by status (`pending`, `in_progress`, `completed`, `cancelled`)

**Request Example:**
```http
GET /tasks?project_id=550e8400-e29b-41d4-a716-446655440000&include_completed=false
Authorization: Bearer {signature}.{timestamp}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "project_id": "550e8400-e29b-41d4-a716-446655440000",
      "customer_id": "660f9511-f30c-52e5-b827-557766551111",
      "staff_id": "770g0622-g41d-63f6-c938-668877662222",
      "title": "Implement user authentication",
      "task_type": "Development",
      "notes": "Use JWT tokens",
      "is_completed": false,
      "status": "in_progress",
      "priority": 3,
      "estimated_hours": 8.0,
      "actual_hours": 2.5,
      "due_date": "2026-01-15",
      "created_at": "2026-01-10T10:00:00Z",
      "updated_at": "2026-01-10T14:30:00Z"
    }
  ],
  "meta": {
    "count": 1,
    "total": 15
  }
}
```

---

### 2. Get Task by ID

**Endpoint:** `GET /tasks/{task_id}`

**Request Example:**
```http
GET /tasks/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer {signature}.{timestamp}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "customer_id": "660f9511-f30c-52e5-b827-557766551111",
    "staff_id": "770g0622-g41d-63f6-c938-668877662222",
    "title": "Implement user authentication",
    "task_type": "Development",
    "notes": "Use JWT tokens",
    "is_completed": false,
    "status": "in_progress",
    "priority": 3,
    "estimated_hours": 8.0,
    "actual_hours": 2.5,
    "due_date": "2026-01-15",
    "created_at": "2026-01-10T10:00:00Z",
    "updated_at": "2026-01-10T14:30:00Z",
    "active_timer": {
      "id": "timer-uuid",
      "start_time": "2026-01-10T14:00:00Z",
      "status": "active"
    }
  }
}
```

---

### 3. Create Task

**Endpoint:** `POST /tasks`

**Request:**
```json
{
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "staff_id": "770g0622-g41d-63f6-c938-668877662222",
  "title": "Write documentation",
  "task_type": "Documentation",
  "notes": "API reference docs",
  "priority": 2,
  "estimated_hours": 4.0,
  "due_date": "2026-01-12"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "new-task-uuid",
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "customer_id": "660f9511-f30c-52e5-b827-557766551111",
    "staff_id": "770g0622-g41d-63f6-c938-668877662222",
    "title": "Write documentation",
    "task_type": "Documentation",
    "notes": "API reference docs",
    "is_completed": false,
    "status": "pending",
    "priority": 2,
    "estimated_hours": 4.0,
    "actual_hours": null,
    "due_date": "2026-01-12",
    "created_at": "2026-01-10T15:00:00Z",
    "updated_at": "2026-01-10T15:00:00Z"
  }
}
```

**Validation:**
- `project_id` required (must exist and belong to org)
- `title` required (max 255 chars)
- `priority` must be 1-5
- `due_date` must be future date or null
- `customer_id` auto-populated from project

---

### 4. Update Task

**Endpoint:** `PATCH /tasks/{task_id}`

**Request:**
```json
{
  "title": "Updated title",
  "notes": "Updated notes",
  "status": "in_progress",
  "priority": 4
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "title": "Updated title",
    "notes": "Updated notes",
    "status": "in_progress",
    "priority": 4,
    "updated_at": "2026-01-10T15:30:00Z"
  }
}
```

**Validation:**
- `id` must exist and belong to org
- `status` must be valid enum value
- Cannot change `project_id` or `organization_id`
- `is_completed` auto-set when `status='completed'`

---

### 5. Toggle Task Completion

**Endpoint:** `POST /tasks/{task_id}/toggle-completion`

**Request:**
```json
{
  "completed": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "is_completed": true,
    "status": "completed",
    "updated_at": "2026-01-10T16:00:00Z"
  }
}
```

**Business Rules:**
- Sets `is_completed` flag
- Auto-updates `status` to `completed` (if true) or `pending` (if false)
- Cannot complete task with active timer

---

### 6. Delete Task

**Endpoint:** `DELETE /tasks/{task_id}`

**Response:**
```json
{
  "success": true,
  "message": "Task deleted successfully"
}
```

**Business Rules:**
- Soft delete or hard delete (TBD)
- Cascade deletes time_entries (or prevent if entries exist)
- Must belong to user's organization

---

## Timer Endpoints

### 7. Start Timer

**Endpoint:** `POST /time-entries/start`

**Request:**
```json
{
  "task_id": "123e4567-e89b-12d3-a456-426614174000",
  "description": "Starting work on authentication"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "time-entry-uuid",
    "task_id": "123e4567-e89b-12d3-a456-426614174000",
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "customer_id": "660f9511-f30c-52e5-b827-557766551111",
    "staff_id": "770g0622-g41d-63f6-c938-668877662222",
    "start_time": "2026-01-10T16:30:00Z",
    "end_time": null,
    "description": "Starting work on authentication",
    "status": "active",
    "created_at": "2026-01-10T16:30:00Z"
  }
}
```

**Business Rules:**
- **Idempotency:** If timer already active for this task+staff, return existing timer (do not create duplicate)
- **Concurrency:** Only one active timer per staff member globally
- Auto-populate `project_id`, `customer_id` from task
- Set `status='active'`
- Fetch staff's hourly rate and store in `hourly_rate` column

**Error Responses:**
```json
{
  "success": false,
  "error": "Staff member already has an active timer for task XYZ"
}
```

```json
{
  "success": false,
  "error": "Task does not exist or does not belong to your organization"
}
```

---

### 8. Pause Timer

**Endpoint:** `POST /time-entries/{entry_id}/pause`

**Request:**
```json
{
  "pause_duration_seconds": 360
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "time-entry-uuid",
    "status": "paused",
    "pause_duration_seconds": 360,
    "updated_at": "2026-01-10T16:45:00Z"
  }
}
```

**Business Rules:**
- Update `status` to `paused`
- Accumulate `pause_duration_seconds`
- Do NOT set `end_time`

**Alternative:** Pause tracking can be client-side only, with total sent on stop.

---

### 9. Resume Timer

**Endpoint:** `POST /time-entries/{entry_id}/resume`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "time-entry-uuid",
    "status": "active",
    "updated_at": "2026-01-10T17:00:00Z"
  }
}
```

**Business Rules:**
- Update `status` to `active`
- Pause duration already accumulated

---

### 10. Stop Timer

**Endpoint:** `POST /time-entries/{entry_id}/stop`

**Request:**
```json
{
  "description": "Completed user login flow with JWT tokens",
  "adjustment_seconds": 360,
  "pause_duration_seconds": 120
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "time_entry": {
      "id": "time-entry-uuid",
      "task_id": "123e4567-e89b-12d3-a456-426614174000",
      "start_time": "2026-01-10T14:00:00Z",
      "end_time": "2026-01-10T17:30:00Z",
      "description": "Completed user login flow with JWT tokens",
      "adjustment_seconds": 360,
      "pause_duration_seconds": 120,
      "duration_minutes": 204.0,
      "hourly_rate": 150.00,
      "billable_amount": 510.00,
      "status": "completed",
      "completed_at": "2026-01-10T17:30:00Z",
      "updated_at": "2026-01-10T17:30:00Z"
    },
    "customer_sale": {
      "id": "sale-uuid",
      "time_entry_id": "time-entry-uuid",
      "customer_id": "660f9511-f30c-52e5-b827-557766551111",
      "project_id": "550e8400-e29b-41d4-a716-446655440000",
      "task_id": "123e4567-e89b-12d3-a456-426614174000",
      "date": "2026-01-10",
      "description": "Completed user login flow with JWT tokens",
      "duration": 204.0,
      "amount": 510.00,
      "status": "draft",
      "is_billable": true,
      "created_at": "2026-01-10T17:30:00Z"
    }
  }
}
```

**Business Rules:**
- Set `end_time` to current timestamp
- Update `status` to `completed`
- Calculate `duration_minutes` = (end_time - start_time - adjustment - pause) / 60
- Calculate `billable_amount` = (duration_minutes / 60) * hourly_rate
- **Atomically create `customer_sales` record** with same data
- Return both time_entry and customer_sale in response
- Update task's `actual_hours` (rollup of all completed time entries)

**Duration Calculation:**
```javascript
const elapsedSeconds = (end_time - start_time).total_seconds();
const adjustedSeconds = elapsedSeconds - adjustment_seconds - pause_duration_seconds;
const duration_minutes = Math.max(0, adjustedSeconds / 60.0);
const billable_amount = (duration_minutes / 60.0) * hourly_rate;
```

**Error Responses:**
```json
{
  "success": false,
  "error": "Time entry not found or already completed"
}
```

```json
{
  "success": false,
  "error": "Cannot stop timer with negative duration"
}
```

---

### 11. Adjust Time Entry

**Endpoint:** `PATCH /time-entries/{entry_id}/adjust`

**Request:**
```json
{
  "adjustment_seconds": 720,
  "description": "Updated description"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "time-entry-uuid",
    "adjustment_seconds": 720,
    "duration_minutes": 192.0,
    "billable_amount": 480.00,
    "description": "Updated description",
    "updated_at": "2026-01-10T18:00:00Z"
  }
}
```

**Business Rules:**
- Recalculate duration and billable amount
- Update corresponding `customer_sales` record if exists
- Only allowed if entry is `completed` and not yet invoiced

---

### 12. Get Active Timer for Staff

**Endpoint:** `GET /time-entries/active`

**Query Parameters:**
- `staff_id` (optional): Defaults to authenticated user

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "time-entry-uuid",
    "task_id": "123e4567-e89b-12d3-a456-426614174000",
    "task_title": "Implement user authentication",
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "project_name": "CRM Rebuild",
    "customer_name": "Acme Corp",
    "start_time": "2026-01-10T14:00:00Z",
    "status": "active",
    "elapsed_seconds": 3600
  }
}
```

**Response (no active timer):**
```json
{
  "success": true,
  "data": null
}
```

---

### 13. List Time Entries for Task

**Endpoint:** `GET /time-entries`

**Query Parameters:**
- `task_id` (optional): Filter by task
- `project_id` (optional): Filter by project
- `customer_id` (optional): Filter by customer
- `staff_id` (optional): Filter by staff
- `start_date` (optional): Filter by date range
- `end_date` (optional): Filter by date range
- `status` (optional): Filter by status

**Request Example:**
```http
GET /time-entries?task_id=123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer {signature}.{timestamp}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "time-entry-uuid",
      "task_id": "123e4567-e89b-12d3-a456-426614174000",
      "start_time": "2026-01-09T10:00:00Z",
      "end_time": "2026-01-09T12:30:00Z",
      "description": "Initial setup and planning",
      "duration_minutes": 150.0,
      "billable_amount": 375.00,
      "status": "completed",
      "completed_at": "2026-01-09T12:30:00Z"
    },
    {
      "id": "time-entry-uuid-2",
      "task_id": "123e4567-e89b-12d3-a456-426614174000",
      "start_time": "2026-01-10T14:00:00Z",
      "end_time": null,
      "description": "Continuing implementation",
      "status": "active"
    }
  ],
  "meta": {
    "count": 2,
    "total_duration_minutes": 150.0,
    "total_billable_amount": 375.00
  }
}
```

---

## RPC Functions (Supabase Edge Functions)

### 14. RPC: calculate_task_actual_hours

**Purpose:** Recalculate task's `actual_hours` from time entries

**Function Signature:**
```sql
CREATE OR REPLACE FUNCTION calculate_task_actual_hours(task_uuid UUID)
RETURNS NUMERIC AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(duration_minutes) / 60.0, 0)
    FROM time_entries
    WHERE task_id = task_uuid
      AND status = 'completed'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage:**
```sql
SELECT calculate_task_actual_hours('123e4567-e89b-12d3-a456-426614174000');
-- Returns: 3.5
```

---

### 15. RPC: get_staff_active_timer

**Purpose:** Check if staff has active timer (for concurrency control)

**Function Signature:**
```sql
CREATE OR REPLACE FUNCTION get_staff_active_timer(staff_uuid UUID)
RETURNS TABLE (
  id UUID,
  task_id UUID,
  start_time TIMESTAMPTZ,
  elapsed_seconds INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    te.id,
    te.task_id,
    te.start_time,
    EXTRACT(EPOCH FROM (now() - te.start_time))::INTEGER AS elapsed_seconds
  FROM time_entries te
  WHERE te.staff_id = staff_uuid
    AND te.status = 'active'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### 16. RPC: stop_timer_and_create_sale

**Purpose:** Atomically stop timer and create customer_sales record

**Function Signature:**
```sql
CREATE OR REPLACE FUNCTION stop_timer_and_create_sale(
  entry_uuid UUID,
  work_description TEXT,
  adjustment_secs INTEGER DEFAULT 0,
  pause_secs INTEGER DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
  v_time_entry time_entries%ROWTYPE;
  v_customer_sale customer_sales%ROWTYPE;
  v_duration_minutes NUMERIC;
  v_billable_amount NUMERIC;
BEGIN
  -- Fetch and lock time entry
  SELECT * INTO v_time_entry
  FROM time_entries
  WHERE id = entry_uuid
    AND status IN ('active', 'paused')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Time entry not found or already completed';
  END IF;

  -- Calculate duration
  v_duration_minutes := GREATEST(0,
    (EXTRACT(EPOCH FROM (now() - v_time_entry.start_time)) - adjustment_secs - pause_secs) / 60.0
  );

  v_billable_amount := (v_duration_minutes / 60.0) * COALESCE(v_time_entry.hourly_rate, 0);

  -- Update time entry
  UPDATE time_entries
  SET
    end_time = now(),
    description = work_description,
    adjustment_seconds = adjustment_secs,
    pause_duration_seconds = pause_secs,
    duration_minutes = v_duration_minutes,
    billable_amount = v_billable_amount,
    status = 'completed',
    completed_at = now(),
    updated_at = now()
  WHERE id = entry_uuid
  RETURNING * INTO v_time_entry;

  -- Create customer_sales record
  INSERT INTO customer_sales (
    organization_id, time_entry_id, customer_id, project_id, task_id, staff_id,
    date, description, duration, amount, status, is_billable
  )
  VALUES (
    v_time_entry.organization_id,
    v_time_entry.id,
    v_time_entry.customer_id,
    v_time_entry.project_id,
    v_time_entry.task_id,
    v_time_entry.staff_id,
    v_time_entry.start_time::DATE,
    work_description,
    v_duration_minutes,
    v_billable_amount,
    'draft',
    v_time_entry.is_billable
  )
  RETURNING * INTO v_customer_sale;

  -- Update task actual_hours
  UPDATE tasks
  SET actual_hours = calculate_task_actual_hours(v_time_entry.task_id)
  WHERE id = v_time_entry.task_id;

  -- Return both records as JSON
  RETURN json_build_object(
    'time_entry', row_to_json(v_time_entry),
    'customer_sale', row_to_json(v_customer_sale)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Error Handling

All endpoints return consistent error format:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "error_code": "TIMER_ALREADY_ACTIVE",
  "details": {
    "field": "staff_id",
    "existing_timer_id": "uuid"
  }
}
```

**Error Codes:**
- `TASK_NOT_FOUND`: Task does not exist
- `UNAUTHORIZED`: User does not have access to resource
- `TIMER_ALREADY_ACTIVE`: Staff has active timer
- `TIMER_NOT_ACTIVE`: Trying to stop/pause inactive timer
- `VALIDATION_ERROR`: Invalid input data
- `DURATION_NEGATIVE`: Timer duration would be negative
- `ALREADY_COMPLETED`: Timer already stopped

---

## Idempotency

### Timer Start
- **Idempotency Key:** `{staff_id}-{task_id}-active`
- If timer already exists for staff+task with `status='active'`, return existing timer (200 OK)
- Do NOT create duplicate

### Timer Stop
- **Idempotency:** Check `status` before stopping
- If already `completed`, return 400 error (not idempotent by default)
- Could support idempotency key in header for retries

---

## Rate Limiting

- 100 requests per minute per organization
- 10 timer starts per staff per hour (prevent accidental duplicates)

---

## Webhooks (Future)

**Timer Started:**
```json
{
  "event": "time_entry.started",
  "data": { "id": "uuid", "task_id": "uuid", "staff_id": "uuid" }
}
```

**Timer Stopped:**
```json
{
  "event": "time_entry.stopped",
  "data": { "id": "uuid", "duration_minutes": 120, "billable_amount": 300 }
}
```

---

## Summary

**Total Endpoints:** 16
- Task CRUD: 6 endpoints
- Timer Operations: 7 endpoints
- RPC Functions: 3 functions

**Key Features:**
- Idempotent timer start (prevents duplicates)
- Atomic timer stop + customer_sales creation
- Concurrency control (one active timer per staff)
- Calculated fields (duration, billable amount)
- Organization-scoped access via RLS + HMAC auth
