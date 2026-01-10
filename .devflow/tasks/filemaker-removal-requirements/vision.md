# FileMaker Platform Removal - Requirements Documentation

## Overview

This feature documents the requirements for removing FileMaker bridge infrastructure from the Clarity CRM frontend. The platform currently routes requests through two paths (FileMaker vs Web App), but as stated in CLAUDE.md, FileMaker support is being phased out in favor of a Supabase-first architecture.

## Goals

1. **Document Current Architecture**: Map out all FileMaker bridge touchpoints and environment routing logic
2. **Define Backend API Surface**: Specify which backend endpoints need to exist to replace FileMaker operations
3. **Authentication Strategy**: Define web-only auth requirements and remove FileMaker auth method
4. **Migration Plan**: Create step-by-step plan to simplify dataService.js to single routing path
5. **Acceptance Criteria**: Define what "done" looks like for FileMaker removal
6. **Rollout Plan**: Specify safe deployment strategy

## Success Criteria

- Complete documentation of current FileMaker integration points
- Inventory of all files that reference FileMaker bridge
- Backend API contract definitions for replacing FileMaker operations
- Auth/session requirements clearly specified
- Migration plan with risk mitigation strategies
- Clear acceptance criteria and testing requirements

## Technical Approach

### Phase 1: Documentation (Current Feature)

Create comprehensive documentation under `requirements/platform-filemaker-removal/`:

1. **README.md** - Overview of current environment detection and routing
2. **architecture.md** - Current FileMaker bridge architecture
3. **inventory.md** - Complete inventory of FileMaker touchpoints
4. **backend-api-requirements.md** - Required backend API endpoints
5. **auth-requirements.md** - Authentication changes needed
6. **migration-plan.md** - Step-by-step migration strategy
7. **acceptance-criteria.md** - Testing and acceptance requirements
8. **rollout-plan.md** - Deployment strategy

### Phase 2: Implementation (Future Feature)

After requirements are approved:
- Remove FileMaker bridge code
- Simplify dataService.js
- Update authentication flow
- Remove environment detection logic
- Update tests

## Key Files to Analyze

### Core Infrastructure
- `src/services/dataService.js` - Environment-aware routing (518 lines)
- `src/api/fileMaker.js` - FileMaker bridge implementation (501 lines)
- `src/services/initializationService.js` - Environment detection and initialization
- `src/components/auth/SignIn.jsx` - Dual authentication (FileMaker + Supabase)

### Hooks and Context
- `src/hooks/index.js` - useFileMakerBridge hook
- `src/context/AppStateContext.jsx` - Environment and auth state management
- `src/index.jsx` - Main app with environment detection

### API Layer (All use fetchDataFromFileMaker)
- `src/api/customers.js`
- `src/api/projects.js`
- `src/api/tasks.js`
- `src/api/teams.js`
- `src/api/notes.js`
- `src/api/links.js`
- `src/api/financialRecords.js`

### Configuration
- `src/config.js` - FileMaker config (now pointing to backend)

## FileMaker Bridge Touchpoints

### 1. Environment Detection
**Files**: SignIn.jsx, index.jsx, dataService.js

- Checks for `window.FileMaker` object
- Checks for `FMGofer` library
- Sets environment type in AppStateContext

### 2. Request Routing
**Files**: dataService.js, fileMaker.js

- Axios interceptors route based on environment
- FileMaker calls converted to script calls
- Web app calls use HMAC authentication

### 3. Authentication
**Files**: SignIn.jsx, initializationService.js, dataService.js

- FileMaker: Auto-detect and authenticate via bridge
- Web App: Supabase email/password
- Two auth methods: `AUTH_METHODS.FILEMAKER` and `AUTH_METHODS.SUPABASE`

### 4. Data Operations
**Files**: All files in src/api/

- All operations route through `fetchDataFromFileMaker()`
- Function detects environment and routes appropriately
- FileMaker: Uses FMGofer.PerformScript
- Web App: Uses backend API with HMAC auth

## Dependencies

- Backend API must support all operations currently done via FileMaker
- Supabase tables must have all required data
- Backend authentication (HMAC) must be working
- No active FileMaker-dependent features in production

## Risks and Mitigation

### Risk: Backend API Missing Endpoints
**Mitigation**: Document all required endpoints before code changes

### Risk: Data Loss During Migration
**Mitigation**: Ensure dual-write service has synced all data

### Risk: Users Still on FileMaker
**Mitigation**: Gradual rollout with feature flag

### Risk: Breaking Existing Integrations
**Mitigation**: Comprehensive testing of all API operations

## Timeline Considerations

**Note**: Per CLAUDE.md guidelines, we avoid timeline estimates. This is a planning task that breaks down the work into actionable steps.

## Related Documentation

- `CLAUDE.md` - Project guidelines stating FileMaker is being phased out
- `FILEMAKER_TO_SUPABASE_MIGRATION_PLAN.md` - Overall migration strategy
- `.roo/rules/SUPABASE_DATABASE_VERIFICATION.md` - Database access patterns
- `BACKEND_INTEGRATION_GUIDE.md` - Backend API integration details
