import { useState, useCallback } from 'react';
import { useSnackBar } from '../context/SnackBarContext';
import { createNewLink, fetchLinksByProject, updateExistingLink, deleteLinkById } from '../services/linkService';
import { parseGitHubUrl } from '../utils/githubUtils';
import { getEnvironmentContext, ENVIRONMENT_TYPES } from '../services/dataService';

/**
 * Hook for managing link operations
 * Environment-aware: Handles both backend API and FileMaker environments
 */
export function useLink() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const { showError } = useSnackBar();

    /**
     * Create a new link for a record.
     * Automatically detects GitHub repository URLs and augments the returned link object
     * with metadata.github { owner, repo, normalizedUrl } for non-invasive tagging (Phase 1).
     * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment.
     *
     * @param {string} fkId - Foreign key ID (e.g., Task or Project ID)
     * @param {string} linkUrl - The URL to link
     * @param {string} [parentType='project'] - Type of parent entity (project/task/customer/organization)
     * @returns {Promise<{id: string, url: string, createdAt: string, metadata?: { github: { owner: string, repo: string, normalizedUrl: string }}}|null>}
     */
    const handleLinkCreate = useCallback(async (fkId, linkUrl, parentType = 'project') => {
        if (!fkId || !linkUrl?.trim()) {
            showError('Entity ID and link URL are required');
            return null;
        }

        try {
            setLoading(true);
            setError(null);

            const env = getEnvironmentContext();
            const trimmedUrl = linkUrl.trim();

            // Phase 1: local-only GitHub URL detection (no API calls)
            const gh = parseGitHubUrl(trimmedUrl);
            const isGitHub = gh?.isGitHub && gh.owner && gh.repo;
            const metadata = isGitHub
                ? { github: { owner: gh.owner, repo: gh.repo, normalizedUrl: gh.normalizedUrl || trimmedUrl } }
                : undefined;

            // Pass parentType to createNewLink so it creates the correct FK
            const result = await createNewLink(fkId, trimmedUrl, parentType);

            // Handle response based on environment
            let newLink;
            if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
                if (!result?.response?.recordId) {
                    throw new Error('Failed to create link: No record ID returned');
                }

                newLink = {
                    id: result.response.recordId,
                    url: trimmedUrl,
                    createdAt: new Date().toISOString()
                };
            } else {
                // Backend API response (already transformed by linkService)
                if (!result?.id) {
                    throw new Error('Failed to create link: No ID returned');
                }

                newLink = {
                    id: result.id,
                    url: result.url || trimmedUrl,
                    title: result.title || new URL(trimmedUrl).hostname,
                    createdAt: result.createdAt || new Date().toISOString()
                };
            }

            // Non-invasive augmentation: attach metadata only if GitHub repo detected
            if (metadata) {
                newLink.metadata = metadata;
            }

            return newLink;
        } catch (err) {
            const errorMessage = err.message || 'Error creating link';
            setError(errorMessage);
            showError(errorMessage);
            return null;
        } finally {
            setLoading(false);
        }
    }, [showError]);

    /**
     * Fetch links for a project
     * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
     * @param {string} projectId - Project ID
     * @returns {Promise<Array>} Array of links
     */
    const handleFetchLinks = useCallback(async (projectId) => {
        if (!projectId) {
            showError('Project ID is required');
            return [];
        }

        try {
            setLoading(true);
            setError(null);

            const links = await fetchLinksByProject(projectId);
            return links;
        } catch (err) {
            const errorMessage = err.message || 'Error fetching links';
            setError(errorMessage);
            showError(errorMessage);
            return [];
        } finally {
            setLoading(false);
        }
    }, [showError]);

    /**
     * Update an existing link
     * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
     * @param {string} linkId - Link ID
     * @param {Object} data - Update data
     * @param {string} data.link - Updated link URL
     * @param {string} data.url - Updated link URL (alias)
     * @returns {Promise<Object|null>} Updated link object or null on error
     */
    const handleLinkUpdate = useCallback(async (linkId, data) => {
        if (!linkId) {
            showError('Link ID is required');
            return null;
        }
        if (!data || (!data.link && !data.url)) {
            showError('Link URL is required');
            return null;
        }

        try {
            setLoading(true);
            setError(null);

            const updatedLink = await updateExistingLink(linkId, data);

            // Re-augment with GitHub metadata if applicable
            const linkUrl = updatedLink.url || data.link || data.url;
            const gh = parseGitHubUrl(linkUrl);
            const isGitHub = gh?.isGitHub && gh.owner && gh.repo;

            if (isGitHub) {
                updatedLink.metadata = {
                    github: {
                        owner: gh.owner,
                        repo: gh.repo,
                        normalizedUrl: gh.normalizedUrl || linkUrl
                    }
                };
            }

            return updatedLink;
        } catch (err) {
            const errorMessage = err.message || 'Error updating link';
            setError(errorMessage);
            showError(errorMessage);
            return null;
        } finally {
            setLoading(false);
        }
    }, [showError]);

    /**
     * Delete a link
     * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
     * @param {string} linkId - Link ID
     * @returns {Promise<boolean>} Success status
     */
    const handleLinkDelete = useCallback(async (linkId) => {
        if (!linkId) {
            showError('Link ID is required');
            return false;
        }

        try {
            setLoading(true);
            setError(null);

            await deleteLinkById(linkId);
            return true;
        } catch (err) {
            const errorMessage = err.message || 'Error deleting link';
            setError(errorMessage);
            showError(errorMessage);
            return false;
        } finally {
            setLoading(false);
        }
    }, [showError]);

    return {
        loading,
        error,
        handleLinkCreate,
        handleFetchLinks,
        handleLinkUpdate,
        handleLinkDelete,
        clearError: () => setError(null)
    };
}