# Customers - Acceptance Criteria and Test Plan

## Overview

This document defines the acceptance criteria for the Customers migration from FileMaker to Supabase, including functional test cases, edge cases, performance requirements, and success metrics.

## Acceptance Criteria

### AC1: Schema Migration

**Criteria**: Supabase multi-table schema must support all FileMaker customer data and relationships

**Verification**:
- ✅ `customers` table exists with all required columns
- ✅ `customer_email` table exists with foreign key to `customers(id)`
- ✅ `customer_phone` table exists with foreign key to `customers(id)`
- ✅ `customer_address` table exists with foreign key to `customers(id)`
- ✅ `customer_contacts` table exists with foreign key to `customers(id)`
- ✅ `customer_organization` table exists for many-to-many relationships
- ✅ All indexes created (`organization_id`, `is_active`, `business_name`)
- ✅ `updated_at` triggers auto-update on modifications
- ✅ Foreign keys have appropriate CASCADE/RESTRICT behaviors
- ✅ Check constraints enforce business rules (e.g., `is_active` boolean)

**Test Query**:
```sql
-- Verify customers table structure
\d+ customers

-- Verify related tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'customer_%'
ORDER BY table_name;

-- Verify foreign keys
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name LIKE 'customer_%';

-- Verify triggers
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgrelid::regclass::text LIKE 'customer%';
```

---

### AC2: Data Migration Completeness

**Criteria**: All FileMaker customers must be migrated without data loss

**Verification**:
- ✅ Record count matches: FileMaker count = Supabase count
- ✅ All customer names migrated successfully
- ✅ All email addresses migrated to `customer_email` table
- ✅ All phone numbers migrated to `customer_phone` table
- ✅ All addresses migrated to `customer_address` table
- ✅ All contact persons migrated correctly
- ✅ All timestamps preserved (created_at, updated_at)
- ✅ Active status correctly converted (FM "1"/"0" → Supabase boolean)
- ✅ No orphaned customers (all have valid organization_id)
- ✅ FileMaker `__ID` (UUID) preserved as Supabase `id`

**Test Queries**:
```sql
-- Count validation
SELECT
  (SELECT COUNT(*) FROM filemaker_customers_backup) AS filemaker_count,
  (SELECT COUNT(*) FROM customers) AS supabase_count;

-- Active/Inactive distribution
SELECT
  COUNT(*) FILTER (WHERE is_active = true) AS active_customers,
  COUNT(*) FILTER (WHERE is_active = false) AS inactive_customers
FROM customers;

-- Verify related data migrated
SELECT
  c.id,
  c.business_name,
  COUNT(DISTINCT e.id) AS email_count,
  COUNT(DISTINCT p.id) AS phone_count,
  COUNT(DISTINCT a.id) AS address_count
FROM customers c
LEFT JOIN customer_email e ON e.customer_id = c.id
LEFT JOIN customer_phone p ON p.customer_id = c.id
LEFT JOIN customer_address a ON a.customer_id = c.id
GROUP BY c.id, c.business_name
ORDER BY c.business_name;

-- Verify no orphaned customers
SELECT COUNT(*) FROM customers
WHERE organization_id IS NULL;
-- Should return 0

-- Verify no orphaned related records
SELECT COUNT(*) FROM customer_email
WHERE customer_id NOT IN (SELECT id FROM customers);
-- Should return 0
```

---

### AC3: Backend API Endpoints

**Criteria**: All CRUD operations functional via REST API or RPC functions

**Verification**:
- ✅ POST /api/customers - Creates customer with related data in single transaction
- ✅ GET /api/customers - Returns paginated list with filters (active, search)
- ✅ GET /api/customers/:id - Returns single customer with all related data
- ✅ PATCH /api/customers/:id - Updates customer and related records atomically
- ✅ PATCH /api/customers/:id/status - Toggles active status
- ✅ DELETE /api/customers/:id - Soft-deletes customer
- ✅ POST /api/customers/batch - Bulk import for migration
- ✅ GET /api/customers/search - Full-text search across fields
- ✅ HMAC authentication required on all endpoints
- ✅ 400 errors for invalid input
- ✅ 404 errors for non-existent resources
- ✅ 403 errors for unauthorized access
- ✅ 409 errors for conflicts (duplicates, concurrent updates)

**Test Cases**: See "Backend API Tests" section below

---

### AC4: Row-Level Security

**Criteria**: Users can only access customers for entities in their organization

**Verification**:
- ✅ Users in Org A cannot read customers from Org B
- ✅ Users in Org A cannot create customers for Org B
- ✅ Users in Org A cannot update/delete Org B customers
- ✅ Anonymous users cannot access any customers
- ✅ Service role can access all customers (for admin operations)
- ✅ RLS policies apply to all customer-related tables (email, phone, address, contacts)

**Test Cases**: See "RLS Tests" section below

---

### AC5: Frontend Integration

**Criteria**: Existing UI workflows function identically with Supabase backend

**Verification**:
- ✅ `src/api/customers.js` uses backend API instead of FileMaker
- ✅ Customer list displays correctly with active/inactive filtering
- ✅ Customer sorting works (active first, then by name)
- ✅ CustomerDetails component shows customer info and tabs
- ✅ Creating new customer works via CustomerForm
- ✅ Updating customer works via CustomerForm and inline edits
- ✅ Toggling customer status works in list and details views
- ✅ Deleting customer works with confirmation
- ✅ Related data (email, phone, address) displays correctly
- ✅ Customer search/filter functions correctly
- ✅ Optimistic UI updates work correctly
- ✅ Error handling displays user-friendly messages
- ✅ Loading states show during operations
- ✅ Customer stats (active count, total count) calculate correctly

**Test Cases**: See "Frontend UI Tests" section below

---

### AC6: ID Reconciliation

**Criteria**: FileMaker IDs correctly mapped to Supabase UUIDs

**Verification**:
- ✅ FileMaker `__ID` (UUID) used as Supabase `customers.id`
- ✅ All project foreign keys (`customer_id`) reference migrated customer IDs
- ✅ All task relationships preserved (via projects)
- ✅ All financial records (`customer_sales.customer_id`) reference correct customers
- ✅ All notes associated with customers reference correct IDs
- ✅ All links associated with customers reference correct IDs
- ✅ ID mapping table created for reference (optional)

**Test Queries**:
```sql
-- Verify all projects reference valid customers
SELECT COUNT(*) FROM projects
WHERE customer_id NOT IN (SELECT id FROM customers);
-- Should return 0

-- Verify all financial records reference valid customers
SELECT COUNT(*) FROM customer_sales
WHERE customer_id NOT IN (SELECT id FROM customers);
-- Should return 0

-- Verify customer-project relationships preserved
SELECT
  c.business_name,
  COUNT(p.id) AS project_count
FROM customers c
LEFT JOIN projects p ON p.customer_id = c.id
GROUP BY c.id, c.business_name
ORDER BY project_count DESC;
```

---

### AC7: Dual-Write Removal

**Criteria**: FileMaker dual-write logic completely removed

**Scope Note**: AC7 is part of Phase 5 (Cleanup) and is deferred while the standing constraint requires FileMaker backward compatibility. This acceptance criterion is out of scope for the current customers-backend-integration phase.

**Verification**:
- ✅ `src/hooks/useCustomer.js` no longer calls `updateCustomerInSupabase()`
- ✅ `src/hooks/useSupabaseCustomer.js` removed or repurposed
- ✅ `src/services/dualWriteService.js` does not handle customers
- ✅ All customer operations route through backend API only
- ✅ No direct Supabase client calls from frontend for customers
- ✅ FileMaker-specific code removed (e.g., `formatCustomerForFileMaker`)

**Code References**:
- src/hooks/useCustomer.js:112-177 (dual-write logic to remove)
- src/hooks/useSupabaseCustomer.js (entire file)
- src/api/customers.js (all FileMaker API calls)

---

## Functional Test Cases

### Test Suite 1: Create Customer Operations

#### Test 1.1: Create Customer with All Fields
**Given**: Valid customer data (business_name, email, phone, address)
**When**: POST /api/customers with complete data
**Then**:
- Returns 201 Created
- Response includes customer ID and all fields
- Customer appears in GET /api/customers
- Related records created (email, phone, address)

#### Test 1.2: Create Customer with Minimal Fields
**Given**: Only business_name provided
**When**: POST /api/customers with minimal data
**Then**:
- Returns 201 Created
- Customer created with is_active = true (default)
- No related records created

#### Test 1.3: Create Customer with Invalid Email
**Given**: Valid business_name, invalid email format
**When**: POST /api/customers with email "invalid-email"
**Then**:
- Returns 400 Bad Request
- Error message: "Invalid email format"

#### Test 1.4: Create Customer with Invalid Phone
**Given**: Valid business_name, invalid phone format
**When**: POST /api/customers with phone "abc123"
**Then**:
- Returns 400 Bad Request
- Error message: "Invalid phone format"

#### Test 1.5: Create Customer with Missing Business Name
**Given**: Empty business_name
**When**: POST /api/customers without business_name
**Then**:
- Returns 400 Bad Request
- Error message: "business_name is required"

#### Test 1.6: Create Duplicate Customer
**Given**: Customer with business_name "Acme Corp" already exists
**When**: POST /api/customers with same business_name
**Then**:
- Returns 409 Conflict
- Error includes existing customer ID
- No duplicate created

#### Test 1.7: Create Customer with Multiple Emails
**Given**: Valid customer data with 3 email addresses
**When**: POST /api/customers with emails array
**Then**:
- Returns 201 Created
- All 3 emails created in customer_email table
- Primary email flagged correctly

#### Test 1.8: Create Customer with Multiple Phones
**Given**: Valid customer data with 2 phone numbers
**When**: POST /api/customers with phones array
**Then**:
- Returns 201 Created
- Both phones created in customer_phone table
- Primary phone flagged correctly

#### Test 1.9: Create Customer with Idempotency Key
**Given**: Valid customer data with Idempotency-Key header
**When**: POST /api/customers twice with same key
**Then**:
- First request returns 201 Created
- Second request returns cached response (201)
- Only one customer created

---

### Test Suite 2: Read Customer Operations

#### Test 2.1: List All Customers
**Given**: Organization with 10 customers
**When**: GET /api/customers
**Then**:
- Returns 200 OK
- Response contains 10 customers
- Pagination metadata included

#### Test 2.2: List Active Customers Only
**Given**: Organization with 7 active, 3 inactive customers
**When**: GET /api/customers?active=true
**Then**:
- Returns 200 OK
- Response contains 7 customers
- All customers have is_active = true

#### Test 2.3: List Inactive Customers Only
**Given**: Organization with 7 active, 3 inactive customers
**When**: GET /api/customers?active=false
**Then**:
- Returns 200 OK
- Response contains 3 customers
- All customers have is_active = false

#### Test 2.4: Search Customers by Name
**Given**: Customers "Acme Corp", "Acme Inc", "Beta Corp"
**When**: GET /api/customers?search=acme
**Then**:
- Returns 200 OK
- Response contains 2 customers (case-insensitive match)

#### Test 2.5: Get Single Customer by ID
**Given**: Existing customer ID
**When**: GET /api/customers/{id}
**Then**:
- Returns 200 OK
- Response includes customer and all related data

#### Test 2.6: Get Non-Existent Customer
**Given**: Random UUID
**When**: GET /api/customers/{uuid}
**Then**:
- Returns 404 Not Found

#### Test 2.7: Get Customer with Related Projects
**Given**: Customer with 5 projects
**When**: GET /api/customers/{id}?include_projects=true
**Then**:
- Returns 200 OK
- Response includes 5 projects in projects array

#### Test 2.8: Paginate Customer List
**Given**: Organization with 150 customers
**When**: GET /api/customers?limit=50&offset=0
**Then**:
- Returns 200 OK
- Response contains 50 customers
- Pagination: has_more = true, total = 150

#### Test 2.9: Sort Customers by Name
**Given**: Customers "Zebra Corp", "Alpha Inc", "Beta LLC"
**When**: GET /api/customers?sort=business_name&order=asc
**Then**:
- Returns 200 OK
- Customers sorted alphabetically (Alpha, Beta, Zebra)

---

### Test Suite 3: Update Customer Operations

#### Test 3.1: Update Customer Business Name
**Given**: Existing customer
**When**: PATCH /api/customers/{id} with new business_name
**Then**:
- Returns 200 OK
- `updated_at` timestamp changed
- Business name updated

#### Test 3.2: Update Customer Email
**Given**: Customer with email "old@example.com"
**When**: PATCH /api/customers/{id} with emails array containing updated email
**Then**:
- Returns 200 OK
- Email updated in customer_email table

#### Test 3.3: Add New Email to Customer
**Given**: Customer with 1 email
**When**: PATCH /api/customers/{id} with 2 emails (1 existing, 1 new)
**Then**:
- Returns 200 OK
- New email added to customer_email table
- Existing email unchanged

#### Test 3.4: Update Customer Phone
**Given**: Customer with phone "+1 (555) 111-1111"
**When**: PATCH /api/customers/{id} with updated phone
**Then**:
- Returns 200 OK
- Phone updated in customer_phone table

#### Test 3.5: Update Customer Address
**Given**: Customer with address in San Francisco
**When**: PATCH /api/customers/{id} with new address in New York
**Then**:
- Returns 200 OK
- Address updated in customer_address table

#### Test 3.6: Update Non-Existent Customer
**Given**: Random UUID
**When**: PATCH /api/customers/{uuid}
**Then**:
- Returns 404 Not Found

#### Test 3.7: Update with Invalid Data
**Given**: Existing customer
**When**: PATCH /api/customers/{id} with invalid email
**Then**:
- Returns 400 Bad Request
- Customer unchanged

#### Test 3.8: Concurrent Update Conflict
**Given**: Customer with updated_at = "2024-01-10T10:00:00Z"
**When**: User A updates at 10:05, User B updates at 10:06 (both using stale data)
**Then**:
- User A update succeeds (200 OK)
- User B update returns 409 Conflict (optimistic locking)
- Error message includes current updated_at

#### Test 3.9: Partial Update (Only Business Name)
**Given**: Customer with email, phone, address
**When**: PATCH /api/customers/{id} with only business_name
**Then**:
- Returns 200 OK
- Business name updated
- Email, phone, address unchanged

---

### Test Suite 4: Toggle Customer Status

#### Test 4.1: Deactivate Customer
**Given**: Active customer (is_active = true)
**When**: PATCH /api/customers/{id}/status with is_active = false
**Then**:
- Returns 200 OK
- Customer is_active = false
- updated_at timestamp changed

#### Test 4.2: Activate Customer
**Given**: Inactive customer (is_active = false)
**When**: PATCH /api/customers/{id}/status with is_active = true
**Then**:
- Returns 200 OK
- Customer is_active = true

#### Test 4.3: Toggle Status on Non-Existent Customer
**Given**: Random UUID
**When**: PATCH /api/customers/{uuid}/status
**Then**:
- Returns 404 Not Found

---

### Test Suite 5: Delete Customer Operations

#### Test 5.1: Soft Delete Customer
**Given**: Existing customer with no active projects
**When**: DELETE /api/customers/{id}
**Then**:
- Returns 200 OK
- Customer marked as deleted (deleted_at timestamp set)
- Customer no longer appears in default list queries

#### Test 5.2: Hard Delete Customer
**Given**: Existing customer with no dependencies
**When**: DELETE /api/customers/{id}?hard_delete=true
**Then**:
- Returns 204 No Content
- Customer permanently deleted from database
- All related records deleted (cascade)

#### Test 5.3: Delete Customer with Active Projects
**Given**: Customer with 3 active projects
**When**: DELETE /api/customers/{id}
**Then**:
- Returns 409 Conflict
- Error message lists active projects
- Customer not deleted

#### Test 5.4: Delete Non-Existent Customer
**Given**: Random UUID
**When**: DELETE /api/customers/{uuid}
**Then**:
- Returns 404 Not Found

#### Test 5.5: Cascade Delete Related Records
**Given**: Customer with 2 emails, 1 phone, 1 address
**When**: DELETE /api/customers/{id}?hard_delete=true
**Then**:
- Returns 204 No Content
- All related records deleted (emails, phones, addresses)

---

### Test Suite 6: Row-Level Security Tests

#### Test 6.1: Organization Isolation (Read)
**Given**: User in Org A, customers exist in Org B
**When**: GET /api/customers
**Then**:
- Returns 200 OK with only Org A customers
- No Org B customers returned

#### Test 6.2: Organization Isolation (Create)
**Given**: User in Org A
**When**: POST /api/customers with organization_id = Org B
**Then**:
- Returns 403 Forbidden OR customer created in Org A (ignoring provided org_id)

#### Test 6.3: Organization Isolation (Update)
**Given**: User in Org A, customer belongs to Org B
**When**: PATCH /api/customers/{org_b_customer_id}
**Then**:
- Returns 403 Forbidden OR 404 Not Found

#### Test 6.4: Organization Isolation (Delete)
**Given**: User in Org A, customer belongs to Org B
**When**: DELETE /api/customers/{org_b_customer_id}
**Then**:
- Returns 403 Forbidden OR 404 Not Found

#### Test 6.5: Anonymous User
**Given**: No authentication
**When**: Any /api/customers request
**Then**:
- Returns 401 Unauthorized

#### Test 6.6: Service Role Access
**Given**: Service role credentials
**When**: GET /api/customers (all orgs)
**Then**:
- Returns 200 OK
- Can access customers from all organizations

#### Test 6.7: Related Table RLS (Email)
**Given**: User in Org A, customer email belongs to Org B
**When**: Direct query to customer_email table
**Then**:
- RLS policies prevent access to Org B emails

---

## Frontend UI Tests

### Test Suite 7: Customer List Component

#### Test 7.1: Display Customer List
**Given**: Organization with 10 customers
**When**: User navigates to Customers section
**Then**:
- List displays 10 customers
- Active customers sorted first, then by name
- Each customer shows name, status, contact info

#### Test 7.2: Filter Active Customers
**Given**: 7 active, 3 inactive customers
**When**: User toggles "Show Active Only" filter
**Then**:
- List displays 7 customers
- All displayed customers have active status

#### Test 7.3: Search Customers
**Given**: Customers "Acme Corp", "Beta Inc", "Acme Industries"
**When**: User types "acme" in search box
**Then**:
- List displays 2 matching customers
- Search is case-insensitive

#### Test 7.4: Empty State
**Given**: Organization with 0 customers
**When**: Customer list renders
**Then**:
- Empty state message displayed
- "Add Customer" button visible

---

### Test Suite 8: CustomerDetails Component

#### Test 8.1: Display Customer Details
**Given**: Customer with projects, tasks, financial records
**When**: User clicks customer from list
**Then**:
- CustomerDetails component renders
- Displays Overview, Projects, Tasks, Financial tabs
- Shows customer name, contact info, status

#### Test 8.2: Display Customer Projects
**Given**: Customer with 5 projects
**When**: User clicks "Projects" tab
**Then**:
- Projects tab displays 5 projects
- Each project shows name, status, dates

#### Test 8.3: Display Customer Financial Records
**Given**: Customer with financial records
**When**: User clicks "Financial" tab
**Then**:
- Financial tab displays records
- Shows totals, unpaid amounts

#### Test 8.4: Customer Not Found
**Given**: Non-existent customer ID in URL
**When**: User navigates to customer details
**Then**:
- Error message displayed
- "Return to Customers" link shown

---

### Test Suite 9: CustomerForm Component

#### Test 9.1: Create Customer via Form
**Given**: User clicks "Add Customer" button
**When**: User fills form (business_name, email, phone) and submits
**Then**:
- CustomerForm validates input
- Optimistic UI update shows new customer
- After API success, customer persists in list
- Form resets

#### Test 9.2: Create Customer - Validation Error
**Given**: CustomerForm open
**When**: User submits without business_name
**Then**:
- Validation error shown
- Form remains open for correction
- Customer not created

#### Test 9.3: Edit Customer via Form
**Given**: Customer "Acme Corp" selected
**When**: User clicks edit, changes name to "Acme Corporation", submits
**Then**:
- CustomerForm validates input
- Optimistic UI update shows new name
- After API success, customer name updated

#### Test 9.4: Edit Customer - API Failure
**Given**: Backend returns error
**When**: User submits customer edit
**Then**:
- Optimistic update reverted
- Error message shown via snackbar
- Form remains open with user's changes

#### Test 9.5: Cancel Edit
**Given**: CustomerForm in edit mode with changes
**When**: User clicks "Cancel"
**Then**:
- Form closes
- Changes discarded
- Customer details unchanged

---

### Test Suite 10: Customer Status Toggle

#### Test 10.1: Toggle Status from List
**Given**: Customer list with active customer
**When**: User clicks status toggle switch
**Then**:
- Optimistic UI shows inactive status
- API call updates backend
- Customer remains in list (if filter allows)

#### Test 10.2: Toggle Status from Details
**Given**: CustomerDetails showing active customer
**When**: User clicks status toggle in header
**Then**:
- Optimistic UI shows inactive status
- API call updates backend
- Customer header updates

#### Test 10.3: Toggle Status - API Failure
**Given**: Backend returns error
**When**: User toggles status
**Then**:
- Optimistic update reverted
- Error message shown
- Customer status unchanged

---

## Edge Cases and Error Scenarios

### Edge Case 1: Duplicate Business Names
**Scenario**: Same business name added for different customers
**Expected**: Allowed (business name not unique constraint)
**Test**: Create 2 customers with "Acme Corp" in different organizations
**Verify**: Both customers created with different IDs

### Edge Case 2: Very Long Business Names
**Scenario**: Business name exactly at 255 character limit
**Expected**: Accepted
**Test**: POST with 255-char business_name
**Verify**: Saved successfully

### Edge Case 3: Special Characters in Business Name
**Scenario**: Business name with Unicode, emojis, special chars
**Expected**: Stored as-is
**Test**: POST with `business_name: "Café René & Co. 日本🚀"`
**Verify**: Exact name stored and retrieved

### Edge Case 4: Multiple Primary Emails
**Scenario**: Customer update includes 2 emails both marked as primary
**Expected**: Only first email is primary, others auto-set to false
**Test**: PATCH with emails array where multiple have is_primary = true
**Verify**: Only one email has is_primary = true in database

### Edge Case 5: Concurrent Customer Creation
**Scenario**: 2 users create customers with same name simultaneously
**Expected**: Both succeed (no uniqueness constraint on name)
**Test**: 2 parallel POST requests with same business_name
**Verify**: Both customers created with unique IDs

### Edge Case 6: Customer Deleted Mid-Request
**Scenario**: Customer deleted while another user updating it
**Expected**: Update returns 404 error
**Test**: Delete customer, then PATCH same customer
**Verify**: PATCH returns 404 Not Found

### Edge Case 7: Orphaned Related Records (Migration)
**Scenario**: FileMaker customer has email but customer record missing
**Expected**: Logged and skipped during migration
**Test**: Include orphaned record in migration data
**Verify**: Migration completes, orphan logged, not imported

### Edge Case 8: Whitespace in Business Name
**Scenario**: Business name with leading/trailing spaces
**Expected**: Trimmed before storage
**Test**: POST with `business_name: "  Acme Corp  "`
**Verify**: Stored as `"Acme Corp"`

### Edge Case 9: Email Format Edge Cases
**Scenario**: Valid but unusual email formats
**Expected**: Accepted if valid per RFC 5322
**Test**: POST with emails like `user+tag@example.com`, `user@subdomain.example.com`
**Verify**: All valid emails accepted

### Edge Case 10: Phone Number Formats
**Scenario**: Various phone number formats (international, extensions)
**Expected**: Stored as-is (format validation flexible)
**Test**: POST with phones like `+1 (555) 123-4567 ext. 890`, `+44 20 7946 0958`
**Verify**: Stored and retrieved correctly

### Edge Case 11: Address Without Country
**Scenario**: Address provided but country field empty
**Expected**: Accepted (country is optional)
**Test**: POST with address missing country
**Verify**: Address saved with NULL country

### Edge Case 12: Soft-Deleted Customer Re-Creation
**Scenario**: Create customer with same name as previously soft-deleted customer
**Expected**: New customer created OR soft-deleted customer restored (design decision)
**Test**: Soft-delete "Acme Corp", then create new "Acme Corp"
**Verify**: Behavior matches design specification

---

## Performance Requirements

### Requirement 1: API Response Time
**Target**: All API operations ≤ 300ms (p95)
**Measurement**: Backend logs or APM
**Test**:
```bash
# Using ApacheBench
ab -n 1000 -c 10 https://api.claritybusinesssolutions.ca/api/customers?active=true
```
**Success**: p95 ≤ 300ms

### Requirement 2: Database Query Performance
**Target**: Customer list query uses indexes efficiently
**Measurement**: EXPLAIN ANALYZE
**Test**:
```sql
EXPLAIN ANALYZE
SELECT * FROM customers
WHERE organization_id = 'some-uuid'
  AND is_active = true
ORDER BY business_name;
```
**Success**: Index scan used (not sequential scan)

### Requirement 3: Frontend Load Time
**Target**: Customer list renders ≤ 200ms after data available
**Measurement**: React DevTools Profiler
**Success**: Render time ≤ 200ms for 100 customers

### Requirement 4: Optimistic UI Update
**Target**: UI updates ≤ 50ms after user submits action
**Measurement**: Manual testing with throttled network
**Success**: Customer appears/updates immediately (before API response)

### Requirement 5: Pagination Performance
**Target**: Support organizations with 1000+ customers
**Measurement**: Load test with large dataset
**Success**: UI remains responsive, API supports cursor-based pagination

### Requirement 6: Search Performance
**Target**: Customer search returns results ≤ 200ms
**Measurement**: Backend logs
**Test**: Search with common terms in 1000+ customer dataset
**Success**: p95 ≤ 200ms

---

## Success Metrics

### Migration Success Criteria
- ✅ 100% of FileMaker customers migrated
- ✅ 0% data loss (names, emails, phones, addresses, timestamps)
- ✅ 0 orphaned customers in production
- ✅ Migration completes within 4-hour maintenance window
- ✅ All customer IDs preserved (FileMaker UUID → Supabase UUID)

### Backend API Success Criteria
- ✅ All endpoints return correct HTTP status codes
- ✅ All CRUD operations functional
- ✅ RLS policies enforce organization isolation
- ✅ API documentation complete (OpenAPI spec)
- ✅ Related table updates atomic (transaction-based)

### Frontend Integration Success Criteria
- ✅ Zero FileMaker dependencies in `src/api/customers.js`
- ✅ All UI workflows function identically to FileMaker version
- ✅ No regression bugs reported in first 2 weeks
- ✅ Dual-write logic completely removed
- ✅ Direct Supabase calls replaced with backend API

### User Acceptance Criteria
- ✅ Users can create customers with contact info
- ✅ Customers display correctly in UI with all related data
- ✅ No change in user experience (seamless migration)
- ✅ Error messages are clear and actionable
- ✅ Customer search and filtering works as expected

### Performance Success Criteria
- ✅ Customer list loads in <500ms
- ✅ Customer details loads in <200ms
- ✅ API response times meet SLA (p95 ≤ 300ms)
- ✅ No performance degradation vs FileMaker implementation

---

## Rollback Plan

### Trigger Conditions
- Migration results in >5% data loss
- RLS policies fail, exposing cross-org data
- Frontend breaks production workflows
- API downtime >1 hour
- Critical bugs affecting customer operations

### Rollback Steps
1. Disable Supabase backend endpoints (return 503)
2. Re-enable FileMaker integration in `src/api/customers.js` via feature flag
3. Deploy frontend rollback
4. Verify FileMaker customers accessible
5. Investigate root cause
6. Fix issues and re-attempt migration

### Rollback Testing
- Test rollback procedure in staging environment
- Verify FileMaker still has original data
- Ensure no data corruption from dual-write removal
- Validate all customer workflows in FileMaker mode

---

## Test Execution Checklist

### Phase 1: Backend Tests (Pre-Frontend Migration)
- [ ] Run all Backend API Tests (Suites 1-6)
- [ ] Run all RLS Tests (Suite 6)
- [ ] Verify performance requirements
- [ ] Generate test coverage report
- [ ] Test idempotency and rate limiting

### Phase 2: Migration Tests
- [ ] Run migration in staging environment
- [ ] Execute all data validation queries
- [ ] Compare counts and relationships
- [ ] Test rollback procedure
- [ ] Verify ID reconciliation with dependent features

### Phase 3: Frontend Tests (Post-Migration)
- [ ] Run all Frontend UI Tests (Suites 7-10)
- [ ] Test edge cases
- [ ] Perform manual exploratory testing
- [ ] Verify customer stats calculations

### Phase 4: Integration Tests
- [ ] Verify customer-project relationships
- [ ] Verify customer-task relationships (via projects)
- [ ] Verify customer-financial records relationships
- [ ] Test customer deletion with cascades
- [ ] Test customer creation from prospect conversion

### Phase 5: Production Validation
- [ ] Smoke test all CRUD operations in production
- [ ] Monitor error rates (should be <0.1%)
- [ ] Check performance metrics
- [ ] Collect user feedback
- [ ] Verify no data loss

---

## Test Data Requirements

### Staging Environment Setup
- **Organizations**: 2 test organizations (Org A, Org B)
- **Users**: 4 users (2 in Org A, 1 in Org B, 1 service role)
- **Customers**: 50 test customers across orgs
  - 35 active, 15 inactive
  - Various contact info combinations (email-only, phone-only, both, neither)
  - Various address data (complete, partial, missing)
- **Projects**: 75 projects associated with customers
- **Tasks**: 120 tasks associated with projects
- **Financial Records**: 200 customer_sales records

### Test Customer Data Examples
```json
[
  {
    "business_name": "Acme Corporation",
    "is_active": true,
    "emails": [{"email": "contact@acme.com", "is_primary": true}],
    "phones": [{"phone": "+1 (555) 123-4567", "is_primary": true}],
    "addresses": [{
      "address_line1": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "postal_code": "94105",
      "country": "USA"
    }]
  },
  {
    "business_name": "Beta Industries",
    "is_active": true,
    "emails": [
      {"email": "info@beta.com", "is_primary": true},
      {"email": "billing@beta.com", "is_primary": false}
    ],
    "phones": [],
    "addresses": []
  },
  {
    "business_name": "Inactive Customer",
    "is_active": false,
    "emails": [],
    "phones": [{"phone": "+1 (555) 999-8888", "is_primary": true}],
    "addresses": []
  }
]
```

### FileMaker Export Sample
```json
{
  "response": {
    "data": [
      {
        "fieldData": {
          "__ID": "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
          "Name": "Acme Corporation",
          "Email": "contact@acme.com",
          "Phone": "+1 (555) 123-4567",
          "f_active": "1",
          "Address": "123 Main St",
          "City": "San Francisco",
          "State": "CA",
          "PostalCode": "94105",
          "Country": "USA",
          "ContactPerson": "John Doe",
          "~creationTimestamp": "2023-01-15T10:30:00",
          "~modificationTimestamp": "2023-12-01T14:45:00"
        },
        "recordId": "42"
      }
    ]
  }
}
```

---

## Automated Testing

### Unit Tests (Jest)
```javascript
// src/services/customerService.test.js
describe('customerService', () => {
  test('validateCustomerData requires business_name', () => {
    const result = validateCustomerData({ email: 'test@example.com' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('business_name is required');
  });

  test('validateCustomerData accepts valid email', () => {
    const result = validateCustomerData({
      business_name: 'Acme Corp',
      emails: [{ email: 'valid@example.com' }]
    });
    expect(result.valid).toBe(true);
  });

  test('sortCustomers places active customers first', () => {
    const customers = [
      { business_name: 'Beta', is_active: false },
      { business_name: 'Acme', is_active: true },
      { business_name: 'Charlie', is_active: true }
    ];
    const sorted = sortCustomers(customers);
    expect(sorted[0].business_name).toBe('Acme'); // Active, alphabetically first
    expect(sorted[2].business_name).toBe('Beta'); // Inactive
  });
});
```

### Integration Tests (API)
```javascript
// test/integration/customers.test.js
describe('Customers API', () => {
  test('POST /api/customers creates customer', async () => {
    const response = await request(app)
      .post('/api/customers')
      .send({
        business_name: 'Test Corp',
        emails: [{ email: 'test@example.com', is_primary: true }]
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('id');
    expect(response.body.data.business_name).toBe('Test Corp');
  });

  test('GET /api/customers filters by active status', async () => {
    const response = await request(app)
      .get('/api/customers?active=true')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.customers.every(c => c.is_active)).toBe(true);
  });
});
```

### E2E Tests (Playwright)
```javascript
// test/e2e/customers.spec.js
test('user can create customer', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Customers');
  await page.click('text=Add Customer');

  await page.fill('input[name="business_name"]', 'E2E Test Corp');
  await page.fill('input[name="email"]', 'e2e@example.com');
  await page.fill('input[name="phone"]', '+1 (555) 123-4567');

  await page.click('button:has-text("Save")');

  await expect(page.locator('text=E2E Test Corp')).toBeVisible();
});

test('user can toggle customer status', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Customers');

  // Find first active customer and toggle status
  const toggle = page.locator('[role="switch"]').first();
  await toggle.click();

  // Verify status changed
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
});
```

---

## Manual Testing Checklist

### Pre-Migration Manual Tests
- [ ] Verify FileMaker customers display correctly
- [ ] Create customer in FileMaker via UI
- [ ] Update customer in FileMaker via UI
- [ ] Toggle customer status in FileMaker mode
- [ ] Delete customer in FileMaker mode
- [ ] Verify customer-project relationships display

### Post-Migration Manual Tests
- [ ] Open customer list
- [ ] Create new customer via CustomerForm
- [ ] View customer details with all tabs
- [ ] Update customer via CustomerForm
- [ ] Update customer inline (if supported)
- [ ] Toggle customer status from list
- [ ] Toggle customer status from details
- [ ] Delete customer with confirmation
- [ ] Search for customer by name
- [ ] Filter customers by active status
- [ ] Navigate to customer from project
- [ ] Verify customer stats display correctly
- [ ] Test on mobile viewport (responsive design)

---

## Documentation Requirements

### User-Facing Documentation
- [ ] Update user guide with Supabase-based screenshots
- [ ] Document any UI changes (if applicable)
- [ ] Add troubleshooting section for common customer errors
- [ ] Update customer creation workflow documentation

### Developer Documentation
- [ ] Update API documentation (OpenAPI spec)
- [ ] Document RLS policies in database docs
- [ ] Update architecture diagrams (remove FileMaker)
- [ ] Add migration runbook for future reference
- [ ] Document ID reconciliation strategy
- [ ] Update code comments in customer-related files

---

## Sign-Off Criteria

Before marking migration complete, obtain sign-off from:

1. **Backend Team**: Schema changes, API endpoints, RLS policies tested and approved
2. **Frontend Team**: UI workflows tested, no regressions found
3. **QA Team**: All test suites pass, edge cases validated
4. **Product Owner**: User acceptance criteria met, migration successful
5. **DevOps**: Monitoring configured, rollback plan validated
6. **Data Team**: Migration scripts validated, data integrity confirmed

---

## Post-Migration Monitoring

### Week 1: Intensive Monitoring
- Monitor error rates hourly
- Check API response times daily
- Review user feedback daily
- Track customer creation/update volume
- Monitor database performance metrics

### Week 2-4: Standard Monitoring
- Weekly performance review
- Bi-weekly user feedback check
- Monthly data integrity audit
- Track customer growth trends

### Alerts to Configure
- Customer creation failure rate >1%
- API response time >500ms (p95)
- RLS policy violations detected
- Orphaned customer detected (missing organization_id)
- Database connection pool exhaustion
- Related table foreign key violations

---

## Appendix: SQL Validation Queries

```sql
-- Verify customers table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'customers'
ORDER BY ordinal_position;

-- Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('customers', 'customer_email', 'customer_phone', 'customer_address');

-- Verify foreign keys
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name LIKE 'customer%';

-- Verify RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename LIKE 'customer%';

-- List RLS policies
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename LIKE 'customer%';

-- Verify triggers
SELECT tgname, tgrelid::regclass, tgtype, tgenabled
FROM pg_trigger
WHERE tgrelid::regclass::text LIKE 'customer%'
  AND tgisinternal = false;

-- Data integrity check: customers without organization
SELECT COUNT(*) FROM customers WHERE organization_id IS NULL;

-- Data integrity check: orphaned emails
SELECT COUNT(*) FROM customer_email
WHERE customer_id NOT IN (SELECT id FROM customers);

-- Data integrity check: orphaned phones
SELECT COUNT(*) FROM customer_phone
WHERE customer_id NOT IN (SELECT id FROM customers);

-- Data integrity check: orphaned addresses
SELECT COUNT(*) FROM customer_address
WHERE customer_id NOT IN (SELECT id FROM customers);

-- Data integrity check: customers without any contact info
SELECT
  c.id,
  c.business_name,
  COUNT(DISTINCT e.id) AS email_count,
  COUNT(DISTINCT p.id) AS phone_count
FROM customers c
LEFT JOIN customer_email e ON e.customer_id = c.id
LEFT JOIN customer_phone p ON p.customer_id = c.id
GROUP BY c.id, c.business_name
HAVING COUNT(DISTINCT e.id) = 0 AND COUNT(DISTINCT p.id) = 0;
```

---

## Code References

### Files to Update (Phase 3: Frontend Refactor)
- `src/api/customers.js` - Replace all FileMaker calls with backend API
- `src/services/customerService.js` - Update to handle new data structures
- `src/hooks/useCustomer.js` - Remove dual-write logic (lines 112-177)
- `src/hooks/useSupabaseCustomer.js` - Repurpose or remove (487 lines)
- `src/components/customers/CustomerDetails.jsx` - Verify compatibility
- `src/components/customers/CustomerForm.jsx` - Update validation
- `src/components/customers/CustomerHeader.jsx` - Update status toggle
- `src/services/initializationService.js` - Update customer preload logic

### Files to Remove (Phase 5: Cleanup)
- `src/hooks/useSupabaseCustomer.js` (if not repurposed)
- FileMaker-specific helper functions in customerService.js
- Dual-write logic in useCustomer.js

---

## Conclusion

This acceptance criteria and test plan ensures comprehensive validation of the Customers migration from FileMaker to Supabase. All test cases must pass before promoting to production. Any failures should be documented, fixed, and re-tested.

The migration is considered successful when:
1. All functional tests pass (Suites 1-10)
2. All RLS policies enforce organization isolation
3. All performance requirements met
4. Zero data loss during migration
5. All UI workflows function identically to FileMaker version
6. No critical bugs reported in first 2 weeks post-migration
