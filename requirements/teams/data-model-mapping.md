# Teams - Data Model Mapping

## Overview

This document maps the FileMaker data structures to proposed Supabase schema for the Teams feature. It includes field-by-field mapping, data type conversions, and relationship structures.

## FileMaker → Supabase Table Mapping

### Teams Table

**FileMaker Layout:** `devTeams`
**Supabase Table:** `teams`

| FileMaker Field | Type | Supabase Column | Type | Notes |
|----------------|------|-----------------|------|-------|
| `__ID` | Text | `id` | UUID | Primary key, may already be UUID format |
| `name` | Text | `name` | VARCHAR(255) | Team name |
| `~CreationTimestamp` | Timestamp | `created_at` | TIMESTAMPTZ | Auto-generated on insert |
| `~ModificationTimestamp` | Timestamp | `updated_at` | TIMESTAMPTZ | Auto-updated on modification |
| (none) | - | `organization_id` | UUID | **NEW:** FK to organizations table |
| `recordId` | Number | - | - | FileMaker internal, not migrated |

**Proposed Supabase Schema:**
```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexes
  CONSTRAINT teams_name_org_unique UNIQUE (organization_id, name)
);

CREATE INDEX idx_teams_organization_id ON teams(organization_id);
```

### Team Members Table (Join Table)

**FileMaker Layout:** `devTeamMembers`
**Supabase Table:** `team_members`

| FileMaker Field | Type | Supabase Column | Type | Notes |
|----------------|------|-----------------|------|-------|
| `__ID` | Text | `id` | UUID | Primary key |
| `_teamID` | Text | `team_id` | UUID | FK to teams table |
| `_staffID` | Text | `staff_id` | UUID | FK to staff table |
| `role` | Text | `role` | VARCHAR(100) | Optional role description |
| `name` | Text | - | - | Denormalized, not needed in Supabase |
| `~CreationTimestamp` | Timestamp | `created_at` | TIMESTAMPTZ | Auto-generated on insert |
| `~ModificationTimestamp` | Timestamp | `updated_at` | TIMESTAMPTZ | Auto-updated on modification |
| (none) | - | `organization_id` | UUID | **NEW:** FK to organizations table |
| `recordId` | Number | - | - | FileMaker internal, not migrated |

**Proposed Supabase Schema:**
```sql
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  role VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate assignments
  CONSTRAINT team_members_unique UNIQUE (team_id, staff_id),

  -- Organization scoping constraint
  CONSTRAINT team_members_org_check CHECK (
    organization_id = (SELECT organization_id FROM teams WHERE id = team_id)
  )
);

CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_staff_id ON team_members(staff_id);
CREATE INDEX idx_team_members_organization_id ON team_members(organization_id);
```

### Staff Table

**FileMaker Layout:** `devStaff`
**Supabase Table:** `staff`

| FileMaker Field | Type | Supabase Column | Type | Notes |
|----------------|------|-----------------|------|-------|
| `__ID` | Text | `id` | UUID | Primary key |
| `name` | Text | `name` | VARCHAR(255) | Staff member name |
| `role` | Text | `title` | VARCHAR(100) | Job title/position |
| `image_base64` | Text | `profile_image_url` | TEXT | URL instead of base64 |
| `~CreationTimestamp` | Timestamp | `created_at` | TIMESTAMPTZ | Auto-generated on insert |
| `~ModificationTimestamp` | Timestamp | `updated_at` | TIMESTAMPTZ | Auto-updated on modification |
| (none) | - | `organization_id` | UUID | **NEW:** FK to organizations table |
| (none) | - | `email` | VARCHAR(255) | **NEW:** Staff email (optional) |
| (none) | - | `phone` | VARCHAR(50) | **NEW:** Staff phone (optional) |
| (none) | - | `is_active` | BOOLEAN | **NEW:** Active status, default true |
| `recordId` | Number | - | - | FileMaker internal, not migrated |

**Proposed Supabase Schema:**
```sql
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  title VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  profile_image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexes
  CONSTRAINT staff_email_org_unique UNIQUE (organization_id, email)
);

CREATE INDEX idx_staff_organization_id ON staff(organization_id);
CREATE INDEX idx_staff_name ON staff(name);
CREATE INDEX idx_staff_is_active ON staff(is_active);
```

### Projects Table (Update)

**FileMaker Layout:** `devProjects`
**Supabase Table:** `projects` (existing table, needs update)

**New Column to Add:**

| FileMaker Field | Type | Supabase Column | Type | Notes |
|----------------|------|-----------------|------|-------|
| `_teamID` | Text | `team_id` | UUID | **NEW:** FK to teams table (nullable) |

**Schema Update:**
```sql
-- Add team_id column to existing projects table
ALTER TABLE projects
ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

CREATE INDEX idx_projects_team_id ON projects(team_id);
```

## Data Type Conversions

### UUID Handling

**FileMaker `__ID` fields:**
- Check if already UUID format (e.g., `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"`)
- If UUID format: Preserve as-is
- If not UUID: Generate new UUID and create mapping table

**Mapping Table (if needed):**
```sql
CREATE TABLE filemaker_id_mappings (
  entity_type VARCHAR(50) NOT NULL,
  filemaker_id VARCHAR(255) NOT NULL,
  supabase_uuid UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (entity_type, filemaker_id)
);

CREATE INDEX idx_filemaker_mappings_uuid ON filemaker_id_mappings(supabase_uuid);
```

### Timestamp Conversions

**FileMaker Timestamps:**
- Format: `"MM/DD/YYYY HH:MM:SS"` (local time)
- Example: `"01/15/2024 10:30:00"`

**Supabase Timestamps:**
- Format: ISO 8601 with timezone
- Example: `"2024-01-15T10:30:00-05:00"` or `"2024-01-15T15:30:00Z"` (UTC)

**Conversion Logic:**
```javascript
function convertFileMakerTimestamp(fmTimestamp, timezone = 'America/Toronto') {
  // Parse FileMaker timestamp
  const parsed = moment.tz(fmTimestamp, "MM/DD/YYYY HH:mm:ss", timezone);

  // Convert to UTC
  return parsed.utc().toISOString();
}
```

### Image Data

**FileMaker:**
- Stored as base64 in `image_base64` field
- Example: `"data:image/png;base64,iVBORw0KGgoAAAANS..."`

**Supabase:**
- Store in Supabase Storage bucket
- Reference URL in `profile_image_url` field
- Example: `"https://supabase.claritybusinesssolutions.ca/storage/v1/object/public/staff-images/staff-456.png"`

**Migration Steps:**
1. Extract base64 data from FileMaker
2. Upload to Supabase Storage `staff-images` bucket
3. Get public URL
4. Store URL in `profile_image_url` column

## Relationship Structures

### Entity Relationship Diagram

```
organizations
    |
    | (1:N)
    |
teams ←──────┐
    |        │
    | (1:N)  │ (N:1)
    |        │
team_members │
    |        │
    | (N:1)  │
    |        │
staff ───────┘

projects (optional N:1 relationship with teams)
```

### Relationship Constraints

**teams → organizations**
- Constraint: `teams.organization_id` REFERENCES `organizations.id`
- On Delete: CASCADE (delete teams when organization deleted)
- On Update: CASCADE

**team_members → teams**
- Constraint: `team_members.team_id` REFERENCES `teams.id`
- On Delete: CASCADE (delete memberships when team deleted)
- On Update: CASCADE

**team_members → staff**
- Constraint: `team_members.staff_id` REFERENCES `staff.id`
- On Delete: CASCADE (delete memberships when staff deleted)
- On Update: CASCADE

**team_members → organizations**
- Constraint: `team_members.organization_id` REFERENCES `organizations.id`
- On Delete: CASCADE
- Check: Must match team's organization

**staff → organizations**
- Constraint: `staff.organization_id` REFERENCES `organizations.id`
- On Delete: CASCADE (delete staff when organization deleted)
- On Update: CASCADE

**projects → teams** (optional)
- Constraint: `projects.team_id` REFERENCES `teams.id`
- On Delete: SET NULL (nullify team assignment when team deleted)
- On Update: CASCADE

## Data Validation Rules

### Teams Table

**name:**
- Required (NOT NULL)
- Max length: 255 characters
- Must be unique within organization
- Trim whitespace on insert/update

**organization_id:**
- Required (NOT NULL)
- Must reference valid organization
- User must be member of organization

### Team Members Table

**team_id:**
- Required (NOT NULL)
- Must reference valid team
- Team must belong to same organization

**staff_id:**
- Required (NOT NULL)
- Must reference valid staff member
- Staff must belong to same organization
- Unique combination with team_id (no duplicates)

**role:**
- Optional
- Max length: 100 characters
- Examples: "Lead Developer", "Project Manager", "Designer"

### Staff Table

**name:**
- Required (NOT NULL)
- Max length: 255 characters
- Trim whitespace on insert/update

**title:**
- Optional
- Max length: 100 characters

**email:**
- Optional
- Max length: 255 characters
- Valid email format
- Unique within organization (if provided)

**organization_id:**
- Required (NOT NULL)
- Must reference valid organization

**is_active:**
- Required (NOT NULL)
- Default: true
- Used for soft deletes

## Migration Data Transformation

### Sample Team Migration

**FileMaker Record:**
```json
{
  "fieldData": {
    "__ID": "team-dev-001",
    "name": "Development Team",
    "~CreationTimestamp": "01/15/2024 10:30:00",
    "~ModificationTimestamp": "01/20/2024 14:45:00"
  },
  "recordId": "123"
}
```

**Supabase Record:**
```json
{
  "id": "team-dev-001",
  "organization_id": "org-uuid-from-context",
  "name": "Development Team",
  "created_at": "2024-01-15T15:30:00Z",
  "updated_at": "2024-01-20T19:45:00Z"
}
```

### Sample Team Member Migration

**FileMaker Record:**
```json
{
  "fieldData": {
    "__ID": "member-001",
    "_teamID": "team-dev-001",
    "_staffID": "staff-john-001",
    "role": "Lead Developer",
    "name": "John Doe",
    "~CreationTimestamp": "01/15/2024 11:00:00"
  },
  "recordId": "456"
}
```

**Supabase Record:**
```json
{
  "id": "member-001",
  "organization_id": "org-uuid-from-context",
  "team_id": "team-dev-001",
  "staff_id": "staff-john-001",
  "role": "Lead Developer",
  "created_at": "2024-01-15T16:00:00Z",
  "updated_at": "2024-01-15T16:00:00Z"
}
```

### Sample Staff Migration

**FileMaker Record:**
```json
{
  "fieldData": {
    "__ID": "staff-john-001",
    "name": "John Doe",
    "role": "Senior Developer",
    "image_base64": "data:image/png;base64,iVBORw0KGg...",
    "~CreationTimestamp": "01/10/2024 09:00:00"
  },
  "recordId": "789"
}
```

**Supabase Record:**
```json
{
  "id": "staff-john-001",
  "organization_id": "org-uuid-from-context",
  "name": "John Doe",
  "title": "Senior Developer",
  "email": null,
  "phone": null,
  "profile_image_url": "https://supabase.../staff-images/staff-john-001.png",
  "is_active": true,
  "created_at": "2024-01-10T14:00:00Z",
  "updated_at": "2024-01-10T14:00:00Z"
}
```

## Indexes and Performance

### Primary Indexes

All tables have primary key indexes on `id` column (automatic).

### Foreign Key Indexes

- `teams.organization_id`
- `team_members.team_id`
- `team_members.staff_id`
- `team_members.organization_id`
- `staff.organization_id`
- `projects.team_id`

### Search/Filter Indexes

- `teams`: Name search within organization
- `staff`: Name search, active status filter
- `team_members`: Composite (team_id, staff_id) for uniqueness

### Unique Constraints

- `teams`: (organization_id, name) - prevent duplicate team names
- `team_members`: (team_id, staff_id) - prevent duplicate assignments
- `staff`: (organization_id, email) - prevent duplicate emails (if provided)

## Triggers and Automation

### Updated At Trigger

Apply to all tables:

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_updated_at
  BEFORE UPDATE ON staff
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Organization Consistency Check

Ensure team members belong to same organization as team:

```sql
CREATE OR REPLACE FUNCTION check_team_member_organization()
RETURNS TRIGGER AS $$
BEGIN
  -- Verify team and staff are in same organization
  IF NOT EXISTS (
    SELECT 1
    FROM teams t
    JOIN staff s ON s.organization_id = t.organization_id
    WHERE t.id = NEW.team_id
      AND s.id = NEW.staff_id
      AND t.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Team and staff must belong to the same organization';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER verify_team_member_organization
  BEFORE INSERT OR UPDATE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION check_team_member_organization();
```

## Migration Checklist

### Pre-Migration

- [ ] Verify FileMaker `__ID` format (UUID vs other)
- [ ] Count records in each FileMaker layout
- [ ] Identify staff with profile images
- [ ] Verify organization IDs are available
- [ ] Create Supabase Storage bucket for staff images

### Schema Creation

- [ ] Create `teams` table with constraints
- [ ] Create `team_members` table with constraints
- [ ] Create `staff` table with constraints
- [ ] Add `team_id` column to `projects` table
- [ ] Create indexes
- [ ] Create triggers
- [ ] Apply RLS policies

### Data Migration

- [ ] Migrate staff records (with image upload)
- [ ] Migrate team records
- [ ] Migrate team member records
- [ ] Update project team assignments
- [ ] Verify record counts match
- [ ] Verify foreign key integrity
- [ ] Test sample queries

### Post-Migration

- [ ] Verify RLS policies work correctly
- [ ] Test organization isolation
- [ ] Verify cascade deletes
- [ ] Performance test with production data size
- [ ] Create ID mapping table (if needed)

---

**Related Documents:**
- `current-implementation.md`: Current FileMaker implementation details
- `api-contracts.md`: Backend API endpoints for Teams
- `authorization.md`: RLS policies and access control
- `migration-plan.md`: Detailed migration strategy
