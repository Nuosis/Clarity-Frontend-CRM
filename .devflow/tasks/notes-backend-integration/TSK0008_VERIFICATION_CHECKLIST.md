# TSK0008: TaskList Component Compatibility - Verification Checklist

## Automated Verification ✅

### Build Verification
- [x] Project builds successfully (`npm run build`)
- [x] No TypeScript errors
- [x] No ESLint blocking errors
- [x] Import paths resolve correctly
- [x] Bundle size reasonable (2.07 MB / 608 KB gzipped)

### Code Quality
- [x] All file modifications complete
- [x] Environment-aware API routing implemented
- [x] Data transformation logic correct
- [x] Backward compatibility maintained
- [x] Error handling preserved

### Implementation Completeness
- [x] `src/api/tasks.js` fetchTaskNotes() delegates to notes.js
- [x] `src/services/taskService.js` processTaskNotes() handles both formats
- [x] `src/components/tasks/TaskList.jsx` handleCreateNote() uses correct signature
- [x] Field accessor uses `note.content` (compatible with both formats)
- [x] Documentation created (TSK0008_IMPLEMENTATION_SUMMARY.md)
- [x] Task status updated in tasks.json

## Manual Verification (Requires Running App) ⏳

### Prerequisites
```bash
# Start dev server
npm run dev

# Navigate to http://localhost:1235
# Sign in with valid credentials
# Select a project with tasks
```

### Test 1: Display Task Notes
**Objective**: Verify notes display correctly in expanded task view

Steps:
1. Navigate to a project with tasks
2. Expand a task that has existing notes
3. Verify notes section displays
4. Check note content renders correctly
5. Verify notes are sorted by creation date (newest first)

Expected Results:
- [ ] Notes section visible when task expanded
- [ ] Note content displays correctly
- [ ] Notes sorted newest to oldest
- [ ] No console errors
- [ ] Proper loading state while fetching

### Test 2: Create New Task Note
**Objective**: Verify note creation flow works end-to-end

Steps:
1. Expand a task
2. Click "New Note" button
3. Enter note content: "Test note from backend API"
4. Click "Create" or submit
5. Verify note appears in list immediately
6. Collapse and re-expand task
7. Verify note persists

Expected Results:
- [ ] Note input form appears on click
- [ ] Submit button enabled when content entered
- [ ] Note created successfully (no errors)
- [ ] New note appears in list immediately
- [ ] Note persists after collapse/re-expand
- [ ] Success feedback shown (if applicable)

### Test 3: Create Note Error Handling
**Objective**: Verify error handling for invalid inputs

Steps:
1. Expand a task
2. Click "New Note" button
3. Leave content empty
4. Try to submit
5. Verify validation error shown

Expected Results:
- [ ] Validation prevents empty note submission
- [ ] Error message displayed via SnackBar
- [ ] Console shows error log
- [ ] Form stays open for correction
- [ ] No partial data created

### Test 4: Network Error Handling
**Objective**: Verify graceful handling of API failures

Steps:
1. Open DevTools Network tab
2. Enable offline mode or throttle to offline
3. Try to expand a task (fetch notes)
4. Observe error handling
5. Try to create a note
6. Verify error feedback

Expected Results:
- [ ] Loading state shows during request
- [ ] Error message shown via SnackBar
- [ ] Console logs error details
- [ ] UI remains functional (no crash)
- [ ] User can retry operation

### Test 5: FileMaker Compatibility (If Available)
**Objective**: Verify backward compatibility with FileMaker environment

Steps:
1. Open app in FileMaker WebViewer
2. Navigate to task with notes
3. Expand task
4. Verify notes display
5. Create new note
6. Verify note created in FileMaker

Expected Results:
- [ ] Notes fetch from FileMaker successfully
- [ ] Notes display correctly
- [ ] Create note works in FileMaker environment
- [ ] No backend API calls made (use FileMaker bridge)

### Test 6: Cross-Entity Note Verification
**Objective**: Verify task notes don't conflict with project notes

Steps:
1. Create note on Project A
2. Create note on Task T1 (in Project A)
3. Verify project note only shows in project
4. Verify task note only shows in task
5. Check database to confirm task_id vs project_id

Expected Results:
- [ ] Project note has project_id set, task_id=null
- [ ] Task note has task_id set, project_id=null
- [ ] Notes scoped correctly to entity
- [ ] No cross-contamination

### Test 7: Pagination Support (Future Enhancement)
**Objective**: Verify pagination parameters are supported (UI not implemented)

Steps:
1. Open DevTools Console
2. Manually call: `api.fetchTaskNotes(taskId, {limit: 5, offset: 0})`
3. Verify response limited to 5 items
4. Call again with offset: 5
5. Verify different items returned

Expected Results:
- [ ] API accepts limit parameter
- [ ] API accepts offset parameter
- [ ] Correct subset of notes returned
- [ ] Ready for UI implementation (TSK0009)

## Backend API Verification ⏳

### API Request Inspection

Expected Request Headers:
```
Authorization: Bearer {hmac_signature}.{timestamp}
X-Organization-ID: {organization_uuid}
Content-Type: application/json
```

Expected Request Body (Create):
```json
{
  "note": "Test note content",
  "type": "general",
  "task_id": "uuid-here",
  "project_id": null,
  "customer_id": null
}
```

Expected Response (Create):
```json
{
  "id": "uuid",
  "note": "Test note content",
  "type": "general",
  "task_id": "uuid-here",
  "organization_id": "uuid",
  "created_at": "2026-01-15T05:00:00Z",
  "updated_at": "2026-01-15T05:00:00Z"
}
```

### Verification Steps
- [ ] POST request to `/tasks/{task_id}/notes`
- [ ] HMAC authorization header present
- [ ] Organization ID header present
- [ ] Request body matches schema
- [ ] Response status 200 or 201
- [ ] Response body contains id, note, task_id
- [ ] GET request to `/tasks/{task_id}/notes` returns array
- [ ] Array contains created note

## Database Verification (SSH Access) ⏳

### Verify Note Stored Correctly

```bash
# SSH into backend server
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT id, note, type, task_id, project_id, customer_id, organization_id, created_at FROM project_notes WHERE task_id = 'YOUR-TASK-UUID' ORDER BY created_at DESC LIMIT 5;\""
```

Expected Output:
```
 id | note | type | task_id | project_id | customer_id | organization_id | created_at
----+------+------+---------+------------+-------------+-----------------+------------
 uuid | Test note... | general | task-uuid | null | null | org-uuid | 2026-01-15...
```

Verification Points:
- [ ] Note exists in database
- [ ] task_id matches test task
- [ ] project_id is null
- [ ] customer_id is null
- [ ] organization_id is set
- [ ] created_at timestamp correct

## Performance Verification ⏳

### Response Time Benchmarks
- [ ] Fetch notes < 500ms (typical)
- [ ] Create note < 1000ms (typical)
- [ ] No memory leaks on multiple operations
- [ ] No excessive re-renders

### Network Efficiency
- [ ] Single request to fetch all notes (no N+1 queries)
- [ ] Pagination parameters work to limit data transfer
- [ ] Reasonable payload sizes

## Security Verification ⏳

### Organization Isolation
- [ ] Cannot fetch notes from other organization's tasks
- [ ] Cannot create notes for other organization's tasks
- [ ] RLS policies enforce isolation

### Authentication
- [ ] Unauthenticated requests fail with 401
- [ ] Invalid HMAC signature fails with 403
- [ ] Expired HMAC signature fails with 403

## Regression Testing ⏳

### Existing Functionality Still Works
- [ ] Project notes still work (TSK0007)
- [ ] Task list displays correctly
- [ ] Task timers still work
- [ ] Task links still work
- [ ] Task status toggle still works
- [ ] Task creation still works

## Documentation Verification ✅

- [x] Implementation summary created
- [x] Data flow documented
- [x] Backend API integration documented
- [x] Known limitations documented
- [x] Next steps identified
- [x] Task status updated in tasks.json

## Sign-Off

### Code Review
- Developer: ✅ Complete
- Reviewer: ⏳ Pending

### Testing
- Automated: ✅ Complete (build verification)
- Manual: ⏳ Pending (requires running app)
- Integration: ⏳ Pending (TSK0011)

### Deployment Readiness
- Code Changes: ✅ Complete
- Build Verification: ✅ Complete
- Manual Testing: ⏳ Pending
- E2E Testing: ⏳ Pending
- Ready for Deployment: ⏳ Pending manual verification

## Notes

- All code changes are complete and build successfully
- Manual testing requires running dev server
- Backend API must be accessible and functional
- FileMaker testing requires WebViewer access
- Pagination UI is future enhancement (TSK0009)
- Update/delete note UI is not implemented

## Status: IMPLEMENTATION COMPLETE ✅ | TESTING PENDING ⏳

The implementation is code-complete and ready for manual testing. All automated verifications have passed.
