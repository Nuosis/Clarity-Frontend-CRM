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

export {
    NoteError,
    NoteErrorCodes,
    parseHttpError as parseNoteHttpError,
    checkOrganizationScope as checkNoteOrganizationScope,
    withErrorHandling as withNoteErrorHandling
} from './noteErrors';
