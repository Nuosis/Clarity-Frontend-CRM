/**
 * Project Images API Client - Backend Integration
 *
 * Environment-aware API client for project image operations.
 * Routes to backend REST API in webapp environment, FileMaker in legacy environment.
 */

import { dataService, getEnvironmentContext, ENVIRONMENT_TYPES } from '../services/dataService';
import { handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';

/**
 * Creates a new project image metadata record
 * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
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
    validateParams({ data }, ['data']);
    const env = getEnvironmentContext();

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.PROJECT_IMAGES || 'devProjectImages',
                action: Actions.CREATE,
                fieldData: {
                    url: data.url,
                    _projectID: data.project_id,
                    title: data.title || '',
                    description: data.description || ''
                }
            };

            return await dataService.request(params);
        });
    } else {
        // Backend API: POST /projects/{project_id}/images
        if (!data.project_id) {
            throw new Error('project_id is required for creating project images');
        }

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
}

/**
 * List images for a project
 * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
 * @param {string} projectId - Project ID
 * @returns {Promise<Array>} Array of images
 */
export async function fetchProjectImages(projectId) {
    validateParams({ projectId }, ['projectId']);
    const env = getEnvironmentContext();

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.PROJECT_IMAGES || 'devProjectImages',
                action: Actions.READ,
                query: [{ "_projectID": projectId }]
            };

            return await dataService.request(params);
        });
    } else {
        // Backend API: GET /projects/{project_id}/images
        const response = await dataService.get(`/projects/${projectId}/images`);
        return response.data || response;
    }
}

/**
 * Delete a project image by ID
 * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
 * @param {string} imageId - The image ID
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteProjectImage(imageId) {
    validateParams({ imageId }, ['imageId']);
    const env = getEnvironmentContext();

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.PROJECT_IMAGES || 'devProjectImages',
                action: Actions.DELETE,
                recordId: imageId
            };

            return await dataService.request(params);
        });
    } else {
        // Backend API: DELETE /projects/images/{image_id}
        const response = await dataService.delete(`/projects/images/${imageId}`);
        return response.data || response;
    }
}
