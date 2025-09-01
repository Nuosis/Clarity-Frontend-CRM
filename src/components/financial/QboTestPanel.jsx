import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  listQBOCustomerByName,
  createQBOCustomer,
  getQBOInvoiceByQuery,
  createQBOInvoice,
  sendQBOInvoiceEmail,
  getQBOCustomer
} from '../../api/quickbooksApi';
import { executeScript } from '../../api/fileMakerEdgeFunction';
import { fetchDataFromFileMaker } from '../../api/fileMaker';
import { useAppState } from '../../context/AppStateContext';
import { adminUpdate } from '../../services/supabaseService';

// Chevron icon component that rotates based on expanded state
const ChevronIcon = ({ expanded, darkMode }) => (
  <svg
    className={`h-5 w-5 transform transition-transform duration-200 ${expanded ? 'rotate-180' : ''} ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
      clipRule="evenodd"
    />
  </svg>
);

// Collapsible panel component
const CollapsiblePanel = ({
  title,
  children,
  darkMode,
  defaultExpanded = false,
  errorMessage = null,
  panelType = 'default' // 'default', 'error', 'success'
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  // Determine panel styling based on type
  let panelStyle = '';
  let titleStyle = '';
  
  switch (panelType) {
    case 'error':
      panelStyle = darkMode ? 'bg-red-900 bg-opacity-30 border-red-800' : 'bg-red-50 border-red-200';
      titleStyle = darkMode ? 'text-red-200' : 'text-red-800';
      break;
    case 'success':
      panelStyle = darkMode ? 'bg-green-900 bg-opacity-30 border-green-800' : 'bg-green-50 border-green-200';
      titleStyle = darkMode ? 'text-green-200' : 'text-green-800';
      break;
    default:
      panelStyle = darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200';
      titleStyle = darkMode ? 'text-white' : 'text-gray-900';
  }
  
  return (
    <div className={`p-3 rounded-lg border mb-4 ${panelStyle}`}>
      <div
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1">
          <h4 className={`font-medium ${titleStyle} flex items-center`}>
            {title}
            {errorMessage && (
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-red-800 text-red-100' : 'bg-red-100 text-red-800'}`}>
                Error
              </span>
            )}
          </h4>
          {errorMessage && !expanded && (
            <p className={`text-xs mt-1 ${darkMode ? 'text-red-300' : 'text-red-600'}`}>
              {errorMessage.length > 60 ? `${errorMessage.substring(0, 60)}...` : errorMessage}
            </p>
          )}
        </div>
        <ChevronIcon expanded={expanded} darkMode={darkMode} />
      </div>
      
      {expanded && (
        <div className="mt-2">
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * QBO Test Panel component for testing QuickBooks Online and FileMaker edge functions
 * @param {Object} props - Component props
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 * @returns {JSX.Element} QBO Test Panel component
 */
function QboTestPanel({ darkMode = false }) {
  // State for QBO testing
  const [qboQueryResults, setQboQueryResults] = useState(null);
  const [isQboQueryLoading, setIsQboQueryLoading] = useState(false);
  const [qboQueryError, setQboQueryError] = useState(null);
  const [fmHealthResults, setFmHealthResults] = useState(null);
  const [isFmHealthLoading, setIsFmHealthLoading] = useState(false);
  const [fmHealthError, setFmHealthError] = useState(null);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [isUpdatingSupabase, setIsUpdatingSupabase] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  
  // State for invoice query
  const [invoiceResults, setInvoiceResults] = useState(null);
  const [isInvoiceLoading, setIsInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState(null);
  const [invNo, setInvNo] = useState(null);
  
  // State for customer selection
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCustomerName, setSelectedCustomerName] = useState('');
  const [customerRecords, setCustomerRecords] = useState([]);
  const [recordsToInvoice, setRecordsToInvoice] = useState([]);
  const [selectedCurrency, setSelectedCurrency] = useState('CAD');
  
  // Get sales data from app state
  const { sales } = useAppState();
  
  // Check if QBO test flag is enabled
  const isQboTestEnabled = import.meta.env.VITE_TEST_QB === 'true';
  
  // Execute QBO customer query
  const executeCustomerQuery = useCallback(async () => {
    setIsQboQueryLoading(true);
    setQboQueryError(null);
    setQboQueryResults(null);
    
    try {
      // Use the listQBOCustomers function to get all customers
      const result = await listQBOCustomerByName(selectedCustomerName);
      console.log('Customer query result:', result);
      setQboQueryResults(result);
    } catch (error) {
      console.error("Error executing QBO query:", error);
      setQboQueryError(error.message || "Failed to execute QBO query");
    } finally {
      setIsQboQueryLoading(false);
    }
  }, [selectedCustomerName]);
  
  // Create customer in QBO
  const createCustomerInQBO = useCallback(async () => {
    if (!selectedCustomerName) {
      alert('Please select a customer first');
      return;
    }
    
    setIsCreatingCustomer(true);

    const customerEmail = "test@me.com" //replace with actual result of customer email
    
    try {
      // Create customer in QBO
      const customerData = {
        DisplayName: selectedCustomerName,
        CompanyName: selectedCustomerName,
        PrimaryEmailAddr: {
          Address: customerEmail
        },
        // Add currency reference if not CAD
        ...(selectedCurrency !== 'CAD' && {
          CurrencyRef: {
            value: selectedCurrency
          }
        })
      };
      
      console.log('Creating customer with data:', customerData);
      const result = await createQBOCustomer(customerData);
      console.log('Create customer response:', result);
      
      // More detailed logging to understand the response structure
      console.log('Response type:', typeof result);
      console.log('Response keys:', result ? Object.keys(result) : 'No keys (null or undefined)');
      
      if (!result || !result.success) {
        console.error('Create customer failed:', result);
        throw new Error(`Failed to create customer in QuickBooks: ${result?.error || 'Unknown error'}`);
      }
      
      const qboCustomerId = result.Customer?.Id;
      console.log(`Customer created in QBO with ID: ${qboCustomerId}`);
      
      // Refresh the query results to show the newly created customer
      const queryResult = await listQBOCustomerByName(selectedCustomerName);
      setQboQueryResults(queryResult);
      
      alert(`Customer "${selectedCustomerName}" created successfully in QuickBooks Online with ID: ${qboCustomerId}`);
    } catch (error) {
      console.error('Error creating QBO customer:', error);
      setQboQueryError(error.message || "Failed to create customer in QuickBooks");
    } finally {
      setIsCreatingCustomer(false);
    }
  }, [selectedCustomerName]);
  
  // Reset all test results
  const resetTestResults = useCallback(() => {
    setQboQueryResults(null);
    setQboQueryError(null);
    setFmHealthResults(null);
    setFmHealthError(null);
    setInvoiceResults(null);
    setInvoiceError(null);
  }, []);
  
  // Create a new invoice in QuickBooks
  const createInvoice = useCallback(async () => {
    if (!selectedCustomerId) {
      alert('Please select a customer first');
      return;
    }
    
    const qboCustomer = qboQueryResults?.QueryResponse?.Customer?.[0];
    const qboCustomerId = qboCustomer?.Id;
    if (!qboCustomerId) {
      alert('QuickBooks customer ID not found. Please query the customer first using the "Get Customer" button.');
      return;
    }

    const now = new Date();
    const year = String(now.getFullYear()).slice(-2); // get last 2 digits
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    setInvNo(`${qboCustomerId}${year}${month}01`)

    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1); // first day of next month
    const dueDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0); // last day of next month

    // Format as YYYY-MM-DD for QBO
    const formattedDueDate = dueDate.toISOString().split('T')[0];
    console.log('Due date:', formattedDueDate);
    
    if (recordsToInvoice.length === 0) {
      alert('All records are already invoiced');
      return;
    }
    
    setIsCreatingInvoice(true);
    
    try {
      // Get customer currency from QBO customer data
      const customerCurrency = qboCustomer?.CurrencyRef?.value || selectedCurrency;
      console.log('Using customer currency:', customerCurrency);
      let ItemRefValue;

      switch (customerCurrency) {
        case 'CAD':
          ItemRefValue = 3;
          break;
        case 'EUR':
          ItemRefValue = 8;
          break;
        case 'USD':
          ItemRefValue = 7;
          break;
        default:
          throw new Error(`Unsupported currency: ${customerCurrency}`);
      }

      let taxCodeRef;

      switch (customerCurrency) {
        case 'CAD':
          taxCodeRef = 4;
          break;
        case 'EUR':
          taxCodeRef = 3;
          break;
        case 'USD':
          taxCodeRef = 3;
          break;
        default:
          throw new Error(`Unsupported: ${customerCurrency}`);
      }
      
      const ItemRef = `Development Income:Development ${customerCurrency}`;
      
      // Group records by product_name and sum quantities and amounts
      const groupedRecords = {};
      
      recordsToInvoice.forEach(record => {
        const productName = record.product_name || 'Development';
        
        if (!groupedRecords[productName]) {
          groupedRecords[productName] = {
            productName,
            quantity: 0,
            totalAmount: 0,
            records: []
          };
        }
        
        groupedRecords[productName].quantity += (record.quantity || 1);
        groupedRecords[productName].totalAmount += (record.total_price || 0);
        groupedRecords[productName].records.push(record);
      });
      
      console.log('Grouped records:', groupedRecords);
      
      // Create invoice lines from grouped records
      const invoiceLines = Object.values(groupedRecords).map((group, index) => {
        // Extract product code from product name (e.g., "PG:MG" -> "MG")
        const productNameParts = group.productName.split(':');
        const productCode = productNameParts.length > 1 ? productNameParts[1].trim() : group.productName;
        
        // Ensure numeric values for quantity and unit price
        const quantity = Number(group.quantity);
        const unitPrice = Number(group.records[0].unit_price || 0);
        
        // Calculate amount as quantity * unitPrice
        const amount = quantity * unitPrice;
        
        console.log('Creating line item:', {
          productCode,
          quantity,
          unitPrice,
          amount
        });
        
        return {
          Amount: amount.toString(), // Convert to string as in the example
          Description: productCode, // Empty string as in the example
          DocNumber: invNo,
          DueDate: formattedDueDate,
          DetailType: "SalesItemLineDetail",
          LineNum: index + 1, // Line number starting from 1
          SalesItemLineDetail: {
            ItemRef: {
              value: ItemRefValue,
            },
            Qty: quantity,  
            TaxCodeRef: {
              value: taxCodeRef,
            },
            UnitPrice: unitPrice
          }
        };
      });
      
      // Get today's date and due date (30 days from now)
      const today = new Date();
      const dueDate = new Date(today);
      dueDate.setDate(today.getDate() + 30);
      
      // Format dates as YYYY-MM-DD
      const dueDateFormatted = dueDate.toISOString().split('T')[0];
      
      // Prepare invoice data for QBO
      const invoiceData = {
        CustomerRef: {
          name: selectedCustomerName,
          value: qboCustomerId
        },
        DeliveryInfo: {
          DeliveryType: "Email"
        },
        DueDate: dueDateFormatted,
        GlobalTaxCalculation: "TaxExcluded",
        Line: invoiceLines
      };
      
      console.log('Invoice data:', invoiceData);
      
      // Create invoice in QBO
      const invoiceResult = await createQBOInvoice(invoiceData);
      console.log('Create invoice response:', invoiceResult);
      
      if (invoiceResult.Fault) {
        const errorMessage = invoiceResult.Fault.Error?.[0]?.Detail || 'Unknown error';
        throw new Error(`Failed to create invoice in QuickBooks: ${errorMessage}`);
      }
      
      const qboInvoiceId = invoiceResult.Invoice.Id;
      console.log(`Invoice created in QBO with ID: ${qboInvoiceId}`);
      
      alert(`Invoice created successfully in QuickBooks Online with ID: ${qboInvoiceId}. Please click "Get Last Month Invoices" to refresh the invoice list.`);
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert(`Failed to create invoice: ${error.message}`);
    } finally {
      setIsCreatingInvoice(false);
    }
  }, [selectedCustomerId, qboQueryResults, recordsToInvoice, selectedCurrency]);
  
  // Update Supabase records with invoice IDs from existing invoices
  const updateSupabaseRecords = useCallback(async () => {
    if (!selectedCustomerId) {
      alert('Please select a customer first');
      return;
    }
    
    if (!invoiceResults?.QueryResponse?.Invoice) {
      alert('No invoices found. Please query invoices first using the "Get Last Month Invoices" button.');
      return;
    }
    
    if (recordsToInvoice.length === 0) {
      alert('All records are already invoiced');
      return;
    }
    
    setIsUpdatingSupabase(true);
    console.log('Starting updateSupabaseRecords function');
    console.log('Selected Customer ID:', selectedCustomerId);
    console.log('Records to invoice:', recordsToInvoice.length);
    console.log('Invoice results:', invoiceResults);
    
    try {
      const invoices = invoiceResults.QueryResponse.Invoice;
      console.log('Invoices found:', invoices ? invoices.length : 0);
      
      // Process each uninvoiced record
      const updatePromises = recordsToInvoice.map(async (record) => {
        console.log('Processing record:', record.id, 'Product name:', record.product_name);
        // Find matching line item in invoices
        let matchFound = false;
        
        for (const invoice of invoices) {
          console.log('Checking invoice:', invoice.Id, 'Line items:', invoice.Line ? invoice.Line.length : 0);
          if (!invoice.Line) continue;
          
          for (const line of invoice.Line) {
            console.log('Checking line item:', line.Id, 'Detail type:', line.DetailType, 'Description:', line.Description);
            // Skip if not a sales item line detail
            if (line.DetailType !== 'SalesItemLineDetail') {
              console.log('Skipping non-sales item line detail');
              continue;
            }
            
            // Extract product name from the record
            const recordProductName = record.product_name || '';
            const productNameParts = recordProductName.split(':');
            const recordProductCode = productNameParts.length > 1 ? productNameParts[1].trim() : '';
            console.log('Record product code:', recordProductCode);
            
            // Get the line description (which is the product code in QuickBooks)
            const lineProductCode = line.Description || '';
            console.log('Line product code:', lineProductCode);
            
            // Check if the product codes match
            if (recordProductCode && lineProductCode && recordProductCode === lineProductCode) {
              console.log('MATCH FOUND! Updating record in Supabase');
              // Found a match, update the record in Supabase
              const updateData = {
                inv_id: `${invoice.Id}:${line.Id}`
              };
              console.log('Update data:', updateData);
              
              try {
                console.log('Calling adminUpdate with:', 'customer_sales', updateData, { id: record.id });
                const updateResult = await adminUpdate('customer_sales', updateData, { id: record.id });
                console.log('Update result:', updateResult);
                
                if (!updateResult.success) {
                  console.error(`Failed to update inv_id for record ${record.id}: ${updateResult.error}`);
                  return false;
                }
                
                // If the record has a financial_id, update the corresponding billable hours record in FileMaker
                if (record.financial_id) {
                  console.log('Updating billable hours record in FileMaker:', record.financial_id);
                  
                  try {
                    const params = {
                      layout: 'dapiRecord',
                      action: 'update',
                      UUID: record.financial_id,
                      fieldData: { "f_billed": "1" }
                    };
                    
                    console.log('FileMaker update params:', params);
                    const fmResult = await fetchDataFromFileMaker(params, 0, true);
                    console.log('FileMaker update result:', fmResult);
                    
                    if (fmResult.error) {
                      console.error(`Failed to update FileMaker record ${record.financial_id}: ${fmResult.error}`);
                      return false;
                    }
                  } catch (fmError) {
                    console.error('Error updating FileMaker record:', fmError);
                    return false;
                  }
                }
              } catch (updateError) {
                console.error('Error during update operation:', updateError);
                return false;
              }
              
              matchFound = true;
              // Continue checking other line items for potential matches
            } else {
              console.log('No match found for this line item');
            }
          }
          
          // Continue checking other invoices for potential matches
        }
        
        console.log('Record processing complete. Match found:', matchFound);
        return matchFound;
      });
      
      console.log('All update promises created, waiting for resolution');
      const results = await Promise.all(updatePromises);
      console.log('Update results:', results);
      const successCount = results.filter(Boolean).length;
      console.log('Success count:', successCount);
      
      alert(`Updated ${successCount} of ${recordsToInvoice.length} records in Supabase.`);
      
      // Refresh customer records to show updated invoice status
      if (successCount > 0) {
        alert(`Updated ${successCount} records. Please select the customer again to refresh the records.`);
      }
    } catch (error) {
      console.error('Error updating Supabase records:', error);
      alert(`Failed to update Supabase records: ${error.message}`);
    } finally {
      setIsUpdatingSupabase(false);
    }
  }, [selectedCustomerId, invoiceResults, recordsToInvoice]);
  
  // Send email for an invoice
  const sendInvoiceEmail = useCallback(async () => {
    if (!selectedInvoiceId) {
      alert('Please select an invoice first');
      return;
    }
    
    setIsSendingEmail(true);
    
    try {
      // Find the selected invoice to get customer information
      const selectedInvoice = invoiceResults?.QueryResponse?.Invoice?.find(
        invoice => invoice.Id === selectedInvoiceId
      );
      
      if (!selectedInvoice) {
        throw new Error('Selected invoice not found in results');
      }
      
      // Get the customer ID from the invoice
      const customerId = selectedInvoice.CustomerRef?.value;
      
      if (!customerId) {
        throw new Error('Customer ID not found in the invoice');
      }
      
      // Get customer details to find email address
      const customerResult = await getQBOCustomer(customerId);
      console.log('Customer details:', customerResult);
      
      // Extract email address from customer
      const emailAddress = customerResult?.Customer?.PrimaryEmailAddr?.Address;
      
      if (!emailAddress) {
        throw new Error('Customer email address not found');
      }
      
      console.log(`Using customer email address: ${emailAddress}`);
      
      // Check if this is an OBSI customer (steven@oakbaysoftrends.net)
      if (emailAddress === 'steven@oakbaysoftrends.net') {
        console.log('OBSI customer detected, using special handling');
        
        // Get the financial IDs from the records to invoice
        const financialIds = recordsToInvoice
          .filter(record => record.financial_id)
          .map(record => record.financial_id);
        
        if (financialIds.length === 0) {
          throw new Error('No financial IDs found for OBSI customer');
        }
        
        console.log('Financial IDs:', financialIds);
        
        // Get the first financial ID to fetch the customer ID from FileMaker
        const firstFinancialId = financialIds[0];
        
        // Fetch the FileMaker record to get the customer ID
        const fmParams = {
          layout: 'dapiRecords',
          action: 'read',
          query: [{"__ID":firstFinancialId}]
        };
        
        const fmResult = await fetchDataFromFileMaker(fmParams, 0, true);
        console.log('FileMaker record result:', fmResult);
        if (!fmResult.response.data || fmResult.response.data.length === 0) {
          throw new Error('FileMaker record not found');
        }
        
        // Extract the customer ID from the FileMaker record
        const fmCustomerId = fmResult.response.data[0].fieldData._custID;
        
        if (!fmCustomerId) {
          throw new Error('FileMaker customer ID not found');
        }
        
        console.log('FileMaker customer ID:', fmCustomerId);
        
        // Get the invoice number from the selected invoice
        const invoiceNumber = selectedInvoice.DocNumber;
        
        // Create the parameter for the FileMaker script
        const scriptParam = JSON.stringify({
          ids: financialIds,
          custID: fmCustomerId,
          invNo: invoiceNumber
        });
        
        console.log('Calling FileMaker script with param:', scriptParam);
        
        // Call the FileMaker script
        if (typeof FileMaker !== 'undefined' && FileMaker.PerformScript) {
          FileMaker.PerformScript('bill obsi customer', scriptParam);
          // alert(`OBSI customer billing initiated for invoice #${invoiceNumber}`);
        } else {
          throw new Error('FileMaker object not available');
        }
      } else {
        // Regular customer - send email via QuickBooks
        const result = await sendQBOInvoiceEmail(selectedInvoiceId, emailAddress);
        console.log('Send invoice email response:', result);
        
        if (result.Fault) {
          const errorMessage = result.Fault.Error?.[0]?.Detail || 'Unknown error';
          throw new Error(`Failed to send invoice email: ${errorMessage}`);
        }
        
        alert(`Invoice email sent successfully to ${emailAddress} for invoice ID: ${selectedInvoiceId}`);
      }
    } catch (error) {
      console.error('Error sending invoice email:', error);
      alert(`Failed to send invoice email: ${error.message}`);
    } finally {
      setIsSendingEmail(false);
    }
  }, [selectedInvoiceId, invoiceResults, recordsToInvoice]);
  
  // Handle invoice selection
  const handleInvoiceSelect = useCallback((e) => {
    setSelectedInvoiceId(e.target.value);
  }, []);
  
  // Execute query to get invoices from the last month
  const executeLastMonthInvoicesQuery = useCallback(async () => {
    setIsInvoiceLoading(true);
    setInvoiceError(null);
    setInvoiceResults(null);
    
    try {
      // Calculate date range (today and 25 days ago)
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 25); // Set start date to 25 days ago
      
      // Format dates as ISO strings
      const startDateStr = startDate.toISOString().split('T')[0] + 'T00:00:00Z';
      const endDateStr = today.toISOString(); // Use current time as end date
      
      // Build the query
      let query = `Select * From Invoice WHERE MetaData.CreateTime >= '${startDateStr}' AND MetaData.CreateTime < '${endDateStr}'`;
      
      // Add customer filter if a customer is selected and QBO customer ID is available
      if (selectedCustomerId) {
        const qboCustomerId = qboQueryResults?.QueryResponse?.Customer?.[0]?.Id;
        
        if (qboCustomerId) {
          query += ` AND CustomerRef IN ('${qboCustomerId}')`;
        } else {
          console.log("QuickBooks customer ID not found. Executing query without customer filter.");
        }
      }
      
      console.log('Executing invoice query:', query);
      const result = await getQBOInvoiceByQuery(encodeURIComponent(query));
      console.log('Invoice query result:', result);
      setInvoiceResults(result);
    } catch (error) {
      console.error("Error executing invoice query:", error);
      setInvoiceError(error.message || "Failed to execute invoice query");
    } finally {
      setIsInvoiceLoading(false);
    }
  }, [selectedCustomerId, qboQueryResults]);
  
  // Execute FileMaker health check script
  const executeFmHealthCheck = useCallback(async () => {
    setIsFmHealthLoading(true);
    setFmHealthError(null);
    setFmHealthResults(null);
    
    try {
      const layout = 'dapiRecordDetails';
      const scriptName = 'health';
      const result = await executeScript(layout, scriptName);
      setFmHealthResults(result);
    } catch (error) {
      console.error("Error executing FileMaker health check:", error);
      setFmHealthError(error.message || "Failed to execute FileMaker health check");
    } finally {
      setIsFmHealthLoading(false);
    }
  }, []);
  
  // Handle customer selection
  const handleCustomerSelect = useCallback((e) => {
    const customerId = e.target.value;
    setSelectedCustomerId(customerId);
    
    if (!customerId) {
      setSelectedCustomerName('');
      setCustomerRecords([]);
      setRecordsToInvoice([]);
      return;
    }
    
    // Find customer in sales data
    const customerSales = window.state?.sales?.filter(sale => sale.customer_id === customerId) || [];
    
    if (customerSales.length > 0) {
      // Set customer name from first record
      setSelectedCustomerName(customerSales[0]?.customers?.business_name || 'Unknown Customer');
      
      // Set all customer records
      setCustomerRecords(customerSales);
      
      // Filter records that are not invoiced (mimicking CustomerSalesTable.jsx lines 207-215)
      const uninvoicedRecords = customerSales.filter(record => record.inv_id === null);
      setRecordsToInvoice(uninvoicedRecords);
    } else {
      setSelectedCustomerName('');
      setCustomerRecords([]);
      setRecordsToInvoice([]);
    }
  }, []);
  
  // Format currency for display
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  // If QBO testing is not enabled, don't render anything
  if (!isQboTestEnabled) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* QBO Test Panel Header */}
      <div className={`
        p-4 rounded-lg border
        ${darkMode ? 'bg-purple-900 bg-opacity-30 border-purple-800' : 'bg-purple-50 border-purple-200'}
      `}>
        <h3 className={`font-medium ${darkMode ? 'text-purple-200' : 'text-purple-800'}`}>
          QuickBooks Online Testing
        </h3>
      </div>
      
      {/* QBO Test Panel Content */}
      <div className={`
        p-4 rounded-lg border
        ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
      `}>
          <div className="flex justify-between items-center mb-4">
            <h3 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              QBO Customer Query Test
            </h3>
            
            {/* Reset Button - Only shown when there are results */}
            {(qboQueryResults || fmHealthResults || qboQueryError || fmHealthError) && (
              <button
                onClick={resetTestResults}
                className={`
                  text-xs px-2 py-1 rounded
                  ${darkMode
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}
                `}
              >
                Reset Results
              </button>
            )}
          </div>
          
          {/* Customer Selection */}
          <div className={`mb-4 p-4 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
            <h4 className={`font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Customer Selection
            </h4>
            
            <div className="mb-4">
              <label
                htmlFor="customerSelect"
                className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
              >
                Select Customer:
              </label>
              <div className="relative">
                <select
                  id="customerSelect"
                  value={selectedCustomerId}
                  onChange={handleCustomerSelect}
                  className={`
                    appearance-none w-full px-4 py-2.5 rounded-lg border shadow-sm
                    focus:outline-none focus:ring-2 focus:border-transparent
                    ${darkMode
                      ? 'bg-gray-800 border-gray-600 text-white focus:ring-blue-600'
                      : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'}
                    transition-all duration-200
                  `}
                >
                  <option value="">-- Select a Customer --</option>
                  {window.state?.sales?.reduce((options, sale) => {
                    // Only add each customer once (by ID)
                    if (!options.find(opt => opt.id === sale.customer_id)) {
                      options.push({
                        id: sale.customer_id,
                        name: sale.customers?.business_name || 'Unknown Customer'
                      });
                    }
                    return options;
                  }, [])
                  .sort((a, b) => a.name.localeCompare(b.name)) // Sort alphabetically
                  .map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                {/* Custom dropdown arrow */}
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3">
                  <svg
                    className={`h-5 w-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            </div>
            
            {selectedCustomerId && (
              <div className={`p-3 rounded-lg border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <h5 className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  Selected Customer: {selectedCustomerName}
                </h5>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Customer ID:</span>
                    <span className={`ml-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{selectedCustomerId}</span>
                  </div>
                  <div>
                    <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Total Records:</span>
                    <span className={`ml-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{customerRecords.length}</span>
                  </div>
                  <div>
                    <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Uninvoiced Records:</span>
                    <span className={`ml-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{recordsToInvoice.length}</span>
                  </div>
                  <div>
                    <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Total Value:</span>
                    <span className={`ml-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {formatCurrency(customerRecords.reduce((sum, record) => sum + (Number(record.total_price) || 0), 0))}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap gap-4 mb-4">
            {/* FileMaker Health Check Button */}
            <button
              onClick={executeFmHealthCheck}
              disabled={isFmHealthLoading}
              className={`
                px-4 py-2 rounded font-medium
                ${isFmHealthLoading
                  ? (darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500')
                  : (darkMode
                    ? 'bg-green-800 text-green-100 hover:bg-green-700'
                    : 'bg-green-600 text-white hover:bg-green-700')}
              `}
            >
              {isFmHealthLoading ? 'Loading...' : 'FileMaker Health Check'}
            </button>
            
            {/* QBO Customer Query Button */}
            <button
              onClick={executeCustomerQuery}
              disabled={isQboQueryLoading}
              className={`
                px-4 py-2 rounded font-medium
                ${isQboQueryLoading
                  ? (darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500')
                  : (darkMode
                    ? 'bg-blue-800 text-blue-100 hover:bg-blue-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700')}
              `}
            >
              {isQboQueryLoading ? 'Loading...' : 'Get Customer'}
            </button>
            
            {/* Last Month Invoices Query Button */}
            <button
              onClick={executeLastMonthInvoicesQuery}
              disabled={isInvoiceLoading}
              className={`
                px-4 py-2 rounded font-medium
                ${isInvoiceLoading
                  ? (darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500')
                  : (darkMode
                    ? 'bg-purple-800 text-purple-100 hover:bg-purple-700'
                    : 'bg-purple-600 text-white hover:bg-purple-700')}
              `}
            >
              {isInvoiceLoading ? 'Loading...' : 'Get Last Month Invoices'}
            </button>
            
            {/* Create Invoice Button - Only visible when there's a customer selected and records to invoice */}
            {selectedCustomerId && recordsToInvoice.length > 0 && qboQueryResults?.QueryResponse?.Customer?.[0]?.Id && (
              <button
                onClick={createInvoice}
                disabled={isCreatingInvoice}
                className={`
                  px-4 py-2 rounded font-medium
                  ${isCreatingInvoice
                    ? (darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500')
                    : (darkMode
                      ? 'bg-yellow-800 text-yellow-100 hover:bg-yellow-700'
                      : 'bg-yellow-600 text-white hover:bg-yellow-700')}
                `}
              >
                {isCreatingInvoice ? 'Creating...' : 'Create Invoice'}
              </button>
            )}
            
            {/* Update Supabase Button - Only visible when there are invoice results and records to invoice */}
            {invoiceResults?.QueryResponse?.Invoice && recordsToInvoice.length > 0 && (
              <button
                onClick={updateSupabaseRecords}
                disabled={isUpdatingSupabase}
                className={`
                  px-4 py-2 rounded font-medium
                  ${isUpdatingSupabase
                    ? (darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500')
                    : (darkMode
                      ? 'bg-indigo-800 text-indigo-100 hover:bg-indigo-700'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700')}
                `}
              >
                {isUpdatingSupabase ? 'Updating...' : 'Update Records'}
              </button>
            )}
          </div>
          
          {/* QBO Query Error */}
          {qboQueryError && (
            <CollapsiblePanel
              title="Error executing query"
              darkMode={darkMode}
              defaultExpanded={false}
              errorMessage={qboQueryError}
              panelType="error"
            >
              <p className="text-xs mt-1">{qboQueryError}</p>
            </CollapsiblePanel>
          )}
          
          {/* FileMaker Health Check Error */}
          {fmHealthError && (
            <CollapsiblePanel
              title="Error executing FileMaker health check"
              darkMode={darkMode}
              defaultExpanded={false}
              errorMessage={fmHealthError}
              panelType="error"
            >
              <p className="text-xs mt-1">{fmHealthError}</p>
            </CollapsiblePanel>
          )}
          
          {/* FileMaker Health Check Results */}
          {fmHealthResults && (
            <CollapsiblePanel
              title="FileMaker Health Check Results"
              darkMode={darkMode}
              defaultExpanded={false}
              panelType="success"
            >
              <div className={`
                p-3 rounded-lg border overflow-auto max-h-96
                ${darkMode ? 'bg-gray-900 border-gray-800 text-gray-300' : 'bg-white border-gray-300 text-gray-800'}
              `} style={{ fontFamily: 'monospace' }}>
                <pre>{JSON.stringify(fmHealthResults, null, 2)}</pre>
              </div>
            </CollapsiblePanel>
          )}
          
          {/* QBO Query Results */}
          {qboQueryResults && (
            <CollapsiblePanel
              title={
                qboQueryResults?.QueryResponse?.Customer?.[0]?.Id
                  ? `Query Results - Customer ID: ${qboQueryResults.QueryResponse.Customer[0].Id}`
                  : "Query Results - Customer not found"
              }
              darkMode={darkMode}
              defaultExpanded={false}
            >
              <div className={`
                p-3 rounded-lg border overflow-auto max-h-96
                ${darkMode ? 'bg-gray-900 border-gray-800 text-gray-300' : 'bg-white border-gray-300 text-gray-800'}
              `} style={{ fontFamily: 'monospace' }}>
                {Object.keys(qboQueryResults).length === 0 ||
                 (qboQueryResults.QueryResponse &&
                  (!qboQueryResults.QueryResponse.Customer || qboQueryResults.QueryResponse.Customer.length === 0)) ? (
                  <div className="p-4 text-center">
                    <div className={`mb-4 ${darkMode ? 'text-red-300' : 'text-red-600'}`}>
                      Customer not found in QuickBooks Online
                    </div>
                    {selectedCustomerName && (
                      <div>
                        <div className="mb-4">
                          <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            Customer Currency:
                          </label>
                          <div className="flex space-x-4 justify-center">
                            {['CAD', 'USD', 'EUR', 'GBP', 'AUD'].map(currency => (
                              <label key={currency} className="inline-flex items-center">
                                <input
                                  type="radio"
                                  name="currency"
                                  value={currency}
                                  checked={selectedCurrency === currency}
                                  onChange={e => setSelectedCurrency(e.target.value)}
                                  className={`form-radio h-4 w-4 ${
                                    darkMode ? 'text-blue-600' : 'text-blue-500'
                                  }`}
                                />
                                <span className={`ml-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                  {currency}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={createCustomerInQBO}
                          disabled={isCreatingCustomer}
                          className={`
                            px-4 py-2 rounded font-medium
                            ${isCreatingCustomer
                              ? (darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500')
                              : (darkMode
                                ? 'bg-green-800 text-green-100 hover:bg-green-700'
                                : 'bg-green-600 text-white hover:bg-green-700')}
                          `}
                        >
                          {isCreatingCustomer
                            ? 'Creating...'
                            : `Create "${selectedCustomerName}" in QuickBooks (${selectedCurrency})`}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <pre>{JSON.stringify(qboQueryResults, null, 2)}</pre>
                )}
              </div>
            </CollapsiblePanel>
          )}
          
          {/* Customer Records */}
          {selectedCustomerId && customerRecords.length > 0 && (
            <CollapsiblePanel
              title={`Customer Records (${customerRecords.length})`}
              darkMode={darkMode}
              defaultExpanded={false}
            >
              <div className={`
                p-3 rounded-lg border overflow-auto max-h-96
                ${darkMode ? 'bg-gray-900 border-gray-800 text-gray-300' : 'bg-white border-gray-300 text-gray-800'}
              `} style={{ fontFamily: 'monospace' }}>
                <pre>{JSON.stringify(customerRecords, null, 2)}</pre>
              </div>
            </CollapsiblePanel>
          )}
          
          {/* Records to Invoice */}
          {selectedCustomerId && recordsToInvoice.length > 0 && (
            <CollapsiblePanel
              title={`Records to Invoice (${recordsToInvoice.length})`}
              darkMode={darkMode}
              defaultExpanded={false}
            >
              <div className={`
                p-3 rounded-lg border overflow-auto max-h-96
                ${darkMode ? 'bg-gray-900 border-gray-800 text-gray-300' : 'bg-white border-gray-300 text-gray-800'}
              `} style={{ fontFamily: 'monospace' }}>
                <pre>{JSON.stringify(recordsToInvoice, null, 2)}</pre>
              </div>
            </CollapsiblePanel>
          )}
          
          {/* Invoice Query Error */}
          {invoiceError && (
            <CollapsiblePanel
              title="Error executing invoice query"
              darkMode={darkMode}
              defaultExpanded={false}
              errorMessage={invoiceError}
              panelType="error"
            >
              <p className="text-xs mt-1">{invoiceError}</p>
            </CollapsiblePanel>
          )}
          
          {/* Invoice Query Results */}
          {invoiceResults && (
            <CollapsiblePanel
            title={
              invoiceResults?.Fault?.Error?.Message
                ? `Last Month Invoices - Error: ${invoiceResults.Fault.Error.Message}`
                : invoiceResults?.QueryResponse?.Invoice?.length > 0
                  ? `Last Month Invoices - Found: ${invoiceResults.QueryResponse.Invoice.length}`
                  : "Last Month Invoices - None found"
            }
            
              darkMode={darkMode}
              defaultExpanded={false}
            >
              <div className="mb-4">
                {invoiceResults?.QueryResponse?.Invoice && invoiceResults.QueryResponse.Invoice.length > 0 && (
                  <div className="mb-4">
                    <label
                      htmlFor="invoiceSelect"
                      className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
                    >
                      Select Invoice to Email:
                    </label>
                    <div className="flex space-x-2">
                      <div className="relative flex-grow">
                        <select
                          id="invoiceSelect"
                          value={selectedInvoiceId}
                          onChange={handleInvoiceSelect}
                          className={`
                            appearance-none w-full px-4 py-2 rounded-lg border shadow-sm
                            focus:outline-none focus:ring-2 focus:border-transparent
                            ${darkMode
                              ? 'bg-gray-800 border-gray-600 text-white focus:ring-blue-600'
                              : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'}
                            transition-all duration-200
                          `}
                        >
                          <option value="">-- Select an Invoice --</option>
                          {invoiceResults.QueryResponse.Invoice.map(invoice => (
                            <option key={invoice.Id} value={invoice.Id}>
                              Invoice #{invoice.DocNumber} - {invoice.CustomerRef.name} - {formatCurrency(invoice.TotalAmt)}
                            </option>
                          ))}
                        </select>
                        {/* Custom dropdown arrow */}
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3">
                          <svg
                            className={`h-5 w-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      </div>
                      <button
                        onClick={sendInvoiceEmail}
                        disabled={!selectedInvoiceId || isSendingEmail}
                        className={`
                          px-4 py-2 rounded font-medium whitespace-nowrap
                          ${!selectedInvoiceId || isSendingEmail
                            ? (darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500')
                            : (darkMode
                              ? 'bg-teal-800 text-teal-100 hover:bg-teal-700'
                              : 'bg-teal-600 text-white hover:bg-teal-700')}
                        `}
                      >
                        {isSendingEmail ? 'Sending...' : 'Send Email'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className={`
                p-3 rounded-lg border overflow-auto max-h-96
                ${darkMode ? 'bg-gray-900 border-gray-800 text-gray-300' : 'bg-white border-gray-300 text-gray-800'}
              `} style={{ fontFamily: 'monospace' }}>
                <pre>{JSON.stringify(invoiceResults, null, 2)}</pre>
              </div>
            </CollapsiblePanel>
          )}
      </div>
    </div>
  );
}

QboTestPanel.propTypes = {
  darkMode: PropTypes.bool
};

export default React.memo(QboTestPanel);