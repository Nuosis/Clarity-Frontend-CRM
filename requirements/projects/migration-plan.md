# Migration Plan

This document outlines the strategy for migrating the Projects feature from FileMaker to Supabase, including data backfill for projects and all related entities (objectives, steps, images, links, notes), ID reconciliation, cutover approach, validation, and rollback procedures.

## Migration Overview

**Scope**: Migrate all projects from FileMaker `devProjects` layout to Supabase `projects` and 6 related tables

**Estimated Record Counts**:
- Projects: Unknown (needs audit)
- Project Objectives: Unknown (needs audit)
- Project Objective Steps: Unknown (needs audit)
- Project Images: Unknown (needs audit)
- Project Links: Unknown (needs audit)
- Project Notes: Unknown (needs audit)

**Duration Estimate**: 4-6 weeks (includes backend implementation, data migration, frontend refactor, testing)

**Risk Level**: High
- Projects are core workflow entity with complex relationships
- NO current Supabase integration or dual-write (100% rewrite)
- Complex business logic (fixed-price and subscription sales generation)
- Multiple nested relationships (objectives → steps hierarchy)
- Dependencies on customers, teams, time records
- Large scope: 7 FileMaker layouts to migrate

## Migration Prerequisites

### Dependent Migrations (MUST COMPLETE FIRST)

1. **Customers Migration** (INS0001)
   - Required: customer_id foreign key relationship
   - Projects cannot be migrated without customer UUID mapping
   - Status: In Progress

2. **Teams Migration** (INS0004)
   - Required: team_id foreign key relationship
   - Projects reference teams for assignment
   - Status: In Progress

3. **Backend API Requirements**
   - All backend endpoints/RPCs implemented (see api-contracts.md)
   - RLS policies configured for all 7 project tables
   - Business logic triggers for fixed-price/subscription sales
   - Cascading delete logic for related entities

## Migration Phases

### Phase 1: Backend Preparation (Week 1-2)

1. **Schema Implementation**
   - Create/verify `projects` table with all columns
   - Create `project_objectives` table with foreign keys
   - Create `project_objective_steps` table with foreign keys
   - Create `project_images` table with foreign keys
   - Verify `links` table has `project_id` column (from Links migration)
   - Verify `notes` table has polymorphic association support
   - Add all indexes for performance
   - Add all constraints and check rules

2. **RLS Policies Implementation**
   - Implement organization scoping for all 7 tables
   - Implement team-based access control (only team members can edit)
   - Implement user role permissions (admin, team member, read-only)
   - Test RLS policies with multiple organizations

3. **Backend API Endpoints**
   - Implement all CRUD endpoints for projects (see api-contracts.md)
   - Implement endpoints for objectives and steps
   - Implement endpoints for images management
   - Implement business logic endpoints:
     - Fixed-price sales generation (50/50 split)
     - Subscription sales generation (monthly entries)
   - Implement time records querying by project
   - Add HMAC authentication to all endpoints

4. **Triggers and Business Logic**
   - Create `updated_at` triggers for all tables
   - Create business logic triggers:
     - On project create with `is_fixed_price = true`: generate 2 sales entries
     - On project create with `is_subscription = true`: generate monthly sales entries
     - On project delete: cascade to objectives, steps, images
   - Create completion percentage calculation logic

5. **Testing Environment Setup**
   - Set up staging Supabase instance
   - Deploy all schema changes to staging
   - Deploy all RPC functions to staging
   - Test all endpoints with sample data

### Phase 2: Data Audit and Export (Week 2)

1. **FileMaker Data Audit**
   - Count total projects in `devProjects` layout
   - Count objectives per project
   - Count steps per objective
   - Count images per project
   - Count links per project (via `_fkID`)
   - Count notes per project (via `_fkID`)
   - Identify orphaned records
   - Identify data quality issues:
     - Projects without customer_id
     - Projects without organization_id
     - Invalid status values
     - Invalid date ranges (end_date < start_date)
     - Fixed-price projects without value
     - Subscription projects without dates

2. **Export FileMaker Data**

**Export Script for Projects**:
```bash
# Export all projects from FileMaker
curl -X POST "https://server.claritybusinesssolutions.ca/fmi/data/v1/databases/clarityCRM/layouts/devProjects/_find" \
  -H "Authorization: Bearer {fm_token}" \
  -H "Content-Type: application/json" \
  -d '{"query": [{"__ID": "*"}]}' \
  > filemaker_projects_export.json
```

**Export Script for Objectives**:
```bash
curl -X POST "https://server.claritybusinesssolutions.ca/fmi/data/v1/databases/clarityCRM/layouts/devProjectObjectives/_find" \
  -H "Authorization: Bearer {fm_token}" \
  -H "Content-Type: application/json" \
  -d '{"query": [{"_projectID": "*"}]}' \
  > filemaker_objectives_export.json
```

**Export Script for Steps**:
```bash
curl -X POST "https://server.claritybusinesssolutions.ca/fmi/data/v1/databases/clarityCRM/layouts/devProjectObjSteps/_find" \
  -H "Authorization: Bearer {fm_token}" \
  -H "Content-Type: application/json" \
  -d '{"query": [{"_objectiveID": "*"}]}' \
  > filemaker_steps_export.json
```

**Export Script for Images**:
```bash
curl -X POST "https://server.claritybusinesssolutions.ca/fmi/data/v1/databases/clarityCRM/layouts/devProjectImages/_find" \
  -H "Authorization: Bearer {fm_token}" \
  -H "Content-Type: application/json" \
  -d '{"query": [{"_fkID": "*"}]}' \
  > filemaker_images_export.json
```

**Export Script for Links** (if not already migrated):
```bash
# Links for projects: filter by _fkID matching project IDs
# This may be handled by Links migration (INS0006)
```

**Export Script for Notes** (if not already migrated):
```bash
# Notes for projects: filter by _fkID matching project IDs
# This may be handled by Notes migration (INS0005)
```

### Phase 3: Data Transformation (Week 2-3)

1. **Transform Projects Data**

**Transformation Script**: `scripts/migrate-projects.js`

```javascript
const fs = require('fs');

// Read FileMaker exports
const fmProjects = JSON.parse(fs.readFileSync('filemaker_projects_export.json', 'utf8'));
const fmObjectives = JSON.parse(fs.readFileSync('filemaker_objectives_export.json', 'utf8'));
const fmSteps = JSON.parse(fs.readFileSync('filemaker_steps_export.json', 'utf8'));
const fmImages = JSON.parse(fs.readFileSync('filemaker_images_export.json', 'utf8'));

// Transform projects to Supabase format
const projects = fmProjects.response.data.map(record => {
  const { fieldData } = record;

  return {
    // Use FileMaker UUID as Supabase ID (for relationship preservation)
    id: fieldData.__ID,
    name: fieldData.projectName,
    customer_id: fieldData._custID,
    team_id: fieldData._teamID || null,
    organization_id: 'YOUR_ORG_ID', // Set from customer's organization
    status: fieldData.status || 'Open',
    description: fieldData.description || null,
    time_estimate: fieldData.estOfTime || null,
    value: fieldData.value ? parseFloat(fieldData.value) : null,
    is_fixed_price: fieldData.f_fixedPrice === "1",
    is_subscription: fieldData.f_subscription === "1",
    start_date: convertDate(fieldData.dateStart), // MM/DD/YYYY -> YYYY-MM-DD
    end_date: convertDate(fieldData.dateEnd),     // MM/DD/YYYY -> YYYY-MM-DD
    created_at: fieldData['~creationTimestamp'],
    updated_at: fieldData['~modificationTimestamp']
  };
});

// Transform objectives
const objectives = fmObjectives.response.data.map(record => {
  const { fieldData } = record;

  return {
    id: fieldData.__ID,
    project_id: fieldData._projectID,
    objective: fieldData.projectObjective,
    status: fieldData.status || 'Open',
    order_num: fieldData.order || 0,
    completed: fieldData.f_completed === "1",
    created_at: fieldData['~creationTimestamp'],
    updated_at: fieldData['~modificationTimestamp']
  };
});

// Transform steps
const steps = fmSteps.response.data.map(record => {
  const { fieldData } = record;

  return {
    id: fieldData.__ID,
    objective_id: fieldData._objectiveID,
    step_text: fieldData.stepText,
    order_num: fieldData.order || 0,
    completed: fieldData.f_completed === "1",
    created_at: fieldData['~creationTimestamp'],
    updated_at: fieldData['~modificationTimestamp']
  };
});

// Transform images
const images = fmImages.response.data.map(record => {
  const { fieldData } = record;

  return {
    id: fieldData.__ID,
    project_id: fieldData._fkID, // Assuming _fkID is project ID
    image_url: fieldData.imageURL,
    caption: fieldData.caption || null,
    created_at: fieldData['~creationTimestamp'],
    updated_at: fieldData['~modificationTimestamp']
  };
});

// Helper function to convert dates
function convertDate(fmDate) {
  if (!fmDate) return null;
  // Convert MM/DD/YYYY to YYYY-MM-DD
  const parts = fmDate.split('/');
  return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
}

// Write transformed data
fs.writeFileSync('supabase_projects_import.json', JSON.stringify(projects, null, 2));
fs.writeFileSync('supabase_objectives_import.json', JSON.stringify(objectives, null, 2));
fs.writeFileSync('supabase_steps_import.json', JSON.stringify(steps, null, 2));
fs.writeFileSync('supabase_images_import.json', JSON.stringify(images, null, 2));

console.log(`Transformed ${projects.length} projects`);
console.log(`Transformed ${objectives.length} objectives`);
console.log(`Transformed ${steps.length} steps`);
console.log(`Transformed ${images.length} images`);
```

2. **Validate Transformed Data**

**Validation Script**: `scripts/validate-projects.js`

```javascript
function validateProjects(projects, objectives, steps, images) {
  const errors = [];
  const seenProjectIds = new Set();
  const seenObjectiveIds = new Set();

  // Validate projects
  projects.forEach((p, idx) => {
    // Check UUID
    if (!p.id || !isValidUUID(p.id)) {
      errors.push(`Project ${idx}: Invalid or missing ID`);
    }

    // Check for duplicates
    if (seenProjectIds.has(p.id)) {
      errors.push(`Project ${idx}: Duplicate ID ${p.id}`);
    }
    seenProjectIds.add(p.id);

    // Check required fields
    if (!p.name || p.name.trim() === '') {
      errors.push(`Project ${idx}: Missing name`);
    }

    if (!p.customer_id || !isValidUUID(p.customer_id)) {
      errors.push(`Project ${idx}: Invalid customer_id`);
    }

    // Check business logic constraints
    if (p.is_fixed_price && p.is_subscription) {
      errors.push(`Project ${idx}: Cannot be both fixed-price AND subscription`);
    }

    if ((p.is_fixed_price || p.is_subscription) && (!p.value || p.value <= 0)) {
      errors.push(`Project ${idx}: Fixed-price/subscription requires value > 0`);
    }

    if (p.is_subscription && !p.start_date) {
      errors.push(`Project ${idx}: Subscription requires start_date`);
    }

    // Check date range
    if (p.start_date && p.end_date && p.end_date < p.start_date) {
      errors.push(`Project ${idx}: end_date before start_date`);
    }

    // Check status
    const validStatuses = ['Open', 'Active', 'Planning', 'On Hold', 'Completed', 'Cancelled'];
    if (p.status && !validStatuses.includes(p.status)) {
      errors.push(`Project ${idx}: Invalid status "${p.status}"`);
    }
  });

  // Validate objectives
  objectives.forEach((o, idx) => {
    if (!o.id || !isValidUUID(o.id)) {
      errors.push(`Objective ${idx}: Invalid or missing ID`);
    }

    if (seenObjectiveIds.has(o.id)) {
      errors.push(`Objective ${idx}: Duplicate ID ${o.id}`);
    }
    seenObjectiveIds.add(o.id);

    if (!o.project_id || !seenProjectIds.has(o.project_id)) {
      errors.push(`Objective ${idx}: Invalid or missing project_id`);
    }

    if (!o.objective || o.objective.trim() === '') {
      errors.push(`Objective ${idx}: Missing objective text`);
    }
  });

  // Validate steps
  steps.forEach((s, idx) => {
    if (!s.id || !isValidUUID(s.id)) {
      errors.push(`Step ${idx}: Invalid or missing ID`);
    }

    if (!s.objective_id || !seenObjectiveIds.has(s.objective_id)) {
      errors.push(`Step ${idx}: Invalid or missing objective_id`);
    }

    if (!s.step_text || s.step_text.trim() === '') {
      errors.push(`Step ${idx}: Missing step_text`);
    }
  });

  // Validate images
  images.forEach((i, idx) => {
    if (!i.id || !isValidUUID(i.id)) {
      errors.push(`Image ${idx}: Invalid or missing ID`);
    }

    if (!i.project_id || !seenProjectIds.has(i.project_id)) {
      errors.push(`Image ${idx}: Invalid or missing project_id`);
    }

    if (!i.image_url || !isValidURL(i.image_url)) {
      errors.push(`Image ${idx}: Invalid or missing image_url`);
    }
  });

  return errors;
}

function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function isValidURL(str) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}
```

### Phase 4: Data Import to Supabase (Week 3)

1. **Import to Staging Environment**

**Import Script**: `scripts/import-projects-to-supabase.js`

```javascript
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function importProjects() {
  // Read transformed data
  const projects = JSON.parse(fs.readFileSync('supabase_projects_import.json'));
  const objectives = JSON.parse(fs.readFileSync('supabase_objectives_import.json'));
  const steps = JSON.parse(fs.readFileSync('supabase_steps_import.json'));
  const images = JSON.parse(fs.readFileSync('supabase_images_import.json'));

  // Import in order (respecting foreign keys)
  console.log('Importing projects...');
  const { data: projectsData, error: projectsError } = await supabase
    .from('projects')
    .insert(projects);

  if (projectsError) {
    console.error('Projects import failed:', projectsError);
    return;
  }
  console.log(`✅ Imported ${projects.length} projects`);

  console.log('Importing objectives...');
  const { data: objectivesData, error: objectivesError } = await supabase
    .from('project_objectives')
    .insert(objectives);

  if (objectivesError) {
    console.error('Objectives import failed:', objectivesError);
    return;
  }
  console.log(`✅ Imported ${objectives.length} objectives`);

  console.log('Importing steps...');
  const { data: stepsData, error: stepsError } = await supabase
    .from('project_objective_steps')
    .insert(steps);

  if (stepsError) {
    console.error('Steps import failed:', stepsError);
    return;
  }
  console.log(`✅ Imported ${steps.length} steps`);

  console.log('Importing images...');
  const { data: imagesData, error: imagesError } = await supabase
    .from('project_images')
    .insert(images);

  if (imagesError) {
    console.error('Images import failed:', imagesError);
    return;
  }
  console.log(`✅ Imported ${images.length} images`);

  console.log('✅ Import complete!');
}

importProjects().catch(console.error);
```

2. **Validate Imported Data**

```sql
-- Count validation
SELECT
  (SELECT COUNT(*) FROM projects) AS projects_count,
  (SELECT COUNT(*) FROM project_objectives) AS objectives_count,
  (SELECT COUNT(*) FROM project_objective_steps) AS steps_count,
  (SELECT COUNT(*) FROM project_images) AS images_count;

-- Check for orphaned objectives
SELECT COUNT(*) FROM project_objectives o
LEFT JOIN projects p ON o.project_id = p.id
WHERE p.id IS NULL;
-- Should return 0

-- Check for orphaned steps
SELECT COUNT(*) FROM project_objective_steps s
LEFT JOIN project_objectives o ON s.objective_id = o.id
WHERE o.id IS NULL;
-- Should return 0

-- Check for orphaned images
SELECT COUNT(*) FROM project_images i
LEFT JOIN projects p ON i.project_id = p.id
WHERE p.id IS NULL;
-- Should return 0

-- Verify business logic constraints
SELECT COUNT(*) FROM projects
WHERE is_fixed_price = true AND is_subscription = true;
-- Should return 0

SELECT COUNT(*) FROM projects
WHERE (is_fixed_price = true OR is_subscription = true)
  AND (value IS NULL OR value <= 0);
-- Should return 0
```

3. **Generate Business Logic Entries**

For existing projects with `is_fixed_price = true` or `is_subscription = true`, manually trigger sales entry generation:

```sql
-- Call business logic function for fixed-price projects
SELECT generate_fixed_price_sales(id) FROM projects
WHERE is_fixed_price = true;

-- Call business logic function for subscription projects
SELECT generate_subscription_sales(id) FROM projects
WHERE is_subscription = true;
```

4. **Import to Production**

After successful staging validation:
- Repeat import process on production Supabase instance
- Validate data integrity on production
- Keep FileMaker data as backup

### Phase 5: Frontend Refactor (Week 3-4)

1. **Update API Layer** (`src/api/projects.js`)
   - Replace all FileMaker API calls with backend API calls
   - Use `dataService.callBackendAPI()` with HMAC auth
   - Maintain same function signatures for backward compatibility
   - Add feature flag for gradual rollout

2. **Update Services Layer** (`src/services/projectService.js`)
   - Remove FileMaker-specific data transformations
   - Update data processing for Supabase response format
   - Update validation logic for new constraints
   - Remove `formatProjectForFileMaker` function

3. **Update Hooks Layer** (`src/hooks/useProject.js`)
   - Update state management for new data structure
   - Update CRUD operations to use new API endpoints
   - Handle nested relationships (objectives + steps)
   - Add error handling for Supabase-specific errors

4. **Update UI Components**
   - Verify all components work with new data structure
   - Test all user workflows end-to-end
   - Fix any UI bugs or regressions

5. **Feature Flag Implementation**

Add environment variable:
```env
VITE_USE_SUPABASE_PROJECTS=false
```

In `src/api/projects.js`:
```javascript
const useSupabase = import.meta.env.VITE_USE_SUPABASE_PROJECTS === 'true';

export async function fetchProjectsForCustomer(customerId) {
  if (useSupabase) {
    return fetchProjectsFromSupabase(customerId);
  } else {
    return fetchProjectsFromFileMaker(customerId);
  }
}
```

### Phase 6: Testing and Validation (Week 4-5)

1. **Unit Tests**
   - Test all API functions
   - Test all service functions
   - Test validation logic
   - Test business logic (fixed-price, subscription)

2. **Integration Tests**
   - Test complete user workflows
   - Test data integrity across relationships
   - Test cascading deletes
   - Test RLS policies

3. **UAT (User Acceptance Testing)**
   - Enable feature flag for internal users
   - Test all project CRUD operations
   - Test objectives and steps management
   - Test images and links management
   - Test time records integration
   - Test business logic (sales generation)

4. **Performance Testing**
   - Load test: List 100+ projects
   - Load test: Project detail with 50+ objectives
   - Measure response times (target: <500ms for list, <1s for detail)

### Phase 7: Gradual Rollout (Week 5-6)

1. **Internal Testing** (Week 5, Days 1-3)
   - Enable feature flag for internal users only
   - Monitor errors, performance, data consistency
   - Fix critical bugs immediately
   - Gather feedback

2. **Phased External Rollout** (Week 5-6)
   - Day 4-5: 10% of external users
   - Day 6-7: 25% of external users
   - Week 6, Day 1-2: 50% of external users
   - Week 6, Day 3-4: 75% of external users
   - Week 6, Day 5+: 100% of users

3. **Monitoring**
   - Track error rates
   - Track API response times
   - Track user-reported issues
   - Monitor Supabase database performance

4. **Full Cutover** (Week 6, End)
   - Set `VITE_USE_SUPABASE_PROJECTS=true` for all users
   - Disable FileMaker integration
   - Remove feature flag code

### Phase 8: Cleanup (Week 6+)

1. **Code Cleanup**
   - Remove FileMaker API calls from `src/api/projects.js`
   - Remove `formatProjectForFileMaker` and related functions
   - Remove feature flag logic
   - Remove FileMaker-specific code comments

2. **Archive FileMaker Data**
   - Export final FileMaker backup (all 7 layouts)
   - Archive for 90 days
   - Document archive location

3. **Documentation Updates**
   - Update CLAUDE.md
   - Update README.md
   - Update API documentation
   - Mark migration as complete

## ID Reconciliation Strategy

### FileMaker UUID Preservation

**Strategy**: Use FileMaker `__ID` (UUID) as Supabase primary key `id`

**Rationale**:
- Preserves relationships across migrations
- No ID mapping table required
- Simplifies migration scripts
- Enables incremental testing

**Implementation**:
```sql
-- Projects table uses FileMaker UUID
INSERT INTO projects (id, name, customer_id, ...)
VALUES ('fm-uuid-123', 'Project Name', 'fm-customer-uuid', ...);

-- Objectives reference project via preserved UUID
INSERT INTO project_objectives (id, project_id, objective, ...)
VALUES ('fm-obj-uuid-456', 'fm-uuid-123', 'Objective text', ...);
```

### Relationship Preservation

1. **Customer Relationship**: `_custID` (FM) → `customer_id` (Supabase)
   - Requires: Customers migration completed first
   - Customer UUIDs must exist in Supabase

2. **Team Relationship**: `_teamID` (FM) → `team_id` (Supabase)
   - Requires: Teams migration completed first
   - Team UUIDs must exist in Supabase

3. **Time Records Relationship**: `_projectID` in `dapiRecords` (FM) → `project_id` in `time_entries` or `customer_sales` (Supabase)
   - Requires: Financial Records migration (INS0007)
   - Project UUIDs preserved for time record association

4. **Notes Relationship**: `_fkID` in `devNotes` (FM) → `project_id` in `notes` (Supabase)
   - Requires: Notes migration (INS0005) to handle polymorphic associations

5. **Links Relationship**: `_fkID` in `devProjectLinks` (FM) → `project_id` in `links` (Supabase)
   - Requires: Links migration (INS0006) completed first

## Cutover Strategy

### Option 1: Feature Flag Rollout (RECOMMENDED)

**Pros**:
- Gradual rollout minimizes risk
- Can rollback individual users if issues occur
- Allows A/B testing
- Production validation before full cutover

**Cons**:
- Requires maintaining dual code paths
- More complex implementation
- Longer migration timeline

**Implementation**:
See Phase 5 and Phase 7 above.

### Option 2: Hard Cutover

**Pros**:
- Simpler implementation
- Faster migration timeline
- No dual code paths

**Cons**:
- High risk: all users affected if issues occur
- Difficult to rollback
- No production validation before cutover

**NOT RECOMMENDED** due to high risk and complexity of Projects feature.

## Rollback Procedures

### Scenario 1: Data Integrity Issues Discovered

**Trigger**: Missing data, incorrect relationships, data corruption

**Action**:
1. Immediately set `VITE_USE_SUPABASE_PROJECTS=false`
2. All users revert to FileMaker
3. Investigate and fix data issues in Supabase
4. Re-run validation scripts
5. Resume rollout when fixed

**Recovery Time**: 5-15 minutes (feature flag change + deployment)

### Scenario 2: Performance Issues

**Trigger**: Slow API responses, database overload, timeout errors

**Action**:
1. Set feature flag to reduce user percentage (100% → 50% → 10%)
2. Investigate performance bottlenecks
3. Optimize queries, add indexes, or scale Supabase
4. Resume rollout when fixed

**Recovery Time**: 5-30 minutes

### Scenario 3: Critical Bugs in Business Logic

**Trigger**: Incorrect sales generation, calculation errors, data loss

**Action**:
1. Immediately set `VITE_USE_SUPABASE_PROJECTS=false`
2. All users revert to FileMaker
3. Fix business logic bugs in backend
4. Delete incorrect sales entries in Supabase
5. Re-test thoroughly
6. Resume rollout when fixed

**Recovery Time**: 5 minutes (feature flag) + bug fix time

### Scenario 4: Complete Rollback Required

**Trigger**: Unrecoverable issues, critical data loss, major bugs

**Action**:
1. Set `VITE_USE_SUPABASE_PROJECTS=false`
2. Delete all migrated data from Supabase (if corrupted)
3. Restore from FileMaker backup
4. Re-plan migration approach
5. Schedule new migration attempt

**Recovery Time**: 30-60 minutes

### Rollback Safety Measures

1. **FileMaker Backup**: Keep FileMaker data intact for 90 days after cutover
2. **Supabase Backup**: Daily automated backups of Supabase database
3. **Feature Flag**: Instant rollback capability via environment variable
4. **Monitoring**: Real-time alerts for errors and performance degradation
5. **Communication Plan**: Notify users of rollback and estimated recovery time

## Validation Checklist

### Pre-Migration Validation

- [ ] Customers migration completed (customer UUIDs available)
- [ ] Teams migration completed (team UUIDs available)
- [ ] Backend API endpoints implemented and tested
- [ ] RLS policies configured and tested
- [ ] Business logic triggers implemented and tested
- [ ] Staging environment set up and validated
- [ ] Export scripts tested and validated
- [ ] Transformation scripts tested and validated
- [ ] Import scripts tested and validated

### Post-Migration Validation

- [ ] Project count matches FileMaker count
- [ ] Objectives count matches FileMaker count
- [ ] Steps count matches FileMaker count
- [ ] Images count matches FileMaker count
- [ ] Links count matches FileMaker count (if applicable)
- [ ] Notes count matches FileMaker count (if applicable)
- [ ] No orphaned objectives (all have valid project_id)
- [ ] No orphaned steps (all have valid objective_id)
- [ ] No orphaned images (all have valid project_id)
- [ ] All customer relationships preserved
- [ ] All team relationships preserved
- [ ] All project statuses valid
- [ ] All date ranges valid (end_date >= start_date)
- [ ] All fixed-price projects have value > 0
- [ ] All subscription projects have start_date
- [ ] No projects with both is_fixed_price and is_subscription = true
- [ ] Business logic executed: fixed-price sales entries generated
- [ ] Business logic executed: subscription sales entries generated
- [ ] All API endpoints return correct data
- [ ] RLS policies enforce organization scoping
- [ ] Frontend workflows function identically

### Ongoing Monitoring

- [ ] Error rate < 1% for all API endpoints
- [ ] Average response time < 500ms for project list
- [ ] Average response time < 1s for project detail
- [ ] No user-reported data integrity issues
- [ ] No user-reported missing data
- [ ] No performance degradation over time

## Risk Mitigation

### High Risk: Data Loss

**Mitigation**:
- Export complete FileMaker backup before migration
- Validate data at every step (export, transform, import)
- Test import on staging before production
- Keep FileMaker data intact for 90 days

### High Risk: Business Logic Bugs

**Mitigation**:
- Thoroughly test fixed-price sales generation
- Thoroughly test subscription sales generation
- Compare FileMaker and Supabase sales entries
- Unit test all business logic functions

### Medium Risk: Performance Degradation

**Mitigation**:
- Add database indexes on all foreign keys
- Optimize queries for list/detail endpoints
- Load test with realistic data volumes
- Monitor performance during rollout

### Medium Risk: Relationship Integrity

**Mitigation**:
- Complete dependent migrations first (customers, teams)
- Validate all foreign keys before import
- Use SQL constraints to enforce referential integrity
- Test cascading deletes thoroughly

### Low Risk: User Confusion

**Mitigation**:
- Ensure UI workflows identical to FileMaker version
- Provide user training/documentation if needed
- Monitor user-reported issues during rollout

## Success Criteria

- ✅ 100% of FileMaker projects migrated to Supabase without data loss
- ✅ 100% of objectives, steps, and images migrated
- ✅ All relationships preserved (customer, team, time records)
- ✅ Business logic functions correctly (fixed-price, subscription)
- ✅ All API endpoints functional and performant (<500ms list, <1s detail)
- ✅ RLS policies enforce organization scoping correctly
- ✅ All user workflows function identically
- ✅ No critical bugs or data integrity issues
- ✅ User satisfaction: no complaints about missing data or functionality
- ✅ FileMaker integration removed from codebase
- ✅ Error rate < 1% for all endpoints

## Post-Migration Tasks

1. **Monitor for 1 Week**
   - Watch error logs
   - Track performance metrics
   - Respond to user issues

2. **Conduct Retrospective**
   - Document lessons learned
   - Identify process improvements
   - Update migration playbook

3. **Archive FileMaker Data**
   - Keep backup for 90 days
   - Document archive location
   - Set expiration date

4. **Update Documentation**
   - Mark migration as complete
   - Update architecture diagrams
   - Update developer onboarding docs
