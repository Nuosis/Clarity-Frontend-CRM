# Projects Migration Requirements

## Overview

This directory contains comprehensive documentation for migrating the Projects feature from FileMaker to Supabase. Projects are the core workflow entity in the CRM system, representing client engagements with associated objectives, tasks, time tracking, images, links, and notes. Projects support multiple pricing models including fixed-price and subscription-based billing.

## Current Status

- **Phase**: Phase 1 - Requirements Documentation
- **FileMaker Layouts**: `devProjects` (main), `devProjectObjectives`, `devProjectObjSteps`, `devProjectImages`, `devProjectLinks`, `devNotes`, `dapiRecords`
- **Supabase Tables**: `projects` (exists), `project_objectives`, `project_objective_steps`, `project_images`, `links` (shared), `notes` (planned), `time_entries`/`customer_sales` (financial)
- **Backend Status**: No backend API - FileMaker-primary with no dual-write
- **Frontend Status**: 100% FileMaker-dependent

## Quick Reference

### FileMaker Implementation
- **Primary Layout**: `devProjects`
- **Primary Key**: `__ID` (UUID)
- **FileMaker Record ID**: `recordId` (internal FM record identifier)
- **Customer Relationship**: `_custID` (UUID, foreign key to customers)
- **Team Relationship**: `_teamID` (UUID, foreign key to teams)
- **Core Fields**: Name, Description, Status, dateStart, dateEnd, value (decimal), f_fixedPrice (boolean), f_subscription (boolean)
- **Related Layouts**:
  - `devProjectObjectives` - Project goals/milestones
  - `devProjectObjSteps` - Steps within objectives
  - `devProjectImages` - Project images/screenshots
  - `devProjectLinks` - External URLs related to project
  - `devNotes` - Notes associated with project (via `_fkID`)
  - `dapiRecords` - Time tracking records (via `_projectID`)

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
   - Frontend validates and calls `createProject(data)` → FileMaker `devProjects` CREATE
   - **Business Logic Triggers** (currently NOT implemented in frontend):
     - If `f_fixedPrice = true`: Should create 2 sales entries (50% at start, 50% at end)
     - If `f_subscription = true`: Should create monthly sales entries from start to end date
   - Reloads project list

4. **Update Project**
   - User edits project fields in ProjectDetails or ProjectForm
   - Frontend validates and calls `updateProject(projectId, data)` → FileMaker `devProjects` UPDATE
   - **No Supabase sync** - data only in FileMaker

5. **Update Project Status**
   - User changes status dropdown (Planning, Active, On Hold, Completed, Cancelled)
   - Frontend calls `updateProjectStatus(projectId, status)` → FileMaker API
   - Status change may affect billable hours calculations

6. **Delete Project**
   - User clicks delete button (confirmation required)
   - Frontend calls `deleteProject(recordId)` → FileMaker `devProjects` DELETE
   - **Orphaned Data Risk**: Related objectives, steps, images, links may remain in FileMaker

7. **Manage Objectives & Steps**
   - User adds/edits/deletes objectives in Objectives tab
   - Frontend calls `createObjective(data)` → FileMaker `devProjectObjectives` CREATE
   - Steps are created/updated within objectives (nested UI)
   - Completion tracking updates project completion percentage

8. **View Time Records**
   - User views Time Records tab in project details
   - Frontend fetches records from `dapiRecords` layout (filtered by `_projectID`)
   - Displays billable hours, unbilled hours, total value

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
- `src/hooks/useProject.js` - Main project hook (location TBD, estimated 300+ lines)
  - State management for projects list and selected project
  - `loadProjects(customerId)` - Load projects for customer
  - `loadProjectDetails(projectId)` - Load all related data
  - `handleProjectSelect(projectId)` - Select and load project
  - `handleProjectCreate(data)` - Create project workflow
  - `handleProjectUpdate(projectId, data)` - Update project workflow
  - `handleProjectDelete(recordId)` - Delete project workflow
  - All CRUD operations with loading/error states
  - **No Supabase integration currently**

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
- `supabaseService.js` - Low-level Supabase operations (currently NOT used for projects)
- `dataService.js` - Environment-aware data routing (FileMaker only currently)
- `initializationService.js` - App startup (may preload projects)

### Context/State
- `AppStateContext` - Global app state
- `ProjectContext` - Project-specific state and records management
- `SnackBarContext` - User notifications for errors/success

## Known Issues & Technical Debt

1. **No Supabase Integration**:
   - Projects are 100% FileMaker-dependent
   - No dual-write, no backup in Supabase
   - Complete rewrite required for migration

2. **Business Logic Not Implemented**:
   - Fixed-price sales generation NOT triggered on project creation (src/services/salesService.js references but not called)
   - Subscription monthly sales generation NOT implemented
   - Billable status updates exist but not automated

3. **Incomplete Cascading Deletes**:
   - Deleting a project does NOT delete related objectives, steps, images, links, notes
   - Orphaned records accumulate in FileMaker

4. **No Organization Scoping**:
   - Projects don't have organization_id field in FileMaker
   - Filtering by organization will require migration strategy

5. **Time Records Integration**:
   - Time records use `_projectID` field in `dapiRecords` layout
   - Unclear how this maps to Supabase `time_entries` or `customer_sales` tables
   - May require separate migration effort for time tracking

6. **Notes Polymorphic Association**:
   - Notes use `_fkID` to associate with projects/customers/tasks
   - Supabase needs explicit polymorphic association pattern (entity_type + entity_id)

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
