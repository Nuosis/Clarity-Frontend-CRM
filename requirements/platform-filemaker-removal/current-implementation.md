# Current FileMaker Integration Implementation

Complete technical documentation of FileMaker bridge architecture and integration touchpoints in the Clarity CRM Frontend.

**Last Updated:** 2026-01-11
**Purpose:** Phase 2 implementation reference for FileMaker removal

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Bridge Initialization](#bridge-initialization)
3. [Environment Detection](#environment-detection)
4. [Request Routing](#request-routing)
5. [API Layer Implementation](#api-layer-implementation)
6. [Complete Integration Inventory](#complete-integration-inventory)
7. [Removal Impact Analysis](#removal-impact-analysis)

---

## Architecture Overview

### Dual-Environment System

The application operates in two distinct environments with automatic detection and routing:

**FileMaker WebViewer Mode:**
- Embedded in FileMaker Pro Advanced via WebViewer
- fm-gofer bridge library provides JavaScript → FileMaker script communication
- All data operations route through FileMaker layouts
- Authentication handled by FileMaker session
- Uses `window.FileMaker.PerformScript()` for native calls

**Standalone Web App Mode:**
- Independent browser application
- Direct communication with backend API
- Supabase JWT authentication
- HMAC-SHA256 request signing
- Standard HTTP REST API calls

### Integration Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Component Layer                                              │
│ (React components make API calls)                           │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ API Layer                                                    │
│ - fetchDataFromFileMaker() wrapper                          │
│ - FileMaker Layouts and Actions constants                   │
│ - handleFileMakerOperation() error wrapper                  │
└─────────────────┬───────────────────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
┌──────────────────┐ ┌──────────────────┐
│ FileMaker Path   │ │ Backend API Path │
└────────┬─────────┘ └─────────┬────────┘
         │                     │
         ▼                     ▼
┌──────────────────┐ ┌──────────────────┐
│ dataService.js   │ │ dataService.js   │
│ (interceptors)   │ │ (HMAC auth)      │
└────────┬─────────┘ └─────────┬────────┘
         │                     │
         ▼                     ▼
┌──────────────────┐ ┌──────────────────┐
│ FMGofer Bridge   │ │ Axios HTTP       │
│ PerformScript()  │ │ Request          │
└────────┬─────────┘ └─────────┬────────┘
         │                     │
         ▼                     ▼
┌──────────────────┐ ┌──────────────────┐
│ FileMaker        │ │ Backend API      │
│ Database         │ │ (Supabase)       │
└──────────────────┘ └──────────────────┘
```

---

## Bridge Initialization

### FMGofer Message Event Listener

**Location:** `src/api/fileMaker.js:1-24`

The FileMaker bridge initializes through a message event listener that sets up the global FileMaker object:

```javascript
let bridgeInitialized = false;

if (typeof window !== "undefined") {
    window.addEventListener('message', (event) => {
        if (event.data.type === 'FM_BRIDGE_READY') {
            if (!bridgeInitialized) {
                window.FileMaker = event.data.api;
                bridgeInitialized = true;
                console.log('[FileMaker] Bridge initialized via message event');
            }
        }
    });
}
```

**Initialization Sequence:**

1. FileMaker WebViewer loads the React application
2. FMGofer library in FileMaker sends `FM_BRIDGE_READY` postMessage
3. Message event listener receives the event
4. `window.FileMaker` object is set from `event.data.api`
5. `bridgeInitialized` flag prevents duplicate setup

### Dual Bridge Detection

**Location:** `src/api/fileMaker.js:30-36`

```javascript
function isFileMakerEnvironment() {
    const hasFMGofer = typeof FMGofer !== 'undefined' && FMGofer.PerformScript;
    const hasFileMaker = typeof window !== 'undefined' &&
                         window.FileMaker &&
                         window.FileMaker.PerformScript;

    return hasFMGofer || hasFileMaker;
}
```

**Detection Paths:**
1. **FMGofer npm package:** Checks for `FMGofer.PerformScript` (direct library import)
2. **Window object:** Checks for `window.FileMaker.PerformScript` (message event initialization)

Either path indicates FileMaker environment availability.

---

## Environment Detection

### SignIn Component Detection Flow

**Location:** `src/components/auth/SignIn.jsx:24-66`

The SignIn component performs automatic FileMaker detection on mount using a polling strategy:

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
    const maxAttempts = 30; // 3 seconds with 100ms intervals

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

**Detection Strategy:**
1. **Immediate Check:** First checks if `window.FMGofer` or `window.FileMaker` exists
2. **Polling:** If not found, polls every 100ms for up to 3 seconds (30 attempts)
3. **Timeout:** After 3 seconds, proceeds to Supabase authentication form
4. **Silent Operation:** No user action required during detection

### Global Environment Context

**Location:** `src/services/dataService.js:13-54`

Environment context is stored as module-level state that routes all subsequent data operations:

```javascript
export const ENVIRONMENT_TYPES = {
  FILEMAKER: 'filemaker',
  WEBAPP: 'webapp'
};

export const AUTH_METHODS = {
  FILEMAKER: 'filemaker',
  SUPABASE: 'supabase'
};

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

### Context Setting Handlers

**Location:** `src/index.jsx:117-155`

**FileMaker Detection Handler:**
```javascript
const handleFileMakerDetected = useCallback(() => {
    setEnvironment(ENVIRONMENT_TYPES.FILEMAKER);
    setEnvironmentContext({
        type: ENVIRONMENT_TYPES.FILEMAKER,
        authentication: {
            isAuthenticated: true,
            method: AUTH_METHODS.FILEMAKER,
            user: null // Will be set after user context is loaded
        }
    });
}, [setEnvironment, setAuthentication]);
```

**Supabase Authentication Handler:**
```javascript
const handleSupabaseAuth = useCallback((authState) => {
    setEnvironment(ENVIRONMENT_TYPES.WEBAPP);
    setEnvironmentContext({
        type: ENVIRONMENT_TYPES.WEBAPP,
        authentication: authState
    });
}, [setEnvironment, setAuthentication]);
```

**State Flow:**
```
SignIn Component Detects Environment
  ↓
Calls handleFileMakerDetected() OR handleSupabaseAuth()
  ↓
setEnvironmentContext() sets global module state
  ↓
All subsequent dataService calls read getEnvironmentContext()
  ↓
Requests automatically routed to correct backend
```

---

## Request Routing

### Axios Interceptors with Environment-Aware Routing

**Location:** `src/services/dataService.js:165-258`

The data service creates an axios client with interceptors that automatically route requests based on environment:

**Request Interceptor (lines 176-216):**
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

**Response Interceptor (lines 218-255):**
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

### convertToFileMakerCall Function

**Location:** `src/services/dataService.js:108-161`

Transforms HTTP-style API calls into FileMaker script calls:

```javascript
const convertToFileMakerCall = async (method, url, data = null) => {
  // Check for FileMaker bridge availability
  const hasFMGofer = typeof FMGofer !== 'undefined' && FMGofer.PerformScript;
  const hasFileMaker = typeof window !== 'undefined' &&
                       window.FileMaker &&
                       window.FileMaker.PerformScript;

  if (!hasFMGofer && !hasFileMaker) {
    throw new Error('FileMaker bridge not available');
  }

  // Extract endpoint from URL
  const urlParts = new URL(url);
  const endpoint = urlParts.pathname.replace('/api/', '');

  // Prepare script parameters
  const scriptParams = {
    action: 'apiCall',
    method,
    endpoint,
    data: data || {},
    query: Object.fromEntries(urlParts.searchParams)
  };

  try {
    let result;

    // Use FMGofer for async operations (preferred)
    if (hasFMGofer) {
      result = await FMGofer.PerformScript('JS * Fetch Data', JSON.stringify(scriptParams));
    } else {
      // Fallback to FileMaker.PerformScript for sync operations
      result = window.FileMaker.PerformScript('JS * Fetch Data', JSON.stringify(scriptParams));
    }

    // Parse FileMaker response
    if (typeof result === 'string') {
      try {
        return JSON.parse(result);
      } catch (parseError) {
        return { data: result };
      }
    }

    return result;
  } catch (error) {
    console.error('FileMaker script execution error:', error);
    throw new Error(`FileMaker API call failed: ${error.message}`);
  }
};
```

**Transformation Examples:**

| HTTP Request | Extracted Endpoint | Script Parameters |
|--------------|-------------------|-------------------|
| `GET /api/customers` | `customers` | `{ action: 'apiCall', method: 'GET', endpoint: 'customers', data: {}, query: {} }` |
| `POST /api/customers` with body | `customers` | `{ action: 'apiCall', method: 'POST', endpoint: 'customers', data: {...}, query: {} }` |
| `GET /api/customers?filter=active` | `customers` | `{ action: 'apiCall', method: 'GET', endpoint: 'customers', data: {}, query: {filter: 'active'} }` |

**Critical FileMaker Script:** All requests route through single script `JS * Fetch Data`
- Receives JSON string parameter
- Parses `action`, `method`, `endpoint`, `data`, `query` fields
- Routes to appropriate FileMaker layout and operation
- Returns JSON response

### HMAC Authentication

**Location:** `src/services/dataService.js:57-105`

Web app requests use HMAC-SHA256 signatures for backend API authentication:

```javascript
const generateBackendAuthHeader = async (payload = '') => {
  const secretKey = import.meta.env.VITE_SECRET_KEY;

  if (!secretKey) {
    console.warn('[DataService] SECRET_KEY not available. Using development mode.');
    const timestamp = Math.floor(Date.now() / 1000);
    return `Bearer dev-token.${timestamp}`;
  }

  // Check if Web Crypto API is available
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    console.warn('[DataService] Web Crypto API not available. Using fallback auth.');
    const timestamp = Math.floor(Date.now() / 1000);
    return `Bearer fallback-token.${timestamp}`;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${timestamp}.${payload}`;

  try {
    // Use Web Crypto API for HMAC-SHA256
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const signatureHex = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return `Bearer ${signatureHex}.${timestamp}`;
  } catch (error) {
    console.warn('[DataService] Crypto operation failed, using fallback:', error);
    return `Bearer fallback-token.${timestamp}`;
  }
};
```

**Authentication Format:**
```
Authorization: Bearer {hmac_signature}.{timestamp}
```

**Signature Calculation:**
```
message = timestamp + "." + JSON.stringify(payload)
signature = HMAC-SHA256(secret_key, message)
authHeader = "Bearer " + hex(signature) + "." + timestamp
```

---

## API Layer Implementation

### fetchDataFromFileMaker Pattern

**Primary Implementation:** `src/api/fileMaker.js:263-282`

```javascript
export async function fetchDataFromFileMaker(params, attempt = 0, isAsync = true) {
  // Check app environment context
  const appElement = document.querySelector('[data-app-environment]');
  const appEnvironment = appElement?.getAttribute('data-app-environment');

  const useFileMakerBridge = appEnvironment === 'filemaker' ||
    (appEnvironment === null && isFileMakerEnvironment());

  if (useFileMakerBridge) {
    return await handleFileMakerNativeCall(params, attempt, isAsync);
  } else {
    return await callBackendAPI(params);
  }
}
```

### FileMaker Layouts and Actions

**Layouts Constant:** `src/api/fileMaker.js:411-423`
```javascript
export const Layouts = {
    CUSTOMERS: 'devCustomers',
    PROJECTS: 'devProjects',
    TASKS: 'devTasks',
    RECORDS: 'dapiRecords',
    NOTES: 'devNotes',
    LINKS: 'devLinks',
    IMAGES: 'devImages',
    PROJECT_IMAGES: 'devProjectImages',
    PROJECT_LINKS: 'devProjectLinks',
    PROJECT_OBJECTIVES: 'devProjectObjectives',
    PROJECT_OBJ_STEPS: 'devProjectObjSteps'
};
```

**Actions Constant:** `src/api/fileMaker.js:428-435`
```javascript
export const Actions = {
    READ: 'read',
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    METADATA: 'metaData',
    DUPLICATE: 'duplicate'
};
```

### API Module Pattern

All API modules follow this pattern:

```javascript
import {
    fetchDataFromFileMaker,
    handleFileMakerOperation,
    validateParams,
    Layouts,
    Actions
} from './fileMaker';

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

export async function updateCustomer(customerId, data) {
    validateParams({ customerId, data }, ['customerId', 'data']);

    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.CUSTOMERS,
            action: Actions.UPDATE,
            recordId: customerId,
            fieldData: data
        };

        return await fetchDataFromFileMaker(params);
    });
}
```

---

## Complete Integration Inventory

### Core FileMaker Bridge (3 files)

**FMGofer Imports:**
```javascript
src/services/dataService.js:9          import FMGofer from 'fm-gofer';
src/services/mailjetService.js:6       import FMGofer from 'fm-gofer';
src/api/fileMaker.js:1                 import FMGofer from 'fm-gofer';
```

**FMGofer.PerformScript Usage:**
```javascript
// dataService.js (5 references)
dataService.js:116    const hasFMGofer = typeof FMGofer !== 'undefined' && FMGofer.PerformScript;
dataService.js:141    result = await FMGofer.PerformScript('JS * Fetch Data', JSON.stringify(scriptParams));
dataService.js:471    const hasFMGofer = typeof FMGofer !== 'undefined' && FMGofer.PerformScript;
dataService.js:480    return await FMGofer.PerformScript(scriptName, scriptParam);

// fileMaker.js (2 references)
fileMaker.js:32       const hasFMGofer = typeof FMGofer !== 'undefined' && FMGofer.PerformScript;
fileMaker.js:323      FMGofer.PerformScript("JS * Fetch Data", param)

// mailjetService.js (2 references)
mailjetService.js:25  const configJson = await FMGofer.PerformScript('JS * Fetch Data', payload);
mailjetService.js:178 const responseJson = await FMGofer.PerformScript('JS * Fetch Data', JSON.stringify(scriptParams));
```

### API Layer (11 files with fetchDataFromFileMaker)

**1. Customers API** - 7 calls
**2. Projects API** - 9 calls
**3. Tasks API** - 13 calls
**4. Teams API** - 15 calls
**5. Notes API** - 1 call
**6. Links API** - 1 call
**7. Financial Records API** - 10 calls
**8. Customer Activity API** - 2 calls
**9. Prospects API** - 1 dynamic import
**10. QboTestPanel Component** - 2 direct calls
**11. Initialization Service** - 1 call

**Total fetchDataFromFileMaker calls:** 60+ locations

### Environment Detection (4 files)

**ENVIRONMENT_TYPES Usage:**
```javascript
// dataService.js (3 references)
dataService.js:187    if (env.type === ENVIRONMENT_TYPES.FILEMAKER)
dataService.js:199    if (env.type === ENVIRONMENT_TYPES.WEBAPP)
dataService.js:339    if (env.type === ENVIRONMENT_TYPES.FILEMAKER)

// index.jsx (12 references)
index.jsx:27          const shouldUseFileMakerBridge = appState.environment.type === ENVIRONMENT_TYPES.FILEMAKER;
index.jsx:121         setEnvironment(ENVIRONMENT_TYPES.FILEMAKER);
index.jsx:123         type: ENVIRONMENT_TYPES.FILEMAKER,
index.jsx:145         setEnvironment(ENVIRONMENT_TYPES.WEBAPP);
index.jsx:147         type: ENVIRONMENT_TYPES.WEBAPP,
index.jsx:176         if (appState.environment.type === ENVIRONMENT_TYPES.FILEMAKER)
index.jsx:206         else if (appState.environment.type === ENVIRONMENT_TYPES.WEBAPP)
index.jsx:263         (appState.environment.type === ENVIRONMENT_TYPES.WEBAPP ||
index.jsx:264         (appState.environment.type === ENVIRONMENT_TYPES.FILEMAKER && fmReady))
index.jsx:462         if (appState.environment.type === ENVIRONMENT_TYPES.FILEMAKER && !fmReady)
```

### Hooks (1 file)

**useFileMakerBridge:** `src/hooks/index.js:3-64`
- Monitors FileMaker bridge initialization
- 10 retry attempts with 100ms interval
- Returns `{ isReady, error, status, retry }`

### Services (5 files)

1. **dataService.js** - Core routing and interceptors
2. **initializationService.js** - FileMaker context loading
3. **recordQueueManager.js** - FileMaker queue operations
4. **dualWriteService.js** - FileMaker ↔ Supabase sync
5. **mailjetService.js** - FileMaker config fetching
6. **financialSyncService.js** - devRecords synchronization

### Context Providers (2 files)

1. **AppStateContext.jsx** - FileMaker example state
2. **ProjectContext.jsx** - Commented FileMaker call

### Configuration

**Package Dependency:**
```json
"fm-gofer": "^1.10.0"
```

**Environment Variables:**
```
VITE_FM_URL
VITE_FM_DATABASE
VITE_FM_USER
VITE_FM_PASSWORD
```

---

## Removal Impact Analysis

### Files Requiring Complete Replacement (3 files)

1. **src/api/fileMaker.js** (500 lines)
   - Core bridge implementation
   - All FileMaker-specific functions
   - Layout and Action constants

2. **src/services/dataService.js** (519 lines)
   - Environment routing logic
   - Request/response interceptors
   - convertToFileMakerCall function

3. **src/hooks/index.js** (277 lines)
   - useFileMakerBridge hook (lines 3-64)
   - Remove or stub entire hook

### Files Requiring Major Refactoring (2 files)

1. **src/index.jsx**
   - Remove FileMaker environment detection logic
   - Remove useFileMakerBridge usage
   - Simplify initialization flow
   - Remove handleFileMakerDetected handler

2. **src/components/auth/SignIn.jsx**
   - Remove detectFileMaker function
   - Remove FileMaker polling logic
   - Simplify to Supabase-only authentication

### API Layer Updates (11 files)

Convert from FileMaker params to direct HTTP calls:

1. `src/api/customers.js` - 7 call sites
2. `src/api/projects.js` - 9 call sites
3. `src/api/tasks.js` - 13 call sites
4. `src/api/teams.js` - 15 call sites
5. `src/api/notes.js` - 1 call site
6. `src/api/links.js` - 1 call site
7. `src/api/financialRecords.js` - 10 call sites
8. `src/api/customerActivity.js` - 2 call sites
9. `src/api/prospects.js` - 1 dynamic import
10. `src/api/index.js` - Remove fileMaker re-exports
11. `src/components/financial/QboTestPanel.jsx` - 2 direct calls

**Pattern Conversion:**
```javascript
// Before (FileMaker pattern)
import { fetchDataFromFileMaker, Layouts, Actions } from './fileMaker';

export async function fetchCustomers() {
    return await fetchDataFromFileMaker({
        layout: Layouts.CUSTOMERS,
        action: Actions.READ,
        query: [{ "__ID": "*" }]
    });
}

// After (Direct HTTP pattern)
import { dataService } from '../services/dataService';

export async function fetchCustomers() {
    const response = await dataService.get('/api/customers');
    return response.data;
}
```

### Service Updates (4 files)

1. **src/services/initializationService.js**
   - Remove FileMaker context loading
   - Remove waitForFileMaker function

2. **src/services/recordQueueManager.js**
   - Remove FileMaker queue operations
   - Convert to direct backend calls

3. **src/services/mailjetService.js**
   - Remove FMGofer script execution
   - Convert to backend API calls

4. **src/services/financialSyncService.js**
   - Remove devRecords references
   - Convert to Supabase customer_sales queries

### Files for Deletion

1. `src/api/fileMaker.js` - No longer needed
2. `src/services/dualWriteService.js` - FileMaker sync obsolete

### Package & Configuration Cleanup

**npm uninstall:**
```bash
npm uninstall fm-gofer
```

**Remove from .env:**
```
VITE_FM_URL
VITE_FM_DATABASE
VITE_FM_USER
VITE_FM_PASSWORD
```

**Remove constants from dataService.js:**
- `ENVIRONMENT_TYPES.FILEMAKER`
- `AUTH_METHODS.FILEMAKER`

---

## Integration Statistics

**Total FileMaker Touchpoints:** 100+ locations

**Breakdown by Category:**
- FMGofer imports: 3 files
- window.FileMaker checks: 10+ locations
- fetchDataFromFileMaker calls: 60+ locations
- ENVIRONMENT_TYPES.FILEMAKER references: 15+ locations
- Axios interceptor logic: 4 key functions
- Layout/Action constants: 2 constant objects
- Hooks: 1 complete hook (useFileMakerBridge)
- Services: 5 services with FileMaker integration
- Components: 2 components with direct FileMaker logic

**Critical Path Files (Must Address First):**
1. `src/api/fileMaker.js` - Core bridge
2. `src/services/dataService.js` - Routing logic
3. `src/index.jsx` - App initialization
4. `src/components/auth/SignIn.jsx` - Environment detection
5. `src/hooks/index.js` - useFileMakerBridge

**Secondary Wave (After Core Removal):**
- All API modules (11 files)
- Service layer (4 files)
- Context providers (2 files)
- Configuration cleanup (package.json, .env)

---

## References

**Key Source Files:**
- `src/api/fileMaker.js` (500 lines)
- `src/services/dataService.js` (519 lines)
- `src/components/auth/SignIn.jsx` (193 lines)
- `src/hooks/index.js` (277 lines)
- `src/index.jsx` (566 lines)

**Related Documentation:**
- `architecture.md` - Original FileMaker architecture analysis
- `inventory.md` - Complete FileMaker touchpoint inventory
- `MIGRATION_PLAN.md` - Step-by-step removal strategy

---

**Document Version:** 1.0
**Last Updated:** 2026-01-11
**Status:** Complete - Ready for Phase 2 Implementation
