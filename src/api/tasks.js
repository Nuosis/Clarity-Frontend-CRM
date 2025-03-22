import { fetchDataFromFileMaker, handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';

/**
 * Fetches tasks for a project
 * @param {string} projectId - The project ID
 * @returns {Promise<Array>} Array of task records
 */
export async function fetchTasks(projectId, query) {
    validateParams({ projectId }, ['projectId','query']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.TASKS,
            action: Actions.READ,
            query
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

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
            fieldData: data
        };
        
        // Wait for the FileMaker operation to complete
        const result = await fetchDataFromFileMaker(params);
        
        // For CREATE operations, FileMaker returns recordId instead of data
        if (params.action === Actions.CREATE) {
            if (!result?.response?.recordId) {
                throw new Error('Invalid CREATE response from FileMaker');
            }
        } else if (!result?.response?.data) {
            throw new Error('Invalid response from FileMaker');
        }
        
        return result;
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
 * @param {string} taskId - The task recordId
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
export async function startTaskTimer(taskId, selectedTask) {
    validateParams({ taskId, selectedTask }, ['taskId', 'selectedTask']);
    
    return handleFileMakerOperation(async () => {
        // Get the project details to access the customer ID
        const projectParams = {
            layout: Layouts.PROJECTS,
            action: Actions.READ,
            query: [{ "__ID": selectedTask._projectID }]
        };
        
        // Try to get the project by ID first
        let projectResult = await fetchDataFromFileMaker(projectParams);
        let custID = null;
        
        // If no result, try using the recordId instead
        if (!projectResult?.response?.data || projectResult.response.data.length === 0) {
            const projectByRecordParams = {
                layout: Layouts.PROJECTS,
                action: Actions.READ,
                recordId: selectedTask._projectID
            };
            
            projectResult = await fetchDataFromFileMaker(projectByRecordParams);
            
            // If we found the project by recordId, use its _custID
            if (projectResult?.response?.data && projectResult.response.data.length > 0) {
                custID = projectResult.response.data[0].fieldData._custID;
            }
        } else {
            // If we found the project by ID, use its _custID
            custID = projectResult.response.data[0].fieldData._custID;
        }
        
        const params = {
            layout: Layouts.RECORDS,
            action: Actions.CREATE,
            fieldData: {
                _taskID: taskId,
                _staffID: selectedTask._staffID,
                _projectID: selectedTask._projectID,
                _custID: custID, // Add customer ID to the timer record
                TimeStart: new Date().toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                }),
                DateStart: new Date().toLocaleDateString('en-US', {
                    month: '2-digit',
                    day: '2-digit',
                    year: 'numeric'
                })
            }
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Stops a timer
 * @param {string} recordId - The timer record ID
 * @param {string} description - The work performed description
 * @param {boolean} saveImmediately - Whether to save without description
 * @param {number} TimeAdjust - Time adjustment in seconds
 * @returns {Promise<Object>} Updated timer record
 */
export async function stopTaskTimer(recordId, description = '', saveImmediately = false, TimeAdjust = 0) {
    validateParams({ recordId }, ['recordId']);
    
    return handleFileMakerOperation(async () => {
        const params = {
            layout: Layouts.RECORDS,
            action: Actions.UPDATE,
            recordId,
            fieldData: {
                TimeEnd: new Date().toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                }),
                ["Work Performed"]: saveImmediately ? 'Time logged' : description,
                TimeAdjust // Store total adjustment in seconds
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
            query: [{ "_taskID": taskId }]
        };
        
        return await fetchDataFromFileMaker(params);
    });
}

/**
 * Updates task notes
 * @param {string} taskId - The task recordId
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