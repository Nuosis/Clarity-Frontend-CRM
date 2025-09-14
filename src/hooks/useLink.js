import { useState, useCallback } from 'react';
import { useSnackBar } from '../context/SnackBarContext';
import { createNewLink } from '../services/linkService';
import { parseGitHubUrl } from '../utils/githubUtils';

/**
 * Hook for managing link operations
 */
export function useLink() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const { showError } = useSnackBar();

    /**
     * Create a new link for a record.
     * Automatically detects GitHub repository URLs and augments the returned link object
     * with metadata.github { owner, repo, normalizedUrl } for non-invasive tagging (Phase 1).
     * No external API calls are made.
     *
     * @param {string} fkId - Foreign key ID (e.g., Task or Project ID)
     * @param {string} linkUrl - The URL to link
     * @returns {Promise<{id: string, url: string, createdAt: string, metadata?: { github: { owner: string, repo: string, normalizedUrl: string }}}|null>}
     */
    const handleLinkCreate = useCallback(async (fkId, linkUrl) => {
        if (!fkId || !linkUrl?.trim()) {
            showError('Task ID and link URL are required');
            return null;
        }

        try {
            setLoading(true);
            setError(null);

            // Phase 1: local-only GitHub URL detection (no API calls)
            const trimmedUrl = linkUrl.trim();
            const gh = parseGitHubUrl(trimmedUrl);
            const isGitHub = gh?.isGitHub && gh.owner && gh.repo;
            const metadata = isGitHub
                ? { github: { owner: gh.owner, repo: gh.repo, normalizedUrl: gh.normalizedUrl || trimmedUrl } }
                : undefined;

            const result = await createNewLink(fkId, trimmedUrl);

            if (!result?.response?.recordId) {
                throw new Error('Failed to create link: No record ID returned');
            }

            const newLink = {
                id: result.response.recordId,
                url: trimmedUrl,
                createdAt: new Date().toISOString()
            };
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

    return {
        loading,
        error,
        handleLinkCreate,
        clearError: () => setError(null)
    };
}