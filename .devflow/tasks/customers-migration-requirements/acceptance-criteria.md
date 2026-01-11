# Acceptance Criteria - Customers Migration

## Document Purpose

This document defines comprehensive acceptance criteria, test cases, success metrics, performance requirements, and validation procedures for the Customers feature migration from FileMaker to Supabase. Each criterion includes validation methods, expected outcomes, and pass/fail thresholds.

**Document Version**: 1.0
**Last Updated**: 2026-01-10
**Task Reference**: TSK0011 - Define acceptance criteria
**Dependencies**: TSK0005 (API contracts), TSK0009 (Migration plan), TSK0010 (Edge cases)

---

## Table of Contents

1. [Pre-Migration Acceptance Criteria](#pre-migration-acceptance-criteria)
2. [Backend Implementation Acceptance Criteria](#backend-implementation-acceptance-criteria)
3. [Frontend Implementation Acceptance Criteria](#frontend-implementation-acceptance-criteria)
4. [Data Migration Acceptance Criteria](#data-migration-acceptance-criteria)
5. [Performance Acceptance Criteria](#performance-acceptance-criteria)
6. [Security & Authorization Acceptance Criteria](#security--authorization-acceptance-criteria)
7. [Edge Case Handling Acceptance Criteria](#edge-case-handling-acceptance-criteria)
8. [Post-Migration Acceptance Criteria](#post-migration-acceptance-criteria)
9. [User Acceptance Testing (UAT) Criteria](#user-acceptance-testing-uat-criteria)
10. [Success Metrics & KPIs](#success-metrics--kpis)

---

## Pre-Migration Acceptance Criteria

### PM-001: Backend Change Request Approved

**Requirement**: Backend change request document created and approved by backend team

**Validation Steps**:
1. [ ] Verify `BACKEND_CHANGE_REQUEST_002_CUSTOMERS_MIGRATION.md` exists
2. [ ] Document includes all required schema changes
3. [ ] Document includes all required RLS policies
4. [ ] Document includes all required API endpoints
5. [ ] Document includes migration script specification
6. [ ] Document includes rollback procedures
7. [ ] Backend team lead has signed off on document

**Pass Criteria**:
- Backend change request document complete (100% of required sections)
- Backend team approval documented with signature and date
- No outstanding questions or blockers from backend team

**Failure Actions**:
- Address backend team feedback
- Revise change request document
- Re-submit for approval

**Reference**: `.devflow/tasks/customers-migration-requirements/migration-plan.md:89-274`

---

### PM-002: Dual-Write Coverage Complete

**Requirement**: All customer CRUD operations dual-write to both FileMaker and Supabase

**Validation Steps**:
1. [ ] CREATE operation syncs to Supabase (verify in code: `src/hooks/useCustomer.js`)
2. [ ] UPDATE operation syncs to Supabase (verify existing implementation)
3. [ ] DELETE operation syncs to Supabase (verify in code: `src/hooks/useCustomer.js`)
4. [ ] STATUS_TOGGLE operation syncs to Supabase (verify in code)
5. [ ] All operations queue failed syncs for retry
6. [ ] Retry queue processes failed operations automatically
7. [ ] Test all operations with simulated Supabase failures

**Test Procedure**:
```javascript
// Test CREATE dual-write
const customer = await createCustomer({ business_name: "Test Corp", ... });
// Verify customer exists in both FileMaker AND Supabase
const fmCustomer = await fetchFromFileMaker(customer.id);
const sbCustomer = await fetchFromSupabase(customer.id);
assert(fmCustomer && sbCustomer, "Customer must exist in both systems");
```

**Pass Criteria**:
- 100% of CREATE operations dual-write successfully
- 100% of UPDATE operations dual-write successfully
- 100% of DELETE operations dual-write successfully
- 100% of STATUS_TOGGLE operations dual-write successfully
- Retry queue recovers from 100% of network failures in test scenarios

**Failure Actions**:
- Fix dual-write gaps in code
- Implement retry queue logic
- Re-test until 100% success rate achieved

**Reference**: `.devflow/tasks/customers-migration-requirements/migration-plan.md:278-318`

---

### PM-003: FileMaker Data Quality Validation

**Requirement**: FileMaker customer data validated and cleaned before migration

**Validation Steps**:
1. [ ] Export all FileMaker customers via Data API
2. [ ] Run UUID validation (all `__ID` fields are valid UUIDs)
3. [ ] Check for duplicate UUIDs (must be 0)
4. [ ] Validate email formats (RFC 5322 compliance)
5. [ ] Normalize phone numbers (E.164 format)
6. [ ] Identify customers missing required fields (business_name)
7. [ ] Generate pre-migration data quality report

**Pre-Migration Validation Script**:
```python
# Run validation script
python scripts/validate_filemaker_data.py

# Expected output:
# Total customers: 52
# Valid UUIDs: 52 (100%)
# Duplicate UUIDs: 0
# Valid emails: 48 (92%)
# Invalid emails: 4 (8%) - [list of invalid emails]
# Valid phones: 50 (96%)
# Invalid phones: 2 (4%) - [list of invalid phones]
# Missing business_name: 0
# Can proceed: YES
```

**Pass Criteria**:
- 100% of customers have valid UUIDs
- 0 duplicate UUIDs
- ≥ 95% of emails have valid format (or documented cleanup plan for invalid emails)
- ≥ 90% of phones in E.164 format (or documented normalization plan)
- 100% of customers have business_name
- Pre-migration report shows "Can proceed: YES"

**Failure Actions**:
- Clean up invalid emails/phones in FileMaker or migration script
- Generate new UUIDs for customers with missing/invalid `__ID`
- Document cleanup actions in migration report

**Reference**: `.devflow/tasks/customers-migration-requirements/migration-plan.md:1692-1775`

---

### PM-004: Staging Environment Ready

**Requirement**: Staging environment fully configured and tested

**Validation Steps**:
1. [ ] Supabase staging project created
2. [ ] Backend API staging environment deployed
3. [ ] Test organization created in staging
4. [ ] Sample FileMaker data (10-20 customers) exported
5. [ ] Can create customer via staging backend API
6. [ ] Can fetch customer via staging backend API
7. [ ] Can update customer via staging backend API
8. [ ] Can delete customer via staging backend API
9. [ ] RLS policies enforced in staging
10. [ ] JWT claims correctly populated with organization_id and role

**Test Procedure**:
```bash
# Test staging API
curl -X POST "https://api-staging.claritybusinesssolutions.ca/api/customers" \
  -H "Authorization: Bearer {hmac_signature}.{timestamp}" \
  -H "Content-Type: application/json" \
  -d '{"business_name": "Test Customer", "organization_id": "test-org-uuid"}'

# Expected: 201 Created with customer data
```

**Pass Criteria**:
- All backend API endpoints return correct responses in staging
- RLS policies block cross-organization access (verified with test users)
- Staging environment performance within 10% of target (< 500ms p95 latency)
- No errors in backend logs during testing

**Failure Actions**:
- Fix staging environment configuration
- Debug RLS policy issues
- Verify backend API deployment

---

## Backend Implementation Acceptance Criteria

### BE-001: Database Schema Changes Applied

**Requirement**: All required schema changes deployed to Supabase

**Validation Steps**:
1. [ ] Verify `customers.is_active` column exists (type: BOOLEAN, default: true)
2. [ ] Verify index `idx_customers_active` exists
3. [ ] Verify `customers.primary_contact_name` column exists (type: TEXT)
4. [ ] Verify `customers.financial_data` column exists (type: JSONB, default: '{}')
5. [ ] Verify GIN index `idx_customers_financial_data` exists
6. [ ] Verify `customers.encrypted_credentials` column exists (type: JSONB, default: '{}')
7. [ ] Verify CASCADE constraints added to `customer_phone` and `customer_address`
8. [ ] Verify unique indexes for primary email/phone per customer

**Database Verification Query**:
```sql
-- Check schema
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'customers'
  AND column_name IN ('is_active', 'primary_contact_name', 'financial_data', 'encrypted_credentials')
ORDER BY column_name;

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'customers'
  AND indexname IN ('idx_customers_active', 'idx_customers_financial_data');

-- Check foreign key constraints
SELECT conname, confupdtype, confdeltype
FROM pg_constraint
WHERE conname IN ('customer_phone_customer_id_fkey', 'customer_address_customer_id_fkey');
```

**Pass Criteria**:
- All required columns exist with correct data types
- All required indexes exist and contain expected columns
- All foreign key constraints have ON DELETE CASCADE
- No schema migration errors in backend logs
- Schema changes verified in both staging and production

**Failure Actions**:
- Re-run database migrations
- Verify migration scripts
- Check database permissions

**Reference**: `.devflow/tasks/customers-migration-requirements/migration-plan.md:100-135`

---

### BE-002: RLS Policies Implemented and Enforced

**Requirement**: Row-Level Security policies prevent cross-organization data access

**Validation Steps**:
1. [ ] RLS enabled on `customers` table
2. [ ] RLS enabled on `customer_email` table
3. [ ] RLS enabled on `customer_phone` table
4. [ ] RLS enabled on `customer_address` table
5. [ ] RLS enabled on `customer_contacts` table
6. [ ] SELECT policy enforces organization scoping
7. [ ] INSERT policy enforces organization scoping
8. [ ] UPDATE policy enforces organization scoping
9. [ ] DELETE policy enforces organization scoping (admin-only)
10. [ ] Test with multiple organizations and roles

**Security Test Procedure**:
```javascript
// Create two test organizations
const orgA = await createOrganization("Org A");
const orgB = await createOrganization("Org B");

// Create users in each org
const userA = await createUser("user-a@example.com", orgA.id, "member");
const userB = await createUser("user-b@example.com", orgB.id, "admin");

// Create customer in Org B
const customerB = await createCustomer("Customer B", orgB.id);

// Test 1: User A cannot access Customer B (cross-org)
const response = await fetchCustomer(customerB.id, userA.token);
assert(response.status === 404, "Cross-org access must be blocked");

// Test 2: User B can access Customer B (same org)
const response2 = await fetchCustomer(customerB.id, userB.token);
assert(response2.status === 200, "Same-org access must succeed");

// Test 3: Member cannot delete customer (role-based)
const deleteResponse = await deleteCustomer(customerB.id, userA.token);
assert(deleteResponse.status === 403, "Non-admin cannot delete");

// Test 4: Admin can delete customer (role-based)
const deleteResponse2 = await deleteCustomer(customerB.id, userB.token);
assert(deleteResponse2.status === 204, "Admin can delete");
```

**Pass Criteria**:
- 100% of cross-organization access attempts blocked (404 Not Found)
- 100% of same-organization access attempts succeed (200 OK)
- Role-based permissions enforced (admin, member, viewer)
- No RLS bypass vulnerabilities found in penetration testing
- RLS policy effectiveness verified in staging and production

**Failure Actions**:
- Fix RLS policy syntax errors
- Add missing policies for related tables
- Test with additional user/org combinations
- Audit RLS effectiveness with security team

**Reference**: `.devflow/tasks/customers-migration-requirements/authorization.md`

---

### BE-003: Core CRUD Endpoints Implemented

**Requirement**: All critical API endpoints implemented and passing integration tests

**Validation Steps**:

| Endpoint | Method | Status Code | Response Validation | Test Status |
|----------|--------|-------------|---------------------|-------------|
| `/api/customers` | GET | 200 | Returns paginated customer list | [ ] |
| `/api/customers/:id` | GET | 200 | Returns customer with related data | [ ] |
| `/api/customers` | POST | 201 | Creates customer + related records | [ ] |
| `/api/customers/:id` | PATCH | 200 | Updates customer atomically | [ ] |
| `/api/customers/:id` | DELETE | 204 | Deletes customer + cascades | [ ] |
| `/api/customers/:id/toggle-status` | POST | 200 | Toggles is_active field | [ ] |
| `/api/customers/batch` | POST | 200 | Batch creates customers | [ ] |
| `/api/customers/search` | GET | 200 | Searches by name/email/phone | [ ] |

**Integration Test Suite**:
```python
# Test suite: tests/integration/test_customers_api.py

async def test_list_customers():
    """AC-BE-003-01: List customers endpoint"""
    response = await client.get("/api/customers?limit=50&active=true")
    assert response.status_code == 200
    assert "customers" in response.json()["data"]
    assert len(response.json()["data"]["customers"]) <= 50

async def test_get_customer_by_id():
    """AC-BE-003-02: Get customer by ID endpoint"""
    customer = await create_test_customer()
    response = await client.get(f"/api/customers/{customer.id}")
    assert response.status_code == 200
    assert response.json()["data"]["id"] == customer.id

async def test_create_customer():
    """AC-BE-003-03: Create customer endpoint"""
    customer_data = {
        "business_name": "Test Corp",
        "emails": [{"email": "test@example.com", "is_primary": true}],
        "phones": [{"phone": "+14035551234", "is_primary": true}]
    }
    response = await client.post("/api/customers", json=customer_data)
    assert response.status_code == 201
    assert response.json()["data"]["business_name"] == "Test Corp"

async def test_update_customer():
    """AC-BE-003-04: Update customer endpoint"""
    customer = await create_test_customer()
    update_data = {"business_name": "Updated Corp"}
    response = await client.patch(f"/api/customers/{customer.id}", json=update_data)
    assert response.status_code == 200
    assert response.json()["data"]["business_name"] == "Updated Corp"

async def test_delete_customer():
    """AC-BE-003-05: Delete customer endpoint"""
    customer = await create_test_customer()
    response = await client.delete(f"/api/customers/{customer.id}")
    assert response.status_code == 204
    # Verify cascading delete
    emails = await db.query(CustomerEmail).filter_by(customer_id=customer.id).all()
    assert len(emails) == 0, "Related emails must be deleted"
```

**Pass Criteria**:
- All endpoints return correct HTTP status codes
- All endpoints return data in standardized response format
- All mutations wrapped in database transactions (atomic)
- All endpoints support idempotency keys
- All validation errors return 400 with detailed error messages
- Integration test suite passes with ≥ 95% success rate
- Code coverage for endpoint handlers ≥ 80%

**Failure Actions**:
- Fix failing integration tests
- Add missing error handling
- Implement missing idempotency support
- Add validation middleware

**Reference**: `.devflow/tasks/customers-migration-requirements/api-contracts.md`

---

### BE-004: Migration Script Tested in Staging

**Requirement**: Migration script successfully imports all FileMaker customers to Supabase staging

**Validation Steps**:
1. [ ] Export all FileMaker customers (52 customers)
2. [ ] Run transformation script (FileMaker → Supabase format)
3. [ ] Validate transformed data (no errors)
4. [ ] Import to Supabase staging
5. [ ] Verify customer count matches (52 customers)
6. [ ] Verify all related records created (emails, phones, addresses)
7. [ ] Run reconciliation queries (0 orphaned records)
8. [ ] Spot-check 20 random customers for data accuracy
9. [ ] Generate migration report

**Migration Script Execution**:
```bash
# Run migration script
python scripts/migrate_customers_from_filemaker.py --environment=staging --dry-run=false

# Expected output:
# Total FileMaker customers: 52
# Transformation complete: 52 customers
# Validation passed: 52 customers (0 errors, 3 warnings)
# Import started...
# Imported: 52/52 customers (100%)
# Created emails: 48
# Created phones: 50
# Created addresses: 45
# Duration: 3m 42s
# Status: SUCCESS
```

**Reconciliation Validation**:
```sql
-- Verify counts match
SELECT
  (SELECT COUNT(*) FROM filemaker_export) AS filemaker_count,
  (SELECT COUNT(*) FROM customers WHERE organization_id = 'staging-org-uuid') AS supabase_count;

-- Expected: Both counts = 52

-- Verify no orphaned records
SELECT
  (SELECT COUNT(*) FROM customer_email ce LEFT JOIN customers c ON c.id = ce.customer_id WHERE c.id IS NULL) AS orphaned_emails,
  (SELECT COUNT(*) FROM customer_phone cp LEFT JOIN customers c ON c.id = cp.customer_id WHERE c.id IS NULL) AS orphaned_phones,
  (SELECT COUNT(*) FROM customer_address ca LEFT JOIN customers c ON c.id = ca.customer_id WHERE c.id IS NULL) AS orphaned_addresses;

-- Expected: All counts = 0
```

**Pass Criteria**:
- Migration script completes without errors
- Customer count in Supabase matches FileMaker (52/52 = 100%)
- All UUIDs preserved (FileMaker `__ID` = Supabase `customers.id`)
- No orphaned records detected (0 emails, 0 phones, 0 addresses without customer)
- Spot-check shows 100% data accuracy (20/20 customers match)
- Migration report shows "SUCCESS" status

**Failure Actions**:
- Debug migration script errors
- Fix data transformation logic
- Re-run migration after fixes
- Generate detailed error report

**Reference**: `.devflow/tasks/customers-migration-requirements/migration-plan.md:805-1338`

---

## Frontend Implementation Acceptance Criteria

### FE-001: Feature Flag Implementation

**Requirement**: Feature flag enables toggling between FileMaker and Supabase backends

**Validation Steps**:
1. [ ] Environment variable `VITE_USE_SUPABASE_CUSTOMERS` added to `.env`
2. [ ] API layer routes based on feature flag (`src/api/customers.js`)
3. [ ] All customer operations support both backends
4. [ ] Feature flag can be toggled without code changes
5. [ ] Test with feature flag enabled (Supabase mode)
6. [ ] Test with feature flag disabled (FileMaker mode)
7. [ ] No breaking changes to existing FileMaker code

**Test Procedure**:
```bash
# Test with Supabase enabled
echo "VITE_USE_SUPABASE_CUSTOMERS=true" >> .env
npm run dev
# Verify: All customer operations route to backend API

# Test with Supabase disabled
echo "VITE_USE_SUPABASE_CUSTOMERS=false" >> .env
npm run dev
# Verify: All customer operations route to FileMaker
```

**Code Verification**:
```javascript
// src/api/customers.js
const USE_SUPABASE = import.meta.env.VITE_USE_SUPABASE_CUSTOMERS === 'true';

export async function fetchCustomers() {
  if (USE_SUPABASE) {
    return await backendAPI.get('/api/customers');
  } else {
    return await fileMakerAPI.fetchCustomers();
  }
}
// Verify similar pattern for all CRUD operations
```

**Pass Criteria**:
- Feature flag correctly toggles data source
- All customer operations work with flag enabled
- All customer operations work with flag disabled
- No JavaScript errors in console (both modes)
- No breaking changes to existing FileMaker functionality
- Build succeeds with no errors

**Failure Actions**:
- Fix routing logic in API layer
- Add missing feature flag checks
- Test all edge cases

**Reference**: `.devflow/tasks/customers-migration-requirements/migration-plan.md:1445-1556`

---

### FE-002: Backend API Integration Complete

**Requirement**: All customer operations integrated with backend API (Supabase mode)

**Validation Steps**:
1. [ ] `fetchCustomers()` calls `GET /api/customers`
2. [ ] `fetchCustomerById()` calls `GET /api/customers/:id`
3. [ ] `createCustomer()` calls `POST /api/customers`
4. [ ] `updateCustomer()` calls `PATCH /api/customers/:id`
5. [ ] `deleteCustomer()` calls `DELETE /api/customers/:id`
6. [ ] `toggleCustomerStatus()` calls `POST /api/customers/:id/toggle-status`
7. [ ] All responses transformed to match frontend data model
8. [ ] All errors handled gracefully
9. [ ] Retry logic implemented for network failures

**Frontend Integration Test**:
```javascript
// Enable Supabase mode
process.env.VITE_USE_SUPABASE_CUSTOMERS = 'true';

// Test list
const customers = await fetchCustomers();
assert(Array.isArray(customers), "Returns array of customers");

// Test create
const newCustomer = await createCustomer({
  business_name: "Test Corp",
  emails: [{ email: "test@example.com", is_primary: true }]
});
assert(newCustomer.id, "Returns created customer with ID");

// Test update
const updated = await updateCustomer(newCustomer.id, {
  business_name: "Updated Corp"
});
assert(updated.business_name === "Updated Corp", "Returns updated customer");

// Test delete
await deleteCustomer(newCustomer.id);
const deleted = await fetchCustomerById(newCustomer.id);
assert(deleted === null, "Customer deleted successfully");
```

**Pass Criteria**:
- All API calls use correct endpoints
- All responses correctly transformed to frontend format
- Error responses display user-friendly messages
- Network failures trigger retry logic
- All CRUD operations work end-to-end with backend API
- No JavaScript console errors

**Failure Actions**:
- Fix API endpoint paths
- Add response transformation logic
- Implement error handling
- Add retry logic

**Reference**: `.devflow/tasks/customers-migration-requirements/migration-plan.md:662-697`

---

### FE-003: UI Components Updated for Supabase

**Requirement**: All customer UI components display Supabase data correctly

**Validation Steps**:
1. [ ] `CustomerDetails.jsx` displays all customer fields from Supabase
2. [ ] `CustomerForm.jsx` submits data to backend API
3. [ ] `CustomerList.jsx` paginates using backend API
4. [ ] `CustomerSearch.jsx` uses backend search endpoint
5. [ ] All customer data fields render correctly (no missing data)
6. [ ] Validation errors displayed from backend responses
7. [ ] No `recordId` references in UI components (Supabase uses `id` only)

**UI Test Procedure**:
1. Navigate to Customers page
2. Verify customer list displays correctly
3. Click on a customer → verify detail view shows all fields
4. Edit customer → verify form pre-populates with current data
5. Save changes → verify success message displays
6. Search for customer → verify search results correct
7. Delete customer → verify confirmation dialog and success message

**Pass Criteria**:
- All customer data displays correctly in list view
- All customer data displays correctly in detail view
- Form validation works (required fields, email format, etc.)
- Search functionality returns correct results
- Create/update/delete operations show appropriate user feedback
- No missing or undefined fields in UI
- No broken layouts or styling issues

**Failure Actions**:
- Fix component data bindings
- Add missing field mappings
- Update validation logic
- Fix UI styling issues

**Reference**: `.devflow/tasks/customers-migration-requirements/migration-plan.md:682-697`

---

## Data Migration Acceptance Criteria

### DM-001: Data Integrity Validation

**Requirement**: 100% of FileMaker customer data migrated to Supabase with no data loss

**Validation Steps**:
1. [ ] Customer count matches exactly (FileMaker: 52, Supabase: 52)
2. [ ] All UUIDs preserved (FileMaker `__ID` = Supabase `customers.id`)
3. [ ] All business names match
4. [ ] All email addresses imported correctly
5. [ ] All phone numbers normalized to E.164 format
6. [ ] All addresses imported (where City/State present)
7. [ ] All active/inactive statuses match
8. [ ] All timestamps preserved (created_at, updated_at)

**Reconciliation Query**:
```sql
-- Compare FileMaker export vs Supabase import
WITH fm_customers AS (
  SELECT * FROM filemaker_export_table
),
sb_customers AS (
  SELECT * FROM customers WHERE organization_id = 'production-org-uuid'
)
SELECT
  (SELECT COUNT(*) FROM fm_customers) AS filemaker_count,
  (SELECT COUNT(*) FROM sb_customers) AS supabase_count,
  (SELECT COUNT(*) FROM fm_customers fm LEFT JOIN sb_customers sb ON fm.__ID::uuid = sb.id WHERE sb.id IS NULL) AS missing_in_supabase,
  (SELECT COUNT(*) FROM sb_customers sb LEFT JOIN fm_customers fm ON sb.id = fm.__ID::uuid WHERE fm.__ID IS NULL) AS extra_in_supabase;

-- Expected: filemaker_count = supabase_count, missing_in_supabase = 0
```

**Spot-Check Validation** (20 random customers):
```python
import random

# Select 20 random customers for manual verification
sample_ids = random.sample(all_customer_ids, 20)

for customer_id in sample_ids:
    fm_data = fetch_from_filemaker(customer_id)
    sb_data = fetch_from_supabase(customer_id)

    # Compare key fields
    assert fm_data['Name'] == sb_data['business_name']
    assert fm_data['Email'].lower() == sb_data['emails'][0]['email']
    assert normalize_phone(fm_data['phone']) == sb_data['phones'][0]['phone']
    assert (fm_data['f_active'] == '1') == sb_data['is_active']
```

**Pass Criteria**:
- Customer counts match exactly (±0 customers)
- 100% of UUIDs preserved (52/52)
- Spot-check shows 100% data accuracy (20/20 customers)
- 0 orphaned records (emails, phones, addresses)
- All foreign key constraints satisfied
- No data loss or corruption detected

**Failure Actions**:
- Identify missing customers and re-import
- Fix data transformation errors
- Re-run reconciliation until 100% match achieved

**Reference**: `.devflow/tasks/customers-migration-requirements/migration-plan.md:1780-1903`

---

### DM-002: Foreign Key Integrity

**Requirement**: All related records (emails, phones, addresses) correctly linked to customers

**Validation Steps**:
1. [ ] All customer_email records have valid customer_id
2. [ ] All customer_phone records have valid customer_id
3. [ ] All customer_address records have valid customer_id
4. [ ] All customer_contacts records have valid customer_id
5. [ ] Verify CASCADE constraints work (delete customer → related records deleted)
6. [ ] No orphaned records in any related table

**Foreign Key Integrity Query**:
```sql
-- Check for orphaned emails
SELECT 'Orphaned Emails' AS table_name, COUNT(*) AS orphan_count
FROM customer_email ce
LEFT JOIN customers c ON c.id = ce.customer_id
WHERE c.id IS NULL

UNION ALL

-- Check for orphaned phones
SELECT 'Orphaned Phones', COUNT(*)
FROM customer_phone cp
LEFT JOIN customers c ON c.id = cp.customer_id
WHERE c.id IS NULL

UNION ALL

-- Check for orphaned addresses
SELECT 'Orphaned Addresses', COUNT(*)
FROM customer_address ca
LEFT JOIN customers c ON c.id = ca.customer_id
WHERE c.id IS NULL

UNION ALL

-- Check for orphaned contacts
SELECT 'Orphaned Contacts', COUNT(*)
FROM customer_contacts cc
LEFT JOIN customers c ON c.id = cc.customer_id
WHERE c.id IS NULL;

-- Expected: All counts = 0
```

**Cascade Delete Test**:
```sql
-- Create test customer with related records
INSERT INTO customers (id, business_name, organization_id) VALUES ('test-uuid', 'Test Customer', 'org-uuid');
INSERT INTO customer_email (customer_id, email, is_primary) VALUES ('test-uuid', 'test@example.com', true);
INSERT INTO customer_phone (customer_id, phone, is_primary) VALUES ('test-uuid', '+14035551234', true);

-- Delete customer
DELETE FROM customers WHERE id = 'test-uuid';

-- Verify related records also deleted
SELECT COUNT(*) FROM customer_email WHERE customer_id = 'test-uuid'; -- Expected: 0
SELECT COUNT(*) FROM customer_phone WHERE customer_id = 'test-uuid'; -- Expected: 0
```

**Pass Criteria**:
- 0 orphaned records in all related tables
- CASCADE constraints delete related records automatically
- All foreign key relationships valid
- No constraint violations detected

**Failure Actions**:
- Add missing CASCADE constraints
- Run cleanup script to remove orphaned records
- Fix foreign key relationships

**Reference**: `.devflow/tasks/customers-migration-requirements/edge-cases.md:836-1055`

---

### DM-003: Rollback Procedure Tested

**Requirement**: Rollback procedure successfully restores FileMaker-only mode

**Validation Steps**:
1. [ ] Document rollback procedure (step-by-step)
2. [ ] Test rollback in staging environment
3. [ ] Verify feature flag disables Supabase mode
4. [ ] Verify all operations route back to FileMaker
5. [ ] Verify no data loss during rollback
6. [ ] Measure rollback time (target: < 15 minutes)
7. [ ] Test rollback multiple times for reliability

**Rollback Test Procedure**:
```bash
# 1. Enable Supabase mode
echo "VITE_USE_SUPABASE_CUSTOMERS=true" >> .env
npm run build && npm run deploy

# 2. Create test customer in Supabase mode
curl -X POST "/api/customers" -d '{"business_name": "Rollback Test"}'

# 3. Disable Supabase mode (rollback)
echo "VITE_USE_SUPABASE_CUSTOMERS=false" >> .env
npm run build && npm run deploy

# 4. Verify operations route to FileMaker
curl -X GET "/api/customers" # Should fetch from FileMaker, not Supabase

# 5. Verify customer created during Supabase mode still exists
# (if dual-write worked correctly)
```

**Pass Criteria**:
- Rollback completes in < 15 minutes
- All customer operations route to FileMaker after rollback
- No JavaScript errors after rollback
- No data loss detected (customers created during Supabase mode preserved)
- Rollback tested successfully 3/3 times

**Failure Actions**:
- Optimize rollback procedure
- Fix data sync issues
- Document manual recovery steps

**Reference**: `.devflow/tasks/customers-migration-requirements/migration-plan.md:1986-2123`

---

## Performance Acceptance Criteria

### PERF-001: API Response Time Targets

**Requirement**: All API endpoints meet performance targets under load

**Performance Targets**:

| Operation | Target p95 | Target p99 | Current FileMaker | Improvement |
|-----------|-----------|-----------|-------------------|-------------|
| List customers (50) | < 300ms | < 500ms | 250-550ms | 1.5-2x faster |
| Get customer by ID | < 200ms | < 300ms | 105-310ms | 1.5x faster |
| Create customer | < 300ms | < 500ms | 200-400ms | 1.3x faster |
| Update customer | < 300ms | < 500ms | 550-1200ms | 3-4x faster |
| Delete customer | < 200ms | < 300ms | 150-300ms | Same or better |
| Search customers | < 300ms | < 500ms | 300-600ms | 2x faster |

**Load Testing Script**:
```javascript
// k6 load test script
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 10 },  // Ramp up to 10 concurrent users
    { duration: '5m', target: 10 },  // Stay at 10 users
    { duration: '2m', target: 20 },  // Ramp up to 20 users
    { duration: '5m', target: 20 },  // Stay at 20 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    'http_req_duration{operation:list}': ['p(95)<300', 'p(99)<500'],
    'http_req_duration{operation:get}': ['p(95)<200', 'p(99)<300'],
    'http_req_duration{operation:create}': ['p(95)<300', 'p(99)<500'],
    'http_req_duration{operation:update}': ['p(95)<300', 'p(99)<500'],
  }
};

export default function () {
  // List customers
  let listResponse = http.get('https://api.claritybusinesssolutions.ca/api/customers?limit=50', {
    tags: { operation: 'list' }
  });
  check(listResponse, {
    'list status 200': (r) => r.status === 200,
    'list response time < 300ms': (r) => r.timings.duration < 300,
  });

  sleep(1);
}
```

**Test Execution**:
```bash
# Run load test
k6 run load-test.js

# Expected output:
# ✓ list status 200 ......................... 100% ✓ 3000 ✗ 0
# ✓ list response time < 300ms .............. 95%  ✓ 2850 ✗ 150
# http_req_duration{operation:list} ........ avg=185ms p95=275ms p99=450ms
```

**Pass Criteria**:
- p95 latency < 300ms for list operations (target met)
- p95 latency < 200ms for get operations (target met)
- p95 latency < 300ms for create/update operations (target met)
- p99 latency within acceptable thresholds (< 500ms)
- Error rate < 0.5% under load
- Throughput > 50 req/s with 20 concurrent users

**Failure Actions**:
- Optimize database queries (add indexes)
- Enable query result caching
- Optimize response payloads (reduce data size)
- Scale backend infrastructure

**Reference**: `.devflow/tasks/customers-migration-requirements/migration-plan.md:2139-2262`

---

### PERF-002: Database Query Optimization

**Requirement**: All database queries use indexes and execute in < 50ms

**Validation Steps**:
1. [ ] Verify all required indexes created
2. [ ] Run EXPLAIN ANALYZE on common queries
3. [ ] Ensure all queries use index scans (no sequential scans)
4. [ ] Measure query execution time (< 50ms target)
5. [ ] Optimize slow queries (> 50ms)

**Index Verification Query**:
```sql
-- List all indexes on customer tables
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('customers', 'customer_email', 'customer_phone', 'customer_address', 'customer_contacts')
ORDER BY tablename, indexname;

-- Expected indexes:
-- customers_pkey (PRIMARY KEY on id)
-- idx_customers_org (organization_id)
-- idx_customers_active (is_active WHERE is_active = true)
-- idx_customers_business_name (business_name USING gin)
-- idx_customers_org_type (organization_id, type)
-- idx_customers_created_at (created_at DESC)
```

**Query Performance Validation**:
```sql
-- Test list customers query
EXPLAIN ANALYZE
SELECT c.*, ce.email, cp.phone
FROM customers c
LEFT JOIN customer_email ce ON ce.customer_id = c.id AND ce.is_primary = true
LEFT JOIN customer_phone cp ON cp.customer_id = c.id AND cp.is_primary = true
WHERE c.organization_id = 'org-uuid'
  AND c.is_active = true
ORDER BY c.business_name
LIMIT 50;

-- Expected execution time: < 50ms
-- Expected plan: Index Scan using idx_customers_org
```

**Pass Criteria**:
- All queries use index scans (no sequential scans on large tables)
- Query execution time < 50ms for 95% of queries
- No missing indexes on foreign keys
- Query plan shows optimal index usage

**Failure Actions**:
- Add missing indexes
- Rewrite inefficient queries
- Analyze query plans and optimize joins

**Reference**: `.devflow/tasks/customers-migration-requirements/migration-plan.md:2218-2262`

---

## Security & Authorization Acceptance Criteria

### SEC-001: Row-Level Security Enforcement

**Requirement**: RLS policies prevent unauthorized data access

**Validation Steps**:
1. [ ] Create 3 test organizations (Org A, Org B, Org C)
2. [ ] Create users with different roles (admin, member, viewer) in each org
3. [ ] Create customers in each organization
4. [ ] Test cross-organization access (must fail)
5. [ ] Test same-organization access (must succeed)
6. [ ] Test role-based permissions (admin vs member)
7. [ ] Attempt RLS bypass via direct Supabase client (must fail)

**Security Test Matrix**:

| Test Case | User Org | User Role | Target Customer Org | Operation | Expected Result |
|-----------|----------|-----------|---------------------|-----------|-----------------|
| SEC-001-01 | Org A | Admin | Org A | SELECT | 200 OK |
| SEC-001-02 | Org A | Admin | Org B | SELECT | 404 Not Found |
| SEC-001-03 | Org A | Member | Org A | INSERT | 201 Created |
| SEC-001-04 | Org A | Viewer | Org A | INSERT | 403 Forbidden |
| SEC-001-05 | Org A | Member | Org A | UPDATE | 200 OK |
| SEC-001-06 | Org A | Member | Org B | UPDATE | 404 Not Found |
| SEC-001-07 | Org A | Admin | Org A | DELETE | 204 No Content |
| SEC-001-08 | Org A | Member | Org A | DELETE | 403 Forbidden |

**RLS Bypass Test** (Penetration Testing):
```javascript
// Attempt to bypass RLS via direct Supabase client
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Attempt to fetch customer from different organization
const { data, error } = await supabase
  .from('customers')
  .select('*')
  .eq('id', 'other-org-customer-uuid')
  .single();

// Expected: data = null, error = "Row not found" (RLS blocked access)
assert(data === null, "RLS bypass attempt must fail");
```

**Pass Criteria**:
- 100% of cross-organization access attempts blocked
- 100% of same-organization access attempts succeed (with correct role)
- Role-based permissions correctly enforced
- Direct Supabase client queries respect RLS policies
- No RLS bypass vulnerabilities found in penetration testing

**Failure Actions**:
- Fix RLS policy logic
- Add missing role checks
- Test with additional scenarios
- Engage security team for audit

**Reference**: `.devflow/tasks/customers-migration-requirements/edge-cases.md:1840-1951`

---

### SEC-002: Input Validation and Sanitization

**Requirement**: All user inputs validated and sanitized to prevent injection attacks

**Validation Steps**:
1. [ ] Test SQL injection in business_name field
2. [ ] Test XSS in email/phone fields
3. [ ] Test invalid email formats rejected
4. [ ] Test invalid phone formats rejected
5. [ ] Test excessively long inputs rejected
6. [ ] Test special characters handled correctly
7. [ ] Test all validation errors return 400 Bad Request

**Security Test Cases**:
```javascript
// Test 1: SQL Injection
const sqlInjection = await createCustomer({
  business_name: "'; DROP TABLE customers; --"
});
assert(sqlInjection.status === 400 || sqlInjection.status === 201);
// If 201, verify no SQL injection occurred (tables still exist)

// Test 2: XSS
const xssAttempt = await createCustomer({
  business_name: "<script>alert('XSS')</script>"
});
// Verify script tags escaped or rejected

// Test 3: Invalid Email
const invalidEmail = await createCustomer({
  emails: [{ email: "not-an-email", is_primary: true }]
});
assert(invalidEmail.status === 400, "Invalid email must be rejected");

// Test 4: Invalid Phone
const invalidPhone = await createCustomer({
  phones: [{ phone: "abc123", is_primary: true }]
});
assert(invalidPhone.status === 400, "Invalid phone must be rejected");

// Test 5: Excessively Long Input
const longInput = await createCustomer({
  business_name: "A".repeat(10000)
});
assert(longInput.status === 400, "Excessively long input must be rejected");
```

**Pass Criteria**:
- All SQL injection attempts blocked
- All XSS attempts sanitized or rejected
- Email validation enforces RFC 5322 format
- Phone validation enforces E.164 format
- Input length limits enforced (business_name < 255 chars)
- All validation errors return descriptive error messages

**Failure Actions**:
- Add input validation middleware
- Implement input sanitization
- Use parameterized queries (prevent SQL injection)
- Add field length limits

**Reference**: `.devflow/tasks/customers-migration-requirements/edge-cases.md:1260-1446`

---

## Edge Case Handling Acceptance Criteria

### EDGE-001: Concurrent Update Conflict Resolution

**Requirement**: Concurrent customer updates detected and resolved

**Validation Steps**:
1. [ ] Implement optimistic locking with `If-Unmodified-Since` header
2. [ ] Two users edit same customer simultaneously
3. [ ] Second save returns 412 Precondition Failed
4. [ ] Frontend displays merge dialog
5. [ ] User can resolve conflict by choosing changes to keep
6. [ ] Final merged update succeeds

**Test Procedure**:
```javascript
// Simulate concurrent updates
const customer = await fetchCustomerById('test-customer-uuid');

// User A starts edit
const userAEdit = { business_name: "Acme Corporation" };

// User B starts edit (same customer)
const userBEdit = { primary_contact_name: "Jane Doe" };

// User A saves first
await updateCustomer(customer.id, userAEdit, {
  ifUnmodifiedSince: customer.updated_at
}); // SUCCESS

// User B saves second
try {
  await updateCustomer(customer.id, userBEdit, {
    ifUnmodifiedSince: customer.updated_at // Old timestamp
  });
  assert(false, "Should have thrown conflict error");
} catch (error) {
  assert(error.status === 412, "Conflict detected");
  assert(error.code === 'PRECONDITION_FAILED');

  // Frontend shows merge dialog with both versions
  // User resolves by merging changes
  const merged = {
    business_name: "Acme Corporation", // From User A
    primary_contact_name: "Jane Doe"   // From User B
  };

  // Retry with merged data
  const result = await updateCustomer(customer.id, merged);
  assert(result.success === true, "Merged update succeeds");
}
```

**Pass Criteria**:
- Concurrent updates detected 100% of the time
- 412 Precondition Failed returned for conflicting updates
- Merge dialog displayed to user
- User can successfully resolve conflicts
- Final merged update succeeds

**Failure Actions**:
- Implement If-Unmodified-Since header support
- Add conflict resolution UI
- Test with additional concurrent scenarios

**Reference**: `.devflow/tasks/customers-migration-requirements/edge-cases.md:28-173`

---

### EDGE-002: Idempotent Create Operations

**Requirement**: Duplicate create requests return same customer (no duplicates created)

**Validation Steps**:
1. [ ] Generate unique idempotency key per create request
2. [ ] Send create request with idempotency key
3. [ ] Send same request again (simulate retry)
4. [ ] Verify second request returns cached response
5. [ ] Verify only one customer created (no duplicate)

**Test Procedure**:
```javascript
const idempotencyKey = `customer-create-${Date.now()}-${uuidv4()}`;
const customerData = {
  business_name: "Test Corp",
  emails: [{ email: "test@example.com", is_primary: true }]
};

// First request
const response1 = await createCustomer(customerData, { idempotencyKey });
assert(response1.status === 201);
const customerId = response1.data.id;

// Second request (simulate retry)
const response2 = await createCustomer(customerData, { idempotencyKey });
assert(response2.status === 201); // Same status
assert(response2.data.id === customerId); // Same customer ID

// Verify only one customer created
const customers = await fetchCustomers({ email: "test@example.com" });
assert(customers.length === 1, "Only one customer created");
```

**Pass Criteria**:
- Duplicate requests with same idempotency key return same response
- Only one customer created (no duplicates)
- Idempotency key cached for at least 24 hours
- Works for all mutation operations (create, update, delete)

**Failure Actions**:
- Implement idempotency key support
- Add response caching (Redis)
- Test with various retry scenarios

**Reference**: `.devflow/tasks/customers-migration-requirements/edge-cases.md:545-663`

---

### EDGE-003: Orphaned Record Prevention

**Requirement**: CASCADE constraints prevent orphaned related records

**Validation Steps**:
1. [ ] Verify CASCADE constraints exist on all related tables
2. [ ] Create customer with email, phone, address
3. [ ] Delete customer
4. [ ] Verify email, phone, address also deleted (CASCADE)
5. [ ] No orphaned records remain

**Test Procedure**:
```sql
-- Create test customer with related records
INSERT INTO customers (id, business_name, organization_id) VALUES ('test-uuid', 'Test Customer', 'org-uuid');
INSERT INTO customer_email (customer_id, email, is_primary) VALUES ('test-uuid', 'test@example.com', true);
INSERT INTO customer_phone (customer_id, phone, is_primary) VALUES ('test-uuid', '+14035551234', true);
INSERT INTO customer_address (customer_id, city, state) VALUES ('test-uuid', 'Calgary', 'AB');

-- Delete customer
DELETE FROM customers WHERE id = 'test-uuid';

-- Verify CASCADE deleted related records
SELECT COUNT(*) FROM customer_email WHERE customer_id = 'test-uuid';   -- Expected: 0
SELECT COUNT(*) FROM customer_phone WHERE customer_id = 'test-uuid';   -- Expected: 0
SELECT COUNT(*) FROM customer_address WHERE customer_id = 'test-uuid'; -- Expected: 0
```

**Pass Criteria**:
- CASCADE constraints exist on all related tables
- Deleting customer automatically deletes all related records
- 0 orphaned records detected after deletion
- No manual cleanup required

**Failure Actions**:
- Add missing CASCADE constraints
- Run orphan cleanup script
- Re-test cascade behavior

**Reference**: `.devflow/tasks/customers-migration-requirements/edge-cases.md:836-1055`

---

## Post-Migration Acceptance Criteria

### POST-001: 100% User Rollout Complete

**Requirement**: All users migrated to Supabase backend with no critical issues

**Validation Steps**:
1. [ ] Internal testing complete (5-10 users, 3-5 days)
2. [ ] 10% rollout complete (monitoring stable)
3. [ ] 50% rollout complete (performance targets met)
4. [ ] 100% rollout complete (all users on Supabase)
5. [ ] Monitor for 48 hours post-100% rollout
6. [ ] Error rate < 0.5%
7. [ ] No critical user-reported bugs

**Rollout Tracking**:
```javascript
// Track rollout percentage
const rolloutMetrics = {
  total_users: 50,
  supabase_users: 50,    // 100% rollout
  filemaker_users: 0,
  error_rate: 0.003,     // 0.3% (target: < 0.5%)
  p95_latency: 275,      // ms (target: < 300ms)
  user_satisfaction: 4.5 // out of 5 (target: > 4)
};
```

**Pass Criteria**:
- 100% of users on Supabase backend
- Error rate < 0.5% for 48 hours
- p95 latency < 300ms for 48 hours
- No critical bugs reported
- User satisfaction > 4/5

**Failure Actions**:
- Rollback to FileMaker mode
- Fix critical bugs
- Re-test and retry rollout

**Reference**: `.devflow/tasks/customers-migration-requirements/migration-plan.md:709-755`

---

### POST-002: FileMaker Code Removed

**Requirement**: FileMaker-specific code removed from codebase after successful migration

**Validation Steps**:
1. [ ] Feature flag removed from `.env`
2. [ ] FileMaker fallback code removed from `src/api/customers.js`
3. [ ] Dual-write logic removed from `src/hooks/useCustomer.js`
4. [ ] FileMaker transformations removed (`formatCustomerForFileMaker`)
5. [ ] All `recordId` references removed (search codebase)
6. [ ] FileMaker dependencies removed (if no other features use them)
7. [ ] Dead code cleanup complete

**Code Cleanup Verification**:
```bash
# Search for FileMaker references
grep -r "FileMaker" src/
grep -r "recordId" src/
grep -r "fm-gofer" src/
grep -r "VITE_USE_SUPABASE_CUSTOMERS" src/

# Expected: No results (all removed)
```

**Pass Criteria**:
- 0 FileMaker references in customer-related code
- 0 recordId references (replaced with id)
- Build succeeds with no errors
- All tests passing
- Code reduced by ~500-1000 lines (dual-write logic removed)

**Failure Actions**:
- Remove remaining FileMaker code
- Fix build errors
- Clean up unused imports

**Reference**: `.devflow/tasks/customers-migration-requirements/migration-plan.md:756-802`

---

### POST-003: Documentation Updated

**Requirement**: All project documentation reflects Supabase-only architecture

**Validation Steps**:
1. [ ] `README.md` updated (remove FileMaker customer references)
2. [ ] `CLAUDE.md` updated (mark customers as Supabase-only)
3. [ ] Architecture diagrams updated
4. [ ] API documentation updated
5. [ ] Migration plan archived
6. [ ] Post-migration report generated

**Documentation Checklist**:
- [ ] README.md: Remove "Customers sync to FileMaker and Supabase"
- [ ] README.md: Add "Customers managed via Supabase + Backend API"
- [ ] CLAUDE.md: Update architecture overview
- [ ] CLAUDE.md: Remove dual-write references
- [ ] Create `MIGRATION_ARCHIVE/customers/` folder
- [ ] Move all migration docs to archive
- [ ] Generate final migration report

**Pass Criteria**:
- All documentation accurate and up-to-date
- No references to FileMaker for customers
- Migration artifacts archived
- Post-migration report published

**Failure Actions**:
- Update missing documentation
- Archive migration artifacts
- Generate migration report

**Reference**: `.devflow/tasks/customers-migration-requirements/migration-plan.md:771-788`

---

## User Acceptance Testing (UAT) Criteria

### UAT-001: End-to-End Customer Workflow

**Requirement**: Users can complete all customer-related tasks without issues

**Test Scenarios**:

**Scenario 1: Create New Customer**
1. [ ] Navigate to Customers page
2. [ ] Click "Add Customer" button
3. [ ] Fill in customer form (business name, email, phone, address)
4. [ ] Click "Save"
5. [ ] Verify success message displays
6. [ ] Verify customer appears in list
7. [ ] Verify customer detail view shows all entered data

**Scenario 2: Search and View Customer**
1. [ ] Use search bar to search for customer by name
2. [ ] Verify search results display correctly
3. [ ] Click on customer from search results
4. [ ] Verify customer detail view loads
5. [ ] Verify all customer data displays correctly

**Scenario 3: Update Customer**
1. [ ] Open customer detail view
2. [ ] Click "Edit" button
3. [ ] Modify business name and primary contact
4. [ ] Click "Save"
5. [ ] Verify success message displays
6. [ ] Verify changes reflected in detail view

**Scenario 4: Toggle Customer Status**
1. [ ] Open customer detail view
2. [ ] Click "Toggle Status" button
3. [ ] Verify confirmation dialog appears
4. [ ] Confirm action
5. [ ] Verify status changed (active ↔ inactive)

**Scenario 5: Delete Customer**
1. [ ] Open customer detail view
2. [ ] Click "Delete" button
3. [ ] Verify confirmation dialog appears
4. [ ] Confirm deletion
5. [ ] Verify customer removed from list
6. [ ] Verify redirect to customers list page

**Pass Criteria** (per scenario):
- All steps complete without errors
- UI responsive and intuitive
- Success/error messages clear and helpful
- Data persists correctly
- No JavaScript console errors
- No broken UI elements

**Failure Actions**:
- Fix UI bugs
- Improve error messages
- Optimize performance
- Re-test scenario

---

### UAT-002: Performance and Responsiveness

**Requirement**: Application feels fast and responsive to users

**Test Scenarios**:
1. [ ] Load customers list (50 customers) in < 2 seconds
2. [ ] Search for customer returns results in < 1 second
3. [ ] Create customer completes in < 2 seconds
4. [ ] Update customer completes in < 2 seconds
5. [ ] Delete customer completes in < 2 seconds
6. [ ] UI remains responsive during operations (no freezing)

**User Experience Criteria**:
- [ ] No perceived lag or slowness
- [ ] Loading indicators display for long operations
- [ ] Optimistic UI updates (immediate feedback)
- [ ] Smooth animations and transitions
- [ ] No UI glitches or flashing content

**Pass Criteria**:
- ≥ 80% of users report application feels fast
- ≥ 90% of operations complete within target time
- No user complaints about slowness or freezing
- User satisfaction score ≥ 4/5

**Failure Actions**:
- Optimize slow operations
- Add loading indicators
- Implement optimistic updates
- Profile performance bottlenecks

---

## Success Metrics & KPIs

### Overall Migration Success

**Quantitative Metrics**:

| Metric | Target | Measurement Method | Status |
|--------|--------|-------------------|--------|
| Data Migration Completeness | 100% | Customer count match | ⏳ Pending |
| Data Accuracy | 100% | Spot-check validation | ⏳ Pending |
| API Endpoint Coverage | 100% | All endpoints implemented | ⏳ Pending |
| Test Coverage (Backend) | ≥ 80% | Code coverage report | ⏳ Pending |
| User Rollout Completion | 100% | Analytics tracking | ⏳ Pending |
| Error Rate | < 0.5% | Backend monitoring | ⏳ Pending |
| p95 Latency (List) | < 300ms | Load testing | ⏳ Pending |
| p95 Latency (Get) | < 200ms | Load testing | ⏳ Pending |
| User Satisfaction | ≥ 4/5 | User survey | ⏳ Pending |
| Critical Bugs | 0 | Issue tracker | ⏳ Pending |
| Rollback Time (if needed) | < 15 min | Timed test | ⏳ Pending |

**Qualitative Metrics**:
- [ ] Users report application feels faster
- [ ] No user-reported data loss or corruption
- [ ] Backend team satisfied with API design
- [ ] Frontend team satisfied with integration
- [ ] Product team satisfied with migration execution

---

### Post-Migration Review Checklist

**1 Week Post-Migration**:
- [ ] Review metrics (all targets met)
- [ ] Review data consistency (reconciliation report)
- [ ] Review user feedback (support tickets, surveys)
- [ ] Review error logs (no critical errors)
- [ ] Document lessons learned
- [ ] Plan cleanup phase (FileMaker code removal)

**1 Month Post-Migration**:
- [ ] Verify no data divergence between systems
- [ ] Confirm dual-write can be disabled
- [ ] Verify performance remains stable
- [ ] Conduct retrospective meeting
- [ ] Generate final migration report
- [ ] Archive migration artifacts

---

## Sign-Off Criteria

**Migration Complete When**:
- [ ] All pre-migration criteria met (100%)
- [ ] All backend implementation criteria met (100%)
- [ ] All frontend implementation criteria met (100%)
- [ ] All data migration criteria met (100%)
- [ ] All performance criteria met (100%)
- [ ] All security criteria met (100%)
- [ ] All edge case handling criteria met (100%)
- [ ] All post-migration criteria met (100%)
- [ ] All UAT criteria met (≥ 95%)
- [ ] All success metrics achieved

**Sign-Off Parties**:
- [ ] Backend Team Lead: _________________ Date: _______
- [ ] Frontend Team Lead: ________________ Date: _______
- [ ] Product Manager: ___________________ Date: _______
- [ ] QA Lead: ___________________________ Date: _______

---

## Document Status

**Status**: ✅ Complete - Ready for Implementation
**Next Steps**:
1. Review acceptance criteria with all stakeholders
2. Create test cases for each criterion
3. Set up monitoring dashboards for success metrics
4. Begin implementation (Phase 1: Backend Preparation)

**Related Documents**:
- [Migration Plan](./migration-plan.md) - Overall migration strategy
- [API Contracts](./api-contracts.md) - Backend API specifications
- [Edge Cases](./edge-cases.md) - Edge case handling requirements
- [Authorization Requirements](./authorization.md) - Security policies

---

**Document Version**: 1.0
**Last Updated**: 2026-01-10
**Author**: Claude Code (Autonomous Agent)
**Approved By**: Pending Review
