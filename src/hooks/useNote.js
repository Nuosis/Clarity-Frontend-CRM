import { useState, useCallback } from 'react';
import { useSnackBar } from '../context/SnackBarContext';
import { createNewNote, fetchNotesByProject, deleteNoteById } from '../services/noteService';
import { getEnvironmentContext, ENVIRONMENT_TYPES } from '../services/dataService';

/**
 * Hook for managing note operations
 * Environment-aware: Handles both backend API and FileMaker environments
 */
export function useNote() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const { showError } = useSnackBar();

    /**
     * Create a new note for a project
     * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
     * @param {string} fkId - Foreign key ID (project, task, etc.)
     * @param {string} noteContent - The note content
     * @param {string} type - The note type (optional, default: 'general')
     * @returns {Promise<Object|null>} Created note object or null on error
     */
    const handleNoteCreate = useCallback(async (fkId, noteContent, type = 'general') => {
        if (!fkId || !noteContent?.trim()) {
            showError('Project ID and note content are required');
            return null;
        }

        try {
            setLoading(true);
            setError(null);

            const env = getEnvironmentContext();
            const result = await createNewNote(fkId, noteContent.trim(), type);

            // Handle response based on environment
            if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
                if (!result?.response?.recordId) {
                    throw new Error('Failed to create note: No record ID returned');
                }

                return {
                    id: result.response.recordId,
                    content: noteContent.trim(),
                    type,
                    createdAt: new Date().toISOString()
                };
            } else {
                // Backend API response
                if (!result?.id) {
                    throw new Error('Failed to create note: No ID returned');
                }

                return {
                    id: result.id,
                    content: result.content,
                    author: result.author,
                    createdAt: result.created_at || new Date().toISOString(),
                    updatedAt: result.updated_at
                };
            }
        } catch (err) {
            const errorMessage = err.message || 'Error creating note';
            setError(errorMessage);
            showError(errorMessage);
            return null;
        } finally {
            setLoading(false);
        }
    }, [showError]);

    /**
     * Fetch notes for a project
     * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
     * @param {string} projectId - Project ID
     * @returns {Promise<Array>} Array of notes
     */
    const handleFetchNotes = useCallback(async (projectId) => {
        if (!projectId) {
            showError('Project ID is required');
            return [];
        }

        try {
            setLoading(true);
            setError(null);

            const notes = await fetchNotesByProject(projectId);
            return notes;
        } catch (err) {
            const errorMessage = err.message || 'Error fetching notes';
            setError(errorMessage);
            showError(errorMessage);
            return [];
        } finally {
            setLoading(false);
        }
    }, [showError]);

    /**
     * Delete a note
     * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
     * @param {string} noteId - Note ID
     * @returns {Promise<boolean>} Success status
     */
    const handleNoteDelete = useCallback(async (noteId) => {
        if (!noteId) {
            showError('Note ID is required');
            return false;
        }

        try {
            setLoading(true);
            setError(null);

            await deleteNoteById(noteId);
            return true;
        } catch (err) {
            const errorMessage = err.message || 'Error deleting note';
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
        handleNoteCreate,
        handleFetchNotes,
        handleNoteDelete,
        clearError: () => setError(null)
    };
}