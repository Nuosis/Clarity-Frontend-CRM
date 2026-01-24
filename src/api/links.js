import { dataService, getAuthenticationContext } from '../services/dataService';
import {
    withErrorHandling,
    checkOrganizationScope,
    LinkErrorCodes,
    LinkError
} from '../errors/linkErrors';
import { validateUUID } from '../utils/validation';

/**
 * Creates a new link via backend API
 *
 * @param {Object} data - The link data
 * @param {string} data.link - The URL (required)
 * @param {string} data.url - The URL (alias for 'link')
 * @param {string} data.project_id - Project ID (mutually exclusive with customer_id/task_id/organization_id)
 * @param {string} data.customer_id - Customer ID (mutually exclusive with project_id/task_id/organization_id)
 * @param {string} data.task_id - Task ID (mutually exclusive with project_id/customer_id/organization_id)
 * @param {string} data.organization_id - Organization ID (mutually exclusive with project_id/customer_id/task_id)
 * @returns {Promise<Object>} Created link record
 *
 * @note Backend schema uses 'link' field (not 'url', no 'title' or 'description')
 * @note Exactly ONE parent FK (project_id, customer_id, task_id, or organization_id) should be provided
 * @note Backend automatically sets organization context from JWT
 */
export async function createLink(data) {
    return withErrorHandling(async () => {
        if (!data) {
            throw new LinkError('Data is required', LinkErrorCodes.REQUIRED_FIELD_MISSING, { field: 'data' });
        }

        const linkUrl = data.link || data.url;
        if (!linkUrl) {
            throw new LinkError('Link URL is required', LinkErrorCodes.REQUIRED_FIELD_MISSING, { field: 'link' });
        }

        // Check organization scope
        const auth = getAuthenticationContext();
        checkOrganizationScope({ authentication: auth }, 'createLink');

        // Build payload matching backend schema
        // Note: Backend uses 'link' field, not 'url'
        const payload = {
            link: linkUrl,
            project_id: data.project_id || null,
            customer_id: data.customer_id || null,
            task_id: data.task_id || null,
            organization_id: data.organization_id || null
        };

        // Backend API: POST /links
        const response = await dataService.post('/links', payload);
        return response.data || response;
    }, 'createLink', { data });
}

/**
 * Fetch links with optional filters via backend API
 *
 * @param {Object} filters - Filter options
 * @param {string} filters.project_id - Filter by project ID
 * @param {string} filters.customer_id - Filter by customer ID
 * @param {string} filters.task_id - Filter by task ID
 * @param {string} filters.organization_id - Filter by organization ID
 * @param {number} filters.limit - Max records to return (pagination)
 * @param {number} filters.offset - Pagination offset
 * @returns {Promise<Array>} Array of link objects
 *
 * @note Backend endpoint requires JWT authentication (not HMAC)
 */
export async function fetchLinks(filters = {}) {
    return withErrorHandling(async () => {
        // Check organization scope
        const auth = getAuthenticationContext();
        checkOrganizationScope({ authentication: auth }, 'fetchLinks');

        // Validate UUIDs if provided
        if (filters.project_id) validateUUID(filters.project_id, 'Project ID');
        if (filters.customer_id) validateUUID(filters.customer_id, 'Customer ID');
        if (filters.task_id) validateUUID(filters.task_id, 'Task ID');
        if (filters.organization_id) validateUUID(filters.organization_id, 'Organization ID');

        // Backend API: GET /links?project_id={id}&...
        const params = {};

        if (filters.project_id) params.project_id = filters.project_id;
        if (filters.customer_id) params.customer_id = filters.customer_id;
        if (filters.task_id) params.task_id = filters.task_id;
        if (filters.organization_id) params.organization_id = filters.organization_id;
        if (filters.limit) params.limit = filters.limit;
        if (filters.offset) params.offset = filters.offset;

        const response = await dataService.get('/links', { params });
        return response.data || response;
    }, 'fetchLinks', { filters });
}

/**
 * Update a link by ID via backend API
 *
 * @param {string} linkId - The link ID
 * @param {Object} data - Update data
 * @param {string} data.link - Updated link URL
 * @param {string} data.url - Updated link URL (alias)
 * @returns {Promise<Object>} Updated link record
 */
export async function updateLink(linkId, data) {
    return withErrorHandling(async () => {
        if (!linkId) {
            throw new LinkError('Link ID is required', LinkErrorCodes.REQUIRED_FIELD_MISSING, { field: 'linkId' });
        }
        if (!data) {
            throw new LinkError('Update data is required', LinkErrorCodes.REQUIRED_FIELD_MISSING, { field: 'data' });
        }

        validateUUID(linkId, 'Link ID');

        // Check organization scope
        const auth = getAuthenticationContext();
        checkOrganizationScope({ authentication: auth }, 'updateLink');

        // Build payload - backend uses 'link' field
        const payload = {};
        if (data.link || data.url) {
            payload.link = data.link || data.url;
        }

        // Backend API: PATCH /links/{link_id}
        const response = await dataService.patch(`/links/${linkId}`, payload);
        return response.data || response;
    }, 'updateLink', { linkId, data });
}

/**
 * Delete a link by ID via backend API
 *
 * @param {string} linkId - The link ID
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteLink(linkId) {
    return withErrorHandling(async () => {
        if (!linkId) {
            throw new LinkError('Link ID is required', LinkErrorCodes.REQUIRED_FIELD_MISSING, { field: 'linkId' });
        }

        validateUUID(linkId, 'Link ID');

        // Check organization scope
        const auth = getAuthenticationContext();
        checkOrganizationScope({ authentication: auth }, 'deleteLink');

        // Backend API: DELETE /links/{link_id}
        const response = await dataService.delete(`/links/${linkId}`);
        return response.data || response;
    }, 'deleteLink', { linkId });
}