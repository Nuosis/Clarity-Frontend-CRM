# FileMaker Removal - Acceptance Criteria

**Document Version:** 1.0
**Created:** 2026-01-10
**Purpose:** Define precise, measurable criteria for determining when FileMaker removal is complete and successful
**Status:** Phase 1 Requirements Document

---

## Table of Contents

1. [Overview](#overview)
2. [Code Removal Criteria](#code-removal-criteria)
3. [Functionality Criteria](#functionality-criteria)
4. [Authentication Criteria](#authentication-criteria)
5. [Data Operations Criteria](#data-operations-criteria)
6. [Performance Criteria](#performance-criteria)
7. [Testing Criteria](#testing-criteria)
8. [Documentation Criteria](#documentation-criteria)
9. [Deployment Readiness Criteria](#deployment-readiness-criteria)
10. [Verification Commands](#verification-commands)

---

## Overview

### What "Done" Looks Like

The FileMaker removal is considered complete when:

1. **Zero FileMaker References:** No active code references FileMaker, fm-gofer, or FileMaker-specific patterns
2. **Single Authentication Path:** Only Supabase authentication exists
3. **Single Data Routing:** All data operations route through Backend API + Supabase
4. **No Environment Detection:** No runtime environment detection code
5. **All Tests Pass:** Build succeeds, all functionality verified working
6. **Documentation Complete:** All documentation reflects web-app-only architecture

### Success Definition

**Complete Success =** All criteria in sections 2-9 are met with no exceptions

**Partial Success =** Core functionality works but minor cleanup needed (documented exceptions allowed)

**Failure =** Any critical criterion fails (rollback required)

---

## Code Removal Criteria

### CR-1: FileMaker Package Dependencies

**Status:** ✅ Pass / ❌ Fail

**Criterion:** The `fm-gofer` package must be completely removed from the project.

**Verification:**
```bash
# Check package.json
cat package.json | grep -i "fm-gofer"
# Expected: No matches

# Check package-lock.json
cat package-lock.json | grep -i "fm-gofer"
# Expected: No matches

# Check installed packages
npm list fm-gofer
# Expected: (empty)
```

**Files Affected:**
- `package.json:29` - Remove `"fm-gofer": "^1.10.0"`
- `package-lock.json` - Remove all fm-gofer entries

**Exit Criteria:** All three verification commands return no matches/empty results

---

### CR-2: FileMaker Import Statements

**Status:** ✅ Pass / ❌ Fail

**Criterion:** No active code files may import from FileMaker-related modules.

**Verification:**
```bash
# Search for FileMaker module imports
grep -r "from.*fileMaker" src/ --include="*.js" --include="*.jsx"
# Expected: No matches

# Search for fm-gofer imports
grep -r "from.*fm-gofer" src/ --include="*.js" --include="*.jsx"
# Expected: No matches

# Search for FMGofer usage
grep -r "import.*FMGofer" src/ --include="*.js" --include="*.jsx"
# Expected: No matches
```

**Previously Imported In:**
- `src/services/dataService.js:9` - `import FMGofer from 'fm-gofer';`
- `src/services/mailjetService.js:6` - `import FMGofer from 'fm-gofer';`
- `src/api/fileMaker.js:1` - `import FMGofer from 'fm-gofer';`
- All API modules importing from `./fileMaker`

**Exit Criteria:** Zero import statements referencing FileMaker or fm-gofer

---

### CR-3: FileMaker Function Calls

**Status:** ✅ Pass / ❌ Fail

**Criterion:** No active code may call FileMaker-specific functions.

**Verification:**
```bash
# Search for fetchDataFromFileMaker calls (60+ locations previously)
grep -r "fetchDataFromFileMaker" src/ --include="*.js" --include="*.jsx"
# Expected: No matches

# Search for FMGofer.PerformScript calls
grep -r "FMGofer\.PerformScript" src/ --include="*.js" --include="*.jsx"
# Expected: No matches

# Search for FileMaker.PerformScript calls
grep -r "FileMaker\.PerformScript" src/ --include="*.js" --include="*.jsx"
# Expected: No matches

# Search for convertToFileMakerCall
grep -r "convertToFileMakerCall" src/ --include="*.js" --include="*.jsx"
# Expected: No matches

# Search for handleFileMakerOperation
grep -r "handleFileMakerOperation" src/ --include="*.js" --include="*.jsx"
# Expected: No matches

# Search for handleFileMakerNativeCall
grep -r "handleFileMakerNativeCall" src/ --include="*.js" --include="*.jsx"
# Expected: No matches
```

**Previously Called In:**
- 60+ locations across API modules
- `src/services/dataService.js` (multiple functions)
- `src/services/mailjetService.js:25, 178`
- `src/components/financial/QboTestPanel.jsx:485, 600`

**Exit Criteria:** Zero function calls to FileMaker-specific functions

---

### CR-4: FileMaker Constants and Enums

**Status:** ✅ Pass / ❌ Fail

**Criterion:** FileMaker-specific constants must be removed or deprecated.

**Verification:**
```bash
# Check for ENVIRONMENT_TYPES.FILEMAKER
grep -r "ENVIRONMENT_TYPES\.FILEMAKER" src/ --include="*.js" --include="*.jsx"
# Expected: No matches

# Check for AUTH_METHODS.FILEMAKER
grep -r "AUTH_METHODS\.FILEMAKER" src/ --include="*.js" --include="*.jsx"
# Expected: No matches

# Check for Layouts constant usage
grep -r "Layouts\." src/ --include="*.js" --include="*.jsx"
# Expected: No matches (or only in comments)

# Check for Actions constant usage
grep -r "Actions\." src/ --include="*.js" --include="*.jsx"
# Expected: No matches (or only in comments)
```

**Previously Defined:**
- `src/services/dataService.js:13-22` - `ENVIRONMENT_TYPES`, `AUTH_METHODS`
- `src/api/fileMaker.js:411-423` - `Layouts` constant
- `src/api/fileMaker.js:428-435` - `Actions` constant

**Previously Used In:**
- `src/index.jsx` (15+ references)
- All API modules (60+ references)

**Exit Criteria:** Constants removed or no longer referenced in active code

---

### CR-5: FileMaker Detection Code

**Status:** ✅ Pass / ❌ Fail

**Criterion:** Environment detection logic for FileMaker must be removed.

**Verification:**
```bash
# Check for window.FileMaker checks
grep -r "window\.FileMaker" src/ --include="*.js" --include="*.jsx"
# Expected: No matches

# Check for window.FMGofer checks
grep -r "window\.FMGofer" src/ --include="*.js" --include="*.jsx"
# Expected: No matches

# Check for isFileMakerEnvironment function
grep -r "isFileMakerEnvironment" src/ --include="*.js" --include="*.jsx"
# Expected: No matches

# Check for FileMaker detection in SignIn
grep -r "detectFileMaker" src/ --include="*.js" --include="*.jsx"
# Expected: No matches
```

**Previously Implemented:**
- `src/components/auth/SignIn.jsx:24-66` - `detectFileMaker()` function
- `src/api/fileMaker.js:30-36` - `isFileMakerEnvironment()` function
- `src/services/dataService.js` - Multiple FileMaker bridge checks

**Exit Criteria:** No FileMaker detection code in active files

---

### CR-6: FileMaker-Specific Files Removed

**Status:** ✅ Pass / ❌ Fail

**Criterion:** FileMaker-specific implementation files must be deleted or archived.

**Verification:**
```bash
# Check for fileMaker.js
ls -la src/api/fileMaker.js
# Expected: No such file or directory

# Check for dualWriteService.js
ls -la src/services/dualWriteService.js
# Expected: No such file or directory

# Verify files were deleted (not just renamed)
git log --all --oneline -- src/api/fileMaker.js | head -1
# Expected: Shows deletion commit
```

**Files to Remove:**
- `src/api/fileMaker.js` (501 lines)
- `src/services/dualWriteService.js` (359 lines)

**Exit Criteria:** Files deleted from repository (visible in git history as deletions)

---

### CR-7: Environment Context Simplified

**Status:** ✅ Pass / ❌ Fail

**Criterion:** Environment context state must be simplified to remove FileMaker-specific tracking.

**Verification:**
```bash
# Check for environment.type checks
grep -r "environment\.type.*FILEMAKER" src/ --include="*.js" --include="*.jsx"
# Expected: No matches

# Check for setEnvironment function calls
grep -r "setEnvironment\(ENVIRONMENT_TYPES" src/ --include="*.js" --include="*.jsx"
# Expected: No matches

# Check for environmentDetectionComplete
grep -r "environmentDetectionComplete" src/ --include="*.js" --include="*.jsx"
# Expected: No matches
```

**Previously Implemented:**
- `src/services/dataService.js:28-54` - Environment context management
- `src/context/AppStateContext.jsx:68-78` - Environment state
- `src/index.jsx` (15+ references)

**Exit Criteria:**
- Environment type is hardcoded to 'webapp' or removed entirely
- No runtime environment detection state

---

### CR-8: Axios Interceptor Simplification

**Status:** ✅ Pass / ❌ Fail

**Criterion:** Axios interceptors must route all requests through Backend API with HMAC auth.

**Verification:**
```bash
# Check request interceptor for FileMaker routing
grep -A10 "interceptors.request.use" src/services/dataService.js | grep -i filemaker
# Expected: No matches

# Check response interceptor for FileMaker handling
grep -A10 "interceptors.response.use" src/services/dataService.js | grep -i filemaker
# Expected: No matches

# Check for _isFileMakerRequest flag
grep -r "_isFileMakerRequest" src/ --include="*.js" --include="*.jsx"
# Expected: No matches
```

**Previously Implemented:**
- `src/services/dataService.js:176-216` - Request interceptor with FileMaker routing
- `src/services/dataService.js:218-255` - Response interceptor with FileMaker handling

**Exit Criteria:**
- Single request interceptor path (HMAC auth only)
- Single response interceptor path (standard HTTP only)
- No FileMaker-specific flags or routing

---

### CR-9: Hooks Cleanup

**Status:** ✅ Pass / ❌ Fail

**Criterion:** FileMaker-specific hooks must be removed.

**Verification:**
```bash
# Check for useFileMakerBridge hook definition
grep -r "useFileMakerBridge" src/hooks/ --include="*.js" --include="*.jsx"
# Expected: No matches

# Check for useFileMakerBridge usage
grep -r "useFileMakerBridge" src/ --include="*.js" --include="*.jsx"
# Expected: No matches

# Check for fmReady variable
grep -r "fmReady" src/ --include="*.js" --include="*.jsx"
# Expected: No matches
```

**Previously Implemented:**
- `src/hooks/index.js:3-64` - `useFileMakerBridge()` hook
- `src/index.jsx:27-32` - Hook usage

**Exit Criteria:** Hook removed and no references remain

---

### CR-10: Environment Variables Removed

**Status:** ✅ Pass / ❌ Fail

**Criterion:** FileMaker-related environment variables must be removed from all environment files.

**Verification:**
```bash
# Check .env files for FileMaker variables
grep -i "VITE_FM_" .env .env.example .env.production 2>/dev/null
# Expected: No matches

# Check for references in code
grep -r "VITE_FM_URL\|VITE_FM_DATABASE\|VITE_FM_USER\|VITE_FM_PASSWORD" src/ --include="*.js" --include="*.jsx"
# Expected: No matches
```

**Variables to Remove:**
- `VITE_FM_URL`
- `VITE_FM_DATABASE`
- `VITE_FM_USER`
- `VITE_FM_PASSWORD`

**Variables to Keep:**
- `VITE_SECRET_KEY` (HMAC auth)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL`

**Exit Criteria:** No FileMaker environment variables in any .env files or code references

---

## Functionality Criteria

### FN-1: Application Loads Successfully

**Status:** ✅ Pass / ❌ Fail

**Criterion:** Application must load without FileMaker-related errors.

**Test Steps:**
1. Start dev server: `npm run dev`
2. Open browser to `http://localhost:1235`
3. Observe console for errors
4. Verify sign-in page displays

**Expected Behavior:**
- No "FileMaker bridge not available" errors
- No "FileMaker.PerformScript is not a function" errors
- No "Cannot find module './fileMaker'" errors
- Sign-in form displays immediately (no 3-second delay)

**Console Checks:**
- ❌ Should NOT see: "FileMaker environment detected"
- ❌ Should NOT see: "Waiting for FileMaker bridge"
- ❌ Should NOT see: "Attempting to connect to FileMaker"
- ✅ Should see: "Application loaded" or similar

**Exit Criteria:** Clean console with no FileMaker-related messages or errors

---

### FN-2: Build Succeeds

**Status:** ✅ Pass / ❌ Fail

**Criterion:** Production build must complete successfully without FileMaker-related errors.

**Test Command:**
```bash
npm run build
```

**Expected Output:**
- ✅ Build completes without errors
- ✅ No "Module not found: Can't resolve './fileMaker'" errors
- ✅ No "export 'ENVIRONMENT_TYPES' was not found" warnings
- ✅ No unused variable warnings for FileMaker code
- ✅ Bundle size reduced by ~70KB (fm-gofer removal)

**Build Artifacts:**
```bash
# Check dist directory created
ls -la dist/
# Expected: Contains index.html, assets/, etc.

# Check bundle size
du -sh dist/
# Expected: Smaller than pre-migration baseline
```

**Exit Criteria:** Build completes successfully with clean output

---

### FN-3: No Broken Imports

**Status:** ✅ Pass / ❌ Fail

**Criterion:** All module imports must resolve correctly.

**Verification:**
```bash
# Build and check for import errors
npm run build 2>&1 | grep -i "can't resolve"
# Expected: No output (or only non-FileMaker related)

# Check for missing exports
npm run build 2>&1 | grep -i "export.*was not found"
# Expected: No FileMaker-related exports
```

**Common Import Errors to Avoid:**
- ❌ `Can't resolve './fileMaker'`
- ❌ `export 'fetchDataFromFileMaker' was not found`
- ❌ `export 'Layouts' was not found`
- ❌ `export 'Actions' was not found`
- ❌ `export 'ENVIRONMENT_TYPES' was not found`

**Exit Criteria:** Zero import resolution errors

---

## Authentication Criteria

### AU-1: Supabase Authentication Works

**Status:** ✅ Pass / ❌ Fail

**Criterion:** Users can authenticate using Supabase email/password authentication.

**Test Steps:**
1. Load application
2. Verify sign-in form appears immediately (no delay)
3. Enter valid credentials
4. Click "Sign In"
5. Verify successful authentication
6. Verify redirect to main application

**Expected Behavior:**
- Sign-in form displays immediately (no 3-second FileMaker detection)
- Form accepts email and password input
- Submit triggers Supabase authentication
- Success sets authentication state
- User redirected to main app view

**Console Checks:**
- ✅ Should see: "Supabase authentication successful"
- ✅ Should see: "Authentication complete, starting initialization"
- ❌ Should NOT see: "FileMaker environment detected"
- ❌ Should NOT see: "FileMaker not detected, continuing with web app authentication"

**State Verification:**
```javascript
// In browser console after successful auth:
appState.authentication.isAuthenticated
// Expected: true

appState.authentication.user
// Expected: { id, email, user_metadata: {...} }

appState.authentication.method
// Expected: undefined or 'supabase' (not 'filemaker')
```

**Exit Criteria:**
- Authentication flow completes in <2 seconds (down from ~5 seconds with detection)
- User successfully authenticated
- No FileMaker-related console messages

---

### AU-2: Invalid Credentials Handled

**Status:** ✅ Pass / ❌ Fail

**Criterion:** Invalid authentication attempts must be handled gracefully.

**Test Steps:**
1. Enter invalid email/password
2. Click "Sign In"
3. Verify error message displayed
4. Verify able to retry

**Expected Behavior:**
- Error message: "Invalid email or password" (or similar)
- Sign-in form remains visible
- User can enter new credentials
- No FileMaker-related errors

**Exit Criteria:** Error handling works correctly without FileMaker references

---

### AU-3: Session Persistence Works

**Status:** ✅ Pass / ❌ Fail

**Criterion:** Authenticated sessions must persist across page refreshes.

**Test Steps:**
1. Sign in successfully
2. Refresh browser (F5 or Cmd+R)
3. Verify user remains authenticated
4. Verify app initializes without re-authentication

**Expected Behavior:**
- Page reloads
- User session restored from Supabase
- App initializes with user context
- No sign-in form displayed

**Console Checks:**
- ✅ Should see: "Session restored" or similar
- ❌ Should NOT see: FileMaker detection messages

**Exit Criteria:** Session persistence works using Supabase session only

---

### AU-4: Logout Works

**Status:** ✅ Pass / ❌ Fail

**Criterion:** Users can sign out and session is cleared.

**Test Steps:**
1. Sign in successfully
2. Navigate app briefly
3. Click logout/sign out
4. Verify session cleared
5. Verify redirect to sign-in page

**Expected Behavior:**
- Logout clears Supabase session
- Authentication state cleared
- User redirected to sign-in page
- Subsequent refresh shows sign-in page (not authenticated)

**Exit Criteria:** Logout clears session completely

---

### AU-5: No FileMaker Authentication Path

**Status:** ✅ Pass / ❌ Fail

**Criterion:** FileMaker authentication path must not exist.

**Verification:**
```bash
# Check for AUTH_METHODS.FILEMAKER usage
grep -r "AUTH_METHODS\.FILEMAKER" src/ --include="*.js" --include="*.jsx"
# Expected: No matches

# Check for FileMaker auth handler
grep -r "handleFileMakerDetected" src/ --include="*.js" --include="*.jsx"
# Expected: No matches

# Check for FileMaker auth flow
grep -r "onFileMakerDetected" src/ --include="*.js" --include="*.jsx"
# Expected: No matches
```

**Exit Criteria:** Zero FileMaker authentication code paths

---

## Data Operations Criteria

### DO-1: All CRUD Operations Work via Backend/Supabase

**Status:** ✅ Pass / ❌ Fail

**Criterion:** All Create, Read, Update, Delete operations must work through Backend API or Supabase.

**Test Matrix:**

| Entity | CREATE | READ | UPDATE | DELETE | Via |
|--------|--------|------|--------|--------|-----|
| Customers | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | Backend API |
| Projects | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | Backend API |
| Tasks | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | Backend API |
| Teams | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | Backend API |
| Team Members | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | Backend API |
| Staff | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | Backend API |
| Notes | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | Backend API |
| Links | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | Backend API |
| Prospects | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | Supabase |
| Proposals | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | Supabase |
| Time Entries | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | Backend API |

**Test Procedure for Each Entity:**

**CREATE Test:**
1. Open entity creation form
2. Fill in required fields
3. Submit form
4. Verify record created in database
5. Verify record appears in UI
6. Check network tab for correct endpoint

**READ Test:**
1. Load entity list view
2. Verify records display
3. Click on specific record
4. Verify detail view loads
5. Check network tab for correct endpoint

**UPDATE Test:**
1. Open existing record
2. Modify field value
3. Save changes
4. Verify update in database
5. Verify UI reflects change
6. Check network tab for correct endpoint

**DELETE Test:**
1. Select record to delete
2. Confirm deletion
3. Verify removal from database
4. Verify removal from UI
5. Check network tab for correct endpoint

**Network Verification:**
- All requests go to `https://api.claritybusinesssolutions.ca` or Supabase
- All requests include HMAC `Authorization` header (Backend API)
- No requests to FileMaker server
- No `FMGofer.PerformScript` calls in network activity

**Exit Criteria:** All entities pass all CRUD operations

---

### DO-2: API Endpoints Used Correctly

**Status:** ✅ Pass / ❌ Fail

**Criterion:** All API calls must use correct HTTP endpoints (not FileMaker script calls).

**Verification Method:**
1. Open browser DevTools Network tab
2. Perform CRUD operations for each entity
3. Inspect request details

**Expected Request Patterns:**

**Customers:**
- GET `/filemaker/devCustomers/records` - List all
- GET `/filemaker/devCustomers/records/{id}` - Get one
- POST `/filemaker/devCustomers/records` - Create
- PATCH `/filemaker/devCustomers/records/{id}` - Update
- DELETE `/filemaker/devCustomers/records/{id}` - Delete

**Projects:**
- GET `/filemaker/devProjects/records`
- GET `/filemaker/devProjects/records/{id}`
- POST `/filemaker/devProjects/records`
- PATCH `/filemaker/devProjects/records/{id}`
- DELETE `/filemaker/devProjects/records/{id}`

**Tasks:**
- GET `/filemaker/devTasks/records`
- GET `/filemaker/devTasks/records/{id}`
- POST `/filemaker/devTasks/records`
- PATCH `/filemaker/devTasks/records/{id}`
- DELETE `/filemaker/devTasks/records/{id}`

**Teams:**
- GET `/filemaker/devTeams/records`
- POST `/filemaker/devTeams/records`
- PATCH `/filemaker/devTeams/records/{id}`

**Time Entries (verify correct table with backend team):**
- GET `/filemaker/dapiRecords/records` (or correct endpoint)
- POST `/filemaker/dapiRecords/records`

**Request Headers Check:**
```http
Authorization: Bearer {hmac_signature}.{timestamp}
Content-Type: application/json
```

**❌ Should NOT see:**
- Requests to FileMaker server
- `window.FileMaker.PerformScript` in console
- FileMaker layout/action parameters in request body

**Exit Criteria:** All requests use HTTP endpoints with HMAC auth

---

### DO-3: Response Format Handled Correctly

**Status:** ✅ Pass / ❌ Fail

**Criterion:** Backend API responses must be parsed and displayed correctly.

**Test Procedure:**
1. Perform API operations
2. Inspect response data structure
3. Verify UI displays data correctly
4. Check for parsing errors

**Expected Response Structures:**

**Backend API Response (Example - GET customers):**
```json
{
  "response": {
    "data": [
      { "id": 1, "name": "Acme Corp", "email": "contact@acme.com" },
      { "id": 2, "name": "Beta Inc", "email": "info@beta.com" }
    ],
    "dataInfo": {
      "foundCount": 2,
      "returnedCount": 2
    }
  },
  "messages": [
    { "code": "0", "message": "OK" }
  ]
}
```

**Supabase Direct Response (Example - GET prospects):**
```json
[
  { "id": 1, "company_name": "Prospect Co", "contact_email": "contact@prospect.co" },
  { "id": 2, "company_name": "Lead Inc", "contact_email": "info@lead.com" }
]
```

**Verification:**
- Data displays in UI correctly
- Field values match database
- No "undefined" or parsing errors
- Arrays/objects accessed correctly

**Exit Criteria:** All response formats handled without errors

---

### DO-4: Complex Workflows Work End-to-End

**Status:** ✅ Pass / ❌ Fail

**Criterion:** Multi-step workflows must complete successfully.

**Workflow Tests:**

**Workflow 1: Customer → Project → Task → Time Entry**
1. ✅/❌ Create new customer
2. ✅/❌ Navigate to customer detail
3. ✅/❌ Create project for customer
4. ✅/❌ Navigate to project detail
5. ✅/❌ Create task for project
6. ✅/❌ Start timer on task
7. ✅/❌ Work for 5 minutes (simulate)
8. ✅/❌ Stop timer
9. ✅/❌ Verify time entry created
10. ✅/❌ Verify total time correct

**Workflow 2: Team Assignment**
1. ✅/❌ Create new team
2. ✅/❌ Add staff member to team
3. ✅/❌ Assign project to team
4. ✅/❌ Verify team member sees project
5. ✅/❌ Remove staff from team
6. ✅/❌ Verify access removed

**Workflow 3: Proposal Creation**
1. ✅/❌ Create new prospect
2. ✅/❌ Create proposal for prospect
3. ✅/❌ Add deliverables
4. ✅/❌ Add packages
5. ✅/❌ Generate PDF
6. ✅/❌ Verify PDF renders correctly

**Exit Criteria:** All workflows complete without errors

---

### DO-5: No FileMaker Database Queries

**Status:** ✅ Pass / ❌ Fail

**Criterion:** No data operations may query FileMaker database.

**Verification:**
1. Monitor network activity during all operations
2. Check backend logs (if accessible)
3. Verify all queries hit Supabase

**Network Checks:**
- ❌ Should NOT see requests to FileMaker server (`server.claritybusinesssolutions.ca/fmi/data`)
- ❌ Should NOT see FileMaker API endpoints
- ✅ Should see requests to Backend API (`api.claritybusinesssolutions.ca`)
- ✅ Should see Supabase requests (if applicable)

**Database Verification (if accessible):**
```bash
# Query Supabase to verify data exists
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c 'SELECT COUNT(*) FROM customers;'"
# Expected: Returns count > 0

# Verify FileMaker NOT being queried (backend team can confirm)
```

**Exit Criteria:** Zero queries to FileMaker database

---

## Performance Criteria

### PE-1: Initial Load Time Improved

**Status:** ✅ Pass / ❌ Fail

**Criterion:** Application must load faster without FileMaker detection delay.

**Measurement:**
```javascript
// In browser console, measure time to interactive
performance.timing.loadEventEnd - performance.timing.navigationStart
```

**Baseline (Pre-Migration):**
- With FileMaker detection: ~4500ms (includes 3-second polling)
- Sign-in form appears: ~3500ms

**Target (Post-Migration):**
- Without FileMaker detection: <1500ms
- Sign-in form appears: <500ms

**Expected Improvement:**
- Initial load: ≥60% faster
- Time to sign-in form: ≥85% faster

**Verification:**
1. Clear browser cache
2. Load application
3. Measure time to sign-in form visible
4. Measure time to fully interactive
5. Compare with baseline

**Exit Criteria:**
- Sign-in form appears in <500ms
- Significant improvement over baseline measured

---

### PE-2: Bundle Size Reduced

**Status:** ✅ Pass / ❌ Fail

**Criterion:** Production bundle must be smaller after removing fm-gofer.

**Measurement:**
```bash
# Build production bundle
npm run build

# Check bundle size
du -sh dist/
ls -lh dist/assets/*.js
```

**Baseline (Pre-Migration):**
- Total bundle: ~520KB (estimated with fm-gofer)

**Target (Post-Migration):**
- Total bundle: ≤450KB
- Expected reduction: ~70KB (fm-gofer package size)

**Expected Improvement:**
- Bundle size: ≥10% smaller

**Verification:**
1. Build production bundle
2. Sum all JavaScript file sizes
3. Compare with baseline
4. Verify fm-gofer not in bundle

**Check for Unused Code:**
```bash
# Analyze bundle (if using webpack-bundle-analyzer)
npm run build -- --analyze

# Verify fm-gofer not included
grep -r "fm-gofer" dist/
# Expected: No matches
```

**Exit Criteria:**
- Bundle size reduced by ≥10%
- fm-gofer not in production bundle

---

### PE-3: API Response Times Unchanged

**Status:** ✅ Pass / ❌ Fail

**Criterion:** Backend API response times must be comparable to or better than FileMaker bridge.

**Measurement:**
Use browser DevTools Network tab to measure response times for common operations.

**Operations to Measure:**

| Operation | Baseline (FileMaker) | Target (Backend API) | Actual | Pass/Fail |
|-----------|---------------------|---------------------|--------|-----------|
| GET /customers (all) | ~300ms | ≤400ms | | ✅/❌ |
| GET /customers/{id} | ~150ms | ≤200ms | | ✅/❌ |
| POST /customers | ~250ms | ≤350ms | | ✅/❌ |
| PATCH /customers/{id} | ~200ms | ≤300ms | | ✅/❌ |
| GET /projects (filtered) | ~400ms | ≤500ms | | ✅/❌ |
| GET /tasks (by project) | ~350ms | ≤450ms | | ✅/❌ |

**Expected:**
- Response times similar or better
- No significant performance regression
- Network latency may vary based on server distance

**Exit Criteria:** No operation is >50% slower than baseline

---

### PE-4: No Memory Leaks

**Status:** ✅ Pass / ❌ Fail

**Criterion:** Application must not have memory leaks from removed code.

**Test Procedure:**
1. Open browser DevTools > Performance > Memory
2. Record heap snapshot
3. Use application for 5-10 minutes (navigate, create, update, delete)
4. Force garbage collection
5. Record another heap snapshot
6. Compare heap sizes

**Expected:**
- Heap size increases are reasonable (for cached data)
- No detached DOM nodes from FileMaker components
- Memory released after operations complete

**Check for Common Issues:**
- Event listeners not cleaned up
- Intervals/timeouts not cleared
- React component unmount issues

**Exit Criteria:** No significant memory growth over time

---

## Testing Criteria

### TE-1: All Manual Tests Pass

**Status:** ✅ Pass / ❌ Fail

**Criterion:** Manual test checklist must be completed with all passing results.

**Test Checklist:**

**Authentication Tests:**
- [ ] Valid login works
- [ ] Invalid login shows error
- [ ] Session persists on refresh
- [ ] Logout clears session
- [ ] Password reset works (if applicable)

**CRUD Tests (for each entity):**
- [ ] List view displays records
- [ ] Detail view shows full record
- [ ] Create new record works
- [ ] Update record works
- [ ] Delete record works
- [ ] Search/filter works
- [ ] Sort works
- [ ] Pagination works (if applicable)

**Workflow Tests:**
- [ ] Customer → Project → Task → Timer workflow
- [ ] Team assignment workflow
- [ ] Proposal creation workflow
- [ ] QuickBooks sync workflow (if applicable)

**Integration Tests:**
- [ ] QuickBooks integration works
- [ ] Mailjet integration works
- [ ] PDF generation works
- [ ] Email sending works

**UI/UX Tests:**
- [ ] All pages render correctly
- [ ] All forms submit correctly
- [ ] All modals open/close correctly
- [ ] No visual regressions
- [ ] Dark mode works (if applicable)
- [ ] Responsive design works

**Exit Criteria:** All test items checked as passing

---

### TE-2: No Console Errors

**Status:** ✅ Pass / ❌ Fail

**Criterion:** Application must run without console errors (excluding expected warnings).

**Test Procedure:**
1. Open browser DevTools > Console
2. Load application
3. Sign in
4. Navigate through major sections
5. Perform CRUD operations
6. Monitor console continuously

**Expected Console Output:**
- ✅ Info logs: "Application loaded", "Authentication successful", etc.
- ✅ Warning logs: Acceptable warnings (deprecation notices from dependencies)
- ❌ Error logs: Should be zero

**Errors to Watch For:**
- ❌ `Cannot find module './fileMaker'`
- ❌ `FileMaker.PerformScript is not a function`
- ❌ `undefined is not a function` (from removed FileMaker code)
- ❌ `ENVIRONMENT_TYPES is not defined`
- ❌ `fetchDataFromFileMaker is not defined`

**Exit Criteria:** Zero console errors during normal usage

---

### TE-3: Browser Compatibility Verified

**Status:** ✅ Pass / ❌ Fail

**Criterion:** Application must work in all major browsers.

**Browsers to Test:**

| Browser | Version | Sign In | CRUD Ops | No Errors | Pass/Fail |
|---------|---------|---------|----------|-----------|-----------|
| Chrome | Latest | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| Firefox | Latest | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| Safari | Latest | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| Edge | Latest | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |

**Test for Each Browser:**
- Authentication works
- Basic CRUD operations work
- No browser-specific errors
- UI renders correctly
- HMAC auth works (Web Crypto API available)

**Exit Criteria:** Application works in all tested browsers

---

### TE-4: Build Succeeds Without Warnings

**Status:** ✅ Pass / ❌ Fail

**Criterion:** Production build must complete with no errors and minimal warnings.

**Build Command:**
```bash
npm run build
```

**Expected Output:**
- ✅ "Build completed successfully"
- ✅ Bundle created in `dist/` directory
- ✅ No errors
- ✅ No FileMaker-related warnings

**Acceptable Warnings:**
- Dependency deprecation notices (not from fm-gofer)
- Large bundle warnings (if pre-existing)

**Unacceptable Warnings:**
- "Module not found" for FileMaker
- "Export not found" for FileMaker functions
- "Unused variable" for FileMaker code

**Exit Criteria:** Clean build with no FileMaker-related issues

---

## Documentation Criteria

### DC-1: CLAUDE.md Updated

**Status:** ✅ Pass / ❌ Fail

**Criterion:** CLAUDE.md must reflect web-app-only architecture.

**Required Updates:**

**Project Overview Section:**
- [ ] Remove "FileMaker WebViewer" references
- [ ] Remove "dual environments" description
- [ ] State "standalone web application" only

**Architecture Section:**
- [ ] Remove environment detection flow
- [ ] Remove FileMaker bridge documentation
- [ ] Show single authentication path (Supabase)
- [ ] Show single data routing (Backend API + Supabase)

**Integration Section:**
- [ ] Remove "FileMaker Integration" section entirely
- [ ] Update "Backend Integration" to be primary

**Environment Variables:**
- [ ] Remove FileMaker variable documentation
- [ ] Keep Supabase and Backend API variables

**Common Pitfalls:**
- [ ] Remove FileMaker-specific pitfalls
- [ ] Keep relevant backend/Supabase pitfalls

**Verification:**
```bash
# Check for FileMaker references in CLAUDE.md
grep -i "filemaker" CLAUDE.md | grep -v "Removed" | grep -v "deprecated" | grep -v "legacy"
# Expected: Only historical references (e.g., "FileMaker has been removed")
```

**Exit Criteria:** CLAUDE.md accurately describes current architecture

---

### DC-2: README.md Updated

**Status:** ✅ Pass / ❌ Fail

**Criterion:** README.md must describe web-app architecture.

**Required Updates:**

**Description:**
- [ ] Remove "dual-environment" claims
- [ ] Describe as "React + Supabase + FastAPI backend"

**Features:**
- [ ] Remove FileMaker integration from feature list
- [ ] Add Supabase features

**Architecture Diagram:**
- [ ] Remove FileMaker components
- [ ] Show Frontend → Backend API → Supabase flow

**Installation:**
- [ ] Remove FileMaker setup steps
- [ ] Simplify to: clone, install, configure .env, start

**Deployment:**
- [ ] Remove `npm run deploy-to-fm` command
- [ ] Keep `npm run build` and standard deployment

**Exit Criteria:** README reflects current architecture

---

### DC-3: Code Comments Updated

**Status:** ✅ Pass / ❌ Fail

**Criterion:** JSDoc and inline comments must not reference FileMaker incorrectly.

**Verification:**
```bash
# Find function comments mentioning FileMaker
grep -r "@.*FileMaker" src/ --include="*.js" --include="*.jsx"
# Expected: No matches (or only historical notes)

# Find inline comments about FileMaker
grep -r "// .*FileMaker" src/ --include="*.js" --include="*.jsx"
# Expected: Only comments like "// FileMaker integration removed"
```

**Update Pattern:**

**Before:**
```javascript
/**
 * Fetch customers from FileMaker or Backend API depending on environment
 * @returns {Promise<Array>} Customer records in FileMaker format
 */
```

**After:**
```javascript
/**
 * Fetch customers from Supabase via Backend API
 * @returns {Promise<Array>} Customer records
 */
```

**Exit Criteria:** No misleading FileMaker references in code comments

---

### DC-4: Migration Completion Document Created

**Status:** ✅ Pass / ❌ Fail

**Criterion:** A migration completion document must exist summarizing the changes.

**Required Document:** `requirements/platform-filemaker-removal/MIGRATION_COMPLETE.md`

**Required Sections:**
- [ ] Summary of changes
- [ ] Files modified/deleted
- [ ] Dependencies removed
- [ ] Performance improvements measured
- [ ] Test results summary
- [ ] Known issues (if any)
- [ ] Follow-up work (if any)
- [ ] Sign-off from stakeholders

**Exit Criteria:** Document created and reviewed

---

## Deployment Readiness Criteria

### DR-1: Environment Variables Configured

**Status:** ✅ Pass / ❌ Fail

**Criterion:** Production environment must have correct variables configured.

**Required Variables:**
- [ ] `VITE_SECRET_KEY` - HMAC signing key
- [ ] `VITE_SUPABASE_URL` - Supabase project URL
- [ ] `VITE_SUPABASE_ANON_KEY` - Supabase public anon key
- [ ] `VITE_API_URL` - Backend API base URL

**Removed Variables (verify NOT present):**
- [ ] `VITE_FM_URL` - Removed
- [ ] `VITE_FM_DATABASE` - Removed
- [ ] `VITE_FM_USER` - Removed
- [ ] `VITE_FM_PASSWORD` - Removed

**Verification:**
```bash
# Check production .env file (or deployment config)
# Ensure FileMaker variables NOT present
grep -i "VITE_FM_" .env.production
# Expected: No matches
```

**Exit Criteria:** Environment variables correctly configured for web-app-only

---

### DR-2: Backend API Ready

**Status:** ✅ Pass / ❌ Fail

**Criterion:** Backend API must be updated to query Supabase (not FileMaker).

**Prerequisites (from BACKEND_API_REQUIREMENTS.md):**

**Backend Changes Required:**
- [ ] `/filemaker/devCustomers/records` queries Supabase `customers` table
- [ ] `/filemaker/devProjects/records` queries Supabase `projects` table
- [ ] `/filemaker/devTasks/records` queries Supabase `tasks` table
- [ ] `/filemaker/devTeams/records` queries Supabase `teams` table
- [ ] All other layout endpoints query Supabase
- [ ] Response format matches expected structure
- [ ] HMAC authentication validated correctly

**Verification:**
```bash
# Test backend endpoint (requires valid HMAC signature)
curl -X GET https://api.claritybusinesssolutions.ca/filemaker/devCustomers/records \
  -H "Authorization: Bearer {valid_hmac_signature}.{timestamp}"
# Expected: Returns data from Supabase (not FileMaker)
```

**⚠️ CRITICAL:** Frontend changes cannot be deployed until backend is ready

**Exit Criteria:** Backend team confirms all endpoints query Supabase

---

### DR-3: Database Migration Complete

**Status:** ✅ Pass / ❌ Fail

**Criterion:** All required data must exist in Supabase.

**Data Verification:**

**Core Tables:**
- [ ] `customers` table populated
- [ ] `projects` table populated
- [ ] `tasks` table populated
- [ ] `teams` table populated
- [ ] `team_members` table populated
- [ ] `staff` table populated
- [ ] `notes` table populated
- [ ] `links` table populated
- [ ] `proposals` table populated
- [ ] `prospects` table populated

**Time Tracking:**
- [ ] Confirm correct table name with backend team
- [ ] Verify time entry data migrated

**Verification (if SSH access):**
```bash
# Check table record counts
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c 'SELECT COUNT(*) FROM customers;'"
# Expected: Non-zero count

# Repeat for other tables
```

**Exit Criteria:** All necessary data present in Supabase

---

### DR-4: Rollback Plan Documented

**Status:** ✅ Pass / ❌ Fail

**Criterion:** A clear rollback procedure must be documented.

**Required Documentation:**
- [ ] Git tags created (`pre-filemaker-removal`)
- [ ] Rollback steps documented
- [ ] Rollback testing performed
- [ ] Rollback decision criteria defined
- [ ] Team aware of rollback procedure

**Rollback Triggers:**
- Critical bugs preventing app usage
- Data loss or corruption
- Authentication completely broken
- Unable to perform core operations

**Quick Rollback Command:**
```bash
# If in feature branch
git checkout main
git reset --hard pre-filemaker-removal
git push --force origin main  # (⚠️ only if safe)
```

**Exit Criteria:** Rollback plan documented and tested

---

### DR-5: Stakeholder Sign-off

**Status:** ✅ Pass / ❌ Fail

**Criterion:** All stakeholders must approve deployment.

**Required Sign-offs:**

**Development Team:**
- [ ] Code review complete
- [ ] All acceptance criteria met
- [ ] Tests passing
- [ ] Documentation complete

**QA Team:**
- [ ] Test plan executed
- [ ] No critical bugs
- [ ] Regression testing complete
- [ ] Performance acceptable

**Product Owner:**
- [ ] User acceptance testing complete
- [ ] Requirements met
- [ ] Ready for production

**Backend Team:**
- [ ] Backend API changes deployed
- [ ] Database migration complete
- [ ] Endpoints verified working

**DevOps:**
- [ ] Deployment plan reviewed
- [ ] Environment variables configured
- [ ] Monitoring configured
- [ ] Backup plan ready

**Exit Criteria:** All stakeholders have signed off

---

## Verification Commands

### Complete Verification Script

Run this script to verify all code removal criteria:

```bash
#!/bin/bash

echo "=== FileMaker Removal Acceptance Criteria Verification ==="
echo ""

echo "1. Checking for fm-gofer package..."
if npm list fm-gofer 2>&1 | grep -q "empty"; then
  echo "✅ PASS: fm-gofer not found"
else
  echo "❌ FAIL: fm-gofer still in dependencies"
fi
echo ""

echo "2. Checking for FileMaker imports..."
if grep -r "from.*fileMaker\|from.*fm-gofer" src/ --include="*.js" --include="*.jsx" 2>/dev/null | grep -v node_modules; then
  echo "❌ FAIL: FileMaker imports found"
else
  echo "✅ PASS: No FileMaker imports"
fi
echo ""

echo "3. Checking for FileMaker function calls..."
FILEMAKER_CALLS=$(grep -r "fetchDataFromFileMaker\|FMGofer\.PerformScript\|FileMaker\.PerformScript" src/ --include="*.js" --include="*.jsx" 2>/dev/null | wc -l)
if [ "$FILEMAKER_CALLS" -eq 0 ]; then
  echo "✅ PASS: No FileMaker function calls"
else
  echo "❌ FAIL: Found $FILEMAKER_CALLS FileMaker function calls"
fi
echo ""

echo "4. Checking for environment constants..."
ENV_REFS=$(grep -r "ENVIRONMENT_TYPES\.FILEMAKER\|AUTH_METHODS\.FILEMAKER" src/ --include="*.js" --include="*.jsx" 2>/dev/null | wc -l)
if [ "$ENV_REFS" -eq 0 ]; then
  echo "✅ PASS: No FileMaker environment constants"
else
  echo "❌ FAIL: Found $ENV_REFS FileMaker environment constant references"
fi
echo ""

echo "5. Checking for FileMaker detection code..."
DETECTION=$(grep -r "window\.FileMaker\|window\.FMGofer\|detectFileMaker" src/ --include="*.js" --include="*.jsx" 2>/dev/null | wc -l)
if [ "$DETECTION" -eq 0 ]; then
  echo "✅ PASS: No FileMaker detection code"
else
  echo "❌ FAIL: Found $DETECTION FileMaker detection references"
fi
echo ""

echo "6. Checking for FileMaker files..."
if [ -f "src/api/fileMaker.js" ]; then
  echo "❌ FAIL: src/api/fileMaker.js still exists"
else
  echo "✅ PASS: src/api/fileMaker.js removed"
fi

if [ -f "src/services/dualWriteService.js" ]; then
  echo "❌ FAIL: src/services/dualWriteService.js still exists"
else
  echo "✅ PASS: src/services/dualWriteService.js removed"
fi
echo ""

echo "7. Checking for FileMaker environment variables..."
FM_VARS=$(grep -i "VITE_FM_" .env .env.example .env.production 2>/dev/null | wc -l)
if [ "$FM_VARS" -eq 0 ]; then
  echo "✅ PASS: No FileMaker environment variables"
else
  echo "❌ FAIL: Found $FM_VARS FileMaker environment variables"
fi
echo ""

echo "8. Running build test..."
if npm run build 2>&1 | grep -q "Build completed successfully\|built in"; then
  echo "✅ PASS: Build succeeds"
else
  echo "❌ FAIL: Build failed"
fi
echo ""

echo "=== Verification Complete ==="
```

Save as `verify-filemaker-removal.sh` and run:
```bash
chmod +x verify-filemaker-removal.sh
./verify-filemaker-removal.sh
```

---

## Summary Checklist

### Must Pass for Deployment

**Code Removal (CR):**
- [ ] CR-1: fm-gofer package removed
- [ ] CR-2: FileMaker imports removed
- [ ] CR-3: FileMaker function calls removed
- [ ] CR-4: FileMaker constants removed
- [ ] CR-5: FileMaker detection removed
- [ ] CR-6: FileMaker files deleted
- [ ] CR-7: Environment context simplified
- [ ] CR-8: Axios interceptors simplified
- [ ] CR-9: Hooks cleaned up
- [ ] CR-10: Environment variables removed

**Functionality (FN):**
- [ ] FN-1: Application loads successfully
- [ ] FN-2: Build succeeds
- [ ] FN-3: No broken imports

**Authentication (AU):**
- [ ] AU-1: Supabase authentication works
- [ ] AU-2: Invalid credentials handled
- [ ] AU-3: Session persistence works
- [ ] AU-4: Logout works
- [ ] AU-5: No FileMaker auth path

**Data Operations (DO):**
- [ ] DO-1: All CRUD operations work
- [ ] DO-2: API endpoints used correctly
- [ ] DO-3: Response format handled
- [ ] DO-4: Complex workflows work
- [ ] DO-5: No FileMaker database queries

**Performance (PE):**
- [ ] PE-1: Initial load time improved
- [ ] PE-2: Bundle size reduced
- [ ] PE-3: API response times acceptable
- [ ] PE-4: No memory leaks

**Testing (TE):**
- [ ] TE-1: All manual tests pass
- [ ] TE-2: No console errors
- [ ] TE-3: Browser compatibility verified
- [ ] TE-4: Build succeeds without warnings

**Documentation (DC):**
- [ ] DC-1: CLAUDE.md updated
- [ ] DC-2: README.md updated
- [ ] DC-3: Code comments updated
- [ ] DC-4: Migration completion doc created

**Deployment Readiness (DR):**
- [ ] DR-1: Environment variables configured
- [ ] DR-2: Backend API ready
- [ ] DR-3: Database migration complete
- [ ] DR-4: Rollback plan documented
- [ ] DR-5: Stakeholder sign-off

---

## Acceptance Decision Matrix

| Criteria Category | Total Items | Must Pass | Can Defer |
|------------------|-------------|-----------|-----------|
| Code Removal | 10 | 10 | 0 |
| Functionality | 3 | 3 | 0 |
| Authentication | 5 | 5 | 0 |
| Data Operations | 5 | 5 | 0 |
| Performance | 4 | 3 | 1 (PE-4) |
| Testing | 4 | 4 | 0 |
| Documentation | 4 | 3 | 1 (DC-3) |
| Deployment Readiness | 5 | 5 | 0 |
| **TOTAL** | **40** | **38** | **2** |

**Minimum Passing Score:** 38/40 (95%)

**Critical Items (zero tolerance):**
- All Code Removal criteria
- All Authentication criteria
- All Data Operations criteria
- Backend API Ready
- Database Migration Complete

**Deferrable (can be completed post-deployment):**
- PE-4: Memory leak testing (monitor in production)
- DC-3: Code comment cleanup (cosmetic)

---

## Final Acceptance

**Date:** _____________

**Migration Complete:** ✅ Yes / ❌ No

**Items Passed:** _____ / 40

**Critical Issues:** _____________

**Deferred Items:** _____________

**Approved By:**

- Technical Lead: __________________ Date: __________
- QA Lead: ________________________ Date: __________
- Product Owner: __________________ Date: __________
- Backend Lead: ___________________ Date: __________

**Deployment Authorization:** ✅ Approved / ❌ Declined

**Notes:**
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

---

**Document Status:** Phase 1 Requirements Document (Ready for Phase 2 Implementation)
**Next Step:** Use these criteria during Phase 2 implementation to verify each change
**Last Updated:** 2026-01-10
