# Notes Migration Requirements - Vision

## Overview

Create comprehensive documentation for migrating the Notes feature from FileMaker to Supabase. Notes are currently implemented via FileMaker's `devNotes` layout and are used across projects and tasks. This documentation will serve as the specification for backend team to implement Supabase-based notes functionality.

## Goals

1. **Document Current Behavior**: Capture all existing notes functionality including CRUD operations, associations, and UI flows
2. **Define Data Model**: Design Supabase schema for notes with polymorphic associations to multiple parent entities
3. **Specify Backend Contracts**: Define all required API endpoints/RPCs for frontend integration
4. **Plan Migration**: Create strategy for migrating existing FileMaker notes to Supabase
5. **Establish Testing Criteria**: Define acceptance criteria and test cases

## Success Criteria

- Complete requirements documentation following standardized template structure
- Clear data model mapping from FileMaker `devNotes` to Supabase schema
- Well-defined API contracts with request/response examples
- Comprehensive migration plan for existing notes data
- Authorization requirements documented (RLS policies, org scoping)
- Acceptance criteria covering all current functionality and edge cases

## Technical Approach

### Current Implementation Analysis

**FileMaker Layout**: `devNotes`
- Fields: `note`, `_fkID`, `type`, `__ID`, `~CreationTimestamp`, `~CreatedBy`
- Association: Foreign key `_fkID` links to parent entity (project or task)
- No table in Supabase yet

**Frontend Code**:
- API: `src/api/notes.js` - `createNote()` function
- Service: `src/services/noteService.js` - `createNewNote()`, `processNotes()`
- Hook: `src/hooks/useNote.js` - `handleNoteCreate()`
- UI Components:
  - `src/components/projects/ProjectNotesTab.jsx` - Project notes display and creation
  - `src/components/tasks/TaskList.jsx` - Task notes in expanded view

**Current Behavior**:
- Notes can be created for projects and tasks
- Notes are loaded with parent entity details
- Notes display in reverse chronological order (newest first)
- Each note shows content, creation timestamp, and creator
- No update or delete functionality currently exposed in UI

### Supabase Schema Design

**Polymorphic Association Strategy Options**:

1. **Single notes table with nullable foreign keys** (Simplest)
   - Columns: `id`, `note`, `type`, `project_id`, `task_id`, `customer_id`, `created_at`, `created_by`, `updated_at`
   - Constraint: Exactly one FK must be non-null

2. **Junction tables** (More flexible)
   - `notes` table: `id`, `note`, `type`, `created_at`, `created_by`
   - `project_notes`, `task_notes`, `customer_notes` junction tables

3. **PostgreSQL native approach**
   - Use `parent_type` and `parent_id` columns with check constraints

### Backend Requirements

**Endpoints/RPCs Needed**:
- `GET /notes?project_id={id}` - List notes for project
- `GET /notes?task_id={id}` - List notes for task
- `GET /notes?customer_id={id}` - List notes for customer (future)
- `POST /notes` - Create note
- `PATCH /notes/{id}` - Update note (future)
- `DELETE /notes/{id}` - Delete note (future)

**Or PostgreSQL Functions**:
- `get_notes_by_project(project_id UUID)`
- `get_notes_by_task(task_id UUID)`
- `create_note(note TEXT, type TEXT, project_id UUID, task_id UUID, customer_id UUID)`

### Migration Strategy

1. **Data Export**: Extract all notes from FileMaker `devNotes` layout
2. **ID Mapping**: Map FileMaker `_fkID` to Supabase entity UUIDs
3. **Type Detection**: Determine parent entity type for each note
4. **Data Import**: Bulk insert into Supabase with proper associations
5. **Validation**: Verify all notes migrated correctly with associations intact

### Files to Create

```
requirements/notes/
├── README.md                      # Overview and quick reference
├── current-implementation.md      # Detailed current behavior documentation
├── data-model-mapping.md          # FileMaker to Supabase schema mapping
├── api-contracts.md               # Backend API specifications
├── authorization.md               # RLS policies and access control
├── migration-plan.md              # Data migration strategy
└── acceptance-criteria.md         # Test cases and validation
```

## Dependencies

- **Customer Migration** (INS0001): May need customer notes association
- **Project Migration** (INS0002): Notes associate with projects
- **Task Migration** (INS0003): Notes associate with tasks
- Backend team implementation of Supabase schema and endpoints
- Frontend refactor will follow after backend implementation (Phase 2)

## Risks and Considerations

1. **Association Integrity**: Must ensure all migrated notes maintain correct parent associations
2. **Historical Data**: Notes have timestamps and creators that must be preserved
3. **Concurrent Creation**: Multiple users may create notes simultaneously
4. **Type Field Usage**: Current `type` field defaults to 'general' - need to understand if other types exist
5. **Customer Notes**: No current UI for customer notes, but schema should support future use

## Timeline Considerations

This is Phase 1 (Requirements Documentation) only. Implementation will follow in Phase 2 after backend team creates:
- Supabase notes table and schema
- Backend API endpoints/RPCs
- Row-level security policies
- Data migration scripts

Frontend implementation Phase 2 will update:
- `src/api/notes.js` to call backend/Supabase instead of FileMaker
- No major UI changes expected (existing components should work with minimal updates)
