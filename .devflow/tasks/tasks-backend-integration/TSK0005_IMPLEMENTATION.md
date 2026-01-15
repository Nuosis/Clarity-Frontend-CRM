# TSK0005: Update taskService.js Business Logic - Implementation Summary

## Overview
Updated `src/services/taskService.js` to handle new backend API shapes and implement new timer business logic including idempotency, concurrency control, financial record generation, pause/resume functionality, and adjustment validations.

## Changes Made

### 1. Import Updates
Added new timer API functions:
- `pauseTimer` - Pause active timer
- `resumeTimer` - Resume paused timer
- `getActiveTimer` - Get staff's active timer

### 2. Enhanced `startTimer()` Function

**New Features:**
- **Concurrency Control**: Checks for existing active timer before starting
- **Better Error Handling**: User-friendly error messages for conflicts
- **Idempotency Support**: Backend enforces single active timer per staff
- **Comprehensive Logging**: All operations logged with `[Task Service]` prefix

**Signature:**
```javascript
export async function startTimer(task, staffId = null)
```

**Business Logic:**
- Validates task and staff IDs
- Checks for existing active timer (proactive UX check)
- Handles 409 Conflict errors from backend
- Returns user-friendly error if staff already has active timer

### 3. Enhanced `stopTimer()` Function

**New Features:**
- **Adjustment Validation**: Enforces 6-minute increment rule
- **Backend Financial Record Handling**: Backend creates financial records atomically
- **Fixed-Price Detection**: Backend automatically skips financial records for fixed-price projects
- **Dual Response Handling**: Supports both backend (structured) and FileMaker (legacy) responses
- **Comprehensive Logging**: Detailed logging for debugging

**Signature:**
```javascript
export async function stopTimer(params, organizationId = null)
```

**Parameters:**
- `params.recordId`: Timer entry ID (UUID for backend, recordId for FileMaker)
- `params.description`: Work performed description
- `params.saveImmediately`: Save without description
- `params.totalPauseTime`: Accumulated pause time in seconds
- `params.adjustment`: Manual adjustment in seconds

**Validation:**
- Adjustment must be in 6-minute (360 second) increments
- Throws error if adjustment validation fails

**Backend Response:**
```javascript
{
  time_entry: { /* TimeEntry object */ },
  financial_record: { /* FinancialRecord object or null */ }
}
```

**Legacy FileMaker Response:**
Continues to work with existing FileMaker response format and creates Supabase sales records

### 4. New Timer Management Functions

#### `pauseTimer(entryId)`
- Pauses an active timer
- Only supported in backend mode
- Validates timer is in active state
- User-friendly error messages

#### `resumeTimer(entryId)`
- Resumes a paused timer
- Only supported in backend mode
- Validates timer is in paused state
- User-friendly error messages

#### `getActiveTimer(staffId)`
- Fetches active timer for staff member
- Used for restoring timer state on app load
- Returns null if no active timer found
- Gracefully handles errors

### 5. Enhanced Data Processing Functions

#### `processTimerRecords(timerRecords)`
**New Capabilities:**
- Handles both backend API response (array) and FileMaker response (object)
- Extracts new backend fields: `status`, `pause_duration_seconds`, `adjustment_seconds`, `is_billable`, `billable_amount`, `hourly_rate`
- Converts duration from minutes to hours for consistency
- Infers status for FileMaker records (completed if has end time)

**Backend Response Structure:**
```javascript
{
  id: "uuid",
  status: "active" | "paused" | "completed",
  startTime: Date,
  endTime: Date | null,
  description: string,
  duration: number (hours),
  pauseDuration: number (seconds),
  adjustmentSeconds: number,
  isBillable: boolean,
  billableAmount: string,
  hourlyRate: string
}
```

#### `processTaskData(data)`
**New Capabilities:**
- Handles both backend API response (array) and FileMaker response (object)
- Extracts new backend fields: `name`, `is_completed`, `description`, `due_date`, `priority`, `status`
- Maintains backward compatibility with FileMaker field names

### 6. New Validation Functions

#### `isValidTimerAdjustment(minutes)`
- Validates adjustment in minutes
- Must be in 6-minute increments
- Returns boolean

#### `isValidTimerAdjustmentSeconds(seconds)`
- Validates adjustment in seconds
- Must be in 360-second (6-minute) increments
- Returns boolean

#### `roundToValidAdjustment(minutes)`
- Rounds minutes to nearest 6-minute increment
- Used for UI slider/input validation

#### `roundToValidAdjustmentSeconds(seconds)`
- Rounds seconds to nearest 360-second increment
- Used for API request preparation

### 7. New Helper Functions

#### `extractFinancialRecord(stopTimerResponse)`
- Extracts financial record from stop timer response
- Returns null if no financial record created (fixed-price project)

#### `extractTimeEntry(stopTimerResponse)`
- Extracts time entry from response
- Handles both backend and FileMaker response formats

#### `formatFinancialRecordForDisplay(financialRecord)`
- Formats financial record for UI display
- Returns formatted amounts, hours, rate, status

**Display Format:**
```javascript
{
  id: string,
  amount: "123.45",
  hours: "2.50",
  rate: "49.38",
  date: "2026-01-14",
  description: string,
  status: "unbilled" | "billed" | "paid",
  isBillable: boolean
}
```

#### `calculateTimerStats(timeEntry)`
- Calculates comprehensive timer statistics
- Includes pause time and adjustments
- Returns billable time in seconds, minutes, hours

**Statistics:**
```javascript
{
  totalSeconds: number,
  pauseSeconds: number,
  adjustmentSeconds: number,
  billableSeconds: number,
  billableMinutes: number,
  billableHours: "2.50"
}
```

## Business Logic Implementation

### Timer Idempotency
- **Frontend Check**: Proactively checks for active timer before starting
- **Backend Enforcement**: Backend enforces single active timer per staff
- **Error Handling**: User-friendly messages when conflict detected

### Concurrency Control
- **One Active Timer Per Staff**: Enforced by backend, validated by frontend
- **Active Timer Detection**: `getActiveTimer()` used on app load
- **Conflict Resolution**: Clear error messages guide user to stop/pause existing timer

### Financial Record Generation
- **Atomic Operation**: Backend creates financial record in same transaction as timer stop
- **Fixed-Price Detection**: Backend checks project type and skips financial record for fixed-price
- **Billable Amount Calculation**: Backend calculates hours × rate
- **Status Tracking**: Financial records start as "unbilled"

### Pause/Resume Accumulation
- **Pause Duration Tracking**: Backend accumulates total pause time
- **Billable Time Calculation**: `(end_time - start_time) - pause_duration + adjustment`
- **State Validation**: Backend validates all state transitions

### Adjustment Validations
- **6-Minute Increments**: Enforced in `stopTimer()` before API call
- **Validation Functions**: `isValidTimerAdjustment()` and `isValidTimerAdjustmentSeconds()`
- **Rounding Functions**: `roundToValidAdjustment()` for UI convenience

## Logging Strategy

All functions include comprehensive logging with `[Task Service]` prefix:

```javascript
console.log('[Task Service] Starting timer for task:', taskId);
console.log('[Task Service] Timer started successfully:', result);
console.log('[Task Service] Stopping timer:', recordId, params);
console.log('[Task Service] Timer stopped successfully:', result);
console.log('[Task Service] Financial record created:', financialRecord);
console.log('[Task Service] No financial record created (fixed-price project)');
console.error('[Task Service] Failed to start timer:', error);
```

## Error Handling

### User-Friendly Error Messages

**Concurrency Errors:**
```
"You already have an active timer running. Please stop or pause it before starting a new one."
```

**State Validation Errors:**
```
"Timer must be active to pause. It may already be paused or completed."
"Timer must be paused to resume. It may be active or already completed."
```

**Adjustment Validation Errors:**
```
"Time adjustment must be in 6-minute (0.1 hour) increments"
```

**FileMaker Compatibility:**
```
"Pause/resume is only available in the web version, not in FileMaker."
```

## Backward Compatibility

### FileMaker Support Maintained
- All existing FileMaker code paths preserved
- Legacy response handling continues to work
- Sales record sync to Supabase still functions

### Dual Response Handling
- Functions detect response format (array vs object)
- Process accordingly for backend or FileMaker
- Consistent internal data structure

### Feature Flags
- Backend API controlled by `USE_BACKEND_API` flag in `api/tasks.js`
- Can switch between backend and FileMaker without code changes
- Allows gradual rollout and testing

## Data Flow

### Start Timer Flow
```
UI → startTimer(task, staffId)
  → getActiveTimer(staffId) [check existing]
  → startTaskTimerAPI(taskId, task)
  → Backend: POST /time-entries/start
  → Return: TimeEntry { status: 'active' }
  → UI: Display running timer
```

### Stop Timer Flow
```
UI → stopTimer(params)
  → Validate adjustment (6-minute increments)
  → stopTaskTimerAPI(entryId, description, saveImmediately, adjustmentSeconds)
  → Backend: POST /time-entries/{id}/stop
  → Backend: Calculate billable time
  → Backend: Check project type (fixed-price?)
  → Backend: Create financial record (if billable)
  → Return: { time_entry, financial_record }
  → extractFinancialRecord(response)
  → formatFinancialRecordForDisplay(financialRecord)
  → UI: Display completed timer + financial record
```

### Pause/Resume Flow
```
UI → pauseTimer(entryId)
  → pauseTimerAPI(entryId)
  → Backend: POST /time-entries/{id}/pause
  → Backend: Track pause start time
  → Return: TimeEntry { status: 'paused' }
  → UI: Display paused state

UI → resumeTimer(entryId)
  → resumeTimerAPI(entryId)
  → Backend: POST /time-entries/{id}/resume
  → Backend: Accumulate pause duration
  → Return: TimeEntry { status: 'active', pause_duration_seconds }
  → UI: Display running timer with pause time
```

## Testing Recommendations

### Unit Tests Needed
1. `startTimer()` with existing active timer
2. `stopTimer()` with invalid adjustment
3. `stopTimer()` with valid adjustment
4. `pauseTimer()` / `resumeTimer()` state validation
5. `processTimerRecords()` with backend response
6. `processTimerRecords()` with FileMaker response
7. `processTaskData()` with backend response
8. `processTaskData()` with FileMaker response
9. Adjustment validation functions
10. Financial record extraction and formatting

### Integration Tests Needed
1. Start timer → check concurrency enforcement
2. Stop timer → verify financial record created
3. Stop timer on fixed-price → verify no financial record
4. Pause → resume → stop → verify pause duration
5. Timer with adjustment → verify 6-minute rounding

## Migration Notes

### Phase 1 (Current)
- Backend API enabled via feature flag
- FileMaker fallback active
- Both code paths functional

### Phase 2 (Next)
- Monitor production for errors
- Collect metrics on timer operations
- Validate financial record creation

### Phase 3 (Future)
- Remove FileMaker fallback code
- Simplify service layer
- Remove legacy response handling

## Files Modified

- `src/services/taskService.js` - All changes made here

## Build Verification

```bash
npm run build
# ✓ built in 2.14s
# No errors, build successful
```

## Next Steps

1. **UI Components** (TSK0007, TSK0008, TSK0010)
   - Update timer display to show pause/resume buttons
   - Add adjustment UI with 6-minute increment controls
   - Display financial record information after timer stop
   - Show active timer on app load

2. **Validation Rules** (TSK0006)
   - Update TASK_FIELDS validation to match backend schema
   - Ensure field-level error handling

3. **Integration** (TSK0011)
   - UI components consume new service layer functions
   - Handle financial record display
   - Implement retry logic for partial failures

## API Reference

**Backend Endpoints Used:**
- `POST /time-entries/start` - Start timer
- `POST /time-entries/{id}/stop` - Stop timer
- `POST /time-entries/{id}/pause` - Pause timer
- `POST /time-entries/{id}/resume` - Resume timer
- `GET /time-entries/active` - Get active timer
- `GET /time-entries?task_id={id}` - Get task timers

**Authentication:** HMAC-SHA256 Bearer token

**Response Format:** JSON with snake_case field names

## Completion Checklist

- [x] Import new timer API functions
- [x] Update `startTimer()` with concurrency control
- [x] Update `stopTimer()` with adjustment validation
- [x] Add `pauseTimer()` function
- [x] Add `resumeTimer()` function
- [x] Add `getActiveTimer()` function
- [x] Update `processTimerRecords()` for backend responses
- [x] Update `processTaskData()` for backend responses
- [x] Add adjustment validation functions
- [x] Add financial record helper functions
- [x] Add comprehensive logging
- [x] Maintain FileMaker backward compatibility
- [x] Verify build compiles successfully
- [x] Document all changes

## Summary

Successfully updated `taskService.js` to handle new backend API integration while maintaining FileMaker backward compatibility. All timer business logic now supports:

- ✅ Timer idempotency (one active timer per staff)
- ✅ Concurrency control with user-friendly errors
- ✅ Atomic financial record generation on timer stop
- ✅ Fixed-price project detection (no financial record)
- ✅ Pause/resume with duration accumulation
- ✅ Adjustment validation (6-minute increments)
- ✅ Comprehensive logging for debugging
- ✅ Dual response handling (backend + FileMaker)
- ✅ User-friendly error messages

The service layer is now ready for UI component integration (TSK0007-TSK0011).
