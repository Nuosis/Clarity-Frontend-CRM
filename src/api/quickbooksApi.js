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
const BACKEND_API_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
                        (typeof process !== 'undefined' && process.env?.VITE_API_URL) ||
                        'https://api.claritybusinesssolutions.ca';

// Determine dev mode (Vite or generic)
const isDev =
  (typeof import.meta !== 'undefined' && import.meta.env?.MODE && import.meta.env.MODE !== 'production') ||
  (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production')

/**
 * Generate HMAC-SHA256 authentication header for Clarity backend
 * @param {string} payload - The request payload (JSON string or empty string)
 * @returns {Promise<string>} - The authorization header value
 */
const generateAuthHeader = async (payload = '') => {
  const secretKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SECRET_KEY) ||
                    (typeof process !== 'undefined' && process.env?.VITE_SECRET_KEY);

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
  const orgId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLARITY_INTEGRATION_ORG_ID) ||
                (typeof process !== 'undefined' && process.env?.VITE_CLARITY_INTEGRATION_ORG_ID);

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
      let errorData = null;
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        errorData = JSON.parse(errorText);
        // Extract error message from various possible fields
        errorMessage = errorData.detail ||
                     errorData.message ||
                     errorData.error ||
                     errorData.error_description ||
                     (errorData.errors && Array.isArray(errorData.errors) && errorData.errors[0]) ||
                     errorText ||
                     errorMessage;
      } catch {
        // If JSON parsing fails, use the raw text or default message
        errorMessage = errorText || errorMessage;
      }
      
      if (isDev) {
        // eslint-disable-next-line no-console
        console.error('[QBO] error response:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          errorText,
          extractedMessage: errorMessage
        });
      }
      
      // Create a comprehensive error object
      const error = new Error(errorMessage);
      error.status = response.status;
      error.statusText = response.statusText;
      error.responseData = errorData;
      error.responseText = errorText;
      
      throw error;
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
      console.error('[QBO] request failed:', {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        responseData: error.responseData,
        responseText: error.responseText,
        stack: error.stack
      });
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

/**
 * Connection & Status Operations
 */

/**
 * Get QuickBooks connection status for the organization
 *
 * Checks whether QuickBooks is connected, returns realm ID, and token expiration status.
 * This endpoint does NOT require user roles and works with HMAC authentication.
 *
 * @param {string} organizationId - The organization UUID
 * @returns {Promise<Object>} Connection status information
 * @returns {boolean} return.success - Whether the request succeeded
 * @returns {Object} return.data - Status data
 * @returns {boolean} return.data.connected - Whether QuickBooks is connected
 * @returns {string} return.data.realm_id - QuickBooks company ID
 * @returns {string} return.data.expires_at - ISO datetime when token expires
 * @returns {boolean} return.data.is_expired - Whether the token has expired
 *
 * @throws {Error} If organization_id is missing or authentication fails
 *
 * @example
 * const status = await getQuickBooksStatus('9816c057-b5d3-43a2-848f-99365ee6255e');
 * console.log('Connected:', status.data.connected);
 * console.log('Expires:', status.data.expires_at);
 */
export const getQuickBooksStatus = async (organizationId) => {
  if (!organizationId) {
    throw new Error('Organization ID is required for getQuickBooksStatus');
  }
  const endpoint = `/status?organization_id=${encodeURIComponent(organizationId)}`;
  return await makeRequest(endpoint);
};

/**
 * Billing & Invoice Operations
 */

/**
 * Fetch unbilled customer sales records
 *
 * Returns sales records that have not been invoiced yet (inv_id IS NULL).
 * Requires user roles: admin, billing, or owner (not available via HMAC).
 *
 * @param {Object} [params={}] - Query parameters for filtering and pagination
 * @param {string} [params.customer_id] - Filter by specific customer UUID
 * @param {string} [params.date_from] - Filter records on/after this date (YYYY-MM-DD)
 * @param {string} [params.date_to] - Filter records on/before this date (YYYY-MM-DD)
 * @param {number} [params.limit=100] - Max records to return (max: 1000)
 * @param {number} [params.offset=0] - Records to skip for pagination
 * @returns {Promise<Object>} Unbilled records with pagination
 * @returns {boolean} return.success - Whether the request succeeded
 * @returns {Object} return.data - Response data
 * @returns {Array<Object>} return.data.records - Array of unbilled records
 * @returns {Object} return.data.pagination - Pagination metadata
 *
 * @throws {Error} If authentication fails or user lacks required role
 *
 * @example
 * const result = await getUnbilledRecords({
 *   date_from: '2025-01-01',
 *   limit: 50,
 *   offset: 0
 * });
 * console.log(`Found ${result.data.records.length} unbilled records`);
 */
export const getUnbilledRecords = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const endpoint = queryString ? `/unbilled-records?${queryString}` : '/unbilled-records';
  return await makeRequest(endpoint);
};

/**
 * Create QuickBooks invoice from sales records
 *
 * Creates an invoice in QuickBooks from specified sales records and marks them as billed.
 * Requires user roles: admin, billing, or owner (not available via HMAC).
 *
 * @param {Object} data - Invoice creation data
 * @param {Array<string>} data.record_ids - Array of sales record UUIDs to include
 * @param {string} data.customer_qb_id - QuickBooks customer ID
 * @param {boolean} [data.send_email=false] - Whether to email invoice to customer
 * @param {string} [data.due_date] - Invoice due date (YYYY-MM-DD)
 * @returns {Promise<Object>} Created invoice information
 * @returns {boolean} return.success - Whether the request succeeded
 * @returns {Object} return.data - Invoice data
 * @returns {string} return.data.invoice_id - QuickBooks invoice ID
 * @returns {string} return.data.invoice_number - Invoice number (e.g., "INV-1001")
 * @returns {number} return.data.total_amount - Total invoice amount
 * @returns {number} return.data.records_billed - Count of records included
 * @returns {string} return.data.qb_invoice_url - Direct link to invoice in QuickBooks
 *
 * @throws {Error} If authentication fails, user lacks role, or records not found
 *
 * @example
 * const invoice = await createInvoiceFromRecords({
 *   record_ids: ['uuid1', 'uuid2', 'uuid3'],
 *   customer_qb_id: '123',
 *   send_email: true,
 *   due_date: '2025-02-15'
 * });
 * console.log('Invoice created:', invoice.data.invoice_number);
 */
export const createInvoiceFromRecords = async (data) => {
  return await makeRequest('/invoices/from-records', 'POST', data);
};

/**
 * Sync invoices from QuickBooks to local database
 *
 * Fetches invoices from QuickBooks within a date range and updates local database.
 * Supports incremental sync (only new/updated) or full sync (all data).
 * Requires user roles: admin, billing, or owner (not available via HMAC).
 *
 * @param {Object} data - Sync parameters
 * @param {string} data.start_date - Sync invoices from this date (YYYY-MM-DD, required)
 * @param {string} data.end_date - Sync invoices up to this date (YYYY-MM-DD, required)
 * @param {boolean} [data.full_sync=false] - If true, sync all data; if false, only new/updated
 * @returns {Promise<Object>} Sync results
 * @returns {boolean} return.success - Whether the request succeeded
 * @returns {Object} return.data - Sync data
 * @returns {number} return.data.invoices_synced - Total invoices synced
 * @returns {number} return.data.new_invoices - Count of new invoices
 * @returns {number} return.data.updated_invoices - Count of updated invoices
 * @returns {string} return.data.sync_timestamp - ISO datetime of sync completion
 *
 * @throws {Error} If authentication fails, user lacks role, or date range invalid
 *
 * @example
 * const result = await syncInvoices({
 *   start_date: '2025-01-01',
 *   end_date: '2025-01-15',
 *   full_sync: false
 * });
 * console.log(`Synced ${result.data.invoices_synced} invoices`);
 */
export const syncInvoices = async (data) => {
  return await makeRequest('/sync-invoices', 'POST', data);
};

/**
 * Configuration Operations
 */

/**
 * Get QuickBooks configuration for the organization
 *
 * ⚠️ BACKEND INTEGRATION STATUS: PENDING
 *
 * This endpoint will be available once the organization_quickbooks_config table is deployed.
 * See BACKEND_CHANGE_REQUEST_001_QUICKBOOKS_MIGRATION.md for details.
 *
 * Returns organization-specific QuickBooks settings including:
 * - Tax codes (CAD vs non-CAD)
 * - Item IDs by currency (CAD, USD, EUR)
 * - Invoice number format
 * - Default payment terms
 * - Email delivery defaults
 * - Auto-sync settings
 *
 * @param {string} organizationId - The organization UUID
 * @returns {Promise<Object>} Configuration data
 * @returns {boolean} return.success - Whether the request succeeded
 * @returns {Object} return.data - Configuration data
 * @returns {number} return.data.cad_tax_code - Tax code for CAD currency invoices
 * @returns {number} return.data.non_cad_tax_code - Tax code for non-CAD currency invoices
 * @returns {string} return.data.cad_item_id - QB Item ID for CAD development services
 * @returns {string} return.data.cad_item_name - QB Item name for CAD development services
 * @returns {string} return.data.usd_item_id - QB Item ID for USD development services
 * @returns {string} return.data.usd_item_name - QB Item name for USD development services
 * @returns {string} return.data.eur_item_id - QB Item ID for EUR development services
 * @returns {string} return.data.eur_item_name - QB Item name for EUR development services
 * @returns {string} return.data.default_currency - Default currency (CAD, USD, EUR)
 * @returns {string} return.data.default_payment_terms - Default payment terms
 * @returns {boolean} return.data.default_email_delivery - Send invoice emails by default
 * @returns {string} return.data.invoice_number_format - Invoice number format pattern
 * @returns {boolean} return.data.auto_sync_enabled - Auto-sync enabled flag
 * @returns {number} return.data.sync_frequency_hours - Sync frequency in hours
 *
 * @throws {Error} If organization_id is missing or authentication fails
 *
 * @example
 * const config = await getQuickBooksConfig('9816c057-b5d3-43a2-848f-99365ee6255e');
 * console.log('CAD Tax Code:', config.data.cad_tax_code);
 */
export const getQuickBooksConfig = async (organizationId) => {
  if (!organizationId) {
    throw new Error('Organization ID is required for getQuickBooksConfig');
  }
  const endpoint = `/config?organization_id=${encodeURIComponent(organizationId)}`;
  return await makeRequest(endpoint);
};

/**
 * Update QuickBooks configuration for the organization
 *
 * ⚠️ BACKEND INTEGRATION STATUS: PENDING
 *
 * This endpoint will be available once the organization_quickbooks_config table is deployed.
 * See BACKEND_CHANGE_REQUEST_001_QUICKBOOKS_MIGRATION.md for details.
 *
 * Updates organization-specific QuickBooks settings. Requires admin role.
 *
 * @param {string} organizationId - The organization UUID
 * @param {Object} configData - Configuration data to update
 * @param {number} [configData.cad_tax_code] - Tax code for CAD currency invoices
 * @param {number} [configData.non_cad_tax_code] - Tax code for non-CAD currency invoices
 * @param {string} [configData.cad_item_id] - QB Item ID for CAD development services
 * @param {string} [configData.cad_item_name] - QB Item name for CAD development services
 * @param {string} [configData.usd_item_id] - QB Item ID for USD development services
 * @param {string} [configData.usd_item_name] - QB Item name for USD development services
 * @param {string} [configData.eur_item_id] - QB Item ID for EUR development services
 * @param {string} [configData.eur_item_name] - QB Item name for EUR development services
 * @param {string} [configData.default_currency] - Default currency (CAD, USD, EUR)
 * @param {string} [configData.default_payment_terms] - Default payment terms
 * @param {boolean} [configData.default_email_delivery] - Send invoice emails by default
 * @param {string} [configData.invoice_number_format] - Invoice number format pattern
 * @param {boolean} [configData.auto_sync_enabled] - Auto-sync enabled flag
 * @param {number} [configData.sync_frequency_hours] - Sync frequency in hours
 * @returns {Promise<Object>} Updated configuration data
 * @returns {boolean} return.success - Whether the request succeeded
 * @returns {Object} return.data - Updated configuration data
 *
 * @throws {Error} If organization_id is missing, authentication fails, or user lacks admin role
 *
 * @example
 * const updated = await updateQuickBooksConfig('9816c057-b5d3-43a2-848f-99365ee6255e', {
 *   cad_tax_code: 5,
 *   auto_sync_enabled: true,
 *   sync_frequency_hours: 12
 * });
 * console.log('Configuration updated:', updated.data);
 */
export const updateQuickBooksConfig = async (organizationId, configData) => {
  if (!organizationId) {
    throw new Error('Organization ID is required for updateQuickBooksConfig');
  }
  const data = {
    organization_id: organizationId,
    ...configData
  };
  return await makeRequest('/config', 'PUT', data);
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

  // Connection & Status
  getQuickBooksStatus,

  // Customers
  listQBOCustomers,
  getQBOCustomer,
  createQBOCustomer,
  updateQBOCustomer,
  deleteQBOCustomer,
  searchQBOCustomers,

  // Invoices
  listQBOInvoices,
  getQBOInvoice,
  createQBOInvoice,
  updateQBOInvoice,
  deleteQBOInvoice,
  sendQBOInvoiceEmail,

  // Billing & Invoice Operations
  getUnbilledRecords,
  createInvoiceFromRecords,
  syncInvoices,

  // Configuration
  getQuickBooksConfig,
  updateQuickBooksConfig,

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
  getQBOAccount
};