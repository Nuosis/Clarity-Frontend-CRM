# ClarityFrontend Architecture Documentation

## Overview
This document outlines the architecture and implementation details for the ClarityFrontend CRM system. The frontend is built using React with Tailwind CSS, featuring a responsive design with dark/light mode support.

## Data Flow & State Management

### State Structure
```javascript
{
  user: {
    userID,        // string
    userName,      // string
    teamID: []     // array of strings
  },
  customers: {
    response: {
      dataInfo: {}, // metadata
      data: []      // array of customer objects
    }
  },
  projects: [],     // array of project objects
  tasks: null,      // array of task objects or null
  selectedProject: null,  // project object or null
  selectedCustomer: null, // customer object or null
  selectedTask: null,     // task object or null
  activeCustomers: [],    // array of active customer objects
  timer: null            // timer object or null
}
```

### State Flow
1. **Initial Load**
   - Load user data and teams
   - Fetch active customers
   - Initialize empty selections

2. **Customer Selection**
   - Update selectedCustomer
   - Fetch customer's projects
   - Clear selectedProject and selectedTask

3. **Project Selection**
   - Update selectedProject
   - Fetch project's tasks
   - Clear selectedTask

4. **Task Selection**
   - Update selectedTask
   - Initialize timer if needed

### FileMaker Integration
All data operations route through fetchDataFromFileMaker:

1. **Read Operations**
   ```javascript
   {
     layout: "devCustomers|devProjects|devTasks",
     action: "read",
     query: {}
   }
   ```

2. **Write Operations**
   ```javascript
   {
     layout: "devCustomers|devProjects|devTasks",
     action: "create|update|delete",
     fieldData: {}
   }
   ```

3. **Timer Operations**
   ```javascript
   {
     layout: "devRecords",
     action: "create|update",
     fieldData: {
       startTime: "",    // timestamp
       endTime: "",      // timestamp
       description: ""   // string
     }
   }
   ```

## Component Architecture

### Layout Components
1. **AppLayout** (`src/components/layout/AppLayout.jsx`)
   - Manages dark/light mode context
   - Handles responsive layout
   ```javascript
   // Example props
   {
     darkMode: false,
     toggleDarkMode: function()
   }
   ```

2. **Sidebar** (`src/components/layout/Sidebar.jsx`)
   - Fixed 200px width
   - Manages customer list and project submenus
   ```javascript
   // Example props
   {
     customers: [],
     selectedCustomer: null,
     onCustomerSelect: function(customer)
   }
   ```

### Customer Components
1. **CustomerList** (`src/components/customers/CustomerList.jsx`)
   - Renders active customers first
   - Handles customer selection
   ```javascript
   // Example props
   {
     customers: [],
     onSelect: function(customer),
     selectedId: null
   }
   ```

2. **CustomerDetails** (`src/components/customers/CustomerDetails.jsx`)
   - CRUD operations for customer data
   - Manages customer notes
   ```javascript
   // Example props
   {
     customer: {},
     onUpdate: function(data),
     onDelete: function(id)
   }
   ```

3. **CustomerNotes** (`src/components/customers/CustomerNotes.jsx`)
   - Note management interface
   ```javascript
   // Example props
   {
     customerId: "",
     notes: [],
     onAddNote: function(note),
     onUpdateNote: function(id, data)
   }
   ```

### Project Components
1. **ProjectList** (`src/components/projects/ProjectList.jsx`)
   - Displays in sidebar under customer
   ```javascript
   // Example props
   {
     projects: [],
     onSelect: function(project),
     selectedId: null
   }
   ```

2. **ProjectDetails** (`src/components/projects/ProjectDetails.jsx`)
   - CRUD operations for projects
   - Team assignment interface
   ```javascript
   // Example props
   {
     project: {},
     teams: [],
     onUpdate: function(data),
     onAssignTeam: function(teamId)
   }
   ```

### Task Components
1. **TaskList** (`src/components/tasks/TaskList.jsx`)
   - Displays project tasks
   ```javascript
   // Example props
   {
     tasks: [],
     onSelect: function(task),
     selectedId: null
   }
   ```

2. **TaskTimer** (`src/components/tasks/TaskTimer.jsx`)
   - Timer controls and state
   ```javascript
   // Example props
   {
     task: {},
     onStart: function(),
     onPause: function(),
     onStop: function(withSave),
     onAdjust: function(minutes)
   }
   ```

## Implementation Phases

### Phase 1: Foundation (Week 1)
1. Project setup with Vite and Tailwind [done]
2. Layout components implementation
3. Dark/light mode system
4. FileMaker service integration [partical]

### Phase 2: Customer Management (Week 2)
1. Customer list and selection
2. Customer details view
3. Customer notes system
4. CRUD operations

### Phase 3: Project Management (Week 2-3)
1. Project list in sidebar
2. Project details view
3. Team assignment system
4. Project notes
5. CRUD operations

### Phase 4: Task Management (Week 3-4)
1. Task list implementation
2. Task details view
3. Task notes system
4. CRUD operations

### Phase 5: Timer System (Week 4)
1. Timer component
2. Start/stop/pause controls
3. Time adjustment
4. Completion notes
5. FileMaker integration

## Error Handling
```javascript
// API Error Handling
try {
  await fetchDataFromFileMaker(params);
} catch (error) {
  handleApiError(error);
}

// State Update Error Handling
const updateState = (newData) => {
  try {
    validateData(newData);
    setState(newData);
  } catch (error) {
    handleStateError(error);
  }
};
```

## Testing Strategy
1. **Component Tests**
   - Render tests
   - User interaction tests
   - State management tests

2. **Integration Tests**
   - API integration
   - State flow
   - Error handling

3. **Timer Tests**
   - Start/stop/pause
   - Time adjustment
   - CMD+stop behavior

## Performance Optimizations
```javascript
// Component Optimization
const MemoizedComponent = React.memo(Component, (prevProps, nextProps) => {
  return prevProps.id === nextProps.id;
});

// State Management
const selectiveUpdate = (data) => {
  setState(prev => ({
    ...prev,
    [data.key]: data.value
  }));
};
```

## Security Considerations
1. Data validation before API calls
2. Proper error handling
3. Secure state management
4. Input sanitization
5. API request verification

## Future Enhancements
1. Advanced filtering system
2. Batch operations
3. Enhanced reporting
4. Additional timer features
5. Team collaboration tools