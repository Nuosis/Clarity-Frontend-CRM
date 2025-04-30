/**
 * Sales data processing and business logic
 */
import { adminQuery, adminInsert, adminUpdate, adminRemove } from './supabaseService';

/**
 * Fetches all sales for a specific organization by customer
 * @param {string} organizationId - The organization ID to fetch sales for
 * @returns {Promise<Object>} - Object containing success status and sales data
 */
export async function fetchSalesByOrganization(organizationId) {
  if (!organizationId) {
    console.error('Cannot fetch sales: Organization ID is missing');
    return {
      success: false,
      error: 'Organization ID is required',
      data: []
    };
  }

  try {
    console.log(`Fetching sales for organization: ${organizationId}`);
    
    // Use adminQuery to bypass RLS restrictions
    const result = await adminQuery('customer_sales', {
      select: '*',
      eq: {
        column: 'organization_id',
        value: organizationId
      },
      order: {
        column: 'date',
        ascending: false
      }
    });

    // Process JSON data immediately after receiving the response
    const processedResult = {
      ...result,
      data: result.success && result.data ? processJsonData(result.data) : []
    };

    if (!processedResult.success) {
      throw new Error(processedResult.error || 'Failed to fetch sales');
    }

    // Handle null or undefined data gracefully
    if (!processedResult.data || !Array.isArray(processedResult.data) || processedResult.data.length === 0) {
      console.log(`No sales found for organization: ${organizationId}`);
      return {
        success: true,
        data: []
      };
    }

    // Ensure amount is always a number for each sale
    const processedSales = processedResult.data.map(sale => {
      if (!sale) return null;
      
      // Convert amount to number if it's a string
      if (sale.amount !== undefined && sale.amount !== null) {
        sale.amount = typeof sale.amount === 'string'
          ? parseFloat(sale.amount)
          : sale.amount;
      }
      
      return sale;
    }).filter(sale => sale !== null); // Filter out null sales

    return {
      success: true,
      data: processedSales
    };
  } catch (error) {
    console.error('Error fetching sales:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
}

/**
 * Fetches sales for a specific customer
 * @param {string} customerId - The customer ID to fetch sales for
 * @returns {Promise<Object>} - Object containing success status and sales data
 */
export async function fetchSalesByCustomer(customerId) {
  if (!customerId) {
    console.error('Cannot fetch sales: Customer ID is missing');
    return {
      success: false,
      error: 'Customer ID is required',
      data: []
    };
  }

  try {
    console.log(`Fetching sales for customer: ${customerId}`);
    
    // Use adminQuery to bypass RLS restrictions
    const result = await adminQuery('customer_sales', {
      select: '*',
      eq: {
        column: 'customer_id',
        value: customerId
      },
      order: {
        column: 'date',
        ascending: false
      }
    });

    // Process JSON data immediately after receiving the response
    const processedResult = {
      ...result,
      data: result.success && result.data ? processJsonData(result.data) : []
    };

    if (!processedResult.success) {
      throw new Error(processedResult.error || 'Failed to fetch sales');
    }

    // Handle null or undefined data gracefully
    if (!processedResult.data || !Array.isArray(processedResult.data) || processedResult.data.length === 0) {
      console.log(`No sales found for customer: ${customerId}`);
      return {
        success: true,
        data: []
      };
    }

    // Ensure amount is always a number for each sale
    const processedSales = processedResult.data.map(sale => {
      if (!sale) return null;
      
      // Convert amount to number if it's a string
      if (sale.amount !== undefined && sale.amount !== null) {
        sale.amount = typeof sale.amount === 'string'
          ? parseFloat(sale.amount)
          : sale.amount;
      }
      
      return sale;
    }).filter(sale => sale !== null); // Filter out null sales

    return {
      success: true,
      data: processedSales
    };
  } catch (error) {
    console.error('Error fetching sales:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
}

/**
 * Creates a new sale
 * @param {Object} saleData - The sale data to create
 * @returns {Promise<Object>} - Object containing success status and created sale data
 */
export async function createSale(saleData) {
  try {
    if (!saleData.organization_id) {
      throw new Error('Organization ID is required');
    }

    if (!saleData.customer_id) {
      throw new Error('Customer ID is required');
    }

    const validation = validateSaleData(saleData);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(', ')
      };
    }

    const result = await adminInsert('customer_sales', saleData);
    
    // Process JSON data immediately after receiving the response
    const processedResult = {
      ...result,
      data: result.success && result.data ? processJsonData(result.data) : null
    };
    
    if (!processedResult.success) {
      throw new Error(processedResult.error || 'Failed to create sale');
    }

    // Return the processed data
    return {
      success: true,
      data: Array.isArray(processedResult.data) && processedResult.data.length > 0
        ? processedResult.data[0]
        : null
    };
  } catch (error) {
    console.error('Error creating sale:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Updates an existing sale
 * @param {string} saleId - The ID of the sale to update
 * @param {Object} saleData - The updated sale data
 * @returns {Promise<Object>} - Object containing success status and updated sale data
 */
export async function updateSale(saleId, saleData) {
  try {
    if (!saleId) {
      throw new Error('Sale ID is required');
    }

    const validation = validateSaleData(saleData);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(', ')
      };
    }

    const result = await adminUpdate('customer_sales', saleData, { id: saleId });
    
    // Process JSON data immediately after receiving the response
    const processedResult = {
      ...result,
      data: result.success && result.data ? processJsonData(result.data) : null
    };
    
    if (!processedResult.success) {
      throw new Error(processedResult.error || 'Failed to update sale');
    }

    // Return the processed data
    return {
      success: true,
      data: Array.isArray(processedResult.data) && processedResult.data.length > 0
        ? processedResult.data[0]
        : null
    };
  } catch (error) {
    console.error('Error updating sale:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Deletes a sale
 * @param {string} saleId - The ID of the sale to delete
 * @returns {Promise<Object>} - Object containing success status
 */
export async function deleteSale(saleId) {
  try {
    if (!saleId) {
      throw new Error('Sale ID is required');
    }

    const result = await adminRemove('customer_sales', { id: saleId });
    
    // Process JSON data immediately after receiving the response
    const processedResult = {
      ...result,
      data: result.success && result.data ? processJsonData(result.data) : null
    };
    
    if (!processedResult.success) {
      throw new Error(processedResult.error || 'Failed to delete sale');
    }

    // Return the processed data
    return {
      success: true,
      data: processedResult.data
    };
  } catch (error) {
    console.error('Error deleting sale:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Validates sale data before creation/update
 * @param {Object} data - Sale data to validate
 * @returns {Object} - Validation result { isValid, errors }
 */
export function validateSaleData(data) {
  const errors = [];

  //console.log('Validating sale data:', data);

  if (!data.product_id) {
    errors.push('Product ID is required');
  }

  if (!data.customer_id) {
    errors.push('Customer ID is required');
  }

  if (data.total_price === undefined || data.total_price === null || isNaN(parseFloat(data.total_price)) || parseFloat(data.total_price) <= 0) {
    errors.push('Sale amount must be a positive number');
  }

  if (!data.date) {
    errors.push('Sale date is required');
  }

  if (!data.organization_id) {
    errors.push('Organization ID is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Formats sale data for display
 * @param {Object} sale - Sale record
 * @returns {Object} - Formatted sale data
 */
export function formatSaleForDisplay(sale) {
  // Process any stringified JSON in the sale data first
  const processedSale = processJsonData(sale);
  
  return {
    id: processedSale.id,
    product_id: processedSale.product_id,
    customer_id: processedSale.customer_id,
    amount: typeof processedSale.total_price === 'number'
      ? processedSale.total_price.toFixed(2)
      : parseFloat(processedSale.total_price).toFixed(2),
    date: new Date(processedSale.date).toLocaleDateString(),
    created: new Date(processedSale.created_at).toLocaleDateString(),
    updated: new Date(processedSale.updated_at).toLocaleDateString()
  };
}

/**
 * Helper function to parse stringified JSON if needed
 * @param {any} value - The value to parse
 * @returns {any} - Parsed value or original value if parsing fails
 */
function parseStringifiedJson(value) {
  if (typeof value !== 'string') {
    return value;
  }
  
  try {
    // Check if the string looks like it might be JSON
    // Trim whitespace and check if it starts with { or [ and ends with } or ]
    const trimmed = value.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      return JSON.parse(trimmed);
    }
    return value;
  } catch (e) {
    // If parsing fails, return the original value
    return value;
  }
}

/**
 * Recursively processes an object or array to parse any stringified JSON values
 * @param {any} data - The data to process
 * @returns {any} - Processed data with parsed JSON values
 */
function processJsonData(data) {
  // Handle null or undefined
  if (data == null) {
    return Array.isArray(data) ? [] : data;
  }
  
  // Parse the value if it's a string that might be JSON
  if (typeof data === 'string') {
    return parseStringifiedJson(data);
  }
  
  // Handle arrays - process each item and filter out nulls
  if (Array.isArray(data)) {
    return data
      .map(item => item != null ? processJsonData(item) : null)
      .filter(item => item != null);
  }
  
  // Handle objects - process each property
  if (typeof data === 'object') {
    const result = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = processJsonData(data[key]);
        // Only add non-null values to the result
        if (value != null) {
          result[key] = value;
        }
      }
    }
    return result;
  }
  
  // Return primitives as is
  return data;
}

/**
 * Calculates sales statistics
 * @param {Array} sales - Array of sale records
 * @returns {Object} - Sales statistics
 */
export function calculateSalesStats(sales) {
  // Process any stringified JSON in the sales array first
  const processedSales = Array.isArray(sales) ? processJsonData(sales) : [];
  
  if (!processedSales || processedSales.length === 0) {
    return {
      total: 0,
      totalAmount: 0,
      averageAmount: 0,
      minAmount: 0,
      maxAmount: 0
    };
  }

  const amounts = processedSales.map(sale =>
    typeof sale.amount === 'number' ? sale.amount : parseFloat(sale.amount)
  );
  
  const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0);
  
  return {
    total: sales.length,
    totalAmount: totalAmount.toFixed(2),
    averageAmount: (totalAmount / amounts.length).toFixed(2),
    minAmount: Math.min(...amounts).toFixed(2),
    maxAmount: Math.max(...amounts).toFixed(2)
  };
}

/**
 * Loads sales for an organization and updates the app state
 * @param {string} organizationId - The organization ID to load sales for
 * @param {Function} setSales - Function to update the sales state
 * @param {Function} setLoading - Function to update the loading state
 * @param {Function} setError - Function to update the error state
 * @returns {Promise<Object>} - Object containing success status and sales data
 */
export async function loadOrganizationSales(organizationId, setSales, setLoading, setError) {
  // Handle null or undefined organizationId gracefully
  if (!organizationId) {
    console.log('Cannot load sales: Organization ID is missing or null');
    if (setSales) setSales([]);
    if (setError) setError('Organization ID is required');
    if (setLoading) setLoading(false);
    return {
      success: false,
      error: 'Organization ID is required',
      data: []
    };
  }

  try {
    if (setLoading) setLoading(true);
    
    const result = await fetchSalesByOrganization(organizationId);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to load sales');
    }
    
    // The data is already processed by fetchSalesByOrganization
    const salesData = result.data || [];
    
    // Update the app state with the sales if setSales function is provided
    if (setSales) setSales(salesData);
    if (setLoading) setLoading(false);
    
    // Return the already processed data
    return {
      success: true,
      data: salesData
    };
  } catch (error) {
    console.error('Error loading sales:', error);
    if (setError) setError(error.message);
    if (setLoading) setLoading(false);
    
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
}

/**
 * Creates customer_sales records from unbilled financial records
 * @returns {Promise<Object>} - Object containing success status and created sales data
 */
export async function createSalesFromUnbilledFinancials(organizationId) {
  try {
    // Import required functions
    const { fetchUnpaidRecords } = await import('../api/financialRecords');
    const { processFinancialData } = await import('./financialService');

    // Fetch all unbilled financial records using the "unpaid" timeframe
    // This approach is consistent with how useFinancialRecords successfully fetches unbilled records
    const result = await fetchUnpaidRecords();

    // console.log('Fetched unbilled financial records:', result.messages[0].message);
    
    if (result.messages[0].message !=='OK') {
      throw new Error(result.error || 'Failed to fetch unbilled financial records');
    }
    
    // Process the financial data
    const financialRecords = processFinancialData(result);

    // console.log(`Fetched ${financialRecords.length} unbilled financial records`);
    
    if (!financialRecords || financialRecords.length === 0) {
      console.log('No unbilled financial records found');
      return {
        success: true,
        data: [],
        message: 'No unbilled financial records found'
      };
    }
    
    console.log(`Processing ${financialRecords.length} unbilled financial records`);
    
    // Create customer_sales records for each financial record
    const createdSales = [];
    const errors = [];
    
    for (const record of financialRecords) {
      try {
        // Skip records that are already billed
        if (record.billed) {
          continue;
        }
        
        // First, check if a record already exists for this financial_id
        const existingRecordResult = await adminQuery('customer_sales', {
          select: '*',
          eq: {
            column: 'financial_id',
            value: record.id
          }
        });
        
        // If a record already exists, silently skip
        if (existingRecordResult.success && existingRecordResult.data && existingRecordResult.data.length > 0) {
          continue;
        }
        
        // Format the product/service field according to the specified rules
        let productService = '';
        
        // Extract capital letters and numbers from customer name
        const customerNameFormatted = (record.customerName || '')
          .replace(/[^A-Z0-9]/g, '')  // Keep only capital letters and numbers
          .trim();
        
        // Get the first word of the project name
        const projectNameFirstWord = record.projectName ?
          record.projectName.split(' ')[0] : '';
        
        // Concatenate with a colon
        productService = `${customerNameFormatted}:${projectNameFirstWord}`;
        
        // Look up if a customer exists where business_name = record.customerName and organization_id = organizationId
        let supabaseCustomerId = null;
        
        const customerResult = await adminQuery('customers', {
          select: '*',
          eq: {
            column: 'business_name',
            value: record.customerName
          }
        });
        
        if (customerResult.success && customerResult.data && customerResult.data.length > 0) {
          // Customer exists, check if linked to organization
          supabaseCustomerId = customerResult.data[0].id;
          
          // Check if customer is linked to organization
          const linkResult = await adminQuery('customer_organization', {
            select: '*',
            filter: {
              column: 'customer_id',
              operator: 'eq',
              value: supabaseCustomerId
            }
          });
          
          const isLinked = linkResult.success &&
                          linkResult.data &&
                          linkResult.data.some(link => link.organization_id === organizationId);
          
          if (!isLinked) {
            // Link customer to organization
            await adminInsert('customer_organization', {
              customer_id: supabaseCustomerId,
              organization_id: organizationId
            });
          }
        } else {
          // Customer doesn't exist, create it
          const newCustomerResult = await adminInsert('customers', {
            business_name: record.customerName
          });
          
          if (!newCustomerResult.success) {
            throw new Error(`Failed to create customer: ${newCustomerResult.error}`);
          }
          
          supabaseCustomerId = newCustomerResult.data[0].id;
          
          // Link customer to organization
          await adminInsert('customer_organization', {
            customer_id: supabaseCustomerId,
            organization_id: organizationId
          });
        }
        
        // Create the sale data with the Supabase customer ID
        const saleData = {
          financial_id: record.id,
          customer_id: supabaseCustomerId,
          organization_id: organizationId,
          product_name: productService,
          quantity: record.hours,
          unit_price: record.rate,
          total_price: record.amount,
          date: record.date
        };
        
        // Insert the sale record into Supabase
        const insertResult = await adminInsert('customer_sales', saleData);
        
        if (!insertResult.success) {
          throw new Error(insertResult.error || 'Failed to create sale record');
        }
        
        createdSales.push(insertResult.data[0]);
        
      } catch (error) {
        console.error(`Error creating sale for financial record ${record.id}:`, error);
        errors.push({
          financialId: record.id,
          error: error.message
        });
      }
    }
    
    return {
      success: true,
      data: createdSales,
      errors: errors.length > 0 ? errors : null,
      message: `Created ${createdSales.length} sales records from unbilled financials`
    };
  } catch (error) {
    console.error('Error creating sales from unbilled financials:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Updates a customer_sales record based on a financial record ID
 * @param {string} financialId - The financial record ID (__ID) to find the corresponding customer_sales record
 * @param {Object} financialRecord - The financial record data containing the fields to update
 * @returns {Promise<Object>} - Object containing success status and updated sale data
 */
export async function updateFinancialRecord(financialId, financialRecord) {
  try {
    if (!financialId) {
      throw new Error('Financial record ID is required');
    }

    if (!financialRecord) {
      throw new Error('Financial record data is required');
    }

    // First, find the customer_sales record with this financial_id
    const findResult = await adminQuery('customer_sales', {
      select: '*',
      eq: {
        column: 'financial_id',
        value: financialId
      }
    });

    if (!findResult.success || !findResult.data || findResult.data.length === 0) {
      throw new Error(`No customer_sales record found with financial_id: ${financialId}`);
    }

    const saleRecord = findResult.data[0];
    
    // Format the product/service field according to the specified rules
    let productService = '';
    
    // Extract capital letters and numbers from customer name
    const customerNameFormatted = (financialRecord["Customers::Name"] || '')
      .replace(/[^A-Z0-9]/g, '')  // Keep only capital letters and numbers
      .trim();
    
    // Get the first word of the project name
    const projectNameFirstWord = financialRecord["customers_Projects::projectName"] ?
      financialRecord["customers_Projects::projectName"].split(' ')[0] : '';
    
    // Concatenate with a colon
    productService = `${customerNameFormatted}:${projectNameFirstWord}`;

    // Prepare the update data
    const updateData = {
      quantity: financialRecord.Billable_Time_Rounded,
      date: financialRecord.DateStart,
      unit_price: financialRecord.Hourly_Rate,
      product_name: productService
    };

    // Update the customer_sales record
    const result = await adminUpdate('customer_sales', updateData, { id: saleRecord.id });
    
    // Process JSON data immediately after receiving the response
    const processedResult = {
      ...result,
      data: result.success && result.data ? processJsonData(result.data) : null
    };
    
    if (!processedResult.success) {
      throw new Error(processedResult.error || 'Failed to update sale');
    }

    // Return the processed data
    return {
      success: true,
      data: Array.isArray(processedResult.data) && processedResult.data.length > 0
        ? processedResult.data[0]
        : null
    };
  } catch (error) {
    console.error('Error updating sale from financial record:', error);
    return {
      success: false,
      error: error.message
    };
  }
}