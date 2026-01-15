/**
 * Customer API Error Handling
 *
 * Comprehensive error handling for customer operations including:
 * - Authentication errors (401, 403)
 * - Validation errors (400, 422)
 * - Network errors (timeout, connection)
 * - Organization scoping errors
 * - Backend API errors
 * - FileMaker bridge errors
 */

import { ServiceError, ErrorCodes } from '../services';

/**
 * Customer-specific error codes
 */
export const CustomerErrorCodes = {
    ...ErrorCodes,
    // Authentication & Authorization
    AUTH_FAILED: 'CUSTOMER_AUTH_FAILED',
    AUTH_TOKEN_EXPIRED: 'CUSTOMER_AUTH_TOKEN_EXPIRED',
    AUTH_TOKEN_INVALID: 'CUSTOMER_AUTH_TOKEN_INVALID',
    PERMISSION_DENIED: 'CUSTOMER_PERMISSION_DENIED',
    ORG_SCOPE_MISSING: 'CUSTOMER_ORG_SCOPE_MISSING',
    ORG_SCOPE_INVALID: 'CUSTOMER_ORG_SCOPE_INVALID',

    // Network & Connectivity
    NETWORK_ERROR: 'CUSTOMER_NETWORK_ERROR',
    TIMEOUT_ERROR: 'CUSTOMER_TIMEOUT_ERROR',
    CONNECTION_ERROR: 'CUSTOMER_CONNECTION_ERROR',
    SERVICE_UNAVAILABLE: 'CUSTOMER_SERVICE_UNAVAILABLE',

    // Data & Validation
    NOT_FOUND: 'CUSTOMER_NOT_FOUND',
    DUPLICATE_CUSTOMER: 'CUSTOMER_DUPLICATE',
    INVALID_CUSTOMER_DATA: 'CUSTOMER_INVALID_DATA',
    REQUIRED_FIELD_MISSING: 'CUSTOMER_REQUIRED_FIELD_MISSING',
    INVALID_EMAIL_FORMAT: 'CUSTOMER_INVALID_EMAIL_FORMAT',
    INVALID_PHONE_FORMAT: 'CUSTOMER_INVALID_PHONE_FORMAT',

    // FileMaker specific
    FILEMAKER_BRIDGE_ERROR: 'CUSTOMER_FILEMAKER_BRIDGE_ERROR',
    FILEMAKER_SCRIPT_ERROR: 'CUSTOMER_FILEMAKER_SCRIPT_ERROR',
    FILEMAKER_LAYOUT_ERROR: 'CUSTOMER_FILEMAKER_LAYOUT_ERROR',

    // Backend API specific
    BACKEND_API_ERROR: 'CUSTOMER_BACKEND_API_ERROR',
    BACKEND_RESPONSE_INVALID: 'CUSTOMER_BACKEND_RESPONSE_INVALID',

    // Operation specific
    CREATE_FAILED: 'CUSTOMER_CREATE_FAILED',
    UPDATE_FAILED: 'CUSTOMER_UPDATE_FAILED',
    DELETE_FAILED: 'CUSTOMER_DELETE_FAILED',
    FETCH_FAILED: 'CUSTOMER_FETCH_FAILED',
    SEARCH_FAILED: 'CUSTOMER_SEARCH_FAILED'
};

/**
 * Customer API Error class
 */
export class CustomerError extends ServiceError {
    constructor(message, code, details = {}) {
        super(message, code, details);
        this.name = 'CustomerError';
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
        [CustomerErrorCodes.AUTH_FAILED]: 'Authentication failed. Please sign in again.',
        [CustomerErrorCodes.AUTH_TOKEN_EXPIRED]: 'Your session has expired. Please sign in again.',
        [CustomerErrorCodes.AUTH_TOKEN_INVALID]: 'Invalid authentication token. Please sign in again.',
        [CustomerErrorCodes.PERMISSION_DENIED]: 'You do not have permission to perform this action.',
        [CustomerErrorCodes.ORG_SCOPE_MISSING]: 'Organization context is missing. Please refresh the page.',
        [CustomerErrorCodes.ORG_SCOPE_INVALID]: 'Invalid organization context. Please sign in again.',

        // Network & Connectivity
        [CustomerErrorCodes.NETWORK_ERROR]: 'Network connection error. Please check your internet connection.',
        [CustomerErrorCodes.TIMEOUT_ERROR]: 'Request timed out. Please try again.',
        [CustomerErrorCodes.CONNECTION_ERROR]: 'Unable to connect to the server. Please try again later.',
        [CustomerErrorCodes.SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable. Please try again later.',

        // Data & Validation
        [CustomerErrorCodes.NOT_FOUND]: `Customer ${details.customerId || ''} not found.`,
        [CustomerErrorCodes.DUPLICATE_CUSTOMER]: 'A customer with this information already exists.',
        [CustomerErrorCodes.INVALID_CUSTOMER_DATA]: 'Invalid customer data provided.',
        [CustomerErrorCodes.REQUIRED_FIELD_MISSING]: `Required field missing: ${details.field || 'unknown'}`,
        [CustomerErrorCodes.INVALID_EMAIL_FORMAT]: 'Invalid email format. Please enter a valid email address.',
        [CustomerErrorCodes.INVALID_PHONE_FORMAT]: 'Invalid phone format. Please enter a valid phone number.',

        // FileMaker specific
        [CustomerErrorCodes.FILEMAKER_BRIDGE_ERROR]: 'FileMaker connection error. Please contact support.',
        [CustomerErrorCodes.FILEMAKER_SCRIPT_ERROR]: 'FileMaker script execution failed.',
        [CustomerErrorCodes.FILEMAKER_LAYOUT_ERROR]: 'FileMaker layout error.',

        // Backend API specific
        [CustomerErrorCodes.BACKEND_API_ERROR]: 'Backend API error occurred.',
        [CustomerErrorCodes.BACKEND_RESPONSE_INVALID]: 'Invalid response from server.',

        // Operation specific
        [CustomerErrorCodes.CREATE_FAILED]: 'Failed to create customer. Please try again.',
        [CustomerErrorCodes.UPDATE_FAILED]: 'Failed to update customer. Please try again.',
        [CustomerErrorCodes.DELETE_FAILED]: 'Failed to delete customer. Please try again.',
        [CustomerErrorCodes.FETCH_FAILED]: 'Failed to load customers. Please try again.',
        [CustomerErrorCodes.SEARCH_FAILED]: 'Search failed. Please try again.'
    };

    return messages[code] || originalMessage || 'An unexpected error occurred. Please try again.';
}

/**
 * Parse and classify HTTP error responses
 * @param {Error} error - Axios error or generic error
 * @param {string} operation - Operation being performed
 * @returns {CustomerError} Classified error
 */
export function parseHttpError(error, operation = 'unknown') {
    // Network errors (no response)
    if (!error.response) {
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            return new CustomerError(
                `Request timeout during ${operation}`,
                CustomerErrorCodes.TIMEOUT_ERROR,
                { operation, originalError: error.message }
            );
        }

        if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
            return new CustomerError(
                `Network error during ${operation}`,
                CustomerErrorCodes.NETWORK_ERROR,
                { operation, originalError: error.message }
            );
        }

        return new CustomerError(
            `Connection error during ${operation}`,
            CustomerErrorCodes.CONNECTION_ERROR,
            { operation, originalError: error.message }
        );
    }

    const status = error.response.status;
    const responseData = error.response.data || {};

    // 401 - Unauthorized
    if (status === 401) {
        if (responseData.message?.includes('expired') || responseData.error?.includes('expired')) {
            return new CustomerError(
                'Authentication token expired',
                CustomerErrorCodes.AUTH_TOKEN_EXPIRED,
                { operation, status, responseData }
            );
        }

        if (responseData.message?.includes('invalid') || responseData.error?.includes('invalid')) {
            return new CustomerError(
                'Invalid authentication token',
                CustomerErrorCodes.AUTH_TOKEN_INVALID,
                { operation, status, responseData }
            );
        }

        return new CustomerError(
            'Authentication failed',
            CustomerErrorCodes.AUTH_FAILED,
            { operation, status, responseData }
        );
    }

    // 403 - Forbidden
    if (status === 403) {
        if (responseData.message?.includes('organization') || responseData.error?.includes('organization')) {
            return new CustomerError(
                'Invalid organization scope',
                CustomerErrorCodes.ORG_SCOPE_INVALID,
                { operation, status, responseData }
            );
        }

        return new CustomerError(
            'Permission denied',
            CustomerErrorCodes.PERMISSION_DENIED,
            { operation, status, responseData }
        );
    }

    // 404 - Not Found
    if (status === 404) {
        return new CustomerError(
            responseData.message || 'Customer not found',
            CustomerErrorCodes.NOT_FOUND,
            { operation, status, responseData }
        );
    }

    // 400 - Bad Request
    if (status === 400) {
        const validationErrors = responseData.errors || responseData.detail || [];

        return new CustomerError(
            responseData.message || 'Invalid request data',
            CustomerErrorCodes.INVALID_CUSTOMER_DATA,
            { operation, status, validationErrors, responseData }
        );
    }

    // 422 - Unprocessable Entity (validation errors)
    if (status === 422) {
        const validationErrors = responseData.errors || responseData.detail || [];

        return new CustomerError(
            'Validation failed',
            CustomerErrorCodes.VALIDATION_ERROR,
            { operation, status, validationErrors, responseData }
        );
    }

    // 409 - Conflict
    if (status === 409) {
        return new CustomerError(
            responseData.message || 'Customer already exists',
            CustomerErrorCodes.DUPLICATE_CUSTOMER,
            { operation, status, responseData }
        );
    }

    // 500 - Internal Server Error
    if (status >= 500) {
        return new CustomerError(
            'Service temporarily unavailable',
            CustomerErrorCodes.SERVICE_UNAVAILABLE,
            { operation, status, responseData }
        );
    }

    // Generic error
    return new CustomerError(
        responseData.message || error.message || 'Unknown error occurred',
        CustomerErrorCodes.BACKEND_API_ERROR,
        { operation, status, responseData }
    );
}

/**
 * Parse FileMaker bridge errors
 * @param {Error} error - FileMaker error
 * @param {string} operation - Operation being performed
 * @returns {CustomerError} Classified error
 */
export function parseFileMakerError(error, operation = 'unknown') {
    const message = error.message || String(error);

    if (message.includes('bridge not available') || message.includes('FileMaker not found')) {
        return new CustomerError(
            'FileMaker connection not available',
            CustomerErrorCodes.FILEMAKER_BRIDGE_ERROR,
            { operation, originalError: message }
        );
    }

    if (message.includes('script')) {
        return new CustomerError(
            'FileMaker script execution failed',
            CustomerErrorCodes.FILEMAKER_SCRIPT_ERROR,
            { operation, originalError: message }
        );
    }

    if (message.includes('layout')) {
        return new CustomerError(
            'FileMaker layout error',
            CustomerErrorCodes.FILEMAKER_LAYOUT_ERROR,
            { operation, originalError: message }
        );
    }

    return new CustomerError(
        `FileMaker error during ${operation}`,
        CustomerErrorCodes.FILEMAKER_BRIDGE_ERROR,
        { operation, originalError: message }
    );
}

/**
 * Parse validation errors
 * @param {Object} validationResult - Validation result from customerService
 * @param {string} operation - Operation being performed
 * @returns {CustomerError} Validation error
 */
export function parseValidationError(validationResult, operation = 'unknown') {
    const errors = validationResult.errors || [];

    // Check for specific validation error types
    const emailError = errors.find(err => err.includes('email'));
    if (emailError) {
        return new CustomerError(
            emailError,
            CustomerErrorCodes.INVALID_EMAIL_FORMAT,
            { operation, validationErrors: errors }
        );
    }

    const phoneError = errors.find(err => err.includes('phone'));
    if (phoneError) {
        return new CustomerError(
            phoneError,
            CustomerErrorCodes.INVALID_PHONE_FORMAT,
            { operation, validationErrors: errors }
        );
    }

    const requiredError = errors.find(err => err.includes('required'));
    if (requiredError) {
        return new CustomerError(
            requiredError,
            CustomerErrorCodes.REQUIRED_FIELD_MISSING,
            { operation, validationErrors: errors }
        );
    }

    return new CustomerError(
        errors[0] || 'Validation failed',
        CustomerErrorCodes.VALIDATION_ERROR,
        { operation, validationErrors: errors }
    );
}

/**
 * Check for organization scoping errors
 * @param {Object} env - Environment context
 * @param {string} operation - Operation being performed
 * @throws {CustomerError} If organization scope is missing
 */
export function checkOrganizationScope(env, operation = 'unknown') {
    if (env.type === 'webapp') {
        if (!env.authentication?.user?.supabaseOrgID) {
            throw new CustomerError(
                'Organization context is required but not found',
                CustomerErrorCodes.ORG_SCOPE_MISSING,
                { operation, environment: env.type }
            );
        }
    }
}

/**
 * Wrap async customer operations with comprehensive error handling
 * @param {Function} operation - Async operation to execute
 * @param {string} operationName - Name of the operation
 * @param {Object} context - Additional context
 * @returns {Promise<any>} Operation result
 */
export async function withErrorHandling(operation, operationName, context = {}) {
    try {
        return await operation();
    } catch (error) {
        // If already a CustomerError, re-throw
        if (error instanceof CustomerError) {
            console.error(`[CustomerError] ${operationName}:`, error);
            throw error;
        }

        // Check if it's an HTTP error (axios error)
        if (error.response || error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
            const parsedError = parseHttpError(error, operationName);
            console.error(`[CustomerError] ${operationName}:`, parsedError);
            throw parsedError;
        }

        // Check if it's a FileMaker error
        if (error.message?.includes('FileMaker') || error.message?.includes('bridge')) {
            const parsedError = parseFileMakerError(error, operationName);
            console.error(`[CustomerError] ${operationName}:`, parsedError);
            throw parsedError;
        }

        // Generic error
        const genericError = new CustomerError(
            error.message || 'Unknown error occurred',
            CustomerErrorCodes.BACKEND_API_ERROR,
            { operation: operationName, originalError: error.message, context }
        );
        console.error(`[CustomerError] ${operationName}:`, genericError);
        throw genericError;
    }
}

/**
 * Format error for display in UI
 * @param {Error} error - Error object
 * @returns {Object} Formatted error for UI
 */
export function formatErrorForUI(error) {
    if (error instanceof CustomerError) {
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
        CustomerErrorCodes.NETWORK_ERROR,
        CustomerErrorCodes.TIMEOUT_ERROR,
        CustomerErrorCodes.CONNECTION_ERROR,
        CustomerErrorCodes.SERVICE_UNAVAILABLE
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
        CustomerErrorCodes.DUPLICATE_CUSTOMER,
        CustomerErrorCodes.NOT_FOUND
    ];

    const errorSeverity = [
        CustomerErrorCodes.AUTH_FAILED,
        CustomerErrorCodes.PERMISSION_DENIED,
        CustomerErrorCodes.SERVICE_UNAVAILABLE
    ];

    if (warningSeverity.includes(code)) return 'warning';
    if (errorSeverity.includes(code)) return 'error';

    return 'error'; // Default severity
}
