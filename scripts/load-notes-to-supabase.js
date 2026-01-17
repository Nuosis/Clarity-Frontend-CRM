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

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

/**
 * Retry a batch insert with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} baseDelay - Base delay in seconds for exponential backoff (default: 2)
 * @returns {Promise} Result of the function call
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 2) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        // Calculate exponential backoff: 2^attempt seconds
        const delaySeconds = Math.pow(baseDelay, attempt + 1);
        const delayMs = delaySeconds * 1000;

        console.warn(`  ⚠️  Attempt ${attempt + 1} failed, retrying in ${delaySeconds}s...`);
        console.warn(`  Error: ${error.message}`);

        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  // All retries exhausted
  throw lastError;
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
      // Retry batch insert with exponential backoff (3 retries, 2^attempt seconds)
      await retryWithBackoff(async () => {
        const { data, error } = await supabase
          .from('notes')
          .insert(batch);

        if (error) {
          throw new Error(`Batch insert failed: ${error.message}`);
        }

        return data;
      }, 3, 2);

      successCount += batch.length;
      console.log(`  ✅ Batch ${i + 1} completed`);

    } catch (error) {
      console.error(`  ❌ Batch ${i + 1} failed after all retry attempts:`, error.message);
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
