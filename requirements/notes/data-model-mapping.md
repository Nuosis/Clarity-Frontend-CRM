# Notes Feature - Data Model Mapping

## FileMaker Schema

### Layout: devNotes

**Location**: Defined in `src/api/fileMaker.js:416`

```javascript
export const Layouts = {
    NOTES: 'devNotes',
    // ... other layouts
};
```

**Fields**:

```
Layout: devNotes

Core Fields:
  - __ID (Text/UUID) - Unique identifier, primary key
  - note (Text) - Note content
  - _fkID (Text) - Foreign key to parent record (polymorphic)
  - type (Text) - Note category/type (defaults to 'general')

System Fields (FileMaker auto-populated):
  - ~CreationTimestamp (DateTime) - When note was created
  - ~ModificationTimestamp (DateTime) - When note was last modified
  - ~CreatedBy (Text) - Email/username of creator
```

**Relationships**:
- **Polymorphic Association**: The `_fkID` field links notes to parent entities:
  - Projects: `_fkID` = project's `recordId`
  - Tasks: `_fkID` = task's `__ID`
  - Customers: Schema supports, but no UI implementation yet
- **No Explicit Relationships**: FileMaker queries filter by `_fkID` value rather than using relationship graphs
- **Parent Type Inference**: Entity type inferred from `_fkID` value structure, not stored explicitly

**Query Pattern**:
```javascript
// Example: Fetch project notes
{
    layout: 'devNotes',
    action: 'READ',
    query: [{ "_fkID": projectId }]
}
```

**Code References**:
- API queries: `src/api/projects.js:47-59`, `src/api/tasks.js:286-298`
- Create operation: `src/api/notes.js:8-24`
- Layout definition: `src/api/fileMaker.js:416`

## Proposed Supabase Schema

### Table: notes

**Design Rationale**:
We recommend **Option 1: Single table with nullable foreign keys** for the following reasons:
1. **Simplest to implement and maintain**
2. **Matches current FileMaker polymorphic pattern**
3. **Easy to query with standard indexes**
4. **Future-proof for additional entity types** (customers, prospects, etc.)
5. **PostgreSQL check constraint ensures data integrity**

**Alternative approaches considered**:
- Junction tables (project_notes, task_notes): More complex, harder to query all notes for an entity type
- parent_type + parent_id columns: Requires manual type checking, loses FK constraint benefits

```sql
-- Notes table with polymorphic associations
CREATE TABLE public.notes (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Organization scoping (required for RLS)
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Content fields
    note TEXT NOT NULL,
    type TEXT DEFAULT 'general',

    -- Polymorphic relationship fields (nullable FKs)
    -- Exactly one of these must be non-null
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Constraint: Exactly one parent FK must be set
    CONSTRAINT notes_single_parent_check CHECK (
        (
            (customer_id IS NOT NULL)::int +
            (project_id IS NOT NULL)::int +
            (task_id IS NOT NULL)::int
        ) = 1
    )
);

-- Comments for documentation
COMMENT ON TABLE public.notes IS 'Notes attached to projects, tasks, or customers with polymorphic associations';
COMMENT ON COLUMN public.notes.note IS 'Note content (plain text, future: rich text support)';
COMMENT ON COLUMN public.notes.type IS 'Note category: general (default), internal, customer, meeting, etc.';
COMMENT ON CONSTRAINT notes_single_parent_check ON public.notes IS 'Ensures exactly one parent entity FK is set';

-- Indexes for query performance
CREATE INDEX idx_notes_organization_id ON public.notes(organization_id);
CREATE INDEX idx_notes_customer_id ON public.notes(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_notes_project_id ON public.notes(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_notes_task_id ON public.notes(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX idx_notes_created_at ON public.notes(created_at DESC);
CREATE INDEX idx_notes_type ON public.notes(type);

-- Composite indexes for common queries
CREATE INDEX idx_notes_project_created ON public.notes(project_id, created_at DESC) WHERE project_id IS NOT NULL;
CREATE INDEX idx_notes_task_created ON public.notes(task_id, created_at DESC) WHERE task_id IS NOT NULL;

-- RLS Policies
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access notes in their organization
CREATE POLICY notes_organization_isolation ON public.notes
    FOR ALL
    USING (organization_id = (auth.jwt() -> 'user_metadata' ->> 'organization_id')::UUID);

-- Additional policies (optional, can be added for fine-grained control)
-- CREATE POLICY notes_select ON public.notes FOR SELECT USING (true);
-- CREATE POLICY notes_insert ON public.notes FOR INSERT WITH CHECK (created_by = auth.uid());
-- CREATE POLICY notes_update ON public.notes FOR UPDATE USING (created_by = auth.uid());
-- CREATE POLICY notes_delete ON public.notes FOR DELETE USING (created_by = auth.uid());

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER notes_updated_at_trigger
    BEFORE UPDATE ON public.notes
    FOR EACH ROW
    EXECUTE FUNCTION update_notes_updated_at();
```

## Field Mappings

| FileMaker Field | FileMaker Type | Supabase Field | Supabase Type | Transformation Notes |
|----------------|----------------|----------------|---------------|---------------------|
| `__ID` | Text/UUID | `id` | UUID | Direct mapping, preserve if possible for reference |
| `note` | Text | `note` | TEXT | Direct mapping, no transformation needed |
| `_fkID` | Text | `customer_id`, `project_id`, or `task_id` | UUID | **Requires type detection** - parse parent entity from ID structure or context |
| `type` | Text | `type` | TEXT | Direct mapping, defaults to 'general' |
| `~CreationTimestamp` | DateTime | `created_at` | TIMESTAMPTZ | Convert to ISO 8601 with timezone |
| `~ModificationTimestamp` | DateTime | `updated_at` | TIMESTAMPTZ | Convert to ISO 8601 with timezone |
| `~CreatedBy` | Text (email) | `created_by` | UUID | **Requires user lookup** - map email to Supabase auth.users UUID |
| N/A | N/A | `organization_id` | UUID | **New field** - must be inferred from parent entity's organization |
| N/A | N/A | `updated_by` | UUID | Set to `created_by` initially (no edit history in FileMaker) |

### Transformation Details

**1. Primary Key (_ID → id)**:
- FileMaker `__ID` may be text-based UUID
- Validate format: UUID v4 pattern
- If valid UUID: preserve as Supabase `id`
- If not valid: generate new UUID, store old ID in migration mapping table

**2. Foreign Key (_fkID → project_id/task_id/customer_id)**:
- **Detection Strategy**:
  ```sql
  -- Pseudo-algorithm for migration script
  CASE
    WHEN EXISTS (SELECT 1 FROM projects WHERE id = _fkID) THEN project_id = _fkID
    WHEN EXISTS (SELECT 1 FROM tasks WHERE id = _fkID) THEN task_id = _fkID
    WHEN EXISTS (SELECT 1 FROM customers WHERE id = _fkID) THEN customer_id = _fkID
    ELSE flag_for_review  -- Orphaned notes
  END
  ```
- **Parent Entity Must Exist**: Notes migration MUST occur AFTER projects, tasks, and customers are migrated
- **Orphaned Records**: Log and skip notes where parent entity cannot be found

**3. User Mapping (~CreatedBy → created_by)**:
- Extract email from FileMaker `~CreatedBy` field
- Query Supabase `auth.users` table for matching email
- If found: use UUID from auth.users
- If not found:
  - Option A: Create placeholder user account
  - Option B: Use system/migration user UUID
  - Option C: Store in separate migration_metadata JSON field

**4. Organization Inference (→ organization_id)**:
- Notes do not have direct organization_id in FileMaker
- **Derive from parent entity**:
  ```sql
  organization_id = (
    SELECT organization_id FROM projects WHERE id = project_id
    UNION
    SELECT organization_id FROM tasks WHERE id = task_id
    UNION
    SELECT organization_id FROM customers WHERE id = customer_id
  )
  ```

**5. Timestamps (FileMaker DateTime → PostgreSQL TIMESTAMPTZ)**:
- FileMaker format: "MM/DD/YYYY HH:MM:SS" (varies by locale)
- Target format: ISO 8601 with timezone
- Conversion: `TIMESTAMP '...' AT TIME ZONE 'America/Toronto'` (assuming server timezone)
- Preserve milliseconds if available (FileMaker precision varies)

## Relationship Mappings

### Project Relationship

**FileMaker**:
- Implicit relationship via `_fkID = project.recordId`
- Query: `SELECT * FROM devNotes WHERE _fkID = ?`
- Code: `src/api/projects.js:47-59`

**Supabase**:
- Explicit foreign key: `notes.project_id → projects.id`
- Constraint: `ON DELETE CASCADE` (deleting project deletes notes)
- Query: `SELECT * FROM notes WHERE project_id = ? ORDER BY created_at DESC`
- Index: `idx_notes_project_created` for optimized queries

**UI Integration**:
- Component: `src/components/projects/ProjectNotesTab.jsx`
- Loads with: `useProject.loadProjectDetails()` via `fetchProjectRelatedData()`
- Display format: Raw FileMaker structure → needs standardization

### Task Relationship

**FileMaker**:
- Implicit relationship via `_fkID = task.__ID`
- Query: `SELECT * FROM devNotes WHERE _fkID = ?`
- Code: `src/api/tasks.js:286-298`

**Supabase**:
- Explicit foreign key: `notes.task_id → tasks.id`
- Constraint: `ON DELETE CASCADE` (deleting task deletes notes)
- Query: `SELECT * FROM notes WHERE task_id = ? ORDER BY created_at DESC`
- Index: `idx_notes_task_created` for optimized queries

**UI Integration**:
- Component: `src/components/tasks/TaskList.jsx:108-131`
- Loads with: `useTask.handleTaskSelect()` via `taskService.loadTaskDetails()`
- Display format: Processed format via `taskService.processTaskNotes()`

### Customer Relationship

**FileMaker**:
- Schema supports customer notes (same `_fkID` pattern)
- **No current UI implementation**
- Not currently queried from frontend

**Supabase**:
- Explicit foreign key: `notes.customer_id → customers.id`
- Constraint: `ON DELETE CASCADE`
- Ready for future use when UI is built
- Index: `idx_notes_customer_id` for optimized queries

**Future Implementation**:
- Add `CustomerNotesTab.jsx` component
- Follow pattern from `ProjectNotesTab.jsx`
- Use same `useNote` hook for CRUD operations

### Organization Relationship (New)

**FileMaker**:
- No organization scoping in current implementation
- All users with access to parent entity see all notes

**Supabase**:
- Explicit foreign key: `notes.organization_id → organizations.id`
- Constraint: `ON DELETE CASCADE` (deleting org deletes notes)
- RLS policy enforces organization isolation
- Users can only see notes in their organization
- Must be set on creation, cannot be null

## Data Type Considerations

### Text Fields

**note (Note Content)**:
- Current: Plain text only, unlimited length
- Supabase: `TEXT` type (unlimited length)
- Validation:
  - NOT NULL constraint
  - Frontend trims whitespace: `note.trim()`
  - Minimum length: 1 character (after trim)
- Future enhancement: Rich text support (store as Markdown or HTML)
- Code reference: `src/services/noteService.js:11-17`

**type (Note Category)**:
- Current: Defaults to 'general', rarely used
- Supabase: `TEXT` type with default 'general'
- Validation:
  - Optional field (uses default if not provided)
  - No enum constraint initially (allow flexibility)
  - Future: Add enum or check constraint for known types
- Known values: 'general' (only value observed in code)
- Code reference: `src/api/notes.js:18`

### Date/Time Fields

**created_at (Creation Timestamp)**:
- FileMaker source: `~CreationTimestamp` (system field)
- Supabase type: `TIMESTAMPTZ` (timestamp with timezone)
- Timezone: Store in UTC, display in user's local timezone
- Default: `NOW()` for new records
- Migration: Convert FileMaker datetime to UTC
  ```sql
  -- Example conversion (adjust for FileMaker server timezone)
  created_at = TIMESTAMP '2024-01-10 10:30:00' AT TIME ZONE 'America/Toronto' AT TIME ZONE 'UTC'
  ```
- Precision: Milliseconds preserved if available
- NOT NULL constraint

**updated_at (Modification Timestamp)**:
- FileMaker source: `~ModificationTimestamp` (system field)
- Supabase type: `TIMESTAMPTZ`
- Default: `NOW()` for new records
- Auto-update: Trigger `update_notes_updated_at()` sets on every UPDATE
- Migration: Initially set equal to `created_at` (no edit history)
- NOT NULL constraint

### Foreign Keys

**Polymorphic Parent FKs (customer_id, project_id, task_id)**:
- Type: `UUID`
- Nullable: All three are nullable, but check constraint ensures exactly one is set
- Referential integrity:
  ```sql
  customer_id REFERENCES public.customers(id) ON DELETE CASCADE
  project_id REFERENCES public.projects(id) ON DELETE CASCADE
  task_id REFERENCES public.tasks(id) ON DELETE CASCADE
  ```
- Cascade deletion: Deleting parent entity deletes all associated notes
- Migration challenge: Must detect parent entity type from `_fkID`

**organization_id (Organization Scoping)**:
- Type: `UUID`
- Nullable: NOT NULL (required for RLS)
- Referential integrity: `REFERENCES public.organizations(id) ON DELETE CASCADE`
- Derived during migration from parent entity's organization
- Index: Required for RLS policy performance

**created_by / updated_by (User Tracking)**:
- Type: `UUID`
- Nullable: Yes (allows `ON DELETE SET NULL` if user deleted)
- Referential integrity: `REFERENCES auth.users(id) ON DELETE SET NULL`
- Migration: Map from email to user UUID
- Frontend: Set automatically via `auth.uid()` function

### Calculated Fields

**FileMaker**:
- No calculated fields in devNotes layout
- Sorting done client-side by creation timestamp

**Supabase**:
- No calculated fields needed initially
- Future possibilities:
  - `parent_entity_type` virtual column (computed from which FK is set)
  - `excerpt` for note previews (first 100 chars)
  - Full-text search indexes

## Migration Considerations

### Data Transformation

**Step-by-step Transformation Process**:

1. **Extract from FileMaker**:
   ```javascript
   // Export all records from devNotes layout
   const notes = await fetchDataFromFileMaker({
       layout: 'devNotes',
       action: 'READ',
       query: [] // All records
   });
   ```

2. **Parent Entity Detection**:
   ```javascript
   // For each note, determine parent type
   for (const note of notes) {
       const fkId = note.fieldData._fkID;

       // Check projects first (most common)
       const project = await supabase
           .from('projects')
           .select('id, organization_id')
           .eq('id', fkId)
           .single();

       if (project.data) {
           note.project_id = fkId;
           note.organization_id = project.data.organization_id;
           continue;
       }

       // Check tasks
       const task = await supabase
           .from('tasks')
           .select('id, project_id')
           .eq('id', fkId)
           .single();

       if (task.data) {
           note.task_id = fkId;
           // Get org from task's project
           const project = await supabase
               .from('projects')
               .select('organization_id')
               .eq('id', task.data.project_id)
               .single();
           note.organization_id = project.data.organization_id;
           continue;
       }

       // Check customers
       const customer = await supabase
           .from('customers')
           .select('id, organization_id')
           .eq('id', fkId)
           .single();

       if (customer.data) {
           note.customer_id = fkId;
           note.organization_id = customer.data.organization_id;
           continue;
       }

       // Orphaned note - log for review
       console.warn('Orphaned note:', note.fieldData.__ID, fkId);
   }
   ```

3. **User Mapping**:
   ```javascript
   // Map creator emails to user UUIDs
   const creatorEmail = note.fieldData['~CreatedBy'];
   const user = await supabase
       .from('auth.users')
       .select('id')
       .eq('email', creatorEmail)
       .single();

   note.created_by = user.data?.id || MIGRATION_USER_UUID;
   note.updated_by = note.created_by; // Initially same
   ```

4. **Timestamp Conversion**:
   ```javascript
   // Convert FileMaker timestamps
   note.created_at = convertFileMakerTimestamp(note.fieldData['~CreationTimestamp']);
   note.updated_at = convertFileMakerTimestamp(note.fieldData['~ModificationTimestamp']);
   ```

5. **Insert into Supabase**:
   ```javascript
   const { error } = await supabase.from('notes').insert({
       id: note.fieldData.__ID, // Preserve if valid UUID
       organization_id: note.organization_id,
       note: note.fieldData.note,
       type: note.fieldData.type || 'general',
       customer_id: note.customer_id || null,
       project_id: note.project_id || null,
       task_id: note.task_id || null,
       created_at: note.created_at,
       updated_at: note.updated_at,
       created_by: note.created_by,
       updated_by: note.updated_by
   });
   ```

### Default Values

| Field | Default Value | Source | Notes |
|-------|---------------|--------|-------|
| `id` | `gen_random_uuid()` | PostgreSQL | Auto-generated if not provided |
| `type` | `'general'` | SQL DEFAULT | Matches FileMaker behavior |
| `created_at` | `NOW()` | SQL DEFAULT | Current timestamp for new records |
| `updated_at` | `NOW()` | SQL DEFAULT | Auto-updated by trigger |
| `created_by` | `auth.uid()` | Application | Set by frontend on INSERT |
| `updated_by` | `auth.uid()` | Trigger | Auto-set by trigger on UPDATE |
| `customer_id` | `NULL` | SQL | Explicitly null unless set |
| `project_id` | `NULL` | SQL | Explicitly null unless set |
| `task_id` | `NULL` | SQL | Explicitly null unless set |

### Null Handling

**NOT NULL Fields** (migration must provide):
- `organization_id` - CRITICAL: Must be derived from parent entity
- `note` - Content cannot be empty (validated in frontend)
- `created_at` - Use FileMaker timestamp or NOW()
- `updated_at` - Use FileMaker timestamp or NOW()

**Nullable Fields** (can be NULL):
- `customer_id`, `project_id`, `task_id` - Only one set per record
- `created_by`, `updated_by` - Null if user mapping fails (use fallback)
- `type` - Will use default 'general' if null

**Orphaned Records**:
- Notes where `_fkID` doesn't match any entity
- Migration options:
  1. Skip and log for manual review
  2. Create special "orphaned_notes" table for preservation
  3. Attach to "unknown" customer/project for investigation

### Data Validation

**Check Constraint (Enforced by PostgreSQL)**:
```sql
CONSTRAINT notes_single_parent_check CHECK (
    (
        (customer_id IS NOT NULL)::int +
        (project_id IS NOT NULL)::int +
        (task_id IS NOT NULL)::int
    ) = 1
)
```
- Ensures exactly one parent FK is set
- Migration script must validate before INSERT
- Frontend must provide exactly one parent ID

**Application-Level Validation** (Frontend - `src/services/noteService.js:11-13`):
```javascript
if (!fkId || !note?.trim()) {
    throw new Error('Task ID and note content are required');
}
```
- Empty content rejected
- Whitespace trimmed
- Parent ID required

**Migration Validation Checks**:
```javascript
// Pre-migration validation
const validationErrors = [];

for (const note of notes) {
    // Check required fields
    if (!note.fieldData.note?.trim()) {
        validationErrors.push({ id: note.fieldData.__ID, error: 'Empty note content' });
    }

    // Check parent exists
    if (!note.project_id && !note.task_id && !note.customer_id) {
        validationErrors.push({ id: note.fieldData.__ID, error: 'No parent entity found' });
    }

    // Check organization_id resolved
    if (!note.organization_id) {
        validationErrors.push({ id: note.fieldData.__ID, error: 'No organization_id' });
    }

    // Check exactly one parent
    const parentCount = [note.project_id, note.task_id, note.customer_id].filter(Boolean).length;
    if (parentCount !== 1) {
        validationErrors.push({ id: note.fieldData.__ID, error: `${parentCount} parents set, expected 1` });
    }
}

// Report validation errors before migration
if (validationErrors.length > 0) {
    console.error('Migration validation failed:', validationErrors);
    // Decide: Fix errors or skip invalid records
}
```

## Organization Scoping

### RLS Strategy

**Row-Level Security Policy**:
```sql
CREATE POLICY notes_organization_isolation ON public.notes
    FOR ALL
    USING (organization_id = (auth.jwt() -> 'user_metadata' ->> 'organization_id')::UUID);
```

**How it Works**:
1. User authenticates via Supabase Auth
2. JWT token includes `user_metadata.organization_id`
3. Every query automatically filtered by policy: `WHERE organization_id = {user's org}`
4. Users cannot see/modify notes from other organizations
5. No application code changes needed - enforced at database level

**Index for Performance**:
```sql
CREATE INDEX idx_notes_organization_id ON public.notes(organization_id);
```
- RLS policy uses this index for every query
- Critical for performance with large datasets
- Should be created BEFORE migrating data

### Multi-tenancy Requirements

**Organization Isolation**:
- **Hard Boundary**: Users CANNOT access notes from other organizations
- **No Cross-Org Queries**: Even admins restricted by RLS
- **Audit Trail**: Track which user created/modified notes

**Data Segregation**:
- Every note MUST have `organization_id`
- Parent entities (projects, tasks, customers) already have `organization_id`
- Notes inherit organization from parent
- Migration MUST correctly set `organization_id`

**Testing Requirements**:
```javascript
// Test case: Organization isolation
describe('Notes RLS', () => {
    it('should not allow access to notes from other organizations', async () => {
        // User A from Org 1
        const userA = await loginAs('user-a@org1.com');

        // User B from Org 2
        const userB = await loginAs('user-b@org2.com');

        // User A creates note on their project
        const { data: noteA } = await userA.from('notes').insert({
            note: 'Org 1 note',
            project_id: org1ProjectId,
            organization_id: org1Id
        });

        // User B should NOT see User A's note
        const { data: notesB } = await userB.from('notes').select('*');
        expect(notesB).not.toContainEqual(noteA);

        // User B cannot update User A's note
        const { error } = await userB.from('notes')
            .update({ note: 'Hacked!' })
            .eq('id', noteA.id);
        expect(error).toBeDefined();
    });
});
```

**Migration Script Organization Handling**:
```javascript
// Ensure organization_id is set correctly during migration
const migrateNote = async (fmNote) => {
    // Get organization from parent entity
    let organizationId;

    if (fmNote.project_id) {
        const project = await supabase
            .from('projects')
            .select('organization_id')
            .eq('id', fmNote.project_id)
            .single();
        organizationId = project.data.organization_id;
    } else if (fmNote.task_id) {
        // Tasks don't have direct org_id, get from project
        const task = await supabase
            .from('tasks')
            .select('project_id')
            .eq('id', fmNote.task_id)
            .single();
        const project = await supabase
            .from('projects')
            .select('organization_id')
            .eq('id', task.data.project_id)
            .single();
        organizationId = project.data.organization_id;
    } else if (fmNote.customer_id) {
        const customer = await supabase
            .from('customers')
            .select('organization_id')
            .eq('id', fmNote.customer_id)
            .single();
        organizationId = customer.data.organization_id;
    }

    if (!organizationId) {
        throw new Error(`Cannot determine organization for note ${fmNote.__ID}`);
    }

    return { ...fmNote, organization_id: organizationId };
};
```

## Performance Considerations

### Index Strategy

**Primary Indexes** (created above):
- `idx_notes_organization_id` - RLS policy performance
- `idx_notes_customer_id` - Customer notes queries (partial index)
- `idx_notes_project_id` - Project notes queries (partial index)
- `idx_notes_task_id` - Task notes queries (partial index)
- `idx_notes_created_at` - Sorting by creation date
- `idx_notes_type` - Filtering by note type

**Composite Indexes** (optimized for common queries):
- `idx_notes_project_created` - Project notes sorted by date
- `idx_notes_task_created` - Task notes sorted by date

**Query Performance Examples**:
```sql
-- Fast: Uses idx_notes_project_created
SELECT * FROM notes
WHERE project_id = '123'
ORDER BY created_at DESC;

-- Fast: Uses idx_notes_organization_id + idx_notes_type
SELECT * FROM notes
WHERE organization_id = '456' AND type = 'general';

-- Fast: Uses partial index idx_notes_task_id
SELECT * FROM notes
WHERE task_id = '789';
```

### Query Patterns

**Current FileMaker Queries**:
```javascript
// Fetch all notes for a project
query: [{ "_fkID": projectId }]

// Fetch all notes for a task
query: [{ "_fkID": taskId }]
```

**Equivalent Supabase Queries**:
```javascript
// Project notes
const { data } = await supabase
    .from('notes')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

// Task notes
const { data } = await supabase
    .from('notes')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

// Notes with user details (JOIN)
const { data } = await supabase
    .from('notes')
    .select(`
        *,
        created_by_user:auth.users!created_by(email, full_name)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
```

## References

### Documentation Standards
- Follow pattern from `BACKEND_CHANGE_REQUEST_002_TEAMS_MIGRATION.md`
- Standardized template structure
- Include code references with file paths and line numbers

### Database Access
- Supabase database container: `supabase-db`
- Database user: `postgres`
- Database name: `postgres`
- Schema: `public`

### Code References
- FileMaker layout: `src/api/fileMaker.js:416`
- Create API: `src/api/notes.js:8-24`
- Project notes API: `src/api/projects.js:47-59`
- Task notes API: `src/api/tasks.js:286-298`
- Note service: `src/services/noteService.js`
- Task service: `src/services/taskService.js:207-223`
- useNote hook: `src/hooks/useNote.js`
- useProject hook: `src/hooks/useProject.js:95-137`
- useTask hook: `src/hooks/useTask.js:80-105`
- ProjectNotesTab: `src/components/projects/ProjectNotesTab.jsx`
- TaskList: `src/components/tasks/TaskList.jsx:108-131, 201-217`

### Related Documentation
- `requirements/notes/current-implementation.md` - Detailed behavior documentation
- `requirements/notes/api-contracts.md` - Backend API specifications
- `requirements/notes/authorization.md` - RLS policies and access control
- `requirements/notes/migration-plan.md` - Data migration strategy
- `requirements/notes/acceptance-criteria.md` - Test cases and validation

## Notes

### Critical Requirements
- All notes MUST include `organization_id` for RLS
- Use UUID for primary keys (preserve FileMaker `__ID` if valid)
- Include `created_at`/`updated_at` timestamps
- Include `created_by`/`updated_by` user tracking
- Exactly one parent FK (customer_id, project_id, or task_id) must be set
- Migration MUST occur AFTER parent entities (projects, tasks, customers)

### Future Enhancements
- Rich text support (store as Markdown or HTML)
- Note attachments (files, images)
- @mentions and notifications
- Note templates for common types
- Full-text search capability
- Note versioning/edit history
- Note categories/tags (beyond simple 'type')
- Note privacy levels (internal vs. customer-visible)

### Backend Team Action Items
1. Create `notes` table with schema defined above
2. Create indexes for query performance
3. Implement RLS policies for organization isolation
4. Create triggers for auto-updating `updated_at` and `updated_by`
5. Test check constraint for single parent enforcement
6. Provide migration script template
7. Create API endpoints/RPCs (see `api-contracts.md`)
8. Set up test data with multiple organizations for RLS testing
