# Links Migration Requirements

## Overview

This directory contains comprehensive documentation for migrating the Links feature from FileMaker to Supabase. Links allow users to attach URLs to projects, tasks, and customers for reference and tracking.

## Current Status

- **Phase**: Phase 1 - Requirements Documentation
- **FileMaker Layout**: `devLinks`
- **Supabase Table**: `links` (exists, requires schema modification)
- **Backend Status**: Pending implementation
- **Frontend Status**: FileMaker-dependent

## Quick Reference

### FileMaker Implementation
- **Layout**: `devLinks`
- **Fields**: `__ID`, `link`, `_fkID`, timestamps, creator
- **Associations**: Projects, Tasks (via polymorphic `_fkID`)

### Supabase Schema
- **Table**: `links`
- **Associations**: Customers, Projects (Task support requires schema change)
- **Required Changes**: Add `task_id` column, modify constraints

### Key Gaps
1. No `task_id` column in Supabase `links` table
2. `customer_id` currently NOT NULL (should be nullable)
3. Need check constraint for exactly one parent entity
4. No backend API endpoints yet

## Documentation Structure

1. **[Current Implementation](./current-implementation.md)**
   - FileMaker integration details
   - Frontend code architecture
   - User workflows and UI components
   - Data flow and processing

2. **[Data Model Mapping](./data-model-mapping.md)**
   - FileMaker `devLinks` field definitions
   - Supabase `links` table schema
   - Field mappings and transformations
   - Schema gaps and required changes

3. **[API Contracts](./api-contracts.md)**
   - Required backend endpoints/RPCs
   - Request/response formats
   - Validation rules
   - Error handling

4. **[Authorization](./authorization.md)**
   - Row-level security policies
   - Organization scoping
   - Access control rules
   - Permission matrix

5. **[Migration Plan](./migration-plan.md)**
   - Data export from FileMaker
   - ID mapping strategy
   - Transformation logic
   - Import and validation process

6. **[Acceptance Criteria](./acceptance-criteria.md)**
   - Functional test cases
   - Edge cases and error scenarios
   - Performance requirements
   - Success metrics

## Dependencies

### Upstream Dependencies
- **Customer Migration** (INS0001): Customer links require customer UUIDs
- **Project Migration** (INS0002): Project links require project UUIDs
- **Task Migration** (INS0003): Task links require task UUIDs and schema support

### Backend Requirements
- Add `task_id` column to `links` table
- Modify `customer_id` to be nullable
- Add check constraint for exactly one parent
- Implement backend API endpoints/RPCs
- Create RLS policies
- Develop migration scripts

### Frontend Dependencies (Phase 2)
- `src/api/links.js` - Update to use Supabase
- `src/services/dataService.js` - Remove FileMaker routing
- No UI changes expected

## Code References

### API Layer
- `src/api/links.js` - FileMaker-based link creation
- `src/api/tasks.js:305-317` - Task links fetch

### Service Layer
- `src/services/linkService.js` - Link business logic
- `src/services/projectService.js:85-98` - Project link processing
- `src/services/taskService.js:230-242` - Task link processing

### Hooks
- `src/hooks/useLink.js` - Link operations hook with GitHub detection

### UI Components
- `src/components/projects/ProjectLinksTab.jsx` - Project links UI
- `src/components/tasks/TaskList.jsx` - Task links UI
- `src/components/common/SourceDocumentsManager.jsx` - Generic links manager

## Implementation Timeline

### Phase 1: Requirements Documentation ✓
- Document current implementation
- Define data model mapping
- Specify API contracts
- Plan migration strategy
- Define acceptance criteria
- Create backend change request

### Phase 2: Backend Implementation (Pending)
- Review and approve requirements
- Implement schema changes
- Create API endpoints/RPCs
- Develop RLS policies
- Build migration scripts
- Test in dev environment
- Deploy to production

### Phase 3: Frontend Implementation (Future)
- Update API layer to use Supabase
- Remove FileMaker dependencies
- Validate UI workflows
- Deploy and monitor

## Key Considerations

1. **Schema Changes Required**: Cannot migrate until backend adds `task_id` column
2. **Polymorphic Associations**: FileMaker uses `_fkID`, Supabase uses explicit foreign keys
3. **GitHub Integration**: Special handling for GitHub repository URLs
4. **Optimistic UI Updates**: Frontend expects immediate recordId response
5. **No CRUD UI**: Only create operation exposed, but backend should support full CRUD
6. **URL Validation**: 2048 character limit, valid URL format required
7. **Concurrent Access**: Multiple users may create links simultaneously

## Open Questions

1. Should links be unique per parent entity?
2. Should we support link metadata (title, description)?
3. What RLS policies are needed for links?
4. Should we track modification history?
5. How to handle orphaned links during migration?

## Related Documentation

- [Backend Change Request](../../BACKEND_CHANGE_REQUEST_LINKS.md)
- [Vision Document](../../.devflow/tasks/links-migration-requirements/vision.md)
- [Task Breakdown](../../.devflow/tasks/links-migration-requirements/tasks.json)
- [Workflows](../../.devflow/tasks/links-migration-requirements/workflows.md)

## Contact

For questions or clarifications about these requirements, contact the frontend team or submit issues through the standard project workflow.
