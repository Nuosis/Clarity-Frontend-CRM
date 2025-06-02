import { useState, useCallback } from 'react';
import { useAppState } from '../context/AppStateContext';
import { 
  synchronizeFinancialRecords, 
  getFinancialSyncStatus 
} from '../services/financialSyncService';

/**
 * Hook for managing financial synchronization between devRecords and customer_sales
 */
export function useFinancialSync() {
  const { user } = useAppState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [lastSyncResult, setLastSyncResult] = useState(null);

  /**
   * Gets the synchronization status for a date range
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Promise<Object>} - Status result
   */
  const checkSyncStatus = useCallback(async (startDate, endDate) => {
    if (!user?.supabaseOrgID) {
      const error = 'Organization ID is required';
      setError(error);
      return { success: false, error };
    }

    if (!startDate || !endDate) {
      const error = 'Start date and end date are required';
      setError(error);
      return { success: false, error };
    }

    try {
      setLoading(true);
      setError(null);

      console.log(`Checking sync status for ${user.supabaseOrgID} from ${startDate} to ${endDate}`);
      
      const result = await getFinancialSyncStatus(user.supabaseOrgID, startDate, endDate);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get sync status');
      }

      setSyncStatus(result.status);
      
      return {
        success: true,
        data: result
      };
    } catch (err) {
      console.error('Error checking sync status:', err);
      setError(err.message);
      return {
        success: false,
        error: err.message
      };
    } finally {
      setLoading(false);
    }
  }, [user?.supabaseOrgID]);

  /**
   * Performs a dry run synchronization to preview changes
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @param {Object} options - Synchronization options
   * @returns {Promise<Object>} - Dry run result
   */
  const previewSync = useCallback(async (startDate, endDate, options = {}) => {
    if (!user?.supabaseOrgID) {
      const error = 'Organization ID is required';
      setError(error);
      return { success: false, error };
    }

    if (!startDate || !endDate) {
      const error = 'Start date and end date are required';
      setError(error);
      return { success: false, error };
    }

    try {
      setLoading(true);
      setError(null);

      console.log(`Previewing sync for ${user.supabaseOrgID} from ${startDate} to ${endDate}`);
      
      const result = await synchronizeFinancialRecords(
        user.supabaseOrgID, 
        startDate, 
        endDate, 
        { ...options, dryRun: true }
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to preview synchronization');
      }

      setLastSyncResult(result);
      
      return {
        success: true,
        data: result
      };
    } catch (err) {
      console.error('Error previewing sync:', err);
      setError(err.message);
      return {
        success: false,
        error: err.message
      };
    } finally {
      setLoading(false);
    }
  }, [user?.supabaseOrgID]);

  /**
   * Performs actual synchronization
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @param {Object} options - Synchronization options
   * @param {boolean} options.deleteOrphaned - Whether to delete orphaned customer_sales records
   * @returns {Promise<Object>} - Synchronization result
   */
  const performSync = useCallback(async (startDate, endDate, options = {}) => {
    if (!user?.supabaseOrgID) {
      const error = 'Organization ID is required';
      setError(error);
      return { success: false, error };
    }

    if (!startDate || !endDate) {
      const error = 'Start date and end date are required';
      setError(error);
      return { success: false, error };
    }

    try {
      setLoading(true);
      setError(null);

      console.log(`Performing sync for ${user.supabaseOrgID} from ${startDate} to ${endDate}`);
      
      const result = await synchronizeFinancialRecords(
        user.supabaseOrgID, 
        startDate, 
        endDate, 
        { ...options, dryRun: false }
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to synchronize records');
      }

      setLastSyncResult(result);
      
      // Update sync status after successful sync
      await checkSyncStatus(startDate, endDate);
      
      return {
        success: true,
        data: result
      };
    } catch (err) {
      console.error('Error performing sync:', err);
      setError(err.message);
      return {
        success: false,
        error: err.message
      };
    } finally {
      setLoading(false);
    }
  }, [user?.supabaseOrgID, checkSyncStatus]);

  /**
   * Synchronizes records for the current month
   * @param {Object} options - Synchronization options
   * @returns {Promise<Object>} - Synchronization result
   */
  const syncCurrentMonth = useCallback(async (options = {}) => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    
    return await performSync(startDate, endDate, options);
  }, [performSync]);

  /**
   * Synchronizes records for the previous month
   * @param {Object} options - Synchronization options
   * @returns {Promise<Object>} - Synchronization result
   */
  const syncPreviousMonth = useCallback(async (options = {}) => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    
    return await performSync(startDate, endDate, options);
  }, [performSync]);

  /**
   * Synchronizes records for a specific month
   * @param {number} year - The year
   * @param {number} month - The month (1-12)
   * @param {Object} options - Synchronization options
   * @returns {Promise<Object>} - Synchronization result
   */
  const syncMonth = useCallback(async (year, month, options = {}) => {
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    
    return await performSync(startDate, endDate, options);
  }, [performSync]);

  /**
   * Gets sync status for the current month
   * @returns {Promise<Object>} - Status result
   */
  const checkCurrentMonthStatus = useCallback(async () => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    
    return await checkSyncStatus(startDate, endDate);
  }, [checkSyncStatus]);

  /**
   * Gets sync status for the previous month
   * @returns {Promise<Object>} - Status result
   */
  const checkPreviousMonthStatus = useCallback(async () => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    
    return await checkSyncStatus(startDate, endDate);
  }, [checkSyncStatus]);

  /**
   * Clears the current error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Clears the sync status
   */
  const clearSyncStatus = useCallback(() => {
    setSyncStatus(null);
  }, []);

  /**
   * Clears the last sync result
   */
  const clearLastSyncResult = useCallback(() => {
    setLastSyncResult(null);
  }, []);

  return {
    // State
    loading,
    error,
    syncStatus,
    lastSyncResult,
    
    // Actions
    checkSyncStatus,
    previewSync,
    performSync,
    syncCurrentMonth,
    syncPreviousMonth,
    syncMonth,
    checkCurrentMonthStatus,
    checkPreviousMonthStatus,
    
    // Utility functions
    clearError,
    clearSyncStatus,
    clearLastSyncResult
  };
}