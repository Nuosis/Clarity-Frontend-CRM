# Projects Migration Plan - FileMaker to Supabase

## Document Purpose

This document provides a comprehensive, actionable migration plan for transitioning the Projects feature from FileMaker-primary to Supabase-only architecture. It includes data backfill strategy for projects and 5 related entities (objectives, steps, images, links, notes), cutover procedures, rollback plans, validation steps, and monitoring requirements.

**Document Version**: 1.0
**Last Updated**: 2026-01-10
**Task Reference**: TSK0018 - Create migration plan for projects
**Dependencies**: TSK0001-TSK0017 (data model mapping, API contracts, authorization)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Migration Prerequisites](#migration-prerequisites)
3. [Migration Phases](#migration-phases)
4. [Data Backfill Strategy](#data-backfill-strategy)
5. [ID Reconciliation Implementation](#id-reconciliation-implementation)
6. [Related Entities Migration Strategy](#related-entities-migration-strategy)
7. [Cutover Approach](#cutover-approach)
8. [Validation & Reconciliation](#validation--reconciliation)
9. [Rollback Procedures](#rollback-procedures)
10. [Performance Benchmarks](#performance-benchmarks)
11. [Risk Assessment & Mitigation](#risk-assessment--mitigation)
12. [Post-Migration Monitoring](#post-migration-monitoring)
13. [Success Criteria](#success-criteria)
14. [Team Responsibilities](#team-responsibilities)

---

## Executive Summary

### Migration Scope

**Feature**: Projects (core CRM workflow entity with 5 related sub-entities)
**Current State**: FileMaker-only (NO Supabase integration or dual-write)
**Target State**: Supabase-only (FileMaker deprecated)
**Estimated Project Count**: ~50-150 active projects (needs audit)
**Related Tables**: 6 tables (projects, project_objectives, project_objective_steps, project_images, links, notes)
**Dependent Features**: Customers, Teams, Time Tracking, Proposals, Financial Records (Sales Entries)

### Key Strategy Decisions

1. **ID Mapping**: Direct UUID mapping (FileMaker `__ID` → Supabase `projects.id`)
   - **Rationale**: No lookup table needed, preserves foreign key references across 5 related tables
   - **Reference**: [id-reconciliation-implementation](#id-reconciliation-implementation)

2. **Cutover Method**: Feature flag with gradual rollout
   - **Rationale**: Safe rollback, phased testing, reduced risk for complex business logic
   - **Implementation**: Environment variable `VITE_USE_SUPABASE_PROJECTS`

3. **No Dual-Write Period**: Direct migration (skip dual-write implementation)
   - **Current Gap**: Projects have ZERO Supabase integration (100% FileMaker-only)
   - **Decision**: Implement Supabase-only backend, migrate data, cut over via feature flag
   - **Rationale**: Dual-write would require implementing full CRUD + business logic twice

4. **Backend-First Architecture**: All operations through backend API
   - **Rationale**: Complex business logic (fixed-price/subscription sales), transactional consistency, security
   - **Reference**: [api-contracts.md](./api-contracts.md)

5. **Related Entities Migration Order**: Sequential migration in dependency order
   - **Order**: Projects → Objectives → Steps → Images/Links/Notes (parallel)
   - **Rationale**: Foreign key constraints prevent parallel migration
   - **Reference**: [related-entities-migration-strategy](#related-entities-migration-strategy)

### Critical Path Timeline

**Total Duration**: 6-8 weeks (includes backend implementation)

| Phase | Duration | Start | End | Dependencies |
|-------|----------|-------|-----|--------------|
| **Phase 1**: Backend Preparation | 2-3 weeks | Week 1 | Week 3 | Backend team availability, schema design approval |
| **Phase 2**: Data Audit & Export | 3-5 days | Week 3 | Week 3 | Access to FileMaker Data API |
| **Phase 3**: Data Transformation | 3-5 days | Week 3 | Week 4 | Customers & Teams migration complete |
| **Phase 4**: Data Import (Staging) | 2-3 days | Week 4 | Week 4 | Backend schema deployed to staging |
| **Phase 4**: Data Import (Production) | 1 day | Week 5 | Week 5 | Staging validation passed |
| **Phase 5**: Frontend Refactor | 1-2 weeks | Week 4 | Week 6 | Backend API stable in staging |
| **Phase 6**: Testing & Validation | 1 week | Week 6 | Week 7 | Frontend refactor complete |
| **Phase 7**: Gradual Rollout | 1-2 weeks | Week 7 | Week 8 | All phases complete |
| **Phase 8**: Cleanup | 1 week | Week 8+ | Week 9+ | 100% cutover validated |

### Risk Level Assessment

**Overall Risk**: High

**Risk Factors**:
- ❌ **Critical Risk**: NO existing Supabase integration (100% rewrite vs incremental migration)
- ❌ **High Risk**: Complex business logic (fixed-price 50/50 split, subscription monthly sales)
- ❌ **High Risk**: 5 related entities with nested relationships (objectives → steps hierarchy)
- ⚠️ **Medium Risk**: 10+ dependent features rely on project data (proposals, time tracking, sales)
- ⚠️ **Medium Risk**: Missing Supabase schema columns (no `team_id`, `is_fixed_price`, `is_subscription` yet)
- ✅ **Low Risk**: UUID-based ID reconciliation is straightforward (same as customers migration)

**Mitigation**: Feature flag enables instant rollback, gradual rollout limits blast radius, comprehensive testing of business logic before production

---

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
const fmLinks = JSON.parse(fs.readFileSync('filemaker_links_export.json', 'utf8'));
const fmNotes = JSON.parse(fs.readFileSync('filemaker_notes_export.json', 'utf8'));

// Read existing Supabase customer data for organization_id lookup
const supabaseCustomers = JSON.parse(fs.readFileSync('supabase_customers.json', 'utf8'));
const customerOrgMap = new Map(supabaseCustomers.map(c => [c.id, c.organization_id]));

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
    status: mapStatus(fieldData.status || 'Open'),
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

// Transform objectives with foreign key validation
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

// Transform steps with foreign key validation
const steps = fmSteps.response.data.map(record => {
  const { fieldData } = record;

  return {
    id: fieldData.__ID,
    objective_id: fieldData._objectiveID,
    step_text: fieldData.projectObjectiveStep,
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
    project_id: fieldData._fkID,
    url: fieldData.url,
    title: fieldData.title || null,
    description: fieldData.description || null,
    file_name: fieldData.fileName || null,
    storage_provider: detectStorageProvider(fieldData.url),
    created_at: fieldData['~creationTimestamp'],
    updated_at: fieldData['~modificationTimestamp'],
    created_by: fieldData['~createdBy'] || null,
    modified_by: fieldData['~modifiedBy'] || null
  };
});

// Transform links with customer_id/organization_id lookup
const links = fmLinks.response.data.map(record => {
  const { fieldData } = record;
  const projectId = fieldData._fkID;
  const project = projects.find(p => p.id === projectId);

  if (!project) {
    console.warn(`Orphaned link ${fieldData.__ID}: project ${projectId} not found`);
    return null;
  }

  return {
    id: fieldData.__ID,
    project_id: projectId,
    customer_id: project.customer_id,
    organization_id: project.organization_id,
    link: fieldData.link.slice(0, 2048), // Truncate to VARCHAR(2048) limit
    // Note: title field lost - Supabase has no title column
    created_at: fieldData['~creationTimestamp'],
    updated_at: fieldData['~modificationTimestamp']
  };
}).filter(link => link !== null); // Remove orphaned links

// Transform notes with polymorphic foreign key resolution
const notes = fmNotes.response.data.map(record => {
  const { fieldData } = record;
  const entityId = fieldData._fkID;
  const project = projects.find(p => p.id === entityId);

  if (!project) {
    console.warn(`Orphaned note ${fieldData.__ID}: entity ${entityId} not found`);
    return null;
  }

  return {
    id: fieldData.__ID,
    entity_type: 'project',
    entity_id: entityId,
    note: fieldData.note,
    type: fieldData.type || 'general',
    created_at: fieldData['~CreationTimestamp'],
    created_by: fieldData['~CreatedBy'] || null
  };
}).filter(note => note !== null); // Remove orphaned notes

// Helper function to convert dates
function convertDate(fmDate) {
  if (!fmDate) return null;
  // Convert MM/DD/YYYY to YYYY-MM-DD
  const parts = fmDate.split('/');
  return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
}

// Helper function to map status values
function mapStatus(fmStatus) {
  const statusMap = {
    'Open': 'active',
    'Active': 'active',
    'Pending': 'pending',
    'Planning': 'pending',
    'On Hold': 'on_hold',
    'Completed': 'completed',
    'Complete': 'completed',
    'Closed': 'completed',
    'Cancelled': 'cancelled'
  };
  return statusMap[fmStatus] || 'active';
}

// Helper function to detect storage provider
function detectStorageProvider(url) {
  if (!url) return null;
  if (url.includes('server.claritybusinesssolutions.ca')) return 'filemaker';
  if (url.includes('supabase.claritybusinesssolutions.ca/storage')) return 'supabase';
  if (url.includes('s3.amazonaws.com') || url.includes('amazonaws.com')) return 'aws_s3';
  if (url.includes('cloudflare')) return 'cloudflare_r2';
  return 'external';
}

// Write transformed data
fs.writeFileSync('supabase_projects_import.json', JSON.stringify(projects, null, 2));
fs.writeFileSync('supabase_objectives_import.json', JSON.stringify(objectives, null, 2));
fs.writeFileSync('supabase_steps_import.json', JSON.stringify(steps, null, 2));
fs.writeFileSync('supabase_images_import.json', JSON.stringify(images, null, 2));
fs.writeFileSync('supabase_links_import.json', JSON.stringify(links, null, 2));
fs.writeFileSync('supabase_notes_import.json', JSON.stringify(notes, null, 2));

console.log(`Transformed ${projects.length} projects`);
console.log(`Transformed ${objectives.length} objectives`);
console.log(`Transformed ${steps.length} steps`);
console.log(`Transformed ${images.length} images`);
console.log(`Transformed ${links.length} links (${fmLinks.response.data.length - links.length} orphaned)`);
console.log(`Transformed ${notes.length} notes (${fmNotes.response.data.length - notes.length} orphaned)`);
```

2. **Validate Transformed Data**

**Validation Script**: `scripts/validate-projects.js`

```javascript
function validateProjects(projects, objectives, steps, images, links, notes) {
  const errors = [];
  const warnings = [];
  const seenProjectIds = new Set();
  const seenObjectiveIds = new Set();
  const seenStepIds = new Set();
  const seenImageIds = new Set();
  const seenLinkIds = new Set();
  const seenNoteIds = new Set();

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

    if (p.name && p.name.length > 255) {
      errors.push(`Project ${idx}: Name exceeds 255 characters`);
    }

    if (!p.customer_id || !isValidUUID(p.customer_id)) {
      errors.push(`Project ${idx}: Invalid customer_id`);
    }

    if (!p.organization_id || !isValidUUID(p.organization_id)) {
      errors.push(`Project ${idx}: Missing organization_id (required for multi-tenancy)`);
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
    const validStatuses = ['active', 'pending', 'on_hold', 'completed', 'cancelled'];
    if (p.status && !validStatuses.includes(p.status)) {
      errors.push(`Project ${idx}: Invalid status "${p.status}" (must be: ${validStatuses.join(', ')})`);
    }

    // Check value constraints
    if (p.value && p.value > 99999999.99) {
      errors.push(`Project ${idx}: Value exceeds DECIMAL(10,2) limit`);
    }

    // Warn if team_id missing
    if (!p.team_id) {
      warnings.push(`Project ${idx}: No team assigned (team_id is null)`);
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
      errors.push(`Objective ${idx}: Invalid or missing project_id (orphaned objective)`);
    }

    if (!o.objective || o.objective.trim() === '') {
      errors.push(`Objective ${idx}: Missing objective text`);
    }

    // Check order_num for duplicates within same project
    const projectObjectives = objectives.filter(obj => obj.project_id === o.project_id);
    const duplicateOrder = projectObjectives.filter(obj => obj.order_num === o.order_num && obj.id !== o.id);
    if (duplicateOrder.length > 0) {
      warnings.push(`Objective ${idx}: Duplicate order_num ${o.order_num} in project ${o.project_id}`);
    }
  });

  // Validate steps
  steps.forEach((s, idx) => {
    if (!s.id || !isValidUUID(s.id)) {
      errors.push(`Step ${idx}: Invalid or missing ID`);
    }

    if (seenStepIds.has(s.id)) {
      errors.push(`Step ${idx}: Duplicate ID ${s.id}`);
    }
    seenStepIds.add(s.id);

    if (!s.objective_id || !seenObjectiveIds.has(s.objective_id)) {
      errors.push(`Step ${idx}: Invalid or missing objective_id (orphaned step)`);
    }

    if (!s.step_text || s.step_text.trim() === '') {
      errors.push(`Step ${idx}: Missing step_text`);
    }

    // Check order_num for duplicates within same objective
    const objectiveSteps = steps.filter(step => step.objective_id === s.objective_id);
    const duplicateOrder = objectiveSteps.filter(step => step.order_num === s.order_num && step.id !== s.id);
    if (duplicateOrder.length > 0) {
      warnings.push(`Step ${idx}: Duplicate order_num ${s.order_num} in objective ${s.objective_id}`);
    }
  });

  // Validate images
  images.forEach((i, idx) => {
    if (!i.id || !isValidUUID(i.id)) {
      errors.push(`Image ${idx}: Invalid or missing ID`);
    }

    if (seenImageIds.has(i.id)) {
      errors.push(`Image ${idx}: Duplicate ID ${i.id}`);
    }
    seenImageIds.add(i.id);

    if (!i.project_id || !seenProjectIds.has(i.project_id)) {
      errors.push(`Image ${idx}: Invalid or missing project_id (orphaned image)`);
    }

    if (!i.url || !isValidURL(i.url)) {
      errors.push(`Image ${idx}: Invalid or missing URL`);
    }

    // Warn about broken URLs (could check HTTP status in separate async validation)
    if (i.url && i.url.includes('localhost')) {
      warnings.push(`Image ${idx}: URL points to localhost - will fail in production`);
    }
  });

  // Validate links
  links.forEach((l, idx) => {
    if (!l.id || !isValidUUID(l.id)) {
      errors.push(`Link ${idx}: Invalid or missing ID`);
    }

    if (seenLinkIds.has(l.id)) {
      errors.push(`Link ${idx}: Duplicate ID ${l.id}`);
    }
    seenLinkIds.add(l.id);

    if (!l.project_id || !seenProjectIds.has(l.project_id)) {
      errors.push(`Link ${idx}: Invalid or missing project_id (orphaned link)`);
    }

    if (!l.customer_id || !isValidUUID(l.customer_id)) {
      errors.push(`Link ${idx}: Missing customer_id (required by Supabase links table)`);
    }

    if (!l.organization_id || !isValidUUID(l.organization_id)) {
      errors.push(`Link ${idx}: Missing organization_id (required by Supabase links table)`);
    }

    if (!l.link || !isValidURL(l.link)) {
      errors.push(`Link ${idx}: Invalid or missing URL`);
    }

    if (l.link && l.link.length > 2048) {
      errors.push(`Link ${idx}: URL exceeds VARCHAR(2048) limit (${l.link.length} chars)`);
    }

    // Warn about lost titles
    if (!warnings.some(w => w.includes('Link titles will be lost'))) {
      warnings.push('Link titles will be lost during migration (Supabase links table has no title column)');
    }
  });

  // Validate notes
  notes.forEach((n, idx) => {
    if (!n.id || !isValidUUID(n.id)) {
      errors.push(`Note ${idx}: Invalid or missing ID`);
    }

    if (seenNoteIds.has(n.id)) {
      errors.push(`Note ${idx}: Duplicate ID ${n.id}`);
    }
    seenNoteIds.add(n.id);

    if (!n.entity_id || !seenProjectIds.has(n.entity_id)) {
      errors.push(`Note ${idx}: Invalid or missing entity_id (orphaned note)`);
    }

    if (!n.entity_type || n.entity_type !== 'project') {
      errors.push(`Note ${idx}: Invalid entity_type (expected 'project', got '${n.entity_type}')`);
    }

    if (!n.note || n.note.trim() === '') {
      errors.push(`Note ${idx}: Missing note content`);
    }
  });

  // Check for orphaned records by counting relationships
  console.log('\nRelationship Integrity Check:');
  console.log(`- Projects: ${projects.length}`);
  console.log(`- Objectives: ${objectives.length} (${countOrphaned(objectives, 'project_id', seenProjectIds)} orphaned)`);
  console.log(`- Steps: ${steps.length} (${countOrphaned(steps, 'objective_id', seenObjectiveIds)} orphaned)`);
  console.log(`- Images: ${images.length} (${countOrphaned(images, 'project_id', seenProjectIds)} orphaned)`);
  console.log(`- Links: ${links.length} (${countOrphaned(links, 'project_id', seenProjectIds)} orphaned)`);
  console.log(`- Notes: ${notes.length} (${countOrphaned(notes, 'entity_id', seenProjectIds)} orphaned)`);

  // Return validation results
  return { errors, warnings };
}

function countOrphaned(records, fkField, validIds) {
  return records.filter(r => !validIds.has(r[fkField])).length;
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

// Run validation
const fs = require('fs');
const projects = JSON.parse(fs.readFileSync('supabase_projects_import.json', 'utf8'));
const objectives = JSON.parse(fs.readFileSync('supabase_objectives_import.json', 'utf8'));
const steps = JSON.parse(fs.readFileSync('supabase_steps_import.json', 'utf8'));
const images = JSON.parse(fs.readFileSync('supabase_images_import.json', 'utf8'));
const links = JSON.parse(fs.readFileSync('supabase_links_import.json', 'utf8'));
const notes = JSON.parse(fs.readFileSync('supabase_notes_import.json', 'utf8'));

const { errors, warnings } = validateProjects(projects, objectives, steps, images, links, notes);

if (errors.length > 0) {
  console.error('\n❌ VALIDATION ERRORS:');
  errors.forEach(err => console.error(`  - ${err}`));
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn('\n⚠️  VALIDATION WARNINGS:');
  warnings.forEach(warn => console.warn(`  - ${warn}`));
}

console.log('\n✅ Validation passed!');
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

## Related Entities Migration Strategy

### Overview of Related Entities

Projects in FileMaker have 5 types of related records that must be migrated:

1. **Project Objectives** (devProjectObjectives) - Goals/milestones for the project
2. **Objective Steps** (devProjectObjSteps) - Individual tasks within objectives
3. **Project Images** (devProjectImages) - Screenshots, mockups, designs
4. **Project Links** (devProjectLinks) - GitHub repos, documentation, external URLs
5. **Project Notes** (devNotes) - Text notes and comments (polymorphic)

**Total Tables**: 5 related tables + 1 main projects table = 6 tables total

**Migration Challenge**: Complex foreign key relationships requiring careful ordering and validation.

### Foreign Key Reconciliation Strategy

#### 1. UUID Preservation Approach

**Strategy**: Preserve all FileMaker UUIDs (`__ID`) as Supabase primary keys (`id`)

**Rationale**:
- Maintains relationship integrity across migrations
- No need for ID mapping tables
- Enables incremental testing and rollback
- Simplifies validation scripts

**Implementation**:
```sql
-- Projects: Use FileMaker UUID directly
INSERT INTO projects (id, name, customer_id, ...)
VALUES ('fm-uuid-abc123', 'Project Name', 'fm-customer-uuid', ...);

-- Objectives: Reference project via preserved UUID
INSERT INTO project_objectives (id, project_id, objective, ...)
VALUES ('fm-obj-uuid-456', 'fm-uuid-abc123', 'Objective text', ...);

-- Steps: Reference objective via preserved UUID
INSERT INTO project_objective_steps (id, objective_id, step_text, ...)
VALUES ('fm-step-uuid-789', 'fm-obj-uuid-456', 'Step text', ...);
```

#### 2. Migration Order Dependencies

**Critical Requirement**: Related entities MUST be migrated in dependency order to satisfy foreign key constraints.

**Migration Order** (sequential, NOT parallel):

1. ✅ **Customers** (prerequisite - must be completed first)
   - Status: Completed or in progress
   - Required for: `projects.customer_id` foreign key

2. ✅ **Teams** (prerequisite - must be completed first)
   - Status: Completed or in progress
   - Required for: `projects.team_id` foreign key (if column exists)

3. ⚠️ **Projects** (main table)
   - Depends on: customers, teams
   - Blocks: objectives, images, links, notes

4. ⚠️ **Project Objectives**
   - Depends on: projects
   - Blocks: objective steps
   - Foreign key: `project_id → projects.id`

5. ⚠️ **Objective Steps**
   - Depends on: project_objectives
   - Blocks: none
   - Foreign key: `objective_id → project_objectives.id`

6. ⚠️ **Project Images**
   - Depends on: projects
   - Blocks: none
   - Foreign key: `project_id → projects.id`

7. ⚠️ **Project Links** (uses existing links table)
   - Depends on: projects, customers
   - Blocks: none
   - Foreign keys: `project_id → projects.id`, `customer_id → customers.id`, `organization_id → organizations.id`

8. ⚠️ **Project Notes** (requires notes table)
   - Depends on: projects
   - Blocks: none
   - Polymorphic FK: `entity_id → projects.id` (with `entity_type = 'project'`)

**⚠️ CRITICAL**: Steps cannot be migrated before objectives. Objectives cannot be migrated before projects. Violating this order will cause foreign key constraint failures.

#### 3. Handling Orphaned Records

**Definition**: Orphaned records are child records whose parent record does not exist (broken foreign key reference).

**Detection Methods**:

```javascript
// Detect orphaned objectives (parent project missing)
const orphanedObjectives = objectives.filter(obj =>
  !projects.some(p => p.id === obj.project_id)
);

// Detect orphaned steps (parent objective missing)
const orphanedSteps = steps.filter(step =>
  !objectives.some(obj => obj.id === step.objective_id)
);

// Detect orphaned images (parent project missing)
const orphanedImages = images.filter(img =>
  !projects.some(p => p.id === img.project_id)
);

// Detect orphaned links (parent project missing)
const orphanedLinks = links.filter(link =>
  !projects.some(p => p.id === link.project_id)
);

// Detect orphaned notes (parent project missing)
const orphanedNotes = notes.filter(note =>
  !projects.some(p => p.id === note.entity_id)
);
```

**Handling Strategies**:

**Option 1: Skip Orphaned Records (RECOMMENDED)**
- Do not migrate orphaned records
- Log orphaned record IDs for manual review
- Report count to user after migration
- Preserve orphaned data in FileMaker backup

```javascript
// Filter out orphaned records before import
const validObjectives = objectives.filter(obj =>
  projects.some(p => p.id === obj.project_id)
);
const validSteps = steps.filter(step =>
  objectives.some(obj => obj.id === step.objective_id)
);
// ... repeat for images, links, notes
```

**Option 2: Create Placeholder Parents**
- Create dummy projects for orphaned objectives/images/links/notes
- Mark as "ORPHANED - Migrated from FileMaker" in name/description
- Assign to special "Orphaned Records" customer
- Allows manual cleanup later

**Option 3: Fail Migration**
- Reject entire migration if orphaned records detected
- Requires manual FileMaker cleanup before migration
- Most conservative approach, prevents data loss

**Recommended Approach**: Option 1 (Skip) + Report for objectives/steps/images, Option 2 (Placeholder) for links/notes if count is small.

**SQL Validation** (Post-migration check):

```sql
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

-- Check for orphaned links
SELECT COUNT(*) FROM links l
LEFT JOIN projects p ON l.project_id = p.id
WHERE p.id IS NULL AND l.project_id IS NOT NULL;
-- Should return 0

-- Check for orphaned notes
SELECT COUNT(*) FROM notes n
LEFT JOIN projects p ON n.entity_id = p.id
WHERE p.id IS NULL AND n.entity_type = 'project';
-- Should return 0
```

#### 4. Order Preservation for Objectives and Steps

**Importance**: Objectives and steps have an `order` field (FileMaker) → `order_num` (Supabase) that determines display sequence. Preserving order is critical for user experience.

**FileMaker Field**: `order` (Number, starting at 1 or 0)
**Supabase Field**: `order_num` (INTEGER, default 0)

**Order Preservation Strategy**:

1. **Direct Mapping**: Copy FileMaker `order` → Supabase `order_num` exactly
   ```javascript
   order_num: fieldData.order || 0
   ```

2. **Handle Missing Orders**: If FileMaker `order` is null, default to 0
   ```javascript
   order_num: fieldData.order ?? 0
   ```

3. **Validate Order Uniqueness** (optional, not enforced by schema):
   - Within same project, objectives should have unique order numbers
   - Within same objective, steps should have unique order numbers
   - Duplicate orders are acceptable (display order may be ambiguous)

4. **Re-number Orders** (optional, for cleanliness):
   ```javascript
   // Re-number objectives to sequential order (1, 2, 3, ...)
   const projectObjectives = objectives
     .filter(o => o.project_id === projectId)
     .sort((a, b) => (a.order_num || 0) - (b.order_num || 0));

   projectObjectives.forEach((obj, index) => {
     obj.order_num = index + 1; // Re-assign sequential order
   });
   ```

**SQL Validation** (Post-migration check):

```sql
-- Check for objectives with missing orders
SELECT project_id, COUNT(*) AS count
FROM project_objectives
WHERE order_num IS NULL OR order_num = 0
GROUP BY project_id
HAVING COUNT(*) > 1;
-- Returns projects with multiple objectives at order 0

-- Check for duplicate orders within same project
SELECT project_id, order_num, COUNT(*) AS duplicates
FROM project_objectives
GROUP BY project_id, order_num
HAVING COUNT(*) > 1;
-- Returns projects with duplicate objective orders

-- Check for steps with duplicate orders within same objective
SELECT objective_id, order_num, COUNT(*) AS duplicates
FROM project_objective_steps
GROUP BY objective_id, order_num
HAVING COUNT(*) > 1;
-- Returns objectives with duplicate step orders
```

**Frontend Sorting** (Code Reference: projectService.js:124, 147):
```javascript
// Objectives sorted by order_num ascending
objectives.sort((a, b) => a.order_num - b.order_num);

// Steps sorted by order_num ascending
steps.sort((a, b) => a.order_num - b.order_num);
```

#### 5. Polymorphic Foreign Key Resolution (Notes)

**Challenge**: FileMaker notes use polymorphic `_fkID` field without entity type indicator. The field could reference projects, customers, tasks, or other entities.

**FileMaker Pattern**:
```
devNotes layout:
- _fkID: UUID (could be project, customer, task, etc.)
- note: Text content
- No entity_type field
```

**Supabase Pattern** (Proposed):
```sql
CREATE TABLE notes (
  id UUID PRIMARY KEY,
  entity_type TEXT NOT NULL,  -- 'project', 'customer', 'task', etc.
  entity_id UUID NOT NULL,    -- Foreign key to entity
  note TEXT NOT NULL,
  type TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ,
  created_by TEXT
);
```

**Resolution Strategy**:

**Option 1: Context-Based Type Detection (RECOMMENDED)**
- Query notes via `fetchProjectNotes(projectId)` which filters by `_fkID = projectId`
- If note appears in project notes query, it's a project note
- Set `entity_type = 'project'` during migration

```javascript
// For each project, fetch its notes
const projectNotes = await fetchProjectNotes(projectId);
projectNotes.forEach(note => {
  note.entity_type = 'project'; // Known context
  note.entity_id = note.fieldData._fkID; // Already project ID
});
```

**Option 2: Cross-Reference with Entities**
- Check if `_fkID` exists in projects table → entity_type = 'project'
- Check if `_fkID` exists in customers table → entity_type = 'customer'
- Check if `_fkID` exists in tasks table → entity_type = 'task'
- If not found, skip note (orphaned)

```javascript
if (projects.some(p => p.id === note._fkID)) {
  note.entity_type = 'project';
} else if (customers.some(c => c.id === note._fkID)) {
  note.entity_type = 'customer';
} else if (tasks.some(t => t.id === note._fkID)) {
  note.entity_type = 'task';
} else {
  console.warn(`Orphaned note ${note.__ID}: entity ${note._fkID} not found`);
  return null; // Skip orphaned note
}
```

**Validation** (Post-migration):
```sql
-- Verify all project notes have valid entity_id
SELECT COUNT(*) FROM notes n
LEFT JOIN projects p ON n.entity_id = p.id
WHERE n.entity_type = 'project' AND p.id IS NULL;
-- Should return 0

-- Verify entity_type values
SELECT entity_type, COUNT(*) AS count
FROM notes
GROUP BY entity_type;
-- Should show: 'project', 'customer', 'task', etc.
```

### Related Entities Migration Checklist

**Before Migration**:
- [ ] Customers migration completed (projects depend on customer_id)
- [ ] Teams migration completed (projects depend on team_id)
- [ ] Backend tables created: project_objectives, project_objective_steps, project_images, notes
- [ ] Backend table verified: links (already exists)
- [ ] Foreign key constraints configured
- [ ] Cascade delete rules configured (ON DELETE CASCADE for objectives/steps/images)

**During Migration**:
- [ ] Export FileMaker data in correct order (projects → objectives → steps)
- [ ] Transform data with UUID preservation
- [ ] Validate foreign key references before import
- [ ] Detect and handle orphaned records
- [ ] Preserve order_num for objectives and steps
- [ ] Resolve polymorphic foreign keys for notes
- [ ] Import in dependency order: projects → objectives → steps → images/links/notes

**After Migration**:
- [ ] Validate no orphaned objectives (SQL check)
- [ ] Validate no orphaned steps (SQL check)
- [ ] Validate no orphaned images (SQL check)
- [ ] Validate no orphaned links (SQL check)
- [ ] Validate no orphaned notes (SQL check)
- [ ] Validate order_num preserved for objectives
- [ ] Validate order_num preserved for steps
- [ ] Validate record counts match FileMaker
- [ ] Test cascade deletes (delete project → objectives/steps deleted)
- [ ] Test frontend display (objectives/steps appear in correct order)

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

---

## Data Backfill Strategy

### Overview

**Goal**: Migrate all FileMaker projects and 5 related entity types to Supabase while preserving IDs, relationships, and data integrity

**Approach**: One-time batch import using backend migration script with sequential entity processing

**Key Principle**: Direct UUID mapping (FileMaker `__ID` → Supabase `id`) across all 6 tables

### Step-by-Step Process

#### Step 1: Export FileMaker Data

**Method**: FileMaker Data API via backend migration script

**Export Order** (Must follow this sequence):
1. Projects (devProjects layout)
2. Objectives (devProjectObjectives layout)
3. Steps (devProjectObjSteps layout)
4. Images (devProjectImages layout)
5. Links (devProjectLinks layout)
6. Notes (devNotes layout, filtered by project entity_type)

**Backend Export Script**:
```python
import requests
import json
import os

FM_SERVER = "https://server.claritybusinesssolutions.ca"
FM_DATABASE = "clarityCRM"
FM_USER = os.getenv("FM_USER")
FM_PASSWORD = os.getenv("FM_PASSWORD")

async def export_filemaker_projects():
    """Export all project-related data from FileMaker"""

    # Authenticate with FileMaker
    auth_response = requests.post(
        f"{FM_SERVER}/fmi/data/v1/databases/{FM_DATABASE}/sessions",
        auth=(FM_USER, FM_PASSWORD)
    )
    fm_token = auth_response.json()["response"]["token"]

    headers = {"Authorization": f"Bearer {fm_token}"}

    exports = {}

    # Export projects
    print("Exporting projects...")
    projects_response = requests.post(
        f"{FM_SERVER}/fmi/data/v1/databases/{FM_DATABASE}/layouts/devProjects/_find",
        headers=headers,
        json={"query": [{"__ID": "*"}]}
    )
    exports['projects'] = projects_response.json()["response"]["data"]
    print(f"  ✓ Exported {len(exports['projects'])} projects")

    # Export objectives
    print("Exporting objectives...")
    objectives_response = requests.post(
        f"{FM_SERVER}/fmi/data/v1/databases/{FM_DATABASE}/layouts/devProjectObjectives/_find",
        headers=headers,
        json={"query": [{"_projectID": "*"}]}
    )
    exports['objectives'] = objectives_response.json()["response"]["data"]
    print(f"  ✓ Exported {len(exports['objectives'])} objectives")

    # Export steps
    print("Exporting steps...")
    steps_response = requests.post(
        f"{FM_SERVER}/fmi/data/v1/databases/{FM_DATABASE}/layouts/devProjectObjSteps/_find",
        headers=headers,
        json={"query": [{"_objectiveID": "*"}]}
    )
    exports['steps'] = steps_response.json()["response"]["data"]
    print(f"  ✓ Exported {len(exports['steps'])} steps")

    # Export images
    print("Exporting images...")
    images_response = requests.post(
        f"{FM_SERVER}/fmi/data/v1/databases/{FM_DATABASE}/layouts/devProjectImages/_find",
        headers=headers,
        json={"query": [{"_fkID": "*"}]}
    )
    exports['images'] = images_response.json()["response"]["data"]
    print(f"  ✓ Exported {len(exports['images'])} images")

    # Export links (for projects)
    print("Exporting project links...")
    links_response = requests.post(
        f"{FM_SERVER}/fmi/data/v1/databases/{FM_DATABASE}/layouts/devProjectLinks/_find",
        headers=headers,
        json={"query": [{"_fkID": "*"}]}
    )
    exports['links'] = links_response.json()["response"]["data"]
    print(f"  ✓ Exported {len(exports['links'])} links")

    # Export notes (for projects)
    print("Exporting project notes...")
    notes_response = requests.post(
        f"{FM_SERVER}/fmi/data/v1/databases/{FM_DATABASE}/layouts/devNotes/_find",
        headers=headers,
        json={"query": [{"_fkID": "*"}]}
    )
    exports['notes'] = notes_response.json()["response"]["data"]
    print(f"  ✓ Exported {len(exports['notes'])} notes")

    # Save exports
    for entity_type, data in exports.items():
        filename = f"filemaker_{entity_type}_export.json"
        with open(filename, "w") as f:
            json.dump(data, f, indent=2)
        print(f"Saved {filename}")

    # Logout
    requests.delete(
        f"{FM_SERVER}/fmi/data/v1/databases/{FM_DATABASE}/sessions/{fm_token}"
    )

    return exports

# Run export
if __name__ == "__main__":
    exports = export_filemaker_projects()
    print(f"\n✅ Export complete!")
    print(f"   Projects: {len(exports['projects'])}")
    print(f"   Objectives: {len(exports['objectives'])}")
    print(f"   Steps: {len(exports['steps'])}")
    print(f"   Images: {len(exports['images'])}")
    print(f"   Links: {len(exports['links'])}")
    print(f"   Notes: {len(exports['notes'])}")
```

#### Step 2: Transform Data

See Phase 3 in [Migration Phases](#migration-phases) for complete transformation scripts.

**Key Transformations**:
1. **UUID Preservation**: FileMaker `__ID` → Supabase `id` (no changes)
2. **Date Format**: MM/DD/YYYY → YYYY-MM-DD
3. **Boolean Conversion**: "1"/"0" strings → true/false
4. **Status Mapping**: FileMaker statuses → Supabase enum values
5. **Organization ID Derivation**: Look up from customer relationship
6. **Foreign Key Validation**: Verify all FKs reference existing records

#### Step 3: Validate Transformed Data

See Phase 3 validation script in [Migration Phases](#migration-phases).

**Validation Checks**:
- UUID validity and uniqueness
- Required fields populated
- Foreign key references valid
- Business logic constraints (no fixed_price AND subscription)
- Date range validity (end >= start)
- Orphaned record detection
- Order number preservation

#### Step 4: Import to Supabase

**Import Order** (Sequential, NOT parallel):
1. Projects
2. Objectives (depends on projects)
3. Steps (depends on objectives)
4. Images, Links, Notes (can be parallel, all depend on projects)

**Backend Import Script**:
```python
from supabase import create_client
import json

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

async def import_projects_to_supabase():
    """Import transformed data to Supabase in dependency order"""

    # Load transformed data
    projects = json.load(open('supabase_projects_import.json'))
    objectives = json.load(open('supabase_objectives_import.json'))
    steps = json.load(open('supabase_steps_import.json'))
    images = json.load(open('supabase_images_import.json'))
    links = json.load(open('supabase_links_import.json'))
    notes = json.load(open('supabase_notes_import.json'))

    results = {}

    # Import projects
    print(f"Importing {len(projects)} projects...")
    response = supabase.table('projects').insert(projects).execute()
    if response.error:
        raise Exception(f"Projects import failed: {response.error}")
    results['projects'] = len(projects)
    print(f"  ✓ Imported {len(projects)} projects")

    # Import objectives
    print(f"Importing {len(objectives)} objectives...")
    response = supabase.table('project_objectives').insert(objectives).execute()
    if response.error:
        raise Exception(f"Objectives import failed: {response.error}")
    results['objectives'] = len(objectives)
    print(f"  ✓ Imported {len(objectives)} objectives")

    # Import steps
    print(f"Importing {len(steps)} steps...")
    response = supabase.table('project_objective_steps').insert(steps).execute()
    if response.error:
        raise Exception(f"Steps import failed: {response.error}")
    results['steps'] = len(steps)
    print(f"  ✓ Imported {len(steps)} steps")

    # Import images, links, notes in parallel
    print(f"Importing {len(images)} images...")
    response = supabase.table('project_images').insert(images).execute()
    if response.error:
        raise Exception(f"Images import failed: {response.error}")
    results['images'] = len(images)
    print(f"  ✓ Imported {len(images)} images")

    print(f"Importing {len(links)} links...")
    response = supabase.table('links').insert(links).execute()
    if response.error:
        raise Exception(f"Links import failed: {response.error}")
    results['links'] = len(links)
    print(f"  ✓ Imported {len(links)} links")

    print(f"Importing {len(notes)} notes...")
    response = supabase.table('notes').insert(notes).execute()
    if response.error:
        raise Exception(f"Notes import failed: {response.error}")
    results['notes'] = len(notes)
    print(f"  ✓ Imported {len(notes)} notes")

    return results

# Run import
if __name__ == "__main__":
    results = import_projects_to_supabase()
    print(f"\n✅ Import complete!")
    for entity, count in results.items():
        print(f"   {entity}: {count}")
```

#### Step 5: Verify Import

**Verification Queries**:

```sql
-- Count validation
SELECT
  (SELECT COUNT(*) FROM projects) AS projects,
  (SELECT COUNT(*) FROM project_objectives) AS objectives,
  (SELECT COUNT(*) FROM project_objective_steps) AS steps,
  (SELECT COUNT(*) FROM project_images) AS images,
  (SELECT COUNT(*) FROM links WHERE project_id IS NOT NULL) AS links,
  (SELECT COUNT(*) FROM notes WHERE entity_type = 'project') AS notes;

-- Orphaned records check
SELECT 'Orphaned Objectives' AS issue, COUNT(*) AS count
FROM project_objectives o
LEFT JOIN projects p ON o.project_id = p.id
WHERE p.id IS NULL
UNION ALL
SELECT 'Orphaned Steps', COUNT(*)
FROM project_objective_steps s
LEFT JOIN project_objectives o ON s.objective_id = o.id
WHERE o.id IS NULL
UNION ALL
SELECT 'Orphaned Images', COUNT(*)
FROM project_images i
LEFT JOIN projects p ON i.project_id = p.id
WHERE p.id IS NULL
UNION ALL
SELECT 'Orphaned Links', COUNT(*)
FROM links l
LEFT JOIN projects p ON l.project_id = p.id
WHERE p.id IS NULL AND l.project_id IS NOT NULL
UNION ALL
SELECT 'Orphaned Notes', COUNT(*)
FROM notes n
LEFT JOIN projects p ON n.entity_id = p.id
WHERE p.id IS NULL AND n.entity_type = 'project';
-- All counts should return 0

-- Business logic validation
SELECT COUNT(*) AS invalid_fixed_price_subscriptions
FROM projects
WHERE is_fixed_price = true AND is_subscription = true;
-- Should return 0

SELECT COUNT(*) AS missing_subscription_start_dates
FROM projects
WHERE is_subscription = true AND start_date IS NULL;
-- Should return 0

SELECT COUNT(*) AS invalid_date_ranges
FROM projects
WHERE start_date IS NOT NULL
  AND target_end_date IS NOT NULL
  AND target_end_date < start_date;
-- Should return 0
```

**Reconciliation Report**:

```python
async def generate_reconciliation_report():
    """Compare FileMaker export vs Supabase import"""

    # Load FileMaker exports
    fm_projects = json.load(open('filemaker_projects_export.json'))
    fm_objectives = json.load(open('filemaker_objectives_export.json'))
    fm_steps = json.load(open('filemaker_steps_export.json'))
    fm_images = json.load(open('filemaker_images_export.json'))
    fm_links = json.load(open('filemaker_links_export.json'))
    fm_notes = json.load(open('filemaker_notes_export.json'))

    # Query Supabase counts
    sb_counts = supabase.rpc('get_migration_counts').execute()

    report = {
        "projects": {
            "filemaker": len(fm_projects),
            "supabase": sb_counts['projects'],
            "match": len(fm_projects) == sb_counts['projects']
        },
        "objectives": {
            "filemaker": len(fm_objectives),
            "supabase": sb_counts['objectives'],
            "match": len(fm_objectives) == sb_counts['objectives']
        },
        "steps": {
            "filemaker": len(fm_steps),
            "supabase": sb_counts['steps'],
            "match": len(fm_steps) == sb_counts['steps']
        },
        "images": {
            "filemaker": len(fm_images),
            "supabase": sb_counts['images'],
            "match": len(fm_images) == sb_counts['images']
        },
        "links": {
            "filemaker": len(fm_links),
            "supabase": sb_counts['links'],
            "match": len(fm_links) == sb_counts['links']
        },
        "notes": {
            "filemaker": len(fm_notes),
            "supabase": sb_counts['notes'],
            "match": len(fm_notes) == sb_counts['notes']
        }
    }

    print("\n=== Migration Reconciliation Report ===\n")
    for entity, counts in report.items():
        status = "✓" if counts['match'] else "✗"
        print(f"{status} {entity.capitalize()}:")
        print(f"   FileMaker: {counts['filemaker']}")
        print(f"   Supabase:  {counts['supabase']}")
        if not counts['match']:
            diff = counts['supabase'] - counts['filemaker']
            print(f"   Difference: {'+' if diff > 0 else ''}{diff}")

    return report
```

#### Step 6: Generate Business Logic Entries

**For Fixed-Price Projects**:
```sql
-- Generate 50/50 sales entries for fixed-price projects
-- This should be done via backend API endpoint, not direct SQL
SELECT generate_fixed_price_sales(id) FROM projects
WHERE is_fixed_price = true;
```

**For Subscription Projects**:
```sql
-- Generate monthly sales entries for subscriptions
-- This should be done via backend API endpoint, not direct SQL
SELECT generate_subscription_sales(id) FROM projects
WHERE is_subscription = true;
```

**Verification**:
```sql
-- Verify sales entries created
SELECT
  p.id,
  p.name,
  p.is_fixed_price,
  p.is_subscription,
  COUNT(cs.id) AS sales_entries
FROM projects p
LEFT JOIN customer_sales cs ON cs.project_id = p.id
WHERE p.is_fixed_price = true OR p.is_subscription = true
GROUP BY p.id, p.name, p.is_fixed_price, p.is_subscription
HAVING COUNT(cs.id) = 0;
-- Should return 0 rows (all fixed-price/subscription projects have sales entries)
```

---

## ID Reconciliation Implementation

### recordId vs UUID Handling

**FileMaker Dual ID System**:
- `__ID`: UUID (text field, globally unique, persistent)
- `recordId`: Integer (internal FileMaker ID, changes on import/export)

**Key Distinction**:
- `__ID` is the **TRUE** persistent identifier
- `recordId` is FileMaker's **internal** record number (NOT portable)

**Migration Strategy**: Use ONLY `__ID`, ignore `recordId`

**Example**:
```json
{
  "fieldData": {
    "__ID": "a1b2c3d4-e5f6-7890-abcd-1234567890ab",  // ← Use this
    "projectName": "Website Redesign",
    // ... other fields
  },
  "recordId": "42"  // ← Ignore this (not portable across FM databases)
}
```

**Code Implementation**:
```javascript
// CORRECT: Use __ID as Supabase primary key
const project = {
  id: fmRecord.fieldData.__ID,  // UUID → id
  name: fmRecord.fieldData.projectName,
  // ...
};

// INCORRECT: Do NOT use recordId
const project = {
  id: fmRecord.recordId,  // ✗ WRONG - not portable
  // ...
};
```

**Frontend Refactoring Required**:

FileMaker operations in `src/api/projects.js` use `recordId` for updates/deletes:
```javascript
// FileMaker mode (OLD - to be removed)
export async function updateProject(recordId, data) {
  return handleFileMakerOperation(async () => {
    return await updateRecordInFileMaker({
      layout: Layouts.PROJECTS,
      recordId: recordId,  // Uses FileMaker internal ID
      fieldData: data
    });
  });
}

// Supabase mode (NEW - uses UUID only)
export async function updateProject(projectId, data) {
  return backendAPI.patch(`/api/projects/${projectId}`, data);  // Uses UUID
}
```

**Migration Impact**: All frontend code using `recordId` must be updated to use UUID-only approach.

**Code Locations**:
- `src/api/projects.js` - Update/delete operations use recordId
- `src/hooks/useProject.js` - State management includes recordId
- `src/services/projectService.js` - Data transformations may reference recordId

**Cleanup Checklist**:
- [ ] Remove `recordId` from project state
- [ ] Update all API calls to use UUID only
- [ ] Remove FileMaker-specific ID handling
- [ ] Verify no hardcoded recordId references

### UUID Consistency Across Tables

**Primary Tables**:
- `projects.id` (UUID from FileMaker `__ID`)
- `project_objectives.id` (UUID from FileMaker `__ID`)
- `project_objective_steps.id` (UUID from FileMaker `__ID`)
- `project_images.id` (UUID from FileMaker `__ID`)
- `links.id` (UUID from FileMaker `__ID`)
- `notes.id` (UUID from FileMaker `__ID`)

**Foreign Key Preservation**:
- `project_objectives.project_id` → `projects.id` (preserved UUID)
- `project_objective_steps.objective_id` → `project_objectives.id` (preserved UUID)
- `project_images.project_id` → `projects.id` (preserved UUID)
- `links.project_id` → `projects.id` (preserved UUID)
- `notes.entity_id` → `projects.id` (preserved UUID, when `entity_type = 'project'`)

**Validation Query**:
```sql
-- Verify all objectives reference valid projects
SELECT COUNT(*) FROM project_objectives o
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = o.project_id);
-- Should return 0

-- Verify all steps reference valid objectives
SELECT COUNT(*) FROM project_objective_steps s
WHERE NOT EXISTS (SELECT 1 FROM project_objectives o WHERE o.id = s.objective_id);
-- Should return 0

-- Verify all images reference valid projects
SELECT COUNT(*) FROM project_images i
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = i.project_id);
-- Should return 0
```

---

## Performance Benchmarks

### Target Performance Metrics

| Operation | FileMaker (Current) | Supabase (Target) | Improvement |
|-----------|-------------------|------------------|-------------|
| List projects (50) | 300-600ms | < 250ms | 2x faster |
| Get project detail (with objectives/steps) | 500-1200ms | < 400ms | 2-3x faster |
| Create project | 200-400ms | < 200ms | Same or faster |
| Update project | 300-700ms | < 250ms | 2x faster |
| Delete project (cascade) | 400-900ms | < 300ms | 2-3x faster |
| Add objective | 150-300ms | < 150ms | 2x faster |
| Reorder objectives | 200-500ms | < 200ms | 2x faster |
| Toggle step completion | 100-250ms | < 100ms | 2x faster |

**Rationale for Targets**:
- Supabase queries use indexed UUIDs (fast primary key lookups)
- Backend API reduces network round-trips (batch operations)
- Proper indexing on foreign keys and frequently queried fields
- No FileMaker Data API overhead

### Database Indexes Required

**Primary Indexes** (verify in backend schema):

```sql
-- Projects table
CREATE INDEX idx_projects_customer_id ON projects(customer_id);
CREATE INDEX idx_projects_team_id ON projects(team_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_organization_id ON projects(organization_id);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX idx_projects_is_fixed_price ON projects(is_fixed_price) WHERE is_fixed_price = true;
CREATE INDEX idx_projects_is_subscription ON projects(is_subscription) WHERE is_subscription = true;

-- Project Objectives
CREATE INDEX idx_objectives_project_id ON project_objectives(project_id);
CREATE INDEX idx_objectives_order ON project_objectives(project_id, order_num);
CREATE INDEX idx_objectives_completed ON project_objectives(completed);

-- Objective Steps
CREATE INDEX idx_steps_objective_id ON project_objective_steps(objective_id);
CREATE INDEX idx_steps_order ON project_objective_steps(objective_id, order_num);
CREATE INDEX idx_steps_completed ON project_objective_steps(completed);

-- Project Images
CREATE INDEX idx_images_project_id ON project_images(project_id);

-- Links (existing table)
CREATE INDEX idx_links_project_id ON links(project_id) WHERE project_id IS NOT NULL;

-- Notes (polymorphic)
CREATE INDEX idx_notes_entity ON notes(entity_type, entity_id);
CREATE INDEX idx_notes_project ON notes(entity_id) WHERE entity_type = 'project';
```

### Performance Testing Plan

**Load Testing Script** (`scripts/load-test-projects.js`):

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 10 },  // Ramp up
    { duration: '5m', target: 10 },  // Stay at 10 users
    { duration: '2m', target: 20 },  // Ramp up
    { duration: '5m', target: 20 },  // Stay at 20 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    'http_req_duration{operation:list}': ['p95<250'],
    'http_req_duration{operation:detail}': ['p95<400'],
    'http_req_duration{operation:create}': ['p95<200'],
  },
};

export default function () {
  const baseUrl = 'https://api.claritybusinesssolutions.ca';
  const headers = {
    'Authorization': generateAuthHeader(),
    'Content-Type': 'application/json',
  };

  // List projects
  let listResponse = http.get(`${baseUrl}/api/projects?limit=50`, {
    headers,
    tags: { operation: 'list' },
  });
  check(listResponse, {
    'list status 200': (r) => r.status === 200,
    'list response < 250ms': (r) => r.timings.duration < 250,
  });

  // Get project detail (with objectives and steps)
  if (listResponse.json().data.length > 0) {
    const projectId = listResponse.json().data[0].id;
    let detailResponse = http.get(
      `${baseUrl}/api/projects/${projectId}?include_objectives=true&include_steps=true`,
      {
        headers,
        tags: { operation: 'detail' },
      }
    );
    check(detailResponse, {
      'detail status 200': (r) => r.status === 200,
      'detail response < 400ms': (r) => r.timings.duration < 400,
    });
  }

  sleep(1);
}
```

**Run Load Test**:
```bash
k6 run scripts/load-test-projects.js
```

---

## Risk Assessment & Mitigation

### Risk Matrix

| Risk ID | Risk Description | Likelihood | Impact | Severity | Mitigation Strategy | Owner |
|---------|-----------------|------------|--------|----------|-------------------|-------|
| R001 | Data loss during migration | Low | Critical | **High** | Test on staging first, validate counts, keep FM backup for 90 days | Backend |
| R002 | Business logic bugs (fixed-price/subscription) | Medium | Critical | **High** | Comprehensive testing, compare FM vs SB sales entries, unit tests | Backend |
| R003 | UUID conflicts/collisions | Very Low | High | Low | Pre-migration validation, check for duplicates | Backend |
| R004 | Performance degradation | Medium | High | **High** | Load testing, query optimization, proper indexes | Backend |
| R005 | Missing Supabase schema columns | High | High | **High** | Backend change request MUST include all missing columns | Backend |
| R006 | User disruption during cutover | Low | High | **Medium** | Gradual rollout, feature flag for instant rollback | Product |
| R007 | Foreign key integrity violations | Low | Critical | **High** | Validate foreign keys pre-migration, test cascade deletes | Backend |
| R008 | Orphaned records | Medium | Medium | **Medium** | Detection scripts, skip or create placeholders | Backend |
| R009 | RLS policy bypass | Very Low | Critical | **High** | Test RLS with multiple orgs, verify cross-org isolation | Backend |
| R010 | Related entities out of sync | Medium | High | **High** | Sequential import order, validate FK chains | Backend |
| R011 | Order number loss (objectives/steps) | Low | Medium | Low | Validate order preservation, test frontend sorting | Frontend |
| R012 | Notes entity_type resolution failure | Medium | Medium | **Medium** | Cross-reference with entities, context-based detection | Backend |

### High-Priority Risk Mitigation

#### R001: Data Loss During Migration

**Mitigation Steps**:
1. ✅ Test migration script on staging with full dataset clone
2. ✅ Validate record counts pre/post migration (must match exactly)
3. ✅ Keep FileMaker backup for 90 days (daily snapshots)
4. ✅ Run reconciliation report and spot-checks before declaring success
5. ✅ Implement rollback procedure (tested in staging)

**Validation**:
- Run migration on staging 3 times successfully
- Verify 100% data integrity in staging
- Document rollback procedure with step-by-step commands

#### R002: Business Logic Bugs (Fixed-Price/Subscription)

**Mitigation Steps**:
1. ✅ Thoroughly test fixed-price 50/50 split sales generation
2. ✅ Thoroughly test subscription monthly sales generation
3. ✅ Compare FileMaker and Supabase sales entries for accuracy
4. ✅ Unit test all business logic functions
5. ✅ Test edge cases (no dates, future dates, value changes)
6. ✅ Verify idempotency (no duplicate sales entries)

**Validation**:
- Create test projects with known value/date combinations
- Manually verify sales entries match expected calculations
- Test historical subscriptions (past end dates)
- Test perpetual subscriptions (no end date)
- Verify time records marked as non-billable

#### R005: Missing Supabase Schema Columns

**Mitigation Steps**:
1. ✅ Create backend change request with ALL missing columns
2. ✅ Document required columns: `team_id`, `is_fixed_price`, `is_subscription`, `time_estimate`, `organization_id`
3. ✅ Document required tables: `project_objectives`, `project_objective_steps`, `project_images`, `notes`
4. ✅ Get backend team approval BEFORE starting migration
5. ✅ Verify schema deployed to staging before data import

**Backend Change Request Required**: Yes (see Migration Prerequisites)

#### R010: Related Entities Out of Sync

**Mitigation Steps**:
1. ✅ Import in strict dependency order (projects → objectives → steps)
2. ✅ Validate foreign keys before each import batch
3. ✅ Test cascade deletes thoroughly
4. ✅ Run orphaned record detection after import
5. ✅ Verify frontend displays nested data correctly

**Validation**:
- Delete test project → verify objectives/steps also deleted
- Query for orphaned records (should be 0)
- Test frontend project detail page with 10+ objectives

---

## Post-Migration Monitoring

### Metrics to Track

**Application Metrics**:

| Metric | Target | Alert Threshold | Tool |
|--------|--------|----------------|------|
| Project list latency (p95) | < 250ms | > 500ms | Backend monitoring |
| Project detail latency (p95) | < 400ms | > 800ms | Backend monitoring |
| Create project latency (p95) | < 200ms | > 500ms | Backend monitoring |
| Update project latency (p95) | < 250ms | > 600ms | Backend monitoring |
| Delete project latency (p95) | < 300ms | > 700ms | Backend monitoring |
| Error rate (all operations) | < 0.5% | > 1% | Backend monitoring |
| Throughput (req/s) | > 50 | < 20 | Backend monitoring |

**Data Metrics**:

| Metric | Target | Alert Threshold | Tool |
|--------|--------|----------------|------|
| Project count (daily) | Stable ± 5% | > 10% change | Automated script |
| Orphaned objectives | 0 | > 0 | Daily reconciliation |
| Orphaned steps | 0 | > 0 | Daily reconciliation |
| Orphaned images | 0 | > 0 | Daily reconciliation |
| Missing sales entries (fixed-price) | 0 | > 0 | Daily reconciliation |
| Missing sales entries (subscription) | 0 | > 0 | Daily reconciliation |

**User Metrics**:

| Metric | Target | Alert Threshold | Tool |
|--------|--------|----------------|------|
| User-reported bugs | < 2/week | > 5/week | Support tickets |
| User satisfaction | > 4/5 | < 3/5 | User survey |
| Project operation success rate | > 99% | < 95% | Backend logs |

### Monitoring Dashboard

**Create Grafana/Supabase Dashboard with Panels**:

**Panel 1: Project Operations Latency**
- Line chart: p50, p95, p99 latency over time
- Breakdown by operation type (list, detail, create, update, delete)

**Panel 2: Error Rate**
- Line chart: error rate over time
- Breakdown by error type (4xx, 5xx, validation, business logic)

**Panel 3: Throughput**
- Line chart: requests per second
- Breakdown by operation type

**Panel 4: Data Integrity**
- Gauge: Count of orphaned records (should be 0)
- Table: Recent orphaned record detections

**Panel 5: Business Logic Health**
- Gauge: Fixed-price projects with missing sales entries (should be 0)
- Gauge: Subscription projects with missing sales entries (should be 0)

### Alerting Rules

**Critical Alerts** (immediate action required):

```yaml
- name: project_api_error_rate_high
  condition: error_rate > 5%
  window: 5 minutes
  action: Slack @engineering, PagerDuty

- name: project_api_latency_critical
  condition: p95_latency > 2000ms
  window: 5 minutes
  action: Slack @engineering

- name: orphaned_records_detected
  condition: orphaned_count > 0
  window: 1 hour
  action: Slack @engineering, Email @product

- name: business_logic_failure
  condition: missing_sales_entries > 0
  window: 1 day
  action: Slack @engineering, Email @product
```

**Warning Alerts** (investigate within 24 hours):

```yaml
- name: project_api_latency_degraded
  condition: p95_latency > 500ms
  window: 15 minutes
  action: Slack @engineering

- name: project_count_unusual_change
  condition: abs(daily_change) > 10%
  window: 1 day
  action: Slack @engineering
```

---

## Success Criteria

### Migration Success Checklist

**Pre-Migration**:
- [ ] Backend schema changes deployed and verified
- [ ] RLS policies implemented and tested
- [ ] All backend API endpoints implemented and passing tests
- [ ] Business logic triggers implemented and tested
- [ ] Migration script tested successfully on staging
- [ ] Pre-migration validation passed (no errors)
- [ ] Customers and teams migrations completed

**Migration Execution**:
- [ ] FileMaker data exported successfully (6 entity types)
- [ ] Data transformation completed without errors
- [ ] Validation passed (UUIDs, FKs, business rules)
- [ ] Data imported to Supabase (staging and production)
- [ ] Post-migration reconciliation shows 100% data integrity
- [ ] All foreign key constraints satisfied
- [ ] No orphaned records detected (objectives, steps, images, links, notes)
- [ ] Business logic executed: fixed-price sales entries generated
- [ ] Business logic executed: subscription sales entries generated

**Post-Migration**:
- [ ] Feature flag enabled for 100% of users
- [ ] Error rate < 0.5% for all project operations
- [ ] Performance targets met (p95 latency < 400ms for detail)
- [ ] No orphaned records detected (verified daily)
- [ ] Business logic functioning correctly (sales entries accurate)
- [ ] No critical user-reported bugs
- [ ] RLS policies enforced (verified with cross-org tests)
- [ ] Rollback procedure tested and documented

**Cleanup**:
- [ ] FileMaker code removed from codebase
- [ ] Documentation updated
- [ ] FileMaker data archived (90-day retention)
- [ ] Build succeeds with no errors or warnings
- [ ] Post-migration review completed

### Quantitative Success Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Data migration completeness | 100% | ___ | ⏳ |
| Data accuracy (spot-check) | 100% | ___ | ⏳ |
| Project operations success rate | > 99% | ___ | ⏳ |
| Error rate | < 0.5% | ___ | ⏳ |
| p95 latency (list) | < 250ms | ___ | ⏳ |
| p95 latency (detail) | < 400ms | ___ | ⏳ |
| Orphaned records | 0 | ___ | ⏳ |
| Business logic accuracy | 100% | ___ | ⏳ |
| User satisfaction | > 4/5 | ___ | ⏳ |
| Rollback time (if needed) | < 15 minutes | ___ | ⏳ |

**Sign-off Criteria**:
- All targets met for 1 week consecutively
- No critical bugs or data loss
- Team consensus on migration success

---

## Team Responsibilities

### Backend Team

**Responsibilities**:
- Implement database schema changes (missing columns and tables)
- Implement RLS policies for all 7 project-related tables
- Implement backend API endpoints (24 endpoints per api-contracts.md)
- Implement business logic triggers (fixed-price/subscription sales generation)
- Write and test migration scripts (export, transform, import)
- Test on staging environment
- Monitor backend performance and errors
- Respond to backend alerts

**Key Contacts**:
- Backend Lead: [Name]
- Database Admin: [Name]

**Communication**:
- Daily standups during migration period (Weeks 1-8)
- Slack channel: #projects-migration

### Frontend Team

**Responsibilities**:
- Implement feature flag routing (VITE_USE_SUPABASE_PROJECTS)
- Update API layer to call backend endpoints
- Remove FileMaker-specific code (recordId handling)
- Update state management for Supabase data structures
- Test all user workflows (projects, objectives, steps, images, links, notes)
- Monitor frontend errors
- Respond to frontend alerts

**Key Contacts**:
- Frontend Lead: [Name]

**Communication**:
- Daily standups during migration period (Weeks 4-8)
- Slack channel: #projects-migration

### Product Team

**Responsibilities**:
- Define success criteria
- Coordinate rollout schedule
- Collect user feedback
- Triage user-reported issues
- Make go/no-go decisions for gradual rollout phases
- Sign off on migration completion

**Key Contacts**:
- Product Manager: [Name]

**Communication**:
- Weekly sync meetings
- Slack channel: #projects-migration

### DevOps Team

**Responsibilities**:
- Set up monitoring dashboards (Grafana/Supabase)
- Configure alerting rules (critical and warning)
- Manage environment variables (VITE_USE_SUPABASE_PROJECTS)
- Coordinate deployments (backend, frontend)
- Provide rollback support (if needed)

**Key Contacts**:
- DevOps Lead: [Name]

**Communication**:
- On-demand support during migration
- Slack channel: #devops

---

## Appendix: Related Documentation

### Migration Analysis Documents

- [README.md](./README.md) - Projects feature overview and user flows
- [Current Implementation](./current-implementation.md) - Frontend call graph and FileMaker integration
- [Data Model Mapping](./data-model-mapping.md) - Field-by-field FileMaker to Supabase mapping (7 layouts)
- [API Contracts](./api-contracts.md) - Backend API specifications (24 endpoints)
- [Authorization](./authorization.md) - RLS policies and permissions (7 tables)
- [Acceptance Criteria](./acceptance-criteria.md) - Test cases (180+ tests)
- [Workflows](./workflows.md) - Mermaid diagrams (5 workflows)

### Project Documentation

- [CLAUDE.md](../../CLAUDE.md) - Project overview and Backend Change Protocol
- [README.md](../../README.md) - General project information
- [BACKEND_INTEGRATION_GUIDE.md](../../BACKEND_INTEGRATION_GUIDE.md) - Backend API integration patterns

### Code References

**Frontend Implementation**:
- `src/hooks/useProject.js` (582 lines) - Project CRUD operations hook
- `src/services/projectService.js` (596 lines) - Business logic and data processing
- `src/api/projects.js` - FileMaker API layer (to be replaced)
- `src/components/projects/ProjectDetails.jsx` - Main project UI
- `src/components/projects/ProjectObjectivesTab.jsx` - Objectives management
- `src/components/projects/ProjectLinksTab.jsx` - Links management
- `src/components/projects/ProjectImagesTab.jsx` - Images management
- `src/components/projects/ProjectNotesTab.jsx` - Notes management

**Business Logic**:
- `src/services/projectService.js:508-596` - processProjectValue (fixed-price and subscription)
- `src/hooks/useProject.js:186-264` - handleCreateProject with pricing logic
- `src/services/billableHoursService.js:288-309` - Time record calculations

---

## Document Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-10 | Claude Agent | Initial comprehensive migration plan document with Executive Summary, Data Backfill Strategy, Performance Benchmarks, Risk Assessment, Post-Migration Monitoring, and Team Responsibilities |

---

**Document Status**: ✅ Complete and ready for review

**Next Steps**:
1. Review migration plan with backend team
2. Create backend change request document (BACKEND_CHANGE_REQUEST_003_PROJECTS_MIGRATION.md)
3. Get backend team approval for schema changes and API endpoints
4. Begin Phase 1: Backend Preparation
