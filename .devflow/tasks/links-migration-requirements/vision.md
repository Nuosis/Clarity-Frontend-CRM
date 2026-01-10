# Links Migration Requirements - Vision

## Overview

Create comprehensive documentation for migrating the Links feature from FileMaker to Supabase. Links are currently implemented via FileMaker's `devLinks` layout and are used to attach URLs to projects, tasks, and customers. This documentation will serve as the specification for backend team to implement Supabase-based links functionality.

## Goals

1. **Document Current Behavior**: Capture all existing links functionality including CRUD operations, associations, and UI flows
2. **Define Data Model**: Map FileMaker `devLinks` schema to existing Supabase `links` table
3. **Specify Backend Contracts**: Define all required API endpoints/RPCs for frontend integration
4. **Plan Migration**: Create strategy for migrating existing FileMaker links to Supabase
5. **Establish Testing Criteria**: Define acceptance criteria and test cases

## Success Criteria

- Complete requirements documentation following standardized template structure
- Clear data model mapping from FileMaker `devLinks` to Supabase `links` table
- Well-defined API contracts with request/response examples
- Comprehensive migration plan for existing links data
- Authorization requirements documented (RLS policies, org scoping)
- Acceptance criteria covering all current functionality and edge cases

## Technical Approach

### Current Implementation Analysis

**FileMaker Layout**: `devLinks`
- Fields: `__ID`, `link`, `_fkID`, `~creationTimestamp`, `~modificationTimestamp`, `~CreatedBy`
- Association: Foreign key `_fkID` links to parent entity (project or task)
- Note: No `title` or `description` fields are supported by backend API

**Supabase Table**: `links` (already exists)
- Columns: `id` (UUID), `customer_id` (UUID, NOT NULL), `organization_id` (UUID), `project_id` (UUID), `link` (VARCHAR(2048), NOT NULL), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ)
- Indexes: `idx_links_customer_id`, `idx_links_organization_id`, `idx_links_project_id`
- Foreign keys: customer_id → customers(id) CASCADE, organization_id → organizations(id) CASCADE
- **Note**: No `task_id` column exists yet - tasks are not directly supported

**Frontend Code**:
- API: `src/api/links.js` - `createLink()` function (FileMaker only)
- API: `src/api/tasks.js` - `fetchTaskLinks()` function
- Service: `src/services/linkService.js` - `createNewLink()`, `processLinks()`
- Service: `src/services/projectService.js` - `processProjectLinks()`
- Service: `src/services/taskService.js` - `processTaskLinks()`
- Hook: `src/hooks/useLink.js` - `handleLinkCreate()`
- UI Components:
  - `src/components/projects/ProjectLinksTab.jsx` - Project links display and creation
  - `src/components/tasks/TaskList.jsx` - Task links in expanded view

**Current Behavior**:
- Links can be created for projects and tasks
- Links are loaded with parent entity details
- Links display in a 2-column grid layout
- Each link shows URL (with hostname as fallback title)
- Special GitHub repository detection and creation flow
- Optimistic UI updates when creating links
- No update or delete functionality exposed in UI
- URL validation via `new URL()` constructor
- GitHub URL parsing and repository existence checking

### Supabase Schema Analysis

**Existing `links` Table Structure**:
```sql
CREATE TABLE links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id),
  link VARCHAR(2048) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Schema Gaps**:
1. **No `task_id` column**: Tasks are not supported as link parents
2. **Customer required**: `customer_id` is NOT NULL, but FileMaker uses `_fkID` which may point to tasks or projects
3. **No polymorphic pattern**: Unlike FileMaker which uses single `_fkID`, Supabase uses explicit nullable foreign keys

**Recommended Schema Changes** (Backend Change Request Required):
```sql
ALTER TABLE links
  ALTER COLUMN customer_id DROP NOT NULL,
  ADD COLUMN task_id UUID REFERENCES tasks(id) ON DELETE CASCADE;

CREATE INDEX idx_links_task_id ON links(task_id);

ALTER TABLE links
  ADD CONSTRAINT links_exactly_one_parent
  CHECK (
    (customer_id IS NOT NULL AND project_id IS NULL AND task_id IS NULL) OR
    (project_id IS NOT NULL AND customer_id IS NULL AND task_id IS NULL) OR
    (task_id IS NOT NULL AND customer_id IS NULL AND project_id IS NULL)
  );
```

### Backend Requirements

**Endpoints/RPCs Needed**:
- `GET /links?project_id={id}` - List links for project
- `GET /links?task_id={id}` - List links for task (requires schema change)
- `GET /links?customer_id={id}` - List links for customer
- `POST /links` - Create link with one parent entity
- `PATCH /links/{id}` - Update link URL (future)
- `DELETE /links/{id}` - Delete link (future)

**Or PostgreSQL Functions**:
- `get_links_by_project(project_id UUID)`
- `get_links_by_task(task_id UUID)` (requires schema change)
- `get_links_by_customer(customer_id UUID)`
- `create_link(url TEXT, project_id UUID DEFAULT NULL, task_id UUID DEFAULT NULL, customer_id UUID DEFAULT NULL)`

**Validation Rules**:
- URL must be valid (up to 2048 characters)
- Exactly one parent entity ID must be provided
- URL uniqueness per parent entity (optional, not currently enforced)

### Migration Strategy

1. **Schema Update**: Add `task_id` column and modify constraints (Backend Change Request)
2. **Data Export**: Extract all links from FileMaker `devLinks` layout
3. **ID Mapping**: Map FileMaker `_fkID` to Supabase entity UUIDs
   - Determine if `_fkID` references project, task, or customer
   - Look up corresponding Supabase UUID
4. **Data Transform**: Convert FileMaker records to Supabase format
   - Map `__ID` → ignore (new UUID generated)
   - Map `link` → `link`
   - Map `_fkID` → `project_id`, `task_id`, or `customer_id` based on entity type
   - Map `~creationTimestamp` → `created_at`
   - Map `~modificationTimestamp` → `updated_at`
5. **Data Import**: Bulk insert into Supabase with proper associations
6. **Validation**: Verify all links migrated correctly with associations intact

### Files Modified

```
.devflow/tasks/links-migration-requirements/
├── vision.md                      # This file - overview and technical approach
├── tasks.json                     # Implementation tasks breakdown
└── workflows.md                   # Implementation workflow diagrams
```

### Code References

**API Layer**:
- `src/api/links.js:8-30` - createLink() function (FileMaker-based)
- `src/api/tasks.js:305-317` - fetchTaskLinks() function

**Service Layer**:
- `src/services/linkService.js:9-25` - createNewLink() function
- `src/services/linkService.js:32-46` - processLinks() function
- `src/services/projectService.js:85-98` - processProjectLinks() function
- `src/services/taskService.js:230-242` - processTaskLinks() function

**Hook Layer**:
- `src/hooks/useLink.js:24-67` - handleLinkCreate() hook with GitHub detection

**UI Components**:
- `src/components/projects/ProjectLinksTab.jsx` - Full project links UI
- `src/components/tasks/TaskList.jsx:223-227` - Task link creation
- `src/components/common/SourceDocumentsManager.jsx` - Generic links manager (proposals)

**FileMaker Layout**:
- Layout: `devLinks` (defined in `src/api/fileMaker.js:417`)

## Dependencies

- **Backend Change Request**: Add `task_id` column to `links` table
- **Customer Migration** (INS0001): Customer links require customer UUIDs
- **Project Migration** (INS0002): Project links require project UUIDs
- **Task Migration** (INS0003): Task links require task UUIDs and schema support
- Backend team implementation of API endpoints/RPCs
- Frontend refactor will follow after backend implementation (Phase 2)

## Risks and Considerations

1. **Schema Mismatch**: Current Supabase `links` table requires `customer_id` but FileMaker uses polymorphic `_fkID`
2. **Task Support**: No `task_id` column exists - requires schema change before task links can migrate
3. **Association Integrity**: Must ensure all migrated links maintain correct parent associations
4. **URL Validation**: FileMaker may have links exceeding 2048 characters
5. **GitHub Integration**: Special handling for GitHub repository URLs (creation, validation)
6. **Optimistic UI**: Frontend uses optimistic updates - backend must return created record ID
7. **No Update/Delete**: UI doesn't expose these operations, but backend should support them
8. **Concurrent Creation**: Multiple users may create links simultaneously

## Timeline Considerations

This is Phase 1 (Requirements Documentation) only. Implementation will follow in Phase 2 after backend team:
1. Reviews and approves schema changes (Backend Change Request)
2. Adds `task_id` column to `links` table
3. Implements backend API endpoints/RPCs
4. Creates row-level security policies
5. Develops data migration scripts

Frontend implementation Phase 2 will update:
- `src/api/links.js` to call backend/Supabase instead of FileMaker
- Environment detection logic in `src/services/dataService.js`
- No major UI changes expected (existing components should work with minimal updates)

## Open Questions

1. Should links be unique per parent entity, or allow duplicates?
2. What should happen to links when parent entity is deleted? (Currently: CASCADE)
3. Should we support link metadata (title, description) in the future?
4. Should we track who created/modified links (audit trail)?
5. What RLS policies are needed? (organization-level access? project/task access?)
