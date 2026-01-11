# ClarityFrontend CRM

A React-based CRM system for managing customers, projects, teams, proposals, and time tracking with dual environment support (FileMaker WebViewer and standalone web application).

## Features

- 🌓 Dark/Light mode support
- 👥 Customer & Prospect management
- 📋 Project tracking with team assignments
- 👔 Team & Staff management (Supabase-backed)
- ⏱️ Task timer with adjustments
- 📝 Proposals with packages and deliverables
- 📧 Marketing campaigns via Mailjet
- 💰 QuickBooks integration for invoicing
- 🔄 Dual environment support (FileMaker + Web App)
- 🎯 Objective tracking
- 📊 Resource management

## Tech Stack

- React 18
- Tailwind CSS
- Vite
- Supabase (PostgreSQL, Authentication, Storage)
- FileMaker Integration (fm-gofer) - Legacy support
- Backend API with HMAC authentication
- Redux Toolkit (for complex state)
- Context API (for global state)

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Supabase account (for web app)
- FileMaker Server (for legacy WebViewer support)

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd clarityCrmFrontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with required configuration:
```env
# Application
VITE_APP_NAME=Clarity CRM
VITE_VERSION=2.0.0

# Supabase (Primary)
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Backend API
VITE_API_URL=https://api.claritybusinesssolutions.ca
VITE_SECRET_KEY=your-hmac-secret

# FileMaker (Legacy)
VITE_FM_URL=your-filemaker-server
VITE_FM_DATABASE=clarityCRM
VITE_FM_USER=your-username
VITE_FM_PASSWORD=your-password

# QuickBooks (Optional)
VITE_QB_CLIENT_ID=your-qb-client-id
VITE_QB_CLIENT_SECRET=your-qb-secret

# Mailjet (Optional)
VITE_MAILJET_API_KEY=your-mailjet-key
VITE_MAILJET_SECRET_KEY=your-mailjet-secret
```

4. Start the development server:
```bash
npm run dev
```

## Project Structure

```
src/
├── components/
│   ├── layout/
│   │   ├── AppLayout.jsx      # Main layout with dark mode
│   │   └── Sidebar.jsx        # Customer navigation
│   ├── customers/
│   │   ├── CustomerDetails.jsx # Customer information
│   │   └── CustomerList.jsx    # Customer listing
│   ├── projects/
│   │   └── ProjectDetails.jsx  # Project management
│   └── tasks/
│       ├── TaskForm.jsx       # Task creation/editing
│       ├── TaskList.jsx       # Task management
│       └── TaskTimer.jsx      # Time tracking
├── reference/                  # Documentation
└── index.jsx                  # Application entry
```
## Project Flow

### App/AppContent (Top Level):
    Manages global state via hooks (useCustomer, useProject, useTask)
    Coordinates between different parts of the app
    Handles initialization and error boundaries
    Passes down processed data and handlers

### MainContent (Router/Container):
    Acts as a router between different views
    Doesn't manage state directly
    Passes appropriate data and handlers to child components
    Handles conditional rendering based on selected items

### CustomerDetails/ProjectDetails (View Components):
    Focus on displaying data and handling user interactions
    Use hooks for component-specific state/processing
    Rely on services for data processing
    Don't know about app-level state management

### The flow follows a clear hierarchy:
    App manages global state through hooks
    MainContent routes to appropriate views
    Detail components handle their specific UI concerns

### Each layer has a clear responsibility:
    App → State Management
    MainContent → Routing/Layout
    Detail Components → UI/Display
    Hooks → Data/State Coordination
    Services → Business Logic/Data Processing

## Usage

### Customer Management
- View active and inactive customers in the sidebar
- Select customers to view details and projects
- Access customer contact information

### Project Management
- Create and manage projects
- Track project objectives and steps
- Manage project resources (links and images)
- Toggle project status (Open/Closed)

### Task Management
- Create tasks within projects
- Track task status and progress
- Add task notes and descriptions
- Time tracking with adjustments

### Time Tracking
- Start/stop/pause timer on tasks
- Adjust time in 6-minute increments
- Quick save with CMD+stop
- Add completion notes

## Integration & Architecture

### Dual Environment Support

The application automatically detects its runtime environment:

**FileMaker WebViewer (Legacy):**
- Embedded in FileMaker Pro/Go via `fm-gofer` bridge
- Uses FileMaker layouts for data operations
- Limited to FileMaker-authenticated users

**Standalone Web App (Primary):**
- Independent web application
- Supabase authentication and database
- Multi-tenant with organization scoping
- Direct backend API integration

### Data Sources

**Supabase (Primary for new features):**
- Teams, Staff, Team Members
- Prospects and Marketing Campaigns
- Proposals (basic and extended)
- Products and Sales
- Authentication and user management

**FileMaker (Legacy support):**
- Customers (synced to Supabase)
- Projects (synced to Supabase)
- Tasks (synced to Supabase)
- Time Records

**Backend API:**
- QuickBooks integration
- Financial synchronization
- Email campaigns (Mailjet)
- Advanced business logic

### Teams Migration

Teams functionality has been migrated from FileMaker to Supabase:
- **Old:** `devTeams`, `devStaff`, `devTeamMembers` layouts
- **New:** `teams`, `staff`, `team_members` Supabase tables
- **Status:** Frontend ready, awaiting backend deployment
- **Documentation:** See `docs/TEAMS_MIGRATION_GUIDE.md`

### Data Flow
1. Environment detection on app initialization
2. Supabase authentication for web app users
3. Organization-scoped data loading
4. Real-time updates via Supabase subscriptions
5. Dual-write for FileMaker compatibility (customers, projects, tasks)

## Development

### Available Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run preview`: Preview production build
- `npm run deploy-to-fm`: Deploy to FileMaker server

### Code Style

The project uses:
- ESLint for code linting
- Prettier for code formatting
- Tailwind CSS for styling

### Testing

Run tests with:
```bash
npm test
```

## Deployment

1. Build the project:
```bash
npm run build
```

2. Deploy to FileMaker:
```bash
npm run deploy-to-fm
```

## Documentation

### Primary Documentation
- `CLAUDE.md`: **START HERE** - Comprehensive project guide for developers
- `README.md`: This file - Project overview and setup

### Architecture & Integration
- `BACKEND_INTEGRATION_GUIDE.md`: Backend API integration details
- `PROPOSAL_SYSTEM_SUMMARY.md`: Proposal system overview
- `DARK_MODE_IMPLEMENTATION.md`: Theme system documentation

### Teams Migration
- `docs/TEAMS_MIGRATION_GUIDE.md`: Step-by-step migration instructions
- `TEAMS_SUPABASE_IMPLEMENTATION_SUMMARY.md`: Teams architecture overview
- `BACKEND_CHANGE_REQUEST_002_TEAMS_MIGRATION.md`: Backend schema specification
- `requirements/teams/`: Detailed requirements and specifications

### Additional Resources
- `.roo/rules/`: Development patterns and best practices
- `docs/`: Technical documentation
- `src/reference/`: Legacy implementation guides

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For support, please refer to:
- Documentation in the reference directory
- FileMaker integration guides
- Component documentation

## Migration Status

### ✅ Completed Migrations
- Proposals system (Supabase-backed)
- Prospects and marketing campaigns (Supabase-backed)
- Products and sales (Supabase-backed)
- Teams frontend refactor (Supabase-ready)

### ⏳ In Progress
- Teams backend deployment (awaiting schema deployment)
- Data migration from FileMaker to Supabase

### 📋 Planned
- Complete FileMaker phase-out for customers/projects
- Enhanced real-time collaboration
- Advanced analytics and reporting
- Mobile app development

## Acknowledgments

- FileMaker for backend integration
- React team for the framework
- Tailwind CSS for styling
- Vite for build tooling
