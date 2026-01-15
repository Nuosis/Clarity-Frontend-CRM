# Backend Issue Report: Links API

**Date**: 2026-01-15
**Reporter**: Claude (TSK0001 verification)
**Severity**: High
**Status**: Requires Backend Team Action

## Issue Summary

The backend `/links` POST endpoint returns **500 Internal Server Error** when attempting to create links using HMAC authentication. This blocks the ability to create links from the frontend.

## Reproduction Steps

### Request Details

**Endpoint**: `POST https://api.claritybusinesssolutions.ca/links`

**Headers**:
```
Content-Type: application/json
Authorization: Bearer {hmac_signature}.{timestamp}
X-Organization-ID: 9816c057-b5d3-43a2-848f-99365ee6255e
```

**Body** (Attempt 1 - with project_id):
```json
{
  "project_id": "0F9B8AE8-A6E4-4CCB-AA61-A63C6AB55009",
  "link": "https://github.com/test/repo"
}
```

**Body** (Attempt 2 - with organization_id):
```json
{
  "organization_id": "9816c057-b5d3-43a2-848f-99365ee6255e",
  "link": "https://example.com/test"
}
```

### Response

**Status Code**: 500

**Body**:
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Internal server error",
    "details": null
  }
}
```

## Observations

1. ✅ **Authentication is working**: HMAC signature is accepted (no 401/403 errors)
2. ✅ **Endpoint exists**: No 404 error, the route is registered
3. ❌ **Internal processing fails**: Something in the backend logic is failing
4. ℹ️ **No detailed error**: The `details` field is `null`, making debugging difficult

## Expected Behavior

Based on OpenAPI schema, the endpoint should:
1. Accept the request with valid HMAC auth
2. Extract organization context from the `X-Organization-ID` header
3. Create a new link record in the database
4. Return 201 Created with the LinkResponse object

## Possible Root Causes

1. **Organization Context Extraction**:
   - Backend may not be extracting org ID from HMAC requests properly
   - RLS policies may require JWT claims instead of header

2. **Database Constraints**:
   - Foreign key validation on `project_id` or `organization_id` may be failing
   - Organization scoping constraint may not handle HMAC requests

3. **Missing Dependencies**:
   - Backend may expect additional fields or relationships
   - Validation logic may be incorrectly configured

4. **Code Bug**:
   - Unhandled exception in link creation logic
   - Database query error not being caught properly

## Additional Context

### OpenAPI Schema

**LinkCreate**:
```json
{
  "properties": {
    "project_id": "string (uuid) | null",
    "customer_id": "string (uuid) | null",
    "organization_id": "string (uuid) | null",
    "task_id": "string (uuid) | null",
    "link": "string (max 2048)"
  },
  "required": ["link"]
}
```

### Authentication Methods

Per OpenAPI spec, POST /links accepts:
- `SharedSecretBearer` (HMAC) ← Currently failing
- `HTTPBearer` (JWT) ← Not tested yet

**Note**: GET /links only accepts `HTTPBearer`, not HMAC.

## Impact

- **Frontend Development**: Can proceed with implementation but cannot fully test
- **User Experience**: Link creation feature will not work until fixed
- **Workaround**: May be able to use JWT instead of HMAC, but this wasn't tested

## Recommended Actions

1. **Backend Team**:
   - Review server logs for the 500 error stack trace
   - Check organization context extraction from HMAC requests
   - Verify database constraints and foreign keys
   - Add detailed error messages to the `details` field
   - Test with both HMAC and JWT authentication

2. **Frontend Team**:
   - Proceed with implementation using documented schema
   - Plan to use JWT (from Supabase) instead of HMAC for consistency
   - Implement error handling for 500 errors
   - Re-test once backend issue is resolved

## Testing Script

A Node.js test script has been created: `test-links-endpoints.js`

Run with: `node test-links-endpoints.js`

This script tests all CRUD endpoints with HMAC authentication and provides detailed output.

## Related Files

- **Test Script**: `test-links-endpoints.js`
- **Detailed Results**: `.devflow/tasks/links-backend-integration/TSK0001-verification-results.md`
- **Task Definition**: `.devflow/tasks/links-backend-integration/tasks.json` (TSK0001)
