/**
 * Note API Error Handling
 *
 * Comprehensive error handling for note operations including:
 * - Authentication errors (401, 403)
 * - Validation errors (400, 422)
 * - Network errors (timeout, connection)
 * - Organization scoping errors
 * - Backend API errors
 */

import { ServiceError, ErrorCodes } from '../services';

/**
 * Note-specific error codes
 */
export const NoteErrorCodes = {
    ...ErrorCodes,
    // Authentication & Authorization
    AUTH_FAILED: 'NOTE_AUTH_FAILED',
    AUTH_TOKEN_EXPIRED: 'NOTE_AUTH_TOKEN_EXPIRED',
    AUTH_TOKEN_INVALID: 'NOTE_AUTH_TOKEN_INVALID',
    PERMISSION_DENIED: 'NOTE_PERMISSION_DENIED',
    ORG_SCOPE_MISSING: 'NOTE_ORG_SCOPE_MISSING',
    ORG_SCOPE_INVALID: 'NOTE_ORG_SCOPE_INVALID',

    // Network & Connectivity
    NETWORK_ERROR: 'NOTE_NETWORK_ERROR',
    TIMEOUT_ERROR: 'NOTE_TIMEOUT_ERROR',
    CONNECTION_ERROR: 'NOTE_CONNECTION_ERROR',
    SERVICE_UNAVAILABLE: 'NOTE_SERVICE_UNAVAILABLE',

    // Data & Validation
    NOT_FOUND: 'NOTE_NOT_FOUND',
    INVALID_NOTE_DATA: 'NOTE_INVALID_DATA',
    REQUIRED_FIELD_MISSING: 'NOTE_REQUIRED_FIELD_MISSING',
    MISSING_REQUIRED_FIELD: 'NOTE_REQUIRED_FIELD_MISSING',
    CONTENT_TOO_LONG: 'NOTE_CONTENT_TOO_LONG',

    // Backend API specific
    BACKEND_API_ERROR: 'NOTE_BACKEND_API_ERROR',
    BACKEND_RESPONSE_INVALID: 'NOTE_BACKEND_RESPONSE_INVALID',

    // Operation specific
    CREATE_FAILED: 'NOTE_CREATE_FAILED',
    UPDATE_FAILED: 'NOTE_UPDATE_FAILED',
    DELETE_FAILED: 'NOTE_DELETE_FAILED',
    FETCH_FAILED: 'NOTE_FETCH_FAILED'
};

/**
 * Note API Error class
 */
export class NoteError extends ServiceError {
    constructor(message, code, details = {}) {
        super(message, code, details);
        this.name = 'NoteError';
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
        [NoteErrorCodes.AUTH_FAILED]: 'Authentication failed. Please sign in again.',
        [NoteErrorCodes.AUTH_TOKEN_EXPIRED]: 'Your session has expired. Please sign in again.',
        [NoteErrorCodes.AUTH_TOKEN_INVALID]: 'Invalid authentication token. Please sign in again.',
        [NoteErrorCodes.PERMISSION_DENIED]: 'You do not have permission to perform this action.',
        [NoteErrorCodes.ORG_SCOPE_MISSING]: 'Organization context is missing. Please refresh the page.',
        [NoteErrorCodes.ORG_SCOPE_INVALID]: 'Invalid organization context. Please sign in again.',

        // Network & Connectivity
        [NoteErrorCodes.NETWORK_ERROR]: 'Network connection error. Please check your internet connection.',
        [NoteErrorCodes.TIMEOUT_ERROR]: 'Request timed out. Please try again.',
        [NoteErrorCodes.CONNECTION_ERROR]: 'Unable to connect to the server. Please try again later.',
        [NoteErrorCodes.SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable. Please try again later.',

        // Data & Validation
        [NoteErrorCodes.NOT_FOUND]: `Note ${details.noteId || ''} not found.`,
        [NoteErrorCodes.INVALID_NOTE_DATA]: 'Invalid note data provided.',
        [NoteErrorCodes.REQUIRED_FIELD_MISSING]: `Required field missing: ${details.field || 'unknown'}`,
        [NoteErrorCodes.CONTENT_TOO_LONG]: `Note content is too long. Maximum ${details.maxLength || 50000} characters allowed.`,

        // Backend API specific
        [NoteErrorCodes.BACKEND_API_ERROR]: 'Backend API error occurred.',
        [NoteErrorCodes.BACKEND_RESPONSE_INVALID]: 'Invalid response from server.',

        // Operation specific
        [NoteErrorCodes.CREATE_FAILED]: 'Failed to create note. Please try again.',
        [NoteErrorCodes.UPDATE_FAILED]: 'Failed to update note. Please try again.',
        [NoteErrorCodes.DELETE_FAILED]: 'Failed to delete note. Please try again.',
        [NoteErrorCodes.FETCH_FAILED]: 'Failed to load notes. Please try again.'
    };

    return messages[code] || originalMessage || 'An unexpected error occurred. Please try again.';
}

/**
 * Parse and classify HTTP error responses
 * @param {Error} error - Axios error or generic error
 * @param {string} operation - Operation being performed
 * @returns {NoteError} Classified error
 */
export function parseHttpError(error, operation = 'unknown') {
    // Network errors (no response)
    if (!error.response) {
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            return new NoteError(
                `Request timeout during ${operation}`,
                NoteErrorCodes.TIMEOUT_ERROR,
                { operation, originalError: error.message }
            );
        }

        if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
            return new NoteError(
                `Network error during ${operation}`,
                NoteErrorCodes.NETWORK_ERROR,
                { operation, originalError: error.message }
            );
        }

        return new NoteError(
            `Connection error during ${operation}`,
            NoteErrorCodes.CONNECTION_ERROR,
            { operation, originalError: error.message }
        );
    }

    const status = error.response.status;
    const responseData = error.response.data || {};

    // 401 - Unauthorized
    if (status === 401) {
        if (responseData.message?.includes('expired') || responseData.error?.includes('expired')) {
            return new NoteError(
                'Authentication token expired',
                NoteErrorCodes.AUTH_TOKEN_EXPIRED,
                { operation, status, responseData }
            );
        }

        if (responseData.message?.includes('invalid') || responseData.error?.includes('invalid')) {
            return new NoteError(
                'Invalid authentication token',
                NoteErrorCodes.AUTH_TOKEN_INVALID,
                { operation, status, responseData }
            );
        }

        return new NoteError(
            'Authentication failed',
            NoteErrorCodes.AUTH_FAILED,
            { operation, status, responseData }
        );
    }

    // 403 - Forbidden
    if (status === 403) {
        if (responseData.message?.includes('organization') || responseData.error?.includes('organization')) {
            return new NoteError(
                'Invalid organization scope',
                NoteErrorCodes.ORG_SCOPE_INVALID,
                { operation, status, responseData }
            );
        }

        return new NoteError(
            'Permission denied',
            NoteErrorCodes.PERMISSION_DENIED,
            { operation, status, responseData }
        );
    }

    // 404 - Not Found
    if (status === 404) {
        return new NoteError(
            responseData.message || 'Note not found',
            NoteErrorCodes.NOT_FOUND,
            { operation, status, responseData }
        );
    }

    // 400 - Bad Request
    if (status === 400) {
        const validationErrors = normalizeValidationErrors(responseData);

        return new NoteError(
            responseData.message || 'Invalid request data',
            getValidationErrorCode(validationErrors),
            { operation, status, validationErrors, responseData }
        );
    }

    // 422 - Unprocessable Entity (validation errors)
    if (status === 422) {
        const validationErrors = normalizeValidationErrors(responseData);

        return new NoteError(
            'Validation failed',
            getValidationErrorCode(validationErrors),
            { operation, status, validationErrors, responseData }
        );
    }

    // 500 - Internal Server Error
    if (status >= 500) {
        return new NoteError(
            'Service temporarily unavailable',
            NoteErrorCodes.SERVICE_UNAVAILABLE,
            { operation, status, responseData }
        );
    }

    // Generic error
    return new NoteError(
        responseData.message || error.message || 'Unknown error occurred',
        NoteErrorCodes.BACKEND_API_ERROR,
        { operation, status, responseData }
    );
}

/**
 * Check for organization scoping errors
 * @param {Object} env - Environment context
 * @param {string} operation - Operation being performed
 * @throws {NoteError} If organization scope is missing
 */
export function checkOrganizationScope(env, operation = 'unknown') {
    if (!env?.authentication?.user?.supabaseOrgID) {
        throw new NoteError(
            'Organization context is required but not found',
            NoteErrorCodes.ORG_SCOPE_MISSING,
            { operation, environment: env?.type }
        );
    }
}

/**
 * Wrap async note operations with comprehensive error handling
 * @param {Function} operation - Async operation to execute
 * @param {string} operationName - Name of the operation
 * @param {Object} context - Additional context
 * @returns {Promise<any>} Operation result
 */
export async function withErrorHandling(operation, operationName, context = {}) {
    try {
        return await operation();
    } catch (error) {
        // If already a NoteError, re-throw
        if (error instanceof NoteError) {
            console.error(`[NoteError] ${operationName}:`, error);
            throw error;
        }

        // Check if it's an HTTP error (axios error)
        if (error.response || error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
            const parsedError = parseHttpError(error, operationName);
            console.error(`[NoteError] ${operationName}:`, parsedError);
            throw parsedError;
        }

        // Generic error
        const genericError = new NoteError(
            error.message || 'Unknown error occurred',
            NoteErrorCodes.BACKEND_API_ERROR,
            { operation: operationName, originalError: error.message, context }
        );
        console.error(`[NoteError] ${operationName}:`, genericError);
        throw genericError;
    }
}

/**
 * Format error for display in UI
 * @param {Error} error - Error object
 * @returns {Object} Formatted error for UI
 */
export function formatErrorForUI(error) {
    if (error instanceof NoteError) {
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
    return 'Error';
}

/**
 * Check if error is retryable
 * @param {string} code - Error code
 * @returns {boolean} True if operation can be retried
 */
function isRetryable(code) {
    const retryableCodes = [
        NoteErrorCodes.NETWORK_ERROR,
        NoteErrorCodes.TIMEOUT_ERROR,
        NoteErrorCodes.CONNECTION_ERROR,
        NoteErrorCodes.SERVICE_UNAVAILABLE
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
        NoteErrorCodes.NOT_FOUND
    ];

    const errorSeverity = [
        NoteErrorCodes.AUTH_FAILED,
        NoteErrorCodes.PERMISSION_DENIED,
        NoteErrorCodes.SERVICE_UNAVAILABLE
    ];

    if (warningSeverity.includes(code)) return 'warning';
    if (errorSeverity.includes(code)) return 'error';

    return 'error'; // Default severity
}

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

function getValidationErrorCode(validationErrors) {
    if (validationErrors.some(error => String(error).includes('required') || String(error).includes('missing'))) {
        return NoteErrorCodes.REQUIRED_FIELD_MISSING;
    }
    if (validationErrors.some(error => String(error).includes('too long') || String(error).includes('maximum') || String(error).includes('max length'))) {
        return NoteErrorCodes.CONTENT_TOO_LONG;
    }
    return NoteErrorCodes.INVALID_NOTE_DATA;
}
