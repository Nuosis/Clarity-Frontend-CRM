import { createNote, fetchProjectNotes, deleteNote } from '../api/notes';
import { getEnvironmentContext, ENVIRONMENT_TYPES } from './dataService';

/**
 * Creates a new note for a project
 * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
 * @param {string} fkId - Foreign key ID (project ID)
 * @param {string} note - The note content
 * @param {string} type - The note type (optional, default: 'general')
 * @returns {Promise<Object>} Created note record
 */
export async function createNewNote(fkId, note, type = 'general') {
    if (!fkId || !note?.trim()) {
        throw new Error('Project ID and note content are required');
    }

    return await createNote({
        project_id: fkId,
        fkId, // Legacy FileMaker support
        content: note.trim(),
        note: note.trim(), // Legacy FileMaker support
        type
    });
}

/**
 * Fetch notes for a project
 * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
 * @param {string} projectId - The project ID
 * @returns {Promise<Array>} Array of notes
 */
export async function fetchNotesByProject(projectId) {
    if (!projectId) {
        throw new Error('Project ID is required');
    }

    const result = await fetchProjectNotes(projectId);
    const env = getEnvironmentContext();

    // Process based on environment
    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return processNotes(result);
    } else {
        // Backend API returns array directly
        return Array.isArray(result) ? result.map(note => ({
            id: note.id,
            content: note.content,
            author: note.author,
            createdAt: note.created_at,
            updatedAt: note.updated_at,
            fieldData: {
                __ID: note.id,
                note: note.content
            }
        })) : [];
    }
}

/**
 * Delete a note by ID
 * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
 * @param {string} noteId - The note ID
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteNoteById(noteId) {
    if (!noteId) {
        throw new Error('Note ID is required');
    }

    return await deleteNote(noteId);
}

/**
 * Processes notes data from FileMaker
 * @param {Object} data - Raw notes data
 * @returns {Array} Processed notes
 */
export function processNotes(data) {
    if (!data?.response?.data) {
        return [];
    }

    return data.response.data
        .map(note => ({
            id: note.fieldData.__ID,
            recordId: note.recordID,
            content: note.fieldData.note,
            createdAt: note.fieldData['~CreationTimestamp'],
            createdBy: note.fieldData['~CreatedBy']
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}