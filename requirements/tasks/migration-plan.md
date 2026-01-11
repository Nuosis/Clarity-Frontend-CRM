# Tasks & Timer - Migration Plan

## Overview

This document outlines the strategy for migrating Tasks and Timer functionality from FileMaker to Supabase, including data migration, ID reconciliation, testing, and rollout phases.

## Migration Goals

1. Migrate 10,000+ tasks from FileMaker to Supabase
2. Migrate 50,000+ timer/financial records with full history
3. Maintain data integrity and referential relationships
4. Zero downtime cutover
5. Rollback capability if issues arise
6. Deprecate `dualWriteService.js` and `financialSyncService.js`

---

## Pre-Migration Assessment

### Data Inventory

**Tasks (devTasks):**
```sql
-- FileMaker query to count tasks
SELECT COUNT(*) FROM devTasks WHERE _orgID = 'org123';
-- Expected: ~10,000 records
```

**Time/Financial Records (dapiRecords):**
```sql
-- FileMaker query to count time records
SELECT COUNT(*) FROM dapiRecords WHERE _orgID = 'org123';
-- Expected: ~50,000 records
```

**Related Dependencies:**
- Projects: Tasks reference projects via `_projectID`
- Customers: Tasks reference customers indirectly via projects
- Staff: Tasks assigned to staff via `_staffID`
- Notes: Tasks may have associated notes
- Links: Tasks may have associated links

**Assumption:** Projects, Customers, and Staff have already been migrated to Supabase before starting Tasks migration.

---

## Migration Phases

### Phase 0: Preparation (Week 1-2)

#### 0.1 Backend Schema Deployment

**Tasks:**
- Deploy `tasks` table to Supabase production
- Deploy `time_entries` table
- Add `time_entry_id` column to `customer_sales`
- Create indexes, constraints, triggers
- Deploy RLS policies
- Deploy RPC functions (`stop_timer_and_create_sale`, etc.)

**SQL Script:** `001_tasks_schema.sql`

**Validation:**
```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('tasks', 'time_entries');

-- Verify indexes
SELECT indexname FROM pg_indexes
WHERE tablename IN ('tasks', 'time_entries');

-- Verify RLS enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('tasks', 'time_entries');
```

#### 0.2 ID Mapping Table Creation

Create `filemaker_id_mappings` table:

```sql
CREATE TABLE filemaker_id_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  entity_type TEXT NOT NULL,
  filemaker_id TEXT NOT NULL,
  supabase_uuid UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, filemaker_id)
);

CREATE INDEX idx_fm_mappings_entity ON filemaker_id_mappings(entity_type, filemaker_id);
CREATE INDEX idx_fm_mappings_uuid ON filemaker_id_mappings(supabase_uuid);
```

#### 0.3 Data Export from FileMaker

**Export Tasks:**
```bash
# Export devTasks to CSV
curl -X POST "https://server.claritybusinesssolutions.ca/fmi/data/v1/databases/clarityCRM/layouts/devTasks/_find" \
  -H "Authorization: Bearer $FM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "query": [] }' \
  | jq '.response.data' > filemaker_tasks_export.json
```

**Export Time/Financial Records:**
```bash
# Export dapiRecords to CSV
curl -X POST "https://server.claritybusinesssolutions.ca/fmi/data/v1/databases/clarityCRM/layouts/dapiRecords/_find" \
  -H "Authorization: Bearer $FM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "query": [] }' \
  | jq '.response.data' > filemaker_records_export.json
```

**Data Quality Checks:**
- Verify all tasks have valid `_projectID`
- Verify all records have valid `_taskID`, `_projectID`, `_custID`
- Check for NULL critical fields
- Identify orphaned records

#### 0.4 Generate ID Mappings

**Script:** `generate_id_mappings.js`

```javascript
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Load exported tasks
const tasks = JSON.parse(fs.readFileSync('filemaker_tasks_export.json'));
const records = JSON.parse(fs.readFileSync('filemaker_records_export.json'));

// Generate task mappings
const taskMappings = tasks.map(task => ({
  organization_id: 'org-uuid',
  entity_type: 'task',
  filemaker_id: task.fieldData.__ID,
  supabase_uuid: uuidv4()
}));

// Generate time_entry mappings
const timeMappings = records.map(record => ({
  organization_id: 'org-uuid',
  entity_type: 'time_entry',
  filemaker_id: record.fieldData.__ID,
  supabase_uuid: uuidv4()
}));

// Save to SQL
const sql = taskMappings.concat(timeMappings).map(m =>
  `INSERT INTO filemaker_id_mappings (organization_id, entity_type, filemaker_id, supabase_uuid) VALUES ('${m.organization_id}', '${m.entity_type}', '${m.filemaker_id}', '${m.supabase_uuid}');`
).join('\n');

fs.writeFileSync('002_id_mappings.sql', sql);
console.log(`Generated ${taskMappings.length + timeMappings.length} ID mappings`);
```

**Run:**
```bash
node generate_id_mappings.js
# Output: 002_id_mappings.sql
```

**Import Mappings:**
```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker exec -i supabase-db psql -U postgres -d postgres < 002_id_mappings.sql"
```

**Validation:**
```sql
SELECT entity_type, COUNT(*) FROM filemaker_id_mappings GROUP BY entity_type;
-- Expected: task: 10000, time_entry: 50000
```

---

### Phase 1: Data Transformation (Week 2)

#### 1.1 Transform Tasks Data

**Script:** `transform_tasks.js`

```javascript
const fs = require('fs');

// Load exports and mappings
const tasks = JSON.parse(fs.readFileSync('filemaker_tasks_export.json'));
const mappings = loadMappingsFromDatabase(); // Fetch from Supabase
const projectMappings = loadProjectMappings();
const staffMappings = loadStaffMappings();

// Transform each task
const transformedTasks = tasks.map(task => {
  const fm = task.fieldData;

  return {
    id: mappings.task[fm.__ID],
    organization_id: 'org-uuid',
    project_id: projectMappings[fm._projectID] || null,
    customer_id: getCustomerIdFromProject(projectMappings[fm._projectID]),
    staff_id: staffMappings[fm._staffID] || null,
    title: fm.task || 'Untitled Task',
    task_type: fm.type || 'General',
    notes: fm.notes || '',
    is_completed: fm.f_completed === 1,
    status: fm.f_completed === 1 ? 'completed' : 'pending',
    priority: 3, // Default priority
    estimated_hours: null,
    actual_hours: null, // Will be calculated from time_entries
    due_date: null,
    filemaker_task_id: fm.__ID,
    created_at: parseFMDate(fm.DateCreated),
    updated_at: parseFMDate(fm.DateModified)
  };
});

// Generate SQL INSERT statements
const sql = transformedTasks.map(t =>
  `INSERT INTO tasks (id, organization_id, project_id, customer_id, staff_id, title, task_type, notes, is_completed, status, priority, filemaker_task_id, created_at, updated_at) VALUES (
    '${t.id}', '${t.organization_id}', '${t.project_id}', '${t.customer_id}', ${t.staff_id ? `'${t.staff_id}'` : 'NULL'}, '${escape(t.title)}', '${escape(t.task_type)}', '${escape(t.notes)}', ${t.is_completed}, '${t.status}', ${t.priority}, '${t.filemaker_task_id}', '${t.created_at}', '${t.updated_at}'
  );`
).join('\n');

fs.writeFileSync('003_tasks_import.sql', sql);
```

**Date Conversion:**
```javascript
function parseFMDate(fmDate) {
  // FileMaker: "01/10/2026"
  if (!fmDate) return 'now()';
  const [month, day, year] = fmDate.split('/').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toISOString();
}
```

**Output:** `003_tasks_import.sql`

#### 1.2 Transform Time Entries Data

**Script:** `transform_time_entries.js`

```javascript
const transformedEntries = records.map(record => {
  const fm = record.fieldData;

  // Combine date and time
  const startTime = combineFMDateTime(fm.DateStart, fm.TimeStart);
  const endTime = fm.TimeEnd ? combineFMDateTime(fm.DateStart, fm.TimeEnd) : null;

  // Calculate duration
  let durationMinutes = null;
  if (endTime) {
    const elapsed = (new Date(endTime) - new Date(startTime)) / 1000; // seconds
    const adjusted = elapsed - (fm.TimeAdjust || 0);
    durationMinutes = Math.max(0, adjusted / 60.0);
  }

  return {
    id: mappings.time_entry[fm.__ID],
    organization_id: 'org-uuid',
    task_id: mappings.task[fm._taskID] || null,
    project_id: projectMappings[fm._projectID] || null,
    customer_id: customerMappings[fm._custID] || null,
    staff_id: staffMappings[fm._staffID] || null,
    start_time: startTime,
    end_time: endTime,
    description: fm['Work Performed'] || '',
    adjustment_seconds: fm.TimeAdjust || 0,
    pause_duration_seconds: 0, // Not tracked in FM
    duration_minutes: durationMinutes,
    hourly_rate: getStaffHourlyRate(fm._staffID),
    billable_amount: durationMinutes ? (durationMinutes / 60.0) * getStaffHourlyRate(fm._staffID) : null,
    is_billable: true,
    status: endTime ? 'completed' : 'active',
    filemaker_record_id: fm.__ID,
    created_at: startTime,
    updated_at: endTime || startTime,
    completed_at: endTime
  };
});

// Generate SQL
const sql = transformedEntries.map(e => /* SQL INSERT */);
fs.writeFileSync('004_time_entries_import.sql', sql);
```

**DateTime Combination:**
```javascript
function combineFMDateTime(date, time) {
  // date: "01/10/2026", time: "14:30:00"
  const [month, day, year] = date.split('/').map(Number);
  const [hours, minutes, seconds] = time.split(':').map(Number);
  const dt = new Date(year, month - 1, day, hours, minutes, seconds);
  return dt.toISOString();
}
```

**Output:** `004_time_entries_import.sql`

#### 1.3 Update customer_sales with time_entry_id

**Script:** `link_customer_sales.js`

```javascript
// For each customer_sales record with filemaker_record_id
const updates = customerSales.map(sale => {
  const timeEntryId = mappings.time_entry[sale.filemaker_record_id];
  return `UPDATE customer_sales SET time_entry_id = '${timeEntryId}' WHERE filemaker_record_id = '${sale.filemaker_record_id}';`;
}).join('\n');

fs.writeFileSync('005_link_customer_sales.sql', updates);
```

**Output:** `005_link_customer_sales.sql`

---

### Phase 2: Data Import (Week 3)

#### 2.1 Import to Staging Environment

**Staging Database:** `supabase-staging-db`

**Import Tasks:**
```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker exec -i supabase-staging-db psql -U postgres -d postgres < 003_tasks_import.sql"
```

**Validation:**
```sql
SELECT COUNT(*) FROM tasks;
-- Expected: 10,000

SELECT COUNT(*) FROM tasks WHERE project_id IS NULL;
-- Expected: 0 (all tasks should have project)

SELECT COUNT(*) FROM tasks WHERE customer_id IS NULL;
-- Expected: 0
```

**Import Time Entries:**
```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker exec -i supabase-staging-db psql -U postgres -d postgres < 004_time_entries_import.sql"
```

**Validation:**
```sql
SELECT COUNT(*) FROM time_entries;
-- Expected: 50,000

SELECT COUNT(*) FROM time_entries WHERE task_id IS NULL;
-- Expected: 0

SELECT COUNT(*) FROM time_entries WHERE status = 'active';
-- Expected: ~10 (current active timers)
```

**Link Customer Sales:**
```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker exec -i supabase-staging-db psql -U postgres -d postgres < 005_link_customer_sales.sql"
```

**Validation:**
```sql
SELECT COUNT(*) FROM customer_sales WHERE time_entry_id IS NOT NULL;
-- Expected: 50,000
```

#### 2.2 Data Quality Verification

**Run Verification Queries:**

```sql
-- Q1: Check task actual_hours match sum of time_entries
SELECT
  t.id,
  t.actual_hours AS task_hours,
  COALESCE(SUM(te.duration_minutes) / 60.0, 0) AS calculated_hours,
  ABS(t.actual_hours - COALESCE(SUM(te.duration_minutes) / 60.0, 0)) AS diff
FROM tasks t
LEFT JOIN time_entries te ON te.task_id = t.id AND te.status = 'completed'
GROUP BY t.id, t.actual_hours
HAVING ABS(t.actual_hours - COALESCE(SUM(te.duration_minutes) / 60.0, 0)) > 0.1;
-- Expected: 0 rows (all match within rounding)

-- Q2: Check customer_sales amounts match time_entries
SELECT
  cs.id,
  cs.amount AS sale_amount,
  te.billable_amount AS entry_amount,
  ABS(cs.amount - te.billable_amount) AS diff
FROM customer_sales cs
JOIN time_entries te ON te.id = cs.time_entry_id
WHERE ABS(cs.amount - te.billable_amount) > 0.01;
-- Expected: 0 rows (all match)

-- Q3: Check for orphaned time_entries
SELECT COUNT(*) FROM time_entries
WHERE task_id NOT IN (SELECT id FROM tasks);
-- Expected: 0

-- Q4: Check for orphaned tasks
SELECT COUNT(*) FROM tasks
WHERE project_id NOT IN (SELECT id FROM projects);
-- Expected: 0
```

**If Issues Found:**
- Document discrepancies in `migration_issues.txt`
- Fix transformation scripts
- Re-import affected records

---

### Phase 3: Frontend Refactor (Week 4-5)

#### 3.1 Create New API Functions

**File:** `src/api/tasksSupabase.js`

```javascript
import { dataService } from '../services/dataService';

export async function fetchTasksSupabase(projectId, includeCompleted = false) {
  const endpoint = '/tasks';
  const params = new URLSearchParams({
    project_id: projectId,
    include_completed: includeCompleted.toString()
  });

  return await dataService.backendRequest('GET', `${endpoint}?${params}`);
}

export async function createTaskSupabase(data) {
  return await dataService.backendRequest('POST', '/tasks', data);
}

export async function updateTaskSupabase(taskId, data) {
  return await dataService.backendRequest('PATCH', `/tasks/${taskId}`, data);
}

export async function startTimerSupabase(taskId, description) {
  return await dataService.backendRequest('POST', '/time-entries/start', {
    task_id: taskId,
    description
  });
}

export async function stopTimerSupabase(entryId, description, adjustmentSeconds = 0, pauseSeconds = 0) {
  return await dataService.backendRequest('POST', `/time-entries/${entryId}/stop`, {
    description,
    adjustment_seconds: adjustmentSeconds,
    pause_duration_seconds: pauseSeconds
  });
}
```

#### 3.2 Update TaskTimer Component

**Changes to `TaskTimer.jsx`:**
- Replace `startTaskTimer()` with `startTimerSupabase()`
- Replace `stopTaskTimer()` with `stopTimerSupabase()`
- Remove dual-write logic (no longer needed)

**Before:**
```javascript
import { startTaskTimer, stopTaskTimer } from '../../api/tasks';
import { stopTimerWithDualWrite } from '../../services/dualWriteService';

const handleStop = async () => {
  const result = await stopTimerWithDualWrite({
    recordId: timer.recordId,
    description,
    saveImmediately: false,
    totalPauseTime: timer.totalPauseTime,
    adjustment: timer.adjustment
  }, organizationId);
  // ...
};
```

**After:**
```javascript
import { startTimerSupabase, stopTimerSupabase } from '../../api/tasksSupabase';

const handleStop = async () => {
  const result = await stopTimerSupabase(
    timer.id,
    description,
    timer.adjustment,
    timer.totalPauseTime
  );
  // Handle result.data.time_entry and result.data.customer_sale
  // ...
};
```

#### 3.3 Feature Flag Toggle

**Environment Variable:** `VITE_TASKS_USE_SUPABASE=true`

**Conditional Routing in API:**
```javascript
export async function fetchTasks(projectId, query) {
  if (import.meta.env.VITE_TASKS_USE_SUPABASE === 'true') {
    return await fetchTasksSupabase(projectId, query);
  } else {
    return await fetchTasksFileMaker(projectId, query);
  }
}
```

**Gradual Rollout:**
- Week 4: Enable for internal org only
- Week 5: Enable for beta customers (opt-in)
- Week 6: Enable for 50% of customers (A/B test)
- Week 7: Enable for 100% (full cutover)

---

### Phase 4: Testing (Week 5-6)

#### 4.1 Unit Tests

**Test File:** `tests/api/tasksSupabase.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTaskSupabase, startTimerSupabase, stopTimerSupabase } from '../../src/api/tasksSupabase';

describe('Tasks Supabase API', () => {
  it('should create task', async () => {
    const result = await createTaskSupabase({
      project_id: 'project-uuid',
      title: 'Test task',
      task_type: 'Testing'
    });
    expect(result.success).toBe(true);
    expect(result.data.id).toBeDefined();
  });

  it('should start timer', async () => {
    const result = await startTimerSupabase('task-uuid', 'Starting test');
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('active');
  });

  it('should prevent duplicate active timer', async () => {
    await startTimerSupabase('task-uuid', 'Starting test');
    const result2 = await startTimerSupabase('task-uuid', 'Duplicate');
    // Should return existing timer, not create new one
    expect(result2.success).toBe(true);
    expect(result2.data.description).toBe('Starting test');
  });

  it('should stop timer and create customer_sale', async () => {
    const startResult = await startTimerSupabase('task-uuid', 'Starting');
    const stopResult = await stopTimerSupabase(startResult.data.id, 'Completed work', 0, 0);

    expect(stopResult.success).toBe(true);
    expect(stopResult.data.time_entry.status).toBe('completed');
    expect(stopResult.data.customer_sale).toBeDefined();
    expect(stopResult.data.customer_sale.amount).toBeGreaterThan(0);
  });
});
```

**Run Tests:**
```bash
npm test -- tests/api/tasksSupabase.test.js
```

#### 4.2 Integration Tests

**Test Scenarios:**
1. Create task → start timer → pause → resume → stop → verify customer_sale created
2. Start timer with active timer already running → verify idempotency
3. Stop timer with negative adjustment → verify error handling
4. Update task while timer running → verify no conflicts
5. Delete task with time entries → verify foreign key protection

#### 4.3 Manual Testing Checklist

**Tasks:**
- [ ] Create new task
- [ ] Edit task details
- [ ] Mark task complete/incomplete
- [ ] Delete task (with/without time entries)
- [ ] Filter tasks by status/staff

**Timer:**
- [ ] Start timer for task
- [ ] Pause and resume timer
- [ ] Adjust time (±6 min)
- [ ] Stop timer with description
- [ ] Verify duration calculation
- [ ] Verify billable amount calculation
- [ ] Verify customer_sale record created

**Edge Cases:**
- [ ] Browser refresh during active timer
- [ ] Network disconnection during timer stop
- [ ] Concurrent timers (multiple users on same task)
- [ ] Timezone handling (server UTC, client local)

---

### Phase 5: Production Cutover (Week 7)

#### 5.1 Pre-Cutover Checklist

- [x] Schema deployed to production
- [x] Data migrated to production
- [x] Frontend refactor complete
- [x] Tests passing
- [x] Beta testing successful
- [x] Rollback plan documented
- [ ] Communication sent to users
- [ ] Support team trained

#### 5.2 Cutover Steps

**Day 1 (Friday Evening):**

**Step 1:** Set FileMaker to read-only mode (prevent new task/timer operations)
```
// Disable task creation in FileMaker UI
// Display maintenance banner
```

**Step 2:** Final data sync from FileMaker
```bash
# Export any new tasks/records created since last sync
# Run transformation and import scripts
# Verify counts match
```

**Step 3:** Enable Supabase mode via feature flag
```bash
# Update environment variable
ssh marcus@backend.claritybusinesssolutions.ca "docker exec clarity_backend_api sh -c 'export TASKS_USE_SUPABASE=true && supervisorctl restart api'"
```

**Step 4:** Monitor for errors
```bash
# Watch application logs
ssh marcus@backend.claritybusinesssolutions.ca "docker logs -f clarity_backend_api | grep -i 'tasks\\|timer\\|time_entries'"
```

**Step 5:** Smoke test critical flows
- [ ] Create task (Supabase)
- [ ] Start timer (Supabase)
- [ ] Stop timer (verify customer_sale created)
- [ ] Verify in database

**Day 2 (Saturday):**

**Step 6:** Full monitoring
- Check error rates in logs
- Monitor database performance
- Review customer support tickets

**Step 7:** Gradual traffic increase
- Enable for 100% of users
- Monitor performance metrics

**Day 3 (Sunday):**

**Step 8:** Final validation
- Verify all active timers working
- Verify historical data accessible
- Run reconciliation queries

---

### Phase 6: Post-Cutover (Week 8)

#### 6.1 Deprecate Dual-Write Service

**Remove from codebase:**
- `src/services/dualWriteService.js`
- `src/services/financialSyncService.js` (timer-related parts)

**Update API:**
- Remove FileMaker timer calls from `src/api/tasks.js`
- Remove conditional routing (always use Supabase)

**Git commit:**
```bash
git rm src/services/dualWriteService.js
git rm src/services/financialSyncService.js
git commit -m "Remove FileMaker dual-write for tasks/timer (migration complete)"
```

#### 6.2 Archive FileMaker Data

**Keep FileMaker data as backup:**
- Do NOT delete FileMaker devTasks/dapiRecords
- Keep accessible for 90 days in case of discrepancies
- After 90 days, archive to cold storage

#### 6.3 Performance Optimization

**Review slow queries:**
```sql
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%tasks%' OR query LIKE '%time_entries%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Add indexes if needed:**
- Check query plans with `EXPLAIN ANALYZE`
- Add composite indexes for common filters

---

## Rollback Plan

### Triggers for Rollback

- Critical bugs preventing timer stop
- Data loss or corruption
- Performance degradation > 50%
- Customer complaints > 10

### Rollback Steps

**Step 1:** Disable Supabase mode
```bash
# Set feature flag back to FileMaker
ssh marcus@backend.claritybusinesssolutions.ca "docker exec clarity_backend_api sh -c 'export TASKS_USE_SUPABASE=false && supervisorctl restart api'"
```

**Step 2:** Re-enable FileMaker write access
```
// Remove read-only mode in FileMaker
```

**Step 3:** Sync Supabase changes back to FileMaker (if any)
```javascript
// Export any tasks/timers created during Supabase-only period
// Import back to FileMaker using dual-write logic
```

**Step 4:** Investigate and fix issues

**Step 5:** Re-attempt cutover after fixes

**Rollback Window:** 48 hours (after that, too much data divergence)

---

## Data Reconciliation

### Daily Reconciliation (During Dual-Write Phase)

**Script:** `reconcile_tasks.sh`

```bash
#!/bin/bash
# Run daily at 2 AM

# Compare counts
FM_COUNT=$(curl -s "$FM_API/devTasks/_find" | jq '.response.dataInfo.foundCount')
SB_COUNT=$(psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM tasks")

echo "FileMaker tasks: $FM_COUNT"
echo "Supabase tasks: $SB_COUNT"

if [ "$FM_COUNT" -ne "$SB_COUNT" ]; then
  echo "WARNING: Count mismatch detected!"
  # Send alert email
fi
```

### Post-Migration Reconciliation

**Week 1 after cutover:**
- Run reconciliation queries daily
- Compare customer_sales totals with FileMaker
- Investigate any discrepancies

**Week 2-4 after cutover:**
- Run reconciliation weekly
- Monitor support tickets for data issues

---

## Success Metrics

### Migration Success Criteria

- [ ] 100% of tasks migrated (count matches)
- [ ] 100% of time/financial records migrated
- [ ] 0 data loss
- [ ] < 5% performance degradation
- [ ] < 10 customer complaints
- [ ] Rollback not required

### Performance Benchmarks

**Before (FileMaker):**
- Task list load time: 800ms
- Timer start: 1.2s
- Timer stop: 1.5s

**After (Supabase Target):**
- Task list load time: < 500ms (40% improvement)
- Timer start: < 800ms (33% improvement)
- Timer stop: < 1000ms (33% improvement)

---

## Communication Plan

### Stakeholders

- **Development Team:** Daily standups during migration
- **Support Team:** Training session before cutover
- **Customers:** Email notification 1 week before cutover
- **Management:** Weekly progress reports

### Email Template (Customers)

**Subject:** Upcoming Improvement: Tasks & Timer Migration

**Body:**
> Dear [Customer],
>
> We're upgrading our Tasks and Timer feature to improve performance and reliability. This migration will happen on [DATE] and should not affect your day-to-day usage.
>
> **What's changing:**
> - Faster task loading and timer operations
> - Improved data reliability
> - Better mobile experience
>
> **What you need to do:**
> - Nothing! The upgrade happens automatically.
> - If you have an active timer on [DATE], please stop it before 5 PM EST.
>
> If you experience any issues after the migration, please contact support.
>
> Thank you,
> Clarity CRM Team

---

## Timeline Summary

| Week | Phase | Tasks |
|---|---|---|
| 1-2 | Preparation | Schema deployment, data export, ID mapping |
| 2 | Transformation | Data transformation scripts, validation |
| 3 | Import | Import to staging, data quality checks |
| 4-5 | Frontend | Refactor, feature flag, internal testing |
| 5-6 | Testing | Unit tests, integration tests, beta testing |
| 7 | Cutover | Production cutover, monitoring |
| 8 | Cleanup | Remove dual-write, optimize, documentation |

**Total Duration:** 8 weeks

**Critical Path:** Schema → ID Mapping → Data Import → Frontend Refactor → Cutover

---

## Lessons Learned (To Be Updated Post-Migration)

*This section will be filled in after migration completion to document what went well, what didn't, and recommendations for future migrations.*

---

**Status:** Migration plan ready for execution
**Next Step:** Begin Phase 0 (Preparation)
