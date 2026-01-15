import { useState, useCallback } from 'react';
import { useSnackBar } from '../context/SnackBarContext';
import { createNewNote, fetchNotesByProject, deleteNoteById } from '../services/noteService';
import { updateNote } from '../api/notes';
import { getEnvironmentContext, ENVIRONMENT_TYPES } from '../services/dataService';

/**
 * Hook for managing note operations
 * Environment-aware: Handles both backend API and FileMaker environments
 */
export function useNote() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({
        limit: 50,
        offset: 0,
        hasMore: false,
        total: 0
    });
    const { showError } = useSnackBar();

    /**
     * Create a new note
     * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
     *
     * Supports both signatures for backward compatibility:
     * - New: handleNoteCreate(entityType, entityId, noteContent, type)
     * - Legacy: handleNoteCreate(entityId, noteContent, type) - assumes entityType='project'
     *
     * @param {string} entityTypeOrId - Entity type ('project'/'task'/'customer') OR entity ID (legacy)
     * @param {string} entityIdOrContent - Entity ID OR note content (legacy)
     * @param {string} noteContentOrType - Note content OR type string (legacy)
     * @param {string} type - Note type (optional, default: 'general')
     * @returns {Promise<Object|null>} Created note object or null on error
     */
    const handleNoteCreate = useCallback(async (entityTypeOrId, entityIdOrContent, noteContentOrType, type = 'general') => {
        let entityType, entityId, noteContent;

        // Detect signature pattern based on first parameter
        if (['project', 'task', 'customer'].includes(entityTypeOrId)) {
            // New signature: (entityType, entityId, noteContent, type)
            entityType = entityTypeOrId;
            entityId = entityIdOrContent;
            noteContent = noteContentOrType;
        } else {
            // Legacy signature: (entityId, noteContent, type)
            entityType = 'project'; // Default to project for backward compatibility
            entityId = entityTypeOrId;
            noteContent = entityIdOrContent;
            type = noteContentOrType || 'general';
        }

        if (!entityId || !noteContent?.trim()) {
            const errorMessage = 'Entity ID and note content are required';
            showError(errorMessage);
            console.error('[useNote] handleNoteCreate validation error:', { entityType, entityId, noteContent });
            return null;
        }

        try {
            setLoading(true);
            setError(null);

            // Call service with new signature
            const result = await createNewNote(entityType, entityId, noteContent.trim(), type);

            if (!result?.id) {
                throw new Error('Failed to create note: No ID returned');
            }

            console.log('[useNote] Note created successfully:', { id: result.id, entityType, entityId });
            return result;
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || 'Error creating note';
            setError(errorMessage);
            showError(errorMessage);
            console.error('[useNote] handleNoteCreate error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, [showError]);

    /**
     * Fetch notes for a project with pagination support
     * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
     *
     * @param {string} projectId - Project ID
     * @param {Object} options - Query options
     * @param {number} options.limit - Max records to return (default: 50)
     * @param {number} options.offset - Pagination offset (default: 0)
     * @param {boolean} options.updatePagination - Whether to update pagination state (default: true)
     * @returns {Promise<Array>} Array of notes
     */
    const handleFetchNotes = useCallback(async (projectId, options = {}) => {
        if (!projectId) {
            const errorMessage = 'Project ID is required';
            showError(errorMessage);
            console.error('[useNote] handleFetchNotes validation error: missing projectId');
            return [];
        }

        try {
            setLoading(true);
            setError(null);

            const {
                limit = pagination.limit,
                offset = pagination.offset,
                updatePagination: shouldUpdatePagination = true
            } = options;

            const notes = await fetchNotesByProject(projectId, { limit, offset });

            // Update pagination state if requested
            if (shouldUpdatePagination) {
                const env = getEnvironmentContext();

                // Pagination only works in web app environment
                if (env.type === ENVIRONMENT_TYPES.WEBAPP) {
                    setPagination(prev => ({
                        ...prev,
                        offset,
                        limit,
                        hasMore: notes.length >= limit,
                        total: prev.total + notes.length
                    }));
                }
            }

            console.log('[useNote] Notes fetched successfully:', { projectId, count: notes.length, offset, limit });
            return notes;
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || 'Error fetching notes';
            setError(errorMessage);
            showError(errorMessage);
            console.error('[useNote] handleFetchNotes error:', err);
            return [];
        } finally {
            setLoading(false);
        }
    }, [showError, pagination.limit, pagination.offset]);

    /**
     * Update a note
     * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
     *
     * @param {string} noteId - Note ID
     * @param {Object} data - Update data
     * @param {string} data.content - Updated note content
     * @param {string} data.note - Updated note content (alias)
     * @param {string} data.type - Updated note type
     * @returns {Promise<Object|null>} Updated note object or null on error
     */
    const handleNoteUpdate = useCallback(async (noteId, data) => {
        if (!noteId) {
            const errorMessage = 'Note ID is required';
            showError(errorMessage);
            console.error('[useNote] handleNoteUpdate validation error: missing noteId');
            return null;
        }

        if (!data || (!data.content && !data.note && !data.type)) {
            const errorMessage = 'Update data is required (content or type)';
            showError(errorMessage);
            console.error('[useNote] handleNoteUpdate validation error: missing update data');
            return null;
        }

        try {
            setLoading(true);
            setError(null);

            const result = await updateNote(noteId, data);

            if (!result?.id) {
                throw new Error('Failed to update note: No ID returned');
            }

            console.log('[useNote] Note updated successfully:', { id: result.id });
            return result;
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || 'Error updating note';
            setError(errorMessage);
            showError(errorMessage);
            console.error('[useNote] handleNoteUpdate error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, [showError]);

    /**
     * Delete a note
     * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
     *
     * @param {string} noteId - Note ID
     * @returns {Promise<boolean>} Success status
     */
    const handleNoteDelete = useCallback(async (noteId) => {
        if (!noteId) {
            const errorMessage = 'Note ID is required';
            showError(errorMessage);
            console.error('[useNote] handleNoteDelete validation error: missing noteId');
            return false;
        }

        try {
            setLoading(true);
            setError(null);

            await deleteNoteById(noteId);

            console.log('[useNote] Note deleted successfully:', { id: noteId });
            return true;
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || 'Error deleting note';
            setError(errorMessage);
            showError(errorMessage);
            console.error('[useNote] handleNoteDelete error:', err);
            return false;
        } finally {
            setLoading(false);
        }
    }, [showError]);

    return {
        loading,
        error,
        pagination,
        handleNoteCreate,
        handleFetchNotes,
        handleNoteUpdate,
        handleNoteDelete,
        setPagination,
        clearError: () => setError(null)
    };
}