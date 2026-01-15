# Task Lifecycle Integration Tests

## Overview

Comprehensive end-to-end integration tests for the complete task lifecycle:
- Create task → start timer → stop timer → verify financial record
- Fixed-price project handling (no financial records)
- Concurrent timer prevention
- Pause/resume functionality
- Timer adjustments (6-minute increments)
- Error recovery scenarios

## Test Coverage

### 1. Complete Task Lifecycle (Hourly Project)

**Purpose:** Verify the golden path for billable time tracking

**Steps:**
1. Create a new task
2. Start a timer for the task
3. Simulate work (3 seconds)
4. Stop the timer with a description
5. Verify financial record was created
6. Verify financial record has valid amounts, hours, and rate
7. Verify calculation: amount = hours × rate

**Expected Results:**
- Task created successfully
- Timer starts without errors
- Timer stops successfully
- Financial record is included in response
- Financial record has positive amount, hours, and rate
- Financial record calculation is accurate (±$0.01)

**Pass Criteria:**
- All steps complete without errors
- Financial record exists and is valid
- Calculations are accurate

---

### 2. Fixed-Price Project (No Financial Record)

**Purpose:** Verify fixed-price projects do not generate billable records

**Steps:**
1. Create a task on a fixed-price project
2. Start a timer (is_billable = false)
3. Simulate work (2 seconds)
4. Stop the timer
5. Verify NO financial record was created

**Expected Results:**
- Task and timer creation succeed
- Timer stops successfully
- Financial record is null or absent in response
- Time tracking data is still recorded for project management

**Pass Criteria:**
- Timer operations succeed
- No financial record is returned
- Time entry exists for internal tracking

**Business Logic:**
Fixed-price projects should NOT generate billable financial records because:
- Project is billed at a flat rate, not hourly
- Time tracking is for internal project management only
- Invoicing is handled separately based on milestones

---

### 3. Concurrent Timer Prevention

**Purpose:** Verify staff cannot have multiple active timers simultaneously

**Steps:**
1. Create two tasks
2. Start timer on first task
3. Attempt to start timer on second task (should fail)
4. Verify error response is HTTP 409 Conflict
5. Stop first timer
6. Start timer on second task (should succeed)

**Expected Results:**
- First timer starts successfully
- Second timer start fails with 409 Conflict
- Error message indicates "already has an active timer"
- After stopping first timer, second timer can start

**Pass Criteria:**
- Concurrent timer attempt returns 409 status
- Error message is user-friendly
- After stopping first timer, second timer starts successfully

**Idempotency:**
- Backend enforces one active timer per staff member
- Frontend checks active timer before starting (better UX)
- Database constraint prevents race conditions

---

### 4. Pause and Resume Timer

**Purpose:** Verify pause/resume functionality and pause time exclusion

**Steps:**
1. Create task and start timer
2. Wait 2 seconds (active time)
3. Pause the timer
4. Wait 2 seconds (paused time - should not be billable)
5. Resume the timer
6. Verify pause duration was tracked
7. Stop the timer
8. Verify pause time was excluded from billable hours

**Expected Results:**
- Timer pauses successfully (status = 'paused')
- Timer resumes successfully (status = 'active')
- `pause_duration_seconds` is tracked (≈2 seconds)
- Financial record billable hours < total time due to pause
- Pause time is not included in billing

**Pass Criteria:**
- Pause operation succeeds and sets status to 'paused'
- Resume operation succeeds and sets status to 'active'
- Pause duration is recorded and > 0
- Billable hours exclude pause time

**Calculation:**
```
Total Time = 4+ seconds (2 active before pause + 2 paused + time after resume)
Pause Time = ~2 seconds
Billable Time = Total Time - Pause Time
```

---

### 5. Timer Adjustment (6-minute increments)

**Purpose:** Verify timer adjustment validation and application

**Steps:**
1. Create task and start timer
2. Wait 2 seconds
3. Stop timer with +360 second adjustment (6 minutes, valid)
4. Verify adjustment was applied correctly
5. Create second task and start timer
6. Attempt to stop with +300 second adjustment (5 minutes, invalid)
7. Verify invalid adjustment is rejected or rounded

**Expected Results:**
- Valid adjustment (360s) is accepted and applied
- Invalid adjustment (300s) is rejected with validation error
- Or: Invalid adjustment is rounded to nearest valid increment

**Pass Criteria:**
- Valid 6-minute adjustment succeeds
- Invalid adjustment fails with HTTP 422 or is auto-rounded
- Adjustment is reflected in billable time calculation

**Business Logic:**
- Time adjustments must be in 6-minute (0.1 hour) increments
- This aligns with billing practices (0.1h = $X increments)
- Backend validates: `adjustment_seconds % 360 === 0`

---

### 6. Error Recovery Paths

**Purpose:** Verify graceful error handling and recovery

**Test Cases:**

#### 6.1 Stop Non-Existent Timer
- Attempt to stop a timer that doesn't exist
- Expected: HTTP 404 Not Found
- Pass Criteria: Appropriate error message, no server crash

#### 6.2 Start Timer on Non-Existent Task
- Attempt to start timer for a task that doesn't exist
- Expected: HTTP 404 or 422 Unprocessable Entity
- Pass Criteria: Appropriate error message, referential integrity maintained

#### 6.3 Pause Already Paused Timer
- Create timer, pause it
- Attempt to pause again
- Expected: HTTP 400 Bad Request with "must be active" message
- Pass Criteria: Idempotent operation, clear error message

**Pass Criteria:**
- All error scenarios return appropriate HTTP status codes
- Error messages are clear and actionable
- No server crashes or unhandled exceptions
- Database remains in consistent state

---

## Running the Tests

### Prerequisites

1. **Backend API Running:**
   ```bash
   https://api.claritybusinesssolutions.ca
   ```

2. **Environment Variables:**
   Create `.env` file with:
   ```env
   VITE_API_URL=https://api.claritybusinesssolutions.ca
   VITE_SECRET_KEY=your_hmac_secret_key
   TEST_CUSTOMER_ID=00000000-0000-0000-0000-000000000001
   TEST_PROJECT_ID=00000000-0000-0000-0000-000000000002
   TEST_FIXED_PRICE_PROJECT_ID=00000000-0000-0000-0000-000000000003
   TEST_STAFF_ID=00000000-0000-0000-0000-000000000004
   TEST_ORG_ID=00000000-0000-0000-0000-000000000005
   ```

3. **Database Setup:**
   - Tables: `tasks`, `time_entries`, `financial_records`, `projects`, `customers`
   - Test data: Test customer, hourly project, fixed-price project

### Run Commands

```bash
# Run all tests
npm run test:task-lifecycle

# Run with verbose output
npm run test:task-lifecycle:verbose

# Generate JSON report
npm run test:task-lifecycle:report
```

### Test Output

**Success:**
```
ℹ️ Starting Task Lifecycle Integration Tests
============================================================
✅ Backend API is accessible
✅ Tasks endpoint is accessible
✅ Time entries endpoint is accessible
✅ All prerequisites passed

ℹ️ Test: Complete Task Lifecycle (Hourly Project)
✅ PASS: Create task
✅ PASS: Start timer
ℹ️ Simulating work (3 seconds)...
✅ PASS: Stop timer
✅ PASS: Financial record created
✅ PASS: Financial record has valid amount
✅ PASS: Financial record has valid hours
✅ PASS: Financial record has valid rate
✅ PASS: Financial record calculation correct

[... additional test output ...]

============================================================
TASK LIFECYCLE INTEGRATION TEST SUMMARY
============================================================
Total Tests:   28
✅ Passed:      28
❌ Failed:      0
⏭️  Skipped:     0
Duration:      15.32s
============================================================
```

**Failure:**
```
❌ FAIL: Financial record created
   Error: No financial record in response
```

---

## Test Data Cleanup

The test script automatically cleans up:
- Created tasks (via `testData.taskIds`)
- Created timers (via `testData.timerIds`)
- Created financial records (tracked but not deleted - for audit)

Cleanup runs:
- After all tests complete successfully
- After test failure (best effort)
- Uses DELETE endpoints on backend API

---

## Continuous Integration

### CI/CD Integration

```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test-task-lifecycle:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:task-lifecycle:report
        env:
          VITE_API_URL: ${{ secrets.TEST_API_URL }}
          VITE_SECRET_KEY: ${{ secrets.TEST_SECRET_KEY }}
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-reports
          path: test-reports/
```

---

## Troubleshooting

### Common Issues

#### 1. "Backend API is not accessible"

**Cause:** Backend server is down or network issue

**Solution:**
```bash
# Check backend health
curl https://api.claritybusinesssolutions.ca/health

# Verify environment variable
echo $VITE_API_URL

# Check network connectivity
ping api.claritybusinesssolutions.ca
```

#### 2. "VITE_SECRET_KEY not found in environment"

**Cause:** Missing or incorrectly loaded .env file

**Solution:**
```bash
# Verify .env file exists
ls -la .env

# Check if key is present
grep VITE_SECRET_KEY .env

# Reload environment
export $(cat .env | xargs)
```

#### 3. "Concurrent timer prevented" fails

**Cause:** Backend may not enforce concurrency constraint

**Solution:**
- Verify backend has concurrency check implemented
- Check database has unique constraint on active timers
- Review backend logs for 409 Conflict response

#### 4. Test data not cleaned up

**Cause:** Test crashed before cleanup or cleanup failed

**Solution:**
```bash
# Manual cleanup via API
curl -X DELETE https://api.claritybusinesssolutions.ca/tasks/{task_id} \
  -H "Authorization: Bearer {signature}.{timestamp}"

# Or connect to database directly
psql -U postgres -d postgres -c "DELETE FROM tasks WHERE title LIKE 'Test Task%'"
```

---

## Test Architecture

### HMAC Authentication

All API requests use HMAC-SHA256 authentication:

```javascript
function generateBackendAuthHeader(payload) {
  const timestamp = Date.now()
  const message = `${payload}${timestamp}`
  const signature = crypto.createHmac('sha256', secretKey)
    .update(message)
    .digest('hex')
  return `Bearer ${signature}.${timestamp}`
}
```

**Format:** `Authorization: Bearer {signature}.{timestamp}`

### Test Data Management

```javascript
const testData = {
  taskIds: [],       // Track created tasks for cleanup
  timerIds: [],      // Track created timers for cleanup
  financialRecordIds: [] // Track created financial records (audit only)
}
```

### Test Result Tracking

```javascript
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: [
    {
      name: "Create task",
      passed: true,
      error: null,
      details: { taskId: "uuid" },
      timestamp: "2026-01-15T10:30:00Z"
    }
  ],
  startTime: Date,
  endTime: Date
}
```

---

## Future Enhancements

### Planned Test Cases

1. **Retry Logic:**
   - Simulate network failures
   - Verify exponential backoff (1s, 2s, 5s)
   - Test max retry count (3 attempts)

2. **Large Time Entries:**
   - Timer running for 8+ hours
   - Multiple pause/resume cycles
   - Large adjustment values (±1 hour)

3. **Financial Record Rounding:**
   - Verify billable hours round to 0.1h increments
   - Test edge cases (2.99h → 3.0h)

4. **Performance Tests:**
   - Create 100 tasks in parallel
   - Start/stop 50 timers rapidly
   - Measure P50, P95, P99 latency

5. **Data Consistency:**
   - Compare frontend display vs. database values
   - Verify sum of financial records = expected total
   - Check for orphaned records

---

## Related Documentation

- [Backend API Integration Guide](../BACKEND_INTEGRATION_GUIDE.md)
- [Financial Record Generation](../.devflow/tasks/tasks-migration-requirements/FINANCIAL_RECORD_GENERATION.md)
- [Timer API Documentation](../requirements/tasks/timer-operations.md)
- [Task Service Unit Tests](../src/services/__tests__/taskService.test.js)
- [Tasks API Unit Tests](../src/__tests__/tasksApi.test.js)

---

## Contact

For questions or issues:
- Create an issue in the repository
- Contact the backend team for API-related issues
- Review logs in `test-reports/` directory

---

**Last Updated:** 2026-01-15
**Test Script Version:** 1.0.0
**Maintained By:** Development Team
