# ClarityFrontend Implementation Documentation

## Overview
ClarityFrontend is a React-based CRM system that provides customer, project, and task management capabilities with integrated time tracking. The application uses Tailwind CSS for styling and supports both light and dark modes.

## Component Structure

### Layout Components
1. **AppLayout** (`src/components/layout/AppLayout.jsx`)
   - Manages the application's layout structure
   - Provides dark/light mode context
   - Fixed 200px sidebar with main content area
   - Responsive design support

2. **Sidebar** (`src/components/layout/Sidebar.jsx`)
   - Displays customer list
   - Groups customers by active/inactive status
   - Handles customer selection

### Customer Management
1. **CustomerDetails** (`src/components/customers/CustomerDetails.jsx`)
   - Displays customer information
   - Shows customer projects
   - Handles project selection
   - Displays contact and account details

### Project Management
1. **ProjectDetails** (`src/components/projects/ProjectDetails.jsx`)
   - Displays project information
   - Manages project status
   - Shows project objectives and steps
   - Integrates task management
   - Displays project resources (links and images)

### Task Management
1. **TaskList** (`src/components/tasks/TaskList.jsx`)
   - Displays project tasks
   - Groups tasks by completion status
   - Provides task creation and editing
   - Handles task status changes

2. **TaskForm** (`src/components/tasks/TaskForm.jsx`)
   - Modal form for task creation/editing
   - Manages task details and notes
   - Handles form validation
   - Provides cancel/submit actions

3. **TaskTimer** (`src/components/tasks/TaskTimer.jsx`)
   - Provides timer controls (start/stop/pause)
   - Supports time adjustments (±6 minutes)
   - Special handling for CMD+stop
   - Captures task completion notes

## Data Flow

### State Management
```javascript
{
  user: {
    userID: string,
    userName: string,
    teamID: string[]
  },
  customers: {
    response: {
      dataInfo: {...},
      data: Customer[]
    }
  },
  projects: Project[],
  tasks: Task[] | null,
  selectedProject: Project | null,
  selectedCustomer: Customer | null,
  selectedTask: Task | null,
  activeCustomers: Customer[],
  timer: Timer | null
}
```

### Data Loading Sequence
1. Initial Load
   - Fetch user context
   - Load customer data
   - Process active customers
   - Load projects for active customers
   - Load project-related data (images, links, objectives)

2. Selection Flow
   - Customer selection triggers project load
   - Project selection loads tasks
   - Task selection initializes timer

### FileMaker Integration

1. **Data Fetching**
   ```javascript
   fetchDataFromFileMaker(callback, {
     layout: "devCustomers|devProjects|devTasks",
     action: "read",
     query: {...}
   });
   ```

2. **Data Creation**
   ```javascript
   fetchDataFromFileMaker(callback, {
     layout: "devTasks",
     action: "create",
     fieldData: {...}
   });
   ```

3. **Data Updates**
   ```javascript
   fetchDataFromFileMaker(callback, {
     layout: "devTasks",
     action: "update",
     recordId: "id",
     fieldData: {...}
   });
   ```

## Feature Implementation

### Dark Mode Support
- Theme context provides dark mode state
- Consistent styling across components
- Tailwind classes for theme switching
- Persistent theme preference

### Task Management
1. **Task Creation**
   - Modal form interface
   - Required fields validation
   - Project association
   - Immediate state updates

2. **Task Updates**
   - In-place editing
   - Status toggling
   - Notes management
   - FileMaker synchronization

3. **Task Timer**
   - Accurate time tracking
   - Pause/resume support
   - Time adjustments
   - Completion notes
   - FileMaker record creation

### Project Management
1. **Project Status**
   - Open/Closed status toggle
   - Status color indicators
   - FileMaker synchronization

2. **Project Resources**
   - Links management
   - Image display
   - Objective tracking
   - Step completion

## Usage Guidelines

### Customer Management
1. Select customers from sidebar
2. View customer details
3. Access customer projects
4. View contact information

### Project Management
1. Select project from customer view
2. Update project status
3. Manage project objectives
4. Create/edit tasks
5. View project resources

### Task Management
1. Create new tasks
2. Update task status
3. Add task notes
4. Track time on tasks
5. Complete tasks with descriptions

### Time Tracking
1. Start timer on task
2. Pause/resume as needed
3. Adjust time if required
4. Use CMD+stop for quick save
5. Add completion notes

## Error Handling
1. FileMaker Connection
   ```javascript
   try {
     await fetchDataFromFileMaker(params);
   } catch (error) {
     console.error("FileMaker error:", error);
   }
   ```

2. State Updates
   ```javascript
   try {
     validateData(newData);
     setState(newData);
   } catch (error) {
     console.error("State update error:", error);
   }
   ```

## Performance Considerations
1. Efficient state updates
2. Memoized components
3. Optimized re-renders
4. Proper error boundaries
5. Loading states

## Future Enhancements
1. Task filtering and sorting
2. Batch operations
3. Enhanced reporting
4. Team collaboration
5. Advanced timer features

## Maintenance
1. Keep FileMaker layouts in sync
2. Update state structure as needed
3. Maintain component documentation
4. Monitor error logs
5. Update styling as required