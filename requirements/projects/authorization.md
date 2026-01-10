# Authorization

This document defines the authorization requirements for the Projects feature, including Row-Level Security (RLS) policies, organization scoping, and user role permissions.

## Overview

Projects and all related tables (objectives, steps, images, links, notes, time records) must be scoped to organizations and protected by RLS policies. Access control is based on:

1. **Organization membership**: Users can only access projects belonging to their organization
2. **Team membership**: Team members have enhanced permissions for projects assigned to their team
3. **User roles**: Admin, staff, and read-only roles have different capabilities
4. **Resource ownership**: Users who created a resource may have special permissions

## Organization Scoping

All project-related tables must include an `organization_id` column with RLS policies to enforce multi-tenant isolation.

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

## User Roles and Permissions

### Role Definitions

| Role | Description | Permissions |
|------|-------------|-------------|
| `admin` | Organization administrator | Full CRUD on all projects and related data |
| `staff` | Team member or employee | Create/read/update projects, objectives, steps, images, links; Cannot delete projects |
| `read-only` | Guest or limited user | Read-only access to projects |

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

## Team-Based Access Control (Optional Enhancement)

For projects with `team_id` assigned, optionally implement enhanced permissions for team members:

```sql
-- Enhanced UPDATE policy: Team members can update their team's projects
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
);
```

**Team Permissions**:
- Team members can view all projects in their organization
- Team members can edit projects assigned to their team
- Non-team staff can view but not edit projects assigned to other teams (unless admin)

## Cross-Organization Access Controls

**Prevent cross-organization access**:
- All queries must filter by `organization_id IN (user's organizations)`
- All writes must check `organization_id` matches user's organization
- Foreign key relationships (customer_id, team_id) must reference entities in same organization

**Validation in Backend RPCs**:
```sql
-- Example: Validate customer and project are in same organization
CREATE OR REPLACE FUNCTION create_project(
  p_name TEXT,
  p_customer_id UUID,
  p_team_id UUID,
  ...
)
RETURNS JSON AS $$
DECLARE
  v_customer_org_id UUID;
  v_team_org_id UUID;
  v_user_org_id UUID;
BEGIN
  -- Get user's organization
  SELECT organization_id INTO v_user_org_id
  FROM user_organizations
  WHERE user_id = auth.uid() AND role IN ('admin', 'staff')
  LIMIT 1;

  IF v_user_org_id IS NULL THEN
    RAISE EXCEPTION 'User not authorized';
  END IF;

  -- Validate customer is in same organization
  SELECT organization_id INTO v_customer_org_id
  FROM customers WHERE id = p_customer_id;

  IF v_customer_org_id != v_user_org_id THEN
    RAISE EXCEPTION 'Customer not in user organization';
  END IF;

  -- Validate team is in same organization (if provided)
  IF p_team_id IS NOT NULL THEN
    SELECT organization_id INTO v_team_org_id
    FROM teams WHERE id = p_team_id;

    IF v_team_org_id != v_user_org_id THEN
      RAISE EXCEPTION 'Team not in user organization';
    END IF;
  END IF;

  -- Proceed with insert...
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Audit Logging

All project operations should be logged for security and compliance:

```sql
-- Audit log table (if not exists)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  operation TEXT NOT NULL,  -- 'INSERT', 'UPDATE', 'DELETE'
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger function to log project changes
CREATE OR REPLACE FUNCTION log_project_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (user_id, organization_id, table_name, record_id, operation, new_data)
    VALUES (auth.uid(), NEW.organization_id, TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW));
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (user_id, organization_id, table_name, record_id, operation, old_data, new_data)
    VALUES (auth.uid(), NEW.organization_id, TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW));
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (user_id, organization_id, table_name, record_id, operation, old_data)
    VALUES (auth.uid(), OLD.organization_id, TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all project tables
CREATE TRIGGER projects_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON projects
FOR EACH ROW EXECUTE FUNCTION log_project_changes();

CREATE TRIGGER project_objectives_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON project_objectives
FOR EACH ROW EXECUTE FUNCTION log_project_changes();

-- ... repeat for other tables
```

## Security Considerations

1. **Service Role Key**: Backend RPCs use service role key to bypass RLS, MUST validate organization access in function body
2. **Anon Key**: Frontend uses anon key with RLS enforced, suitable for read operations only
3. **SQL Injection**: All RPC functions use parameterized queries, never string concatenation
4. **UUID Validation**: All UUID inputs validated with regex or casting before use
5. **Rate Limiting**: Implement rate limiting on all endpoints to prevent abuse
6. **CORS**: Backend API restricts CORS to frontend domain only

## Testing Authorization

**Test Cases**:
1. User A can list projects in their organization
2. User A cannot list projects in User B's organization (different org)
3. Staff can create/update projects in their organization
4. Read-only users cannot create/update projects
5. Staff cannot delete projects (only admins)
6. Admins can delete projects in their organization
7. Team members can edit projects assigned to their team
8. Non-team staff cannot edit projects assigned to other teams (unless admin)
9. Foreign key references (customer_id, team_id) must be in same organization
10. Audit logs capture all operations with correct user_id and organization_id
