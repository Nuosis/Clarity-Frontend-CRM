import { fetchDataFromFileMaker, handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';

/**
 * Fetches tasks for a project
 * @param {string} projectId - The project ID
 * @returns {Promise<Array>} Array of task records
 */
export async function fetchTasksForProject(projectId) {
    validateParams({ projectId }, ['projectId']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.TASKS,
            action: Actions.READ,
            query: [{ "_projectID": projectId }]
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Creates a new task
 * @param {Object} data - The task data
 * @returns {Promise<Object>} Created task record
 */
export async function createTask(data) {
    validateParams({ data }, ['data']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.TASKS,
            action: Actions.CREATE,
            fieldData: {
                ...data,
                f_completed: false
            }
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Updates a task
 * @param {string} taskId - The task ID
 * @param {Object} data - The data to update
 * @returns {Promise<Object>} Updated task record
 */
export async function updateTask(taskId, data) {
    validateParams({ taskId, data }, ['taskId', 'data']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.TASKS,
            action: Actions.UPDATE,
            recordId: taskId,
            fieldData: data
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Updates a task's completion status
 * @param {string} taskId - The task ID
 * @param {boolean} completed - The completion status
 * @returns {Promise<Object>} Updated task record
 */
export async function updateTaskStatus(taskId, completed) {
    validateParams({ taskId }, ['taskId']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.TASKS,
            action: Actions.UPDATE,
            recordId: taskId,
            fieldData: {
                f_completed: completed
            }
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Starts a timer for a task
 * @param {string} taskId - The task ID
 * @returns {Promise<Object>} Created timer record
 */
export async function startTaskTimer(taskId) {
    validateParams({ taskId }, ['taskId']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.RECORDS,
            action: Actions.CREATE,
            fieldData: {
                taskId,
                startTime: new Date().toISOString()
            }
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Stops a timer
 * @param {string} recordId - The timer record ID
 * @param {string} description - The work description
 * @param {boolean} saveImmediately - Whether to save without description
 * @returns {Promise<Object>} Updated timer record
 */
export async function stopTaskTimer(recordId, description = '', saveImmediately = false) {
    validateParams({ recordId }, ['recordId']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.RECORDS,
            action: Actions.UPDATE,
            recordId,
            fieldData: {
                endTime: new Date().toISOString(),
                description: saveImmediately ? 'Time logged' : description
            }
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Fetches timer records for a task
 * @param {string} taskId - The task ID
 * @returns {Promise<Array>} Array of timer records
 */
export async function fetchTaskTimers(taskId) {
    validateParams({ taskId }, ['taskId']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.RECORDS,
            action: Actions.READ,
            query: [{ "taskId": taskId }]
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Updates task notes
 * @param {string} taskId - The task ID
 * @param {string} notes - The notes content
 * @returns {Promise<Object>} Updated task record
 */
export async function updateTaskNotes(taskId, notes) {
    validateParams({ taskId, notes }, ['taskId', 'notes']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.TASKS,
            action: Actions.UPDATE,
            recordId: taskId,
            fieldData: {
                notes
            }
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Fetches active tasks for a project
 * @param {string} projectId - The project ID
 * @returns {Promise<Array>} Array of active task records
 */
export async function fetchActiveProjectTasks(projectId) {
    validateParams({ projectId }, ['projectId']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.TASKS,
            action: Actions.READ,
            query: [
                { 
                    "_projectID": projectId,
                    "f_completed": false
                }
            ]
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Fetches notes for a task
 * @param {string} taskId - The task ID
 * @returns {Promise<Array>} Array of task notes
 */
export async function fetchTaskNotes(taskId) {
    validateParams({ taskId }, ['taskId']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.NOTES,
            action: Actions.READ,
            query: [{ "_fkID": taskId }]
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Fetches links for a task
 * @param {string} taskId - The task ID
 * @returns {Promise<Array>} Array of task links
 */
export async function fetchTaskLinks(taskId) {
    validateParams({ taskId }, ['taskId']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.LINKS,
            action: Actions.READ,
            query: [{ "_fkID": taskId }]
        };
        
        return await fetchDataFromFileMaker(params);
    });
}