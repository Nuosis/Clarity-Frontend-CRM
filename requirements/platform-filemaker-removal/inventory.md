# FileMaker Integration Inventory

Complete inventory of all FileMaker touchpoints in the Clarity CRM Frontend codebase, organized by integration type with file paths and line numbers.

**Generated:** 2026-01-10
**Purpose:** Phase 2 implementation reference for FileMaker removal

---

## Table of Contents

1. [Overview](#overview)
2. [Core FileMaker Bridge](#core-filemaker-bridge)
3. [Environment Detection](#environment-detection)
4. [Data Service Integration](#data-service-integration)
5. [API Layer](#api-layer)
6. [Components](#components)
7. [Hooks](#hooks)
8. [Services](#services)
9. [Context Providers](#context-providers)
10. [Configuration](#configuration)
11. [Removal Impact Summary](#removal-impact-summary)

---

## Overview

The FileMaker integration is deeply embedded throughout the application with multiple integration patterns:

1. **Direct FMGofer calls** - Low-level bridge operations
2. **window.FileMaker checks** - Environment detection
3. **fetchDataFromFileMaker wrapper** - Primary data access pattern
4. **Environment routing** - Conditional logic based on ENVIRONMENT_TYPES
5. **Dual-write operations** - FileMaker + Supabase synchronization
6. **Axios interceptors** - Request/response transformation

**Total Integration Points:** 100+ files across 8 integration categories

---

## Core FileMaker Bridge

### fm-gofer Library

**Package Dependency:**
- `package.json:29` - `"fm-gofer": "^1.10.0"`

**Import Locations:**
```javascript
// Core imports (3 files)
src/services/dataService.js:9          import FMGofer from 'fm-gofer';
src/services/mailjetService.js:6       import FMGofer from 'fm-gofer';
src/api/fileMaker.js:1                 import FMGofer from 'fm-gofer';
```

### FMGofer.PerformScript Usage

**Direct Script Execution:**
```javascript
// src/services/dataService.js
dataService.js:116    const hasFMGofer = typeof FMGofer !== 'undefined' && FMGofer.PerformScript;
dataService.js:119    if (!hasFMGofer && !hasFileMaker) {
dataService.js:141    result = await FMGofer.PerformScript('JS * Fetch Data', JSON.stringify(scriptParams));
dataService.js:471    const hasFMGofer = typeof FMGofer !== 'undefined' && FMGofer.PerformScript;
dataService.js:480    return await FMGofer.PerformScript(scriptName, scriptParam);

// src/api/fileMaker.js
fileMaker.js:32       const hasFMGofer = typeof FMGofer !== 'undefined' && FMGofer.PerformScript;
fileMaker.js:323      FMGofer.PerformScript("JS * Fetch Data", param)

// src/services/mailjetService.js
mailjetService.js:25  const configJson = await FMGofer.PerformScript('JS * Fetch Data', payload);
mailjetService.js:178 const responseJson = await FMGofer.PerformScript('JS * Fetch Data', JSON.stringify(scriptParams));
```

### window.FileMaker Bridge

**Message Event Listener:**
```javascript
// src/api/fileMaker.js:8-24
window.addEventListener('message', (event) => {
    if (event.data.type === 'FM_BRIDGE_READY') {
        window.FileMaker = event.data.api;
        bridgeInitialized = true;
    }
});
```

**Detection Checks:**
```javascript
// src/services/dataService.js
dataService.js:117    const hasFileMaker = typeof window !== 'undefined' && window.FileMaker && window.FileMaker.PerformScript;
dataService.js:144    result = window.FileMaker.PerformScript('JS * Fetch Data', JSON.stringify(scriptParams));
dataService.js:472    const hasFileMaker = typeof window !== 'undefined' && window.FileMaker && window.FileMaker.PerformScript;
dataService.js:483    return window.FileMaker.PerformScript(scriptName, scriptParam);

// src/api/fileMaker.js
fileMaker.js:33       const hasFileMaker = typeof window !== 'undefined' && window.FileMaker && window.FileMaker.PerformScript;
fileMaker.js:300      if (typeof FileMaker === "undefined" || !FileMaker.PerformScript) {
fileMaker.js:316      FileMaker.PerformScript("JS * Fetch Data", param);
fileMaker.js:335      const result = FileMaker.PerformScript("JS * Fetch Data", param);
fileMaker.js:466      if (typeof FileMaker === "undefined" || !FileMaker.PerformScript) {
fileMaker.js:487      FileMaker.PerformScript("Initialize QB via JS", payload);

// src/components/auth/SignIn.jsx
SignIn.jsx:29         const hasFMGofer = typeof window !== 'undefined' && window.FMGofer;
SignIn.jsx:30         const hasFileMaker = typeof window !== 'undefined' && window.FileMaker;
SignIn.jsx:32         if (hasFMGofer || hasFileMaker) {
```

---

## Environment Detection

### ENVIRONMENT_TYPES Constant

**Definition:**
```javascript
// src/services/dataService.js:13-16
export const ENVIRONMENT_TYPES = {
  FILEMAKER: 'filemaker',
  WEBAPP: 'webapp'
};
```

**Usage Locations:**
```javascript
// src/services/dataService.js
dataService.js:187    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
dataService.js:199    if (env.type === ENVIRONMENT_TYPES.WEBAPP) {
dataService.js:339    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {

// src/index.jsx
index.jsx:16          import { setEnvironmentContext, ENVIRONMENT_TYPES, AUTH_METHODS } from './services/dataService';
index.jsx:27          const shouldUseFileMakerBridge = appState.environment.type === ENVIRONMENT_TYPES.FILEMAKER;
index.jsx:121         setEnvironment(ENVIRONMENT_TYPES.FILEMAKER);
index.jsx:123         type: ENVIRONMENT_TYPES.FILEMAKER,
index.jsx:145         setEnvironment(ENVIRONMENT_TYPES.WEBAPP);
index.jsx:147         type: ENVIRONMENT_TYPES.WEBAPP,
index.jsx:176         if (appState.environment.type === ENVIRONMENT_TYPES.FILEMAKER) {
index.jsx:206         } else if (appState.environment.type === ENVIRONMENT_TYPES.WEBAPP) {
index.jsx:263         (appState.environment.type === ENVIRONMENT_TYPES.WEBAPP ||
index.jsx:264         (appState.environment.type === ENVIRONMENT_TYPES.FILEMAKER && fmReady))) {
index.jsx:462         if (appState.environment.type === ENVIRONMENT_TYPES.FILEMAKER && !fmReady) {
```

### AUTH_METHODS Constant

**Definition:**
```javascript
// src/services/dataService.js:19-22
export const AUTH_METHODS = {
  FILEMAKER: 'filemaker',
  SUPABASE: 'supabase'
};
```

**Usage Locations:**
```javascript
// src/index.jsx
index.jsx:16          import { setEnvironmentContext, ENVIRONMENT_TYPES, AUTH_METHODS } from './services/dataService';
index.jsx:126         method: AUTH_METHODS.FILEMAKER,
index.jsx:134         method: AUTH_METHODS.FILEMAKER,
```

### Environment Context Functions

**Core Functions:**
```javascript
// src/services/dataService.js
dataService.js:43-46   export const setEnvironmentContext = (environment) => { ... }
dataService.js:52-54   export const getEnvironmentContext = () => { ... }
```

**Used in:**
```javascript
index.jsx:16           import { setEnvironmentContext, ENVIRONMENT_TYPES, AUTH_METHODS } from './services/dataService';
```

---

## Data Service Integration

### Axios Interceptors with FileMaker Routing

**Request Interceptor:**
```javascript
// src/services/dataService.js:176-216
client.interceptors.request.use(
  async (config) => {
    const env = getEnvironmentContext();

    // FileMaker environment routing
    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
      config._isFileMakerRequest = true;      // Line 191
      config._originalUrl = config.url;
      config._originalData = config.data;
      return config;
    }

    // Web app environment - add backend authentication
    if (env.type === ENVIRONMENT_TYPES.WEBAPP) {
      const authHeader = await generateBackendAuthHeader(payload);
      config.headers.Authorization = authHeader;
      return config;
    }
  }
);
```

**Response Interceptor:**
```javascript
// src/services/dataService.js:219-255
client.interceptors.response.use(
  async (response) => {
    // Handle FileMaker requests
    if (response.config._isFileMakerRequest) {      // Line 222
      const fileMakerResponse = await convertToFileMakerCall(
        response.config.method.toUpperCase(),
        response.config._originalUrl,
        response.config._originalData
      );
      return { ...response, data: fileMakerResponse };
    }
    return response;
  },
  (error) => {
    // Handle FileMaker errors
    if (error.config && error.config._isFileMakerRequest) {  // Line 249
      return Promise.reject(new Error(`FileMaker API Error: ${error.message}`));
    }
    return Promise.reject(error);
  }
);
```

### convertToFileMakerCall Function

**Implementation:**
```javascript
// src/services/dataService.js:114-161
const convertToFileMakerCall = async (method, url, data = null) => {
  // Check for FileMaker bridge availability (lines 116-120)
  const hasFMGofer = typeof FMGofer !== 'undefined' && FMGofer.PerformScript;
  const hasFileMaker = typeof window !== 'undefined' && window.FileMaker && window.FileMaker.PerformScript;

  if (!hasFMGofer && !hasFileMaker) {
    throw new Error('FileMaker bridge not available (neither FMGofer nor FileMaker.PerformScript found)');
  }

  // Prepare script parameters (lines 128-134)
  const scriptParams = {
    action: 'apiCall',
    method,
    endpoint,
    data: data || {},
    query: Object.fromEntries(urlParts.searchParams)
  };

  // Execute via FMGofer or FileMaker.PerformScript (lines 139-145)
  if (hasFMGofer) {
    result = await FMGofer.PerformScript('JS * Fetch Data', JSON.stringify(scriptParams));
  } else {
    result = window.FileMaker.PerformScript('JS * Fetch Data', JSON.stringify(scriptParams));
  }
}
```

---

## API Layer

### fetchDataFromFileMaker Function

**Primary Implementation:**
```javascript
// src/api/fileMaker.js:263-282
export async function fetchDataFromFileMaker(params, attempt = 0, isAsync = true) {
  // Check app environment context (lines 268-273)
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

**Import and Usage Across API Modules:**

1. **Customers API:**
```javascript
// src/api/customers.js:1
import { fetchDataFromFileMaker, handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';

// Usage (7 calls):
customers.js:15       return await fetchDataFromFileMaker(params);
customers.js:34       return await fetchDataFromFileMaker(params);
customers.js:55       return await fetchDataFromFileMaker(params);
customers.js:74       return await fetchDataFromFileMaker(params);
customers.js:97       return await fetchDataFromFileMaker(params);
customers.js:113      return await fetchDataFromFileMaker(params);
customers.js:132      return await fetchDataFromFileMaker(params);
```

2. **Projects API:**
```javascript
// src/api/projects.js:1
import { fetchDataFromFileMaker, handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';

// Usage (9 calls):
projects.js:18        return await fetchDataFromFileMaker(params);
projects.js:37        return await fetchDataFromFileMaker(params);
projects.js:57        return await fetchDataFromFileMaker(params);
projects.js:82        return await fetchDataFromFileMaker(params);
projects.js:103       return await fetchDataFromFileMaker(params);
projects.js:122       return await fetchDataFromFileMaker(params);
projects.js:143       return await fetchDataFromFileMaker(params);
projects.js:192       return await fetchDataFromFileMaker(params);
projects.js:211       return await fetchDataFromFileMaker(params);
```

3. **Tasks API:**
```javascript
// src/api/tasks.js:1
import { fetchDataFromFileMaker, handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';

// Usage (13 calls):
tasks.js:18           return await fetchDataFromFileMaker(params);
tasks.js:37           return await fetchDataFromFileMaker(params);
tasks.js:57           const result = await fetchDataFromFileMaker(params);
tasks.js:89           return await fetchDataFromFileMaker(params);
tasks.js:112          return await fetchDataFromFileMaker(params);
tasks.js:133          let projectResult = await fetchDataFromFileMaker(projectParams);
tasks.js:144          projectResult = await fetchDataFromFileMaker(projectByRecordParams);
tasks.js:177          return await fetchDataFromFileMaker(params);
tasks.js:209          const data = await fetchDataFromFileMaker(params);
tasks.js:230          return await fetchDataFromFileMaker(params);
tasks.js:253          return await fetchDataFromFileMaker(params);
tasks.js:277          return await fetchDataFromFileMaker(params);
tasks.js:296          return await fetchDataFromFileMaker(params);
tasks.js:315          return await fetchDataFromFileMaker(params);
```

4. **Teams API:**
```javascript
// src/api/teams.js:1
import { fetchDataFromFileMaker, handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';

// Usage (15 calls):
teams.js:23           return await fetchDataFromFileMaker(params);
teams.js:42           return await fetchDataFromFileMaker(params);
teams.js:62           const teamMembersResult = await fetchDataFromFileMaker(teamMembersParams);
teams.js:90           const staffResult = await fetchDataFromFileMaker(staffParams);
teams.js:139          return await fetchDataFromFileMaker(params);
teams.js:158          return await fetchDataFromFileMaker(params);
teams.js:179          return await fetchDataFromFileMaker(params);
teams.js:198          return await fetchDataFromFileMaker(params);
teams.js:225          return await fetchDataFromFileMaker(params);
teams.js:244          return await fetchDataFromFileMaker(params);
teams.js:267          return await fetchDataFromFileMaker(params);
teams.js:289          return await fetchDataFromFileMaker(params);
teams.js:305          return await fetchDataFromFileMaker(params);
```

5. **Notes API:**
```javascript
// src/api/notes.js:1
import { fetchDataFromFileMaker, handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';

// Usage (1 call):
notes.js:22           return await fetchDataFromFileMaker(params);
```

6. **Links API:**
```javascript
// src/api/links.js:1
import { fetchDataFromFileMaker, handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';

// Usage (1 call):
links.js:28           return await fetchDataFromFileMaker(params);
```

7. **Financial Records API:**
```javascript
// src/api/financialRecords.js:1
import { fetchDataFromFileMaker, handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';

// Usage (10 calls):
financialRecords.js:232    return await fetchDataFromFileMaker(params);
financialRecords.js:251    return await fetchDataFromFileMaker(params);
financialRecords.js:274    return await fetchDataFromFileMaker(params);
financialRecords.js:301    return await fetchDataFromFileMaker(params);
financialRecords.js:327    return await fetchDataFromFileMaker(params);
financialRecords.js:346    return await fetchDataFromFileMaker(params);
financialRecords.js:365    return await fetchDataFromFileMaker(params);
financialRecords.js:388    return await fetchDataFromFileMaker(params);
financialRecords.js:426    const result = await fetchDataFromFileMaker(params);
financialRecords.js:485    return await fetchDataFromFileMaker(params);
```

8. **Customer Activity API:**
```javascript
// src/api/customerActivity.js:1
import { fetchDataFromFileMaker, handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';

// Usage (2 calls):
customerActivity.js:227    return await fetchDataFromFileMaker(params);
customerActivity.js:271    return await fetchDataFromFileMaker(params);
```

9. **Prospects API:**
```javascript
// src/api/prospects.js:473-477
const { fetchDataFromFileMaker, Layouts, Actions } = await import('./fileMaker.js')
const fileMakerResponse = await fetchDataFromFileMaker({
  layout: Layouts.CUSTOMERS,
  action: Actions.CREATE,
  fieldData: fileMakerData
});
```

### FileMaker Layout Constants

**Definition:**
```javascript
// src/api/fileMaker.js:411-423
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

**Referenced in all API modules:**
- `src/api/customers.js` - CUSTOMERS layout
- `src/api/projects.js` - PROJECTS layout
- `src/api/tasks.js` - TASKS layout
- `src/api/teams.js` - (team layouts)
- `src/api/notes.js` - NOTES layout
- `src/api/links.js` - LINKS layout
- `src/api/financialRecords.js` - RECORDS layout

### FileMaker Actions Constants

**Definition:**
```javascript
// src/api/fileMaker.js:428-435
export const Actions = {
    READ: 'read',
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    METADATA: 'metaData',
    DUPLICATE: 'duplicate'
};
```

**Used in all API modules for operation routing**

### QuickBooks Integration via FileMaker

**initializeQuickBooks Function:**
```javascript
// src/api/fileMaker.js:447-500
export async function initializeQuickBooks(params) {
  // Handle both string and object formats (lines 449-450)
  const isObject = typeof params === 'object' && params !== null;
  const customerId = isObject ? params.custId : params;

  // Check FileMaker availability (lines 466-470)
  if (typeof FileMaker === "undefined" || !FileMaker.PerformScript) {
    const error = new Error("FileMaker object is unavailable");
    error.code = "FM_UNAVAILABLE";
    reject(error);
    return;
  }

  // Execute FileMaker script (lines 487)
  FileMaker.PerformScript("Initialize QB via JS", payload);
}
```

**Export:**
```javascript
// src/api/index.js:8
initializeQuickBooks
```

### Helper Functions

**handleFileMakerOperation:**
```javascript
// src/api/fileMaker.js:380-396
export async function handleFileMakerOperation(operation) {
  try {
    return await operation();
  } catch (error) {
    console.error(`FileMaker operation failed: ${error.message}`, {
      code: error.code,
      details: error.details
    });

    const formattedError = new Error(error.message || String(error));
    formattedError.error = true;
    formattedError.code = error.code || 'UNKNOWN_ERROR';
    formattedError.details = error.details;
    throw formattedError;
  }
}
```

**Imported in:**
- `src/api/customers.js:1`
- `src/api/projects.js:1`
- `src/api/tasks.js:1`
- `src/api/teams.js:1`
- `src/api/notes.js:1`
- `src/api/links.js:1`
- `src/api/financialRecords.js:1`
- `src/api/customerActivity.js:1`

---

## Components

### SignIn Component

**FileMaker Detection Logic:**
```javascript
// src/components/auth/SignIn.jsx:24-66
const detectFileMaker = useCallback(() => {
  const checkFileMaker = () => {
    const hasFMGofer = typeof window !== 'undefined' && window.FMGofer;     // Line 29
    const hasFileMaker = typeof window !== 'undefined' && window.FileMaker; // Line 30

    if (hasFMGofer || hasFileMaker) {                                       // Line 32
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

  // Polling for FileMaker bridge (up to 3 seconds, 30 attempts @ 100ms)
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

### QboTestPanel Component

**Direct FileMaker Usage:**
```javascript
// src/components/financial/QboTestPanel.jsx:12
import { fetchDataFromFileMaker } from '../../api/fileMaker';

// Usage (2 calls):
QboTestPanel.jsx:485    const fmResult = await fetchDataFromFileMaker(params, 0, true);
QboTestPanel.jsx:600    const fmResult = await fetchDataFromFileMaker(fmParams, 0, true);
```

---

## Hooks

### useFileMakerBridge Hook

**Implementation:**
```javascript
// src/hooks/index.js:3-64
export function useFileMakerBridge() {
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState('Initializing FileMaker connection...');
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        const checkBridge = () => {
            try {
                if (typeof FileMaker === "undefined") {                    // Line 17
                    throw new Error('FileMaker bridge not detected');
                }

                if (isMounted) {
                    console.log('[FileMaker Bridge] Connection established');
                    setIsReady(true);
                    setError(null);
                    setStatus('FileMaker connection established');
                }
            } catch (error) {
                if (isMounted && retries < 10) {
                    retries++;
                    setStatus(`Attempting to connect to FileMaker (${retries}/10)...`);
                    retryTimer = setTimeout(checkBridge, 100);
                } else if (isMounted) {
                    setError('Failed to initialize FileMaker connection after 1 second');
                    setStatus('Failed to connect to FileMaker');
                    setIsReady(false);
                }
            }
        };

        checkBridge();
    }, []);

    return {
        isReady,
        error,
        status,
        retry
    };
}
```

**Usage:**
```javascript
// src/index.jsx:9
import { useCustomer, useProject, useTask, useFileMakerBridge, useProducts, useSales } from './hooks';

// src/index.jsx:27-30
const shouldUseFileMakerBridge = appState.environment.type === ENVIRONMENT_TYPES.FILEMAKER;
const fileMakerBridge = shouldUseFileMakerBridge
    ? useFileMakerBridge()
    : { isReady: true, error: null, status: 'Web app mode - FileMaker bridge disabled' };

// src/index.jsx:32
const { isReady: fmReady, error: fmError, status: fmStatus } = fileMakerBridge;
```

---

## Services

### initializationService

**FileMaker Context Loading:**
```javascript
// src/services/initializationService.js:1
import { fetchDataFromFileMaker } from '../api/fileMaker';

// Usage (1 call):
initializationService.js:37    const userContext = await fetchDataFromFileMaker({
  layout: 'devCustomers',
  action: 'read',
  callBackName: 'returnContext'
});
```

### recordQueueManager

**FileMaker Queue Operations:**
```javascript
// src/services/recordQueueManager.js:1
import { fetchDataFromFileMaker } from '../api';

// Usage (1 call):
recordQueueManager.js:35    fetchDataFromFileMaker(request.params, 0, false);
```

### dualWriteService

**FileMaker + Supabase Synchronization:**
```javascript
// src/services/dualWriteService.js (359 lines)
// Complete service for dual-write operations

// Key patterns:
// - withDualWrite wrapper
// - stopTimerWithDualWrite for tasks
// - Coordinates FileMaker write + Supabase write
```

**No direct imports found** - This service is planned but may not be actively used based on grep results showing only documentation references.

### mailjetService

**FileMaker Configuration Fetching:**
```javascript
// src/services/mailjetService.js:6
import FMGofer from 'fm-gofer';

// Usage (2 calls):
mailjetService.js:25     const configJson = await FMGofer.PerformScript('JS * Fetch Data', payload);
mailjetService.js:178    const responseJson = await FMGofer.PerformScript('JS * Fetch Data', JSON.stringify(scriptParams));
```

### financialSyncService

**FileMaker devRecords Synchronization:**
```javascript
// References to devRecords (FileMaker layout) throughout service:
financialSyncService.js:3      // Ensures devRecords match customer_sales
financialSyncService.js:16     // Synchronizes devRecords with customer_sales
financialSyncService.js:22     // deleteOrphaned - deletes customer_sales records that don't exist in devRecords
financialSyncService.js:43-103 // Multiple references to devRecords fetching and comparison
financialSyncService.js:263    // Fetches devRecords for a specific date range
financialSyncService.js:339    // Compares devRecords with customer_sales
```

---

## Context Providers

### AppStateContext

**FileMaker-related State:**
```javascript
// src/context/AppStateContext.jsx:20
SET_SHOW_FILEMAKER_EXAMPLE: 'SET_SHOW_FILEMAKER_EXAMPLE',

// Reducer case:
AppStateContext.jsx:180    case APP_ACTIONS.SET_SHOW_FILEMAKER_EXAMPLE:

// Action creator:
AppStateContext.jsx:437    dispatch({ type: APP_ACTIONS.SET_SHOW_FILEMAKER_EXAMPLE, payload: show })
```

### ProjectContext

**Commented-out FileMaker Call:**
```javascript
// src/context/ProjectContext.jsx:3
import { Layouts, Actions, fetchDataFromFileMaker } from '../api';

// src/context/ProjectContext.jsx:65 (commented)
//     fetchDataFromFileMaker(contextParams, 0, false);
```

---

## Configuration

### Environment Variables

**FileMaker-specific Environment Variables:**
```bash
# From CLAUDE.md documentation
VITE_FM_URL                  # FileMaker server URL
VITE_FM_DATABASE             # FileMaker database name
VITE_FM_USER                 # FileMaker username
VITE_FM_PASSWORD             # FileMaker password
```

### Package Dependencies

**npm Package:**
```json
// package.json:29
"fm-gofer": "^1.10.0"
```

---

## Removal Impact Summary

### Files Requiring Modification (Primary)

**Complete Replacement Required (3 files):**
1. `src/api/fileMaker.js` (500 lines) - Core bridge implementation
2. `src/services/dataService.js` (519 lines) - Environment routing and interceptors
3. `src/hooks/index.js` (277 lines) - useFileMakerBridge hook (lines 3-64)

**Major Refactoring Required (2 files):**
1. `src/index.jsx` - Remove FileMaker environment logic, bridge usage
2. `src/components/auth/SignIn.jsx` - Remove FileMaker detection

**API Layer Updates (11 files):**
All API modules importing from fileMaker.js:
1. `src/api/customers.js` - 7 fetchDataFromFileMaker calls
2. `src/api/projects.js` - 9 fetchDataFromFileMaker calls
3. `src/api/tasks.js` - 14 fetchDataFromFileMaker calls
4. `src/api/teams.js` - 15 fetchDataFromFileMaker calls
5. `src/api/notes.js` - 1 fetchDataFromFileMaker call
6. `src/api/links.js` - 1 fetchDataFromFileMaker call
7. `src/api/financialRecords.js` - 10 fetchDataFromFileMaker calls
8. `src/api/customerActivity.js` - 2 fetchDataFromFileMaker calls
9. `src/api/prospects.js` - 1 dynamic import + call
10. `src/api/index.js` - Re-export of fileMaker functions
11. `src/components/financial/QboTestPanel.jsx` - 2 direct calls

**Service Updates (4 files):**
1. `src/services/initializationService.js` - Remove FileMaker context loading
2. `src/services/recordQueueManager.js` - Remove FileMaker queue operations
3. `src/services/mailjetService.js` - Remove FMGofer script execution
4. `src/services/financialSyncService.js` - Remove devRecords references

**Context Updates (2 files):**
1. `src/context/AppStateContext.jsx` - Remove FILEMAKER_EXAMPLE state
2. `src/context/ProjectContext.jsx` - Clean up commented FileMaker code

### Files Requiring Removal

**Complete Deletion:**
1. `src/api/fileMaker.js` - No longer needed
2. `src/services/dualWriteService.js` - FileMaker sync no longer relevant

### Package Dependencies

**npm Uninstall:**
```bash
npm uninstall fm-gofer
```

### Environment Variables to Remove

```bash
VITE_FM_URL
VITE_FM_DATABASE
VITE_FM_USER
VITE_FM_PASSWORD
```

### Constants to Remove

**From src/services/dataService.js:**
- `ENVIRONMENT_TYPES.FILEMAKER`
- `AUTH_METHODS.FILEMAKER`

**From src/api/fileMaker.js:**
- `Layouts` constant (all FileMaker layout names)
- `Actions` constant (FileMaker action types)

### Functions to Remove

**Core Bridge Functions:**
- `fetchDataFromFileMaker()` - 60+ usage locations
- `handleFileMakerNativeCall()`
- `isFileMakerEnvironment()`
- `convertToFileMakerCall()`
- `handleFileMakerOperation()`
- `initializeQuickBooks()` - Needs replacement with direct backend call
- `useFileMakerBridge()` hook

**Service Functions:**
- Environment detection in SignIn component
- FileMaker interceptors in dataService
- FileMaker context loading in initializationService

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

## Notes for Phase 2 Implementation

1. **Sequential Removal Order:**
   - Start with API layer (replace fetchDataFromFileMaker calls)
   - Update data service routing
   - Remove environment detection
   - Clean up hooks and contexts
   - Remove package dependencies

2. **Testing Strategy:**
   - Verify each API module works with backend after conversion
   - Test authentication flow without FileMaker detection
   - Verify data operations in web-only mode
   - Check QuickBooks integration still works

3. **Backward Compatibility:**
   - No backward compatibility needed - complete cutover
   - FileMaker users will stay on legacy version
   - New deployment is web-app only

4. **Migration Verification:**
   - Run build after each file modification
   - Use grep to verify no lingering FileMaker references
   - Check for unused imports
   - Verify no broken import paths

---

**Document Status:** Complete
**Last Updated:** 2026-01-10
**Next Steps:** Use this inventory as reference for Phase 2 implementation planning
