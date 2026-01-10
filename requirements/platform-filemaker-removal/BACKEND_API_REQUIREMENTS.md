# Backend API Requirements for FileMaker Removal

**Generated:** 2026-01-10
**Purpose:** Define backend endpoint requirements to replace all FileMaker operations
**Status:** Requirements Definition (Phase 1)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current FileMaker Operations](#current-filemaker-operations)
3. [Existing Backend Endpoints](#existing-backend-endpoints)
4. [Endpoint Requirements by Resource](#endpoint-requirements-by-resource)
5. [Special Operations](#special-operations)
6. [Authentication Requirements](#authentication-requirements)
7. [Response Format Requirements](#response-format-requirements)
8. [Migration Strategy](#migration-strategy)
9. [Backend Change Requests](#backend-change-requests)

---

## Executive Summary

### Current State

The frontend currently routes data operations through FileMaker via two mechanisms:
1. **FileMaker Bridge** (`src/api/fileMaker.js`) - Direct fm-gofer/window.FileMaker calls
2. **Backend Proxy** (`/filemaker/{layout}/records`) - Backend API proxying to FileMaker

### Target State

All operations must route directly to backend API endpoints that:
- Access Supabase database directly (no FileMaker intermediary)
- Use existing table schema verified in `.roo/rules/SUPABASE_DATABASE_VERIFICATION.md`
- Maintain consistent REST API patterns
- Preserve authentication via HMAC-SHA256

### Gap Analysis

**Endpoints Already Available:**
- ✅ `/filemaker/{layout}/records` (GET, POST)
- ✅ `/filemaker/{layout}/records/{record_id}` (GET, PATCH, DELETE)
- ✅ `/filemaker/{layout}/_find` (POST)

**Status:** These endpoints currently **proxy to FileMaker**. They need to be updated to access Supabase directly.

---

## Current FileMaker Operations

### Operation Types (from src/api/fileMaker.js:428-435)

```javascript
export const Actions = {
    READ: 'read',        // Query/fetch records
    CREATE: 'create',    // Create new records
    UPDATE: 'update',    // Update existing records
    DELETE: 'delete',    // Delete records
    METADATA: 'metaData',// Get schema info
    DUPLICATE: 'duplicate' // Copy records
};
```

### FileMaker Layouts (from src/api/fileMaker.js:411-423)

```javascript
export const Layouts = {
    CUSTOMERS: 'devCustomers',
    PROJECTS: 'devProjects',
    TASKS: 'devTasks',
    RECORDS: 'dapiRecords',        // Financial/time records
    NOTES: 'devNotes',
    LINKS: 'devLinks',
    IMAGES: 'devImages',
    PROJECT_IMAGES: 'devProjectImages',
    PROJECT_LINKS: 'devProjectLinks',
    PROJECT_OBJECTIVES: 'devProjectObjectives',
    PROJECT_OBJ_STEPS: 'devProjectObjSteps'
};
```

### Usage Statistics (from inventory.md)

- **Customers API:** 7 fetchDataFromFileMaker calls (src/api/customers.js)
- **Projects API:** 9 fetchDataFromFileMaker calls (src/api/projects.js)
- **Tasks API:** 14 fetchDataFromFileMaker calls (src/api/tasks.js)
- **Teams API:** 15 fetchDataFromFileMaker calls (src/api/teams.js)
- **Financial Records API:** 10 fetchDataFromFileMaker calls (src/api/financialRecords.js)
- **Notes API:** 1 call (src/api/notes.js)
- **Links API:** 1 call (src/api/links.js)
- **Customer Activity API:** 2 calls (src/api/customerActivity.js)
- **Prospects API:** 1 dynamic import call (src/api/prospects.js)

**Total:** 60+ FileMaker operations across 9 API modules

---

## Existing Backend Endpoints

### FileMaker Proxy Endpoints (Need Conversion)

Based on OpenAPI spec at `https://api.claritybusinesssolutions.ca/openapi.json`:

#### 1. List/Query Records
```
GET /filemaker/{layout}/records
Query parameters: limit, offset, sort
Response: Array of records
```

**Current behavior:** Proxies to FileMaker Data API
**Required change:** Query Supabase tables directly

#### 2. Get Single Record
```
GET /filemaker/{layout}/records/{record_id}
Response: Single record with fieldData
```

**Current behavior:** Proxies to FileMaker Data API
**Required change:** Query Supabase by recordId or __ID

#### 3. Create Record
```
POST /filemaker/{layout}/records
Body: { fields: { field1: value1, ... } }
Response: { record_id, data }
```

**Current behavior:** Creates in FileMaker
**Required change:** Insert into Supabase table

#### 4. Update Record
```
PATCH /filemaker/{layout}/records/{record_id}
Body: { fields: { field1: value1, ... } }
Response: Updated record
```

**Current behavior:** Updates FileMaker record
**Required change:** Update Supabase row

#### 5. Delete Record
```
DELETE /filemaker/{layout}/records/{record_id}
Response: Success status
```

**Current behavior:** Deletes from FileMaker
**Required change:** Delete from Supabase

#### 6. Find Records (Query)
```
POST /filemaker/{layout}/_find
Body: { query: [{ field1: value1 }, ...] }
Response: Matching records
```

**Current behavior:** FileMaker find request
**Required change:** Supabase query with WHERE clauses

### Supabase Direct Endpoints (Already Available)

```
GET/POST/PATCH/DELETE /supabase/{table}/select
GET/POST/PATCH/DELETE /supabase/{table}/insert
GET/POST/PATCH/DELETE /supabase/{table}/update
GET/POST/PATCH/DELETE /supabase/{table}/delete
POST /supabase/rpc
GET /supabase/tables/discovery
```

**Note:** These endpoints exist but frontend uses FileMaker proxy instead.

---

## Endpoint Requirements by Resource

### 1. Customers (devCustomers → customers table)

**Supabase Table:** `customers`
**Frontend API:** `src/api/customers.js`

#### Required Operations

**List All Customers**
```
Current: GET /filemaker/devCustomers/records?query=[{"__ID":"*"}]
Target:  GET /filemaker/devCustomers/records
         or GET /customers
Backend: SELECT * FROM customers WHERE deleted_at IS NULL
```

**Get Customer by ID**
```
Current: GET /filemaker/devCustomers/records?query=[{"__ID":"customer_id"}]
Target:  GET /filemaker/devCustomers/records/{customer_id}
         or GET /customers/{customer_id}
Backend: SELECT * FROM customers WHERE id = $1 OR __ID = $1
```

**Create Customer**
```
Current: POST /filemaker/devCustomers/records
         Body: { fields: { name, email, ... } }
Target:  Same endpoint, new implementation
Backend: INSERT INTO customers (...) RETURNING *
```

**Update Customer**
```
Current: PATCH /filemaker/devCustomers/records/{record_id}
         Body: { fields: { name, email, ... } }
Target:  Same endpoint, new implementation
Backend: UPDATE customers SET ... WHERE record_id = $1 RETURNING *
```

**Delete Customer**
```
Current: DELETE /filemaker/devCustomers/records/{record_id}
Target:  Same endpoint, new implementation
Backend: UPDATE customers SET deleted_at = NOW() WHERE record_id = $1
         (soft delete preferred)
```

**Get Active Customers**
```
Current: GET /filemaker/devCustomers/records?query=[{"f_active":"1"}]
Target:  Same endpoint with query param
Backend: SELECT * FROM customers WHERE f_active = true AND deleted_at IS NULL
```

**Toggle Customer Status**
```
Current: PATCH /filemaker/devCustomers/records/{record_id}
         Body: { fields: { f_active: "1" } }
Target:  Same endpoint
Backend: UPDATE customers SET f_active = $1 WHERE record_id = $2
```

**Reference:** `src/api/customers.js:1-135`

---

### 2. Projects (devProjects → projects table)

**Supabase Table:** `projects`
**Frontend API:** `src/api/projects.js`

#### Required Operations

**List Projects for Customer**
```
Current: GET /filemaker/devProjects/records?query=[{"_custID":"customer_id"}]
Target:  GET /filemaker/devProjects/records?query=[{"_custID":"customer_id"}]
         or GET /projects?customer_id={customer_id}
Backend: SELECT * FROM projects WHERE customer_id = $1
```

**Get Project by ID**
```
Current: GET /filemaker/devProjects/records?query=[{"__ID":"project_id"}]
Target:  GET /filemaker/devProjects/records/{project_id}
Backend: SELECT * FROM projects WHERE id = $1 OR __ID = $1
```

**Create Project**
```
Current: POST /filemaker/devProjects/records
         Body: { fields: { name, _custID, status, ... } }
Target:  Same endpoint
Backend: INSERT INTO projects (...) RETURNING *
```

**Update Project**
```
Current: PATCH /filemaker/devProjects/records/{record_id}
         Body: { fields: { ... } }
Target:  Same endpoint
Backend: UPDATE projects SET ... WHERE record_id = $1 RETURNING *
```

**Update Project Status**
```
Current: PATCH /filemaker/devProjects/records/{record_id}
         Body: { fields: { status: "new_status" } }
Target:  Same endpoint
Backend: UPDATE projects SET status = $1 WHERE record_id = $2
```

**Delete Project**
```
Current: DELETE /filemaker/devProjects/records/{record_id}
Target:  Same endpoint
Backend: DELETE FROM projects WHERE record_id = $1
         (or soft delete)
```

**Get Projects for Multiple Customers**
```
Current: GET /filemaker/devProjects/records
         Query: [{"_custID":"id1"}, {"_custID":"id2"}]
Target:  Same endpoint with OR query
Backend: SELECT * FROM projects WHERE customer_id IN ($1, $2, ...)
```

**Reference:** `src/api/projects.js:1-213`

---

### 3. Project Related Data

#### 3a. Project Notes (devNotes → notes table)

**Supabase Table:** `notes` (verified in SUPABASE_DATABASE_VERIFICATION.md)

**Get Notes for Project**
```
Current: GET /filemaker/devNotes/records?query=[{"_fkID":"project_id"}]
Target:  GET /filemaker/devNotes/records?query=[{"_fkID":"project_id"}]
Backend: SELECT * FROM notes WHERE foreign_key_id = $1
```

**Create Note**
```
Current: POST /filemaker/devNotes/records
         Body: { fields: { note, _fkID, type } }
Target:  Same endpoint
Backend: INSERT INTO notes (note, foreign_key_id, type) VALUES ($1, $2, $3)
```

**Reference:** `src/api/notes.js:1-24`, `src/api/projects.js:47-58`

#### 3b. Project Links (devLinks, devProjectLinks → links table)

**Supabase Table:** `links`

**Get Links for Project**
```
Current: GET /filemaker/devLinks/records?query=[{"_fkID":"project_id"}]
         or GET /filemaker/devProjectLinks/records?query=[{"_fkID":"project_id"}]
Target:  Same endpoints
Backend: SELECT * FROM links WHERE foreign_key_id = $1
```

**Create Link**
```
Current: POST /filemaker/devLinks/records
         Body: { fields: { link, _fkID } }
Target:  Same endpoint
Backend: INSERT INTO links (url, foreign_key_id) VALUES ($1, $2)
```

**Reference:** `src/api/links.js:1-30`, `src/api/projects.js:61-84`

#### 3c. Project Images (devImages, devProjectImages)

**Current Layout:** `devImages`, `devProjectImages`
**Supabase Table:** Not verified - needs investigation

**Get Images for Project**
```
Current: GET /filemaker/devProjectImages/records?query=[{"_fkID":"project_id"}]
Target:  Needs backend table verification
Backend: TBD - may need new table creation
```

**Reference:** `src/api/projects.js:152-163`

#### 3d. Project Objectives (devProjectObjectives)

**Current Layout:** `devProjectObjectives`
**Supabase Table:** Not clearly identified - needs investigation

**Get Objectives for Project**
```
Current: GET /filemaker/devProjectObjectives/records?query=[{"_projectID":"project_id"}]
Target:  Needs backend table verification
Backend: TBD
```

**Create Objective**
```
Current: POST /filemaker/devProjectObjectives/records
         Body: { fields: { ... } }
Target:  Needs backend table verification
Backend: TBD
```

**Reference:** `src/api/projects.js:152-163`, `src/api/projects.js:201-212`

#### 3e. Project Objective Steps (devProjectObjSteps)

**Current Layout:** `devProjectObjSteps`
**Supabase Table:** Not clearly identified - needs investigation

**Get Steps for Project**
```
Current: GET /filemaker/devProjectObjSteps/records?query=[{"_projectID":"project_id"}]
Target:  Needs backend table verification
Backend: TBD
```

**Reference:** `src/api/projects.js:152-163`

---

### 4. Tasks (devTasks → tasks table)

**Supabase Table:** `tasks`
**Frontend API:** `src/api/tasks.js`

#### Required Operations

**List Tasks for Project**
```
Current: GET /filemaker/devTasks/records?query=[{"_projectID":"project_id"}]
Target:  GET /filemaker/devTasks/records?query=[{"_projectID":"project_id"}]
Backend: SELECT * FROM tasks WHERE project_id = $1
```

**Custom Query Tasks**
```
Current: GET /filemaker/devTasks/records?query={custom}
Target:  Same endpoint with flexible query
Backend: Dynamic WHERE clause based on query params
```

**Get Active Tasks**
```
Current: GET /filemaker/devTasks/records
         Query: [{"_projectID":"id", "f_completed":false}]
Target:  Same endpoint
Backend: SELECT * FROM tasks
         WHERE project_id = $1 AND completed = false
```

**Create Task**
```
Current: POST /filemaker/devTasks/records
         Body: { fields: { name, _projectID, _staffID, ... } }
Target:  Same endpoint
Backend: INSERT INTO tasks (...) RETURNING *
```

**Update Task**
```
Current: PATCH /filemaker/devTasks/records/{record_id}
         Body: { fields: { ... } }
Target:  Same endpoint
Backend: UPDATE tasks SET ... WHERE record_id = $1 RETURNING *
```

**Update Task Status (Completion)**
```
Current: PATCH /filemaker/devTasks/records/{record_id}
         Body: { fields: { f_completed: 1 } }
Target:  Same endpoint
Backend: UPDATE tasks SET completed = $1 WHERE record_id = $2
```

**Update Task Notes**
```
Current: PATCH /filemaker/devTasks/records/{record_id}
         Body: { fields: { notes: "text" } }
Target:  Same endpoint
Backend: UPDATE tasks SET notes = $1 WHERE record_id = $2
```

**Get Task Notes (via Notes table)**
```
Current: GET /filemaker/devNotes/records?query=[{"_fkID":"task_id"}]
Target:  Same endpoint
Backend: SELECT * FROM notes WHERE foreign_key_id = $1
```

**Get Task Links (via Links table)**
```
Current: GET /filemaker/devLinks/records?query=[{"_fkID":"task_id"}]
Target:  Same endpoint
Backend: SELECT * FROM links WHERE foreign_key_id = $1
```

**Reference:** `src/api/tasks.js:1-317`

---

### 5. Financial Records / Time Tracking (dapiRecords → records table)

**Supabase Table:** `customer_sales` or similar (needs verification)
**Frontend API:** `src/api/financialRecords.js`
**Alternative Table:** May be `time_entries` or `financial_records`

#### Required Operations

**Create Timer/Time Entry**
```
Current: POST /filemaker/dapiRecords/records
         Body: { fields: {
           _taskID, _staffID, _projectID, _custID,
           TimeStart, DateStart
         }}
Target:  Same endpoint or new /time-entries endpoint
Backend: INSERT INTO time_entries (...) RETURNING *
```

**Stop Timer (Update End Time)**
```
Current: PATCH /filemaker/dapiRecords/records/{record_id}
         Body: { fields: {
           TimeEnd, "Work Performed", TimeAdjust
         }}
Target:  Same endpoint
Backend: UPDATE time_entries
         SET time_end = $1, description = $2, adjustment = $3
         WHERE record_id = $4
```

**Get Records for Task**
```
Current: GET /filemaker/dapiRecords/records?query=[{"_taskID":"task_id"}]
Target:  Same endpoint
Backend: SELECT * FROM time_entries WHERE task_id = $1
```

**Get Records for Project**
```
Current: GET /filemaker/dapiRecords/records?query=[{"_projectID":"project_id"}]
Target:  Same endpoint
Backend: SELECT * FROM time_entries WHERE project_id = $1
```

**Get Records by Timeframe**
```
Current: GET /filemaker/dapiRecords/records
         Query varies by timeframe:
         - Today: [{"DateStart":"MM/DD/YYYY"}]
         - This Week: [{"weekNo":"N", "year":"YYYY"}]
         - This Month: [{"month":"M", "year":"YYYY"}]
         - Unpaid: [{"f_billed":"0"}]
Target:  Same endpoint with date/time parameters
Backend: SELECT * FROM time_entries WHERE
         - date_start = $1 (today)
         - EXTRACT(WEEK FROM date_start) = $1 AND EXTRACT(YEAR FROM date_start) = $2
         - EXTRACT(MONTH FROM date_start) = $1 AND EXTRACT(YEAR FROM date_start) = $2
         - billed = false (unpaid)
```

**Get Records by Date Range**
```
Current: GET /filemaker/dapiRecords/records
         Query: [{"DateStart":"MM/DD/YYYY...MM/DD/YYYY"}]
Target:  Same endpoint
Backend: SELECT * FROM time_entries
         WHERE date_start BETWEEN $1 AND $2
```

**Get Record by RecordId**
```
Current: GET /filemaker/dapiRecords/records?query=[{"~recordId":"id"}]
Target:  GET /filemaker/dapiRecords/records/{record_id}
Backend: SELECT * FROM time_entries WHERE record_id = $1
```

**Get Record by UUID**
```
Current: GET /filemaker/dapiRecords/records?query=[{"__ID":"uuid"}]
Target:  Same endpoint
Backend: SELECT * FROM time_entries WHERE __ID = $1 OR id = $1
```

**Update Billed Status (Single)**
```
Current: PATCH /filemaker/dapiRecords/records/{record_id}
         Body: { fields: { f_billed: 1 } }
Target:  Same endpoint
Backend: UPDATE time_entries SET billed = $1 WHERE record_id = $2
```

**Update Billed Status (Bulk)**
```
Current: Multiple PATCH calls in batches of 10
Target:  Same pattern or new bulk endpoint
         PATCH /filemaker/dapiRecords/records/bulk-update
Backend: UPDATE time_entries SET billed = $1
         WHERE record_id = ANY($2::uuid[])
```

**Get Quarter Records (Last 3 Months + Previous Year)**
```
Current: Multiple month queries combined
Target:  Same endpoint with complex date logic
Backend: SELECT * FROM time_entries WHERE
         (EXTRACT(MONTH FROM date_start), EXTRACT(YEAR FROM date_start))
         IN (($1,$2), ($3,$4), ...)
```

**Get Year Records (Current + Previous Year)**
```
Current: 24 month queries (12 current + 12 previous)
Target:  Same endpoint
Backend: SELECT * FROM time_entries WHERE
         EXTRACT(YEAR FROM date_start) IN ($1, $2)
```

**Reference:** `src/api/financialRecords.js:1-497`, `src/api/tasks.js:120-232`

---

### 6. Teams (devTeams, devTeamMembers, devStaff → teams, team_members, staff)

**Supabase Tables:** `teams`, `team_members`, `staff`
**Frontend API:** `src/api/teams.js`

#### Required Operations

**List All Teams**
```
Current: GET /filemaker/devTeams/records?query=[{"__ID":"*"}]
Target:  GET /filemaker/devTeams/records
Backend: SELECT * FROM teams
```

**Get Team by ID**
```
Current: GET /filemaker/devTeams/records?query=[{"__ID":"team_id"}]
Target:  GET /filemaker/devTeams/records/{team_id}
Backend: SELECT * FROM teams WHERE id = $1 OR __ID = $1
```

**Create Team**
```
Current: POST /filemaker/devTeams/records
         Body: { fields: { name, ... } }
Target:  Same endpoint
Backend: INSERT INTO teams (...) RETURNING *
```

**Update Team**
```
Current: PATCH /filemaker/devTeams/records/{record_id}
         Body: { fields: { ... } }
Target:  Same endpoint
Backend: UPDATE teams SET ... WHERE record_id = $1 RETURNING *
```

**Delete Team**
```
Current: DELETE /filemaker/devTeams/records/{record_id}
Target:  Same endpoint
Backend: DELETE FROM teams WHERE record_id = $1
```

**Get Team Members**
```
Current: GET /filemaker/devTeamMembers/records?query=[{"_teamID":"team_id"}]
Target:  Same endpoint
Backend: SELECT * FROM team_members WHERE team_id = $1
```

**Get Staff for Team (Multi-step)**
```
Current: 1. GET team_members by team_id
         2. Extract staff IDs
         3. GET /filemaker/devStaff/records with OR query
Target:  Same multi-step or new joined endpoint
Backend: SELECT tm.*, s.* FROM team_members tm
         JOIN staff s ON tm.staff_id = s.id
         WHERE tm.team_id = $1
```

**Assign Staff to Team**
```
Current: POST /filemaker/devTeamMembers/records
         Body: { fields: { _teamID, _staffID, role, name } }
Target:  Same endpoint
Backend: INSERT INTO team_members
         (team_id, staff_id, role, name) VALUES ($1,$2,$3,$4)
```

**Remove Staff from Team**
```
Current: DELETE /filemaker/devTeamMembers/records/{record_id}
Target:  Same endpoint
Backend: DELETE FROM team_members WHERE record_id = $1
```

**Get Team Projects**
```
Current: GET /filemaker/devProjects/records?query=[{"_teamID":"team_id"}]
Target:  Same endpoint
Backend: SELECT * FROM projects WHERE team_id = $1
```

**Assign Project to Team**
```
Current: PATCH /filemaker/devProjects/records/{record_id}
         Body: { fields: { _teamID: "team_id" } }
Target:  Same endpoint
Backend: UPDATE projects SET team_id = $1 WHERE record_id = $2
```

**Remove Project from Team**
```
Current: PATCH /filemaker/devProjects/records/{record_id}
         Body: { fields: { _teamID: "" } }
Target:  Same endpoint
Backend: UPDATE projects SET team_id = NULL WHERE record_id = $1
```

**Get All Staff**
```
Current: GET /filemaker/devStaff/records?query=[{"__ID":"*"}]
Target:  GET /filemaker/devStaff/records
Backend: SELECT * FROM staff
```

**Reference:** `src/api/teams.js:1-307`

---

### 7. Customer Activity (Not in standard layouts)

**Frontend API:** `src/api/customerActivity.js`
**Operations:** 2 fetchDataFromFileMaker calls (needs investigation)

**Reference:** `src/api/customerActivity.js:1-271`

---

## Special Operations

### 1. QuickBooks Integration

**Current Implementation:**
```javascript
// src/api/fileMaker.js:447-500
export async function initializeQuickBooks(params) {
  // Calls FileMaker script: "Initialize QB via JS"
  FileMaker.PerformScript("Initialize QB via JS", payload);
}
```

**Required Change:**
- **Option A:** Direct backend endpoint
  ```
  POST /quickbooks/sync-time-entries
  Body: { customerId, recordsByProject }
  ```
- **Option B:** Existing QB endpoints
  ```
  Existing: POST /quickbooks/invoices
  May need adaptation for time entry billing
  ```

**Status:** Requires backend team coordination

**Reference:** `src/api/fileMaker.js:447-500`

---

### 2. Mailjet Configuration Fetching

**Current Implementation:**
```javascript
// src/services/mailjetService.js:25
const configJson = await FMGofer.PerformScript('JS * Fetch Data', payload);
```

**Required Change:**
- Configuration should come from environment variables or backend config endpoint
- **Option A:** Environment variables (preferred)
  ```
  VITE_MAILJET_API_KEY
  VITE_MAILJET_SECRET_KEY
  ```
- **Option B:** Backend config endpoint
  ```
  GET /config/mailjet
  ```

**Status:** Environment variables already exist in `.env`

**Reference:** `src/services/mailjetService.js:6-178`

---

### 3. User Context Loading

**Current Implementation:**
```javascript
// src/services/initializationService.js:37
const userContext = await fetchDataFromFileMaker({
  layout: 'devCustomers',
  action: 'read',
  callBackName: 'returnContext'
});
```

**Required Change:**
- Replace with Supabase user session
- **Option A:** Supabase auth user metadata
  ```javascript
  const { data: { user } } = await supabase.auth.getUser();
  ```
- **Option B:** Backend user context endpoint
  ```
  GET /users/me
  ```

**Status:** Should use Supabase authentication context

**Reference:** `src/services/initializationService.js:1-37`

---

### 4. Prospect to Customer Conversion

**Current Implementation:**
```javascript
// src/api/prospects.js:473-477
const { fetchDataFromFileMaker, Layouts, Actions } = await import('./fileMaker.js')
const fileMakerResponse = await fetchDataFromFileMaker({
  layout: Layouts.CUSTOMERS,
  action: Actions.CREATE,
  fieldData: fileMakerData
});
```

**Required Change:**
- Use customer creation endpoint directly
- **Target:**
  ```
  POST /filemaker/devCustomers/records
  or POST /customers
  Body: { fields: { ...prospectData } }
  ```

**Status:** Standard customer creation operation

**Reference:** `src/api/prospects.js:473-477`

---

## Authentication Requirements

### Current HMAC-SHA256 Implementation

All backend requests currently use HMAC authentication:

```javascript
// src/api/fileMaker.js:43-86
export async function generateBackendAuthHeader(payload = '') {
  const secretKey = import.meta.env.VITE_SECRET_KEY;
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${timestamp}.${payload}`;

  // Web Crypto API HMAC-SHA256
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return `Bearer ${signatureHex}.${timestamp}`;
}
```

### Requirements

✅ **Keep existing authentication** - HMAC-SHA256 is already implemented
✅ **No changes needed** - Backend endpoints already support this
✅ **Format:** `Authorization: Bearer {signature}.{timestamp}`

**Reference:** Backend API documentation confirms HMAC auth for all endpoints except webhooks

---

## Response Format Requirements

### Current FileMaker Response Format

```javascript
// CREATE operation
{
  response: {
    recordId: "uuid",
    data: { ...fieldData },
    dataInfo: { /* metadata */ }
  },
  messages: [{ code: "0", message: "OK" }]
}

// READ operation
{
  response: {
    data: [ /* array of records */ ],
    dataInfo: { count, totalCount },
    messages: [{ code: "0", message: "OK" }]
  }
}
```

### Required Backend Response Format

**Option A: Maintain FileMaker-compatible format**
- Easier frontend migration
- Less code changes required
- Backend wraps Supabase responses

**Option B: Use standard REST format**
- More idiomatic REST API
- Requires frontend response handling updates
- Cleaner API design

**Recommendation:** Option A for initial migration, transition to Option B later

### Standard REST Format (Target)

```javascript
// GET /resources/{id}
{
  id: "uuid",
  field1: "value1",
  ...
}

// GET /resources
{
  data: [ /* array */ ],
  count: 10,
  total: 100
}

// POST /resources
{
  id: "new-uuid",
  field1: "value1",
  ...
}
```

---

## Migration Strategy

### Phase 1: Backend Endpoint Updates (Backend Team)

1. **Update FileMaker proxy endpoints to query Supabase**
   - `/filemaker/{layout}/records` → Direct Supabase queries
   - Map FileMaker layout names to Supabase table names
   - Preserve query format compatibility

2. **Verify table mappings**
   - `devCustomers` → `customers`
   - `devProjects` → `projects`
   - `devTasks` → `tasks`
   - `dapiRecords` → `time_entries` or `customer_sales`
   - `devTeams` → `teams`
   - `devTeamMembers` → `team_members`
   - `devStaff` → `staff`
   - `devNotes` → `notes`
   - `devLinks` → `links`
   - `devImages` → TBD
   - `devProjectImages` → TBD
   - `devProjectObjectives` → TBD
   - `devProjectObjSteps` → TBD

3. **Test endpoints with existing frontend calls**

### Phase 2: Frontend Migration (Frontend Team)

1. **No changes needed initially** - Endpoints remain the same
2. **Test all operations** against updated backend
3. **Remove FileMaker bridge code** once verified
4. **Transition to direct Supabase calls** in Phase 3

### Phase 3: Optimization (Both Teams)

1. **Introduce REST endpoints** (`/customers`, `/projects`, etc.)
2. **Update frontend** to use new endpoints
3. **Deprecate FileMaker-style endpoints**
4. **Remove compatibility layer**

---

## Backend Change Requests

### BCR-001: Update FileMaker Proxy to Supabase

**Priority:** Critical
**Impact:** All data operations
**Complexity:** High

#### Requirements

1. **Update existing endpoints** to query Supabase instead of FileMaker:
   - `GET /filemaker/{layout}/records`
   - `GET /filemaker/{layout}/records/{record_id}`
   - `POST /filemaker/{layout}/records`
   - `PATCH /filemaker/{layout}/records/{record_id}`
   - `DELETE /filemaker/{layout}/records/{record_id}`
   - `POST /filemaker/{layout}/_find`

2. **Implement layout-to-table mapping:**
   ```python
   LAYOUT_TABLE_MAP = {
       'devCustomers': 'customers',
       'devProjects': 'projects',
       'devTasks': 'tasks',
       'dapiRecords': 'time_entries',  # or customer_sales
       'devTeams': 'teams',
       'devTeamMembers': 'team_members',
       'devStaff': 'staff',
       'devNotes': 'notes',
       'devLinks': 'links',
       # TBD: devImages, devProjectImages, devProjectObjectives, devProjectObjSteps
   }
   ```

3. **Preserve query format compatibility:**
   - FileMaker query format: `[{"field":"value"}, ...]`
   - Convert to Supabase WHERE clauses with OR logic
   - Support special operators: `*` (all), `...` (range)

4. **Maintain response format:**
   - Wrap Supabase responses in FileMaker-compatible format
   - Include recordId, data, dataInfo, messages

5. **Error handling:**
   - Map Supabase errors to FileMaker error codes
   - Preserve error detail for debugging

#### Testing Requirements

- Unit tests for each layout mapping
- Integration tests for CRUD operations
- Query format conversion tests
- Response format validation tests
- Error handling tests

#### Rollback Plan

- Keep FileMaker proxy code as fallback
- Feature flag to switch between FileMaker and Supabase
- Gradual rollout per layout

#### Dependencies

- Supabase table schema must match FileMaker field names
- Field name mapping may be needed (e.g., `_custID` → `customer_id`)

---

### BCR-002: Clarify Financial Records Table

**Priority:** High
**Impact:** Time tracking, billing operations
**Complexity:** Medium

#### Requirements

1. **Identify correct Supabase table** for `dapiRecords` layout:
   - Is it `time_entries`?
   - Is it `customer_sales`?
   - Is it `financial_records`?
   - Document schema and field mappings

2. **Verify required fields:**
   - `_taskID` → `task_id`?
   - `_staffID` → `staff_id`?
   - `_projectID` → `project_id`?
   - `_custID` → `customer_id`?
   - `TimeStart`, `TimeEnd`, `DateStart`
   - `Work Performed` → `description`?
   - `TimeAdjust` → `adjustment`?
   - `f_billed` → `billed`?
   - Month/week/year fields for queries

3. **Document date/time query patterns:**
   - Today: by DateStart
   - This week: by weekNo + year
   - This month: by month + year
   - Date range: between dates
   - Unpaid: by f_billed = false

---

### BCR-003: Verify Project Related Tables

**Priority:** Medium
**Impact:** Project details functionality
**Complexity:** Low-Medium

#### Requirements

1. **Verify/create tables for:**
   - Images: `devImages`, `devProjectImages`
   - Objectives: `devProjectObjectives`
   - Objective Steps: `devProjectObjSteps`

2. **Document schema** if tables exist

3. **Create tables** if missing, with schema:
   ```sql
   CREATE TABLE project_images (
     id UUID PRIMARY KEY,
     project_id UUID REFERENCES projects(id),
     image_url TEXT,
     description TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE TABLE project_objectives (
     id UUID PRIMARY KEY,
     project_id UUID REFERENCES projects(id),
     objective TEXT,
     status TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE TABLE project_objective_steps (
     id UUID PRIMARY KEY,
     objective_id UUID REFERENCES project_objectives(id),
     step TEXT,
     completed BOOLEAN DEFAULT false,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

---

### BCR-004: QuickBooks Integration Update

**Priority:** Medium
**Impact:** Billing/invoicing operations
**Complexity:** Medium-High

#### Requirements

1. **Replace FileMaker script call** with direct backend endpoint:
   ```
   Current: FileMaker.PerformScript("Initialize QB via JS", payload)
   Target:  POST /quickbooks/sync-time-entries
   ```

2. **Endpoint specification:**
   ```
   POST /quickbooks/sync-time-entries
   Body: {
     customerId: "uuid",
     recordsByProject: {
       "project_id_1": ["record_id_1", "record_id_2"],
       "project_id_2": ["record_id_3"]
     }
   }
   Response: {
     success: boolean,
     invoice_ids: ["qb_invoice_1", ...],
     errors: []
   }
   ```

3. **Business logic:**
   - Fetch unbilled time entries for customer
   - Group by project
   - Create QB invoice per project
   - Mark entries as billed

4. **Error handling:**
   - Partial success handling
   - Rollback billed status on failure
   - Detailed error messages

---

### BCR-005: Bulk Update Optimization

**Priority:** Low
**Impact:** Performance for bulk operations
**Complexity:** Low

#### Requirements

1. **Create bulk update endpoint:**
   ```
   PATCH /filemaker/{layout}/records/bulk-update
   Body: {
     record_ids: ["id1", "id2", ...],
     fields: { field1: value1, ... }
   }
   Response: {
     success_count: 10,
     error_count: 0,
     errors: []
   }
   ```

2. **Use case:**
   - Bulk marking time entries as billed
   - Currently done with 10-record batches (src/api/financialRecords.js:398-455)

3. **Benefits:**
   - Reduce network overhead
   - Improve performance
   - Simpler error handling

---

## Summary

### Endpoint Status

| Resource | Layout | Supabase Table | Status | BCR |
|----------|--------|----------------|--------|-----|
| Customers | devCustomers | customers | ✅ Verified | BCR-001 |
| Projects | devProjects | projects | ✅ Verified | BCR-001 |
| Tasks | devTasks | tasks | ✅ Verified | BCR-001 |
| Time Records | dapiRecords | time_entries? | ⚠️ Needs clarification | BCR-002 |
| Teams | devTeams | teams | ✅ Verified | BCR-001 |
| Team Members | devTeamMembers | team_members | ✅ Verified | BCR-001 |
| Staff | devStaff | staff | ✅ Verified | BCR-001 |
| Notes | devNotes | notes | ✅ Verified | BCR-001 |
| Links | devLinks | links | ✅ Verified | BCR-001 |
| Images | devImages | ? | ❌ Not verified | BCR-003 |
| Project Images | devProjectImages | ? | ❌ Not verified | BCR-003 |
| Project Objectives | devProjectObjectives | ? | ❌ Not verified | BCR-003 |
| Objective Steps | devProjectObjSteps | ? | ❌ Not verified | BCR-003 |

### Critical Questions for Backend Team

1. **What is the correct table for `dapiRecords`?** (time_entries vs customer_sales vs financial_records)
2. **Do project_images, project_objectives, project_objective_steps tables exist?**
3. **What are the field name mappings?** (e.g., `_custID` → `customer_id`)
4. **Should we maintain FileMaker-compatible response format initially?**
5. **Is there a feature flag mechanism for gradual rollout?**

### Frontend Work (Post-Backend Updates)

1. ✅ No immediate changes needed - endpoints stay the same
2. 🔄 Test all operations against updated backend
3. 🔄 Remove FileMaker bridge code (Phase 2)
4. 🔄 Migrate to REST endpoints (Phase 3)

---

**Document Status:** Complete - Ready for Backend Team Review
**Next Steps:**
1. Backend team reviews BCR-001 through BCR-005
2. Backend team answers critical questions
3. Backend team implements Supabase direct access
4. Frontend team tests updated endpoints
5. Frontend team proceeds with FileMaker code removal

**References:**
- OpenAPI Spec: https://api.claritybusinesssolutions.ca/openapi.json
- Supabase Tables: `.roo/rules/SUPABASE_DATABASE_VERIFICATION.md`
- FileMaker Operations: `src/api/fileMaker.js`
- Usage Inventory: `requirements/platform-filemaker-removal/inventory.md`
