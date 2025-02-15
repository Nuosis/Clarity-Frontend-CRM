import { useState, useCallback, useEffect } from 'react';
import {
    fetchCustomers,
    fetchCustomerById,
    updateCustomer,
    createCustomer,
    toggleCustomerStatus,
} from '../api';
import {
    processCustomerData,
    sortCustomers,
    validateCustomerData,
    formatCustomerForFileMaker,
    calculateCustomerStats
} from '../services';

/**
 * Hook for managing customer state and operations
 */
export function useCustomer() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [stats, setStats] = useState(null);

    // Update stats when customers change
    useEffect(() => {
        if (customers.length > 0) {
            setStats(calculateCustomerStats(customers));
        }
    }, [customers]);

    /**
     * Loads all customers
     */
    const loadCustomers = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            const result = await fetchCustomers();
            const processedCustomers = processCustomerData(result);
            const sortedCustomers = sortCustomers(processedCustomers);
            
            setCustomers(sortedCustomers);
        } catch (err) {
            setError(err.message);
            console.error('Error loading customers:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Selects a customer
     */
    const handleCustomerSelect = useCallback(async (customerId) => {
        try {
            setLoading(true);
            setError(null);
            
            const result = await fetchCustomerById(customerId);
            const [processedCustomer] = processCustomerData(result);
            
            setSelectedCustomer(processedCustomer);
        } catch (err) {
            setError(err.message);
            console.error('Error selecting customer:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Creates a new customer
     */
    const handleCustomerCreate = useCallback(async (customerData) => {
        try {
            setLoading(true);
            setError(null);
            
            const validation = validateCustomerData(customerData);
            if (!validation.isValid) {
                throw new Error(validation.errors.join(', '));
            }
            
            const formattedData = formatCustomerForFileMaker(customerData);
            const result = await createCustomer(formattedData);
            
            // Reload customers to get updated list
            await loadCustomers();
            
            return result;
        } catch (err) {
            setError(err.message);
            console.error('Error creating customer:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [loadCustomers]);

    /**
     * Updates an existing customer
     */
    const handleCustomerUpdate = useCallback(async (customerId, customerData) => {
        try {
            setLoading(true);
            setError(null);
            
            const validation = validateCustomerData(customerData);
            if (!validation.isValid) {
                throw new Error(validation.errors.join(', '));
            }
            
            const formattedData = formatCustomerForFileMaker(customerData);
            const result = await updateCustomer(customerId, formattedData);
            
            // Update local state
            setCustomers(prevCustomers => 
                prevCustomers.map(customer => 
                    customer.id === customerId
                        ? { ...customer, ...customerData }
                        : customer
                )
            );
            
            // Update selected customer if it's the one being updated
            if (selectedCustomer?.id === customerId) {
                setSelectedCustomer(prev => ({ ...prev, ...customerData }));
            }
            
            return result;
        } catch (err) {
            setError(err.message);
            console.error('Error updating customer:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [selectedCustomer]);

    /**
     * Toggles customer active status
     */
    const handleCustomerStatusToggle = useCallback(async (customerId, active) => {
        try {
            setLoading(true);
            setError(null);
            
            const result = await toggleCustomerStatus(customerId, active);
            
            // Update local state
            setCustomers(prevCustomers => 
                prevCustomers.map(customer => 
                    customer.id === customerId
                        ? { ...customer, isActive: active }
                        : customer
                )
            );
            
            // Update selected customer if it's the one being toggled
            if (selectedCustomer?.id === customerId) {
                setSelectedCustomer(prev => ({ ...prev, isActive: active }));
            }
            
            return result;
        } catch (err) {
            setError(err.message);
            console.error('Error toggling customer status:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [selectedCustomer]);

    return {
        // State
        loading,
        error,
        customers,
        selectedCustomer,
        stats,
        
        // Active customers getter
        activeCustomers: customers.filter(customer => customer.isActive),
        
        // Actions
        loadCustomers,
        handleCustomerSelect,
        handleCustomerCreate,
        handleCustomerUpdate,
        handleCustomerStatusToggle,
        
        // Utility functions
        clearError: () => setError(null),
        clearSelectedCustomer: () => setSelectedCustomer(null)
    };
}