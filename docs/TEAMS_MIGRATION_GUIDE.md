# Teams Migration Guide - FileMaker to Supabase

This guide explains how to migrate teams, staff, and team_members data from FileMaker to Supabase using the automated migration script.

## Overview

The teams migration script (`scripts/migrate-teams-data.js`) automates the process of migrating:
- **Staff members** from `devStaff` layout to `staff` table
- **Teams** from `devTeams` layout to `teams` table
- **Team member assignments** from `devTeamMembers` layout to `team_members` table

The script preserves all relationships, timestamps, and optionally migrates profile images to Supabase Storage.

## Prerequisites

### 1. Backend Deployment (REQUIRED)

**The backend team MUST deploy the database schema first.**

Verify that `BACKEND_CHANGE_REQUEST_002_TEAMS_MIGRATION.md` has been deployed, which includes:
- ✅ Tables created: `teams`, `staff`, `team_members`
- ✅ Column added: `projects.team_id`
- ✅ RLS policies in place
- ✅ Database triggers configured
- ✅ Supabase Storage bucket `staff-images` created

To verify schema exists:
```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('teams', 'staff', 'team_members');\""
```

Expected output:
```
  tablename
--------------
 staff
 team_members
 teams
(3 rows)
```

### 2. Environment Variables

Create or update your `.env` file with required credentials:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://supabase.claritybusinesssolutions.ca
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Backend API Authentication
VITE_SECRET_KEY=your-hmac-secret-key-here
```

**Security Note:** The service role key bypasses RLS policies. Never expose this key in client-side code.

### 3. Organization ID

You need your organization's UUID from the `organizations` table. Get it from:
- Supabase dashboard
- Your user profile in the application
- Ask the backend team

## Migration Script Usage

### Basic Syntax

```bash
node scripts/migrate-teams-data.js <organization_id> [options]
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--dry-run` | Run validation without making changes | `false` |
| `--skip-images` | Skip profile image uploads | `false` |
| `--batch-size=N` | Process records in batches of N | `50` |

### Examples

#### 1. Dry Run (Recommended First)

Test the migration without making changes:

```bash
node scripts/migrate-teams-data.js "a1b2c3d4-e5f6-7890-abcd-ef1234567890" --dry-run
```

This will:
- ✅ Verify Supabase tables exist
- ✅ Fetch data from FileMaker
- ✅ Validate data structure
- ✅ Show what would be migrated
- ❌ NOT make any changes to database

#### 2. Full Migration

Migrate all data including profile images:

```bash
node scripts/migrate-teams-data.js "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

#### 3. Skip Images (Faster)

Migrate without uploading profile images:

```bash
node scripts/migrate-teams-data.js "a1b2c3d4-e5f6-7890-abcd-ef1234567890" --skip-images
```

#### 4. Custom Batch Size

Process more records per batch (for larger datasets):

```bash
node scripts/migrate-teams-data.js "a1b2c3d4-e5f6-7890-abcd-ef1234567890" --batch-size=100
```

## Migration Process

The script follows this order to maintain referential integrity:

### Step 1: Verification

- Checks that required tables exist in Supabase
- Validates environment variables
- Aborts if prerequisites not met

### Step 2: Data Extraction

Fetches data from FileMaker layouts via backend API:
- `devStaff` → Staff members
- `devTeams` → Teams
- `devTeamMembers` → Team assignments

### Step 3: Staff Migration

For each staff member:
1. Check if already exists in Supabase (by ID)
2. Upload profile image to Supabase Storage (if present and not `--skip-images`)
3. Transform FileMaker data to Supabase schema
4. Insert staff record

**Field Mapping:**
- `__ID` → `id` (preserved UUID)
- `name` → `name`
- `role` → `title`
- `email` → `email`
- `phone` → `phone`
- `image_base64` → `profile_image_url` (uploaded to Storage)
- `~CreationTimestamp` → `created_at`
- `~ModificationTimestamp` → `updated_at`

### Step 4: Teams Migration

For each team:
1. Check if already exists in Supabase (by ID)
2. Transform FileMaker data to Supabase schema
3. Insert team record

**Field Mapping:**
- `__ID` → `id` (preserved UUID)
- `name` → `name`
- `~CreationTimestamp` → `created_at`
- `~ModificationTimestamp` → `updated_at`

### Step 5: Team Members Migration

For each team member assignment:
1. Check if already exists in Supabase (by ID)
2. Verify both team and staff exist in Supabase
3. Transform FileMaker data to Supabase schema
4. Insert team member record

**Field Mapping:**
- `__ID` → `id` (preserved UUID)
- `_teamID` → `team_id`
- `_staffID` → `staff_id`
- `role` → `role` (role within team)
- `~CreationTimestamp` → `created_at`
- `~ModificationTimestamp` → `updated_at`

### Step 6: Validation

Verifies migration integrity:
- Counts records in Supabase
- Checks foreign key relationships
- Identifies orphaned records
- Validates unique constraints

### Step 7: Summary Report

Displays comprehensive migration results:
- Records fetched, migrated, skipped, failed
- Image upload statistics
- Total duration
- Exit code (0 = success, 1 = failures occurred)

## Understanding Output

### Success Example

```
=============================================================
🔄 TEAMS MIGRATION SCRIPT - FileMaker to Supabase
=============================================================
Organization ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
Dry Run: NO
Skip Images: NO
Batch Size: 50
=============================================================

🔍 Verifying Supabase tables...
  ✅ Table "teams" exists
  ✅ Table "staff" exists
  ✅ Table "team_members" exists

=============================================================
📥 FETCHING DATA FROM FILEMAKER
=============================================================

👥 Fetching staff from devStaff...
   ✅ Fetched 15 staff members

🏢 Fetching teams from devTeams...
   ✅ Fetched 5 teams

🔗 Fetching team members from devTeamMembers...
   ✅ Fetched 25 team member assignments

=============================================================
👥 MIGRATING STAFF
=============================================================
Total staff to migrate: 15

[1/15] Processing: John Doe (uuid-1234...)
  📸 Uploading profile image...
  ✅ Image uploaded successfully
  ✅ Migrated successfully

...

=============================================================
📋 MIGRATION SUMMARY
=============================================================

👥 Staff:
   Fetched from FileMaker: 15
   Migrated to Supabase: 15
   Skipped (already exist): 0
   Failed: 0
   Images uploaded: 12
   Images failed: 0

🏢 Teams:
   Fetched from FileMaker: 5
   Migrated to Supabase: 5
   Skipped (already exist): 0
   Failed: 0

🔗 Team Members:
   Fetched from FileMaker: 25
   Migrated to Supabase: 25
   Skipped (already exist): 0
   Failed: 0

=============================================================
✅ MIGRATION COMPLETE - All records migrated successfully!
   Total migrated: 45
=============================================================

⏱️  Total duration: 12.34 seconds
```

### Error Handling

The script is **idempotent** - you can run it multiple times safely:
- Already migrated records are skipped
- Partial migrations can be resumed
- No duplicate data will be created

**Common Issues:**

1. **Missing tables**
   ```
   ❌ Table "teams" not found or not accessible
   ```
   **Solution:** Backend team must deploy database schema first

2. **Missing environment variables**
   ```
   ❌ Error: VITE_SUPABASE_SERVICE_ROLE_KEY environment variable is required
   ```
   **Solution:** Add required variables to `.env` file

3. **Orphaned team members**
   ```
   ❌ Skipping: Staff uuid-5678 not found in Supabase
   ```
   **Solution:** Staff must be migrated before team members. Re-run migration.

4. **Image upload failures**
   ```
   ❌ Image upload failed for uuid-9012: Bucket 'staff-images' not found
   ```
   **Solution:** Backend team must create Supabase Storage bucket

## Post-Migration Checklist

After successful migration:

- [ ] Verify record counts match FileMaker
  ```bash
  ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT 'teams' as table, COUNT(*) FROM teams WHERE organization_id = 'YOUR_ORG_ID' UNION ALL SELECT 'staff', COUNT(*) FROM staff WHERE organization_id = 'YOUR_ORG_ID' UNION ALL SELECT 'team_members', COUNT(*) FROM team_members WHERE organization_id = 'YOUR_ORG_ID';\""
  ```

- [ ] Test teams functionality in web application
  - View teams list
  - View team details
  - View team members
  - Verify profile images load

- [ ] Verify relationships
  - Teams have correct members
  - Staff appear in correct teams
  - No orphaned records

- [ ] Check RLS policies work correctly
  - Users can only see their organization's data
  - No cross-organization data leakage

- [ ] Update frontend to use Supabase data
  - Switch from FileMaker bridge to Supabase API
  - Update team-related components
  - Test all team operations (CRUD)

## Rollback Plan

If migration fails or issues are discovered:

### 1. Delete Migrated Data (Supabase)

```sql
-- Delete in reverse order due to foreign keys
DELETE FROM team_members WHERE organization_id = 'YOUR_ORG_ID';
DELETE FROM teams WHERE organization_id = 'YOUR_ORG_ID';
DELETE FROM staff WHERE organization_id = 'YOUR_ORG_ID';
```

### 2. Remove Profile Images (if uploaded)

```javascript
// Use Supabase Storage API or dashboard to delete staff-images bucket contents
```

### 3. FileMaker Data Remains Intact

FileMaker data is **never modified** by the migration script. It remains the source of truth until migration is verified successful.

## Data Integrity Guarantees

The migration script ensures:

✅ **Referential Integrity:** Foreign key relationships preserved
✅ **Idempotency:** Safe to re-run multiple times
✅ **Organization Isolation:** Only affects specified organization
✅ **No Data Loss:** FileMaker data untouched
✅ **Atomic Operations:** Each record insert is a separate transaction
✅ **Validation:** Comprehensive checks before and after migration
✅ **Audit Trail:** Timestamps preserved from FileMaker

## Troubleshooting

### Script Won't Run

**Problem:** `Error [ERR_MODULE_NOT_FOUND]`

**Solution:** Ensure you're in the project root:
```bash
cd /Users/marcusswift/javascript/clarityCrmFrontend
node scripts/migrate-teams-data.js ...
```

### Authentication Errors

**Problem:** `Backend API error: 401 Unauthorized`

**Solution:** Verify `VITE_SECRET_KEY` matches backend configuration

### Slow Migration

**Problem:** Migration takes too long

**Solutions:**
- Use `--skip-images` flag (images upload slowly)
- Increase `--batch-size` (default 50)
- Run during off-peak hours
- Check network connectivity to backend

### Duplicate Errors

**Problem:** `duplicate key value violates unique constraint`

**Solution:**
- Records already exist (normal if re-running)
- Script will skip and continue
- Check "Skipped" count in summary

## Support

For issues or questions:

1. Check this guide thoroughly
2. Review migration script output for specific errors
3. Verify all prerequisites are met
4. Contact backend team for schema/infrastructure issues
5. Contact frontend team for script issues

## Additional Resources

- `BACKEND_CHANGE_REQUEST_002_TEAMS_MIGRATION.md` - Database schema specification
- `src/services/teamService.js` - Team service implementation
- `src/api/teams.js` - Team API functions
- `.roo/rules/SUPABASE_DATABASE_VERIFICATION.md` - Database verification patterns
