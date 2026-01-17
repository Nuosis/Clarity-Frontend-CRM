# Notes - Migration Plan

## Overview

This document outlines the strategy for migrating the Notes feature from FileMaker to Supabase, including data export, ID mapping, parent entity detection, bulk insert, validation, rollback procedures, and cutover approach.

**Current State:** Notes stored in FileMaker `devNotes` layout with polymorphic `_fkID` relationship to projects and tasks.

**Target State:** Notes stored in Supabase `notes` table with explicit foreign keys, organization scoping, and full CRUD support.

**Migration Complexity:** Medium - Requires parent entity type detection from `_fkID` values and organization inference from parent entities.

## Migration Dependencies

**CRITICAL:** Notes migration MUST occur AFTER these entities are migrated to Supabase:
1. ✅ **Organizations** - Required for `organization_id` field
2. ✅ **Customers** - Notes can reference customers (schema supports, not currently used in UI)
3. ✅ **Projects** - Most notes are attached to projects
4. ✅ **Tasks** - Many notes are attached to tasks
5. ✅ **Users (auth.users)** - Required for `created_by` field mapping

**Verification Before Migration:**
```bash
# Verify parent entities exist in Supabase
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT COUNT(*) FROM public.organizations;\""
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT COUNT(*) FROM public.customers;\""
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT COUNT(*) FROM public.projects;\""
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT COUNT(*) FROM public.tasks;\""
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT COUNT(*) FROM auth.users;\""
```

## Data Export Process from FileMaker

### Export Strategy

**Method:** FileMaker Data API via frontend codebase
**Format:** JSON intermediate files for validation
**Approach:** Full extract, no incremental updates

### Export Script

```javascript
// scripts/export-notes-from-filemaker.js
import { fetchDataFromFileMaker } from '../src/api/fileMaker.js';
import fs from 'fs';

async function exportNotes() {
  console.log('Starting FileMaker notes export...');

  // Export all notes from devNotes layout
  const notesResponse = await fetchDataFromFileMaker({
    layout: 'devNotes',
    action: 'READ',
    query: []  // All records
  });

  const notes = notesResponse.response?.data || [];

  console.log(`Exported ${notes.length} notes from FileMaker`);

  // Save to JSON for validation and transformation
  const exportData = {
    exported_at: new Date().toISOString(),
    total_records: notes.length,
    notes: notes.map(note => ({
      // FileMaker fields
      __ID: note.fieldData.__ID,
      note: note.fieldData.note,
      _fkID: note.fieldData._fkID,
      type: note.fieldData.type || 'general',
      creationTimestamp: note.fieldData['~CreationTimestamp'],
      modificationTimestamp: note.fieldData['~ModificationTimestamp'],
      createdBy: note.fieldData['~CreatedBy'],
      recordId: note.recordId
    }))
  };

  // Write to file
  const exportPath = 'migration-data/notes-export.json';
  fs.mkdirSync('migration-data', { recursive: true });
  fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));

  console.log(`Export saved to: ${exportPath}`);

  // Generate summary statistics
  const stats = {
    total_notes: exportData.notes.length,
    with_type: exportData.notes.filter(n => n.type && n.type !== 'general').length,
    with_creator: exportData.notes.filter(n => n.createdBy).length,
    empty_content: exportData.notes.filter(n => !n.note || !n.note.trim()).length,
    unique_fkids: new Set(exportData.notes.map(n => n._fkID)).size,
    earliest_date: exportData.notes.reduce((min, n) =>
      !min || n.creationTimestamp < min ? n.creationTimestamp : min, null),
    latest_date: exportData.notes.reduce((max, n) =>
      !max || n.creationTimestamp > max ? n.creationTimestamp : max, null)
  };

  console.log('\nExport Statistics:');
  console.log(JSON.stringify(stats, null, 2));

  // Save stats
  fs.writeFileSync('migration-data/notes-export-stats.json', JSON.stringify(stats, null, 2));

  return { exportData, stats };
}

exportNotes().catch(console.error);
```

### Export Validation

**Pre-Export Checks:**
- [ ] FileMaker server accessible
- [ ] API credentials valid
- [ ] Sufficient disk space for export files
- [ ] devNotes layout accessible

**Post-Export Validation:**
```javascript
// Validation checks
const validationErrors = [];

// 1. Check for missing IDs
exportData.notes.forEach((note, index) => {
  if (!note.__ID) {
    validationErrors.push({ index, error: 'Missing __ID', note });
  }
  if (!note._fkID) {
    validationErrors.push({ index, error: 'Missing _fkID (parent ID)', note });
  }
});

// 2. Check for empty content
const emptyNotes = exportData.notes.filter(n => !n.note || !n.note.trim());
if (emptyNotes.length > 0) {
  console.warn(`Found ${emptyNotes.length} notes with empty content - will be excluded`);
}

// 3. Check UUID format
const invalidUUIDs = exportData.notes.filter(n =>
  !isValidUUID(n.__ID)
);
if (invalidUUIDs.length > 0) {
  console.warn(`Found ${invalidUUIDs.length} notes with invalid UUID format - will generate new IDs`);
}

// 4. Check timestamp format
const invalidTimestamps = exportData.notes.filter(n =>
  !n.creationTimestamp || isNaN(Date.parse(n.creationTimestamp))
);
if (invalidTimestamps.length > 0) {
  console.warn(`Found ${invalidTimestamps.length} notes with invalid timestamps`);
}

// Report validation results
if (validationErrors.length > 0) {
  console.error(`Export validation failed with ${validationErrors.length} errors`);
  fs.writeFileSync('migration-data/export-validation-errors.json',
    JSON.stringify(validationErrors, null, 2));
  throw new Error('Export validation failed');
}

console.log('✅ Export validation passed');
```

## ID Mapping Strategy

### FileMaker _fkID → Supabase Parent Entity Detection

**Challenge:** FileMaker uses a single `_fkID` field that can reference projects, tasks, or customers. We need to determine the entity type and map to the correct Supabase foreign key.

**Detection Algorithm:**

```javascript
// ID mapping and parent detection
async function detectParentEntity(fkId, supabase) {
  // Strategy 1: Check projects first (most common)
  const { data: project } = await supabase
    .from('projects')
    .select('id, organization_id')
    .eq('id', fkId)
    .maybeSingle();

  if (project) {
    return {
      entity_type: 'project',
      project_id: fkId,
      customer_id: null,
      task_id: null,
      organization_id: project.organization_id
    };
  }

  // Strategy 2: Check tasks
  const { data: task } = await supabase
    .from('tasks')
    .select('id, project_id, projects!inner(organization_id)')
    .eq('id', fkId)
    .maybeSingle();

  if (task) {
    return {
      entity_type: 'task',
      project_id: null,
      customer_id: null,
      task_id: fkId,
      organization_id: task.projects.organization_id
    };
  }

  // Strategy 3: Check customers
  const { data: customer } = await supabase
    .from('customers')
    .select('id, organization_id')
    .eq('id', fkId)
    .maybeSingle();

  if (customer) {
    return {
      entity_type: 'customer',
      project_id: null,
      customer_id: fkId,
      task_id: null,
      organization_id: customer.organization_id
    };
  }

  // Not found - orphaned note
  return {
    entity_type: 'orphaned',
    project_id: null,
    customer_id: null,
    task_id: null,
    organization_id: null,
    orphaned_fkid: fkId
  };
}
```

### User Email → UUID Mapping

**Challenge:** FileMaker `~CreatedBy` field stores email addresses. Supabase `created_by` requires UUID references to `auth.users`.

**Mapping Strategy:**

```javascript
// Build user email → UUID lookup table
async function buildUserMapping(supabase) {
  const { data: users, error } = await supabase.auth.admin.listUsers();

  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  const emailToUUID = new Map();
  users.users.forEach(user => {
    emailToUUID.set(user.email.toLowerCase(), user.id);
  });

  console.log(`Built user mapping for ${emailToUUID.size} users`);
  return emailToUUID;
}

// Map creator email to UUID
function mapCreator(createdByEmail, emailToUUID, migrationUserId) {
  if (!createdByEmail) {
    return migrationUserId;  // Fallback to migration user
  }

  const normalizedEmail = createdByEmail.toLowerCase().trim();
  const userId = emailToUUID.get(normalizedEmail);

  if (userId) {
    return userId;
  }

  console.warn(`User not found for email: ${createdByEmail} - using migration user`);
  return migrationUserId;
}
```

### ID Preservation vs Generation

**FileMaker `__ID` → Supabase `id`:**

**Strategy:**
- **IF** FileMaker `__ID` is valid UUID v4 → preserve as Supabase `id`
- **ELSE** generate new UUID → log mapping in `id_mapping` table

```javascript
function preserveOrGenerateId(fmId) {
  // UUID v4 regex
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (uuidPattern.test(fmId)) {
    return {
      id: fmId,
      preserved: true
    };
  } else {
    const newId = crypto.randomUUID();
    return {
      id: newId,
      preserved: false,
      original_id: fmId
    };
  }
}
```

**ID Mapping Table** (for non-UUID FileMaker IDs):

```sql
-- Optional: Track ID changes
CREATE TABLE IF NOT EXISTS migration.note_id_mapping (
  filemaker_id TEXT PRIMARY KEY,
  supabase_id UUID NOT NULL,
  migrated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Transformation Process

### Step-by-Step Transformation

See migration script in appendix for complete implementation. Key transformation steps:

1. **Validate note content** - Reject empty or whitespace-only notes
2. **Detect parent entity** - Map `_fkID` to project/task/customer
3. **Derive organization** - Inherit from parent entity
4. **Preserve or generate ID** - Keep valid UUIDs, generate new for invalid
5. **Map creator email → UUID** - Look up user, fallback to migration user
6. **Convert timestamps** - FileMaker datetime → ISO 8601 UTC
7. **Build transformed record** - Assemble complete Supabase note object

**Expected Transformation Rate:**
- ✅ Valid notes: ~95%
- ⚠️ Orphaned (no parent): ~3-5%
- ❌ Invalid (empty content, etc.): ~0-2%

## Bulk Insert Approach

### Batch Insert Strategy

**Batch Size:** 500 records per insert
**Concurrency:** Sequential batches (avoid overwhelming database)
**Error Handling:** Retry failed batches with exponential backoff

**Performance Targets:**
- 500 records per batch
- ~1 second pause between batches
- ~30-60 minutes total load time (depends on total record count)

**Retry Logic:**
- 3 retry attempts per failed batch
- Exponential backoff: 2^attempt seconds
- Log persistent failures for manual review

See appendix for complete bulk insert implementation.

## Validation Steps

### Post-Migration Validation Checklist

**1. Record Count Verification**
- Compare Supabase count to expected transformation count
- Variance tolerance: 0% (must match exactly)

**2. Foreign Key Integrity Verification**
- Check for orphaned notes (no parent FK) → should be 0
- Check for notes with multiple parents → should be 0
- Verify parent entities exist

**3. Organization Scoping Verification**
- Check for notes without `organization_id` → should be 0
- Verify `organization_id` matches parent entity's organization

**4. Data Content Verification**
- Sample 100 random notes
- Compare content between FileMaker export and Supabase
- Acceptance: > 99% match rate

**5. RLS Policy Verification**
- Manual testing required in staging environment
- Verify cross-org access denied
- Verify users can only create notes on accessible entities

See appendix for complete validation scripts.

## Security Considerations

### Service Role Key Protection

⚠️ **CRITICAL SECURITY WARNING**

Migration scripts use `VITE_SUPABASE_SERVICE_ROLE_KEY` which bypasses ALL Row-Level Security (RLS) policies and grants UNRESTRICTED DATABASE ACCESS across all organizations.

**Security Requirements:**

1. **Environment Restrictions**
   - ✅ ONLY run in secure backend environments (SSH, local dev, CI/CD)
   - ❌ NEVER run in browser/frontend contexts
   - ❌ NEVER deploy to publicly accessible environments
   - ❌ NEVER commit scripts with hardcoded service role keys

2. **Browser Detection Guards**
   - All migration scripts MUST include `if (typeof window !== 'undefined')` checks
   - Scripts will throw errors if executed in browser contexts
   - Prevents accidental frontend deployment

3. **Environment Variable Validation**
   - Scripts MUST validate `SUPABASE_SERVICE_ROLE_KEY` exists before execution
   - Keys MUST be stored in `.env` file (excluded from git)
   - Scripts will exit with security error if key is missing

4. **Migration Data Protection**
   - Output files in `migration-data/` directory contain sensitive data
   - Directory MUST be in `.gitignore` (excluded from version control)
   - Delete output files after migration completes and validation passes
   - Never share migration outputs containing production data

5. **Post-Migration Key Rotation**
   - Generate new service role key in Supabase dashboard after migration
   - Update backend `.env` and restart services
   - Invalidate old service role key
   - Document rotation in security changelog

**Security Incident Response:**

If service role key is exposed:
1. Rotate key immediately (Supabase Dashboard → Settings → API)
2. Invalidate compromised key
3. Update all environments (backend, local dev, CI/CD)
4. Audit database access logs for unauthorized activity
5. Notify security team and assess data exposure

**For comprehensive security requirements, see:** `docs/MIGRATION_SCRIPTS_SECURITY.md`

---

## Rollback Plan

### Pre-Rollback Snapshot

```sql
-- Before migration, create backup of existing data (if any)
CREATE TABLE IF NOT EXISTS migration.notes_backup AS
SELECT * FROM public.notes;

-- Track migration metadata
CREATE TABLE IF NOT EXISTS migration.migration_log (
  id SERIAL PRIMARY KEY,
  migration_name TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('in_progress', 'completed', 'rolled_back', 'failed')),
  records_migrated INTEGER,
  notes TEXT
);

INSERT INTO migration.migration_log (migration_name, status)
VALUES ('notes-filemaker-to-supabase', 'in_progress')
RETURNING id;
```

### Rollback Scenarios

**Scenario 1: Migration Script Fails Mid-Process**
- Stop migration immediately
- Delete all migrated notes from Supabase
- Verify cleanup (count should be 0)
- Fix migration script issues
- Re-test in dev environment
- Re-run migration

**Scenario 2: Frontend Deployment Fails**
- Revert frontend to previous version
- Notes migration data remains in Supabase (safe, unused)
- Frontend continues using FileMaker bridge
- No data loss
- Re-attempt frontend deployment after fixing issues

**Scenario 3: Data Corruption Detected Post-Migration**
- Restore from `migration.notes_backup` if backup exists
- Otherwise, rollback to FileMaker and re-run migration

**Scenario 4: Production Issues After Deployment**
- DO NOT delete migrated data (may contain new notes created post-migration)
- Revert frontend to FileMaker mode via feature flag (if implemented)
- Assess issue severity and data impact
- Fix issues and re-deploy or coordinate dual-write strategy

See appendix for complete rollback scripts.

## Cutover Strategy

### Recommended Approach: Big Bang Migration

**Rationale:**
- Notes are simple, append-mostly data
- No complex business logic or workflows
- Clean cutover reduces complexity
- Downtime window is acceptable (2-3 hours)

### Cutover Timeline

**Friday Evening Deployment**

| Time | Duration | Activity | Owner |
|------|----------|----------|-------|
| 6:00 PM | 15 min | Announce maintenance window, disable note creation in UI | Frontend Team |
| 6:15 PM | 30 min | Deploy backend schema, indexes, RLS policies | Backend Team |
| 6:45 PM | 10 min | Verify backend deployment, run health checks | Backend Team |
| 6:55 PM | 60 min | Run migration script (export, transform, load, validate) | Data Team |
| 7:55 PM | 15 min | Post-migration validation (counts, FKs, org scoping) | Data Team |
| 8:10 PM | 20 min | Deploy frontend with Supabase integration | Frontend Team |
| 8:30 PM | 20 min | Smoke tests (create, view, update, delete notes) | QA Team |
| 8:50 PM | 10 min | Re-enable note creation, open to users | Frontend Team |
| 9:00 PM | 60 min | Monitor logs, metrics, user feedback | All Teams |
| 10:00 PM | - | Migration complete, on-call monitoring | DevOps |

**Total Downtime:** ~3 hours (6:00 PM - 9:00 PM)
**Rollback Decision Point:** 8:10 PM (before frontend deployment)

### Pre-Cutover Checklist

**1 Week Before:**
- [ ] Backend schema deployed to staging
- [ ] Migration script tested in staging with production data copy
- [ ] Frontend refactor completed and tested in staging
- [ ] RLS policies tested with multi-tenant data
- [ ] Performance benchmarks meet targets
- [ ] Rollback procedures documented and tested
- [ ] **SECURITY:** Service role key rotation scheduled post-migration

**1 Day Before:**
- [ ] Production database backup completed
- [ ] Migration scripts reviewed and approved
- [ ] Deployment runbook finalized
- [ ] Team roles and responsibilities assigned
- [ ] Communication sent to users (maintenance window notice)
- [ ] Monitoring dashboards configured
- [ ] On-call schedule confirmed
- [ ] **SECURITY:** Verified `.gitignore` includes `migration-data/` directory
- [ ] **SECURITY:** Verified no service role keys in git history
- [ ] **SECURITY:** Migration scripts include browser detection guards

**Day Of (6:00 PM):**
- [ ] All team members online and ready
- [ ] Slack/Teams channel active for coordination
- [ ] Database connections tested
- [ ] FileMaker API accessible
- [ ] Supabase service role key verified (in backend `.env` only)
- [ ] Frontend build prepared and ready to deploy
- [ ] **SECURITY:** Confirmed migration will run in secure backend environment
- [ ] **SECURITY:** Confirmed migration data outputs will be deleted after validation

### Success Criteria

Migration is successful when:
- [ ] 100% of valid FileMaker notes migrated to Supabase
- [ ] Orphaned notes documented and reviewed (< 5% of total)
- [ ] Record counts match expected values
- [ ] Foreign key integrity verified (0 orphaned notes in Supabase)
- [ ] Organization scoping enforced (RLS policies working)
- [ ] Frontend fully functional with Supabase backend
- [ ] API response times meet targets (< 500ms)
- [ ] Zero critical bugs in production
- [ ] User acceptance confirmed (no complaints about missing/incorrect notes)

## Performance Targets

### Migration Performance

| Operation | Target | Maximum |
|-----------|--------|---------|
| FileMaker export | < 10 minutes | < 20 minutes |
| Data transformation | < 15 minutes | < 30 minutes |
| Supabase bulk load | < 20 minutes | < 45 minutes |
| Post-migration validation | < 10 minutes | < 15 minutes |
| **Total migration time** | **< 60 minutes** | **< 120 minutes** |

### Runtime Performance (Post-Migration)

| Operation | Target | Maximum |
|-----------|--------|---------|
| List project notes | < 200ms | < 500ms |
| List task notes | < 200ms | < 500ms |
| Create note | < 250ms | < 400ms |
| Update note | < 250ms | < 400ms |
| Delete note | < 200ms | < 300ms |
| Search notes by content | < 500ms | < 1000ms |

## Timeline Estimate

**Total Duration:** 4-6 weeks

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| **Phase 1: Backend Implementation** | 2-3 weeks | None |
| - Schema creation | 3 days | - |
| - RLS policies | 3 days | Schema |
| - API endpoints | 5 days | Schema, RLS |
| - Testing | 3-5 days | All backend work |
| **Phase 2: Migration Script Development** | 1-2 weeks | Backend API complete |
| - Export script | 2 days | FileMaker access |
| - Transform script | 3 days | Schema knowledge |
| - Load script | 2 days | Supabase access |
| - Validation scripts | 2-3 days | All scripts |
| **Phase 3: Frontend Refactor** | 1 week | Backend API ready |
| - API layer update | 2 days | API contracts |
| - Service layer update | 2 days | API layer |
| - Component updates | 2 days | Service layer |
| - Testing | 1 day | All frontend work |
| **Phase 4: Testing & Validation** | 1 week | All development complete |
| - Staging migration | 1 day | Migration scripts |
| - Integration testing | 2 days | Frontend + Backend |
| - Performance testing | 1 day | Data loaded |
| - Security testing | 1 day | RLS policies |
| - UAT | 2 days | All testing |
| **Phase 5: Production Deployment** | 1 day | Testing passed |
| - Production migration | 3 hours | Migration scripts |
| - Frontend deployment | 1 hour | Refactor complete |
| - Smoke testing | 1 hour | Deployment complete |
| - Monitoring | Ongoing | - |

**Critical Path:** Backend Implementation → Migration Scripts → Frontend Refactor → Deployment

**Parallel Work Opportunities:**
- Frontend refactor can start once API contracts are defined (Phase 1, week 2)
- Migration scripts can be developed during backend implementation
- Testing can begin during frontend development

---

## Appendix A: Complete Migration Scripts

### Export Script

See "Data Export Process from FileMaker" section for complete export script.

### Transform Script

```javascript
// scripts/transform-notes.js
/**
 * ⚠️ SECURITY WARNING ⚠️
 *
 * This script uses SUPABASE_SERVICE_ROLE_KEY which bypasses ALL Row-Level
 * Security (RLS) policies and grants UNRESTRICTED DATABASE ACCESS.
 *
 * CRITICAL: This script MUST ONLY run in secure backend environments.
 * NEVER run in browser/frontend contexts or publicly accessible servers.
 *
 * For security requirements, see: docs/MIGRATION_SCRIPTS_SECURITY.md
 */

// SECURITY: Prevent execution in browser contexts
if (typeof window !== 'undefined') {
  throw new Error(
    'SECURITY ERROR: Migration scripts cannot run in browser environments. ' +
    'Service role key exposure would grant unrestricted database access.'
  );
}

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

async function transformNotes() {
  console.log('Starting notes transformation...');

  // Load exported data
  const exportData = JSON.parse(fs.readFileSync('migration-data/notes-export.json'));

  // Initialize Supabase with service role key (bypasses RLS)
  // SECURITY: This client has unrestricted access - use only in backend
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Build user email → UUID mapping
  const emailToUUID = await buildUserMapping(supabase);

  // Get migration user ID (fallback for unmapped creators)
  const migrationUserId = process.env.MIGRATION_USER_ID ||
    emailToUUID.get('migration@claritybusinesssolutions.ca');

  // Transform each note
  const transformedNotes = [];
  const orphanedNotes = [];
  const invalidNotes = [];
  const idMappings = [];

  for (const fmNote of exportData.notes) {
    try {
      // 1. Validate note content
      if (!fmNote.note || !fmNote.note.trim()) {
        invalidNotes.push({ reason: 'Empty content', fmNote });
        continue;
      }

      // 2. Detect parent entity and get organization
      const parentInfo = await detectParentEntity(fmNote._fkID, supabase);

      if (parentInfo.entity_type === 'orphaned') {
        orphanedNotes.push({ fmNote, orphaned_fkid: fmNote._fkID });
        continue;
      }

      // 3. Preserve or generate ID
      const idResult = preserveOrGenerateId(fmNote.__ID);
      if (!idResult.preserved) {
        idMappings.push({
          filemaker_id: fmNote.__ID,
          supabase_id: idResult.id
        });
      }

      // 4. Map creator email to UUID
      const createdBy = mapCreator(fmNote.createdBy, emailToUUID, migrationUserId);

      // 5. Convert timestamps
      const createdAt = convertFileMakerTimestamp(fmNote.creationTimestamp);
      const updatedAt = convertFileMakerTimestamp(fmNote.modificationTimestamp);

      // 6. Build transformed note
      const transformedNote = {
        id: idResult.id,
        organization_id: parentInfo.organization_id,
        note: fmNote.note.trim(),
        type: fmNote.type || 'general',
        customer_id: parentInfo.customer_id,
        project_id: parentInfo.project_id,
        task_id: parentInfo.task_id,
        created_at: createdAt,
        updated_at: updatedAt,
        created_by: createdBy,
        updated_by: createdBy  // Initially same as created_by
      };

      transformedNotes.push(transformedNote);

    } catch (error) {
      invalidNotes.push({ reason: error.message, fmNote });
    }
  }

  // Save transformation results
  const transformResult = {
    transformed_at: new Date().toISOString(),
    total_exported: exportData.notes.length,
    successfully_transformed: transformedNotes.length,
    orphaned_count: orphanedNotes.length,
    invalid_count: invalidNotes.length,
    id_mappings_count: idMappings.length,
    notes: transformedNotes,
    orphaned_notes: orphanedNotes,
    invalid_notes: invalidNotes,
    id_mappings: idMappings
  };

  fs.writeFileSync('migration-data/notes-transformed.json',
    JSON.stringify(transformResult, null, 2));

  console.log(`\nTransformation Summary:`);
  console.log(`  ✅ Transformed: ${transformedNotes.length}`);
  console.log(`  ⚠️  Orphaned: ${orphanedNotes.length}`);
  console.log(`  ❌ Invalid: ${invalidNotes.length}`);
  console.log(`  🔄 ID Mappings: ${idMappings.length}`);

  // Fail if too many orphaned/invalid notes
  const failureRate = (orphanedNotes.length + invalidNotes.length) / exportData.notes.length;
  if (failureRate > 0.05) {  // More than 5% failure
    throw new Error(`Transformation failure rate too high: ${(failureRate * 100).toFixed(2)}%`);
  }

  return transformResult;
}

// Timestamp conversion helper
function convertFileMakerTimestamp(fmTimestamp) {
  if (!fmTimestamp) {
    return new Date().toISOString();
  }

  try {
    const date = new Date(fmTimestamp);
    if (isNaN(date.getTime())) {
      console.warn(`Invalid timestamp: ${fmTimestamp} - using current time`);
      return new Date().toISOString();
    }
    return date.toISOString();
  } catch (error) {
    console.warn(`Failed to parse timestamp: ${fmTimestamp} - using current time`);
    return new Date().toISOString();
  }
}

transformNotes().catch(console.error);
```

### Load Script

```javascript
// scripts/load-notes-to-supabase.js
/**
 * ⚠️ SECURITY WARNING ⚠️
 *
 * This script uses SUPABASE_SERVICE_ROLE_KEY which bypasses ALL Row-Level
 * Security (RLS) policies and grants UNRESTRICTED DATABASE ACCESS.
 *
 * CRITICAL: This script MUST ONLY run in secure backend environments.
 * NEVER run in browser/frontend contexts or publicly accessible servers.
 *
 * For security requirements, see: docs/MIGRATION_SCRIPTS_SECURITY.md
 */

// SECURITY: Prevent execution in browser contexts
if (typeof window !== 'undefined') {
  throw new Error(
    'SECURITY ERROR: Migration scripts cannot run in browser environments. ' +
    'Service role key exposure would grant unrestricted database access.'
  );
}

async function loadNotesToSupabase() {
  console.log('Starting Supabase load...');

  const transformResult = JSON.parse(fs.readFileSync('migration-data/notes-transformed.json'));
  const notes = transformResult.notes;

  // SECURITY: This client has unrestricted access - use only in backend
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Batch configuration
  const BATCH_SIZE = 500;
  const batches = [];
  for (let i = 0; i < notes.length; i += BATCH_SIZE) {
    batches.push(notes.slice(i, i + BATCH_SIZE));
  }

  console.log(`Processing ${notes.length} notes in ${batches.length} batches`);

  // Process batches sequentially
  let successCount = 0;
  let failureCount = 0;
  const failedBatches = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} records)...`);

    try {
      const { data, error } = await supabase
        .from('notes')
        .insert(batch);

      if (error) {
        console.error(`Batch ${i + 1} failed:`, error);
        failedBatches.push({ batchIndex: i, batch, error: error.message });
        failureCount += batch.length;
      } else {
        successCount += batch.length;
        console.log(`  ✅ Batch ${i + 1} completed`);
      }

    } catch (error) {
      console.error(`Batch ${i + 1} exception:`, error);
      failedBatches.push({ batchIndex: i, batch, error: error.message });
      failureCount += batch.length;
    }

    // Rate limiting - pause between batches
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));  // 1 second pause
    }
  }

  // Save load results
  const loadResult = {
    loaded_at: new Date().toISOString(),
    total_records: notes.length,
    successful_inserts: successCount,
    failed_inserts: failureCount,
    batches_processed: batches.length,
    failed_batches: failedBatches
  };

  fs.writeFileSync('migration-data/notes-load-result.json',
    JSON.stringify(loadResult, null, 2));

  console.log(`\nLoad Summary:`);
  console.log(`  ✅ Successful: ${successCount}`);
  console.log(`  ❌ Failed: ${failureCount}`);
  console.log(`  Success Rate: ${((successCount / notes.length) * 100).toFixed(2)}%`);

  if (failureCount > 0) {
    throw new Error(`Load completed with ${failureCount} failures`);
  }

  return loadResult;
}

loadNotesToSupabase().catch(console.error);
```

---

## Related Documentation

- **Schema Mapping:** `requirements/notes/data-model-mapping.md` - Complete schema definition and field mappings
- **API Contracts:** `requirements/notes/api-contracts.md` - Backend API endpoint specifications
- **Authorization:** `requirements/notes/authorization.md` - RLS policies and access control
- **Current Implementation:** `requirements/notes/current-implementation.md` - FileMaker implementation details
- **Acceptance Criteria:** `requirements/notes/acceptance-criteria.md` - Test cases and validation requirements

## Backend Team Action Items

### Pre-Migration Requirements

1. ✅ Create `notes` table with complete schema (see `data-model-mapping.md`)
2. ✅ Create indexes for query performance
3. ✅ Implement RLS helper functions (`auth.current_organization_id()`, etc.)
4. ✅ Create RLS policies (`notes_select_policy`, `notes_insert_policy`, etc.)
5. ✅ Create update trigger (`update_notes_updated_at()`)
6. ✅ Test RLS policies with multi-tenant data
7. ✅ Provide migration user credentials (service role key)

### Migration Support

1. ✅ Provide database backup/restore procedures
2. ✅ Assist with migration script debugging if needed
3. ✅ Monitor database performance during migration
4. ✅ Stand by for rollback support during cutover window

### Post-Migration Support

1. ✅ Monitor query performance and optimize indexes if needed
2. ✅ Assist with any data integrity issues discovered
3. ✅ Update backend documentation
4. ✅ Add migration log entry to changelog
