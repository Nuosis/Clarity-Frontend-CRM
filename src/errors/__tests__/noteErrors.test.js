/**
 * Note Error Handling Tests
 */

jest.mock('../../services', () => {
    class ServiceError extends Error {
        constructor(message, code, details = {}) {
            super(message);
            this.name = 'ServiceError';
            this.code = code;
            this.details = details;
        }
    }

    return {
        ServiceError,
        ErrorCodes: {
            VALIDATION_ERROR: 'VALIDATION_ERROR',
            PROCESSING_ERROR: 'PROCESSING_ERROR',
            INVALID_DATA: 'INVALID_DATA',
            CALCULATION_ERROR: 'CALCULATION_ERROR'
        }
    };
});

import {
    NoteError,
    NoteErrorCodes,
    parseHttpError,
    checkOrganizationScope,
    withErrorHandling
} from '../noteErrors';

describe('NoteError', () => {
    it('should create a NoteError with correct properties', () => {
        const error = new NoteError(
            'Test error message',
            NoteErrorCodes.AUTH_FAILED,
            { noteId: '123' }
        );

        expect(error.name).toBe('NoteError');
        expect(error.message).toBe('Test error message');
        expect(error.code).toBe(NoteErrorCodes.AUTH_FAILED);
        expect(error.details).toEqual({ noteId: '123' });
        expect(error.userFriendlyMessage).toBe('Authentication failed. Please sign in again.');
        expect(error.timestamp).toBeDefined();
    });
});

describe('parseHttpError', () => {
    it('should parse 401 authentication error', () => {
        const axiosError = {
            response: {
                status: 401,
                data: {
                    message: 'Authentication token expired'
                }
            }
        };

        const error = parseHttpError(axiosError, 'fetchNotes');
        expect(error).toBeInstanceOf(NoteError);
        expect(error.code).toBe(NoteErrorCodes.AUTH_TOKEN_EXPIRED);
    });

    it('should parse 403 permission denied error', () => {
        const axiosError = {
            response: {
                status: 403,
                data: {
                    message: 'Permission denied'
                }
            }
        };

        const error = parseHttpError(axiosError, 'updateNote');
        expect(error).toBeInstanceOf(NoteError);
        expect(error.code).toBe(NoteErrorCodes.PERMISSION_DENIED);
    });

    it('should parse 404 not found error', () => {
        const axiosError = {
            response: {
                status: 404,
                data: {
                    message: 'Note not found'
                }
            }
        };

        const error = parseHttpError(axiosError, 'fetchNoteById');
        expect(error).toBeInstanceOf(NoteError);
        expect(error.code).toBe(NoteErrorCodes.NOT_FOUND);
    });

    it('should parse 400 validation error with required field', () => {
        const axiosError = {
            response: {
                status: 400,
                data: {
                    message: 'Invalid request data',
                    errors: ['Note content is required']
                }
            }
        };

        const error = parseHttpError(axiosError, 'createNote');
        expect(error).toBeInstanceOf(NoteError);
        expect(error.code).toBe(NoteErrorCodes.REQUIRED_FIELD_MISSING);
        expect(error.details.validationErrors).toEqual(['Note content is required']);
    });

    it('should parse network timeout error', () => {
        const axiosError = {
            code: 'ECONNABORTED',
            message: 'Request timeout'
        };

        const error = parseHttpError(axiosError, 'fetchNotes');
        expect(error).toBeInstanceOf(NoteError);
        expect(error.code).toBe(NoteErrorCodes.TIMEOUT_ERROR);
    });
});

describe('checkOrganizationScope', () => {
    it('should throw NoteError when organization scope is missing', () => {
        expect(() => checkOrganizationScope({ authentication: {} }, 'fetchNotes')).toThrow(NoteError);
    });
});

describe('withErrorHandling', () => {
    it('should wrap generic errors with NoteError', async () => {
        await expect(
            withErrorHandling(async () => {
                throw new Error('Something went wrong');
            }, 'fetchNotes')
        ).rejects.toMatchObject({ code: NoteErrorCodes.BACKEND_API_ERROR });
    });
});
