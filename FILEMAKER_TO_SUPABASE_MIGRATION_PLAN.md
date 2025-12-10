# FileMaker to Supabase Migration Plan

**Document Version:** 1.0
**Date:** 2025-12-10
**Status:** Planning Phase

## Executive Summary

This document outlines a comprehensive plan to remove all FileMaker integration from the Clarity CRM Frontend application, transitioning to a Supabase-only architecture. The application currently operates in dual environments (FileMaker WebViewer and Standalone Web App) with complex synchronization logic. This migration will simplify the architecture, reduce technical debt, and modernize the application stack.

**Migration Goal:** Remove all FileMaker dependencies and establish Supabase as the single source of truth for all data persistence.

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Migration Strategy](#migration-strategy)
3. [Detailed Migration Steps](#detailed-migration-steps)
4. [Data Migration Requirements](#data-migration-requirements)
5. [Testing Strategy](#testing-strategy)
6. [Rollback Plan](#rollback-plan)
7. [Timeline and Milestones](#timeline-and-milestones)
8. [Risk Assessment](#risk-assessment)

---

## Current State Analysis

### FileMaker Integration Points

The application has FileMaker integrations across multiple layers:

#### 1. **Authentication Layer**
- **Location:** [src/components/auth/SignIn.jsx](src/components/auth/SignIn.jsx)
- **Integration:** Detects FileMaker environment via `window.FileMaker` and `window.FMGofer`
- **Behavior:** Silent authentication for FileMaker users, form-based auth for web app users
- **Impact:** Medium - affects initial app boot and user flow

#### 2. **Environment Detection**
- **Location:** [src/services/dataService.js](src/services/dataService.js)
- **Constants:**
  - `ENVIRONMENT_TYPES.FILEMAKER` vs `ENVIRONMENT_TYPES.WEBAPP`
  - `AUTH_METHODS.FILEMAKER` vs `AUTH_METHODS.SUPABASE`
- **Function:** `setEnvironmentContext()` determines which data layer to use
- **Impact:** High - core routing mechanism for all data operations

#### 3. **Data Service Layer**
- **Location:** [src/services/dataService.js](src/services/dataService.js)
- **Integration:**
  - Request interceptor routes FileMaker requests through `convertToFileMakerCall()`
  - Response interceptor handles FileMaker-specific response formats
  - Uses `FMGofer.PerformScript()` for async FileMaker operations
- **Impact:** High - affects all CRUD operations

#### 4. **FileMaker API Module**
- **Location:** [src/api/fileMaker.js](src/api/fileMaker.js)
- **Key Functions:**
  - `fetchDataFromFileMaker()` - Main FileMaker data fetching function
  - `handleFileMakerNativeCall()` - Native FileMaker script execution
  - `callBackendAPI()` - Backend proxy for FileMaker operations
  - `generateBackendAuthHeader()` - HMAC authentication
  - `initializeQuickBooks()` - QuickBooks integration via FileMaker
- **Dependencies:** fm-gofer (npm package)
- **Impact:** High - used by all API modules that need FileMaker compatibility

#### 5. **Initialization Service**
- **Location:** [src/services/initializationService.js](src/services/initializationService.js)
- **Integration:**
  - `waitForFileMaker()` - Waits for FileMaker bridge to be ready
  - `loadUserContext()` - Fetches user context from FileMaker
  - `fetchDataFromFileMaker()` import for context loading
- **Impact:** High - affects app startup sequence

#### 6. **Dual-Write Service**
- **Location:** [src/services/dualWriteService.js](src/services/dualWriteService.js)
- **Purpose:** Synchronizes write operations between FileMaker and Supabase
- **Key Functions:**
  - `withDualWrite()` - Wraps FileMaker operations with Supabase sync
  - `stopTimerWithDualWrite()` - Timer operations with dual persistence
- **Impact:** High - ensures data consistency during migration period

#### 7. **Individual API Modules**
FileMaker imports found in:
- [src/api/customers.js](src/api/customers.js)
- [src/api/projects.js](src/api/projects.js)
- [src/api/tasks.js](src/api/tasks.js)
- [src/api/teams.js](src/api/teams.js)
- [src/api/notes.js](src/api/notes.js)
- [src/api/links.js](src/api/links.js)
- [src/api/financialRecords.js](src/api/financialRecords.js)
- [src/api/customerActivity.js](src/api/customerActivity.js)
- [src/api/prospects.js](src/api/prospects.js)
- [src/api/mailjet.js](src/api/mailjet.js)

**Pattern:** Most modules import `fetchDataFromFileMaker` but use environment detection to route to appropriate backend

#### 8. **Custom Hooks**
- **Location:** [src/hooks/](src/hooks/)
- **Hook:** `useFileMakerBridge` (imported in [src/index.jsx](src/index.jsx))
- **Purpose:** Manages FileMaker bridge readiness state
- **Impact:** Medium - used for initialization sequencing

#### 9. **React Components**
- **Main App:** [src/index.jsx](src/index.jsx) - Uses `useFileMakerBridge` hook and environment detection
- **Example Component:** [src/components/examples/FileMakerExample.jsx](src/components/examples/FileMakerExample.jsx)
- **Financial Components:** QBO integration panels that may use FileMaker bridge

#### 10. **NPM Dependencies**
- **Package:** `fm-gofer` (version ^1.10.0)
- **Location:** [package.json](package.json)
- **Purpose:** FileMaker JavaScript bridge library
- **Impact:** Low - easy to remove once code dependencies are eliminated

#### 11. **Build & Deployment Scripts**
- **Scripts:**
  - `npm run deploy-to-fm` - Build and deploy to FileMaker server
  - `npm run upload` - Upload to FileMaker server
- **Impact:** Low - can be deprecated or repurposed

---

## Migration Strategy

### Phase-Based Approach

The migration will be executed in **4 phases** to minimize risk and ensure business continuity:

1. **Phase 1: Preparation & Data Verification** (Weeks 1-2)
2. **Phase 2: Code Refactoring & Supabase-Only Mode** (Weeks 3-6)
3. **Phase 3: Testing & Validation** (Weeks 7-8)
4. **Phase 4: Deployment & FileMaker Removal** (Weeks 9-10)

### Key Principles

1. **Data Integrity First:** Ensure all FileMaker data exists in Supabase before removal
2. **Incremental Changes:** Make small, testable changes rather than a "big bang" migration
3. **Backward Compatibility:** Maintain ability to rollback if critical issues arise
4. **Feature Parity:** Ensure Supabase backend provides all functionality currently served by FileMaker
5. **Zero Data Loss:** Implement comprehensive data validation and reconciliation

---

## Detailed Migration Steps

### Phase 1: Preparation & Data Verification (Weeks 1-2)

#### 1.1 Data Audit & Migration Verification

**Objective:** Ensure all FileMaker data is present in Supabase

**Tasks:**
1. **Create data comparison script**
   - Query all FileMaker layouts (devCustomers, devProjects, devTasks, etc.)
   - Query corresponding Supabase tables
   - Generate diff report showing:
     - Record counts per table
     - Missing records in Supabase
     - Schema differences
     - Data integrity issues

2. **Verify critical tables:**
   - `customers` → FileMaker `devCustomers`
   - `projects` → FileMaker `devProjects`
   - `tasks` → FileMaker `devTasks`
   - `teams` → FileMaker `devTeams`
   - `staff` → FileMaker `devStaff`
   - `notes` → FileMaker `devNotes`
   - `links` → FileMaker `devLinks`
   - `financial_records` → FileMaker `devFinancialRecords`
   - `customer_sales` → FileMaker billable records

3. **Complete missing data migration**
   - Use existing `scripts/sync-missing-records.js` as reference
   - Create migration scripts for any missing data
   - Validate foreign key relationships

**Deliverables:**
- Data audit report with record counts and discrepancies
- Migration scripts for missing data
- Validation that Supabase has 100% data parity

#### 1.2 Backend API Feature Verification

**Objective:** Confirm Backend API supports all FileMaker operations

**Tasks:**
1. **Catalog all FileMaker operations**
   - Review [src/api/fileMaker.js](src/api/fileMaker.js) `Layouts` and `Actions` constants
   - Document all FileMaker script calls (e.g., `JS * Fetch Data`)
   - List all FileMaker-only features

2. **Verify Backend API equivalents**
   - Check each operation against `https://api.claritybusinesssolutions.ca/docs`
   - Test CRUD operations for all entities
   - Confirm HMAC authentication works correctly

3. **Identify functionality gaps**
   - Document any FileMaker features not available in Backend API
   - Plan implementation for missing features
   - **Special attention to:**
     - QuickBooks integration (currently uses FileMaker script)
     - Timer operations (stop/start/adjust)
     - Financial record creation
     - Customer activity tracking

**Deliverables:**
- Feature parity matrix (FileMaker → Backend API)
- List of missing features with implementation plans
- Backend API test results for all critical operations

#### 1.3 Environment Configuration

**Objective:** Prepare configuration for Supabase-only operation

**Tasks:**
1. **Update `.env` variables**
   - Review all `VITE_FM_*` variables
   - Ensure `VITE_SUPABASE_*` variables are complete
   - Verify `VITE_SECRET_KEY` is set for HMAC auth
   - Add feature flag: `VITE_FILEMAKER_ENABLED=false` for controlled migration

2. **Create migration feature flag system**
   ```javascript
   // In config.js or new file
   export const MIGRATION_FLAGS = {
     FILEMAKER_ENABLED: import.meta.env.VITE_FILEMAKER_ENABLED === 'true',
     DUAL_WRITE_ENABLED: import.meta.env.VITE_DUAL_WRITE_ENABLED === 'true',
     FORCE_SUPABASE_MODE: import.meta.env.VITE_FORCE_SUPABASE_MODE === 'true'
   };
   ```

3. **Document configuration changes**
   - Update README with new env vars
   - Create migration runbook

**Deliverables:**
- Updated `.env.example` file
- Feature flag system for controlled migration
- Configuration documentation

---

### Phase 2: Code Refactoring & Supabase-Only Mode (Weeks 3-6)

#### 2.1 Remove Environment Detection Logic

**Objective:** Eliminate dual-environment code paths

**Files to Modify:**

1. **[src/components/auth/SignIn.jsx](src/components/auth/SignIn.jsx)**
   - **Changes:**
     - Remove `detectFileMaker()` function (lines 24-66)
     - Remove `onFileMakerDetected` and `onDetectionComplete` props
     - Remove `useEffect` for FileMaker detection (lines 69-72)
     - Keep only Supabase authentication form
   - **Result:** Component becomes pure Supabase auth form

2. **[src/services/dataService.js](src/services/dataService.js)**
   - **Changes:**
     - Remove `ENVIRONMENT_TYPES` constant (keep for backward compat initially)
     - Remove `AUTH_METHODS.FILEMAKER`
     - Remove `currentEnvironment` global state
     - Remove `setEnvironmentContext()` and `getEnvironmentContext()`
     - Remove `convertToFileMakerCall()` function (lines 108-161)
     - Simplify request interceptor - remove FileMaker routing
     - Simplify response interceptor - remove FileMaker response handling
     - Remove `environmentAPI.fileMaker` object
     - Remove `convertFileMakerParamsToHTTP()` (can keep as reference)
   - **Result:** Clean HTTP client with only backend API support

3. **[src/index.jsx](src/index.jsx)**
   - **Changes:**
     - Remove `useFileMakerBridge` import and usage (lines 9, 28-32)
     - Remove `handleFileMakerDetected` callback (lines 117-139)
     - Remove FileMaker-specific initialization logic
     - Remove `onFileMakerDetected` prop from `SignIn` component
     - Update `SignIn` to only use `onSupabaseAuth`
   - **Result:** Streamlined initialization flow

#### 2.2 Refactor API Layer

**Objective:** Remove all FileMaker API calls

**Strategy:** For each API module:

1. **Remove FileMaker imports**
   ```javascript
   // Remove these lines:
   import { fetchDataFromFileMaker } from './fileMaker';
   ```

2. **Convert to direct Backend API calls**
   ```javascript
   // Before:
   const result = await fetchDataFromFileMaker({
     layout: 'devCustomers',
     action: 'read',
     recordId: id
   });

   // After:
   const response = await dataService.get(`/customers/${id}`);
   const result = response.data;
   ```

3. **Update error handling**
   - Remove FileMaker-specific error codes
   - Use standard HTTP error handling

**Files to Modify (16 total):**

1. **[src/api/customers.js](src/api/customers.js)**
   - Replace FileMaker calls with `dataService.get('/customers')`, etc.
   - Update response format expectations

2. **[src/api/projects.js](src/api/projects.js)**
   - Replace FileMaker calls with `/projects` endpoints
   - Update project creation/update logic

3. **[src/api/tasks.js](src/api/tasks.js)**
   - Replace FileMaker timer operations with backend equivalents
   - Update task CRUD operations
   - **Critical:** Ensure timer start/stop works with backend

4. **[src/api/teams.js](src/api/teams.js)**
   - Replace FileMaker team operations
   - Update team member management

5. **[src/api/notes.js](src/api/notes.js)**
   - Replace FileMaker note operations

6. **[src/api/links.js](src/api/links.js)**
   - Replace FileMaker link operations

7. **[src/api/financialRecords.js](src/api/financialRecords.js)**
   - Replace FileMaker financial record operations
   - **Critical:** Verify billable hours tracking

8. **[src/api/customerActivity.js](src/api/customerActivity.js)**
   - Replace FileMaker activity tracking

9. **[src/api/prospects.js](src/api/prospects.js)**
   - Remove FileMaker conversion logic (prospects are Supabase-only)

10. **[src/api/mailjet.js](src/api/mailjet.js)**
    - Remove any FileMaker dependencies

**Remaining files:** Similar pattern for all other API modules

**Deliverables:**
- All API modules using Backend API exclusively
- FileMaker import statements removed
- Updated error handling

#### 2.3 Remove Dual-Write Service

**Objective:** Eliminate synchronization logic

**Files to Modify:**

1. **[src/services/dualWriteService.js](src/services/dualWriteService.js)**
   - **Option A (Recommended):** Archive file, add deprecation notice
   - **Option B:** Delete file entirely after verifying no active usage

2. **Update any callers:**
   - Search for `withDualWrite`, `stopTimerWithDualWrite`
   - Replace with direct backend calls
   - Remove dual-write configuration

**Example Refactor:**
```javascript
// Before:
import { stopTimerWithDualWrite } from './dualWriteService';
const result = await stopTimerWithDualWrite(params, organizationId);

// After:
import { stopTaskTimerAPI } from '../api/tasks';
const result = await stopTaskTimerAPI(params);
```

#### 2.4 Refactor Initialization Service

**Objective:** Remove FileMaker initialization logic

**File:** [src/services/initializationService.js](src/services/initializationService.js)

**Changes:**
1. Remove `waitForFileMaker()` method (lines 14-31)
2. Remove `loadUserContext()` method that calls FileMaker (lines 33-45)
3. Update `fetchSupabaseUserId()` to be the primary user loading method
4. Simplify initialization flow to:
   ```javascript
   // Simplified flow:
   async initialize(user, setUser) {
     this.currentPhase = 'loading_user';
     const { supabaseUserId, supabaseOrgId } = await this.fetchSupabaseUserId(user, setUser);

     this.currentPhase = 'loading_products';
     await this.loadProducts(supabaseOrgId);

     this.currentPhase = 'complete';
   }
   ```

#### 2.5 Update Custom Hooks

**Objective:** Remove FileMaker-specific hooks

**Files to Modify:**

1. **[src/hooks/index.js](src/hooks/index.js)**
   - Remove `useFileMakerBridge` export
   - Update hook documentation

2. **Find and update `useFileMakerBridge.js`** (if exists)
   - Archive or delete the file
   - Update all consumers to remove FileMaker readiness checks

3. **Update other hooks:**
   - [src/hooks/useCustomer.js](src/hooks/useCustomer.js)
   - [src/hooks/useProject.js](src/hooks/useProject.js)
   - [src/hooks/useTask.js](src/hooks/useTask.js)
   - Remove any FileMaker-specific logic or feature flags

#### 2.6 Remove FileMaker API Module

**Objective:** Archive/delete FileMaker integration code

**Files:**

1. **[src/api/fileMaker.js](src/api/fileMaker.js)**
   - **Option A (Recommended):** Move to `archive/` directory with timestamp
   - **Option B:** Delete after verifying no imports remain

2. **[src/api/fileMakerEdgeFunction.js](src/api/fileMakerEdgeFunction.js)**
   - Same approach as above

3. **Edge Functions:**
   - [supabase/functions/filemaker-api/index.ts](supabase/functions/filemaker-api/index.ts)
   - Archive or delete if no longer needed

**Before deletion, verify:**
```bash
# Search for any remaining imports
grep -r "from.*fileMaker" src/
grep -r "import.*fileMaker" src/
```

#### 2.7 Update QuickBooks Integration

**Objective:** Move QuickBooks integration from FileMaker to direct backend

**Current State:**
- [src/api/fileMaker.js](src/api/fileMaker.js) has `initializeQuickBooks()` function
- Calls FileMaker script: `Initialize QB via JS`

**New Implementation:**

1. **Create Supabase-only QuickBooks service:**
   ```javascript
   // In src/services/quickbooksService.js or update financialSyncService.js
   export async function initializeQuickBooks(params) {
     const { customerId, recordsByProject } = params;

     // Call backend API endpoint directly
     const response = await dataService.post('/quickbooks/initialize', {
       customer_id: customerId,
       records: recordsByProject
     });

     return response;
   }
   ```

2. **Update callers:**
   - Search for `initializeQuickBooks` usage
   - Replace FileMaker script call with backend API call

3. **Verify backend endpoint exists:**
   - Check `https://api.claritybusinesssolutions.ca/docs`
   - Implement if missing

#### 2.8 Clean Up Configuration

**Objective:** Remove FileMaker configuration

**Files to Update:**

1. **[src/config.js](src/config.js)**
   - Remove FileMaker configuration variables
   - Keep only Supabase and backend config

2. **[package.json](package.json)**
   - Remove `fm-gofer` dependency
   - Update/remove `deploy-to-fm` and `upload` scripts
   - Consider renaming for clarity:
     ```json
     "deploy": "npm run build && npm run upload-to-server",
     "upload-to-server": "node ./scripts/upload"
     ```

3. **`.env` files**
   - Remove `VITE_FM_*` variables
   - Update `.env.example` to remove FileMaker vars

4. **Delete build scripts (optional):**
   - `scripts/upload.js` (if FileMaker-specific)
   - `scripts/deploy-to-fm.js` (if exists)

---

### Phase 3: Testing & Validation (Weeks 7-8)

#### 3.1 Unit Testing

**Objective:** Ensure all modules work without FileMaker

**Test Cases:**

1. **Authentication Flow**
   - User can sign in with Supabase credentials
   - Session is maintained across page refreshes
   - Sign out works correctly

2. **Data Service**
   - CRUD operations for all entities
   - Error handling for failed requests
   - HMAC authentication headers are correct

3. **Custom Hooks**
   - Customer operations (load, create, update, delete)
   - Project operations
   - Task operations (including timer)
   - Team operations

4. **API Modules**
   - Each API module can perform CRUD operations
   - Responses are formatted correctly
   - Errors are handled gracefully

**Commands:**
```bash
npm test                    # Run all Jest tests
npm run test:supabase       # Test Supabase service
npm run test:edge-function  # Test edge functions
```

#### 3.2 Integration Testing

**Objective:** Test end-to-end workflows

**Critical User Journeys:**

1. **Customer Management Journey**
   - Sign in → View customers → Select customer → View details
   - Create new customer → Save → Verify in Supabase
   - Update customer → Save → Verify changes
   - Delete customer → Verify removal

2. **Project & Task Management Journey**
   - Create project for customer → Save → Verify
   - Create task for project → Save → Verify
   - Start timer → Stop timer → Verify financial record created
   - View project details → Verify all data loads

3. **Team Management Journey**
   - Create team → Add staff → Save → Verify
   - Update team → Verify changes
   - View team projects and stats

4. **Financial Operations Journey**
   - View unbilled hours for customer
   - Generate invoice via QuickBooks integration
   - Verify financial records are created
   - Mark records as billed

5. **Proposal Creation Journey**
   - Create proposal for customer
   - Add deliverables and packages
   - Send proposal email
   - Verify proposal stored in Supabase

**Tools:**
- Manual testing in development environment
- Automated E2E tests (if infrastructure exists)
- User acceptance testing with stakeholders

#### 3.3 Performance Testing

**Objective:** Ensure performance is acceptable

**Metrics to Measure:**

1. **Page Load Times**
   - Initial app load
   - Customer list load
   - Project details load
   - Task list load

2. **API Response Times**
   - GET requests (list and detail views)
   - POST/PUT requests (create/update)
   - DELETE requests

3. **Database Query Performance**
   - Complex queries (e.g., project stats with tasks)
   - Search operations
   - Filtering and sorting

**Comparison:**
- Baseline: Current FileMaker performance
- Target: Supabase-only performance
- Acceptable: Within 20% of baseline or better

#### 3.4 Data Validation

**Objective:** Verify data integrity after migration

**Validation Steps:**

1. **Record Counts**
   - Compare record counts between FileMaker and Supabase
   - Verify all tables match

2. **Sample Data Verification**
   - Select random samples from each table
   - Verify all fields match between systems
   - Check foreign key relationships

3. **Financial Data Accuracy**
   - Verify all billable hours are present
   - Check invoice records
   - Validate customer sales data

4. **Audit Trail**
   - Verify created_at/updated_at timestamps
   - Check user attribution for changes

---

### Phase 4: Deployment & FileMaker Removal (Weeks 9-10)

#### 4.1 Staging Deployment

**Objective:** Deploy to staging environment for final testing

**Steps:**

1. **Build application:**
   ```bash
   npm run build
   ```

2. **Deploy to staging server:**
   ```bash
   npm run deploy
   ```

3. **Update environment variables:**
   - Set `VITE_FILEMAKER_ENABLED=false`
   - Verify all Supabase variables are correct

4. **Run smoke tests:**
   - Test critical user journeys
   - Verify authentication
   - Test data operations

5. **Stakeholder review:**
   - Invite key users to test staging
   - Gather feedback
   - Fix any critical issues

#### 4.2 Production Deployment

**Objective:** Deploy Supabase-only version to production

**Pre-Deployment Checklist:**

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Performance benchmarks met
- [ ] Data validation complete
- [ ] Stakeholder sign-off received
- [ ] Rollback plan documented and tested
- [ ] Support team notified
- [ ] Documentation updated

**Deployment Steps:**

1. **Create backup:**
   ```bash
   # Backup Supabase database
   ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db pg_dump -U postgres -d postgres > /backup/clarity_crm_pre_migration_$(date +%Y%m%d).sql"
   ```

2. **Deploy application:**
   ```bash
   npm run build
   npm run deploy
   ```

3. **Update environment variables in production:**
   - Set `VITE_FILEMAKER_ENABLED=false`
   - Verify all configuration

4. **Monitor application:**
   - Watch error logs
   - Monitor API response times
   - Check user activity

5. **Verify critical operations:**
   - Test authentication
   - Test data operations
   - Test financial operations

#### 4.3 Code Cleanup

**Objective:** Remove all FileMaker code from repository

**Files to Delete:**

1. **API Files:**
   - `src/api/fileMaker.js`
   - `src/api/fileMakerEdgeFunction.js`

2. **Services:**
   - `src/services/dualWriteService.js`

3. **Edge Functions:**
   - `supabase/functions/filemaker-api/index.ts` (if not needed)

4. **Hooks:**
   - `src/hooks/useFileMakerBridge.js` (if exists)

5. **Components:**
   - `src/components/examples/FileMakerExample.jsx`

6. **Scripts:**
   - Any FileMaker-specific deployment scripts

**Constants and Types to Update:**

1. **Remove from codebase:**
   - `ENVIRONMENT_TYPES.FILEMAKER`
   - `AUTH_METHODS.FILEMAKER`
   - All FileMaker layout constants
   - All FileMaker action constants

**Git Cleanup:**
```bash
git rm src/api/fileMaker.js
git rm src/api/fileMakerEdgeFunction.js
git rm src/services/dualWriteService.js
git rm src/components/examples/FileMakerExample.jsx
git commit -m "Remove FileMaker integration code"
```

#### 4.4 Dependency Cleanup

**Objective:** Remove unused dependencies

**Update [package.json](package.json):**

1. **Remove dependencies:**
   ```bash
   npm uninstall fm-gofer
   ```

2. **Clean up scripts:**
   ```json
   {
     "scripts": {
       // Remove these:
       - "deploy-to-fm": "npm run build && npm run upload",

       // Keep/rename these:
       "deploy": "npm run build && npm run upload",
       "upload": "node ./scripts/upload"
     }
   }
   ```

3. **Regenerate lock file:**
   ```bash
   npm install
   ```

#### 4.5 Documentation Update

**Objective:** Update all documentation to reflect Supabase-only architecture

**Files to Update:**

1. **[CLAUDE.md](CLAUDE.md)**
   - Remove all FileMaker references
   - Update "Architecture Overview" section
   - Remove "FileMaker Integration" section
   - Update environment detection documentation
   - Simplify authentication flow description

2. **[README.md](README.md)**
   - Remove FileMaker setup instructions
   - Update environment variables section
   - Simplify architecture description

3. **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**
   - Remove dual-environment documentation
   - Update data flow diagrams
   - Simplify layer responsibilities

4. **[BACKEND_INTEGRATION_GUIDE.md](BACKEND_INTEGRATION_GUIDE.md)**
   - Remove FileMaker API references
   - Update to show Supabase-only integration

5. **Create migration document:**
   - Archive this document for historical reference
   - Document any lessons learned
   - Note any breaking changes

---

## Data Migration Requirements

### Critical Data Entities

Ensure all data exists in Supabase before removing FileMaker:

#### 1. Customers
- **FileMaker Layout:** `devCustomers`
- **Supabase Table:** `customers`
- **Verification:**
  - Record count matches
  - All custom fields mapped
  - Relationships to projects maintained

#### 2. Projects
- **FileMaker Layout:** `devProjects`
- **Supabase Table:** `projects`
- **Verification:**
  - All projects have valid customer_id
  - Project status values match
  - Timeline data preserved

#### 3. Tasks
- **FileMaker Layout:** `devTasks`
- **Supabase Table:** `tasks`
- **Verification:**
  - All tasks have valid project_id
  - Timer data intact
  - Task relationships preserved

#### 4. Financial Records
- **FileMaker Layout:** `devFinancialRecords`
- **Supabase Table:** `customer_sales`
- **Verification:**
  - All billable hours recorded
  - Invoice data complete
  - QuickBooks sync status preserved

#### 5. Teams
- **FileMaker Layout:** `devTeams`, `devStaff`
- **Supabase Tables:** `teams`, `staff`, `team_members`
- **Verification:**
  - All team members mapped
  - Team hierarchies preserved

#### 6. Notes & Links
- **FileMaker Layouts:** `devNotes`, `devLinks`
- **Supabase Tables:** `notes`, `links`
- **Verification:**
  - All notes/links have valid parent references
  - Attachment data preserved

### Data Migration Script Template

```javascript
// scripts/final-data-migration.js
import { createClient } from '@supabase/supabase-js';
import { fetchDataFromFileMaker } from '../src/api/fileMaker.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function migrateEntity(fmLayout, supabaseTable, transformer) {
  console.log(`Migrating ${fmLayout} to ${supabaseTable}...`);

  // Fetch all records from FileMaker
  const fmData = await fetchDataFromFileMaker({
    layout: fmLayout,
    action: 'read'
  });

  // Transform data for Supabase
  const records = fmData.response.data.map(transformer);

  // Upsert to Supabase
  const { data, error } = await supabase
    .from(supabaseTable)
    .upsert(records, { onConflict: 'filemaker_record_id' });

  if (error) {
    console.error(`Error migrating ${fmLayout}:`, error);
    return { success: false, error };
  }

  console.log(`✓ Migrated ${records.length} records from ${fmLayout}`);
  return { success: true, count: records.length };
}

// Run migration
async function runMigration() {
  const results = await Promise.all([
    migrateEntity('devCustomers', 'customers', transformCustomer),
    migrateEntity('devProjects', 'projects', transformProject),
    migrateEntity('devTasks', 'tasks', transformTask),
    // ... other entities
  ]);

  console.log('Migration complete:', results);
}

runMigration();
```

---

## Testing Strategy

### Test Coverage Requirements

Minimum test coverage targets:

- **Unit Tests:** 80% code coverage
- **Integration Tests:** All critical user journeys
- **E2E Tests:** Top 10 user workflows
- **Performance Tests:** All API endpoints

### Test Environments

1. **Local Development:**
   - Use Supabase local instance or dev database
   - Mock external services (QuickBooks, Mailjet)

2. **Staging:**
   - Full Supabase production instance (staging project)
   - Real external service integrations (test mode)

3. **Production:**
   - Production Supabase instance
   - Real external services

### Regression Testing

After each phase, run full regression suite:

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Test specific services
npm run test:supabase
npm run test:edge-function
```

### User Acceptance Testing (UAT)

**Participants:**
- 3-5 key internal users
- 1-2 external beta customers (optional)

**Duration:** 1 week in staging environment

**Focus Areas:**
- Authentication and session management
- Customer and project creation
- Task and timer operations
- Financial operations and invoicing
- Reporting and analytics

---

## Rollback Plan

### Rollback Triggers

Initiate rollback if any of the following occur:

1. **Critical Data Loss:**
   - More than 1% of records missing or corrupted
   - Financial data discrepancies

2. **System Unavailability:**
   - Application down for more than 15 minutes
   - API error rate above 5%

3. **Performance Degradation:**
   - Page load times increase by more than 50%
   - API response times exceed 5 seconds

4. **Business Impact:**
   - Users cannot complete critical workflows
   - Customer-facing operations affected

### Rollback Procedure

**Phase 1 & 2 (Development):**
- Simply revert to previous Git commit
- No data migration needed

**Phase 3 (Staging):**
1. Stop the staging deployment
2. Restore from pre-deployment backup
3. Revert code to stable branch
4. Restart staging environment

**Phase 4 (Production):**
1. **Immediate action:**
   - Set `VITE_FILEMAKER_ENABLED=true` in environment
   - Redeploy previous stable version
   - Notify users of temporary instability

2. **Data restoration:**
   ```bash
   # Restore Supabase database from backup
   ssh marcus@backend.claritybusinesssolutions.ca "docker exec -i supabase-db psql -U postgres -d postgres < /backup/clarity_crm_pre_migration_YYYYMMDD.sql"
   ```

3. **Verification:**
   - Test critical workflows
   - Verify data integrity
   - Monitor for errors

4. **Post-rollback:**
   - Conduct root cause analysis
   - Document lessons learned
   - Plan remediation

### Rollback Testing

**Before production deployment:**
- Practice rollback procedure in staging
- Verify backup restoration works
- Time the rollback process (target: < 30 minutes)

---

## Timeline and Milestones

### High-Level Timeline (10 Weeks)

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| **Phase 1: Preparation** | Weeks 1-2 | Data audit complete, Backend API verified, Feature flags ready |
| **Phase 2: Refactoring** | Weeks 3-6 | All FileMaker code removed, Supabase-only mode functional |
| **Phase 3: Testing** | Weeks 7-8 | All tests passing, Performance validated, UAT complete |
| **Phase 4: Deployment** | Weeks 9-10 | Production deployment, Code cleanup, Documentation updated |

### Detailed Milestones

#### Week 1
- [ ] Complete data audit across all tables
- [ ] Document data discrepancies
- [ ] Create data migration scripts

#### Week 2
- [ ] Verify Backend API feature parity
- [ ] Test HMAC authentication
- [ ] Set up feature flag system
- [ ] Complete missing data migration

#### Week 3
- [ ] Refactor SignIn component (remove FileMaker detection)
- [ ] Refactor dataService (remove environment routing)
- [ ] Refactor index.jsx (remove FileMaker hooks)

#### Week 4
- [ ] Refactor 8 API modules (customers, projects, tasks, teams, notes, links, financial, activity)
- [ ] Update error handling

#### Week 5
- [ ] Refactor remaining API modules
- [ ] Remove dual-write service
- [ ] Update initialization service

#### Week 6
- [ ] Update custom hooks
- [ ] Archive FileMaker API module
- [ ] Refactor QuickBooks integration
- [ ] Clean up configuration files

#### Week 7
- [ ] Complete unit testing
- [ ] Run integration tests
- [ ] Performance testing

#### Week 8
- [ ] Data validation
- [ ] User acceptance testing
- [ ] Fix critical bugs

#### Week 9
- [ ] Deploy to staging
- [ ] Stakeholder review and approval
- [ ] Production deployment preparation

#### Week 10
- [ ] Production deployment
- [ ] Monitor and stabilize
- [ ] Code cleanup (remove files)
- [ ] Documentation updates
- [ ] Project retrospective

---

## Risk Assessment

### High-Risk Items

#### 1. Data Loss or Corruption
- **Likelihood:** Low
- **Impact:** Critical
- **Mitigation:**
  - Comprehensive data audit before migration
  - Maintain backups of FileMaker data
  - Implement data validation at every step
  - Keep dual-write service active until full verification

#### 2. QuickBooks Integration Failure
- **Likelihood:** Medium
- **Impact:** High
- **Mitigation:**
  - Thoroughly test QB integration in staging
  - Verify backend API supports all QB operations
  - Keep FileMaker QB integration as emergency fallback initially
  - Document QB workflow for manual intervention if needed

#### 3. Performance Degradation
- **Likelihood:** Low-Medium
- **Impact:** Medium
- **Mitigation:**
  - Benchmark performance before migration
  - Optimize Supabase queries with indexes
  - Monitor performance continuously
  - Have rollback plan ready

#### 4. Authentication Issues
- **Likelihood:** Low
- **Impact:** Critical
- **Mitigation:**
  - Test authentication thoroughly in staging
  - Verify session management works correctly
  - Implement graceful error handling
  - Have support team ready for user issues

#### 5. Missing Backend API Features
- **Likelihood:** Medium
- **Impact:** High
- **Mitigation:**
  - Complete feature parity verification early
  - Implement missing features before Phase 2
  - Document any functionality gaps
  - Have workarounds ready

### Medium-Risk Items

#### 1. User Resistance to Change
- **Likelihood:** Medium
- **Impact:** Medium
- **Mitigation:**
  - Communicate migration plan early
  - Provide training if UI changes
  - Gather user feedback during UAT
  - Have support resources available

#### 2. Edge Cases Not Covered in Testing
- **Likelihood:** Medium
- **Impact:** Medium
- **Mitigation:**
  - Comprehensive test coverage
  - UAT with real users
  - Monitor error logs post-deployment
  - Quick bug fix process

#### 3. Deployment Issues
- **Likelihood:** Low-Medium
- **Impact:** Medium
- **Mitigation:**
  - Test deployment process in staging
  - Have deployment checklist
  - Schedule deployment during low-traffic period
  - Have rollback procedure ready

### Low-Risk Items

#### 1. NPM Dependency Issues
- **Likelihood:** Low
- **Impact:** Low
- **Mitigation:**
  - Test dependency removal in dev environment
  - Verify build process still works
  - Update lock files correctly

#### 2. Documentation Gaps
- **Likelihood:** Medium
- **Impact:** Low
- **Mitigation:**
  - Update documentation as changes are made
  - Review all docs before final deployment
  - Have technical writer review if available

---

## Success Criteria

The migration is considered successful when:

### Functional Requirements
- [ ] All users can authenticate with Supabase credentials
- [ ] All CRUD operations work without FileMaker
- [ ] Timer operations (start/stop/adjust) function correctly
- [ ] Financial records are created accurately
- [ ] QuickBooks integration works end-to-end
- [ ] All reports and analytics display correct data
- [ ] No data loss or corruption detected

### Technical Requirements
- [ ] Zero imports of FileMaker modules in codebase
- [ ] `fm-gofer` dependency removed from package.json
- [ ] All environment variables for FileMaker removed
- [ ] All unit tests passing (80%+ coverage)
- [ ] All integration tests passing
- [ ] Performance within 20% of baseline or better

### Quality Requirements
- [ ] Error rate below 1% for API calls
- [ ] Page load times under 3 seconds
- [ ] No critical bugs in production
- [ ] User satisfaction score above 4/5

### Documentation Requirements
- [ ] All documentation updated (CLAUDE.md, README, etc.)
- [ ] Migration document archived
- [ ] New developer onboarding guide updated
- [ ] API documentation reflects current implementation

---

## Post-Migration Tasks

### Immediate (Within 1 Week)
1. Monitor error logs and performance metrics daily
2. Gather user feedback through support channels
3. Fix any critical bugs discovered
4. Optimize slow queries if needed

### Short-Term (Within 1 Month)
1. Archive all FileMaker-related code and documentation
2. Complete code review and refactoring cleanup
3. Optimize database indexes based on usage patterns
4. Conduct project retrospective

### Long-Term (Within 3 Months)
1. Review and improve test coverage
2. Document lessons learned
3. Plan next phase of application modernization
4. Consider additional Supabase features (real-time subscriptions, edge functions, etc.)

---

## Appendix

### A. Key File Reference

**Files with Heavy FileMaker Integration:**
1. [src/services/dataService.js](src/services/dataService.js) - Core routing logic
2. [src/api/fileMaker.js](src/api/fileMaker.js) - FileMaker API wrapper
3. [src/services/dualWriteService.js](src/services/dualWriteService.js) - Synchronization
4. [src/components/auth/SignIn.jsx](src/components/auth/SignIn.jsx) - Environment detection
5. [src/services/initializationService.js](src/services/initializationService.js) - Startup logic
6. [src/index.jsx](src/index.jsx) - App initialization

**Files with Moderate FileMaker Integration:**
- All files in `src/api/` that import from `fileMaker.js`
- Custom hooks in `src/hooks/` that check environment

**Files with Light FileMaker Integration:**
- Configuration files (`.env`, `config.js`)
- Build scripts (`package.json`, `scripts/`)

### B. Supabase Table Reference

**Verified Tables (69 total):** See [.roo/rules/SUPABASE_DATABASE_VERIFICATION.md](.roo/rules/SUPABASE_DATABASE_VERIFICATION.md)

**Critical Tables for Migration:**
- `customers`, `projects`, `tasks`, `teams`, `staff`
- `customer_sales`, `financial_records`
- `notes`, `links`, `customer_email`, `customer_user`, `customer_organization`
- `proposals`, `proposal_deliverables`, `proposal_packages`

### C. Backend API Endpoints

**Documentation:** `https://api.claritybusinesssolutions.ca/docs`

**Key Endpoints to Verify:**
- `/customers` - Customer CRUD
- `/projects` - Project CRUD
- `/tasks` - Task CRUD, timer operations
- `/teams` - Team CRUD
- `/financial-records` - Financial operations
- `/quickbooks/*` - QuickBooks integration
- `/proposals` - Proposal system

### D. Environment Variables

**FileMaker Variables to Remove:**
```
VITE_FM_URL
VITE_FM_DATABASE
VITE_FM_USER
VITE_FM_PASSWORD
```

**Supabase Variables to Keep:**
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_SUPABASE_SERVICE_ROLE_KEY
```

**Backend API Variables to Keep:**
```
VITE_API_URL
VITE_SECRET_KEY
```

### E. Support and Escalation

**Technical Contacts:**
- Backend API Issues: Backend team / API logs
- Supabase Issues: Supabase support, database admin
- Frontend Issues: Frontend development team

**Escalation Path:**
1. Check error logs and monitoring
2. Attempt rollback if critical issue
3. Contact technical lead
4. Engage full development team if needed

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-10 | AI Assistant (Claude) | Initial comprehensive migration plan |

---

## Approval

**Document Review Required From:**
- [ ] Technical Lead
- [ ] Backend Team Lead
- [ ] DevOps/Infrastructure
- [ ] Product Owner
- [ ] QA Lead

**Approved By:** _________________ **Date:** _________

---

**End of Document**
