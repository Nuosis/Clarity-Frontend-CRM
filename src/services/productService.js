/**
 * Product data processing and business logic
 */
import { query, insert, update, remove } from './supabaseService';

/**
 * Fetches all products for a specific organization
 * @param {string} organizationId - The organization ID to fetch products for
 * @returns {Promise<Object>} - Object containing success status and products data
 */
export async function fetchProductsByOrganization(organizationId) {
  if (!organizationId) {
    console.error('Cannot fetch products: Organization ID is missing');
    return {
      success: false,
      error: 'Organization ID is required',
      data: []
    };
  }

  try {
    console.log(`Fetching products for organization: ${organizationId}`);
    
    // Use query for regular database operations
    const result = await query('products', {
      select: '*',
      eq: {
        column: 'organization_id',
        value: organizationId
      },
      order: {
        column: 'name',
        ascending: true
      }
    });

    // Process JSON data immediately after receiving the response
    const processedResult = {
      ...result,
      data: result.success && result.data ? processJsonData(result.data) : []
    };

    if (!processedResult.success) {
      throw new Error(processedResult.error || 'Failed to fetch products');
    }

    // Handle null or undefined data gracefully
    if (!processedResult.data || !Array.isArray(processedResult.data) || processedResult.data.length === 0) {
      console.log(`No products found for organization: ${organizationId}`);
      return {
        success: true,
        data: []
      };
    }

    // Ensure price is always a number for each product
    const processedProducts = processedResult.data.map(product => {
      if (!product) return null;
      
      // Convert price to number if it's a string
      if (product.price !== undefined && product.price !== null) {
        product.price = typeof product.price === 'string'
          ? parseFloat(product.price)
          : product.price;
      }
      
      return product;
    }).filter(product => product !== null); // Filter out null products

    return {
      success: true,
      data: processedProducts
    };
  } catch (error) {
    console.error('Error fetching products:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
}

/**
 * Creates a new product
 * @param {Object} productData - The product data to create
 * @returns {Promise<Object>} - Object containing success status and created product data
 */
export async function createProduct(productData) {
  try {
    const validation = validateProductData(productData);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(', ')
      };
    }

    const result = await insert('products', productData);
    
    // Process JSON data immediately after receiving the response
    const processedResult = {
      ...result,
      data: result.success && result.data ? processJsonData(result.data) : null
    };
    
    if (!processedResult.success) {
      throw new Error(processedResult.error || 'Failed to create product');
    }

    // Return the processed data
    return {
      success: true,
      data: Array.isArray(processedResult.data) && processedResult.data.length > 0
        ? processedResult.data[0]
        : null
    };
  } catch (error) {
    console.error('Error creating product:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Updates an existing product
 * @param {string} productId - The ID of the product to update
 * @param {Object} productData - The updated product data
 * @returns {Promise<Object>} - Object containing success status and updated product data
 */
export async function updateProduct(productId, productData) {
  try {
    if (!productId) {
      throw new Error('Product ID is required');
    }

    const validation = validateProductData(productData);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(', ')
      };
    }

    const result = await update('products', productData, { id: productId });
    
    // Process JSON data immediately after receiving the response
    const processedResult = {
      ...result,
      data: result.success && result.data ? processJsonData(result.data) : null
    };
    
    if (!processedResult.success) {
      throw new Error(processedResult.error || 'Failed to update product');
    }

    // Return the processed data
    return {
      success: true,
      data: Array.isArray(processedResult.data) && processedResult.data.length > 0
        ? processedResult.data[0]
        : null
    };
  } catch (error) {
    console.error('Error updating product:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Deletes a product
 * @param {string} productId - The ID of the product to delete
 * @returns {Promise<Object>} - Object containing success status
 */
export async function deleteProduct(productId) {
  try {
    if (!productId) {
      throw new Error('Product ID is required');
    }

    const result = await remove('products', { id: productId });
    
    // Process JSON data immediately after receiving the response
    const processedResult = {
      ...result,
      data: result.success && result.data ? processJsonData(result.data) : null
    };
    
    if (!processedResult.success) {
      throw new Error(processedResult.error || 'Failed to delete product');
    }

    // Return the processed data
    return {
      success: true,
      data: processedResult.data
    };
  } catch (error) {
    console.error('Error deleting product:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Validates product data before creation/update
 * @param {Object} data - Product data to validate
 * @returns {Object} - Validation result { isValid, errors }
 */
export function validateProductData(data) {
  const errors = [];

  if (!data.name?.trim()) {
    errors.push('Product name is required');
  }

  if (data.price === undefined || data.price === null || isNaN(parseFloat(data.price)) || parseFloat(data.price) <= 0) {
    errors.push('Product price must be a positive number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Formats product data for display
 * @param {Object} product - Product record
 * @returns {Object} - Formatted product data
 */
export function formatProductForDisplay(product) {
  // Process any stringified JSON in the product data first
  const processedProduct = processJsonData(product);
  
  return {
    id: processedProduct.id,
    name: processedProduct.name,
    price: typeof processedProduct.price === 'number'
      ? processedProduct.price.toFixed(2)
      : parseFloat(processedProduct.price).toFixed(2),
    description: processedProduct.description || 'No description available',
    created: new Date(processedProduct.created_at).toLocaleDateString(),
    updated: new Date(processedProduct.updated_at).toLocaleDateString()
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
 * Groups products by price range
 * @param {Array} products - Array of product records
 * @returns {Object} - Grouped products by price range
 */
export function groupProductsByPriceRange(products) {
  // Process any stringified JSON in the products array first
  const processedProducts = Array.isArray(products) ? processJsonData(products) : [];
  
  return processedProducts.reduce((groups, product) => {
    const price = typeof product.price === 'number' ? product.price : parseFloat(product.price);
    
    if (price < 50) {
      groups.low.push(product);
    } else if (price < 200) {
      groups.medium.push(product);
    } else {
      groups.high.push(product);
    }
    
    return groups;
  }, { low: [], medium: [], high: [] });
}

/**
 * Calculates product statistics
 * @param {Array} products - Array of product records
 * @returns {Object} - Product statistics
 */
export function calculateProductStats(products) {
  // Process any stringified JSON in the products array first
  const processedProducts = Array.isArray(products) ? processJsonData(products) : [];
  
  if (!processedProducts || processedProducts.length === 0) {
    return {
      total: 0,
      averagePrice: 0,
      minPrice: 0,
      maxPrice: 0
    };
  }

  const prices = processedProducts.map(product =>
    typeof product.price === 'number' ? product.price : parseFloat(product.price)
  );
  
  return {
    total: products.length,
    averagePrice: (prices.reduce((sum, price) => sum + price, 0) / prices.length).toFixed(2),
    minPrice: Math.min(...prices).toFixed(2),
    maxPrice: Math.max(...prices).toFixed(2)
  };
}

/**
 * Loads products for an organization and updates the app state
 * @param {string} organizationId - The organization ID to load products for
 * @param {Function} setProducts - Function to update the products state
 * @param {Function} setLoading - Function to update the loading state
 * @param {Function} setError - Function to update the error state
 * @returns {Promise<Object>} - Object containing success status and products data
 */
export async function loadOrganizationProducts(organizationId, setProducts, setLoading, setError) {
  // Handle null or undefined organizationId gracefully
  if (!organizationId) {
    console.log('Cannot load products: Organization ID is missing or null');
    if (setProducts) setProducts([]);
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
    
    const result = await fetchProductsByOrganization(organizationId);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to load products');
    }
    
    // The data is already processed by fetchProductsByOrganization
    const productsData = result.data || [];
    
    // Update the app state with the products if setProducts function is provided
    if (setProducts) setProducts(productsData);
    if (setLoading) setLoading(false);
    
    // Return the already processed data
    return {
      success: true,
      data: productsData
    };
  } catch (error) {
    console.error('Error loading products:', error);
    setError(error.message);
    setLoading(false);
    
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
}