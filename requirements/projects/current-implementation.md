# Current Implementation

This document describes the current FileMaker-based implementation of the Projects feature, including frontend call graphs, code architecture, and business logic for fixed-price and subscription projects.

## Frontend Call Graph

### 1. Fetch Projects for Customer

```
User Action: Navigate to Customer Details → Projects tab
    ↓
useProject(customerId).loadProjects()  [src/hooks/useProject.js:57-91]
    ↓
fetchProjectsForCustomer(customerId)  [src/api/projects.js:27-39]
    ↓
handleFileMakerOperation(() => {
    fetchDataFromFileMaker({
        layout: "devProjects",
        action: "READ",
        query: [{ "_custID": customerId }]
    })
})  [src/api/fileMaker.js]
    ↓
FileMaker Data API: GET /fmi/data/v1/databases/clarityCRM/layouts/devProjects/records?query=...
    ↓
processProjectData(result)  [src/services/projectService.js:25-56]
    - Maps fieldData to flat structure
    - Converts __ID to id, recordId to recordId
    - Converts f_fixedPrice/f_subscription ("1"/"0") to boolean
    - Converts value to float
    - Adds status default ("Open")
    - Extracts timestamps, dates
    ↓
setProjects(processedProjects) → State updated
    ↓
UI Renders: ProjectList component displays projects
```

### 2. Load Project Details (With All Related Data)

```
User Action: Click project from list
    ↓
useProject().handleProjectSelect(projectId)  [src/hooks/useProject.js:142-169]
    ↓
loadProjectDetails(projectId)  [src/hooks/useProject.js:96-137]
    ↓
Promise.all([
    fetchProjectRelatedData([projectId], 'devProjectImages'),
    fetchProjectRelatedData([projectId], 'devProjectLinks'),
    fetchProjectRelatedData([projectId], 'devProjectObjectives'),
    fetchProjectRelatedData([projectId], 'devProjectObjSteps'),
    fetchProjectRelatedData([projectId], 'devNotes')
])  [src/api/projects.js:61-84]
    ↓
5 Parallel FileMaker API Calls:
    1. devProjectImages: GET /fmi/data/v1/databases/clarityCRM/layouts/devProjectImages/records?query=[{"_fkID": projectId}]
    2. devProjectLinks: GET /fmi/data/v1/databases/clarityCRM/layouts/devProjectLinks/records?query=[{"_fkID": projectId}]
    3. devProjectObjectives: GET /fmi/data/v1/databases/clarityCRM/layouts/devProjectObjectives/records?query=[{"_projectID": projectId}]
    4. devProjectObjSteps: GET /fmi/data/v1/databases/clarityCRM/layouts/devProjectObjSteps/records?query=[{"_objectiveID": *}]
    5. devNotes: GET /fmi/data/v1/databases/clarityCRM/layouts/devNotes/records?query=[{"_fkID": projectId}]
    ↓
Process each type:
    - processProjectImages(images, projectId)  [src/services/projectService.js:64-78]
    - processProjectLinks(links, projectId)  [src/services/projectService.js:86-99]
    - processProjectObjectives(objectives, projectId, steps)  [src/services/projectService.js:108-125]
      └─ processObjectiveSteps(steps, objectiveId)  [src/services/projectService.js:133-148]
    - notes: raw response data
    ↓
setProjects(prevProjects => map with projectDetails) → State updated
    ↓
UI Renders: ProjectDetails component with all tabs (Overview, Objectives, Images, Links, Notes)
```

### 3. Create Project (FileMaker Only - No Dual-Write, No Business Logic)

```
User Action: Click "Add Project" → Fill form → Submit
    ↓
useProject().handleProjectCreate(projectData)  [src/hooks/useProject.js:estimated]
    ↓
validateProjectData(projectData)  [src/services/projectService.js:217-259]
    - Validates: projectName required, _custID required
    - Validates: f_fixedPrice requires value > 0
    - Validates: f_subscription requires value > 0 and dateStart
    - Validates: Cannot be both fixed price and subscription
    - Returns { isValid, errors }
    ↓
formatProjectForFileMaker(projectData)  [src/services/projectService.js:292-305]
    - Converts: name → projectName, customerId → _custID, isFixedPrice → f_fixedPrice ("1"/"0"), etc.
    - Converts: dateStart/dateEnd to MM/DD/YYYY format
    ↓
createProject(formattedData)  [src/api/projects.js:112-124]
    ↓
handleFileMakerOperation(() => {
    fetchDataFromFileMaker({
        layout: "devProjects",
        action: "CREATE",
        fieldData: data
    })
})  [src/api/fileMaker.js]
    ↓
FileMaker Data API: POST /fmi/data/v1/databases/clarityCRM/layouts/devProjects/records
    ↓
loadProjects(customerId) → Reload full list to get new project
    ↓
⚠️ NO SUPABASE WRITE - Project only exists in FileMaker
⚠️ NO BUSINESS LOGIC EXECUTION - Fixed-price/subscription sales NOT created
```

### 4. Update Project (FileMaker Only - No Dual-Write)

```
User Action: Edit project fields → Submit
    ↓
useProject().handleProjectUpdate(projectId, projectData)  [src/hooks/useProject.js:estimated]
    ↓
validateProjectData(projectData)  [src/services/projectService.js:217-259]
    ↓
formatProjectForFileMaker(projectData)  [src/services/projectService.js:292-305]
    ↓
updateProject(projectId, formattedData)  [src/api/projects.js:132-145]
    ↓
handleFileMakerOperation(() => {
    fetchDataFromFileMaker({
        layout: "devProjects",
        action: "UPDATE",
        recordId: projectId,
        fieldData: data
    })
})  [src/api/fileMaker.js]
    ↓
FileMaker Data API: PUT /fmi/data/v1/databases/clarityCRM/layouts/devProjects/records/{recordId}
    ↓
⚠️ NO SUPABASE SYNC
⚠️ Business logic for fixed-price/subscription NOT re-run
```

### 5. Update Project Status

```
User Action: Change status dropdown
    ↓
useProject().handleStatusChange(projectId, newStatus)  [src/hooks/useProject.js:estimated]
    ↓
updateProjectStatus(projectId, status)  [src/api/projects.js:92-105]
    ↓
handleFileMakerOperation(() => {
    fetchDataFromFileMaker({
        layout: "devProjects",
        action: "UPDATE",
        recordId: projectId,
        fieldData: { status }
    })
})  [src/api/fileMaker.js]
    ↓
FileMaker Data API: PUT /fmi/data/v1/databases/clarityCRM/layouts/devProjects/records/{recordId}
    ↓
Update local state with new status
```

### 6. Delete Project (FileMaker Only - Orphaned Related Data)

```
User Action: Click delete → Confirm
    ↓
useProject().handleProjectDelete(recordId)  [src/hooks/useProject.js:estimated]
    ↓
deleteProject(recordId)  [src/api/projects.js:8-20]
    ↓
handleFileMakerOperation(() => {
    fetchDataFromFileMaker({
        layout: "devProjects",
        action: "DELETE",
        recordId
    })
})  [src/api/fileMaker.js]
    ↓
FileMaker Data API: DELETE /fmi/data/v1/databases/clarityCRM/layouts/devProjects/records/{recordId}
    ↓
⚠️ ORPHANED DATA: Objectives, steps, images, links, notes remain in FileMaker
⚠️ NO SUPABASE CLEANUP
```

### 7. Create Objective

```
User Action: Click "Add Objective" in Objectives tab → Submit
    ↓
useProject().handleCreateObjective(objectiveData)  [src/hooks/useProject.js:estimated]
    ↓
createObjective(data)  [src/api/projects.js:201-213]
    ↓
handleFileMakerOperation(() => {
    fetchDataFromFileMaker({
        layout: "devProjectObjectives",
        action: "CREATE",
        fieldData: {
            _projectID: projectId,
            projectObjective: objectiveText,
            order: orderNumber,
            status: "Open"
        }
    })
})  [src/api/fileMaker.js]
    ↓
FileMaker Data API: POST /fmi/data/v1/databases/clarityCRM/layouts/devProjectObjectives/records
    ↓
Reload project details to show new objective
```

## Business Logic (Currently NOT Implemented in Frontend)

### Fixed-Price Projects

**Expected Behavior** (documented in `processProjectValue()`):
1. When project is created with `f_fixedPrice = "1"`:
   - If `dateStart` exists and is <= today: Create sales entry for 50% of value
   - If `dateEnd` exists and is <= today: Create sales entry for 50% of value
2. All time records for project should be marked as non-billable

**Current Implementation**:
- ⚠️ Function `processProjectValue()` exists in [src/services/projectService.js:508-596]
- ⚠️ Function `createSalesFromProjectValue()` referenced but NOT implemented in salesService
- ⚠️ Frontend does NOT call this logic on project creation/update
- ⚠️ Sales entries are NOT created automatically
- ⚠️ Time records billable status is NOT updated

### Subscription Projects

**Expected Behavior** (documented in `processProjectValue()`):
1. When project is created with `f_subscription = "1"`:
   - Calculate months between `dateStart` and today (or `dateEnd` if set)
   - For each month, create a sales entry equal to project value
   - Monthly entries continue until project end date or indefinitely

**Current Implementation**:
- ⚠️ Function `processProjectValue()` exists with subscription logic
- ⚠️ Monthly sales entries are NOT created automatically
- ⚠️ No background job or cron to generate ongoing subscription entries
- ⚠️ Frontend has no UI to trigger manual subscription billing

## Code Architecture

### API Layer (src/api/projects.js)

**FileMaker Layouts Used**:
- `devProjects` - Main projects table
- `devProjectImages` - Project images (filtered by `_fkID`)
- `devProjectLinks` - Project links (filtered by `_fkID`)
- `devProjectObjectives` - Project objectives (filtered by `_projectID`)
- `devProjectObjSteps` - Objective steps (filtered by `_objectiveID`)
- `devNotes` - Notes (filtered by `_fkID`, polymorphic)
- `dapiRecords` - Time records (filtered by `_projectID`)

**API Functions** (213 lines total):
1. `deleteProject(recordId)` - Delete project
2. `fetchProjectsForCustomer(customerId)` - Query by customer
3. `fetchProjectNotes(projectId)` - Query notes
4. `fetchProjectRelatedData(projectId, layout)` - Generic related data query
5. `updateProjectStatus(projectId, status)` - Update status
6. `createProject(data)` - Create project
7. `updateProject(projectId, data)` - Update project
8. `fetchAllProjectData(projectId)` - Parallel fetch all related data
9. `fetchProjectsForCustomers(customerIds)` - Query for multiple customers
10. `createObjective(data)` - Create objective

### Services Layer

**src/services/projectService.js** (643 lines):
- `processProjectData(projectData, relatedData)` - Transform FM response to UI format
- `processProjectImages(images, projectId)` - Process images
- `processProjectLinks(links, projectId)` - Process links
- `processProjectObjectives(objectives, projectId, steps)` - Process objectives + steps hierarchy
- `processObjectiveSteps(steps, objectiveId)` - Process steps
- `validateProjectData(data)` - Validation rules
- `formatProjectForFileMaker(data)` - Transform UI data to FM format
- `formatProjectForDisplay(project)` - Format for UI display
- `calculateProjectCompletion(project)` - Calculate completion % based on steps
- `groupProjectsByStatus(projects)` - Group by open/closed
- `calculateProjectStats(projects)` - Aggregate statistics
- `calculateCustomerStats(projects, records)` - Customer-specific stats
- `calculateProjectDetailStats(project, records)` - Single project stats
- `processProjectValue(project, isUpdate)` - **Business logic for fixed-price/subscription** (NOT CALLED)
- `updateProjectRecordsBillableStatus(projectId, isBillable)` - Update time records billable flag (MOCK)

**src/services/salesService.js** (partial review):
- `fetchSalesByOrganization(organizationId)` - Query Supabase customer_sales
- `fetchUnbilledSalesByOrganization(organizationId)` - Query unbilled sales
- `createSalesFromProjectValue(project, user)` - **REFERENCED but NOT IMPLEMENTED**

### Hooks Layer

**src/hooks/useProject.js** (estimated 300+ lines):
- State management: `projects`, `selectedProject`, `loading`, `error`
- `loadProjects(custId)` - Load projects for customer (or all if no custId)
- `loadProjectDetails(projectId)` - Load all related data in parallel
- `handleProjectSelect(projectOrId)` - Select and load project
- CRUD operations: create, update, delete (estimated)
- **No Supabase integration**
- **Uses FileMaker API exclusively**

### UI Components

**Projects Components** (estimated locations):
- `src/components/projects/ProjectDetails.jsx` - Main project view with tabs
- `src/components/projects/ProjectForm.jsx` - Create/edit form
- `src/components/projects/ProjectTabs.jsx` - Tab navigation
- `src/components/projects/ObjectivesTab.jsx` - Objectives management UI
- `src/components/projects/ObjectivesList.jsx` - List of objectives
- `src/components/projects/ObjectiveItem.jsx` - Single objective with nested steps
- `src/components/projects/ImagesTab.jsx` - Images gallery
- `src/components/projects/LinksTab.jsx` - Links list
- `src/components/projects/NotesTab.jsx` - Notes list

**Related Components**:
- `src/components/customers/CustomerProjects.jsx` - Projects tab in customer view
- `src/components/financial/ProjectRecordsTable.jsx` - Time records by project

## Data Flow Diagrams

### Project Creation Flow

```
User Form Input
    ↓
Validation (projectService)
    ↓
Format for FileMaker (projectService)
    ↓
FileMaker API Call (projects.js)
    ↓
FileMaker Database (devProjects)
    ↓
Reload Projects List
    ↓
UI Update

❌ Missing: Supabase write
❌ Missing: Fixed-price sales generation
❌ Missing: Subscription setup
```

### Project Detail Load Flow

```
Select Project
    ↓
Parallel Fetch (5 API calls):
    - Images (devProjectImages)
    - Links (devProjectLinks)
    - Objectives (devProjectObjectives)
    - Steps (devProjectObjSteps)
    - Notes (devNotes)
    ↓
Process Each Type (projectService)
    ↓
Merge into Project Object
    ↓
Update State
    ↓
Render Tabs (Overview, Objectives, Images, Links, Notes)
```

### Fixed-Price Business Logic (EXPECTED, NOT IMPLEMENTED)

```
Project Created with f_fixedPrice = "1"
    ↓
Check dateStart
    ↓
If dateStart <= today:
    Create Sales Entry:
        - Amount: value / 2
        - Type: "sellable"
        - Description: "50% on start"
    ↓
Check dateEnd
    ↓
If dateEnd <= today:
    Create Sales Entry:
        - Amount: value / 2
        - Type: "sales"
        - Description: "50% on completion"
    ↓
Update all project time records:
    - Set billable = false
```

### Subscription Business Logic (EXPECTED, NOT IMPLEMENTED)

```
Project Created with f_subscription = "1"
    ↓
Calculate months from dateStart to today (or dateEnd)
    ↓
For each month:
    Create Sales Entry:
        - Amount: value
        - Type: "sales"
        - Description: "Subscription - Month X"
        - Date: Start of month
    ↓
Continue creating entries monthly until:
    - dateEnd is reached, OR
    - No dateEnd (perpetual subscription)
```

## FileMaker Field Mappings (Quick Reference)

### devProjects Layout
- `__ID` → `id` (UUID)
- `recordId` → `recordId` (FM internal)
- `projectName` → `projectName` (string)
- `_custID` → `customerId` (UUID FK to customers)
- `_teamID` → `teamId` (UUID FK to teams)
- `status` → `status` (string: "Open", "Active", "On Hold", "Completed", "Cancelled")
- `f_fixedPrice` → `f_fixedPrice` ("1"/"0" → boolean)
- `f_subscription` → `f_subscription` ("1"/"0" → boolean)
- `value` → `value` (string → float)
- `dateStart` → `dateStart` (MM/DD/YYYY → YYYY-MM-DD)
- `dateEnd` → `dateEnd` (MM/DD/YYYY → YYYY-MM-DD)
- `estOfTime` → `estOfTime` (string, e.g., "2h 30m")
- `~creationTimestamp` → `createdAt` (timestamp)
- `~modificationTimestamp` → `modifiedAt` (timestamp)

### devProjectObjectives Layout
- `__ID` → `id` (UUID)
- `recordId` → `recordId` (FM internal)
- `_projectID` → `projectId` (UUID FK to projects)
- `projectObjective` → `objective` (text)
- `status` → `status` (string)
- `order` → `order` (number)
- `f_completed` → `completed` ("1"/"0" → boolean)

### devProjectObjSteps Layout
- `__ID` → `id` (UUID)
- `recordId` → `recordId` (FM internal)
- `_objectiveID` → `objectiveId` (UUID FK to objectives)
- `projectObjectiveStep` → `step` (text)
- `order` → `order` (number)
- `f_completed` → `completed` ("1"/"0" → boolean)

### devProjectImages Layout
- `__ID` → `id` (UUID)
- `recordId` → `recordId` (FM internal)
- `_fkID` → filtered by projectId (polymorphic FK)
- `url` → `url` (string)
- `title` → `title` (string)
- `description` → `description` (text)

### devProjectLinks Layout
- `__ID` → `id` (UUID)
- `recordId` → `recordId` (FM internal)
- `_fkID` → filtered by projectId (polymorphic FK)
- `link` → `url` (string)
- `title` → `title` (string, derived from URL if empty)

### devNotes Layout (Polymorphic)
- `__ID` → `id` (UUID)
- `recordId` → `recordId` (FM internal)
- `_fkID` → filtered by projectId (polymorphic FK - can be project, customer, or task ID)
- Note fields (TBD - not documented in services)

### dapiRecords Layout (Time Records)
- `__ID` → `id` (UUID)
- `recordId` → `recordId` (FM internal)
- `_projectID` → `projectId` (UUID FK to projects)
- `_custID` → `customerId` (UUID FK to customers)
- `startTime` → `startTime` (timestamp)
- `endTime` → `endTime` (timestamp)
- `description` → `description` (text)
- `f_billed` → `isBilled` ("1"/"0" → boolean)
- `Billable_Time_Rounded` → Calculated hours (float)

## Known Gaps and Issues

1. **No Supabase Integration**:
   - Projects exist ONLY in FileMaker
   - No dual-write, no backup
   - Complete data loss risk if FileMaker fails

2. **Business Logic Not Executed**:
   - Fixed-price sales generation code exists but NOT called
   - Subscription billing code exists but NOT called
   - Time records billable status update is a mock function

3. **Orphaned Related Data**:
   - Deleting a project does NOT delete objectives, steps, images, links, notes
   - FileMaker may have cascading delete rules (unverified)
   - Frontend has no cleanup logic

4. **Polymorphic Associations**:
   - Notes use `_fkID` field without entity type indicator
   - Cannot distinguish if note is for project, customer, or task without context
   - Migration to Supabase requires entity_type field

5. **Time Records Integration**:
   - Time records reference projects via `_projectID`
   - Unclear how dapiRecords maps to Supabase `time_entries` or `customer_sales`
   - Separate investigation needed for time tracking migration

6. **No Organization Scoping**:
   - FileMaker projects don't have organization_id
   - Multi-tenant support requires migration strategy
   - RLS policies cannot be applied without org field

7. **Date Format Conversion**:
   - FileMaker uses MM/DD/YYYY, Supabase uses YYYY-MM-DD
   - Conversion logic in projectService (convertToFileMakerDate)
   - Risk of timezone issues during migration

## Code File References

### API Layer
- `src/api/projects.js` - 213 lines
- `src/api/fileMaker.js` - FileMaker API wrapper

### Services Layer
- `src/services/projectService.js` - 643 lines
- `src/services/salesService.js` - Partial (sales CRUD, NOT project value processing)

### Hooks Layer
- `src/hooks/useProject.js` - Estimated 300+ lines (file not fully reviewed)

### Context
- `src/context/ProjectContext.jsx` - Project records context

### Components (Estimated Locations)
- `src/components/projects/ProjectDetails.jsx`
- `src/components/projects/ProjectForm.jsx`
- `src/components/projects/ProjectTabs.jsx`
- `src/components/projects/ObjectivesTab.jsx`
- `src/components/projects/ObjectivesList.jsx`
- `src/components/projects/ObjectiveItem.jsx`
- `src/components/projects/ImagesTab.jsx`
- `src/components/projects/LinksTab.jsx`
- `src/components/projects/NotesTab.jsx`

## Next Steps

1. **Complete Code Audit**: Review all project-related components and hooks
2. **Verify FileMaker Schema**: Audit all 7 FileMaker layouts for complete field list
3. **Document Missing Features**: Identify any project features not captured in this analysis
4. **Define Backend Requirements**: Create comprehensive API contracts for all operations
5. **Plan Business Logic Migration**: Design backend triggers for fixed-price and subscription billing
