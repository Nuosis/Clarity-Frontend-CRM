import { useState, useCallback } from 'react';
import { useSnackBar } from '../context/SnackBarContext';
import { createNewLink, fetchLinksByProject, updateExistingLink, deleteLinkById } from '../services/linkService';
import { parseGitHubUrl } from '../utils/githubUtils';
import { formatLinkErrorForUI } from '../errors';

/**
 * Hook for managing link operations
 * Uses backend API
 */
export function useLink() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [formattedError, setFormattedError] = useState(null);
    const { showError } = useSnackBar();

    /**
     * Helper function to set error state with formatting
     * @param {Error} err - Error object
     */
    const setErrorWithFormatting = useCallback((err) => {
        const formatted = formatLinkErrorForUI(err);
        setError(formatted.message);
        setFormattedError(formatted);
        console.error('[useLink] Error:', {
            raw: err,
            formatted,
            stack: err?.stack
        });
    }, []);

    const clearErrorState = useCallback(() => {
        setError(null);
        setFormattedError(null);
    }, []);

    /**
     * Create a new link for a record.
     * Automatically detects GitHub repository URLs and augments the returned link object
     * with metadata.github { owner, repo, normalizedUrl } for non-invasive tagging (Phase 1).
     * Uses backend API.
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
            clearErrorState();

            const trimmedUrl = linkUrl.trim();

            // Phase 1: local-only GitHub URL detection (no API calls)
            const gh = parseGitHubUrl(trimmedUrl);
            const isGitHub = gh?.isGitHub && gh.owner && gh.repo;
            const metadata = isGitHub
                ? { github: { owner: gh.owner, repo: gh.repo, normalizedUrl: gh.normalizedUrl || trimmedUrl } }
                : undefined;

            // Pass parentType to createNewLink so it creates the correct FK
            const result = await createNewLink(fkId, trimmedUrl, parentType);

            // Backend API response (already transformed by linkService)
            if (!result?.id) {
                throw new Error('Failed to create link: No ID returned');
            }

            // Generate title from hostname with fallback to URL string
            let title = result.title;
            if (!title) {
                try {
                    title = new URL(trimmedUrl).hostname;
                } catch {
                    title = trimmedUrl;
                }
            }

            const newLink = {
                id: result.id,
                url: result.url || trimmedUrl,
                title: title,
                createdAt: result.createdAt || new Date().toISOString()
            };

            // Non-invasive augmentation: attach metadata only if GitHub repo detected
            if (metadata) {
                newLink.metadata = metadata;
            }

            return newLink;
        } catch (err) {
            setErrorWithFormatting(err);
            showError(err.message || 'Error creating link');
            return null;
        } finally {
            setLoading(false);
        }
    }, [showError, setErrorWithFormatting]);

    /**
     * Fetch links for a project
     * Uses backend API
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
            clearErrorState();

            const links = await fetchLinksByProject(projectId);
            return links;
        } catch (err) {
            setErrorWithFormatting(err);
            showError(err.message || 'Error fetching links');
            return [];
        } finally {
            setLoading(false);
        }
    }, [showError, setErrorWithFormatting]);

    /**
     * Update an existing link
     * Uses backend API
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
            clearErrorState();

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
            setErrorWithFormatting(err);
            showError(err.message || 'Error updating link');
            return null;
        } finally {
            setLoading(false);
        }
    }, [showError, setErrorWithFormatting]);

    /**
     * Delete a link
     * Uses backend API
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
            clearErrorState();

            await deleteLinkById(linkId);
            return true;
        } catch (err) {
            setErrorWithFormatting(err);
            showError(err.message || 'Error deleting link');
            return false;
        } finally {
            setLoading(false);
        }
    }, [showError, setErrorWithFormatting]);

    return {
        loading,
        error,
        formattedError,
        handleLinkCreate,
        handleFetchLinks,
        handleLinkUpdate,
        handleLinkDelete,
        clearError: clearErrorState
    };
}