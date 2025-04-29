import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../layout/AppLayout';
import { useSales } from '../../hooks/useSales';
import { useAppState } from '../../context/AppStateContext';

function CustomerTabs() {
  const { darkMode } = useTheme();
  const [activeTab, setActiveTab] = useState('sales');
  const { sales, formatSale } = useSales();
  const { customerDetails } = useAppState();
  const [customerSales, setCustomerSales] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});

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
    
    // Month names for display
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    customerSales.forEach(sale => {
      const formattedSale = formatSale(sale);
      
      // Extract YYYY-MM from the date with error handling
      let monthIndex = 0;
      let year = new Date().getFullYear();
      let yearMonth = '';
      let displayMonth = '';
      
      try {
        // Check if date is in expected format
        if (formattedSale.date && typeof formattedSale.date === 'string') {
          const dateParts = formattedSale.date.split('/');
          if (dateParts.length === 3) {
            monthIndex = parseInt(dateParts[0], 10) - 1; // 0-based month index
            year = parseInt(dateParts[2], 10);
            
            // Validate month index is within range
            if (monthIndex >= 0 && monthIndex < 12) {
              yearMonth = `${year}-${(monthIndex + 1).toString().padStart(2, '0')}`;
              displayMonth = `${monthNames[monthIndex]} ${year}`;
            } else {
              // Fallback for invalid month
              const currentDate = new Date();
              monthIndex = currentDate.getMonth();
              year = currentDate.getFullYear();
              yearMonth = `${year}-${(monthIndex + 1).toString().padStart(2, '0')}`;
              displayMonth = `${monthNames[monthIndex]} ${year}`;
              console.warn(`Invalid month index ${monthIndex + 1} for sale ${sale.id}, using current date`);
            }
          } else {
            // Fallback for unexpected date format
            const currentDate = new Date();
            monthIndex = currentDate.getMonth();
            year = currentDate.getFullYear();
            yearMonth = `${year}-${(monthIndex + 1).toString().padStart(2, '0')}`;
            displayMonth = `${monthNames[monthIndex]} ${year}`;
            console.warn(`Unexpected date format for sale ${sale.id}: ${formattedSale.date}, using current date`);
          }
        } else {
          // Fallback if date is missing
          const currentDate = new Date();
          monthIndex = currentDate.getMonth();
          year = currentDate.getFullYear();
          yearMonth = `${year}-${(monthIndex + 1).toString().padStart(2, '0')}`;
          displayMonth = `${monthNames[monthIndex]} ${year}`;
          console.warn(`Missing date for sale ${sale.id}, using current date`);
        }
      } catch (error) {
        // Fallback for any other errors
        const currentDate = new Date();
        monthIndex = currentDate.getMonth();
        year = currentDate.getFullYear();
        yearMonth = `${year}-${(monthIndex + 1).toString().padStart(2, '0')}`;
        displayMonth = `${monthNames[monthIndex]} ${year}`;
        console.error(`Error parsing date for sale ${sale.id}:`, error);
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
            <h4 className="text-lg font-medium mb-4">Products and Services</h4>
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
                                  <td className="px-6 py-3 whitespace-nowrap">{formattedSale.date}</td>
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
          <div>
            <h4 className="text-lg font-medium mb-4">Customer Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h5 className="font-medium mb-2">Billing Information</h5>
                <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Billable Currency</label>
                    <div className="text-base">USD</div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Billing Address</label>
                    <div className="text-base">
                      {customerDetails?.Address || '123 Business St.'}<br />
                      {customerDetails?.City || 'San Francisco'}, {customerDetails?.State || 'CA'} {customerDetails?.PostalCode || '94103'}<br />
                      {customerDetails?.Country || 'USA'}
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Payment Terms</label>
                    <div className="text-base">Net 30</div>
                  </div>
                </div>
              </div>
              <div>
                <h5 className="font-medium mb-2">Contact Information</h5>
                <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Primary Contact</label>
                    <div className="text-base">John Smith</div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <div className="text-base">{customerDetails?.Email || 'john@example.com'}</div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Phone</label>
                    <div className="text-base">{customerDetails?.Phone || '555-123-4567'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CustomerTabs;