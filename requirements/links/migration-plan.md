# Links - Migration Plan

## Overview

This document outlines the strategy for migrating links data from FileMaker to Supabase, including export, transformation, import, and validation processes.

## Migration Prerequisites

### Backend Requirements (MUST BE COMPLETED FIRST)

1. **Schema Changes** ✅ Backend Change Request submitted
   - Add `task_id` column to `links` table
   - Make `customer_id` nullable
   - Add check constraint for exactly one parent
   - Add `created_by` and `updated_by` columns (optional)
   - Add `updated_at` trigger

2. **Dependent Migrations** ✅ Must complete before links
   - Customers migration (INS0001) - provides customer UUID mapping
   - Projects migration (INS0002) - provides project UUID mapping
   - Tasks migration (INS0003) - provides task UUID mapping

3. **API Endpoints** ✅ Backend endpoints implemented
   - POST /links - create link
   - GET /links?{parent}_id={uuid} - list by parent
   - PATCH /links/{id} - update link
   - DELETE /links/{id} - delete link

4. **RLS Policies** ✅ Row-level security configured
   - SELECT, INSERT, UPDATE, DELETE policies active
   - Organization scoping enforced

## Migration Phases

### Phase 1: Data Export from FileMaker

**Objective**: Extract all links from FileMaker `devLinks` layout

**Tools**: FileMaker Data API or export script

**Export Format**: JSON or CSV

**Export Query**:
```javascript
// FileMaker API call
{
  layout: 'devLinks',
  action: 'READ',
  query: [] // All records
}
```

**Expected Fields**:
- `__ID` - FileMaker primary key
- `link` - URL string
- `_fkID` - Parent entity FileMaker ID
- `~creationTimestamp` - Creation timestamp
- `~modificationTimestamp` - Modification timestamp
- `~CreatedBy` - Creator username

**Export Script** (example):
```javascript
// export-links.js
const fs = require('fs');
const { fetchAllFromFileMaker } = require('./filemaker-api');

async function exportLinks() {
  const links = await fetchAllFromFileMaker('devLinks');

  fs.writeFileSync(
    'filemaker-links-export.json',
    JSON.stringify(links, null, 2)
  );

  console.log(`Exported ${links.length} links`);
}

exportLinks();
```

**Validation**:
- Count total links exported
- Verify all expected fields present
- Check for NULL or missing `_fkID` values
- Identify links with invalid URLs

### Phase 2: Data Transformation and Mapping

**Objective**: Transform FileMaker data to Supabase format

**Parent Entity Type Detection**:

```javascript
// detect-parent-type.js
async function detectParentType(fkId) {
  // Check customers first
  const customer = await db.query(
    'SELECT id FROM customers WHERE filemaker_id = $1',
    [fkId]
  );
  if (customer.rows.length > 0) {
    return { type: 'customer', id: customer.rows[0].id };
  }

  // Check projects
  const project = await db.query(
    'SELECT id FROM projects WHERE filemaker_id = $1',
    [fkId]
  );
  if (project.rows.length > 0) {
    return { type: 'project', id: project.rows[0].id };
  }

  // Check tasks
  const task = await db.query(
    'SELECT id FROM tasks WHERE filemaker_id = $1',
    [fkId]
  );
  if (task.rows.length > 0) {
    return { type: 'task', id: task.rows[0].id };
  }

  // Not found
  return { type: null, id: null };
}
```

**Transformation Script**:

```javascript
// transform-links.js
const fs = require('fs');

async function transformLinks() {
  const fmLinks = JSON.parse(fs.readFileSync('filemaker-links-export.json'));
  const supabaseLinks = [];
  const orphanedLinks = [];

  for (const fmLink of fmLinks) {
    // Detect parent entity
    const parent = await detectParentType(fmLink._fkID);

    if (!parent.id) {
      orphanedLinks.push({
        fm_id: fmLink.__ID,
        link: fmLink.link,
        fk_id: fmLink._fkID
      });
      continue;
    }

    // Validate URL
    let url = fmLink.link.trim();
    if (url.length > 2048) {
      console.warn(`URL too long (${url.length} chars): ${fmLink.__ID}`);
      // Option: truncate, skip, or use URL shortener
      continue;
    }

    try {
      new URL(url);
    } catch {
      console.warn(`Invalid URL format: ${url}`);
      continue;
    }

    // Look up creator user ID (optional)
    let createdBy = null;
    if (fmLink['~CreatedBy']) {
      const user = await db.query(
        'SELECT id FROM users WHERE username = $1',
        [fmLink['~CreatedBy']]
      );
      createdBy = user.rows[0]?.id || null;
    }

    // Build Supabase record
    const supabaseLink = {
      link: url,
      [`${parent.type}_id`]: parent.id,
      created_at: new Date(fmLink['~creationTimestamp']).toISOString(),
      updated_at: new Date(fmLink['~modificationTimestamp']).toISOString(),
      created_by: createdBy
    };

    supabaseLinks.push(supabaseLink);
  }

  // Save transformed data
  fs.writeFileSync(
    'supabase-links-import.json',
    JSON.stringify(supabaseLinks, null, 2)
  );

  // Save orphaned links for review
  fs.writeFileSync(
    'orphaned-links.json',
    JSON.stringify(orphanedLinks, null, 2)
  );

  console.log(`Transformed ${supabaseLinks.length} links`);
  console.log(`Found ${orphanedLinks.length} orphaned links`);
}

transformLinks();
```

**Orphaned Links Handling**:
- Log all links where `_fkID` doesn't match any entity
- Review manually - may reference deleted entities
- Options:
  1. Skip (don't migrate)
  2. Assign to a default customer
  3. Create placeholder entities
  4. Contact users for resolution

### Phase 3: Data Import to Supabase

**Objective**: Bulk insert transformed links into Supabase

**Import Methods**:

**Option 1: SQL COPY** (fastest for large datasets)
```bash
# Export to CSV
node transform-links.js --format csv

# Import via psql
psql -U postgres -d clarity_db -c "\\COPY links (link, customer_id, project_id, task_id, created_at, updated_at, created_by) FROM 'supabase-links-import.csv' WITH CSV HEADER;"
```

**Option 2: Batch Insert** (better error handling)
```javascript
// import-links.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function importLinks() {
  const links = JSON.parse(fs.readFileSync('supabase-links-import.json'));

  const batchSize = 100;
  let imported = 0;
  let failed = 0;

  for (let i = 0; i < links.length; i += batchSize) {
    const batch = links.slice(i, i + batchSize);

    const { data, error } = await supabase
      .from('links')
      .insert(batch);

    if (error) {
      console.error(`Batch ${i}-${i+batchSize} failed:`, error);
      failed += batch.length;

      // Retry individually to identify problematic records
      for (const link of batch) {
        const { error: singleError } = await supabase
          .from('links')
          .insert([link]);

        if (singleError) {
          console.error(`Failed to import link:`, link, singleError);
        } else {
          imported++;
        }
      }
    } else {
      imported += batch.length;
    }

    console.log(`Progress: ${imported}/${links.length}`);
  }

  console.log(`Import complete: ${imported} success, ${failed} failed`);
}

importLinks();
```

**Option 3: API Endpoint** (slowest, but uses production code)
```javascript
// import-via-api.js
async function importViaAPI() {
  const links = JSON.parse(fs.readFileSync('supabase-links-import.json'));

  for (const link of links) {
    const authHeader = await generateBackendAuthHeader();

    try {
      const response = await fetch('https://api.claritybusinesssolutions.ca/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify(link)
      });

      if (!response.ok) {
        console.error(`Failed to import: ${link.link}`);
      }
    } catch (error) {
      console.error('Import error:', error);
    }
  }
}
```

### Phase 4: Validation and Verification

**Objective**: Ensure migration completed successfully

**Validation Queries**:

```sql
-- 1. Count comparison
SELECT COUNT(*) FROM filemaker_links; -- Should match
SELECT COUNT(*) FROM links;           -- Imported count

-- 2. Verify no orphaned associations
SELECT * FROM links
WHERE customer_id NOT IN (SELECT id FROM customers)
  AND project_id NOT IN (SELECT id FROM projects)
  AND task_id NOT IN (SELECT id FROM tasks);
-- Should return 0 rows

-- 3. Verify exactly one parent constraint
SELECT * FROM links
WHERE (
  (customer_id IS NOT NULL)::int +
  (project_id IS NOT NULL)::int +
  (task_id IS NOT NULL)::int +
  (organization_id IS NOT NULL)::int
) != 1;
-- Should return 0 rows

-- 4. Verify URL validity (sample)
SELECT * FROM links WHERE link IS NULL OR link = '';
-- Should return 0 rows

-- 5. Verify timestamps preserved
SELECT
  fm.id AS fm_id,
  fm.created_at AS fm_created,
  l.created_at AS sb_created
FROM filemaker_links fm
JOIN links l ON l.link = fm.link
WHERE fm.created_at::date != l.created_at::date;
-- Should return 0 rows (or minimal differences)

-- 6. Distribution by parent type
SELECT
  CASE
    WHEN customer_id IS NOT NULL THEN 'customer'
    WHEN project_id IS NOT NULL THEN 'project'
    WHEN task_id IS NOT NULL THEN 'task'
    WHEN organization_id IS NOT NULL THEN 'organization'
  END AS parent_type,
  COUNT(*) AS count
FROM links
GROUP BY parent_type;

-- 7. Verify creator tracking (if added)
SELECT
  created_by,
  COUNT(*) AS links_created
FROM links
WHERE created_by IS NOT NULL
GROUP BY created_by
ORDER BY links_created DESC
LIMIT 10;
```

**Validation Checklist**:
- [ ] Total count matches FileMaker export
- [ ] No orphaned foreign keys
- [ ] All links have exactly one parent
- [ ] No NULL or empty URLs
- [ ] URL lengths ≤ 2048 characters
- [ ] Timestamps preserved accurately
- [ ] Creator information preserved (if applicable)
- [ ] All parent entities exist in Supabase
- [ ] No duplicate links (if uniqueness desired)
- [ ] Sample links verified in UI

**UI Verification**:
1. Load project with links - verify all links display
2. Load task with links - verify all links display
3. Create new link via UI - verify it works
4. Check link counts match FileMaker

### Phase 5: Cutover and Cleanup

**Cutover Plan**:

1. **Maintenance Window**: Schedule 2-hour window for cutover
2. **Final Sync**: Run migration script one last time to catch new links
3. **Read-Only Mode**: Set FileMaker to read-only for links
4. **Deploy Frontend**: Update frontend to use Supabase API
5. **Monitor**: Watch for errors in production
6. **Rollback Plan**: Keep FileMaker accessible for 7 days

**Deployment Steps**:

```bash
# 1. Deploy backend changes (schema + endpoints)
git checkout backend-links-migration
npm run deploy:backend

# 2. Run final migration script
node migrate-links-final.js

# 3. Validate migration
npm run validate:links-migration

# 4. Deploy frontend changes (switch to Supabase)
git checkout frontend-links-supabase
npm run build
npm run deploy

# 5. Monitor logs
tail -f /var/log/api.log | grep links
```

**Rollback Procedure** (if needed):

```bash
# 1. Revert frontend to FileMaker version
git revert frontend-links-supabase
npm run build
npm run deploy

# 2. Keep Supabase data for retry
# Don't delete links table

# 3. Investigate issues
# Review logs, errors, user reports

# 4. Fix issues and retry migration
```

**Post-Migration Cleanup**:

After successful cutover and 30-day stability period:

```sql
-- Optional: Archive FileMaker links data
CREATE TABLE filemaker_links_archive AS
SELECT * FROM filemaker_links;

-- Optional: Drop FileMaker mapping columns (if added to links table)
ALTER TABLE links DROP COLUMN IF EXISTS filemaker_id;

-- Remove FileMaker API code (Phase 3 - code cleanup)
-- Delete src/api/links.js FileMaker implementation
-- Update to Supabase-only version
```

## Migration Timeline

| Phase | Duration | Dependencies | Risk Level |
|-------|----------|--------------|------------|
| 1. Export | 1 hour | FileMaker access | Low |
| 2. Transform | 4 hours | Customer/Project/Task migrations complete | Medium |
| 3. Import | 2 hours | Supabase schema ready | Medium |
| 4. Validation | 2 hours | Import complete | Low |
| 5. Cutover | 2 hours | All validations pass | High |
| **Total** | **11 hours** | | |

**Recommended Schedule**:
- Week 1: Export and transformation (dev environment)
- Week 2: Test import in staging environment
- Week 3: Validation and rehearsal
- Week 4: Production cutover (Saturday morning, low traffic)

## Rollback Criteria

Initiate rollback if:
1. > 5% of links fail to import
2. > 10% of orphaned links (parent not found)
3. Any RLS policy failures in production
4. Critical UI bugs preventing link access
5. Performance degradation > 500ms for link operations
6. Data integrity violations detected

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Orphaned links | Medium | Medium | Review manually, assign defaults |
| URL length violations | Low | Low | Validate during transform, truncate or expand limit |
| Parent entity not migrated | Low | High | Enforce migration order, validate prerequisites |
| Timestamp corruption | Low | Medium | Validate sample, use backup timestamps if needed |
| Creator lookup fails | Medium | Low | Allow NULL created_by, log failures |
| Bulk import failure | Low | High | Use batch insert with error handling, not COPY |
| RLS blocks access | Medium | High | Test policies thoroughly in staging |
| Performance degradation | Medium | Medium | Add indexes, optimize queries |

## Data Integrity Safeguards

1. **Backup Before Migration**:
```bash
# Backup Supabase database
pg_dump -U postgres clarity_db > pre-links-migration-backup.sql

# Backup FileMaker data
# Export devLinks layout to archive
```

2. **Atomic Transactions**:
```javascript
// Use transactions for batch inserts
await db.query('BEGIN');
try {
  // Insert all links
  await db.query('COMMIT');
} catch (error) {
  await db.query('ROLLBACK');
  throw error;
}
```

3. **Idempotency**:
```javascript
// Add unique constraint during migration to prevent duplicates
ALTER TABLE links ADD CONSTRAINT unique_link_per_parent
UNIQUE (link, customer_id, project_id, task_id);

// Drop after migration if duplicates should be allowed
ALTER TABLE links DROP CONSTRAINT unique_link_per_parent;
```

## Success Criteria

Migration is considered successful when:
- [ ] 100% of valid links migrated (excluding orphaned)
- [ ] 0% data integrity violations
- [ ] All UI workflows function correctly
- [ ] Performance meets requirements (< 200ms)
- [ ] No production errors for 7 days
- [ ] User acceptance testing passed
- [ ] Rollback plan tested and ready

## Post-Migration Monitoring

**Week 1**: Daily monitoring
- Error rates for link operations
- API response times
- User-reported issues
- Database query performance

**Week 2-4**: Weekly monitoring
- Link creation patterns
- Data integrity checks
- Performance trends
- User feedback

**Month 2+**: Monthly audits
- Data consistency
- Cleanup opportunities
- Feature usage metrics

## Contact and Escalation

**Migration Team**:
- Backend Lead: [TBD]
- Frontend Lead: [TBD]
- Database Admin: [TBD]

**Escalation Path**:
1. Migration script errors → Backend Lead
2. RLS policy issues → Database Admin
3. UI/UX problems → Frontend Lead
4. Critical failures → All hands / CTO

## Summary

**Total Estimated Effort**: 11 hours over 4 weeks

**Critical Path**:
1. Backend schema changes approved and deployed
2. Customer/Project/Task migrations completed
3. Export and transform FileMaker data
4. Import to Supabase with validation
5. Production cutover during maintenance window

**Key Success Factors**:
- Complete dependent migrations first
- Thorough testing in staging environment
- Maintain FileMaker fallback for 30 days
- Monitor closely post-cutover
- Have rollback plan ready
