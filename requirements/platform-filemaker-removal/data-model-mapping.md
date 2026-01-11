# Data Model Mapping: Platform Configuration

Platform-level environment and authentication state mapping for FileMaker removal.

**Last Updated:** 2026-01-11
**Scope:** Platform configuration state (no database tables)

---

## Overview

Unlike feature migrations (customers, projects, tasks), the platform FileMaker removal does NOT involve database table migrations. This document covers:

1. **Environment State Configuration** - How environment context is stored and managed
2. **Authentication Context Structure** - Authentication state shape and transitions
3. **Request Metadata** - Flags and parameters used for routing

**No Database Changes Required:** The platform removal is purely a frontend refactoring. All necessary database tables already exist from feature migrations.

---

## Environment State Configuration

### Current State Structure

**Location:** `src/services/dataService.js:24-41`

```javascript
let currentEnvironment = {
  type: null,              // 'filemaker' | 'webapp' | null
  authentication: {
    isAuthenticated: false,
    method: null,          // 'filemaker' | 'supabase' | null
    user: null
  }
};
```

**State Fields:**

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `type` | string \| null | `'filemaker'`, `'webapp'`, `null` | Current environment type |
| `authentication.isAuthenticated` | boolean | `true`, `false` | Whether user is authenticated |
| `authentication.method` | string \| null | `'filemaker'`, `'supabase'`, `null` | Authentication method used |
| `authentication.user` | object \| null | User object or `null` | Current user data |

### Target State Structure (Simplified)

```javascript
let currentEnvironment = {
  type: 'webapp',         // Always 'webapp' (constant)
  authentication: {
    isAuthenticated: false,
    method: 'supabase',   // Always 'supabase' (constant)
    user: null
  }
};
```

**Simplification:**
- `type` is always `'webapp'` - no environment detection needed
- `method` is always `'supabase'` - no FileMaker authentication option
- State structure remains compatible for existing code

### Environment Type Constants

**Current Definition:** `src/services/dataService.js:13-16`

```javascript
export const ENVIRONMENT_TYPES = {
  FILEMAKER: 'filemaker',
  WEBAPP: 'webapp'
};
```

**Target Definition:**

```javascript
export const ENVIRONMENT_TYPES = {
  // FILEMAKER: 'filemaker',  // REMOVED
  WEBAPP: 'webapp'
};
```

Or completely remove the constant and hardcode `'webapp'` throughout.

### Authentication Method Constants

**Current Definition:** `src/services/dataService.js:19-22`

```javascript
export const AUTH_METHODS = {
  FILEMAKER: 'filemaker',
  SUPABASE: 'supabase'
};
```

**Target Definition:**

```javascript
export const AUTH_METHODS = {
  // FILEMAKER: 'filemaker',  // REMOVED
  SUPABASE: 'supabase'
};
```

Or completely remove the constant and hardcode `'supabase'` throughout.

---

## Authentication Context Structure

### Current Authentication Flow States

**FileMaker Authentication:**
```javascript
{
  type: ENVIRONMENT_TYPES.FILEMAKER,
  authentication: {
    isAuthenticated: true,              // Immediately true when FileMaker detected
    method: AUTH_METHODS.FILEMAKER,
    user: null                          // Initially null, loaded via fetchDataFromFileMaker
  }
}
```

**Supabase Authentication:**
```javascript
{
  type: ENVIRONMENT_TYPES.WEBAPP,
  authentication: {
    isAuthenticated: true,              // True after Supabase sign-in
    method: AUTH_METHODS.SUPABASE,
    user: {
      id: 'uuid',
      email: 'user@example.com',
      metadata: { ... }
    }
  }
}
```

### Target Authentication Flow States (Supabase Only)

**Unauthenticated State:**
```javascript
{
  type: 'webapp',
  authentication: {
    isAuthenticated: false,
    method: 'supabase',
    user: null
  }
}
```

**Authenticated State:**
```javascript
{
  type: 'webapp',
  authentication: {
    isAuthenticated: true,
    method: 'supabase',
    user: {
      id: 'uuid',
      email: 'user@example.com',
      metadata: {
        organization_id: 'uuid',
        role: 'admin' | 'member',
        full_name: 'John Doe',
        avatar_url: 'https://...'
      }
    }
  }
}
```

**State Transitions:**

```
Initial State (app load)
  ↓
Unauthenticated: { type: 'webapp', authentication: { isAuthenticated: false, method: 'supabase', user: null } }
  ↓
User submits credentials
  ↓
Supabase authentication
  ↓
Success: { type: 'webapp', authentication: { isAuthenticated: true, method: 'supabase', user: {...} } }
  ↓
User logs out
  ↓
Unauthenticated: { type: 'webapp', authentication: { isAuthenticated: false, method: 'supabase', user: null } }
```

---

## Request Metadata and Routing Flags

### Current Request Interceptor Flags

**Location:** `src/services/dataService.js:176-216`

Axios request config is augmented with FileMaker-specific flags:

```javascript
// FileMaker request flags (TO BE REMOVED)
config._isFileMakerRequest = true;      // Marks request as FileMaker
config._originalUrl = config.url;        // Stores original URL for conversion
config._originalData = config.data;      // Stores original data for conversion
```

**Usage in Response Interceptor:** `src/services/dataService.js:222`

```javascript
if (response.config._isFileMakerRequest) {
  // Convert to FileMaker call
  const fileMakerResponse = await convertToFileMakerCall(...);
  return { ...response, data: fileMakerResponse };
}
```

### Target Request Metadata (Simplified)

**All FileMaker flags removed:**
- No `_isFileMakerRequest` flag
- No `_originalUrl` storage
- No `_originalData` storage

**Standard axios request config only:**
```javascript
{
  method: 'GET',
  url: '/api/customers',
  headers: {
    'Authorization': 'Bearer {hmac_signature}.{timestamp}',
    'Content-Type': 'application/json'
  },
  data: null
}
```

---

## FileMaker Parameter Structure (TO BE REMOVED)

### Current FileMaker API Parameters

**Location:** Used throughout `src/api/*.js` files

```javascript
// FileMaker parameter structure (TO BE REMOVED)
{
  layout: 'devCustomers',        // FileMaker layout name
  action: 'read',                // CRUD operation
  query: [{ "__ID": "*" }],      // FileMaker query (optional)
  recordId: '123',               // Record ID for update/delete (optional)
  fieldData: { ... }             // Data for create/update (optional)
}
```

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

### Target HTTP Request Parameters

**Direct HTTP calls with standard REST conventions:**

```javascript
// GET all customers
await dataService.get('/api/customers');

// GET specific customer
await dataService.get('/api/customers/123');

// POST create customer
await dataService.post('/api/customers', {
  name: 'Acme Corp',
  email: 'contact@acme.com',
  phone: '555-1234'
});

// PATCH update customer
await dataService.patch('/api/customers/123', {
  name: 'Updated Name'
});

// DELETE customer
await dataService.delete('/api/customers/123');
```

**No FileMaker-specific parameters** - Standard HTTP method + URL + body.

---

## Backend API Response Format

### Current FileMaker-Compatible Response

**Location:** `src/api/fileMaker.js:93-200` (callBackendAPI function)

Backend API responses are wrapped to match FileMaker format:

```javascript
// Backend raw response
{
  "record_id": "123",
  "data": { ... }
}

// Wrapped to FileMaker format
{
  "response": {
    "recordId": "123",
    "data": { ... },
    "dataInfo": {}
  },
  "messages": [
    { "code": "0", "message": "OK" }
  ]
}
```

### Target Backend API Response (Direct)

**No wrapping needed** - Use backend response directly:

```javascript
// GET /api/customers
{
  "customers": [
    { "id": "uuid", "name": "Acme Corp", ... },
    { "id": "uuid", "name": "Beta Inc", ... }
  ],
  "total": 50,
  "page": 1,
  "limit": 20
}

// GET /api/customers/123
{
  "id": "uuid",
  "name": "Acme Corp",
  "email": "contact@acme.com",
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-10T12:00:00Z"
}

// POST /api/customers
{
  "id": "uuid",
  "name": "New Customer",
  "created_at": "2026-01-11T15:30:00Z"
}
```

**Error Responses:**
```javascript
{
  "error": true,
  "message": "Customer not found",
  "code": "NOT_FOUND",
  "status": 404
}
```

---

## Environment Variables Configuration

### Current FileMaker Environment Variables

**Location:** `.env` file

```bash
# FileMaker Server Configuration (TO BE REMOVED)
VITE_FM_URL=https://server.claritybusinesssolutions.ca/fmi/data/v1
VITE_FM_DATABASE=clarityCRM
VITE_FM_USER=webviewer_user
VITE_FM_PASSWORD=encrypted_password

# Backend API Configuration (KEEP)
VITE_API_URL=https://api.claritybusinesssolutions.ca
VITE_SECRET_KEY=hmac_secret_key

# Supabase Configuration (KEEP)
VITE_SUPABASE_URL=https://supabase.claritybusinesssolutions.ca
VITE_SUPABASE_ANON_KEY=public_anon_key
VITE_SUPABASE_SERVICE_ROLE_KEY=service_role_key
```

### Target Environment Variables

```bash
# Backend API Configuration
VITE_API_URL=https://api.claritybusinesssolutions.ca
VITE_SECRET_KEY=hmac_secret_key

# Supabase Configuration
VITE_SUPABASE_URL=https://supabase.claritybusinesssolutions.ca
VITE_SUPABASE_ANON_KEY=public_anon_key
VITE_SUPABASE_SERVICE_ROLE_KEY=service_role_key

# QuickBooks Configuration
VITE_QB_CLIENT_ID=qb_client_id
VITE_QB_CLIENT_SECRET=qb_client_secret

# Mailjet Configuration
VITE_MAILJET_API_KEY=mailjet_api_key
VITE_MAILJET_SECRET_KEY=mailjet_secret_key

# App Configuration
VITE_APP_NAME=Clarity CRM
VITE_VERSION=2.0.0
```

**Removed Variables:**
- `VITE_FM_URL`
- `VITE_FM_DATABASE`
- `VITE_FM_USER`
- `VITE_FM_PASSWORD`

---

## Package Dependencies

### Current npm Dependencies

**Location:** `package.json`

```json
{
  "dependencies": {
    "fm-gofer": "^1.10.0",     // TO BE REMOVED
    "axios": "^1.6.2",         // KEEP
    "react": "^18.2.0",        // KEEP
    // ... other packages
  }
}
```

### Target npm Dependencies

```json
{
  "dependencies": {
    // "fm-gofer": "^1.10.0",  // REMOVED
    "axios": "^1.6.2",         // KEEP
    "react": "^18.2.0",        // KEEP
    // ... other packages
  }
}
```

**Removal Command:**
```bash
npm uninstall fm-gofer
```

---

## Session Storage and Local Storage

### Current Storage Keys

**No FileMaker-specific localStorage or sessionStorage keys identified.**

Authentication state is managed in React context and Supabase manages its own session storage:

```javascript
// Supabase session storage (managed by Supabase SDK)
'supabase.auth.token'
'supabase.auth.expires_at'
```

**Dark mode preference:**
```javascript
localStorage.getItem('theme')  // 'light' | 'dark'
```

### Target Storage Keys (No Changes)

Session management remains identical - Supabase SDK handles all authentication storage.

---

## Data Migration Impact

### No Database Migrations Required

**Platform removal does NOT require database changes:**
- Environment state is runtime configuration only
- No persistent storage of environment type
- Authentication state stored by Supabase SDK
- Feature data already migrated (customers, projects, tasks, etc.)

### Frontend State Migration

**Runtime state transitions:**

```javascript
// Before (dual-environment)
const env = getEnvironmentContext();
if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
  // FileMaker path
} else if (env.type === ENVIRONMENT_TYPES.WEBAPP) {
  // Web app path
}

// After (web-only)
// No branching needed - always web app
const response = await dataService.get('/api/customers');
```

---

## Summary: Configuration Changes Only

**What Changes:**
1. Environment state structure (simplified)
2. Authentication method (Supabase only)
3. Request routing flags (removed)
4. FileMaker parameter structures (removed)
5. Environment variables (FileMaker vars removed)
6. npm dependencies (fm-gofer removed)

**What Stays the Same:**
1. Backend API endpoints
2. Database schema (no changes)
3. Supabase authentication
4. HMAC request signing
5. Response handling
6. User session management

**No Data Migrations:**
- Platform removal is pure frontend refactoring
- All data already exists in Supabase
- No record transformations needed
- No ID reconciliation required

---

**Document Version:** 1.0
**Last Updated:** 2026-01-11
**Status:** Complete - No Database Changes Required
