# Security Review: Open Redirect Vulnerability Analysis

**Date**: 2026-01-24
**Reviewer**: Claude Code
**Severity**: HIGH
**Status**: VULNERABLE

## Executive Summary

A comprehensive security review of the Clarity CRM Frontend codebase has identified **critical open redirect vulnerabilities** in the QuickBooks OAuth integration flow. The application redirects users to external URLs without proper validation, creating attack vectors for phishing, credential theft, and session hijacking.

## Vulnerability Details

### 1. QuickBooks OAuth Flow - Critical Vulnerability

**Location**: `src/components/financial/QuickBooksConnectionPanel.jsx:104`

**Vulnerable Code**:
```javascript
const handleConnect = useCallback(async () => {
  setIsConnecting(true);
  setError(null);

  try {
    const response = await getQBOAuthorizationUrl();

    if (response.authorization_url) {
      // Redirect to QuickBooks OAuth page
      window.location.href = response.authorization_url;  // ❌ UNVALIDATED REDIRECT
    } else {
      throw new Error('Authorization URL not received from server');
    }
  } catch (err) {
    console.error('Error initiating OAuth flow:', err);
    setError(err.message || 'Failed to initiate QuickBooks connection');
    setIsConnecting(false);
  }
}, []);
```

**Risk Level**: **CRITICAL**

**Attack Vector**:
1. Attacker compromises or MitM the backend API response
2. Backend returns malicious URL in `authorization_url` field
3. Frontend blindly redirects user via `window.location.href = response.authorization_url`
4. User is redirected to attacker-controlled phishing site that mimics QuickBooks login
5. User enters QuickBooks credentials on fake site
6. Attacker captures credentials and session tokens

**Backend API**: `src/api/quickbooksApi.js:164-166`
```javascript
export const getQBOAuthorizationUrl = async () => {
  return await makeRequest('/authorize');
};
```

The backend endpoint `/quickbooks/authorize` returns:
```json
{
  "authorization_url": "https://appcenter.intuit.com/connect/oauth2?..."
}
```

**No validation occurs** on the frontend to ensure this URL:
- Points to a trusted QuickBooks domain
- Uses HTTPS protocol
- Doesn't contain suspicious parameters or fragments

### 2. User-Controlled Links - Medium Risk

**Location**: `src/components/projects/ProjectLinksTab.jsx:183-191`

**Vulnerable Code**:
```jsx
<a
  href={linkUrl}
  target="_blank"
  rel="noopener noreferrer"
  className={`
    flex-1 truncate
    ${darkMode ? 'text-blue-400' : 'text-blue-600'}
  `}
>
  {linkTitle}
</a>
```

**Risk Level**: **MEDIUM**

**Issue**:
- Users can create arbitrary links that are displayed to other users
- Links open in new tabs with `target="_blank"`
- While `rel="noopener noreferrer"` prevents `window.opener` attacks, malicious URLs can still:
  - Lead to phishing sites
  - Execute XSS if protocol handlers are used (e.g., `javascript:`, `data:`)
  - Redirect to malware download sites
  - Impersonate trusted services

**Attack Scenarios**:
1. Internal user creates link: `javascript:alert(document.cookie)`
2. Other users click the link
3. JavaScript executes in their browser context
4. OR: User creates link to fake login page: `https://github-phish.com/clarity-repo` (typosquatting)

**Current Validation**:
- URL parsing attempted in `ProjectLinksTab.jsx:281-283` but only for display purposes
- No allowlist of safe protocols
- No domain validation
- No sanitization against `javascript:` or `data:` URIs

## Additional Security Concerns

### 3. GitHub URL Handling

**Location**: `src/components/projects/ProjectLinksTab.jsx:261-275`

The application parses GitHub URLs and checks repository existence, but:
- No validation that parsed URL is actually GitHub
- `parseGitHubUrl()` utility could be bypassed with crafted URLs
- Repository check failure falls back to "proceed anyway" flow

### 4. OAuth Callback Handling

**Location**: `src/components/financial/QuickBooksConnectionPanel.jsx:168-186`

```javascript
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');

  if (code && state) {
    // OAuth callback detected - refresh status
    // The backend has already handled the token exchange via the redirect_uri
    // We just need to check the new connection status

    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);

    // Refresh connection status after a short delay
    setTimeout(() => {
      fetchConnectionStatus();
    }, 1000);
  }
}, [fetchConnectionStatus]);
```

**Potential Issues**:
- No CSRF state validation on frontend
- Backend must validate state parameter (not verified in this review)
- Parameters are read from URL query string without validation
- Relies entirely on backend security

## Recommended Fixes

### Priority 1: QuickBooks OAuth URL Validation (CRITICAL)

Add strict URL validation before redirect:

```javascript
// Add URL validation utility
const isValidQuickBooksUrl = (url) => {
  try {
    const parsed = new URL(url);

    // Allowlist of valid QuickBooks OAuth domains
    const validDomains = [
      'appcenter.intuit.com',
      'oauth.platform.intuit.com'
    ];

    // Check protocol
    if (parsed.protocol !== 'https:') {
      return false;
    }

    // Check domain
    if (!validDomains.includes(parsed.hostname)) {
      return false;
    }

    return true;
  } catch (e) {
    return false;
  }
};

// Update handleConnect
const handleConnect = useCallback(async () => {
  setIsConnecting(true);
  setError(null);

  try {
    const response = await getQBOAuthorizationUrl();

    if (response.authorization_url) {
      // ✅ VALIDATE URL BEFORE REDIRECT
      if (!isValidQuickBooksUrl(response.authorization_url)) {
        throw new Error('Invalid authorization URL received from server');
      }

      window.location.href = response.authorization_url;
    } else {
      throw new Error('Authorization URL not received from server');
    }
  } catch (err) {
    console.error('Error initiating OAuth flow:', err);
    setError(err.message || 'Failed to initiate QuickBooks connection');
    setIsConnecting(false);
  }
}, []);
```

### Priority 2: User Link Sanitization (MEDIUM)

Add protocol validation and sanitization:

```javascript
// Add URL sanitization utility
const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmed = url.trim();

  // Block dangerous protocols
  const dangerousProtocols = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'about:'
  ];

  const lowerUrl = trimmed.toLowerCase();
  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      return null;
    }
  }

  // Validate URL format
  try {
    const parsed = new URL(trimmed);

    // Only allow http and https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    return trimmed;
  } catch (e) {
    // If URL parsing fails, try prepending https://
    try {
      const withProtocol = `https://${trimmed}`;
      new URL(withProtocol); // Validate
      return withProtocol;
    } catch {
      return null;
    }
  }
};

// Update link rendering
const renderLink = useCallback((link) => {
  const linkUrl = link.url || link.link;
  const sanitizedUrl = sanitizeUrl(linkUrl);

  // Don't render if URL is invalid/dangerous
  if (!sanitizedUrl) {
    return (
      <div key={link.id} className="p-2 text-red-600 dark:text-red-400">
        ⚠️ Invalid or dangerous URL blocked
      </div>
    );
  }

  // ... rest of render logic with sanitizedUrl
}, [darkMode, /* ... */]);
```

### Priority 3: Backend Validation

Ensure backend API validates:
- OAuth redirect URIs match registered callback URLs
- State parameters are cryptographically secure random values
- Authorization codes are single-use and expire quickly
- CSRF tokens are validated on callback

## Testing Recommendations

### Test Case 1: Malicious OAuth URL
1. Intercept `/quickbooks/authorize` response
2. Replace `authorization_url` with `https://evil.com/fake-quickbooks`
3. Verify redirect is blocked with error message

### Test Case 2: JavaScript Protocol in Links
1. Create project link with URL: `javascript:alert(document.cookie)`
2. Verify link is sanitized or blocked
3. Ensure no JavaScript execution occurs on click

### Test Case 3: Data URI Attack
1. Create project link with data URI: `data:text/html,<script>alert('XSS')</script>`
2. Verify link is blocked
3. Ensure no code execution

### Test Case 4: Typosquatting Detection
1. Create link: `https://github.cm/fake-repo` (typo)
2. Consider warning users about suspicious domains
3. Implement domain similarity detection (future enhancement)

## Impact Assessment

**Severity**: HIGH
- Open redirect vulnerabilities can lead to:
  - Credential theft via phishing
  - Session hijacking
  - Malware distribution
  - Brand reputation damage
  - Compliance violations (PCI-DSS, SOC2, etc.)

**Affected Users**: All users who:
- Connect QuickBooks integration
- Create or click on project links
- Access the application via compromised network

**Exploitability**: MEDIUM-HIGH
- Requires backend compromise OR MitM attack OR social engineering
- No authentication required to create malicious links
- Users trust internal links from colleagues

## Compliance Impact

- **OWASP Top 10 2021**: A01:2021 - Broken Access Control
- **CWE-601**: URL Redirection to Untrusted Site ('Open Redirect')
- **PCI-DSS 6.5.1**: Injection flaws, particularly XSS
- **GDPR**: Data protection and security requirements

## References

- [OWASP Unvalidated Redirects and Forwards Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html)
- [CWE-601: URL Redirection to Untrusted Site](https://cwe.mitre.org/data/definitions/601.html)
- [Portswigger: DOM-based open redirection](https://portswigger.net/web-security/dom-based/open-redirection)

## Conclusion

The Clarity CRM Frontend contains critical open redirect vulnerabilities that require immediate remediation. The QuickBooks OAuth flow presents the highest risk due to its sensitivity and potential for credential theft. User-controlled links also pose a medium risk for phishing and XSS attacks.

**Recommended Action**: Implement URL validation immediately before the next production deployment.
