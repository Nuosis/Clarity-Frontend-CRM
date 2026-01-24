/**
 * Link API Error Handling
 *
 * Comprehensive error handling for link operations including:
 * - Authentication errors (401, 403)
 * - Validation errors (400, 422)
 * - Network errors (timeout, connection)
 * - Organization scoping errors
 * - Backend API errors
 */

import { ServiceError, ErrorCodes } from '../services';

/**
 * Link-specific error codes
 */
export const LinkErrorCodes = {
    ...ErrorCodes,
    // Authentication & Authorization
    AUTH_FAILED: 'LINK_AUTH_FAILED',
    AUTH_TOKEN_EXPIRED: 'LINK_AUTH_TOKEN_EXPIRED',
    AUTH_TOKEN_INVALID: 'LINK_AUTH_TOKEN_INVALID',
    PERMISSION_DENIED: 'LINK_PERMISSION_DENIED',
    ORG_SCOPE_MISSING: 'LINK_ORG_SCOPE_MISSING',
    ORG_SCOPE_INVALID: 'LINK_ORG_SCOPE_INVALID',

    // Network & Connectivity
    NETWORK_ERROR: 'LINK_NETWORK_ERROR',
    TIMEOUT_ERROR: 'LINK_TIMEOUT_ERROR',
    CONNECTION_ERROR: 'LINK_CONNECTION_ERROR',
    SERVICE_UNAVAILABLE: 'LINK_SERVICE_UNAVAILABLE',

    // Data & Validation
    NOT_FOUND: 'LINK_NOT_FOUND',
    DUPLICATE_LINK: 'LINK_DUPLICATE',
    INVALID_LINK_DATA: 'LINK_INVALID_DATA',
    REQUIRED_FIELD_MISSING: 'LINK_REQUIRED_FIELD_MISSING',
    INVALID_URL_FORMAT: 'LINK_INVALID_URL_FORMAT',

    // Backend API specific
    BACKEND_API_ERROR: 'LINK_BACKEND_API_ERROR',
    BACKEND_RESPONSE_INVALID: 'LINK_BACKEND_RESPONSE_INVALID',

    // Operation specific
    CREATE_FAILED: 'LINK_CREATE_FAILED',
    UPDATE_FAILED: 'LINK_UPDATE_FAILED',
    DELETE_FAILED: 'LINK_DELETE_FAILED',
    FETCH_FAILED: 'LINK_FETCH_FAILED'
};

/**
 * Link API Error class
 */
export class LinkError extends ServiceError {
    constructor(message, code, details = {}) {
        super(message, code, details);
        this.name = 'LinkError';
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
        [LinkErrorCodes.AUTH_FAILED]: 'Authentication failed. Please sign in again.',
        [LinkErrorCodes.AUTH_TOKEN_EXPIRED]: 'Your session has expired. Please sign in again.',
        [LinkErrorCodes.AUTH_TOKEN_INVALID]: 'Invalid authentication token. Please sign in again.',
        [LinkErrorCodes.PERMISSION_DENIED]: 'You do not have permission to perform this action.',
        [LinkErrorCodes.ORG_SCOPE_MISSING]: 'Organization context is missing. Please refresh the page.',
        [LinkErrorCodes.ORG_SCOPE_INVALID]: 'Invalid organization context. Please sign in again.',

        // Network & Connectivity
        [LinkErrorCodes.NETWORK_ERROR]: 'Network connection error. Please check your internet connection.',
        [LinkErrorCodes.TIMEOUT_ERROR]: 'Request timed out. Please try again.',
        [LinkErrorCodes.CONNECTION_ERROR]: 'Unable to connect to the server. Please try again later.',
        [LinkErrorCodes.SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable. Please try again later.',

        // Data & Validation
        [LinkErrorCodes.NOT_FOUND]: `Link ${details.linkId || ''} not found.`,
        [LinkErrorCodes.DUPLICATE_LINK]: 'This link already exists.',
        [LinkErrorCodes.INVALID_LINK_DATA]: 'Invalid link data provided.',
        [LinkErrorCodes.REQUIRED_FIELD_MISSING]: `Required field missing: ${details.field || 'unknown'}`,
        [LinkErrorCodes.INVALID_URL_FORMAT]: 'Invalid URL format. Please enter a valid URL.',

        // Backend API specific
        [LinkErrorCodes.BACKEND_API_ERROR]: 'Backend API error occurred.',
        [LinkErrorCodes.BACKEND_RESPONSE_INVALID]: 'Invalid response from server.',

        // Operation specific
        [LinkErrorCodes.CREATE_FAILED]: 'Failed to create link. Please try again.',
        [LinkErrorCodes.UPDATE_FAILED]: 'Failed to update link. Please try again.',
        [LinkErrorCodes.DELETE_FAILED]: 'Failed to delete link. Please try again.',
        [LinkErrorCodes.FETCH_FAILED]: 'Failed to load links. Please try again.'
    };

    return messages[code] || originalMessage || 'An unexpected error occurred. Please try again.';
}

/**
 * Parse and classify HTTP error responses
 * @param {Error} error - Axios error or generic error
 * @param {string} operation - Operation being performed
 * @returns {LinkError} Classified error
 */
export function parseHttpError(error, operation = 'unknown') {
    // Network errors (no response)
    if (!error.response) {
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            return new LinkError(
                `Request timeout during ${operation}`,
                LinkErrorCodes.TIMEOUT_ERROR,
                { operation, originalError: error.message }
            );
        }

        if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
            return new LinkError(
                `Network error during ${operation}`,
                LinkErrorCodes.NETWORK_ERROR,
                { operation, originalError: error.message }
            );
        }

        return new LinkError(
            `Connection error during ${operation}`,
            LinkErrorCodes.CONNECTION_ERROR,
            { operation, originalError: error.message }
        );
    }

    const status = error.response.status;
    const responseData = error.response.data || {};

    // 401 - Unauthorized
    if (status === 401) {
        if (responseData.message?.includes('expired') || responseData.error?.includes('expired')) {
            return new LinkError(
                'Authentication token expired',
                LinkErrorCodes.AUTH_TOKEN_EXPIRED,
                { operation, status, responseData }
            );
        }

        if (responseData.message?.includes('invalid') || responseData.error?.includes('invalid')) {
            return new LinkError(
                'Invalid authentication token',
                LinkErrorCodes.AUTH_TOKEN_INVALID,
                { operation, status, responseData }
            );
        }

        return new LinkError(
            'Authentication failed',
            LinkErrorCodes.AUTH_FAILED,
            { operation, status, responseData }
        );
    }

    // 403 - Forbidden
    if (status === 403) {
        if (responseData.message?.includes('organization') || responseData.error?.includes('organization')) {
            return new LinkError(
                'Invalid organization scope',
                LinkErrorCodes.ORG_SCOPE_INVALID,
                { operation, status, responseData }
            );
        }

        return new LinkError(
            'Permission denied',
            LinkErrorCodes.PERMISSION_DENIED,
            { operation, status, responseData }
        );
    }

    // 404 - Not Found
    if (status === 404) {
        return new LinkError(
            responseData.message || 'Link not found',
            LinkErrorCodes.NOT_FOUND,
            { operation, status, responseData }
        );
    }

    // 400 - Bad Request
    if (status === 400) {
        const validationErrors = responseData.errors || responseData.detail || [];

        return new LinkError(
            responseData.message || 'Invalid request data',
            LinkErrorCodes.INVALID_LINK_DATA,
            { operation, status, validationErrors, responseData }
        );
    }

    // 422 - Unprocessable Entity (validation errors)
    if (status === 422) {
        const validationErrors = responseData.errors || responseData.detail || [];

        return new LinkError(
            'Validation failed',
            LinkErrorCodes.VALIDATION_ERROR,
            { operation, status, validationErrors, responseData }
        );
    }

    // 409 - Conflict
    if (status === 409) {
        return new LinkError(
            responseData.message || 'Link already exists',
            LinkErrorCodes.DUPLICATE_LINK,
            { operation, status, responseData }
        );
    }

    // 500 - Internal Server Error
    if (status >= 500) {
        return new LinkError(
            'Service temporarily unavailable',
            LinkErrorCodes.SERVICE_UNAVAILABLE,
            { operation, status, responseData }
        );
    }

    // Generic error
    return new LinkError(
        responseData.message || error.message || 'Unknown error occurred',
        LinkErrorCodes.BACKEND_API_ERROR,
        { operation, status, responseData }
    );
}

/**
 * Parse validation errors
 * @param {Object} validationResult - Validation result
 * @param {string} operation - Operation being performed
 * @returns {LinkError} Validation error
 */
export function parseValidationError(validationResult, operation = 'unknown') {
    const errors = validationResult.errors || [];

    // Check for specific validation error types
    const urlError = errors.find(err => err.includes('url') || err.includes('link'));
    if (urlError) {
        return new LinkError(
            urlError,
            LinkErrorCodes.INVALID_URL_FORMAT,
            { operation, validationErrors: errors }
        );
    }

    const requiredError = errors.find(err => err.includes('required'));
    if (requiredError) {
        return new LinkError(
            requiredError,
            LinkErrorCodes.REQUIRED_FIELD_MISSING,
            { operation, validationErrors: errors }
        );
    }

    return new LinkError(
        errors[0] || 'Validation failed',
        LinkErrorCodes.VALIDATION_ERROR,
        { operation, validationErrors: errors }
    );
}

/**
 * Check for organization scoping errors
 * @param {Object} env - Environment context
 * @param {string} operation - Operation being performed
 * @throws {LinkError} If organization scope is missing
 */
export function checkOrganizationScope(env, operation = 'unknown') {
    if (env.type === 'webapp') {
        if (!env.authentication?.user?.supabaseOrgID) {
            throw new LinkError(
                'Organization context is required but not found',
                LinkErrorCodes.ORG_SCOPE_MISSING,
                { operation, environment: env.type }
            );
        }
    }
}

/**
 * Wrap async link operations with comprehensive error handling
 * @param {Function} operation - Async operation to execute
 * @param {string} operationName - Name of the operation
 * @param {Object} context - Additional context
 * @returns {Promise<any>} Operation result
 */
export async function withErrorHandling(operation, operationName, context = {}) {
    try {
        return await operation();
    } catch (error) {
        // If already a LinkError, re-throw
        if (error instanceof LinkError) {
            console.error(`[LinkError] ${operationName}:`, error);
            throw error;
        }

        // Check if it's an HTTP error (axios error)
        if (error.response || error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
            const parsedError = parseHttpError(error, operationName);
            console.error(`[LinkError] ${operationName}:`, parsedError);
            throw parsedError;
        }

        // Generic error
        const genericError = new LinkError(
            error.message || 'Unknown error occurred',
            LinkErrorCodes.BACKEND_API_ERROR,
            { operation: operationName, originalError: error.message, context }
        );
        console.error(`[LinkError] ${operationName}:`, genericError);
        throw genericError;
    }
}

/**
 * Format error for display in UI
 * @param {Error} error - Error object
 * @returns {Object} Formatted error for UI
 */
export function formatErrorForUI(error) {
    if (error instanceof LinkError) {
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
    if (code.includes('DUPLICATE')) return 'Duplicate Entry';
    return 'Error';
}

/**
 * Check if error is retryable
 * @param {string} code - Error code
 * @returns {boolean} True if operation can be retried
 */
function isRetryable(code) {
    const retryableCodes = [
        LinkErrorCodes.NETWORK_ERROR,
        LinkErrorCodes.TIMEOUT_ERROR,
        LinkErrorCodes.CONNECTION_ERROR,
        LinkErrorCodes.SERVICE_UNAVAILABLE
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
        LinkErrorCodes.DUPLICATE_LINK,
        LinkErrorCodes.NOT_FOUND
    ];

    const errorSeverity = [
        LinkErrorCodes.AUTH_FAILED,
        LinkErrorCodes.PERMISSION_DENIED,
        LinkErrorCodes.SERVICE_UNAVAILABLE
    ];

    if (warningSeverity.includes(code)) return 'warning';
    if (errorSeverity.includes(code)) return 'error';

    return 'error'; // Default severity
}
