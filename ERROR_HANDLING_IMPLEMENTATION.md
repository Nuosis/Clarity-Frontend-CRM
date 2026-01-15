# Customer Error Handling Implementation

## Overview

Implemented comprehensive error handling for all customer API operations, providing user-friendly error messages, automatic error classification, and retry hints.

## Implementation Summary

### 1. Error Handling Module (`src/errors/customerErrors.js`)

Created a dedicated error handling module with:

#### CustomerError Class
- Extends ServiceError
- Includes error code, details, timestamp, and user-friendly message
- Automatic message formatting based on error code

#### Error Codes (30+ codes)
- **Authentication & Authorization**: `AUTH_FAILED`, `AUTH_TOKEN_EXPIRED`, `AUTH_TOKEN_INVALID`, `PERMISSION_DENIED`, `ORG_SCOPE_MISSING`, `ORG_SCOPE_INVALID`
- **Network & Connectivity**: `NETWORK_ERROR`, `TIMEOUT_ERROR`, `CONNECTION_ERROR`, `SERVICE_UNAVAILABLE`
- **Data & Validation**: `NOT_FOUND`, `DUPLICATE_CUSTOMER`, `INVALID_CUSTOMER_DATA`, `REQUIRED_FIELD_MISSING`, `INVALID_EMAIL_FORMAT`, `INVALID_PHONE_FORMAT`
- **FileMaker Specific**: `FILEMAKER_BRIDGE_ERROR`, `FILEMAKER_SCRIPT_ERROR`, `FILEMAKER_LAYOUT_ERROR`
- **Backend API**: `BACKEND_API_ERROR`, `BACKEND_RESPONSE_INVALID`
- **Operations**: `CREATE_FAILED`, `UPDATE_FAILED`, `DELETE_FAILED`, `FETCH_FAILED`, `SEARCH_FAILED`

#### Utility Functions

1. **parseHttpError(error, operation)**
   - Parses axios/HTTP errors into CustomerError
   - Handles: 401, 403, 404, 400, 422, 409, 500, timeout, network errors
   - Extracts validation details from 400/422 responses

2. **parseFileMakerError(error, operation)**
   - Parses FileMaker bridge errors
   - Classifies bridge, script, and layout errors

3. **parseValidationError(validationResult, operation)**
   - Parses validation results from customerService
   - Identifies email, phone, and required field errors

4. **checkOrganizationScope(env, operation)**
   - Validates organization context is present for web app operations
   - Throws CustomerError if missing

5. **withErrorHandling(operation, operationName, context)**
   - Wrapper for async operations
   - Catches and classifies all errors
   - Preserves CustomerError instances
   - Wraps generic errors

6. **formatErrorForUI(error)**
   - Formats errors for UI display
   - Returns: title, message, code, timestamp, canRetry, severity
   - Identifies retryable errors

### 2. Customer API Layer Updates (`src/api/customers.js`)

Updated all customer API functions to use comprehensive error handling:

- `fetchCustomers()` - Wrapped with error handling + org scope check
- `fetchCustomerById()` - Wrapped with error handling + org scope check
- `createCustomer()` - Wrapped with error handling + org scope check
- `updateCustomer()` - Wrapped with error handling + org scope check
- `toggleCustomerStatus()` - Wrapped with error handling + org scope check
- `fetchActiveCustomers()` - Wrapped with error handling + org scope check
- `deleteCustomer()` - Wrapped with error handling + org scope check
- `searchCustomers()` - Wrapped with error handling + org scope check + query validation

Each function:
- Uses `withErrorHandling()` wrapper
- Calls `checkOrganizationScope()` for web app environment
- Provides automatic error classification
- Logs detailed error information

### 3. useCustomer Hook Updates (`src/hooks/useCustomer.js`)

Enhanced error handling in useCustomer hook:

#### New State
- `formattedError` - Formatted error object for UI consumption

#### New Helper
- `setErrorWithFormatting(err)` - Sets both error and formattedError state with proper logging

#### Updated Operations
All operations now use `setErrorWithFormatting()`:
- `loadCustomers()` - Enhanced error handling
- `handleCustomerSelect()` - Enhanced error handling
- `handleCustomerCreate()` - Uses `parseValidationError()` for validation
- `handleCustomerUpdate()` - Uses `parseValidationError()` for validation
- `handleCustomerStatusToggle()` - Enhanced error handling
- `handleCustomerDelete()` - Enhanced error handling
- `handleCustomerSearch()` - Enhanced error handling

#### Exported State
- `formattedError` - Contains:
  - `title` - Error title based on error type
  - `message` - User-friendly error message
  - `code` - Error code for programmatic handling
  - `timestamp` - When error occurred
  - `canRetry` - Boolean indicating if operation can be retried
  - `severity` - 'error' | 'warning' | 'info'
  - `details` - Additional error details

#### Updated clearError Function
Clears both `error` and `formattedError` state

### 4. Error Exports (`src/errors/index.js`)

Created index file for easy imports:
```javascript
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
```

## Error Handling Flow

### 1. API Layer Error Handling
```
API Function (e.g., fetchCustomers)
  ↓
withErrorHandling wrapper
  ↓
Check organization scope (if web app)
  ↓
Execute operation
  ↓
On error: parseHttpError / parseFileMakerError
  ↓
Throw CustomerError with code and user-friendly message
```

### 2. Hook Layer Error Handling
```
Hook operation (e.g., loadCustomers)
  ↓
Call API function
  ↓
On error: setErrorWithFormatting
  ↓
formatErrorForUI
  ↓
Set both error and formattedError state
  ↓
Component can access formattedError for display
```

## Usage Examples

### 1. Using formattedError in Components

```javascript
function CustomerList() {
    const { customers, loading, formattedError, loadCustomers } = useCustomer();

    if (formattedError) {
        return (
            <ErrorDisplay
                title={formattedError.title}
                message={formattedError.message}
                canRetry={formattedError.canRetry}
                onRetry={formattedError.canRetry ? loadCustomers : null}
                severity={formattedError.severity}
            />
        );
    }

    // ... render customers
}
```

### 2. Handling Validation Errors

```javascript
try {
    await handleCustomerCreate(customerData);
} catch (error) {
    // Error is already formatted and set in state
    // Component will re-render with formattedError
    if (error.code === CustomerErrorCodes.INVALID_EMAIL_FORMAT) {
        // Show email field error
    } else if (error.code === CustomerErrorCodes.REQUIRED_FIELD_MISSING) {
        // Show required field error
    }
}
```

### 3. Checking Error Type

```javascript
if (formattedError) {
    const isAuthError = formattedError.code.includes('AUTH');
    const isNetworkError = formattedError.code.includes('NETWORK');
    const isValidationError = formattedError.code.includes('VALIDATION');

    if (isAuthError) {
        // Redirect to login
    } else if (isNetworkError && formattedError.canRetry) {
        // Show retry button
    } else if (isValidationError) {
        // Show field-level errors
    }
}
```

## Error Message Examples

### Authentication Errors
- **401 Token Expired**: "Your session has expired. Please sign in again."
- **403 Permission Denied**: "You do not have permission to perform this action."
- **Organization Missing**: "Organization context is missing. Please refresh the page."

### Network Errors
- **Timeout**: "Request timed out. Please try again."
- **Connection Error**: "Unable to connect to the server. Please try again later."
- **Network Error**: "Network connection error. Please check your internet connection."

### Validation Errors
- **Invalid Email**: "Invalid email format. Please enter a valid email address."
- **Invalid Phone**: "Invalid phone format. Please enter a valid phone number."
- **Required Field**: "Required field missing: business_name"

### Data Errors
- **Not Found**: "Customer 123 not found."
- **Duplicate**: "A customer with this information already exists."

### Server Errors
- **500 Error**: "Service is temporarily unavailable. Please try again later."

## Testing

### Build Verification
```bash
npm run build
```
✓ Build succeeds with no compilation errors

### Manual Testing Checklist
- [ ] Test 401 authentication error
- [ ] Test 403 permission denied error
- [ ] Test 404 not found error
- [ ] Test 400 validation error
- [ ] Test network timeout
- [ ] Test connection error
- [ ] Test FileMaker bridge error
- [ ] Test validation error display
- [ ] Test retry functionality for network errors
- [ ] Test error clearing

## Benefits

1. **User-Friendly Messages**: All errors have clear, actionable messages
2. **Automatic Classification**: Errors are automatically classified by type
3. **Retry Hints**: System knows which errors are retryable
4. **Severity Levels**: Errors have appropriate severity (error/warning/info)
5. **Detailed Logging**: All errors logged with context for debugging
6. **Type Safety**: Consistent error structure across all operations
7. **Organization Scoping**: Automatic validation of organization context
8. **Environment Awareness**: Different error handling for FileMaker vs Web App
9. **Validation Details**: Validation errors include field-level details
10. **Error Recovery**: Clear paths for error recovery in UI

## Acceptance Criteria Status

✅ Handle 401 authentication errors with clear message
✅ Handle 403 authorization errors with clear message
✅ Handle 404 not found errors gracefully
✅ Handle 400 validation errors with field details
✅ Handle 500 server errors with retry option
✅ Handle network errors with offline message
✅ Log errors for debugging
✅ Display user-friendly error messages in UI

## Future Enhancements

1. **Error Recovery Actions**: Add automatic retry logic for retryable errors
2. **Error Reporting**: Send critical errors to error tracking service
3. **Offline Mode**: Enhanced offline error handling with queue
4. **Field-Level Errors**: Map validation errors to specific form fields
5. **Toast Notifications**: Display errors as toast notifications
6. **Error Analytics**: Track error patterns for monitoring
