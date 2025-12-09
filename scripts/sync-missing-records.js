/**
 * Manual Sync Script for Missing Billing Records
 *
 * This script syncs billing records from FileMaker (dapiRecords) to Supabase (customer_sales)
 * for the period from September 2024 to December 2024.
 *
 * Usage:
 *   node scripts/sync-missing-records.js <organization_id>
 *
 * Example:
 *   node scripts/sync-missing-records.js "your-org-uuid-here"
 */

import { synchronizeFinancialRecords } from '../src/services/financialSyncService.js';

// Parse command line arguments
const args = process.argv.slice(2);
const organizationId = args[0];

if (!organizationId) {
  console.error('❌ Error: Organization ID is required');
  console.log('\nUsage: node scripts/sync-missing-records.js <organization_id>');
  console.log('Example: node scripts/sync-missing-records.js "a1b2c3d4-e5f6-7890-abcd-ef1234567890"');
  process.exit(1);
}

// Define the date ranges to sync (month by month for better error handling)
const syncPeriods = [
  { name: 'September 2024', start: '2024-09-01', end: '2024-09-30' },
  { name: 'October 2024', start: '2024-10-01', end: '2024-10-31' },
  { name: 'November 2024', start: '2024-11-01', end: '2024-11-30' },
  { name: 'December 2024', start: '2024-12-01', end: '2024-12-31' },
  { name: 'January 2025 (verify)', start: '2025-01-01', end: '2025-01-31' }
];

async function syncPeriod(organizationId, period) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📅 Syncing: ${period.name}`);
  console.log(`   From: ${period.start} to ${period.end}`);
  console.log(`${'='.repeat(60)}`);

  try {
    const result = await synchronizeFinancialRecords(
      organizationId,
      period.start,
      period.end,
      {
        dryRun: false,  // Set to true for testing without making changes
        deleteOrphaned: false  // Don't delete orphaned records
      }
    );

    if (result.success) {
      console.log(`\n✅ Success for ${period.name}:`);
      console.log(`   📊 Summary:`);
      console.log(`      - DevRecords found: ${result.summary.devRecordsCount}`);
      console.log(`      - Customer Sales (before): ${result.summary.customerSalesCount}`);
      console.log(`      - Created: ${result.changes.created.length}`);
      console.log(`      - Updated: ${result.changes.updated.length}`);
      console.log(`      - Errors: ${result.changes.errors.length}`);
      console.log(`   ⏱️  Duration: ${result.duration}ms`);

      if (result.changes.errors.length > 0) {
        console.log(`\n⚠️  Errors encountered:`);
        result.changes.errors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error.type}: ${error.error}`);
        });
      }

      return {
        period: period.name,
        success: true,
        created: result.changes.created.length,
        updated: result.changes.updated.length,
        errors: result.changes.errors.length
      };
    } else {
      console.error(`\n❌ Failed for ${period.name}:`);
      console.error(`   Error: ${result.error}`);

      return {
        period: period.name,
        success: false,
        error: result.error
      };
    }
  } catch (error) {
    console.error(`\n❌ Exception for ${period.name}:`);
    console.error(`   Error: ${error.message}`);

    return {
      period: period.name,
      success: false,
      error: error.message
    };
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🔄 FINANCIAL RECORDS SYNC SCRIPT');
  console.log('='.repeat(60));
  console.log(`Organization ID: ${organizationId}`);
  console.log(`Periods to sync: ${syncPeriods.length}`);
  console.log('='.repeat(60));

  const results = [];

  for (const period of syncPeriods) {
    const result = await syncPeriod(organizationId, period);
    results.push(result);

    // Small delay between syncs to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 SYNC SUMMARY');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const totalCreated = successful.reduce((sum, r) => sum + (r.created || 0), 0);
  const totalUpdated = successful.reduce((sum, r) => sum + (r.updated || 0), 0);
  const totalErrors = successful.reduce((sum, r) => sum + (r.errors || 0), 0);

  console.log(`\n✅ Successful periods: ${successful.length}/${syncPeriods.length}`);
  console.log(`❌ Failed periods: ${failed.length}/${syncPeriods.length}`);
  console.log(`\n📊 Total Records:`);
  console.log(`   - Created: ${totalCreated}`);
  console.log(`   - Updated: ${totalUpdated}`);
  console.log(`   - Errors: ${totalErrors}`);

  if (failed.length > 0) {
    console.log(`\n⚠️  Failed Periods:`);
    failed.forEach(f => {
      console.log(`   - ${f.period}: ${f.error}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 Sync complete!');
  console.log('='.repeat(60) + '\n');

  process.exit(failed.length > 0 ? 1 : 0);
}

// Run the sync
main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
