# Notes Feature - Authorization Requirements

## Row Level Security (RLS) Policies

### Organization Isolation
**Requirement:** Users can only access notes within their organization.

```sql
-- TO BE DOCUMENTED - Replace with actual policy
CREATE POLICY notes_organization_isolation ON public.notes
    FOR ALL
    USING (organization_id = (auth.jwt() -> 'user_metadata' ->> 'organization_id')::UUID);
```

**Enforcement:**
- All queries automatically filtered by organization_id
- Cross-organization access strictly prohibited
- Organization ID derived from JWT user_metadata

---

### Read Access
**Requirement:** [TO BE DOCUMENTED - Who can read notes?]

```sql
-- Example policy structure
CREATE POLICY notes_read_access ON public.notes
    FOR SELECT
    USING (
        -- TO BE DOCUMENTED
        -- Options:
        -- 1. All users in organization can read all notes
        -- 2. Users can only read notes they created
        -- 3. Notes are public within organization
        -- 4. Role-based access (admin, manager, user)
    );
```

---

### Create Access
**Requirement:** [TO BE DOCUMENTED - Who can create notes?]

```sql
-- Example policy structure
CREATE POLICY notes_create_access ON public.notes
    FOR INSERT
    WITH CHECK (
        -- TO BE DOCUMENTED
        organization_id = (auth.jwt() -> 'user_metadata' ->> 'organization_id')::UUID
        AND [additional_conditions]
    );
```

---

### Update Access
**Requirement:** [TO BE DOCUMENTED - Who can update notes?]

```sql
-- Example policy structure
CREATE POLICY notes_update_access ON public.notes
    FOR UPDATE
    USING (
        -- TO BE DOCUMENTED
        -- Options:
        -- 1. Only creator can update
        -- 2. Admins can update any note
        -- 3. Time-based restrictions (e.g., can't edit after 24 hours)
    )
    WITH CHECK (
        -- TO BE DOCUMENTED
        organization_id = (auth.jwt() -> 'user_metadata' ->> 'organization_id')::UUID
    );
```

---

### Delete Access
**Requirement:** [TO BE DOCUMENTED - Who can delete notes?]

```sql
-- Example policy structure
CREATE POLICY notes_delete_access ON public.notes
    FOR DELETE
    USING (
        -- TO BE DOCUMENTED
        -- Options:
        -- 1. Only creator can delete
        -- 2. Only admins can delete
        -- 3. Soft delete vs hard delete
    );
```

---

## User Roles

### Role Definitions
[TO BE DOCUMENTED - Define roles if role-based access is needed]

Example:
- **Admin:** Full access to all notes in organization
- **Manager:** Can view and edit team notes
- **User:** Can only manage own notes
- **Viewer:** Read-only access

### Role Assignment
[TO BE DOCUMENTED - How roles are assigned and stored]

---

## Permission Matrix

| Action | Admin | Manager | User | Viewer |
|--------|-------|---------|------|--------|
| Create Note | [TO BE DOCUMENTED] | | | |
| View Own Notes | [TO BE DOCUMENTED] | | | |
| View All Notes | [TO BE DOCUMENTED] | | | |
| Edit Own Notes | [TO BE DOCUMENTED] | | | |
| Edit All Notes | [TO BE DOCUMENTED] | | | |
| Delete Own Notes | [TO BE DOCUMENTED] | | | |
| Delete All Notes | [TO BE DOCUMENTED] | | | |

---

## Customer/Project Access Control

### Customer-Linked Notes
[TO BE DOCUMENTED - Access control for notes linked to customers]

Example considerations:
- Can users see notes for customers they don't manage?
- Are customer notes organization-wide visible?
- Any special privacy requirements?

### Project-Linked Notes
[TO BE DOCUMENTED - Access control for notes linked to projects]

Example considerations:
- Can users see notes for projects they're not assigned to?
- Are project notes restricted to team members?
- Any project-level privacy settings?

---

## Privacy and Compliance

### Data Privacy
[TO BE DOCUMENTED - Any PII or sensitive data handling requirements]

### Audit Trail
**Requirement:** Track who creates, updates, and deletes notes

Fields required:
- `created_by` (UUID) - User who created the note
- `updated_by` (UUID) - User who last updated the note
- `created_at` (TIMESTAMPTZ) - Creation timestamp
- `updated_at` (TIMESTAMPTZ) - Last update timestamp

### Data Retention
[TO BE DOCUMENTED - Any retention policies or soft delete requirements]

---

## Security Considerations

### SQL Injection Prevention
- Use parameterized queries
- Validate all input at API layer
- Sanitize user-generated content

### XSS Prevention
- Escape HTML in note content
- Use Content Security Policy
- Sanitize on display

### CSRF Protection
- Verify HMAC signatures
- Check origin headers
- Use secure session tokens

### Rate Limiting
[TO BE DOCUMENTED - Any rate limiting requirements]

Example:
- 100 requests per minute per user
- 1000 notes created per day per organization

---

## Backend Validation

### Required Validations
[TO BE DOCUMENTED - Server-side validation rules]

Example:
- Note content max length
- Required fields validation
- Foreign key validation (customer_id, project_id exist)
- Organization ID matches authenticated user

---

## JWT Claims

### Required Claims
```json
{
  "sub": "user_uuid",
  "user_metadata": {
    "organization_id": "org_uuid",
    "role": "user_role",
    "[TO BE DOCUMENTED]": "..."
  }
}
```

### Claim Validation
[TO BE DOCUMENTED - How claims are validated and used]

---

## References
- Supabase RLS Documentation: https://supabase.com/docs/guides/auth/row-level-security
- Teams RLS Example: `BACKEND_CHANGE_REQUEST_002_TEAMS_MIGRATION.md`
- Auth Service: `src/services/supabaseService.js`

## Notes
- All RLS policies must enforce organization isolation
- Test policies with users from different organizations
- Document any exceptions to standard access rules
- Consider performance impact of complex RLS policies
