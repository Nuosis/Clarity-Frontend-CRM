import {
    createNote,
    fetchProjectNotes,
    fetchNotesByTask as fetchTaskNotesAPI,
    fetchNotesByCustomer as fetchCustomerNotesAPI,
    deleteNote,
    updateNote
} from '../api/notes';

function sanitizeNoteContent(value) {
    if (value === null || value === undefined) {
        return '';
    }

    const input = String(value);

    if (typeof DOMParser !== 'undefined') {
        const doc = new DOMParser().parseFromString(input, 'text/html');
        return doc.body.textContent || '';
    }

    return input.replace(/<[^>]*>/g, '');
}

/**
 * Creates a new note via backend API
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

    const sanitizedContent = sanitizeNoteContent(noteContent).trim();

    if (!entityId || !sanitizedContent) {
        throw new Error('Entity ID and note content are required');
    }

    // Build payload based on entity type
    const payload = {
        content: sanitizedContent,
        note: sanitizedContent, // Alias for backend API
        type
    };

    // Set the appropriate foreign key based on entity type
    if (entityType === 'project') {
        payload.project_id = entityId;
    } else if (entityType === 'task') {
        payload.task_id = entityId;
    } else if (entityType === 'customer') {
        payload.customer_id = entityId;
    }

    const result = await createNote(payload);

    // Transform the backend response to normalized format
    return transformBackendNote(result);
}

/**
 * Fetch notes for a project via backend API
 * @param {string} projectId - The project ID
 * @param {Object} options - Query options (limit, offset)
 * @returns {Promise<Object>} Notes with pagination metadata
 */
export async function fetchNotesByProject(projectId, options = {}) {
    if (!projectId) {
        throw new Error('Project ID is required');
    }

    const result = await fetchProjectNotes(projectId, options);
    const notes = Array.isArray(result?.notes) ? result.notes : Array.isArray(result) ? result : [];
    const pagination = result?.pagination || null;

    // Backend API returns notes with pagination - transform to normalized format
    return {
        notes: notes.map(transformBackendNote),
        pagination
    };
}

/**
 * Fetch notes for a task via backend API
 * @param {string} taskId - The task ID
 * @param {Object} options - Query options (limit, offset)
 * @returns {Promise<Object>} Notes with pagination metadata
 */
export async function fetchNotesByTask(taskId, options = {}) {
    if (!taskId) {
        throw new Error('Task ID is required');
    }

    const result = await fetchTaskNotesAPI(taskId, options);
    const notes = Array.isArray(result?.notes) ? result.notes : Array.isArray(result) ? result : [];
    const pagination = result?.pagination || null;

    // Backend API returns notes with pagination - transform to normalized format
    return {
        notes: notes.map(transformBackendNote),
        pagination
    };
}

/**
 * Fetch notes for a customer via backend API
 * @param {string} customerId - The customer ID
 * @param {Object} options - Query options (limit, offset)
 * @returns {Promise<Object>} Notes with pagination metadata
 */
export async function fetchNotesByCustomer(customerId, options = {}) {
    if (!customerId) {
        throw new Error('Customer ID is required');
    }

    const result = await fetchCustomerNotesAPI(customerId, options);
    const notes = Array.isArray(result?.notes) ? result.notes : Array.isArray(result) ? result : [];
    const pagination = result?.pagination || null;

    // Backend API returns notes with pagination - transform to normalized format
    return {
        notes: notes.map(transformBackendNote),
        pagination
    };
}

/**
 * Update a note by ID via backend API
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

    const sanitizedData = { ...data };

    if (data.content !== undefined) {
        sanitizedData.content = sanitizeNoteContent(data.content).trim();
    }

    if (data.note !== undefined) {
        sanitizedData.note = sanitizeNoteContent(data.note).trim();
    }

    if ((data.content !== undefined || data.note !== undefined) && !sanitizedData.content && !sanitizedData.note) {
        throw new Error('Update data is required (content or type)');
    }

    const result = await updateNote(noteId, sanitizedData);

    // Transform the backend response to normalized format
    return transformBackendNote(result);
}

/**
 * Delete a note by ID via backend API
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
        content: sanitizeNoteContent(note.note), // Backend uses 'note', frontend uses 'content'
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
            note: sanitizeNoteContent(note.note)
        }
    };
}
