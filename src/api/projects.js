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
 * List projects by customer ID
 * GET /projects/customer/{customer_id} or GET /projects?customer_id={customer_id}
 * @param {string} customerId - The customer ID
 * @returns {Promise<Array>} Array of project records
 */
export async function fetchProjectsForCustomer(customerId) {
    if (!customerId) {
        throw new Error('Customer ID is required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'fetchProjectsForCustomer');

    // Use dedicated customer endpoint
    const response = await dataService.get(`/api/projects/customer/${customerId}`);
    return normalizeProjectData(response.data || response);
}

/**
 * Fetches projects for multiple customers
 * @param {Array<string>} customerIds - Array of customer IDs
 * @returns {Promise<Array>} Array of project records
 */
export async function fetchProjectsForCustomers(customerIds) {
    if (!customerIds || !Array.isArray(customerIds)) {
        throw new Error('Customer IDs array is required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'fetchProjectsForCustomers');

    // Fetch projects for each customer and combine results
    const projectLists = await Promise.all(
        customerIds.map(id => dataService.get(`/api/projects/customer/${id}`))
    );
    const allProjects = projectLists.flatMap(response => response.data || response);
    return normalizeProjectData(allProjects);
}

/**
 * Get project by ID
 * GET /projects/{project_id}
 * @param {string} projectId - The project ID
 * @returns {Promise<Object>} Project record
 */
export async function fetchProjectById(projectId) {
    if (!projectId) {
        throw new Error('Project ID is required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'fetchProjectById');

    const response = await dataService.get(`/api/projects/${projectId}`);
    // Backend returns { success: true, data: project } for single get
    const projectData = response.data || response;
    return normalizeProjectData(projectData);
}

/**
 * Get project with full nested details
 * GET /projects/{project_id}/detail
 * Returns project with objectives (with steps), images, and notes
 * @param {string} projectId - The project ID
 * @returns {Promise<Object>} Project with nested details
 */
export async function fetchProjectWithDetails(projectId) {
    if (!projectId) {
        throw new Error('Project ID is required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'fetchProjectWithDetails');

    const response = await dataService.get(`/api/projects/${projectId}/detail`);
    return normalizeProjectData(response.data || response);
}

/**
 * Create a new project
 * POST /projects
 * @param {Object} data - The project data
 * @returns {Promise<Object>} Created project record
 */
export async function createProject(data) {
    if (!data) {
        throw new Error('Project data is required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'createProject');

    const response = await dataService.post('/api/projects', data);
    return normalizeProjectData(response.data || response);
}

/**
 * Update a project
 * PUT /projects/{project_id}
 * @param {string} projectId - The project ID
 * @param {Object} data - The data to update
 * @returns {Promise<Object>} Updated project record
 */
export async function updateProject(projectId, data) {
    if (!projectId || !data) {
        throw new Error('Project ID and data are required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'updateProject');

    const response = await dataService.put(`/api/projects/${projectId}`, data);
    return normalizeProjectData(response.data || response);
}

/**
 * Delete a project
 * DELETE /projects/{project_id}
 * @param {string} projectId - The project ID
 * @returns {Promise<Object>} Result of the delete operation
 */
export async function deleteProject(projectId) {
    if (!projectId) {
        throw new Error('Project ID is required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'deleteProject');

    const response = await dataService.delete(`/api/projects/${projectId}`);
    return response.data || response;
}

/**
 * Update a project's status
 * PATCH /projects/{project_id}/status
 * @param {string} projectId - The project ID
 * @param {string} status - The new status (e.g., 'active', 'completed', 'on_hold')
 * @returns {Promise<Object>} Updated project record
 */
export async function updateProjectStatus(projectId, status) {
    if (!projectId || !status) {
        throw new Error('Project ID and status are required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'updateProjectStatus');

    // Backend has dedicated status endpoint with business logic hooks
    const response = await dataService.patch(`/api/projects/${projectId}/status`, { status });
    return normalizeProjectData(response.data || response);
}

/**
 * List all objectives for a project
 * GET /objectives/project/{project_id}
 * @param {string} projectId - The project ID
 * @returns {Promise<Array>} Array of objective records with nested steps
 */
export async function fetchProjectObjectives(projectId) {
    if (!projectId) {
        throw new Error('Project ID is required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'fetchProjectObjectives');

    const response = await dataService.get(`/api/objectives/project/${projectId}`);
    return response.data || response;
}

/**
 * Create a new project objective
 * POST /objectives
 * @param {Object} data - The objective data (must include project_id)
 * @returns {Promise<Object>} Created objective record
 */
export async function createObjective(data) {
    if (!data) {
        throw new Error('Objective data is required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'createObjective');

    const response = await dataService.post('/api/objectives', data);
    return response.data || response;
}

/**
 * Update a project objective
 * PATCH /objectives/{objective_id}
 * @param {string} objectiveId - The objective ID
 * @param {Object} data - The data to update
 * @returns {Promise<Object>} Updated objective record
 */
export async function updateObjective(objectiveId, data) {
    if (!objectiveId || !data) {
        throw new Error('Objective ID and data are required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'updateObjective');

    const response = await dataService.patch(`/api/objectives/${objectiveId}`, data);
    return response.data || response;
}

/**
 * Delete a project objective
 * DELETE /objectives/{objective_id}
 * Note: Backend cascades deletion to related steps
 * @param {string} objectiveId - The objective ID
 * @returns {Promise<Object>} Result of the delete operation
 */
export async function deleteObjective(objectiveId) {
    if (!objectiveId) {
        throw new Error('Objective ID is required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'deleteObjective');

    const response = await dataService.delete(`/api/objectives/${objectiveId}`);
    return response.data || response;
}

/**
 * Reorder project objectives
 * POST /objectives/projects/{project_id}/reorder
 * @param {string} projectId - The project ID
 * @param {Array<string>} objectiveIds - Ordered array of objective IDs
 * @returns {Promise<Array>} Updated array of objectives
 */
export async function reorderObjectives(projectId, objectiveIds) {
    if (!projectId || !objectiveIds) {
        throw new Error('Project ID and objective IDs are required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'reorderObjectives');

    const response = await dataService.post(
        `/api/objectives/projects/${projectId}/reorder`,
        objectiveIds
    );
    return response.data || response;
}

/**
 * Toggle objective completion status
 * PATCH /objectives/{objective_id}/completed
 * @param {string} objectiveId - The objective ID
 * @returns {Promise<Object>} Updated objective record
 */
export async function toggleObjectiveCompleted(objectiveId) {
    if (!objectiveId) {
        throw new Error('Objective ID is required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'toggleObjectiveCompleted');

    const response = await dataService.patch(`/api/objectives/${objectiveId}/completed`);
    return response.data || response;
}

/**
 * List project images
 * GET /projects/{project_id}/images
 * @param {string} projectId - The project ID
 * @returns {Promise<Array>} Array of image records
 */
export async function fetchProjectImages(projectId) {
    if (!projectId) {
        throw new Error('Project ID is required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'fetchProjectImages');

    const response = await dataService.get(`/api/projects/${projectId}/images`);
    return response.data || response;
}

/**
 * Create project image metadata
 * POST /projects/{project_id}/images
 * @param {string} projectId - The project ID
 * @param {Object} data - Image metadata (title, description, url, etc.)
 * @returns {Promise<Object>} Created image record
 */
export async function createProjectImage(projectId, data) {
    if (!projectId || !data) {
        throw new Error('Project ID and data are required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'createProjectImage');

    const response = await dataService.post(`/api/projects/${projectId}/images`, data);
    return response.data || response;
}

/**
 * Update project image metadata
 * PUT /projects/images/{image_id}
 * @param {string} imageId - The image ID
 * @param {Object} data - Image metadata to update
 * @returns {Promise<Object>} Updated image record
 */
export async function updateProjectImage(imageId, data) {
    if (!imageId || !data) {
        throw new Error('Image ID and data are required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'updateProjectImage');

    const response = await dataService.put(`/api/projects/images/${imageId}`, data);
    return response.data || response;
}

/**
 * Delete project image
 * DELETE /projects/images/{image_id}
 * @param {string} imageId - The image ID
 * @returns {Promise<Object>} Result of the delete operation
 */
export async function deleteProjectImage(imageId) {
    if (!imageId) {
        throw new Error('Image ID is required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'deleteProjectImage');

    const response = await dataService.delete(`/api/projects/images/${imageId}`);
    return response.data || response;
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
    return fetchNotesByProject(projectId, options);
}

/**
 * Create a new objective step
 * POST /steps
 * @param {Object} data - The step data (must include objective_id)
 * @returns {Promise<Object>} Created step record
 */
export async function createStep(data) {
    if (!data) {
        throw new Error('Step data is required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'createStep');

    const response = await dataService.post('/api/steps', data);
    return response.data || response;
}

/**
 * Update an objective step
 * PATCH /steps/{step_id}
 * @param {string} stepId - The step ID
 * @param {Object} data - The data to update
 * @returns {Promise<Object>} Updated step record
 */
export async function updateStep(stepId, data) {
    if (!stepId || !data) {
        throw new Error('Step ID and data are required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'updateStep');

    const response = await dataService.patch(`/api/steps/${stepId}`, data);
    return response.data || response;
}

/**
 * Delete an objective step
 * DELETE /steps/{step_id}
 * @param {string} stepId - The step ID
 * @returns {Promise<Object>} Result of the delete operation
 */
export async function deleteStep(stepId) {
    if (!stepId) {
        throw new Error('Step ID is required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'deleteStep');

    const response = await dataService.delete(`/api/steps/${stepId}`);
    return response.data || response;
}

/**
 * Toggle step completion status
 * PATCH /steps/{step_id}/completed
 * @param {string} stepId - The step ID
 * @returns {Promise<Object>} Updated step record
 */
export async function toggleStepCompleted(stepId) {
    if (!stepId) {
        throw new Error('Step ID is required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'toggleStepCompleted');

    const response = await dataService.patch(`/api/steps/${stepId}/completed`);
    return response.data || response;
}

/**
 * Reorder objective steps
 * POST /steps/objectives/{objective_id}/reorder
 * @param {string} objectiveId - The objective ID
 * @param {Array<string>} stepIds - Ordered array of step IDs
 * @returns {Promise<Array>} Updated array of steps
 */
export async function reorderSteps(objectiveId, stepIds) {
    if (!objectiveId || !stepIds) {
        throw new Error('Objective ID and step IDs are required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'reorderSteps');

    const response = await dataService.post(
        `/api/steps/objectives/${objectiveId}/reorder`,
        stepIds
    );
    return response.data || response;
}
