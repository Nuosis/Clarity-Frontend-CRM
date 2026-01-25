/**
 * Error handling utilities
 * Exports customer, note, project, and link error handling
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
    withErrorHandling as withNoteErrorHandling,
    formatErrorForUI as formatNoteErrorForUI
} from './noteErrors';

export {
    ProjectError,
    ProjectErrorCodes,
    parseHttpError as parseProjectHttpError,
    checkOrganizationScope as checkProjectOrganizationScope,
    withErrorHandling as withProjectErrorHandling,
    formatErrorForUI as formatProjectErrorForUI
} from './projectErrors';

export {
    LinkError,
    LinkErrorCodes,
    parseHttpError as parseLinkHttpError,
    parseValidationError as parseLinkValidationError,
    checkOrganizationScope as checkLinkOrganizationScope,
    withErrorHandling as withLinkErrorHandling,
    formatErrorForUI as formatLinkErrorForUI
} from './linkErrors';
