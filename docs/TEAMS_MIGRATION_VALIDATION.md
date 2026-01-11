# Teams Migration Validation Guide

This guide covers the validation process for verifying the Teams feature migration from FileMaker to Supabase.

## Overview

The validation script (`scripts/validate-teams-migration.js`) compares data between FileMaker and Supabase to ensure:

1. **Completeness**: All records from FileMaker exist in Supabase
2. **Accuracy**: Data fields match between systems
3. **Integrity**: No orphaned records or invalid foreign key references
4. **Consistency**: No duplicate or corrupted data

## Prerequisites

Before running validation:

1. **Migration Executed**: The migration script must have been run successfully
2. **Backend Access**: Backend API must be accessible at `https://api.claritybusinesssolutions.ca`
3. **Supabase Access**: Tables must exist (`teams`, `staff`, `team_members`)
4. **Environment Variables**: Required variables in `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_SERVICE_ROLE_KEY`
   - `VITE_SECRET_KEY`

## Usage

### Standard Validation

```bash
npm run validate:teams <organization_id>
```

Example:
```bash
npm run validate:teams "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

### Verbose Mode

Shows detailed field-by-field comparisons for records with data mismatches:

```bash
npm run validate:teams:verbose <organization_id>
```

Example:
```bash
npm run validate:teams:verbose "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

### Save Report to File

```bash
node scripts/validate-teams-migration.js <organization_id> --report=validation-report.txt
```

This saves all console output to a file for review and archival.

### Combined Options

```bash
node scripts/validate-teams-migration.js <organization_id> --verbose --report=validation-report.txt
```

## What the Script Validates

### 1. Staff Validation

**Checks:**
- All FileMaker staff records exist in Supabase
- Staff names match exactly
- Roles/titles match (FileMaker `role` → Supabase `title`)
- Email addresses match
- Phone numbers match

**Field Mapping:**
| FileMaker Field | Supabase Field |
|----------------|----------------|
| `__ID` | `id` |
| `name` | `name` |
| `role` | `title` |
| `email` | `email` |
| `phone` | `phone` |

**Potential Issues:**
- Missing staff in Supabase (migration incomplete)
- Extra staff in Supabase (manual additions)
- Data mismatches (fields don't match)

### 2. Teams Validation

**Checks:**
- All FileMaker teams exist in Supabase
- Team names match exactly

**Field Mapping:**
| FileMaker Field | Supabase Field |
|----------------|----------------|
| `__ID` | `id` |
| `name` | `name` |

**Potential Issues:**
- Missing teams in Supabase
- Extra teams in Supabase
- Team name mismatches

### 3. Team Members Validation

**Checks:**
- All FileMaker team member assignments exist in Supabase
- Team IDs match
- Staff IDs match
- Roles match
- No orphaned records (team or staff doesn't exist)
- All foreign key references are valid

**Field Mapping:**
| FileMaker Field | Supabase Field |
|----------------|----------------|
| `__ID` | `id` |
| `_teamID` | `team_id` |
| `_staffID` | `staff_id` |
| `role` | `role` |

**Potential Issues:**
- Missing team member assignments
- Extra assignments in Supabase
- Orphaned records (referencing non-existent teams or staff)
- Invalid foreign key references

## Output and Results

### Success Output

```
=============================================================
✅ VALIDATION PASSED - All data migrated correctly!
   All FileMaker records found in Supabase
   All data fields match between systems
   No orphaned records or invalid references
=============================================================
```

### Issues Found Output

```
=============================================================
⚠️  VALIDATION COMPLETED WITH ISSUES
   Please review the issues above
   Consider re-running the migration script for missing records
=============================================================

📊 Overall Statistics:
   Staff matched: 45/50
   Teams matched: 10/10
   Team members matched: 85/90

   Total issues found: 10
```

### Detailed Issue Types

**Missing in Supabase:**
```
❌ Missing staff in Supabase:
   - John Doe (abc-123-def)
   - Jane Smith (xyz-789-ghi)
```

**Extra in Supabase:**
```
⚠️  Extra teams in Supabase (not in FileMaker):
   - Test Team (test-team-id)
```

**Data Mismatches (Verbose Mode):**
```
⚠️  Data mismatch for staff: John Doe (abc-123-def)
   Field "email": FM="john@old.com" vs SB="john@new.com"
   Field "phone": FM="555-1234" vs SB="555-5678"
```

**Orphaned Records:**
```
❌ Orphaned team members in Supabase (invalid foreign keys):
   - Member tm-123: Team not found (Team: team-999, Staff: staff-456)
   - Member tm-456: Staff not found (Team: team-123, Staff: staff-999)
```

## Exit Codes

The script uses standard exit codes for automation:

- **Exit 0**: Validation passed successfully, no issues found
- **Exit 1**: Validation completed with issues, or fatal error occurred

Example usage in scripts:
```bash
if npm run validate:teams "$ORG_ID"; then
  echo "Migration validated successfully"
else
  echo "Validation failed - review output"
  exit 1
fi
```

## Interpreting Results

### All Clear ✅

If validation passes completely:
1. Migration was successful
2. All data transferred correctly
3. No manual intervention needed
4. Safe to proceed with integration testing

### Minor Issues ⚠️

Common minor issues that may be acceptable:

**Extra records in Supabase:**
- May indicate manual testing or data cleanup
- Review to ensure these are intentional
- Not necessarily a problem

**Data mismatches:**
- Null vs empty string differences are usually harmless
- Whitespace differences can be ignored
- Date format differences are acceptable if dates match

### Major Issues ❌

Issues requiring immediate action:

**Missing records in Supabase:**
- Migration script failed or was incomplete
- Re-run migration for missing records
- Investigate why records were skipped

**Orphaned team members:**
- Foreign key references are broken
- Critical data integrity issue
- Must be fixed before going live
- Check migration order (staff → teams → members)

**Significant data mismatches:**
- Core fields (names, IDs) don't match
- Indicates data corruption or mapping error
- Review migration script logic
- May need to re-migrate affected records

## Troubleshooting

### Connection Errors

**Error:** `Failed to fetch from FileMaker`
- Check backend API is accessible
- Verify `VITE_SECRET_KEY` is correct
- Ensure FileMaker layouts exist

**Error:** `Failed to fetch from Supabase`
- Check `VITE_SUPABASE_URL` is correct
- Verify `VITE_SUPABASE_SERVICE_ROLE_KEY` is valid
- Ensure tables exist in Supabase

### Missing Tables

**Error:** `Table "teams" not found or not accessible`
- Backend schema not deployed
- Run backend team deployment first
- See `BACKEND_CHANGE_REQUEST_002_TEAMS_MIGRATION.md`

### Authentication Errors

**Error:** `Backend API error: 403`
- HMAC authentication failed
- Check `VITE_SECRET_KEY` matches backend
- Verify timestamp is synchronized

### No Records Found

**Warning:** `FileMaker records: 0`
- Layout name may be incorrect
- Organization has no data
- Backend API query may be failing
- Check FileMaker database directly

## Best Practices

### Before Migration

1. **Verify source data**: Check FileMaker has expected records
2. **Backup data**: Ensure FileMaker data is backed up
3. **Test environment**: Validate in dev before production

### After Migration

1. **Run validation immediately**: Don't wait - validate right after migration
2. **Save reports**: Use `--report` flag to archive results
3. **Review all issues**: Even minor issues should be reviewed
4. **Re-run if needed**: It's safe to re-run migration for missing records

### Automation

Include validation in migration workflows:

```bash
#!/bin/bash
ORG_ID="your-org-id-here"

# Run migration
npm run migrate:teams "$ORG_ID"

# Validate immediately
if npm run validate:teams "$ORG_ID" --report="validation-$(date +%Y%m%d-%H%M%S).txt"; then
  echo "✅ Migration and validation successful"
else
  echo "❌ Validation failed - check report"
  exit 1
fi
```

## Next Steps

After successful validation:

1. **Integration Testing**: Run `TSK0011` - test team workflows end-to-end
2. **User Acceptance**: Have users verify data looks correct
3. **Monitor Production**: Watch for errors in production logs
4. **Document Results**: Update migration status documentation

If validation fails:

1. **Review Issues**: Analyze what went wrong
2. **Fix Root Cause**: Update migration script if needed
3. **Clean Bad Data**: Remove incorrect Supabase records if necessary
4. **Re-run Migration**: Execute migration again for missing/incorrect records
5. **Re-validate**: Run validation again until it passes

## Support

For validation issues:

1. Check this documentation first
2. Review validation script output carefully
3. Check backend and database logs
4. Contact development team with:
   - Organization ID used
   - Validation report file
   - Screenshots of errors
   - Steps taken before validation

## Related Documentation

- `docs/TEAMS_MIGRATION_GUIDE.md` - Migration execution guide
- `scripts/README.md` - Scripts overview
- `BACKEND_CHANGE_REQUEST_002_TEAMS_MIGRATION.md` - Backend schema requirements
- `requirements/teams/migration-plan.md` - Migration strategy
