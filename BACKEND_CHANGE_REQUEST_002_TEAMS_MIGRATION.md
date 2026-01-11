# Backend Change Request: Teams Migration to Supabase

**Request ID:** BACKEND_CHANGE_REQUEST_002_TEAMS_MIGRATION
**Date:** 2026-01-10
**Requester:** Frontend Team (via Claude)
**Priority:** High
**Target Release:** Q1 2026

---

## Executive Summary

This change request outlines the backend infrastructure changes required to migrate the Teams feature from FileMaker to Supabase as the single source of truth. This includes teams, staff, and team member assignments, along with project team relationships.

**Impact:**
- **Database:** Three new tables (`teams`, `staff`, `team_members`), one column addition (`projects.team_id`), RLS policies, triggers, and RPC functions
- **API:** REST endpoints for CRUD operations on teams, staff, and team assignments
- **Performance:** Improved query performance with proper indexing and organization-scoped access
- **Data Volume:** Estimated ~20-50 teams, ~50-100 staff members, ~100-300 team assignments

**Dependencies:**
- Organization structure must be stable (`organizations` table exists)
- Projects table must exist (verified - will add `team_id` column)
- User authentication system must provide `organization_id` in JWT claims
- Supabase Storage configured for staff profile images

---

## Table of Contents

1. [Database Schema Changes](#database-schema-changes)
2. [Row Level Security (RLS) Policies](#row-level-security-rls-policies)
3. [Database Triggers](#database-triggers)
4. [API Endpoints](#api-endpoints)
5. [RPC Functions](#rpc-functions)
6. [Indexes](#indexes)
7. [Migration Script](#migration-script)
8. [Testing Requirements](#testing-requirements)
9. [Rollback Plan](#rollback-plan)
10. [Performance Considerations](#performance-considerations)

---

## Database Schema Changes

### 1. Create `teams` Table

```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT teams_name_org_unique UNIQUE (organization_id, name)
);

-- Indexes
CREATE INDEX idx_teams_organization_id ON teams(organization_id);
CREATE INDEX idx_teams_name ON teams(name);

-- Comments
COMMENT ON TABLE teams IS 'Teams within organizations for project assignment and staff management';
COMMENT ON COLUMN teams.id IS 'Primary key, preserves FileMaker __ID if UUID format';
COMMENT ON COLUMN teams.organization_id IS 'Organization this team belongs to';
COMMENT ON COLUMN teams.name IS 'Team name, unique within organization';
```

**Validation Rules:**
- `name`: Required (NOT NULL), max 255 characters, unique per organization
- `organization_id`: Required (NOT NULL), must reference valid organization
- Whitespace trimmed on insert/update

---

### 2. Create `staff` Table

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

  -- Constraints
  CONSTRAINT staff_email_org_unique UNIQUE (organization_id, email)
);

-- Indexes
CREATE INDEX idx_staff_organization_id ON staff(organization_id);
CREATE INDEX idx_staff_name ON staff(name);
CREATE INDEX idx_staff_is_active ON staff(is_active);
CREATE INDEX idx_staff_email ON staff(email) WHERE email IS NOT NULL;

-- Comments
COMMENT ON TABLE staff IS 'Staff members who can be assigned to teams';
COMMENT ON COLUMN staff.id IS 'Primary key, preserves FileMaker __ID if UUID format';
COMMENT ON COLUMN staff.organization_id IS 'Organization this staff member belongs to';
COMMENT ON COLUMN staff.name IS 'Staff member full name';
COMMENT ON COLUMN staff.title IS 'Job title or position (maps from FileMaker role field)';
COMMENT ON COLUMN staff.email IS 'Email address, unique within organization if provided';
COMMENT ON COLUMN staff.phone IS 'Phone number';
COMMENT ON COLUMN staff.profile_image_url IS 'URL to profile image in Supabase Storage (migrated from FileMaker base64)';
COMMENT ON COLUMN staff.is_active IS 'Active status for soft deletes, defaults to true';
```

**Validation Rules:**
- `name`: Required (NOT NULL), max 255 characters
- `title`: Optional, max 100 characters
- `email`: Optional, max 255 characters, valid email format, unique per organization if provided
- `phone`: Optional, max 50 characters
- `organization_id`: Required (NOT NULL)
- `is_active`: Required (NOT NULL), defaults to true

---

### 3. Create `team_members` Table (Join Table)

```sql
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  role VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT team_members_unique UNIQUE (team_id, staff_id)
);

-- Indexes
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_staff_id ON team_members(staff_id);
CREATE INDEX idx_team_members_organization_id ON team_members(organization_id);

-- Comments
COMMENT ON TABLE team_members IS 'Join table linking staff members to teams with optional roles';
COMMENT ON COLUMN team_members.id IS 'Primary key';
COMMENT ON COLUMN team_members.organization_id IS 'Organization for scoping (must match team and staff organization)';
COMMENT ON COLUMN team_members.team_id IS 'Reference to team';
COMMENT ON COLUMN team_members.staff_id IS 'Reference to staff member';
COMMENT ON COLUMN team_members.role IS 'Optional role within team (e.g., "Lead Developer", "Designer")';
```

**Validation Rules:**
- `team_id`: Required (NOT NULL), must reference valid team in same organization
- `staff_id`: Required (NOT NULL), must reference valid staff in same organization
- `role`: Optional, max 100 characters
- `organization_id`: Required (NOT NULL), must match both team and staff organization
- Unique constraint on (team_id, staff_id) prevents duplicate assignments

---

### 4. Update `projects` Table

```sql
-- Add team_id column to existing projects table
ALTER TABLE projects
ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

-- Create index for team assignment queries
CREATE INDEX idx_projects_team_id ON projects(team_id);

-- Comment
COMMENT ON COLUMN projects.team_id IS 'Optional team assignment for project (nullable)';
```

**Migration Impact:**
- Nullable column - existing projects unaffected
- ON DELETE SET NULL - deleting team removes assignment but preserves project
- Allows gradual team assignment adoption

---

## Row Level Security (RLS) Policies

### Helper Functions

```sql
-- Get current user's organization ID from JWT claims
CREATE OR REPLACE FUNCTION auth.current_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid,
    NULL
  );
$$;

-- Check if user is authenticated
CREATE OR REPLACE FUNCTION auth.is_authenticated()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT auth.role() = 'authenticated';
$$;

-- Check team access
CREATE OR REPLACE FUNCTION auth.has_team_access(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM teams
    WHERE id = p_team_id
    AND organization_id = auth.current_organization_id()
  );
$$;

-- Check staff access
CREATE OR REPLACE FUNCTION auth.has_staff_access(p_staff_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff
    WHERE id = p_staff_id
    AND organization_id = auth.current_organization_id()
  );
$$;
```

---

### Teams Table RLS Policies

```sql
-- Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- SELECT policy
CREATE POLICY "Users can view teams in their organization"
ON teams
FOR SELECT
TO authenticated
USING (
  organization_id = auth.current_organization_id()
);

-- INSERT policy
CREATE POLICY "Users can create teams in their organization"
ON teams
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = auth.current_organization_id()
);

-- UPDATE policy
CREATE POLICY "Users can update teams in their organization"
ON teams
FOR UPDATE
TO authenticated
USING (
  organization_id = auth.current_organization_id()
)
WITH CHECK (
  organization_id = auth.current_organization_id()
);

-- DELETE policy
CREATE POLICY "Users can delete teams in their organization"
ON teams
FOR DELETE
TO authenticated
USING (
  organization_id = auth.current_organization_id()
);
```

---

### Staff Table RLS Policies

```sql
-- Enable RLS
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- SELECT policy
CREATE POLICY "Users can view staff in their organization"
ON staff
FOR SELECT
TO authenticated
USING (
  organization_id = auth.current_organization_id()
);

-- INSERT policy
CREATE POLICY "Users can create staff in their organization"
ON staff
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = auth.current_organization_id()
);

-- UPDATE policy
CREATE POLICY "Users can update staff in their organization"
ON staff
FOR UPDATE
TO authenticated
USING (
  organization_id = auth.current_organization_id()
)
WITH CHECK (
  organization_id = auth.current_organization_id()
);

-- DELETE policy
CREATE POLICY "Users can delete staff in their organization"
ON staff
FOR DELETE
TO authenticated
USING (
  organization_id = auth.current_organization_id()
);
```

---

### Team Members Table RLS Policies

```sql
-- Enable RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- SELECT policy
CREATE POLICY "Users can view team members in their organization"
ON team_members
FOR SELECT
TO authenticated
USING (
  organization_id = auth.current_organization_id()
);

-- INSERT policy
CREATE POLICY "Users can add team members in their organization"
ON team_members
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = auth.current_organization_id()
  AND EXISTS (
    SELECT 1 FROM teams
    WHERE id = team_id
    AND organization_id = auth.current_organization_id()
  )
  AND EXISTS (
    SELECT 1 FROM staff
    WHERE id = staff_id
    AND organization_id = auth.current_organization_id()
  )
);

-- UPDATE policy
CREATE POLICY "Users can update team members in their organization"
ON team_members
FOR UPDATE
TO authenticated
USING (
  organization_id = auth.current_organization_id()
)
WITH CHECK (
  organization_id = auth.current_organization_id()
);

-- DELETE policy
CREATE POLICY "Users can remove team members from their organization"
ON team_members
FOR DELETE
TO authenticated
USING (
  organization_id = auth.current_organization_id()
);
```

---

### Projects Table RLS Policy Update

```sql
-- Add policy for team assignment
CREATE POLICY "Users can update project team assignment in their organization"
ON projects
FOR UPDATE
TO authenticated
USING (
  organization_id = auth.current_organization_id()
)
WITH CHECK (
  organization_id = auth.current_organization_id()
  AND (
    team_id IS NULL
    OR EXISTS (
      SELECT 1 FROM teams
      WHERE id = team_id
      AND organization_id = auth.current_organization_id()
    )
  )
);
```

---

## Database Triggers

### Updated At Trigger

```sql
-- Trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to teams table
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply to staff table
CREATE TRIGGER update_staff_updated_at
  BEFORE UPDATE ON staff
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply to team_members table
CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

### Organization Consistency Check

```sql
-- Ensure team members belong to same organization as team and staff
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

---

## API Endpoints

### Team Endpoints

#### List Teams
**Endpoint:** `GET /api/teams`
**Query Params:**
- `include_stats` (boolean): Include team statistics
- `include_members` (boolean): Include member count

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "organization_id": "uuid",
      "name": "Development Team",
      "created_at": "2024-01-15T15:30:00Z",
      "updated_at": "2024-01-20T19:45:00Z",
      "stats": {
        "total_members": 5,
        "total_projects": 12,
        "active_projects": 8
      }
    }
  ],
  "count": 1
}
```

---

#### Get Team by ID
**Endpoint:** `GET /api/teams/:teamId`
**Query Params:**
- `include_members` (boolean): Include members array
- `include_projects` (boolean): Include projects array

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "organization_id": "uuid",
    "name": "Development Team",
    "created_at": "2024-01-15T15:30:00Z",
    "updated_at": "2024-01-20T19:45:00Z",
    "members": [
      {
        "id": "member-uuid",
        "staff_id": "staff-uuid",
        "role": "Lead Developer",
        "staff": {
          "id": "staff-uuid",
          "name": "John Doe",
          "title": "Senior Developer",
          "profile_image_url": "https://..."
        }
      }
    ],
    "projects": [
      {
        "id": "project-uuid",
        "name": "Website Redesign",
        "status": "Open"
      }
    ]
  }
}
```

---

#### Create Team
**Endpoint:** `POST /api/teams`
**Request Body:**
```json
{
  "name": "Marketing Team"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "organization_id": "uuid",
    "name": "Marketing Team",
    "created_at": "2024-01-22T10:00:00Z",
    "updated_at": "2024-01-22T10:00:00Z"
  }
}
```

**Validation:**
- `name`: Required, 1-255 characters, unique within organization

**Error Responses:**
- `400`: Validation error (missing name, duplicate name)
- `401`: Invalid/missing authentication
- `500`: Database error

---

#### Update Team
**Endpoint:** `PATCH /api/teams/:teamId`
**Request Body:**
```json
{
  "name": "Product Development Team"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "organization_id": "uuid",
    "name": "Product Development Team",
    "created_at": "2024-01-15T15:30:00Z",
    "updated_at": "2024-01-22T11:30:00Z"
  }
}
```

---

#### Delete Team
**Endpoint:** `DELETE /api/teams/:teamId`

**Response:**
```json
{
  "success": true,
  "message": "Team deleted successfully"
}
```

**Cascade Behavior:**
- Deletes all `team_members` records (CASCADE)
- Sets `projects.team_id` to NULL (SET NULL)

---

### Staff Endpoints

#### List Staff
**Endpoint:** `GET /api/staff`
**Query Params:**
- `is_active` (boolean): Filter by active status
- `search` (string): Search by name

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "organization_id": "uuid",
      "name": "John Doe",
      "title": "Senior Developer",
      "email": "john@example.com",
      "phone": "+1-555-0100",
      "profile_image_url": "https://...",
      "is_active": true,
      "created_at": "2024-01-10T14:00:00Z",
      "updated_at": "2024-01-10T14:00:00Z"
    }
  ],
  "count": 1
}
```

---

#### Create Staff
**Endpoint:** `POST /api/staff`
**Request Body:**
```json
{
  "name": "Jane Smith",
  "title": "Designer",
  "email": "jane@example.com",
  "phone": "+1-555-0200",
  "profile_image_url": null
}
```

**Response:** Staff object

**Validation:**
- `name`: Required, 1-255 characters
- `email`: Optional, valid email format, unique within organization
- `title`, `phone`, `profile_image_url`: Optional

---

#### Update Staff
**Endpoint:** `PATCH /api/staff/:staffId`

#### Delete Staff
**Endpoint:** `DELETE /api/staff/:staffId`

**Cascade Behavior:**
- Deletes all `team_members` records for this staff (CASCADE)

---

### Team Member Endpoints

#### Get Team Members
**Endpoint:** `GET /api/teams/:teamId/members`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "member-uuid",
      "team_id": "team-uuid",
      "staff_id": "staff-uuid",
      "role": "Lead Developer",
      "created_at": "2024-01-15T16:00:00Z",
      "updated_at": "2024-01-15T16:00:00Z",
      "staff": {
        "id": "staff-uuid",
        "name": "John Doe",
        "title": "Senior Developer",
        "profile_image_url": "https://...",
        "is_active": true
      }
    }
  ],
  "count": 1
}
```

---

#### Assign Staff to Team
**Endpoint:** `POST /api/teams/:teamId/members`

**Request Body (Single):**
```json
{
  "staff_id": "staff-uuid",
  "role": "Lead Developer"
}
```

**Request Body (Bulk):**
```json
{
  "members": [
    { "staff_id": "staff-uuid-1", "role": "Lead" },
    { "staff_id": "staff-uuid-2", "role": "Member" }
  ]
}
```

**Response:** Array of created team member objects

**Validation:**
- `staff_id`: Required, must exist in organization
- `role`: Optional, max 100 characters
- Duplicate (team_id, staff_id) rejected

---

#### Update Team Member Role
**Endpoint:** `PATCH /api/teams/:teamId/members/:memberId`

**Request Body:**
```json
{
  "role": "Senior Developer"
}
```

---

#### Remove Staff from Team
**Endpoint:** `DELETE /api/teams/:teamId/members/:memberId`

**Response:**
```json
{
  "success": true,
  "message": "Team member removed successfully"
}
```

---

### Project Assignment Endpoints

#### Get Team Projects
**Endpoint:** `GET /api/teams/:teamId/projects`

**Response:** Array of project objects with `team_id` field

---

#### Assign/Remove Project Team
**Endpoint:** `PATCH /api/projects/:projectId`

**Request Body:**
```json
{
  "team_id": "team-uuid"  // or null to remove
}
```

**Validation:**
- `team_id`: Must be valid team ID in same organization, or null

---

## RPC Functions

### 1. `rpc_get_team_statistics` - Team Statistics

**Purpose:** Get comprehensive team statistics including members, projects, and tasks.

```sql
CREATE OR REPLACE FUNCTION rpc_get_team_statistics(
  p_team_id UUID,
  p_organization_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stats JSON;
BEGIN
  -- Verify organization access
  IF NOT EXISTS (
    SELECT 1 FROM teams
    WHERE id = p_team_id AND organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'Team not found or access denied';
  END IF;

  -- Calculate statistics
  SELECT json_build_object(
    'team_id', p_team_id,
    'total_members', (
      SELECT COUNT(*) FROM team_members
      WHERE team_id = p_team_id
    ),
    'total_projects', (
      SELECT COUNT(*) FROM projects
      WHERE team_id = p_team_id
    ),
    'active_projects', (
      SELECT COUNT(*) FROM projects
      WHERE team_id = p_team_id AND status = 'Open'
    ),
    'completed_projects', (
      SELECT COUNT(*) FROM projects
      WHERE team_id = p_team_id AND status = 'Closed'
    ),
    'total_tasks', (
      SELECT COUNT(*) FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE p.team_id = p_team_id
    ),
    'completed_tasks', (
      SELECT COUNT(*) FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE p.team_id = p_team_id AND t.completed = true
    )
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_get_team_statistics TO authenticated;
```

**Usage:**
```javascript
const { data, error } = await supabase.rpc('rpc_get_team_statistics', {
  p_team_id: 'team-uuid',
  p_organization_id: 'org-uuid'
});
```

---

### 2. `rpc_assign_staff_to_team_bulk` - Bulk Staff Assignment

**Purpose:** Assign multiple staff members to a team in a single transaction.

```sql
CREATE OR REPLACE FUNCTION rpc_assign_staff_to_team_bulk(
  p_team_id UUID,
  p_organization_id UUID,
  p_members JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member JSONB;
  v_added_count INT := 0;
  v_results JSON;
BEGIN
  -- Verify team access
  IF NOT auth.has_team_access(p_team_id) THEN
    RAISE EXCEPTION 'Team not found or access denied';
  END IF;

  -- Insert each member
  FOR v_member IN SELECT * FROM jsonb_array_elements(p_members)
  LOOP
    INSERT INTO team_members (
      organization_id,
      team_id,
      staff_id,
      role
    ) VALUES (
      p_organization_id,
      p_team_id,
      (v_member->>'staff_id')::UUID,
      v_member->>'role'
    )
    ON CONFLICT (team_id, staff_id) DO NOTHING;

    IF FOUND THEN
      v_added_count := v_added_count + 1;
    END IF;
  END LOOP;

  -- Build response
  SELECT json_build_object(
    'success', true,
    'added', v_added_count
  ) INTO v_results;

  RETURN v_results;
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_assign_staff_to_team_bulk TO authenticated;
```

---

## Indexes

### Performance Indexes

```sql
-- Teams table
CREATE INDEX idx_teams_organization_id ON teams(organization_id);
CREATE INDEX idx_teams_name ON teams(name);

-- Staff table
CREATE INDEX idx_staff_organization_id ON staff(organization_id);
CREATE INDEX idx_staff_name ON staff(name);
CREATE INDEX idx_staff_is_active ON staff(is_active);
CREATE INDEX idx_staff_email ON staff(email) WHERE email IS NOT NULL;

-- Team members table
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_staff_id ON team_members(staff_id);
CREATE INDEX idx_team_members_organization_id ON team_members(organization_id);

-- Projects table (new)
CREATE INDEX idx_projects_team_id ON projects(team_id);

-- Composite indexes for common queries
CREATE INDEX idx_team_members_team_staff ON team_members(team_id, staff_id);
CREATE INDEX idx_teams_org_name ON teams(organization_id, name);
```

**Expected Index Sizes:**
- Total index overhead: ~2-5 MB (estimated for 50 teams, 100 staff, 300 memberships)
- Query performance improvement: 10-100x for organization-scoped queries

---

## Migration Script

### FileMaker to Supabase ETL

**Script:** `migrate_teams_data.js`

```javascript
const { createClient } = require('@supabase/supabase-js');
const FileMaker = require('filemaker'); // FileMaker Data API client

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_ORG_ID = process.env.DEFAULT_ORGANIZATION_ID;

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const fm = new FileMaker({
  host: process.env.FM_HOST,
  database: 'clarityCRM',
  user: process.env.FM_USER,
  password: process.env.FM_PASSWORD
});

async function migrateTeams() {
  console.log('Starting Teams migration...');

  // Step 1: Extract staff from FileMaker
  console.log('Extracting staff...');
  const fmStaff = await fm.find({
    layout: 'devStaff',
    query: [{ __ID: '*' }]
  });

  // Step 2: Transform and migrate staff (with image upload)
  console.log(`Migrating ${fmStaff.length} staff members...`);
  const staffMapping = new Map();

  for (const s of fmStaff) {
    const staffId = s.fieldData.__ID;
    let profileImageUrl = null;

    // Upload image if present
    if (s.fieldData.image_base64) {
      profileImageUrl = await uploadStaffImage(staffId, s.fieldData.image_base64);
    }

    const { data, error } = await supabase
      .from('staff')
      .insert({
        id: staffId,
        organization_id: DEFAULT_ORG_ID,
        name: s.fieldData.name,
        title: s.fieldData.role || null,
        profile_image_url: profileImageUrl,
        is_active: true,
        created_at: convertTimestamp(s.fieldData['~CreationTimestamp']),
        updated_at: convertTimestamp(s.fieldData['~ModificationTimestamp'])
      })
      .select()
      .single();

    if (error) {
      console.error(`Failed to migrate staff ${staffId}:`, error);
    } else {
      staffMapping.set(staffId, data.id);
      console.log(`Migrated staff: ${s.fieldData.name}`);
    }
  }

  // Step 3: Extract teams
  console.log('Extracting teams...');
  const fmTeams = await fm.find({
    layout: 'devTeams',
    query: [{ __ID: '*' }]
  });

  // Step 4: Migrate teams
  console.log(`Migrating ${fmTeams.length} teams...`);
  const teamMapping = new Map();

  for (const t of fmTeams) {
    const teamId = t.fieldData.__ID;

    const { data, error } = await supabase
      .from('teams')
      .insert({
        id: teamId,
        organization_id: DEFAULT_ORG_ID,
        name: t.fieldData.name,
        created_at: convertTimestamp(t.fieldData['~CreationTimestamp']),
        updated_at: convertTimestamp(t.fieldData['~ModificationTimestamp'])
      })
      .select()
      .single();

    if (error) {
      console.error(`Failed to migrate team ${teamId}:`, error);
    } else {
      teamMapping.set(teamId, data.id);
      console.log(`Migrated team: ${t.fieldData.name}`);
    }
  }

  // Step 5: Extract team members
  console.log('Extracting team members...');
  const fmMembers = await fm.find({
    layout: 'devTeamMembers',
    query: [{ __ID: '*' }]
  });

  // Step 6: Migrate team members
  console.log(`Migrating ${fmMembers.length} team member assignments...`);
  let successCount = 0;
  let failCount = 0;

  for (const m of fmMembers) {
    const { error } = await supabase
      .from('team_members')
      .insert({
        id: m.fieldData.__ID,
        organization_id: DEFAULT_ORG_ID,
        team_id: m.fieldData._teamID,
        staff_id: m.fieldData._staffID,
        role: m.fieldData.role || null,
        created_at: convertTimestamp(m.fieldData['~CreationTimestamp']),
        updated_at: convertTimestamp(m.fieldData['~ModificationTimestamp'])
      });

    if (error) {
      console.error(`Failed to migrate member ${m.fieldData.__ID}:`, error);
      failCount++;
    } else {
      successCount++;
    }
  }

  console.log(`\nMigration Summary:`);
  console.log(`Staff: ${staffMapping.size} migrated`);
  console.log(`Teams: ${teamMapping.size} migrated`);
  console.log(`Team Members: ${successCount} migrated, ${failCount} failed`);

  // Step 7: Validation
  await validateMigration();
}

async function uploadStaffImage(staffId, base64Data) {
  try {
    // Extract base64 content
    const matches = base64Data.match(/^data:(.+);base64,(.+)$/);
    if (!matches) return null;

    const mimeType = matches[1];
    const base64Content = matches[2];
    const buffer = Buffer.from(base64Content, 'base64');

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('staff-images')
      .upload(`${staffId}.png`, buffer, {
        contentType: mimeType,
        upsert: true
      });

    if (error) {
      console.error(`Image upload failed for ${staffId}:`, error);
      return null;
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('staff-images')
      .getPublicUrl(`${staffId}.png`);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error(`Image processing error for ${staffId}:`, err);
    return null;
  }
}

function convertTimestamp(fmTimestamp) {
  // Convert FileMaker timestamp (MM/DD/YYYY HH:MM:SS) to ISO 8601
  const moment = require('moment-timezone');
  return moment.tz(fmTimestamp, 'MM/DD/YYYY HH:mm:ss', 'America/Toronto')
    .utc()
    .toISOString();
}

async function validateMigration() {
  console.log('\nValidating migration...');

  const { count: teamCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true });

  const { count: staffCount } = await supabase
    .from('staff')
    .select('*', { count: 'exact', head: true });

  const { count: memberCount } = await supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true });

  console.log(`Validation - Teams: ${teamCount}, Staff: ${staffCount}, Members: ${memberCount}`);

  // Verify foreign key integrity
  const { data: orphanedMembers } = await supabase
    .from('team_members')
    .select(`
      id,
      teams!inner(id),
      staff!inner(id)
    `);

  if (orphanedMembers.length !== memberCount) {
    console.error('WARNING: Found orphaned team members!');
  } else {
    console.log('✓ All foreign key relationships valid');
  }
}

// Run migration
migrateTeams()
  .then(() => console.log('Migration complete!'))
  .catch(err => console.error('Migration failed:', err));
```

---

## Testing Requirements

### Unit Tests

**Test Cases:**

1. **RLS Policies**
   - Users can only view teams in their organization
   - Users cannot view teams from other organizations
   - Users cannot insert teams with wrong organization_id
   - Users cannot update teams in other organizations
   - Users cannot delete teams in other organizations
   - Same tests for staff and team_members tables

2. **Database Constraints**
   - Unique constraint on (organization_id, name) for teams
   - Unique constraint on (team_id, staff_id) for team_members
   - Unique constraint on (organization_id, email) for staff
   - Foreign key cascade deletes work correctly
   - Organization consistency trigger prevents mismatched orgs

3. **RPC Functions**
   - `rpc_get_team_statistics` returns accurate counts
   - `rpc_assign_staff_to_team_bulk` handles duplicates gracefully
   - Access denied exceptions raised for unauthorized access

---

### Integration Tests

1. **Full Team Workflow**
   - Create team → Add staff → Assign to project → View statistics
   - Verify all relationships maintained
   - Test cascade deletes

2. **Organization Isolation**
   - Create teams in two different organizations
   - Verify each organization can only access their own data
   - Verify RLS prevents cross-organization queries

3. **Migration Validation**
   - Migrate sample FileMaker dataset
   - Verify record counts match
   - Verify all relationships preserved
   - Verify image uploads successful

---

### Performance Tests

```sql
-- Load test: Insert 100 teams, 200 staff, 500 memberships
-- Query test: List teams with stats (should use indexes)
EXPLAIN ANALYZE
SELECT t.*,
  (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count
FROM teams t
WHERE organization_id = '{{ORG_ID}}';
```

**Expected Results:**
- Query execution: < 200ms for 100 teams
- Index usage: Should use `idx_teams_organization_id`
- No sequential scans

---

## Rollback Plan

### Immediate Rollback

```sql
-- Drop tables (cascade removes dependent objects)
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS staff CASCADE;

-- Remove team_id column from projects
ALTER TABLE projects DROP COLUMN IF EXISTS team_id;

-- Drop RPC functions
DROP FUNCTION IF EXISTS rpc_get_team_statistics(UUID, UUID);
DROP FUNCTION IF EXISTS rpc_assign_staff_to_team_bulk(UUID, UUID, JSONB);

-- Drop helper functions
DROP FUNCTION IF EXISTS auth.has_team_access(UUID);
DROP FUNCTION IF EXISTS auth.has_staff_access(UUID);

-- Drop triggers and trigger functions
DROP TRIGGER IF EXISTS verify_team_member_organization ON team_members;
DROP FUNCTION IF EXISTS check_team_member_organization();
```

### Data Backup

```bash
# Pre-migration backup
pg_dump -U postgres -d postgres \
  -t teams -t staff -t team_members \
  --data-only > teams_backup.sql

# Restore if needed
psql -U postgres -d postgres < teams_backup.sql
```

### Frontend Rollback

- Revert frontend code to use FileMaker API
- Re-enable FileMaker bridge for teams operations
- Keep migrated data in Supabase (no data loss)

---

## Performance Considerations

### Query Optimization

**Index Strategy:**
- Organization queries: Use `idx_teams_organization_id`, `idx_staff_organization_id`
- Team member lookups: Use `idx_team_members_team_id`, `idx_team_members_staff_id`
- Staff search: Use `idx_staff_name` with ILIKE for partial matching
- Active staff filter: Use `idx_staff_is_active`

**Expected Query Performance:**
| Operation | Target | Max Acceptable |
|-----------|--------|----------------|
| List teams | < 200ms | < 500ms |
| Get team details | < 300ms | < 800ms |
| List staff | < 200ms | < 500ms |
| Assign staff | < 400ms | < 1000ms |
| Team statistics | < 500ms | < 1500ms |

---

### Scaling Considerations

**Current Volume:**
- Teams: ~20-50
- Staff: ~50-100
- Team Members: ~100-300
- Projects with team assignment: ~50-200

**Growth Projection:**
- 5-year estimate: 200 teams, 500 staff, 1500 memberships
- No partitioning needed at current/projected scale
- Standard indexes sufficient

---

## Approval Checklist

Before approving this change request, verify:

- [ ] Database schema reviewed and approved
- [ ] RLS policies tested on staging
- [ ] Triggers tested for organization consistency
- [ ] API endpoints designed and documented
- [ ] RPC functions implemented and tested
- [ ] Indexes created and query plans verified
- [ ] Migration script tested with sample data
- [ ] Rollback procedure tested
- [ ] Performance benchmarks meet targets
- [ ] Security review completed (RLS, SECURITY DEFINER)
- [ ] Supabase Storage bucket created for staff images
- [ ] Frontend team notified of API contracts
- [ ] Database backup scheduled before migration
- [ ] Deployment window scheduled

---

## Deployment Steps

### Pre-Deployment (1 week before)

1. Review and approve change request
2. Create Supabase Storage bucket `staff-images`
3. Schedule deployment window (weekend preferred)
4. Create database backup
5. Notify frontend team of schema/API availability date

### Deployment (Day of)

**Estimated Total Time:** 90 minutes

1. **Create helper functions** (5 min)
2. **Create tables** (10 min)
   - teams, staff, team_members
   - Add projects.team_id column
3. **Create indexes** (5 min)
4. **Apply RLS policies** (10 min)
5. **Create triggers** (5 min)
6. **Create RPC functions** (10 min)
7. **Test schema and policies** (15 min)
8. **Run migration script** (20 min)
   - Extract FileMaker data
   - Transform and load to Supabase
   - Upload staff images
9. **Validate migration** (10 min)
   - Verify record counts
   - Test sample queries
   - Verify foreign keys
10. **Notify frontend team** (deployment complete)

### Post-Deployment (1 week after)

- Monitor query performance
- Review slow query logs
- Collect user feedback
- Address any issues
- Remove FileMaker dependencies (after frontend migration)

**Estimated Downtime:** None (backward compatible - FileMaker still works during transition)

---

## Questions & Clarifications

**Q1:** Should we preserve FileMaker IDs as UUIDs in Supabase?
**A:** Yes, if FileMaker `__ID` is already UUID format, preserve it. Otherwise generate new UUIDs and create mapping table.

**Q2:** How should we handle staff without profile images?
**A:** Set `profile_image_url` to NULL. Frontend can display default avatar.

**Q3:** Should staff email be required?
**A:** No, make it optional. Some organizations may not track staff emails. If provided, enforce unique constraint within organization.

**Q4:** What happens to projects when a team is deleted?
**A:** `projects.team_id` is set to NULL (ON DELETE SET NULL). Projects remain but lose team assignment.

**Q5:** Should we support multiple organizations per team/staff?
**A:** No, maintain 1:1 relationship. Each team/staff belongs to exactly one organization. This simplifies RLS and matches current FileMaker model.

---

## Contact

**Frontend Team Lead:** Marcus Swift
**Backend Team Lead:** [Backend Team Contact]
**Database Administrator:** [DBA Contact]

**Slack Channel:** #teams-supabase-migration

---

**Document Version:** 1.0
**Status:** Awaiting Backend Team Approval
**Last Updated:** 2026-01-10
