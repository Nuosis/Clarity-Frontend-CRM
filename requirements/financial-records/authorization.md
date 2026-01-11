# Financial Records - Authorization & Security

## Overview

This document defines the authorization model, security policies, and access control rules for financial records in the Supabase backend.

**Security Model:** Row Level Security (RLS) + PostgreSQL RPC functions
**Authentication:** Supabase JWT (JSON Web Token)
**Authorization:** Organization-based isolation + role-based permissions

---

## Table of Contents

1. [Authentication Flow](#authentication-flow)
2. [Row Level Security (RLS) Policies](#row-level-security-rls-policies)
3. [RPC Function Permissions](#rpc-function-permissions)
4. [Role-Based Access Control](#role-based-access-control)
5. [Security Constraints](#security-constraints)
6. [Audit Trail](#audit-trail)

---

## Authentication Flow

### 1. User Authentication

**Method:** Supabase Auth (JWT-based)

**Login Flow:**
```javascript
// User signs in with email/password
const { data, error } = await supabase.auth.signInWithPassword({
  email: user.email,
  password: user.password
});

// JWT token stored in localStorage and sent with all requests
// Token includes: user_id, email, role, organization_id (custom claim)
```

**JWT Structure:**
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "authenticated",
  "organization_id": "org-uuid",
  "app_metadata": {
    "provider": "email"
  },
  "user_metadata": {
    "organization_id": "org-uuid",
    "role": "admin"
  }
}
```

**Custom Claim:** organization_id must be added to JWT via Supabase Auth hook or database trigger.

### 2. Organization Context

**Requirement:** All financial record operations require organization_id.

**Session Verification:**
```sql
-- Helper function to get user's organization_id from JWT
CREATE OR REPLACE FUNCTION auth.user_organization_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT (auth.jwt() ->> 'organization_id')::UUID;
$$;
```

---

## Row Level Security (RLS) Policies

### Enable RLS on customer_sales Table

```sql
-- Enable RLS
ALTER TABLE customer_sales ENABLE ROW LEVEL SECURITY;
```

### Policy 1: SELECT - Organization Isolation

```sql
CREATE POLICY customer_sales_select_org_isolation
ON customer_sales
FOR SELECT
USING (organization_id = (auth.jwt() ->> 'organization_id')::UUID);
```

### Policy 2: INSERT - Organization Scoped

```sql
CREATE POLICY customer_sales_insert_org_scoped
ON customer_sales
FOR INSERT
WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::UUID);
```

### Policy 3: UPDATE - Organization Scoped

```sql
CREATE POLICY customer_sales_update_org_scoped
ON customer_sales
FOR UPDATE
USING (organization_id = (auth.jwt() ->> 'organization_id')::UUID)
WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::UUID);
```

### Policy 4: DELETE - Admin Only

```sql
CREATE POLICY customer_sales_delete_admin_only
ON customer_sales
FOR DELETE
USING (
  organization_id = (auth.jwt() ->> 'organization_id')::UUID
  AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);
```

---

## RPC Function Permissions

```sql
GRANT EXECUTE ON FUNCTION get_financial_records TO authenticated;
GRANT EXECUTE ON FUNCTION get_unpaid_records TO authenticated;
GRANT EXECUTE ON FUNCTION get_monthly_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_quarterly_summary TO authenticated;
GRANT EXECUTE ON FUNCTION create_financial_record TO authenticated;
GRANT EXECUTE ON FUNCTION mark_records_billed TO authenticated;
```

---

## Role-Based Access Control

### User Roles

| Role | Permissions |
|------|-------------|
| admin | Full access: read, create, update, delete, billing operations |
| staff | Read and create records, update own records, cannot delete |
| billing | Read all records, mark as billed, cannot create/delete |
| readonly | View records only, no modifications |

---

## Security Constraints

### 1. Organization Isolation

Users can NEVER access data from other organizations.

### 2. Financial Record Immutability

Once marked as billed (inv_id set), records should not be modified.

### 3. Negative Amount Prevention

Quantity and unit_price must be non-negative.

### 4. Foreign Key Integrity

All references must be valid and belong to same organization.

---

## Audit Trail

### Audit Log Table

```sql
CREATE TABLE financial_record_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  old_data JSONB,
  new_data JSONB,
  organization_id UUID NOT NULL
);
```

---

**Document Version:** 1.0
**Last Updated:** 2026-01-11
**Status:** Phase 1 Requirements Documentation
