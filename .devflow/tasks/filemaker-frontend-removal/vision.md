# FileMaker Frontend Removal

## Overview
Remove all FileMaker dependencies from the frontend application, transitioning to a pure Supabase + Backend API architecture. This involves eliminating the dual-environment routing system, removing the FileMaker bridge (fm-gofer), and updating all data access patterns to use the new backend endpoints that have been implemented.

## Goals
1. **Eliminate FileMaker Bridge**: Remove all fm-gofer and FileMaker WebViewer integration code
2. **Simplify Authentication**: Remove FILEMAKER auth method, rely solely on Supabase authentication
3. **Single Request Path**: Consolidate dataService.js to a single routing path (Supabase + Backend API)
4. **Update API Layer**: Replace all FileMaker API calls with backend equivalents across all features
5. **Clean Environment Detection**: Remove environment type detection and FileMaker-specific initialization
6. **Update Configuration**: Remove FileMaker environment variables and configuration
7. **Maintain Feature Parity**: Ensure all existing features work with new backend APIs

## Success Criteria
- Zero FileMaker references remaining in production code
- No ENVIRONMENT_TYPES.FILEMAKER or AUTH_METHODS.FILEMAKER usage
- All feature integrations working (customers, projects, tasks, notes, links, financial records, QuickBooks)
- Build succeeds without FileMaker dependencies
- All tests pass with new backend integration
- Documentation updated to reflect Supabase-first architecture

## Technical Approach

### Phase 1: Feature API Integration (Prerequisites)
Ensure all feature-specific backend migrations are integrated:
- [x] Teams (INS0026 - Complete)
- [ ] Customers (INS0019 - In Progress)
- [ ] Tasks (INS0020 - In Progress)
- [ ] Projects (INS0021 - In Progress)
- [ ] Notes (INS0022 - In Progress)
- [ ] Links (INS0023 - In Progress)
- [ ] Financial Records (INS0024 - In Progress)
- [ ] QuickBooks (INS0025 - In Progress)

### Phase 2: Core Infrastructure Removal
1. **Remove FileMaker Bridge**
   - Delete src/api/fileMaker.js and src/api/fileMakerEdgeFunction.js
   - Remove fm-gofer dependency from package.json
   - Remove useFileMakerBridge hook

2. **Simplify Data Service**
   - Remove ENVIRONMENT_TYPES.FILEMAKER constant
   - Remove AUTH_METHODS.FILEMAKER constant
   - Remove environment detection logic
   - Simplify to single backend API routing path

3. **Update Authentication Flow**
   - Remove FileMaker detection in SignIn component
   - Remove FileMaker bridge authentication
   - Rely solely on Supabase authentication

4. **Update Initialization Service**
   - Remove FileMaker environment detection
   - Remove FileMaker-specific initialization code
   - Simplify startup flow

### Phase 3: Service Layer Updates
Update all service files to remove FileMaker data fetching:
- dualWriteService.js (remove or deprecate)
- customerService.js
- projectService.js
- taskService.js
- financialSyncService.js (remove FileMaker reconciliation)

### Phase 4: Configuration & Cleanup
1. Remove environment variables:
   - VITE_FM_URL
   - VITE_FM_DATABASE
   - VITE_FM_USER
   - VITE_FM_PASSWORD

2. Update documentation:
   - CLAUDE.md
   - README.md
   - Architecture documentation

3. Remove deployment scripts:
   - npm run deploy-to-fm
   - Upload scripts for FileMaker server

### Phase 5: Testing & Validation
1. Update test fixtures and mocks
2. Remove FileMaker-specific tests
3. Validate all features work with backend API
4. Regression testing for all user flows

## Dependencies
- All feature backend migrations must be deployed and functional
- Backend API endpoints must match requirements documentation
- Supabase schema must be deployed for all features

## Files to Modify

### Core Infrastructure (Priority 1)
- src/services/dataService.js (environment routing removal)
- src/services/initializationService.js (environment detection removal)
- src/components/auth/SignIn.jsx (FileMaker auth removal)
- src/hooks/index.js (remove useFileMakerBridge)

### API Layer (Priority 1)
- src/api/fileMaker.js (DELETE)
- src/api/fileMakerEdgeFunction.js (DELETE)
- src/api/customers.js (update to backend API)
- src/api/projects.js (update to backend API)
- src/api/tasks.js (update to backend API)
- src/api/financialRecords.js (update to backend API)
- src/api/notes.js (update to backend API)
- src/api/links.js (update to backend API)

### Service Layer (Priority 2)
- src/services/dualWriteService.js (deprecate/remove)
- src/services/financialSyncService.js (remove FileMaker reconciliation)
- src/services/customerService.js (update for backend API)
- src/services/projectService.js (update for backend API)
- src/services/taskService.js (update for backend API)

### Configuration (Priority 2)
- package.json (remove fm-gofer)
- .env.example (remove VITE_FM_* variables)
- vite.config.js (review proxy configuration)

### Documentation (Priority 3)
- CLAUDE.md
- README.md
- docs/TEAMS_MIGRATION_GUIDE.md
- requirements/platform-filemaker-removal/

### Tests (Priority 3)
- All test files with FileMaker mocks
- Integration tests
- E2E tests

## Risk Mitigation
1. **Feature Flags**: Consider temporary feature flags for gradual rollout
2. **Rollback Plan**: Maintain FileMaker code in a branch until full validation
3. **Monitoring**: Add logging to track any FileMaker API call attempts
4. **Incremental Deployment**: Deploy infrastructure changes separately from feature updates

## Timeline Considerations
- This is a large-scale refactor affecting 100+ files
- Requires coordination with backend deployment schedule
- Should be done in phases with testing between each phase
- Estimated complexity: 50+ subtasks across 5 phases
