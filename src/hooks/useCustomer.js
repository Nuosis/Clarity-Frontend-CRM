import { useState, useCallback, useEffect, useRef } from 'react';
import {
    fetchCustomers,
    fetchCustomerById,
    updateCustomer,
    createCustomer,
    toggleCustomerStatus,
    deleteCustomer,
    searchCustomers,
} from '../api';
import {
    processCustomerData,
    processBackendCustomerList,
    processBackendCustomerDetail,
    sortCustomers,
    validateCustomerData,
    formatCustomerForFileMaker,
    calculateCustomerStats,
    transformFileMakerToBackend,
    transformBackendToFileMaker
} from '../services';
import { useSupabaseCustomer } from './useSupabaseCustomer';
import { useAppState } from '../context/AppStateContext';
import { getEnvironmentContext, ENVIRONMENT_TYPES } from '../services/dataService';
import {
    formatErrorForUI,
    parseValidationError,
    CustomerError,
    CustomerErrorCodes
} from '../errors/customerErrors';

/**
 * Hook for managing customer state and operations with backend API integration
 * Supports both FileMaker and web app environments with environment-aware routing
 */
export function useCustomer() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [formattedError, setFormattedError] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [stats, setStats] = useState(null);
    const [pagination, setPagination] = useState({
        total: 0,
        limit: 50,
        offset: 0,
        has_more: false
    });
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const { updateCustomerInSupabase } = useSupabaseCustomer();
    const { user } = useAppState();
    const searchTimeoutRef = useRef(null);

    /**
     * Helper function to set error state with formatting
     * @param {Error} err - Error object
     */
    const setErrorWithFormatting = useCallback((err) => {
        const formatted = formatErrorForUI(err);
        setError(err);
        setFormattedError(formatted);
        console.error('[useCustomer] Error:', {
            raw: err,
            formatted,
            stack: err.stack
        });
    }, []);

    // Update stats when customers change
    useEffect(() => {
        if (customers.length > 0) {
            setStats(calculateCustomerStats(customers));
        }
    }, [customers]);

    /**
     * Loads all customers with pagination support
     * @param {Object} options - Load options
     * @param {number} options.limit - Number of records per page (default: 50, max: 200)
     * @param {number} options.offset - Pagination offset (default: 0)
     * @param {boolean} options.active - Filter by active status (optional)
     * @param {string} options.sort - Sort field (default: 'name')
     * @param {string} options.order - Sort order ('asc' or 'desc')
     */
    const loadCustomers = useCallback(async (options = {}) => {
        try {
            setLoading(true);
            setError(null);

            const env = getEnvironmentContext();
            const result = await fetchCustomers(options);

            let processedCustomers;
            let paginationInfo;

            if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
                // FileMaker environment - use legacy processing
                processedCustomers = processCustomerData(result);
                paginationInfo = {
                    total: processedCustomers.length,
                    limit: processedCustomers.length,
                    offset: 0,
                    has_more: false
                };
            } else {
                // Web app environment - use backend processing with pagination
                const processed = processBackendCustomerList(result);
                processedCustomers = processed.customers;
                paginationInfo = processed.pagination;
            }

            // Apply client-side sorting if needed
            const sortedCustomers = sortCustomers(processedCustomers, {
                field: options.sort || 'name',
                order: options.order || 'asc'
            });

            setCustomers(sortedCustomers);
            setPagination(paginationInfo);
        } catch (err) {
            setErrorWithFormatting(err);
        } finally {
            setLoading(false);
        }
    }, [setErrorWithFormatting]);

    /**
     * Selects a customer by ID and loads full details
     * @param {string} customerId - Customer ID
     * @param {Object} options - Load options
     * @param {boolean} options.include_projects - Include related projects
     * @param {boolean} options.include_tasks - Include related tasks
     */
    const handleCustomerSelect = useCallback(async (customerId, options = {}) => {
        try {
            setLoading(true);
            setError(null);

            const env = getEnvironmentContext();
            const result = await fetchCustomerById(customerId);

            let processedCustomer;

            if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
                // FileMaker environment - use legacy processing
                const processed = processCustomerData(result);
                processedCustomer = processed[0];
            } else {
                // Web app environment - use backend processing
                processedCustomer = processBackendCustomerDetail(result);
            }

            setSelectedCustomer(processedCustomer);
        } catch (err) {
            setErrorWithFormatting(err);
        } finally {
            setLoading(false);
        }
    }, [setErrorWithFormatting]);

    /**
     * Creates a new customer
     * @param {Object} customerData - Customer data to create
     * @returns {Promise<Object>} Created customer record
     */
    const handleCustomerCreate = useCallback(async (customerData) => {
        try {
            setLoading(true);
            setError(null);

            const env = getEnvironmentContext();

            // Validate based on environment format
            const validationFormat = env.type === ENVIRONMENT_TYPES.FILEMAKER ? 'filemaker' : 'backend';
            const validation = validateCustomerData(customerData, validationFormat);
            if (!validation.isValid) {
                throw parseValidationError(validation, env.type === ENVIRONMENT_TYPES.FILEMAKER ? 'createCustomer' : 'updateCustomer');
            }

            let formattedData;
            let result;

            if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
                // FileMaker environment - format for FileMaker
                formattedData = formatCustomerForFileMaker(customerData);
                result = await createCustomer(formattedData);
            } else {
                // Web app environment - send backend format directly
                // API layer will handle the request
                result = await createCustomer(customerData);
            }

            // Reload customers to get updated list
            await loadCustomers();

            return result;
        } catch (err) {
            setErrorWithFormatting(err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [loadCustomers, setErrorWithFormatting]);

    /**
     * Updates an existing customer
     * @param {string} customerId - Customer ID
     * @param {Object} customerData - Customer data to update
     * @returns {Promise<Object>} Updated customer record
     */
    const handleCustomerUpdate = useCallback(async (customerId, customerData) => {
        try {
            setLoading(true);
            setError(null);

            const env = getEnvironmentContext();

            // Validate based on environment format
            const validationFormat = env.type === ENVIRONMENT_TYPES.FILEMAKER ? 'filemaker' : 'backend';
            const validation = validateCustomerData(customerData, validationFormat);
            if (!validation.isValid) {
                throw parseValidationError(validation, env.type === ENVIRONMENT_TYPES.FILEMAKER ? 'createCustomer' : 'updateCustomer');
            }

            let result;

            if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
                // FileMaker environment - format for FileMaker
                const formattedData = formatCustomerForFileMaker(customerData);
                result = await updateCustomer(customerId, formattedData);
                console.log('[useCustomer] FileMaker customer updated:', result);

                // Update customer in Supabase after successful FileMaker update (dual-write)
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
                            console.log('[useCustomer] Supabase customer updated:', supabaseResult.message);
                        } else {
                            console.warn('[useCustomer] Failed to update customer in Supabase:', supabaseResult?.error);
                        }
                    } catch (supabaseError) {
                        console.error('[useCustomer] Error updating customer in Supabase:', supabaseError);
                    }
                }
            } else {
                // Web app environment - send backend format directly
                result = await updateCustomer(customerId, customerData);
                console.log('[useCustomer] Backend customer updated:', result);
            }

            // Update local state
            setCustomers(prevCustomers =>
                prevCustomers.map(customer =>
                    customer.id === customerId || customer.__ID === customerId
                        ? { ...customer, ...customerData }
                        : customer
                )
            );

            // Update selected customer if it's the one being updated
            if (selectedCustomer?.id === customerId || selectedCustomer?.__ID === customerId) {
                setSelectedCustomer(prev => ({ ...prev, ...customerData }));
            }

            return result;
        } catch (err) {
            setErrorWithFormatting(err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [selectedCustomer, user, updateCustomerInSupabase, setErrorWithFormatting]);

    /**
     * Toggles customer active status
     * @param {string} customerId - Customer ID or recordId (for FileMaker)
     * @param {boolean} active - New active status
     * @returns {Promise<Object>} Updated status result
     */
    const handleCustomerStatusToggle = useCallback(async (customerId, active) => {
        try {
            setLoading(true);
            setError(null);

            console.log(`[useCustomer] Toggling customer status: ${customerId}, active: ${active}`);
            const result = await toggleCustomerStatus(customerId, active);

            // Update local state - support both id and recordId for FileMaker compatibility
            setCustomers(prevCustomers =>
                prevCustomers.map(customer =>
                    customer.recordId === customerId || customer.id === customerId || customer.__ID === customerId
                        ? { ...customer, isActive: active, is_active: active, f_active: active ? "1" : "0" }
                        : customer
                )
            );

            // Update selected customer if it's the one being toggled
            if (selectedCustomer?.recordId === customerId ||
                selectedCustomer?.id === customerId ||
                selectedCustomer?.__ID === customerId) {
                setSelectedCustomer(prev => ({
                    ...prev,
                    isActive: active,
                    is_active: active,
                    f_active: active ? "1" : "0"
                }));
            }

            return result;
        } catch (err) {
            setErrorWithFormatting(err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [selectedCustomer, setErrorWithFormatting]);

    /**
     * Deletes a customer
     * @param {string} customerId - Customer ID or recordId (for FileMaker)
     * @param {Object} options - Delete options
     * @param {boolean} options.hard_delete - Permanently delete (default: false, soft delete)
     * @returns {Promise<Object>} Delete result
     */
    const handleCustomerDelete = useCallback(async (customerId, options = {}) => {
        try {
            setLoading(true);
            setError(null);

            console.log(`[useCustomer] Deleting customer: ${customerId}`);
            const result = await deleteCustomer(customerId);

            // Update local state - support both id and recordId for FileMaker compatibility
            setCustomers(prevCustomers =>
                prevCustomers.filter(customer =>
                    customer.recordId !== customerId &&
                    customer.id !== customerId &&
                    customer.__ID !== customerId
                )
            );

            // Clear selected customer if it's the one being deleted
            if (selectedCustomer?.recordId === customerId ||
                selectedCustomer?.id === customerId ||
                selectedCustomer?.__ID === customerId) {
                setSelectedCustomer(null);
            }

            return result;
        } catch (err) {
            setErrorWithFormatting(err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [selectedCustomer, setErrorWithFormatting]);

    /**
     * Searches customers by query string with debouncing
     * @param {string} query - Search query string (min 1 character)
     * @param {Object} options - Search options
     * @param {number} options.limit - Maximum number of results (default: 20, max: 100)
     * @param {number} options.debounceMs - Debounce delay in milliseconds (default: 300)
     * @returns {Promise<void>}
     */
    const handleCustomerSearch = useCallback((query, options = {}) => {
        const { limit = 20, debounceMs = 300 } = options;

        // Clear existing timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // Update search query state immediately for UI feedback
        setSearchQuery(query);

        // If query is empty, clear search results
        if (!query || query.trim().length === 0) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        // Validate minimum query length
        if (query.trim().length < 1) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        // Set searching state
        setIsSearching(true);
        setError(null);

        // Debounce the actual search
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                console.log(`[useCustomer] Searching customers: "${query}"`);
                const result = await searchCustomers(query, { limit });

                const env = getEnvironmentContext();
                let processedResults;

                if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
                    // FileMaker environment - process FileMaker data
                    processedResults = processCustomerData(result);
                } else {
                    // Web app environment - process backend data
                    const processed = processBackendCustomerList(result);
                    processedResults = processed.customers;
                }

                console.log(`[useCustomer] Search returned ${processedResults.length} results`);
                setSearchResults(processedResults);
            } catch (err) {
                setErrorWithFormatting(err);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, debounceMs);
    }, [setErrorWithFormatting]);

    /**
     * Clears search results and query
     */
    const clearSearch = useCallback(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        setSearchQuery('');
        setSearchResults([]);
        setIsSearching(false);
    }, []);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    return {
        // State
        loading,
        error,
        formattedError,
        customers,
        selectedCustomer,
        stats,
        pagination,

        // Search state
        searchResults,
        isSearching,
        searchQuery,

        // Active customers getter
        activeCustomers: customers.filter(customer => customer.isActive || customer.is_active),

        // Actions
        loadCustomers,
        handleCustomerSelect,
        handleCustomerCreate,
        handleCustomerUpdate,
        handleCustomerStatusToggle,
        handleCustomerDelete,
        handleCustomerSearch,
        clearSearch,

        // Utility functions
        clearError: () => {
            setError(null);
            setFormattedError(null);
        },
        clearSelectedCustomer: () => setSelectedCustomer(null),
        setPagination
    };
}