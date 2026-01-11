# Data Model Mapping

This document provides comprehensive field-by-field mapping between FileMaker's project-related layouts and Supabase's projects and related tables.

## Overview

**Source**: FileMaker Database `clarityCRM`, 7 Layouts:
- `devProjects` (main projects table)
- `devProjectObjectives` (project goals/milestones)
- `devProjectObjSteps` (steps within objectives)
- `devProjectImages` (project images)
- `devProjectLinks` (external URLs)
- `devNotes` (notes - polymorphic association)
- `dapiRecords` (time tracking records)

**Target**: Supabase database, tables: `projects`, `project_objectives`, `project_objective_steps`, `project_images`, `links` (shared), `notes` (planned), `time_entries`/`customer_sales`

**Key Challenges**:
1. FileMaker uses 7 separate layouts, Supabase needs normalized schema
2. FileMaker uses string-based booleans ("1"/"0"), Supabase uses proper booleans
3. FileMaker `recordId` (internal ID) has no Supabase equivalent
4. Polymorphic associations (notes, links) use `_fkID` without entity type indicator
5. Time records exist in `dapiRecords` layout, unclear mapping to Supabase
6. No organization_id in FileMaker - required for Supabase multi-tenancy
7. Date format conversion: FileMaker MM/DD/YYYY vs Supabase YYYY-MM-DD

## FileMaker devProjects Layout Fields

### Primary Identifiers

| FileMaker Field | Type | Description | Sample Value |
|----------------|------|-------------|--------------|
| `__ID` | Text (UUID) | Globally unique identifier | `"a1b2c3d4-e5f6-7890-abcd-1234567890ab"` |
| `recordId` | Number (Internal) | FileMaker internal record ID | `"42"` (string in API responses) |

### Core Project Fields

| FileMaker Field | Type | Required | Description | Sample Value |
|----------------|------|----------|-------------|--------------|
| `projectName` | Text | ✅ Yes | Project name | `"Website Redesign"` |
| `_custID` | Text (UUID) | ✅ Yes | Customer ID (FK to devCustomers) | `"uuid-customer-123"` |
| `_teamID` | Text (UUID) | No | Team ID (FK to devTeams) | `"uuid-team-456"` |
| `status` | Text | No | Project status | `"Open"`, `"Active"`, `"On Hold"`, `"Completed"`, `"Cancelled"` |
| `estOfTime` | Text | No | Time estimate | `"2h 30m"`, `"40h"` |

### Pricing Fields

| FileMaker Field | Type | Required | Description | Sample Value |
|----------------|------|----------|-------------|--------------|
| `value` | Text (Number) | No | Project value/price | `"5000.00"` (stored as text) |
| `f_fixedPrice` | Text | No | Fixed price flag ("1" = yes, "0" = no) | `"1"` |
| `f_subscription` | Text | No | Subscription flag ("1" = yes, "0" = no) | `"0"` |

**Business Rules**:
- If `f_fixedPrice = "1"`: Project is fixed-price, value split 50/50 at start/end
- If `f_subscription = "1"`: Project is subscription-based, value billed monthly
- Cannot be both fixed-price AND subscription simultaneously
- If either flag is "1", `value` field is required and must be > 0

**Fixed-Price Project Business Logic** (See api-contracts.md for full details):
1. **Project Start (dateStart)**: When `f_fixedPrice = "1"` and `dateStart <= today`:
   - Create `customer_sales` entry: 50% of project value (`value / 2`)
   - Entry type: "sellable"
   - Date: `dateStart`
   - Description: "{project.name} - 50% on project start"

2. **Project Completion (dateEnd or status → "Completed")**:
   - Create `customer_sales` entry: 50% of project value (`value / 2`)
   - Entry type: "sales"
   - Date: `dateEnd` or actual completion date
   - Description: "{project.name} - 50% on project completion"

3. **Time Records Non-Billable**: Set all time records for project as `f_billed = "0"`
   - FileMaker: `UPDATE dapiRecords SET f_billed = "0" WHERE _projectID = project.__ID`
   - Supabase: `UPDATE time_entries SET is_billed = false WHERE project_id = project.id`
   - Rationale: Fixed-price projects billed via milestones, NOT hourly time tracking

**Code References**:
- `src/services/projectService.js:508-596` - processProjectValue() function
- `src/hooks/useProject.js:186-264` - handleCreateProject() with pricing logic
- `src/services/billableHoursService.js:288-309` - time record calculations

**Subscription Project Business Logic** (See api-contracts.md for full details):

When `f_subscription = "1"`, the system creates monthly recurring sales entries from project start date to end date (or today if no end date).

1. **Validation Requirements**:
   - `dateStart` is required (cannot create subscription without start date)
   - `value` must be > 0 (monthly subscription amount)
   - `f_fixedPrice` must be "0" (cannot be both fixed-price AND subscription)

2. **Monthly Sales Entry Generation**:
   - **Trigger**: Project creation or update with `f_subscription = "1"`
   - **Period**: From `dateStart` to `min(today, dateEnd)`
   - **Frequency**: Monthly (on the same day of month as `dateStart`)

3. **Sales Entry Details**:
   ```javascript
   {
     customer_id: project._custID,
     product_name: `${project.projectName} - Monthly Subscription`,
     product_id: null,
     quantity: 1,
     unit_price: project.value,          // Full monthly value
     total_price: project.value,
     date: monthDate,                     // Start date + N months
     type: "sales",
     project_id: project.__ID,
     organization_id: project.organization_id,
     created_at: now(),
     updated_at: now()
   }
   ```

4. **Monthly Billing Calculation**:
   - Start from `dateStart`
   - For each month where `monthDate <= min(today, dateEnd)`:
     - Create sales entry for that month
     - Use same day of month as start date (e.g., if started on 15th, bill on 15th of each month)
   - Stop when reaching `dateEnd` OR today (whichever is earlier)

5. **Example Scenario**:
   - Project: "Monthly Hosting Service"
   - Value: $500.00 (per month)
   - Start Date: 01/15/2024 (January 15, 2024)
   - End Date: No end date (perpetual subscription)
   - Today: 04/10/2024 (April 10, 2024)

   **Generated Sales Entries**:
   - Entry 1: $500 on 01/15/2024 (Month 1)
   - Entry 2: $500 on 02/15/2024 (Month 2)
   - Entry 3: $500 on 03/15/2024 (Month 3)
   - Entry 4: NOT created yet (04/15/2024 is in future)
   - Total billed to date: $1,500.00

6. **Idempotency Check**:
   Before creating each sales entry, verify it doesn't already exist:
   ```sql
   -- FileMaker Find
   WHERE _custID = project._custID
     AND date = monthDate
     AND productName LIKE '%Monthly Subscription%'
     AND total = project.value

   -- Supabase Query
   SELECT id FROM customer_sales
   WHERE customer_id = :project.customer_id
     AND date = :monthDate
     AND product_name LIKE '%Monthly Subscription%'
     AND total_price = :project.value
   LIMIT 1;
   ```

7. **Time Records Non-Billable**:
   Similar to fixed-price projects, subscription projects are billed via recurring entries, NOT hourly tracking:
   - FileMaker: `UPDATE dapiRecords SET f_billed = "0" WHERE _projectID = project.__ID`
   - Supabase: `UPDATE time_entries SET is_billed = false WHERE project_id = project.id`
   - Rationale: Subscription billing is independent of time tracking

8. **Edge Cases**:
   - **Future Start Date**: If `dateStart > today`, do NOT create any sales entries yet
   - **No End Date**: Perpetual subscription, generate entries up to today only
     - Requires monthly background job to continue generating entries
     - Cron job checks active subscriptions and creates next month's entry
   - **End Date in Future**: Generate entries from start to today, stop at `dateEnd`
   - **End Date in Past**: Generate all entries from start to end (historical subscription)
   - **Value Changes**: Future entries use new value, past entries remain unchanged
   - **Date Range Updates**:
     - If `dateEnd` extended: Generate new entries for extended period
     - If `dateEnd` shortened: Stop generating, do not retroactively delete entries

9. **Background Job Requirement**:
   For perpetual subscriptions (no `dateEnd`) or subscriptions with future end dates, a monthly cron job is required:
   ```javascript
   // Monthly cron job (runs on 1st of each month)
   const activeSubscriptions = await query(`
     SELECT * FROM projects
     WHERE f_subscription = "1"
       AND (dateEnd IS NULL OR dateEnd >= today)
       AND dateStart <= today
   `);

   for (const project of activeSubscriptions) {
     const currentMonthDate = calculateNextBillingDate(project.dateStart, today);
     const existingEntry = await findSalesEntry(project._custID, currentMonthDate);

     if (!existingEntry) {
       await createSalesEntry({
         customer_id: project._custID,
         amount: project.value,
         date: currentMonthDate,
         description: `${project.projectName} - Monthly Subscription`,
         type: "sales"
       });
     }
   }
   ```

10. **FileMaker vs Supabase Implementation**:
    - **FileMaker Field**: `f_subscription` (TEXT "1" or "0")
    - **Supabase Field**: `is_subscription` (BOOLEAN true/false)
    - **Conversion**: `value === "1" || value === 1` → `true`, otherwise `false`
    - **Storage**: Supabase has NO `is_subscription` column yet (requires backend schema change)

11. **Testing Checklist**:
    - [ ] Subscription project with past start date creates sales entries for all past months
    - [ ] Subscription project with future start date creates NO sales entries yet
    - [ ] Monthly entries stop at end date if provided
    - [ ] Monthly entries continue up to today if no end date
    - [ ] Idempotency check prevents duplicate sales entries
    - [ ] Sales entries use correct date (same day of month as start date)
    - [ ] Sales entry amount equals project value (NOT split like fixed-price)
    - [ ] Time records for subscription project marked as non-billable
    - [ ] Cannot create project with both f_fixedPrice="1" AND f_subscription="1"
    - [ ] Value changes only affect future entries, not past entries

**Code References**:
- Business Logic: `src/services/projectService.js:508-596` (processProjectValue function)
- API Contracts: `requirements/projects/api-contracts.md:1556-1593` (Subscription Sales Generation)
- FileMaker API: `src/api/projects.js:112-144` (createProject, updateProject)

### Date Fields

| FileMaker Field | Type | Format | Description | Sample Value |
|----------------|------|--------|-------------|--------------|
| `dateStart` | Date | MM/DD/YYYY | Project start date | `"01/15/2024"` |
| `dateEnd` | Date | MM/DD/YYYY | Project end date | `"03/31/2024"` |

### System Fields

| FileMaker Field | Type | Auto-Managed | Description | Sample Value |
|----------------|------|--------------|-------------|--------------|
| `~creationTimestamp` | Timestamp | ✅ Yes | Record creation timestamp | `"2024-01-15T10:30:00"` |
| `~modificationTimestamp` | Timestamp | ✅ Yes | Last modification timestamp | `"2024-02-01T14:45:00"` |

### Potential Additional Fields (Unverified)

These fields may exist but are not currently used in the frontend code:

| Potential Field | Expected Type | Purpose |
|----------------|---------------|---------|
| `description` | Text (Long) | Project description/details |
| `priority` | Text/Number | Priority level (High, Medium, Low) |
| `budget` | Number | Budget amount |
| `actualCost` | Number | Actual cost incurred |
| `notes_internal` | Text (Long) | Internal project notes |

**Action Required**: Complete field audit from FileMaker layout definition.

## Supabase projects Table Schema

**Actual Schema** (Verified 2025-01-10 via SSH):

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id VARCHAR(255) NOT NULL,            -- Maps to _custID
  name VARCHAR(255) NOT NULL,                   -- Maps to projectName
  description TEXT,                             -- May not exist in FM
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- Maps to status (enum constraint)
  start_date DATE,                              -- Maps to dateStart (convert format)
  target_end_date DATE,                         -- Maps to dateEnd (convert format)
  actual_end_date DATE,                         -- No FM equivalent
  budget DECIMAL(10,2),                         -- Maps to value (convert from text)
  github_repo_url TEXT,                         -- No FM equivalent
  project_link TEXT,                            -- No FM equivalent
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),-- Maps to ~creationTimestamp
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),-- Maps to ~modificationTimestamp
  created_by VARCHAR(255),                      -- No FM equivalent

  CONSTRAINT projects_status_check CHECK (
    status IN ('active', 'pending', 'on_hold', 'completed', 'cancelled')
  )
);

CREATE INDEX idx_projects_customer_id ON projects(customer_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at);

-- Referenced by:
-- TABLE proposals FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
-- TABLE service_agreements FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
```

**Schema Notes**:
1. **customer_id** is VARCHAR(255), not UUID - accepts both UUIDs and text IDs
2. **No organization_id** - must be derived from customer relationship
3. **No team_id** - team assignment not in Supabase schema
4. **No is_fixed_price/is_subscription** - pricing logic handled elsewhere (customer_sales table)
5. **Status values differ**: FileMaker uses "Open", "Active", "On Hold", "Completed", "Cancelled"; Supabase uses lowercase with underscores
6. **Additional fields**: github_repo_url, project_link, actual_end_date, created_by (not in FileMaker)

## FileMaker devProjectObjectives Layout Fields

**Layout**: `devProjectObjectives`
**Purpose**: Stores project objectives/goals/milestones
**Relationship**: Many objectives per project (one-to-many with devProjects)

### Core Fields

| FileMaker Field | Type | Required | Description | Sample Value | Code Reference |
|----------------|------|----------|-------------|--------------|----------------|
| `__ID` | Text (UUID) | Auto | Objective UUID | `"uuid-obj-123"` | projectService.js:116 |
| `recordId` | Number | Auto | FM internal record ID | `"10"` | projectService.js:117 |
| `_projectID` | Text (UUID) | ✅ Yes | Project ID (FK to devProjects.__ID) | `"uuid-project-456"` | projectService.js:114, useProject.js:527 |
| `projectObjective` | Text | ✅ Yes | Objective text/description | `"Complete homepage design"` | projectService.js:118, useProject.js:528 |
| `status` | Text | No | Objective status | `"Open"`, `"In Progress"`, `"Completed"` | projectService.js:119, useProject.js:529 |
| `order` | Number | No | Display order (sorted ascending) | `1`, `2`, `3` | projectService.js:120 |
| `f_completed` | Text | No | Completion flag ("1" = yes, "0" = no) | `"1"` | projectService.js:121, useProject.js:530 |

**Business Rules** (Code: useProject.js:520-552):
1. Default status is "Open" when created
2. Default f_completed is "0" (not completed) when created
3. Objectives sorted by `order` field ascending (projectService.js:124)
4. Frontend filters objectives by `_projectID` (projectService.js:114)
5. Completion flag stored as string "1"/"0" in FileMaker, converted to boolean in frontend

**API Operations** (Code: src/api/projects.js:201-213):
- **Create**: `createObjective(objectiveData)` → FileMaker CREATE on devProjectObjectives layout
- **Read**: `fetchProjectRelatedData(projectId, 'devProjectObjectives')` → Query by `_projectID`
- **Update**: Not implemented in current codebase (manual FileMaker update)
- **Delete**: Not implemented in current codebase (manual FileMaker delete)

**Frontend Processing** (Code: projectService.js:108-125):
```javascript
{
  id: obj.fieldData.__ID,
  recordId: obj.recordId,
  objective: obj.fieldData.projectObjective,
  status: obj.fieldData.status || 'Open',
  order: obj.fieldData.order || 0,
  completed: obj.fieldData.f_completed === 1 || obj.fieldData.f_completed === "1",
  steps: processObjectiveSteps(steps, obj.fieldData.__ID)
}
```

**Relationship to Steps**:
- One objective has many steps (one-to-many with devProjectObjSteps)
- Steps filtered by `_objectiveID === objective.__ID` (projectService.js:139)
- Steps embedded in objective object as `steps` array (projectService.js:122)

## Supabase project_objectives Table Schema

**Status**: ⚠️ **TABLE DOES NOT EXIST IN SUPABASE** (Verified 2025-01-10)

**Current State**:
- Only `projects` table exists in Supabase
- No project_objectives table - must be created for migration
- FileMaker devProjectObjectives data cannot be migrated without this table

**Proposed Schema** (Based on FileMaker structure and frontend usage):

```sql
CREATE TABLE project_objectives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  objective TEXT NOT NULL,                      -- Maps to projectObjective
  status TEXT DEFAULT 'Open',                   -- Maps to status
  order_num INTEGER DEFAULT 0,                  -- Maps to order (renamed to avoid SQL keyword)
  completed BOOLEAN DEFAULT false,              -- Maps to f_completed (convert "1"/"0" → boolean)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_project_objectives_project ON project_objectives(project_id);
CREATE INDEX idx_project_objectives_order ON project_objectives(project_id, order_num);
CREATE INDEX idx_project_objectives_status ON project_objectives(status);
```

**Field Mapping**:

| FileMaker Field | Supabase Column | Type Conversion | Notes |
|----------------|-----------------|-----------------|-------|
| `__ID` | `id` | UUID → UUID | Preserve UUID (no conversion) |
| `recordId` | ❌ DISCARD | N/A | FileMaker internal ID, not needed |
| `_projectID` | `project_id` | UUID → UUID | Foreign key constraint to projects(id) |
| `projectObjective` | `objective` | Text → TEXT | Direct mapping |
| `status` | `status` | Text → TEXT | Direct mapping, default "Open" |
| `order` | `order_num` | Number → INTEGER | Renamed to avoid SQL keyword conflict |
| `f_completed` | `completed` | String "1"/"0" → BOOLEAN | Convert: "1" → true, "0" → false |
| N/A | `created_at` | N/A | Auto-generated timestamp |
| N/A | `updated_at` | N/A | Auto-generated timestamp |

**Migration Impact**:
1. ⚠️ **BLOCKING**: This table must be created before migrating objectives from FileMaker
2. Foreign key constraint requires projects table to exist first (✅ already exists)
3. Migration must preserve `__ID` as `id` to maintain relationship with objective steps
4. See BACKEND_CHANGE_REQUEST document for table creation SQL

**Migration Order Dependencies**:
1. ✅ Projects table (already exists)
2. ⚠️ Create project_objectives table (REQUIRED)
3. ⚠️ Create project_objective_steps table (depends on project_objectives)
4. Migrate data: projects → project_objectives → project_objective_steps

## FileMaker devProjectObjSteps Layout Fields

**Layout**: `devProjectObjSteps`
**Purpose**: Stores individual steps/tasks within project objectives
**Relationship**: Many steps per objective (one-to-many with devProjectObjectives)

### Core Fields

| FileMaker Field | Type | Required | Description | Sample Value | Code Reference |
|----------------|------|----------|-------------|--------------|----------------|
| `__ID` | Text (UUID) | Auto | Step UUID | `"uuid-step-789"` | projectService.js:141 |
| `recordId` | Number | Auto | FM internal record ID | `"25"` | projectService.js:142 |
| `_objectiveID` | Text (UUID) | ✅ Yes | Objective ID (FK to devProjectObjectives.__ID) | `"uuid-obj-123"` | projectService.js:139, projects.js:102 |
| `projectObjectiveStep` | Text | ✅ Yes | Step text/description | `"Create wireframes"` | projectService.js:143 |
| `order` | Number | No | Display order within objective (sorted ascending) | `1`, `2`, `3` | projectService.js:144 |
| `f_completed` | Text | No | Completion flag ("1" = yes, "0" = no) | `"0"` | projectService.js:145 |

**Business Rules** (Code: projectService.js:133-148):
1. Default f_completed is "0" (not completed) when created
2. Steps sorted by `order` field ascending (projectService.js:147)
3. Frontend filters steps by `_objectiveID` (projectService.js:139)
4. Completion flag stored as string "1"/"0" in FileMaker, converted to boolean in frontend (projectService.js:145)
5. Steps are ALWAYS nested within objectives - no standalone steps

**API Operations** (Code: src/api/projects.js:61-84):
- **Create**: No create function exists - must be implemented
- **Read**: `fetchProjectRelatedData(projectId, 'devProjectObjSteps')` → Query by `_projectID` (fetches ALL steps for project, filtered client-side)
- **Update**: Not implemented in current codebase (manual FileMaker update)
- **Delete**: Not implemented in current codebase (manual FileMaker delete)

**Frontend Processing** (Code: projectService.js:133-148):
```javascript
// processObjectiveSteps(steps, objectiveId)
{
  id: step.fieldData.__ID,
  recordId: step.recordId,
  step: step.fieldData.projectObjectiveStep,
  order: step.fieldData.order || 0,
  completed: step.fieldData.f_completed === "1"
}
```

**Data Fetching Pattern** (Code: useProject.js:99-102, current-implementation.md:99):
- Steps fetched in parallel with objectives
- `fetchProjectRelatedData([projectId], 'devProjectObjSteps')` returns ALL steps for project
- Client-side filtering by `_objectiveID` in `processObjectiveSteps()` (projectService.js:139)
- Steps embedded in parent objective object as `steps` array (projectService.js:122-123)

**Relationship to Objectives**:
- One objective has many steps (one-to-many)
- Steps filtered by `_objectiveID === objective.__ID`
- Steps are always displayed within their parent objective
- No orphaned steps allowed (CASCADE delete when objective is deleted)

## Supabase project_objective_steps Table Schema

**Status**: ⚠️ **TABLE DOES NOT EXIST IN SUPABASE** (Verified 2025-01-10)

**Current State**:
- Only `projects` table exists in Supabase
- No project_objective_steps table - must be created for migration
- FileMaker devProjectObjSteps data cannot be migrated without this table
- **BLOCKING**: Depends on project_objectives table being created first

**Proposed Schema** (Based on FileMaker structure and frontend usage):

```sql
CREATE TABLE project_objective_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  objective_id UUID REFERENCES project_objectives(id) ON DELETE CASCADE NOT NULL,
  step TEXT NOT NULL,                           -- Maps to projectObjectiveStep
  order_num INTEGER DEFAULT 0,                  -- Maps to order (renamed to avoid SQL keyword)
  completed BOOLEAN DEFAULT false,              -- Maps to f_completed (convert "1"/"0" → boolean)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_project_steps_objective ON project_objective_steps(objective_id);
CREATE INDEX idx_project_steps_order ON project_objective_steps(objective_id, order_num);
CREATE INDEX idx_project_steps_completed ON project_objective_steps(completed);
```

**Field Mapping**:

| FileMaker Field | Supabase Column | Type Conversion | Notes |
|----------------|-----------------|-----------------|-------|
| `__ID` | `id` | UUID → UUID | Preserve UUID (no conversion) |
| `recordId` | ❌ DISCARD | N/A | FileMaker internal ID, not needed |
| `_objectiveID` | `objective_id` | UUID → UUID | Foreign key constraint to project_objectives(id) |
| `projectObjectiveStep` | `step` | Text → TEXT | Direct mapping |
| `order` | `order_num` | Number → INTEGER | Renamed to avoid SQL keyword conflict, default 0 |
| `f_completed` | `completed` | String "1"/"0" → BOOLEAN | Convert: "1" → true, "0" → false, default false |
| N/A | `created_at` | N/A | Auto-generated timestamp |
| N/A | `updated_at` | N/A | Auto-generated timestamp |

**Migration Impact**:
1. ⚠️ **BLOCKING**: This table must be created AFTER project_objectives table
2. Foreign key constraint requires project_objectives table to exist first
3. Migration must preserve `__ID` as `id` to maintain UUID consistency
4. Steps must be migrated AFTER objectives to ensure valid foreign keys
5. Order preservation is critical for user experience (steps displayed in order)
6. See BACKEND_CHANGE_REQUEST document for table creation SQL

**Migration Order Dependencies**:
1. ✅ Projects table (already exists)
2. ⚠️ Create project_objectives table (REQUIRED - depends on projects)
3. ⚠️ Create project_objective_steps table (REQUIRED - depends on project_objectives)
4. Migrate data: projects → project_objectives → project_objective_steps (in order)

**Nested Relationship Structure**:
```
Project
  └─ Objective 1 (order: 1)
      ├─ Step 1 (order: 1, completed: false)
      ├─ Step 2 (order: 2, completed: true)
      └─ Step 3 (order: 3, completed: false)
  └─ Objective 2 (order: 2)
      ├─ Step 1 (order: 1, completed: true)
      └─ Step 2 (order: 2, completed: true)
```

**Query Pattern for Frontend**:
```sql
-- Fetch all steps for a specific objective
SELECT * FROM project_objective_steps
WHERE objective_id = 'uuid-obj-123'
ORDER BY order_num ASC;

-- Fetch all objectives with steps for a project (requires JOIN)
SELECT
  po.id, po.objective, po.order_num, po.completed AS objective_completed,
  pos.id AS step_id, pos.step, pos.order_num AS step_order, pos.completed AS step_completed
FROM project_objectives po
LEFT JOIN project_objective_steps pos ON pos.objective_id = po.id
WHERE po.project_id = 'uuid-project-456'
ORDER BY po.order_num ASC, pos.order_num ASC;
```

## FileMaker devProjectImages Layout Fields

**Layout**: `devProjectImages`
**Purpose**: Stores image attachments and screenshots for projects
**Relationship**: Many images per project (one-to-many with devProjects)

### Core Fields

| FileMaker Field | Type | Required | Description | Sample Value | Code Reference |
|----------------|------|----------|-------------|--------------|----------------|
| `__ID` | Text (UUID) | Auto | Image UUID | `"uuid-img-111"` | projectService.js:72 |
| `recordId` | Number | Auto | FM internal record ID | `"5"` | projectService.js:73 |
| `_fkID` | Text (UUID) | ✅ Yes | Polymorphic FK (project ID in this context) | `"uuid-project-456"` | current-implementation.md:1500 |
| `url` | Text (URL) | ✅ Yes | Image URL or path | `"https://example.com/image.png"` | projectService.js:74 |
| `title` | Text | No | Image title | `"Homepage Mockup"` | projectService.js:75 |
| `description` | Text | No | Image description | `"Initial design concept"` | projectService.js:76 |

### Additional Fields (From FileMaker Schema)

The following fields exist in the FileMaker `projectImages` table schema but are NOT currently used by the frontend application:

| FileMaker Field | Type | Description | Status |
|----------------|------|-------------|--------|
| `file` | Binary (4096) | File data (possibly deprecated) | ❌ Not used in frontend |
| `fileName` | Text | Original filename | ❌ Not used in frontend |
| `image` | Binary (4096) | Image binary data | ❌ Not used in frontend |
| `image_base64` | Text | Base64 encoded image | ❌ Not used in frontend |
| `image_thm` | Binary (4096) | Thumbnail image | ❌ Not used in frontend |
| `f_processed` | Text | Processing flag | ❌ Not used in frontend |
| `~creationTimestamp` | Timestamp | Record creation timestamp | ✅ Available but not used |
| `~modificationTimestamp` | Timestamp | Last modification timestamp | ✅ Available but not used |
| `~createdBy` | Text | Account name who created record | ✅ Available but not used |
| `~modifiedBy` | Text | Account name who modified record | ✅ Available but not used |

**Important Notes**:
1. **Storage Model Discrepancy**: FileMaker schema shows binary fields (file, image, image_base64, image_thm), but frontend code ONLY uses the `url` field. This suggests images are stored externally (cloud storage, CDN) with URLs in FileMaker, NOT as binary data.
2. **Polymorphic Foreign Key**: `_fkID` has no entity type indicator - cannot distinguish if image belongs to project, customer, or other entity without context.
3. **Field Name Bug**: Frontend filter uses `_projectID` but FileMaker field is `_fkID` (see projectService.js:70 vs current-implementation.md:1500).

**Business Rules** (Code: projectService.js:64-78):
1. Images fetched via `_fkID = projectId` query
2. Client-side filtering by `_projectID === projectId` (NOTE: This appears to be checking wrong field name - should be `_fkID`)
3. Empty title/description default to empty string ''
4. No ordering specified - images displayed in FileMaker retrieval order

**API Operations** (Code: src/api/projects.js:61-84, src/hooks/useProject.js:99):
- **Create**: Not implemented in current codebase (manual FileMaker upload)
- **Read**: `fetchProjectRelatedData([projectId], 'devProjectImages')` → Query by `_fkID`
- **Update**: Not implemented in current codebase (manual FileMaker update)
- **Delete**: Not implemented in current codebase (manual FileMaker delete)

**Frontend Processing** (Code: projectService.js:64-78):
```javascript
// processProjectImages(images, projectId)
{
  id: img.fieldData.__ID,
  recordId: img.recordId,
  url: img.fieldData.url,
  title: img.fieldData.title || '',
  description: img.fieldData.description || ''
}
```

**Query Pattern**:
```javascript
// Fetch images for a project
{
  layout: 'devProjectImages',
  action: 'read',
  query: [{ "_fkID": "project-uuid" }]
}
```

**Storage Considerations for Migration**:
1. **Image Location**: Images are referenced by URL, NOT stored in database as binary
2. **Potential Storage Locations**:
   - FileMaker container fields with external storage
   - Third-party cloud storage (AWS S3, Cloudflare R2, etc.)
   - CDN URLs
3. **Migration Strategy**: URLs can be preserved as-is during migration to Supabase
4. **Future Enhancement**: Consider Supabase Storage for new image uploads

## Supabase project_images Table Schema

**Status**: ⚠️ **TABLE DOES NOT EXIST IN SUPABASE** (Verified 2025-01-10)

**Current State**:
- Only `projects` table exists in Supabase
- No project_images table - must be created for migration
- FileMaker devProjectImages data cannot be migrated without this table
- Images currently stored in FileMaker only with URL references

**Proposed Schema** (Based on FileMaker structure and frontend usage):

```sql
CREATE TABLE project_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,  -- Maps to _fkID
  url TEXT NOT NULL,                            -- Maps to url (primary image reference)
  title TEXT,                                   -- Maps to title
  description TEXT,                             -- Maps to description
  file_name TEXT,                               -- Maps to fileName (if migrated)
  storage_provider TEXT,                        -- Future: 'filemaker', 'supabase', 's3', 'cloudflare', etc.
  created_at TIMESTAMPTZ DEFAULT now(),         -- Maps to ~creationTimestamp
  updated_at TIMESTAMPTZ DEFAULT now(),         -- Maps to ~modificationTimestamp
  created_by TEXT,                              -- Maps to ~createdBy
  modified_by TEXT                              -- Maps to ~modifiedBy
);

CREATE INDEX idx_project_images_project ON project_images(project_id);
CREATE INDEX idx_project_images_created_at ON project_images(created_at);
```

**Field Mapping**:

| FileMaker Field | Supabase Column | Type Conversion | Notes |
|----------------|-----------------|-----------------|-------|
| `__ID` | `id` | UUID → UUID | Preserve UUID (no conversion) |
| `recordId` | ❌ DISCARD | N/A | FileMaker internal ID, not needed |
| `_fkID` | `project_id` | UUID → UUID | Foreign key constraint to projects(id) |
| `url` | `url` | Text → TEXT | Direct mapping (NOT NULL) |
| `title` | `title` | Text → TEXT | Direct mapping, nullable |
| `description` | `description` | Text → TEXT | Direct mapping, nullable |
| `fileName` | `file_name` | Text → TEXT | Optional - not used in frontend |
| `~creationTimestamp` | `created_at` | Timestamp → TIMESTAMPTZ | Auto-generated on migration |
| `~modificationTimestamp` | `updated_at` | Timestamp → TIMESTAMPTZ | Auto-generated on migration |
| `~createdBy` | `created_by` | Text → TEXT | Optional - FileMaker account name |
| `~modifiedBy` | `modified_by` | Text → TEXT | Optional - FileMaker account name |
| `file` | ❌ DISCARD | N/A | Binary data not used (images stored externally) |
| `image` | ❌ DISCARD | N/A | Binary data not used |
| `image_base64` | ❌ DISCARD | N/A | Not used in frontend |
| `image_thm` | ❌ DISCARD | N/A | Thumbnail not used |
| `f_processed` | ❌ DISCARD | N/A | Processing flag not needed |
| N/A | `storage_provider` | N/A | New field for tracking image source |

**Migration Impact**:
1. ⚠️ **BLOCKING**: This table must be created before migrating images from FileMaker
2. Foreign key constraint requires projects table to exist first (✅ already exists)
3. Migration must preserve `__ID` as `id` to maintain UUID consistency
4. Binary fields (file, image, image_thm) are DISCARDED - only URL preserved
5. All image URLs must remain valid after migration (external storage must be accessible)
6. See BACKEND_CHANGE_REQUEST document for table creation SQL

**Migration Order Dependencies**:
1. ✅ Projects table (already exists)
2. ⚠️ Create project_images table (REQUIRED)
3. Migrate data: projects → project_images
4. Validate all URLs are accessible and valid

**Storage Migration Considerations**:

1. **URL Preservation Strategy**:
   - Verify all URLs are accessible before migration
   - Identify broken/dead links (404 errors)
   - Document URL patterns to identify storage provider
   - Example patterns:
     - FileMaker: `https://server.claritybusinesssolutions.ca/Streaming_SSL/MainDB/...`
     - AWS S3: `https://s3.amazonaws.com/bucket/...`
     - Cloudflare R2: `https://cloudflare.com/...`

2. **Binary Data Migration** (If FileMaker has embedded images):
   - Check if `image` or `file` fields contain actual binary data
   - If yes, extract binary data and upload to Supabase Storage
   - Generate new Supabase Storage URLs
   - Update `url` field with new Supabase Storage URL
   - Populate `storage_provider = 'supabase'`

3. **Thumbnail Generation** (Future Enhancement):
   - Supabase Storage supports on-the-fly image transformations
   - Can generate thumbnails via URL parameters (e.g., `?width=200&height=200`)
   - No need to store separate thumbnail binaries

4. **Access Control**:
   - If images contain sensitive data, use Supabase Storage RLS policies
   - Public images: No authentication required
   - Private images: Require authenticated user + project access verification

**Query Pattern for Frontend**:
```sql
-- Fetch all images for a specific project
SELECT * FROM project_images
WHERE project_id = 'uuid-project-456'
ORDER BY created_at DESC;

-- Fetch images with project info (JOIN)
SELECT
  pi.id, pi.url, pi.title, pi.description, pi.created_at,
  p.name AS project_name, p.status AS project_status
FROM project_images pi
JOIN projects p ON p.id = pi.project_id
WHERE pi.project_id = 'uuid-project-456'
ORDER BY pi.created_at DESC;
```

**Current Workaround**: Images stored in FileMaker only, fetched via fm-gofer bridge using `_fkID` polymorphic foreign key.

## FileMaker devProjectLinks Layout Fields

**Layout**: `devProjectLinks`
**Purpose**: Stores external URLs/resources associated with projects (GitHub repos, documentation, designs, etc.)
**Relationship**: Many links per project (one-to-many with devProjects)

### Core Fields

| FileMaker Field | Type | Required | Description | Sample Value | Code Reference |
|----------------|------|----------|-------------|--------------|----------------|
| `__ID` | Text (UUID) | Auto | Link UUID | `"uuid-link-222"` | projectService.js:94 |
| `recordId` | Number | Auto | FM internal record ID | `"8"` | projectService.js:95 |
| `_fkID` | Text (UUID) | ✅ Yes | Polymorphic FK (project ID in this context) | `"uuid-project-456"` | projectService.js:92, links.js:18 |
| `link` | Text (URL) | ✅ Yes | URL | `"https://github.com/client/repo"` | projectService.js:96, links.js:17 |
| `title` | Text | No | Link title/description | `"GitHub Repository"` | projectService.js:97 |

### Additional Fields (From FileMaker Schema - NOT USED)

| FileMaker Field | Type | Description | Status |
|----------------|------|-------------|--------|
| `~creationTimestamp` | Timestamp | Record creation timestamp | ✅ Available but not used in frontend |
| `~modificationTimestamp` | Timestamp | Last modification timestamp | ✅ Available but not used in frontend |
| `~createdBy` | Text | Account name who created record | ✅ Available but not used in frontend |
| `~modifiedBy` | Text | Account name who modified record | ✅ Available but not used in frontend |

**Business Rules** (Code: projectService.js:86-98):
1. Links filtered by `_fkID === projectId` (polymorphic foreign key)
2. **Title derivation**: If `title` field is empty, derive from URL hostname (line 97)
   - Example: `"https://github.com/user/repo"` → `"github.com"`
3. Links displayed in FileMaker retrieval order (no explicit sorting)
4. GitHub integration: Detects GitHub URLs, checks if repo exists, offers to create new repos (ProjectLinksTab.jsx:144-159)

**API Operations**:

| Operation | Code Reference | Method | Layout |
|-----------|---------------|--------|--------|
| **Create** | links.js:8-29 | `createLink({ fkId, link })` | `devLinks` |
| **Read** | projects.js:61-84, useProject.js:100 | `fetchProjectRelatedData([projectId], 'devProjectLinks')` | `devProjectLinks` |
| **Update** | ❌ Not implemented | N/A | N/A |
| **Delete** | ❌ Not implemented | N/A | N/A |

**Frontend Processing** (Code: projectService.js:86-98):
```javascript
// processProjectLinks(links, projectId)
{
  id: link.fieldData.__ID,
  recordId: link.recordId,
  url: link.fieldData.link,
  title: link.fieldData.title || new URL(link.fieldData.link).hostname
}
```

**Create Link API Call** (Code: links.js:8-29):
```javascript
// FileMaker request
{
  layout: 'devLinks',           // Note: Uses devLinks, not devProjectLinks
  action: 'create',
  fieldData: {
    link: data.url || data.link,
    _fkID: data.project_id || data.fkId
    // Note: title field NOT supported by backend - cannot be set during creation
  }
}
```

**UI Components**:
- **ProjectLinksTab.jsx**: Main links display and creation interface
  - Lists all links for a project with title and URL
  - "New Link" button triggers TextInput for URL entry
  - GitHub URL detection with repo existence check
  - Optimistic UI updates (shows link immediately, reverts on error)
  - Opens GitHubRepositoryModal if repo doesn't exist (offers to create)

**Special Feature: GitHub Integration** (Code: ProjectLinksTab.jsx:144-159):
1. User enters GitHub URL: `https://github.com/owner/repo`
2. Frontend parses URL to extract owner/repo (githubUtils.js)
3. Checks if repository exists via GitHub API (github.js)
4. If repo doesn't exist:
   - Opens GitHubRepositoryModal with pre-filled owner/repo
   - User can create repo with description and visibility settings
   - After creation, link is added to project
5. If repo exists, link is added directly

**Query Pattern**:
```javascript
// Fetch links for a project
{
  layout: 'devProjectLinks',
  action: 'read',
  query: [{ "_fkID": "project-uuid" }]
}
```

**Polymorphic Foreign Key Issue**:
- `_fkID` has no entity type indicator
- Cannot distinguish if link belongs to project, customer, task, or other entity without context
- Frontend assumes `devProjectLinks` layout = project links
- Different layouts for different entities: `devProjectLinks` (projects), `devLinks` (tasks), etc.

## Supabase links Table Schema (Existing)

**Status**: ✅ **TABLE EXISTS IN SUPABASE** (Verified 2025-01-10 via SSH)

**Actual Schema**:

```sql
CREATE TABLE links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID,                              -- Maps to _fkID (for project links)
  link VARCHAR(2048) NOT NULL,                  -- Maps to link (URL field)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_links_customer_id ON links(customer_id);
CREATE INDEX idx_links_organization_id ON links(organization_id);
CREATE INDEX idx_links_project_id ON links(project_id);

FOREIGN KEY constraints:
- customer_id REFERENCES customers(id) ON DELETE CASCADE
- organization_id REFERENCES organizations(id) ON DELETE CASCADE
```

**Schema Analysis**:

### Key Differences from FileMaker

1. **✅ Table Exists**: Links table is already created in Supabase (unlike objectives/steps/images)
2. **❌ No title field**: Supabase has no `title` column - must derive from URL hostname
3. **❌ No polymorphic _fkID**: Uses explicit foreign keys (customer_id, project_id, organization_id)
4. **✅ project_id is nullable**: Allows customer-level links without project association
5. **⚠️ customer_id is NOT NULL**: All links MUST have a customer association
6. **⚠️ link field is VARCHAR(2048)**: Limited to 2048 characters (FileMaker has no limit)

### Field Mapping

| FileMaker Field | Supabase Column | Type Conversion | Notes |
|----------------|-----------------|-----------------|-------|
| `__ID` | `id` | UUID → UUID | Preserve UUID (no conversion) |
| `recordId` | ❌ DISCARD | N/A | FileMaker internal ID, not needed |
| `_fkID` | `project_id` | UUID → UUID | Nullable, NULL if link not project-specific |
| `link` | `link` | Text → VARCHAR(2048) | Direct mapping, validate length ≤ 2048 |
| `title` | ❌ NO COLUMN | N/A | **SCHEMA GAP**: Derive from URL hostname (see projectService.js:97) |
| N/A | `customer_id` | N/A | **REQUIRED**: Lookup from project.customer_id |
| N/A | `organization_id` | N/A | **REQUIRED**: Lookup from customer.organization_id |
| `~creationTimestamp` | `created_at` | Timestamp → TIMESTAMPTZ | Auto-generated on migration |
| `~modificationTimestamp` | `updated_at` | Timestamp → TIMESTAMPTZ | Auto-generated on migration |

### Schema Gaps

1. **Missing title field** (Code Impact: projectService.js:97)
   - FileMaker stores optional `title` field for link descriptions
   - Supabase has no `title` column - frontend derives from URL hostname
   - **Migration Impact**: Link titles will be lost during migration
   - **Workaround**: Frontend already handles missing titles by deriving from URL
   - **Recommendation**: Add `title TEXT` column to Supabase links table OR accept derived titles

2. **Required customer_id** (Migration Complexity)
   - Every link must be associated with a customer
   - For project links: `customer_id = project.customer_id`
   - Requires JOIN with projects table during migration
   - Orphaned links (projects with invalid customer_id) will fail insertion

3. **Link length limit** (Data Validation)
   - Supabase: VARCHAR(2048) max length
   - FileMaker: No explicit length limit
   - Migration must validate all URLs ≤ 2048 characters
   - URLs > 2048 chars will be truncated or fail insertion

### Migration Strategy for Links

**Step 1: Query FileMaker Links**
```javascript
// Fetch all project links from FileMaker
{
  layout: 'devProjectLinks',
  action: 'read',
  query: [{ "_fkID": "project-uuid" }]
}
```

**Step 2: Lookup Required Foreign Keys**
```sql
-- For each FileMaker link, get customer_id and organization_id
SELECT p.id AS project_id, p.customer_id, c.organization_id
FROM projects p
JOIN customers c ON c.id = p.customer_id
WHERE p.id = '<_fkID from FileMaker>';
```

**Step 3: Transform and Insert**
```javascript
// For each FileMaker link
const supabaseLinkData = {
  id: fmLink.fieldData.__ID,                     // Preserve UUID
  project_id: fmLink.fieldData._fkID,            // Project association
  customer_id: project.customer_id,              // Lookup from project (REQUIRED)
  organization_id: customer.organization_id,     // Lookup from customer
  link: fmLink.fieldData.link.slice(0, 2048),   // Truncate if needed
  created_at: fmLink.fieldData['~creationTimestamp'] || new Date(),
  updated_at: fmLink.fieldData['~modificationTimestamp'] || new Date()
  // Note: title field is LOST - frontend will derive from URL
};

await insert('links', supabaseLinkData);
```

**Step 4: Validate Migration**
```sql
-- Count migrated links by project
SELECT project_id, COUNT(*) AS link_count
FROM links
WHERE project_id IS NOT NULL
GROUP BY project_id
ORDER BY link_count DESC;

-- Find orphaned links (missing customer/organization)
SELECT id, link, project_id
FROM links
WHERE customer_id IS NULL OR organization_id IS NULL;

-- Check for truncated URLs (unlikely but possible)
SELECT id, LENGTH(link) AS url_length, link
FROM links
WHERE LENGTH(link) = 2048;
```

### Migration Validation Checklist

- [ ] All link UUIDs preserved (`__ID` → `id`)
- [ ] All project associations intact (`_fkID` → `project_id`)
- [ ] All customer_id fields populated (REQUIRED, must not be NULL)
- [ ] All organization_id fields populated from customer relationship
- [ ] No URLs exceed 2048 character limit
- [ ] Frontend still derives titles from URL hostnames (no title column)
- [ ] Links with invalid project_id handled (orphaned links)
- [ ] GitHub URLs still work with frontend GitHub integration
- [ ] Created/updated timestamps preserved

### Known Limitations After Migration

1. **Title Loss**: Link titles from FileMaker will be lost - frontend derives from URL hostname
2. **No Update/Delete**: Frontend doesn't implement link update/delete operations
3. **Polymorphic Constraint**: Supabase allows links to belong to customer, project, and organization simultaneously (no mutual exclusivity)
4. **URL Length**: URLs longer than 2048 characters will be truncated or rejected

### Recommended Backend Changes (Optional)

**Add title column** (preserves FileMaker data):
```sql
ALTER TABLE links
ADD COLUMN title TEXT;

CREATE INDEX idx_links_title ON links(title) WHERE title IS NOT NULL;
```

**Benefits**:
- Preserves custom link descriptions from FileMaker
- Reduces need for URL parsing to extract hostname
- Allows users to set meaningful names for links (e.g., "Production Server", "Design Mockups")

**Migration Impact**:
- If added BEFORE migration: Can preserve FileMaker titles
- If added AFTER migration: Titles permanently lost, must be re-entered manually

## FileMaker devNotes Layout Fields (Polymorphic)

**Layout**: `devNotes`
**Purpose**: Stores text notes associated with projects, customers, tasks, or other entities (polymorphic association)
**Relationship**: Many notes per entity (one-to-many with devProjects, devCustomers, devTasks, etc.)

### Core Fields

| FileMaker Field | Type | Required | Description | Sample Value | Code Reference |
|----------------|------|----------|-------------|--------------|----------------|
| `__ID` | Text (UUID) | Auto | Note UUID | `"uuid-note-333"` | noteService.js:34, ProjectNotesTab.jsx:49 |
| `recordId` | Number | Auto | FM internal record ID | `"15"` | noteService.js:35 |
| `_fkID` | Text (UUID) | ✅ Yes | Polymorphic FK (project/customer/task ID) | `"uuid-project-456"` | projects.js:54, notes.js:17 |
| `note` | Text (Long) | ✅ Yes | Note content/text | `"Discussed requirements with client"` | noteService.js:36, notes.js:16 |
| `type` | Text | No | Note type/category | `"general"`, `"meeting"`, `"follow-up"` | notes.js:18 |
| `~CreationTimestamp` | Timestamp | Auto | Record creation timestamp | `"2024-01-15T14:30:00"` | noteService.js:37 |
| `~CreatedBy` | Text | Auto | Account name who created record | `"admin"` | noteService.js:38 |

**Business Rules** (Code: noteService.js:27-41):
1. Notes filtered by `_fkID === entityId` (polymorphic foreign key)
2. No entity type indicator - context determined by which layout/query fetches the note
3. Notes sorted by creation timestamp descending (newest first) - line 40
4. Default note type is "general" if not specified - notes.js:18
5. Note content cannot be empty - must trim whitespace (noteService.js:11)

**API Operations**:

| Operation | Code Reference | Method | Layout | Query Field |
|-----------|---------------|--------|--------|-------------|
| **Create** | notes.js:8-24 | `createNote({ fkId, note, type })` | `devNotes` | N/A |
| **Read** | projects.js:47-59 | `fetchProjectNotes(projectId)` | `devNotes` | `_fkID` |
| **Update** | ❌ Not implemented | N/A | N/A | N/A |
| **Delete** | ❌ Not implemented | N/A | N/A | N/A |

**Frontend Processing** (Code: noteService.js:27-41):
```javascript
// processNotes(data)
{
  id: note.fieldData.__ID,
  recordId: note.recordID,
  content: note.fieldData.note,
  createdAt: note.fieldData['~CreationTimestamp'],
  createdBy: note.fieldData['~CreatedBy']
}
// Sorted by createdAt descending (newest first)
```

**Create Note API Call** (Code: notes.js:8-24):
```javascript
// FileMaker request
{
  layout: 'devNotes',
  action: 'create',
  fieldData: {
    note: "Note content text",
    _fkID: "entity-uuid",           // Project, customer, or task ID
    type: "general"                 // Optional: 'general', 'meeting', 'follow-up', etc.
  }
}
```

**Fetch Notes API Call** (Code: projects.js:47-59):
```javascript
// Fetch notes for a project
{
  layout: 'devNotes',
  action: 'read',
  query: [{ "_fkID": "project-uuid" }]
}
```

**UI Components**:
- **ProjectNotesTab.jsx**: Main notes display and creation interface
  - Lists all notes for a project with content, sorted newest first
  - "New Note" button triggers TextInput for note entry
  - Displays raw notes data without processing (useProject.js:114)
  - Note structure: `{ fieldData: { __ID, note } }` (ProjectNotesTab.jsx:49-55)
  - After creating note, reloads project details to fetch updated notes list

**Polymorphic Foreign Key Pattern**:
- `_fkID` has NO entity type indicator
- Entity type determined by context (which layout/component fetches the notes)
- Same devNotes layout used for ALL entities (projects, customers, tasks)
- Different API calls for different entities:
  - Projects: `fetchProjectNotes(projectId)` with `_fkID = projectId`
  - Tasks: Similar pattern (not shown in code)
  - Customers: Similar pattern (not shown in code)

**Data Structure in Frontend** (Code: useProject.js:114, ProjectNotesTab.jsx:47-56):
```javascript
// Raw notes data (not processed by noteService)
project.notes = [
  {
    fieldData: {
      __ID: "uuid-note-123",
      note: "Note content text",
      ~CreationTimestamp: "2024-01-15T14:30:00",
      ~CreatedBy: "admin"
    },
    recordId: "15"
  }
]
```

**Important Note**: The frontend displays raw `notes.response.data` without using `processNotes()` function (useProject.js:114). The `noteService.processNotes()` function exists but is NOT currently used for project notes.

## Supabase notes Table Schema (Planned)

**Status**: ⚠️ **TABLE DOES NOT EXIST IN SUPABASE** (Verified 2025-01-10)

**Current State**:
- No notes table exists in Supabase
- All notes currently stored in FileMaker devNotes layout only
- FileMaker uses polymorphic `_fkID` without entity type indicator
- Must create notes table in Supabase with explicit entity type tracking

**Proposed Schema** (Based on FileMaker structure and frontend usage):

```sql
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL,                    -- 'project', 'customer', 'task', etc.
  entity_id UUID NOT NULL,                      -- Maps to _fkID (polymorphic)
  note TEXT NOT NULL,                           -- Maps to note field
  type TEXT DEFAULT 'general',                  -- Maps to type field
  created_by TEXT,                              -- Maps to ~CreatedBy (FileMaker account name)
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),         -- Maps to ~CreationTimestamp
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notes_entity ON notes(entity_type, entity_id);
CREATE INDEX idx_notes_org ON notes(organization_id);
CREATE INDEX idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX idx_notes_type ON notes(type) WHERE type IS NOT NULL;

-- Add constraint for valid entity types
ALTER TABLE notes
ADD CONSTRAINT notes_entity_type_check
CHECK (entity_type IN ('project', 'customer', 'task', 'prospect', 'team'));
```

**Field Mapping**:

| FileMaker Field | Supabase Column | Type Conversion | Notes |
|----------------|-----------------|-----------------|-------|
| `__ID` | `id` | UUID → UUID | Preserve UUID (no conversion) |
| `recordId` | ❌ DISCARD | N/A | FileMaker internal ID, not needed |
| `_fkID` | `entity_id` | UUID → UUID | Polymorphic FK - entity determined by context |
| `note` | `note` | Text → TEXT | Direct mapping, NOT NULL |
| `type` | `type` | Text → TEXT | Direct mapping, default "general" |
| `~CreationTimestamp` | `created_at` | Timestamp → TIMESTAMPTZ | Auto-generated on migration |
| `~CreatedBy` | `created_by` | Text → TEXT | FileMaker account name |
| N/A | `entity_type` | N/A | **NEW FIELD**: Must be determined during migration |
| N/A | `organization_id` | N/A | **REQUIRED**: Lookup from entity's organization |
| N/A | `updated_at` | N/A | Auto-generated timestamp |

**Entity Type Determination Strategy**:

Since FileMaker's `_fkID` has NO entity type indicator, migration must determine entity type by:

1. **Join with projects table**:
   ```sql
   SELECT 'project' AS entity_type
   FROM notes n
   JOIN projects p ON p.id = n._fkID
   ```

2. **Join with customers table**:
   ```sql
   SELECT 'customer' AS entity_type
   FROM notes n
   JOIN customers c ON c.id = n._fkID
   ```

3. **Join with tasks table** (if exists):
   ```sql
   SELECT 'task' AS entity_type
   FROM notes n
   JOIN tasks t ON t.id = n._fkID
   ```

4. **Fallback**: If `_fkID` doesn't match any entity, note is orphaned (skip or log error)

**Migration Impact**:
1. ⚠️ **BLOCKING**: This table must be created before migrating notes from FileMaker
2. Foreign key constraints require related tables to exist first (projects, customers, tasks)
3. Migration must preserve `__ID` as `id` to maintain UUID consistency
4. **Entity type determination is complex** - requires JOINs with multiple tables to identify entity type
5. Orphaned notes (invalid `_fkID`) must be handled (skip or log)
6. Organization ID must be derived from parent entity's organization
7. See BACKEND_CHANGE_REQUEST document for table creation SQL

**Migration Order Dependencies**:
1. ✅ Projects table (already exists)
2. ✅ Customers table (assumed to exist)
3. ❓ Tasks table (verify existence)
4. ⚠️ Create notes table (REQUIRED)
5. Migrate data: Determine entity type → insert with entity_type + entity_id

**Migration Strategy for Project Notes**:

```javascript
// Step 1: Fetch all notes from FileMaker devNotes
const allNotes = await fetchAllNotes(); // Fetch from devNotes layout

// Step 2: For each note, determine entity type by checking _fkID against entity tables
for (const note of allNotes) {
  const fkId = note.fieldData._fkID;

  // Check if _fkID is a project ID
  const project = await supabase
    .from('projects')
    .select('id, customer_id')
    .eq('id', fkId)
    .single();

  if (project.data) {
    // Note belongs to a project
    const customer = await supabase
      .from('customers')
      .select('organization_id')
      .eq('id', project.data.customer_id)
      .single();

    await supabase.from('notes').insert({
      id: note.fieldData.__ID,
      entity_type: 'project',
      entity_id: fkId,
      note: note.fieldData.note,
      type: note.fieldData.type || 'general',
      created_by: note.fieldData['~CreatedBy'],
      organization_id: customer.data.organization_id,
      created_at: note.fieldData['~CreationTimestamp'],
      updated_at: note.fieldData['~CreationTimestamp']
    });
    continue;
  }

  // Check if _fkID is a customer ID
  const customer = await supabase
    .from('customers')
    .select('id, organization_id')
    .eq('id', fkId)
    .single();

  if (customer.data) {
    // Note belongs to a customer
    await supabase.from('notes').insert({
      id: note.fieldData.__ID,
      entity_type: 'customer',
      entity_id: fkId,
      note: note.fieldData.note,
      type: note.fieldData.type || 'general',
      created_by: note.fieldData['~CreatedBy'],
      organization_id: customer.data.organization_id,
      created_at: note.fieldData['~CreationTimestamp'],
      updated_at: note.fieldData['~CreationTimestamp']
    });
    continue;
  }

  // Add similar checks for tasks, prospects, etc.

  // If no match found, log orphaned note
  console.warn(`Orphaned note: ${note.fieldData.__ID}, _fkID: ${fkId}`);
}
```

**Query Pattern for Frontend**:

```sql
-- Fetch all notes for a specific project
SELECT *
FROM notes
WHERE entity_type = 'project'
  AND entity_id = 'uuid-project-456'
ORDER BY created_at DESC;

-- Fetch notes with creator info (if users table exists)
SELECT
  n.id, n.note, n.type, n.created_at, n.created_by,
  p.name AS project_name
FROM notes n
JOIN projects p ON p.id = n.entity_id
WHERE n.entity_type = 'project'
  AND n.entity_id = 'uuid-project-456'
ORDER BY n.created_at DESC;

-- Count notes by entity type
SELECT entity_type, COUNT(*) AS note_count
FROM notes
GROUP BY entity_type
ORDER BY note_count DESC;
```

**Frontend API Changes Required**:

After migration, frontend must be updated to:
1. Query Supabase notes table with `entity_type` and `entity_id` filters
2. Use `processNotes()` function for consistent data formatting (currently not used - useProject.js:114)
3. Update ProjectNotesTab.jsx to handle Supabase note structure:
   ```javascript
   // Current FileMaker structure
   note.fieldData.__ID
   note.fieldData.note

   // New Supabase structure
   note.id
   note.note
   ```

**Alternative Schema: Dedicated project_notes Table**

Instead of polymorphic notes table, could use dedicated `project_notes` table:

```sql
CREATE TABLE project_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  note TEXT NOT NULL,
  type TEXT DEFAULT 'general',
  created_by TEXT,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Pros**:
- Simpler queries (no entity_type filter needed)
- Stronger foreign key constraint (direct reference to projects)
- Better performance (fewer rows in table, no entity_type checks)

**Cons**:
- Requires separate tables for customer_notes, task_notes, etc.
- More tables to maintain
- Code duplication for each entity type

**Recommendation**: Use **polymorphic notes table** with entity_type + entity_id pattern to match FileMaker's polymorphic `_fkID` approach and reduce code duplication

## FileMaker dapiRecords Layout Fields (Time Tracking)

**Layout**: `dapiRecords` (also referenced as `devRecords` in some documentation)
**Constant**: `Layouts.RECORDS` in fileMaker.js:415
**Purpose**: Stores billable time tracking entries for projects and customers
**Relationship**: Many time records per project (one-to-many with devProjects via `_projectID`)

### Core Fields

| FileMaker Field | Type | Required | Description | Sample Value | Code Reference |
|----------------|------|----------|-------------|--------------|----------------|
| `__ID` | Text (UUID) | Auto | Record UUID | `"uuid-rec-444"` | billableHoursService.js:77 |
| `recordId` | Number | Auto | FM internal record ID | `"100"` | billableHoursService.js:78 |
| `_projectID` | Text (UUID) | No | Project ID (FK to devProjects.__ID) | `"uuid-project-456"` | billableHoursService.js:81 |
| `_custID` | Text (UUID) | ✅ Yes | Customer ID (FK to devCustomers.__ID) | `"uuid-customer-123"` | billableHoursService.js:79 |
| `startTime` | Timestamp | ✅ Yes | Start time | `"2024-01-15T09:00:00"` | billableHoursService.js:86 |
| `endTime` | Timestamp | ✅ Yes | End time | `"2024-01-15T11:30:00"` | billableHoursService.js:86 |
| `Work Performed` | Text | No | Work description | `"Fixed header layout bug"` | billableHoursService.js:90 |
| `f_billed` | Text | No | Billed flag ("1" = yes, "0" = no) | `"0"` | billableHoursService.js:89 |
| `Billable_Time_Rounded` | Number (Calculated) | Auto | Billable hours (rounded to 2 decimals) | `2.5` | billableHoursService.js:84 |
| `DateStart` | Date | Auto | Date portion of startTime (MM/DD/YYYY) | `"01/15/2024"` | billableHoursService.js:86 |
| `month` | Number | Auto | Month number (1-12) | `1` | billableHoursService.js:87 |
| `year` | Number | Auto | Year (YYYY) | `2024` | billableHoursService.js:88 |

### Related Fields (From Customer/Project Lookups)

These fields are NOT stored in dapiRecords but are fetched via relationships for display:

| FileMaker Field | Type | Description | Code Reference |
|----------------|------|-------------|----------------|
| `Customers::Name` | Text | Customer name (lookup from _custID) | billableHoursService.js:80 |
| `Customers::chargeRate` | Number | Customer hourly rate | billableHoursService.js:37 |
| `customers_Projects::projectName` | Text | Project name (lookup from _projectID) | billableHoursService.js:38 |
| `customers_Projects::f_fixedPrice` | Text | Fixed price flag from project | billableHoursService.js:93 |
| `Tasks::task` | Text | Task name (if linked to task) | billableHoursService.js:56 |
| `dapiTasks::task` | Text | Alternative task name field | billableHoursService.js:57 |

**Business Rules** (Code: billableHoursService.js:12-97):
1. **Project Association Optional**: `_projectID` can be null for non-project billable work
2. **Customer Association Required**: `_custID` must always be populated
3. **Billable Hours Calculation**: `Billable_Time_Rounded = (endTime - startTime) / 3600` (hours, rounded to 2 decimals)
4. **Hourly Rate Lookup**: Rate comes from `Customers::chargeRate` (customer's default rate)
5. **Amount Calculation**: `amount = Billable_Time_Rounded * Hourly_Rate` (billableHoursService.js:106-113)
6. **Billing Status**: String "1"/"0" converted to boolean in frontend (line 89)
7. **Date Filtering**: Records typically queried by `DateStart` range (last 12 months)

**API Operations**:

| Operation | Code Reference | Method | Layout | Query Field |
|-----------|---------------|--------|--------|-------------|
| **Read by Project** | N/A (not implemented) | `fetchProjectRelatedData([projectId], 'dapiRecords')` | `dapiRecords` | `_projectID` |
| **Read by Customer** | N/A (not implemented) | N/A | `dapiRecords` | `_custID` |
| **Read by Date Range** | N/A (not implemented) | N/A | `dapiRecords` | `DateStart` |
| **Create** | ❌ Not implemented | N/A | N/A | N/A |
| **Update** | fileMaker.js:447-500 | `initializeQuickBooks(params)` | `dapiRecords` | Sets `f_billed = "1"` |
| **Delete** | ❌ Not implemented | N/A | N/A | N/A |

**Frontend Processing** (Code: billableHoursService.js:34-97):
```javascript
// processFinancialData(data)
{
  id: fieldData.__ID,
  recordId: record.recordId,
  customerId: fieldData["_custID"],
  customerName: fieldData["Customers::Name"] || "Unknown Customer",
  projectId: fieldData._projectID,
  projectName: fieldData["customers_Projects::projectName"] || "Unknown Project",
  amount: calculateAmount(fieldData.Billable_Time_Rounded, hourlyRate),
  hours: parseFloat(fieldData.Billable_Time_Rounded || 0),
  rate: parseFloat(hourlyRate),
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
}
```

**Data Aggregation Functions** (Code: billableHoursService.js:288-309):
- **Total Hours Calculation**: Sum of all `Billable_Time_Rounded` values
- **Unbilled Hours Calculation**: Sum of `Billable_Time_Rounded` where `f_billed === "0"`
- **Billed Hours Calculation**: Sum of `Billable_Time_Rounded` where `f_billed === "1"`
- **Total Amount**: Sum of `amount` (hours × rate) for all records
- **Unbilled Amount**: Sum of `amount` where `f_billed === "0"`
- **Billed Amount**: Sum of `amount` where `f_billed === "1"`

**Grouping and Analytics** (Code: billableHoursService.js:181-280):
1. **Group by Customer**: `groupRecordsByCustomer(records)` - Returns object keyed by customerId with totals
2. **Group by Project**: `groupRecordsByProject(records, customerId)` - Returns object keyed by projectId with totals
3. **Monthly Totals**: `calculateMonthlyTotals(records)` - Returns array of monthly aggregates for charting
4. **Chart Data**: `prepareChartData(records, chartType)` - Formats data for bar/line/stacked charts

**Query Pattern Examples**:
```javascript
// Fetch all unbilled time records for a project
{
  layout: 'dapiRecords',
  action: 'read',
  query: [
    { "_projectID": "project-uuid" },
    { "f_billed": "0" }
  ]
}

// Fetch time records for date range (last 12 months)
{
  layout: 'dapiRecords',
  action: 'read',
  query: [{ "DateStart": ">2023+01+*" }]
}

// Mark records as billed (via QuickBooks sync)
// See fileMaker.js:447-500 initializeQuickBooks()
```

**Relationship to Projects**:
- One project has many time records (one-to-many)
- Time records filtered by `_projectID === project.__ID`
- Records with `_projectID = null` are non-project billable work (customer-level)
- Project billable hours stats: `SELECT SUM(Billable_Time_Rounded) WHERE _projectID = 'uuid'`
- Project unbilled hours stats: `SELECT SUM(Billable_Time_Rounded) WHERE _projectID = 'uuid' AND f_billed = '0'`

**Integration with QuickBooks** (Code: fileMaker.js:447-500):
- `initializeQuickBooks(params)` marks records as billed (`f_billed = "1"`)
- Sends unbilled records to QuickBooks for invoice generation
- Updates billing status after successful QB sync
- See financialSyncService.js for QB integration details

## Supabase Time Tracking Mapping

**Status**: ⚠️ **NO DIRECT SUPABASE EQUIVALENT** - Time records from FileMaker `dapiRecords` layout remain in FileMaker

**Verified Schema** (2025-01-10):
- ✅ **customer_sales** table exists - for sales/financial transactions, NOT time tracking
- ❌ **time_entries** table does NOT exist in Supabase
- ❌ **project_time_records** table does NOT exist in Supabase

**Current State**: FileMaker `dapiRecords` layout is the **source of truth** for billable time tracking. There is no Supabase table for time entries.

### customer_sales Table (NOT for Time Tracking)

**Actual Schema** (Verified via SSH):

```sql
CREATE TABLE customer_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  date DATE NOT NULL,
  inv_id TEXT,                                   -- QuickBooks invoice ID
  financial_id UUID UNIQUE,                       -- QuickBooks financial ID
  configuration_data JSONB,                       -- Product configuration (VAPI, etc.)
  organization_id UUID NOT NULL REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_sales_customer_id ON customer_sales(customer_id);
CREATE INDEX idx_customer_sales_product_id ON customer_sales(product_id);
CREATE INDEX idx_customer_sales_date ON customer_sales(date);
CREATE INDEX idx_customer_sales_workflow_status ON customer_sales((configuration_data ->> 'workflow_status')) WHERE configuration_data IS NOT NULL;

FOREIGN KEY constraints:
- customer_id REFERENCES customers(id)
- product_id REFERENCES products(id)
- organization_id REFERENCES organizations(id)
```

**Schema Purpose**:
1. **Sales Transactions**: Records product purchases by customers (NOT time tracking)
2. **Fixed-Price Project Billing**: Creates sales entries for fixed-price projects (50/50 split)
3. **Subscription Billing**: Creates recurring monthly sales entries for subscription projects
4. **QuickBooks Integration**: Syncs with QB via `inv_id` and `financial_id`
5. **Product Configuration**: Stores JSONB data for products requiring setup (VAPI agents, phone numbers)

**Difference from Time Records**:

| Aspect | FileMaker dapiRecords (Time) | Supabase customer_sales (Sales) |
|--------|------------------------------|--------------------------------|
| **Purpose** | Track billable hours worked | Record product/service sales |
| **Key Fields** | startTime, endTime, Billable_Time_Rounded | product_name, quantity, unit_price, total_price |
| **Project Link** | _projectID (optional, nullable) | ❌ No project_id field |
| **Granularity** | Individual time entries (per session) | Aggregate sales transactions |
| **Billing Status** | f_billed ("1"/"0") - per record | ❌ No billing status - sales are inherently "sold" |
| **Rate Source** | Customers::chargeRate (hourly rate) | unit_price (product price) |
| **QB Sync** | Sends unbilled hours to QB for invoicing | Syncs sales as line items in QB invoices |
| **Migration** | ❌ NOT migrated to Supabase | ✅ Already exists in Supabase |

### How Projects Use customer_sales

**Business Logic** (Code: src/services/projectService.js:508-596):

#### Fixed-Price Projects (f_fixedPrice = "1")
```javascript
// processProjectValue() - Line 520-560
// Creates TWO customer_sales entries:
// 1. 50% on project start
await insert('customer_sales', {
  customer_id: project.customer_id,
  product_name: `${project.name} - Initial Payment`,
  quantity: 1,
  unit_price: project.value / 2,
  total_price: project.value / 2,
  date: project.start_date,
  organization_id: project.organization_id
});

// 2. 50% on project completion (when status → 'completed')
await insert('customer_sales', {
  customer_id: project.customer_id,
  product_name: `${project.name} - Final Payment`,
  quantity: 1,
  unit_price: project.value / 2,
  total_price: project.value / 2,
  date: project.actual_end_date || new Date(),
  organization_id: project.organization_id
});
```

#### Subscription Projects (f_subscription = "1")
```javascript
// processProjectValue() - Line 563-593
// Creates MONTHLY customer_sales entries:
await insert('customer_sales', {
  customer_id: project.customer_id,
  product_name: `${project.name} - Monthly Subscription`,
  quantity: 1,
  unit_price: project.value,
  total_price: project.value,
  date: new Date(year, month, 1),
  organization_id: project.organization_id
});
// Repeats monthly until project ends or is cancelled
```

**Important**: `customer_sales` records are created for **project value** (fixed-price/subscription), NOT for individual time tracking entries.

### Time Records Integration with Projects

**Current Implementation**:
1. **Time Entry**: User logs billable hours in FileMaker `dapiRecords` with `_projectID` link
2. **Aggregation**: Frontend calculates project stats (total hours, unbilled hours) from `dapiRecords`
3. **Billing**: QuickBooks sync marks `dapiRecords.f_billed = "1"` after invoice generation
4. **Project Value**: Fixed-price/subscription projects create `customer_sales` entries (NOT related to time)

**No Direct Relationship**:
- `dapiRecords` (time entries) do NOT map to `customer_sales` (sales transactions)
- `dapiRecords._projectID` links to `devProjects.__ID` (FileMaker only)
- `customer_sales` has NO `project_id` field - cannot link sales to projects

**Project Billable Hours Calculation** (Code: billableHoursService.js:288-309):
```javascript
// Fetch from FileMaker dapiRecords
const records = await fetchRecords('dapiRecords', [{ _projectID: projectId }]);

// Calculate totals
const totalHours = records.reduce((sum, r) => sum + r.Billable_Time_Rounded, 0);
const unbilledHours = records
  .filter(r => r.f_billed === "0")
  .reduce((sum, r) => sum + r.Billable_Time_Rounded, 0);
const billedHours = totalHours - unbilledHours;
```

### Migration Impact

**Current Decision** (As documented):
1. ✅ **Time records stay in FileMaker**: `dapiRecords` layout remains source of truth
2. ✅ **customer_sales exists in Supabase**: Used for product sales, NOT time tracking
3. ❌ **No time_entries table**: Must be created if time tracking needed in Supabase
4. ❌ **No migration path**: FileMaker time records are NOT migrated to Supabase

**If Time Tracking Needed in Supabase** (Future Requirement):

Create `time_entries` table (proposed schema):

```sql
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,  -- Nullable for non-project work
  customer_id UUID NOT NULL REFERENCES customers(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  billable_hours DECIMAL(5,2) NOT NULL,           -- Calculated: (end_time - start_time) / 3600
  hourly_rate DECIMAL(10,2) NOT NULL,              -- From customer.charge_rate
  amount DECIMAL(10,2) NOT NULL,                   -- billable_hours * hourly_rate
  description TEXT,
  is_billed BOOLEAN DEFAULT false,                 -- Replaces f_billed
  billed_at TIMESTAMPTZ,                           -- When marked as billed
  qb_invoice_id TEXT,                              -- QuickBooks invoice reference
  task_name TEXT,                                  -- Optional task association
  organization_id UUID NOT NULL REFERENCES organizations(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_time_entries_project ON time_entries(project_id);
CREATE INDEX idx_time_entries_customer ON time_entries(customer_id);
CREATE INDEX idx_time_entries_billed ON time_entries(is_billed);
CREATE INDEX idx_time_entries_date ON time_entries(start_time);
```

**Field Mapping** (If time_entries table is created):

| FileMaker Field | Supabase Column | Type Conversion | Notes |
|----------------|-----------------|-----------------|-------|
| `__ID` | `id` | UUID → UUID | Preserve UUID |
| `recordId` | ❌ DISCARD | N/A | FileMaker internal ID |
| `_projectID` | `project_id` | UUID → UUID | Nullable (null for non-project work) |
| `_custID` | `customer_id` | UUID → UUID | NOT NULL |
| `startTime` | `start_time` | Timestamp → TIMESTAMPTZ | Direct mapping |
| `endTime` | `end_time` | Timestamp → TIMESTAMPTZ | Direct mapping |
| `Billable_Time_Rounded` | `billable_hours` | Number → DECIMAL(5,2) | Direct mapping |
| `Customers::chargeRate` | `hourly_rate` | Number → DECIMAL(10,2) | Lookup from customer |
| `amount` (calculated) | `amount` | N/A → DECIMAL(10,2) | billable_hours * hourly_rate |
| `Work Performed` | `description` | Text → TEXT | Direct mapping |
| `f_billed` | `is_billed` | "1"/"0" → BOOLEAN | Convert: "1" → true, "0" → false |
| `DateStart` | ❌ DISCARD | N/A | Derived from start_time |
| `month` | ❌ DISCARD | N/A | Derived from start_time |
| `year` | ❌ DISCARD | N/A | Derived from start_time |
| `Tasks::task` | `task_name` | Text → TEXT | Optional task name |
| N/A | `billed_at` | N/A | New field - timestamp when marked billed |
| N/A | `qb_invoice_id` | N/A | New field - QuickBooks invoice reference |
| N/A | `organization_id` | N/A | **REQUIRED** - lookup from customer |

### Recommended Action

**Backend Change Request Required** (If time tracking needed in web app):
1. Create `time_entries` table in Supabase (schema above)
2. Migrate historical `dapiRecords` data to `time_entries` (optional)
3. Update frontend to write to both FileMaker and Supabase during transition
4. Eventually deprecate FileMaker `dapiRecords` layout

**Current State** (No Backend Change):
- Time tracking remains FileMaker-only
- Web app continues using fm-gofer to read `dapiRecords`
- Projects calculate billable hours from FileMaker data
- No migration needed (FileMaker is source of truth)

See `requirements/financial-records/BACKEND_CHANGE_REQUEST_001_FINANCIAL_RECORDS_MIGRATION.md` for related migration planning.

## Field-by-Field Conversion Rules

### String to Boolean Conversion

FileMaker fields using "1"/"0" strings:

| FileMaker Field | Supabase Field | Conversion |
|----------------|----------------|------------|
| `f_fixedPrice` ("1"/"0") | `is_fixed_price` (boolean) | `value === "1" \|\| value === 1` |
| `f_subscription` ("1"/"0") | `is_subscription` (boolean) | `value === "1" \|\| value === 1` |
| `f_completed` ("1"/"0") | `completed` (boolean) | `value === "1" \|\| value === 1` |
| `f_billed` ("1"/"0") | `is_billed` (boolean) | `value === "1" \|\| value === 1` |

### Date Format Conversion

FileMaker uses MM/DD/YYYY, Supabase uses YYYY-MM-DD:

```javascript
// FileMaker → Supabase
function convertFromFileMakerDate(fmDate) {
  // Input: "01/15/2024"
  // Output: "2024-01-15"
  const [month, day, year] = fmDate.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Supabase → FileMaker
function convertToFileMakerDate(isoDate) {
  // Input: "2024-01-15"
  // Output: "01/15/2024"
  const date = new Date(isoDate);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}
```

### Number/Decimal Conversion

FileMaker stores numbers as text strings:

| FileMaker Field | Type | Supabase Field | Type | Conversion |
|----------------|------|----------------|------|------------|
| `value` | Text | `value` | DECIMAL(10,2) | `parseFloat(value) \|\| 0` |
| `order` | Number | `order_num` | INTEGER | `parseInt(value) \|\| 0` |
| `Billable_Time_Rounded` | Number | `billable_hours` | DECIMAL(5,2) | `parseFloat(value)` |

### UUID Preservation

All `__ID` fields should be preserved during migration:
- FileMaker `__ID` → Supabase `id` (same UUID)
- FileMaker `recordId` → DISCARD (internal FileMaker identifier, no Supabase equivalent)

### Status Value Mapping

FileMaker status values → Supabase status values:

| FileMaker Status | Supabase Status | Mapping Logic (useProject.js:222-232) |
|-----------------|-----------------|---------------------------------------|
| `"Open"` | `"active"` | Default mapping |
| `"Active"` | `"active"` | Direct mapping |
| `"Pending"` | `"pending"` | Direct mapping |
| `"On Hold"` | `"on_hold"` | Lowercase with underscore |
| `"Completed"`, `"Complete"`, `"Closed"` | `"completed"` | Normalized to completed |
| `"Cancelled"` | `"cancelled"` | Direct mapping |

**Constraint**: Supabase enforces CHECK constraint - only allows: 'active', 'pending', 'on_hold', 'completed', 'cancelled'

### Organization ID Assignment

**Challenge**: FileMaker records have NO `organization_id` field.

**Migration Strategy**:
1. Determine organization from customer relationship
2. Lookup `customer.organization_id` via `_custID`
3. Assign same `organization_id` to project and all related records

**Implementation Note**: Current Supabase schema has NO organization_id in projects table - may need backend change request.

## Relationship Integrity Rules

### Projects → Customers (Required)
- FileMaker: `_custID` → devCustomers `__ID`
- Supabase: `customer_id` → customers `id`
- On customer delete: CASCADE delete projects

### Projects → Teams (Optional)
- FileMaker: `_teamID` → devTeams `__ID`
- Supabase: `team_id` → teams `id`
- On team delete: SET NULL (project remains, team assignment removed)

### Objectives → Projects (Required)
- FileMaker: `_projectID` → devProjects `__ID`
- Supabase: `project_id` → projects `id`
- On project delete: CASCADE delete objectives

### Steps → Objectives (Required)
- FileMaker: `_objectiveID` → devProjectObjectives `__ID`
- Supabase: `objective_id` → project_objectives `id`
- On objective delete: CASCADE delete steps

### Images → Projects (Required)
- FileMaker: `_fkID` → devProjects `__ID` (polymorphic, no type indicator)
- Supabase: `project_id` → projects `id`
- On project delete: CASCADE delete images

### Links → Projects (Required)
- FileMaker: `_fkID` → devProjects `__ID` (polymorphic, no type indicator)
- Supabase: `project_id` → projects `id`
- On project delete: CASCADE delete links

### Notes → Projects (Required)
- FileMaker: `_fkID` → devProjects `__ID` (polymorphic, no type indicator)
- Supabase: `entity_id` (with `entity_type = 'project'`)
- On project delete: CASCADE delete notes

### Time Records → Projects (Optional)
- FileMaker: `_projectID` → devProjects `__ID` (nullable)
- Supabase: `project_id` → projects `id` (nullable)
- On project delete: SET NULL (time record remains, project association removed)

## Migration Validation Checklist

- [ ] All project UUIDs preserved (`__ID` → `id`)
- [ ] Customer relationships intact (`_custID` → `customer_id`)
- [ ] Team relationships intact (`_teamID` → `team_id`)
- [ ] All objectives migrated with correct `project_id`
- [ ] All steps migrated with correct `objective_id`
- [ ] Objectives/steps order preserved
- [ ] All images migrated with correct `project_id`
- [ ] All links migrated with correct `project_id`
- [ ] All links have required `customer_id` populated
- [ ] All links have `organization_id` populated from customer
- [ ] Link titles handled (lost during migration, derived from URL)
- [ ] Link URLs validated (≤ 2048 characters)
- [ ] GitHub URLs preserved for frontend GitHub integration
- [ ] All notes migrated with `entity_type='project'` and `entity_id`
- [ ] Time records project associations preserved
- [ ] Boolean flags converted correctly (not stored as "1"/"0" strings)
- [ ] Dates converted to YYYY-MM-DD format
- [ ] Value fields converted to numeric types
- [ ] Organization IDs assigned correctly
- [ ] Constraint violations checked (fixed-price + subscription)
- [ ] Orphaned records identified (missing parent relationships)

## API Contracts

### FileMaker API (via fm-gofer)

**Base Configuration** (src/api/fileMaker.js):
- Database: `clarityCRM`
- Layouts: See `Layouts` constant (line 411-423)
- Actions: `read`, `create`, `update`, `delete`

**Example: Create Project** (src/api/projects.js:112-124):

```javascript
// Request
{
  layout: 'devProjects',
  action: 'create',
  fieldData: {
    __ID: 'uuid-generated',
    projectName: 'Website Redesign',
    _custID: 'customer-uuid',
    status: 'Open',
    f_fixedPrice: "1",
    value: "5000.00",
    dateStart: "01/15/2024",  // MM/DD/YYYY format
    dateEnd: "03/31/2024"
  }
}

// Response
{
  response: {
    data: [{
      fieldData: { /* created project */ },
      recordId: "42"
    }],
    messages: [{ code: '0', message: 'OK' }]
  }
}
```

**Example: Fetch Projects for Customer** (src/api/projects.js:27-38):

```javascript
// Request
{
  layout: 'devProjects',
  action: 'read',
  query: [{ "_custID": "customer-uuid" }]
}

// Response
{
  response: {
    data: [
      {
        fieldData: {
          __ID: "project-uuid",
          projectName: "Project Name",
          _custID: "customer-uuid",
          status: "Open",
          // ... other fields
        },
        recordId: "42"
      }
    ]
  }
}
```

**Example: Fetch Related Data** (src/api/projects.js:61-84):

```javascript
// Objectives
{
  layout: 'devProjectObjectives',
  action: 'read',
  query: [{ "_projectID": "project-uuid" }]
}

// Steps
{
  layout: 'devProjectObjSteps',
  action: 'read',
  query: [{ "_objectiveID": "objective-uuid" }]
}

// Images (polymorphic)
{
  layout: 'devProjectImages',
  action: 'read',
  query: [{ "_fkID": "project-uuid" }]
}

// Links (polymorphic)
{
  layout: 'devProjectLinks',
  action: 'read',
  query: [{ "_fkID": "project-uuid" }]
}

// Time Records
{
  layout: 'dapiRecords',
  action: 'read',
  query: [{ "_projectID": "project-uuid" }]
}
```

### Supabase API (Direct)

**Current Implementation** (src/hooks/useProject.js:218-259):

```javascript
// Sync project to Supabase after FileMaker create
import { insert } from '../services/supabaseService';

const supabaseProjectData = {
  id: projectId,                      // UUID from FileMaker
  name: projectData.projectName,
  customer_id: projectData._custID,
  status: 'active',                   // Mapped from FileMaker status
  description: projectData.description || null,
  budget: parseFloat(projectData.value) || null,
  start_date: projectData.dateStart || null,
  target_end_date: projectData.dateEnd || null,
  created_by: user?.email || null
};

await insert('projects', supabaseProjectData);
```

**Required for Migration**:
- Batch insert for project_objectives (table doesn't exist yet)
- Batch insert for project_objective_steps (table doesn't exist yet)
- Batch insert for project_images (table doesn't exist yet)
- Update existing links with project_id + customer_id
- Handle notes migration (table doesn't exist yet)

## Known Schema Gaps and Action Items

### Critical Gaps (Blocking Migration)

1. **project_objectives Table**: Does NOT exist in Supabase
   - Required for: Migrating objectives from devProjectObjectives
   - Action: Create BACKEND_CHANGE_REQUEST for table creation

2. **project_objective_steps Table**: Does NOT exist in Supabase
   - Required for: Migrating steps from devProjectObjSteps
   - Action: Create BACKEND_CHANGE_REQUEST for table creation

3. **project_images Table**: Does NOT exist in Supabase
   - Required for: Migrating images from devProjectImages
   - FileMaker uses URL-based storage (not binary data in database)
   - Migration preserves URLs as-is (no binary data migration needed)
   - Action: Create BACKEND_CHANGE_REQUEST for table creation with URL, title, description fields
   - Storage consideration: Determine if image URLs point to FileMaker container storage or external CDN

4. **notes Table**: Does NOT exist in Supabase
   - Required for: Migrating notes from devNotes
   - Action: First audit devNotes layout, then create table schema

### Schema Mismatches (Require Backend Changes)

5. **team_id Missing**: Supabase projects table has no team_id field
   - FileMaker has: `_teamID` field
   - Action: Backend change request to add team_id column OR accept loss of team assignments

6. **is_fixed_price/is_subscription Missing**: Supabase has no pricing type flags
   - FileMaker has: `f_fixedPrice`, `f_subscription`
   - Current workaround: Pricing logic uses customer_sales table
   - Action: Document that pricing model is handled via customer_sales, not project flags

7. **organization_id Missing**: Supabase projects table has no organization_id
   - Required for: Multi-tenancy
   - Action: Backend change request to add organization_id with NOT NULL constraint

### Data Investigation Needed

8. **Notes Field Structure**: devNotes layout fields are unknown
   - Frontend displays raw data (useProject.js:114)
   - Action: Audit devNotes layout via FileMaker or API inspection

9. **Additional FileMaker Fields**: May exist but not used in frontend
   - Examples: description, priority, budget, actualCost
   - Action: Complete field audit from FileMaker layout definition

10. **Calculation Fields**: FileMaker may have calculated fields
    - Example: Billable_Time_Rounded in dapiRecords
    - Action: Identify all calculated fields and determine if needed in Supabase

### Migration Strategy Decisions

11. **Time Records**: dapiRecords has no Supabase equivalent
    - Current decision: Keep in FileMaker only
    - Alternative: Create time_entries table in Supabase
    - Action: Confirm business requirement for time tracking in web app

12. **Links Title Field**: Supabase links table has no title field
    - FileMaker has: `title` field (optional, can be empty)
    - Current workaround: Derive from URL hostname (projectService.js:97)
    - **Migration Impact**: Link titles will be LOST during migration
    - **Frontend Impact**: None - frontend already derives titles from URL when missing
    - **Recommendation**: Add `title TEXT` column to preserve FileMaker titles OR accept title loss
    - Action: Backend change request to add title field (OPTIONAL - not blocking migration)

## Validation Checklist

Before migration can proceed, verify:

- [ ] Backend change request created for missing tables (objectives, steps, images, notes)
- [ ] Backend change request created for missing columns (team_id, organization_id, pricing flags)
- [ ] Notes layout audited and field structure documented
- [ ] Status value mapping tested and validated
- [ ] Date format conversion tested (MM/DD/YYYY → YYYY-MM-DD)
- [ ] Boolean conversion tested ("1"/"0" → true/false)
- [ ] Organization ID derivation strategy implemented
- [ ] Links migration strategy handles required customer_id field
- [ ] Links title field decision finalized (add column OR accept title loss)
- [ ] Links URL length validation (VARCHAR(2048) limit)
- [ ] Customer_sales table confirmed for financial transactions only
- [ ] Time tracking strategy finalized (FileMaker-only vs Supabase time_entries)
- [ ] All project UUIDs can be preserved during migration
- [ ] Orphaned records strategy defined (projects without valid customer_id)
- [ ] Rollback plan documented in case of migration failure
