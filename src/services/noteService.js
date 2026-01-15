import { createNote, fetchProjectNotes, deleteNote, updateNote } from '../api/notes';
import { getEnvironmentContext, ENVIRONMENT_TYPES } from './dataService';

/**
 * Creates a new note
 * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
 *
 * New signature: createNewNote(entityType, entityId, noteContent, type)
 * Legacy signature: createNewNote(entityId, noteContent, type) - assumes entityType='project'
 *
 * @param {string} entityTypeOrId - Entity type ('project'/'task'/'customer') OR entity ID (legacy)
 * @param {string} entityIdOrContent - Entity ID OR note content (legacy)
 * @param {string} noteContentOrType - Note content OR type string (legacy)
 * @param {string} type - Note type (optional, default: 'general')
 * @returns {Promise<Object>} Created note record
 */
export async function createNewNote(entityTypeOrId, entityIdOrContent, noteContentOrType, type = 'general') {
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
        throw new Error('Entity ID and note content are required');
    }

    // Build payload based on entity type
    const payload = {
        content: noteContent.trim(),
        note: noteContent.trim(), // Alias for backend API
        type
    };

    // Set the appropriate foreign key based on entity type
    if (entityType === 'project') {
        payload.project_id = entityId;
        payload.fkId = entityId; // Legacy FileMaker support
    } else if (entityType === 'task') {
        payload.task_id = entityId;
        payload.fkId = entityId; // Legacy FileMaker support
    } else if (entityType === 'customer') {
        payload.customer_id = entityId;
        payload.fkId = entityId; // Legacy FileMaker support
    }

    const result = await createNote(payload);

    // Transform the backend response to normalized format
    return transformBackendNote(result);
}

/**
 * Fetch notes for a project
 * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
 * @param {string} projectId - The project ID
 * @param {Object} options - Query options (limit, offset)
 * @returns {Promise<Array>} Array of notes
 */
export async function fetchNotesByProject(projectId, options = {}) {
    if (!projectId) {
        throw new Error('Project ID is required');
    }

    const result = await fetchProjectNotes(projectId, options);
    const env = getEnvironmentContext();

    // Process based on environment
    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return processNotes(result);
    } else {
        // Backend API returns array directly - transform to normalized format
        return Array.isArray(result) ? result.map(transformBackendNote) : [];
    }
}

/**
 * Fetch notes for a task
 * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
 * @param {string} taskId - The task ID
 * @param {Object} options - Query options (limit, offset)
 * @returns {Promise<Array>} Array of notes
 */
export async function fetchNotesByTask(taskId, options = {}) {
    if (!taskId) {
        throw new Error('Task ID is required');
    }

    const { fetchNotesByTask: fetchTaskNotesAPI } = await import('../api/notes');
    const result = await fetchTaskNotesAPI(taskId, options);
    const env = getEnvironmentContext();

    // Process based on environment
    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return processNotes(result);
    } else {
        // Backend API returns array directly - transform to normalized format
        return Array.isArray(result) ? result.map(transformBackendNote) : [];
    }
}

/**
 * Fetch notes for a customer
 * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
 * @param {string} customerId - The customer ID
 * @param {Object} options - Query options (limit, offset)
 * @returns {Promise<Array>} Array of notes
 */
export async function fetchNotesByCustomer(customerId, options = {}) {
    if (!customerId) {
        throw new Error('Customer ID is required');
    }

    const { fetchNotesByCustomer: fetchCustomerNotesAPI } = await import('../api/notes');
    const result = await fetchCustomerNotesAPI(customerId, options);
    const env = getEnvironmentContext();

    // Process based on environment
    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return processNotes(result);
    } else {
        // Backend API returns array directly - transform to normalized format
        return Array.isArray(result) ? result.map(transformBackendNote) : [];
    }
}

/**
 * Update a note by ID
 * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
 * @param {string} noteId - The note ID
 * @param {Object} data - Update data
 * @param {string} data.content - Updated note content
 * @param {string} data.note - Updated note content (alias)
 * @param {string} data.type - Updated note type
 * @returns {Promise<Object>} Updated note record
 */
export async function updateNoteById(noteId, data) {
    if (!noteId) {
        throw new Error('Note ID is required');
    }

    if (!data || (!data.content && !data.note && !data.type)) {
        throw new Error('Update data is required (content or type)');
    }

    const result = await updateNote(noteId, data);

    // Transform the backend response to normalized format
    return transformBackendNote(result);
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
 * Transforms backend API note response to normalized format
 * Handles the mapping from backend snake_case to camelCase
 * @param {Object} note - Backend note object
 * @returns {Object} Normalized note object
 */
export function transformBackendNote(note) {
    if (!note) {
        return null;
    }

    return {
        id: note.id,
        content: note.note, // Backend uses 'note', frontend uses 'content'
        type: note.type || 'general',
        createdAt: note.created_at,
        updatedAt: note.updated_at,
        createdBy: note.created_by || null, // May be null if not set
        updatedBy: note.updated_by || null,
        organizationId: note.organization_id,
        // Include parent entity references
        projectId: note.project_id || null,
        customerId: note.customer_id || null,
        taskId: note.task_id || null,
        // Legacy fieldData for backward compatibility with components expecting it
        fieldData: {
            __ID: note.id,
            note: note.note
        }
    };
}

/**
 * Processes notes data from FileMaker
 * @param {Object} data - Raw FileMaker notes data
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
            createdBy: note.fieldData['~CreatedBy'],
            fieldData: {
                __ID: note.fieldData.__ID,
                note: note.fieldData.note
            }
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}