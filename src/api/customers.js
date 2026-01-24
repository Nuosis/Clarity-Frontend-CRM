import { dataService, getAuthenticationContext } from '../services/dataService';
import {
    withErrorHandling,
    checkOrganizationScope,
    CustomerErrorCodes,
    CustomerError
} from '../errors/customerErrors';
import { validateUUID } from '../utils/validation';

/**
 * Normalize customer data
 * @param {Object} data - Raw customer data from backend
 * @returns {Object} Normalized customer data
 */
function normalizeCustomerData(data) {
    // Backend API data - normalize to expected format
    if (Array.isArray(data)) {
        return data.map(customer => ({
            ...customer,
            id: customer.id || customer.__ID,
            __ID: customer.__ID || customer.id
        }));
    }

    return {
        ...data,
        id: data.id || data.__ID,
        __ID: data.__ID || data.id
    };
}

/**
 * Fetches all customers
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
        const auth = getAuthenticationContext();

        // Check organization scope
        checkOrganizationScope({ authentication: auth }, 'fetchCustomers');

        // Build query parameters
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
        return normalizeCustomerData(response.data || response);
    }, 'fetchCustomers', { options });
}

/**
 * Fetches only active customers
 * @param {Object} options - Fetch options
 * @param {number} options.limit - Number of records per page (default: 50, max: 200)
 * @param {number} options.offset - Pagination offset (default: 0)
 * @param {string} options.search - Search by business name (optional)
 * @param {string} options.sort - Sort field (default: 'business_name')
 * @param {string} options.order - Sort order ('asc' or 'desc')
 * @param {boolean} options.include_related - Include nested emails/phones/addresses
 * @returns {Promise<Object>} Customer list with pagination
 */
export async function fetchActiveCustomers(options = {}) {
    return withErrorHandling(async () => {
        return fetchCustomers({
            ...options,
            active: true
        });
    }, 'fetchActiveCustomers', { options });
}

/**
 * Fetches a specific customer by ID
 * @param {string} customerId - The customer ID
 * @returns {Promise<Object>} Customer record
 */
export async function fetchCustomerById(customerId) {
    return withErrorHandling(async () => {
        if (!customerId) {
            throw new CustomerError('Customer ID is required', CustomerErrorCodes.MISSING_REQUIRED_FIELD);
        }

        validateUUID(customerId, 'Customer ID');

        const auth = getAuthenticationContext();
        checkOrganizationScope({ authentication: auth }, 'fetchCustomerById');

        const response = await dataService.get(`/api/customers/${customerId}`);
        return normalizeCustomerData(response.data || response);
    }, 'fetchCustomerById', { customerId });
}

/**
 * Updates a customer record
 * @param {string} customerId - The customer ID
 * @param {Object} data - The data to update
 * @returns {Promise<Object>} Updated customer record
 */
export async function updateCustomer(customerId, data) {
    return withErrorHandling(async () => {
        if (!customerId || !data) {
            throw new CustomerError('Customer ID and data are required', CustomerErrorCodes.MISSING_REQUIRED_FIELD);
        }

        validateUUID(customerId, 'Customer ID');

        const auth = getAuthenticationContext();
        checkOrganizationScope({ authentication: auth }, 'updateCustomer');

        const response = await dataService.put(`/api/customers/${customerId}`, data);
        return normalizeCustomerData(response.data || response);
    }, 'updateCustomer', { customerId, data });
}

/**
 * Creates a new customer record
 * @param {Object} data - The customer data
 * @returns {Promise<Object>} Created customer record
 */
export async function createCustomer(data) {
    return withErrorHandling(async () => {
        if (!data) {
            throw new CustomerError('Customer data is required', CustomerErrorCodes.MISSING_REQUIRED_FIELD);
        }

        const auth = getAuthenticationContext();
        checkOrganizationScope({ authentication: auth }, 'createCustomer');

        const response = await dataService.post('/api/customers', data);
        return normalizeCustomerData(response.data || response);
    }, 'createCustomer', { data });
}

/**
 * Deletes a customer record (soft delete)
 * @param {string} customerId - The customer ID
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteCustomer(customerId) {
    return withErrorHandling(async () => {
        if (!customerId) {
            throw new CustomerError('Customer ID is required', CustomerErrorCodes.MISSING_REQUIRED_FIELD);
        }

        validateUUID(customerId, 'Customer ID');

        const auth = getAuthenticationContext();
        checkOrganizationScope({ authentication: auth }, 'deleteCustomer');

        const response = await dataService.delete(`/api/customers/${customerId}`);
        return response.data || response;
    }, 'deleteCustomer', { customerId });
}

/**
 * Toggles customer status (active/inactive)
 * @param {string} customerId - The customer ID
 * @returns {Promise<Object>} Updated customer record
 */
export async function toggleCustomerStatus(customerId) {
    return withErrorHandling(async () => {
        if (!customerId) {
            throw new CustomerError('Customer ID is required', CustomerErrorCodes.MISSING_REQUIRED_FIELD);
        }

        validateUUID(customerId, 'Customer ID');

        const auth = getAuthenticationContext();
        checkOrganizationScope({ authentication: auth }, 'toggleCustomerStatus');

        const response = await dataService.patch(`/api/customers/${customerId}/toggle-status`);
        return normalizeCustomerData(response.data || response);
    }, 'toggleCustomerStatus', { customerId });
}

/**
 * Searches customers by query
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @param {number} options.limit - Number of results (default: 50)
 * @param {number} options.offset - Pagination offset (default: 0)
 * @returns {Promise<Object>} Search results with pagination
 */
export async function searchCustomers(query, options = {}) {
    return withErrorHandling(async () => {
        if (!query) {
            throw new CustomerError('Search query is required', CustomerErrorCodes.MISSING_REQUIRED_FIELD);
        }

        const auth = getAuthenticationContext();
        checkOrganizationScope({ authentication: auth }, 'searchCustomers');

        const queryParams = {
            q: query,
            limit: options.limit || 50,
            offset: options.offset || 0,
            include_related: options.include_related !== false
        };

        const response = await dataService.get('/api/customers/search', { params: queryParams });
        return normalizeCustomerData(response.data || response);
    }, 'searchCustomers', { query, options });
}

/**
 * Fetches customer statistics
 * @returns {Promise<Object>} Customer statistics
 */
export async function fetchCustomerStats() {
    return withErrorHandling(async () => {
        const auth = getAuthenticationContext();
        checkOrganizationScope({ authentication: auth }, 'fetchCustomerStats');

        const response = await dataService.get('/api/customers/stats');
        return response.data || response;
    }, 'fetchCustomerStats');
}
