/**
 * Error handling utilities
 * Exports customer, note, and project error handling
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

export {
    ProjectError,
    ProjectErrorCodes,
    parseHttpError as parseProjectHttpError,
    checkOrganizationScope as checkProjectOrganizationScope,
    withErrorHandling as withProjectErrorHandling,
    formatErrorForUI as formatProjectErrorForUI
} from './projectErrors';
