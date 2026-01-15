/**
 * Verification script for customer error handling
 * Runs basic tests to ensure error handling works correctly
 */

// Mock import.meta.env for Node.js environment
global.crypto = require('crypto').webcrypto;

// Test CustomerError class
console.log('Testing CustomerError class...');
const { CustomerError, CustomerErrorCodes } = require('./src/errors/customerErrors.js');

const error1 = new CustomerError(
    'Test error',
    CustomerErrorCodes.AUTH_FAILED,
    { userId: '123' }
);

console.assert(error1.name === 'CustomerError', 'Error name should be CustomerError');
console.assert(error1.code === CustomerErrorCodes.AUTH_FAILED, 'Error code should match');
console.assert(error1.userFriendlyMessage.includes('Authentication'), 'Should have user-friendly message');
console.log('✓ CustomerError class works correctly\n');

// Test parseHttpError
console.log('Testing parseHttpError...');
const { parseHttpError } = require('./src/errors/customerErrors.js');

const axiosError401 = {
    response: {
        status: 401,
        data: { message: 'Token expired' }
    }
};

const parsedError = parseHttpError(axiosError401, 'fetchCustomers');
console.assert(parsedError instanceof CustomerError, 'Should return CustomerError instance');
console.assert(parsedError.code === CustomerErrorCodes.AUTH_TOKEN_EXPIRED, 'Should parse 401 as token expired');
console.log('✓ HTTP 401 error parsed correctly');

const axiosError403 = {
    response: {
        status: 403,
        data: { message: 'Permission denied' }
    }
};

const parsedError403 = parseHttpError(axiosError403, 'updateCustomer');
console.assert(parsedError403.code === CustomerErrorCodes.PERMISSION_DENIED, 'Should parse 403 as permission denied');
console.log('✓ HTTP 403 error parsed correctly');

const axiosError404 = {
    response: {
        status: 404,
        data: { message: 'Customer not found' }
    }
};

const parsedError404 = parseHttpError(axiosError404, 'fetchCustomerById');
console.assert(parsedError404.code === CustomerErrorCodes.NOT_FOUND, 'Should parse 404 as not found');
console.log('✓ HTTP 404 error parsed correctly');

const networkError = {
    code: 'ERR_NETWORK',
    message: 'Network Error'
};

const parsedNetworkError = parseHttpError(networkError, 'fetchCustomers');
console.assert(parsedNetworkError.code === CustomerErrorCodes.NETWORK_ERROR, 'Should parse network error');
console.log('✓ Network error parsed correctly\n');

// Test parseFileMakerError
console.log('Testing parseFileMakerError...');
const { parseFileMakerError } = require('./src/errors/customerErrors.js');

const fmError = new Error('FileMaker bridge not available');
const parsedFmError = parseFileMakerError(fmError, 'fetchCustomers');
console.assert(parsedFmError.code === CustomerErrorCodes.FILEMAKER_BRIDGE_ERROR, 'Should parse FileMaker error');
console.log('✓ FileMaker error parsed correctly\n');

// Test parseValidationError
console.log('Testing parseValidationError...');
const { parseValidationError } = require('./src/errors/customerErrors.js');

const validationResult = {
    isValid: false,
    errors: ['Invalid email format']
};

const parsedValidationError = parseValidationError(validationResult, 'createCustomer');
console.assert(parsedValidationError.code === CustomerErrorCodes.INVALID_EMAIL_FORMAT, 'Should parse email validation error');
console.log('✓ Validation error parsed correctly\n');

// Test formatErrorForUI
console.log('Testing formatErrorForUI...');
const { formatErrorForUI } = require('./src/errors/customerErrors.js');

const uiError = new CustomerError('Test', CustomerErrorCodes.NETWORK_ERROR);
const formatted = formatErrorForUI(uiError);

console.assert(formatted.title === 'Connection Error', 'Should have correct title');
console.assert(formatted.canRetry === true, 'Network errors should be retryable');
console.assert(formatted.severity === 'error', 'Should have severity');
console.log('✓ Error formatting works correctly\n');

// Test withErrorHandling
console.log('Testing withErrorHandling...');
const { withErrorHandling } = require('./src/errors/customerErrors.js');

(async () => {
    // Test successful operation
    const successOperation = async () => ({ success: true });
    const result = await withErrorHandling(successOperation, 'testOp');
    console.assert(result.success === true, 'Should execute successfully');
    console.log('✓ Successful operation handled correctly');

    // Test error wrapping
    try {
        const failOperation = async () => { throw new Error('Generic error'); };
        await withErrorHandling(failOperation, 'testOp');
        console.assert(false, 'Should have thrown error');
    } catch (err) {
        console.assert(err instanceof CustomerError, 'Should wrap generic errors');
        console.log('✓ Generic error wrapped correctly');
    }

    // Test CustomerError passthrough
    try {
        const customerErrorOp = async () => {
            throw new CustomerError('Test', CustomerErrorCodes.AUTH_FAILED);
        };
        await withErrorHandling(customerErrorOp, 'testOp');
        console.assert(false, 'Should have thrown error');
    } catch (err) {
        console.assert(err instanceof CustomerError, 'Should pass through CustomerError');
        console.assert(err.code === CustomerErrorCodes.AUTH_FAILED, 'Should preserve error code');
        console.log('✓ CustomerError passed through correctly\n');
    }

    console.log('✅ All error handling tests passed!');
})();
