import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { fetchFinancialRecordByUUID, bulkUpdateFinancialRecordsBilledStatus } from '../../api/financialRecords';
import { processFinancialData } from '../../services/billableHoursService';
import RecordModal from './RecordModal';

// Component load verification
console.log('🚀 RecordDetailsModal component loaded/imported');

/**
 * Modal component for displaying detailed records that make up a summary row
 * @param {Object} props - Component props
 * @param {Array} props.records - Individual records to display
 * @param {string} props.groupTitle - Title for the group (product name + month/year)
 * @param {function} props.onClose - Function to call when modal is closed
 * @param {function} props.onEditRecord - Function to call when a record is edited
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 * @returns {JSX.Element} Record details modal component
 */
function RecordDetailsModal({ records, groupTitle, onClose, onEditRecord, darkMode = false }) {
  console.log('🚀 RecordDetailsModal component rendered with records:', records.length);
  const [enrichedRecords, setEnrichedRecords] = useState(records);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [bulkUpdateLoading, setBulkUpdateLoading] = useState(false);
  const [bulkUpdateError, setBulkUpdateError] = useState(null);
  const [bulkUpdateSuccess, setBulkUpdateSuccess] = useState(null);


  // Calculate uninvoiced records for bulk action
  const uninvoicedRecords = useMemo(() => {
    console.log('🔍 BULK ACTION DEBUG - useMemo triggered, enrichedRecords length:', enrichedRecords.length);
    console.log('🔍 BULK ACTION DEBUG - All enriched records:', enrichedRecords.map(r => ({
      id: r.id || r.recordId,
      inv_id: r.inv_id,
      inv_id_type: typeof r.inv_id,
      f_billed: r.f_billed,
      billed: r.billed
    })));
    
    if (enrichedRecords.length === 0) {
      console.log('🔍 BULK ACTION DEBUG - No enriched records yet, returning empty array');
      return [];
    }
    
    const uninvoiced = enrichedRecords.filter(record => {
      // Check for various representations of "not invoiced"
      // Based on the console output, records have inv_id: null when uninvoiced
      const isUninvoiced = record.inv_id === null ||
                          record.inv_id === undefined ||
                          record.inv_id === '' ||
                          record.inv_id === 0 ||
                          record.inv_id === '0' ||
                          record.billed === false ||
                          record.f_billed === 0 ||
                          record.f_billed === '0' ||
                          record.f_billed === null ||
                          record.f_billed === undefined;
      
      console.log(`🔍 BULK ACTION DEBUG - Record ${record.id || record.recordId}: inv_id=${record.inv_id}, f_billed=${record.f_billed}, billed=${record.billed}, isUninvoiced=${isUninvoiced}`);
      return isUninvoiced;
    });
    
    console.log('🔍 BULK ACTION DEBUG - Uninvoiced records count:', uninvoiced.length);
    console.log('🔍 BULK ACTION DEBUG - Uninvoiced record IDs:', uninvoiced.map(r => r.id || r.recordId));
    return uninvoiced;
  }, [enrichedRecords]);

  // Debug log to see when component renders
  console.log('🔍 BULK ACTION DEBUG - Component render, uninvoicedRecords.length:', uninvoicedRecords.length);

  // Handle bulk mark as invoiced
  const handleBulkMarkAsInvoiced = useCallback(async () => {
    if (uninvoicedRecords.length === 0) {
      return;
    }

    setBulkUpdateLoading(true);
    setBulkUpdateError(null);
    setBulkUpdateSuccess(null);

    try {
      // Extract record IDs that need to be updated
      const recordIds = uninvoicedRecords
        .map(record => record.recordId || record.id)
        .filter(id => id); // Filter out any undefined/null IDs

      if (recordIds.length === 0) {
        throw new Error('No valid record IDs found for bulk update');
      }

      console.log(`🔄 BULK UPDATE - Starting bulk update for ${recordIds.length} records:`, recordIds);

      // Call the bulk update API
      const result = await bulkUpdateFinancialRecordsBilledStatus(recordIds, 1);

      console.log('🔄 BULK UPDATE - Result:', result);

      if (result.success) {
        // Update the local state to reflect the changes
        setEnrichedRecords(prevRecords =>
          prevRecords.map(record => {
            const recordId = record.recordId || record.id;
            if (recordIds.includes(recordId)) {
              return { ...record, inv_id: 1, f_billed: 1 };
            }
            return record;
          })
        );

        setBulkUpdateSuccess(`Successfully marked ${result.successCount} records as invoiced`);
        
        // Call the parent's onEditRecord to refresh data if needed
        if (onEditRecord && typeof onEditRecord === 'function') {
          // This will trigger a refresh of the parent component's data
          onEditRecord(null, null);
        }
      } else {
        throw new Error(`Bulk update partially failed: ${result.errorCount} errors out of ${result.totalRecords} records`);
      }
    } catch (error) {
      console.error('🔄 BULK UPDATE - Error:', error);
      setBulkUpdateError(error.message || 'Failed to update records');
    } finally {
      setBulkUpdateLoading(false);
    }
  }, [uninvoicedRecords, onEditRecord]);

  // Clear bulk update messages after a delay
  useEffect(() => {
    if (bulkUpdateSuccess || bulkUpdateError) {
      const timer = setTimeout(() => {
        setBulkUpdateSuccess(null);
        setBulkUpdateError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [bulkUpdateSuccess, bulkUpdateError]);

  // Fetch complete record data with Task and Work Performed information
  useEffect(() => {
    const fetchCompleteRecords = async () => {
      if (!records || records.length === 0) return;

      setLoading(true);
      setError(null);

      try {
        const completeRecords = await Promise.all(
          records.map(async (record) => {
            try {
              // Use the financial_id or id to fetch complete record
              const recordId = record.financial_id || record.id;
              if (!recordId) {
                console.warn('No financial_id or id found for record:', record);
                return record;
              }

              const completeRecord = await fetchFinancialRecordByUUID(recordId);
              
              // LOG: Raw response from fetchFinancialRecordByUUID
              console.log(`🔍 ENRICHMENT DEBUG - Raw API response for record ${recordId}:`,
                JSON.stringify(completeRecord, null, 2));
              
              // CRITICAL FIX: Parse JSON string if needed
              let parsedRecord = completeRecord;
              if (typeof completeRecord === 'string') {
                try {
                  parsedRecord = JSON.parse(completeRecord);
                  console.log(`🔍 ENRICHMENT DEBUG - Parsed JSON response for ${recordId}:`,
                    JSON.stringify(parsedRecord, null, 2));
                } catch (error) {
                  console.error(`🔍 ENRICHMENT DEBUG - Failed to parse JSON for ${recordId}:`, error);
                  return record; // Return original record if parsing fails
                }
              }
              
              console.log(`🔍 ENRICHMENT DEBUG - Data structure for processing ${recordId}:`,
                JSON.stringify(parsedRecord, null, 2));
              
              // Process the complete record to ensure proper field mapping
              const processedRecords = processFinancialData(parsedRecord);
              const processedRecord = processedRecords[0];
              
              // LOG: Processed record after processFinancialData
              console.log(`🔍 ENRICHMENT DEBUG - Processed record for ${recordId}:`,
                JSON.stringify(processedRecord, null, 2));

              // Merge the complete data with the original record
              const mergedRecord = {
                ...record,
                ...processedRecord,
                // Ensure we preserve the original record structure
                taskName: processedRecord.taskName || record.taskName,
                workPerformed: processedRecord.workPerformed || record.workPerformed
              };
              
              // LOG: Final merged record
              console.log(`🔍 ENRICHMENT DEBUG - Final merged record for ${recordId}:`,
                JSON.stringify(mergedRecord, null, 2));
              
              return mergedRecord;
            } catch (recordError) {
              console.error(`Failed to fetch complete data for record ${record.financial_id || record.id}:`, recordError);
              return record; // Return original record if fetch fails
            }
          })
        );

        setEnrichedRecords(completeRecords);
      } catch (fetchError) {
        console.error('Error fetching complete records:', fetchError);
        setError('Failed to load complete record details');
        setEnrichedRecords(records); // Fallback to original records
      } finally {
        setLoading(false);
      }
    };

    fetchCompleteRecords();
  }, [records]);

  // Format currency for display
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Format quantity to limit to 2 decimal places maximum
  const formatQuantity = (quantity) => {
    const num = Number(quantity) || 0;
    return num % 1 === 0 ? num.toString() : num.toFixed(2);
  };

  // Format date for display
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Handle opening the edit modal
  const handleEditRecord = useCallback((record) => {
    setSelectedRecord(record);
    setShowEditModal(true);
  }, []);

  // Handle closing the edit modal
  const handleCloseEditModal = useCallback(() => {
    setShowEditModal(false);
    setSelectedRecord(null);
  }, []);

  // Handle saving a record - delegate to existing onEditRecord function
  const handleSaveRecord = useCallback(async (updatedRecord, patchPayload) => {
    // Simply delegate to the existing onEditRecord function
    // This maintains the original workflow without optimistic updates
    await onEditRecord(updatedRecord, patchPayload);
  }, [onEditRecord]);

  // Handle modal backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div 
        className={`
          relative w-full max-w-4xl max-h-[90vh] rounded-lg shadow-xl overflow-hidden
          ${darkMode ? 'bg-gray-800' : 'bg-white'}
        `}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`
          px-6 py-4 border-b
          ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}
        `}>
          <div className="flex justify-between items-start">
            <div>
              <h3 className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Record Details
              </h3>
              <p className={`text-sm mt-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {groupTitle} • {records.length} record{records.length !== 1 ? 's' : ''} • Uninvoiced: {uninvoicedRecords.length}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {/* Bulk Action Button */}
              {uninvoicedRecords.length > 0 && (
                <button
                  type="button"
                  onClick={handleBulkMarkAsInvoiced}
                  disabled={bulkUpdateLoading}
                  className={`
                    inline-flex items-center px-3 py-2 border rounded-md text-sm font-medium
                    ${bulkUpdateLoading
                      ? (darkMode
                          ? 'border-gray-600 bg-gray-700 text-gray-400 cursor-not-allowed'
                          : 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed')
                      : (darkMode
                          ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
                          : 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600')
                    }
                  `}
                >
                  {bulkUpdateLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Mark All as Invoiced ({uninvoicedRecords.length})
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className={`
                  rounded-md p-2 inline-flex items-center justify-center
                  ${darkMode
                    ? 'text-gray-400 hover:text-white hover:bg-gray-600'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}
                `}
              >
                <span className="sr-only">Close</span>
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Bulk Update Feedback Messages */}
          {(bulkUpdateSuccess || bulkUpdateError) && (
            <div className="mt-3">
              {bulkUpdateSuccess && (
                <div className={`
                  p-3 rounded-md flex items-center
                  ${darkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800'}
                `}>
                  <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {bulkUpdateSuccess}
                </div>
              )}
              {bulkUpdateError && (
                <div className={`
                  p-3 rounded-md flex items-center
                  ${darkMode ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-800'}
                `}>
                  <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {bulkUpdateError}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
          {loading ? (
            <div className={`p-8 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                Loading complete record details...
              </div>
            </div>
          ) : error ? (
            <div className={`p-8 text-center ${darkMode ? 'text-red-400' : 'text-red-500'}`}>
              <p className="mb-2">⚠️ {error}</p>
              <p className="text-sm">Showing basic record information</p>
            </div>
          ) : enrichedRecords.length === 0 ? (
            <div className={`p-8 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              No detailed records available
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                  <tr>
                    <th 
                      scope="col" 
                      className={`
                        px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                        ${darkMode ? 'text-gray-300' : 'text-gray-500'}
                      `}
                    >
                      Date
                    </th>
                    <th
                      scope="col"
                      className={`
                        px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                        ${darkMode ? 'text-gray-300' : 'text-gray-500'}
                      `}
                    >
                      Task
                    </th>
                    <th
                      scope="col"
                      className={`
                        px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                        ${darkMode ? 'text-gray-300' : 'text-gray-500'}
                      `}
                    >
                      Work Performed
                    </th>
                    <th 
                      scope="col" 
                      className={`
                        px-6 py-3 text-right text-xs font-medium uppercase tracking-wider
                        ${darkMode ? 'text-gray-300' : 'text-gray-500'}
                      `}
                    >
                      Quantity
                    </th>
                    <th 
                      scope="col" 
                      className={`
                        px-6 py-3 text-right text-xs font-medium uppercase tracking-wider
                        ${darkMode ? 'text-gray-300' : 'text-gray-500'}
                      `}
                    >
                      Unit Price
                    </th>
                    <th 
                      scope="col" 
                      className={`
                        px-6 py-3 text-right text-xs font-medium uppercase tracking-wider
                        ${darkMode ? 'text-gray-300' : 'text-gray-500'}
                      `}
                    >
                      Total
                    </th>
                    <th 
                      scope="col" 
                      className={`
                        px-6 py-3 text-center text-xs font-medium uppercase tracking-wider
                        ${darkMode ? 'text-gray-300' : 'text-gray-500'}
                      `}
                    >
                      Status
                    </th>
                    <th 
                      scope="col" 
                      className={`
                        px-6 py-3 text-center text-xs font-medium uppercase tracking-wider
                        ${darkMode ? 'text-gray-300' : 'text-gray-500'}
                      `}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className={`
                  divide-y
                  ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}
                `}>
                  {enrichedRecords.map((record, index) => (
                    <tr
                      key={record.id || index}
                      className={`
                        ${darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-800 hover:bg-gray-50'}
                      `}
                    >
                      <td className="px-6 py-4 text-sm whitespace-nowrap">
                        {formatDate(record.date)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="max-w-xs truncate" title={record.taskName || record.task_name || 'N/A'}>
                          {record.taskName || record.task_name || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="max-w-xs truncate" title={record.workPerformed || record.work_performed || record.description || 'N/A'}>
                          {record.workPerformed || record.work_performed || record.description || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-right whitespace-nowrap">
                        {formatQuantity(record.quantity || record.hours || 0)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right whitespace-nowrap">
                        {formatCurrency(record.unit_price || record.rate || 0)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right whitespace-nowrap font-medium">
                        {formatCurrency(record.total_price || record.amount || 0)}
                      </td>
                      <td className="px-6 py-4 text-sm text-center whitespace-nowrap">
                        <span className={`
                          inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                          ${record.inv_id !== null
                            ? (darkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800')
                            : (darkMode ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-800')}
                        `}>
                          {record.inv_id !== null ? 'Invoiced' : 'Uninvoiced'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-center whitespace-nowrap">
                        <button
                          onClick={() => handleEditRecord(record)}
                          className={`
                            inline-flex items-center px-3 py-1 border rounded-md text-xs font-medium
                            ${darkMode
                              ? 'border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600'
                              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}
                          `}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {/* Footer with summary */}
        <div className={`
          px-6 py-4 border-t
          ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}
        `}>
          <div className="flex justify-between items-center text-sm">
            <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
              Total Records: {records.length}
            </span>
            <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Total Amount: {formatCurrency(records.reduce((sum, record) => sum + (record.total_price || record.amount || 0), 0))}
            </span>
          </div>
        </div>
        
        {/* Edit Record Modal */}
        {showEditModal && selectedRecord && (
          <RecordModal
            record={selectedRecord}
            onClose={handleCloseEditModal}
            onSave={handleSaveRecord}
            darkMode={darkMode}
          />
        )}
      </div>
    </div>
  );
}

RecordDetailsModal.propTypes = {
  records: PropTypes.array.isRequired,
  groupTitle: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  onEditRecord: PropTypes.func.isRequired,
  darkMode: PropTypes.bool
};

export default RecordDetailsModal;