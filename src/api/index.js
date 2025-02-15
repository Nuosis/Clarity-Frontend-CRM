// FileMaker base functionality
export {
    fetchDataFromFileMaker,
    handleFileMakerOperation,
    validateParams,
    Layouts,
    Actions
} from './fileMaker';

// Customer operations
export {
    fetchCustomers,
    fetchCustomerById,
    updateCustomer,
    createCustomer,
    toggleCustomerStatus,
    fetchActiveCustomers,
    fetchCustomerContext
} from './customers';

// Project operations
export {
    fetchProjectsForCustomer,
    fetchProjectRelatedData,
    updateProjectStatus,
    createProject,
    updateProject,
    fetchAllProjectData,
    fetchProjectsForCustomers,
    fetchProjectNotes
} from './projects';

// Task operations
export {
    fetchTasksForProject,
    createTask,
    updateTask,
    updateTaskStatus,
    startTaskTimer,
    stopTaskTimer,
    fetchTaskTimers,
    updateTaskNotes,
    fetchActiveProjectTasks,
    fetchTaskNotes,
    fetchTaskLinks
} from './tasks';

// API version
export const API_VERSION = '1.0.0';

// Error codes
export const ErrorCodes = {
    TIMEOUT: 'TIMEOUT',
    NULL_RESULT: 'NULL_RESULT',
    FM_ERROR: 'FM_ERROR',
    SCRIPT_ERROR: 'SCRIPT_ERROR',
    PREPARATION_ERROR: 'PREPARATION_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR'
};

// Utility function to check if an error is a FileMaker error
export function isFileMakerError(error) {
    return error && error.code && Object.values(ErrorCodes).includes(error.code);
}

// Utility function to format error messages
export function formatErrorMessage(error) {
    if (isFileMakerError(error)) {
        return `FileMaker Error (${error.code}): ${error.message}${error.details ? `\nDetails: ${error.details}` : ''}`;
    }
    return error.message || 'An unknown error occurred';
}