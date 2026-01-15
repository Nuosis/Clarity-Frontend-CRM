# TSK0009: Business Logic Review - Fixed-Price and Subscription Projects

**Status**: Complete
**Date**: 2026-01-15
**Task ID**: TSK0009

## Overview

Reviewed and documented business logic for fixed-price and subscription projects in the useProject hook and projectService. Identified frontend-only logic that may benefit from backend migration in the future.

## Business Logic Components

### 1. Sales Entry Generation (`processProjectValue()`)

**Location**: `src/services/projectService.js` (lines 755-859)

**Purpose**: Generates customer_sales entries based on project type and dates

**Rules**:

#### Fixed-Price Projects (`f_fixedPrice = true`)
- **Billable Status**: All time records are non-billable (hours don't generate invoices)
- **Sales Generation**:
  - When `dateStart` is reached: Creates "sellable" entry for 50% of project value
  - When `dateEnd` is reached: Creates "sales" entry for remaining 50% of project value
- **Rationale**: Fixed-price projects bill based on milestones, not hourly tracking

#### Subscription Projects (`f_subscription = true`)
- **Sales Generation**:
  - For each month between `dateStart` and `dateEnd` (or today if no end date)
  - Creates monthly "sales" entry for the full project value
  - Skips future months beyond today
- **Rationale**: Subscription projects bill a recurring amount monthly

**Data Flow**:
```
Project Create/Update
  → processProjectValue(project, isUpdate)
  → Returns: { salesToCreate[], billableStatus }
  → createSalesFromProjectValue(project, organizationId)
  → Inserts to Supabase customer_sales table
```

**Current Implementation**: Frontend-only (direct Supabase writes via `salesService.js`)

### 2. Billable Status Updates (`updateProjectRecordsBillableStatus()`)

**Location**: `src/services/projectService.js` (lines 888-928)

**Purpose**: Bulk update billable status for all time records on a project

**Current Status**: NOT IMPLEMENTED (placeholder only)

**Expected Behavior**:
- Fixed-price projects: Set all time records to `is_billable = false`
- Regular projects: Time records remain billable

**Implementation Gap**:
- No backend endpoint for bulk billable status updates
- Options:
  1. Backend creates: `PATCH /api/time-entries/project/{project_id}/billable-status`
  2. Frontend uses: `GET /api/financial-records/query` + individual updates
  3. Backend adds: `PATCH /api/financial-records/mark-billable` (similar to mark-billed)

**Workaround**: Currently logs a warning and returns success with `implemented: false`

### 3. Sales Service Integration

**Location**: `src/services/salesService.js`

**Function**: `createSalesFromProjectValue(project, organizationId)` (lines 1065-1117)

**Process**:
1. Imports `processProjectValue` from projectService
2. Calls `processProjectValue(project)` to get sales entries
3. Adds `organization_id` to each entry
4. Calls `createSalesBatch(salesWithOrg)` to insert into Supabase

**Tables Affected**:
- `customer_sales` (Supabase): Receives all generated sales entries
  - Fields: `customer_id`, `amount`, `date`, `description`, `project_id`, `type`, `organization_id`

## Integration Points in useProject Hook

### Project Create (`handleProjectCreate`)

**Location**: `src/hooks/useProject.js` (lines 258-286)

**Flow**:
1. Validate and format project data
2. Create project via backend API
3. If fixed-price or subscription:
   - Call `processProjectValue(project, false)` to determine sales entries
   - Call `updateProjectRecordsBillableStatus()` (currently no-op)
   - Call `createSalesFromProjectValue()` to insert sales entries
4. Reload projects list

**Error Handling**: Sales entry errors logged but don't fail project creation

### Project Update (`handleProjectUpdate`)

**Location**: `src/hooks/useProject.js` (lines 337-369)

**Flow**:
1. Validate and format project data
2. Update project via backend API
3. If fixed-price or subscription:
   - Call `processProjectValue(project, true)` to determine new sales entries
   - Call `updateProjectRecordsBillableStatus()` (currently no-op)
   - Call `createSalesFromProjectValue()` to insert additional sales entries
4. Update local state

**Note**: `isUpdate = true` affects subscription logic (calculates months since start)

## Should This Logic Move to Backend?

### Arguments for Backend Migration

1. **Data Consistency**
   - Sales entries should be created atomically with project create/update
   - Backend can handle in a transaction
   - Avoids partial failures (project created, sales entries fail)

2. **Business Rule Centralization**
   - Logic lives in one place (backend)
   - Easier to maintain and audit
   - Prevents frontend-backend rule divergence

3. **Organization Scoping**
   - Backend already handles org scoping via JWT + RLS
   - More secure than frontend organization ID handling

4. **Billable Status Updates**
   - Backend has direct access to time records
   - Can implement bulk updates efficiently
   - Frontend would need multiple API calls

5. **Scalability**
   - Large subscription projects (many months) generate many sales entries
   - Backend can handle batch inserts more efficiently
   - Reduces frontend bundle size

### Arguments for Frontend Keep

1. **Flexibility**
   - Business rules can change without backend deployment
   - Faster iteration for business logic changes

2. **Existing Implementation**
   - Already works (except billable status)
   - Migration requires backend work

3. **User Visibility**
   - Frontend can provide immediate feedback on sales generation
   - Better error messages to users

### Recommendation: **Migrate to Backend**

**Rationale**:
- Business logic belongs on the server (source of truth)
- Billable status updates require backend anyway
- Transaction safety for data consistency
- Better security and audit trail

**Implementation Approach**:
1. Backend creates: `POST /api/projects` and `PUT /api/projects/{id}` with business logic
2. Backend calculates sales entries on create/update
3. Backend updates billable status atomically
4. Backend returns: `{ project, salesCreated[], billableStatusUpdated }`
5. Frontend removes sales generation logic from hook
6. Frontend displays backend-returned sales summary

## Current Status

### What Works
✅ Sales entry generation for fixed-price projects (50% on start, 50% on end)
✅ Sales entry generation for subscription projects (monthly recurring)
✅ Date-based sales triggering (only creates entries for past/current dates)
✅ Organization scoping for sales entries
✅ Error handling that doesn't fail project creation

### What Doesn't Work
❌ Billable status updates (not implemented)
❌ Transaction safety (project can succeed, sales can fail)
❌ Duplicate sales prevention (re-processing same project creates duplicates)
❌ Sales entry cleanup on project delete

### Frontend-Backend Split
- **Frontend**: Sales generation logic (processProjectValue, createSalesFromProjectValue)
- **Backend**: None (backend doesn't know about fixed-price or subscription rules)
- **Gap**: Business rules should ideally live on backend

## Testing Considerations

### Manual Testing Scenarios

1. **Fixed-Price Project**
   - Create project with `f_fixedPrice = true`, `value = 10000`, `dateStart = today`, `dateEnd = future`
   - Verify: 1 "sellable" entry created for $5000
   - Update `dateEnd = today`
   - Verify: 1 "sales" entry created for $5000

2. **Subscription Project**
   - Create project with `f_subscription = true`, `value = 1000`, `dateStart = 3 months ago`
   - Verify: 3 "sales" entries created ($1000 each, one per month)
   - Update to next month
   - Verify: 1 additional "sales" entry created

3. **Billable Status**
   - Create fixed-price project
   - Add time entries to project
   - Verify: Time entries should be non-billable (currently not working)

4. **Error Handling**
   - Create project without organization ID
   - Verify: Project created, warning logged about missing sales entries

## Logging and Debugging

### Console Output Patterns

```javascript
[Business Logic] Processing fixed-price or subscription project
[Business Logic] Generated 2 sales entries, billable status: false
[Business Logic] Billable status update not implemented - may require manual updates
[Business Logic] Created 2 sales entries
```

### Error Messages

```javascript
[Business Logic] Failed to create sales entries: {error}
[Business Logic] Error creating sales entries: {error}
[Business Logic] No organization ID available - skipping sales entry creation
```

## Files Modified

1. **src/services/projectService.js**
   - Updated `updateProjectRecordsBillableStatus()` with detailed comments
   - Added implementation status documentation
   - Added error handling and logging

2. **src/hooks/useProject.js**
   - Added business logic logging to `handleProjectCreate()`
   - Added business logic logging to `handleProjectUpdate()`
   - Improved error handling for sales entry failures
   - Added warnings for unimplemented billable status updates

3. **Documentation Created**
   - This file: `TSK0009_BUSINESS_LOGIC_REVIEW.md`

## Next Steps (Future Work)

### Immediate (Frontend)
1. Document the duplicate sales prevention issue
2. Add user-facing warnings when billable status update fails
3. Consider adding UI indicator for projects with pending sales entries

### Short-Term (Backend Coordination)
1. Create Backend Change Request for business logic migration
2. Propose endpoint: `POST /api/projects` with sales generation
3. Propose endpoint: `PATCH /api/time-entries/project/{id}/billable-status`
4. Discuss duplicate prevention strategy (idempotency)

### Long-Term (Refactoring)
1. Migrate business logic to backend
2. Remove sales generation from frontend hook
3. Add sales entry display in project UI
4. Add rollback handling for failed project operations

## Related Tasks

- **TSK0007**: CRUD operations (uses this business logic)
- **TSK0010**: ProjectDetails component (may need to display sales entries)
- **TSK0015**: Tests (should add business logic test coverage)

## Conclusion

The fixed-price and subscription business logic is functional but lives entirely in the frontend. The billable status update is not implemented. Both features would benefit from backend migration for better data consistency, security, and maintainability.

The current implementation is adequate for the immediate migration from FileMaker to backend API, but should be flagged for future backend refactoring.
