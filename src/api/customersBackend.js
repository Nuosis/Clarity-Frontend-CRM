/**
 * Customers Backend API Client
 *
 * This module provides a clean interface to the backend customer API endpoints.
 * It uses the dataService for automatic authentication and organization scoping.
 *
 * Backend API Endpoints:
 * - GET    /api/customers              - List customers with pagination/filters
 * - POST   /api/customers              - Create a new customer
 * - GET    /api/customers/{id}         - Get customer by ID
 * - PATCH  /api/customers/{id}         - Update customer
 * - DELETE /api/customers/{id}         - Delete customer (soft delete)
 * - POST   /api/customers/batch        - Batch create customers
 * - GET    /api/customers/search       - Search customers
 *
 * Authentication & Authorization:
 * - In web app environment: Uses JWT token from Supabase authentication (via dataService)
 * - In FileMaker environment: Routed through FileMaker bridge (via dataService interceptors)
 * - Organization scoping: All requests automatically filtered by user's organization from JWT
 * - The dataService handles environment detection and proper authentication method
 *
 * All requests automatically include:
 * - Environment-aware authentication (JWT for web app, FileMaker bridge for FileMaker)
 * - Organization scoping from authenticated user context
 * - Proper error handling and validation
 */

import { dataService } from '../services/dataService.js';

const BASE_PATH = '/api/customers';

/**
 * List customers with optional pagination and filters
 *
 * @param {Object} options - Query options
 * @param {number} [options.limit=50] - Maximum number of records (1-200)
 * @param {number} [options.offset=0] - Number of records to skip
 * @param {boolean} [options.active] - Filter by active status
 * @param {string} [options.search] - Search in name, business_name, first_name, last_name
 * @param {boolean} [options.include_related=false] - Include emails, phones, addresses
 * @returns {Promise<Array>} Array of customer objects
 *
 * @example
 * const customers = await listCustomers({ limit: 100, active: true });
 * const searchResults = await listCustomers({ search: 'John', include_related: true });
 */
export async function listCustomers(options = {}) {
  const {
    limit = 50,
    offset = 0,
    active,
    search,
    include_related = false
  } = options;

  const params = {
    limit: Math.min(Math.max(limit, 1), 200),
    offset: Math.max(offset, 0)
  };

  if (active !== undefined) {
    params.active = active;
  }

  if (search) {
    params.search = search;
  }

  if (include_related) {
    params.include_related = include_related;
  }

  const response = await dataService.get(BASE_PATH, params);
  return response;
}

/**
 * Get a single customer by ID
 *
 * @param {string} customerId - Customer UUID
 * @param {Object} options - Query options
 * @param {boolean} [options.include_related=true] - Include emails, phones, addresses
 * @returns {Promise<Object>} Customer object with nested relationships
 * @throws {Error} If customer not found or access denied (404)
 *
 * @example
 * const customer = await getCustomerById('123e4567-e89b-12d3-a456-426614174000');
 * const customerBasic = await getCustomerById(id, { include_related: false });
 */
export async function getCustomerById(customerId, options = {}) {
  if (!customerId) {
    throw new Error('Customer ID is required');
  }

  const { include_related = true } = options;

  const params = {};
  if (include_related !== undefined) {
    params.include_related = include_related;
  }

  const response = await dataService.get(`${BASE_PATH}/${customerId}`, params);
  return response;
}

/**
 * Create a new customer with optional related records
 *
 * @param {Object} customerData - Customer data
 * @param {string} customerData.name - Customer name (required)
 * @param {string} [customerData.business_name] - Business name
 * @param {string} [customerData.first_name] - First name
 * @param {string} [customerData.last_name] - Last name
 * @param {boolean} [customerData.is_active=true] - Active status
 * @param {Array} [customerData.emails] - Array of email objects
 * @param {Array} [customerData.phones] - Array of phone objects
 * @param {Array} [customerData.addresses] - Array of address objects
 * @param {Object} [options] - Create options
 * @param {string} [options.idempotencyKey] - Idempotency key for preventing duplicates
 * @returns {Promise<Object>} Created customer object with all nested relationships
 *
 * @example
 * const customer = await createCustomer({
 *   name: 'Acme Corp',
 *   business_name: 'Acme Corporation',
 *   emails: [{ email: 'contact@acme.com', type: 'work', is_primary: true }],
 *   phones: [{ phone: '+1-555-0100', type: 'office', is_primary: true }],
 *   addresses: [{
 *     street: '123 Main St',
 *     city: 'New York',
 *     state: 'NY',
 *     zip: '10001',
 *     country: 'USA',
 *     type: 'billing'
 *   }]
 * });
 */
export async function createCustomer(customerData, options = {}) {
  if (!customerData || !customerData.name) {
    throw new Error('Customer name is required');
  }

  const headers = {};
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  const response = await dataService.post(BASE_PATH, customerData);
  return response;
}

/**
 * Update an existing customer with partial updates
 *
 * @param {string} customerId - Customer UUID
 * @param {Object} customerData - Updated customer data (partial)
 * @param {string} [customerData.name] - Customer name
 * @param {string} [customerData.business_name] - Business name
 * @param {string} [customerData.first_name] - First name
 * @param {string} [customerData.last_name] - Last name
 * @param {boolean} [customerData.is_active] - Active status
 * @param {Array} [customerData.emails] - Array of email objects (with id to update, without to create)
 * @param {Array} [customerData.phones] - Array of phone objects (with id to update, without to create)
 * @param {Array} [customerData.addresses] - Array of address objects (with id to update, without to create)
 * @returns {Promise<Object>} Updated customer object with all nested relationships
 * @throws {Error} If customer not found or access denied (404)
 *
 * @example
 * // Update just the name
 * await updateCustomer(id, { name: 'New Name' });
 *
 * // Update customer and add a new email
 * await updateCustomer(id, {
 *   name: 'Updated Corp',
 *   emails: [
 *     { id: 'existing-email-id', email: 'updated@example.com' }, // Update existing
 *     { email: 'new@example.com', type: 'work' } // Create new
 *   ]
 * });
 */
export async function updateCustomer(customerId, customerData) {
  if (!customerId) {
    throw new Error('Customer ID is required');
  }

  if (!customerData || Object.keys(customerData).length === 0) {
    throw new Error('Customer data is required');
  }

  const response = await dataService.patch(`${BASE_PATH}/${customerId}`, customerData);
  return response;
}

/**
 * Delete a customer (soft delete - sets is_active to false)
 *
 * @param {string} customerId - Customer UUID
 * @returns {Promise<Object>} Success status
 * @throws {Error} If customer not found or access denied (404)
 *
 * @example
 * await deleteCustomer('123e4567-e89b-12d3-a456-426614174000');
 */
export async function deleteCustomer(customerId) {
  if (!customerId) {
    throw new Error('Customer ID is required');
  }

  const response = await dataService.delete(`${BASE_PATH}/${customerId}`);
  return response;
}

/**
 * Update customer active status
 *
 * @param {string} customerId - Customer UUID
 * @param {boolean} isActive - New active status
 * @returns {Promise<Object>} Updated customer object
 *
 * @example
 * await updateCustomerStatus(id, false); // Deactivate
 * await updateCustomerStatus(id, true);  // Activate
 */
export async function updateCustomerStatus(customerId, isActive) {
  if (!customerId) {
    throw new Error('Customer ID is required');
  }

  return await updateCustomer(customerId, { is_active: isActive });
}

/**
 * Batch create multiple customers
 *
 * @param {Array<Object>} customers - Array of customer data objects
 * @returns {Promise<Object>} Result with created customers and any errors
 *
 * @example
 * const result = await batchCreateCustomers([
 *   { name: 'Customer 1', emails: [{ email: 'c1@example.com' }] },
 *   { name: 'Customer 2', emails: [{ email: 'c2@example.com' }] }
 * ]);
 */
export async function batchCreateCustomers(customers) {
  if (!Array.isArray(customers) || customers.length === 0) {
    throw new Error('Customers array is required and must not be empty');
  }

  const response = await dataService.post(`${BASE_PATH}/batch`, { customers });
  return response;
}

/**
 * Search customers with advanced filters
 *
 * @param {Object} searchParams - Search parameters
 * @param {string} [searchParams.query] - Search query string
 * @param {string} [searchParams.email] - Filter by email
 * @param {string} [searchParams.phone] - Filter by phone
 * @param {boolean} [searchParams.active] - Filter by active status
 * @param {number} [searchParams.limit=50] - Maximum results
 * @param {number} [searchParams.offset=0] - Offset for pagination
 * @returns {Promise<Array>} Array of matching customer objects
 *
 * @example
 * const results = await searchCustomers({ query: 'John Doe', active: true });
 * const emailResults = await searchCustomers({ email: 'john@example.com' });
 */
export async function searchCustomers(searchParams = {}) {
  const params = {
    limit: searchParams.limit || 50,
    offset: searchParams.offset || 0
  };

  if (searchParams.query) {
    params.q = searchParams.query;
  }

  if (searchParams.email) {
    params.email = searchParams.email;
  }

  if (searchParams.phone) {
    params.phone = searchParams.phone;
  }

  if (searchParams.active !== undefined) {
    params.active = searchParams.active;
  }

  const response = await dataService.get(`${BASE_PATH}/search`, params);
  return response;
}

/**
 * Fetch all active customers (convenience method)
 *
 * @param {Object} options - Query options
 * @param {number} [options.limit=50] - Maximum number of records
 * @param {number} [options.offset=0] - Pagination offset
 * @param {boolean} [options.include_related=false] - Include nested relationships
 * @returns {Promise<Array>} Array of active customer objects
 *
 * @example
 * const activeCustomers = await fetchActiveCustomers({ limit: 100 });
 */
export async function fetchActiveCustomers(options = {}) {
  return await listCustomers({
    ...options,
    active: true
  });
}

/**
 * Fetch all customers (alias for listCustomers for backward compatibility)
 *
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of customer objects
 *
 * @example
 * const allCustomers = await fetchCustomers({ limit: 200 });
 */
export async function fetchCustomers(options = {}) {
  return await listCustomers(options);
}

/**
 * Toggle customer active status (convenience method)
 *
 * @param {string} customerId - Customer UUID
 * @param {boolean} active - New active status
 * @returns {Promise<Object>} Updated customer object
 *
 * @example
 * await toggleCustomerStatus(id, false); // Deactivate
 */
export async function toggleCustomerStatus(customerId, active) {
  return await updateCustomerStatus(customerId, active);
}
