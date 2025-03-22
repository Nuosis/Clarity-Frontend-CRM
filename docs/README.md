# Clarity CRM Frontend Documentation

This directory contains documentation for the Clarity CRM Frontend project.

## Project Documentation

The project documentation is available in two formats:

### 1. HTML Documentation Viewer

The `project-documentation.html` file provides a comprehensive view of the entire project codebase. It includes:

- A file tree navigation sidebar
- Syntax-highlighted source code for all files
- Search functionality to quickly find files
- Collapsible directory structure

To view the documentation:
- Open `project-documentation.html` in any modern web browser
- Use the sidebar to navigate through the project structure
- Use the search box to find specific files

This documentation is generated using the `npm run docs` command, which runs the `scripts/generate-docs.js` script.

### 2. Bundle Documentation (Alternative)

The `project-bundle.js` file (if generated) contains a non-minified representation of the entire project bundled into a single file. This can be useful for understanding the dependency relationships between modules.

To generate this bundle:
- Run `npm run docs:bundle` command, which uses Rollup to create the bundle
- View the `bundle-stats.html` file for a visualization of the bundle size and module relationships

## Updating Documentation

To update the documentation after making changes to the codebase:

```bash
# Generate HTML documentation
npm run docs

# Or generate bundle documentation (optional)
npm run docs:bundle
```

## Documentation Structure

- `project-documentation.html` - Main documentation file with interactive UI
- `README.md` - This file, explaining how to use the documentation
- `project-bundle.js` - (Optional) Bundled representation of the project
- `bundle-stats.html` - (Optional) Visual representation of the bundle

## Additional Documentation Files

The docs directory contains several important documentation files:

- `ARCHITECTURE.md` - Overview of the project architecture, design patterns, and component structure
- `API_REFERENCE.md` - Detailed documentation of the API endpoints and data models
- `CHANGELOG.md` - History of changes, updates, and releases
- `CONTRIBUTING.md` - Guidelines for contributing to the project
- `DEPLOYMENT.md` - Instructions for deploying the application
- `SECURITY.md` - Security considerations and best practices

## Tasks Directory

The `Tasks/` directory is used to track and generate tasks using the following pattern:

```
##_<descriptive task title>.md
```

Where `##` indicates the order in which the tasks should be completed. For example:

- `01_implement_documentation_generator.md`
- `02_implement_authentication.md`
- `03_create_dashboard_components.md`

This numbering system ensures that tasks are completed in the correct sequence and provides a clear roadmap for project development.

### Task Structure

Each task file should contain:
- A clear description of the task
- Acceptance criteria
- Any relevant technical details or considerations
- Dependencies on other tasks (if applicable)
- Status information

### Available Task Files

- `00_task_template.md` - Template for creating new tasks
- `01_implement_documentation_generator.md` - Task for implementing the documentation generator (completed)

To create a new task, copy the template file and rename it following the numbering convention:

```bash
cp docs/Tasks/00_task_template.md docs/Tasks/##_descriptive_task_name.md
```