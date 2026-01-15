import { createLink, fetchLinks, updateLink as updateLinkApi, deleteLink } from '../api/links';
import { getEnvironmentContext, ENVIRONMENT_TYPES } from './dataService';

/**
 * Transform backend LinkResponse to frontend format
 * @param {Object} backendLink - Link from backend API
 * @returns {Object} Frontend-formatted link
 */
export function transformBackendLink(backendLink) {
    if (!backendLink) return null;

    const linkUrl = backendLink.link;
    let title = null;

    // Generate title from hostname if we have a valid URL
    if (linkUrl) {
        try {
            title = new URL(linkUrl).hostname;
        } catch {
            title = linkUrl;
        }
    }

    return {
        id: backendLink.id,
        url: linkUrl,
        title: title,
        createdAt: backendLink.created_at,
        updatedAt: backendLink.updated_at,
        projectId: backendLink.project_id,
        customerId: backendLink.customer_id,
        taskId: backendLink.task_id,
        organizationId: backendLink.organization_id
    };
}

/**
 * Creates a new link
 * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
 * @param {string|Object} fkIdOrParams - Foreign key ID (legacy) or params object
 * @param {string} link - The link URL (if fkIdOrParams is string)
 * @param {string} [parentType='project'] - Type of parent entity (project/task/customer/organization)
 * @returns {Promise<Object>} Created link record in frontend format
 */
export async function createNewLink(fkIdOrParams, link, parentType = 'project') {
    let params;

    // Support both legacy (fkId, link) and new (params object) signatures
    if (typeof fkIdOrParams === 'object') {
        params = fkIdOrParams;
    } else {
        // Legacy signature: assume project by default
        const fkId = fkIdOrParams;
        if (!fkId || !link?.trim()) {
            throw new Error('ID and link URL are required');
        }

        // Basic URL validation
        try {
            new URL(link.trim());
        } catch (error) {
            throw new Error('Invalid URL format');
        }

        params = {
            [`${parentType}_id`]: fkId,
            link: link.trim()
        };
    }

    // Ensure link field exists
    if (!params.link && !params.url) {
        throw new Error('Link URL is required');
    }

    // Normalize to 'link' field (backend expects 'link', not 'url')
    if (!params.link && params.url) {
        params.link = params.url;
        delete params.url;
    }

    const result = await createLink(params);

    // Transform backend response to frontend format
    return transformBackendLink(result);
}

/**
 * Fetch links for a project
 * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
 * @param {string} projectId - The project ID
 * @returns {Promise<Array>} Array of links in frontend format
 */
export async function fetchLinksByProject(projectId) {
    if (!projectId) {
        throw new Error('Project ID is required');
    }

    const result = await fetchLinks({ project_id: projectId });
    const env = getEnvironmentContext();

    // Process based on environment
    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return processLinks(result);
    } else {
        // Backend API returns array directly - transform to frontend format
        return Array.isArray(result)
            ? result.map(transformBackendLink).filter(Boolean)
            : [];
    }
}

/**
 * Fetch links by entity type and ID
 * @param {string} entityType - Type of entity (project/task/customer/organization)
 * @param {string} entityId - ID of the entity
 * @param {Object} options - Additional fetch options (limit, offset)
 * @returns {Promise<Array>} Array of links in frontend format
 */
export async function fetchLinksByEntity(entityType, entityId, options = {}) {
    if (!entityType || !entityId) {
        throw new Error('Entity type and ID are required');
    }

    const filters = {
        [`${entityType}_id`]: entityId,
        ...options
    };

    const result = await fetchLinks(filters);

    // Backend API returns array directly - transform to frontend format
    return Array.isArray(result)
        ? result.map(transformBackendLink).filter(Boolean)
        : [];
}

/**
 * Update an existing link
 * @param {string} linkId - The link ID
 * @param {Object} data - Update data
 * @param {string} data.link - Updated link URL
 * @param {string} data.url - Updated link URL (alias)
 * @returns {Promise<Object>} Updated link in frontend format
 */
export async function updateExistingLink(linkId, data) {
    if (!linkId) {
        throw new Error('Link ID is required');
    }
    if (!data || (!data.link && !data.url)) {
        throw new Error('Link URL is required');
    }

    // Normalize to 'link' field (backend expects 'link', not 'url')
    const payload = {
        link: data.link || data.url
    };

    // Basic URL validation
    try {
        new URL(payload.link);
    } catch (error) {
        throw new Error('Invalid URL format');
    }

    const result = await updateLinkApi(linkId, payload);

    // Transform backend response to frontend format
    return transformBackendLink(result);
}

/**
 * Delete a link by ID
 * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
 * @param {string} linkId - The link ID
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteLinkById(linkId) {
    if (!linkId) {
        throw new Error('Link ID is required');
    }

    return await deleteLink(linkId);
}

/**
 * Processes links data from FileMaker
 * @param {Object} data - Raw links data
 * @returns {Array} Processed links
 */
export function processLinks(data) {
    if (!data?.response?.data) {
        return [];
    }

    return data.response.data
        .map(link => ({
            id: link.fieldData.__ID,
            recordId: link.recordID,
            url: link.fieldData.link,
            createdAt: link.fieldData['~creationTimestamp'],
            createdBy: link.fieldData['~createdBy']
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}