import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { fetchFinancialRecordByUUID } from '../../api/financialRecords';
import { processFinancialData } from '../../services/billableHoursService';
import RecordModal from './RecordModal';

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
  const [enrichedRecords, setEnrichedRecords] = useState(records);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);


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
          px-6 py-4 border-b flex justify-between items-center
          ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}
        `}>
          <div>
            <h3 className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Record Details
            </h3>
            <p className={`text-sm mt-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {groupTitle} • {records.length} record{records.length !== 1 ? 's' : ''}
            </p>
          </div>
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