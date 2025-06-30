import { useState, useCallback, useEffect } from 'react';
import { useAppState } from '../context/AppStateContext';
import {
  synchronizeFinancialRecords,
  getFinancialSyncStatus
} from '../services/financialSyncService';
import {
  getPendingSyncSummary
} from '../services/syncTrackingService';

/**
 * Hook for managing financial synchronization between devRecords and customer_sales
 */
export function useFinancialSync() {
  const { user } = useAppState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [lastSyncResult, setLastSyncResult] = useState(null);

  // Debug logging for user information in hook
  useEffect(() => {
    console.log('[useFinancialSync] Debug - User data received:', {
      user,
      hasUser: !!user,
      supabaseOrgID: user?.supabaseOrgID,
      supabaseOrgId: user?.supabaseOrgId,
      userKeys: user ? Object.keys(user) : 'No user'
    });
  }, [user]);

  /**
   * Gets the synchronization status for a date range
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Promise<Object>} - Status result
   */
  const checkSyncStatus = useCallback(async (startDate, endDate) => {
    if (!user?.supabaseOrgID && !user?.supabaseOrgId) {
      const error = 'Organization ID is required';
      setError(error);
      return { success: false, error };
    }

    // Get the organization ID from either property name (for backward compatibility)
    const orgId = user?.supabaseOrgID || user?.supabaseOrgId;

    if (!startDate || !endDate) {
      const error = 'Start date and end date are required';
      setError(error);
      return { success: false, error };
    }

    try {
      setLoading(true);
      setError(null);

      console.log(`Checking sync status for ${orgId} from ${startDate} to ${endDate}`);
      
      const result = await getFinancialSyncStatus(orgId, startDate, endDate);
      
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
    if (!user?.supabaseOrgID && !user?.supabaseOrgId) {
      const error = 'Organization ID is required';
      setError(error);
      return { success: false, error };
    }

    // Get the organization ID from either property name (for backward compatibility)
    const orgId = user?.supabaseOrgID || user?.supabaseOrgId;

    if (!startDate || !endDate) {
      const error = 'Start date and end date are required';
      setError(error);
      return { success: false, error };
    }

    try {
      setLoading(true);
      setError(null);

      console.log(`Previewing sync for ${orgId} from ${startDate} to ${endDate}`);
      
      const result = await synchronizeFinancialRecords(
        orgId,
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
    if (!user?.supabaseOrgID && !user?.supabaseOrgId) {
      const error = 'Organization ID is required';
      setError(error);
      return { success: false, error };
    }

    // Get the organization ID from either property name (for backward compatibility)
    const orgId = user?.supabaseOrgID || user?.supabaseOrgId;

    if (!startDate || !endDate) {
      const error = 'Start date and end date are required';
      setError(error);
      return { success: false, error };
    }

    try {
      setLoading(true);
      setError(null);

      console.log(`Performing sync for ${orgId} from ${startDate} to ${endDate}`);
      
      const result = await synchronizeFinancialRecords(
        orgId,
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

  /**
   * Performs a review to identify what needs syncing (stores in sessionStorage)
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @param {Object} options - Synchronization options
   * @returns {Promise<Object>} - Review result
   */
  const performReview = useCallback(async (startDate, endDate, options = {}) => {
    return await performSync(startDate, endDate, { ...options, dryRun: true });
  }, [performSync]);

  /**
   * Syncs only the pending records stored in sessionStorage
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @param {Object} options - Synchronization options
   * @returns {Promise<Object>} - Sync result
   */
  const syncPendingOnly = useCallback(async (startDate, endDate, options = {}) => {
    return await performSync(startDate, endDate, { ...options, usePendingOnly: true });
  }, [performSync]);

  /**
   * Gets pending sync summary from sessionStorage
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Object} - Pending sync summary
   */
  const getPendingSummary = useCallback((startDate, endDate) => {
    if (!user?.supabaseOrgID && !user?.supabaseOrgId) {
      return {
        hasPending: false,
        toCreate: 0,
        toUpdate: 0,
        toDelete: 0,
        lastReview: null
      };
    }

    const orgId = user?.supabaseOrgID || user?.supabaseOrgId;
    return getPendingSyncSummary(orgId, startDate, endDate);
  }, [user?.supabaseOrgID]);

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
    performReview,
    syncPendingOnly,
    syncCurrentMonth,
    syncPreviousMonth,
    syncMonth,
    checkCurrentMonthStatus,
    checkPreviousMonthStatus,
    
    // New tracking functions
    getPendingSummary,
    
    // Utility functions
    clearError,
    clearSyncStatus,
    clearLastSyncResult
  };
}