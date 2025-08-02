import React from 'react';
import PropTypes from 'prop-types';

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
          {records.length === 0 ? (
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
                      Description
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
                  {records.map((record, index) => (
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
                        <div className="max-w-xs truncate" title={record.product_name}>
                          {record.product_name || 'No Description'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-right whitespace-nowrap">
                        {formatQuantity(record.quantity)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right whitespace-nowrap">
                        {formatCurrency(record.unit_price || 0)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right whitespace-nowrap font-medium">
                        {formatCurrency(record.total_price || 0)}
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
                          onClick={() => onEditRecord(record)}
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
              Total Amount: {formatCurrency(records.reduce((sum, record) => sum + (record.total_price || 0), 0))}
            </span>
          </div>
        </div>
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