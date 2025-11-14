# Ask Mode - Project-Specific Documentation Context

## Architecture Surprises
- Dual environment: FileMaker WebViewer + standalone web app (not obvious from file structure)
- State management: Custom hooks pattern used despite Redux being configured
- Only 3 Redux slices exist (proposals, proposalViewer, documentation) - rest uses hooks
- Services layer (src/services/) contains business logic, not just utilities

## Non-Standard Directory Meanings
- src/hooks/ contains data-fetching hooks (violates typical "utility only" pattern)
- src/api/ returns FileMaker-compatible format even when calling backend
- src/store/ only has 3 slices despite being configured for full Redux usage
- scripts/ contains FileMaker deployment tools using `fmp://` protocol

## Hidden Implementation Details
- Backend Filemaker  requires `{ fields: data }` wrapper for CREATE/UPDATE (not documented in OpenAPI)
- FileMaker layouts use `dev` prefix convention (devCustomers, devProjects, etc.)
- Environment detection happens automatically in src/api/fileMaker.js
- HMAC-SHA256 auth calculated from payload + timestamp (see `generateBackendAuthHeader()`)

## Documentation Gaps
- State management pattern documented in .roo/rules/code.yaml contradicts actual implementation
- Custom hooks for data fetching exist despite rules forbidding them
- Backend response format differs from FileMaker native (lines 189-208 in src/api/fileMaker.js)
- Vite builds single-file bundle for FileMaker deployment (not typical React app)