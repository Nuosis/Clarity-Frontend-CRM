# FileMaker References Audit Report

**Generated:** 2026-01-15
**Project:** Clarity CRM Frontend
**Purpose:** Comprehensive inventory of FileMaker references for removal planning

---

## Executive Summary

**Total Files with FileMaker References:** 85
**Categories Identified:** 6
**NPM Dependency:** fm-gofer v1.10.0

**Removal Strategy:**
- **Safe to Remove:** 15 files (examples, deprecated services, tests only)
- **Requires Replacement:** 52 files (active API/service layer)
- **Keep Until Final Phase:** 18 files (environment detection, configuration)

---

## 1. API Calls (34 files)

### Core API Layer

#### `src/api/fileMaker.js` ⚠️ CRITICAL
- **Lines:** 501 total
- **Purpose:** Primary FileMaker bridge and API client
- **Dependencies:**
  - Imports: `FMGofer`, `axios`, `backendConfig`
  - Exports: `fetchDataFromFileMaker`, `generateBackendAuthHeader`, `formatParams`, `handleFileMakerOperation`, `validateParams`, `initializeQuickBooks`, `Layouts`, `Actions`
- **Used By:** Nearly all API files and services
- **Removal Strategy:**
  - KEEP until all dependent files converted to backend API
  - Remove after all features use direct backend endpoints
  - Contains critical layout constants (devCustomers, devProjects, devTasks, etc.)
- **Notes:**
  - Has dual-mode logic (FileMaker vs Backend API)
  - Contains HMAC auth generation (used by backend)
  - QuickBooks integration uses FileMaker script calls

#### `src/api/fileMakerEdgeFunction.js` ⚠️ MODERATE
- **Purpose:** Edge function wrapper for FileMaker Data API
- **Functions:** `listRecords`, `getRecord`, `createRecord`, `updateRecord`, `deleteRecord`, `executeScript`, `uploadContainer`, `downloadContainer`
- **Used By:** `src/components/examples/FileMakerExample.jsx`
- **Removal Strategy:** SAFE TO REMOVE (example code only)

#### `src/api/customers.js` 🔄 DUAL-MODE
- **Lines with FM references:** ~10 environment checks
- **Pattern:** `if (env.type === ENVIRONMENT_TYPES.FILEMAKER) { ... } else { ... }`
- **Functions Affected:** All CRUD operations (8 functions)
- **Removal Strategy:**
  - REMOVE FileMaker branches
  - Keep backend API branches
  - Already has full backend implementation
- **Notes:** Customer backend integration COMPLETE per CLAUDE.md

#### `src/api/projects.js` 🔄 DUAL-MODE
- **Lines with FM references:** ~25+ environment checks
- **Pattern:** Same dual-mode as customers
- **Functions Affected:** 25+ project-related operations
- **Removal Strategy:**
  - REMOVE FileMaker branches
  - Backend API endpoints already exist
  - Most complex API file (745 lines)
- **Notes:** Extensive project management functionality

#### `src/api/tasks.js` 🔄 DUAL-MODE
- **Feature Flag:** `USE_BACKEND_API = true`
- **Functions:** `fetchTasks`, `fetchTasksForProject`, `createTask`, `updateTask`, `deleteTask`
- **Removal Strategy:**
  - REMOVE FileMaker fallbacks
  - Backend already primary path
  - Remove feature flag check

#### `src/api/images.js` 🔄 DUAL-MODE
- **Functions:** `uploadImage`, `fetchProjectImages`, `deleteImage`
- **Removal Strategy:**
  - REMOVE FileMaker branches
  - Keep Supabase storage implementation

#### `src/api/financialRecords.js` ✅ BACKEND ONLY
- **Status:** No FileMaker API calls (uses Supabase RPC)
- **Imports:** Uses `convertSupabaseToFileMaker` from dateUtils (format conversion)
- **Removal Strategy:**
  - SAFE - no changes needed
  - Date format conversion needed for UI compatibility

#### `src/api/prospects.js` ✅ SUPABASE ONLY
- **Status:** No FileMaker references
- **Removal Strategy:** SAFE - no changes needed

#### `src/api/customerActivity.js`
- **Status:** Minimal references
- **Removal Strategy:** Review for FileMaker-specific report generation

### API Test Files (9 files)

#### `src/api/__tests__/customers.test.js`
- **FileMaker References:** 9 test cases with `ENVIRONMENT_TYPES.FILEMAKER`
- **Removal Strategy:**
  - REMOVE FileMaker environment test cases
  - Keep backend API tests
  - Update mock setups

#### `src/api/__tests__/projects.test.js`
- **FileMaker References:** 3 test cases
- **Removal Strategy:** Same as customers tests

#### `src/api/__tests__/links.test.js`
- **FileMaker References:** Test mocks
- **Removal Strategy:** Update to remove FileMaker path tests

#### Other Test Files:
- `src/api/__tests__/quickbooksApi.test.js` - Review QB integration tests
- All tests need FileMaker environment mocks removed

---

## 2. Environment Detection (18 files)

### Core Environment Logic

#### `src/services/dataService.js` ⚠️ CRITICAL
- **Lines:** 558 total
- **Purpose:** Environment-aware data routing
- **Key Exports:**
  - `ENVIRONMENT_TYPES` constant (`FILEMAKER`, `WEBAPP`)
  - `AUTH_METHODS` constant
  - `setEnvironmentContext()`, `getEnvironmentContext()`
  - `dataServiceClient` (axios interceptor-based)
  - `convertToFileMakerCall()` function
- **Removal Strategy:**
  - REMOVE FileMaker routing logic
  - KEEP HMAC auth generation (used by backend)
  - SIMPLIFY to single-mode (webapp only)
  - Remove `ENVIRONMENT_TYPES.FILEMAKER` constant
  - Remove FileMaker request/response interceptors
- **Impact:** HIGH - Used by all API clients

#### `src/context/AppStateContext.jsx`
- **Lines:** 400+ total
- **FileMaker References:**
  - `SET_ENVIRONMENT` action
  - `SET_SHOW_FILEMAKER_EXAMPLE` action
  - Environment state tracking
- **Removal Strategy:**
  - REMOVE FileMaker-specific actions
  - REMOVE environment type tracking (always webapp)
  - SIMPLIFY authentication state

#### `src/index.jsx` ⚠️ CRITICAL
- **Lines with FM:** ~10 environment checks
- **Purpose:** App initialization and environment setup
- **Key Logic:**
  - FileMaker detection: `appState.environment.type === ENVIRONMENT_TYPES.FILEMAKER`
  - `fmReady` state management
  - Conditional initialization based on environment
- **Removal Strategy:**
  - REMOVE FileMaker detection logic
  - REMOVE `fmReady` state
  - SIMPLIFY to always use Supabase auth
  - Remove conditional rendering based on FM environment

#### `src/components/auth/SignIn.jsx`
- **Purpose:** Authentication handler
- **FileMaker Logic:**
  - Detects FileMaker bridge: `window.FileMaker`, `window.FMGofer`
  - Auto-authenticates if FileMaker detected
  - Falls back to Supabase form
- **Removal Strategy:**
  - REMOVE FileMaker detection
  - REMOVE `detectFileMaker()` function
  - Always show Supabase auth form

### Hook Layer

#### `src/hooks/index.js`
- **Export:** `useFileMakerBridge()` hook
- **Purpose:** FileMaker connection status monitoring
- **Removal Strategy:**
  - REMOVE entire hook
  - Remove from exports
  - Used by deprecated code only

#### `src/hooks/useCustomer.js` 🔄 DUAL-MODE
- **Environment Checks:** 7 locations
- **Pattern:** `if (env.type === ENVIRONMENT_TYPES.FILEMAKER) { ... }`
- **Removal Strategy:** Remove FileMaker branches

#### `src/hooks/useProject.js` 🔄 DUAL-MODE
- **Environment Checks:** 2 locations
- **Removal Strategy:** Remove FileMaker branches

#### `src/hooks/useLink.js` 🔄 DUAL-MODE
- **Environment Checks:** 1 location
- **Removal Strategy:** Remove FileMaker branch

### Service Layer

#### `src/services/initializationService.js`
- **Purpose:** App initialization flow
- **FileMaker Logic:**
  - `waitForFileMaker()` method
  - `loadUserContext()` via FileMaker
- **Removal Strategy:**
  - REMOVE FileMaker-specific initialization
  - SIMPLIFY to Supabase-only flow

#### `src/services/linkService.js`
- **Environment Checks:** 1 location
- **Removal Strategy:** Remove FileMaker branch

---

## 3. Authentication & Configuration (8 files)

### Configuration

#### `src/config.js`
- **FileMaker Config:**
  ```javascript
  export const fileMakerConfig = {
    apiUrl: backendConfig.fileMakerApiUrl
  };
  ```
- **Removal Strategy:**
  - REMOVE `fileMakerConfig` export
  - Keep `backendConfig` (used by backend API)
- **Impact:** LOW - rarely imported directly

### Environment Variables

#### **CLAUDE.md mentions these vars (not found in code):**
- `VITE_FM_URL`
- `VITE_FM_DATABASE`
- `VITE_FM_USER`
- `VITE_FM_PASSWORD`

**Removal Strategy:**
- Remove from `.env` files
- Remove from documentation
- Update CLAUDE.md

### Components

#### `src/components/layout/Sidebar.jsx`
- **References:** Environment-based mode display
- **Removal Strategy:** Simplify mode logic (no environment checks)

---

## 4. Utilities & Helpers (12 files)

### Data Transformation

#### `src/utils/dataMappers.js`
- **Purpose:** FileMaker data format conversions
- **Functions:** Record transformation utilities
- **Removal Strategy:**
  - REVIEW each mapper function
  - Some may be needed for legacy data import
  - Remove if only used for FileMaker API

#### `src/utils/verifyMappers.js`
- **Purpose:** Validate data mapper functions
- **Removal Strategy:** REMOVE with dataMappers

#### `src/utils/dateUtils.js`
- **Functions:**
  - `convertSupabaseToFileMaker(date)` - YYYY-MM-DD → MM/DD/YYYY
  - `convertFileMakerToSupabase(date)` - MM/DD/YYYY → YYYY-MM-DD
- **Used By:** `financialRecords.js`, UI components
- **Removal Strategy:**
  - KEEP `convertSupabaseToFileMaker` (UI formatting)
  - RENAME to remove "FileMaker" reference
  - Used for display format, not FileMaker-specific

#### `src/utils/index.js`
- **Exports:** Aggregates utility exports
- **Removal Strategy:** Remove FileMaker-specific utility exports

### Services

#### `src/services/dualWriteService.js` ⚠️ DEPRECATED
- **Purpose:** Dual-write FileMaker → Supabase
- **Status:** Used for migration only
- **Removal Strategy:**
  - SAFE TO REMOVE after migration complete
  - Used by timer operations (legacy)
  - No longer needed per CLAUDE.md

#### `src/services/financialSyncService.js` ⚠️ DEPRECATED
- **Status:** Marked as DEPRECATED in code
- **Purpose:** Sync devRecords → customer_sales
- **Usage:** Historical data migration scripts only
- **Removal Strategy:**
  - KEEP for migration scripts
  - REMOVE after data migration complete
  - Document in migration completion tasks

#### `src/services/debugFinancialSync.js`
- **Purpose:** Debug sync operations
- **Removal Strategy:** SAFE TO REMOVE (debug only)

#### `src/services/recordQueueManager.js`
- **Purpose:** Queue manager for sync operations
- **Removal Strategy:** Review if used by other services

#### `src/services/salesService.js`
- **References:** Mentions FileMaker in comments
- **Removal Strategy:** Update comments only

#### `src/services/billableHoursService.js`
- **References:** FileMaker data format handling
- **Removal Strategy:**
  - REVIEW data format assumptions
  - Update to backend API format

#### `src/services/taskService.js`
- **Test References:** Test file mentions FileMaker
- **Removal Strategy:** Update test cases

#### `src/services/projectService.js`
- **Test References:** Test file mentions FileMaker
- **Removal Strategy:** Update test cases

#### `src/services/mailjetService.js`
- **Import:** `import FMGofer from 'fm-gofer'`
- **Usage:** Unknown without full file read
- **Removal Strategy:** REVIEW usage context

#### `src/services/pdfReportService.js`
- **References:** May use FileMaker data
- **Removal Strategy:** Review data format assumptions

---

## 5. UI Components (9 files)

### Example Components

#### `src/components/examples/FileMakerExample.jsx` ✅ SAFE
- **Purpose:** Demo component for FileMaker edge function
- **Removal Strategy:** REMOVE entire file (example only)
- **Impact:** NONE - not used in production

### Financial Components

#### `src/components/financial/FinancialSyncPanel.jsx`
- **Purpose:** Manual sync trigger UI
- **Removal Strategy:**
  - REMOVE if sync no longer needed
  - UPDATE if repurposed for backend sync

#### `src/components/financial/QboTestPanel.jsx`
- **FileMaker Check:** `if (typeof FileMaker !== 'undefined' && FileMaker.PerformScript)`
- **Purpose:** QuickBooks testing panel
- **Removal Strategy:**
  - REVIEW QuickBooks integration approach
  - May need FileMaker scripts for QB (confirm with backend team)

#### `src/components/financial/ProjectReportButton.jsx`
- **References:** FileMaker in context
- **Removal Strategy:** Review for report generation dependencies

#### `src/components/financial/ProjectList.jsx`
- **References:** FileMaker data expectations
- **Removal Strategy:** Update to backend data format

### Customer Components

#### `src/components/customers/CustomerForm.jsx` 🔄 DUAL-MODE
- **Environment Check:** 2 locations
- **Pattern:** `if (env.type === ENVIRONMENT_TYPES.FILEMAKER)`
- **Removal Strategy:** Remove FileMaker-specific UI logic

#### `src/components/customers/CustomerHeader.jsx`
- **References:** FileMaker in comments
- **Removal Strategy:** Update comments

#### `src/components/customers/CustomerSettings.jsx`
- **References:** FileMaker context
- **Removal Strategy:** Review settings relevance

#### `src/components/customers/ConvertProspectModal.jsx`
- **Purpose:** Convert prospect to FileMaker customer
- **Removal Strategy:**
  - UPDATE to convert to backend customer
  - Already uses backend API per CLAUDE.md

#### `src/components/customers/ActivityReportModal.jsx`
- **FileMaker Check:** `if (typeof FileMaker === "undefined")`
- **Removal Strategy:** Remove FileMaker dependency check

### Project Components

#### `src/components/projects/ProjectDetails.jsx`
- **References:** FileMaker in context
- **Removal Strategy:** Review for environment dependencies

#### `src/components/projects/ProjectLinksTab.jsx`
- **References:** FileMaker context
- **Removal Strategy:** Update if needed

#### `src/components/projects/ProjectNotesTab.jsx`
- **References:** FileMaker context
- **Removal Strategy:** Notes already migrated to backend per CLAUDE.md

#### `src/components/projects/ProjectImagesTab.jsx`
- **References:** FileMaker context
- **Removal Strategy:** Update to backend API

#### `src/components/projects/ProjectTeamTab.jsx`
- **References:** FileMaker context
- **Removal Strategy:** Teams already migrated to Supabase per CLAUDE.md

#### `src/components/MainContent.jsx`
- **References:** Environment-based routing
- **Removal Strategy:** Simplify routing logic

### Task Components

#### `src/components/tasks/TaskList.jsx`
- **References:** FileMaker context
- **Removal Strategy:** Update to backend format

#### `src/components/tasks/TaskTimer.jsx`
- **References:** FileMaker record creation
- **Removal Strategy:** Already uses direct Supabase per CLAUDE.md

#### `src/components/tasks/TaskForm.jsx`
- **References:** FileMaker context
- **Removal Strategy:** Update to backend format

### Proposal Components

#### `src/components/proposals/ProjectProposalsTab.jsx`
- **References:** FileMaker in comments
- **Removal Strategy:** Update comments only

---

## 6. Test Files (22 files)

### Unit Tests

All test files with FileMaker references follow similar patterns:

#### API Tests
- `src/api/__tests__/customers.test.js` - 9 FileMaker test cases
- `src/api/__tests__/projects.test.js` - 3 FileMaker test cases
- `src/api/__tests__/links.test.js` - FileMaker path tests
- `src/api/__tests__/quickbooksApi.test.js` - Review QB integration

#### Service Tests
- `src/services/__tests__/taskService.test.js` - FileMaker mocks
- `src/services/__tests__/projectService.test.js` - FileMaker mocks
- `src/services/__tests__/linkService.test.js` - FileMaker mocks
- `src/services/__tests__/customerTransformations.test.js` - Transformation tests

#### Hook Tests
- `src/hooks/__tests__/useLink.test.js` - FileMaker environment tests

#### Integration Tests
- `src/__tests__/tasksApi.test.js` - FileMaker integration
- `src/__tests__/tasksApi.mock.test.js` - FileMaker mocks
- `src/__tests__/e2e/quickbooksWorkflows.test.js` - May include FM

#### Component Tests
- `src/components/financial/__tests__/*.test.jsx` - 3 test files

#### Error Tests
- `src/errors/__tests__/customerErrors.test.js` - Error handling

#### Utility Tests
- `src/utils/__tests__/dataMappers.test.js` - Mapper validation
- `src/utils/pdfReport*.test.js` - 4 PDF test files

### Test Fixtures
- `src/__fixtures__/tasks.js` - FileMaker data format
- `src/__fixtures__/financialRecords.js` - FileMaker format
- `src/__fixtures__/timers.js` - FileMaker format
- `src/__tests__/fixtures/projectFixtures.js` - FileMaker format

**Removal Strategy for All Tests:**
- REMOVE FileMaker-specific test cases
- UPDATE mocks to backend API format
- REMOVE FileMaker environment setup
- Keep backend API tests
- Update fixtures to backend format

---

## Dependencies to Remove

### NPM Package

```json
"fm-gofer": "^1.10.0"
```

**Removal:** Delete from `package.json` dependencies
**Impact:** Will cause build errors until all imports removed
**Timing:** Remove in final phase after all code updated

### Import Statements (3 files)

1. `src/services/dataService.js:9` - `import FMGofer from 'fm-gofer';`
2. `src/services/mailjetService.js:6` - `import FMGofer from 'fm-gofer';`
3. `src/api/fileMaker.js:1` - `import FMGofer from 'fm-gofer';`

---

## Constants & Enums to Remove

### Environment Types
```javascript
// src/services/dataService.js
export const ENVIRONMENT_TYPES = {
  FILEMAKER: 'filemaker',  // ← REMOVE
  WEBAPP: 'webapp'          // ← KEEP (or rename to default)
};
```

### Layout Constants
```javascript
// src/api/fileMaker.js
export const Layouts = {
  CUSTOMERS: 'devCustomers',      // Referenced in 11 files
  PROJECTS: 'devProjects',        // Referenced in 11 files
  TASKS: 'devTasks',              // Referenced in 11 files
  RECORDS: 'dapiRecords',
  NOTES: 'devNotes',
  LINKS: 'devLinks',
  IMAGES: 'devImages',
  PROJECT_IMAGES: 'devProjectImages',
  PROJECT_LINKS: 'devProjectLinks',
  PROJECT_OBJECTIVES: 'devProjectObjectives',
  PROJECT_OBJ_STEPS: 'devProjectObjSteps'
};
```

**Removal Strategy:**
- Remove entire `Layouts` constant
- Replace references with backend endpoint paths
- Update import statements across 11+ files

### Action Constants
```javascript
// src/api/fileMaker.js
export const Actions = {
  READ: 'read',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  METADATA: 'metaData',
  DUPLICATE: 'duplicate'
};
```

**Removal Strategy:**
- Remove if only used with FileMaker API
- Keep if used as generic action types

---

## Removal Risk Assessment

### 🔴 HIGH RISK (Do Not Remove Until Final Phase)

**Files:**
1. `src/services/dataService.js` - Core routing logic
2. `src/api/fileMaker.js` - Primary bridge
3. `src/index.jsx` - App initialization
4. `src/context/AppStateContext.jsx` - State management

**Reason:** Breaking changes would affect entire application. Remove only after all dependent features migrated.

### 🟡 MEDIUM RISK (Remove After Feature Migration)

**Files:**
- All dual-mode API files (customers, projects, tasks, images)
- All dual-mode hooks (useCustomer, useProject, useLink)
- Service layer files with environment checks

**Reason:** Can remove FileMaker branches once backend integration confirmed working.

### 🟢 LOW RISK (Safe to Remove Now)

**Files:**
1. `src/components/examples/FileMakerExample.jsx` - Demo only
2. `src/api/fileMakerEdgeFunction.js` - Used by demo only
3. `src/services/debugFinancialSync.js` - Debug utility
4. Test files with FileMaker mocks - Update alongside code

**Reason:** Not used in production or easily replaceable.

### ⚠️ DEPRECATED (Remove After Data Migration)

**Files:**
1. `src/services/financialSyncService.js` - Marked deprecated
2. `src/services/dualWriteService.js` - Migration only

**Reason:** Used for one-time data migration. Remove after migration scripts complete.

---

## Replacement Requirements

### API Files (9 files need updates)

**Pattern to Replace:**
```javascript
// OLD: Dual-mode
if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
  return await fetchDataFromFileMaker({ layout: 'devCustomers', action: 'read' });
} else {
  return await backendApiCall('/api/customers');
}

// NEW: Backend only
return await backendApiCall('/api/customers');
```

**Files:**
- `src/api/customers.js` - ✅ Backend ready (just remove FM branches)
- `src/api/projects.js` - ⚠️ Verify backend endpoints exist
- `src/api/tasks.js` - ✅ Backend ready (remove feature flag)
- `src/api/images.js` - ⚠️ Verify Supabase storage implementation
- `src/api/notes.js` - ✅ Backend complete per CLAUDE.md

### Hook Files (3 files need updates)

- `src/hooks/useCustomer.js` - Remove FM branches
- `src/hooks/useProject.js` - Remove FM branches
- `src/hooks/useLink.js` - Remove FM branches

### Service Files (4 files need updates)

- `src/services/initializationService.js` - Simplify to Supabase only
- `src/services/linkService.js` - Remove FM branch
- `src/services/billableHoursService.js` - Verify data format
- `src/services/taskService.js` - Update logic

### Component Files (9 files need updates)

- `src/components/customers/CustomerForm.jsx` - Remove FM UI logic
- `src/components/customers/ActivityReportModal.jsx` - Remove FM check
- `src/components/financial/QboTestPanel.jsx` - ⚠️ QB integration dependency
- All others - Minor updates

---

## Backend Integration Status

### ✅ Complete
- **Customers:** Full backend API integration (per CLAUDE.md)
- **Notes:** Backend API complete (per CLAUDE.md)
- **Teams:** Supabase-backed (per CLAUDE.md)
- **Financial Records:** Direct Supabase RPC (per CLAUDE.md)
- **Prospects:** Supabase-only (always has been)

### ⚠️ Verify
- **Projects:** 25+ operations - confirm all backend endpoints exist
- **Tasks:** Backend API exists - verify completeness
- **Images:** Supabase storage - verify implementation
- **Links:** Backend endpoints needed
- **QuickBooks:** May require FileMaker scripts - confirm with backend team

### ❓ Unknown
- **Mailjet Service:** Uses FMGofer import - need full file review
- **PDF Reports:** May use FileMaker data format
- **Activity Reports:** May use FileMaker scripts

---

## Recommended Removal Sequence

### Phase 1: Safe Removals (Can Do Now)
1. Remove `src/components/examples/FileMakerExample.jsx`
2. Remove `src/api/fileMakerEdgeFunction.js`
3. Remove `src/services/debugFinancialSync.js`
4. Update test files to remove FileMaker mocks

### Phase 2: Feature-Specific Removals (After Backend Verification)
1. **Customers** - Remove FM branches (backend confirmed complete)
2. **Notes** - Remove FM branches (backend confirmed complete)
3. **Tasks** - Remove FM branches and feature flag
4. **Images** - Remove FM branches (verify Supabase storage)

### Phase 3: Complex Features (After Backend Endpoints Confirmed)
1. **Projects** - Remove FM branches (verify 25+ endpoints)
2. **Links** - Remove FM branches (confirm backend)
3. **Hooks** - Remove FM branches from useCustomer, useProject, useLink

### Phase 4: Core Infrastructure (Final Phase)
1. Simplify `src/services/dataService.js` - Remove FM routing
2. Simplify `src/index.jsx` - Remove FM detection
3. Simplify `src/components/auth/SignIn.jsx` - Remove FM auth
4. Update `src/context/AppStateContext.jsx` - Remove FM state
5. Remove `src/hooks/index.js` - useFileMakerBridge hook
6. Remove `src/api/fileMaker.js` - Entire file

### Phase 5: Cleanup
1. Remove `fm-gofer` from package.json
2. Remove FileMaker env vars from .env
3. Update CLAUDE.md documentation
4. Remove deprecated sync services
5. Update utility function names (dateUtils)
6. Remove FileMaker constants (Layouts, Actions)

### Phase 6: Data Migration Services (After Migration Complete)
1. Remove `src/services/financialSyncService.js`
2. Remove `src/services/dualWriteService.js`
3. Remove migration scripts

---

## Verification Checklist

Before removing FileMaker code:

- [ ] All features tested in backend-only mode
- [ ] QuickBooks integration confirmed working without FileMaker
- [ ] PDF report generation works with backend data
- [ ] Activity reports work with backend data
- [ ] Mailjet integration reviewed and updated
- [ ] All API endpoints return expected data format
- [ ] Image upload/download works via Supabase storage
- [ ] Project operations (25+ endpoints) all functional
- [ ] Link operations functional via backend
- [ ] Financial data migration complete
- [ ] Customer data migration complete
- [ ] Build succeeds without fm-gofer dependency
- [ ] All tests pass with updated mocks
- [ ] No console errors about missing FileMaker bridge

---

## Breaking Changes to Expect

### Immediate Impact (When Removing)

1. **Environment Detection Logic**
   - App will no longer detect/support FileMaker WebViewer
   - All authentication goes through Supabase
   - No more dual-mode routing

2. **API Layer**
   - All API calls route to backend only
   - No fallback to FileMaker Data API
   - Error messages change (no FileMaker-specific errors)

3. **Data Format**
   - FileMaker flat structure → Backend relational
   - Date formats may change (MM/DD/YYYY → YYYY-MM-DD)
   - Field names may change (snake_case vs camelCase)

4. **Authentication**
   - No auto-detection of FileMaker user
   - Always require Supabase login
   - Organization context required

5. **QuickBooks Integration**
   - May need alternative to FileMaker scripts
   - Confirm with backend team

### Build Impact

- Removing `fm-gofer` will break build until all imports removed
- TypeScript/ESLint may flag removed constants
- Tests will fail until mocks updated

---

## Files Not Found But Mentioned in CLAUDE.md

These files are mentioned in documentation but not found in source:

1. FileMaker environment variables (not in .env.example)
2. devTeams layout (mentioned but teams migrated to Supabase)
3. devTeamMembers layout (mentioned but teams migrated to Supabase)
4. devStaff layout (mentioned but teams migrated to Supabase)

**Action:** Update CLAUDE.md to reflect current state

---

## Appendix A: Complete File List by Category

### API Layer (10 files)
1. src/api/fileMaker.js ⚠️
2. src/api/fileMakerEdgeFunction.js ✅
3. src/api/customers.js 🔄
4. src/api/projects.js 🔄
5. src/api/tasks.js 🔄
6. src/api/images.js 🔄
7. src/api/financialRecords.js ✅
8. src/api/prospects.js ✅
9. src/api/customerActivity.js ⚠️
10. src/api/index.js ⚠️

### Services (15 files)
1. src/services/dataService.js ⚠️
2. src/services/initializationService.js ⚠️
3. src/services/dualWriteService.js 🗑️
4. src/services/financialSyncService.js 🗑️
5. src/services/debugFinancialSync.js 🗑️
6. src/services/linkService.js 🔄
7. src/services/taskService.js 🔄
8. src/services/projectService.js 🔄
9. src/services/billableHoursService.js ⚠️
10. src/services/salesService.js ⚠️
11. src/services/mailjetService.js ⚠️
12. src/services/pdfReportService.js ⚠️
13. src/services/recordQueueManager.js ⚠️
14. src/services/supabaseService.js ✅
15. src/services/index.js ⚠️

### Hooks (5 files)
1. src/hooks/index.js ⚠️
2. src/hooks/useCustomer.js 🔄
3. src/hooks/useProject.js 🔄
4. src/hooks/useLink.js 🔄
5. src/hooks/useFinancialSync.js ⚠️

### Components (14 files)
1. src/components/examples/FileMakerExample.jsx ✅
2. src/components/auth/SignIn.jsx ⚠️
3. src/components/layout/Sidebar.jsx 🔄
4. src/components/MainContent.jsx 🔄
5. src/components/customers/CustomerForm.jsx 🔄
6. src/components/customers/CustomerHeader.jsx ⚠️
7. src/components/customers/CustomerSettings.jsx ⚠️
8. src/components/customers/ConvertProspectModal.jsx ⚠️
9. src/components/customers/ActivityReportModal.jsx 🔄
10. src/components/financial/FinancialSyncPanel.jsx ⚠️
11. src/components/financial/QboTestPanel.jsx ⚠️
12. src/components/financial/ProjectReportButton.jsx ⚠️
13. src/components/financial/ProjectList.jsx ⚠️
14. src/components/projects/* (6 files) 🔄

### Context & State (2 files)
1. src/context/AppStateContext.jsx ⚠️
2. src/context/ProjectContext.jsx ⚠️
3. src/index.jsx ⚠️

### Utilities (6 files)
1. src/utils/dataMappers.js ⚠️
2. src/utils/verifyMappers.js ⚠️
3. src/utils/dateUtils.js 🔄
4. src/utils/index.js ⚠️
5. src/utils/pdfUtils.test.js ⚠️
6. src/utils/pdfReport*.js (4 files) ⚠️

### Configuration (2 files)
1. src/config.js 🔄
2. .env (environment variables) 🔄

### Tests (22 files)
- All test files with FileMaker references

### Fixtures (4 files)
1. src/__fixtures__/tasks.js
2. src/__fixtures__/financialRecords.js
3. src/__fixtures__/timers.js
4. src/__tests__/fixtures/projectFixtures.js

**Legend:**
- ⚠️ Critical - High risk, remove last
- 🔄 Dual-mode - Remove FM branch after verification
- ✅ Safe - Can remove now or no changes needed
- 🗑️ Deprecated - Remove after data migration

---

## Appendix B: Import Dependency Graph

### Critical Dependencies (files that import FileMaker core)

```
fm-gofer (npm package)
  ├─ src/api/fileMaker.js
  ├─ src/services/dataService.js
  └─ src/services/mailjetService.js

src/api/fileMaker.js (exports)
  ├─ fetchDataFromFileMaker
  │  ├─ src/services/initializationService.js
  │  ├─ src/api/tasks.js
  │  └─ src/api/* (various)
  ├─ Layouts constant
  │  └─ src/api/* (11+ files)
  ├─ Actions constant
  │  └─ src/api/* (11+ files)
  └─ generateBackendAuthHeader
     └─ src/api/* (backend calls)

src/services/dataService.js (exports)
  ├─ ENVIRONMENT_TYPES
  │  ├─ src/index.jsx
  │  ├─ src/api/customers.js
  │  ├─ src/api/projects.js
  │  ├─ src/hooks/useCustomer.js
  │  └─ src/components/* (various)
  ├─ getEnvironmentContext
  │  └─ Most API and service files
  └─ setEnvironmentContext
     └─ src/index.jsx

src/hooks/index.js
  └─ useFileMakerBridge
     └─ (rarely used, safe to remove)
```

---

## Appendix C: Backend API Verification Checklist

Use this checklist to verify backend endpoints exist before removing FileMaker branches:

### Customers ✅
- [x] GET /api/customers
- [x] GET /api/customers/:id
- [x] POST /api/customers
- [x] PUT /api/customers/:id
- [x] DELETE /api/customers/:id
- [x] GET /api/customers/search
- [x] PATCH /api/customers/:id/status

### Projects ⚠️
- [ ] GET /api/projects
- [ ] GET /api/projects/:id
- [ ] POST /api/projects
- [ ] PUT /api/projects/:id
- [ ] DELETE /api/projects/:id
- [ ] GET /api/projects/:id/tasks
- [ ] POST /api/projects/:id/notes
- [ ] GET /api/projects/:id/notes
- [ ] POST /api/projects/:id/links
- [ ] GET /api/projects/:id/links
- [ ] (20+ more endpoints - see projects.js for full list)

### Tasks ⚠️
- [ ] GET /api/tasks
- [ ] GET /api/tasks/:id
- [ ] POST /api/tasks
- [ ] PUT /api/tasks/:id
- [ ] DELETE /api/tasks/:id
- [ ] POST /api/tasks/:id/notes
- [ ] GET /api/tasks/:id/notes

### Images ⚠️
- [ ] POST /api/projects/:id/images (or Supabase storage)
- [ ] GET /api/projects/:id/images
- [ ] DELETE /api/images/:id

### Links ⚠️
- [ ] POST /api/projects/:id/links
- [ ] GET /api/projects/:id/links
- [ ] DELETE /api/links/:id
- [ ] PUT /api/links/:id

### Financial Records ✅
- [x] Supabase RPC: create_financial_record
- [x] Supabase RPC: get_financial_records
- [x] Supabase RPC: mark_records_billed
- [x] Supabase RPC: get_monthly_summary
- [x] Supabase RPC: get_quarterly_summary
- [x] Supabase RPC: get_yearly_summary

### Notes ✅
- [x] POST /api/projects/:id/notes
- [x] GET /api/projects/:id/notes
- [x] PATCH /api/notes/:id
- [x] DELETE /api/notes/:id
- [x] POST /api/tasks/:id/notes
- [x] GET /api/tasks/:id/notes
- [x] POST /api/customers/:id/notes
- [x] GET /api/customers/:id/notes

### Teams ✅
- [x] Supabase direct access (not backend API)

### QuickBooks ❓
- [ ] Verify QB integration approach (FileMaker scripts vs backend)

---

## End of Report

**Next Steps:**
1. Review backend API verification checklist
2. Test each feature in backend-only mode
3. Begin Phase 1 safe removals
4. Track progress through removal phases
5. Update CLAUDE.md as changes are made
6. Document any issues encountered

**Estimated Effort:**
- Phase 1: 2-4 hours
- Phase 2: 8-16 hours
- Phase 3: 16-24 hours
- Phase 4: 8-12 hours
- Phase 5: 4-6 hours
- Phase 6: 2-4 hours
- **Total:** 40-66 hours

**Risk Level:** MEDIUM-HIGH
- High complexity due to widespread FileMaker integration
- Thorough testing required after each phase
- Backend API completeness must be verified
- QuickBooks integration needs special attention
