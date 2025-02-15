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
        ...task.fieldData,
        id: task.fieldData.__ID,
        isCompleted: task.fieldData.f_completed === "1" || task.fieldData.f_completed === 1,
        createdAt: task.fieldData['~creationTimestamp'],
        modifiedAt: task.fieldData['~modificationTimestamp']
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

    return timerRecords.response.data.map(record => ({
        id: record.fieldData.__ID,
        startTime: new Date(record.fieldData.startTime),
        endTime: record.fieldData.endTime ? new Date(record.fieldData.endTime) : null,
        description: record.fieldData.description || '',
        duration: calculateDuration(
            record.fieldData.startTime,
            record.fieldData.endTime
        )
    }));
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

    return data.response.data.map(note => ({
        id: note.fieldData.__ID,
        content: note.fieldData.note,
        type: note.fieldData.type || 'general',
        createdAt: note.fieldData['~CreationTimestamp'],
        modifiedAt: note.fieldData['~ModificationTimestamp'],
        createdBy: note.fieldData['~CreatedBy']
    }));
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
        url: link.fieldData.link,
        createdAt: link.fieldData['~creationTimestamp'],
        modifiedAt: link.fieldData['~modificationTimestamp']
    }));
}

/**
 * Calculates total time spent on a task
 * @param {Array} timerRecords - Processed timer records
 * @returns {number} Total minutes spent
 */
export function calculateTotalTaskTime(timerRecords) {
    return timerRecords.reduce((total, record) => {
        return total + (record.duration || 0);
    }, 0);
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
        errors.push('Task description is required');
    }

    if (!data._projectID) {
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
        task: data.description,
        type: data.type,
        _projectID: data.projectId,
        f_completed: data.isCompleted ? "1" : "0",
        notes: data.notes
    };
}

// Helper functions

/**
 * Calculates duration between two timestamps in minutes
 * @param {string} startTime - Start timestamp
 * @param {string} endTime - End timestamp
 * @returns {number} Duration in minutes
 */
function calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) {
        return 0;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    return Math.round(diffMs / (1000 * 60)); // Convert to minutes
}

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