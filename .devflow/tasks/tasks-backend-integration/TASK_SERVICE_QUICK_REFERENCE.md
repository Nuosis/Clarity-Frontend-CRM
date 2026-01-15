# Task Service Quick Reference Guide

## Timer Management Functions

### Starting a Timer

```javascript
import { startTimer } from '../services/taskService';

try {
  const timer = await startTimer(task, staffId);
  console.log('Timer started:', timer);
} catch (error) {
  // User-friendly error: "You already have an active timer running..."
  alert(error.message);
}
```

**Important:** Automatically checks for existing active timer before starting.

---

### Stopping a Timer

```javascript
import { stopTimer } from '../services/taskService';

const params = {
  recordId: timer.id,              // Timer entry ID
  description: 'Work performed',   // What was done
  saveImmediately: false,          // Set true to skip description
  totalPauseTime: 0,              // Accumulated pause time (seconds)
  adjustment: 360                  // Adjustment in seconds (must be 6-min increments)
};

try {
  const result = await stopTimer(params, organizationId);

  // Backend response structure
  if (result.time_entry) {
    console.log('Timer stopped:', result.time_entry);

    if (result.financial_record) {
      console.log('Financial record created:', result.financial_record);
      // Display billing info to user
    } else {
      console.log('No financial record (fixed-price project)');
    }
  }
} catch (error) {
  alert(error.message);
}
```

**Important:** Adjustment must be in 6-minute (360 second) increments.

---

### Pausing a Timer

```javascript
import { pauseTimer } from '../services/taskService';

try {
  const timer = await pauseTimer(entryId);
  console.log('Timer paused:', timer);
} catch (error) {
  // "Timer must be active to pause..."
  // "Pause/resume is only available in the web version..."
  alert(error.message);
}
```

**Important:** Only works with backend API, not FileMaker.

---

### Resuming a Timer

```javascript
import { resumeTimer } from '../services/taskService';

try {
  const timer = await resumeTimer(entryId);
  console.log('Timer resumed:', timer);
} catch (error) {
  // "Timer must be paused to resume..."
  alert(error.message);
}
```

**Important:** Only works with backend API, not FileMaker.

---

### Getting Active Timer

```javascript
import { getActiveTimer } from '../services/taskService';

// Get current user's active timer
const activeTimer = await getActiveTimer();

// Get specific staff's active timer
const staffTimer = await getActiveTimer(staffId);

if (activeTimer) {
  console.log('Found active timer:', activeTimer);
  // Restore timer UI state
} else {
  console.log('No active timer');
}
```

**Usage:** Call on app load to restore timer state.

---

## Validation Functions

### Validate Adjustment (Minutes)

```javascript
import { isValidTimerAdjustment, roundToValidAdjustment } from '../services/taskService';

const adjustmentMinutes = 10; // User input

if (!isValidTimerAdjustment(adjustmentMinutes)) {
  const rounded = roundToValidAdjustment(adjustmentMinutes);
  console.log(`Rounded ${adjustmentMinutes} to ${rounded} minutes`);
}
```

---

### Validate Adjustment (Seconds)

```javascript
import {
  isValidTimerAdjustmentSeconds,
  roundToValidAdjustmentSeconds
} from '../services/taskService';

const adjustmentSeconds = 600; // User input

if (!isValidTimerAdjustmentSeconds(adjustmentSeconds)) {
  const rounded = roundToValidAdjustmentSeconds(adjustmentSeconds);
  console.log(`Rounded ${adjustmentSeconds} to ${rounded} seconds`);
}
```

**Rule:** Adjustments must be in 6-minute (360 second) increments.

---

## Data Processing Functions

### Process Timer Records

```javascript
import { processTimerRecords } from '../services/taskService';

// Backend API response (array)
const backendTimers = await fetchTaskTimers(taskId);
const processed = processTimerRecords(backendTimers);

// FileMaker response (object with response.data)
const fmTimers = await fetchTaskTimers(taskId);
const processed = processTimerRecords(fmTimers);

// Processed format
processed.forEach(timer => {
  console.log({
    id: timer.id,
    status: timer.status,           // 'active', 'paused', 'completed'
    startTime: timer.startTime,
    endTime: timer.endTime,
    description: timer.description,
    duration: timer.duration,       // Hours
    pauseDuration: timer.pauseDuration,  // Seconds
    adjustmentSeconds: timer.adjustmentSeconds,
    isBillable: timer.isBillable,
    billableAmount: timer.billableAmount
  });
});
```

---

### Process Task Data

```javascript
import { processTaskData } from '../services/taskService';

// Backend API response (array)
const backendTasks = await fetchTasksForProject(projectId);
const processed = processTaskData(backendTasks);

// FileMaker response (object with response.data)
const fmTasks = await fetchTasksForProject(projectId);
const processed = processTaskData(fmTasks);

// Processed format
processed.forEach(task => {
  console.log({
    id: task.id,
    task: task.task,
    type: task.type,
    isCompleted: task.isCompleted,
    _projectID: task._projectID,
    _staffID: task._staffID
  });
});
```

---

## Financial Record Helpers

### Extract Financial Record

```javascript
import {
  extractFinancialRecord,
  formatFinancialRecordForDisplay
} from '../services/taskService';

const result = await stopTimer(params);

const financialRecord = extractFinancialRecord(result);

if (financialRecord) {
  const display = formatFinancialRecordForDisplay(financialRecord);

  console.log(`
    Amount: $${display.amount}
    Hours: ${display.hours}
    Rate: $${display.rate}/hr
    Status: ${display.status}
  `);
}
```

---

### Calculate Timer Statistics

```javascript
import { calculateTimerStats } from '../services/taskService';

const timeEntry = result.time_entry;
const stats = calculateTimerStats(timeEntry);

console.log(`
  Total Time: ${stats.totalSeconds}s
  Pause Time: ${stats.pauseSeconds}s
  Adjustment: ${stats.adjustmentSeconds}s
  Billable Time: ${stats.billableHours} hours
`);
```

---

## Error Handling Patterns

### Concurrency Errors

```javascript
try {
  await startTimer(task);
} catch (error) {
  if (error.message.includes('already has an active timer')) {
    // Offer to stop existing timer
    const existing = await getActiveTimer();
    // Show UI to stop/pause existing timer
  }
}
```

---

### State Validation Errors

```javascript
try {
  await pauseTimer(entryId);
} catch (error) {
  if (error.message.includes('must be active')) {
    // Timer is already paused or completed
    // Refresh timer state
  }
}
```

---

### Adjustment Validation Errors

```javascript
const params = {
  recordId: timer.id,
  adjustment: 300 // Invalid: not 6-minute increment
};

try {
  await stopTimer(params);
} catch (error) {
  if (error.message.includes('6-minute')) {
    // Show adjustment UI with valid increments
    const rounded = roundToValidAdjustmentSeconds(300);
    params.adjustment = rounded; // 360
    await stopTimer(params);
  }
}
```

---

## Common Workflows

### Complete Timer Lifecycle

```javascript
// 1. Start timer
const timer = await startTimer(task, staffId);

// 2. Pause (optional)
await pauseTimer(timer.id);

// 3. Resume (optional)
await resumeTimer(timer.id);

// 4. Stop with adjustment
const result = await stopTimer({
  recordId: timer.id,
  description: 'Completed feature implementation',
  adjustment: 360 // +6 minutes
});

// 5. Display financial record
const financialRecord = extractFinancialRecord(result);
if (financialRecord) {
  const display = formatFinancialRecordForDisplay(financialRecord);
  showBillingInfo(display);
}
```

---

### Restore Timer on App Load

```javascript
async function restoreTimerState(staffId) {
  const activeTimer = await getActiveTimer(staffId);

  if (!activeTimer) {
    return null; // No active timer
  }

  // Calculate current duration
  const stats = calculateTimerStats(activeTimer);

  // Show timer UI
  return {
    timer: activeTimer,
    status: activeTimer.status,
    billableHours: stats.billableHours,
    pauseSeconds: stats.pauseSeconds
  };
}
```

---

### Timer UI with Adjustment

```javascript
function TimerAdjustmentUI({ onAdjust }) {
  const [adjustment, setAdjustment] = useState(0);

  const handleChange = (minutes) => {
    const rounded = roundToValidAdjustment(minutes);
    setAdjustment(rounded);
  };

  const incrementOptions = [-30, -18, -12, -6, 6, 12, 18, 30];

  return (
    <div>
      <h3>Adjust Time (6-minute increments)</h3>
      {incrementOptions.map(mins => (
        <button
          key={mins}
          onClick={() => handleChange(adjustment + mins)}
        >
          {mins > 0 ? '+' : ''}{mins} min
        </button>
      ))}
      <p>Current adjustment: {adjustment} minutes</p>
      <button onClick={() => onAdjust(adjustment * 60)}>
        Apply
      </button>
    </div>
  );
}
```

---

## API Response Formats

### Backend Time Entry Response

```json
{
  "id": "uuid",
  "organization_id": "uuid",
  "task_id": "uuid",
  "project_id": "uuid",
  "customer_id": "uuid",
  "staff_id": "uuid",
  "start_time": "2026-01-14T10:00:00Z",
  "end_time": "2026-01-14T12:30:00Z",
  "description": "Work performed",
  "adjustment_seconds": 360,
  "pause_duration_seconds": 600,
  "duration_minutes": "140.00",
  "hourly_rate": "50.00",
  "billable_amount": "116.67",
  "is_billable": true,
  "status": "completed",
  "completed_at": "2026-01-14T12:30:00Z",
  "filemaker_record_id": "123",
  "created_at": "2026-01-14T10:00:00Z",
  "updated_at": "2026-01-14T12:30:00Z"
}
```

---

### Backend Stop Timer Response

```json
{
  "time_entry": { /* TimeEntry object */ },
  "financial_record": {
    "id": "uuid",
    "organization_id": "uuid",
    "customer_id": "uuid",
    "project_id": "uuid",
    "task_id": "uuid",
    "staff_id": "uuid",
    "time_entry_id": "uuid",
    "hours": "2.33",
    "rate": "50.00",
    "amount": "116.67",
    "date": "2026-01-14",
    "description": "Work performed",
    "is_billable": true,
    "status": "unbilled",
    "created_at": "2026-01-14T12:30:00Z"
  }
}
```

---

## Best Practices

1. **Always check for active timer** before starting a new one
2. **Validate adjustments** before calling stopTimer()
3. **Use getActiveTimer()** on app load to restore state
4. **Handle FileMaker mode gracefully** - pause/resume not supported
5. **Log all timer operations** for debugging
6. **Display financial records** when timer stops
7. **Round adjustments** to 6-minute increments in UI
8. **Provide retry logic** for transient errors
9. **Show clear error messages** for state violations
10. **Track pause duration** separately from total time

---

## Logging

All functions log with `[Task Service]` prefix:

```javascript
console.log('[Task Service] Starting timer for task:', taskId);
console.log('[Task Service] Timer started successfully:', result);
console.log('[Task Service] Stopping timer:', recordId);
console.log('[Task Service] Timer stopped successfully:', result);
console.log('[Task Service] Financial record created:', financialRecord);
console.log('[Task Service] No financial record created (fixed-price)');
console.error('[Task Service] Failed to start timer:', error);
```

Filter logs: `[Task Service]`

---

## Migration Notes

### Current State (Phase 1)
- Backend API enabled via `USE_BACKEND_API` flag
- FileMaker fallback active
- Both code paths functional

### Breaking Changes
- Pause/resume only works with backend API
- Response shapes different (backend vs FileMaker)
- New fields: `status`, `pause_duration_seconds`, `adjustment_seconds`

### Backward Compatibility
- All FileMaker code paths preserved
- Legacy response handling continues to work
- Sales record sync to Supabase still functions

---

## Need Help?

- Full implementation details: `TSK0005_IMPLEMENTATION.md`
- Timer endpoints reference: `TIMER_ENDPOINTS_IMPLEMENTATION.md`
- API spec: `https://api.claritybusinesssolutions.ca/openapi.json`
