# FileMaker devRecords to Supabase Schema Mapping

**Version:** 1.0
**Date:** 2026-01-10
**Status:** Documented - Supabase table does not exist yet

## Executive Summary

This document maps the FileMaker `devRecords` layout fields to a proposed Supabase schema. The `devRecords` layout stores timer/financial records for billable hours tracking.

**Key Findings:**
- ✅ FileMaker `devRecords` layout is well-documented in codebase
- ❌ Supabase `time_entries` table does NOT exist
- ⚠️ No timer-related tables exist in Supabase currently
- 📋 Backend change request will be required to create schema

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [FileMaker devRecords Field Structure](#filemaker-devrecords-field-structure)
3. [Proposed Supabase Schema](#proposed-supabase-schema)
4. [Field Mapping Table](#field-mapping-table)
5. [Related Fields (FileMaker Relationships)](#related-fields-filemaker-relationships)
6. [Code References](#code-references)
7. [Migration Considerations](#migration-considerations)
8. [Next Steps](#next-steps)

---

## Current State Analysis

### Supabase Table Status

**Verification Query:**
```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'time_entries');\""
```

**Result:** `f` (false) - Table does not exist

**Search for Related Tables:**
```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND (tablename LIKE '%time%' OR tablename LIKE '%timer%' OR tablename LIKE '%record%') ORDER BY tablename;\""
```

**Result:** 0 rows - No timer or time-entry related tables exist

### Current Implementation

The timer system is **FileMaker-only** with no Supabase integration:

- **Primary Storage:** FileMaker `devRecords` layout
- **Client State:** Browser localStorage for active timer state
- **API Layer:** `src/api/tasks.js` (FileMaker Data API)
- **Business Logic:** `src/services/taskService.js`
- **UI Components:** `src/components/tasks/TaskTimer.jsx`

### Documentation References

- **Timer Lifecycle:** `.devflow/tasks/tasks-migration-requirements/TIMER_LIFECYCLE_STATE_MACHINE.md`
- **Financial Records:** `.devflow/tasks/tasks-migration-requirements/FINANCIAL_RECORD_GENERATION.md`
- **Layouts Reference:** `docs/reference/layouts.md`

---

## FileMaker devRecords Field Structure

### Core Timer Fields

These fields are directly managed by the timer system:

| Field Name | Data Type | Purpose | Set By | Code Reference |
|------------|-----------|---------|--------|----------------|
| `__ID` | Text (UUID) | Unique record identifier | FileMaker (auto) | `src/api/tasks.js:121-178` |
| `~recordId` | Text | FileMaker internal record ID | FileMaker (auto) | Used for updates |
| `_taskID` | Text (UUID) | Foreign key to tasks | Timer start | `src/api/tasks.js:159` |
| `_staffID` | Text (UUID) | Foreign key to staff | Timer start | `src/api/tasks.js:160` |
| `_projectID` | Text (UUID) | Foreign key to projects | Timer start | `src/api/tasks.js:161` |
| `_custID` | Text (UUID) | Foreign key to customers | Timer start (looked up) | `src/api/tasks.js:162` |
| `TimeStart` | Time | Start time (HH:MM:SS) | Timer start | `src/api/tasks.js:163-168` |
| `TimeEnd` | Time | End time (HH:MM:SS) | Timer stop | `src/api/tasks.js:198-203` |
| `DateStart` | Date | Start date (MM/DD/YYYY) | Timer start | `src/api/tasks.js:169-173` |
| `TimeAdjust` | Number | Total adjustment in seconds | Timer stop | `src/api/tasks.js:205` |
| `Work Performed` | Text | Description of work | Timer stop | `src/api/tasks.js:204` |

### Calculated/Related Fields

These fields are calculated by FileMaker or come from related tables:

| Field Name | Data Type | Source | Purpose | Code Reference |
|------------|-----------|--------|---------|----------------|
| `Billable_Time_Rounded` | Number (hours) | FileMaker calculation | Calculated billable hours | `src/services/billableHoursService.js:84` |
| `Hourly_Rate` | Number (currency) | Record field or related | Rate for billing | `src/services/billableHoursService.js:37` |
| `f_billed` | Number (0/1) | Record field | Billing status flag | `src/services/billableHoursService.js:89` |
| `month` | Number | FileMaker calculation | Month extracted from DateStart | `src/services/billableHoursService.js:87` |
| `year` | Number | FileMaker calculation | Year extracted from DateStart | `src/services/billableHoursService.js:88` |
| `~creationTimestamp` | Timestamp | FileMaker (auto) | Record creation timestamp | `src/services/billableHoursService.js:94` |
| `~modificationTimestamp` | Timestamp | FileMaker (auto) | Last modification timestamp | `src/services/billableHoursService.js:95` |

### Related Fields (from other layouts)

| Field Name | Source Layout | Purpose | Code Reference |
|------------|---------------|---------|----------------|
| `Customers::Name` | devCustomers | Customer business name | `src/services/billableHoursService.js:80` |
| `Customers::chargeRate` | devCustomers | Default customer hourly rate | `src/services/billableHoursService.js:37` |
| `customers_Projects::projectName` | devProjects | Project name | `src/services/billableHoursService.js:38` |
| `customers_Projects::Name` | devProjects | Alternative project name field | `src/services/billableHoursService.js:38` |
| `customers_Projects::f_fixedPrice` | devProjects | Fixed-price project flag | `src/services/billableHoursService.js:93` |
| `Tasks::task` | devTasks | Task name/title | `src/services/billableHoursService.js:56` |
| `dapiTasks::task` | devTasks (API layout) | Alternative task name field | `src/services/billableHoursService.js:57` |

### Field Data Format Examples

**Timer Start Record Creation:**
```javascript
{
  fieldData: {
    _taskID: "uuid-v4-string",
    _staffID: "uuid-v4-string",
    _projectID: "uuid-v4-string",
    _custID: "uuid-v4-string",  // Looked up from project
    TimeStart: "14:30:45",      // HH:MM:SS (24-hour)
    DateStart: "01/10/2026"     // MM/DD/YYYY
  }
}
```

**Timer Stop Record Update:**
```javascript
{
  fieldData: {
    TimeEnd: "17:15:30",                      // HH:MM:SS (24-hour)
    "Work Performed": "Implemented login feature",
    TimeAdjust: 360                           // Seconds (6 minutes)
  }
}
```

**Processed Financial Record:**
```javascript
{
  id: "uuid-v4-string",                       // __ID
  recordId: "filemaker-record-id",            // ~recordId
  customerId: "uuid-v4-string",               // _custID
  customerName: "Clarity Business Solutions", // Customers::Name
  projectId: "uuid-v4-string",                // _projectID
  projectName: "Website Redesign",            // customers_Projects::projectName
  amount: 375.00,                             // Calculated: hours * rate
  hours: 2.5,                                 // Billable_Time_Rounded
  rate: 150.00,                               // Hourly_Rate
  date: "01/10/2026",                         // DateStart
  month: 1,                                   // Extracted from DateStart
  year: 2026,                                 // Extracted from DateStart
  billed: false,                              // f_billed === 1
  description: "Implemented login feature",   // Work Performed
  taskName: "User Authentication",            // Tasks::task
  workPerformed: "Implemented login feature", // Work Performed
  fixedPrice: 0,                              // customers_Projects::f_fixedPrice
  createdAt: "2026-01-10T14:30:45Z",         // ~creationTimestamp
  modifiedAt: "2026-01-10T17:15:30Z"         // ~modificationTimestamp
}
```

---

## Proposed Supabase Schema

### Table Name: `time_entries`

**Design Rationale:**
- Follows Supabase/PostgreSQL naming conventions (snake_case)
- Separates timer state (ephemeral) from persisted time entries
- Aligns with existing Supabase tables (customers, projects, tasks)

### Schema Definition

```sql
CREATE TABLE time_entries (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign Keys
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Time Tracking Fields
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    date DATE NOT NULL,  -- Extracted from start_time for easy filtering

    -- Adjustment Fields
    time_adjust_seconds INTEGER DEFAULT 0,
    -- Total adjustment in seconds (includes pause time + manual adjustments)

    -- Calculated Billable Time
    billable_hours NUMERIC(10, 4),
    -- Calculated: (end_time - start_time - time_adjust_seconds) / 3600

    -- Billing Information
    hourly_rate NUMERIC(10, 2),
    total_amount NUMERIC(12, 2),
    -- Calculated: billable_hours * hourly_rate

    -- Status and Metadata
    work_performed TEXT,
    billed BOOLEAN DEFAULT FALSE,
    is_fixed_price_project BOOLEAN DEFAULT FALSE,
    -- Denormalized from projects.fixed_price for query performance

    -- FileMaker Sync
    filemaker_id UUID UNIQUE,
    -- Maps to FileMaker __ID field for dual-write synchronization
    filemaker_record_id TEXT,
    -- Maps to FileMaker ~recordId for reference

    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_time_range CHECK (
        end_time IS NULL OR end_time >= start_time
    ),
    CONSTRAINT valid_billable_hours CHECK (
        billable_hours IS NULL OR billable_hours >= 0
    ),
    CONSTRAINT valid_hourly_rate CHECK (
        hourly_rate IS NULL OR hourly_rate >= 0
    ),
    CONSTRAINT valid_adjustment CHECK (
        time_adjust_seconds >= 0
    )
);

-- Indexes for Performance
CREATE INDEX idx_time_entries_task_id ON time_entries(task_id);
CREATE INDEX idx_time_entries_staff_id ON time_entries(staff_id);
CREATE INDEX idx_time_entries_project_id ON time_entries(project_id);
CREATE INDEX idx_time_entries_customer_id ON time_entries(customer_id);
CREATE INDEX idx_time_entries_organization_id ON time_entries(organization_id);
CREATE INDEX idx_time_entries_date ON time_entries(date);
CREATE INDEX idx_time_entries_billed ON time_entries(billed) WHERE billed = FALSE;
CREATE INDEX idx_time_entries_filemaker_id ON time_entries(filemaker_id);

-- Unique constraint for FileMaker sync idempotency
CREATE UNIQUE INDEX time_entries_filemaker_id_key ON time_entries(filemaker_id)
    WHERE filemaker_id IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER update_time_entries_updated_at
    BEFORE UPDATE ON time_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### Row-Level Security (RLS) Policies

```sql
-- Enable RLS
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view time entries for their organization
CREATE POLICY time_entries_select_policy ON time_entries
    FOR SELECT
    USING (organization_id = auth.jwt() ->> 'organization_id');

-- Policy: Users can insert time entries for their organization
CREATE POLICY time_entries_insert_policy ON time_entries
    FOR INSERT
    WITH CHECK (organization_id = auth.jwt() ->> 'organization_id');

-- Policy: Users can update time entries for their organization
CREATE POLICY time_entries_update_policy ON time_entries
    FOR UPDATE
    USING (organization_id = auth.jwt() ->> 'organization_id')
    WITH CHECK (organization_id = auth.jwt() ->> 'organization_id');

-- Policy: Users can delete time entries for their organization
CREATE POLICY time_entries_delete_policy ON time_entries
    FOR DELETE
    USING (organization_id = auth.jwt() ->> 'organization_id');
```

---

## Field Mapping Table

### Direct Field Mappings

| FileMaker Field | Supabase Column | Data Type Conversion | Notes |
|-----------------|-----------------|----------------------|-------|
| `__ID` | `filemaker_id` | UUID → UUID | For dual-write sync |
| `~recordId` | `filemaker_record_id` | TEXT → TEXT | FileMaker internal ID |
| `_taskID` | `task_id` | UUID → UUID | Foreign key |
| `_staffID` | `staff_id` | UUID → UUID | Foreign key |
| `_projectID` | `project_id` | UUID → UUID | Foreign key |
| `_custID` | `customer_id` | UUID → UUID | Foreign key |
| `TimeStart` + `DateStart` | `start_time` | Time + Date → TIMESTAMPTZ | Combine into single timestamp |
| `TimeEnd` + `DateStart` | `end_time` | Time + Date → TIMESTAMPTZ | Combine into single timestamp |
| `DateStart` | `date` | Date → DATE | Extract date portion |
| `TimeAdjust` | `time_adjust_seconds` | Number → INTEGER | Seconds (pause + manual) |
| `Work Performed` | `work_performed` | Text → TEXT | Description |
| `Billable_Time_Rounded` | `billable_hours` | Number → NUMERIC(10,4) | Hours with 4 decimal precision |
| `Hourly_Rate` | `hourly_rate` | Number → NUMERIC(10,2) | Currency with 2 decimal precision |
| `f_billed` | `billed` | Number (0/1) → BOOLEAN | 1 = true, 0 = false |
| `~creationTimestamp` | `created_at` | Timestamp → TIMESTAMPTZ | Audit field |
| `~modificationTimestamp` | `updated_at` | Timestamp → TIMESTAMPTZ | Audit field |

### Calculated/Derived Fields

| Supabase Column | Calculation Logic | Source Data | Notes |
|-----------------|-------------------|-------------|-------|
| `billable_hours` | `(end_time - start_time - time_adjust_seconds) / 3600` | Timer fields | Hours as decimal |
| `total_amount` | `billable_hours * hourly_rate` | Calculated | Currency |
| `date` | `DATE(start_time)` | start_time | For filtering |
| `is_fixed_price_project` | Lookup from `projects.fixed_price` | projects table | Denormalized flag |
| `organization_id` | Lookup from project → customer → org | Related tables | Required for RLS |

### New Fields (Not in FileMaker)

| Supabase Column | Purpose | Default | Notes |
|-----------------|---------|---------|-------|
| `id` | Supabase primary key | `gen_random_uuid()` | Independent from FileMaker ID |
| `organization_id` | Multi-tenancy support | Required | For RLS policies |
| `is_fixed_price_project` | Denormalized project type | `false` | For performance |

### Deprecated FileMaker Fields

These FileMaker fields are NOT mapped to Supabase:

| FileMaker Field | Reason for Exclusion |
|-----------------|---------------------|
| `month` | Derived from `date` using `EXTRACT(MONTH FROM date)` |
| `year` | Derived from `date` using `EXTRACT(YEAR FROM date)` |
| Related fields (Customers::*, Tasks::*, etc.) | Accessed via foreign key joins |

---

## Related Fields (FileMaker Relationships)

These fields from related FileMaker layouts will be accessed via Supabase foreign key joins:

### Customer Fields (via `customer_id`)

```sql
-- Access customer data
SELECT
    te.id,
    c.business_name AS customer_name,
    c.charge_rate AS customer_default_rate
FROM time_entries te
JOIN customers c ON te.customer_id = c.id;
```

**FileMaker Equivalent:**
- `Customers::Name` → `customers.business_name`
- `Customers::chargeRate` → `customers.charge_rate`

### Project Fields (via `project_id`)

```sql
-- Access project data
SELECT
    te.id,
    p.name AS project_name,
    p.fixed_price
FROM time_entries te
JOIN projects p ON te.project_id = p.id;
```

**FileMaker Equivalent:**
- `customers_Projects::projectName` → `projects.name`
- `customers_Projects::f_fixedPrice` → `projects.fixed_price`

### Task Fields (via `task_id`)

```sql
-- Access task data
SELECT
    te.id,
    t.title AS task_name,
    t.description AS task_description
FROM time_entries te
JOIN tasks t ON te.task_id = t.id;
```

**FileMaker Equivalent:**
- `Tasks::task` → `tasks.title`
- `dapiTasks::task` → `tasks.title`

---

## Code References

### FileMaker API Layer

| Function | File | Lines | Purpose |
|----------|------|-------|---------|
| `startTaskTimer` | `src/api/tasks.js` | 121-178 | Creates timer record in devRecords |
| `stopTaskTimer` | `src/api/tasks.js` | 189-213 | Updates timer record with end time |
| `fetchFinancialRecordByRecordId` | `src/api/financialRecords.js` | 336-348 | Retrieves record by ~recordId |
| `fetchFinancialRecordByUUID` | `src/api/financialRecords.js` | 355-367 | Retrieves record by __ID |

### Business Logic Layer

| Function | File | Lines | Purpose |
|----------|------|-------|---------|
| `stopTimer` | `src/services/taskService.js` | 67-131 | Orchestrates timer stop + sales record creation |
| `processFinancialData` | `src/services/billableHoursService.js` | 12-98 | Processes raw FileMaker data |
| `processTimerRecords` | `src/services/taskService.js` | 174-200 | Processes timer records for display |

### Timer State Management

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| `useTask` hook | `src/hooks/useTask.js` | 28-370 | Timer state management + localStorage |
| `TaskTimer` component | `src/components/tasks/TaskTimer.jsx` | 1-353 | Timer UI and controls |

### Field Processing Examples

**Start Timer - FileMaker Field Creation:**
```javascript
// src/api/tasks.js:155-174
fieldData: {
    _taskID: taskId,
    _staffID: selectedTask._staffID,
    _projectID: selectedTask._projectID,
    _custID: custID,  // Looked up from project
    TimeStart: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }),  // "14:30:45"
    DateStart: new Date().toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
    })  // "01/10/2026"
}
```

**Stop Timer - FileMaker Field Update:**
```javascript
// src/api/tasks.js:193-206
fieldData: {
    TimeEnd: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }),  // "17:15:30"
    "Work Performed": saveImmediately ? 'Time logged' : description,
    TimeAdjust: totalPauseTime + adjustment  // Seconds
}
```

**Process Financial Data - Field Extraction:**
```javascript
// src/services/billableHoursService.js:76-96
return {
    id: fieldData.__ID,
    recordId: record.recordId,
    customerId: fieldData["_custID"],
    customerName: fieldData["Customers::Name"] || "Unknown Customer",
    projectId: fieldData._projectID,
    projectName: fieldData["customers_Projects::projectName"] ||
                 fieldData["customers_Projects::Name"] ||
                 "Unknown Project",
    amount: calculateAmount(
        fieldData.Billable_Time_Rounded,
        fieldData.Hourly_Rate || fieldData["Customers::chargeRate"] || 0
    ),
    hours: parseFloat(fieldData.Billable_Time_Rounded || 0),
    rate: parseFloat(fieldData.Hourly_Rate || fieldData["Customers::chargeRate"] || 0),
    date: fieldData.DateStart,
    month: parseInt(fieldData.month || 0),
    year: parseInt(fieldData.year || 0),
    billed: fieldData.f_billed === "1" || fieldData.f_billed === 1,
    description: fieldData["Work Performed"] || "",
    taskName: fieldData["Tasks::task"] || fieldData["dapiTasks::task"] || null,
    workPerformed: fieldData["Work Performed"] || "",
    fixedPrice: parseFloat(fieldData["customers_Projects::f_fixedPrice"] || 0),
    createdAt: fieldData['~creationTimestamp'],
    modifiedAt: fieldData['~ModificationTimestamp'] || fieldData['~modificationTimestamp']
};
```

---

## Migration Considerations

### 1. Timestamp Handling

**Challenge:** FileMaker stores date and time separately

**FileMaker Format:**
- `DateStart`: "01/10/2026" (MM/DD/YYYY)
- `TimeStart`: "14:30:45" (HH:MM:SS, 24-hour)

**Supabase Format:**
- `start_time`: "2026-01-10T14:30:45-08:00" (ISO 8601 with timezone)

**Migration Logic:**
```javascript
function convertFileMakerToTimestamp(dateStr, timeStr, timezone = 'America/Los_Angeles') {
    // dateStr: "01/10/2026"
    // timeStr: "14:30:45"

    const [month, day, year] = dateStr.split('/');
    const [hour, minute, second] = timeStr.split(':');

    // Create ISO string
    const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}`;

    // Parse with timezone
    return new Date(isoString).toISOString();
}
```

### 2. Billable Hours Calculation

**Current:** FileMaker calculated field `Billable_Time_Rounded`

**Migration Options:**

**Option A: Database Trigger (Recommended)**
```sql
CREATE OR REPLACE FUNCTION calculate_billable_hours()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.end_time IS NOT NULL THEN
        NEW.billable_hours = (
            EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) -
            COALESCE(NEW.time_adjust_seconds, 0)
        ) / 3600.0;

        IF NEW.hourly_rate IS NOT NULL THEN
            NEW.total_amount = NEW.billable_hours * NEW.hourly_rate;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER time_entries_calculate_billable
    BEFORE INSERT OR UPDATE ON time_entries
    FOR EACH ROW
    EXECUTE FUNCTION calculate_billable_hours();
```

**Option B: Application-Level Calculation**
```javascript
// src/services/timeEntryService.js
export function calculateBillableHours(startTime, endTime, adjustmentSeconds = 0) {
    const elapsedMs = new Date(endTime) - new Date(startTime);
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const billableSeconds = Math.max(0, elapsedSeconds - adjustmentSeconds);
    return billableSeconds / 3600; // Convert to hours
}
```

**Recommendation:** Use database trigger for data consistency + application logic for preview/validation.

### 3. Fixed-Price Project Handling

**Current Behavior:**
```javascript
// src/services/taskService.js:104-112
const fixedPrice = parseFloat(
    financialRecord.response.data[0].fieldData["customers_Projects::f_fixedPrice"] || 0
);

if (fixedPrice > 0) {
    console.log('Skipping sales record creation for fixed-price project');
    financialId = null; // Prevent sales record creation
}
```

**Supabase Migration:**

**Option A: Check at Timer Stop**
```javascript
// Check project fixed_price flag before creating sales record
const { data: project } = await supabase
    .from('projects')
    .select('fixed_price')
    .eq('id', projectId)
    .single();

if (project.fixed_price > 0) {
    // Skip sales record creation
    return;
}
```

**Option B: Denormalize Flag**
```javascript
// Store is_fixed_price_project when timer starts
const { data: project } = await supabase
    .from('projects')
    .select('fixed_price')
    .eq('id', projectId)
    .single();

await supabase.from('time_entries').insert({
    ...timeEntryData,
    is_fixed_price_project: project.fixed_price > 0
});
```

**Recommendation:** Option B (denormalized flag) for query performance and historical accuracy.

### 4. Dual-Write Strategy

**Phase 1: FileMaker Primary (Current)**
- Write to FileMaker first
- Sync to Supabase on success
- Log errors but don't block operation

**Phase 2: Dual-Write Both**
```javascript
// src/services/dualWriteService.js
export async function startTimerDualWrite(taskId, selectedTask, organizationId) {
    // 1. Start timer in FileMaker (primary)
    const fmResult = await startTaskTimer(taskId, selectedTask);

    if (!fmResult?.response?.recordId) {
        throw new Error('FileMaker timer start failed');
    }

    // 2. Create corresponding Supabase record
    try {
        const supabaseData = {
            filemaker_id: fmResult.response.data[0].fieldData.__ID,
            filemaker_record_id: fmResult.response.recordId,
            task_id: taskId,
            staff_id: selectedTask._staffID,
            project_id: selectedTask._projectID,
            customer_id: selectedTask._custID,
            organization_id: organizationId,
            start_time: new Date().toISOString(),
            date: new Date().toISOString().split('T')[0],
            time_adjust_seconds: 0
        };

        const { data, error } = await supabase
            .from('time_entries')
            .insert(supabaseData)
            .select()
            .single();

        if (error) {
            console.error('[DualWrite] Supabase timer start failed:', error);
            // Don't throw - FileMaker is source of truth
        }

        return {
            ...fmResult,
            dualWrite: { success: !error, supabaseId: data?.id }
        };

    } catch (error) {
        console.error('[DualWrite] Unexpected error:', error);
        return fmResult; // Return FileMaker result even if Supabase fails
    }
}
```

**Phase 3: Supabase Primary**
- Write to Supabase first
- Sync to FileMaker for backward compatibility
- Eventual FileMaker read-only

### 5. Data Type Conversions

| FileMaker Type | Supabase Type | Conversion Notes |
|----------------|---------------|------------------|
| Text (UUID) | UUID | Direct mapping |
| Text | TEXT | Direct mapping |
| Number (integer) | INTEGER | Direct mapping |
| Number (decimal) | NUMERIC(10,4) | Specify precision for hours |
| Number (currency) | NUMERIC(10,2) | Specify precision for money |
| Number (0/1) | BOOLEAN | Convert: 1 → true, 0 → false |
| Date | DATE | Parse MM/DD/YYYY → YYYY-MM-DD |
| Time | TIME | Parse HH:MM:SS (24-hour) |
| Timestamp | TIMESTAMPTZ | FileMaker format → ISO 8601 |

### 6. Organization ID Resolution

**Challenge:** FileMaker has no organization concept

**Current Implementation:**
```javascript
// src/services/taskService.js:86-91
const orgId = organizationId || (window.state?.user?.supabaseOrgID);

if (!orgId) {
    console.warn('No organization ID found, skipping sales record creation');
    return result;
}
```

**Migration Strategy:**
1. Look up organization from customer
2. Store organization_id in all timer records
3. Use for RLS policies

```javascript
// Lookup organization from customer
const { data: customerOrg } = await supabase
    .from('customer_organization')
    .select('organization_id')
    .eq('customer_id', customerId)
    .single();

const organizationId = customerOrg?.organization_id ||
                       window.state?.user?.supabaseOrgID;
```

### 7. Pause Time Tracking

**Current:** Client-side only (localStorage)

**Migration Considerations:**
- Pause state is NOT stored in FileMaker
- Only final `TimeAdjust` (total pause + manual) is stored
- For Supabase, consider two options:

**Option A: Keep Client-Side Only**
- Store active timer state in localStorage
- Only write final `time_adjust_seconds` to database on stop

**Option B: Track Pause Events**
```sql
-- Additional table for pause history
CREATE TABLE time_entry_pauses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    time_entry_id UUID NOT NULL REFERENCES time_entries(id),
    pause_start TIMESTAMP WITH TIME ZONE NOT NULL,
    pause_end TIMESTAMP WITH TIME ZONE,
    pause_duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Recommendation:** Option A for consistency with current behavior. Option B for audit trail if needed.

### 8. Historical Data Migration

**Estimated Records:** Unknown (requires FileMaker query)

**Migration Script:**
```bash
# Count records in FileMaker
ssh marcus@backend.claritybusinesssolutions.ca \
  "docker exec supabase-db psql -U postgres -d postgres -c \
  \"SELECT COUNT(*) FROM filemaker_records;\""
```

**Migration Process:**
1. Export all devRecords from FileMaker
2. Transform to Supabase schema
3. Bulk insert with `ON CONFLICT DO NOTHING` for idempotency
4. Validate counts and totals
5. Reconcile discrepancies

**Batch Insert Example:**
```javascript
// Batch insert for performance
const BATCH_SIZE = 1000;
for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
        .from('time_entries')
        .insert(batch, { onConflict: 'filemaker_id' });

    if (error) {
        console.error(`Batch ${i / BATCH_SIZE} failed:`, error);
    }
}
```

---

## Next Steps

### 1. Backend Change Request (REQUIRED)

Create a backend change request document following the protocol in `CLAUDE.md`:

**Document:** `BACKEND_CHANGE_REQUEST_001_TIME_ENTRIES_TABLE.md`

**Contents:**
- SQL schema creation script (from this document)
- RLS policies
- Indexes
- Trigger functions
- Migration plan
- Rollback plan
- Testing requirements

**Process:**
1. Create change request document
2. User forwards to backend team
3. Wait for approval and implementation
4. Test in dev environment
5. Implement frontend code

### 2. Frontend Implementation (AFTER Backend Approval)

**Phase 1: Dual-Write Service**
- Create `src/services/timeEntryService.js`
- Implement `startTimerDualWrite()`
- Implement `stopTimerDualWrite()`
- Add error handling and logging

**Phase 2: API Abstraction**
- Create `src/api/timeEntries.js`
- Implement Supabase CRUD operations
- Maintain FileMaker API compatibility

**Phase 3: UI Updates**
- Update `useTask` hook to use dual-write
- Add Supabase error handling
- Test timer lifecycle

**Phase 4: Historical Data Migration**
- Create migration script
- Test in dev environment
- Execute production migration
- Validate data integrity

### 3. Testing Requirements

**Unit Tests:**
- Time/date conversion functions
- Billable hours calculation
- Fixed-price detection
- Organization lookup

**Integration Tests:**
- Dual-write success/failure scenarios
- FileMaker → Supabase sync
- Foreign key constraints
- RLS policy enforcement

**E2E Tests:**
- Start timer → Stop timer → Verify in both systems
- Pause/resume → Stop → Verify adjustment
- Fixed-price project → Verify no sales record
- Cross-device timer state (future)

### 4. Monitoring and Reconciliation

**Daily Reconciliation:**
- Compare FileMaker record count vs Supabase
- Check for missing `filemaker_id` mappings
- Validate billable hours totals
- Identify dual-write failures

**Alerting:**
- Log `[DualWrite]` errors to monitoring service
- Alert on reconciliation discrepancies > 1%
- Track Supabase write latency

---

## Appendix: SQL Queries for Verification

### Check Table Exists
```sql
SELECT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'time_entries'
);
```

### Count Records
```sql
SELECT COUNT(*) FROM time_entries;
```

### Verify Foreign Keys
```sql
SELECT
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'time_entries'::regclass
AND contype = 'f';
```

### Check Indexes
```sql
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'time_entries'
ORDER BY indexname;
```

### Validate RLS Policies
```sql
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'time_entries';
```

### Check for Orphaned Records
```sql
-- Records with invalid task_id
SELECT COUNT(*)
FROM time_entries te
LEFT JOIN tasks t ON te.task_id = t.id
WHERE t.id IS NULL;

-- Records with invalid customer_id
SELECT COUNT(*)
FROM time_entries te
LEFT JOIN customers c ON te.customer_id = c.id
WHERE c.id IS NULL;
```

### Reconciliation Query
```sql
-- Compare Supabase vs FileMaker counts by date
SELECT
    date,
    COUNT(*) AS supabase_count,
    SUM(billable_hours) AS total_hours,
    SUM(total_amount) AS total_amount
FROM time_entries
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date
ORDER BY date DESC;
```

---

**End of Document**
