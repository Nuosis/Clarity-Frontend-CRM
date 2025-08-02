# Frontend Authentication Comprehensive Guide
**Complete Authentication Reference for Clarity Business Solutions**

## Executive Summary

This comprehensive guide covers all authentication methods for the Clarity Business Solutions ecosystem. The system supports two distinct authentication pathways, each designed for specific use cases:

1. **User Authentication** - Kong Gateway + Supabase for user sessions and frontend applications
2. **M2M (Machine-to-Machine) Authentication** - HMAC-SHA256 signature-based authentication for backend service integration

Based on systematic investigation and resolution of authentication issues, this document provides critical guidance for frontend teams integrating with the Clarity Business Solutions API. The M2M authentication system uses HMAC-SHA256 signature validation that requires **exact payload matching** between token generation and API requests.

## Authentication Architecture Overview

### Two-Pathway System

#### 1. User Authentication (Frontend Applications)
- **Purpose**: User registration, login, session management for web applications
- **Method**: Kong Gateway + Supabase Auth
- **Gateway**: Kong Gateway exposes Supabase auth endpoints via `localhost:8000` / `supabase.claritybusinesssolutions.ca`
- **Use Cases**: User login, session management, frontend application access
- **Verification**:
  - Availability: Test Supabase client connection in your app
  - Access: Implement auth flows and verify token handling

#### 2. M2M Authentication (Backend Services)
- **Purpose**: Backend service access to `/api` endpoints and QuickBooks integration
- **Method**: HMAC-SHA256 signature-based authentication
- **Token Format**: `Bearer {signature}.{timestamp}`
- **Critical Requirement**: Payload content must match exactly between token generation and API request
- **Use Cases**: API integrations, service-to-service communication, QuickBooks operations
- **Verification**:
  - Availability: `GET https://api.claritybusinesssolutions.ca/health`
  - Access: `POST https://api.claritybusinesssolutions.ca/health` (requires auth)

### Key Components (M2M Authentication)
1. **Signature Generation**: `HMAC-SHA256(secret_key, "{timestamp}.{payload}")`
2. **Token Validation**: Server recreates signature using same method and compares
3. **Organization Context**: All QuickBooks operations require `X-Organization-ID` header

## Configuration

### User Authentication Setup
```env
# For direct Supabase connection
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# For local development via Kong Gateway
VITE_API_BASE_URL=http://localhost:8000
```

**Dependencies:**
```bash
npm install @supabase/supabase-js
```

### M2M Authentication Setup
```env
SECRET_KEY=your-secret-key-here
```

**Dependencies:**
```bash
npm install crypto-js  # For frontend JavaScript
# or use built-in crypto module for Node.js
```

## Critical Authentication Rules (M2M)

### 🚨 **RULE #1: Payload Matching is MANDATORY**

The most critical aspect of our M2M authentication system is that the payload used to generate the token **MUST EXACTLY MATCH** the payload sent in the API request.

**❌ WRONG - Will cause 401 errors:**
```javascript
// Token generated with empty payload
const token = generateToken('', timestamp);

// But request sent with JSON payload
fetch('/api/quickbooks/validate', {
  method: 'POST',
  headers: { 'Authorization': token },
  body: JSON.stringify({}) // ← Mismatch!
});
```

**✅ CORRECT:**
```javascript
// Token generated with exact payload
const payload = JSON.stringify({});
const token = generateToken(payload, timestamp);

// Request sent with same payload
fetch('/api/quickbooks/validate', {
  method: 'POST',
  headers: { 'Authorization': token },
  body: payload // ← Exact match!
});
```

### 🚨 **RULE #2: Request Type Determines Token Generation**

**For GET Requests (no body):**
```javascript
const token = generateToken('', timestamp); // Empty payload
```

**For POST/PUT/PATCH Requests (with body):**
```javascript
const payload = JSON.stringify(requestData);
const token = generateToken(payload, timestamp);
```

### 🚨 **RULE #3: Organization ID Required for QuickBooks**

All QuickBooks endpoints require the `X-Organization-ID` header:

```javascript
headers: {
  'Authorization': `Bearer ${signature}.${timestamp}`,
  'X-Organization-ID': organizationId,
  'Content-Type': 'application/json'
}
```

## Implementation Examples

### User Authentication (Frontend)

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password'
})

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
})

// Get current user
const { data: { user } } = await supabase.auth.getUser()

// Sign out
const { error } = await supabase.auth.signOut()
```

### M2M Authentication Implementation

#### JavaScript/Frontend Implementation

```javascript
import CryptoJS from 'crypto-js';

function generateAuthToken(payload = '', secretKey) {
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${timestamp}.${payload}`;
  const signature = CryptoJS.HmacSHA256(message, secretKey).toString();
  return `Bearer ${signature}.${timestamp}`;
}

class ClarityAPIClient {
  constructor(secretKey, organizationId) {
    this.secretKey = secretKey;
    this.organizationId = organizationId;
    this.baseURL = 'https://api.claritybusinesssolutions.ca';
  }

  async makeRequest(endpoint, options = {}) {
    const { method = 'GET', data = null } = options;
    
    // Determine payload based on request type
    const payload = (method !== 'GET' && data) ? JSON.stringify(data) : '';
    
    // Generate token with exact payload
    const token = this.generateAuthToken(payload);
    
    const headers = {
      'Authorization': token,
      'Content-Type': 'application/json',
    };

    // Add organization ID for QuickBooks endpoints
    if (endpoint.includes('/quickbooks/')) {
      headers['X-Organization-ID'] = this.organizationId;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method,
      headers,
      body: payload || undefined
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  generateAuthToken(payload) {
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `${timestamp}.${payload}`;
    const signature = CryptoJS.HmacSHA256(message, this.secretKey).toString();
    return `Bearer ${signature}.${timestamp}`;
  }
}
```

#### Node.js Implementation

```javascript
const crypto = require('crypto')

class ClarityAPIClient {
  constructor(secretKey, organizationId) {
    this.secretKey = secretKey
    this.organizationId = organizationId
    this.baseUrl = 'https://api.claritybusinesssolutions.ca'
  }

  generateAuthHeader(payload = '') {
    const timestamp = Math.floor(Date.now() / 1000)
    const message = `${timestamp}.${payload}`
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(message)
      .digest('hex')
    
    return `Bearer ${signature}.${timestamp}`
  }

  async callAPI(endpoint, method = 'GET', data = null) {
    const payload = data ? JSON.stringify(data) : ''
    const authHeader = this.generateAuthHeader(payload)
    
    const headers = {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    }

    // Add organization ID for QuickBooks endpoints
    if (endpoint.includes('/quickbooks/')) {
      headers['X-Organization-ID'] = this.organizationId
    }
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers,
      body: payload || undefined
    })
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }
    
    return response.json()
  }
}

// Usage
const client = new ClarityAPIClient(process.env.SECRET_KEY, process.env.ORGANIZATION_ID)
const result = await client.callAPI('/health', 'POST')
```

#### Python Implementation

```python
import hmac
import hashlib
import time
import requests
import json
import os

class ClarityAPIClient:
    def __init__(self, secret_key, organization_id=None):
        self.secret_key = secret_key
        self.organization_id = organization_id
        self.base_url = 'https://api.claritybusinesssolutions.ca'
    
    def generate_auth_header(self, payload=''):
        timestamp = str(int(time.time()))
        message = f"{timestamp}.{payload}"
        signature = hmac.new(
            self.secret_key.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        return f"Bearer {signature}.{timestamp}"
    
    def call_api(self, endpoint, method='GET', data=None):
        payload = json.dumps(data) if data else ''
        auth_header = self.generate_auth_header(payload)
        
        headers = {
            'Authorization': auth_header,
            'Content-Type': 'application/json'
        }

        # Add organization ID for QuickBooks endpoints
        if '/quickbooks/' in endpoint and self.organization_id:
            headers['X-Organization-ID'] = self.organization_id
        
        response = requests.request(
            method,
            f"{self.base_url}{endpoint}",
            headers=headers,
            data=payload if payload else None
        )
        
        if not response.ok:
            raise Exception(f"API Error: {response.status_code} {response.text}")
        
        return response.json()

# Usage
client = ClarityAPIClient(os.getenv('SECRET_KEY'), os.getenv('ORGANIZATION_ID'))
result = client.call_api('/health', 'POST')
```

### Usage Examples

#### User Authentication
```javascript
// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey)

// User registration flow
const handleSignUp = async (email, password) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  })
  
  if (error) {
    console.error('Sign up error:', error.message)
    return
  }
  
  console.log('User created:', data.user)
}

// User login flow
const handleSignIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  
  if (error) {
    console.error('Sign in error:', error.message)
    return
  }
  
  console.log('User signed in:', data.user)
}
```

#### M2M Authentication
```javascript
const client = new ClarityAPIClient(secretKey, organizationId);

// GET request (no payload)
const customers = await client.makeRequest('/quickbooks/customers');

// POST request (with payload)
const validation = await client.makeRequest('/quickbooks/validate', {
  method: 'POST',
  data: {} // Empty object, but still needs to match token generation
});

// POST request with data
const newCustomer = await client.makeRequest('/quickbooks/customers', {
  method: 'POST',
  data: { name: 'John Doe', email: 'john@example.com' }
});
```

## Common Pitfalls and Solutions

### ❌ Pitfall 1: Inconsistent JSON Serialization
```javascript
// Different serialization can cause signature mismatch
const data = { name: 'John', age: 30 };
const token = generateToken(JSON.stringify(data, null, 2)); // With formatting
fetch(url, { body: JSON.stringify(data) }); // Without formatting
```

**✅ Solution:** Use the same serialization method consistently:
```javascript
const payload = JSON.stringify(data); // Same method for both
const token = generateToken(payload);
fetch(url, { body: payload });
```

### ❌ Pitfall 2: Forgetting Organization ID
```javascript
// Will fail for QuickBooks endpoints
fetch('/quickbooks/customers', {
  headers: { 'Authorization': token }
  // Missing X-Organization-ID
});
```

**✅ Solution:** Always include organization ID for QuickBooks:
```javascript
fetch('/quickbooks/customers', {
  headers: { 
    'Authorization': token,
    'X-Organization-ID': organizationId
  }
});
```

### ❌ Pitfall 3: Token Reuse Across Different Payloads
```javascript
const token = generateToken('{}'); // Generated for empty object
fetch('/endpoint1', { body: '{}' }); // ✅ Works
fetch('/endpoint2', { body: '{"data": "value"}' }); // ❌ Fails - different payload
```

**✅ Solution:** Generate new token for each unique payload:
```javascript
const token1 = generateToken('{}');
const token2 = generateToken('{"data": "value"}');
```

### ❌ Pitfall 4: Mixing Authentication Methods
```javascript
// Don't mix Supabase tokens with M2M endpoints
const supabaseToken = await supabase.auth.getSession()
fetch('/api/quickbooks/customers', {
  headers: { 'Authorization': `Bearer ${supabaseToken}` } // ❌ Wrong auth method
});
```

**✅ Solution:** Use appropriate authentication for each endpoint:
```javascript
// Use Supabase auth for user-related endpoints
const { data: { session } } = await supabase.auth.getSession()
fetch('/user/profile', {
  headers: { 'Authorization': `Bearer ${session.access_token}` }
});

// Use M2M auth for API endpoints
const m2mToken = generateAuthToken(payload, secretKey)
fetch('/api/quickbooks/customers', {
  headers: { 'Authorization': m2mToken }
});
```

## Error Handling

### User Authentication Errors
- **Invalid Credentials**: Check email/password combination
- **User Not Confirmed**: Check email for confirmation link
- **Session Expired**: Refresh session or redirect to login
- **Network Issues**: Implement retry logic with exponential backoff

```javascript
const handleAuthError = (error) => {
  switch (error.message) {
    case 'Invalid login credentials':
      setError('Invalid email or password')
      break
    case 'Email not confirmed':
      setError('Please check your email and confirm your account')
      break
    case 'User not found':
      setError('No account found with this email')
      break
    default:
      setError('An unexpected error occurred')
  }
}
```

### M2M Authentication Errors (401)
- **Cause**: Signature mismatch due to payload differences
- **Solution**: Verify payload matching between token generation and request
- **Debug**: Log both the payload used for token generation and request body

### Missing Organization ID (400)
- **Cause**: `X-Organization-ID` header missing for QuickBooks endpoints
- **Solution**: Always include organization ID header for `/quickbooks/*` endpoints

### Token Expiration (401)
- **Cause**: Tokens are valid for 5 minutes
- **Solution**: Generate fresh tokens for each request or implement token refresh logic

## Testing and Debugging

### Debug Checklist
1. ✅ Payload used for token generation matches request body exactly
2. ✅ `X-Organization-ID` header included for QuickBooks endpoints
3. ✅ Token generated within 5-minute window
4. ✅ HMAC-SHA256 implementation matches server expectations
5. ✅ Content-Type header set to `application/json` for JSON requests
6. ✅ Using correct authentication method for endpoint type

### Test Commands

#### User Authentication Testing
```bash
# Test Supabase connection
curl -X POST \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_SUPABASE_ANON_KEY" \
  -d '{"email":"test@example.com","password":"password"}' \
  https://YOUR_SUPABASE_URL/auth/v1/token?grant_type=password
```

#### M2M Authentication Testing
```bash
# Test GET endpoint
curl -H "Authorization: Bearer {signature}.{timestamp}" \
     -H "X-Organization-ID: {org-id}" \
     https://api.claritybusinesssolutions.ca/quickbooks/customers

# Test POST endpoint  
curl -X POST \
     -H "Authorization: Bearer {signature}.{timestamp}" \
     -H "X-Organization-ID: {org-id}" \
     -H "Content-Type: application/json" \
     -d '{}' \
     https://api.claritybusinesssolutions.ca/quickbooks/validate

# Test health endpoint (no auth required)
curl https://api.claritybusinesssolutions.ca/health

# Test authenticated health endpoint
curl -X POST \
     -H "Authorization: Bearer {signature}.{timestamp}" \
     -H "Content-Type: application/json" \
     -d '{}' \
     https://api.claritybusinesssolutions.ca/health
```

## Security Considerations

### User Authentication Security
1. **Password Policies**: Enforce strong password requirements
2. **Session Management**: Implement proper session timeout and refresh
3. **HTTPS Only**: Always use HTTPS for authentication requests
4. **Token Storage**: Store tokens securely (httpOnly cookies preferred)
5. **CSRF Protection**: Implement CSRF tokens for state-changing operations

### M2M Authentication Security
1. **Secret Key Protection**: Never expose the secret key in client-side code
2. **Token Transmission**: Always use HTTPS for API requests
3. **Token Storage**: Avoid storing tokens; generate fresh ones as needed
4. **Organization ID Validation**: Ensure users can only access their organization's data
5. **Rate Limiting**: Implement rate limiting to prevent abuse

## Available Endpoints

### User Authentication Endpoints (Supabase)
- `POST /auth/v1/signup` - User registration
- `POST /auth/v1/token` - User login
- `POST /auth/v1/logout` - User logout
- `GET /auth/v1/user` - Get current user
- `PUT /auth/v1/user` - Update user profile

### M2M API Endpoints

#### System Health
- `GET /health` - Public health check
- `POST /health` - Authenticated health check

#### QuickBooks Integration
- `GET /quickbooks/customers` - List customers
- `POST /quickbooks/customers` - Create customer
- `GET /quickbooks/customers/{id}` - Get customer by ID
- `PUT /quickbooks/customers` - Update customer
- `DELETE /quickbooks/customers/{id}` - Delete customer
- `POST /quickbooks/validate` - Validate credentials
- `POST /quickbooks/query` - Execute custom query
- `GET /quickbooks/invoices` - List invoices
- `POST /quickbooks/invoices` - Create invoice

### Authentication Requirements by Endpoint Type
- **User endpoints** (`/user/*`): Supabase JWT token
- **Public endpoints** (`/health`): No authentication required
- **API endpoints** (`/api/*`): HMAC signature required
- **QuickBooks endpoints** (`/quickbooks/*`): HMAC signature + `X-Organization-ID` header required

## API Documentation

**Complete API Documentation**: 
- Interactive docs: `https://api.claritybusinesssolutions.ca/docs`
- OpenAPI spec: `https://api.claritybusinesssolutions.ca/openapi.json`

## Support and Troubleshooting

### For User Authentication Issues:
1. Verify Supabase configuration and API keys
2. Check network connectivity to Supabase
3. Validate email confirmation status
4. Review browser console for detailed error messages

### For M2M Authentication Issues:
1. Verify payload matching using debug logs
2. Check organization ID header for QuickBooks endpoints
3. Ensure token generation follows exact HMAC-SHA256 specification
4. Test with cURL commands to isolate client-side issues
5. Verify secret key is correct and properly configured

### Getting Help
- **Backend Team**: For signature validation debugging and server-side issues
- **Documentation**: See `error_solving/` directory for detailed investigation reports
- **API Issues**: Check API status at health endpoints before debugging client code

---

**Last Updated**: 2025-08-02  
**Version**: 2.0  
**Status**: Production Ready ✅