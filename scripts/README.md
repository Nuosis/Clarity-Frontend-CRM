# Scripts Directory

This directory contains utility scripts for database migration, deployment, and testing.

## Migration Scripts

### migrate-teams-data.js

Migrates teams, staff, and team_members data from FileMaker to Supabase.

**Usage:**
```bash
# Dry run (recommended first)
npm run migrate:teams:dry-run <organization_id>

# Full migration
npm run migrate:teams <organization_id>

# With options
node scripts/migrate-teams-data.js <organization_id> --dry-run --skip-images
```

**Documentation:** See `docs/TEAMS_MIGRATION_GUIDE.md` for complete guide.

**Prerequisites:**
- Backend schema deployed (`BACKEND_CHANGE_REQUEST_002_TEAMS_MIGRATION.md`)
- Environment variables configured (`.env` file)
- Organization ID from Supabase

### validate-teams-migration.js

Validates teams migration by comparing FileMaker and Supabase data to ensure accuracy.

**Usage:**
```bash
# Standard validation
npm run validate:teams <organization_id>

# Verbose mode (show detailed mismatches)
npm run validate:teams:verbose <organization_id>

# Save report to file
node scripts/validate-teams-migration.js <organization_id> --report=validation-report.txt

# Verbose with report
node scripts/validate-teams-migration.js <organization_id> --verbose --report=validation-report.txt
```

**What it checks:**
- All FileMaker records exist in Supabase
- All data fields match between systems
- No orphaned records (invalid foreign key references)
- No duplicate records
- Data integrity across all three tables (teams, staff, team_members)

**Exit codes:**
- 0: All validation checks passed
- 1: Issues found (see output for details)

**Prerequisites:**
- Migration must have been executed first
- Backend API must be accessible
- Supabase tables must exist

## Other Scripts

### sync-missing-records.js

Syncs billing records from FileMaker to Supabase for specified date ranges.

**Usage:**
```bash
node scripts/sync-missing-records.js <organization_id>
```

### upload.js

Uploads built files to FileMaker server.

**Usage:**
```bash
npm run upload
```

### deploy-edge-function.js

Deploys edge functions to Supabase.

**Usage:**
```bash
npm run deploy:edge-function
```

### test-supabase-service.js

Tests Supabase service connectivity and authentication.

**Usage:**
```bash
npm run test:supabase
```

## Environment Variables

All scripts require environment variables configured in `.env`:

```env
# Supabase
VITE_SUPABASE_URL=https://supabase.claritybusinesssolutions.ca
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Backend API
VITE_SECRET_KEY=your-hmac-secret

# FileMaker (if needed)
VITE_FM_URL=https://server.claritybusinesssolutions.ca
VITE_FM_DATABASE=clarityCRM
VITE_FM_USER=your-fm-user
VITE_FM_PASSWORD=your-fm-password
```

## Best Practices

1. **Always run dry-run first** before actual migrations
2. **Backup data** before running destructive operations
3. **Verify prerequisites** before running migration scripts
4. **Check exit codes** - 0 = success, 1 = failure
5. **Review output carefully** for warnings and errors
6. **Test in development** before running in production

## Troubleshooting

### Module Not Found Errors

Ensure you're running scripts from project root:
```bash
cd /Users/marcusswift/javascript/clarityCrmFrontend
node scripts/script-name.js
```

### Authentication Errors

Verify environment variables are set correctly:
```bash
cat .env | grep VITE_
```

### Permission Errors

Some scripts require service role key (admin access). Never commit this key to version control.

## Support

For script-related issues:
1. Check script output for specific error messages
2. Verify prerequisites are met
3. Review relevant documentation
4. Contact development team
