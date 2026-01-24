import { dataService, getAuthenticationContext } from '../services/dataService';
import { withNoteErrorHandling } from '../errors';
import { validateUUID } from '../utils/validation';

/**
 * Normalize task data from backend responses
 * @param {Object|Array} data - Raw task data or response wrapper
 * @returns {Object|Array} Normalized task data
 */
function normalizeTaskData(data) {
    const payload = data && Object.prototype.hasOwnProperty.call(data, 'data') ? data.data : data;

    if (Array.isArray(payload)) {
        return payload.map(task => ({
            id: task.id || task.__ID,
            __ID: task.id || task.__ID,
            ...task
        }));
    }

    if (payload && typeof payload === 'object') {
        return {
            id: payload.id || payload.__ID,
            __ID: payload.id || payload.__ID,
            ...payload
        };
    }

    return payload;
}

/**
 * Normalize timer data from backend responses
 * @param {Object|Array} data - Raw timer data or response wrapper
 * @returns {Object|Array} Unwrapped timer data
 */
function normalizeTimerData(data) {
    return data && Object.prototype.hasOwnProperty.call(data, 'data') ? data.data : data;
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
export async function fetchTasksForProject(projectId) {
    if (!projectId) {
        throw new Error('Project ID is required');
    }

    validateUUID(projectId, 'Project ID');

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'fetchTasksForProject');

    try {
        console.log('[Tasks API] Fetching tasks for project:', projectId);
        const response = await dataService.get('/api/tasks', {
            params: { project_id: projectId }
        });
        console.log('[Tasks API] Tasks fetched successfully:', response);
        return normalizeTaskData(response);
    } catch (error) {
        handleApiError(error, 'Fetch tasks for project');
    }
}

/**
 * Creates a new task
 * @param {Object} data - The task data
 * @returns {Promise<Object>} Created task record
 */
export async function createTask(data) {
    if (!data) {
        throw new Error('Task data is required');
    }

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'createTask');

    try {
        console.log('[Tasks API] Creating task:', data);
        const response = await dataService.post('/api/tasks', data);
        console.log('[Tasks API] Task created successfully:', response);
        return normalizeTaskData(response);
    } catch (error) {
        handleApiError(error, 'Create task');
    }
}

/**
 * Updates a task
 * @param {string} taskId - The task ID
 * @param {Object} data - The data to update
 * @returns {Promise<Object>} Updated task record
 */
export async function updateTask(taskId, data) {
    if (!taskId || !data) {
        throw new Error('Task ID and data are required');
    }

    validateUUID(taskId, 'Task ID');

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'updateTask');

    try {
        console.log('[Tasks API] Updating task:', taskId, data);
        const response = await dataService.patch(`/api/tasks/${taskId}`, data);
        console.log('[Tasks API] Task updated successfully:', response);
        return normalizeTaskData(response);
    } catch (error) {
        handleApiError(error, 'Update task');
    }
}

/**
 * Updates a task's completion status
 * @param {string} taskId - The task recordId
 * @param {boolean} completed - The completion status
 * @returns {Promise<Object>} Updated task record
 */
export async function updateTaskStatus(taskId, completed) {
    if (!taskId) {
        throw new Error('Task ID is required');
    }

    validateUUID(taskId, 'Task ID');

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'updateTaskStatus');

    try {
        console.log('[Tasks API] Updating task status:', taskId, completed);
        const response = await dataService.post(`/api/tasks/${taskId}/toggle-completion`);
        console.log('[Tasks API] Task status updated successfully:', response);
        return normalizeTaskData(response);
    } catch (error) {
        handleApiError(error, 'Update task status');
    }
}

/**
 * Deletes a task
 * @param {string} taskId - The task ID
 * @returns {Promise<Object>} Deletion confirmation
 */
export async function deleteTask(taskId) {
    if (!taskId) {
        throw new Error('Task ID is required');
    }

    validateUUID(taskId, 'Task ID');

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'deleteTask');

    try {
        console.log('[Tasks API] Deleting task:', taskId);
        const response = await dataService.delete(`/api/tasks/${taskId}`);
        console.log('[Tasks API] Task deleted successfully:', response);
        return response;
    } catch (error) {
        handleApiError(error, 'Delete task');
    }
}

/**
 * Starts a timer for a task
 * @param {string} taskId - The task ID
 * @param {Object} selectedTask - The task object containing staff and project IDs
 * @returns {Promise<Object>} Created timer record
 */
export async function startTaskTimer(taskId, selectedTask) {
    if (!taskId || !selectedTask) {
        throw new Error('Task ID and selected task are required');
    }

    validateUUID(taskId, 'Task ID');

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'startTaskTimer');

    try {
        console.log('[Tasks API] Starting timer for task:', taskId);
        const response = await dataService.post('/time-entries/start', {
            task_id: taskId,
            staff_id: selectedTask._staffID || selectedTask.staff_id,
            is_billable: true
        });
        console.log('[Tasks API] Timer started successfully:', response);
        return normalizeTimerData(response);
    } catch (error) {
        handleApiError(error, 'Start timer');
    }
}

/**
 * Stops a timer
 * @param {string} entryId - The timer entry ID
 * @param {string} description - The work performed description
 * @param {boolean} saveImmediately - Whether to save without description
 * @param {number} adjustmentSeconds - Time adjustment in seconds
 * @returns {Promise<Object>} Updated timer record with financial record if created
 */
export async function stopTaskTimer(entryId, description = '', saveImmediately = false, adjustmentSeconds = 0) {
    if (!entryId) {
        throw new Error('Entry ID is required');
    }

    validateUUID(entryId, 'Entry ID');

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'stopTaskTimer');

    try {
        console.log('[Tasks API] Stopping timer:', entryId);

        const requestData = {
            description: saveImmediately ? 'Time logged' : description,
            adjustment_seconds: adjustmentSeconds
        };

        const response = await dataService.post(`/time-entries/${entryId}/stop`, requestData);

        console.log('[Tasks API] Timer stopped successfully:', response);

        // Backend handles financial record creation atomically
        // Response includes both time entry and financial record (if created)
        return normalizeTimerData(response);
    } catch (error) {
        handleApiError(error, 'Stop timer');
    }
}

/**
 * Pauses a running timer
 * @param {string} entryId - The timer entry ID
 * @returns {Promise<Object>} Updated timer record
 */
export async function pauseTimer(entryId) {
    if (!entryId) {
        throw new Error('Entry ID is required');
    }

    validateUUID(entryId, 'Entry ID');

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'pauseTimer');

    try {
        console.log('[Tasks API] Pausing timer:', entryId);
        const response = await dataService.post(`/time-entries/${entryId}/pause`);
        console.log('[Tasks API] Timer paused successfully:', response);
        return normalizeTimerData(response);
    } catch (error) {
        handleApiError(error, 'Pause timer');
    }
}

/**
 * Resumes a paused timer
 * @param {string} entryId - The timer entry ID
 * @returns {Promise<Object>} Updated timer record
 */
export async function resumeTimer(entryId) {
    if (!entryId) {
        throw new Error('Entry ID is required');
    }

    validateUUID(entryId, 'Entry ID');

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'resumeTimer');

    try {
        console.log('[Tasks API] Resuming timer:', entryId);
        const response = await dataService.post(`/time-entries/${entryId}/resume`);
        console.log('[Tasks API] Timer resumed successfully:', response);
        return normalizeTimerData(response);
    } catch (error) {
        handleApiError(error, 'Resume timer');
    }
}

/**
 * Gets the active timer for a staff member
 * @param {string} staffId - The staff member ID (optional, defaults to current user)
 * @returns {Promise<Object|null>} Active timer record or null
 */
export async function getActiveTimer(staffId = null) {
    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'getActiveTimer');

    try {
        console.log('[Tasks API] Getting active timer for staff:', staffId);

        const params = {};
        if (staffId) {
            params.staff_id = staffId;
        }

        const response = await dataService.get('/time-entries/active', { params });

        console.log('[Tasks API] Active timer fetched:', response);
        return normalizeTimerData(response);
    } catch (error) {
        // 404 is expected when no active timer exists
        if (error.response?.status === 404) {
            console.log('[Tasks API] No active timer found');
            return null;
        }
        handleApiError(error, 'Get active timer');
    }
}

/**
 * Fetches timer records for a task
 * @param {string} taskId - The task ID
 * @param {Object} filters - Optional filters (project_id, customer_id, staff_id, status, etc.)
 * @returns {Promise<Array>} Array of timer records
 */
export async function fetchTaskTimers(taskId, filters = {}) {
    if (!taskId) {
        throw new Error('Task ID is required');
    }

    validateUUID(taskId, 'Task ID');

    const auth = getAuthenticationContext();
    checkOrganizationScope({ authentication: auth }, 'fetchTaskTimers');

    try {
        console.log('[Tasks API] Fetching timers for task:', taskId);

        const response = await dataService.get('/time-entries', {
            params: {
                task_id: taskId,
                ...filters
            }
        });

        console.log('[Tasks API] Timers fetched successfully:', response);
        return normalizeTimerData(response);
    } catch (error) {
        handleApiError(error, 'Fetch task timers');
    }
}

/**
 * Fetches notes for a task
 * @param {string} taskId - The task ID
 * @param {Object} options - Query options (limit, offset)
 * @returns {Promise<Array>} Array of task notes
 */
export async function fetchTaskNotes(taskId, options = {}) {
    return withNoteErrorHandling(async () => {
        // Use the notes.js API client
        const { fetchNotesByTask } = await import('./notes');
        const result = await fetchNotesByTask(taskId, options);
        return result?.notes || result;
    }, 'fetchTaskNotes', { taskId, options });
}
