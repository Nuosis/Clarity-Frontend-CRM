# Links - Authorization and Access Control

## Overview

This document defines the authorization requirements, Row-Level Security (RLS) policies, and access control rules for the Links feature after migration to Supabase.

## Authorization Model

### Principles

1. **Organization Scoping**: Users can only access links within their organization
2. **Entity-Based Access**: Link access inherits from parent entity permissions
3. **Role-Based Operations**: Different roles have different CRUD permissions
4. **Audit Trail**: Track who created/modified links

### User Roles

| Role | List | View | Create | Update | Delete |
|------|------|------|--------|--------|--------|
| Admin | ✅ All orgs | ✅ All orgs | ✅ | ✅ | ✅ |
| Manager | ✅ Own org | ✅ Own org | ✅ | ✅ | ✅ Own |
| Member | ✅ Own org | ✅ Own org | ✅ | ✅ Own | ✅ Own |
| Viewer | ✅ Own org | ✅ Own org | ❌ | ❌ | ❌ |

## Row-Level Security Policies

### Enable RLS

```sql
ALTER TABLE links ENABLE ROW LEVEL SECURITY;
```

### Policy 1: View Links (SELECT)

Users can view links if they have access to the parent entity:

```sql
CREATE POLICY "Users can view links for accessible entities"
ON links FOR SELECT
USING (
  -- Organization-level access check
  EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = auth.uid()
    AND (
      -- Customer links
      (links.customer_id IS NOT NULL AND organization_id IN (
        SELECT organization_id FROM customers WHERE id = links.customer_id
      ))
      OR
      -- Project links
      (links.project_id IS NOT NULL AND organization_id IN (
        SELECT organization_id FROM projects WHERE id = links.project_id
      ))
      OR
      -- Task links
      (links.task_id IS NOT NULL AND organization_id IN (
        SELECT p.organization_id FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE t.id = links.task_id
      ))
      OR
      -- Organization links
      (links.organization_id IS NOT NULL AND organization_id = links.organization_id)
    )
  )
);
```

### Policy 2: Create Links (INSERT)

Users can create links for entities within their organization:

```sql
CREATE POLICY "Users can create links for own organization"
ON links FOR INSERT
WITH CHECK (
  -- Must have create permission (not viewer role)
  EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager', 'member')
    AND (
      -- Customer links
      (NEW.customer_id IS NOT NULL AND organization_id IN (
        SELECT organization_id FROM customers WHERE id = NEW.customer_id
      ))
      OR
      -- Project links
      (NEW.project_id IS NOT NULL AND organization_id IN (
        SELECT organization_id FROM projects WHERE id = NEW.project_id
      ))
      OR
      -- Task links
      (NEW.task_id IS NOT NULL AND organization_id IN (
        SELECT p.organization_id FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE t.id = NEW.task_id
      ))
      OR
      -- Organization links
      (NEW.organization_id IS NOT NULL AND organization_id = NEW.organization_id)
    )
  )
);
```

### Policy 3: Update Links (UPDATE)

Users can update links they created or if they're admin/manager:

```sql
CREATE POLICY "Users can update own links or with sufficient role"
ON links FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = auth.uid()
    AND (
      -- Admins can update any link in their orgs
      role = 'admin'
      OR
      -- Managers can update any link in their orgs
      role = 'manager'
      OR
      -- Members can only update their own links
      (role = 'member' AND links.created_by = auth.uid())
    )
    AND (
      -- Must be same organization
      (links.customer_id IS NOT NULL AND organization_id IN (
        SELECT organization_id FROM customers WHERE id = links.customer_id
      ))
      OR
      (links.project_id IS NOT NULL AND organization_id IN (
        SELECT organization_id FROM projects WHERE id = links.project_id
      ))
      OR
      (links.task_id IS NOT NULL AND organization_id IN (
        SELECT p.organization_id FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE t.id = links.task_id
      ))
      OR
      (links.organization_id IS NOT NULL AND organization_id = links.organization_id)
    )
  )
);
```

### Policy 4: Delete Links (DELETE)

Users can delete links they created or if they're admin/manager:

```sql
CREATE POLICY "Users can delete own links or with sufficient role"
ON links FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = auth.uid()
    AND (
      -- Admins can delete any link in their orgs
      role = 'admin'
      OR
      -- Managers can delete any link in their orgs
      role = 'manager'
      OR
      -- Members can only delete their own links
      (role = 'member' AND links.created_by = auth.uid())
    )
    AND (
      -- Must be same organization
      (links.customer_id IS NOT NULL AND organization_id IN (
        SELECT organization_id FROM customers WHERE id = links.customer_id
      ))
      OR
      (links.project_id IS NOT NULL AND organization_id IN (
        SELECT organization_id FROM projects WHERE id = links.project_id
      ))
      OR
      (links.task_id IS NOT NULL AND organization_id IN (
        SELECT p.organization_id FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE t.id = links.task_id
      ))
      OR
      (links.organization_id IS NOT NULL AND organization_id = links.organization_id)
    )
  )
);
```

## Helper Functions

### get_user_organization_id()

```sql
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS UUID
AS $$
BEGIN
  RETURN (
    SELECT organization_id
    FROM user_organizations
    WHERE user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### has_entity_access(entity_type, entity_id)

```sql
CREATE OR REPLACE FUNCTION has_entity_access(
  p_entity_type VARCHAR,
  p_entity_id UUID
)
RETURNS BOOLEAN
AS $$
DECLARE
  v_user_org_id UUID;
  v_entity_org_id UUID;
BEGIN
  -- Get user's organization
  v_user_org_id := get_user_organization_id();

  -- Get entity's organization based on type
  CASE p_entity_type
    WHEN 'customer' THEN
      SELECT organization_id INTO v_entity_org_id
      FROM customers WHERE id = p_entity_id;
    WHEN 'project' THEN
      SELECT organization_id INTO v_entity_org_id
      FROM projects WHERE id = p_entity_id;
    WHEN 'task' THEN
      SELECT p.organization_id INTO v_entity_org_id
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = p_entity_id;
    WHEN 'organization' THEN
      v_entity_org_id := p_entity_id;
  END CASE;

  RETURN v_user_org_id = v_entity_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## API-Level Authorization

### Backend Middleware

All API endpoints should verify:

1. **Authentication**: Valid HMAC signature
2. **Organization Membership**: User belongs to organization
3. **Entity Access**: User can access parent entity
4. **Operation Permission**: User role allows operation

```javascript
// Example middleware (pseudocode)
async function authorizeLink(req, res, next) {
  const { user, organization } = req.auth;
  const { parent_id, parent_type } = req.body;

  // Verify user in organization
  if (!await userInOrganization(user.id, organization.id)) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  // Verify access to parent entity
  if (!await hasEntityAccess(user.id, parent_type, parent_id)) {
    return res.status(403).json({ error: 'Cannot access parent entity' });
  }

  // Verify operation permission
  if (!await canPerformOperation(user.role, req.method)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  next();
}
```

## Frontend Authorization

### Environment Context

Frontend should only show link operations based on user permissions:

```javascript
// src/hooks/useLink.js
const canCreateLinks = user.role !== 'viewer';
const canEditLinks = user.role === 'admin' || user.role === 'manager' || isOwnLink;
const canDeleteLinks = user.role === 'admin' || user.role === 'manager' || isOwnLink;
```

### UI Rendering

```javascript
// Only show "New Link" button if user can create
{canCreateLinks && (
  <button onClick={() => setShowNewLinkInput(true)}>
    New Link
  </button>
)}

// Only show edit/delete actions if user has permission
{(canEditLinks || canDeleteLinks) && (
  <div className="link-actions">
    {canEditLinks && <button>Edit</button>}
    {canDeleteLinks && <button>Delete</button>}
  </div>
)}
```

## Organization Scoping

### Multi-Tenancy Isolation

All queries must be scoped to user's organization:

```sql
-- Automatic via RLS policies
SELECT * FROM links WHERE project_id = 'uuid';
-- Returns only links for projects in user's organization

-- If RLS disabled (admin queries), explicit filter required
SELECT * FROM links
WHERE project_id IN (
  SELECT id FROM projects WHERE organization_id = 'user-org-id'
);
```

### Cross-Organization Prevention

Users cannot:
- View links from other organizations
- Create links for entities in other organizations
- Modify links in other organizations
- See link counts/statistics from other organizations

## Audit Trail

### Tracking Requirements

- **created_by**: Set on INSERT (auto from `auth.uid()` or passed)
- **updated_by**: Set on UPDATE (auto from `auth.uid()` or passed)
- **created_at**: Auto-set on INSERT
- **updated_at**: Auto-set on UPDATE (via trigger)

### Audit Queries

```sql
-- Who created which links
SELECT
  l.id,
  l.link,
  u.username AS created_by,
  l.created_at
FROM links l
JOIN users u ON l.created_by = u.id
WHERE l.project_id = 'project-uuid'
ORDER BY l.created_at DESC;

-- Link modification history (if history table exists)
SELECT
  lh.link_id,
  lh.old_link,
  lh.new_link,
  u.username AS modified_by,
  lh.modified_at
FROM link_history lh
JOIN users u ON lh.modified_by = u.id
WHERE lh.link_id = 'link-uuid'
ORDER BY lh.modified_at DESC;
```

## Security Considerations

### URL Validation

- **XSS Prevention**: URLs rendered as `<a href>` - browser handles safely
- **Open Redirect**: No server-side redirects through link URLs
- **Malicious URLs**: No validation of URL safety - user responsibility

### Data Exposure

- **Link Content**: URLs may contain sensitive info - treat as private data
- **Parent References**: Don't expose parent entity details to unauthorized users
- **Metadata**: GitHub repo detection is client-side only, no API calls

### Rate Limiting

Prevent abuse:
- 20 link creates per minute per user
- 100 link fetches per minute per user
- Block users exceeding limits for 5 minutes

## Migration Authorization Impact

### FileMaker → Supabase Differences

| Aspect | FileMaker | Supabase |
|--------|-----------|----------|
| Access Control | Session-based | Row-Level Security |
| Organization Scoping | Application logic | Database policies |
| Audit Trail | Auto (`~CreatedBy`) | Requires columns + triggers |
| Role Checking | Frontend only | Backend + Database |

### Migration Checklist

- [ ] Enable RLS on `links` table
- [ ] Create all 4 policies (SELECT, INSERT, UPDATE, DELETE)
- [ ] Add `created_by` and `updated_by` columns
- [ ] Create trigger for `updated_by` auto-update
- [ ] Test policies with different user roles
- [ ] Verify organization isolation
- [ ] Test cross-organization access prevention
- [ ] Validate audit trail functionality

## Testing Authorization

### Test Cases

1. **Viewer Role**: Can view links, cannot create/update/delete
2. **Member Role**: Can create links, update/delete own links only
3. **Manager Role**: Can create, update, delete any link in org
4. **Admin Role**: Can create, update, delete any link
5. **Cross-Org**: User A cannot access User B's org links
6. **Orphaned Links**: Links with no parent should fail policy checks
7. **Deleted Parent**: Links cascade delete with parent entity

### Test SQL

```sql
-- Test as different users
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'user-uuid-here';

-- Should return only user's org links
SELECT * FROM links;

-- Should fail if not in org
INSERT INTO links (link, project_id)
VALUES ('https://test.com', 'other-org-project-uuid');

-- Should succeed if in org
INSERT INTO links (link, project_id)
VALUES ('https://test.com', 'own-org-project-uuid');
```

## Performance Optimization

### Index Strategy

Ensure indexes exist for RLS policy efficiency:

```sql
CREATE INDEX idx_links_created_by ON links(created_by);
CREATE INDEX idx_customer_organization ON customers(organization_id);
CREATE INDEX idx_project_organization ON projects(organization_id);
CREATE INDEX idx_task_project ON tasks(project_id);
```

### Policy Optimization

Consider materialized views for complex organization lookups:

```sql
CREATE MATERIALIZED VIEW user_accessible_entities AS
SELECT
  uo.user_id,
  'customer' AS entity_type,
  c.id AS entity_id
FROM user_organizations uo
JOIN customers c ON c.organization_id = uo.organization_id
UNION ALL
SELECT
  uo.user_id,
  'project' AS entity_type,
  p.id AS entity_id
FROM user_organizations uo
JOIN projects p ON p.organization_id = uo.organization_id
UNION ALL
SELECT
  uo.user_id,
  'task' AS entity_type,
  t.id AS entity_id
FROM user_organizations uo
JOIN projects p ON p.organization_id = uo.organization_id
JOIN tasks t ON t.project_id = p.id;

-- Refresh periodically
REFRESH MATERIALIZED VIEW CONCURRENTLY user_accessible_entities;
```

## Summary

**Key Authorization Requirements:**
1. ✅ Row-Level Security enabled on `links` table
2. ✅ 4 policies (SELECT, INSERT, UPDATE, DELETE)
3. ✅ Organization scoping enforced at database level
4. ✅ Role-based permissions (Admin, Manager, Member, Viewer)
5. ✅ Audit trail via `created_by` and `updated_by` columns
6. ✅ Frontend respects user permissions (hide unauthorized actions)
7. ✅ Backend validates permissions on all operations

**Security Guarantees:**
- Users cannot access links outside their organization
- Users cannot create links for entities they don't have access to
- Only owners or admins/managers can modify/delete links
- All operations audited with user tracking
- No data leakage across organization boundaries
