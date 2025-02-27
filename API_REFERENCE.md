# API Reference

## Overview

ClarityFrontend CRM uses FileMaker as its backend, communicating through a standardized API layer. The integration is handled through the `fm-gofer` library, with custom wrapper functions for error handling and data formatting.

## Base Configuration

### FileMaker Layouts
```javascript
CUSTOMERS: 'devCustomers'
PROJECTS: 'devProjects'
TASKS: 'devTasks'
RECORDS: 'dapiRecords'
NOTES: 'devNotes'
LINKS: 'devLinks'
IMAGES: 'devImages'
PROJECT_IMAGES: 'devProjectImages'
PROJECT_LINKS: 'devProjectLinks'
PROJECT_OBJECTIVES: 'devProjectObjectives'
PROJECT_OBJ_STEPS: 'devProjectObjSteps'
```

### Action Types
```javascript
READ: 'read'
CREATE: 'create'
UPDATE: 'update'
DELETE: 'delete'
METADATA: 'metaData'
DUPLICATE: 'duplicate'
```

## Customer API

### Fetch Customers
```javascript
GET /devCustomers
Query: { f_active: boolean }
Response: {
  response: {
    data: [{
      fieldData: {
        __ID: string,
        Name: string,
        Email: string,
        Phone: string,
        f_active: "0" | "1",
        ContactPerson: string,
        Address: string,
        City: string,
        State: string,
        PostalCode: string,
        Country: string,
        "~creationTimestamp": string,
        "~modificationTimestamp": string
      },
      recordId: string
    }]
  }
}
```

## Project API

### Fetch Projects for Customer
```javascript
GET /devProjects
Query: { _customerID: string }
Response: {
  response: {
    data: [{
      fieldData: {
        __ID: string,
        Name: string,
        Description: string,
        Status: "Open" | "Closed",
        _customerID: string,
        CreatedDate: string,
        ModifiedDate: string
      },
      recordId: string
    }]
  }
}
```

### Create Project
```javascript
POST /devProjects
Body: {
  Name: string,
  Description: string,
  _customerID: string,
  Status: "Open" | "Closed"
}
Response: {
  response: {
    recordId: string
  }
}
```

## Task API

### Fetch Tasks for Project
```javascript
GET /devTasks
Query: { _projectID: string }
Response: {
  response: {
    data: [{
      fieldData: {
        __ID: string,
        task: string,
        description: string,
        _projectID: string,
        _staffID: string,
        f_completed: boolean,
        notes: string
      },
      recordId: string
    }]
  }
}
```

### Create Task
```javascript
POST /devTasks
Body: {
  task: string,
  description: string,
  _projectID: string,
  _staffID: string
}
Response: {
  response: {
    recordId: string
  }
}
```

### Update Task Status
```javascript
PATCH /devTasks/{recordId}
Body: {
  f_completed: boolean
}
```

### Update Task Notes
```javascript
PATCH /devTasks/{recordId}
Body: {
  notes: string
}
```

## Time Records API

### Start Timer
```javascript
POST /dapiRecords
Body: {
  _taskID: string,
  _staffID: string,
  _projectID: string,
  TimeStart: string, // HH:mm:ss
  DateStart: string  // MM/DD/YYYY
}
Response: {
  response: {
    recordId: string
  }
}
```

### Stop Timer
```javascript
PATCH /dapiRecords/{recordId}
Body: {
  TimeEnd: string,        // HH:mm:ss
  "Work Performed": string,
  TimeAdjust: number      // Adjustment in seconds
}
```

### Fetch Task Timers
```javascript
GET /dapiRecords
Query: { _taskID: string }
Response: {
  response: {
    data: [{
      fieldData: {
        __ID: string,
        _taskID: string,
        TimeStart: string,
        TimeEnd: string,
        "Work Performed": string,
        TimeAdjust: number
      },
      recordId: string
    }]
  }
}
```

## Notes API

### Fetch Notes
```javascript
GET /devNotes
Query: { _fkID: string }  // ID of parent record (task/project)
Response: {
  response: {
    data: [{
      fieldData: {
        __ID: string,
        _fkID: string,
        Content: string,
        CreatedDate: string,
        ModifiedDate: string
      },
      recordId: string
    }]
  }
}
```

## Links API

### Fetch Links
```javascript
GET /devLinks
Query: { _fkID: string }  // ID of parent record (task/project)
Response: {
  response: {
    data: [{
      fieldData: {
        __ID: string,
        _fkID: string,
        URL: string,
        Description: string
      },
      recordId: string
    }]
  }
}
```

## Error Handling

### Error Response Format
```javascript
{
  error: true,
  message: string,
  code: string,
  details?: any
}
```

### Error Codes
- `TIMEOUT`: FileMaker object unavailable after retries
- `SCRIPT_ERROR`: FileMaker script execution error
- `PREPARATION_ERROR`: Error preparing FileMaker request
- `NULL_RESULT`: FileMaker returned null result
- `FM_ERROR`: FileMaker-specific error

## Request Parameters

### Common Parameters
- `layout`: FileMaker layout name
- `action`: CRUD operation type
- `recordId`: Record identifier (for updates/deletes)
- `fieldData`: Data payload for create/update operations
- `query`: Search criteria for read operations

### Parameter Validation
The API validates required parameters before making requests:
```javascript
validateParams({ param1, param2 }, ['param1', 'param2']);
```

## Response Processing

### Data Formatting
Responses are processed through service-layer functions:
```javascript
processCustomerData(response)
processProjectData(response)
processTaskData(response)
```

### Field Mapping
- `__ID`: Internal record identifier
- `recordId`: FileMaker record ID
- `~creationTimestamp`: Record creation time
- `~modificationTimestamp`: Record modification time

## Authentication

The API uses FileMaker's authentication system:
1. Environment variables store credentials
2. Session management handled by fm-gofer
3. Automatic retry on session expiration

## Rate Limiting

- Maximum 30 retries for availability
- 100ms delay between retries
- Automatic request queuing

## Best Practices

1. Always use service layer functions for data processing
2. Implement proper error handling
3. Validate parameters before requests
4. Use appropriate layouts for operations
5. Handle both sync and async operations appropriately