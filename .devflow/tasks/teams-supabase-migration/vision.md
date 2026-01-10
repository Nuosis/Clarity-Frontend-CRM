# Teams Supabase Migration - Feature Vision

## Overview

Migrate the Teams feature from FileMaker-only implementation to Supabase-backed architecture with full backend API support. This migration will enable the Teams feature to work in the standalone web app environment and remove dependency on FileMaker infrastructure.

## Goals

### Primary Goals
1. **Database Schema**: Create Supabase tables for teams, staff, and team membership relationships
2. **Backend API**: Implement REST API endpoints for team CRUD operations, staff assignment, and project relationships
3. **Frontend Refactoring**: Update frontend API layer to use Supabase/Backend instead of FileMaker
4. **Data Migration**: Migrate existing FileMaker teams data to Supabase
5. **Feature Parity**: Maintain all existing team management functionality

### Success Criteria
- Teams can be created, read, updated, and deleted via Supabase
- Staff can be assigned to/removed from teams
- Projects can be associated with teams
- All existing team data migrated successfully
- UI components work seamlessly with new backend
- No FileMaker dependencies remain in teams feature

## Current State Analysis

### FileMaker Implementation
The Teams feature currently operates exclusively through FileMaker API calls:

**Layouts Used:**
- `devTeams` - Team records (id, name, timestamps)
- `devStaff` - Staff member records (id, name, role, image)
- `devTeamMembers` - Team-Staff relationship (team_id, staff_id, role)

**API Layer** (src/api/teams.js):
- All operations use `fetchDataFromFileMaker()` with layout/action pattern
- CRUD operations: fetchTeams, fetchTeamById, createTeam, updateTeam, deleteTeam
- Staff management: fetchTeamStaff, assignStaffToTeam, removeStaffFromTeam, fetchAllStaff
- Project relationships: fetchTeamProjects, assignProjectToTeam, removeProjectFromTeam

**Service Layer** (src/services/teamService.js):
- Processes FileMaker responses into normalized data structures
- Handles fieldData extraction and ID normalization
- Calculates team statistics

**Hooks** (src/hooks/useTeam.js):
- Manages team state and operations
- Handles loading states and error handling
- Provides team selection and CRUD operations

**Context** (src/context/TeamContext.jsx):
- Provides team state to component tree
- Wraps useTeam hook

**Components**:
- TeamDetails.jsx - Main team view with staff/project lists
- TeamForm.jsx - Team creation/editing form

### Data Model

**Current FileMaker Schema:**

```
devTeams:
- __ID (primary key)
- name
- ~CreationTimestamp
- ~ModificationTimestamp

devStaff:
- __ID (primary key)
- name
- role
- image_base64
- ~CreationTimestamp
- ~ModificationTimestamp

devTeamMembers:
- __ID (primary key)
- _teamID (foreign key to devTeams)
- _staffID (foreign key to devStaff)
- role (role within the team)
- name (denormalized staff name)

devProjects:
- _teamID (foreign key to devTeams)
```

### Existing Supabase Tables

**Projects table** has no team relationship:
- No `team_id` column exists
- Projects currently don't reference teams in Supabase

**No team-related tables exist**:
- No `teams` table
- No `staff` table
- No `team_members` table

## Technical Approach

### Phase 1: Backend Changes (Backend Change Request Required)

**Database Schema Design:**

```sql
-- Teams table
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255),
  filemaker_record_id VARCHAR(255) UNIQUE  -- For migration tracking
);

-- Staff table
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID REFERENCES auth.users(id),  -- Link to Supabase auth if applicable
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  role VARCHAR(255),
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  filemaker_record_id VARCHAR(255) UNIQUE
);

-- Team Members junction table (many-to-many)
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  role VARCHAR(255),  -- Role within the team (e.g., "Lead Developer", "Designer")
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, staff_id)  -- Prevent duplicate assignments
);

-- Add team relationship to projects
ALTER TABLE projects ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
CREATE INDEX idx_projects_team_id ON projects(team_id);

-- Indexes for performance
CREATE INDEX idx_teams_organization_id ON teams(organization_id);
CREATE INDEX idx_staff_organization_id ON staff(organization_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_staff_id ON team_members(staff_id);
```

**Backend API Endpoints Required:**

```
Teams CRUD:
- GET /teams - List all teams (scoped to organization)
- GET /teams/{id} - Get team details
- POST /teams - Create new team
- PUT /teams/{id} - Update team
- DELETE /teams/{id} - Delete team

Staff Management:
- GET /staff - List all staff (scoped to organization)
- GET /staff/{id} - Get staff details
- POST /staff - Create new staff member
- PUT /staff/{id} - Update staff member
- DELETE /staff/{id} - Delete staff member

Team Membership:
- GET /teams/{id}/members - List team members
- POST /teams/{id}/members - Add staff to team
- DELETE /teams/{id}/members/{member_id} - Remove staff from team
- PUT /teams/{id}/members/{member_id} - Update member role

Team Projects:
- GET /teams/{id}/projects - List team's projects
- PUT /projects/{id}/team - Assign project to team
- DELETE /projects/{id}/team - Remove project from team
```

**Authorization/RLS Policies:**

All operations should be scoped to user's organization:
- Users can only see/modify teams within their organization
- Staff assignments limited to organization staff
- Project assignments limited to organization projects

### Phase 2: Data Migration

**Migration Script Requirements:**
1. Fetch all teams from FileMaker `devTeams`
2. Fetch all staff from FileMaker `devStaff`
3. Fetch all team memberships from FileMaker `devTeamMembers`
4. Fetch all team-project relationships from FileMaker `devProjects`
5. Map organization IDs (FileMaker → Supabase)
6. Insert into Supabase with `filemaker_record_id` for tracking
7. Validate record counts and relationships
8. Generate migration report

### Phase 3: Frontend Refactoring

**Files to Modify:**

1. **src/api/teams.js** - Replace FileMaker calls with Backend API
2. **src/services/teamService.js** - Update response processing for Backend API format
3. **src/hooks/useTeam.js** - Update to handle Backend API responses
4. **src/context/TeamContext.jsx** - No changes expected (uses useTeam)
5. **src/components/teams/TeamDetails.jsx** - Verify compatibility with new data format
6. **src/components/teams/TeamForm.jsx** - Verify compatibility with new data format

**API Refactoring Pattern:**

```javascript
// Before (FileMaker):
export async function fetchTeams() {
  return handleFileMakerOperation(async () => {
    const params = {
      layout: 'devTeams',
      action: Actions.READ,
      query: [{ "__ID": "*" }]
    };
    return await fetchDataFromFileMaker(params);
  });
}

// After (Backend API):
export async function fetchTeams() {
  try {
    const response = await dataService.get('/teams');
    return response.data;
  } catch (error) {
    console.error('Error fetching teams:', error);
    throw error;
  }
}
```

### Phase 4: Testing

**Test Coverage:**
1. **Unit Tests**: API functions, service layer processing
2. **Integration Tests**: Full CRUD workflows, relationships
3. **Data Validation**: Verify migration accuracy
4. **UI Tests**: Component rendering, user interactions

## Files to Create/Modify

### Backend Change Request
- `BACKEND_CHANGE_REQUEST_002_TEAMS_MIGRATION.md` - Formal request document

### Frontend Files to Modify
- `src/api/teams.js` - Replace FileMaker with Backend API calls
- `src/services/teamService.js` - Update response processing
- `src/hooks/useTeam.js` - Ensure compatibility with new API responses

### Documentation
- `requirements/teams/README.md` - Feature documentation
- `requirements/teams/data-model.md` - Database schema documentation
- `requirements/teams/api-specification.md` - Backend API contracts
- `requirements/teams/migration-plan.md` - Data migration approach
- `requirements/teams/testing.md` - Test plan and acceptance criteria

### Migration Scripts
- `scripts/migrate-teams.js` - Data migration script
- `scripts/validate-teams-migration.js` - Post-migration validation

## Dependencies

### Blocked By
- Backend team approval and implementation of database schema
- Backend API endpoint implementation
- Organization table structure (must exist for foreign keys)

### Blocks
- Complete FileMaker removal (part of broader migration plan)
- Advanced team features (team permissions, team templates, etc.)

## Risk Assessment

### High Risk
- **Data Loss**: Migration must preserve all team/staff/membership data
  - Mitigation: Comprehensive validation, backup before migration
- **Breaking Changes**: Frontend expects specific data format
  - Mitigation: Thorough testing, gradual rollout

### Medium Risk
- **Performance**: Complex team queries might be slow
  - Mitigation: Proper indexing, query optimization
- **Authorization**: RLS policies must be correct
  - Mitigation: Thorough testing of access control

### Low Risk
- **UI Compatibility**: Components may need minor adjustments
  - Mitigation: Component testing, visual regression tests

## Timeline Estimate

- **Phase 1 (Backend Changes)**: 1-2 weeks (backend team)
- **Phase 2 (Data Migration)**: 3-5 days
- **Phase 3 (Frontend Refactoring)**: 1 week
- **Phase 4 (Testing & Validation)**: 3-5 days

**Total Estimate**: 3-4 weeks (dependent on backend team availability)

## Open Questions

1. Should staff be linked to Supabase auth.users table?
2. Do we need team-level permissions (who can manage teams)?
3. Should we support team hierarchies (sub-teams)?
4. What happens to projects when a team is deleted? (Currently: SET NULL via ON DELETE)
5. Should staff have an "active" status for soft deletion?

## References

- FileMaker Migration Plan: `FILEMAKER_TO_SUPABASE_MIGRATION_PLAN.md`
- Current Teams API: `src/api/teams.js`
- Teams Service: `src/services/teamService.js`
- Teams Hook: `src/hooks/useTeam.js`
- Teams Components: `src/components/teams/`
