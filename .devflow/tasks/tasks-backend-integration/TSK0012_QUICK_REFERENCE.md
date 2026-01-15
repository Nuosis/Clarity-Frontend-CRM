# TSK0012 Quick Reference: Using Mocks and Fixtures

## Quick Import Examples

### Import Fixtures
```javascript
// Import specific fixtures
import { mockTask, mockActiveTimer, mockFinancialRecord } from '../__fixtures__';

// Import all fixtures
import * as fixtures from '../__fixtures__';
```

### Import Mocks
```javascript
// Import mock API functions
import { mockTasksApi } from '../__mocks__/tasksApi';

// Import test utilities
import { setupTestEnvironment, assertTaskShape } from '../__mocks__/testUtils';

// Mock axios (automatic in tests)
jest.mock('axios');
```

## Common Test Patterns

### Basic Test Setup
```javascript
import { mockTasksApi } from '../__mocks__/tasksApi';
import { setupTestEnvironment, cleanupTestEnvironment } from '../__mocks__/testUtils';

describe('My Test Suite', () => {
    beforeEach(() => {
        setupTestEnvironment(); // Resets state and mocks
    });

    afterEach(() => {
        cleanupTestEnvironment(); // Cleanup
    });

    it('should do something', async () => {
        // Your test here
    });
});
```

### Test Task CRUD
```javascript
// Create task
const task = await mockTasksApi.createTask({
    project_id: 'proj-uuid',
    customer_id: 'cust-uuid',
    title: 'Test task',
    priority: 3
});

// Fetch tasks
const tasks = await mockTasksApi.fetchTasksForProject('proj-uuid');

// Update task
const updated = await mockTasksApi.updateTask(task.id, {
    title: 'Updated title',
    priority: 1
});

// Toggle completion
const completed = await mockTasksApi.updateTaskStatus(task.id, true);

// Delete task
await mockTasksApi.deleteTask(task.id);
```

### Test Timer Operations
```javascript
const staffId = 'staff-uuid';
const taskId = 'task-uuid';

// Start timer
const timer = await mockTasksApi.startTimer({
    task_id: taskId,
    staff_id: staffId,
    is_billable: true
});

// Pause timer
const paused = await mockTasksApi.pauseTimer(timer.id);

// Resume timer
const resumed = await mockTasksApi.resumeTimer(paused.id);

// Stop timer (creates financial record)
const result = await mockTasksApi.stopTimer(timer.id, {
    description: 'Work completed',
    adjustment_seconds: 360
});

expect(result.time_entry).toBeDefined();
expect(result.financial_record).toBeDefined();

// Stop timer (fixed-price, no financial record)
const fixedPriceResult = await mockTasksApi.stopTimer(timer.id, {
    description: 'Work completed'
}, true); // Pass true for fixed-price

expect(fixedPriceResult.time_entry).toBeDefined();
expect(fixedPriceResult.financial_record).toBeNull();
```

### Test Concurrency Control
```javascript
const staffId = 'staff-uuid';

// Start first timer
const timer1 = await mockTasksApi.startTimer({
    task_id: 'task-1',
    staff_id: staffId,
    is_billable: true
});

// Try to start second timer (should fail)
try {
    await mockTasksApi.startTimer({
        task_id: 'task-2',
        staff_id: staffId,
        is_billable: true
    });
    fail('Should have thrown concurrency error');
} catch (error) {
    expect(error.status).toBe(409);
    expect(error.response.data.existing_timer).toBeDefined();
    expect(error.response.data.existing_timer.id).toBe(timer1.id);
}
```

### Test Validation Errors
```javascript
// Missing required field
try {
    await mockTasksApi.createTask({ title: '' });
    fail('Should have thrown validation error');
} catch (error) {
    expect(error.message).toContain('title is required');
}

// Invalid priority range
try {
    await mockTasksApi.createTask({
        title: 'Test',
        project_id: 'proj-uuid',
        priority: 10
    });
    fail('Should have thrown validation error');
} catch (error) {
    expect(error.message).toContain('priority must be between 1 and 5');
}
```

### Get Active Timer
```javascript
const staffId = 'staff-uuid';

// Start a timer
await mockTasksApi.startTimer({
    task_id: 'task-uuid',
    staff_id: staffId,
    is_billable: true
});

// Get active timer
const activeTimer = await mockTasksApi.getActiveTimer(staffId);
expect(activeTimer).toBeDefined();
expect(activeTimer.status).toBe('active');

// No active timer
const noTimer = await mockTasksApi.getActiveTimer('different-staff-uuid');
expect(noTimer).toBeNull();
```

### Fetch Timers with Filters
```javascript
// Fetch by task
const taskTimers = await mockTasksApi.fetchTaskTimers({
    task_id: 'task-uuid'
});

// Fetch by staff
const staffTimers = await mockTasksApi.fetchTaskTimers({
    staff_id: 'staff-uuid'
});

// Fetch by status
const completedTimers = await mockTasksApi.fetchTaskTimers({
    status: 'completed'
});

// Fetch with date range
const recentTimers = await mockTasksApi.fetchTaskTimers({
    start_date: '2026-01-01',
    end_date: '2026-01-31'
});

// Combine filters
const filtered = await mockTasksApi.fetchTaskTimers({
    task_id: 'task-uuid',
    staff_id: 'staff-uuid',
    status: 'completed'
});
```

## Using Fixtures in Tests

### Task Fixtures
```javascript
import {
    mockTask,
    mockCompletedTask,
    mockTasksList,
    mockTaskCreatePayload
} from '../__fixtures__';

// Use in tests
expect(result).toEqual(mockTask);
const tasks = [...mockTasksList];
```

### Timer Fixtures
```javascript
import {
    mockActiveTimer,
    mockPausedTimer,
    mockCompletedTimer,
    mockStopTimerResponse
} from '../__fixtures__';

// Verify timer shape
expect(timer.status).toBe(mockActiveTimer.status);
```

### Financial Record Fixtures
```javascript
import {
    mockFinancialRecord,
    mockBilledFinancialRecord
} from '../__fixtures__';

// Verify financial record
expect(result.financial_record).toMatchObject(mockFinancialRecord);
```

## Assertion Helpers

```javascript
import {
    assertTaskShape,
    assertTimerShape,
    assertFinancialRecordShape
} from '../__mocks__/testUtils';

// Validate structure
assertTaskShape(task);
assertTimerShape(timer);
assertFinancialRecordShape(record);
```

## Error Factories

```javascript
import {
    createApiError,
    createValidationError
} from '../__mocks__/testUtils';

// Create 404 error
const notFoundError = createApiError(404, 'Task not found');

// Create validation error
const validationError = createValidationError('title', 'field required');
```

## Mock Context Factories

```javascript
import {
    createMockUserContext,
    createMockProjectContext
} from '../__mocks__/testUtils';

// Create user context
const user = createMockUserContext({
    email: 'test@example.com'
});

// Create project context
const project = createMockProjectContext({
    isFixedPrice: true,
    hourlyRate: 150.00
});
```

## Reset Mock State

```javascript
import { mockTasksApi } from '../__mocks__/tasksApi';

// Between tests
mockTasksApi.resetMockState();
```

## Key Field Types

### UUID Fields (strings)
- `id`, `organization_id`, `task_id`, `staff_id`, `project_id`, `customer_id`

### Decimal Fields (strings, NOT numbers)
- `estimated_hours: '8.0'`
- `hourly_rate: '100.00'`
- `quantity: '5.5'`
- `unit_price: '100.00'`
- `total_price: '550.00'`

### Date/Time Fields
- `created_at: '2026-01-15T10:00:00Z'` (ISO8601)
- `due_date: '2026-01-20'` (date only)

### Enum Fields
- `status: 'active' | 'paused' | 'completed'`
- `billing_status: 'unbilled' | 'billed'`
- `task_type: 'feature' | 'bug' | 'improvement' | 'documentation'`

### Integer Fields
- `priority: 1-5`
- `adjustment_seconds: 360`
- `pause_duration_seconds: 600`

## Common Mistakes to Avoid

❌ **Don't use numbers for Decimal fields**
```javascript
hourly_rate: 100.00 // WRONG
hourly_rate: '100.00' // CORRECT
```

❌ **Don't use undefined for nullable fields**
```javascript
end_time: undefined // WRONG
end_time: null // CORRECT
```

❌ **Don't forget to reset state between tests**
```javascript
// Add to beforeEach
setupTestEnvironment();
```

❌ **Don't expect errors to be thrown directly**
```javascript
// Mock functions return promises that reject
try {
    await mockTasksApi.createTask({});
} catch (error) {
    // Handle error
}
```

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test src/__tests__/tasksApi.mock.test.js

# Run tests in watch mode
npm test -- --watch
```

## Next Steps

After TSK0012, you can:
1. Use these mocks in TSK0013 (API layer tests)
2. Use these mocks in TSK0014 (service layer tests)
3. Build integration tests in TSK0015
4. Extend mocks for additional functionality
