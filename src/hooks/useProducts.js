import { useState, useCallback, useEffect } from 'react';
import { useAppState, useAppStateOperations } from '../context/AppStateContext';
import {
  fetchAllProducts,
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
  const { products: stateProducts, selectedProduct } = useAppState();
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

  // Auto-initialize products on mount (single-tenancy)
  useEffect(() => {
    if (!initialized) {
      loadProducts();
    }
  }, [initialized]);

  /**
   * Loads all products (single-tenancy)
   * Used during initialization and can be called manually if needed
   */
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setAppLoading(true);

      console.log('Loading all products');
      const result = await fetchAllProducts();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load products');
      }

      // The data is already processed by fetchAllProducts
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
   * Creates a new product (single-tenancy)
   */
  const handleProductCreate = useCallback(async (productData) => {
    try {
      setLoading(true);
      setError(null);

      const result = await createProduct(productData);

      if (!result.success) {
        throw new Error(result.error || 'Failed to create product');
      }

      // Update local state by reloading products
      await loadProducts();

      return result;
    } catch (err) {
      setError(err.message);
      console.error('Error creating product:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [loadProducts]);

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

      // Update local state by reloading products
      await loadProducts();

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
  }, [selectedProduct, setSelectedProduct, loadProducts]);

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

      // Update local state by reloading products
      await loadProducts();

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
  }, [selectedProduct, setSelectedProduct, loadProducts]);

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
    loadProducts,
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