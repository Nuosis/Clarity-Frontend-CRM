import { fetchDataFromFileMaker, handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';

/**
 * Deletes a project
 * @param {string} recordId - The record ID of the project to delete
 * @returns {Promise<Object>} Result of the delete operation
 */
export async function deleteProject(recordId) {
    validateParams({ recordId }, ['recordId']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.PROJECTS,
            action: Actions.DELETE,
            recordId
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Fetches all projects for a customer
 * @param {string} customerId - The customer ID
 * @returns {Promise<Array>} Array of project records
 */
export async function fetchProjectsForCustomer(customerId) {
    validateParams({ customerId }, ['customerId']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.PROJECTS,
            action: Actions.READ,
            query: [{ "_custID": customerId }]
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Fetches project-related data (images, links, objectives)
 * @param {string} projectId - The project ID
 * @param {string} layout - The layout to fetch from
 * @returns {Promise<Array>} Array of related records
 */
export async function fetchProjectNotes(projectId) {
    validateParams({ projectId }, ['projectId']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.NOTES,
            action: Actions.READ,
            query: [{ "_fkID": projectId }]
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

export async function fetchProjectRelatedData(projectId, layout) {
    validateParams({ projectId, layout }, ['projectId', 'layout']);
    
    return handleFileMakerOperation(async () => {
        const fieldName = layout === Layouts.PROJECT_IMAGES || layout === Layouts.PROJECT_LINKS || layout === Layouts.NOTES
            ? "_fkID"
            : layout === Layouts.RECORDS
                ? "_projectID"
                : "_projectID";
            
        // Convert single projectId into array of query objects
        const queryArray = Array.isArray(projectId)
            ? projectId.map(id => ({ [fieldName]: id }))
            : [{ [fieldName]: projectId }];

        const params = {
            layout,
            action: Actions.READ,
            query: queryArray
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Updates a project's status
 * @param {string} projectId - The project ID
 * @param {string} status - The new status
 * @returns {Promise<Object>} Updated project record
 */
export async function updateProjectStatus(projectId, status) {
    validateParams({ projectId, status }, ['projectId', 'status']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.PROJECTS,
            action: Actions.UPDATE,
            recordId: projectId,
            fieldData: { status }
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Creates a new project
 * @param {Object} data - The project data
 * @returns {Promise<Object>} Created project record
 */
export async function createProject(data) {
    validateParams({ data }, ['data']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.PROJECTS,
            action: Actions.CREATE,
            fieldData: data
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Updates a project
 * @param {string} projectId - The project ID
 * @param {Object} data - The data to update
 * @returns {Promise<Object>} Updated project record
 */
export async function updateProject(projectId, data) {
    validateParams({ projectId, data }, ['projectId', 'data']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.PROJECTS,
            action: Actions.UPDATE,
            recordId: projectId,
            fieldData: data
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Fetches all related data for a project
 * @param {string} projectId - The project ID
 * @returns {Promise<Object>} Object containing all related data
 */
export async function fetchAllProjectData(projectId) {
    validateParams({ projectId }, ['projectId']);
    
    return handleFileMakerOperation(async () => {
        // Ensure projectId is treated as a single ID for each related data fetch
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

/**
 * Fetches projects for multiple customers
 * @param {Array<string>} customerIds - Array of customer IDs
 * @returns {Promise<Array>} Array of project records
 */
export async function fetchProjectsForCustomers(customerIds) {
    validateParams({ customerIds }, ['customerIds']);
    
    return handleFileMakerOperation(async () => {
        const query = customerIds.length > 0
            ? customerIds.map(id => ({ "_custID": id }))
            : [{ "__ID": "*" }];
        const params = {
            layout: Layouts.PROJECTS,
            action: Actions.READ,
            query
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Creates a new project objective
 * @param {Object} data - The objective data
 * @returns {Promise<Object>} Created objective record
 */
export async function createObjective(data) {
    validateParams({ data }, ['data']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.PROJECT_OBJECTIVES,
            action: Actions.CREATE,
            fieldData: data
        };
        
        return await fetchDataFromFileMaker(params);
    });
}