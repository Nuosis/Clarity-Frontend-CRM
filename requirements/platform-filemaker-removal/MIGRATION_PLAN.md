# FileMaker Removal Migration Plan
# Phase 2 Implementation Guide

**Created:** 2026-01-10
**Purpose:** Step-by-step migration plan to remove FileMaker dependencies and simplify dataService.js to single routing path (Supabase + Backend API only)
**Status:** Implementation Planning Document

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Prerequisites and Verification](#prerequisites-and-verification)
3. [Migration Overview](#migration-overview)
4. [Phase 1: API Layer Migration](#phase-1-api-layer-migration)
5. [Phase 2: Data Service Simplification](#phase-2-data-service-simplification)
6. [Phase 3: Authentication Simplification](#phase-3-authentication-simplification)
7. [Phase 4: Environment Detection Removal](#phase-4-environment-detection-removal)
8. [Phase 5: Configuration Cleanup](#phase-5-configuration-cleanup)
9. [Phase 6: Testing and Verification](#phase-6-testing-and-verification)
10. [Phase 7: Documentation Updates](#phase-7-documentation-updates)
11. [Rollback Plan](#rollback-plan)
12. [Success Criteria](#success-criteria)

---

## Executive Summary

### Goal

Transform the Clarity CRM Frontend from a dual-environment architecture (FileMaker WebViewer + Standalone Web App) to a single-environment architecture (Standalone Web App only) by removing all FileMaker dependencies and simplifying the data routing layer.

### Current State

- **Dual Environment Architecture:** FileMaker WebViewer + Standalone Web App
- **Environment Detection:** Automatic FileMaker bridge detection with 3-second polling
- **Dual Authentication:** FileMaker bridge + Supabase
- **Dual Data Routing:** FileMaker API calls + Backend API calls
- **Request Interceptors:** Environment-aware axios interceptors
- **100+ Integration Points:** Across 20+ files

### Target State

- **Single Environment:** Standalone Web App only
- **Single Authentication:** Supabase only
- **Single Data Routing:** Backend API + Supabase direct access
- **Simplified Request Flow:** HMAC authentication only
- **Reduced Complexity:** ~500 lines of code removed

### Impact

**Files Modified:** 22 files
**Lines Removed:** ~500 lines
**Lines Modified:** ~200 lines
**Net Reduction:** ~300 lines

---

## Prerequisites and Verification

### 1. Backend API Verification

**⚠️ CRITICAL: Backend changes must be completed BEFORE frontend migration**

Verify the following backend endpoints are updated to query Supabase directly (not FileMaker):

```bash
# Test each endpoint returns data from Supabase, not FileMaker
curl -X GET https://api.claritybusinesssolutions.ca/filemaker/devCustomers/records \
  -H "Authorization: Bearer {hmac}.{timestamp}"

curl -X GET https://api.claritybusinesssolutions.ca/filemaker/devProjects/records \
  -H "Authorization: Bearer {hmac}.{timestamp}"

curl -X GET https://api.claritybusinesssolutions.ca/filemaker/devTasks/records \
  -H "Authorization: Bearer {hmac}.{timestamp}"
```

**Checklist:**
- [ ] `/filemaker/devCustomers/records` queries `customers` table in Supabase
- [ ] `/filemaker/devProjects/records` queries `projects` table in Supabase
- [ ] `/filemaker/devTasks/records` queries `tasks` table in Supabase
- [ ] `/filemaker/devTeams/records` queries `teams` table in Supabase
- [ ] `/filemaker/dapiRecords/records` queries correct time tracking table
- [ ] `/filemaker/devNotes/records` queries `notes` table
- [ ] `/filemaker/devLinks/records` queries `links` table
- [ ] Response format matches FileMaker-compatible structure
- [ ] HMAC authentication works for all endpoints

**Reference:** See `BACKEND_API_REQUIREMENTS.md` for complete backend requirements

### 2. Supabase Table Verification

Verify all required tables exist in Supabase:

**Core Tables (Verified):**
- [x] `customers`
- [x] `projects`
- [x] `tasks`
- [x] `teams`
- [x] `team_members`
- [x] `staff`
- [x] `notes`
- [x] `links`
- [x] `proposals`
- [x] `prospects`

**Tables Requiring Verification:**
- [ ] Time tracking table: `time_entries`, `customer_sales`, or `financial_records`?
- [ ] Project images table exists?
- [ ] Project objectives table exists?
- [ ] Project objective steps table exists?

**Action:** Confirm with backend team which table name to use for each layout

### 3. Environment Setup

**Required Environment Variables:**
```bash
# Keep (Required)
VITE_SECRET_KEY              # HMAC signing
VITE_SUPABASE_URL           # Supabase connection
VITE_SUPABASE_ANON_KEY      # Supabase auth
VITE_API_URL                # Backend API base URL

# Remove (After migration)
VITE_FM_URL                 # FileMaker server URL
VITE_FM_DATABASE            # FileMaker database name
VITE_FM_USER                # FileMaker username
VITE_FM_PASSWORD            # FileMaker password
```

### 4. Backup Current State

Before starting migration:

```bash
# Create feature branch
git checkout -b feature/remove-filemaker-integration

# Tag current state
git tag pre-filemaker-removal

# Push tag
git push origin pre-filemaker-removal
```

---

## Migration Overview

### Migration Phases

**Sequential Execution Required** - Each phase depends on previous phase completion

1. **Phase 1: API Layer Migration** (3-5 hours)
   - Update all API files to use direct HTTP calls instead of FileMaker params
   - Remove `fetchDataFromFileMaker` calls
   - Replace with `dataService.get/post/patch/delete` calls

2. **Phase 2: Data Service Simplification** (2-3 hours)
   - Remove FileMaker routing from interceptors
   - Remove `convertToFileMakerCall` function
   - Simplify to single HMAC-authenticated path

3. **Phase 3: Authentication Simplification** (1-2 hours)
   - Remove FileMaker detection from SignIn component
   - Simplify to Supabase-only authentication

4. **Phase 4: Environment Detection Removal** (1-2 hours)
   - Remove environment type constants
   - Remove environment state from AppStateContext
   - Simplify initialization flow

5. **Phase 5: Configuration Cleanup** (0.5-1 hour)
   - Remove fm-gofer package
   - Remove FileMaker environment variables
   - Remove FileMaker-related files

6. **Phase 6: Testing and Verification** (2-4 hours)
   - Test all authentication flows
   - Test all CRUD operations
   - Verify no FileMaker references remain

7. **Phase 7: Documentation Updates** (1-2 hours)
   - Update CLAUDE.md
   - Update README.md
   - Document changes

**Total Estimated Time:** 11-19 hours

---

## Phase 1: API Layer Migration

### Goal

Convert all API modules from FileMaker parameter style to direct HTTP requests.

### Files to Modify (11 files)

1. `src/api/customers.js` (7 calls)
2. `src/api/projects.js` (9 calls)
3. `src/api/tasks.js` (14 calls)
4. `src/api/teams.js` (15 calls)
5. `src/api/notes.js` (1 call)
6. `src/api/links.js` (1 call)
7. `src/api/financialRecords.js` (10 calls)
8. `src/api/customerActivity.js` (2 calls)
9. `src/api/prospects.js` (1 call)
10. `src/components/financial/QboTestPanel.jsx` (2 calls)
11. `src/services/initializationService.js` (1 call)

### Pattern: FileMaker → HTTP Conversion

**Before (FileMaker style):**
```javascript
import { fetchDataFromFileMaker, Layouts, Actions } from './fileMaker';

export async function fetchCustomers() {
  return handleFileMakerOperation(async () => {
    const params = {
      layout: Layouts.CUSTOMERS,
      action: Actions.READ,
      query: [{ "__ID": "*" }]
    };

    return await fetchDataFromFileMaker(params);
  });
}
```

**After (HTTP style):**
```javascript
import dataService from '../services/dataService';

export async function fetchCustomers() {
  try {
    const response = await dataService.get('/api/filemaker/devCustomers/records');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch customers:', error);
    throw error;
  }
}
```

### Conversion Rules

#### 1. Import Changes

**Remove:**
```javascript
import { fetchDataFromFileMaker, handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';
```

**Add:**
```javascript
import dataService from '../services/dataService';
```

#### 2. READ Operations

**All records:**
```javascript
// Before
fetchDataFromFileMaker({
  layout: Layouts.CUSTOMERS,
  action: Actions.READ,
  query: [{ "__ID": "*" }]
})

// After
dataService.get('/api/filemaker/devCustomers/records')
```

**By ID:**
```javascript
// Before
fetchDataFromFileMaker({
  layout: Layouts.CUSTOMERS,
  action: Actions.READ,
  query: [{ "__ID": customerId }]
})

// After
dataService.get(`/api/filemaker/devCustomers/records/${customerId}`)
```

**With query:**
```javascript
// Before
fetchDataFromFileMaker({
  layout: Layouts.CUSTOMERS,
  action: Actions.READ,
  query: [{ "f_active": "1" }]
})

// After
dataService.post('/api/filemaker/devCustomers/_find', {
  query: [{ "f_active": "1" }]
})
```

#### 3. CREATE Operations

```javascript
// Before
fetchDataFromFileMaker({
  layout: Layouts.CUSTOMERS,
  action: Actions.CREATE,
  fieldData: { name: "Acme Corp", email: "contact@acme.com" }
})

// After
dataService.post('/api/filemaker/devCustomers/records', {
  fields: { name: "Acme Corp", email: "contact@acme.com" }
})
```

#### 4. UPDATE Operations

```javascript
// Before
fetchDataFromFileMaker({
  layout: Layouts.CUSTOMERS,
  action: Actions.UPDATE,
  recordId: customerId,
  fieldData: { name: "New Name" }
})

// After
dataService.patch(`/api/filemaker/devCustomers/records/${customerId}`, {
  fields: { name: "New Name" }
})
```

#### 5. DELETE Operations

```javascript
// Before
fetchDataFromFileMaker({
  layout: Layouts.CUSTOMERS,
  action: Actions.DELETE,
  recordId: customerId
})

// After
dataService.delete(`/api/filemaker/devCustomers/records/${customerId}`)
```

### Layout to Endpoint Mapping

| FileMaker Layout | Endpoint Path |
|-----------------|---------------|
| `devCustomers` | `/api/filemaker/devCustomers/records` |
| `devProjects` | `/api/filemaker/devProjects/records` |
| `devTasks` | `/api/filemaker/devTasks/records` |
| `dapiRecords` | `/api/filemaker/dapiRecords/records` |
| `devTeams` | `/api/filemaker/devTeams/records` |
| `devTeamMembers` | `/api/filemaker/devTeamMembers/records` |
| `devStaff` | `/api/filemaker/devStaff/records` |
| `devNotes` | `/api/filemaker/devNotes/records` |
| `devLinks` | `/api/filemaker/devLinks/records` |
| `devImages` | `/api/filemaker/devImages/records` |
| `devProjectImages` | `/api/filemaker/devProjectImages/records` |
| `devProjectObjectives` | `/api/filemaker/devProjectObjectives/records` |
| `devProjectObjSteps` | `/api/filemaker/devProjectObjSteps/records` |

### File-by-File Implementation Guide

#### src/api/customers.js

**7 functions to update:**

1. `fetchCustomers()` - lines 8-17
2. `fetchCustomer(customerId)` - lines 26-36
3. `createCustomer(data)` - lines 47-57
4. `updateCustomer(customerId, data)` - lines 66-76
5. `deleteCustomer(customerId)` - lines 89-99
6. `getActiveCustomers()` - lines 105-115
7. `toggleCustomerStatus(customerId, isActive)` - lines 124-134

**Pattern for each:**
- Remove `handleFileMakerOperation` wrapper
- Replace `fetchDataFromFileMaker` with `dataService.get/post/patch/delete`
- Use try/catch for error handling
- Return `response.data`

**Reference:** See `requirements/customers/migration-plan.md` for detailed customer API migration

#### src/api/projects.js

**9 functions to update:**

1. `fetchProjects(customerIds)` - lines 10-20
2. `fetchProject(projectId)` - lines 29-39
3. `fetchProjectNotes(projectId)` - lines 49-59
4. `fetchProjectLinks(projectId)` - lines 73-84
5. `createProject(data)` - lines 95-105
6. `updateProject(projectId, data)` - lines 114-124
7. `updateProjectStatus(projectId, status)` - lines 135-145
8. `fetchProjectImages`, `fetchProjectObjectives`, `fetchProjectObjSteps` - lines 154-165
9. `createProjectObjective(data)` - lines 203-213

**Reference:** See `requirements/projects/migration-plan.md` for detailed project API migration

#### src/api/tasks.js

**14 functions to update:**

Similar pattern to customers and projects. Focus on:
- Task queries by project ID
- Task creation with timer start
- Task updates (status, notes, completion)
- Timer stop with time tracking

**Complex Cases:**
- Multi-step operations (fetch project, then create task) - keep multi-step but use HTTP
- Timer operations with financial records - ensure correct endpoint for time entries

#### src/api/teams.js

**15 functions to update:**

- Team CRUD operations
- Team member assignments
- Staff management
- Project-team associations

**Complex Cases:**
- Multi-table queries (teams + team_members + staff) - may need multiple HTTP calls or new joined endpoint

#### src/api/financialRecords.js

**10 functions to update:**

**⚠️ CRITICAL:** Verify correct Supabase table name with backend team first
- Is it `time_entries`, `customer_sales`, or `financial_records`?

Operations:
- Create timer/time entry
- Stop timer
- Get records by task/project/timeframe
- Update billed status (single and bulk)

#### src/api/notes.js, src/api/links.js

**Simple updates:**
- Single `fetchDataFromFileMaker` call each
- Straightforward conversion to GET request

#### src/api/customerActivity.js

**2 calls to investigate:**
- Review what data is being fetched
- May be using custom FileMaker layouts
- Convert to appropriate Supabase queries

#### src/api/prospects.js

**1 dynamic import call (lines 473-477):**

**Before:**
```javascript
const { fetchDataFromFileMaker, Layouts, Actions } = await import('./fileMaker.js')
const fileMakerResponse = await fetchDataFromFileMaker({
  layout: Layouts.CUSTOMERS,
  action: Actions.CREATE,
  fieldData: fileMakerData
});
```

**After:**
```javascript
const response = await dataService.post('/api/filemaker/devCustomers/records', {
  fields: fileMakerData
});
```

#### src/components/financial/QboTestPanel.jsx

**2 direct calls (lines 485, 600):**
- Currently uses `fetchDataFromFileMaker` directly
- Convert to dataService calls
- Ensure QuickBooks integration still works

#### src/services/initializationService.js

**Remove FileMaker user context loading (lines 33-45):**

**Before:**
```javascript
export async function loadUserContext() {
  const userContext = await fetchDataFromFileMaker({
    layout: 'devCustomers',
    action: 'read',
    callBackName: 'returnContext'
  });
  return userContext;
}
```

**After:**
```javascript
// Remove function entirely
// User context comes from Supabase session in index.jsx
```

### Testing After Phase 1

**For each updated API file:**

1. Test READ operations:
   - [ ] List all records
   - [ ] Get single record by ID
   - [ ] Query with filters

2. Test WRITE operations:
   - [ ] CREATE new record
   - [ ] UPDATE existing record
   - [ ] DELETE record

3. Verify responses:
   - [ ] Data structure matches expected format
   - [ ] Error handling works correctly
   - [ ] No FileMaker-specific references in responses

**Build verification:**
```bash
npm run build
```

**Expected:** Build succeeds with no errors related to missing FileMaker imports

---

## Phase 2: Data Service Simplification

### Goal

Remove FileMaker routing logic from dataService.js and simplify to single HMAC-authenticated HTTP path.

### File to Modify

`src/services/dataService.js` (519 lines → ~270 lines)

### Changes Overview

**Remove (~250 lines):**
- FileMaker environment type constants
- `convertToFileMakerCall()` function
- FileMaker routing in request interceptor
- FileMaker response handling in response interceptor
- `convertFileMakerParamsToHTTP()` function
- `environmentAPI.fileMaker.*` methods

**Simplify (~50 lines):**
- Request interceptor - always add HMAC auth
- Response interceptor - standard HTTP handling only
- Environment context - hardcode or remove

### Step-by-Step Implementation

#### Step 2.1: Remove Environment Type Constants

**File:** `src/services/dataService.js`

**Lines 13-22 - REMOVE or SIMPLIFY:**

**Option A: Complete Removal (Recommended)**
```javascript
// Remove these entirely
export const ENVIRONMENT_TYPES = {
  FILEMAKER: 'filemaker',
  WEBAPP: 'webapp'
};

export const AUTH_METHODS = {
  FILEMAKER: 'filemaker',
  SUPABASE: 'supabase'
};
```

**Option B: Keep for Backward Compatibility (Temporary)**
```javascript
// Deprecated - will be removed in future version
export const ENVIRONMENT_TYPES = {
  WEBAPP: 'webapp' // Only webapp supported
};

export const AUTH_METHODS = {
  SUPABASE: 'supabase' // Only supabase supported
};
```

**Recommendation:** Option A - complete removal is cleaner

#### Step 2.2: Simplify Global Environment Context

**Lines 28-54 - MODIFY:**

**Before:**
```javascript
let currentEnvironment = {
  type: null,
  authentication: {
    isAuthenticated: false,
    method: null,
    user: null
  }
};

export const setEnvironmentContext = (environment) => {
  currentEnvironment = { ...environment };
  console.log('[DataService] Environment context set:', currentEnvironment);
};

export const getEnvironmentContext = () => {
  return currentEnvironment;
};
```

**After:**
```javascript
let currentEnvironment = {
  type: 'webapp', // Always webapp
  authentication: {
    isAuthenticated: false,
    method: 'supabase', // Always supabase
    user: null
  }
};

export const setEnvironmentContext = (environment) => {
  // Simplified - only update authentication, type is always 'webapp'
  currentEnvironment = {
    type: 'webapp',
    authentication: environment.authentication
  };
  console.log('[DataService] Authentication context set:', currentEnvironment.authentication);
};

export const getEnvironmentContext = () => {
  return currentEnvironment;
};
```

**Or even simpler - remove entirely and use only authentication state from AppStateContext**

#### Step 2.3: Remove convertToFileMakerCall Function

**Lines 114-161 - DELETE:**

```javascript
const convertToFileMakerCall = async (method, url, data = null) => {
  // ... 48 lines of FileMaker script execution
};
```

**This function is only called from response interceptor - remove both**

#### Step 2.4: Simplify Request Interceptor

**Lines 176-216 - SIMPLIFY:**

**Before (41 lines):**
```javascript
client.interceptors.request.use(
  async (config) => {
    const env = getEnvironmentContext();

    console.log('[DataService] Request interceptor:', {
      environment: env.type,
      method: config.method,
      url: config.url
    });

    // If FileMaker environment, convert to FileMaker call
    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
      console.log('[DataService] Routing through FileMaker');

      // Store original config for FileMaker conversion
      config._isFileMakerRequest = true;
      config._originalUrl = config.url;
      config._originalData = config.data;

      return config;
    }

    // Web app environment - add backend authentication
    if (env.type === ENVIRONMENT_TYPES.WEBAPP) {
      console.log('[DataService] Routing through backend API');

      const payload = config.data ? JSON.stringify(config.data) : '';
      const authHeader = await generateBackendAuthHeader(payload);
      config.headers.Authorization = authHeader;

      return config;
    }

    // No environment set - throw error
    throw new Error('Environment not detected. Please authenticate first.');
  },
  (error) => {
    console.error('[DataService] Request interceptor error:', error);
    return Promise.reject(error);
  }
);
```

**After (15 lines):**
```javascript
client.interceptors.request.use(
  async (config) => {
    console.log('[DataService] Request:', {
      method: config.method,
      url: config.url
    });

    // Always use backend API with HMAC authentication
    const payload = config.data ? JSON.stringify(config.data) : '';
    const authHeader = await generateBackendAuthHeader(payload);
    config.headers.Authorization = authHeader;

    return config;
  },
  (error) => {
    console.error('[DataService] Request interceptor error:', error);
    return Promise.reject(error);
  }
);
```

#### Step 2.5: Simplify Response Interceptor

**Lines 218-255 - SIMPLIFY:**

**Before (38 lines):**
```javascript
client.interceptors.response.use(
  async (response) => {
    // If this was a FileMaker request, we need to handle it differently
    if (response.config._isFileMakerRequest) {
      try {
        const fileMakerResponse = await convertToFileMakerCall(
          response.config.method.toUpperCase(),
          response.config._originalUrl,
          response.config._originalData
        );

        // Return in axios response format
        return {
          ...response,
          data: fileMakerResponse,
          status: 200,
          statusText: 'OK'
        };
      } catch (error) {
        console.error('[DataService] FileMaker call error:', error);
        throw error;
      }
    }

    return response;
  },
  (error) => {
    console.error('[DataService] Response interceptor error:', error);

    // Handle FileMaker-specific errors
    if (error.config && error.config._isFileMakerRequest) {
      return Promise.reject(new Error(`FileMaker API Error: ${error.message}`));
    }

    return Promise.reject(error);
  }
);
```

**After (10 lines):**
```javascript
client.interceptors.response.use(
  (response) => {
    // Standard HTTP response handling
    return response;
  },
  (error) => {
    console.error('[DataService] Response error:', error);
    return Promise.reject(error);
  }
);
```

#### Step 2.6: Remove Legacy Request Method

**Lines 327-375 - DELETE or SIMPLIFY:**

The `request()` method supports both FileMaker params and HTTP params. After Phase 1, all API calls use HTTP style, so simplify:

**Before:**
```javascript
export const request = async (params) => {
  // FileMaker-style params detection and conversion
  // HTTP-style params handling
};
```

**After:**
```javascript
export const request = async (params) => {
  // Only HTTP-style params supported
  const { method, url, data, headers } = params;
  return client.request({ method, url, data, headers });
};
```

Or remove entirely if not used outside dataService.

#### Step 2.7: Remove FileMaker Environment API

**Lines 458-517 - DELETE:**

```javascript
export const environmentAPI = {
  fileMaker: {
    performScript: async (scriptName, scriptParam) => {
      // ... FileMaker script execution
    },
    returnRecords: async (dataToReturn) => {
      // ... FileMaker callback
    },
    returnContext: async (contextData) => {
      // ... FileMaker context return
    }
  }
};
```

**This is only used for FileMaker bridge operations - delete entirely**

#### Step 2.8: Remove convertFileMakerParamsToHTTP

**Lines 383-453 - DELETE:**

No longer needed after Phase 1 API migration.

### Testing After Phase 2

**Request Interceptor:**
```javascript
// Test that all requests have HMAC auth header
const response = await dataService.get('/api/filemaker/devCustomers/records');
console.log(response.config.headers.Authorization); // Should be "Bearer {signature}.{timestamp}"
```

**Response Handling:**
```javascript
// Test standard HTTP responses work
const response = await dataService.get('/api/filemaker/devCustomers/records');
console.log(response.data); // Should be standard response object
```

**Build Verification:**
```bash
npm run build
```

**Expected:** Build succeeds, ~250 lines removed from dataService.js

---

## Phase 3: Authentication Simplification

### Goal

Remove FileMaker detection from SignIn component and simplify to Supabase-only authentication.

### Files to Modify

1. `src/components/auth/SignIn.jsx` (~60 lines removed)
2. `src/index.jsx` - authentication handlers (~80 lines simplified)

### Step-by-Step Implementation

#### Step 3.1: Update SignIn Component

**File:** `src/components/auth/SignIn.jsx`

**Remove (lines 24-66):**
```javascript
const detectFileMaker = useCallback(() => {
  const checkFileMaker = () => {
    const hasFMGofer = typeof window !== 'undefined' && window.FMGofer;
    const hasFileMaker = typeof window !== 'undefined' && window.FileMaker;

    if (hasFMGofer || hasFileMaker) {
      console.log('[SignIn] FileMaker environment detected');
      onFileMakerDetected();
      return true;
    }
    return false;
  };

  // Immediate check
  if (checkFileMaker()) {
    return;
  }

  // Wait for FileMaker bridge to load (up to 3 seconds)
  let attempts = 0;
  const maxAttempts = 30;

  const interval = setInterval(() => {
    attempts++;

    if (checkFileMaker()) {
      clearInterval(interval);
      return;
    }

    if (attempts >= maxAttempts) {
      console.log('[SignIn] FileMaker not detected, continuing with web app authentication');
      clearInterval(interval);
      onDetectionComplete();
    }
  }, 100);
}, [onFileMakerDetected, onDetectionComplete]);
```

**Remove useEffect (lines 69-72):**
```javascript
useEffect(() => {
  detectFileMaker();
}, [detectFileMaker]);
```

**Update Component Signature:**

**Before:**
```javascript
const SignIn = ({ onFileMakerDetected, onSupabaseAuth, onDetectionComplete }) => {
```

**After:**
```javascript
const SignIn = ({ onSupabaseAuth }) => {
```

**Update PropTypes:**

**Before:**
```javascript
SignIn.propTypes = {
  onFileMakerDetected: PropTypes.func.isRequired,
  onSupabaseAuth: PropTypes.func.isRequired,
  onDetectionComplete: PropTypes.func.isRequired
};
```

**After:**
```javascript
SignIn.propTypes = {
  onSupabaseAuth: PropTypes.func.isRequired
};
```

**Update JSDoc:**

**Before:**
```javascript
/**
 * SignIn Component
 *
 * Handles authentication for both FileMaker WebViewer and standalone web app environments.
 * Automatically detects environment and provides appropriate authentication method.
 *
 * @param {Function} onFileMakerDetected - Callback when FileMaker environment is detected
 * @param {Function} onSupabaseAuth - Callback when Supabase authentication succeeds
 * @param {Function} onDetectionComplete - Callback when environment detection completes
 */
```

**After:**
```javascript
/**
 * SignIn Component
 *
 * Handles Supabase authentication for the Clarity CRM web application.
 * Displays email/password form and triggers app initialization on successful authentication.
 *
 * @param {Function} onSupabaseAuth - Callback when Supabase authentication succeeds
 */
```

#### Step 3.2: Update App Authentication Handlers

**File:** `src/index.jsx`

**Remove handleFileMakerDetected (lines 117-139):**
```javascript
const handleFileMakerDetected = useCallback(() => {
  console.log('[App] FileMaker environment detected');

  setEnvironment(ENVIRONMENT_TYPES.FILEMAKER);
  setEnvironmentContext({
    type: ENVIRONMENT_TYPES.FILEMAKER,
    authentication: {
      isAuthenticated: true,
      method: AUTH_METHODS.FILEMAKER,
      user: null
    }
  });

  setAuthentication({
    isAuthenticated: true,
    method: AUTH_METHODS.FILEMAKER,
    user: null
  });

  console.log('[App] FileMaker environment set, waiting for bridge initialization');
}, [setEnvironment, setAuthentication]);
```

**Remove handleDetectionComplete (lines 157-160):**
```javascript
const handleDetectionComplete = useCallback(() => {
  setEnvironmentDetectionComplete(true);
}, [setEnvironmentDetectionComplete]);
```

**Simplify handleSupabaseAuth (lines 141-155):**

**Before:**
```javascript
const handleSupabaseAuth = useCallback((authState) => {
  console.log('[App] Supabase authentication successful', authState);

  setEnvironment(ENVIRONMENT_TYPES.WEBAPP);
  setEnvironmentContext({
    type: ENVIRONMENT_TYPES.WEBAPP,
    authentication: authState
  });

  setAuthentication(authState);

  console.log('[App] Supabase authentication set, starting initialization');
}, [setEnvironment, setAuthentication]);
```

**After:**
```javascript
const handleSupabaseAuth = useCallback((authState) => {
  console.log('[App] Supabase authentication successful', authState);

  // Set authentication context (environment is always 'webapp')
  setEnvironmentContext({
    type: 'webapp',
    authentication: authState
  });

  setAuthentication(authState);

  console.log('[App] Authentication complete, starting initialization');
}, [setAuthentication]);
```

**Update SignIn Component Usage:**

**Before:**
```javascript
<SignIn
  onFileMakerDetected={handleFileMakerDetected}
  onSupabaseAuth={handleSupabaseAuth}
  onDetectionComplete={handleDetectionComplete}
/>
```

**After:**
```javascript
<SignIn onSupabaseAuth={handleSupabaseAuth} />
```

### Testing After Phase 3

**Authentication Flow:**
1. Load application
2. Verify sign-in form displays immediately (no 3-second delay)
3. Enter valid credentials
4. Verify successful authentication
5. Verify app initializes correctly

**Console Checks:**
- [ ] No "FileMaker environment detected" messages
- [ ] No FileMaker bridge errors
- [ ] "Supabase authentication successful" message appears
- [ ] "Authentication complete, starting initialization" message appears

---

## Phase 4: Environment Detection Removal

### Goal

Remove environment type state management and simplify app initialization to single path.

### Files to Modify

1. `src/index.jsx` - initialization flow
2. `src/context/AppStateContext.jsx` - state shape
3. `src/services/initializationService.js` - remove FileMaker methods
4. `src/hooks/index.js` - remove useFileMakerBridge

### Step-by-Step Implementation

#### Step 4.1: Remove useFileMakerBridge Hook

**File:** `src/index.jsx`

**Remove import (line 9):**
```javascript
// Before
import { useCustomer, useProject, useTask, useFileMakerBridge, useProducts, useSales } from './hooks';

// After
import { useCustomer, useProject, useTask, useProducts, useSales } from './hooks';
```

**Remove hook usage (lines 25-32):**
```javascript
// Remove these lines
const shouldUseFileMakerBridge = appState.environment.type === ENVIRONMENT_TYPES.FILEMAKER;
const fileMakerBridge = shouldUseFileMakerBridge
  ? useFileMakerBridge()
  : { isReady: true, error: null, status: 'Web app mode - FileMaker bridge disabled' };

const { isReady: fmReady, error: fmError, status: fmStatus } = fileMakerBridge;
```

**Remove environment types import (line 16):**
```javascript
// Before
import { setEnvironmentContext, ENVIRONMENT_TYPES, AUTH_METHODS } from './services/dataService';

// After
import { setEnvironmentContext } from './services/dataService';
```

#### Step 4.2: Simplify Initialization Flow

**File:** `src/index.jsx` (lines 163-240)

**Before - Dual path initialization:**
```javascript
useEffect(() => {
  const initialize = async () => {
    if (!appState.authentication.isAuthenticated) {
      return;
    }

    if (appState.environment.type === ENVIRONMENT_TYPES.FILEMAKER) {
      // FileMaker initialization (lines 176-218)
      if (!fmReady) {
        console.log('[App] Waiting for FileMaker bridge to be ready...');
        return;
      }

      loadingStateManager.setLoading('initialization', true, 'Loading user context...');

      const userContext = await initializationService.loadUserContext();
      // ... more FileMaker-specific code
    } else if (appState.environment.type === ENVIRONMENT_TYPES.WEBAPP) {
      // Web app initialization (lines 219-240)
      loadingStateManager.setLoading('initialization', true, 'Initializing application...');

      const user = appState.authentication.user;
      // ... web app initialization
    }
  };

  initialize();
}, [appState.authentication.isAuthenticated, appState.environment.type, fmReady]);
```

**After - Single path initialization:**
```javascript
useEffect(() => {
  const initialize = async () => {
    if (!appState.authentication.isAuthenticated) {
      return;
    }

    loadingStateManager.setLoading('initialization', true, 'Initializing application...');

    try {
      // Get user from Supabase session
      const user = appState.authentication.user;

      setUser({
        userID: user.id,
        userEmail: user.email,
        userName: user.user_metadata?.name || user.email,
        supabaseUserID: user.id,
        supabaseOrgID: user.user_metadata?.organization_id
      });

      console.log('[App] User context set from Supabase session');

      // Load products (single-tenancy)
      await loadProducts();

      // Load sales if org ID available
      if (user.user_metadata?.organization_id) {
        await loadUnbilledSalesForOrganization(user.user_metadata.organization_id);
      }

      // Preload customers
      loadingStateManager.setLoading('initialization', true, 'Loading customers...');
      await loadCustomers();

      // Preload teams
      loadingStateManager.setLoading('initialization', true, 'Loading teams...');
      await loadTeams();

      loadingStateManager.setLoading('initialization', false);
      console.log('[App] Initialization complete');
    } catch (error) {
      console.error('[App] Initialization error:', error);
      loadingStateManager.setLoading('initialization', false);
    }
  };

  initialize();
}, [appState.authentication.isAuthenticated]);
```

**Key Changes:**
- Remove `fmReady` dependency
- Remove `appState.environment.type` dependency
- Remove FileMaker user context loading
- Use Supabase session user directly
- Single initialization path

#### Step 4.3: Update AppStateContext

**File:** `src/context/AppStateContext.jsx`

**Remove actions (lines 37-39):**
```javascript
// Remove these
SET_ENVIRONMENT: 'SET_ENVIRONMENT',
SET_ENVIRONMENT_DETECTION_COMPLETE: 'SET_ENVIRONMENT_DETECTION_COMPLETE',
```

**Simplify initial state (lines 68-78):**

**Before:**
```javascript
authentication: {
  isAuthenticated: false,
  user: null,
  method: null // 'filemaker' | 'supabase'
},
environment: {
  type: null, // 'filemaker' | 'webapp'
  detectionComplete: false
}
```

**After:**
```javascript
authentication: {
  isAuthenticated: false,
  user: null
  // method is always 'supabase' - no need to store
}
// environment is always 'webapp' - no need to store
```

**Remove reducer cases:**
```javascript
// Remove case for SET_ENVIRONMENT
// Remove case for SET_ENVIRONMENT_DETECTION_COMPLETE
```

**Remove operation hooks:**
```javascript
// Remove setEnvironment function
// Remove setEnvironmentDetectionComplete function
```

**Update useAppStateOperations return:**

**Before:**
```javascript
return {
  setAuthentication,
  setEnvironment,
  setEnvironmentDetectionComplete,
  // ... other operations
};
```

**After:**
```javascript
return {
  setAuthentication,
  // ... other operations (no environment operations)
};
```

#### Step 4.4: Update initializationService

**File:** `src/services/initializationService.js`

**Remove FileMaker import (line 1):**
```javascript
// Before
import { fetchDataFromFileMaker } from '../api/fileMaker';

// After
// Remove import entirely
```

**Remove waitForFileMaker function (lines 14-31):**
```javascript
// DELETE
export async function waitForFileMaker(maxAttempts = 30, intervalMs = 100) {
  // ... FileMaker bridge waiting logic
}
```

**Remove loadUserContext function (lines 33-45):**
```javascript
// DELETE
export async function loadUserContext() {
  const userContext = await fetchDataFromFileMaker({
    layout: 'devCustomers',
    action: 'read',
    callBackName: 'returnContext'
  });
  return userContext;
}
```

**Simplify fetchSupabaseUserId (lines 62-185):**

This function currently does email lookup. After changes, it's not needed because:
- User ID comes from Supabase session directly
- No need to look up by email

**Options:**
1. **Remove function entirely** - user ID is `appState.authentication.user.id`
2. **Keep for backward compatibility** - but simplify to direct return

**Keep loadProducts function** - already Supabase-only

#### Step 4.5: Remove useFileMakerBridge from Hooks

**File:** `src/hooks/index.js`

**Remove export (line 3-64):**
```javascript
// DELETE or comment out
export function useFileMakerBridge() {
  // ... 60+ lines of FileMaker bridge monitoring
}
```

**Verify no other files import this hook**

### Testing After Phase 4

**Initialization Flow:**
1. Load application
2. Sign in with valid credentials
3. Verify initialization completes successfully
4. Verify user context is set from Supabase session
5. Verify products, customers, teams load

**State Checks:**
```javascript
console.log(appState.authentication);
// Should have: { isAuthenticated: true, user: {...} }
// Should NOT have: { method: 'supabase' } or environment object
```

**Console Checks:**
- [ ] No FileMaker bridge messages
- [ ] "User context set from Supabase session" message
- [ ] "Initialization complete" message
- [ ] No errors

---

## Phase 5: Configuration Cleanup

### Goal

Remove FileMaker-related dependencies, environment variables, and files.

### Step-by-Step Implementation

#### Step 5.1: Remove npm Dependencies

**File:** `package.json`

**Remove fm-gofer package:**
```bash
npm uninstall fm-gofer
```

**Verify package.json no longer contains:**
```json
"fm-gofer": "^1.10.0"
```

**Update package-lock.json:**
```bash
npm install  # Regenerate lock file without fm-gofer
```

#### Step 5.2: Remove Environment Variables

**File:** `.env`, `.env.example`, `.env.production`, etc.

**Remove these variables:**
```bash
# Remove from all .env files
VITE_FM_URL
VITE_FM_DATABASE
VITE_FM_USER
VITE_FM_PASSWORD
```

**Keep these variables:**
```bash
# Keep these
VITE_SECRET_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_API_URL
```

#### Step 5.3: Remove or Archive FileMaker Files

**Files to Remove/Archive:**

1. **src/api/fileMaker.js** (500+ lines)
   - Core FileMaker bridge implementation
   - No longer needed after API migration

2. **src/services/dualWriteService.js** (359 lines)
   - FileMaker + Supabase synchronization
   - No longer relevant

**Options:**
- **Delete entirely** (recommended - clean break)
- **Move to archive folder** (if you want to preserve for reference)

**Archive approach:**
```bash
mkdir -p archive/filemaker-legacy
git mv src/api/fileMaker.js archive/filemaker-legacy/
git mv src/services/dualWriteService.js archive/filemaker-legacy/
```

**Delete approach:**
```bash
git rm src/api/fileMaker.js
git rm src/services/dualWriteService.js
```

#### Step 5.4: Update Exports

**File:** `src/api/index.js`

**Remove FileMaker exports:**
```javascript
// Before
export {
  fetchDataFromFileMaker,
  handleFileMakerOperation,
  validateParams,
  Layouts,
  Actions,
  initializeQuickBooks
} from './fileMaker';

// After
// Remove all FileMaker-related exports
// Or if initializeQuickBooks is needed, replace with direct backend call
```

**Verify no other files import from removed modules**

#### Step 5.5: Remove QuickBooks FileMaker Integration

**File:** `src/api/fileMaker.js` (if not fully deleted)

**initializeQuickBooks function (lines 447-500):**
- Currently calls FileMaker script: "Initialize QB via JS"
- Needs replacement with direct backend call

**Replacement:**

Create new function in `src/api/quickbooksApi.js`:

```javascript
export async function syncTimeEntries(customerId, recordsByProject) {
  try {
    const response = await dataService.post('/api/quickbooks/sync-time-entries', {
      customerId,
      recordsByProject
    });
    return response.data;
  } catch (error) {
    console.error('Failed to sync time entries:', error);
    throw error;
  }
}
```

**Update calls to initializeQuickBooks:**
- Find all usages (likely in QboTestPanel.jsx)
- Replace with syncTimeEntries

**⚠️ Requires backend endpoint:** `/api/quickbooks/sync-time-entries`
- Coordinate with backend team (see BCR-004 in BACKEND_API_REQUIREMENTS.md)

#### Step 5.6: Update .gitignore

**Verify .gitignore excludes:**
```
.env
.env.local
.env.production
```

**No changes needed** - just verify

### Testing After Phase 5

**Build Verification:**
```bash
npm run build
```

**Expected:** Build succeeds with no errors

**Dependency Check:**
```bash
npm list fm-gofer
```

**Expected:** Package not found

**Environment Variables:**
```bash
# Verify FileMaker variables not in use
grep -r "VITE_FM_" src/
```

**Expected:** No matches

**Import Verification:**
```bash
# Verify no imports from deleted files
grep -r "from './fileMaker'" src/
grep -r "from '../api/fileMaker'" src/
```

**Expected:** No matches

---

## Phase 6: Testing and Verification

### Goal

Comprehensive testing to ensure all functionality works without FileMaker dependencies.

### Test Plan

#### 6.1 Authentication Testing

**Test Cases:**

1. **Valid Login**
   - [ ] Enter valid email/password
   - [ ] Click sign in
   - [ ] Verify successful authentication
   - [ ] Verify redirect to main app

2. **Invalid Login**
   - [ ] Enter invalid password
   - [ ] Click sign in
   - [ ] Verify error message displayed
   - [ ] Verify able to retry

3. **Session Persistence**
   - [ ] Sign in successfully
   - [ ] Refresh browser
   - [ ] Verify session maintained
   - [ ] Verify no re-authentication required

4. **Logout**
   - [ ] Click logout
   - [ ] Verify session cleared
   - [ ] Verify redirect to login screen

5. **Network Error**
   - [ ] Disconnect network
   - [ ] Attempt sign in
   - [ ] Verify appropriate error message
   - [ ] Reconnect network
   - [ ] Verify retry works

#### 6.2 Initialization Testing

**Test Cases:**

1. **User Context Loading**
   - [ ] Sign in
   - [ ] Verify user name displayed in UI
   - [ ] Verify user email correct
   - [ ] Verify organization ID set (if applicable)

2. **Data Preloading**
   - [ ] Verify products load
   - [ ] Verify customers load
   - [ ] Verify teams load
   - [ ] Verify loading indicators display

3. **Initialization Performance**
   - [ ] Measure time from sign-in to app ready
   - [ ] Compare with pre-migration baseline
   - [ ] Should be faster (no 3-second FileMaker detection)

#### 6.3 CRUD Operations Testing

**For each entity (Customers, Projects, Tasks, Teams):**

**CREATE:**
- [ ] Create new record
- [ ] Verify record appears in list
- [ ] Verify data saved correctly
- [ ] Verify Supabase database has record

**READ:**
- [ ] List all records
- [ ] Get single record by ID
- [ ] Query with filters
- [ ] Verify data matches Supabase

**UPDATE:**
- [ ] Update existing record
- [ ] Verify changes reflected in UI
- [ ] Verify Supabase database updated
- [ ] Verify optimistic updates work

**DELETE:**
- [ ] Delete record
- [ ] Verify removed from list
- [ ] Verify Supabase database updated
- [ ] Verify soft delete if applicable

#### 6.4 Complex Workflows Testing

**Customer Workflow:**
1. [ ] Create new customer
2. [ ] Create project for customer
3. [ ] Create task for project
4. [ ] Start timer on task
5. [ ] Stop timer
6. [ ] Verify time entry created
7. [ ] Mark task complete
8. [ ] Verify all data correct

**Team Workflow:**
1. [ ] Create new team
2. [ ] Add staff members to team
3. [ ] Assign project to team
4. [ ] Verify team members can see project
5. [ ] Remove staff from team
6. [ ] Verify access removed

**Proposal Workflow:**
1. [ ] Create new proposal
2. [ ] Add deliverables
3. [ ] Add packages
4. [ ] Generate PDF
5. [ ] Send to prospect
6. [ ] Track proposal status

#### 6.5 Integration Testing

**QuickBooks Integration:**
- [ ] Create time entries
- [ ] Sync to QuickBooks
- [ ] Verify invoice created
- [ ] Verify time entries marked billed

**Mailjet Integration:**
- [ ] Send marketing email
- [ ] Verify email sent
- [ ] Track email opens
- [ ] Track link clicks

**Supabase Edge Functions:**
- [ ] Test proposal generation
- [ ] Test email sending
- [ ] Test data processing

#### 6.6 Error Handling Testing

**Test Cases:**

1. **Network Errors**
   - [ ] Disconnect network mid-operation
   - [ ] Verify error message displayed
   - [ ] Verify retry mechanism works

2. **Invalid Data**
   - [ ] Submit form with invalid data
   - [ ] Verify validation errors displayed
   - [ ] Verify data not saved

3. **Permission Errors**
   - [ ] Attempt unauthorized operation
   - [ ] Verify 403 error handled
   - [ ] Verify user-friendly message

4. **Server Errors**
   - [ ] Simulate 500 error
   - [ ] Verify error handled gracefully
   - [ ] Verify error logged

#### 6.7 Performance Testing

**Metrics to Track:**

1. **Initial Load Time**
   - [ ] Measure time to first render
   - [ ] Measure time to interactive
   - [ ] Compare with baseline

2. **Authentication Time**
   - [ ] Measure sign-in duration
   - [ ] Should be faster (no FileMaker detection)

3. **API Response Times**
   - [ ] Measure GET /customers
   - [ ] Measure GET /projects
   - [ ] Measure GET /tasks
   - [ ] Compare with baseline

4. **Bundle Size**
   - [ ] Measure production bundle size
   - [ ] Should be smaller (no fm-gofer)
   - [ ] Check for unused code

#### 6.8 Browser Compatibility Testing

**Test in:**
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

**For each browser:**
- [ ] Sign in works
- [ ] CRUD operations work
- [ ] No console errors
- [ ] UI renders correctly

#### 6.9 Code Quality Checks

**Static Analysis:**
```bash
# Check for FileMaker references
grep -r "FileMaker" src/
grep -r "filemaker" src/
grep -r "fm-gofer" src/
grep -r "FMGofer" src/
```

**Expected:** No matches (except in comments/docs)

**Build Verification:**
```bash
npm run build
```

**Expected:** Build succeeds with no warnings

**Type Checking (if using TypeScript):**
```bash
npm run type-check
```

**Expected:** No type errors

**Linting:**
```bash
npm run lint
```

**Expected:** No linting errors related to removed code

#### 6.10 Regression Testing Checklist

- [ ] All existing features work identically
- [ ] No functional changes to business logic
- [ ] UI appearance unchanged
- [ ] All forms submit correctly
- [ ] All modals open/close correctly
- [ ] All navigation works
- [ ] All data displays correctly
- [ ] All filters work
- [ ] All sorts work
- [ ] All pagination works

### Test Execution Strategy

**1. Automated Testing (if tests exist):**
```bash
npm test
```

**2. Manual Testing:**
- Use checklist above
- Document any issues found
- Create bug tickets for issues

**3. User Acceptance Testing:**
- Have product owner test critical workflows
- Get sign-off before deployment

### Test Results Documentation

Create `TEST_RESULTS.md`:

```markdown
# FileMaker Removal - Test Results

## Test Execution Date: [DATE]
## Tester: [NAME]

### Authentication Testing
- Valid Login: ✅ Pass
- Invalid Login: ✅ Pass
- Session Persistence: ✅ Pass
- Logout: ✅ Pass
- Network Error: ✅ Pass

### CRUD Operations
- Customers: ✅ Pass
- Projects: ✅ Pass
- Tasks: ✅ Pass
- Teams: ✅ Pass

### Issues Found
1. [Issue description]
   - Severity: [High/Medium/Low]
   - Status: [Open/Fixed]
   - Ticket: [Link]

### Performance Metrics
- Initial Load: 1.2s (baseline: 4.5s) - 73% improvement ✅
- Sign-in: 0.8s (baseline: 4.2s) - 81% improvement ✅
- Bundle Size: 450KB (baseline: 520KB) - 13% reduction ✅

### Recommendation
[ ] Ready for deployment
[ ] Needs fixes before deployment
```

---

## Phase 7: Documentation Updates

### Goal

Update all documentation to reflect removal of FileMaker integration.

### Files to Update

1. `CLAUDE.md` - Project instructions for Claude Code
2. `README.md` - Project overview
3. `requirements/platform-filemaker-removal/` - Migration documentation
4. Component JSDoc comments
5. API documentation

### Step-by-Step Implementation

#### Step 7.1: Update CLAUDE.md

**Sections to Modify:**

**1. Project Overview (lines 1-25):**

**Before:**
```markdown
Clarity CRM Frontend is a React-based customer relationship management system that operates in dual environments:
- **FileMaker WebViewer**: Embedded in FileMaker with fm-gofer bridge (LEGACY - being phased out)
- **Standalone Web App**: Independent web application with Supabase authentication (PRIMARY FOCUS)
```

**After:**
```markdown
Clarity CRM Frontend is a React-based customer relationship management system running as a standalone web application with Supabase authentication.

**Note:** FileMaker integration has been removed as of [DATE]. All data operations now route through Backend API + Supabase.
```

**2. Remove "CRITICAL: Backend Change Protocol" Section**
- FileMaker removal is complete, protocol no longer applies

**3. Update "Architecture Overview" (lines 27-90):**

**Remove:**
- Environment Detection and Authentication Flow section
- Dual environment discussion
- FileMaker bridge references

**Simplify to:**
```markdown
### Authentication Flow

The application uses Supabase for authentication:

1. **SignIn Component** ([src/components/auth/SignIn.jsx](src/components/auth/SignIn.jsx))
   - Email/password authentication via Supabase Auth
   - JWT-based session management
   - Sets authentication context on successful login

2. **Data Service** ([src/services/dataService.js](src/services/dataService.js))
   - All requests authenticated with HMAC-SHA256
   - Automatic authentication header injection via axios interceptors
   - Supports both Backend API and direct Supabase operations

3. **Initialization** ([src/index.jsx](src/index.jsx))
   - Loads user context from Supabase session
   - Preloads customers, teams, products
   - Single initialization path (no environment detection)
```

**4. Update "Data Flow Pattern" Section:**

**Remove FileMaker environment routing references**

**Update to:**
```markdown
### Data Flow Pattern

```
App (index.jsx)
  ├─ AppStateContext (global state)
  ├─ Supabase Authentication
  ├─ Initialization (initializationService)
  │   ├─ User context from Supabase session
  │   └─ Preload customers/teams
  ├─ AppLayout (theme, layout structure)
  │   ├─ Sidebar (navigation)
  │   └─ MainContent (routing)
  └─ Custom Hooks (data operations)
      └─ API Calls (Backend API with HMAC auth)
```
```

**5. Remove FileMaker Integration Section Entirely:**
- Remove all FileMaker WebViewer references
- Remove fm-gofer documentation
- Remove FileMaker bridge hooks section

**6. Update "External Integrations" Section:**

**Remove:**
```markdown
### FileMaker Integration
- **Bridge:** fm-gofer library (`useFileMakerBridge` hook)
- **Layouts:** devCustomers, devProjects, devTasks, devRecords
- **Server:** `https://server.claritybusinesssolutions.ca/fmi/data/v1`
- **Database:** clarityCRM
```

**7. Update "Backend Integration" Section:**

**Simplify to:**
```markdown
## Backend Integration

**Backend API:** `https://api.claritybusinesssolutions.ca`

**Authentication:** All backend requests use HMAC-SHA256 authentication
- Secret key: `VITE_SECRET_KEY` (from `.env`)
- Format: `Bearer {signature}.{timestamp}`
- Handled automatically by axios request interceptor

**API Documentation:**
- OpenAPI spec: `https://api.claritybusinesssolutions.ca/openapi.json`
- Interactive docs: `https://api.claritybusinesssolutions.ca/docs`

**Endpoints:**
- `/filemaker/{layout}/records` - CRUD operations (queries Supabase)
- Direct Supabase endpoints available for advanced queries
```

**8. Update Environment Variables Section:**

**Remove FileMaker variables:**
```markdown
## Environment Variables

Required variables in `.env`:
- `VITE_APP_NAME`, `VITE_VERSION`
- `VITE_API_URL`, `VITE_SECRET_KEY`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_SERVICE_ROLE_KEY`
- `VITE_QB_CLIENT_ID`, `VITE_QB_CLIENT_SECRET`
- `VITE_MAILJET_API_KEY`, `VITE_MAILJET_SECRET_KEY`

**Removed (FileMaker integration deprecated):**
- ~~`VITE_FM_URL`~~
- ~~`VITE_FM_DATABASE`~~
- ~~`VITE_FM_USER`~~
- ~~`VITE_FM_PASSWORD`~~
```

**9. Update "Common Pitfalls" Section:**

**Remove:**
- FileMaker Bridge pitfalls
- Environment Detection pitfalls
- Dual Environments pitfalls

**Keep:**
- Supabase authentication pitfalls
- Backend API pitfalls
- Loading state pitfalls

#### Step 7.2: Update README.md

**Update Project Description:**

**Before:**
```markdown
A modern CRM system built with React, supporting both FileMaker WebViewer and standalone web app deployments.
```

**After:**
```markdown
A modern CRM system built with React, Supabase, and FastAPI backend.
```

**Update Features Section:**

**Remove:**
- Dual-environment support
- FileMaker integration

**Add:**
- Single-page application architecture
- Supabase authentication and real-time features
- HMAC-authenticated backend API

**Update Architecture Diagram:**

Remove FileMaker components, show:
- Frontend (React + Vite)
- Backend API (FastAPI)
- Supabase (Auth + Database)
- External integrations (QuickBooks, Mailjet)

**Update Installation Instructions:**

**Remove FileMaker setup steps**

**Simplify to:**
```markdown
## Installation

1. Clone repository
2. Install dependencies: `npm install`
3. Configure environment variables (see `.env.example`)
4. Start dev server: `npm run dev`
```

**Update Deployment Section:**

**Remove:**
```markdown
npm run deploy-to-fm  # Build and upload to FileMaker server
```

**Keep:**
```markdown
npm run build         # Build for production
npm run preview       # Preview production build
```

#### Step 7.3: Update Component JSDoc

**Files with JSDoc to Update:**

1. **src/components/auth/SignIn.jsx**
   - Already updated in Phase 3

2. **src/services/dataService.js**
   - Update function comments
   - Remove FileMaker-specific parameter documentation

3. **src/api/*.js**
   - Update function comments
   - Remove references to FileMaker layouts/actions

**Pattern:**

**Before:**
```javascript
/**
 * Fetch customers from FileMaker or Backend API depending on environment
 *
 * @returns {Promise<Array>} Array of customer records in FileMaker format
 */
```

**After:**
```javascript
/**
 * Fetch all customers from Supabase via Backend API
 *
 * @returns {Promise<Array>} Array of customer records
 */
```

#### Step 7.4: Create Migration Completion Document

**File:** `requirements/platform-filemaker-removal/MIGRATION_COMPLETE.md`

```markdown
# FileMaker Removal - Migration Complete

**Completion Date:** [DATE]
**Migration Duration:** [X hours/days]
**Team:** [Names]

## Summary

Successfully removed all FileMaker dependencies from Clarity CRM Frontend.

## Changes Made

### Code Changes
- Removed ~500 lines of FileMaker integration code
- Updated 22 files across API, services, and components
- Simplified authentication to Supabase-only
- Simplified data routing to Backend API + Supabase

### Dependencies Removed
- fm-gofer (^1.10.0)

### Environment Variables Removed
- VITE_FM_URL
- VITE_FM_DATABASE
- VITE_FM_USER
- VITE_FM_PASSWORD

### Files Deleted
- src/api/fileMaker.js (501 lines)
- src/services/dualWriteService.js (359 lines)

## Benefits

1. **Simplified Architecture**
   - Single authentication path
   - Single data routing path
   - Reduced complexity

2. **Performance Improvements**
   - Faster initial load (no 3-second detection delay)
   - Smaller bundle size (~70KB reduction)
   - Faster authentication flow

3. **Maintainability**
   - ~500 fewer lines to maintain
   - Clearer code paths
   - Easier onboarding for new developers

4. **Security**
   - Reduced attack surface
   - Single authentication method to secure
   - Consistent HMAC authentication

## Test Results

[Link to TEST_RESULTS.md]

## Known Issues

[List any issues or follow-up work needed]

## Follow-up Work

- [ ] Monitor production metrics
- [ ] Update user documentation
- [ ] Train support team on changes
- [ ] Archive FileMaker legacy code

## References

- Migration Plan: [MIGRATION_PLAN.md](MIGRATION_PLAN.md)
- Backend Requirements: [BACKEND_API_REQUIREMENTS.md](BACKEND_API_REQUIREMENTS.md)
- Architecture Documentation: [architecture.md](architecture.md)
```

#### Step 7.5: Update API Documentation

If you have separate API documentation:

**Update endpoint documentation:**
- Remove FileMaker layout references
- Document Supabase table mappings
- Update authentication examples
- Update response format examples

**Example:**

**Before:**
```markdown
## GET /filemaker/devCustomers/records

Fetches customer records from FileMaker database.

**FileMaker Layout:** devCustomers
```

**After:**
```markdown
## GET /filemaker/devCustomers/records

Fetches customer records from Supabase `customers` table.

**Supabase Table:** customers
```

### Documentation Review Checklist

- [ ] CLAUDE.md updated (all FileMaker references removed)
- [ ] README.md updated (simplified architecture)
- [ ] Component JSDoc updated (no FileMaker mentions)
- [ ] API documentation updated (Supabase focus)
- [ ] Migration completion document created
- [ ] Test results documented
- [ ] Changelog updated
- [ ] Release notes prepared

---

## Rollback Plan

### When to Rollback

Rollback if any of these occur:
- Critical bug preventing app usage
- Data loss or corruption
- Authentication completely broken
- Unable to perform core CRUD operations

### Rollback Procedure

#### Quick Rollback (Git Revert)

**If migration in single commit:**
```bash
# Revert the migration commit
git revert HEAD

# Push to remote
git push origin main
```

**If migration in feature branch:**
```bash
# Switch back to main
git checkout main

# Reset to pre-migration state
git reset --hard pre-filemaker-removal

# Force push (⚠️ only if safe to do so)
git push --force origin main
```

#### Partial Rollback (Phase-by-Phase)

If only certain phases have issues:

**Phase 1 Issue (API Layer):**
```bash
# Restore original API files from git
git checkout HEAD~1 src/api/customers.js
git checkout HEAD~1 src/api/projects.js
# ... restore other API files

# Restore fileMaker.js
git checkout HEAD~1 src/api/fileMaker.js
```

**Phase 2 Issue (Data Service):**
```bash
# Restore dataService.js
git checkout HEAD~1 src/services/dataService.js
```

**Phase 3 Issue (Authentication):**
```bash
# Restore SignIn component
git checkout HEAD~1 src/components/auth/SignIn.jsx

# Restore index.jsx handlers
git checkout HEAD~1 src/index.jsx
```

#### Full Rollback with Tag

**Using pre-migration tag:**
```bash
# Checkout tag
git checkout pre-filemaker-removal

# Create rollback branch
git checkout -b rollback-filemaker-removal

# Push branch
git push origin rollback-filemaker-removal

# Merge to main if needed
git checkout main
git merge rollback-filemaker-removal
```

### Post-Rollback Actions

1. **Notify Team:**
   - Inform development team of rollback
   - Document reason for rollback
   - Schedule post-mortem

2. **Investigate Issues:**
   - Review logs for errors
   - Identify root cause
   - Document findings

3. **Fix and Retry:**
   - Address identified issues
   - Test fixes locally
   - Re-attempt migration

### Rollback Testing

After rollback, verify:
- [ ] Application loads
- [ ] Authentication works
- [ ] CRUD operations work
- [ ] FileMaker integration functional (if rolled back to pre-migration)

---

## Success Criteria

### Technical Success Criteria

**Code Quality:**
- [ ] Build succeeds with no errors or warnings
- [ ] No references to 'FileMaker' in active code (excluding docs/comments)
- [ ] No references to 'fm-gofer' anywhere
- [ ] No FileMaker environment variables in use
- [ ] ~500 lines of code removed
- [ ] All linting passes

**Functionality:**
- [ ] All authentication flows work
- [ ] All CRUD operations work for all entities
- [ ] All complex workflows work (end-to-end)
- [ ] All integrations work (QuickBooks, Mailjet)
- [ ] No console errors or warnings
- [ ] No FileMaker-related errors

**Performance:**
- [ ] Initial load faster than baseline (no 3s detection)
- [ ] Bundle size smaller than baseline
- [ ] API response times comparable or better
- [ ] No performance regressions

**Testing:**
- [ ] All automated tests pass
- [ ] All manual test cases pass
- [ ] All browsers tested and working
- [ ] User acceptance testing complete

### Business Success Criteria

**User Experience:**
- [ ] Faster authentication (no detection delay)
- [ ] All features work identically
- [ ] No data loss
- [ ] No disruption to workflows
- [ ] Improved reliability

**Operational:**
- [ ] Simplified architecture
- [ ] Easier to maintain
- [ ] Easier to onboard new developers
- [ ] Reduced dependencies
- [ ] Clearer code paths

**Documentation:**
- [ ] All documentation updated
- [ ] Migration documented
- [ ] Test results documented
- [ ] User guides updated (if applicable)

### Sign-off Checklist

**Development Team:**
- [ ] Code review complete
- [ ] All tests passing
- [ ] Documentation complete

**QA Team:**
- [ ] Test plan executed
- [ ] All test cases passing
- [ ] Regression testing complete
- [ ] Sign-off provided

**Product Owner:**
- [ ] User acceptance testing complete
- [ ] All requirements met
- [ ] Sign-off provided

**DevOps:**
- [ ] Deployment plan reviewed
- [ ] Environment variables updated
- [ ] Monitoring in place
- [ ] Ready for production

---

## Appendix

### A. FileMaker to HTTP Conversion Reference

**Quick reference table for common conversions:**

| FileMaker Pattern | HTTP Equivalent |
|------------------|-----------------|
| `layout: Layouts.CUSTOMERS, action: Actions.READ` | `GET /api/filemaker/devCustomers/records` |
| `layout: Layouts.CUSTOMERS, action: Actions.READ, query: [{"__ID": id}]` | `GET /api/filemaker/devCustomers/records/${id}` |
| `layout: Layouts.CUSTOMERS, action: Actions.CREATE, fieldData: data` | `POST /api/filemaker/devCustomers/records` with `{ fields: data }` |
| `layout: Layouts.CUSTOMERS, action: Actions.UPDATE, recordId: id, fieldData: data` | `PATCH /api/filemaker/devCustomers/records/${id}` with `{ fields: data }` |
| `layout: Layouts.CUSTOMERS, action: Actions.DELETE, recordId: id` | `DELETE /api/filemaker/devCustomers/records/${id}` |
| `layout: Layouts.CUSTOMERS, action: Actions.READ, query: filters` | `POST /api/filemaker/devCustomers/_find` with `{ query: filters }` |

### B. Common Issues and Solutions

**Issue 1: "Cannot find module './fileMaker'"**
- **Cause:** Import not updated after removing fileMaker.js
- **Solution:** Update import to use dataService instead

**Issue 2: "Layout is not defined"**
- **Cause:** Layouts constant no longer available
- **Solution:** Use endpoint path directly (e.g., '/api/filemaker/devCustomers/records')

**Issue 3: "Actions is not defined"**
- **Cause:** Actions constant no longer available
- **Solution:** Use HTTP method directly (GET, POST, PATCH, DELETE)

**Issue 4: "ENVIRONMENT_TYPES is not defined"**
- **Cause:** Environment type constants removed
- **Solution:** Remove environment type checks, assume 'webapp'

**Issue 5: "fetchDataFromFileMaker is not defined"**
- **Cause:** Function removed after API migration
- **Solution:** Replace with dataService.get/post/patch/delete call

**Issue 6: "useFileMakerBridge is not defined"**
- **Cause:** Hook removed in Phase 4
- **Solution:** Remove hook usage, no longer needed

### C. Verification Commands

**Search for FileMaker references:**
```bash
# Find any FileMaker mentions
grep -r "FileMaker" src/ --exclude-dir=node_modules

# Find fm-gofer mentions
grep -r "fm-gofer" . --exclude-dir=node_modules

# Find FMGofer mentions
grep -r "FMGofer" src/ --exclude-dir=node_modules

# Find environment type checks
grep -r "ENVIRONMENT_TYPES" src/ --exclude-dir=node_modules

# Find fetchDataFromFileMaker calls
grep -r "fetchDataFromFileMaker" src/ --exclude-dir=node_modules

# Find FileMaker layout references
grep -r "Layouts\." src/ --exclude-dir=node_modules

# Find FileMaker action references
grep -r "Actions\." src/ --exclude-dir=node_modules
```

**Expected output:** No matches (or only in documentation/comments)

### D. Contact Information

**For Issues During Migration:**

- **Technical Lead:** [Name/Email]
- **Backend Team:** [Contact]
- **DevOps:** [Contact]
- **Product Owner:** [Contact]

**Escalation Path:**
1. Check this migration plan
2. Review test results
3. Contact technical lead
4. Escalate to product owner if business impact

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-10 | Claude Code | Initial migration plan created |
| | | | |

---

**End of Migration Plan**

This document provides comprehensive guidance for removing FileMaker integration from Clarity CRM Frontend. Follow phases sequentially, test thoroughly at each step, and maintain clear communication with team throughout migration process.
