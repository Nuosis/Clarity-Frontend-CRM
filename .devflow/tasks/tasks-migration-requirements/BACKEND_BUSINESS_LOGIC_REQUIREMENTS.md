# Backend Business Logic Requirements

**Document Version:** 1.0
**Last Updated:** 2026-01-10
**Status:** Draft - Pending Backend Team Review

## Document Purpose

This document specifies the server-side validation rules, business logic, state machine enforcement, and data processing requirements that must be implemented in the backend API for the tasks and timer system migration from FileMaker to Supabase.

**Important:** This is a requirements specification document only. No backend infrastructure modifications should be made without formal backend team approval through the Backend Change Protocol (see CLAUDE.md).

---

## Table of Contents

1. [Server-Side Validation Rules](#1-server-side-validation-rules)
2. [Timer State Machine Enforcement](#2-timer-state-machine-enforcement)
3. [Financial Record Generation Rules](#3-financial-record-generation-rules)
4. [Fixed-Price Project Handling](#4-fixed-price-project-handling)
5. [Business Rule Orchestration](#5-business-rule-orchestration)
6. [Data Integrity Requirements](#6-data-integrity-requirements)
7. [Error Handling Requirements](#7-error-handling-requirements)
8. [Performance Requirements](#8-performance-requirements)
9. [Audit and Compliance](#9-audit-and-compliance)
10. [Migration Considerations](#10-migration-considerations)

---

## 1. Server-Side Validation Rules

### 1.1 Task Validation Rules

All task creation and update operations MUST enforce the following validation rules on the server side, mirroring the frontend validation defined in `src/services/taskService.js:265-305`.

#### 1.1.1 Required Fields Validation

**Task Name (`task` field)**
- **Rule:** MUST be present and non-empty after trimming whitespace
- **Type:** String
- **Min Length:** 1 character
- **Max Length:** 200 characters
- **Error Code:** `TASK_NAME_REQUIRED` or `TASK_NAME_TOO_LONG`
- **Current Implementation:** `taskService.js:272-276`

```javascript
// Frontend validation logic (reference only)
validate: (value) => {
    if (!value?.trim()) return 'Task name is required';
    if (value.length > 200) return 'Task name must be less than 200 characters';
    return null;
}
```

**Backend Requirements:**
1. Strip leading/trailing whitespace before validation
2. Reject requests with empty or whitespace-only task names
3. Enforce 200 character maximum on database column AND application layer
4. Return HTTP 400 with structured error response

**Project ID (`_projectID` or `project_id`)**
- **Rule:** MUST be present on task creation (required for new tasks)
- **Type:** UUID (String)
- **Validation:** Must reference an existing project in the `projects` table
- **Error Code:** `PROJECT_ID_REQUIRED` or `PROJECT_NOT_FOUND`
- **Current Implementation:** `taskService.js:278-282`

**Backend Requirements:**
1. Verify project exists via foreign key constraint + explicit check
2. For updates, project_id is immutable (cannot be changed after creation)
3. Return HTTP 400 if project_id missing on create
4. Return HTTP 404 if project_id references non-existent project

**Staff ID (`_staffID` or `staff_id`)**
- **Rule:** MUST be present on task creation
- **Type:** UUID (String)
- **Validation:** Must reference an existing staff member in the `staff` or `users` table
- **Error Code:** `STAFF_ID_REQUIRED` or `STAFF_NOT_FOUND`
- **Current Implementation:** `taskService.js:283-287`

**Backend Requirements:**
1. Verify staff exists via foreign key constraint + explicit check
2. Staff assignment can be changed via updates (mutable field)
3. Return HTTP 400 if staff_id missing on create
4. Return HTTP 404 if staff_id references non-existent staff member

#### 1.1.2 Optional Fields Validation

**Completion Status (`f_completed` or `is_completed`)**
- **Type:** Boolean (stored as integer 0/1 in FileMaker, boolean true/false in Supabase)
- **Valid Values:** 0 or 1 (FileMaker), true or false (Supabase)
- **Default Value:** `false` (0)
- **Error Code:** `INVALID_COMPLETION_STATUS`
- **Current Implementation:** `taskService.js:289-296`

**Backend Requirements:**
1. Accept boolean values (true/false) from API requests
2. Coerce numeric 0/1 to boolean for backward compatibility with FileMaker
3. Reject any values other than true/false/0/1
4. Default to `false` if not provided on creation

**Priority (`f_priority` or `priority`)**
- **Type:** String
- **Valid Values:** `"active"`, `"high"`, `"low"`
- **Default Value:** `"active"`
- **Error Code:** `INVALID_PRIORITY_VALUE`
- **Current Implementation:** `taskService.js:297-305`

**Backend Requirements:**
1. Case-sensitive validation against allowed values
2. Reject any values outside the allowed set
3. Default to `"active"` if not provided
4. Consider enum type in database schema

**Task Type (`type`)**
- **Type:** String (optional)
- **Max Length:** 100 characters
- **Default Value:** Empty string or NULL
- **Current Implementation:** Referenced in `tasks.js:159` and `taskService.js:156`

**Backend Requirements:**
1. Allow NULL or empty string
2. Enforce maximum length if provided
3. No validation against specific values (free-form field)

#### 1.1.3 Validation Function Reference

The complete validation function is implemented in `src/services/taskService.js:315-376`:

```javascript
export function validateTaskData(data, { isUpdate = false, partial = false } = {}) {
    const errors = [];
    const fieldErrors = {};

    // Check if data is provided
    if (!data || typeof data !== 'object') {
        return {
            isValid: false,
            errors: ['Invalid task data provided'],
            fieldErrors: {}
        };
    }

    // Validate each field according to rules
    Object.entries(TASK_FIELDS).forEach(([field, rules]) => {
        // Skip validation for fields not provided in partial validation
        if (partial && !(field in data)) return;

        // Skip _projectID validation for updates
        if (isUpdate && field === '_projectID') return;

        const value = data[field];

        // Required field validation
        if (rules.required && !isUpdate && !partial) {
            if (value === undefined || value === null || value === '') {
                fieldErrors[field] = `${field} is required`;
                return;
            }
        }

        // Skip validation if value is not provided and field is optional
        if (!rules.required && (value === undefined || value === null)) return;

        // Type checking
        if (value !== undefined && value !== null) {
            if (typeof value !== rules.type) {
                fieldErrors[field] = `${field} must be a ${rules.type}`;
                return;
            }

            // Custom field validation
            if (rules.validate) {
                const validationError = rules.validate(value);
                if (validationError) {
                    fieldErrors[field] = validationError;
                }
            }
        }
    });

    // Add field errors to main errors array
    Object.values(fieldErrors).forEach(error => {
        errors.push(error);
    });

    return {
        isValid: errors.length === 0,
        errors,
        fieldErrors
    };
}
```

**Backend Implementation Requirements:**
1. Replicate this validation logic on the server side
2. Use the same error messages for consistency
3. Support both full validation (create) and partial validation (update)
4. Return structured error responses with field-level errors

---

### 1.2 Timer Validation Rules

#### 1.2.1 Timer Start Validation

**Task Association**
- **Rule:** Timer MUST be associated with a valid, existing task
- **Validation:** Task must exist and be accessible to the requesting user
- **Error Code:** `TASK_NOT_FOUND`
- **Current Implementation:** `tasks.js:121-178`, `taskService.js:512-518`

**Active Timer Check**
- **Rule:** Staff member MUST NOT have another active timer running
- **Validation:** Check for existing timer with status='active' for the same staff_id
- **Error Code:** `ACTIVE_TIMER_EXISTS`
- **Enforcement:** Database unique partial index `idx_one_active_timer_per_staff`
- **Current Implementation:** Frontend prevents this via `useTask.js:204-317`, backend must enforce

**Backend Requirements:**
1. Check for existing active timer BEFORE creating new timer
2. Use SELECT FOR UPDATE NOWAIT to prevent race conditions
3. Return HTTP 409 Conflict if active timer exists
4. Include details of existing active timer in error response

**Required Fields**
- `task_id`: UUID of the task
- `staff_id`: UUID of the staff member
- `project_id`: UUID of the project (denormalized for performance)
- `customer_id`: UUID of the customer (denormalized for performance)
- `start_time`: Timestamp when timer started (server-generated)
- `start_date`: Date when timer started (server-generated)

**Current Implementation:** `tasks.js:121-178`

#### 1.2.2 Timer Stop Validation

**Timer Existence**
- **Rule:** Timer record MUST exist and be in 'active' or 'paused' state
- **Error Code:** `TIMER_NOT_FOUND` or `INVALID_TIMER_STATE`
- **Current Implementation:** `tasks.js:189-213`, `taskService.js:530-543`

**State Validation**
- **Rule:** Cannot stop a timer that is already 'completed'
- **Validation:** Check timer status before processing stop
- **Error Code:** `TIMER_ALREADY_STOPPED`

**Time Adjustment Validation**
- **Rule:** Time adjustments MUST be in 6-minute increments (±6, ±12, ±18, etc.)
- **Validation:** `adjustment_seconds % 360 === 0`
- **Error Code:** `INVALID_TIME_ADJUSTMENT`
- **Current Implementation:** `taskService.js:619-622`, UI in `TaskTimer.jsx:261-281`

**Backend Requirements:**
1. Validate adjustment is multiple of 360 seconds (6 minutes)
2. Calculate final billable time: `(end_time - start_time - total_pause_duration + adjustment)`
3. Ensure final billable time is not negative (minimum 0)
4. Round billable hours to 2 decimal places for financial record generation

**Work Description**
- **Type:** String (optional)
- **Max Length:** 1000 characters
- **Default Value:** "Time logged" if `save_immediately` is true
- **Current Implementation:** `tasks.js:204`, frontend in `TaskTimer.jsx:294-303`

#### 1.2.3 Timer Pause/Resume Validation

**Note:** Pause logic is currently CLIENT-SIDE ONLY. The client tracks pause start time and total pause duration in localStorage, then sends the total pause duration when stopping the timer.

**Backend Requirements:**
1. Backend receives `total_pause_duration_seconds` as part of timer stop request
2. Validate `total_pause_duration_seconds >= 0`
3. Do NOT implement server-side pause state tracking (not in current spec)
4. Future enhancement: If server-side pause tracking is added, implement state validation

**Current Implementation:** `TaskTimer.jsx:172-199`, `useTask.js:237-275`

---

### 1.3 Financial Record Validation Rules

Financial records are generated when a timer is stopped (see Section 3 for complete business logic).

**Amount Calculation**
- **Formula:** `amount = billable_hours * hourly_rate`
- **Precision:** Round to 2 decimal places
- **Validation:** Amount MUST be >= 0
- **Error Code:** `INVALID_FINANCIAL_AMOUNT`

**Hourly Rate Retrieval**
- **Source:** `projects` table → `hourly_rate` field OR staff default rate
- **Fallback:** Use organization default rate if project/staff rate not defined
- **Validation:** Rate MUST be > 0
- **Error Code:** `HOURLY_RATE_NOT_FOUND`

**Customer Association**
- **Source:** Denormalized from timer record (`customer_id` field)
- **Validation:** Customer MUST exist in `customers` table
- **Error Code:** `CUSTOMER_NOT_FOUND`

**Product Name Generation**
- **Format:** `{CUSTOMER_CAPS}:{PROJECT_FIRST_WORD}`
- **Example:** `CBS:Website` for customer "Clarity Business Solutions" and project "Website Redesign"
- **Logic:** Extract capital letters and numbers from customer name + first word of project name
- **Current Implementation:** `financialSyncService.js:628-640`

```javascript
function formatProductName(customerName, projectName) {
  // Extract capital letters and numbers from customer name
  const customerNameFormatted = (customerName || '')
    .replace(/[^A-Z0-9]/g, '')  // Keep only capital letters and numbers
    .trim();

  // Get the first word of the project name
  const projectNameFirstWord = projectName ?
    projectName.split(' ')[0] : '';

  // Concatenate with a colon
  return `${customerNameFormatted}:${projectNameFirstWord}`;
}
```

**Backend Requirements:**
1. Implement identical product name formatting logic
2. Handle edge cases: empty customer name, empty project name, all-lowercase names
3. Ensure consistent formatting with existing FileMaker records

---

## 2. Timer State Machine Enforcement

### 2.1 State Definitions

The timer state machine has three states:

```
IDLE (not running)
   ↓
RUNNING (active timer)
   ↓ ↔ (pause/resume transitions)
PAUSED (paused timer)
   ↓
COMPLETED (timer stopped)
```

**State Representation:**
- **Database Column:** `status` (VARCHAR or ENUM)
- **Valid Values:**
  - `'idle'` - Timer has not been started (record does not exist)
  - `'active'` - Timer is currently running
  - `'paused'` - Timer is paused (CLIENT-SIDE ONLY in current implementation)
  - `'completed'` - Timer has been stopped and financial record generated

**Current Implementation:** Documented in `TIMER_LIFECYCLE_STATE_MACHINE.md`

### 2.2 State Transition Rules

#### 2.2.1 Valid State Transitions

| Current State | Action | Next State | Backend Validation Required |
|---------------|--------|------------|----------------------------|
| IDLE (no record) | `start` | RUNNING | ✅ Check no active timer exists for staff |
| RUNNING | `stop` | COMPLETED | ✅ Validate timer exists and is active |
| RUNNING | `pause` | PAUSED | ⚠️ CLIENT-SIDE ONLY (not in current backend spec) |
| PAUSED | `resume` | RUNNING | ⚠️ CLIENT-SIDE ONLY (not in current backend spec) |
| PAUSED | `stop` | COMPLETED | ✅ Validate timer exists (if pause implemented) |

#### 2.2.2 Invalid State Transitions (Must Reject)

| Current State | Invalid Action | Error Code | HTTP Status |
|---------------|----------------|------------|-------------|
| IDLE | `stop`, `pause`, `resume` | `TIMER_NOT_FOUND` | 404 |
| RUNNING | `start` | `ACTIVE_TIMER_EXISTS` | 409 |
| COMPLETED | Any action | `TIMER_ALREADY_STOPPED` | 400 |
| PAUSED | `start` | `ACTIVE_TIMER_EXISTS` | 409 |

**Backend Requirements:**
1. Reject state transitions not listed in valid transitions table
2. Use database constraints to prevent invalid states:
   - CHECK constraint on `status` column
   - Unique partial index to prevent duplicate active timers
   - Foreign key constraints to ensure task/project/customer exist
3. Use optimistic locking (SELECT FOR UPDATE NOWAIT) to prevent race conditions
4. Return descriptive error messages with current state and attempted action

### 2.3 State Machine Enforcement Logic

#### 2.3.1 Timer Start Enforcement

**Preconditions:**
1. Task exists and is not completed
2. Staff has permission to work on the task
3. No active timer exists for the staff member
4. Project and customer exist

**Enforcement Steps:**
```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Step 1: Check for existing active timer (with lock)
SELECT id FROM task_timers
WHERE staff_id = :staff_id
  AND status IN ('active', 'paused')
FOR UPDATE NOWAIT;

-- If record found, ROLLBACK and return 409 ACTIVE_TIMER_EXISTS

-- Step 2: Validate task, project, customer exist
SELECT t.id, t.project_id, p.customer_id, p.hourly_rate
FROM tasks t
JOIN projects p ON t.project_id = p.id
WHERE t.id = :task_id
  AND t.is_completed = false
FOR SHARE;

-- If not found, ROLLBACK and return 404 TASK_NOT_FOUND

-- Step 3: Create timer record
INSERT INTO task_timers (
  id, task_id, staff_id, project_id, customer_id,
  start_time, start_date, status, created_at, updated_at
) VALUES (
  gen_random_uuid(), :task_id, :staff_id, :project_id, :customer_id,
  NOW(), CURRENT_DATE, 'active', NOW(), NOW()
)
RETURNING *;

COMMIT;
```

**Error Handling:**
- `LOCK_TIMEOUT` or `NOWAIT` violation → Return HTTP 423 Locked (retry after 1-5 seconds)
- Constraint violation → Return HTTP 400 Bad Request
- Foreign key violation → Return HTTP 404 Not Found

**Current Frontend Implementation:** `useTask.js:204-236`, `tasks.js:121-178`

#### 2.3.2 Timer Stop Enforcement

**Preconditions:**
1. Timer exists and is in 'active' or 'paused' state
2. Timer belongs to the requesting staff member (authorization check)
3. Project is not fixed-price OR fixed-price but financial record should not be created

**Enforcement Steps:**
```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Step 1: Lock and retrieve timer with project info
SELECT tt.*, p.is_fixed_price, p.hourly_rate, p.project_name,
       c.business_name as customer_name
FROM task_timers tt
JOIN projects p ON tt.project_id = p.id
JOIN customers c ON tt.customer_id = c.id
WHERE tt.id = :timer_id
  AND tt.status IN ('active', 'paused')
FOR UPDATE NOWAIT;

-- If not found or wrong status, ROLLBACK and return error

-- Step 2: Calculate billable time
SET @billable_seconds = EXTRACT(EPOCH FROM (NOW() - start_time))
                        - :total_pause_duration_seconds
                        + :adjustment_seconds;
SET @billable_hours = ROUND(@billable_seconds / 3600.0, 2);

-- Ensure non-negative
IF @billable_hours < 0 THEN
  SET @billable_hours = 0;
END IF;

-- Step 3: Update timer record
UPDATE task_timers
SET status = 'completed',
    end_time = NOW(),
    work_description = :work_description,
    total_pause_duration_seconds = :total_pause_duration_seconds,
    adjustment_seconds = :adjustment_seconds,
    billable_hours = @billable_hours,
    updated_at = NOW()
WHERE id = :timer_id;

-- Step 4: Generate financial record (if NOT fixed-price project)
IF NOT is_fixed_price THEN
  SET @amount = ROUND(@billable_hours * hourly_rate, 2);
  SET @product_name = format_product_name(customer_name, project_name);

  INSERT INTO customer_sales (
    id, financial_id, customer_id, organization_id, product_name,
    quantity, unit_price, total_price, date, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), :timer_id, :customer_id, :organization_id, @product_name,
    @billable_hours, hourly_rate, @amount, CURRENT_DATE, NOW(), NOW()
  );
END IF;

COMMIT;
```

**Error Handling:**
- Timer not found → HTTP 404 Not Found
- Invalid state → HTTP 400 Bad Request
- Lock timeout → HTTP 423 Locked
- Constraint violation → HTTP 400 Bad Request

**Current Frontend Implementation:** `useTask.js:277-317`, `taskService.js:67-131`, `tasks.js:189-213`

### 2.4 Concurrency Control

#### 2.4.1 Optimistic Locking Strategy

**Problem:** Multiple requests could attempt to start/stop the same timer simultaneously.

**Solution:**
1. Use `SELECT FOR UPDATE NOWAIT` for all timer operations
2. Set lock timeout to 5 seconds maximum
3. Return HTTP 423 Locked if lock cannot be acquired
4. Client should retry with exponential backoff (1s, 2s, 4s)

**Implementation:**
```sql
-- PostgreSQL configuration
SET lock_timeout = '5s';

-- In transaction
SELECT * FROM task_timers
WHERE id = :timer_id
FOR UPDATE NOWAIT;
```

#### 2.4.2 Unique Constraint Enforcement

**Constraint:** Only one active timer per staff member at any time.

**Implementation:**
```sql
-- Partial unique index (only active/paused timers)
CREATE UNIQUE INDEX idx_one_active_timer_per_staff
ON task_timers (staff_id)
WHERE status IN ('active', 'paused');
```

**Error Handling:**
- Constraint violation on INSERT → HTTP 409 Conflict
- Error message: "Staff member already has an active timer running"
- Include details of existing timer in response

**Reference:** Specified in `BACKEND_CHANGE_REQUEST_002_TIMER_OPERATIONS.md`

### 2.5 Idempotency Requirements

#### 2.5.1 Idempotency Keys

**Requirement:** Timer start/stop operations MUST be idempotent to handle retries.

**Implementation:**
1. Client generates UUID `idempotency_key` for each request
2. Backend stores key in `api_idempotency_keys` table with 24-hour TTL
3. If duplicate key received, return cached response (200 OK with original result)
4. If key not found, process request and cache response

**Table Schema:**
```sql
CREATE TABLE api_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key UUID NOT NULL UNIQUE,
  request_path VARCHAR(500) NOT NULL,
  request_method VARCHAR(10) NOT NULL,
  response_status INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX idx_idempotency_expiry ON api_idempotency_keys (expires_at);
```

**Backend Logic:**
```python
def handle_idempotent_request(idempotency_key, request_func):
    # Check cache
    cached = db.query("""
        SELECT response_status, response_body
        FROM api_idempotency_keys
        WHERE idempotency_key = %s
          AND expires_at > NOW()
    """, [idempotency_key])

    if cached:
        return (cached.response_status, cached.response_body)

    # Process request
    status, body = request_func()

    # Cache response
    db.execute("""
        INSERT INTO api_idempotency_keys
        (idempotency_key, request_path, request_method, response_status, response_body)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (idempotency_key) DO NOTHING
    """, [idempotency_key, request.path, request.method, status, json.dumps(body)])

    return (status, body)
```

**Reference:** Specified in `BACKEND_CHANGE_REQUEST_002_TIMER_OPERATIONS.md`

---

## 3. Financial Record Generation Rules

### 3.1 Financial Record Creation Trigger

**Trigger Event:** Timer stop operation completes successfully

**Condition:** Financial record is created ONLY IF:
1. Timer stop operation succeeded (timer status = 'completed')
2. Project is NOT a fixed-price project (`is_fixed_price = false`)
3. Billable hours > 0 (no record for zero-time entries)
4. Customer exists and is linked to organization

**Current Implementation:** `taskService.js:104-111` (fixed-price detection)

```javascript
// Check if this is a fixed-price project
const fixedPrice = parseFloat(financialRecord.response.data[0].fieldData["customers_Projects::f_fixedPrice"] || 0);
console.log(`Project fixed price value: ${fixedPrice}`);

if (fixedPrice > 0) {
    console.log('Skipping sales record creation for fixed-price project');
    financialId = null; // Prevent sales record creation
}
```

### 3.2 Financial Record Data Mapping

#### 3.2.1 Source Data (from Timer Record)

```javascript
// Timer record fields (from task_timers table)
{
  id: UUID,                              // Timer record ID (used as financial_id)
  task_id: UUID,
  staff_id: UUID,
  project_id: UUID,
  customer_id: UUID,
  start_time: TIMESTAMPTZ,
  end_time: TIMESTAMPTZ,
  billable_hours: DECIMAL(10,2),         // Calculated: (end - start - pause + adjust) / 3600
  hourly_rate: DECIMAL(10,2),            // From projects table
  work_description: TEXT,
  adjustment_seconds: INTEGER,
  total_pause_duration_seconds: INTEGER
}

// Related data (from JOINs)
{
  customer_name: STRING,                 // From customers.business_name
  project_name: STRING,                  // From projects.project_name
  is_fixed_price: BOOLEAN,               // From projects.is_fixed_price
  organization_id: UUID                  // From projects.organization_id OR user context
}
```

#### 3.2.2 Target Data (customer_sales table)

```sql
-- Table: customer_sales
CREATE TABLE customer_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_id UUID UNIQUE,                      -- Maps to timer record ID
  customer_id UUID NOT NULL REFERENCES customers(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  product_id UUID REFERENCES products(id),       -- NULL for time entries
  product_name VARCHAR(255) NOT NULL,            -- Generated: "CBS:Website"
  quantity DECIMAL(10,2) NOT NULL,               -- Billable hours
  unit_price DECIMAL(10,2) NOT NULL,             -- Hourly rate
  total_price DECIMAL(10,2) NOT NULL,            -- quantity * unit_price
  date DATE NOT NULL,                            -- Date of timer stop (CURRENT_DATE)
  inv_id UUID REFERENCES invoices(id),           -- NULL initially, set when invoiced
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Field Mapping:**

| customer_sales Column | Source | Calculation/Logic | Example Value |
|-----------------------|--------|-------------------|---------------|
| `id` | Generated | `gen_random_uuid()` | `"550e8400-..."` |
| `financial_id` | `task_timers.id` | Direct copy | `"660e8400-..."` |
| `customer_id` | `task_timers.customer_id` | Direct copy | `"770e8400-..."` |
| `organization_id` | User context or `projects.organization_id` | Lookup | `"880e8400-..."` |
| `product_id` | NULL | Time entries don't link to products | `NULL` |
| `product_name` | Generated | `formatProductName(customer_name, project_name)` | `"CBS:Website"` |
| `quantity` | `task_timers.billable_hours` | Rounded to 2 decimals | `2.50` |
| `unit_price` | `projects.hourly_rate` | Lookup from projects table | `150.00` |
| `total_price` | Calculated | `ROUND(quantity * unit_price, 2)` | `375.00` |
| `date` | `CURRENT_DATE` | Date of timer stop | `"2026-01-10"` |
| `inv_id` | NULL | Set later when invoice generated | `NULL` |
| `created_at` | `NOW()` | Timestamp of record creation | `"2026-01-10T15:30:00Z"` |
| `updated_at` | `NOW()` | Timestamp of record creation | `"2026-01-10T15:30:00Z"` |

**Current Implementation:** `salesService.js:createSaleFromFinancialRecord()`, `financialSyncService.js:461-498`

### 3.3 Billable Hours Calculation

**Formula:**
```javascript
billable_seconds = (end_time - start_time) - total_pause_duration_seconds + adjustment_seconds
billable_hours = ROUND(billable_seconds / 3600.0, 2)
billable_hours = MAX(billable_hours, 0)  // Never negative
```

**Precision Requirements:**
1. Calculate billable seconds as integer (no fractional seconds)
2. Convert to hours by dividing by 3600.0 (float division)
3. Round to 2 decimal places using banker's rounding (ROUND HALF TO EVEN)
4. Minimum value: 0 (never negative even with large pause/adjustment)

**Edge Cases:**
- **Zero or negative time:** If calculation results in ≤0, set billable_hours to 0
- **Large adjustments:** Validate adjustment doesn't exceed elapsed time by more than 100% (anti-fraud)
- **Pause exceeds runtime:** If pause > elapsed time, treat as data error but allow (set billable to 0)

**Example Calculations:**

```javascript
// Example 1: Normal timer (2 hours, no pause, no adjustment)
start_time = "2026-01-10 14:00:00"
end_time = "2026-01-10 16:00:00"
pause = 0
adjustment = 0
billable_seconds = (7200 - 0 + 0) = 7200
billable_hours = 7200 / 3600 = 2.00

// Example 2: Timer with pause (3 hours, 30 min pause, no adjustment)
start_time = "2026-01-10 14:00:00"
end_time = "2026-01-10 17:00:00"
pause = 1800  // 30 minutes
adjustment = 0
billable_seconds = (10800 - 1800 + 0) = 9000
billable_hours = 9000 / 3600 = 2.50

// Example 3: Timer with adjustment (1 hour, no pause, +6 min adjustment)
start_time = "2026-01-10 14:00:00"
end_time = "2026-01-10 15:00:00"
pause = 0
adjustment = 360  // +6 minutes
billable_seconds = (3600 - 0 + 360) = 3960
billable_hours = 3960 / 3600 = 1.10

// Example 4: Timer with negative adjustment (2 hours, no pause, -12 min adjustment)
start_time = "2026-01-10 14:00:00"
end_time = "2026-01-10 16:00:00"
pause = 0
adjustment = -720  // -12 minutes
billable_seconds = (7200 - 0 - 720) = 6480
billable_hours = 6480 / 3600 = 1.80
```

**Backend Requirements:**
1. Implement exact same calculation logic as frontend
2. Store billable_hours in task_timers table (denormalized for audit)
3. Recalculate in financial record generation (double-check)
4. Log warning if recalculation differs from stored value

**Current Implementation:** Timer calculation logic in `TaskTimer.jsx:141-169`, `useTask.js:277-317`

### 3.4 Hourly Rate Resolution

**Rate Priority (in order):**
1. **Project-specific rate:** `projects.hourly_rate` (if set and > 0)
2. **Staff default rate:** `staff.default_hourly_rate` or `users.hourly_rate` (if set and > 0)
3. **Organization default rate:** `organizations.default_hourly_rate` (if set and > 0)
4. **System fallback:** Return error if no rate found (do not assume a rate)

**Backend Logic:**
```sql
SELECT
  COALESCE(
    NULLIF(p.hourly_rate, 0),
    NULLIF(s.default_hourly_rate, 0),
    NULLIF(o.default_hourly_rate, 0)
  ) as effective_rate
FROM projects p
LEFT JOIN staff s ON s.id = :staff_id
LEFT JOIN organizations o ON o.id = p.organization_id
WHERE p.id = :project_id;
```

**Error Handling:**
- If `effective_rate` is NULL → Return HTTP 400 with error code `HOURLY_RATE_NOT_FOUND`
- Error message: "No hourly rate configured for project, staff, or organization"

**Current Implementation:** Rate is retrieved from FileMaker `devRecords` layout via calculated field `Hourly_Rate`, see `billableHoursService.js:93`

### 3.5 Product Name Formatting Logic

**Format:** `{CUSTOMER_CAPS}:{PROJECT_FIRST_WORD}`

**Algorithm:**
```javascript
function formatProductName(customerName, projectName) {
  // Step 1: Extract capital letters and numbers from customer name
  const customerCaps = (customerName || '')
    .replace(/[^A-Z0-9]/g, '')  // Remove all characters except A-Z and 0-9
    .trim();

  // Step 2: Extract first word of project name
  const projectFirstWord = (projectName || '')
    .split(/\s+/)  // Split on whitespace
    .filter(word => word.length > 0)  // Remove empty strings
    [0] || '';      // Take first word, or empty string if none

  // Step 3: Concatenate with colon
  return `${customerCaps}:${projectFirstWord}`;
}
```

**Examples:**

| Customer Name | Project Name | Product Name | Explanation |
|---------------|--------------|--------------|-------------|
| `"Clarity Business Solutions"` | `"Website Redesign"` | `"CBS:Website"` | CBS from capitals, Website is first word |
| `"ABC Corp"` | `"Mobile App Development"` | `"ABC:Mobile"` | ABC from capitals + number, Mobile is first word |
| `"123 Industries"` | `"Portal Enhancement"` | `"123:Portal"` | 123 extracted (number), Portal is first word |
| `"john's bakery"` | `"logo design"` | `":logo"` | No capitals (all lowercase), logo is first word |
| `"ACME Inc."` | `""` | `"ACME:"` | ACME from capitals, no project name |
| `""` | `"Website"` | `":Website"` | No customer name, Website is project |

**Edge Case Handling:**
- **All-lowercase customer name:** Results in empty customer part (e.g., `":ProjectName"`)
- **Empty project name:** Results in empty project part (e.g., `"CUST:"`)
- **Both empty:** Results in `":"`
- **Multi-word project with punctuation:** Only first word is used, punctuation ignored

**Backend Requirements:**
1. Implement identical formatting logic
2. Do NOT throw error on edge cases (allow empty parts)
3. Ensure consistent behavior with existing FileMaker records
4. Consider caching formatted product names in `projects` table for performance

**Current Implementation:** `financialSyncService.js:628-640`

### 3.6 Transaction Atomicity

**Requirement:** Timer stop + financial record creation MUST be atomic (all-or-nothing).

**Implementation:**
```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Step 1: Update timer record (with lock)
UPDATE task_timers SET ... WHERE id = :timer_id;

-- Step 2: Create financial record (if not fixed-price)
IF NOT is_fixed_price THEN
  INSERT INTO customer_sales (...) VALUES (...);
END IF;

-- Step 3: Update task actual_hours (optional, denormalized)
UPDATE tasks
SET actual_hours = actual_hours + :billable_hours
WHERE id = :task_id;

COMMIT;
```

**Rollback Scenarios:**
1. If financial record insert fails → Rollback timer update
2. If transaction timeout → Rollback entire operation
3. If constraint violation → Rollback entire operation

**Error Reporting:**
- Return HTTP 500 Internal Server Error
- Log detailed error with timer_id, customer_id, organization_id for investigation
- Do NOT leave timer in 'completed' state if financial record creation failed

**Current Implementation:** FileMaker handles this via script steps, see timer stop flow in `tasks.js:189-213`

---

## 4. Fixed-Price Project Handling

### 4.1 Fixed-Price Project Detection

**Field:** `projects.is_fixed_price` (boolean) or `projects.f_fixedPrice` (integer 0/1 in FileMaker)

**Detection Logic:**
```sql
SELECT is_fixed_price
FROM projects
WHERE id = :project_id;
```

**FileMaker Equivalent:**
```javascript
// Current implementation: taskService.js:104-111
const fixedPrice = parseFloat(
  financialRecord.response.data[0].fieldData["customers_Projects::f_fixedPrice"] || 0
);

if (fixedPrice > 0) {
  console.log('Skipping sales record creation for fixed-price project');
  financialId = null; // Prevent sales record creation
}
```

**Backend Requirements:**
1. Check `is_fixed_price` flag BEFORE creating financial record
2. Boolean check: `if (is_fixed_price === true)` (not just truthy)
3. FileMaker migration: Convert integer 1 → boolean true, 0 → boolean false
4. Cache project fixed-price status in timer record for audit trail

### 4.2 Fixed-Price Business Rules

#### 4.2.1 Timer Recording

**Rule:** Timers ARE recorded for fixed-price projects (for tracking/reporting).

**Implementation:**
- Timer start/stop works normally
- Billable hours are calculated and stored
- Timer records are created in `task_timers` table
- Work description is captured

**Rationale:** Hours are tracked for project management and profitability analysis, even though they're not billed hourly.

#### 4.2.2 Financial Record Generation

**Rule:** Financial records are NOT generated from timers for fixed-price projects.

**Implementation:**
```python
def stop_timer(timer_id, ...):
    # ... stop timer and calculate billable hours ...

    # Check if project is fixed-price
    project = db.query("SELECT is_fixed_price FROM projects WHERE id = %s", [project_id])

    if project.is_fixed_price:
        # Log for audit
        logger.info(f"Skipping financial record for fixed-price project: {project_id}")

        # Return timer record only (no financial record)
        return {
            "timer": timer_record,
            "financial_record": None,
            "skip_reason": "fixed_price_project"
        }
    else:
        # Create financial record
        financial_record = create_customer_sale(...)
        return {
            "timer": timer_record,
            "financial_record": financial_record
        }
```

#### 4.2.3 Revenue Recognition

**Rule:** Revenue for fixed-price projects is recognized based on milestone payments, NOT hourly billing.

**Implementation:** Fixed-price revenue is recorded via separate mechanism:
1. **Project start (50%):** Manual entry or automated on `project.date_start`
2. **Project completion (50%):** Manual entry or automated on `project.date_end`
3. Recorded directly in `customer_sales` with `product_name` like `"CUST:ProjectName (50% milestone)"`

**Current Implementation:** `projectService.js:508-549` (processProjectValue function)

```javascript
// Process fixed price projects
if (project.f_fixedPrice) {
    result.billableStatus = false; // All hours are non-billable for fixed price projects

    // Check if project has a start date
    if (project.dateStart) {
        const startDate = new Date(project.dateStart);
        const today = new Date();

        // Only process if the start date is today or in the past
        if (startDate <= today) {
            // Add half the value to "sellable" when the project is started
            result.salesToCreate.push({
                customer_id: project._custID,
                amount: project.value / 2,
                date: project.dateStart,
                description: `Fixed price project (${project.projectName}) - 50% on start`,
                project_id: project.id || project.__ID,
                type: 'sellable'
            });
        }
    }

    // Check if project has an end date
    if (project.dateEnd) {
        const endDate = new Date(project.dateEnd);
        const today = new Date();

        // Only process if the end date is today or in the past
        if (endDate <= today) {
            // Add remaining half of the value to "sales" when the project is concluded
            result.salesToCreate.push({
                customer_id: project._custID,
                amount: project.value / 2,
                date: project.dateEnd,
                description: `Fixed price project (${project.projectName}) - 50% on completion`,
                project_id: project.id || project.__ID,
                type: 'sales'
            });
        }
    }
}
```

**Backend Requirements:**
1. Implement project milestone revenue recognition separately from timer-based billing
2. Do NOT mix fixed-price revenue with hourly billing in the same financial records
3. Include project type indicator in `customer_sales` records (e.g., `record_type: 'milestone'` vs `'hourly'`)

### 4.3 Fixed-Price Project Reporting

**Requirement:** Hours worked on fixed-price projects must be tracked for profitability analysis.

**Metrics to Calculate:**
1. **Total hours worked:** Sum of all `billable_hours` from `task_timers` for project
2. **Estimated hours:** From `projects.estimated_hours` field
3. **Hours remaining:** `estimated_hours - total_hours_worked`
4. **Budget status:** `(total_hours_worked / estimated_hours) * 100`%
5. **Profitability:** `(fixed_price_amount - (total_hours_worked * average_cost_per_hour))`

**Backend API Requirements:**
1. Provide endpoint: `GET /api/projects/{project_id}/hours-summary`
2. Return JSON with total hours, estimated hours, budget status
3. Include breakdown by staff member
4. Cache results with 5-minute TTL for performance

**Current Implementation:** Hours are visible in UI via `ProjectCard.jsx:76-125`, stats calculated from timer records

---

## 5. Business Rule Orchestration

### 5.1 Timer Stop Orchestration

**Complete Flow:**

```mermaid
graph TD
    A[Client: POST /api/tasks/{id}/timer/stop] --> B[Validate Request]
    B --> C{Timer Exists & Active?}
    C -->|No| D[Return 404 or 400]
    C -->|Yes| E[Lock Timer Record]
    E --> F[Calculate Billable Hours]
    F --> G[Update Timer Status=completed]
    G --> H{Is Fixed-Price Project?}
    H -->|Yes| I[Skip Financial Record]
    H -->|No| J[Retrieve Hourly Rate]
    J --> K[Format Product Name]
    K --> L[Create customer_sales Record]
    L --> M[Commit Transaction]
    M --> N[Return Timer + Financial Record]
    I --> O[Commit Transaction]
    O --> P[Return Timer Only]
```

**Orchestration Requirements:**

1. **Single Transaction:** All operations in one SERIALIZABLE transaction
2. **Fail Fast:** Validate all inputs before modifying any data
3. **Partial Rollback:** Use savepoints if needed for complex operations
4. **Audit Logging:** Log all state transitions and business rule decisions
5. **Performance:** Complete in <500ms P95 (excluding DB lock wait time)

### 5.2 Business Rule Decision Points

#### 5.2.1 Should Create Financial Record?

**Decision Tree:**
```
IF timer.status NOT IN ('active', 'paused')
  THEN REJECT (Invalid State)

IF billable_hours <= 0
  THEN SKIP (No Time Billed)

IF project.is_fixed_price = true
  THEN SKIP (Fixed-Price Project)

IF hourly_rate <= 0 OR hourly_rate IS NULL
  THEN ERROR (Rate Not Configured)

ELSE
  CREATE financial record
```

**Logging Requirements:**
- Log decision reason for every timer stop
- Include: timer_id, project_id, decision (CREATE/SKIP/ERROR), reason
- Example: `"Timer abc123: SKIP - Fixed-price project xyz789"`

#### 5.2.2 Should Allow Timer Start?

**Decision Tree:**
```
IF task.is_completed = true
  THEN REJECT (Task Already Completed)

IF EXISTS (active timer for staff)
  THEN REJECT (Active Timer Exists)

IF NOT EXISTS (project)
  THEN REJECT (Project Not Found)

IF NOT authorized(user, task)
  THEN REJECT (Unauthorized)

ELSE
  CREATE timer
```

### 5.3 Retry and Recovery Logic

#### 5.3.1 Client Retry Strategy

**For Transient Errors (423 LOCKED, 503 Service Unavailable):**
```javascript
const retryConfig = {
  maxRetries: 3,
  baseDelay: 1000,  // 1 second
  backoffMultiplier: 2,
  jitter: 0.1       // ±10% randomization
};

async function stopTimerWithRetry(timerId, params) {
  let attempt = 0;
  while (attempt < retryConfig.maxRetries) {
    try {
      return await api.stopTimer(timerId, params);
    } catch (error) {
      if (error.status === 423 || error.status === 503) {
        attempt++;
        const delay = retryConfig.baseDelay
                      * Math.pow(retryConfig.backoffMultiplier, attempt - 1)
                      * (1 + (Math.random() * 2 - 1) * retryConfig.jitter);
        await sleep(delay);
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded');
}
```

**Backend Requirements:**
1. Return HTTP 423 Locked (not 409) for lock timeouts
2. Include `Retry-After` header with suggested delay in seconds
3. Preserve idempotency key across retries
4. Log retry attempts with original request ID

#### 5.3.2 Partial Failure Recovery

**Scenario:** Timer updated but financial record creation failed.

**Prevention:**
1. Use SERIALIZABLE transaction isolation
2. SET TRANSACTION DEFERRABLE to avoid serialization failures
3. Implement savepoints for complex multi-step operations

**Recovery (if prevention fails):**
```sql
-- Rollback transaction on any error
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

SAVEPOINT timer_update;
UPDATE task_timers SET status = 'completed', ...;

SAVEPOINT financial_record;
INSERT INTO customer_sales (...) VALUES (...);

-- If financial insert fails, rollback everything (not just to savepoint)
ROLLBACK;  -- Rollback entire transaction, not just to savepoint
```

**Compensating Transaction (manual recovery):**
```sql
-- If timer is in 'completed' but no financial record exists (data inconsistency)
SELECT tt.id, tt.billable_hours, p.is_fixed_price
FROM task_timers tt
JOIN projects p ON tt.project_id = p.id
WHERE tt.status = 'completed'
  AND tt.id NOT IN (SELECT financial_id FROM customer_sales WHERE financial_id IS NOT NULL)
  AND p.is_fixed_price = false
  AND tt.billable_hours > 0;

-- Create missing financial records manually
-- (This should be a rare manual intervention operation)
```

---

## 6. Data Integrity Requirements

### 6.1 Referential Integrity

**Foreign Key Constraints:**

```sql
-- task_timers table
ALTER TABLE task_timers
  ADD CONSTRAINT fk_task_timers_task
    FOREIGN KEY (task_id) REFERENCES tasks(id)
    ON DELETE CASCADE,
  ADD CONSTRAINT fk_task_timers_staff
    FOREIGN KEY (staff_id) REFERENCES staff(id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT fk_task_timers_project
    FOREIGN KEY (project_id) REFERENCES projects(id)
    ON DELETE CASCADE,
  ADD CONSTRAINT fk_task_timers_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE RESTRICT;

-- customer_sales table
ALTER TABLE customer_sales
  ADD CONSTRAINT fk_customer_sales_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT fk_customer_sales_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT fk_customer_sales_financial
    FOREIGN KEY (financial_id) REFERENCES task_timers(id)
    ON DELETE SET NULL;
```

**Cascade Rules:**
- **Task deleted:** Cascade delete all associated timers (orphaned timers have no meaning)
- **Project deleted:** Cascade delete all associated timers
- **Staff deleted:** RESTRICT (prevent deletion if timers exist)
- **Customer deleted:** RESTRICT (prevent deletion if sales records exist)
- **Timer deleted:** SET NULL on financial_id in customer_sales (preserve sales record)

### 6.2 Data Consistency Constraints

**Check Constraints:**

```sql
-- task_timers table
ALTER TABLE task_timers
  ADD CONSTRAINT chk_timer_status
    CHECK (status IN ('active', 'paused', 'completed')),
  ADD CONSTRAINT chk_timer_times
    CHECK (end_time IS NULL OR end_time >= start_time),
  ADD CONSTRAINT chk_timer_billable_hours
    CHECK (billable_hours >= 0),
  ADD CONSTRAINT chk_timer_adjustment
    CHECK (adjustment_seconds % 360 = 0),  -- 6-minute increments
  ADD CONSTRAINT chk_timer_pause_duration
    CHECK (total_pause_duration_seconds >= 0);

-- customer_sales table
ALTER TABLE customer_sales
  ADD CONSTRAINT chk_sales_quantity
    CHECK (quantity >= 0),
  ADD CONSTRAINT chk_sales_unit_price
    CHECK (unit_price >= 0),
  ADD CONSTRAINT chk_sales_total_price
    CHECK (total_price >= 0),
  ADD CONSTRAINT chk_sales_total_calculation
    CHECK (ABS(total_price - (quantity * unit_price)) < 0.01);  -- Allow 1¢ rounding
```

### 6.3 Denormalization and Audit Trail

**Denormalized Fields (for audit and performance):**

| Table | Field | Source | Purpose |
|-------|-------|--------|---------|
| `task_timers` | `project_id` | From `tasks.project_id` | Avoid JOIN for financial record generation |
| `task_timers` | `customer_id` | From `projects.customer_id` | Avoid nested JOIN |
| `task_timers` | `billable_hours` | Calculated | Preserve calculation even if pause/adjustment changed |
| `task_timers` | `hourly_rate` | From `projects.hourly_rate` | Freeze rate at time of timer stop |
| `tasks` | `actual_hours` | SUM of `task_timers.billable_hours` | Quick access to total time |

**Update Triggers:**

```sql
-- Maintain tasks.actual_hours denormalized field
CREATE OR REPLACE FUNCTION update_task_actual_hours()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE tasks
    SET actual_hours = (
      SELECT COALESCE(SUM(billable_hours), 0)
      FROM task_timers
      WHERE task_id = NEW.task_id
        AND status = 'completed'
    )
    WHERE id = NEW.task_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE tasks
    SET actual_hours = (
      SELECT COALESCE(SUM(billable_hours), 0)
      FROM task_timers
      WHERE task_id = OLD.task_id
        AND status = 'completed'
    )
    WHERE id = OLD.task_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_task_actual_hours
AFTER INSERT OR UPDATE OR DELETE ON task_timers
FOR EACH ROW
EXECUTE FUNCTION update_task_actual_hours();
```

### 6.4 Data Validation Triggers

**Prevent Invalid States:**

```sql
-- Prevent updating completed timers
CREATE OR REPLACE FUNCTION prevent_completed_timer_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'completed' AND NEW.status != 'completed' THEN
    RAISE EXCEPTION 'Cannot modify a completed timer';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_completed_timer_update
BEFORE UPDATE ON task_timers
FOR EACH ROW
EXECUTE FUNCTION prevent_completed_timer_update();
```

---

## 7. Error Handling Requirements

### 7.1 Error Code Taxonomy

**Error Categories:**

| Category | HTTP Status | Code Prefix | Example |
|----------|-------------|-------------|---------|
| Validation Error | 400 | `VAL_` | `VAL_TASK_NAME_REQUIRED` |
| Not Found | 404 | `NOT_FOUND_` | `NOT_FOUND_TIMER` |
| Conflict | 409 | `CONFLICT_` | `CONFLICT_ACTIVE_TIMER_EXISTS` |
| Unauthorized | 403 | `AUTH_` | `AUTH_INSUFFICIENT_PERMISSIONS` |
| Locked | 423 | `LOCKED_` | `LOCKED_RESOURCE_BUSY` |
| Server Error | 500 | `ERR_` | `ERR_INTERNAL_SERVER_ERROR` |

### 7.2 Structured Error Responses

**Standard Error Response Format:**

```json
{
  "error": {
    "code": "CONFLICT_ACTIVE_TIMER_EXISTS",
    "message": "Staff member already has an active timer running",
    "details": {
      "staff_id": "abc-123",
      "existing_timer_id": "xyz-789",
      "existing_timer_task": "Fix login bug",
      "existing_timer_start_time": "2026-01-10T14:30:00Z"
    },
    "request_id": "req_550e8400e29b41d4a716446655440000",
    "timestamp": "2026-01-10T15:45:30Z"
  }
}
```

**Field Definitions:**
- `code`: Machine-readable error code (uppercase, underscores)
- `message`: Human-readable error message (sentence case, end with period)
- `details`: Additional context (optional, object with relevant data)
- `request_id`: Unique request identifier for debugging
- `timestamp`: ISO 8601 timestamp of error occurrence

### 7.3 Error Codes Specification

#### 7.3.1 Task Validation Errors (HTTP 400)

| Code | Message | Details |
|------|---------|---------|
| `VAL_TASK_NAME_REQUIRED` | Task name is required | `{ field: "task" }` |
| `VAL_TASK_NAME_TOO_LONG` | Task name must be less than 200 characters | `{ field: "task", max_length: 200, actual_length: X }` |
| `VAL_PROJECT_ID_REQUIRED` | Project ID is required | `{ field: "project_id" }` |
| `VAL_STAFF_ID_REQUIRED` | Staff ID is required | `{ field: "staff_id" }` |
| `VAL_INVALID_PRIORITY` | Invalid priority value | `{ field: "priority", valid_values: ["active", "high", "low"] }` |
| `VAL_INVALID_COMPLETION_STATUS` | Invalid completion status | `{ field: "is_completed", valid_values: [true, false] }` |

#### 7.3.2 Timer Validation Errors (HTTP 400)

| Code | Message | Details |
|------|---------|---------|
| `VAL_INVALID_TIME_ADJUSTMENT` | Time adjustment must be in 6-minute increments | `{ adjustment_seconds: X, valid_increments: [360, 720, ...] }` |
| `VAL_TIMER_ALREADY_STOPPED` | Timer has already been stopped | `{ timer_id: "...", status: "completed" }` |
| `VAL_INVALID_TIMER_STATE` | Timer is not in a valid state for this operation | `{ timer_id: "...", current_state: "...", required_state: "..." }` |

#### 7.3.3 Resource Not Found Errors (HTTP 404)

| Code | Message | Details |
|------|---------|---------|
| `NOT_FOUND_TASK` | Task not found | `{ task_id: "..." }` |
| `NOT_FOUND_TIMER` | Timer not found | `{ timer_id: "..." }` |
| `NOT_FOUND_PROJECT` | Project not found | `{ project_id: "..." }` |
| `NOT_FOUND_STAFF` | Staff member not found | `{ staff_id: "..." }` |
| `NOT_FOUND_CUSTOMER` | Customer not found | `{ customer_id: "..." }` |
| `NOT_FOUND_HOURLY_RATE` | No hourly rate configured for project, staff, or organization | `{ project_id: "...", staff_id: "...", organization_id: "..." }` |

#### 7.3.4 Conflict Errors (HTTP 409)

| Code | Message | Details |
|------|---------|---------|
| `CONFLICT_ACTIVE_TIMER_EXISTS` | Staff member already has an active timer running | `{ staff_id: "...", existing_timer_id: "...", existing_timer_task: "..." }` |
| `CONFLICT_DUPLICATE_TASK_NAME` | Task with same name already exists in project | `{ project_id: "...", task_name: "..." }` |

#### 7.3.5 Resource Locked Errors (HTTP 423)

| Code | Message | Details |
|------|---------|---------|
| `LOCKED_RESOURCE_BUSY` | Resource is currently locked by another operation | `{ resource_type: "timer", resource_id: "...", retry_after: 2 }` |
| `LOCKED_TIMEOUT` | Lock acquisition timed out | `{ timeout_seconds: 5 }` |

#### 7.3.6 Server Errors (HTTP 500)

| Code | Message | Details |
|------|---------|---------|
| `ERR_FINANCIAL_RECORD_FAILED` | Failed to create financial record | `{ timer_id: "...", reason: "..." }` |
| `ERR_DATABASE_ERROR` | Database operation failed | `{ operation: "...", error_code: "..." }` |
| `ERR_INTERNAL_SERVER_ERROR` | An unexpected error occurred | `{ request_id: "..." }` |

### 7.4 Error Logging Requirements

**Log Levels:**

| Level | When to Use | Example |
|-------|-------------|---------|
| `ERROR` | Unhandled exceptions, 500 errors | Database connection lost, unhandled exception |
| `WARN` | Business rule violations, expected errors | Fixed-price project skipped, hourly rate not found |
| `INFO` | Normal operations, state transitions | Timer started, timer stopped, financial record created |
| `DEBUG` | Detailed operation info | Billable hours calculation, product name formatting |

**Required Log Fields:**

```json
{
  "timestamp": "2026-01-10T15:45:30.123Z",
  "level": "ERROR",
  "message": "Failed to create financial record",
  "request_id": "req_550e8400e29b41d4a716446655440000",
  "user_id": "user_abc123",
  "organization_id": "org_xyz789",
  "operation": "timer_stop",
  "timer_id": "timer_def456",
  "error_code": "ERR_FINANCIAL_RECORD_FAILED",
  "error_message": "Constraint violation: customer_id does not exist",
  "stack_trace": "...",
  "context": {
    "project_id": "proj_ghi789",
    "customer_id": "cust_jkl012",
    "billable_hours": 2.5,
    "hourly_rate": 150.00
  }
}
```

---

## 8. Performance Requirements

### 8.1 Response Time Targets

| Operation | Target (P50) | Target (P95) | Target (P99) | Max Timeout |
|-----------|--------------|--------------|--------------|-------------|
| Create Task | 100ms | 200ms | 300ms | 5s |
| Update Task | 100ms | 200ms | 300ms | 5s |
| Start Timer | 150ms | 300ms | 500ms | 10s |
| Stop Timer | 200ms | 500ms | 1000ms | 30s |
| List Tasks | 150ms | 300ms | 500ms | 10s |
| Get Task Details | 100ms | 200ms | 300ms | 5s |

**Notes:**
- Excludes network latency (client to server)
- Includes database query time
- Measured from API endpoint entry to response sent

### 8.2 Database Query Optimization

**Required Indexes:**

```sql
-- task_timers table
CREATE INDEX idx_task_timers_task_id ON task_timers(task_id);
CREATE INDEX idx_task_timers_staff_id ON task_timers(staff_id);
CREATE INDEX idx_task_timers_project_id ON task_timers(project_id);
CREATE INDEX idx_task_timers_customer_id ON task_timers(customer_id);
CREATE INDEX idx_task_timers_start_time ON task_timers(start_time);
CREATE INDEX idx_task_timers_status ON task_timers(status);
CREATE UNIQUE INDEX idx_one_active_timer_per_staff
  ON task_timers(staff_id)
  WHERE status IN ('active', 'paused');

-- tasks table
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_staff_id ON tasks(staff_id);
CREATE INDEX idx_tasks_is_completed ON tasks(is_completed);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);

-- customer_sales table
CREATE INDEX idx_customer_sales_customer_id ON customer_sales(customer_id);
CREATE INDEX idx_customer_sales_organization_id ON customer_sales(organization_id);
CREATE INDEX idx_customer_sales_date ON customer_sales(date);
CREATE INDEX idx_customer_sales_financial_id ON customer_sales(financial_id);
```

### 8.3 Caching Strategy

**Cacheable Data:**

| Data Type | TTL | Invalidation Trigger |
|-----------|-----|----------------------|
| Project hourly rate | 5 minutes | Project update |
| Staff default rate | 5 minutes | Staff update |
| Organization default rate | 15 minutes | Organization update |
| Active timer for staff | 30 seconds | Timer start/stop |
| Task list for project | 1 minute | Task create/update/delete |

**Cache Implementation:**
- Use Redis for distributed caching (multiple backend instances)
- Use application-level caching (in-memory) for single-instance deployments
- Include cache version in key to support invalidation: `tasks:v1:{project_id}`

**Example Cache Key Patterns:**
```
timer:active:{staff_id}                  → Active timer record (30s TTL)
project:hourly_rate:{project_id}         → Hourly rate (5m TTL)
tasks:list:{project_id}                  → Task list (1m TTL)
customer:name:{customer_id}              → Customer name (15m TTL)
```

### 8.4 Database Connection Pooling

**Requirements:**
- Minimum pool size: 10 connections
- Maximum pool size: 50 connections
- Connection timeout: 5 seconds
- Idle connection timeout: 30 minutes
- Health check interval: 30 seconds

**Connection Pool Configuration (example for Python/SQLAlchemy):**
```python
engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=40,
    pool_timeout=5,
    pool_recycle=1800,
    pool_pre_ping=True
)
```

---

## 9. Audit and Compliance

### 9.1 Audit Trail Requirements

**Events to Log:**

| Event | Log Level | Required Fields |
|-------|-----------|-----------------|
| Task Created | INFO | user_id, task_id, project_id, task_name |
| Task Updated | INFO | user_id, task_id, changed_fields, old_values, new_values |
| Task Deleted | WARN | user_id, task_id, task_name, deletion_reason |
| Timer Started | INFO | user_id, timer_id, task_id, start_time |
| Timer Stopped | INFO | user_id, timer_id, task_id, end_time, billable_hours, financial_record_id |
| Financial Record Created | INFO | user_id, financial_record_id, customer_id, amount, product_name |
| Fixed-Price Skip | WARN | user_id, timer_id, project_id, skip_reason |
| Error Occurred | ERROR | user_id, error_code, error_message, stack_trace, request_id |

### 9.2 Data Retention

**Retention Policies:**

| Data Type | Retention Period | Archival Strategy |
|-----------|------------------|-------------------|
| Task records | 7 years | Archive to cold storage after 3 years |
| Timer records | 7 years | Archive to cold storage after 3 years |
| Financial records | 10 years | NEVER delete (legal requirement) |
| Audit logs | 7 years | Archive to object storage after 1 year |
| Idempotency keys | 24 hours | Auto-delete after expiry |
| API logs | 90 days | Auto-delete after 90 days |

**Compliance Notes:**
- Financial records must be retained for tax audit purposes (IRS: 7 years, some states: 10 years)
- Timer records support financial record verification
- NEVER hard-delete financial records (soft delete only if needed)

### 9.3 GDPR and Privacy Considerations

**Personal Data:**
- Task names may contain personal information (e.g., "Fix John's account")
- Work descriptions may contain personal information
- Staff names and contact information are personal data

**Requirements:**
1. **Right to Access:** Provide API to export all data for a user
2. **Right to Erasure:** Soft-delete user data, anonymize timer/task records
3. **Data Minimization:** Do not collect more data than necessary
4. **Purpose Limitation:** Use data only for billing and project management

**Anonymization Strategy (when user exercises right to erasure):**
```sql
-- Anonymize user-related data
UPDATE task_timers
SET work_description = '[REDACTED]'
WHERE staff_id = :user_id;

UPDATE tasks
SET task = CONCAT('[REDACTED TASK ', id, ']'),
    notes = NULL
WHERE staff_id = :user_id;

-- Do NOT delete financial records (legal requirement overrides GDPR erasure)
-- Instead, pseudonymize:
UPDATE customer_sales
SET created_by_user_id = NULL
WHERE created_by_user_id = :user_id;
```

---

## 10. Migration Considerations

### 10.1 FileMaker to Supabase Migration Strategy

**Phase 1: Dual Write (Current State)**
- All timer operations write to FileMaker (primary)
- Financial records are synchronized to Supabase `customer_sales` asynchronously
- No backend API for tasks/timers yet (FileMaker API only)

**Phase 2: Backend API Deployment (Parallel Run)**
- Deploy backend API with tasks/timers endpoints
- Frontend makes BOTH FileMaker API call AND backend API call
- Log discrepancies between FileMaker and backend responses
- Backend writes to Supabase only (does not write to FileMaker)

**Phase 3: Backend as Primary (Transition)**
- Frontend switches to backend API as primary source of truth
- FileMaker API calls become fallback only
- Monitor error rates and rollback if issues detected

**Phase 4: FileMaker Deprecation**
- Remove FileMaker API calls from frontend
- Archive historical FileMaker data to Supabase
- Decommission FileMaker timer/task functionality

### 10.2 Data Migration Requirements

**Historical Data Migration:**

**Scope:**
- Migrate all tasks from FileMaker `devTasks` layout (estimated 10,000+ records)
- Migrate all timer records from FileMaker `devRecords` layout (estimated 50,000+ records)
- Preserve relationships: task ↔ project ↔ customer

**Mapping:**

| FileMaker Field | Supabase Field | Transformation |
|-----------------|----------------|----------------|
| `__ID` | `task_id` or `filemaker_id` | UUID (keep as-is or map) |
| `_projectID` | `project_id` | UUID mapping via `filemaker_id_mappings` table |
| `_staffID` | `staff_id` | UUID mapping via `filemaker_id_mappings` table |
| `task` | `task_name` | String (direct copy) |
| `f_completed` | `is_completed` | Boolean (0 → false, 1 → true) |
| `~creationTimestamp` | `created_at` | FileMaker timestamp → PostgreSQL TIMESTAMPTZ |
| `~modificationTimestamp` | `updated_at` | FileMaker timestamp → PostgreSQL TIMESTAMPTZ |

**Migration Script Requirements:**
1. **Idempotent:** Can be run multiple times without duplicating data
2. **Resumable:** Can resume from last successful batch if interrupted
3. **Validated:** Compare record counts and checksums after migration
4. **Logged:** Log all skipped records, errors, warnings

**Example Migration Query:**
```sql
INSERT INTO tasks (
  task_id, project_id, staff_id, task_name, task_type,
  is_completed, priority, created_at, updated_at
)
SELECT
  fm.filemaker_id AS task_id,
  pmap.supabase_id AS project_id,
  smap.supabase_id AS staff_id,
  fm.task AS task_name,
  fm.type AS task_type,
  (fm.f_completed = 1) AS is_completed,
  COALESCE(fm.f_priority, 'active') AS priority,
  fm.creation_timestamp AS created_at,
  fm.modification_timestamp AS updated_at
FROM filemaker_tasks fm
LEFT JOIN filemaker_id_mappings pmap ON fm.project_id = pmap.filemaker_id AND pmap.entity_type = 'project'
LEFT JOIN filemaker_id_mappings smap ON fm.staff_id = smap.filemaker_id AND smap.entity_type = 'staff'
WHERE fm.filemaker_id NOT IN (SELECT task_id FROM tasks)  -- Idempotency
ON CONFLICT (task_id) DO NOTHING;
```

### 10.3 Rollback Plan

**Rollback Triggers:**
- Error rate > 5% for any API endpoint
- Data integrity issues detected (missing records, incorrect calculations)
- Performance degradation > 50% slower than FileMaker
- Customer-reported data loss or corruption

**Rollback Procedure:**
1. **Immediate:** Redirect frontend to FileMaker API (feature flag flip)
2. **Within 1 hour:** Investigate root cause, fix bugs if possible
3. **Within 24 hours:** Decision to proceed with fix or full rollback
4. **Full Rollback:** Revert backend deployment, clear Supabase data if needed

**Rollback Testing:**
- Test rollback procedure in staging environment monthly
- Document rollback steps in runbook
- Assign rollback decision authority (CTO or backend team lead)

---

## Appendix A: Code References

### Frontend Implementation (Current State)

| File | Lines | Description |
|------|-------|-------------|
| `src/services/taskService.js` | 1-658 | Task business logic, validation, processing |
| `src/services/taskService.js` | 265-305 | TASK_FIELDS validation rules |
| `src/services/taskService.js` | 315-376 | validateTaskData() function |
| `src/services/taskService.js` | 67-131 | stopTimer() with fixed-price detection |
| `src/api/tasks.js` | 1-317 | FileMaker API calls for tasks/timers |
| `src/api/tasks.js` | 121-178 | startTaskTimer() with customer lookup |
| `src/api/tasks.js` | 189-213 | stopTaskTimer() FileMaker update |
| `src/components/tasks/TaskTimer.jsx` | 1-353 | Timer UI component with state management |
| `src/hooks/useTask.js` | 204-317 | Task hook with timer operations |
| `src/services/financialSyncService.js` | 628-640 | formatProductName() logic |
| `src/services/projectService.js` | 508-549 | processProjectValue() fixed-price logic |
| `src/services/billableHoursService.js` | 93 | fixedPrice field extraction |

### Documentation References

| Document | Description |
|----------|-------------|
| `TASK_CRUD_OPERATIONS.md` | Complete task CRUD operations documentation |
| `TIMER_LIFECYCLE_STATE_MACHINE.md` | Timer state machine and lifecycle |
| `FINANCIAL_RECORD_GENERATION.md` | Financial record generation flow |
| `DUAL_WRITE_MECHANISM.md` | Dual-write service architecture |
| `FINANCIAL_SYNC_RECONCILIATION.md` | Financial sync reconciliation logic |
| `BACKEND_CHANGE_REQUEST_001_TASKS_API.md` | Backend API specification for tasks |
| `BACKEND_CHANGE_REQUEST_002_TIMER_OPERATIONS.md` | Backend API specification for timers |

---

## Appendix B: Backend Implementation Checklist

### Must-Have for MVP

- [ ] Task CRUD validation (all TASK_FIELDS rules)
- [ ] Timer state machine enforcement (3 states: active, paused, completed)
- [ ] Fixed-price project detection and skip logic
- [ ] Financial record generation (timer stop → customer_sales)
- [ ] Product name formatting (CUSTOMERCAPS:ProjectFirstWord)
- [ ] Billable hours calculation (with pause and adjustment)
- [ ] Hourly rate resolution (project → staff → org fallback)
- [ ] One active timer per staff constraint (unique index + lock)
- [ ] Transaction atomicity (timer stop + financial record in one transaction)
- [ ] Idempotency keys (24-hour cache, deduplicate requests)
- [ ] Optimistic locking (SELECT FOR UPDATE NOWAIT)
- [ ] Error codes and structured responses (all error codes from section 7.3)
- [ ] Audit logging (all events from section 9.1)

### Nice-to-Have for V2

- [ ] Server-side pause state tracking (currently client-side only)
- [ ] Advanced retry logic with circuit breaker
- [ ] Real-time timer sync via WebSockets
- [ ] Background job for orphaned financial record cleanup
- [ ] Advanced caching with Redis (currently no caching)
- [ ] GraphQL API (currently REST only)
- [ ] Bulk timer operations (stop multiple timers at once)
- [ ] Timer templates (pre-fill task/project/description)

### Future Enhancements

- [ ] AI-powered work description suggestions
- [ ] Automatic time tracking (detect activity patterns)
- [ ] Integration with calendar for time blocking
- [ ] Advanced reporting and analytics API
- [ ] Mobile-optimized timer endpoints (offline support)
- [ ] Multi-currency support for hourly rates
- [ ] Custom billing rules engine (beyond fixed-price/hourly)

---

## Appendix C: Questions for Backend Team

1. **Database Schema:**
   - Should we use separate `tasks` and `task_timers` tables, or combine into one table?
   - Should `billable_hours` be stored in `task_timers` (denormalized) or calculated on-demand?
   - Should we use ENUM type for `status` or VARCHAR with CHECK constraint?

2. **Transaction Isolation:**
   - Is SERIALIZABLE isolation level acceptable for all timer operations?
   - What is the expected lock contention rate with 100+ concurrent users?
   - Should we use NOWAIT or wait with timeout for lock acquisition?

3. **Performance:**
   - What is the expected timer operation volume (ops/second)?
   - Should we implement read replicas for task list queries?
   - What is the acceptable P95 latency for timer stop operation?

4. **Idempotency:**
   - 24-hour TTL for idempotency keys acceptable?
   - Should idempotency keys be globally unique or scoped to user/endpoint?
   - Should we implement automatic cleanup job or rely on TTL?

5. **Error Handling:**
   - Should we retry failed financial record creation in background job?
   - What is the procedure for manual data reconciliation if transaction fails?
   - Should we implement compensating transactions or manual admin tool?

6. **Migration:**
   - What is the expected downtime for historical data migration?
   - Should we implement online migration (dual-write) or offline migration (maintenance window)?
   - What is the rollback procedure if migration fails mid-way?

7. **Fixed-Price Logic:**
   - Should fixed-price milestone revenue be created automatically via scheduled job?
   - Should we implement webhooks for project start/end date triggers?
   - How to handle manual adjustments to fixed-price payments (partial milestones)?

8. **Compliance:**
   - What is the data retention policy for timer records?
   - Should we implement soft-delete or hard-delete for task records?
   - How to handle GDPR erasure requests for financial records (conflict with legal retention)?

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-10 | Claude (AI Assistant) | Initial draft - comprehensive business logic requirements |

---

**END OF DOCUMENT**
