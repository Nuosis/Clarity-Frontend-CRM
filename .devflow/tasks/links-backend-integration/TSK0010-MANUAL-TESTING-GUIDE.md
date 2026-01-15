# TSK0010: Manual Testing Guide

## Quick Start

The development server is **already running** at http://localhost:1235

You can begin manual testing immediately following the steps below.

---

## Pre-Test Setup

### ✅ Completed Automatically
- [x] Dev server started (http://localhost:1235)
- [x] Build verified (no compilation errors)
- [x] 75 automated tests passed
- [x] 15 code verification checks passed

### 📋 Manual Steps Required
- [ ] Open http://localhost:1235 in your browser
- [ ] Open Browser DevTools (F12 or Cmd+Option+I)
- [ ] Open Console tab (to check for errors)
- [ ] Open Network tab (to verify API calls)
- [ ] Log in with valid credentials

---

## Known Limitation

⚠️ **Backend Issue**: The POST /links endpoint currently returns a 500 error (see `BACKEND_ISSUE_REPORT.md`).

**What this means**:
- ❌ Creating new links will fail (expected)
- ✅ Viewing existing links will work
- ✅ Editing links will work (if you have existing links)
- ✅ Deleting links will work (if you have existing links)
- ✅ GitHub URL detection will work
- ✅ Error messages will display properly

**Focus your testing on**:
1. UI behavior and error handling (when creation fails)
2. Link display and rendering
3. Edit/delete functionality (if existing links are available)
4. Console error checking (no FileMaker errors)

---

## Test Cases

### TC-001: Verify Application Loads ✅ PRIORITY

**Steps**:
1. Open http://localhost:1235 in browser
2. Log in with valid credentials
3. Navigate to a project

**Expected**:
- ✅ Application loads without errors
- ✅ No compilation errors in console
- ✅ Login works correctly
- ✅ Projects load and display

---

### TC-002: Check for FileMaker Errors ✅ PRIORITY

**Steps**:
1. With browser console open
2. Navigate through: Projects → Links Tab
3. Navigate to: Tasks → Expand a task
4. Look for any errors mentioning "FileMaker" or "fm-gofer"

**Expected**:
- ✅ No FileMaker-related errors
- ✅ No "fm-gofer" errors
- ✅ Only backend API calls visible in Network tab

**Check Network Tab**:
- Look for calls to `/links` (backend) ✅
- Should NOT see calls to `/fmi/data/v1` (FileMaker) ✅

---

### TC-003: View Existing Links (If Available)

**Prerequisites**: Project or task has existing links

**Steps**:
1. Navigate to a project with links
2. Click on the "Links" tab
3. Observe the links display

**Expected**:
- ✅ Links render in a grid layout
- ✅ Each link shows a title (hostname-based)
- ✅ Links are clickable
- ✅ Links open in new tab when clicked
- ✅ Hover shows edit/delete buttons
- ✅ No "undefined" or missing fields

**Check Console**: No transformation errors

---

### TC-004: Test Link Creation (Expected to Fail)

**Steps**:
1. Navigate to a project's Links tab
2. Try to create a new link with URL: `https://example.com/test`
3. Submit the form

**Expected Behavior (Due to Backend Issue)**:
- ✅ Loading state shown during API call
- ✅ Error message displayed: "Server error" or similar
- ✅ Error is user-friendly (not a raw stack trace)
- ✅ Application doesn't crash
- ✅ Console shows the error details

**Check Network Tab**:
- ✅ `POST /links` request made
- ✅ Request includes `Authorization: Bearer {hmac}` header
- ✅ Request includes `X-Organization-ID` header
- ✅ Response: 500 Internal Server Error (expected)

**Check Console**:
- Error logged but not breaking the app
- No FileMaker-related errors

---

### TC-005: Test GitHub URL Detection

**Steps**:
1. Navigate to a project's Links tab
2. Try to create a link with GitHub URL: `https://github.com/facebook/react`
3. Observe behavior

**Expected (Despite Backend Error)**:
- ✅ GitHub URL detected (check console for parseGitHubUrl logs)
- ✅ Attempt to fetch repository metadata
- ✅ Backend creation fails (expected 500)
- ✅ Error handled gracefully

**Code Verification**: The GitHub detection logic runs before the API call, so you can verify it's working even if creation fails.

---

### TC-006: Test Edit Link (If Existing Links Available)

**Prerequisites**: At least one link exists

**Steps**:
1. Navigate to a project with existing links
2. Hover over a link
3. Click the edit/pencil icon
4. Change URL to: `https://newurl.com`
5. Click Save

**Expected**:
- ✅ Edit mode activated
- ✅ Input field shows current URL
- ✅ Loading state during save
- ✅ Success message displayed OR error if backend issue
- ✅ Link updates in UI

**Check Network Tab**:
- ✅ `PATCH /links/{id}` request made
- ✅ Proper authorization headers

---

### TC-007: Test Delete Link (If Existing Links Available)

**Prerequisites**: At least one link exists (that you don't mind deleting)

**Steps**:
1. Navigate to a project with existing links
2. Hover over a link
3. Click the delete/trash icon
4. Confirm deletion in dialog

**Expected**:
- ✅ Confirmation dialog appears
- ✅ Loading state during deletion
- ✅ Success message displayed OR error if backend issue
- ✅ Link removed from UI

**Check Network Tab**:
- ✅ `DELETE /links/{id}` request made
- ✅ Proper authorization headers

---

### TC-008: Test Invalid URL Validation

**Steps**:
1. Navigate to a project's Links tab
2. Try to create a link with invalid URL: `not-a-url`
3. Observe behavior

**Expected**:
- ✅ Validation error displayed
- ✅ Error message is clear: "Invalid URL" or similar
- ✅ No API call made (check Network tab)
- ✅ Application doesn't crash

---

### TC-009: Test Error Message Display

**Steps**:
1. Try various operations (create, edit if available)
2. Observe error messages when backend returns 500

**Expected**:
- ✅ Errors displayed via SnackBar notification
- ✅ Messages are user-friendly (not technical)
- ✅ Messages appear and auto-dismiss
- ✅ No error message blocks the UI permanently

---

### TC-010: Test Task Link Creation (Expected to Fail)

**Steps**:
1. Navigate to a project's Tasks tab
2. Expand a task
3. Find link creation input in task details
4. Enter URL: `https://example.com/task-doc`
5. Submit

**Expected (Due to Backend Issue)**:
- ✅ Loading state shown
- ✅ Error message displayed
- ✅ Application remains functional

**Check Network Tab**:
- ✅ `POST /links` request made
- ✅ Request body includes `task_id` (not `project_id`)
- ✅ Proper authorization headers

---

## Testing Checklist

Use this checklist to track your manual testing progress:

- [ ] **TC-001**: Application loads and login works
- [ ] **TC-002**: No FileMaker errors in console (PRIORITY)
- [ ] **TC-003**: Existing links display correctly (if available)
- [ ] **TC-004**: Link creation shows proper error handling
- [ ] **TC-005**: GitHub URL detection works
- [ ] **TC-006**: Edit link works (if existing links available)
- [ ] **TC-007**: Delete link works (if existing links available)
- [ ] **TC-008**: Invalid URL validation works
- [ ] **TC-009**: Error messages are user-friendly
- [ ] **TC-010**: Task link creation routes correctly

---

## Critical Checks

**Must Verify** (Highest Priority):

1. ✅ **No FileMaker Errors**: Console should have ZERO FileMaker-related errors
2. ✅ **Backend API Used**: Network tab shows calls to `/links`, not `/fmi/data/v1`
3. ✅ **Error Handling Works**: Backend 500 errors handled gracefully
4. ✅ **Application Stable**: No crashes or broken UI states
5. ✅ **HMAC Auth Present**: All requests include Authorization header

---

## Recording Your Results

After completing manual tests, document your findings:

### Create: `TSK0010-MANUAL-TEST-RESULTS.md`

Use this template:

```markdown
# TSK0010: Manual Test Results

**Date**: [Date]
**Tester**: [Your Name]
**Environment**: Development (localhost:1235)

## Test Results

| Test Case | Status | Notes |
|-----------|--------|-------|
| TC-001: App loads | ✅/❌ | |
| TC-002: No FileMaker errors | ✅/❌ | |
| TC-003: Links display | ✅/❌/⏭️ | (⏭️ = skipped, no data) |
| TC-004: Create link error handling | ✅/❌ | |
| TC-005: GitHub URL detection | ✅/❌ | |
| TC-006: Edit link | ✅/❌/⏭️ | |
| TC-007: Delete link | ✅/❌/⏭️ | |
| TC-008: Invalid URL validation | ✅/❌ | |
| TC-009: Error messages | ✅/❌ | |
| TC-010: Task link routing | ✅/❌ | |

## Console Errors Found

[List any errors found in console]

## Network Traffic Issues

[List any unexpected network calls or missing headers]

## Overall Assessment

[Pass/Fail with notes]

## Recommendations

[Any issues that need fixing]
```

---

## What Success Looks Like

Even with the backend POST issue, a successful test should show:

✅ **Zero FileMaker errors** in console
✅ **Backend API calls** visible in Network tab (`/links`)
✅ **HMAC authentication** headers present in all requests
✅ **Error handling** works gracefully (500 errors don't crash app)
✅ **UI remains functional** even when backend fails
✅ **Validation works** (invalid URLs rejected before API call)
✅ **GitHub detection** runs (check console logs)
✅ **Edit/delete work** (if you have existing link data to test with)

---

## Troubleshooting

### Issue: Can't log in
**Solution**: Check `.env` file has correct Supabase credentials

### Issue: No projects showing
**Solution**: Database may be empty, create test project first

### Issue: Can't find Links tab
**Solution**: Navigate to a project, then look for tabs at top

### Issue: No existing links to test edit/delete
**Solution**: Focus on error handling and validation tests instead

### Issue: Console flooded with errors
**Solution**: Take screenshot and document in test results

---

## After Testing

1. **Document Results**: Create `TSK0010-MANUAL-TEST-RESULTS.md` with your findings
2. **Report Issues**: Note any new bugs not related to known backend issue
3. **Take Screenshots**: Capture any UI issues or errors
4. **Update Task**: Add test results to TSK0010 notes in `tasks.json`

---

## Questions?

If you encounter any issues not covered in this guide:
1. Check `BACKEND_ISSUE_REPORT.md` for known issues
2. Check console for error details
3. Check Network tab for API call details
4. Document the issue for further investigation

---

## Server Control

**Server is running in background (PID: b70122f)**

To stop the server:
```bash
kill $(lsof -ti:1235)
```

To restart the server:
```bash
npm run dev
```

---

## References

- **Automated Results**: `TSK0010-AUTOMATED-TEST-RESULTS.md`
- **Test Plan**: `TSK0010-INTEGRATION-TEST-PLAN.md`
- **Backend Issue**: `BACKEND_ISSUE_REPORT.md`
- **Vision**: `vision.md`
- **Task Definition**: `.devflow/tasks/links-backend-integration/tasks.json`
