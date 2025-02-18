import { useState, useCallback } from 'react';
import { useSnackBar } from '../context/SnackBarContext';
import { createNewNote as createNoteService } from '../services/noteService';

/**
 * Hook for managing note operations
 */
export function useNote() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const { showError } = useSnackBar();

    const handleNoteCreate = useCallback(async (fkId, noteContent, type = 'general') => {
        if (!fkId || !noteContent?.trim()) {
            showError('Task ID and note content are required');
            return null;
        }

        try {
            setLoading(true);
            setError(null);
            
            const result = await createNoteService(fkId, noteContent.trim(), type);
            
            if (!result?.response?.recordId) {
                throw new Error('Failed to create note: No record ID returned');
            }
            
            return {
                id: result.response.recordId,
                content: noteContent.trim(),
                type,
                createdAt: new Date().toISOString()
            };
        } catch (err) {
            const errorMessage = err.message || 'Error creating note';
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
        handleNoteCreate,
        clearError: () => setError(null)
    };
}