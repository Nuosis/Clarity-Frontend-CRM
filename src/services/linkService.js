import { createLink, fetchLinks, deleteLink } from '../api/links';
import { getEnvironmentContext, ENVIRONMENT_TYPES } from './dataService';

/**
 * Creates a new link
 * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
 * @param {string} fkId - Foreign key ID (project, task, customer, etc.)
 * @param {string} link - The link URL
 * @returns {Promise<Object>} Created link record
 */
export async function createNewLink(fkId, link) {
    if (!fkId || !link?.trim()) {
        throw new Error('ID and link URL are required');
    }

    // Basic URL validation
    try {
        new URL(link.trim());
    } catch (error) {
        throw new Error('Invalid URL format');
    }

    return await createLink({
        project_id: fkId, // Assume project by default
        fkId, // Legacy FileMaker support
        link: link.trim(),
        url: link.trim() // Support both 'link' and 'url' parameters
    });
}

/**
 * Fetch links for a project
 * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
 * @param {string} projectId - The project ID
 * @returns {Promise<Array>} Array of links
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
        // Backend API returns array directly
        return Array.isArray(result) ? result.map(link => ({
            id: link.id,
            url: link.link,
            title: link.title || new URL(link.link).hostname,
            createdAt: link.created_at,
            updatedAt: link.updated_at
        })) : [];
    }
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