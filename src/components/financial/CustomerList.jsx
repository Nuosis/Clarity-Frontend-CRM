import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useSnackBar } from '../../context/SnackBarContext';

/**
 * Customer list component for displaying sales data by customer
 * @param {Object} props - Component props
 * @param {Object} props.customers - Customers data grouped by customer ID
 * @param {string|null} props.selectedCustomerId - Currently selected customer ID
 * @param {function} props.onCustomerSelect - Function to call when a customer is selected
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 * @param {function} props.updateInvoiceStatus - Function to update invoice status of sales
 * @returns {JSX.Element} Customer list component
 */
function CustomerList({
  customers,
  selectedCustomerId = null,
  onCustomerSelect,
  darkMode = false,
}) {
  const { showError, showSuccess } = useSnackBar();
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

  // Format quantity for display
  const formatQuantity = (quantity) => {
    // Ensure quantity is a number and limit to 2 decimal places
    const formattedQuantity = typeof quantity === 'number'
      ? parseFloat(quantity.toFixed(2))
      : parseFloat(parseFloat(quantity || 0).toFixed(2));
    
    return `${formattedQuantity} units`;
  };

  // Debug logs
  console.log("CustomerList rendering with props:", {
    customersCount: Object.keys(customers).length,
    selectedCustomerId
  });

  if (selectedCustomerId) {
    console.log("Selected customer data:", customers[selectedCustomerId]);
  }

  return (
    <div className={`
      rounded-lg border overflow-hidden flex flex-col h-full
      ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
    `}>
      {/* Fixed Header */}
      <div className={`
        flex-shrink-0 px-4 py-3 border-b
        ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}
      `}>
        <h3 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Customers
        </h3>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-hidden">
        {customersArray.length === 0 ? (
          <div className={`p-4 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            No customer data available
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              {/* Sticky Table Header */}
              <thead className={`sticky top-0 z-10 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
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
                    onClick={() => requestSort('totalQuantity')}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Quantity</span>
                      <span>{getSortDirectionIndicator('totalQuantity')}</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className={`
                divide-y
                ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}
              `}>
                {sortedCustomers.map(customer => {
                  // Generate a unique key for each customer - use name if ID is empty
                  const customerKey = customer.customerId || `name:${customer.customerName}`;
                  
                  return (
                    <React.Fragment key={customerKey}>
                      <tr
                        onClick={() => onCustomerSelect(customerKey)}
                        className={`
                          cursor-pointer transition-colors
                          ${selectedCustomerId === customerKey
                            ? (darkMode ? 'bg-blue-900 bg-opacity-30' : 'bg-blue-50')
                            : (darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50')}
                          ${darkMode ? 'text-gray-200' : 'text-gray-900'}
                        `}
                      >
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span>{customer.customerName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {formatCurrency(customer.totalAmount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {formatQuantity(customer.totalQuantity)}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

CustomerList.propTypes = {
  customers: PropTypes.object.isRequired,
  selectedCustomerId: PropTypes.string,
  onCustomerSelect: PropTypes.func.isRequired,
  darkMode: PropTypes.bool,
  updateInvoiceStatus: PropTypes.func.isRequired
};

export default React.memo(CustomerList);