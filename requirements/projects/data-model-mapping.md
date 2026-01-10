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

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,                           -- Maps to projectName
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,  -- Maps to _custID
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,         -- Maps to _teamID
  organization_id UUID REFERENCES organizations(id) NOT NULL,   -- NEW FIELD (not in FM)
  status TEXT DEFAULT 'Open',                   -- Maps to status
  description TEXT,                             -- May not exist in FM
  time_estimate TEXT,                           -- Maps to estOfTime
  value DECIMAL(10,2),                          -- Maps to value (convert from text)
  is_fixed_price BOOLEAN DEFAULT false,         -- Maps to f_fixedPrice
  is_subscription BOOLEAN DEFAULT false,        -- Maps to f_subscription
  start_date DATE,                              -- Maps to dateStart (convert format)
  end_date DATE,                                -- Maps to dateEnd (convert format)
  created_at TIMESTAMPTZ DEFAULT now(),         -- Maps to ~creationTimestamp
  updated_at TIMESTAMPTZ DEFAULT now(),         -- Maps to ~modificationTimestamp

  CONSTRAINT projects_pricing_check CHECK (
    NOT (is_fixed_price = true AND is_subscription = true)
  ),
  CONSTRAINT projects_value_check CHECK (
    (is_fixed_price = false AND is_subscription = false) OR
    (value IS NOT NULL AND value > 0)
  )
);

CREATE INDEX idx_projects_customer ON projects(customer_id);
CREATE INDEX idx_projects_team ON projects(team_id);
CREATE INDEX idx_projects_org ON projects(organization_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_dates ON projects(start_date, end_date);
```

## FileMaker devProjectObjectives Layout Fields

### Objective Fields

| FileMaker Field | Type | Required | Description | Sample Value |
|----------------|------|----------|-------------|--------------|
| `__ID` | Text (UUID) | Auto | Objective UUID | `"uuid-obj-123"` |
| `recordId` | Number | Auto | FM internal record ID | `"10"` |
| `_projectID` | Text (UUID) | ✅ Yes | Project ID (FK to devProjects) | `"uuid-project-456"` |
| `projectObjective` | Text | ✅ Yes | Objective text/description | `"Complete homepage design"` |
| `status` | Text | No | Objective status | `"Open"`, `"In Progress"`, `"Completed"` |
| `order` | Number | No | Display order | `1`, `2`, `3` |
| `f_completed` | Text | No | Completion flag ("1" = yes, "0" = no) | `"1"` |

## Supabase project_objectives Table Schema

```sql
CREATE TABLE project_objectives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  objective TEXT NOT NULL,                      -- Maps to projectObjective
  status TEXT DEFAULT 'Open',                   -- Maps to status
  order_num INTEGER DEFAULT 0,                  -- Maps to order
  completed BOOLEAN DEFAULT false,              -- Maps to f_completed
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_project_objectives_project ON project_objectives(project_id);
CREATE INDEX idx_project_objectives_order ON project_objectives(project_id, order_num);
```

## FileMaker devProjectObjSteps Layout Fields

### Step Fields

| FileMaker Field | Type | Required | Description | Sample Value |
|----------------|------|----------|-------------|--------------|
| `__ID` | Text (UUID) | Auto | Step UUID | `"uuid-step-789"` |
| `recordId` | Number | Auto | FM internal record ID | `"25"` |
| `_objectiveID` | Text (UUID) | ✅ Yes | Objective ID (FK to devProjectObjectives) | `"uuid-obj-123"` |
| `projectObjectiveStep` | Text | ✅ Yes | Step text/description | `"Create wireframes"` |
| `order` | Number | No | Display order within objective | `1`, `2`, `3` |
| `f_completed` | Text | No | Completion flag ("1" = yes, "0" = no) | `"0"` |

## Supabase project_objective_steps Table Schema

```sql
CREATE TABLE project_objective_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  objective_id UUID REFERENCES project_objectives(id) ON DELETE CASCADE NOT NULL,
  step TEXT NOT NULL,                           -- Maps to projectObjectiveStep
  order_num INTEGER DEFAULT 0,                  -- Maps to order
  completed BOOLEAN DEFAULT false,              -- Maps to f_completed
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_project_steps_objective ON project_objective_steps(objective_id);
CREATE INDEX idx_project_steps_order ON project_objective_steps(objective_id, order_num);
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

**Note**: Links table already exists in Supabase and is shared across entities (projects, customers, prospects, etc.).

```sql
-- Verify existing schema via SSH:
-- ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"\\d+ links\""

-- Expected schema (approximate):
CREATE TABLE links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  url TEXT NOT NULL,                            -- Maps to link
  title TEXT,                                   -- Maps to title
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  -- ... other entity FKs
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT links_entity_check CHECK (
    (project_id IS NOT NULL AND customer_id IS NULL AND prospect_id IS NULL) OR
    (project_id IS NULL AND customer_id IS NOT NULL AND prospect_id IS NULL) OR
    (project_id IS NULL AND customer_id IS NULL AND prospect_id IS NOT NULL)
    -- ... other entity checks
  )
);

CREATE INDEX idx_links_project ON links(project_id);
```

**Migration Strategy for Links**:
1. Query devProjectLinks by `_fkID = projectId`
2. For each link:
   - Preserve `__ID` as Supabase `id`
   - Map `link` to `url`
   - Map `title` to `title`
   - Set `project_id = _fkID`
   - Set all other entity FKs to NULL

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

```sql
-- PROPOSED schema (requires verification)
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

## Supabase time_entries / customer_sales Mapping (TBD)

**Two Possible Approaches**:

### Option 1: Map to time_entries Table

```sql
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,  -- Maps to _projectID (nullable)
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE, -- Maps to _custID
  user_id UUID REFERENCES users(id) NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,              -- Maps to startTime
  end_time TIMESTAMPTZ NOT NULL,                -- Maps to endTime
  description TEXT,                             -- Maps to description
  is_billed BOOLEAN DEFAULT false,              -- Maps to f_billed
  billable_hours DECIMAL(5,2),                  -- Calculated from start/end
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Option 2: Map to customer_sales Table (Existing)

```sql
-- Verify existing schema via SSH
-- Note: customer_sales may already exist with different structure for sales records
-- Time records might be a separate concern from sales
```

**Action Required**:
1. Clarify if time tracking should use `time_entries` or `customer_sales`
2. Review existing Supabase schema for time tracking tables
3. Define migration strategy for historical time records

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

### Organization ID Assignment

FileMaker records have NO `organization_id`. Migration strategy:
1. Determine organization from customer relationship
2. Lookup `customer.organization_id` via `_custID`
3. Assign same `organization_id` to project and all related records

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

## Known Schema Gaps

1. **Notes Table**: Complete field list unknown, requires investigation
2. **Time Tracking**: Unclear if time_entries or customer_sales, requires clarification
3. **Organization Assignment**: No organization_id in FileMaker, derivation strategy TBD
4. **Additional Project Fields**: May exist in FileMaker but not used in frontend
5. **Calculation Fields**: FileMaker may have calculated fields not in API responses
