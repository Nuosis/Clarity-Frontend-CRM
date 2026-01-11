# Teams - Migration Requirements

## Overview

This document outlines the requirements for migrating the Teams feature from FileMaker to Supabase. Teams are currently FileMaker-only, with no Supabase integration. Teams organize staff members and group projects for better workflow management and resource allocation.

## Current Implementation

**Source of Truth:** FileMaker layouts `devTeams` (teams), `devTeamMembers` (team membership), and `devStaff` (staff members)

**Integration Pattern:** FileMaker-only (no dual-write or Supabase synchronization)

**Frontend Components:**
- `TeamDetails.jsx`: Team details view with staff and projects
- `TeamForm.jsx`: Team creation form
- `TeamContext.jsx`: Team state management context

**API Layer:**
- `src/api/teams.js`: Team CRUD operations + staff/project assignments
- All operations currently route through FileMaker bridge

**Services:**
- `src/services/teamService.js`: Data processing and business logic
- No dual-write service (FileMaker-only)

**Custom Hooks:**
- `src/hooks/useTeam.js`: Team state management and operations

## User Workflows

### Team Management
1. User navigates to Teams sidebar section
2. User views list of all teams
3. User creates new team with name
4. User selects team to view details
5. User updates team information or deletes team

### Staff Assignment
1. User selects a team
2. User clicks "Add Staff" button
3. User sees modal with all available staff members
4. Staff already in team are pre-selected/highlighted
5. User selects additional staff members
6. User assigns optional role to each staff member
7. Staff are added to team
8. User can remove staff from team via remove button

### Project Assignment
1. User selects a team
2. User assigns projects to team (project-level operation)
3. Projects linked via `_teamID` foreign key in project record
4. User views team's assigned projects in team details
5. User can remove projects from team

### Team Statistics
1. User views team details
2. System displays:
   - Total staff count
   - Total projects count
   - Active projects count (status = 'Open')

## Dependencies

**FileMaker Layouts:**
- `devTeams`: Team CRUD
- `devTeamMembers`: Team membership join table
- `devStaff`: Staff members
- `devProjects`: Projects (team assignment via `_teamID`)

**Supabase Tables (Current):**
- None (Teams feature is FileMaker-only)

**Supabase Tables (Required for Migration):**
- `teams`: Team records
- `team_members`: Team membership join table
- `staff`: Staff members
- `projects`: Projects table (already exists, needs `team_id` column)

**Related Features:**
- Projects (teams can be assigned to projects)
- Staff (staff members are assigned to teams)
- Tasks (tasks belong to projects, which belong to teams)

## Migration Goals

1. **Make Supabase Source of Truth:**
   - Team CRUD → Supabase `teams` table
   - Team membership → Supabase `team_members` table
   - Staff CRUD → Supabase `staff` table
   - Project team assignment → Update `projects.team_id`

2. **Remove FileMaker Dependencies:**
   - Replace `fetchDataFromFileMaker()` calls in `teams.js`
   - Remove FileMaker bridge from team operations
   - Migrate all team/staff data to Supabase

3. **Preserve Team Management Semantics:**
   - Team CRUD operations
   - Staff assignment/removal with roles
   - Project team assignment
   - Team statistics calculation
   - Organization-scoped access

4. **Backend Requirements:**
   - RPC/endpoints for team CRUD
   - Staff assignment/removal with role management
   - Project team assignment
   - Team statistics aggregation
   - Data migration from FileMaker
   - RLS policies for organization-scoped access

## Success Criteria

- Frontend calls Supabase instead of FileMaker for all team operations
- Team CRUD operations work correctly
- Staff assignment/removal with roles preserved
- Project team assignment working
- Team statistics calculated accurately
- Historical FileMaker teams/staff/memberships migrated to Supabase
- RLS policies enforce organization-scoped access
- No data loss during migration
- Performance comparable to or better than FileMaker

## Documentation Structure

This requirements folder contains:
- **README.md** (this file): Overview and context
- **current-implementation.md**: Detailed code analysis and call flows
- **data-model-mapping.md**: FileMaker → Supabase schema mapping
- **api-contracts.md**: Backend endpoints/RPCs specification
- **authorization.md**: RLS policies and access control
- **migration-plan.md**: Data migration and cutover strategy
- **acceptance-criteria.md**: Test cases and validation

## Code References

**Frontend API:**
- `src/api/teams.js`: Team CRUD, staff/project assignments (307 lines)
- `src/hooks/useTeam.js`: Team state management hook (580 lines)
- `src/context/TeamContext.jsx`: Team context provider (65 lines)

**Components:**
- `src/components/teams/TeamDetails.jsx`: Team details view (569 lines)
- `src/components/teams/TeamForm.jsx`: Team creation form (165 lines)

**Services:**
- `src/services/teamService.js`: Data processing and business logic (297 lines)

**FileMaker Layouts:**
- `devTeams`: Team records
- `devTeamMembers`: Team membership join table
- `devStaff`: Staff members

## Migration Phases

**Phase 1:** Requirements Documentation (this folder) ✅
**Phase 2:** Backend Implementation (Supabase schema + RPCs)
**Phase 3:** Frontend Refactor (remove FileMaker calls)
**Phase 4:** Data Migration (historical records)
**Phase 5:** Testing & Rollout
**Phase 6:** Cleanup (remove FileMaker-specific code)

---

**Status:** Phase 1 In Progress - Creating Requirements Documentation
