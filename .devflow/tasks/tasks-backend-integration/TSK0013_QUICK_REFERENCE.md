# TSK0013: API Layer Unit Tests - Quick Reference

## Running Tests
```bash
# Run all API tests
npm test -- src/__tests__/tasksApi.test.js

# Run with verbose output
npm test -- src/__tests__/tasksApi.test.js --verbose

# Run specific test suite
npm test -- src/__tests__/tasksApi.test.js -t "HMAC Authentication"

# Run with coverage
npm test -- src/__tests__/tasksApi.test.js --coverage
```

## Test Structure
```
src/__tests__/tasksApi.test.js (45 tests)
├── HMAC Authentication (4 tests)
├── Task CRUD Operations (9 tests)
├── Timer Operations (17 tests)
├── Error Handling (10 tests)
├── Request/Response Mapping (3 tests)
├── Console Logging (2 tests)
└── FileMaker Fallback (1 test)
```

## Key Test Patterns

### Mocking Setup
```javascript
// Mock axios
jest.mock('axios');

// Mock fileMaker module
jest.mock('../api/fileMaker', () => ({
    generateBackendAuthHeader: jest.fn().mockResolvedValue('Bearer test-signature.1234567890'),
    // ... other mocks
}));

// Mock config
jest.mock('../config', () => ({
    backendConfig: {
        baseUrl: 'https://api.claritybusinesssolutions.ca'
    }
}));
```

### HMAC Authentication Tests
```javascript
// Verify HMAC header in GET request
expect(fileMakerApi.generateBackendAuthHeader).toHaveBeenCalledWith('');
expect(axios.get).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
        headers: expect.objectContaining({
            'Authorization': 'Bearer test-signature.1234567890'
        })
    })
);

// Verify HMAC header in POST request with payload
expect(fileMakerApi.generateBackendAuthHeader).toHaveBeenCalledWith(
    JSON.stringify(data)
);
```

### Error Handling Tests
```javascript
// Test validation errors (array format)
const error = new Error('Validation failed');
error.response = {
    data: {
        detail: [
            { loc: ['body', 'title'], msg: 'field required' }
        ]
    }
};
axios.post.mockRejectedValue(error);

await expect(tasksApi.createTask({})).rejects.toThrow(
    'Validation error: body.title: field required'
);

// Test 404 handling for getActiveTimer
const error = new Error('Not found');
error.response = { status: 404 };
axios.get.mockRejectedValue(error);

const result = await tasksApi.getActiveTimer('staff-1');
expect(result).toBeNull(); // Should return null, not throw
```

### Timer Operation Tests
```javascript
// Test pauseTimer
it('should pause an active timer', async () => {
    const mockResponse = {
        id: 'timer-1',
        status: 'paused',
        pause_time: '2024-01-15T10:30:00Z'
    };
    axios.post.mockResolvedValue({ data: mockResponse });

    const result = await tasksApi.pauseTimer('timer-1');

    expect(result).toEqual(mockResponse);
    expect(axios.post).toHaveBeenCalledWith(
        `${backendConfig.baseUrl}/time-entries/timer-1/pause`,
        null,
        expect.any(Object)
    );
});
```

## Test Coverage by Endpoint

### Task Endpoints
- ✅ `GET /tasks` - fetchTasksForProject
- ✅ `POST /tasks` - createTask
- ✅ `PATCH /tasks/{id}` - updateTask
- ✅ `POST /tasks/{id}/toggle-completion` - updateTaskStatus
- ✅ `DELETE /tasks/{id}` - deleteTask

### Timer Endpoints
- ✅ `POST /time-entries/start` - startTaskTimer
- ✅ `POST /time-entries/{id}/stop` - stopTaskTimer
- ✅ `POST /time-entries/{id}/pause` - pauseTimer
- ✅ `POST /time-entries/{id}/resume` - resumeTimer
- ✅ `GET /time-entries/active` - getActiveTimer
- ✅ `GET /time-entries` - fetchTaskTimers

## Common Assertions

### Verify Axios Call
```javascript
expect(axios.post).toHaveBeenCalledWith(
    'https://api.claritybusinesssolutions.ca/tasks',
    expectedPayload,
    expect.objectContaining({
        headers: expect.objectContaining({
            'Authorization': expect.any(String),
            'Content-Type': 'application/json'
        })
    })
);
```

### Verify HMAC Generation
```javascript
expect(fileMakerApi.generateBackendAuthHeader).toHaveBeenCalledWith(
    JSON.stringify(payload)
);
```

### Verify Response Mapping
```javascript
const result = await tasksApi.createTask(data);
expect(result).toEqual(mockResponseData); // Direct data passthrough
```

### Verify Error Format
```javascript
await expect(tasksApi.someFunction()).rejects.toThrow('Expected error message');
```

## Error Response Formats Tested

### 1. Array Validation Errors
```json
{
  "detail": [
    { "loc": ["body", "title"], "msg": "field required" },
    { "loc": ["body", "project_id"], "msg": "field required" }
  ]
}
```

### 2. String Detail
```json
{
  "detail": "Task not found"
}
```

### 3. Message Field
```json
{
  "message": "Unauthorized access"
}
```

### 4. Error Field
```json
{
  "error": "Database connection failed"
}
```

### 5. String Response
```
"Bad request"
```

## Debugging Tests

### View Console Logs
```bash
npm test -- src/__tests__/tasksApi.test.js --verbose 2>&1 | less
```

### Run Single Test
```bash
npm test -- src/__tests__/tasksApi.test.js -t "should pause an active timer"
```

### Check Mock Calls
```javascript
console.log(axios.post.mock.calls); // See all axios.post calls
console.log(fileMakerApi.generateBackendAuthHeader.mock.calls); // See HMAC calls
```

## Configuration Requirements

### babel.config.js
```javascript
export default {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }], // No modules: false
    '@babel/preset-react'
  ],
};
```

### jest.config.js
```javascript
export default {
  transform: {
    "^.+\\.(js|jsx)$": "babel-jest"
  },
  testEnvironment: "jsdom",
  // ... other config
};
```

## Test Maintenance

### Adding New Endpoint Tests
1. Add mock response data
2. Mock axios method (get/post/patch/delete)
3. Call API function
4. Verify HMAC header generation
5. Verify axios call with correct URL and payload
6. Verify response data mapping

### Adding Error Scenarios
1. Create error with response structure
2. Mock axios to reject with error
3. Assert expected error message
4. Verify console.error was called

## Related Files
- **Source:** `src/api/tasks.js`
- **Tests:** `src/__tests__/tasksApi.test.js`
- **Mocks:** `src/__mocks__/tasksApi.js`, `src/__mocks__/axios.js`
- **Config:** `babel.config.js`, `jest.config.js`

## Build Verification
```bash
npm run build
```

Should complete with no errors (only pre-existing warnings allowed).
