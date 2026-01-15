/**
 * Error handling utilities
 * Exports customer error handling and can be extended for other modules
 */

export {
    CustomerError,
    CustomerErrorCodes,
    parseHttpError,
    parseFileMakerError,
    parseValidationError,
    checkOrganizationScope,
    withErrorHandling,
    formatErrorForUI
} from './customerErrors';
