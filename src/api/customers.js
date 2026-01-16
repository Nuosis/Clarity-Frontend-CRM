import { dataService, getEnvironmentContext, ENVIRONMENT_TYPES } from '../services/dataService';
import { handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';
import {
    withErrorHandling,
    checkOrganizationScope,
    CustomerErrorCodes,
    CustomerError
} from '../errors/customerErrors';

/**
 * Normalize customer data based on environment
 * @param {Object} data - Raw customer data from either environment
 * @param {string} environment - Environment type
 * @returns {Object} Normalized customer data
 */
function normalizeCustomerData(data, environment) {
    if (environment === ENVIRONMENT_TYPES.FILEMAKER) {
        // FileMaker data is already in expected format
        return data;
    }

    // Backend API data - normalize to FileMaker-compatible format
    if (Array.isArray(data)) {
        return data.map(customer => ({
            id: customer.id || customer.__ID,
            __ID: customer.id || customer.__ID,
            ...customer
        }));
    }

    return {
        id: data.id || data.__ID,
        __ID: data.id || data.__ID,
        ...data
    };
}

/**
 * Fetches all customers (environment-aware)
 * @param {Object} options - Fetch options
 * @param {number} options.limit - Number of records per page (default: 50, max: 200)
 * @param {number} options.offset - Pagination offset (default: 0)
 * @param {boolean} options.active - Filter by active status (optional)
 * @param {string} options.search - Search by business name (optional)
 * @param {string} options.sort - Sort field (default: 'business_name')
 * @param {string} options.order - Sort order ('asc' or 'desc')
 * @param {boolean} options.include_related - Include nested emails/phones/addresses
 * @returns {Promise<Object>} Customer list with pagination
 */
export async function fetchCustomers(options = {}) {
    return withErrorHandling(async () => {
        const env = getEnvironmentContext();

        // Check organization scope for web app environment
        if (env.type === ENVIRONMENT_TYPES.WEBAPP) {
            checkOrganizationScope(env, 'fetchCustomers');
        }

        if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
            // FileMaker environment - use legacy method (no pagination)
            return handleFileMakerOperation(async () => {
                const params = {
                    layout: Layouts.CUSTOMERS,
                    action: Actions.READ,
                    query: [{ "__ID": "*" }]
                };

                return await dataService.request(params);
            });
        } else {
            // Web app environment - use backend API with pagination
            const queryParams = {
                limit: options.limit || 50,
                offset: options.offset || 0,
                include_related: options.include_related !== false // Default true
            };

            // Add optional filters
            if (options.active !== undefined) {
                queryParams.active = options.active;
            }
            if (options.search) {
                queryParams.search = options.search;
            }
            if (options.sort) {
                queryParams.sort = options.sort;
            }
            if (options.order) {
                queryParams.order = options.order;
            }

            const response = await dataService.get('/api/customers', { params: queryParams });
            return normalizeCustomerData(response.data || response, env.type);
        }
    }, 'fetchCustomers', { options });
}

/**
 * Fetches a specific customer by ID (environment-aware)
 * @param {string} customerId - The customer ID
 * @returns {Promise<Object>} Customer record
 */
export async function fetchCustomerById(customerId) {
    return withErrorHandling(async () => {
        validateParams({ customerId }, ['customerId']);
        const env = getEnvironmentContext();

        // Check organization scope for web app environment
        if (env.type === ENVIRONMENT_TYPES.WEBAPP) {
            checkOrganizationScope(env, 'fetchCustomerById');
        }

        if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
            // FileMaker environment
            return handleFileMakerOperation(async () => {
                const params = {
                    layout: Layouts.CUSTOMERS,
                    action: Actions.READ,
                    query: [{ "__ID": customerId }]
                };

                return await dataService.request(params);
            });
        } else {
            // Web app environment
            const response = await dataService.get(`/api/customers/${customerId}`);
            return normalizeCustomerData(response.data || response, env.type);
        }
    }, 'fetchCustomerById', { customerId });
}

/**
 * Updates a customer record (environment-aware)
 * @param {string} customerId - The customer ID
 * @param {Object} data - The data to update
 * @returns {Promise<Object>} Updated customer record
 */
export async function updateCustomer(customerId, data) {
    return withErrorHandling(async () => {
        validateParams({ customerId, data }, ['customerId', 'data']);
        const env = getEnvironmentContext();

        // Check organization scope for web app environment
        if (env.type === ENVIRONMENT_TYPES.WEBAPP) {
            checkOrganizationScope(env, 'updateCustomer');
        }

        if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
            // FileMaker environment
            return handleFileMakerOperation(async () => {
                const params = {
                    layout: Layouts.CUSTOMERS,
                    action: Actions.UPDATE,
                    recordId: customerId,
                    fieldData: data
                };

                return await dataService.request(params);
            });
        } else {
            // Web app environment
            const response = await dataService.patch(`/api/customers/${customerId}`, data);
            return normalizeCustomerData(response.data || response, env.type);
        }
    }, 'updateCustomer', { customerId, dataKeys: Object.keys(data) });
}

/**
 * Creates a new customer record (environment-aware)
 * @param {Object} data - The customer data
 * @returns {Promise<Object>} Created customer record
 */
export async function createCustomer(data) {
    return withErrorHandling(async () => {
        validateParams({ data }, ['data']);
        const env = getEnvironmentContext();

        // Check organization scope for web app environment
        if (env.type === ENVIRONMENT_TYPES.WEBAPP) {
            checkOrganizationScope(env, 'createCustomer');
        }

        if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
            // FileMaker environment
            return handleFileMakerOperation(async () => {
                const params = {
                    layout: Layouts.CUSTOMERS,
                    action: Actions.CREATE,
                    fieldData: data
                };

                return await dataService.request(params);
            });
        } else {
            // Web app environment
            const response = await dataService.post('/api/customers', data);
            return normalizeCustomerData(response.data || response, env.type);
        }
    }, 'createCustomer', { dataKeys: Object.keys(data) });
}

/**
 * Toggles customer active status (environment-aware)
 * @param {string} customerId - The customer ID
 * @param {boolean} active - The new active status
 * @returns {Promise<Object>} Updated customer record
 */
export async function toggleCustomerStatus(customerId, active) {
    return withErrorHandling(async () => {
        validateParams({ customerId }, ['customerId']);
        const env = getEnvironmentContext();

        // Check organization scope for web app environment
        if (env.type === ENVIRONMENT_TYPES.WEBAPP) {
            checkOrganizationScope(env, 'toggleCustomerStatus');
        }

        if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
            // FileMaker environment
            return handleFileMakerOperation(async () => {
                const params = {
                    layout: Layouts.CUSTOMERS,
                    action: Actions.UPDATE,
                    recordId: customerId,
                    fieldData: {
                        f_active: active ? "1" : "0"
                    }
                };

                return await dataService.request(params);
            });
        } else {
            // Web app environment
            const response = await dataService.patch(`/api/customers/${customerId}/status`, {
                is_active: active
            });
            return normalizeCustomerData(response.data || response, env.type);
        }
    }, 'toggleCustomerStatus', { customerId, active });
}

/**
 * Fetches active customers (environment-aware)
 * @returns {Promise<Array>} Array of active customer records
 */
export async function fetchActiveCustomers() {
    return withErrorHandling(async () => {
        const env = getEnvironmentContext();

        // Check organization scope for web app environment
        if (env.type === ENVIRONMENT_TYPES.WEBAPP) {
            checkOrganizationScope(env, 'fetchActiveCustomers');
        }

        if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
            // FileMaker environment
            return handleFileMakerOperation(async () => {
                const params = {
                    layout: Layouts.CUSTOMERS,
                    action: Actions.READ,
                    query: [{ "f_active": "1" }]
                };

                return await dataService.request(params);
            });
        } else {
            // Web app environment
            const response = await dataService.get('/api/customers', { params: { active: true } });
            return normalizeCustomerData(response.data || response, env.type);
        }
    }, 'fetchActiveCustomers');
}

/**
 * Deletes a customer record (environment-aware)
 * @param {string} customerId - The customer ID
 * @returns {Promise<Object>} Result of the delete operation
 */
export async function deleteCustomer(customerId) {
    return withErrorHandling(async () => {
        validateParams({ customerId }, ['customerId']);
        const env = getEnvironmentContext();

        // Check organization scope for web app environment
        if (env.type === ENVIRONMENT_TYPES.WEBAPP) {
            checkOrganizationScope(env, 'deleteCustomer');
        }

        if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
            // FileMaker environment
            return handleFileMakerOperation(async () => {
                const params = {
                    layout: Layouts.CUSTOMERS,
                    action: Actions.DELETE,
                    recordId: customerId
                };

                return await dataService.request(params);
            });
        } else {
            // Web app environment
            const response = await dataService.delete(`/api/customers/${customerId}`);
            return response.data || response;
        }
    }, 'deleteCustomer', { customerId });
}

/**
 * Searches customers by query string (environment-aware)
 * @param {string} query - Search query string (min 1 character)
 * @param {Object} options - Search options
 * @param {number} options.limit - Maximum number of results (default: 20, max: 100)
 * @returns {Promise<Array>} Array of matching customer records
 */
export async function searchCustomers(query, options = {}) {
    return withErrorHandling(async () => {
        validateParams({ query }, ['query']);
        const env = getEnvironmentContext();

        // Validate query length
        if (!query || query.trim().length < 1) {
            throw new CustomerError(
                'Search query must be at least 1 character',
                CustomerErrorCodes.VALIDATION_ERROR,
                { query, minLength: 1 }
            );
        }

        // Check organization scope for web app environment
        if (env.type === ENVIRONMENT_TYPES.WEBAPP) {
            checkOrganizationScope(env, 'searchCustomers');
        }

        if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
            // FileMaker environment - fetch all and filter client-side
            const allCustomers = await fetchCustomers();
            const searchTerm = query.toLowerCase().trim();

            // Filter using the same logic as local search
            const filtered = allCustomers.response?.data?.filter(customer => {
                const fieldData = customer.fieldData || {};
                const name = (fieldData.Name || '').toLowerCase();
                const email = (fieldData.Email || '').toLowerCase();
                const phone = (fieldData.Phone || '').toLowerCase();
                const contactPerson = (fieldData.ContactPerson || '').toLowerCase();

                return name.includes(searchTerm) ||
                       email.includes(searchTerm) ||
                       phone.includes(searchTerm) ||
                       contactPerson.includes(searchTerm);
            }) || [];

            // Apply limit if specified
            const limit = options.limit || 20;
            return {
                response: {
                    data: filtered.slice(0, limit)
                }
            };
        } else {
            // Web app environment - use backend search endpoint
            const queryParams = {
                q: query.trim(),
                limit: Math.min(options.limit || 20, 100) // Max 100
            };

            const response = await dataService.get('/api/customers/search', { params: queryParams });
            return normalizeCustomerData(response.data || response, env.type);
        }
    }, 'searchCustomers', { query, options });
}
