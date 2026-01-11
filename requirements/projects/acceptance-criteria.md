# Projects - Acceptance Criteria and Test Plan

## Overview

This document defines the acceptance criteria for the Projects migration from FileMaker to Supabase, including functional test cases for projects and all related entities (objectives, steps, images, links, notes), business logic validation, edge cases, performance requirements, and success metrics.

## Acceptance Criteria

### AC1: Schema Migration

**Criteria**: Supabase multi-table schema must support all FileMaker project data and nested relationships

**Verification**:
- ✅ `projects` table exists with all required columns
- ✅ `project_objectives` table exists with foreign key to `projects(id)`
- ✅ `project_objective_steps` table exists with foreign key to `project_objectives(id)`
- ✅ `project_images` table exists with foreign key to `projects(id)`
- ✅ `links` table has `project_id` column with foreign key to `projects(id)`
- ✅ `notes` table supports polymorphic association to projects
- ✅ All indexes created (`customer_id`, `team_id`, `organization_id`, `status`, date ranges)
- ✅ `updated_at` triggers auto-update on modifications for all tables
- ✅ Foreign keys have appropriate CASCADE/RESTRICT behaviors
- ✅ Check constraints enforce business rules (pricing, dates)

**Test Queries**:
```sql
-- Verify projects table structure
\d+ projects

-- Verify related tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'project%'
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
  AND tc.table_name LIKE 'project%';

-- Verify business logic constraints
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'projects'::regclass
  AND contype = 'c'; -- Check constraints

-- Verify triggers
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgrelid::regclass::text LIKE 'project%';
```

---

### AC2: Data Migration Completeness

**Criteria**: All FileMaker projects and related data must be migrated without data loss

**Verification**:
- ✅ Project count matches: FileMaker count = Supabase count
- ✅ All project names, descriptions, and fields migrated successfully
- ✅ All objectives migrated to `project_objectives` table
- ✅ All steps migrated to `project_objective_steps` table
- ✅ All images migrated to `project_images` table
- ✅ All project links migrated correctly
- ✅ All project notes migrated correctly
- ✅ All timestamps preserved (created_at, updated_at)
- ✅ Status values correctly migrated
- ✅ Pricing flags correctly converted (FM "1"/"0" → Supabase boolean)
- ✅ Date format correctly converted (MM/DD/YYYY → YYYY-MM-DD)
- ✅ No orphaned records (all objectives/steps/images have valid parent IDs)
- ✅ FileMaker `__ID` (UUID) preserved as Supabase `id`

**Test Queries**:
```sql
-- Count validation
SELECT
  (SELECT COUNT(*) FROM filemaker_projects_backup) AS filemaker_count,
  (SELECT COUNT(*) FROM projects) AS supabase_count;

-- Related entities count
SELECT
  (SELECT COUNT(*) FROM project_objectives) AS objectives_count,
  (SELECT COUNT(*) FROM project_objective_steps) AS steps_count,
  (SELECT COUNT(*) FROM project_images) AS images_count;

-- Status distribution
SELECT
  status,
  COUNT(*) AS count
FROM projects
GROUP BY status
ORDER BY count DESC;

-- Pricing model distribution
SELECT
  COUNT(*) FILTER (WHERE is_fixed_price = true) AS fixed_price_count,
  COUNT(*) FILTER (WHERE is_subscription = true) AS subscription_count,
  COUNT(*) FILTER (WHERE is_fixed_price = false AND is_subscription = false) AS other_count
FROM projects;

-- Verify no orphaned objectives
SELECT COUNT(*) FROM project_objectives o
LEFT JOIN projects p ON o.project_id = p.id
WHERE p.id IS NULL;
-- Should return 0

-- Verify no orphaned steps
SELECT COUNT(*) FROM project_objective_steps s
LEFT JOIN project_objectives o ON s.objective_id = o.id
WHERE o.id IS NULL;
-- Should return 0

-- Verify no orphaned images
SELECT COUNT(*) FROM project_images i
LEFT JOIN projects p ON i.project_id = p.id
WHERE p.id IS NULL;
-- Should return 0

-- Verify relationship integrity
SELECT
  p.id,
  p.name,
  COUNT(DISTINCT o.id) AS objective_count,
  COUNT(DISTINCT s.id) AS step_count,
  COUNT(DISTINCT i.id) AS image_count
FROM projects p
LEFT JOIN project_objectives o ON o.project_id = p.id
LEFT JOIN project_objective_steps s ON s.objective_id = o.id
LEFT JOIN project_images i ON i.project_id = p.id
GROUP BY p.id, p.name
LIMIT 10;
```

---

### AC3: Business Logic Validation

**Criteria**: Fixed-price and subscription business logic must execute correctly

**Verification**:

#### Fixed-Price Projects
- ✅ On project create with `is_fixed_price = true`: 2 sales entries generated
- ✅ First sales entry: 50% of value, date = start_date
- ✅ Second sales entry: 50% of value, date = end_date
- ✅ Sales entries linked to correct project_id
- ✅ Sales entries linked to correct customer_id
- ✅ Sales entries linked to correct organization_id
- ✅ Sales entries have correct description/metadata

#### Subscription Projects
- ✅ On project create with `is_subscription = true`: monthly sales entries generated
- ✅ Sales entries span from start_date to end_date
- ✅ Each entry has same monthly value
- ✅ Entries created on correct dates (monthly intervals)
- ✅ Sales entries linked to correct project_id
- ✅ Sales entries linked to correct customer_id

#### Constraint Validation
- ✅ Cannot create project with both `is_fixed_price = true` AND `is_subscription = true`
- ✅ Fixed-price projects require `value > 0`
- ✅ Subscription projects require `value > 0` and `start_date`
- ✅ Date validation: `end_date >= start_date`

**Test Cases**:

```sql
-- Test: Fixed-price project creates 2 sales entries
INSERT INTO projects (id, name, customer_id, organization_id, value, is_fixed_price, start_date, end_date)
VALUES (uuid_generate_v4(), 'Test Fixed Price', 'customer-uuid', 'org-uuid', 10000.00, true, '2024-01-01', '2024-06-30');

-- Verify 2 sales entries created
SELECT COUNT(*) FROM customer_sales
WHERE project_id = 'test-project-id';
-- Expected: 2

-- Verify amounts (should be 5000.00 each)
SELECT amount FROM customer_sales
WHERE project_id = 'test-project-id';
-- Expected: [5000.00, 5000.00]

-- Verify dates
SELECT date FROM customer_sales
WHERE project_id = 'test-project-id'
ORDER BY date;
-- Expected: ['2024-01-01', '2024-06-30']

-- Test: Subscription project creates monthly entries
INSERT INTO projects (id, name, customer_id, organization_id, value, is_subscription, start_date, end_date)
VALUES (uuid_generate_v4(), 'Test Subscription', 'customer-uuid', 'org-uuid', 1000.00, true, '2024-01-01', '2024-06-30');

-- Verify 6 sales entries created (Jan-Jun)
SELECT COUNT(*) FROM customer_sales
WHERE project_id = 'test-subscription-id';
-- Expected: 6

-- Verify monthly amounts
SELECT amount FROM customer_sales
WHERE project_id = 'test-subscription-id';
-- Expected: [1000.00, 1000.00, 1000.00, 1000.00, 1000.00, 1000.00]

-- Test: Cannot create project with both pricing models
INSERT INTO projects (id, name, customer_id, organization_id, value, is_fixed_price, is_subscription, start_date, end_date)
VALUES (uuid_generate_v4(), 'Test Invalid', 'customer-uuid', 'org-uuid', 5000.00, true, true, '2024-01-01', '2024-06-30');
-- Expected: ERROR - check constraint violation

-- Test: Fixed-price requires value > 0
INSERT INTO projects (id, name, customer_id, organization_id, is_fixed_price, start_date, end_date)
VALUES (uuid_generate_v4(), 'Test No Value', 'customer-uuid', 'org-uuid', true, '2024-01-01', '2024-06-30');
-- Expected: ERROR - check constraint violation

-- Test: Subscription requires start_date
INSERT INTO projects (id, name, customer_id, organization_id, value, is_subscription, end_date)
VALUES (uuid_generate_v4(), 'Test No Start', 'customer-uuid', 'org-uuid', 1000.00, true, '2024-06-30');
-- Expected: ERROR - check constraint violation or trigger failure
```

---

### AC4: Backend API Endpoints

**Criteria**: All CRUD operations functional via backend API

**Verification**:
- ✅ POST /rpc/get_projects_by_customer - Returns projects for customer
- ✅ POST /rpc/get_project_detail - Returns project with related data
- ✅ POST /rpc/create_project - Creates project with business logic
- ✅ POST /rpc/update_project - Updates project fields
- ✅ POST /rpc/update_project_status - Updates project status
- ✅ POST /rpc/delete_project - Deletes project and related data
- ✅ POST /rpc/create_objective - Creates objective for project
- ✅ POST /rpc/update_objective - Updates objective
- ✅ POST /rpc/delete_objective - Deletes objective and steps
- ✅ POST /rpc/create_step - Creates step for objective
- ✅ POST /rpc/update_step - Updates step
- ✅ POST /rpc/delete_step - Deletes step
- ✅ POST /rpc/create_project_image - Adds image to project
- ✅ POST /rpc/delete_project_image - Deletes image
- ✅ HMAC authentication required on all endpoints
- ✅ 400 errors for invalid input
- ✅ 404 errors for non-existent resources
- ✅ 403 errors for unauthorized access

**Test Cases**: See "Backend API Tests" section below

---

### AC5: Row-Level Security

**Criteria**: Users can only access projects for entities in their organization

**Verification**:
- ✅ Users in Org A cannot read projects from Org B
- ✅ Users in Org A cannot create projects for Org B entities
- ✅ Users in Org A cannot update/delete Org B projects
- ✅ Team members can edit projects assigned to their team
- ✅ Non-team members cannot edit projects (read-only)
- ✅ Anonymous users cannot access any projects
- ✅ Service role can access all projects

**Test Cases**: See "RLS Tests" section below

---

### AC6: Frontend Integration

**Criteria**: Existing UI workflows function identically with Supabase

**Verification**:
- ✅ `src/api/projects.js` uses backend API instead of FileMaker
- ✅ CustomerProjects list displays projects correctly
- ✅ ProjectDetails displays project with all tabs (Overview, Objectives, Time Records, Images, Links, Notes)
- ✅ Creating new project works in ProjectForm
- ✅ Updating project fields works
- ✅ Updating project status works
- ✅ Deleting project works (with confirmation)
- ✅ Managing objectives and steps works in ObjectivesTab
- ✅ Uploading images works in ImagesTab
- ✅ Adding links works in LinksTab
- ✅ Adding notes works in NotesTab
- ✅ Completion percentage calculated correctly
- ✅ Fixed-price projects generate sales entries
- ✅ Subscription projects generate monthly sales entries
- ✅ Optimistic UI updates work correctly
- ✅ Error handling displays user-friendly messages
- ✅ Loading states show during operations

**Test Cases**: See "Frontend UI Tests" section below

---

### AC7: Cascading Deletes

**Criteria**: Deleting a project deletes all related entities

**Verification**:
- ✅ Deleting project deletes all objectives
- ✅ Deleting project deletes all steps (via objective cascade)
- ✅ Deleting project deletes all images
- ✅ Deleting project deletes all links (if ON DELETE CASCADE)
- ✅ Deleting project deletes all notes (if ON DELETE CASCADE)
- ✅ Deleting objective deletes all steps
- ✅ No orphaned records after delete operations

**Test Queries**:
```sql
-- Create test project with related data
INSERT INTO projects (id, name, customer_id, organization_id)
VALUES ('test-cascade-id', 'Test Cascade', 'customer-uuid', 'org-uuid');

INSERT INTO project_objectives (id, project_id, objective)
VALUES ('test-obj-1', 'test-cascade-id', 'Objective 1');

INSERT INTO project_objective_steps (id, objective_id, step_text)
VALUES ('test-step-1', 'test-obj-1', 'Step 1');

INSERT INTO project_images (id, project_id, image_url)
VALUES ('test-img-1', 'test-cascade-id', 'https://example.com/image.jpg');

-- Delete project
DELETE FROM projects WHERE id = 'test-cascade-id';

-- Verify cascading deletes
SELECT COUNT(*) FROM project_objectives WHERE project_id = 'test-cascade-id';
-- Expected: 0

SELECT COUNT(*) FROM project_objective_steps WHERE objective_id = 'test-obj-1';
-- Expected: 0

SELECT COUNT(*) FROM project_images WHERE project_id = 'test-cascade-id';
-- Expected: 0
```

---

## Functional Test Cases

### Test Suite 1: Create Project Operations

#### Test 1.1: Create Basic Project
**Given**: Valid customer_id and organization_id
**When**: POST /rpc/create_project with name and customer_id
**Then**:
- Returns 201 Created
- Response includes project ID and all fields
- Project appears in GET /rpc/get_projects_by_customer

#### Test 1.2: Create Fixed-Price Project
**Given**: Valid customer_id, value = 10000, is_fixed_price = true, start_date, end_date
**When**: POST /rpc/create_project
**Then**:
- Returns 201 Created
- Project created with is_fixed_price = true
- 2 sales entries generated (5000 each)
- Sales entries have correct dates (start_date, end_date)

#### Test 1.3: Create Subscription Project
**Given**: Valid customer_id, value = 1000, is_subscription = true, start_date = '2024-01-01', end_date = '2024-06-30'
**When**: POST /rpc/create_project
**Then**:
- Returns 201 Created
- Project created with is_subscription = true
- 6 sales entries generated (1000 each, monthly from Jan-Jun)
- Sales entries have correct monthly dates

#### Test 1.4: Create Project with Missing Required Fields
**Given**: Missing name or customer_id
**When**: POST /rpc/create_project
**Then**:
- Returns 400 Bad Request
- Error message indicates missing required fields

#### Test 1.5: Create Project with Invalid Customer
**Given**: Non-existent customer_id
**When**: POST /rpc/create_project
**Then**:
- Returns 404 Not Found
- Error message: "Customer not found"

#### Test 1.6: Create Project with Both Pricing Models
**Given**: is_fixed_price = true AND is_subscription = true
**When**: POST /rpc/create_project
**Then**:
- Returns 400 Bad Request
- Error message: "Cannot be both fixed-price and subscription"

#### Test 1.7: Create Fixed-Price Project Without Value
**Given**: is_fixed_price = true, value = null
**When**: POST /rpc/create_project
**Then**:
- Returns 400 Bad Request
- Error message: "Fixed-price projects require value > 0"

#### Test 1.8: Create Subscription Project Without Start Date
**Given**: is_subscription = true, start_date = null
**When**: POST /rpc/create_project
**Then**:
- Returns 400 Bad Request
- Error message: "Subscription projects require start_date"

#### Test 1.9: Create Project with Invalid Date Range
**Given**: start_date = '2024-06-30', end_date = '2024-01-01' (end before start)
**When**: POST /rpc/create_project
**Then**:
- Returns 400 Bad Request
- Error message: "end_date must be >= start_date"

---

### Test Suite 2: Read Project Operations

#### Test 2.1: List Projects by Customer
**Given**: Customer with 3 projects
**When**: POST /rpc/get_projects_by_customer with customer_id
**Then**:
- Returns 200 OK
- Response contains 3 projects
- All projects have matching customer_id

#### Test 2.2: List Projects with Status Filter
**Given**: Customer with 5 projects (2 Active, 3 Completed)
**When**: POST /rpc/get_projects_by_customer with status_filter = 'Active'
**Then**:
- Returns 200 OK
- Response contains only 2 Active projects

#### Test 2.3: Get Project Detail (Basic)
**Given**: Valid project_id
**When**: POST /rpc/get_project_detail with project_id, include_related = false
**Then**:
- Returns 200 OK
- Response includes project data only (no related entities)

#### Test 2.4: Get Project Detail (With All Related Data)
**Given**: Project with 3 objectives, 5 steps, 2 images, 4 links
**When**: POST /rpc/get_project_detail with all include flags = true
**Then**:
- Returns 200 OK
- Response includes:
  - Project data
  - 3 objectives with nested steps
  - 2 images
  - 4 links
  - Notes (if any)

#### Test 2.5: Get Non-Existent Project
**Given**: Random UUID for project_id
**When**: POST /rpc/get_project_detail
**Then**:
- Returns 404 Not Found
- Error message: "Project not found"

#### Test 2.6: Get Project from Different Organization
**Given**: Project in Org A, user in Org B
**When**: POST /rpc/get_project_detail
**Then**:
- Returns 403 Forbidden
- Error message: "Unauthorized access"

---

### Test Suite 3: Update Project Operations

#### Test 3.1: Update Project Name
**Given**: Valid project_id
**When**: POST /rpc/update_project with name = "New Name"
**Then**:
- Returns 200 OK
- Project name updated
- updated_at timestamp updated

#### Test 3.2: Update Project Status
**Given**: Valid project_id, current status = "Active"
**When**: POST /rpc/update_project_status with status = "Completed"
**Then**:
- Returns 200 OK
- Project status updated to "Completed"

#### Test 3.3: Update Project with Invalid Status
**Given**: Valid project_id
**When**: POST /rpc/update_project with status = "InvalidStatus"
**Then**:
- Returns 400 Bad Request
- Error message: "Invalid status value"

#### Test 3.4: Update Project Dates
**Given**: Valid project_id
**When**: POST /rpc/update_project with start_date = "2024-02-01", end_date = "2024-08-31"
**Then**:
- Returns 200 OK
- Project dates updated

#### Test 3.5: Update Project with Invalid Date Range
**Given**: Valid project_id
**When**: POST /rpc/update_project with end_date before start_date
**Then**:
- Returns 400 Bad Request
- Error message: "end_date must be >= start_date"

#### Test 3.6: Update Project from Different Organization
**Given**: Project in Org A, user in Org B
**When**: POST /rpc/update_project
**Then**:
- Returns 403 Forbidden
- Error message: "Unauthorized access"

#### Test 3.7: Update Project by Non-Team Member
**Given**: Project assigned to Team A, user not in Team A
**When**: POST /rpc/update_project
**Then**:
- Returns 403 Forbidden (or read-only access)
- Error message: "Only team members can edit this project"

---

### Test Suite 4: Delete Project Operations

#### Test 4.1: Delete Project (Cascading)
**Given**: Project with 3 objectives, 5 steps, 2 images
**When**: POST /rpc/delete_project
**Then**:
- Returns 200 OK
- Project deleted
- All 3 objectives deleted
- All 5 steps deleted
- All 2 images deleted

#### Test 4.2: Delete Non-Existent Project
**Given**: Random UUID for project_id
**When**: POST /rpc/delete_project
**Then**:
- Returns 404 Not Found
- Error message: "Project not found"

#### Test 4.3: Delete Project from Different Organization
**Given**: Project in Org A, user in Org B
**When**: POST /rpc/delete_project
**Then**:
- Returns 403 Forbidden
- Error message: "Unauthorized access"

---

### Test Suite 5: Status Transitions

#### Test 5.1: Transition from Planning to Active
**Given**: Project with status = "Planning"
**When**: POST /rpc/update_project_status with status = "Active"
**Then**:
- Returns 200 OK
- Project status updated to "Active"
- updated_at timestamp updated
- No other fields modified

#### Test 5.2: Transition from Active to On Hold
**Given**: Project with status = "Active"
**When**: POST /rpc/update_project_status with status = "On Hold"
**Then**:
- Returns 200 OK
- Project status updated to "On Hold"
- Time tracking remains unchanged

#### Test 5.3: Transition from Active to Completed
**Given**: Fixed-price project with status = "Active", value = 10000, dateStart = "2024-01-01"
**When**: POST /rpc/update_project_status with status = "Completed"
**Then**:
- Returns 200 OK
- Project status updated to "Completed"
- If fixed-price: Second 50% sales entry created (if not already created)
- actual_end_date set to today (if not already set)

#### Test 5.4: Transition from On Hold to Active
**Given**: Project with status = "On Hold"
**When**: POST /rpc/update_project_status with status = "Active"
**Then**:
- Returns 200 OK
- Project status updated to "Active"
- Project resume operations normally

#### Test 5.5: Transition from Completed to Active (Reopen)
**Given**: Project with status = "Completed"
**When**: POST /rpc/update_project_status with status = "Active"
**Then**:
- Returns 200 OK
- Project status updated to "Active"
- actual_end_date cleared (set to null)
- Audit log captures reopen action

#### Test 5.6: Transition from Active to Cancelled
**Given**: Project with status = "Active"
**When**: POST /rpc/update_project_status with status = "Cancelled"
**Then**:
- Returns 200 OK
- Project status updated to "Cancelled"
- actual_end_date set to today
- Sales entries remain unchanged (no automatic reversals)

#### Test 5.7: Invalid Status Transition
**Given**: Project with any valid status
**When**: POST /rpc/update_project_status with status = "InvalidStatus"
**Then**:
- Returns 400 Bad Request
- Error message: "Invalid status value. Must be one of: Planning, Active, On Hold, Completed, Cancelled"
- Project status unchanged

#### Test 5.8: Status Transition Affects Subscription Sales Generation
**Given**: Subscription project with status = "Active", monthly value = 1000, dateStart = "2024-01-01", dateEnd = "2024-12-31"
**When**: POST /rpc/update_project_status with status = "Cancelled" on "2024-06-15"
**Then**:
- Returns 200 OK
- Project status updated to "Cancelled"
- Sales entries for Jan-Jun exist (6 months generated)
- No future sales entries generated (Jul-Dec should not be created)

---

### Test Suite 6: Team Assignment

#### Test 6.1: Assign Team to Project
**Given**: Project with team_id = null
**When**: POST /rpc/update_project_team with team_id = "team-uuid-123"
**Then**:
- Returns 200 OK
- Project team_id updated to "team-uuid-123"
- updated_at timestamp updated

#### Test 6.2: Reassign Team
**Given**: Project with team_id = "team-uuid-123"
**When**: POST /rpc/update_project_team with team_id = "team-uuid-456"
**Then**:
- Returns 200 OK
- Project team_id updated to "team-uuid-456"
- Previous team members lose edit access (RLS)
- New team members gain edit access

#### Test 6.3: Remove Team Assignment
**Given**: Project with team_id = "team-uuid-123"
**When**: POST /rpc/update_project_team with team_id = null
**Then**:
- Returns 200 OK
- Project team_id set to null
- All organization users can edit (no team restriction)

#### Test 6.4: Assign Non-Existent Team
**Given**: Project with team_id = null
**When**: POST /rpc/update_project_team with team_id = "non-existent-uuid"
**Then**:
- Returns 404 Not Found
- Error message: "Team not found"
- Project team_id unchanged

#### Test 6.5: Assign Team from Different Organization
**Given**: Project in Org A, Team in Org B
**When**: POST /rpc/update_project_team with team_id = "org-b-team-uuid"
**Then**:
- Returns 403 Forbidden
- Error message: "Team must belong to same organization as project"
- Project team_id unchanged

#### Test 6.6: Team Member Access Control
**Given**: Project with team_id = "team-uuid-123", User A in Team 123, User B in Team 456 (same org)
**When**:
  - User A attempts to update project
  - User B attempts to update project
**Then**:
- User A: Update succeeds (200 OK)
- User B: Update blocked (403 Forbidden) or read-only access

#### Test 6.7: Admin Override for Team Access
**Given**: Project with team_id = "team-uuid-123", Admin user not in Team 123
**When**: Admin attempts to update project
**Then**:
- Returns 200 OK
- Update succeeds (admin has override permissions)

---

### Test Suite 7: Customer Relationship Integrity

#### Test 7.1: Create Project with Valid Customer
**Given**: Valid customer_id exists in customers table
**When**: POST /rpc/create_project with customer_id
**Then**:
- Returns 201 Created
- Project created and linked to customer
- organization_id derived from customer's organization_id

#### Test 7.2: Create Project with Non-Existent Customer
**Given**: Random UUID for customer_id (does not exist)
**When**: POST /rpc/create_project with customer_id
**Then**:
- Returns 404 Not Found
- Error message: "Customer not found"
- No project created

#### Test 7.3: Update Project Customer (If Allowed)
**Given**: Project linked to Customer A
**When**: POST /rpc/update_project with customer_id = "customer-b-uuid"
**Then**:
- Either:
  - Returns 200 OK, customer_id updated, sales entries updated to new customer
  - OR Returns 400 Bad Request, "Cannot change customer after project creation" (business rule)

#### Test 7.4: Delete Customer with Active Projects
**Given**: Customer with 3 active projects
**When**: DELETE customer
**Then**:
- Either:
  - Deletion blocked (RESTRICT FK constraint): Returns 400 Bad Request, "Cannot delete customer with active projects"
  - OR Projects cascade deleted (CASCADE FK constraint): Customer and all 3 projects deleted
  - OR Projects orphaned with customer_id set to null (SET NULL FK constraint): Customer deleted, projects remain with customer_id = null

#### Test 7.5: List Projects by Customer (Scoped Correctly)
**Given**: Customer A with 5 projects, Customer B with 3 projects
**When**: POST /rpc/get_projects_by_customer with customer_id = "customer-a-uuid"
**Then**:
- Returns 200 OK
- Response contains exactly 5 projects
- All projects have customer_id = "customer-a-uuid"
- No projects from Customer B returned

#### Test 7.6: Organization Scoping via Customer
**Given**: Project for Customer in Org A, User in Org B
**When**: User attempts to access project
**Then**:
- Returns 403 Forbidden (or 0 results from RLS)
- Error message: "Unauthorized access - organization mismatch"

#### Test 7.7: Verify Sales Entries Linked to Customer
**Given**: Fixed-price project with value = 10000, customer_id = "customer-uuid-123"
**When**: Project created
**Then**:
- 2 sales entries created
- Both entries have customer_id = "customer-uuid-123"
- Both entries have organization_id matching customer's organization

---

### Test Suite 8: UUID Consistency and Identity Preservation

#### Test 8.1: Preserve FileMaker UUID on Migration
**Given**: FileMaker project with __ID = "a1b2c3d4-e5f6-7890-abcd-1234567890ab"
**When**: Project migrated to Supabase
**Then**:
- Supabase project.id = "a1b2c3d4-e5f6-7890-abcd-1234567890ab"
- UUID format preserved exactly (no case changes, no regeneration)

#### Test 8.2: UUID Consistency Across Related Entities
**Given**:
  - Project UUID = "proj-uuid-123"
  - Objective with project_id (FileMaker _projectID) = "proj-uuid-123"
**When**: Migration executed
**Then**:
- Supabase objective.project_id = "proj-uuid-123"
- Foreign key relationship valid
- No orphaned objectives

#### Test 8.3: UUID vs RecordId Distinction
**Given**: FileMaker project with:
  - __ID = "uuid-123" (UUID)
  - recordId = "42" (FileMaker internal ID)
**When**: Project migrated and accessed via API
**Then**:
- Supabase uses id = "uuid-123" for all operations
- recordId is NOT used in Supabase (FileMaker-specific)
- All API endpoints accept/return id (UUID), not recordId

#### Test 8.4: UUID Uniqueness Constraint
**Given**: Attempt to create project with existing UUID
**When**: POST /rpc/create_project with id = "existing-uuid-123"
**Then**:
- Returns 409 Conflict
- Error message: "Project with this ID already exists"
- No duplicate UUID created

#### Test 8.5: UUID Validation
**Given**: Attempt to create project with invalid UUID format
**When**: POST /rpc/create_project with id = "not-a-valid-uuid"
**Then**:
- Returns 400 Bad Request
- Error message: "Invalid UUID format"
- No project created

#### Test 8.6: UUID Consistency in Sales Entries
**Given**: Fixed-price project with id = "proj-uuid-123"
**When**: Project created, sales entries generated
**Then**:
- Both sales entries have project_id = "proj-uuid-123"
- Sales entries retrievable by project_id foreign key
- UUID linkage preserved

#### Test 8.7: UUID Preservation in Links and Notes
**Given**:
  - Project id = "proj-uuid-123"
  - Link with _fkID = "proj-uuid-123" (FileMaker)
  - Note with _fkID = "proj-uuid-123" (FileMaker)
**When**: Migration executed
**Then**:
- Supabase link.project_id = "proj-uuid-123"
- Supabase note.entity_id = "proj-uuid-123" AND note.entity_type = "project"
- Polymorphic associations resolved correctly

#### Test 8.8: UUID Case Sensitivity
**Given**: UUID = "A1B2C3D4-E5F6-7890-ABCD-1234567890AB" (uppercase)
**When**: Stored in PostgreSQL/Supabase
**Then**:
- UUID stored in lowercase: "a1b2c3d4-e5f6-7890-abcd-1234567890ab"
- Queries are case-insensitive (PostgreSQL UUID type behavior)
- Lookups by uppercase or lowercase UUID both work

---

### Test Suite 9: Objectives Operations

#### Test 9.1: Create Objective
**Given**: Valid project_id
**When**: POST /rpc/create_objective with project_id, objective = "Complete design"
**Then**:
- Returns 201 Created
- Objective created and linked to project

#### Test 9.2: Update Objective
**Given**: Valid objective_id
**When**: POST /rpc/update_objective with objective = "Complete redesign"
**Then**:
- Returns 200 OK
- Objective text updated

#### Test 9.3: Mark Objective as Completed
**Given**: Valid objective_id, completed = false
**When**: POST /rpc/update_objective with completed = true
**Then**:
- Returns 200 OK
- Objective marked as completed
- Project completion percentage recalculated

#### Test 9.4: Delete Objective (Cascade to Steps)
**Given**: Objective with 3 steps
**When**: POST /rpc/delete_objective
**Then**:
- Returns 200 OK
- Objective deleted
- All 3 steps deleted

#### Test 9.5: Create Objective for Non-Existent Project
**Given**: Random UUID for project_id
**When**: POST /rpc/create_objective
**Then**:
- Returns 404 Not Found
- Error message: "Project not found"

---

### Test Suite 10: Steps Operations

#### Test 10.1: Create Step
**Given**: Valid objective_id
**When**: POST /rpc/create_step with objective_id, step_text = "Research competitors"
**Then**:
- Returns 201 Created
- Step created and linked to objective

#### Test 10.2: Update Step
**Given**: Valid step_id
**When**: POST /rpc/update_step with step_text = "Research top 5 competitors"
**Then**:
- Returns 200 OK
- Step text updated

#### Test 10.3: Mark Step as Completed
**Given**: Valid step_id, completed = false
**When**: POST /rpc/update_step with completed = true
**Then**:
- Returns 200 OK
- Step marked as completed
- Objective completion percentage recalculated
- Project completion percentage recalculated

#### Test 10.4: Delete Step
**Given**: Valid step_id
**When**: POST /rpc/delete_step
**Then**:
- Returns 200 OK
- Step deleted

#### Test 10.5: Create Step for Non-Existent Objective
**Given**: Random UUID for objective_id
**When**: POST /rpc/create_step
**Then**:
- Returns 404 Not Found
- Error message: "Objective not found"

---

### Test Suite 11: Images Operations

#### Test 11.1: Add Image to Project
**Given**: Valid project_id, image_url
**When**: POST /rpc/create_project_image with project_id, image_url
**Then**:
- Returns 201 Created
- Image added to project

#### Test 11.2: Add Image with Caption
**Given**: Valid project_id, image_url, caption
**When**: POST /rpc/create_project_image
**Then**:
- Returns 201 Created
- Image added with caption

#### Test 11.3: Delete Image
**Given**: Valid image_id
**When**: POST /rpc/delete_project_image
**Then**:
- Returns 200 OK
- Image deleted

#### Test 11.4: Add Image to Non-Existent Project
**Given**: Random UUID for project_id
**When**: POST /rpc/create_project_image
**Then**:
- Returns 404 Not Found
- Error message: "Project not found"

---

### Test Suite 12: Completion Percentage Calculation

#### Test 12.1: Calculate Completion with No Objectives
**Given**: Project with 0 objectives
**When**: Calculate completion percentage
**Then**:
- Completion percentage = 0%

#### Test 12.2: Calculate Completion with All Completed
**Given**: Project with 3 objectives, all completed = true
**When**: Calculate completion percentage
**Then**:
- Completion percentage = 100%

#### Test 12.3: Calculate Completion with Partial
**Given**: Project with 4 objectives, 2 completed = true, 2 completed = false
**When**: Calculate completion percentage
**Then**:
- Completion percentage = 50%

#### Test 12.4: Calculate Completion with Nested Steps
**Given**: Project with 2 objectives:
  - Objective 1: 4 steps, 2 completed
  - Objective 2: 2 steps, 2 completed
**When**: Calculate completion percentage
**Then**:
- Objective 1: 50% complete
- Objective 2: 100% complete
- Overall project: 75% complete

---

## Edge Cases and Error Scenarios

### Edge Case 1: Project with Very Long Subscription Period
**Scenario**: Subscription project with start_date = '2024-01-01', end_date = '2030-12-31' (7 years)
**Expected**: Generate 84 monthly sales entries (7 years × 12 months)
**Test**: Verify all 84 entries created with correct monthly intervals

### Edge Case 2: Project with Same Start and End Date
**Scenario**: Fixed-price project with start_date = end_date = '2024-01-01'
**Expected**: Generate 2 sales entries both dated '2024-01-01'
**Test**: Verify 2 entries created on same date

### Edge Case 3: Subscription Project with 1-Day Duration
**Scenario**: Subscription project with start_date = '2024-01-01', end_date = '2024-01-02'
**Expected**: Generate 1 sales entry (less than 1 month duration)
**Test**: Verify 1 entry created

### Edge Case 4: Project with No Team Assignment
**Scenario**: Create project with team_id = null
**Expected**: Project created successfully, accessible by all users in organization
**Test**: Verify project accessible by multiple users

### Edge Case 5: Project with Objectives but No Steps
**Scenario**: Project with 3 objectives, 0 steps
**Expected**: Completion percentage based on objectives only
**Test**: Verify calculation works correctly

### Edge Case 6: Project with Steps but Objective Not Completed
**Scenario**: Objective with all steps completed = true, but objective.completed = false
**Expected**: Objective completion based on steps, not objective.completed flag
**Test**: Verify objective shows as complete when all steps done

### Edge Case 7: Delete Project with Time Records
**Scenario**: Project with linked time records in customer_sales table
**Expected**: Project delete should handle time records (SET NULL or CASCADE based on FK config)
**Test**: Verify time records not orphaned

### Edge Case 8: Update Project Customer
**Scenario**: Change project.customer_id to different customer
**Expected**: All sales entries updated to new customer_id (or prevented by constraint)
**Test**: Verify business logic consistency

### Edge Case 9: Concurrent Updates to Project
**Scenario**: User A and User B update same project simultaneously
**Expected**: Last write wins, updated_at timestamp reflects final update
**Test**: Verify no data corruption

### Edge Case 10: Project with 100+ Objectives
**Scenario**: Project with 150 objectives, 500 steps
**Expected**: All data loads within performance SLA (<1s for detail view)
**Test**: Load test with realistic large project

---

## Performance Requirements

### Requirement 1: List Projects by Customer
- **Metric**: Response time
- **Target**: <500ms for list of 100 projects
- **Test**: Load customer with 100 projects, measure API response time

### Requirement 2: Get Project Detail (Full)
- **Metric**: Response time
- **Target**: <1s for project with 50 objectives, 100 steps, 20 images, 30 links
- **Test**: Load complex project with all related data, measure API response time

### Requirement 3: Create Project with Business Logic
- **Metric**: Processing time
- **Target**: <2s for fixed-price project (includes sales entry generation)
- **Test**: Create fixed-price project, measure total time from request to completion

### Requirement 4: Create Subscription Project
- **Metric**: Processing time
- **Target**: <5s for 12-month subscription (generates 12 sales entries)
- **Test**: Create 1-year subscription project, measure total time

### Requirement 5: Delete Project (Cascading)
- **Metric**: Processing time
- **Target**: <3s for project with 50 objectives, 100 steps, 20 images
- **Test**: Delete complex project, measure cascade delete time

### Requirement 6: Database Query Performance
- **Metric**: Query execution time
- **Target**: All queries execute in <100ms
- **Test**: Use PostgreSQL EXPLAIN ANALYZE on all endpoint queries

### Requirement 7: Concurrent User Load
- **Metric**: API response time under load
- **Target**: <1s response time with 50 concurrent users
- **Test**: Load test with 50 users simultaneously accessing projects

---

## RLS Tests

### Test RLS-1: Organization Scoping (Projects)
**Given**: Project in Org A, user in Org B
**When**: User attempts to read project
**Then**: Query returns 0 rows (RLS blocks access)

### Test RLS-2: Organization Scoping (Objectives)
**Given**: Objective in project in Org A, user in Org B
**When**: User attempts to read objective
**Then**: Query returns 0 rows

### Test RLS-3: Team-Based Access Control
**Given**: Project assigned to Team A, user in Team B (same org)
**When**: User attempts to update project
**Then**: Update blocked (or read-only access)

### Test RLS-4: Admin Override
**Given**: User with admin role
**When**: User attempts to access any project in their org
**Then**: Access granted (even if not on team)

### Test RLS-5: Anonymous User Access
**Given**: Anonymous user (not logged in)
**When**: User attempts to access any project
**Then**: All queries return 0 rows

### Test RLS-6: Service Role Access
**Given**: Request with service role key
**When**: Query any project
**Then**: Access granted to all projects (no RLS filtering)

---

## Backend API Tests

### Test API-1: HMAC Authentication Required
**Given**: Request without HMAC signature
**When**: POST to any /rpc/project endpoint
**Then**: Returns 401 Unauthorized

### Test API-2: Invalid HMAC Signature
**Given**: Request with incorrect HMAC signature
**When**: POST to any /rpc/project endpoint
**Then**: Returns 401 Unauthorized

### Test API-3: Expired HMAC Timestamp
**Given**: Request with timestamp >5 minutes old
**When**: POST to any /rpc/project endpoint
**Then**: Returns 401 Unauthorized (replay attack prevention)

### Test API-4: Malformed Request Body
**Given**: Request with invalid JSON
**When**: POST to any endpoint
**Then**: Returns 400 Bad Request

### Test API-5: Missing Required Parameters
**Given**: Request missing required parameters
**When**: POST to any endpoint
**Then**: Returns 400 Bad Request with clear error message

### Test API-6: SQL Injection Attempt
**Given**: Request with SQL injection payload (e.g., `' OR '1'='1`)
**When**: POST to any endpoint
**Then**: Query parameterized, injection prevented, no SQL error

### Test API-7: XSS Attempt
**Given**: Request with XSS payload (e.g., `<script>alert('XSS')</script>`)
**When**: Create project with malicious name
**Then**: Payload escaped/sanitized, no script execution

---

## Frontend UI Tests

### Test UI-1: Project List Loads
**Given**: Customer with 5 projects
**When**: Navigate to Customer Details → Projects tab
**Then**: 5 projects displayed with name, status, dates, completion percentage

### Test UI-2: Project Detail Loads
**Given**: Valid project_id
**When**: Click project from list
**Then**: ProjectDetails component displays with all tabs loaded

### Test UI-3: Create Project Form
**Given**: User clicks "Add Project" button
**When**: Fill out form (name, customer, dates, value, pricing type) and submit
**Then**:
- Project created
- Success notification displayed
- Project list refreshed
- New project appears in list

### Test UI-4: Create Fixed-Price Project
**Given**: User fills form with is_fixed_price = true, value = 10000
**When**: Submit form
**Then**:
- Project created
- 2 sales entries generated (visible in financial records)
- Success notification mentions sales entries

### Test UI-5: Create Subscription Project
**Given**: User fills form with is_subscription = true, value = 1000, dates = 6 months
**When**: Submit form
**Then**:
- Project created
- 6 monthly sales entries generated
- Success notification mentions subscription

### Test UI-6: Update Project
**Given**: User opens ProjectDetails
**When**: Edit name, description, or dates and save
**Then**:
- Project updated
- Success notification displayed
- Changes reflected in UI

### Test UI-7: Update Project Status
**Given**: User opens ProjectDetails, status = "Active"
**When**: Change status to "Completed"
**Then**:
- Status updated
- UI reflects new status
- Success notification displayed

### Test UI-8: Delete Project
**Given**: User opens ProjectDetails
**When**: Click delete button, confirm deletion
**Then**:
- Confirmation modal appears
- After confirm: project deleted, all related data deleted
- User redirected to customer view
- Project no longer in list

### Test UI-9: Manage Objectives
**Given**: User opens ProjectDetails → Objectives tab
**When**: Add new objective, edit existing objective, delete objective
**Then**:
- All CRUD operations work correctly
- Completion percentage updates
- UI updates optimistically

### Test UI-10: Manage Steps
**Given**: User opens ProjectDetails → Objectives tab → Objective item
**When**: Add step, edit step, mark step as complete, delete step
**Then**:
- All CRUD operations work correctly
- Completion percentage updates
- UI updates optimistically

### Test UI-11: Upload Image
**Given**: User opens ProjectDetails → Images tab
**When**: Upload new image with caption
**Then**:
- Image uploaded to storage
- Image record created in project_images table
- Image displayed in gallery

### Test UI-12: Add Link
**Given**: User opens ProjectDetails → Links tab
**When**: Add new link (URL)
**Then**:
- Link created and associated with project
- Link displayed in list

### Test UI-13: Add Note
**Given**: User opens ProjectDetails → Notes tab
**When**: Add new note (text)
**Then**:
- Note created and associated with project
- Note displayed in list

### Test UI-14: View Time Records
**Given**: Project with 10 time records
**When**: User opens ProjectDetails → Time Records tab
**Then**:
- 10 time records displayed
- Shows billable hours, unbilled hours, total value

### Test UI-15: Error Handling
**Given**: Backend API returns 500 error
**When**: User attempts to create/update project
**Then**:
- Error notification displayed
- User-friendly error message (not technical stack trace)
- UI remains stable

### Test UI-16: Loading States
**Given**: API call in progress
**When**: User waits for response
**Then**:
- Loading spinner or skeleton displayed
- UI prevents duplicate submissions
- Loading message indicates what's happening

---

## Success Metrics

- ✅ 100% of FileMaker projects migrated to Supabase without data loss
- ✅ 100% of objectives, steps, and images migrated
- ✅ All relationships preserved (customer, team, time records, links, notes)
- ✅ Business logic functions correctly:
  - Fixed-price projects generate exactly 2 sales entries
  - Subscription projects generate correct number of monthly entries
  - Completion percentage calculated accurately
- ✅ All API endpoints functional and performant:
  - <500ms for project list
  - <1s for project detail with all related data
  - <2s for create with business logic
- ✅ RLS policies enforce organization scoping correctly
- ✅ All user workflows function identically to FileMaker version
- ✅ No critical bugs or data integrity issues
- ✅ User satisfaction: no complaints about missing data or functionality
- ✅ FileMaker integration removed from codebase
- ✅ Error rate <1% for all endpoints
- ✅ Test coverage >80% for all backend functions
- ✅ Zero orphaned records in production

---

## Rollback Plan

### Trigger Conditions
- Data loss or corruption detected
- Critical bugs in business logic
- Performance degradation >50%
- Error rate >5%
- User-reported data integrity issues

### Rollback Steps
1. Set `VITE_USE_SUPABASE_PROJECTS=false` immediately (5 minutes)
2. All users revert to FileMaker
3. Investigate and fix issues
4. Re-test thoroughly
5. Resume rollout when fixed

### Recovery Time Objective (RTO)
- Feature flag rollback: <5 minutes
- Full system rollback: <30 minutes
- Data restoration from backup: <2 hours

---

## Test Execution Checklist

### Pre-Migration Tests
- [ ] Schema validation (all tables, columns, constraints, indexes)
- [ ] RLS policies tested with multiple organizations
- [ ] Backend API endpoints tested with all CRUD operations
- [ ] Business logic tested (fixed-price, subscription)
- [ ] Cascading deletes tested
- [ ] Performance baseline established

### Migration Tests
- [ ] Data export validated (all 7 layouts)
- [ ] Data transformation validated (no data loss)
- [ ] Data import validated (counts match)
- [ ] Relationship integrity validated (no orphans)
- [ ] Business logic entries generated correctly

### Post-Migration Tests
- [ ] All acceptance criteria met
- [ ] All functional test suites passed
- [ ] All edge cases tested
- [ ] Performance requirements met
- [ ] RLS tests passed
- [ ] Backend API tests passed
- [ ] Frontend UI tests passed
- [ ] User acceptance testing completed

### Production Monitoring
- [ ] Error rate <1%
- [ ] API response times within SLA
- [ ] No user-reported data issues
- [ ] No orphaned records
- [ ] Business logic executing correctly

---

## Code References

- `src/api/projects.js` (213 lines) - FileMaker API calls to be replaced
- `src/services/projectService.js` - Business logic and data processing
- `src/hooks/useProject.js` - Main project hook (300+ lines estimated)
- `src/components/projects/ProjectDetails.jsx` - Project detail view
- `src/components/projects/ProjectForm.jsx` - Create/edit form
- `src/components/projects/ObjectivesTab.jsx` - Objectives management
- `src/components/projects/ImagesTab.jsx` - Images gallery
- `src/components/projects/LinksTab.jsx` - Links list
- `src/components/projects/NotesTab.jsx` - Notes list
- `src/components/financial/ProjectRecordsTable.jsx` - Time records view

---

## Migration Complete Criteria

Migration is considered complete when:
1. All acceptance criteria verified ✅
2. All test suites pass ✅
3. All performance requirements met ✅
4. Feature flag enabled for 100% of users ✅
5. No critical bugs in production (1 week monitoring) ✅
6. User satisfaction confirmed (no complaints) ✅
7. FileMaker integration removed ✅
8. Documentation updated ✅
