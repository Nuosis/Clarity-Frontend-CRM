# Changelog

All notable changes to ClarityFrontend CRM will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-02-27

### Added
- Initial release of ClarityFrontend CRM
- Customer management functionality
  - Active/inactive customer tracking
  - Contact information management
  - Customer filtering and sorting
- Project management system
  - Project creation and status tracking
  - Project objectives and steps
  - Resource management (links and images)
- Task management
  - Task creation and assignment
  - Status tracking
  - Notes and descriptions
- Time tracking system
  - Start/stop/pause functionality
  - 6-minute increment adjustments
  - Work description logging
  - Quick save with CMD+S
- FileMaker integration
  - Secure data communication
  - Layout-based operations
  - Error handling and retries
- Dark/Light mode support
- Responsive design
- Error boundaries and fallbacks

### Security
- Secure FileMaker authentication
- Data encryption in transit
- Input validation and sanitization
- Error message sanitization
- Session management

### Developer Experience
- React 18 implementation
- Tailwind CSS styling
- Vite build system
- ESLint and Prettier configuration
- Development scripts and tools

## [Unreleased]

### Planned
- Task filtering and sorting
- Batch operations
- Enhanced reporting
- Team collaboration features
- Advanced timer capabilities

### Under Consideration
- Stats and Graphing
- New Customer, Customer Active/Inactive not funcational
- Timer reboot if active (on close, timer does not restart if there is a record without an end time)
- Integration with additional services (Harvest)

---
Note: This changelog will be updated with each release to document all significant changes, including new features, bug fixes, deprecations, and any breaking changes.