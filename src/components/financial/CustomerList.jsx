import React, { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * Customer list component for displaying financial data by customer
 * @param {Object} props - Component props
 * @param {Object} props.customers - Customers data grouped by customer ID
 * @param {string|null} props.selectedCustomerId - Currently selected customer ID
 * @param {function} props.onCustomerSelect - Function to call when a customer is selected
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 * @returns {JSX.Element} Customer list component
 */
function CustomerList({ customers, selectedCustomerId, onCustomerSelect, darkMode }) {
  const [sortConfig, setSortConfig] = useState({
    key: 'totalAmount',
    direction: 'desc'
  });

  // Convert customers object to array for sorting
  const customersArray = Object.values(customers);

  // Sort customers based on current sort configuration
  const sortedCustomers = React.useMemo(() => {
    return [...customersArray].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [customersArray, sortConfig]);

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

  // Format hours for display
  const formatHours = (hours) => {
    return `${hours.toFixed(2)} hrs`;
  };

  return (
    <div className={`
      rounded-lg border overflow-hidden
      ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
    `}>
      <div className={`
        px-4 py-3 border-b
        ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}
      `}>
        <h3 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Customers
        </h3>
      </div>
      
      {customersArray.length === 0 ? (
        <div className={`p-4 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          No customer data available
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
              <tr>
                <th 
                  scope="col" 
                  className={`
                    px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer
                    ${darkMode ? 'text-gray-300' : 'text-gray-500'}
                  `}
                  onClick={() => requestSort('customerName')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Customer</span>
                    <span>{getSortDirectionIndicator('customerName')}</span>
                  </div>
                </th>
                <th 
                  scope="col" 
                  className={`
                    px-4 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer
                    ${darkMode ? 'text-gray-300' : 'text-gray-500'}
                  `}
                  onClick={() => requestSort('totalAmount')}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Amount</span>
                    <span>{getSortDirectionIndicator('totalAmount')}</span>
                  </div>
                </th>
                <th 
                  scope="col" 
                  className={`
                    px-4 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer
                    ${darkMode ? 'text-gray-300' : 'text-gray-500'}
                  `}
                  onClick={() => requestSort('totalHours')}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Hours</span>
                    <span>{getSortDirectionIndicator('totalHours')}</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className={`
              divide-y
              ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}
            `}>
              {sortedCustomers.map(customer => (
                <tr 
                  key={customer.customerId}
                  onClick={() => onCustomerSelect(customer.customerId)}
                  className={`
                    cursor-pointer transition-colors
                    ${selectedCustomerId === customer.customerId 
                      ? (darkMode ? 'bg-blue-900 bg-opacity-30' : 'bg-blue-50') 
                      : (darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50')}
                    ${darkMode ? 'text-gray-200' : 'text-gray-900'}
                  `}
                >
                  <td className="px-4 py-3 text-sm">
                    {customer.customerName}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    {formatCurrency(customer.totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    {formatHours(customer.totalHours)}
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

CustomerList.propTypes = {
  customers: PropTypes.object.isRequired,
  selectedCustomerId: PropTypes.string,
  onCustomerSelect: PropTypes.func.isRequired,
  darkMode: PropTypes.bool
};

CustomerList.defaultProps = {
  selectedCustomerId: null,
  darkMode: false
};

export default React.memo(CustomerList);