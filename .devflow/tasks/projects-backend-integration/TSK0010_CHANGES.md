# TSK0010: ProjectDetails Component Updates

## Summary
Updated ProjectDetails component and ProjectTeamTab to work with new backend API data structure by removing FileMaker `recordId` dependencies and standardizing on `project.id` for all operations.

## Key Changes

### 1. Status Toggle (ProjectDetails.jsx:72-122)
- **Before**: Used `project.recordId` → hook → API
- **After**: Uses `project.id` → hook (handles environment detection) → API
- Maintains optimistic UI updates with error rollback

### 2. Team Assignment (ProjectTeamTab.jsx:72-97)
- **Before**: Used `localProject.recordId`
- **After**: Uses `localProject.id`
- Hook internally resolves to correct ID based on environment

### 3. PropTypes (ProjectDetails.jsx:409-444)
- `id`: Now **required** (was optional)
- `recordId`: Now **optional** (was required)
- Added backend fields: `_custID`, `value`, `f_fixedPrice`, `f_subscription`, `dateStart`, `dateEnd`, `images`, `completion_percentage`

## Data Flow

```
Component (project.id) → Hook (env detection) → API (correct ID format)
                                               ├─ Webapp: UUID
                                               └─ FileMaker: recordId
```

## Backward Compatibility
- FileMaker environment still supported
- Hook handles ID resolution internally
- No breaking changes to parent components

## Testing
✅ Build compiles successfully
✅ Status toggle uses project.id
✅ Team assignment uses project.id
✅ PropTypes updated
✅ Error handling preserved
✅ Optimistic updates work correctly

## Files Modified
1. `src/components/projects/ProjectDetails.jsx` (status toggle, PropTypes)
2. `src/components/projects/ProjectTeamTab.jsx` (team assignment)
