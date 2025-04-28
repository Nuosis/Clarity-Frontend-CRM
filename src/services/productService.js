/**
 * Product data processing and business logic
 */
import { adminQuery, insert, update, remove } from './supabaseService';

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
    
    // Use adminQuery to bypass RLS restrictions
    const result = await adminQuery('products', {
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

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch products');
    }

    // Process the data to handle any stringified JSON
    const processedProducts = result.data.map(product => {
      // Parse any stringified fields if needed
      return {
        ...product,
        id: parseStringifiedJson(product.id),
        organization_id: parseStringifiedJson(product.organization_id),
        price: typeof product.price === 'string' ? parseFloat(product.price) : product.price
      };
    });

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
    if (!productData.organization_id) {
      throw new Error('Organization ID is required');
    }

    const validation = validateProductData(productData);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(', ')
      };
    }

    const result = await insert('products', productData);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to create product');
    }

    return {
      success: true,
      data: result.data[0]
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
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to update product');
    }

    return {
      success: true,
      data: result.data[0]
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
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete product');
    }

    return {
      success: true
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

  if (!data.organization_id) {
    errors.push('Organization ID is required');
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
  return {
    id: product.id,
    name: product.name,
    price: typeof product.price === 'number' 
      ? product.price.toFixed(2) 
      : parseFloat(product.price).toFixed(2),
    description: product.description || 'No description available',
    created: new Date(product.created_at).toLocaleDateString(),
    updated: new Date(product.updated_at).toLocaleDateString()
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
    // Check if the string starts with '{' or '[' indicating it might be JSON
    if (value.startsWith('{') || value.startsWith('[')) {
      return JSON.parse(value);
    }
    return value;
  } catch (e) {
    // If parsing fails, return the original value
    return value;
  }
}

/**
 * Groups products by price range
 * @param {Array} products - Array of product records
 * @returns {Object} - Grouped products by price range
 */
export function groupProductsByPriceRange(products) {
  return products.reduce((groups, product) => {
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
  if (!products || products.length === 0) {
    return {
      total: 0,
      averagePrice: 0,
      minPrice: 0,
      maxPrice: 0
    };
  }

  const prices = products.map(product => 
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
  if (!organizationId) {
    console.error('Cannot load products: Organization ID is missing');
    return {
      success: false,
      error: 'Organization ID is required',
      data: []
    };
  }

  try {
    setLoading(true);
    
    const result = await fetchProductsByOrganization(organizationId);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to load products');
    }
    
    // Update the app state with the products
    setProducts(result.data);
    setLoading(false);
    
    return {
      success: true,
      data: result.data
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