# Timer Edge Case Test Cases

**Document Version:** 1.0
**Date:** 2026-01-10
**Status:** Test Specification
**Related Documents:**
- `BACKEND_CHANGE_REQUEST_002_TIMER_OPERATIONS.md`
- `TIMER_LIFECYCLE_STATE_MACHINE.md`
- `DEVRECORDS_SUPABASE_MAPPING.md`

---

## Table of Contents

1. [Race Condition Test Cases](#1-race-condition-test-cases)
2. [Offline/Refresh Scenario Test Cases](#2-offlinerefresh-scenario-test-cases)
3. [Partial Failure Recovery Test Cases](#3-partial-failure-recovery-test-cases)
4. [Concurrent Timer Operations Test Cases](#4-concurrent-timer-operations-test-cases)
5. [Pause State Edge Cases](#5-pause-state-edge-cases)
6. [State Synchronization Test Cases](#6-state-synchronization-test-cases)
7. [Financial Integration Edge Cases](#7-financial-integration-edge-cases)
8. [Data Integrity Test Cases](#8-data-integrity-test-cases)

---

## Test Case Template

Each test case follows this structure:

```
TC-XXX: [Test Case Name]
Category: [Race Condition | Offline | Partial Failure | Concurrent | Pause | Sync | Financial | Data]
Priority: [Critical | High | Medium | Low]
Current Behavior: [What happens now]
Expected Behavior: [What should happen]
Preconditions: [Setup required]
Test Steps: [Step-by-step execution]
Success Criteria: [Pass conditions]
Related Code: [File paths and line numbers]
Backend Support Required: [Yes/No - which endpoints]
```

---

## 1. Race Condition Test Cases

### TC-RC-001: Double Start Click (Rapid)
**Category:** Race Condition
**Priority:** Critical
**Current Behavior:** Two API calls sent to FileMaker, potentially creating duplicate timer records. No frontend validation prevents this.
**Expected Behavior:**
- First click creates timer and disables button
- Second click is ignored (button disabled)
- OR: Backend returns `409 CONFLICT` and frontend shows "Timer already active"

**Preconditions:**
- User logged in
- Task selected (has valid ID)
- No active timer running

**Test Steps:**
1. Open task details page
2. Click "Start Timer" button twice rapidly (< 100ms between clicks)
3. Observe API network calls in DevTools
4. Check FileMaker `devRecords` layout for duplicate records
5. Check localStorage `activeTimer` state
6. Check UI button state

**Success Criteria:**
- Only ONE timer record created in FileMaker
- localStorage contains single timer state
- Button is disabled after first click
- No error shown to user
- OR: Second click returns `409 CONFLICT` with clear error message

**Related Code:**
- `src/hooks/useTask.js:204-235` (handleTimerStart)
- `src/api/tasks.js:121-178` (startTaskTimer)
- `src/components/tasks/TaskTimer.jsx` (Start button handler)

**Backend Support Required:** Yes - Active timer validation
- Endpoint: `POST /api/tasks/{task_id}/timer/start`
- Validation: Check for existing active timer for staff member
- Return: `409 CONFLICT` if active timer exists

---

### TC-RC-002: Double Stop Click (Rapid)
**Category:** Race Condition
**Priority:** High
**Current Behavior:** Two UPDATE requests sent to FileMaker for same recordId. Second update might overwrite first with different `TimeEnd` value.
**Expected Behavior:**
- First click stops timer and disables button
- Second click is ignored
- OR: Backend idempotency prevents duplicate processing

**Preconditions:**
- Timer actively running
- Valid recordId in state
- Network latency > 200ms (simulate slow connection)

**Test Steps:**
1. Start timer on a task
2. Wait 30 seconds
3. Click "Stop" button twice rapidly (< 100ms between clicks)
4. Observe network requests
5. Check FileMaker record final `TimeEnd` value
6. Check if duplicate sales records created in Supabase

**Success Criteria:**
- Only ONE update to FileMaker record
- `TimeEnd` reflects first click timestamp (±1 second)
- Only ONE sales record created (if not fixed-price)
- Button disabled after first click
- localStorage cleared only once

**Related Code:**
- `src/hooks/useTask.js:237-277` (handleTimerStop)
- `src/api/tasks.js:189-213` (stopTaskTimer)
- `src/services/taskService.js:82-128` (stopTaskTimer - sales creation)

**Backend Support Required:** Yes - Idempotency
- Endpoint: `POST /api/tasks/{task_id}/timer/stop`
- Header: `X-Idempotency-Key: {uuid}`
- Behavior: Return cached response for duplicate key within 24 hours

---

### TC-RC-003: Start-Pause Race Condition
**Category:** Race Condition
**Priority:** Medium
**Current Behavior:** If pause clicked immediately after start (before FileMaker response), `recordId` might be null when setting pause state.
**Expected Behavior:**
- Pause button disabled until timer start completes
- OR: Pause operation queued until recordId available

**Preconditions:**
- Task selected
- No active timer
- Simulated network latency (500ms)

**Test Steps:**
1. Click "Start Timer"
2. Immediately click "Pause" (< 200ms after start)
3. Observe state transitions in React DevTools
4. Check if `pauseStartTime` is set correctly
5. Check if timer appears paused in UI

**Success Criteria:**
- Pause button is disabled until start completes
- OR: Pause queued and applied after recordId received
- No null reference errors in console
- Final state is `isPaused: true` with valid `recordId`

**Related Code:**
- `src/hooks/useTask.js:204-235` (handleTimerStart)
- `src/hooks/useTask.js` (handleTimerPause - line not specified, find in code)
- `src/components/tasks/TaskTimer.jsx` (button enable/disable logic)

**Backend Support Required:** No - Frontend state management

---

### TC-RC-004: Pause-Resume Race Condition
**Category:** Race Condition
**Priority:** Low
**Current Behavior:** Rapid pause/resume cycles might cause incorrect `totalPauseTime` calculation if state updates overlap.
**Expected Behavior:**
- Pause/resume operations are debounced (minimum 500ms between)
- OR: State updates are queued and applied sequentially

**Preconditions:**
- Timer running for at least 10 seconds
- Valid recordId

**Test Steps:**
1. Start timer
2. Click "Pause"
3. Immediately click "Resume" (< 100ms)
4. Repeat steps 2-3 five times rapidly
5. Click "Stop"
6. Check `TimeAdjust` value in FileMaker record
7. Calculate expected vs actual pause time

**Success Criteria:**
- `totalPauseTime` accurately reflects all pause durations
- No negative pause times
- No state corruption (isPaused stuck as true/false)
- UI reflects correct state after all operations

**Related Code:**
- `src/hooks/useTask.js` (handleTimerPause, handleTimerResume)
- State management for `totalPauseTime` and `pauseStartTime`

**Backend Support Required:** No - Frontend calculation

---

### TC-RC-005: Stop During Pause Calculation
**Category:** Race Condition
**Priority:** Medium
**Current Behavior:** If stop clicked exactly when pause duration is being calculated, race between pause state update and stop operation.
**Expected Behavior:**
- Stop operation includes any in-progress pause duration
- Final `TimeAdjust` is accurate

**Preconditions:**
- Timer running
- Timer is paused
- Pause duration > 5 seconds

**Test Steps:**
1. Start timer
2. Pause timer for 10 seconds
3. Click "Resume"
4. Immediately click "Stop" (< 50ms after resume)
5. Check `TimeAdjust` in FileMaker record
6. Verify pause time was added to total

**Success Criteria:**
- `TimeAdjust` includes the 10-second pause
- No pause duration lost
- Stop operation completes successfully
- No errors in console

**Related Code:**
- `src/hooks/useTask.js:237-277` (handleTimerStop - lines 260-266 calculate pause)
- Pause time calculation logic

**Backend Support Required:** No - Frontend calculation

---

## 2. Offline/Refresh Scenario Test Cases

### TC-OFF-001: Offline Timer Start Attempt
**Category:** Offline
**Priority:** Critical
**Current Behavior:** API call fails with network error. Error shown to user. Timer state NOT saved to localStorage.
**Expected Behavior:**
- Clear error message: "Cannot start timer while offline"
- No partial state saved
- Option to retry when online

**Preconditions:**
- Browser in offline mode (DevTools Network tab)
- Task selected
- No active timer

**Test Steps:**
1. Enable offline mode in DevTools
2. Click "Start Timer"
3. Observe error message
4. Check localStorage (should be empty)
5. Check network tab for failed request
6. Re-enable network
7. Verify retry works

**Success Criteria:**
- Error message clearly states offline issue
- No localStorage entry created
- Retry button available
- Timer starts successfully when online

**Related Code:**
- `src/hooks/useTask.js:204-235` (handleTimerStart error handling)
- `src/api/tasks.js:121-178` (network error handling)
- `src/context/SnackBarContext.jsx` (error display)

**Backend Support Required:** No - Network error handling

---

### TC-OFF-002: Offline Timer Stop Attempt
**Category:** Offline
**Priority:** Critical
**Current Behavior:** API call fails. Error shown. Timer state REMAINS in localStorage (allows retry).
**Expected Behavior:**
- Error message: "Cannot stop timer while offline. Will retry when connection restored."
- Timer state persisted
- Automatic retry when online
- OR: Manual retry button

**Preconditions:**
- Timer actively running
- Valid recordId in state
- Browser goes offline

**Test Steps:**
1. Start timer normally
2. Wait 30 seconds
3. Enable offline mode
4. Click "Stop Timer"
5. Enter description "Offline test"
6. Confirm stop
7. Observe error
8. Check localStorage (timer should still exist)
9. Re-enable network
10. Click retry or reload page
11. Verify stop completes

**Success Criteria:**
- Timer state preserved in localStorage
- Error message informative
- Retry succeeds when online
- FileMaker record updated correctly
- Sales record created (if applicable)
- localStorage cleared after successful retry

**Related Code:**
- `src/hooks/useTask.js:237-277` (handleTimerStop error handling)
- `src/api/tasks.js:189-213` (stopTaskTimer error handling)
- localStorage persistence logic

**Backend Support Required:** Yes - Idempotency for retry safety
- Endpoint: `POST /api/tasks/{task_id}/timer/stop`
- Header: `X-Idempotency-Key`

---

### TC-OFF-003: Page Refresh During Active Timer
**Category:** Offline
**Priority:** High
**Current Behavior:** Timer state restored from localStorage. `TimeStart` preserved. Elapsed time recalculated. Pause state preserved if paused.
**Expected Behavior:**
- Timer continues running with correct elapsed time
- Pause state preserved
- No duplicate timer created

**Preconditions:**
- Timer running for at least 60 seconds
- localStorage contains valid activeTimer

**Test Steps:**
1. Start timer on task
2. Wait 60 seconds
3. Note current elapsed time
4. Hard refresh page (Cmd+Shift+R)
5. Wait for app to reload
6. Check timer UI
7. Verify elapsed time continues from refresh point

**Success Criteria:**
- Timer shows as running
- Elapsed time = (pre-refresh) + (time since refresh)
- `recordId` preserved
- No duplicate FileMaker records created
- UI matches state (running vs paused)

**Related Code:**
- `src/hooks/useTask.js:47-70` (loadTimerFromLocalStorage)
- `src/hooks/useTask.js:72-78` (saveTimerToLocalStorage)
- `src/components/tasks/TaskTimer.jsx` (elapsed time calculation)

**Backend Support Required:** No - Client-side state restoration

---

### TC-OFF-004: Browser Close/Reopen with Active Timer
**Category:** Offline
**Priority:** High
**Current Behavior:** localStorage persists across sessions. Timer state restored when browser reopened.
**Expected Behavior:**
- Timer continues running
- Elapsed time accurate (includes time browser was closed)
- Option to abandon timer if too much time passed

**Preconditions:**
- Timer started and running
- Browser closed (not just tab)
- Reopened after 5+ minutes

**Test Steps:**
1. Start timer on task
2. Note start time
3. Close browser completely
4. Wait 10 minutes
5. Reopen browser
6. Navigate to CRM app
7. Log in if needed
8. Observe timer state

**Success Criteria:**
- Timer shows as running
- Elapsed time includes 10+ minutes
- Option to "Abandon Timer" or "Stop Timer"
- recordId still valid
- Can successfully stop timer

**Related Code:**
- `src/hooks/useTask.js:47-70` (loadTimerFromLocalStorage)
- localStorage deserialization with Date parsing

**Backend Support Required:** Helpful - Active timer endpoint
- Endpoint: `GET /api/tasks/timers/active?staff_id={id}`
- Purpose: Verify localStorage timer matches server state

---

### TC-OFF-005: Network Interruption During Stop Operation
**Category:** Offline
**Priority:** Critical
**Current Behavior:** Request may fail mid-flight. FileMaker record may be partially updated. Sales record not created. User sees error but timer state may be unclear.
**Expected Behavior:**
- Transaction rollback if backend atomicity implemented
- Clear error message
- Safe retry without duplicating

**Preconditions:**
- Timer running
- Network interruption simulated during API call

**Test Steps:**
1. Start timer
2. Wait 30 seconds
3. Click "Stop"
4. As network request sends, disable network (DevTools)
5. Observe error
6. Check FileMaker record (should be unchanged)
7. Check localStorage (timer should still exist)
8. Re-enable network
9. Retry stop operation
10. Verify completion

**Success Criteria:**
- FileMaker record updated only on successful completion
- Sales record created only if FileMaker succeeds
- No orphaned records
- Retry is idempotent (same result)
- User notified of issue clearly

**Related Code:**
- `src/hooks/useTask.js:237-277` (handleTimerStop)
- `src/services/taskService.js:82-128` (sales creation)
- Error handling in API layer

**Backend Support Required:** Yes - Atomicity
- Endpoint: `POST /api/tasks/{task_id}/timer/stop`
- Behavior: Transaction ensures timer update + sales creation together

---

### TC-OFF-006: Refresh During Paused Timer
**Category:** Offline
**Priority:** Medium
**Current Behavior:** Pause state restored from localStorage. `pauseStartTime` deserialized as Date. Timer remains paused.
**Expected Behavior:**
- Timer shows as paused
- Elapsed time frozen at pause point
- Resume/Stop buttons available

**Preconditions:**
- Timer running
- Paused for at least 30 seconds
- Page refreshed

**Test Steps:**
1. Start timer
2. Run for 60 seconds
3. Pause timer
4. Wait 30 seconds (while paused)
5. Hard refresh page
6. Observe timer UI
7. Check elapsed time (should not include pause duration)
8. Click "Resume"
9. Verify timer continues correctly

**Success Criteria:**
- Timer shows as paused after refresh
- Elapsed time does NOT increase during pause
- `totalPauseTime` preserved
- Resume works correctly
- Final stop calculates total pause time accurately

**Related Code:**
- `src/hooks/useTask.js:47-70` (loadTimerFromLocalStorage - line 61 deserializes pauseStartTime)
- Pause state restoration logic

**Backend Support Required:** No - Client-side state

---

## 3. Partial Failure Recovery Test Cases

### TC-PF-001: FileMaker Record Created, Sales Record Fails
**Category:** Partial Failure
**Priority:** Critical
**Current Behavior:** Timer stop updates FileMaker successfully. Sales creation throws error but is caught. Timer marked as stopped. Sales record missing in Supabase.
**Expected Behavior:**
- Option 1: Transaction rollback (requires backend atomicity)
- Option 2: Retry queue for sales creation
- Option 3: Manual reconciliation report

**Preconditions:**
- Timer running on non-fixed-price project
- Supabase API temporarily unavailable
- FileMaker API working

**Test Steps:**
1. Start timer on task (non-fixed-price project)
2. Simulate Supabase error (mock API or service worker)
3. Click "Stop Timer"
4. Enter description
5. Observe error in console
6. Check FileMaker record (should have TimeEnd)
7. Check Supabase `customer_sales` (should be missing)
8. Verify UI shows timer stopped
9. Check for retry mechanism

**Success Criteria:**
- FileMaker record has TimeEnd
- Error logged but user not blocked
- Sales record either:
  - Created on retry, OR
  - Flagged for manual reconciliation, OR
  - Transaction rollback (backend support required)
- No duplicate sales records on retry

**Related Code:**
- `src/services/taskService.js:82-128` (stopTaskTimer - lines 103-125 handle sales creation)
- Error handling at line 122: `catch (error) { console.error(...); return result; }`

**Backend Support Required:** Yes - Atomicity
- Endpoint: `POST /api/tasks/{task_id}/timer/stop`
- Transaction: Timer update + sales creation atomic

---

### TC-PF-002: Sales Record Created, Timer Update Fails
**Category:** Partial Failure
**Priority:** Critical
**Current Behavior:** Not possible currently - timer update happens BEFORE sales creation in code flow.
**Expected Behavior:**
- Should never occur (timer update is prerequisite)
- If occurs, sales record rollback or orphan cleanup

**Preconditions:**
- Timer running
- FileMaker API fails after sales creation

**Test Steps:**
1. Start timer
2. Modify code flow to create sales BEFORE timer update (test only)
3. Simulate FileMaker failure
4. Observe state
5. Check for orphaned sales record
6. Verify cleanup mechanism

**Success Criteria:**
- Transaction rollback prevents orphan
- OR: Orphan sales record flagged for cleanup
- Timer state remains active (can retry)

**Related Code:**
- `src/services/taskService.js:82-128` (current flow: timer first, then sales)
- Would require reordering to test this scenario

**Backend Support Required:** Yes - Transaction atomicity

---

### TC-PF-003: localStorage Write Fails
**Category:** Partial Failure
**Priority:** Medium
**Current Behavior:** Timer state not persisted. Page refresh loses timer. Backend FileMaker record exists but frontend doesn't know recordId.
**Expected Behavior:**
- Error logged
- User warned: "Timer state may be lost on refresh"
- Backend active timer endpoint used to recover on refresh

**Preconditions:**
- localStorage quota exceeded (5MB limit)
- OR: Private browsing mode
- OR: localStorage disabled

**Test Steps:**
1. Fill localStorage to near capacity (store 4.5MB data)
2. Start timer
3. Observe localStorage write failure
4. Refresh page
5. Check if timer state recovered
6. Verify backend active timer endpoint called

**Success Criteria:**
- Error logged in console
- User warned about state loss risk
- Recovery mechanism attempts to fetch active timer from backend
- If recovery fails, user notified to manually check task

**Related Code:**
- `src/hooks/useTask.js:72-78` (saveTimerToLocalStorage)
- localStorage.setItem error handling (currently no try/catch)

**Backend Support Required:** Yes - Active timer recovery
- Endpoint: `GET /api/tasks/timers/active?staff_id={id}`

---

### TC-PF-004: JSON Parse Error on localStorage Restore
**Category:** Partial Failure
**Priority:** Medium
**Current Behavior:** If localStorage corrupted, JSON.parse() throws error. App may crash or timer not restored.
**Expected Behavior:**
- Graceful error handling
- localStorage cleared
- User notified: "Timer state corrupted, please check active tasks"

**Preconditions:**
- localStorage contains invalid JSON (manually corrupted)

**Test Steps:**
1. Start timer normally
2. Manually corrupt localStorage `activeTimer` value:
   ```javascript
   localStorage.setItem('activeTimer', '{invalid json}')
   ```
3. Refresh page
4. Observe error handling
5. Check console for error logs
6. Verify app doesn't crash
7. Check if localStorage cleared

**Success Criteria:**
- App handles parse error gracefully
- Error logged with details
- Corrupted localStorage cleared
- User shown error message
- App remains functional
- Backend queried for active timer

**Related Code:**
- `src/hooks/useTask.js:47-70` (loadTimerFromLocalStorage - line 51 JSON.parse)
- Currently wrapped in try/catch (line 69)

**Backend Support Required:** Helpful - Active timer endpoint for recovery

---

### TC-PF-005: Date Deserialization Failure
**Category:** Partial Failure
**Priority:** Low
**Current Behavior:** `pauseStartTime` deserialized as Date object (line 61). If invalid date string, becomes Invalid Date.
**Expected Behavior:**
- Invalid date detected
- Pause state reset
- Timer continues without pause data

**Preconditions:**
- localStorage has invalid date string for pauseStartTime

**Test Steps:**
1. Start timer
2. Pause timer
3. Manually edit localStorage:
   ```javascript
   const state = JSON.parse(localStorage.getItem('activeTimer'));
   state.pauseStartTime = 'invalid-date';
   localStorage.setItem('activeTimer', JSON.stringify(state));
   ```
4. Refresh page
5. Observe timer state
6. Try to resume
7. Check for errors

**Success Criteria:**
- Invalid date detected (isNaN check)
- Pause state cleared
- Timer remains active
- No crash
- User can continue using timer

**Related Code:**
- `src/hooks/useTask.js:47-70` (loadTimerFromLocalStorage - line 61)
- Date parsing: `timerState.pauseStartTime = new Date(timerState.pauseStartTime)`

**Backend Support Required:** No - Client-side validation

---

## 4. Concurrent Timer Operations Test Cases

### TC-CON-001: Multiple Tabs, Same User, Start Timer in Both
**Category:** Concurrent
**Priority:** Critical
**Current Behavior:** Each tab sends separate START request. Both create FileMaker records. localStorage in each tab has different recordId. Two active timers exist simultaneously.
**Expected Behavior:**
- First tab creates timer
- Second tab receives `409 CONFLICT` error
- OR: Second tab detects existing timer and asks user to continue or abandon

**Preconditions:**
- Two browser tabs open
- Same user logged in both
- Same task selected

**Test Steps:**
1. Open app in Tab 1
2. Open app in Tab 2 (same browser)
3. Navigate to same task in both tabs
4. Click "Start Timer" in Tab 1
5. Click "Start Timer" in Tab 2 (within 1 second)
6. Check FileMaker devRecords for duplicate records
7. Check localStorage in both tabs
8. Observe error messages

**Success Criteria:**
- Only ONE timer record created
- Tab 2 shows error: "Timer already running on this task"
- OR: Tab 2 shows: "Timer already running, do you want to take over?"
- No duplicate timers

**Related Code:**
- `src/hooks/useTask.js:204-235` (handleTimerStart)
- No current validation for existing timer

**Backend Support Required:** Yes - Active timer validation
- Endpoint: `POST /api/tasks/{task_id}/timer/start`
- Validation: Check for existing active timer for staff
- Return: `409 CONFLICT` with active timer details

---

### TC-CON-002: Multiple Tabs, Stop Timer in Both
**Category:** Concurrent
**Priority:** High
**Current Behavior:** Both tabs send UPDATE request to same recordId. Second update overwrites first. Different `TimeEnd` values. Potential data loss.
**Expected Behavior:**
- First stop succeeds
- Second stop returns error: "Timer already stopped"
- OR: Second stop is idempotent (same result)

**Preconditions:**
- Two tabs open
- Timer running (started in Tab 1)
- Both tabs show active timer

**Test Steps:**
1. Start timer in Tab 1
2. Refresh Tab 2 (loads timer from localStorage)
3. Click "Stop" in Tab 1, description: "First stop"
4. Immediately click "Stop" in Tab 2, description: "Second stop"
5. Check FileMaker record TimeEnd
6. Check if both descriptions saved
7. Check Supabase for duplicate sales records

**Success Criteria:**
- Only ONE TimeEnd value (from first stop)
- Only ONE sales record created
- Second stop either:
  - Returns error, OR
  - Is idempotent (same TimeEnd)
- No data corruption

**Related Code:**
- `src/hooks/useTask.js:237-277` (handleTimerStop)
- `src/api/tasks.js:189-213` (stopTaskTimer)

**Backend Support Required:** Yes - Idempotency
- Endpoint: `POST /api/tasks/{task_id}/timer/stop`
- Header: `X-Idempotency-Key`
- OR: Status check - if timer already stopped, return 409

---

### TC-CON-003: Different Users, Start Timer on Same Task
**Category:** Concurrent
**Priority:** Medium
**Current Behavior:** Each user creates separate timer record. Both timers active simultaneously on same task. Allowed in current implementation.
**Expected Behavior:**
- Both timers allowed (users work independently)
- OR: Warning shown: "Another user has timer running on this task"
- Each timer tracked separately

**Preconditions:**
- User A and User B logged in (different browsers/devices)
- Same task selected
- No active timers

**Test Steps:**
1. User A starts timer on Task X
2. User B starts timer on Task X (within 5 seconds)
3. Check FileMaker for two records
4. Both users stop timers
5. Check for conflicts in data
6. Verify both timers created separate records

**Success Criteria:**
- Two separate timer records created (different staffIDs)
- Both can stop independently
- No conflicts or errors
- Sales records created for both
- OR: Second user warned of existing timer

**Related Code:**
- `src/hooks/useTask.js:204-235` (handleTimerStart)
- No validation for other users' timers

**Backend Support Required:** Optional - Multi-user awareness
- Endpoint: `GET /api/tasks/{task_id}/timers/active`
- Returns: All active timers for task (all users)
- UI: Show warning if other users have active timers

---

### TC-CON-004: Start Timer While Another Timer Active (Different Task)
**Category:** Concurrent
**Priority:** High
**Current Behavior:** No validation. Multiple active timers allowed. localStorage only stores ONE timer (last started). UI shows only one timer. First timer "lost" in UI but exists in FileMaker.
**Expected Behavior:**
- Warning: "You have an active timer on another task. Stop it first?"
- Option to auto-stop previous timer
- OR: Backend prevents multiple active timers per user

**Preconditions:**
- Timer running on Task A
- User navigates to Task B

**Test Steps:**
1. Start timer on Task A
2. Navigate to Task B
3. Click "Start Timer" on Task B
4. Observe warning message
5. Check localStorage (should have Task A timer)
6. Check FileMaker for both records
7. Attempt to stop Task B timer
8. Verify Task A timer status

**Success Criteria:**
- User warned about existing timer
- Option to auto-stop Task A timer before starting Task B
- OR: Error: "Stop active timer before starting new one"
- Only ONE active timer per user enforced

**Related Code:**
- `src/hooks/useTask.js:204-235` (handleTimerStart)
- No validation for other active timers
- localStorage overwrites on second start

**Backend Support Required:** Yes - Active timer enforcement
- Endpoint: `POST /api/tasks/{task_id}/timer/start`
- Validation: Check for ANY active timer for staff (not just this task)
- Return: `409 CONFLICT` with details of existing timer

---

### TC-CON-005: Pause in Tab 1, Resume in Tab 2
**Category:** Concurrent
**Priority:** Medium
**Current Behavior:** Pause state stored in localStorage. Tab 2 has stale localStorage. Resume in Tab 2 doesn't know about Tab 1's pause. State inconsistent between tabs.
**Expected Behavior:**
- Pause state synced via backend
- OR: Tab 2 detects stale state and refreshes
- OR: Warning shown about stale state

**Preconditions:**
- Two tabs open
- Timer running (started in Tab 1)
- Both tabs loaded from localStorage

**Test Steps:**
1. Start timer in Tab 1
2. Reload Tab 2 (restores timer from localStorage)
3. Pause in Tab 1
4. Switch to Tab 2
5. Click "Resume" in Tab 2 (doesn't know about pause)
6. Check final state
7. Stop timer
8. Verify totalPauseTime accuracy

**Success Criteria:**
- Pause state synced between tabs
- OR: Tab 2 shows error: "Timer state out of sync, please refresh"
- Final totalPauseTime is accurate
- No lost pause durations

**Related Code:**
- `src/hooks/useTask.js` (pause/resume handlers)
- localStorage synchronization

**Backend Support Required:** Yes - Pause state on server
- Endpoint: `PATCH /api/tasks/{task_id}/timer/pause`
- State: Pause time stored server-side
- All clients query server for current state

---

## 5. Pause State Edge Cases

### TC-PAUSE-001: Pause for Extended Duration (> 24 hours)
**Category:** Pause
**Priority:** Low
**Current Behavior:** Pause duration calculated from `pauseStartTime`. No maximum pause duration enforced. Extended pause included in `TimeAdjust`.
**Expected Behavior:**
- Pause duration accurately calculated
- OR: Warning for pauses > 8 hours
- OR: Auto-stop timer if paused > 24 hours

**Preconditions:**
- Timer running
- System date/time manipulation OR wait 24 hours

**Test Steps:**
1. Start timer
2. Pause timer
3. Advance system time by 25 hours (OR wait 25 hours)
4. Resume timer
5. Check totalPauseTime calculation
6. Stop timer
7. Verify TimeAdjust value

**Success Criteria:**
- Pause duration = 25 hours (90,000 seconds)
- TimeAdjust includes full pause time
- No integer overflow
- OR: Timer auto-stopped with warning
- FileMaker record accurate

**Related Code:**
- `src/hooks/useTask.js` (pause/resume time calculation)
- Date arithmetic for pause duration

**Backend Support Required:** No - Frontend calculation

---

### TC-PAUSE-002: Pause Immediately After Start (< 1 second)
**Category:** Pause
**Priority:** Low
**Current Behavior:** `pauseStartTime` set to current time. `totalPauseTime` remains 0 until resume. Valid state.
**Expected Behavior:**
- Pause allowed immediately
- Resume calculates correct duration
- No negative durations

**Preconditions:**
- Timer just started
- recordId valid

**Test Steps:**
1. Start timer
2. Click "Pause" within 1 second
3. Wait 10 seconds
4. Click "Resume"
5. Verify totalPauseTime ≈ 10 seconds
6. Stop timer
7. Check TimeAdjust

**Success Criteria:**
- Pause accepted immediately
- totalPauseTime ≈ 10 seconds
- No errors
- TimeAdjust accurate

**Related Code:**
- `src/hooks/useTask.js` (handleTimerPause, handleTimerResume)

**Backend Support Required:** No

---

### TC-PAUSE-003: Multiple Pause/Resume Cycles
**Category:** Pause
**Priority:** Medium
**Current Behavior:** Each pause adds duration to `totalPauseTime`. Accumulated across multiple cycles.
**Expected Behavior:**
- All pause durations summed correctly
- No cumulative rounding errors

**Preconditions:**
- Timer running

**Test Steps:**
1. Start timer
2. Pause for 10 seconds, resume
3. Pause for 15 seconds, resume
4. Pause for 20 seconds, resume
5. Pause for 5 seconds, resume
6. Stop timer
7. Expected totalPauseTime = 50 seconds
8. Verify TimeAdjust

**Success Criteria:**
- totalPauseTime = 50 seconds (±2 sec tolerance)
- Each cycle adds correctly
- No state corruption
- Final TimeAdjust accurate

**Related Code:**
- `src/hooks/useTask.js` (pause/resume accumulation logic)

**Backend Support Required:** No

---

### TC-PAUSE-004: Resume Without Prior Pause
**Category:** Pause
**Priority:** Medium
**Current Behavior:** If `isPaused` is false, resume button should be disabled. If called programmatically, `pauseStartTime` is null, calculation fails.
**Expected Behavior:**
- Resume button disabled when not paused
- Programmatic call returns error
- No state corruption

**Preconditions:**
- Timer running
- NOT paused

**Test Steps:**
1. Start timer
2. Verify "Resume" button is disabled
3. Programmatically call handleTimerResume()
4. Check for error handling
5. Verify state unchanged

**Success Criteria:**
- Resume button disabled in UI
- Programmatic call either no-op or error logged
- State remains valid
- No null reference errors

**Related Code:**
- `src/hooks/useTask.js` (handleTimerResume)
- `src/components/tasks/TaskTimer.jsx` (button enable/disable)

**Backend Support Required:** No

---

### TC-PAUSE-005: Pause When Already Paused
**Category:** Pause
**Priority:** Low
**Current Behavior:** If `isPaused` is true, pause button should be disabled. If called, `pauseStartTime` overwritten.
**Expected Behavior:**
- Pause button disabled when already paused
- Programmatic call is no-op
- No pause time lost

**Preconditions:**
- Timer running and paused

**Test Steps:**
1. Start timer
2. Pause timer
3. Verify "Pause" button disabled
4. Programmatically call handleTimerPause()
5. Check pauseStartTime unchanged
6. Resume and stop
7. Verify totalPauseTime accurate

**Success Criteria:**
- Pause button disabled when paused
- Second pause call is no-op
- pauseStartTime not overwritten
- totalPauseTime accurate

**Related Code:**
- `src/hooks/useTask.js` (handleTimerPause)
- `src/components/tasks/TaskTimer.jsx` (button logic)

**Backend Support Required:** No

---

## 6. State Synchronization Test Cases

### TC-SYNC-001: localStorage Out of Sync with Backend
**Category:** Sync
**Priority:** High
**Current Behavior:** No backend state verification. localStorage is source of truth. If backend record deleted manually, frontend still thinks timer active.
**Expected Behavior:**
- On app init, query backend for active timer
- If mismatch, use backend state
- Clear stale localStorage

**Preconditions:**
- localStorage has active timer
- Backend record manually deleted (FileMaker admin)

**Test Steps:**
1. Start timer normally
2. Manually delete FileMaker devRecords record (admin access)
3. Refresh app
4. Observe timer state
5. Check if backend queried
6. Verify localStorage cleared if backend has no active timer

**Success Criteria:**
- App queries backend on init
- Detects missing backend record
- Clears localStorage
- User notified: "Timer record not found, state cleared"

**Related Code:**
- `src/hooks/useTask.js:47-70` (loadTimerFromLocalStorage)
- Needs backend verification step

**Backend Support Required:** Yes - Active timer verification
- Endpoint: `GET /api/tasks/timers/active?staff_id={id}`

---

### TC-SYNC-002: Backend Has Active Timer, localStorage Empty
**Category:** Sync
**Priority:** High
**Current Behavior:** Timer exists in backend but localStorage cleared (different device, cache clear, etc.). User doesn't see active timer.
**Expected Behavior:**
- On app init, query backend
- If active timer found, restore to localStorage
- Show timer in UI

**Preconditions:**
- Timer started on Device A
- User logs in on Device B (no localStorage)

**Test Steps:**
1. Start timer on Device A
2. Log in on Device B (different browser/device)
3. Navigate to task
4. Observe timer state
5. Verify backend queried
6. Check if timer restored

**Success Criteria:**
- Backend queried on app init
- Active timer found
- Timer state restored to Device B
- UI shows running timer
- Can stop timer from Device B

**Related Code:**
- `src/hooks/useTask.js` (initialization)
- Needs backend query on mount

**Backend Support Required:** Yes - Active timer endpoint
- Endpoint: `GET /api/tasks/timers/active?staff_id={id}`

---

### TC-SYNC-003: Time Zone Change During Active Timer
**Category:** Sync
**Priority:** Low
**Current Behavior:** `TimeStart` stored as HH:MM:SS string (local time). If timezone changes, elapsed calculation may be incorrect.
**Expected Behavior:**
- Use UTC timestamps for calculations
- Display in local timezone
- Elapsed time unaffected by timezone change

**Preconditions:**
- Timer running
- User travels across timezones (OR manually change system timezone)

**Test Steps:**
1. Start timer at 10:00 AM PST
2. Run for 30 minutes
3. Change system timezone to EST (3 hours ahead)
4. Observe timer UI
5. Wait 10 minutes
6. Stop timer
7. Verify total elapsed time = 40 minutes (not affected by timezone)

**Success Criteria:**
- Elapsed time accurate (40 minutes)
- TimeEnd reflects local time
- No negative durations
- TimeAdjust unaffected by timezone

**Related Code:**
- `src/hooks/useTask.js` (time calculations)
- `src/api/tasks.js` (time formatting for FileMaker)

**Backend Support Required:** Helpful - UTC storage
- Database: Store start_time as TIMESTAMP WITH TIME ZONE
- API: Accept/return ISO 8601 UTC timestamps

---

### TC-SYNC-004: System Time Change During Active Timer
**Category:** Sync
**Priority:** Medium
**Current Behavior:** If system time changes (DST, manual adjustment), elapsed time calculation may jump.
**Expected Behavior:**
- Detect system time anomaly
- Use monotonic clock if available
- OR: Warning shown to user

**Preconditions:**
- Timer running
- System time manually changed

**Test Steps:**
1. Start timer
2. Run for 10 minutes
3. Manually set system time back 1 hour
4. Observe timer UI (may show negative elapsed)
5. Wait 5 minutes
6. Stop timer
7. Check TimeEnd and duration

**Success Criteria:**
- Anomaly detected
- User warned: "System time changed, timer may be inaccurate"
- OR: Use performance.now() for elapsed calculation
- No crash or negative durations

**Related Code:**
- `src/hooks/useTask.js` (elapsed time calculation)
- `src/components/tasks/TaskTimer.jsx` (display logic)

**Backend Support Required:** No - Frontend detection

---

## 7. Financial Integration Edge Cases

### TC-FIN-001: Fixed-Price Project Timer Stop (No Sales Record)
**Category:** Financial
**Priority:** High
**Current Behavior:** Checks `customers_Projects::f_fixedPrice > 0`. If true, skips sales record creation.
**Expected Behavior:**
- Timer stops successfully
- No sales record created
- User informed time logged but not billed

**Preconditions:**
- Project has f_fixedPrice > 0
- Timer running on task in this project

**Test Steps:**
1. Identify fixed-price project (check FileMaker)
2. Start timer on task in this project
3. Run for 30 minutes
4. Stop timer with description
5. Verify FileMaker record created
6. Check Supabase customer_sales (should be empty for this timer)
7. Verify no errors shown

**Success Criteria:**
- FileMaker record created with TimeEnd
- NO Supabase sales record
- No errors logged
- User sees timer stopped successfully

**Related Code:**
- `src/services/taskService.js:82-128` (stopTaskTimer - lines 103-114 check f_fixedPrice)

**Backend Support Required:** No - Current behavior correct

---

### TC-FIN-002: Hourly Rate Missing or Zero
**Category:** Financial
**Priority:** Medium
**Current Behavior:** Sales record created with hourly_rate from financial record. If zero or null, sales record has $0 amount.
**Expected Behavior:**
- Sales record created with $0 if rate missing
- OR: Warning shown: "No hourly rate set for customer"

**Preconditions:**
- Customer has no hourly rate configured
- Timer running on non-fixed-price project

**Test Steps:**
1. Ensure customer hourly rate = 0 or null
2. Start timer
3. Run for 1 hour
4. Stop timer
5. Check Supabase sales record
6. Verify amount = 0
7. Check for warnings

**Success Criteria:**
- Sales record created
- hourly_rate = 0
- total_amount = 0
- User warned about missing rate
- OR: Sale flagged for manual review

**Related Code:**
- `src/services/taskService.js:82-128` (sales creation uses financial.Hourly_Rate)

**Backend Support Required:** Helpful - Validation
- Endpoint: `POST /api/tasks/{task_id}/timer/stop`
- Validation: Warn if hourly_rate = 0

---

### TC-FIN-003: Financial Record Not Found by recordId
**Category:** Financial
**Priority:** High
**Current Behavior:** Fetches financial record by recordId. If not found, throws error "Financial record not found". Caught and logged. Timer stop continues.
**Expected Behavior:**
- Error logged
- User notified: "Timer stopped but billing record not created"
- Admin alerted for manual reconciliation

**Preconditions:**
- Timer started normally
- FileMaker record exists
- Financial record deleted or missing

**Test Steps:**
1. Start timer
2. Manually delete financial record in FileMaker (admin)
3. Stop timer
4. Observe error handling
5. Check FileMaker timer record (should have TimeEnd)
6. Check Supabase sales (should be empty)
7. Verify error logged

**Success Criteria:**
- Timer stop completes
- TimeEnd set in FileMaker
- Error logged: "Financial record not found"
- User notified of issue
- No crash

**Related Code:**
- `src/services/taskService.js:82-128` (lines 85-95 fetch financial record)

**Backend Support Required:** Helpful - Better error handling

---

### TC-FIN-004: Duplicate Sales Record Prevention
**Category:** Financial
**Priority:** Critical
**Current Behavior:** No idempotency check. If stop retried, duplicate sales records created.
**Expected Behavior:**
- Sales creation is idempotent
- Check for existing sales record by timer_id/recordId
- Skip creation if exists

**Preconditions:**
- Timer stopped once (sales record created)
- Stop retried (network error recovery)

**Test Steps:**
1. Start timer
2. Stop timer (sales record created)
3. Simulate retry by calling stopTaskTimer again with same recordId
4. Check Supabase customer_sales for duplicates
5. Verify only ONE sales record exists

**Success Criteria:**
- Only ONE sales record in Supabase
- Second stop either:
  - Detects existing sales and skips creation, OR
  - Uses upsert with unique constraint
- No duplicate charges

**Related Code:**
- `src/services/taskService.js:82-128` (sales creation - no duplicate check currently)

**Backend Support Required:** Yes - Idempotency
- Endpoint: `POST /api/tasks/{task_id}/timer/stop`
- Unique constraint on timer_id in sales table
- OR: Check for existing record before insert

---

### TC-FIN-005: Organization ID Missing (Sales Creation Fails)
**Category:** Financial
**Priority:** High
**Current Behavior:** Falls back to `window.state?.user?.supabaseOrgID`. If not found, logs warning and skips sales creation.
**Expected Behavior:**
- Error logged
- User notified: "Organization not found, billing record not created"
- Admin alerted

**Preconditions:**
- User logged in without organization_id
- window.state.user.supabaseOrgID undefined

**Test Steps:**
1. Clear window.state.user.supabaseOrgID
2. Start timer on non-fixed-price project
3. Stop timer
4. Observe warning in console
5. Check Supabase sales (should be empty)
6. Verify timer stopped in FileMaker

**Success Criteria:**
- Warning logged: "Organization ID not found"
- Sales record NOT created
- Timer stop completes
- User notified of issue
- FileMaker record correct

**Related Code:**
- `src/services/taskService.js:82-128` (lines 97-102 handle organization_id)

**Backend Support Required:** No - Better frontend validation

---

## 8. Data Integrity Test Cases

### TC-DATA-001: Invalid Task ID
**Category:** Data Integrity
**Priority:** High
**Current Behavior:** Validation checks `!task?.id`. If invalid, throws error "Invalid task for timer". User sees error.
**Expected Behavior:**
- Error shown immediately on start attempt
- No API call made
- No partial state created

**Preconditions:**
- Task object missing ID
- OR: Task ID is null/undefined

**Test Steps:**
1. Navigate to task with no ID (edge case)
2. Click "Start Timer"
3. Observe error message
4. Verify no API call in network tab
5. Check localStorage (should be empty)

**Success Criteria:**
- Error shown: "Cannot start timer: Invalid task"
- No FileMaker record created
- No localStorage entry
- No network request sent

**Related Code:**
- `src/services/taskService.js:31-33` (startTaskTimer validation)

**Backend Support Required:** No - Frontend validation sufficient

---

### TC-DATA-002: Invalid Staff ID
**Category:** Data Integrity
**Priority:** High
**Current Behavior:** Passed to FileMaker API. FileMaker may reject or create record with invalid FK.
**Expected Behavior:**
- Frontend validates staff ID before API call
- OR: Backend returns validation error

**Preconditions:**
- User logged in but staff_id is null/invalid

**Test Steps:**
1. Modify window.state.user.fmStaffID to invalid value
2. Start timer
3. Observe error handling
4. Check FileMaker record

**Success Criteria:**
- Error shown: "Invalid staff ID"
- No FileMaker record created
- OR: Backend validation error returned

**Related Code:**
- `src/hooks/useTask.js:204-235` (handleTimerStart - gets staffId)
- No validation before API call

**Backend Support Required:** Yes - FK validation
- Endpoint: `POST /api/tasks/{task_id}/timer/start`
- Validation: Verify staff_id exists

---

### TC-DATA-003: TimeEnd Before TimeStart
**Category:** Data Integrity
**Priority:** Medium
**Current Behavior:** Unlikely due to sequential flow. But if system time changes or manual edit, possible.
**Expected Behavior:**
- Backend detects invalid time range
- Returns validation error
- Timer not stopped

**Preconditions:**
- Timer started
- System time changed backward
- OR: Manual FileMaker edit

**Test Steps:**
1. Start timer at 10:00 AM
2. Change system time to 9:00 AM
3. Stop timer (TimeEnd = 9:00 AM)
4. Check FileMaker record
5. Verify validation

**Success Criteria:**
- Validation error: "End time cannot be before start time"
- Timer remains active
- OR: Backend adjusts TimeEnd to max(TimeEnd, TimeStart + 1 second)

**Related Code:**
- `src/api/tasks.js:189-213` (stopTaskTimer - no validation)

**Backend Support Required:** Yes - Timestamp validation
- Endpoint: `POST /api/tasks/{task_id}/timer/stop`
- CHECK constraint: end_time > start_time

---

### TC-DATA-004: Negative TimeAdjust
**Category:** Data Integrity
**Priority:** Low
**Current Behavior:** Adjustment increments are ±360 seconds (±6 minutes). Multiple negative adjustments could result in negative totalPauseTime + adjustment.
**Expected Behavior:**
- Prevent negative total adjustment
- OR: Allow negative as manual time reduction
- Clear semantics in UI

**Preconditions:**
- Timer running
- Multiple negative adjustments applied

**Test Steps:**
1. Start timer
2. Run for 5 minutes
3. Click "-6 min" adjustment
4. Click "-6 min" again (total = -12 min)
5. Stop timer immediately
6. Check TimeAdjust value (should be -720 seconds)
7. Verify FileMaker accepts negative

**Success Criteria:**
- FileMaker accepts negative TimeAdjust
- OR: Frontend prevents negative total
- Final billable time = max(0, actual_time + adjustment)
- No data corruption

**Related Code:**
- `src/hooks/useTask.js` (handleTimerAdjust)
- `src/services/taskService.js:27-29` (isValidTimerAdjustment)

**Backend Support Required:** Optional - Validation
- Decide: Allow negative adjustments or not?

---

### TC-DATA-005: TimeAdjust Not Multiple of 360 Seconds
**Category:** Data Integrity
**Priority:** Low
**Current Behavior:** Frontend only allows ±360 second increments. Manual edits could bypass.
**Expected Behavior:**
- Backend validates adjustment is multiple of 360
- OR: Accept any value (remove constraint)

**Preconditions:**
- Manual API call or FileMaker edit

**Test Steps:**
1. Start timer
2. Manually call API with TimeAdjust = 100 (not multiple of 360)
3. Check if FileMaker accepts
4. Verify validation

**Success Criteria:**
- Backend validates and rejects non-360 multiples
- OR: Accepts any value (remove business rule)
- Clear documentation of constraint

**Related Code:**
- `src/services/taskService.js:27-29` (isValidTimerAdjustment)
- Frontend enforces, backend may not

**Backend Support Required:** Optional - Validation alignment

---

## Test Execution Strategy

### Priority Levels
- **Critical**: Must pass before production deployment
- **High**: Important for data integrity and user experience
- **Medium**: Edge cases that may occur occasionally
- **Low**: Rare scenarios or nice-to-have validations

### Testing Phases

**Phase 1: Backend Implementation** (When backend endpoints ready)
- All tests marked "Backend Support Required: Yes"
- Focus on TC-RC-001, TC-RC-002, TC-OFF-002, TC-CON-001, TC-CON-004, TC-PF-001

**Phase 2: Frontend Updates** (After backend deployed)
- Update frontend to use new endpoints
- Add idempotency headers
- Implement active timer recovery
- Focus on TC-SYNC-001, TC-SYNC-002, TC-OFF-003, TC-OFF-004

**Phase 3: Edge Case Hardening**
- Test all offline scenarios
- Test all concurrent operations
- Test all pause edge cases
- Focus on TC-OFF-*, TC-CON-*, TC-PAUSE-*

**Phase 4: Financial Integration**
- Test all financial edge cases
- Verify atomicity of timer + sales
- Test idempotency of sales creation
- Focus on TC-FIN-*

**Phase 5: Data Integrity**
- Validation testing
- Boundary testing
- Focus on TC-DATA-*

### Automated Testing Recommendations

**Unit Tests:**
- Timer state calculations (pause duration, elapsed time)
- Validation functions (isValidTimerAdjustment, etc.)
- localStorage serialization/deserialization

**Integration Tests:**
- API call sequences (start → pause → resume → stop)
- Error handling flows
- Retry mechanisms

**E2E Tests (Playwright):**
- Happy path: Start → Stop
- Pause/Resume cycles
- Page refresh with active timer
- Multi-tab scenarios (use multiple browser contexts)

### Manual Testing Requirements

**Critical Scenarios (Must test manually):**
- Offline/online transitions
- System time changes
- Network interruptions during operations
- Multi-device scenarios
- Browser close/reopen

---

## Test Data Requirements

### FileMaker Test Data
- At least 3 customers (1 fixed-price, 2 hourly)
- At least 5 projects (mix of fixed-price and hourly)
- At least 10 tasks across projects
- Staff records with valid IDs
- Financial records with varying hourly rates

### Supabase Test Data
- Organization records
- Customer records (synced from FileMaker)
- Existing sales records for comparison

### Test Users
- User A: Normal user (most tests)
- User B: Concurrent testing
- Admin User: Manual data manipulation

---

## Success Metrics

### Code Coverage
- Timer state management: > 90%
- API error handling: > 85%
- Validation functions: 100%

### Bug Detection
- All Critical test cases pass
- At least 90% of High priority tests pass
- Known issues documented for Medium/Low failures

### Performance
- Timer start: < 500ms (network dependent)
- Timer stop: < 1000ms (includes sales creation)
- State restore from localStorage: < 50ms
- Backend active timer query: < 300ms

---

## Known Limitations

1. **Pause state not server-synced** (current implementation)
   - Multi-tab pause/resume not synchronized
   - Requires backend pause endpoint for full sync

2. **localStorage-only state** (current implementation)
   - Cross-device not supported
   - Requires backend active timer endpoint

3. **Non-atomic timer + sales** (current implementation)
   - Possible orphaned sales records
   - Requires backend transaction support

4. **No idempotency** (current implementation)
   - Retries create duplicates
   - Requires backend idempotency keys

---

## Test Case Tracking

Use this table to track test execution:

| Test Case | Status | Date Tested | Tester | Notes | Issues Found |
|-----------|--------|-------------|--------|-------|--------------|
| TC-RC-001 | | | | | |
| TC-RC-002 | | | | | |
| ... | | | | | |

**Status Values:**
- `Not Started`: Test not yet executed
- `In Progress`: Currently testing
- `Passed`: All success criteria met
- `Failed`: One or more criteria not met
- `Blocked`: Cannot test (missing prerequisites)
- `Skipped`: Intentionally not tested

---

## Related Documentation

- **Backend API Spec**: `BACKEND_CHANGE_REQUEST_002_TIMER_OPERATIONS.md`
- **State Machine**: `TIMER_LIFECYCLE_STATE_MACHINE.md`
- **Data Mapping**: `DEVRECORDS_SUPABASE_MAPPING.md`
- **Migration Requirements**: `tasks.json` (task ID: tasks-migration-requirements)
- **Implementation Code**:
  - `src/hooks/useTask.js:204-277` (timer operations)
  - `src/services/taskService.js:25-128` (timer business logic)
  - `src/api/tasks.js:121-213` (timer API calls)

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-10 | System | Initial test case specification |

---

**END OF DOCUMENT**
