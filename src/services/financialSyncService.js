/**
 * Financial Synchronization Service
 *
 * ⚠️ DEPRECATED - DO NOT USE FOR NEW CODE
 *
 * This service was designed for dual-write synchronization between FileMaker (devRecords)
 * and Supabase (customer_sales). **ALL FILEMAKER RECONCILIATION LOGIC HAS BEEN REMOVED.**
 *
 * REMOVED as of TSK0012:
 * - FileMaker devRecords fetching and comparison
 * - Dual-write synchronization logic
 * - FileMaker-specific date conversions
 *
 * MIGRATION STATUS:
 * 1. Timer entries go directly to Supabase via create_financial_record RPC (TSK0009)
 * 2. Supabase customer_sales is the single source of truth
 * 3. Backend API handles all financial record operations (/api/financial-records)
 * 4. FileMaker is being phased out per CLAUDE.md migration strategy
 *
 * CURRENT USE: Historical data validation only
 * - Utility functions for customer_sales validation
 * - Legacy migration scripts (to be removed)
 *
 * FOR NEW CODE: Use src/api/financialRecords.js directly
 * - Backend API endpoints for all CRUD operations
 * - Direct Supabase queries via dataService when needed
 * - No synchronization or reconciliation needed
 *
 * See FINANCIAL_SYNC_SERVICE_DEPRECATION.md for full analysis
 *
 * @deprecated Use Backend API (src/api/financialRecords.js) instead
 */
import { query } from './supabaseService';

// REMOVED IMPORTS (TSK0012 - FileMaker reconciliation removal):
// - fetchRecordsForDateRange (was for FileMaker devRecords)
// - processFinancialData (was for FileMaker data processing)
// - storeSyncTracking, getSyncTracking, clearSyncTracking, hasPendingSync (sync tracking no longer needed)
// - update, insert, remove from supabaseService (no longer performing CRUD operations)

/**
 * DEPRECATED: Validates customer_sales records for a given date range
 *
 * @deprecated This function is obsolete. FileMaker reconciliation has been removed.
 * Use Backend API (src/api/financialRecords.js) for all financial record operations.
 *
 * This function now only validates existing customer_sales records.
 * It no longer compares with FileMaker devRecords or performs dual-write synchronization.
 *
 * @param {string} organizationId - The organization ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {Object} options - Additional options
 * @param {boolean} options.dryRun - If true, only reports what would be validated
 * @returns {Promise<Object>} - Validation result
 */
export async function synchronizeFinancialRecords(organizationId, startDate, endDate, options = {}) {
  console.warn('[financialSyncService] DEPRECATED: synchronizeFinancialRecords is obsolete. Use Backend API instead.');
  console.warn('[financialSyncService] FileMaker reconciliation has been removed as of TSK0012.');

  const { dryRun = false } = options;
  const syncStartTime = Date.now();

  try {
    console.log(`[DEPRECATED] Validating customer_sales for organization ${organizationId} from ${startDate} to ${endDate}`);

    // Fetch customer_sales for the date range and organization (Supabase only)
    const customerSalesResult = await fetchCustomerSalesForDateRange(organizationId, startDate, endDate);
    if (!customerSalesResult.success) {
      throw new Error(`Failed to fetch customer_sales: ${customerSalesResult.error}`);
    }

    const customerSales = customerSalesResult.data;
    console.log(`Found ${customerSales.length} customer_sales records for date range`);

    // Simple validation result (no FileMaker comparison)
    const validationResult = {
      success: true,
      summary: {
        customerSalesCount: customerSales.length,
        recordsValidated: customerSales.length,
        syncType: 'validation_only'
      },
      changes: {
        created: [],
        updated: [],
        deleted: [],
        errors: []
      },
      duration: Date.now() - syncStartTime,
      dryRun,
      deprecationNotice: 'FileMaker reconciliation removed. This function only validates existing customer_sales records.'
    };

    console.log(`Validation completed. Records: ${customerSales.length}, Duration: ${validationResult.duration}ms`);

    return validationResult;

  } catch (error) {
    console.error('Error during financial validation:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * REMOVED: fetchDevRecordsForDateRange
 *
 * This function was removed as part of TSK0012 (FileMaker reconciliation removal).
 * It previously fetched FileMaker devRecords for comparison with customer_sales.
 *
 * MIGRATION: Use Backend API instead
 * - fetchRecordsForDateRange() from src/api/financialRecords.js
 * - Direct backend API calls via dataService
 */

/**
 * Fetches customer_sales records for a specific date range and organization
 * @param {string} organizationId - The organization ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Object>} - Result with customer_sales data
 */
async function fetchCustomerSalesForDateRange(organizationId, startDate, endDate) {
  try {
    const result = await query('customer_sales', {
      select: `id, date, customer_id, product_id, product_name, quantity,
        unit_price, total_price, inv_id, organization_id, created_at, updated_at, financial_id,
        customers(business_name)`,
      filters: [
        { type: 'eq', column: 'organization_id', value: organizationId },
        { type: 'gte', column: 'date', value: startDate },
        { type: 'lte', column: 'date', value: endDate }
      ],
      order: {
        column: 'date',
        ascending: true
      }
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch customer_sales');
    }
    
    return {
      success: true,
      data: result.data || []
    };
  } catch (error) {
    console.error('Error fetching customer_sales for date range:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * REMOVED: compareRecords
 *
 * This function was removed as part of TSK0012 (FileMaker reconciliation removal).
 * It previously compared FileMaker devRecords with Supabase customer_sales to identify differences.
 *
 * MIGRATION: No longer needed
 * - Backend API is the single source of truth
 * - No dual-write synchronization required
 * - Use Backend API for all financial record operations
 */

/**
 * REMOVED: identifyChanges
 *
 * This function was removed as part of TSK0012 (FileMaker reconciliation removal).
 * It previously compared devRecord fields with customer_sales to identify what needed updating.
 *
 * MIGRATION: No longer needed
 * - Backend API handles all record updates
 * - No field-by-field comparison required
 */

/**
 * REMOVED: createCustomerSaleFromDevRecord
 *
 * This function was removed as part of TSK0012 (FileMaker reconciliation removal).
 * It previously created customer_sales records from FileMaker devRecords.
 *
 * MIGRATION: Use Backend API instead
 * - createFinancialRecord() from src/api/financialRecords.js
 * - Backend handles customer_sales creation directly
 */

/**
 * REMOVED: updateCustomerSaleFromDevRecord
 *
 * This function was removed as part of TSK0012 (FileMaker reconciliation removal).
 * It previously updated customer_sales records based on FileMaker devRecords.
 *
 * MIGRATION: Use Backend API instead
 * - Backend API handles all updates directly
 * - No manual synchronization needed
 */

/**
 * REMOVED: getOrCreateCustomerId
 *
 * This function was removed as part of TSK0012 (FileMaker reconciliation removal).
 * It was only used by the removed FileMaker reconciliation functions.
 *
 * MIGRATION: Use Backend API customer endpoints instead
 * - Backend API handles customer creation and linking
 * - No manual customer ID resolution needed
 */

/**
 * REMOVED: ensureCustomerOrganizationLink
 *
 * This function was removed as part of TSK0012 (FileMaker reconciliation removal).
 * It was only used by the removed FileMaker reconciliation functions.
 *
 * MIGRATION: Backend API handles organization linking automatically
 */

/**
 * REMOVED: formatProductName
 *
 * This function was removed as part of TSK0012 (FileMaker reconciliation removal).
 * It was only used by the removed FileMaker reconciliation functions.
 *
 * NOTE: formatProductName still exists in src/utils/dataMappers.js if needed
 * The version here was FileMaker-specific.
 */

/**
 * REMOVED: convertToFileMakerDate
 *
 * This function was removed as part of TSK0012 (FileMaker reconciliation removal).
 * It previously converted dates to FileMaker's MM/DD/YYYY format.
 *
 * MIGRATION: No longer needed
 * - Backend API uses ISO 8601 date format (YYYY-MM-DD)
 * - No FileMaker-specific formatting required
 */

/**
 * DEPRECATED: Gets customer_sales record count for a date range
 *
 * @deprecated FileMaker synchronization has been removed. Use Backend API instead.
 *
 * This function now only returns a count of existing customer_sales records.
 * It no longer performs FileMaker comparison or identifies sync differences.
 *
 * @param {string} organizationId - The organization ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Object>} - Validation status summary
 */
export async function getFinancialSyncStatus(organizationId, startDate, endDate) {
  console.warn('[financialSyncService] DEPRECATED: getFinancialSyncStatus is obsolete. Use Backend API instead.');

  try {
    // Run validation to get record count
    const validationResult = await synchronizeFinancialRecords(organizationId, startDate, endDate, { dryRun: true });

    if (!validationResult.success) {
      throw new Error(validationResult.error);
    }

    return {
      success: true,
      status: {
        customerSalesCount: validationResult.summary.customerSalesCount,
        recordsValidated: validationResult.summary.recordsValidated
      },
      deprecationNotice: 'FileMaker reconciliation removed. This function only counts customer_sales records.'
    };
  } catch (error) {
    console.error('Error getting financial validation status:', error);
    return {
      success: false,
      error: error.message
    };
  }
}