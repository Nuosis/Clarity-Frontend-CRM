# Teams - Current Implementation

## Overview

This document provides a detailed analysis of the current Teams implementation, including call flows, component architecture, and FileMaker integration patterns.

## Architecture Layers

```
UI Components (TeamDetails.jsx, TeamForm.jsx)
          ↓
Context Layer (TeamContext.jsx)
          ↓
Custom Hook (useTeam.js)
          ↓
API Layer (src/api/teams.js)
          ↓
FileMaker Bridge (fetchDataFromFileMaker)
          ↓
FileMaker Layouts (devTeams, devTeamMembers, devStaff)
```

## File Inventory

### API Layer

**`src/api/teams.js`** (307 lines)
- `fetchTeams()`: Fetch all teams
- `fetchTeamById(teamId)`: Fetch specific team by ID
- `fetchTeamStaff(teamId)`: Fetch staff members assigned to a team
- `fetchTeamProjects(teamId)`: Fetch projects assigned to a team
- `createTeam(teamData)`: Create new team
- `updateTeam(teamId, teamData)`: Update team fields
- `deleteTeam(teamId)`: Delete team
- `assignStaffToTeam(teamId, staffId, role, name)`: Assign staff member to team
- `removeStaffFromTeam(teamMemberId)`: Remove staff member from team
- `assignProjectToTeam(projectId, teamId)`: Assign project to team
- `removeProjectFromTeam(projectId)`: Remove project from team
- `fetchAllStaff()`: Fetch all staff members

### Custom Hook Layer

**`src/hooks/useTeam.js`** (580 lines)
- Manages team state and operations
- Handles loading, error states
- Processes FileMaker response data
- Provides team CRUD operations
- Manages staff and project assignments
- Calculates team statistics

State managed:
```javascript
{
  loading: boolean,
  error: string | null,
  teams: Team[],
  selectedTeam: Team | null,
  teamStaff: TeamMember[],
  teamProjects: Project[],
  allStaff: Staff[],
  stats: {
    totalStaff: number,
    totalProjects: number,
    activeProjects: number
  } | null
}
```

Operations provided:
- `loadTeams()`: Load all teams
- `loadAllStaff()`: Load all staff members
- `handleTeamSelect(teamId)`: Select team and load its staff/projects
- `handleTeamCreate(teamData)`: Create new team
- `handleTeamUpdate(teamId, teamData)`: Update team
- `handleTeamDelete(teamId)`: Delete team
- `handleAssignStaffToTeam(staffIds, role, teamOverride)`: Assign staff to team
- `handleRemoveStaffFromTeam(teamMemberId)`: Remove staff from team
- `handleAssignProjectToTeam(projectId)`: Assign project to team
- `handleRemoveProjectFromTeam(projectId)`: Remove project from team
- `clearError()`: Clear error state
- `clearSelectedTeam()`: Clear selected team

### Context Layer

**`src/context/TeamContext.jsx`** (65 lines)
- Wraps `useTeam` hook in React context
- Provides team state to component tree
- Exposes all operations from useTeam hook

### Service Layer

**`src/services/teamService.js`** (297 lines)
- `processTeamData(team)`: Process team data from API
- `processStaffData(staff)`: Process staff data from API
- `processTeamMemberData(teamMember)`: Process team member data
- `calculateTeamStats(staff, projects)`: Calculate team statistics
- Service wrapper functions for API calls

### UI Components

**`src/components/teams/TeamDetails.jsx`** (569 lines)
- React component for team details view
- Displays team info, staff list, projects list
- Staff assignment modal with multi-select
- Optimistic updates for staff add/remove
- Dark mode support
- Statistics cards (total staff, total projects, active projects)

**`src/components/teams/TeamForm.jsx`** (165 lines)
- Modal form for creating new team
- Simple form with team name field
- Form validation
- Dark mode support

### FileMaker Layouts

**`devTeams` (TeamLayouts.TEAMS)**
Fields used:
- `__ID`: Primary key (FileMaker ID)
- `name`: Team name
- `~CreationTimestamp`: Creation timestamp
- `~ModificationTimestamp`: Modification timestamp
- `recordId`: FileMaker record ID

**`devTeamMembers` (TeamLayouts.TEAM_MEMBERS)**
Fields used:
- `__ID`: Primary key (FileMaker ID)
- `_teamID`: Foreign key to team
- `_staffID`: Foreign key to staff
- `role`: Role of staff member in team
- `name`: Staff member name (denormalized)
- `recordId`: FileMaker record ID

**`devStaff` (TeamLayouts.STAFF)**
Fields used:
- `__ID`: Primary key (FileMaker ID)
- `name`: Staff member name
- `role`: Staff member role/title
- `image_base64`: Base64 encoded profile image
- `~CreationTimestamp`: Creation timestamp
- `~ModificationTimestamp`: Modification timestamp
- `recordId`: FileMaker record ID

## Call Flow Analysis

### Load Teams

```
User → Sidebar/TeamsList → TeamContext → useTeam.loadTeams()
  ↓
src/api/teams.js → fetchTeams()
  ↓
FileMaker Bridge → fetchDataFromFileMaker()
  ↓
FileMaker Layout: devTeams
  ↓
Action: READ
  Query: { "__ID": "*" }
  ↓
Response: { response: { data: [{ fieldData: {...}, recordId: "123" }] } }
  ↓
Process each team with processTeamData()
  ↓
Set teams state
  ↓
UI displays team list
```

**FileMaker Request:**
```javascript
{
  layout: "devTeams",
  action: "read",
  query: [{ "__ID": "*" }]
}
```

**FileMaker Response:**
```javascript
{
  response: {
    data: [
      {
        fieldData: {
          __ID: "team-123",
          name: "Development Team",
          ~CreationTimestamp: "2024-01-15 10:30:00",
          ~ModificationTimestamp: "2024-01-15 10:30:00"
        },
        recordId: "123"
      }
    ]
  }
}
```

### Create Team

```
User → TeamForm → handleSubmit()
  ↓
TeamContext → useTeam.handleTeamCreate(teamData)
  ↓
src/api/teams.js → createTeam(teamData)
  ↓
FileMaker Bridge → fetchDataFromFileMaker()
  ↓
FileMaker Layout: devTeams
  ↓
Action: CREATE
  fieldData: {
    __ID: uuid(),
    name: "New Team"
  }
  ↓
Response: { recordId: "456" }
  ↓
Process team with processTeamData()
  ↓
Add to teams state
  ↓
UI refreshes team list
```

### Select Team and Load Details

```
User clicks team → TeamContext → useTeam.handleTeamSelect(teamId)
  ↓
Step 1: Fetch team details
  ↓
src/api/teams.js → fetchTeamById(teamId)
  ↓
FileMaker Bridge → fetchDataFromFileMaker(devTeams)
  Query: { "__ID": teamId }
  ↓
Process team with processTeamData()
  ↓
Set selectedTeam state
  ↓
Step 2: Fetch team staff
  ↓
src/api/teams.js → fetchTeamStaff(teamId)
  ↓
FileMaker Bridge → fetchDataFromFileMaker(devTeamMembers)
  Query: { "_teamID": teamId }
  ↓
Extract staff IDs from team members
  ↓
FileMaker Bridge → fetchDataFromFileMaker(devStaff)
  Query: [{ "__ID": staffId1 }, { "__ID": staffId2 }, ...]
  Operator: OR
  ↓
Combine team member data with staff data
  ↓
Process each with processTeamMemberData()
  ↓
Set teamStaff state
  ↓
Step 3: Fetch team projects
  ↓
src/api/teams.js → fetchTeamProjects(teamId)
  ↓
FileMaker Bridge → fetchDataFromFileMaker(devProjects)
  Query: { "_teamID": teamId }
  ↓
Process projects
  ↓
Set teamProjects state
  ↓
Step 4: Calculate statistics
  ↓
calculateTeamStats(teamStaff, teamProjects)
  ↓
Set stats state
  ↓
UI displays team details with staff, projects, and stats
```

**Important:** Team staff fetch is a two-step process:
1. Fetch team_members records (join table)
2. Fetch staff records for those members
3. Combine data to get full staff details with roles

### Assign Staff to Team

```
User → TeamDetails → "Add Staff" button → handleAddStaff()
  ↓
Load all staff: useTeam.loadAllStaff()
  ↓
src/api/teams.js → fetchAllStaff()
  ↓
FileMaker Bridge → fetchDataFromFileMaker(devStaff)
  Query: { "__ID": "*" }
  ↓
Process with processStaffData()
  ↓
Set allStaff state
  ↓
Show modal with staff list
  ↓
User selects staff members → clicks "Add Selected Staff"
  ↓
handleAddSelectedStaff()
  ↓
Filter out already assigned staff
  ↓
Create staff objects with name and role
  ↓
Optimistic update: Add to local state immediately
  ↓
Close modal
  ↓
useTeam.handleAssignStaffToTeam(staffArray, teamId)
  ↓
For each staff member:
  ↓
  src/api/teams.js → assignStaffToTeam(teamId, staffId, role, name)
    ↓
    FileMaker Bridge → fetchDataFromFileMaker(devTeamMembers)
      Action: CREATE
      fieldData: {
        _teamID: teamId,
        _staffID: staffId,
        role: role,
        name: name
      }
    ↓
    Response: { recordId: "789" }
    ↓
    Create team member object with recordId
    ↓
    Process with processTeamMemberData()
    ↓
    Add to teamStaff state
  ↓
Reset optimistic update flag
  ↓
UI displays updated staff list
```

**Key Features:**
- Multi-select staff assignment
- Optimistic updates for immediate feedback
- Prevents duplicate assignments
- Stores role for each team member
- Denormalizes staff name in team_members record

### Remove Staff from Team

```
User → TeamDetails → StaffCard → Remove button → handleStaffRemove(teamMemberId)
  ↓
Optimistic update: Remove from local state immediately
  ↓
useTeam.handleRemoveStaffFromTeam(teamMemberId)
  ↓
src/api/teams.js → removeStaffFromTeam(teamMemberId)
  ↓
FileMaker Bridge → fetchDataFromFileMaker(devTeamMembers)
  Action: DELETE
  recordId: teamMemberId
  ↓
Response: { success: true }
  ↓
Remove from teamStaff state (using recordId)
  ↓
Reset optimistic update flag
  ↓
UI removes staff card
```

**Important:** Uses `recordId` of the team_members record, not the staff ID.

### Assign Project to Team

```
Project update flow (project-level operation)
  ↓
src/api/teams.js → assignProjectToTeam(projectId, teamId)
  ↓
FileMaker Bridge → fetchDataFromFileMaker(devProjects)
  Action: UPDATE
  recordId: projectId
  fieldData: {
    _teamID: teamId
  }
  ↓
Response: { modId: "1" }
  ↓
Reload team projects: fetchTeamProjects(teamId)
  ↓
Set teamProjects state
  ↓
UI displays updated project list
```

### Calculate Team Statistics

```
useEffect triggered when teamStaff or teamProjects change
  ↓
calculateTeamStats(teamStaff, teamProjects)
  ↓
Count total staff: teamStaff.length
  ↓
Count total projects: teamProjects.length
  ↓
Count active projects: filter(project => project.status === 'Open').length
  ↓
Return stats object
  ↓
Set stats state
  ↓
UI displays stats in cards
```

## Data Processing Functions

### processTeamData(team)

Transforms FileMaker team response into normalized format:

**Input:**
```javascript
{
  fieldData: {
    __ID: "team-123",
    name: "Development Team",
    ~CreationTimestamp: "2024-01-15 10:30:00",
    ~ModificationTimestamp: "2024-01-15 10:30:00"
  },
  recordId: "123"
}
```

**Output:**
```javascript
{
  id: "team-123",
  name: "Development Team",
  createdAt: "2024-01-15 10:30:00",
  modifiedAt: "2024-01-15 10:30:00",
  recordId: "123"
}
```

### processStaffData(staff)

Transforms FileMaker staff response into normalized format:

**Input:**
```javascript
{
  fieldData: {
    __ID: "staff-456",
    name: "John Doe",
    role: "Developer",
    image_base64: "data:image/png;base64,...",
    ~CreationTimestamp: "2024-01-10 09:00:00",
    ~ModificationTimestamp: "2024-01-15 14:30:00"
  },
  recordId: "456"
}
```

**Output:**
```javascript
{
  id: "staff-456",
  name: "John Doe",
  role: "Developer",
  image: "data:image/png;base64,...",
  createdAt: "2024-01-10 09:00:00",
  modifiedAt: "2024-01-15 14:30:00",
  recordId: "456"
}
```

### processTeamMemberData(teamMember)

Transforms team member join record with embedded staff details:

**Input:**
```javascript
{
  fieldData: {
    __ID: "member-789",
    _teamID: "team-123",
    _staffID: "staff-456",
    role: "Lead Developer",
    name: "John Doe"
  },
  recordId: "789",
  staffDetails: {
    fieldData: {
      __ID: "staff-456",
      name: "John Doe",
      role: "Developer"
    }
  }
}
```

**Output:**
```javascript
{
  id: "member-789",
  teamId: "team-123",
  staffId: "staff-456",
  role: "Lead Developer",
  recordId: "789",
  staffDetails: {
    id: "staff-456",
    name: "John Doe",
    role: "Developer",
    recordId: "456"
  }
}
```

### calculateTeamStats(staff, projects)

Calculates team statistics:

**Input:**
```javascript
staff = [
  { id: "member-1", ... },
  { id: "member-2", ... },
  { id: "member-3", ... }
]

projects = [
  { id: "proj-1", status: "Open", ... },
  { id: "proj-2", status: "Open", ... },
  { id: "proj-3", status: "Closed", ... }
]
```

**Output:**
```javascript
{
  totalStaff: 3,
  totalProjects: 3,
  activeProjects: 2
}
```

## API Function Signatures

### Team CRUD

```javascript
// Fetch all teams
fetchTeams(): Promise<Object>

// Fetch specific team by ID
fetchTeamById(teamId: string): Promise<Object>

// Create new team
createTeam(teamData: {
  __ID: string,  // UUID
  name: string
}): Promise<Object>

// Update team
updateTeam(teamId: string, teamData: {
  name?: string
}): Promise<Object>

// Delete team
deleteTeam(teamId: string): Promise<boolean>
```

### Staff Operations

```javascript
// Fetch all staff members
fetchAllStaff(): Promise<Array>

// Fetch staff assigned to a team
fetchTeamStaff(teamId: string): Promise<Array>

// Assign staff member to team
assignStaffToTeam(
  teamId: string,
  staffId: string,
  role: string = '',
  name: string = ''
): Promise<Object>

// Remove staff member from team
removeStaffFromTeam(teamMemberId: string): Promise<boolean>
```

### Project Operations

```javascript
// Fetch projects assigned to a team
fetchTeamProjects(teamId: string): Promise<Array>

// Assign project to team
assignProjectToTeam(
  projectId: string,
  teamId: string
): Promise<Object>

// Remove project from team
removeProjectFromTeam(projectId: string): Promise<Object>
```

## Component State Management

### TeamDetails.jsx State

```javascript
{
  showAddStaffModal: false,          // Add staff modal visible?
  selectedStaffIds: [],              // Selected staff in modal
  existingStaffIds: [],              // Staff already in team
  localStaff: [],                    // Local staff state for optimistic updates
  isOptimisticUpdate: false          // Flag for optimistic update
}
```

### Optimistic Updates

TeamDetails uses optimistic updates for staff operations:

1. **Add Staff:**
   - Immediately add temporary staff objects to local state
   - Close modal for better UX
   - Call API to create team member records
   - Reset optimistic flag after success
   - Revert local state on error

2. **Remove Staff:**
   - Immediately remove staff from local state
   - Call API to delete team member record
   - Reset optimistic flag after success
   - Revert local state on error

## Business Rules

### Team Creation
- Team name is required
- Each team gets unique UUID as `__ID`
- Team is scoped to organization (no explicit field in FileMaker)

### Staff Assignment
- Staff can be assigned to multiple teams
- Each team membership has optional role
- Staff name is denormalized in team_members for convenience
- Duplicate assignments prevented by UI (not enforced in FileMaker)

### Project Assignment
- Project can belong to only one team (foreign key)
- Assignment done by updating project's `_teamID` field
- Removing from team sets `_teamID` to empty string

### Team Deletion
- Deleting team removes team record
- Team members records orphaned (should be cleaned up)
- Projects' `_teamID` references orphaned (should be nullified)
- No cascade delete in FileMaker

### Statistics Calculation
- Total staff: Count of team_members records
- Total projects: Count of projects with matching `_teamID`
- Active projects: Count where `status === 'Open'`
- Calculated client-side from loaded data

## Dependencies and Relationships

### Teams depend on:
- **Organization:** Implicit scoping (no explicit field)

### Team Members depend on:
- **Teams:** `_teamID` foreign key
- **Staff:** `_staffID` foreign key

### Projects reference:
- **Teams:** `_teamID` foreign key (optional)

### Staff are independent entities:
- Can exist without team membership
- Can be assigned to multiple teams

## Known Issues and Limitations

1. **FileMaker-Only:**
   - No Supabase integration
   - No dual-write mechanism
   - Cannot be used in web-only mode

2. **Data Integrity:**
   - No cascade delete on team deletion
   - Orphaned team_members records possible
   - Orphaned project `_teamID` references possible
   - No foreign key constraints in FileMaker

3. **Organization Scoping:**
   - No explicit organization field in FileMaker
   - Scoping relies on user's session context
   - Migration to Supabase will require adding organization_id

4. **Staff Duplicate Assignment:**
   - Prevented by UI but not enforced in FileMaker
   - Multiple team_members records for same staff+team possible

5. **Team Member Deletion:**
   - Uses recordId from team_members table
   - If recordId is lost or incorrect, deletion fails
   - No unique constraint on (_teamID, _staffID)

6. **Concurrency:**
   - Last write wins (FileMaker default)
   - No optimistic locking or versioning
   - Multiple users can create conflicting updates

7. **Performance:**
   - Team staff fetch requires two API calls (members + staff)
   - No eager loading or join support
   - N+1 query problem when loading many teams

## Migration Considerations

### Data Volume
- Estimated teams: ~20-50 teams
- Estimated staff: ~50-100 staff members
- Estimated team memberships: ~100-300 records
- Historical data must be preserved

### ID Reconciliation
- FileMaker uses string IDs (`__ID`)
- Supabase uses UUIDs
- May be able to preserve IDs if they're already UUIDs
- Need to verify FileMaker ID format

### Organization Scoping
- Must add `organization_id` to all tables
- Must backfill organization IDs during migration
- RLS policies must enforce organization scoping

### Cascade Behavior
- Implement cascade delete for team_members on team delete
- Implement nullify for project.team_id on team delete
- Use database triggers or application logic

### Testing Requirements
- Team CRUD operations
- Staff assignment/removal
- Project assignment/removal
- Team statistics calculation
- Organization scoping verification
- Cascade delete behavior
- Concurrent operations

---

**Code References:**
- `src/api/teams.js` (307 lines)
- `src/hooks/useTeam.js` (580 lines)
- `src/context/TeamContext.jsx` (65 lines)
- `src/services/teamService.js` (297 lines)
- `src/components/teams/TeamDetails.jsx` (569 lines)
- `src/components/teams/TeamForm.jsx` (165 lines)
