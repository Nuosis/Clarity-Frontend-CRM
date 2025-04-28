import { useState, useCallback, useEffect } from 'react';
import { useAppState, useAppStateOperations } from '../context/AppStateContext';
import {
  fetchProductsByOrganization,
  createProduct,
  updateProduct,
  deleteProduct,
  formatProductForDisplay,
  groupProductsByPriceRange,
  calculateProductStats
} from '../services/productService';

/**
 * Hook for managing products state and operations
 * Handles initialization of products during app startup
 */
export function useProducts() {
  const { user, products: stateProducts, selectedProduct } = useAppState();
  const { setProducts, setSelectedProduct, setLoading: setAppLoading, setError: setAppError } = useAppStateOperations();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [initialized, setInitialized] = useState(false);

  // Update stats when products change
  useEffect(() => {
    if (stateProducts && stateProducts.length > 0) {
      setStats(calculateProductStats(stateProducts));
    } else {
      setStats({
        total: 0,
        averagePrice: 0,
        minPrice: 0,
        maxPrice: 0
      });
    }
  }, [stateProducts]);

  // Auto-initialize products when user changes and has an organization ID
  useEffect(() => {
    if (user?.supabaseOrgID && !initialized) {
      loadProductsForOrganization(user.supabaseOrgID);
    }
  }, [user?.supabaseOrgID, initialized]);

  /**
   * Loads products for a specific organization
   * Used during initialization and can be called manually if needed
   */
  const loadProductsForOrganization = useCallback(async (organizationId) => {
    if (!organizationId) {
      console.warn('Cannot load products: Organization ID is missing');
      return {
        success: false,
        error: 'Organization ID is required',
        data: []
      };
    }

    try {
      setLoading(true);
      setError(null);
      setAppLoading(true);
      
      console.log(`Loading products for organization: ${organizationId}`);
      const result = await fetchProductsByOrganization(organizationId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load products');
      }
      
      // The data is already processed by fetchProductsByOrganization
      const productsData = result.data || [];
      
      // Update the app state with the products
      setProducts(productsData);
      setInitialized(true);
      
      return {
        success: true,
        data: productsData
      };
    } catch (err) {
      console.error('Error loading products:', err);
      setError(err.message);
      setAppError(`Failed to load products: ${err.message}`);
      return {
        success: false,
        error: err.message,
        data: []
      };
    } finally {
      setLoading(false);
      setAppLoading(false);
    }
  }, [setProducts, setAppLoading, setAppError]);

  /**
   * Selects a product
   */
  const handleProductSelect = useCallback((productId) => {
    if (!stateProducts || stateProducts.length === 0) {
      setError('No products available');
      return;
    }

    const product = stateProducts.find(p => p.id === productId);
    if (product) {
      setSelectedProduct(product);
    } else {
      setError(`Product with ID ${productId} not found`);
    }
  }, [stateProducts, setSelectedProduct]);

  /**
   * Creates a new product
   */
  const handleProductCreate = useCallback(async (productData) => {
    if (!user?.supabaseOrgID) {
      const error = 'Cannot create product: Organization ID is missing';
      setError(error);
      return { success: false, error };
    }

    try {
      setLoading(true);
      setError(null);
      
      // Ensure organization_id is set
      const productWithOrg = {
        ...productData,
        organization_id: user.supabaseOrgID
      };
      
      const result = await createProduct(productWithOrg);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create product');
      }
      
      // Update local state by reloading products
      await loadProductsForOrganization(user.supabaseOrgID);
      
      return result;
    } catch (err) {
      setError(err.message);
      console.error('Error creating product:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [user, loadProductsForOrganization]);

  /**
   * Updates an existing product
   */
  const handleProductUpdate = useCallback(async (productId, productData) => {
    if (!productId) {
      const error = 'Product ID is required';
      setError(error);
      return { success: false, error };
    }

    try {
      setLoading(true);
      setError(null);
      
      const result = await updateProduct(productId, productData);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update product');
      }
      
      // Update local state
      if (user?.supabaseOrgID) {
        await loadProductsForOrganization(user.supabaseOrgID);
      } else {
        // Fallback if no organization ID is available
        setProducts(prevProducts => 
          prevProducts.map(product => 
            product.id === productId
              ? { ...product, ...productData }
              : product
          )
        );
      }
      
      // Update selected product if it's the one being updated
      if (selectedProduct?.id === productId) {
        setSelectedProduct({ ...selectedProduct, ...productData });
      }
      
      return result;
    } catch (err) {
      setError(err.message);
      console.error('Error updating product:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [user, selectedProduct, setProducts, setSelectedProduct, loadProductsForOrganization]);

  /**
   * Deletes a product
   */
  const handleProductDelete = useCallback(async (productId) => {
    if (!productId) {
      const error = 'Product ID is required';
      setError(error);
      return { success: false, error };
    }

    try {
      setLoading(true);
      setError(null);
      
      const result = await deleteProduct(productId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete product');
      }
      
      // Update local state
      if (user?.supabaseOrgID) {
        await loadProductsForOrganization(user.supabaseOrgID);
      } else {
        // Fallback if no organization ID is available
        setProducts(prevProducts => 
          prevProducts.filter(product => product.id !== productId)
        );
      }
      
      // Clear selected product if it's the one being deleted
      if (selectedProduct?.id === productId) {
        setSelectedProduct(null);
      }
      
      return result;
    } catch (err) {
      setError(err.message);
      console.error('Error deleting product:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [user, selectedProduct, setProducts, setSelectedProduct, loadProductsForOrganization]);

  /**
   * Gets products grouped by price range
   */
  const getProductsByPriceRange = useCallback(() => {
    return groupProductsByPriceRange(stateProducts || []);
  }, [stateProducts]);

  /**
   * Formats a product for display
   */
  const formatProduct = useCallback((product) => {
    return formatProductForDisplay(product);
  }, []);

  return {
    // State
    loading,
    error,
    products: stateProducts || [],
    selectedProduct,
    stats,
    initialized,
    
    // Actions
    loadProductsForOrganization,
    handleProductSelect,
    handleProductCreate,
    handleProductUpdate,
    handleProductDelete,
    
    // Utility functions
    getProductsByPriceRange,
    formatProduct,
    clearError: () => setError(null),
    clearSelectedProduct: () => setSelectedProduct(null)
  };
}