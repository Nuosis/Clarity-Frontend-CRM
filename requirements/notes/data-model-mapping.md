# Notes Feature - Data Model Mapping

## FileMaker Schema

### Table: [TO BE DOCUMENTED]
[TO BE DOCUMENTED - Document the FileMaker table structure]

```
Table: [table_name]
Fields:
  - field_name (type) - description
  - ...

Relationships:
  - relationship_name → target_table
```

## Proposed Supabase Schema

### Table: notes

```sql
-- TO BE DOCUMENTED - Replace with actual schema
CREATE TABLE public.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Content fields
    [TO BE DOCUMENTED]

    -- Relationship fields
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_notes_organization_id ON public.notes(organization_id);
CREATE INDEX idx_notes_customer_id ON public.notes(customer_id);
CREATE INDEX idx_notes_project_id ON public.notes(project_id);
CREATE INDEX idx_notes_created_at ON public.notes(created_at DESC);

-- RLS Policies
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access notes in their organization
CREATE POLICY notes_organization_isolation ON public.notes
    FOR ALL
    USING (organization_id = auth.jwt() -> 'user_metadata' ->> 'organization_id'::UUID);
```

## Field Mappings

| FileMaker Field | Type | Supabase Field | Type | Notes |
|----------------|------|----------------|------|-------|
| [TO BE DOCUMENTED] | | | | |

## Relationship Mappings

### Customer Relationship
[TO BE DOCUMENTED]

### Project Relationship
[TO BE DOCUMENTED]

### Other Relationships
[TO BE DOCUMENTED]

## Data Type Considerations

### Text Fields
[TO BE DOCUMENTED - Any special handling for text fields]

### Date/Time Fields
[TO BE DOCUMENTED - Timezone handling, format conversions]

### Foreign Keys
[TO BE DOCUMENTED - How relationships are enforced]

### Calculated Fields
[TO BE DOCUMENTED - Any FileMaker calculations that need backend implementation]

## Migration Considerations

### Data Transformation
[TO BE DOCUMENTED - Any data that needs transformation during migration]

### Default Values
[TO BE DOCUMENTED - Default values for new fields]

### Null Handling
[TO BE DOCUMENTED - How nulls are handled in migration]

### Data Validation
[TO BE DOCUMENTED - Validation rules to enforce]

## Organization Scoping

### RLS Strategy
[TO BE DOCUMENTED - How organization isolation is enforced]

### Multi-tenancy Requirements
[TO BE DOCUMENTED - Organization-specific requirements]

## References
- Follow pattern from `BACKEND_CHANGE_REQUEST_002_TEAMS_MIGRATION.md`
- Supabase database container: `supabase-db`
- Database user: `postgres`, Database: `postgres`

## Notes
- All tables must include `organization_id` for RLS
- Use UUID for primary keys
- Include created_at/updated_at timestamps
- Include created_by/updated_by user tracking
