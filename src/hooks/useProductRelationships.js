import { useState, useCallback } from 'react';
import {
  fetchProductRelationships,
  fetchParentProducts,
  createProductRelationship,
  updateProductRelationship,
  deleteProductRelationship,
  RELATIONSHIP_TYPES
} from '../services/productRelationshipsService';

/**
 * Hook for managing product relationships
 */
export function useProductRelationships(productId = null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [parentRelationships, setParentRelationships] = useState([]);

  /**
   * Loads relationships where this product is the parent
   */
  const loadRelationships = useCallback(async (parentId = null, relationshipType = null) => {
    const targetId = parentId || productId;

    if (!targetId) {
      setError('Product ID is required');
      return { success: false, error: 'Product ID is required' };
    }

    try {
      setLoading(true);
      setError(null);

      const result = await fetchProductRelationships(targetId, relationshipType);

      if (!result.success) {
        throw new Error(result.error || 'Failed to load relationships');
      }

      setRelationships(result.data || []);

      return {
        success: true,
        data: result.data
      };
    } catch (err) {
      console.error('Error loading relationships:', err);
      setError(err.message);
      return {
        success: false,
        error: err.message,
        data: []
      };
    } finally {
      setLoading(false);
    }
  }, [productId]);

  /**
   * Loads relationships where this product is the child (reverse lookup)
   */
  const loadParentRelationships = useCallback(async (childId = null) => {
    const targetId = childId || productId;

    if (!targetId) {
      setError('Product ID is required');
      return { success: false, error: 'Product ID is required' };
    }

    try {
      setLoading(true);
      setError(null);

      const result = await fetchParentProducts(targetId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to load parent relationships');
      }

      setParentRelationships(result.data || []);

      return {
        success: true,
        data: result.data
      };
    } catch (err) {
      console.error('Error loading parent relationships:', err);
      setError(err.message);
      return {
        success: false,
        error: err.message,
        data: []
      };
    } finally {
      setLoading(false);
    }
  }, [productId]);

  /**
   * Creates a new product relationship
   */
  const handleCreateRelationship = useCallback(async (relationshipData) => {
    try {
      setLoading(true);
      setError(null);

      const result = await createProductRelationship(relationshipData);

      if (!result.success) {
        throw new Error(result.error || 'Failed to create relationship');
      }

      // Reload relationships
      if (relationshipData.parent_product_id) {
        await loadRelationships(relationshipData.parent_product_id);
      }

      return result;
    } catch (err) {
      setError(err.message);
      console.error('Error creating relationship:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [loadRelationships]);

  /**
   * Updates an existing product relationship
   */
  const handleUpdateRelationship = useCallback(async (relationshipId, relationshipData) => {
    if (!relationshipId) {
      const error = 'Relationship ID is required';
      setError(error);
      return { success: false, error };
    }

    try {
      setLoading(true);
      setError(null);

      const result = await updateProductRelationship(relationshipId, relationshipData);

      if (!result.success) {
        throw new Error(result.error || 'Failed to update relationship');
      }

      // Update local state
      setRelationships(prevRelationships =>
        prevRelationships.map(rel =>
          rel.id === relationshipId
            ? { ...rel, ...relationshipData }
            : rel
        )
      );

      return result;
    } catch (err) {
      setError(err.message);
      console.error('Error updating relationship:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Deletes a product relationship
   */
  const handleDeleteRelationship = useCallback(async (relationshipId) => {
    if (!relationshipId) {
      const error = 'Relationship ID is required';
      setError(error);
      return { success: false, error };
    }

    try {
      setLoading(true);
      setError(null);

      const result = await deleteProductRelationship(relationshipId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete relationship');
      }

      // Update local state
      setRelationships(prevRelationships =>
        prevRelationships.filter(rel => rel.id !== relationshipId)
      );

      return result;
    } catch (err) {
      setError(err.message);
      console.error('Error deleting relationship:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Gets relationships by type
   */
  const getRelationshipsByType = useCallback((relationshipType) => {
    return relationships.filter(rel => rel.relationship_type === relationshipType);
  }, [relationships]);

  /**
   * Gets addons for the product
   */
  const getAddons = useCallback(() => {
    return getRelationshipsByType(RELATIONSHIP_TYPES.ADDON);
  }, [getRelationshipsByType]);

  /**
   * Gets prerequisites for the product
   */
  const getPrerequisites = useCallback(() => {
    return getRelationshipsByType(RELATIONSHIP_TYPES.PREREQUISITE);
  }, [getRelationshipsByType]);

  /**
   * Gets bundle items for the product
   */
  const getBundleItems = useCallback(() => {
    return getRelationshipsByType(RELATIONSHIP_TYPES.BUNDLE_ITEM);
  }, [getRelationshipsByType]);

  /**
   * Gets upsells for the product
   */
  const getUpsells = useCallback(() => {
    return getRelationshipsByType(RELATIONSHIP_TYPES.UPSELL);
  }, [getRelationshipsByType]);

  return {
    // State
    loading,
    error,
    relationships,
    parentRelationships,

    // Actions
    loadRelationships,
    loadParentRelationships,
    handleCreateRelationship,
    handleUpdateRelationship,
    handleDeleteRelationship,

    // Utility functions
    getRelationshipsByType,
    getAddons,
    getPrerequisites,
    getBundleItems,
    getUpsells,
    clearError: () => setError(null)
  };
}
