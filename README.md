# ClarityFrontend CRM

A React-based CRM system for managing customers, projects, teams, proposals, and time tracking with Supabase authentication and backend API integration.

> **Migration Completed (January 2026):** This application has been fully migrated from FileMaker WebViewer to a standalone web application architecture using Supabase + Backend API. All FileMaker integration code has been removed.

## Features

- 🌓 Dark/Light mode support
- 👥 Customer & Prospect management
- 📋 Project tracking with team assignments
- 👔 Team & Staff management
- ⏱️ Task timer with adjustments
- 📝 Proposals with packages and deliverables
- 📧 Marketing campaigns via Mailjet
- 💰 QuickBooks integration for invoicing
- 🎯 Objective tracking
- 📊 Resource management
- 🔐 Multi-tenant with organization-scoped security

## Tech Stack

- React 18
- Tailwind CSS
- Vite
- Supabase (PostgreSQL, Authentication, Storage, RLS)
- Backend API with HMAC authentication
- Redux Toolkit (for complex state)
- Context API (for global state)

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Supabase account and project
- Backend API access (https://api.claritybusinesssolutions.ca)

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

## Architecture

### Application Architecture

**Standalone Web Application:**
- Independent SPA with Supabase authentication
- Multi-tenant with organization-scoped security via RLS
- Direct backend API integration with HMAC authentication
- Real-time updates via Supabase subscriptions

### Data Sources

**Supabase (Primary Database):**
- Customers, Customer Contacts (emails, phones, addresses)
- Projects, Tasks, Notes
- Teams, Staff, Team Members
- Prospects and Marketing Campaigns
- Proposals (basic and extended)
- Products and Sales
- Financial Records
- Authentication and user management
- File storage (staff images, documents)

**Backend API:**
- CRUD operations for customers, projects, tasks, notes
- QuickBooks integration for invoicing
- Financial synchronization
- Email campaigns (Mailjet)
- Advanced business logic and data transformations
- HMAC-SHA256 authentication for secure API access

### Data Flow

1. **Authentication**: Supabase Auth with JWT tokens
2. **Organization Scoping**: All operations scoped to user's organization via RLS policies
3. **Backend API**: CRUD operations with HMAC authentication
4. **Direct Supabase**: Real-time subscriptions, file storage, financial records
5. **Security**: Row Level Security (RLS) enforces data isolation between organizations

## Development

### Available Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run preview`: Preview production build
- `npm test`: Run test suite

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

### Web Application Deployment

1. Build the project:
```bash
npm run build
```

2. Deploy the `dist/index.html` file to your web server:
   - Via FTP/SFTP
   - Via SSH/SCP
   - Via CI/CD pipeline
   - Via cloud hosting (Vercel, Netlify, etc.)

3. Ensure environment variables are properly configured on your hosting platform.

## Documentation

### Primary Documentation
- `CLAUDE.md`: **START HERE** - Comprehensive project guide for developers
- `README.md`: This file - Project overview and setup

### Architecture & Integration
- `BACKEND_INTEGRATION_GUIDE.md`: Backend API integration details
- `PROPOSAL_SYSTEM_SUMMARY.md`: Proposal system overview
- `DARK_MODE_IMPLEMENTATION.md`: Theme system documentation
- `docs/CUSTOMER_API_INTEGRATION.md`: Customer backend integration guide
- `docs/NOTES_BACKEND_INTEGRATION.md`: Notes backend API integration guide
- `docs/FEATURE_FLAGS.md`: Feature flag system documentation

### Backend Integration Guides
- `docs/TEAMS_MIGRATION_GUIDE.md`: Teams architecture overview
- `docs/CUSTOMERS_BACKEND_API.md`: Customer API client reference
- `docs/CUSTOMER_SERVICE_API.md`: Customer service layer reference
- `requirements/customers/`: Customer migration requirements and specifications
- `requirements/teams/`: Teams requirements and specifications

### Additional Resources
- `.roo/rules/`: Development patterns and best practices
- `docs/`: Technical documentation

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
- `CLAUDE.md` for comprehensive project guidance
- Documentation in the `docs/` directory
- Backend API documentation at `https://api.claritybusinesssolutions.ca/docs`
- Component documentation in source files

## Migration History

### ✅ Completed (January 2026)
- **FileMaker Frontend Removal**: All FileMaker integration code removed
- **Customers**: Full backend API integration with nested contacts
- **Projects**: Backend API integration with organization scoping
- **Tasks**: Backend API integration with team assignments
- **Notes**: Backend API integration with multi-entity support
- **Teams**: Supabase-backed with staff management
- **Proposals**: Supabase-backed with packages and deliverables
- **Prospects**: Supabase-backed with marketing campaigns
- **Products & Sales**: Supabase-backed
- **Financial Records**: Direct Supabase integration

### 🎯 Current Focus
- Enhanced real-time collaboration features
- Advanced analytics and reporting
- Performance optimizations
- Mobile-responsive improvements

### 📋 Future Roadmap
- Mobile app development
- Advanced workflow automation
- Enhanced QuickBooks integration
- Third-party integrations (Slack, Zapier, etc.)

## Acknowledgments

- React team for the framework
- Supabase for backend infrastructure
- Tailwind CSS for styling
- Vite for build tooling
