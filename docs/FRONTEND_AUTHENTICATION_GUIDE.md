# Frontend Authentication Guide

The Clarity Backend supports two authentication pathways:

1. **User Authentication** - Kong Gateway + Supabase for user sessions
2. **M2M Authentication** - HMAC-SHA256 signed tokens for `https://api.claritybusinesssolutions.cs/api` endpoints

## 1. Documentation

### User Authentication
- **Purpose**: User registration, login, session management
- **Gateway**: Kong Gateway exposes Supabase auth endpoints via `localhost:8000`
- **Verification**:
  - Availability: Test Supabase client connection in your app
  - Access: Implement auth flows and verify token handling

### M2M Authentication  
- **Purpose**: Backend service access to `/api` endpoints
- **Format**: `Authorization: Bearer {signature}.{timestamp}`
- **Verification**:
  - Availability: `GET https://api.claritybusinesssolutions.ca/health`
  - Access: `POST https://api.claritybusinesssolutions.ca/health` (requires auth)

**API Documentation**:
- `https://api.claritybusinesssolutions.ca/docs`

## 2. Configuration

### User Authentication
```env
# For direct Supabase connection
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_SUPABASE_SERVICE_ROLE_KEY

# For local development via Kong Gateway
VITE_API_BASE_URL=http://localhost:8000
```

```bash
npm install @supabase/supabase-js
```

### M2M Authentication
```env
SECRET_KEY=your-secret-key-here
```

## 3. Implementation Examples

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
```

### M2M Authentication (Backend Services)

**Node.js:**
```javascript
const crypto = require('crypto')

class ClarityAPIClient {
  constructor(secretKey) {
    this.secretKey = secretKey
    this.baseUrl = 'https://api.claritybusinesssolutions.cs'
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
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: payload || undefined
    })
    
    return response.json()
  }
}

// Usage
const client = new ClarityAPIClient(process.env.SECRET_KEY)
const result = await client.callAPI('/health', 'POST')
```

**Python:**
```python
import hmac
import hashlib
import time
import requests
import json

class ClarityAPIClient:
    def __init__(self, secret_key):
        self.secret_key = secret_key
        self.base_url = 'https://api.claritybusinesssolutions.cs'
    
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
        
        response = requests.request(
            method,
            f"{self.base_url}{endpoint}",
            headers={
                'Authorization': auth_header,
                'Content-Type': 'application/json'
            },
            data=payload if payload else None
        )
        
        return response.json()

# Usage
client = ClarityAPIClient(os.getenv('SECRET_KEY'))
result = client.call_api('/health', 'POST')