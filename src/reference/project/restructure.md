# Code Restructuring Plan

## Directory Structure
```
src/
├── api/
│   ├── fileMaker.js         # FileMaker integration
│   ├── customers.js         # Customer-related API calls
│   ├── projects.js          # Project-related API calls
│   └── tasks.js            # Task-related API calls
├── services/
│   ├── customerService.js   # Customer data processing
│   ├── projectService.js    # Project data processing
│   └── taskService.js       # Task data processing
├── hooks/
│   ├── useCustomer.js       # Customer-related state & handlers
│   ├── useProject.js        # Project-related state & handlers
│   ├── useTask.js          # Task-related state & handlers
│   └── useTimer.js         # Timer-related state & handlers
└── components/             # (existing component structure)
```

## API Layer (src/api/)

### fileMaker.js
```javascript
// Base FileMaker integration
export async function fetchDataFromFileMaker(params) {
    const formattedParams = formatParams(params);
    // ... implementation
}

export function formatParams(params) {
    // Parameter normalization
}
```

### customers.js
```javascript
import { fetchDataFromFileMaker } from './fileMaker';

export async function fetchCustomers() {
    // Customer-specific API calls
}

export async function updateCustomer(customerId, data) {
    // Customer update logic
}
```

### projects.js
```javascript
import { fetchDataFromFileMaker } from './fileMaker';

export async function fetchProjectsForCustomer(customerId) {
    // Project-specific API calls
}

export async function updateProject(projectId, data) {
    // Project update logic
}
```

### tasks.js
```javascript
import { fetchDataFromFileMaker } from './fileMaker';

export async function fetchTasksForProject(projectId) {
    // Task-specific API calls
}

export async function createTask(taskData) {
    // Task creation logic
}
```

## Services Layer (src/services/)

### customerService.js
```javascript
export function processCustomerData(data) {
    // Customer data processing
}

export function filterActiveCustomers(customers) {
    // Active customer filtering
}
```

### projectService.js
```javascript
export function processProjectData(projectData, relatedData) {
    // Project data processing
}

export function enrichProjectWithTasks(project, tasks) {
    // Project-task relationship handling
}
```

### taskService.js
```javascript
export function processTaskData(data) {
    // Task data processing
}

export function calculateTaskDuration(startTime, endTime) {
    // Task time calculations
}
```

## Hooks Layer (src/hooks/)

### useCustomer.js
```javascript
export function useCustomer() {
    const [customers, setCustomers] = useState(null);
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    // Customer-related state management and handlers
    return {
        customers,
        selectedCustomer,
        handleCustomerSelect,
        // ... other customer-related functions
    };
}
```

### useProject.js
```javascript
export function useProject() {
    const [projects, setProjects] = useState(null);
    const [selectedProject, setSelectedProject] = useState(null);

    // Project-related state management and handlers
    return {
        projects,
        selectedProject,
        handleProjectSelect,
        handleProjectStatusChange,
        // ... other project-related functions
    };
}
```

### useTask.js
```javascript
export function useTask() {
    const [tasks, setTasks] = useState(null);
    const [selectedTask, setSelectedTask] = useState(null);

    // Task-related state management and handlers
    return {
        tasks,
        selectedTask,
        handleTaskCreate,
        handleTaskUpdate,
        handleTaskStatusChange,
        // ... other task-related functions
    };
}
```

### useTimer.js
```javascript
export function useTimer() {
    const [timer, setTimer] = useState(null);

    // Timer-related state management and handlers
    return {
        timer,
        handleTimerStart,
        handleTimerPause,
        handleTimerStop,
        handleTimerAdjust,
    };
}
```

## Updated App Component (src/index.jsx)
```javascript
function App() {
    const { darkMode } = useTheme();
    const { 
        customers, 
        selectedCustomer, 
        handleCustomerSelect 
    } = useCustomer();
    
    const { 
        projects, 
        selectedProject, 
        handleProjectSelect,
        handleProjectStatusChange 
    } = useProject();
    
    const {
        tasks,
        selectedTask,
        handleTaskCreate,
        handleTaskUpdate,
        handleTaskStatusChange
    } = useTask();
    
    const {
        timer,
        handleTimerStart,
        handleTimerPause,
        handleTimerStop,
        handleTimerAdjust
    } = useTimer();

    // Render UI with hooks providing all functionality
    return (
        <AppLayout>
            <Sidebar
                customers={customers}
                selectedCustomer={selectedCustomer}
                onCustomerSelect={handleCustomerSelect}
            />
            <MainContent
                selectedCustomer={selectedCustomer}
                selectedProject={selectedProject}
                selectedTask={selectedTask}
                // ... other props
            />
        </AppLayout>
    );
}
```

## Benefits of This Structure

1. **Separation of Concerns**
   - Each layer has a specific responsibility
   - Code is more maintainable and testable
   - Easier to understand and modify

2. **Reusability**
   - API functions can be used across different components
   - Services can be shared between different features
   - Hooks encapsulate common state management patterns

3. **Testing**
   - Each layer can be tested independently
   - Mocking becomes easier with clear boundaries
   - Unit tests can focus on specific functionality

4. **Scalability**
   - New features can be added without modifying existing code
   - Easy to add new API endpoints or services
   - State management can be extended without complexity

5. **Maintenance**
   - Bugs are easier to isolate and fix
   - Changes are contained within specific modules
   - Documentation is clearer and more focused

## Implementation Steps

1. Create new directory structure
2. Move FileMaker integration to API layer
3. Extract data processing to services
4. Create custom hooks for state management
5. Update main App component to use new structure
6. Update tests and documentation
7. Verify all functionality works as before

## Future Considerations

1. **State Management**
   - Could be extended to use Redux if needed
   - Easy to add caching layer
   - Simple to implement optimistic updates

2. **API Layer**
   - Could add request queuing
   - Easy to implement retry logic
   - Simple to add request caching

3. **Services**
   - Could add validation layer
   - Easy to implement data transformation
   - Simple to add business logic

4. **Testing**
   - Can add integration tests
   - Easy to mock API responses
   - Simple to test state management