import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { syncInvoices } from '../../api/quickbooksApi';

/**
 * QuickBooksSyncPanel component for managing invoice synchronization with QuickBooks
 *
 * Features:
 * - Trigger manual sync of invoices from QuickBooks
 * - Show sync progress and status
 * - Display sync summary (synced count, new/updated invoices)
 * - Show last sync timestamp
 * - Error handling with retry option
 * - Date range selection for sync
 *
 * @param {Object} props - Component props
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 * @param {Function} props.onSyncComplete - Optional callback when sync completes successfully
 * @returns {JSX.Element} QuickBooks Sync Panel component
 */
function QuickBooksSyncPanel({ darkMode = false, onSyncComplete }) {
  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, syncing, success, error
  const [syncError, setSyncError] = useState(null);
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState(null);

  // Date range state (default: current month)
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    return { startDate, endDate };
  });

  // Sync options
  const [fullSync, setFullSync] = useState(false);

  /**
   * Load last sync info from localStorage on mount
   */
  useEffect(() => {
    const savedSyncInfo = localStorage.getItem('qb_last_sync');
    if (savedSyncInfo) {
      try {
        const { timestamp, result } = JSON.parse(savedSyncInfo);
        setLastSyncTimestamp(timestamp);
        setLastSyncResult(result);
      } catch (err) {
        console.error('Error loading last sync info:', err);
      }
    }
  }, []);

  /**
   * Handle sync invoices
   */
  const handleSync = useCallback(async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      setSyncError('Please select a valid date range');
      return;
    }

    setIsSyncing(true);
    setSyncStatus('syncing');
    setSyncError(null);

    try {
      const response = await syncInvoices({
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        full_sync: fullSync
      });

      if (response.success && response.data) {
        setSyncStatus('success');
        setLastSyncResult(response.data);
        const timestamp = new Date().toISOString();
        setLastSyncTimestamp(timestamp);

        // Save to localStorage
        localStorage.setItem('qb_last_sync', JSON.stringify({
          timestamp,
          result: response.data
        }));

        // Call optional callback
        if (onSyncComplete) {
          onSyncComplete(response.data);
        }
      } else {
        throw new Error(response.error || 'Sync failed');
      }
    } catch (err) {
      console.error('Error syncing invoices:', err);
      setSyncStatus('error');
      setSyncError(err.message || 'Failed to sync invoices');
    } finally {
      setIsSyncing(false);
    }
  }, [dateRange, fullSync, onSyncComplete]);

  /**
   * Handle retry after error
   */
  const handleRetry = useCallback(() => {
    setSyncError(null);
    setSyncStatus('idle');
  }, []);

  /**
   * Handle date range change
   */
  const handleDateChange = useCallback((field, value) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  /**
   * Set current month date range
   */
  const setCurrentMonth = useCallback(() => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    setDateRange({ startDate, endDate });
  }, []);

  /**
   * Set previous month date range
   */
  const setPreviousMonth = useCallback(() => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    setDateRange({ startDate, endDate });
  }, []);

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Never';

    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (err) {
      return timestamp;
    }
  };

  /**
   * Get status badge color
   */
  const getStatusBadge = () => {
    switch (syncStatus) {
      case 'syncing':
        return darkMode
          ? 'bg-blue-900 bg-opacity-30 text-blue-200 border-blue-800'
          : 'bg-blue-100 text-blue-800 border-blue-200';
      case 'success':
        return darkMode
          ? 'bg-green-900 bg-opacity-30 text-green-200 border-green-800'
          : 'bg-green-100 text-green-800 border-green-200';
      case 'error':
        return darkMode
          ? 'bg-red-900 bg-opacity-30 text-red-200 border-red-800'
          : 'bg-red-100 text-red-800 border-red-200';
      default:
        return darkMode
          ? 'bg-gray-700 text-gray-300 border-gray-600'
          : 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  /**
   * Get status text
   */
  const getStatusText = () => {
    switch (syncStatus) {
      case 'syncing':
        return 'Syncing...';
      case 'success':
        return 'Sync Complete';
      case 'error':
        return 'Sync Failed';
      default:
        return 'Ready';
    }
  };

  return (
    <div className={`
      p-6 rounded-lg border
      ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
    `}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Invoice Synchronization
          </h3>
          <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Sync invoices from QuickBooks to local database
          </p>
        </div>

        {/* Status Badge */}
        <div className={`
          px-3 py-1.5 rounded-full text-sm font-medium border
          ${getStatusBadge()}
        `}>
          {getStatusText()}
        </div>
      </div>

      {/* Error Display */}
      {syncError && syncStatus === 'error' && (
        <div className={`
          p-4 rounded-lg border mb-4
          ${darkMode ? 'bg-red-900 bg-opacity-30 border-red-800' : 'bg-red-50 border-red-200'}
        `}>
          <div className="flex justify-between items-start">
            <div>
              <p className={`text-sm font-medium ${darkMode ? 'text-red-200' : 'text-red-800'}`}>
                Sync Error
              </p>
              <p className={`text-xs mt-1 ${darkMode ? 'text-red-300' : 'text-red-600'}`}>
                {syncError}
              </p>
            </div>
            <button
              onClick={handleRetry}
              className={`
                text-xs px-3 py-1.5 rounded-lg transition-colors
                ${darkMode
                  ? 'bg-red-800 text-red-200 hover:bg-red-700'
                  : 'bg-red-100 text-red-800 hover:bg-red-200'}
              `}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Success Summary */}
      {syncStatus === 'success' && lastSyncResult && (
        <div className={`
          p-4 rounded-lg border mb-4
          ${darkMode ? 'bg-green-900 bg-opacity-30 border-green-800' : 'bg-green-50 border-green-200'}
        `}>
          <p className={`text-sm font-medium ${darkMode ? 'text-green-200' : 'text-green-800'}`}>
            Sync Successful
          </p>
          <div className="grid grid-cols-3 gap-4 mt-3">
            <div>
              <div className={`text-2xl font-semibold ${darkMode ? 'text-green-200' : 'text-green-800'}`}>
                {lastSyncResult.invoices_synced || 0}
              </div>
              <div className={`text-xs ${darkMode ? 'text-green-300' : 'text-green-600'}`}>
                Total Synced
              </div>
            </div>
            <div>
              <div className={`text-2xl font-semibold ${darkMode ? 'text-green-200' : 'text-green-800'}`}>
                {lastSyncResult.new_invoices || 0}
              </div>
              <div className={`text-xs ${darkMode ? 'text-green-300' : 'text-green-600'}`}>
                New Invoices
              </div>
            </div>
            <div>
              <div className={`text-2xl font-semibold ${darkMode ? 'text-green-200' : 'text-green-800'}`}>
                {lastSyncResult.updated_invoices || 0}
              </div>
              <div className={`text-xs ${darkMode ? 'text-green-300' : 'text-green-600'}`}>
                Updated
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sync Configuration */}
      <div className="space-y-4">
        {/* Date Range */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Date Range
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => handleDateChange('startDate', e.target.value)}
                disabled={isSyncing}
                className={`
                  w-full px-3 py-2 border rounded-lg text-sm
                  ${darkMode
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                End Date
              </label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => handleDateChange('endDate', e.target.value)}
                disabled={isSyncing}
                className={`
                  w-full px-3 py-2 border rounded-lg text-sm
                  ${darkMode
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              />
            </div>
          </div>

          {/* Quick Date Selection */}
          <div className="flex space-x-2 mt-2">
            <button
              onClick={setCurrentMonth}
              disabled={isSyncing}
              className={`
                text-xs px-3 py-1 rounded-lg transition-colors
                ${darkMode
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              Current Month
            </button>
            <button
              onClick={setPreviousMonth}
              disabled={isSyncing}
              className={`
                text-xs px-3 py-1 rounded-lg transition-colors
                ${darkMode
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              Previous Month
            </button>
          </div>
        </div>

        {/* Sync Options */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Sync Options
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={fullSync}
              onChange={(e) => setFullSync(e.target.checked)}
              disabled={isSyncing}
              className="mr-2"
            />
            <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Full sync (process all invoices, slower but thorough)
            </span>
          </label>
          {fullSync && (
            <p className={`text-xs mt-1 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
              Full sync will process all invoices in the date range, regardless of previous sync state.
            </p>
          )}
        </div>

        {/* Last Sync Info */}
        {lastSyncTimestamp && (
          <div className={`
            p-3 rounded-lg border text-sm
            ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}
          `}>
            <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Last Sync:
            </span>
            <span className={`ml-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {formatTimestamp(lastSyncTimestamp)}
            </span>
          </div>
        )}

        {/* Sync Button */}
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSync}
            disabled={isSyncing || !dateRange.startDate || !dateRange.endDate}
            className={`
              px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center space-x-2
              ${isSyncing || !dateRange.startDate || !dateRange.endDate
                ? (darkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed')
                : (darkMode
                  ? 'bg-blue-800 text-blue-100 hover:bg-blue-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700')
              }
            `}
          >
            {isSyncing && (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>

        {/* Progress Indicator */}
        {isSyncing && (
          <div className={`
            mt-4 p-3 rounded-lg border
            ${darkMode ? 'bg-blue-900 bg-opacity-30 border-blue-800' : 'bg-blue-50 border-blue-200'}
          `}>
            <p className={`text-sm ${darkMode ? 'text-blue-200' : 'text-blue-800'}`}>
              Syncing invoices from QuickBooks...
            </p>
            <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 dark:bg-blue-400 animate-pulse" style={{ width: '100%' }}></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

QuickBooksSyncPanel.propTypes = {
  darkMode: PropTypes.bool,
  onSyncComplete: PropTypes.func
};

export default React.memo(QuickBooksSyncPanel);
