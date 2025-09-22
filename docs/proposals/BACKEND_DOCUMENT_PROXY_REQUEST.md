# Backend Document Proxy Enhancement Request

## Summary
Request to modify the `/documents/proxy` endpoint to support authentication via query parameters in addition to Authorization headers, enabling iframe compatibility for the SourceDocumentViewerModal component.

## Problem Statement
The current document proxy endpoint only accepts authentication via Authorization headers. However, HTML iframes cannot send custom headers, causing 403 authentication errors when trying to display proxied documents in the React frontend.

**Current Error:**
- Frontend generates proper HMAC tokens
- Backend proxy endpoint works correctly with curl (using Authorization header)
- Iframe requests fail with 403 "Not authenticated" because iframes cannot send Authorization headers

## Investigation Results

### Current Working Implementation
```bash
# This works with Authorization header
curl -H "Authorization: Bearer 4b92c8cfdd3985457710aad80916728f67dd72a2bddcc3efcf6819639c3c276d.1758510346" \
  "https://api.claritybusinesssolutions.ca/documents/proxy?url=https%3A%2F%2Fraw.githubusercontent.com%2F..."
# Returns: 200 OK with PDF content
```

### Current Failing Implementation
```bash
# This fails with query parameter
curl "https://api.claritybusinesssolutions.ca/documents/proxy?url=https%3A%2F%2Fraw.githubusercontent.com%2F...&token=4b92c8cfdd3985457710aad80916728f67dd72a2bddcc3efcf6819639c3c276d.1758510346"
# Returns: 403 Not authenticated
```

## Requested Changes

### Backend Endpoint Modification
Modify the `/documents/proxy` endpoint to accept authentication in **both** formats:

1. **Authorization Header** (current - keep for backward compatibility)
   ```
   Authorization: Bearer {signature}.{timestamp}
   ```

2. **Query Parameter** (new - for iframe compatibility)
   ```
   ?token={signature}.{timestamp}
   ```

### Authentication Logic
```javascript
// Pseudo-code for backend authentication check
function getAuthToken(req) {
  // Check Authorization header first (existing logic)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }
  
  // Check query parameter (new logic)
  const tokenParam = req.query.token;
  if (tokenParam) {
    return tokenParam;
  }
  
  return null; // No authentication found
}
```

### HMAC Validation
The HMAC validation logic remains unchanged:
- Token format: `{signature}.{timestamp}`
- Message: `{timestamp}.{payload}` (where payload is empty string for GET requests)
- Secret: `QArxVv0J1xggzd8Ai_Sk7TfFzllOflBJjVxA4kazpDo`
- Algorithm: HMAC-SHA256

## Frontend Implementation Ready
The frontend has been updated to generate URLs with the token query parameter:

```javascript
// Frontend generates URLs like:
const proxyUrl = `${backendConfig.baseUrl}/documents/proxy?url=${encodedUrl}&token=${encodeURIComponent(token)}`;
```

## Testing Requirements

### Test Cases
1. **Authorization Header** (existing functionality)
   ```bash
   curl -H "Authorization: Bearer {valid_token}" \
     "https://api.claritybusinesssolutions.ca/documents/proxy?url={encoded_url}"
   # Expected: 200 OK
   ```

2. **Query Parameter** (new functionality)
   ```bash
   curl "https://api.claritybusinesssolutions.ca/documents/proxy?url={encoded_url}&token={valid_token}"
   # Expected: 200 OK
   ```

3. **No Authentication**
   ```bash
   curl "https://api.claritybusinesssolutions.ca/documents/proxy?url={encoded_url}"
   # Expected: 403 Not authenticated
   ```

4. **Invalid Token**
   ```bash
   curl "https://api.claritybusinesssolutions.ca/documents/proxy?url={encoded_url}&token=invalid"
   # Expected: 403 Not authenticated
   ```

## Security Considerations
- Query parameter authentication maintains the same HMAC-SHA256 security as header authentication
- Tokens are time-limited (timestamp validation)
- No reduction in security posture
- Both authentication methods use identical validation logic

## Impact Assessment
- **Breaking Changes**: None (backward compatible)
- **New Functionality**: Iframe-compatible authentication
- **Security**: No impact (same validation logic)
- **Performance**: Minimal (additional query parameter check)

## Implementation Priority
**High** - This blocks the SourceDocumentViewerModal component from displaying GitHub-hosted PDFs, which is a core feature for the proposal system.

## Success Criteria
1. Existing Authorization header authentication continues to work
2. New query parameter authentication works for iframe requests
3. Frontend SourceDocumentViewerModal displays PDFs without 403 errors
4. All security validations remain intact

## Contact
Frontend team ready to test once backend changes are deployed.