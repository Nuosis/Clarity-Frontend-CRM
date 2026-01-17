/**
 * Customer API Integration Tests
 *
 * Tests for src/api/customers.js covering:
 * - CRUD operations (fetchCustomers, fetchCustomerById, createCustomer, updateCustomer, deleteCustomer)
 * - Authentication headers (HMAC for backend, JWT for webapp)
 * - Organization scoping for webapp environment
 * - Error handling (network, validation, authorization)
 * - Environment-aware routing (FileMaker vs Backend API)
 * - Data normalization between environments
 * - Search functionality
 */

// Mock config first before any imports
jest.mock('../../config', () => ({
    supabaseUrl: 'https://supabase.claritybusinesssolutions.ca',
    supabaseAnonKey: 'test-anon-key',
    supabaseServiceRoleKey: 'test-service-role-key',
    supabaseKey: 'test-anon-key',
    backendConfig: {
        baseUrl: 'https://api.claritybusinesssolutions.ca',
        fileMakerApiUrl: 'https://api.claritybusinesssolutions.ca/filemaker',
        quickBooksApiUrl: 'https://api.claritybusinesssolutions.ca/quickbooks'
    },
    fileMakerConfig: {
        apiUrl: 'https://api.claritybusinesssolutions.ca/filemaker'
    }
}));

// Mock Supabase client
jest.mock('../../api/teams', () => ({
    supabase: {
        from: jest.fn(),
        auth: {
            getSession: jest.fn()
        }
    }
}));

// Mock QuickBooks API
jest.mock('../../api/quickbooksApi', () => ({
    getQBOAuthorizationUrl: jest.fn(),
    handleQBOOAuthCallback: jest.fn(),
    getCompanyInfo: jest.fn(),
    createCustomer: jest.fn(),
    createInvoice: jest.fn(),
    createTimeActivity: jest.fn(),
    getCustomers: jest.fn(),
    getInvoices: jest.fn()
}));

// Mock Supabase service
jest.mock('../../services/supabaseService', () => ({
    query: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    call: jest.fn(),
    uploadFile: jest.fn(),
    downloadFile: jest.fn(),
    deleteFile: jest.fn()
}));

// Mock services that import config
jest.mock('../../services/teamService', () => ({
    getTeams: jest.fn(),
    getTeamById: jest.fn(),
    createTeam: jest.fn(),
    updateTeam: jest.fn(),
    deleteTeam: jest.fn()
}));

// Mock other services
jest.mock('../../services/salesService', () => ({
    getSales: jest.fn(),
    getSaleById: jest.fn(),
    createSale: jest.fn(),
    updateSale: jest.fn()
}));

jest.mock('../../services/taskService', () => ({
    getTasks: jest.fn(),
    getTaskById: jest.fn(),
    createTask: jest.fn(),
    updateTask: jest.fn()
}));

// Mock dependencies
jest.mock('../../services/dataService', () => ({
    dataService: {
        request: jest.fn(),
        get: jest.fn(),
        post: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn()
    },
    getEnvironmentContext: jest.fn(),
    setEnvironmentContext: jest.fn(),
    ENVIRONMENT_TYPES: {
        FILEMAKER: 'filemaker',
        WEBAPP: 'webapp'
    },
    AUTH_METHODS: {
        FILEMAKER: 'filemaker',
        SUPABASE: 'supabase'
    }
}));

jest.mock('../fileMaker', () => ({
    handleFileMakerOperation: jest.fn((fn) => fn()),
    validateParams: jest.fn(),
    Layouts: {
        CUSTOMERS: 'devCustomers'
    },
    Actions: {
        READ: 'READ',
        CREATE: 'CREATE',
        UPDATE: 'UPDATE',
        DELETE: 'DELETE'
    }
}));

jest.mock('../../errors/customerErrors', () => {
    const actual = jest.requireActual('../../errors/customerErrors');
    return {
        ...actual,
        withErrorHandling: jest.fn((fn) => fn()),
        checkOrganizationScope: jest.fn()
    };
});

// Import after mocks are set up
import * as customersApi from '../customers';
import * as dataService from '../../services/dataService';
// DEPRECATED (TSK0017): FileMaker integration removed
// import * as fileMakerApi from '../fileMaker';
import {
    CustomerError,
    CustomerErrorCodes,
    withErrorHandling,
    checkOrganizationScope
} from '../../errors/customerErrors';

describe('Customer API Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Environment Detection', () => {
        it('should route to FileMaker in FileMaker environment', async () => {
            dataService.getEnvironmentContext.mockReturnValue({
                type: dataService.ENVIRONMENT_TYPES.FILEMAKER,
                authentication: { isAuthenticated: true, method: 'filemaker' }
            });

            dataService.dataService.request.mockResolvedValue({
                response: { data: [{ __ID: '1', Name: 'Test Customer' }] }
            });

            await customersApi.fetchCustomers();

            expect(dataService.dataService.request).toHaveBeenCalled();
            expect(dataService.dataService.get).not.toHaveBeenCalled();
        });

        it('should route to Backend API in webapp environment', async () => {
            dataService.getEnvironmentContext.mockReturnValue({
                type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                authentication: {
                    isAuthenticated: true,
                    method: 'supabase',
                    user: { supabaseOrgID: 'org-123' }
                }
            });

            dataService.dataService.get.mockResolvedValue({
                data: [{ id: '1', business_name: 'Test Customer' }]
            });

            await customersApi.fetchCustomers();

            expect(dataService.dataService.get).toHaveBeenCalled();
            expect(dataService.dataService.request).not.toHaveBeenCalled();
        });
    });

    describe('Organization Scoping', () => {
        it('should check organization scope for webapp environment', async () => {
            dataService.getEnvironmentContext.mockReturnValue({
                type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                authentication: {
                    isAuthenticated: true,
                    method: 'supabase',
                    user: { supabaseOrgID: 'org-123' }
                }
            });

            dataService.dataService.get.mockResolvedValue({
                data: []
            });

            await customersApi.fetchCustomers();

            expect(checkOrganizationScope).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: dataService.ENVIRONMENT_TYPES.WEBAPP
                }),
                'fetchCustomers'
            );
        });

        it('should not check organization scope for FileMaker environment', async () => {
            dataService.getEnvironmentContext.mockReturnValue({
                type: dataService.ENVIRONMENT_TYPES.FILEMAKER,
                authentication: { isAuthenticated: true, method: 'filemaker' }
            });

            dataService.dataService.request.mockResolvedValue({
                response: { data: [] }
            });

            await customersApi.fetchCustomers();

            // Should not be called for FileMaker environment
            expect(checkOrganizationScope).not.toHaveBeenCalled();
        });

        it('should throw error if organization scope is missing in webapp', async () => {
            const originalImpl = jest.requireActual('../../errors/customerErrors');
            checkOrganizationScope.mockImplementation(originalImpl.checkOrganizationScope);

            dataService.getEnvironmentContext.mockReturnValue({
                type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                authentication: {
                    isAuthenticated: true,
                    method: 'supabase',
                    user: {} // Missing supabaseOrgID
                }
            });

            await expect(customersApi.fetchCustomers()).rejects.toThrow(CustomerError);
        });
    });

    describe('fetchCustomers', () => {
        describe('Backend API (webapp environment)', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                    authentication: {
                        isAuthenticated: true,
                        method: 'supabase',
                        user: { supabaseOrgID: 'org-123' }
                    }
                });
            });

            it('should fetch customers with pagination', async () => {
                const mockCustomers = [
                    { id: '1', business_name: 'Customer 1', f_active: '1' },
                    { id: '2', business_name: 'Customer 2', f_active: '1' }
                ];

                dataService.dataService.get.mockResolvedValue({
                    data: mockCustomers
                });

                const result = await customersApi.fetchCustomers({
                    limit: 50,
                    offset: 0
                });

                expect(dataService.dataService.get).toHaveBeenCalledWith(
                    '/contacts_api',
                    {
                        params: {
                            limit: 50,
                            offset: 0,
                            include_related: true
                        }
                    }
                );

                expect(result).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({ id: '1', __ID: '1' }),
                        expect.objectContaining({ id: '2', __ID: '2' })
                    ])
                );
            });

            it('should apply optional filters', async () => {
                dataService.dataService.get.mockResolvedValue({ data: [] });

                await customersApi.fetchCustomers({
                    active: true,
                    search: 'test',
                    sort: 'business_name',
                    order: 'asc'
                });

                expect(dataService.dataService.get).toHaveBeenCalledWith(
                    '/contacts_api',
                    {
                        params: {
                            limit: 50,
                            offset: 0,
                            include_related: true,
                            active: true,
                            search: 'test',
                            sort: 'business_name',
                            order: 'asc'
                        }
                    }
                );
            });

            it('should use default pagination values', async () => {
                dataService.dataService.get.mockResolvedValue({ data: [] });

                await customersApi.fetchCustomers();

                expect(dataService.dataService.get).toHaveBeenCalledWith(
                    '/contacts_api',
                    {
                        params: {
                            limit: 50,
                            offset: 0,
                            include_related: true
                        }
                    }
                );
            });
        });

        describe('FileMaker environment', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.FILEMAKER,
                    authentication: { isAuthenticated: true, method: 'filemaker' }
                });
            });

            it('should fetch customers from FileMaker', async () => {
                const mockResponse = {
                    response: {
                        data: [
                            { recordId: '1', fieldData: { Name: 'Customer 1' } },
                            { recordId: '2', fieldData: { Name: 'Customer 2' } }
                        ]
                    }
                };

                dataService.dataService.request.mockResolvedValue(mockResponse);

                const result = await customersApi.fetchCustomers();

                expect(dataService.dataService.request).toHaveBeenCalledWith({
                    layout: 'devCustomers',
                    action: 'READ',
                    query: [{ "__ID": "*" }]
                });

                expect(result).toEqual(mockResponse);
            });
        });
    });

    describe('fetchCustomerById', () => {
        describe('Backend API (webapp environment)', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                    authentication: {
                        isAuthenticated: true,
                        method: 'supabase',
                        user: { supabaseOrgID: 'org-123' }
                    }
                });
            });

            it('should fetch customer by ID', async () => {
                const mockCustomer = {
                    id: 'cust-123',
                    business_name: 'Test Customer',
                    f_active: '1',
                    emails: [{ email: 'test@example.com' }],
                    phones: [{ phone: '555-1234' }]
                };

                dataService.dataService.get.mockResolvedValue({
                    data: mockCustomer
                });

                const result = await customersApi.fetchCustomerById('cust-123');

                expect(dataService.dataService.get).toHaveBeenCalledWith(
                    '/contacts_api/cust-123'
                );

                expect(result).toMatchObject({
                    id: 'cust-123',
                    __ID: 'cust-123',
                    business_name: 'Test Customer'
                });
            });

            it('should validate required customerId parameter', async () => {
                dataService.dataService.get.mockResolvedValue({ data: {} });

                await customersApi.fetchCustomerById('cust-123');

                expect(fileMakerApi.validateParams).toHaveBeenCalledWith(
                    { customerId: 'cust-123' },
                    ['customerId']
                );
            });
        });

        describe('FileMaker environment', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.FILEMAKER,
                    authentication: { isAuthenticated: true, method: 'filemaker' }
                });
            });

            it('should fetch customer by ID from FileMaker', async () => {
                const mockResponse = {
                    response: {
                        data: [
                            { recordId: '1', fieldData: { Name: 'Customer 1' } }
                        ]
                    }
                };

                dataService.dataService.request.mockResolvedValue(mockResponse);

                const result = await customersApi.fetchCustomerById('1');

                expect(dataService.dataService.request).toHaveBeenCalledWith({
                    layout: 'devCustomers',
                    action: 'READ',
                    query: [{ "__ID": '1' }]
                });
            });
        });
    });

    describe('createCustomer', () => {
        describe('Backend API (webapp environment)', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                    authentication: {
                        isAuthenticated: true,
                        method: 'supabase',
                        user: { supabaseOrgID: 'org-123' }
                    }
                });
            });

            it('should create a new customer', async () => {
                const newCustomer = {
                    business_name: 'New Customer',
                    f_active: '1',
                    emails: [{ email: 'new@example.com', is_primary: true }],
                    phones: [{ phone: '555-5678', is_primary: true }]
                };

                const mockResponse = {
                    id: 'cust-new',
                    ...newCustomer,
                    created_at: '2024-01-15T10:00:00Z'
                };

                dataService.dataService.post.mockResolvedValue({
                    data: mockResponse
                });

                const result = await customersApi.createCustomer(newCustomer);

                expect(dataService.dataService.post).toHaveBeenCalledWith(
                    '/contacts_api',
                    newCustomer
                );

                expect(result).toMatchObject({
                    id: 'cust-new',
                    __ID: 'cust-new',
                    business_name: 'New Customer'
                });
            });

            it('should validate required data parameter', async () => {
                dataService.dataService.post.mockResolvedValue({ data: {} });

                await customersApi.createCustomer({ business_name: 'Test' });

                expect(fileMakerApi.validateParams).toHaveBeenCalledWith(
                    { data: { business_name: 'Test' } },
                    ['data']
                );
            });
        });

        describe('FileMaker environment', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.FILEMAKER,
                    authentication: { isAuthenticated: true, method: 'filemaker' }
                });
            });

            it('should create customer in FileMaker', async () => {
                const newCustomer = {
                    Name: 'New Customer',
                    Email: 'new@example.com'
                };

                const mockResponse = {
                    response: {
                        recordId: 'new-1',
                        data: { fieldData: newCustomer }
                    }
                };

                dataService.dataService.request.mockResolvedValue(mockResponse);

                await customersApi.createCustomer(newCustomer);

                expect(dataService.dataService.request).toHaveBeenCalledWith({
                    layout: 'devCustomers',
                    action: 'CREATE',
                    fieldData: newCustomer
                });
            });
        });
    });

    describe('updateCustomer', () => {
        describe('Backend API (webapp environment)', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                    authentication: {
                        isAuthenticated: true,
                        method: 'supabase',
                        user: { supabaseOrgID: 'org-123' }
                    }
                });
            });

            it('should update an existing customer', async () => {
                const updateData = {
                    business_name: 'Updated Customer',
                    f_active: '0'
                };

                const mockResponse = {
                    id: 'cust-123',
                    ...updateData,
                    updated_at: '2024-01-15T10:00:00Z'
                };

                dataService.dataService.patch.mockResolvedValue({
                    data: mockResponse
                });

                const result = await customersApi.updateCustomer('cust-123', updateData);

                expect(dataService.dataService.patch).toHaveBeenCalledWith(
                    '/contacts_api/cust-123',
                    updateData
                );

                expect(result).toMatchObject({
                    id: 'cust-123',
                    __ID: 'cust-123',
                    business_name: 'Updated Customer'
                });
            });

            it('should validate required parameters', async () => {
                dataService.dataService.patch.mockResolvedValue({ data: {} });

                await customersApi.updateCustomer('cust-123', { business_name: 'Test' });

                expect(fileMakerApi.validateParams).toHaveBeenCalledWith(
                    { customerId: 'cust-123', data: { business_name: 'Test' } },
                    ['customerId', 'data']
                );
            });
        });

        describe('FileMaker environment', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.FILEMAKER,
                    authentication: { isAuthenticated: true, method: 'filemaker' }
                });
            });

            it('should update customer in FileMaker', async () => {
                const updateData = { Name: 'Updated Name' };

                const mockResponse = {
                    response: {
                        recordId: '1',
                        data: { fieldData: updateData }
                    }
                };

                dataService.dataService.request.mockResolvedValue(mockResponse);

                await customersApi.updateCustomer('1', updateData);

                expect(dataService.dataService.request).toHaveBeenCalledWith({
                    layout: 'devCustomers',
                    action: 'UPDATE',
                    recordId: '1',
                    fieldData: updateData
                });
            });
        });
    });

    describe('deleteCustomer', () => {
        describe('Backend API (webapp environment)', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                    authentication: {
                        isAuthenticated: true,
                        method: 'supabase',
                        user: { supabaseOrgID: 'org-123' }
                    }
                });
            });

            it('should delete a customer', async () => {
                const mockResponse = { success: true };

                dataService.dataService.delete.mockResolvedValue({
                    data: mockResponse
                });

                const result = await customersApi.deleteCustomer('cust-123');

                expect(dataService.dataService.delete).toHaveBeenCalledWith(
                    '/contacts_api/cust-123'
                );

                expect(result).toEqual(mockResponse);
            });

            it('should validate required customerId parameter', async () => {
                dataService.dataService.delete.mockResolvedValue({ data: {} });

                await customersApi.deleteCustomer('cust-123');

                expect(fileMakerApi.validateParams).toHaveBeenCalledWith(
                    { customerId: 'cust-123' },
                    ['customerId']
                );
            });
        });

        describe('FileMaker environment', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.FILEMAKER,
                    authentication: { isAuthenticated: true, method: 'filemaker' }
                });
            });

            it('should delete customer in FileMaker', async () => {
                const mockResponse = {
                    response: { success: true }
                };

                dataService.dataService.request.mockResolvedValue(mockResponse);

                await customersApi.deleteCustomer('1');

                expect(dataService.dataService.request).toHaveBeenCalledWith({
                    layout: 'devCustomers',
                    action: 'DELETE',
                    recordId: '1'
                });
            });
        });
    });

    describe('toggleCustomerStatus', () => {
        describe('Backend API (webapp environment)', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                    authentication: {
                        isAuthenticated: true,
                        method: 'supabase',
                        user: { supabaseOrgID: 'org-123' }
                    }
                });
            });

            it('should toggle customer status to active', async () => {
                const mockResponse = {
                    id: 'cust-123',
                    f_active: '1'
                };

                dataService.dataService.patch.mockResolvedValue({
                    data: mockResponse
                });

                await customersApi.toggleCustomerStatus('cust-123', true);

                expect(dataService.dataService.patch).toHaveBeenCalledWith(
                    '/contacts_api/cust-123',
                    { f_active: '1' }
                );
            });

            it('should toggle customer status to inactive', async () => {
                const mockResponse = {
                    id: 'cust-123',
                    f_active: '0'
                };

                dataService.dataService.patch.mockResolvedValue({
                    data: mockResponse
                });

                await customersApi.toggleCustomerStatus('cust-123', false);

                expect(dataService.dataService.patch).toHaveBeenCalledWith(
                    '/contacts_api/cust-123',
                    { f_active: '0' }
                );
            });
        });
    });

    describe('fetchActiveCustomers', () => {
        describe('Backend API (webapp environment)', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                    authentication: {
                        isAuthenticated: true,
                        method: 'supabase',
                        user: { supabaseOrgID: 'org-123' }
                    }
                });
            });

            it('should fetch only active customers', async () => {
                const mockCustomers = [
                    { id: '1', business_name: 'Active 1', f_active: '1' },
                    { id: '2', business_name: 'Active 2', f_active: '1' }
                ];

                dataService.dataService.get.mockResolvedValue({
                    data: mockCustomers
                });

                await customersApi.fetchActiveCustomers();

                expect(dataService.dataService.get).toHaveBeenCalledWith(
                    '/contacts_api',
                    { f_active: '1' }
                );
            });
        });

        describe('FileMaker environment', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.FILEMAKER,
                    authentication: { isAuthenticated: true, method: 'filemaker' }
                });
            });

            it('should fetch active customers from FileMaker', async () => {
                const mockResponse = {
                    response: {
                        data: [
                            { recordId: '1', fieldData: { Name: 'Active 1', f_active: '1' } }
                        ]
                    }
                };

                dataService.dataService.request.mockResolvedValue(mockResponse);

                await customersApi.fetchActiveCustomers();

                expect(dataService.dataService.request).toHaveBeenCalledWith({
                    layout: 'devCustomers',
                    action: 'READ',
                    query: [{ "f_active": "1" }]
                });
            });
        });
    });

    describe('searchCustomers', () => {
        describe('Backend API (webapp environment)', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                    authentication: {
                        isAuthenticated: true,
                        method: 'supabase',
                        user: { supabaseOrgID: 'org-123' }
                    }
                });
            });

            it('should search customers with query', async () => {
                const mockResults = [
                    { id: '1', business_name: 'Test Company' }
                ];

                dataService.dataService.get.mockResolvedValue({
                    data: mockResults
                });

                await customersApi.searchCustomers('test', { limit: 20 });

                expect(dataService.dataService.get).toHaveBeenCalledWith(
                    '/api/customers/search',
                    {
                        params: {
                            q: 'test',
                            limit: 20
                        }
                    }
                );
            });

            it('should validate query parameter', async () => {
                dataService.dataService.get.mockResolvedValue({ data: [] });

                await customersApi.searchCustomers('test');

                expect(fileMakerApi.validateParams).toHaveBeenCalledWith(
                    { query: 'test' },
                    ['query']
                );
            });

            it('should throw error for empty query', async () => {
                const originalImpl = jest.requireActual('../../errors/customerErrors');
                withErrorHandling.mockImplementation(originalImpl.withErrorHandling);

                await expect(
                    customersApi.searchCustomers('')
                ).rejects.toThrow(CustomerError);

                await expect(
                    customersApi.searchCustomers('   ')
                ).rejects.toThrow(CustomerError);
            });

            it('should enforce max limit of 100', async () => {
                dataService.dataService.get.mockResolvedValue({ data: [] });

                await customersApi.searchCustomers('test', { limit: 200 });

                expect(dataService.dataService.get).toHaveBeenCalledWith(
                    '/api/customers/search',
                    {
                        params: {
                            q: 'test',
                            limit: 100 // Should be capped at 100
                        }
                    }
                );
            });
        });

        describe('FileMaker environment', () => {
            beforeEach(() => {
                dataService.getEnvironmentContext.mockReturnValue({
                    type: dataService.ENVIRONMENT_TYPES.FILEMAKER,
                    authentication: { isAuthenticated: true, method: 'filemaker' }
                });
            });

            it('should search customers client-side in FileMaker', async () => {
                const mockAllCustomers = {
                    response: {
                        data: [
                            {
                                fieldData: {
                                    Name: 'Test Company',
                                    Email: 'test@example.com',
                                    Phone: '555-1234',
                                    ContactPerson: 'John Doe'
                                }
                            },
                            {
                                fieldData: {
                                    Name: 'Other Company',
                                    Email: 'other@example.com',
                                    Phone: '555-5678',
                                    ContactPerson: 'Jane Smith'
                                }
                            }
                        ]
                    }
                };

                dataService.dataService.request.mockResolvedValue(mockAllCustomers);

                const result = await customersApi.searchCustomers('test');

                expect(result.response.data).toHaveLength(1);
                expect(result.response.data[0].fieldData.Name).toBe('Test Company');
            });

            it('should apply limit to search results', async () => {
                const mockCustomers = {
                    response: {
                        data: Array(50).fill(null).map((_, i) => ({
                            fieldData: {
                                Name: `Test Company ${i}`,
                                Email: '',
                                Phone: '',
                                ContactPerson: ''
                            }
                        }))
                    }
                };

                dataService.dataService.request.mockResolvedValue(mockCustomers);

                const result = await customersApi.searchCustomers('test', { limit: 10 });

                expect(result.response.data).toHaveLength(10);
            });
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            // Use actual implementation for error handling tests
            const originalImpl = jest.requireActual('../../errors/customerErrors');
            withErrorHandling.mockImplementation(originalImpl.withErrorHandling);

            dataService.getEnvironmentContext.mockReturnValue({
                type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                authentication: {
                    isAuthenticated: true,
                    method: 'supabase',
                    user: { supabaseOrgID: 'org-123' }
                }
            });
        });

        it('should handle 404 not found error', async () => {
            const error = new Error('Not found');
            error.response = {
                status: 404,
                data: { message: 'Customer not found' }
            };

            dataService.dataService.get.mockRejectedValue(error);

            await expect(
                customersApi.fetchCustomerById('nonexistent')
            ).rejects.toThrow();
        });

        it('should handle 401 authentication error', async () => {
            const error = new Error('Unauthorized');
            error.response = {
                status: 401,
                data: { message: 'Authentication token expired' }
            };

            dataService.dataService.get.mockRejectedValue(error);

            await expect(
                customersApi.fetchCustomers()
            ).rejects.toThrow();
        });

        it('should handle 403 permission denied error', async () => {
            const error = new Error('Forbidden');
            error.response = {
                status: 403,
                data: { message: 'Permission denied' }
            };

            dataService.dataService.patch.mockRejectedValue(error);

            await expect(
                customersApi.updateCustomer('cust-123', { business_name: 'Test' })
            ).rejects.toThrow();
        });

        it('should handle 400 validation error', async () => {
            const error = new Error('Bad request');
            error.response = {
                status: 400,
                data: {
                    message: 'Validation error',
                    errors: ['Business name is required']
                }
            };

            dataService.dataService.post.mockRejectedValue(error);

            await expect(
                customersApi.createCustomer({})
            ).rejects.toThrow();
        });

        it('should handle network timeout error', async () => {
            const error = new Error('timeout of 10000ms exceeded');
            error.code = 'ECONNABORTED';

            dataService.dataService.get.mockRejectedValue(error);

            await expect(
                customersApi.fetchCustomers()
            ).rejects.toThrow();
        });

        it('should handle network connection error', async () => {
            const error = new Error('Network Error');
            error.code = 'ERR_NETWORK';

            dataService.dataService.get.mockRejectedValue(error);

            await expect(
                customersApi.fetchCustomers()
            ).rejects.toThrow();
        });

        it('should handle 500 server error', async () => {
            const error = new Error('Internal server error');
            error.response = {
                status: 500,
                data: { message: 'Internal server error' }
            };

            dataService.dataService.get.mockRejectedValue(error);

            await expect(
                customersApi.fetchCustomers()
            ).rejects.toThrow();
        });
    });

    describe('Data Normalization', () => {
        beforeEach(() => {
            dataService.getEnvironmentContext.mockReturnValue({
                type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                authentication: {
                    isAuthenticated: true,
                    method: 'supabase',
                    user: { supabaseOrgID: 'org-123' }
                }
            });
        });

        it('should normalize single customer data', async () => {
            const mockCustomer = {
                id: 'cust-123',
                business_name: 'Test Customer'
            };

            dataService.dataService.get.mockResolvedValue({
                data: mockCustomer
            });

            const result = await customersApi.fetchCustomerById('cust-123');

            expect(result).toMatchObject({
                id: 'cust-123',
                __ID: 'cust-123',
                business_name: 'Test Customer'
            });
        });

        it('should normalize array of customers', async () => {
            const mockCustomers = [
                { id: '1', business_name: 'Customer 1' },
                { id: '2', business_name: 'Customer 2' }
            ];

            dataService.dataService.get.mockResolvedValue({
                data: mockCustomers
            });

            const result = await customersApi.fetchCustomers();

            expect(result).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ id: '1', __ID: '1' }),
                    expect.objectContaining({ id: '2', __ID: '2' })
                ])
            );
        });

        it('should handle __ID field from backend', async () => {
            const mockCustomer = {
                __ID: 'legacy-id',
                business_name: 'Test Customer'
            };

            dataService.dataService.get.mockResolvedValue({
                data: mockCustomer
            });

            const result = await customersApi.fetchCustomerById('legacy-id');

            expect(result).toMatchObject({
                id: 'legacy-id',
                __ID: 'legacy-id'
            });
        });

        it('should preserve legacy __ID when id is also present', async () => {
            const mockCustomer = {
                id: 'backend-id',
                __ID: 'legacy-id',
                business_name: 'Test Customer'
            };

            dataService.dataService.get.mockResolvedValue({
                data: mockCustomer
            });

            const result = await customersApi.fetchCustomerById('backend-id');

            expect(result).toMatchObject({
                id: 'backend-id',
                __ID: 'legacy-id'
            });
        });
    });

    describe('Parameter Validation', () => {
        beforeEach(() => {
            dataService.getEnvironmentContext.mockReturnValue({
                type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                authentication: {
                    isAuthenticated: true,
                    method: 'supabase',
                    user: { supabaseOrgID: 'org-123' }
                }
            });
        });

        it('should validate customerId in fetchCustomerById', async () => {
            dataService.dataService.get.mockResolvedValue({ data: {} });

            await customersApi.fetchCustomerById('cust-123');

            expect(fileMakerApi.validateParams).toHaveBeenCalledWith(
                { customerId: 'cust-123' },
                ['customerId']
            );
        });

        it('should validate data in createCustomer', async () => {
            dataService.dataService.post.mockResolvedValue({ data: {} });

            const customerData = { business_name: 'Test' };
            await customersApi.createCustomer(customerData);

            expect(fileMakerApi.validateParams).toHaveBeenCalledWith(
                { data: customerData },
                ['data']
            );
        });

        it('should validate customerId and data in updateCustomer', async () => {
            dataService.dataService.patch.mockResolvedValue({ data: {} });

            const updateData = { business_name: 'Updated' };
            await customersApi.updateCustomer('cust-123', updateData);

            expect(fileMakerApi.validateParams).toHaveBeenCalledWith(
                { customerId: 'cust-123', data: updateData },
                ['customerId', 'data']
            );
        });

        it('should validate customerId in deleteCustomer', async () => {
            dataService.dataService.delete.mockResolvedValue({ data: {} });

            await customersApi.deleteCustomer('cust-123');

            expect(fileMakerApi.validateParams).toHaveBeenCalledWith(
                { customerId: 'cust-123' },
                ['customerId']
            );
        });

        it('should validate query in searchCustomers', async () => {
            dataService.dataService.get.mockResolvedValue({ data: [] });

            await customersApi.searchCustomers('test');

            expect(fileMakerApi.validateParams).toHaveBeenCalledWith(
                { query: 'test' },
                ['query']
            );
        });
    });
});
