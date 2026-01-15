import { dataService, getEnvironmentContext, ENVIRONMENT_TYPES } from '../services/dataService';
import { handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';

/**
 * Creates a new note for a project
 * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
 * @param {Object} data - The note data
 * @param {string} data.project_id - Project ID (required for project notes)
 * @param {string} data.content - Note content (required)
 * @param {string} data.entity_type - Entity type (e.g., 'project', 'customer')
 * @param {string} data.entity_id - Entity ID
 * @param {string} data.author - Author name/ID (optional)
 * @returns {Promise<Object>} Created note record
 */
export async function createNote(data) {
    validateParams({ data }, ['data']);
    const env = getEnvironmentContext();

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.NOTES,
                action: Actions.CREATE,
                fieldData: {
                    note: data.content || data.note,
                    _fkID: data.project_id || data.fkId || data.entity_id,
                    type: data.type || 'general'
                }
            };

            return await dataService.request(params);
        });
    } else {
        // Backend API: POST /projects/{project_id}/notes
        // Notes use polymorphic structure with entity_type and entity_id
        const projectId = data.project_id || data.fkId || data.entity_id;

        if (!projectId) {
            throw new Error('project_id is required for creating notes');
        }

        // Check organization scope
        if (!env.authentication?.user?.supabaseOrgID) {
            throw new Error('Organization context required for creating notes. Please authenticate.');
        }

        const payload = {
            entity_type: data.entity_type || 'project',
            entity_id: projectId,
            organization_id: env.authentication.user.supabaseOrgID,
            content: data.content || data.note,
            author: data.author || null
        };

        const response = await dataService.post(`/projects/${projectId}/notes`, payload);
        return response.data || response;
    }
}

/**
 * List notes for a project
 * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
 * @param {string} projectId - Project ID
 * @returns {Promise<Array>} Array of notes
 */
export async function fetchProjectNotes(projectId) {
    validateParams({ projectId }, ['projectId']);
    const env = getEnvironmentContext();

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.NOTES,
                action: Actions.READ,
                query: [{ "_fkID": projectId }]
            };

            return await dataService.request(params);
        });
    } else {
        // Backend API: GET /projects/{project_id}/notes
        const response = await dataService.get(`/projects/${projectId}/notes`);
        return response.data || response;
    }
}

/**
 * Delete a note by ID
 * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
 * @param {string} noteId - The note ID
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteNote(noteId) {
    validateParams({ noteId }, ['noteId']);
    const env = getEnvironmentContext();

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.NOTES,
                action: Actions.DELETE,
                recordId: noteId
            };

            return await dataService.request(params);
        });
    } else {
        // Backend API: DELETE /projects/notes/{note_id}
        const response = await dataService.delete(`/projects/notes/${noteId}`);
        return response.data || response;
    }
}