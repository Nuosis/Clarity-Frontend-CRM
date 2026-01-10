# Customers Migration Requirements

## Overview

This directory contains comprehensive documentation for migrating the Customers feature from FileMaker to Supabase. Customers are the core entity of the CRM system, representing business clients with associated contact information, addresses, and related data (projects, tasks, financial records).

## Current Status

- **Phase**: Phase 1 - Requirements Documentation
- **FileMaker Layout**: `devCustomers`
- **Supabase Tables**: `customers` (exists), `customer_email`, `customer_phone`, `customer_address`, `customer_contacts`, `customer_organization`
- **Backend Status**: Partial implementation (basic CRUD via dual-write)
- **Frontend Status**: FileMaker-primary with dual-write to Supabase on updates

## Quick Reference

### FileMaker Implementation
- **Layout**: `devCustomers`
- **Primary Key**: `__ID` (UUID)
- **FileMaker Record ID**: `recordId` (internal FM record identifier)
- **Fields**: Name, Email, Phone, Address fields (City, State, PostalCode, Country), ContactPerson, f_active (boolean)
- **Timestamps**: `~creationTimestamp`, `~modificationTimestamp`

### Supabase Schema
- **Main Table**: `customers`
  - Primary key: `id` (UUID)
  - Core fields: `name`, `business_name`, `first_name`, `last_name`, `type` (enum), `organization_id`
- **Related Tables**:
  - `customer_email` - Email addresses (1:many)
  - `customer_phone` - Phone numbers (1:many)
  - `customer_address` - Physical addresses (1:many)
  - `customer_contacts` - Contact persons (1:many)
  - `customer_organization` - Org membership (many:many)
  - `customer_sales` - Financial records (1:many)

### Key Gaps & Challenges
1. **Dual-Write Complexity**: Currently using FileMaker as primary with selective dual-writes to Supabase
2. **ID Reconciliation**: FileMaker `__ID` (UUID) maps to Supabase `id`, but FileMaker `recordId` (internal) has no Supabase equivalent
3. **Active Status**: FileMaker uses `f_active` string ("1"/"0"), need boolean conversion
4. **Data Normalization**: FileMaker stores flat fields (Email, Phone), Supabase uses normalized related tables
5. **No Backend API**: No unified backend endpoints - currently using direct Supabase calls + FileMaker API
6. **Migration Scope**: ~50+ existing customers with associated projects, tasks, financial records

## User Workflows

### Current User Flows (FileMaker-Primary)

1. **View Customer List**
   - User navigates to Customers section in sidebar
   - Frontend calls `fetchCustomers()` → FileMaker `devCustomers` layout
   - Displays sorted list (active first, then by name)

2. **View Customer Details**
   - User clicks customer from list
   - Frontend calls `fetchCustomerById(customerId)` → FileMaker API
   - Displays CustomerDetails component with tabs (Overview, Projects, Tasks, Financial)

3. **Create Customer**
   - User clicks "Add Customer" button
   - Fills out CustomerForm (Name*, Email, Phone, Address fields)
   - Frontend validates and calls `createCustomer(data)` → FileMaker API only
   - **Note**: New customers are NOT created in Supabase during creation

4. **Update Customer**
   - User edits customer fields in CustomerDetails or CustomerForm
   - Frontend validates and calls `updateCustomer(customerId, data)` → FileMaker API
   - **Dual-Write**: If user has `supabaseOrgID`, frontend also calls `updateCustomerInSupabase()` (src/hooks/useCustomer.js:112-177)
   - Updates related tables (email, phone, address) in Supabase if present

5. **Toggle Customer Status**
   - User clicks status toggle in customer list or details
   - Frontend calls `toggleCustomerStatus(recordId, active)` → FileMaker API
   - Updates `f_active` field ("1" or "0")

6. **Delete Customer**
   - User clicks delete button (confirmation required)
   - Frontend calls `deleteCustomer(recordId)` → FileMaker API
   - **No Supabase deletion** - orphaned records remain

### Target User Flows (Supabase-Only)

All operations should route through backend API endpoints with:
- Unified CRUD operations
- Automatic related table management (email, phone, address)
- Organization scoping via RLS policies
- Proper cascading deletes
- Audit logging

## Documentation Structure

1. **[Current Implementation](./current-implementation.md)**
   - FileMaker integration details and API call graph
   - Frontend code architecture (hooks, services, components)
   - Dual-write behavior and current Supabase usage
   - Data flow diagrams

2. **[Data Model Mapping](./data-model-mapping.md)**
   - FileMaker `devCustomers` field definitions
   - Supabase multi-table schema (customers + related tables)
   - Field-by-field mapping with data type conversions
   - ID reconciliation strategy (FileMaker UUID → Supabase UUID)

3. **[API Contracts](./api-contracts.md)**
   - Required backend endpoints/RPCs for full CRUD operations
   - Request/response formats with examples
   - Validation rules and error responses
   - Batch operations and filtering

4. **[Authorization](./authorization.md)**
   - Row-Level Security (RLS) policies for all customer tables
   - Organization scoping requirements
   - User role permissions (admin, staff, read-only)
   - Cross-organization access controls

5. **[Migration Plan](./migration-plan.md)**
   - Data backfill strategy (FileMaker → Supabase)
   - ID reconciliation and relationship preservation
   - Cutover approach (feature flag vs hard cutover)
   - Rollback procedures and validation

6. **[Acceptance Criteria](./acceptance-criteria.md)**
   - Functional test cases for all user workflows
   - Edge cases and error scenarios
   - Performance requirements
   - Data integrity validation

## Related Features

**Dependent Features** (must migrate after Customers):
- **Projects** - Foreign key to customers
- **Tasks** - Indirect dependency via projects
- **Financial Records** - Foreign key to customers (customer_sales.customer_id)
- **Notes** - Can be associated with customers
- **Links** - Can be associated with customers

**Independent Features** (can migrate in parallel):
- **Prospects** - Already Supabase-only
- **Teams** - Independent entity
- **Products** - Independent entity

## Code References

### API Layer
- `src/api/customers.js` - FileMaker API calls (135 lines)
  - `fetchCustomers()` - Query all customers
  - `fetchCustomerById(customerId)` - Query single customer
  - `createCustomer(data)` - Create new customer (FM only)
  - `updateCustomer(customerId, data)` - Update customer (FM only)
  - `toggleCustomerStatus(customerId, active)` - Toggle active status
  - `deleteCustomer(customerId)` - Delete customer (FM only)
  - `fetchActiveCustomers()` - Query active customers only

### Services Layer
- `src/services/customerService.js` - Business logic (162 lines)
  - `processCustomerData(data)` - Transform FM response to UI format
  - `validateCustomerData(data)` - Validation rules (Name*, Email format, Phone format)
  - `formatCustomerForFileMaker(data)` - Transform UI data to FM format
  - `sortCustomers(customers)` - Sort by active status + name
  - `calculateCustomerStats(customers)` - Aggregate statistics

- `src/services/dualWriteService.js` - FileMaker→Supabase sync (359 lines)
  - Primary use: Timer stop → financial record creation
  - **Not used for customer CRUD** (handled in hooks)

### Hooks Layer
- `src/hooks/useCustomer.js` - Main customer hook (268 lines)
  - State management for customers list and selected customer
  - All CRUD operations with loading/error states
  - **Dual-write on update**: Lines 112-177 call `updateCustomerInSupabase()` after FM update

- `src/hooks/useSupabaseCustomer.js` - Supabase-specific operations (487 lines)
  - `createCustomerInSupabase(customer, user)` - Create customer + related records
  - `updateCustomerInSupabase(customerId, customer, user)` - Update customer + related records
  - `linkCustomerToOrganization(customerId, orgId)` - Link to org
  - `fetchOrCreateCustomerInSupabase(customer, user)` - Find or create customer

### UI Components
- `src/components/customers/CustomerDetails.jsx` - Customer detail view with tabs
- `src/components/customers/CustomerForm.jsx` - Create/edit customer form
- `src/components/customers/CustomerHeader.jsx` - Customer header with status toggle
- `src/components/customers/CustomerTabs.jsx` - Tab navigation for customer sections
- `src/components/customers/CustomerSettings.jsx` - Customer-specific settings

### Related Components
- `src/components/financial/CustomerList.jsx` - Customer selector for financial views
- `src/components/financial/CustomerSalesTable.jsx` - Financial records by customer

## Dependencies

### External Libraries
- `uuid` (v4) - UUID generation for new customers in Supabase
- `react` - Component framework

### Internal Services
- `supabaseService.js` - Low-level Supabase operations (query, insert, update, remove)
- `dataService.js` - Environment-aware data routing (FileMaker vs Supabase)
- `initializationService.js` - App startup, preloads customers list

### Context/State
- `AppStateContext` - Global app state, includes customers list
- `SnackBarContext` - User notifications for errors/success

## Known Issues & Technical Debt

1. **Incomplete Dual-Write**:
   - Customer creation does NOT write to Supabase (src/api/customers.js:64-76)
   - Only updates trigger dual-write (src/hooks/useCustomer.js:112-177)
   - Deletes do NOT remove from Supabase

2. **ID Management**:
   - Some operations use FileMaker `recordId` (internal)
   - Others use `__ID` (UUID)
   - Inconsistent usage causes confusion (e.g., toggleCustomerStatus uses recordId)

3. **Related Tables Not Synced**:
   - `customer_contacts` table exists but not populated
   - `customer_settings` table exists but not used

4. **No Backend API**:
   - Direct Supabase calls from frontend expose implementation details
   - No centralized validation or business logic
   - Difficult to maintain consistency

5. **Organization Scoping**:
   - Dual-write only happens if `user.supabaseOrgID` exists
   - Customers created by users without `supabaseOrgID` are FM-only
   - No RLS policies to prevent cross-org access

## Success Metrics

- **Data Integrity**: 100% of FileMaker customers migrated with all related data (email, phone, address)
- **Performance**: Customer list loads in <500ms, detail view in <200ms
- **Feature Parity**: All existing UI workflows function identically
- **No Data Loss**: Zero customer records lost during migration
- **Backward Compatibility**: Can rollback to FileMaker if needed

## Next Steps

1. Review and approve this requirements documentation
2. Create backend implementation plan (BACKEND_CHANGE_REQUEST)
3. Implement backend API endpoints + RLS policies
4. Update frontend to use backend API (remove direct Supabase calls)
5. Execute data migration (backfill Supabase from FileMaker)
6. Feature flag rollout and validation
7. Remove FileMaker dependencies and cleanup code
