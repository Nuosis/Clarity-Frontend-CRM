# Debug Mode - Project-Specific Rules

## Environment Detection Issues
- Check `isFileMakerEnvironment()` in src/api/fileMaker.js if API calls fail
- FileMaker bridge may not initialize immediately - check `bridgeInitialized` flag
- Backend API requires HMAC auth - verify `VITE_SECRET_KEY` is set in environment

## Common Failure Points
- CREATE/UPDATE to backend: Data MUST be wrapped in `{ fields: data }` object
- FileMaker layouts require `dev` prefix (devCustomers, NOT Customers)
- Server status check: Use `curl -s -o /dev/null -w "%{http_code}" http://localhost:1235`
- Journey test hanging: Exit 0 with no output = UI waiting for user input (forbidden)

## Auth Debugging
- Backend auth format: `Bearer {signature}.{timestamp}`
- HMAC signature calculated from payload + timestamp
- Check `generateBackendAuthHeader()` in src/api/fileMaker.js for implementation
- 403 errors: Usually wrong auth format or missing `{ fields: data }` wrapper

## FileMaker Bridge Debugging
- Check browser console for `[FileMaker Bridge]` messages
- Verify `window.FileMaker.PerformScript` or `FMGofer.PerformScript` exists
- Bridge initialization logged with timestamp and stack trace
- Response format differs between FileMaker native and backend API (lines 189-208)