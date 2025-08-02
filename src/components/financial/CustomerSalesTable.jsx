import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { createQBOCustomer, createQBOInvoice, listQBOCustomerByName, listQBOCustomers } from '../../api/quickbooksEdgeFunction';
import { adminUpdate } from '../../services/supabaseService';
import CreateQBOCustomerModal from './CreateQBOCustomerModal';
import RecordDetailsModal from './RecordDetailsModal';

/**
 * Component to display individual sales lines for a customer
 * @param {Object} props - Component props
 * @param {Array} props.records - Sales records to display
 * @param {function} props.onEditRecord - Function to call when a record is edited
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 * @param {function} [props.onRefresh] - Optional callback to refresh data after invoice creation
 * @returns {JSX.Element} Customer sales table component
 */
function CustomerSalesTable({ records, onEditRecord, darkMode = false, onRefresh }) {
  // State for tracking loading state during QBO operations
  const [isProcessing, setIsProcessing] = useState(false);
  const [sortConfig, setSortConfig] = useState({
    key: 'date',
    direction: 'desc'
  });
  const [showCreateCustomerModal, setShowCreateCustomerModal] = useState(false);
  const [showRecordDetailsModal, setShowRecordDetailsModal] = useState(false);
  const [selectedGroupRecords, setSelectedGroupRecords] = useState([]);
  const [selectedGroupTitle, setSelectedGroupTitle] = useState('');
  const customerName = records.length > 0 ? records[0].customers?.business_name : 'Unknown Customer';

  // Handle clicking on a summary row to show detailed records
  const handleRowClick = useCallback((group) => {
    setSelectedGroupRecords(group.records);
    setSelectedGroupTitle(`${group.product_name} - ${group.monthYear}`);
    setShowRecordDetailsModal(true);
  }, []);

  // Handle closing the record details modal
  const handleCloseRecordDetails = useCallback(() => {
    setShowRecordDetailsModal(false);
    setSelectedGroupRecords([]);
    setSelectedGroupTitle('');
  }, []);

  // Sort records based on current sort configuration
  // Group and summarize records by product_name and month/year
  const summarizedRecords = React.useMemo(() => {
    const groupMap = new Map();
    records.forEach(record => {
      const dateObj = new Date(record.date);
      const monthYear = dateObj.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      const key = `${record.product_name || 'No Product'}|${monthYear}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          groupKey: key,
          product_name: record.product_name || 'No Product',
          monthYear,
          quantity: 0,
          total_price: 0,
          unit_price: 0, // Not meaningful for summary, but can show avg if needed
          records: [],
        });
      }
      const group = groupMap.get(key);
      group.quantity += Number(record.quantity) || 0;
      group.total_price += Number(record.total_price) || 0;
      group.records.push(record);
    });
    // Optionally, calculate average unit price for the group
    groupMap.forEach(group => {
      if (group.records.length > 0) {
        group.unit_price = group.quantity > 0 ? group.total_price / group.quantity : 0;
      }
    });
    // Convert to array and sort
    const arr = Array.from(groupMap.values());
    return arr.sort((a, b) => {
      // Sort by date (desc/asc), then by product_name
      const aDate = new Date(a.records[0].date);
      const bDate = new Date(b.records[0].date);
      if (sortConfig.key === 'date') {
        if (aDate < bDate) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aDate > bDate) return sortConfig.direction === 'asc' ? 1 : -1;
      }
      if (sortConfig.key === 'product_name') {
        if (a.product_name < b.product_name) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a.product_name > b.product_name) return sortConfig.direction === 'asc' ? 1 : -1;
      }
      if (sortConfig.key === 'quantity') {
        if (a.quantity < b.quantity) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a.quantity > b.quantity) return sortConfig.direction === 'asc' ? 1 : -1;
      }
      if (sortConfig.key === 'unit_price') {
        if (a.unit_price < b.unit_price) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a.unit_price > b.unit_price) return sortConfig.direction === 'asc' ? 1 : -1;
      }
      if (sortConfig.key === 'total_price') {
        if (a.total_price < b.total_price) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a.total_price > b.total_price) return sortConfig.direction === 'asc' ? 1 : -1;
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

  // Format quantity to limit to 2 decimal places maximum
  const formatQuantity = (quantity) => {
    const num = Number(quantity) || 0;
    return num % 1 === 0 ? num.toString() : num.toFixed(2);
  };

  /**
   * Handles the QBO invoice button click
   * Orchestrates the billing workflow:
   * 1. Creates an invoice in QBO for the selected customer
   * 2. Updates the inv_id field in Supabase for each sales item
   * 3. Updates billable hours records to mark them as billed
   * 4. Triggers QBO to send the invoice
   */
  const handleQboInvoiceClick = useCallback(async () => {
    if (records.length === 0) {
      alert('No sales records to invoice');
      return;
    }

    // Check if any records are already invoiced
    const alreadyInvoiced = records.some(record => record.inv_id !== null);
    if (alreadyInvoiced) {
      const proceed = window.confirm('Some records are already invoiced. Do you want to proceed with invoicing the remaining records?');
      if (!proceed) return;
    }

    try {
      setIsProcessing(true);

      // Get the customer ID and name from the first record
      const firstRecord = records[0];
      const customerId = firstRecord.customer_id;
      const customerName = firstRecord.customers?.business_name || 'Unknown Customer';

      if (!customerId) {
        alert('Customer ID is missing from the sales records');
        return;
      }

      // Find QBO customer by name
      let qboCustomerId = null;
      let qboCustomerCurrencyRef = 'CAD'; // Default currency
      
      // Query QBO for customers by name - wrap in try-catch to handle 500 errors gracefully
      console.log(`Searching for QuickBooks customer: "${customerName}"`);
      let qboCustomers = [];
      let shouldTryFallback = false;
      
      try {
        const qboCustomersResult = await listQBOCustomerByName(customerName);
        console.log('QBO Customer Search Result:', qboCustomersResult);
        
        // Check if the result indicates other types of failure first
        // Allow 404s and 500s to fall through to the fallback logic
        if (qboCustomersResult.success === false &&
            !(qboCustomersResult.detail === "Not Found" ||
              qboCustomersResult.detail === "Failed to execute query" ||
              qboCustomersResult.status === 404 ||
              qboCustomersResult.status === 500 ||
              (qboCustomersResult.error && qboCustomersResult.error.includes('404')) ||
              (qboCustomersResult.error && qboCustomersResult.error.includes('500')))) {
          // Handle different error response structures (but not 404s or 500s)
          const errorMessage = qboCustomersResult.error ||
                              qboCustomersResult.message ||
                              (qboCustomersResult.Fault && qboCustomersResult.Fault.Error && qboCustomersResult.Fault.Error[0]) ||
                              'Unknown error occurred';
          throw new Error(`Failed to query QuickBooks customers: ${errorMessage}`);
        }
        
        // Handle successful response or 404/500 - extract customers
        qboCustomers = qboCustomersResult.QueryResponse?.Customer || [];
        
        // If we got a 404 or 500 or empty result, trigger fallback
        if (qboCustomers.length === 0) {
          shouldTryFallback = true;
        }
      } catch (error) {
        console.warn('listQBOCustomerByName failed, will try fallback:', error);
        shouldTryFallback = true;
      }
      
      // If we need to try fallback (404, 500, or empty result), try a broader search
      if (shouldTryFallback) {
        console.log(`No exact match found for "${customerName}". Trying to list all customers for manual matching...`);
        
        // Try to get all customers and do a fuzzy match
        try {
          const allCustomersResult = await listQBOCustomers();
          console.log('All customers query result:', allCustomersResult);
          
          if (allCustomersResult && allCustomersResult.customers) {
            const allCustomers = allCustomersResult.customers;
            
            // Debug: Show what we're searching for and first few customers
            console.log(`🔍 CUSTOMER SEARCH DEBUG:`);
            console.log(`- Searching for: "${customerName}"`);
            console.log(`- Total customers: ${allCustomers.length}`);
            console.log(`- First 3 customers:`, allCustomers.slice(0, 3).map(c => ({
              Id: c.Id,
              DisplayName: c.DisplayName,
              CompanyName: c.CompanyName,
              FullyQualifiedName: c.FullyQualifiedName
            })));
            
            // Simple exact match first
            const normalizedSearchName = customerName.toLowerCase().trim();
            let matchedCustomers = allCustomers.filter(customer => {
              const displayName = customer.DisplayName?.toLowerCase().trim() || '';
              const companyName = customer.CompanyName?.toLowerCase().trim() || '';
              const fullyQualifiedName = customer.FullyQualifiedName?.toLowerCase().trim() || '';
              
              const isMatch = displayName === normalizedSearchName ||
                             companyName === normalizedSearchName ||
                             fullyQualifiedName === normalizedSearchName;
              
              if (isMatch) {
                console.log(`✅ EXACT MATCH FOUND:`, {
                  Id: customer.Id,
                  DisplayName: customer.DisplayName,
                  CompanyName: customer.CompanyName,
                  searchTerm: customerName
                });
              }
              
              return isMatch;
            });
            
            console.log(`- Exact matches: ${matchedCustomers.length}`);
            
            // If no exact match, try partial
            if (matchedCustomers.length === 0) {
              console.log(`- Trying partial matches...`);
              matchedCustomers = allCustomers.filter(customer => {
                const displayName = customer.DisplayName?.toLowerCase() || '';
                const companyName = customer.CompanyName?.toLowerCase() || '';
                const fullyQualifiedName = customer.FullyQualifiedName?.toLowerCase() || '';
                
                const isMatch = displayName.includes(normalizedSearchName) ||
                               companyName.includes(normalizedSearchName) ||
                               fullyQualifiedName.includes(normalizedSearchName);
                
                if (isMatch) {
                  console.log(`✅ PARTIAL MATCH FOUND:`, {
                    Id: customer.Id,
                    DisplayName: customer.DisplayName,
                    CompanyName: customer.CompanyName,
                    searchTerm: customerName
                  });
                }
                
                return isMatch;
              });
              console.log(`- Partial matches: ${matchedCustomers.length}`);
            }
            
            console.log(`Found ${matchedCustomers.length} potential matches:`, matchedCustomers.map(c => c.DisplayName));
            
            if (matchedCustomers.length > 0) {
              // Use the matched customers
              qboCustomers = matchedCustomers;
            }
          }
        } catch (broadSearchError) {
          console.warn('Broad customer search failed:', broadSearchError);
        }
      }
      
      // If still no customers found after all attempts, show create modal
      if (qboCustomers.length === 0) {
        console.log(`Customer "${customerName}" not found in QuickBooks after all search attempts`);
        setShowCreateCustomerModal(true);
        return; // Exit the function here, it will be resumed after customer creation
      }
      
      if (qboCustomers.length === 0) {
        // No matching customer found, show modal to create one
        setShowCreateCustomerModal(true);
        return; // Exit the function here, it will be resumed after customer creation
      } else if (qboCustomers.length === 1) {
        // Exactly one matching customer found
        qboCustomerId = qboCustomers[0].Id;
        qboCustomerCurrencyRef = qboCustomers[0].CurrencyRef?.value || 'CAD';

        console.log(`Found matching QBO customer: ${qboCustomers[0].DisplayName} (ID: ${qboCustomerId}) (CURRENCY: ${qboCustomerCurrencyRef})`);

      } else {
        // Multiple matching customers found, ask user to select one
        let customerOptions = '';
        qboCustomers.forEach((customer, index) => {
          customerOptions += `${index + 1}: ${customer.DisplayName}\n`;
        });
        
        const selectedIndex = prompt(
          `Multiple matching customers found in QuickBooks. Please enter the number of the correct customer:\n\n${customerOptions}`,
          '1'
        );
        
        if (!selectedIndex || isNaN(parseInt(selectedIndex)) || parseInt(selectedIndex) < 1 || parseInt(selectedIndex) > qboCustomers.length) {
          alert('Invalid selection. Invoice creation cancelled.');
          return;
        }
        
        const selectedCustomer = qboCustomers[parseInt(selectedIndex) - 1];
        qboCustomerId = selectedCustomer.Id;
        qboCustomerCurrencyRef = selectedCustomer.CurrencyRef?.value || 'CAD';
        console.log(`Selected QBO customer: ${selectedCustomer.DisplayName} (ID: ${qboCustomerId}) (CURRENCY: ${qboCustomerCurrencyRef})`);
      }

      // Filter out records that are already invoiced
      const recordsToInvoice = records.filter(record => record.inv_id === null);
      
      if (recordsToInvoice.length === 0) {
        alert('All records are already invoiced');
        return;
      }

      const ItemRef = `Development Income:Development ${qboCustomerCurrencyRef}`

      // Prepare invoice data for QBO
      const invoiceData = {
        CustomerRef: {
          value: qboCustomerId
        },
        Line: recordsToInvoice.map(record => ({
          DetailType: 'SalesItemLineDetail',
          SalesItemLineDetail: {
            ItemRef: {
              name: ItemRef
            },
            Qty: record.quantity || 1,
            UnitPrice: record.unit_price || 0
          },
          Amount: record.total_price || 0,
          Description: record.product_name || 'Development'
        }))
      };

      // Create invoice in QBO
      console.log('Creating QBO invoice with data:', invoiceData);
      const invoiceResult = await createQBOInvoice(invoiceData);
      console.log('QBO Invoice creation result:', invoiceResult);
      
      // Handle different response structures
      let qboInvoiceId = null;
      
      if (invoiceResult.success && invoiceResult.data && invoiceResult.data.Id) {
        // Standard success response
        qboInvoiceId = invoiceResult.data.Id;
      } else if (invoiceResult.Invoice && invoiceResult.Invoice.Id) {
        // Direct invoice response
        qboInvoiceId = invoiceResult.Invoice.Id;
      } else if (invoiceResult.QueryResponse && invoiceResult.QueryResponse.Invoice && invoiceResult.QueryResponse.Invoice[0]) {
        // Query response format
        qboInvoiceId = invoiceResult.QueryResponse.Invoice[0].Id;
      } else {
        // Handle error cases
        const errorMessage = invoiceResult.error ||
                            invoiceResult.message ||
                            invoiceResult.detail ||
                            (invoiceResult.Fault && invoiceResult.Fault.Error && invoiceResult.Fault.Error[0] && invoiceResult.Fault.Error[0].Detail) ||
                            'Unknown error occurred during invoice creation';
        throw new Error(`Failed to create invoice in QuickBooks: ${errorMessage}`);
      }
      console.log(`Invoice created in QBO with ID: ${qboInvoiceId}`);

      // Update the inv_id field in Supabase for each sales item
      const updatePromises = recordsToInvoice.map(async (record) => {
        const updateData = {
          inv_id: qboInvoiceId
        };

        const updateResult = await adminUpdate('customer_sales', updateData, { id: record.id });
        
        if (!updateResult.success) {
          console.error(`Failed to update inv_id for record ${record.id}: ${updateResult.error}`);
          return false;
        }

        // If the record has a financial_id, update the corresponding billable hours record
        if (record.financial_id) {
          // Update the billable hours record in Supabase
          const billableUpdateData = {
            f_billed: 1
          };
          
          const billableUpdateResult = await adminUpdate('billable_hours', billableUpdateData, { id: record.financial_id });
          
          if (!billableUpdateResult.success) {
            console.error(`Failed to update billable hours record ${record.financial_id}: ${billableUpdateResult.error}`);
            return false;
          }
          
          console.log(`Marked billable hours record ${record.financial_id} as billed`);
        }

        return true;
      });

      // Wait for all updates to complete
      const updateResults = await Promise.all(updatePromises);
      
      // Check if all updates were successful
      const allUpdatesSuccessful = updateResults.every(result => result === true);
      
      if (!allUpdatesSuccessful) {
        throw new Error('Some records failed to update');
      }

      // Trigger QBO to send the invoice
      // This would typically be done through a dedicated API or service
      // For now, we'll just log it
      console.log(`Sending invoice ${qboInvoiceId} to customer`);

      alert(`Invoice created successfully in QuickBooks Online with ID: ${qboInvoiceId}`);
      
      // Refresh the data to show updated invoice status
      if (typeof onRefresh === 'function') {
        onRefresh();
      } else {
        // Fallback to page reload if no refresh callback provided
        window.location.reload();
      }
      
    } catch (error) {
      console.error('Error creating QBO invoice:', error);
      alert(`Error creating invoice: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [records]);
  
  // Handle creating a customer in QBO
  const handleCreateCustomer = async (customerData) => {
    try {
      setIsProcessing(true);
      
      console.log('Creating customer with data:', customerData);
      const result = await createQBOCustomer(customerData);
      
      if (!result.success) {
        throw new Error(`Failed to create customer in QuickBooks: ${result.error}`);
      }
      
      const qboCustomerId = result.Customer.Id;
      console.log(`Customer created in QBO with ID: ${qboCustomerId}`);
      
      // Close the modal
      setShowCreateCustomerModal(false);
      
      // Continue with invoice creation
      handleQboInvoiceClick();
      
      return result;
    } catch (error) {
      console.error('Error creating QBO customer:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={`
      rounded-lg border overflow-hidden mt-4 flex flex-col h-full
      ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
    `}>
      {/* Fixed Header */}
      <div className={`
        flex-shrink-0 px-4 py-3 border-b flex justify-between items-center
        ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}
      `}>
        <h3 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Sales Lines
        </h3>
        <button
          onClick={handleQboInvoiceClick}
          className="px-2 py-1 text-xs font-medium text-white rounded"
          style={{ backgroundColor: '#2CA01C' }}
          title="Create QuickBooks Online Invoice"
          disabled={isProcessing}
        >
          {isProcessing ? '...' : 'qb'}
        </button>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-hidden">
        {records.length === 0 ? (
          <div className={`p-4 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            No sales data available for this customer
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
                {summarizedRecords.map(group => (
                  <tr
                    key={group.groupKey}
                    onClick={() => handleRowClick(group)}
                    className={`
                      cursor-pointer transition-colors
                      ${darkMode
                        ? 'text-gray-300 hover:bg-gray-700'
                        : 'text-gray-800 hover:bg-gray-50'}
                    `}
                    title="Click to view detailed records"
                  >
                    <td className="px-4 py-3 text-sm">
                      {group.monthYear}
                    </td>
                    <td className="px-4 py-3 text-sm max-w-xs truncate">
                      {group.product_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {formatQuantity(group.quantity)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {formatCurrency(group.unit_price)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {formatCurrency(group.total_price)}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      {/* Status: If all records invoiced, show Invoiced, else Uninvoiced */}
                      <span className={`
                        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${group.records.every(r => r.inv_id !== null)
                          ? (darkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800')
                          : (darkMode ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-800')}
                      `}>
                        {group.records.every(r => r.inv_id !== null) ? 'Invoiced' : 'Uninvoiced'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      {/* Edit action disabled for summary rows */}
                      <button
                        disabled
                        className={`
                          inline-flex items-center px-2 py-1 border rounded-md text-xs font-medium opacity-50 cursor-not-allowed
                          ${darkMode
                            ? 'border-gray-600 bg-gray-700 text-gray-200'
                            : 'border-gray-300 bg-white text-gray-700'}
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
      
      {/* Create Customer Modal */}
      {showCreateCustomerModal && (
        <CreateQBOCustomerModal
          customerName={customerName}
          onClose={() => setShowCreateCustomerModal(false)}
          onSave={handleCreateCustomer}
          darkMode={darkMode}
        />
      )}
      
      {/* Record Details Modal */}
      {showRecordDetailsModal && (
        <RecordDetailsModal
          records={selectedGroupRecords}
          groupTitle={selectedGroupTitle}
          onClose={handleCloseRecordDetails}
          onEditRecord={onEditRecord}
          darkMode={darkMode}
        />
      )}
    </div>
  );
}

CustomerSalesTable.propTypes = {
  records: PropTypes.array.isRequired,
  onEditRecord: PropTypes.func.isRequired,
  darkMode: PropTypes.bool,
  onRefresh: PropTypes.func
};

export default React.memo(CustomerSalesTable);