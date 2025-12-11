# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clarity CRM Frontend is a React-based customer relationship management system that operates in dual environments:
- **FileMaker WebViewer**: Embedded in FileMaker with fm-gofer bridge (LEGACY - being phased out)
- **Standalone Web App**: Independent web application with Supabase authentication (PRIMARY FOCUS)

The application manages customers, projects, tasks, time tracking, proposals, marketing campaigns, and financial operations with QuickBooks integration.

**IMPORTANT MIGRATION NOTICE:**
- **New features should be Supabase-only** - Do not add FileMaker integration for new functionality
- FileMaker support is maintained for backward compatibility only
- Focus development on web app environment with direct Supabase + Backend API integration

## ⚠️ CRITICAL: Backend Change Protocol

**🚨 DO NOT DIRECTLY MODIFY BACKEND INFRASTRUCTURE 🚨**

You do **NOT** have permission to make changes to:
- Database schema (tables, columns, indexes, constraints)
- Backend API endpoints or business logic
- Database migrations
- Server configuration
- Environment variables on the backend

**Required Process for Backend Changes:**

1. **Create a Backend Change Request Document:**
   - Use format: `BACKEND_CHANGE_REQUEST_XXX_[FEATURE_NAME].md`
   - Include: SQL changes, API contract changes, testing requirements, rollback plan
   - Document frontend assumptions and implementation status
   - List all affected areas and migration impact

2. **Submit Request to User:**
   - User will forward request to backend team
   - Wait for backend team approval and implementation
   - Do not proceed with frontend code that depends on unapproved backend changes

3. **After Backend Approval:**
   - Implement frontend code assuming approved schema/API changes
   - Clearly document dependencies in code comments
   - Test against dev environment once backend changes are deployed

**Example:**
```markdown
# ❌ WRONG - Direct SSH database modification
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql..."

# ✅ CORRECT - Create change request document
Create: BACKEND_CHANGE_REQUEST_001_PRODUCT_SUBSCRIPTIONS.md
```

**Why This Matters:**
- Database changes affect multiple systems and teams
- Schema migrations require careful planning and testing
- Backend team needs to coordinate deployments
- Unauthorized changes can cause production incidents

## Development Commands

### Local Development
```bash
npm run dev                    # Start Vite dev server on port 1235
npm run build                  # Build for production
npm run preview                # Preview production build
```

### Testing
```bash
npm test                       # Run Jest tests
npm run test:supabase          # Test Supabase service
npm run test:edge-function     # Test edge functions
```

### Deployment
```bash
npm run deploy-to-fm           # Build and upload to FileMaker server
npm run upload                 # Upload built files to server
```

### Documentation
```bash
npm run docs                   # Generate documentation
npm run docs:bundle            # Bundle documentation files
```

### Utilities
```bash
npm run openfile               # Open file on remote server
npm run deploy:edge-function   # Deploy Supabase edge function
```

## Critical Server Access Pattern

**IMPORTANT**: This project runs on a REMOTE server. There is NO local Docker environment.

### SSH Access
```bash
ssh marcus@backend.claritybusinesssolutions.ca "command"
```

**SSH Rules:**
- SSH connections CANNOT maintain persistent sessions in this environment
- MUST use individual SSH commands for each operation
- NEVER attempt interactive SSH sessions or tunnels
- Each SSH command executes independently and terminates after completion
- For multiple commands, use separate SSH calls OR chain with `&&` in a single call
- avaiable docker containers:
clarity_backend_celery_beat
clarity_backend_celery_worker
clarity_backend_caddy
clarity_backend_api
supabase-storage
supabase-edge-functions
supabase-meta
supabase-pooler
supabase-auth
supabase-studio
supabase-kong
supabase-rest
realtime-dev.supabase-realtime
clarity_backend_backup
supabase-analytics
clarity_backend_qdrant
supabase-db
clarity_backend_redis
supabase-vector
supabase-imgproxy

### Supabase Database Verification

**List all tables:**
```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;\""
```

**Check if table exists:**
```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'table_name');\""
```

**Describe table structure:**
```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker exec supabase-db psql -U postgres -d postgres -c \"\\d+ table_name\""
```

**List Docker containers:**
```bash
ssh marcus@backend.claritybusinesssolutions.ca "docker ps"
```

**Database Container:** `supabase-db` (PostgreSQL user: `postgres`, Database: `postgres`)

See `.roo/rules/SUPABASE_DATABASE_VERIFICATION.md` for full table list (69 tables verified as of 2025-12-05).

## Architecture Overview

### Environment Detection and Authentication Flow

The application automatically detects its runtime environment on startup:

1. **SignIn Component** ([src/components/auth/SignIn.jsx](src/components/auth/SignIn.jsx))
   - Detects FileMaker environment via `window.FileMaker` object
   - Falls back to Supabase authentication for web app
   - Sets environment context via `setEnvironmentContext()`

2. **Environment Types** ([src/services/dataService.js](src/services/dataService.js))
   - `ENVIRONMENT_TYPES.FILEMAKER`: Running in FileMaker WebViewer
   - `ENVIRONMENT_TYPES.WEBAPP`: Standalone web application
   - `AUTH_METHODS.FILEMAKER`: FileMaker bridge authentication
   - `AUTH_METHODS.SUPABASE`: Supabase authentication

3. **Data Service Routing**
   - All data operations route through environment-aware service layer
   - FileMaker environment uses fm-gofer bridge
   - Web app environment uses Supabase + Backend API

### Application State Management

**Global State:** Context-based architecture using React Context API

1. **AppStateContext** ([src/context/AppStateContext.jsx](src/context/AppStateContext.jsx))
   - Central state management for app-wide data
   - Manages: authentication, environment, selected entities, loading states, errors
   - Provides operations: `useAppState()`, `useAppStateOperations()`

2. **Specialized Contexts:**
   - **TeamContext**: Team management and staff
   - **ProjectContext**: Project-specific state
   - **MarketingContext**: Marketing campaigns
   - **SnackBarContext**: Global notifications

3. **Redux Store** ([src/store/](src/store/))
   - Used for complex features: proposals, documentation viewer
   - Slices: `proposalSlice`, `proposalViewerSlice`, `documentationSlice`

### Data Flow Pattern

```
App (index.jsx)
  ├─ AppStateContext (global state)
  ├─ Authentication (SignIn component)
  ├─ Initialization (initializationService)
  │   ├─ Environment detection
  │   ├─ User context loading
  │   └─ Preload customers/teams
  ├─ AppLayout (theme, layout structure)
  │   ├─ Sidebar (navigation)
  │   └─ MainContent (routing)
  │       ├─ CustomerDetails / ProspectDetails
  │       ├─ ProjectDetails (tabs)
  │       ├─ TeamDetails
  │       └─ Marketing/Financial panels
  └─ Custom Hooks (data operations)
      ├─ useCustomer, useProject, useTask
      ├─ useTeam, useProducts, useSales
      └─ useProspect, useProposal
```

### Layer Responsibilities

1. **App Layer** ([src/index.jsx](src/index.jsx))
   - Global state coordination via hooks
   - Initialization and authentication
   - Error boundaries
   - Passes processed data and handlers down

2. **Layout Layer** ([src/components/layout/](src/components/layout/))
   - **AppLayout**: Theme provider, dark mode, global layout structure
   - **Sidebar**: Navigation for customers, prospects, teams, products, marketing
   - **TopNav**: User info, settings, global actions
   - **MainContent**: Routes between different views based on selected entities

3. **View Components** ([src/components/](src/components/))
   - Focus on display and user interactions
   - Use hooks for component-specific state
   - Call services for data processing
   - Don't manage global state directly

4. **Custom Hooks** ([src/hooks/](src/hooks/))
   - Encapsulate data operations and state management
   - Abstract API calls and business logic
   - Examples: `useCustomer`, `useProject`, `useTask`, `useTeam`, `useProposal`

5. **Services Layer** ([src/services/](src/services/))
   - Business logic and data processing
   - API abstraction and error handling
   - Examples: `customerService`, `projectService`, `taskService`, `proposalService`

6. **API Layer** ([src/api/](src/api/))
   - Direct API communication
   - Environment-aware routing (FileMaker vs Backend API)
   - HMAC authentication for backend requests
   - Examples: `customers.js`, `projects.js`, `proposals.js`

### Key Services

- **dataService.js**: Environment-aware data routing and HMAC authentication
- **initializationService.js**: App startup, environment detection, user context
- **loadingStateManager.js**: Global loading states with progress messages
- **dualWriteService.js**: Synchronizes data between FileMaker and Supabase
- **proposalExtendedService.js**: Extended proposal system with packages/deliverables
- **financialSyncService.js**: QuickBooks synchronization
- **mailjetService.js**: Email campaign management

## Backend Integration

**Backend API:** `https://api.claritybusinesssolutions.ca`

**Authentication:** All backend requests use HMAC-SHA256 authentication
- Secret key: `VITE_SECRET_KEY` (from `.env`)
- Format: `Bearer {signature}.{timestamp}`
- Handled automatically by `dataService.generateBackendAuthHeader()`

**API Documentation:**
- OpenAPI spec: `https://api.claritybusinesssolutions.ca/openapi.json`
- Interactive docs: `https://api.claritybusinesssolutions.ca/docs`
- Use `grep` to search the spec - it's too large to read entirely

**API Proxy:** Vite proxies `/api/*` requests to backend (see `vite.config.js`)

## External Integrations

### FileMaker Integration
- **Bridge:** fm-gofer library (`useFileMakerBridge` hook)
- **Layouts:** devCustomers, devProjects, devTasks, devRecords
- **Server:** `https://server.claritybusinesssolutions.ca/fmi/data/v1`
- **Database:** clarityCRM

### Supabase Integration
- **URL:** `https://supabase.claritybusinesssolutions.ca`
- **Service:** `supabaseService.js` singleton
- **Auth:** Anon key for web app, service role for backend operations
- **Tables:** 69 tables including proposals, customers, projects, prospects, products

### QuickBooks Integration
- **Service:** `financialSyncService.js`
- **Edge Function:** `quickbooksEdgeFunction.js`
- **OAuth:** Client ID/Secret in `.env`
- **Features:** Invoice generation, customer sync, time entry billing

### Mailjet Integration
- **Service:** `mailjetService.js`
- **API Keys:** In `.env`
- **Features:** Email campaigns, prospect outreach, proposal notifications

## Proposal System Architecture

The application includes an extensive proposal system with two implementations:

### Basic Proposals
- Single-form creation
- Basic deliverables and requirements
- Simple approval workflow
- Components: `ProposalCreationForm.jsx`, `ProposalViewer.jsx`, `ProposalApproval.jsx`

### Extended Proposals
- Multi-tab interface with packages and deliverables
- Advanced pricing with package configurations
- Source document management
- Components: `ProposalCreationFormEnhanced.jsx`, `ProposalTabs.jsx`, `SummaryTab.jsx`, `DeliverablesTab.jsx`, `RequestsTab.jsx`
- Backend API integration with HMAC authentication
- See `BACKEND_INTEGRATION_GUIDE.md` and `PROPOSAL_SYSTEM_SUMMARY.md`

**Key Tables:**
- `proposals`, `proposal_deliverables`, `proposal_packages`
- `proposal_packages_deliverables`, `proposal_packages_requirements`
- `proposal_requests`, `proposal_requirements`

## Prospects vs Customers

**Prospects** (Supabase-only):
- Stored in `prospects` table
- Managed via `useProspect` hook and `prospectService`
- Marketing campaigns and email outreach
- Can be converted to FileMaker customers
- Components: `ProspectDetails.jsx`, `ProspectForm.jsx`, `ConvertProspectModal.jsx`

**Customers** (FileMaker primary, synced to Supabase):
- Primary source: FileMaker `devCustomers` layout
- Synchronized to Supabase `customers` table
- Full project and task management
- Components: `CustomerDetails.jsx`, `CustomerForm.jsx`

**Dual-Write Pattern:**
- `dualWriteService.js` handles synchronization
- Customers written to both FileMaker and Supabase
- Projects and tasks synchronized when created/updated

## Development Guidelines

### File Organization Rules
- **DO NOT create new files** without checking for existing implementations
- **Edit existing files** whenever possible - do not abandon them
- Files are for **repeatable, reusable code** only
- Temporary testing should use terminal commands (curl, etc.)

### Context Awareness
- **roo.md files**: If a directory has a `roo.md`, read it before modifying files in that directory
- Contains context-specific guidance and patterns

### Testing Requirements
1. **Never conclude success** without testing assumptions
2. **Test order**: Run from fundamental to complex
3. **Avoid test files** when:
   - Similar test already exists (reuse first)
   - Existing test can be extended
   - Can verify with cURL
4. **Journey tests**: Exit 0 with no output = UI hung (requires user interaction)

### Server Status Verification
**DO NOT use `npm run dev` to check if server is running**

Use cURL instead:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:1235 || echo "Server not running"
```

### Authentication Debugging
**When receiving 403 errors, ASSUME YOU MADE A MISTAKE:**
- Consult documentation first
- Find working examples in codebase
- Auth is complex - issue is rarely "auth is broken"
- Issue is usually: incorrect call format, missing headers, wrong endpoint

### Library Usage
- **Leverage established libraries**: lodash, axios, date-fns (don't roll your own)
- **Don't duplicate libraries**: Check if library already exists in project
- **Don't over-engineer**: Start simple, increase complexity as needed

### Code Quality
- Follow patterns in `.roo/rules/rules.md`
- Use established project patterns (don't introduce new ones without asking)
- Avoid emojis in code unless explicitly requested
- No excessive comments or documentation unless necessary

## Theme and Styling

**Tailwind CSS** with custom theme configuration ([src/theme.js](src/theme.js))

**Dark Mode:**
- Managed by `ThemeProvider` in `AppLayout.jsx`
- Toggle via `useTheme()` hook
- Persisted in localStorage
- Classes: `dark:` prefix for dark mode variants

**Colors:**
- Primary: `#004967` (Clarity brand blue)
- Accent colors defined in theme
- Use theme variables, not hardcoded colors

See `DARK_MODE_IMPLEMENTATION.md` and `THEME_QUICK_REFERENCE.md` for details.

## Environment Variables

Required variables in `.env`:
- `VITE_APP_NAME`, `VITE_VERSION`
- `VITE_API_URL`, `VITE_SECRET_KEY`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_SERVICE_ROLE_KEY`
- `VITE_FM_URL`, `VITE_FM_DATABASE`, `VITE_FM_USER`, `VITE_FM_PASSWORD`
- `VITE_QB_CLIENT_ID`, `VITE_QB_CLIENT_SECRET`
- `VITE_MAILJET_API_KEY`, `VITE_MAILJET_SECRET_KEY`

**NEVER modify environment files without explicit permission.**

## Common Pitfalls

1. **SSH Access**: Never try local Docker commands - always SSH first
2. **Environment Detection**: Wait for environment detection before making API calls
3. **FileMaker Bridge**: Check `fmReady` status before FileMaker operations
4. **Dual Environments**: Services must handle both FileMaker and web app contexts
5. **Customer vs Prospect**: Different data sources and operations
6. **Authentication**: Backend requests require HMAC, Supabase requests use JWT
7. **Loading States**: Use `loadingStateManager` for global loading feedback
8. **State Updates**: Complex state updates should use `setTimeout(..., 0)` to avoid React render issues

## Documentation Resources

- `README.md`: General project information
- `BACKEND_INTEGRATION_GUIDE.md`: Backend API integration details
- `PROPOSAL_SYSTEM_SUMMARY.md`: Complete proposal system overview
- `PROPOSAL_UI_IMPLEMENTATION_SUMMARY.md`: UI components guide
- `DARK_MODE_IMPLEMENTATION.md`: Theme implementation details
- `.roo/rules/rules.md`: Development best practices
- `.roo/rules/rules_general.md`: General project rules and SSH patterns
- `.roo/rules/SUPABASE_DATABASE_VERIFICATION.md`: Database access patterns
- `docs/`: Additional technical documentation
