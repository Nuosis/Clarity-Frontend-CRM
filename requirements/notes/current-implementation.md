# Notes Feature - Current Implementation

## FileMaker Implementation

### Layouts
- **Layout Name:** [TO BE DOCUMENTED]
- **Table Occurrence:** [TO BE DOCUMENTED]
- **Related Layouts:** [TO BE DOCUMENTED]

### Fields
[TO BE DOCUMENTED - List all FileMaker fields used in notes]

Example format:
```
- noteID (Primary Key)
- noteText (Text field)
- noteDate (Date field)
- customerID_fk (Foreign key to customers)
- ...
```

### Relationships
[TO BE DOCUMENTED - FileMaker relationship graph connections]

Example format:
```
- notes::customerID_fk → customers::customerID
- notes::projectID_fk → projects::projectID
```

## Frontend Components

### Existing Components
[TO BE DOCUMENTED - List components that handle notes in the current codebase]

Search locations:
- `src/components/` - Look for Note-related components
- `src/hooks/` - Look for useNote or note-related hooks
- `src/services/` - Look for noteService or related services
- `src/api/` - Look for notes API integration

### UI Workflows
[TO BE DOCUMENTED - Describe user workflows]

1. **Creating a Note:**
   - [Steps to create]

2. **Viewing Notes:**
   - [How notes are displayed]

3. **Editing Notes:**
   - [Edit workflow]

4. **Deleting Notes:**
   - [Delete workflow]

### Data Access Patterns
[TO BE DOCUMENTED - How notes are fetched and updated]

Example:
- List notes by customer
- List notes by project
- Filter by date range
- Search note content

## Integration Points

### Customer Integration
[TO BE DOCUMENTED - How notes relate to customers]

### Project Integration
[TO BE DOCUMENTED - How notes relate to projects]

### Other Entity Integration
[TO BE DOCUMENTED - Any other entities that use notes]

## Current Limitations
[TO BE DOCUMENTED - Known issues or limitations in FileMaker implementation]

## Feature Requirements to Preserve
[TO BE DOCUMENTED - Critical functionality that must be maintained]

## References
- FileMaker Database: `clarityCRM`
- FileMaker Server: `https://server.claritybusinesssolutions.ca/fmi/data/v1`
- Bridge Library: `fm-gofer` (see `src/hooks/useFileMakerBridge.js`)

## Notes
- Add file paths and line numbers for all code references
- Use format: `src/components/Example.jsx:123`
- Include screenshots or mockups if available
