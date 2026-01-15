import { useState, useCallback } from 'react';
import { useSnackBar } from '../context/SnackBarContext';
import { createNewNote, fetchNotesByProject, fetchNotesByTask, fetchNotesByCustomer, deleteNoteById, updateNoteById } from '../services/noteService';

/**
 * Hook for managing note operations via backend API
 */
export function useNote() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Separate pagination state for each entity type
    const [paginationByEntity, setPaginationByEntity] = useState({});

    const { showError } = useSnackBar();

    /**
     * Get pagination state for a specific entity
     * @param {string} entityType - 'project', 'task', or 'customer'
     * @param {string} entityId - Entity ID
     * @returns {Object} Pagination state
     */
    const getPagination = useCallback((entityType, entityId) => {
        const key = `${entityType}-${entityId}`;
        return paginationByEntity[key] || {
            limit: 50,
            offset: 0,
            hasMore: false,
            total: 0
        };
    }, [paginationByEntity]);

    /**
     * Update pagination state for a specific entity
     * @param {string} entityType - 'project', 'task', or 'customer'
     * @param {string} entityId - Entity ID
     * @param {Object} updates - Pagination updates
     */
    const updatePagination = useCallback((entityType, entityId, updates) => {
        const key = `${entityType}-${entityId}`;
        setPaginationByEntity(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                ...updates
            }
        }));
    }, []);

    /**
     * Create a new note via backend API
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
     * Fetch notes for any entity type with pagination support via backend API
     *
     * Supports both legacy and new signatures:
     * - Legacy: handleFetchNotes(projectId, options) - assumes entityType='project'
     * - New: handleFetchNotes(entityType, entityId, options)
     *
     * @param {string} entityTypeOrId - Entity type ('project'/'task'/'customer') OR entity ID (legacy)
     * @param {string|Object} entityIdOrOptions - Entity ID OR options object (legacy)
     * @param {Object} options - Query options (new signature)
     * @param {number} options.limit - Max records to return (default: 50)
     * @param {number} options.offset - Pagination offset (default: 0)
     * @param {boolean} options.append - Whether to append to existing notes (for "Load More")
     * @returns {Promise<Array>} Array of notes
     */
    const handleFetchNotes = useCallback(async (entityTypeOrId, entityIdOrOptions = {}, options = {}) => {
        let entityType, entityId, fetchOptions;

        // Detect signature pattern
        if (['project', 'task', 'customer'].includes(entityTypeOrId)) {
            // New signature: (entityType, entityId, options)
            entityType = entityTypeOrId;
            entityId = entityIdOrOptions;
            fetchOptions = options;
        } else {
            // Legacy signature: (projectId, options) - assume 'project'
            entityType = 'project';
            entityId = entityTypeOrId;
            fetchOptions = entityIdOrOptions || {};
        }

        if (!entityId) {
            const errorMessage = `${entityType} ID is required`;
            showError(errorMessage);
            console.error(`[useNote] handleFetchNotes validation error: missing ${entityType}Id`);
            return [];
        }

        try {
            setLoading(true);
            setError(null);

            const currentPagination = getPagination(entityType, entityId);
            const {
                limit = currentPagination.limit,
                offset = fetchOptions.append ? currentPagination.offset + currentPagination.limit : 0,
                append = false
            } = fetchOptions;

            // Fetch notes based on entity type
            let notes = [];
            if (entityType === 'project') {
                notes = await fetchNotesByProject(entityId, { limit, offset });
            } else if (entityType === 'task') {
                notes = await fetchNotesByTask(entityId, { limit, offset });
            } else if (entityType === 'customer') {
                notes = await fetchNotesByCustomer(entityId, { limit, offset });
            }

            // Update pagination state
            updatePagination(entityType, entityId, {
                offset,
                limit,
                hasMore: notes.length >= limit,
                total: append ? currentPagination.total + notes.length : notes.length
            });

            console.log(`[useNote] Notes fetched successfully:`, { entityType, entityId, count: notes.length, offset, limit });
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
    }, [showError, getPagination, updatePagination]);

    /**
     * Update a note via backend API
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

            const result = await updateNoteById(noteId, data);

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
     * Delete a note via backend API
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
        handleNoteCreate,
        handleFetchNotes,
        handleNoteUpdate,
        handleNoteDelete,
        getPagination,
        updatePagination,
        clearError: () => setError(null)
    };
}