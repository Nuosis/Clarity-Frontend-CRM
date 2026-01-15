# TSK0007 Quick Reference - Task List Components

## What Changed

### Field Name Updates
| Component Display | Old (FileMaker) | New (Backend) | Solution |
|-------------------|-----------------|---------------|----------|
| Task Title | `task.task` | `task.title` | `task.title \|\| task.task` |
| Project ID | `_projectID` | `project_id` | Both fields populated |
| Staff ID | `_staffID` | `staff_id` | Both fields populated |
| Completed | `isCompleted` (0/1) | `isCompleted` (boolean) | Normalized to boolean |
| Task Type | `type` | `task_type` | Mapped to `type` |

### Files Modified
1. **src/components/tasks/TaskList.jsx**
   - Line 74: Display logic updated
   - Lines 243-264: PropTypes updated
   - Lines 434-468: Task creation updated

2. **src/services/taskService.js**
   - Lines 328-350: Backend data processing
   - Lines 358-372: FileMaker data processing

## Usage Examples

### Display Task Title
```jsx
// ✅ Correct - Works with both backends
<h4>{task.title || task.task}</h4>

// ❌ Old - Only works with FileMaker
<h4>{task.task}</h4>
```

### Create New Task
```javascript
// ✅ Correct - Works with both backends
await handleTaskCreate({
    project_id: projectId,
    staff_id: staffId,
    title: taskName,
    priority: 3, // Integer 1-5
    // Legacy fields for backward compatibility
    _projectID: projectId,
    _staffID: staffId,
    taskName: taskName
});

// ❌ Old - Only works with FileMaker
await handleTaskCreate({
    _projectID: projectId,
    _staffID: staffId,
    taskName: taskName,
    priority: "active" // String
});
```

### Task Data Structure
```javascript
// Internal format (after processing)
{
    id: "uuid",
    recordId: "uuid",
    task: "Task title", // Legacy
    title: "Task title", // New
    type: "General",
    isCompleted: false,
    createdAt: "2026-01-14T...",
    modifiedAt: "2026-01-14T...",
    _projectID: "uuid",
    _staffID: "uuid",
    description: "...",
    dueDate: "2026-01-20",
    priority: 3,
    status: "pending"
}
```

## Task Grouping

```javascript
// How it works
const { activeTasks, completedTasks } = useMemo(() => {
    const grouped = groupTasksByStatus(tasks || []);
    return {
        activeTasks: grouped.active || [],
        completedTasks: grouped.completed || []
    };
}, [tasks]);

// Grouping logic
tasks.forEach(task => {
    const key = task.isCompleted ? 'completed' : 'active';
    groups[key].push(task);
});
```

## Not Implemented (Future)

### Pagination
```javascript
// Backend supports (not in UI yet):
GET /tasks?project_id={id}&limit=50&offset=0
```

### Filtering
```javascript
// Backend supports (not in UI yet):
GET /tasks?project_id={id}&status=pending&staff_id={id}
```

### Sorting
```javascript
// Backend supports (not in UI yet):
GET /tasks?project_id={id}&sort_by=priority&order=desc
```

## Feature Flag

```javascript
// In src/api/tasks.js
const USE_BACKEND_API = true;

// true = New backend API
// false = FileMaker fallback
```

## Common Issues

### Issue: Task title not displaying
**Solution:** Check that `processTaskData` populates both `task` and `title` fields

### Issue: Task creation fails with validation error
**Solution:** Ensure priority is integer 1-5, not string "active"/"high"/"low"

### Issue: Tasks not grouping correctly
**Solution:** Verify `isCompleted` is boolean, not string "0"/"1"

## Next Steps

See **TSK0008** for task detail component updates including:
- Display new fields (description, due date, priority, status)
- Timer pause/resume state
- Enhanced error messages
- Financial record display
