# Platform FileMaker Removal Requirements

## Executive Summary

This document outlines the requirements for removing FileMaker bridge infrastructure from the Clarity CRM Frontend, transitioning to a Supabase-first architecture with unified web app authentication and request routing.

**Status:** Phase 1 - Requirements Documentation
**Last Updated:** 2026-01-11
**Related Tasks:** INS0009, INS0018

---

## Overview

### Current State

The Clarity CRM Frontend currently operates in dual environments:
- **FileMaker WebViewer**: Embedded in FileMaker with fm-gofer bridge (LEGACY)
- **Standalone Web App**: Independent web application with Supabase authentication (PRIMARY FOCUS)

The application maintains complex environment detection and routing logic:
- FMGofer bridge initialization via message events
- Window.FileMaker object detection with polling strategy
- Dual authentication methods (FileMaker bridge vs Supabase)
- Request/response interceptors for environment-aware routing
- FileMaker-first API layer with backend fallback

### Target State

**Single-path web application:**
- Supabase authentication only
- Direct backend API communication with HMAC-SHA256 authentication
- Simplified request routing without environment detection
- Removal of FileMaker bridge dependencies
- Unified codebase without dual-environment complexity

### Migration Goals

1. **Remove FileMaker Dependencies**
   - Eliminate fm-gofer library and window.FileMaker bridge
   - Remove FileMaker environment detection logic
   - Delete FileMaker-first API layer patterns

2. **Simplify Architecture**
   - Single authentication path (Supabase only)
   - Direct HTTP requests to backend API
   - Remove request/response interceptor complexity
   - Eliminate dual-write service synchronization

3. **Maintain Functionality**
   - All features work identically in web-only mode
   - Backend API already implements all required endpoints
   - HMAC authentication already functional
   - No data loss or feature regression

4. **Clean Up Codebase**
   - Remove 100+ FileMaker touchpoints
   - Delete unused constants, helpers, and services
   - Simplify initialization flow
   - Remove legacy environment variables

---

## Dependencies

### Completed Feature Migrations Required First

Before removing platform infrastructure, all features must be migrated to Supabase:

1. **Customers Migration** (INS0001) - Status: Requirements Complete
2. **Projects Migration** (INS0002) - Status: Requirements Complete
3. **Tasks & Timer Migration** (INS0003) - Status: Requirements Complete
4. **Teams Migration** (INS0004) - Status: Requirements Complete
5. **Notes Migration** (INS0005) - Status: Requirements Complete
6. **Links Migration** (INS0006) - Status: Complete
7. **Financial Records Migration** (INS0007) - Status: Complete
8. **QuickBooks Integration Migration** (INS0008) - Status: Requirements In Progress

**Critical Dependency:**
Platform removal can only proceed AFTER all feature data is fully migrated to Supabase and backend APIs are operational. FileMaker bridge must remain functional until all features are independently verified in web-only mode.

### Backend Requirements

**No new backend changes required** - All necessary infrastructure already exists:
- Backend API endpoints at `https://api.claritybusinesssolutions.ca`
- HMAC-SHA256 authentication implementation
- Supabase database with all required tables
- RLS policies for organization isolation
- Response format compatibility with frontend expectations

---

## Current FileMaker Integration Architecture

### Environment Detection Flow

```
1. App loads in FileMaker WebViewer OR standalone browser
   ↓
2. Message event listener awaits 'FM_BRIDGE_READY' (if FileMaker)
   ↓
3. SignIn component runs detectFileMaker() on mount
   ├─→ Polls for window.FMGofer or window.FileMaker (30 attempts, 100ms interval)
   └─→ Timeout after 3 seconds → fallback to Supabase auth
   ↓
4. Environment detected
   ├─→ FileMaker: handleFileMakerDetected() called
   │   └─→ setEnvironmentContext({ type: 'filemaker', ... })
   └─→ Web App: handleSupabaseAuth() called
       └─→ setEnvironmentContext({ type: 'webapp', ... })
   ↓
5. Global module state set (getEnvironmentContext() now returns environment)
   ↓
6. All subsequent API calls automatically routed based on environment
```

### Request Routing Patterns

**Current Dual-Path System:**

```
API Call Made
  ↓
Check getEnvironmentContext().type
  ├─→ FILEMAKER:
  │   ├─ Legacy API: handleFileMakerNativeCall()
  │   └─ Modern API: convertToFileMakerCall() via response interceptor
  │   ↓
  │   FMGofer.PerformScript('JS * Fetch Data', JSON params)
  │   ↓
  │   FileMaker Database (devCustomers layout)
  │
  └─→ WEBAPP:
      ├─ Legacy API: callBackendAPI() converts FileMaker params to HTTP
      └─ Modern API: Direct axios HTTP request with HMAC auth
      ↓
      Backend API validates HMAC signature
      ↓
      Supabase Database query
```

### Integration Statistics

**Total FileMaker Touchpoints:** 100+ locations across codebase

**Breakdown by Category:**
- FMGofer imports: 3 files
- window.FileMaker checks: 10+ locations
- fetchDataFromFileMaker calls: 60+ locations
- ENVIRONMENT_TYPES.FILEMAKER references: 15+ locations
- Axios interceptor logic: 4 key functions
- Layout/Action constants: 2 constant objects
- Hooks: 1 complete hook (useFileMakerBridge)
- Services: 5 services with FileMaker integration
- Components: 2 components with direct FileMaker logic

---

## Target Architecture: Supabase-First Single Path

### Simplified Authentication Flow

```
1. App loads in web browser
   ↓
2. SignIn component displays Supabase login form
   ↓
3. User authenticates via email/password or SSO
   ↓
4. Supabase returns JWT token
   ↓
5. App sets authentication state
   ↓
6. All API requests use HMAC-SHA256 authentication
   ↓
7. Backend validates JWT + HMAC signature
   ↓
8. Supabase database queries execute with RLS policies
```

### Unified Request Routing

```
Component calls API function
  ↓
Direct axios HTTP request to backend
  ↓
Add HMAC-SHA256 Authorization header
  ↓
Backend API endpoint
  ↓
Validate HMAC signature
  ↓
Validate Supabase JWT token
  ↓
Execute database query with RLS
  ↓
Return JSON response
  ↓
Component receives data
```

**Key Simplifications:**
- No environment detection needed
- No dual routing logic
- No FileMaker parameter translation
- No dual-write synchronization
- Single authentication method
- Direct HTTP → Database path

---

## Scope

### In Scope

**Code Removal:**
- FileMaker bridge initialization (fm-gofer message events)
- Environment detection logic (SignIn component polling)
- useFileMakerBridge hook and FileMaker readiness checks
- ENVIRONMENT_TYPES.FILEMAKER and AUTH_METHODS.FILEMAKER constants
- Request/response interceptors for FileMaker routing
- convertToFileMakerCall and handleFileMakerNativeCall functions
- fetchDataFromFileMaker wrapper (60+ call sites)
- FileMaker Layouts and Actions constants
- Dual-write service (FileMaker ↔ Supabase sync)
- QuickBooks initialization via FileMaker script execution

**File Deletion:**
- `src/api/fileMaker.js` (500 lines)
- `src/services/dualWriteService.js` (359 lines)

**Package Removal:**
- fm-gofer npm dependency

**Environment Variables Removal:**
- VITE_FM_URL
- VITE_FM_DATABASE
- VITE_FM_USER
- VITE_FM_PASSWORD

**API Layer Refactoring:**
- Convert 11 API modules from FileMaker params to direct HTTP calls
- Update service layer to remove environment routing
- Simplify initialization service
- Remove FileMaker context loading

### Out of Scope

**Not Included in This Migration:**
- Feature-specific data migrations (handled by separate tasks INS0001-INS0008)
- Backend API endpoint creation (already exists)
- Database schema changes (already complete)
- RLS policy implementation (already deployed)
- HMAC authentication setup (already functional)
- QuickBooks OAuth implementation (separate migration)

**Explicitly Preserved:**
- All current application features and functionality
- Backend API endpoints (`/filemaker/{layout}/records`)
- HMAC authentication system
- Supabase database schema
- Response format compatibility

---

## Success Criteria

### Functional Requirements

1. **Authentication Works**
   - ✅ Users can log in via Supabase email/password
   - ✅ JWT tokens are properly validated
   - ✅ Session management functions correctly
   - ✅ Logout clears authentication state

2. **All Features Operational**
   - ✅ Customers: CRUD operations, search, filtering
   - ✅ Projects: CRUD, status management, relationships
   - ✅ Tasks: CRUD, timer start/stop/pause, time tracking
   - ✅ Teams: CRUD, staff assignments, project relationships
   - ✅ Notes: CRUD with entity associations
   - ✅ Links: CRUD with entity associations
   - ✅ Financial Records: Queries, summaries, unpaid tracking
   - ✅ QuickBooks: OAuth, invoice generation, sync operations

3. **No Regressions**
   - ✅ All existing functionality works identically
   - ✅ Data integrity maintained
   - ✅ Performance meets or exceeds current levels
   - ✅ No broken workflows or missing features

### Technical Requirements

1. **Code Quality**
   - ✅ No references to FileMaker remain in codebase
   - ✅ No unused imports or dead code
   - ✅ All ESLint/TypeScript errors resolved
   - ✅ Build completes without warnings

2. **Architecture Simplification**
   - ✅ Single authentication path
   - ✅ Direct HTTP request routing
   - ✅ No environment detection logic
   - ✅ Simplified initialization flow

3. **Dependencies Clean**
   - ✅ fm-gofer package uninstalled
   - ✅ No FileMaker environment variables
   - ✅ package.json cleaned up
   - ✅ No references to window.FileMaker or FMGofer

### Testing Requirements

1. **Unit Tests**
   - Authentication flow without FileMaker detection
   - Direct API calls to backend
   - HMAC signature generation
   - Response handling

2. **Integration Tests**
   - End-to-end CRUD operations for all entities
   - Timer workflows (start/stop/pause)
   - QuickBooks OAuth and sync
   - Multi-user concurrent operations

3. **Regression Tests**
   - All existing feature tests pass
   - No broken user workflows
   - Data operations produce identical results
   - Performance benchmarks met

---

## Implementation Timeline

### Phase 1: Requirements Documentation (Current)

**Deliverables:**
- ✅ README.md (this document)
- ✅ current-implementation.md (FileMaker architecture analysis)
- ✅ data-model-mapping.md (environment config if needed)
- ✅ api-contracts.md (backend API surface)
- ✅ authorization.md (authentication requirements)
- ✅ migration-plan.md (cutover strategy)
- ✅ acceptance-criteria.md (test cases and verification)

**Status:** Complete

### Phase 2: Backend Verification

**Tasks:**
1. Verify all backend API endpoints operational
2. Confirm HMAC authentication working
3. Test Supabase RLS policies
4. Validate response formats match frontend expectations
5. Load test backend performance

**Duration:** 1-2 weeks (backend team)

### Phase 3: Frontend Refactoring

**Tasks:**
1. Remove FileMaker bridge initialization
2. Simplify SignIn component (remove detection)
3. Update API layer (convert fetchDataFromFileMaker calls)
4. Remove environment routing from dataService
5. Delete FileMaker-specific files
6. Clean up hooks and contexts
7. Remove package dependencies

**Duration:** 2-3 weeks

### Phase 4: Testing & Validation

**Tasks:**
1. Run full regression test suite
2. Manual testing of all features
3. Performance benchmarking
4. Security audit
5. User acceptance testing

**Duration:** 1-2 weeks

### Phase 5: Deployment & Monitoring

**Tasks:**
1. Deploy to staging environment
2. Smoke test all features
3. Deploy to production
4. Monitor error rates and performance
5. Rollback plan if issues detected

**Duration:** 1 week

---

## Risk Assessment

### High Risk Areas

1. **QuickBooks Integration**
   - Current: FileMaker script execution for OAuth
   - Risk: Complex OAuth flow migration
   - Mitigation: Separate QuickBooks migration task (INS0008)

2. **Timer Operations**
   - Current: Dual-write creates both time entries and financial records
   - Risk: Race conditions or data inconsistency
   - Mitigation: Atomic backend operations, transaction support

3. **Legacy Data References**
   - Current: Some FileMaker IDs may still be referenced
   - Risk: Broken relationships or orphaned records
   - Mitigation: Complete ID reconciliation before platform removal

### Medium Risk Areas

1. **Third-party Integrations**
   - Mailjet email service currently uses FMGofer calls
   - Requires refactoring to backend API calls

2. **Performance Impact**
   - Removal of caching layers or optimizations
   - Need performance benchmarking before/after

3. **Error Handling**
   - Different error formats between FileMaker and backend
   - Ensure error messages remain user-friendly

### Low Risk Areas

1. **Authentication Flow**
   - Supabase auth already functional
   - Well-tested in web app mode

2. **Backend API**
   - All endpoints already exist and tested
   - HMAC authentication proven

---

## Documentation Structure

This requirements folder contains:

1. **README.md** (this file)
   - Executive summary and overview
   - Current vs target architecture
   - Scope and success criteria
   - Implementation timeline

2. **current-implementation.md**
   - Detailed FileMaker bridge architecture
   - Environment detection mechanisms
   - Request routing flows
   - Code inventory and touchpoints

3. **data-model-mapping.md**
   - Environment configuration state
   - Authentication context structure
   - No database tables (platform-level only)

4. **api-contracts.md**
   - Backend API surface requirements
   - HMAC authentication specification
   - Request/response formats
   - Error handling

5. **authorization.md**
   - Supabase authentication requirements
   - JWT validation
   - Session management
   - Single-path auth flow

6. **migration-plan.md**
   - Step-by-step cutover plan
   - File-by-file removal order
   - Testing strategy
   - Rollback procedures

7. **acceptance-criteria.md**
   - Functional test cases
   - Technical verification steps
   - Performance requirements
   - Security checklist

---

## References

### Related Documentation

- `CLAUDE.md` - Project overview and FileMaker migration notice
- `requirements/customers/` - Customer migration requirements
- `requirements/projects/` - Project migration requirements
- `requirements/tasks/` - Tasks & Timer migration requirements
- `requirements/teams/` - Teams migration requirements
- `requirements/quickbooks/` - QuickBooks integration migration

### Key Source Files

**Core Bridge:**
- `src/api/fileMaker.js` (500 lines) - FileMaker bridge implementation
- `src/services/dataService.js` (519 lines) - Environment routing
- `src/hooks/index.js` (useFileMakerBridge hook)

**Environment Detection:**
- `src/components/auth/SignIn.jsx` - FileMaker detection logic
- `src/index.jsx` - Environment initialization

**API Layer:**
- `src/api/customers.js`, `projects.js`, `tasks.js`, etc. (11 files)

### External Links

- Backend API: `https://api.claritybusinesssolutions.ca`
- Supabase: `https://supabase.claritybusinesssolutions.ca`
- OpenAPI Spec: `https://api.claritybusinesssolutions.ca/openapi.json`

---

## Contact & Ownership

**Project Owner:** Marcus Swift
**Backend Team:** To be consulted for Phase 2 verification
**Timeline:** Q1 2026 (pending feature migrations)

---

**Document Version:** 1.0
**Last Updated:** 2026-01-11
**Status:** Phase 1 Complete - Ready for Phase 2 Backend Verification
