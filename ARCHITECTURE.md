# ClarityFrontend CRM Architecture

## System Overview

ClarityFrontend CRM is a React-based customer relationship management system that integrates with FileMaker for data storage and retrieval. The application follows a layered architecture pattern with clear separation of concerns.

## Architectural Layers

### 1. Presentation Layer (React Components)
- Located in `src/components/`
- Implements the user interface using React functional components
- Uses Tailwind CSS for styling
- Supports dark/light mode theming
- Key components:
  - Layout components (`AppLayout.jsx`, `Sidebar.jsx`)
  - Feature components (customers, projects, tasks)
  - Global components (SnackBar, TextInput)
  - Loading states and error boundaries

### 2. State Management Layer (Hooks & Context)
- Located in `src/hooks/` and `src/context/`
- Uses React Context for global state management
- Custom hooks for feature-specific state:
  - `useCustomer` - Customer data and operations
  - `useProject` - Project management
  - `useTask` - Task tracking
  - `useLink` - Resource linking
  - `useNote` - Note management

### 3. Service Layer (Business Logic)
- Located in `src/services/`
- Handles business logic and data processing
- Key services:
  - `customerService.js` - Customer data processing
  - `projectService.js` - Project management logic
  - `taskService.js` - Task and timer operations
  - `initializationService.js` - App initialization
  - `loadingStateManager.js` - Loading state coordination
  - `recordQueueManager.js` - Record processing queue

### 4. API Layer (FileMaker Integration)
- Located in `src/api/`
- Manages communication with FileMaker backend
- Uses `fm-gofer` for FileMaker integration
- Implements retry logic and error handling
- Supports both synchronous and asynchronous operations

## Key Features Implementation

### Time Tracking System
- Component: `TaskTimer.jsx`
- Features:
  - Start/stop/pause functionality
  - 6-minute increment adjustments
  - Keyboard shortcuts (CMD+S for quick save)
  - Automatic pause tracking
  - Work description logging

### Project Management
- Hierarchical structure: Customer → Project → Tasks
- Real-time status tracking
- Resource management (links, images)
- Objective tracking with completion status

### Customer Management
- Active/inactive customer tracking
- Contact information management
- Project association
- Activity history

## Data Flow

1. User Interface Events
   - Component triggers action
   - Hook handles state update
   - Service processes data
   - API sends request to FileMaker

2. Data Updates
   - FileMaker returns response
   - API layer formats response
   - Service layer processes data
   - Hooks update state
   - UI reflects changes

## Error Handling

1. Component Level
   - Error boundaries catch rendering errors
   - Loading states handle async operations

2. Service Level
   - Data validation
   - Business rule enforcement
   - Error formatting

3. API Level
   - Request retry logic
   - Error standardization
   - Connection management

## Performance Considerations

1. Component Optimization
   - React.memo for pure components
   - Memoized callbacks and values
   - Efficient re-render management

2. Data Management
   - Cached data in context
   - Optimistic updates
   - Batched state updates

3. FileMaker Integration
   - Connection pooling
   - Request queuing
   - Error recovery

## Security Architecture

1. Authentication
   - FileMaker credentials management
   - Session handling
   - Secure credential storage

2. Data Access
   - Layout-based permissions
   - Field-level security
   - Action validation

## Development Patterns

1. Component Structure
   - Functional components
   - Custom hooks for logic
   - Prop type validation
   - Component composition

2. State Management
   - Context for global state
   - Hooks for local state
   - Controlled forms
   - State normalization

3. Error Management
   - Error boundaries
   - Try-catch patterns
   - Error logging
   - User feedback

## Integration Points

1. FileMaker Layouts
   - devCustomers: Customer data
   - devProjects: Project management
   - devTasks: Task tracking
   - devRecords: Time records
   - devNotes: Note management
   - devLinks: Resource linking

2. External Services
   - FileMaker Server
   - Local storage for preferences
   - Browser APIs for shortcuts

## Future Considerations

1. Scalability
   - Component lazy loading
   - Data pagination
   - Cache management
   - Performance monitoring

2. Maintainability
   - Code documentation
   - Testing strategy
   - Dependency management
   - Version control

3. Extensibility
   - Plugin architecture
   - API versioning
   - Feature flagging
   - Configuration management