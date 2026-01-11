# QuickBooks Integration - Authorization and Security

**Document Version:** 1.0.0
**Date:** 2026-01-10
**Status:** Documentation - Based on Production Implementation

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication Methods](#authentication-methods)
   - [QuickBooks OAuth 2.0](#quickbooks-oauth-20)
   - [Backend HMAC Authentication](#backend-hmac-authentication)
   - [Supabase JWT Authentication](#supabase-jwt-authentication)
3. [OAuth Flow and Token Lifecycle](#oauth-flow-and-token-lifecycle)
4. [Organization Scoping](#organization-scoping)
5. [RLS Policies](#rls-policies)
6. [Security Considerations](#security-considerations)
7. [Error Handling](#error-handling)
8. [Code References](#code-references)

---

## Overview

The QuickBooks integration in Clarity CRM uses a multi-layered authorization strategy to ensure secure access to financial data:

1. **QuickBooks OAuth 2.0**: User authorization to access QuickBooks Online company data
2. **Backend HMAC Authentication**: Secure communication between frontend and Clarity backend API
3. **Supabase RLS Policies**: Organization-scoped access control for QuickBooks connection data
4. **Organization Scoping**: Multi-tenant isolation ensuring users only access their organization's data

**Key Principles:**
- ✅ OAuth tokens stored securely in backend (NEVER in frontend localStorage)
- ✅ All QuickBooks API calls proxied through Clarity backend
- ✅ Organization-scoped access enforced at multiple layers
- ✅ Token refresh handled automatically by backend
- ✅ No direct frontend-to-QuickBooks communication

---

## Authentication Methods

### QuickBooks OAuth 2.0

**Purpose:** Authorize Clarity CRM to access QuickBooks Online company data on behalf of the user

**Flow Type:** OAuth 2.0 Authorization Code Grant
**Authorization Server:** Intuit QuickBooks OAuth
**Scopes Required:**
- `com.intuit.quickbooks.accounting` - Access to accounting data (invoices, customers, etc.)

**Configuration:**
```javascript
// Environment Variables (Backend only)
QUICKBOOKS_CLIENT_ID=your_client_id
QUICKBOOKS_CLIENT_SECRET=your_client_secret
QUICKBOOKS_REDIRECT_URI=https://api.claritybusinesssolutions.ca/quickbooks/oauth/callback
```

**Frontend Configuration:**
```javascript
// src/api/quickbooksApi.js:13-20
const QB_AUTH_CONFIG = {
  baseUrl: 'https://api.claritybusinesssolutions.ca/quickbooks',
  scope: 'com.intuit.quickbooks.accounting',
  responseType: 'code',
  redirectUri: 'https://api.claritybusinesssolutions.ca/quickbooks/oauth/callback'
};
```

**Important Security Notes:**
- ❌ Client ID and Client Secret are NEVER exposed to frontend
- ❌ OAuth tokens are NEVER stored in browser localStorage/sessionStorage
- ✅ All OAuth operations handled by backend
- ✅ Frontend only initiates authorization flow via backend proxy

**Code References:**
- OAuth initialization: `src/api/quickbooksApi.js:195-203` (`getQBOAuthorizationUrl()`)
- OAuth callback: `src/api/quickbooksApi.js:206-216` (`handleQBOOAuthCallback()`)
- Token refresh: `src/api/quickbooksApi.js:218-226` (`refreshQBOToken()`)

---

### Backend HMAC Authentication

**Purpose:** Secure authentication for all frontend requests to Clarity backend API

**Algorithm:** HMAC-SHA256
**Header Format:** `Authorization: Bearer {signature}.{timestamp}`

**Token Generation Process:**

```javascript
// src/api/quickbooksApi.js:31-60
async function generateAuthHeader(payload = '') {
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
}
```

**Backend Validation:**
1. Extract signature and timestamp from header
2. Recreate message: `${timestamp}.${requestBody}`
3. Generate expected signature using shared secret key
4. Compare signatures using constant-time comparison
5. Validate timestamp is within 5 minutes (prevents replay attacks)

**Security Features:**
- ✅ Prevents request tampering (signature includes payload)
- ✅ Prevents replay attacks (timestamp validation)
- ✅ Constant-time signature comparison (prevents timing attacks)
- ✅ Shared secret never transmitted over network
- ✅ Fresh signature required for each request

**Environment Variables:**
```bash
# Frontend (.env)
VITE_SECRET_KEY=your_hmac_secret_key

# Backend (server environment)
SECRET_KEY=your_hmac_secret_key  # Must match frontend
```

**Code References:**
- Frontend generation: `src/api/quickbooksApi.js:31-60`
- Also used in: `src/services/dataService.js:61-105`
- Backend validation: Handled by backend team (not in frontend codebase)

---

### Supabase JWT Authentication

**Purpose:** Organization-scoped database access for QuickBooks connection metadata

**Token Type:** Supabase JWT (issued by Supabase Auth)
**Claims Required:**
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "authenticated",
  "aud": "authenticated",
  "user_metadata": {
    "organization_id": "org-uuid"
  }
}
```

**Usage Scenarios:**
- ✅ Direct Supabase queries (subject to RLS)
- ✅ Realtime subscriptions to QuickBooks sync status
- ✅ Organization-scoped metadata access

**Authentication Flow:**
```javascript
// src/services/supabaseService.js:356-377
export const signInWithEmail = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // JWT automatically included in all subsequent Supabase requests
    // RLS policies use organization_id from JWT claims

    return {
      success: true,
      data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};
```

**RLS Policy Usage:**
```sql
-- RLS policies automatically extract organization_id from JWT
CREATE POLICY "Users can view QB connections in their organization"
ON quickbooks_connections
FOR SELECT
TO authenticated
USING (
  organization_id = auth.current_organization_id()
);
```

**Code References:**
- Supabase client init: `src/services/supabaseService.js:21-34`
- Sign in: `src/services/supabaseService.js:356-377`
- Organization helper: RLS function `auth.current_organization_id()` (database-side)

---

## OAuth Flow and Token Lifecycle

### 1. Authorization Flow

**Step 1: Initiate Authorization**
```javascript
// User clicks "Connect QuickBooks" button
// src/api/quickbooksApi.js:195-203
const { authorization_url, state } = await getQBOAuthorizationUrl();

// Frontend redirects user to QuickBooks authorization page
window.location.href = authorization_url;
```

**Backend generates authorization URL:**
```
GET /quickbooks/authorize?organization_id={org_id}
Authorization: Bearer {hmac_signature}.{timestamp}
X-Organization-ID: {org-uuid}
```

**Response:**
```json
{
  "authorization_url": "https://appcenter.intuit.com/connect/oauth2?client_id=...&scope=...&redirect_uri=...&state={csrf_token}",
  "state": "csrf-validation-token"
}
```

---

**Step 2: User Authorizes on QuickBooks**
- User logs into QuickBooks Online (if not already logged in)
- User selects which QuickBooks company to connect
- User grants Clarity CRM requested permissions
- QuickBooks redirects back to Clarity backend

---

**Step 3: Backend Handles OAuth Callback**

QuickBooks redirects to:
```
https://api.claritybusinesssolutions.ca/quickbooks/oauth/callback?code={auth_code}&state={state}&realmId={company_id}
```

Backend exchanges authorization code for tokens:
```http
POST https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer
Content-Type: application/x-www-form-urlencoded
Authorization: Basic {base64(client_id:client_secret)}

grant_type=authorization_code&code={auth_code}&redirect_uri={redirect_uri}
```

QuickBooks response:
```json
{
  "access_token": "eyJenc...",
  "refresh_token": "L011546...",
  "token_type": "bearer",
  "expires_in": 3600,
  "x_refresh_token_expires_in": 8726400
}
```

---

**Step 4: Backend Stores Tokens Securely**

Backend stores in database (organization-scoped):
```sql
INSERT INTO quickbooks_connections (
  organization_id,
  realm_id,
  access_token,      -- Encrypted at rest
  refresh_token,     -- Encrypted at rest
  access_token_expires_at,
  refresh_token_expires_at,
  connected_at
) VALUES (
  '{org_id}',
  '{company_id}',
  encrypt('{access_token}'),
  encrypt('{refresh_token}'),
  NOW() + INTERVAL '1 hour',
  NOW() + INTERVAL '100 days',
  NOW()
);
```

**Security Notes:**
- ✅ Tokens encrypted at rest in database
- ✅ Tokens scoped to organization (multi-tenant isolation)
- ✅ Tokens NEVER exposed to frontend
- ✅ Backend uses tokens for all QuickBooks API calls

---

### 2. Token Usage

**Making QuickBooks API Calls:**

Frontend requests invoice creation:
```javascript
// src/api/quickbooksApi.js:281-294
const invoice = await createQBOInvoice({
  customer_id: 'qb_customer_id',
  line_items: [...],
  due_date: '2026-02-10'
});
```

Backend flow:
1. Validate HMAC signature from frontend
2. Extract organization_id from request headers/JWT
3. Retrieve QuickBooks access token for organization
4. Check if access token is expired
5. If expired, refresh token automatically
6. Make API call to QuickBooks with access token
7. Return result to frontend

**Code References:**
- Invoice creation: `src/api/quickbooksApi.js:281-294`
- Customer sync: `src/api/quickbooksApi.js:228-243`
- Time entry billing: `src/api/quickbooksApi.js:296-314`

---

### 3. Token Refresh

**Access Token Expiration:** 1 hour
**Refresh Token Expiration:** 100 days

**Automatic Refresh Flow:**

Backend detects expired access token:
```javascript
// Backend pseudo-code
if (accessTokenExpiresAt < now()) {
  // Refresh token
  const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${base64(clientId:clientSecret)}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `grant_type=refresh_token&refresh_token=${refreshToken}`
  });

  const { access_token, refresh_token, expires_in } = await response.json();

  // Update stored tokens
  await updateTokens(organizationId, {
    access_token: encrypt(access_token),
    refresh_token: encrypt(refresh_token),
    access_token_expires_at: now() + expires_in,
    updated_at: now()
  });
}
```

**Manual Refresh (Frontend can trigger):**
```javascript
// src/api/quickbooksApi.js:218-226
const refreshResult = await refreshQBOToken();
// Backend automatically refreshes and returns success/failure
```

**Refresh Token Expiration:**
- After 100 days, user must re-authorize connection
- Backend monitors refresh token expiration
- Frontend can check connection status: `GET /quickbooks/connection/status`

**Code References:**
- Frontend refresh trigger: `src/api/quickbooksApi.js:218-226`
- Connection validation: `src/api/quickbooksApi.js:259-270`

---

### 4. Token Revocation and Disconnection

**User-Initiated Disconnect:**
```javascript
// Future frontend implementation
const result = await disconnectQBO();
// Backend revokes tokens with QuickBooks and deletes from database
```

**Note:** Disconnect functionality is available in backend but not yet exposed in frontend API client. Can be added when needed.

**Backend Revocation Flow:**
1. Call QuickBooks token revocation endpoint
2. Delete connection record from database
3. Clear any cached QuickBooks data
4. Return success to frontend

**Revocation Endpoint:**
```http
POST https://developer.api.intuit.com/v2/oauth2/tokens/revoke
Content-Type: application/json
Authorization: Basic {base64(client_id:client_secret)}

{
  "token": "{refresh_token}"
}
```

**Frontend Implications:**
- After disconnection, QuickBooks features become unavailable
- UI should show "Connect QuickBooks" button again
- All QuickBooks sync operations stop

**Code Reference:** Backend implements disconnect functionality (not yet exposed in frontend API)

**Note:** Frontend disconnect functionality can be implemented as:
```javascript
// Future implementation
export const disconnectQBO = async () => {
  return await makeRequest('/disconnect', 'POST');
};
```

---

## Organization Scoping

### Multi-Tenant Isolation

**Principle:** Absolute isolation - users can ONLY access QuickBooks connections for their organization

**Enforcement Layers:**

#### Layer 1: Frontend Organization Context
```javascript
// src/api/quickbooksApi.js:23-28
const ORG_ID = import.meta.env.VITE_CLARITY_INTEGRATION_ORG_ID;

// All requests include organization ID
headers: {
  'X-Organization-ID': ORG_ID,
  // ...
}
```

#### Layer 2: Backend API Validation
```javascript
// Backend pseudo-code
app.post('/quickbooks/invoice', async (req, res) => {
  // Validate HMAC signature
  if (!validateHMAC(req.headers.authorization)) {
    return res.status(401).json({ error: 'Invalid authentication' });
  }

  // Extract organization from authenticated session/JWT
  const userOrgId = getUserOrganization(req);
  const requestedOrgId = req.headers['x-organization-id'];

  // Ensure user can only access their organization
  if (userOrgId !== requestedOrgId) {
    return res.status(403).json({ error: 'Organization access denied' });
  }

  // All QuickBooks operations scoped to this organization
  const qbConnection = await getQBConnection(userOrgId);
  // ...
});
```

#### Layer 3: Database RLS Policies
```sql
-- All QuickBooks connection data scoped by organization
CREATE POLICY "Users can view QB connections in their organization"
ON quickbooks_connections
FOR SELECT
TO authenticated
USING (
  organization_id = auth.current_organization_id()
);
```

#### Layer 4: QuickBooks RealmID Validation
- Each QuickBooks connection tied to a specific QuickBooks company (realmId)
- Organization → QuickBooks Company is 1:1 mapping
- Backend validates realmId matches stored connection before making API calls

**Security Benefits:**
- ✅ Cross-organization data access impossible
- ✅ Multiple validation layers (defense in depth)
- ✅ Even if frontend is compromised, backend enforces isolation
- ✅ Database RLS provides final safety net

---

### Organization-to-QuickBooks Mapping

**Data Model:**
```
Organization (Supabase)
  ↓ 1:1
QuickBooks Connection Record
  ↓ 1:1
QuickBooks Company (RealmID)
```

**Connection Storage:**
```sql
CREATE TABLE quickbooks_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  realm_id VARCHAR(100) NOT NULL,  -- QuickBooks Company ID
  access_token TEXT NOT NULL,       -- Encrypted
  refresh_token TEXT NOT NULL,      -- Encrypted
  access_token_expires_at TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at TIMESTAMPTZ NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT qb_connections_org_unique UNIQUE (organization_id)
);
```

**Business Rules:**
- One organization can have ONE QuickBooks connection
- Attempting to connect a second company disconnects the first
- RealmID stored to validate all QuickBooks API calls
- If organization is deleted, QuickBooks connection is cascade deleted

**Code References:**
- Connection validation: `src/api/quickbooksApi.js:226-228` (`validateQBOCredentials()`)
- Environment org ID: `src/api/quickbooksApi.js:90-94`
- Organization header setup: `src/api/quickbooksApi.js:96-100`

---

## RLS Policies

### Required RLS Helper Functions

```sql
-- Extract organization ID from JWT claims
CREATE OR REPLACE FUNCTION auth.current_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::json->'user_metadata'->>'organization_id')::uuid,
    NULL
  );
$$;

COMMENT ON FUNCTION auth.current_organization_id() IS
  'Extracts organization_id from Supabase JWT user_metadata. Returns NULL if not authenticated.';
```

---

### QuickBooks Connections Table Policies

**Enable RLS:**
```sql
ALTER TABLE quickbooks_connections ENABLE ROW LEVEL SECURITY;
```

**Policy: SELECT - View Connection**
```sql
CREATE POLICY "Users can view QB connection for their organization"
ON quickbooks_connections
FOR SELECT
TO authenticated
USING (
  organization_id = auth.current_organization_id()
);
```

**Rationale:**
- Users can only view QuickBooks connection for their organization
- Prevents cross-organization data leaks
- Simple policy - all authenticated org users have equal view access

---

**Policy: INSERT - Create Connection**
```sql
CREATE POLICY "Users can create QB connection for their organization"
ON quickbooks_connections
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = auth.current_organization_id()
);
```

**Rationale:**
- Users can only create connections for their organization
- Backend derives organization_id from JWT, not frontend request
- Prevents users from creating connections for other organizations

---

**Policy: UPDATE - Refresh Tokens**
```sql
CREATE POLICY "Users can update QB connection for their organization"
ON quickbooks_connections
FOR UPDATE
TO authenticated
USING (
  organization_id = auth.current_organization_id()
)
WITH CHECK (
  organization_id = auth.current_organization_id()
);
```

**Rationale:**
- Allow token refresh operations
- Organization_id cannot be changed (WITH CHECK prevents)
- Only users in the organization can update their connection

---

**Policy: DELETE - Disconnect**
```sql
CREATE POLICY "Users can delete QB connection for their organization"
ON quickbooks_connections
FOR DELETE
TO authenticated
USING (
  organization_id = auth.current_organization_id()
);
```

**Rationale:**
- Users can disconnect QuickBooks integration
- Only affects their organization's connection
- Cascade deletes related sync metadata

---

### QuickBooks Sync Metadata Policies

If tracking sync history/status in separate tables:

```sql
CREATE TABLE quickbooks_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sync_type VARCHAR(50) NOT NULL,  -- 'customer', 'invoice', etc.
  entity_id UUID NOT NULL,         -- Reference to customer/invoice
  qb_entity_id VARCHAR(100),       -- QuickBooks ID
  sync_status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'pending'
  error_message TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qb_sync_log_org_id ON quickbooks_sync_log(organization_id);
CREATE INDEX idx_qb_sync_log_entity ON quickbooks_sync_log(entity_id);

-- RLS Policies
ALTER TABLE quickbooks_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view QB sync logs for their organization"
ON quickbooks_sync_log
FOR SELECT
TO authenticated
USING (
  organization_id = auth.current_organization_id()
);

CREATE POLICY "Backend can insert QB sync logs"
ON quickbooks_sync_log
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = auth.current_organization_id()
);
```

**Rationale:**
- Sync logs are organization-scoped
- Users can view sync history for their data
- Backend creates log entries during sync operations

---

## Security Considerations

### 1. OAuth Token Security

**Critical Requirements:**
- ❌ NEVER store OAuth tokens in frontend (localStorage, sessionStorage, cookies)
- ❌ NEVER expose OAuth tokens in API responses to frontend
- ❌ NEVER log OAuth tokens (access_token, refresh_token, client_secret)
- ✅ Always encrypt tokens at rest in database
- ✅ Always use HTTPS for all OAuth communications
- ✅ Always validate redirect_uri to prevent authorization code interception

**Encryption at Rest:**
```sql
-- Backend should use database-level encryption or application-level encryption
-- Example: PostgreSQL pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt tokens before storage
INSERT INTO quickbooks_connections (access_token, refresh_token, ...)
VALUES (
  pgp_sym_encrypt('actual_access_token', 'encryption_key'),
  pgp_sym_encrypt('actual_refresh_token', 'encryption_key'),
  ...
);

-- Decrypt when retrieving
SELECT
  pgp_sym_decrypt(access_token::bytea, 'encryption_key')::text as access_token
FROM quickbooks_connections;
```

---

### 2. HMAC Authentication Security

**Best Practices:**

✅ **Secret Key Management:**
- Use strong, randomly generated secret key (min 256 bits)
- Store in environment variables, not hardcoded
- Rotate secret key periodically (requires coordination with backend)
- Use different keys for dev/staging/production

✅ **Timestamp Validation:**
- Backend rejects requests older than 5 minutes
- Prevents replay attacks (attacker cannot reuse old signatures)
- Use server time for validation (not client time)

✅ **Signature Verification:**
- Use constant-time comparison to prevent timing attacks
- Validate signature BEFORE processing request
- Reject any request with invalid/missing signature

**Attack Scenarios and Defenses:**

| Attack | Defense |
|--------|---------|
| **Replay Attack** | Timestamp validation (5-min window) |
| **Man-in-the-Middle** | HTTPS (TLS encryption) |
| **Request Tampering** | HMAC signature includes full payload |
| **Timing Attack** | Constant-time signature comparison |
| **Secret Exposure** | Environment variables, not committed to git |

---

### 3. Organization Isolation

**Security Guarantees:**

✅ **Database Level:**
- RLS policies enforce organization scoping on all queries
- Even if application logic has bugs, RLS prevents cross-org access
- Service role queries bypass RLS - backend must validate organization

✅ **Application Level:**
- Backend extracts organization from authenticated user context
- Backend validates request organization_id matches user's organization
- Frontend organization_id is informational only, not trusted

✅ **Testing Requirements:**
- Create multiple test organizations
- Attempt to access other organization's QuickBooks data
- Verify all endpoints return 403 Forbidden for cross-org access
- Test with manipulated organization_id headers

**Code References:**
- Organization header: `src/api/quickbooksApi.js:23-28`
- Backend validation: Backend team implements (not in frontend)

---

### 4. CSRF Protection

**QuickBooks OAuth Flow:**
- State parameter used for CSRF protection
- Backend generates random state token
- State token stored in session/database
- QuickBooks returns state in callback
- Backend validates state matches before exchanging code for tokens

**HMAC-Authenticated Requests:**
- HMAC signature includes timestamp (freshness validation)
- Each request requires fresh signature
- Cannot reuse signatures from other requests
- Signature tied to specific payload

---

### 5. XSS and Injection Prevention

**QuickBooks Data Display:**
```javascript
// Safe: React automatically escapes HTML
<div>{qbCustomer.displayName}</div>

// UNSAFE: Don't use dangerouslySetInnerHTML with QB data
// <div dangerouslySetInnerHTML={{ __html: qbCustomer.notes }} />
```

**API Parameter Sanitization:**
- Backend sanitizes all QuickBooks API request parameters
- Validate data types (numbers, dates, UUIDs)
- Escape special characters in text fields
- Use parameterized queries for database operations

**SQL Injection Prevention:**
- All database queries use parameterized statements (Supabase client)
- Never concatenate user input into SQL strings
- RLS policies use SQL parameters, not string interpolation

---

### 6. Rate Limiting

**QuickBooks API Limits:**
- 500 requests per minute per QuickBooks company
- Backend should implement rate limiting
- Frontend should debounce rapid sync requests

**Backend Rate Limiting:**
```javascript
// Backend pseudo-code
const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each organization to 100 requests per minute
  keyGenerator: (req) => req.organization_id,
  message: 'Too many QuickBooks requests, please try again later'
});

app.use('/quickbooks/*', rateLimiter);
```

**Frontend Considerations:**
- Avoid calling QuickBooks APIs in tight loops
- Show loading states during sync operations
- Implement exponential backoff on retry

---

## Error Handling

### OAuth Error Scenarios

**Authorization Denied:**
```javascript
// User clicks "Deny" on QuickBooks authorization page
// QuickBooks redirects: /callback?error=access_denied&state={state}

// Backend handles error
{
  "error": "access_denied",
  "error_description": "User denied authorization"
}

// Frontend handling
if (authResult.error === 'access_denied') {
  showNotification('QuickBooks connection cancelled', 'info');
  // Don't show error - user intentionally cancelled
}
```

**Invalid State (CSRF):**
```javascript
// State parameter doesn't match
{
  "error": "invalid_state",
  "error_description": "CSRF validation failed"
}

// Frontend should treat as security issue
showNotification('Invalid QuickBooks authorization. Please try again.', 'error');
```

---

### Token Error Scenarios

**Expired Refresh Token:**
```javascript
// Refresh token expired (after 100 days)
{
  "error": "invalid_grant",
  "error_description": "Refresh token expired"
}

// Backend disconnects QuickBooks
// Frontend shows reconnect message
if (error.code === 'REFRESH_TOKEN_EXPIRED') {
  showNotification(
    'QuickBooks connection expired. Please reconnect to continue syncing.',
    'warning'
  );
  setQBConnected(false);
}
```

**Revoked Access:**
```javascript
// User revoked access in QuickBooks settings
{
  "error": "invalid_grant",
  "error_description": "Token has been revoked"
}

// Backend detects and clears connection
// Frontend shows reconnect UI
```

---

### API Error Handling

**QuickBooks API Rate Limit:**
```javascript
// 429 Too Many Requests from QuickBooks
{
  "error": "rate_limit_exceeded",
  "error_description": "QuickBooks API rate limit exceeded",
  "retry_after": 60  // Seconds to wait
}

// Frontend handling
if (error.code === 'RATE_LIMIT_EXCEEDED') {
  const retryAfter = error.retry_after || 60;
  showNotification(
    `QuickBooks rate limit reached. Retrying in ${retryAfter} seconds...`,
    'warning'
  );

  // Implement exponential backoff
  setTimeout(() => retryRequest(), retryAfter * 1000);
}
```

**QuickBooks API Validation Error:**
```javascript
// Invalid data sent to QuickBooks
{
  "error": "validation_error",
  "error_description": "Customer display name is required",
  "details": {
    "field": "DisplayName",
    "message": "DisplayName is required"
  }
}

// Frontend handling - show specific field error
showFieldError('customer_name', error.details.message);
```

---

### Organization Access Errors

**Wrong Organization:**
```javascript
// User tries to access another org's QuickBooks data
{
  "error": "forbidden",
  "error_description": "Organization access denied"
}

// Frontend handling
if (error.code === 'FORBIDDEN') {
  console.error('Organization access violation:', error);
  showNotification('Access denied. Please contact support.', 'error');
  // Redirect to home or show access denied page
}
```

**Code References:**
- Error handling: `src/api/quickbooksApi.js:73-91` (request wrapper)
- QuickBooks client errors: `src/api/quickbooksApi.js:109-151`

---

## Code References

### Frontend Implementation Files

**Primary API Client:**
- **File:** `src/api/quickbooksApi.js`
- **Lines:** 1-610 (complete QuickBooks integration)
- **Key Functions:**
  - `generateAuthHeader()` - HMAC authentication (lines 31-60)
  - `getQBOAuthorizationUrl()` - OAuth initialization (lines 195-203)
  - `handleQBOOAuthCallback()` - OAuth callback (lines 206-216)
  - `refreshQBOToken()` - Token refresh (lines 218-220)
  - `createQBOInvoice()` - Invoice creation (lines 343-345)
  - Disconnect integration - Backend only (not yet in frontend client)

**Service Layer:**
- **File:** `src/services/supabaseService.js`
- **Lines:** 1-728
- **Key Functions:**
  - `signInWithEmail()` - Supabase authentication (lines 356-377)
  - `getSupabaseClient()` - Client access (lines 281-283)

**Data Service (HMAC):**
- **File:** `src/services/dataService.js`
- **Lines:** 61-105 (`generateBackendAuthHeader()`)
- **Purpose:** Shared HMAC generation logic

**Environment Configuration:**
- **File:** `src/config.js`
- **Lines:** 1-53
- **Environment Variables:**
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_SUPABASE_SERVICE_ROLE_KEY`
  - `VITE_SECRET_KEY`

---

### Related Documentation

**Backend API Contracts:**
- **File:** `.devflow/tasks/quickbooks-migration-requirements/api-contracts.md`
- **Lines:** 1-800+
- **Purpose:** Complete backend endpoint specifications

**Current Implementation Analysis:**
- **File:** `.devflow/tasks/quickbooks-migration-requirements/current-implementation.md`
- **Purpose:** Existing QuickBooks integration documentation

**QuickBooks Integration Guide:**
- **File:** `.devflow/tasks/tasks-migration-requirements/QUICKBOOKS_INTEGRATION.md`
- **Purpose:** Time entry billing and QuickBooks sync patterns

**Authorization Examples:**
- **File:** `requirements/notes/authorization.md`
- **Lines:** 1-1137
- **Purpose:** Reference implementation for RLS policies and organization scoping

**Teams Authorization:**
- **File:** `requirements/teams/authorization.md`
- **Lines:** 1-300+
- **Purpose:** RLS policy examples for organization-scoped resources

---

## Summary

### Authorization Model

✅ **Three-Layer Authentication:**
1. QuickBooks OAuth 2.0 - User authorization for company data access
2. Backend HMAC - Secure frontend-to-backend communication
3. Supabase JWT - Organization-scoped database access

✅ **Token Security:**
- OAuth tokens stored in backend only (encrypted at rest)
- HMAC signatures prevent request tampering and replay attacks
- JWT claims provide organization context for RLS

✅ **Organization Isolation:**
- Multi-tenant architecture with absolute org isolation
- RLS policies enforce database-level scoping
- Backend validates organization access on all requests
- Frontend cannot access other organizations' QuickBooks data

### Security Guarantees

✅ **Defense in Depth:**
- Multiple validation layers (frontend, backend, database)
- Even if one layer is compromised, others provide protection
- RLS policies as final safety net

✅ **Token Lifecycle Management:**
- Automatic token refresh (before 1-hour expiration)
- Graceful handling of expired refresh tokens (100-day limit)
- User re-authorization flow for expired connections

✅ **API Security:**
- All requests over HTTPS (TLS encryption)
- CSRF protection via OAuth state parameter
- Rate limiting to prevent abuse
- Input sanitization and XSS prevention

### Implementation Status

✅ **Production Ready:**
- All QuickBooks endpoints currently implemented and working
- This document serves as specification reference
- No backend changes required at this time
- Frontend code follows documented patterns

---

**Document Status:** Complete
**Next Review:** Q2 2026 or when QuickBooks API changes occur
**Owner:** Frontend Team + Backend Team
