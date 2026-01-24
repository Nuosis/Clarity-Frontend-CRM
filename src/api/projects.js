/**
 * Projects API Client - Backend Integration
 *
 * Environment-aware API client for project operations.
 * Routes to backend REST API in webapp environment, FileMaker in legacy environment.
 *
 * Feature flag control: use_backend_projects (checked at service/hook layer)
 * All requests use HMAC authentication via dataService for security.
 */

import { dataService, getAuthenticationContext } from '../services/dataService';
import { fetchNotesByProject } from './notes';
import { validateUUID } from '../utils/validation';
import {
    withProjectErrorHandling,
    checkProjectOrganizationScope,
    ProjectError,
    ProjectErrorCodes
} from '../errors';

/**
 * Normalize project data
 * @param {Object} data - Raw project data from backend
 * @returns {Object} Normalized project data
 */
function normalizeProjectData(data) {
    // Backend API data - normalize to consistent format
    if (Array.isArray(data)) {
        return data.map(project => ({
            id: project.id,
            __ID: project.id,
            ...project
        }));
    }

    return {
        id: data.id,
        __ID: data.id,
        ...data
    };
}


/**
 * List projects by customer ID with pagination support
 * GET /projects/customer/{customer_id} or GET /projects?customer_id={customer_id}
 * @param {string} customerId - The customer ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Number of records per page (default: 50, max: 200)
 * @param {number} options.offset - Pagination offset (default: 0)
 * @returns {Promise<Object|Array>} Response with projects array and pagination metadata, or just array for backward compatibility
 */
export async function fetchProjectsForCustomer(customerId, options = {}) {
    return withProjectErrorHandling(async () => {
        if (!customerId) {
            throw new ProjectError('Customer ID is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'customerId' });
        }

        validateUUID(customerId, 'Customer ID');

        const auth = getAuthenticationContext();
        checkProjectOrganizationScope({ authentication: auth }, 'fetchProjectsForCustomer');

        // Build query params for pagination
        const params = new URLSearchParams();
        if (options.limit !== undefined) {
            params.append('limit', Math.min(options.limit, 200)); // Max 200
        }
        if (options.offset !== undefined) {
            params.append('offset', options.offset);
        }

        const queryString = params.toString();
        const url = `/api/projects/customer/${customerId}${queryString ? `?${queryString}` : ''}`;

        // Use dedicated customer endpoint
        const response = await dataService.get(url);

        // Return normalized data with pagination metadata if available
        const normalizedData = normalizeProjectData(response.data || response);

        // If backend returns pagination metadata, preserve it
        if (response.pagination) {
            return {
                data: normalizedData,
                pagination: response.pagination
            };
        }

        // Otherwise return just the data (backward compatible)
        return normalizedData;
    }, 'fetchProjectsForCustomer', { customerId, options });
}

/**
 * Fetches projects for multiple customers with pagination support
 * @param {Array<string>} customerIds - Array of customer IDs
 * @param {Object} options - Query options
 * @param {number} options.limit - Number of records per page per customer (default: 50, max: 200)
 * @param {number} options.offset - Pagination offset per customer (default: 0)
 * @returns {Promise<Object|Array>} Response with projects array and combined pagination metadata, or just array for backward compatibility
 */
export async function fetchProjectsForCustomers(customerIds, options = {}) {
    return withProjectErrorHandling(async () => {
        if (!customerIds || !Array.isArray(customerIds)) {
            throw new ProjectError('Customer IDs array is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'customerIds' });
        }

        const auth = getAuthenticationContext();
        checkProjectOrganizationScope({ authentication: auth }, 'fetchProjectsForCustomers');

    // Build query params for pagination
    const params = new URLSearchParams();
    if (options.limit !== undefined) {
        params.append('limit', Math.min(options.limit, 200)); // Max 200
    }
    if (options.offset !== undefined) {
        params.append('offset', options.offset);
    }
    const queryString = params.toString();

    // Fetch projects for each customer and combine results
    const projectResults = await Promise.allSettled(
        customerIds.map(async (id) => {
            try {
                const url = `/api/projects/customer/${id}${queryString ? `?${queryString}` : ''}`;
                return await dataService.get(url);
            } catch (error) {
                const contextError = new Error(`Failed to fetch projects for customer ${id}: ${error.message}`);
                contextError.customerId = id;
                contextError.cause = error;
                throw contextError;
            }
        })
    );

    const failures = projectResults.filter(result => result.status === 'rejected');
    if (failures.length) {
        const failedIds = failures
            .map(failure => failure.reason?.customerId)
            .filter(Boolean);
        console.error('[Projects] Failed to fetch projects for customers:', failures.map(failure => failure.reason));
        const message = failedIds.length
            ? `Failed to fetch projects for customers: ${failedIds.join(', ')}`
            : 'Failed to fetch projects for one or more customers.';
        const error = new Error(message);
        error.failures = failures.map(failure => failure.reason);
        throw error;
    }

    const projectLists = projectResults
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value);

    // Combine all projects
    const allProjects = projectLists.flatMap(response => response.data || response);
    const normalizedData = normalizeProjectData(allProjects);

    // If any response has pagination metadata, combine it
    const hasPagination = projectLists.some(response => response.pagination);
    if (hasPagination) {
        // Calculate combined pagination stats
        const totalProjects = normalizedData.length;
        const hasMore = projectLists.some(response => response.pagination?.has_more);

        return {
            data: normalizedData,
            pagination: {
                total: totalProjects,
                limit: options.limit || 50,
                offset: options.offset || 0,
                has_more: hasMore
            }
        };
    }

        // Otherwise return just the data (backward compatible)
        return normalizedData;
    }, 'fetchProjectsForCustomers', { customerIds, options });
}

/**
 * Get project by ID
 * GET /projects/{project_id}
 * @param {string} projectId - The project ID
 * @returns {Promise<Object>} Project record
 */
export async function fetchProjectById(projectId) {
    return withProjectErrorHandling(async () => {
        if (!projectId) {
            throw new ProjectError('Project ID is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'projectId' });
        }

        validateUUID(projectId, 'Project ID');

        const auth = getAuthenticationContext();
        checkProjectOrganizationScope({ authentication: auth }, 'fetchProjectById');

        const response = await dataService.get(`/api/projects/${projectId}`);
        // Backend returns { success: true, data: project } for single get
        const projectData = response.data || response;
        return normalizeProjectData(projectData);
    }, 'fetchProjectById', { projectId });
}

/**
 * Get project with full nested details
 * GET /projects/{project_id}/detail
 * Returns project with objectives (with steps), images, and notes
 * @param {string} projectId - The project ID
 * @returns {Promise<Object>} Project with nested details
 */
export async function fetchProjectWithDetails(projectId) {
    return withProjectErrorHandling(async () => {
        if (!projectId) {
            throw new ProjectError('Project ID is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'projectId' });
        }

        validateUUID(projectId, 'Project ID');

        const auth = getAuthenticationContext();
        checkProjectOrganizationScope({ authentication: auth }, 'fetchProjectWithDetails');

        const response = await dataService.get(`/api/projects/${projectId}/detail`);
        return normalizeProjectData(response.data || response);
    }, 'fetchProjectWithDetails', { projectId });
}

/**
 * Create a new project
 * POST /projects
 * @param {Object} data - The project data
 * @returns {Promise<Object>} Created project record
 */
export async function createProject(data) {
    return withProjectErrorHandling(async () => {
        if (!data) {
            throw new ProjectError('Project data is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'data' });
        }

        const auth = getAuthenticationContext();
        checkProjectOrganizationScope({ authentication: auth }, 'createProject');

        const response = await dataService.post('/api/projects', data);
        return normalizeProjectData(response.data || response);
    }, 'createProject', { data });
}

/**
 * Update a project
 * PUT /projects/{project_id}
 * @param {string} projectId - The project ID
 * @param {Object} data - The data to update
 * @returns {Promise<Object>} Updated project record
 */
export async function updateProject(projectId, data) {
    return withProjectErrorHandling(async () => {
        if (!projectId) {
            throw new ProjectError('Project ID is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'projectId' });
        }
        if (!data) {
            throw new ProjectError('Project data is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'data' });
        }

        validateUUID(projectId, 'Project ID');

        const auth = getAuthenticationContext();
        checkProjectOrganizationScope({ authentication: auth }, 'updateProject');

        const response = await dataService.put(`/api/projects/${projectId}`, data);
        return normalizeProjectData(response.data || response);
    }, 'updateProject', { projectId, data });
}

/**
 * Delete a project
 * DELETE /projects/{project_id}
 * @param {string} projectId - The project ID
 * @returns {Promise<Object>} Result of the delete operation
 */
export async function deleteProject(projectId) {
    return withProjectErrorHandling(async () => {
        if (!projectId) {
            throw new ProjectError('Project ID is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'projectId' });
        }

        validateUUID(projectId, 'Project ID');

        const auth = getAuthenticationContext();
        checkProjectOrganizationScope({ authentication: auth }, 'deleteProject');

        const response = await dataService.delete(`/api/projects/${projectId}`);
        return response.data || response;
    }, 'deleteProject', { projectId });
}

/**
 * Update a project's status
 * PATCH /projects/{project_id}/status
 * @param {string} projectId - The project ID
 * @param {string} status - The new status (e.g., 'active', 'completed', 'on_hold')
 * @returns {Promise<Object>} Updated project record
 */
export async function updateProjectStatus(projectId, status) {
    return withProjectErrorHandling(async () => {
        if (!projectId) {
            throw new ProjectError('Project ID is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'projectId' });
        }
        if (!status) {
            throw new ProjectError('Status is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'status' });
        }

        validateUUID(projectId, 'Project ID');

        const auth = getAuthenticationContext();
        checkProjectOrganizationScope({ authentication: auth }, 'updateProjectStatus');

        // Backend has dedicated status endpoint with business logic hooks
        const response = await dataService.patch(`/api/projects/${projectId}/status`, { status });
        return normalizeProjectData(response.data || response);
    }, 'updateProjectStatus', { projectId, status });
}

/**
 * List all objectives for a project
 * GET /objectives/project/{project_id}
 * @param {string} projectId - The project ID
 * @returns {Promise<Array>} Array of objective records with nested steps
 */
export async function fetchProjectObjectives(projectId) {
    return withProjectErrorHandling(async () => {
        if (!projectId) {
            throw new ProjectError('Project ID is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'projectId' });
        }

        validateUUID(projectId, 'Project ID');

        const auth = getAuthenticationContext();
        checkProjectOrganizationScope({ authentication: auth }, 'fetchProjectObjectives');

        const response = await dataService.get(`/api/objectives/project/${projectId}`);
        return response.data || response;
    }, 'fetchProjectObjectives', { projectId });
}

/**
 * Create a new project objective
 * POST /objectives
 * @param {Object} data - The objective data (must include project_id)
 * @returns {Promise<Object>} Created objective record
 */
export async function createObjective(data) {
    return withProjectErrorHandling(async () => {
        if (!data) {
            throw new ProjectError('Objective data is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'data' });
        }

        const auth = getAuthenticationContext();
        checkProjectOrganizationScope({ authentication: auth }, 'createObjective');

        const response = await dataService.post('/api/objectives', data);
        return response.data || response;
    }, 'createObjective', { data });
}

/**
 * Update a project objective
 * PATCH /objectives/{objective_id}
 * @param {string} objectiveId - The objective ID
 * @param {Object} data - The data to update
 * @returns {Promise<Object>} Updated objective record
 */
export async function updateObjective(objectiveId, data) {
    return withProjectErrorHandling(async () => {
        if (!objectiveId) {
            throw new ProjectError('Objective ID is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'objectiveId' });
        }
        if (!data) {
            throw new ProjectError('Objective data is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'data' });
        }

        validateUUID(objectiveId, 'Objective ID');

        const auth = getAuthenticationContext();
        checkProjectOrganizationScope({ authentication: auth }, 'updateObjective');

        const response = await dataService.patch(`/api/objectives/${objectiveId}`, data);
        return response.data || response;
    }, 'updateObjective', { objectiveId, data });
}

/**
 * Delete a project objective
 * DELETE /objectives/{objective_id}
 * Note: Backend cascades deletion to related steps
 * @param {string} objectiveId - The objective ID
 * @returns {Promise<Object>} Result of the delete operation
 */
export async function deleteObjective(objectiveId) {
    return withProjectErrorHandling(async () => {
        if (!objectiveId) {
            throw new ProjectError('Objective ID is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'objectiveId' });
        }

        validateUUID(objectiveId, 'Objective ID');

        const auth = getAuthenticationContext();
        checkProjectOrganizationScope({ authentication: auth }, 'deleteObjective');

        const response = await dataService.delete(`/api/objectives/${objectiveId}`);
        return response.data || response;
    }, 'deleteObjective', { objectiveId });
}

/**
 * Reorder project objectives
 * POST /objectives/projects/{project_id}/reorder
 * @param {string} projectId - The project ID
 * @param {Array<string>} objectiveIds - Ordered array of objective IDs
 * @returns {Promise<Array>} Updated array of objectives
 */
export async function reorderObjectives(projectId, objectiveIds) {
    return withProjectErrorHandling(async () => {
        if (!projectId) {
            throw new ProjectError('Project ID is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'projectId' });
        }
        if (!objectiveIds) {
            throw new ProjectError('Objective IDs are required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'objectiveIds' });
        }

        validateUUID(projectId, 'Project ID');

        const auth = getAuthenticationContext();
        checkProjectOrganizationScope({ authentication: auth }, 'reorderObjectives');

        const response = await dataService.post(
            `/api/objectives/projects/${projectId}/reorder`,
            objectiveIds
        );
        return response.data || response;
    }, 'reorderObjectives', { projectId, objectiveIds });
}

/**
 * Toggle objective completion status
 * PATCH /objectives/{objective_id}/completed
 * @param {string} objectiveId - The objective ID
 * @returns {Promise<Object>} Updated objective record
 */
export async function toggleObjectiveCompleted(objectiveId) {
    return withProjectErrorHandling(async () => {
        if (!objectiveId) {
            throw new ProjectError('Objective ID is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'objectiveId' });
        }

        validateUUID(objectiveId, 'Objective ID');

        const auth = getAuthenticationContext();
        checkProjectOrganizationScope({ authentication: auth }, 'toggleObjectiveCompleted');

        const response = await dataService.patch(`/api/objectives/${objectiveId}/completed`);
        return response.data || response;
    }, 'toggleObjectiveCompleted', { objectiveId });
}

/**
 * List project images
 * GET /projects/{project_id}/images
 * @param {string} projectId - The project ID
 * @returns {Promise<Array>} Array of image records
 */
export async function fetchProjectImages(projectId) {
    return withProjectErrorHandling(async () => {
        if (!projectId) {
            throw new ProjectError('Project ID is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'projectId' });
        }

        validateUUID(projectId, 'Project ID');

        const auth = getAuthenticationContext();
        checkProjectOrganizationScope({ authentication: auth }, 'fetchProjectImages');

        const response = await dataService.get(`/api/projects/${projectId}/images`);
        return response.data || response;
    }, 'fetchProjectImages', { projectId });
}

/**
 * Create project image metadata
 * POST /projects/{project_id}/images
 * @param {string} projectId - The project ID
 * @param {Object} data - Image metadata (title, description, url, etc.)
 * @returns {Promise<Object>} Created image record
 */
export async function createProjectImage(projectId, data) {
    return withProjectErrorHandling(async () => {
        if (!projectId) {
            throw new ProjectError('Project ID is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'projectId' });
        }
        if (!data) {
            throw new ProjectError('Image data is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'data' });
        }

        validateUUID(projectId, 'Project ID');

        const auth = getAuthenticationContext();
        checkProjectOrganizationScope({ authentication: auth }, 'createProjectImage');

        const response = await dataService.post(`/api/projects/${projectId}/images`, data);
        return response.data || response;
    }, 'createProjectImage', { projectId, data });
}

/**
 * Update project image metadata
 * PUT /projects/images/{image_id}
 * @param {string} imageId - The image ID
 * @param {Object} data - Image metadata to update
 * @returns {Promise<Object>} Updated image record
 */
export async function updateProjectImage(imageId, data) {
    return withProjectErrorHandling(async () => {
        if (!imageId) {
            throw new ProjectError('Image ID is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'imageId' });
        }
        if (!data) {
            throw new ProjectError('Image data is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'data' });
        }

        validateUUID(imageId, 'Image ID');

        const auth = getAuthenticationContext();
        checkProjectOrganizationScope({ authentication: auth }, 'updateProjectImage');

        const response = await dataService.put(`/api/projects/images/${imageId}`, data);
        return response.data || response;
    }, 'updateProjectImage', { imageId, data });
}

/**
 * Delete project image
 * DELETE /projects/images/{image_id}
 * @param {string} imageId - The image ID
 * @returns {Promise<Object>} Result of the delete operation
 */
export async function deleteProjectImage(imageId) {
    return withProjectErrorHandling(async () => {
        if (!imageId) {
            throw new ProjectError('Image ID is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'imageId' });
        }

        validateUUID(imageId, 'Image ID');

        const auth = getAuthenticationContext();
        checkProjectOrganizationScope({ authentication: auth }, 'deleteProjectImage');

        const response = await dataService.delete(`/api/projects/images/${imageId}`);
        return response.data || response;
    }, 'deleteProjectImage', { imageId });
}

/**
 * List project notes
 * GET /projects/{project_id}/notes
 * @param {string} projectId - The project ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Max records to return
 * @param {number} options.offset - Pagination offset
 * @returns {Promise<Array>} Array of note records
 */
export async function fetchProjectNotes(projectId, options = {}) {
    // Delegate to notes.js API client for consistent note handling
    const result = await fetchNotesByProject(projectId, options);
    return result?.notes || result;
}

/**
 * Create a new objective step
 * POST /steps
 * @param {Object} data - The step data (must include objective_id)
 * @returns {Promise<Object>} Created step record
 */
export async function createStep(data) {
    return withProjectErrorHandling(async () => {
        if (!data) {
            throw new ProjectError('Step data is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'data' });
        }

        const auth = getAuthenticationContext();
        checkProjectOrganizationScope({ authentication: auth }, 'createStep');

        const response = await dataService.post('/api/steps', data);
        return response.data || response;
    }, 'createStep', { data });
}

/**
 * Update an objective step
 * PATCH /steps/{step_id}
 * @param {string} stepId - The step ID
 * @param {Object} data - The data to update
 * @returns {Promise<Object>} Updated step record
 */
export async function updateStep(stepId, data) {
    return withProjectErrorHandling(async () => {
        if (!stepId) {
            throw new ProjectError('Step ID is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'stepId' });
        }
        if (!data) {
            throw new ProjectError('Step data is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'data' });
        }

        validateUUID(stepId, 'Step ID');

        const auth = getAuthenticationContext();
        checkProjectOrganizationScope({ authentication: auth }, 'updateStep');

        const response = await dataService.patch(`/api/steps/${stepId}`, data);
        return response.data || response;
    }, 'updateStep', { stepId, data });
}

/**
 * Delete an objective step
 * DELETE /steps/{step_id}
 * @param {string} stepId - The step ID
 * @returns {Promise<Object>} Result of the delete operation
 */
export async function deleteStep(stepId) {
    return withProjectErrorHandling(async () => {
        if (!stepId) {
            throw new ProjectError('Step ID is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'stepId' });
        }

        validateUUID(stepId, 'Step ID');

        const auth = getAuthenticationContext();
        checkProjectOrganizationScope({ authentication: auth }, 'deleteStep');

        const response = await dataService.delete(`/api/steps/${stepId}`);
        return response.data || response;
    }, 'deleteStep', { stepId });
}

/**
 * Toggle step completion status
 * PATCH /steps/{step_id}/completed
 * @param {string} stepId - The step ID
 * @returns {Promise<Object>} Updated step record
 */
export async function toggleStepCompleted(stepId) {
    return withProjectErrorHandling(async () => {
        if (!stepId) {
            throw new ProjectError('Step ID is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'stepId' });
        }

        validateUUID(stepId, 'Step ID');

        const auth = getAuthenticationContext();
        checkProjectOrganizationScope({ authentication: auth }, 'toggleStepCompleted');

        const response = await dataService.patch(`/api/steps/${stepId}/completed`);
        return response.data || response;
    }, 'toggleStepCompleted', { stepId });
}

/**
 * Reorder objective steps
 * POST /steps/objectives/{objective_id}/reorder
 * @param {string} objectiveId - The objective ID
 * @param {Array<string>} stepIds - Ordered array of step IDs
 * @returns {Promise<Array>} Updated array of steps
 */
export async function reorderSteps(objectiveId, stepIds) {
    return withProjectErrorHandling(async () => {
        if (!objectiveId) {
            throw new ProjectError('Objective ID is required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'objectiveId' });
        }
        if (!stepIds) {
            throw new ProjectError('Step IDs are required', ProjectErrorCodes.REQUIRED_FIELD_MISSING, { field: 'stepIds' });
        }

        validateUUID(objectiveId, 'Objective ID');

        const auth = getAuthenticationContext();
        checkProjectOrganizationScope({ authentication: auth }, 'reorderSteps');

        const response = await dataService.post(
            `/api/steps/objectives/${objectiveId}/reorder`,
            stepIds
        );
        return response.data || response;
    }, 'reorderSteps', { objectiveId, stepIds });
}
