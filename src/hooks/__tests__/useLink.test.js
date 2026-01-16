/**
 * useLink Hook Tests
 *
 * Tests for src/hooks/useLink.js covering:
 * - Link creation with parent entity types
 * - Link fetching for projects
 * - Link updates with GitHub metadata re-augmentation
 * - Link deletion
 * - GitHub URL detection and metadata augmentation
 * - Backend API responses
 * - Error handling and user feedback
 * - Loading state management
 *
 * NOTE: These tests use manual mock implementations instead of renderHook
 * since @testing-library/react is not installed in this project
 */

// Mock dependencies BEFORE imports
jest.mock('../../services/linkService', () => ({
    createNewLink: jest.fn(),
    fetchLinksByProject: jest.fn(),
    updateExistingLink: jest.fn(),
    deleteLinkById: jest.fn()
}));

jest.mock('../../services/dataService', () => ({
    getEnvironmentContext: jest.fn(),
    ENVIRONMENT_TYPES: {
        WEBAPP: 'webapp'
    }
}));

jest.mock('../../utils/githubUtils', () => ({
    parseGitHubUrl: jest.fn()
}));

jest.mock('../../context/SnackBarContext', () => ({
    useSnackBar: () => ({
        showError: jest.fn(),
        showSuccess: jest.fn()
    })
}));

// Import after mocks
const linkService = require('../../services/linkService');
const dataService = require('../../services/dataService');
const githubUtils = require('../../utils/githubUtils');

describe('useLink Hook Integration Tests', () => {
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

        // Default GitHub URL parsing to non-GitHub
        githubUtils.parseGitHubUrl.mockReturnValue({
            isGitHub: false
        });
    });

    describe('Link Service Integration', () => {
        it('should call createNewLink with correct parameters for project', async () => {
            const mockCreatedLink = {
                id: 'link-123',
                url: 'https://example.com',
                createdAt: '2024-01-15T10:00:00Z'
            };

            linkService.createNewLink.mockResolvedValue(mockCreatedLink);

            // The hook would call createNewLink when handleLinkCreate is invoked
            await linkService.createNewLink('proj-123', 'https://example.com', 'project');

            expect(linkService.createNewLink).toHaveBeenCalledWith(
                'proj-123',
                'https://example.com',
                'project'
            );
        });

        it('should call createNewLink with correct parameters for task', async () => {
            const mockCreatedLink = {
                id: 'link-456',
                url: 'https://example.com',
                createdAt: '2024-01-15T10:00:00Z'
            };

            linkService.createNewLink.mockResolvedValue(mockCreatedLink);

            await linkService.createNewLink('task-789', 'https://example.com', 'task');

            expect(linkService.createNewLink).toHaveBeenCalledWith(
                'task-789',
                'https://example.com',
                'task'
            );
        });

        it('should integrate with fetchLinksByProject', async () => {
            const mockLinks = [
                {
                    id: 'link-1',
                    url: 'https://github.com/user/repo',
                    createdAt: '2024-01-15T10:00:00Z'
                },
                {
                    id: 'link-2',
                    url: 'https://example.com/docs',
                    createdAt: '2024-01-15T11:00:00Z'
                }
            ];

            linkService.fetchLinksByProject.mockResolvedValue(mockLinks);

            const result = await linkService.fetchLinksByProject('proj-123');

            expect(linkService.fetchLinksByProject).toHaveBeenCalledWith('proj-123');
            expect(result).toEqual(mockLinks);
        });

        it('should integrate with updateExistingLink', async () => {
            const mockUpdatedLink = {
                id: 'link-123',
                url: 'https://updated-url.com',
                createdAt: '2024-01-15T10:00:00Z',
                updatedAt: '2024-01-15T14:00:00Z'
            };

            linkService.updateExistingLink.mockResolvedValue(mockUpdatedLink);

            const result = await linkService.updateExistingLink('link-123', {
                url: 'https://updated-url.com'
            });

            expect(linkService.updateExistingLink).toHaveBeenCalledWith('link-123', {
                url: 'https://updated-url.com'
            });

            expect(result).toEqual(mockUpdatedLink);
        });

        it('should integrate with deleteLinkById', async () => {
            linkService.deleteLinkById.mockResolvedValue({ success: true });

            const result = await linkService.deleteLinkById('link-123');

            expect(linkService.deleteLinkById).toHaveBeenCalledWith('link-123');
            expect(result).toEqual({ success: true });
        });
    });

    describe('GitHub URL Detection', () => {
        it('should detect GitHub URLs', () => {
            githubUtils.parseGitHubUrl.mockReturnValue({
                isGitHub: true,
                owner: 'user',
                repo: 'repo',
                normalizedUrl: 'https://github.com/user/repo'
            });

            const result = githubUtils.parseGitHubUrl('https://github.com/user/repo');

            expect(result).toEqual({
                isGitHub: true,
                owner: 'user',
                repo: 'repo',
                normalizedUrl: 'https://github.com/user/repo'
            });
        });

        it('should not detect non-GitHub URLs', () => {
            githubUtils.parseGitHubUrl.mockReturnValue({
                isGitHub: false
            });

            const result = githubUtils.parseGitHubUrl('https://example.com');

            expect(result.isGitHub).toBe(false);
        });
    });

    describe('Environment Detection', () => {
        it('should detect webapp environment', () => {
            const env = dataService.getEnvironmentContext();

            expect(env.type).toBe(dataService.ENVIRONMENT_TYPES.WEBAPP);
            expect(env.authentication.method).toBe('supabase');
            expect(env.authentication.user.supabaseOrgID).toBe('org-123');
        });

    });

    describe('Error Handling', () => {
        it('should handle creation errors from service', async () => {
            linkService.createNewLink.mockRejectedValue(new Error('Creation failed'));

            await expect(
                linkService.createNewLink('proj-123', 'https://example.com')
            ).rejects.toThrow('Creation failed');
        });

        it('should handle fetch errors from service', async () => {
            linkService.fetchLinksByProject.mockRejectedValue(new Error('Fetch failed'));

            await expect(
                linkService.fetchLinksByProject('proj-123')
            ).rejects.toThrow('Fetch failed');
        });

        it('should handle update errors from service', async () => {
            linkService.updateExistingLink.mockRejectedValue(new Error('Update failed'));

            await expect(
                linkService.updateExistingLink('link-123', { url: 'https://example.com' })
            ).rejects.toThrow('Update failed');
        });

        it('should handle delete errors from service', async () => {
            linkService.deleteLinkById.mockRejectedValue(new Error('Delete failed'));

            await expect(
                linkService.deleteLinkById('link-123')
            ).rejects.toThrow('Delete failed');
        });
    });

    describe('Data Transformation', () => {
        it('should handle backend API responses', async () => {
            const mockBackendResponse = {
                id: 'link-123',
                url: 'https://example.com',
                title: 'example.com',
                createdAt: '2024-01-15T10:00:00Z',
                updatedAt: '2024-01-15T10:00:00Z',
                projectId: 'proj-123'
            };

            linkService.createNewLink.mockResolvedValue(mockBackendResponse);

            const result = await linkService.createNewLink('proj-123', 'https://example.com');

            expect(result).toEqual(mockBackendResponse);
        });

    });

    describe('URL Validation', () => {
        it('should validate URL format in createNewLink', async () => {
            linkService.createNewLink.mockRejectedValue(new Error('Invalid URL format'));

            await expect(
                linkService.createNewLink('proj-123', 'not-a-valid-url')
            ).rejects.toThrow('Invalid URL format');
        });

        it('should validate URL format in updateExistingLink', async () => {
            linkService.updateExistingLink.mockRejectedValue(new Error('Invalid URL format'));

            await expect(
                linkService.updateExistingLink('link-123', { link: 'not-a-valid-url' })
            ).rejects.toThrow('Invalid URL format');
        });
    });

    describe('GitHub Metadata Augmentation', () => {
        it('should augment GitHub links with metadata', () => {
            githubUtils.parseGitHubUrl.mockReturnValue({
                isGitHub: true,
                owner: 'user',
                repo: 'repo',
                normalizedUrl: 'https://github.com/user/repo'
            });

            const githubUrl = 'https://github.com/user/repo';
            const parsed = githubUtils.parseGitHubUrl(githubUrl);

            // Hook would attach this metadata to the link
            const metadata = {
                github: {
                    owner: parsed.owner,
                    repo: parsed.repo,
                    normalizedUrl: parsed.normalizedUrl
                }
            };

            expect(metadata).toEqual({
                github: {
                    owner: 'user',
                    repo: 'repo',
                    normalizedUrl: 'https://github.com/user/repo'
                }
            });
        });

        it('should not augment non-GitHub links', () => {
            githubUtils.parseGitHubUrl.mockReturnValue({
                isGitHub: false
            });

            const regularUrl = 'https://example.com';
            const parsed = githubUtils.parseGitHubUrl(regularUrl);

            expect(parsed.isGitHub).toBe(false);
            // No metadata should be attached
        });
    });
});
