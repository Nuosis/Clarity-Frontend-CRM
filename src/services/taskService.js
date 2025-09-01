import {
    fetchTasksForProject,
    fetchTaskTimers,
    fetchTaskNotes,
    fetchTaskLinks,
    createTask as createTaskAPI,
    updateTask as updateTaskAPI,
    updateTaskStatus as updateTaskStatusAPI,
    startTaskTimer as startTaskTimerAPI,
    stopTaskTimer as stopTaskTimerAPI
} from '../api/tasks';
import { fetchFinancialRecordByRecordId } from '../api/financialRecords';
import { createSaleFromFinancialRecord } from './salesService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Loads tasks for a project with processing and sorting
 * @param {string} projectId - Project ID
 * @returns {Promise<Array>} Processed and sorted tasks
 */
export async function loadProjectTasks(projectId) {
    const data = await fetchTasksForProject(projectId);
    //console.log('Raw data from FileMaker:', data);
    const processedTasks = processTaskData(data);
    //console.log('Processed tasks:', processedTasks);
    const sortedTasks = sortTasks(processedTasks);
    //console.log('Sorted tasks:', sortedTasks);
    return sortedTasks;
}

/**
 * Loads all details for a task
 * @param {string} taskId - Task ID
 * @returns {Promise<Object>} Task details including timers, notes, and links
 */
export async function loadTaskDetails(taskId) {
    const [timerResult, notesResult, linksResult] = await Promise.all([
        fetchTaskTimers(taskId),
        fetchTaskNotes(taskId),
        fetchTaskLinks(taskId)
    ]);

    return {
        timers: processTimerRecords(timerResult),
        notes: processTaskNotes(notesResult),
        links: processTaskLinks(linksResult)
    };
}

/**
 * Starts a timer with validation
 * @param {Object} task - Task to start timer for
 * @returns {Promise<Object>} Created timer record
 */
export async function startTimer(task) {
    if (!task?.id) {
        throw new Error('Invalid task for timer');
    }
    return await startTaskTimerAPI(task.id, task);
}

/**
 * Stops a timer with validation and adjustments
 * @param {Object} params - Timer stop parameters
 * @returns {Promise<Object>} Updated timer record
 */
export async function stopTimer(params, organizationId = null) {
    if (!params?.recordId) {
        throw new Error('Invalid timer record');
    }
    
    // Stop the timer in FileMaker
    const result = await stopTaskTimerAPI(
        params.recordId,
        params.description,
        params.saveImmediately,
        params.totalPauseTime + params.adjustment
    );
            
    // console.log('Timer stop result:', result, params);
    
    // If the timer was successfully stopped, create a sales record in Supabase
    if (result && result.response) {
        try {
            // Get the organization ID from the parameter or from the global state
            const orgId = organizationId || (window.state?.user?.supabaseOrgID);
            
            if (!orgId) {
                console.warn('No organization ID found, skipping sales record creation');
                return result;
            }

            // Declare financialId variable
            let financialId;

            try {
                console.log(`Fetching financial record by recordId: ${params.recordId}`);
                const financialRecord = await fetchFinancialRecordByRecordId(params.recordId);
                
                if (financialRecord && financialRecord.response && financialRecord.response.data && financialRecord.response.data.length > 0) {
                    financialId = financialRecord.response.data[0].fieldData.__ID;
                    console.log(`Found financial ID from record lookup: ${financialId}`);
                    
                    // Check if this is a fixed-price project
                    const fixedPrice = parseFloat(financialRecord.response.data[0].fieldData["customers_Projects::f_fixedPrice"] || 0);
                    console.log(`Project fixed price value: ${fixedPrice}`);
                    
                    if (fixedPrice > 0) {
                        console.log('Skipping sales record creation for fixed-price project');
                        financialId = null; // Prevent sales record creation
                    }
                }
            } catch (fetchError) {
                console.error('Error fetching financial record by recordId:', fetchError);
            }
            
            if (financialId) {
                // Create a sales record in Supabase
                console.log(`Creating sales record for financial record ${financialId} with organization ID ${orgId}`);
                await createSaleFromFinancialRecord(financialId, orgId);
            } else {
                console.warn('Could not find financial record ID in timer stop result or by recordId lookup, or project is fixed-price');
            }
        } catch (error) {
            console.error('Error creating sales record:', error);
            // Don't throw the error, as we still want to return the timer stop result
        }
    }
    
    return result;
}

/**
 * Task data processing and business logic
 */

/**
 * Processes raw task data from FileMaker
 * @param {Object} data - Raw task data
 * @returns {Array} Processed task records
 */
export function processTaskData(data) {
    //console.log('Processing task data:', data);
    
    if (!data?.response?.data) {
        console.log('No data to process, returning empty array');
        return [];
    }

    const processed = data.response.data.map(task => {
        // console.log('Processing individual task:', task);
        return {
            id: task.fieldData.__ID,
            recordId: task.recordId,
            task: task.fieldData.task,
            type: task.fieldData.type,
            isCompleted: task.fieldData.f_completed === "1" || task.fieldData.f_completed === 1,
            createdAt: task.fieldData['~creationTimestamp'],
            modifiedAt: task.fieldData['~modificationTimestamp'],
            _projectID: task.fieldData._projectID,
            _staffID: task.fieldData._staffID
        };
    });
    
    //console.log('Processed tasks result:', processed);
    return processed;
}

/**
 * Processes timer records for a task
 * @param {Array} timerRecords - Raw timer records
 * @returns {Array} Processed timer records with duration calculations
 */
export function processTimerRecords(timerRecords) {
    if (!timerRecords?.response?.data) {
        return [];
    }

    console.log('Timer Records from FileMaker:', timerRecords?.response?.data);
    return timerRecords.response.data.map(record => {
        // Convert time strings (e.g. "1:30:00 PM") to Date objects
        // console.log(record)
        const startTimeStr = record.fieldData.startTime;
        const endTimeStr = record.fieldData.endTime;
        
        // Create a Date object for today with the specified time
        const today = new Date();
        const startTime = startTimeStr ? new Date(today.toDateString() + ' ' + startTimeStr) : null;
        const endTime = endTimeStr ? new Date(today.toDateString() + ' ' + endTimeStr) : null;
        
        return {
            id: record.fieldData.__ID,
            recordId: record.recordId,
            startTime,
            endTime,
            description: record.fieldData["Work Performed"] || '',
            duration: record.fieldData.Billable_Time_Rounded
        };
    });
}

/**
 * Processes notes for a task
 * @param {Object} data - Raw notes data
 * @returns {Array} Processed notes
 */
export function processTaskNotes(data) {
    if (!data?.response?.data) {
        return [];
    }

    return data.response.data
        .map(note => ({
            id: note.fieldData.__ID,
            recordId: note.recordId,
            content: note.fieldData.note,
            type: note.fieldData.type || 'general',
            createdAt: note.fieldData['~CreationTimestamp'],
            modifiedAt: note.fieldData['~ModificationTimestamp'],
            createdBy: note.fieldData['~CreatedBy']
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Sort by creation date, newest first
}

/**
 * Processes links for a task
 * @param {Object} data - Raw links data
 * @returns {Array} Processed links
 */
export function processTaskLinks(data) {
    if (!data?.response?.data) {
        return [];
    }

    return data.response.data.map(link => ({
        id: link.fieldData.__ID,
        recordId: link.recordId,
        url: link.fieldData.link,
        createdAt: link.fieldData['~creationTimestamp'],
        modifiedAt: link.fieldData['~modificationTimestamp']
    }));
}

/**
 * Formats duration for display
 * @param {number} minutes - Duration in minutes
 * @returns {string} Formatted duration string
 */
export function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours === 0) {
        return `${remainingMinutes}m`;
    }
    
    return remainingMinutes === 0 
        ? `${hours}h` 
        : `${hours}h ${remainingMinutes}m`;
}

/**
 * Task field definitions with validation rules
 */
export const TASK_FIELDS = {
    // Required fields
    task: {
        required: true,
        type: 'string',
        minLength: 1,
        maxLength: 200,
        validate: (value) => {
            if (!value?.trim()) return 'Task name is required';
            if (value.length > 200) return 'Task name must be less than 200 characters';
            return null;
        }
    },
    _projectID: {
        required: true,
        type: 'string',
        validate: (value) => !value ? 'Project ID is required' : null
    },
    _staffID: {
        required: true,
        type: 'string',
        validate: (value) => !value ? 'Staff ID is required' : null
    },
    
    f_completed: {
        required: false,
        type: 'number',
        validate: (value) => {
            if (value === undefined || value === null) return null;
            return value === 0 || value === 1 ? null : 'Completion status must be 0 or 1';
        }
    },
    f_priority: {
        required: false,
        type: 'string',
        validate: (value) => {
            if (!value) return null;
            return ['active', 'high', 'low'].includes(value) ? null : 'Invalid priority value';
        }
    }
};

/**
 * Validates task data before creation/update
 * @param {Object} data - Task data to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.isUpdate - Whether this is an update operation
 * @param {boolean} options.partial - Whether to allow partial data (only validate provided fields)
 * @returns {Object} Validation result { isValid, errors, fieldErrors }
 */
export function validateTaskData(data, { isUpdate = false, partial = false } = {}) {
    const errors = [];
    const fieldErrors = {};

    // Check if data is provided
    if (!data || typeof data !== 'object') {
        return {
            isValid: false,
            errors: ['Invalid task data provided'],
            fieldErrors: {}
        };
    }

    // Validate each field according to rules
    Object.entries(TASK_FIELDS).forEach(([field, rules]) => {
        // Skip validation for fields not provided in partial validation
        if (partial && !(field in data)) return;

        // Skip _projectID validation for updates
        if (isUpdate && field === '_projectID') return;

        const value = data[field];

        // Required field validation
        if (rules.required && !isUpdate && !partial) {
            if (value === undefined || value === null || value === '') {
                fieldErrors[field] = `${field} is required`;
                return;
            }
        }

        // Skip validation if value is not provided and field is optional
        if (!rules.required && (value === undefined || value === null)) return;

        // Type checking
        if (value !== undefined && value !== null) {
            if (typeof value !== rules.type) {
                fieldErrors[field] = `${field} must be a ${rules.type}`;
                return;
            }

            // Custom field validation
            if (rules.validate) {
                const validationError = rules.validate(value);
                if (validationError) {
                    fieldErrors[field] = validationError;
                }
            }
        }
    });

    // Add field errors to main errors array
    Object.values(fieldErrors).forEach(error => {
        errors.push(error);
    });

    return {
        isValid: errors.length === 0,
        errors,
        fieldErrors
    };
}

/**
 * Formats task data for display
 * @param {Object} task - Task record
 * @param {Array} timerRecords - Associated timer records
 * @param {Array} notes - Associated notes
 * @param {Array} links - Associated links
 * @returns {Object} Formatted task data
 */
export function formatTaskForDisplay(task, timerRecords = [], notes = [], links = []) {
    const totalTime = calculateTotalTaskTime(timerRecords);
    
    return {
        id: task.id,
        recordId: task.recordId,
        description: task.task,
        type: task.type || 'General',
        status: task.isCompleted ? 'Completed' : 'Active',
        totalTime: formatDuration(totalTime),
        created: new Date(task.createdAt).toLocaleDateString(),
        modified: new Date(task.modifiedAt).toLocaleDateString(),
        notes: notes || [],
        links: links || [],
        timerCount: timerRecords.length
    };
}

/**
 * Creates a new task with proper validation and formatting
 * @param {Object} params - Task creation parameters
 * @param {string} params.projectId - Project ID
 * @param {string} params.staffId - Staff ID
 * @param {string} params.taskName - Task name
 * @param {string} [params.type] - Task type (optional)
 * @param {string} [params.priority="active"] - Task priority
 * @returns {Promise<Object>} Created task data
 */
export async function createNewTask(params) {
    // if (!params || typeof params !== 'object') {
    //     throw new Error('Invalid task parameters');
    // }

    // Check for both old and new field name formats
    const projectId = params._projectID || params.projectId;
    const staffId = params._staffID || params.staffId;
    const { taskName, type, priority = "active" } = params;

    if (!projectId || !staffId || !taskName) {
        throw new Error('Project ID, Staff ID, and Task Name are required');
    }
    // Prepare task data with UUID
    const taskData = {
        __ID: uuidv4(), // Generate a UUID for the task
        _projectID: projectId,
        _staffID: staffId,
        task: taskName.trim(),
        f_completed: 0,
        f_priority: priority
    };

    // Validate task data
    const validation = validateTaskData(taskData, { partial: false });
    if (!validation.isValid) {
        throw new Error(validation.errors[0]); // Throw first error
    }

    try {
        // Create task through API and wait for completion
        const result = await createTaskAPI(taskData);
        
        // For CREATE operations, we get recordId instead of data
        if (!result?.response?.recordId) {
            throw new Error('Failed to create task: No record ID returned');
        }
        
        // Return a properly formatted response with the UUID
        return {
            response: {
                data: [{
                    recordId: result.response.recordId,
                    modId: result.response.modId,
                    fieldData: taskData // This includes the UUID in __ID field
                }]
            },
            messages: result.messages
        };
    } catch (error) {
        console.error('Error in createNewTask:', error);
        throw error;
    }
}

/**
 * Task operations with business logic
 */

/**
 * Updates a task with validation and state management
 * @param {string} taskId - Task ID to update
 * @param {Object} taskData - New task data
 * @returns {Promise<Object>} Updated task data
 */
export async function updateExistingTask(taskId, taskData) {
    // Validate task data
    const validation = validateTaskData(taskData, {
        isUpdate: true,
        partial: true
    });
    if (!validation.isValid) {
        throw new Error(validation.errors[0]);
    }

    // Update task through API
    return await updateTaskAPI(taskId, formatTaskForFileMaker(taskData));
}

/**
 * Updates a task's completion status
 * @param {string} taskId - Task ID to update
 * @param {boolean} completed - New completion status
 * @returns {Promise<Object>} Updated task data
 */
export async function updateTaskCompletionStatus(taskId, completed) {
    return await updateTaskStatusAPI(taskId, completed);
}

/**
 * Timer operations with business logic
 */

/**
 * Starts a timer for a task
 * @param {Object} task - Task to start timer for
 * @returns {Promise<Object>} Created timer record
 */
export async function startNewTaskTimer(task) {
    if (!task) {
        throw new Error('No task selected');
    }
    
    return await startTaskTimerAPI(task.id, task);
}

/**
 * Stops a timer with adjustments
 * @param {Object} params - Timer stop parameters
 * @param {string} params.recordId - Timer record ID
 * @param {string} [params.description=''] - Work description
 * @param {boolean} [params.saveImmediately=false] - Whether to save without description
 * @param {number} [params.totalPauseTime=0] - Total pause time in seconds
 * @param {number} [params.adjustment=0] - Manual adjustment in seconds
 * @returns {Promise<Object>} Updated timer record
 */
export async function stopExistingTaskTimer({
    recordId,
    description = '',
    saveImmediately = false,
    totalPauseTime = 0,
    adjustment = 0
}) {
    if (!recordId) {
        throw new Error('No active timer');
    }

    const finalAdjustment = Math.round(totalPauseTime + adjustment);
    return await stopTaskTimerAPI(recordId, description, saveImmediately, finalAdjustment);
}

/**
 * Formats task data for FileMaker
 * @param {Object} data - Task data to format
 * @returns {Object} Formatted data for FileMaker
 */
export function formatTaskForFileMaker(data) {
    // Pass through the data as-is since it's already in FileMaker format
    return data;
}

// Helper functions

/**
 * Groups tasks by completion status
 * @param {Array} tasks - Array of task records
 * @returns {Object} Grouped tasks { active, completed }
 */
export function groupTasksByStatus(tasks) {
    //console.log('Grouping tasks:', tasks);
    const groups = {
        active: [],
        completed: []
    };
    
    if (!tasks?.length) {
        //console.log('No tasks to group, returning empty groups');
        return groups;
    }

    tasks.forEach(task => {
        //console.log('Processing task:', task);
        const key = task.isCompleted ? 'completed' : 'active';
        groups[key].push(task);
    });
    
    return groups;
}

/**
 * Calculates task statistics
 * @param {Array} tasks - Array of task records
 * @param {Array} timerRecords - Array of timer records
 * @returns {Object} Task statistics
 */
export function calculateTaskStats(tasks, timerRecords) {
    if (!tasks?.length) {
        return {
            total: 0,
            active: 0,
            completed: 0,
            completionRate: 0,
            totalTimeSpent: '0m',
            averageTimePerTask: '0m'
        };
    }

    const grouped = groupTasksByStatus(tasks);
    const totalTime = calculateTotalTaskTime(timerRecords);
    
    return {
        total: tasks.length,
        active: grouped.active.length,
        completed: grouped.completed.length,
        completionRate: Math.round((grouped.completed.length / tasks.length) * 100) || 0,
        totalTimeSpent: formatDuration(totalTime),
        averageTimePerTask: formatDuration(Math.round(totalTime / tasks.length)) || '0m'
    };
}

/**
 * Validates timer adjustment
 * @param {number} minutes - Minutes to adjust
 * @returns {boolean} Whether the adjustment is valid
 */
export function isValidTimerAdjustment(minutes) {
    // Only allow adjustments in 6-minute increments
    return minutes % 6 === 0;
}

/**
 * Calculates total time from timer records
 * @param {Array} timerRecords - Array of timer records
 * @returns {number} Total time in minutes
 */
export function calculateTotalTaskTime(timerRecords) {
    if (!timerRecords?.length) {
        return 0;
    }
    
    return timerRecords.reduce((total, record) => {
        // Convert hours to minutes since duration comes from FileMaker in hours
        return total + ((record.duration || 0) * 60);
    }, 0);
}

/**
 * Sorts tasks by priority and status
 * @param {Array} tasks - Array of task records
 * @returns {Array} Sorted task records
 */
export function sortTasks(tasks) {
    if (!tasks?.length) {
        return [];
    }
    
    return [...tasks].sort((a, b) => {
        // Active tasks first
        if (a.isCompleted !== b.isCompleted) {
            return a.isCompleted ? 1 : -1;
        }
        // Then by creation date (newest first)
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
}