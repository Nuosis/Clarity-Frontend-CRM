# Timer Endpoints Implementation Summary

## Overview
Implemented new timer endpoints in `src/api/tasks.js` to integrate with the backend's `/time-entries` API. All endpoints support both backend API and FileMaker fallback modes via the `USE_BACKEND_API` feature flag.

## Implemented Endpoints

### 1. `startTaskTimer(taskId, selectedTask)`
**Backend Endpoint:** `POST /time-entries/start`

**Request:**
```json
{
  "task_id": "uuid",
  "staff_id": "uuid",
  "is_billable": true
}
```

**Features:**
- Idempotency handled by backend (prevents duplicate active timers)
- HMAC authentication with request payload
- Automatic extraction of staff_id from selectedTask object (supports both `_staffID` and `staff_id` formats)
- Falls back to FileMaker RECORDS layout creation

**Error Handling:**
- Validates required parameters
- Handles backend validation errors (task not found, staff not found, etc.)
- Returns concurrency errors if staff already has active timer

---

### 2. `stopTaskTimer(entryId, description, saveImmediately, adjustmentSeconds)`
**Backend Endpoint:** `POST /time-entries/{entry_id}/stop`

**Request:**
```json
{
  "description": "Work performed description",
  "adjustment_seconds": 360,
  "end_time": null  // defaults to now
}
```

**Features:**
- Atomic operation: stops timer AND creates financial record if billable
- Supports time adjustments in seconds
- Auto-generates description if `saveImmediately` is true
- Backend detects fixed-price projects and skips financial record creation
- Response includes both time entry and financial record (if created)

**Error Handling:**
- Handles partial failures gracefully (backend ensures atomicity)
- Clear error messages for validation failures
- Logs all operations for debugging

---

### 3. `pauseTimer(entryId)`
**Backend Endpoint:** `POST /time-entries/{entry_id}/pause`

**Features:**
- Pauses an active timer
- Accumulates pause duration
- Only works with backend API (FileMaker throws unsupported error)
- No request body required

**Validation:**
- Timer must be in 'active' status
- Backend prevents pausing already paused or completed timers

---

### 4. `resumeTimer(entryId)`
**Backend Endpoint:** `POST /time-entries/{entry_id}/resume`

**Features:**
- Resumes a paused timer
- Pause duration is tracked separately
- Only works with backend API (FileMaker throws unsupported error)
- No request body required

**Validation:**
- Timer must be in 'paused' status
- Backend prevents resuming active or completed timers

---

### 5. `getActiveTimer(staffId)`
**Backend Endpoint:** `GET /time-entries/active?staff_id={staffId}`

**Features:**
- Fetches the currently active timer for a staff member
- Staff ID is optional (defaults to current authenticated user in backend)
- Returns `null` if no active timer exists
- Handles 404 responses gracefully (expected when no timer is active)

**FileMaker Fallback:**
- Queries RECORDS layout for entries with empty `TimeEnd` field
- Returns first match or null

---

### 6. `fetchTaskTimers(taskId, filters)` (Updated)
**Backend Endpoint:** `GET /time-entries?task_id={taskId}&...filters`

**Query Parameters:**
- `task_id` (required in function, passed as query param)
- `project_id` (optional)
- `customer_id` (optional)
- `staff_id` (optional)
- `start_date` (optional, format: YYYY-MM-DD)
- `end_date` (optional, format: YYYY-MM-DD)
- `status` (optional: 'active', 'paused', 'completed')
- `limit` (optional, default: 50, max: 200)
- `offset` (optional, default: 0)

**Features:**
- Supports advanced filtering beyond just task_id
- Pagination support via limit/offset
- Status filtering for workflow management
- Returns array of time entries with full metadata

---

## Authentication Pattern

All backend requests use HMAC-SHA256 authentication:

```javascript
const payload = JSON.stringify(requestData);
const authHeader = await generateBackendAuthHeader(payload);

// For GET requests (no body)
const authHeader = await generateBackendAuthHeader('');
```

**Format:** `Bearer {signature}.{timestamp}`

---

## Response Schema

### TimeEntryResponse
```typescript
{
  id: string (uuid)
  organization_id: string (uuid)
  task_id: string (uuid)
  project_id: string (uuid)
  customer_id: string (uuid)
  staff_id: string (uuid)
  start_time: string (ISO 8601)
  end_time: string | null (ISO 8601)
  description: string | null
  adjustment_seconds: number
  pause_duration_seconds: number
  duration_minutes: string | null (decimal)
  hourly_rate: string | null (decimal)
  billable_amount: string | null (decimal)
  is_billable: boolean
  status: 'active' | 'paused' | 'completed'
  completed_at: string | null (ISO 8601)
  filemaker_record_id: string | null
  created_at: string (ISO 8601)
  updated_at: string (ISO 8601)
}
```

---

## Error Handling

### Error Response Format
```json
{
  "detail": "Error message"
}
```

Or for validation errors:
```json
{
  "detail": [
    {
      "loc": ["body", "field_name"],
      "msg": "Validation message",
      "type": "error_type"
    }
  ]
}
```

### Common Error Scenarios

1. **Idempotency Violation (Start Timer)**
   - HTTP 409 Conflict
   - Message: "Staff member already has an active timer"
   - Resolution: Stop or pause existing timer first

2. **Invalid State Transition (Pause/Resume)**
   - HTTP 400 Bad Request
   - Message: "Timer must be active to pause" or "Timer must be paused to resume"
   - Resolution: Check current timer status

3. **Not Found (Stop/Pause/Resume)**
   - HTTP 404 Not Found
   - Message: "Time entry not found"
   - Resolution: Verify entry ID is valid

4. **Validation Errors**
   - HTTP 422 Unprocessable Entity
   - Details include field name and validation message
   - Resolution: Fix request data according to schema

---

## Logging Strategy

All endpoints include comprehensive logging:

```javascript
console.log('[Tasks API] Starting timer for task:', taskId);
console.log('[Tasks API] Timer started successfully:', response.data);
console.log('[Tasks API] Stopping timer:', entryId);
console.log('[Tasks API] Timer stopped successfully:', response.data);
```

**Log Prefix:** `[Tasks API]` for easy filtering and debugging

---

## FileMaker Fallback Behavior

### Supported in FileMaker:
- `startTaskTimer` - Creates RECORDS entry with TimeStart/DateStart
- `stopTaskTimer` - Updates RECORDS entry with TimeEnd
- `fetchTaskTimers` - Queries RECORDS by _taskID
- `getActiveTimer` - Queries RECORDS where TimeEnd is empty

### NOT Supported in FileMaker:
- `pauseTimer` - Throws "Pause timer is not supported in FileMaker mode"
- `resumeTimer` - Throws "Resume timer is not supported in FileMaker mode"

**Reason:** FileMaker implementation doesn't have pause/resume state tracking.

---

## Concurrency Control

### Backend Guarantees:
1. **One Active Timer Per Staff:** Backend enforces single active timer constraint
2. **Atomic Stop + Financial Record:** Stop operation creates financial record in single transaction
3. **State Validation:** Backend validates all state transitions (active → paused → resumed → stopped)

### Frontend Responsibilities:
1. **Check Active Timer on Load:** Use `getActiveTimer()` to restore timer state
2. **Handle Concurrency Errors:** Display clear message when attempting to start duplicate timer
3. **Disable Actions Based on State:** UI should disable pause when already paused, etc.

---

## Financial Record Integration

### Automatic Financial Record Creation

When `stopTaskTimer` is called, the backend automatically:

1. **Calculates Billable Time:**
   - Duration = (end_time - start_time) - pause_duration_seconds + adjustment_seconds
   - Converts to minutes (duration_minutes)

2. **Checks Project Type:**
   - If fixed-price project: NO financial record created
   - If hourly/billable project: Create financial record

3. **Creates Financial Record:**
   ```json
   {
     "organization_id": "...",
     "customer_id": "...",
     "project_id": "...",
     "task_id": "...",
     "staff_id": "...",
     "time_entry_id": "...",
     "hours": "decimal (from duration_minutes / 60)",
     "rate": "decimal (hourly_rate)",
     "amount": "decimal (hours * rate)",
     "date": "date (from start_time)",
     "description": "string (from time entry)",
     "is_billable": true,
     "status": "unbilled"
   }
   ```

4. **Returns Combined Response:**
   - Backend returns both time entry and financial record in response
   - Frontend can update UI with both entities atomically

### Error Recovery

If financial record creation fails:
- Backend rolls back the entire transaction
- Timer remains active/paused (not stopped)
- Error message indicates financial record failure
- Frontend can retry or handle manually

---

## Migration Notes

### Transition Strategy:
1. **Phase 1 (Current):** Feature flag `USE_BACKEND_API = true`, FileMaker fallback active
2. **Phase 2:** Monitor production for errors, collect metrics
3. **Phase 3:** Remove FileMaker fallback code when backend proven stable

### Data Mapping Considerations:
- FileMaker uses `recordId` (integer), backend uses `id` (UUID)
- FileMaker stores `_taskID`, `_staffID`, `_projectID`, `_custID` (foreign keys)
- Backend uses `task_id`, `staff_id`, `project_id`, `customer_id` (UUIDs)
- Time format: FileMaker uses separate `TimeStart`/`DateStart`, backend uses ISO 8601 `start_time`
- Adjustment: FileMaker uses `TimeAdjust` (seconds), backend uses `adjustment_seconds` (seconds)
- Pause: FileMaker doesn't track pause, backend has `pause_duration_seconds` and `status`

### Breaking Changes:
- Pause/resume functionality ONLY works with backend API
- Response shape is different (backend returns structured TimeEntryResponse vs FileMaker raw fieldData)
- Error messages are different (backend uses detail field, FileMaker uses custom error structure)

---

## Testing Recommendations

### Unit Tests:
1. Test HMAC authentication header generation
2. Test parameter validation
3. Test error response parsing
4. Test FileMaker fallback logic

### Integration Tests:
1. Start timer → verify active state
2. Pause timer → verify paused state and duration tracking
3. Resume timer → verify active state resumed
4. Stop timer → verify completed state and financial record creation
5. Concurrent timer conflict → verify idempotency enforcement
6. Fixed-price project → verify NO financial record created

### E2E Tests:
1. Full timer lifecycle: start → pause → resume → stop
2. Timer state persistence across page reloads
3. Multiple staff members with separate timers
4. Timer adjustment workflow (6-minute increments)

---

## Next Steps (Service Layer)

The following service layer updates are needed in `taskService.js`:

1. **Timer State Management:**
   - Add state tracking for pause/resume
   - Implement timer restoration on app load

2. **Adjustment Validation:**
   - Enforce 6-minute (360 second) increment validation
   - Display adjustment UI with increment buttons

3. **Concurrency Handling:**
   - Check for active timer before starting new timer
   - Display existing active timer with option to stop it

4. **Financial Record Display:**
   - Parse and display financial record from stop response
   - Show billing amount and status

5. **Error Recovery:**
   - Implement retry logic for failed financial record creation
   - Provide manual reconciliation UI

---

## API Specification Reference

**OpenAPI Spec:** `https://api.claritybusinesssolutions.ca/openapi.json`

**Relevant Endpoints:**
- `POST /time-entries/start`
- `POST /time-entries/{entry_id}/stop`
- `POST /time-entries/{entry_id}/pause`
- `POST /time-entries/{entry_id}/resume`
- `GET /time-entries/active`
- `GET /time-entries`

**Security:** All endpoints require HMAC Bearer token authentication (except webhooks/events)

---

## Implementation Files

**Modified:**
- `src/api/tasks.js` - All timer endpoint implementations

**Verified:**
- Build completes successfully
- No import errors
- HMAC authentication pattern consistent with existing code
- Error handling follows project conventions
- Logging follows `[Tasks API]` prefix pattern

---

## Completion Checklist

- [x] Implement startTaskTimer with backend API
- [x] Implement stopTaskTimer with financial record support
- [x] Implement pauseTimer
- [x] Implement resumeTimer
- [x] Implement getActiveTimer
- [x] Update fetchTaskTimers with advanced filtering
- [x] Add HMAC authentication to all endpoints
- [x] Add comprehensive error handling
- [x] Add logging for debugging
- [x] Maintain FileMaker fallback compatibility
- [x] Verify build compiles successfully
- [x] Document API contracts and error scenarios
