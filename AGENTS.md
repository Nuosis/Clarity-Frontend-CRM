# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Build & Test Commands
- `npm test` - Run Jest tests (requires jsdom environment, transforms jspdf packages)
- `npm run build:upload` or `npm run deploy-to-fm` - Build and deploy to FileMaker via widget.config
- Dev server runs on port 1235 (not 3000) - check with `curl -s -o /dev/null -w "%{http_code}" http://localhost:1235`
- Single test file: `npm test -- path/to/test.js`

## Critical Non-Obvious Patterns

### Migration Status: FileMaker → Supabase
- **NEW FEATURES**: Use Supabase directly (configured in src/config.js)
- **LEGACY**: FileMaker integration still exists for backward compatibility
- Dual environment architecture: FileMaker WebViewer AND standalone web app
- `src/api/fileMaker.js` auto-detects environment via `isFileMakerEnvironment()`
- FileMaker mode: Uses `FMGofer.PerformScript()` or `window.FileMaker.PerformScript()`
- Web app mode: Routes through backend API at `https://api.claritybusinesssolutions.ca`
- Backend auth uses HMAC-SHA256 with `VITE_SECRET_KEY` (see `generateBackendAuthHeader()`)

### State Management Violation
- **CRITICAL**: Project uses custom hooks for data fetching (src/hooks/useCustomer.js, etc.) despite Redux being configured
- This VIOLATES stated guidelines in .roo/rules/code.yaml which mandate Redux Toolkit for ALL shared state
- Only 3 Redux slices exist (proposals, proposalViewer, documentation) - rest uses hooks pattern
- When adding new features: Follow EXISTING hook pattern for consistency, NOT the documented Redux pattern

### FileMaker Integration Gotchas
- Jest config MUST exclude jspdf from transformIgnorePatterns or tests fail
- Vite builds to single-file bundle via `vite-plugin-singlefile` for FileMaker deployment
- Upload script uses `fmp://` protocol to trigger FileMaker import (scripts/upload.js)
- Backend API wraps data in `{ fields: data }` for CREATE/UPDATE, not raw data

### Testing Server Status
- NEVER use `npm run dev` to check if server is running
- Use: `curl -s -o /dev/null -w "%{http_code}" http://localhost:1235`
- Exit code 0 with no output in journey tests = UI hung waiting for user input (forbidden)

### API Proxy Configuration
- Vite proxies `/api` to `https://api.claritybusinesssolutions.ca` in dev mode
- Backend expects HMAC auth header format: `Bearer {signature}.{timestamp}`
- FileMaker layouts use `dev` prefix (devCustomers, devProjects, devTasks, dapiRecords)

### Context Files
- Directories with `roo.md` files contain critical context - MUST read before editing files in that directory
- Check for `roo.md` in parent directories when working with any file