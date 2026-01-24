/**
 * Project API Error Handling
 *
 * Comprehensive error handling for project operations including:
 * - Authentication errors (401, 403)
 * - Validation errors (400, 422)
 * - Network errors (timeout, connection)
 * - Organization scoping errors
 * - Backend API errors
 */

import { ServiceError, ErrorCodes } from '../services';

/**
 * Project-specific error codes
 */
export const ProjectErrorCodes = {
    ...ErrorCodes,
    // Authentication & Authorization
    AUTH_FAILED: 'PROJECT_AUTH_FAILED',
    AUTH_TOKEN_EXPIRED: 'PROJECT_AUTH_TOKEN_EXPIRED',
    AUTH_TOKEN_INVALID: 'PROJECT_AUTH_TOKEN_INVALID',
    PERMISSION_DENIED: 'PROJECT_PERMISSION_DENIED',
    ORG_SCOPE_MISSING: 'PROJECT_ORG_SCOPE_MISSING',
    ORG_SCOPE_INVALID: 'PROJECT_ORG_SCOPE_INVALID',

    // Network & Connectivity
    NETWORK_ERROR: 'PROJECT_NETWORK_ERROR',
    TIMEOUT_ERROR: 'PROJECT_TIMEOUT_ERROR',
    CONNECTION_ERROR: 'PROJECT_CONNECTION_ERROR',
    SERVICE_UNAVAILABLE: 'PROJECT_SERVICE_UNAVAILABLE',

    // Data & Validation
    NOT_FOUND: 'PROJECT_NOT_FOUND',
    INVALID_PROJECT_DATA: 'PROJECT_INVALID_DATA',
    REQUIRED_FIELD_MISSING: 'PROJECT_REQUIRED_FIELD_MISSING',
    MISSING_REQUIRED_FIELD: 'PROJECT_REQUIRED_FIELD_MISSING',
    INVALID_STATUS: 'PROJECT_INVALID_STATUS',
    INVALID_CUSTOMER_ID: 'PROJECT_INVALID_CUSTOMER_ID',

    // Backend API specific
    BACKEND_API_ERROR: 'PROJECT_BACKEND_API_ERROR',
    BACKEND_RESPONSE_INVALID: 'PROJECT_BACKEND_RESPONSE_INVALID',

    // Operation specific
    CREATE_FAILED: 'PROJECT_CREATE_FAILED',
    UPDATE_FAILED: 'PROJECT_UPDATE_FAILED',
    DELETE_FAILED: 'PROJECT_DELETE_FAILED',
    FETCH_FAILED: 'PROJECT_FETCH_FAILED',
    STATUS_UPDATE_FAILED: 'PROJECT_STATUS_UPDATE_FAILED',

    // Objective/Step specific
    OBJECTIVE_NOT_FOUND: 'PROJECT_OBJECTIVE_NOT_FOUND',
    OBJECTIVE_CREATE_FAILED: 'PROJECT_OBJECTIVE_CREATE_FAILED',
    OBJECTIVE_UPDATE_FAILED: 'PROJECT_OBJECTIVE_UPDATE_FAILED',
    OBJECTIVE_DELETE_FAILED: 'PROJECT_OBJECTIVE_DELETE_FAILED',
    STEP_NOT_FOUND: 'PROJECT_STEP_NOT_FOUND',
    STEP_CREATE_FAILED: 'PROJECT_STEP_CREATE_FAILED',
    STEP_UPDATE_FAILED: 'PROJECT_STEP_UPDATE_FAILED',
    STEP_DELETE_FAILED: 'PROJECT_STEP_DELETE_FAILED',

    // Image specific
    IMAGE_NOT_FOUND: 'PROJECT_IMAGE_NOT_FOUND',
    IMAGE_UPLOAD_FAILED: 'PROJECT_IMAGE_UPLOAD_FAILED',
    IMAGE_DELETE_FAILED: 'PROJECT_IMAGE_DELETE_FAILED'
};

/**
 * Project API Error class
 */
export class ProjectError extends ServiceError {
    constructor(message, code, details = {}) {
        super(message, code, details);
        this.name = 'ProjectError';
        this.timestamp = new Date().toISOString();
        this.userFriendlyMessage = getUserFriendlyMessage(code, message, details);
    }
}

/**
 * Get user-friendly error message
 * @param {string} code - Error code
 * @param {string} originalMessage - Original error message
 * @param {Object} details - Error details
 * @returns {string} User-friendly message
 */
function getUserFriendlyMessage(code, originalMessage, details) {
    const messages = {
        // Authentication & Authorization
        [ProjectErrorCodes.AUTH_FAILED]: 'Authentication failed. Please sign in again.',
        [ProjectErrorCodes.AUTH_TOKEN_EXPIRED]: 'Your session has expired. Please sign in again.',
        [ProjectErrorCodes.AUTH_TOKEN_INVALID]: 'Invalid authentication token. Please sign in again.',
        [ProjectErrorCodes.PERMISSION_DENIED]: 'You do not have permission to perform this action.',
        [ProjectErrorCodes.ORG_SCOPE_MISSING]: 'Organization context is missing. Please refresh the page.',
        [ProjectErrorCodes.ORG_SCOPE_INVALID]: 'Invalid organization context. Please sign in again.',

        // Network & Connectivity
        [ProjectErrorCodes.NETWORK_ERROR]: 'Network connection error. Please check your internet connection.',
        [ProjectErrorCodes.TIMEOUT_ERROR]: 'Request timed out. Please try again.',
        [ProjectErrorCodes.CONNECTION_ERROR]: 'Unable to connect to the server. Please try again later.',
        [ProjectErrorCodes.SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable. Please try again later.',

        // Data & Validation
        [ProjectErrorCodes.NOT_FOUND]: `Project ${details.projectId || ''} not found.`,
        [ProjectErrorCodes.INVALID_PROJECT_DATA]: 'Invalid project data provided.',
        [ProjectErrorCodes.REQUIRED_FIELD_MISSING]: `Required field missing: ${details.field || 'unknown'}`,
        [ProjectErrorCodes.INVALID_STATUS]: 'Invalid project status provided.',
        [ProjectErrorCodes.INVALID_CUSTOMER_ID]: 'Invalid customer ID provided.',

        // Backend API specific
        [ProjectErrorCodes.BACKEND_API_ERROR]: 'Backend API error occurred.',
        [ProjectErrorCodes.BACKEND_RESPONSE_INVALID]: 'Invalid response from server.',

        // Operation specific
        [ProjectErrorCodes.CREATE_FAILED]: 'Failed to create project. Please try again.',
        [ProjectErrorCodes.UPDATE_FAILED]: 'Failed to update project. Please try again.',
        [ProjectErrorCodes.DELETE_FAILED]: 'Failed to delete project. Please try again.',
        [ProjectErrorCodes.FETCH_FAILED]: 'Failed to load projects. Please try again.',
        [ProjectErrorCodes.STATUS_UPDATE_FAILED]: 'Failed to update project status. Please try again.',

        // Objective/Step specific
        [ProjectErrorCodes.OBJECTIVE_NOT_FOUND]: 'Objective not found.',
        [ProjectErrorCodes.OBJECTIVE_CREATE_FAILED]: 'Failed to create objective. Please try again.',
        [ProjectErrorCodes.OBJECTIVE_UPDATE_FAILED]: 'Failed to update objective. Please try again.',
        [ProjectErrorCodes.OBJECTIVE_DELETE_FAILED]: 'Failed to delete objective. Please try again.',
        [ProjectErrorCodes.STEP_NOT_FOUND]: 'Step not found.',
        [ProjectErrorCodes.STEP_CREATE_FAILED]: 'Failed to create step. Please try again.',
        [ProjectErrorCodes.STEP_UPDATE_FAILED]: 'Failed to update step. Please try again.',
        [ProjectErrorCodes.STEP_DELETE_FAILED]: 'Failed to delete step. Please try again.',

        // Image specific
        [ProjectErrorCodes.IMAGE_NOT_FOUND]: 'Image not found.',
        [ProjectErrorCodes.IMAGE_UPLOAD_FAILED]: 'Failed to upload image. Please try again.',
        [ProjectErrorCodes.IMAGE_DELETE_FAILED]: 'Failed to delete image. Please try again.'
    };

    return messages[code] || originalMessage || 'An unexpected error occurred. Please try again.';
}

/**
 * Parse and classify HTTP error responses
 * @param {Error} error - Axios error or generic error
 * @param {string} operation - Operation being performed
 * @returns {ProjectError} Classified error
 */
export function parseHttpError(error, operation = 'unknown') {
    // Network errors (no response)
    if (!error.response) {
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            return new ProjectError(
                `Request timeout during ${operation}`,
                ProjectErrorCodes.TIMEOUT_ERROR,
                { operation, originalError: error.message }
            );
        }

        if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
            return new ProjectError(
                `Network error during ${operation}`,
                ProjectErrorCodes.NETWORK_ERROR,
                { operation, originalError: error.message }
            );
        }

        return new ProjectError(
            `Connection error during ${operation}`,
            ProjectErrorCodes.CONNECTION_ERROR,
            { operation, originalError: error.message }
        );
    }

    const status = error.response.status;
    const responseData = error.response.data || {};

    // 401 - Unauthorized
    if (status === 401) {
        if (responseData.message?.includes('expired') || responseData.error?.includes('expired')) {
            return new ProjectError(
                'Authentication token expired',
                ProjectErrorCodes.AUTH_TOKEN_EXPIRED,
                { operation, status, responseData }
            );
        }

        if (responseData.message?.includes('invalid') || responseData.error?.includes('invalid')) {
            return new ProjectError(
                'Invalid authentication token',
                ProjectErrorCodes.AUTH_TOKEN_INVALID,
                { operation, status, responseData }
            );
        }

        return new ProjectError(
            'Authentication failed',
            ProjectErrorCodes.AUTH_FAILED,
            { operation, status, responseData }
        );
    }

    // 403 - Forbidden
    if (status === 403) {
        if (responseData.message?.includes('organization') || responseData.error?.includes('organization')) {
            return new ProjectError(
                'Invalid organization scope',
                ProjectErrorCodes.ORG_SCOPE_INVALID,
                { operation, status, responseData }
            );
        }

        return new ProjectError(
            'Permission denied',
            ProjectErrorCodes.PERMISSION_DENIED,
            { operation, status, responseData }
        );
    }

    // 404 - Not Found
    if (status === 404) {
        return new ProjectError(
            responseData.message || 'Project not found',
            ProjectErrorCodes.NOT_FOUND,
            { operation, status, responseData }
        );
    }

    // 400 - Bad Request
    if (status === 400) {
        const validationErrors = normalizeValidationErrors(responseData);

        return new ProjectError(
            responseData.message || 'Invalid request data',
            getValidationErrorCode(validationErrors),
            { operation, status, validationErrors, responseData }
        );
    }

    // 422 - Unprocessable Entity (validation errors)
    if (status === 422) {
        const validationErrors = normalizeValidationErrors(responseData);

        return new ProjectError(
            'Validation failed',
            getValidationErrorCode(validationErrors),
            { operation, status, validationErrors, responseData }
        );
    }

    // 500 - Internal Server Error
    if (status >= 500) {
        return new ProjectError(
            'Service temporarily unavailable',
            ProjectErrorCodes.SERVICE_UNAVAILABLE,
            { operation, status, responseData }
        );
    }

    // Generic error
    return new ProjectError(
        responseData.message || error.message || 'Unknown error occurred',
        ProjectErrorCodes.BACKEND_API_ERROR,
        { operation, status, responseData }
    );
}

/**
 * Check for organization scoping errors
 * @param {Object} env - Environment context
 * @param {string} operation - Operation being performed
 * @throws {ProjectError} If organization scope is missing
 */
export function checkOrganizationScope(env, operation = 'unknown') {
    if (!env?.authentication?.user?.supabaseOrgID) {
        throw new ProjectError(
            'Organization context is required but not found',
            ProjectErrorCodes.ORG_SCOPE_MISSING,
            { operation, environment: env?.type }
        );
    }
}

/**
 * Wrap async project operations with comprehensive error handling
 * @param {Function} operation - Async operation to execute
 * @param {string} operationName - Name of the operation
 * @param {Object} context - Additional context
 * @returns {Promise<any>} Operation result
 */
export async function withErrorHandling(operation, operationName, context = {}) {
    try {
        return await operation();
    } catch (error) {
        // If already a ProjectError, re-throw
        if (error instanceof ProjectError) {
            console.error(`[ProjectError] ${operationName}:`, error);
            throw error;
        }

        // Check if it's an HTTP error (axios error)
        if (error.response || error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
            const parsedError = parseHttpError(error, operationName);
            console.error(`[ProjectError] ${operationName}:`, parsedError);
            throw parsedError;
        }

        // Generic error
        const genericError = new ProjectError(
            error.message || 'Unknown error occurred',
            ProjectErrorCodes.BACKEND_API_ERROR,
            { operation: operationName, originalError: error.message, context }
        );
        console.error(`[ProjectError] ${operationName}:`, genericError);
        throw genericError;
    }
}

/**
 * Format error for display in UI
 * @param {Error} error - Error object
 * @returns {Object} Formatted error for UI
 */
export function formatErrorForUI(error) {
    if (error instanceof ProjectError) {
        return {
            title: getErrorTitle(error.code),
            message: error.userFriendlyMessage,
            details: error.details,
            code: error.code,
            timestamp: error.timestamp,
            canRetry: isRetryable(error.code),
            severity: getErrorSeverity(error.code)
        };
    }

    return {
        title: 'Error',
        message: error.message || 'An unexpected error occurred',
        details: {},
        code: 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString(),
        canRetry: true,
        severity: 'error'
    };
}

/**
 * Get error title based on code
 * @param {string} code - Error code
 * @returns {string} Error title
 */
function getErrorTitle(code) {
    if (code.includes('AUTH')) return 'Authentication Error';
    if (code.includes('PERMISSION')) return 'Permission Denied';
    if (code.includes('NETWORK') || code.includes('TIMEOUT') || code.includes('CONNECTION')) {
        return 'Connection Error';
    }
    if (code.includes('VALIDATION') || code.includes('INVALID')) return 'Validation Error';
    if (code.includes('NOT_FOUND')) return 'Not Found';
    if (code.includes('OBJECTIVE')) return 'Objective Error';
    if (code.includes('STEP')) return 'Step Error';
    if (code.includes('IMAGE')) return 'Image Error';
    return 'Error';
}

/**
 * Check if error is retryable
 * @param {string} code - Error code
 * @returns {boolean} True if operation can be retried
 */
function isRetryable(code) {
    const retryableCodes = [
        ProjectErrorCodes.NETWORK_ERROR,
        ProjectErrorCodes.TIMEOUT_ERROR,
        ProjectErrorCodes.CONNECTION_ERROR,
        ProjectErrorCodes.SERVICE_UNAVAILABLE
    ];

    return retryableCodes.includes(code);
}

/**
 * Get error severity level
 * @param {string} code - Error code
 * @returns {string} Severity level: 'error' | 'warning' | 'info'
 */
function getErrorSeverity(code) {
    const warningSeverity = [
        ProjectErrorCodes.NOT_FOUND,
        ProjectErrorCodes.OBJECTIVE_NOT_FOUND,
        ProjectErrorCodes.STEP_NOT_FOUND,
        ProjectErrorCodes.IMAGE_NOT_FOUND
    ];

    const errorSeverity = [
        ProjectErrorCodes.AUTH_FAILED,
        ProjectErrorCodes.PERMISSION_DENIED,
        ProjectErrorCodes.SERVICE_UNAVAILABLE
    ];

    if (warningSeverity.includes(code)) return 'warning';
    if (errorSeverity.includes(code)) return 'error';

    return 'error'; // Default severity
}

/**
 * Normalize validation errors from various response formats
 * @param {Object} responseData - Response data from API
 * @returns {Array} Normalized validation errors
 */
function normalizeValidationErrors(responseData) {
    const validationErrors = responseData.errors || responseData.detail || [];
    if (Array.isArray(validationErrors)) {
        return validationErrors;
    }
    if (validationErrors) {
        return [validationErrors];
    }
    return [];
}

/**
 * Get appropriate validation error code based on error content
 * @param {Array} validationErrors - Array of validation errors
 * @returns {string} Error code
 */
function getValidationErrorCode(validationErrors) {
    const errorString = JSON.stringify(validationErrors).toLowerCase();

    if (errorString.includes('required') || errorString.includes('missing')) {
        return ProjectErrorCodes.REQUIRED_FIELD_MISSING;
    }
    if (errorString.includes('status')) {
        return ProjectErrorCodes.INVALID_STATUS;
    }
    if (errorString.includes('customer')) {
        return ProjectErrorCodes.INVALID_CUSTOMER_ID;
    }

    return ProjectErrorCodes.INVALID_PROJECT_DATA;
}
