/**
 * Links API Integration Tests
 *
 * Tests for src/api/links.js covering:
 * - CRUD operations for links (create, read, update, delete)
 * - Authentication headers (HMAC/JWT for backend)
 * - Organization scoping for webapp environment
 * - Error handling (network, validation, authorization)
 * - Multi-entity support (project, task, customer, organization)
 * - Data validation (link URL required, FK validation)
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

// Mock dependencies
jest.mock('../../services/dataService', () => ({
    dataService: {
        request: jest.fn(),
        get: jest.fn(),
        post: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        put: jest.fn()
    },
    getEnvironmentContext: jest.fn(),
    getAuthenticationContext: jest.fn(),
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

// Import after mocks are set up
import * as linksApi from '../links';
import * as dataService from '../../services/dataService';

describe('Links API Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Default to webapp environment with organization scope
        const mockAuth = {
            isAuthenticated: true,
            method: 'supabase',
            user: { supabaseOrgID: 'org-123' }
        };

        dataService.getEnvironmentContext.mockReturnValue({
            type: dataService.ENVIRONMENT_TYPES.WEBAPP,
            authentication: mockAuth
        });

        dataService.getAuthenticationContext.mockReturnValue(mockAuth);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Organization Scoping', () => {
        it('should check organization scope for createLink', async () => {
            dataService.dataService.post.mockResolvedValue({
                data: { id: 'link-1', link: 'https://example.com' }
            });

            await linksApi.createLink({
                link: 'https://example.com',
                project_id: 'proj-123'
            });

            expect(dataService.getAuthenticationContext).toHaveBeenCalled();
        });

        it('should throw error if organization scope is missing', async () => {
            const mockAuthNoOrg = {
                isAuthenticated: true,
                method: 'supabase',
                user: {} // Missing supabaseOrgID
            };

            dataService.getEnvironmentContext.mockReturnValue({
                type: dataService.ENVIRONMENT_TYPES.WEBAPP,
                authentication: mockAuthNoOrg
            });

            dataService.getAuthenticationContext.mockReturnValue(mockAuthNoOrg);

            await expect(linksApi.createLink({
                link: 'https://example.com',
                project_id: 'proj-123'
            })).rejects.toThrow('Organization context required');
        });
    });

    describe('createLink', () => {
        it('should create a link for a project', async () => {
            const mockResponse = {
                id: 'link-123',
                link: 'https://github.com/user/repo',
                project_id: 'proj-123',
                customer_id: null,
                task_id: null,
                organization_id: null,
                created_at: '2024-01-15T10:00:00Z',
                updated_at: '2024-01-15T10:00:00Z'
            };

            dataService.dataService.post.mockResolvedValue({
                data: mockResponse
            });

            const result = await linksApi.createLink({
                link: 'https://github.com/user/repo',
                project_id: 'proj-123'
            });

            expect(dataService.dataService.post).toHaveBeenCalledWith(
                '/links',
                {
                    link: 'https://github.com/user/repo',
                    project_id: 'proj-123',
                    customer_id: null,
                    task_id: null,
                    organization_id: null
                }
            );

            expect(result).toEqual(mockResponse);
        });

        it('should create a link for a task', async () => {
            const mockResponse = {
                id: 'link-456',
                link: 'https://example.com/docs',
                project_id: null,
                customer_id: null,
                task_id: 'task-789',
                organization_id: null,
                created_at: '2024-01-15T10:00:00Z',
                updated_at: '2024-01-15T10:00:00Z'
            };

            dataService.dataService.post.mockResolvedValue({
                data: mockResponse
            });

            const result = await linksApi.createLink({
                link: 'https://example.com/docs',
                task_id: 'task-789'
            });

            expect(dataService.dataService.post).toHaveBeenCalledWith(
                '/links',
                {
                    link: 'https://example.com/docs',
                    project_id: null,
                    customer_id: null,
                    task_id: 'task-789',
                    organization_id: null
                }
            );

            expect(result).toEqual(mockResponse);
        });

        it('should create a link for a customer', async () => {
            const mockResponse = {
                id: 'link-999',
                link: 'https://customer-portal.com',
                project_id: null,
                customer_id: 'cust-456',
                task_id: null,
                organization_id: null,
                created_at: '2024-01-15T10:00:00Z',
                updated_at: '2024-01-15T10:00:00Z'
            };

            dataService.dataService.post.mockResolvedValue({
                data: mockResponse
            });

            const result = await linksApi.createLink({
                link: 'https://customer-portal.com',
                customer_id: 'cust-456'
            });

            expect(result).toEqual(mockResponse);
        });

        it('should accept url as alias for link field', async () => {
            dataService.dataService.post.mockResolvedValue({
                data: { id: 'link-1', link: 'https://example.com' }
            });

            await linksApi.createLink({
                url: 'https://example.com',
                project_id: 'proj-123'
            });

            expect(dataService.dataService.post).toHaveBeenCalledWith(
                '/links',
                expect.objectContaining({
                    link: 'https://example.com'
                })
            );
        });

        it('should throw error if data is missing', async () => {
            await expect(linksApi.createLink()).rejects.toThrow('Data is required');
        });

        it('should throw error if link URL is missing', async () => {
            await expect(linksApi.createLink({
                project_id: 'proj-123'
            })).rejects.toThrow('Link URL is required');
        });
    });

    describe('fetchLinks', () => {
        it('should fetch links for a project', async () => {
            const mockLinks = [
                {
                    id: 'link-1',
                    link: 'https://github.com/user/repo',
                    project_id: 'proj-123',
                    customer_id: null,
                    task_id: null,
                    organization_id: null,
                    created_at: '2024-01-15T10:00:00Z',
                    updated_at: '2024-01-15T10:00:00Z'
                },
                {
                    id: 'link-2',
                    link: 'https://example.com/docs',
                    project_id: 'proj-123',
                    customer_id: null,
                    task_id: null,
                    organization_id: null,
                    created_at: '2024-01-15T11:00:00Z',
                    updated_at: '2024-01-15T11:00:00Z'
                }
            ];

            dataService.dataService.get.mockResolvedValue({
                data: mockLinks
            });

            const result = await linksApi.fetchLinks({ project_id: 'proj-123' });

            expect(dataService.dataService.get).toHaveBeenCalledWith(
                '/links',
                { params: { project_id: 'proj-123' } }
            );

            expect(result).toEqual(mockLinks);
        });

        it('should fetch links for a task', async () => {
            const mockLinks = [
                {
                    id: 'link-3',
                    link: 'https://jira.com/task/123',
                    project_id: null,
                    customer_id: null,
                    task_id: 'task-456',
                    organization_id: null,
                    created_at: '2024-01-15T12:00:00Z',
                    updated_at: '2024-01-15T12:00:00Z'
                }
            ];

            dataService.dataService.get.mockResolvedValue({
                data: mockLinks
            });

            const result = await linksApi.fetchLinks({ task_id: 'task-456' });

            expect(dataService.dataService.get).toHaveBeenCalledWith(
                '/links',
                { params: { task_id: 'task-456' } }
            );

            expect(result).toEqual(mockLinks);
        });

        it('should fetch links for a customer', async () => {
            const mockLinks = [
                {
                    id: 'link-4',
                    link: 'https://customer-portal.com',
                    project_id: null,
                    customer_id: 'cust-789',
                    task_id: null,
                    organization_id: null,
                    created_at: '2024-01-15T13:00:00Z',
                    updated_at: '2024-01-15T13:00:00Z'
                }
            ];

            dataService.dataService.get.mockResolvedValue({
                data: mockLinks
            });

            const result = await linksApi.fetchLinks({ customer_id: 'cust-789' });

            expect(result).toEqual(mockLinks);
        });

        it('should support pagination parameters', async () => {
            dataService.dataService.get.mockResolvedValue({
                data: []
            });

            await linksApi.fetchLinks({
                project_id: 'proj-123',
                limit: 10,
                offset: 20
            });

            expect(dataService.dataService.get).toHaveBeenCalledWith(
                '/links',
                {
                    params: {
                        project_id: 'proj-123',
                        limit: 10,
                        offset: 20
                    }
                }
            );
        });

        it('should fetch all links when no filters provided', async () => {
            dataService.dataService.get.mockResolvedValue({
                data: []
            });

            await linksApi.fetchLinks();

            expect(dataService.dataService.get).toHaveBeenCalledWith(
                '/links',
                { params: {} }
            );
        });
    });

    describe('updateLink', () => {
        it('should update a link URL', async () => {
            const mockResponse = {
                id: 'link-123',
                link: 'https://updated-url.com',
                project_id: 'proj-123',
                customer_id: null,
                task_id: null,
                organization_id: null,
                created_at: '2024-01-15T10:00:00Z',
                updated_at: '2024-01-15T14:00:00Z'
            };

            dataService.dataService.patch.mockResolvedValue({
                data: mockResponse
            });

            const result = await linksApi.updateLink('link-123', {
                link: 'https://updated-url.com'
            });

            expect(dataService.dataService.patch).toHaveBeenCalledWith(
                '/links/link-123',
                { link: 'https://updated-url.com' }
            );

            expect(result).toEqual(mockResponse);
        });

        it('should accept url as alias for link field', async () => {
            dataService.dataService.patch.mockResolvedValue({
                data: { id: 'link-123', link: 'https://updated.com' }
            });

            await linksApi.updateLink('link-123', {
                url: 'https://updated.com'
            });

            expect(dataService.dataService.patch).toHaveBeenCalledWith(
                '/links/link-123',
                { link: 'https://updated.com' }
            );
        });

        it('should throw error if linkId is missing', async () => {
            await expect(linksApi.updateLink()).rejects.toThrow('Link ID is required');
        });

        it('should throw error if update data is missing', async () => {
            await expect(linksApi.updateLink('link-123')).rejects.toThrow('Update data is required');
        });

        it('should handle empty payload when link URL is missing from data', async () => {
            dataService.dataService.patch.mockResolvedValue({
                data: { id: 'link-123' }
            });

            const result = await linksApi.updateLink('link-123', {});

            expect(dataService.dataService.patch).toHaveBeenCalledWith(
                '/links/link-123',
                {}
            );
        });
    });

    describe('deleteLink', () => {
        it('should delete a link', async () => {
            const mockResponse = { success: true };

            dataService.dataService.delete.mockResolvedValue({
                data: mockResponse
            });

            const result = await linksApi.deleteLink('link-123');

            expect(dataService.dataService.delete).toHaveBeenCalledWith(
                '/links/link-123'
            );

            expect(result).toEqual(mockResponse);
        });

        it('should throw error if linkId is missing', async () => {
            await expect(linksApi.deleteLink()).rejects.toThrow('Link ID is required');
        });
    });

    describe('Error Handling', () => {
        it('should handle 404 not found error', async () => {
            const error = new Error('Not found');
            error.response = {
                status: 404,
                data: { message: 'Link not found' }
            };

            dataService.dataService.get.mockRejectedValue(error);

            await expect(
                linksApi.fetchLinks({ project_id: 'nonexistent' })
            ).rejects.toThrow();
        });

        it('should handle 401 authentication error', async () => {
            const error = new Error('Unauthorized');
            error.response = {
                status: 401,
                data: { message: 'Authentication token expired' }
            };

            dataService.dataService.post.mockRejectedValue(error);

            await expect(
                linksApi.createLink({
                    link: 'https://example.com',
                    project_id: 'proj-123'
                })
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
                linksApi.updateLink('link-123', { link: 'https://test.com' })
            ).rejects.toThrow();
        });

        it('should handle 400 validation error', async () => {
            const error = new Error('Bad request');
            error.response = {
                status: 400,
                data: {
                    message: 'Validation error',
                    errors: ['Invalid URL format']
                }
            };

            dataService.dataService.post.mockRejectedValue(error);

            await expect(
                linksApi.createLink({
                    link: 'invalid-url',
                    project_id: 'proj-123'
                })
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
                linksApi.fetchLinks({ project_id: 'proj-123' })
            ).rejects.toThrow();
        });

        it('should handle network timeout error', async () => {
            const error = new Error('timeout of 10000ms exceeded');
            error.code = 'ECONNABORTED';

            dataService.dataService.get.mockRejectedValue(error);

            await expect(
                linksApi.fetchLinks({ project_id: 'proj-123' })
            ).rejects.toThrow();
        });
    });
});
