/**
 * QuickBooks API Client
 * 
 * This module provides a comprehensive client for interacting with the QuickBooks Online API
 * through the Clarity Business Solutions backend API.
 * 
 * Follows the FRONTEND_AUTHENTICATION_COMPREHENSIVE_GUIDE.md for M2M authentication
 * using HMAC-SHA256 signature-based authentication.
 * 
 * See /docs/reference/QUICKBOOKS_ENDPOINTS_REFERENCE.md for examples of working
 * endpoint calls
 * 
 * @author Clarity Business Solutions
 * @version 2.0.0
 */

// Base URL for the Clarity backend API
// const BACKEND_API_URL = 'https://api.claritybusinesssolutions.ca';
const BACKEND_API_URL = import.meta.env.VITE_API_URL;

// Determine dev mode (Vite or generic)
const isDev =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE !== 'production') ||
  (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production')

/**
 * Generate HMAC-SHA256 authentication header for Clarity backend
 * @param {string} payload - The request payload (JSON string or empty string)
 * @returns {Promise<string>} - The authorization header value
 */
const generateAuthHeader = async (payload = '') => {
  const secretKey = import.meta.env.VITE_SECRET_KEY;
  
  if (!secretKey) {
    throw new Error('VITE_SECRET_KEY not available. Check environment variables.');
  }
  
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${timestamp}.${payload}`;
  
  // Use Web Crypto API for HMAC-SHA256
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return `Bearer ${signatureHex}.${timestamp}`;
};

/**
 * Make a request to the QuickBooks API backend
 * @param {string} endpoint - The endpoint to call (without /quickbooks prefix)
 * @param {string} method - The HTTP method to use
 * @param {Object} data - The data to send (for POST/PUT requests)
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - The API response
 */
const makeRequest = async (endpoint, method = 'GET', data = null, options = {}) => {
  // Guard: prevent accidental usage of deprecated /quickbooks-api/* paths
  if (typeof endpoint === 'string' && endpoint.includes('-api')) {
    const msg = `Blocked malformed QuickBooks endpoint "${endpoint}". Use "/quickbooks/*" endpoints only.`;
    if (isDev) {
      // Surface loudly in dev to stop QA immediately
      // eslint-disable-next-line no-debugger
      debugger;
      console.error(msg);
    }
    throw new Error(msg);
  }

  // Determine payload based on request type and data
  const payload = (method !== 'GET' && data) ? JSON.stringify(data) : '';
  
  // Generate authentication header with exact payload
  const authHeader = await generateAuthHeader(payload);
  
  // Get organization ID from environment
  const orgId = import.meta.env.VITE_CLARITY_INTEGRATION_ORG_ID;
  
  if (!orgId) {
    throw new Error('VITE_CLARITY_INTEGRATION_ORG_ID not available. Check environment variables.');
  }
  
  const headers = {
    'Authorization': authHeader,
    'X-Organization-ID': orgId,
    'Content-Type': 'application/json',
    ...options.headers
  };

  const requestOptions = {
    method,
    headers
  };

  // Add body for non-GET requests
  if (method !== 'GET' && payload) {
    requestOptions.body = payload;
  }

  const url = `${BACKEND_API_URL}/quickbooks${endpoint}`;

  // Dev-time trace to verify exact URL being called from any flow (e.g., QB button)
  if (isDev) {
    // eslint-disable-next-line no-console
    console.info('[QBO] fetch', url, { method, endpoint });
  }

  try {
    const response = await fetch(url, requestOptions);
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail || errorJson.message || `HTTP ${response.status}: ${response.statusText}`;
      } catch {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      if (isDev) {
        // eslint-disable-next-line no-console
        console.error('[QBO] error', errorMessage);
      }
      throw new Error(errorMessage);
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      return await response.text();
    }
  } catch (error) {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.error('[QBO] request failed:', error);
    }
    throw error;
  }
};

/**
 * Authorization Operations
 */

/**
 * Get QuickBooks authorization URL
 * @returns {Promise<Object>} - Authorization URL and state
 */
export const getQBOAuthorizationUrl = async () => {
  return await makeRequest('/authorize');
};

/**
 * Handle OAuth callback
 * @param {string} code - Authorization code from QuickBooks
 * @param {string} state - State parameter for CSRF validation
 * @param {string} realmId - QuickBooks company ID
 * @returns {Promise<Object>} - Token response
 */
export const handleQBOOAuthCallback = async (code, state, realmId = null) => {
  const data = { code, state };
  if (realmId) {
    data.realm_id = realmId;
  }
  return await makeRequest('/oauth/callback', 'POST', data);
};

/**
 * Refresh QuickBooks token
 * @returns {Promise<Object>} - New token information
 */
export const refreshQBOToken = async () => {
  return await makeRequest('/token/refresh', 'POST');
};

/**
 * Validate QuickBooks credentials
 * @returns {Promise<Object>} - Validation result
 */
export const validateQBOCredentials = async () => {
  return await makeRequest('/validate', 'POST', {});
};

/**
 * Company Operations
 */

/**
 * Get company information
 * @returns {Promise<Object>} - The company information
 */
export const getQBOCompanyInfo = async () => {
  return await makeRequest('/company-info');
};

/**
 * Customer Operations
 */

/**
 * List all customers
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} - The list of customers
 */
export const listQBOCustomers = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const endpoint = queryString ? `/customers?${queryString}` : '/customers';
  return await makeRequest(endpoint);
};

/**
 * Get a specific customer by ID
 * @param {string} customerId - The customer ID
 * @returns {Promise<Object>} - The customer information
 */
export const getQBOCustomer = async (customerId) => {
  return await makeRequest(`/customers/${customerId}`);
};

/**
 * Create a new customer
 * @param {Object} customerData - The customer data
 * @returns {Promise<Object>} - The created customer
 */
export const createQBOCustomer = async (customerData) => {
  return await makeRequest('/customers', 'POST', customerData);
};

/**
 * Update an existing customer
 * @param {Object} customerData - The customer data with Id field
 * @returns {Promise<Object>} - The updated customer
 */
export const updateQBOCustomer = async (customerData) => {
  return await makeRequest('/customers', 'PUT', customerData);
};

/**
 * Delete a customer
 * @param {string} customerId - The customer ID
 * @returns {Promise<Object>} - The deletion result
 */
export const deleteQBOCustomer = async (customerId) => {
  return await makeRequest(`/customers/${customerId}`, 'DELETE');
};

/**
 * Search customers by name using the dedicated search endpoint
 * @param {Object} params - Search parameters
 * @param {string} [params.name] - Customer name to search for
 * @param {string} [params.email] - Customer email to search for
 * @param {boolean} [params.active_only=true] - Return only active customers
 * @param {number} [params.max_results=100] - Maximum results
 * @returns {Promise<Object>} - Search results
 */
export const searchQBOCustomers = async (params = {}) => {
  console.log('🔍 [INVESTIGATION] searchQBOCustomers called with params:', params);
  
  const queryString = new URLSearchParams(params).toString();
  const endpoint = queryString ? `/customers/search?${queryString}` : '/customers/search';
  
  console.log('🔍 [INVESTIGATION] searchQBOCustomers constructed endpoint:', endpoint);
  console.log('🔍 [INVESTIGATION] searchQBOCustomers about to call makeRequest with endpoint:', endpoint);
  
  return await makeRequest(endpoint);
};

/**
 * Invoice Operations
 */

/**
 * List all invoices
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} - The list of invoices
 */
export const listQBOInvoices = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const endpoint = queryString ? `/invoices?${queryString}` : '/invoices';
  return await makeRequest(endpoint);
};

/**
 * Get a specific invoice by ID
 * @param {string} invoiceId - The invoice ID
 * @returns {Promise<Object>} - The invoice information
 */
export const getQBOInvoice = async (invoiceId) => {
  return await makeRequest(`/invoices/${invoiceId}`);
};

/**
 * Create a new invoice
 * @param {Object} invoiceData - The invoice data
 * @returns {Promise<Object>} - The created invoice
 */
export const createQBOInvoice = async (invoiceData) => {
  return await makeRequest('/invoices', 'POST', invoiceData);
};

/**
 * Update an existing invoice
 * @param {Object} invoiceData - The invoice data with Id field
 * @returns {Promise<Object>} - The updated invoice
 */
export const updateQBOInvoice = async (invoiceData) => {
  return await makeRequest('/invoices', 'PUT', invoiceData);
};

/**
 * Delete an invoice
 * @param {string} invoiceId - The invoice ID
 * @returns {Promise<Object>} - The deletion result
 */
export const deleteQBOInvoice = async (invoiceId) => {
  return await makeRequest(`/invoices/${invoiceId}`, 'DELETE');
};

/**
 * Bill Operations
 */

/**
 * List all bills
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} - The list of bills
 */
export const listQBOBills = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const endpoint = queryString ? `/bills?${queryString}` : '/bills';
  return await makeRequest(endpoint);
};

/**
 * Get a specific bill by ID
 * @param {string} billId - The bill ID
 * @returns {Promise<Object>} - The bill information
 */
export const getQBOBill = async (billId) => {
  return await makeRequest(`/bills/${billId}`);
};

/**
 * Create a new bill
 * @param {Object} billData - The bill data
 * @returns {Promise<Object>} - The created bill
 */
export const createQBOBill = async (billData) => {
  return await makeRequest('/bills', 'POST', billData);
};

/**
 * Update an existing bill
 * @param {Object} billData - The bill data with Id field
 * @returns {Promise<Object>} - The updated bill
 */
export const updateQBOBill = async (billData) => {
  return await makeRequest('/bills', 'PUT', billData);
};

/**
 * Delete a bill
 * @param {string} billId - The bill ID
 * @returns {Promise<Object>} - The deletion result
 */
export const deleteQBOBill = async (billId) => {
  return await makeRequest(`/bills/${billId}`, 'DELETE');
};

/**
 * Item Operations
 */

/**
 * List all items
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} - The list of items
 */
export const listQBOItems = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const endpoint = queryString ? `/items?${queryString}` : '/items';
  return await makeRequest(endpoint);
};

/**
 * Vendor Operations
 */

/**
 * List all vendors
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} - The list of vendors
 */
export const listQBOVendors = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const endpoint = queryString ? `/vendors?${queryString}` : '/vendors';
  return await makeRequest(endpoint);
};

/**
 * Query Operations
 */

/**
 * Execute a custom QuickBooks query
 * @param {string} query - The SQL-like query string
 * @returns {Promise<Object>} - The query results
 */
export const executeQBOQuery = async (query) => {
  return await makeRequest('/query', 'POST', { query });
};

/**
 * Webhook Operations
 */

/**
 * Get webhook statistics
 * @returns {Promise<Object>} - Webhook statistics
 */
export const getQBOWebhookStats = async () => {
  return await makeRequest('/webhooks/quickbooks/stats');
};

/**
 * List webhook events
 * @returns {Promise<Object>} - List of webhook events
 */
export const listQBOWebhookEvents = async () => {
  return await makeRequest('/webhooks/quickbooks/list');
};

/**
 * Test webhook functionality
 * @param {Object} testData - Test webhook data
 * @returns {Promise<Object>} - Test result
 */
export const testQBOWebhook = async (testData = {}) => {
  return await makeRequest('/webhooks/quickbooks/test', 'POST', testData);
};

/**
 * Clear webhook events
 * @returns {Promise<Object>} - Clear result
 */
export const clearQBOWebhookEvents = async () => {
  return await makeRequest('/webhooks/quickbooks/clear', 'POST', {});
};

/**
 * Legacy compatibility functions
 * These maintain backward compatibility with the old API
 */

/**
 * @deprecated Use listQBOCustomers instead
 */
export const listQBOCustomerByName = async (customerName) => {
  console.warn('listQBOCustomerByName is deprecated. Use executeQBOQuery with a custom query instead.');
  const query = `SELECT * FROM Customer WHERE DisplayName LIKE '%${customerName}%'`;
  return await executeQBOQuery(query);
};

/**
 * @deprecated Use listQBOInvoices instead
 */
export const getQBOInvoiceByQuery = async (query) => {
  console.warn('getQBOInvoiceByQuery is deprecated. Use executeQBOQuery instead.');
  return await executeQBOQuery(query);
};

/**
 * @deprecated Use listQBOItems instead
 */
export const getQBOItem = async (itemId) => {
  console.warn('getQBOItem is deprecated. Use listQBOItems with filters instead.');
  return await listQBOItems({ id: itemId });
};

/**
 * @deprecated Use listQBOItems instead
 */
export const listQBOAccounts = async () => {
  console.warn('listQBOAccounts is deprecated. Use executeQBOQuery instead.');
  return await executeQBOQuery('SELECT * FROM Account MAXRESULTS 1000');
};

/**
 * @deprecated Use listQBOItems instead
 */
export const getQBOAccount = async (accountId) => {
  console.warn('getQBOAccount is deprecated. Use executeQBOQuery instead.');
  return await executeQBOQuery(`SELECT * FROM Account WHERE Id = '${accountId}'`);
};

/**
 * Send an invoice email
 * @param {string} invoiceId - The invoice ID
 * @param {string} [sendToEmail] - Optional email address to send to (if different from the one in the invoice)
 * @returns {Promise<Object>} - The response from the send operation
 */
export const sendQBOInvoiceEmail = async (invoiceId, sendToEmail = null) => {
  let endpoint = `/send-invoice/${invoiceId}`;
  if (sendToEmail) {
    endpoint += `?sendTo=${encodeURIComponent(sendToEmail)}`;
  }
  return await makeRequest(endpoint, 'POST');
};

// Default export with all functions for backward compatibility
export default {
  // Authorization
  getQBOAuthorizationUrl,
  handleQBOOAuthCallback,
  refreshQBOToken,
  validateQBOCredentials,
  
  // Company
  getQBOCompanyInfo,
  
  // Customers
  listQBOCustomers,
  getQBOCustomer,
  createQBOCustomer,
  updateQBOCustomer,
  deleteQBOCustomer,
  
  // Invoices
  listQBOInvoices,
  getQBOInvoice,
  createQBOInvoice,
  updateQBOInvoice,
  deleteQBOInvoice,
  
  // Bills
  listQBOBills,
  getQBOBill,
  createQBOBill,
  updateQBOBill,
  deleteQBOBill,
  
  // Items
  listQBOItems,
  
  // Vendors
  listQBOVendors,
  
  // Query
  executeQBOQuery,
  
  // Webhooks
  getQBOWebhookStats,
  listQBOWebhookEvents,
  testQBOWebhook,
  clearQBOWebhookEvents,
  
  // Legacy compatibility (deprecated)
  listQBOCustomerByName,
  getQBOInvoiceByQuery,
  getQBOItem,
  listQBOAccounts,
  getQBOAccount,
  sendQBOInvoiceEmail
};