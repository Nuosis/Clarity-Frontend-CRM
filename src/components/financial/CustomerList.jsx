import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { initializeQuickBooks } from '../../api/fileMaker';
import { useSnackBar } from '../../context/SnackBarContext';

/**
 * Customer list component for displaying financial data by customer
 * @param {Object} props - Component props
 * @param {Object} props.customers - Customers data grouped by customer ID
 * @param {Object} props.projects - Projects data grouped by project ID
 * @param {string|null} props.selectedCustomerId - Currently selected customer ID
 * @param {function} props.onCustomerSelect - Function to call when a customer is selected
 * @param {function} props.onProjectSelect - Function to call when a project is selected
 * @param {boolean} props.showProjects - Whether to show projects for the selected customer
 * @param {function} props.onToggleProjects - Function to toggle projects visibility
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 * @param {function} props.updateBilledStatus - Function to update billed status of records
 * @returns {JSX.Element} Customer list component
 */
function CustomerList({
  customers,
  projects,
  selectedCustomerId,
  onCustomerSelect,
  onProjectSelect,
  showProjects,
  onToggleProjects,
  darkMode,
  updateBilledStatus
}) {
  const { showError } = useSnackBar();
  const [processingQbCustomerId, setProcessingQbCustomerId] = useState(null);
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

  // Handle QuickBooks initialization
  const handleQuickBooksInit = useCallback(async (customerId, e) => {
    e.stopPropagation(); // Prevent row selection when clicking the button
    
    if (!customerId || !customers[customerId]) {
      showError('Customer information is missing');
      return;
    }
    
    setProcessingQbCustomerId(customerId);
    try {
      // Get the unbilled records for this customer
      const customerRecords = customers[customerId].records;
      const unbilledRecords = customerRecords.filter(record => !record.billed);
      
      if (unbilledRecords.length === 0) {
        showError('No unbilled records found for this customer');
        return;
      }
      
      // Group records by project ID
      const recordsByProject = {};
      const recordIds = [];
      
      unbilledRecords.forEach(record => {
        // Add to the flat array of record IDs for optimistic update
        recordIds.push(record.id);
        
        // Add to the grouped records by project
        if (!recordsByProject[record.projectId]) {
          recordsByProject[record.projectId] = [];
        }
        recordsByProject[record.projectId].push(record.id);
      });
      
      // Pass customer ID and records grouped by project ID to QuickBooks
      await initializeQuickBooks({
        custId: customerId,
        recordsByProject: recordsByProject
      });
      
      // Optimistically update the billed status in the UI
      updateBilledStatus(customerId, recordIds);
      
      showError('QuickBooks processing initiated successfully');
    } catch (error) {
      console.error('QuickBooks initialization error:', error);
      showError(`Error processing QuickBooks: ${error.message}`);
    } finally {
      setProcessingQbCustomerId(null);
    }
  }, [customers, showError, updateBilledStatus]);

  // Debug logs
  console.log("CustomerList rendering with props:", {
    customersCount: Object.keys(customers).length,
    selectedCustomerId,
    showProjects
  });

  if (selectedCustomerId) {
    console.log("Selected customer data:", customers[selectedCustomerId]);
  }

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
                <React.Fragment key={customer.customerId}>
                  <tr
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
                      <div className="flex items-center justify-between">
                        <span>{customer.customerName}</span>
                        {/* Only show QuickBooks button if there are unbilled records */}
                        {customer.records && customer.records.some(record => !record.billed) && (
                          <button
                            onClick={(e) => handleQuickBooksInit(customer.customerId, e)}
                            disabled={processingQbCustomerId === customer.customerId}
                            className={`
                              px-2 py-1 rounded-md text-xs ml-2 flex items-center
                              ${processingQbCustomerId === customer.customerId
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-700 text-white'}
                            `}
                            title="Send unbilled records to QuickBooks"
                          >
                            <span>qb</span>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {formatCurrency(customer.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {formatHours(customer.totalHours)}
                    </td>
                  </tr>
                  
                  {/* Projects for selected customer */}
                  {selectedCustomerId === customer.customerId && showProjects && (
                    <tr className={darkMode ? 'bg-gray-900' : 'bg-gray-50'}>
                      <td colSpan="3" className="px-0 py-0">
                        <div className="p-3">
                          <div className="flex justify-between items-center mb-2">
                            <h4 className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              Projects
                            </h4>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleProjects(false);
                              }}
                              className={`
                                p-1 rounded-full
                                ${darkMode ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'}
                              `}
                              aria-label="Close projects"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {Object.values(projects)
                              .filter(project => project.customerId === customer.customerId)
                              .map(project => (
                                <div
                                  key={project.projectId}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onProjectSelect(project.projectId);
                                  }}
                                  className={`
                                    p-2 rounded cursor-pointer
                                    ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}
                                  `}
                                >
                                  <div className="flex justify-between">
                                    <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                      {project.projectName}
                                    </span>
                                    <div className="text-right">
                                      <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                        {formatCurrency(project.totalAmount)}
                                      </div>
                                      <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                        {formatHours(project.totalHours)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
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
  projects: PropTypes.object.isRequired,
  selectedCustomerId: PropTypes.string,
  onCustomerSelect: PropTypes.func.isRequired,
  onProjectSelect: PropTypes.func.isRequired,
  showProjects: PropTypes.bool,
  onToggleProjects: PropTypes.func.isRequired,
  darkMode: PropTypes.bool,
  updateBilledStatus: PropTypes.func.isRequired
};

CustomerList.defaultProps = {
  selectedCustomerId: null,
  showProjects: false,
  darkMode: false
};

export default React.memo(CustomerList);