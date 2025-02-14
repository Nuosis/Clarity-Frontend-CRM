# ClarityFrontend CRM

A React-based CRM system for managing customers, projects, and time tracking, integrated with FileMaker.

## Features

- 🌓 Dark/Light mode support
- 👥 Customer management
- 📋 Project tracking
- ⏱️ Task timer with adjustments
- 📝 Notes and descriptions
- 🔄 FileMaker integration
- 🎯 Objective tracking
- 📊 Resource management

## Tech Stack

- React 18
- Tailwind CSS
- Vite
- FileMaker Integration (fm-gofer)

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- FileMaker Server (for backend integration)

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

3. Create a `.env` file with your FileMaker configuration:
```env
VITE_FM_SERVER=your-filemaker-server
VITE_FM_DATABASE=your-database
VITE_FM_USERNAME=your-username
VITE_FM_PASSWORD=your-password
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

## FileMaker Integration

The application integrates with FileMaker through the following layouts:
- devCustomers: Customer management
- devProjects: Project tracking
- devTasks: Task management
- devRecords: Time tracking

### Data Flow
1. Initial load fetches user context and customers
2. Customer selection loads related projects
3. Project selection loads associated tasks
4. Task operations sync with FileMaker

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

Additional documentation available in:
- `src/reference/implementation.md`: Detailed implementation guide
- `src/reference/architecture.md`: System architecture
- `src/reference/files_guide.md`: File structure and purpose

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

## Roadmap

Future enhancements planned:
- Task filtering and sorting
- Batch operations
- Enhanced reporting
- Team collaboration features
- Advanced timer capabilities

## Acknowledgments

- FileMaker for backend integration
- React team for the framework
- Tailwind CSS for styling
- Vite for build tooling
