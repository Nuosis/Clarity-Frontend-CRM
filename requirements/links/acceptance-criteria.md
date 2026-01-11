# Links - Acceptance Criteria and Test Plan

## Overview

This document defines the acceptance criteria for the Links migration from FileMaker to Supabase, including functional test cases, edge cases, performance requirements, and success metrics.

## Acceptance Criteria

### AC1: Schema Migration

**Criteria**: Supabase `links` table must support all FileMaker associations

**Verification**:
- ✅ `task_id` column exists with foreign key to `tasks(id)`
- ✅ `customer_id` is nullable
- ✅ Check constraint enforces exactly one parent entity
- ✅ All indexes created (`customer_id`, `project_id`, `task_id`, `organization_id`)
- ✅ `updated_at` trigger auto-updates on modifications
- ✅ Foreign keys have CASCADE delete behavior

**Test Query**:
```sql
-- Verify schema structure
\d+ links

-- Verify check constraint exists
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'links'::regclass
  AND conname = 'links_exactly_one_parent';

-- Verify trigger exists
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'links'::regclass
  AND tgname = 'update_links_updated_at';
```

---

### AC2: Data Migration Completeness

**Criteria**: All FileMaker links must be migrated without data loss

**Verification**:
- ✅ Record count matches: `SELECT COUNT(*) FROM filemaker_links` = `SELECT COUNT(*) FROM links`
- ✅ All URLs migrated successfully (no truncation)
- ✅ All timestamps preserved (created_at, updated_at)
- ✅ All parent associations correctly mapped
- ✅ No orphaned links (all have valid parent entity)

**Test Queries**:
```sql
-- Count validation
SELECT
  (SELECT COUNT(*) FROM filemaker_links_backup) AS filemaker_count,
  (SELECT COUNT(*) FROM links) AS supabase_count;

-- Parent distribution
SELECT
  COUNT(*) FILTER (WHERE customer_id IS NOT NULL) AS customer_links,
  COUNT(*) FILTER (WHERE project_id IS NOT NULL) AS project_links,
  COUNT(*) FILTER (WHERE task_id IS NOT NULL) AS task_links,
  COUNT(*) FILTER (WHERE organization_id IS NOT NULL) AS org_links
FROM links;

-- Verify no orphaned links
SELECT COUNT(*) FROM links
WHERE (customer_id IS NOT NULL)::int
  + (project_id IS NOT NULL)::int
  + (task_id IS NOT NULL)::int
  + (organization_id IS NOT NULL)::int = 0;
-- Should return 0
```

---

### AC3: Backend API Endpoints

**Criteria**: All CRUD operations functional via REST API

**Verification**:
- ✅ POST /links - Creates link with valid parent entity
- ✅ GET /links?{parent}_id={uuid} - Returns links filtered by parent
- ✅ GET /links/{id} - Returns single link by ID
- ✅ PATCH /links/{id} - Updates link URL
- ✅ DELETE /links/{id} - Deletes link
- ✅ HMAC authentication required on all endpoints
- ✅ 400 errors for invalid input
- ✅ 404 errors for non-existent resources
- ✅ 403 errors for unauthorized access

**Test Cases**: See "Backend API Tests" section below

---

### AC4: Row-Level Security

**Criteria**: Users can only access links for entities in their organization

**Verification**:
- ✅ Users in Org A cannot read links from Org B
- ✅ Users in Org A cannot create links for Org B entities
- ✅ Users in Org A cannot update/delete Org B links
- ✅ Anonymous users cannot access any links
- ✅ Service role can access all links

**Test Cases**: See "RLS Tests" section below

---

### AC5: Frontend Integration

**Criteria**: Existing UI workflows function identically with Supabase

**Verification**:
- ✅ `src/api/links.js` uses Supabase instead of FileMaker
- ✅ ProjectLinksTab displays links correctly
- ✅ TaskList displays task links correctly
- ✅ Creating new link works in ProjectLinksTab
- ✅ Creating new link works in TaskList
- ✅ GitHub URL detection still functions
- ✅ Optimistic UI updates work correctly
- ✅ Error handling displays user-friendly messages
- ✅ Loading states show during operations

**Test Cases**: See "Frontend UI Tests" section below

---

### AC6: GitHub Integration

**Criteria**: GitHub repository detection and creation workflows unchanged

**Verification**:
- ✅ GitHub URLs parsed correctly (owner/repo extraction)
- ✅ Repository existence check functions
- ✅ Repository creation modal opens for non-existent repos
- ✅ Metadata fetched and displayed for GitHub links
- ✅ Non-GitHub URLs work without metadata

**Test URLs**:
- `https://github.com/anthropics/claude-code`
- `https://github.com/facebook/react.git`
- `git@github.com:torvalds/linux.git`
- `https://example.com` (non-GitHub)

---

### AC7: Validation Rules

**Criteria**: All validation rules enforced at backend and frontend

**Verification**:
- ✅ URL format validated (must be valid URL)
- ✅ URL length ≤ 2048 characters
- ✅ Parent entity ID required (exactly one)
- ✅ Parent entity must exist
- ✅ Cannot create link with multiple parents
- ✅ Cannot create link with no parent

**Error Messages**:
- Invalid URL: "Invalid URL format"
- Missing parent: "Exactly one parent entity required"
- URL too long: "URL exceeds maximum length of 2048 characters"
- Parent not found: "Parent entity not found"

---

## Functional Test Cases

### Test Suite 1: Create Link Operations

#### Test 1.1: Create Project Link
**Given**: Valid project UUID
**When**: POST /links with `project_id` and valid URL
**Then**:
- Returns 201 Created
- Response includes link ID and all fields
- Link appears in GET /links?project_id={uuid}

#### Test 1.2: Create Task Link
**Given**: Valid task UUID
**When**: POST /links with `task_id` and valid URL
**Then**:
- Returns 201 Created
- Link associated with correct task

#### Test 1.3: Create Customer Link
**Given**: Valid customer UUID
**When**: POST /links with `customer_id` and valid URL
**Then**:
- Returns 201 Created
- Link associated with correct customer

#### Test 1.4: Create with Invalid URL
**Given**: Valid project UUID
**When**: POST /links with invalid URL (e.g., "not-a-url")
**Then**:
- Returns 400 Bad Request
- Error message: "Invalid URL format"

#### Test 1.5: Create with Missing Parent
**Given**: No parent ID provided
**When**: POST /links with only URL
**Then**:
- Returns 400 Bad Request
- Error message includes "parent entity required"

#### Test 1.6: Create with Multiple Parents
**Given**: Multiple parent IDs
**When**: POST /links with both `project_id` and `task_id`
**Then**:
- Returns 400 Bad Request
- Error message: "Exactly one parent entity required"

#### Test 1.7: Create with Non-Existent Parent
**Given**: Random UUID for parent
**When**: POST /links with non-existent `project_id`
**Then**:
- Returns 404 Not Found
- Error message: "Parent entity not found"

#### Test 1.8: Create with URL Exactly 2048 Chars
**Given**: Valid project UUID
**When**: POST /links with 2048-character URL
**Then**:
- Returns 201 Created
- Full URL stored

#### Test 1.9: Create with URL Over 2048 Chars
**Given**: Valid project UUID
**When**: POST /links with 2049-character URL
**Then**:
- Returns 400 Bad Request
- Error message: "URL exceeds maximum length"

---

### Test Suite 2: Read Link Operations

#### Test 2.1: List Project Links
**Given**: Project with 3 links
**When**: GET /links?project_id={uuid}
**Then**:
- Returns 200 OK
- Response contains 3 links
- All links have matching `project_id`

#### Test 2.2: List Task Links
**Given**: Task with 5 links
**When**: GET /links?task_id={uuid}
**Then**:
- Returns 200 OK
- Response contains 5 links
- Links sorted by created_at DESC

#### Test 2.3: List Links with No Filter
**Given**: Multiple links in system
**When**: GET /links (no query params)
**Then**:
- Returns 400 Bad Request
- Error message: "Exactly one filter parameter required"

#### Test 2.4: Get Single Link by ID
**Given**: Existing link ID
**When**: GET /links/{id}
**Then**:
- Returns 200 OK
- Response contains link details

#### Test 2.5: Get Non-Existent Link
**Given**: Random UUID
**When**: GET /links/{uuid}
**Then**:
- Returns 404 Not Found

#### Test 2.6: List Links for Entity with No Links
**Given**: Project with 0 links
**When**: GET /links?project_id={uuid}
**Then**:
- Returns 200 OK
- Response: `{ "data": [], "count": 0 }`

---

### Test Suite 3: Update Link Operations

#### Test 3.1: Update Link URL
**Given**: Existing link
**When**: PATCH /links/{id} with new URL
**Then**:
- Returns 200 OK
- `updated_at` timestamp changed
- URL updated

#### Test 3.2: Update with Invalid URL
**Given**: Existing link
**When**: PATCH /links/{id} with invalid URL
**Then**:
- Returns 400 Bad Request
- Link unchanged

#### Test 3.3: Update Non-Existent Link
**Given**: Random UUID
**When**: PATCH /links/{uuid}
**Then**:
- Returns 404 Not Found

#### Test 3.4: Update Parent Association
**Given**: Link with `project_id`
**When**: PATCH /links/{id} to change to `task_id`
**Then**:
- **Decision needed**: Should parent reassignment be allowed?
- If yes: Returns 200 OK, parent changed
- If no: Returns 400 Bad Request

---

### Test Suite 4: Delete Link Operations

#### Test 4.1: Delete Link
**Given**: Existing link
**When**: DELETE /links/{id}
**Then**:
- Returns 204 No Content
- Link no longer in database
- GET /links/{id} returns 404

#### Test 4.2: Delete Non-Existent Link
**Given**: Random UUID
**When**: DELETE /links/{uuid}
**Then**:
- Returns 404 Not Found

#### Test 4.3: Cascade Delete on Parent
**Given**: Project with 3 links
**When**: Delete the project
**Then**:
- All 3 links automatically deleted (CASCADE)
- GET /links?project_id={uuid} returns empty array

---

### Test Suite 5: Row-Level Security Tests

#### Test 5.1: Organization Isolation (Read)
**Given**: User in Org A, links exist in Org B
**When**: GET /links?project_id={org_b_project}
**Then**:
- Returns 200 OK with empty array OR 403 Forbidden
- No Org B links returned

#### Test 5.2: Organization Isolation (Create)
**Given**: User in Org A
**When**: POST /links with `project_id` from Org B
**Then**:
- Returns 403 Forbidden OR 404 Not Found

#### Test 5.3: Organization Isolation (Update)
**Given**: User in Org A, link belongs to Org B
**When**: PATCH /links/{org_b_link_id}
**Then**:
- Returns 403 Forbidden OR 404 Not Found

#### Test 5.4: Organization Isolation (Delete)
**Given**: User in Org A, link belongs to Org B
**When**: DELETE /links/{org_b_link_id}
**Then**:
- Returns 403 Forbidden OR 404 Not Found

#### Test 5.5: Anonymous User
**Given**: No authentication
**When**: Any /links request
**Then**:
- Returns 401 Unauthorized

#### Test 5.6: Service Role Access
**Given**: Service role credentials
**When**: GET /links?project_id={any_project}
**Then**:
- Returns 200 OK
- Can access all organizations

---

## Frontend UI Tests

### Test Suite 6: ProjectLinksTab Component

#### Test 6.1: Display Project Links
**Given**: Project with 2 links
**When**: ProjectLinksTab renders
**Then**:
- 2 links displayed in grid
- Each shows URL hostname as title
- Links open in new tab on click

#### Test 6.2: Show "New Link" Button
**Given**: ProjectLinksTab rendered
**When**: User views tab
**Then**:
- "New Link" button visible
- Clicking shows TextInput component

#### Test 6.3: Create Link via UI
**Given**: ProjectLinksTab with "New Link" input visible
**When**: User enters URL and submits
**Then**:
- TextInput disappears
- Optimistic UI update shows new link immediately
- After API success, project details refreshed
- New link persists in list

#### Test 6.4: Create Link - API Failure
**Given**: Backend returns error
**When**: User submits new link
**Then**:
- Optimistic update reverted
- Error message shown via snackbar
- TextInput remains visible for retry

#### Test 6.5: GitHub Link Metadata
**Given**: Project with GitHub URL link
**When**: Link renders
**Then**:
- GitHub icon/badge shown
- Repository metadata fetched asynchronously
- Metadata displayed (description, stars, etc.)

#### Test 6.6: GitHub Repo Creation Flow
**Given**: User enters GitHub URL for non-existent repo
**When**: User submits link
**Then**:
- GitHubRepositoryModal opens
- User can create repo or cancel
- If created, link uses created repo URL

#### Test 6.7: Empty State
**Given**: Project with 0 links
**When**: ProjectLinksTab renders
**Then**:
- Empty message displayed
- "New Link" button still visible

---

### Test Suite 7: TaskList Component (Expanded View)

#### Test 7.1: Display Task Links
**Given**: Task with 3 links
**When**: Task expanded in list
**Then**:
- All 3 links visible
- "Add Link" button shown

#### Test 7.2: Create Task Link
**Given**: Expanded task view
**When**: User clicks "Add Link", enters URL, submits
**Then**:
- Link created
- Task details refreshed
- New link appears in list

#### Test 7.3: Validation Error
**Given**: TextInput for new link
**When**: User enters invalid URL (e.g., "xyz")
**Then**:
- Error message shown
- Link not created
- Input remains for correction

---

## Edge Cases and Error Scenarios

### Edge Case 1: Duplicate URLs
**Scenario**: Same URL added multiple times to same entity
**Expected**: Allowed (no uniqueness constraint)
**Test**: Create 2 links with identical URL for same project
**Verify**: Both links created with different IDs

### Edge Case 2: Very Long URLs
**Scenario**: URL exactly at 2048 character limit
**Expected**: Accepted
**Test**: POST with 2048-char URL
**Verify**: Saved successfully

### Edge Case 3: Special Characters in URL
**Scenario**: URL with Unicode, spaces (encoded)
**Expected**: Stored as-is (browser encodes on display)
**Test**: POST with `https://example.com/path?q=hello%20world&lang=日本語`
**Verify**: Exact URL stored

### Edge Case 4: Concurrent Link Creation
**Scenario**: 2 users create links for same project simultaneously
**Expected**: Both succeed, no conflicts
**Test**: 2 parallel POST requests
**Verify**: Both links created with unique IDs

### Edge Case 5: Parent Entity Deleted Mid-Request
**Scenario**: Project deleted while link being created
**Expected**: 404 error or FK constraint violation
**Test**: Delete project, then POST link for that project
**Verify**: Appropriate error returned

### Edge Case 6: Orphaned Links (Migration)
**Scenario**: FileMaker link references non-existent `_fkID`
**Expected**: Logged and skipped during migration
**Test**: Include orphaned link in migration data
**Verify**: Migration completes, orphan logged, not imported

### Edge Case 7: URL with Fragment/Hash
**Scenario**: URL like `https://github.com/user/repo#section`
**Expected**: Full URL including fragment stored
**Test**: POST with fragment URL
**Verify**: Fragment preserved

### Edge Case 8: Whitespace in URL
**Scenario**: URL with leading/trailing spaces
**Expected**: Trimmed before validation
**Test**: POST with `"  https://example.com  "`
**Verify**: Stored as `https://example.com`

---

## Performance Requirements

### Requirement 1: API Response Time
**Target**: All API operations ≤ 200ms (p95)
**Measurement**: Backend logs or APM
**Test**:
```bash
# Using ApacheBench
ab -n 1000 -c 10 https://api.claritybusinesssolutions.ca/links?project_id={uuid}
```
**Success**: p95 ≤ 200ms

### Requirement 2: Database Query Performance
**Target**: Link fetch queries use indexes efficiently
**Measurement**: EXPLAIN ANALYZE
**Test**:
```sql
EXPLAIN ANALYZE
SELECT * FROM links WHERE project_id = 'some-uuid';
```
**Success**: Index scan used (not sequential scan)

### Requirement 3: Frontend Load Time
**Target**: ProjectLinksTab renders ≤ 100ms after data available
**Measurement**: React DevTools Profiler
**Success**: Render time ≤ 100ms for 50 links

### Requirement 4: Optimistic UI Update
**Target**: UI updates ≤ 50ms after user submits link
**Measurement**: Manual testing with throttled network
**Success**: Link appears immediately (before API response)

### Requirement 5: Pagination (Future)
**Target**: Support projects with 1000+ links
**Measurement**: Load test with large dataset
**Success**: UI remains responsive, API supports pagination

---

## Success Metrics

### Migration Success Criteria
- ✅ 100% of FileMaker links migrated
- ✅ 0% data loss (URLs, timestamps, associations)
- ✅ 0 orphaned links in production
- ✅ Migration completes within 4-hour maintenance window

### Backend API Success Criteria
- ✅ All endpoints return correct HTTP status codes
- ✅ All CRUD operations functional
- ✅ RLS policies enforce organization isolation
- ✅ API documentation complete (OpenAPI spec)

### Frontend Integration Success Criteria
- ✅ Zero FileMaker dependencies in `src/api/links.js`
- ✅ All UI workflows function identically to FileMaker version
- ✅ No regression bugs reported in first 2 weeks
- ✅ GitHub integration works without changes

### User Acceptance Criteria
- ✅ Users can create links for projects and tasks
- ✅ Links display correctly in UI
- ✅ No change in user experience (seamless migration)
- ✅ Error messages are clear and actionable

---

## Rollback Plan

### Trigger Conditions
- Migration results in >5% data loss
- RLS policies fail, exposing cross-org data
- Frontend breaks production workflows
- API downtime >1 hour

### Rollback Steps
1. Disable Supabase endpoints (return 503)
2. Re-enable FileMaker integration in `src/api/links.js`
3. Deploy frontend rollback
4. Verify FileMaker links accessible
5. Investigate root cause
6. Fix and re-attempt migration

### Rollback Testing
- Test rollback procedure in staging environment
- Verify FileMaker still has original data
- Ensure no dual-write corruption

---

## Test Execution Checklist

### Phase 1: Backend Tests (Pre-Frontend Migration)
- [ ] Run all Backend API Tests (Suites 1-4)
- [ ] Run all RLS Tests (Suite 5)
- [ ] Verify performance requirements
- [ ] Generate test coverage report

### Phase 2: Migration Tests
- [ ] Run migration in staging environment
- [ ] Execute all data validation queries
- [ ] Compare counts and associations
- [ ] Test rollback procedure

### Phase 3: Frontend Tests (Post-Migration)
- [ ] Run all Frontend UI Tests (Suites 6-7)
- [ ] Test edge cases
- [ ] Perform manual exploratory testing
- [ ] Verify GitHub integration

### Phase 4: Production Validation
- [ ] Smoke test all CRUD operations in production
- [ ] Monitor error rates (should be <0.1%)
- [ ] Check performance metrics
- [ ] Collect user feedback

---

## Test Data Requirements

### Staging Environment Setup
- **Organizations**: 2 test organizations (Org A, Org B)
- **Users**: 3 users (1 in Org A, 1 in Org B, 1 service role)
- **Customers**: 5 customers across orgs
- **Projects**: 10 projects across orgs
- **Tasks**: 20 tasks across projects
- **Links**: 50 test links with varied associations

### Test Link URLs
```javascript
const testUrls = [
  'https://github.com/anthropics/claude-code',
  'https://docs.google.com/document/d/abc123',
  'https://www.figma.com/file/xyz',
  'https://linear.app/issue/ABC-123',
  'https://example.com',
  'https://very-long-url.com/' + 'a'.repeat(2000), // Near limit
];
```

### FileMaker Export Sample
```json
[
  {
    "__ID": "FM-UUID-1",
    "link": "https://github.com/test/repo",
    "_fkID": "PROJECT-UUID-1",
    "~creationTimestamp": "2025-01-01T10:00:00Z",
    "~modificationTimestamp": "2025-01-01T10:00:00Z",
    "~CreatedBy": "testuser"
  }
]
```

---

## Automated Testing

### Unit Tests (Jest)
```javascript
// src/services/linkService.test.js
describe('linkService', () => {
  test('createNewLink validates URL format', async () => {
    await expect(createNewLink('task-id', 'invalid-url'))
      .rejects.toThrow('Invalid URL format');
  });

  test('createNewLink requires parent ID', async () => {
    await expect(createNewLink('', 'https://example.com'))
      .rejects.toThrow('Task ID and link URL are required');
  });
});
```

### Integration Tests (API)
```javascript
// test/integration/links.test.js
describe('Links API', () => {
  test('POST /links creates link', async () => {
    const response = await request(app)
      .post('/links')
      .send({ project_id: testProjectId, link: 'https://example.com' })
      .expect(201);

    expect(response.body.data).toHaveProperty('id');
    expect(response.body.data.link).toBe('https://example.com');
  });
});
```

### E2E Tests (Playwright)
```javascript
// test/e2e/project-links.spec.js
test('user can create project link', async ({ page }) => {
  await page.goto('/projects/test-project-id');
  await page.click('text=New Link');
  await page.fill('input[placeholder="Enter URL..."]', 'https://example.com');
  await page.click('text=Add');

  await expect(page.locator('text=example.com')).toBeVisible();
});
```

---

## Manual Testing Checklist

### Pre-Migration Manual Tests
- [ ] Verify FileMaker links display correctly
- [ ] Create link in FileMaker via UI
- [ ] Verify GitHub repo detection works in FileMaker mode

### Post-Migration Manual Tests
- [ ] Open ProjectLinksTab for project with links
- [ ] Create new link for project
- [ ] Open expanded task view with links
- [ ] Create new link for task
- [ ] Enter invalid URL and verify error message
- [ ] Enter GitHub URL and verify metadata loads
- [ ] Click link and verify opens in new tab
- [ ] Test on mobile viewport (responsive design)

---

## Documentation Requirements

### User-Facing Documentation
- [ ] Update user guide with Supabase-based screenshots
- [ ] Document any UI changes (if applicable)
- [ ] Add troubleshooting section for common link errors

### Developer Documentation
- [ ] Update API documentation (OpenAPI spec)
- [ ] Document RLS policies in database docs
- [ ] Update architecture diagrams (remove FileMaker)
- [ ] Add migration runbook for future reference

---

## Sign-Off Criteria

Before marking migration complete, obtain sign-off from:

1. **Backend Team**: Schema changes, API endpoints, RLS policies tested and approved
2. **Frontend Team**: UI workflows tested, no regressions found
3. **QA Team**: All test suites pass, edge cases validated
4. **Product Owner**: User acceptance criteria met, migration successful
5. **DevOps**: Monitoring configured, rollback plan validated

---

## Post-Migration Monitoring

### Week 1: Intensive Monitoring
- Monitor error rates hourly
- Check API response times daily
- Review user feedback daily
- Track link creation volume

### Week 2-4: Standard Monitoring
- Weekly performance review
- Bi-weekly user feedback check
- Monthly data integrity audit

### Alerts to Configure
- Link creation failure rate >1%
- API response time >500ms (p95)
- RLS policy violations detected
- Orphaned link detected (FK violation)

---

## Appendix: SQL Validation Queries

```sql
-- Verify table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'links'
ORDER BY ordinal_position;

-- Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'links';

-- Verify foreign keys
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'links';

-- Verify RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'links';

-- List RLS policies
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'links';
```

---

## Conclusion

This acceptance criteria and test plan ensures comprehensive validation of the Links migration from FileMaker to Supabase. All test cases must pass before promoting to production. Any failures should be documented, fixed, and re-tested.
