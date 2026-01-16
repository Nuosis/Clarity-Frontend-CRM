# TSK0023 Quick Reference

## What Changed

### Removed FileMaker Test Fixtures
- ❌ `mockFileMakerTask` from `src/__fixtures__/tasks.js`
- ❌ `mockFileMakerTimer` from `src/__fixtures__/timers.js`
- ❌ `mockFileMakerFinancialRecord` from `src/__fixtures__/financialRecords.js`
- ❌ `filemaker_task_id` and `filemaker_record_id` fields from all mock objects

### Updated Test Mocks
- 🔄 `src/__tests__/tasksApi.test.js` → Now uses `dataService` instead of `fileMaker`
- 🔄 `src/hooks/__tests__/useLink.test.js` → Removed FileMaker environment tests

### Tests Status
- ✅ **useLink tests**: 17/17 passing
- ⚠️ **tasksApi tests**: 3/42 passing (pre-existing axios mock issue)
- ✅ **Build**: Successful

## Before vs After

### Fixture Structure
**Before:**
```javascript
export const mockTask = {
    id: 'task-1',
    title: 'Test',
    filemaker_task_id: null,  // ❌ Removed
    // ...
};

export const mockFileMakerTask = {  // ❌ Removed entire export
    recordId: 'fm-rec-123',
    fieldData: { /* ... */ }
};
```

**After:**
```javascript
export const mockTask = {
    id: 'task-1',
    title: 'Test',
    // ...
};
```

### Test Mocks
**Before:**
```javascript
import * as fileMakerApi from '../api/fileMaker';

jest.mock('../api/fileMaker', () => ({
    generateBackendAuthHeader: jest.fn(),
    validateParams: jest.fn()
}));

expect(fileMakerApi.generateBackendAuthHeader).toHaveBeenCalled();
```

**After:**
```javascript
import * as dataService from '../services/dataService';

jest.mock('../services/dataService', () => ({
    generateBackendAuthHeader: jest.fn(),
    getAuthenticationContext: jest.fn()
}));

expect(dataService.generateBackendAuthHeader).toHaveBeenCalled();
```

## Files Retained (Not Modified)

### Customer Transformations
- `src/services/__tests__/customerTransformations.test.js`
- **Why**: Tests functions still used in `customerService.js`

### Data Mappers
- `src/utils/__tests__/dataMappers.test.js`
- **Why**: Utility functions kept for potential data migration needs

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/hooks/__tests__/useLink.test.js

# Run with coverage
npm test -- --coverage
```

## If You Need to Add New Tests

### Use Backend API Mock Format
```javascript
const mockTask = {
    id: 'task-123',
    organization_id: 'org-123',
    project_id: 'proj-123',
    title: 'Test Task',
    status: 'active',
    created_at: '2026-01-16T10:00:00Z',
    updated_at: '2026-01-16T10:00:00Z'
    // NO filemaker_task_id or FileMaker-specific fields!
};
```

### Mock dataService Functions
```javascript
jest.mock('../services/dataService', () => ({
    generateBackendAuthHeader: jest.fn().mockResolvedValue('Bearer test-token'),
    getAuthenticationContext: jest.fn().mockReturnValue({
        isAuthenticated: true,
        user: { supabaseOrgID: 'org-123' }
    }),
    hasOrganizationContext: jest.fn().mockReturnValue(true)
}));
```

## Troubleshooting

### Test Failing: "fileMakerApi is not defined"
**Solution**: Replace with `dataService` import
```javascript
// ❌ Old
import * as fileMakerApi from '../api/fileMaker';

// ✅ New
import * as dataService from '../services/dataService';
```

### Test Failing: "getAuthenticationContext is not a function"
**Solution**: Add to dataService mock
```javascript
jest.mock('../services/dataService', () => ({
    // ... other mocks
    getAuthenticationContext: jest.fn().mockReturnValue({
        isAuthenticated: true,
        user: { supabaseOrgID: 'org-123' }
    })
}));
```

### Fixture Import Failing: "mockFileMakerTask is not exported"
**Solution**: Use backend API mock format instead
```javascript
// ❌ Old
import { mockFileMakerTask } from '../__fixtures__';

// ✅ New
import { mockTask } from '../__fixtures__';
```

## Related Tasks

- **TSK0017**: Deleted `fileMaker.js` API file
- **TSK0024**: Next step - Full regression testing
- **TSK0025**: Final cleanup phase

## Key Contacts

- **Documentation**: See `TSK0023_COMPLETION_SUMMARY.md`
- **Architecture**: See `CLAUDE.md` - "Testing Requirements" section
- **API Docs**: See `docs/` directory for feature-specific API guides
