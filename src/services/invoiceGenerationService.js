/**
 * Advanced Invoice Generation Service
 *
 * This service generates QuickBooks Online invoice payloads with advanced business logic
 * including proper document numbering, tax codes, due dates, and email delivery.
 *
 * Business Rules:
 * - DocNumber: qboID+YY+MM+NNN (where NNN is invoice count for customer this month, starting at 001)
 * - Tax Codes: 3 for non-CAD currencies, 4 for CAD currencies
 * - Due Date: Net 30 (EoM next month) - 30 days from invoice date, then end of that month
 * - Email delivery with BillEmail and DeliveryInfo
 *
 * @author Clarity Business Solutions
 * @version 2.0.0
 */

import { listQBOInvoices } from '../api/quickbooksApi.js';

/**
 * Generates a complete QuickBooks invoice payload based on sales records
 * @param {Array} salesRecords - Array of sales records to include in the invoice
 * @param {Object} qboCustomer - QuickBooks customer object
 * @param {Object} options - Additional options for invoice generation
 * @returns {Object} Complete QuickBooks invoice payload
 */
export const generateInvoicePayload = async (salesRecords, qboCustomer, options = {}) => {
  try {
    if (!salesRecords || salesRecords.length === 0) {
      throw new Error('Sales records are required for invoice generation');
    }

    if (!qboCustomer || !qboCustomer.Id) {
      throw new Error('Valid QuickBooks customer is required');
    }

    // Extract customer currency (default to CAD if not specified)
    const customerCurrency = qboCustomer.CurrencyRef?.value || 'CAD';
    const customerCurrencyName = getCurrencyName(customerCurrency);

    // Generate document number
    const docNumber = await generateDocumentNumber(qboCustomer.Id, salesRecords);

    // Calculate due date (EOM of latest item date + 1 month)
    const dueDate = calculateDueDate(salesRecords);

    // Determine tax code based on currency
    const taxCodeRef = getTaxCodeForCurrency(customerCurrency);

    // Get appropriate item reference based on currency
    const itemRef = getItemRefForCurrency(customerCurrency);

    // Group sales records by description and unit price for line items
    const lineItems = generateLineItems(salesRecords, itemRef, taxCodeRef);

    // Build the complete invoice payload
    const invoicePayload = {
      BillEmail: {
        Address: qboCustomer.PrimaryEmailAddr?.Address || options.defaultEmail || ''
      },
      CurrencyRef: {
        name: customerCurrencyName,
        value: customerCurrency
      },
      CustomerRef: {
        name: qboCustomer.DisplayName || qboCustomer.Name,
        value: qboCustomer.Id
      },
      DeliveryInfo: {
        DeliveryType: 'Email'
      },
      DocNumber: docNumber,
      DueDate: dueDate,
      GlobalTaxCalculation: 'TaxExcluded',
      Line: lineItems
    };

    console.log('Generated invoice payload:', JSON.stringify(invoicePayload, null, 2));
    return invoicePayload;

  } catch (error) {
    console.error('Error generating invoice payload:', error);
    throw error;
  }
};

/**
 * Generates document number in format: qboID+YY+MM+NNN
 * @param {string} qboCustomerId - QuickBooks customer ID
 * @param {Array} salesRecords - Sales records to determine the month
 * @returns {Promise<string>} Generated document number
 */
const generateDocumentNumber = async (qboCustomerId, salesRecords) => {
  try {
    // Get the latest date from sales records to determine the month
    const latestDate = getLatestDate(salesRecords);
    const year = latestDate.getFullYear().toString().slice(-2); // Last 2 digits of year
    const month = (latestDate.getMonth() + 1).toString().padStart(2, '0'); // Month with leading zero

    // Query existing invoices for this customer and month to get the next sequence number
    const invoiceNumber = await getNextInvoiceSequence(qboCustomerId, latestDate);

    const docNumber = `${qboCustomerId}${year}${month}${invoiceNumber}`;
    console.log(`Generated document number: ${docNumber} for customer ${qboCustomerId}, date ${latestDate.toISOString()}`);
    
    return docNumber;
  } catch (error) {
    console.error('Error generating document number:', error);
    throw error;
  }
};

/**
 * Gets the next invoice sequence number for a customer in a specific month
 * @param {string} qboCustomerId - QuickBooks customer ID
 * @param {Date} invoiceDate - Date to determine the month
 * @returns {Promise<string>} Next sequence number (e.g., "001", "002", etc.)
 */
const getNextInvoiceSequence = async (qboCustomerId, invoiceDate) => {
  try {
    // Calculate the first and last day of the month
    const year = invoiceDate.getFullYear();
    const month = invoiceDate.getMonth(); // 0-based month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Format dates for QuickBooks query (YYYY-MM-DD)
    const startDate = firstDay.toISOString().split('T')[0];
    const endDate = lastDay.toISOString().split('T')[0];

    console.log(`Fetching existing invoices for customer ${qboCustomerId} between ${startDate} and ${endDate}`);

    // Use the new invoice listing endpoint with customer filtering
    const invoiceResult = await listQBOInvoices({
      customer_id: qboCustomerId,
      max_results: 100 // Get up to 100 invoices to ensure we capture all for the month
    });
    
    // Filter invoices by date range (since the API doesn't support date filtering directly)
    let existingInvoiceCount = 0;
    if (invoiceResult && invoiceResult.invoices) {
      const filteredInvoices = invoiceResult.invoices.filter(invoice => {
        const invoiceDate = invoice.TxnDate;
        return invoiceDate >= startDate && invoiceDate <= endDate;
      });
      existingInvoiceCount = filteredInvoices.length;
      
      console.log(`Found ${invoiceResult.invoices.length} total invoices for customer, ${existingInvoiceCount} in date range ${startDate} to ${endDate}`);
    }

    // Generate next sequence number (existing count + 1, padded to 3 digits)
    const nextSequence = (existingInvoiceCount + 1).toString().padStart(3, '0');
    
    console.log(`Found ${existingInvoiceCount} existing invoices for customer ${qboCustomerId} in ${year}-${month + 1}. Next sequence: ${nextSequence}`);
    
    return nextSequence;
  } catch (error) {
    console.error('Error getting next invoice sequence:', error);
    // Fallback to 001 if query fails
    console.warn('Falling back to sequence 001 due to query error');
    return '001';
  }
};

/**
 * Calculates due date as Net 30 (EoM next month) - 30 days from today, then end of that month
 * @param {Array} salesRecords - Sales records to analyze (for logging purposes)
 * @returns {string} Due date in YYYY-MM-DD format
 */
const calculateDueDate = (salesRecords) => {
  try {
    // Net 30 means 30 days from today (invoice date)
    const today = new Date();
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    // Get the end of the month for the date that is 30 days from now
    const dueDate = new Date(thirtyDaysFromNow.getFullYear(), thirtyDaysFromNow.getMonth() + 1, 0);
    
    // Format as YYYY-MM-DD
    const formattedDueDate = dueDate.toISOString().split('T')[0];
    
    const latestDate = getLatestDate(salesRecords);
    console.log(`Calculated Net 30 due date: ${formattedDueDate} (30 days from today: ${thirtyDaysFromNow.toISOString().split('T')[0]}, latest item date: ${latestDate.toISOString().split('T')[0]})`);
    return formattedDueDate;
  } catch (error) {
    console.error('Error calculating due date:', error);
    throw error;
  }
};

/**
 * Gets the latest date from sales records
 * @param {Array} salesRecords - Sales records to analyze
 * @returns {Date} Latest date found
 */
const getLatestDate = (salesRecords) => {
  const dates = salesRecords.map(record => new Date(record.date));
  return new Date(Math.max(...dates));
};

/**
 * Determines tax code based on currency
 * @param {string} currency - Currency code (CAD, USD, EUR, etc.)
 * @returns {number} Tax code reference
 */
const getTaxCodeForCurrency = (currency) => {
  // Business rule: taxCodeRef 3 for non-CAD, taxCodeRef 4 for CAD
  return currency === 'CAD' ? 4 : 3;
};

/**
 * Gets the appropriate item reference based on currency
 * @param {string} currency - Currency code
 * @returns {Object} Item reference object
 */
const getItemRefForCurrency = (currency) => {
  // Map currencies to their respective development income items
  const itemMapping = {
    CAD: { name: 'Development CAD', value: '3' },
    USD: { name: 'Development USD', value: '7' },
    EUR: { name: 'Development EUR', value: '8' }
  };

  return itemMapping[currency] || itemMapping.CAD; // Default to CAD if currency not found
};

/**
 * Gets the full currency name for display
 * @param {string} currencyCode - Currency code (CAD, USD, EUR)
 * @returns {string} Full currency name
 */
const getCurrencyName = (currencyCode) => {
  const currencyNames = {
    CAD: 'Canadian Dollar',
    USD: 'United States Dollar',
    EUR: 'Euro'
  };

  return currencyNames[currencyCode] || currencyCode;
};

/**
 * Generates line items from sales records, grouping by description and unit price
 * @param {Array} salesRecords - Sales records to process
 * @param {Object} itemRef - Item reference for all line items
 * @param {number} taxCodeRef - Tax code reference
 * @returns {Array} Array of line items for the invoice
 */
const generateLineItems = (salesRecords, itemRef, taxCodeRef) => {
  try {
    // Group records by description and unit price
    const groupedRecords = new Map();
    
    salesRecords.forEach(record => {
      const description = record.product_name || 'Development';
      const unitPrice = Number(record.unit_price) || 0;
      const quantity = Number(record.quantity) || 0;
      const totalPrice = Number(record.total_price) || 0;
      
      // Create a unique key combining description and unit price
      const key = `${description}|${unitPrice}`;
      
      if (groupedRecords.has(key)) {
        const existing = groupedRecords.get(key);
        existing.totalQuantity += quantity;
        existing.totalAmount += totalPrice;
      } else {
        groupedRecords.set(key, {
          description,
          unitPrice,
          totalQuantity: quantity,
          totalAmount: totalPrice
        });
      }
    });

    // Convert grouped records to line items
    const lineItems = Array.from(groupedRecords.values()).map((group, index) => {
      // Calculate quantity as totalAmount / unitPrice if unitPrice > 0, otherwise use totalQuantity
      const calculatedQuantity = group.unitPrice > 0 
        ? group.totalAmount / group.unitPrice 
        : group.totalQuantity;

      return {
        Amount: Math.round(group.totalAmount * 100) / 100, // Round to 2 decimal places
        Description: group.description,
        DetailType: 'SalesItemLineDetail',
        LineNum: index + 1,
        SalesItemLineDetail: {
          ItemRef: itemRef,
          Qty: Math.round(calculatedQuantity * 100) / 100, // Round to 2 decimal places
          TaxCodeRef: {
            value: taxCodeRef
          },
          UnitPrice: Math.round(group.unitPrice * 100) / 100 // Round to 2 decimal places
        }
      };
    });

    console.log(`Generated ${lineItems.length} line items from ${salesRecords.length} sales records`);
    return lineItems;
  } catch (error) {
    console.error('Error generating line items:', error);
    throw error;
  }
};

/**
 * Validates that all required data is present for invoice generation
 * @param {Array} salesRecords - Sales records to validate
 * @param {Object} qboCustomer - QuickBooks customer to validate
 * @returns {Object} Validation result with isValid flag and errors array
 */
export const validateInvoiceData = (salesRecords, qboCustomer) => {
  const errors = [];

  // Validate sales records
  if (!salesRecords || !Array.isArray(salesRecords) || salesRecords.length === 0) {
    errors.push('Sales records are required and must be a non-empty array');
  } else {
    // Validate each sales record
    salesRecords.forEach((record, index) => {
      if (!record.date) {
        errors.push(`Sales record ${index + 1} is missing date`);
      }
      if (record.unit_price === undefined || record.unit_price === null) {
        errors.push(`Sales record ${index + 1} is missing unit_price`);
      }
      if (record.quantity === undefined || record.quantity === null) {
        errors.push(`Sales record ${index + 1} is missing quantity`);
      }
      if (record.total_price === undefined || record.total_price === null) {
        errors.push(`Sales record ${index + 1} is missing total_price`);
      }
    });
  }

  // Validate QuickBooks customer
  if (!qboCustomer) {
    errors.push('QuickBooks customer is required');
  } else {
    if (!qboCustomer.Id) {
      errors.push('QuickBooks customer must have an Id');
    }
    if (!qboCustomer.DisplayName && !qboCustomer.Name) {
      errors.push('QuickBooks customer must have a DisplayName or Name');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Formats invoice data for logging and debugging
 * @param {Object} invoicePayload - The generated invoice payload
 * @returns {string} Formatted string representation
 */
export const formatInvoiceForLogging = (invoicePayload) => {
  try {
    const summary = {
      docNumber: invoicePayload.DocNumber,
      customer: invoicePayload.CustomerRef?.name,
      currency: invoicePayload.CurrencyRef?.value,
      dueDate: invoicePayload.DueDate,
      lineCount: invoicePayload.Line?.length || 0,
      totalAmount: invoicePayload.Line?.reduce((sum, line) => sum + (line.Amount || 0), 0) || 0,
      email: invoicePayload.BillEmail?.Address
    };

    return `Invoice Summary: ${JSON.stringify(summary, null, 2)}`;
  } catch (error) {
    console.error('Error formatting invoice for logging:', error);
    return 'Error formatting invoice data';
  }
};

export default {
  generateInvoicePayload,
  validateInvoiceData,
  formatInvoiceForLogging
};