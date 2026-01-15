# Timer API Quick Reference

## Import

```javascript
import {
  startTaskTimer,
  stopTaskTimer,
  pauseTimer,
  resumeTimer,
  getActiveTimer,
  fetchTaskTimers
} from '@/api/tasks';
```

## Usage Examples

### 1. Start a Timer

```javascript
// Start timer for a task
const selectedTask = {
  _staffID: 'staff-uuid-123',  // or staff_id
  _projectID: 'project-uuid-456'
};

try {
  const timer = await startTaskTimer('task-uuid-789', selectedTask);
  console.log('Timer started:', timer.id);
  console.log('Status:', timer.status); // 'active'
} catch (error) {
  if (error.message.includes('already has an active timer')) {
    // Handle concurrency conflict
    console.error('Staff member already has an active timer');
  }
}
```

### 2. Stop a Timer

```javascript
// Stop timer with description and adjustment
try {
  const result = await stopTaskTimer(
    'timer-uuid-123',           // Timer ID
    'Implemented feature X',     // Description
    false,                       // saveImmediately
    360                          // Adjustment in seconds (6 minutes)
  );

  console.log('Timer stopped:', result.id);
  console.log('Duration:', result.duration_minutes, 'minutes');
  console.log('Billable amount:', result.billable_amount);

  // Financial record is created automatically if billable
  // Check backend response for financial_record field
} catch (error) {
  console.error('Failed to stop timer:', error.message);
}
```

### 3. Pause a Timer

```javascript
// Pause an active timer (backend only)
try {
  const timer = await pauseTimer('timer-uuid-123');
  console.log('Timer paused:', timer.status); // 'paused'
  console.log('Pause duration so far:', timer.pause_duration_seconds);
} catch (error) {
  if (error.message.includes('not supported in FileMaker')) {
    console.warn('Pause feature requires backend API');
  }
}
```

### 4. Resume a Timer

```javascript
// Resume a paused timer (backend only)
try {
  const timer = await resumeTimer('timer-uuid-123');
  console.log('Timer resumed:', timer.status); // 'active'
} catch (error) {
  console.error('Failed to resume timer:', error.message);
}
```

### 5. Get Active Timer

```javascript
// Get active timer for current user
try {
  const activeTimer = await getActiveTimer();

  if (activeTimer) {
    console.log('Active timer found:', activeTimer.id);
    console.log('Task:', activeTimer.task_id);
    console.log('Started at:', activeTimer.start_time);
    console.log('Status:', activeTimer.status); // 'active' or 'paused'
  } else {
    console.log('No active timer');
  }
} catch (error) {
  console.error('Failed to get active timer:', error.message);
}

// Get active timer for specific staff member
const staffTimer = await getActiveTimer('staff-uuid-123');
```

### 6. Fetch Task Timers

```javascript
// Fetch all timers for a task
try {
  const timers = await fetchTaskTimers('task-uuid-789');
  console.log(`Found ${timers.length} timer entries`);

  timers.forEach(timer => {
    console.log(`Timer ${timer.id}: ${timer.duration_minutes} min`);
  });
} catch (error) {
  console.error('Failed to fetch timers:', error.message);
}

// Fetch with advanced filtering
const timers = await fetchTaskTimers('task-uuid-789', {
  staff_id: 'staff-uuid-123',
  status: 'completed',
  start_date: '2024-01-01',
  end_date: '2024-01-31',
  limit: 100,
  offset: 0
});
```

## Response Shape (Backend API)

```typescript
interface TimeEntry {
  id: string;                      // UUID
  organization_id: string;
  task_id: string;
  project_id: string;
  customer_id: string;
  staff_id: string;
  start_time: string;              // ISO 8601
  end_time: string | null;         // ISO 8601 or null if active
  description: string | null;
  adjustment_seconds: number;
  pause_duration_seconds: number;
  duration_minutes: string | null; // Decimal string
  hourly_rate: string | null;      // Decimal string
  billable_amount: string | null;  // Decimal string
  is_billable: boolean;
  status: 'active' | 'paused' | 'completed';
  completed_at: string | null;     // ISO 8601
  filemaker_record_id: string | null;
  created_at: string;              // ISO 8601
  updated_at: string;              // ISO 8601
}
```

## Common Error Scenarios

### 1. Concurrency Conflict (409)
```javascript
// Staff already has active timer
{
  "detail": "Staff member already has an active timer"
}

// Solution: Stop or pause existing timer first
const activeTimer = await getActiveTimer(staffId);
if (activeTimer) {
  await stopTaskTimer(activeTimer.id, 'Switching tasks');
}
await startTaskTimer(newTaskId, selectedTask);
```

### 2. Invalid State Transition (400)
```javascript
// Trying to pause already paused timer
{
  "detail": "Timer must be active to pause"
}

// Solution: Check timer status before operations
if (timer.status === 'active') {
  await pauseTimer(timer.id);
}
```

### 3. Timer Not Found (404)
```javascript
// Timer doesn't exist
{
  "detail": "Time entry not found"
}

// Solution: Verify timer ID is valid
const activeTimer = await getActiveTimer();
if (activeTimer) {
  await stopTaskTimer(activeTimer.id, description);
}
```

### 4. Validation Error (422)
```javascript
// Missing required fields
{
  "detail": [
    {
      "loc": ["body", "task_id"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}

// Solution: Ensure all required fields are provided
```

## Timer State Machine

```
          start
   [none] ────────> [active]
                       │  │
                 pause │  │ stop
                       ↓  │
                   [paused]│
                       │  │
                resume │  │ stop
                       ↓  ↓
                  [completed]
```

## Feature Flag Check

```javascript
import { USE_BACKEND_API } from '@/api/tasks';

if (USE_BACKEND_API) {
  // Pause/resume features available
  console.log('Using backend API - all features enabled');
} else {
  // FileMaker mode - pause/resume not available
  console.log('Using FileMaker - pause/resume disabled');
}
```

## Time Adjustment Rules

```javascript
// Adjustments are in seconds
const sixMinutes = 6 * 60;  // 360 seconds

// Common adjustments
const adjustments = {
  '6 min': 360,
  '12 min': 720,
  '18 min': 1080,
  '24 min': 1440,
  '30 min': 1800
};

// Apply adjustment when stopping timer
await stopTaskTimer(
  timerId,
  description,
  false,
  adjustments['6 min']
);
```

## Financial Record Creation

When you stop a timer:

1. **Backend checks project type:**
   - If hourly/billable → Creates financial record
   - If fixed-price → No financial record

2. **Calculation:**
   - Duration = (end_time - start_time) - pause_duration + adjustment
   - Billable Amount = (duration_minutes / 60) × hourly_rate

3. **Response includes:**
   - Time entry (always)
   - Financial record (if created)

```javascript
const result = await stopTaskTimer(timerId, 'Work done');

console.log('Time entry:', result.id);
console.log('Billable amount:', result.billable_amount);

// If financial record was created, it's in the backend
// and will be returned in subsequent financial record queries
```

## Best Practices

1. **Always check for active timer on app load:**
   ```javascript
   const activeTimer = await getActiveTimer();
   if (activeTimer) {
     // Restore timer UI state
   }
   ```

2. **Handle concurrency conflicts gracefully:**
   ```javascript
   try {
     await startTaskTimer(taskId, selectedTask);
   } catch (error) {
     if (error.message.includes('active timer')) {
       // Show user existing timer with option to stop it
       const activeTimer = await getActiveTimer();
       // Display modal: "You have active timer on Task X. Stop it?"
     }
   }
   ```

3. **Use pause/resume for short breaks:**
   ```javascript
   // User takes break
   await pauseTimer(activeTimerId);

   // User returns
   await resumeTimer(activeTimerId);
   ```

4. **Validate adjustments in UI:**
   ```javascript
   // Only allow 6-minute increments
   const isValidAdjustment = (seconds) => {
     return seconds % 360 === 0 && seconds >= 0;
   };

   if (!isValidAdjustment(adjustment)) {
     alert('Adjustments must be in 6-minute increments');
   }
   ```

5. **Log all timer operations:**
   ```javascript
   console.log('[Timer] Starting for task:', taskId);
   console.log('[Timer] Stopped, duration:', result.duration_minutes);
   ```

## Debugging Tips

1. **Enable verbose logging:**
   - All API calls log with `[Tasks API]` prefix
   - Check browser console for request/response details

2. **Check backend directly:**
   ```bash
   curl -X GET "https://api.claritybusinesssolutions.ca/time-entries/active?staff_id=xyz" \
     -H "Authorization: Bearer {signature}.{timestamp}"
   ```

3. **Verify HMAC signature:**
   - Signature issues cause 401 Unauthorized
   - Check SECRET_KEY is set correctly
   - Ensure timestamp is within 5 minutes

4. **Common issues:**
   - 401: Authentication failure (check HMAC)
   - 404: Timer not found (check ID)
   - 409: Concurrency conflict (check active timers)
   - 422: Validation error (check request data)

## Migration Notes

### FileMaker → Backend Differences

| Feature | FileMaker | Backend |
|---------|-----------|---------|
| Timer ID | recordId (integer) | id (UUID) |
| Foreign Keys | _taskID, _staffID | task_id, staff_id |
| Time Format | TimeStart, DateStart | start_time (ISO 8601) |
| Adjustment | TimeAdjust (seconds) | adjustment_seconds |
| Pause | Not supported | pause_duration_seconds |
| Status | Implicit (TimeEnd empty) | Explicit ('active', 'paused', 'completed') |
| Financial | Manual creation | Automatic on stop |

### Backward Compatibility

The API layer maintains backward compatibility:
- FileMaker fallback active for all operations except pause/resume
- Accepts both field name formats (_staffID and staff_id)
- Handles both ID formats (recordId and UUID)

### Transition Plan

1. **Current:** USE_BACKEND_API = true, FileMaker fallback active
2. **Next:** Monitor production, collect metrics
3. **Future:** Remove FileMaker fallback when backend proven stable
