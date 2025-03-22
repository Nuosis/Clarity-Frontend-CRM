import { fetchDataFromFileMaker, handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';

/**
 * Fetches all customers
 * @returns {Promise<Array>} Array of customer records
 */
export async function fetchCustomers() {
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.CUSTOMERS,
            action: Actions.READ,
            query: [{ "__ID": "*" }]
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Fetches a specific customer by ID
 * @param {string} customerId - The customer ID
 * @returns {Promise<Object>} Customer record
 */
export async function fetchCustomerById(customerId) {
    validateParams({ customerId }, ['customerId']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.CUSTOMERS,
            action: Actions.READ,
            query: [{ "__ID": customerId }]
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Updates a customer record
 * @param {string} customerId - The customer ID
 * @param {Object} data - The data to update
 * @returns {Promise<Object>} Updated customer record
 */
export async function updateCustomer(customerId, data) {
    validateParams({ customerId, data }, ['customerId', 'data']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.CUSTOMERS,
            action: Actions.UPDATE,
            recordId: customerId,
            fieldData: data
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Creates a new customer record
 * @param {Object} data - The customer data
 * @returns {Promise<Object>} Created customer record
 */
export async function createCustomer(data) {
    validateParams({ data }, ['data']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.CUSTOMERS,
            action: Actions.CREATE,
            fieldData: data
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Toggles customer active status
 * @param {string} customerId - The customer ID
 * @param {boolean} active - The new active status
 * @returns {Promise<Object>} Updated customer record
 */
export async function toggleCustomerStatus(customerId, active) {
    validateParams({ customerId }, ['customerId']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.CUSTOMERS,
            action: Actions.UPDATE,
            recordId: customerId,
            fieldData: {
                f_active: active ? "1" : "0"
            }
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Fetches active customers
 * @returns {Promise<Array>} Array of active customer records
 */
export async function fetchActiveCustomers() {
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.CUSTOMERS,
            action: Actions.READ,
            query: [{ "f_active": "1" }]
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Deletes a customer record
 * @param {string} customerId - The customer ID
 * @returns {Promise<Object>} Result of the delete operation
 */
export async function deleteCustomer(customerId) {
    validateParams({ customerId }, ['customerId']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.CUSTOMERS,
            action: Actions.DELETE,
            recordId: customerId
        };
        
        return await fetchDataFromFileMaker(params);
    });
}
