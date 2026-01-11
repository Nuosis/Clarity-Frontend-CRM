# Authorization Requirements - Customers Migration

## Overview

This document specifies Row-Level Security (RLS) policies, organization scoping, role-based permissions, and access control requirements for migrating the Customers feature from FileMaker to Supabase.

**Document Version**: 1.0
**Last Updated**: 2026-01-10
**Status**: Requirements Definition
**Related Documents**:
- [API Endpoint Contracts](./api-contracts.md)
- [Data Model Mapping](./data-model-mapping.md)
- [Supabase Schema](./supabase-schema.md)

---

## Table of Contents

1. [Authorization Model Overview](#authorization-model-overview)
2. [Organization Scoping](#organization-scoping)
3. [Role Definitions](#role-definitions)
4. [Row-Level Security Policies](#row-level-security-policies)
5. [Backend Service Role Access](#backend-service-role-access)
6. [Permission Matrix](#permission-matrix)
7. [Frontend Authorization Logic](#frontend-authorization-logic)
8. [Edge Cases & Security Considerations](#edge-cases--security-considerations)
9. [Testing RLS Policies](#testing-rls-policies)
10. [Audit Logging](#audit-logging)

---

## Authorization Model Overview

### Multi-Tenancy Model

**Architecture**: Organization-based complete data isolation
**Authorization Layer**: Supabase Row-Level Security (RLS) policies
**Authentication**: Supabase JWT with custom claims (`organization_id`, `role`)
**Permission Model**: Role-based access control (RBAC)

### Security Layers

The Clarity CRM implements defense-in-depth with three security layers:

1. **Database RLS Policies** (Authoritative)
   - Enforced at PostgreSQL level via Supabase RLS
   - Cannot be bypassed by frontend code
   - Applies to all queries, even direct Supabase client access
   - Located: Database schema migrations

2. **Backend API Validation** (Application-level)
   - Business logic validation
   - HMAC-SHA256 request authentication
   - Organization context extraction from JWT
   - Located: `src/services/dataService.js`, `src/services/supabaseService.js`

3. **Frontend Permissions** (UI/UX only)
   - Hide/disable UI elements based on role
   - Improve user experience (not security)
   - Optional permission hooks for conditional rendering
   - Located: `src/context/AppStateContext.jsx`

**Important**: Frontend checks are for UX only. RLS policies are the authoritative security enforcement.

---

## Organization Scoping

### Multi-Tenancy Requirements

1. **Complete Data Isolation**: Users can ONLY access customers belonging to their organization
2. **Automatic Scoping**: All queries automatically filtered by `organization_id` via RLS
3. **No Cross-Org Leakage**: Even with direct Supabase queries, users cannot access other organizations' data
4. **Organization Linking**: Customers linked to organizations via `customer_organization` junction table

### JWT Claims Structure

Supabase JWT must include custom claims in the `app_metadata` section:

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
  },
  "aud": "authenticated",
  "exp": 1704067200,
  "iat": 1704063600
}
```

**Required Claims**:
- `app_metadata.organization_id` (UUID) - User's current organization
- `app_metadata.role` (string) - User's role within organization (`admin`, `staff`, `read_only`, `external`)

**JWT Claim Access in RLS Policies**:
```sql
-- Extract organization_id from JWT
(current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid

-- Extract role from JWT
(current_setting('request.jwt.claims', true)::json->>'role')
```

**Frontend JWT Management**: See `src/components/auth/SignIn.jsx:82-117` for Supabase authentication flow.

### Organization Switching

**Scenario**: User belongs to multiple organizations and switches active organization

**Expected Behavior**:
1. User selects new organization in UI
2. Frontend requests JWT refresh with new `organization_id` claim
3. Supabase refreshes session with updated JWT
4. All subsequent queries automatically filtered to new organization
5. Previous organization's data no longer accessible

**Implementation Requirement**: Backend must provide organization switching endpoint that updates JWT claims and refreshes Supabase session.

---

## Role Definitions

### 1. Admin

**Full CRUD access** to all customers in organization

**Permissions**:
- Create, read, update, delete customers
- Manage customer emails, phones, addresses
- Toggle customer active/inactive status
- Assign customers to projects/users
- View all financial data (invoices, payments, sales)
- Manage customer-organization relationships
- Delete records (unique to admin)

**Use Cases**:
- Organization owners
- Department heads
- System administrators

### 2. Staff

**Create/Read/Update access** (no delete) to customers

**Permissions**:
- Create new customers
- Read customer details
- Update customer information
- Manage customer emails, phones, addresses
- Toggle customer active/inactive status
- View customer financial data (limited to summaries)
- **Cannot delete** customers or customer-organization links

**Use Cases**:
- Account managers
- Sales representatives
- Customer service team

### 3. Read-Only

**Read-only access** to customers

**Permissions**:
- View customer list
- View customer details
- View customer emails, phones, addresses
- **Cannot create, update, or delete** any customer data
- **Cannot view** financial data (invoices, payments)
- **Cannot toggle** active status

**Use Cases**:
- Analysts
- Reporting users
- Auditors

### 4. External (Future Enhancement)

**Project-scoped read-only access** to customers

**Permissions**:
- Can only view customers associated with specific projects they're assigned to
- Read-only access to limited fields (no financial data, no contact details)
- No direct access to customers table
- Access mediated through project assignments

**Use Cases**:
- External contractors
- Client stakeholders
- Third-party vendors

**Implementation Status**: Defined in requirements but not implemented. Requires additional RLS policies and project assignment table.

---

## Row-Level Security Policies

### Policy Naming Convention

Format: `{Role/Permission Description} {Operation} {Table}`

Examples:
- `"Users can view organization customers"`
- `"Admins and staff can create customers"`
- `"Only admins can delete customers"`

### Customers Table Policies

#### Policy 1: customers SELECT (Read)

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
- External role excluded (no direct customer access)

**Performance**: Index on `customers(organization_id)` required for efficient filtering.

---

#### Policy 2: customers INSERT (Create)

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
- New customer's `organization_id` must match user's organization
- User role must be admin or staff
- Prevents read-only users from creating customers
- Prevents users from creating customers in other organizations

**Validation**:
- `organization_id` field is required (NOT NULL constraint)
- Backend should auto-populate `organization_id` from JWT claims

---

#### Policy 3: customers UPDATE (Modify)

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
- **USING clause**: Can only update customers in their organization with admin/staff role
- **WITH CHECK clause**: Cannot change `organization_id` to another organization (prevents data theft)
- User role must be admin or staff

**Security**: `WITH CHECK` prevents malicious attempts to move customers to other organizations via UPDATE.

**Edge Case**: If customer needs to be transferred to another organization, must be done via `customer_organization` junction table by admin, not by updating `organization_id`.

---

#### Policy 4: customers DELETE (Remove)

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
- User role must be exactly `'admin'` (staff and read-only cannot delete)

**Implementation Note**: Consider soft delete (setting `is_active = false`) instead of hard delete to preserve audit trail. See `api-contracts.md` for soft delete endpoint specification.

---

### customer_email Table Policies

Customer emails inherit organization access from parent customer via `customer_organization` table.

#### Policy 5: customer_email SELECT

**Purpose**: Users can view emails for customers in their organization

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

**Logic**:
- Email's parent customer must be linked to user's organization via `customer_organization`
- Uses `EXISTS` subquery for efficient organization membership check
- All roles can view emails

**Performance**: Composite index on `customer_organization(customer_id, organization_id)` required.

---

#### Policy 6: customer_email INSERT/UPDATE/DELETE

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

**Logic**:
- Uses `FOR ALL` to cover INSERT, UPDATE, DELETE operations
- Email's parent customer must belong to user's organization
- User role must be admin or staff
- `WITH CHECK` ensures new/updated emails remain linked to organization's customers

**Validation**:
- Backend should validate email format (RFC 5322)
- Unique constraint on `(customer_id, email_address)` prevents duplicates
- `is_primary` flag management (only one primary email per customer)

---

### customer_phone Table Policies

Similar to customer_email policies, customer_phone inherits organization access from parent customer.

#### Policy 7: customer_phone SELECT

```sql
CREATE POLICY "Users can view customer phones"
ON customer_phone
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM customer_organization co
    WHERE co.customer_id = customer_phone.customer_id
    AND co.organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  )
  AND
  (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'staff', 'read_only')
);
```

---

#### Policy 8: customer_phone INSERT/UPDATE/DELETE

```sql
CREATE POLICY "Admins and staff can manage customer phones"
ON customer_phone
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM customer_organization co
    WHERE co.customer_id = customer_phone.customer_id
    AND co.organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  )
  AND
  (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'staff')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM customer_organization co
    WHERE co.customer_id = customer_phone.customer_id
    AND co.organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  )
);
```

**Validation**:
- Phone number format validation (E.164 international format recommended)
- Type validation: `phone_type IN ('mobile', 'office', 'home', 'fax')`
- `is_primary` flag management

---

### customer_address Table Policies

#### Policy 9: customer_address SELECT

```sql
CREATE POLICY "Users can view customer addresses"
ON customer_address
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM customer_organization co
    WHERE co.customer_id = customer_address.customer_id
    AND co.organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  )
  AND
  (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'staff', 'read_only')
);
```

---

#### Policy 10: customer_address INSERT/UPDATE/DELETE

```sql
CREATE POLICY "Admins and staff can manage customer addresses"
ON customer_address
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM customer_organization co
    WHERE co.customer_id = customer_address.customer_id
    AND co.organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  )
  AND
  (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'staff')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM customer_organization co
    WHERE co.customer_id = customer_address.customer_id
    AND co.organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  )
);
```

**Validation**:
- Address type validation: `address_type IN ('billing', 'shipping', 'office', 'other')`
- Required fields: `street_address`, `city`, `province`, `postal_code`, `country`
- `is_primary` flag management

---

### customer_organization Table Policies

This junction table manages many-to-many relationships between customers and organizations.

#### Policy 11: customer_organization SELECT

**Purpose**: Users can view customer-organization relationships for their organization

```sql
CREATE POLICY "Users can view customer-org links"
ON customer_organization
FOR SELECT
USING (
  organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  AND
  (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'staff', 'read_only')
);
```

**Logic**:
- Users can only see relationships linking customers to their own organization
- Cannot see how customers are linked to other organizations

---

#### Policy 12: customer_organization INSERT/UPDATE/DELETE

**Purpose**: Only admins can manage customer-organization relationships

```sql
CREATE POLICY "Only admins can manage customer-org links"
ON customer_organization
FOR ALL
USING (
  organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  AND
  (current_setting('request.jwt.claims', true)::json->>'role') = 'admin'
)
WITH CHECK (
  organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
);
```

**Logic**:
- Only admins can add/remove organization links
- Cannot link customers to other organizations (only their own)
- Staff cannot manage these relationships (prevents accidental removal)

**Important Constraint**: See "Orphan Customer Prevention" in Edge Cases section.

---

### customer_contacts Table Policies

Customer contacts (decision makers, stakeholders) inherit organization access from parent customer.

#### Policy 13: customer_contacts SELECT

```sql
CREATE POLICY "Users can view customer contacts"
ON customer_contacts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM customer_organization co
    WHERE co.customer_id = customer_contacts.customer_id
    AND co.organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  )
  AND
  (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'staff', 'read_only')
);
```

---

#### Policy 14: customer_contacts INSERT/UPDATE/DELETE

```sql
CREATE POLICY "Admins and staff can manage customer contacts"
ON customer_contacts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM customer_organization co
    WHERE co.customer_id = customer_contacts.customer_id
    AND co.organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  )
  AND
  (current_setting('request.jwt.claims', true)::json->>'role') IN ('admin', 'staff')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM customer_organization co
    WHERE co.customer_id = customer_contacts.customer_id
    AND co.organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  )
);
```

**Validation**:
- Contact name required
- Email format validation (if provided)
- Phone format validation (if provided)
- `is_primary` flag management (only one primary contact per customer)

---

### customer_sales Table Policies

Sales records contain sensitive financial data and require admin-only access for full details.

#### Policy 15: customer_sales SELECT (Limited)

**Purpose**: Staff can view sales summaries, admins can view full details

```sql
-- Staff can view basic sales data (no financial details)
CREATE POLICY "Staff can view customer sales summaries"
ON customer_sales
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM customer_organization co
    WHERE co.customer_id = customer_sales.customer_id
    AND co.organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  )
  AND
  (current_setting('request.jwt.claims', true)::json->>'role') = 'staff'
);

-- Admins can view all sales data
CREATE POLICY "Admins can view all customer sales"
ON customer_sales
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM customer_organization co
    WHERE co.customer_id = customer_sales.customer_id
    AND co.organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  )
  AND
  (current_setting('request.jwt.claims', true)::json->>'role') = 'admin'
);
```

**Implementation Note**: Consider using PostgreSQL's Column-Level Security or separate views for different access levels.

---

#### Policy 16: customer_sales INSERT/UPDATE/DELETE

```sql
CREATE POLICY "Only admins can manage customer sales"
ON customer_sales
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM customer_organization co
    WHERE co.customer_id = customer_sales.customer_id
    AND co.organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  )
  AND
  (current_setting('request.jwt.claims', true)::json->>'role') = 'admin'
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM customer_organization co
    WHERE co.customer_id = customer_sales.customer_id
    AND co.organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  )
);
```

---

### Enable RLS on All Tables

**CRITICAL**: RLS must be enabled on all customer-related tables for policies to take effect.

```sql
-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_email ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_phone ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_address ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_sales ENABLE ROW LEVEL SECURITY;

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename LIKE 'customer%';
```

**Expected Output**:
```
     tablename         | rowsecurity
-----------------------+-------------
 customers             | t
 customer_email        | t
 customer_phone        | t
 customer_address      | t
 customer_organization | t
 customer_contacts     | t
 customer_sales        | t
```

---

## Backend Service Role Access

### Service Role Key Usage

Backend services (API server) use Supabase **service role key** for operations that need to bypass RLS:

**Use Cases**:
- System-level operations (data migrations, backups, bulk imports)
- Admin operations on behalf of users (e.g., customer import, data reconciliation)
- Background jobs (data cleanup, orphan prevention, scheduled reports)
- Cross-organization operations (rare, requires explicit authorization)

**Security Requirements**:
- Service role key stored in backend environment variables **only** (never exposed to frontend)
- Backend authenticates API requests via HMAC-SHA256 before using service role
- Backend sets appropriate RLS context before database operations
- All service role operations must be logged in audit log

### Setting User Context in Backend

Backend should set JWT context for service role queries to respect RLS:

**Method 1: RPC Function** (Recommended)

```sql
-- Create function to set user context
CREATE OR REPLACE FUNCTION set_user_context(
  p_user_id UUID,
  p_organization_id UUID,
  p_role TEXT
)
RETURNS void AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', p_user_id,
    'organization_id', p_organization_id,
    'role', p_role
  )::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Backend API Endpoint Example**:

```javascript
// Backend: src/api/customers.js
app.post('/api/customers', authenticateRequest, async (req, res) => {
  const { userId, organizationId, role } = req.user; // From JWT

  try {
    // Set RLS context for this request
    await supabase.rpc('set_user_context', {
      p_user_id: userId,
      p_organization_id: organizationId,
      p_role: role
    });

    // Now all subsequent queries respect RLS policies
    const { data, error } = await supabase
      .from('customers')
      .insert(req.body)
      .select();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    console.error('Customer creation failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'CREATION_FAILED', message: error.message }
    });
  }
});
```

**Frontend Reference**: See `src/services/dataService.js:generateBackendAuthHeader()` for HMAC authentication implementation.

**Method 2: Transaction-Level Context**

```javascript
// Set context for entire transaction
await supabase.rpc('begin_transaction');
await supabase.rpc('set_user_context', { p_organization_id: orgId, p_role: 'admin' });

// All queries in this transaction respect RLS
const { data } = await supabase.from('customers').select();

await supabase.rpc('commit_transaction');
```

---

## Permission Matrix

### Customers Feature Permissions

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
| Import customers | ✅ | ❌ | ❌ | ❌ |
| Export customers | ✅ | ✅ | ✅ | ❌ |
| **Emails** |
| View emails | ✅ | ✅ | ✅ | ❌ |
| Add/update email | ✅ | ✅ | ❌ | ❌ |
| Delete email | ✅ | ✅ | ❌ | ❌ |
| Set primary email | ✅ | ✅ | ❌ | ❌ |
| **Phones** |
| View phones | ✅ | ✅ | ✅ | ❌ |
| Add/update phone | ✅ | ✅ | ❌ | ❌ |
| Delete phone | ✅ | ✅ | ❌ | ❌ |
| Set primary phone | ✅ | ✅ | ❌ | ❌ |
| **Addresses** |
| View addresses | ✅ | ✅ | ✅ | ❌ |
| Add/update address | ✅ | ✅ | ❌ | ❌ |
| Delete address | ✅ | ✅ | ❌ | ❌ |
| Set primary address | ✅ | ✅ | ❌ | ❌ |
| **Contacts** |
| View contacts | ✅ | ✅ | ✅ | ❌ |
| Add/update contact | ✅ | ✅ | ❌ | ❌ |
| Delete contact | ✅ | ✅ | ❌ | ❌ |
| **Financial** |
| View sales summary | ✅ | ✅ | ❌ | ❌ |
| View detailed sales | ✅ | ❌ | ❌ | ❌ |
| Create sales records | ✅ | ❌ | ❌ | ❌ |
| Update sales records | ✅ | ❌ | ❌ | ❌ |
| Delete sales records | ✅ | ❌ | ❌ | ❌ |
| **Organization Links** |
| View org links | ✅ | ✅ | ✅ | ❌ |
| Add org link | ✅ | ❌ | ❌ | ❌ |
| Remove org link | ✅ | ❌ | ❌ | ❌ |

### Permission Implementation

**Backend Enforcement**: RLS policies (authoritative)
**Frontend Enforcement**: UI conditionals (UX only)
**API Validation**: HMAC authentication + JWT role validation

---

## Frontend Authorization Logic

### Current Implementation

**Context Provider**: `src/context/AppStateContext.jsx`

The application stores user authentication state in React Context:

```javascript
// src/context/AppStateContext.jsx:45-67
const [state, setState] = useState({
  user: null,
  selectedCustomer: null,
  selectedProject: null,
  selectedProspect: null,
  selectedTeam: null,
  // ... other state
});

// User object structure (from JWT)
user: {
  id: "user-uuid",
  email: "user@example.com",
  organizationId: "org-uuid",
  role: "admin", // 'admin', 'staff', 'read_only', 'external'
  firstName: "John",
  lastName: "Doe"
}
```

### Recommended Permission Hook

**File**: `src/hooks/usePermissions.js` (to be created)

```javascript
import { useAppState } from '../context/AppStateContext';

/**
 * Custom hook for role-based permission checks
 * @returns {Object} Permission flags for current user
 */
export function usePermissions() {
  const { user } = useAppState();

  if (!user) {
    return {
      canCreateCustomer: false,
      canUpdateCustomer: false,
      canDeleteCustomer: false,
      canViewFinancial: false,
      canManageOrgLinks: false,
      canExportCustomers: false,
      canImportCustomers: false,
    };
  }

  const isAdmin = user.role === 'admin';
  const isStaff = user.role === 'staff';
  const isReadOnly = user.role === 'read_only';

  return {
    // Customer operations
    canCreateCustomer: isAdmin || isStaff,
    canUpdateCustomer: isAdmin || isStaff,
    canDeleteCustomer: isAdmin,
    canToggleStatus: isAdmin || isStaff,

    // Contact information
    canManageEmails: isAdmin || isStaff,
    canManagePhones: isAdmin || isStaff,
    canManageAddresses: isAdmin || isStaff,
    canManageContacts: isAdmin || isStaff,

    // Financial data
    canViewFinancialSummary: isAdmin || isStaff,
    canViewFinancialDetails: isAdmin,
    canManageSales: isAdmin,

    // Organization management
    canManageOrgLinks: isAdmin,

    // Data operations
    canExportCustomers: isAdmin || isStaff || isReadOnly,
    canImportCustomers: isAdmin,

    // Metadata
    role: user.role,
    organizationId: user.organizationId,
    isAdmin,
    isStaff,
    isReadOnly,
  };
}
```

### Usage in Components

**Example: CustomerDetails Component**

```javascript
// src/components/customers/CustomerDetails.jsx
import { usePermissions } from '../../hooks/usePermissions';

function CustomerDetails({ customer }) {
  const { canUpdateCustomer, canDeleteCustomer, canViewFinancialDetails } = usePermissions();

  return (
    <div>
      <h1>{customer.businessName}</h1>

      {/* Edit button only shown to admin/staff */}
      {canUpdateCustomer && (
        <button onClick={handleEdit}>Edit Customer</button>
      )}

      {/* Delete button only shown to admin */}
      {canDeleteCustomer && (
        <button onClick={handleDelete} className="text-red-600">
          Delete Customer
        </button>
      )}

      {/* Financial section only shown if permitted */}
      {canViewFinancialDetails && (
        <FinancialSummary customerId={customer.id} />
      )}
    </div>
  );
}
```

**Example: CustomerForm Component**

```javascript
// src/components/customers/CustomerForm.jsx
import { usePermissions } from '../../hooks/usePermissions';

function CustomerForm({ customer, onSave }) {
  const { canManageEmails, canManagePhones, canUpdateCustomer } = usePermissions();

  // Disable entire form for read-only users
  const isFormDisabled = !canUpdateCustomer;

  return (
    <form onSubmit={handleSubmit}>
      <input
        name="businessName"
        disabled={isFormDisabled}
      />

      {/* Email section hidden if no permission */}
      {canManageEmails && (
        <EmailSection emails={customer.emails} />
      )}

      {/* Phone section hidden if no permission */}
      {canManagePhones && (
        <PhoneSection phones={customer.phones} />
      )}

      <button type="submit" disabled={isFormDisabled}>
        Save Changes
      </button>
    </form>
  );
}
```

### Important Notes

**Frontend permissions are for UX only**, not security:
- Improve user experience by hiding unavailable actions
- Prevent confusing error messages from unauthorized attempts
- Do NOT rely on frontend checks for security enforcement

**Backend RLS is the authoritative security layer**:
- Even if frontend allows action, backend will reject unauthorized requests
- Direct Supabase queries respect RLS policies
- Service role operations must set user context

**Reference**: See `src/components/auth/SignIn.jsx:82-117` for authentication flow and JWT claim extraction.

---

## Edge Cases & Security Considerations

### 1. User Changes Organization

**Scenario**: User belongs to multiple organizations and switches active organization

**Expected Behavior**:
1. User selects new organization from dropdown/menu
2. Frontend requests JWT refresh from backend
3. Backend updates JWT `app_metadata.organization_id` claim
4. Supabase session refreshed with new JWT
5. All subsequent queries automatically filtered to new organization
6. Previous organization's data no longer accessible
7. UI updates to reflect new organization context

**Implementation Requirements**:
- Backend endpoint: `POST /api/auth/switch-organization`
- Request: `{ organization_id: "new-org-uuid" }`
- Response: New JWT with updated claims
- Frontend: Refresh Supabase session with new JWT
- Frontend: Clear cached customer data
- Frontend: Re-fetch customer list for new organization

**Security**: User's membership in new organization must be validated before JWT refresh.

---

### 2. Customer Belongs to Multiple Organizations

**Scenario**: Customer linked to Organization A and Organization B (supported via `customer_organization` junction table)

**Expected Behavior**:
- User in Org A sees customer in their customer list
- User in Org B sees same customer in their customer list
- Changes made by Org A user are immediately visible to Org B users
- Customer data (emails, phones, addresses) shared between organizations
- Financial data (`customer_sales`) may be organization-specific (requires additional scoping)

**Implementation**:
- `customer_organization` table supports many-to-many relationship
- Customer `organization_id` field may reference "primary" organization
- RLS policies use `EXISTS` query against `customer_organization` table
- Concurrent updates handled by optimistic locking (see api-contracts.md)

**Use Case**: Shared customers for franchise operations, multi-office firms, parent/subsidiary companies.

**Data Consistency**: Consider implications for organization-specific data like sales records, notes, custom fields.

---

### 3. Customer Deleted from One Organization

**Scenario**: Customer linked to Org A and Org B, Org A admin removes customer

**Expected Behavior**:
- Admin in Org A deletes `customer_organization` link (not customer record)
- Customer no longer visible to Org A users
- Customer still accessible to Org B users
- Customer data (emails, phones, addresses) unchanged
- If last organization link removed → customer becomes orphaned (should be prevented)

**Implementation - Orphan Prevention Trigger**:

```sql
-- Prevent deleting last organization link
CREATE OR REPLACE FUNCTION prevent_orphan_customers()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is the last organization link for this customer
  IF NOT EXISTS (
    SELECT 1 FROM customer_organization
    WHERE customer_id = OLD.customer_id
    AND id != OLD.id
  ) THEN
    RAISE EXCEPTION 'Cannot remove last organization link for customer (would create orphan)';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_orphan_customers
BEFORE DELETE ON customer_organization
FOR EACH ROW
EXECUTE FUNCTION prevent_orphan_customers();
```

**Alternative Approach**: Implement soft delete on customer record instead of removing organization link.

---

### 4. Attempting to Change Organization ID

**Scenario**: Malicious user (or buggy frontend) attempts to update customer's `organization_id` to another organization

**Expected Behavior**:
- RLS policy `WITH CHECK` clause prevents update
- Database returns error: `new row violates row-level security policy for table "customers"`
- HTTP 403 Forbidden returned to frontend
- Customer remains in original organization
- Audit log captures failed attempt

**RLS Policy Protection**:

```sql
-- UPDATE policy WITH CHECK clause
WITH CHECK (
  organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
);
```

**Security**: Even if frontend sends malicious payload `{ organization_id: "other-org-uuid" }`, database rejects it.

**Correct Transfer Method**: Use `customer_organization` junction table to add/remove organization links (admin-only).

---

### 5. Direct Supabase Client Access (Bypassing Backend)

**Scenario**: User uses Supabase client library directly in frontend (bypassing backend API)

**Expected Behavior**:
- RLS policies still enforced (applied at database level)
- User can only access customers in their organization
- No data leakage even with direct access
- User's JWT claims used for authorization
- Operations respect role permissions (admin/staff/read-only)

**Implementation**: RLS policies applied at PostgreSQL level, not application level.

**Example - Direct Query**:

```javascript
// Frontend: Direct Supabase query
import { supabase } from './supabaseClient';

// This query is automatically filtered by RLS
const { data, error } = await supabase
  .from('customers')
  .select('*')
  .eq('business_name', 'Acme Corp');

// Result: Only customers in user's organization returned
// User from Org A cannot see customers from Org B
```

**Why This Works**: Supabase passes user's JWT to PostgreSQL via `request.jwt.claims` setting.

**Security Implication**: Frontend can safely use Supabase client for read operations. Backend API still recommended for write operations to enforce business logic.

---

### 6. Concurrent Updates (Optimistic Locking)

**Scenario**: User A and User B edit same customer simultaneously

**Expected Behavior**:
1. User A fetches customer (version 5)
2. User B fetches customer (version 5)
3. User A saves changes → version 6 created
4. User B saves changes → detects version mismatch → error returned
5. User B must refresh and re-apply changes

**Implementation - Optimistic Locking**:

```sql
-- Add version column to customers table
ALTER TABLE customers ADD COLUMN version INTEGER DEFAULT 1;

-- Create trigger to increment version on update
CREATE OR REPLACE FUNCTION increment_customer_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customer_version
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION increment_customer_version();
```

**Backend API Validation**:

```javascript
// Backend: Update endpoint with version check
app.put('/api/customers/:id', authenticateRequest, async (req, res) => {
  const { id } = req.params;
  const { version, ...updates } = req.body;

  const { data, error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', id)
    .eq('version', version) // Optimistic lock check
    .select();

  if (error || data.length === 0) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'VERSION_CONFLICT',
        message: 'Customer was modified by another user. Please refresh and try again.'
      }
    });
  }

  res.json({ success: true, data: data[0] });
});
```

**Frontend Handling**:
- Display version conflict error to user
- Offer options: "Refresh and merge changes" or "Overwrite changes"
- Show diff between user's changes and current version

**Reference**: See `api-contracts.md` for detailed optimistic locking specification.

---

### 7. Service Role Key Exposure

**Scenario**: Service role key accidentally exposed in frontend code or environment variables

**Risk**:
- Service role key bypasses all RLS policies
- Attacker could access/modify data across all organizations
- Complete data breach

**Prevention**:
1. **Never include service role key in frontend environment variables**
   - Use `VITE_SUPABASE_ANON_KEY` (limited permissions) for frontend
   - Store `SUPABASE_SERVICE_ROLE_KEY` in backend `.env` only

2. **Environment Variable Naming Convention**:
   - Frontend vars: `VITE_*` (Vite exposes these to browser)
   - Backend vars: No `VITE_` prefix (server-side only)

3. **Git Ignore**:
   - Add `.env`, `.env.local`, `.env.production` to `.gitignore`
   - Never commit environment files to version control

4. **Code Review**:
   - Check for accidental service role key usage in frontend code
   - Search codebase: `grep -r "service.*role" src/`

**Detection**:
```bash
# Check for service role key in frontend code (should return 0 results)
grep -r "SUPABASE_SERVICE_ROLE_KEY" src/

# Check for service role key in environment files exposed to frontend
grep "VITE.*SERVICE" .env
```

**Current Implementation**: See `src/services/supabaseService.js:12-24` for correct anon key usage.

---

### 8. Rate Limiting (DoS Prevention)

**Scenario**: Malicious user or buggy frontend sends excessive requests

**Risk**:
- Database overload
- Increased costs
- Degraded performance for legitimate users

**Implementation Requirements**:

1. **API Gateway Rate Limiting** (per organization):
   - 100 requests per minute per user
   - 1000 requests per minute per organization
   - Burst allowance: 20 requests per second

2. **Backend Middleware**:
```javascript
// Backend: Rate limiting middleware
const rateLimit = require('express-rate-limit');

const customerApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  keyGenerator: (req) => req.user.organizationId, // Organization-level
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        retryAfter: 60
      }
    });
  }
});

app.use('/api/customers', customerApiLimiter);
```

3. **Frontend Retry Logic**:
   - Detect 429 status code
   - Implement exponential backoff
   - Display user-friendly message

**Monitoring**: Track rate limit violations in audit log for abuse detection.

---

## Testing RLS Policies

### Setup Test Environment

```sql
-- Create test users with different roles
INSERT INTO auth.users (id, email) VALUES
  ('admin-user-uuid', 'admin@example.com'),
  ('staff-user-uuid', 'staff@example.com'),
  ('readonly-user-uuid', 'readonly@example.com');

-- Create test organizations
INSERT INTO organizations (id, name) VALUES
  ('org-a-uuid', 'Organization A'),
  ('org-b-uuid', 'Organization B');

-- Create test customers
INSERT INTO customers (id, organization_id, business_name) VALUES
  ('customer-a1-uuid', 'org-a-uuid', 'Customer A1'),
  ('customer-a2-uuid', 'org-a-uuid', 'Customer A2'),
  ('customer-b1-uuid', 'org-b-uuid', 'Customer B1');
```

### Test Case 1: User Cannot See Other Organization's Customers

**Purpose**: Verify organization isolation

```sql
-- Set user context to Organization A, Admin role
SET request.jwt.claims = '{
  "sub": "admin-user-uuid",
  "organization_id": "org-a-uuid",
  "role": "admin"
}';

-- Query all customers
SELECT id, business_name, organization_id FROM customers;

-- Expected Result: Only customers from Organization A
-- customer-a1-uuid | Customer A1 | org-a-uuid
-- customer-a2-uuid | Customer A2 | org-a-uuid

-- Verify cannot access Organization B customer
SELECT id, business_name FROM customers WHERE id = 'customer-b1-uuid';

-- Expected Result: Empty (no rows returned, not an error)
```

**Pass Criteria**:
- ✅ Only Organization A customers returned
- ✅ Organization B customer not accessible
- ✅ No error thrown (empty result set)

---

### Test Case 2: Staff Cannot Delete Customers

**Purpose**: Verify role-based delete restrictions

```sql
-- Set user context to Staff role
SET request.jwt.claims = '{
  "sub": "staff-user-uuid",
  "organization_id": "org-a-uuid",
  "role": "staff"
}';

-- Attempt to delete customer
DELETE FROM customers WHERE id = 'customer-a1-uuid';

-- Expected Result: ERROR
-- new row violates row-level security policy for table "customers"
```

**Pass Criteria**:
- ✅ Delete operation rejected
- ✅ RLS policy violation error returned
- ✅ Customer record unchanged in database

---

### Test Case 3: Read-Only Cannot Update Customers

**Purpose**: Verify read-only role restrictions

```sql
-- Set user context to Read-Only role
SET request.jwt.claims = '{
  "sub": "readonly-user-uuid",
  "organization_id": "org-a-uuid",
  "role": "read_only"
}';

-- Verify can read customers
SELECT id, business_name FROM customers WHERE id = 'customer-a1-uuid';
-- Expected: Customer A1 returned

-- Attempt to update customer
UPDATE customers
SET business_name = 'New Name'
WHERE id = 'customer-a1-uuid';

-- Expected Result: ERROR
-- new row violates row-level security policy for table "customers"
```

**Pass Criteria**:
- ✅ Read operation succeeds
- ✅ Update operation rejected
- ✅ RLS policy violation error returned

---

### Test Case 4: Cannot Change Organization ID

**Purpose**: Verify organization transfer prevention

```sql
-- Set user context to Admin (has update permission)
SET request.jwt.claims = '{
  "sub": "admin-user-uuid",
  "organization_id": "org-a-uuid",
  "role": "admin"
}';

-- Attempt to move customer to Organization B
UPDATE customers
SET organization_id = 'org-b-uuid'
WHERE id = 'customer-a1-uuid';

-- Expected Result: ERROR
-- new row violates row-level security policy for table "customers"
```

**Pass Criteria**:
- ✅ Update rejected despite admin role
- ✅ WITH CHECK clause prevents organization change
- ✅ Customer remains in Organization A

---

### Test Case 5: Admin Can Create/Update/Delete

**Purpose**: Verify admin has full CRUD permissions

```sql
-- Set user context to Admin
SET request.jwt.claims = '{
  "sub": "admin-user-uuid",
  "organization_id": "org-a-uuid",
  "role": "admin"
}';

-- Test CREATE
INSERT INTO customers (id, organization_id, business_name)
VALUES ('test-customer-uuid', 'org-a-uuid', 'Test Customer');
-- Expected: SUCCESS

-- Test UPDATE
UPDATE customers
SET business_name = 'Updated Test Customer'
WHERE id = 'test-customer-uuid';
-- Expected: SUCCESS

-- Test DELETE
DELETE FROM customers WHERE id = 'test-customer-uuid';
-- Expected: SUCCESS
```

**Pass Criteria**:
- ✅ All CRUD operations succeed
- ✅ No RLS policy violations

---

### Test Case 6: Nested Resource Access Control

**Purpose**: Verify child tables inherit parent organization access

```sql
-- Set user context to Organization A
SET request.jwt.claims = '{
  "sub": "staff-user-uuid",
  "organization_id": "org-a-uuid",
  "role": "staff"
}';

-- Add email to Organization A customer (should succeed)
INSERT INTO customer_email (customer_id, email_address, email_type)
VALUES ('customer-a1-uuid', 'test@example.com', 'work');
-- Expected: SUCCESS

-- Attempt to add email to Organization B customer (should fail)
INSERT INTO customer_email (customer_id, email_address, email_type)
VALUES ('customer-b1-uuid', 'test@orgb.com', 'work');
-- Expected: ERROR (RLS policy violation)
```

**Pass Criteria**:
- ✅ Email added to Organization A customer
- ✅ Email rejected for Organization B customer
- ✅ RLS policy enforces organization boundary

---

### Automated Testing Script

**File**: `tests/rls-policies.test.sql`

```sql
-- RLS Policy Test Suite
-- Run with: psql -U postgres -d postgres -f tests/rls-policies.test.sql

BEGIN;

-- Test 1: Organization Isolation
SET request.jwt.claims = '{"organization_id": "org-a-uuid", "role": "admin"}';
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM customers WHERE organization_id = 'org-b-uuid') = 0,
    'Test 1 Failed: Can see other organization customers';
END $$;

-- Test 2: Staff Cannot Delete
SET request.jwt.claims = '{"organization_id": "org-a-uuid", "role": "staff"}';
DO $$
BEGIN
  DELETE FROM customers WHERE id = 'customer-a1-uuid';
  RAISE EXCEPTION 'Test 2 Failed: Staff should not be able to delete';
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL; -- Expected error
END $$;

-- Test 3: Read-Only Cannot Update
SET request.jwt.claims = '{"organization_id": "org-a-uuid", "role": "read_only"}';
DO $$
BEGIN
  UPDATE customers SET business_name = 'Test' WHERE id = 'customer-a1-uuid';
  RAISE EXCEPTION 'Test 3 Failed: Read-only should not be able to update';
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL; -- Expected error
END $$;

-- All tests passed
RAISE NOTICE 'All RLS policy tests passed';

ROLLBACK;
```

**Run Tests**:
```bash
# Execute test suite
ssh marcus@backend.claritybusinesssolutions.ca \
  "docker exec supabase-db psql -U postgres -d postgres -f /tests/rls-policies.test.sql"
```

---

## Audit Logging

### Requirements

All customer operations must be logged for:
- **Security**: Detect unauthorized access attempts
- **Compliance**: GDPR, SOC 2, audit requirements
- **Debugging**: Investigate data inconsistencies
- **User Activity**: Track who changed what and when

### Audit Log Table Schema

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  action TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'READ'
  entity_type TEXT NOT NULL, -- 'customer', 'customer_email', 'customer_phone', etc.
  entity_id UUID NOT NULL,
  changes JSONB, -- Old and new values for UPDATE operations
  ip_address INET, -- Client IP address
  user_agent TEXT, -- Client user agent string
  request_id UUID, -- For correlating related operations
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for efficient querying
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_organization ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_logs_request ON audit_logs(request_id) WHERE request_id IS NOT NULL;

-- Enable RLS on audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view audit logs for their organization
CREATE POLICY "Admins can view organization audit logs"
ON audit_logs FOR SELECT
USING (
  organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  AND (current_setting('request.jwt.claims', true)::json->>'role') = 'admin'
);

-- Prevent manual modifications (append-only log)
CREATE POLICY "Audit logs are append-only"
ON audit_logs FOR INSERT
WITH CHECK (false); -- No one can manually insert (only triggers)
```

### Automatic Audit Logging via Triggers

**Customer Table Audit Trigger**:

```sql
CREATE OR REPLACE FUNCTION audit_customer_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_organization_id UUID;
  v_action TEXT;
BEGIN
  -- Extract user context from JWT
  v_user_id := (current_setting('request.jwt.claims', true)::json->>'sub')::uuid;
  v_organization_id := (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid;

  -- Determine action type
  v_action := TG_OP; -- 'INSERT', 'UPDATE', 'DELETE'

  -- Insert audit log
  INSERT INTO audit_logs (
    user_id,
    organization_id,
    action,
    entity_type,
    entity_id,
    changes,
    created_at
  ) VALUES (
    v_user_id,
    v_organization_id,
    v_action,
    'customer',
    COALESCE(NEW.id, OLD.id),
    CASE
      WHEN TG_OP = 'UPDATE' THEN
        jsonb_build_object(
          'old', to_jsonb(OLD),
          'new', to_jsonb(NEW),
          'diff', (
            SELECT jsonb_object_agg(key, value)
            FROM jsonb_each(to_jsonb(NEW))
            WHERE to_jsonb(NEW) -> key != to_jsonb(OLD) -> key
          )
        )
      WHEN TG_OP = 'DELETE' THEN
        jsonb_build_object('old', to_jsonb(OLD))
      WHEN TG_OP = 'INSERT' THEN
        jsonb_build_object('new', to_jsonb(NEW))
    END,
    NOW()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on customers table
CREATE TRIGGER audit_customers
AFTER INSERT OR UPDATE OR DELETE ON customers
FOR EACH ROW
EXECUTE FUNCTION audit_customer_changes();
```

**Apply to All Customer Tables**:

```sql
-- customer_email
CREATE TRIGGER audit_customer_email
AFTER INSERT OR UPDATE OR DELETE ON customer_email
FOR EACH ROW
EXECUTE FUNCTION audit_customer_changes();

-- customer_phone
CREATE TRIGGER audit_customer_phone
AFTER INSERT OR UPDATE OR DELETE ON customer_phone
FOR EACH ROW
EXECUTE FUNCTION audit_customer_changes();

-- customer_address
CREATE TRIGGER audit_customer_address
AFTER INSERT OR UPDATE OR DELETE ON customer_address
FOR EACH ROW
EXECUTE FUNCTION audit_customer_changes();

-- customer_contacts
CREATE TRIGGER audit_customer_contacts
AFTER INSERT OR UPDATE OR DELETE ON customer_contacts
FOR EACH ROW
EXECUTE FUNCTION audit_customer_changes();

-- customer_sales
CREATE TRIGGER audit_customer_sales
AFTER INSERT OR UPDATE OR DELETE ON customer_sales
FOR EACH ROW
EXECUTE FUNCTION audit_customer_changes();

-- customer_organization
CREATE TRIGGER audit_customer_organization
AFTER INSERT OR UPDATE OR DELETE ON customer_organization
FOR EACH ROW
EXECUTE FUNCTION audit_customer_changes();
```

### Audit Log Queries

**View Recent Customer Changes**:

```sql
SELECT
  al.created_at,
  al.action,
  al.entity_type,
  u.email AS user_email,
  al.changes -> 'diff' AS changed_fields
FROM audit_logs al
JOIN auth.users u ON al.user_id = u.id
WHERE al.entity_type LIKE 'customer%'
  AND al.organization_id = 'your-org-uuid'
ORDER BY al.created_at DESC
LIMIT 50;
```

**Track Changes to Specific Customer**:

```sql
SELECT
  al.created_at,
  al.action,
  al.entity_type,
  u.email AS user_email,
  al.changes
FROM audit_logs al
JOIN auth.users u ON al.user_id = u.id
WHERE al.entity_id = 'customer-uuid'
  OR (al.changes ->> 'new')::jsonb ->> 'customer_id' = 'customer-uuid'
  OR (al.changes ->> 'old')::jsonb ->> 'customer_id' = 'customer-uuid'
ORDER BY al.created_at DESC;
```

**Detect Unauthorized Access Attempts**:

```sql
-- Find failed RLS policy violations (logged by backend)
SELECT
  al.created_at,
  u.email,
  al.action,
  al.entity_type,
  al.changes -> 'error' AS error_message
FROM audit_logs al
JOIN auth.users u ON al.user_id = u.id
WHERE al.action = 'ACCESS_DENIED'
  AND al.organization_id = 'your-org-uuid'
ORDER BY al.created_at DESC;
```

### Audit Log Retention

**Policy**: Retain audit logs for 7 years (compliance requirement)

**Partitioning Strategy**:

```sql
-- Create partitioned table for audit logs
CREATE TABLE audit_logs_partitioned (
  LIKE audit_logs INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create yearly partitions
CREATE TABLE audit_logs_2025 PARTITION OF audit_logs_partitioned
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE audit_logs_2026 PARTITION OF audit_logs_partitioned
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- Archive old partitions to cold storage after 1 year
```

**Archival Script** (run quarterly):

```bash
# Export old audit logs to S3
pg_dump -U postgres -d postgres \
  -t audit_logs_2024 \
  --data-only \
  --format=custom \
  | aws s3 cp - s3://clarity-audit-archive/2024/audit_logs.dump

# Drop archived partition
psql -U postgres -d postgres -c "DROP TABLE audit_logs_2024;"
```

---

## Summary

### RLS Policies Summary

**Total Policies**: 16 policies across 7 tables

| Table | SELECT | INSERT | UPDATE | DELETE | Total |
|-------|--------|--------|--------|--------|-------|
| customers | 1 | 1 | 1 | 1 | 4 |
| customer_email | 1 | 1 (via FOR ALL) | 1 (via FOR ALL) | 1 (via FOR ALL) | 2 |
| customer_phone | 1 | 1 (via FOR ALL) | 1 (via FOR ALL) | 1 (via FOR ALL) | 2 |
| customer_address | 1 | 1 (via FOR ALL) | 1 (via FOR ALL) | 1 (via FOR ALL) | 2 |
| customer_contacts | 1 | 1 (via FOR ALL) | 1 (via FOR ALL) | 1 (via FOR ALL) | 2 |
| customer_sales | 2 (role-based) | 1 (via FOR ALL) | 1 (via FOR ALL) | 1 (via FOR ALL) | 3 |
| customer_organization | 1 | 1 (via FOR ALL) | 1 (via FOR ALL) | 1 (via FOR ALL) | 2 |

### Role-Based Access Summary

| Role | Create | Read | Update | Delete | Financial |
|------|--------|------|--------|--------|-----------|
| **Admin** | ✅ | ✅ | ✅ | ✅ | Full access |
| **Staff** | ✅ | ✅ | ✅ | ❌ | Summary only |
| **Read-Only** | ❌ | ✅ | ❌ | ❌ | No access |
| **External** | ❌ | Project-scoped | ❌ | ❌ | No access |

### Organization Scoping Summary

- **Multi-Tenancy Model**: Complete data isolation per organization
- **JWT Claims**: `organization_id` and `role` embedded in JWT
- **RLS Enforcement**: All queries automatically filtered by `organization_id`
- **No Cross-Org Access**: Even with direct Supabase queries
- **Junction Table**: `customer_organization` supports many-to-many relationships
- **Orphan Prevention**: Triggers prevent deleting last organization link

### Security Layers Summary

1. **Database RLS Policies** (Authoritative) ✅
   - PostgreSQL row-level security
   - Cannot be bypassed by frontend
   - Applies to all queries

2. **Backend API Validation** (Application-level) ✅
   - HMAC-SHA256 authentication
   - Business logic validation
   - Organization context extraction

3. **Frontend Permissions** (UI/UX only) ⚠️
   - Hide/disable UI elements
   - Improve user experience
   - **Not a security layer**

### Implementation Checklist

**Database Schema**:
- [ ] Create RLS policies for all customer tables
- [ ] Enable RLS on all customer tables
- [ ] Create audit log table and triggers
- [ ] Create orphan prevention trigger
- [ ] Create optimistic locking version column
- [ ] Create indexes for RLS policy performance

**Backend API**:
- [ ] Implement HMAC-SHA256 authentication
- [ ] Extract JWT claims for organization/role
- [ ] Set user context for RLS queries
- [ ] Implement service role access for admin operations
- [ ] Add rate limiting middleware
- [ ] Add audit logging for all operations

**Frontend**:
- [ ] Create `usePermissions` hook
- [ ] Implement permission checks in components
- [ ] Handle organization switching
- [ ] Display version conflict errors
- [ ] Implement retry logic for rate limiting

**Testing**:
- [ ] Write RLS policy tests
- [ ] Test organization isolation
- [ ] Test role-based permissions
- [ ] Test orphan prevention
- [ ] Test concurrent update handling
- [ ] Test audit log capture

### Next Steps

1. **Backend Team**: Implement RLS policies as part of schema migration
2. **Frontend Team**: Create `usePermissions` hook and update components
3. **DevOps**: Configure rate limiting at API gateway level
4. **Security**: Audit service role key storage and access controls
5. **Testing**: Execute RLS policy test suite before production deployment

### Related Documents

- [API Endpoint Contracts](./api-contracts.md) - Backend API specifications
- [Data Model Mapping](./data-model-mapping.md) - FileMaker to Supabase field mapping
- [Supabase Schema](./supabase-schema.md) - Database schema documentation
- [Migration Plan](../../requirements/customers/migration-plan.md) - Deployment strategy

---

**Document Status**: Requirements Definition - Ready for Backend Implementation
**Last Updated**: 2026-01-10
**Author**: Claude (AI Assistant)
**Reviewed By**: Pending backend team review
