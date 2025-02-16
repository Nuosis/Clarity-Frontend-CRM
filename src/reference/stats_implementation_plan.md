# Stats Implementation Plan

## Overview
This document outlines the plan to implement stats functionality while maintaining proper separation of concerns and aligning with the existing architecture.

## Current Data Flow
1. App mounts and requests records via recordQueueManager
2. Database returns data via window.returnRecords
3. Records are stored in useProject hook state
4. Projects are processed via processProjectData when customerId changes

## Architecture Principles
1. Data processing happens in services
2. State management happens in hooks
3. Components focus on UI presentation
4. Maintain existing recordQueueManager flow

## Implementation Steps

### 1. Service Layer Updates (projectService.js)

Add standalone stats calculation functions:
```javascript
// Calculate stats for a single project
export function calculateProjectStats(project, records) {
  const projectRecords = records.filter(r => 
    r.fieldData._projectID === project.id
  );
  
  return {
    totalHours: calculateTotalHours(projectRecords),
    unbilledHours: calculateUnbilledHours(projectRecords),
    completion: calculateProjectCompletion(project)
  };
}

// Calculate total hours from records
function calculateTotalHours(records) {
  return records.reduce((total, record) => 
    total + (parseFloat(record.fieldData.Billable_Time_Rounded) || 0), 0
  ).toFixed(1);
}

// Calculate unbilled hours from records
function calculateUnbilledHours(records) {
  return records
    .filter(record => record.fieldData.f_billed === "0")
    .reduce((total, record) => 
      total + (parseFloat(record.fieldData.Billable_Time_Rounded) || 0), 0
    ).toFixed(1);
}
```

### 2. Hook Layer (useProject)
The hook maintains its current structure but returns processed data:
```javascript
// State remains unchanged
const [projectRecords, setProjectRecords] = useState(null);
const [projects, setProjects] = useState([]);

// Return processed data
return {
  ...existingReturn,
  projects,
  projectRecords
};
```

### 3. Component Layer (CustomerDetails)
Component uses hook data to display stats:
```javascript
const { projects, projectRecords } = useProject();

// Calculate stats for display
const displayStats = useMemo(() => {
  if (!projects || !projectRecords) return null;
  
  const activeProjects = projects.filter(p => p.status === 'Open');
  return {
    total: projects.length,
    open: activeProjects.length,
    unbilledHours: calculateUnbilledHours(projectRecords)
  };
}, [projects, projectRecords]);
```

## Benefits
1. Maintains Separation of Concerns:
   - Services handle data processing
   - Hooks manage state
   - Components handle display logic

2. Improves Maintainability:
   - Clear data flow
   - Isolated stats calculations
   - Reusable functions

3. Preserves Existing Architecture:
   - No changes to recordQueueManager
   - Maintains current data flow
   - Builds on existing patterns

## Testing Strategy
1. Service Layer:
   - Test stats calculations
   - Verify data processing
   - Check edge cases

2. Hook Layer:
   - Test state management
   - Verify data flow
   - Check update triggers

3. Component Layer:
   - Test rendering
   - Verify stats display
   - Check UI updates