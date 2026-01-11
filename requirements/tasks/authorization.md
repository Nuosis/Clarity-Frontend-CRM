# Tasks & Timer - Authorization and Security

## Overview

This document defines the authorization model, Row-Level Security (RLS) policies, and security requirements for the Tasks and Timer feature.

## Authorization Model

### Organization-Based Access Control

All tasks and time entries are scoped to an **organization**. Users can only access resources belonging to their organization.

**Primary Principle:** Organization-level multi-tenancy via RLS policies

### Role-Based Permissions

| Role | Task Permissions | Timer Permissions | Notes |
|---|---|---|---|
| **Admin** | Full CRUD on all tasks | Start/stop/adjust any timer | Org-level access |
| **Manager** | Full CRUD on assigned projects | Start/stop/adjust team timers | Project-scoped |
| **Staff** | Read all, edit own tasks | Start/stop own timers only | Self-scoped |
| **Client** | Read-only on project tasks | No timer access | View-only |

---

## Row-Level Security (RLS) Policies

### tasks Table

#### Enable RLS
```sql
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
```

#### Policy 1: Organization Members Can View Tasks

```sql
CREATE POLICY "Users can view tasks in their organization"
  ON tasks
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );
```

#### Policy 2: Users Can Create Tasks in Their Organization

```sql
CREATE POLICY "Users can create tasks in their organization"
  ON tasks
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
    AND project_id IN (
      SELECT id FROM projects WHERE organization_id = NEW.organization_id
    )
  );
```

**Validation:**
- Project must belong to same organization
- Customer ID auto-populated from project (enforced in trigger)

#### Policy 3: Users Can Update Tasks in Their Organization

```sql
CREATE POLICY "Users can update tasks in their organization"
  ON tasks
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );
```

**Additional Check (Application-level):**
- Staff members can only update tasks assigned to them (unless Admin/Manager)
- Admins can update any task in org

#### Policy 4: Users Can Delete Tasks in Their Organization

```sql
CREATE POLICY "Users can delete tasks in their organization"
  ON tasks
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );
```

**Additional Check (Application-level):**
- Only Admins/Managers can delete tasks
- Cannot delete task with associated time entries (enforce in trigger or application)

---

### time_entries Table

#### Enable RLS
```sql
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
```

#### Policy 1: Users Can View Time Entries in Their Organization

```sql
CREATE POLICY "Users can view time entries in their organization"
  ON time_entries
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );
```

**Additional Filtering (Application-level):**
- Staff can view own time entries
- Managers can view team time entries
- Admins can view all org time entries

#### Policy 2: Users Can Create Time Entries in Their Organization

```sql
CREATE POLICY "Users can create time entries in their organization"
  ON time_entries
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
    AND task_id IN (
      SELECT id FROM tasks WHERE organization_id = NEW.organization_id
    )
    -- Staff can only create entries for themselves
    AND (
      staff_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM organization_members
        WHERE user_id = auth.uid()
          AND organization_id = NEW.organization_id
          AND role IN ('admin', 'manager')
      )
    )
  );
```

**Business Rules:**
- Staff can only start timer for themselves
- Admins/Managers can start timer on behalf of team members

#### Policy 3: Users Can Update Their Own Time Entries

```sql
CREATE POLICY "Users can update their own time entries"
  ON time_entries
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
    AND (
      staff_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM organization_members
        WHERE user_id = auth.uid()
          AND organization_id = time_entries.organization_id
          AND role IN ('admin', 'manager')
      )
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );
```

**Additional Check (Application-level):**
- Cannot edit time entry once invoiced (check `customer_sales.invoice_id IS NULL`)

#### Policy 4: Users Can Delete Their Own Time Entries

```sql
CREATE POLICY "Users can delete their own time entries"
  ON time_entries
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
    AND (
      staff_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM organization_members
        WHERE user_id = auth.uid()
          AND organization_id = time_entries.organization_id
          AND role = 'admin'
      )
    )
    -- Cannot delete if invoiced
    AND NOT EXISTS (
      SELECT 1 FROM customer_sales
      WHERE time_entry_id = time_entries.id
        AND invoice_id IS NOT NULL
    )
  );
```

---

### customer_sales Table (Timer-Generated Records)

#### Policy: Users Can View Sales in Their Organization

```sql
CREATE POLICY "Users can view sales in their organization"
  ON customer_sales
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );
```

**Note:** `customer_sales` records are created automatically when timer stops. Users do not directly insert/update/delete these records (managed by RPC function).

---

## Security Constraints

### 1. One Active Timer Per Staff Member

Enforced by unique partial index:

```sql
CREATE UNIQUE INDEX idx_one_active_timer_per_staff
  ON time_entries(staff_id)
  WHERE status = 'active';
```

**Error:**
```
ERROR: duplicate key value violates unique constraint "idx_one_active_timer_per_staff"
```

**Application Handling:**
- Check for active timer before starting new one
- Return existing timer if already active (idempotency)

---

### 2. Prevent Negative Duration

Enforced by check constraint:

```sql
ALTER TABLE time_entries
  ADD CONSTRAINT duration_non_negative
  CHECK (duration_minutes IS NULL OR duration_minutes >= 0);
```

**Application Handling:**
- Validate `adjustment_seconds` and `pause_duration_seconds` before stop
- Show error to user if total adjustment would result in negative duration

---

### 3. Task Belongs to Organization

Enforced by foreign key + trigger:

```sql
CREATE OR REPLACE FUNCTION validate_task_organization()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure project belongs to same organization
  IF NOT EXISTS (
    SELECT 1 FROM projects
    WHERE id = NEW.project_id
      AND organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Project does not belong to the specified organization';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_task_org_before_insert
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION validate_task_organization();
```

---

### 4. Time Entry Consistency

Enforced by trigger:

```sql
CREATE OR REPLACE FUNCTION validate_time_entry_consistency()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure task/project/customer belong to same organization
  IF NOT EXISTS (
    SELECT 1 FROM tasks t
    JOIN projects p ON p.id = t.project_id
    JOIN customers c ON c.id = p.customer_id
    WHERE t.id = NEW.task_id
      AND t.organization_id = NEW.organization_id
      AND p.organization_id = NEW.organization_id
      AND c.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Task/Project/Customer organization mismatch';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_time_entry_before_insert
  BEFORE INSERT OR UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION validate_time_entry_consistency();
```

---

## API Authentication

### HMAC-SHA256 Authentication

All backend API requests require HMAC authentication:

**Request Headers:**
```http
Authorization: Bearer {signature}.{timestamp}
Content-Type: application/json
```

**Signature Generation:**
```javascript
import CryptoJS from 'crypto-js';

function generateHMACSignature(requestBody, secretKey) {
  const timestamp = Date.now();
  const payload = JSON.stringify(requestBody) + timestamp;
  const signature = CryptoJS.HmacSHA256(payload, secretKey).toString();
  return `${signature}.${timestamp}`;
}
```

**Backend Validation:**
```python
import hmac
import hashlib
import time

def validate_hmac(request):
    auth_header = request.headers.get('Authorization')
    signature, timestamp = auth_header.replace('Bearer ', '').split('.')

    # Check timestamp (prevent replay attacks)
    if abs(time.time() * 1000 - int(timestamp)) > 60000:  # 60 second window
        raise ValueError('Request timestamp expired')

    # Recalculate signature
    payload = request.body + timestamp
    expected_signature = hmac.new(
        SECRET_KEY.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(signature, expected_signature):
        raise ValueError('Invalid signature')

    return True
```

---

### JWT Token (Supabase Auth)

For direct Supabase client queries (if used):

**Token Structure:**
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "authenticated",
  "organization_id": "org-uuid",
  "user_metadata": {
    "role": "admin"
  }
}
```

**RLS Policies Access:**
- `auth.uid()`: Returns authenticated user ID
- `auth.jwt() ->> 'organization_id'`: Returns organization from JWT

---

## Rate Limiting

### Global Limits
- **100 requests/minute per organization**
- **10 timer starts/hour per staff member** (prevent accidental spam)

### Endpoint-Specific Limits
- `POST /time-entries/start`: 10/hour per staff
- `POST /time-entries/{id}/stop`: 60/hour per staff
- `GET /tasks`: 300/hour per user
- `POST /tasks`: 50/hour per user

**Implementation:**
- Redis-based rate limiting
- Returns `429 Too Many Requests` with `Retry-After` header

---

## Audit Logging

### Events to Log

**Task Events:**
- Task created: `{ user_id, organization_id, task_id, action: 'create' }`
- Task updated: `{ user_id, task_id, action: 'update', changes: {...} }`
- Task deleted: `{ user_id, task_id, action: 'delete' }`

**Timer Events:**
- Timer started: `{ user_id, time_entry_id, task_id, action: 'timer_start' }`
- Timer stopped: `{ user_id, time_entry_id, duration_minutes, billable_amount, action: 'timer_stop' }`
- Timer adjusted: `{ user_id, time_entry_id, old_duration, new_duration, action: 'timer_adjust' }`

**Audit Table:**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  entity_type TEXT NOT NULL,  -- 'task', 'time_entry', 'customer_sale'
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,       -- 'create', 'update', 'delete', 'timer_start', 'timer_stop'
  changes JSONB,              -- Old/new values
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_org_id ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

---

## Security Best Practices

### 1. Prevent SQL Injection
- Use parameterized queries exclusively
- Never concatenate user input into SQL strings

### 2. Input Validation
- Validate all UUIDs format
- Sanitize description text (strip HTML, limit length)
- Validate numeric ranges (duration >= 0, priority 1-5)

### 3. Output Sanitization
- Escape HTML in descriptions when rendering in UI
- Use Content Security Policy (CSP) headers

### 4. Prevent CSRF
- HMAC signature changes with each request (includes timestamp)
- No cookie-based authentication on API endpoints

### 5. Prevent Timing Attacks
- Use constant-time comparison for HMAC validation (`hmac.compare_digest()`)
- Do not leak information in error messages (e.g., "User not found" vs "Invalid credentials")

### 6. Encryption at Rest
- Database encryption enabled (Supabase default)
- Secrets stored in environment variables, not in code

### 7. Encryption in Transit
- HTTPS only (TLS 1.2+)
- Certificate pinning for mobile apps (future)

---

## Testing Security

### Test Cases

**TC1: Unauthorized Access**
- User A tries to access User B's tasks in different organization
- Expected: 403 Forbidden (RLS blocks query)

**TC2: Cross-Organization Timer**
- User tries to start timer for task in different organization
- Expected: 400 Bad Request (RLS prevents insert)

**TC3: Duplicate Active Timer**
- User tries to start timer while one already active
- Expected: 200 OK with existing timer (idempotency)

**TC4: Invalid HMAC Signature**
- Request with tampered signature
- Expected: 401 Unauthorized

**TC5: Expired Timestamp**
- Request with timestamp > 60 seconds old
- Expected: 401 Unauthorized (replay attack prevention)

**TC6: Staff Creates Entry for Another Staff**
- Staff user tries to start timer with different `staff_id`
- Expected: 403 Forbidden (RLS blocks insert)

**TC7: Admin Creates Entry for Staff**
- Admin starts timer on behalf of staff member
- Expected: 201 Created (allowed)

**TC8: Edit Invoiced Time Entry**
- User tries to adjust time entry with `invoice_id` set
- Expected: 400 Bad Request (application-level check)

**TC9: Delete Task with Time Entries**
- User tries to delete task that has time entries
- Expected: 400 Bad Request (foreign key constraint or trigger)

**TC10: Rate Limit Exceeded**
- User makes 11 timer start requests in 1 hour
- Expected: 429 Too Many Requests

---

## Compliance Considerations

### GDPR
- Users can request deletion of their time entries
- Audit logs must be retained even after user deletion (anonymize user_id)
- Right to data portability: export time entries as JSON/CSV

### SOC 2
- Audit logging enabled for all sensitive operations
- Access controls reviewed quarterly
- Encryption at rest and in transit

### Financial Data Protection
- Billable amounts stored with precision (NUMERIC(10,2))
- Financial records immutable once invoiced (enforce via trigger)

---

## Summary

**RLS Policies:** 10 policies across 3 tables
- tasks: 4 policies (SELECT, INSERT, UPDATE, DELETE)
- time_entries: 4 policies (SELECT, INSERT, UPDATE, DELETE)
- customer_sales: 2 policies (SELECT, INSERT)

**Constraints:** 5 database constraints
- One active timer per staff
- Duration non-negative
- Organization consistency
- Foreign key integrity
- Check constraints on enums

**Authentication:** HMAC-SHA256 + JWT
**Rate Limiting:** Redis-based, per-organization and per-staff
**Audit Logging:** All mutations logged with user context
**Security Features:** Replay attack prevention, SQL injection protection, CSRF prevention
