# Teams Feature Integration Testing Guide

This document provides comprehensive integration testing procedures for the Teams feature to verify all CRUD operations work end-to-end with the Supabase backend.

## Prerequisites

Before running integration tests, ensure:

1. **Backend deployed**: All tables from `BACKEND_CHANGE_REQUEST_002_TEAMS_MIGRATION.md` must exist:
   - `teams` table
   - `staff` table
   - `team_members` table
   - `projects.team_id` column

2. **Database verification**:
   ```bash
   npm run validate:teams
   ```

3. **Dev server running**:
   ```bash
   npm run dev
   ```

4. **User authenticated**: Log in to the application with valid Supabase credentials

## Integration Test Workflows

### Workflow 1: Create Team

**Objective**: Verify team creation with organization scoping

**Steps**:
1. Navigate to Teams section in sidebar
2. Click "New Team" button
3. Enter team name: "Integration Test Team"
4. Submit form
5. Verify team appears in teams list
6. Verify team has correct organization_id from user context

**Expected Results**:
- Team created successfully in Supabase `teams` table
- Team ID is a valid UUID
- `organization_id` matches logged-in user's organization
- Created timestamp is set
- Success notification displayed
- Team appears in sidebar/list view

**Verification Query**:
```sql
SELECT * FROM teams
WHERE name = 'Integration Test Team'
AND organization_id = '<your_org_id>';
```

---

### Workflow 2: Add Staff to Team

**Objective**: Verify staff assignment with role specification

**Steps**:
1. Select the test team from Workflow 1
2. Click "Add Staff Member" button
3. Select a staff member from dropdown
4. Enter role: "Developer"
5. Submit assignment
6. Verify staff member appears in team members list
7. Verify role is displayed correctly

**Expected Results**:
- Team member record created in `team_members` table
- `team_id` and `staff_id` foreign keys are correct
- Role is stored correctly
- Staff details fetched and displayed (name, title, email)
- Organization scoping enforced via RLS
- No duplicate assignments allowed

**Verification Query**:
```sql
SELECT tm.*, s.name as staff_name
FROM team_members tm
JOIN staff s ON tm.staff_id = s.id
WHERE tm.team_id = '<test_team_id>'
AND tm.organization_id = '<your_org_id>';
```

---

### Workflow 3: Assign Multiple Staff Members

**Objective**: Verify batch staff assignment

**Steps**:
1. Click "Add Staff Member" again on same team
2. Select different staff member
3. Enter role: "Designer"
4. Submit assignment
5. Repeat for third staff member with role "Project Manager"
6. Verify all 3 staff members appear in list
7. Verify each has correct role

**Expected Results**:
- Multiple team members created successfully
- Each has unique staff_id
- Roles are distinct and correct
- List displays all members
- No performance issues with multiple inserts

**Verification Query**:
```sql
SELECT COUNT(*) as member_count
FROM team_members
WHERE team_id = '<test_team_id>';
-- Should return 3
```

---

### Workflow 4: Assign Project to Team

**Objective**: Verify project assignment

**Steps**:
1. Ensure at least one project exists in the system
2. Select the test team
3. Click "Assign Project" button
4. Select a project from dropdown
5. Submit assignment
6. Verify project appears in team's projects list
7. Navigate to project details
8. Verify team name appears on project

**Expected Results**:
- Project's `team_id` updated to test team ID
- Project appears in team's projects list
- Team stats updated (total projects count incremented)
- Project can still be viewed independently
- Only one team can be assigned per project

**Verification Query**:
```sql
SELECT * FROM projects
WHERE team_id = '<test_team_id>';
```

---

### Workflow 5: Update Team

**Objective**: Verify team modification

**Steps**:
1. Select the test team
2. Click "Edit Team" button
3. Change name to "Integration Test Team (Updated)"
4. Submit changes
5. Verify updated name appears throughout UI
6. Verify updated timestamp changed

**Expected Results**:
- Team name updated in `teams` table
- `updated_at` timestamp refreshed
- Change reflected in sidebar
- Change reflected in team details view
- Change reflected in any projects assigned to team
- No data loss for staff assignments or projects

**Verification Query**:
```sql
SELECT name, updated_at FROM teams
WHERE id = '<test_team_id>';
```

---

### Workflow 6: Remove Staff from Team

**Objective**: Verify staff removal

**Steps**:
1. Select the test team
2. Find one of the assigned staff members
3. Click "Remove" button next to staff member
4. Confirm removal in dialog
5. Verify staff member removed from list
6. Verify team stats updated (total staff count decremented)

**Expected Results**:
- Team member record deleted from `team_members` table
- Staff member no longer appears in team's staff list
- Team stats updated correctly
- Staff record still exists in `staff` table (not cascade deleted)
- Other team members unaffected

**Verification Query**:
```sql
SELECT COUNT(*) FROM team_members
WHERE team_id = '<test_team_id>';
-- Should be 2 (down from 3)
```

---

### Workflow 7: Unassign Project from Team

**Objective**: Verify project removal

**Steps**:
1. Select the test team
2. Find the assigned project in projects list
3. Click "Unassign Project" button
4. Confirm removal
5. Verify project removed from team's projects list
6. Navigate to project details
7. Verify team field is empty/null

**Expected Results**:
- Project's `team_id` set to NULL
- Project removed from team's projects list
- Team stats updated (projects count decremented)
- Project still exists and is accessible
- No data loss on project

**Verification Query**:
```sql
SELECT team_id FROM projects
WHERE id = '<test_project_id>';
-- Should return NULL
```

---

### Workflow 8: Delete Team

**Objective**: Verify team deletion with cascading

**Steps**:
1. Select the test team
2. Click "Delete Team" button
3. Confirm deletion in dialog
4. Verify team removed from teams list
5. Verify team no longer appears in sidebar
6. Check that staff records still exist
7. Verify team members assignments were cascade deleted

**Expected Results**:
- Team record deleted from `teams` table
- All team member records cascade deleted from `team_members` table
- Staff records preserved in `staff` table
- Any projects previously assigned have `team_id` set to NULL
- UI updated to show team no longer exists
- User redirected away from deleted team view

**Verification Queries**:
```sql
-- Team should be gone
SELECT * FROM teams WHERE id = '<test_team_id>';
-- Should return 0 rows

-- Team members should be cascade deleted
SELECT COUNT(*) FROM team_members WHERE team_id = '<test_team_id>';
-- Should return 0

-- Staff should still exist
SELECT COUNT(*) FROM staff WHERE id IN ('<staff_id_1>', '<staff_id_2>');
-- Should return 2
```

---

## Error Handling Tests

### Test 1: Duplicate Team Member Assignment
**Steps**: Try to assign same staff member to team twice
**Expected**: Error message "Staff member is already assigned to this team"

### Test 2: Create Team Without Name
**Steps**: Try to submit team form with empty name
**Expected**: Validation error "Team name is required"

### Test 3: Delete Team While Projects Assigned
**Steps**: Try to delete team with active project assignments
**Expected**: Projects unassigned (team_id set to NULL), team deleted successfully

### Test 4: Missing Organization ID
**Steps**: Attempt operations without authenticated user context
**Expected**: Error "Organization ID is required"

### Test 5: Cross-Organization Access
**Steps**: Try to access team from different organization (if testing multi-org)
**Expected**: RLS blocks access, returns empty/unauthorized

---

## Organization Scoping Verification

All operations MUST be scoped to the user's organization. Verify:

1. **Teams list**: Only shows teams for user's organization
2. **Staff list**: Only shows staff for user's organization
3. **Team members**: Only shows members for user's organization
4. **Create operations**: Automatically include organization_id
5. **RLS enforcement**: Cannot view/edit teams from other organizations

**Test Query**:
```sql
-- Should only return user's org teams
SELECT COUNT(*) FROM teams
WHERE organization_id = '<your_org_id>';

-- Should return 0 for other orgs (if multi-org enabled)
SELECT COUNT(*) FROM teams
WHERE organization_id != '<your_org_id>';
```

---

## Performance Tests

### Load Test: Many Teams
1. Create 50+ teams
2. Verify list loads quickly (<2s)
3. Verify pagination/filtering works
4. Verify search is responsive

### Load Test: Many Staff Members
1. Create 100+ staff records
2. Assign 20+ staff to single team
3. Verify team details loads quickly
4. Verify staff list rendering is smooth

### Load Test: Many Projects
1. Assign 30+ projects to single team
2. Verify projects list loads quickly
3. Verify stats calculation is fast

---

## Data Integrity Verification

After all workflows, verify:

1. **No orphaned records**: All team_members have valid team_id and staff_id
2. **Referential integrity**: All foreign keys resolve correctly
3. **Organization consistency**: All related records share organization_id
4. **Timestamp accuracy**: created_at and updated_at are logical
5. **UUID format**: All IDs are valid UUIDs

**Integrity Queries**:
```sql
-- No orphaned team members
SELECT COUNT(*) FROM team_members tm
LEFT JOIN teams t ON tm.team_id = t.id
LEFT JOIN staff s ON tm.staff_id = s.id
WHERE t.id IS NULL OR s.id IS NULL;
-- Should return 0

-- Organization consistency
SELECT COUNT(*) FROM team_members tm
JOIN teams t ON tm.team_id = t.id
WHERE tm.organization_id != t.organization_id;
-- Should return 0

-- Valid UUIDs
SELECT COUNT(*) FROM teams
WHERE id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
-- Should return 0
```

---

## Automated Verification Script

A companion script is provided for automated verification:

```bash
# Run integration tests verification
npm run test:teams:integration

# Verbose output with details
npm run test:teams:integration -- --verbose

# Generate test report
npm run test:teams:integration -- --report
```

See `scripts/test-teams-integration.js` for implementation.

---

## Test Completion Checklist

- [ ] Workflow 1: Create Team - PASSED
- [ ] Workflow 2: Add Staff to Team - PASSED
- [ ] Workflow 3: Assign Multiple Staff - PASSED
- [ ] Workflow 4: Assign Project to Team - PASSED
- [ ] Workflow 5: Update Team - PASSED
- [ ] Workflow 6: Remove Staff from Team - PASSED
- [ ] Workflow 7: Unassign Project from Team - PASSED
- [ ] Workflow 8: Delete Team - PASSED
- [ ] Error Handling Tests - ALL PASSED
- [ ] Organization Scoping - VERIFIED
- [ ] Performance Tests - PASSED
- [ ] Data Integrity - VERIFIED

---

## Troubleshooting

### Issue: "Cannot create team: Organization ID is missing"
**Solution**: Ensure user is authenticated and `user.supabaseOrgID` exists in app state

### Issue: "Failed to fetch teams: relation 'teams' does not exist"
**Solution**: Backend deployment not complete. Run database migrations from BACKEND_CHANGE_REQUEST_002

### Issue: Staff members not loading
**Solution**: Check RLS policies on `staff` table, ensure user has organization_id set

### Issue: Projects not appearing in team
**Solution**: Verify `projects.team_id` column exists and foreign key constraint is correct

---

## Next Steps After Testing

1. Document any issues found
2. Update task status in `.devflow/tasks/teams-supabase-migration/tasks.json`
3. Create bug reports for any failures
4. Proceed to documentation updates (TSK0012)
