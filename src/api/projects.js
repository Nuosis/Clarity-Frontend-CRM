import { fetchDataFromFileMaker, handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';

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
export async function fetchProjectRelatedData(projectId, layout) {
    validateParams({ projectId, layout }, ['projectId', 'layout']);
    
    return handleFileMakerOperation(async () => {
        const fieldName = layout === Layouts.PROJECT_IMAGES || layout === Layouts.PROJECT_LINKS 
            ? "_fkID" 
            : "_projectID";
            
        const params = {
            layout,
            action: Actions.READ,
            query: [{ [fieldName]: projectId }]
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
        const [images, links, objectives, steps] = await Promise.all([
            fetchProjectRelatedData(projectId, Layouts.PROJECT_IMAGES),
            fetchProjectRelatedData(projectId, Layouts.PROJECT_LINKS),
            fetchProjectRelatedData(projectId, Layouts.PROJECT_OBJECTIVES),
            fetchProjectRelatedData(projectId, Layouts.PROJECT_OBJ_STEPS)
        ]);
        
        return {
            images: images.response?.data || [],
            links: links.response?.data || [],
            objectives: objectives.response?.data || [],
            steps: steps.response?.data || []
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
        const query = customerIds.map(id => ({ "_custID": id }));
        const params = {
            layout: Layouts.PROJECTS,
            action: Actions.READ,
            query
        };
        
        return await fetchDataFromFileMaker(params);
    });
}