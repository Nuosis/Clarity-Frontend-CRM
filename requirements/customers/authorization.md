# Authorization Requirements

This document specifies Row-Level Security (RLS) policies, organization scoping, role-based permissions, and access control requirements for the Customers feature.

## Overview

**Multi-Tenancy Model**: Organization-based isolation
**Authorization Layer**: Supabase Row-Level Security (RLS) policies
**Authentication**: Supabase JWT with custom claims (`organization_id`, `role`)
**Permission Model**: Role-based access control (RBAC)

## Organization Scoping

### Requirements

1. **Complete Data Isolation**: Users can ONLY access customers belonging to their organization
2. **Automatic Scoping**: All queries automatically filtered by `organization_id` via RLS
3. **No Cross-Org Leakage**: Even with direct Supabase queries, users cannot access other org's data
4. **Organization Linking**: Customers linked to organizations via `customer_organization` junction table

### JWT Claims Structure

Supabase JWT must include custom claims:

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "app_metadata": {
    "organization_id": "org-uuid",
    "role": "admin"
  },
  "user_metadata": {
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

**Required Claims**:
- `app_metadata.organization_id` (UUID) - User's organization
- `app_metadata.role` (string) - User's role within organization

## Role Definitions

### 1. Admin
- **Full CRUD access** to all customers in organization
- Can create, read, update, delete customers
- Can toggle customer active status
- Can assign customers to projects/users
- Can view all financial data

### 2. Staff
- **Read and update access** to customers
- Can create customers
- Can update customers
- **Cannot delete** customers
- Can toggle customer active status
- Can view customer financial data

### 3. Read-Only
- **Read-only access** to customers
- Can view customer list and details
- **Cannot create, update, or delete** customers
- **Cannot toggle** customer active status
- Can view basic customer info (no financial data)

### 4. External (Future)
- **No direct access** to customers table
- Can only view customers associated with specific projects they're assigned to
- Read-only access to limited fields

## Row-Level Security Policies

### Policy 1: customers SELECT (Read)

**Purpose**: Users can view customers in their organization

```sql
CREATE POLICY "Users can view organization customers"
ON customers
FOR SELECT
USING (
  organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  AND
  (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'staff', 'read_only')
);
```

**Logic**:
- Customer's `organization_id` matches user's JWT claim `organization_id`
- User has any role (admin, staff, read_only)

### Policy 2: customers INSERT (Create)

**Purpose**: Admins and staff can create customers

```sql
CREATE POLICY "Admins and staff can create customers"
ON customers
FOR INSERT
WITH CHECK (
  organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  AND
  (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'staff')
);
```

**Logic**:
- New customer's `organization_id` matches user's organization
- User role is admin or staff
- Prevents read-only users from creating customers

### Policy 3: customers UPDATE (Modify)

**Purpose**: Admins and staff can update customers

```sql
CREATE POLICY "Admins and staff can update customers"
ON customers
FOR UPDATE
USING (
  organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  AND
  (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'staff')
)
WITH CHECK (
  organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
);
```

**Logic**:
- USING: Can only update customers in their organization
- WITH CHECK: Cannot change `organization_id` to another org (prevents data theft)
- User role is admin or staff

### Policy 4: customers DELETE (Remove)

**Purpose**: Only admins can delete customers

```sql
CREATE POLICY "Only admins can delete customers"
ON customers
FOR DELETE
USING (
  organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  AND
  (current_setting('request.jwt.claims', true)::json->>'role') = 'admin'
);
```

**Logic**:
- Can only delete customers in their organization
- User role must be admin
- Staff and read-only cannot delete

### Policy 5: customer_email SELECT

**Purpose**: Users can view emails for customers in their organization

```sql
CREATE POLICY "Users can view customer emails"
ON customer_email
FOR SELECT
USING (
  customer_id IN (
    SELECT id FROM customers
    WHERE organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  )
  AND
  (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'staff', 'read_only')
);
```

**Alternative (More Efficient)**:
```sql
CREATE POLICY "Users can view customer emails"
ON customer_email
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM customer_organization co
    WHERE co.customer_id = customer_email.customer_id
    AND co.organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  )
  AND
  (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'staff', 'read_only')
);
```

### Policy 6: customer_email INSERT/UPDATE/DELETE

**Purpose**: Admins and staff can manage customer emails

```sql
CREATE POLICY "Admins and staff can manage customer emails"
ON customer_email
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM customer_organization co
    WHERE co.customer_id = customer_email.customer_id
    AND co.organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  )
  AND
  (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'staff')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM customer_organization co
    WHERE co.customer_id = customer_email.customer_id
    AND co.organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  )
);
```

### Policy 7-8: customer_phone Policies

**Similar to customer_email policies**:
- SELECT: All roles can view
- INSERT/UPDATE/DELETE: Only admin and staff

```sql
-- SELECT
CREATE POLICY "Users can view customer phones"
ON customer_phone FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM customer_organization co
    WHERE co.customer_id = customer_phone.customer_id
    AND co.organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  )
  AND (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'staff', 'read_only')
);

-- INSERT/UPDATE/DELETE
CREATE POLICY "Admins and staff can manage customer phones"
ON customer_phone FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM customer_organization co
    WHERE co.customer_id = customer_phone.customer_id
    AND co.organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  )
  AND (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'staff')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM customer_organization co
    WHERE co.customer_id = customer_phone.customer_id
    AND co.organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  )
);
```

### Policy 9-10: customer_address Policies

**Similar to customer_email/phone**:

```sql
-- SELECT
CREATE POLICY "Users can view customer addresses"
ON customer_address FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM customer_organization co
    WHERE co.customer_id = customer_address.customer_id
    AND co.organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  )
  AND (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'staff', 'read_only')
);

-- INSERT/UPDATE/DELETE
CREATE POLICY "Admins and staff can manage customer addresses"
ON customer_address FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM customer_organization co
    WHERE co.customer_id = customer_address.customer_id
    AND co.organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  )
  AND (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'staff')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM customer_organization co
    WHERE co.customer_id = customer_address.customer_id
    AND co.organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  )
);
```

### Policy 11: customer_organization Policies

**Purpose**: Manage customer-organization relationships

```sql
-- SELECT: Users can view relationships for their org
CREATE POLICY "Users can view customer-org links"
ON customer_organization FOR SELECT
USING (
  organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  AND (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'staff', 'read_only')
);

-- INSERT/UPDATE/DELETE: Only admins
CREATE POLICY "Only admins can manage customer-org links"
ON customer_organization FOR ALL
USING (
  organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  AND (current_setting('request.jwt.claims', true)::json->>'role') = 'admin'
)
WITH CHECK (
  organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
);
```

## Enable RLS

All customer-related tables must have RLS enabled:

```sql
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_email ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_phone ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_address ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;
```

## Backend Service Role Access

Backend services (API server) should use Supabase service role key for operations that need to bypass RLS:

**Use Cases**:
- System-level operations (data migrations, backups)
- Admin operations on behalf of users
- Background jobs (data cleanup, reconciliation)

**Security**:
- Service role key stored in backend environment variables (never exposed to frontend)
- Backend authenticates API requests via HMAC
- Backend sets appropriate RLS context before database operations

**Example (Backend)**:
```javascript
// Backend API endpoint
app.post('/api/customers', authenticateRequest, async (req, res) => {
  const { organizationId, role } = req.user; // From JWT

  // Set RLS context for this request
  const { data, error } = await supabase.rpc('set_user_context', {
    p_organization_id: organizationId,
    p_role: role
  });

  // Now all subsequent queries respect RLS policies
  const result = await supabase
    .from('customers')
    .insert(req.body);

  res.json(result);
});
```

## Permission Matrix

| Operation | Admin | Staff | Read-Only | External |
|-----------|-------|-------|-----------|----------|
| **Customers** |
| List customers | ✅ | ✅ | ✅ | ❌ |
| View customer details | ✅ | ✅ | ✅ | ❌ |
| Search customers | ✅ | ✅ | ✅ | ❌ |
| Create customer | ✅ | ✅ | ❌ | ❌ |
| Update customer | ✅ | ✅ | ❌ | ❌ |
| Toggle active status | ✅ | ✅ | ❌ | ❌ |
| Delete customer | ✅ | ❌ | ❌ | ❌ |
| **Emails** |
| View emails | ✅ | ✅ | ✅ | ❌ |
| Add/update email | ✅ | ✅ | ❌ | ❌ |
| Delete email | ✅ | ✅ | ❌ | ❌ |
| **Phones** |
| View phones | ✅ | ✅ | ✅ | ❌ |
| Add/update phone | ✅ | ✅ | ❌ | ❌ |
| Delete phone | ✅ | ✅ | ❌ | ❌ |
| **Addresses** |
| View addresses | ✅ | ✅ | ✅ | ❌ |
| Add/update address | ✅ | ✅ | ❌ | ❌ |
| Delete address | ✅ | ✅ | ❌ | ❌ |
| **Financial** |
| View financial summary | ✅ | ✅ | ❌ | ❌ |
| View detailed records | ✅ | ❌ | ❌ | ❌ |

## Edge Cases & Security Considerations

### 1. User Changes Organization

**Scenario**: User switches from Org A to Org B
**Expected Behavior**:
- JWT refreshed with new `organization_id`
- All queries now filtered to Org B customers only
- Previous Org A data no longer accessible

**Implementation**: Frontend must refresh Supabase session when user switches orgs.

### 2. Customer Belongs to Multiple Organizations

**Scenario**: Customer linked to Org A and Org B (rare, but supported via `customer_organization`)
**Expected Behavior**:
- User in Org A sees customer
- User in Org B sees same customer
- Changes made by Org A user visible to Org B user

**Implementation**: `customer_organization` table supports many-to-many relationship.

### 3. Customer Deleted from One Org

**Scenario**: Customer linked to Org A and Org B, Org A deletes customer
**Expected Behavior**:
- `customer_organization` link removed for Org A
- Customer still accessible to Org B
- If last org link removed → customer orphaned (should be prevented)

**Implementation**:
```sql
-- Prevent deleting last organization link
CREATE FUNCTION prevent_orphan_customers()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM customer_organization
    WHERE customer_id = OLD.customer_id AND customer_id != OLD.customer_id
  ) THEN
    RAISE EXCEPTION 'Cannot remove last organization link for customer';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_orphan_customers
BEFORE DELETE ON customer_organization
FOR EACH ROW
EXECUTE FUNCTION prevent_orphan_customers();
```

### 4. Attempting to Change Organization ID

**Scenario**: Malicious user attempts to update customer's `organization_id` to another org
**Expected Behavior**:
- RLS policy `WITH CHECK` clause prevents update
- Error returned: "Policy violation"
- Customer remains in original org

**Implementation**: `WITH CHECK` in UPDATE policy ensures `organization_id` doesn't change.

### 5. Direct Supabase Client Access

**Scenario**: User uses Supabase client library directly (bypassing backend API)
**Expected Behavior**:
- RLS policies still enforced
- User can only access customers in their org
- No data leakage even with direct access

**Implementation**: RLS policies applied at database level (not application level).

## Testing RLS Policies

### Test Case 1: User A Cannot See Org B Customers

```sql
-- Set user context to Org A
SET request.jwt.claims = '{"organization_id": "org-a-uuid", "role": "admin"}';

-- Query customers
SELECT * FROM customers;
-- Expected: Only customers linked to Org A

-- Attempt to access Org B customer
SELECT * FROM customers WHERE id = 'org-b-customer-uuid';
-- Expected: Empty result (not an error, just no rows)
```

### Test Case 2: Staff Cannot Delete Customers

```sql
-- Set user context to Staff role
SET request.jwt.claims = '{"organization_id": "org-uuid", "role": "staff"}';

-- Attempt to delete
DELETE FROM customers WHERE id = 'customer-uuid';
-- Expected: Error "Policy violation on customers for DELETE"
```

### Test Case 3: Read-Only Cannot Update

```sql
-- Set user context to Read-Only role
SET request.jwt.claims = '{"organization_id": "org-uuid", "role": "read_only"}';

-- Attempt to update
UPDATE customers SET business_name = 'New Name' WHERE id = 'customer-uuid';
-- Expected: Error "Policy violation on customers for UPDATE"
```

## Frontend Authorization Logic

Frontend should also enforce permissions for UI/UX (not security):

**src/hooks/usePermissions.js**:
```javascript
export function usePermissions() {
  const { user } = useAppState();

  return {
    canCreateCustomer: ['admin', 'staff'].includes(user.role),
    canUpdateCustomer: ['admin', 'staff'].includes(user.role),
    canDeleteCustomer: ['admin'].includes(user.role),
    canViewFinancial: ['admin', 'staff'].includes(user.role),
  };
}
```

**Usage in Components**:
```javascript
const { canDeleteCustomer } = usePermissions();

return (
  <div>
    {canDeleteCustomer && (
      <button onClick={handleDelete}>Delete Customer</button>
    )}
  </div>
);
```

**Important**: Frontend permissions are for UI only. Backend RLS is the authoritative security layer.

## Audit Logging

All customer operations should be logged for security and compliance:

**audit_log Table**:
```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  action TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
  entity_type TEXT NOT NULL, -- 'customer', 'customer_email', etc.
  entity_id UUID NOT NULL,
  changes JSONB, -- Old and new values
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at);
```

**Automatic Audit Logging via Trigger**:
```sql
CREATE FUNCTION log_customer_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    user_id,
    organization_id,
    action,
    entity_type,
    entity_id,
    changes
  ) VALUES (
    (current_setting('request.jwt.claims', true)::json->>'sub')::uuid,
    (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid,
    TG_OP,
    'customer',
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_customers
AFTER INSERT OR UPDATE OR DELETE ON customers
FOR EACH ROW EXECUTE FUNCTION log_customer_changes();
```

## Summary

**RLS Policies**: 11 policies across 5 tables (customers, customer_email, customer_phone, customer_address, customer_organization)

**Role-Based Access**:
- Admin: Full CRUD access
- Staff: Read + Create + Update (no delete)
- Read-Only: Read-only access

**Organization Scoping**: Complete data isolation via `organization_id` filtering

**Security Layers**:
1. RLS policies (database-level, authoritative)
2. Backend API validation (application-level)
3. Frontend permissions (UI/UX only, not security)

**Next Steps**: Implement RLS policies as part of backend schema migration.
