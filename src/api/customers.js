import { dataService, getEnvironmentContext, ENVIRONMENT_TYPES } from '../services/dataService';
import { handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';

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
 * @returns {Promise<Array>} Array of customer records
 */
export async function fetchCustomers() {
    const env = getEnvironmentContext();

    try {
        if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
            // FileMaker environment - use legacy method
            return handleFileMakerOperation(async () => {
                const params = {
                    layout: Layouts.CUSTOMERS,
                    action: Actions.READ,
                    query: [{ "__ID": "*" }]
                };

                return await dataService.request(params);
            });
        } else {
            // Web app environment - use backend API
            const response = await dataService.get('/contacts_api');
            return normalizeCustomerData(response.data || response, env.type);
        }
    } catch (error) {
        console.error('[Customers API] fetchCustomers error:', error);
        throw new Error(`Failed to fetch customers: ${error.message}`);
    }
}

/**
 * Fetches a specific customer by ID (environment-aware)
 * @param {string} customerId - The customer ID
 * @returns {Promise<Object>} Customer record
 */
export async function fetchCustomerById(customerId) {
    validateParams({ customerId }, ['customerId']);
    const env = getEnvironmentContext();

    try {
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
            const response = await dataService.get(`/contacts_api/${customerId}`);
            return normalizeCustomerData(response.data || response, env.type);
        }
    } catch (error) {
        console.error('[Customers API] fetchCustomerById error:', error);
        throw new Error(`Failed to fetch customer ${customerId}: ${error.message}`);
    }
}

/**
 * Updates a customer record (environment-aware)
 * @param {string} customerId - The customer ID
 * @param {Object} data - The data to update
 * @returns {Promise<Object>} Updated customer record
 */
export async function updateCustomer(customerId, data) {
    validateParams({ customerId, data }, ['customerId', 'data']);
    const env = getEnvironmentContext();

    try {
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
            const response = await dataService.patch(`/contacts_api/${customerId}`, data);
            return normalizeCustomerData(response.data || response, env.type);
        }
    } catch (error) {
        console.error('[Customers API] updateCustomer error:', error);
        throw new Error(`Failed to update customer ${customerId}: ${error.message}`);
    }
}

/**
 * Creates a new customer record (environment-aware)
 * @param {Object} data - The customer data
 * @returns {Promise<Object>} Created customer record
 */
export async function createCustomer(data) {
    validateParams({ data }, ['data']);
    const env = getEnvironmentContext();

    try {
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
            const response = await dataService.post('/contacts_api', data);
            return normalizeCustomerData(response.data || response, env.type);
        }
    } catch (error) {
        console.error('[Customers API] createCustomer error:', error);
        throw new Error(`Failed to create customer: ${error.message}`);
    }
}

/**
 * Toggles customer active status (environment-aware)
 * @param {string} customerId - The customer ID
 * @param {boolean} active - The new active status
 * @returns {Promise<Object>} Updated customer record
 */
export async function toggleCustomerStatus(customerId, active) {
    validateParams({ customerId }, ['customerId']);
    const env = getEnvironmentContext();

    try {
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
            const response = await dataService.patch(`/contacts_api/${customerId}`, {
                f_active: active ? "1" : "0"
            });
            return normalizeCustomerData(response.data || response, env.type);
        }
    } catch (error) {
        console.error('[Customers API] toggleCustomerStatus error:', error);
        throw new Error(`Failed to toggle customer status for ${customerId}: ${error.message}`);
    }
}

/**
 * Fetches active customers (environment-aware)
 * @returns {Promise<Array>} Array of active customer records
 */
export async function fetchActiveCustomers() {
    const env = getEnvironmentContext();

    try {
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
            const response = await dataService.get('/contacts_api', { f_active: "1" });
            return normalizeCustomerData(response.data || response, env.type);
        }
    } catch (error) {
        console.error('[Customers API] fetchActiveCustomers error:', error);
        throw new Error(`Failed to fetch active customers: ${error.message}`);
    }
}

/**
 * Deletes a customer record (environment-aware)
 * @param {string} customerId - The customer ID
 * @returns {Promise<Object>} Result of the delete operation
 */
export async function deleteCustomer(customerId) {
    validateParams({ customerId }, ['customerId']);
    const env = getEnvironmentContext();

    try {
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
            const response = await dataService.delete(`/contacts_api/${customerId}`);
            return response.data || response;
        }
    } catch (error) {
        console.error('[Customers API] deleteCustomer error:', error);
        throw new Error(`Failed to delete customer ${customerId}: ${error.message}`);
    }
}
