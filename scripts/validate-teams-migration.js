/**
 * Teams Migration Validation Script - FileMaker vs Supabase
 *
 * Compares teams, staff, and team_members data between FileMaker and Supabase
 * to verify migration accuracy and data integrity.
 *
 * Prerequisites:
 * - Migration must have been executed (run migrate-teams-data.js first)
 * - Backend API must be accessible
 * - Supabase tables must exist
 *
 * Usage:
 *   node scripts/validate-teams-migration.js <organization_id> [options]
 *
 * Options:
 *   --verbose           Show detailed comparison for each record
 *   --report=FILE       Save validation report to specified file
 *
 * Examples:
 *   node scripts/validate-teams-migration.js "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *   node scripts/validate-teams-migration.js "a1b2c3d4-e5f6-7890-abcd-ef1234567890" --verbose
 *   node scripts/validate-teams-migration.js "a1b2c3d4-e5f6-7890-abcd-ef1234567890" --report=validation-report.txt
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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
const verbose = args.includes('--verbose');
const reportArg = args.find(arg => arg.startsWith('--report='));
const reportFile = reportArg ? reportArg.split('=')[1] : null;

// Validation
if (!organizationId) {
  console.error('❌ Error: Organization ID is required');
  console.log('\nUsage: node scripts/validate-teams-migration.js <organization_id> [options]');
  console.log('\nOptions:');
  console.log('  --verbose           Show detailed comparison for each record');
  console.log('  --report=FILE       Save validation report to specified file');
  console.log('\nExample:');
  console.log('  node scripts/validate-teams-migration.js "a1b2c3d4-e5f6-7890-abcd-ef1234567890"');
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: VITE_SUPABASE_SERVICE_ROLE_KEY environment variable is required');
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

// Validation results
const results = {
  staff: {
    inFileMaker: 0,
    inSupabase: 0,
    matched: 0,
    missingInSupabase: [],
    extraInSupabase: [],
    dataMismatches: []
  },
  teams: {
    inFileMaker: 0,
    inSupabase: 0,
    matched: 0,
    missingInSupabase: [],
    extraInSupabase: [],
    dataMismatches: []
  },
  teamMembers: {
    inFileMaker: 0,
    inSupabase: 0,
    matched: 0,
    missingInSupabase: [],
    extraInSupabase: [],
    orphanedInSupabase: [],
    invalidReferences: []
  }
};

// Report output buffer
let reportBuffer = [];

/**
 * Log to console and optionally to report buffer
 */
function log(message) {
  console.log(message);
  if (reportFile) {
    reportBuffer.push(message);
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
 * Normalize field value for comparison (handle nulls, empty strings, etc.)
 */
function normalizeValue(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return value;
}

/**
 * Compare two data objects for equality
 */
function compareData(source, target, fieldMapping) {
  const mismatches = [];

  for (const [sourceField, targetField] of Object.entries(fieldMapping)) {
    const sourceValue = normalizeValue(source[sourceField]);
    const targetValue = normalizeValue(target[targetField]);

    if (sourceValue !== targetValue) {
      mismatches.push({
        field: sourceField,
        fileMaker: sourceValue,
        supabase: targetValue
      });
    }
  }

  return mismatches;
}

/**
 * Validate staff migration
 */
async function validateStaff(fmStaff, sbStaff) {
  log(`\n${'='.repeat(60)}`);
  log(`👥 VALIDATING STAFF MIGRATION`);
  log(`${'='.repeat(60)}`);

  results.staff.inFileMaker = fmStaff.length;
  results.staff.inSupabase = sbStaff.length;

  // Create lookup maps
  const fmMap = new Map();
  const sbMap = new Map();

  // Process FileMaker staff
  fmStaff.forEach(s => {
    const fieldData = s.fieldData || s;
    const id = fieldData.__ID;
    if (id) {
      fmMap.set(id, fieldData);
    }
  });

  // Process Supabase staff
  sbStaff.forEach(s => {
    if (s.id) {
      sbMap.set(s.id, s);
    }
  });

  // Check for missing staff in Supabase
  for (const [id, fmData] of fmMap.entries()) {
    if (!sbMap.has(id)) {
      results.staff.missingInSupabase.push({
        id,
        name: fmData.name || 'Unknown'
      });
    } else {
      results.staff.matched++;

      // Compare data fields
      const sbData = sbMap.get(id);
      const fieldMapping = {
        'name': 'name',
        'role': 'title',
        'email': 'email',
        'phone': 'phone'
      };

      const mismatches = compareData(fmData, sbData, fieldMapping);

      if (mismatches.length > 0) {
        results.staff.dataMismatches.push({
          id,
          name: fmData.name || 'Unknown',
          mismatches
        });

        if (verbose) {
          log(`\n⚠️  Data mismatch for staff: ${fmData.name} (${id})`);
          mismatches.forEach(m => {
            log(`   Field "${m.field}": FM="${m.fileMaker}" vs SB="${m.supabase}"`);
          });
        }
      }
    }
  }

  // Check for extra staff in Supabase
  for (const [id, sbData] of sbMap.entries()) {
    if (!fmMap.has(id)) {
      results.staff.extraInSupabase.push({
        id,
        name: sbData.name || 'Unknown'
      });
    }
  }

  // Report results
  log(`\n📊 Staff Validation Results:`);
  log(`   FileMaker records: ${results.staff.inFileMaker}`);
  log(`   Supabase records: ${results.staff.inSupabase}`);
  log(`   Matched records: ${results.staff.matched}`);
  log(`   Missing in Supabase: ${results.staff.missingInSupabase.length}`);
  log(`   Extra in Supabase: ${results.staff.extraInSupabase.length}`);
  log(`   Data mismatches: ${results.staff.dataMismatches.length}`);

  if (results.staff.missingInSupabase.length > 0) {
    log(`\n❌ Missing staff in Supabase:`);
    results.staff.missingInSupabase.forEach(s => {
      log(`   - ${s.name} (${s.id})`);
    });
  }

  if (results.staff.extraInSupabase.length > 0) {
    log(`\n⚠️  Extra staff in Supabase (not in FileMaker):`);
    results.staff.extraInSupabase.forEach(s => {
      log(`   - ${s.name} (${s.id})`);
    });
  }
}

/**
 * Validate teams migration
 */
async function validateTeams(fmTeams, sbTeams) {
  log(`\n${'='.repeat(60)}`);
  log(`🏢 VALIDATING TEAMS MIGRATION`);
  log(`${'='.repeat(60)}`);

  results.teams.inFileMaker = fmTeams.length;
  results.teams.inSupabase = sbTeams.length;

  // Create lookup maps
  const fmMap = new Map();
  const sbMap = new Map();

  // Process FileMaker teams
  fmTeams.forEach(t => {
    const fieldData = t.fieldData || t;
    const id = fieldData.__ID;
    if (id) {
      fmMap.set(id, fieldData);
    }
  });

  // Process Supabase teams
  sbTeams.forEach(t => {
    if (t.id) {
      sbMap.set(t.id, t);
    }
  });

  // Check for missing teams in Supabase
  for (const [id, fmData] of fmMap.entries()) {
    if (!sbMap.has(id)) {
      results.teams.missingInSupabase.push({
        id,
        name: fmData.name || 'Unknown'
      });
    } else {
      results.teams.matched++;

      // Compare data fields
      const sbData = sbMap.get(id);
      const fieldMapping = {
        'name': 'name'
      };

      const mismatches = compareData(fmData, sbData, fieldMapping);

      if (mismatches.length > 0) {
        results.teams.dataMismatches.push({
          id,
          name: fmData.name || 'Unknown',
          mismatches
        });

        if (verbose) {
          log(`\n⚠️  Data mismatch for team: ${fmData.name} (${id})`);
          mismatches.forEach(m => {
            log(`   Field "${m.field}": FM="${m.fileMaker}" vs SB="${m.supabase}"`);
          });
        }
      }
    }
  }

  // Check for extra teams in Supabase
  for (const [id, sbData] of sbMap.entries()) {
    if (!fmMap.has(id)) {
      results.teams.extraInSupabase.push({
        id,
        name: sbData.name || 'Unknown'
      });
    }
  }

  // Report results
  log(`\n📊 Teams Validation Results:`);
  log(`   FileMaker records: ${results.teams.inFileMaker}`);
  log(`   Supabase records: ${results.teams.inSupabase}`);
  log(`   Matched records: ${results.teams.matched}`);
  log(`   Missing in Supabase: ${results.teams.missingInSupabase.length}`);
  log(`   Extra in Supabase: ${results.teams.extraInSupabase.length}`);
  log(`   Data mismatches: ${results.teams.dataMismatches.length}`);

  if (results.teams.missingInSupabase.length > 0) {
    log(`\n❌ Missing teams in Supabase:`);
    results.teams.missingInSupabase.forEach(t => {
      log(`   - ${t.name} (${t.id})`);
    });
  }

  if (results.teams.extraInSupabase.length > 0) {
    log(`\n⚠️  Extra teams in Supabase (not in FileMaker):`);
    results.teams.extraInSupabase.forEach(t => {
      log(`   - ${t.name} (${t.id})`);
    });
  }
}

/**
 * Validate team members migration
 */
async function validateTeamMembers(fmMembers, sbMembers, sbTeams, sbStaff) {
  log(`\n${'='.repeat(60)}`);
  log(`🔗 VALIDATING TEAM MEMBERS MIGRATION`);
  log(`${'='.repeat(60)}`);

  results.teamMembers.inFileMaker = fmMembers.length;
  results.teamMembers.inSupabase = sbMembers.length;

  // Create lookup maps
  const fmMap = new Map();
  const sbMap = new Map();
  const sbTeamIds = new Set(sbTeams.map(t => t.id));
  const sbStaffIds = new Set(sbStaff.map(s => s.id));

  // Process FileMaker team members
  fmMembers.forEach(m => {
    const fieldData = m.fieldData || m;
    const id = fieldData.__ID;
    if (id) {
      fmMap.set(id, fieldData);
    }
  });

  // Process Supabase team members
  sbMembers.forEach(m => {
    if (m.id) {
      sbMap.set(m.id, m);
    }
  });

  // Check for missing team members in Supabase
  for (const [id, fmData] of fmMap.entries()) {
    if (!sbMap.has(id)) {
      results.teamMembers.missingInSupabase.push({
        id,
        teamId: fmData._teamID,
        staffId: fmData._staffID
      });
    } else {
      results.teamMembers.matched++;

      // Compare data fields
      const sbData = sbMap.get(id);
      const fieldMapping = {
        '_teamID': 'team_id',
        '_staffID': 'staff_id',
        'role': 'role'
      };

      const mismatches = compareData(fmData, sbData, fieldMapping);

      if (mismatches.length > 0) {
        results.teamMembers.dataMismatches = results.teamMembers.dataMismatches || [];
        results.teamMembers.dataMismatches.push({
          id,
          teamId: fmData._teamID,
          staffId: fmData._staffID,
          mismatches
        });

        if (verbose) {
          log(`\n⚠️  Data mismatch for team member: ${id}`);
          mismatches.forEach(m => {
            log(`   Field "${m.field}": FM="${m.fileMaker}" vs SB="${m.supabase}"`);
          });
        }
      }
    }
  }

  // Check for extra team members in Supabase
  for (const [id, sbData] of sbMap.entries()) {
    if (!fmMap.has(id)) {
      results.teamMembers.extraInSupabase.push({
        id,
        teamId: sbData.team_id,
        staffId: sbData.staff_id
      });
    }
  }

  // Check for orphaned team members (referencing non-existent teams or staff)
  sbMembers.forEach(m => {
    if (!sbTeamIds.has(m.team_id)) {
      results.teamMembers.orphanedInSupabase.push({
        id: m.id,
        reason: 'Team not found',
        teamId: m.team_id,
        staffId: m.staff_id
      });
    }
    if (!sbStaffIds.has(m.staff_id)) {
      results.teamMembers.orphanedInSupabase.push({
        id: m.id,
        reason: 'Staff not found',
        teamId: m.team_id,
        staffId: m.staff_id
      });
    }
  });

  // Report results
  log(`\n📊 Team Members Validation Results:`);
  log(`   FileMaker records: ${results.teamMembers.inFileMaker}`);
  log(`   Supabase records: ${results.teamMembers.inSupabase}`);
  log(`   Matched records: ${results.teamMembers.matched}`);
  log(`   Missing in Supabase: ${results.teamMembers.missingInSupabase.length}`);
  log(`   Extra in Supabase: ${results.teamMembers.extraInSupabase.length}`);
  log(`   Orphaned in Supabase: ${results.teamMembers.orphanedInSupabase.length}`);

  if (results.teamMembers.missingInSupabase.length > 0) {
    log(`\n❌ Missing team members in Supabase:`);
    results.teamMembers.missingInSupabase.forEach(m => {
      log(`   - Member ${m.id}: Team ${m.teamId} ← Staff ${m.staffId}`);
    });
  }

  if (results.teamMembers.extraInSupabase.length > 0) {
    log(`\n⚠️  Extra team members in Supabase (not in FileMaker):`);
    results.teamMembers.extraInSupabase.forEach(m => {
      log(`   - Member ${m.id}: Team ${m.teamId} ← Staff ${m.staffId}`);
    });
  }

  if (results.teamMembers.orphanedInSupabase.length > 0) {
    log(`\n❌ Orphaned team members in Supabase (invalid foreign keys):`);
    results.teamMembers.orphanedInSupabase.forEach(m => {
      log(`   - Member ${m.id}: ${m.reason} (Team: ${m.teamId}, Staff: ${m.staffId})`);
    });
  }
}

/**
 * Print validation summary
 */
function printSummary() {
  log(`\n${'='.repeat(60)}`);
  log(`📋 VALIDATION SUMMARY`);
  log(`${'='.repeat(60)}`);

  const totalIssues =
    results.staff.missingInSupabase.length +
    results.staff.extraInSupabase.length +
    results.staff.dataMismatches.length +
    results.teams.missingInSupabase.length +
    results.teams.extraInSupabase.length +
    results.teams.dataMismatches.length +
    results.teamMembers.missingInSupabase.length +
    results.teamMembers.extraInSupabase.length +
    results.teamMembers.orphanedInSupabase.length +
    (results.teamMembers.dataMismatches?.length || 0);

  log(`\n📊 Overall Statistics:`);
  log(`   Staff matched: ${results.staff.matched}/${results.staff.inFileMaker}`);
  log(`   Teams matched: ${results.teams.matched}/${results.teams.inFileMaker}`);
  log(`   Team members matched: ${results.teamMembers.matched}/${results.teamMembers.inFileMaker}`);
  log(`\n   Total issues found: ${totalIssues}`);

  log(`\n${'='.repeat(60)}`);
  if (totalIssues === 0) {
    log(`✅ VALIDATION PASSED - All data migrated correctly!`);
    log(`   All FileMaker records found in Supabase`);
    log(`   All data fields match between systems`);
    log(`   No orphaned records or invalid references`);
  } else {
    log(`⚠️  VALIDATION COMPLETED WITH ISSUES`);
    log(`   Please review the issues above`);
    log(`   Consider re-running the migration script for missing records`);
  }
  log(`${'='.repeat(60)}\n`);

  // Save report if requested
  if (reportFile) {
    const reportPath = path.resolve(reportFile);
    fs.writeFileSync(reportPath, reportBuffer.join('\n'), 'utf8');
    console.log(`\n📄 Validation report saved to: ${reportPath}`);
  }
}

/**
 * Main validation function
 */
async function main() {
  const startTime = Date.now();

  log('\n' + '='.repeat(60));
  log('🔍 TEAMS MIGRATION VALIDATION - FileMaker vs Supabase');
  log('='.repeat(60));
  log(`Organization ID: ${organizationId}`);
  log(`Verbose mode: ${verbose ? 'YES' : 'NO'}`);
  log(`Report file: ${reportFile || 'None'}`);
  log('='.repeat(60));

  try {
    // Step 1: Fetch FileMaker data
    log(`\n${'='.repeat(60)}`);
    log(`📥 FETCHING DATA FROM FILEMAKER`);
    log(`${'='.repeat(60)}`);

    log(`\n👥 Fetching staff from ${FM_LAYOUTS.STAFF}...`);
    const fmStaff = await fetchFileMakerRecords(FM_LAYOUTS.STAFF);
    log(`   ✅ Fetched ${fmStaff.length} staff members`);

    log(`\n🏢 Fetching teams from ${FM_LAYOUTS.TEAMS}...`);
    const fmTeams = await fetchFileMakerRecords(FM_LAYOUTS.TEAMS);
    log(`   ✅ Fetched ${fmTeams.length} teams`);

    log(`\n🔗 Fetching team members from ${FM_LAYOUTS.TEAM_MEMBERS}...`);
    const fmTeamMembers = await fetchFileMakerRecords(FM_LAYOUTS.TEAM_MEMBERS);
    log(`   ✅ Fetched ${fmTeamMembers.length} team member assignments`);

    // Step 2: Fetch Supabase data
    log(`\n${'='.repeat(60)}`);
    log(`📥 FETCHING DATA FROM SUPABASE`);
    log(`${'='.repeat(60)}`);

    log(`\n👥 Fetching staff from Supabase...`);
    const { data: sbStaff, error: staffError } = await supabase
      .from('staff')
      .select('*')
      .eq('organization_id', organizationId);

    if (staffError) {
      throw new Error(`Failed to fetch staff from Supabase: ${staffError.message}`);
    }
    log(`   ✅ Fetched ${sbStaff.length} staff members`);

    log(`\n🏢 Fetching teams from Supabase...`);
    const { data: sbTeams, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .eq('organization_id', organizationId);

    if (teamsError) {
      throw new Error(`Failed to fetch teams from Supabase: ${teamsError.message}`);
    }
    log(`   ✅ Fetched ${sbTeams.length} teams`);

    log(`\n🔗 Fetching team members from Supabase...`);
    const { data: sbTeamMembers, error: membersError } = await supabase
      .from('team_members')
      .select('*')
      .eq('organization_id', organizationId);

    if (membersError) {
      throw new Error(`Failed to fetch team members from Supabase: ${membersError.message}`);
    }
    log(`   ✅ Fetched ${sbTeamMembers.length} team member assignments`);

    // Step 3: Validate staff
    await validateStaff(fmStaff, sbStaff);

    // Step 4: Validate teams
    await validateTeams(fmTeams, sbTeams);

    // Step 5: Validate team members
    await validateTeamMembers(fmTeamMembers, sbTeamMembers, sbTeams, sbStaff);

    // Step 6: Print summary
    printSummary();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`⏱️  Total duration: ${duration} seconds\n`);

    // Exit with appropriate code
    const totalIssues =
      results.staff.missingInSupabase.length +
      results.staff.extraInSupabase.length +
      results.staff.dataMismatches.length +
      results.teams.missingInSupabase.length +
      results.teams.extraInSupabase.length +
      results.teams.dataMismatches.length +
      results.teamMembers.missingInSupabase.length +
      results.teamMembers.extraInSupabase.length +
      results.teamMembers.orphanedInSupabase.length +
      (results.teamMembers.dataMismatches?.length || 0);

    process.exit(totalIssues > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n💥 Fatal error during validation:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run validation
main();
