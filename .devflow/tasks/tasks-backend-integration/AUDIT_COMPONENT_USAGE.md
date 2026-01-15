# Task Component Usage Audit - Backend Integration Preparation

**Audit Date:** 2026-01-14
**Purpose:** Identify all components, hooks, and services using task/timer functionality for backend API integration
**Status:** Complete

---

## Executive Summary

The task and time tracking system is a critical feature spanning **25+ files** across components, hooks, services, and API layers. Current implementation relies heavily on FileMaker (via fm-gofer bridge) with selective Supabase integration for sales records. This audit identifies all files requiring updates for full backend API migration.

**Key Findings:**
- **5 core components** render task/timer UI
- **3 primary hooks** manage state (useTask, useBillableHours, useSales)
- **4 services** handle business logic and data processing
- **1 API module** interfaces with FileMaker (tasks.js)
- **Complex data flow** between FileMaker RECORDS → Supabase customer_sales

---

## 1. COMPONENTS REQUIRING UPDATES

### High Priority - Direct Task/Timer UI

#### `/src/components/tasks/TaskList.jsx`
**Current Implementation:**
- Renders task lists with active/completed sections
- Features: task creation, status toggle, notes/links management
- Integrates TaskTimer component for timer controls
- Memoized sub-components: TaskItem, TaskSection

**Required Changes:**
- Update task creation to call backend API
- Modify task status updates to use backend endpoints
- Add error handling for backend API failures
- Update loading states for async operations

**Dependencies:**
- useTask hook
- taskService
- tasks API module

---

#### `/src/components/tasks/TaskTimer.jsx`
**Current Implementation:**
- Timer display with HH:MM:SS format
- Controls: Start, Pause, Resume, Stop
- Time adjustment (+/- 6 minute increments)
- Stop dialog for work descriptions
- Pause time tracking
- Displays adjusted vs total elapsed time
- Memoized: TimerDisplay, TimerControls

**Required Changes:**
- Update timer start to create time_entries via backend
- Modify timer stop to update time_entries endpoint
- Add backend error handling for timer operations
- Update localStorage persistence format if backend changes record structure
- Handle backend validation responses (e.g., overlapping timers)

**Dependencies:**
- useTask hook
- taskService.startTimer/stopTimer
- tasks API startTaskTimer/stopTaskTimer

---

#### `/src/components/projects/ProjectTasksTab.jsx`
**Current Implementation:**
- Project-level task view wrapper
- Passes project context to TaskList

**Required Changes:**
- Minor - ensure project ID passed correctly to backend API
- Update error boundary for backend API errors

**Dependencies:**
- TaskList component
- useTask hook

---

### Medium Priority - Financial Integration

#### `/src/components/financial/TimeframeSelector.jsx`
**Current Implementation:**
- Dropdown for selecting billable hours timeframe
- Options: thisMonth, unpaid, lastMonth, thisQuarter, thisYear

**Required Changes:**
- Minimal - component is presentation-only
- May need new timeframe options if backend supports different query patterns

**Dependencies:**
- useBillableHours hook

---

#### `/src/components/financial/FinancialChart.jsx`
**Current Implementation:**
- Chart visualization for billable hours data
- Supports: bar, stacked, line, quarterlyline, yearlyline

**Required Changes:**
- Update if backend changes data structure for financial records
- Verify chartData format matches backend response

**Dependencies:**
- useBillableHours hook
- billableHoursService.prepareChartData

---

#### `/src/components/financial/CustomerList.jsx`
**Current Implementation:**
- Lists customers with billable hours grouped by project
- Displays totals for billed/unbilled amounts

**Required Changes:**
- Update to consume backend financial records API
- Modify grouping logic if backend provides pre-aggregated data

**Dependencies:**
- useBillableHours hook
- billableHoursService.groupRecordsByCustomer

---

## 2. HOOKS REQUIRING UPDATES

### Critical - Core State Management

#### `/src/hooks/useTask.js`
**Current Implementation:**
- **State:** tasks, selectedTask, timer, timerRecords, taskNotes, taskLinks, stats
- **Operations:**
  - `loadTasks(projectId)` - Fetch project tasks
  - `handleTaskSelect(taskId)` - Load task details
  - `handleTaskCreate(taskData)` - Create task with validation
  - `handleTaskUpdate(taskId, taskData)` - Update task
  - `handleTaskStatusChange(recordId, completed)` - Toggle completion
  - `handleTimerStart(task)` - Start timer
  - `handleTimerStop(saveImmediately, description)` - Stop timer
  - `handleTimerPause()` - Pause timer
  - `handleTimerAdjust(minutes)` - Adjust time +/- 6 minutes
- **Derived State:** activeTasks, completedTasks
- **Persistence:** localStorage for active timer

**Required Changes:**
- **PRIMARY INTEGRATION POINT** - all task operations route through this hook
- Replace taskService calls with backend API equivalents
- Update timer state structure to match backend time_entries schema
- Modify localStorage key/format if backend changes timer structure
- Add error handling for backend validation (e.g., required fields, overlapping timers)
- Update stats calculation to use backend aggregations if available

**Backend API Endpoints Needed:**
- `GET /api/tasks?project_id={id}` - Load tasks
- `GET /api/tasks/{id}` - Task details
- `POST /api/tasks` - Create task
- `PATCH /api/tasks/{id}` - Update task
- `PATCH /api/tasks/{id}/status` - Toggle completion
- `POST /api/time-entries` - Start timer
- `PATCH /api/time-entries/{id}` - Stop/update timer
- `GET /api/time-entries?task_id={id}` - Load timer records

**Files to Update:**
- Hook file itself
- All components importing useTask (TaskList, ProjectTasksTab)

---

#### `/src/hooks/useBillableHours.js`
**Current Implementation:**
- **State:** records, timeframe, selectedCustomer, selectedProject
- **Timeframes:** thisMonth, unpaid, lastMonth, thisQuarter, thisYear
- **Features:**
  - Customer and project filtering
  - Chart data generation (stacked, line, quarterly, yearly)
  - Sorting by date/amount
  - Edit modal for record updates
  - Billed status tracking
- **Memoization:** filteredRecords, chartData, totals, monthlyTotals

**Required Changes:**
- Update to fetch financial records from backend API
- Replace billableHoursService.processFinancialData with backend response parser
- Modify filtering logic if backend supports server-side filtering
- Update chart data preparation for backend data structure
- Change edit operations to use backend PATCH endpoints

**Backend API Endpoints Needed:**
- `GET /api/financial-records?timeframe={timeframe}&customer_id={id}&project_id={id}` - Load records with filters
- `PATCH /api/financial-records/{id}` - Update billed status or other fields
- `GET /api/financial-records/stats?timeframe={timeframe}` - Aggregated stats

**Files to Update:**
- Hook file itself
- Financial components (FinancialChart, CustomerList, TimeframeSelector)

---

#### `/src/hooks/useSales.js`
**Current Implementation:**
- **State:** sales, selectedSale, stats
- **Operations:**
  - `loadSalesForOrganization(orgId)` - Unbilled sales
  - `loadAllSalesForOrganization(orgId)` - All sales
  - `loadSalesForCustomer(customerId)` - Customer-filtered
  - `loadUnbilledSalesForOrganization/Customer` - Unbilled only
  - `loadCurrentMonthSalesForOrganization/Customer` - Current month
  - CRUD: create, update, delete sales
- **Auto-initialization:** Loads on app startup with user organization

**Required Changes:**
- **CRITICAL INTEGRATION** - sales creation is linked to timer stops
- Update to use backend sales API instead of direct Supabase calls
- Modify sales creation from time entries to use backend endpoint
- Add backend validation handling
- Update stats calculation to use backend aggregations

**Backend API Endpoints Needed:**
- `GET /api/sales?organization_id={id}&billed={bool}&customer_id={id}` - Load sales with filters
- `POST /api/sales` - Create sale
- `POST /api/sales/batch` - Batch create sales
- `PATCH /api/sales/{id}` - Update sale
- `DELETE /api/sales/{id}` - Delete sale
- `POST /api/sales/from-time-entry` - Convert time entry to sale
- `GET /api/sales/stats?organization_id={id}` - Aggregated stats

**Files to Update:**
- Hook file itself
- Any components using sales data (not immediately task-related but linked via timer workflow)

---

## 3. SERVICES REQUIRING UPDATES

### Critical - Business Logic Layer

#### `/src/services/taskService.js`
**Current Implementation:**
- **Data Processing:**
  - `loadProjectTasks(projectId)` - Fetch and process
  - `loadTaskDetails(taskId)` - Load timers, notes, links
  - `processTaskData(data)` - FileMaker → UI format
  - `processTimerRecords(timerRecords)` - Parse time strings
  - `processTaskNotes(data)` - Extract notes
  - `processTaskLinks(data)` - Extract links

- **Timer Operations:**
  - `startTimer(task)` - Create FileMaker RECORDS entry
  - `stopTimer(params, organizationId)` - Update RECORDS + create Supabase sales
  - Handles pause time and manual adjustments

- **Validation & Formatting:**
  - `validateTaskData(data, options)` - Required fields
  - `formatTaskForDisplay(task, timers, notes, links)`
  - `formatDuration(minutes)` - "Xh Ym"
  - `formatTaskForFileMaker(data)`

- **Task Operations:**
  - `createNewTask(params)` - Create with UUID
  - `updateExistingTask(taskId, taskData)`
  - `updateTaskCompletionStatus(taskId, completed)`

- **Utilities:**
  - `groupTasksByStatus(tasks)` - Active/completed
  - `calculateTaskStats(tasks, timerRecords)` - Metrics
  - `sortTasks(tasks)` - By status and date
  - `isValidTimerAdjustment(minutes)` - 6-minute validation
  - `calculateTotalTaskTime(timerRecords)` - Sum durations

**Required Changes:**
- **LARGEST SERVICE REFACTOR** - entire service is FileMaker-centric
- Replace all FileMaker API calls with backend API equivalents
- Update data processing functions for backend response format
- Modify `stopTimer` to use backend endpoint that handles both time_entries and sales creation
- Update validation to match backend schema requirements
- Change formatting functions for backend field names
- Add HMAC authentication using dataService.generateBackendAuthHeader()

**Backend API Endpoints Needed:**
- All task and time entry endpoints listed in useTask section above
- Potential combined endpoint: `POST /api/time-entries/{id}/stop` that:
  - Stops timer
  - Creates sales record if time-based billing
  - Returns updated task stats

**Files to Update:**
- Service file itself
- useTask hook (primary consumer)

---

#### `/src/services/billableHoursService.js`
**Current Implementation:**
- **Data Processing:**
  - `processFinancialData(data)` - FileMaker RECORDS → UI format
  - Maps billable hours, rates, customer/project names
  - Detects fixed-price projects

- **Grouping & Filtering:**
  - `groupRecordsByCustomer(records)` - Customer aggregation
  - `groupRecordsByProject(records, customerId)` - Project aggregation
  - `filterRecordsByBilledStatus(records, billed)`
  - `filterRecordsByDateRange(records, startDate, endDate)`

- **Calculations:**
  - `calculateTotals(records)` - Billed/unbilled amounts and hours
  - `calculateMonthlyTotals(records)` - Monthly aggregations

- **Chart Data:**
  - `prepareChartData(records, chartType)` - Supports:
    - "bar" - Total by customer
    - "stacked" - By customer and project
    - "line" - Monthly with billed/unbilled
    - "quarterlyline" - 3-month vs previous year
    - "yearlyline" - Full year trend

- **Sorting:**
  - `sortRecordsByDate(records, direction)`
  - `sortRecordsByAmount(records, direction)`

- **Formatting:**
  - `formatFinancialRecordForDisplay(record)` - UI display
  - `formatFinancialRecordForFileMaker(data)` - Backend format
  - `formatHours(hours)` - "X.XX hrs"
  - `formatDate(dateString)` - Locale formatting

- **Validation:**
  - `validateFinancialRecordData(data)` - Required fields

**Required Changes:**
- **MAJOR REFACTOR** - all FileMaker-specific processing must change
- Update `processFinancialData` to parse backend API response format
- Modify field mappings to match backend schema (e.g., backend may use snake_case)
- Update `formatFinancialRecordForFileMaker` to `formatFinancialRecordForBackend`
- Verify calculations still work with backend data types
- Add backend-specific validation

**Backend API Endpoints Needed:**
- Financial records endpoints (see useBillableHours section)
- Backend may provide pre-aggregated data, reducing need for client-side calculations

**Files to Update:**
- Service file itself
- useBillableHours hook
- Financial components

---

#### `/src/services/salesService.js` (1,524 lines)
**Current Implementation:**
- **Fetch Operations:**
  - `fetchSalesByOrganization(orgId)` - All sales
  - `fetchUnbilledSalesByOrganization(orgId)` - Null inv_id
  - `fetchCurrentMonthSalesByOrganization(orgId)` - Current month filter
  - Customer-level equivalents

- **CRUD:**
  - `createSale(saleData)` - Single sale with validation
  - `createSalesBatch(salesDataArray)` - Batch creation
  - `updateSale(saleId, saleData, patchPayload)` - Targeted PATCH
  - `updateSaleTargeted(saleId, patchData)` - Mutable fields only
  - `deleteSale(saleId)`

- **Key Integration: Time Entry to Sales:**
  - `createSalesFromUnbilledFinancials(organizationId)` - Converts RECORDS → sales
  - `createSaleFromFinancialRecord(financialId, organizationId)` - Single conversion
  - `updateFinancialRecord(financialId, financialRecord)` - Updates corresponding sales
  - `createSalesFromProjectValue(project, organizationId)` - Project-based

- **Processing & Validation:**
  - `validateSaleData(data)` - Required fields
  - `formatSaleForDisplay(sale)` - UI formatting
  - `calculateSalesStats(sales)` - Aggregate stats
  - `processJsonData(data)` - Recursive JSON parsing

**Required Changes:**
- **CRITICAL TIMER INTEGRATION** - `createSaleFromFinancialRecord` is called when timers stop
- Replace Supabase client calls with backend API calls
- Update to use backend endpoint for time-entry-to-sale conversion
- Modify data processing for backend response format
- Add HMAC authentication for backend calls
- Update validation to match backend requirements

**Backend API Endpoints Needed:**
- All sales endpoints listed in useSales section above
- Special focus on: `POST /api/sales/from-time-entry` endpoint

**Files to Update:**
- Service file itself (1,524 lines - significant work)
- useSales hook
- taskService.stopTimer (calls createSaleFromFinancialRecord)

---

#### `/src/services/monthlyBillableService.js`
**Current Implementation:**
- `getMonthlyBillableHours(organizationId)` - Fetches current month hours from Supabase customer_sales
- Direct Supabase query by organization and date range
- Returns total billable hours for current month

**Required Changes:**
- Replace Supabase query with backend API call
- Update to use backend endpoint for monthly stats
- Add HMAC authentication

**Backend API Endpoints Needed:**
- `GET /api/financial-records/monthly-hours?organization_id={id}` or similar

**Files to Update:**
- Service file itself
- Any components/hooks using monthly billable data

---

## 4. API LAYER REQUIRING UPDATES

### Critical - FileMaker Bridge Replacement

#### `/src/api/tasks.js`
**Current Implementation:**
- **Read Operations:**
  - `fetchTasksForProject(projectId)` - Query by project
  - `fetchTasks(projectId, query)` - Custom queries
  - `fetchActiveProjectTasks(projectId)` - f_completed = false
  - `fetchTaskTimers(taskId)` - RECORDS table by _taskID
  - `fetchTaskNotes(taskId)` - NOTES layout by _fkID
  - `fetchTaskLinks(taskId)` - LINKS layout by _fkID

- **Write Operations:**
  - `createTask(data)` - Creates in TASKS layout
  - `updateTask(taskId, data)` - Updates task
  - `updateTaskStatus(taskId, completed)` - Sets f_completed
  - `updateTaskNotes(taskId, notes)` - Updates notes field

- **Timer Operations:**
  - `startTaskTimer(taskId, selectedTask)` - Creates RECORDS entry
    - Queries project for customer ID
    - Sets TimeStart, DateStart, _taskID, _staffID, _projectID, _custID
  - `stopTaskTimer(recordId, description, saveImmediately, TimeAdjust)` - Updates RECORDS
    - Sets TimeEnd, Work Performed, TimeAdjust

- **Error Handling:**
  - Validation via `validateParams()`
  - Operation wrapping with `handleFileMakerOperation()`

**Required Changes:**
- **COMPLETE REWRITE** - entire file is FileMaker-specific
- Create new backend API client or adapter
- Replace all fm-gofer calls with fetch/axios to backend API
- Update parameter validation for backend schema
- Change error handling to process backend error responses
- Add HMAC authentication using dataService.generateBackendAuthHeader()
- Update field names from FileMaker convention (_fkID, f_completed) to backend schema (task_id, is_completed, etc.)

**Backend API Endpoints to Implement:**
```
GET    /api/tasks?project_id={id}&status={active|completed}
GET    /api/tasks/{id}
POST   /api/tasks
PATCH  /api/tasks/{id}
PATCH  /api/tasks/{id}/status

GET    /api/time-entries?task_id={id}
POST   /api/time-entries
PATCH  /api/time-entries/{id}

GET    /api/task-notes?task_id={id}
POST   /api/task-notes
PATCH  /api/task-notes/{id}

GET    /api/task-links?task_id={id}
POST   /api/task-links
PATCH  /api/task-links/{id}
```

**Files to Update:**
- Entire file (potentially rename to `/src/api/backend/tasks.js`)
- taskService (primary consumer)

---

## 5. DATA FLOW PATTERNS - BEFORE & AFTER

### Current Flow (FileMaker-Centric)

```
User Action: Start Timer
  ↓
TaskTimer Component
  ↓
useTask.handleTimerStart()
  ↓
taskService.startTimer()
  ↓
api/tasks.startTaskTimer()
  ↓
fm-gofer bridge → FileMaker RECORDS layout
  ↓
Timer state saved to localStorage
  ↓
TaskTimer component updates UI

User Action: Stop Timer
  ↓
TaskTimer Component (stop dialog)
  ↓
useTask.handleTimerStop(description)
  ↓
taskService.stopTimer()
  ↓
api/tasks.stopTaskTimer()
  ↓
fm-gofer bridge → FileMaker RECORDS updated (TimeEnd, Work Performed)
  ↓
IF project is time-based AND organization ID available:
  taskService → salesService.createSaleFromFinancialRecord()
  ↓
  Supabase query → customer_sales table
  ↓
  Sales record created
  ↓
Timer cleared from localStorage
  ↓
useTask.loadTaskDetails() refreshes
```

### Target Flow (Backend API-Centric)

```
User Action: Start Timer
  ↓
TaskTimer Component
  ↓
useTask.handleTimerStart()
  ↓
taskService.startTimer()
  ↓
api/backend/tasks.startTaskTimer()
  ↓
fetch with HMAC auth → Backend API POST /api/time-entries
  ↓
Backend creates time_entry record in database
  ↓
Response: { id, task_id, start_time, staff_id, project_id, customer_id }
  ↓
Timer state saved to localStorage
  ↓
TaskTimer component updates UI

User Action: Stop Timer
  ↓
TaskTimer Component (stop dialog)
  ↓
useTask.handleTimerStop(description)
  ↓
taskService.stopTimer()
  ↓
api/backend/tasks.stopTaskTimer()
  ↓
fetch with HMAC auth → Backend API PATCH /api/time-entries/{id}/stop
  ↓
Backend:
  - Updates time_entry (end_time, description, duration, adjustments)
  - Checks project billing type
  - IF time-based: Creates sales record automatically
  - Returns: { time_entry, sales_record (optional), task_stats }
  ↓
Timer cleared from localStorage
  ↓
useTask updates state with response data (no additional queries needed)
```

**Key Improvements:**
- Single backend endpoint handles both timer stop and sales creation
- Reduces round-trip queries (backend handles logic server-side)
- HMAC authentication ensures secure API access
- Backend enforces business rules (overlapping timers, validation)
- Consistent error handling through backend API

---

## 6. KEY FIELDS & DATA STRUCTURE MAPPING

### FileMaker RECORDS Table → Backend time_entries Table

| FileMaker Field | Backend Field | Type | Notes |
|----------------|---------------|------|-------|
| recordId | id | UUID | Primary key |
| __ID | external_id | UUID | FileMaker reference (if migrating) |
| TimeStart | start_time | timestamp | ISO 8601 format |
| TimeEnd | end_time | timestamp | Nullable until stopped |
| DateStart | start_date | date | Extracted from start_time |
| Work Performed | description | text | Work notes |
| Billable_Time_Rounded | duration_hours | decimal | Calculated by backend |
| TimeAdjust | adjustment_minutes | integer | Manual time adjustments |
| _taskID | task_id | UUID | Foreign key to tasks |
| _staffID | staff_id | UUID | Foreign key to staff |
| _projectID | project_id | UUID | Foreign key to projects |
| _custID | customer_id | UUID | Foreign key to customers |
| Hourly_Rate | hourly_rate | decimal | Billing rate |
| f_billed | is_billed | boolean | Invoice status |
| ~creationTimestamp | created_at | timestamp | Auto-generated |
| ~modificationTimestamp | updated_at | timestamp | Auto-updated |

### FileMaker TASKS Table → Backend tasks Table

| FileMaker Field | Backend Field | Type | Notes |
|----------------|---------------|------|-------|
| recordId | id | UUID | Primary key |
| __ID | external_id | UUID | FileMaker reference |
| task | name | string | Task name |
| type | task_type | string | Task category |
| f_completed | is_completed | boolean | Completion status |
| _projectID | project_id | UUID | Foreign key |
| _staffID | assigned_staff_id | UUID | Assigned staff |
| ~creationTimestamp | created_at | timestamp | Auto-generated |
| ~modificationTimestamp | updated_at | timestamp | Auto-updated |

### Supabase customer_sales Table (Already Exists)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| financial_id | UUID | Link to time_entry.id |
| customer_id | UUID | Foreign key |
| date | date | Sales date |
| product_name | text | Formatted: "CUSTOMER:PROJECT" |
| quantity | decimal | Hours worked |
| unit_price | decimal | Hourly rate |
| total_price | decimal | quantity * unit_price |
| inv_id | UUID | Nullable - invoice reference |
| organization_id | UUID | Organization scoping |
| created_at | timestamp | Auto-generated |
| updated_at | timestamp | Auto-updated |

**Note:** Backend API should maintain this structure or provide clear migration path.

---

## 7. INTEGRATION DEPENDENCIES & ORDER

### Phase 1: Backend API Endpoints (Prerequisite)
**Required Before Frontend Work:**
1. Tasks CRUD endpoints
2. Time entries endpoints (start, stop, update)
3. Financial records query endpoints
4. Sales endpoints (CRUD + from-time-entry conversion)
5. Task notes/links endpoints
6. Authentication middleware (HMAC validation)

### Phase 2: API Layer Replacement
**Files to Update First:**
1. `/src/api/tasks.js` → `/src/api/backend/tasks.js`
   - Replace fm-gofer with fetch/axios
   - Add HMAC authentication
   - Update field mappings

### Phase 3: Services Layer
**Update in Order:**
1. `/src/services/taskService.js`
   - Depends on new api/backend/tasks.js
   - Update all FileMaker-specific functions
   - Change data processing for backend format

2. `/src/services/billableHoursService.js`
   - Update financial data processing
   - Modify field mappings

3. `/src/services/salesService.js`
   - Replace Supabase client with backend API
   - Update time-entry-to-sale conversion

4. `/src/services/monthlyBillableService.js`
   - Replace Supabase query with backend API

### Phase 4: Hooks Layer
**Update in Order:**
1. `/src/hooks/useTask.js`
   - Depends on updated taskService
   - Update state management for backend data
   - Modify localStorage format if needed

2. `/src/hooks/useBillableHours.js`
   - Depends on updated billableHoursService
   - Update filtering/aggregation logic

3. `/src/hooks/useSales.js`
   - Depends on updated salesService
   - Update state management

### Phase 5: Components Layer
**Update Last:**
1. `/src/components/tasks/TaskTimer.jsx`
   - Verify timer controls work with backend
   - Update error handling

2. `/src/components/tasks/TaskList.jsx`
   - Verify task operations work with backend
   - Update loading states

3. `/src/components/financial/*.jsx`
   - Verify financial data displays correctly
   - Update chart rendering if needed

---

## 8. TESTING STRATEGY

### Critical Test Paths

1. **Timer Lifecycle:**
   - Start timer → localStorage persists → page refresh → timer resumes
   - Pause timer → resume timer → correct duration
   - Adjust time +6 minutes → correct billing
   - Stop timer → sales record created (time-based projects only)

2. **Task Operations:**
   - Create task → appears in project
   - Update task → changes reflected
   - Toggle completion → moves between active/completed sections
   - Delete task → removed from list

3. **Financial Records:**
   - Timer stop → financial record created
   - Filter by timeframe → correct records shown
   - Edit billed status → updates reflected
   - Chart generation → correct data visualization

4. **Sales Creation:**
   - Time-based project timer stop → sales record created
   - Fixed-price project timer stop → NO sales record
   - Customer lookup → existing customer found
   - Customer lookup → new customer created if not found

### Edge Cases to Test

1. **Concurrent Timers:**
   - User starts timer, switches to another task → first timer still active?
   - Backend validation for overlapping timers

2. **Offline/Network Errors:**
   - Timer running, network drops → localStorage preserves state
   - Timer stop fails → retry logic

3. **Time Adjustments:**
   - Negative time → validation prevents
   - Excessive adjustments → backend limits

4. **Sales Record Creation Failures:**
   - Supabase unavailable → graceful degradation
   - Customer lookup fails → error handling

### Verification Commands

After each phase, run:
```bash
# Build verification
npm run build

# Type checking (if TypeScript)
npm run type-check

# Start dev server
npm run dev

# Manual testing in browser
# - Navigate to project with tasks
# - Start/stop timer
# - Verify financial records
# - Check sales creation
```

---

## 9. RISK ASSESSMENT

### High Risk Areas

1. **Timer State Persistence:**
   - localStorage format changes could break timer recovery
   - **Mitigation:** Version localStorage keys, add migration logic

2. **Sales Record Creation:**
   - Critical business logic linking time entries to invoicing
   - **Mitigation:** Extensive testing, rollback plan, dual-write period

3. **Financial Data Accuracy:**
   - Billing calculations must be 100% accurate
   - **Mitigation:** Compare backend calculations with FileMaker for validation period

4. **Concurrent Users:**
   - Multiple staff editing same task/project
   - **Mitigation:** Backend optimistic locking or last-write-wins strategy

### Medium Risk Areas

1. **Chart Data Formatting:**
   - Backend data structure changes could break charts
   - **Mitigation:** Backend provides chart-ready format or service layer adapts

2. **Task Notes/Links:**
   - Separate FileMaker layouts → backend API design
   - **Mitigation:** Clear API contract for nested data

3. **Organization Scoping:**
   - RLS policies must prevent cross-organization data access
   - **Mitigation:** Backend RLS testing, organization_id validation

### Low Risk Areas

1. **UI Components:**
   - Mostly presentation logic, minimal changes
   - **Mitigation:** Props validation, error boundaries

2. **Timeframe Filtering:**
   - Simple date range logic
   - **Mitigation:** Backend provides filtering or client-side filters

---

## 10. BACKWARD COMPATIBILITY STRATEGY

### Dual-Write Period

**Approach:** During transition, write to both FileMaker and backend API
- Timer start: Create RECORDS entry + backend time_entry
- Timer stop: Update both systems
- Validation: Compare data between systems

**Implementation:**
```javascript
// In taskService.startTimer()
async function startTimer(task) {
  const fmResult = await startTaskTimerFileMaker(task); // Legacy
  const backendResult = await startTaskTimerBackend(task); // New

  // Use backend result, log discrepancies
  if (!compareResults(fmResult, backendResult)) {
    console.error('Timer start mismatch:', { fmResult, backendResult });
  }

  return backendResult;
}
```

### Feature Flags

```javascript
// In .env
VITE_FEATURE_BACKEND_TASKS=true
VITE_FEATURE_DUAL_WRITE_TIMERS=true

// In taskService.js
const USE_BACKEND_API = import.meta.env.VITE_FEATURE_BACKEND_TASKS === 'true';
const DUAL_WRITE = import.meta.env.VITE_FEATURE_DUAL_WRITE_TIMERS === 'true';
```

### Rollback Plan

1. **Phase 1 Rollback:** Disable backend API via feature flag → reverts to FileMaker
2. **Phase 2 Rollback:** If data integrity issues, dual-write reveals discrepancies
3. **Phase 3 Rollback:** After validation period, remove FileMaker code

---

## 11. PERFORMANCE CONSIDERATIONS

### Current Performance Characteristics

- **FileMaker Queries:** ~200-500ms latency for task lists
- **Timer Operations:** ~100ms for start/stop
- **Financial Records:** ~500-1000ms for complex aggregations
- **Sales Creation:** ~300ms Supabase insert

### Expected Backend API Performance

- **Tasks Query:** ~150-300ms (REST API, indexed queries)
- **Timer Operations:** ~100-200ms (simple CRUD)
- **Financial Aggregations:** ~200-400ms (server-side SQL aggregations)
- **Sales Creation:** ~150ms (backend handles transaction)

### Optimization Opportunities

1. **Server-Side Aggregations:**
   - Move billable hours calculations to backend
   - Reduce client-side data processing

2. **Batch Operations:**
   - Backend endpoint for batch timer updates
   - Reduce round-trip queries

3. **Caching:**
   - Task lists cached for project (invalidate on updates)
   - Financial stats cached for timeframe

4. **Optimistic UI Updates:**
   - Update UI immediately, sync in background
   - Rollback on backend error

---

## 12. SUMMARY OF FILES REQUIRING UPDATES

### Critical Path (Must Update)

| File | Lines | Complexity | Priority | Estimated Effort |
|------|-------|------------|----------|------------------|
| `/src/api/tasks.js` | ~500 | High | 1 | 8-12 hours |
| `/src/services/taskService.js` | ~800 | High | 2 | 16-24 hours |
| `/src/services/salesService.js` | 1,524 | Very High | 3 | 24-32 hours |
| `/src/hooks/useTask.js` | ~400 | Medium | 4 | 8-12 hours |
| `/src/components/tasks/TaskTimer.jsx` | ~300 | Medium | 5 | 4-6 hours |
| `/src/components/tasks/TaskList.jsx` | ~400 | Medium | 6 | 4-6 hours |
| `/src/services/billableHoursService.js` | ~600 | Medium | 7 | 8-12 hours |
| `/src/hooks/useBillableHours.js` | ~300 | Medium | 8 | 4-6 hours |

**Total Critical Path Effort:** ~76-110 hours

### Supporting Files (Update After Critical Path)

| File | Lines | Complexity | Priority | Estimated Effort |
|------|-------|------------|----------|------------------|
| `/src/hooks/useSales.js` | ~200 | Low | 9 | 2-4 hours |
| `/src/services/monthlyBillableService.js` | ~100 | Low | 10 | 1-2 hours |
| `/src/components/projects/ProjectTasksTab.jsx` | ~150 | Low | 11 | 1-2 hours |
| `/src/components/financial/FinancialChart.jsx` | ~200 | Low | 12 | 2-3 hours |
| `/src/components/financial/CustomerList.jsx` | ~250 | Low | 13 | 2-3 hours |
| `/src/components/financial/TimeframeSelector.jsx` | ~80 | Low | 14 | 1 hour |

**Total Supporting Effort:** ~9-15 hours

### Grand Total Estimated Effort: 85-125 hours

**Assumptions:**
- Backend API endpoints already implemented and tested
- Developer familiar with codebase
- Includes testing and debugging time
- Does not include backend development time

---

## 13. NEXT STEPS

### Immediate Actions

1. **Review Backend API Specification:**
   - Confirm endpoint availability
   - Verify request/response formats
   - Test authentication (HMAC)

2. **Create Backend Change Request:**
   - Document required endpoints (see section 10)
   - Define request/response schemas
   - Specify error codes and validation rules

3. **Set Up Development Environment:**
   - Ensure backend API accessible from dev environment
   - Configure HMAC secret keys
   - Set up feature flags

4. **Create Test Data:**
   - Seed backend database with test tasks, projects, customers
   - Create test organization and staff accounts
   - Prepare test scenarios for timer workflows

### Development Workflow

1. **Branch Strategy:**
   - Create feature branch: `feature/tasks-backend-integration`
   - Sub-branches for each phase: `feature/tasks-api-layer`, `feature/tasks-services`, etc.

2. **Pull Request Process:**
   - Small, focused PRs per file or logical group
   - Include manual test results in PR description
   - Require code review before merge

3. **Testing Checkpoints:**
   - After API layer: Test all endpoints with Postman/curl
   - After services: Test data processing with sample data
   - After hooks: Test state management in isolation
   - After components: Full E2E testing in browser

### Documentation Updates

1. **Update CLAUDE.md:**
   - Document new backend API integration
   - Remove FileMaker-specific guidance for tasks
   - Add troubleshooting section for backend API errors

2. **Create Migration Guide:**
   - Document field mappings
   - List behavioral changes
   - Provide rollback instructions

3. **Update API Documentation:**
   - Add backend API examples
   - Document HMAC authentication process
   - Provide sample requests/responses

---

## APPENDIX A: Backend API Specification (Recommended)

### Authentication

All requests require HMAC-SHA256 authentication:
```
Authorization: Bearer {signature}.{timestamp}
```

Where `signature = HMAC-SHA256(request_body + timestamp, secret_key)`

### Endpoints Required

#### Tasks

```
GET /api/tasks
  Query params: project_id, status (active|completed|all)
  Response: { tasks: [...], total: int }

GET /api/tasks/{id}
  Response: { task: {...}, time_entries: [...], notes: [...], links: [...] }

POST /api/tasks
  Body: { name, task_type, project_id, assigned_staff_id, organization_id }
  Response: { task: {...} }

PATCH /api/tasks/{id}
  Body: { name?, task_type?, assigned_staff_id? }
  Response: { task: {...} }

PATCH /api/tasks/{id}/status
  Body: { is_completed: boolean }
  Response: { task: {...} }
```

#### Time Entries

```
GET /api/time-entries
  Query params: task_id, project_id, staff_id, start_date, end_date
  Response: { time_entries: [...], total_hours: decimal }

POST /api/time-entries
  Body: { task_id, staff_id, project_id, customer_id, start_time }
  Response: { time_entry: {...} }

PATCH /api/time-entries/{id}/stop
  Body: { end_time, description, adjustment_minutes? }
  Response: {
    time_entry: {...},
    sales_record: {...} (if time-based project),
    task_stats: { total_time: decimal, entry_count: int }
  }

PATCH /api/time-entries/{id}
  Body: { description?, adjustment_minutes?, hourly_rate? }
  Response: { time_entry: {...} }
```

#### Financial Records

```
GET /api/financial-records
  Query params: organization_id, timeframe, customer_id?, project_id?, is_billed?
  Response: {
    records: [...],
    totals: { billed_amount, unbilled_amount, billed_hours, unbilled_hours },
    monthly_totals: [...]
  }

PATCH /api/financial-records/{id}
  Body: { is_billed?, hourly_rate?, description? }
  Response: { record: {...} }
```

#### Sales

```
GET /api/sales
  Query params: organization_id, customer_id?, is_billed?, start_date?, end_date?
  Response: { sales: [...], stats: {...} }

POST /api/sales
  Body: { customer_id, date, product_name, quantity, unit_price, organization_id }
  Response: { sale: {...} }

POST /api/sales/batch
  Body: { sales: [...] }
  Response: { sales: [...], created_count: int }

POST /api/sales/from-time-entry
  Body: { time_entry_id, organization_id }
  Response: { sale: {...} }

PATCH /api/sales/{id}
  Body: { quantity?, unit_price?, inv_id? }
  Response: { sale: {...} }

DELETE /api/sales/{id}
  Response: { success: boolean }
```

#### Task Notes

```
GET /api/task-notes
  Query params: task_id
  Response: { notes: [...] }

POST /api/task-notes
  Body: { task_id, content, staff_id }
  Response: { note: {...} }

PATCH /api/task-notes/{id}
  Body: { content }
  Response: { note: {...} }
```

#### Task Links

```
GET /api/task-links
  Query params: task_id
  Response: { links: [...] }

POST /api/task-links
  Body: { task_id, url, title?, description? }
  Response: { link: {...} }

DELETE /api/task-links/{id}
  Response: { success: boolean }
```

---

## APPENDIX B: Error Handling Strategy

### Backend Error Codes

```javascript
// Expected backend error responses
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Task name is required",
    "field": "name"
  }
}

{
  "error": {
    "code": "OVERLAPPING_TIMER",
    "message": "Another timer is already running for this staff member",
    "active_timer_id": "uuid"
  }
}

{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid HMAC signature"
  }
}
```

### Frontend Error Handling

```javascript
// In taskService.js
async function startTimer(task) {
  try {
    const result = await api.startTaskTimer(task);
    return result;
  } catch (error) {
    if (error.code === 'OVERLAPPING_TIMER') {
      throw new Error(`Cannot start timer: ${error.message}`);
    } else if (error.code === 'VALIDATION_ERROR') {
      throw new Error(`Validation failed: ${error.message}`);
    } else if (error.code === 'UNAUTHORIZED') {
      // Re-authenticate user
      await reauthenticate();
      return startTimer(task); // Retry
    } else {
      console.error('Unexpected error starting timer:', error);
      throw new Error('Failed to start timer. Please try again.');
    }
  }
}
```

---

## APPENDIX C: Data Migration Checklist

### Pre-Migration

- [ ] Backup FileMaker RECORDS table
- [ ] Backup FileMaker TASKS table
- [ ] Backup Supabase customer_sales table
- [ ] Export sample data for testing
- [ ] Document current data volumes (tasks count, time entries count)

### Migration

- [ ] Create backend database schema (tasks, time_entries, task_notes, task_links)
- [ ] Run migration script: FileMaker → Backend
- [ ] Verify data integrity: counts match, no missing records
- [ ] Verify relationships: task_id, project_id foreign keys valid
- [ ] Test calculations: billable hours match between systems

### Post-Migration

- [ ] Enable dual-write mode
- [ ] Monitor discrepancies for 1 week
- [ ] Fix any data sync issues
- [ ] Disable FileMaker writes
- [ ] Monitor backend API for 1 week
- [ ] Remove FileMaker code after successful validation

---

**End of Audit Report**

Generated: 2026-01-14
Next Review: After backend API implementation complete
