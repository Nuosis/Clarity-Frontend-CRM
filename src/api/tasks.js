import { fetchDataFromFileMaker, handleFileMakerOperation, validateParams, Layouts, Actions } from './fileMaker';
import { dataService, getEnvironmentContext, ENVIRONMENT_TYPES } from '../services/dataService';

/**
 * Handle API errors with proper formatting
 * @param {Error} error - The error object
 * @param {string} operation - The operation that failed
 * @throws {Error} Formatted error
 */
function handleApiError(error, operation) {
    console.error(`[Tasks API] ${operation} failed:`, error);

    let errorMessage = `${operation} failed`;

    if (error.response?.data) {
        // Handle validation errors (array format)
        if (Array.isArray(error.response.data.detail)) {
            const validationErrors = error.response.data.detail.map(err =>
                `${err.loc?.join('.') || 'field'}: ${err.msg}`
            ).join(', ');
            errorMessage = `Validation error: ${validationErrors}`;
        }
        // Handle string detail
        else if (typeof error.response.data.detail === 'string') {
            errorMessage = error.response.data.detail;
        }
        // Handle other detail formats
        else if (error.response.data.detail) {
            errorMessage = JSON.stringify(error.response.data.detail);
        }
        // Handle message field
        else if (error.response.data.message) {
            errorMessage = error.response.data.message;
        }
        // Handle error field
        else if (error.response.data.error) {
            errorMessage = error.response.data.error;
        }
        // Handle string response
        else if (typeof error.response.data === 'string') {
            errorMessage = error.response.data;
        }
    } else if (error.message) {
        errorMessage = error.message;
    }

    throw new Error(errorMessage);
}

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
 * Fetches tasks for a project (environment-aware)
 * @param {string} projectId - The project ID
 * @returns {Promise<Array>} Array of task records
 */
export async function fetchTasksForProject(projectId) {
    validateParams({ projectId }, ['projectId']);
    const env = getEnvironmentContext();

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.TASKS,
                action: Actions.READ,
                query: [{ "_projectID": projectId }]
            };
            return await fetchDataFromFileMaker(params);
        });
    } else {
        try {
            console.log('[Tasks API] Fetching tasks for project:', projectId);
            const response = await dataService.get('/api/tasks', {
                params: { project_id: projectId }
            });
            console.log('[Tasks API] Tasks fetched successfully:', response.data);
            return response.data;
        } catch (error) {
            handleApiError(error, 'Fetch tasks for project');
        }
    }
}

/**
 * Creates a new task (environment-aware)
 * @param {Object} data - The task data
 * @returns {Promise<Object>} Created task record
 */
export async function createTask(data) {
    validateParams({ data }, ['data']);
    const env = getEnvironmentContext();

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.TASKS,
                action: Actions.CREATE,
                fieldData: data
            };

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
    } else {
        try {
            console.log('[Tasks API] Creating task:', data);
            const response = await dataService.post('/api/tasks', data);
            console.log('[Tasks API] Task created successfully:', response.data);
            return response.data;
        } catch (error) {
            handleApiError(error, 'Create task');
        }
    }
}

/**
 * Updates a task (environment-aware)
 * @param {string} taskId - The task ID
 * @param {Object} data - The data to update
 * @returns {Promise<Object>} Updated task record
 */
export async function updateTask(taskId, data) {
    validateParams({ taskId, data }, ['taskId', 'data']);
    const env = getEnvironmentContext();

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.TASKS,
                action: Actions.UPDATE,
                recordId: taskId,
                fieldData: data
            };
            return await fetchDataFromFileMaker(params);
        });
    } else {
        try {
            console.log('[Tasks API] Updating task:', taskId, data);
            const response = await dataService.patch(`/api/tasks/${taskId}`, data);
            console.log('[Tasks API] Task updated successfully:', response.data);
            return response.data;
        } catch (error) {
            handleApiError(error, 'Update task');
        }
    }
}

/**
 * Updates a task's completion status (environment-aware)
 * @param {string} taskId - The task recordId
 * @param {boolean} completed - The completion status
 * @returns {Promise<Object>} Updated task record
 */
export async function updateTaskStatus(taskId, completed) {
    validateParams({ taskId }, ['taskId']);
    const env = getEnvironmentContext();

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.TASKS,
                action: Actions.UPDATE,
                recordId: taskId,
                fieldData: {
                    f_completed: completed ? 1 : 0
                }
            };
            return await fetchDataFromFileMaker(params);
        });
    } else {
        try {
            console.log('[Tasks API] Updating task status:', taskId, completed);
            const response = await dataService.post(`/api/tasks/${taskId}/toggle-completion`);
            console.log('[Tasks API] Task status updated successfully:', response.data);
            return response.data;
        } catch (error) {
            handleApiError(error, 'Update task status');
        }
    }
}

/**
 * Deletes a task (environment-aware)
 * @param {string} taskId - The task ID
 * @returns {Promise<Object>} Deletion confirmation
 */
export async function deleteTask(taskId) {
    validateParams({ taskId }, ['taskId']);
    const env = getEnvironmentContext();

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.TASKS,
                action: Actions.DELETE,
                recordId: taskId
            };
            return await fetchDataFromFileMaker(params);
        });
    } else {
        try {
            console.log('[Tasks API] Deleting task:', taskId);
            const response = await dataService.delete(`/api/tasks/${taskId}`);
            console.log('[Tasks API] Task deleted successfully:', response.data);
            return response.data;
        } catch (error) {
            handleApiError(error, 'Delete task');
        }
    }
}

/**
 * Starts a timer for a task (environment-aware)
 * @param {string} taskId - The task ID
 * @param {Object} selectedTask - The task object containing staff and project IDs
 * @returns {Promise<Object>} Created timer record
 */
export async function startTaskTimer(taskId, selectedTask) {
    validateParams({ taskId, selectedTask }, ['taskId', 'selectedTask']);
    const env = getEnvironmentContext();

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
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
    } else {
        try {
            console.log('[Tasks API] Starting timer for task:', taskId);
            const response = await dataService.post('/time-entries/start', {
                task_id: taskId,
                staff_id: selectedTask._staffID || selectedTask.staff_id,
                is_billable: true
            });
            console.log('[Tasks API] Timer started successfully:', response.data);
            return response.data;
        } catch (error) {
            handleApiError(error, 'Start timer');
        }
    }
}

/**
 * Stops a timer (environment-aware)
 * @param {string} entryId - The timer entry ID (UUID for backend, recordId for FileMaker)
 * @param {string} description - The work performed description
 * @param {boolean} saveImmediately - Whether to save without description
 * @param {number} adjustmentSeconds - Time adjustment in seconds
 * @returns {Promise<Object>} Updated timer record with financial record if created
 */
export async function stopTaskTimer(entryId, description = '', saveImmediately = false, adjustmentSeconds = 0) {
    validateParams({ entryId }, ['entryId']);
    const env = getEnvironmentContext();

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.RECORDS,
                action: Actions.UPDATE,
                recordId: entryId,
                fieldData: {
                    TimeEnd: new Date().toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                    }),
                    ["Work Performed"]: saveImmediately ? 'Time logged' : description,
                    TimeAdjust: adjustmentSeconds // Store total adjustment in seconds
                }
            };

            const data = await fetchDataFromFileMaker(params);
            return data;
        });
    } else {
        try {
            console.log('[Tasks API] Stopping timer:', entryId);

            const requestData = {
                description: saveImmediately ? 'Time logged' : description,
                adjustment_seconds: adjustmentSeconds
            };

            const response = await dataService.post(`/time-entries/${entryId}/stop`, requestData);

            console.log('[Tasks API] Timer stopped successfully:', response.data);

            // Backend handles financial record creation atomically
            // Response includes both time entry and financial record (if created)
            return response.data;
        } catch (error) {
            handleApiError(error, 'Stop timer');
        }
    }
}

/**
 * Pauses a running timer (environment-aware)
 * @param {string} entryId - The timer entry ID
 * @returns {Promise<Object>} Updated timer record
 */
export async function pauseTimer(entryId) {
    validateParams({ entryId }, ['entryId']);
    const env = getEnvironmentContext();

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        // FileMaker doesn't support pause/resume - throw error
        throw new Error('Pause timer is not supported in FileMaker mode');
    } else {
        try {
            console.log('[Tasks API] Pausing timer:', entryId);
            const response = await dataService.post(`/time-entries/${entryId}/pause`);
            console.log('[Tasks API] Timer paused successfully:', response.data);
            return response.data;
        } catch (error) {
            handleApiError(error, 'Pause timer');
        }
    }
}

/**
 * Resumes a paused timer (environment-aware)
 * @param {string} entryId - The timer entry ID
 * @returns {Promise<Object>} Updated timer record
 */
export async function resumeTimer(entryId) {
    validateParams({ entryId }, ['entryId']);
    const env = getEnvironmentContext();

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        // FileMaker doesn't support pause/resume - throw error
        throw new Error('Resume timer is not supported in FileMaker mode');
    } else {
        try {
            console.log('[Tasks API] Resuming timer:', entryId);
            const response = await dataService.post(`/time-entries/${entryId}/resume`);
            console.log('[Tasks API] Timer resumed successfully:', response.data);
            return response.data;
        } catch (error) {
            handleApiError(error, 'Resume timer');
        }
    }
}

/**
 * Gets the active timer for a staff member (environment-aware)
 * @param {string} staffId - The staff member ID (optional, defaults to current user)
 * @returns {Promise<Object|null>} Active timer record or null
 */
export async function getActiveTimer(staffId = null) {
    const env = getEnvironmentContext();

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        // FileMaker fallback - query for active timers
        return handleFileMakerOperation(async () => {
            const query = [{ "TimeEnd": "" }]; // Empty TimeEnd means active
            if (staffId) {
                query[0]._staffID = staffId;
            }

            const params = {
                layout: Layouts.RECORDS,
                action: Actions.READ,
                query
            };

            const result = await fetchDataFromFileMaker(params);

            // Return first active timer or null
            if (result?.response?.data && result.response.data.length > 0) {
                return result.response.data[0];
            }
            return null;
        });
    } else {
        try {
            console.log('[Tasks API] Getting active timer for staff:', staffId);

            const params = {};
            if (staffId) {
                params.staff_id = staffId;
            }

            const response = await dataService.get('/time-entries/active', { params });

            console.log('[Tasks API] Active timer fetched:', response.data);
            return response.data;
        } catch (error) {
            // 404 is expected when no active timer exists
            if (error.response?.status === 404) {
                console.log('[Tasks API] No active timer found');
                return null;
            }
            handleApiError(error, 'Get active timer');
        }
    }
}

/**
 * Fetches timer records for a task (environment-aware)
 * @param {string} taskId - The task ID
 * @param {Object} filters - Optional filters (project_id, customer_id, staff_id, status, etc.)
 * @returns {Promise<Array>} Array of timer records
 */
export async function fetchTaskTimers(taskId, filters = {}) {
    validateParams({ taskId }, ['taskId']);
    const env = getEnvironmentContext();

    if (env.type === ENVIRONMENT_TYPES.FILEMAKER) {
        return handleFileMakerOperation(async () => {
            const params = {
                layout: Layouts.RECORDS,
                action: Actions.READ,
                query: [{ "_taskID": taskId }]
            };
            return await fetchDataFromFileMaker(params);
        });
    } else {
        try {
            console.log('[Tasks API] Fetching timers for task:', taskId);

            const response = await dataService.get('/time-entries', {
                params: {
                    task_id: taskId,
                    ...filters
                }
            });

            console.log('[Tasks API] Timers fetched successfully:', response.data);
            return response.data;
        } catch (error) {
            handleApiError(error, 'Fetch task timers');
        }
    }
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
 * Environment-aware: Uses backend API in webapp, FileMaker in legacy environment
 * @param {string} taskId - The task ID
 * @param {Object} options - Query options (limit, offset)
 * @returns {Promise<Array>} Array of task notes
 */
export async function fetchTaskNotes(taskId, options = {}) {
    validateParams({ taskId }, ['taskId']);

    // Use the notes.js API client which is environment-aware
    const { fetchNotesByTask } = await import('./notes');
    return await fetchNotesByTask(taskId, options);
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