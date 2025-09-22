# Proposal API Authentication Investigation

## Symptom
GET requests to the proposal endpoint (https://api.claritybusinesssolutions.ca/proposals/) are failing with 401 'Invalid authentication credentials' error when using HMAC-SHA256 Bearer token authentication. We know this because:
- Backend API health endpoint returns 200 (server is running)
- Generated HMAC signature using Node.js crypto with test-secret key
- Curl request with Bearer token returns 401 'Invalid authentication credentials'
- OpenAPI documentation shows SharedSecretBearer security scheme is required

## Steps to Recreate
1. Generate HMAC-SHA256 signature using Node.js crypto with timestamp and empty payload for GET request
2. Format as 'Bearer {signature}.{timestamp}'
3. Send GET request to https://api.claritybusinesssolutions.ca/proposals/ with Authorization header
4. Receive 401 'Invalid authentication credentials' response

## Attempts to Solve the Problem
- Confirmed backend API health endpoint returns 200
- Generated HMAC signature using Node.js crypto module with test-secret key
- Tested with curl command using generated Bearer token
- Reviewed frontend HMAC generation code in src/api/fileMaker.js which shows proper Web Crypto API implementation
- Backend OpenAPI documentation shows SharedSecretBearer security scheme is required for proposal endpoints

## Hypotheses

1. **Secret Key Mismatch** (Most Fundamental)
   - hypothesis: The secret key used for HMAC generation doesn't match the backend's expected secret
   - null hypothesis: The secret key matches between frontend and backend

2. **HMAC Message Format**
   - hypothesis: The message format for HMAC generation (timestamp.payload) is incorrect or inconsistent
   - null hypothesis: The message format matches backend expectations exactly

3. **Timestamp Validation**
   - hypothesis: The timestamp is outside the backend's acceptable time window (5 minutes per docs)
   - null hypothesis: The timestamp is within the acceptable time window

4. **Bearer Token Format**
   - hypothesis: The Bearer token format 'Bearer {signature}.{timestamp}' is incorrect
   - null hypothesis: The Bearer token format matches backend expectations

5. **Environment Variable Access**
   - hypothesis: VITE_SECRET_KEY environment variable is not accessible or empty in the current context
   - null hypothesis: VITE_SECRET_KEY is properly loaded and accessible

6. **Backend Authentication Middleware** (Most Dependent)
   - hypothesis: Backend authentication middleware is not properly configured or has bugs
   - null hypothesis: Backend authentication middleware is working correctly

## Investigation Plan

Following the systematic null hypothesis testing approach, I will:

1. **Test Secret Key Access**: Verify VITE_SECRET_KEY environment variable is loaded
2. **Test HMAC Generation**: Generate HMAC with known inputs and verify output
3. **Test Timestamp Validation**: Use current timestamp and verify it's within acceptable range
4. **Test Token Format**: Verify Bearer token format matches OpenAPI specification
5. **Test Backend Middleware**: Test with known working authentication if available
6. **Test Alternative Endpoints**: Try authentication against other protected endpoints

Each hypothesis will be tested with live evidence collection, not simulated testing.