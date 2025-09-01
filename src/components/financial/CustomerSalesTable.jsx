import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { createQBOCustomer, createQBOInvoice, listQBOCustomers, sendQBOInvoiceEmail, searchQBOCustomers } from '../../api/quickbooksApi';
import { update } from '../../services/supabaseService';
import { fetchFinancialRecordByUUID, updateFinancialRecordBilledStatus } from '../../api/financialRecords';
import { generateInvoicePayload, validateInvoiceData, formatInvoiceForLogging } from '../../services/invoiceGenerationService';
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
  const [processingMilestone, setProcessingMilestone] = useState('');
  const [sortConfig, setSortConfig] = useState({
    key: 'date',
    direction: 'desc'
  });
  const [showCreateCustomerModal, setShowCreateCustomerModal] = useState(false);
  const [showRecordDetailsModal, setShowRecordDetailsModal] = useState(false);
  const [selectedGroupRecords, setSelectedGroupRecords] = useState([]);
  const [selectedGroupTitle, setSelectedGroupTitle] = useState('');
  const customerName = records.length > 0 ? records[0].customers?.business_name : 'Unknown Customer';

  /**
   * Search for QuickBooks customers using the dedicated search endpoint
   * Uses the tested /quickbooks/customers/search endpoint with SDK filtering
   * @param {string} searchName - Customer name to search for
   * @returns {Promise<Array>} Array of matching customers
   */
  const searchQBOCustomerAdvanced = useCallback(async (searchName) => {
    console.log(`🔍 [INVESTIGATION] Searching for QuickBooks customer: "${searchName}"`);
    console.log(`🔍 [INVESTIGATION] About to call searchQBOCustomers function from quickbooksApi.js`);
    
    try {
      // Use the dedicated search endpoint with name parameter
      const searchParams = {
        name: searchName,
        active_only: true,
        max_results: 20
      };
      console.log(`🔍 [INVESTIGATION] Search parameters:`, searchParams);
      
      const result = await searchQBOCustomers(searchParams);
      console.log(`🔍 [INVESTIGATION] searchQBOCustomers returned:`, result);
      
      if (result?.customers && result.customers.length > 0) {
        console.log(`✅ [INVESTIGATION] Found ${result.customers.length} customer(s) matching "${searchName}"`);
        return result.customers;
      } else {
        console.log(`❌ [INVESTIGATION] No customers found for "${searchName}"`);
        return [];
      }
    } catch (error) {
      console.error('🚨 [INVESTIGATION] Customer search error:', error);
      console.error('🚨 [INVESTIGATION] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      return [];
    }
  }, []);

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

  // Handle record update for optimistic updates
  const handleRecordUpdate = useCallback((updatedRecord) => {
    // Update the selected group records optimistically
    setSelectedGroupRecords(prevRecords =>
      prevRecords.map(record =>
        record.id === updatedRecord.id ? { ...record, ...updatedRecord } : record
      )
    );
    
    // Call the parent refresh callback to update the main data
    if (typeof onRefresh === 'function') {
      onRefresh();
    }
  }, [onRefresh]);

  // Helper function to parse record dates consistently (avoiding UTC issues)
  const parseRecordDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(num => parseInt(num, 10));
    return new Date(year, month - 1, day); // month is 0-indexed in Date constructor
  };

  // Sort records based on current sort configuration
  // Group and summarize records by product_name and month/year
  const summarizedRecords = React.useMemo(() => {
    const groupMap = new Map();
    records.forEach(record => {
      const dateObj = parseRecordDate(record.date);
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
      const aDate = parseRecordDate(a.records[0].date);
      const bDate = parseRecordDate(b.records[0].date);
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
    console.log('🚀 [INVESTIGATION] QuickBooks invoice button clicked - starting systematic investigation');
    console.log('🔍 [INVESTIGATION] Component imports from:', '../../api/quickbooksApi');
    
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
      setProcessingMilestone('Starting...');

      // Get the customer ID and name from the first record
      const firstRecord = records[0];
      const customerId = firstRecord.customer_id;
      const customerName = firstRecord.customers?.business_name || 'Unknown Customer';
      
      console.log('🔍 [INVESTIGATION] Customer details:', { customerId, customerName });

      if (!customerId) {
        alert('Customer ID is missing from the sales records');
        return;
      }

      // Find QBO customer using advanced search
      setProcessingMilestone('Finding customer...');
      console.log('🔍 [INVESTIGATION] About to call searchQBOCustomerAdvanced with:', customerName);
      const qboCustomers = await searchQBOCustomerAdvanced(customerName);
      
      // If no customers found, show create modal
      if (qboCustomers.length === 0) {
        console.log(`Customer "${customerName}" not found in QuickBooks`);
        setShowCreateCustomerModal(true);
        return;
      }
      
      let selectedQboCustomer = null;
      
      if (qboCustomers.length === 1) {
        // Exactly one matching customer found
        selectedQboCustomer = qboCustomers[0];
        console.log(`Found matching QBO customer: ${selectedQboCustomer.DisplayName} (ID: ${selectedQboCustomer.Id})`);
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
        
        selectedQboCustomer = qboCustomers[parseInt(selectedIndex) - 1];
        console.log(`Selected QBO customer: ${selectedQboCustomer.DisplayName} (ID: ${selectedQboCustomer.Id})`);
      }

      // Filter out records that are already invoiced
      const recordsToInvoice = records.filter(record => record.inv_id === null);
      
      if (recordsToInvoice.length === 0) {
        alert('All records are already invoiced');
        return;
      }

      // Validate invoice data before generating payload
      const validation = validateInvoiceData(recordsToInvoice, selectedQboCustomer);
      if (!validation.isValid) {
        console.error('Invoice data validation failed:', validation.errors);
        alert(`Cannot create invoice: ${validation.errors.join(', ')}`);
        return;
      }

      setProcessingMilestone('Generating invoice...');
      
      // Generate advanced invoice payload using the new service
      const invoicePayload = await generateInvoicePayload(recordsToInvoice, selectedQboCustomer);
      
      console.log('Generated advanced invoice payload:');
      console.log(formatInvoiceForLogging(invoicePayload));

      setProcessingMilestone('Creating invoice...');
      // Create invoice in QBO
      console.log('Creating QBO invoice with advanced payload:', invoicePayload);
      const invoiceResult = await createQBOInvoice(invoicePayload);
      
      // Comprehensive logging for debugging postprocessing issues
      //   "invoice": {
      //     "AllowIPNPayment": true,
      //     "AllowOnlineACHPayment": false,
      //     "AllowOnlineCreditCardPayment": false,
      //     "ApplyTaxAfterDiscount": false,
      //     "Balance": 0,
      //     "BillAddr": null,
      //     "BillEmail": null,
      //     "BillEmailBcc": null,
      //     "BillEmailCc": null,
      //     "CurrencyRef": null,
      //     "CustomField": [],
      //     "CustomerMemo": null,
      //     "CustomerRef": {
      //       "name": "AL3",
      //       "value": "394"
      //     },
      //     "DeliveryInfo": null,
      //     "DepartmentRef": null,
      //     "Deposit": 0,
      //     "DocNumber": "3942507001",
      //     "DueDate": "2025-07-31",
      //     "EInvoiceStatus": null,
      //     "EmailStatus": "NotSet",
      //     "ExchangeRate": 1,
      //     "FreeFormAddress": false,
      //     "GlobalTaxCalculation": "TaxExcluded",
      //     "HomeBalance": 0,
      //     "HomeTotalAmt": 0,
      //     "Id": "6495",
      //     "InvoiceLink": "",
      //     "Line": [
      //       {
      //         "Amount": 697,
      //         "Description": "AL3:NAEMT",
      //         "DetailType": "SalesItemLineDetail",
      //         "LineNum": 1,
      //         "SalesItemLineDetail": {
      //           "ItemRef": {
      //             "name": "Development USD",
      //             "value": "7"
      //           },
      //           "Qty": 6.97,
      //           "TaxCodeRef": {
      //             "value": 3
      //           },
      //           "UnitPrice": 100
      //         }
      //       },
      //       {
      //         "Amount": 76.5,
      //         "Description": "AL3:Miro",
      //         "DetailType": "SalesItemLineDetail",
      //         "LineNum": 2,
      //         "SalesItemLineDetail": {
      //           "ItemRef": {
      //             "name": "Development USD",
      //             "value": "7"
      //           },
      //           "Qty": 0.765,
      //           "TaxCodeRef": {
      //             "value": 3
      //           },
      //           "UnitPrice": 100
      //         }
      //       },
      //       {
      //         "Amount": 34,
      //         "Description": "AL3:In",
      //         "DetailType": "SalesItemLineDetail",
      //         "LineNum": 3,
      //         "SalesItemLineDetail": {
      //           "ItemRef": {
      //             "name": "Development USD",
      //             "value": "7"
      //           },
      //           "Qty": 0.34,
      //           "TaxCodeRef": {
      //             "value": 3
      //           },
      //           "UnitPrice": 100
      //         }
      //       },
      //       {
      //         "Amount": 42.5,
      //         "Description": "AL3:TSL",
      //         "DetailType": "SalesItemLineDetail",
      //         "LineNum": 4,
      //         "SalesItemLineDetail": {
      //           "ItemRef": {
      //             "name": "Development USD",
      //             "value": "7"
      //           },
      //           "Qty": 0.425,
      //           "TaxCodeRef": {
      //             "value": 3
      //           },
      //           "UnitPrice": 100
      //         }
      //       }
      //     ],
      //     "LinkedTxn": [],
      //     "MetaData": null,
      //     "PrintStatus": "NotSet",
      //     "PrivateNote": "",
      //     "RecurDataRef": null,
      //     "SalesTermRef": null,
      //     "ShipAddr": null,
      //     "ShipDate": "",
      //     "ShipMethodRef": null,
      //     "SyncToken": 0,
      //     "TaxExemptionRef": null,
      //     "TotalAmt": "",
      //     "TrackingNum": "",
      //     "TxnDate": "",
      //     "TxnTaxDetail": null,
      //     "domain": "QBO",
      //     "sparse": false
      //   }
      // }

      // Handle different response structures
      let qboInvoiceId = null;
      
      if (invoiceResult.invoice && invoiceResult.invoice.Id) {
        // Direct invoice response (lowercase) - CURRENT FORMAT
        qboInvoiceId = invoiceResult.invoice.Id;
        console.log('✅ Success: Direct invoice format (lowercase), ID:', qboInvoiceId);
      } else if (invoiceResult.Invoice && invoiceResult.Invoice.Id) {
        // Direct Invoice response (uppercase) - Legacy format
        qboInvoiceId = invoiceResult.Invoice.Id;
        console.log('✅ Success: Direct Invoice format (uppercase), ID:', qboInvoiceId);
      } else {
        // Handle error cases - check for various error response formats
        let errorMessage = 'Unknown error occurred during invoice creation';
        
        if (invoiceResult.detail) {
          // Backend API error format (most common)
          errorMessage = invoiceResult.detail;
        } else if (invoiceResult.error) {
          // Generic error field
          errorMessage = invoiceResult.error;
        } else if (invoiceResult.message) {
          // Message field
          errorMessage = invoiceResult.message;
        } else if (invoiceResult.Fault && invoiceResult.Fault.Error && invoiceResult.Fault.Error[0] && invoiceResult.Fault.Error[0].Detail) {
          // QuickBooks SDK fault format
          errorMessage = invoiceResult.Fault.Error[0].Detail;
        } else if (invoiceResult.Fault ) {
          // QuickBooks SDK fault format
          errorMessage = invoiceResult.Fault;
        }
        
        throw new Error(`Failed to create invoice in QuickBooks: ${errorMessage}`);
      }
      console.log(`Invoice created in QBO with ID: ${qboInvoiceId}`);

      setProcessingMilestone('Updating records...');
      // Update the inv_id field in Supabase for each sales item
      const updatePromises = recordsToInvoice.map(async (record) => {
        const updateData = {
          inv_id: qboInvoiceId
        };

        const updateResult = await update('customer_sales', updateData, { id: record.id });
        
        if (!updateResult.success) {
          console.error(`Failed to update inv_id for record ${record.id}: ${updateResult.error}`);
          return false;
        }
        
        // If the record has a financial_id, update the corresponding billable hours record in FileMaker
        if (record.financial_id) {
          try {
            // First, fetch the FileMaker record using the UUID to get the actual recordId
            console.log(`Looking up FileMaker record by UUID: ${record.financial_id}`);
            const fileMakerRecord = await fetchFinancialRecordByUUID(record.financial_id);
            console.log("FileMaker record: ", fileMakerRecord)
            if (!fileMakerRecord.response || !fileMakerRecord.response.data || fileMakerRecord.response.data.length === 0) {
              console.error(`Failed to find FileMaker record with UUID ${record.financial_id}`);
              return false;
            }
            
            // Get the actual FileMaker recordId from the response
            const recordId = fileMakerRecord.response.data[0].recordId;
            console.log(`Found FileMaker record with recordId: ${recordId}`);
            
            // Update the billable hours record in FileMaker to mark as billed
            const billableUpdateResult = await updateFinancialRecordBilledStatus(recordId, 1);
            console.log("Update: ", billableUpdateResult);
            
            // Check if the update was successful
            if (!billableUpdateResult || !billableUpdateResult.response || !billableUpdateResult.response.data) {
              console.error(`Error updating billable hours record for UUID ${record.financial_id}:`, billableUpdateResult);
              return false;
            }
            
            console.log(`Successfully marked billable hours record ${recordId} (UUID: ${record.financial_id}) as billed in FileMaker`);
          } catch (error) {
            console.error(`Error updating billable hours record for UUID ${record.financial_id}:`, error);
            return false;
          }
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

      // Send the invoice email using QBO native functionality
      setProcessingMilestone('Sending invoice email...');
      try {
        console.log(`Sending invoice ${qboInvoiceId} to customer via email`);
        const emailResult = await sendQBOInvoiceEmail(qboInvoiceId);
        console.log('Invoice email sent successfully:', emailResult);
        
        alert(`Invoice created successfully in QuickBooks Online and email sent to customer.`);
      } catch (emailError) {
        console.warn('Failed to send invoice email:', emailError);
        
        // Extract the actual error message from the error object
        let errorMessage = 'Unknown email error';
        if (typeof emailError === 'string') {
          errorMessage = emailError;
        } else if (emailError.error) {
          errorMessage = emailError.error;
        } else if (emailError.message) {
          errorMessage = emailError.message;
        } else if (emailError.detail) {
          errorMessage = emailError.detail;
        }
        
        // Don't fail the entire process if email sending fails
        alert(`Invoice created successfully in QuickBooks Online. However, there was an issue sending the email: ${errorMessage}`);
      }
      
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
      setProcessingMilestone('');
    }
  }, [records]);
  
  // Handle creating a customer in QBO
  const handleCreateCustomer = async (customerData) => {
    try {
      setIsProcessing(true);
      
      console.log('Creating customer with data:', customerData);
      const result = await createQBOCustomer(customerData);

      console.log("customer create result: ",result)
      const qboCustomerId = result.customer.Id;
      
      if (!qboCustomerId) {
        throw new Error(`Failed to create customer in QuickBooks: ${result.error}`);
      }
      

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
          className={`px-2 py-1 text-xs font-medium text-white rounded transition-all duration-200 ${
            isProcessing ? 'min-w-[120px]' : 'min-w-[32px]'
          }`}
          style={{
            backgroundColor: '#2CA01C',
            whiteSpace: 'nowrap'
          }}
          title="Create QuickBooks Online Invoice"
          disabled={isProcessing}
        >
          {isProcessing ? (processingMilestone || 'Processing...') : 'qb'}
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
          onRecordUpdated={handleRecordUpdate}
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