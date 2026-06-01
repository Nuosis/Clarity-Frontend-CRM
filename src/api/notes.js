import { dataService, getAuthenticationContext } from '../services/dataService';
import {
    withNoteErrorHandling,
    checkNoteOrganizationScope,
    NoteError,
    NoteErrorCodes
} from '../errors';
import { validateUUID } from '../utils/validation';
import { FIELD_LIMITS } from '../utils/inputSanitization';

/**
 * Normalize note data from backend API
 * @param {Object|Array} data - Raw note data from backend
 * @returns {Object|Array} Normalized note data
 */
function normalizeNoteData(data) {
    if (!data) {
        return data;
    }

    if (Array.isArray(data)) {
        return data.map(note => ({
            id: note.id || note.__ID,
            __ID: note.id || note.__ID,
            ...note
        }));
    }

    return {
        id: data.id || data.__ID,
        __ID: data.id || data.__ID,
        ...data
    };
}

/**
 * Normalize list response for notes (data + pagination).
 * Handles backend responses with { data: [], pagination: {} } and legacy arrays.
 * @param {Object|Array} response - Raw API response
 * @returns {Object} { notes, pagination }
 */
function normalizeNoteListResponse(response) {
    if (!response) {
        return { notes: [], pagination: null };
    }

    const rawNotes = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.data?.notes)
            ? response.data.notes
            : Array.isArray(response?.notes)
                ? response.notes
                : Array.isArray(response)
                    ? response
                    : [];

    const pagination = response?.pagination || response?.data?.pagination || null;
    const normalizedNotes = normalizeNoteData(rawNotes) || [];

    return { notes: normalizedNotes, pagination };
}

/**
 * Creates a new note via backend API
 *
 * @param {Object} data - The note data
 * @param {string} data.note - Note content (required)
 * @param {string} data.content - Note content (alias for 'note')
 * @param {string} data.project_id - Project ID (mutually exclusive with customer_id/task_id)
 * @param {string} data.customer_id - Customer ID (mutually exclusive with project_id/task_id)
 * @param {string} data.task_id - Task ID (mutually exclusive with project_id/customer_id)
 * @param {string} data.type - Note type (default: 'general')
 * @returns {Promise<Object>} Created note record
 *
 * @note Backend database uses explicit foreign keys (project_id, customer_id, task_id)
 *       NOT polymorphic entity_type/entity_id. Exactly ONE parent FK must be provided.
 * @note 'created_by' is set automatically by backend from JWT, not from request payload
 */
export async function createNote(data) {
    return withNoteErrorHandling(async () => {
        if (!data) {
            throw new NoteError('Data is required', NoteErrorCodes.REQUIRED_FIELD_MISSING, { field: 'data' });
        }

        // Backend API: POST /projects/{parent_id}/notes
        // Database schema uses explicit FKs: project_id, customer_id, task_id
        // Exactly ONE must be provided (enforced by check constraint)

        const projectId = data.project_id;
        const customerId = data.customer_id;
        const taskId = data.task_id;

        // Determine parent entity
        if (!projectId && !customerId && !taskId) {
            throw new NoteError(
                'One of project_id, customer_id, or task_id is required for creating notes',
                NoteErrorCodes.REQUIRED_FIELD_MISSING,
                { field: 'parent_id' }
            );
        }

        // Ensure exactly one parent is provided
        const parentCount = [projectId, customerId, taskId].filter(Boolean).length;
        if (parentCount > 1) {
            throw new NoteError(
                'Only one of project_id, customer_id, or task_id should be provided',
                NoteErrorCodes.INVALID_NOTE_DATA,
                { field: 'parent_id' }
            );
        }

        // Validate UUID format for whichever parent ID is provided
        if (projectId) validateUUID(projectId, 'Project ID');
        if (customerId) validateUUID(customerId, 'Customer ID');
        if (taskId) validateUUID(taskId, 'Task ID');

        // Check organization scope
        const auth = getAuthenticationContext();
        checkNoteOrganizationScope({ authentication: auth }, 'createNote');

        // Validate note content length
        const noteContent = data.content || data.note;
        if (!noteContent) {
            throw new NoteError(
                'Note content is required',
                NoteErrorCodes.REQUIRED_FIELD_MISSING,
                { field: 'note' }
            );
        }

        if (noteContent.length > FIELD_LIMITS.NOTE_CONTENT) {
            throw new NoteError(
                `Note content exceeds maximum length of ${FIELD_LIMITS.NOTE_CONTENT} characters`,
                NoteErrorCodes.CONTENT_TOO_LONG,
                {
                    field: 'note',
                    maxLength: FIELD_LIMITS.NOTE_CONTENT,
                    actualLength: noteContent.length
                }
            );
        }

        // Build payload matching database schema
        const payload = {
            note: noteContent,
            type: data.type || 'general',
            project_id: projectId || null,
            customer_id: customerId || null,
            task_id: taskId || null
            // organization_id added by backend from X-Organization-ID header
            // created_by set by backend from JWT token
        };

        // Use generic /api/notes endpoint (supports all entity types via request body)
        // Backend routes based on project_id, task_id, or customer_id in payload
        const response = await dataService.post('/api/notes', payload);
        return normalizeNoteData(response.data || response);
    }, 'createNote', { data });
}

/**
 * Fetch notes for a project via backend API
 *
 * @param {string} projectId - Project ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Max records to return (default: backend default)
 * @param {number} options.offset - Pagination offset (default: 0)
 * @returns {Promise<Object>} Note list with pagination
 */
export async function fetchNotesByProject(projectId, options = {}) {
    return withNoteErrorHandling(async () => {
        if (!projectId) {
            throw new NoteError('Project ID is required', NoteErrorCodes.REQUIRED_FIELD_MISSING, {
                field: 'projectId'
            });
        }

        validateUUID(projectId, 'Project ID');

        // Check organization scope
        const auth = getAuthenticationContext();
        checkNoteOrganizationScope({ authentication: auth }, 'fetchNotesByProject');

        // Backend API: GET /api/notes?project_id={uuid}
        const queryParams = { project_id: projectId };
        if (options.limit) queryParams.limit = options.limit;
        if (options.offset) queryParams.offset = options.offset;

        const response = await dataService.get('/api/notes', { params: queryParams });
        return normalizeNoteListResponse(response);
    }, 'fetchNotesByProject', { projectId, options });
}

/**
 * Fetch notes for a task via backend API
 *
 * @param {string} taskId - Task ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Max records to return
 * @param {number} options.offset - Pagination offset
 * @returns {Promise<Object>} Note list with pagination
 */
export async function fetchNotesByTask(taskId, options = {}) {
    return withNoteErrorHandling(async () => {
        if (!taskId) {
            throw new NoteError('Task ID is required', NoteErrorCodes.REQUIRED_FIELD_MISSING, {
                field: 'taskId'
            });
        }

        validateUUID(taskId, 'Task ID');

        // Check organization scope
        const auth = getAuthenticationContext();
        checkNoteOrganizationScope({ authentication: auth }, 'fetchNotesByTask');

        // Backend API: GET /api/notes?task_id={uuid}
        const queryParams = { task_id: taskId };
        if (options.limit) queryParams.limit = options.limit;
        if (options.offset) queryParams.offset = options.offset;

        const response = await dataService.get('/api/notes', { params: queryParams });
        return normalizeNoteListResponse(response);
    }, 'fetchNotesByTask', { taskId, options });
}

/**
 * Fetch notes for a customer via backend API
 *
 * @param {string} customerId - Customer ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Max records to return
 * @param {number} options.offset - Pagination offset
 * @returns {Promise<Object>} Note list with pagination
 */
export async function fetchNotesByCustomer(customerId, options = {}) {
    return withNoteErrorHandling(async () => {
        if (!customerId) {
            throw new NoteError('Customer ID is required', NoteErrorCodes.REQUIRED_FIELD_MISSING, {
                field: 'customerId'
            });
        }

        validateUUID(customerId, 'Customer ID');

        // Check organization scope
        const auth = getAuthenticationContext();
        checkNoteOrganizationScope({ authentication: auth }, 'fetchNotesByCustomer');

        // Backend API: GET /api/notes?customer_id={uuid}
        const queryParams = { customer_id: customerId };
        if (options.limit) queryParams.limit = options.limit;
        if (options.offset) queryParams.offset = options.offset;

        const response = await dataService.get('/api/notes', { params: queryParams });
        return normalizeNoteListResponse(response);
    }, 'fetchNotesByCustomer', { customerId, options });
}

/**
 * Legacy alias for fetchNotesByProject
 * @deprecated Use fetchNotesByProject instead
 */
export async function fetchProjectNotes(projectId, options = {}) {
    return withNoteErrorHandling(async () => {
        return fetchNotesByProject(projectId, options);
    }, 'fetchProjectNotes', { projectId, options });
}

/**
 * Update a note by ID via backend API
 *
 * @param {string} noteId - The note ID
 * @param {Object} data - Update data
 * @param {string} data.note - Updated note content
 * @param {string} data.content - Updated note content (alias)
 * @param {string} data.type - Updated note type
 * @returns {Promise<Object>} Updated note record
 *
 * @note Backend sets 'updated_by' automatically from JWT token
 */
export async function updateNote(noteId, data) {
    return withNoteErrorHandling(async () => {
        if (!noteId) {
            throw new NoteError('Note ID is required', NoteErrorCodes.REQUIRED_FIELD_MISSING, {
                field: 'noteId'
            });
        }
        if (!data) {
            throw new NoteError('Update data is required', NoteErrorCodes.REQUIRED_FIELD_MISSING, {
                field: 'data'
            });
        }

        validateUUID(noteId, 'Note ID');

        // Check organization scope
        const auth = getAuthenticationContext();
        checkNoteOrganizationScope({ authentication: auth }, 'updateNote');

        // Backend API: PATCH /projects/notes/{note_id}
        const payload = {};
        if (data.note || data.content) {
            const noteContent = data.content || data.note;

            // Validate note content length
            if (noteContent.length > FIELD_LIMITS.NOTE_CONTENT) {
                throw new NoteError(
                    `Note content exceeds maximum length of ${FIELD_LIMITS.NOTE_CONTENT} characters`,
                    NoteErrorCodes.CONTENT_TOO_LONG,
                    {
                        field: 'note',
                        maxLength: FIELD_LIMITS.NOTE_CONTENT,
                        actualLength: noteContent.length
                    }
                );
            }

            payload.note = noteContent;
        }
        if (data.type) {
            payload.type = data.type;
        }

        // Backend API: PATCH /api/notes/{note_id}
        const response = await dataService.patch(`/api/notes/${noteId}`, payload);
        return normalizeNoteData(response.data || response);
    }, 'updateNote', { noteId, data });
}

/**
 * Delete a note by ID via backend API
 *
 * @param {string} noteId - The note ID
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteNote(noteId) {
    return withNoteErrorHandling(async () => {
        if (!noteId) {
            throw new NoteError('Note ID is required', NoteErrorCodes.REQUIRED_FIELD_MISSING, {
                field: 'noteId'
            });
        }

        validateUUID(noteId, 'Note ID');

        // Check organization scope
        const auth = getAuthenticationContext();
        checkNoteOrganizationScope({ authentication: auth }, 'deleteNote');

        // Backend API: DELETE /api/notes/{note_id}
        const response = await dataService.delete(`/api/notes/${noteId}`);
        return response.data || response;
    }, 'deleteNote', { noteId });
}
