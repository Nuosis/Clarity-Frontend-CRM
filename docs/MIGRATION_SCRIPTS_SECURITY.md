# Migration Scripts Security Guide

## Overview

This document outlines critical security considerations for database migration scripts that use Supabase service role keys. These scripts have **UNRESTRICTED DATABASE ACCESS** and must be handled with extreme care.

**Target Audience:** Developers, DevOps engineers, database administrators

**Last Updated:** 2026-01-16

---

## 🚨 CRITICAL SECURITY WARNING

### Service Role Key Exposure Risk

Migration scripts in this project use `VITE_SUPABASE_SERVICE_ROLE_KEY` which **BYPASSES ALL ROW-LEVEL SECURITY (RLS) POLICIES**.

**If these scripts are:**
- ❌ Accidentally deployed to a frontend/browser environment
- ❌ Committed with hardcoded service role keys
- ❌ Exposed via bundle files or source maps
- ❌ Run in untrusted environments

**Then attackers could:**
- 🔓 Gain unrestricted database access across ALL organizations
- 📊 Read sensitive data from any tenant
- ✏️ Modify or delete data without authorization
- 🚫 Bypass all authentication and authorization controls

---

## Affected Migration Scripts

The following scripts use service role keys and require special security handling:

| Script | Purpose | Service Role Usage |
|--------|---------|-------------------|
| `scripts/migrate-teams-data.js` | Teams migration from FileMaker | Line 40, 83 |
| `requirements/notes/migration-plan.md` (transform script) | Notes data transformation | Line 601 |
| `requirements/notes/migration-plan.md` (load script) | Notes bulk insert | Line 737 |
| `scripts/validate-teams-migration.js` | Post-migration validation | Uses service role key |
| `scripts/test-teams-integration.js` | Integration testing | Uses service role key |

---

## Security Requirements

### 1. Environment Restrictions

**MANDATORY:** Migration scripts MUST ONLY run in secure backend environments.

**✅ Allowed Environments:**
- Local development machines (secure workstations)
- Secure backend servers (SSH access only)
- CI/CD pipelines with secret management
- Database administration consoles

**❌ NEVER Run In:**
- Browser/frontend contexts
- Publicly accessible web servers
- Untrusted cloud environments
- Shared development servers
- Any environment where code is exposed to end users

### 2. Runtime Environment Detection

**REQUIREMENT:** All migration scripts MUST include browser detection to prevent accidental execution in frontend contexts.

**Implementation:**

Add this guard at the top of every migration script:

```javascript
// SECURITY: Prevent execution in browser contexts
if (typeof window !== 'undefined') {
  throw new Error(
    'SECURITY ERROR: Migration scripts cannot run in browser environments. ' +
    'Service role key exposure would grant unrestricted database access. ' +
    'Run this script in a secure backend environment only.'
  );
}

// SECURITY: Verify Node.js environment
if (typeof process === 'undefined' || !process.env) {
  throw new Error(
    'SECURITY ERROR: Migration scripts must run in Node.js environment with environment variables.'
  );
}
```

**Status:**
- ❌ `scripts/migrate-teams-data.js` - **MISSING** browser detection (Line 32-40)
- ❌ `requirements/notes/migration-plan.md` scripts - **NOT IMPLEMENTED** in documented scripts

### 3. Service Role Key Management

**REQUIREMENT:** Service role keys MUST be treated as critical secrets with the highest level of protection.

**Best Practices:**

1. **Never Hardcode Keys**
   ```javascript
   // ❌ WRONG - Hardcoded key
   const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

   // ✅ CORRECT - Environment variable
   const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

   if (!SUPABASE_SERVICE_ROLE_KEY) {
     throw new Error('VITE_SUPABASE_SERVICE_ROLE_KEY environment variable is required');
   }
   ```

2. **Verify Key Presence Before Use**
   ```javascript
   // SECURITY: Validate service role key exists
   if (!process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
     console.error('❌ SECURITY ERROR: VITE_SUPABASE_SERVICE_ROLE_KEY not found');
     console.error('   Migration scripts require service role key for database access.');
     console.error('   This key MUST be stored in .env file (not committed to git).');
     process.exit(1);
   }
   ```

3. **Rotate Keys After Migration**
   - Generate new service role key in Supabase dashboard
   - Update backend environment variables
   - Invalidate old key
   - Verify all services still functional

### 4. Git Security

**REQUIREMENT:** Service role keys MUST NEVER be committed to version control.

**Pre-Commit Checklist:**

```bash
# Check for hardcoded service role keys
grep -r "SUPABASE_SERVICE_ROLE_KEY" scripts/ requirements/ --include="*.js" --include="*.md"

# Verify .env is gitignored
grep "^\.env$" .gitignore

# Check for exposed keys in commit history (if suspicious)
git log -p -S "SUPABASE_SERVICE_ROLE_KEY" --all
```

**Git Protections:**

1. **`.gitignore` Requirements:**
   ```gitignore
   # Environment variables (NEVER COMMIT)
   .env
   .env.local
   .env.*.local

   # Migration data outputs (may contain sensitive data)
   migration-data/
   scripts/migration-data/

   # Test outputs
   validation-report*.txt
   ```

2. **Pre-Commit Hook** (recommended):
   ```bash
   #!/bin/bash
   # .git/hooks/pre-commit

   # Check for service role key patterns
   if git diff --cached | grep -i "service.*role.*key.*=.*ey[A-Za-z0-9]"; then
     echo "❌ ERROR: Service role key detected in commit!"
     echo "   Remove hardcoded keys before committing."
     exit 1
   fi

   exit 0
   ```

### 5. Migration Data Security

**REQUIREMENT:** Migration output files MUST be excluded from version control.

**Protected Directories:**
- `migration-data/` - Contains exported FileMaker data
- `scripts/migration-data/` - Contains transformation outputs
- `validation-report*.txt` - May contain sensitive data samples

**`.gitignore` Entry:**
```gitignore
# Migration outputs (may contain PII and business data)
migration-data/
scripts/migration-data/
validation-report*.txt
*-export.json
*-transformed.json
*-load-result.json
```

**Current Status:**
- ⚠️ `requirements/notes/migration-plan.md` references `migration-data/` directory (Line 79, 102, 159)
- ⚠️ Scripts may generate sensitive output files
- ✅ Verify `.gitignore` includes migration data patterns

### 6. Key Rotation Protocol

**REQUIREMENT:** Service role keys SHOULD be rotated after major migrations.

**Post-Migration Key Rotation Steps:**

1. **Verify Migration Success**
   - All data migrated successfully
   - Validation checks passed
   - Frontend operational with new backend

2. **Generate New Service Role Key**
   ```bash
   # In Supabase Dashboard:
   # Settings → API → Service Role Key → Generate New Key
   ```

3. **Update Backend Environment**
   ```bash
   # SSH to backend server
   ssh marcus@backend.claritybusinesssolutions.ca

   # Update .env file (backend)
   nano /path/to/backend/.env
   # Replace VITE_SUPABASE_SERVICE_ROLE_KEY value

   # Restart services
   docker-compose restart
   ```

4. **Update Local Development**
   ```bash
   # Update local .env (NOT committed)
   nano .env
   # Replace VITE_SUPABASE_SERVICE_ROLE_KEY value
   ```

5. **Invalidate Old Key**
   - Supabase Dashboard → Revoke old service role key
   - Verify no services break (monitor logs for 24 hours)

6. **Document Rotation**
   ```bash
   # Add entry to changelog
   echo "$(date): Service role key rotated post-migration" >> SECURITY_CHANGELOG.md
   ```

**Rotation Frequency:**
- **After major migrations:** REQUIRED
- **Quarterly:** RECOMMENDED
- **After security incidents:** IMMEDIATELY
- **After team member departures:** RECOMMENDED

---

## Alternative Migration Approaches

### Option 1: Backend API Migration (Recommended)

Instead of client-side scripts with service role keys, perform migrations via backend API:

**Advantages:**
- ✅ Service role key stays on backend server
- ✅ No risk of frontend exposure
- ✅ Centralized logging and monitoring
- ✅ Can enforce rate limiting and backoff
- ✅ Better error handling and retry logic

**Implementation:**

```javascript
// Backend API endpoint (Python example)
@router.post("/admin/migrate-notes")
async def migrate_notes(
    request: Request,
    admin_user: User = Depends(require_admin)  # Admin-only endpoint
):
    """
    Server-side migration endpoint - service role key never leaves backend.
    """
    supabase_admin = create_supabase_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_ROLE_KEY  # Backend env var
    )

    # Fetch from FileMaker, transform, insert to Supabase
    # All operations server-side

    return {"status": "success", "migrated": count}
```

**Frontend Trigger:**

```javascript
// Frontend calls admin endpoint (HMAC authenticated)
const response = await fetch('/api/admin/migrate-notes', {
  method: 'POST',
  headers: {
    'Authorization': generateBackendAuthHeader(),
    'Content-Type': 'application/json'
  }
});
```

### Option 2: Database Webhooks (For Real-Time Migrations)

Use Supabase database webhooks to trigger backend migrations:

```sql
-- Trigger on new organization creation
CREATE TRIGGER migrate_org_data_trigger
AFTER INSERT ON organizations
FOR EACH ROW
EXECUTE FUNCTION notify_migration_webhook(NEW.id);
```

Backend webhook handler performs migration with service role key on server.

### Option 3: Separate Migration Service

Create dedicated migration service with service role key access:

```bash
# Migration service (Docker container)
# - Has service role key in secure environment
# - Runs migrations via admin API calls
# - No frontend exposure
# - Deployed separately from main application
```

---

## Documentation Updates Required

### 1. Script Header Comments

**REQUIREMENT:** Every migration script MUST include security warnings in header comments.

**Template:**

```javascript
/**
 * [Script Name] - [Purpose]
 *
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
 *
 * Prerequisites:
 * - Backend team must have deployed schema
 * - Service role key must be in .env (NOT committed)
 * - Migration must run in Node.js environment (not browser)
 *
 * Usage:
 *   node scripts/[script-name].js <args>
 *
 * For more information, see: docs/MIGRATION_SCRIPTS_SECURITY.md
 */
```

**Status:**
- ⚠️ `scripts/migrate-teams-data.js` - Has some warnings but **MISSING** comprehensive security header
- ❌ `requirements/notes/migration-plan.md` - Scripts documented without security warnings

### 2. Migration Plan Documentation

**REQUIREMENT:** All migration plan documents MUST include security sections.

**Required Sections:**

1. **Security Considerations**
   - Service role key handling
   - Environment restrictions
   - Key rotation procedures

2. **Pre-Migration Security Checklist**
   - [ ] Service role key stored in backend .env only
   - [ ] Scripts include browser detection guards
   - [ ] `.gitignore` includes migration-data/ directory
   - [ ] Migration will run in secure backend environment
   - [ ] Post-migration key rotation scheduled

3. **Post-Migration Security Tasks**
   - [ ] Rotate service role key
   - [ ] Verify no keys in git history
   - [ ] Delete migration data outputs
   - [ ] Review access logs for anomalies

**Documents to Update:**
- ⚠️ `requirements/notes/migration-plan.md` - **MISSING** security section
- ⚠️ `requirements/teams/migration-plan.md` - Review security warnings
- ⚠️ `scripts/README.md` - Add security best practices section

### 3. README Updates

**REQUIREMENT:** `scripts/README.md` MUST include security warnings.

**Add Section:**

```markdown
## 🔒 Security Best Practices

### Service Role Key Protection

Migration scripts use `VITE_SUPABASE_SERVICE_ROLE_KEY` which grants unrestricted
database access. Follow these critical security practices:

1. **Never commit service role keys to git**
   - Always use `.env` file (excluded from git)
   - Never hardcode keys in scripts
   - Check git history if suspicious

2. **Only run migrations in secure environments**
   - ✅ Local development machines (via SSH)
   - ✅ Backend servers (SSH access only)
   - ✅ CI/CD pipelines with secret management
   - ❌ NEVER in browser or frontend contexts

3. **Rotate keys after major migrations**
   - Generate new service role key in Supabase dashboard
   - Update backend and local `.env` files
   - Invalidate old key

4. **Protect migration output files**
   - Add `migration-data/` to `.gitignore`
   - Delete outputs after validation completes
   - Do not share outputs containing production data

For detailed security requirements, see: `docs/MIGRATION_SCRIPTS_SECURITY.md`
```

---

## Implementation Checklist

### Immediate Actions (High Priority)

- [ ] **Create this security documentation** (`docs/MIGRATION_SCRIPTS_SECURITY.md`)
- [ ] **Add browser detection guards** to all migration scripts
- [ ] **Update script headers** with comprehensive security warnings
- [ ] **Verify `.gitignore`** includes all migration output directories
- [ ] **Audit git history** for accidentally committed keys (if applicable)
- [ ] **Update `scripts/README.md`** with security best practices section

### Documentation Updates (Medium Priority)

- [ ] **Add security sections** to `requirements/notes/migration-plan.md`
- [ ] **Add security sections** to `requirements/teams/migration-plan.md`
- [ ] **Update `CLAUDE.md`** with link to this security guide
- [ ] **Create pre-commit hook** to detect service role key patterns
- [ ] **Document key rotation procedures** in runbooks

### Long-Term Improvements (Low Priority)

- [ ] **Migrate to backend API approach** for future migrations
- [ ] **Implement database webhooks** for automated migrations
- [ ] **Create dedicated migration service** with isolated key access
- [ ] **Set up key rotation reminders** (quarterly)
- [ ] **Add automated key scanning** to CI/CD pipeline

---

## Security Incident Response

### If Service Role Key is Exposed

**IMMEDIATE ACTIONS (Within 1 Hour):**

1. **Rotate Service Role Key Immediately**
   ```bash
   # Supabase Dashboard → Settings → API → Generate New Service Role Key
   ```

2. **Invalidate Compromised Key**
   - Revoke old key in Supabase dashboard
   - Verify key is disabled

3. **Update All Environments**
   - Backend production: Update `.env` and restart services
   - Local development: Update local `.env` files
   - CI/CD: Update secret management system

4. **Audit Database Access Logs**
   ```bash
   # Check for unauthorized access patterns
   ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT * FROM auth.audit_log_entries WHERE created_at > NOW() - INTERVAL '24 hours' ORDER BY created_at DESC;\""
   ```

5. **Notify Security Team**
   - Document incident details
   - Assess potential data exposure
   - Determine if user notification required

**FOLLOW-UP ACTIONS (Within 24 Hours):**

1. **Review All Data Access**
   - Identify any unauthorized queries
   - Check for data exfiltration patterns
   - Verify data integrity

2. **Search Git History for Key**
   ```bash
   git log -p -S "SUPABASE_SERVICE_ROLE_KEY" --all
   # If found, rewrite history (coordinate with team)
   ```

3. **Update Security Procedures**
   - Document lessons learned
   - Implement additional safeguards
   - Train team on secure key handling

4. **Monitor for Anomalies**
   - Increased database queries
   - Unusual data access patterns
   - Failed authentication attempts

---

## References

### Internal Documentation

- **CLAUDE.md** - Project security guidelines (lines 87-106)
- **scripts/README.md** - Migration script usage (lines 142-160)
- **scripts/migrate-teams-data.js** - Team migration implementation (line 40, 83)
- **requirements/notes/migration-plan.md** - Notes migration scripts (lines 601, 737)
- **requirements/notes/authorization.md** - Service role vs anon key (lines 512-590)

### External Resources

- **Supabase RLS Documentation:** https://supabase.com/docs/guides/auth/row-level-security
- **Supabase Service Role Key Best Practices:** https://supabase.com/docs/guides/api/api-keys
- **OWASP Secrets Management:** https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password

---

## Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-16 | Security Review | Initial comprehensive security guide created |

---

## Contact

For security concerns or questions about migration script security:

1. **Review this document thoroughly**
2. **Check related documentation** (CLAUDE.md, scripts/README.md)
3. **Contact development team** if clarification needed
4. **Report security incidents immediately** to security team

**Remember:** Service role keys are the "master keys" to your database. Handle them with extreme care.
