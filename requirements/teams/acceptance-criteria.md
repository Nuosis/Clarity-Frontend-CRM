# Teams - Acceptance Criteria

## Overview

This document defines the acceptance criteria and test cases for the Teams feature migration from FileMaker to Supabase. All criteria must be met before the migration is considered complete.

## Functional Requirements

### FR-1: Team CRUD Operations

**FR-1.1: List Teams**
- [ ] User can view list of all teams in their organization
- [ ] Team list displays team name
- [ ] Teams are sorted alphabetically by name
- [ ] User cannot see teams from other organizations
- [ ] Empty state displays appropriate message when no teams exist

**Test Cases:**
```
TC-1.1.1: View teams list
  Given: User is authenticated in organization A
  When: User navigates to Teams page
  Then: User sees all teams belonging to organization A
  And: Teams are sorted alphabetically
  And: User does not see teams from organization B

TC-1.1.2: Empty teams list
  Given: User is authenticated in organization with no teams
  When: User navigates to Teams page
  Then: User sees message "No teams found"
  And: User sees "Create Team" button
```

**FR-1.2: Create Team**
- [ ] User can create new team with name
- [ ] Team name is required
- [ ] Team name must be unique within organization
- [ ] Team is automatically assigned to user's organization
- [ ] Success message displays after creation
- [ ] New team appears in teams list immediately

**Test Cases:**
```
TC-1.2.1: Create team successfully
  Given: User is on Teams page
  When: User clicks "Create Team" button
  And: User enters team name "Development Team"
  And: User clicks "Create" button
  Then: Team is created successfully
  And: Success message displays
  And: "Development Team" appears in teams list
  And: Team belongs to user's organization

TC-1.2.2: Create team with duplicate name
  Given: Team "Development Team" already exists in organization
  When: User attempts to create another team "Development Team"
  Then: Error message displays "Team name already exists"
  And: Team is not created

TC-1.2.3: Create team without name
  Given: User is on team creation form
  When: User leaves name field empty
  And: User clicks "Create" button
  Then: Validation error displays "Team name is required"
  And: Team is not created
```

**FR-1.3: View Team Details**
- [ ] User can view detailed information about a team
- [ ] Team details include: name, member count, project count, stats
- [ ] Team details show list of assigned staff
- [ ] Team details show list of assigned projects
- [ ] Statistics are calculated correctly

**Test Cases:**
```
TC-1.3.1: View team details
  Given: Team "Development Team" exists with 5 members and 12 projects
  When: User selects "Development Team"
  Then: Team details panel displays
  And: Team name is "Development Team"
  And: Total staff count shows 5
  And: Total projects count shows 12
  And: Active projects count shows projects with status="Open"
  And: Staff list displays all 5 members
  And: Projects list displays all 12 projects
```

**FR-1.4: Update Team**
- [ ] User can update team name
- [ ] Updated name must be unique within organization
- [ ] Changes save successfully
- [ ] Success message displays after update
- [ ] Updated name appears in teams list immediately

**Test Cases:**
```
TC-1.4.1: Update team name successfully
  Given: Team "Dev Team" exists
  When: User edits team name to "Development Team"
  And: User saves changes
  Then: Team name updates successfully
  And: Success message displays
  And: "Development Team" appears in teams list

TC-1.4.2: Update team name to duplicate
  Given: Teams "Team A" and "Team B" exist
  When: User edits "Team B" name to "Team A"
  And: User saves changes
  Then: Error message displays "Team name already exists"
  And: Team name does not change
```

**FR-1.5: Delete Team**
- [ ] User can delete a team
- [ ] Confirmation dialog displays before deletion
- [ ] Team members are removed when team is deleted
- [ ] Projects' team assignment is cleared (set to null)
- [ ] Deleted team disappears from teams list
- [ ] Success message displays after deletion

**Test Cases:**
```
TC-1.5.1: Delete team successfully
  Given: Team "Old Team" exists with 3 members and 5 projects
  When: User clicks "Delete Team" button
  And: User confirms deletion
  Then: Team is deleted successfully
  And: Team members records are deleted
  And: Projects' team_id is set to null
  And: "Old Team" disappears from teams list
  And: Success message displays

TC-1.5.2: Cancel team deletion
  Given: Team "Development Team" exists
  When: User clicks "Delete Team" button
  And: User cancels deletion
  Then: Team is not deleted
  And: "Development Team" remains in teams list
```

### FR-2: Staff Management

**FR-2.1: List All Staff**
- [ ] User can view list of all staff in their organization
- [ ] Staff list displays name, title, and profile image
- [ ] User cannot see staff from other organizations
- [ ] Staff list supports search by name
- [ ] Active/inactive filter works correctly

**Test Cases:**
```
TC-2.1.1: View all staff
  Given: Organization has 10 active staff members
  When: User views staff list
  Then: All 10 staff members display
  And: Each shows name, title, and profile image
  And: User does not see staff from other organizations

TC-2.1.2: Search staff by name
  Given: Staff members include "John Doe" and "Jane Smith"
  When: User searches for "john"
  Then: Results show only "John Doe"

TC-2.1.3: Filter active staff
  Given: Organization has 8 active and 2 inactive staff
  When: User filters by "Active only"
  Then: Only 8 active staff display
```

**FR-2.2: Assign Staff to Team**
- [ ] User can assign one or more staff to a team
- [ ] Multi-select interface for choosing staff
- [ ] Staff already in team are pre-selected/highlighted
- [ ] Duplicate assignments are prevented
- [ ] Optional role can be assigned to each staff member
- [ ] Assigned staff appear in team details immediately

**Test Cases:**
```
TC-2.2.1: Assign single staff to team
  Given: Team "Development Team" has 0 members
  And: Staff member "John Doe" exists
  When: User opens "Add Staff" modal
  And: User selects "John Doe"
  And: User assigns role "Lead Developer"
  And: User clicks "Add Selected Staff"
  Then: "John Doe" is assigned to team
  And: Role is "Lead Developer"
  And: "John Doe" appears in team members list
  And: Total staff count shows 1

TC-2.2.2: Assign multiple staff to team
  Given: Team "Development Team" has 1 member
  And: Staff members "Jane Smith" and "Bob Johnson" exist
  When: User selects both "Jane Smith" and "Bob Johnson"
  And: User clicks "Add Selected Staff"
  Then: Both staff are assigned to team
  And: Team members list shows 3 members
  And: Total staff count shows 3

TC-2.2.3: Prevent duplicate staff assignment
  Given: "John Doe" is already assigned to "Development Team"
  When: User attempts to assign "John Doe" again
  Then: Error message displays "Staff member already in team"
  Or: "John Doe" is automatically deselected/disabled in UI
  And: No duplicate assignment is created

TC-2.2.4: Assign staff with pre-selection
  Given: Team "Development Team" has members A, B, C
  When: User opens "Add Staff" modal
  Then: Members A, B, C are pre-selected or marked as "Already in team"
  And: User can see which staff are already assigned
```

**FR-2.3: Update Team Member Role**
- [ ] User can update role for a team member
- [ ] Role changes save successfully
- [ ] Updated role displays immediately

**Test Cases:**
```
TC-2.3.1: Update team member role
  Given: "John Doe" is in team with role "Developer"
  When: User updates role to "Lead Developer"
  Then: Role updates successfully
  And: Team member shows role "Lead Developer"
```

**FR-2.4: Remove Staff from Team**
- [ ] User can remove staff from team
- [ ] Removed staff disappear from team members list immediately
- [ ] Total staff count updates correctly
- [ ] Staff member record is deleted, not just deactivated

**Test Cases:**
```
TC-2.4.1: Remove staff from team
  Given: Team "Development Team" has 5 members including "John Doe"
  When: User clicks remove button for "John Doe"
  And: User confirms removal (if prompted)
  Then: "John Doe" is removed from team
  And: "John Doe" disappears from members list
  And: Total staff count shows 4
  And: Team member record is deleted from database
```

### FR-3: Project Assignment

**FR-3.1: View Team Projects**
- [ ] User can view all projects assigned to a team
- [ ] Project list shows project name and status
- [ ] Active/inactive project counts are accurate

**Test Cases:**
```
TC-3.1.1: View team projects
  Given: Team "Development Team" has 8 open and 4 closed projects
  When: User views team details
  Then: All 12 projects display in projects list
  And: Total projects count shows 12
  And: Active projects count shows 8
```

**FR-3.2: Assign Project to Team**
- [ ] User can assign a project to a team
- [ ] Project assignment updates successfully
- [ ] Project appears in team's projects list

**Test Cases:**
```
TC-3.2.1: Assign project to team
  Given: Project "Website Redesign" has no team assignment
  When: User assigns project to "Development Team"
  Then: Project is assigned successfully
  And: Project appears in "Development Team" projects list
  And: Project details show team_id = "Development Team" ID
```

**FR-3.3: Remove Project from Team**
- [ ] User can remove project from its assigned team
- [ ] Project disappears from team's projects list
- [ ] Project's team_id is set to null

**Test Cases:**
```
TC-3.3.1: Remove project from team
  Given: Project "Website Redesign" is assigned to "Development Team"
  When: User removes project from team
  Then: Project is unassigned successfully
  And: Project disappears from "Development Team" projects list
  And: Project's team_id is null
```

### FR-4: Team Statistics

**FR-4.1: Calculate Statistics**
- [ ] Total staff count is accurate
- [ ] Total projects count is accurate
- [ ] Active projects count is accurate (status = "Open")
- [ ] Statistics update in real-time when data changes

**Test Cases:**
```
TC-4.1.1: Statistics calculation
  Given: Team has 5 staff, 12 projects (8 open, 4 closed)
  When: User views team details
  Then: Total staff shows 5
  And: Total projects shows 12
  And: Active projects shows 8

TC-4.1.2: Statistics update after staff change
  Given: Team has 5 staff members
  When: User adds 1 new staff member
  Then: Total staff updates to 6 immediately

TC-4.1.3: Statistics update after project change
  Given: Team has 8 active projects
  When: User marks 1 project as "Closed"
  Then: Active projects updates to 7 immediately
```

## Non-Functional Requirements

### NFR-1: Performance

**NFR-1.1: Response Times**
- [ ] List teams loads in < 500ms
- [ ] Team details loads in < 800ms
- [ ] List staff loads in < 500ms
- [ ] Assign staff completes in < 1000ms
- [ ] Remove staff completes in < 800ms
- [ ] Team statistics loads in < 1500ms

**Test Cases:**
```
TC-NFR-1.1: Measure response times
  Given: Production-like data volume (50 teams, 100 staff, 300 memberships)
  When: User performs various operations
  Then: All operations complete within target times
  And: No operation exceeds maximum acceptable time
```

**NFR-1.2: Scalability**
- [ ] System handles 100 teams
- [ ] System handles 200 staff members
- [ ] System handles 500 team memberships
- [ ] Concurrent users (10+) don't degrade performance significantly

**NFR-1.3: Optimistic Updates**
- [ ] UI updates immediately for add/remove staff operations
- [ ] Loading states display during API calls
- [ ] Errors revert optimistic updates correctly

**Test Cases:**
```
TC-NFR-1.3.1: Optimistic staff addition
  Given: User is viewing team with 5 staff
  When: User adds new staff member
  Then: UI shows 6 staff immediately (optimistic)
  And: Loading indicator displays briefly
  And: When API completes, staff count remains 6

TC-NFR-1.3.2: Failed optimistic update
  Given: User is viewing team
  When: User adds staff member
  And: API call fails due to network error
  Then: UI reverts to original state
  And: Error message displays
```

### NFR-2: Security

**NFR-2.1: Organization Isolation**
- [ ] Users can only access teams in their organization
- [ ] Users cannot view other organizations' teams
- [ ] Users cannot modify other organizations' teams
- [ ] Users cannot assign staff from other organizations
- [ ] RLS policies enforce organization scoping

**Test Cases:**
```
TC-NFR-2.1.1: Organization isolation - read
  Given: User is in organization A
  And: Team "Secret Team" exists in organization B
  When: User attempts to view teams list
  Then: "Secret Team" does not appear in results
  And: User cannot access "Secret Team" by ID

TC-NFR-2.1.2: Organization isolation - write
  Given: User is in organization A
  And: Team "Target Team" exists in organization B
  When: User attempts to update "Target Team" name
  Then: Operation is denied
  And: Error message displays "Access denied"
  And: "Target Team" is not modified

TC-NFR-2.1.3: Cross-organization staff assignment
  Given: User is in organization A
  And: Staff member "Bob" exists in organization B
  When: User attempts to assign "Bob" to team in organization A
  Then: Operation is denied
  And: Error message displays
  And: Staff assignment is not created
```

**NFR-2.2: Authentication**
- [ ] Unauthenticated users cannot access teams
- [ ] All API endpoints require valid authentication token
- [ ] Expired tokens are rejected

**NFR-2.3: Authorization**
- [ ] RLS policies enforce all operations
- [ ] Database triggers validate organization consistency
- [ ] Foreign key constraints prevent invalid references

### NFR-3: Data Integrity

**NFR-3.1: Cascade Deletes**
- [ ] Deleting team deletes all team members
- [ ] Deleting team sets projects' team_id to null
- [ ] Deleting staff deletes all team memberships

**Test Cases:**
```
TC-NFR-3.1.1: Team deletion cascades
  Given: Team has 5 team member records
  When: User deletes team
  Then: All 5 team member records are deleted
  And: No orphaned team member records remain

TC-NFR-3.1.2: Team deletion nullifies project assignments
  Given: 10 projects are assigned to team
  When: User deletes team
  Then: All 10 projects have team_id = null
  And: Projects are not deleted
```

**NFR-3.2: Unique Constraints**
- [ ] Team name is unique within organization
- [ ] (team_id, staff_id) combination is unique
- [ ] Staff email is unique within organization (if provided)

**NFR-3.3: Referential Integrity**
- [ ] Cannot create team member with invalid team_id
- [ ] Cannot create team member with invalid staff_id
- [ ] Cannot assign project to non-existent team

### NFR-4: Usability

**NFR-4.1: User Interface**
- [ ] Dark mode works correctly for all team components
- [ ] Forms have clear labels and validation messages
- [ ] Error messages are user-friendly and actionable
- [ ] Success messages confirm operations completed
- [ ] Loading states indicate when operations are in progress

**NFR-4.2: User Experience**
- [ ] Add staff modal shows which staff are already assigned
- [ ] Team list is sortable and searchable
- [ ] Staff list is searchable
- [ ] Confirmation dialogs prevent accidental deletions
- [ ] Optimistic updates provide immediate feedback

### NFR-5: Maintainability

**NFR-5.1: Code Quality**
- [ ] No FileMaker-specific code remains
- [ ] Dead code is removed
- [ ] Functions are properly documented
- [ ] Error handling is comprehensive
- [ ] Logging is sufficient for debugging

**NFR-5.2: Testing**
- [ ] Unit tests pass for all service functions
- [ ] Integration tests pass for all API endpoints
- [ ] End-to-end tests pass for all user workflows

## Migration Requirements

### MR-1: Data Migration

**MR-1.1: Complete Migration**
- [ ] 100% of FileMaker teams migrated
- [ ] 100% of FileMaker staff migrated
- [ ] 100% of FileMaker team members migrated
- [ ] All profile images migrated to Supabase Storage

**Test Cases:**
```
TC-MR-1.1.1: Verify record counts
  Given: FileMaker has X teams, Y staff, Z memberships
  When: Migration completes
  Then: Supabase has X teams
  And: Supabase has Y staff
  And: Supabase has Z team memberships
  And: All counts match exactly
```

**MR-1.2: Data Integrity**
- [ ] No data loss during migration
- [ ] No data corruption during migration
- [ ] All foreign keys are valid after migration
- [ ] All timestamps are converted correctly
- [ ] All profile images are accessible

**Test Cases:**
```
TC-MR-1.2.1: Validate foreign keys
  Given: Migration is complete
  When: Query all team members
  Then: All team_id values reference valid teams
  And: All staff_id values reference valid staff
  And: All organization_id values reference valid organizations
  And: Zero orphaned records exist
```

**MR-1.3: Organization Assignment**
- [ ] All migrated records have organization_id set
- [ ] Organization IDs are correct
- [ ] No records have null organization_id

### MR-2: Backward Compatibility

**MR-2.1: Data Consistency**
- [ ] Migrated data matches FileMaker exactly
- [ ] Team names identical
- [ ] Staff names and titles identical
- [ ] Team memberships match
- [ ] Timestamps preserved (converted to UTC)

**Test Cases:**
```
TC-MR-2.1.1: Spot check data consistency
  Given: Sample team "Development Team" in FileMaker
  And: Same team migrated to Supabase
  When: Compare data
  Then: Team name matches exactly
  And: All members match
  And: All member roles match
  And: Created/updated timestamps match (accounting for timezone)
```

## Acceptance Checklist

### Development Complete
- [ ] All functional requirements implemented
- [ ] All non-functional requirements met
- [ ] All code reviewed and approved
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Documentation updated

### Testing Complete
- [ ] All test cases executed
- [ ] All acceptance criteria met
- [ ] Performance tested and meets targets
- [ ] Security tested and verified
- [ ] User acceptance testing completed
- [ ] No critical or high-priority bugs

### Deployment Ready
- [ ] Migration script tested in staging
- [ ] Rollback plan documented and tested
- [ ] Monitoring configured
- [ ] Alerts configured
- [ ] Deployment checklist completed
- [ ] Stakeholder sign-off obtained

### Post-Deployment
- [ ] Production migration successful
- [ ] All smoke tests passed
- [ ] No critical errors in logs
- [ ] Performance within acceptable range
- [ ] User feedback positive
- [ ] Documentation accurate

---

**Related Documents:**
- `README.md`: Feature overview and migration phases
- `current-implementation.md`: Current FileMaker implementation
- `migration-plan.md`: Detailed migration strategy
- `api-contracts.md`: API endpoint specifications
