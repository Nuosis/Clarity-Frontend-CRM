/**
 * Customer Error Handling Tests
 */

import {
    CustomerError,
    CustomerErrorCodes,
    parseHttpError,
    parseFileMakerError,
    parseValidationError,
    formatErrorForUI,
    checkOrganizationScope,
    withErrorHandling
} from '../customerErrors';

describe('CustomerError', () => {
    it('should create a CustomerError with correct properties', () => {
        const error = new CustomerError(
            'Test error message',
            CustomerErrorCodes.AUTH_FAILED,
            { customerId: '123' }
        );

        expect(error.name).toBe('CustomerError');
        expect(error.message).toBe('Test error message');
        expect(error.code).toBe(CustomerErrorCodes.AUTH_FAILED);
        expect(error.details).toEqual({ customerId: '123' });
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

        const error = parseHttpError(axiosError, 'fetchCustomers');
        expect(error).toBeInstanceOf(CustomerError);
        expect(error.code).toBe(CustomerErrorCodes.AUTH_TOKEN_EXPIRED);
        expect(error.userFriendlyMessage).toContain('session has expired');
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

        const error = parseHttpError(axiosError, 'updateCustomer');
        expect(error).toBeInstanceOf(CustomerError);
        expect(error.code).toBe(CustomerErrorCodes.PERMISSION_DENIED);
    });

    it('should parse 404 not found error', () => {
        const axiosError = {
            response: {
                status: 404,
                data: {
                    message: 'Customer not found'
                }
            }
        };

        const error = parseHttpError(axiosError, 'fetchCustomerById');
        expect(error).toBeInstanceOf(CustomerError);
        expect(error.code).toBe(CustomerErrorCodes.NOT_FOUND);
    });

    it('should parse 400 validation error', () => {
        const axiosError = {
            response: {
                status: 400,
                data: {
                    message: 'Invalid request data',
                    errors: ['Business name is required', 'Invalid email format']
                }
            }
        };

        const error = parseHttpError(axiosError, 'createCustomer');
        expect(error).toBeInstanceOf(CustomerError);
        expect(error.code).toBe(CustomerErrorCodes.INVALID_CUSTOMER_DATA);
        expect(error.details.validationErrors).toEqual(['Business name is required', 'Invalid email format']);
    });

    it('should parse network timeout error', () => {
        const axiosError = {
            code: 'ECONNABORTED',
            message: 'Request timeout'
        };

        const error = parseHttpError(axiosError, 'fetchCustomers');
        expect(error).toBeInstanceOf(CustomerError);
        expect(error.code).toBe(CustomerErrorCodes.TIMEOUT_ERROR);
    });

    it('should parse network connection error', () => {
        const axiosError = {
            code: 'ERR_NETWORK',
            message: 'Network Error'
        };

        const error = parseHttpError(axiosError, 'fetchCustomers');
        expect(error).toBeInstanceOf(CustomerError);
        expect(error.code).toBe(CustomerErrorCodes.NETWORK_ERROR);
    });

    it('should parse 500 server error', () => {
        const axiosError = {
            response: {
                status: 500,
                data: {
                    message: 'Internal server error'
                }
            }
        };

        const error = parseHttpError(axiosError, 'fetchCustomers');
        expect(error).toBeInstanceOf(CustomerError);
        expect(error.code).toBe(CustomerErrorCodes.SERVICE_UNAVAILABLE);
    });
});

describe('parseFileMakerError', () => {
    it('should parse FileMaker bridge not available error', () => {
        const fmError = new Error('FileMaker bridge not available');
        const error = parseFileMakerError(fmError, 'fetchCustomers');

        expect(error).toBeInstanceOf(CustomerError);
        expect(error.code).toBe(CustomerErrorCodes.FILEMAKER_BRIDGE_ERROR);
    });

    it('should parse FileMaker script error', () => {
        const fmError = new Error('FileMaker script execution failed');
        const error = parseFileMakerError(fmError, 'createCustomer');

        expect(error).toBeInstanceOf(CustomerError);
        expect(error.code).toBe(CustomerErrorCodes.FILEMAKER_SCRIPT_ERROR);
    });

    it('should parse FileMaker layout error', () => {
        const fmError = new Error('FileMaker layout error');
        const error = parseFileMakerError(fmError, 'updateCustomer');

        expect(error).toBeInstanceOf(CustomerError);
        expect(error.code).toBe(CustomerErrorCodes.FILEMAKER_LAYOUT_ERROR);
    });
});

describe('parseValidationError', () => {
    it('should parse email validation error', () => {
        const validationResult = {
            isValid: false,
            errors: ['Invalid email format']
        };

        const error = parseValidationError(validationResult, 'createCustomer');
        expect(error).toBeInstanceOf(CustomerError);
        expect(error.code).toBe(CustomerErrorCodes.INVALID_EMAIL_FORMAT);
    });

    it('should parse phone validation error', () => {
        const validationResult = {
            isValid: false,
            errors: ['Invalid phone format']
        };

        const error = parseValidationError(validationResult, 'updateCustomer');
        expect(error).toBeInstanceOf(CustomerError);
        expect(error.code).toBe(CustomerErrorCodes.INVALID_PHONE_FORMAT);
    });

    it('should parse required field error', () => {
        const validationResult = {
            isValid: false,
            errors: ['Business name is required']
        };

        const error = parseValidationError(validationResult, 'createCustomer');
        expect(error).toBeInstanceOf(CustomerError);
        expect(error.code).toBe(CustomerErrorCodes.REQUIRED_FIELD_MISSING);
    });

    it('should parse generic validation error', () => {
        const validationResult = {
            isValid: false,
            errors: ['Some validation error']
        };

        const error = parseValidationError(validationResult, 'updateCustomer');
        expect(error).toBeInstanceOf(CustomerError);
        expect(error.code).toBe(CustomerErrorCodes.VALIDATION_ERROR);
    });
});

describe('checkOrganizationScope', () => {
    it('should throw error if organization scope is missing in webapp environment', () => {
        const env = {
            type: 'webapp',
            authentication: {
                user: {}
            }
        };

        expect(() => {
            checkOrganizationScope(env, 'fetchCustomers');
        }).toThrow(CustomerError);

        expect(() => {
            checkOrganizationScope(env, 'fetchCustomers');
        }).toThrow('Organization context is required but not found');
    });

    it('should not throw error if organization scope exists', () => {
        const env = {
            type: 'webapp',
            authentication: {
                user: {
                    supabaseOrgID: 'org-123'
                }
            }
        };

        expect(() => {
            checkOrganizationScope(env, 'fetchCustomers');
        }).not.toThrow();
    });

    it('should not check organization scope for filemaker environment', () => {
        const env = {
            type: 'filemaker'
        };

        expect(() => {
            checkOrganizationScope(env, 'fetchCustomers');
        }).not.toThrow();
    });
});

describe('withErrorHandling', () => {
    it('should execute operation successfully', async () => {
        const operation = jest.fn().mockResolvedValue({ success: true });
        const result = await withErrorHandling(operation, 'testOperation');

        expect(result).toEqual({ success: true });
        expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should catch and wrap generic errors', async () => {
        const operation = jest.fn().mockRejectedValue(new Error('Generic error'));

        await expect(
            withErrorHandling(operation, 'testOperation')
        ).rejects.toThrow(CustomerError);
    });

    it('should re-throw CustomerError without wrapping', async () => {
        const customerError = new CustomerError('Test error', CustomerErrorCodes.AUTH_FAILED);
        const operation = jest.fn().mockRejectedValue(customerError);

        await expect(
            withErrorHandling(operation, 'testOperation')
        ).rejects.toBe(customerError);
    });

    it('should handle HTTP errors', async () => {
        const axiosError = {
            response: {
                status: 404,
                data: { message: 'Not found' }
            }
        };
        const operation = jest.fn().mockRejectedValue(axiosError);

        await expect(
            withErrorHandling(operation, 'testOperation')
        ).rejects.toThrow(CustomerError);
    });

    it('should handle FileMaker errors', async () => {
        const fmError = new Error('FileMaker bridge not available');
        const operation = jest.fn().mockRejectedValue(fmError);

        await expect(
            withErrorHandling(operation, 'testOperation')
        ).rejects.toThrow(CustomerError);
    });
});

describe('formatErrorForUI', () => {
    it('should format CustomerError for UI', () => {
        const error = new CustomerError(
            'Test error',
            CustomerErrorCodes.NETWORK_ERROR,
            { customerId: '123' }
        );

        const formatted = formatErrorForUI(error);

        expect(formatted).toMatchObject({
            title: 'Connection Error',
            message: error.userFriendlyMessage,
            code: CustomerErrorCodes.NETWORK_ERROR,
            canRetry: true,
            severity: 'error'
        });
    });

    it('should format generic Error for UI', () => {
        const error = new Error('Generic error message');
        const formatted = formatErrorForUI(error);

        expect(formatted).toMatchObject({
            title: 'Error',
            message: 'Generic error message',
            code: 'UNKNOWN_ERROR',
            canRetry: true,
            severity: 'error'
        });
    });

    it('should identify retryable errors', () => {
        const networkError = new CustomerError(
            'Network error',
            CustomerErrorCodes.NETWORK_ERROR
        );
        const authError = new CustomerError(
            'Auth error',
            CustomerErrorCodes.AUTH_FAILED
        );

        const networkFormatted = formatErrorForUI(networkError);
        const authFormatted = formatErrorForUI(authError);

        expect(networkFormatted.canRetry).toBe(true);
        expect(authFormatted.canRetry).toBe(false);
    });
});
