import { fetchDataFromFileMaker } from '../api/fileMaker';
import { query } from './supabaseService';
import { loadAllProductsToState } from './productService';
// Note: We don't directly import useProducts here since hooks can only be used in React components

const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff delays in ms

class InitializationService {
    constructor() {
        this.currentPhase = 'idle';
        this.retryCount = 0;
    }

    async waitForFileMaker(checkReadyFn, maxRetries = 5) {
        this.currentPhase = 'connecting';
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                if (checkReadyFn()) {
                    return true;
                }
                await this.delay(RETRY_DELAYS[i]);
            } catch (error) {
                console.error('FileMaker connection attempt failed:', error);
                if (i === maxRetries - 1) {
                    throw new Error('Failed to connect to FileMaker after multiple attempts');
                }
            }
        }
        return false;
    }

    async loadUserContext() {
        this.currentPhase = 'loading_user';
        // console.log('[InitializationService] Loading user context...');
        try {
            const userContext = await fetchDataFromFileMaker({
                action: 'returnContext'
            });
            // console.log('[InitializationService] User context loaded:', userContext);
            return userContext;
        } catch (error) {
            throw new Error(`Failed to load user context: ${error.message}`);
        }
    }

    async preloadData(loadCustomers) {
        this.currentPhase = 'preloading_data';
        try {
            await loadCustomers();
        } catch (error) {
            throw new Error(`Failed to preload data: ${error.message}`);
        }
    }

    /**
     * Retrieves the Supabase user_id for the current user by querying the database
     * @param {Object} user - The user object containing email
     * @param {Function} setUser - Function to update the user state
     * @returns {Promise<string|null>} - The Supabase user_id or null if not found
     */
    async fetchSupabaseUserId(user, setUser) {
        if (!user || !user.userEmail) {
            console.error('Cannot fetch Supabase user ID: User or user email is missing');
            return null;
        }

        this.currentPhase = 'fetching_supabase_user_id';
        try {
            console.log(`Fetching Supabase user ID for email: ${user.userEmail}`);
            
            // Use adminQuery to bypass RLS restrictions
            // Query the customer_email table to find the customer with matching email
            const emailResult = await query('customer_email', {
                select: 'customer_id',
                eq: {
                    column: 'email',
                    value: user.userEmail
                }
            });

            console.log('Email query result:', emailResult);

            if (!emailResult.success || !emailResult.data || emailResult.data.length === 0) {
                console.error('No customer found with the provided email:', user.userEmail);
                return null;
            }

            // Parse the customer_id if it's a stringified JSON
            let customerId;
            try {
                const customerIdData = emailResult.data[0].customer_id;
                customerId = typeof customerIdData === 'string' && customerIdData.startsWith('{')
                    ? JSON.parse(customerIdData)
                    : customerIdData;
            } catch (e) {
                // If parsing fails, use the original value
                customerId = emailResult.data[0].customer_id;
            }
            console.log(`Found customer ID: ${customerId}`);

            // Query the customer_user table to get the user_id for this customer
            const userResult = await query('customer_user', {
                select: 'user_id',
                eq: {
                    column: 'customer_id',
                    value: customerId
                }
            });

            if (!userResult.success || !userResult.data || userResult.data.length === 0) {
                console.error('No user mapping found for customer ID:', customerId);
                return null;
            }

            // Parse the user_id if it's a stringified JSON
            let supabaseUserId;
            try {
                const userIdData = userResult.data[0].user_id;
                supabaseUserId = typeof userIdData === 'string' && userIdData.startsWith('{')
                    ? JSON.parse(userIdData)
                    : userIdData;
            } catch (e) {
                // If parsing fails, use the original value
                supabaseUserId = userResult.data[0].user_id;
            }
            console.log(`Found Supabase user ID: ${supabaseUserId}`);

            // Query the customer_organization table to get the organization_id for this customer
            const orgResult = await query('customer_organization', {
                select: 'organization_id',
                eq: {
                    column: 'customer_id',
                    value: customerId
                }
            });

            // Parse the organization_id if it's a stringified JSON
            let supabaseOrgId = null;
            if (orgResult.success && orgResult.data && orgResult.data.length > 0) {
                try {
                    const orgIdData = orgResult.data[0].organization_id;
                    supabaseOrgId = typeof orgIdData === 'string' && orgIdData.startsWith('{')
                        ? JSON.parse(orgIdData)
                        : orgIdData;
                    console.log(`Found Supabase organization ID: ${supabaseOrgId}`);
                } catch (e) {
                    // If parsing fails, use the original value
                    supabaseOrgId = orgResult.data[0].organization_id;
                }
            } else {
                console.warn('No organization mapping found for customer ID:', customerId);
            }

            // Update the user state with the Supabase user ID and organization ID
            if (setUser && supabaseUserId) {
                const updatedUser = {
                    ...user,
                    supabaseUserID: supabaseUserId,
                    supabaseOrgID: supabaseOrgId
                };
                
                console.log('[InitializationService] Setting user with organization ID:', {
                    originalUser: user,
                    supabaseUserId,
                    supabaseOrgId,
                    updatedUser,
                    hasOrgId: !!supabaseOrgId
                });
                
                setUser(updatedUser);
            } else {
                console.log('[InitializationService] Not setting user - missing data:', {
                    hasSetUser: !!setUser,
                    hasSupabaseUserId: !!supabaseUserId,
                    supabaseOrgId
                });
            }

            return { supabaseUserId, supabaseOrgId };
        } catch (error) {
            console.error('Error fetching Supabase user ID:', error);
            return null;
        }
    }

    /**
     * Loads products for the current user's organization
     * @param {string} organizationId - The organization ID to load products for
     * @param {Function} setProducts - Function to update the products state
     * @param {Function} setLoading - Function to update the loading state
     * @param {Function} setError - Function to update the error state
     * @returns {Promise<Object>} - Object containing success status and products data
     */
    /**
     * Loads all products (single-tenancy)
     * This method is kept for backward compatibility
     * New components should use the useProducts hook directly
     *
     * @param {Function} setProducts - Function to update the products state
     * @param {Function} setLoading - Function to update the loading state
     * @param {Function} setError - Function to update the error state
     * @returns {Promise<Object>} - Object containing success status and products data
     */
    async loadProducts(setProducts, setLoading, setError) {
        this.currentPhase = 'loading_products';
        try {
            console.log('Loading all products (single-tenancy)');
            // The useProducts hook will handle this more gracefully in React components,
            // but we keep this method for backward compatibility
            return await loadAllProductsToState(setProducts, setLoading, setError);
        } catch (error) {
            console.error('Error loading products:', error);
            if (setError) {
                setError(`Failed to load products: ${error.message}`);
            }
            return {
                success: false,
                error: error.message,
                data: []
            };
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getCurrentPhase() {
        return this.currentPhase;
    }

    reset() {
        this.currentPhase = 'idle';
        this.retryCount = 0;
    }
}

export const initializationService = new InitializationService();