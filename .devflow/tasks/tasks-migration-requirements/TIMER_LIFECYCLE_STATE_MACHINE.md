# Timer Lifecycle and State Machine Documentation

## Overview

The task timer system manages time tracking for tasks with support for start/stop/pause operations, pause time tracking, and manual time adjustments in 6-minute increments. The timer state is managed across multiple layers and persists across browser sessions using localStorage.

## Architecture Layers

### 1. UI Component Layer
**File**: `src/components/tasks/TaskTimer.jsx`

The TaskTimer component manages the visual representation and user interactions.

### 2. Hook Layer
**File**: `src/hooks/useTask.js`

The useTask hook manages timer state and coordinates operations between UI and services.

### 3. Service Layer
**File**: `src/services/taskService.js`

Provides business logic and validation for timer operations.

### 4. API Layer
**File**: `src/api/tasks.js`

Handles direct communication with FileMaker for timer records.

## Timer State Structure

The timer state object contains the following properties:

```javascript
{
  recordId: string | null,           // FileMaker record ID of the timer
  TimeStart: string | null,          // Start time in HH:MM:SS format
  isPaused: boolean,                 // Whether timer is currently paused
  pauseStartTime: Date | null,       // When current pause started
  totalPauseTime: number,            // Total pause time in seconds
  adjustment: number                 // Manual adjustment in seconds (6-min increments)
}
```

**State Location**: `src/hooks/useTask.js:28-45`

The timer state is initialized from localStorage on mount to persist across browser sessions.

## State Machine

### Timer States

1. **IDLE** - No active timer
   - `recordId: null`
   - `TimeStart: null`
   - `isPaused: false`

2. **RUNNING** - Timer is actively counting
   - `recordId: <string>`
   - `TimeStart: <time>`
   - `isPaused: false`

3. **PAUSED** - Timer is paused
   - `recordId: <string>`
   - `TimeStart: <time>`
   - `isPaused: true`
   - `pauseStartTime: <Date>`

### State Transitions

```
IDLE → RUNNING (Start)
RUNNING → PAUSED (Pause)
PAUSED → RUNNING (Resume)
RUNNING → IDLE (Stop)
PAUSED → IDLE (Stop)
```

### State Transition Diagram

```
┌──────┐
│ IDLE │
└──┬───┘
   │ Start (handleTimerStart)
   ↓
┌──────────┐
│ RUNNING  │←──────────────┐
└──┬───────┘               │
   │ Pause                 │ Resume
   │ (handleTimerPause)    │ (handleTimerPause)
   ↓                       │
┌──────────┐               │
│ PAUSED   │───────────────┘
└──┬───────┘
   │ Stop
   │ (handleTimerStop)
   ↓
┌──────┐
│ IDLE │
└──────┘
```

## Timer Operations

### 1. Start Timer

**Entry Point**: `useTask.js:204-235` (handleTimerStart)

**Flow**:
1. User clicks "Start" button on a task
2. TaskList passes task to `handleTimerStart`
3. Service validates task has required ID
4. API creates FileMaker timer record with:
   - `_taskID`: Task ID
   - `_staffID`: Staff ID
   - `_projectID`: Project ID
   - `_custID`: Customer ID (fetched from project)
   - `TimeStart`: Current time (HH:MM:SS)
   - `DateStart`: Current date (MM/DD/YYYY)
5. Timer state updated:
   ```javascript
   {
     recordId: result.response.recordId,
     TimeStart: new Date().toLocaleTimeString(...),
     isPaused: false,
     pauseStartTime: null,
     totalPauseTime: 0,
     adjustment: 0
   }
   ```
6. State saved to localStorage
7. UI renders TaskTimer component with running state

**API Call**: `src/api/tasks.js:121-178` (startTaskTimer)

**FileMaker Layout**: `devRecords` (Layouts.RECORDS)

**State Transition**: IDLE → RUNNING

### 2. Pause Timer

**Entry Point**: `useTask.js:279-301` (handleTimerPause)

**Flow**:
1. User clicks "Pause" button
2. Timer state checked for active timer
3. If not paused:
   - Set `isPaused: true`
   - Set `pauseStartTime: new Date()`
4. State saved to localStorage
5. UI shows "PAUSED" indicator

**Location**: `src/hooks/useTask.js:279-301`

**State Transition**: RUNNING → PAUSED

**No FileMaker API Call**: Pause is client-side only until stop.

### 3. Resume Timer

**Entry Point**: `useTask.js:279-301` (handleTimerPause - same function)

**Flow**:
1. User clicks "Resume" button
2. Timer state checked for active timer
3. If paused:
   - Calculate pause duration: `(new Date() - pauseStartTime) / 1000`
   - Add to `totalPauseTime`
   - Set `isPaused: false`
   - Set `pauseStartTime: null`
4. State saved to localStorage
5. UI resumes counting

**Location**: `src/hooks/useTask.js:279-301`

**State Transition**: PAUSED → RUNNING

### 4. Adjust Time

**Entry Point**: `useTask.js:303-317` (handleTimerAdjust)

**Flow**:
1. User clicks "+6 min" or "-6 min" button
2. Adjustment calculated: `minutes * 60` seconds
3. Added to `timer.adjustment`
4. State saved to localStorage
5. UI shows adjusted time vs elapsed time

**Time Increment**: Fixed at 6 minutes (360 seconds)

**Validation**: `src/services/taskService.js:619-622` (isValidTimerAdjustment)

```javascript
export function isValidTimerAdjustment(minutes) {
    // Only allow adjustments in 6-minute increments
    return minutes % 6 === 0;
}
```

**Location**:
- Hook: `src/hooks/useTask.js:303-317`
- UI: `src/components/tasks/TaskTimer.jsx:222-226, 258-283`

**Display Logic**: `src/components/tasks/TaskTimer.jsx:6-37`
- Shows two times when adjusted:
  - Adjusted time (elapsed - pauses - adjustments)
  - Total elapsed time

### 5. Stop Timer

**Entry Point**: `useTask.js:237-277` (handleTimerStop)

**Flow**:
1. User clicks "Stop" button
2. If `saveImmediately: false`:
   - Show description dialog
   - User enters work description
   - User clicks "Save & Stop"
3. Calculate total pause time:
   ```javascript
   totalPauseTime = timer.totalPauseTime +
     (timer.isPaused && timer.pauseStartTime
       ? (new Date() - timer.pauseStartTime) / 1000
       : 0)
   ```
4. Call `stopTimer` service with:
   - `recordId`: Timer record ID
   - `description`: Work performed
   - `saveImmediately`: Boolean flag
   - `totalPauseTime`: Total pause seconds
   - `adjustment`: Manual adjustment seconds
5. Service calculates final adjustment:
   ```javascript
   finalAdjustment = totalPauseTime + adjustment
   ```
6. API updates FileMaker record:
   - `TimeEnd`: Current time
   - `Work Performed`: Description or "Time logged"
   - `TimeAdjust`: Final adjustment in seconds
7. FileMaker calculates `Billable_Time_Rounded` based on:
   - Start time
   - End time
   - Time adjustment
8. **Fixed-Price Project Check**:
   - Fetch financial record by recordId
   - Check `f_fixedPrice` field
   - If `fixedPrice > 0`, skip sales record creation
   - Otherwise, create sales record in Supabase
9. Reload task details to show updated timer records
10. Reset timer state to IDLE
11. Remove from localStorage

**Locations**:
- Hook: `src/hooks/useTask.js:237-277`
- Service: `src/services/taskService.js:67-131`
- API: `src/api/tasks.js:189-213`

**FileMaker Layout**: `devRecords` (Layouts.RECORDS)

**State Transition**: RUNNING/PAUSED → IDLE

**Post-Stop Processing**: `src/services/taskService.js:82-128`
- Fetches financial record by recordId
- Checks if project is fixed-price (`f_fixedPrice > 0`)
- If NOT fixed-price, creates sales record in Supabase
- Errors in sales creation don't prevent timer stop

## Time Calculations

### Elapsed Time Display

**Location**: `src/components/tasks/TaskTimer.jsx:141-159`

```javascript
useEffect(() => {
    let interval;
    if (isRunning && !isPaused) {
        // Calculate initial elapsed time
        if (timer?.TimeStart) {
            const start = new Date();
            const [hours, minutes, seconds] = timer.TimeStart.split(':').map(Number);
            start.setHours(hours, minutes, seconds);
            const initialElapsed = Math.round((new Date() - start) / 1000);
            setElapsedTime(initialElapsed);
        }

        interval = setInterval(() => {
            setElapsedTime(prev => prev + 1);
        }, 1000);
    }
    return () => clearInterval(interval);
}, [isRunning, isPaused, timer?.startTime]);
```

### Adjusted Time Display

**Location**: `src/components/tasks/TaskTimer.jsx:161-169`

```javascript
useEffect(() => {
    if (timer) {
        const totalAdjustment = (timer.totalPauseTime || 0) + (timer.adjustment || 0);
        setAdjustedTime(Math.max(0, elapsedTime - totalAdjustment));
    } else {
        setAdjustedTime(0);
    }
}, [elapsedTime, timer]);
```

**Formula**:
```
Adjusted Time = Elapsed Time - Total Pause Time - Manual Adjustment
```

### Format Display

**Location**: `src/components/tasks/TaskTimer.jsx:8-12`

```javascript
const formatSeconds = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};
```

**Format**: `HH:MM:SS` with zero padding

## Timer Record Processing

### FileMaker Timer Record Structure

```javascript
{
  fieldData: {
    __ID: string,                    // Timer record ID
    _taskID: string,                 // Associated task ID
    _staffID: string,                // Staff member ID
    _projectID: string,              // Project ID
    _custID: string,                 // Customer ID
    startTime: string,               // Start time (HH:MM:SS AM/PM)
    endTime: string,                 // End time (HH:MM:SS AM/PM)
    DateStart: string,               // Start date (MM/DD/YYYY)
    TimeAdjust: number,              // Total adjustment in seconds
    "Work Performed": string,        // Description of work
    Billable_Time_Rounded: number    // Calculated billable time in hours
  },
  recordId: string,                  // FileMaker record ID
  modId: string                      // Modification ID
}
```

### Processing Timer Records

**Location**: `src/services/taskService.js:174-200` (processTimerRecords)

```javascript
export function processTimerRecords(timerRecords) {
    if (!timerRecords?.response?.data) {
        return [];
    }

    return timerRecords.response.data.map(record => {
        const startTimeStr = record.fieldData.startTime;
        const endTimeStr = record.fieldData.endTime;

        // Create Date objects for today with the specified time
        const today = new Date();
        const startTime = startTimeStr ? new Date(today.toDateString() + ' ' + startTimeStr) : null;
        const endTime = endTimeStr ? new Date(today.toDateString() + ' ' + endTimeStr) : null;

        return {
            id: record.fieldData.__ID,
            recordId: record.recordId,
            startTime,
            endTime,
            description: record.fieldData["Work Performed"] || '',
            duration: record.fieldData.Billable_Time_Rounded
        };
    });
}
```

**Note**: Duration comes from FileMaker calculated field `Billable_Time_Rounded` in hours.

### Display Total Time

**Location**: `src/services/taskService.js:629-638` (calculateTotalTaskTime)

```javascript
export function calculateTotalTaskTime(timerRecords) {
    if (!timerRecords?.length) {
        return 0;
    }

    return timerRecords.reduce((total, record) => {
        // Convert hours to minutes since duration comes from FileMaker in hours
        return total + ((record.duration || 0) * 60);
    }, 0);
}
```

**Note**: Converts FileMaker hours to minutes for display.

## Pause Time Tracking

### Pause Mechanism

Pause tracking is entirely client-side using JavaScript Date objects:

1. **Pause Start**:
   - Set `pauseStartTime: new Date()`
   - Set `isPaused: true`

2. **During Pause**:
   - UI shows "PAUSED" indicator
   - Timer display stops incrementing
   - Pause duration NOT sent to FileMaker

3. **Resume**:
   - Calculate pause duration: `(new Date() - pauseStartTime) / 1000`
   - Add to `totalPauseTime`
   - Clear `pauseStartTime`
   - Set `isPaused: false`

4. **Stop with Pause**:
   - If currently paused, add current pause to total:
     ```javascript
     totalPauseTime = timer.totalPauseTime +
       (timer.isPaused && timer.pauseStartTime
         ? (new Date() - timer.pauseStartTime) / 1000
         : 0)
     ```
   - Send total to FileMaker as part of `TimeAdjust`

**Location**: `src/hooks/useTask.js:279-301, 237-277`

### Pause Persistence

Pause state is persisted in localStorage:

```javascript
localStorage.setItem('activeTimer', JSON.stringify({
  recordId,
  TimeStart,
  isPaused,
  pauseStartTime: pauseStartTime?.toISOString(), // Serialized Date
  totalPauseTime,
  adjustment
}));
```

On reload, `pauseStartTime` is deserialized:

```javascript
const parsed = JSON.parse(savedTimer);
return {
  ...parsed,
  pauseStartTime: parsed.pauseStartTime ? new Date(parsed.pauseStartTime) : null
};
```

**Location**: `src/hooks/useTask.js:28-45`

## State Persistence (localStorage)

### Storage Key

`activeTimer`

### Storage Operations

1. **Save on State Change**:
   - Start timer
   - Pause/Resume
   - Adjust time

2. **Load on Mount**:
   - Parse from localStorage
   - Deserialize dates
   - Restore timer state

3. **Clear on Stop**:
   - Remove from localStorage
   - Reset to IDLE state

**Locations**:
- Save: `src/hooks/useTask.js:227, 298, 314`
- Load: `src/hooks/useTask.js:28-45`
- Clear: `src/hooks/useTask.js:272, 366`

## UI Interactions

### Keyboard Shortcuts

**Location**: `src/components/tasks/TaskTimer.jsx:171-182`

```javascript
useEffect(() => {
    const handleKeyDown = (e) => {
        if (e.key === 's' && (e.metaKey || e.ctrlKey) && isRunning) {
            e.preventDefault();
            handleStop(true); // Save immediately without description
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
}, [isRunning]);
```

**Shortcut**: `Cmd+S` or `Ctrl+S` - Stop timer immediately without description dialog

### Timer Controls

**Location**: `src/components/tasks/TaskTimer.jsx:47-103`

- **Start Button**: Only shown when `!isRunning`
- **Pause Button**: Shown when `isRunning && !isPaused`
- **Resume Button**: Shown when `isRunning && isPaused`
- **Stop Button**: Shown when `isRunning`

### Time Adjustment Controls

**Location**: `src/components/tasks/TaskTimer.jsx:258-283`

- Only shown when `isRunning`
- Two buttons: "-6 min" and "+6 min"
- Calls `handleAdjustTime(-6)` or `handleAdjustTime(6)`

### Stop Dialog

**Location**: `src/components/tasks/TaskTimer.jsx:285-326`

- Modal overlay when stopping timer
- Textarea for work description
- Cancel button (closes dialog)
- "Save & Stop" button (confirms stop)

## Integration with Task System

### Task Selection

**Location**: `src/components/tasks/TaskList.jsx:79-92`

```javascript
<button
    onClick={async () => {
        try {
            const { task: selectedTask } = await handleTaskSelect(task.id);
            await handleTimerStart(selectedTask);
        } catch (error) {
            showError('Error starting timer');
        }
    }}
    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
>
    Start Timer
</button>
```

Flow:
1. User clicks "Start Timer" on task item
2. `handleTaskSelect` loads task details
3. `handleTimerStart` starts timer for selected task
4. TaskTimer component renders with active timer

### Timer Display in Task List

**Location**: `src/components/tasks/TaskList.jsx:489-501`

```javascript
{timer?.recordId && selectedTask && (
    <div className="mb-6">
        <TaskTimer
            task={selectedTask}
            timer={timer}
            onStart={handleTimerStart}
            onPause={handleTimerPause}
            onStop={handleTimerStop}
            onAdjust={handleTimerAdjust}
        />
    </div>
)}
```

Only shows timer when:
- `timer.recordId` exists (active timer)
- `selectedTask` exists (task is selected)

### Timer Records Display

**Location**: `src/components/tasks/TaskList.jsx:156-165`

```javascript
{timerRecords?.length > 0 && (
    <>
        <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            <span className="font-medium">Total Time:</span> {
                formatDuration(
                    timerRecords.reduce((total, record) =>
                        total + ((record.duration || 0) * 60), 0)
                )
            }
        </div>
    </>
)}
```

Shows total time for all completed timers on a task when expanded.

## Error Handling

### Timer Start Errors

**Location**: `src/hooks/useTask.js:204-235`

- Validates task has ID
- Checks FileMaker response code
- Shows error message if code !== '0'
- Logs error to console

### Timer Stop Errors

**Location**: `src/hooks/useTask.js:273-276`

```javascript
} catch (err) {
    showError(err.message);
    console.error('Error stopping timer:', err);
}
```

- Shows user-friendly error message
- Timer state NOT cleared on error (allows retry)

### Sales Record Creation Errors

**Location**: `src/services/taskService.js:124-127`

```javascript
} catch (error) {
    console.error('Error creating sales record:', error);
    // Don't throw the error, as we still want to return the timer stop result
}
```

- Sales record errors don't prevent timer stop
- Error logged but not shown to user
- Timer stop completes successfully

## Fixed-Price Project Logic

**Location**: `src/services/taskService.js:104-111`

```javascript
// Check if this is a fixed-price project
const fixedPrice = parseFloat(financialRecord.response.data[0].fieldData["customers_Projects::f_fixedPrice"] || 0);
console.log(`Project fixed price value: ${fixedPrice}`);

if (fixedPrice > 0) {
    console.log('Skipping sales record creation for fixed-price project');
    financialId = null; // Prevent sales record creation
}
```

**Logic**:
- After timer stops, fetch financial record
- Check `customers_Projects::f_fixedPrice` field
- If value > 0, project is fixed-price
- Skip sales record creation for fixed-price projects
- Only time-and-materials projects generate sales records

**Field**: `customers_Projects::f_fixedPrice` (FileMaker related field)

## Database Operations

### FileMaker Layouts Used

1. **devRecords** (Layouts.RECORDS)
   - Timer records
   - Start timer (CREATE)
   - Stop timer (UPDATE)
   - Fetch timers (READ)

2. **devProjects** (Layouts.PROJECTS)
   - Project lookup for customer ID
   - Used during timer start

### FileMaker Fields

**Timer Record Fields**:
- `__ID`: Timer record UUID
- `_taskID`: Foreign key to task
- `_staffID`: Foreign key to staff
- `_projectID`: Foreign key to project
- `_custID`: Foreign key to customer
- `TimeStart`: Start time
- `TimeEnd`: End time
- `DateStart`: Start date
- `TimeAdjust`: Total adjustment (pauses + manual) in seconds
- `Work Performed`: Description of work
- `Billable_Time_Rounded`: Calculated billable hours (FileMaker calculation)

**Project Fields**:
- `_custID`: Customer ID
- `customers_Projects::f_fixedPrice`: Fixed price amount

## Migration Considerations for Supabase

### Required Supabase Tables

1. **timer_records**
   ```sql
   id: uuid
   task_id: uuid (FK to tasks)
   staff_id: uuid (FK to staff)
   project_id: uuid (FK to projects)
   customer_id: uuid (FK to customers)
   start_time: timestamp with time zone
   end_time: timestamp with time zone
   time_adjust_seconds: integer
   work_performed: text
   billable_hours: numeric
   created_at: timestamp with time zone
   updated_at: timestamp with time zone
   ```

2. **Considerations**:
   - Timer state (pause/adjustment) currently client-side only
   - LocalStorage persistence works but not cross-device
   - Consider storing timer state in Supabase for cross-device support
   - Billable hours calculation needs to be replicated (currently FileMaker)

### Billable Hours Calculation

**Current**: FileMaker calculated field `Billable_Time_Rounded`

**Migration**: Need to implement calculation logic:
```javascript
function calculateBillableHours(startTime, endTime, timeAdjustSeconds) {
    const elapsedSeconds = (endTime - startTime) / 1000;
    const billableSeconds = elapsedSeconds - timeAdjustSeconds;
    return billableSeconds / 3600; // Convert to hours
}
```

### LocalStorage vs Database State

**Current**: Timer state in localStorage (client-side only)

**Pros**:
- Fast, no network latency
- Works offline
- Simple implementation

**Cons**:
- Not cross-device
- Lost on browser cache clear
- No audit trail

**Migration Options**:
1. Keep localStorage for active timer state
2. Store timer records in Supabase when stopped
3. Add optional cloud sync for cross-device support

## Code References

### Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/components/tasks/TaskTimer.jsx` | UI component for timer display and controls | 1-353 |
| `src/hooks/useTask.js` | Timer state management and operations | 28-370 |
| `src/services/taskService.js` | Timer business logic and validation | 55-131, 174-200, 619-638 |
| `src/api/tasks.js` | FileMaker API for timer records | 121-213 |
| `src/components/tasks/TaskList.jsx` | Integration with task list UI | 79-92, 489-501 |

### Key Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `handleTimerStart` | `useTask.js:204-235` | Start new timer |
| `handleTimerPause` | `useTask.js:279-301` | Pause/resume timer |
| `handleTimerStop` | `useTask.js:237-277` | Stop timer and save |
| `handleTimerAdjust` | `useTask.js:303-317` | Adjust time ±6 min |
| `startTimer` | `taskService.js:55-60` | Service layer start |
| `stopTimer` | `taskService.js:67-131` | Service layer stop with sales record |
| `startTaskTimer` | `tasks.js:121-178` | API call to start |
| `stopTaskTimer` | `tasks.js:189-213` | API call to stop |
| `processTimerRecords` | `taskService.js:174-200` | Process timer records from FileMaker |

## Summary

The timer system implements a complete state machine with three states (IDLE, RUNNING, PAUSED) and supports:

- **Start/Stop/Pause/Resume**: Full lifecycle management
- **Pause Tracking**: Client-side tracking of pause time, sent to FileMaker on stop
- **Time Adjustment**: ±6 minute increments for manual corrections
- **Persistence**: localStorage for browser session continuity
- **FileMaker Integration**: Creates and updates timer records in devRecords layout
- **Fixed-Price Logic**: Skips sales record creation for fixed-price projects
- **Error Handling**: User-friendly errors without data loss
- **UI Feedback**: Real-time display of elapsed vs adjusted time

The timer state flows through:
1. UI Component (TaskTimer) - User interactions and display
2. Hook (useTask) - State management and coordination
3. Service (taskService) - Business logic and validation
4. API (tasks.js) - FileMaker communication

All operations maintain consistency across layers and persist critical state for recovery from page reloads.
