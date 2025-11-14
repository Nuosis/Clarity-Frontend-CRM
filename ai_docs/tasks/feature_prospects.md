# Feature Implementation Plan: Prospects Tab

## Feature Overview

**Primary Function**: Add a "Prospects" tab to the header navigation (left of Customers) that manages customer records with `type=NULL` in Supabase. Provides full CRUD capabilities with industry tracking via customer_settings.

**CRITICAL ARCHITECTURAL DECISION**:
- **Prospects**: 100% Supabase-only, NO FileMaker integration whatsoever
- **Customers**: Remain FileMaker-dependent with existing dual-write patterns
- These are separate data flows that happen to share the same database table

**IMPORTANT DATABASE SCHEMA NOTE**:
- Despite initial documentation suggesting `type=NULL` for prospects, the database schema requires a non-null value
- **Prospects are identified by `type='PROSPECT'`** in the customers table
- **Customers are identified by `type IS NOT NULL AND type != 'PROSPECT'`**
- This is enforced by the database schema and cannot be changed without migration

**Success Metrics**:
- Prospects tab appears in header navigation (left of Customers)
- Prospects list displays records where type IS NULL
- Customers list displays records where type IS NOT NULL
- Full CRUD operations work for prospects
- Industry field can be set/displayed via customer_settings
- Contact information (email, phone, address) management works
- UI/UX matches existing customer patterns
- Customers remains default tab

**MVP Scope**:
- ✅ Prospects tab in header (positioned left of Customers)
- ✅ Prospects list in sidebar (filtered by type IS NULL)
- ✅ Full CRUD for prospects (Create, Read, Update, Delete)
- ✅ Industry field via customer_settings table
- ✅ Email, phone, address management (existing tables)
- ✅ Customers tab filters to type IS NOT NULL
- ✅ **Prospects: Pure Supabase implementation (NO FileMaker code paths)**
- ✅ **Customers: Keep existing FileMaker integration untouched**

**Explicitly Excluded** (YAGNI):
- ❌ Prospect-to-customer conversion workflow (future iteration)
- ❌ Prospect-specific analytics/reporting
- ❌ Bulk import/export
- ❌ Advanced filtering beyond active/inactive
- ❌ Database schema changes (NO enum modification)

## Dependencies

### Existing Code to Leverage (UI Components Only)
- **Components**: [`CustomerDetails.jsx`](../src/components/customers/CustomerDetails.jsx:1) - Detail view (reuse with isProspect prop)
- **List Item**: [`CustomerListItem`](../src/components/layout/Sidebar.jsx:79) - Sidebar list component (reuse as-is)
- **Navigation**: [`TopNav.jsx`](../src/components/layout/TopNav.jsx:1) - Header navigation (add Prospects button)
- **State**: [`AppStateContext.jsx`](../src/context/AppStateContext.jsx:1) - Global state management (add prospect mode)
- **Supabase Client**: [`src/config.js`](../src/config.js:1) - Already configured Supabase client

### Existing Code to AVOID (FileMaker-Dependent)
- ❌ **DO NOT USE**: [`useCustomer`](../src/hooks/useCustomer.js:1) - FileMaker-dependent hook
- ❌ **DO NOT USE**: [`customers.js`](../src/api/customers.js:1) - FileMaker API integration
- ❌ **DO NOT USE**: [`customerService.js`](../src/services/customerService.js:1) - FileMaker business logic
- ⚠️ **MODIFY ONLY**: Add type IS NOT NULL filter to customers.js (Task 3.4)

### Database Schema (No Changes Required)
- **customers table**: Use existing `type` field (NULL = prospect, NOT NULL = customer)
  - **Prospects**: Direct Supabase queries only
  - **Customers**: FileMaker API with backend proxy (existing pattern)
- **customer_settings**: Use for industry (type='industry', data='value')
- **customer_email**: Existing email management
- **customer_phone**: Existing phone management
- **customer_address**: Existing address management

**Data Flow Separation**:
```
PROSPECTS FLOW:
Frontend → Supabase Client → Supabase Database
(No FileMaker, no backend API, no dual-write)

CUSTOMERS FLOW (unchanged):
Frontend → FileMaker API → Backend Proxy → FileMaker Database
(Existing dual-write to Supabase continues)
```

### New Dependencies
- **Supabase Client**: Direct usage for prospects (already configured in src/config.js)
- **New API Module**: `src/api/prospects.js` - Pure Supabase operations (NO FileMaker code)
- **New Service Module**: `src/services/prospectService.js` - Prospect-specific business logic
- **New Hook**: `src/hooks/useProspect.js` - Prospect data management (separate from useCustomer)

**Critical Separation**:
- DO NOT modify existing customer API/service/hook files
- Create parallel prospect-specific modules
- Prospects and Customers share UI components but NOT data layer code

## Implementation Tasks

### Phase 1: State Management Foundation (1 hour)

**Task 1.1**: Add 'prospect' to sidebarMode enum
- **File**: [`src/context/AppStateContext.jsx`](../src/context/AppStateContext.jsx:58)
- **Dependencies**: None
- **Changes**:
  - Line 58: Update `sidebarMode: 'customer'` comment to include 'prospect'
  - Line 289-296: Update SET_SIDEBAR_MODE reducer to handle 'prospect' mode
  - Add selectedProspect state (mirror selectedCustomer pattern)
- **Acceptance**: 
  - sidebarMode can be set to 'prospect'
  - Switching to prospect mode clears customer selections
  - State updates trigger re-renders
- **Estimate**: 30 minutes

**Task 1.2**: Add prospect state operations
- **File**: [`src/context/AppStateContext.jsx`](../src/context/AppStateContext.jsx:359)
- **Dependencies**: Task 1.1
- **Changes**:
  - Add `setSelectedProspect` operation (mirror setSelectedCustomer)
  - Export in useAppStateOperations return object
- **Acceptance**:
  - setSelectedProspect updates state correctly
  - Hook consumers can access prospect operations
- **Estimate**: 15 minutes

**Task 1.3**: Add prospect action types
- **File**: [`src/context/AppStateContext.jsx`](../src/context/AppStateContext.jsx:7)
- **Dependencies**: Task 1.1
- **Changes**:
  - Add SET_SELECTED_PROSPECT to APP_ACTIONS
  - Add reducer case for SET_SELECTED_PROSPECT
- **Acceptance**:
  - Action dispatches correctly
  - Reducer updates state as expected
- **Estimate**: 15 minutes

### Phase 2: Navigation Integration (1.5 hours)

**Task 2.1**: Add Prospects button to TopNav
- **File**: [`src/components/layout/TopNav.jsx`](../src/components/layout/TopNav.jsx:1)
- **Dependencies**: Phase 1 complete
- **Changes**:
  - Add handleProspectClick handler (mirror handleCustomerClick pattern)
  - Add Prospects button JSX (position LEFT of Customers button)
  - Add active state styling for prospects tab
  - Update button order: Prospects, Customers, Products, Teams, Marketing
- **Acceptance**:
  - Prospects button appears left of Customers
  - Clicking Prospects sets sidebarMode='prospect'
  - Active styling shows when prospects tab selected
  - Customers remains default on load
- **Estimate**: 45 minutes

**Task 2.2**: Update Sidebar header for prospects mode
- **File**: [`src/components/layout/Sidebar.jsx`](../src/components/layout/Sidebar.jsx:467)
- **Dependencies**: Task 2.1
- **Changes**:
  - Line 476: Update title logic to show 'Prospects' when sidebarMode='prospect'
  - Add "Add Prospect" button when in prospect mode
  - Wire button to setShowCustomerForm (reuse existing form)
- **Acceptance**:
  - Header shows "Prospects" when in prospect mode
  - Add button appears and opens form
  - Form creates records with type=NULL
- **Estimate**: 30 minutes

**Task 2.3**: Add prospect list rendering in Sidebar
- **File**: [`src/components/layout/Sidebar.jsx`](../src/components/layout/Sidebar.jsx:629)
- **Dependencies**: Task 2.2
- **Changes**:
  - Add prospect list rendering section (after marketing, before customer)
  - Reuse CustomerListItem component
  - Filter prospects: customers.filter(c => c.type === null)
  - Wire to onProspectSelect, onProspectStatusToggle, onProspectDelete handlers
- **Acceptance**:
  - Prospects list renders when sidebarMode='prospect'
  - List items show prospects (type=NULL)
  - Click handlers work correctly
- **Estimate**: 15 minutes

### Phase 3: Data Layer - Pure Supabase Implementation (3 hours)

**CRITICAL**: Create NEW files for prospects. DO NOT modify customer files.

**Task 3.1**: Create prospects API module (Backend Integration Layer)
- **File**: `src/api/prospects.js` (NEW FILE)
- **Dependencies**: Phase 2 complete
- **Changes**:
  - Create `fetchProspects()` — Perform GET request to `https://api.claritybusinesssolutions.ca/records/customers`
    with payload `{ filters: { type: null } }`
  - Create `createProspect(data)` — Perform POST to `/records/customers` with body `{ fields: { ...data, type: null } }`
  - Create `updateProspect(id, data)` — Perform PATCH to `/records/customers/{id}`
  - Create `deleteProspect(id)` — Perform DELETE to `/records/customers/{id}`
  - Each request must include the HMAC-SHA256-based Bearer Authorization header generated via
    `generateBackendAuthHeader()` (see [`src/api/fileMaker.js`](../src/api/fileMaker.js:189))
  - **NO direct Supabase client or @supabase/supabase-js import**
  - **Use backend REST routes exclusively**
- **Acceptance**:
  - All CRUD operations succeed via backend REST API
  - Authentication verified through valid HMAC header
  - Returned data adheres to Clarity API response schema
- **Estimate**: 1 hour

**Task 3.2**: Create prospect service module
- **File**: `src/services/prospectService.js` (NEW FILE)
- **Dependencies**: Task 3.1
- **Changes**:
  - Create `processProspectData(data)` - Data transformation
  - Create `filterActiveProspects(prospects)` - Active/inactive filtering
  - Create `sortProspects(prospects)` - Sorting logic
  - Create `validateProspectData(data)` - Validation
  - Mirror customerService patterns but prospect-specific
- **Acceptance**:
  - Service layer handles prospect business logic
  - No dependencies on customerService
  - Consistent with existing service patterns
- **Estimate**: 45 minutes

**Task 3.3**: Create useProspect hook
- **File**: `src/hooks/useProspect.js` (NEW FILE)
- **Dependencies**: Task 3.1, 3.2
- **Changes**:
  - Create `loadProspects()` - Fetch all prospects
  - Create `handleProspectSelect(id)` - Select prospect
  - Create `handleProspectCreate(data)` - Create new prospect
  - Create `handleProspectUpdate(id, data)` - Update prospect
  - Create `handleProspectDelete(id)` - Delete prospect
  - Create `handleProspectStatusToggle(id)` - Toggle active/inactive
  - Mirror useCustomer patterns but prospect-specific
- **Acceptance**:
  - Hook provides all prospect CRUD operations
  - No dependencies on useCustomer
  - State management works correctly
- **Estimate**: 1 hour

### Phase 4: Component Integration (1.5 hours)

**Task 4.1**: Wire AppLayout to handle prospects
- **File**: [`src/components/layout/AppLayout.jsx`](../src/components/layout/AppLayout.jsx:1)
- **Dependencies**: Phase 3 complete
- **Changes**:
  - Import and use `useProspect` hook (NOT useCustomer)
  - Add prospects state management (separate from customers)
  - Add prospect handlers (onProspectSelect, onProspectStatusToggle, onProspectDelete)
  - Pass prospect props to Sidebar
  - Update MainContent to show ProspectDetails when prospect selected
  - **Keep customer logic completely separate**
- **Acceptance**:
  - AppLayout manages prospect state independently
  - Handlers update state correctly
  - Props flow to child components
  - Customer state management unchanged
- **Estimate**: 45 minutes

**Task 4.2**: Create ProspectDetails component (or adapt CustomerDetails)
- **File**: [`src/components/customers/CustomerDetails.jsx`](../src/components/customers/CustomerDetails.jsx:1) OR new file
- **Dependencies**: Task 4.1
- **Decision**: Reuse CustomerDetails with prop to indicate prospect mode
- **Changes**:
  - Add `isProspect` prop to CustomerDetails
  - Update title to show "Prospect Details" when isProspect=true
  - Ensure form saves with type=NULL for prospects
  - Add industry field to form (via customer_settings)
- **Acceptance**:
  - Component renders for prospects
  - Form saves prospects with type=NULL
  - Industry field works via customer_settings
  - All contact fields (email, phone, address) work
- **Estimate**: 45 minutes

### Phase 5: Industry Field Implementation (1 hour)

**Task 5.1**: Add industry field to CustomerForm
- **File**: [`src/components/customers/CustomerForm.jsx`](../src/components/customers/CustomerForm.jsx:1)
- **Dependencies**: Task 4.2
- **Changes**:
  - Add industry input field
  - Load industry from customer_settings on edit
  - Save industry to customer_settings on submit
  - Use pattern: type='industry', data='{industry_value}'
- **Acceptance**:
  - Industry field appears in form
  - Loads existing industry value
  - Saves to customer_settings table
  - Works for both prospects and customers
- **Estimate**: 45 minutes

**Task 5.2**: Display industry in ProspectDetails
- **File**: [`src/components/customers/CustomerDetails.jsx`](../src/components/customers/CustomerDetails.jsx:1)
- **Dependencies**: Task 5.1
- **Changes**:
  - Fetch industry from customer_settings
  - Display industry in details view
  - Add edit capability
- **Acceptance**:
  - Industry displays in details view
  - Can edit industry inline
  - Updates save to customer_settings
- **Estimate**: 15 minutes


## Success Criteria

- [x] Prospects tab appears in header navigation (left of Customers)
- [x] Clicking Prospects tab shows prospects list in sidebar
- [x] Prospects list shows only records with type=NULL
- [x] Customers list shows only records with type IS NOT NULL
- [x] Can create new prospect (saves with type=NULL)
- [x] Can edit prospect details
- [x] Can add/edit industry field via customer_settings
- [x] Can add/edit email, phone, address for prospects
- [x] Can toggle prospect active/inactive status
- [x] Can delete prospect
- [x] Customers remains default tab on load
- [x] UI/UX matches existing customer patterns
- [x] No breaking changes to existing customer functionality
- [x] All PropTypes validate
- [x] No console errors or warnings

## Risk Mitigation

**Risk 1**: Existing customer data may have NULL type
- **Mitigation**: Customers tab filters to type IS NOT NULL, so NULL records appear in Prospects
- **Impact**: Low - this is the intended behavior per user decision

**Risk 2**: Accidentally mixing FileMaker code into prospects
- **Mitigation**: Create separate API/service/hook files for prospects
- **Mitigation**: Code review to ensure no FileMaker imports in prospect files
- **Impact**: High if violated - would break architectural separation

**Risk 3**: Confusion about which code path to use
- **Mitigation**: Clear file naming (prospects.js vs customers.js)
- **Mitigation**: Documentation in each file header
- **Impact**: Medium - could lead to bugs if wrong API used

**Risk 3**: Confusion between prospects and customers in UI
- **Mitigation**: Clear tab labels, separate lists, consistent terminology
- **Impact**: Low - UI patterns match existing implementation

**Risk 4**: customer_settings table may have conflicts
- **Mitigation**: Use unique type='industry' key, check for existing records before insert
- **Impact**: Low - flexible key-value pattern handles this well

## Total Estimated Effort: 8.5 hours

**Breakdown**:
- Phase 1: State Management (1 hour)
- Phase 2: Navigation (1.5 hours)
- Phase 3: Data Layer (2 hours)
- Phase 4: Components (1.5 hours)
- Phase 5: Industry Field (1 hour)
- Phase 6: Testing & Polish (1.5 hours)

## Notes

- **NO database migrations required** - uses existing schema with type=NULL
- **NO FileMaker changes required** - Prospects bypass FileMaker entirely
- **Parallel implementation** - New prospect files alongside customer files
- **Architectural separation** - Prospects and Customers are separate data flows
- **Backward compatible** - existing customer functionality 100% unchanged
- **Future-proof** - easy to add prospect-to-customer conversion later

## File Structure Summary

```
NEW FILES (Prospects - Pure Supabase):
src/api/prospects.js          - Direct Supabase CRUD
src/services/prospectService.js - Prospect business logic
src/hooks/useProspect.js       - Prospect state management

MODIFIED FILES (Add prospect UI):
src/components/layout/TopNav.jsx      - Add Prospects button
src/components/layout/Sidebar.jsx     - Add prospect list rendering
src/components/layout/AppLayout.jsx   - Wire prospect state
src/context/AppStateContext.jsx       - Add prospect mode

MODIFIED FILES (Filter customers):
src/api/customers.js          - Add type IS NOT NULL filter

UNCHANGED (Customer FileMaker flow):
src/hooks/useCustomer.js      - NO CHANGES
src/services/customerService.js - NO CHANGES
All customer components         - NO CHANGES
```