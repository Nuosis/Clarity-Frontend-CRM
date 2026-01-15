/**
 * Link Service Tests
 *
 * Tests for src/services/linkService.js covering:
 * - Backend link transformation (snake_case to camelCase)
 * - Link creation with parent entity types
 * - Link fetching with entity filtering
 * - Link updates with URL validation
 * - Link deletion
 * - FileMaker data processing (legacy support)
 */

// Mock dependencies
jest.mock('../dataService', () => ({
    getEnvironmentContext: jest.fn(),
    ENVIRONMENT_TYPES: {
        FILEMAKER: 'filemaker',
        WEBAPP: 'webapp'
    }
}));

jest.mock('../../api/links', () => ({
    createLink: jest.fn(),
    fetchLinks: jest.fn(),
    updateLink: jest.fn(),
    deleteLink: jest.fn()
}));

// Import after mocks
import * as linkService from '../linkService';
import * as linksApi from '../../api/links';
import * as dataService from '../dataService';

describe('Link Service Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Default to webapp environment
        dataService.getEnvironmentContext.mockReturnValue({
            type: dataService.ENVIRONMENT_TYPES.WEBAPP,
            authentication: {
                isAuthenticated: true,
                method: 'supabase',
                user: { supabaseOrgID: 'org-123' }
            }
        });
    });

    describe('transformBackendLink', () => {
        it('should transform backend link to frontend format', () => {
            const backendLink = {
                id: 'link-123',
                link: 'https://github.com/user/repo',
                project_id: 'proj-456',
                customer_id: null,
                task_id: null,
                organization_id: 'org-789',
                created_at: '2024-01-15T10:00:00Z',
                updated_at: '2024-01-15T11:00:00Z'
            };

            const result = linkService.transformBackendLink(backendLink);

            expect(result).toEqual({
                id: 'link-123',
                url: 'https://github.com/user/repo',
                title: 'github.com',
                projectId: 'proj-456',
                customerId: null,
                taskId: null,
                organizationId: 'org-789',
                createdAt: '2024-01-15T10:00:00Z',
                updatedAt: '2024-01-15T11:00:00Z'
            });
        });

        it('should handle invalid URL gracefully', () => {
            const backendLink = {
                id: 'link-123',
                link: 'not-a-valid-url',
                project_id: 'proj-456',
                customer_id: null,
                task_id: null,
                organization_id: 'org-789',
                created_at: '2024-01-15T10:00:00Z',
                updated_at: '2024-01-15T11:00:00Z'
            };

            const result = linkService.transformBackendLink(backendLink);

            expect(result.title).toBe('not-a-valid-url');
            expect(result.url).toBe('not-a-valid-url');
        });

        it('should return null if backendLink is null', () => {
            const result = linkService.transformBackendLink(null);
            expect(result).toBeNull();
        });

        it('should handle missing link field', () => {
            const backendLink = {
                id: 'link-123',
                project_id: 'proj-456',
                created_at: '2024-01-15T10:00:00Z'
            };

            const result = linkService.transformBackendLink(backendLink);

            expect(result.url).toBeUndefined();
            expect(result.title).toBeNull();
        });
    });

    describe('createNewLink', () => {
        it('should create link with legacy signature (fkId, link)', async () => {
            const mockBackendResponse = {
                id: 'link-123',
                link: 'https://example.com',
                project_id: 'proj-456',
                customer_id: null,
                task_id: null,
                organization_id: 'org-789',
                created_at: '2024-01-15T10:00:00Z',
                updated_at: '2024-01-15T10:00:00Z'
            };

            linksApi.createLink.mockResolvedValue(mockBackendResponse);

            const result = await linkService.createNewLink('proj-456', 'https://example.com');

            expect(linksApi.createLink).toHaveBeenCalledWith({
                project_id: 'proj-456',
                link: 'https://example.com'
            });

            expect(result).toEqual(
                expect.objectContaining({
                    id: 'link-123',
                    url: 'https://example.com',
                    projectId: 'proj-456'
                })
            );
        });

        it('should create link with task parentType', async () => {
            const mockBackendResponse = {
                id: 'link-123',
                link: 'https://example.com',
                project_id: null,
                customer_id: null,
                task_id: 'task-456',
                organization_id: 'org-789',
                created_at: '2024-01-15T10:00:00Z',
                updated_at: '2024-01-15T10:00:00Z'
            };

            linksApi.createLink.mockResolvedValue(mockBackendResponse);

            const result = await linkService.createNewLink('task-456', 'https://example.com', 'task');

            expect(linksApi.createLink).toHaveBeenCalledWith({
                task_id: 'task-456',
                link: 'https://example.com'
            });

            expect(result.taskId).toBe('task-456');
            expect(result.projectId).toBeNull();
        });

        it('should create link with customer parentType', async () => {
            const mockBackendResponse = {
                id: 'link-123',
                link: 'https://example.com',
                project_id: null,
                customer_id: 'cust-456',
                task_id: null,
                organization_id: 'org-789',
                created_at: '2024-01-15T10:00:00Z',
                updated_at: '2024-01-15T10:00:00Z'
            };

            linksApi.createLink.mockResolvedValue(mockBackendResponse);

            const result = await linkService.createNewLink('cust-456', 'https://example.com', 'customer');

            expect(linksApi.createLink).toHaveBeenCalledWith({
                customer_id: 'cust-456',
                link: 'https://example.com'
            });

            expect(result.customerId).toBe('cust-456');
        });

        it('should create link with params object signature', async () => {
            const mockBackendResponse = {
                id: 'link-123',
                link: 'https://example.com',
                project_id: 'proj-456',
                customer_id: null,
                task_id: null,
                organization_id: 'org-789',
                created_at: '2024-01-15T10:00:00Z',
                updated_at: '2024-01-15T10:00:00Z'
            };

            linksApi.createLink.mockResolvedValue(mockBackendResponse);

            const result = await linkService.createNewLink({
                project_id: 'proj-456',
                link: 'https://example.com'
            });

            expect(linksApi.createLink).toHaveBeenCalledWith({
                project_id: 'proj-456',
                link: 'https://example.com'
            });

            expect(result.projectId).toBe('proj-456');
        });

        it('should normalize url field to link field', async () => {
            const mockBackendResponse = {
                id: 'link-123',
                link: 'https://example.com',
                project_id: 'proj-456',
                customer_id: null,
                task_id: null,
                organization_id: 'org-789',
                created_at: '2024-01-15T10:00:00Z',
                updated_at: '2024-01-15T10:00:00Z'
            };

            linksApi.createLink.mockResolvedValue(mockBackendResponse);

            await linkService.createNewLink({
                project_id: 'proj-456',
                url: 'https://example.com'
            });

            expect(linksApi.createLink).toHaveBeenCalledWith({
                project_id: 'proj-456',
                link: 'https://example.com'
            });
        });

        it('should throw error if ID is missing', async () => {
            await expect(
                linkService.createNewLink(null, 'https://example.com')
            ).rejects.toThrow();
        });

        it('should throw error if link URL is missing', async () => {
            await expect(
                linkService.createNewLink('proj-123', '')
            ).rejects.toThrow('ID and link URL are required');
        });

        it('should validate URL format', async () => {
            await expect(
                linkService.createNewLink('proj-123', 'not-a-valid-url')
            ).rejects.toThrow('Invalid URL format');
        });
    });

    describe('fetchLinksByProject', () => {
        it('should fetch and transform project links', async () => {
            const mockBackendLinks = [
                {
                    id: 'link-1',
                    link: 'https://github.com/user/repo',
                    project_id: 'proj-123',
                    customer_id: null,
                    task_id: null,
                    organization_id: 'org-789',
                    created_at: '2024-01-15T10:00:00Z',
                    updated_at: '2024-01-15T10:00:00Z'
                },
                {
                    id: 'link-2',
                    link: 'https://example.com/docs',
                    project_id: 'proj-123',
                    customer_id: null,
                    task_id: null,
                    organization_id: 'org-789',
                    created_at: '2024-01-15T11:00:00Z',
                    updated_at: '2024-01-15T11:00:00Z'
                }
            ];

            linksApi.fetchLinks.mockResolvedValue(mockBackendLinks);

            const result = await linkService.fetchLinksByProject('proj-123');

            expect(linksApi.fetchLinks).toHaveBeenCalledWith({
                project_id: 'proj-123'
            });

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual(
                expect.objectContaining({
                    id: 'link-1',
                    url: 'https://github.com/user/repo',
                    projectId: 'proj-123'
                })
            );
        });

        it('should throw error if projectId is missing', async () => {
            await expect(
                linkService.fetchLinksByProject()
            ).rejects.toThrow('Project ID is required');
        });

        it('should return empty array if no links found', async () => {
            linksApi.fetchLinks.mockResolvedValue([]);

            const result = await linkService.fetchLinksByProject('proj-123');

            expect(result).toEqual([]);
        });
    });

    describe('fetchLinksByEntity', () => {
        it('should fetch links for a task', async () => {
            const mockBackendLinks = [
                {
                    id: 'link-1',
                    link: 'https://jira.com/task/123',
                    project_id: null,
                    customer_id: null,
                    task_id: 'task-456',
                    organization_id: 'org-789',
                    created_at: '2024-01-15T10:00:00Z',
                    updated_at: '2024-01-15T10:00:00Z'
                }
            ];

            linksApi.fetchLinks.mockResolvedValue(mockBackendLinks);

            const result = await linkService.fetchLinksByEntity('task', 'task-456');

            expect(linksApi.fetchLinks).toHaveBeenCalledWith({
                task_id: 'task-456'
            });

            expect(result).toHaveLength(1);
            expect(result[0].taskId).toBe('task-456');
        });

        it('should fetch links for a customer', async () => {
            const mockBackendLinks = [
                {
                    id: 'link-1',
                    link: 'https://customer-portal.com',
                    project_id: null,
                    customer_id: 'cust-789',
                    task_id: null,
                    organization_id: 'org-789',
                    created_at: '2024-01-15T10:00:00Z',
                    updated_at: '2024-01-15T10:00:00Z'
                }
            ];

            linksApi.fetchLinks.mockResolvedValue(mockBackendLinks);

            const result = await linkService.fetchLinksByEntity('customer', 'cust-789');

            expect(linksApi.fetchLinks).toHaveBeenCalledWith({
                customer_id: 'cust-789'
            });

            expect(result).toHaveLength(1);
            expect(result[0].customerId).toBe('cust-789');
        });

        it('should support pagination options', async () => {
            linksApi.fetchLinks.mockResolvedValue([]);

            await linkService.fetchLinksByEntity('project', 'proj-123', {
                limit: 10,
                offset: 20
            });

            expect(linksApi.fetchLinks).toHaveBeenCalledWith({
                project_id: 'proj-123',
                limit: 10,
                offset: 20
            });
        });

        it('should throw error if entityType is missing', async () => {
            await expect(
                linkService.fetchLinksByEntity(null, 'id-123')
            ).rejects.toThrow('Entity type and ID are required');
        });

        it('should throw error if entityId is missing', async () => {
            await expect(
                linkService.fetchLinksByEntity('project', null)
            ).rejects.toThrow('Entity type and ID are required');
        });
    });

    describe('updateExistingLink', () => {
        it('should update link URL', async () => {
            const mockBackendResponse = {
                id: 'link-123',
                link: 'https://updated-url.com',
                project_id: 'proj-456',
                customer_id: null,
                task_id: null,
                organization_id: 'org-789',
                created_at: '2024-01-15T10:00:00Z',
                updated_at: '2024-01-15T14:00:00Z'
            };

            linksApi.updateLink.mockResolvedValue(mockBackendResponse);

            const result = await linkService.updateExistingLink('link-123', {
                link: 'https://updated-url.com'
            });

            expect(linksApi.updateLink).toHaveBeenCalledWith('link-123', {
                link: 'https://updated-url.com'
            });

            expect(result).toEqual(
                expect.objectContaining({
                    id: 'link-123',
                    url: 'https://updated-url.com'
                })
            );
        });

        it('should accept url as alias for link field', async () => {
            const mockBackendResponse = {
                id: 'link-123',
                link: 'https://updated-url.com',
                project_id: 'proj-456',
                customer_id: null,
                task_id: null,
                organization_id: 'org-789',
                created_at: '2024-01-15T10:00:00Z',
                updated_at: '2024-01-15T14:00:00Z'
            };

            linksApi.updateLink.mockResolvedValue(mockBackendResponse);

            await linkService.updateExistingLink('link-123', {
                url: 'https://updated-url.com'
            });

            expect(linksApi.updateLink).toHaveBeenCalledWith('link-123', {
                link: 'https://updated-url.com'
            });
        });

        it('should validate URL format', async () => {
            await expect(
                linkService.updateExistingLink('link-123', {
                    link: 'not-a-valid-url'
                })
            ).rejects.toThrow('Invalid URL format');
        });

        it('should throw error if linkId is missing', async () => {
            await expect(
                linkService.updateExistingLink(null, { link: 'https://example.com' })
            ).rejects.toThrow('Link ID is required');
        });

        it('should throw error if data is missing', async () => {
            await expect(
                linkService.updateExistingLink('link-123', null)
            ).rejects.toThrow('Link URL is required');
        });

        it('should throw error if link URL is missing from data', async () => {
            await expect(
                linkService.updateExistingLink('link-123', {})
            ).rejects.toThrow('Link URL is required');
        });
    });

    describe('deleteLinkById', () => {
        it('should delete a link', async () => {
            const mockResponse = { success: true };

            linksApi.deleteLink.mockResolvedValue(mockResponse);

            const result = await linkService.deleteLinkById('link-123');

            expect(linksApi.deleteLink).toHaveBeenCalledWith('link-123');
            expect(result).toEqual(mockResponse);
        });

        it('should throw error if linkId is missing', async () => {
            await expect(
                linkService.deleteLinkById()
            ).rejects.toThrow('Link ID is required');
        });
    });

    describe('processLinks (FileMaker legacy)', () => {
        it('should process FileMaker links data', () => {
            const fileMakerData = {
                response: {
                    data: [
                        {
                            recordID: 'rec-1',
                            fieldData: {
                                __ID: 'link-1',
                                link: 'https://github.com/user/repo',
                                '~creationTimestamp': '01/15/2024 10:00:00',
                                '~createdBy': 'user@example.com'
                            }
                        },
                        {
                            recordID: 'rec-2',
                            fieldData: {
                                __ID: 'link-2',
                                link: 'https://example.com/docs',
                                '~creationTimestamp': '01/15/2024 11:00:00',
                                '~createdBy': 'admin@example.com'
                            }
                        }
                    ]
                }
            };

            const result = linkService.processLinks(fileMakerData);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                id: 'link-2',
                recordId: 'rec-2',
                url: 'https://example.com/docs',
                createdAt: '01/15/2024 11:00:00',
                createdBy: 'admin@example.com'
            });

            // Verify sorted by newest first
            expect(result[1]).toEqual({
                id: 'link-1',
                recordId: 'rec-1',
                url: 'https://github.com/user/repo',
                createdAt: '01/15/2024 10:00:00',
                createdBy: 'user@example.com'
            });
        });

        it('should return empty array if data is missing', () => {
            expect(linkService.processLinks(null)).toEqual([]);
            expect(linkService.processLinks({})).toEqual([]);
            expect(linkService.processLinks({ response: {} })).toEqual([]);
        });
    });
});
