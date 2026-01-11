# Notes Feature Migration Requirements

**Version:** 1.0
**Last Updated:** 2026-01-10
**Status:** Requirements Complete - Awaiting Backend Team Review
**Owner:** Frontend Team
**Backend Contact:** Backend Team via User

---

## Executive Summary

This document package contains comprehensive requirements for migrating the Notes feature from FileMaker to Supabase. Notes are text-based records attached to projects, tasks, and customers throughout Clarity CRM, providing a critical communication and context capture mechanism.

**Current State:** Notes stored in FileMaker `devNotes` layout with polymorphic associations via `_fkID` field.

**Target State:** Notes stored in Supabase `notes` table with explicit foreign keys, organization scoping, RLS policies, and full CRUD support.

**Migration Complexity:** Medium - Requires parent entity type detection and organization inference from existing FileMaker data.

**FileMaker Feature Parity:** All existing functionality will be preserved, with additional enhancements for multi-tenancy and audit trails.

---

## Quick Navigation

### Core Documentation

| Document | Purpose | Key Content |
|----------|---------|-------------|
| [current-implementation.md](./current-implementation.md) | Current system analysis | FileMaker schema, frontend architecture, UI flows, data patterns |
| [data-model-mapping.md](./data-model-mapping.md) | Database schema design | Field mappings, table structure, constraints, indexes, triggers |
| [api-contracts.md](./api-contracts.md) | Backend API specification | REST endpoints, request/response formats, validation rules, error catalog |
| [authorization.md](./authorization.md) | Security and access control | RLS policies, org scoping, permission inheritance, JWT/HMAC auth |
| [migration-plan.md](./migration-plan.md) | Data migration strategy | Export process, ID mapping, bulk insert, validation, rollback |
| [acceptance-criteria.md](./acceptance-criteria.md) | Testing requirements | Feature completeness, functional tests, edge cases, performance |

### Supporting Documentation

- [vision.md](../../.devflow/tasks/notes-migration-requirements/vision.md) - Project goals and technical approach
- [workflows.md](../../.devflow/tasks/notes-migration-requirements/workflows.md) - Workflow diagrams and process flows
- [tasks.json](../../.devflow/tasks/notes-migration-requirements/tasks.json) - Task tracking and implementation notes

---

## Feature Summary

### Current FileMaker Functionality

**What works today:**
- ✅ Create notes attached to projects (`src/components/projects/ProjectNotesTab.jsx:73-98`)
- ✅ Create notes attached to tasks (`src/components/tasks/TaskList.jsx:201-217`)
- ✅ View notes list for parent entity (reverse chronological order)
- ✅ Display note content, creation timestamp, creator email
- ✅ Default note type to 'general' with validation
- ✅ Polymorphic associations via `_fkID` field

**Current Limitations:**
- ❌ No update/edit operations (not exposed in UI)
- ❌ No delete operations (not exposed in UI)
- ❌ No organization scoping (single-tenant FileMaker)
- ❌ No pagination (all notes loaded at once)
- ❌ No advanced search or filtering
- ❌ Customer notes supported in schema but no UI

### Supabase Migration Enhancements

**Preserved functionality:**
- All CRUD operations via backend API with HMAC authentication
- Polymorphic associations (now explicit foreign keys)
- Note types and metadata
- Creation timestamps and creator tracking

**New capabilities:**
- Multi-tenant organization scoping with RLS policies
- Update and delete operations (API-ready, UI to be implemented)
- Audit trail: `created_by`, `updated_by`, `updated_at` fields
- Pagination support (50 per page default, 200 max)
- Advanced filtering: date range, type, full-text search
- Realtime subscriptions via Supabase (future enhancement)
- Parent entity access inheritance (can't create notes on entities you can't access)

---

## Key Architectural Decisions

### 1. Single Table with Nullable Foreign Keys

**Decision:** Use one `notes` table with nullable `customer_id`, `project_id`, `task_id` columns plus a check constraint enforcing exactly one non-null FK.

**Rationale:**
- Simplest to implement and maintain
- Matches current FileMaker polymorphic pattern
- Easy to query with standard PostgreSQL indexes
- Future-proof for additional entity types
- Preserves referential integrity via FK constraints

**Alternative Approaches Rejected:**
- Junction tables (project_notes, task_notes): More complex, harder to query
- `parent_type` + `parent_id` columns: Loses FK constraint benefits, requires manual type checking

**Reference:** `requirements/notes/data-model-mapping.md:56-128`

---

### 2. Dual Authentication: HMAC + JWT

**Decision:** Support both HMAC-authenticated backend API calls and direct Supabase JWT access.

**Usage:**
- **Backend API** (`/api/notes/*`): HMAC-SHA256 authentication for frontend operations
- **Supabase Direct**: JWT authentication for realtime subscriptions and admin operations
- **Service Role Key**: Backend operations that bypass RLS (migrations, admin tasks)
- **Anon Key**: Frontend Supabase client access (subject to RLS policies)

**Rationale:**
- Backend API handles complex business logic and multi-step operations
- Direct Supabase access enables realtime features and simple queries
- Follows established project pattern (see Teams migration)

**Reference:** `requirements/notes/authorization.md:42-97`

---

### 3. Organization Scoping via Parent Entity Inference

**Decision:** Derive `organization_id` from the parent entity (customer/project/task) rather than storing separately on notes.

**Implementation:**
```sql
-- Trigger automatically sets organization_id from parent entity
CREATE TRIGGER notes_set_organization_id
BEFORE INSERT ON notes
FOR EACH ROW EXECUTE FUNCTION notes_set_organization_from_parent();
```

**Rationale:**
- Single source of truth (organization lives on parent entity)
- Prevents organization mismatch between note and parent
- Simplifies note creation (no manual org_id passing)
- Enforces data integrity at database level

**Trade-offs:**
- Slightly more complex trigger logic
- Query performance depends on parent entity indexes (mitigated with partial indexes)

**Reference:** `requirements/notes/data-model-mapping.md:219-264`

---

### 4. Simple Permission Model (No RBAC)

**Decision:** All authenticated users in an organization have equal permissions for notes.

**Permissions:**
- ✅ SELECT: All notes in user's organization
- ✅ INSERT: Create notes on entities user has access to
- ✅ UPDATE: Edit any note in user's organization
- ✅ DELETE: Delete any note in user's organization

**Rationale:**
- Matches current FileMaker behavior (no role-based restrictions)
- Simpler RLS policies and easier to maintain
- Can add RBAC in future if business requirements change

**Future Considerations:**
- May want manager-only delete permissions
- May want note type restrictions (e.g., only managers can create "internal" notes)
- Easy to add via RLS policy updates without schema changes

**Reference:** `requirements/notes/authorization.md:1-39`

---

### 5. Big Bang Cutover Strategy

**Decision:** Switch all notes operations from FileMaker to Supabase in a single deployment.

**Approach:**
1. Backend deploys schema, API, RLS policies
2. Data migration runs (all historical notes)
3. Validation confirms 100% migration success
4. Frontend switches API calls from FileMaker to backend
5. Deploy to production

**Rationale:**
- Notes are relatively simple (no complex dependencies)
- Low risk of data inconsistency
- Easier to test and validate
- Cleaner code (no dual-write complexity)

**Rollback Plan:**
- Keep FileMaker data intact for 30 days
- Can revert frontend to FileMaker API calls if issues arise
- Supabase tables can be dropped without affecting FileMaker

**Reference:** `requirements/notes/migration-plan.md:398-471`

---

### 6. Offset Pagination (Not Cursor-Based)

**Decision:** Use offset/limit pagination for notes listing.

**Parameters:**
- `limit`: Number of records (default: 50, max: 200)
- `offset`: Records to skip (default: 0)
- Default sort: `created_at DESC` (newest first)

**Rationale:**
- Simpler to implement and understand
- Matches common pagination UX patterns
- Notes lists are typically small (<500 per entity)
- Cursor pagination complexity not justified for this use case

**Trade-offs:**
- Offset pagination can be slow for very large datasets (not expected for notes)
- Cursor pagination is more efficient for infinite scroll (not required)

**Reference:** `requirements/notes/api-contracts.md:34`

---

## Critical Dependencies

### Backend Schema Prerequisites

The following entities **MUST** be migrated to Supabase BEFORE notes migration:

1. ✅ **organizations** - Required for `organization_id` field and RLS
2. ✅ **customers** - Notes can reference customers
3. ✅ **projects** - Most notes are attached to projects
4. ✅ **tasks** - Many notes are attached to tasks
5. ✅ **auth.users** - Required for `created_by` / `updated_by` fields

**Verification Commands:**
```bash
# Verify all dependencies exist
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT COUNT(*) FROM public.organizations;\""
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT COUNT(*) FROM public.customers;\""
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT COUNT(*) FROM public.projects;\""
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT COUNT(*) FROM public.tasks;\""
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT COUNT(*) FROM auth.users;\""
```

**Reference:** `requirements/notes/migration-plan.md:14-30`

---

### Frontend Code Dependencies

The following frontend files will need updates after backend deployment:

| File | Current Behavior | Required Changes |
|------|------------------|------------------|
| `src/api/notes.js` | Calls FileMaker `devNotes` layout | Switch to backend API `/api/notes` with HMAC auth |
| `src/api/projects.js` | `fetchProjectNotes()` via FileMaker | Call `/api/notes?project_id={id}` |
| `src/api/tasks.js` | `fetchTaskNotes()` via FileMaker | Call `/api/notes?task_id={id}` |
| `src/services/noteService.js` | `processNotes()` transforms FileMaker data | Update to match backend response format |
| `src/hooks/useNote.js` | `handleNoteCreate()` uses FileMaker API | Update to backend API call |

**No UI component changes expected** - Components should work with minimal updates to data structure.

**Reference:** `requirements/notes/current-implementation.md:38-162`

---

## Open Questions for Backend Team

### 1. User ID Mapping Strategy

**Question:** How should we map FileMaker `~CreatedBy` (email/username) to Supabase `auth.users.id` (UUID)?

**Context:**
- FileMaker stores creator as email string (e.g., "marcus@claritybusinesssolutions.ca")
- Supabase requires `created_by` to be a UUID FK to `auth.users.id`
- Need mapping table or lookup strategy

**Options:**
- Create a migration user for unmapped creators (set `created_by` to NULL)
- Build email → UUID lookup during migration
- Store unmapped email in a separate `creator_email` text field for historical reference

**Impact:** Affects migration script and `created_by` field accuracy

**Reference:** `requirements/notes/migration-plan.md:147-197`

---

### 2. Full-Text Search Implementation

**Question:** Should we implement PostgreSQL full-text search on `note` field or defer to application-level search?

**Context:**
- Current implementation has no search functionality
- API contract includes `?search=` query parameter
- Could use `to_tsvector()` and GIN indexes for fast search

**Options:**
- **Option A:** PostgreSQL `tsvector` column + GIN index for high-performance search
- **Option B:** Simple `ILIKE '%search%'` query (slower but simpler)
- **Option C:** Defer search to application layer (future enhancement)

**Trade-offs:**
- `tsvector` is fastest but adds complexity (triggers, index maintenance)
- `ILIKE` is simplest but slow for large datasets
- Application-layer search offers more flexibility (fuzzy matching, relevance scoring)

**Recommendation:** Start with `ILIKE` for MVP, upgrade to `tsvector` if performance issues arise.

**Reference:** `requirements/notes/api-contracts.md:32`

---

### 3. Note Update/Delete Permissions

**Question:** Should we add role-based restrictions for update/delete operations?

**Context:**
- Current FileMaker has no update/delete UI (operations don't exist)
- Proposed Supabase implementation allows all authenticated org users to update/delete
- May want to restrict these operations to note creator or managers only

**Options:**
- **Current proposal:** All org users can update/delete any note (matches FileMaker simplicity)
- **Role-based:** Only note creator can update/delete their own notes
- **Manager-only:** Only users with manager role can delete notes

**Business Impact:** Affects RLS policies and permission model complexity

**Recommendation:** Start with simple model, add restrictions if business requirements emerge.

**Reference:** `requirements/notes/authorization.md:6-24`

---

### 4. Soft Delete vs Hard Delete

**Question:** Should deleted notes be soft-deleted (flagged as deleted) or hard-deleted (removed from table)?

**Context:**
- Current proposal uses hard delete (`DELETE FROM notes WHERE id = $1`)
- No audit trail or recovery mechanism for deleted notes

**Options:**
- **Hard delete:** Permanently remove row from database (current proposal)
- **Soft delete:** Add `deleted_at` timestamp column, filter deleted notes in queries
- **Archive table:** Move deleted notes to `notes_archive` table

**Trade-offs:**
- Hard delete is simpler, cleaner database
- Soft delete enables recovery and audit trail but complicates queries
- Archive table balances both but adds complexity

**Recommendation:** Hard delete for MVP (matches current FileMaker behavior where delete is not implemented).

**Reference:** `requirements/notes/api-contracts.md:311-346`

---

### 5. Orphaned Notes Handling

**Question:** What should happen to notes when parent entity (project/task/customer) is deleted?

**Current proposal:** `ON DELETE CASCADE` - notes are automatically deleted with parent entity.

**Alternative approaches:**
- `ON DELETE SET NULL` - Keep note but clear parent FK (creates orphaned notes)
- `ON DELETE RESTRICT` - Prevent parent deletion if notes exist

**Context:**
- Cascade delete matches typical CRM behavior (e.g., delete project → delete all related data)
- Preserves database integrity and storage efficiency
- No mechanism to recover notes if parent entity deleted accidentally

**Recommendation:** Use `ON DELETE CASCADE` with proper soft-delete on parent entities (projects/tasks should be soft-deleted, not hard-deleted).

**Reference:** `requirements/notes/data-model-mapping.md:87-89`

---

## Implementation Timeline

### Phase 1: Requirements Documentation ✅ COMPLETE

**Status:** All tasks complete (TSK0001 - TSK0009)

**Deliverables:**
- ✅ Current implementation analysis
- ✅ FileMaker schema documentation
- ✅ Supabase schema design
- ✅ API contract specification
- ✅ Authorization and RLS design
- ✅ Migration plan with scripts
- ✅ Acceptance criteria and test cases
- ✅ README overview (this document)

**Completion Date:** 2026-01-10

---

### Phase 2: Backend Implementation (PENDING)

**Owner:** Backend Team

**Estimated Effort:** 2-3 backend development cycles

**Tasks:**
1. **Schema Creation**
   - Create `notes` table with all columns, constraints, indexes
   - Create trigger functions for `organization_id` inference and `updated_at` timestamp
   - Apply to dev environment

2. **Backend API Implementation**
   - `GET /api/notes` - List notes with filtering and pagination
   - `GET /api/notes/:id` - Get single note
   - `POST /api/notes` - Create note
   - `PATCH /api/notes/:id` - Update note
   - `DELETE /api/notes/:id` - Delete note

3. **RLS Policies**
   - SELECT policy with organization scoping
   - INSERT policy with parent entity access validation
   - UPDATE policy with organization scoping
   - DELETE policy with organization scoping
   - Helper functions for parent entity access checks

4. **Backend Testing**
   - Unit tests for all endpoints
   - Integration tests for RLS policies
   - Performance tests for queries
   - Edge case testing (orphaned notes, concurrent creation, etc.)

5. **Data Migration**
   - Export all notes from FileMaker
   - Map FileMaker IDs to Supabase UUIDs
   - Bulk insert with validation
   - Verify migration completeness (100% success rate)

6. **Deployment**
   - Deploy to staging environment
   - Run data migration on staging
   - Validate staging deployment
   - Deploy to production
   - Run production data migration
   - Smoke testing

**Deliverables:**
- Supabase schema migration file
- Backend API endpoints (tested and documented)
- RLS policies (tested and validated)
- Migration scripts (dry-run verified)
- Backend deployment complete flag

**Dependencies:**
- All parent entity tables exist in Supabase (organizations, customers, projects, tasks)
- auth.users populated with all FileMaker users

---

### Phase 3: Frontend Integration (QUEUED)

**Owner:** Frontend Team

**Estimated Effort:** 1-2 frontend development cycles

**Prerequisites:**
- ✅ Backend schema deployed
- ✅ Backend API endpoints live
- ✅ RLS policies applied
- ✅ Historical data migrated

**Tasks:**
1. **API Layer Updates**
   - Update `src/api/notes.js` to call backend API instead of FileMaker
   - Update `src/api/projects.js` `fetchProjectNotes()` to use new endpoint
   - Update `src/api/tasks.js` `fetchTaskNotes()` to use new endpoint
   - Add HMAC authentication to all requests

2. **Service Layer Updates**
   - Update `src/services/noteService.js` `processNotes()` to match backend response format
   - Add new service functions for update/delete operations (future UI enhancement)

3. **Hook Updates**
   - Update `src/hooks/useNote.js` to use new API calls
   - Add error handling for new error formats
   - Add loading states

4. **Component Updates** (if needed)
   - Verify `src/components/projects/ProjectNotesTab.jsx` works with new data format
   - Verify `src/components/tasks/TaskList.jsx` works with new data format
   - No major UI changes expected

5. **Testing**
   - Test note creation flow (project and task notes)
   - Test note listing and display
   - Test error handling (validation errors, network errors)
   - Test loading states
   - Smoke test in staging environment

6. **Deployment**
   - Deploy frontend to staging
   - User acceptance testing
   - Deploy to production
   - Monitor for errors

**Deliverables:**
- Updated frontend code (API, services, hooks)
- Frontend deployment complete
- Notes feature working in web app (not FileMaker WebViewer)

**Post-Deployment:**
- Monitor error logs for issues
- Gather user feedback
- Plan future enhancements (edit/delete UI, realtime updates, advanced search)

---

## Risk Assessment

### High Risks

#### 1. Parent Entity Type Detection Failure

**Risk:** Migration script fails to correctly identify whether `_fkID` references a project, task, or customer.

**Likelihood:** Medium
**Impact:** High (data integrity issues)

**Mitigation:**
- Cross-reference `_fkID` values with projects, tasks, customers tables
- Log all unmatched `_fkID` values for manual review
- Set tolerance threshold: <5% orphaned notes acceptable (map to migration user)
- Implement dry-run migration with detailed logging before production

**Reference:** `requirements/notes/migration-plan.md:104-145`

---

#### 2. Organization Inference Errors

**Risk:** Notes migrated with incorrect `organization_id` due to parent entity having wrong org.

**Likelihood:** Low
**Impact:** Critical (data leakage between organizations)

**Mitigation:**
- Validate all parent entities have correct `organization_id` BEFORE notes migration
- Add database check constraint enforcing organization match
- Implement validation query to detect org mismatches:
  ```sql
  SELECT n.id, n.organization_id AS note_org,
         COALESCE(p.organization_id, t.organization_id, c.organization_id) AS parent_org
  FROM notes n
  LEFT JOIN projects p ON n.project_id = p.id
  LEFT JOIN tasks t ON n.task_id = t.id
  LEFT JOIN customers c ON n.customer_id = c.id
  WHERE n.organization_id != COALESCE(p.organization_id, t.organization_id, c.organization_id);
  ```

**Reference:** `requirements/notes/migration-plan.md:323-356`

---

### Medium Risks

#### 3. User Mapping Failures

**Risk:** Unable to map FileMaker `~CreatedBy` email to Supabase `auth.users.id` UUID.

**Likelihood:** Medium
**Impact:** Medium (historical data accuracy)

**Mitigation:**
- Create migration user UUID for unmapped creators
- Log all unmapped emails for manual review
- Store original FileMaker email in note metadata for reference
- Set tolerance: <10% unmapped acceptable

**Reference:** `requirements/notes/migration-plan.md:147-197`

---

#### 4. Performance Degradation

**Risk:** Notes queries perform poorly on large datasets (>10,000 notes per entity).

**Likelihood:** Low (most entities have <500 notes)
**Impact:** Medium (slow page loads)

**Mitigation:**
- Add partial indexes on foreign key columns for fast lookups
- Implement pagination with reasonable limits (50 default, 200 max)
- Cache commonly accessed note lists in application layer
- Monitor query performance in staging before production deployment

**Reference:** `requirements/notes/data-model-mapping.md:130-162`

---

### Low Risks

#### 5. Data Loss During Migration

**Risk:** Notes deleted or corrupted during migration process.

**Likelihood:** Very Low (with proper testing)
**Impact:** Critical

**Mitigation:**
- Keep FileMaker data intact for 30 days post-migration
- Export all notes to JSON backup before migration
- Implement transaction-based migration with rollback
- Validate 100% record count match before cutover
- Test migration on copy of production data in staging

**Reference:** `requirements/notes/migration-plan.md:472-508`

---

## Testing Strategy

### Pre-Migration Testing

**Objective:** Validate backend implementation before data migration

**Test Cases:**
1. ✅ Schema created correctly with all constraints
2. ✅ Triggers fire correctly (organization_id, updated_at)
3. ✅ RLS policies enforce organization scoping
4. ✅ API endpoints return correct data formats
5. ✅ Validation errors handled properly
6. ✅ Performance acceptable for expected load

**Reference:** `requirements/notes/acceptance-criteria.md:1-48`

---

### Migration Testing

**Objective:** Ensure data migration completes successfully with 100% accuracy

**Test Cases:**
1. ✅ All FileMaker notes exported
2. ✅ All parent entity types detected correctly
3. ✅ All organization IDs inferred correctly
4. ✅ All timestamps preserved
5. ✅ All user mappings successful (or logged as unmapped)
6. ✅ No duplicate notes created
7. ✅ Note count matches FileMaker exactly

**Validation Query:**
```sql
-- Verify total note count
SELECT COUNT(*) AS supabase_count FROM public.notes;
-- Compare to FileMaker export record count
```

**Reference:** `requirements/notes/acceptance-criteria.md:263-399`

---

### Post-Migration Testing

**Objective:** Validate frontend integration and end-to-end functionality

**Test Cases:**
1. ✅ Create project note
2. ✅ Create task note
3. ✅ View notes list for project (sorted correctly)
4. ✅ View notes list for task (sorted correctly)
5. ✅ Notes display correct content and metadata
6. ✅ Error handling works (validation errors, network failures)
7. ✅ Loading states show appropriately
8. ✅ Realtime updates work (if implemented)
9. ✅ Pagination works correctly (if implemented)

**Reference:** `requirements/notes/acceptance-criteria.md:49-262`

---

## Performance Requirements

### Query Performance

**Targets:**
- List notes for entity: <200ms (95th percentile)
- Create note: <500ms (95th percentile)
- Get single note: <100ms (95th percentile)
- Update note: <300ms (95th percentile)
- Delete note: <200ms (95th percentile)

**Expected Load:**
- Concurrent users: 50-100
- Notes per project: 10-500 (median ~50)
- Notes per task: 1-50 (median ~5)
- Total notes in system: 10,000-50,000

**Reference:** `requirements/notes/acceptance-criteria.md:400-467`

---

### Database Optimization

**Indexes Required:**
```sql
-- Primary key index (automatic)
CREATE INDEX idx_notes_pkey ON notes(id);

-- Foreign key indexes for fast joins
CREATE INDEX idx_notes_project_id ON notes(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_notes_task_id ON notes(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX idx_notes_customer_id ON notes(customer_id) WHERE customer_id IS NOT NULL;

-- Organization scoping index (for RLS)
CREATE INDEX idx_notes_organization_id ON notes(organization_id);

-- Sorting index (created_at DESC is default sort)
CREATE INDEX idx_notes_created_at_desc ON notes(created_at DESC);

-- Optional: Full-text search index (if implemented)
CREATE INDEX idx_notes_note_fts ON notes USING GIN(to_tsvector('english', note));
```

**Reference:** `requirements/notes/data-model-mapping.md:130-162`

---

## Contact and Ownership

### Frontend Team (Requirements Owners)

**Primary Contact:** User
**Role:** Requirements documentation and frontend implementation
**Responsibilities:**
- Maintain requirements documentation accuracy
- Answer clarification questions from backend team
- Implement frontend integration after backend deployment
- Conduct user acceptance testing

---

### Backend Team (Implementation Owners)

**Primary Contact:** Via User (backend team coordination)
**Role:** Schema design, API implementation, data migration
**Responsibilities:**
- Review and approve requirements documentation
- Implement Supabase schema and triggers
- Develop backend API endpoints
- Create and test RLS policies
- Execute data migration from FileMaker
- Deploy to production

---

### Project Stakeholders

**Business Owner:** User
**Technical Lead:** Backend Team Lead (via User)
**QA/Testing:** Frontend + Backend teams (no dedicated QA)

---

## Next Steps

### Immediate Actions (Week 1)

1. **Backend Team Review**
   - [ ] Review all requirements documentation
   - [ ] Answer open questions (see "Open Questions for Backend Team" section)
   - [ ] Approve schema design or request changes
   - [ ] Approve API contract or request changes

2. **Clarifications**
   - [ ] Schedule requirements review meeting if needed
   - [ ] Document any additional constraints or considerations
   - [ ] Update requirements based on backend team feedback

---

### Backend Implementation (Weeks 2-4)

1. **Schema Creation**
   - [ ] Create Supabase migration file
   - [ ] Apply to dev environment
   - [ ] Create triggers and helper functions
   - [ ] Test schema constraints

2. **API Development**
   - [ ] Implement all 5 endpoints
   - [ ] Add HMAC authentication
   - [ ] Add request validation
   - [ ] Write backend tests

3. **RLS Policies**
   - [ ] Create helper functions
   - [ ] Apply all 4 policies (SELECT, INSERT, UPDATE, DELETE)
   - [ ] Test policy enforcement

4. **Data Migration**
   - [ ] Export FileMaker notes to JSON
   - [ ] Create migration script
   - [ ] Dry-run in dev environment
   - [ ] Validate migration completeness

5. **Deployment**
   - [ ] Deploy to staging
   - [ ] Run staging migration
   - [ ] Staging validation testing
   - [ ] Deploy to production
   - [ ] Run production migration
   - [ ] Smoke testing

---

### Frontend Integration (Weeks 5-6)

1. **Code Updates**
   - [ ] Update `src/api/notes.js`
   - [ ] Update `src/api/projects.js`
   - [ ] Update `src/api/tasks.js`
   - [ ] Update `src/services/noteService.js`
   - [ ] Update `src/hooks/useNote.js`

2. **Testing**
   - [ ] Test create note flow
   - [ ] Test view notes flow
   - [ ] Test error handling
   - [ ] Staging deployment
   - [ ] User acceptance testing

3. **Production Deployment**
   - [ ] Deploy frontend to production
   - [ ] Monitor error logs
   - [ ] Gather user feedback

---

### Post-Deployment (Week 7+)

1. **Monitoring**
   - [ ] Monitor API performance metrics
   - [ ] Monitor error rates
   - [ ] Monitor user feedback

2. **Future Enhancements**
   - [ ] Implement edit/delete UI
   - [ ] Add realtime note updates
   - [ ] Implement full-text search
   - [ ] Add customer notes UI
   - [ ] Add note attachments (files/images)

---

## Appendix

### Related Migrations

This notes migration follows similar patterns to:

1. **Teams Migration** (`BACKEND_CHANGE_REQUEST_002_TEAMS_MIGRATION.md`)
   - Similar polymorphic association pattern
   - Organization scoping with RLS
   - HMAC + JWT dual authentication
   - Big bang cutover strategy

2. **Projects Migration** (completed)
   - Parent entity for notes
   - Organization scoping established
   - Backend API patterns defined

3. **Tasks Migration** (completed)
   - Parent entity for notes
   - Similar CRUD operations
   - Same authentication patterns

### Database Schema Reference

**Verified Supabase Tables** (as of 2025-12-05):
- See `.roo/rules/SUPABASE_DATABASE_VERIFICATION.md` for full table list
- All 69 tables verified and documented

**Key Tables for Notes:**
- `organizations` - Organization scoping
- `customers` - Parent entity
- `projects` - Parent entity (primary use case)
- `tasks` - Parent entity (secondary use case)
- `auth.users` - Created by / Updated by references

### Code References Index

**Current Implementation:**
- FileMaker Layout: `src/api/fileMaker.js:416`
- API Layer: `src/api/notes.js`, `src/api/projects.js:47-59`, `src/api/tasks.js:286-298`
- Service Layer: `src/services/noteService.js`
- Hook Layer: `src/hooks/useNote.js`
- UI Components: `src/components/projects/ProjectNotesTab.jsx`, `src/components/tasks/TaskList.jsx`

**Backend Integration:**
- HMAC Auth: `src/services/dataService.js:generateBackendAuthHeader()`
- Environment Detection: `src/services/dataService.js:setEnvironmentContext()`
- App State: `src/context/AppStateContext.jsx`

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-10 | Frontend Team | Initial comprehensive README created from completed requirements documentation (TSK0001-TSK0008) |

---

**End of Document**
