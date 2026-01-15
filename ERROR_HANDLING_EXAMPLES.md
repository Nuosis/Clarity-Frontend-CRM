# Customer Error Handling - Usage Examples

## Overview
This document provides practical examples of how the comprehensive error handling system works in different scenarios.

## Example 1: Authentication Token Expired (401)

### Scenario
User's JWT token expires while browsing customers.

### API Response
```json
{
  "status": 401,
  "data": {
    "message": "Authentication token expired"
  }
}
```

### Error Handling Flow
1. API call to `fetchCustomers()` fails with 401
2. `withErrorHandling` catches the error
3. `parseHttpError` classifies it as `AUTH_TOKEN_EXPIRED`
4. `CustomerError` created with user-friendly message
5. `setErrorWithFormatting` in hook formats for UI
6. Component receives `formattedError`:

```javascript
{
  title: "Authentication Error",
  message: "Your session has expired. Please sign in again.",
  code: "CUSTOMER_AUTH_TOKEN_EXPIRED",
  timestamp: "2026-01-15T10:30:00.000Z",
  canRetry: false,
  severity: "error",
  details: {
    operation: "fetchCustomers",
    status: 401,
    responseData: { message: "Authentication token expired" }
  }
}
```

### UI Response
```javascript
if (formattedError?.code === CustomerErrorCodes.AUTH_TOKEN_EXPIRED) {
  // Redirect to login page
  navigate('/login');
}
```

## Example 2: Network Timeout

### Scenario
API request takes too long and times out.

### Error
```javascript
{
  code: 'ECONNABORTED',
  message: 'timeout of 30000ms exceeded'
}
```

### Error Handling Flow
1. API call times out after 30 seconds
2. `withErrorHandling` catches timeout error
3. `parseHttpError` detects `ECONNABORTED` code
4. Classifies as `TIMEOUT_ERROR`
5. Component receives `formattedError`:

```javascript
{
  title: "Connection Error",
  message: "Request timed out. Please try again.",
  code: "CUSTOMER_TIMEOUT_ERROR",
  timestamp: "2026-01-15T10:30:00.000Z",
  canRetry: true,  // User can retry
  severity: "error",
  details: {
    operation: "fetchCustomers",
    originalError: "timeout of 30000ms exceeded"
  }
}
```

### UI Response
```javascript
if (formattedError?.canRetry) {
  return (
    <div className="error-message">
      <p>{formattedError.message}</p>
      <button onClick={() => loadCustomers()}>
        Retry
      </button>
    </div>
  );
}
```

## Example 3: Validation Error (400)

### Scenario
User tries to create customer with invalid email.

### API Response
```json
{
  "status": 400,
  "data": {
    "message": "Invalid request data",
    "errors": [
      "Business name is required",
      "Invalid email format at position 1"
    ]
  }
}
```

### Error Handling Flow
1. `createCustomer()` fails with 400
2. `withErrorHandling` catches the error
3. `parseHttpError` extracts validation errors
4. Classifies as `INVALID_CUSTOMER_DATA`
5. Component receives `formattedError`:

```javascript
{
  title: "Validation Error",
  message: "Invalid customer data provided.",
  code: "CUSTOMER_INVALID_DATA",
  timestamp: "2026-01-15T10:30:00.000Z",
  canRetry: false,
  severity: "error",
  details: {
    operation: "createCustomer",
    status: 400,
    validationErrors: [
      "Business name is required",
      "Invalid email format at position 1"
    ]
  }
}
```

### UI Response
```javascript
if (formattedError?.details?.validationErrors) {
  return (
    <div className="validation-errors">
      <h4>Please fix the following errors:</h4>
      <ul>
        {formattedError.details.validationErrors.map((error, i) => (
          <li key={i}>{error}</li>
        ))}
      </ul>
    </div>
  );
}
```

## Example 4: Permission Denied (403)

### Scenario
User tries to delete a customer without permission.

### API Response
```json
{
  "status": 403,
  "data": {
    "message": "Permission denied: insufficient privileges"
  }
}
```

### Error Handling Flow
1. `deleteCustomer()` fails with 403
2. `withErrorHandling` catches the error
3. `parseHttpError` classifies as `PERMISSION_DENIED`
4. Component receives `formattedError`:

```javascript
{
  title: "Permission Denied",
  message: "You do not have permission to perform this action.",
  code: "CUSTOMER_PERMISSION_DENIED",
  timestamp: "2026-01-15T10:30:00.000Z",
  canRetry: false,
  severity: "error",
  details: {
    operation: "deleteCustomer",
    status: 403,
    responseData: {
      message: "Permission denied: insufficient privileges"
    }
  }
}
```

### UI Response
```javascript
if (formattedError?.code === CustomerErrorCodes.PERMISSION_DENIED) {
  return (
    <Alert severity="error">
      {formattedError.message}
      <br />
      Please contact your administrator for access.
    </Alert>
  );
}
```

## Example 5: Customer Not Found (404)

### Scenario
User tries to view a customer that doesn't exist.

### API Response
```json
{
  "status": 404,
  "data": {
    "message": "Customer with id 12345 not found"
  }
}
```

### Error Handling Flow
1. `fetchCustomerById('12345')` fails with 404
2. `withErrorHandling` catches the error
3. `parseHttpError` classifies as `NOT_FOUND`
4. Component receives `formattedError`:

```javascript
{
  title: "Not Found",
  message: "Customer 12345 not found.",
  code: "CUSTOMER_NOT_FOUND",
  timestamp: "2026-01-15T10:30:00.000Z",
  canRetry: false,
  severity: "warning",
  details: {
    operation: "fetchCustomerById",
    status: 404,
    responseData: {
      message: "Customer with id 12345 not found"
    },
    customerId: "12345"
  }
}
```

### UI Response
```javascript
if (formattedError?.code === CustomerErrorCodes.NOT_FOUND) {
  return (
    <div className="not-found-message">
      <p>{formattedError.message}</p>
      <button onClick={() => navigate('/customers')}>
        Back to Customer List
      </button>
    </div>
  );
}
```

## Example 6: Organization Context Missing

### Scenario
User's session doesn't have organization ID (edge case).

### Error Handling Flow
1. `checkOrganizationScope()` called in API layer
2. No `supabaseOrgID` found in user context
3. Throws `CustomerError` with `ORG_SCOPE_MISSING`
4. Component receives `formattedError`:

```javascript
{
  title: "Error",
  message: "Organization context is missing. Please refresh the page.",
  code: "CUSTOMER_ORG_SCOPE_MISSING",
  timestamp: "2026-01-15T10:30:00.000Z",
  canRetry: false,
  severity: "error",
  details: {
    operation: "fetchCustomers",
    environment: "webapp"
  }
}
```

### UI Response
```javascript
if (formattedError?.code === CustomerErrorCodes.ORG_SCOPE_MISSING) {
  return (
    <div className="error-message">
      <p>{formattedError.message}</p>
      <button onClick={() => window.location.reload()}>
        Refresh Page
      </button>
    </div>
  );
}
```

## Example 7: FileMaker Bridge Error

### Scenario
FileMaker bridge is not available (running in web app outside FileMaker).

### Error
```javascript
Error: FileMaker bridge not available
```

### Error Handling Flow
1. `fetchCustomers()` detects FileMaker environment
2. Tries to call FileMaker bridge
3. Bridge not available, throws error
4. `withErrorHandling` catches the error
5. `parseFileMakerError` classifies as `FILEMAKER_BRIDGE_ERROR`
6. Component receives `formattedError`:

```javascript
{
  title: "Error",
  message: "FileMaker connection error. Please contact support.",
  code: "CUSTOMER_FILEMAKER_BRIDGE_ERROR",
  timestamp: "2026-01-15T10:30:00.000Z",
  canRetry: false,
  severity: "error",
  details: {
    operation: "fetchCustomers",
    originalError: "FileMaker bridge not available"
  }
}
```

### UI Response
```javascript
if (formattedError?.code === CustomerErrorCodes.FILEMAKER_BRIDGE_ERROR) {
  return (
    <div className="error-message">
      <p>{formattedError.message}</p>
      <p>Please ensure you're accessing this from within FileMaker.</p>
    </div>
  );
}
```

## Example 8: Search Query Validation

### Scenario
User tries to search with empty query.

### Error Handling Flow
1. `searchCustomers('')` called with empty query
2. API validates query length
3. Throws `CustomerError` with `VALIDATION_ERROR`
4. Component receives `formattedError`:

```javascript
{
  title: "Validation Error",
  message: "Search query must be at least 1 character",
  code: "CUSTOMER_VALIDATION_ERROR",
  timestamp: "2026-01-15T10:30:00.000Z",
  canRetry: false,
  severity: "error",
  details: {
    operation: "searchCustomers",
    query: "",
    minLength: 1
  }
}
```

### UI Response
```javascript
const handleSearch = (query) => {
  try {
    handleCustomerSearch(query);
  } catch (error) {
    // Error already set in formattedError
    // Show inline validation message
  }
};

return (
  <div>
    <input
      type="text"
      value={searchQuery}
      onChange={(e) => handleSearch(e.target.value)}
    />
    {formattedError && (
      <span className="error-text">
        {formattedError.message}
      </span>
    )}
  </div>
);
```

## Example 9: Server Error with Retry (500)

### Scenario
Backend server encounters internal error.

### API Response
```json
{
  "status": 500,
  "data": {
    "message": "Internal server error"
  }
}
```

### Error Handling Flow
1. API call fails with 500
2. `withErrorHandling` catches the error
3. `parseHttpError` classifies as `SERVICE_UNAVAILABLE`
4. Marks as retryable
5. Component receives `formattedError`:

```javascript
{
  title: "Error",
  message: "Service is temporarily unavailable. Please try again later.",
  code: "CUSTOMER_SERVICE_UNAVAILABLE",
  timestamp: "2026-01-15T10:30:00.000Z",
  canRetry: true,  // Server errors are retryable
  severity: "error",
  details: {
    operation: "createCustomer",
    status: 500,
    responseData: {
      message: "Internal server error"
    }
  }
}
```

### UI Response
```javascript
const [retryCount, setRetryCount] = useState(0);

const handleRetry = async () => {
  setRetryCount(prev => prev + 1);
  clearError();
  await loadCustomers();
};

if (formattedError?.code === CustomerErrorCodes.SERVICE_UNAVAILABLE) {
  return (
    <div className="error-message">
      <p>{formattedError.message}</p>
      {formattedError.canRetry && retryCount < 3 && (
        <button onClick={handleRetry}>
          Retry {retryCount > 0 && `(Attempt ${retryCount + 1})`}
        </button>
      )}
      {retryCount >= 3 && (
        <p>Please try again later or contact support.</p>
      )}
    </div>
  );
}
```

## Example 10: Generic Error Display Component

### Complete Error Display Component

```javascript
import React from 'react';
import { CustomerErrorCodes } from '../errors/customerErrors';

function CustomerErrorDisplay({ formattedError, onRetry, onDismiss }) {
  if (!formattedError) return null;

  // Determine icon based on severity
  const getIcon = () => {
    switch (formattedError.severity) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '❌';
    }
  };

  // Determine if we should show retry button
  const showRetry = formattedError.canRetry && onRetry;

  // Determine if we should redirect to login
  const isAuthError = formattedError.code.includes('AUTH');

  return (
    <div className={`error-display severity-${formattedError.severity}`}>
      <div className="error-header">
        <span className="error-icon">{getIcon()}</span>
        <h3>{formattedError.title}</h3>
      </div>

      <div className="error-body">
        <p>{formattedError.message}</p>

        {/* Show validation errors if present */}
        {formattedError.details?.validationErrors?.length > 0 && (
          <ul className="validation-errors">
            {formattedError.details.validationErrors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        )}

        {/* Show timestamp for debugging */}
        <small className="error-timestamp">
          {new Date(formattedError.timestamp).toLocaleString()}
        </small>
      </div>

      <div className="error-actions">
        {/* Retry button for retryable errors */}
        {showRetry && (
          <button onClick={onRetry} className="btn-retry">
            Try Again
          </button>
        )}

        {/* Login redirect for auth errors */}
        {isAuthError && (
          <button
            onClick={() => window.location.href = '/login'}
            className="btn-login"
          >
            Sign In Again
          </button>
        )}

        {/* Dismiss button */}
        {onDismiss && (
          <button onClick={onDismiss} className="btn-dismiss">
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

// Usage in CustomerList component
function CustomerList() {
  const {
    customers,
    loading,
    formattedError,
    loadCustomers,
    clearError
  } = useCustomer();

  if (formattedError) {
    return (
      <CustomerErrorDisplay
        formattedError={formattedError}
        onRetry={formattedError.canRetry ? loadCustomers : null}
        onDismiss={clearError}
      />
    );
  }

  if (loading) {
    return <div>Loading customers...</div>;
  }

  return (
    <div>
      {/* Customer list UI */}
    </div>
  );
}
```

## Summary

The error handling system provides:

1. **Automatic Classification**: All errors automatically classified
2. **User-Friendly Messages**: Clear, actionable error messages
3. **Retry Logic**: System knows which errors are retryable
4. **Severity Levels**: Appropriate severity for each error type
5. **Detailed Context**: Full error details for debugging
6. **Consistent Structure**: All errors have same shape for UI
7. **Environment Aware**: Different handling for FileMaker vs Web App
8. **Validation Details**: Field-level validation error details
9. **Easy Integration**: Simple to use in components
10. **Comprehensive Coverage**: Handles all error scenarios
