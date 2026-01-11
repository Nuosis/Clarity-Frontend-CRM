# Current Implementation

This document describes the current FileMaker-based implementation of the Projects feature, including complete frontend call graphs from UI → hooks → services → API, all code files, FileMaker layouts, data flow diagrams, state management patterns, and business logic for fixed-price and subscription projects.

## Table of Contents
1. [Frontend Call Graph](#frontend-call-graph)
2. [Component Architecture](#component-architecture)
3. [Hooks Layer](#hooks-layer)
4. [Services Layer](#services-layer)
5. [API Layer](#api-layer)
6. [State Management](#state-management)
7. [Business Logic](#business-logic)
8. [FileMaker Layouts and Schemas](#filemaker-layouts-and-schemas)
9. [Data Flow Diagrams](#data-flow-diagrams)
10. [Known Gaps and Issues](#known-gaps-and-issues)

---

## Frontend Call Graph

### 1. Application Initialization with Projects

```
App Startup [src/index.jsx:163-234]
    ↓
Authentication complete (FileMaker or Supabase)
    ↓
initializationService.loadUserContext() [line 182]
    ↓
setUser(userContext) → AppStateContext
    ↓
useCustomer(null) → Loads all customers [line 49-56]
useProject(projectCustomerId) → Initialized but waits for customer selection [line 72-86]
    ↓
User navigates to Customer Details
    ↓
handleCustomerSelect(customer) [src/index.jsx via MainContent]
    ↓
setSelectedCustomer(customer) → AppStateContext
    ↓
useProject(customerId) re-triggers with new customerId
    ↓
loadProjects(customerId) [src/hooks/useProject.js:57-91]
```

### 2. Load Projects for Customer

```
User Action: Navigate to Customer Details → Projects tab
    ↓
useProject(customerId).loadProjects(customerId)  [src/hooks/useProject.js:57-91]
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
    - Converts __ID → id, recordId → recordId
    - Converts f_fixedPrice/f_subscription ("1"/"0") → boolean
    - Converts value string → float
    - Adds status default ("Open")
    - Extracts timestamps: ~creationTimestamp → createdAt, ~modificationTimestamp → modifiedAt
    - Converts dates: dateStart, dateEnd
    - Processes empty related data arrays: images: [], links: [], objectives: []
    ↓
setProjects(processedProjects) → Hook state
    ↓
UI Renders: ProjectListing component [src/components/customers/ProjectListing.jsx]
    ↓
Displays project cards via ProjectCard component [src/components/customers/ProjectCard.jsx]
```

### 3. Load Project Details (With All Related Data)

```
User Action: Click project card
    ↓
onProjectSelect(project) passed from MainContent [src/components/MainContent.jsx:71-74]
    ↓
handleProjectSelect(project) [src/index.jsx via useProject]
    ↓
useProject().handleProjectSelect(projectOrId)  [src/hooks/useProject.js:142-180]
    ↓
loadProjectDetails(projectId)  [src/hooks/useProject.js:96-137]
    ↓
Promise.all([
    fetchProjectRelatedData([projectId], 'devProjectImages'),      [line 99]
    fetchProjectRelatedData([projectId], 'devProjectLinks'),       [line 100]
    fetchProjectRelatedData([projectId], 'devProjectObjectives'),  [line 101]
    fetchProjectRelatedData([projectId], 'devProjectObjSteps'),    [line 102]
    fetchProjectRelatedData([projectId], 'devNotes')               [line 103]
])  [src/api/projects.js:61-84]
    ↓
5 Parallel FileMaker API Calls:
    1. devProjectImages: GET /layouts/devProjectImages/records?query=[{"_fkID": projectId}]
    2. devProjectLinks: GET /layouts/devProjectLinks/records?query=[{"_fkID": projectId}]
    3. devProjectObjectives: GET /layouts/devProjectObjectives/records?query=[{"_projectID": projectId}]
    4. devProjectObjSteps: GET /layouts/devProjectObjSteps/records (all steps, filtered client-side)
    5. devNotes: GET /layouts/devNotes/records?query=[{"_fkID": projectId}]
    ↓
Process each type:
    - processProjectImages(images, projectId)  [src/services/projectService.js:64-78]
        • Filters by _projectID === projectId
        • Maps: __ID → id, recordId, url, title, description

    - processProjectLinks(links, projectId)  [src/services/projectService.js:86-99]
        • Filters by _fkID === projectId
        • Maps: __ID → id, recordId, link → url, title (or hostname if empty)

    - processProjectObjectives(objectives, projectId, steps)  [src/services/projectService.js:108-125]
        • Filters objectives by _projectID === projectId
        • For each objective, calls processObjectiveSteps(steps, obj.__ID)
        • Maps: __ID → id, projectObjective → objective, status, order, f_completed → completed
        • Nests steps array in each objective

    - processObjectiveSteps(steps, objectiveId)  [src/services/projectService.js:133-148]
        • Filters steps by _objectiveID === objectiveId
        • Maps: __ID → id, projectObjectiveStep → step, order, f_completed → completed
        • Sorts by order

    - notes: raw response.data array (no processing)
    ↓
Merge into project object:
    project = {
        ...existingProject,
        images: processedImages,
        links: processedLinks,
        objectives: processedObjectives,
        notes: processedNotes
    }
    ↓
setProjects(prevProjects => prevProjects.map(p => p.id === projectId ? mergedProject : p))
    ↓
setSelectedProject(mergedProject)  [line 172]
    ↓
UI Renders: ProjectDetails component [src/components/projects/ProjectDetails.jsx]
    ↓
Displays tabbed interface:
    - Proposal Tab (default) [line 340-347]
    - Team Tab [line 389-397]
    - Objectives Tab [line 362-368]
    - Tasks Tab [line 350-359]
    - Notes Tab [line 371-376]
    - Links Tab [line 379-386]
    - Documentation Tab [line 400-407]
```

### 4. Create Project (With Supabase Sync)

```
User Action: Click "Add Project" button → Fill form → Submit
    ↓
ProjectCreationForm component [src/components/customers/ProjectCreationForm.jsx]
    - Collects: projectName, projectType (billable/fixed/subscription), value, dateStart
    - Sets default dates:
        • billable: today
        • fixed: empty
        • subscription: 1st of current month
    - Validates: name required, value > 0 for fixed/subscription
    ↓
onSubmit(projectData) [line 74]
    ↓
handleProjectCreate(projectData) [src/index.jsx via MainContent]
    ↓
useProject().handleProjectCreate(projectData)  [src/hooks/useProject.js:185-305]
    ↓
validateProjectData(projectData)  [src/services/projectService.js:217-259]
    - Validates: projectName.trim() required
    - Validates: _custID required
    - Validates: f_fixedPrice requires value > 0
    - Validates: f_subscription requires value > 0 AND dateStart
    - Validates: Cannot be both fixed price AND subscription
    - Returns: { isValid, errors }
    ↓
Generate UUID for project:
    const projectId = uuidv4();  [line 201]
    dataWithId = { ...projectData, id: projectId }
    ↓
formatProjectForFileMaker(dataWithId)  [src/services/projectService.js:292-305]
    - Converts: name → projectName
    - Converts: customerId → _custID
    - Converts: isFixedPrice → f_fixedPrice ("1" or "0")
    - Converts: isSubscription → f_subscription ("1" or "0")
    - Converts: value → string
    - Converts: dateStart/dateEnd to MM/DD/YYYY format via convertToFileMakerDate()
    - Includes: __ID (UUID) for FileMaker record
    ↓
createProject(formattedData)  [src/api/projects.js:112-124]
    ↓
handleFileMakerOperation(() => {
    fetchDataFromFileMaker({
        layout: "devProjects",
        action: "CREATE",
        fieldData: formattedData
    })
})  [src/api/fileMaker.js]
    ↓
FileMaker Data API: POST /fmi/data/v1/databases/clarityCRM/layouts/devProjects/records
    Body: { fieldData: { projectName, _custID, __ID, f_fixedPrice, ... } }
    ↓
✅ FileMaker record created
    ↓
📝 Supabase Sync (ALWAYS for web app, proposal foreign key requirement) [line 218-259]
    ↓
import { insert } from supabaseService
    ↓
Map status to Supabase values:
    - "closed", "complete", "completed" → "completed"
    - "pending" → "pending"
    - "on hold", "on_hold" → "on_hold"
    - "cancelled" → "cancelled"
    - default → "active"
    ↓
supabaseProjectData = {
    id: projectId (UUID),
    name: projectData.name,
    customer_id: projectData.customerId,
    status: supabaseStatus,
    description: projectData.description || null,
    budget: parseFloat(projectData.value) || null,
    start_date: projectData.dateStart || null,
    target_end_date: projectData.dateEnd || null,
    created_by: user?.email || user?.username || null
}
    ↓
insert('projects', supabaseProjectData)  [line 247]
    ↓
✅ Supabase projects record created
    ↓
⚠️ Business Logic (Fixed Price / Subscription) [line 261-289]
    ↓
if (f_fixedPrice OR f_subscription):
    processProjectValue(projectWithId, false)  [src/services/projectService.js:508-596]
        - Returns: { salesToCreate: [...], billableStatus: false }
        - Fixed price: Creates 2 sales entries (50% on start, 50% on end)
        - Subscription: Creates monthly sales entries from start to today
    ↓
    updateProjectRecordsBillableStatus(projectId, billableStatus)  [line 282]
        - ⚠️ MOCK IMPLEMENTATION - just logs, doesn't update records
    ↓
    if (user?.supabaseOrgID):
        createSalesFromProjectValue(projectWithId, user.supabaseOrgID)  [line 287]
            - ⚠️ REFERENCED but NOT IMPLEMENTED in salesService
    ↓
loadProjects(projectData.customerId)  [line 292]
    - Reloads project list to show new project
    ↓
UI Updates with new project displayed
```

### 5. Update Project Status

```
User Action: Toggle status switch in ProjectDetails header
    ↓
onClick handler [src/components/projects/ProjectDetails.jsx:75-106]
    ↓
Optimistic UI update:
    const newStatus = currentProject.status === "Open" ? "Closed" : "Open"
    setLocalProject({ ...currentProject, status: newStatus })  [line 94]
    ↓
onStatusChange(recordId, newStatus)  [line 98]
    ↓
handleProjectStatusChange(recordId, newStatus) [src/index.jsx via MainContent]
    ↓
useProject().handleProjectStatusChange(projectId, status)  [src/hooks/useProject.js:391-428]
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
FileMaker Data API: PATCH /fmi/data/v1/databases/clarityCRM/layouts/devProjects/records/{recordId}
    Body: { fieldData: { status: "Open" | "Closed" } }
    ↓
Update local state by recordId:
    setProjects(prevProjects => prevProjects.map(p =>
        p.recordId === projectId ? { ...p, status } : p
    ))  [line 407-412]
    ↓
Update selectedProject if it matches:
    if (selectedProject?.recordId === projectId):
        setSelectedProject({ ...selectedProject, status })  [line 415-417]
    ↓
⚠️ NO SUPABASE SYNC - status change only in FileMaker
```

### 6. Update Project (Full Update)

```
User Action: Edit project fields in form → Submit
    ↓
handleProjectUpdate(projectId, projectData) [src/hooks/useProject.js:310-386]
    ↓
Find project by ID to get recordId:
    const project = projects.find(p => p.id === projectId)  [line 316]
    ↓
validateProjectData(projectData)  [src/services/projectService.js:217-259]
    ↓
formatProjectForFileMaker(projectData)  [src/services/projectService.js:292-305]
    ↓
updateProject(project.recordId, formattedData)  [src/api/projects.js:132-145]
    ↓
handleFileMakerOperation(() => {
    fetchDataFromFileMaker({
        layout: "devProjects",
        action: "UPDATE",
        recordId: project.recordId,
        fieldData: formattedData
    })
})
    ↓
FileMaker Data API: PATCH /layouts/devProjects/records/{recordId}
    ↓
⚠️ Business Logic (if fixed price or subscription) [line 331-362]
    ↓
if (isFixedPrice OR isSubscription):
    Merge existing project with update data
    updatedProject = { ...project, ...projectData, id, __ID, f_fixedPrice, f_subscription }
    ↓
    processProjectValue(updatedProject, true)  [src/services/projectService.js:508-596]
        - Returns: { salesToCreate, billableStatus }
    ↓
    updateProjectRecordsBillableStatus(projectId, billableStatus)  [line 354]
        - ⚠️ MOCK - doesn't actually update
    ↓
    if (user?.supabaseOrgID):
        createSalesFromProjectValue(updatedProject, user.supabaseOrgID)  [line 359]
            - ⚠️ NOT IMPLEMENTED
    ↓
Update local state:
    setProjects(prevProjects => prevProjects.map(p =>
        p.id === projectId ? { ...p, ...projectData } : p
    ))  [line 365-371]
    ↓
⚠️ NO SUPABASE SYNC
```

### 7. Delete Project

```
User Action: Click delete button → Confirm in modal
    ↓
Delete confirmation modal [src/components/projects/ProjectDetails.jsx:142-177]
    ↓
onDelete(project.id)  [line 164]
    ↓
handleProjectDelete(projectId) [src/index.jsx via MainContent]
    ↓
useProject().handleProjectDelete(projectId)  [src/hooks/useProject.js:441-473]
    ↓
Find project to get recordId:
    const project = projects.find(p => p.id === projectId)  [line 447]
    ↓
deleteProject(project.recordId)  [src/api/projects.js:8-20]
    ↓
handleFileMakerOperation(() => {
    fetchDataFromFileMaker({
        layout: "devProjects",
        action: "DELETE",
        recordId: project.recordId
    })
})  [src/api/fileMaker.js]
    ↓
FileMaker Data API: DELETE /layouts/devProjects/records/{recordId}
    ↓
Update local state:
    setProjects(prevProjects => prevProjects.filter(p => p.id !== projectId))  [line 456-458]
    ↓
Clear selected project if it was deleted:
    if (selectedProject?.id === projectId):
        setSelectedProject(null)  [line 461-463]
    ↓
⚠️ ORPHANED DATA: Objectives, steps, images, links, notes remain in FileMaker
⚠️ NO SUPABASE CLEANUP
```

### 8. Create Objective

```
User Action: Click "New Objective" in Objectives tab → Enter text → Submit
    ↓
ProjectObjectivesTab component [src/components/projects/ProjectObjectivesTab.jsx:68-82]
    ↓
handleSubmit(e)
    ↓
onCreateObjective(project.id, objectiveText.trim())  [line 74]
    ↓
handleObjectiveCreate(projectId, objectiveText) [src/index.jsx via MainContent]
    ↓
useProject().handleObjectiveCreate(projectId, objectiveText)  [src/hooks/useProject.js:520-552]
    ↓
Prepare objective data:
    objectiveData = {
        _projectID: projectId,
        projectObjective: objectiveText,
        status: "Open",
        f_completed: 0
    }  [line 526-531]
    ↓
createObjective(objectiveData)  [src/api/projects.js:201-213]
    ↓
handleFileMakerOperation(() => {
    fetchDataFromFileMaker({
        layout: "devProjectObjectives",
        action: "CREATE",
        fieldData: objectiveData
    })
})  [src/api/fileMaker.js]
    ↓
FileMaker Data API: POST /layouts/devProjectObjectives/records
    Body: { fieldData: { _projectID, projectObjective, status, f_completed } }
    ↓
Delay 500ms (avoid race condition) [line 537]
    ↓
Reload project details:
    if (selectedProject && selectedProject.id === projectId):
        loadProjectDetails(projectId)  [line 540-541]
    ↓
UI updates with new objective displayed
```

### 9. Update Team Assignment

```
User Action: Select team from dropdown in Team tab
    ↓
ProjectTeamTab component [src/components/projects/ProjectTeamTab.jsx]
    ↓
onTeamChange(project.recordId, teamId)
    ↓
handleProjectTeamChange(recordId, teamId) [src/index.jsx via MainContent]
    ↓
useProject().handleProjectTeamChange(projectId, teamId)  [src/hooks/useProject.js:478-515]
    ↓
Find project by recordId:
    const project = projects.find(p => p.recordId === projectId)  [line 484]
    ↓
updateProject(projectId, { _teamID: teamId })  [src/api/projects.js:132-145]
    ↓
handleFileMakerOperation(() => {
    fetchDataFromFileMaker({
        layout: "devProjects",
        action: "UPDATE",
        recordId: projectId,
        fieldData: { _teamID: teamId }
    })
})
    ↓
FileMaker Data API: PATCH /layouts/devProjects/records/{recordId}
    Body: { fieldData: { _teamID: teamId } }
    ↓
Update local state:
    setProjects(prevProjects => prevProjects.map(p =>
        p.recordId === projectId ? { ...p, _teamID: teamId } : p
    ))  [line 494-499]
    ↓
Update selectedProject if matches:
    if (selectedProject?.recordId === projectId):
        setSelectedProject({ ...prevProject, _teamID: teamId })  [line 502-504]
```

### 10. Create Link

```
User Action: Click "Add Link" in Links tab → Enter URL → Submit
    ↓
ProjectLinksTab component [src/components/projects/ProjectLinksTab.jsx]
    ↓
handleLinkCreate hook [src/hooks/useLink.js]
    ↓
Creates link record via FileMaker API
    Layout: "devProjectLinks"
    Fields: { _fkID: projectId, link: url, title: title }
    ↓
Reload project details to show new link
```

---

## Component Architecture

### UI Layer Components

#### Main Project Components

1. **ProjectDetails.jsx** [src/components/projects/ProjectDetails.jsx] - 443 lines
   - **Purpose**: Main project view with tabbed interface
   - **Props**:
     - `projectId`: string (required)
     - `tasks`: array of task objects
     - `onTaskSelect`, `onStatusChange`, `onTaskCreate`, `onTaskUpdate`, `onTaskStatusChange`, `onDelete`, `onTeamChange`: callback functions
     - `project`: object with full project data
   - **State**:
     - `activeTab`: string (default: 'proposal')
     - `localProject`: project object (for optimistic updates)
     - `showDeleteConfirm`: boolean
   - **Key Features**:
     - Project header with name, status toggle, delete button
     - Stats display: totalHours, unbilledHours, completion %
     - 7 tabs: Proposal, Team, Objectives, Tasks, Notes, Links, Documentation
     - Optimistic UI updates for status changes (lines 93-102)
     - Delete confirmation modal (lines 142-177)
   - **Renders**: Tab-specific child components based on activeTab

2. **ProjectCreationForm.jsx** [src/components/customers/ProjectCreationForm.jsx] - 150+ lines
   - **Purpose**: Modal form for creating new projects
   - **Props**:
     - `customer`: object with customer data
     - `onSubmit`: callback function
     - `onCancel`: callback function
   - **State**:
     - `projectName`: string
     - `projectType`: enum ('billable', 'fixed', 'subscription')
     - `value`: string (dollar amount)
     - `dateStart`: string (YYYY-MM-DD)
     - `errors`: object
   - **Key Features**:
     - Radio buttons for project type selection
     - Auto-sets default dates based on project type (lines 18-32):
       - Billable: today
       - Fixed: empty
       - Subscription: 1st of current month
     - Validation (lines 34-52):
       - Name required
       - Value required for fixed/subscription
       - Start date required for subscription
   - **Submits**: Formatted project data with isFixedPrice/isSubscription flags

3. **ProjectListing.jsx** [src/components/customers/ProjectListing.jsx]
   - **Purpose**: Lists all projects for a customer with stats
   - **Features**:
     - Displays project cards in grid
     - Shows project count and unbilled hours
     - "Add Project" button
   - **Renders**: ProjectCard components for each project

4. **ProjectCard.jsx** [src/components/customers/ProjectCard.jsx]
   - **Purpose**: Individual project card in listing
   - **Displays**:
     - Project name
     - Status badge
     - Stats (hours, completion %)
     - Created date
   - **Click**: Navigates to project details

#### Tab Components

5. **ProjectTasksTab.jsx** [src/components/projects/ProjectTasksTab.jsx] - 34 lines
   - **Purpose**: Wrapper for TaskList in project context
   - **Props**: projectId, tasks, onTaskSelect, onTaskStatusChange, onTaskCreate, onTaskUpdate
   - **Renders**: TaskList component with project-filtered tasks

6. **ProjectObjectivesTab.jsx** [src/components/projects/ProjectObjectivesTab.jsx] - 100+ lines
   - **Purpose**: Display and manage project objectives
   - **Features**:
     - "New Objective" button
     - Objectives list with completion %
     - Each objective shows nested steps
     - Completion calculation based on completed steps
   - **Components**:
     - Memoized Objective component (lines 5-49)
     - Modal for creating new objectives
   - **Renders**: List of objectives with steps hierarchy

7. **ProjectLinksTab.jsx** [src/components/projects/ProjectLinksTab.jsx] - 100+ lines
   - **Purpose**: Manage project links (URLs, GitHub repos)
   - **Features**:
     - "Add Link" input
     - GitHub repository detection and metadata
     - Repository creation modal
     - Link grid display
   - **State**:
     - `showNewLinkInput`: boolean
     - `repoModalOpen`: boolean
     - `ghPrefill`: GitHub prefill data
     - `ghMeta`: GitHub metadata cache (lines 52-99)
   - **Hooks**: useLink, useProject
   - **Components**: ResourceGrid (memoized), GitHubRepositoryModal

8. **ProjectNotesTab.jsx** [src/components/projects/ProjectNotesTab.jsx]
   - **Purpose**: Display and manage project notes
   - **Features**:
     - Notes list
     - Add/edit note functionality
   - **Data**: Polymorphic notes filtered by _fkID

9. **ProjectTeamTab.jsx** [src/components/projects/ProjectTeamTab.jsx]
   - **Purpose**: Assign team to project
   - **Features**:
     - Team dropdown selector
     - Current team display
   - **Calls**: onTeamChange(project.recordId, teamId)

10. **ProjectDocumentsTab.jsx** [src/components/projects/ProjectDocumentsTab.jsx]
    - **Purpose**: Project documentation management
    - **Features**: Document upload/display (implementation TBD)

11. **ProjectProposalsTab.jsx** [src/components/proposals/ProjectProposalsTab.jsx]
    - **Purpose**: Proposals associated with project
    - **Features**:
      - Proposal list
      - Create proposal button
      - View/edit proposals
    - **Integration**: Links to proposal system

#### Supporting Components

12. **ProjectList.jsx** [src/components/projects/ProjectList.jsx]
    - **Purpose**: Standalone project list (used in teams view)
    - **Features**: Project filtering, sorting, display

13. **ProjectTabs.jsx** [src/components/customers/ProjectTabs.jsx]
    - **Purpose**: Tab navigation for customer project view
    - **Features**: Tab switching between project-related views

### Component Hierarchy

```
App [src/index.jsx]
  └─ AppStateProvider
      └─ ProjectProvider (provides projectRecords context)
          └─ AppLayout
              └─ MainContent [src/components/MainContent.jsx]
                  │
                  ├─ CustomerDetails (when customer selected)
                  │   └─ ProjectListing
                  │       ├─ ProjectCard (onClick → handleProjectSelect)
                  │       └─ ProjectCreationForm (modal)
                  │
                  └─ ProjectDetails (when project selected)
                      ├─ Project Header
                      │   ├─ Status toggle
                      │   └─ Delete button
                      │
                      ├─ Stats display (totalHours, unbilledHours, completion)
                      │
                      └─ Tabs
                          ├─ ProjectProposalsTab
                          ├─ ProjectTeamTab
                          ├─ ProjectObjectivesTab
                          │   └─ Objective (memoized, with steps)
                          ├─ ProjectTasksTab
                          │   └─ TaskList
                          ├─ ProjectNotesTab
                          ├─ ProjectLinksTab
                          │   ├─ ResourceGrid (memoized)
                          │   └─ GitHubRepositoryModal
                          └─ ProjectDocumentsTab
```

---

## Hooks Layer

### useProject Hook

**File**: [src/hooks/useProject.js] - 582 lines

**Purpose**: Central hook for all project state management and operations

**Parameters**:
- `customerId`: string | null - Filter projects by customer (optional)

**State**:
```javascript
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
const [projects, setProjects] = useState([]);
const [selectedProject, setSelectedProject] = useState(null);
```

**Context Dependencies**:
- `useProjectRecords()` - From ProjectContext, provides time records
- `useSnackBar()` - For error notifications
- `useAppState()` - For user context

**Effect**: Loads projects when customerId changes (lines 42-49)

**Operations**:

1. **loadProjects(custId)** [lines 57-91]
   - Fetches projects for customer via fetchProjectsForCustomer(custId)
   - For Supabase-only customers (prospects), filters client-side by customerId
   - Processes data via processProjectData()
   - Updates projects state

2. **loadProjectDetails(projectId)** [lines 96-137]
   - Parallel fetch of 5 related data types:
     - Images (devProjectImages)
     - Links (devProjectLinks)
     - Objectives (devProjectObjectives)
     - Steps (devProjectObjSteps)
     - Notes (devNotes)
   - Processes each type via projectService functions
   - Merges into project object
   - Updates projects state with enriched data

3. **handleProjectSelect(projectOrId)** [lines 142-180]
   - Accepts project object or ID string
   - Finds project in state
   - Loads details if not already loaded
   - Sets selectedProject state

4. **handleProjectCreate(projectData)** [lines 185-305]
   - Validates via validateProjectData()
   - Generates UUID for project
   - Formats for FileMaker via formatProjectForFileMaker()
   - Creates in FileMaker via createProject()
   - **Supabase Sync** (lines 218-259):
     - Maps status to Supabase values
     - Inserts to projects table with UUID
     - Shows error if sync fails (proposals won't work)
   - **Business Logic** (lines 261-289):
     - If fixed price or subscription:
       - Calls processProjectValue()
       - Updates billable status (mock)
       - Creates sales entries (NOT implemented)
   - Reloads projects list
   - Returns result or error

5. **handleProjectUpdate(projectId, projectData)** [lines 310-386]
   - Finds project by ID to get recordId
   - Validates data
   - Formats for FileMaker
   - Updates via updateProject(recordId, data)
   - **Business Logic** (if fixed/subscription):
     - Merges existing + new data
     - Calls processProjectValue()
     - Updates billable status (mock)
     - Creates sales entries (NOT implemented)
   - Updates local state
   - Updates selectedProject if matching

6. **handleProjectStatusChange(projectId, status)** [lines 391-428]
   - projectId is actually recordId from UI
   - Updates via updateProjectStatus(recordId, status)
   - Updates local state by recordId
   - Updates selectedProject if matching
   - **No Supabase sync**

7. **handleProjectDelete(projectId)** [lines 441-473]
   - Finds project to get recordId
   - Deletes via deleteProject(recordId)
   - Removes from projects array
   - Clears selectedProject if matching
   - **No Supabase cleanup**
   - **Orphans related data**

8. **handleProjectTeamChange(projectId, teamId)** [lines 478-515]
   - projectId is recordId from UI
   - Updates via updateProject(recordId, { _teamID: teamId })
   - Updates local state
   - Updates selectedProject if matching

9. **handleObjectiveCreate(projectId, objectiveText)** [lines 520-552]
   - Prepares objective data with _projectID, status: "Open", f_completed: 0
   - Creates via createObjective()
   - Waits 500ms to avoid race condition
   - Reloads project details if it's the selected project

**Utilities**:
- `getProjectCompletion(projectId)` [lines 433-436] - Calculate completion % via calculateProjectCompletion()
- `clearError()` - Reset error state
- `clearSelectedProject()` - Reset selected project
- `isLoading` - Loading state alias

**Computed Values**:
- `activeProjects` - Filters projects where status === 'Open'

**Return Object**:
```javascript
{
  // State
  loading, error, projects, selectedProject, projectRecords,

  // Computed
  activeProjects,

  // Operations
  loadProjects, loadProjectDetails, handleProjectSelect,
  handleProjectCreate, handleProjectUpdate, handleProjectStatusChange,
  handleProjectDelete, handleProjectTeamChange, handleObjectiveCreate,

  // Utilities
  getProjectCompletion, clearError, clearSelectedProject, isLoading
}
```

### Related Hooks

**useLink** [src/hooks/useLink.js]
- Manages project links CRUD operations
- Used by ProjectLinksTab
- Operations: handleLinkCreate, handleLinkUpdate, handleLinkDelete

**useTask** [src/hooks/useTask.js]
- Manages project tasks
- Used by ProjectTasksTab
- Operations: handleTaskCreate, handleTaskUpdate, handleTaskStatusChange

**useTeamContext** [src/context/TeamContext.jsx]
- Provides team data for project assignment
- Used by ProjectTeamTab
- Operations: loadTeams, handleTeamSelect

---

## Services Layer

### projectService.js

**File**: [src/services/projectService.js] - 643 lines

**Purpose**: Business logic and data transformation for projects

**Data Processing Functions**:

1. **processProjectData(projectData, relatedData)** [lines 25-56]
   - **Input**: FileMaker response object, optional related data
   - **Output**: Array of processed project objects
   - **Transformations**:
     - Maps fieldData fields to flat structure
     - Converts __ID → id, recordId → recordId
     - Converts f_fixedPrice/f_subscription ("1"/"0") → boolean
     - Converts value string → float
     - Sets default status: 'Open'
     - Processes related data: images, links, objectives, records, stats
     - Adds isActive flag (status === 'Open')
     - Extracts timestamps: createdAt, modifiedAt
     - Normalizes dates: dateStart, dateEnd

2. **processProjectImages(images, projectId)** [lines 64-78]
   - Filters by _projectID === projectId
   - Maps: __ID → id, recordId, url, title, description
   - Returns array of image objects

3. **processProjectLinks(links, projectId)** [lines 86-99]
   - Filters by _fkID === projectId
   - Maps: __ID → id, recordId, link → url, title (or URL hostname if empty)
   - Returns array of link objects

4. **processProjectObjectives(objectives, projectId, steps)** [lines 108-125]
   - Filters objectives by _projectID === projectId
   - For each objective, calls processObjectiveSteps(steps, objectiveId)
   - Maps: __ID → id, projectObjective → objective, status, order, f_completed → completed
   - Sorts by order
   - Returns array of objective objects with nested steps

5. **processObjectiveSteps(steps, objectiveId)** [lines 133-148]
   - Filters steps by _objectiveID === objectiveId
   - Maps: __ID → id, projectObjectiveStep → step, order, f_completed → completed
   - Sorts by order
   - Returns array of step objects

6. **processProjectRecords(records, projectId)** [lines 156-193]
   - Filters records by _projectID === projectId
   - Calculates duration between startTime and endTime
   - Maps: __ID → id, recordId, startTime, endTime, description, duration, f_billed → isBilled
   - Calculates stats:
     - totalHours: sum of all durations in hours
     - unbilledHours: sum of unbilled durations in hours
   - Returns: { records: [...], stats: { totalHours, unbilledHours } }

**Validation**:

7. **validateProjectData(data)** [lines 217-259]
   - **Rules**:
     - projectName.trim() is required
     - _custID is required
     - estOfTime format: /^(\d+h\s*)?(\d+m\s*)?$/ (e.g., "2h 30m")
     - If f_fixedPrice: value required and > 0
     - If f_subscription: value required, > 0, AND dateStart required
     - Cannot be both f_fixedPrice AND f_subscription
   - **Returns**: { isValid: boolean, errors: string[] }

**Formatting**:

8. **formatProjectForFileMaker(data)** [lines 292-305]
   - **Input**: UI form data
   - **Output**: FileMaker-formatted fieldData
   - **Transformations**:
     - name → projectName
     - customerId → _custID
     - timeEstimate → estOfTime
     - isFixedPrice → f_fixedPrice ("1" or "0")
     - isSubscription → f_subscription ("1" or "0")
     - value → string
     - dateStart/dateEnd → MM/DD/YYYY via convertToFileMakerDate()
     - Includes __ID (UUID)

9. **formatProjectForDisplay(project)** [lines 266-285]
   - Formats project for UI display
   - Converts dates to locale strings
   - Calculates objectives counts
   - Returns human-readable object

10. **convertToFileMakerDate(dateString)** [lines 10-17]
    - Converts YYYY-MM-DD → MM/DD/YYYY
    - Handles empty strings

**Statistics**:

11. **calculateProjectCompletion(project)** [lines 312-335]
    - Counts total steps across all objectives
    - Counts completed steps
    - Returns percentage: (completed / total) * 100

12. **groupProjectsByStatus(projects)** [lines 350-356]
    - Groups projects into { open: [], closed: [] }

13. **calculateProjectStats(projects)** [lines 363-374]
    - Returns: { total, open, closed, averageCompletion }

14. **calculateCustomerStats(projects, records)** [lines 382-409]
    - Calculates project stats
    - Calculates total unbilled hours across customer projects
    - Returns: { total, open, closed, unbilledHours }

15. **calculateProjectDetailStats(project, records)** [lines 459-481]
    - Filters records by project ID
    - Calculates totalHours, unbilledHours, completion
    - Returns stats object

16. **calculateRecordsUnbilledHours(records, currentMonthOnly, customerId)** [lines 426-456]
    - Filters records by customer ID and/or month
    - Sums unbilled hours
    - Returns formatted string: "X.X hrs"

**Business Logic (NOT FULLY IMPLEMENTED)**:

17. **processProjectValue(project, isUpdate)** [lines 508-596]
    - **Purpose**: Generate sales entries for fixed-price and subscription projects
    - **Input**: project object, isUpdate flag
    - **Output**: { salesToCreate: [...], billableStatus: boolean | null }
    - **Fixed Price Logic**:
      - Sets billableStatus = false (all hours non-billable)
      - If dateStart <= today: Create sales entry for 50% of value (type: 'sellable')
      - If dateEnd <= today: Create sales entry for 50% of value (type: 'sales')
    - **Subscription Logic**:
      - Calculates months from dateStart to today (or dateEnd)
      - For each month: Create sales entry for full value (type: 'sales')
      - Continues until dateEnd or indefinitely
    - **Helper**: calculateMonthsBetweenDates(startDate, endDate) [lines 604-623]
    - **Status**: Code exists but NOT CALLED by hooks

18. **updateProjectRecordsBillableStatus(projectId, isBillable)** [lines 631-643]
    - **Purpose**: Update billable flag on all time records for project
    - **Status**: MOCK IMPLEMENTATION - only logs, doesn't update
    - **Note**: Actual implementation depends on time records architecture

**Utility**:

19. **getProcessedProject(project, relatedData)** [lines 489-500]
    - Wraps project in FileMaker response format
    - Calls processProjectData()
    - Returns fully processed project object

---

## API Layer

### projects.js

**File**: [src/api/projects.js] - 213 lines

**Purpose**: FileMaker API abstraction for project operations

**Functions**:

1. **deleteProject(recordId)** [lines 8-20]
   - **Layout**: devProjects
   - **Action**: DELETE
   - **Params**: { recordId }
   - **FileMaker Call**: DELETE /layouts/devProjects/records/{recordId}

2. **fetchProjectsForCustomer(customerId)** [lines 27-39]
   - **Layout**: devProjects
   - **Action**: READ
   - **Query**: [{ "_custID": customerId }]
   - **FileMaker Call**: GET /layouts/devProjects/records?query=...

3. **fetchProjectNotes(projectId)** [lines 47-59]
   - **Layout**: devNotes
   - **Action**: READ
   - **Query**: [{ "_fkID": projectId }]
   - **FileMaker Call**: GET /layouts/devNotes/records?query=...

4. **fetchProjectRelatedData(projectId, layout)** [lines 61-84]
   - **Generic function for related data**
   - **Layouts**: devProjectImages, devProjectLinks, devProjectObjectives, devProjectObjSteps, devNotes, devRecords
   - **Field Name Logic**:
     - Images/Links/Notes: _fkID
     - Records: _projectID
     - Objectives/Steps: _projectID
   - **Accepts**: Single projectId or array of IDs
   - **FileMaker Call**: GET /layouts/{layout}/records?query=...

5. **updateProjectStatus(projectId, status)** [lines 92-105]
   - **Layout**: devProjects
   - **Action**: UPDATE
   - **Params**: { recordId: projectId, fieldData: { status } }
   - **FileMaker Call**: PATCH /layouts/devProjects/records/{recordId}

6. **createProject(data)** [lines 112-124]
   - **Layout**: devProjects
   - **Action**: CREATE
   - **Params**: { fieldData: data }
   - **FileMaker Call**: POST /layouts/devProjects/records
   - **Body**: { fieldData: { projectName, _custID, __ID, f_fixedPrice, ... } }

7. **updateProject(projectId, data)** [lines 132-145]
   - **Layout**: devProjects
   - **Action**: UPDATE
   - **Params**: { recordId: projectId, fieldData: data }
   - **FileMaker Call**: PATCH /layouts/devProjects/records/{recordId}

8. **fetchAllProjectData(projectId)** [lines 152-172]
   - **Parallel fetch of all related data**
   - **Calls**:
     - fetchProjectRelatedData([projectId], 'devProjectImages')
     - fetchProjectRelatedData([projectId], 'devProjectLinks')
     - fetchProjectRelatedData([projectId], 'devProjectObjectives')
     - fetchProjectRelatedData([projectId], 'devProjectObjSteps')
     - fetchProjectRelatedData([projectId], 'devRecords')
   - **Returns**: { images: [], links: [], objectives: [], steps: [], records: [] }

9. **fetchProjectsForCustomers(customerIds)** [lines 179-194]
   - **Layout**: devProjects
   - **Action**: READ
   - **Query**:
     - If customerIds.length > 0: [{ "_custID": id1 }, { "_custID": id2 }, ...]
     - If empty: [{ "__ID": "*" }] (all projects)
   - **FileMaker Call**: GET /layouts/devProjects/records?query=...

10. **createObjective(data)** [lines 201-213]
    - **Layout**: devProjectObjectives
    - **Action**: CREATE
    - **Params**: { fieldData: data }
    - **FileMaker Call**: POST /layouts/devProjectObjectives/records
    - **Body**: { fieldData: { _projectID, projectObjective, status, f_completed } }

**Common Patterns**:
- All functions use `validateParams()` for input validation
- All operations wrapped in `handleFileMakerOperation()` for error handling
- All FileMaker calls go through `fetchDataFromFileMaker()`

### fileMaker.js

**File**: [src/api/fileMaker.js] - ~500 lines (estimated)

**Purpose**: Low-level FileMaker Data API integration

**Key Constants**:
```javascript
const Layouts = {
    PROJECTS: 'devProjects',
    PROJECT_IMAGES: 'devProjectImages',
    PROJECT_LINKS: 'devProjectLinks',
    PROJECT_OBJECTIVES: 'devProjectObjectives',
    PROJECT_OBJ_STEPS: 'devProjectObjSteps',
    NOTES: 'devNotes',
    RECORDS: 'devRecords',
    // ... other layouts
};

const Actions = {
    CREATE: 'CREATE',
    READ: 'READ',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE'
};
```

**Functions** (partial list):
- `fetchDataFromFileMaker(params)` - Core FileMaker API call
- `handleFileMakerOperation(operation)` - Error handling wrapper
- `validateParams(params, required)` - Parameter validation
- `isFileMakerEnvironment()` - Environment detection
- `generateBackendAuthHeader(payload)` - HMAC-SHA256 auth for backend API

**Environment Detection** [lines 30-36]:
- Checks for FMGofer or window.FileMaker
- Returns boolean for FileMaker vs web app environment

**Backend API Fallback** [lines 93-100+]:
- If not in FileMaker environment, routes calls to backend API
- Converts FileMaker-style params to backend API calls
- Uses HMAC authentication

---

## State Management

### Global State (AppStateContext)

**File**: [src/context/AppStateContext.jsx]

**Provides**:
- `user` - Current user object
- `selectedCustomer` - Active customer
- `selectedProject` - Active project
- `selectedTask` - Active task
- `selectedTeam` - Active team
- `environment` - { type: 'FILEMAKER' | 'WEBAPP' }
- `authentication` - { isAuthenticated, method, user }
- `loading`, `error` - Global loading/error states

**Operations**:
- `setSelectedProject(project)` - Set active project
- `setUser(user)` - Set user context
- All other setters for state management

### Project-Specific Context (ProjectContext)

**File**: [src/context/ProjectContext.jsx] - 95 lines

**Purpose**: Provides time records for all projects (used for stats)

**State**:
- `projectRecords` - Array of time records from last 12 months
- `projectContext` - (TODO: commented out, layout not defined)

**Data Loading** [lines 14-39]:
- Fetches records on mount from devRecords layout
- Query: DateStart > {12 months ago}
- Uses recordQueueManager for FileMaker call
- Sets projectRecords state

**Hook**:
- `useProjectRecords()` - Returns projectRecords array

**Usage**: Used by useProject hook to calculate project stats (totalHours, unbilledHours)

### Local State Patterns

**ProjectDetails Component**:
- Uses `localProject` state for optimistic UI updates
- Updates immediately on user action (status toggle)
- Reverts if API call fails
- Pattern: [lines 93-102 in ProjectDetails.jsx]

**useProject Hook**:
- Manages `projects` array as primary data source
- `selectedProject` for active project with full details
- Updates both when operations complete
- Pattern: Immutable state updates with .map() and .filter()

### State Flow

```
User Action (UI)
    ↓
Component Handler (ProjectDetails)
    ↓
Optimistic Local State Update (if applicable)
    ↓
Call Hook Operation (useProject)
    ↓
API Call (projects.js → fileMaker.js)
    ↓
FileMaker Database
    ↓
Response Processing (projectService.js)
    ↓
Hook State Update (setProjects, setSelectedProject)
    ↓
Context State Update (AppStateContext - optional)
    ↓
Component Re-render with New Data
```

**Error Handling**:
- Hook catches errors, sets error state
- Shows SnackBar notification
- Reverts optimistic updates (in components)

**Loading States**:
- Hook manages loading flag
- Components show loading spinner
- Global loading via loadingStateManager (for app init)

---

## Business Logic

### Fixed-Price Projects

**Documented Behavior** (processProjectValue function):

1. **On Project Creation/Update**:
   - If `f_fixedPrice = "1"` (true):
     - Set billableStatus = false (all hours non-billable)
     - Check dateStart:
       - If dateStart exists AND dateStart <= today:
         - Create sales entry:
           - Amount: value / 2
           - Type: 'sellable'
           - Date: dateStart
           - Description: "Fixed price project ({name}) - 50% on start"
     - Check dateEnd:
       - If dateEnd exists AND dateEnd <= today:
         - Create sales entry:
           - Amount: value / 2
           - Type: 'sales'
           - Date: dateEnd
           - Description: "Fixed price project ({name}) - 50% on completion"

2. **Time Records**:
   - All time records for project should be marked as non-billable
   - Function: updateProjectRecordsBillableStatus(projectId, false)

**Current Implementation Status**:
- ✅ Code exists in projectService.js [lines 508-596]
- ✅ Called by handleProjectCreate [lines 261-289]
- ✅ Called by handleProjectUpdate [lines 331-362]
- ⚠️ updateProjectRecordsBillableStatus is MOCK (only logs) [lines 631-643]
- ❌ createSalesFromProjectValue NOT IMPLEMENTED in salesService
- ❌ Sales entries NOT created in Supabase
- ❌ No verification/testing of logic

**Code Reference**:
```javascript
// src/services/projectService.js:521-560
if (project.f_fixedPrice) {
    result.billableStatus = false;

    if (project.dateStart) {
        const startDate = new Date(project.dateStart);
        const today = new Date();

        if (startDate <= today) {
            result.salesToCreate.push({
                customer_id: project._custID,
                amount: project.value / 2,
                date: project.dateStart,
                description: `Fixed price project (${project.projectName}) - 50% on start`,
                project_id: project.id || project.__ID,
                type: 'sellable'
            });
        }
    }

    if (project.dateEnd) {
        const endDate = new Date(project.dateEnd);
        const today = new Date();

        if (endDate <= today) {
            result.salesToCreate.push({
                customer_id: project._custID,
                amount: project.value / 2,
                date: project.dateEnd,
                description: `Fixed price project (${project.projectName}) - 50% on completion`,
                project_id: project.id || project.__ID,
                type: 'sales'
            });
        }
    }
}
```

### Subscription Projects

**Documented Behavior** (processProjectValue function):

1. **On Project Creation/Update**:
   - If `f_subscription = "1"` (true):
     - Requires: dateStart (validation enforced)
     - Optional: dateEnd (if set, subscription ends on this date)
     - Calculate monthsPassed:
       - From dateStart to today (or dateEnd if set and < today)
       - Function: calculateMonthsBetweenDates(startDate, endDate)
     - For each month from start to today:
       - Create sales entry:
         - Amount: value (full value each month)
         - Type: 'sales'
         - Date: Start of month (dateStart + i months)
         - Description: "Subscription project ({name}) - Month {i+1}"
     - Continue until:
       - dateEnd is reached, OR
       - No dateEnd (perpetual subscription)

2. **Monthly Billing**:
   - ⚠️ NO background job or cron to create future entries
   - ⚠️ Logic only runs on project create/update
   - ⚠️ No automated monthly billing for ongoing subscriptions

**Current Implementation Status**:
- ✅ Code exists in projectService.js [lines 563-593]
- ✅ Called by handleProjectCreate/Update
- ❌ createSalesFromProjectValue NOT IMPLEMENTED
- ❌ No background job for ongoing subscriptions
- ❌ Sales entries NOT created automatically
- ❌ No UI to manually trigger subscription billing

**Code Reference**:
```javascript
// src/services/projectService.js:563-593
if (project.f_subscription && project.dateStart) {
    const startDate = new Date(project.dateStart);
    const today = new Date();
    const endDate = project.dateEnd ? new Date(project.dateEnd) : null;

    if (startDate <= today && (!endDate || endDate >= today)) {
        const monthsPassed = calculateMonthsBetweenDates(startDate, today);

        for (let i = 0; i < monthsPassed; i++) {
            const monthDate = new Date(startDate);
            monthDate.setMonth(startDate.getMonth() + i);

            if (endDate && monthDate > endDate) {
                break;
            }

            result.salesToCreate.push({
                customer_id: project._custID,
                amount: project.value,
                date: monthDate.toISOString().split('T')[0],
                description: `Subscription project (${project.projectName}) - Month ${i + 1}`,
                project_id: project.id || project.__ID,
                type: 'sales'
            });
        }
    }
}

// Helper function
function calculateMonthsBetweenDates(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const yearDiff = end.getFullYear() - start.getFullYear();
    const monthDiff = end.getMonth() - start.getMonth();
    let months = yearDiff * 12 + monthDiff;

    if (end.getDate() < start.getDate()) {
        months--;
    }

    return Math.max(0, months);
}
```

### Missing Implementation: createSalesFromProjectValue

**Expected Signature**:
```javascript
async function createSalesFromProjectValue(project, organizationId) {
    // project.salesToCreate = array from processProjectValue()
    // organizationId = user.supabaseOrgID

    // For each sales entry in project.salesToCreate:
    //   INSERT INTO customer_sales (
    //     customer_id, amount, date, description,
    //     project_id, type, organization_id
    //   )
}
```

**Current Status**:
- ❌ Function does NOT exist in salesService.js
- ❌ Called by useProject but import would fail
- ❌ No Supabase sales table integration

**Required Implementation**:
1. Import supabaseService.insert()
2. Loop through salesToCreate array
3. Insert each entry to customer_sales table
4. Handle errors (duplicate prevention for months)
5. Return success/failure result

---

## FileMaker Layouts and Schemas

### devProjects (Main Projects Table)

**Layout Name**: devProjects
**Purpose**: Core project records

**Fields**:
| FileMaker Field | Frontend Mapping | Type | Notes |
|----------------|------------------|------|-------|
| `__ID` | `id` | UUID | Primary key, generated by frontend |
| `recordId` | `recordId` | Number | FileMaker internal record ID |
| `projectName` | `projectName` | String | Project name (required) |
| `_custID` | `customerId` / `_custID` | UUID | Foreign key to customers |
| `_teamID` | `teamId` / `_teamID` | UUID | Foreign key to teams |
| `status` | `status` | String | "Open", "Closed", "Active", "On Hold", "Completed", "Cancelled" |
| `f_fixedPrice` | `f_fixedPrice` | "1"/"0" | Boolean flag for fixed-price projects → converted to boolean |
| `f_subscription` | `f_subscription` | "1"/"0" | Boolean flag for subscription projects → converted to boolean |
| `value` | `value` | String | Dollar amount → converted to float |
| `dateStart` | `dateStart` | MM/DD/YYYY | Start date → converted to YYYY-MM-DD |
| `dateEnd` | `dateEnd` | MM/DD/YYYY | End date → converted to YYYY-MM-DD |
| `estOfTime` | `estOfTime` | String | Time estimate (e.g., "2h 30m") |
| `~creationTimestamp` | `createdAt` | Timestamp | Auto-generated by FileMaker |
| `~modificationTimestamp` | `modifiedAt` | Timestamp | Auto-generated by FileMaker |

**Query Patterns**:
- By customer: `[{ "_custID": customerId }]`
- All projects: `[{ "__ID": "*" }]`

**Operations**:
- CREATE: POST /layouts/devProjects/records
- READ: GET /layouts/devProjects/records?query=...
- UPDATE: PATCH /layouts/devProjects/records/{recordId}
- DELETE: DELETE /layouts/devProjects/records/{recordId}

### devProjectObjectives (Project Objectives)

**Layout Name**: devProjectObjectives
**Purpose**: High-level goals for projects

**Fields**:
| FileMaker Field | Frontend Mapping | Type | Notes |
|----------------|------------------|------|-------|
| `__ID` | `id` | UUID | Primary key |
| `recordId` | `recordId` | Number | FileMaker internal ID |
| `_projectID` | `projectId` / `_projectID` | UUID | Foreign key to projects |
| `projectObjective` | `objective` | Text | Objective description |
| `status` | `status` | String | "Open", "Closed", etc. |
| `order` | `order` | Number | Display order |
| `f_completed` | `completed` | "1"/"0" | Boolean → converted to boolean |

**Relationships**:
- Many objectives to one project (via _projectID)
- One objective to many steps (via __ID → devProjectObjSteps._objectiveID)

**Query Patterns**:
- By project: `[{ "_projectID": projectId }]`

**Processing**:
- Sorted by `order` field
- Nested with steps from devProjectObjSteps

### devProjectObjSteps (Objective Steps)

**Layout Name**: devProjectObjSteps
**Purpose**: Granular tasks within objectives

**Fields**:
| FileMaker Field | Frontend Mapping | Type | Notes |
|----------------|------------------|------|-------|
| `__ID` | `id` | UUID | Primary key |
| `recordId` | `recordId` | Number | FileMaker internal ID |
| `_objectiveID` | `objectiveId` / `_objectiveID` | UUID | Foreign key to objectives |
| `projectObjectiveStep` | `step` | Text | Step description |
| `order` | `order` | Number | Display order within objective |
| `f_completed` | `completed` | "1"/"0" | Boolean → converted to boolean |

**Relationships**:
- Many steps to one objective (via _objectiveID)

**Query Patterns**:
- All steps fetched, filtered client-side by _objectiveID

**Processing**:
- Sorted by `order` field
- Nested within objective objects

**Completion Calculation**:
- Project completion % = (completed steps / total steps) * 100

### devProjectImages (Project Images)

**Layout Name**: devProjectImages
**Purpose**: Image attachments for projects

**Fields**:
| FileMaker Field | Frontend Mapping | Type | Notes |
|----------------|------------------|------|-------|
| `__ID` | `id` | UUID | Primary key |
| `recordId` | `recordId` | Number | FileMaker internal ID |
| `_fkID` | (filter field) | UUID | Polymorphic foreign key (project ID) |
| `url` | `url` | String | Image URL |
| `title` | `title` | String | Image title |
| `description` | `description` | Text | Image description |

**Relationships**:
- Polymorphic: _fkID can reference projects, customers, or other entities
- No entity_type field (determined by context)

**Query Patterns**:
- By project: `[{ "_fkID": projectId }]`
- Client-side filter: `_projectID === projectId` (appears to be a bug - should be _fkID)

### devProjectLinks (Project Links)

**Layout Name**: devProjectLinks
**Purpose**: URL bookmarks for projects

**Fields**:
| FileMaker Field | Frontend Mapping | Type | Notes |
|----------------|------------------|------|-------|
| `__ID` | `id` | UUID | Primary key |
| `recordId` | `recordId` | Number | FileMaker internal ID |
| `_fkID` | (filter field) | UUID | Polymorphic foreign key (project ID) |
| `link` | `url` | String | URL |
| `title` | `title` | String | Link title (derived from URL hostname if empty) |

**Relationships**:
- Polymorphic: _fkID can reference projects, customers, etc.

**Query Patterns**:
- By project: `[{ "_fkID": projectId }]`

**Processing**:
- If title is empty, extracts hostname from URL

### devNotes (Polymorphic Notes)

**Layout Name**: devNotes
**Purpose**: Text notes attached to various entities

**Fields** (estimated):
| FileMaker Field | Frontend Mapping | Type | Notes |
|----------------|------------------|------|-------|
| `__ID` | `id` | UUID | Primary key |
| `recordId` | `recordId` | Number | FileMaker internal ID |
| `_fkID` | (filter field) | UUID | Polymorphic foreign key (project, customer, task ID) |
| (other fields TBD) | (TBD) | | Not fully documented in services |

**Relationships**:
- Polymorphic: Can attach to projects, customers, tasks
- No entity_type field - relies on context

**Query Patterns**:
- By project: `[{ "_fkID": projectId }]`

**Processing**:
- Raw response.data array (no transformation)

### devRecords (Time Records)

**Layout Name**: devRecords (also referenced as dapiRecords)
**Purpose**: Time tracking entries

**Fields**:
| FileMaker Field | Frontend Mapping | Type | Notes |
|----------------|------------------|------|-------|
| `__ID` | `id` | UUID | Primary key |
| `recordId` | `recordId` | Number | FileMaker internal ID |
| `_projectID` | `projectId` / `_projectID` | UUID | Foreign key to projects |
| `_custID` | `customerId` / `_custID` | UUID | Foreign key to customers |
| `startTime` | `startTime` | Timestamp | Start of time entry |
| `endTime` | `endTime` | Timestamp | End of time entry |
| `description` | `description` | Text | Work description |
| `f_billed` | `isBilled` | "1"/"0" | Billing status → boolean |
| `Billable_Time_Rounded` | (used for stats) | Number | Calculated hours (float) |
| `DateStart` | (used for queries) | Date | Date of entry (for filtering) |

**Relationships**:
- Many records to one project (via _projectID)
- Many records to one customer (via _custID)

**Query Patterns**:
- By project: `[{ "_projectID": projectId }]`
- By date range: `[{ "DateStart": ">{year}+{month}+*" }]` (last 12 months in ProjectContext)

**Stats Calculation**:
- totalHours: Sum of all Billable_Time_Rounded
- unbilledHours: Sum where f_billed === "0"

---

## Data Flow Diagrams

### 1. Project Creation Flow (Full Workflow)

```
┌─────────────────────────────────────────────────────────────────┐
│ User clicks "Add Project" button                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ ProjectCreationForm Modal Opens                                 │
│ - User enters: name, type, value, dateStart                     │
│ - Validation: name required, value > 0 for fixed/subscription   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ onSubmit(projectData)                                           │
│ - Packages: { name, customerId, isFixedPrice, isSubscription,   │
│   value, dateStart }                                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ useProject().handleProjectCreate(projectData)                   │
│ [src/hooks/useProject.js:185-305]                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ validateProjectData(projectData)                                │
│ [src/services/projectService.js:217-259]                        │
│ - Check: name, customerId, value constraints                    │
│ - Return: { isValid, errors }                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │ isValid = true
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Generate UUID: projectId = uuidv4()                             │
│ Add to data: dataWithId = { ...projectData, id: projectId }     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ formatProjectForFileMaker(dataWithId)                           │
│ [src/services/projectService.js:292-305]                        │
│ - Convert: name → projectName, isFixedPrice → f_fixedPrice      │
│ - Convert: dates to MM/DD/YYYY                                  │
│ - Output: { projectName, _custID, __ID, f_fixedPrice, ... }     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ createProject(formattedData)                                    │
│ [src/api/projects.js:112-124]                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ handleFileMakerOperation(() => fetchDataFromFileMaker({         │
│   layout: "devProjects",                                        │
│   action: "CREATE",                                             │
│   fieldData: formattedData                                      │
│ }))                                                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ FileMaker Data API                                              │
│ POST /fmi/data/v1/databases/clarityCRM/layouts/devProjects/     │
│      records                                                    │
│ Body: { fieldData: { projectName, _custID, __ID, ... } }        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼ ✅ Project created in FileMaker
┌─────────────────────────────────────────────────────────────────┐
│ Supabase Sync (ALWAYS for web app)                              │
│ [useProject.js:218-259]                                         │
│                                                                 │
│ 1. Map status: "closed" → "completed", etc.                     │
│ 2. Create supabaseProjectData: {                                │
│      id: projectId (UUID),                                      │
│      name, customer_id, status, description, budget,            │
│      start_date, target_end_date, created_by                    │
│    }                                                            │
│ 3. import { insert } from supabaseService                       │
│ 4. insert('projects', supabaseProjectData)                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼ ✅ Project synced to Supabase
┌─────────────────────────────────────────────────────────────────┐
│ Business Logic (Fixed Price / Subscription)                     │
│ [useProject.js:261-289]                                         │
│                                                                 │
│ if (f_fixedPrice OR f_subscription):                            │
│   1. processProjectValue(projectWithId, false)                  │
│      [projectService.js:508-596]                                │
│      - Returns: { salesToCreate: [...], billableStatus }        │
│                                                                 │
│   2. updateProjectRecordsBillableStatus(projectId, billableStatus)│
│      ⚠️ MOCK - only logs, doesn't update                         │
│                                                                 │
│   3. if (user?.supabaseOrgID):                                  │
│        createSalesFromProjectValue(projectWithId, orgID)        │
│        ⚠️ NOT IMPLEMENTED - would create sales entries           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ loadProjects(projectData.customerId)                            │
│ - Refetches all projects for customer                           │
│ - Includes newly created project                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ setProjects(processedProjects)                                  │
│ - Updates hook state                                            │
│ - Triggers component re-render                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ UI Updates                                                      │
│ - Modal closes                                                  │
│ - ProjectListing shows new project card                         │
│ - User sees new project in list                                 │
└─────────────────────────────────────────────────────────────────┘

✅ = Implemented and working
⚠️ = Partially implemented or mock
❌ = Not implemented
```

### 2. Project Detail Load Flow (Parallel Data Fetch)

```
┌─────────────────────────────────────────────────────────────────┐
│ User clicks Project Card                                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ onProjectSelect(project) → handleProjectSelect(project)         │
│ [src/index.jsx via MainContent]                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ useProject().handleProjectSelect(projectOrId)                   │
│ [src/hooks/useProject.js:142-180]                               │
│                                                                 │
│ - Find project in state (if ID provided)                        │
│ - Check if details already loaded (project.images exists)       │
└────────────────────────┬────────────────────────────────────────┘
                         │ Details not loaded
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ loadProjectDetails(projectId)                                   │
│ [src/hooks/useProject.js:96-137]                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Promise.all([...5 parallel API calls...])                       │
└─────┬──────┬──────┬──────┬──────┬────────────────────────────────┘
      │      │      │      │      │
      │      │      │      │      └──────────────────────┐
      │      │      │      └─────────────────────┐       │
      │      │      └────────────────────┐       │       │
      │      └───────────────────┐       │       │       │
      └──────────────────┐       │       │       │       │
                         ▼       ▼       ▼       ▼       ▼
┌──────────────┐  ┌──────────┐  ┌──────────┐  ┌──────┐  ┌──────┐
│ devProject   │  │ devProject│  │ devProject│  │ devPro│  │ devNo│
│ Images       │  │ Links     │  │ Objectives│  │ jectOb│  │ tes  │
│              │  │           │  │           │  │ jSteps│  │      │
│ GET /layouts/│  │ GET /     │  │ GET /     │  │ GET / │  │ GET /│
│ devProjectIm │  │ layouts/  │  │ layouts/  │  │ layout│  │ layou│
│ ages/records │  │ devProject│  │ devProject│  │ s/devP│  │ ts/de│
│ ?query=[{    │  │ Links/    │  │ Objectives│  │ roject│  │ vNote│
│ "_fkID":     │  │ records?  │  │ /records? │  │ ObjSte│  │ s/rec│
│ projectId}]  │  │ query=... │  │ query=... │  │ ps/rec│  │ ords?│
│              │  │           │  │           │  │ ords  │  │ query│
└──────┬───────┘  └─────┬────┘  └─────┬─────┘  └───┬───┘  └──┬───┘
       │                │              │            │         │
       │ Response       │ Response     │ Response   │ Resp    │ Resp
       ▼                ▼              ▼            ▼         ▼
┌──────────────┐  ┌──────────┐  ┌──────────┐  ┌──────┐  ┌──────┐
│ images.respo │  │ links.res│  │ objective│  │ steps.│  │ notes│
│ nse.data     │  │ ponse.da │  │ s.response│  │ respon│  │ .resp│
│              │  │ ta       │  │ .data     │  │ se.dat│  │ onse.│
│              │  │          │  │           │  │ a     │  │ data │
└──────┬───────┘  └─────┬────┘  └─────┬─────┘  └───┬───┘  └──┬───┘
       │                │              │            │         │
       │                │              │            │         │
       └────────┬───────┴──────┬───────┴────────┬───┴─────────┘
                │              │                │
                ▼              ▼                ▼
        ┌─────────────┐  ┌──────────┐  ┌──────────────┐
        │ processProj │  │ processP │  │ processProje │
        │ ectImages() │  │ rojectLi │  │ ctObjectives │
        │ [projectSer │  │ nks()    │  │ ()           │
        │ vice.js:64- │  │ [86-99]  │  │ [108-125]    │
        │ 78]         │  │          │  │ ↓            │
        │             │  │          │  │ processObjec │
        │ - Filter by │  │ - Filter │  │ tiveSteps()  │
        │   _projectI │  │   by _fk │  │ [133-148]    │
        │   D         │  │   ID     │  │              │
        │ - Map: __ID │  │ - Map: l │  │ - Nests step │
        │   → id, url │  │   ink → │  │   s in objec │
        │   , title,  │  │   url, t │  │   tives      │
        │   descripti │  │   itle   │  │ - Sorts by o │
        │   on        │  │          │  │   rder       │
        └──────┬──────┘  └─────┬────┘  └──────┬───────┘
               │               │              │
               └───────┬───────┴──────┬───────┘
                       │              │
                       ▼              ▼
               ┌─────────────────────────────────┐
               │ Merge all processed data:       │
               │                                 │
               │ projectDetails = {              │
               │   images: processedImages,      │
               │   links: processedLinks,        │
               │   objectives: processedObjective│
               │   s,                            │
               │   notes: processedNotes         │
               │ }                               │
               └────────────┬────────────────────┘
                            │
                            ▼
               ┌─────────────────────────────────┐
               │ Update projects state:          │
               │                                 │
               │ setProjects(prevProjects =>     │
               │   prevProjects.map(p =>         │
               │     p.id === projectId ?        │
               │       { ...p, ...projectDetails │
               │       } : p                     │
               │   )                             │
               │ )                               │
               └────────────┬────────────────────┘
                            │
                            ▼
               ┌─────────────────────────────────┐
               │ setSelectedProject(mergedProject│
               │ )                               │
               │ - Project now has full data     │
               └────────────┬────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ ProjectDetails Component Renders                                │
│ [src/components/projects/ProjectDetails.jsx]                    │
│                                                                 │
│ - Header: name, status toggle, delete button                    │
│ - Stats: totalHours, unbilledHours, completion %                │
│ - Tabs:                                                         │
│   • Proposal (ProjectProposalsTab)                              │
│   • Team (ProjectTeamTab)                                       │
│   • Objectives (ProjectObjectivesTab) ← objectives with steps   │
│   • Tasks (ProjectTasksTab)                                     │
│   • Notes (ProjectNotesTab) ← notes                             │
│   • Links (ProjectLinksTab) ← links with GitHub detection       │
│   • Documentation (ProjectDocumentsTab)                         │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Fixed-Price Business Logic (Expected, Partially Implemented)

```
┌─────────────────────────────────────────────────────────────────┐
│ Project Created/Updated with f_fixedPrice = "1"                 │
│ - value: 10000                                                  │
│ - dateStart: 2025-01-01                                         │
│ - dateEnd: 2025-06-30                                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ processProjectValue(project, isUpdate)                          │
│ [src/services/projectService.js:508-596]                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Set billableStatus = false                                      │
│ - All time records for this project should be non-billable      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Check dateStart                                                 │
│ - dateStart exists? YES (2025-01-01)                            │
│ - dateStart <= today? (Assume today is 2025-03-15) YES          │
└────────────────────────┬────────────────────────────────────────┘
                         │ YES
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Create Sales Entry #1 (Start Payment)                           │
│                                                                 │
│ salesToCreate.push({                                            │
│   customer_id: project._custID,                                 │
│   amount: 10000 / 2 = 5000,                                     │
│   date: "2025-01-01",                                           │
│   description: "Fixed price project (Project X) - 50% on start",│
│   project_id: project.id,                                       │
│   type: 'sellable'                                              │
│ })                                                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Check dateEnd                                                   │
│ - dateEnd exists? YES (2025-06-30)                              │
│ - dateEnd <= today? (Assume today is 2025-03-15) NO             │
└────────────────────────┬────────────────────────────────────────┘
                         │ NO - Skip completion entry
                         │ (Will be created when dateEnd passes)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Return:                                                         │
│ {                                                               │
│   salesToCreate: [                                              │
│     {                                                           │
│       customer_id: "uuid-123",                                  │
│       amount: 5000,                                             │
│       date: "2025-01-01",                                       │
│       description: "... 50% on start",                          │
│       type: 'sellable'                                          │
│     }                                                           │
│   ],                                                            │
│   billableStatus: false                                         │
│ }                                                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ ✅ updateProjectRecordsBillableStatus(projectId, false)          │
│ [projectService.js:631-643]                                     │
│                                                                 │
│ ⚠️ CURRENT: Mock implementation - only logs                      │
│ ⚠️ EXPECTED: UPDATE devRecords SET f_billed = 0                  │
│             WHERE _projectID = projectId                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ ❌ createSalesFromProjectValue(project, user.supabaseOrgID)      │
│ [Referenced in useProject.js:287, NOT IMPLEMENTED]              │
│                                                                 │
│ ⚠️ CURRENT: Function doesn't exist, would throw error            │
│                                                                 │
│ ✅ EXPECTED Implementation:                                      │
│   For each entry in salesToCreate:                              │
│     INSERT INTO customer_sales (                                │
│       customer_id, amount, date, description,                   │
│       project_id, type, organization_id                         │
│     ) VALUES (                                                  │
│       entry.customer_id, entry.amount, entry.date,              │
│       entry.description, entry.project_id, entry.type, orgId    │
│     )                                                           │
│                                                                 │
│   Result:                                                       │
│   - 1 "sellable" entry created for $5000 on 2025-01-01          │
│   - When dateEnd passes (2025-06-30), logic should create       │
│     another "sales" entry for $5000 on completion               │
└─────────────────────────────────────────────────────────────────┘

Current Status:
✅ Logic exists and is called
⚠️ Billable status update is MOCK
❌ Sales entries are NOT created
❌ No verification/testing of logic
```

### 4. Subscription Business Logic (Expected, Partially Implemented)

```
┌─────────────────────────────────────────────────────────────────┐
│ Project Created/Updated with f_subscription = "1"               │
│ - value: 500 (monthly subscription amount)                      │
│ - dateStart: 2024-10-01                                         │
│ - dateEnd: null (perpetual subscription)                        │
│ - Today: 2025-01-10                                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ processProjectValue(project, isUpdate)                          │
│ [src/services/projectService.js:508-596]                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Check conditions:                                               │
│ - project.f_subscription? YES                                   │
│ - project.dateStart exists? YES (2024-10-01)                    │
└────────────────────────┬────────────────────────────────────────┘
                         │ YES
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Convert dates:                                                  │
│ - startDate = new Date("2024-10-01")                            │
│ - today = new Date("2025-01-10")                                │
│ - endDate = null (no end date)                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Validate time range:                                            │
│ - startDate <= today? YES (2024-10-01 <= 2025-01-10)            │
│ - !endDate OR endDate >= today? YES (no end date)               │
└────────────────────────┬────────────────────────────────────────┘
                         │ YES - Proceed
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ calculateMonthsBetweenDates(startDate, today)                   │
│ [projectService.js:604-623]                                     │
│                                                                 │
│ - yearDiff = 2025 - 2024 = 1                                    │
│ - monthDiff = 1 - 10 = -9                                       │
│ - months = 1 * 12 + (-9) = 3                                    │
│ - today.getDate(10) >= startDate.getDate(1)? YES → no adjust    │
│                                                                 │
│ Result: monthsPassed = 3 months                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │ monthsPassed = 3
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Loop: for (i = 0; i < 3; i++)                                   │
└─────┬──────────────────┬────────────────┬───────────────────────┘
      │ i=0              │ i=1            │ i=2
      ▼                  ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Month 1      │  │ Month 2      │  │ Month 3      │
│              │  │              │  │              │
│ monthDate =  │  │ monthDate =  │  │ monthDate =  │
│ 2024-10-01   │  │ 2024-11-01   │  │ 2024-12-01   │
│              │  │              │  │              │
│ Check endDat │  │ Check endDat │  │ Check endDat │
│ e: null → OK │  │ e: null → OK │  │ e: null → OK │
│              │  │              │  │              │
│ salesToCreat │  │ salesToCreat │  │ salesToCreat │
│ e.push({     │  │ e.push({     │  │ e.push({     │
│   customer_i │  │   customer_i │  │   customer_i │
│   d: uuid,   │  │   d: uuid,   │  │   d: uuid,   │
│   amount: 50 │  │   amount: 50 │  │   amount: 50 │
│   0,         │  │   0,         │  │   0,         │
│   date: "202 │  │   date: "202 │  │   date: "202 │
│   4-10-01",  │  │   4-11-01",  │  │   4-12-01",  │
│   descriptio │  │   descriptio │  │   descriptio │
│   n: "... Mo │  │   n: "... Mo │  │   n: "... Mo │
│   nth 1",    │  │   nth 2",    │  │   nth 3",    │
│   project_id │  │   project_id │  │   project_id │
│   : uuid,    │  │   : uuid,    │  │   : uuid,    │
│   type: 'sal │  │   type: 'sal │  │   type: 'sal │
│   es'        │  │   es'        │  │   es'        │
│ })           │  │ })           │  │ })           │
└──────────────┘  └──────────────┘  └──────────────┘
      │                  │                │
      └──────────┬───────┴────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Return:                                                         │
│ {                                                               │
│   salesToCreate: [                                              │
│     { amount: 500, date: "2024-10-01", description: "... 1" },  │
│     { amount: 500, date: "2024-11-01", description: "... 2" },  │
│     { amount: 500, date: "2024-12-01", description: "... 3" }   │
│   ],                                                            │
│   billableStatus: null                                          │
│ }                                                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ ❌ createSalesFromProjectValue(project, user.supabaseOrgID)      │
│ [Referenced in useProject.js:287, NOT IMPLEMENTED]              │
│                                                                 │
│ ⚠️ CURRENT: Function doesn't exist                               │
│                                                                 │
│ ✅ EXPECTED Implementation:                                      │
│   For each entry in salesToCreate (3 entries):                  │
│     INSERT INTO customer_sales (                                │
│       customer_id, amount, date, description,                   │
│       project_id, type, organization_id                         │
│     ) VALUES (                                                  │
│       entry.customer_id, 500, entry.date,                       │
│       entry.description, entry.project_id, 'sales', orgId       │
│     )                                                           │
│                                                                 │
│   Result:                                                       │
│   - 3 "sales" entries created for Oct, Nov, Dec 2024            │
│   - Total: $1500 in past subscription revenue                   │
│                                                                 │
│ ⚠️ MISSING FEATURE:                                              │
│   - No background job to create future monthly entries          │
│   - Logic only runs on project create/update                    │
│   - Ongoing subscriptions require manual project update or      │
│     separate cron job to generate new monthly entries           │
└─────────────────────────────────────────────────────────────────┘

Current Status:
✅ Logic exists and is called
✅ Correctly calculates months between dates
❌ Sales entries are NOT created (function not implemented)
❌ No automated monthly billing for ongoing subscriptions
❌ No UI to manually trigger subscription billing
```

---

## Known Gaps and Issues

### 1. Supabase Integration Gaps

**Issue**: Incomplete Supabase sync for projects
- ✅ **Projects table**: Synced on create via useProject.handleProjectCreate [lines 218-259]
- ❌ **Status updates**: NOT synced to Supabase
- ❌ **Project updates**: NOT synced to Supabase
- ❌ **Team changes**: NOT synced to Supabase
- ❌ **Project deletes**: NOT cleaned up from Supabase

**Impact**:
- Proposals require projects table (foreign key) - **CREATE works**
- Data inconsistency between FileMaker and Supabase for updates
- Orphaned Supabase records when FileMaker projects deleted
- Reports/analytics may show outdated project data

**Location**: [src/hooks/useProject.js]
- Create sync: lines 218-259 ✅
- Update: lines 310-386 ❌ (no Supabase call)
- Status change: lines 391-428 ❌ (no Supabase call)
- Delete: lines 441-473 ❌ (no Supabase cleanup)

### 2. Business Logic Not Fully Implemented

**Issue**: Fixed-price and subscription sales generation code exists but NOT executed

**Fixed-Price Projects**:
- ✅ Code exists: processProjectValue() [projectService.js:508-596]
- ✅ Called by: handleProjectCreate and handleProjectUpdate
- ⚠️ updateProjectRecordsBillableStatus: MOCK implementation [lines 631-643]
  - Only logs, doesn't actually update time records
- ❌ createSalesFromProjectValue: NOT IMPLEMENTED
  - Referenced in useProject.js:287
  - Function doesn't exist in salesService.js
  - No sales entries created in customer_sales table

**Subscription Projects**:
- ✅ Code exists: processProjectValue() [projectService.js:563-593]
- ✅ Correctly calculates monthsBetweenDates
- ❌ createSalesFromProjectValue: NOT IMPLEMENTED
- ❌ No background job/cron for ongoing monthly billing
- ❌ Logic only runs on project create/update (one-time)

**Impact**:
- Financial reports missing fixed-price revenue (50% on start, 50% on end)
- Subscription revenue not automatically recorded monthly
- Time records billable status not updated for fixed-price projects
- Manual workarounds required for accurate financial tracking

**Locations**:
- Business logic: [src/services/projectService.js:508-596]
- Hook calls: [src/hooks/useProject.js:261-289, 331-362]
- Missing function: createSalesFromProjectValue (should be in src/services/salesService.js)

### 3. Orphaned Related Data on Delete

**Issue**: Deleting a project does NOT delete related records

**Affected Data**:
- Objectives (devProjectObjectives)
- Objective Steps (devProjectObjSteps)
- Images (devProjectImages)
- Links (devProjectLinks)
- Notes (devNotes)

**Current Behavior**:
- handleProjectDelete only deletes project record [useProject.js:441-473]
- Uses deleteProject API [projects.js:8-20]
- FileMaker API: DELETE /layouts/devProjects/records/{recordId}
- Related records remain in FileMaker with orphaned foreign keys

**Unknown**:
- FileMaker may have cascading delete rules defined in database schema
- Not verified in frontend code
- Requires backend/FileMaker schema investigation

**Impact**:
- Database bloat from orphaned records
- Potential data integrity issues
- Confusing if orphaned data displayed elsewhere

**Location**: [src/hooks/useProject.js:441-473]

### 4. Polymorphic Associations Without Type Field

**Issue**: Notes, images, and links use polymorphic `_fkID` without entity type indicator

**Current Schema**:
- `_fkID` field contains UUID of parent (project, customer, or task)
- No `entity_type` or `parent_type` field
- Parent entity determined by query context only

**Problems**:
1. Cannot query "all notes for this project" without knowing it's a project
2. Cannot distinguish if _fkID="uuid-123" is project vs customer vs task
3. Migration to Supabase requires entity_type field for polymorphic associations
4. Risk of cross-entity data leaks if _fkID conflicts (unlikely with UUIDs)

**Affected Layouts**:
- devNotes (notes for projects, customers, tasks)
- devProjectImages (images for projects, possibly other entities)
- devProjectLinks (links for projects, possibly other entities)

**Impact**:
- Complex Supabase migration (need to backfill entity_type)
- Cannot use proper foreign key constraints in Supabase
- RLS policies difficult to write without entity_type

**Locations**:
- devNotes queries: [projects.js:47-59]
- devProjectImages queries: [projects.js:61-84]
- devProjectLinks queries: [projects.js:61-84]

### 5. Time Records Integration Unclear

**Issue**: Time records (devRecords) relationship to projects not fully documented

**Known**:
- Time records have `_projectID` foreign key
- Used for calculating totalHours and unbilledHours
- Loaded by ProjectContext for all projects (last 12 months)
- Field: `Billable_Time_Rounded` for hours calculation

**Unknown**:
- How devRecords maps to Supabase tables:
  - `time_entries` table?
  - `customer_sales` table?
  - Both?
- Billable flag (`f_billed`) update mechanism
- Integration with QuickBooks sync
- Whether time records are dual-written to Supabase

**Impact**:
- Cannot fully migrate projects without understanding time tracking
- Fixed-price billable status update is MOCK (no clarity on target table)
- Separate investigation required for time tracking migration

**Locations**:
- Time records query: [ProjectContext.jsx:14-39]
- Stats calculation: [projectService.js:156-193]
- Billable status update (MOCK): [projectService.js:631-643]

### 6. No Organization Scoping

**Issue**: FileMaker projects don't have `organization_id` field

**Impact**:
- Multi-tenant support requires organization scoping
- Supabase projects table has `organization_id` column
- Migration strategy needed:
  1. Add organization_id to FileMaker projects
  2. Backfill with default organization
  3. Update frontend to pass organization_id
- RLS policies cannot be applied without org field

**Locations**:
- Supabase sync: [useProject.js:234-247] (doesn't set organization_id)
- Migration plan required in: data-model-mapping.md

### 7. Date Format Conversion Risks

**Issue**: FileMaker uses MM/DD/YYYY, Supabase uses YYYY-MM-DD

**Current Handling**:
- convertToFileMakerDate() [projectService.js:10-17]
  - Converts YYYY-MM-DD → MM/DD/YYYY for FileMaker writes
- processProjectData() [projectService.js:52-53]
  - dateStart/dateEnd read from FileMaker (format unclear)
  - Stored as-is in frontend state

**Risks**:
1. Timezone issues during migration
2. Date parsing errors if format inconsistent
3. Month/day swap if locale mismatched (01/02/2025 = Jan 2 or Feb 1?)

**Mitigation Needed**:
- Normalize all dates to ISO 8601 (YYYY-MM-DD) in frontend
- Store dates in UTC in Supabase
- Convert to FileMaker format only at API boundary

**Locations**:
- Conversion: [projectService.js:10-17]
- Formatting: [projectService.js:301-302]
- Processing: [projectService.js:52-53]

### 8. Missing Error Handling

**Issue**: Limited error recovery in project operations

**Examples**:
1. **Supabase sync failure** [useProject.js:249-253]:
   - Shows error to user
   - FileMaker project created but Supabase sync failed
   - No rollback, inconsistent state

2. **Optimistic UI updates** [ProjectDetails.jsx:93-102]:
   - Status toggle uses optimistic update
   - Reverts on error ✅
   - But other operations don't use optimistic pattern

3. **Parallel data fetch** [useProject.js:98-104]:
   - If one fetch fails, all fail
   - No partial success handling
   - User sees empty tabs instead of available data

**Impact**:
- Poor user experience on network issues
- Data inconsistency risks
- Difficult to debug production issues

**Locations**:
- Supabase sync error: [useProject.js:249-259]
- Optimistic status toggle: [ProjectDetails.jsx:93-102]
- Parallel fetch: [useProject.js:98-104]

### 9. No Loading States for Related Data

**Issue**: Loading indicators missing for individual tabs

**Current Behavior**:
- Global `loading` flag in useProject hook
- Shown during initial project select
- But not shown when loading individual tab data (e.g., objectives, links)

**User Experience**:
- User selects project → loading spinner ✅
- User clicks Objectives tab → data appears instantly (from initial load) ✅
- User creates objective → no loading indicator during save ❌
- User adds link → no feedback during GitHub metadata fetch ❌

**Impact**:
- User unsure if action succeeded
- Duplicate clicks/submissions possible
- Jarring UI when data appears

**Locations**:
- Global loading: [useProject.js:34]
- No granular loading for:
  - Objective create [ProjectObjectivesTab.jsx:68-82]
  - Link create [ProjectLinksTab.jsx:46]
  - GitHub metadata fetch [ProjectLinksTab.jsx:54-99]

### 10. No Validation on FileMaker Side

**Issue**: Frontend validation only, no backend enforcement

**Current Validation** [projectService.js:217-259]:
- Name required
- Customer ID required
- Fixed price requires value > 0
- Subscription requires value > 0 AND dateStart
- Cannot be both fixed price AND subscription

**Risks**:
1. Direct FileMaker access bypasses validation
2. API calls outside frontend (e.g., backend cron) may create invalid projects
3. No database constraints enforce rules
4. Migration to Supabase requires constraint definition

**Mitigation Needed**:
- Define backend validation (API contracts)
- Add database constraints (Supabase schema)
- Consider FileMaker validation scripts

**Locations**:
- Frontend validation: [projectService.js:217-259]
- No backend validation visible in code

---

## Summary

### Working Features ✅

1. **Project CRUD**:
   - Create, Read, Update, Delete operations via FileMaker API
   - Validation on frontend
   - State management via useProject hook

2. **Related Data**:
   - Objectives with nested steps
   - Images, Links, Notes
   - Parallel data fetching (5 API calls)

3. **Supabase Sync on Create**:
   - Projects table synced when created (for proposal foreign key support)

4. **Business Logic Code**:
   - Fixed-price and subscription logic EXISTS in code
   - Called by create/update operations

5. **UI Components**:
   - Comprehensive tabbed project details interface
   - Project creation form with type selection
   - Project listing with cards
   - Objectives management with completion tracking
   - Links with GitHub integration

### Partially Implemented ⚠️

1. **Supabase Sync**:
   - Create: ✅ Working
   - Update/Status/Delete: ❌ Not synced

2. **Business Logic Execution**:
   - processProjectValue(): ✅ Called
   - updateProjectRecordsBillableStatus(): ⚠️ MOCK
   - createSalesFromProjectValue(): ❌ Not implemented

3. **Error Handling**:
   - Basic error catching: ✅
   - Optimistic UI (status toggle): ✅
   - Rollback on failure: ⚠️ Partial
   - Detailed error messages: ❌

### Not Implemented ❌

1. **Sales Entry Creation**:
   - Fixed-price 50/50 split
   - Subscription monthly billing
   - Function doesn't exist

2. **Automated Subscription Billing**:
   - No background job/cron
   - No monthly sales generation
   - Requires backend implementation

3. **Supabase Full Sync**:
   - Updates, status changes, team changes
   - Project deletions cleanup
   - Related data sync (objectives, links, etc.)

4. **Cascading Deletes**:
   - Orphaned objectives, steps, images, links, notes
   - May exist in FileMaker schema (unverified)

5. **Time Records Billable Status Update**:
   - Function is MOCK
   - Actual update mechanism unclear

6. **Organization Scoping**:
   - No org_id field in FileMaker
   - Migration strategy needed

### Code File Summary

**API Layer** (213 lines):
- `src/api/projects.js` - 10 functions for FileMaker CRUD

**Services Layer** (643 lines):
- `src/services/projectService.js` - 19 functions for data processing and business logic

**Hooks Layer** (582 lines):
- `src/hooks/useProject.js` - Central state management with 9 operations

**Components** (estimated 1500+ lines across 12+ files):
- ProjectDetails.jsx (443 lines) - Main project view
- ProjectCreationForm.jsx (150+ lines) - Create form
- 7 tab components (Proposals, Team, Objectives, Tasks, Notes, Links, Documentation)
- Supporting components (ProjectListing, ProjectCard, ProjectList, ProjectTabs)

**Context**:
- ProjectContext.jsx (95 lines) - Time records provider

**Total Codebase**: ~3000+ lines for Projects feature

---

**Next Steps for Migration**:
1. Implement createSalesFromProjectValue() in salesService
2. Add Supabase sync for update/status/delete operations
3. Design backend triggers for fixed-price and subscription billing
4. Implement actual updateProjectRecordsBillableStatus() (not mock)
5. Add entity_type field to polymorphic tables (notes, images, links)
6. Define cascading delete strategy (FileMaker vs Supabase)
7. Add organization_id to projects
8. Normalize date handling (UTC, ISO 8601)
9. Add granular loading states
10. Implement backend validation and constraints
