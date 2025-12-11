/**
 * Product Relationships Service
 * Manages parent-child product relationships (addons, prerequisites, bundles, upsells)
 */
import { query, insert, update, remove } from './supabaseService';

/**
 * Relationship types
 */
export const RELATIONSHIP_TYPES = {
  ADDON: 'addon',
  PREREQUISITE: 'prerequisite',
  BUNDLE_ITEM: 'bundle_item',
  UPSELL: 'upsell',
  REQUIRED_CHOICE: 'required_choice' // Must pick one from this group
};

/**
 * Fetches all relationships for a parent product
 * @param {string} parentProductId - The parent product ID
 * @param {string} relationshipType - Optional filter by relationship type
 * @returns {Promise<Object>} - Object containing success status and relationships data
 */
export async function fetchProductRelationships(parentProductId, relationshipType = null) {
  if (!parentProductId) {
    return {
      success: false,
      error: 'Parent product ID is required',
      data: []
    };
  }

  try {
    const filters = [
      {
        type: 'eq',
        column: 'parent_product_id',
        value: parentProductId
      }
    ];

    if (relationshipType) {
      filters.push({
        type: 'eq',
        column: 'relationship_type',
        value: relationshipType
      });
    }

    const result = await query('products_products', {
      select: '*',
      filters: filters,
      order: {
        column: 'display_order',
        ascending: true
      }
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch product relationships');
    }

    return {
      success: true,
      data: result.data || []
    };
  } catch (error) {
    console.error('Error fetching product relationships:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
}

/**
 * Fetches products that have the given product as a child (reverse lookup)
 * @param {string} childProductId - The child product ID
 * @returns {Promise<Object>} - Object containing success status and parent products
 */
export async function fetchParentProducts(childProductId) {
  if (!childProductId) {
    return {
      success: false,
      error: 'Child product ID is required',
      data: []
    };
  }

  try {
    const result = await query('products_products', {
      select: '*',
      eq: {
        column: 'child_product_id',
        value: childProductId
      },
      order: {
        column: 'display_order',
        ascending: true
      }
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch parent products');
    }

    return {
      success: true,
      data: result.data || []
    };
  } catch (error) {
    console.error('Error fetching parent products:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
}

/**
 * Creates a new product relationship
 * @param {Object} relationshipData - The relationship data
 * @returns {Promise<Object>} - Object containing success status and created relationship
 */
export async function createProductRelationship(relationshipData) {
  try {
    const validation = validateRelationshipData(relationshipData);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(', ')
      };
    }

    // Ensure defaults
    const dataWithDefaults = {
      is_required: false,
      display_order: 0,
      quantity_multiplier: 1,
      ...relationshipData
    };

    const result = await insert('products_products', dataWithDefaults);

    if (!result.success) {
      throw new Error(result.error || 'Failed to create product relationship');
    }

    return {
      success: true,
      data: Array.isArray(result.data) && result.data.length > 0
        ? result.data[0]
        : result.data
    };
  } catch (error) {
    console.error('Error creating product relationship:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Updates an existing product relationship
 * @param {string} relationshipId - The relationship ID
 * @param {Object} relationshipData - The updated relationship data
 * @returns {Promise<Object>} - Object containing success status and updated relationship
 */
export async function updateProductRelationship(relationshipId, relationshipData) {
  try {
    if (!relationshipId) {
      throw new Error('Relationship ID is required');
    }

    const validation = validateRelationshipData(relationshipData, true);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(', ')
      };
    }

    const result = await update('products_products', relationshipData, { id: relationshipId });

    if (!result.success) {
      throw new Error(result.error || 'Failed to update product relationship');
    }

    return {
      success: true,
      data: Array.isArray(result.data) && result.data.length > 0
        ? result.data[0]
        : result.data
    };
  } catch (error) {
    console.error('Error updating product relationship:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Deletes a product relationship
 * @param {string} relationshipId - The relationship ID
 * @returns {Promise<Object>} - Object containing success status
 */
export async function deleteProductRelationship(relationshipId) {
  try {
    if (!relationshipId) {
      throw new Error('Relationship ID is required');
    }

    const result = await remove('products_products', { id: relationshipId });

    if (!result.success) {
      throw new Error(result.error || 'Failed to delete product relationship');
    }

    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('Error deleting product relationship:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Validates relationship data
 * @param {Object} data - Relationship data to validate
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Object} - Validation result { isValid, errors }
 */
export function validateRelationshipData(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.parent_product_id) {
      errors.push('Parent product ID is required');
    }

    if (!data.child_product_id) {
      errors.push('Child product ID is required');
    }

    if (data.parent_product_id === data.child_product_id) {
      errors.push('Product cannot be related to itself');
    }

    if (!data.relationship_type) {
      errors.push('Relationship type is required');
    } else if (!Object.values(RELATIONSHIP_TYPES).includes(data.relationship_type)) {
      errors.push(`Invalid relationship type. Must be one of: ${Object.values(RELATIONSHIP_TYPES).join(', ')}`);
    }
  }

  if (data.quantity_multiplier !== undefined &&
      (isNaN(parseInt(data.quantity_multiplier)) || parseInt(data.quantity_multiplier) < 1)) {
    errors.push('Quantity multiplier must be a positive integer');
  }

  if (data.display_order !== undefined && isNaN(parseInt(data.display_order))) {
    errors.push('Display order must be an integer');
  }

  if (data.price_override !== undefined && data.price_override !== null) {
    if (isNaN(parseFloat(data.price_override)) || parseFloat(data.price_override) < 0) {
      errors.push('Price override must be a non-negative number');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Gets a human-readable label for a relationship type
 * @param {string} relationshipType - The relationship type
 * @returns {string} - Human-readable label
 */
export function getRelationshipTypeLabel(relationshipType) {
  const labels = {
    [RELATIONSHIP_TYPES.ADDON]: 'Add-on',
    [RELATIONSHIP_TYPES.PREREQUISITE]: 'Prerequisite',
    [RELATIONSHIP_TYPES.BUNDLE_ITEM]: 'Bundle Item',
    [RELATIONSHIP_TYPES.UPSELL]: 'Upsell',
    [RELATIONSHIP_TYPES.REQUIRED_CHOICE]: 'Required Choice'
  };

  return labels[relationshipType] || relationshipType;
}

/**
 * Gets a description for a relationship type
 * @param {string} relationshipType - The relationship type
 * @returns {string} - Description
 */
export function getRelationshipTypeDescription(relationshipType) {
  const descriptions = {
    [RELATIONSHIP_TYPES.ADDON]: 'Optional products that complement this product',
    [RELATIONSHIP_TYPES.PREREQUISITE]: 'Required products that must be purchased first',
    [RELATIONSHIP_TYPES.BUNDLE_ITEM]: 'Products included in this bundle',
    [RELATIONSHIP_TYPES.UPSELL]: 'Suggested upgrades or premium alternatives',
    [RELATIONSHIP_TYPES.REQUIRED_CHOICE]: 'Customer must select one option from this group'
  };

  return descriptions[relationshipType] || '';
}
