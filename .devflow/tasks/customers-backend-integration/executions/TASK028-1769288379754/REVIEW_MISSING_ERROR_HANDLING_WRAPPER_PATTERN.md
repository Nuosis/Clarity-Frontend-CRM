# Task Review: Missing Error Handling Wrapper Pattern in API Calls

**Task ID:** TASK028
**Review Date:** 2026-01-24
**Status:** REVIEW COMPLETE

---

## Executive Summary

This review analyzed the error handling patterns across the Clarity CRM Frontend codebase to identify API calls missing standardized error handling wrappers. The findings show a **mixed implementation** with some areas using robust centralized error handling while others use ad-hoc try-catch patterns or direct throws.

**Key Finding:** The codebase has established error handling infrastructure (`withErrorHandling`, `withNoteErrorHandling`) but **inconsistent adoption** across API client modules.

---

## Current Error Handling Architecture

### 1. Centralized Error Handling System

**Location:** `src/errors/`

The project implements a comprehensive, centralized error handling system:

#### Base Error Classes
- **ServiceError** (`src/services/index.js`): Base class for all service-level errors
  - Properties: `message`, `code`, `details`
  - Parent class for specialized error types

#### Specialized Error Modules

**CustomerError** (`src/errors/customerErrors.js`):
- Extends ServiceError for customer-specific errors
- 30+ standardized error codes (AUTH_FAILED, PERMISSION_DENIED, VALIDATION_ERROR, etc.)
- Key functions:
  - `withErrorHandling()`: Wrapper for async operations
  - `parseHttpError()`: HTTP status code classification
  - `getUserFriendlyMessage()`: User-facing error messages
  - `formatErrorForUI()`: Error metadata formatting (severity, retryable, timestamp)
  - `checkOrganizationScope()`: Organization context validation

**NoteError** (`src/errors/noteErrors.js`):
- Extends ServiceError for note-specific errors
- Similar structure to CustomerError with NOTE_ prefix
- Functions:
  - `withNoteErrorHandling()`: Wrapper for note operations
  - `checkNoteOrganizationScope()`: Organization scope validation

### 2. Error Severity and Classification

**Severity Levels:**
- **error**: Auth failures, permission denied, service unavailable
- **warning**: Not found, duplicate entries
- **info**: Validation or processing errors

**Retryable vs Non-retryable:**
- **Retryable:** NETWORK_ERROR, TIMEOUT_ERROR, CONNECTION_ERROR, SERVICE_UNAVAILABLE
- **Non-retryable:** AUTH errors, PERMISSION errors, VALIDATION errors

**HTTP Status Code Mapping:**
| Status | Classification | Error Code |
|--------|----------------|------------|
| 401 | Unauthorized | AUTH_TOKEN_EXPIRED / AUTH_TOKEN_INVALID |
| 403 | Forbidden | ORG_SCOPE_INVALID / PERMISSION_DENIED |
| 404 | Not Found | NOT_FOUND |
| 400 | Bad Request | INVALID_DATA |
| 422 | Unprocessable | VALIDATION_ERROR |
| 409 | Conflict | DUPLICATE_CUSTOMER/RESOURCE |
| 5xx | Server Error | SERVICE_UNAVAILABLE |
| Network | No response | TIMEOUT_ERROR / CONNECTION_ERROR |

---

## API Layer Error Handling Analysis

### ✅ GOOD: Files Using Centralized Wrappers

#### 1. `src/api/customers.js`
**Pattern:** Uses `withErrorHandling()` wrapper on all functions

```javascript
export async function fetchCustomers(options = {}) {
    return withErrorHandling(async () => {
        checkOrganizationScope({ authentication: auth }, 'fetchCustomers');
        const response = await dataService.get('/api/customers', { params: queryParams });
        return normalizeCustomerData(response.data || response);
    }, 'fetchCustomers', { options });
}
```

**Features:**
- Organization scope check before operations
- Automatic error classification
- Data normalization
- Context logging (operation name + parameters)
- ✅ **All 10 functions properly wrapped**

#### 2. `src/api/notes.js`
**Pattern:** Uses `withNoteErrorHandling()` wrapper

```javascript
export async function createNote(payload) {
    return withNoteErrorHandling(async () => {
        // Validation
        if (!payload.project_id && !payload.customer_id && !payload.task_id) {
            throw new NoteError(/*...*/);
        }
        // API call
        const response = await dataService.post(endpoint, payload);
        return normalizeNoteData(response);
    }, 'createNote', { payload });
}
```

**Features:**
- Pre-operation validation with typed errors
- Parent entity exclusivity checks
- Response normalization
- ✅ **All 7 functions properly wrapped**

---

### ⚠️ INCONSISTENT: Files Using Manual Try-Catch

#### 3. `src/api/tasks.js`
**Pattern:** Manual try-catch with `handleApiError()` utility

```javascript
export async function fetchTasksForProject(projectId) {
    if (!projectId) {
        throw new Error('Project ID is required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'fetchTasksForProject');

    try {
        const response = await dataService.get('/api/tasks', {
            params: { project_id: projectId }
        });
        return normalizeTaskData(response);
    } catch (error) {
        handleApiError(error, 'Fetch tasks for project');
    }
}
```

**`handleApiError()` Function:**
- Extracts validation errors from response
- Handles multiple error response formats (array, string, object)
- Logs operation and error details
- Throws consistent error message

**Issues:**
- ❌ Not using centralized `withErrorHandling()` wrapper
- ❌ No standardized error codes (just throws generic Error)
- ❌ No severity classification or retryable status
- ❌ Missing `formatErrorForUI()` metadata

**Functions Affected:** All 13 functions in tasks.js (fetchTasksForProject, createTask, updateTask, deleteTask, startTaskTimer, stopTaskTimer, pauseTimer, resumeTimer, getActiveTimer, fetchTaskTimers, fetchTaskNotes)

---

#### 4. `src/api/projects.js`
**Pattern:** No error handling wrappers - direct throws

```javascript
export async function fetchProjectsForCustomer(customerId) {
    if (!customerId) {
        throw new Error('Customer ID is required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'fetchProjectsForCustomer');

    const response = await dataService.get(`/api/projects/customer/${customerId}`);
    return normalizeProjectData(response.data || response);
}
```

**Issues:**
- ❌ No try-catch blocks
- ❌ No error wrapper functions
- ❌ Relies on dataService to throw errors (no classification)
- ❌ No user-friendly error messages
- ❌ No error metadata (severity, retryable status)

**Special Case:** `fetchProjectsForCustomers()` uses `Promise.allSettled()` with custom error aggregation:
```javascript
const failures = projectResults.filter(result => result.status === 'rejected');
if (failures.length) {
    const error = new Error(message);
    error.failures = failures.map(failure => failure.reason);
    throw error;
}
```
- ✅ Good: Aggregates failures for batch operations
- ❌ Bad: Still throws generic Error, no classification

**Functions Affected:** All 25 functions in projects.js (fetch, create, update, delete, objectives, steps, images, notes)

---

#### 5. `src/api/proposals.js`
**Pattern:** Manual try-catch with inline error parsing

```javascript
export async function createProposal(proposalData) {
    try {
        const payload = JSON.stringify(backendProposalData);
        const authHeader = await generateBackendAuthHeader(payload);
        const response = await axios({ /* config */ });
        return { success: true, data: response.data };
    } catch (error) {
        console.error('[Proposals] Create proposal error:', error);

        let errorMessage = 'Failed to create proposal';

        if (error.response?.data?.detail) {
            if (Array.isArray(error.response.data.detail)) {
                const validationErrors = error.response.data.detail.map(err =>
                    `${err.loc.join('.')}: ${err.msg}`
                ).join(', ');
                errorMessage = `Validation error: ${validationErrors}`;
            } else if (typeof error.response.data.detail === 'string') {
                errorMessage = error.response.data.detail;
            } else {
                errorMessage = JSON.stringify(error.response.data.detail);
            }
        } else if (error.response?.data?.message) {
            errorMessage = error.response.data.message;
        } else if (error.message) {
            errorMessage = error.message;
        }

        return { success: false, error: errorMessage };
    }
}
```

**Issues:**
- ❌ Duplicated error parsing logic across 9 functions
- ❌ No standardized error codes
- ❌ Returns `{ success, error }` instead of throwing (inconsistent with other APIs)
- ❌ No severity or retryable classification
- ❌ No organization scope validation

**Functions Affected:** All 9 functions in proposals.js (createProposal, fetchProposalsForProject, fetchProposalByToken, updateProposalStatus, addProposalConcept, addProposalDeliverable, updateDeliverableSelections, approveProposal, deleteProposal)

---

#### 6. `src/api/teams.js`
**Pattern:** Direct Supabase calls with simple error throws

```javascript
export async function fetchTeams() {
    const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        throw new Error(`Failed to fetch teams: ${error.message}`);
    }

    return data;
}
```

**Issues:**
- ❌ No error wrapper
- ❌ No error classification
- ❌ No user-friendly messages
- ❌ No metadata (severity, retryable)
- ✅ Good: Uses RLS for organization scoping (automatic via Supabase)

**Functions Affected:** All 16 functions in teams.js (fetch, create, update, delete teams/staff/team_members, project assignments)

---

#### 7. `src/api/prospects.js`
**Pattern:** Direct Supabase calls with manual rollback on errors

```javascript
export const createProspect = async (prospectData) => {
    // Step 1: Insert customer
    const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert([customerData])
        .select()
        .single();

    if (customerError) {
        throw new Error(`Failed to create prospect: ${customerError.message}`);
    }

    // Step 2: Insert email
    if (prospectData.Email) {
        const { error: emailError } = await supabase.from('customer_email').insert([{...}]);

        if (emailError) {
            // Rollback: delete the customer record
            await supabase.from('customers').delete().eq('id', customer.id);
            throw new Error(`Failed to add email: ${emailError.message}`);
        }
    }

    // ... repeat for phone, address, settings
};
```

**Issues:**
- ❌ No error wrapper
- ❌ No error classification
- ❌ Manual transaction rollback (error-prone)
- ❌ No metadata
- ✅ Good: Multi-step operations with cleanup on failure

**Functions Affected:** All 4 functions in prospects.js (fetch, create, update, delete, convert)

---

#### 8. `src/api/marketing.js`
**Pattern:** Manual try-catch with native fetch API

```javascript
export async function sendInformationSessionEmails(customers, options = {}) {
    try {
        const eligibleCustomers = customers.filter(/* ... */);

        const requestBody = JSON.stringify(requestPayload);
        const authHeader = await getAuthHeader();

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: requestBody
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed with status ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        return { success: true, data: result, /* ... */ };
    } catch (error) {
        console.error('Error sending information session emails:', error);
        throw error;  // Re-throw original error
    }
}
```

**Issues:**
- ❌ No error wrapper
- ❌ Uses native fetch instead of dataService (inconsistent)
- ❌ No error classification
- ❌ Just re-throws errors (no transformation)
- ❌ No metadata

**Functions Affected:** All 6 functions in marketing.js (sendInformationSessionEmails, sendCustomListInformationSessionEmails, sendTestInformationSessionEmail, validateEmailTemplate, sendCustomBulkEmail, getCampaignStatus)

---

## Data Service Layer

### `src/services/dataService.js`

**Error Handling Features:**
- ✅ `parseBackendAuthError()`: Extracts error messages from responses
- ✅ Axios request interceptor: Validates auth context before requests
- ✅ Axios response interceptor: Logs and rejects errors
- ✅ `getSupabaseAccessToken()`: Throws errors for missing sessions/tokens

**Pattern:**
```javascript
const parseBackendAuthError = async (response) => {
    try {
        const errorText = await response.text();
        if (!errorText) return `HTTP ${response.status}: ${response.statusText}`;
        try {
            const errorJson = JSON.parse(errorText);
            return errorJson.detail || errorJson.message || errorText;
        } catch {
            return errorText;
        }
    } catch {
        return `HTTP ${response.status}: ${response.statusText}`;
    }
};
```

**Issues:**
- ✅ Good: Comprehensive error parsing
- ❌ Only used internally, not exposed for API clients

---

## Hooks Layer Error Handling

**Pattern:** All hooks use standardized error handling

```javascript
export function useCustomer() {
    const [error, setError] = useState(null);
    const [formattedError, setFormattedError] = useState(null);

    const setErrorWithFormatting = useCallback((err) => {
        const formatted = formatErrorForUI(err);
        setError(formatted.message);
        setFormattedError(formatted);
        console.error('[useCustomer] Error:', { raw: err, formatted, stack: err?.stack });
    }, []);

    const handleOperation = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const result = await apiCall();
            return result;
        } catch (err) {
            setErrorWithFormatting(err);
            showError(formatted.message);  // SnackBar
            return null;
        } finally {
            setLoading(false);
        }
    }, []);
}
```

**Features:**
- ✅ Pre-operation: Clear error state and set loading
- ✅ Catch block: Format error using `formatErrorForUI()`, show via SnackBar
- ✅ Finally block: Clear loading state
- ✅ Context logging: Operation name and parameters

**Statistics:**
- 208 total try-catch blocks across 15 hooks
- Consistent use of `showError()` from SnackBarContext
- Detailed console logging with hook name prefix

---

## Service Layer Error Handling

**Pattern:** Services validate inputs and throw simple errors

```javascript
export async function createNewNote(entityType, entityId, noteContent, type = 'general') {
    const sanitizedContent = sanitizeNoteContent(noteContent).trim();

    if (!entityId || !sanitizedContent) {
        throw new Error('Entity ID and note content are required');
    }

    // Call API (which wraps in withNoteErrorHandling)
    const result = await createNote(payload);
    return transformBackendNote(result);
}
```

**Error Propagation Strategy:**
1. **Service Layer:** Validates and throws simple Error objects
2. **API Layer:** Catches errors and wraps in specialized error classes (CustomerError, NoteError)
3. **Hook Layer:** Catches formatted errors and displays to user
4. **Component Layer:** Receives formatted error state

**Issues:**
- ❌ Only works when API layer uses error wrappers
- ❌ Falls apart when API layer throws generic errors

---

## Summary of Findings

### Files WITH Centralized Error Handling ✅
1. **`src/api/customers.js`** - Uses `withErrorHandling()` (10 functions)
2. **`src/api/notes.js`** - Uses `withNoteErrorHandling()` (7 functions)

### Files MISSING Centralized Error Handling ❌
1. **`src/api/tasks.js`** - Manual try-catch with `handleApiError()` (13 functions)
2. **`src/api/projects.js`** - No error wrappers, direct throws (25 functions)
3. **`src/api/proposals.js`** - Manual try-catch, returns `{success, error}` (9 functions)
4. **`src/api/teams.js`** - Direct Supabase calls, simple throws (16 functions)
5. **`src/api/prospects.js`** - Direct Supabase calls with manual rollback (4 functions)
6. **`src/api/marketing.js`** - Manual try-catch with native fetch (6 functions)

### Statistics
- **Total API functions reviewed:** ~90
- **Using centralized wrappers:** 17 (19%)
- **Using manual error handling:** 73 (81%)
- **Error wrapper adoption rate:** **19%** ❌

---

## Recommendations

### Priority 1: Standardize API Layer Error Handling

**Create Generic Error Wrapper:**
```javascript
// src/errors/apiErrors.js
import { ServiceError } from '../services';

export class ApiError extends ServiceError {
    constructor(message, code, details = null) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'ApiError';
    }
}

export const ApiErrorCodes = {
    // Auth errors
    AUTH_FAILED: 'AUTH_FAILED',
    AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
    // ... (use same codes as CustomerError)
};

export function withApiErrorHandling(asyncFunction, operationName, context = {}) {
    return async (...args) => {
        try {
            return await asyncFunction(...args);
        } catch (error) {
            console.error(`[ApiError] ${operationName}:`, error);

            // Classify error
            const { code, message } = parseHttpError(error);
            const apiError = new ApiError(message, code, {
                operation: operationName,
                context,
                originalError: error
            });

            throw apiError;
        }
    };
}
```

**Usage Pattern:**
```javascript
// src/api/projects.js
import { withApiErrorHandling, checkOrganizationScope } from '../errors';

export async function fetchProjectsForCustomer(customerId) {
    return withApiErrorHandling(async () => {
        if (!customerId) {
            throw new Error('Customer ID is required');
        }

        const auth = getAuthenticationContext();
        checkOrganizationScope({ authentication: auth }, 'fetchProjectsForCustomer');

        const response = await dataService.get(`/api/projects/customer/${customerId}`);
        return normalizeProjectData(response.data || response);
    }, 'fetchProjectsForCustomer', { customerId });
}
```

### Priority 2: Migrate Existing Files

**Migration Order (by risk/impact):**
1. **projects.js** - High usage, 25 functions, no error handling
2. **tasks.js** - High usage, 13 functions, manual error handling
3. **proposals.js** - Medium usage, inconsistent return format
4. **teams.js** - Medium usage, Supabase direct calls
5. **prospects.js** - Low usage, complex transaction logic
6. **marketing.js** - Low usage, native fetch API

### Priority 3: Consolidate Error Handling Utilities

**Merge CustomerError and NoteError into Generic ApiError:**
- Both use identical patterns (withErrorHandling, parseHttpError, formatErrorForUI)
- Reduces code duplication
- Easier to maintain
- Consistent error experience across all features

**Proposed Structure:**
```
src/errors/
├── index.js                    # Exports all error utilities
├── apiErrors.js                # Generic API error wrapper
├── errorCodes.js               # Centralized error code constants
├── httpErrorParser.js          # HTTP status code classification
├── errorFormatter.js           # formatErrorForUI, getUserFriendlyMessage
└── organizationValidator.js    # checkOrganizationScope
```

### Priority 4: Document Error Handling Standards

**Create Developer Guide:**
- When to use `withApiErrorHandling()` (all API functions)
- How to add custom error codes
- Error message best practices
- Testing error scenarios

**Update CLAUDE.md:**
- Add section on error handling patterns
- Reference error wrapper functions
- Examples of proper usage

---

## Code Quality Impact

### Benefits of Standardization

**Before (projects.js):**
```javascript
// No error handling - relies on dataService
export async function fetchProjectsForCustomer(customerId) {
    if (!customerId) {
        throw new Error('Customer ID is required');
    }
    const response = await dataService.get(`/api/projects/customer/${customerId}`);
    return normalizeProjectData(response.data || response);
}

// Hook catches generic error
try {
    const projects = await fetchProjectsForCustomer(customerId);
} catch (error) {
    // error.message = "Request failed with status code 403"
    // No context, no severity, no retryable status
    showError(error.message);  // Bad UX
}
```

**After (with withApiErrorHandling):**
```javascript
export async function fetchProjectsForCustomer(customerId) {
    return withApiErrorHandling(async () => {
        if (!customerId) {
            throw new Error('Customer ID is required');
        }
        const auth = getAuthenticationContext();
        checkOrganizationScope({ authentication: auth }, 'fetchProjectsForCustomer');
        const response = await dataService.get(`/api/projects/customer/${customerId}`);
        return normalizeProjectData(response.data || response);
    }, 'fetchProjectsForCustomer', { customerId });
}

// Hook catches formatted error
try {
    const projects = await fetchProjectsForCustomer(customerId);
} catch (error) {
    // error.code = "PERMISSION_DENIED"
    // error.severity = "error"
    // error.retryable = false
    // error.message = "You don't have permission to access this resource. Please contact your administrator."
    const formatted = formatErrorForUI(error);
    showError(formatted.message);  // Good UX
}
```

### Measurable Improvements

1. **User Experience:**
   - ✅ User-friendly error messages (not technical stack traces)
   - ✅ Severity indicators (error/warning/info)
   - ✅ Retryable status (show "Retry" button for network errors)

2. **Debugging:**
   - ✅ Consistent error logging with operation context
   - ✅ Error codes for searching logs
   - ✅ Original error preserved in details

3. **Testing:**
   - ✅ Standardized error mocking
   - ✅ Error scenario coverage
   - ✅ Consistent error assertions

4. **Maintenance:**
   - ✅ Single place to update error messages
   - ✅ Centralized error classification logic
   - ✅ Easier to add new error types

---

## Acceptance Criteria for Completion

1. ✅ All API functions use centralized error wrapper (`withApiErrorHandling` or equivalent)
2. ✅ Error codes are standardized and documented
3. ✅ All errors include metadata (severity, retryable, timestamp)
4. ✅ User-facing error messages are consistent and helpful
5. ✅ Organization scope validation is consistent across all API calls
6. ✅ Error handling is documented in CLAUDE.md
7. ✅ Tests cover error scenarios for all API functions

---

## Next Steps

1. **Create `src/errors/apiErrors.js`** with generic error wrapper
2. **Migrate `src/api/projects.js`** to use new wrapper (validate pattern works)
3. **Migrate remaining API files** in priority order
4. **Consolidate error utilities** (merge customer/note errors into generic)
5. **Update documentation** (CLAUDE.md, developer guide)
6. **Add error scenario tests** for all API functions

---

## Conclusion

The Clarity CRM Frontend has established excellent error handling infrastructure (`withErrorHandling`, error codes, formatErrorForUI) but **inconsistent adoption** across the API layer. Only 19% of API functions use centralized error wrappers.

**Risk:** Inconsistent error handling leads to:
- Poor user experience (technical errors shown to users)
- Difficult debugging (no context, no error codes)
- Brittle code (errors not properly classified)

**Recommendation:** Prioritize migration to standardized error wrappers across all API client files, starting with high-usage modules (projects, tasks).
