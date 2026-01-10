# API Contracts

This document specifies the required backend API endpoints and RPC functions for full Customers feature migration from FileMaker to Supabase.

## Overview

**Base URL**: `https://api.claritybusinesssolutions.ca`
**Authentication**: HMAC-SHA256 signature in `Authorization` header
**Content-Type**: `application/json`
**Response Format**: JSON with `{ success, data?, error? }` envelope

## Design Principles

1. **Single Source of Truth**: Backend APIs encapsulate all business logic
2. **Organization Scoping**: All operations automatically scoped to user's organization via JWT claims
3. **Atomic Operations**: Related table updates (email, phone, address) handled in single transaction
4. **Idempotency**: Create/update operations support idempotency keys
5. **Pagination**: List operations support cursor-based pagination
6. **Filtering**: List operations support common filter patterns

## Authentication

All requests require HMAC authentication header:

```
Authorization: Bearer {signature}.{timestamp}
```

Where:
- `signature` = HMAC-SHA256(secret_key, request_method + request_path + request_body + timestamp)
- `timestamp` = Unix timestamp in milliseconds

Additionally, user context is extracted from Supabase JWT:
- `user_id` (UUID)
- `organization_id` (UUID)
- `role` (string)

**Frontend Implementation Reference**: `src/services/dataService.js:generateBackendAuthHeader()`

## Required Endpoints

### 1. List Customers

**Endpoint**: `GET /api/customers`

**Purpose**: Retrieve paginated list of customers for the user's organization

**Query Parameters**:
- `limit` (integer, optional, default: 50, max: 200) - Number of records per page
- `offset` (integer, optional, default: 0) - Pagination offset
- `active` (boolean, optional) - Filter by active status (if null, return all)
- `search` (string, optional) - Search by business_name (case-insensitive, partial match)
- `sort` (string, optional, default: "business_name") - Sort field (`business_name`, `created_at`, `updated_at`)
- `order` (string, optional, default: "asc") - Sort order (`asc`, `desc`)
- `include_related` (boolean, optional, default: false) - Include email/phone/address in response

**Request Example**:
```http
GET /api/customers?limit=50&active=true&sort=business_name&order=asc&include_related=true
Authorization: Bearer {hmac_signature}.{timestamp}
```

**Response Success (200 OK)**:
```json
{
  "success": true,
  "data": {
    "customers": [
      {
        "id": "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
        "business_name": "Acme Corporation",
        "is_active": true,
        "primary_contact_name": "John Doe",
        "organization_id": "org-uuid",
        "created_at": "2023-01-15T10:30:00Z",
        "updated_at": "2023-12-01T14:45:00Z",
        "emails": [
          {
            "id": "email-uuid",
            "email": "contact@acme.com",
            "is_primary": true
          }
        ],
        "phones": [
          {
            "id": "phone-uuid",
            "phone": "+1 (555) 123-4567",
            "is_primary": true
          }
        ],
        "addresses": [
          {
            "id": "address-uuid",
            "address_line1": "123 Main St",
            "city": "San Francisco",
            "state": "CA",
            "postal_code": "94105",
            "country": "USA"
          }
        ]
      }
    ],
    "pagination": {
      "total": 127,
      "limit": 50,
      "offset": 0,
      "has_more": true
    }
  }
}
```

**Response Error (400 Bad Request)**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETER",
    "message": "Invalid sort field: invalid_field",
    "details": {
      "parameter": "sort",
      "allowed_values": ["business_name", "created_at", "updated_at"]
    }
  }
}
```

**Response Error (403 Forbidden)**:
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "User does not have permission to list customers"
  }
}
```

### 2. Get Customer by ID

**Endpoint**: `GET /api/customers/:id`

**Purpose**: Retrieve single customer with all related data

**Path Parameters**:
- `id` (UUID, required) - Customer ID

**Query Parameters**:
- `include_projects` (boolean, optional, default: false) - Include related projects
- `include_tasks` (boolean, optional, default: false) - Include related tasks
- `include_financial` (boolean, optional, default: false) - Include financial summary

**Request Example**:
```http
GET /api/customers/a1b2c3d4-e5f6-7890-abcd-1234567890ab?include_projects=true
Authorization: Bearer {hmac_signature}.{timestamp}
```

**Response Success (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
    "business_name": "Acme Corporation",
    "is_active": true,
    "primary_contact_name": "John Doe",
    "organization_id": "org-uuid",
    "created_at": "2023-01-15T10:30:00Z",
    "updated_at": "2023-12-01T14:45:00Z",
    "emails": [
      {
        "id": "email-uuid",
        "email": "contact@acme.com",
        "is_primary": true,
        "email_type": "work"
      }
    ],
    "phones": [
      {
        "id": "phone-uuid",
        "phone": "+1 (555) 123-4567",
        "is_primary": true,
        "phone_type": "office"
      }
    ],
    "addresses": [
      {
        "id": "address-uuid",
        "address_line1": "123 Main St",
        "city": "San Francisco",
        "state": "CA",
        "postal_code": "94105",
        "country": "USA",
        "is_primary": true
      }
    ],
    "projects": [
      {
        "id": "project-uuid",
        "name": "Website Redesign",
        "status": "active",
        "created_at": "2023-06-01T00:00:00Z"
      }
    ]
  }
}
```

**Response Error (404 Not Found)**:
```json
{
  "success": false,
  "error": {
    "code": "CUSTOMER_NOT_FOUND",
    "message": "Customer with ID a1b2c3d4-e5f6-7890-abcd-1234567890ab not found"
  }
}
```

### 3. Create Customer

**Endpoint**: `POST /api/customers`

**Purpose**: Create new customer with related data in single transaction

**Request Body**:
```json
{
  "business_name": "Acme Corporation",
  "primary_contact_name": "John Doe",
  "is_active": true,
  "emails": [
    {
      "email": "contact@acme.com",
      "is_primary": true,
      "email_type": "work"
    }
  ],
  "phones": [
    {
      "phone": "+1 (555) 123-4567",
      "is_primary": true,
      "phone_type": "office"
    }
  ],
  "addresses": [
    {
      "address_line1": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "postal_code": "94105",
      "country": "USA",
      "is_primary": true
    }
  ],
  "idempotency_key": "unique-key-123"
}
```

**Validation Rules**:
- `business_name`: Required, min length 1, max length 255
- `emails[]email`: Optional, must match email format, unique per customer
- `phones[]phone`: Optional, must match phone format
- `is_active`: Optional, defaults to `true`
- At least one of `emails` or `phones` should be provided (recommended, not enforced)

**Request Example**:
```http
POST /api/customers
Content-Type: application/json
Authorization: Bearer {hmac_signature}.{timestamp}

{
  "business_name": "Acme Corporation",
  "primary_contact_name": "John Doe",
  "emails": [{"email": "contact@acme.com", "is_primary": true}],
  "phones": [{"phone": "+1 (555) 123-4567", "is_primary": true}],
  "addresses": [{"address_line1": "123 Main St", "city": "San Francisco", "state": "CA"}]
}
```

**Response Success (201 Created)**:
```json
{
  "success": true,
  "data": {
    "id": "newly-created-uuid",
    "business_name": "Acme Corporation",
    "is_active": true,
    "primary_contact_name": "John Doe",
    "organization_id": "org-uuid",
    "created_at": "2024-01-10T15:30:00Z",
    "updated_at": "2024-01-10T15:30:00Z",
    "emails": [
      {
        "id": "email-uuid",
        "email": "contact@acme.com",
        "is_primary": true,
        "email_type": "work"
      }
    ],
    "phones": [
      {
        "id": "phone-uuid",
        "phone": "+1 (555) 123-4567",
        "is_primary": true,
        "phone_type": "office"
      }
    ],
    "addresses": [
      {
        "id": "address-uuid",
        "address_line1": "123 Main St",
        "city": "San Francisco",
        "state": "CA",
        "postal_code": null,
        "country": null,
        "is_primary": true
      }
    ]
  }
}
```

**Response Error (400 Bad Request)**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "business_name": ["Business name is required"],
      "emails[0].email": ["Invalid email format"]
    }
  }
}
```

**Response Error (409 Conflict)**:
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_CUSTOMER",
    "message": "Customer with business name 'Acme Corporation' already exists in your organization",
    "details": {
      "existing_customer_id": "existing-uuid"
    }
  }
}
```

### 4. Update Customer

**Endpoint**: `PATCH /api/customers/:id`

**Purpose**: Update existing customer and related data

**Path Parameters**:
- `id` (UUID, required) - Customer ID

**Request Body** (all fields optional, partial updates supported):
```json
{
  "business_name": "Acme Corp (Updated)",
  "primary_contact_name": "Jane Smith",
  "is_active": true,
  "emails": [
    {
      "id": "existing-email-uuid",
      "email": "updated@acme.com",
      "is_primary": true
    },
    {
      "email": "new@acme.com",
      "is_primary": false,
      "email_type": "billing"
    }
  ],
  "phones": [
    {
      "id": "existing-phone-uuid",
      "phone": "+1 (555) 999-8888"
    }
  ],
  "addresses": [
    {
      "id": "existing-address-uuid",
      "address_line1": "456 New St",
      "city": "San Francisco",
      "state": "CA",
      "postal_code": "94105",
      "country": "USA"
    }
  ]
}
```

**Update Semantics for Related Tables**:
- If `id` provided → update existing record
- If no `id` provided → create new record
- Records not included in request → **not deleted** (use delete endpoints)

**Request Example**:
```http
PATCH /api/customers/a1b2c3d4-e5f6-7890-abcd-1234567890ab
Content-Type: application/json
Authorization: Bearer {hmac_signature}.{timestamp}

{
  "business_name": "Acme Corp (Updated)",
  "emails": [
    {"id": "email-uuid", "email": "updated@acme.com", "is_primary": true}
  ]
}
```

**Response Success (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
    "business_name": "Acme Corp (Updated)",
    "is_active": true,
    "primary_contact_name": "John Doe",
    "organization_id": "org-uuid",
    "created_at": "2023-01-15T10:30:00Z",
    "updated_at": "2024-01-10T16:00:00Z",
    "emails": [
      {
        "id": "email-uuid",
        "email": "updated@acme.com",
        "is_primary": true
      }
    ],
    "phones": [...],
    "addresses": [...]
  }
}
```

**Response Error (404 Not Found)**:
```json
{
  "success": false,
  "error": {
    "code": "CUSTOMER_NOT_FOUND",
    "message": "Customer with ID a1b2c3d4-e5f6-7890-abcd-1234567890ab not found"
  }
}
```

**Response Error (409 Conflict)**:
```json
{
  "success": false,
  "error": {
    "code": "UPDATE_CONFLICT",
    "message": "Customer was modified by another user. Please refresh and try again.",
    "details": {
      "expected_updated_at": "2024-01-10T15:30:00Z",
      "actual_updated_at": "2024-01-10T15:45:00Z"
    }
  }
}
```

### 5. Toggle Customer Active Status

**Endpoint**: `PATCH /api/customers/:id/status`

**Purpose**: Toggle customer active status (optimized endpoint for common operation)

**Path Parameters**:
- `id` (UUID, required) - Customer ID

**Request Body**:
```json
{
  "is_active": false
}
```

**Request Example**:
```http
PATCH /api/customers/a1b2c3d4-e5f6-7890-abcd-1234567890ab/status
Content-Type: application/json
Authorization: Bearer {hmac_signature}.{timestamp}

{"is_active": false}
```

**Response Success (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
    "is_active": false,
    "updated_at": "2024-01-10T16:30:00Z"
  }
}
```

### 6. Delete Customer

**Endpoint**: `DELETE /api/customers/:id`

**Purpose**: Soft-delete customer (mark as deleted, preserve data)

**Path Parameters**:
- `id` (UUID, required) - Customer ID

**Query Parameters**:
- `hard_delete` (boolean, optional, default: false) - Permanently delete customer and all related data

**Request Example (Soft Delete)**:
```http
DELETE /api/customers/a1b2c3d4-e5f6-7890-abcd-1234567890ab
Authorization: Bearer {hmac_signature}.{timestamp}
```

**Response Success (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
    "deleted_at": "2024-01-10T17:00:00Z",
    "message": "Customer soft-deleted successfully. Can be restored within 30 days."
  }
}
```

**Request Example (Hard Delete)**:
```http
DELETE /api/customers/a1b2c3d4-e5f6-7890-abcd-1234567890ab?hard_delete=true
Authorization: Bearer {hmac_signature}.{timestamp}
```

**Response Success (204 No Content)**:
```
(no body)
```

**Response Error (409 Conflict)**:
```json
{
  "success": false,
  "error": {
    "code": "DELETE_CONFLICT",
    "message": "Cannot delete customer with active projects",
    "details": {
      "active_projects_count": 3,
      "project_ids": ["proj-uuid-1", "proj-uuid-2", "proj-uuid-3"]
    }
  }
}
```

### 7. Batch Create Customers (Migration Support)

**Endpoint**: `POST /api/customers/batch`

**Purpose**: Create multiple customers in single request (for migration from FileMaker)

**Request Body**:
```json
{
  "customers": [
    {
      "id": "filemaker-uuid-1",
      "business_name": "Customer 1",
      "emails": [{"email": "customer1@example.com", "is_primary": true}],
      ...
    },
    {
      "id": "filemaker-uuid-2",
      "business_name": "Customer 2",
      ...
    }
  ],
  "options": {
    "skip_duplicates": true,
    "return_errors": true
  }
}
```

**Response Success (201 Created)**:
```json
{
  "success": true,
  "data": {
    "created": 45,
    "skipped": 5,
    "failed": 0,
    "customer_ids": ["uuid-1", "uuid-2", ...],
    "errors": []
  }
}
```

### 8. Search Customers

**Endpoint**: `GET /api/customers/search`

**Purpose**: Full-text search across customer fields

**Query Parameters**:
- `q` (string, required, min length 2) - Search query
- `fields` (string[], optional, default: ["business_name", "email"]) - Fields to search
- `limit` (integer, optional, default: 20, max: 100)

**Request Example**:
```http
GET /api/customers/search?q=acme&fields=business_name,email&limit=10
Authorization: Bearer {hmac_signature}.{timestamp}
```

**Response Success (200 OK)**:
```json
{
  "success": true,
  "data": {
    "customers": [
      {
        "id": "uuid",
        "business_name": "Acme Corporation",
        "emails": [{"email": "contact@acme.com"}],
        "match_score": 0.95
      }
    ],
    "total_matches": 3
  }
}
```

## RPC Functions (Alternative Implementation)

As an alternative to REST endpoints, Supabase RPC functions can be used:

### rpc_list_customers

**Function Name**: `rpc_list_customers`

**Parameters**:
```sql
CREATE FUNCTION rpc_list_customers(
  p_organization_id UUID,
  p_active BOOLEAN DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
  id UUID,
  business_name TEXT,
  is_active BOOLEAN,
  primary_contact_name TEXT,
  emails JSONB,
  phones JSONB,
  addresses JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**Usage Example**:
```javascript
const { data, error } = await supabase.rpc('rpc_list_customers', {
  p_organization_id: user.orgId,
  p_active: true,
  p_search: 'acme',
  p_limit: 50,
  p_offset: 0
});
```

### rpc_create_customer

**Function Name**: `rpc_create_customer`

**Parameters**:
```sql
CREATE FUNCTION rpc_create_customer(
  p_organization_id UUID,
  p_business_name TEXT,
  p_primary_contact_name TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT TRUE,
  p_emails JSONB DEFAULT '[]'::jsonb,
  p_phones JSONB DEFAULT '[]'::jsonb,
  p_addresses JSONB DEFAULT '[]'::jsonb
) RETURNS JSONB
```

### rpc_update_customer

**Function Name**: `rpc_update_customer`

**Parameters**:
```sql
CREATE FUNCTION rpc_update_customer(
  p_customer_id UUID,
  p_organization_id UUID,
  p_business_name TEXT DEFAULT NULL,
  p_primary_contact_name TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL,
  p_emails JSONB DEFAULT NULL,
  p_phones JSONB DEFAULT NULL,
  p_addresses JSONB DEFAULT NULL
) RETURNS JSONB
```

## Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_PARAMETER` | 400 | Request parameter invalid or missing |
| `VALIDATION_ERROR` | 400 | Request body validation failed |
| `CUSTOMER_NOT_FOUND` | 404 | Customer ID not found |
| `UNAUTHORIZED` | 403 | User lacks permission for operation |
| `DUPLICATE_CUSTOMER` | 409 | Customer with same business_name exists |
| `UPDATE_CONFLICT` | 409 | Customer was modified concurrently |
| `DELETE_CONFLICT` | 409 | Customer has dependencies preventing deletion |
| `INTERNAL_ERROR` | 500 | Server-side error |

## Rate Limiting

- **List operations**: 100 requests/minute per user
- **Create operations**: 20 requests/minute per user
- **Update operations**: 50 requests/minute per user
- **Delete operations**: 10 requests/minute per user

**Response Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1704900000
```

**Response Error (429 Too Many Requests)**:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 30 seconds.",
    "retry_after": 30
  }
}
```

## Pagination Best Practices

Use cursor-based pagination for large datasets:

**First Page**:
```http
GET /api/customers?limit=50
```

**Next Page**:
```http
GET /api/customers?limit=50&cursor=eyJpZCI6InV1aWQiLCJvcmRlciI6ImFzYyJ9
```

**Response includes cursor**:
```json
{
  "data": {
    "customers": [...],
    "pagination": {
      "next_cursor": "eyJpZCI6InV1aWQiLCJvcmRlciI6ImFzYyJ9",
      "has_more": true
    }
  }
}
```

## Idempotency

Create and update operations support idempotency keys:

**Request Header**:
```
Idempotency-Key: unique-key-12345
```

- Same idempotency key within 24 hours returns cached response
- Prevents duplicate customer creation on network retries
- Idempotency keys automatically expire after 24 hours

## Webhooks (Optional)

Backend can emit webhooks for customer events:

**Event Types**:
- `customer.created`
- `customer.updated`
- `customer.deleted`
- `customer.status_changed`

**Payload Example**:
```json
{
  "event": "customer.updated",
  "timestamp": "2024-01-10T17:00:00Z",
  "data": {
    "customer_id": "uuid",
    "organization_id": "org-uuid",
    "changes": {
      "business_name": {"old": "Acme Corp", "new": "Acme Corporation"}
    }
  }
}
```

## Implementation Priorities

**Phase 1 (MVP)**:
1. List Customers (with filters, pagination)
2. Get Customer by ID
3. Create Customer
4. Update Customer
5. Toggle Customer Status

**Phase 2 (Enhanced)**:
6. Delete Customer (soft delete)
7. Search Customers
8. Batch Create Customers

**Phase 3 (Advanced)**:
9. Webhooks
10. Advanced filtering/aggregations
11. Customer activity logs

## Frontend Integration Guide

Update `src/api/customers.js` to use backend API instead of FileMaker:

**Before (FileMaker)**:
```javascript
export async function fetchCustomers() {
  return handleFileMakerOperation(async () => {
    return await fetchDataFromFileMaker({
      layout: Layouts.CUSTOMERS,
      action: Actions.READ,
      query: [{ "__ID": "*" }]
    });
  });
}
```

**After (Backend API)**:
```javascript
import { backendAPI } from './backendAPI';

export async function fetchCustomers(options = {}) {
  return await backendAPI.get('/api/customers', {
    params: {
      active: options.activeOnly || null,
      search: options.search || null,
      limit: options.limit || 50,
      include_related: true
    }
  });
}
```

See [Current Implementation](./current-implementation.md) for complete code reference.
