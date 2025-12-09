# Supabase Migrations

This directory contains SQL migration files for the Clarity CRM database schema.

## Available Migrations

### 001_proposals_schema_update.sql

**Purpose**: Extends the proposal system with projects, requirements, packages, and subscription support.

**Creates**:
- `projects` table - Parent entity for proposals
- `proposal_requirements` table - Client deliverables to developers
- `proposal_packages` table - Bundled offerings
- `proposal_packages_deliverables` join table
- `proposal_packages_requirements` join table

**Updates**:
- `proposal_deliverables` - Adds subscription type support
- `proposals` - Links to projects table

**Includes**:
- Indexes for performance
- Row Level Security (RLS) policies
- Triggers for automatic timestamp updates
- Helper views for common queries
- Comments and documentation

## Running Migrations

### Option 1: Supabase CLI (Recommended)

```bash
# Install Supabase CLI if you haven't already
npm install -g supabase

# Link to your project (first time only)
supabase link --project-ref your-project-ref

# Push migrations to Supabase
supabase db push
```

### Option 2: Direct SQL Execution

```bash
# Using psql
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/001_proposals_schema_update.sql

# Or copy and paste into Supabase SQL Editor
# Dashboard → SQL Editor → New Query → Paste migration content → Run
```

### Option 3: Programmatic Execution

```javascript
import { getSupabaseClient } from '../services/supabaseService';
import fs from 'fs';

async function runMigration() {
  const supabase = getSupabaseClient();
  const sql = fs.readFileSync('./supabase/migrations/001_proposals_schema_update.sql', 'utf8');

  const { error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error('Migration failed:', error);
  } else {
    console.log('Migration successful!');
  }
}
```

## Verifying Migration

After running the migration, verify it worked:

```sql
-- Check that all tables were created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'projects',
    'proposal_requirements',
    'proposal_packages',
    'proposal_packages_deliverables',
    'proposal_packages_requirements'
  );

-- Check that proposal_deliverables was updated
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'proposal_deliverables'
  AND column_name IN ('billing_interval', 'subscription_duration_months');

-- Check that views were created
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN ('proposal_packages_summary', 'proposals_overview');

-- Test RLS policies exist
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('projects', 'proposal_requirements', 'proposal_packages');
```

## Rollback (If Needed)

If you need to rollback this migration:

```sql
-- WARNING: This will delete all data in these tables!

-- Drop tables in reverse order (to handle foreign keys)
DROP TABLE IF EXISTS proposal_packages_requirements CASCADE;
DROP TABLE IF EXISTS proposal_packages_deliverables CASCADE;
DROP TABLE IF EXISTS proposal_packages CASCADE;
DROP TABLE IF EXISTS proposal_requirements CASCADE;

-- Remove foreign key constraint from proposals
ALTER TABLE proposals
DROP CONSTRAINT IF EXISTS proposals_project_id_fkey;

-- Drop projects table
DROP TABLE IF EXISTS projects CASCADE;

-- Revert proposal_deliverables changes
ALTER TABLE proposal_deliverables
DROP CONSTRAINT IF EXISTS proposal_deliverables_type_check;

ALTER TABLE proposal_deliverables
ADD CONSTRAINT proposal_deliverables_type_check
CHECK (type IN ('fixed', 'hourly'));

ALTER TABLE proposal_deliverables
DROP COLUMN IF EXISTS billing_interval,
DROP COLUMN IF EXISTS subscription_duration_months;

-- Drop views
DROP VIEW IF EXISTS proposal_packages_summary;
DROP VIEW IF EXISTS proposals_overview;
```

## Migration Checklist

Before running in production:

- [ ] Backup your database
- [ ] Test migration on staging environment
- [ ] Verify all tables are created
- [ ] Verify RLS policies are in place
- [ ] Test API endpoints with new schema
- [ ] Update frontend to use new features
- [ ] Document any custom changes

## Post-Migration Tasks

After running the migration:

1. **Test API Integration**
   ```javascript
   // Test creating a project
   import { createProject } from '../api/proposalExtended';

   const result = await createProject({
     customer_id: 'test-customer',
     name: 'Test Project',
     budget: 10000
   });

   console.log('Project created:', result);
   ```

2. **Migrate Existing Data** (if needed)
   - Create default projects for existing proposals
   - See [PROPOSAL_SYSTEM_SUMMARY.md](../../PROPOSAL_SYSTEM_SUMMARY.md#4-update-existing-proposals-if-needed)

3. **Update Application Code**
   - Import new API functions
   - Update proposal creation workflow
   - Add requirements management UI
   - Add packages management UI

4. **Update Documentation**
   - Document new workflow for team
   - Update user guides
   - Create training materials

## Troubleshooting

### Error: "relation already exists"

The table might already exist. Check if it was partially created:

```sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'projects';
```

If it exists, you can either:
1. Drop it manually and re-run: `DROP TABLE projects CASCADE;`
2. Skip that part of the migration

### Error: "permission denied"

Make sure you're connected with a user that has sufficient privileges:

```sql
-- Check your current role
SELECT current_user, current_database();

-- Grant necessary permissions (as superuser)
GRANT ALL ON ALL TABLES IN SCHEMA public TO your_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO your_user;
```

### Error: "foreign key constraint fails"

This might happen if you have existing proposals without valid customer_ids:

```sql
-- Find problematic records
SELECT id, title, customer_id
FROM proposals
WHERE customer_id NOT IN (SELECT id FROM customers);

-- Fix by updating or deleting these records
```

### Tables created but data not accessible

Check RLS policies:

```sql
-- Temporarily disable RLS for testing (NOT for production!)
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;

-- Re-enable when done
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Or check if you're authenticated
SELECT auth.role();
```

## Best Practices

1. **Always backup before migrating**
   ```bash
   pg_dump -h host -U user -d database > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Test in staging first**
   - Never run migrations directly in production
   - Test with realistic data volumes
   - Verify all application features work

3. **Document custom changes**
   - If you modify the migration, document why
   - Keep a changelog of all database changes

4. **Monitor performance**
   - Check query performance after migration
   - Verify indexes are being used
   - Monitor for slow queries

5. **Plan for rollback**
   - Always have a rollback plan
   - Test the rollback procedure
   - Keep backup recent

## Related Documentation

- [Extended Proposal System Documentation](../../docs/proposals/EXTENDED_PROPOSAL_SYSTEM.md)
- [Implementation Quick Start](../../docs/proposals/IMPLEMENTATION_QUICKSTART.md)
- [Proposal System Summary](../../PROPOSAL_SYSTEM_SUMMARY.md)

## Support

If you encounter issues with migrations:

1. Check the [Troubleshooting](#troubleshooting) section above
2. Review the full documentation in [docs/proposals/](../../docs/proposals/)
3. Test the migration in a separate test database first
4. Check Supabase logs for detailed error messages

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 001 | 2025-01-05 | Initial proposal system extension with projects, requirements, packages, and subscription support |
