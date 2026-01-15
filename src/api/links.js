import { dataService, getEnvironmentContext, ENVIRONMENT_TYPES } from '../services/dataService';
import { handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';

/**
 * Creates a new link
 * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
 * @param {Object} data - The link data
 * @param {string} data.link - The URL (required)
 * @param {string} data.project_id - Project ID (optional)
 * @param {string} data.customer_id - Customer ID (optional)
 * @param {string} data.task_id - Task ID (optional)
 * @param {string} data.organization_id - Organization ID (optional)
 * @returns {Promise<Object>} Created link record
 */
export async function createLink(data) {
    validateParams({ data }, ['data']);
    const env = getEnvironmentContext();

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.LINKS,
                action: Actions.CREATE,
                fieldData: {
                    link: data.url || data.link,
                    _fkID: data.project_id || data.fkId
                }
            };

            return await dataService.request(params);
        });
    } else {
        // Backend API: POST /links
        const payload = {
            link: data.url || data.link,
            project_id: data.project_id || data.fkId || null,
            customer_id: data.customer_id || null,
            task_id: data.task_id || null,
            organization_id: data.organization_id || null
        };

        const response = await dataService.post('/links', payload);
        return response.data || response;
    }
}

/**
 * List links with optional filters
 * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
 * @param {Object} filters - Filter options
 * @param {string} filters.project_id - Filter by project ID
 * @param {string} filters.customer_id - Filter by customer ID
 * @param {string} filters.task_id - Filter by task ID
 * @param {string} filters.organization_id - Filter by organization ID
 * @returns {Promise<Array>} Array of links
 */
export async function fetchLinks(filters = {}) {
    const env = getEnvironmentContext();

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        // FileMaker implementation would go here if needed
        return handleFileMakerOperation(async () => {
            const query = [];
            if (filters.project_id || filters.fkId) {
                query.push({ "_fkID": filters.project_id || filters.fkId });
            }

            const params = {
                layout: Layouts.LINKS,
                action: Actions.READ,
                query: query.length > 0 ? query : [{ "__ID": "*" }]
            };

            return await dataService.request(params);
        });
    } else {
        // Backend API: GET /links?project_id={id}&...
        const queryParams = new URLSearchParams();

        if (filters.project_id) queryParams.append('project_id', filters.project_id);
        if (filters.customer_id) queryParams.append('customer_id', filters.customer_id);
        if (filters.task_id) queryParams.append('task_id', filters.task_id);
        if (filters.organization_id) queryParams.append('organization_id', filters.organization_id);

        const url = `/links${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        const response = await dataService.get(url);
        return response.data || response;
    }
}

/**
 * Delete a link by ID
 * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
 * @param {string} linkId - The link ID
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteLink(linkId) {
    validateParams({ linkId }, ['linkId']);
    const env = getEnvironmentContext();

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.LINKS,
                action: Actions.DELETE,
                recordId: linkId
            };

            return await dataService.request(params);
        });
    } else {
        // Backend API: DELETE /links/{link_id}
        const response = await dataService.delete(`/links/${linkId}`);
        return response.data || response;
    }
}