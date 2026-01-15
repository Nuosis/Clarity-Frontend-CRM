import { dataService, getEnvironmentContext } from '../services/dataService';

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
    if (!data) {
        throw new Error('Data is required');
    }

    const linkUrl = data.link || data.url;
    if (!linkUrl) {
        throw new Error('Link URL is required');
    }

    // Check organization scope
    const env = getEnvironmentContext();
    if (!env.authentication?.user?.supabaseOrgID) {
        throw new Error('Organization context required for creating links. Please authenticate.');
    }

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
    if (!linkId) {
        throw new Error('Link ID is required');
    }
    if (!data) {
        throw new Error('Update data is required');
    }

    // Build payload - backend uses 'link' field
    const payload = {};
    if (data.link || data.url) {
        payload.link = data.link || data.url;
    }

    // Backend API: PATCH /links/{link_id}
    const response = await dataService.patch(`/links/${linkId}`, payload);
    return response.data || response;
}

/**
 * Delete a link by ID via backend API
 *
 * @param {string} linkId - The link ID
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteLink(linkId) {
    if (!linkId) {
        throw new Error('Link ID is required');
    }

    // Backend API: DELETE /links/{link_id}
    const response = await dataService.delete(`/links/${linkId}`);
    return response.data || response;
}