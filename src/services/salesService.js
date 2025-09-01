/**
 * Sales data processing and business logic
 */
import { query, insert, update, remove } from './supabaseService';
import { v4 as uuidv4 } from 'uuid';

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
    const result = await query('customer_sales', {
      select: `id, date, customer_id, product_id, product_name, quantity,
        unit_price, total_price, inv_id, organization_id, created_at, updated_at, financial_id,
        customers(business_name)`,
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
 * Fetches unbilled sales (null inv_id) for a specific organization
 * @param {string} organizationId - The organization ID to fetch unbilled sales for
 * @returns {Promise<Object>} - Object containing success status and sales data
 */
export async function fetchUnbilledSalesByOrganization(organizationId) {
  if (!organizationId) {
    console.error('Cannot fetch unbilled sales: Organization ID is missing');
    return {
      success: false,
      error: 'Organization ID is required',
      data: []
    };
  }

  try {
    console.log(`Fetching unbilled sales for organization: ${organizationId}`);
    
    // Use adminQuery to bypass RLS restrictions with multiple filters
    // Include a join with the customers table to get the customer name
    const result = await query('customer_sales', {
      select: `id, date, customer_id, product_id, product_name, quantity,
        unit_price, total_price, inv_id, organization_id, created_at, updated_at, financial_id,
        customers(business_name)`,
      filters: [
        { type: 'eq', column: 'organization_id', value: organizationId },
        { type: 'is', column: 'inv_id', value: null }
      ],
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
      throw new Error(processedResult.error || 'Failed to fetch unbilled sales');
    }

    // Handle null or undefined data gracefully
    if (!processedResult.data || !Array.isArray(processedResult.data) || processedResult.data.length === 0) {
      console.log(`No unbilled sales found for organization: ${organizationId}`);
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
    console.error('Error fetching unbilled sales:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
}

/**
 * Fetches sales for the current month for a specific organization
 * @param {string} organizationId - The organization ID to fetch current month sales for
 * @returns {Promise<Object>} - Object containing success status and sales data
 */
export async function fetchCurrentMonthSalesByOrganization(organizationId) {
  if (!organizationId) {
    console.error('Cannot fetch current month sales: Organization ID is missing');
    return {
      success: false,
      error: 'Organization ID is required',
      data: []
    };
  }

  try {
    console.log(`Fetching current month sales for organization: ${organizationId}`);
    
    // Calculate first and last day of current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    
    // Use adminQuery to bypass RLS restrictions with multiple filters
    const result = await query('customer_sales', {
      select: `id, date, customer_id, product_id, product_name, quantity,
        unit_price, total_price, inv_id, organization_id, created_at, updated_at, financial_id,
        customers(business_name)`,
      filters: [
        { type: 'eq', column: 'organization_id', value: organizationId },
        { type: 'gte', column: 'date', value: firstDay },
        { type: 'lte', column: 'date', value: lastDay }
      ],
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
      throw new Error(processedResult.error || 'Failed to fetch current month sales');
    }

    // Handle null or undefined data gracefully
    if (!processedResult.data || !Array.isArray(processedResult.data) || processedResult.data.length === 0) {
      console.log(`No current month sales found for organization: ${organizationId}`);
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
    console.error('Error fetching current month sales:', error);
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
    const result = await query('customer_sales', {
      select: `id, date, customer_id, product_id, product_name, quantity,
        unit_price, total_price, inv_id, organization_id, created_at, updated_at, financial_id,
        customers(business_name)`,
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
 * Fetches unbilled sales (null inv_id) for a specific customer
 * @param {string} customerId - The customer ID to fetch unbilled sales for
 * @returns {Promise<Object>} - Object containing success status and sales data
 */
export async function fetchUnbilledSalesByCustomer(customerId) {
  if (!customerId) {
    console.error('Cannot fetch unbilled sales: Customer ID is missing');
    return {
      success: false,
      error: 'Customer ID is required',
      data: []
    };
  }

  try {
    console.log(`Fetching unbilled sales for customer: ${customerId}`);
    
    // Use adminQuery to bypass RLS restrictions with multiple filters
    const result = await query('customer_sales', {
      select: `id, date, customer_id, product_id, product_name, quantity,
        unit_price, total_price, inv_id, organization_id, created_at, updated_at, financial_id,
        customers(business_name)`,
      filters: [
        { type: 'eq', column: 'customer_id', value: customerId },
        { type: 'is', column: 'inv_id', value: null }
      ],
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
      throw new Error(processedResult.error || 'Failed to fetch unbilled sales');
    }

    // Handle null or undefined data gracefully
    if (!processedResult.data || !Array.isArray(processedResult.data) || processedResult.data.length === 0) {
      console.log(`No unbilled sales found for customer: ${customerId}`);
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
    console.error('Error fetching unbilled sales:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
}

/**
 * Fetches sales for the current month for a specific customer
 * @param {string} customerId - The customer ID to fetch current month sales for
 * @returns {Promise<Object>} - Object containing success status and sales data
 */
export async function fetchCurrentMonthSalesByCustomer(customerId) {
  if (!customerId) {
    console.error('Cannot fetch current month sales: Customer ID is missing');
    return {
      success: false,
      error: 'Customer ID is required',
      data: []
    };
  }

  try {
    console.log(`Fetching current month sales for customer: ${customerId}`);
    
    // Calculate first and last day of current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    
    // Use adminQuery to bypass RLS restrictions with multiple filters
    const result = await query('customer_sales', {
      select: `id, date, customer_id, product_id, product_name, quantity,
        unit_price, total_price, inv_id, organization_id, created_at, updated_at, financial_id,
        customers(business_name)`,
      filters: [
        { type: 'eq', column: 'customer_id', value: customerId },
        { type: 'gte', column: 'date', value: firstDay },
        { type: 'lte', column: 'date', value: lastDay }
      ],
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
      throw new Error(processedResult.error || 'Failed to fetch current month sales');
    }

    // Handle null or undefined data gracefully
    if (!processedResult.data || !Array.isArray(processedResult.data) || processedResult.data.length === 0) {
      console.log(`No current month sales found for customer: ${customerId}`);
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
    console.error('Error fetching current month sales:', error);
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

    const result = await insert('customer_sales', {
      id: uuidv4(),
      ...saleData
    });
    
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
 * Creates multiple sales entries in a batch
 * @param {Array} salesDataArray - Array of sale data objects to create
 * @returns {Promise<Object>} - Object containing success status and created sales data
 */
export async function createSalesBatch(salesDataArray) {
  try {
    if (!Array.isArray(salesDataArray) || salesDataArray.length === 0) {
      return {
        success: true,
        data: [],
        message: 'No sales to create'
      };
    }

    const results = [];
    const errors = [];

    // Process each sale in the batch
    for (const saleData of salesDataArray) {
      if (!saleData.organization_id) {
        errors.push('Organization ID is required for all sales');
        continue;
      }

      if (!saleData.customer_id) {
        errors.push(`Customer ID is required for sale: ${JSON.stringify(saleData)}`);
        continue;
      }

      const validation = validateSaleData(saleData);
      if (!validation.isValid) {
        errors.push(`Validation failed for sale: ${validation.errors.join(', ')}`);
        continue;
      }

      try {
        const result = await insert('customer_sales', {
          id: uuidv4(),
          ...saleData
        });
        
        // Process JSON data immediately after receiving the response
        const processedResult = {
          ...result,
          data: result.success && result.data ? processJsonData(result.data) : null
        };
        
        if (!processedResult.success) {
          errors.push(`Failed to create sale: ${processedResult.error || 'Unknown error'}`);
          continue;
        }

        // Add the created sale to results
        if (Array.isArray(processedResult.data) && processedResult.data.length > 0) {
          results.push(processedResult.data[0]);
        }
      } catch (err) {
        errors.push(`Error creating sale: ${err.message}`);
      }
    }

    return {
      success: errors.length === 0,
      data: results,
      errors: errors.length > 0 ? errors : null
    };
  } catch (error) {
    console.error('Error creating sales batch:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
}

/**
 * Updates an existing sale with targeted PATCH approach
 * @param {string} saleId - The ID of the sale to update
 * @param {Object} saleData - The updated sale data (full record for UI state)
 * @param {Object} patchPayload - Optional targeted patch payload (only changed fields)
 * @returns {Promise<Object>} - Object containing success status and updated sale data
 */
export async function updateSale(saleId, saleData, patchPayload = null) {
  try {
    if (!saleId) {
      throw new Error('Sale ID is required');
    }

    // Use targeted patch payload if provided, otherwise fall back to full filtering
    const dataToUpdate = patchPayload || saleData;

    // Filter out computed fields that don't exist in the database table
    const allowedFields = [
      'customer_id', 'product_id', 'product_name', 'quantity',
      'unit_price', 'total_price', 'date', 'inv_id', 'financial_id', 'organization_id'
    ];
    
    const filteredSaleData = {};
    for (const [key, value] of Object.entries(dataToUpdate)) {
      if (allowedFields.includes(key)) {
        // Preserve null values for inv_id field - they are meaningful
        filteredSaleData[key] = value;
      }
    }

    console.log('Targeted PATCH update data:', filteredSaleData);

    const validation = validateSaleData(saleData); // Validate full record for business rules
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(', ')
      };
    }

    const result = await update('customer_sales', filteredSaleData, { id: saleId });
    
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
 * Updates an existing sale with targeted PATCH approach (dedicated function)
 * @param {string} saleId - The ID of the sale to update
 * @param {Object} patchData - Only the fields that should be updated
 * @returns {Promise<Object>} - Object containing success status and updated sale data
 */
export async function updateSaleTargeted(saleId, patchData) {
  try {
    if (!saleId) {
      throw new Error('Sale ID is required');
    }

    if (!patchData || Object.keys(patchData).length === 0) {
      throw new Error('Patch data is required');
    }

    // Define mutable fields that can be updated via PATCH
    const mutableFields = [
      'product_name', 'quantity', 'unit_price', 'total_price', 'date', 'inv_id'
    ];
    
    // Filter to only include mutable fields
    const targetedPatchData = {};
    for (const [key, value] of Object.entries(patchData)) {
      if (mutableFields.includes(key)) {
        targetedPatchData[key] = value;
      }
    }

    if (Object.keys(targetedPatchData).length === 0) {
      throw new Error('No valid fields to update');
    }

    console.log('Targeted PATCH data (mutable fields only):', targetedPatchData);

    // Perform the targeted update
    const result = await update('customer_sales', targetedPatchData, { id: saleId });
    
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
        : null,
      updatedFields: Object.keys(targetedPatchData)
    };
  } catch (error) {
    console.error('Error updating sale with targeted PATCH:', error);
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

    const result = await remove('customer_sales', { id: saleId });
    
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

  console.log('Validating sale data:', data);

  // For editing existing sales in the UI, we don't require product_id or project_id
  // Only require these fields for new sales being created from scratch (not from financial records)
  // If the record has a financial_id, it's from the financial system and doesn't need product_id/project_id
  if (!data.id && !data.financial_id && !data.product_id && !data.project_id) {
    errors.push('Either Product ID or Project ID is required');
  }

  if (!data.customer_id) {
    errors.push('Customer ID is required');
  }

  // Check for unit_price and quantity
  if (data.unit_price === undefined || data.unit_price === null ||
      isNaN(parseFloat(data.unit_price)) || parseFloat(data.unit_price) < 0) {
    errors.push('Unit price must be a non-negative number');
  }

  if (data.quantity === undefined || data.quantity === null ||
      isNaN(parseFloat(data.quantity)) || parseFloat(data.quantity) < 0) {
    errors.push('Quantity must be a non-negative number (0 or greater)');
  }

  if (!data.date) {
    errors.push('Sale date is required');
  }

  // Only require organization_id for new sales, not when editing existing ones
  // But if we're updating an existing record, we still need organization_id
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
  
  // Determine the amount from either total_price or amount field
  const rawAmount = processedSale.total_price !== undefined ?
    processedSale.total_price : processedSale.amount;
  
  const formattedAmount = typeof rawAmount === 'number'
    ? rawAmount.toFixed(2)
    : parseFloat(rawAmount).toFixed(2);
  
  return {
    id: processedSale.id,
    product_id: processedSale.product_id || null,
    project_id: processedSale.project_id || null,
    customer_id: processedSale.customer_id,
    amount: formattedAmount,
    date: new Date(processedSale.date).toLocaleDateString(),
    description: processedSale.description || '',
    type: processedSale.type || 'sales', // 'sales', 'sellable', etc.
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
        // Always preserve key-value pairs, including null values for meaningful fields like inv_id
        result[key] = value;
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
      maxAmount: 0,
      byType: {
        sales: 0,
        sellable: 0
      }
    };
  }

  // Extract amounts, handling both total_price and amount fields
  const amounts = processedSales.map(sale => {
    const amount = sale.total_price !== undefined ? sale.total_price : sale.amount;
    return typeof amount === 'number' ? amount : parseFloat(amount);
  });
  
  const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0);
  
  // Calculate amounts by type
  const byType = processedSales.reduce((acc, sale) => {
    const type = sale.type || 'sales';
    const amount = sale.total_price !== undefined ? sale.total_price : sale.amount;
    const numAmount = typeof amount === 'number' ? amount : parseFloat(amount);
    
    acc[type] = (acc[type] || 0) + numAmount;
    return acc;
  }, {});
  
  return {
    total: sales.length,
    totalAmount: totalAmount.toFixed(2),
    averageAmount: (totalAmount / amounts.length).toFixed(2),
    minAmount: Math.min(...amounts).toFixed(2),
    maxAmount: Math.max(...amounts).toFixed(2),
    byType: {
      sales: (byType.sales || 0).toFixed(2),
      sellable: (byType.sellable || 0).toFixed(2)
    }
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
/**
 * Creates sales entries from project value based on fixed price or subscription settings
 * @param {Object} project - The project data
 * @param {string} organizationId - The organization ID
 * @returns {Promise<Object>} - Object containing success status and created sales data
 */
export async function createSalesFromProjectValue(project, organizationId) {
  try {
    if (!project) {
      return {
        success: false,
        error: 'Project data is required',
        data: []
      };
    }

    if (!organizationId) {
      return {
        success: false,
        error: 'Organization ID is required',
        data: []
      };
    }

    // Import the processProjectValue function from projectService
    // Note: In a real implementation, you would import this at the top of the file
    // For this example, we'll assume the function is available
    const { processProjectValue } = await import('./projectService');
    
    // Process the project to determine what sales entries to create
    const { salesToCreate } = processProjectValue(project);
    
    if (!salesToCreate || salesToCreate.length === 0) {
      return {
        success: true,
        message: 'No sales to create for this project',
        data: []
      };
    }
    
    // Add organization_id to each sale
    const salesWithOrg = salesToCreate.map(sale => ({
      ...sale,
      organization_id: organizationId
    }));
    
    // Create the sales in batch
    const result = await createSalesBatch(salesWithOrg);
    
    return result;
  } catch (error) {
    console.error('Error creating sales from project value:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
}

export async function createSalesFromUnbilledFinancials(organizationId) {
  try {
    // Import required functions
    const { fetchUnpaidRecords } = await import('../api/financialRecords');
    const { processFinancialData } = await import('./billableHoursService');

    // Fetch all unbilled financial records using the "unpaid" timeframe
    // This approach is consistent with how useBillableHours successfully fetches unbilled records
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
        const existingRecordResult = await query('customer_sales', {
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
        
        const customerResult = await query('customers', {
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
          const linkResult = await query('customer_organization', {
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
            await insert('customer_organization', {
              id: uuidv4(),
              customer_id: supabaseCustomerId,
              organization_id: organizationId
            });
          }
        } else {
          // Customer doesn't exist, create it
          const newCustomerResult = await insert('customers', {
            id: uuidv4(),
            business_name: record.customerName
          });
          
          if (!newCustomerResult.success) {
            throw new Error(`Failed to create customer: ${newCustomerResult.error}`);
          }
          
          supabaseCustomerId = newCustomerResult.data[0].id;
          
          // Link customer to organization
          await insert('customer_organization', {
            id: uuidv4(),
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
        const insertResult = await insert('customer_sales', saleData);
        
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
    const findResult = await query('customer_sales', {
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
    const result = await update('customer_sales', updateData, { id: saleRecord.id });
    
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

/**
 * Creates a sales record from a single financial record
 * @param {string} financialId - The ID of the financial record
 * @param {Object} organizationId - The organization ID
 * @returns {Promise<Object>} - Object containing success status and created sale data
 */
export async function createSaleFromFinancialRecord(financialId, organizationId) {
  try {
    if (!financialId) {
      throw new Error('Financial record ID is required');
    }

    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    // Import required functions
    const { fetchFinancialRecords } = await import('../api/financialRecords');
    const { processFinancialData } = await import('./billableHoursService');

    // Fetch the specific financial record
    const result = await fetchFinancialRecords('unpaid', null, null);
    
    if (!result || !result.response || !result.response.data) {
      throw new Error('Failed to fetch financial record');
    }
    
    // Process the financial data
    const financialRecords = processFinancialData(result);
    
    // Find the specific record we're looking for
    const record = financialRecords.find(r => r.id === financialId);
    
    if (!record) {
      throw new Error(`Financial record with ID ${financialId} not found`);
    }
    
    // Skip records that are already billed
    if (record.billed) {
      return {
        success: true,
        data: null,
        message: 'Record is already billed, skipping'
      };
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
    
    const customerResult = await query('customers', {
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
      const linkResult = await query('customer_organization', {
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
        await insert('customer_organization', {
          customer_id: supabaseCustomerId,
          organization_id: organizationId
        });
      }
    } else {
      // Customer doesn't exist, create it
      const newCustomerResult = await insert('customers', {
        business_name: record.customerName
      });
      
      if (!newCustomerResult.success) {
        throw new Error(`Failed to create customer: ${newCustomerResult.error}`);
      }
      
      supabaseCustomerId = newCustomerResult.data[0].id;
      
      // Link customer to organization
      await insert('customer_organization', {
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
    const insertResult = await insert('customer_sales', saleData);
    
    if (!insertResult.success) {
      throw new Error(insertResult.error || 'Failed to create sale record');
    }
    
    return {
      success: true,
      data: insertResult.data[0],
      message: 'Sales record created successfully'
    };
  } catch (error) {
    console.error('Error creating sale from financial record:', error);
    return {
      success: false,
      error: error.message
    };
  }
}