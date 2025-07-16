import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useFinancialSync } from '../../hooks/useFinancialSync';
import { debugRecordProcessing } from '../../services/debugFinancialSync';
import { useAppState } from '../../context/AppStateContext';

/**
 * Component for managing financial synchronization between devRecords and customer_sales
 * @param {Object} props - Component props
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 * @param {function} [props.onSyncComplete] - Optional callback when sync is completed
 * @returns {JSX.Element} Financial sync panel component
 */
function FinancialSyncPanel({ darkMode = false, onSyncComplete }) {
  const appState = useAppState();
  const {
    loading,
    error,
    syncStatus,
    lastSyncResult,
    checkSyncStatus,
    previewSync,
    performSync,
    performReview,
    syncPendingOnly,
    syncCurrentMonth,
    syncPreviousMonth,
    checkCurrentMonthStatus,
    checkPreviousMonthStatus,
    getPendingSummary,
    clearError,
    clearSyncStatus,
    clearLastSyncResult
  } = useFinancialSync();

  // Debug logging for user information
  useEffect(() => {
    console.log('[FinancialSyncPanel] Debug - App State:', {
      user: appState.user,
      authentication: appState.authentication,
      environment: appState.environment
    });
    
    if (appState.user) {
      console.log('[FinancialSyncPanel] Debug - User properties:', {
        userEmail: appState.user.userEmail,
        userName: appState.user.userName,
        userID: appState.user.userID,
        supabaseUserID: appState.user.supabaseUserID,
        supabaseOrgID: appState.user.supabaseOrgID,
        supabaseOrgId: appState.user.supabaseOrgId,
        allUserKeys: Object.keys(appState.user)
      });
    } else {
      console.log('[FinancialSyncPanel] Debug - No user found in app state');
    }
  }, [appState.user, appState.authentication, appState.environment]);

  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [syncOptions, setSyncOptions] = useState({
    deleteOrphaned: false
  });
  const [syncType, setSyncType] = useState('auto');
  const [activeTab, setActiveTab] = useState('status');
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showRecordDetail, setShowRecordDetail] = useState(false);
  const [debugResult, setDebugResult] = useState(null);
  const [showDebugReport, setShowDebugReport] = useState(false);
  const [pendingSummary, setPendingSummary] = useState(null);

  // Initialize with current month dates
  useEffect(() => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    
    setDateRange({ startDate, endDate });
  }, []);

  // Auto-check status and get pending summary when date range changes
  useEffect(() => {
    if (dateRange.startDate && dateRange.endDate) {
      checkSyncStatus(dateRange.startDate, dateRange.endDate);
      
      // Get pending sync summary
      const summary = getPendingSummary(dateRange.startDate, dateRange.endDate);
      setPendingSummary(summary);
    }
  }, [dateRange.startDate, dateRange.endDate, checkSyncStatus, getPendingSummary]);

  const handleDateRangeChange = (field, value) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value
    }));
    clearSyncStatus();
    clearLastSyncResult();
  };

  const handlePreviewSync = async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      return;
    }

    const result = await previewSync(dateRange.startDate, dateRange.endDate, syncOptions);
    if (result.success) {
      setPreviewData(result.data);
      setShowPreview(true);
    }
  };

  const handlePerformReview = async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      return;
    }

    const result = await performReview(dateRange.startDate, dateRange.endDate, syncOptions);
    if (result.success) {
      // Update pending summary after review
      const summary = getPendingSummary(dateRange.startDate, dateRange.endDate);
      setPendingSummary(summary);
      
      if (onSyncComplete) {
        onSyncComplete(result.data);
      }
    }
  };

  const handleSyncPending = async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      return;
    }

    const result = await syncPendingOnly(dateRange.startDate, dateRange.endDate, syncOptions);
    if (result.success) {
      // Clear pending summary after successful sync
      setPendingSummary({
        hasPending: false,
        toCreate: 0,
        toUpdate: 0,
        toDelete: 0,
        lastReview: null
      });
      
      if (onSyncComplete) {
        onSyncComplete(result.data);
      }
    }
    setShowPreview(false);
    setPreviewData(null);
  };

  const handlePerformSync = async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      return;
    }

    const result = await performSync(dateRange.startDate, dateRange.endDate, syncOptions);
    if (result.success) {
      // Clear pending summary after successful sync
      setPendingSummary({
        hasPending: false,
        toCreate: 0,
        toUpdate: 0,
        toDelete: 0,
        lastReview: null
      });
      
      if (onSyncComplete) {
        onSyncComplete(result.data);
      }
    }
    setShowPreview(false);
    setPreviewData(null);
  };

  const handleRecordClick = (record, type) => {
    setSelectedRecord({ ...record, type });
    setShowRecordDetail(true);
  };

  const handleDebugRecord = async () => {
    try {
      console.log('🔍 Starting debug for record 79DE4747-2C6B-4D09-B82A-5BC767832E9A');
      const result = await debugRecordProcessing(
        '79DE4747-2C6B-4D09-B82A-5BC767832E9A',
        dateRange.startDate || '2024-01-01',
        dateRange.endDate || '2024-12-31',
        'your-org-id' // This should be replaced with actual org ID
      );
      console.log('✅ Debug completed:', result);
      setDebugResult(result);
      setShowDebugReport(true);
    } catch (error) {
      console.error('❌ Debug failed:', error);
      setDebugResult({ error: error.message });
      setShowDebugReport(true);
    }
  };

  const handleQuickSync = async (type) => {
    let result;
    switch (type) {
      case 'current':
        result = await syncCurrentMonth(syncOptions);
        break;
      case 'previous':
        result = await syncPreviousMonth(syncOptions);
        break;
      default:
        return;
    }
    
    if (result.success && onSyncComplete) {
      onSyncComplete(result.data);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD' 
    }).format(amount || 0);
  };

  const getSyncStatusColor = () => {
    if (!syncStatus) return darkMode ? 'text-gray-400' : 'text-gray-500';
    return syncStatus.inSync 
      ? (darkMode ? 'text-green-400' : 'text-green-600')
      : (darkMode ? 'text-yellow-400' : 'text-yellow-600');
  };

  const getSyncStatusText = () => {
    if (!syncStatus) return 'Unknown';
    return syncStatus.inSync ? 'In Sync' : 'Out of Sync';
  };

  return (
    <div className={`
      rounded-lg border overflow-hidden
      ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
    `}>
      {/* Header */}
      <div className={`
        px-4 py-3 border-b
        ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}
      `}>
        <h3 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Financial Synchronization
        </h3>
        <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Sync devRecords with customer sales data
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className={`
          px-4 py-3 border-b
          ${darkMode ? 'bg-red-900 border-red-700 text-red-200' : 'bg-red-50 border-red-200 text-red-700'}
        `}>
          <div className="flex justify-between items-center">
            <span className="text-sm">{error}</span>
            <button
              onClick={clearError}
              className={`
                text-xs px-2 py-1 rounded
                ${darkMode ? 'bg-red-800 hover:bg-red-700' : 'bg-red-100 hover:bg-red-200'}
              `}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className={`
        flex border-b
        ${darkMode ? 'border-gray-600' : 'border-gray-200'}
      `}>
        {['status', 'sync', 'history'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`
              px-4 py-2 text-sm font-medium capitalize
              ${activeTab === tab
                ? (darkMode ? 'bg-gray-700 text-white border-b-2 border-blue-500' : 'bg-white text-gray-900 border-b-2 border-blue-500')
                : (darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')
              }
            `}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Status Tab */}
        {activeTab === 'status' && (
          <div className="space-y-4">
            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
                  className={`
                    w-full px-3 py-2 border rounded-md text-sm
                    ${darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                    }
                  `}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  End Date
                </label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => handleDateRangeChange('endDate', e.target.value)}
                  className={`
                    w-full px-3 py-2 border rounded-md text-sm
                    ${darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                    }
                  `}
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex space-x-2">
              <button
                onClick={checkCurrentMonthStatus}
                disabled={loading}
                className={`
                  px-3 py-1 text-xs rounded border
                  ${darkMode
                    ? 'border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                Current Month
              </button>
              <button
                onClick={checkPreviousMonthStatus}
                disabled={loading}
                className={`
                  px-3 py-1 text-xs rounded border
                  ${darkMode
                    ? 'border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                Previous Month
              </button>
            </div>

            {/* Status Display */}
            {syncStatus && (
              <div className={`
                p-4 rounded-lg border
                ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}
              `}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Sync Status
                    </div>
                    <div className={`text-lg font-semibold ${getSyncStatusColor()}`}>
                      {getSyncStatusText()}
                    </div>
                  </div>
                  <div>
                    <div className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Records Summary
                    </div>
                    <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      DevRecords: {syncStatus.devRecordsCount}<br />
                      Customer Sales: {syncStatus.customerSalesCount}
                    </div>
                  </div>
                </div>

                {!syncStatus.inSync && (
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className={`text-lg font-semibold ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                        {syncStatus.recordsToCreate}
                      </div>
                      <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        To Create
                      </div>
                    </div>
                    <div className="text-center">
                      <div className={`text-lg font-semibold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                        {syncStatus.recordsToUpdate}
                      </div>
                      <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        To Update
                      </div>
                    </div>
                    <div className="text-center">
                      <div className={`text-lg font-semibold ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                        {syncStatus.unchangedRecords}
                      </div>
                      <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Unchanged
                      </div>
                    </div>
                  </div>
                )}
    
              </div>
            )}

            {loading && (
              <div className="text-center py-4">
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Checking synchronization status...
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sync Tab */}
        {activeTab === 'sync' && (
          <div className="space-y-4">
            {/* Sync Type Selection */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Sync Type
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="syncType"
                    value="auto"
                    checked={syncType === 'auto'}
                    onChange={(e) => setSyncType(e.target.value)}
                    className="mr-2"
                  />
                  <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Auto (Recommended) - System decides based on last sync
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="syncType"
                    value="incremental"
                    checked={syncType === 'incremental'}
                    onChange={(e) => setSyncType(e.target.value)}
                    className="mr-2"
                  />
                  <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Incremental - Only sync new/changed records
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="syncType"
                    value="full"
                    checked={syncType === 'full'}
                    onChange={(e) => setSyncType(e.target.value)}
                    className="mr-2"
                  />
                  <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Full - Process all records (slower but thorough)
                  </span>
                </label>
              </div>
            </div>

            {/* Sync Options */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Additional Options
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={syncOptions.deleteOrphaned}
                    onChange={(e) => setSyncOptions(prev => ({ ...prev, deleteOrphaned: e.target.checked }))}
                    className="mr-2"
                  />
                  <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Delete orphaned customer sales records
                  </span>
                </label>
              </div>
            </div>

            {/* Sync Actions */}
            <div className="space-y-3">
              <div className="flex space-x-2">
                <button
                  onClick={handlePreviewSync}
                  disabled={loading || !dateRange.startDate || !dateRange.endDate}
                  className={`
                    px-4 py-2 text-sm font-medium rounded-md border
                    ${darkMode
                      ? 'border-blue-600 bg-blue-700 text-white hover:bg-blue-600'
                      : 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {loading ? 'Loading...' : 'Preview Changes'}
                </button>
                
                <button
                  onClick={handlePerformSync}
                  disabled={loading || !dateRange.startDate || !dateRange.endDate}
                  className={`
                    px-4 py-2 text-sm font-medium rounded-md border
                    ${darkMode
                      ? 'border-green-600 bg-green-700 text-white hover:bg-green-600'
                      : 'border-green-600 bg-green-600 text-white hover:bg-green-700'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {loading ? 'Syncing...' : `Sync Now (${syncType})`}
                </button>
              </div>

              {/* Sync Type Info */}
              {syncType !== 'auto' && (
                <div className={`
                  p-3 rounded-lg text-sm
                  ${darkMode ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-50 text-yellow-800'}
                `}>
                  <strong>Note:</strong> {syncType === 'incremental'
                    ? 'Incremental sync will only process records that haven\'t been synced before. This is faster but may miss some changes if the tracking data is incomplete.'
                    : 'Full sync will process all records regardless of previous sync state. This is slower but ensures complete accuracy.'
                  }
                </div>
              )}

              <div className="border-t pt-3">
                <div className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Quick Sync
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleQuickSync('current')}
                    disabled={loading}
                    className={`
                      px-3 py-1 text-xs rounded border
                      ${darkMode
                        ? 'border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    Sync Current Month
                  </button>
                  <button
                    onClick={() => handleQuickSync('previous')}
                    disabled={loading}
                    className={`
                      px-3 py-1 text-xs rounded border
                      ${darkMode
                        ? 'border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    Sync Previous Month
                  </button>
                  <button
                    onClick={handleDebugRecord}
                    disabled={loading}
                    className={`
                      px-3 py-1 text-xs rounded border
                      ${darkMode
                        ? 'border-purple-600 bg-purple-700 text-purple-200 hover:bg-purple-600'
                        : 'border-purple-300 bg-purple-100 text-purple-700 hover:bg-purple-200'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    Debug Record 79DE
                  </button>
                </div>
              </div>
            </div>

            {/* Preview Modal */}
            {showPreview && previewData && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className={`
                  max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden rounded-lg
                  ${darkMode ? 'bg-gray-800' : 'bg-white'}
                `}>
                  <div className={`
                    px-4 py-3 border-b flex justify-between items-center
                    ${darkMode ? 'border-gray-600' : 'border-gray-200'}
                  `}>
                    <h3 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      Sync Preview
                    </h3>
                    <button
                      onClick={() => setShowPreview(false)}
                      className={`
                        text-sm px-2 py-1 rounded
                        ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}
                      `}
                    >
                      Close
                    </button>
                  </div>
                  
                  <div className="p-4 overflow-y-auto max-h-[60vh]">
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                          {previewData.summary.toCreate}
                        </div>
                        <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Records to Create
                        </div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                          {previewData.summary.toUpdate}
                        </div>
                        <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Records to Update
                        </div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                          {previewData.summary.toDelete}
                        </div>
                        <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Records to Delete
                        </div>
                      </div>
                    </div>

                    {previewData.changes.created.length > 0 && (
                      <div className="mb-4">
                        <h4 className={`font-medium mb-2 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                          Records to Create ({previewData.changes.created.length})
                        </h4>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {previewData.changes.created.map((record, index) => (
                            <div
                              key={index}
                              onClick={() => handleRecordClick(record, 'create')}
                              className={`text-xs p-2 rounded cursor-pointer hover:opacity-80 ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-50 hover:bg-gray-100'}`}
                            >
                              Financial ID: {record.devRecordId} - {record.customerName} - {record.projectName} - {formatCurrency(record.amount)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {previewData.changes.updated.length > 0 && (
                      <div className="mb-4">
                        <h4 className={`font-medium mb-2 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                          Records to Update ({previewData.changes.updated.length})
                        </h4>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {previewData.changes.updated.map((record, index) => (
                            <div
                              key={index}
                              onClick={() => handleRecordClick(record, 'update')}
                              className={`text-xs p-2 rounded cursor-pointer hover:opacity-80 ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-50 hover:bg-gray-100'}`}
                            >
                              Financial ID: {record.devRecordId} - Changes: {Object.keys(record.changes).join(', ')}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {previewData.changes.deleted.length > 0 && (
                      <div className="mb-4">
                        <h4 className={`font-medium mb-2 ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                          Records to Delete ({previewData.changes.deleted.length})
                        </h4>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {previewData.changes.deleted.map((record, index) => (
                            <div
                              key={index}
                              onClick={() => handleRecordClick(record, 'delete')}
                              className={`text-xs p-2 rounded cursor-pointer hover:opacity-80 ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-50 hover:bg-gray-100'}`}
                            >
                              ID: {record.customerSaleId} - Financial ID: {record.financialId}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className={`
                    px-4 py-3 border-t flex justify-end space-x-2
                    ${darkMode ? 'border-gray-600' : 'border-gray-200'}
                  `}>
                    <button
                      onClick={() => setShowPreview(false)}
                      className={`
                        px-3 py-1 text-sm rounded border
                        ${darkMode
                          ? 'border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                        }
                      `}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handlePerformSync}
                      disabled={loading}
                      className={`
                        px-3 py-1 text-sm rounded
                        ${darkMode
                          ? 'bg-green-700 text-white hover:bg-green-600'
                          : 'bg-green-600 text-white hover:bg-green-700'
                        }
                        disabled:opacity-50 disabled:cursor-not-allowed
                      `}
                    >
                      {loading ? 'Syncing...' : 'Confirm Sync'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {lastSyncResult && (
              <div className={`
                p-4 rounded-lg border
                ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}
              `}>
                <h4 className={`font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Last Sync Result
                </h4>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <div className={`text-lg font-semibold ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                      {lastSyncResult.changes.created.length}
                    </div>
                    <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Created
                    </div>
                  </div>
                  <div>
                    <div className={`text-lg font-semibold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                      {lastSyncResult.changes.updated.length}
                    </div>
                    <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Updated
                    </div>
                  </div>
                  <div>
                    <div className={`text-lg font-semibold ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                      {lastSyncResult.changes.deleted.length}
                    </div>
                    <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Deleted
                    </div>
                  </div>
                  <div>
                    <div className={`text-lg font-semibold ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                      {lastSyncResult.changes.errors.length}
                    </div>
                    <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Errors
                    </div>
                  </div>
                </div>

                {lastSyncResult.changes.errors.length > 0 && (
                  <div className="mt-4">
                    <h5 className={`font-medium mb-2 ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                      Errors
                    </h5>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {lastSyncResult.changes.errors.map((error, index) => (
                        <div key={index} className={`text-xs p-2 rounded ${darkMode ? 'bg-red-900' : 'bg-red-50'}`}>
                          {error.type}: {error.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!lastSyncResult && (
              <div className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                No sync history available
              </div>
            )}
          </div>
        )}

        {/* Record Detail Modal */}
        {showRecordDetail && selectedRecord && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`
              max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden rounded-lg
              ${darkMode ? 'bg-gray-800' : 'bg-white'}
            `}>
              <div className={`
                px-4 py-3 border-b flex justify-between items-center
                ${darkMode ? 'border-gray-600' : 'border-gray-200'}
              `}>
                <h3 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Record Details - {selectedRecord.type === 'create' ? 'Create' : selectedRecord.type === 'update' ? 'Update' : 'Delete'}
                </h3>
                <button
                  onClick={() => setShowRecordDetail(false)}
                  className={`
                    text-sm px-2 py-1 rounded
                    ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}
                  `}
                >
                  Close
                </button>
              </div>
              
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                {selectedRecord.type === 'create' && (
                  <div className="space-y-3">
                    <h4 className={`font-medium ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                      New Record to Create
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Financial ID:</span>
                        <div className={darkMode ? 'text-gray-400' : 'text-gray-600'}>{selectedRecord.devRecordId}</div>
                      </div>
                      <div>
                        <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Customer:</span>
                        <div className={darkMode ? 'text-gray-400' : 'text-gray-600'}>{selectedRecord.customerName}</div>
                      </div>
                      <div>
                        <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Project:</span>
                        <div className={darkMode ? 'text-gray-400' : 'text-gray-600'}>{selectedRecord.projectName}</div>
                      </div>
                      <div>
                        <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Amount:</span>
                        <div className={darkMode ? 'text-gray-400' : 'text-gray-600'}>{formatCurrency(selectedRecord.amount)}</div>
                      </div>
                      <div>
                        <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Date:</span>
                        <div className={darkMode ? 'text-gray-400' : 'text-gray-600'}>{selectedRecord.date}</div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedRecord.type === 'update' && (
                  <div className="space-y-3">
                    <h4 className={`font-medium ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                      Record Changes
                    </h4>
                    <div className="text-sm">
                      <div className="mb-2">
                        <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Financial ID:</span>
                        <span className={`ml-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{selectedRecord.devRecordId}</span>
                      </div>
                      <div className="space-y-2">
                        <h5 className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Fields to Update:</h5>
                        {Object.entries(selectedRecord.changes || {}).map(([field, value]) => (
                          <div key={field} className={`p-2 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                            <div className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{field}:</div>
                            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              New value: {typeof value === 'number' && field.includes('price') ? formatCurrency(value) : value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {selectedRecord.type === 'delete' && (
                  <div className="space-y-3">
                    <h4 className={`font-medium ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                      Record to Delete
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Customer Sale ID:</span>
                        <div className={darkMode ? 'text-gray-400' : 'text-gray-600'}>{selectedRecord.customerSaleId}</div>
                      </div>
                      <div>
                        <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Financial ID:</span>
                        <div className={darkMode ? 'text-gray-400' : 'text-gray-600'}>{selectedRecord.financialId}</div>
                      </div>
                    </div>
                    <div className={`p-3 rounded ${darkMode ? 'bg-red-900 bg-opacity-20' : 'bg-red-50'}`}>
                      <p className={`text-sm ${darkMode ? 'text-red-200' : 'text-red-800'}`}>
                        This record exists in customer_sales but not in devRecords and will be removed to maintain data consistency.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Debug Report Modal */}
        {showDebugReport && debugResult && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`
              max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden rounded-lg
              ${darkMode ? 'bg-gray-800' : 'bg-white'}
            `}>
              <div className={`
                px-4 py-3 border-b flex justify-between items-center
                ${darkMode ? 'border-gray-600' : 'border-gray-200'}
              `}>
                <h3 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Debug Report - Record 79DE4747-2C6B-4D09-B82A-5BC767832E9A
                </h3>
                <button
                  onClick={() => setShowDebugReport(false)}
                  className={`
                    text-sm px-2 py-1 rounded
                    ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}
                  `}
                >
                  Close
                </button>
              </div>
              
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                {debugResult.error ? (
                  <div className={`p-4 rounded ${darkMode ? 'bg-red-900 bg-opacity-20' : 'bg-red-50'}`}>
                    <h4 className={`font-medium mb-2 ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                      Debug Error
                    </h4>
                    <p className={`text-sm ${darkMode ? 'text-red-200' : 'text-red-800'}`}>
                      {debugResult.error}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Raw FileMaker Data */}
                    <div>
                      <h4 className={`font-medium mb-3 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                        📋 Step 1: Raw FileMaker Data
                      </h4>
                      <div className={`p-3 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>ID:</span>
                            <div className={`font-mono text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              {debugResult.rawRecord?.__ID}
                            </div>
                          </div>
                          <div>
                            <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Date:</span>
                            <div className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                              {debugResult.rawRecord?.DateStart}
                            </div>
                          </div>
                          <div>
                            <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Billable_Time_Rounded:</span>
                            <div className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                              {debugResult.rawRecord?.Billable_Time_Rounded}
                            </div>
                          </div>
                          <div>
                            <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Hourly_Rate:</span>
                            <div className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                              {debugResult.rawRecord?.Hourly_Rate || 'undefined'}
                            </div>
                          </div>
                          <div>
                            <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Customers::chargeRate:</span>
                            <div className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                              {debugResult.rawRecord?.['Customers::chargeRate']}
                            </div>
                          </div>
                          <div>
                            <span className={`font-medium ${darkMode ? 'text-green-300' : 'text-green-700'}`}>Effective Rate Used:</span>
                            <div className={`font-semibold ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                              {debugResult.rawRecord?.Hourly_Rate || debugResult.rawRecord?.['Customers::chargeRate'] || 0}
                            </div>
                          </div>
                          <div>
                            <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Customer:</span>
                            <div className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                              {debugResult.rawRecord?.['Customers::Name']}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Processed devRecord */}
                    <div>
                      <h4 className={`font-medium mb-3 ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                        ⚙️ Step 2: Processed devRecord
                      </h4>
                      <div className={`p-3 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>hours:</span>
                            <div className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                              {debugResult.processedRecord?.hours}
                            </div>
                          </div>
                          <div>
                            <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>rate:</span>
                            <div className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                              {debugResult.processedRecord?.rate}
                            </div>
                          </div>
                          <div>
                            <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>amount:</span>
                            <div className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                              {debugResult.processedRecord?.amount}
                            </div>
                          </div>
                          <div>
                            <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>customerName:</span>
                            <div className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                              {debugResult.processedRecord?.customerName}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Existing customer_sales Record */}
                    {debugResult.existingRecord ? (
                      <div>
                        <h4 className={`font-medium mb-3 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                          🔍 Step 3: Existing customer_sales Record
                        </h4>
                        <div className={`p-3 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>quantity:</span>
                              <div className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                                {debugResult.existingRecord.quantity}
                              </div>
                            </div>
                            <div>
                              <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>unit_price:</span>
                              <div className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                                {debugResult.existingRecord.unit_price}
                              </div>
                            </div>
                            <div>
                              <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>total_price:</span>
                              <div className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                                {debugResult.existingRecord.total_price}
                              </div>
                            </div>
                            <div>
                              <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>financial_id:</span>
                              <div className={`font-mono text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                {debugResult.existingRecord.financial_id}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <h4 className={`font-medium mb-3 ${darkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                          📝 Step 3: No Existing Record
                        </h4>
                        <div className={`p-3 rounded ${darkMode ? 'bg-orange-900 bg-opacity-20' : 'bg-orange-50'}`}>
                          <p className={`text-sm ${darkMode ? 'text-orange-200' : 'text-orange-800'}`}>
                            No customer_sales record found - would be created
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Comparison Results */}
                    <div>
                      <h4 className={`font-medium mb-3 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                        📈 Step 4: Field Comparison Results
                      </h4>
                      {debugResult.changes && Object.keys(debugResult.changes).length > 0 ? (
                        <div className="space-y-3">
                          {Object.entries(debugResult.changes).map(([field, change]) => (
                            <div key={field} className={`p-3 rounded ${darkMode ? 'bg-red-900 bg-opacity-20' : 'bg-red-50'}`}>
                              <div className={`font-medium mb-2 ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                                {field} - DIFFERENT
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Current:</span>
                                  <div className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                                    {change.current}
                                  </div>
                                  {change.saleRounded && (
                                    <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                      Rounded: {change.saleRounded}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>New:</span>
                                  <div className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                                    {change.new}
                                  </div>
                                  {change.devRounded && (
                                    <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                      Rounded: {change.devRounded}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className={`p-3 rounded ${darkMode ? 'bg-green-900 bg-opacity-20' : 'bg-green-50'}`}>
                          <p className={`text-sm ${darkMode ? 'text-green-200' : 'text-green-800'}`}>
                            ✅ No changes detected - record is in sync
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

FinancialSyncPanel.propTypes = {
  darkMode: PropTypes.bool,
  onSyncComplete: PropTypes.func
};

export default FinancialSyncPanel;