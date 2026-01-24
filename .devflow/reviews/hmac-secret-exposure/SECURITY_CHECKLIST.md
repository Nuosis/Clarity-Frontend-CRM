# Security Checklist: HMAC Authentication

**Last Updated**: 2026-01-23
**Status**: ✅ ALL CHECKS PASSED

## Quick Verification Commands

### 1. Check for Client-Side HMAC Usage
```bash
# Should return NO matches
grep -r "crypto\.createHmac\|CryptoJS\.HmacSHA256" src/
```
**Current Status**: ✅ PASS (no matches)

### 2. Check for Secret Key Exposure
```bash
# Should return NO matches
grep -r "VITE_SECRET_KEY" src/
```
**Current Status**: ✅ PASS (no matches)

### 3. Verify Backend Token Endpoint
```bash
# Should find /auth/generate-token endpoint
curl -s https://api.claritybusinesssolutions.ca/openapi.json | grep "/auth/generate-token"
```
**Current Status**: ✅ PASS (endpoint exists)

### 4. Build Verification
```bash
# Should complete without security errors
npm run build
```
**Current Status**: ✅ PASS (builds successfully)

### 5. Check .env File Not Committed
```bash
# Should show .env in .gitignore
grep "^\.env$" .gitignore
```
**Current Status**: ✅ PASS (.env ignored)

## Security Architecture Checklist

### ✅ Authentication Flow
- [x] Frontend uses Supabase JWT authentication
- [x] Token generation requires valid session
- [x] HMAC signing performed server-side only
- [x] Secret key isolated on backend
- [x] Tokens include organization context

### ✅ Token Generation
- [x] Endpoint: `/auth/generate-token`
- [x] Requires: JWT bearer token
- [x] Returns: Signed HMAC token
- [x] Expiry: 5-minute validation window
- [x] Caching: Empty payload tokens (reduces backend load)

### ✅ Request Authentication
- [x] Authorization header: `Bearer {signature}.{timestamp}`
- [x] Organization header: `X-Organization-ID: {uuid}`
- [x] Payload signing: Prevents tampering
- [x] Timestamp validation: Prevents replay attacks
- [x] Automatic injection via axios interceptor

### ✅ Environment Security
- [x] `.env` file not committed to git
- [x] Secret key from environment variables
- [x] No hardcoded secrets in code
- [x] Service role key documented as high-risk
- [x] Migration scripts have browser guards

## Development Best Practices

### Code Reviews
When reviewing code, always check:

1. **No client-side HMAC signing**
   ```javascript
   // ❌ WRONG - Client-side HMAC
   const signature = crypto.createHmac('sha256', SECRET_KEY)
     .update(message)
     .digest('hex');

   // ✅ CORRECT - Server-side token generation
   const token = await generateBackendAuthHeader(payload);
   ```

2. **No secret key imports**
   ```javascript
   // ❌ WRONG - Secret in frontend
   const SECRET_KEY = import.meta.env.VITE_SECRET_KEY;

   // ✅ CORRECT - Backend configuration only
   const backendUrl = import.meta.env.VITE_API_URL;
   ```

3. **Use dataService for API calls**
   ```javascript
   // ❌ WRONG - Manual authentication
   const response = await fetch(url, {
     headers: { Authorization: myToken }
   });

   // ✅ CORRECT - Automatic authentication
   const data = await dataService.get(endpoint);
   ```

### Testing Scripts
When creating test scripts:

1. **Use environment variables**
   ```javascript
   // ✅ CORRECT
   const SECRET_KEY = process.env.VITE_SECRET_KEY;
   if (!SECRET_KEY) {
     throw new Error('Missing VITE_SECRET_KEY');
   }
   ```

2. **Add Node.js-only guards**
   ```javascript
   // ✅ CORRECT - Prevent browser execution
   if (typeof window !== 'undefined') {
     throw new Error('Must run in Node.js environment');
   }
   ```

3. **Document security requirements**
   ```javascript
   /**
    * ⚠️ SECURITY WARNING ⚠️
    * This script uses VITE_SECRET_KEY for direct HMAC signing.
    * ONLY run in secure backend/dev environments.
    * DO NOT bundle or deploy to production.
    */
   ```

## Migration Scripts Security

### Required Guards
```javascript
// Browser detection
if (typeof window !== 'undefined') {
  throw new Error('SECURITY ERROR: Cannot run in browser');
}

// Environment validation
if (typeof process === 'undefined' || !process.env) {
  throw new Error('SECURITY ERROR: Must run in Node.js');
}
```

### Documentation Requirements
Every migration script must include:
1. Security warning comment block
2. Usage instructions
3. Environment requirements
4. Reference to `docs/MIGRATION_SCRIPTS_SECURITY.md`

## Periodic Security Audits

### Quarterly Checklist (Every 3 Months)

**Date of Last Audit**: 2026-01-23
**Next Audit Due**: 2026-04-23

- [ ] Run all verification commands above
- [ ] Review OpenAPI spec for new endpoints
- [ ] Check for new dependencies with security vulnerabilities
- [ ] Audit backend token generation logs
- [ ] Verify `.env` files not committed
- [ ] Review test scripts for hardcoded secrets
- [ ] Update security documentation
- [ ] Consider secret key rotation

### Secret Key Rotation Process

When rotating `VITE_SECRET_KEY`:

1. **Prepare**
   - Generate new secret key: `openssl rand -hex 32`
   - Schedule maintenance window
   - Notify team members

2. **Update Backend**
   - Update `SECRET_KEY` environment variable on backend
   - Restart backend services
   - Verify health endpoint responds

3. **Update Frontend**
   - Update `VITE_SECRET_KEY` in `.env`
   - Update any test/migration scripts
   - Rebuild and redeploy

4. **Verify**
   - Test authentication flow
   - Verify token generation works
   - Check backend logs for errors

5. **Clean Up**
   - Remove old secret from password manager
   - Update team documentation
   - Record rotation in security log

## Emergency Response

### If Secret Key is Compromised

1. **Immediate Actions** (within 1 hour)
   - [ ] Rotate secret key immediately
   - [ ] Restart all backend services
   - [ ] Review access logs for suspicious activity
   - [ ] Notify security team

2. **Investigation** (within 24 hours)
   - [ ] Identify how key was exposed
   - [ ] Check for unauthorized API access
   - [ ] Review recent code changes
   - [ ] Audit user sessions

3. **Remediation** (within 1 week)
   - [ ] Fix exposure vulnerability
   - [ ] Update security documentation
   - [ ] Implement additional monitoring
   - [ ] Conduct team security training

## Monitoring and Alerts

### Backend Token Generation
Monitor for:
- High request rate (potential abuse)
- Failed authentication attempts
- Invalid organization IDs
- Expired timestamps

### API Request Patterns
Alert on:
- Unusual spike in API requests
- Requests with invalid signatures
- Requests outside normal hours
- Requests from unexpected IPs

## Documentation References

- **Security Review**: `SECURITY_REVIEW.md`
- **Task Summary**: `TASK_COMPLETION_SUMMARY.md`
- **Migration Security**: `docs/MIGRATION_SCRIPTS_SECURITY.md`
- **Project Guide**: `CLAUDE.md`
- **Backend API**: `https://api.claritybusinesssolutions.ca/docs`

## Quick Links

- [Backend Health](https://api.claritybusinesssolutions.ca/health)
- [OpenAPI Spec](https://api.claritybusinesssolutions.ca/openapi.json)
- [API Documentation](https://api.claritybusinesssolutions.ca/docs)
- [Supabase Dashboard](https://supabase.claritybusinesssolutions.ca)

---

**Maintained by**: Development Team
**Review Schedule**: Quarterly
**Last Review**: 2026-01-23
**Next Review**: 2026-04-23
