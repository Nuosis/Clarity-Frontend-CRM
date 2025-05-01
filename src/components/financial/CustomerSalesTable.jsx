import React, { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * Component to display individual sales lines for a customer
 * @param {Object} props - Component props
 * @param {Array} props.records - Sales records to display
 * @param {function} props.onEditRecord - Function to call when a record is edited
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 * @returns {JSX.Element} Customer sales table component
 */
function CustomerSalesTable({ records, onEditRecord, darkMode = false }) {
  const [sortConfig, setSortConfig] = useState({
    key: 'date',
    direction: 'desc'
  });

  // Sort records based on current sort configuration
  const sortedRecords = React.useMemo(() => {
    return [...records].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [records, sortConfig]);

  // Handle sort request
  const requestSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Get sort direction indicator
  const getSortDirectionIndicator = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // Format currency for display
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD' 
    }).format(amount);
  };

  return (
    <div className={`
      rounded-lg border overflow-hidden mt-4
      ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
    `}>
      <div className={`
        px-4 py-3 border-b
        ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}
      `}>
        <h3 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Sales Lines
        </h3>
      </div>
      
      {records.length === 0 ? (
        <div className={`p-4 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          No sales data available for this customer
        </div>
      ) : (
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
              <tr>
                <th 
                  scope="col" 
                  className={`
                    px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer
                    ${darkMode ? 'text-gray-300' : 'text-gray-500'}
                  `}
                  onClick={() => requestSort('date')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Date</span>
                    <span>{getSortDirectionIndicator('date')}</span>
                  </div>
                </th>
                <th 
                  scope="col" 
                  className={`
                    px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer
                    ${darkMode ? 'text-gray-300' : 'text-gray-500'}
                  `}
                  onClick={() => requestSort('project_name')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Project</span>
                    <span>{getSortDirectionIndicator('project_name')}</span>
                  </div>
                </th>
                <th 
                  scope="col" 
                  className={`
                    px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer
                    ${darkMode ? 'text-gray-300' : 'text-gray-500'}
                  `}
                  onClick={() => requestSort('product_name')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Description</span>
                    <span>{getSortDirectionIndicator('product_name')}</span>
                  </div>
                </th>
                <th 
                  scope="col" 
                  className={`
                    px-4 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer
                    ${darkMode ? 'text-gray-300' : 'text-gray-500'}
                  `}
                  onClick={() => requestSort('quantity')}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Quantity</span>
                    <span>{getSortDirectionIndicator('quantity')}</span>
                  </div>
                </th>
                <th 
                  scope="col" 
                  className={`
                    px-4 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer
                    ${darkMode ? 'text-gray-300' : 'text-gray-500'}
                  `}
                  onClick={() => requestSort('unit_price')}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Unit Price</span>
                    <span>{getSortDirectionIndicator('unit_price')}</span>
                  </div>
                </th>
                <th 
                  scope="col" 
                  className={`
                    px-4 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer
                    ${darkMode ? 'text-gray-300' : 'text-gray-500'}
                  `}
                  onClick={() => requestSort('total_price')}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Total</span>
                    <span>{getSortDirectionIndicator('total_price')}</span>
                  </div>
                </th>
                <th 
                  scope="col" 
                  className={`
                    px-4 py-3 text-center text-xs font-medium uppercase tracking-wider
                    ${darkMode ? 'text-gray-300' : 'text-gray-500'}
                  `}
                >
                  Status
                </th>
                <th 
                  scope="col" 
                  className={`
                    px-4 py-3 text-center text-xs font-medium uppercase tracking-wider
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
              {sortedRecords.map(record => (
                <tr 
                  key={record.id}
                  className={darkMode ? 'text-gray-300' : 'text-gray-800'}
                >
                  <td className="px-4 py-3 text-sm">
                    {new Date(record.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {record.project_name || 'No Project'}
                  </td>
                  <td className="px-4 py-3 text-sm max-w-xs truncate">
                    {record.product_name || 'No Product'}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    {record.quantity || 0}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    {formatCurrency(record.unit_price || 0)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    {formatCurrency(record.total_price || 0)}
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    <span className={`
                      inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${record.inv_id !== null
                        ? (darkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800')
                        : (darkMode ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-800')}
                    `}>
                      {record.inv_id !== null ? 'Invoiced' : 'Uninvoiced'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    <button
                      onClick={() => onEditRecord(record)}
                      className={`
                        inline-flex items-center px-2 py-1 border rounded-md text-xs font-medium
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
  );
}

CustomerSalesTable.propTypes = {
  records: PropTypes.array.isRequired,
  onEditRecord: PropTypes.func.isRequired,
  darkMode: PropTypes.bool
};

export default React.memo(CustomerSalesTable);