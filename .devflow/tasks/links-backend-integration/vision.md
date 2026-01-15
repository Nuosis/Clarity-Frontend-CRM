# Links Backend Integration - Vision

## Overview

Integrate the frontend links functionality with the newly deployed backend `/links` API endpoints. The backend has completed the links migration from FileMaker to Supabase, implementing full CRUD operations with proper schema including support for projects, tasks, customers, and organizations. The frontend must now be updated to use these backend APIs instead of FileMaker.

## Goals

1. **Replace FileMaker API calls** with backend REST API calls for all link operations
2. **Update schema mapping** from FileMaker format to backend LinkResponse format
3. **Add missing operations** (update, delete) that backend now supports
4. **Maintain existing UX** - all current UI flows should work identically
5. **Enable new parent types** - support organization and customer links (not just projects/tasks)

## Success Criteria

- All link operations (create, read, update, delete) work against new backend APIs
- Links render correctly in ProjectLinksTab and TaskList components
- Create/edit/delete operations succeed with proper error handling
- Tests pass for all link operations
- No FileMaker dependencies remain in links code
- GitHub integration features continue to work

## Technical Approach

### Backend API Endpoints (Already Implemented)

**Available Endpoints:**
- `GET /links?project_id={id}&task_id={id}&customer_id={id}&organization_id={id}` - List links with filters
- `POST /links` - Create new link
- `GET /links/{link_id}` - Get single link
- `PATCH /links/{link_id}` - Update link
- `DELETE /links/{link_id}` - Delete link

**Schema:**
```typescript
// LinkCreate (request body for POST)
{
  project_id?: string (UUID) | null
  customer_id?: string (UUID) | null
  organization_id?: string (UUID) | null
  task_id?: string (UUID) | null
  link: string (max 2048 chars, required)
}

// LinkResponse (response format)
{
  id: string (UUID, required)
  project_id?: string (UUID) | null
  customer_id?: string (UUID) | null
  organization_id?: string (UUID) | null
  task_id?: string (UUID) | null
  link: string (required)
  created_by?: string (UUID) | null
  updated_by?: string (UUID) | null
  created_at: string (ISO 8601 datetime, required)
  updated_at: string (ISO 8601 datetime, required)
}

// LinkUpdate (request body for PATCH)
{
  link?: string (max 2048 chars) | null
}
```

**Authentication:** HMAC-SHA256 (handled by `dataService.generateBackendAuthHeader()`)

### Current Frontend Implementation

**FileMaker-based (to be replaced):**

1. **API Layer** (`src/api/links.js`):
   - `createLink(data)` - Calls FileMaker devLinks layout
   - Maps `data.url` → `link`, `data.project_id` → `_fkID`

2. **Service Layer** (`src/services/linkService.js`):
   - `createNewLink(fkId, link)` - Validates URL, calls createLink()
   - `processLinks(data)` - Maps FileMaker response to frontend format

3. **Hook Layer** (`src/hooks/useLink.js`):
   - `handleLinkCreate(fkId, linkUrl)` - GitHub detection, creates link

4. **UI Components**:
   - `src/components/projects/ProjectLinksTab.jsx` - Project links UI
   - Task links in TaskList (various task components)

**FileMaker Schema → Backend Schema Mapping:**

| FileMaker Field | Backend Field | Notes |
|-----------------|---------------|-------|
| `__ID` | `id` | FileMaker UUID → Backend UUID |
| `link` | `link` | Direct mapping |
| `_fkID` | `project_id`, `task_id`, `customer_id`, `organization_id` | Polymorphic FK → Explicit FKs |
| `~creationTimestamp` | `created_at` | Timestamp format change |
| `~modificationTimestamp` | `updated_at` | Timestamp format change |
| `~CreatedBy` | `created_by` | Username → UUID |
| (none) | `updated_by` | New field |

### Implementation Strategy

#### Phase 1: API Layer Refactor
- Replace FileMaker calls in `src/api/links.js` with backend REST calls
- Add `getLinks()`, `getLinkById()`, `updateLink()`, `deleteLink()` functions
- Use HMAC authentication via `dataService.generateBackendAuthHeader()`
- Handle backend response format (LinkResponse)

#### Phase 2: Service Layer Updates
- Update `linkService.js` to work with new schema
- Modify `processLinks()` to handle LinkResponse format
- Update `createNewLink()` to accept parent type (project/task/customer/org)
- Add `updateLink()` and `deleteLink()` service functions

#### Phase 3: Hook Updates
- Update `useLink` hook to support CRUD operations (not just create)
- Add `handleLinkUpdate()` and `handleLinkDelete()` functions
- Maintain GitHub detection and metadata augmentation

#### Phase 4: UI Component Updates
- Update `ProjectLinksTab.jsx` to use new API
- Add edit/delete functionality to link UI (optional, based on requirements)
- Update optimistic update logic to work with new response format
- Update `TaskList` link display to use new schema

#### Phase 5: Testing
- Test create links for projects, tasks
- Test list links with filters
- Test update/delete operations (if UI added)
- Verify GitHub integration still works
- Test error handling and validation

### Files to Modify

```
src/
├── api/
│   └── links.js                         # Replace FileMaker with backend REST calls
├── services/
│   ├── linkService.js                   # Update schema mapping, add update/delete
│   ├── projectService.js                # Update processProjectLinks() if needed
│   └── taskService.js                   # Update processTaskLinks() if needed
├── hooks/
│   └── useLink.js                       # Add update/delete operations
└── components/
    ├── projects/
    │   └── ProjectLinksTab.jsx          # Update for new schema, optionally add edit/delete UI
    └── tasks/
        └── TaskList.jsx                 # Update link rendering if needed
```

### Backward Compatibility

**Environment Detection:**
- Use `dataService.getEnvironmentContext()` to route to correct API
- FileMaker environment → keep existing FileMaker calls (if needed)
- Web app environment → use new backend APIs

**Migration Period:**
- Existing links in FileMaker will be migrated by backend team
- Frontend supports both environments during transition
- Eventually remove FileMaker code path once migration complete

### New Capabilities Enabled

1. **Update Links**: Backend supports PATCH - can now edit link URLs
2. **Delete Links**: Backend supports DELETE - can now remove links
3. **Customer Links**: Can now create links for customers directly
4. **Organization Links**: Can now create links for organizations
5. **Audit Trail**: Backend tracks `created_by` and `updated_by`

### Testing Strategy

**Unit Tests:**
- Test API functions with mock backend responses
- Test service functions with new schema
- Test hook operations (create, update, delete)

**Integration Tests:**
- Test create link for project
- Test create link for task
- Test list links with filters
- Test update link URL
- Test delete link

**Manual Testing:**
- Create link from ProjectLinksTab
- Create link from TaskList
- Verify links render correctly
- Test GitHub repository detection flow
- Test optimistic updates and error handling

## Dependencies

- Backend `/links` endpoints must be deployed and accessible
- Backend must have migrated existing FileMaker links to Supabase
- HMAC authentication must be working (`dataService.generateBackendAuthHeader()`)
- Link UUIDs must be properly associated with parent entities

## Risks and Considerations

1. **Schema Differences**: FileMaker uses polymorphic `_fkID`, backend uses explicit foreign keys
2. **Response Format**: Must update all processing functions for new schema
3. **Error Handling**: Backend errors may differ from FileMaker errors
4. **GitHub Integration**: Ensure GitHub features still work with new API
5. **Optimistic Updates**: UI update logic may need adjustment for new response format
6. **Migration Timing**: Frontend deployment must align with backend migration completion
7. **Rollback**: May need to revert to FileMaker if backend has issues

## Open Questions

1. Should we add edit/delete UI for links, or keep them read-only?
2. Should we support customer and organization links in the UI?
3. What should happen if backend migration is incomplete?
4. Do we need dual-write support during migration period?
5. Should we remove FileMaker code entirely or keep it for fallback?
