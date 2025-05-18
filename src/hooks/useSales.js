import { useState, useCallback, useEffect } from 'react';
import { useAppState, useAppStateOperations } from '../context/AppStateContext';
import {
  fetchSalesByOrganization,
  fetchSalesByCustomer,
  fetchUnbilledSalesByOrganization,
  fetchUnbilledSalesByCustomer,
  fetchCurrentMonthSalesByOrganization,
  fetchCurrentMonthSalesByCustomer,
  createSale,
  updateSale,
  deleteSale,
  formatSaleForDisplay,
  calculateSalesStats
} from '../services/salesService';

/**
 * Hook for managing sales state and operations
 * Handles initialization of sales during app startup
 */
export function useSales() {
  const { user, sales: stateSales, selectedSale, selectedCustomer } = useAppState();
  const { setSales, setSelectedSale, setLoading: setAppLoading, setError: setAppError } = useAppStateOperations();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [initialized, setInitialized] = useState(false);

  // Update stats when sales change
  useEffect(() => {
    if (stateSales && stateSales.length > 0) {
      setStats(calculateSalesStats(stateSales));
    } else {
      setStats({
        total: 0,
        totalAmount: 0,
        averageAmount: 0,
        minAmount: 0,
        maxAmount: 0
      });
    }
  }, [stateSales]);

  // Auto-initialize sales when user changes and has an organization ID
  useEffect(() => {
    if (user?.supabaseOrgID && !initialized) {
      loadSalesForOrganization(user.supabaseOrgID);
    }
  }, [user?.supabaseOrgID, initialized]);

  /**
   * Loads unbilled sales for a specific organization
   * Used during initialization and can be called manually if needed
   */
  const loadSalesForOrganization = useCallback(async (organizationId) => {
    if (!organizationId) {
      console.warn('Cannot load sales: Organization ID is missing');
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
      
      console.log(`Loading unbilled sales for organization: ${organizationId}`);
      const result = await fetchUnbilledSalesByOrganization(organizationId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load sales');
      }
      
      // The data is already processed by fetchUnbilledSalesByOrganization
      const salesData = result.data || [];
      
      // Update the app state with the sales
      setSales(salesData);
      setInitialized(true);
      
      return {
        success: true,
        data: salesData
      };
    } catch (err) {
      console.error('Error loading sales:', err);
      setError(err.message);
      setAppError(`Failed to load sales: ${err.message}`);
      return {
        success: false,
        error: err.message,
        data: []
      };
    } finally {
      setLoading(false);
      setAppLoading(false);
    }
  }, [setSales, setAppLoading, setAppError]);

  /**
   * Loads all sales for a specific organization
   * Can be called manually when all sales data is needed
   */
  const loadAllSalesForOrganization = useCallback(async (organizationId) => {
    if (!organizationId) {
      console.warn('Cannot load all sales: Organization ID is missing');
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
      
      console.log(`Loading all sales for organization: ${organizationId}`);
      const result = await fetchSalesByOrganization(organizationId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load all sales');
      }
      
      // The data is already processed by fetchSalesByOrganization
      const salesData = result.data || [];
      
      // Update the app state with the sales
      setSales(salesData);
      
      return {
        success: true,
        data: salesData
      };
    } catch (err) {
      console.error('Error loading all sales:', err);
      setError(err.message);
      setAppError(`Failed to load all sales: ${err.message}`);
      return {
        success: false,
        error: err.message,
        data: []
      };
    } finally {
      setLoading(false);
      setAppLoading(false);
    }
  }, [setSales, setAppLoading, setAppError]);

  /**
   * Loads sales for a specific customer
   */
  const loadSalesForCustomer = useCallback(async (customerId) => {
    if (!customerId) {
      console.warn('Cannot load sales: Customer ID is missing');
      return {
        success: false,
        error: 'Customer ID is required',
        data: []
      };
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log(`Loading sales for customer: ${customerId}`);
      const result = await fetchSalesByCustomer(customerId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load sales');
      }
      
      // The data is already processed by fetchSalesByCustomer
      const salesData = result.data || [];
      
      // Update the app state with the sales
      setSales(salesData);
      
      return {
        success: true,
        data: salesData
      };
    } catch (err) {
      console.error('Error loading sales for customer:', err);
      setError(err.message);
      return {
        success: false,
        error: err.message,
        data: []
      };
    } finally {
      setLoading(false);
    }
  }, [setSales]);

  /**
   * Loads unbilled sales (null inv_id) for a specific organization
   */
  const loadUnbilledSalesForOrganization = useCallback(async (organizationId) => {
    if (!organizationId) {
      console.warn('Cannot load unbilled sales: Organization ID is missing');
      return {
        success: false,
        error: 'Organization ID is required',
        data: []
      };
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log(`Loading unbilled sales for organization: ${organizationId}`);
      const result = await fetchUnbilledSalesByOrganization(organizationId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load unbilled sales');
      }
      
      // The data is already processed by fetchUnbilledSalesByOrganization
      const salesData = result.data || [];
      
      // Update the app state with the sales
      setSales(salesData);
      
      return {
        success: true,
        data: salesData
      };
    } catch (err) {
      console.error('Error loading unbilled sales:', err);
      setError(err.message);
      return {
        success: false,
        error: err.message,
        data: []
      };
    } finally {
      setLoading(false);
    }
  }, [setSales]);

  /**
   * Loads current month sales for a specific organization
   */
  const loadCurrentMonthSalesForOrganization = useCallback(async (organizationId) => {
    if (!organizationId) {
      console.warn('Cannot load current month sales: Organization ID is missing');
      return {
        success: false,
        error: 'Organization ID is required',
        data: []
      };
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log(`Loading current month sales for organization: ${organizationId}`);
      const result = await fetchCurrentMonthSalesByOrganization(organizationId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load current month sales');
      }
      
      // The data is already processed by fetchCurrentMonthSalesByOrganization
      const salesData = result.data || [];
      
      // Update the app state with the sales
      setSales(salesData);
      
      return {
        success: true,
        data: salesData
      };
    } catch (err) {
      console.error('Error loading current month sales:', err);
      setError(err.message);
      return {
        success: false,
        error: err.message,
        data: []
      };
    } finally {
      setLoading(false);
    }
  }, [setSales]);

  /**
   * Loads unbilled sales (null inv_id) for a specific customer
   */
  const loadUnbilledSalesForCustomer = useCallback(async (customerId) => {
    if (!customerId) {
      console.warn('Cannot load unbilled sales: Customer ID is missing');
      return {
        success: false,
        error: 'Customer ID is required',
        data: []
      };
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log(`Loading unbilled sales for customer: ${customerId}`);
      const result = await fetchUnbilledSalesByCustomer(customerId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load unbilled sales');
      }
      
      // The data is already processed by fetchUnbilledSalesByCustomer
      const salesData = result.data || [];
      
      // Update the app state with the sales
      setSales(salesData);
      
      return {
        success: true,
        data: salesData
      };
    } catch (err) {
      console.error('Error loading unbilled sales for customer:', err);
      setError(err.message);
      return {
        success: false,
        error: err.message,
        data: []
      };
    } finally {
      setLoading(false);
    }
  }, [setSales]);

  /**
   * Loads current month sales for a specific customer
   */
  const loadCurrentMonthSalesForCustomer = useCallback(async (customerId) => {
    if (!customerId) {
      console.warn('Cannot load current month sales: Customer ID is missing');
      return {
        success: false,
        error: 'Customer ID is required',
        data: []
      };
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log(`Loading current month sales for customer: ${customerId}`);
      const result = await fetchCurrentMonthSalesByCustomer(customerId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load current month sales');
      }
      
      // The data is already processed by fetchCurrentMonthSalesByCustomer
      const salesData = result.data || [];
      
      // Update the app state with the sales
      setSales(salesData);
      
      return {
        success: true,
        data: salesData
      };
    } catch (err) {
      console.error('Error loading current month sales for customer:', err);
      setError(err.message);
      return {
        success: false,
        error: err.message,
        data: []
      };
    } finally {
      setLoading(false);
    }
  }, [setSales]);

  /**
   * Selects a sale
   */
  const handleSaleSelect = useCallback((saleId) => {
    if (!stateSales || stateSales.length === 0) {
      setError('No sales available');
      return;
    }

    const sale = stateSales.find(s => s.id === saleId);
    if (sale) {
      setSelectedSale(sale);
    } else {
      setError(`Sale with ID ${saleId} not found`);
    }
  }, [stateSales, setSelectedSale]);

  /**
   * Creates a new sale
   */
  const handleSaleCreate = useCallback(async (saleData) => {
    if (!user?.supabaseOrgID) {
      const error = 'Cannot create sale: Organization ID is missing';
      setError(error);
      return { success: false, error };
    }

    try {
      setLoading(true);
      setError(null);
      
      // Ensure organization_id is set
      const saleWithOrg = {
        ...saleData,
        organization_id: user.supabaseOrgID
      };
      
      const result = await createSale(saleWithOrg);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create sale');
      }
      
      // Update local state by reloading sales
      if (selectedCustomer) {
        await loadSalesForCustomer(selectedCustomer.id);
      } else {
        await loadSalesForOrganization(user.supabaseOrgID);
      }
      
      return result;
    } catch (err) {
      setError(err.message);
      console.error('Error creating sale:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [user, selectedCustomer, loadSalesForOrganization, loadSalesForCustomer]);

  /**
   * Updates an existing sale
   */
  const handleSaleUpdate = useCallback(async (saleId, saleData) => {
    if (!saleId) {
      const error = 'Sale ID is required';
      setError(error);
      return { success: false, error };
    }

    try {
      setLoading(true);
      setError(null);
      
      const result = await updateSale(saleId, saleData);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update sale');
      }
      
      // Update local state
      if (selectedCustomer) {
        await loadSalesForCustomer(selectedCustomer.id);
      } else if (user?.supabaseOrgID) {
        await loadSalesForOrganization(user.supabaseOrgID);
      } else {
        // Fallback if no organization ID is available
        setSales(prevSales => 
          prevSales.map(sale => 
            sale.id === saleId
              ? { ...sale, ...saleData }
              : sale
          )
        );
      }
      
      // Update selected sale if it's the one being updated
      if (selectedSale?.id === saleId) {
        setSelectedSale({ ...selectedSale, ...saleData });
      }
      
      return result;
    } catch (err) {
      setError(err.message);
      console.error('Error updating sale:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [user, selectedCustomer, selectedSale, setSales, setSelectedSale, loadSalesForOrganization, loadSalesForCustomer]);

  /**
   * Deletes a sale
   */
  const handleSaleDelete = useCallback(async (saleId) => {
    if (!saleId) {
      const error = 'Sale ID is required';
      setError(error);
      return { success: false, error };
    }

    try {
      setLoading(true);
      setError(null);
      
      const result = await deleteSale(saleId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete sale');
      }
      
      // Update local state
      if (selectedCustomer) {
        await loadSalesForCustomer(selectedCustomer.id);
      } else if (user?.supabaseOrgID) {
        await loadSalesForOrganization(user.supabaseOrgID);
      } else {
        // Fallback if no organization ID is available
        setSales(prevSales => 
          prevSales.filter(sale => sale.id !== saleId)
        );
      }
      
      // Clear selected sale if it's the one being deleted
      if (selectedSale?.id === saleId) {
        setSelectedSale(null);
      }
      
      return result;
    } catch (err) {
      setError(err.message);
      console.error('Error deleting sale:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [user, selectedCustomer, selectedSale, setSales, setSelectedSale, loadSalesForOrganization, loadSalesForCustomer]);

  /**
   * Formats a sale for display
   */
  const formatSale = useCallback((sale) => {
    return formatSaleForDisplay(sale);
  }, []);

  return {
    // State
    loading,
    error,
    sales: stateSales || [],
    selectedSale,
    stats,
    initialized,
    
    // Actions
    loadSalesForOrganization,
    loadAllSalesForOrganization,
    loadSalesForCustomer,
    loadUnbilledSalesForOrganization,
    loadUnbilledSalesForCustomer,
    loadCurrentMonthSalesForOrganization,
    loadCurrentMonthSalesForCustomer,
    handleSaleSelect,
    handleSaleCreate,
    handleSaleUpdate,
    handleSaleDelete,
    
    // Utility functions
    formatSale,
    clearError: () => setError(null),
    clearSelectedSale: () => setSelectedSale(null)
  };
}