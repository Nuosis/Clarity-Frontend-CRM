# TSK0008 Quick Reference: Task Detail Components Updates

## Timer Display

### Status Indicators
```javascript
// Active timer
<div className="text-green-500">RUNNING</div>

// Paused timer
<div className="text-yellow-500">PAUSED</div>
```

### Field Support
```javascript
// Backend fields (primary)
timer.status              // 'active' | 'paused' | 'completed'
timer.start_time          // ISO timestamp
timer.pause_duration_seconds
timer.adjustment_seconds

// Legacy fields (backward compatible)
timer.isPaused            // boolean
timer.TimeStart           // "HH:MM:SS"
timer.totalPauseTime      // seconds
timer.adjustment          // seconds
```

---

## Error Messages

### Concurrency Conflict
**Trigger:** User tries to start timer while another is active

**Display:**
```
You already have an active timer running.
Please stop or pause it before starting a new one.
```

### State Errors
```
Timer must be active to pause. It may already be paused or completed.
Timer must be paused to resume. It may be active or already completed.
Pause/resume is only available in the web version, not in FileMaker.
```

---

## Timer State Structure

### Complete Timer Object
```javascript
{
    // Backend API fields
    id: "uuid",
    start_time: "2026-01-14T10:00:00Z",
    status: "active",
    pause_duration_seconds: 0,
    adjustment_seconds: 0,

    // Legacy FileMaker fields
    recordId: "123",
    TimeStart: "10:00:00",
    isPaused: false,
    totalPauseTime: 0,
    adjustment: 0,

    // Local UI state
    pauseStartTime: null,
    startTime: "2026-01-14T10:00:00Z"
}
```

---

## Component Changes

### TaskTimer.jsx
**New Props:**
- `timer.status` - Backend timer status
- `task.title` - Backend task title field

**Display Logic:**
```javascript
// Shows status based on backend or legacy field
const statusDisplay = status === 'paused' || isPaused
    ? { text: 'PAUSED', color: 'text-yellow-500' }
    : { text: 'RUNNING', color: 'text-green-500' };

// Task name supports both fields
{task.task || task.title}
```

### TaskList.jsx
**Status Indicators:**
```javascript
{timerRecords.some(r => r.status === 'active') && (
    <div className="text-green-500">● Timer Running</div>
)}
{timerRecords.some(r => r.status === 'paused') && (
    <div className="text-yellow-500">⏸ Timer Paused</div>
)}
```

### useTask.js
**New Functions:**
- `handleTimerPause()` - Now async, calls backend API
- Better error handling in `handleTimerStart()`

**Usage:**
```javascript
// Pause/resume (automatic detection)
await handleTimerPause(); // Calls pause or resume based on current state

// Start with concurrency detection
await handleTimerStart(task); // Shows friendly error if timer exists
```

---

## Backward Compatibility

### FileMaker Mode
- Pause/resume falls back to local state
- All legacy fields still populated
- No breaking changes

### Migration Path
1. Backend API returns new fields
2. Components display both old and new
3. UI shows enhanced status
4. FileMaker continues to work

---

## Testing Checklist

- [x] Timer shows "RUNNING" when active
- [x] Timer shows "PAUSED" when paused
- [x] Concurrency error message is user-friendly
- [x] Pause/resume works with backend API
- [x] FileMaker fallback works
- [x] Build compiles without errors
- [x] TaskList shows status indicators

---

## Visual Changes

### Before
```
Timer: 00:15:30
[No status indicator]
```

### After
```
Timer: 00:15:30
RUNNING (green)

or

Timer: 00:15:30
PAUSED (yellow)
```

### Task List Before
```
Total Time: 2.5 hours
```

### Task List After
```
Total Time: 2.5 hours
● Timer Running (green)

or

Total Time: 2.5 hours
⏸ Timer Paused (yellow)
```

---

## Common Issues

### Timer not showing status
**Check:** Ensure timer has `status` field from backend or `isPaused` from legacy

### Pause/resume not working
**Check:** Backend API must be enabled (USE_BACKEND_API flag)
**Fallback:** Local state management in FileMaker mode

### Concurrency error not showing
**Check:** Error message must include "already has an active timer", "concurrent", or "409"

---

## Related Files

- `src/components/tasks/TaskTimer.jsx` - Timer UI component
- `src/components/tasks/TaskList.jsx` - Task list with status
- `src/hooks/useTask.js` - Timer state management
- `src/services/taskService.js` - Timer business logic
- `src/api/tasks.js` - Timer API calls
