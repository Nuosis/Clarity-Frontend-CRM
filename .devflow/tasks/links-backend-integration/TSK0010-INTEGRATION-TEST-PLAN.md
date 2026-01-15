# TSK0010: Integration Testing Plan

## Overview
Manual testing of all link operations in development environment to verify the backend API integration works end-to-end.

## Test Environment
- **Environment**: Development (localhost:1235)
- **Backend API**: https://api.claritybusinesssolutions.ca
- **Authentication**: Supabase JWT + HMAC for backend
- **Known Issues**: Backend POST /links returns 500 (see BACKEND_ISSUE_REPORT.md)

## Pre-Test Checklist
- [ ] Dev server running (`npm run dev`)
- [ ] Logged in with valid credentials
- [ ] Browser console open (to check for errors)
- [ ] Network tab open (to verify API calls)

## Test Cases

### TC-001: Project Link Creation
**Objective**: Verify creating a link for a project works end-to-end

**Steps**:
1. Navigate to a project's Links tab
2. Click "New Link" or enter URL in input field
3. Enter a valid URL (e.g., `https://example.com/project-docs`)
4. Submit the form

**Expected Results**:
- ✅ Loading state shown during creation
- ✅ Success message displayed via SnackBar
- ✅ New link appears in the links list
- ✅ Link has correct title (hostname-based)
- ✅ Link is clickable and opens in new tab
- ✅ No FileMaker errors in console
- ✅ Network tab shows: `POST /links` with HMAC auth

**Known Issue**: Backend returns 500 - expect error message

---

### TC-002: Task Link Creation
**Objective**: Verify creating a link for a task works end-to-end

**Steps**:
1. Navigate to a project's Tasks tab
2. Expand a task to show details
3. Find the link creation input in the task details
4. Enter a valid URL (e.g., `https://example.com/task-reference`)
5. Submit the form

**Expected Results**:
- ✅ Loading state shown during creation
- ✅ Success message displayed
- ✅ New link appears in the task's links section
- ✅ Link has correct format
- ✅ No FileMaker errors in console
- ✅ Network tab shows: `POST /links` with `task_id` parameter

**Known Issue**: Backend returns 500 - expect error message

---

### TC-003: GitHub URL Detection
**Objective**: Verify GitHub repository detection and metadata augmentation

**Steps**:
1. Navigate to a project's Links tab
2. Create a new link with GitHub URL: `https://github.com/facebook/react`
3. Observe the link creation process

**Expected Results**:
- ✅ GitHub URL detected automatically
- ✅ Repository metadata fetched (if available)
- ✅ Link displays with GitHub icon or indication
- ✅ parseGitHubUrl() extracts owner/repo correctly
- ✅ No errors during GitHub integration

**Note**: Metadata augmentation happens in useLink hook

---

### TC-004: Edit Link Functionality
**Objective**: Verify editing an existing link works

**Prerequisites**: At least one link exists for a project

**Steps**:
1. Navigate to a project with existing links
2. Hover over a link to reveal edit button
3. Click the edit/pencil icon
4. Change the URL to a new value
5. Click Save

**Expected Results**:
- ✅ Edit mode activated with input field
- ✅ Current URL pre-filled in input
- ✅ Loading state shown during update
- ✅ Success message displayed
- ✅ Link updates in place with new URL
- ✅ Network tab shows: `PATCH /links/{id}`

**Note**: This feature was added in TSK0008

---

### TC-005: Delete Link Functionality
**Objective**: Verify deleting a link works

**Prerequisites**: At least one link exists for a project

**Steps**:
1. Navigate to a project with existing links
2. Hover over a link to reveal delete button
3. Click the delete/trash icon
4. Confirm deletion in the confirmation dialog

**Expected Results**:
- ✅ Confirmation dialog appears
- ✅ Loading state shown during deletion
- ✅ Success message displayed
- ✅ Link removed from the list
- ✅ Network tab shows: `DELETE /links/{id}`
- ✅ No orphaned links remain

**Note**: This feature was added in TSK0008

---

### TC-006: Links List Rendering
**Objective**: Verify links display correctly with new backend schema

**Prerequisites**: Project has multiple links

**Steps**:
1. Navigate to a project's Links tab
2. Observe the links list

**Expected Results**:
- ✅ All links rendered correctly
- ✅ Each link shows title (hostname-based)
- ✅ Links are clickable
- ✅ Timestamps formatted correctly
- ✅ No "undefined" or missing fields
- ✅ Sorted by newest first (created_at DESC)

**Check Console**: Verify no transformation errors

---

### TC-007: Error Handling - Invalid URL
**Objective**: Verify validation prevents invalid URLs

**Steps**:
1. Navigate to a project's Links tab
2. Try to create a link with invalid URL: `not-a-url`
3. Observe the error handling

**Expected Results**:
- ✅ Validation error displayed
- ✅ Error message is user-friendly
- ✅ Link not created
- ✅ No API call made for invalid input

---

### TC-008: Error Handling - Network Error
**Objective**: Verify proper handling of backend errors

**Steps**:
1. Open browser DevTools → Network tab
2. Enable "Offline" mode or throttling
3. Try to create a link
4. Observe error handling

**Expected Results**:
- ✅ Network error caught
- ✅ User-friendly error message displayed
- ✅ Optimistic update reverted (if any)
- ✅ Error logged to console
- ✅ App doesn't crash

---

### TC-009: Error Handling - Backend 500
**Objective**: Verify handling of known backend issue

**Steps**:
1. Try to create a link (any valid URL)
2. Observe the 500 error from backend

**Expected Results**:
- ✅ Error caught gracefully
- ✅ Error message displayed: "Server error, try again"
- ✅ Optimistic update reverted
- ✅ Console shows detailed error
- ✅ App remains functional

**Note**: This is a known issue, see BACKEND_ISSUE_REPORT.md

---

### TC-010: Environment Detection
**Objective**: Verify environment-aware behavior

**Steps**:
1. Check the environment detection logic
2. Verify API routing based on environment

**Expected Results**:
- ✅ Web App environment detected correctly
- ✅ Backend API used (not FileMaker)
- ✅ HMAC authentication headers present
- ✅ Organization ID header present
- ✅ No FileMaker bridge calls in network tab

**Check**: Look for calls to `/links` (backend) not `/fmi/data/v1` (FileMaker)

---

### TC-011: Optimistic Updates
**Objective**: Verify optimistic UI updates work correctly

**Steps**:
1. Navigate to a project's Links tab
2. Create a new link
3. Observe UI behavior during API call

**Expected Results**:
- ✅ Link appears immediately (optimistic)
- ✅ Loading indicator shown
- ✅ On success: link persists
- ✅ On error: link removed, error shown
- ✅ Smooth user experience

---

### TC-012: Multi-Entity Support
**Objective**: Verify links work for different parent types

**Steps**:
1. Create link for project (project_id)
2. Create link for task (task_id)
3. Verify filtering works correctly

**Expected Results**:
- ✅ Project links filtered by project_id
- ✅ Task links filtered by task_id
- ✅ No cross-contamination of links
- ✅ Each entity shows only its links

---

### TC-013: Console Error Check
**Objective**: Verify no unexpected errors in console

**Steps**:
1. Navigate through the application
2. Perform various link operations
3. Monitor browser console

**Expected Results**:
- ✅ No FileMaker-related errors
- ✅ No undefined field errors
- ✅ No transformation errors
- ✅ Only expected backend 500 error (known issue)

**Warnings**: Existing proposalService warnings are acceptable

---

## Post-Test Verification

### Code Verification Checklist
- [ ] All link operations route to backend API (not FileMaker)
- [ ] HMAC authentication used for all requests
- [ ] Organization ID header present in all requests
- [ ] No FileMaker bridge imports in links code
- [ ] Error handling covers all cases
- [ ] Loading states work correctly
- [ ] Success messages displayed

### Network Traffic Analysis
- [ ] `GET /links?project_id={id}` - List project links
- [ ] `GET /links?task_id={id}` - List task links
- [ ] `POST /links` - Create link (expect 500 due to backend issue)
- [ ] `PATCH /links/{id}` - Update link
- [ ] `DELETE /links/{id}` - Delete link
- [ ] All requests include `Authorization: Bearer {hmac}` header
- [ ] All requests include `X-Organization-ID` header

### Build Verification
```bash
npm run build
```
- [ ] Build succeeds with no compilation errors
- [ ] No TypeScript errors
- [ ] Only expected warnings (proposalService)

---

## Known Issues and Workarounds

### Issue #1: Backend POST /links returns 500
**Status**: Requires backend team investigation

**Impact**: Cannot create new links

**Workaround**: Frontend code is correct; wait for backend fix

**Reference**: BACKEND_ISSUE_REPORT.md, TSK0001 notes

---

### Issue #2: GET /links requires JWT, not HMAC
**Status**: Documented in TSK0001

**Impact**: Must use JWT for fetching links

**Workaround**: Use Supabase JWT for GET requests

---

## Success Criteria

For TSK0010 to be marked complete, the following must be verified:

1. ✅ **All UI components render correctly** with new backend schema
2. ✅ **Create link UI works** (even if backend returns 500 - frontend is correct)
3. ✅ **Edit link UI works** (update operations functional)
4. ✅ **Delete link UI works** (delete operations functional)
5. ✅ **GitHub integration works** (URL detection and metadata)
6. ✅ **Error handling displays proper messages** (user-friendly errors)
7. ✅ **No FileMaker errors in console** (complete migration to backend)
8. ✅ **Build succeeds** with no compilation errors
9. ✅ **Tests pass** (75 tests from TSK0009)
10. ✅ **Documentation complete** (test results documented)

---

## Test Results Template

### Test Execution Date: [Date]
### Tester: [Name]
### Environment: Development

| Test Case | Status | Notes |
|-----------|--------|-------|
| TC-001: Project Link Creation | ⏳ | |
| TC-002: Task Link Creation | ⏳ | |
| TC-003: GitHub URL Detection | ⏳ | |
| TC-004: Edit Link | ⏳ | |
| TC-005: Delete Link | ⏳ | |
| TC-006: Links List Rendering | ⏳ | |
| TC-007: Invalid URL Error | ⏳ | |
| TC-008: Network Error Handling | ⏳ | |
| TC-009: Backend 500 Handling | ⏳ | |
| TC-010: Environment Detection | ⏳ | |
| TC-011: Optimistic Updates | ⏳ | |
| TC-012: Multi-Entity Support | ⏳ | |
| TC-013: Console Error Check | ⏳ | |

**Overall Status**: ⏳ In Progress

---

## Next Steps After Testing

1. **Document Results**: Fill in test results table
2. **Report Issues**: Create issue reports for any new bugs found
3. **Update Tasks**: Mark TSK0010 as complete in tasks.json
4. **Create Completion Report**: Document findings in TSK0010-COMPLETION-REPORT.md
5. **Update Feature Status**: Update overall feature review_status if ready

---

## References

- Vision: `.devflow/tasks/links-backend-integration/vision.md`
- Workflows: `.devflow/tasks/links-backend-integration/workflows.md`
- Backend Issue: `BACKEND_ISSUE_REPORT.md`
- Task Definition: `.devflow/tasks/links-backend-integration/tasks.json`
- API Client: `src/api/links.js`
- Service Layer: `src/services/linkService.js`
- Hook: `src/hooks/useLink.js`
- UI Components: `src/components/projects/ProjectLinksTab.jsx`, `src/components/tasks/TaskList.jsx`
