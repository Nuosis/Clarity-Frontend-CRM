# Authentication System Changes - FileMaker Removal

## Table of Contents
- [Executive Summary](#executive-summary)
- [Current Authentication Architecture](#current-authentication-architecture)
- [Required Changes](#required-changes)
- [Detailed Implementation Requirements](#detailed-implementation-requirements)
- [Code Reference Map](#code-reference-map)
- [Testing Considerations](#testing-considerations)
- [Security Considerations](#security-considerations)

## Executive Summary

**Goal:** Simplify authentication by removing FileMaker dual-environment detection and establishing Supabase as the single authentication method.

**Impact:** Major refactoring of authentication flow, environment detection removal, and simplification of app initialization.

**Affected Components:** 11 files directly, with ripple effects across the entire authentication and initialization flow.

## Current Authentication Architecture

### Dual Environment Detection System

The application currently supports two authentication methods with automatic environment detection:

1. **FileMaker Environment Detection** (src/components/auth/SignIn.jsx:24-66)
   - Polls for `window.FMGofer` or `window.FileMaker` objects
   - 30 attempts at 100ms intervals (3 second timeout)
   - Silent background detection during component mount
   - Triggers FileMaker-specific initialization flow

2. **Supabase Web App Authentication** (src/components/auth/SignIn.jsx:75-99)
   - Email/password form displayed if FileMaker not detected
   - JWT-based authentication via Supabase Auth
   - Session management through Supabase client

### Environment Types and Authentication Methods

**Defined in:** src/services/dataService.js:13-22

```javascript
export const ENVIRONMENT_TYPES = {
  FILEMAKER: 'filemaker',    // REMOVE
  WEBAPP: 'webapp'           // KEEP, rename to default
};

export const AUTH_METHODS = {
  FILEMAKER: 'filemaker',    // REMOVE
  SUPABASE: 'supabase'       // KEEP, make default
};
```

### Global Environment Context

**Defined in:** src/services/dataService.js:28-35

```javascript
let currentEnvironment = {
  type: null,                    // Will always be 'webapp'
  authentication: {
    isAuthenticated: false,
    method: null,                // Will always be 'supabase'
    user: null
  }
};
```

### Authentication Flow Components

#### 1. SignIn Component (src/components/auth/SignIn.jsx)

**Current Props:**
```javascript
{
  onFileMakerDetected: PropTypes.func.isRequired,  // REMOVE
  onSupabaseAuth: PropTypes.func.isRequired,       // KEEP
  onDetectionComplete: PropTypes.func.isRequired   // REMOVE
}
```

**Current Behavior:**
- Runs FileMaker detection on mount (lines 69-72)
- Shows authentication form regardless
- Calls `onFileMakerDetected()` if FileMaker found
- Calls `onDetectionComplete()` if FileMaker not found after 3s
- Calls `onSupabaseAuth()` when form submitted successfully

#### 2. App Initialization (src/index.jsx)

**FileMaker Detection Handler (lines 117-139):**
```javascript
const handleFileMakerDetected = useCallback(() => {
  // Set environment to FILEMAKER
  // Set auth method to AUTH_METHODS.FILEMAKER
  // Update global environment context
  // Trigger FileMaker initialization
}, [setEnvironment, setAuthentication]);
```

**Supabase Auth Handler (lines 141-155):**
```javascript
const handleSupabaseAuth = useCallback((authState) => {
  // Set environment to WEBAPP
  // Set auth method to authState.method (supabase)
  // Update global environment context
  // Trigger web app initialization
}, [setEnvironment, setAuthentication]);
```

**Detection Complete Handler (lines 157-160):**
```javascript
const handleDetectionComplete = useCallback(() => {
  setEnvironmentDetectionComplete(true);
}, [setEnvironmentDetectionComplete]);
```

#### 3. Initialization Flow (src/index.jsx:163-240)

**Dual-path initialization:**

**FileMaker Path (lines 176-218):**
1. Wait for FileMaker bridge ready (`fmReady`)
2. Load user context from FileMaker via `fetchDataFromFileMaker()`
3. Fetch Supabase user ID by email lookup
4. Load products (single-tenancy)
5. Load sales data if org ID available
6. Preload customers from FileMaker
7. Preload teams from FileMaker

**Web App Path (lines 219-240):**
1. Get user from Supabase session
2. Load products (single-tenancy)
3. Load sales if org ID available
4. Preload customers from Supabase
5. Preload teams from Supabase

### AppStateContext Integration

**State Shape (src/context/AppStateContext.jsx:68-78):**
```javascript
authentication: {
  isAuthenticated: false,
  user: null,
  method: null // 'filemaker' | 'supabase' | null
},
environment: {
  type: null, // 'filemaker' | 'webapp' | null
  detectionComplete: false
}
```

**Actions (lines 37-39):**
```javascript
SET_AUTHENTICATION: 'SET_AUTHENTICATION',
SET_ENVIRONMENT: 'SET_ENVIRONMENT',
SET_ENVIRONMENT_DETECTION_COMPLETE: 'SET_ENVIRONMENT_DETECTION_COMPLETE'
```

## Required Changes

### Phase 1: Remove FileMaker Detection

#### 1.1 Update Environment Constants (src/services/dataService.js)

**Remove:**
- `ENVIRONMENT_TYPES.FILEMAKER` constant
- `AUTH_METHODS.FILEMAKER` constant

**Simplify:**
```javascript
// Before
export const ENVIRONMENT_TYPES = {
  FILEMAKER: 'filemaker',
  WEBAPP: 'webapp'
};

export const AUTH_METHODS = {
  FILEMAKER: 'filemaker',
  SUPABASE: 'supabase'
};

// After
// No need for environment types - always web app
// No need for auth method types - always Supabase

// Optional: Keep for backward compatibility but hardcode
export const ENVIRONMENT_TYPES = {
  WEBAPP: 'webapp'
};

export const AUTH_METHODS = {
  SUPABASE: 'supabase'
};
```

**Update Global Environment Context (lines 28-35):**
```javascript
// Before
let currentEnvironment = {
  type: null,
  authentication: {
    isAuthenticated: false,
    method: null,
    user: null
  }
};

// After
let currentEnvironment = {
  type: 'webapp', // Always webapp
  authentication: {
    isAuthenticated: false,
    method: 'supabase', // Always supabase
    user: null
  }
};
```

#### 1.2 Simplify SignIn Component (src/components/auth/SignIn.jsx)

**Remove:**
- FileMaker detection logic (lines 24-66)
- `detectFileMaker()` function
- `useEffect` for detection (lines 69-72)
- `onFileMakerDetected` prop
- `onDetectionComplete` prop

**Updated Component Signature:**
```javascript
// Before
const SignIn = ({ onFileMakerDetected, onSupabaseAuth, onDetectionComplete }) => {

// After
const SignIn = ({ onSupabaseAuth }) => {
```

**Updated PropTypes:**
```javascript
// Before
SignIn.propTypes = {
  onFileMakerDetected: PropTypes.func.isRequired,
  onSupabaseAuth: PropTypes.func.isRequired,
  onDetectionComplete: PropTypes.func.isRequired
};

// After
SignIn.propTypes = {
  onSupabaseAuth: PropTypes.func.isRequired
};
```

**Component Simplification:**
- Remove all FileMaker detection code
- Keep only Supabase authentication form
- Immediate display of sign-in form (no 3-second detection delay)
- Simpler component lifecycle - mount → show form → authenticate

#### 1.3 Update App Initialization (src/index.jsx)

**Remove Handlers:**
- `handleFileMakerDetected()` (lines 117-139)
- `handleDetectionComplete()` (lines 157-160)

**Simplify `handleSupabaseAuth()`:**
```javascript
// Before
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

// After
const handleSupabaseAuth = useCallback((authState) => {
  console.log('[App] Supabase authentication successful', authState);

  // No need to set environment - always webapp
  setEnvironmentContext({
    type: 'webapp',
    authentication: authState
  });

  setAuthentication(authState);

  console.log('[App] Authentication complete, starting initialization');
}, [setAuthentication]);
```

**Update SignIn Usage:**
```javascript
// Before
<SignIn
  onFileMakerDetected={handleFileMakerDetected}
  onSupabaseAuth={handleSupabaseAuth}
  onDetectionComplete={handleDetectionComplete}
/>

// After
<SignIn onSupabaseAuth={handleSupabaseAuth} />
```

**Simplify Initialization Effect (lines 163-240):**

Remove FileMaker initialization path entirely:

```javascript
// Before - Dual path
useEffect(() => {
  const initialize = async () => {
    if (!appState.authentication.isAuthenticated) return;

    if (appState.environment.type === ENVIRONMENT_TYPES.FILEMAKER) {
      // FileMaker initialization (50+ lines)
    } else {
      // Web app initialization
    }
  };
  initialize();
}, [appState.authentication.isAuthenticated, appState.environment.type]);

// After - Single path
useEffect(() => {
  const initialize = async () => {
    if (!appState.authentication.isAuthenticated) return;

    // Always web app initialization
    loadingStateManager.setLoading('initialization', true, 'Initializing application...');

    const user = appState.authentication.user;
    setUser({
      userID: user.id,
      userEmail: user.email,
      userName: user.user_metadata?.name || user.email,
      supabaseUserID: user.id,
      supabaseOrgID: user.user_metadata?.organization_id
    });

    await loadProducts();

    if (user.user_metadata?.organization_id) {
      await loadUnbilledSalesForOrganization(user.user_metadata.organization_id);
    }

    await loadCustomers();
    await loadTeams();

    loadingStateManager.setLoading('initialization', false);
  };

  initialize();
}, [appState.authentication.isAuthenticated]);
```

#### 1.4 Update AppStateContext (src/context/AppStateContext.jsx)

**Simplify State Shape (lines 68-78):**
```javascript
// Before
authentication: {
  isAuthenticated: false,
  user: null,
  method: null // 'filemaker' | 'supabase' | null
},
environment: {
  type: null, // 'filemaker' | 'webapp' | null
  detectionComplete: false
}

// After
authentication: {
  isAuthenticated: false,
  user: null
  // method is always 'supabase' - no need to store
}
// environment is always 'webapp' - no need to store
```

**Remove Actions:**
- `SET_ENVIRONMENT` (line 38)
- `SET_ENVIRONMENT_DETECTION_COMPLETE` (line 39)

**Update Reducer:**
- Remove cases for `SET_ENVIRONMENT` and `SET_ENVIRONMENT_DETECTION_COMPLETE`
- Simplify `SET_AUTHENTICATION` to not handle method type

**Remove Operation Hooks:**
- `setEnvironment` function
- `setEnvironmentDetectionComplete` function

### Phase 2: Remove FileMaker Conditional Logic

#### 2.1 Simplify FileMaker Bridge Usage (src/index.jsx:25-32)

**Remove conditional FileMaker bridge:**
```javascript
// Before
const shouldUseFileMakerBridge = appState.environment.type === ENVIRONMENT_TYPES.FILEMAKER;
const fileMakerBridge = shouldUseFileMakerBridge
  ? useFileMakerBridge()
  : { isReady: true, error: null, status: 'Web app mode - FileMaker bridge disabled' };

const { isReady: fmReady, error: fmError, status: fmStatus } = fileMakerBridge;

// After
// Remove entirely - no FileMaker bridge needed
```

#### 2.2 Update User Context Loading (src/services/initializationService.js)

**Remove FileMaker Methods:**
- `waitForFileMaker()` (lines 14-31)
- `loadUserContext()` (lines 33-45) - calls `fetchDataFromFileMaker`

**Keep Supabase Methods:**
- `fetchSupabaseUserId()` - but simplify to not need email lookup
- `loadProducts()` - already Supabase-only

**New User Context Strategy:**
```javascript
// Instead of loading from FileMaker, get from Supabase session
// User context comes from Supabase Auth user object
// No email lookup needed - user.id is the Supabase user ID
```

### Phase 3: Remove Environment Detection State

#### 3.1 Update AppStateContext Operations

**File:** src/context/AppStateContext.jsx

**Remove from useAppStateOperations:**
```javascript
// Remove these operations
setEnvironment,
setEnvironmentDetectionComplete
```

**Simplify setAuthentication:**
```javascript
// Before - includes method type
const setAuthentication = useCallback((authState) => {
  dispatch({
    type: APP_ACTIONS.SET_AUTHENTICATION,
    payload: authState // { isAuthenticated, method, user }
  });
}, []);

// After - method always 'supabase'
const setAuthentication = useCallback((authState) => {
  dispatch({
    type: APP_ACTIONS.SET_AUTHENTICATION,
    payload: authState // { isAuthenticated, user }
  });
}, []);
```

#### 3.2 Update Data Service

**File:** src/services/dataService.js

**Simplify Request Interceptor (lines 176-216):**
```javascript
// Before - Dual path routing
client.interceptors.request.use(async (config) => {
  const env = getEnvironmentContext();

  if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
    // FileMaker routing
  }

  if (env.type === ENVIRONMENT_TYPES.WEBAPP) {
    // Backend API routing with HMAC
  }

  throw new Error('Environment not detected');
});

// After - Single path
client.interceptors.request.use(async (config) => {
  // Always use backend API with HMAC
  const payload = config.data ? JSON.stringify(config.data) : '';
  const authHeader = await generateBackendAuthHeader(payload);
  config.headers.Authorization = authHeader;

  return config;
});
```

**Simplify Response Interceptor (lines 218-255):**
```javascript
// Before - Handle FileMaker responses
client.interceptors.response.use(async (response) => {
  if (response.config._isFileMakerRequest) {
    // Convert to FileMaker call
  }
  return response;
});

// After - Standard HTTP responses only
client.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[DataService] Response error:', error);
    return Promise.reject(error);
  }
);
```

**Remove FileMaker Methods:**
- `convertToFileMakerCall()` (lines 114-161)
- `convertFileMakerParamsToHTTP()` (lines 383-453)
- `environmentAPI.fileMaker.*` (lines 462-495)

### Phase 4: Update Documentation

#### 4.1 Update Component Documentation

**SignIn Component JSDoc:**
```javascript
// Before
/**
 * SignIn Component - Handles authentication for both FileMaker and web app environments
 *
 * This component automatically detects the environment and provides appropriate authentication:
 * - FileMaker: Auto-detects and authenticates via FileMaker bridge (silent)
 * - Web App: Shows Supabase authentication form
 */

// After
/**
 * SignIn Component - Handles Supabase authentication
 *
 * Displays email/password form for Supabase authentication.
 * On successful authentication, triggers app initialization.
 */
```

#### 4.2 Update CLAUDE.md

Remove references to:
- FileMaker environment detection
- AUTH_METHODS.FILEMAKER
- Dual-environment architecture
- FileMaker auto-detection flow

Update "Environment Detection and Authentication Flow" section to reflect Supabase-only.

## Detailed Implementation Requirements

### File-by-File Change Specification

#### src/services/dataService.js

**Lines to Remove:**
- 13-16: `ENVIRONMENT_TYPES` (or simplify to webapp only)
- 18-22: `AUTH_METHODS` (or simplify to supabase only)
- 28-35: Simplify `currentEnvironment` initial state
- 114-161: `convertToFileMakerCall()` function
- 186-195: FileMaker routing in request interceptor
- 222-240: FileMaker response handling
- 249-251: FileMaker-specific error handling
- 383-453: `convertFileMakerParamsToHTTP()` function
- 462-495: `environmentAPI.fileMaker` object

**Lines to Modify:**
- 43-46: `setEnvironmentContext()` - simplify or remove
- 52-54: `getEnvironmentContext()` - simplify or remove
- 176-216: Request interceptor - always use backend API
- 218-255: Response interceptor - remove FileMaker handling
- 327-375: `request()` legacy method - remove FileMaker params support

**Expected Reduction:** ~250 lines removed, ~50 lines simplified

#### src/components/auth/SignIn.jsx

**Lines to Remove:**
- 6-10: FileMaker-related comments in JSDoc
- 13: `onFileMakerDetected` prop in JSDoc
- 15: `onDetectionComplete` prop in JSDoc
- 24-66: `detectFileMaker()` function
- 69-72: `useEffect` for detection
- 188: `onFileMakerDetected` PropType
- 190: `onDetectionComplete` PropType

**Lines to Modify:**
- 1-15: Update component JSDoc
- 17: Remove props from signature

**Expected Reduction:** ~60 lines removed

#### src/index.jsx

**Lines to Remove:**
- 16: Import of `ENVIRONMENT_TYPES`, `AUTH_METHODS` from dataService
- 25-32: FileMaker bridge conditional usage
- 117-139: `handleFileMakerDetected()` callback
- 157-160: `handleDetectionComplete()` callback
- 176-218: FileMaker initialization path in useEffect
- Reference to `fmReady`, `fmError`, `fmStatus`

**Lines to Modify:**
- 141-155: Simplify `handleSupabaseAuth()` - remove environment setting
- 163-240: Simplify initialization useEffect to single path
- SignIn component usage - remove FileMaker props

**Expected Reduction:** ~120 lines removed, ~80 lines simplified

#### src/context/AppStateContext.jsx

**Lines to Remove:**
- 38-39: `SET_ENVIRONMENT` and `SET_ENVIRONMENT_DETECTION_COMPLETE` actions
- Environment reducer cases
- `setEnvironment` operation
- `setEnvironmentDetectionComplete` operation

**Lines to Modify:**
- 68-78: Simplify authentication and environment state shape
- Remove `method` from authentication object
- Remove `environment` object entirely

**Expected Reduction:** ~40 lines removed

#### src/services/initializationService.js

**Lines to Remove:**
- 1: Import of `fetchDataFromFileMaker`
- 14-31: `waitForFileMaker()` method
- 33-45: `loadUserContext()` method (FileMaker-specific)

**Lines to Keep:**
- 62-185: `fetchSupabaseUserId()` - but may need simplification
- 205-223: `loadProducts()` - already Supabase-only

**Expected Reduction:** ~30 lines removed

#### Additional Files to Update

**src/hooks/index.js:**
- May export `useFileMakerBridge` - verify if used elsewhere
- If only used in index.jsx, can remove export

**CLAUDE.md:**
- Update "Environment Detection and Authentication Flow" section
- Remove FileMaker WebViewer references from authentication docs
- Simplify "Development Guidelines" → "Authentication Debugging"

**README.md:**
- Update architecture overview to reflect single environment
- Remove FileMaker integration section from authentication

### Total Expected Impact

**Lines of Code:**
- **Removed:** ~500 lines
- **Modified:** ~130 lines
- **Net Reduction:** ~370 lines

**Files Modified:** 6 core files + 2 documentation files

## Code Reference Map

### Critical Dependencies

**Environment Detection Chain:**
1. SignIn component mounts → `detectFileMaker()` runs
2. FileMaker detected → `onFileMakerDetected()` → `handleFileMakerDetected()`
3. Sets `environment.type = 'filemaker'` in AppStateContext
4. Sets `authentication.method = 'filemaker'`
5. Updates global `currentEnvironment` via `setEnvironmentContext()`
6. Triggers initialization with FileMaker path

**All steps 1-6 will be removed.**

### State Management Chain

**AppStateContext → dataService:**
- `appState.environment.type` read by dataService interceptors
- `appState.authentication.method` stored but not used by dataService
- `currentEnvironment` (module-level in dataService) used by interceptors

**After changes:**
- No environment type needed
- No authentication method needed
- `currentEnvironment` can be hardcoded or removed

### Initialization Dependencies

**FileMaker Path:**
- Requires `fmReady` from `useFileMakerBridge()`
- Calls `initializationService.waitForFileMaker()`
- Calls `initializationService.loadUserContext()` (FileMaker API)
- Calls `initializationService.fetchSupabaseUserId()` (email lookup)

**Web App Path:**
- Gets user from `appState.authentication.user` (Supabase session)
- Calls `loadProducts()` (Supabase)
- Calls `loadCustomers()` (Supabase)
- Calls `loadTeams()` (Supabase)

**After changes:**
- Only Web App path remains
- No FileMaker bridge dependency
- User context from Supabase session directly
- No email lookup needed (user.id is Supabase user ID)

## Testing Considerations

### Pre-Migration Testing

**Verify Current Behavior:**
1. Web app authentication flow still works
2. Supabase session management intact
3. User context loaded correctly from Supabase

**Test Cases:**
1. **Valid Login:** Email/password → successful authentication → app loads
2. **Invalid Login:** Wrong password → error displayed → retry works
3. **Session Persistence:** Refresh page → session maintained → no re-login
4. **Logout:** Sign out → session cleared → redirects to login
5. **Network Error:** Offline → appropriate error message → retry works

### Post-Migration Testing

**Core Authentication:**
1. ✅ Sign-in form displays immediately (no 3s delay)
2. ✅ Valid credentials authenticate successfully
3. ✅ Invalid credentials show error
4. ✅ Session persists across page reloads
5. ✅ Logout clears session properly

**App Initialization:**
1. ✅ User context set from Supabase session
2. ✅ Products load correctly
3. ✅ Customers load correctly
4. ✅ Teams load correctly
5. ✅ Loading states display properly

**Data Operations:**
1. ✅ All API requests use HMAC authentication
2. ✅ No FileMaker bridge errors in console
3. ✅ CRUD operations work for all entities
4. ✅ No references to 'filemaker' environment type

### Regression Testing

**Areas to Test:**
1. Customer management (CRUD operations)
2. Project management (CRUD operations)
3. Task management (CRUD operations)
4. Team management (CRUD operations)
5. Proposal creation and viewing
6. Financial operations (QuickBooks sync)
7. Marketing campaigns

**Expected Behavior:**
- All operations should work identically
- No functional changes to business logic
- Faster initialization (no 3s detection delay)

## Security Considerations

### Authentication Security

**Current State:**
- Dual authentication methods (FileMaker bridge + Supabase)
- Environment detection adds complexity
- Multiple authentication paths increase attack surface

**After Changes:**
- Single authentication method (Supabase)
- Reduced complexity = fewer vulnerabilities
- Standard JWT-based authentication
- HMAC authentication for backend API

### Session Management

**No Changes Required:**
- Supabase handles session management
- JWT tokens stored securely
- Automatic token refresh
- Secure logout

### Backend API Security

**No Changes Required:**
- HMAC-SHA256 authentication already in place
- Secret key from environment variables
- Request signing prevents tampering

### Potential Security Improvements

1. **Remove Dead Code:** FileMaker bridge code removal reduces attack surface
2. **Simplified Logic:** Fewer code paths = easier security auditing
3. **Consistent Auth:** Single auth method = easier to secure and monitor

## Migration Risk Assessment

### Low Risk Items
✅ Removing FileMaker detection logic (isolated code)
✅ Simplifying SignIn component props (type-safe refactor)
✅ Removing unused constants (no runtime impact)

### Medium Risk Items
⚠️ Modifying dataService interceptors (affects all API calls)
⚠️ Changing AppStateContext shape (affects all components)
⚠️ Simplifying initialization flow (critical startup path)

### High Risk Items
🔴 Removing environment context entirely (widely referenced)
🔴 Changing authentication state shape (used across app)

### Mitigation Strategies

1. **Incremental Rollout:**
   - Keep constants but deprecate (e.g., always return 'webapp')
   - Keep state shape but hardcode values
   - Remove dead code paths first
   - Remove unused code last

2. **Feature Flags:**
   - Use environment variable to control FileMaker detection
   - `VITE_ENABLE_FILEMAKER=false` disables detection
   - Easy rollback if issues found

3. **Comprehensive Testing:**
   - Test every authentication scenario
   - Test all API operations
   - Monitor error logs closely
   - Have rollback plan ready

## Implementation Checklist

### Phase 1: Preparation
- [ ] Review current authentication flow end-to-end
- [ ] Document all FileMaker-specific code paths
- [ ] Create test plan for post-migration validation
- [ ] Set up monitoring/logging for authentication

### Phase 2: Code Changes
- [ ] Update `src/services/dataService.js` - remove FileMaker routing
- [ ] Update `src/components/auth/SignIn.jsx` - remove detection
- [ ] Update `src/index.jsx` - simplify handlers and initialization
- [ ] Update `src/context/AppStateContext.jsx` - simplify state
- [ ] Update `src/services/initializationService.js` - remove FileMaker methods

### Phase 3: Testing
- [ ] Test sign-in flow (valid credentials)
- [ ] Test sign-in flow (invalid credentials)
- [ ] Test session persistence
- [ ] Test logout flow
- [ ] Test app initialization
- [ ] Test all CRUD operations
- [ ] Test no console errors related to FileMaker

### Phase 4: Cleanup
- [ ] Remove FileMaker bridge hook if unused
- [ ] Remove FileMaker API files if unused
- [ ] Update CLAUDE.md documentation
- [ ] Update README.md
- [ ] Remove FileMaker-related environment variables
- [ ] Remove fm-gofer dependency from package.json

### Phase 5: Verification
- [ ] Build succeeds without errors
- [ ] No references to 'filemaker' in authentication code
- [ ] No references to `AUTH_METHODS.FILEMAKER`
- [ ] No references to `ENVIRONMENT_TYPES.FILEMAKER`
- [ ] All tests pass
- [ ] Manual QA complete

## Success Criteria

✅ **Authentication simplified to Supabase-only**
✅ **FileMaker detection code removed**
✅ **Environment detection removed**
✅ **App initialization simplified to single path**
✅ **All existing features work identically**
✅ **No console errors or warnings**
✅ **Build succeeds**
✅ **Documentation updated**
✅ **~370 lines of code removed**
✅ **Faster initialization (no 3s detection delay)**

## Appendix: Alternative Approaches

### Option A: Immediate Removal (Recommended)
- Remove all FileMaker code at once
- Simplest approach
- Fastest to implement
- Higher risk but easier to test

### Option B: Gradual Deprecation
- Keep constants but hardcode to 'webapp'/'supabase'
- Remove functionality but keep structure
- Lower risk but more complex
- Temporary code bloat

### Option C: Feature Flag
- Add `VITE_ENABLE_FILEMAKER` flag
- Default to false
- Easy rollback
- Leaves dead code in codebase

**Recommendation:** Option A (Immediate Removal) is preferred because:
1. FileMaker is fully deprecated (no rollback needed)
2. Simpler = fewer bugs
3. No dead code maintenance burden
4. Clear migration boundary
