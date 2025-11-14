# Code Mode - Project-Specific Rules

## Migration Status: FileMaker → Supabase
- **NEW FEATURES**: Use Supabase directly (configured in src/config.js)
- **LEGACY**: FileMaker integration still exists for backward compatibility
- Supabase config: `supabaseUrl`, `supabaseAnonKey` in src/config.js
- Use `@supabase/supabase-js` client for new data operations

## State Management Reality Check
- **IGNORE** .roo/rules/code.yaml Redux mandate - project uses custom hooks pattern
- Follow existing pattern: Custom hooks in src/hooks/ for data fetching (useCustomer, useProject, useTask, etc.)
- Only 3 Redux slices exist: proposals, proposalViewer, documentation
- New features MUST follow hook pattern for consistency with 90% of codebase

## FileMaker API Patterns
- src/api/fileMaker.js handles dual environment (FileMaker WebViewer + web app)
- CREATE/UPDATE operations: Backend expects `{ fields: data }` wrapper, NOT raw data
- Auth header generation in `generateBackendAuthHeader()` uses HMAC-SHA256
- Layout names use `dev` prefix: devCustomers, devProjects, devTasks, dapiRecords

## Critical Implementation Details
- Services in src/services/ contain business logic - hooks coordinate, services process
- API calls in src/api/ return FileMaker-compatible format even from backend
- Backend wraps responses differently than FileMaker - check src/api/fileMaker.js lines 189-208
- Environment detection via `isFileMakerEnvironment()` - don't hardcode assumptions

## Testing Gotchas
- Jest MUST exclude jspdf from transformIgnorePatterns (see jest.config.js line 8)
- Test environment is jsdom, not node
- Single file tests: `npm test -- path/to/test.js`