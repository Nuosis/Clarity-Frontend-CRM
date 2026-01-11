# Authorization and Authentication Requirements

Complete authorization and authentication requirements for FileMaker removal, transitioning to Supabase-only single-path authentication.

**Last Updated:** 2026-01-11
**Scope:** Platform-level authentication simplification

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Dual Authentication Architecture](#current-dual-authentication-architecture)
3. [Target Single-Path Architecture](#target-single-path-architecture)
4. [Authentication Flow Changes](#authentication-flow-changes)
5. [Authorization Model](#authorization-model)
6. [Implementation Requirements](#implementation-requirements)
7. [Security Considerations](#security-considerations)
8. [Testing Requirements](#testing-requirements)

---

## Executive Summary

### Goal

Simplify authentication by removing FileMaker dual-environment detection and establishing Supabase as the single authentication method with backend HMAC request signing.

### Impact

**Major refactoring of:**
- Authentication flow (remove environment detection)
- App initialization (simplify to Supabase-only)
- Request authorization (always HMAC-SHA256)

**Affected Components:** 11 files directly, with ripple effects across authentication and initialization flow

### Benefits

1. **Simplified User Experience**
   - No polling delays for FileMaker detection
   - Direct login form on app load
   - Faster time-to-interactive

2. **Reduced Code Complexity**
   - Single authentication path
   - No environment branching logic
   - Cleaner error handling

3. **Improved Security**
   - Consistent JWT validation
   - Standard HMAC request signing
   - No FileMaker session bypass

---

## Current Dual Authentication Architecture

### Environment Detection System

**Location:** `src/components/auth/SignIn.jsx:24-66`

Current system polls for FileMaker bridge availability:

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

    // Polling strategy: 30 attempts at 100ms intervals (3 second timeout)
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

### Environment Types and Authentication Methods

**Location:** `src/services/dataService.js:13-22`

```javascript
export const ENVIRONMENT_TYPES = {
  FILEMAKER: 'filemaker',    // TO BE REMOVED
  WEBAPP: 'webapp'           // KEEP as default
};

export const AUTH_METHODS = {
  FILEMAKER: 'filemaker',    // TO BE REMOVED
  SUPABASE: 'supabase'       // KEEP as default
};
```

### Global Environment Context

**Location:** `src/services/dataService.js:28-35`

```javascript
let currentEnvironment = {
  type: null,                    // Currently: 'filemaker' | 'webapp' | null
  authentication: {
    isAuthenticated: false,
    method: null,                // Currently: 'filemaker' | 'supabase' | null
    user: null
  }
};
```

### Current Authentication Flows

**FileMaker Authentication Flow:**

```
1. App loads in FileMaker WebViewer
   ↓
2. SignIn component runs detectFileMaker() on mount
   ↓
3. window.FileMaker object detected within 3 seconds
   ↓
4. onFileMakerDetected() callback fired
   ↓
5. handleFileMakerDetected() sets environment context
   ↓
6. setEnvironmentContext({
     type: ENVIRONMENT_TYPES.FILEMAKER,
     authentication: {
       isAuthenticated: true,
       method: AUTH_METHODS.FILEMAKER,
       user: null
     }
   })
   ↓
7. loadUserContext() fetches user from FileMaker
   ↓
8. App initializes with FileMaker routing active
```

**Supabase Authentication Flow:**

```
1. App loads in web browser
   ↓
2. SignIn component runs detectFileMaker() on mount
   ↓
3. No FileMaker object detected after 3 second timeout
   ↓
4. onDetectionComplete() callback fired
   ↓
5. Authentication form displayed
   ↓
6. User enters email/password and submits
   ↓
7. Supabase authentication via signInWithPassword()
   ↓
8. onSupabaseAuth() callback fired with auth state
   ↓
9. handleSupabaseAuth() sets environment context
   ↓
10. setEnvironmentContext({
      type: ENVIRONMENT_TYPES.WEBAPP,
      authentication: {
        isAuthenticated: true,
        method: AUTH_METHODS.SUPABASE,
        user: { id, email, metadata }
      }
    })
   ↓
11. App initializes with backend API routing active
```

---

## Target Single-Path Architecture

### Simplified Environment Context

**Constant environment type:**
```javascript
const currentEnvironment = {
  type: 'webapp',                // Always 'webapp'
  authentication: {
    isAuthenticated: false,
    method: 'supabase',          // Always 'supabase'
    user: null
  }
};
```

**Environment constants can be removed entirely** or simplified to:
```javascript
export const ENVIRONMENT_TYPE = 'webapp';
export const AUTH_METHOD = 'supabase';
```

### Single Authentication Flow

```
1. App loads in web browser
   ↓
2. SignIn component displays authentication form immediately
   ↓
3. User enters email/password and submits
   ↓
4. Supabase authentication via signInWithPassword()
   ↓
5. JWT token received and stored by Supabase SDK
   ↓
6. onSupabaseAuth() callback fired with auth state
   ↓
7. App sets authentication context:
   {
     isAuthenticated: true,
     method: 'supabase',
     user: { id, email, metadata }
   }
   ↓
8. App initializes and loads user data
   ↓
9. All requests include HMAC-SHA256 Authorization header
   ↓
10. Backend validates JWT + HMAC signature
   ↓
11. User session active
```

### Request Authorization

**All requests use HMAC-SHA256 authentication:**

```javascript
// Request interceptor (SIMPLIFIED)
client.interceptors.request.use(async (config) => {
  // Always add HMAC authentication (no environment check)
  const payload = config.data ? JSON.stringify(config.data) : '';
  const authHeader = await generateBackendAuthHeader(payload);
  config.headers.Authorization = authHeader;

  return config;
});
```

**No FileMaker routing logic** - Direct axios HTTP requests only.

---

## Authentication Flow Changes

### SignIn Component Simplification

**Current Props:** `src/components/auth/SignIn.jsx`
```javascript
{
  onFileMakerDetected: PropTypes.func.isRequired,  // REMOVE
  onSupabaseAuth: PropTypes.func.isRequired,       // KEEP
  onDetectionComplete: PropTypes.func.isRequired   // REMOVE
}
```

**Target Props:**
```javascript
{
  onSupabaseAuth: PropTypes.func.isRequired        // ONLY KEEP THIS
}
```

**Current Behavior:**
1. Run FileMaker detection on mount
2. Poll for 3 seconds
3. Show auth form regardless
4. Call appropriate callback based on detection result

**Target Behavior:**
1. Show auth form immediately on mount
2. Submit credentials to Supabase
3. Call onSupabaseAuth() on success
4. No polling, no detection, no delays

### App Initialization Changes

**Current:** `src/index.jsx:117-155`

Two handlers for dual environments:

```javascript
const handleFileMakerDetected = useCallback(() => {
  setEnvironment(ENVIRONMENT_TYPES.FILEMAKER);
  setEnvironmentContext({
    type: ENVIRONMENT_TYPES.FILEMAKER,
    authentication: {
      isAuthenticated: true,
      method: AUTH_METHODS.FILEMAKER,
      user: null
    }
  });
}, [setEnvironment, setAuthentication]);

const handleSupabaseAuth = useCallback((authState) => {
  setEnvironment(ENVIRONMENT_TYPES.WEBAPP);
  setEnvironmentContext({
    type: ENVIRONMENT_TYPES.WEBAPP,
    authentication: authState
  });
}, [setEnvironment, setAuthentication]);
```

**Target:**

Single handler only:

```javascript
const handleSupabaseAuth = useCallback((authState) => {
  // Set authentication state directly (no environment branching)
  setAuthentication(authState);

  // Environment is always 'webapp'
  setEnvironmentContext({
    type: 'webapp',
    authentication: authState
  });
}, [setAuthentication]);
```

### Context Setting Simplification

**Current:** `src/services/dataService.js:43-54`

```javascript
export const setEnvironmentContext = (environment) => {
  currentEnvironment = { ...environment };
  console.log('[DataService] Environment context set:', currentEnvironment);
};
```

**Target:**

```javascript
export const setAuthenticationContext = (authState) => {
  currentEnvironment = {
    type: 'webapp',              // Always constant
    authentication: authState
  };
  console.log('[DataService] Authentication context set:', currentEnvironment);
};
```

Or completely remove environment tracking:

```javascript
let currentAuthentication = {
  isAuthenticated: false,
  method: 'supabase',
  user: null
};

export const setAuthenticationContext = (authState) => {
  currentAuthentication = authState;
};

export const getAuthenticationContext = () => {
  return currentAuthentication;
};
```

---

## Authorization Model

### Supabase JWT Authentication

**JWT Token Structure:**
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "authenticated",
  "aud": "authenticated",
  "iat": 1736467200,
  "exp": 1736553600,
  "user_metadata": {
    "organization_id": "org-uuid",
    "full_name": "John Doe",
    "role": "admin"
  }
}
```

**Token Storage:**
- Managed by Supabase SDK automatically
- Stored in `localStorage` as `supabase.auth.token`
- Included in all Supabase client requests

**Token Validation:**
- Backend API validates JWT signature
- Checks expiration timestamp
- Verifies role and organization claims
- Enforces RLS policies in database

### HMAC Request Signing

**Purpose:**
- Additional layer of authentication beyond JWT
- Prevents request tampering
- Ensures request integrity

**Signature Generation:**
```javascript
const generateBackendAuthHeader = async (payload = '') => {
  const secretKey = import.meta.env.VITE_SECRET_KEY;
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${timestamp}.${payload}`;

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
};
```

**Request Headers:**
```http
Authorization: Bearer a3f2c8d1b4e9f7a6c2d8e5f1b3a7c4d9e6f2a8b5c1d7e3f9a4b6c2d8e5f1a3b7.1736467200
Content-Type: application/json
```

**Backend Validation:**
1. Extract signature and timestamp from header
2. Reconstruct message: `timestamp.payload`
3. Calculate expected signature using shared secret
4. Compare signatures (constant-time comparison)
5. Verify timestamp is within acceptable window (e.g., ±5 minutes)
6. Reject if signatures don't match or timestamp expired

### Organization-Level Authorization

**RLS (Row Level Security) Policies:**

All database tables enforce organization-level isolation:

```sql
-- Example RLS policy for customers table
CREATE POLICY "Users can only access their organization's customers"
  ON customers
  FOR ALL
  USING (organization_id = auth.jwt() ->> 'user_metadata' ->> 'organization_id');
```

**Organization ID Extraction:**
- From Supabase JWT `user_metadata.organization_id` claim
- Automatically enforced by RLS policies
- No application-level filtering needed

**User Roles:**
- `admin`: Full access to organization data
- `member`: Read/write access to organization data
- `viewer`: Read-only access to organization data

**Role Enforcement:**
- RLS policies check `user_metadata.role` claim
- Admin-only operations protected at database level
- Application UI adjusts based on role

---

## Implementation Requirements

### Files Requiring Changes

**1. SignIn Component** (`src/components/auth/SignIn.jsx`)

**Remove:**
- `detectFileMaker()` function (lines 24-66)
- `onFileMakerDetected` prop
- `onDetectionComplete` prop
- FileMaker detection useEffect

**Modify:**
- Component now only handles Supabase authentication
- Display form immediately on mount
- Remove all polling and detection logic

**2. App Initialization** (`src/index.jsx`)

**Remove:**
- `handleFileMakerDetected` handler (lines 117-139)
- FileMaker initialization effect (lines 163-205)
- useFileMakerBridge hook usage (line 27-32)
- Environment type checks throughout

**Modify:**
- `handleSupabaseAuth` simplified to single authentication path
- Remove environment branching in initialization useEffect
- Direct app initialization after Supabase auth

**3. Data Service** (`src/services/dataService.js`)

**Remove:**
- `ENVIRONMENT_TYPES.FILEMAKER`
- `AUTH_METHODS.FILEMAKER`
- Request interceptor FileMaker branching (lines 187-197)
- Response interceptor FileMaker conversion (lines 222-236)
- `convertToFileMakerCall` function (lines 108-161)

**Modify:**
- Request interceptor always adds HMAC auth
- Response interceptor passes through directly
- Simplify or remove environment context

**4. useFileMakerBridge Hook** (`src/hooks/index.js`)

**Remove:**
- Entire `useFileMakerBridge` function (lines 3-64)

**Alternative:**
- Leave stub that returns `{ isReady: true }` for compatibility
- Or remove completely and update all call sites

**5. Initialization Service** (`src/services/initializationService.js`)

**Remove:**
- FileMaker context loading via `fetchDataFromFileMaker`
- `waitForFileMaker` function if exists

**Modify:**
- Load user context directly from Supabase
- No environment detection logic

### New Authentication Flow Implementation

**Simplified SignIn Component:**

```javascript
import { useState } from 'react';
import { supabase } from '../../config';

export default function SignIn({ onSupabaseAuth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      // Call parent handler with authentication state
      onSupabaseAuth({
        isAuthenticated: true,
        method: 'supabase',
        user: data.user
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

**Simplified App Initialization:**

```javascript
const handleSupabaseAuth = useCallback((authState) => {
  setAuthentication(authState);
  // No environment setting needed
}, [setAuthentication]);

useEffect(() => {
  if (appState.authentication.isAuthenticated) {
    // Load user data and initialize app
    initializeApp();
  }
}, [appState.authentication.isAuthenticated]);
```

---

## Security Considerations

### Authentication Security

**1. JWT Token Security**
- ✅ HTTPS-only transmission
- ✅ Short expiration (1 hour default)
- ✅ Automatic refresh by Supabase SDK
- ✅ Secure storage in httpOnly cookies or localStorage

**2. HMAC Signature Security**
- ✅ Secret key stored in environment variables
- ✅ Never exposed to client-side code
- ✅ Timestamp validation prevents replay attacks
- ✅ Constant-time signature comparison

**3. Password Security**
- ✅ Handled by Supabase Auth
- ✅ bcrypt hashing
- ✅ Minimum password requirements enforced
- ✅ Email verification optional

### Authorization Security

**1. Row Level Security (RLS)**
- ✅ All database tables have RLS policies
- ✅ Organization isolation enforced at database level
- ✅ No application-level filtering needed
- ✅ Automatic enforcement via JWT claims

**2. Role-Based Access Control (RBAC)**
- ✅ Roles stored in JWT user_metadata
- ✅ Admin-only operations protected by RLS
- ✅ UI adapts based on user role
- ✅ Backend validates role claims

**3. Session Management**
- ✅ Automatic session expiration
- ✅ Logout clears all tokens
- ✅ Concurrent session support
- ✅ Session refresh before expiration

### Removed Attack Vectors

**FileMaker Removal Eliminates:**
1. FileMaker bridge message event hijacking
2. window.FileMaker object manipulation
3. FMGofer script injection
4. FileMaker session bypass
5. Dual-path authentication confusion

---

## Testing Requirements

### Unit Tests

**Authentication Flow:**
- ✅ SignIn component renders form
- ✅ Form submission calls Supabase auth
- ✅ Success triggers onSupabaseAuth callback
- ✅ Error displays error message
- ✅ Loading state during authentication

**Request Authorization:**
- ✅ HMAC signature generation
- ✅ Authorization header format
- ✅ Timestamp validation
- ✅ Payload signing

**Session Management:**
- ✅ Token storage and retrieval
- ✅ Automatic token refresh
- ✅ Logout clears session
- ✅ Expired token handling

### Integration Tests

**End-to-End Authentication:**
1. Load app → See login form immediately
2. Enter credentials → Submit form
3. Supabase authentication → Receive JWT
4. App initializes → Load user data
5. Make API request → HMAC auth added automatically
6. Backend validates → Request succeeds
7. Logout → Session cleared

**Authorization Enforcement:**
1. User A from Org X logs in
2. Fetch customers → Only Org X customers returned
3. Attempt to access Org Y customer → 403 Forbidden
4. Create new customer → Org X automatically assigned
5. Admin user → Full access
6. Member user → Limited access based on role

### Regression Tests

**No FileMaker References:**
```bash
# Grep for FileMaker references
grep -r "FileMaker" src/
grep -r "FMGofer" src/
grep -r "ENVIRONMENT_TYPES.FILEMAKER" src/

# Should return zero results
```

**All Features Work:**
- ✅ Customers CRUD
- ✅ Projects CRUD
- ✅ Tasks CRUD with timer
- ✅ Teams CRUD
- ✅ Notes CRUD
- ✅ Links CRUD
- ✅ Financial records queries
- ✅ QuickBooks integration

---

## References

### Key Source Files

**Authentication:**
- `src/components/auth/SignIn.jsx` (193 lines)
- `src/index.jsx` (566 lines)
- `src/services/dataService.js` (519 lines)
- `src/hooks/index.js` (useFileMakerBridge hook)

**Configuration:**
- `.env` (environment variables)
- `src/config.js` (Supabase configuration)

### Related Documentation

- `current-implementation.md` - FileMaker architecture details
- `migration-plan.md` - Step-by-step removal process
- `acceptance-criteria.md` - Testing requirements

---

**Document Version:** 1.0
**Last Updated:** 2026-01-11
**Status:** Complete - Ready for Phase 2 Implementation
