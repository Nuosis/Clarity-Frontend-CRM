# FileMaker Bridge Architecture Documentation

## Overview

This document provides comprehensive architectural documentation of how the Clarity CRM Frontend integrates with FileMaker through the FMGofer bridge. This documentation is critical for Phase 2 implementation where we'll remove FileMaker dependencies.

**Last Updated:** 2026-01-10
**Status:** Complete architectural analysis

---

## Table of Contents

1. [Bridge Initialization](#1-bridge-initialization)
2. [Environment Detection](#2-environment-detection)
3. [Global Environment Context](#3-global-environment-context)
4. [Request/Response Interceptors](#4-requestresponse-interceptors)
5. [FileMaker Call Conversion](#5-filemaker-call-conversion)
6. [HMAC Authentication](#6-hmac-authentication)
7. [useFileMakerBridge Hook](#7-usefilemakerbridge-hook)
8. [Legacy API Pattern](#8-legacy-api-pattern)
9. [Complete Request Flows](#9-complete-request-flows)
10. [Backend Translation Layer](#10-backend-translation-layer)
11. [Key Files Reference](#11-key-files-reference)

---

## 1. Bridge Initialization

### FMGofer Message Event Listener

**Location:** `src/api/fileMaker.js:1-24`

The FileMaker bridge is initialized through a message event listener that sets up the FileMaker object on the global window:

```javascript
let bridgeInitialized = false;

if (typeof window !== "undefined") {
    window.addEventListener('message', (event) => {
        if (event.data.type === 'FM_BRIDGE_READY') {
            if (!bridgeInitialized) {
                window.FileMaker = event.data.api;
                bridgeInitialized = true;
            }
        }
    });
}
```

**Key Characteristics:**
- Listens for `FM_BRIDGE_READY` message event from FileMaker WebViewer
- Sets `window.FileMaker` object from event data payload
- Uses `bridgeInitialized` flag to prevent duplicate initialization
- Fallback support for direct FMGofer library import

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
1. **FMGofer Library:** Direct import of fm-gofer npm package - checks `FMGofer.PerformScript`
2. **Window Object:** Message event-initialized bridge - checks `window.FileMaker.PerformScript`
3. Either presence indicates FileMaker environment

---

## 2. Environment Detection

### SignIn Component Detection Flow

**Location:** `src/components/auth/SignIn.jsx:24-66`

The SignIn component performs automatic FileMaker detection on mount with polling strategy:

```javascript
const detectFileMaker = useCallback(() => {
    // Check for FileMaker bridge availability
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

**Detection Process:**
1. **Immediate Check:** First checks if `window.FMGofer` or `window.FileMaker` exists
2. **Polling Strategy:** If not found, polls every 100ms for up to 3 seconds (30 attempts)
3. **Fallback:** After timeout, proceeds to Supabase authentication form
4. **User Experience:** Silent detection - no user action required

---

## 3. Global Environment Context

### Environment State Management

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

Two handlers set environment context based on authentication path:

**FileMaker Detection Handler (lines 117-139):**
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

**Supabase Authentication Handler (lines 141-155):**
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

## 4. Request/Response Interceptors

### Axios Client with Environment-Aware Routing

**Location:** `src/services/dataService.js:165-258`

The data service creates an axios client with interceptors that automatically route requests based on environment:

### Request Interceptor (lines 176-216)

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

### Response Interceptor (lines 218-255)

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

### Interceptor Routing Table

| Environment | Request Interceptor | Response Interceptor | Execution Path |
|-------------|-------------------|---------------------|----------------|
| **FileMaker** | Marks request with `_isFileMakerRequest` flag<br>Stores original URL and data | Calls `convertToFileMakerCall()`<br>Executes FileMaker script | FMGofer.PerformScript() |
| **Webapp** | Adds HMAC-SHA256 authentication header | Passes through (no conversion) | Normal axios HTTP request |

**Key Design Pattern:**
- Components use standard axios calls: `dataService.get('/api/customers')`
- Interceptors transparently route based on environment
- No component code changes needed when switching environments
- Single source of truth for routing logic

---

## 5. FileMaker Call Conversion

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
    throw new Error('FileMaker bridge not available (neither FMGofer nor FileMaker.PerformScript found)');
  }

  // Extract endpoint from URL
  const urlParts = new URL(url);
  const endpoint = urlParts.pathname.replace('/api/', '');

  // Prepare script parameters following existing pattern
  const scriptParams = {
    action: 'apiCall',           // Generic action for API routing
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

### Transformation Examples

| HTTP Request | Extracted Endpoint | Script Parameters |
|--------------|-------------------|-------------------|
| `GET /api/customers` | `customers` | `{ action: 'apiCall', method: 'GET', endpoint: 'customers', data: {}, query: {} }` |
| `POST /api/customers` with body `{name: "Acme"}` | `customers` | `{ action: 'apiCall', method: 'POST', endpoint: 'customers', data: {name: "Acme"}, query: {} }` |
| `GET /api/customers?filter=active` | `customers` | `{ action: 'apiCall', method: 'GET', endpoint: 'customers', data: {}, query: {filter: 'active'} }` |
| `PATCH /api/projects/123` with body | `projects/123` | `{ action: 'apiCall', method: 'PATCH', endpoint: 'projects/123', data: {...}, query: {} }` |

### Script Execution Priority

1. **Preferred:** `await FMGofer.PerformScript('JS * Fetch Data', JSON.stringify(scriptParams))` (async)
2. **Fallback:** `window.FileMaker.PerformScript('JS * Fetch Data', JSON.stringify(scriptParams))` (sync)

**Critical FileMaker Script:** All requests route through single script `JS * Fetch Data`
- This script receives JSON string parameter
- Must parse `action`, `method`, `endpoint`, `data`, `query` fields
- Routes to appropriate FileMaker layout and operation
- Returns JSON response

---

## 6. HMAC Authentication

### Backend Request Signing

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

### Authentication Format

```
Authorization: Bearer {hmac_signature}.{timestamp}
```

**Signature Calculation:**
```
message = timestamp + "." + JSON.stringify(payload)
signature = HMAC-SHA256(secret_key, message)
authHeader = "Bearer " + hex(signature) + "." + timestamp
```

**Example:**
```
Request: POST /api/customers
Payload: {"name": "Acme Corp", "email": "contact@acme.com"}
Timestamp: 1736467200
Message: "1736467200.{\"name\":\"Acme Corp\",\"email\":\"contact@acme.com\"}"
Signature: a3f2c8... (HMAC-SHA256 hex)
Header: "Bearer a3f2c8...1736467200"
```

### Fallback Modes

| Condition | Auth Header Format | Use Case |
|-----------|-------------------|----------|
| Normal | `Bearer {hmac}.{timestamp}` | Production web app |
| Missing SECRET_KEY | `Bearer dev-token.{timestamp}` | Local development |
| No Web Crypto API | `Bearer fallback-token.{timestamp}` | Older browsers |

---

## 7. useFileMakerBridge Hook

### Bridge Readiness Monitor

**Location:** `src/hooks/index.js:3-64`

React hook that monitors FileMaker bridge initialization with retry logic:

```javascript
export function useFileMakerBridge() {
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState('Initializing FileMaker connection...');
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        console.log('[FileMaker Bridge] Initializing bridge check');
        let isMounted = true;
        let retries = 0;
        let retryTimer = null;

        const checkBridge = () => {
            try {
                if (typeof FileMaker === "undefined") {
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
                    console.log(`[FileMaker Bridge] Attempt ${retries}/10`);
                    retryTimer = setTimeout(checkBridge, 100);
                } else if (isMounted) {
                    console.log('[FileMaker Bridge] Connection failed after all retries');
                    setError('Failed to initialize FileMaker connection after 1 second');
                    setStatus('Failed to connect to FileMaker');
                    setIsReady(false);
                }
            }
        };

        checkBridge();

        return () => {
            console.log('[FileMaker Bridge] Cleanup - cancelling any pending retries');
            isMounted = false;
            if (retryTimer) {
                clearTimeout(retryTimer);
            }
        };
    }, []);

    const retry = useCallback(() => {
        console.log('[FileMaker Bridge] Manual retry requested');
        setRetryCount(prev => prev + 1);
    }, []);

    return {
        isReady,
        error,
        status,
        retry
    };
}
```

### Return Values

| Property | Type | Description |
|----------|------|-------------|
| `isReady` | boolean | True when FileMaker bridge is available |
| `error` | string/null | Error message if connection failed |
| `status` | string | Human-readable connection status |
| `retry` | function | Manual retry function |

### Retry Strategy

- **Max Retries:** 10 attempts
- **Retry Interval:** 100ms
- **Total Timeout:** 1 second
- **Cleanup:** Cancels pending retries on unmount

**Usage in src/index.jsx:27-30:**
```javascript
const { isReady: fmReady } = useFileMakerBridge();
```

---

## 8. Legacy API Pattern

### FileMaker-First API Layer

All API modules (`src/api/customers.js`, `src/api/projects.js`, `src/api/tasks.js`, etc.) follow this pattern:

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

### Pattern Components

**1. Layouts Constant (src/api/fileMaker.js:38-41):**
```javascript
export const Layouts = {
    CUSTOMERS: 'devCustomers',
    PROJECTS: 'devProjects',
    TASKS: 'devTasks',
    RECORDS: 'devRecords'
};
```

**2. Actions Constant (src/api/fileMaker.js:43-48):**
```javascript
export const Actions = {
    CREATE: 'create',
    READ: 'read',
    UPDATE: 'update',
    DELETE: 'delete'
};
```

**3. Parameter Structure:**
```javascript
{
    layout: 'devCustomers',     // FileMaker layout name
    action: 'read',             // CRUD operation
    query: [{"__ID": "*"}],    // FileMaker query (optional)
    recordId: '123',            // Record ID for update/delete (optional)
    fieldData: {...}            // Data for create/update (optional)
}
```

### Legacy Flow

```
Component calls fetchCustomers()
  ↓
handleFileMakerOperation() wraps for error handling
  ↓
Constructs FileMaker params: { layout: 'devCustomers', action: 'read', ... }
  ↓
fetchDataFromFileMaker(params)
  ↓
isFileMakerEnvironment() checks environment
  ├─→ TRUE: handleFileMakerNativeCall() → FMGofer.PerformScript()
  └─→ FALSE: callBackendAPI() → Convert to HTTP → Backend API
  ↓
Response back to component
```

**Critical Note for Phase 2:**
- This entire pattern is FileMaker-first
- Backend API endpoints already exist as fallback path
- Removal requires switching from FileMaker params to direct HTTP calls
- Pattern exists in ~15 API files (customers, projects, tasks, teams, etc.)

---

## 9. Complete Request Flows

### Flow 1: FileMaker Environment Path

```
┌─────────────────────────────────────────────────────────────┐
│ Component                                                    │
│ (e.g., CustomerDetails.jsx)                                 │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ API Function                                                 │
│ fetchCustomers() in src/api/customers.js                    │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ handleFileMakerOperation()                                   │
│ Error handling wrapper                                       │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ fetchDataFromFileMaker()                                     │
│ { layout: 'devCustomers', action: 'read', ... }             │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ isFileMakerEnvironment() → TRUE                             │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ handleFileMakerNativeCall()                                  │
│ Convert params to script parameters                          │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ FMGofer.PerformScript('JS * Fetch Data', JSON params)       │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ FileMaker Database                                           │
│ devCustomers Layout                                          │
│ Executes "JS * Fetch Data" script                           │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ JSON Response                                                │
│ Returns to component                                         │
└─────────────────────────────────────────────────────────────┘
```

### Flow 2: Web App Environment Path (Legacy API)

```
┌─────────────────────────────────────────────────────────────┐
│ Component                                                    │
│ (e.g., CustomerDetails.jsx)                                 │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ API Function                                                 │
│ fetchCustomers() in src/api/customers.js                    │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ handleFileMakerOperation()                                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ fetchDataFromFileMaker()                                     │
│ { layout: 'devCustomers', action: 'read', ... }             │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ isFileMakerEnvironment() → FALSE                            │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ callBackendAPI()                                             │
│ Convert FileMaker params to HTTP:                            │
│ - layout 'devCustomers' → /filemaker/devCustomers/records   │
│ - action 'read' → GET method                                 │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ Add HMAC-SHA256 Authorization Header                        │
│ generateBackendAuthHeader(payload)                           │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ Axios HTTP Request                                           │
│ GET https://api.claritybusinesssolutions.ca/filemaker/...   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend API                                                  │
│ - Validates HMAC signature                                   │
│ - Queries Supabase database                                  │
│ - Returns JSON response                                      │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ Format Response to FileMaker-Compatible Structure           │
│ { response: { recordId, data, dataInfo }, messages }        │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ JSON Response                                                │
│ Returns to component                                         │
└─────────────────────────────────────────────────────────────┘
```

### Flow 3: Modern Data Service Path

```
┌─────────────────────────────────────────────────────────────┐
│ Component                                                    │
│ (e.g., ProspectDetails.jsx)                                 │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ dataService.get('/api/customers')                           │
│ Modern HTTP-style API call                                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ Request Interceptor                                          │
│ Checks getEnvironmentContext()                               │
│                                                              │
│ IF FILEMAKER:                                                │
│   - Sets config._isFileMakerRequest = true                  │
│   - Stores config._originalUrl                              │
│   - Stores config._originalData                             │
│                                                              │
│ IF WEBAPP:                                                   │
│   - Generates HMAC auth header                               │
│   - Sets config.headers.Authorization                        │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ Response Interceptor                                         │
│                                                              │
│ IF _isFileMakerRequest:                                     │
│   - Call convertToFileMakerCall()                           │
│   - Execute FMGofer.PerformScript()                         │
│   - Return FileMaker response                                │
│                                                              │
│ ELSE:                                                        │
│   - Pass through to backend API                              │
│   - Return HTTP response                                     │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ Response Data                                                │
│ Returns to component                                         │
└─────────────────────────────────────────────────────────────┘
```

### Key Differences

| Aspect | Legacy API | Modern Data Service |
|--------|-----------|-------------------|
| **Call Style** | FileMaker params: `{ layout, action, ... }` | HTTP style: `dataService.get('/api/...')` |
| **Environment Detection** | In `fetchDataFromFileMaker()` | In axios interceptors |
| **Routing Logic** | `isFileMakerEnvironment()` check | Request/response interceptors |
| **Component Awareness** | None - transparent | None - transparent |
| **Backend Translation** | `callBackendAPI()` function | Direct axios HTTP request |

---

## 10. Backend Translation Layer

### FileMaker Parameter to HTTP Conversion

**Location:** `src/api/fileMaker.js:93-200`

The `callBackendAPI()` function converts FileMaker-style parameters to RESTful HTTP requests:

```javascript
async function callBackendAPI(params) {
    const { layout, action, query, recordId, data, fieldData } = params;
    let requestData = data || fieldData;

    let url, method, queryParams;

    switch (action) {
        case 'read':
            if (recordId) {
                // Get specific record
                url = `/filemaker/${layout}/records/${recordId}`;
                method = 'GET';
            } else if (query && query.length > 0) {
                // Search/find records
                url = `/filemaker/${layout}/_find`;
                method = 'POST';
                requestData = { query };
            } else {
                // Get all records
                url = `/filemaker/${layout}/records`;
                method = 'GET';
                queryParams = { limit: 100 };
            }
            break;

        case 'create':
            url = `/filemaker/${layout}/records`;
            method = 'POST';
            break;

        case 'update':
            url = `/filemaker/${layout}/records/${recordId}`;
            method = 'PATCH';
            break;

        case 'delete':
            url = `/filemaker/${layout}/records/${recordId}`;
            method = 'DELETE';
            break;
    }

    // Build axios config
    const config = {
        method,
        url: `${backendConfig.baseUrl}${url}`,
        headers: { 'Content-Type': 'application/json' }
    };

    // Add request body
    if (requestData) {
        if (action === 'create' || action === 'update') {
            config.data = { fields: requestData };
        } else {
            config.data = requestData;
        }
    }

    // Add HMAC authentication
    const payload = config.data ? JSON.stringify(config.data) : '';
    config.headers.Authorization = await generateBackendAuthHeader(payload);

    // Add query parameters
    if (queryParams) {
        config.params = queryParams;
    }

    // Execute request
    const response = await axios(config);

    // Format response to FileMaker-compatible structure
    return {
        response: {
            recordId: response.data.record_id || response.data.recordId || response.data.id,
            data: response.data.data || response.data,
            dataInfo: response.data.dataInfo || {}
        },
        messages: response.data.messages || [{ code: '0', message: 'OK' }]
    };
}
```

### Mapping Table

| FileMaker Action | FileMaker Params | Backend Endpoint | HTTP Method | Request Body |
|-----------------|-----------------|------------------|-------------|--------------|
| **read** (all) | `{ layout: 'devCustomers', action: 'read' }` | `/filemaker/devCustomers/records` | GET | None |
| **read** (by ID) | `{ layout: 'devCustomers', action: 'read', recordId: '123' }` | `/filemaker/devCustomers/records/123` | GET | None |
| **read** (query) | `{ layout: 'devCustomers', action: 'read', query: [...] }` | `/filemaker/devCustomers/_find` | POST | `{ query: [...] }` |
| **create** | `{ layout: 'devCustomers', action: 'create', fieldData: {...} }` | `/filemaker/devCustomers/records` | POST | `{ fields: {...} }` |
| **update** | `{ layout: 'devCustomers', action: 'update', recordId: '123', fieldData: {...} }` | `/filemaker/devCustomers/records/123` | PATCH | `{ fields: {...} }` |
| **delete** | `{ layout: 'devCustomers', action: 'delete', recordId: '123' }` | `/filemaker/devCustomers/records/123` | DELETE | None |

### Response Format Normalization

**FileMaker Response Format:**
```json
{
  "response": {
    "recordId": "123",
    "data": {...},
    "dataInfo": {}
  },
  "messages": [
    { "code": "0", "message": "OK" }
  ]
}
```

**Backend API Response (varies):**
```json
{
  "record_id": "123",
  "data": {...}
}
```

**Translation:** Backend response is wrapped to match FileMaker format for compatibility

---

## 11. Key Files Reference

### Core Bridge Files

```
src/api/fileMaker.js (501 lines)
├── Lines 1-24:    Bridge initialization (message event listener)
├── Lines 30-36:   Environment detection (isFileMakerEnvironment)
├── Lines 43-86:   HMAC auth generation (generateBackendAuthHeader)
├── Lines 93-200:  Backend API translation (callBackendAPI)
├── Lines 263-351: Native FileMaker calls (handleFileMakerNativeCall)
└── Lines 447-501: QuickBooks initialization

src/services/dataService.js (519 lines)
├── Lines 13-22:   Environment types and constants
├── Lines 28-35:   Global environment state
├── Lines 43-46:   setEnvironmentContext / getEnvironmentContext
├── Lines 57-105:  HMAC auth generation
├── Lines 108-161: convertToFileMakerCall function
├── Lines 165-258: Axios client with interceptors
├── Lines 263-376: Data service methods (get, post, put, delete, patch)
└── Lines 458-517: environmentAPI object

src/components/auth/SignIn.jsx (193 lines)
├── Lines 24-66:   detectFileMaker function (polling strategy)
└── Lines 75-99:   Supabase authentication handler

src/hooks/index.js (277 lines)
└── Lines 3-64:    useFileMakerBridge hook (bridge readiness monitor)

src/index.jsx (566 lines)
├── Lines 27-30:   useFileMakerBridge usage
├── Lines 117-139: handleFileMakerDetected (sets environment context)
├── Lines 141-155: handleSupabaseAuth (sets environment context)
└── Lines 163-279: Initialization effect (waits for bridge)

src/services/initializationService.js (237 lines)
├── Lines 14-31:   waitForFileMaker (retry logic)
└── Lines 33-45:   loadUserContext

src/config.js (53 lines)
├── Supabase configuration
└── Backend API URLs
```

### Configuration Files

```
vite.config.js (30 lines)
└── Lines 11-17:   API proxy configuration (/api → backend)

.env (environment variables)
├── VITE_SECRET_KEY:          HMAC signing secret
├── VITE_API_URL:             Backend API base URL
├── VITE_FM_URL:              FileMaker server URL
├── VITE_FM_DATABASE:         FileMaker database name
├── VITE_FM_USER:             FileMaker username
└── VITE_FM_PASSWORD:         FileMaker password
```

### API Layer Files (Legacy Pattern)

```
src/api/
├── customers.js    - Customer CRUD operations
├── projects.js     - Project management
├── tasks.js        - Task operations
├── teams.js        - Team/staff management
├── products.js     - Product catalog
├── proposals.js    - Proposal system
└── [15+ more files following same pattern]
```

**Each file contains:**
- Import of FileMaker utilities (`handleFileMakerOperation`, `fetchDataFromFileMaker`, `Layouts`, `Actions`)
- Functions constructing FileMaker params: `{ layout, action, query, recordId, fieldData }`
- Automatic environment detection and routing

---

## Architecture Summary

### Initialization Sequence

```
1. App loads in FileMaker WebViewer OR standalone web browser
   ↓
2. Message event listener awaits 'FM_BRIDGE_READY' (if FileMaker)
   ↓
3. SignIn component runs detectFileMaker() on mount
   ├─→ Polls for window.FMGofer or window.FileMaker (30 attempts, 100ms interval)
   └─→ Timeout after 3 seconds → fallback to Supabase auth
   ↓
4. Environment detected
   ├─→ FileMaker: handleFileMakerDetected() called
   │   └─→ setEnvironmentContext({ type: 'filemaker', ... })
   └─→ Web App: handleSupabaseAuth() called
       └─→ setEnvironmentContext({ type: 'webapp', ... })
   ↓
5. Global module state set (getEnvironmentContext() now returns environment)
   ↓
6. All subsequent API calls automatically routed based on environment
```

### Request Routing Logic

```
API Call Made (fetchCustomers() OR dataService.get('/api/customers'))
  ↓
Check getEnvironmentContext().type
  ├─→ FILEMAKER:
  │   ├─ Legacy API: handleFileMakerNativeCall()
  │   └─ Modern API: convertToFileMakerCall() via response interceptor
  │   ↓
  │   FMGofer.PerformScript('JS * Fetch Data', JSON params)
  │   ↓
  │   FileMaker Database (devCustomers layout)
  │
  └─→ WEBAPP:
      ├─ Legacy API: callBackendAPI() converts FileMaker params to HTTP
      └─ Modern API: Direct axios HTTP request with HMAC auth
      ↓
      Backend API validates HMAC signature
      ↓
      Supabase Database query
```

### Critical Dependencies

**FileMaker Environment Requires:**
- `window.FMGofer` OR `window.FileMaker` object
- `FMGofer.PerformScript()` OR `window.FileMaker.PerformScript()` function
- FileMaker script: `JS * Fetch Data` (receives JSON parameters)
- FileMaker layouts: `devCustomers`, `devProjects`, `devTasks`, `devRecords`

**Web App Environment Requires:**
- VITE_SECRET_KEY for HMAC signing
- Web Crypto API for signature generation
- Backend API at https://api.claritybusinesssolutions.ca
- Supabase authentication

### Phase 2 Removal Implications

**Files to Modify:**
- `src/api/fileMaker.js` - Remove or stub FileMaker-specific functions
- `src/services/dataService.js` - Remove FileMaker environment routing
- `src/components/auth/SignIn.jsx` - Remove FileMaker detection
- `src/hooks/index.js` - Remove useFileMakerBridge hook
- `src/index.jsx` - Remove FileMaker initialization logic
- `src/services/initializationService.js` - Remove waitForFileMaker
- All files in `src/api/` - Convert from FileMaker params to direct HTTP calls

**Environment Variables to Remove:**
- VITE_FM_URL
- VITE_FM_DATABASE
- VITE_FM_USER
- VITE_FM_PASSWORD

**npm Dependencies to Remove:**
- fm-gofer (if installed)

**Backend API Endpoints to Preserve:**
- All `/filemaker/{layout}/records` endpoints (already exist)
- HMAC authentication (already implemented)
- Response format compatibility (already normalized)

---

## Conclusion

This FileMaker bridge architecture represents a sophisticated dual-environment system with:

1. **Transparent Routing:** Components make standard API calls; environment detection routes automatically
2. **Dual Authentication:** FileMaker bridge authentication vs HMAC-SHA256 backend authentication
3. **Legacy Compatibility:** FileMaker parameter structure translated to RESTful HTTP
4. **Graceful Degradation:** Polling, retries, and fallback mechanisms throughout
5. **Single Script Entry Point:** All FileMaker operations route through `JS * Fetch Data` script

**For Phase 2 removal, the key is:**
- Backend API already exists and works
- HMAC authentication already implemented
- Main work is removing detection logic and converting legacy API calls to direct HTTP
- No backend changes needed - all endpoints already functional

This documentation provides the complete architectural understanding needed to safely remove FileMaker dependencies while preserving all functionality through the existing backend API.
