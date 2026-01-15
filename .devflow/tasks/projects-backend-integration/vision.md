# Projects Backend Integration

## Overview

Migrate the Projects feature from FileMaker-only implementation to use the new backend API endpoints. The backend has completed the projects migration requirements, implementing comprehensive REST endpoints for projects, objectives, steps, images, links, and notes. This feature updates the frontend to use these new endpoints.

## Goals

1. **Replace FileMaker Integration**: Remove all FileMaker-specific project API calls and replace with backend REST API calls
2. **Update Data Mapping**: Transform FileMaker field names/formats to Supabase schema (name, status, dates, budget, pricing flags)
3. **Implement Full CRUD**: Use new endpoints for list, detail, create, update, delete, and status updates
4. **Migrate Related Entities**: Update objectives, steps, images, links, and notes to use new endpoints
5. **Maintain Feature Parity**: Ensure all existing UI workflows continue to function correctly
6. **Update Tests**: Modify tests and fixtures to work with new API structure

## Success Criteria

- Project list loads from `/projects/customer/{customer_id}` endpoint
- Project detail loads from `/projects/{project_id}/detail` endpoint with nested data
- Create/update/delete operations work against new endpoints
- Status toggle uses `/projects/{project_id}/status` endpoint
- Objectives, steps, images, links, notes use their respective endpoints
- Related entity displays (customer, team, tasks) remain correct
- All tests pass with new API structure
- No FileMaker dependencies remain in project code

## Technical Approach

### Phase 1: API Layer (src/api/projects.js)
- Replace FileMaker operations with axios/fetch calls to backend API
- Implement HMAC authentication via dataService.generateBackendAuthHeader()
- Map endpoints: list, getById, create, update, delete, updateStatus
- Add endpoints for objectives, steps, images, links, notes

### Phase 2: Service Layer (src/services/projectService.js)
- Update data transformation functions for new schema
- Map FileMaker fields to Supabase fields:
  - `projectName` → `name`
  - `_custID` → `customer_id`
  - `value` → `budget`
  - `dateStart` → `start_date`
  - `dateEnd` → `target_end_date`
  - `f_fixedPrice` → `is_fixed_price`
  - `f_subscription` → `is_subscription`
  - Status mapping: "Open" → "active", "Closed" → "completed"
- Update business logic functions (if needed for new API)

### Phase 3: Hook Layer (src/hooks/useProject.js)
- Update `loadProjects()` to call new API
- Update `loadProjectDetails()` to use nested detail endpoint or parallel calls
- Update create/update/delete handlers
- Update objective/step management functions
- Remove FileMaker-specific logic (recordId handling, dual-write sync)

### Phase 4: Component Layer
- Update ProjectDetails, ProjectList, ProjectForm components
- Update objectives, images, links, notes tab components
- Ensure proper error handling and loading states
- Test all user workflows (create, edit, delete, status toggle)

### Phase 5: Testing
- Update test fixtures with new data structure
- Update API mocks to match new endpoints
- Test all CRUD operations
- Test related entity loading
- Validate business logic (fixed-price, subscription)

## Files to Modify

### Core Files
- `src/api/projects.js` - Replace FileMaker calls with backend REST calls
- `src/services/projectService.js` - Update data transformation and mapping
- `src/hooks/useProject.js` - Update hook to use new API methods

### Component Files
- `src/components/projects/ProjectDetails.jsx`
- `src/components/projects/ProjectList.jsx`
- `src/components/projects/ProjectObjectivesTab.jsx`
- `src/components/projects/ProjectTasksTab.jsx`
- `src/components/projects/ProjectTeamTab.jsx`
- `src/components/projects/ProjectDocumentsTab.jsx`
- `src/components/projects/ProjectNotesTab.jsx`
- `src/components/projects/ProjectLinksTab.jsx`
- `src/components/customers/ProjectCreationForm.jsx`
- `src/components/customers/ProjectListing.jsx`
- `src/components/customers/ProjectCard.jsx`
- `src/components/financial/ProjectList.jsx`

### Test Files
- Any project-related test files in `tests/` directory
- Update fixtures and mocks

## Dependencies

### Backend API Endpoints (Already Deployed)
- `GET /projects/customer/{customer_id}` - List projects by customer
- `GET /projects/{project_id}` - Get project by ID
- `GET /projects/{project_id}/detail` - Get project with nested details
- `POST /projects` - Create project
- `PUT /projects/{project_id}` - Update project
- `DELETE /projects/{project_id}` - Delete project
- `PATCH /projects/{project_id}/status` - Update status
- `GET /objectives/project/{project_id}` - List objectives
- `GET /projects/{project_id}/images` - List images
- `POST /projects/{project_id}/images` - Create image
- `GET /projects/{project_id}/notes` - List notes
- `POST /projects/{project_id}/notes` - Create note

### Frontend Dependencies
- `dataService.js` - For HMAC authentication
- `axios` or `fetch` - For HTTP requests
- Customer and Team data must be migrated/available

## Risks and Mitigation

### Risk: Breaking existing workflows
**Mitigation**: Thorough testing of all user flows before deployment, feature flag for gradual rollout

### Risk: Data mapping errors
**Mitigation**: Comprehensive field mapping documentation, unit tests for transformation functions

### Risk: Business logic changes
**Mitigation**: Verify fixed-price and subscription logic still works, compare FileMaker vs Supabase behavior

### Risk: Performance degradation
**Mitigation**: Use detail endpoint for nested data, implement proper caching, monitor API response times

## Notes

- Backend has implemented all required endpoints including objectives, steps, images, links, notes
- Schema includes new fields: `is_fixed_price`, `is_subscription`, `team_id`, `organization_id`
- Budget field replaces value field (business logic for sales generation may be backend-side)
- Status values are normalized: "active", "pending", "on_hold", "completed", "cancelled"
- FileMaker dual-write can be completely removed (projects were only partially synced anyway)
