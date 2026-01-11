# Tasks & Timer - Current Implementation

## Overview

This document provides a detailed analysis of the current Tasks and Timer implementation, including call flows, component architecture, and dual-write mechanisms.

## Architecture Layers

```
UI Components (TaskTimer.jsx, TaskList.jsx)
          ↓
API Layer (src/api/tasks.js)
          ↓
FileMaker Bridge (fetchDataFromFileMaker)
          ↓
FileMaker Layouts (devTasks, dapiRecords)
          ↓ (on timer stop)
Dual-Write Service (dualWriteService.js)
          ↓
Supabase (customer_sales table)
```

## File Inventory

### API Layer

**`src/api/tasks.js`** (317 lines)
- `fetchTasks(projectId, query)`: Fetch tasks with optional query
- `fetchTasksForProject(projectId)`: Fetch all tasks for a project
- `createTask(data)`: Create new task
- `updateTask(taskId, data)`: Update task fields
- `updateTaskStatus(taskId, completed)`: Toggle completion status
- `startTaskTimer(taskId, selectedTask)`: Start timer → creates record in dapiRecords
- `stopTaskTimer(recordId, description, saveImmediately, TimeAdjust)`: Stop timer → updates dapiRecords
- `fetchTaskTimers(taskId)`: Fetch timer records for a task
- `updateTaskNotes(taskId, notes)`: Update task notes
- `fetchActiveProjectTasks(projectId)`: Fetch non-completed tasks
- `fetchTaskNotes(taskId)`: Fetch associated notes
- `fetchTaskLinks(taskId)`: Fetch associated links

### Service Layer

**`src/services/dualWriteService.js`** (359 lines)
- `withDualWrite(fileMakerOperation, options)`: Wrapper for dual-write operations
- `stopTimerWithDualWrite(params, organizationId)`: Enhanced timer stop with Supabase sync
- `handleTimerStopSupabaseOperation(fileMakerResult, organizationId)`: Creates customer_sales record
- `dualWriteConfig.setEnabled(bool)`: Enable/disable dual writes
- `isDualWriteEnabled()`: Check if dual-write is active

**`src/services/financialSyncService.js`**
- `synchronizeFinancialRecords(orgId, startDate, endDate, options)`: Reconciles FileMaker ↔ Supabase
- `compareRecords(devRecords, customerSales, orgId)`: Identifies differences
- `createCustomerSaleFromDevRecord(devRecord, orgId)`: Creates Supabase record
- `updateCustomerSaleFromDevRecord(id, devRecord, orgId)`: Updates Supabase record

**`src/services/billableHoursService.js`**
- `processFinancialData(records)`: Calculates billable hours/amounts
- Time duration calculations
- Hourly rate application

### UI Components

**`src/components/tasks/TaskTimer.jsx`** (353 lines)
- React component with start/stop/pause/resume controls
- Local state management for elapsed time, pause tracking
- Time adjustment buttons (±6 min)
- Stop dialog for "Work Performed" description
- Keyboard shortcut (Cmd/Ctrl+S) for quick stop
- Dark mode support

**`src/components/tasks/TaskList.jsx`**
- Displays tasks for a project
- Task creation form
- Task completion toggle
- Task editing
- Timer integration

### FileMaker Layouts

**`devTasks` (Layouts.TASKS)**
Fields used:
- `__ID`: Primary key (FileMaker ID)
- `_projectID`: Foreign key to project
- `_staffID`: Assigned staff member
- `task`: Task title/description
- `type`: Task type
- `f_completed`: Boolean completion flag
- `notes`: Additional notes
- `DateCreated`, `DateModified`: Timestamps

**`dapiRecords` (Layouts.RECORDS)**
Fields used for timer/financial records:
- `__ID`: Primary key (FileMaker ID)
- `_taskID`: Foreign key to task
- `_projectID`: Foreign key to project
- `_custID`: Foreign key to customer
- `_staffID`: Staff who performed work
- `TimeStart`: Start time (HH:MM:SS)
- `DateStart`: Start date (MM/DD/YYYY)
- `TimeEnd`: End time (HH:MM:SS)
- `Work Performed`: Description of work
- `TimeAdjust`: Manual time adjustment in seconds
- Calculated fields: Duration, billable amount

## Call Flow Analysis

### Task Creation

```
User → TaskList.jsx → createTask()
  ↓
src/api/tasks.js → createTask(data)
  ↓
FileMaker Bridge → fetchDataFromFileMaker()
  ↓
FileMaker Layout: devTasks
  ↓
Action: CREATE
  ↓
Response: { recordId: "123" }
  ↓
UI refreshes task list
```

**FileMaker Request:**
```javascript
{
  layout: "devTasks",
  action: "create",
  fieldData: {
    _projectID: "abc123",
    _staffID: "staff456",
    task: "Implement feature X",
    type: "Development",
    f_completed: 0,
    notes: "Initial notes"
  }
}
```

### Task Update

```
User → TaskList.jsx → updateTask()
  ↓
src/api/tasks.js → updateTask(taskId, data)
  ↓
FileMaker Bridge → fetchDataFromFileMaker()
  ↓
FileMaker Layout: devTasks
  ↓
Action: UPDATE with recordId
  ↓
Response: { modId: "1" }
  ↓
UI refreshes
```

### Timer Start

```
User clicks "Start" → TaskTimer.jsx → onStart()
  ↓
src/api/tasks.js → startTaskTimer(taskId, selectedTask)
  ↓
Step 1: Fetch project to get customer ID
  ↓
FileMaker Bridge → fetchDataFromFileMaker(Layouts.PROJECTS)
  Query: { __ID: selectedTask._projectID }
  ↓
Step 2: Create timer record with customer ID
  ↓
FileMaker Bridge → fetchDataFromFileMaker(Layouts.RECORDS)
  Action: CREATE
  fieldData: {
    _taskID: taskId,
    _staffID: selectedTask._staffID,
    _projectID: selectedTask._projectID,
    _custID: custID,  // From project lookup
    TimeStart: "14:30:00",
    DateStart: "01/10/2026"
  }
  ↓
Response: { recordId: "rec789" }
  ↓
TaskTimer.jsx sets isRunning=true, starts local countdown
```

**Important:** Timer start does NOT yet dual-write to Supabase (only timer stop does).

### Timer Stop (with Dual-Write)

```
User clicks "Stop" → TaskTimer.jsx → shows stop dialog
  ↓
User enters description → clicks "Save & Stop" → onStop()
  ↓
src/services/dualWriteService.js → stopTimerWithDualWrite()
  ↓
Step 1: FileMaker Operation
  ↓
src/api/tasks.js → stopTaskTimer(recordId, description, false, TimeAdjust)
  ↓
FileMaker Bridge → fetchDataFromFileMaker(Layouts.RECORDS)
  Action: UPDATE
  fieldData: {
    TimeEnd: "15:45:00",
    "Work Performed": "Implemented user login flow",
    TimeAdjust: 360  // 6 minutes in seconds
  }
  ↓
FileMaker calculates duration, billable amount
  ↓
Response: { modId: "2", data: [{ fieldData: {...} }] }
  ↓
Step 2: Supabase Dual-Write
  ↓
dualWriteService.js → handleTimerStopSupabaseOperation()
  ↓
Extract financial record ID from FileMaker result
  ↓
salesService.js → createSaleFromFinancialRecord(financialId, orgId)
  ↓
Fetch full financial record from FileMaker
  ↓
Transform to Supabase customer_sales format
  ↓
Insert into Supabase customer_sales table
  ↓
Response: { success: true, supabaseRecordId: "uuid" }
  ↓
Return to UI with dual-write status
```

### Timer Pause/Resume

```
User clicks "Pause" → TaskTimer.jsx → onPause()
  ↓
Local state: isPaused = true, pauseStartTime = now
  ↓
Timer interval stops incrementing
  ↓
User clicks "Resume" → onPause() (resume handler)
  ↓
Calculate pauseDuration = now - pauseStartTime
  ↓
totalPauseTime += pauseDuration
  ↓
Local state: isPaused = false
  ↓
Timer interval resumes
  ↓
On stop: TimeAdjust includes totalPauseTime
```

**Note:** Pause tracking is client-side only. FileMaker receives final `TimeAdjust` on stop.

### Time Adjustment

```
User clicks "+6 min" or "-6 min" → TaskTimer.jsx → handleAdjustTime(minutes)
  ↓
adjustment = minutes * 60  // Convert to seconds
  ↓
Local state: elapsedTime += adjustment
  ↓
adjustment accumulator updated
  ↓
On stop: TimeAdjust = totalPauseTime + adjustment
```

### Dual-Write Reconciliation

```
Background/Manual Trigger
  ↓
financialSyncService.js → synchronizeFinancialRecords(orgId, startDate, endDate)
  ↓
Step 1: Fetch FileMaker devRecords for date range
  ↓
Step 2: Fetch Supabase customer_sales for date range + org
  ↓
Step 3: Compare records by filemaker_record_id
  ↓
Identify: toCreate, toUpdate, toDelete, unchanged
  ↓
Step 4: Store pending sync operations in localStorage
  ↓
Step 5: Apply changes (if not dry run)
  ↓
  - Create missing customer_sales records
  - Update mismatched records
  - Delete orphaned records (if deleteOrphaned=true)
  ↓
Return sync summary: { created: [], updated: [], deleted: [], errors: [] }
```

## Dual-Write Service Details

### Configuration

```javascript
DUAL_WRITE_CONFIG = {
  enabled: true,
  maxRetries: 3,
  retryDelay: 1000,  // 1 second
  timeout: 10000     // 10 seconds
}
```

### Operation Types

- `timer_start`: Creates active customer_sales record (not yet implemented)
- `timer_stop`: Creates completed customer_sales record ✅
- `record_create`: Generic record creation (placeholder)
- `record_update`: Generic record update (placeholder)

### Rollback Mechanism

Currently NOT implemented. If Supabase operation fails:
- FileMaker operation stands (source of truth)
- Error logged to console
- Dual-write status returned: `{ success: false, error: "..." }`
- Reconciliation service can fix discrepancies later

### Error Handling

1. **FileMaker fails:** Entire operation fails, no Supabase write attempted
2. **Supabase fails:** FileMaker record stands, error logged, UI notified
3. **Partial failure:** FileMaker succeeds, Supabase fails → reconciliation needed

## Component State Management

### TaskTimer.jsx State

```javascript
{
  isRunning: false,          // Timer active?
  isPaused: false,           // Timer paused?
  elapsedTime: 0,            // Seconds elapsed (raw)
  adjustedTime: 0,           // Seconds after pauses/adjustments
  description: '',           // Work description
  showStopDialog: false,     // Stop dialog visible?
  timer: {                   // Passed from parent
    recordId: "rec123",
    TimeStart: "14:30:00",
    isPaused: false,
    adjustment: 0,
    pauseStartTime: null,
    totalPauseTime: 0
  }
}
```

### Timer Lifecycle

1. **Not Running:** `isRunning=false`, no timer object
2. **Started:** `isRunning=true`, timer.recordId set, interval running
3. **Paused:** `isRunning=true`, `isPaused=true`, interval stopped
4. **Resumed:** `isRunning=true`, `isPaused=false`, interval restarted
5. **Stopped:** `isRunning=false`, state reset, stop dialog shown
6. **Saved:** Description submitted, API call, timer object cleared

## Data Transformation

### FileMaker → Supabase (customer_sales)

**FileMaker `dapiRecords` fields:**
```javascript
{
  __ID: "12345",
  _taskID: "task123",
  _projectID: "proj456",
  _custID: "cust789",
  _staffID: "staff012",
  TimeStart: "14:30:00",
  DateStart: "01/10/2026",
  TimeEnd: "15:45:00",
  "Work Performed": "Implemented feature",
  TimeAdjust: 360,
  // Calculated fields:
  Duration: 75,  // minutes
  BillableAmount: 187.50
}
```

**Supabase `customer_sales` record:**
```javascript
{
  id: "uuid-generated",
  organization_id: "org-uuid",
  customer_id: "cust-uuid",  // Mapped from _custID
  project_id: "proj-uuid",   // Mapped from _projectID
  task_id: "task-uuid",      // Mapped from _taskID
  staff_id: "staff-uuid",    // Mapped from _staffID
  date: "2026-01-10",        // From DateStart
  description: "Implemented feature",  // From Work Performed
  duration: 75,              // From Duration
  amount: 187.50,            // From BillableAmount
  status: "completed",       // Inferred
  is_billable: true,         // Inferred
  filemaker_record_id: "12345",  // From __ID
  created_at: "2026-01-10T14:30:00Z",
  updated_at: "2026-01-10T15:45:00Z"
}
```

**Key Mapping Challenges:**
- FileMaker IDs (`__ID`, `_custID`, etc.) → Supabase UUIDs
- Requires ID reconciliation table or lookup during migration
- Time format conversion (HH:MM:SS + MM/DD/YYYY → ISO 8601)

## API Function Signatures

### Task CRUD

```javascript
// Fetch tasks with optional query
fetchTasks(projectId: string, query: object[]): Promise<Object>

// Fetch all tasks for a project
fetchTasksForProject(projectId: string): Promise<Object>

// Create new task
createTask(data: {
  _projectID: string,
  _staffID: string,
  task: string,
  type: string,
  notes?: string
}): Promise<Object>

// Update task
updateTask(taskId: string, data: object): Promise<Object>

// Update completion status
updateTaskStatus(taskId: string, completed: boolean): Promise<Object>

// Update task notes
updateTaskNotes(taskId: string, notes: string): Promise<Object>
```

### Timer Operations

```javascript
// Start timer for a task
startTaskTimer(
  taskId: string,
  selectedTask: {
    _projectID: string,
    _staffID: string
  }
): Promise<Object>

// Stop timer
stopTaskTimer(
  recordId: string,
  description: string = '',
  saveImmediately: boolean = false,
  TimeAdjust: number = 0
): Promise<Object>

// Stop timer with dual-write
stopTimerWithDualWrite(
  params: {
    recordId: string,
    description: string,
    saveImmediately: boolean,
    totalPauseTime: number,
    adjustment: number
  },
  organizationId: string
): Promise<Object>

// Fetch timer records for a task
fetchTaskTimers(taskId: string): Promise<Object>
```

### Related Operations

```javascript
// Fetch task notes
fetchTaskNotes(taskId: string): Promise<Object>

// Fetch task links
fetchTaskLinks(taskId: string): Promise<Object>

// Fetch active (non-completed) tasks for a project
fetchActiveProjectTasks(projectId: string): Promise<Object>
```

## Business Rules

### Timer Start
- One active timer per task (FileMaker enforces uniqueness)
- Must have valid task ID, project ID, staff ID
- Customer ID fetched from project relationship
- Timestamps use local timezone

### Timer Stop
- Must provide "Work Performed" description (unless saveImmediately=true)
- Duration calculated: TimeEnd - TimeStart - TimeAdjust
- Billable amount = (Duration / 60) * HourlyRate
- Dual-write creates customer_sales record with same data

### Pause/Resume
- Client-side tracking only (no FileMaker write until stop)
- Total pause time accumulated across multiple pause/resume cycles
- Sent as part of TimeAdjust on stop

### Time Adjustment
- ±6 minute buttons for quick corrections
- Accumulated with pause time
- Can result in negative adjustments (time subtracted)

### Concurrency
- **Current:** No explicit locking (FileMaker last-write-wins)
- **Future Supabase:** Need idempotency keys or pessimistic locking

## Dependencies and Relationships

### Tasks depend on:
- **Projects:** `_projectID` foreign key
- **Staff:** `_staffID` assignment
- **Customers:** Indirect via project

### Timer records depend on:
- **Tasks:** `_taskID` foreign key
- **Projects:** `_projectID` foreign key
- **Customers:** `_custID` foreign key (fetched from project)
- **Staff:** `_staffID` who performed work

### Dual-write creates:
- **customer_sales:** Supabase record matching FileMaker dapiRecords

## Known Issues and Limitations

1. **Dual-Write Complexity:**
   - Two sources of truth (FileMaker + Supabase)
   - Reconciliation service needed to fix discrepancies
   - No transaction guarantee across systems

2. **ID Mapping:**
   - FileMaker uses integer IDs, Supabase uses UUIDs
   - Requires `filemaker_record_id` column for correlation
   - Migration requires ID reconciliation table

3. **Timer State:**
   - Pause/resume tracking is client-side only
   - Browser refresh loses pause state
   - No server-side timer state persistence

4. **Concurrency:**
   - Multiple users can start timer on same task (FileMaker allows)
   - No distributed locking mechanism
   - Last write wins on conflicts

5. **Rollback:**
   - No rollback if Supabase fails after FileMaker succeeds
   - Relies on reconciliation service for eventual consistency

6. **Time Zone Handling:**
   - FileMaker uses local time strings
   - Supabase expects UTC timestamps
   - Conversion needed during migration

## Migration Considerations

### Data Volume
- Estimated 10,000+ tasks
- Estimated 50,000+ timer/financial records
- Historical data must be preserved

### ID Reconciliation
- Need mapping table: `filemaker_id_mappings`
- Columns: `entity_type`, `filemaker_id`, `supabase_uuid`
- Used during migration and dual-write

### Cutover Strategy
- Phase 1: Read-only from Supabase (FileMaker still writes)
- Phase 2: Dual-write (both systems)
- Phase 3: Supabase-only (deprecate FileMaker)
- Phase 4: Remove dual-write service

### Testing Requirements
- Timer start/stop/pause/resume flows
- Financial record creation accuracy
- Concurrent timer operations
- Offline/refresh scenarios
- ID mapping correctness

---

**Code References:**
- `src/api/tasks.js` (317 lines)
- `src/services/dualWriteService.js` (359 lines)
- `src/services/financialSyncService.js`
- `src/services/billableHoursService.js`
- `src/components/tasks/TaskTimer.jsx` (353 lines)
- `src/components/tasks/TaskList.jsx`
