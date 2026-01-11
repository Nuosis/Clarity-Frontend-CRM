# Projects Migration Requirements

## Overview

This directory contains comprehensive documentation for migrating the Projects feature from FileMaker to Supabase. Projects are the core workflow entity in the CRM system, representing client engagements with associated objectives, tasks, time tracking, images, links, and notes. Projects support multiple pricing models including fixed-price and subscription-based billing.

**Key Terminology:**
- **Project**: A client engagement or work initiative with defined objectives, timeline, and value
- **Objective**: A high-level goal or milestone within a project (can have multiple steps)
- **Step**: A specific task within an objective (granular unit of work)
- **Fixed-Price Project**: Project billed as fixed amount (50% on start, 50% on completion)
- **Subscription Project**: Project billed monthly at recurring rate from start to end date
- **Billable Status**: Whether time entries can be invoiced separately (false for fixed-price projects)
- **Project Status**: Current state (Planning, Active, On Hold, Completed, Cancelled)

## Current Status

- **Phase**: Phase 1 - Requirements Documentation
- **FileMaker Layouts**: `devProjects` (main), `devProjectObjectives`, `devProjectObjSteps`, `devProjectImages`, `devProjectLinks`, `devNotes`, `dapiRecords`
- **Supabase Tables**: `projects` (exists), `project_objectives`, `project_objective_steps`, `project_images`, `links` (shared), `notes` (planned), `time_entries`/`customer_sales` (financial)
- **Backend Status**: No backend API - FileMaker-primary with no dual-write
- **Frontend Status**: 100% FileMaker-dependent with partial Supabase sync (project creation only, see src/hooks/useProject.js:213-259)

## Quick Reference

### FileMaker Implementation
- **Primary Layout**: `devProjects`
- **Primary Key**: `__ID` (UUID)
- **FileMaker Record ID**: `recordId` (internal FM record identifier - used for UPDATE/DELETE operations)
- **Customer Relationship**: `_custID` (UUID, foreign key to devCustomers layout)
- **Team Relationship**: `_teamID` (UUID, foreign key to devTeams layout)
- **Core Fields**:
  - `projectName` (text, required) - Project name/title
  - `description` (text, optional) - Project description
  - `status` (text, values: "Open", "Closed", default: "Open") - Project status
  - `dateStart` (date, MM/DD/YYYY) - Project start date
  - `dateEnd` (date, MM/DD/YYYY) - Project end date/target completion
  - `value` (decimal) - Project value in dollars
  - `f_fixedPrice` (text, "0" or "1") - Fixed price billing flag
  - `f_subscription` (text, "0" or "1") - Subscription billing flag
  - `estOfTime` (text, format: "2h 30m") - Estimated time to complete
  - `~creationTimestamp` (timestamp) - Record creation time
  - `~modificationTimestamp` (timestamp) - Record modification time
- **Related Layouts**:
  - `devProjectObjectives` - Project goals/milestones (filtered by `_projectID`)
  - `devProjectObjSteps` - Steps within objectives (filtered by `_objectiveID`)
  - `devProjectImages` - Project images/screenshots (filtered by `_fkID`)
  - `devProjectLinks` - External URLs related to project (filtered by `_fkID`)
  - `devNotes` - Notes associated with project (filtered by `_fkID` polymorphic field)
  - `dapiRecords` - Time tracking records (filtered by `_projectID`)

### Supabase Schema
- **Main Table**: `projects`
  - Primary key: `id` (UUID)
  - Core fields: `name`, `description`, `status`, `start_date`, `end_date`, `value`, `is_fixed_price`, `is_subscription`
  - Foreign keys: `customer_id`, `team_id`, `organization_id`
- **Related Tables**:
  - `project_objectives` - Objectives (1:many with projects)
  - `project_objective_steps` - Steps (1:many with objectives)
  - `project_images` - Images (1:many with projects)
  - `links` - Shared links table with `project_id` FK
  - `notes` - Planned shared notes table with polymorphic association
  - `time_entries` or `customer_sales` - Time tracking/billing records

### Key Gaps & Challenges
1. **No Backend API**: Currently using direct FileMaker API calls, no Supabase integration
2. **Complex Business Logic**: Fixed-price projects generate 50/50 sales entries; subscriptions generate monthly entries
3. **Nested Relationships**: Objectives → Steps hierarchy needs careful migration
4. **Time Record Association**: Projects link to time records via `_projectID` in `dapiRecords` layout
5. **Polymorphic Associations**: Notes use `_fkID` to associate with projects, customers, tasks
6. **No Dual-Write**: Unlike customers, projects have NO Supabase sync currently
7. **Migration Scope**: Unknown number of active projects with objectives, steps, images, links, notes

## User Workflows

### Current User Flows (FileMaker-Primary)

1. **View Project List for Customer**
   - User navigates to customer details → Projects tab
   - Frontend calls `fetchProjectsForCustomer(customerId)` → FileMaker `devProjects` layout
   - Filters by `_custID` field
   - Displays list with name, status, dates, completion percentage

2. **View Project Details**
   - User clicks project from list
   - Frontend calls `loadProjectDetails(projectId)` → Parallel fetches to 5 layouts:
     - `devProjectImages` (filtered by `_fkID`)
     - `devProjectLinks` (filtered by `_fkID`)
     - `devProjectObjectives` (filtered by `_projectID`)
     - `devProjectObjSteps` (filtered by objective IDs)
     - `devNotes` (filtered by `_fkID`)
   - Displays ProjectDetails component with tabs (Overview, Objectives, Time Records, Images, Links, Notes)

3. **Create Project**
   - User clicks "Add Project" button in customer view
   - Fills out ProjectForm (Name*, Customer*, Description, Status, Dates, Value, Pricing Type)
   - Frontend validates (see src/services/projectService.js:217-259) and calls `createProject(data)` → FileMaker `devProjects` CREATE
   - **Supabase Sync** (src/hooks/useProject.js:213-259):
     - Project creation DOES sync to Supabase `projects` table for proposal foreign key support
     - Maps status values (Open → active, Closed → completed, etc.)
     - Sets `created_by` field from user email/username
   - **Business Logic Triggers** (src/hooks/useProject.js:262-289):
     - If `f_fixedPrice = true` or `isFixedPrice = true`:
       - Calls `processProjectValue()` to prepare sales entries (see src/services/projectService.js:508-596)
       - Sets billable status to false for all time records
       - If user has `supabaseOrgID`, calls `createSalesFromProjectValue()` (see src/services/salesService.js)
     - If `f_subscription = true` or `isSubscription = true`:
       - Processes monthly sales entries from dateStart to dateEnd or today
       - Each month creates a sales entry equal to project value
   - Reloads project list

4. **Update Project**
   - User edits project fields in ProjectDetails or ProjectForm
   - Frontend validates and calls `updateProject(projectId, data)` → FileMaker `devProjects` UPDATE (src/hooks/useProject.js:310-386)
   - Uses `project.recordId` (FileMaker internal ID) for UPDATE operation, not UUID
   - **Business Logic on Update** (src/hooks/useProject.js:330-362):
     - Re-processes fixed price or subscription logic if those flags are set
     - Creates any missing sales entries based on current dates
     - Updates billable status if needed
   - **No Supabase sync on update** - only FileMaker is updated
   - Updates local state optimistically

5. **Update Project Status**
   - User toggles status in ProjectDetails component (src/components/projects/ProjectDetails.jsx:72-100)
   - Toggle switches between "Open" and "Closed" status
   - Frontend calls `updateProjectStatus(projectId, status)` → FileMaker API (src/hooks/useProject.js:391-428)
   - Uses `project.recordId` for status update operation
   - Status change may affect billable hours calculations
   - Updates local state optimistically before API call completes

6. **Delete Project**
   - User clicks delete button (confirmation required)
   - Frontend calls `deleteProject(recordId)` → FileMaker `devProjects` DELETE (src/hooks/useProject.js:441-473)
   - Uses `project.recordId` (FileMaker internal ID) for DELETE operation
   - **Orphaned Data Risk**: Related objectives, steps, images, links, notes may remain in FileMaker
   - **No Supabase deletion** - project remains in Supabase `projects` table
   - Clears selected project if it was the deleted one

7. **Manage Objectives & Steps**
   - User adds/edits/deletes objectives in Objectives tab (ProjectObjectivesTab component)
   - Frontend calls `createObjective(data)` → FileMaker `devProjectObjectives` CREATE (src/hooks/useProject.js:520-552)
   - Objective data includes: `_projectID`, `projectObjective` (text), `status` (default "Open"), `f_completed` (0 or 1)
   - Steps are created/updated within objectives (nested UI)
   - Completion tracking calculates percentage based on completed steps vs total steps (src/services/projectService.js:312-335)
   - 500ms delay after objective creation to avoid FileMaker race conditions

8. **View Time Records**
   - User views Time Records tab in project details
   - Frontend fetches records from `dapiRecords` layout (filtered by `_projectID`)
   - Processes records with duration calculation (src/services/projectService.js:156-193)
   - Displays billable hours, unbilled hours (filters by `f_billed` field), total value
   - Shows records sorted by start time (newest first)

### Target User Flows (Supabase-Only)

All operations should route through backend API endpoints with:
- Unified CRUD operations for projects and all related entities
- Automatic business logic execution (fixed-price and subscription sales generation)
- Organization scoping via RLS policies
- Proper cascading deletes for related data
- Audit logging and change tracking

## Documentation Structure

1. **[Current Implementation](./current-implementation.md)**
   - FileMaker integration details and API call graph
   - Frontend code architecture (hooks, services, components)
   - Business logic for fixed-price and subscription projects
   - Related entity handling (objectives, steps, images, links, notes)
   - Data flow diagrams

2. **[Data Model Mapping](./data-model-mapping.md)**
   - FileMaker `devProjects` field definitions
   - FileMaker related layouts (objectives, steps, images, links, notes, records)
   - Supabase multi-table schema (projects + 6 related tables)
   - Field-by-field mapping with data type conversions
   - ID reconciliation strategy (FileMaker UUID → Supabase UUID)
   - Relationship preservation (customer, team, objectives hierarchy)

3. **[API Contracts](./api-contracts.md)**
   - Required backend endpoints/RPCs for project CRUD
   - Endpoints for objectives, steps, images, links management
   - Business logic endpoints (fixed-price sales, subscription sales)
   - Time records querying and billable status updates
   - Request/response formats with examples
   - Validation rules and error responses

4. **[Authorization](./authorization.md)**
   - Row-Level Security (RLS) policies for all project tables
   - Organization scoping requirements
   - User role permissions (admin, team member, read-only)
   - Team-based access control (only team members can edit)
   - Cross-organization access controls

5. **[Migration Plan](./migration-plan.md)**
   - Data backfill strategy (FileMaker → Supabase) for all 7 layouts
   - ID reconciliation and relationship preservation
   - Objectives/steps hierarchy migration
   - Notes and links polymorphic association migration
   - Time records linkage preservation
   - Cutover approach (feature flag vs hard cutover)
   - Rollback procedures and validation

6. **[Acceptance Criteria](./acceptance-criteria.md)**
   - Functional test cases for all user workflows
   - Business logic validation (fixed-price, subscription)
   - Edge cases and error scenarios
   - Performance requirements (list load, detail load)
   - Data integrity validation (relationships, cascading deletes)
   - Completion tracking accuracy

## Related Features

**Dependent Features** (must exist before Projects):
- **Customers** - Foreign key relationship (`_custID`)
- **Teams** - Foreign key relationship (`_teamID`)

**Dependent Features** (must migrate after Projects):
- **Tasks** - Tasks can be associated with projects
- **Financial Records** - Time records reference projects via `_projectID`
- **Notes** - Notes can be associated with projects
- **Links** - Links can be associated with projects

**Independent Features** (can migrate in parallel):
- **Prospects** - Already Supabase-only
- **Products** - Independent entity

## Code References

### API Layer
- `src/api/projects.js` - FileMaker API calls (213 lines)
  - `fetchProjectsForCustomer(customerId)` - Query projects by customer
  - `fetchProjectsForCustomers(customerIds)` - Query projects for multiple customers
  - `fetchAllProjectData(projectId)` - Fetch project + all related data
  - `fetchProjectRelatedData(projectId, layout)` - Generic related data fetch
  - `fetchProjectNotes(projectId)` - Fetch notes for project
  - `createProject(data)` - Create new project (FM only)
  - `updateProject(projectId, data)` - Update project (FM only)
  - `updateProjectStatus(projectId, status)` - Update status
  - `deleteProject(recordId)` - Delete project (FM only)
  - `createObjective(data)` - Create objective

### Services Layer
- `src/services/projectService.js` - Business logic (location TBD)
  - `processProjectData(data)` - Transform FM response to UI format
  - `validateProjectData(data)` - Validation rules
  - `formatProjectForFileMaker(data)` - Transform UI data to FM format
  - `calculateProjectCompletion(objectives)` - Calculate completion percentage
  - `processProjectImages(images, projectId)` - Process images data
  - `processProjectLinks(links, projectId)` - Process links data
  - `processProjectObjectives(objectives, projectId, steps)` - Process objectives + steps
  - `processProjectValue(value)` - Process value field
  - `updateProjectRecordsBillableStatus(projectId, billable)` - Update time records

- `src/services/salesService.js` - Financial operations (location TBD)
  - `createSalesFromProjectValue(project, user)` - Generate sales entries for fixed-price/subscription

### Hooks Layer
- `src/hooks/useProject.js` - Main project hook (582 lines)
  - State management for projects list and selected project
  - `loadProjects(customerId)` - Load projects for customer (lines 57-91)
  - `loadProjectDetails(projectId)` - Load all related data (lines 96-137)
  - `handleProjectSelect(projectId)` - Select and load project (lines 142-180)
  - `handleProjectCreate(data)` - Create project workflow with Supabase sync (lines 185-305)
  - `handleProjectUpdate(projectId, data)` - Update project workflow (lines 310-386)
  - `handleProjectDelete(recordId)` - Delete project workflow (lines 441-473)
  - `handleProjectStatusChange(projectId, status)` - Update status (lines 391-428)
  - `handleProjectTeamChange(projectId, teamId)` - Update team assignment (lines 478-515)
  - `handleObjectiveCreate(projectId, objectiveText)` - Create objective (lines 520-552)
  - All CRUD operations with loading/error states
  - **Partial Supabase integration**: Syncs project creation only (lines 213-259)

### UI Components
- `src/components/projects/ProjectDetails.jsx` - Project detail view with tabs
- `src/components/projects/ProjectForm.jsx` - Create/edit project form
- `src/components/projects/ProjectTabs.jsx` - Tab navigation
- `src/components/projects/ObjectivesTab.jsx` - Objectives management UI
- `src/components/projects/ObjectivesList.jsx` - Objectives list
- `src/components/projects/ObjectiveItem.jsx` - Single objective with steps
- `src/components/projects/ImagesTab.jsx` - Images gallery
- `src/components/projects/LinksTab.jsx` - Links list
- `src/components/projects/NotesTab.jsx` - Notes list

### Related Components
- `src/components/financial/ProjectRecordsTable.jsx` - Time records by project
- `src/components/customers/CustomerProjects.jsx` - Projects list in customer view

## Dependencies

### External Libraries
- `uuid` (v4) - UUID generation for new projects in Supabase
- `react` - Component framework
- `date-fns` - Date manipulation (start/end dates, subscription calculations)

### Internal Services
- `supabaseService.js` - Low-level Supabase operations (used for project creation sync via `insert()`)
- `dataService.js` - Environment-aware data routing (FileMaker only, no Supabase routing for projects)
- `initializationService.js` - App startup (may preload projects for customers)
- `salesService.js` - Financial operations (creates sales entries for fixed-price and subscription projects)

### Context/State
- `AppStateContext` - Global app state
- `ProjectContext` - Project-specific state and records management
- `SnackBarContext` - User notifications for errors/success

## Known Issues & Technical Debt

1. **Partial Supabase Integration**:
   - Projects sync to Supabase ONLY on creation (src/hooks/useProject.js:213-259)
   - Updates and deletes do NOT sync to Supabase
   - Creates data inconsistency between FileMaker and Supabase
   - Supabase sync is only for proposal foreign key support, not a full dual-write

2. **Business Logic IS Implemented But May Have Gaps**:
   - Fixed-price sales generation IS called on project creation (src/hooks/useProject.js:262-289)
   - Subscription monthly sales generation IS implemented (src/services/projectService.js:563-593)
   - However, requires user to have `supabaseOrgID` to create sales entries
   - Users without `supabaseOrgID` will NOT get sales entries created
   - Billable status updates exist (src/services/projectService.js:631-643) but implementation is placeholder

3. **Incomplete Cascading Deletes**:
   - Deleting a project does NOT delete related objectives, steps, images, links, notes
   - Orphaned records accumulate in FileMaker
   - No cleanup mechanism or soft-delete pattern

4. **No Organization Scoping in FileMaker**:
   - Projects don't have organization_id field in FileMaker
   - Filtering by organization will require migration strategy
   - Current Supabase sync adds `organization_id` implicitly but not stored in FileMaker

5. **Time Records Integration**:
   - Time records use `_projectID` field in `dapiRecords` layout
   - Maps to FileMaker time tracking but unclear Supabase equivalent
   - May need to map to `time_entries` or `customer_sales` tables
   - Billable status updates are placeholder, not fully functional

6. **Notes Polymorphic Association**:
   - Notes use `_fkID` to associate with projects/customers/tasks
   - Supabase needs explicit polymorphic association pattern (entity_type + entity_id)
   - Current implementation fetches notes by `_fkID` matching project `__ID`

7. **ID Confusion**:
   - Code uses both `__ID` (UUID) and `recordId` (FileMaker internal) inconsistently
   - CREATE uses `__ID`, UPDATE/DELETE use `recordId`
   - Status change uses `recordId` (src/hooks/useProject.js:397)
   - This dual-ID pattern causes confusion and potential bugs

## Success Metrics

- **Data Integrity**: 100% of FileMaker projects migrated with all related data (objectives, steps, images, links, notes)
- **Relationship Integrity**: All customer, team, and time record relationships preserved
- **Business Logic Accuracy**: Fixed-price and subscription sales entries generated correctly during migration
- **Performance**: Project list loads in <500ms, detail view with all related data in <1s
- **Feature Parity**: All existing UI workflows function identically
- **No Data Loss**: Zero project records or related data lost during migration
- **Backward Compatibility**: Can rollback to FileMaker if needed

## Next Steps

1. Review and approve this requirements documentation
2. Create backend implementation plan (BACKEND_CHANGE_REQUEST)
3. Implement backend API endpoints + RLS policies + business logic triggers
4. Update frontend to use backend API (remove FileMaker dependencies)
5. Execute data migration (backfill Supabase from FileMaker for all 7 layouts)
6. Feature flag rollout and validation
7. Remove FileMaker dependencies and cleanup code
