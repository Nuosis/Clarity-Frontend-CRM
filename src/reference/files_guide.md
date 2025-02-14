# ClarityFrontend Reference Files Guide

## Overview
This guide explains the purpose and usage of reference files in the ClarityFrontend project, detailing how they work together to create a cohesive system.

## Core Reference Files

### State Management (state.json)
Defines the application's state structure:
```javascript
{
  user: {
    userID: "",        // string
    userName: "",      // string
    teamID: []         // array of strings
  },
  customers: {
    response: {
      dataInfo: {},    // metadata
      data: []         // array of customer objects
    }
  },
  projects: [],        // array of project objects
  tasks: null,         // array of task objects or null
  selectedProject: null,    // project object or null
  selectedCustomer: null,   // customer object or null
  selectedTask: null,       // task object or null
  activeCustomers: [],      // array of active customer objects
  timer: null              // timer object or null
}
```

Key Features:
- Hierarchical data structure (Customers → Projects → Tasks)
- Selection state tracking
- Active/inactive customer filtering
- Timer state management

### API Integration (fetchParams.md)
Documents FileMaker API patterns:

1. **Read Operations**
   ```javascript
   {
     layout: "devCustomers",
     action: "read",
     query: {
       f_active: 1
     }
   }
   ```

2. **Create Operations**
   ```javascript
   {
     layout: "devTasks",
     action: "create",
     fieldData: {
       task: "",     // task description
       type: ""      // task type
     }
   }
   ```

3. **Update Operations**
   ```javascript
   {
     layout: "devTasks",
     action: "update",
     recordId: "",   // record identifier
     fieldData: {}   // fields to update
   }
   ```

4. **Delete Operations**
   ```javascript
   {
     layout: "devTasks",
     action: "delete",
     recordId: ""    // record identifier
   }
   ```

### Layouts (layouts.md)
Available FileMaker layouts:

1. **Data API Layouts**
   - dapiRecords: Base record access
   - dapiProjects: Project management
   - dapiTasks: Task management
   - dapiTeams: Team management

2. **Development Layouts**
   - devCustomers: Customer CRUD
   - devProjects: Project CRUD
   - devTasks: Task CRUD
   - devNotes: Notes management
   - devRecords: Time tracking
   - devTeams: Team management

3. **Utility Layouts**
   - devHTML: Content management
   - devImage: Image handling
   - devLinks: Link management
   - devMessages: Communication
   - devOrganization: Settings
   - devTwillio: External integration

### Architecture (architecture.md)
Comprehensive system documentation:
1. Component structure and hierarchy
2. State management patterns
3. Data flow
4. Implementation phases
5. Testing strategy
6. Performance considerations

## Usage Guidelines

### State Management
1. Follow the state structure in state.json
2. Maintain proper entity relationships
3. Handle selection states appropriately
4. Manage timer state carefully

### API Integration
1. Route all calls through fetchDataFromFileMaker
2. Use appropriate layouts for operations
3. Follow JSON structures in fetchParams.md
4. Implement proper error handling

### Layout Selection
1. Use Data API layouts for basic CRUD
2. Development layouts for specific functionality
3. Utility layouts for supporting features

## Best Practices

### Development Workflow
1. Consult architecture.md for component structure
2. Reference state.json for state management
3. Use fetchParams.md for API integration
4. Select appropriate layouts from layouts.md

### Code Organization
```javascript
// Component Example
function CustomerList({ customers, onSelect, selectedId }) {
  return (
    <div className="customer-list">
      {customers.map(customer => (
        <CustomerItem
          key={customer.__ID}
          customer={customer}
          isSelected={customer.__ID === selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

// API Call Example
async function fetchCustomers() {
  const params = {
    layout: "devCustomers",
    action: "read",
    query: {
      f_active: 1
    }
  };
  return await fetchDataFromFileMaker(params);
}

// State Update Example
function updateCustomer(id, data) {
  const params = {
    layout: "devCustomers",
    action: "update",
    recordId: id,
    fieldData: data
  };
  return fetchDataFromFileMaker(params);
}
```

### Testing
1. Verify state management
2. Test API integration
3. Validate CRUD operations
4. Check timer functionality

## Maintenance

### Documentation Updates
1. Keep state.json current
2. Update API patterns
3. Document new layouts
4. Maintain architecture docs

### Code Maintenance
1. Follow component structure
2. Maintain state patterns
3. Update API integration
4. Test functionality

## Future Considerations
1. State management scaling
2. API optimization
3. Layout organization
4. Performance improvements
5. Feature expansion