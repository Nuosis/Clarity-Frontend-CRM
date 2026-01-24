# HMAC Authentication Architecture Diagram

## Secure Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER AUTHENTICATION                          │
└─────────────────────────────────────────────────────────────────────┘

User enters credentials
        ↓
┌───────────────────┐
│  SignIn Component │  → Supabase Auth (email/password)
└───────────────────┘
        ↓
┌───────────────────┐
│  Supabase Auth    │  → Returns JWT access token
│  Session Created  │     (contains user_id, org_id, claims)
└───────────────────┘
        ↓
┌───────────────────┐
│  AppStateContext  │  → Stores authentication state
│  JWT Token Saved  │     (auto-refresh enabled)
└───────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                      API REQUEST FLOW (SECURE)                       │
└─────────────────────────────────────────────────────────────────────┘

Component makes API call
        ↓
┌───────────────────────────┐
│  dataService.get/post()   │  → Axios client with interceptor
└───────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    REQUEST INTERCEPTOR                               │
│  (src/services/dataService.js:151-189)                              │
├─────────────────────────────────────────────────────────────────────┤
│  1. Get Supabase JWT from session                                   │
│  2. Call generateBackendAuthHeader(payload)                         │
│  3. Add Authorization header                                        │
│  4. Add X-Organization-ID header                                    │
└─────────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────────┐
│              BACKEND TOKEN GENERATION (SECURE)                       │
│  (src/services/dataService.js:89-136)                               │
├─────────────────────────────────────────────────────────────────────┤
│  Frontend Request:                                                   │
│    POST /auth/generate-token                                        │
│    Headers:                                                          │
│      Authorization: Bearer {supabase_jwt}                           │
│    Body:                                                             │
│      { payload: "...", organization_id: "..." }                     │
├─────────────────────────────────────────────────────────────────────┤
│  Backend Processing:                                                 │
│    1. Validate JWT signature                                        │
│    2. Extract user claims (user_id, org_id)                         │
│    3. Verify organization access                                    │
│    4. Generate HMAC signature:                                      │
│       message = timestamp + "." + payload                           │
│       signature = HMAC-SHA256(message, SECRET_KEY) ← SERVER SIDE    │
│    5. Return signed token                                           │
├─────────────────────────────────────────────────────────────────────┤
│  Backend Response:                                                   │
│    {                                                                 │
│      token: "{signature}.{timestamp}",                              │
│      expires_in: 300                                                │
│    }                                                                 │
└─────────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    API REQUEST WITH SIGNED TOKEN                     │
├─────────────────────────────────────────────────────────────────────┤
│  GET/POST/PATCH/DELETE https://api.claritybusinesssolutions.ca      │
│  Headers:                                                            │
│    Authorization: Bearer {signature}.{timestamp}                    │
│    X-Organization-ID: {organization_uuid}                           │
│    Content-Type: application/json                                   │
│  Body: { ... }                                                       │
└─────────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────────┐
│              BACKEND API VALIDATION                                  │
├─────────────────────────────────────────────────────────────────────┤
│  1. Extract signature and timestamp from header                     │
│  2. Check timestamp freshness (< 5 minutes)                         │
│  3. Reconstruct message: timestamp + "." + request_body             │
│  4. Compute expected signature: HMAC-SHA256(message, SECRET_KEY)    │
│  5. Compare signatures (constant-time comparison)                   │
│  6. Validate organization_id matches user context                   │
│  7. Process request if valid, reject if invalid                     │
└─────────────────────────────────────────────────────────────────────┘
        ↓
┌───────────────────┐
│  API Response     │  → Returns data to frontend
│  200 OK / Error   │
└───────────────────┘
        ↓
┌───────────────────┐
│  Component        │  → Updates UI with response data
│  State Updated    │
└───────────────────┘
```

## Security Boundaries

```
┌────────────────────────────────────────────────────────────────────┐
│                         CLIENT SIDE (BROWSER)                       │
│                                                                     │
│  ✅ Has Access To:                                                 │
│    - Supabase JWT access token (session-based)                    │
│    - Pre-signed HMAC tokens (time-limited)                        │
│    - User organization ID                                          │
│    - Public API URLs                                               │
│                                                                     │
│  ❌ NO ACCESS To:                                                  │
│    - VITE_SECRET_KEY (HMAC secret)                                │
│    - HMAC signing algorithm/implementation                         │
│    - Service role keys                                             │
│    - Other users' data (RLS enforced)                             │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
                                ↕
            HTTPS (TLS 1.2+, Certificate Pinning)
                                ↕
┌────────────────────────────────────────────────────────────────────┐
│                       SERVER SIDE (BACKEND)                         │
│                                                                     │
│  🔒 Has Access To:                                                 │
│    - VITE_SECRET_KEY (HMAC secret) ← NEVER LEAVES SERVER          │
│    - HMAC-SHA256 signing implementation                            │
│    - JWT validation (Supabase public key)                         │
│    - User session management                                       │
│    - Organization access control                                   │
│    - Database (Supabase with RLS)                                 │
│                                                                     │
│  🛡️ Security Measures:                                            │
│    - Timestamp validation (5-minute window)                        │
│    - Constant-time signature comparison                            │
│    - Organization scope enforcement                                │
│    - Rate limiting                                                  │
│    - Request logging and monitoring                                │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

## Token Caching Strategy

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TOKEN CACHE (FRONTEND)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Empty Payload Tokens (GET requests):                               │
│  ┌──────────────────────────────────────────┐                      │
│  │  Cache Key: "empty"                      │                      │
│  │  Token: "signature.timestamp"            │                      │
│  │  Expires: timestamp + 270 seconds        │  ← 4.5 min TTL       │
│  │  (30 second safety margin)               │                      │
│  └──────────────────────────────────────────┘                      │
│                                                                      │
│  Non-Empty Payload Tokens (POST/PUT/PATCH):                        │
│  ┌──────────────────────────────────────────┐                      │
│  │  NOT CACHED                              │  ← Fresh token each  │
│  │  Generated per request                   │     request          │
│  └──────────────────────────────────────────┘                      │
│                                                                      │
│  Why Cache Empty Payloads?                                          │
│  - GET requests have no body (empty payload)                       │
│  - Same signature works for all GET requests                       │
│  - Reduces backend /auth/generate-token calls                      │
│  - Improves performance (no extra round trip)                      │
│                                                                      │
│  Why NOT Cache Non-Empty Payloads?                                 │
│  - POST/PUT/PATCH payloads vary per request                        │
│  - Signature must match exact payload                              │
│  - Caching would require storing many tokens                       │
│  - Better to generate fresh token each time                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## HMAC Signature Anatomy

```
┌─────────────────────────────────────────────────────────────────────┐
│                    HMAC TOKEN STRUCTURE                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Authorization: Bearer {signature}.{timestamp}                      │
│                        ─────────── ─────────                        │
│                            │           │                            │
│                            │           └─> Unix timestamp (seconds) │
│                            │               Example: 1737664800      │
│                            │                                         │
│                            └─────────────> HMAC-SHA256 signature    │
│                                            64 hex characters         │
│                                            Example: 79d24ce7...      │
│                                                                      │
│  Signature Generation (SERVER-SIDE ONLY):                           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Input:                                                       │  │
│  │    timestamp = 1737664800                                    │  │
│  │    payload = '{"name":"Test"}'  (empty string for GET)      │  │
│  │    secret_key = "QArxVv0J1xg..." (from env var)             │  │
│  │                                                               │  │
│  │  Process:                                                     │  │
│  │    message = "1737664800.{\"name\":\"Test\"}"               │  │
│  │    signature = HMAC_SHA256(message, secret_key)             │  │
│  │    token = signature + "." + timestamp                       │  │
│  │                                                               │  │
│  │  Output:                                                      │  │
│  │    "79d24ce74c40e3ece50ea60b85aea99c...1737664800"          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Signature Validation (BACKEND):                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  1. Parse token: split by "."                                │  │
│  │  2. Extract signature and timestamp                          │  │
│  │  3. Check timestamp is recent (now - timestamp < 300)       │  │
│  │  4. Reconstruct message: timestamp + "." + request_body     │  │
│  │  5. Compute expected: HMAC_SHA256(message, secret_key)      │  │
│  │  6. Compare expected == signature (constant-time)           │  │
│  │  7. Reject if: timestamp too old OR signatures don't match  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Request Examples

### Example 1: GET Request (Cached Token)

```
Timeline:
─────────────────────────────────────────────────────────────────────

T=0ms    Component calls: dataService.get('/customers')
         ↓
T=1ms    Interceptor checks cache for empty payload token
         ↓
T=2ms    Cache HIT → Use cached token (no backend call needed)
         ↓
T=3ms    Make GET request with cached token:
         ┌─────────────────────────────────────────────────┐
         │ GET /customers                                   │
         │ Authorization: Bearer {cached_signature}.{ts}   │
         │ X-Organization-ID: 9816c057-b5d3-...           │
         └─────────────────────────────────────────────────┘
         ↓
T=50ms   Backend validates token, returns data
         ↓
T=51ms   Component receives response

Total: 51ms (no token generation overhead)
```

### Example 2: POST Request (Fresh Token)

```
Timeline:
─────────────────────────────────────────────────────────────────────

T=0ms    Component calls: dataService.post('/customers', data)
         ↓
T=1ms    Interceptor detects non-empty payload
         ↓
T=2ms    Call /auth/generate-token with payload:
         ┌─────────────────────────────────────────────────┐
         │ POST /auth/generate-token                       │
         │ Authorization: Bearer {supabase_jwt}            │
         │ Body: {                                         │
         │   payload: '{"name":"Acme Corp"}',             │
         │   organization_id: "9816c057-..."              │
         │ }                                               │
         └─────────────────────────────────────────────────┘
         ↓
T=50ms   Backend generates fresh HMAC token, returns it
         ↓
T=51ms   Make POST request with fresh token:
         ┌─────────────────────────────────────────────────┐
         │ POST /customers                                 │
         │ Authorization: Bearer {fresh_signature}.{ts}   │
         │ X-Organization-ID: 9816c057-b5d3-...           │
         │ Body: {"name":"Acme Corp"}                     │
         └─────────────────────────────────────────────────┘
         ↓
T=100ms  Backend validates token (signature matches payload)
         ↓
T=120ms  Backend creates customer, returns response
         ↓
T=121ms  Component receives response

Total: 121ms (includes token generation overhead ~50ms)
```

## Security Attack Scenarios

### ❌ Attack 1: Replay Attack (BLOCKED)

```
Attacker captures valid request:
  Authorization: Bearer abc123.1737664800
  X-Organization-ID: 9816c057-...

Attacker replays request 10 minutes later:
  ↓
Backend checks timestamp: 1737664800
Current time: 1737665400
Difference: 600 seconds > 300 seconds limit
  ↓
❌ REJECTED: Token expired (timestamp too old)
```

### ❌ Attack 2: Payload Tampering (BLOCKED)

```
Attacker intercepts request:
  Authorization: Bearer abc123.1737664800
  Body: {"amount": 100}

Attacker modifies payload:
  Body: {"amount": 9999}
  (keeps same Authorization header)
  ↓
Backend reconstructs message:
  "1737664800.{\"amount\":9999}"

Backend computes expected signature:
  HMAC_SHA256("1737664800.{\"amount\":9999}", SECRET_KEY)
  = "xyz789" (different from "abc123")
  ↓
❌ REJECTED: Signature mismatch (payload modified)
```

### ❌ Attack 3: Organization Spoofing (BLOCKED)

```
Attacker has valid token for org A:
  Authorization: Bearer valid_token_for_org_a.timestamp
  X-Organization-ID: org-a-uuid

Attacker changes org header:
  X-Organization-ID: org-b-uuid
  (tries to access org B data)
  ↓
Backend validates HMAC token ✓ (token itself is valid)
Backend checks JWT claims:
  User belongs to: org-a-uuid
  Request claims: org-b-uuid
  Mismatch detected
  ↓
❌ REJECTED: Organization mismatch (unauthorized access)
```

### ❌ Attack 4: Token Forgery (BLOCKED - SECRET REQUIRED)

```
Attacker wants to create fake token:
  1. Gets timestamp: 1737664800
  2. Crafts payload: '{"admin":true}'
  3. Needs to compute: HMAC_SHA256("1737664800.{...}", ???)

Problem: Attacker doesn't have SECRET_KEY
  ↓
Attacker tries to guess or brute-force secret:
  - Secret is 256-bit (32 bytes)
  - Brute force: 2^256 possibilities
  - Even at 1 billion attempts/second: 10^60 years
  ↓
❌ BLOCKED: Cannot forge signature without secret key
```

## Component Integration

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND COMPONENT USAGE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ❌ WRONG - Manual authentication:                                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  const response = await fetch('/api/customers', {            │  │
│  │    headers: {                                                 │  │
│  │      Authorization: 'Bearer ...' // Manual, error-prone      │  │
│  │    }                                                          │  │
│  │  });                                                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ✅ CORRECT - Use dataService (automatic authentication):          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  import { dataService } from 'services/dataService';         │  │
│  │                                                               │  │
│  │  // GET request                                              │  │
│  │  const customers = await dataService.get('/customers');     │  │
│  │                                                               │  │
│  │  // POST request                                             │  │
│  │  const newCustomer = await dataService.post('/customers', { │  │
│  │    name: 'Acme Corp',                                        │  │
│  │    email: 'contact@acme.com'                                 │  │
│  │  });                                                          │  │
│  │                                                               │  │
│  │  // Axios interceptor handles:                               │  │
│  │  //   ✓ Token generation                                     │  │
│  │  //   ✓ Authorization header                                 │  │
│  │  //   ✓ Organization header                                  │  │
│  │  //   ✓ Error handling                                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

**Architecture Version**: 2.0 (Server-side HMAC signing)
**Last Updated**: 2026-01-23
**Security Status**: ✅ SECURE
