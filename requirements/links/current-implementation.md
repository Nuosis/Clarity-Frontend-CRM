# Links - Current Implementation

## Overview

The Links feature allows users to attach URLs to projects, tasks, and customers. Links are currently stored in FileMaker's `devLinks` layout and accessed through the frontend via the fm-gofer bridge.

## FileMaker Integration

### Layout: devLinks

**Fields:**
- `__ID` - Primary key (FileMaker UUID format)
- `link` - The URL string
- `_fkID` - Foreign key to parent entity (polymorphic - can reference project, task, or customer)
- `~creationTimestamp` - Auto-generated creation timestamp
- `~modificationTimestamp` - Auto-generated modification timestamp
- `~CreatedBy` - Auto-populated creator username

**Note:** Title and description fields are NOT supported by the backend API, despite being referenced in some frontend code.

### FileMaker Operations

**Create Link:**
```javascript
// FileMaker API call structure
{
  layout: 'devLinks',
  action: 'CREATE',
  fieldData: {
    link: 'https://example.com',
    _fkID: 'parent-entity-id'
  }
}
```

**Fetch Links:**
```javascript
// FileMaker query structure
{
  layout: 'devLinks',
  action: 'READ',
  query: [{ "_fkID": "parent-entity-id" }]
}
```

## Frontend Architecture

### API Layer

**File:** `src/api/links.js`

**Function:** `createLink(data)`
- **Purpose**: Creates a new link in FileMaker
- **Parameters**:
  - `data.url` or `data.link` - The URL to store
  - `data.project_id` or `data.fkId` - Parent entity ID
- **Returns**: Promise resolving to FileMaker response
- **Implementation**: Lines 8-30

```javascript
export async function createLink(data) {
    validateParams({ data }, ['data']);

    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.LINKS,
            action: Actions.CREATE,
            fieldData: {
                link: data.url || data.link,
                _fkID: data.project_id || data.fkId
            }
        };

        return await fetchDataFromFileMaker(params);
    });
}
```

**File:** `src/api/tasks.js`

**Function:** `fetchTaskLinks(taskId)`
- **Purpose**: Fetches all links for a specific task
- **Parameters**: `taskId` - Task UUID
- **Returns**: Promise resolving to array of task links
- **Implementation**: Lines 305-317

```javascript
export async function fetchTaskLinks(taskId) {
    validateParams({ taskId }, ['taskId']);

    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.LINKS,
            action: Actions.READ,
            query: [{ "_fkID": taskId }]
        };

        return await fetchDataFromFileMaker(params);
    });
}
```

### Service Layer

**File:** `src/services/linkService.js`

**Function:** `createNewLink(fkId, link)`
- **Purpose**: Business logic for creating links
- **Validation**: URL format validation via `new URL()`
- **Parameters**:
  - `fkId` - Parent entity ID
  - `link` - URL string
- **Returns**: Promise resolving to FileMaker response
- **Implementation**: Lines 9-25

```javascript
export async function createNewLink(fkId, link) {
    if (!fkId || !link?.trim()) {
        throw new Error('Task ID and link URL are required');
    }

    // Basic URL validation
    try {
        new URL(link.trim());
    } catch (error) {
        throw new Error('Invalid URL format');
    }

    return await createLink({
        fkId,
        link: link.trim()
    });
}
```

**Function:** `processLinks(data)`
- **Purpose**: Transforms FileMaker response into frontend format
- **Processing**:
  - Maps FileMaker field names to frontend conventions
  - Sorts by creation date (newest first)
  - Extracts relevant fields
- **Implementation**: Lines 32-46

**File:** `src/services/projectService.js`

**Function:** `processProjectLinks(links, projectId)`
- **Purpose**: Filters and processes links for a specific project
- **Processing**:
  - Filters links by `_fkID` matching `projectId`
  - Maps to frontend format
  - Generates fallback title from URL hostname
- **Implementation**: Lines 85-98

```javascript
export function processProjectLinks(links, projectId) {
    if (!links?.response?.data) {
        return [];
    }

    return links.response.data
        .filter(link => link.fieldData._fkID === projectId)
        .map(link => ({
            id: link.fieldData.__ID,
            recordId: link.recordId,
            url: link.fieldData.link,
            title: link.fieldData.title || new URL(link.fieldData.link).hostname
        }));
}
```

**File:** `src/services/taskService.js`

**Function:** `processTaskLinks(data)`
- **Purpose**: Transforms task links from FileMaker response
- **Processing**:
  - Maps FileMaker fields to frontend format
  - Includes timestamps
  - No sorting (unlike notes)
- **Implementation**: Lines 230-242

### Hook Layer

**File:** `src/hooks/useLink.js`

**Hook:** `useLink()`
- **Purpose**: React hook for link operations with state management
- **State**: `loading`, `error`
- **Functions**: `handleLinkCreate()`, `clearError()`

**Function:** `handleLinkCreate(fkId, linkUrl)`
- **Purpose**: Creates link with enhanced GitHub detection
- **GitHub Integration**:
  - Parses GitHub URLs using `parseGitHubUrl()`
  - Attaches metadata for GitHub repos (owner, repo, normalizedUrl)
  - Non-invasive augmentation (doesn't call GitHub API)
- **Optimistic Returns**: Returns structured link object immediately
- **Implementation**: Lines 24-67

```javascript
const handleLinkCreate = useCallback(async (fkId, linkUrl) => {
    if (!fkId || !linkUrl?.trim()) {
        showError('Task ID and link URL are required');
        return null;
    }

    try {
        setLoading(true);
        setError(null);

        // Phase 1: local-only GitHub URL detection (no API calls)
        const trimmedUrl = linkUrl.trim();
        const gh = parseGitHubUrl(trimmedUrl);
        const isGitHub = gh?.isGitHub && gh.owner && gh.repo;
        const metadata = isGitHub
            ? { github: { owner: gh.owner, repo: gh.repo, normalizedUrl: gh.normalizedUrl || trimmedUrl } }
            : undefined;

        const result = await createNewLink(fkId, trimmedUrl);

        if (!result?.response?.recordId) {
            throw new Error('Failed to create link: No record ID returned');
        }

        const newLink = {
            id: result.response.recordId,
            url: trimmedUrl,
            createdAt: new Date().toISOString()
        };

        if (metadata) {
            newLink.metadata = metadata;
        }

        return newLink;
    } catch (err) {
        const errorMessage = err.message || 'Error creating link';
        setError(errorMessage);
        showError(errorMessage);
        return null;
    } finally {
        setLoading(false);
    }
}, [showError]);
```

### UI Components

**File:** `src/components/projects/ProjectLinksTab.jsx`

**Component:** `ProjectLinksTab`
- **Purpose**: Display and manage links for a project
- **Features**:
  - 2-column grid layout for links
  - "New Link" button to show input form
  - GitHub repository detection and creation
  - Optimistic UI updates
  - Link metadata fetching for GitHub repos
  - Automatic project detail refresh after creation

**User Workflow:**
1. User clicks "New Link" button
2. TextInput component appears
3. User enters URL
4. If GitHub URL and repo doesn't exist, modal opens for repo creation
5. Link is created in FileMaker
6. UI updates optimistically with temporary link
7. Project details are refreshed to get actual link data
8. If API call fails, optimistic update is reverted

**GitHub Integration:**
- Parses GitHub URLs to extract owner/repo
- Checks if repository exists via `checkRepositoryExists()`
- Opens `GitHubRepositoryModal` if repo doesn't exist
- Creates repository before creating link
- Fetches repository metadata for display

**Optimistic Updates:**
```javascript
// Create temporary link object
const tempLink = {
  id: `temp-${Date.now()}`,
  url: trimmedUrl,
  title: new URL(trimmedUrl).hostname
};

// Add to local state immediately
setLocalProject({
  ...localProject || project,
  links: [...(localProject?.links || project?.links || []), tempLink]
});

// Hide input form
setShowNewLinkInput(false);

// Make API call
const result = await handleLinkCreate(project.__ID, trimmedUrl);

// On success: refresh project details
// On failure: revert optimistic update
```

**File:** `src/components/tasks/TaskList.jsx`

**Component:** `TaskList` (expanded task view)
- **Purpose**: Display links in expanded task view
- **Features**:
  - Shows link input when user clicks "Add Link"
  - Creates link on submit
  - Refreshes task details after creation
- **Implementation**: Lines 223-227

```javascript
<TextInput
  placeholder="Enter URL..."
  submitLabel="Add"
  onSubmit={async (url) => {
    try {
      await handleCreateLink(task.id, url);
      await onExpand(task.id);
      setShowLinkInput(false);
    } catch (error) {
      console.error('Error creating link:', error);
    }
  }}
  onCancel={() => setShowLinkInput(false)}
/>
```

**File:** `src/components/common/SourceDocumentsManager.jsx`

**Component:** `SourceDocumentsManager`
- **Purpose**: Generic links manager used in proposal system
- **Context**: Manages source documents/links for proposals
- **Implementation**: Reusable component for any entity type

### Data Flow

#### Creating a Link

```
User Input (ProjectLinksTab/TaskList)
  ↓
useLink.handleLinkCreate(fkId, url)
  ↓
linkService.createNewLink(fkId, url)
  ├─ URL validation via new URL()
  └─ createLink({ fkId, link })
      ↓
  links.createLink(data)
    ├─ Map parameters (url → link, project_id → _fkID)
    └─ fetchDataFromFileMaker({ layout: 'devLinks', action: 'CREATE' })
        ↓
    FileMaker API
      ↓
    Response: { recordId, ... }
      ↓
  useLink builds link object { id, url, createdAt, metadata? }
    ↓
  UI component receives link object
    ↓
  Refresh parent entity details (project/task)
    ↓
  Display updated links list
```

#### Fetching Links

```
Component Mount (ProjectLinksTab/TaskList)
  ↓
Load project/task details
  ↓
Fetch related data (includes links)
  ↓
For projects: processProjectLinks(links, projectId)
  ├─ Filter by _fkID === projectId
  └─ Map to frontend format
For tasks: processTaskLinks(links)
  └─ Map to frontend format
  ↓
Store in component state/context
  ↓
Render links in UI
```

## GitHub Integration

### URL Parsing

**File:** `src/utils/githubUtils.js`

**Function:** `parseGitHubUrl(url)`
- Extracts owner and repository name from GitHub URLs
- Handles various GitHub URL formats:
  - `https://github.com/owner/repo`
  - `https://github.com/owner/repo.git`
  - `git@github.com:owner/repo.git`
- Returns: `{ isGitHub, owner, repo, normalizedUrl }`

### Repository Operations

**File:** `src/api/github.js`

**Functions:**
- `checkRepositoryExists({ owner, repo })` - Verifies if repo exists
- `createRepository({ owner, repo, description, visibility })` - Creates new repo
- `getRepositoryInfo({ owner, repo })` - Fetches repo metadata

### Workflow

1. User enters GitHub URL
2. `parseGitHubUrl()` extracts owner/repo
3. `checkRepositoryExists()` verifies existence
4. If doesn't exist:
   - Open `GitHubRepositoryModal`
   - User confirms/modifies repo details
   - `createRepository()` creates repo
5. Create link with normalized URL
6. `getRepositoryInfo()` fetches metadata for display (async, non-blocking)

## Validation Rules

### URL Validation
- Must be valid URL format (checked via `new URL()` constructor)
- Throws "Invalid URL format" error if malformed
- Trimmed before validation

### Required Fields
- `fkId` - Parent entity ID (required)
- `link` - URL string (required)
- Both validated in `linkService.createNewLink()`

### FileMaker Constraints
- URL length: Unknown (FileMaker text field, potentially unlimited)
- `_fkID` must reference existing entity (not enforced at API level)

## Current Limitations

1. **No Update Operation**: UI doesn't expose link editing
2. **No Delete Operation**: UI doesn't expose link deletion
3. **No Title/Description**: Backend doesn't support these fields despite frontend references
4. **No Uniqueness Check**: Same URL can be added multiple times
5. **No Parent Validation**: FileMaker doesn't verify `_fkID` references exist
6. **Read-Only Display**: Links are view-only in UI (click to open in new tab)
7. **Customer Links**: No UI for customer links, only projects and tasks
8. **No Sorting**: Task links not sorted (projects would sort by creation if implemented)

## Performance Considerations

1. **Optimistic Updates**: UI updates before API confirmation for better UX
2. **Refresh Required**: Parent entity details must be refreshed after link creation
3. **Batch Fetching**: Links fetched with parent entity, not separately
4. **GitHub Metadata**: Fetched asynchronously, non-blocking
5. **No Caching**: Links re-fetched on every project/task detail load

## Error Handling

1. **URL Validation**: Throws error before API call if URL invalid
2. **Missing Parameters**: Throws error if fkId or link missing
3. **FileMaker Errors**: Caught and displayed via `showError()` from SnackBarContext
4. **Optimistic Rollback**: Failed creates revert UI to previous state
5. **GitHub API Failures**: Non-blocking, proceed with link creation anyway

## Security Considerations

1. **URL Safety**: No sanitization or allowlist checking
2. **XSS Risk**: URLs rendered as `<a href>` - browser handles safety
3. **CSRF**: FileMaker API uses session-based auth
4. **No Rate Limiting**: Users can create unlimited links
5. **No Access Control**: Any authenticated user can create links for any entity

## Data Integrity

1. **Orphaned Links**: If parent entity deleted, links remain in FileMaker
2. **No Cascading Delete**: Links not automatically removed
3. **No Referential Integrity**: FileMaker doesn't enforce `_fkID` validity
4. **No Duplicate Prevention**: Same URL can exist multiple times for same parent
5. **Timestamps Automatic**: FileMaker auto-populates creation/modification times
