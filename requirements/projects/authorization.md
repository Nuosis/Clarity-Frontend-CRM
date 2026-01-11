# Authorization Requirements - Projects Migration

## Overview

This document specifies Row-Level Security (RLS) policies, organization scoping, role-based permissions, and access control requirements for migrating the Projects feature from FileMaker to Supabase.

**Document Version**: 1.0
**Last Updated**: 2026-01-10
**Status**: Requirements Definition
**Related Documents**:
- [API Contracts](./api-contracts.md)
- [Data Model Mapping](./data-model-mapping.md)
- [Migration Plan](./migration-plan.md)
- [Current Implementation](./current-implementation.md)

---

## Table of Contents

1. [Authorization Model Overview](#authorization-model-overview)
2. [Organization Scoping](#organization-scoping)
3. [Role Definitions](#role-definitions)
4. [Row-Level Security Policies](#row-level-security-policies)
5. [Team-Based Access Control](#team-based-access-control)
6. [Customer Relationship Authorization](#customer-relationship-authorization)
7. [Backend Service Role Access](#backend-service-role-access)
8. [Permission Matrix](#permission-matrix)
9. [Frontend Authorization Logic](#frontend-authorization-logic)
10. [Edge Cases & Security Considerations](#edge-cases--security-considerations)
11. [Testing RLS Policies](#testing-rls-policies)
12. [Audit Logging](#audit-logging)

---

## Authorization Model Overview

### Multi-Tenancy Model

**Architecture**: Organization-based complete data isolation
**Authorization Layer**: Supabase Row-Level Security (RLS) policies
**Authentication**: Supabase JWT with custom claims (`organization_id`, `role`)
**Permission Model**: Role-based access control (RBAC) with team-based enhancements

### Security Layers

The Clarity CRM implements defense-in-depth with three security layers:

1. **Database RLS Policies** (Authoritative)
   - Enforced at PostgreSQL level via Supabase RLS
   - Cannot be bypassed by frontend code
   - Applies to all queries, even direct Supabase client access
   - Located: Database schema migrations

2. **Backend API Validation** (Application-level)
   - Business logic validation (fixed price/subscription logic)
   - HMAC-SHA256 request authentication
   - Organization context extraction from JWT
   - Cross-entity validation (customer, team, project relationships)
   - Located: `src/services/dataService.js`, `src/services/projectService.js`

3. **Frontend Permissions** (UI/UX only)
   - Hide/disable UI elements based on role
   - Improve user experience (not security)
   - Optional permission hooks for conditional rendering
   - Located: `src/context/ProjectContext.jsx`, `src/hooks/useProject.js`

**Important**: Frontend checks are for UX only. RLS policies are the authoritative security enforcement.

### Key Characteristics

Projects and all related tables (objectives, steps, images, links, notes, time records) must be scoped to organizations and protected by RLS policies. Access control is based on:

1. **Organization membership**: Users can only access projects belonging to their organization
2. **Customer relationship**: Projects are linked to customers; must validate same-org relationship
3. **Team membership**: Team members have enhanced permissions for projects assigned to their team
4. **User roles**: Admin, staff, and read-only roles have different capabilities
5. **Resource ownership**: Users who created a resource may have special permissions (notes, time entries)

## Organization Scoping

### Multi-Tenancy Requirements

1. **Complete Data Isolation**: Users can ONLY access projects belonging to their organization
2. **Automatic Scoping**: All queries automatically filtered by `organization_id` via RLS
3. **No Cross-Org Leakage**: Even with direct Supabase queries, users cannot access other organizations' data
4. **Customer Relationship Validation**: Projects must belong to customers in the same organization

### JWT Claims Structure

Supabase JWT must include custom claims in the `app_metadata` section:

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "app_metadata": {
    "organization_id": "org-uuid",
    "role": "admin"
  },
  "user_metadata": {
    "first_name": "John",
    "last_name": "Doe"
  },
  "aud": "authenticated",
  "exp": 1704067200,
  "iat": 1704063600
}
```

**Required Claims**:
- `app_metadata.organization_id` (UUID) - User's current organization
- `app_metadata.role` (string) - User's role within organization (`admin`, `staff`, `read_only`)

**JWT Claim Access in RLS Policies**:
```sql
-- Extract organization_id from JWT
(current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid

-- Extract role from JWT
(current_setting('request.jwt.claims', true)::json->>'role')

-- Extract user ID from JWT
(current_setting('request.jwt.claims', true)::json->>'sub')::uuid
```

**Frontend JWT Management**: See `src/components/auth/SignIn.jsx:82-117` for Supabase authentication flow.

### Tables Requiring organization_id

| Table | organization_id Source |
|-------|------------------------|
| `projects` | Direct field (from user creating project) |
| `project_objectives` | Inherited from parent project |
| `project_objective_steps` | Inherited from parent objective → project |
| `project_images` | Inherited from parent project |
| `links` (shared table) | Direct field (organization of associated entity) |
| `notes` (planned) | Direct field (organization of associated entity) |
| `time_entries` / `customer_sales` | Direct field (from user creating entry) |

### Inheritance Pattern

For nested resources, `organization_id` is inherited from parent:

```sql
-- Example: Creating a project objective
INSERT INTO project_objectives (project_id, objective, organization_id)
VALUES (
  'uuid-project-456',
  'Complete homepage design',
  (SELECT organization_id FROM projects WHERE id = 'uuid-project-456')
);
```

## Row-Level Security Policies

### projects Table Policies

```sql
-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- SELECT Policy: Users can view projects in their organization
CREATE POLICY projects_select_policy
ON projects FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM user_organizations
    WHERE user_id = auth.uid()
  )
);

-- INSERT Policy: Users can create projects in their organization
CREATE POLICY projects_insert_policy
ON projects FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM user_organizations
    WHERE user_id = auth.uid() AND role IN ('admin', 'staff')
  )
);

-- UPDATE Policy: Admins and staff can update projects in their organization
CREATE POLICY projects_update_policy
ON projects FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM user_organizations
    WHERE user_id = auth.uid() AND role IN ('admin', 'staff')
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM user_organizations
    WHERE user_id = auth.uid() AND role IN ('admin', 'staff')
  )
);

-- DELETE Policy: Only admins can delete projects
CREATE POLICY projects_delete_policy
ON projects FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM user_organizations
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
```

### project_objectives Table Policies

```sql
-- Enable RLS
ALTER TABLE project_objectives ENABLE ROW LEVEL SECURITY;

-- SELECT Policy: Users can view objectives for projects in their organization
CREATE POLICY project_objectives_select_policy
ON project_objectives FOR SELECT
USING (
  project_id IN (
    SELECT id FROM projects
    WHERE organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid()
    )
  )
);

-- INSERT Policy: Staff can create objectives in their organization's projects
CREATE POLICY project_objectives_insert_policy
ON project_objectives FOR INSERT
WITH CHECK (
  project_id IN (
    SELECT id FROM projects
    WHERE organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid() AND role IN ('admin', 'staff')
    )
  )
);

-- UPDATE Policy: Staff can update objectives in their organization's projects
CREATE POLICY project_objectives_update_policy
ON project_objectives FOR UPDATE
USING (
  project_id IN (
    SELECT id FROM projects
    WHERE organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid() AND role IN ('admin', 'staff')
    )
  )
);

-- DELETE Policy: Staff can delete objectives in their organization's projects
CREATE POLICY project_objectives_delete_policy
ON project_objectives FOR DELETE
USING (
  project_id IN (
    SELECT id FROM projects
    WHERE organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid() AND role IN ('admin', 'staff')
    )
  )
);
```

### project_objective_steps Table Policies

```sql
-- Enable RLS
ALTER TABLE project_objective_steps ENABLE ROW LEVEL SECURITY;

-- SELECT Policy: Users can view steps for objectives in their organization's projects
CREATE POLICY project_steps_select_policy
ON project_objective_steps FOR SELECT
USING (
  objective_id IN (
    SELECT o.id FROM project_objectives o
    JOIN projects p ON o.project_id = p.id
    WHERE p.organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid()
    )
  )
);

-- INSERT Policy: Staff can create steps in their organization's project objectives
CREATE POLICY project_steps_insert_policy
ON project_objective_steps FOR INSERT
WITH CHECK (
  objective_id IN (
    SELECT o.id FROM project_objectives o
    JOIN projects p ON o.project_id = p.id
    WHERE p.organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid() AND role IN ('admin', 'staff')
    )
  )
);

-- UPDATE Policy: Staff can update steps
CREATE POLICY project_steps_update_policy
ON project_objective_steps FOR UPDATE
USING (
  objective_id IN (
    SELECT o.id FROM project_objectives o
    JOIN projects p ON o.project_id = p.id
    WHERE p.organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid() AND role IN ('admin', 'staff')
    )
  )
);

-- DELETE Policy: Staff can delete steps
CREATE POLICY project_steps_delete_policy
ON project_objective_steps FOR DELETE
USING (
  objective_id IN (
    SELECT o.id FROM project_objectives o
    JOIN projects p ON o.project_id = p.id
    WHERE p.organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid() AND role IN ('admin', 'staff')
    )
  )
);
```

### project_images Table Policies

```sql
-- Enable RLS
ALTER TABLE project_images ENABLE ROW LEVEL SECURITY;

-- SELECT Policy: Users can view images for projects in their organization
CREATE POLICY project_images_select_policy
ON project_images FOR SELECT
USING (
  project_id IN (
    SELECT id FROM projects
    WHERE organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid()
    )
  )
);

-- INSERT Policy: Staff can create images
CREATE POLICY project_images_insert_policy
ON project_images FOR INSERT
WITH CHECK (
  project_id IN (
    SELECT id FROM projects
    WHERE organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid() AND role IN ('admin', 'staff')
    )
  )
);

-- DELETE Policy: Staff can delete images (no UPDATE - images are immutable)
CREATE POLICY project_images_delete_policy
ON project_images FOR DELETE
USING (
  project_id IN (
    SELECT id FROM projects
    WHERE organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid() AND role IN ('admin', 'staff')
    )
  )
);
```

### links Table Policies (Shared Table)

```sql
-- Enable RLS (if not already enabled)
ALTER TABLE links ENABLE ROW LEVEL SECURITY;

-- SELECT Policy: Users can view links for entities in their organization
CREATE POLICY links_select_policy
ON links FOR SELECT
USING (
  (project_id IS NOT NULL AND project_id IN (
    SELECT id FROM projects
    WHERE organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  )) OR
  (customer_id IS NOT NULL AND customer_id IN (
    SELECT id FROM customers
    WHERE organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  ))
  -- Add other entity types as needed
);

-- INSERT Policy: Staff can create links for entities in their organization
CREATE POLICY links_insert_policy
ON links FOR INSERT
WITH CHECK (
  (project_id IS NOT NULL AND project_id IN (
    SELECT id FROM projects
    WHERE organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid() AND role IN ('admin', 'staff')
    )
  )) OR
  (customer_id IS NOT NULL AND customer_id IN (
    SELECT id FROM customers
    WHERE organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid() AND role IN ('admin', 'staff')
    )
  ))
  -- Add other entity types as needed
);

-- UPDATE Policy: Staff can update links
CREATE POLICY links_update_policy
ON links FOR UPDATE
USING (
  (project_id IS NOT NULL AND project_id IN (
    SELECT id FROM projects
    WHERE organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid() AND role IN ('admin', 'staff')
    )
  )) OR
  (customer_id IS NOT NULL AND customer_id IN (
    SELECT id FROM customers
    WHERE organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid() AND role IN ('admin', 'staff')
    )
  ))
);

-- DELETE Policy: Staff can delete links
CREATE POLICY links_delete_policy
ON links FOR DELETE
USING (
  (project_id IS NOT NULL AND project_id IN (
    SELECT id FROM projects
    WHERE organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid() AND role IN ('admin', 'staff')
    )
  )) OR
  (customer_id IS NOT NULL AND customer_id IN (
    SELECT id FROM customers
    WHERE organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid() AND role IN ('admin', 'staff')
    )
  ))
);
```

## Role Definitions

### 1. Admin

**Full CRUD access** to all projects and related entities in organization

**Permissions**:
- Create, read, update, delete projects
- Manage objectives, steps, images, links, notes
- Update project status (Open/Closed)
- Assign/reassign teams to projects
- Delete projects (unique to admin)
- View all time entries and billable hours
- Manage fixed price and subscription project settings
- Generate sales records from project completion

**Use Cases**:
- Organization owners
- Project managers with full authority
- System administrators

### 2. Staff

**Create/Read/Update access** (no delete) to projects

**Permissions**:
- Create new projects
- Read project details, objectives, steps, images, links
- Update project information
- Update project status (Open/Closed)
- Manage objectives, steps, images, links
- Create/update their own notes
- Create their own time entries
- Toggle objective/step completion status
- **Cannot delete** projects
- **Cannot delete** other users' notes
- View time entry summaries (limited to project totals)

**Use Cases**:
- Team members
- Developers/designers
- Account coordinators

### 3. Read-Only

**Read-only access** to projects

**Permissions**:
- View project list
- View project details
- View objectives, steps, images, links
- View project notes (read-only)
- **Cannot create, update, or delete** any project data
- **Cannot toggle** status or completion flags
- **Cannot view** detailed time entries or billable hours
- **Cannot view** financial data (project value, sales records)

**Use Cases**:
- Clients (external stakeholders)
- Observers
- Reporting users
- Auditors

### 4. External (Future Enhancement)

**Project-scoped read-only access**

**Permissions**:
- Can only view specific projects they're assigned to
- Read-only access to limited fields (no financial data, no internal notes)
- Cannot see project list (only direct links to assigned projects)
- Access mediated through project assignments table

**Use Cases**:
- External contractors
- Client stakeholders
- Third-party vendors

**Implementation Status**: Defined in requirements but not implemented. Requires additional RLS policies and project_assignments table.

### Permission Matrix

| Operation | Admin | Staff | Read-Only |
|-----------|-------|-------|-----------|
| **Projects** |
| List projects | ✅ | ✅ | ✅ |
| View project details | ✅ | ✅ | ✅ |
| Create project | ✅ | ✅ | ❌ |
| Update project | ✅ | ✅ | ❌ |
| Delete project | ✅ | ❌ | ❌ |
| Update project status | ✅ | ✅ | ❌ |
| Assign team | ✅ | ✅ | ❌ |
| **Objectives** |
| List objectives | ✅ | ✅ | ✅ |
| Create objective | ✅ | ✅ | ❌ |
| Update objective | ✅ | ✅ | ❌ |
| Delete objective | ✅ | ✅ | ❌ |
| Toggle completion | ✅ | ✅ | ❌ |
| Reorder objectives | ✅ | ✅ | ❌ |
| **Steps** |
| List steps | ✅ | ✅ | ✅ |
| Create step | ✅ | ✅ | ❌ |
| Update step | ✅ | ✅ | ❌ |
| Delete step | ✅ | ✅ | ❌ |
| Toggle completion | ✅ | ✅ | ❌ |
| **Images** |
| View images | ✅ | ✅ | ✅ |
| Upload image | ✅ | ✅ | ❌ |
| Delete image | ✅ | ✅ | ❌ |
| **Links** |
| View links | ✅ | ✅ | ✅ |
| Create link | ✅ | ✅ | ❌ |
| Update link | ✅ | ✅ | ❌ |
| Delete link | ✅ | ✅ | ❌ |
| **Notes** |
| View notes | ✅ | ✅ | ✅ |
| Create note | ✅ | ✅ | ❌ |
| Update note | ✅ | ✅ (own only) | ❌ |
| Delete note | ✅ | ✅ (own only) | ❌ |

## Team-Based Access Control

### Overview

Projects can be assigned to teams via the `team_id` foreign key. Team members have enhanced permissions for projects assigned to their team.

**Current Implementation**: See `src/services/teamService.js`, `src/context/TeamContext.jsx`, `src/hooks/useTeam.js`

### Team Assignment Rules

1. **Single Team Assignment**: Each project can be assigned to one team at a time
2. **Team Must Be in Same Organization**: `team_id` must reference a team in the same organization as the project
3. **Unassigned Projects**: Projects with `team_id = NULL` are accessible to all staff/admins in organization
4. **Team Reassignment**: Admins and staff can reassign projects to different teams

### Team-Based RLS Enhancement

**Enhanced UPDATE policy for team members**:

```sql
-- Team members can update projects assigned to their team
CREATE POLICY projects_update_team_policy
ON projects FOR UPDATE
USING (
  team_id IN (
    SELECT team_id FROM team_members
    WHERE user_id = auth.uid()
  ) AND
  organization_id IN (
    SELECT organization_id FROM user_organizations
    WHERE user_id = auth.uid() AND role IN ('admin', 'staff')
  )
)
WITH CHECK (
  team_id IN (
    SELECT team_id FROM team_members
    WHERE user_id = auth.uid()
  ) AND
  organization_id IN (
    SELECT organization_id FROM user_organizations
    WHERE user_id = auth.uid() AND role IN ('admin', 'staff')
  )
);
```

### Team Permission Summary

**Team Members**:
- Can view all projects in their organization (via base SELECT policy)
- Can edit projects assigned to their team (via team UPDATE policy)
- Can create objectives, steps, images, links for their team's projects
- Can log time entries on their team's projects

**Non-Team Staff**:
- Can view projects assigned to other teams (read-only)
- **Cannot edit** projects assigned to other teams (unless admin)
- Can view objectives, steps, images, links (read-only)

**Admins**:
- Can edit ALL projects regardless of team assignment
- Can reassign projects to different teams
- Can manage team memberships

### Team-Related Tables

**teams** table structure:
- `id` (UUID) - Primary key
- `organization_id` (UUID) - Foreign key to organizations
- `name` (TEXT) - Team name
- `created_at` (TIMESTAMPTZ)

**team_members** table structure:
- `id` (UUID) - Primary key
- `team_id` (UUID) - Foreign key to teams
- `user_id` (UUID) - Foreign key to auth.users
- `role` (TEXT) - Team role (optional, e.g., 'lead', 'member')
- `created_at` (TIMESTAMPTZ)

---

## Customer Relationship Authorization

### Overview

Projects are linked to customers via the `customer_id` foreign key (`_custID` in FileMaker). Authorization must validate that the project's customer belongs to the same organization as the project.

**Current Implementation**: See `src/api/projects.js:27-38` for `fetchProjectsForCustomer()` pattern.

### Customer-Project Relationship Rules

1. **Customer Must Exist in Same Organization**: When creating a project, `customer_id` must reference a customer in the user's organization
2. **Cross-Organization Prevention**: Users cannot create projects for customers in other organizations
3. **Customer Relationship Inheritance**: All project-related data (objectives, steps, images) inherits the customer relationship through the project

### Validation in Backend RPCs

**Example: Create project with customer validation**:

```sql
CREATE OR REPLACE FUNCTION create_project(
  p_name TEXT,
  p_customer_id UUID,
  p_team_id UUID DEFAULT NULL,
  p_value NUMERIC DEFAULT 0,
  p_fixed_price BOOLEAN DEFAULT FALSE,
  p_subscription BOOLEAN DEFAULT FALSE
)
RETURNS JSON AS $$
DECLARE
  v_customer_org_id UUID;
  v_team_org_id UUID;
  v_user_org_id UUID;
  v_project_id UUID;
BEGIN
  -- Get user's organization from JWT
  v_user_org_id := (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid;

  IF v_user_org_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Validate customer is in same organization
  SELECT organization_id INTO v_customer_org_id
  FROM customers WHERE id = p_customer_id;

  IF v_customer_org_id IS NULL THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  IF v_customer_org_id != v_user_org_id THEN
    RAISE EXCEPTION 'Customer does not belong to user organization';
  END IF;

  -- Validate team is in same organization (if provided)
  IF p_team_id IS NOT NULL THEN
    SELECT organization_id INTO v_team_org_id
    FROM teams WHERE id = p_team_id;

    IF v_team_org_id IS NULL THEN
      RAISE EXCEPTION 'Team not found';
    END IF;

    IF v_team_org_id != v_user_org_id THEN
      RAISE EXCEPTION 'Team does not belong to user organization';
    END IF;
  END IF;

  -- Create project
  INSERT INTO projects (
    name,
    customer_id,
    team_id,
    organization_id,
    value,
    fixed_price,
    subscription,
    status
  ) VALUES (
    p_name,
    p_customer_id,
    p_team_id,
    v_user_org_id,
    p_value,
    p_fixed_price,
    p_subscription,
    'Open'
  ) RETURNING id INTO v_project_id;

  RETURN json_build_object(
    'success', true,
    'project_id', v_project_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Customer Access via Projects

**Scenario**: User wants to see all projects for a specific customer

**RLS Enforcement**:
1. User can only query projects where `customer_id` references customers in their organization
2. Even if user knows a customer UUID from another organization, RLS prevents access
3. Query: `SELECT * FROM projects WHERE customer_id = 'uuid'` automatically filtered by user's organization

**Frontend Pattern**: See `src/api/projects.js:27-38`:
```javascript
export async function fetchProjectsForCustomer(customerId) {
  // FileMaker query pattern (to be migrated)
  const params = {
    layout: Layouts.PROJECTS,
    action: Actions.READ,
    query: [{ "_custID": customerId }]
  };
  return await fetchDataFromFileMaker(params);
}
```

**Supabase Migration Pattern**:
```javascript
export async function fetchProjectsForCustomer(customerId) {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      customer:customers(id, business_name),
      team:teams(id, name)
    `)
    .eq('customer_id', customerId);

  // RLS automatically filters to user's organization
  // Returns empty array if customer not in user's org
  return { data, error };
}
```

### Customer Deletion Impact

**Scenario**: Customer is deleted or deactivated

**Expected Behavior**:
1. **Soft Delete**: Customer's `is_active` flag set to `false`
2. **Projects Remain**: Projects linked to inactive customer remain accessible
3. **UI Indication**: Projects show "Inactive Customer" warning
4. **Hard Delete Prevention**: Database foreign key constraint prevents deleting customer with active projects

**Implementation**:
```sql
-- Foreign key with RESTRICT to prevent customer deletion
ALTER TABLE projects
ADD CONSTRAINT fk_projects_customer
FOREIGN KEY (customer_id)
REFERENCES customers(id)
ON DELETE RESTRICT;
```

---

## Backend Service Role Access

### Service Role Key Usage

Backend services (API server) use Supabase **service role key** for operations that need to bypass RLS:

**Use Cases**:
- System-level operations (data migrations, backups, bulk imports from FileMaker)
- Admin operations on behalf of users (e.g., project import, fixed price sales generation)
- Background jobs (subscription sales generation, billable hours processing, automated status updates)
- Cross-organization operations (rare, requires explicit authorization)
- Business logic execution (fixed price 50%/50% sales logic, subscription monthly sales)

**Security Requirements**:
- Service role key stored in backend environment variables **only** (never exposed to frontend)
- Backend authenticates API requests via HMAC-SHA256 before using service role
- Backend sets appropriate RLS context before database operations
- All service role operations must be logged in audit log

### Setting User Context in Backend

Backend should set JWT context for service role queries to respect RLS:

**Method 1: RPC Function** (Recommended)

```sql
-- Create function to set user context
CREATE OR REPLACE FUNCTION set_user_context(
  p_user_id UUID,
  p_organization_id UUID,
  p_role TEXT
)
RETURNS void AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', p_user_id,
    'organization_id', p_organization_id,
    'role', p_role
  )::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Backend API Endpoint Example**:

```javascript
// Backend: src/api/projects.js
app.post('/api/projects', authenticateRequest, async (req, res) => {
  const { userId, organizationId, role } = req.user; // From JWT

  try {
    // Set RLS context for this request
    await supabase.rpc('set_user_context', {
      p_user_id: userId,
      p_organization_id: organizationId,
      p_role: role
    });

    // Now all subsequent queries respect RLS policies
    const { data, error } = await supabase
      .from('projects')
      .insert(req.body)
      .select();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    console.error('Project creation failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'CREATION_FAILED', message: error.message }
    });
  }
});
```

**Frontend Reference**: See `src/services/dataService.js:generateBackendAuthHeader()` for HMAC authentication implementation.

---

## Frontend Authorization Logic

### Current Implementation

**Context Providers**:
- `src/context/AppStateContext.jsx` - Global state and user authentication
- `src/context/ProjectContext.jsx` - Project-specific state

The application stores user authentication state in React Context:

```javascript
// src/context/AppStateContext.jsx:45-67
const [state, setState] = useState({
  user: null,
  selectedCustomer: null,
  selectedProject: null,
  selectedTeam: null,
  // ... other state
});

// User object structure (from JWT)
user: {
  id: "user-uuid",
  email: "user@example.com",
  organizationId: "org-uuid",
  role: "admin", // 'admin', 'staff', 'read_only'
  firstName: "John",
  lastName: "Doe",
  teamID: "team-uuid" // Current team assignment (if any)
}
```

### Recommended Permission Hook

**File**: `src/hooks/useProjectPermissions.js` (to be created)

```javascript
import { useAppState } from '../context/AppStateContext';

/**
 * Custom hook for project role-based permission checks
 * @returns {Object} Permission flags for current user
 */
export function useProjectPermissions() {
  const { user } = useAppState();

  if (!user) {
    return {
      canCreateProject: false,
      canUpdateProject: false,
      canDeleteProject: false,
      canManageObjectives: false,
      canManageSteps: false,
      canUploadImages: false,
      canManageLinks: false,
      canCreateNotes: false,
      canLogTime: false,
      canViewFinancial: false,
      canAssignTeam: false,
    };
  }

  const isAdmin = user.role === 'admin';
  const isStaff = user.role === 'staff';
  const isReadOnly = user.role === 'read_only';

  return {
    // Project operations
    canCreateProject: isAdmin || isStaff,
    canUpdateProject: isAdmin || isStaff,
    canDeleteProject: isAdmin,
    canToggleStatus: isAdmin || isStaff,
    canAssignTeam: isAdmin || isStaff,

    // Objectives and steps
    canManageObjectives: isAdmin || isStaff,
    canManageSteps: isAdmin || isStaff,
    canToggleCompletion: isAdmin || isStaff,

    // Images and links
    canUploadImages: isAdmin || isStaff,
    canManageLinks: isAdmin || isStaff,

    // Notes
    canCreateNotes: isAdmin || isStaff,
    canUpdateOwnNotes: isAdmin || isStaff,
    canDeleteOwnNotes: isAdmin || isStaff,

    // Time tracking
    canLogTime: isAdmin || isStaff,
    canViewTimeEntries: isAdmin || isStaff,

    // Financial data
    canViewProjectValue: isAdmin,
    canViewFinancialDetails: isAdmin,
    canManageSalesRecords: isAdmin,

    // Metadata
    role: user.role,
    organizationId: user.organizationId,
    teamId: user.teamID,
    isAdmin,
    isStaff,
    isReadOnly,
  };
}
```

### Team-Specific Permission Hook

**File**: `src/hooks/useTeamProjectPermissions.js` (to be created)

```javascript
import { useAppState } from '../context/AppStateContext';
import { useProjectPermissions } from './useProjectPermissions';

/**
 * Custom hook for team-specific project permissions
 * @param {Object} project - The project object
 * @returns {Object} Permission flags considering team membership
 */
export function useTeamProjectPermissions(project) {
  const { user } = useAppState();
  const basePermissions = useProjectPermissions();

  if (!user || !project) {
    return { ...basePermissions, isTeamMember: false };
  }

  // Check if user is member of project's assigned team
  const isTeamMember = project.team_id && user.teamID === project.team_id;

  // Admins bypass team checks
  if (basePermissions.isAdmin) {
    return { ...basePermissions, isTeamMember, canEditProject: true };
  }

  // Staff can only edit projects assigned to their team
  const canEditProject = basePermissions.isStaff && (isTeamMember || !project.team_id);

  return {
    ...basePermissions,
    isTeamMember,
    canEditProject,
    canUpdateProject: canEditProject,
    canManageObjectives: canEditProject,
    canManageSteps: canEditProject,
    canUploadImages: canEditProject,
    canManageLinks: canEditProject,
  };
}
```

### Usage in Components

**Example: ProjectDetails Component**

```javascript
// src/components/projects/ProjectDetails.jsx
import { useProjectPermissions, useTeamProjectPermissions } from '../../hooks/useProjectPermissions';

function ProjectDetails({ project }) {
  const permissions = useTeamProjectPermissions(project);

  return (
    <div>
      <h1>{project.name}</h1>

      {/* Edit button only shown to authorized users */}
      {permissions.canUpdateProject && (
        <button onClick={handleEdit}>Edit Project</button>
      )}

      {/* Delete button only shown to admin */}
      {permissions.canDeleteProject && (
        <button onClick={handleDelete} className="text-red-600">
          Delete Project
        </button>
      )}

      {/* Team indicator for non-team members */}
      {project.team_id && !permissions.isTeamMember && (
        <span className="text-gray-500">Assigned to another team (read-only)</span>
      )}

      {/* Financial section only shown if permitted */}
      {permissions.canViewFinancialDetails && (
        <FinancialSummary project={project} />
      )}
    </div>
  );
}
```

**Example: ProjectObjectivesTab Component**

```javascript
// src/components/projects/ProjectObjectivesTab.jsx
import { useTeamProjectPermissions } from '../../hooks/useProjectPermissions';

function ProjectObjectivesTab({ project }) {
  const permissions = useTeamProjectPermissions(project);

  // Disable entire form for read-only or non-team staff
  const isFormDisabled = !permissions.canManageObjectives;

  return (
    <div>
      {/* Add objective button hidden if no permission */}
      {permissions.canManageObjectives && (
        <button onClick={handleAddObjective}>Add Objective</button>
      )}

      <ObjectiveList
        objectives={project.objectives}
        canEdit={permissions.canManageObjectives}
        canToggle={permissions.canToggleCompletion}
      />
    </div>
  );
}
```

### Important Notes

**Frontend permissions are for UX only**, not security:
- Improve user experience by hiding unavailable actions
- Prevent confusing error messages from unauthorized attempts
- Do NOT rely on frontend checks for security enforcement

**Backend RLS is the authoritative security layer**:
- Even if frontend allows action, backend will reject unauthorized requests
- Direct Supabase queries respect RLS policies
- Service role operations must set user context

**Reference**: See `src/components/auth/SignIn.jsx:82-117` for authentication flow and JWT claim extraction.

---

## Edge Cases & Security Considerations

### 1. User Changes Organization

**Scenario**: User belongs to multiple organizations and switches active organization

**Expected Behavior**:
1. User selects new organization from dropdown/menu
2. Frontend requests JWT refresh from backend
3. Backend updates JWT `app_metadata.organization_id` claim
4. Supabase session refreshed with new JWT
5. All subsequent queries automatically filtered to new organization
6. Previous organization's projects no longer accessible
7. UI updates to reflect new organization context

**Implementation Requirements**:
- Backend endpoint: `POST /api/auth/switch-organization`
- Request: `{ organization_id: "new-org-uuid" }`
- Response: New JWT with updated claims
- Frontend: Refresh Supabase session with new JWT
- Frontend: Clear cached project data
- Frontend: Re-fetch project list for new organization

**Security**: User's membership in new organization must be validated before JWT refresh.

---

### 2. Team Reassignment During Editing

**Scenario**: User is editing a project when admin reassigns it to a different team

**Expected Behavior**:
1. User A (team member) is editing Project X assigned to Team 1
2. Admin reassigns Project X to Team 2
3. User A saves changes
4. RLS policy detects User A is no longer on project's team
5. UPDATE query rejected with RLS policy violation
6. Frontend receives 403 Forbidden error
7. Frontend displays: "Project was reassigned to another team. Your changes could not be saved."
8. Frontend refreshes project data

**Implementation - Optimistic Locking**:

```sql
-- Add version column to projects table
ALTER TABLE projects ADD COLUMN version INTEGER DEFAULT 1;

-- Trigger to increment version on update
CREATE OR REPLACE FUNCTION increment_project_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_version
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION increment_project_version();
```

**Frontend Handling**:
```javascript
// Check version before update
const { data, error } = await supabase
  .from('projects')
  .update(updates)
  .eq('id', projectId)
  .eq('version', currentVersion) // Optimistic lock
  .select();

if (error || data.length === 0) {
  // Version conflict or permission denied
  showError('Project was modified by another user. Please refresh and try again.');
}
```

---

### 3. Customer Belongs to Multiple Organizations

**Scenario**: Customer linked to Organization A and Organization B (via `customer_organization` junction table)

**Expected Behavior**:
- User in Org A creates Project X for shared customer
- User in Org B sees shared customer but NOT Project X
- Projects are organization-specific, even if customer is shared
- Customer data (business name, contact) shared between organizations
- Projects remain private to creating organization

**Implementation**:
- Projects have direct `organization_id` field (not inherited from customer)
- RLS enforces organization isolation on projects table
- Customer sharing doesn't grant project access

---

### 4. Fixed Price Project Sales Generation

**Scenario**: Fixed price project completed, must generate 50%/50% sales records

**Expected Behavior**:
1. User marks project status as "Closed"
2. Backend detects `fixed_price = true`
3. Backend validates first 50% sale exists (created when project started)
4. Backend generates second 50% sale record
5. Both sales records linked to customer via `customer_sales` table
6. Sales records scoped to same organization as project

**Business Logic Validation**:
```sql
CREATE OR REPLACE FUNCTION complete_fixed_price_project(
  p_project_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_project RECORD;
  v_first_sale_exists BOOLEAN;
  v_sale_id UUID;
BEGIN
  -- Get project details
  SELECT * INTO v_project
  FROM projects
  WHERE id = p_project_id
  AND organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid;

  IF v_project IS NULL THEN
    RAISE EXCEPTION 'Project not found or access denied';
  END IF;

  IF NOT v_project.fixed_price THEN
    RAISE EXCEPTION 'Project is not a fixed price project';
  END IF;

  -- Check if first 50% sale exists
  SELECT EXISTS(
    SELECT 1 FROM customer_sales
    WHERE project_id = p_project_id
    AND sale_type = 'fixed_price_start'
  ) INTO v_first_sale_exists;

  IF NOT v_first_sale_exists THEN
    RAISE EXCEPTION 'First 50% sale not found. Cannot complete project.';
  END IF;

  -- Generate second 50% sale
  INSERT INTO customer_sales (
    customer_id,
    project_id,
    organization_id,
    amount,
    sale_type,
    description,
    sale_date
  ) VALUES (
    v_project.customer_id,
    p_project_id,
    v_project.organization_id,
    v_project.value * 0.5,
    'fixed_price_completion',
    'Project completion - ' || v_project.name,
    CURRENT_DATE
  ) RETURNING id INTO v_sale_id;

  -- Update project status
  UPDATE projects
  SET status = 'Closed', updated_at = NOW()
  WHERE id = p_project_id;

  RETURN json_build_object('success', true, 'sale_id', v_sale_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### 5. Subscription Project Monthly Sales

**Scenario**: Subscription project must generate monthly sales records automatically

**Expected Behavior**:
1. Backend cron job runs monthly (1st of each month)
2. Job queries all active subscription projects (`subscription = true`, `status = 'Open'`)
3. For each project, generate sales record with project value
4. Sales record linked to customer and project
5. Sales records scoped to project's organization
6. Audit log captures automated sales generation

**Background Job Implementation**:
```javascript
// Backend: scheduled job
async function generateSubscriptionSales() {
  // Use service role key for system operation
  const { data: projects, error } = await supabase
    .from('projects')
    .select('*')
    .eq('subscription', true)
    .eq('status', 'Open');

  for (const project of projects) {
    await supabase.rpc('set_user_context', {
      p_user_id: null, // System operation
      p_organization_id: project.organization_id,
      p_role: 'admin'
    });

    await supabase.from('customer_sales').insert({
      customer_id: project.customer_id,
      project_id: project.id,
      organization_id: project.organization_id,
      amount: project.value,
      sale_type: 'subscription_monthly',
      description: `Monthly subscription - ${project.name}`,
      sale_date: new Date().toISOString().split('T')[0]
    });

    // Log to audit
    console.log(`Generated subscription sale for project ${project.id}`);
  }
}
```

---

### 6. Service Role Key Exposure

**Scenario**: Service role key accidentally exposed in frontend code or environment variables

**Risk**:
- Service role key bypasses all RLS policies
- Attacker could access/modify data across all organizations
- Complete data breach

**Prevention**:
1. **Never include service role key in frontend environment variables**
   - Use `VITE_SUPABASE_ANON_KEY` (limited permissions) for frontend
   - Store `SUPABASE_SERVICE_ROLE_KEY` in backend `.env` only

2. **Environment Variable Naming Convention**:
   - Frontend vars: `VITE_*` (Vite exposes these to browser)
   - Backend vars: No `VITE_` prefix (server-side only)

3. **Git Ignore**:
   - Add `.env`, `.env.local`, `.env.production` to `.gitignore`
   - Never commit environment files to version control

4. **Code Review**:
   - Check for accidental service role key usage in frontend code
   - Search codebase: `grep -r "service.*role" src/`

**Detection**:
```bash
# Check for service role key in frontend code (should return 0 results)
grep -r "SUPABASE_SERVICE_ROLE_KEY" src/

# Check for service role key in environment files exposed to frontend
grep "VITE.*SERVICE" .env
```

**Current Implementation**: See `src/services/supabaseService.js:12-24` for correct anon key usage.

---

## Audit Logging

### Requirements

All project operations must be logged for:
- **Security**: Detect unauthorized access attempts
- **Compliance**: GDPR, SOC 2, audit requirements
- **Debugging**: Investigate data inconsistencies
- **Business Logic**: Track fixed price/subscription sales generation
- **User Activity**: Track who changed what and when

### Audit Log Table Schema

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  action TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'READ', 'SALES_GENERATED'
  entity_type TEXT NOT NULL, -- 'project', 'project_objective', 'project_step', etc.
  entity_id UUID NOT NULL,
  changes JSONB, -- Old and new values for UPDATE operations
  metadata JSONB, -- Additional context (e.g., sales_type, amount)
  ip_address INET, -- Client IP address
  user_agent TEXT, -- Client user agent string
  request_id UUID, -- For correlating related operations
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for efficient querying
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_organization ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_logs_request ON audit_logs(request_id) WHERE request_id IS NOT NULL;

-- Enable RLS on audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view audit logs for their organization
CREATE POLICY "Admins can view organization audit logs"
ON audit_logs FOR SELECT
USING (
  organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  AND (current_setting('request.jwt.claims', true)::json->>'role') = 'admin'
);

-- Prevent manual modifications (append-only log)
CREATE POLICY "Audit logs are append-only"
ON audit_logs FOR INSERT
WITH CHECK (false); -- No one can manually insert (only triggers)
```

### Automatic Audit Logging via Triggers

**Project Table Audit Trigger**:

```sql
CREATE OR REPLACE FUNCTION audit_project_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_organization_id UUID;
  v_action TEXT;
BEGIN
  -- Extract user context from JWT
  v_user_id := (current_setting('request.jwt.claims', true)::json->>'sub')::uuid;
  v_organization_id := (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid;

  -- Determine action type
  v_action := TG_OP; -- 'INSERT', 'UPDATE', 'DELETE'

  -- Insert audit log
  INSERT INTO audit_logs (
    user_id,
    organization_id,
    action,
    entity_type,
    entity_id,
    changes,
    created_at
  ) VALUES (
    v_user_id,
    v_organization_id,
    v_action,
    'project',
    COALESCE(NEW.id, OLD.id),
    CASE
      WHEN TG_OP = 'UPDATE' THEN
        jsonb_build_object(
          'old', to_jsonb(OLD),
          'new', to_jsonb(NEW),
          'diff', (
            SELECT jsonb_object_agg(key, value)
            FROM jsonb_each(to_jsonb(NEW))
            WHERE to_jsonb(NEW) -> key != to_jsonb(OLD) -> key
          )
        )
      WHEN TG_OP = 'DELETE' THEN
        jsonb_build_object('old', to_jsonb(OLD))
      WHEN TG_OP = 'INSERT' THEN
        jsonb_build_object('new', to_jsonb(NEW))
    END,
    NOW()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on projects table
CREATE TRIGGER audit_projects
AFTER INSERT OR UPDATE OR DELETE ON projects
FOR EACH ROW
EXECUTE FUNCTION audit_project_changes();
```

**Apply to All Project Tables**:

```sql
-- project_objectives
CREATE TRIGGER audit_project_objectives
AFTER INSERT OR UPDATE OR DELETE ON project_objectives
FOR EACH ROW
EXECUTE FUNCTION audit_project_changes();

-- project_objective_steps
CREATE TRIGGER audit_project_steps
AFTER INSERT OR UPDATE OR DELETE ON project_objective_steps
FOR EACH ROW
EXECUTE FUNCTION audit_project_changes();

-- project_images
CREATE TRIGGER audit_project_images
AFTER INSERT OR UPDATE OR DELETE ON project_images
FOR EACH ROW
EXECUTE FUNCTION audit_project_changes();

-- links (project-related only)
CREATE TRIGGER audit_project_links
AFTER INSERT OR UPDATE OR DELETE ON links
FOR EACH ROW
WHEN (NEW.project_id IS NOT NULL OR OLD.project_id IS NOT NULL)
EXECUTE FUNCTION audit_project_changes();

-- customer_sales (project-related sales)
CREATE TRIGGER audit_project_sales
AFTER INSERT OR UPDATE OR DELETE ON customer_sales
FOR EACH ROW
WHEN (NEW.project_id IS NOT NULL OR OLD.project_id IS NOT NULL)
EXECUTE FUNCTION audit_project_changes();
```

### Audit Log Queries

**View Recent Project Changes**:

```sql
SELECT
  al.created_at,
  al.action,
  al.entity_type,
  u.email AS user_email,
  al.changes -> 'diff' AS changed_fields
FROM audit_logs al
JOIN auth.users u ON al.user_id = u.id
WHERE al.entity_type LIKE 'project%'
  AND al.organization_id = 'your-org-uuid'
ORDER BY al.created_at DESC
LIMIT 50;
```

**Track Changes to Specific Project**:

```sql
SELECT
  al.created_at,
  al.action,
  al.entity_type,
  u.email AS user_email,
  al.changes
FROM audit_logs al
JOIN auth.users u ON al.user_id = u.id
WHERE al.entity_id = 'project-uuid'
  OR (al.changes ->> 'new')::jsonb ->> 'project_id' = 'project-uuid'
  OR (al.changes ->> 'old')::jsonb ->> 'project_id' = 'project-uuid'
ORDER BY al.created_at DESC;
```

**Track Sales Generation (Fixed Price/Subscription)**:

```sql
SELECT
  al.created_at,
  al.entity_type,
  al.metadata ->> 'sale_type' AS sale_type,
  al.metadata ->> 'amount' AS amount,
  al.metadata ->> 'project_name' AS project_name,
  u.email AS generated_by
FROM audit_logs al
LEFT JOIN auth.users u ON al.user_id = u.id
WHERE al.action = 'SALES_GENERATED'
  AND al.organization_id = 'your-org-uuid'
ORDER BY al.created_at DESC;
```

### Audit Log Retention

**Policy**: Retain audit logs for 7 years (compliance requirement)

**Partitioning Strategy**:

```sql
-- Create partitioned table for audit logs
CREATE TABLE audit_logs_partitioned (
  LIKE audit_logs INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create yearly partitions
CREATE TABLE audit_logs_2025 PARTITION OF audit_logs_partitioned
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE audit_logs_2026 PARTITION OF audit_logs_partitioned
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- Archive old partitions to cold storage after 1 year
```

**Archival Script** (run quarterly):

```bash
# Export old audit logs to S3
pg_dump -U postgres -d postgres \
  -t audit_logs_2024 \
  --data-only \
  --format=custom \
  | aws s3 cp - s3://clarity-audit-archive/2024/audit_logs.dump

# Drop archived partition
psql -U postgres -d postgres -c "DROP TABLE audit_logs_2024;"
```

---

## Testing RLS Policies

### Setup Test Environment

```sql
-- Create test users with different roles
INSERT INTO auth.users (id, email) VALUES
  ('admin-user-uuid', 'admin@example.com'),
  ('staff-user-uuid', 'staff@example.com'),
  ('readonly-user-uuid', 'readonly@example.com');

-- Create test organizations
INSERT INTO organizations (id, name) VALUES
  ('org-a-uuid', 'Organization A'),
  ('org-b-uuid', 'Organization B');

-- Create test customers
INSERT INTO customers (id, organization_id, business_name) VALUES
  ('customer-a1-uuid', 'org-a-uuid', 'Customer A1'),
  ('customer-b1-uuid', 'org-b-uuid', 'Customer B1');

-- Create test projects
INSERT INTO projects (id, organization_id, customer_id, name, status) VALUES
  ('project-a1-uuid', 'org-a-uuid', 'customer-a1-uuid', 'Project A1', 'Open'),
  ('project-a2-uuid', 'org-a-uuid', 'customer-a1-uuid', 'Project A2', 'Open'),
  ('project-b1-uuid', 'org-b-uuid', 'customer-b1-uuid', 'Project B1', 'Open');
```

### Test Case 1: Organization Isolation

**Purpose**: Verify users cannot see other organization's projects

```sql
-- Set user context to Organization A, Admin role
SET request.jwt.claims = '{
  "sub": "admin-user-uuid",
  "organization_id": "org-a-uuid",
  "role": "admin"
}';

-- Query all projects
SELECT id, name, organization_id FROM projects;

-- Expected Result: Only projects from Organization A
-- project-a1-uuid | Project A1 | org-a-uuid
-- project-a2-uuid | Project A2 | org-a-uuid

-- Verify cannot access Organization B project
SELECT id, name FROM projects WHERE id = 'project-b1-uuid';

-- Expected Result: Empty (no rows returned, not an error)
```

**Pass Criteria**:
- ✅ Only Organization A projects returned
- ✅ Organization B project not accessible
- ✅ No error thrown (empty result set)

---

### Test Case 2: Staff Cannot Delete Projects

**Purpose**: Verify role-based delete restrictions

```sql
-- Set user context to Staff role
SET request.jwt.claims = '{
  "sub": "staff-user-uuid",
  "organization_id": "org-a-uuid",
  "role": "staff"
}';

-- Attempt to delete project
DELETE FROM projects WHERE id = 'project-a1-uuid';

-- Expected Result: ERROR
-- new row violates row-level security policy for table "projects"
```

**Pass Criteria**:
- ✅ Delete operation rejected
- ✅ RLS policy violation error returned
- ✅ Project record unchanged in database

---

### Test Case 3: Read-Only Cannot Update Projects

**Purpose**: Verify read-only role restrictions

```sql
-- Set user context to Read-Only role
SET request.jwt.claims = '{
  "sub": "readonly-user-uuid",
  "organization_id": "org-a-uuid",
  "role": "read_only"
}';

-- Verify can read projects
SELECT id, name FROM projects WHERE id = 'project-a1-uuid';
-- Expected: Project A1 returned

-- Attempt to update project
UPDATE projects
SET name = 'New Name'
WHERE id = 'project-a1-uuid';

-- Expected Result: ERROR
-- new row violates row-level security policy for table "projects"
```

**Pass Criteria**:
- ✅ Read operation succeeds
- ✅ Update operation rejected
- ✅ RLS policy violation error returned

---

### Test Case 4: Team-Based Access Control

**Purpose**: Verify team members can edit their team's projects

```sql
-- Create test teams
INSERT INTO teams (id, organization_id, name) VALUES
  ('team-1-uuid', 'org-a-uuid', 'Team 1'),
  ('team-2-uuid', 'org-a-uuid', 'Team 2');

-- Add user to Team 1
INSERT INTO team_members (team_id, user_id) VALUES
  ('team-1-uuid', 'staff-user-uuid');

-- Assign project to Team 1
UPDATE projects SET team_id = 'team-1-uuid' WHERE id = 'project-a1-uuid';

-- Set user context to Staff (Team 1 member)
SET request.jwt.claims = '{
  "sub": "staff-user-uuid",
  "organization_id": "org-a-uuid",
  "role": "staff"
}';

-- Attempt to update Team 1 project (should succeed)
UPDATE projects
SET name = 'Updated by Team 1'
WHERE id = 'project-a1-uuid';
-- Expected: SUCCESS

-- Assign project to Team 2
UPDATE projects SET team_id = 'team-2-uuid' WHERE id = 'project-a2-uuid';

-- Attempt to update Team 2 project (should fail)
UPDATE projects
SET name = 'Attempted update'
WHERE id = 'project-a2-uuid';
-- Expected: ERROR (not on Team 2)
```

**Pass Criteria**:
- ✅ Team 1 member can update Team 1 project
- ✅ Team 1 member cannot update Team 2 project
- ✅ RLS enforces team-based access

---

### Test Case 5: Customer-Project Organization Validation

**Purpose**: Verify cannot create projects for customers in other organizations

```sql
-- Set user context to Organization A
SET request.jwt.claims = '{
  "sub": "admin-user-uuid",
  "organization_id": "org-a-uuid",
  "role": "admin"
}';

-- Attempt to create project for Organization B customer
INSERT INTO projects (id, organization_id, customer_id, name)
VALUES (
  'test-project-uuid',
  'org-a-uuid',
  'customer-b1-uuid', -- Customer from Org B
  'Test Project'
);

-- Expected Result: ERROR (via RPC validation or foreign key constraint)
-- Customer does not belong to user organization
```

**Pass Criteria**:
- ✅ Project creation rejected
- ✅ Cross-organization reference prevented
- ✅ Error message indicates validation failure

---

### Test Case 6: Audit Logs Capture All Operations

**Purpose**: Verify audit logging works for all operations

```sql
-- Set user context to Admin
SET request.jwt.claims = '{
  "sub": "admin-user-uuid",
  "organization_id": "org-a-uuid",
  "role": "admin"
}';

-- Create project
INSERT INTO projects (id, organization_id, customer_id, name)
VALUES ('audit-test-uuid', 'org-a-uuid', 'customer-a1-uuid', 'Audit Test');

-- Verify audit log entry
SELECT action, entity_type, entity_id, user_id
FROM audit_logs
WHERE entity_id = 'audit-test-uuid';

-- Expected: One 'INSERT' entry for 'project' with correct user_id and organization_id
```

**Pass Criteria**:
- ✅ Audit log entry created
- ✅ Correct action, entity_type, user_id, organization_id captured
- ✅ Changes JSONB populated with new record data

---

### Automated Testing Script

**File**: `tests/rls-policies-projects.test.sql`

```sql
-- RLS Policy Test Suite for Projects
-- Run with: psql -U postgres -d postgres -f tests/rls-policies-projects.test.sql

BEGIN;

-- Test 1: Organization Isolation
SET request.jwt.claims = '{"organization_id": "org-a-uuid", "role": "admin"}';
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM projects WHERE organization_id = 'org-b-uuid') = 0,
    'Test 1 Failed: Can see other organization projects';
END $$;

-- Test 2: Staff Cannot Delete
SET request.jwt.claims = '{"organization_id": "org-a-uuid", "role": "staff"}';
DO $$
BEGIN
  DELETE FROM projects WHERE id = 'project-a1-uuid';
  RAISE EXCEPTION 'Test 2 Failed: Staff should not be able to delete';
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL; -- Expected error
END $$;

-- Test 3: Read-Only Cannot Update
SET request.jwt.claims = '{"organization_id": "org-a-uuid", "role": "read_only"}';
DO $$
BEGIN
  UPDATE projects SET name = 'Test' WHERE id = 'project-a1-uuid';
  RAISE EXCEPTION 'Test 3 Failed: Read-only should not be able to update';
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL; -- Expected error
END $$;

-- All tests passed
RAISE NOTICE 'All RLS policy tests passed';

ROLLBACK;
```

**Run Tests**:
```bash
# Execute test suite
ssh marcus@backend.claritybusinesssolutions.ca \
  "docker exec supabase-db psql -U postgres -d postgres -f /tests/rls-policies-projects.test.sql"
```

---

## Summary

### RLS Policies Summary

**Total Policies**: 30+ policies across 7 tables

| Table | SELECT | INSERT | UPDATE | DELETE | Total |
|-------|--------|--------|--------|--------|-------|
| projects | 1 | 1 | 2 (base + team) | 1 | 5 |
| project_objectives | 1 | 1 | 1 | 1 | 4 |
| project_objective_steps | 1 | 1 | 1 | 1 | 4 |
| project_images | 1 | 1 | - | 1 | 3 |
| links (shared) | 1 | 1 | 1 | 1 | 4 |
| customer_sales (project-related) | 2 (role-based) | 1 | 1 | 1 | 5 |
| notes (planned) | 1 | 1 | 1 (own only) | 1 (own only) | 4 |

### Role-Based Access Summary

| Role | Create | Read | Update | Delete | Financial | Team-Based |
|------|--------|------|--------|--------|-----------|------------|
| **Admin** | ✅ | ✅ | ✅ | ✅ | Full access | All projects |
| **Staff** | ✅ | ✅ | ✅ | ❌ | Summary only | Team projects only |
| **Read-Only** | ❌ | ✅ | ❌ | ❌ | No access | View only |
| **External** | ❌ | Project-scoped | ❌ | ❌ | No access | Assigned only |

### Security Layers Summary

1. **Database RLS Policies** (Authoritative) ✅
   - PostgreSQL row-level security
   - Cannot be bypassed by frontend
   - Applies to all queries

2. **Backend API Validation** (Application-level) ✅
   - HMAC-SHA256 authentication
   - Business logic validation (fixed price/subscription)
   - Cross-entity validation (customer, team, organization)

3. **Frontend Permissions** (UI/UX only) ⚠️
   - Hide/disable UI elements
   - Improve user experience
   - **Not a security layer**

### Implementation Checklist

**Database Schema**:
- [ ] Create RLS policies for all project tables
- [ ] Enable RLS on all project tables
- [ ] Create audit log table and triggers
- [ ] Create optimistic locking version column
- [ ] Create foreign key constraints (customer, team, organization)
- [ ] Create indexes for RLS policy performance

**Backend API**:
- [ ] Implement HMAC-SHA256 authentication
- [ ] Extract JWT claims for organization/role
- [ ] Set user context for RLS queries
- [ ] Implement service role access for admin operations
- [ ] Add fixed price sales generation logic
- [ ] Add subscription sales background job
- [ ] Add audit logging for all operations

**Frontend**:
- [ ] Create `useProjectPermissions` hook
- [ ] Create `useTeamProjectPermissions` hook
- [ ] Implement permission checks in components
- [ ] Handle optimistic locking version conflicts
- [ ] Display team assignment indicators

**Testing**:
- [ ] Write RLS policy tests
- [ ] Test organization isolation
- [ ] Test role-based permissions
- [ ] Test team-based access control
- [ ] Test customer-project validation
- [ ] Test fixed price sales generation
- [ ] Test subscription sales generation
- [ ] Test audit log capture

---

**Document Status**: Requirements Definition - Ready for Backend Implementation
**Last Updated**: 2026-01-10
**Author**: Claude (AI Assistant)
**Reviewed By**: Pending backend team review
