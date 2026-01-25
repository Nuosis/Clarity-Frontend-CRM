# Service Role Key Security Review
**Date:** 2026-01-24
**Task:** [REVIEW] Service role key exposure in migration script could grant unrestricted database access
**Severity:** CRITICAL
**Status:** VULNERABILITIES IDENTIFIED

---

## Executive Summary

This security review identified **ONE CRITICAL VULNERABILITY** and **ONE COMPLIANT AREA** in the codebase regarding Supabase service role key handling.

### ✅ COMPLIANT: Migration Scripts
Migration scripts (`scripts/migrate-teams-data.js`, `scripts/load-notes-to-supabase.js`) properly implement security controls and follow best practices.

### ❌ CRITICAL VULNERABILITY: Frontend Bundle Exposure
**The Supabase service role key is exposed in the frontend JavaScript bundle**, granting unrestricted database access to anyone who inspects the compiled code.

---

## Detailed Findings

### 1. ✅ Migration Scripts - COMPLIANT

#### Files Reviewed:
- `scripts/migrate-teams-data.js` (729 lines)
- `scripts/load-notes-to-supabase.js` (143 lines)

#### Security Controls Implemented:

**✅ Browser Context Detection:**
```javascript
// scripts/migrate-teams-data.js:44-51
if (typeof window !== 'undefined') {
  throw new Error(
    'SECURITY ERROR: Migration scripts cannot run in browser environments. ' +
    'Service role key exposure would grant unrestricted database access. ' +
    'Run this script in a secure backend environment only.'
  );
}
```

**✅ Environment Variable Validation:**
```javascript
// scripts/migrate-teams-data.js:106-112
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SECURITY ERROR: VITE_SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('   This key grants unrestricted database access and bypasses all RLS policies.');
  console.error('   The key MUST be stored in .env file (not committed to git).');
  console.error('   See docs/MIGRATION_SCRIPTS_SECURITY.md for security requirements.');
  process.exit(1);
}
```

**✅ Node.js Environment Verification:**
```javascript
// scripts/migrate-teams-data.js:54-58
if (typeof process === 'undefined' || !process.env) {
  throw new Error(
    'SECURITY ERROR: Migration scripts must run in Node.js environment with environment variables.'
  );
}
```

**✅ No Hardcoded Keys:**
- All service role keys are loaded from `process.env.VITE_SUPABASE_SERVICE_ROLE_KEY`
- No hardcoded JWT tokens found in any `.js` files
- Documentation examples use placeholder values only

**✅ Comprehensive Security Documentation:**
```javascript
// scripts/migrate-teams-data.js:7-20
/**
 * ⚠️ SECURITY WARNING ⚠️
 *
 * This script uses VITE_SUPABASE_SERVICE_ROLE_KEY which bypasses ALL Row-Level
 * Security (RLS) policies and grants UNRESTRICTED DATABASE ACCESS across all
 * organizations.
 *
 * CRITICAL SECURITY REQUIREMENTS:
 * - ❌ NEVER run this script in browser/frontend contexts
 * - ❌ NEVER commit this script with hardcoded service role keys
 * - ❌ NEVER deploy this script to publicly accessible environments
 * - ✅ ONLY run in secure backend environments (SSH, local dev, CI/CD)
 * - ✅ ALWAYS use environment variables for service role key
 * - ✅ ROTATE service role key after migration completes
 */
```

#### Assessment:
**Migration scripts are COMPLIANT with security best practices.** They implement defense-in-depth with multiple layers of protection against accidental exposure.

---

### 2. ❌ CRITICAL VULNERABILITY: Frontend Service Role Key Exposure

#### Vulnerability Details:

**Location:** `src/config.js:8`
```javascript
export const supabaseServiceRoleKey = import.meta.env?.VITE_SUPABASE_SERVICE_ROLE_KEY;
```

**Impact:** 🔴 **CRITICAL - UNRESTRICTED DATABASE ACCESS**

#### How This Creates Vulnerability:

1. **Vite Build Process:**
   - Vite bundles all JavaScript files including `src/config.js`
   - Environment variables prefixed with `VITE_` are **embedded directly into the bundle** at build time
   - The service role key becomes a **string literal** in the compiled JavaScript

2. **Bundle Exposure:**
   - The compiled bundle is served to browsers at `http://localhost:1235` or production URL
   - Anyone can view the bundle source in DevTools → Sources tab
   - The service role key is visible as plaintext in the bundle

3. **Attack Vector:**
   ```javascript
   // In browser console, after inspecting bundle:
   // Attacker finds: supabaseServiceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

   // Attacker can now:
   import { createClient } from '@supabase/supabase-js';
   const supabase = createClient(
     'https://supabase.claritybusinesssolutions.ca',
     'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // Stolen service role key
   );

   // BYPASS ALL RLS POLICIES:
   await supabase.from('customers').select('*'); // Access ALL organizations
   await supabase.from('notes').delete().neq('id', 'dummy'); // Delete ALL notes
   await supabase.from('financial_records').select('*'); // Steal financial data
   ```

#### Current Usage in Frontend:

**File:** `src/services/supabaseService.js`

**Admin Functions Using Service Role Key:**
- Line 10: Import `supabaseServiceRoleKey`
- Line 57: `const supabaseAdmin = supabaseServiceRoleKey ? supabase : null;`
- Line 335-339: `getSupabaseAdminClient()` exports admin client
- Line 555-620: `adminQuery()` - Query with RLS bypass
- Line 624-655: `adminInsert()` - Insert with RLS bypass
- Line 661-693: `adminUpdate()` - Update with RLS bypass (used in QboTestPanel.jsx:462)
- Line 698-729: `adminRemove()` - Delete with RLS bypass

**Components Using Admin Functions:**
1. `src/components/financial/QboTestPanel.jsx:462`
   ```javascript
   const updateResult = await adminUpdate('customer_sales', updateData, { id: record.id });
   ```

2. `src/services/initializationService.js:36`
   ```javascript
   // Comment says "Use adminQuery to bypass RLS restrictions"
   const emailResult = await query('customer_email', {...});
   ```
   Note: Uses `query()` not `adminQuery()`, but comment reveals intent

#### Proof of Exposure:

1. **Vite Configuration** (`vite.config.js`):
   - No filtering of `VITE_*` variables
   - No exclusion list for sensitive keys
   - Default Vite behavior: **ALL `VITE_*` variables are embedded in bundle**

2. **Environment File** (`.env`):
   - Confirmed to contain `VITE_SUPABASE_SERVICE_ROLE_KEY=<actual key>`
   - This value is embedded in production builds

3. **Build Output:**
   - `npm run build` creates `dist/index.html` with inlined JavaScript
   - Service role key becomes **searchable plaintext** in bundle

---

## Security Impact Assessment

### Threat Model:

**Threat Actor:** External attacker, malicious insider, compromised browser extension

**Attack Complexity:** LOW
- Open browser DevTools
- Search bundle for "SUPABASE_SERVICE_ROLE_KEY" or "eyJ"
- Copy the JWT token
- Use it with Supabase client library

**Impact:** CRITICAL
- **Confidentiality:** Complete breach - access to ALL customer data across ALL organizations
- **Integrity:** Complete compromise - modify/delete any data in database
- **Availability:** Potential DoS - delete critical tables, corrupt data
- **Compliance:** GDPR/CCPA violations, data breach notification requirements

**Likelihood:** HIGH
- Frontend bundles are always inspectable
- Vite environment variable behavior is well-documented
- Service role keys are high-value targets for attackers

**Risk Rating:** **CRITICAL (Impact: Critical × Likelihood: High)**

---

## Recommended Remediation

### Immediate Actions (Emergency Hotfix):

1. **Remove Service Role Key from Frontend Config:**
   ```javascript
   // src/config.js - REMOVE LINE 8:
   // export const supabaseServiceRoleKey = import.meta.env?.VITE_SUPABASE_SERVICE_ROLE_KEY;
   ```

2. **Remove Admin Functions from Frontend:**
   - Delete or comment out `adminQuery`, `adminInsert`, `adminUpdate`, `adminRemove` in `supabaseService.js`
   - Delete `getSupabaseAdminClient()` export
   - Remove `performAdminOperation` helper
   - Remove `supabaseAdmin` variable

3. **Rotate Service Role Key:**
   - Generate new service role key in Supabase dashboard
   - Update `.env` file with new key (for migration scripts only)
   - Old key is now compromised and must be revoked

4. **Update Components Using Admin Functions:**
   - `QboTestPanel.jsx:462` - Replace `adminUpdate()` with backend API call
   - `initializationService.js` - Use regular `query()` with proper RLS policies

### Long-Term Solutions:

1. **Backend API for Admin Operations:**
   - Create authenticated backend endpoints for operations requiring elevated privileges
   - Use HMAC authentication (already implemented in `dataService.js`)
   - Backend uses service role key server-side (never exposed to frontend)

2. **Row-Level Security Policies:**
   - Review all RLS policies to ensure proper organization scoping
   - Ensure users can only access their organization's data through regular anon key
   - Document why admin access was needed and fix with proper RLS policies

3. **Environment Variable Audit:**
   - Create `.env.example` with safe documentation
   - Add build-time validation to reject `VITE_*` variables containing "SERVICE_ROLE" or "SECRET"
   - Update Vite config to explicitly whitelist allowed environment variables

4. **Security Testing:**
   - Add automated test to scan build output for "eyJ" patterns (JWT signatures)
   - Add pre-commit hook to prevent committing `.env` files
   - Add CI/CD step to verify no service role keys in bundle

---

## Compliance Status

### Migration Scripts: ✅ PASS

**Criteria:**
- [x] Browser execution prevention
- [x] Environment variable validation
- [x] No hardcoded keys
- [x] Security documentation
- [x] Error handling for missing keys

### Frontend Application: ❌ FAIL

**Criteria:**
- [x] No hardcoded keys in source (keys are in env vars)
- [ ] **Service role key not exposed in bundle** ← FAILURE
- [ ] Admin operations not available in browser context ← FAILURE
- [ ] Proper RLS policies eliminate need for admin access ← FAILURE

---

## References

1. **CLAUDE.md Security Guidelines:**
   - Lines 314-350: Migration Scripts Security section
   - Backend Change Protocol (lines 22-65)

2. **docs/MIGRATION_SCRIPTS_SECURITY.md:**
   - Comprehensive security requirements for service role key usage
   - Affected scripts inventory
   - Security checklist

3. **Vite Documentation:**
   - https://vitejs.dev/guide/env-and-mode.html#env-files
   - "Only variables prefixed with VITE_ are exposed to your Vite-processed code"

4. **Supabase Documentation:**
   - https://supabase.com/docs/guides/auth/row-level-security
   - "Service role key bypasses all RLS policies"

---

## Action Items

**IMMEDIATE (Within 24 hours):**
- [ ] Remove `supabaseServiceRoleKey` from `src/config.js`
- [ ] Remove admin functions from `src/services/supabaseService.js`
- [ ] Rotate service role key in Supabase dashboard
- [ ] Update `.env` with new key (migration scripts only)

**SHORT TERM (Within 1 week):**
- [ ] Refactor `QboTestPanel.jsx` to use backend API
- [ ] Review and fix RLS policies to eliminate admin access needs
- [ ] Add build-time validation for sensitive env vars

**LONG TERM (Within 1 month):**
- [ ] Implement backend endpoints for elevated operations
- [ ] Add automated security scanning to CI/CD
- [ ] Document secure patterns for future development

---

## Conclusion

While migration scripts demonstrate excellent security practices with multiple defensive layers, **the frontend application has a critical vulnerability that exposes the service role key to any user**. This grants unrestricted database access and violates the security model documented in CLAUDE.md and MIGRATION_SCRIPTS_SECURITY.md.

**Recommendation:** Treat this as a **CRITICAL SECURITY INCIDENT** requiring immediate remediation and key rotation.

**Review Status:** ❌ FAILED - Critical vulnerability identified
**Next Steps:** Execute immediate remediation actions outlined above
