# Teams - Authorization and RLS Policies

## Overview

This document specifies Row Level Security (RLS) policies and authorization rules for the Teams feature. All database access must be organization-scoped to ensure data isolation between customers.

## Authentication Context

### Required Session Variables

Supabase policies rely on these JWT claims:

```javascript
{
  "sub": "user-uuid",           // User ID
  "email": "user@example.com",  // User email
  "organization_id": "org-uuid",   // User's organization
  "role": "authenticated"       // Supabase role
}
```

### Helper Functions

**Get current organization ID:**
```sql
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
```

**Check if user is authenticated:**
```sql
CREATE OR REPLACE FUNCTION auth.is_authenticated()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT auth.role() = 'authenticated';
$$;
```

## Row Level Security Policies

### Teams Table

**Enable RLS:**
```sql
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
```

**Policy: Select Teams**
```sql
CREATE POLICY "Users can view teams in their organization"
ON teams
FOR SELECT
TO authenticated
USING (
  organization_id = auth.current_organization_id()
);
```

**Policy: Insert Teams**
```sql
CREATE POLICY "Users can create teams in their organization"
ON teams
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = auth.current_organization_id()
);
```

**Policy: Update Teams**
```sql
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
```

**Policy: Delete Teams**
```sql
CREATE POLICY "Users can delete teams in their organization"
ON teams
FOR DELETE
TO authenticated
USING (
  organization_id = auth.current_organization_id()
);
```

### Team Members Table

**Enable RLS:**
```sql
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
```

**Policy: Select Team Members**
```sql
CREATE POLICY "Users can view team members in their organization"
ON team_members
FOR SELECT
TO authenticated
USING (
  organization_id = auth.current_organization_id()
);
```

**Policy: Insert Team Members**
```sql
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
```

**Policy: Update Team Members**
```sql
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
```

**Policy: Delete Team Members**
```sql
CREATE POLICY "Users can remove team members from their organization"
ON team_members
FOR DELETE
TO authenticated
USING (
  organization_id = auth.current_organization_id()
);
```

### Staff Table

**Enable RLS:**
```sql
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
```

**Policy: Select Staff**
```sql
CREATE POLICY "Users can view staff in their organization"
ON staff
FOR SELECT
TO authenticated
USING (
  organization_id = auth.current_organization_id()
);
```

**Policy: Insert Staff**
```sql
CREATE POLICY "Users can create staff in their organization"
ON staff
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = auth.current_organization_id()
);
```

**Policy: Update Staff**
```sql
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
```

**Policy: Delete Staff**
```sql
CREATE POLICY "Users can delete staff in their organization"
ON staff
FOR DELETE
TO authenticated
USING (
  organization_id = auth.current_organization_id()
);
```

### Projects Table (Update)

**Add Policy for Team Assignment:**
```sql
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

## Service Role Access

For administrative operations and migrations, the service role bypasses RLS:

**Service Role Usage:**
```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // Service role key
);

// Service role can access all organizations
const { data, error } = await supabase
  .from('teams')
  .select('*');  // No RLS filtering
```

**Use Cases:**
- Data migration scripts
- Cross-organization analytics
- Administrative reporting
- Bulk operations

**Security:**
- Service role key must be kept secret
- Never expose in frontend code
- Use only in backend/migration scripts
- Rotate regularly

## Authorization Helpers

### Check Team Access

Verify user has access to a specific team:

```sql
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
```

**Usage in RPC:**
```sql
CREATE OR REPLACE FUNCTION rpc_get_team_details(p_team_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check access
  IF NOT auth.has_team_access(p_team_id) THEN
    RAISE EXCEPTION 'Access denied to team';
  END IF;

  -- Return team details
  RETURN (
    SELECT json_build_object(...)
    FROM teams
    WHERE id = p_team_id
  );
END;
$$;
```

### Check Staff Access

Verify user has access to a specific staff member:

```sql
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

## Frontend Authorization

### Using Supabase Client

**Organization-scoped queries (automatic):**
```javascript
// RLS automatically filters to user's organization
const { data: teams, error } = await supabase
  .from('teams')
  .select('*');  // Only returns teams in user's org
```

**Check access before operations:**
```javascript
async function assignStaffToTeam(teamId, staffId, role) {
  // Verify team access
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('id', teamId)
    .single();

  if (!team) {
    throw new Error('Team not found or access denied');
  }

  // Verify staff access
  const { data: staff } = await supabase
    .from('staff')
    .select('id')
    .eq('id', staffId)
    .single();

  if (!staff) {
    throw new Error('Staff not found or access denied');
  }

  // Proceed with assignment
  const { data, error } = await supabase
    .from('team_members')
    .insert({
      team_id: teamId,
      staff_id: staffId,
      role: role,
      organization_id: (await supabase.auth.getUser()).data.user.organization_id
    });

  return data;
}
```

**Using RPC with authorization:**
```javascript
const { data, error } = await supabase
  .rpc('rpc_get_team_statistics', {
    p_team_id: teamId,
    p_organization_id: user.organization_id
  });

if (error) {
  if (error.message.includes('Access denied')) {
    // Handle authorization error
  }
}
```

## Testing RLS Policies

### Test Organization Isolation

**Setup:**
```sql
-- Create test organizations
INSERT INTO organizations (id, name) VALUES
  ('org-1', 'Organization 1'),
  ('org-2', 'Organization 2');

-- Create test teams
INSERT INTO teams (id, organization_id, name) VALUES
  ('team-1', 'org-1', 'Org 1 Team'),
  ('team-2', 'org-2', 'Org 2 Team');

-- Create test users
INSERT INTO auth.users (id, email, organization_id) VALUES
  ('user-1', 'user1@org1.com', 'org-1'),
  ('user-2', 'user2@org2.com', 'org-2');
```

**Test SELECT Policy:**
```sql
-- Set user context
SET request.jwt.claims = '{"sub": "user-1", "organization_id": "org-1", "role": "authenticated"}';

-- Should return only org-1 teams
SELECT * FROM teams;
-- Expected: team-1

-- Should NOT return org-2 teams
SELECT * FROM teams WHERE id = 'team-2';
-- Expected: 0 rows
```

**Test INSERT Policy:**
```sql
SET request.jwt.claims = '{"sub": "user-1", "organization_id": "org-1", "role": "authenticated"}';

-- Should succeed
INSERT INTO teams (id, organization_id, name)
VALUES ('team-3', 'org-1', 'New Team');

-- Should fail (wrong organization)
INSERT INTO teams (id, organization_id, name)
VALUES ('team-4', 'org-2', 'Unauthorized Team');
-- Expected: Policy violation error
```

**Test UPDATE Policy:**
```sql
SET request.jwt.claims = '{"sub": "user-1", "organization_id": "org-1", "role": "authenticated"}';

-- Should succeed
UPDATE teams SET name = 'Updated Team' WHERE id = 'team-1';

-- Should fail (wrong organization)
UPDATE teams SET name = 'Hacked Team' WHERE id = 'team-2';
-- Expected: 0 rows updated
```

**Test DELETE Policy:**
```sql
SET request.jwt.claims = '{"sub": "user-1", "organization_id": "org-1", "role": "authenticated"}';

-- Should succeed
DELETE FROM teams WHERE id = 'team-1';

-- Should fail (wrong organization)
DELETE FROM teams WHERE id = 'team-2';
-- Expected: 0 rows deleted
```

### Automated RLS Tests

**Test Suite Structure:**
```javascript
describe('Teams RLS Policies', () => {
  let org1Client, org2Client;

  beforeAll(async () => {
    // Create Supabase clients with different org contexts
    org1Client = await createAuthenticatedClient('user1@org1.com', 'org-1');
    org2Client = await createAuthenticatedClient('user2@org2.com', 'org-2');
  });

  test('User can only view teams in their organization', async () => {
    const { data: org1Teams } = await org1Client
      .from('teams')
      .select('*');

    expect(org1Teams.every(t => t.organization_id === 'org-1')).toBe(true);
  });

  test('User cannot view teams from other organizations', async () => {
    const { data } = await org1Client
      .from('teams')
      .select('*')
      .eq('id', 'team-from-org-2');

    expect(data).toHaveLength(0);
  });

  test('User cannot insert team with wrong organization_id', async () => {
    const { error } = await org1Client
      .from('teams')
      .insert({
        organization_id: 'org-2',  // Wrong org
        name: 'Hacked Team'
      });

    expect(error).toBeTruthy();
    expect(error.message).toContain('policy');
  });
});
```

## Security Checklist

### Pre-Deployment

- [ ] All tables have RLS enabled
- [ ] All CRUD policies defined for each table
- [ ] Organization scoping enforced in all policies
- [ ] Foreign key checks include organization validation
- [ ] Service role key is secure and not exposed
- [ ] JWT claims include organization_id
- [ ] Helper functions use SECURITY DEFINER carefully

### Post-Deployment

- [ ] RLS policies tested with multiple organizations
- [ ] Cannot access other organization's data
- [ ] Cannot insert data with wrong organization_id
- [ ] Cannot update data to change organization_id
- [ ] Cannot delete other organization's data
- [ ] Service role operations logged
- [ ] RPC functions validate organization access

## Migration Considerations

### Backfilling Organization IDs

During migration from FileMaker, organization_id must be set:

```sql
-- Example: Set organization based on user context
UPDATE teams
SET organization_id = 'default-org-uuid'
WHERE organization_id IS NULL;

UPDATE staff
SET organization_id = 'default-org-uuid'
WHERE organization_id IS NULL;

UPDATE team_members
SET organization_id = 'default-org-uuid'
WHERE organization_id IS NULL;
```

### Temporary Bypass During Migration

**Option 1: Disable RLS temporarily**
```sql
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
-- Perform migration
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
```

**Option 2: Use service role**
```javascript
// Migration script uses service role
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);
// Bypasses RLS automatically
```

---

**Related Documents:**
- `data-model-mapping.md`: Schema with organization_id columns
- `api-contracts.md`: API endpoints with organization scoping
- `migration-plan.md`: Migration strategy including RLS setup
