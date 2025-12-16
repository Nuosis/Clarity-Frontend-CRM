import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import { useSales } from '../../hooks/useSales';
import { useAppState } from '../../context/AppStateContext';
import { parseDate, formatDate, formatYearMonth, formatMonthYear } from '../../utils/dateUtils';
import SalesModal from './SalesModal';
import CustomerSettings from './CustomerSettings';

function CustomerTabs({ customer }) {
  const { darkMode } = useTheme();
  const [activeTab, setActiveTab] = useState('sales');
  const { sales, formatSale } = useSales();
  const { customerDetails } = useAppState();
  const [customerSales, setCustomerSales] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);

  // Use customerDetails from AppState if available, otherwise fallback to customer prop
  const currentCustomer = customerDetails || customer;

  // Filter sales for the current customer
  useEffect(() => {
    if (sales && sales.length > 0 && customerDetails && customerDetails.id) {
      const filteredSales = sales.filter(sale => sale.customer_id === customerDetails.id);
      setCustomerSales(filteredSales);
    } else {
      setCustomerSales([]);
    }
  }, [sales, customerDetails?.id]);

  // Group sales by Product/Service and Month (YYYY-MM)
  const groupedSales = useMemo(() => {
    const groups = {};
    
    customerSales.forEach(sale => {
      const formattedSale = formatSale(sale);
      
      // Parse the date using the utility function
      let yearMonth = '';
      let displayMonth = '';
      
      // Try to parse the date from the original sale data first, then formatted sale
      const dateToUse = sale.date || formattedSale.date;
      const parsedDate = parseDate(dateToUse);
      
      if (parsedDate) {
        yearMonth = formatYearMonth(parsedDate);
        displayMonth = formatMonthYear(parsedDate);
      } else {
        // Fallback to current date if parsing fails
        const currentDate = new Date();
        yearMonth = formatYearMonth(currentDate);
        displayMonth = formatMonthYear(currentDate);
        console.warn(`Could not parse date for sale ${sale.id}: ${dateToUse}, using current date`);
      }
      
      // Create a group key combining product name and year-month
      const productName = sale.product_name || 'Product';
      const groupKey = `${productName}|${yearMonth}`;
      
      if (!groups[groupKey]) {
        groups[groupKey] = {
          productName,
          yearMonth,
          displayMonth,
          total: 0,
          items: []
        };
      }
      
      // Add the sale to the group and update the total
      groups[groupKey].items.push(sale);
      groups[groupKey].total += parseFloat(formattedSale.amount);
    });
    
    // Convert to array and sort by product name and date
    return Object.values(groups).sort((a, b) => {
      if (a.productName !== b.productName) {
        return a.productName.localeCompare(b.productName);
      }
      return b.yearMonth.localeCompare(a.yearMonth); // Newest first
    });
  }, [customerSales, formatSale]);

  // Toggle expanded state for a group
  const toggleGroupExpand = (groupKey) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };
  
  return (
    <div className="mt-4">
      {/* Tabs */}
      <div className="flex mb-4">
        <button
          onClick={() => setActiveTab('sales')}
          className={`px-4 py-2 font-medium focus:outline-none important! relative ${
            activeTab === 'sales'
            ? `${darkMode ? 'text-white' : 'text-gray-800'}`
            : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
          }`}
        >
          Sales
          {activeTab === 'sales' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('communication')}
          className={`px-4 py-2 font-medium focus:outline-none relative ${
            activeTab === 'communication'
            ? `${darkMode ? 'text-white' : 'text-gray-800'}`
            : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
          }`}
        >
          Communication
          {activeTab === 'communication' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 font-medium focus:outline-none relative ${
            activeTab === 'settings'
            ? `${darkMode ? 'text-white' : 'text-gray-800'}`
            : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
          }`}
        >
          Settings
          {activeTab === 'settings' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></div>
          )}
        </button>
      </div>
      
      {/* Tab Content */}
      <div className={`
        p-4 rounded-lg border
        ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
      `}>
        {/* Customer Sales Tab */}
        {activeTab === 'sales' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-medium">Products and Services</h4>
              <button
                onClick={() => setIsSalesModalOpen(true)}
                className={`
                  flex items-center justify-center w-8 h-8 rounded-full
                  ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}
                  transition-colors duration-150
                `}
                title="Add new sale"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Product/Service
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Quantity
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Price
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {groupedSales.length > 0 ? (
                    groupedSales.map((group) => {
                      const groupKey = `${group.productName}|${group.yearMonth}`;
                      const isExpanded = expandedGroups[groupKey];
                      
                      return (
                        <React.Fragment key={groupKey}>
                          {/* Summary Row */}
                          <tr
                            onClick={() => toggleGroupExpand(groupKey)}
                            className={`cursor-pointer ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} ${
                              isExpanded ? (darkMode ? 'bg-gray-700' : 'bg-gray-100') : ''
                            }`}
                          >
                            <td className="px-6 py-4 font-medium">
                              <div className="flex items-center">
                                <span className="mr-2">{isExpanded ? '▼' : '▶'}</span>
                                {group.productName}
                              </div>
                            </td>
                            <td className="px-6 py-4 font-medium">{group.displayMonth}</td>
                            <td className="px-6 py-4"></td>
                            <td className="px-6 py-4"></td>
                            <td className="px-6 py-4 font-medium">${group.total.toFixed(2)}</td>
                          </tr>
                          
                          {/* Detail Rows (shown when expanded) */}
                          {isExpanded && [...group.items]
                            // Sort items by date in descending order (newest first)
                            .sort((a, b) => {
                              const dateA = new Date(a.date);
                              const dateB = new Date(b.date);
                              return dateB - dateA; // Descending order
                            })
                            .map((sale) => {
                              const formattedSale = formatSale(sale);
                              return (
                                <tr
                                  key={sale.id}
                                  className={darkMode ? 'bg-gray-600' : 'bg-gray-50'}
                                >
                                  <td className="px-6 py-3 pl-12 whitespace-nowrap">{sale.product_name || 'Product'}</td>
                                  <td className="px-6 py-3 whitespace-nowrap">{formatDate(sale.date || formattedSale.date)}</td>
                                  <td className="px-6 py-3 whitespace-nowrap">{sale.quantity || 1}</td>
                                  <td className="px-6 py-3 whitespace-nowrap">${sale.unit_price ? parseFloat(sale.unit_price).toFixed(2) : formattedSale.amount}</td>
                                  <td className="px-6 py-3 whitespace-nowrap">${formattedSale.amount}</td>
                                </tr>
                              );
                            })}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-4 text-center">
                        No sales records found for this customer.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Customer Communication Tab */}
        {activeTab === 'communication' && (
          <div>
            <h4 className="text-lg font-medium mb-4">Communication Logs</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Contact
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Subject
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap">04/25/2025</td>
                    <td className="px-6 py-4 whitespace-nowrap">Email</td>
                    <td className="px-6 py-4 whitespace-nowrap">{customerDetails?.Email || 'john@example.com'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">Project Update</td>
                    <td className="px-6 py-4">Sent weekly progress report on website development</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap">04/23/2025</td>
                    <td className="px-6 py-4 whitespace-nowrap">Phone</td>
                    <td className="px-6 py-4 whitespace-nowrap">{customerDetails?.Phone || '555-123-4567'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">Requirements Clarification</td>
                    <td className="px-6 py-4">Discussed additional requirements for the contact form</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap">04/20/2025</td>
                    <td className="px-6 py-4 whitespace-nowrap">Email</td>
                    <td className="px-6 py-4 whitespace-nowrap">{customerDetails?.Email || 'john@example.com'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">Invoice #1234</td>
                    <td className="px-6 py-4">Sent invoice for initial payment</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Customer Settings Tab */}
        {activeTab === 'settings' && (
          currentCustomer ? (
            <CustomerSettings customer={currentCustomer} />
          ) : (
            <div>Loading customer details...</div>
          )
        )}
      </div>
      
      {/* Sales Modal */}
      {currentCustomer && (
        <SalesModal
          customer={currentCustomer}
          isOpen={isSalesModalOpen}
          onClose={() => setIsSalesModalOpen(false)}
        />
      )}
    </div>
  );
}

CustomerTabs.propTypes = {
  customer: PropTypes.object
};

export default CustomerTabs;