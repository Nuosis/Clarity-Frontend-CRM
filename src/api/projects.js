/**
 * Projects API Client - Backend Integration
 *
 * Environment-aware API client for project operations.
 * Routes to backend REST API in webapp environment, FileMaker in legacy environment.
 *
 * All requests use HMAC authentication via dataService for security.
 */

import { dataService, getEnvironmentContext, ENVIRONMENT_TYPES } from '../services/dataService';
import { handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';
import { fetchNotesByProject } from './notes';

/**
 * Normalize project data based on environment
 * @param {Object} data - Raw project data from either environment
 * @param {string} environment - Environment type
 * @returns {Object} Normalized project data
 */
function normalizeProjectData(data, environment) {
    if (environment === ENVIRONMENT_TYPES.FILEMAKER) {
        return data;
    }

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
 * Check organization scope for webapp environment
 * @param {Object} env - Environment context
 * @param {string} operation - Operation name for error messages
 * @throws {Error} If organization ID is missing in webapp environment
 */
function checkOrganizationScope(env, operation) {
    if (env.type === ENVIRONMENT_TYPES.WEBAPP) {
        if (!env.authentication?.user?.supabaseOrgID) {
            throw new Error(`Organization context required for ${operation}. Please authenticate.`);
        }
    }
}

/**
 * List projects by customer ID (environment-aware)
 * GET /projects/customer/{customer_id} or GET /projects?customer_id={customer_id}
 * @param {string} customerId - The customer ID
 * @returns {Promise<Array>} Array of project records
 */
export async function fetchProjectsForCustomer(customerId) {
    validateParams({ customerId }, ['customerId']);
    const env = getEnvironmentContext();
    checkOrganizationScope(env, 'fetchProjectsForCustomer');

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.PROJECTS,
                action: Actions.READ,
                query: [{ "_custID": customerId }]
            };
            return await dataService.request(params);
        });
    } else {
        // Use dedicated customer endpoint
        const response = await dataService.get(`/projects/customer/${customerId}`);
        return normalizeProjectData(response.data || response, env.type);
    }
}

/**
 * Fetches projects for multiple customers (environment-aware)
 * @param {Array<string>} customerIds - Array of customer IDs
 * @returns {Promise<Array>} Array of project records
 */
export async function fetchProjectsForCustomers(customerIds) {
    validateParams({ customerIds }, ['customerIds']);
    const env = getEnvironmentContext();
    checkOrganizationScope(env, 'fetchProjectsForCustomers');

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const query = customerIds.length > 0
                ? customerIds.map(id => ({ "_custID": id }))
                : [{ "__ID": "*" }];
            const params = {
                layout: Layouts.PROJECTS,
                action: Actions.READ,
                query
            };
            return await dataService.request(params);
        });
    } else {
        // Fetch projects for each customer and combine results
        const projectLists = await Promise.all(
            customerIds.map(id => dataService.get(`/projects/customer/${id}`))
        );
        const allProjects = projectLists.flat();
        return normalizeProjectData(allProjects, env.type);
    }
}

/**
 * Get project by ID (environment-aware)
 * GET /projects/{project_id}
 * @param {string} projectId - The project ID
 * @returns {Promise<Object>} Project record
 */
export async function fetchProjectById(projectId) {
    validateParams({ projectId }, ['projectId']);
    const env = getEnvironmentContext();
    checkOrganizationScope(env, 'fetchProjectById');

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.PROJECTS,
                action: Actions.READ,
                query: [{ "__ID": projectId }]
            };
            return await dataService.request(params);
        });
    } else {
        const response = await dataService.get(`/projects/${projectId}`);
        // Backend returns { success: true, data: project } for single get
        const projectData = response.data || response;
        return normalizeProjectData(projectData, env.type);
    }
}

/**
 * Get project with full nested details (environment-aware)
 * GET /projects/{project_id}/detail
 * Returns project with objectives (with steps), images, and notes
 * @param {string} projectId - The project ID
 * @returns {Promise<Object>} Project with nested details
 */
export async function fetchProjectWithDetails(projectId) {
    validateParams({ projectId }, ['projectId']);
    const env = getEnvironmentContext();
    checkOrganizationScope(env, 'fetchProjectWithDetails');

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            // FileMaker requires separate calls for related data
            return await fetchAllProjectData(projectId);
        });
    } else {
        const response = await dataService.get(`/projects/${projectId}/detail`);
        return normalizeProjectData(response.data || response, env.type);
    }
}

/**
 * Create a new project (environment-aware)
 * POST /projects
 * @param {Object} data - The project data
 * @returns {Promise<Object>} Created project record
 */
export async function createProject(data) {
    validateParams({ data }, ['data']);
    const env = getEnvironmentContext();
    checkOrganizationScope(env, 'createProject');

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.PROJECTS,
                action: Actions.CREATE,
                fieldData: data
            };
            return await dataService.request(params);
        });
    } else {
        const response = await dataService.post('/projects', data);
        return normalizeProjectData(response.data || response, env.type);
    }
}

/**
 * Update a project (environment-aware)
 * PUT /projects/{project_id}
 * @param {string} projectId - The project ID
 * @param {Object} data - The data to update
 * @returns {Promise<Object>} Updated project record
 */
export async function updateProject(projectId, data) {
    validateParams({ projectId, data }, ['projectId', 'data']);
    const env = getEnvironmentContext();
    checkOrganizationScope(env, 'updateProject');

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.PROJECTS,
                action: Actions.UPDATE,
                recordId: projectId,
                fieldData: data
            };
            return await dataService.request(params);
        });
    } else {
        const response = await dataService.put(`/projects/${projectId}`, data);
        return normalizeProjectData(response.data || response, env.type);
    }
}

/**
 * Delete a project (environment-aware)
 * DELETE /projects/{project_id}
 * @param {string} projectId - The project ID
 * @returns {Promise<Object>} Result of the delete operation
 */
export async function deleteProject(projectId) {
    validateParams({ projectId }, ['projectId']);
    const env = getEnvironmentContext();
    checkOrganizationScope(env, 'deleteProject');

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.PROJECTS,
                action: Actions.DELETE,
                recordId: projectId
            };
            return await dataService.request(params);
        });
    } else {
        const response = await dataService.delete(`/projects/${projectId}`);
        return response.data || response;
    }
}

/**
 * Update a project's status (environment-aware)
 * PATCH /projects/{project_id}/status
 * @param {string} projectId - The project ID
 * @param {string} status - The new status (e.g., 'active', 'completed', 'on_hold')
 * @returns {Promise<Object>} Updated project record
 */
export async function updateProjectStatus(projectId, status) {
    validateParams({ projectId, status }, ['projectId', 'status']);
    const env = getEnvironmentContext();
    checkOrganizationScope(env, 'updateProjectStatus');

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.PROJECTS,
                action: Actions.UPDATE,
                recordId: projectId,
                fieldData: { status }
            };
            return await dataService.request(params);
        });
    } else {
        // Backend has dedicated status endpoint with business logic hooks
        const response = await dataService.patch(`/projects/${projectId}/status`, { status });
        return normalizeProjectData(response.data || response, env.type);
    }
}

/**
 * List all objectives for a project (environment-aware)
 * GET /objectives/project/{project_id}
 * @param {string} projectId - The project ID
 * @returns {Promise<Array>} Array of objective records with nested steps
 */
export async function fetchProjectObjectives(projectId) {
    validateParams({ projectId }, ['projectId']);
    const env = getEnvironmentContext();
    checkOrganizationScope(env, 'fetchProjectObjectives');

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.PROJECT_OBJECTIVES,
                action: Actions.READ,
                query: [{ "_fkID": projectId }]
            };
            return await dataService.request(params);
        });
    } else {
        const response = await dataService.get(`/objectives/project/${projectId}`);
        return response.data || response;
    }
}

/**
 * Create a new project objective (environment-aware)
 * POST /objectives
 * @param {Object} data - The objective data (must include project_id)
 * @returns {Promise<Object>} Created objective record
 */
export async function createObjective(data) {
    validateParams({ data }, ['data']);
    const env = getEnvironmentContext();
    checkOrganizationScope(env, 'createObjective');

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.PROJECT_OBJECTIVES,
                action: Actions.CREATE,
                fieldData: data
            };
            return await dataService.request(params);
        });
    } else {
        const response = await dataService.post('/objectives', data);
        return response.data || response;
    }
}

/**
 * Update a project objective (environment-aware)
 * PATCH /objectives/{objective_id}
 * @param {string} objectiveId - The objective ID
 * @param {Object} data - The data to update
 * @returns {Promise<Object>} Updated objective record
 */
export async function updateObjective(objectiveId, data) {
    validateParams({ objectiveId, data }, ['objectiveId', 'data']);
    const env = getEnvironmentContext();
    checkOrganizationScope(env, 'updateObjective');

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.PROJECT_OBJECTIVES,
                action: Actions.UPDATE,
                recordId: objectiveId,
                fieldData: data
            };
            return await dataService.request(params);
        });
    } else {
        const response = await dataService.patch(`/objectives/${objectiveId}`, data);
        return response.data || response;
    }
}

/**
 * Delete a project objective (environment-aware)
 * DELETE /objectives/{objective_id}
 * Note: Backend cascades deletion to related steps
 * @param {string} objectiveId - The objective ID
 * @returns {Promise<Object>} Result of the delete operation
 */
export async function deleteObjective(objectiveId) {
    validateParams({ objectiveId }, ['objectiveId']);
    const env = getEnvironmentContext();
    checkOrganizationScope(env, 'deleteObjective');

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.PROJECT_OBJECTIVES,
                action: Actions.DELETE,
                recordId: objectiveId
            };
            return await dataService.request(params);
        });
    } else {
        const response = await dataService.delete(`/objectives/${objectiveId}`);
        return response.data || response;
    }
}

/**
 * Reorder project objectives (environment-aware)
 * POST /objectives/projects/{project_id}/reorder
 * @param {string} projectId - The project ID
 * @param {Array<string>} objectiveIds - Ordered array of objective IDs
 * @returns {Promise<Array>} Updated array of objectives
 */
export async function reorderObjectives(projectId, objectiveIds) {
    validateParams({ projectId, objectiveIds }, ['projectId', 'objectiveIds']);
    const env = getEnvironmentContext();
    checkOrganizationScope(env, 'reorderObjectives');

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        // FileMaker doesn't support reordering - would need manual update loop
        throw new Error('Objective reordering not supported in FileMaker environment');
    } else {
        const response = await dataService.post(
            `/objectives/projects/${projectId}/reorder`,
            objectiveIds
        );
        return response.data || response;
    }
}

/**
 * Toggle objective completion status (environment-aware)
 * PATCH /objectives/{objective_id}/completed
 * @param {string} objectiveId - The objective ID
 * @returns {Promise<Object>} Updated objective record
 */
export async function toggleObjectiveCompleted(objectiveId) {
    validateParams({ objectiveId }, ['objectiveId']);
    const env = getEnvironmentContext();
    checkOrganizationScope(env, 'toggleObjectiveCompleted');

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            // FileMaker would need to fetch current state and toggle
            throw new Error('Use updateObjective with f_completed field for FileMaker');
        });
    } else {
        const response = await dataService.patch(`/objectives/${objectiveId}/completed`);
        return response.data || response;
    }
}

/**
 * List project images (environment-aware)
 * GET /projects/{project_id}/images
 * @param {string} projectId - The project ID
 * @returns {Promise<Array>} Array of image records
 */
export async function fetchProjectImages(projectId) {
    validateParams({ projectId }, ['projectId']);
    const env = getEnvironmentContext();
    checkOrganizationScope(env, 'fetchProjectImages');

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            return await fetchProjectRelatedData(projectId, Layouts.PROJECT_IMAGES);
        });
    } else {
        const response = await dataService.get(`/projects/${projectId}/images`);
        return response.data || response;
    }
}

/**
 * Create project image metadata (environment-aware)
 * POST /projects/{project_id}/images
 * @param {string} projectId - The project ID
 * @param {Object} data - Image metadata (title, description, url, etc.)
 * @returns {Promise<Object>} Created image record
 */
export async function createProjectImage(projectId, data) {
    validateParams({ projectId, data }, ['projectId', 'data']);
    const env = getEnvironmentContext();
    checkOrganizationScope(env, 'createProjectImage');

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.PROJECT_IMAGES,
                action: Actions.CREATE,
                fieldData: { ...data, _fkID: projectId }
            };
            return await dataService.request(params);
        });
    } else {
        const response = await dataService.post(`/projects/${projectId}/images`, data);
        return response.data || response;
    }
}

/**
 * Update project image metadata (environment-aware)
 * PUT /projects/images/{image_id}
 * @param {string} imageId - The image ID
 * @param {Object} data - Image metadata to update
 * @returns {Promise<Object>} Updated image record
 */
export async function updateProjectImage(imageId, data) {
    validateParams({ imageId, data }, ['imageId', 'data']);
    const env = getEnvironmentContext();
    checkOrganizationScope(env, 'updateProjectImage');

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.PROJECT_IMAGES,
                action: Actions.UPDATE,
                recordId: imageId,
                fieldData: data
            };
            return await dataService.request(params);
        });
    } else {
        const response = await dataService.put(`/projects/images/${imageId}`, data);
        return response.data || response;
    }
}

/**
 * Delete project image (environment-aware)
 * DELETE /projects/images/{image_id}
 * @param {string} imageId - The image ID
 * @returns {Promise<Object>} Result of the delete operation
 */
export async function deleteProjectImage(imageId) {
    validateParams({ imageId }, ['imageId']);
    const env = getEnvironmentContext();
    checkOrganizationScope(env, 'deleteProjectImage');

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.PROJECT_IMAGES,
                action: Actions.DELETE,
                recordId: imageId
            };
            return await dataService.request(params);
        });
    } else {
        const response = await dataService.delete(`/projects/images/${imageId}`);
        return response.data || response;
    }
}

/**
 * List project notes (environment-aware)
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
 * Create project note (environment-aware)
 * POST /projects/{project_id}/notes
 * @param {string} projectId - The project ID
 * @param {Object} data - Note data (content, author, etc.)
 * @returns {Promise<Object>} Created note record
 */
export async function createProjectNote(projectId, data) {
    validateParams({ projectId, data }, ['projectId', 'data']);
    const env = getEnvironmentContext();
    checkOrganizationScope(env, 'createProjectNote');

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.NOTES,
                action: Actions.CREATE,
                fieldData: { ...data, _fkID: projectId }
            };
            return await dataService.request(params);
        });
    } else {
        const response = await dataService.post(`/projects/${projectId}/notes`, data);
        return response.data || response;
    }
}

/**
 * Update project note (environment-aware)
 * PATCH /projects/notes/{note_id}
 * @param {string} noteId - The note ID
 * @param {Object} data - Note data to update
 * @returns {Promise<Object>} Updated note record
 */
export async function updateProjectNote(noteId, data) {
    validateParams({ noteId, data }, ['noteId', 'data']);
    const env = getEnvironmentContext();
    checkOrganizationScope(env, 'updateProjectNote');

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.NOTES,
                action: Actions.UPDATE,
                recordId: noteId,
                fieldData: data
            };
            return await dataService.request(params);
        });
    } else {
        const response = await dataService.patch(`/projects/notes/${noteId}`, data);
        return response.data || response;
    }
}

/**
 * Delete project note (environment-aware)
 * DELETE /projects/notes/{note_id}
 * @param {string} noteId - The note ID
 * @returns {Promise<Object>} Result of the delete operation
 */
export async function deleteProjectNote(noteId) {
    validateParams({ noteId }, ['noteId']);
    const env = getEnvironmentContext();
    checkOrganizationScope(env, 'deleteProjectNote');

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
        const response = await dataService.delete(`/projects/notes/${noteId}`);
        return response.data || response;
    }
}

/**
 * Legacy method: Fetches project-related data (FileMaker compatibility)
 * @param {string} projectId - The project ID
 * @param {string} layout - The layout to fetch from
 * @returns {Promise<Array>} Array of related records
 */
export async function fetchProjectRelatedData(projectId, layout) {
    validateParams({ projectId, layout }, ['projectId', 'layout']);

    return handleFileMakerOperation(async () => {
        const fieldName = layout === Layouts.PROJECT_IMAGES ||
                         layout === Layouts.PROJECT_LINKS ||
                         layout === Layouts.NOTES
            ? "_fkID"
            : layout === Layouts.RECORDS
                ? "_projectID"
                : "_projectID";

        const queryArray = Array.isArray(projectId)
            ? projectId.map(id => ({ [fieldName]: id }))
            : [{ [fieldName]: projectId }];

        const params = {
            layout,
            action: Actions.READ,
            query: queryArray
        };

        return await dataService.request(params);
    });
}

/**
 * Create a new objective step (environment-aware)
 * POST /steps
 * @param {Object} data - The step data (must include objective_id)
 * @returns {Promise<Object>} Created step record
 */
export async function createStep(data) {
    validateParams({ data }, ['data']);
    const env = getEnvironmentContext();
    checkOrganizationScope(env, 'createStep');

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.PROJECT_OBJ_STEPS,
                action: Actions.CREATE,
                fieldData: data
            };
            return await dataService.request(params);
        });
    } else {
        const response = await dataService.post('/steps', data);
        return response.data || response;
    }
}

/**
 * Update an objective step (environment-aware)
 * PATCH /steps/{step_id}
 * @param {string} stepId - The step ID
 * @param {Object} data - The data to update
 * @returns {Promise<Object>} Updated step record
 */
export async function updateStep(stepId, data) {
    validateParams({ stepId, data }, ['stepId', 'data']);
    const env = getEnvironmentContext();
    checkOrganizationScope(env, 'updateStep');

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.PROJECT_OBJ_STEPS,
                action: Actions.UPDATE,
                recordId: stepId,
                fieldData: data
            };
            return await dataService.request(params);
        });
    } else {
        const response = await dataService.patch(`/steps/${stepId}`, data);
        return response.data || response;
    }
}

/**
 * Delete an objective step (environment-aware)
 * DELETE /steps/{step_id}
 * @param {string} stepId - The step ID
 * @returns {Promise<Object>} Result of the delete operation
 */
export async function deleteStep(stepId) {
    validateParams({ stepId }, ['stepId']);
    const env = getEnvironmentContext();
    checkOrganizationScope(env, 'deleteStep');

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.PROJECT_OBJ_STEPS,
                action: Actions.DELETE,
                recordId: stepId
            };
            return await dataService.request(params);
        });
    } else {
        const response = await dataService.delete(`/steps/${stepId}`);
        return response.data || response;
    }
}

/**
 * Toggle step completion status (environment-aware)
 * PATCH /steps/{step_id}/completed
 * @param {string} stepId - The step ID
 * @returns {Promise<Object>} Updated step record
 */
export async function toggleStepCompleted(stepId) {
    validateParams({ stepId }, ['stepId']);
    const env = getEnvironmentContext();
    checkOrganizationScope(env, 'toggleStepCompleted');

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            // FileMaker would need to fetch current state and toggle
            throw new Error('Use updateStep with completed field for FileMaker');
        });
    } else {
        const response = await dataService.patch(`/steps/${stepId}/completed`);
        return response.data || response;
    }
}

/**
 * Reorder objective steps (environment-aware)
 * POST /steps/objectives/{objective_id}/reorder
 * @param {string} objectiveId - The objective ID
 * @param {Array<string>} stepIds - Ordered array of step IDs
 * @returns {Promise<Array>} Updated array of steps
 */
export async function reorderSteps(objectiveId, stepIds) {
    validateParams({ objectiveId, stepIds }, ['objectiveId', 'stepIds']);
    const env = getEnvironmentContext();
    checkOrganizationScope(env, 'reorderSteps');

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        // FileMaker doesn't support reordering - would need manual update loop
        throw new Error('Step reordering not supported in FileMaker environment');
    } else {
        const response = await dataService.post(
            `/steps/objectives/${objectiveId}/reorder`,
            stepIds
        );
        return response.data || response;
    }
}

/**
 * Legacy method: Fetches all related data for a project (FileMaker compatibility)
 * Use fetchProjectWithDetails() for new code
 * @param {string} projectId - The project ID
 * @returns {Promise<Object>} Object containing all related data
 */
export async function fetchAllProjectData(projectId) {
    validateParams({ projectId }, ['projectId']);

    return handleFileMakerOperation(async () => {
        const [images, links, objectives, steps, records] = await Promise.all([
            fetchProjectRelatedData([projectId], Layouts.PROJECT_IMAGES),
            fetchProjectRelatedData([projectId], Layouts.PROJECT_LINKS),
            fetchProjectRelatedData([projectId], Layouts.PROJECT_OBJECTIVES),
            fetchProjectRelatedData([projectId], Layouts.PROJECT_OBJ_STEPS),
            fetchProjectRelatedData([projectId], Layouts.RECORDS)
        ]);
        return {
            images: images.response?.data || [],
            links: links.response?.data || [],
            objectives: objectives.response?.data || [],
            steps: steps.response?.data || [],
            records: records.response?.data || []
        };
    });
}
