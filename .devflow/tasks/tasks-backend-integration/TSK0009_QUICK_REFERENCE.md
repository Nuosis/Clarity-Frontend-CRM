# TSK0009 Quick Reference - Task Form Components

## Using TaskForm Component

### Create New Task
```jsx
import TaskForm from './components/tasks/TaskForm';

<TaskForm
  projectId="uuid-here"
  customerId="uuid-here"
  staffId="uuid-here" // optional
  onSubmit={async (taskData) => {
    await createTask(taskData);
  }}
  onCancel={() => setShowForm(false)}
/>
```

### Edit Existing Task
```jsx
<TaskForm
  projectId="uuid-here"
  customerId="uuid-here"
  staffId="uuid-here" // optional
  task={existingTask} // Pre-populate form
  onSubmit={async (taskData) => {
    await updateTask(taskData);
  }}
  onCancel={() => setEditMode(false)}
/>
```

## Task Form Fields

### Required Fields
- **title** - String, 1-255 characters
- **project_id** - UUID (from props)
- **customer_id** - UUID (from props)

### Optional Fields
- **priority** - Integer 1-5 (default: 3)
  - 1: Highest
  - 2: High
  - 3: Normal
  - 4: Low
  - 5: Lowest
- **status** - Enum (default: 'pending')
  - pending
  - in_progress
  - completed
  - cancelled
- **task_type** - String (e.g., "Development", "Design")
- **estimated_hours** - Number ≥0
- **due_date** - ISO date (YYYY-MM-DD)
- **notes** - Text

## Payload Format

TaskForm sends both new backend and legacy FileMaker fields:

```javascript
{
  // New backend schema
  project_id: "uuid",
  customer_id: "uuid",
  title: "Task Title",
  priority: 3,
  status: "pending",

  // Legacy FileMaker schema
  _projectID: "uuid",
  _custID: "uuid",
  task: "Task Title",
  taskName: "Task Title",

  // Optional fields (only if provided)
  staff_id: "uuid",
  task_type: "Development",
  notes: "Task details...",
  estimated_hours: 8.5,
  due_date: "2026-01-20"
}
```

## Error Handling

### Field-Level Errors
```javascript
{
  title: "field required",
  priority: "ensure this value is between 1 and 5",
  status: "value is not a valid enumeration member"
}
```

Displayed below each field in red.

### General Errors
```javascript
{
  general: "Failed to save task. Please try again."
}
```

Displayed at top of form in error banner.

### Backend Validation Errors (FastAPI)
```json
{
  "detail": [
    {
      "loc": ["body", "title"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

Automatically parsed to field-level errors.

## TaskList Integration

### Props
```jsx
<TaskList
  projectId="uuid-here"
  customerId="uuid-here" // optional - will resolve from selectedProject
  onTaskStatusChange={(taskId, completed) => {}}
  onTaskUpdate={(taskId, taskData) => {}}
/>
```

### Customer ID Resolution
```javascript
// Priority order:
1. customerId prop
2. selectedProject.customer_id (backend)
3. selectedProject._custID (FileMaker)
```

### New Task Button
- Enabled when projectId and customerId available
- Disabled when requirements not met
- Opens TaskForm modal

## Validation

### Client-Side
```javascript
import { validateTaskData } from '../../services/taskService';

const validation = validateTaskData(taskData, { isUpdate: false });
if (!validation.isValid) {
  setErrors(validation.fieldErrors);
}
```

### Backend
- Final validation by backend API
- Errors parsed and displayed in form
- User can correct and resubmit

## Common Patterns

### Show Form on Button Click
```javascript
const [showForm, setShowForm] = useState(false);

<button onClick={() => setShowForm(true)}>
  New Task
</button>

{showForm && (
  <TaskForm
    projectId={projectId}
    customerId={customerId}
    onSubmit={handleSubmit}
    onCancel={() => setShowForm(false)}
  />
)}
```

### Handle Submit with Success Message
```javascript
const handleSubmit = async (taskData) => {
  try {
    await createTask(taskData);
    setShowForm(false);
    showSuccess('Task created successfully');
  } catch (error) {
    // Error handled by TaskForm
    throw error;
  }
};
```

### Pre-populate Edit Form
```javascript
const [editingTask, setEditingTask] = useState(null);

<button onClick={() => setEditingTask(task)}>
  Edit
</button>

{editingTask && (
  <TaskForm
    projectId={projectId}
    customerId={customerId}
    task={editingTask}
    onSubmit={handleUpdate}
    onCancel={() => setEditingTask(null)}
  />
)}
```

## Styling

### Dark Mode Support
Form automatically adapts to dark mode via `useTheme()` hook.

### Custom Styling
TaskForm uses Tailwind CSS classes. To customize:
```jsx
className={`
  w-full p-2 rounded-md border
  ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
  ${errors.field ? 'border-red-500' : ''}
`}
```

## Accessibility

- Auto-focus on title field
- Required fields marked with asterisk (*)
- Proper label associations
- Disabled state during submission
- Clear error messaging
- Keyboard navigation support

## Performance

- React.memo for component memoization
- Controlled form inputs
- Error clearing on input change
- Callback memoization in parent component

## Troubleshooting

### "New Task" Button Disabled
**Cause:** Missing projectId or customerId
**Solution:** Ensure TaskList receives projectId and has access to selectedProject context

### Validation Errors Not Showing
**Cause:** Backend errors not in expected format
**Solution:** Check error.response.data.detail structure

### Form Not Closing After Submit
**Cause:** Error thrown but not caught
**Solution:** Ensure onSubmit handler in parent catches and re-throws errors

### Fields Not Pre-populating in Edit Mode
**Cause:** Task object missing expected fields
**Solution:** Check task object has title/task, priority, status, etc.

## Testing

### Manual Test Checklist
- [ ] Create task with required fields only
- [ ] Create task with all fields
- [ ] Edit existing task
- [ ] Submit empty form (validation)
- [ ] Submit with invalid priority
- [ ] Submit with invalid status
- [ ] Backend validation error handling
- [ ] Dark mode rendering
- [ ] Cancel button works
- [ ] Form closes on success
- [ ] Errors clear when typing

### Integration Points
- useTask hook
- taskService.js
- api/tasks.js
- AppStateContext (selectedProject)
- SnackBarContext (error messages)

---

**Last Updated:** 2026-01-14
**Related Tasks:** TSK0006, TSK0007, TSK0008
