# FileMaker Removal Rollout Plan
# Safe Deployment Strategy

**Created:** 2026-01-10
**Purpose:** Define safe deployment strategy for FileMaker removal including feature flags, gradual rollout, rollback procedures, monitoring requirements, and user communication
**Status:** Phase 1 Requirements Document

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Deployment Strategy Overview](#deployment-strategy-overview)
3. [Feature Flag Implementation](#feature-flag-implementation)
4. [Gradual Rollout Approach](#gradual-rollout-approach)
5. [Rollback Plan](#rollback-plan)
6. [Monitoring and Observability](#monitoring-and-observability)
7. [User Communication Strategy](#user-communication-strategy)
8. [Deployment Phases](#deployment-phases)
9. [Risk Mitigation](#risk-mitigation)
10. [Deployment Checklist](#deployment-checklist)
11. [Post-Deployment Actions](#post-deployment-actions)

---

## Executive Summary

### Rollout Philosophy

**Clean Break Approach:** FileMaker removal is a fundamental architectural change that eliminates dual-environment support. This migration uses a **big bang deployment** with comprehensive **rollback capabilities** rather than gradual feature flags, because:

1. **Environment detection is binary** - The app is either FileMaker-aware or not
2. **Dual maintenance is costly** - Running both paths simultaneously doubles complexity
3. **Backend synchronization required** - Frontend and backend must be aligned
4. **Limited user base** - Internal CRM with known, manageable user count
5. **Controlled deployment window** - Can schedule during low-usage periods

### Key Principles

- **Backend-first deployment** - Backend changes must be verified before frontend
- **Comprehensive testing** - All acceptance criteria must pass before deployment
- **Fast rollback capability** - Ability to revert in <5 minutes if critical issues arise
- **Intensive monitoring** - Real-time error tracking during initial deployment hours
- **Clear communication** - All users informed before, during, and after deployment
- **Staged verification** - Progressive user testing before full rollout

### Success Criteria

- ✅ All users authenticate successfully via Supabase
- ✅ All CRUD operations work via Backend API
- ✅ Zero FileMaker-related errors in production
- ✅ Application load time improves by ≥60%
- ✅ No critical bugs within first 48 hours
- ✅ User satisfaction maintained or improved

---

## Deployment Strategy Overview

### Deployment Model: Controlled Big Bang

**Why Not Gradual Feature Flags:**

The nature of this change makes gradual rollout impractical:

```
❌ Cannot gradually migrate environment detection
   - window.FileMaker check is binary (exists or doesn't)
   - 3-second polling would remain for all users

❌ Cannot gradually migrate authentication
   - AUTH_METHODS.FILEMAKER vs Supabase is mutually exclusive
   - Dual auth paths increase complexity and attack surface

❌ Cannot gradually migrate data routing
   - Axios interceptors route ALL requests (not per-feature)
   - FileMaker endpoints and Backend API endpoints have different contracts

❌ Backend must migrate atomically
   - Cannot maintain FileMaker + Supabase sync indefinitely
   - Backend API endpoints either query FileMaker OR Supabase, not both
```

**Why Controlled Big Bang Works:**

```
✅ Limited user base (internal CRM)
   - Known users (~10-50 active users)
   - Direct communication channel

✅ Controlled deployment window
   - Deploy during off-hours or weekends
   - Users can be notified and trained in advance

✅ Comprehensive testing
   - All acceptance criteria verified before deployment
   - Staging environment testing completed

✅ Fast rollback capability
   - Git tag + force push can revert in <5 minutes
   - Backend can revert endpoints independently

✅ Immediate value
   - 60%+ performance improvement for all users
   - Simplified architecture for all future development
```

### Deployment Timeline

**Total Rollout Duration:** 7 days (from first deployment to full confidence)

| Phase | Duration | Description |
|-------|----------|-------------|
| Pre-Deployment | 2 days | Backend verification, staging tests, user notification |
| Initial Deployment | 1 day | Deploy to production during low-usage window |
| Intensive Monitoring | 2 days | Real-time error monitoring, rapid response to issues |
| Stabilization | 2 days | Performance verification, user feedback collection |
| Confidence Declaration | Day 7 | Migration declared successful or rolled back |

---

## Feature Flag Implementation

### Why Feature Flags Are Not Used for Core Migration

As explained above, the binary nature of environment detection makes feature flags impractical for the core migration. However, **feature flags CAN be used for optional enhancements** that accompany the migration.

### Optional Feature Flags (for enhancement features only)

If new features are being added alongside FileMaker removal, use feature flags for those:

**Implementation Location:** `src/config/featureFlags.js`

```javascript
// src/config/featureFlags.js
export const FEATURE_FLAGS = {
  // Not applicable to core migration (must be all-or-nothing)
  ENABLE_SUPABASE_AUTH: true,  // ❌ Cannot be toggled - always true after migration
  DISABLE_FILEMAKER: true,      // ❌ Cannot be toggled - always true after migration

  // CAN be used for new features introduced with migration
  ENABLE_IMPROVED_DASHBOARD: false,    // ✅ New performance-optimized dashboard
  ENABLE_REALTIME_SYNC: false,         // ✅ New Supabase realtime features
  ENABLE_ADVANCED_SEARCH: false,       // ✅ New search powered by Supabase full-text
};

// Get flag value (with override from localStorage for testing)
export function getFeatureFlag(flagName) {
  // Allow override via localStorage for testing
  const override = localStorage.getItem(`feature_${flagName}`);
  if (override !== null) {
    return override === 'true';
  }

  return FEATURE_FLAGS[flagName] ?? false;
}

// Enable/disable flag (for testing only)
export function setFeatureFlag(flagName, enabled) {
  localStorage.setItem(`feature_${flagName}`, enabled.toString());
  console.log(`Feature flag ${flagName} set to ${enabled}`);
}
```

**Usage in Components:**

```javascript
import { getFeatureFlag } from '../config/featureFlags';

function Dashboard() {
  const useImprovedDashboard = getFeatureFlag('ENABLE_IMPROVED_DASHBOARD');

  return useImprovedDashboard ? <ImprovedDashboard /> : <LegacyDashboard />;
}
```

### Testing Feature Flags Locally

```javascript
// In browser console - enable feature for testing
setFeatureFlag('ENABLE_IMPROVED_DASHBOARD', true);

// Disable feature
setFeatureFlag('ENABLE_IMPROVED_DASHBOARD', false);

// Clear all overrides
localStorage.clear();
```

### Deployment Strategy for Optional Features

**Week 1:** Deploy core migration (no optional features enabled)
**Week 2:** Enable `ENABLE_IMPROVED_DASHBOARD` for testing
**Week 3:** Enable `ENABLE_REALTIME_SYNC` after dashboard stabilizes
**Week 4:** Enable `ENABLE_ADVANCED_SEARCH` after realtime sync stabilizes

**Note:** Core FileMaker removal is NOT behind a feature flag and deploys atomically.

---

## Gradual Rollout Approach

Since the core migration is a big bang deployment, "gradual rollout" refers to **progressive user verification** rather than gradual feature enablement.

### Rollout Stages

#### Stage 1: Internal Developer Testing (Pre-Deployment)

**Timeline:** 2 days before production deployment
**Participants:** Frontend developers (2-3 people)
**Environment:** Staging environment with production data snapshot

**Objectives:**
- Verify all acceptance criteria pass on staging
- Test authentication flows extensively
- Test all CRUD operations for all entities
- Verify no FileMaker-related errors
- Measure performance improvements

**Go/No-Go Criteria:**
- [ ] All acceptance criteria pass (38/40 minimum)
- [ ] Zero critical bugs found
- [ ] Authentication works flawlessly
- [ ] All workflows complete successfully
- [ ] Performance improvements verified (≥60% load time reduction)

**Rollout Decision:** If all criteria pass → Proceed to Stage 2

---

#### Stage 2: Backend Verification (Pre-Deployment)

**Timeline:** 1 day before production deployment
**Participants:** Backend team + DevOps
**Environment:** Production backend

**Objectives:**
- Deploy backend changes to production
- Verify `/filemaker/devCustomers/records` queries Supabase
- Verify `/filemaker/devProjects/records` queries Supabase
- Verify all layout endpoints return data from Supabase
- Verify HMAC authentication works correctly
- Verify response format matches expected structure

**Verification Commands:**

```bash
# Test customers endpoint (requires valid HMAC)
curl -X GET https://api.claritybusinesssolutions.ca/filemaker/devCustomers/records \
  -H "Authorization: Bearer {hmac}.{timestamp}" \
  -v

# Expected: 200 OK, returns customers from Supabase

# Test projects endpoint
curl -X GET https://api.claritybusinesssolutions.ca/filemaker/devProjects/records \
  -H "Authorization: Bearer {hmac}.{timestamp}" \
  -v

# Expected: 200 OK, returns projects from Supabase

# Test tasks endpoint
curl -X GET https://api.claritybusinesssolutions.ca/filemaker/devTasks/records \
  -H "Authorization: Bearer {hmac}.{timestamp}" \
  -v

# Expected: 200 OK, returns tasks from Supabase
```

**Go/No-Go Criteria:**
- [ ] All backend endpoints query Supabase (verified via backend logs)
- [ ] Response format matches FileMaker-compatible structure
- [ ] HMAC authentication works
- [ ] No errors in backend logs
- [ ] Performance acceptable (response times ≤500ms)

**Rollout Decision:** If all criteria pass → Proceed to Stage 3

**⚠️ CRITICAL:** Do not deploy frontend until backend verification passes

---

#### Stage 3: Initial Production Deployment

**Timeline:** Day 1 of rollout
**Participants:** All users (big bang deployment)
**Environment:** Production
**Deployment Window:** Saturday 8:00 AM - 12:00 PM (low-usage period)

**Pre-Deployment Actions:**

1. **Send User Notification** (Friday 5:00 PM)
   - Email all users about upcoming deployment
   - Explain changes (faster load times, no functionality changes)
   - Provide deployment window and expected downtime (if any)
   - Include rollback plan if issues occur

2. **Tag Current Production State**
   ```bash
   git checkout main
   git tag pre-filemaker-removal-production
   git push origin pre-filemaker-removal-production
   ```

3. **Create Deployment Branch**
   ```bash
   git checkout -b deploy/remove-filemaker-integration
   git merge feature/remove-filemaker-integration
   git push origin deploy/remove-filemaker-integration
   ```

**Deployment Steps:**

```bash
# 1. Build production bundle
npm run build

# 2. Verify build succeeded
ls -la dist/

# 3. Deploy to production (method depends on hosting)
# Option A: Upload to server
npm run upload

# Option B: Deploy via CI/CD
git push origin deploy/remove-filemaker-integration --force

# 4. Verify deployment
curl https://claritybusinesssolutions.ca
# Expected: Returns index.html

# 5. Clear CDN cache (if applicable)
# Method varies by CDN provider
```

**Immediate Post-Deployment Verification (First 15 minutes):**

1. **Load Application**
   - Open https://claritybusinesssolutions.ca
   - Verify sign-in page loads immediately (no 3-second delay)
   - Check browser console for errors

2. **Test Authentication**
   - Sign in with valid credentials
   - Verify successful authentication
   - Verify redirect to main app

3. **Test Core CRUD Operations**
   - Load customers list
   - Click on a customer
   - Create a new project
   - Create a task
   - Start/stop timer

4. **Monitor Error Logs**
   - Check browser console (should be clean)
   - Check backend logs for errors
   - Check Supabase logs for connection issues

**Go/No-Go Criteria (15-minute checkpoint):**
- [ ] Application loads successfully
- [ ] Authentication works
- [ ] Core CRUD operations work
- [ ] No critical errors in console or logs
- [ ] No user reports of blocking issues

**Rollout Decision:**
- ✅ If all criteria pass → Continue to intensive monitoring (Stage 4)
- ❌ If critical issues → Execute immediate rollback (see [Rollback Plan](#rollback-plan))

---

#### Stage 4: Intensive Monitoring Period

**Timeline:** Days 1-2 (48 hours)
**Participants:** Development team on-call
**Environment:** Production

**Monitoring Objectives:**
- Detect errors immediately
- Respond to user issues within 15 minutes
- Collect performance metrics
- Identify edge cases or bugs

**Monitoring Schedule:**

| Time Period | On-Call Engineer | Monitoring Frequency |
|-------------|-----------------|---------------------|
| Day 1: 8:00 AM - 8:00 PM | Engineer A | Every 15 minutes |
| Day 1: 8:00 PM - 8:00 AM | Engineer B (passive) | If alerts triggered |
| Day 2: 8:00 AM - 8:00 PM | Engineer B | Every 30 minutes |
| Day 2: 8:00 PM - 8:00 AM | Engineer A (passive) | If alerts triggered |

**Monitoring Checklist (Every Check):**

```bash
# 1. Check application health
curl https://claritybusinesssolutions.ca
# Expected: 200 OK

# 2. Check for JavaScript errors (via monitoring tool or manual)
# - Open app in browser
# - Check console for errors
# - Verify no red errors

# 3. Check backend logs
ssh marcus@backend.claritybusinesssolutions.ca "docker logs --tail 50 clarity_backend_api"
# Look for: errors, failed requests, timeouts

# 4. Check Supabase connection
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c 'SELECT COUNT(*) FROM customers;'"
# Expected: Returns count (verifies Supabase is accessible)

# 5. Test sample operations
# - Sign in
# - Load customers
# - Create a test record
# - Delete the test record
```

**Issue Response Protocol:**

| Severity | Response Time | Action |
|----------|--------------|--------|
| **Critical** (app down, auth broken) | 5 minutes | Investigate + consider rollback |
| **High** (feature broken, data loss risk) | 15 minutes | Investigate + hotfix or rollback |
| **Medium** (minor bug, workaround exists) | 1 hour | Log issue, plan hotfix |
| **Low** (cosmetic, performance) | 4 hours | Log issue, plan fix for next release |

**Rollout Decision (Day 2 at 8:00 PM):**
- ✅ If no critical or high-severity issues → Proceed to stabilization (Stage 5)
- ⚠️ If 1-2 medium issues → Continue monitoring, plan hotfixes
- ❌ If critical issues persist → Execute rollback

---

#### Stage 5: Stabilization Period

**Timeline:** Days 3-4 (48 hours)
**Participants:** Development team (normal hours)
**Environment:** Production

**Objectives:**
- Reduce monitoring frequency
- Collect user feedback
- Measure performance improvements
- Plan hotfixes for non-critical issues

**Monitoring Frequency:** Twice per day (9:00 AM, 5:00 PM)

**User Feedback Collection:**

Send survey to all users (Day 3 at 9:00 AM):

**Survey Questions:**
1. Have you experienced any issues since the update? (Yes/No)
2. If yes, please describe the issue.
3. Is the application noticeably faster? (Yes/No/Same)
4. Are you satisfied with the update? (1-5 scale)
5. Any additional comments?

**Performance Metrics Collection:**

| Metric | Baseline (Pre-Migration) | Target | Actual |
|--------|-------------------------|--------|--------|
| Initial load time | 4500ms | ≤1500ms | _______ |
| Time to sign-in form | 3500ms | ≤500ms | _______ |
| Authentication time | 1500ms | ≤1500ms | _______ |
| Customer list load | 800ms | ≤800ms | _______ |
| Project detail load | 600ms | ≤600ms | _______ |
| Bundle size | 520KB | ≤450KB | _______ |

**Go/No-Go Criteria (Day 4 at 5:00 PM):**
- [ ] No critical or high-severity issues
- [ ] User satisfaction ≥80% positive
- [ ] Performance improvements verified
- [ ] All core workflows working

**Rollout Decision:**
- ✅ If all criteria pass → Proceed to confidence declaration (Stage 6)
- ⚠️ If minor issues → Continue monitoring, extend stabilization
- ❌ If significant issues → Evaluate rollback vs hotfix

---

#### Stage 6: Confidence Declaration

**Timeline:** Day 7
**Participants:** Tech lead, product owner, backend lead
**Environment:** Production

**Final Verification:**

**Code Verification:**
```bash
# Run acceptance criteria verification script
cd /path/to/project
./verify-filemaker-removal.sh

# Expected: All checks pass
```

**Functional Verification:**
- [ ] All authentication flows work
- [ ] All CRUD operations work for all entities
- [ ] All complex workflows work (Customer → Project → Task → Timer)
- [ ] No FileMaker-related console errors
- [ ] Build succeeds without FileMaker warnings

**Performance Verification:**
- [ ] Initial load time ≥60% faster
- [ ] Bundle size reduced ≥10%
- [ ] API response times acceptable

**User Feedback Summary:**
- [ ] ≥80% user satisfaction
- [ ] ≤5% users reporting issues
- [ ] All reported issues have workarounds or fixes

**Stakeholder Sign-off:**

**Migration Success Declaration:**

Date: _____________

✅ Migration successful - All criteria met
⚠️ Partial success - Minor issues remain (document)
❌ Migration failed - Rollback required

**Signatures:**
- Technical Lead: __________________ Date: __________
- Product Owner: __________________ Date: __________
- Backend Lead: ___________________ Date: __________

**If Successful:**
- Update CLAUDE.md to remove all FileMaker references
- Update README.md
- Create MIGRATION_COMPLETE.md document
- Close migration project
- Celebrate! 🎉

**If Issues Remain:**
- Document outstanding issues
- Create hotfix plan
- Set deadline for resolution
- Re-verify in 7 days

---

## Rollback Plan

### Rollback Decision Criteria

**Execute rollback immediately if:**

- ✅ Application is completely down and users cannot access it
- ✅ Authentication is completely broken (no users can sign in)
- ✅ Data loss or data corruption occurs
- ✅ Security vulnerability is discovered
- ✅ Critical business operations are blocked (e.g., time tracking, invoicing)

**Evaluate rollback vs hotfix if:**

- ⚠️ Specific feature is broken but workaround exists
- ⚠️ Performance is worse than expected but acceptable
- ⚠️ Some users experiencing issues but not all
- ⚠️ Non-critical bugs affecting user experience

**Do NOT rollback if:**

- ❌ Minor UI issues
- ❌ Cosmetic bugs
- ❌ Performance is better but users adjusting to changes
- ❌ Small subset of users confused by changes (training issue)

### Rollback Procedures

#### Option 1: Frontend-Only Rollback (Fast - 5 minutes)

Use this if backend is working correctly but frontend has issues.

**Steps:**

```bash
# 1. SSH to deployment server (if applicable)
ssh user@deployment-server.com

# 2. Revert to previous deployment tag
git checkout pre-filemaker-removal-production
git push --force origin main  # ⚠️ Only if safe

# 3. Rebuild and redeploy
npm run build
npm run upload

# 4. Clear CDN cache (if applicable)
# Method varies by CDN

# 5. Verify rollback
curl https://claritybusinesssolutions.ca
# Expected: Returns old version (with FileMaker support)

# 6. Test authentication
# - Sign in with credentials
# - Verify FileMaker detection appears (3-second delay)
# - Verify core operations work
```

**Expected Downtime:** 5-10 minutes

**Verification:**
- [ ] Application loads with FileMaker detection
- [ ] Authentication works (both FileMaker and Supabase paths)
- [ ] Core CRUD operations work
- [ ] Users can continue working

---

#### Option 2: Backend Rollback (If backend changes need reverting)

Use this if backend changes caused issues.

**Steps:**

```bash
# 1. SSH to backend server
ssh marcus@backend.claritybusinesssolutions.ca

# 2. Revert backend deployment
# (Exact steps depend on backend deployment method)

# Option A: Docker container rollback
docker stop clarity_backend_api
docker run -d --name clarity_backend_api clarity_backend:pre-filemaker-removal

# Option B: Git-based rollback
cd /path/to/backend
git checkout pre-filemaker-removal-backend
docker-compose restart

# 3. Verify backend reverted
curl https://api.claritybusinesssolutions.ca/filemaker/devCustomers/records
# Expected: Queries FileMaker again (not Supabase)

# 4. Verify frontend still works
curl https://claritybusinesssolutions.ca
# Expected: Returns index.html

# 5. Test end-to-end
# - Sign in
# - Load customers (should come from FileMaker)
# - Verify data displays correctly
```

**Expected Downtime:** 10-15 minutes

**Verification:**
- [ ] Backend API queries FileMaker
- [ ] Frontend routes requests to FileMaker endpoints
- [ ] Data loads correctly
- [ ] No errors in logs

---

#### Option 3: Full Rollback (Frontend + Backend)

Use this if both frontend and backend need reverting.

**Steps:**

```bash
# 1. Rollback backend first (see Option 2)

# 2. Rollback frontend (see Option 1)

# 3. Verify end-to-end functionality
# - Sign in works
# - FileMaker detection appears
# - Data loads from FileMaker
# - All operations work

# 4. Notify users
# - Send email explaining rollback
# - Provide timeline for re-attempting migration
```

**Expected Downtime:** 15-20 minutes

---

### Post-Rollback Actions

**Immediate (within 1 hour):**

1. **Notify Users**
   - Send email explaining rollback
   - Explain issue that caused rollback
   - Provide timeline for resolution
   - Apologize for inconvenience

2. **Create Incident Report**
   - Document issue that triggered rollback
   - List affected users
   - Document rollback steps taken
   - Estimate time to resolution

3. **Convene Engineering Team**
   - Review what went wrong
   - Identify root cause
   - Plan fix
   - Set timeline for re-attempting deployment

**Within 24 hours:**

1. **Root Cause Analysis**
   - Write detailed RCA document
   - Identify what was missed in testing
   - Update acceptance criteria to catch this issue
   - Update test plan

2. **Fix Development**
   - Develop fix for identified issue
   - Test fix in staging environment
   - Re-run all acceptance criteria
   - Verify fix resolves issue

3. **Re-Deployment Planning**
   - Set new deployment date (usually 7 days later)
   - Update rollout plan based on lessons learned
   - Communicate new timeline to users

**Within 7 days:**

1. **Re-Attempt Deployment**
   - Follow rollout plan again
   - Apply lessons learned
   - Extra scrutiny on area that caused previous failure

---

## Monitoring and Observability

### Monitoring Stack

**Required Tools:**

1. **Browser Console Monitoring**
   - Manual checks during intensive monitoring period
   - Automated error reporting (Sentry, LogRocket, or similar)

2. **Backend Logging**
   - Docker logs for `clarity_backend_api` container
   - Supabase logs for database queries
   - Error log aggregation (ELK stack, Datadog, or similar)

3. **Application Performance Monitoring (APM)**
   - Frontend performance metrics (page load time, time to interactive)
   - Backend API response times
   - Database query performance

4. **Uptime Monitoring**
   - External uptime monitor (Pingdom, UptimeRobot, or similar)
   - Alerts if site goes down

### Key Metrics to Monitor

#### Frontend Metrics

**Performance Metrics:**

| Metric | Baseline | Target | Alert Threshold |
|--------|----------|--------|----------------|
| Initial page load | 4500ms | ≤1500ms | >2000ms |
| Time to interactive | 5000ms | ≤2000ms | >3000ms |
| Sign-in form display | 3500ms | ≤500ms | >1000ms |
| Bundle size | 520KB | ≤450KB | >500KB |

**Error Metrics:**

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| JavaScript errors (per hour) | 0 | >5 errors/hour |
| Authentication failures | <1% | >5% |
| API request failures | <1% | >10% |
| CRUD operation failures | 0 | >3 failures/hour |

**User Metrics:**

| Metric | Baseline | Target | Alert Threshold |
|--------|----------|--------|----------------|
| Active users (per hour) | Baseline | Maintain | <50% of baseline |
| Session duration | Baseline | Maintain | <70% of baseline |
| Bounce rate | <5% | <5% | >15% |

---

#### Backend Metrics

**API Performance:**

| Endpoint | Baseline (FileMaker) | Target (Supabase) | Alert Threshold |
|----------|---------------------|------------------|----------------|
| GET /filemaker/devCustomers/records | 300ms | ≤400ms | >600ms |
| GET /filemaker/devProjects/records | 250ms | ≤350ms | >550ms |
| GET /filemaker/devTasks/records | 280ms | ≤380ms | >580ms |
| POST /filemaker/devCustomers/records | 250ms | ≤350ms | >550ms |
| PATCH /filemaker/devCustomers/records/{id} | 200ms | ≤300ms | >500ms |

**Error Rates:**

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| 4xx errors (per hour) | <10 | >50 |
| 5xx errors (per hour) | 0 | >3 |
| HMAC authentication failures | <1% | >5% |
| Database connection errors | 0 | >1 |
| Query timeouts | 0 | >3 per hour |

**Database Metrics:**

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| Supabase connection pool usage | <70% | >90% |
| Query execution time (avg) | <100ms | >300ms |
| Slow queries (>1s) | 0 | >5 per hour |
| Database CPU usage | <50% | >80% |
| Database memory usage | <70% | >90% |

---

### Alerting Configuration

**Critical Alerts (Page on-call engineer immediately):**

```yaml
alerts:
  - name: "Application Down"
    condition: "HTTP response code != 200 for 3 consecutive checks"
    action: "Page on-call engineer"

  - name: "Authentication Completely Broken"
    condition: "Authentication failure rate > 50% for 5 minutes"
    action: "Page on-call engineer"

  - name: "Database Connection Lost"
    condition: "Database connection errors > 5 in 1 minute"
    action: "Page on-call engineer"

  - name: "High Error Rate"
    condition: "JavaScript errors > 20 per minute OR 5xx errors > 10 per minute"
    action: "Page on-call engineer"
```

**High-Priority Alerts (Slack notification + email):**

```yaml
alerts:
  - name: "Performance Degradation"
    condition: "Page load time > 2000ms for 10 consecutive requests"
    action: "Slack + Email"

  - name: "Elevated Error Rate"
    condition: "JavaScript errors > 5 per hour OR API failures > 10%"
    action: "Slack + Email"

  - name: "Slow API Responses"
    condition: "API response time > 600ms for 10 consecutive requests"
    action: "Slack + Email"
```

**Medium-Priority Alerts (Slack notification):**

```yaml
alerts:
  - name: "Minor Performance Issue"
    condition: "Page load time > 1500ms but < 2000ms for 20 requests"
    action: "Slack"

  - name: "Occasional Errors"
    condition: "JavaScript errors > 3 per hour but < 5 per hour"
    action: "Slack"
```

---

### Monitoring Dashboard

**Create Real-Time Dashboard** (using Grafana, Datadog, or similar):

**Panel 1: Application Health**
- Green/Red indicator: "Application Up/Down"
- Current uptime percentage
- Response time graph (last 24 hours)

**Panel 2: Performance Metrics**
- Page load time (current vs target)
- API response times (avg, p95, p99)
- Bundle size comparison (pre vs post migration)

**Panel 3: Error Tracking**
- JavaScript errors (count per hour)
- API errors (4xx and 5xx counts)
- Authentication failures

**Panel 4: User Activity**
- Active users (current hour)
- Total sessions (last 24 hours)
- Session duration (avg)

**Panel 5: Backend Health**
- API endpoint response times
- Database query performance
- Supabase connection status

**Panel 6: Acceptance Criteria Status**
- Checklist of acceptance criteria
- Pass/fail indicators
- Overall completion percentage

**Dashboard Access:**
- URL: (internal monitoring dashboard)
- Access: All engineers, product owner, stakeholders

---

### Log Aggregation

**Centralize Logs from All Sources:**

**Frontend Logs:**
```javascript
// src/services/errorReportingService.js
export function reportError(error, context = {}) {
  console.error('[Frontend Error]:', error, context);

  // Send to error reporting service (Sentry, LogRocket, etc.)
  if (window.Sentry) {
    window.Sentry.captureException(error, {
      extra: context
    });
  }

  // Also send to backend for aggregation
  fetch('/api/log-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    })
  }).catch(err => console.error('Failed to send error to backend:', err));
}
```

**Backend Logs:**
```bash
# Real-time log monitoring
ssh marcus@backend.claritybusinesssolutions.ca "docker logs -f clarity_backend_api"

# Filter for errors only
ssh marcus@backend.claritybusinesssolutions.ca "docker logs clarity_backend_api | grep ERROR"

# Aggregate logs to file
ssh marcus@backend.claritybusinesssolutions.ca "docker logs clarity_backend_api > /tmp/backend-logs-$(date +%Y%m%d).log"
```

**Supabase Logs:**
```bash
# Check Supabase database logs
ssh marcus@backend.claritybusinesssolutions.ca "docker logs supabase-db"

# Check Supabase REST API logs
ssh marcus@backend.claritybusinesssolutions.ca "docker logs supabase-rest"
```

---

## User Communication Strategy

### Communication Timeline

| When | Channel | Audience | Purpose |
|------|---------|----------|---------|
| 2 days before | Email | All users | Announce upcoming deployment |
| 1 day before | Email + Slack | All users | Reminder + deployment window |
| Deployment day (start) | Email + Slack | All users | Deployment in progress |
| Deployment day (complete) | Email + Slack | All users | Deployment complete + what to expect |
| Day 3 | Email + Survey | All users | Feedback collection |
| Day 7 | Email | All users | Success declaration + thank you |

---

### Pre-Deployment Communication

#### Email Template: Announcement (2 Days Before)

**Subject:** Upcoming CRM Upgrade - Faster Performance Coming Soon

**Body:**

```
Hi Team,

We're excited to announce an upcoming upgrade to the Clarity CRM that will significantly improve performance and user experience.

WHAT'S CHANGING:
- Faster application load times (60%+ improvement)
- Streamlined authentication (no more 3-second delay)
- Improved reliability and stability
- Simplified architecture for faster future updates

WHEN:
Saturday, January 12, 2026
8:00 AM - 12:00 PM PST

WILL I NOTICE ANY CHANGES?
The application will look and work exactly the same, but you'll notice:
- Much faster initial load
- Snappier response times
- Immediate sign-in form (no waiting)

WILL THERE BE DOWNTIME?
We expect minimal to no downtime. The application should remain accessible throughout the upgrade. However, we recommend saving your work before the deployment window as a precaution.

WHAT DO I NEED TO DO?
Nothing! The upgrade is automatic. Just use the CRM as you normally would.

If you experience any issues after the upgrade, please report them immediately to:
- Email: dev-team@claritybusinesssolutions.ca
- Slack: #crm-support

Thank you for your patience as we improve the Clarity CRM!

Best regards,
The Clarity Development Team
```

---

#### Email Template: Reminder (1 Day Before)

**Subject:** REMINDER: CRM Upgrade Tomorrow Morning

**Body:**

```
Hi Team,

Quick reminder that the Clarity CRM upgrade is happening tomorrow morning:

WHEN: Saturday, January 12, 2026, 8:00 AM - 12:00 PM PST

WHAT TO EXPECT:
- The application will remain accessible
- You may notice faster load times immediately
- Everything will look and work the same

PRECAUTION:
Please save any in-progress work before 8:00 AM tomorrow.

NEED HELP?
If you experience any issues, contact us immediately:
- Email: dev-team@claritybusinesssolutions.ca
- Slack: #crm-support
- Emergency: [on-call phone number]

Thank you!
The Clarity Development Team
```

---

### During Deployment Communication

#### Email Template: Deployment In Progress

**Subject:** CRM Upgrade In Progress

**Body:**

```
Hi Team,

The Clarity CRM upgrade is currently in progress. You may notice:
- Brief page reloads
- Slightly different initial load behavior
- Faster performance (this is expected!)

The application should remain fully accessible. If you experience any issues, please report them immediately.

Status updates will be posted to #crm-support.

Thank you!
The Clarity Development Team
```

---

#### Email Template: Deployment Complete

**Subject:** CRM Upgrade Complete - Enjoy the Speed!

**Body:**

```
Hi Team,

Great news! The Clarity CRM upgrade is complete and deployed successfully.

WHAT'S NEW:
✅ 60% faster load times
✅ Immediate sign-in (no more 3-second delay)
✅ Improved performance across all features
✅ More reliable data access

WHAT'S THE SAME:
- All your data (customers, projects, tasks, etc.)
- All features and workflows
- The user interface and layout

NEXT STEPS:
1. Clear your browser cache if you notice any oddities (Ctrl+Shift+R or Cmd+Shift+R)
2. Sign in as usual
3. Enjoy the improved performance!

FEEDBACK REQUESTED:
Over the next few days, we'll be monitoring performance closely. If you notice:
- Any errors or issues
- Features not working as expected
- Performance problems
- Anything unusual

Please report immediately to:
- Email: dev-team@claritybusinesssolutions.ca
- Slack: #crm-support

You'll receive a short survey in 2-3 days to share your feedback.

Thank you for your patience!
The Clarity Development Team
```

---

### Post-Deployment Communication

#### Email Template: Feedback Request (Day 3)

**Subject:** CRM Upgrade Feedback - How's It Going?

**Body:**

```
Hi Team,

It's been a few days since the CRM upgrade. We'd love to hear your feedback!

Please take 2 minutes to complete this short survey:
[Survey Link]

QUESTIONS:
1. Have you experienced any issues since the update?
2. Is the application noticeably faster?
3. Are you satisfied with the update?
4. Any additional comments?

Your feedback helps us ensure the upgrade was successful and identify any issues we may have missed.

Thank you!
The Clarity Development Team
```

---

#### Email Template: Success Declaration (Day 7)

**Subject:** CRM Upgrade Success - Thank You!

**Body:**

```
Hi Team,

We're happy to report that the Clarity CRM upgrade has been a complete success!

RESULTS:
✅ 65% improvement in load times (exceeded our 60% target)
✅ Zero critical issues reported
✅ 95% user satisfaction rate
✅ Significant reduction in application complexity

PERFORMANCE IMPROVEMENTS:
- Initial load: Was 4500ms → Now 1400ms (69% faster)
- Sign-in form: Was 3500ms → Now 450ms (87% faster)
- Bundle size: Was 520KB → Now 430KB (17% smaller)

THANK YOU:
Thank you for your patience during the upgrade and for providing valuable feedback. Your input helped us verify the success of this migration.

MOVING FORWARD:
This upgrade lays the foundation for faster feature development and improved reliability. Expect more improvements in the coming months!

If you have any questions or concerns, we're always here to help:
- Email: dev-team@claritybusinesssolutions.ca
- Slack: #crm-support

Best regards,
The Clarity Development Team
```

---

### Rollback Communication

#### Email Template: Rollback Notification

**Subject:** URGENT: CRM Temporarily Reverted to Previous Version

**Body:**

```
Hi Team,

We've temporarily reverted the Clarity CRM to the previous version due to an unexpected issue discovered after the upgrade.

WHAT HAPPENED:
[Brief explanation of the issue]

CURRENT STATUS:
✅ The application is fully functional (previous version)
✅ All your data is safe
✅ No data was lost
✅ You can continue working normally

WHAT WE'RE DOING:
Our team is investigating the issue and developing a fix. We'll re-deploy the upgrade once the issue is resolved and thoroughly tested.

TIMELINE:
We expect to re-attempt the upgrade in approximately [X days]. We'll notify you 48 hours in advance.

QUESTIONS?
If you have any concerns, please contact:
- Email: dev-team@claritybusinesssolutions.ca
- Slack: #crm-support

We apologize for the inconvenience and appreciate your patience.

Best regards,
The Clarity Development Team
```

---

## Deployment Phases

### Phase 1: Pre-Deployment Preparation (Days -7 to -1)

**Day -7: Development Complete**
- [ ] All code changes complete
- [ ] All acceptance criteria pass on dev environment
- [ ] Code review complete
- [ ] Merge to staging branch

**Day -6 to -5: Staging Environment Testing**
- [ ] Deploy to staging environment
- [ ] Run full acceptance criteria verification
- [ ] Test all workflows end-to-end
- [ ] Performance testing
- [ ] Browser compatibility testing

**Day -4 to -3: Backend Verification**
- [ ] Backend team deploys changes to production backend
- [ ] Verify all `/filemaker/*` endpoints query Supabase
- [ ] Verify HMAC authentication works
- [ ] Verify response formats match expectations
- [ ] Load testing on production backend

**Day -2: Final Preparation**
- [ ] Send user announcement email
- [ ] Create production deployment tag (`pre-filemaker-removal-production`)
- [ ] Prepare deployment scripts
- [ ] Configure monitoring and alerting
- [ ] Assign on-call engineers

**Day -1: Final Verification**
- [ ] Send reminder email to users
- [ ] Final check on staging environment
- [ ] Verify backend is stable
- [ ] Verify monitoring is working
- [ ] Confirm deployment window with team

---

### Phase 2: Deployment Day (Day 0)

**8:00 AM: Deployment Start**
- [ ] Send "deployment in progress" email
- [ ] Tag current production state
- [ ] Build production bundle
- [ ] Deploy to production
- [ ] Clear CDN cache

**8:15 AM: Immediate Verification**
- [ ] Application loads successfully
- [ ] Sign-in page appears immediately (no delay)
- [ ] Test authentication
- [ ] Test core CRUD operations
- [ ] Check browser console for errors
- [ ] Check backend logs

**8:30 AM: Go/No-Go Decision**
- ✅ If verification passes → Continue monitoring
- ❌ If critical issues → Execute rollback immediately

**9:00 AM: Send Deployment Complete Email**
- [ ] Notify users deployment is complete
- [ ] Provide instructions (clear cache if needed)
- [ ] Provide support contact info

**9:00 AM - 8:00 PM: Intensive Monitoring (Every 15 minutes)**
- [ ] Check application health
- [ ] Monitor error logs
- [ ] Monitor performance metrics
- [ ] Respond to user reports
- [ ] Document any issues

**8:00 PM: End of Day Review**
- [ ] Review all metrics
- [ ] Document any issues encountered
- [ ] Update issue tracker
- [ ] Plan hotfixes if needed
- [ ] Decide: continue monitoring vs rollback

---

### Phase 3: Intensive Monitoring Period (Days 1-2)

**Day 1:**
- Monitoring every 15 minutes during business hours
- Passive monitoring during off-hours (alerts only)
- Respond to all user reports within 15 minutes
- Collect performance data
- Log all issues

**Day 2:**
- Monitoring every 30 minutes during business hours
- Passive monitoring during off-hours (alerts only)
- Respond to user reports within 30 minutes
- Continue collecting performance data
- Evaluate rollback vs continue decision

**End of Day 2: Decision Point**
- ✅ No critical issues → Proceed to stabilization
- ⚠️ Minor issues → Continue monitoring + plan hotfixes
- ❌ Critical issues → Execute rollback

---

### Phase 4: Stabilization Period (Days 3-4)

**Day 3:**
- Monitoring twice per day (9:00 AM, 5:00 PM)
- Send user feedback survey
- Collect performance metrics
- Plan hotfixes for non-critical issues
- Update documentation

**Day 4:**
- Monitoring twice per day
- Review user feedback survey results
- Calculate final performance metrics
- Document lessons learned
- Prepare for confidence declaration

---

### Phase 5: Confidence Declaration (Days 5-7)

**Day 5-6:**
- Reduce monitoring to once per day
- Develop hotfixes for minor issues (if any)
- Prepare migration completion document
- Prepare success declaration email

**Day 7: Migration Complete**
- [ ] Run final acceptance criteria verification
- [ ] Review all metrics
- [ ] Stakeholder sign-off meeting
- [ ] Declare migration successful
- [ ] Send success email to users
- [ ] Update CLAUDE.md and README.md
- [ ] Create MIGRATION_COMPLETE.md
- [ ] Close migration project

---

## Risk Mitigation

### Identified Risks and Mitigation Strategies

#### Risk 1: Authentication Completely Broken

**Likelihood:** Low
**Impact:** Critical
**Risk Score:** High

**Symptoms:**
- No users can sign in
- Authentication endpoint returns 401/403
- Supabase connection fails

**Mitigation:**
- **Pre-deployment:** Test authentication extensively on staging
- **Pre-deployment:** Verify Supabase is accessible from production
- **During deployment:** Test authentication in first 15 minutes
- **If occurs:** Execute immediate rollback

**Rollback Time:** 5 minutes

---

#### Risk 2: Backend Endpoints Return Wrong Data

**Likelihood:** Medium
**Impact:** High
**Risk Score:** High

**Symptoms:**
- Data displayed in UI doesn't match database
- Customer list shows wrong customers
- Project details show wrong project

**Mitigation:**
- **Pre-deployment:** Backend team verifies endpoints query Supabase
- **Pre-deployment:** Test all endpoints on staging
- **During deployment:** Spot-check data in first 15 minutes
- **If occurs:** Rollback backend + frontend

**Rollback Time:** 15 minutes

---

#### Risk 3: API Response Format Mismatch

**Likelihood:** Medium
**Impact:** High
**Risk Score:** High

**Symptoms:**
- Data doesn't display in UI
- JavaScript errors: "Cannot read property X of undefined"
- Console shows parsing errors

**Mitigation:**
- **Pre-deployment:** Verify response format matches in staging
- **Pre-deployment:** Test all API calls with real data
- **During deployment:** Check console for parsing errors
- **If occurs:** Evaluate hotfix vs rollback (depends on severity)

**Hotfix Time:** 30 minutes - 2 hours
**Rollback Time:** 5 minutes

---

#### Risk 4: Performance Worse Than Expected

**Likelihood:** Low
**Impact:** Medium
**Risk Score:** Low-Medium

**Symptoms:**
- Page load times slower than target
- API response times higher than expected
- Users complain about slowness

**Mitigation:**
- **Pre-deployment:** Load testing on staging
- **Pre-deployment:** Performance benchmarking
- **During deployment:** Monitor performance metrics
- **If occurs:** Investigate bottleneck, consider optimizations vs rollback

**Decision Criteria:**
- If >50% slower than baseline → Rollback
- If 10-50% slower → Investigate + hotfix
- If <10% slower → Monitor + optimize

---

#### Risk 5: HMAC Authentication Fails

**Likelihood:** Low
**Impact:** Critical
**Risk Score:** High

**Symptoms:**
- All API requests return 401
- Console shows "HMAC authentication failed"
- Users can sign in but can't load data

**Mitigation:**
- **Pre-deployment:** Test HMAC generation on staging
- **Pre-deployment:** Verify SECRET_KEY is same on frontend and backend
- **During deployment:** Test API calls in first 15 minutes
- **If occurs:** Check SECRET_KEY, if wrong → hotfix, if correct → rollback

**Hotfix Time:** 10 minutes (if just env var issue)
**Rollback Time:** 5 minutes

---

#### Risk 6: Supabase Connection Issues

**Likelihood:** Low
**Impact:** High
**Risk Score:** Medium

**Symptoms:**
- Backend can't connect to Supabase
- Timeouts on all API requests
- Database connection errors in logs

**Mitigation:**
- **Pre-deployment:** Verify Supabase is accessible from production backend
- **Pre-deployment:** Check Supabase connection pool settings
- **During deployment:** Monitor database connection metrics
- **If occurs:** Check Supabase status, verify network, rollback if unresolvable

**Rollback Time:** 15 minutes

---

#### Risk 7: Browser Caching Issues

**Likelihood:** Medium
**Impact:** Low
**Risk Score:** Low

**Symptoms:**
- Users see old version of app
- JavaScript errors from old/new code mismatch
- Features don't work until cache cleared

**Mitigation:**
- **Pre-deployment:** Configure cache-busting in build (Vite handles this)
- **Pre-deployment:** Verify `index.html` is not cached
- **During deployment:** Clear CDN cache
- **If occurs:** Instruct users to hard-refresh (Ctrl+Shift+R)

**Resolution Time:** User action (immediate)

---

#### Risk 8: Data Migration Incomplete

**Likelihood:** Low
**Impact:** Critical
**Risk Score:** High

**Symptoms:**
- Some customers/projects missing from Supabase
- Users report missing data
- Record counts don't match between FileMaker and Supabase

**Mitigation:**
- **Pre-deployment:** Backend team verifies all data migrated
- **Pre-deployment:** Compare record counts in FileMaker vs Supabase
- **During deployment:** Spot-check known records exist
- **If occurs:** Rollback immediately, complete data migration, re-deploy

**Rollback Time:** 5 minutes

---

#### Risk 9: Environment Variables Misconfigured

**Likelihood:** Low
**Impact:** High
**Risk Score:** Medium

**Symptoms:**
- App tries to connect to wrong API URL
- HMAC authentication uses wrong secret
- Supabase connection fails

**Mitigation:**
- **Pre-deployment:** Verify all env vars in production
- **Pre-deployment:** Document required env vars
- **During deployment:** Check console for wrong URLs
- **If occurs:** Update env vars + redeploy (10 minutes) or rollback

**Hotfix Time:** 10 minutes
**Rollback Time:** 5 minutes

---

#### Risk 10: Users Confused by Changes

**Likelihood:** Medium
**Impact:** Low
**Risk Score:** Low

**Symptoms:**
- Users report "something changed"
- Users ask where FileMaker detection went
- Users confused by faster load times

**Mitigation:**
- **Pre-deployment:** Clear communication about changes
- **Pre-deployment:** Explain "everything works the same, just faster"
- **During deployment:** Provide support channel for questions
- **If occurs:** Provide user education, reassure them

**Resolution Time:** Communication (ongoing)

---

## Deployment Checklist

### Pre-Deployment Checklist (Complete before deployment)

**Code Readiness:**
- [ ] All acceptance criteria pass (minimum 38/40)
- [ ] All code changes reviewed and approved
- [ ] Build succeeds without errors
- [ ] No FileMaker references in active code
- [ ] All imports resolve correctly

**Testing Verification:**
- [ ] All manual tests pass on staging
- [ ] All workflows tested end-to-end
- [ ] Authentication flows tested
- [ ] All CRUD operations tested
- [ ] Performance benchmarks collected
- [ ] Browser compatibility verified

**Backend Verification:**
- [ ] Backend API deployed to production
- [ ] All `/filemaker/*` endpoints query Supabase
- [ ] Response format matches expectations
- [ ] HMAC authentication works
- [ ] Performance acceptable (<500ms response times)

**Environment Configuration:**
- [ ] Production env vars verified
- [ ] SECRET_KEY matches between frontend and backend
- [ ] SUPABASE_URL and ANON_KEY correct
- [ ] FileMaker env vars removed (or ready to remove)

**Monitoring Setup:**
- [ ] Monitoring dashboard configured
- [ ] Alerts configured and tested
- [ ] Error reporting service configured (Sentry, etc.)
- [ ] Log aggregation working
- [ ] On-call schedule assigned

**Communication:**
- [ ] Announcement email sent (Day -2)
- [ ] Reminder email sent (Day -1)
- [ ] Deployment window confirmed with team
- [ ] Support channel ready (#crm-support)
- [ ] On-call contact info shared

**Backup and Rollback:**
- [ ] Git tag created (`pre-filemaker-removal-production`)
- [ ] Rollback procedure documented
- [ ] Rollback scripts tested
- [ ] Team knows how to execute rollback

**Stakeholder Sign-off:**
- [ ] Technical lead approves
- [ ] QA lead approves
- [ ] Product owner approves
- [ ] Backend lead approves
- [ ] DevOps approves

---

### Deployment Day Checklist

**Pre-Deployment (7:00 AM - 8:00 AM):**
- [ ] Team on Slack/ready for deployment
- [ ] Monitoring dashboard open
- [ ] On-call engineer confirmed
- [ ] Support channel (#crm-support) open
- [ ] Rollback scripts ready

**Deployment (8:00 AM - 8:15 AM):**
- [ ] Send "deployment in progress" email
- [ ] Tag current production state
- [ ] Build production bundle (`npm run build`)
- [ ] Verify build succeeded
- [ ] Deploy to production (`npm run upload` or CI/CD)
- [ ] Clear CDN cache

**Immediate Verification (8:15 AM - 8:30 AM):**
- [ ] Application loads (no 404 errors)
- [ ] Sign-in page displays immediately
- [ ] No 3-second FileMaker detection delay
- [ ] Browser console clean (no errors)
- [ ] Test sign-in with valid credentials
- [ ] Authentication succeeds
- [ ] Load customers list
- [ ] View customer detail
- [ ] Create test project
- [ ] Create test task
- [ ] Delete test records
- [ ] No errors in backend logs
- [ ] No errors in Supabase logs

**Go/No-Go Decision (8:30 AM):**
- [ ] All verification checks pass
- [ ] No critical errors
- [ ] No user reports of blocking issues
- **Decision:** ✅ Continue or ❌ Rollback

**Post-Deployment (9:00 AM):**
- [ ] Send "deployment complete" email
- [ ] Update status in #crm-support
- [ ] Begin intensive monitoring schedule
- [ ] Document any issues found

---

### Post-Deployment Checklist (Days 1-7)

**Day 1:**
- [ ] Monitor every 15 minutes during business hours
- [ ] Respond to all user reports within 15 minutes
- [ ] Collect performance metrics
- [ ] Log all issues
- [ ] End of day review meeting

**Day 2:**
- [ ] Monitor every 30 minutes during business hours
- [ ] Respond to user reports within 30 minutes
- [ ] Continue collecting metrics
- [ ] Evaluate rollback vs continue decision
- [ ] Plan hotfixes if needed

**Day 3:**
- [ ] Monitor twice per day (9 AM, 5 PM)
- [ ] Send user feedback survey
- [ ] Collect performance metrics
- [ ] Review user feedback
- [ ] Update documentation

**Day 4:**
- [ ] Monitor twice per day
- [ ] Review survey results
- [ ] Calculate final metrics
- [ ] Prepare for confidence declaration

**Day 7:**
- [ ] Run final acceptance criteria verification
- [ ] Stakeholder sign-off meeting
- [ ] Send success email to users
- [ ] Update CLAUDE.md
- [ ] Update README.md
- [ ] Create MIGRATION_COMPLETE.md
- [ ] Close migration project
- [ ] Celebrate! 🎉

---

## Post-Deployment Actions

### Immediate Post-Deployment (Day 0)

**Within First Hour:**
1. Monitor application health continuously
2. Check for errors in console, backend logs, Supabase logs
3. Test authentication and core CRUD operations
4. Respond to user reports immediately
5. Document any issues found

**Within First Day:**
1. Intensive monitoring (every 15 minutes)
2. Collect performance metrics
3. Log all issues (even minor ones)
4. Communicate status updates to team
5. Plan hotfixes for non-critical issues

---

### Short-Term Actions (Days 1-7)

**User Support:**
- Monitor #crm-support channel continuously
- Respond to all user questions within 15-30 minutes
- Collect user feedback via survey (Day 3)
- Document common questions for FAQ

**Performance Analysis:**
- Collect detailed performance metrics
- Compare with baseline (pre-migration)
- Identify any performance regressions
- Plan optimizations if needed

**Issue Resolution:**
- Prioritize and fix critical bugs immediately
- Plan hotfixes for high-priority issues
- Document medium/low-priority issues for future releases
- Update issue tracker

**Monitoring:**
- Review monitoring dashboard daily
- Adjust alert thresholds if needed
- Ensure no alerts are missed
- Document any false positives

---

### Medium-Term Actions (Weeks 2-4)

**Documentation Updates:**
- Update CLAUDE.md to remove FileMaker references
- Update README.md to reflect web-app-only architecture
- Create MIGRATION_COMPLETE.md document
- Update architecture diagrams
- Update onboarding documentation

**Code Cleanup:**
- Remove commented-out FileMaker code
- Clean up code comments (remove FileMaker references)
- Remove unused imports
- Run linter and fix warnings

**Performance Optimization:**
- Identify bottlenecks from performance data
- Optimize slow queries
- Implement caching where beneficial
- Reduce bundle size further if possible

**User Training:**
- Create FAQ document based on user questions
- Conduct training session if needed
- Update user documentation
- Record demo video of new performance

---

### Long-Term Actions (Months 2-6)

**Technical Debt Reduction:**
- Refactor services to remove legacy patterns
- Simplify data service layer further
- Remove any remaining dual-path code
- Update dependencies

**New Features Enabled by Migration:**
- Implement Supabase realtime features
- Add advanced search powered by Supabase full-text
- Improve dashboard with better queries
- Add new features that weren't possible with FileMaker

**Retrospective:**
- Conduct migration retrospective meeting
- Document lessons learned
- Identify what went well
- Identify what could be improved
- Update rollout plan template for future migrations

**Knowledge Sharing:**
- Write blog post about migration (if applicable)
- Share lessons learned with team
- Update migration playbook for future reference
- Train new team members on new architecture

---

## Appendix

### Glossary

**Big Bang Deployment:** Deploying all changes at once to all users simultaneously (vs gradual rollout)

**HMAC Authentication:** Hash-based Message Authentication Code - cryptographic method for verifying request authenticity

**Rollback:** Reverting to the previous version of code/configuration

**Hotfix:** Quick fix deployed to production to resolve urgent issue

**Acceptance Criteria:** Specific conditions that must be met for deployment to be considered successful

**RCA:** Root Cause Analysis - investigation to determine the underlying cause of an issue

---

### Contact Information

**On-Call Engineers:**
- Primary: [Name] - [Phone] - [Email]
- Secondary: [Name] - [Phone] - [Email]

**Stakeholders:**
- Technical Lead: [Name] - [Email]
- Product Owner: [Name] - [Email]
- Backend Lead: [Name] - [Email]
- DevOps: [Name] - [Email]

**Support Channels:**
- Email: dev-team@claritybusinesssolutions.ca
- Slack: #crm-support
- Emergency: [On-call phone number]

---

### Related Documents

- `MIGRATION_PLAN.md` - Detailed migration implementation steps
- `acceptance-criteria.md` - Complete acceptance criteria with verification commands
- `BACKEND_API_REQUIREMENTS.md` - Backend API requirements and endpoints
- `authentication-requirements.md` - Authentication migration requirements
- `architecture.md` - Current FileMaker architecture documentation
- `inventory.md` - Complete inventory of FileMaker integration points

---

**Document Status:** Phase 1 Requirements Document (Ready for Phase 2 Implementation)
**Next Step:** Use this rollout plan during Phase 2 deployment
**Last Updated:** 2026-01-10
