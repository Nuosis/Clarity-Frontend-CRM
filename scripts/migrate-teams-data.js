/**
 * Teams Migration Script - FileMaker to Supabase
 *
 * Migrates teams, staff, and team_members data from FileMaker to Supabase,
 * preserving all relationships and data integrity.
 *
 * ⚠️ SECURITY WARNING ⚠️
 *
 * This script uses VITE_SUPABASE_SERVICE_ROLE_KEY which bypasses ALL Row-Level
 * Security (RLS) policies and grants UNRESTRICTED DATABASE ACCESS across all
 * organizations.
 *
 * CRITICAL SECURITY REQUIREMENTS:
 * - ❌ NEVER run this script in browser/frontend contexts
 * - ❌ NEVER commit this script with hardcoded service role keys
 * - ❌ NEVER deploy this script to publicly accessible environments
 * - ✅ ONLY run in secure backend environments (SSH, local dev, CI/CD)
 * - ✅ ALWAYS use environment variables for service role key
 * - ✅ ROTATE service role key after migration completes
 *
 * Prerequisites:
 * - Backend team must have deployed the teams schema (BACKEND_CHANGE_REQUEST_002_TEAMS_MIGRATION.md)
 * - Tables must exist: teams, staff, team_members
 * - Supabase Storage bucket 'staff-images' must be created
 * - RLS policies and triggers must be in place
 * - Service role key must be in .env file (NOT committed to git)
 *
 * Usage:
 *   node scripts/migrate-teams-data.js <organization_id> [options]
 *
 * Options:
 *   --dry-run           Run without making changes (validation only)
 *   --skip-images       Skip profile image uploads
 *   --batch-size=N      Process records in batches of N (default: 50)
 *
 * Examples:
 *   node scripts/migrate-teams-data.js "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *   node scripts/migrate-teams-data.js "a1b2c3d4-e5f6-7890-abcd-ef1234567890" --dry-run
 *   node scripts/migrate-teams-data.js "a1b2c3d4-e5f6-7890-abcd-ef1234567890" --skip-images --batch-size=100
 *
 * For detailed security requirements, see: docs/MIGRATION_SCRIPTS_SECURITY.md
 */

// SECURITY: Prevent execution in browser contexts
if (typeof window !== 'undefined') {
  throw new Error(
    'SECURITY ERROR: Migration scripts cannot run in browser environments. ' +
    'Service role key exposure would grant unrestricted database access. ' +
    'Run this script in a secure backend environment only.'
  );
}

// SECURITY: Verify Node.js environment
if (typeof process === 'undefined' || !process.env) {
  throw new Error(
    'SECURITY ERROR: Migration scripts must run in Node.js environment with environment variables.'
  );
}

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { Buffer } from 'buffer';

// Load environment variables
dotenv.config();

// Use dynamic import for node-fetch (ESM module)
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://supabase.claritybusinesssolutions.ca';
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const BACKEND_API_URL = 'https://api.claritybusinesssolutions.ca/filemaker';
const SECRET_KEY = process.env.VITE_SECRET_KEY;

// FileMaker layouts
const FM_LAYOUTS = {
  TEAMS: 'devTeams',
  STAFF: 'devStaff',
  TEAM_MEMBERS: 'devTeamMembers'
};

// Parse command line arguments
const args = process.argv.slice(2);
const organizationId = args.find(arg => !arg.startsWith('--'));
const dryRun = args.includes('--dry-run');
const skipImages = args.includes('--skip-images');
const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 50;

// Validation
if (!organizationId) {
  console.error('❌ Error: Organization ID is required');
  console.log('\nUsage: node scripts/migrate-teams-data.js <organization_id> [options]');
  console.log('\nOptions:');
  console.log('  --dry-run           Run without making changes (validation only)');
  console.log('  --skip-images       Skip profile image uploads');
  console.log('  --batch-size=N      Process records in batches of N (default: 50)');
  console.log('\nExample:');
  console.log('  node scripts/migrate-teams-data.js "a1b2c3d4-e5f6-7890-abcd-ef1234567890"');
  process.exit(1);
}

// SECURITY: Validate service role key exists and warn about security implications
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SECURITY ERROR: VITE_SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('   This key grants unrestricted database access and bypasses all RLS policies.');
  console.error('   The key MUST be stored in .env file (not committed to git).');
  console.error('   See docs/MIGRATION_SCRIPTS_SECURITY.md for security requirements.');
  process.exit(1);
}

if (!SECRET_KEY) {
  console.error('❌ Error: VITE_SECRET_KEY environment variable is required for backend API authentication');
  process.exit(1);
}

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Migration statistics
const stats = {
  staff: { fetched: 0, migrated: 0, failed: 0, skipped: 0, imagesUploaded: 0, imagesFailed: 0 },
  teams: { fetched: 0, migrated: 0, failed: 0, skipped: 0 },
  teamMembers: { fetched: 0, migrated: 0, failed: 0, skipped: 0 }
};

/**
 * Convert FileMaker timestamp to ISO 8601 format
 * FileMaker format: MM/DD/YYYY HH:MM:SS
 */
function convertTimestamp(fmTimestamp) {
  if (!fmTimestamp) return new Date().toISOString();

  try {
    // Parse FileMaker timestamp format
    const [datePart, timePart] = fmTimestamp.split(' ');
    const [month, day, year] = datePart.split('/');
    const [hours, minutes, seconds] = timePart.split(':');

    // Create date in local timezone (EST/EDT for Toronto)
    const date = new Date(year, month - 1, day, hours, minutes, seconds);

    // Return ISO string
    return date.toISOString();
  } catch (error) {
    console.warn(`Warning: Failed to parse timestamp "${fmTimestamp}", using current time`);
    return new Date().toISOString();
  }
}

/**
 * Upload staff profile image to Supabase Storage
 */
async function uploadStaffImage(staffId, base64Data) {
  if (!base64Data || skipImages) return null;

  try {
    // Extract base64 content and MIME type
    const matches = base64Data.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      console.warn(`  ⚠️  Invalid base64 format for staff ${staffId}`);
      return null;
    }

    const mimeType = matches[1];
    const base64Content = matches[2];
    const buffer = Buffer.from(base64Content, 'base64');

    // Determine file extension from MIME type
    const extension = mimeType.includes('png') ? 'png' :
                     mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' :
                     'png';

    const fileName = `${staffId}.${extension}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('staff-images')
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: true
      });

    if (error) {
      console.error(`  ❌ Image upload failed for ${staffId}:`, error.message);
      stats.staff.imagesFailed++;
      return null;
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('staff-images')
      .getPublicUrl(fileName);

    stats.staff.imagesUploaded++;
    return publicUrlData.publicUrl;
  } catch (err) {
    console.error(`  ❌ Image processing error for ${staffId}:`, err.message);
    stats.staff.imagesFailed++;
    return null;
  }
}

/**
 * Generate HMAC-SHA256 authentication header for backend API
 */
function generateAuthHeader(payload = '') {
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${payload}${timestamp}`;
  const signature = crypto.createHmac('sha256', SECRET_KEY)
    .update(message)
    .digest('hex');
  return `Bearer ${signature}.${timestamp}`;
}

/**
 * Fetch all records from a FileMaker layout via backend API
 */
async function fetchFileMakerRecords(layout) {
  try {
    const fetchImpl = await fetch;
    const payload = JSON.stringify({
      layout,
      action: 'READ',
      query: [{ "__ID": "*" }]
    });

    const response = await fetchImpl(BACKEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': generateAuthHeader(payload)
      },
      body: payload
    });

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    // Handle different response formats
    if (result?.response?.data) {
      return result.response.data;
    } else if (Array.isArray(result)) {
      return result;
    } else {
      return [];
    }
  } catch (error) {
    console.error(`Error fetching from layout ${layout}:`, error.message);
    throw error;
  }
}

/**
 * Check if tables exist in Supabase
 */
async function verifySupabaseTables() {
  console.log('\n🔍 Verifying Supabase tables...');

  const requiredTables = ['teams', 'staff', 'team_members'];
  const missingTables = [];

  for (const table of requiredTables) {
    const { error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true });

    if (error) {
      missingTables.push(table);
      console.error(`  ❌ Table "${table}" not found or not accessible`);
    } else {
      console.log(`  ✅ Table "${table}" exists`);
    }
  }

  if (missingTables.length > 0) {
    console.error('\n❌ Migration aborted: Required tables are missing');
    console.error('   Please ensure the backend team has deployed BACKEND_CHANGE_REQUEST_002_TEAMS_MIGRATION.md');
    console.error(`   Missing tables: ${missingTables.join(', ')}`);
    return false;
  }

  return true;
}

/**
 * Migrate staff records
 */
async function migrateStaff(fmStaff) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`👥 MIGRATING STAFF`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total staff to migrate: ${fmStaff.length}`);

  stats.staff.fetched = fmStaff.length;

  for (let i = 0; i < fmStaff.length; i++) {
    const s = fmStaff[i];
    const fieldData = s.fieldData || s;
    const staffId = fieldData.__ID;
    const staffName = fieldData.name || 'Unknown';

    console.log(`\n[${i + 1}/${fmStaff.length}] Processing: ${staffName} (${staffId})`);

    if (!staffId) {
      console.error(`  ❌ Skipping: No __ID found`);
      stats.staff.skipped++;
      continue;
    }

    // Check if staff already exists
    const { data: existing } = await supabase
      .from('staff')
      .select('id')
      .eq('id', staffId)
      .single();

    if (existing) {
      console.log(`  ⏭️  Skipping: Already exists in Supabase`);
      stats.staff.skipped++;
      continue;
    }

    // Upload profile image if present
    let profileImageUrl = null;
    if (fieldData.image_base64 && !skipImages) {
      console.log(`  📸 Uploading profile image...`);
      profileImageUrl = await uploadStaffImage(staffId, fieldData.image_base64);
      if (profileImageUrl) {
        console.log(`  ✅ Image uploaded successfully`);
      }
    }

    // Prepare staff data
    const staffData = {
      id: staffId,
      organization_id: organizationId,
      name: staffName,
      title: fieldData.role || null,
      email: fieldData.email || null,
      phone: fieldData.phone || null,
      profile_image_url: profileImageUrl,
      is_active: true,
      created_at: convertTimestamp(fieldData['~CreationTimestamp']),
      updated_at: convertTimestamp(fieldData['~ModificationTimestamp'])
    };

    // Insert staff record
    if (!dryRun) {
      const { error } = await supabase
        .from('staff')
        .insert(staffData);

      if (error) {
        console.error(`  ❌ Failed to migrate: ${error.message}`);
        stats.staff.failed++;
      } else {
        console.log(`  ✅ Migrated successfully`);
        stats.staff.migrated++;
      }
    } else {
      console.log(`  🔍 DRY RUN - Would insert:`, staffData);
      stats.staff.migrated++;
    }
  }
}

/**
 * Migrate teams records
 */
async function migrateTeams(fmTeams) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🏢 MIGRATING TEAMS`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total teams to migrate: ${fmTeams.length}`);

  stats.teams.fetched = fmTeams.length;

  for (let i = 0; i < fmTeams.length; i++) {
    const t = fmTeams[i];
    const fieldData = t.fieldData || t;
    const teamId = fieldData.__ID;
    const teamName = fieldData.name || 'Unknown';

    console.log(`\n[${i + 1}/${fmTeams.length}] Processing: ${teamName} (${teamId})`);

    if (!teamId) {
      console.error(`  ❌ Skipping: No __ID found`);
      stats.teams.skipped++;
      continue;
    }

    // Check if team already exists
    const { data: existing } = await supabase
      .from('teams')
      .select('id')
      .eq('id', teamId)
      .single();

    if (existing) {
      console.log(`  ⏭️  Skipping: Already exists in Supabase`);
      stats.teams.skipped++;
      continue;
    }

    // Prepare team data
    const teamData = {
      id: teamId,
      organization_id: organizationId,
      name: teamName,
      created_at: convertTimestamp(fieldData['~CreationTimestamp']),
      updated_at: convertTimestamp(fieldData['~ModificationTimestamp'])
    };

    // Insert team record
    if (!dryRun) {
      const { error } = await supabase
        .from('teams')
        .insert(teamData);

      if (error) {
        console.error(`  ❌ Failed to migrate: ${error.message}`);
        stats.teams.failed++;
      } else {
        console.log(`  ✅ Migrated successfully`);
        stats.teams.migrated++;
      }
    } else {
      console.log(`  🔍 DRY RUN - Would insert:`, teamData);
      stats.teams.migrated++;
    }
  }
}

/**
 * Migrate team_members records
 */
async function migrateTeamMembers(fmTeamMembers) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔗 MIGRATING TEAM MEMBERS`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total team members to migrate: ${fmTeamMembers.length}`);

  stats.teamMembers.fetched = fmTeamMembers.length;

  for (let i = 0; i < fmTeamMembers.length; i++) {
    const m = fmTeamMembers[i];
    const fieldData = m.fieldData || m;
    const memberId = fieldData.__ID;
    const teamId = fieldData._teamID;
    const staffId = fieldData._staffID;

    console.log(`\n[${i + 1}/${fmTeamMembers.length}] Processing: Team ${teamId} ← Staff ${staffId}`);

    if (!memberId || !teamId || !staffId) {
      console.error(`  ❌ Skipping: Missing required IDs (member: ${memberId}, team: ${teamId}, staff: ${staffId})`);
      stats.teamMembers.skipped++;
      continue;
    }

    // Check if team member already exists
    const { data: existing } = await supabase
      .from('team_members')
      .select('id')
      .eq('id', memberId)
      .single();

    if (existing) {
      console.log(`  ⏭️  Skipping: Already exists in Supabase`);
      stats.teamMembers.skipped++;
      continue;
    }

    // Verify team and staff exist
    const { data: teamExists } = await supabase
      .from('teams')
      .select('id')
      .eq('id', teamId)
      .eq('organization_id', organizationId)
      .single();

    const { data: staffExists } = await supabase
      .from('staff')
      .select('id')
      .eq('id', staffId)
      .eq('organization_id', organizationId)
      .single();

    if (!teamExists) {
      console.error(`  ❌ Skipping: Team ${teamId} not found in Supabase`);
      stats.teamMembers.failed++;
      continue;
    }

    if (!staffExists) {
      console.error(`  ❌ Skipping: Staff ${staffId} not found in Supabase`);
      stats.teamMembers.failed++;
      continue;
    }

    // Prepare team member data
    const memberData = {
      id: memberId,
      organization_id: organizationId,
      team_id: teamId,
      staff_id: staffId,
      role: fieldData.role || null,
      created_at: convertTimestamp(fieldData['~CreationTimestamp']),
      updated_at: convertTimestamp(fieldData['~ModificationTimestamp'])
    };

    // Insert team member record
    if (!dryRun) {
      const { error } = await supabase
        .from('team_members')
        .insert(memberData);

      if (error) {
        console.error(`  ❌ Failed to migrate: ${error.message}`);
        stats.teamMembers.failed++;
      } else {
        console.log(`  ✅ Migrated successfully`);
        stats.teamMembers.migrated++;
      }
    } else {
      console.log(`  🔍 DRY RUN - Would insert:`, memberData);
      stats.teamMembers.migrated++;
    }
  }
}

/**
 * Validate migration results
 */
async function validateMigration() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 VALIDATING MIGRATION`);
  console.log(`${'='.repeat(60)}`);

  // Count records in Supabase
  const { count: teamCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  const { count: staffCount } = await supabase
    .from('staff')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  const { count: memberCount } = await supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  console.log(`\n📊 Supabase Record Counts (for org ${organizationId}):`);
  console.log(`   Teams: ${teamCount}`);
  console.log(`   Staff: ${staffCount}`);
  console.log(`   Team Members: ${memberCount}`);

  // Verify foreign key relationships
  console.log(`\n🔗 Verifying foreign key relationships...`);

  const { data: orphanedMembers, error: orphanError } = await supabase
    .from('team_members')
    .select(`
      id,
      team_id,
      staff_id,
      teams!inner(id),
      staff!inner(id)
    `)
    .eq('organization_id', organizationId);

  if (orphanError) {
    console.error(`  ❌ Error checking relationships: ${orphanError.message}`);
  } else if (orphanedMembers.length !== memberCount) {
    console.error(`  ⚠️  WARNING: Found orphaned team members!`);
    console.error(`     Expected: ${memberCount}, Valid: ${orphanedMembers.length}`);
  } else {
    console.log(`  ✅ All foreign key relationships valid`);
  }

  // Check for duplicate team names
  const { data: duplicateTeams } = await supabase
    .from('teams')
    .select('name, organization_id')
    .eq('organization_id', organizationId);

  const teamNames = duplicateTeams?.map(t => t.name) || [];
  const uniqueNames = new Set(teamNames);

  if (teamNames.length !== uniqueNames.size) {
    console.warn(`  ⚠️  WARNING: Found duplicate team names`);
  } else {
    console.log(`  ✅ All team names unique within organization`);
  }
}

/**
 * Print migration summary
 */
function printSummary() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 MIGRATION SUMMARY`);
  console.log(`${'='.repeat(60)}`);

  console.log(`\n👥 Staff:`);
  console.log(`   Fetched from FileMaker: ${stats.staff.fetched}`);
  console.log(`   Migrated to Supabase: ${stats.staff.migrated}`);
  console.log(`   Skipped (already exist): ${stats.staff.skipped}`);
  console.log(`   Failed: ${stats.staff.failed}`);
  if (!skipImages) {
    console.log(`   Images uploaded: ${stats.staff.imagesUploaded}`);
    console.log(`   Images failed: ${stats.staff.imagesFailed}`);
  }

  console.log(`\n🏢 Teams:`);
  console.log(`   Fetched from FileMaker: ${stats.teams.fetched}`);
  console.log(`   Migrated to Supabase: ${stats.teams.migrated}`);
  console.log(`   Skipped (already exist): ${stats.teams.skipped}`);
  console.log(`   Failed: ${stats.teams.failed}`);

  console.log(`\n🔗 Team Members:`);
  console.log(`   Fetched from FileMaker: ${stats.teamMembers.fetched}`);
  console.log(`   Migrated to Supabase: ${stats.teamMembers.migrated}`);
  console.log(`   Skipped (already exist): ${stats.teamMembers.skipped}`);
  console.log(`   Failed: ${stats.teamMembers.failed}`);

  const totalFailed = stats.staff.failed + stats.teams.failed + stats.teamMembers.failed;
  const totalMigrated = stats.staff.migrated + stats.teams.migrated + stats.teamMembers.migrated;

  console.log(`\n${'='.repeat(60)}`);
  if (dryRun) {
    console.log(`🔍 DRY RUN COMPLETE - No changes made to database`);
  } else if (totalFailed > 0) {
    console.log(`⚠️  MIGRATION COMPLETE WITH ERRORS`);
    console.log(`   Total migrated: ${totalMigrated}`);
    console.log(`   Total failed: ${totalFailed}`);
  } else {
    console.log(`✅ MIGRATION COMPLETE - All records migrated successfully!`);
    console.log(`   Total migrated: ${totalMigrated}`);
  }
  console.log(`${'='.repeat(60)}\n`);
}

/**
 * Main migration function
 */
async function main() {
  const startTime = Date.now();

  console.log('\n' + '='.repeat(60));
  console.log('🔄 TEAMS MIGRATION SCRIPT - FileMaker to Supabase');
  console.log('='.repeat(60));
  console.log(`Organization ID: ${organizationId}`);
  console.log(`Dry Run: ${dryRun ? 'YES (no changes will be made)' : 'NO'}`);
  console.log(`Skip Images: ${skipImages ? 'YES' : 'NO'}`);
  console.log(`Batch Size: ${batchSize}`);
  console.log('='.repeat(60));

  try {
    // Step 1: Verify Supabase tables exist
    const tablesExist = await verifySupabaseTables();
    if (!tablesExist) {
      process.exit(1);
    }

    // Step 2: Fetch data from FileMaker
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📥 FETCHING DATA FROM FILEMAKER`);
    console.log(`${'='.repeat(60)}`);

    console.log(`\n👥 Fetching staff from ${FM_LAYOUTS.STAFF}...`);
    const fmStaff = await fetchFileMakerRecords(FM_LAYOUTS.STAFF);
    console.log(`   ✅ Fetched ${fmStaff.length} staff members`);

    console.log(`\n🏢 Fetching teams from ${FM_LAYOUTS.TEAMS}...`);
    const fmTeams = await fetchFileMakerRecords(FM_LAYOUTS.TEAMS);
    console.log(`   ✅ Fetched ${fmTeams.length} teams`);

    console.log(`\n🔗 Fetching team members from ${FM_LAYOUTS.TEAM_MEMBERS}...`);
    const fmTeamMembers = await fetchFileMakerRecords(FM_LAYOUTS.TEAM_MEMBERS);
    console.log(`   ✅ Fetched ${fmTeamMembers.length} team member assignments`);

    // Step 3: Migrate staff (must happen first due to foreign keys)
    await migrateStaff(fmStaff);

    // Step 4: Migrate teams
    await migrateTeams(fmTeams);

    // Step 5: Migrate team members (must happen last due to foreign keys)
    await migrateTeamMembers(fmTeamMembers);

    // Step 6: Validate migration
    if (!dryRun) {
      await validateMigration();
    }

    // Step 7: Print summary
    printSummary();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⏱️  Total duration: ${duration} seconds\n`);

    // Exit with appropriate code
    const totalFailed = stats.staff.failed + stats.teams.failed + stats.teamMembers.failed;
    process.exit(totalFailed > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n💥 Fatal error during migration:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
main();
