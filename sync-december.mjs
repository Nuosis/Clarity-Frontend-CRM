/**
 * Quick sync for December 2025
 */
import { synchronizeFinancialRecords } from './src/services/financialSyncService.js';

const ORG_ID = '9816c057-b5d3-43a2-848f-99365ee6255e';

console.log('🔄 Syncing December 2025...\n');

try {
  const result = await synchronizeFinancialRecords(
    ORG_ID,
    '2025-12-01',
    '2025-12-31',
    { dryRun: false, deleteOrphaned: false }
  );

  if (result.success) {
    console.log('✅ Success!');
    console.log(`   Created: ${result.changes.created.length}`);
    console.log(`   Updated: ${result.changes.updated.length}`);
    console.log(`   Errors: ${result.changes.errors.length}`);

    if (result.changes.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      result.changes.errors.forEach(e => console.log(`   - ${e.error}`));
    }
  } else {
    console.error('❌ Failed:', result.error);
  }
} catch (error) {
  console.error('💥 Error:', error.message);
}
