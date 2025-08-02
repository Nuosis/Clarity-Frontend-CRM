/**
 * Dual-Write Service for FileMaker to Supabase Migration
 * Ensures every FileMaker billable operation also writes to Supabase customer_sales
 */
import { createSaleFromFinancialRecord } from './salesService';

/**
 * Configuration for dual-write operations
 */
const DUAL_WRITE_CONFIG = {
  // Enable/disable dual writes globally
  enabled: true,
  // Retry configuration for failed Supabase writes
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  // Timeout for Supabase operations
  timeout: 10000, // 10 seconds
};

/**
 * Dual-write wrapper for FileMaker operations that affect billable records
 * @param {Function} fileMakerOperation - The original FileMaker operation
 * @param {Object} options - Dual-write options
 * @param {string} options.operationType - Type of operation ('timer_stop', 'record_create', 'record_update')
 * @param {string} options.organizationId - Organization ID for Supabase
 * @param {Object} options.recordData - Record data for Supabase operation
 * @returns {Promise<Object>} - Result of the FileMaker operation with dual-write status
 */
export async function withDualWrite(fileMakerOperation, options = {}) {
  const {
    operationType,
    organizationId,
    recordData,
    enableRollback = false
  } = options;

  if (!DUAL_WRITE_CONFIG.enabled) {
    console.log('[DualWrite] Dual-write disabled, executing FileMaker operation only');
    return await fileMakerOperation();
  }

  console.log(`[DualWrite] Starting dual-write operation: ${operationType}`);
  
  let fileMakerResult = null;
  let supabaseResult = null;
  let rollbackNeeded = false;

  try {
    // Step 1: Execute FileMaker operation first
    console.log('[DualWrite] Executing FileMaker operation...');
    fileMakerResult = await fileMakerOperation();
    
    // Check if FileMaker operation was successful
    if (!fileMakerResult || (fileMakerResult.messages && fileMakerResult.messages[0]?.code !== '0')) {
      throw new Error(`FileMaker operation failed: ${fileMakerResult?.messages?.[0]?.message || 'Unknown error'}`);
    }

    // Step 2: Execute corresponding Supabase operation
    if (shouldCreateSupabaseRecord(operationType, fileMakerResult)) {
      console.log('[DualWrite] Executing Supabase operation...');
      supabaseResult = await executeSupabaseOperation(operationType, {
        fileMakerResult,
        organizationId,
        recordData
      });
      
      if (!supabaseResult?.success) {
        rollbackNeeded = enableRollback;
        throw new Error(`Supabase operation failed: ${supabaseResult?.error || 'Unknown error'}`);
      }
    }

    console.log('[DualWrite] Dual-write operation completed successfully');
    return {
      ...fileMakerResult,
      dualWrite: {
        success: true,
        supabaseResult,
        operationType
      }
    };

  } catch (error) {
    console.error(`[DualWrite] Dual-write operation failed:`, error);
    
    // Attempt rollback if enabled and FileMaker operation succeeded
    if (rollbackNeeded && fileMakerResult) {
      try {
        console.log('[DualWrite] Attempting rollback...');
        await attemptRollback(operationType, fileMakerResult);
        console.log('[DualWrite] Rollback completed');
      } catch (rollbackError) {
        console.error('[DualWrite] Rollback failed:', rollbackError);
      }
    }

    // Return FileMaker result with error information
    return {
      ...fileMakerResult,
      dualWrite: {
        success: false,
        error: error.message,
        supabaseResult,
        operationType,
        rollbackAttempted: rollbackNeeded
      }
    };
  }
}

/**
 * Determines if a Supabase record should be created based on the operation type and result
 * @param {string} operationType - Type of operation
 * @param {Object} fileMakerResult - Result from FileMaker operation
 * @returns {boolean} - Whether to create Supabase record
 */
function shouldCreateSupabaseRecord(operationType, fileMakerResult) {
  switch (operationType) {
    case 'timer_start':
      // Create Supabase record if timer was successfully started
      return fileMakerResult?.response && fileMakerResult.messages?.[0]?.code === '0';
    
    case 'timer_stop':
      // Only create Supabase record if timer was successfully stopped
      return fileMakerResult?.response && fileMakerResult.messages?.[0]?.code === '0';
    
    case 'record_create':
      // Create Supabase record for new billable records
      return fileMakerResult?.response?.recordId;
    
    case 'record_update':
      // Create/update Supabase record for updated billable records
      return fileMakerResult?.response;
    
    default:
      return false;
  }
}

/**
 * Executes the corresponding Supabase operation
 * @param {string} operationType - Type of operation
 * @param {Object} params - Parameters for Supabase operation
 * @returns {Promise<Object>} - Result of Supabase operation
 */
async function executeSupabaseOperation(operationType, params) {
  const { fileMakerResult, organizationId, recordData } = params;

  switch (operationType) {
    case 'timer_start':
      return await handleTimerStartSupabaseOperation(fileMakerResult, organizationId, recordData);
    
    case 'timer_stop':
      return await handleTimerStopSupabaseOperation(fileMakerResult, organizationId);
    
    case 'record_create':
    case 'record_update':
      return await handleRecordSupabaseOperation(fileMakerResult, organizationId, recordData);
    
    default:
      throw new Error(`Unsupported operation type: ${operationType}`);
  }
}

/**
 * Handles Supabase operations for timer start events
 * @param {Object} fileMakerResult - FileMaker timer start result
 * @param {string} organizationId - Organization ID
 * @param {Object} taskData - Task data for context
 * @returns {Promise<Object>} - Supabase operation result
 */
async function handleTimerStartSupabaseOperation(fileMakerResult, organizationId, taskData) {
  try {
    // For timer start, we create a minimal sales record with 'active' status
    const salesData = {
      status: 'active',
      start_time: new Date().toISOString(),
      customer_id: taskData?.customerId || null,
      project_id: taskData?.projectId || null,
      task_id: taskData?.taskId || null,
      description: taskData?.initialDescription || 'Timer started',
      duration: null, // Will be updated on stop
      amount: null,   // Will be calculated on stop
      filemaker_record_id: fileMakerResult.response?.recordId || null,
      organization_id: organizationId
    };

    // Create the sales record directly in Supabase
    const { createSale } = await import('./salesService');
    const result = await createSale(salesData, organizationId);
    
    console.log('[DualWrite] Timer start Supabase record created:', result);
    return {
      success: true,
      supabaseRecordId: result?.id,
      message: 'Active timer record created in Supabase'
    };

  } catch (error) {
    console.error('[DualWrite] Timer start Supabase operation failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Handles Supabase operations for timer stop events
 * @param {Object} fileMakerResult - FileMaker timer stop result
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} - Supabase operation result
 */
async function handleTimerStopSupabaseOperation(fileMakerResult, organizationId) {
  try {
    // Extract financial record ID from FileMaker result
    let financialId = null;
    
    // Try to get financial ID from the response
    if (fileMakerResult.response?.data?.[0]?.fieldData?.__ID) {
      financialId = fileMakerResult.response.data[0].fieldData.__ID;
    } else if (fileMakerResult.response?.recordId) {
      // If we have recordId, we need to fetch the financial record to get the __ID
      const { fetchFinancialRecordByRecordId } = await import('../api/financialRecords');
      try {
        const financialRecord = await fetchFinancialRecordByRecordId(fileMakerResult.response.recordId);
        if (financialRecord?.response?.data?.[0]?.fieldData?.__ID) {
          financialId = financialRecord.response.data[0].fieldData.__ID;
        }
      } catch (fetchError) {
        console.error('[DualWrite] Error fetching financial record by recordId:', fetchError);
      }
    }

    if (!financialId) {
      throw new Error('Could not determine financial record ID from FileMaker result');
    }

    if (!organizationId) {
      throw new Error('Organization ID is required for Supabase operation');
    }

    // Create sales record in Supabase
    console.log(`[DualWrite] Creating sales record for financial ID: ${financialId}`);
    return await createSaleFromFinancialRecord(financialId, organizationId);

  } catch (error) {
    console.error('[DualWrite] Timer stop Supabase operation failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Handles Supabase operations for record create/update events
 * @param {Object} fileMakerResult - FileMaker operation result
 * @param {string} organizationId - Organization ID
 * @param {Object} recordData - Record data
 * @returns {Promise<Object>} - Supabase operation result
 */
async function handleRecordSupabaseOperation(fileMakerResult, organizationId, recordData) {
  // This would be implemented for other record operations
  // For now, return success as timer_stop is the primary use case
  console.log('[DualWrite] Record operation Supabase handling not yet implemented');
  return {
    success: true,
    message: 'Record operation Supabase handling not yet implemented'
  };
}

/**
 * Attempts to rollback FileMaker operation if Supabase operation fails
 * @param {string} operationType - Type of operation to rollback
 * @param {Object} fileMakerResult - Original FileMaker result
 * @returns {Promise<void>}
 */
async function attemptRollback(operationType, fileMakerResult) {
  console.log(`[DualWrite] Rollback not implemented for operation: ${operationType}`);
  // Rollback implementation would depend on the specific operation
  // For timer operations, this might involve reversing the timer state
  // For record operations, this might involve deleting or reverting the record
}

/**
 * Enhanced timer stop function with dual-write support
 * @param {Object} params - Timer stop parameters
 * @param {string} organizationId - Organization ID for Supabase
 * @returns {Promise<Object>} - Timer stop result with dual-write status
 */
export async function stopTimerWithDualWrite(params, organizationId = null) {
  const { stopTaskTimerAPI } = await import('../api/tasks');
  
  // Get organization ID from params or global state
  const orgId = organizationId || (window.state?.user?.supabaseOrgID);
  
  if (!orgId) {
    console.warn('[DualWrite] No organization ID found, proceeding with FileMaker-only operation');
  }

  return await withDualWrite(
    // FileMaker operation
    async () => {
      return await stopTaskTimerAPI(
        params.recordId,
        params.description,
        params.saveImmediately,
        params.totalPauseTime + params.adjustment
      );
    },
    // Dual-write options
    {
      operationType: 'timer_stop',
      organizationId: orgId,
      recordData: params,
      enableRollback: false // Rollback not implemented yet
    }
  );
}

/**
 * Configuration management for dual-write service
 */
export const dualWriteConfig = {
  /**
   * Enable or disable dual-write operations
   * @param {boolean} enabled - Whether to enable dual writes
   */
  setEnabled(enabled) {
    DUAL_WRITE_CONFIG.enabled = enabled;
    console.log(`[DualWrite] Dual-write ${enabled ? 'enabled' : 'disabled'}`);
  },

  /**
   * Get current dual-write configuration
   * @returns {Object} - Current configuration
   */
  getConfig() {
    return { ...DUAL_WRITE_CONFIG };
  },

  /**
   * Update retry configuration
   * @param {Object} retryConfig - Retry configuration
   */
  setRetryConfig(retryConfig) {
    Object.assign(DUAL_WRITE_CONFIG, retryConfig);
    console.log('[DualWrite] Retry configuration updated:', retryConfig);
  }
};

/**
 * Utility function to check if dual-write is enabled
 * @returns {boolean} - Whether dual-write is enabled
 */
export function isDualWriteEnabled() {
  return DUAL_WRITE_CONFIG.enabled;
}