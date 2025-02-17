/**
 * Task data processing and business logic
 */

/**
 * Processes raw task data from FileMaker
 * @param {Object} data - Raw task data
 * @returns {Array} Processed task records
 */
export function processTaskData(data) {
    if (!data?.response?.data) {
        return [];
    }

    return data.response.data.map(task => ({
        id: task.fieldData.__ID,
        recordId: task.recordId,
        task: task.fieldData.task,
        type: task.fieldData.type,
        isCompleted: task.fieldData.f_completed === "1" || task.fieldData.f_completed === 1,
        createdAt: task.fieldData['~creationTimestamp'],
        modifiedAt: task.fieldData['~modificationTimestamp'],
        _projectID: task.fieldData._projectID,
        _staffID: task.fieldData._staffID
    }));
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
 * Validates task data before creation/update
 * @param {Object} data - Task data to validate
 * @returns {Object} Validation result { isValid, errors }
 */
export function validateTaskData(data) {
    const errors = [];

    if (!data.task?.trim()) {
        errors.push('Task name is required');
    }

    // Only check for projectID if it's a new task (has no id)
    if (!data.id && !data._projectID) {
        errors.push('Project ID is required');
    }

    return {
        isValid: errors.length === 0,
        errors
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
 * Formats task data for FileMaker
 * @param {Object} data - Task data to format
 * @returns {Object} Formatted data for FileMaker
 */
export function formatTaskForFileMaker(data) {
    return {
        task: data.task,
        type: data.type,
        _projectID: data._projectID,
        f_completed: data.isCompleted ? "1" : "0",
        notes: data.notes
    };
}

// Helper functions

/**
 * Groups tasks by completion status
 * @param {Array} tasks - Array of task records
 * @returns {Object} Grouped tasks { active, completed }
 */
export function groupTasksByStatus(tasks) {
    return tasks.reduce((groups, task) => {
        const key = task.isCompleted ? 'completed' : 'active';
        groups[key].push(task);
        return groups;
    }, { active: [], completed: [] });
}

/**
 * Calculates task statistics
 * @param {Array} tasks - Array of task records
 * @param {Array} timerRecords - Array of timer records
 * @returns {Object} Task statistics
 */
export function calculateTaskStats(tasks, timerRecords) {
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
    return [...tasks].sort((a, b) => {
        // Active tasks first
        if (a.isCompleted !== b.isCompleted) {
            return a.isCompleted ? 1 : -1;
        }
        // Then by creation date (newest first)
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
}