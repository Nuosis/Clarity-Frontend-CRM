# TSK0012 Verification: API Mocks and Fixtures

## Verification Date
2026-01-15

## Schema Verification

### Method
Compared fixture field names and types against backend OpenAPI spec schemas using:
```bash
curl -s https://api.claritybusinesssolutions.ca/openapi.json | python3 -c "..."
```

### TaskResponse Schema Match
✅ All fields match OpenAPI spec:
- `id`, `organization_id`, `project_id`, `customer_id` (UUID)
- `staff_id` (UUID | null)
- `title` (string)
- `task_type` (string | null)
- `notes` (string | null)
- `is_completed` (boolean)
- `status` (TaskStatus enum)
- `priority` (integer 1-5)
- `estimated_hours` (Decimal string | null)
- `actual_hours` (Decimal string | null)
- `due_date` (date string | null)
- `filemaker_task_id` (string | null)
- `created_at`, `updated_at` (ISO8601 datetime)

**Fixture Compliance**: `mockTask`, `mockCompletedTask`, `mockTasksList`

### TimeEntryResponse Schema Match
✅ All fields match OpenAPI spec:
- `id`, `organization_id`, `task_id`, `project_id`, `customer_id`, `staff_id` (UUID)
- `start_time` (ISO8601 datetime)
- `end_time` (ISO8601 datetime | null)
- `description` (string | null)
- `adjustment_seconds` (integer)
- `pause_duration_seconds` (integer)
- `duration_minutes` (Decimal string | null)
- `hourly_rate` (Decimal string | null)
- `billable_amount` (Decimal string | null)
- `is_billable` (boolean)
- `status` (TimeEntryStatus enum: active, paused, completed)
- `completed_at` (ISO8601 datetime | null)
- `filemaker_record_id` (string | null)
- `created_at`, `updated_at` (ISO8601 datetime)

**Fixture Compliance**: `mockActiveTimer`, `mockPausedTimer`, `mockCompletedTimer`, `mockTimersList`

**Key Changes Made**:
- Removed non-spec fields: `pause_time`, `resume_time`, `billable_hours`
- Added missing fields: `duration_minutes`, `billable_amount`, `completed_at`, `filemaker_record_id`
- Changed `hourly_rate` from number to Decimal string ('100.00')

### FinancialRecordResponse Schema Match
✅ All fields match OpenAPI spec:
- `id`, `financial_id`, `organization_id`, `customer_id` (UUID)
- `product_id` (UUID | null)
- `project_id` (UUID | null)
- `product_name` (string)
- `quantity` (Decimal string)
- `unit_price` (Decimal string)
- `total_price` (Decimal string)
- `date` (date string)
- `inv_id` (string | null)
- `billing_status` (BillingStatus enum)
- `created_at`, `updated_at` (ISO8601 datetime)
- `time_entry_id` (UUID | null)
- `configuration_data` (object | null)

**Fixture Compliance**: `mockFinancialRecord`, `mockBilledFinancialRecord`, `mockFinancialRecordsList`

**Key Changes Made**:
- Added `financial_id` (separate from `id` for idempotency)
- Added `project_id` (optional)
- Changed numeric fields to Decimal strings ('5.5', '100.00', '550.00')
- Added `billing_status` enum (unbilled, billed)
- Added `time_entry_id` for linking
- Kept `configuration_data` for product config

## Build Verification
```bash
npm run build
```

**Result**: ✅ Build succeeded
```
✓ 1126 modules transformed.
dist/index.html  2,004.76 kB │ gzip: 595.85 kB
✓ built in 2.29s
```

**Pre-existing warnings** (not related to this task):
- `proposalService.js` import warnings for `createProposalDeliverables` and `createProposalConcepts`

## Files Created

### Fixtures (`src/__fixtures__/`)
1. ✅ `tasks.js` - Task fixtures matching TaskResponse schema
2. ✅ `timers.js` - Timer fixtures matching TimeEntryResponse schema
3. ✅ `financialRecords.js` - Financial record fixtures matching FinancialRecordResponse schema
4. ✅ `index.js` - Central export

### Mocks (`src/__mocks__/`)
1. ✅ `tasksApi.js` - Mock API functions with business logic
2. ✅ `axios.js` - Axios mock for intercepting API calls
3. ✅ `testUtils.js` - Test utility functions

### Tests (`src/__tests__/`)
1. ✅ `tasksApi.mock.test.js` - Comprehensive test suite

### Documentation
1. ✅ `TSK0012_IMPLEMENTATION.md` - Full implementation details
2. ✅ `TSK0012_VERIFICATION.md` - This document

## Business Logic Simulated

### ✅ Idempotency
- Timer start checks for existing active timer
- Returns 409 with existing timer data
- Prevents duplicate active timers

### ✅ Concurrency Control
- One active timer per staff enforced
- `activeTimersByStaff` map maintained
- Cleared on timer stop

### ✅ Financial Record Generation
- Atomic operation on timer stop
- Calculates: `(duration - pause_duration + adjustment) / 3600`
- Creates record if billable AND not fixed-price
- Returns both timer and financial record

### ✅ Pause/Resume
- Accumulates `pause_duration_seconds`
- Subtracts from billable time
- Tracks across multiple pause/resume cycles

### ✅ Status Transitions
- Validates state changes (active → paused → active → completed)
- Prevents invalid transitions
- Clear error messages

### ✅ Input Validation
- Required fields checked
- Range validation (priority 1-5)
- FastAPI-compatible error format

## Test Coverage

### Task Operations
- ✅ Fetch tasks for project
- ✅ Create task with validation
- ✅ Update task
- ✅ Toggle completion status
- ✅ Delete task
- ✅ Validation errors

### Timer Operations
- ✅ Start timer
- ✅ Concurrency prevention (409)
- ✅ Stop timer with financial record
- ✅ Stop timer fixed-price (no financial record)
- ✅ Pause timer
- ✅ Resume timer
- ✅ Get active timer
- ✅ Fetch timers with filters
- ✅ Status validation

### Error Handling
- ✅ Missing required fields
- ✅ Invalid values
- ✅ Not found (404)
- ✅ Concurrency conflict (409)
- ✅ FastAPI validation format

## Integration with Existing Code

### Data Mappers Compatibility
The existing `dataMappers.js` can use these fixtures:
```javascript
import { mockTask, mockFileMakerTask } from '../__fixtures__';
import { mapTaskToBackend, mapTaskToFileMaker } from '../dataMappers';

it('should map task correctly', () => {
    const result = mapTaskToBackend(mockFileMakerTask);
    expect(result.title).toBe(mockTask.title);
});
```

### API Layer Testing
Tests can import axios mock:
```javascript
jest.mock('axios');
import axios from 'axios';

// axios automatically uses the mock implementation
const response = await axios.post('/tasks', mockTaskCreatePayload);
expect(response.status).toBe(201);
```

### Service Layer Testing
Tests can import tasksApi mock directly:
```javascript
import { mockTasksApi } from '../__mocks__/tasksApi';

const task = await mockTasksApi.createTask(mockTaskCreatePayload);
expect(task).toBeDefined();
```

## Type Safety

All fixtures use exact field types from OpenAPI spec:
- UUIDs as strings
- Decimals as strings (not numbers)
- Dates as ISO8601 strings
- Booleans as booleans
- Nullable fields as `null` (not undefined)

## Decimal String Format

Backend uses Decimal strings for precision. All numeric fields now use strings:
```javascript
// Before (incorrect)
hourly_rate: 100.00
quantity: 5.5

// After (correct - matches backend)
hourly_rate: '100.00'
quantity: '5.5'
```

## Next Steps

1. ✅ Fixtures created and verified
2. ✅ Mocks implement business logic
3. ✅ Test file demonstrates usage
4. ✅ Build verification passed
5. ⏭️ TSK0013: Update unit tests for API layer
6. ⏭️ TSK0014: Update unit tests for service layer
7. ⏭️ TSK0015: Add integration tests

## Conclusion

✅ **Task Complete**

All fixtures match the backend OpenAPI specification exactly. Mocks simulate backend business logic including idempotency, concurrency control, and atomic financial record generation. Comprehensive test suite demonstrates usage. Build succeeds with no new errors.

Ready for TSK0013 and TSK0014 to use these mocks and fixtures for comprehensive testing.
