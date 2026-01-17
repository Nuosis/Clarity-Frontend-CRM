import { dataService, getAuthenticationContext } from '../services/dataService';

/**
 * Check organization scope
 * @param {Object} auth - Authentication context
 * @param {string} operation - Operation name for error messages
 * @throws {Error} If organization ID is missing
 */
function checkOrganizationScope({ authentication: auth }, operation) {
    if (!auth?.user?.supabaseOrgID) {
        throw new Error(`Organization context required for ${operation}. Please authenticate.`);
    }
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
    if (!data) {
        throw new Error('Data is required');
    }

    // Backend API: POST /projects/{parent_id}/notes
    // Database schema uses explicit FKs: project_id, customer_id, task_id
    // Exactly ONE must be provided (enforced by check constraint)

    const projectId = data.project_id;
    const customerId = data.customer_id;
    const taskId = data.task_id;

    // Determine parent entity
    if (!projectId && !customerId && !taskId) {
        throw new Error('One of project_id, customer_id, or task_id is required for creating notes');
    }

    // Ensure exactly one parent is provided
    const parentCount = [projectId, customerId, taskId].filter(Boolean).length;
    if (parentCount > 1) {
        throw new Error('Only one of project_id, customer_id, or task_id should be provided');
    }

    // Check organization scope
    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'createNote');

    // Build payload matching database schema
    const payload = {
        note: data.content || data.note,
        type: data.type || 'general',
        project_id: projectId || null,
        customer_id: customerId || null,
        task_id: taskId || null
        // organization_id added by backend from X-Organization-ID header
        // created_by set by backend from JWT token
    };

    // Use appropriate endpoint based on parent entity
    let endpoint;
    if (projectId) {
        endpoint = `/projects/${projectId}/notes`;
    } else if (taskId) {
        endpoint = `/tasks/${taskId}/notes`;
    } else if (customerId) {
        endpoint = `/customers/${customerId}/notes`;
    }

    const response = await dataService.post(endpoint, payload);
    return response.data || response;
}

/**
 * Fetch notes for a project via backend API
 *
 * @param {string} projectId - Project ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Max records to return (default: backend default)
 * @param {number} options.offset - Pagination offset (default: 0)
 * @returns {Promise<Array>} Array of note objects
 */
export async function fetchNotesByProject(projectId, options = {}) {
    if (!projectId) {
        throw new Error('Project ID is required');
    }

    // Check organization scope
    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'fetchNotesByProject');

    // Backend API: GET /projects/{project_id}/notes
    const queryParams = {};
    if (options.limit) queryParams.limit = options.limit;
    if (options.offset) queryParams.offset = options.offset;

    const response = await dataService.get(`/projects/${projectId}/notes`, { params: queryParams });
    return response.data || response;
}

/**
 * Fetch notes for a task via backend API
 *
 * @param {string} taskId - Task ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Max records to return
 * @param {number} options.offset - Pagination offset
 * @returns {Promise<Array>} Array of note objects
 */
export async function fetchNotesByTask(taskId, options = {}) {
    if (!taskId) {
        throw new Error('Task ID is required');
    }

    // Check organization scope
    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'fetchNotesByTask');

    // Backend API: GET /tasks/{task_id}/notes
    const queryParams = {};
    if (options.limit) queryParams.limit = options.limit;
    if (options.offset) queryParams.offset = options.offset;

    const response = await dataService.get(`/tasks/${taskId}/notes`, { params: queryParams });
    return response.data || response;
}

/**
 * Fetch notes for a customer via backend API
 *
 * @param {string} customerId - Customer ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Max records to return
 * @param {number} options.offset - Pagination offset
 * @returns {Promise<Array>} Array of note objects
 */
export async function fetchNotesByCustomer(customerId, options = {}) {
    if (!customerId) {
        throw new Error('Customer ID is required');
    }

    // Check organization scope
    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'fetchNotesByCustomer');

    // Backend API: GET /customers/{customer_id}/notes
    const queryParams = {};
    if (options.limit) queryParams.limit = options.limit;
    if (options.offset) queryParams.offset = options.offset;

    const response = await dataService.get(`/customers/${customerId}/notes`, { params: queryParams });
    return response.data || response;
}

/**
 * Legacy alias for fetchNotesByProject
 * @deprecated Use fetchNotesByProject instead
 */
export async function fetchProjectNotes(projectId, options = {}) {
    return fetchNotesByProject(projectId, options);
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
    if (!noteId) {
        throw new Error('Note ID is required');
    }
    if (!data) {
        throw new Error('Update data is required');
    }

    // Check organization scope
    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'updateNote');

    // Backend API: PATCH /projects/notes/{note_id}
    const payload = {};
    if (data.note || data.content) {
        payload.note = data.content || data.note;
    }
    if (data.type) {
        payload.type = data.type;
    }

    const response = await dataService.patch(`/projects/notes/${noteId}`, payload);
    return response.data || response;
}

/**
 * Delete a note by ID via backend API
 *
 * @param {string} noteId - The note ID
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteNote(noteId) {
    if (!noteId) {
        throw new Error('Note ID is required');
    }

    // Check organization scope
    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'deleteNote');

    // Backend API: DELETE /projects/notes/{note_id}
    const response = await dataService.delete(`/projects/notes/${noteId}`);
    return response.data || response;
}