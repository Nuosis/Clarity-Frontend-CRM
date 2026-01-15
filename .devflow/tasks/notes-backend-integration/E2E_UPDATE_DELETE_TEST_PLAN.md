# End-to-End Testing Plan: Update and Delete Notes

## Overview
This document provides a comprehensive test plan for manually testing the update and delete functionality for notes across different entity types (projects, tasks, customers).

## Test Environment Setup
1. Ensure the application is running: `npm run dev`
2. Verify backend API is accessible at `https://api.claritybusinesssolutions.ca`
3. Log in with valid credentials to establish organization context

## Test Cases

### Test Case 1: Update Project Note - Happy Path
**Objective:** Verify that project notes can be successfully updated

**Steps:**
1. Navigate to a project with existing notes
2. Hover over a note to reveal Edit/Delete buttons
3. Click the "Edit" button
4. Verify the note content appears in an editable textarea
5. Modify the note content (e.g., add "Updated:" prefix)
6. Click "Save"
7. Verify the note content updates in the UI
8. Refresh the page
9. Verify the updated content persists

**Expected Results:**
- Edit mode activates with textarea showing current content
- Save button is enabled when content is valid
- Updated note appears immediately after save
- Console shows: `[useNote] Note updated successfully: { id: <note_id> }`
- No errors in console or SnackBar
- Updated content persists after page refresh

**Data Verification:**
- Backend: `PATCH /projects/notes/{note_id}` returns updated record
- Database: `notes.note` field contains new content
- Database: `notes.updated_at` timestamp is refreshed

---

### Test Case 2: Update Task Note - Happy Path
**Objective:** Verify that task notes can be successfully updated

**Steps:**
1. Navigate to a project with tasks
2. Expand a task that has notes
3. Hover over a note to reveal Edit/Delete buttons (buttons appear on hover)
4. Click the "Edit" button
5. Modify the note content in the textarea
6. Click "Save"
7. Verify the note updates immediately

**Expected Results:**
- Edit buttons appear on hover with `group-hover:opacity-100` CSS
- Inline editing works within the compact task view
- Note updates immediately without closing the task
- Console shows update success log
- No UI jank or layout shifts

---

### Test Case 3: Delete Project Note - Happy Path
**Objective:** Verify that project notes can be successfully deleted

**Steps:**
1. Navigate to a project with existing notes
2. Count the number of notes displayed
3. Click "Delete" button on a note
4. Confirm deletion in the browser dialog
5. Verify the note disappears from the list
6. Verify note count decreases by 1
7. Refresh the page
8. Verify the note remains deleted

**Expected Results:**
- Browser confirmation dialog appears
- Note is removed from UI immediately after confirmation
- Console shows: `[useNote] Note deleted successfully: { id: <note_id> }`
- No errors in console or SnackBar
- Deletion persists after page refresh

**Data Verification:**
- Backend: `DELETE /projects/notes/{note_id}` returns 200/204
- Database: Note record is removed from `notes` table

---

### Test Case 4: Delete Task Note - Happy Path
**Objective:** Verify that task notes can be successfully deleted

**Steps:**
1. Navigate to a task with notes
2. Expand the task to view notes
3. Click "Delete" on a note
4. Confirm deletion
5. Verify the note is removed

**Expected Results:**
- Confirmation dialog appears
- Note disappears immediately
- Task view updates without closing
- No errors occur

---

### Test Case 5: Update Note - Validation Error (Empty Content)
**Objective:** Verify that empty note content is rejected

**Steps:**
1. Edit a note
2. Clear all content from the textarea
3. Attempt to click "Save"

**Expected Results:**
- Save button is **disabled** when textarea is empty (`disabled={!editContent.trim()}`)
- No API call is made
- No error messages appear
- User cannot submit empty content

---

### Test Case 6: Cancel Edit Operation
**Objective:** Verify that edit operation can be cancelled without saving

**Steps:**
1. Edit a note
2. Modify the content significantly
3. Click "Cancel"
4. Verify the original content is still displayed
5. Verify no API call was made

**Expected Results:**
- Edit mode exits without saving
- Original note content is preserved
- No backend request logged in console
- UI returns to normal state

---

### Test Case 7: Cancel Delete Operation
**Objective:** Verify that delete operation can be cancelled

**Steps:**
1. Click "Delete" on a note
2. Click "Cancel" in the confirmation dialog
3. Verify the note remains in the list

**Expected Results:**
- Browser confirmation dialog can be cancelled
- Note remains unchanged
- No API call is made
- No state changes occur

---

### Test Case 8: Update Note - Network Failure
**Objective:** Verify graceful error handling during network issues

**Steps:**
1. Open browser DevTools > Network tab
2. Set throttling to "Offline"
3. Edit a note and click "Save"
4. Observe error handling
5. Re-enable network
6. Retry the operation

**Expected Results:**
- SnackBar shows error: "Error updating note"
- Console logs: `[useNote] handleNoteUpdate error: <error details>`
- Note remains in edit mode (doesn't auto-close)
- User can retry after network restoration
- No partial state updates occur

---

### Test Case 9: Delete Note - Network Failure
**Objective:** Verify error handling during delete network issues

**Steps:**
1. Set network to offline
2. Attempt to delete a note
3. Confirm deletion
4. Observe error handling

**Expected Results:**
- SnackBar shows error: "Error deleting note"
- Console logs error
- Note remains in the list
- User can retry when network is restored

---

### Test Case 10: Update Note - Invalid Note ID (404)
**Objective:** Verify handling of invalid note IDs

**Prerequisites:** Manually construct an invalid note ID or delete the note in another session

**Steps:**
1. Edit a note that has been deleted in another browser tab/session
2. Attempt to save changes

**Expected Results:**
- SnackBar shows appropriate error message
- Console logs 404 error from backend
- UI handles the error gracefully
- No app crash or blank screen

---

### Test Case 11: Update Note - Missing Organization Context
**Objective:** Verify authorization requirements

**Prerequisites:** Force logout or clear JWT token (advanced testing)

**Steps:**
1. Simulate missing organization context
2. Attempt to update a note

**Expected Results:**
- Backend returns 401/403 error
- SnackBar shows authentication error
- User is prompted to re-authenticate
- No data corruption occurs

---

### Test Case 12: Multiple Rapid Updates (Race Condition Test)
**Objective:** Verify behavior with rapid consecutive updates

**Steps:**
1. Edit a note
2. Save changes
3. Immediately edit again
4. Save again quickly
5. Verify final state

**Expected Results:**
- Both updates complete successfully
- Final saved content matches last edit
- No lost updates or stale data
- Loading states prevent duplicate requests

---

### Test Case 13: Update Note - Special Characters
**Objective:** Verify handling of special characters in note content

**Steps:**
1. Edit a note
2. Enter special characters: `<script>alert('xss')</script>`, emojis 🎉, quotes "', line breaks
3. Save the note
4. Verify content is properly escaped/rendered

**Expected Results:**
- Special characters are preserved
- No XSS vulnerabilities (HTML is escaped)
- Emojis render correctly
- Line breaks are preserved
- Content matches input exactly

---

### Test Case 14: Pagination After Delete
**Objective:** Verify pagination state updates after deletion

**Prerequisites:** Entity with 50+ notes to trigger pagination

**Steps:**
1. Load notes with pagination
2. Click "Load More Notes"
3. Delete a note from the first page
4. Verify pagination state
5. Refresh and verify total count

**Expected Results:**
- Pagination count decrements correctly
- "Load More" button state updates if applicable
- No duplicate notes appear
- Total count is accurate

---

### Test Case 15: Edit Mode UI - Dark Mode
**Objective:** Verify edit UI works in dark mode

**Steps:**
1. Enable dark mode in settings
2. Edit a note
3. Verify textarea styling
4. Verify button styling
5. Verify hover states

**Expected Results:**
- Textarea has dark background (`bg-gray-700`)
- Text is readable (`text-gray-200`)
- Buttons have appropriate dark mode colors
- No contrast issues
- Hover states are visible

---

### Test Case 16: Edit Mode - Long Content
**Objective:** Verify handling of long note content during edit

**Steps:**
1. Create a note with 500+ characters
2. Edit the note
3. Verify textarea renders fully
4. Modify and save

**Expected Results:**
- Textarea expands to show full content
- No content truncation
- Scrolling works if needed
- Save operation handles large content

---

### Test Case 17: Delete Note - Last Note in List
**Objective:** Verify UI when deleting the last note

**Steps:**
1. Navigate to entity with only one note
2. Delete the note
3. Verify empty state displays

**Expected Results:**
- Note is removed
- Empty state message appears: "No notes added yet"
- No broken UI or empty space
- "New Note" button is still accessible

---

### Test Case 18: Cross-Entity Note Operations
**Objective:** Verify notes are properly scoped to their parent entity

**Steps:**
1. Create notes on Project A and Project B
2. Update a note on Project A
3. Verify Project B notes are unaffected
4. Delete a note on Project B
5. Verify Project A notes are unaffected

**Expected Results:**
- Notes are entity-scoped
- Operations don't affect other entities
- No cross-contamination of data

---

## Test Data Verification Checklist

After each update operation, verify:
- ✅ `notes.note` field contains new content
- ✅ `notes.updated_at` timestamp is current
- ✅ `notes.updated_by` is set (if user tracking is implemented)
- ✅ Other fields (id, project_id, created_at) are unchanged

After each delete operation, verify:
- ✅ Note record is removed from database
- ✅ Parent entity (project/task/customer) is unaffected
- ✅ Other notes remain intact

---

## Error Codes to Test

Based on backend API specification, test these error scenarios:

1. **INVALID_NOTE_ID** (400) - Malformed UUID
2. **NOTE_NOT_FOUND** (404) - Note doesn't exist
3. **MISSING_ORG_ID** (401) - No organization context
4. **ORG_MISMATCH** (403) - Note belongs to different org
5. **VALIDATION_ERROR** (400) - Invalid update payload
6. **INTERNAL_ERROR** (500) - Backend failure

---

## Browser Compatibility Testing

Test update/delete operations in:
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)

Focus on:
- Inline edit textarea behavior
- Confirmation dialogs
- CSS hover states
- Network error handling

---

## Accessibility Testing

Verify:
- ✅ Edit/Delete buttons are keyboard accessible
- ✅ Confirmation dialogs can be operated via keyboard
- ✅ Screen readers announce edit mode changes
- ✅ Focus management during edit mode
- ✅ Color contrast in dark mode

---

## Performance Testing

Monitor:
- API response times for PATCH/DELETE requests
- UI responsiveness during operations
- Memory usage after multiple operations
- No memory leaks from event handlers

---

## Test Results Template

| Test Case | Status | Notes | Tester | Date |
|-----------|--------|-------|--------|------|
| TC1: Update Project Note | ⬜ | | | |
| TC2: Update Task Note | ⬜ | | | |
| TC3: Delete Project Note | ⬜ | | | |
| TC4: Delete Task Note | ⬜ | | | |
| TC5: Empty Content Validation | ⬜ | | | |
| TC6: Cancel Edit | ⬜ | | | |
| TC7: Cancel Delete | ⬜ | | | |
| TC8: Update Network Failure | ⬜ | | | |
| TC9: Delete Network Failure | ⬜ | | | |
| TC10: Invalid Note ID | ⬜ | | | |
| TC11: Missing Org Context | ⬜ | | | |
| TC12: Rapid Updates | ⬜ | | | |
| TC13: Special Characters | ⬜ | | | |
| TC14: Pagination After Delete | ⬜ | | | |
| TC15: Dark Mode UI | ⬜ | | | |
| TC16: Long Content | ⬜ | | | |
| TC17: Last Note Delete | ⬜ | | | |
| TC18: Cross-Entity Scope | ⬜ | | | |

---

## Regression Testing

Verify existing functionality still works:
- ✅ Create note operations
- ✅ Fetch notes with pagination
- ✅ Load more notes
- ✅ Notes display in both FileMaker and webapp environments
- ✅ Environment detection and routing

---

## Sign-Off

- [ ] All test cases passed
- [ ] No critical bugs found
- [ ] Performance is acceptable
- [ ] Accessibility verified
- [ ] Browser compatibility confirmed
- [ ] Documentation updated

**Tested By:** _______________________
**Date:** _______________________
**Approved By:** _______________________
**Date:** _______________________
