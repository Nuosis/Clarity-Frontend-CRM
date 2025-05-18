/**
 * QuickBooks Edge Function API Client
 * 
 * This module provides a client for interacting with the QuickBooks Online API
 * through the Supabase Edge Function.
 */

import { supabaseUrl } from '../config';

// Base URL for the edge function
const EDGE_FUNCTION_URL = `${supabaseUrl}/functions/v1/quickbooks-api`;

/**
 * Get the Supabase JWT token from your authentication system
 * This is needed to authenticate requests to the edge function
 */
const getAuthToken = () => {
  // Use the service role key for edge function authentication
  return import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
};

/**
 * Make a request to the QuickBooks API edge function
 * @param {string} endpoint - The endpoint to call
 * @param {string} method - The HTTP method to use
 * @param {Object} data - The data to send (for POST/PUT requests)
 * @returns {Promise<Object>} - The API response
 */
const makeRequest = async (endpoint, method = 'GET', data = null) => {
  const token = getAuthToken();
  
  if (!token) {
    throw new Error('Service role key not available. Check environment variables.');
  }
  
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  if (data && (method === 'POST' || method === 'PUT')) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(data);
  }

  const response = await fetch(`${EDGE_FUNCTION_URL}/${endpoint}`, options);
  return await response.json();
};

/**
 * Company Operations
 */

/**
 * Get company information
 * @returns {Promise<Object>} - The company information
 */
export const getQBOCompanyInfo = async () => {
  return await makeRequest('company');
};

/**
 * Customer Operations
 */

/**
 * List all customers
 * @returns {Promise<Object>} - The list of customers
 */
export const listQBOCustomers = async () => {
  return await makeRequest('customers');
};

/**
 * List customer by display name
 * @param {string} customer - The customer display name
 * @returns {Promise<Object>} - The list of customers
 */
export const listQBOCustomerByName = async (customer) => {
  // Encode the customer name to handle special characters in URLs
  const encodedCustomer = encodeURIComponent(customer);
  return await makeRequest(`customers/${encodedCustomer}`);
};

/**
 * Get a specific customer by ID
 * @param {string} customerId - The customer ID
 * @returns {Promise<Object>} - The customer information
 */
export const getQBOCustomer = async (customerId) => {
  return await makeRequest(`customers/${customerId}`);
};

/**
 * Create a new customer
 * @param {Object} customerData - The customer data
 * @returns {Promise<Object>} - The created customer
 */
export const createQBOCustomer = async (customerData) => {
  return await makeRequest('customers', 'POST', customerData);
};

/**
 * Update an existing customer
 * @param {Object} customerData - The customer data with Id field
 * @returns {Promise<Object>} - The updated customer
 */
export const updateQBOCustomer = async (customerData) => {
  return await makeRequest('customers', 'POST', customerData);
};

/**
 * Invoice Operations
 */

/**
 * List all invoices
 * @returns {Promise<Object>} - The list of invoices
 */
export const listQBOInvoices = async () => {
  return await makeRequest('invoices');
};

/**
 * Get a specific invoice by ID
 * @param {string} invoiceId - The invoice ID
 * @returns {Promise<Object>} - The invoice information
 */
export const getQBOInvoice = async (invoiceId) => {
  return await makeRequest(`invoices/${invoiceId}`);
};

/**
 * Get a specific subset of invoices
 * @param {string} query - The select query string (e.g., "SELECT * FROM Invoice WHERE Id = '123'")
 * @returns {Promise<Object>} - The invoice information
 */
export const getQBOInvoiceByQuery = async (query) => {
  return await makeRequest(`invoices/${query}`);
};

/**
 * Create a new invoice
 * @param {Object} invoiceData - The invoice data
 * @returns {Promise<Object>} - The created invoice
 */
export const createQBOInvoice = async (invoiceData) => {
  return await makeRequest('invoices', 'POST', invoiceData);
};

/**
 * Update an existing invoice
 * @param {Object} invoiceData - The invoice data with Id field
 * @returns {Promise<Object>} - The updated invoice
 */
export const updateQBOInvoice = async (invoiceData) => {
  return await makeRequest('invoices', 'POST', invoiceData);
};

/**
 * Send an invoice email
 * @param {string} invoiceId - The invoice ID
 * @param {string} [sendToEmail] - Optional email address to send to (if different from the one in the invoice)
 * @returns {Promise<Object>} - The response from the send operation
 */
export const sendQBOInvoiceEmail = async (invoiceId, sendToEmail = null) => {
  let endpoint = `send-invoice/${invoiceId}`;
  if (sendToEmail) {
    endpoint += `?sendTo=${encodeURIComponent(sendToEmail)}`;
  }
  return await makeRequest(endpoint, 'POST');
};

/**
 * Account Operations
 */

/**
 * List all accounts
 * @returns {Promise<Object>} - The list of accounts
 */
export const listQBOAccounts = async () => {
  return await makeRequest('accounts');
};

/**
 * Get a specific account by ID
 * @param {string} accountId - The account ID
 * @returns {Promise<Object>} - The account information
 */
export const getQBOAccount = async (accountId) => {
  return await makeRequest(`accounts/${accountId}`);
};

/**
 * Item Operations
 */

/**
 * List all items
 * @returns {Promise<Object>} - The list of items
 */
export const listQBOItems = async () => {
  return await makeRequest('items');
};

/**
 * Get a specific item by ID
 * @param {string} itemId - The item ID
 * @returns {Promise<Object>} - The item information
 */
export const getQBOItem = async (itemId) => {
  return await makeRequest(`items/${itemId}`);
};

/**
 * Query Operations
 */

/**
 * Execute a custom query
 * @param {string} query - The query string (e.g., "SELECT * FROM Customer")
 * @returns {Promise<Object>} - The query results
 */
export const executeQBOQuery = async (query) => {
  return await makeRequest('query', 'POST', { Query: query });
};

export default {
  getQBOCompanyInfo,
  listQBOCustomers,
  getQBOCustomer,
  listQBOCustomerByName,
  createQBOCustomer,
  updateQBOCustomer,
  listQBOInvoices,
  getQBOInvoice,
  getQBOInvoiceByQuery,
  createQBOInvoice,
  updateQBOInvoice,
  sendQBOInvoiceEmail,
  listQBOAccounts,
  getQBOAccount,
  listQBOItems,
  getQBOItem,
  executeQBOQuery
};