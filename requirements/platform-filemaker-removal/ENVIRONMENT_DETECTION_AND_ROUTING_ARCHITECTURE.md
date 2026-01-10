# Environment Detection and Routing Architecture

## Table of Contents
- [Overview](#overview)
- [Environment Types and Authentication Methods](#environment-types-and-authentication-methods)
- [Architecture Components](#architecture-components)
- [Request Flow Diagrams](#request-flow-diagrams)
- [Code References](#code-references)
- [Migration Implications](#migration-implications)

## Overview

Clarity CRM Frontend operates in **dual-environment mode**, supporting both FileMaker WebViewer (legacy) and standalone web application (primary) environments. The application automatically detects its runtime environment on startup and routes all data operations accordingly.

This architecture uses:
- **Environment detection** at authentication time
- **Axios interceptors** for automatic request routing
- **FileMaker bridge** (fm-gofer) for FileMaker environments
- **Backend API with HMAC authentication** for web app environments

## Environment Types and Authentication Methods

### Environment Types

Defined in `src/services/dataService.js:13-16`:

```javascript
export const ENVIRONMENT_TYPES = {
  FILEMAKER: 'filemaker',    // Running in FileMaker WebViewer
  WEBAPP: 'webapp'           // Standalone web application
};
```

### Authentication Methods

Defined in `src/services/dataService.js:18-22`:

```javascript
export const AUTH_METHODS = {
  FILEMAKER: 'filemaker',    // FileMaker bridge authentication
  SUPABASE: 'supabase'       // Supabase JWT authentication
};
```

### Global Environment Context

Stored as module-level state in `src/services/dataService.js:28-35`:

```javascript
let currentEnvironment = {
  type: null,                    // 'filemaker' | 'webapp' | null
  authentication: {
    isAuthenticated: false,
    method: null,                // 'filemaker' | 'supabase' | null
    user: null
  }
};
```

## Architecture Components

### 1. Environment Detection (SignIn Component)

**File:** `src/components/auth/SignIn.jsx:24-66`

The SignIn component runs environment detection automatically on mount:

```javascript
const detectFileMaker = useCallback(() => {
  console.log('[SignIn] Starting FileMaker detection...');

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

**Detection Logic:**
1. Checks for `window.FMGofer` or `window.FileMaker` objects
2. Immediate check on component mount
3. Polls every 100ms for up to 3 seconds
4. Falls back to web app authentication if not detected

### 2. Environment Context Setting

**File:** `src/services/dataService.js:43-46`

```javascript
export const setEnvironmentContext = (environment) => {
  currentEnvironment = { ...environment };
  console.log('[DataService] Environment context set:', currentEnvironment);
};
```

Called from two places in `src/index.jsx`:

#### FileMaker Detection Handler (`src/index.jsx:117-139`)

```javascript
const handleFileMakerDetected = useCallback(() => {
  console.log('[App] FileMaker environment detected');

  // Set environment context
  setEnvironment(ENVIRONMENT_TYPES.FILEMAKER);
  setEnvironmentContext({
    type: ENVIRONMENT_TYPES.FILEMAKER,
    authentication: {
      isAuthenticated: true,
      method: AUTH_METHODS.FILEMAKER,
      user: null // Will be set after user context is loaded
    }
  });

  // Set authentication state
  setAuthentication({
    isAuthenticated: true,
    method: AUTH_METHODS.FILEMAKER,
    user: null
  });

  console.log('[App] FileMaker authentication set, starting initialization');
}, [setEnvironment, setAuthentication]);
```

#### Supabase Authentication Handler (`src/index.jsx:141-155`)

```javascript
const handleSupabaseAuth = useCallback((authState) => {
  console.log('[App] Supabase authentication successful', authState);

  // Set environment context
  setEnvironment(ENVIRONMENT_TYPES.WEBAPP);
  setEnvironmentContext({
    type: ENVIRONMENT_TYPES.WEBAPP,
    authentication: authState
  });

  // Set authentication state
  setAuthentication(authState);

  console.log('[App] Supabase authentication set, starting initialization');
}, [setEnvironment, setAuthentication]);
```

### 3. Data Service Client with Axios Interceptors

**File:** `src/services/dataService.js:165-258`

The data service creates an axios client with request and response interceptors that automatically route requests based on environment.

#### Request Interceptor (`src/services/dataService.js:176-216`)

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

#### Response Interceptor (`src/services/dataService.js:218-255`)

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

### 4. HMAC Authentication for Backend API

**File:** `src/services/dataService.js:57-105`

Web app requests use HMAC-SHA256 signatures for authentication:

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
```

### 5. FileMaker Bridge Conversion

**File:** `src/services/dataService.js:108-161`

Converts HTTP requests to FileMaker script calls:

```javascript
const convertToFileMakerCall = async (method, url, data = null) => {
  // Check for FileMaker bridge availability
  const hasFMGofer = typeof FMGofer !== 'undefined' && FMGofer.PerformScript;
  const hasFileMaker = typeof window !== 'undefined' && window.FileMaker && window.FileMaker.PerformScript;

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

**FileMaker Script Called:** `JS * Fetch Data`

**Script Parameters:**
```json
{
  "action": "apiCall",
  "method": "GET|POST|PUT|PATCH|DELETE",
  "endpoint": "customers",
  "data": {},
  "query": {}
}
```

### 6. Legacy API Layer (FileMaker-First)

**Files:** `src/api/customers.js`, `src/api/projects.js`, etc.

These files currently make FileMaker-first calls:

```javascript
// src/api/customers.js:7-16
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

**Current Pattern:**
1. API functions call `handleFileMakerOperation()`
2. Pass FileMaker-style parameters (layout, action, query)
3. Calls `fetchDataFromFileMaker()` in `src/api/fileMaker.js`
4. FileMaker bridge executes script

**Note:** These files will need updating during migration to use environment-aware routing through dataService.

## Request Flow Diagrams

### FileMaker Environment Request Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Component calls API function                                     │
│    Example: fetchCustomers()                                        │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. API Layer (src/api/customers.js)                                │
│    - Uses FileMaker-style parameters                                │
│    - Calls handleFileMakerOperation()                               │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. FileMaker Bridge (src/api/fileMaker.js)                         │
│    - Detects environment: isFileMakerEnvironment()                  │
│    - Routes to FileMaker script call                                │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. FM Gofer / FileMaker.PerformScript                              │
│    - Executes FileMaker script: "JS * Fetch Data"                   │
│    - Script parameters: { layout, action, query, data }             │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. FileMaker Database                                               │
│    - Processes request via FileMaker Data API wrapper               │
│    - Returns records                                                │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. Response flows back through bridge                              │
│    - Parsed and normalized                                          │
│    - Returned to component                                          │
└─────────────────────────────────────────────────────────────────────┘
```

### Web App Environment Request Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Component calls API function                                     │
│    Example: fetchCustomers()                                        │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. API Layer (src/api/customers.js)                                │
│    - Uses FileMaker-style parameters                                │
│    - Calls handleFileMakerOperation()                               │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. FileMaker Bridge (src/api/fileMaker.js)                         │
│    - Detects environment: !isFileMakerEnvironment()                 │
│    - Routes to callBackendAPI()                                     │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. Backend API Translation (src/api/fileMaker.js:93-200)           │
│    - Converts FileMaker params to HTTP request                      │
│    - Maps layout → endpoint, action → HTTP method                   │
│    - Generates HMAC-SHA256 authentication header                    │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. Backend API (https://api.claritybusinesssolutions.ca)           │
│    - Verifies HMAC signature                                        │
│    - Routes to appropriate handler                                  │
│    - Queries Supabase database                                      │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. Supabase Database                                                │
│    - Executes SQL query with RLS policies                           │
│    - Returns records                                                │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 7. Response flows back through API                                 │
│    - Backend normalizes to FileMaker-like format                    │
│    - Response parsed and returned to component                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Modern Data Service Request Flow (Environment-Aware)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Component calls dataService                                      │
│    Example: dataService.get('/api/customers')                       │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. Data Service (src/services/dataService.js)                      │
│    - Uses axios client with interceptors                            │
│    - No explicit environment checking needed                        │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. Request Interceptor (src/services/dataService.js:176-216)       │
│    - Reads environment: getEnvironmentContext()                     │
│    - If FILEMAKER: marks request, stores original config            │
│    - If WEBAPP: adds HMAC authentication header                     │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
         ▼                 ▼
┌──────────────────┐  ┌──────────────────┐
│ FileMaker Path   │  │ Web App Path     │
└────────┬─────────┘  └────────┬─────────┘
         │                     │
         ▼                     ▼
┌──────────────────┐  ┌──────────────────┐
│ Response         │  │ Axios makes      │
│ Interceptor      │  │ HTTP request     │
│ converts to FM   │  │ to backend API   │
│ script call      │  │                  │
└────────┬─────────┘  └────────┬─────────┘
         │                     │
         ▼                     ▼
┌──────────────────┐  ┌──────────────────┐
│ FM Script        │  │ Backend API      │
│ "JS * Fetch      │  │ processes        │
│ Data"            │  │ request          │
└────────┬─────────┘  └────────┬─────────┘
         │                     │
         └────────┬────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. Response normalized and returned to component                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Application Initialization Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. App Renders (src/index.jsx)                                     │
│    - Wrapped in AppStateProvider                                    │
│    - Authentication state: isAuthenticated = false                  │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. SignIn Component Mounts (src/components/auth/SignIn.jsx)        │
│    - Starts FileMaker detection immediately                         │
│    - Renders authentication form                                    │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
         ▼                 ▼
┌──────────────────────────────┐  ┌──────────────────────────────────┐
│ FileMaker Detected           │  │ FileMaker Not Detected           │
│                              │  │                                  │
│ - window.FMGofer exists      │  │ - After 3 second timeout         │
│ - Calls onFileMakerDetected()│  │ - Shows Supabase login form      │
└─────────────┬────────────────┘  └─────────────┬────────────────────┘
              │                                 │
              ▼                                 ▼
┌──────────────────────────────┐  ┌──────────────────────────────────┐
│ handleFileMakerDetected      │  │ User Enters Credentials          │
│ (src/index.jsx:117-139)      │  │                                  │
│                              │  │ - Email + password               │
│ - Sets environment type:     │  │ - Calls signInWithEmail()        │
│   FILEMAKER                  │  │                                  │
│ - Sets auth method:          │  └─────────────┬────────────────────┘
│   FILEMAKER                  │                │
│ - Calls setEnvironmentContext│                ▼
│                              │  ┌──────────────────────────────────┐
└─────────────┬────────────────┘  │ handleSupabaseAuth               │
              │                   │ (src/index.jsx:141-155)          │
              │                   │                                  │
              │                   │ - Sets environment type: WEBAPP  │
              │                   │ - Sets auth method: SUPABASE     │
              │                   │ - Stores user from Supabase      │
              │                   │ - Calls setEnvironmentContext    │
              │                   │                                  │
              └─────────┬─────────┴──────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. Environment Context Set                                          │
│    (src/services/dataService.js:43-46)                              │
│                                                                     │
│    currentEnvironment = {                                           │
│      type: 'filemaker' | 'webapp',                                  │
│      authentication: { ... }                                        │
│    }                                                                │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. App Re-renders with Authentication                              │
│    (src/index.jsx:451-458)                                          │
│                                                                     │
│    - isAuthenticated = true                                         │
│    - SignIn component hidden                                        │
│    - Initialization effect triggers                                 │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. Initialization Effect (src/index.jsx:163-279)                   │
│                                                                     │
│    FileMaker Flow:                                                  │
│    - Wait for FileMaker bridge ready                                │
│    - Load user context from FileMaker                               │
│    - Fetch Supabase user ID for dual-write support                  │
│    - Load products and sales                                        │
│    - Preload customers and teams                                    │
│                                                                     │
│    Web App Flow:                                                    │
│    - Set user from Supabase auth                                    │
│    - Fetch Supabase organization ID                                 │
│    - Load products and sales                                        │
│    - Preload customers and teams                                    │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. App Ready                                                        │
│    - All data loaded                                                │
│    - Environment-aware routing active                               │
│    - User can interact with application                             │
└─────────────────────────────────────────────────────────────────────┘
```

## Code References

### Core Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/services/dataService.js` | 13-22 | Environment types and auth method constants |
| `src/services/dataService.js` | 28-35 | Global environment state |
| `src/services/dataService.js` | 43-46 | `setEnvironmentContext()` function |
| `src/services/dataService.js` | 52-54 | `getEnvironmentContext()` function |
| `src/services/dataService.js` | 57-105 | HMAC authentication header generation |
| `src/services/dataService.js` | 108-161 | FileMaker bridge conversion |
| `src/services/dataService.js` | 165-258 | Axios client with interceptors |
| `src/components/auth/SignIn.jsx` | 24-66 | FileMaker environment detection |
| `src/components/auth/SignIn.jsx` | 75-99 | Supabase authentication handler |
| `src/index.jsx` | 117-139 | FileMaker detection handler |
| `src/index.jsx` | 141-155 | Supabase authentication handler |
| `src/index.jsx` | 163-279 | Initialization effect with environment branching |
| `src/api/fileMaker.js` | 30-36 | `isFileMakerEnvironment()` detection |
| `src/api/fileMaker.js` | 43-86 | Backend HMAC auth header generation |
| `src/api/fileMaker.js` | 93-200 | `callBackendAPI()` - FileMaker params to HTTP |

### API Layer Examples

| File | Purpose | Current Pattern |
|------|---------|-----------------|
| `src/api/customers.js` | Customer CRUD operations | FileMaker-first via `fetchDataFromFileMaker()` |
| `src/api/projects.js` | Project CRUD operations | FileMaker-first via `fetchDataFromFileMaker()` |
| `src/api/tasks.js` | Task CRUD operations | FileMaker-first via `fetchDataFromFileMaker()` |
| `src/api/teams.js` | Team CRUD operations | FileMaker-first via `fetchDataFromFileMaker()` |

**Migration Note:** These files need updating to use `dataService` instead of direct FileMaker calls.

### Context and State Management

| File | Lines | Purpose |
|------|-------|---------|
| `src/context/AppStateContext.jsx` | 36-39 | Authentication action types |
| `src/context/AppStateContext.jsx` | 67-77 | Authentication and environment state |
| `src/services/initializationService.js` | 8-237 | Application initialization orchestration |

## Migration Implications

### What Needs to Change

1. **API Layer (src/api/*.js)**
   - Currently makes FileMaker-first calls
   - Needs conversion to use `dataService` for environment-aware routing
   - Remove direct `fetchDataFromFileMaker()` calls
   - Use modern HTTP-style API calls that route automatically

2. **FileMaker Bridge (src/api/fileMaker.js)**
   - Can be removed entirely once API layer migrates
   - Logic duplicates what's in `dataService.js`
   - Keep only if needed for backward compatibility during transition

3. **Environment Detection**
   - SignIn component can be simplified
   - Remove 3-second polling for FileMaker bridge
   - Always use Supabase authentication

4. **Initialization Flow**
   - Remove FileMaker-specific initialization branch
   - Remove `fmReady` checks
   - Simplify to single web app flow

### What Can Stay

1. **Data Service Core (src/services/dataService.js)**
   - Well-designed environment-aware routing
   - Axios interceptor pattern is solid
   - HMAC authentication can remain
   - After migration: Remove FileMaker code path, keep structure

2. **Context and State Management**
   - `AppStateContext` works for both environments
   - Authentication state structure is good
   - Environment tracking can be simplified but doesn't break anything

3. **Component Layer**
   - Components don't need changes
   - They use hooks and services that abstract environment
   - Migration is transparent to UI layer

### Migration Path

**Phase 1: Add Environment-Aware API Functions**
- Create new API functions using `dataService.get/post/put/delete`
- Keep old FileMaker functions for backward compatibility
- Components call new functions

**Phase 2: Test Web App Routing**
- Verify all operations work through backend API
- Test HMAC authentication
- Ensure data consistency

**Phase 3: Remove FileMaker Code**
- Delete FileMaker API functions
- Remove FileMaker environment detection
- Remove `src/api/fileMaker.js`
- Simplify `dataService.js` to remove FileMaker code path

**Phase 4: Simplify Authentication**
- Remove environment detection from SignIn
- Always use Supabase authentication
- Remove `ENVIRONMENT_TYPES.FILEMAKER` and `AUTH_METHODS.FILEMAKER`

## Environment Variables

Required for backend API authentication:

```bash
VITE_SECRET_KEY=<hmac-secret-key>
VITE_API_URL=https://api.claritybusinesssolutions.ca
VITE_SUPABASE_URL=https://supabase.claritybusinesssolutions.ca
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
```

## Testing Environment Detection

### Test FileMaker Environment

1. Run in FileMaker WebViewer with fm-gofer loaded
2. Verify `window.FMGofer` or `window.FileMaker` exists
3. Check console: `[SignIn] FileMaker environment detected`
4. Check console: `[DataService] Environment context set: { type: 'filemaker', ... }`
5. Verify requests log: `[DataService] Routing through FileMaker`

### Test Web App Environment

1. Run standalone: `npm run dev`
2. Open browser: `http://localhost:1235`
3. Check console: `[SignIn] FileMaker not detected, continuing with web app authentication`
4. Enter Supabase credentials
5. Check console: `[DataService] Environment context set: { type: 'webapp', ... }`
6. Verify requests log: `[DataService] Routing through backend API`

### Verify Request Routing

**FileMaker Environment:**
```javascript
// Request goes through:
dataService.get('/api/customers')
  → Request Interceptor marks as _isFileMakerRequest
  → Response Interceptor converts to FileMaker script call
  → FMGofer.PerformScript('JS * Fetch Data', params)
  → FileMaker database
```

**Web App Environment:**
```javascript
// Request goes through:
dataService.get('/api/customers')
  → Request Interceptor adds HMAC auth header
  → Axios makes HTTP request
  → Backend API (https://api.claritybusinesssolutions.ca)
  → Supabase database
```

## Conclusion

The environment detection and routing architecture is well-designed with clear separation of concerns:

- **SignIn component** handles detection
- **setEnvironmentContext** stores environment globally
- **Axios interceptors** provide automatic routing
- **API layer** makes environment-agnostic calls (when using dataService)

The main migration effort will be:
1. Converting API layer from FileMaker-first to environment-aware dataService calls
2. Removing FileMaker environment support after migration
3. Simplifying authentication to Supabase-only

The architecture is migration-friendly because:
- Environment routing is centralized in dataService
- Components don't need changes
- New code can use dataService immediately
- Old code can be migrated incrementally
