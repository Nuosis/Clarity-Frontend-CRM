/**
 * QuickBooks E2E Workflow Tests
 *
 * End-to-end tests for complete QuickBooks integration workflows
 * Tests OAuth flow, invoice creation, customer sync, and error recovery
 */

jest.mock('../../services/dataService', () => ({
  generateBackendAuthHeader: jest.fn().mockResolvedValue('Bearer test-jwt-token'),
  getAuthenticationContext: jest.fn().mockReturnValue({
    isAuthenticated: true,
    user: { supabaseOrgID: '9816c057-b5d3-43a2-848f-99365ee6255e' }
  })
}));

import * as quickbooksApi from '../../api/quickbooksApi';

// Mock fetch for all tests
global.fetch = jest.fn();

beforeEach(() => {
  // Mock environment variables
  process.env.VITE_API_URL = 'https://api.claritybusinesssolutions.ca';

  jest.clearAllMocks();
});

afterEach(() => {
  delete process.env.VITE_API_URL;
});

describe('E2E Workflow: OAuth Connection Flow', () => {
  test('should complete full OAuth connection workflow', async () => {
    // Step 1: Get authorization URL
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        authorization_url: 'https://appcenter.intuit.com/connect/oauth2?client_id=test&state=abc123',
        state: 'abc123'
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const authResponse = await quickbooksApi.getQBOAuthorizationUrl();
    expect(authResponse.authorization_url).toContain('appcenter.intuit.com');
    expect(authResponse.state).toBe('abc123');

    // Step 2: Simulate OAuth callback (user approves and returns with code)
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          access_token: 'access_token_value',
          refresh_token: 'refresh_token_value',
          realm_id: '123456789',
          expires_at: '2025-12-31T23:59:59Z'
        }
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const callbackResponse = await quickbooksApi.handleQBOOAuthCallback(
      'auth_code_from_qb',
      'abc123',
      '123456789'
    );
    expect(callbackResponse.success).toBe(true);
    expect(callbackResponse.data.realm_id).toBe('123456789');

    // Step 3: Verify connection status
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          connected: true,
          realm_id: '123456789',
          expires_at: '2025-12-31T23:59:59Z',
          is_expired: false
        }
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const statusResponse = await quickbooksApi.getQuickBooksStatus('9816c057-b5d3-43a2-848f-99365ee6255e');
    expect(statusResponse.data.connected).toBe(true);
    expect(statusResponse.data.realm_id).toBe('123456789');

    // Step 4: Fetch company info to confirm connection
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        CompanyInfo: {
          CompanyName: 'Test Company Inc.',
          Id: '123456789',
          Country: 'CA'
        }
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const companyResponse = await quickbooksApi.getQBOCompanyInfo();
    expect(companyResponse.CompanyInfo.CompanyName).toBe('Test Company Inc.');
  });

  test('should handle OAuth flow with error and retry', async () => {
    // Step 1: First attempt fails
    global.fetch.mockRejectedValueOnce(new Error('Network timeout'));

    await expect(quickbooksApi.getQBOAuthorizationUrl()).rejects.toThrow('Network timeout');

    // Step 2: Retry succeeds
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        authorization_url: 'https://appcenter.intuit.com/connect/oauth2?retry=true',
        state: 'xyz789'
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const retryResponse = await quickbooksApi.getQBOAuthorizationUrl();
    expect(retryResponse.authorization_url).toBeTruthy();
  });
});

describe('E2E Workflow: Invoice Creation from Sales Records', () => {
  test('should complete full invoice creation workflow', async () => {
    // Step 1: Get unbilled records
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          records: [
            {
              id: 'record-1',
              customer_id: 'cust-123',
              amount: 1000,
              hours: 8,
              description: 'Development work'
            },
            {
              id: 'record-2',
              customer_id: 'cust-123',
              amount: 1500,
              hours: 10,
              description: 'Consulting'
            }
          ],
          pagination: {
            total: 2,
            limit: 100,
            offset: 0
          }
        }
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const unbilledResponse = await quickbooksApi.getUnbilledRecords({
      customer_id: 'cust-123',
      date_from: '2025-01-01',
      date_to: '2025-01-31'
    });

    expect(unbilledResponse.data.records).toHaveLength(2);
    const totalAmount = unbilledResponse.data.records.reduce((sum, r) => sum + r.amount, 0);
    expect(totalAmount).toBe(2500);

    // Step 2: Create invoice from records
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          invoice_id: 'inv-789',
          invoice_number: 'INV-1001',
          total_amount: 2500,
          records_billed: 2,
          qb_invoice_url: 'https://qbo.intuit.com/app/invoice?txnId=789'
        }
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const invoiceResponse = await quickbooksApi.createInvoiceFromRecords({
      record_ids: ['record-1', 'record-2'],
      customer_qb_id: 'qb-cust-456',
      send_email: true,
      due_date: '2025-02-15'
    });

    expect(invoiceResponse.success).toBe(true);
    expect(invoiceResponse.data.invoice_number).toBe('INV-1001');
    expect(invoiceResponse.data.total_amount).toBe(2500);
    expect(invoiceResponse.data.records_billed).toBe(2);

    // Step 3: Send invoice email
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Invoice email sent successfully'
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const emailResponse = await quickbooksApi.sendQBOInvoiceEmail('inv-789');
    expect(emailResponse.success).toBe(true);

    // Step 4: Verify no unbilled records remain for this customer
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          records: [],
          pagination: {
            total: 0,
            limit: 100,
            offset: 0
          }
        }
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const verifyResponse = await quickbooksApi.getUnbilledRecords({
      customer_id: 'cust-123'
    });
    expect(verifyResponse.data.records).toHaveLength(0);
  });

  test('should handle partial invoice creation failure', async () => {
    // Step 1: Get unbilled records
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          records: [
            { id: 'record-1', amount: 1000 },
            { id: 'record-2', amount: 1500 }
          ]
        }
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    await quickbooksApi.getUnbilledRecords();

    // Step 2: Invoice creation fails
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => JSON.stringify({
        detail: 'Customer not found in QuickBooks'
      })
    });

    await expect(
      quickbooksApi.createInvoiceFromRecords({
        record_ids: ['record-1', 'record-2'],
        customer_qb_id: 'invalid-customer',
        send_email: false
      })
    ).rejects.toThrow('Customer not found in QuickBooks');

    // Step 3: Verify records are still unbilled
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          records: [
            { id: 'record-1', amount: 1000 },
            { id: 'record-2', amount: 1500 }
          ]
        }
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const checkResponse = await quickbooksApi.getUnbilledRecords();
    expect(checkResponse.data.records).toHaveLength(2);
  });
});

describe('E2E Workflow: Customer Synchronization', () => {
  test('should sync customer from CRM to QuickBooks', async () => {
    // Step 1: Search for customer in QuickBooks
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        customers: []
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const searchResponse = await quickbooksApi.searchQBOCustomers({
      name: 'Acme Corporation',
      email: 'contact@acme.com'
    });

    expect(searchResponse.customers).toHaveLength(0);

    // Step 2: Customer not found, create new customer in QuickBooks
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Customer: {
          Id: 'qb-cust-123',
          DisplayName: 'Acme Corporation',
          PrimaryEmailAddr: {
            Address: 'contact@acme.com'
          },
          PrimaryPhone: {
            FreeFormNumber: '555-0123'
          },
          Active: true
        }
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const createResponse = await quickbooksApi.createQBOCustomer({
      DisplayName: 'Acme Corporation',
      PrimaryEmailAddr: {
        Address: 'contact@acme.com'
      },
      PrimaryPhone: {
        FreeFormNumber: '555-0123'
      }
    });

    expect(createResponse.Customer.Id).toBe('qb-cust-123');
    expect(createResponse.Customer.DisplayName).toBe('Acme Corporation');

    // Step 3: Verify customer exists
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Customer: {
          Id: 'qb-cust-123',
          DisplayName: 'Acme Corporation',
          Active: true
        }
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const verifyResponse = await quickbooksApi.getQBOCustomer('qb-cust-123');
    expect(verifyResponse.Customer.DisplayName).toBe('Acme Corporation');
  });

  test('should update existing QuickBooks customer', async () => {
    // Step 1: Search finds existing customer
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        customers: [
          {
            Id: 'qb-cust-456',
            DisplayName: 'Old Company Name',
            SyncToken: '1'
          }
        ]
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const searchResponse = await quickbooksApi.searchQBOCustomers({
      name: 'Old Company Name'
    });

    expect(searchResponse.customers).toHaveLength(1);

    // Step 2: Update customer details
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Customer: {
          Id: 'qb-cust-456',
          DisplayName: 'New Company Name',
          SyncToken: '2',
          Active: true
        }
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const updateResponse = await quickbooksApi.updateQBOCustomer({
      Id: 'qb-cust-456',
      DisplayName: 'New Company Name',
      SyncToken: '1'
    });

    expect(updateResponse.Customer.DisplayName).toBe('New Company Name');
    expect(updateResponse.Customer.SyncToken).toBe('2');
  });
});

describe('E2E Workflow: Invoice Synchronization', () => {
  test('should sync invoices from QuickBooks to local database', async () => {
    // Step 1: Initiate sync
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          invoices_synced: 25,
          new_invoices: 10,
          updated_invoices: 15,
          sync_timestamp: '2025-01-15T12:00:00Z'
        }
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const syncResponse = await quickbooksApi.syncInvoices({
      start_date: '2025-01-01',
      end_date: '2025-01-31',
      full_sync: false
    });

    expect(syncResponse.success).toBe(true);
    expect(syncResponse.data.invoices_synced).toBe(25);
    expect(syncResponse.data.new_invoices).toBe(10);
    expect(syncResponse.data.updated_invoices).toBe(15);

    // Step 2: Verify specific invoice was synced
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Invoice: {
          Id: 'inv-123',
          DocNumber: 'INV-1001',
          TotalAmt: 1500,
          Balance: 1500,
          DueDate: '2025-02-15'
        }
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const invoiceResponse = await quickbooksApi.getQBOInvoice('inv-123');
    expect(invoiceResponse.Invoice.DocNumber).toBe('INV-1001');
  });

  test('should handle full sync vs incremental sync', async () => {
    // Step 1: Incremental sync (only new/updated)
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          invoices_synced: 5,
          new_invoices: 3,
          updated_invoices: 2
        }
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const incrementalResponse = await quickbooksApi.syncInvoices({
      start_date: '2025-01-01',
      end_date: '2025-01-31',
      full_sync: false
    });

    expect(incrementalResponse.data.invoices_synced).toBe(5);

    // Step 2: Full sync (all data)
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          invoices_synced: 100,
          new_invoices: 0,
          updated_invoices: 100
        }
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const fullSyncResponse = await quickbooksApi.syncInvoices({
      start_date: '2025-01-01',
      end_date: '2025-01-31',
      full_sync: true
    });

    expect(fullSyncResponse.data.invoices_synced).toBe(100);
  });
});

describe('E2E Workflow: Token Refresh and Re-authentication', () => {
  test('should detect expired token and re-authenticate', async () => {
    // Step 1: Check status - token expired
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          connected: true,
          realm_id: '123456789',
          expires_at: '2025-01-01T00:00:00Z',
          is_expired: true
        }
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const statusResponse = await quickbooksApi.getQuickBooksStatus('9816c057-b5d3-43a2-848f-99365ee6255e');
    expect(statusResponse.data.is_expired).toBe(true);

    // Step 2: Attempt to refresh token
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          access_token: 'new_access_token',
          expires_at: '2025-12-31T23:59:59Z'
        }
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const refreshResponse = await quickbooksApi.refreshQBOToken();
    expect(refreshResponse.success).toBe(true);
    expect(refreshResponse.data.access_token).toBeTruthy();

    // Step 3: Verify token is valid
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          connected: true,
          realm_id: '123456789',
          expires_at: '2025-12-31T23:59:59Z',
          is_expired: false
        }
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const verifyResponse = await quickbooksApi.getQuickBooksStatus('9816c057-b5d3-43a2-848f-99365ee6255e');
    expect(verifyResponse.data.is_expired).toBe(false);
  });

  test('should re-authenticate if token refresh fails', async () => {
    // Step 1: Token refresh fails
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => JSON.stringify({
        detail: 'Refresh token expired'
      })
    });

    await expect(quickbooksApi.refreshQBOToken()).rejects.toThrow('Refresh token expired');

    // Step 2: Initiate new OAuth flow
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        authorization_url: 'https://appcenter.intuit.com/connect/oauth2?reconnect=true',
        state: 'new-state-456'
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const authResponse = await quickbooksApi.getQBOAuthorizationUrl();
    expect(authResponse.authorization_url).toContain('reconnect=true');
  });
});

describe('E2E Workflow: Configuration Management', () => {
  test('should set up QuickBooks configuration for new organization', async () => {
    // Step 1: Get default configuration
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          cad_tax_code: 4,
          non_cad_tax_code: 3,
          cad_item_id: '3',
          cad_item_name: 'Development CAD',
          default_currency: 'CAD',
          auto_sync_enabled: false,
          sync_frequency_hours: 24
        }
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const configResponse = await quickbooksApi.getQuickBooksConfig('9816c057-b5d3-43a2-848f-99365ee6255e');
    expect(configResponse.data.cad_tax_code).toBe(4);

    // Step 2: Update configuration
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          cad_tax_code: 5,
          non_cad_tax_code: 3,
          auto_sync_enabled: true,
          sync_frequency_hours: 12
        }
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const updateResponse = await quickbooksApi.updateQuickBooksConfig('9816c057-b5d3-43a2-848f-99365ee6255e', {
      cad_tax_code: 5,
      auto_sync_enabled: true,
      sync_frequency_hours: 12
    });

    expect(updateResponse.data.cad_tax_code).toBe(5);
    expect(updateResponse.data.auto_sync_enabled).toBe(true);

    // Step 3: Verify configuration was saved
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          cad_tax_code: 5,
          auto_sync_enabled: true,
          sync_frequency_hours: 12
        }
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const verifyResponse = await quickbooksApi.getQuickBooksConfig('9816c057-b5d3-43a2-848f-99365ee6255e');
    expect(verifyResponse.data.cad_tax_code).toBe(5);
  });
});

describe('E2E Workflow: Error Recovery', () => {
  test('should recover from network failures with retry', async () => {
    // Attempt 1: Network error
    global.fetch.mockRejectedValueOnce(new Error('Network request failed'));

    await expect(
      quickbooksApi.listQBOCustomers()
    ).rejects.toThrow('Network request failed');

    // Attempt 2: Timeout
    global.fetch.mockRejectedValueOnce(new Error('Request timeout'));

    await expect(
      quickbooksApi.listQBOCustomers()
    ).rejects.toThrow('Request timeout');

    // Attempt 3: Success
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        QueryResponse: {
          Customer: [
            { Id: '1', DisplayName: 'Customer 1' }
          ]
        }
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const successResponse = await quickbooksApi.listQBOCustomers();
    expect(successResponse.QueryResponse.Customer).toHaveLength(1);
  });

  test('should handle API rate limiting', async () => {
    // First request: Rate limited
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => JSON.stringify({
        detail: 'Rate limit exceeded. Please try again later.'
      })
    });

    await expect(
      quickbooksApi.createQBOInvoice({})
    ).rejects.toThrow('Rate limit exceeded');

    // Second request after waiting: Success
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Invoice: {
          Id: 'inv-123',
          DocNumber: 'INV-1002'
        }
      }),
      headers: new Map([['content-type', 'application/json']])
    });

    const successResponse = await quickbooksApi.createQBOInvoice({
      CustomerRef: { value: '123' },
      Line: []
    });

    expect(successResponse.Invoice.DocNumber).toBe('INV-1002');
  });
});
