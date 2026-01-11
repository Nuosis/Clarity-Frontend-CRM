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

### Image Fields

| FileMaker Field | Type | Required | Description | Sample Value |
|----------------|------|----------|-------------|--------------|
| `__ID` | Text (UUID) | Auto | Image UUID | `"uuid-img-111"` |
| `recordId` | Number | Auto | FM internal record ID | `"5"` |
| `_fkID` | Text (UUID) | ✅ Yes | Polymorphic FK (project ID in this context) | `"uuid-project-456"` |
| `url` | Text (URL) | ✅ Yes | Image URL or path | `"https://example.com/image.png"` |
| `title` | Text | No | Image title | `"Homepage Mockup"` |
| `description` | Text | No | Image description | `"Initial design concept"` |

**Note**: `_fkID` is a polymorphic foreign key - no type indicator to distinguish entity type.

## Supabase project_images Table Schema

**Status**: ⚠️ **TABLE DOES NOT EXIST IN SUPABASE** (Verified 2025-01-10)

**Proposed Schema** (Based on FileMaker structure):

```sql
CREATE TABLE project_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,  -- Maps to _fkID
  url TEXT NOT NULL,                            -- Maps to url
  title TEXT,                                   -- Maps to title
  description TEXT,                             -- Maps to description
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_project_images_project ON project_images(project_id);
```

**Current Workaround**: Images may be stored in FileMaker only, or in a generic images table.

## FileMaker devProjectLinks Layout Fields

### Link Fields

| FileMaker Field | Type | Required | Description | Sample Value |
|----------------|------|----------|-------------|--------------|
| `__ID` | Text (UUID) | Auto | Link UUID | `"uuid-link-222"` |
| `recordId` | Number | Auto | FM internal record ID | `"8"` |
| `_fkID` | Text (UUID) | ✅ Yes | Polymorphic FK (project ID in this context) | `"uuid-project-456"` |
| `link` | Text (URL) | ✅ Yes | URL | `"https://github.com/client/repo"` |
| `title` | Text | No | Link title (derived from URL if empty) | `"GitHub Repository"` |

**Note**: Frontend derives title from URL hostname if title is empty (src/services/projectService.js:97).

## Supabase links Table Schema (Existing)

**Status**: ✅ **TABLE EXISTS IN SUPABASE** (Verified 2025-01-10 via SSH)

**Actual Schema**:

```sql
CREATE TABLE links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID,                              -- Maps to _fkID (for project links)
  link VARCHAR(2048) NOT NULL,                  -- Maps to link
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

**Schema Notes**:
1. **No title field** - Title must be derived from URL (as done in projectService.js:97)
2. **customer_id is NOT NULL** - All links must have a customer association
3. **project_id is nullable** - Project association is optional
4. **No polymorphic constraint** - Links can belong to customer, project, and organization simultaneously
5. **link is VARCHAR(2048)** - Limited to 2048 characters

**Migration Strategy for Links**:
1. Query devProjectLinks by `_fkID = projectId`
2. For each link:
   - Preserve `__ID` as Supabase `id`
   - Map FileMaker `link` field to Supabase `link` field (VARCHAR(2048))
   - **Derive title from URL** (no title field in Supabase)
   - Set `project_id = _fkID`
   - **Lookup customer_id from project** (required field in Supabase)
   - **Lookup organization_id from customer** (for multi-tenancy)

## FileMaker devNotes Layout Fields (Polymorphic)

### Notes Fields

| FileMaker Field | Type | Required | Description | Sample Value |
|----------------|------|----------|-------------|--------------|
| `__ID` | Text (UUID) | Auto | Note UUID | `"uuid-note-333"` |
| `recordId` | Number | Auto | FM internal record ID | `"15"` |
| `_fkID` | Text (UUID) | ✅ Yes | Polymorphic FK (project/customer/task ID) | `"uuid-project-456"` |
| Additional fields | ??? | ??? | **UNKNOWN** - Not documented in projectService | ??? |

**Issues**:
1. Frontend fetches notes via `fetchProjectNotes(projectId)` (src/api/projects.js:47-59)
2. Frontend displays raw `notes.response.data` without processing (src/hooks/useProject.js:114)
3. Notes data structure is UNKNOWN - requires investigation
4. No entity type indicator - cannot distinguish if note is for project, customer, or task

**Action Required**:
1. Audit devNotes layout for complete field list
2. Review notes UI components for data structure
3. Define Supabase notes schema with entity_type + entity_id pattern

## Supabase notes Table Schema (Planned)

**Status**: ⚠️ **TABLE DOES NOT EXIST IN SUPABASE** (Verified 2025-01-10)

**Proposed Schema** (Based on FileMaker polymorphic pattern):

```sql
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL,                    -- 'project', 'customer', 'task'
  entity_id UUID NOT NULL,                      -- Maps to _fkID (polymorphic)
  note_text TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notes_entity ON notes(entity_type, entity_id);
CREATE INDEX idx_notes_org ON notes(organization_id);
```

**Action Required Before Migration**:
1. Audit devNotes layout for complete field list (currently unknown - see useProject.js:114)
2. Review notes UI components for actual data structure
3. Create notes table in Supabase with proper schema

**Migration Strategy for Notes**:
1. Query devNotes by `_fkID = projectId`
2. For each note:
   - Preserve `__ID` as Supabase `id`
   - Set `entity_type = 'project'`
   - Set `entity_id = _fkID`
   - Map note fields (TBD based on FM schema)
   - Derive `organization_id` from project's organization

## FileMaker dapiRecords Layout Fields (Time Tracking)

### Time Record Fields

| FileMaker Field | Type | Required | Description | Sample Value |
|----------------|------|----------|-------------|--------------|
| `__ID` | Text (UUID) | Auto | Record UUID | `"uuid-rec-444"` |
| `recordId` | Number | Auto | FM internal record ID | `"100"` |
| `_projectID` | Text (UUID) | No | Project ID (FK to devProjects) | `"uuid-project-456"` |
| `_custID` | Text (UUID) | ✅ Yes | Customer ID (FK to devCustomers) | `"uuid-customer-123"` |
| `startTime` | Timestamp | ✅ Yes | Start time | `"2024-01-15T09:00:00"` |
| `endTime` | Timestamp | ✅ Yes | End time | `"2024-01-15T11:30:00"` |
| `description` | Text | No | Work description | `"Fixed header layout bug"` |
| `f_billed` | Text | No | Billed flag ("1" = yes, "0" = no) | `"0"` |
| `Billable_Time_Rounded` | Number (Calculated) | Auto | Billable hours (rounded) | `2.5` |
| `DateStart` | Date | Auto | Date portion of startTime | `"01/15/2024"` |

**Issues**:
1. Unclear if dapiRecords maps to `time_entries` or `customer_sales` in Supabase
2. Frontend calculates duration from startTime/endTime (src/services/projectService.js:201-210)
3. `Billable_Time_Rounded` appears to be a FileMaker calculation field
4. Relationship to projects is optional (`_projectID` can be null for non-project work)

## Supabase Time Tracking Mapping

**Status**: Time records from FileMaker `dapiRecords` layout have NO direct equivalent in Supabase.

**Verified Schema** (2025-01-10):
- ✅ **customer_sales** table exists - for sales/financial transactions, not time tracking
- ❌ **time_entries** table does NOT exist

**customer_sales Table** (Actual Schema):

```sql
CREATE TABLE customer_sales (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id),
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  date DATE NOT NULL,
  inv_id TEXT,
  financial_id UUID UNIQUE,
  configuration_data JSONB
);
```

**Schema Notes**:
1. **customer_sales is for financial transactions**, not time tracking
2. **Used for fixed-price and subscription project billing** (see projectService.js:508-596)
3. **Time records (dapiRecords) are NOT migrated to Supabase** - remain in FileMaker only
4. **Project value processing**: Creates customer_sales entries for fixed-price (50/50 split) and subscription (monthly) projects

**Business Logic Reference** (src/services/projectService.js):
- Line 508-596: `processProjectValue()` function
- Line 520-560: Fixed price logic (50% on start, 50% on completion)
- Line 563-593: Subscription logic (monthly recurring sales)
- Line 631-643: `updateProjectRecordsBillableStatus()` placeholder

**Migration Decision**:
- Time records remain in FileMaker `dapiRecords` layout
- Financial transactions from projects → `customer_sales` table
- If time tracking needed in Supabase, create separate `time_entries` table

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
   - Action: Decide if using generic images table or project-specific table

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
    - FileMaker has: `title` field
    - Current workaround: Derive from URL (projectService.js:97)
    - Action: Backend change request to add title field OR accept derived titles

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
- [ ] Customer_sales table confirmed for financial transactions only
- [ ] Time tracking strategy finalized (FileMaker-only vs Supabase time_entries)
- [ ] All project UUIDs can be preserved during migration
- [ ] Orphaned records strategy defined (projects without valid customer_id)
- [ ] Rollback plan documented in case of migration failure
