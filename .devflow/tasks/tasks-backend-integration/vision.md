# Tasks Backend Integration - Feature Vision

## Overview

Migrate the Tasks and Timer feature from FileMaker-based implementation to the new Supabase-backed backend APIs. The backend has implemented 12 REST endpoints following the requirements documented in `requirements/tasks/BACKEND_CHANGE_REQUEST_001_TASKS_API.md`. This feature integrates the frontend with these new endpoints, replacing all FileMaker dependencies.

## Goals

1. **Replace FileMaker API calls** with new backend endpoints for all task operations
2. **Update data model mapping** from FileMaker schema to Supabase schema
3. **Implement new timer semantics** including idempotency, concurrency control, and pause/resume
4. **Integrate financial record generation** on timer stop (with fixed-price project detection)
5. **Update UI components** to handle new data shapes and error responses
6. **Add comprehensive error handling** for all new API endpoints
7. **Update tests** with new mocks, fixtures, and test cases

## Success Criteria

- ✅ All task CRUD operations work against new backend endpoints
- ✅ Timer start/stop/pause/resume operations succeed with proper state management
- ✅ Financial records are created correctly when timers stop (respecting fixed-price projects)
- ✅ Concurrency control prevents multiple active timers per staff
- ✅ Task list and detail pages load and display correctly
- ✅ Form validations match new backend requirements
- ✅ Filtering, sorting, and pagination work as expected
- ✅ Error messages are user-friendly and actionable
- ✅ All existing tests pass with updated mocks
- ✅ New test cases cover new business logic

## Technical Approach

### Phase 1: API Layer Refactor
- Replace FileMaker API calls in `src/api/tasks.js` with new backend endpoint calls
- Implement HMAC authentication for all requests (already supported by `dataService.js`)
- Add request/response mappers for schema differences
- Handle new error response format

### Phase 2: Service Layer Updates
- Update `src/services/taskService.js` to use new data shapes
- Implement timer idempotency logic (check for existing active timer)
- Add financial record creation integration on timer stop
- Update validation logic to match new backend requirements

### Phase 3: Component Updates
- Find and update all task-related components
- Update task list views to handle new pagination/filtering
- Update task detail views to display new fields
- Update task forms to match new schema
- Update timer UI to support pause/resume
- Add better loading states and error displays

### Phase 4: Test Updates
- Update mocks to match new API responses
- Update fixtures with new data shapes
- Add test cases for timer concurrency control
- Add test cases for financial record generation
- Add test cases for idempotency
- Add edge case tests (race conditions, partial failures)

### Phase 5: Integration Testing
- Test complete task lifecycle (create → start timer → stop timer → verify financial record)
- Test fixed-price project behavior (no financial record created)
- Test concurrent timer scenarios
- Test error scenarios and recovery

## Files to Modify

### API Layer
- `src/api/tasks.js` - Replace all FileMaker calls with backend endpoint calls

### Service Layer
- `src/services/taskService.js` - Update business logic for new data model

### Hooks (to be identified)
- `src/hooks/useTask.js` (if exists)
- `src/hooks/useTimer.js` (if exists)
- Or relevant hooks that manage task state

### Components (to be identified)
- Task list components
- Task detail components
- Task form components
- Timer components
- Related note/link components

### Tests
- `__tests__/api/tasks.test.js` (if exists)
- `__tests__/services/taskService.test.js` (if exists)
- `__tests__/components/tasks/*.test.js` (if exists)
- Mocks and fixtures directories

## Dependencies

- Backend tasks migration MUST be complete and deployed
- Backend endpoints MUST be accessible at `https://api.claritybusinesssolutions.ca/api/tasks`
- New database tables (`tasks`, `task_timers`) MUST exist in Supabase
- Financial records endpoints MUST be available for dual-write on timer stop

## Risks

1. **Data model mismatch**: Frontend assumptions may not match actual backend implementation
2. **Timer concurrency**: Race conditions during simultaneous timer starts
3. **Financial record failures**: Timer stops but financial record creation fails
4. **Performance**: New endpoints may have different performance characteristics
5. **ID mapping**: Converting between FileMaker IDs and Supabase UUIDs

## Mitigation Strategies

1. Thorough testing against dev/staging backend before production
2. Implement retry logic for financial record creation
3. Add comprehensive logging for debugging
4. Gradual rollout with feature flag if possible
5. Keep FileMaker fallback code temporarily for quick rollback
