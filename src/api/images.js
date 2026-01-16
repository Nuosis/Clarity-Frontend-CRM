/**
 * Project Images API Client - Backend Integration
 *
 * API client for project image operations via backend REST API.
 */

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
 * Creates a new project image metadata record
 * @param {Object} data - The image data
 * @param {string} data.project_id - Project ID (required)
 * @param {string} data.url - Image URL (required)
 * @param {string} data.title - Image title (optional)
 * @param {string} data.description - Image description (optional)
 * @param {string} data.file_name - Original file name (optional)
 * @param {string} data.storage_provider - Storage provider (optional)
 * @returns {Promise<Object>} Created image record
 */
export async function createProjectImage(data) {
    if (!data || !data.project_id) {
        throw new Error('Data with project_id is required for creating project images');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'createProjectImage');

    const payload = {
        project_id: data.project_id,
        url: data.url,
        title: data.title || null,
        description: data.description || null,
        file_name: data.file_name || null,
        storage_provider: data.storage_provider || null
    };

    const response = await dataService.post(`/projects/${data.project_id}/images`, payload);
    return response.data || response;
}

/**
 * List images for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<Array>} Array of images
 */
export async function fetchProjectImages(projectId) {
    if (!projectId) {
        throw new Error('Project ID is required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'fetchProjectImages');

    const response = await dataService.get(`/projects/${projectId}/images`);
    return response.data || response;
}

/**
 * Delete a project image by ID
 * @param {string} imageId - The image ID
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteProjectImage(imageId) {
    if (!imageId) {
        throw new Error('Image ID is required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'deleteProjectImage');

    const response = await dataService.delete(`/projects/images/${imageId}`);
    return response.data || response;
}
