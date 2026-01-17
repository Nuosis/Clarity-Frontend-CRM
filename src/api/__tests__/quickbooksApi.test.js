/**
 * QuickBooks API Client Integration Tests
 *
 * Tests for the QuickBooks API client functions
 * Tests authentication, endpoint construction, and error handling
 */

// Mock import.meta before importing the module
const mockEnv = {
  VITE_API_URL: 'https://api.claritybusinesssolutions.ca',
  MODE: 'test'
};

jest.mock('../../services/dataService', () => ({
  generateBackendAuthHeader: jest.fn().mockResolvedValue('Bearer test-jwt-token'),
  getAuthenticationContext: jest.fn().mockReturnValue({
    isAuthenticated: true,
    user: { supabaseOrgID: '9816c057-b5d3-43a2-848f-99365ee6255e' }
  })
}));

jest.mock('../../api/quickbooksApi', () => {
  // Mock import.meta.env
  const originalModule = jest.requireActual('../../api/quickbooksApi');

  // Since we can't actually use import.meta in Jest, we'll just return the actual module
  // and mock fetch/crypto instead
  return originalModule;
});

// Set environment variables before import
Object.keys(mockEnv).forEach(key => {
  process.env[key] = mockEnv[key];
});

import {
  getQBOAuthorizationUrl,
  handleQBOOAuthCallback,
  refreshQBOToken,
  validateQBOCredentials,
  getQBOCompanyInfo,
  listQBOCustomers,
  getQBOCustomer,
  createQBOCustomer,
  updateQBOCustomer,
  deleteQBOCustomer,
  searchQBOCustomers,
  listQBOInvoices,
  getQBOInvoice,
  createQBOInvoice,
  updateQBOInvoice,
  deleteQBOInvoice,
  sendQBOInvoiceEmail,
  getQuickBooksStatus,
  getUnbilledRecords,
  createInvoiceFromRecords,
  syncInvoices,
  getQuickBooksConfig,
  updateQuickBooksConfig
} from '../quickbooksApi';
import { generateBackendAuthHeader, getAuthenticationContext } from '../../services/dataService';

beforeEach(() => {
  // Mock fetch
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('QuickBooks API Client - Authentication', () => {
  describe('getQBOAuthorizationUrl', () => {
    test('should get authorization URL', async () => {
      const mockResponse = {
        authorization_url: 'https://appcenter.intuit.com/connect/oauth2',
        state: 'random-state-value'
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map([['content-type', 'application/json']])
      });

      const result = await getQBOAuthorizationUrl();

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.claritybusinesssolutions.ca/quickbooks/authorize',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Bearer'),
            'X-Organization-ID': '9816c057-b5d3-43a2-848f-99365ee6255e',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    test('should handle error when authorization URL fails', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => JSON.stringify({ detail: 'Failed to generate authorization URL' })
      });

      await expect(getQBOAuthorizationUrl()).rejects.toThrow('Failed to generate authorization URL');
    });
  });

  describe('handleQBOOAuthCallback', () => {
    test('should handle OAuth callback successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          realm_id: '123456789'
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map([['content-type', 'application/json']])
      });

      const result = await handleQBOOAuthCallback('auth-code', 'state-value', '123456789');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.claritybusinesssolutions.ca/quickbooks/oauth/callback',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            code: 'auth-code',
            state: 'state-value',
            realm_id: '123456789'
          })
        })
      );
    });
  });

  describe('refreshQBOToken', () => {
    test('should refresh token successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          access_token: 'new-access-token',
          expires_at: '2025-02-15T00:00:00Z'
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map([['content-type', 'application/json']])
      });

      const result = await refreshQBOToken();

      expect(result).toEqual(mockResponse);
    });
  });

  describe('validateQBOCredentials', () => {
    test('should validate credentials successfully', async () => {
      const mockResponse = {
        success: true,
        valid: true
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map([['content-type', 'application/json']])
      });

      const result = await validateQBOCredentials();

      expect(result).toEqual(mockResponse);
    });
  });
});

describe('QuickBooks API Client - Company Operations', () => {
  describe('getQBOCompanyInfo', () => {
    test('should get company information', async () => {
      const mockResponse = {
        CompanyInfo: {
          CompanyName: 'Test Company',
          Id: '123456789',
          Country: 'CA'
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map([['content-type', 'application/json']])
      });

      const result = await getQBOCompanyInfo();

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.claritybusinesssolutions.ca/quickbooks/company-info',
        expect.any(Object)
      );
    });
  });
});

describe('QuickBooks API Client - Customer Operations', () => {
  describe('listQBOCustomers', () => {
    test('should list customers without params', async () => {
      const mockResponse = {
        QueryResponse: {
          Customer: [
            { Id: '1', DisplayName: 'Customer 1' },
            { Id: '2', DisplayName: 'Customer 2' }
          ]
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map([['content-type', 'application/json']])
      });

      const result = await listQBOCustomers();

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.claritybusinesssolutions.ca/quickbooks/customers',
        expect.any(Object)
      );
    });

    test('should list customers with params', async () => {
      const mockResponse = {
        QueryResponse: {
          Customer: [{ Id: '1', DisplayName: 'Customer 1' }]
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map([['content-type', 'application/json']])
      });

      const result = await listQBOCustomers({ maxresults: 10 });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.claritybusinesssolutions.ca/quickbooks/customers?maxresults=10',
        expect.any(Object)
      );
    });
  });

  describe('getQBOCustomer', () => {
    test('should get a specific customer', async () => {
      const mockResponse = {
        Customer: {
          Id: '123',
          DisplayName: 'Test Customer'
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map([['content-type', 'application/json']])
      });

      const result = await getQBOCustomer('123');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.claritybusinesssolutions.ca/quickbooks/customers/123',
        expect.any(Object)
      );
    });
  });

  describe('createQBOCustomer', () => {
    test('should create a new customer', async () => {
      const customerData = {
        DisplayName: 'New Customer',
        PrimaryEmailAddr: { Address: 'test@example.com' }
      };

      const mockResponse = {
        Customer: {
          Id: '456',
          ...customerData
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map([['content-type', 'application/json']])
      });

      const result = await createQBOCustomer(customerData);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.claritybusinesssolutions.ca/quickbooks/customers',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(customerData)
        })
      );
    });
  });

  describe('searchQBOCustomers', () => {
    test('should search customers by name', async () => {
      const mockResponse = {
        customers: [
          { Id: '1', DisplayName: 'Test Customer' }
        ]
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map([['content-type', 'application/json']])
      });

      const result = await searchQBOCustomers({ name: 'Test' });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.claritybusinesssolutions.ca/quickbooks/customers/search?name=Test',
        expect.any(Object)
      );
    });
  });
});

describe('QuickBooks API Client - Invoice Operations', () => {
  describe('listQBOInvoices', () => {
    test('should list invoices', async () => {
      const mockResponse = {
        QueryResponse: {
          Invoice: [
            { Id: '1', TotalAmt: 1000 },
            { Id: '2', TotalAmt: 2000 }
          ]
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map([['content-type', 'application/json']])
      });

      const result = await listQBOInvoices();

      expect(result).toEqual(mockResponse);
    });
  });

  describe('createQBOInvoice', () => {
    test('should create a new invoice', async () => {
      const invoiceData = {
        CustomerRef: { value: '123' },
        Line: [
          {
            Amount: 1000,
            DetailType: 'SalesItemLineDetail',
            SalesItemLineDetail: {
              ItemRef: { value: '1' }
            }
          }
        ]
      };

      const mockResponse = {
        Invoice: {
          Id: '789',
          ...invoiceData
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map([['content-type', 'application/json']])
      });

      const result = await createQBOInvoice(invoiceData);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.claritybusinesssolutions.ca/quickbooks/invoices',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(invoiceData)
        })
      );
    });
  });

  describe('sendQBOInvoiceEmail', () => {
    test('should send invoice email', async () => {
      const mockResponse = {
        success: true,
        message: 'Invoice email sent'
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map([['content-type', 'application/json']])
      });

      const result = await sendQBOInvoiceEmail('123');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.claritybusinesssolutions.ca/quickbooks/send-invoice/123',
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    test('should send invoice email to custom address', async () => {
      const mockResponse = {
        success: true,
        message: 'Invoice email sent'
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map([['content-type', 'application/json']])
      });

      const result = await sendQBOInvoiceEmail('123', 'custom@example.com');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.claritybusinesssolutions.ca/quickbooks/send-invoice/123?sendTo=custom%40example.com',
        expect.any(Object)
      );
    });
  });
});

describe('QuickBooks API Client - Status & Connection', () => {
  describe('getQuickBooksStatus', () => {
    test('should get connection status', async () => {
      const mockResponse = {
        success: true,
        data: {
          connected: true,
          realm_id: '123456789',
          expires_at: '2025-02-15T00:00:00Z',
          is_expired: false
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map([['content-type', 'application/json']])
      });

      const result = await getQuickBooksStatus('9816c057-b5d3-43a2-848f-99365ee6255e');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/quickbooks/status?organization_id=9816c057-b5d3-43a2-848f-99365ee6255e'),
        expect.any(Object)
      );
    });

    test('should throw error if organization ID is missing', async () => {
      await expect(getQuickBooksStatus()).rejects.toThrow('Organization ID is required');
    });
  });
});

describe('QuickBooks API Client - Billing Operations', () => {
  describe('getUnbilledRecords', () => {
    test('should get unbilled records', async () => {
      const mockResponse = {
        success: true,
        data: {
          records: [
            { id: '1', amount: 1000, hours: 8 },
            { id: '2', amount: 1500, hours: 10 }
          ],
          pagination: {
            total: 2,
            limit: 100,
            offset: 0
          }
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map([['content-type', 'application/json']])
      });

      const result = await getUnbilledRecords({ date_from: '2025-01-01' });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/quickbooks/unbilled-records?date_from=2025-01-01'),
        expect.any(Object)
      );
    });
  });

  describe('createInvoiceFromRecords', () => {
    test('should create invoice from records', async () => {
      const invoiceData = {
        record_ids: ['uuid1', 'uuid2'],
        customer_qb_id: '123',
        send_email: true,
        due_date: '2025-02-15'
      };

      const mockResponse = {
        success: true,
        data: {
          invoice_id: '789',
          invoice_number: 'INV-1001',
          total_amount: 2500,
          records_billed: 2
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map([['content-type', 'application/json']])
      });

      const result = await createInvoiceFromRecords(invoiceData);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.claritybusinesssolutions.ca/quickbooks/invoices/from-records',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(invoiceData)
        })
      );
    });
  });

  describe('syncInvoices', () => {
    test('should sync invoices', async () => {
      const syncData = {
        start_date: '2025-01-01',
        end_date: '2025-01-31',
        full_sync: false
      };

      const mockResponse = {
        success: true,
        data: {
          invoices_synced: 25,
          new_invoices: 10,
          updated_invoices: 15,
          sync_timestamp: '2025-01-15T12:00:00Z'
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map([['content-type', 'application/json']])
      });

      const result = await syncInvoices(syncData);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.claritybusinesssolutions.ca/quickbooks/sync-invoices',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(syncData)
        })
      );
    });
  });
});

describe('QuickBooks API Client - Configuration', () => {
  describe('getQuickBooksConfig', () => {
    test('should get QuickBooks configuration', async () => {
      const mockResponse = {
        success: true,
        data: {
          cad_tax_code: 4,
          non_cad_tax_code: 3,
          cad_item_id: '3',
          default_currency: 'CAD'
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map([['content-type', 'application/json']])
      });

      const result = await getQuickBooksConfig('9816c057-b5d3-43a2-848f-99365ee6255e');

      expect(result).toEqual(mockResponse);
    });

    test('should throw error if organization ID is missing', async () => {
      await expect(getQuickBooksConfig()).rejects.toThrow('Organization ID is required');
    });
  });

  describe('updateQuickBooksConfig', () => {
    test('should update QuickBooks configuration', async () => {
      const configData = {
        cad_tax_code: 5,
        auto_sync_enabled: true
      };

      const mockResponse = {
        success: true,
        data: configData
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map([['content-type', 'application/json']])
      });

      const result = await updateQuickBooksConfig('9816c057-b5d3-43a2-848f-99365ee6255e', configData);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.claritybusinesssolutions.ca/quickbooks/config',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            organization_id: '9816c057-b5d3-43a2-848f-99365ee6255e',
            ...configData
          })
        })
      );
    });
  });
});

describe('QuickBooks API Client - Error Handling', () => {
  test('should handle HTTP errors with JSON response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => JSON.stringify({ detail: 'Invalid customer data' })
    });

    await expect(createQBOCustomer({})).rejects.toThrow('Invalid customer data');
  });

  test('should handle HTTP errors with text response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Server error occurred'
    });

    await expect(getQBOCompanyInfo()).rejects.toThrow('Server error occurred');
  });

  test('should handle network errors', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(getQBOCompanyInfo()).rejects.toThrow('Network error');
  });

  test('should block malformed endpoints with -api in path', async () => {
    // This test verifies the guard against deprecated /quickbooks-api/* paths
    const makeRequestWithBadEndpoint = async () => {
      const { default: quickbooksApi } = await import('../quickbooksApi');
      // Try to make a request with a malformed endpoint
      return quickbooksApi.makeRequest('/quickbooks-api/customers');
    };

    // The function should throw immediately due to the endpoint guard
    await expect(makeRequestWithBadEndpoint()).rejects.toThrow(/malformed.*endpoint/i);
  });
});

describe('QuickBooks API Client - Authentication', () => {
  test('should include backend auth header for requests', async () => {
    const mockResponse = { success: true };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
      headers: new Map([['content-type', 'application/json']])
    });

    await getQBOCompanyInfo();

    const fetchCall = global.fetch.mock.calls[0];
    const headers = fetchCall[1].headers;

    expect(generateBackendAuthHeader).toHaveBeenCalled();
    expect(headers.Authorization).toBe('Bearer test-jwt-token');

    // Verify Organization header exists
    expect(headers['X-Organization-ID']).toBe('9816c057-b5d3-43a2-848f-99365ee6255e');
  });

  test('should include body for POST requests', async () => {
    const customerData = { DisplayName: 'Test Customer' };
    const mockResponse = { success: true };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
      headers: new Map([['content-type', 'application/json']])
    });

    await createQBOCustomer(customerData);

    const fetchCall = global.fetch.mock.calls[0];
    const headers = fetchCall[1].headers;

    expect(generateBackendAuthHeader).toHaveBeenCalled();
    expect(headers.Authorization).toBe('Bearer test-jwt-token');

    // Verify body was sent
    expect(fetchCall[1].body).toBe(JSON.stringify(customerData));
  });

  test('should throw error if organization context is missing', async () => {
    getAuthenticationContext.mockReturnValueOnce({
      isAuthenticated: true,
      user: {}
    });

    await expect(getQBOCompanyInfo()).rejects.toThrow('Organization ID not available');
  });
});
