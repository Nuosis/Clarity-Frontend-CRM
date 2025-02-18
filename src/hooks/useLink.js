import { useState, useCallback } from 'react';
import { useSnackBar } from '../context/SnackBarContext';
import { createNewLink } from '../services/linkService';

/**
 * Hook for managing link operations
 */
export function useLink() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const { showError } = useSnackBar();

    const handleLinkCreate = useCallback(async (fkId, linkUrl) => {
        if (!fkId || !linkUrl?.trim()) {
            showError('Task ID and link URL are required');
            return null;
        }

        try {
            setLoading(true);
            setError(null);
            
            const result = await createNewLink(fkId, linkUrl.trim());
            
            if (!result?.response?.recordId) {
                throw new Error('Failed to create link: No record ID returned');
            }
            
            return {
                id: result.response.recordId,
                url: linkUrl.trim(),
                createdAt: new Date().toISOString()
            };
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