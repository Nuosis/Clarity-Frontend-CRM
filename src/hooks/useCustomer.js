import { useState, useCallback, useEffect } from 'react';
import {
    fetchCustomers,
    fetchCustomerById,
    updateCustomer,
    createCustomer,
    toggleCustomerStatus,
    deleteCustomer,
} from '../api';
import {
    processCustomerData,
    sortCustomers,
    validateCustomerData,
    formatCustomerForFileMaker,
    calculateCustomerStats
} from '../services';
import { useSupabaseCustomer } from './useSupabaseCustomer';
import { useAppState } from '../context/AppStateContext';

/**
 * Hook for managing customer state and operations
 */
export function useCustomer() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [stats, setStats] = useState(null);
    const { updateCustomerInSupabase } = useSupabaseCustomer();
    const { user } = useAppState();

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

            // 1. Update customer in FileMaker first
            const result = await updateCustomer(customerId, formattedData);
            console.log('FileMaker customer updated:', result);

            // 2. Update customer in Supabase after successful FileMaker update
            if (user && user.supabaseOrgID) {
                try {
                    const supabaseCustomerData = {
                        Name: customerData.name || customerData.Name,
                        Email: customerData.email || customerData.Email,
                        Phone: customerData.phone || customerData.Phone,
                        Address: customerData.Address,
                        City: customerData.City,
                        State: customerData.State,
                        PostalCode: customerData.PostalCode,
                        Country: customerData.Country
                    };

                    const supabaseResult = await updateCustomerInSupabase(customerId, supabaseCustomerData, user);
                    if (supabaseResult && supabaseResult.success) {
                        console.log('Supabase customer updated:', supabaseResult.message);
                    } else {
                        console.warn('Failed to update customer in Supabase:', supabaseResult?.error);
                        // Don't fail the entire operation if Supabase update fails
                    }
                } catch (supabaseError) {
                    console.error('Error updating customer in Supabase:', supabaseError);
                    // Don't fail the entire operation if Supabase update fails
                }
            }

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
    }, [selectedCustomer, user, updateCustomerInSupabase]);

    /**
     * Toggles customer active status
     */
    const handleCustomerStatusToggle = useCallback(async (recordId, active) => {
        try {
            setLoading(true);
            setError(null);
            
            console.log(`Toggling customer status with recordId: ${recordId}, active: ${active}`);
            const result = await toggleCustomerStatus(recordId, active);
            
            // Update local state - find customer by recordId
            setCustomers(prevCustomers =>
                prevCustomers.map(customer =>
                    customer.recordId === recordId
                        ? { ...customer, isActive: active }
                        : customer
                )
            );
            
            // Update selected customer if it's the one being toggled
            if (selectedCustomer?.recordId === recordId) {
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

    /**
     * Deletes a customer
     */
    const handleCustomerDelete = useCallback(async (recordId) => {
        try {
            setLoading(true);
            setError(null);
            
            console.log(`Deleting customer with recordId: ${recordId}`);
            const result = await deleteCustomer(recordId);
            
            // Update local state - filter by recordId
            setCustomers(prevCustomers =>
                prevCustomers.filter(customer => customer.recordId !== recordId)
            );
            
            // Clear selected customer if it's the one being deleted
            if (selectedCustomer?.recordId === recordId) {
                setSelectedCustomer(null);
            }
            
            return result;
        } catch (err) {
            setError(err.message);
            console.error('Error deleting customer:', err);
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
        handleCustomerDelete,
        
        // Utility functions
        clearError: () => setError(null),
        clearSelectedCustomer: () => setSelectedCustomer(null)
    };
}