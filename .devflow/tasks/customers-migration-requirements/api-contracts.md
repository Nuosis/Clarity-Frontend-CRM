# API Endpoint Contracts - Customers Migration

## Overview

This document specifies all required backend API endpoints for migrating the Customers feature from FileMaker to Supabase. These contracts define the interface between the frontend application and the backend API, ensuring consistent data exchange and business logic execution.

**Document Version**: 1.0
**Last Updated**: 2026-01-10
**Status**: Requirements Definition
**Related Documents**:
- [Data Model Mapping](./data-model-mapping.md)
- [Supabase Schema](./supabase-schema.md)
- [Current Implementation](../../requirements/customers/current-implementation.md)

---

## Table of Contents

1. [Design Principles](#design-principles)
2. [Authentication & Authorization](#authentication--authorization)
3. [Core CRUD Endpoints](#core-crud-endpoints)
4. [Specialized Endpoints](#specialized-endpoints)
5. [Error Handling](#error-handling)
6. [Request/Response Examples](#requestresponse-examples)
7. [Edge Cases](#edge-cases)
8. [Migration-Specific Endpoints](#migration-specific-endpoints)

---

## Design Principles

### 1. Single Source of Truth
- Backend API encapsulates all business logic
- Frontend should not implement business rules (validation, calculations, transformations)
- Database operations happen exclusively through backend endpoints

### 2. Organization Scoping
- All operations automatically scoped to user's organization via JWT claims
- RLS policies enforce multi-tenant data isolation
- No customer IDs from other organizations can be accessed

### 3. Atomic Transactions
- Related table updates (email, phone, address) handled in single database transaction
- All-or-nothing semantics: either all operations succeed or all rollback
- No partial state changes visible to users

### 4. Idempotency
- Create/update operations support idempotency keys
- Duplicate requests with same idempotency key return cached response
- Prevents duplicate customer creation on network retries

### 5. Consistent Response Format
All responses use standardized envelope:
```json
{
  "success": true|false,
  "data": {...},      // Present on success
  "error": {...}      // Present on failure
}
```

### 6. Performance Considerations
- List operations support cursor-based pagination (default limit: 50, max: 200)
- Related data loading is optional via `include_*` parameters
- Indexes on frequently queried fields (organization_id, business_name, created_at)

---

## Authentication & Authorization

### HMAC-SHA256 Authentication

**Header Format**:
```
Authorization: Bearer {signature}.{timestamp}
```

**Signature Calculation**:
```javascript
const message = `${timestamp}.${JSON.stringify(requestBody)}`;
const signature = crypto
  .createHmac('sha256', SECRET_KEY)
  .update(message)
  .digest('hex');
```

**Frontend Implementation**: `src/services/dataService.js:generateBackendAuthHeader()`

**Backend Validation**:
1. Extract timestamp and signature from Authorization header
2. Reconstruct message using timestamp and request body
3. Calculate expected signature using HMAC-SHA256
4. Compare signatures (constant-time comparison)
5. Validate timestamp is within acceptable window (±5 minutes)

### User Context Extraction

Supabase JWT claims provide user context:
```json
{
  "sub": "user-uuid",              // User ID
  "organization_id": "org-uuid",   // Organization membership
  "role": "admin|member|viewer",   // User role
  "email": "user@example.com"
}
```

**Organization Scoping**:
- All queries automatically filtered by `organization_id = current_user.organization_id`
- RLS policies enforce isolation at database level
- No cross-organization data access permitted

---

## Core CRUD Endpoints

### 1. List Customers

**Endpoint**: `GET /api/customers`

**Purpose**: Retrieve paginated list of customers for the user's organization

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | integer | No | 50 | Records per page (max: 200) |
| `offset` | integer | No | 0 | Pagination offset |
| `cursor` | string | No | null | Cursor for cursor-based pagination |
| `active` | boolean | No | null | Filter by active status (null = all) |
| `search` | string | No | null | Search business_name (case-insensitive, partial) |
| `sort` | string | No | "business_name" | Sort field: `business_name`, `created_at`, `updated_at` |
| `order` | string | No | "asc" | Sort order: `asc`, `desc` |
| `include_related` | boolean | No | false | Include emails/phones/addresses in response |
| `include_stats` | boolean | No | false | Include aggregate statistics |

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
        "name": null,
        "first_name": null,
        "last_name": null,
        "is_active": true,
        "primary_contact_name": "John Doe",
        "organization_id": "org-uuid-123",
        "type": "CUSTOMER",
        "created_at": "2023-01-15T10:30:00.000Z",
        "updated_at": "2025-12-01T14:45:00.000Z",
        "emails": [
          {
            "id": "email-uuid-1",
            "email": "contact@acme.com",
            "is_primary": true,
            "created_at": "2023-01-15T10:30:00.000Z",
            "updated_at": "2023-01-15T10:30:00.000Z"
          }
        ],
        "phones": [
          {
            "id": "phone-uuid-1",
            "phone": "+14035551234",
            "type": "mobile",
            "is_primary": true,
            "created_at": "2023-01-15T10:30:00.000Z",
            "updated_at": "2023-01-15T10:30:00.000Z"
          }
        ],
        "addresses": [
          {
            "id": "address-uuid-1",
            "address_line1": "123 Main St",
            "address_line2": "Suite 100",
            "city": "San Francisco",
            "state": "CA",
            "postal_code": "94105",
            "country": "USA",
            "created_at": "2023-01-15T10:30:00.000Z",
            "updated_at": "2023-01-15T10:30:00.000Z"
          }
        ],
        "financial_data": {
          "charge_rate": 150.00,
          "currencies": {
            "usd": true,
            "eur": false
          },
          "prepay_amount": 1000.00,
          "funds_available": 750.00
        },
        "obsi_client_no": "OBSI-12345",
        "contact_person_name": "Jane Smith"
      }
    ],
    "pagination": {
      "total": 127,
      "limit": 50,
      "offset": 0,
      "has_more": true,
      "next_cursor": "eyJpZCI6InV1aWQiLCJvcmRlciI6ImFzYyJ9"
    },
    "stats": {
      "total_customers": 127,
      "active_customers": 98,
      "inactive_customers": 29
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

**Business Logic**:
1. Extract organization_id from JWT claims
2. Query customers table filtered by organization_id
3. Apply search filter if provided (ILIKE on business_name)
4. Apply active status filter if provided
5. Sort results by specified field and order
6. Paginate results (limit + offset or cursor)
7. Optionally join related tables (emails, phones, addresses)
8. Return formatted response with pagination metadata

**Performance Notes**:
- Index on `(organization_id, business_name)` for fast sorted queries
- Index on `(organization_id, is_active)` for status filtering
- Cursor-based pagination preferred for large datasets (>1000 records)

**Code Reference**: Current implementation at `src/api/customers.js:7-17` (FileMaker version)

---

### 2. Get Customer by ID

**Endpoint**: `GET /api/customers/:id`

**Purpose**: Retrieve single customer with all related data

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Customer ID |

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `include_projects` | boolean | No | false | Include related projects |
| `include_tasks` | boolean | No | false | Include related tasks (via projects) |
| `include_financial` | boolean | No | false | Include financial summary (customer_sales) |
| `include_contacts` | boolean | No | false | Include contact persons (customer_contacts) |

**Request Example**:
```http
GET /api/customers/a1b2c3d4-e5f6-7890-abcd-1234567890ab?include_projects=true&include_financial=true
Authorization: Bearer {hmac_signature}.{timestamp}
```

**Response Success (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
    "business_name": "Acme Corporation",
    "name": null,
    "first_name": null,
    "last_name": null,
    "is_active": true,
    "primary_contact_name": "John Doe",
    "organization_id": "org-uuid-123",
    "type": "CUSTOMER",
    "created_at": "2023-01-15T10:30:00.000Z",
    "updated_at": "2025-12-01T14:45:00.000Z",
    "emails": [
      {
        "id": "email-uuid-1",
        "email": "contact@acme.com",
        "is_primary": true,
        "created_at": "2023-01-15T10:30:00.000Z",
        "updated_at": "2023-01-15T10:30:00.000Z"
      },
      {
        "id": "email-uuid-2",
        "email": "billing@acme.com",
        "is_primary": false,
        "created_at": "2024-03-20T09:15:00.000Z",
        "updated_at": "2024-03-20T09:15:00.000Z"
      }
    ],
    "phones": [
      {
        "id": "phone-uuid-1",
        "phone": "+14035551234",
        "type": "mobile",
        "is_primary": true,
        "created_at": "2023-01-15T10:30:00.000Z",
        "updated_at": "2023-01-15T10:30:00.000Z"
      }
    ],
    "addresses": [
      {
        "id": "address-uuid-1",
        "address_line1": "123 Main St",
        "address_line2": "Suite 100",
        "city": "San Francisco",
        "state": "CA",
        "postal_code": "94105",
        "country": "USA",
        "created_at": "2023-01-15T10:30:00.000Z",
        "updated_at": "2023-01-15T10:30:00.000Z"
      }
    ],
    "financial_data": {
      "charge_rate": 150.00,
      "currencies": {
        "usd": true,
        "eur": false
      },
      "prepay_amount": 1000.00,
      "funds_available": 750.00
    },
    "database_credentials": null,
    "obsi_client_no": "OBSI-12345",
    "contact_person_name": "Jane Smith",
    "projects": [
      {
        "id": "project-uuid-1",
        "name": "Website Redesign",
        "status": "active",
        "created_at": "2023-06-01T00:00:00.000Z",
        "updated_at": "2025-12-15T10:00:00.000Z"
      }
    ],
    "financial_summary": {
      "total_sales": 15000.00,
      "total_invoices": 3,
      "outstanding_balance": 2500.00,
      "prepaid_balance": 750.00
    }
  }
}
```

**Response Error (404 Not Found)**:
```json
{
  "success": false,
  "error": {
    "code": "CUSTOMER_NOT_FOUND",
    "message": "Customer with ID a1b2c3d4-e5f6-7890-abcd-1234567890ab not found or does not belong to your organization"
  }
}
```

**Response Error (400 Bad Request)**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_UUID",
    "message": "Customer ID must be a valid UUID",
    "details": {
      "provided": "invalid-id",
      "expected_format": "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
    }
  }
}
```

**Business Logic**:
1. Validate UUID format of customer ID
2. Query customers table by ID AND organization_id (RLS enforcement)
3. Join customer_email, customer_phone, customer_address tables
4. Optionally join projects table if include_projects=true
5. Optionally aggregate customer_sales if include_financial=true
6. Return 404 if customer not found or belongs to different organization
7. Return formatted customer object with all related data

**Edge Cases**:
- Customer exists but belongs to different organization → 404 (not 403, to prevent org enumeration)
- Customer has no emails/phones/addresses → Return empty arrays
- Include parameters with invalid values → Ignore (default to false)

**Code Reference**: Current implementation at `src/api/customers.js:24-36` (FileMaker version)

---

### 3. Create Customer

**Endpoint**: `POST /api/customers`

**Purpose**: Create new customer with related data in single atomic transaction

**Request Headers**:
```
Content-Type: application/json
Authorization: Bearer {hmac_signature}.{timestamp}
Idempotency-Key: unique-key-123 (optional)
```

**Request Body**:
```json
{
  "business_name": "Acme Corporation",
  "name": null,
  "first_name": null,
  "last_name": null,
  "primary_contact_name": "John Doe",
  "is_active": true,
  "type": "CUSTOMER",
  "obsi_client_no": "OBSI-12345",
  "contact_person_name": "Jane Smith",
  "financial_data": {
    "charge_rate": 150.00,
    "currencies": {
      "usd": true,
      "eur": false
    },
    "prepay_amount": 1000.00,
    "funds_available": 1000.00
  },
  "database_credentials": null,
  "emails": [
    {
      "email": "contact@acme.com",
      "is_primary": true
    },
    {
      "email": "billing@acme.com",
      "is_primary": false
    }
  ],
  "phones": [
    {
      "phone": "+14035551234",
      "type": "mobile",
      "is_primary": true
    }
  ],
  "addresses": [
    {
      "address_line1": "123 Main St",
      "address_line2": "Suite 100",
      "city": "San Francisco",
      "state": "CA",
      "postal_code": "94105",
      "country": "USA"
    }
  ]
}
```

**Validation Rules**:

| Field | Required | Type | Constraints | Error Code |
|-------|----------|------|-------------|------------|
| `business_name` | Yes | string | 1-255 chars, non-empty after trim | `BUSINESS_NAME_REQUIRED` |
| `is_active` | No | boolean | Default: true | - |
| `type` | No | enum | Must be valid customertype enum value, default: 'CUSTOMER' | `INVALID_CUSTOMER_TYPE` |
| `emails[].email` | If emails provided | string | Valid email format, unique globally | `INVALID_EMAIL_FORMAT`, `DUPLICATE_EMAIL` |
| `emails[].is_primary` | No | boolean | Only one email can have is_primary=true | `MULTIPLE_PRIMARY_EMAILS` |
| `phones[].phone` | If phones provided | string | Valid phone format, unique globally | `INVALID_PHONE_FORMAT`, `DUPLICATE_PHONE` |
| `phones[].is_primary` | No | boolean | Only one phone can have is_primary=true | `MULTIPLE_PRIMARY_PHONES` |
| `addresses[].city` | If address provided | string | Required if creating address | `ADDRESS_CITY_REQUIRED` |
| `addresses[].state` | If address provided | string | Required if creating address | `ADDRESS_STATE_REQUIRED` |
| `financial_data` | No | JSONB | Valid JSON structure | `INVALID_FINANCIAL_DATA` |
| `database_credentials` | No | JSONB | Valid JSON structure (encrypted at rest) | `INVALID_CREDENTIALS_DATA` |

**Request Example**:
```http
POST /api/customers
Content-Type: application/json
Authorization: Bearer {hmac_signature}.{timestamp}
Idempotency-Key: customer-create-20260110-001

{
  "business_name": "Acme Corporation",
  "primary_contact_name": "John Doe",
  "emails": [{"email": "contact@acme.com", "is_primary": true}],
  "phones": [{"phone": "+14035551234", "is_primary": true}],
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
    "name": null,
    "first_name": null,
    "last_name": null,
    "is_active": true,
    "primary_contact_name": "John Doe",
    "organization_id": "org-uuid-123",
    "type": "CUSTOMER",
    "created_at": "2026-01-10T15:30:00.000Z",
    "updated_at": "2026-01-10T15:30:00.000Z",
    "emails": [
      {
        "id": "email-uuid-new",
        "email": "contact@acme.com",
        "is_primary": true,
        "created_at": "2026-01-10T15:30:00.000Z",
        "updated_at": "2026-01-10T15:30:00.000Z"
      }
    ],
    "phones": [
      {
        "id": "phone-uuid-new",
        "phone": "+14035551234",
        "type": "mobile",
        "is_primary": true,
        "created_at": "2026-01-10T15:30:00.000Z",
        "updated_at": "2026-01-10T15:30:00.000Z"
      }
    ],
    "addresses": [
      {
        "id": "address-uuid-new",
        "address_line1": "123 Main St",
        "address_line2": null,
        "city": "San Francisco",
        "state": "CA",
        "postal_code": null,
        "country": null,
        "created_at": "2026-01-10T15:30:00.000Z",
        "updated_at": "2026-01-10T15:30:00.000Z"
      }
    ],
    "financial_data": null,
    "database_credentials": null,
    "obsi_client_no": null,
    "contact_person_name": null
  }
}
```

**Response Error (400 Bad Request - Validation)**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "business_name": ["Business name is required"],
      "emails[0].email": ["Invalid email format: not-an-email"],
      "addresses[0].city": ["City is required when creating address"],
      "emails": ["Only one email can be marked as primary"]
    }
  }
}
```

**Response Error (409 Conflict - Duplicate Email)**:
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_EMAIL",
    "message": "Email address 'contact@acme.com' is already registered to another customer",
    "details": {
      "email": "contact@acme.com",
      "existing_customer_id": "existing-customer-uuid"
    }
  }
}
```

**Response Error (409 Conflict - Duplicate Phone)**:
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_PHONE",
    "message": "Phone number '+14035551234' is already registered to another customer",
    "details": {
      "phone": "+14035551234",
      "existing_customer_id": "existing-customer-uuid"
    }
  }
}
```

**Business Logic**:
1. Validate all request fields according to validation rules
2. Extract organization_id from JWT claims
3. Begin database transaction
4. Normalize email addresses (lowercase, trim whitespace)
5. Normalize phone numbers (remove formatting, validate E.164 if possible)
6. Check for duplicate emails/phones globally (unique constraints)
7. Verify only one email has is_primary=true, only one phone has is_primary=true
8. Generate UUID for customer ID
9. Insert into customers table (id, business_name, organization_id, type, is_active, timestamps, JSONB fields)
10. Insert into customer_email table (for each email)
11. Insert into customer_phone table (for each phone)
12. Insert into customer_address table (for each address, validate city/state required)
13. Commit transaction
14. Return created customer with all related data

**Transaction Rollback Scenarios**:
- Duplicate email/phone constraint violation → Rollback, return 409
- Missing required fields (city/state for address) → Rollback, return 400
- Database constraint violation → Rollback, return 500

**Idempotency Handling**:
- If Idempotency-Key header provided and exists in cache (24hr TTL)
- Return cached response (201 with same customer data)
- Do not create duplicate customer

**Code Reference**: Current implementation at `src/api/customers.js:64-76` (FileMaker version), dual-write at `src/hooks/useCustomer.js:83-107`

---

### 4. Update Customer

**Endpoint**: `PATCH /api/customers/:id`

**Purpose**: Update existing customer and related data in atomic transaction

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Customer ID |

**Request Headers**:
```
Content-Type: application/json
Authorization: Bearer {hmac_signature}.{timestamp}
If-Unmodified-Since: Sat, 10 Jan 2026 14:00:00 GMT (optional, for optimistic locking)
```

**Request Body** (all fields optional, partial updates supported):
```json
{
  "business_name": "Acme Corp (Updated)",
  "primary_contact_name": "Jane Smith",
  "is_active": true,
  "obsi_client_no": "OBSI-54321",
  "contact_person_name": "Robert Johnson",
  "financial_data": {
    "charge_rate": 175.00,
    "currencies": {
      "usd": true,
      "eur": true
    },
    "prepay_amount": 2000.00,
    "funds_available": 1500.00
  },
  "emails": [
    {
      "id": "existing-email-uuid",
      "email": "updated@acme.com",
      "is_primary": true
    },
    {
      "email": "new@acme.com",
      "is_primary": false
    }
  ],
  "phones": [
    {
      "id": "existing-phone-uuid",
      "phone": "+14039998888"
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

| Scenario | Behavior |
|----------|----------|
| Email/Phone/Address with `id` provided | Update existing record |
| Email/Phone/Address without `id` | Create new record |
| Email/Phone/Address not included in request | **No change** (records are NOT deleted) |
| To delete email/phone/address | Use dedicated DELETE endpoints |

**Validation Rules**:
- Same validation as Create Customer
- Cannot update `id`, `organization_id`, `created_at` (immutable fields)
- Email/Phone uniqueness checked excluding current customer's records

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
    "organization_id": "org-uuid-123",
    "type": "CUSTOMER",
    "created_at": "2023-01-15T10:30:00.000Z",
    "updated_at": "2026-01-10T16:00:00.000Z",
    "emails": [
      {
        "id": "email-uuid",
        "email": "updated@acme.com",
        "is_primary": true,
        "created_at": "2023-01-15T10:30:00.000Z",
        "updated_at": "2026-01-10T16:00:00.000Z"
      }
    ],
    "phones": [...],
    "addresses": [...],
    "financial_data": {...},
    "database_credentials": null,
    "obsi_client_no": "OBSI-54321",
    "contact_person_name": "Robert Johnson"
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

**Response Error (409 Conflict - Concurrent Update)**:
```json
{
  "success": false,
  "error": {
    "code": "UPDATE_CONFLICT",
    "message": "Customer was modified by another user. Please refresh and try again.",
    "details": {
      "expected_updated_at": "2026-01-10T15:30:00.000Z",
      "actual_updated_at": "2026-01-10T15:45:00.000Z"
    }
  }
}
```

**Response Error (412 Precondition Failed)**:
```json
{
  "success": false,
  "error": {
    "code": "PRECONDITION_FAILED",
    "message": "Resource has been modified since specified timestamp",
    "details": {
      "if_unmodified_since": "2026-01-10T14:00:00.000Z",
      "last_modified": "2026-01-10T15:00:00.000Z"
    }
  }
}
```

**Business Logic**:
1. Validate customer ID format
2. Verify customer exists and belongs to user's organization
3. If If-Unmodified-Since header present, check if customer modified since that time
4. Begin database transaction
5. Update customers table with provided fields (business_name, is_active, JSONB fields, etc.)
6. For each email in request:
   - If `id` provided → UPDATE customer_email WHERE id = ? AND customer_id = ?
   - If no `id` → INSERT into customer_email
7. For each phone in request:
   - If `id` provided → UPDATE customer_phone WHERE id = ? AND customer_id = ?
   - If no `id` → INSERT into customer_phone
8. For each address in request:
   - If `id` provided → UPDATE customer_address WHERE id = ? AND customer_id = ?
   - If no `id` → INSERT into customer_address
9. Set customers.updated_at = now()
10. Commit transaction
11. Return updated customer with all related data

**Optimistic Locking**:
- Use If-Unmodified-Since header to prevent lost updates
- Backend compares header timestamp with customers.updated_at
- Returns 412 if resource modified since specified time
- Frontend should fetch latest data and retry

**Code Reference**: Current implementation at `src/api/customers.js:44-57` (FileMaker version), dual-write at `src/hooks/useCustomer.js:112-177`

---

### 5. Toggle Customer Status

**Endpoint**: `PATCH /api/customers/:id/status`

**Purpose**: Toggle customer active status (optimized endpoint for common operation)

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Customer ID |

**Request Body**:
```json
{
  "is_active": false
}
```

**Validation Rules**:
- `is_active` required, must be boolean

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
    "updated_at": "2026-01-10T16:30:00.000Z"
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

**Business Logic**:
1. Validate customer ID format
2. Verify customer exists and belongs to user's organization
3. Update customers table: SET is_active = ?, updated_at = now() WHERE id = ?
4. Return minimal response (id, is_active, updated_at)

**Performance Notes**:
- Optimized for quick status toggling (no related table joins)
- Index on (organization_id, is_active) for fast filtering

**Code Reference**: Current implementation at `src/api/customers.js:84-99` (FileMaker version)

---

### 6. Delete Customer

**Endpoint**: `DELETE /api/customers/:id`

**Purpose**: Delete customer (soft delete by default, hard delete optional)

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Customer ID |

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `hard_delete` | boolean | No | false | Permanently delete customer and all related data |
| `force` | boolean | No | false | Force delete even if customer has active projects |

**Request Example (Soft Delete)**:
```http
DELETE /api/customers/a1b2c3d4-e5f6-7890-abcd-1234567890ab
Authorization: Bearer {hmac_signature}.{timestamp}
```

**Response Success (200 OK - Soft Delete)**:
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
    "deleted_at": "2026-01-10T17:00:00.000Z",
    "message": "Customer soft-deleted successfully. Can be restored within 30 days.",
    "restore_url": "/api/customers/a1b2c3d4-e5f6-7890-abcd-1234567890ab/restore"
  }
}
```

**Request Example (Hard Delete)**:
```http
DELETE /api/customers/a1b2c3d4-e5f6-7890-abcd-1234567890ab?hard_delete=true&force=true
Authorization: Bearer {hmac_signature}.{timestamp}
```

**Response Success (204 No Content - Hard Delete)**:
```
(no body)
```

**Response Error (409 Conflict)**:
```json
{
  "success": false,
  "error": {
    "code": "DELETE_CONFLICT",
    "message": "Cannot delete customer with active projects or outstanding invoices",
    "details": {
      "active_projects_count": 3,
      "project_ids": ["proj-uuid-1", "proj-uuid-2", "proj-uuid-3"],
      "outstanding_invoices_count": 2,
      "outstanding_balance": 5000.00,
      "suggestion": "Set customer to inactive instead, or use force=true to delete anyway"
    }
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

**Business Logic**:

**Soft Delete**:
1. Verify customer exists and belongs to user's organization
2. Check for active projects (WHERE customer_id = ? AND status = 'active')
3. Check for outstanding invoices (WHERE customer_id = ? AND balance > 0)
4. If dependencies exist and force=false → Return 409 conflict
5. Update customers table: SET deleted_at = now(), updated_at = now() WHERE id = ?
6. Keep all related data intact (emails, phones, addresses)
7. Return success with restore instructions

**Hard Delete**:
1. Verify customer exists and belongs to user's organization
2. Check for active projects/invoices (same as soft delete)
3. If dependencies exist and force=false → Return 409 conflict
4. Begin transaction
5. Delete from customer_email WHERE customer_id = ? (CASCADE)
6. Delete from customer_phone WHERE customer_id = ? (CASCADE)
7. Delete from customer_address WHERE customer_id = ? (CASCADE)
8. Delete from customer_contacts WHERE customer_id = ? (CASCADE)
9. Archive customer_sales records (move to archive table or mark as orphaned)
10. Delete from customers WHERE id = ?
11. Commit transaction
12. Return 204 No Content

**Restore Customer** (bonus endpoint):
```http
POST /api/customers/:id/restore
Authorization: Bearer {hmac_signature}.{timestamp}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
    "deleted_at": null,
    "message": "Customer restored successfully"
  }
}
```

**Code Reference**: Current implementation at `src/api/customers.js:122-134` (FileMaker version, no dual-write)

---

## Specialized Endpoints

### 7. Search Customers

**Endpoint**: `GET /api/customers/search`

**Purpose**: Full-text search across customer fields with fuzzy matching

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | Yes | - | Search query (min length: 2) |
| `fields` | string[] | No | ["business_name", "email"] | Fields to search in |
| `limit` | integer | No | 20 | Max results (max: 100) |
| `fuzzy` | boolean | No | true | Enable fuzzy matching (Levenshtein distance ≤ 2) |

**Request Example**:
```http
GET /api/customers/search?q=acme&fields=business_name,email&limit=10&fuzzy=true
Authorization: Bearer {hmac_signature}.{timestamp}
```

**Response Success (200 OK)**:
```json
{
  "success": true,
  "data": {
    "customers": [
      {
        "id": "uuid-1",
        "business_name": "Acme Corporation",
        "emails": [{"email": "contact@acme.com", "is_primary": true}],
        "phones": [{"phone": "+14035551234", "is_primary": true}],
        "match_score": 0.95,
        "matched_fields": ["business_name"]
      },
      {
        "id": "uuid-2",
        "business_name": "Acme Industries",
        "emails": [{"email": "info@acmeindustries.com", "is_primary": true}],
        "phones": [],
        "match_score": 0.88,
        "matched_fields": ["business_name"]
      }
    ],
    "total_matches": 3,
    "search_time_ms": 12
  }
}
```

**Response Error (400 Bad Request)**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_SEARCH_QUERY",
    "message": "Search query must be at least 2 characters",
    "details": {
      "provided": "a",
      "min_length": 2
    }
  }
}
```

**Business Logic**:
1. Validate query length (min 2 chars)
2. Parse fields parameter (validate allowed fields)
3. Build full-text search query using PostgreSQL tsvector/tsquery
4. If fuzzy=true, use pg_trgm extension for trigram similarity
5. Calculate match score (ts_rank for tsvector, similarity() for trigram)
6. Filter by organization_id
7. Order by match_score DESC
8. Limit results
9. Return matches with highlighted fields

**PostgreSQL Implementation**:
```sql
SELECT
  c.*,
  ts_rank(to_tsvector('english', c.business_name), to_tsquery('acme:*')) as match_score,
  ARRAY['business_name'] as matched_fields
FROM customers c
WHERE
  c.organization_id = $1
  AND to_tsvector('english', c.business_name) @@ to_tsquery('acme:*')
ORDER BY match_score DESC
LIMIT 10;
```

**Performance Notes**:
- Create GIN index on tsvector columns for fast full-text search
- Create GiST index on business_name for trigram similarity

---

### 8. Batch Create Customers (Migration Support)

**Endpoint**: `POST /api/customers/batch`

**Purpose**: Create multiple customers in single request (for FileMaker migration)

**Request Body**:
```json
{
  "customers": [
    {
      "id": "filemaker-uuid-1",
      "business_name": "Customer 1",
      "emails": [{"email": "customer1@example.com", "is_primary": true}],
      "phones": [{"phone": "+14035551234", "is_primary": true}],
      "addresses": [{"address_line1": "123 Main St", "city": "Calgary", "state": "AB"}],
      "financial_data": {
        "charge_rate": 100.00,
        "currencies": {"usd": true, "eur": false}
      }
    },
    {
      "id": "filemaker-uuid-2",
      "business_name": "Customer 2",
      "emails": [{"email": "customer2@example.com", "is_primary": true}],
      "phones": [{"phone": "+14035559999", "is_primary": true}]
    }
  ],
  "options": {
    "skip_duplicates": true,
    "return_errors": true,
    "validate_only": false,
    "batch_size": 50
  }
}
```

**Validation Rules**:
- Same validation as single customer create
- Maximum 200 customers per batch
- Duplicate email/phone checks across batch AND existing customers

**Request Example**:
```http
POST /api/customers/batch
Content-Type: application/json
Authorization: Bearer {hmac_signature}.{timestamp}

{
  "customers": [...],
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
    "summary": {
      "total_submitted": 50,
      "created": 45,
      "skipped": 5,
      "failed": 0
    },
    "created_customer_ids": [
      "filemaker-uuid-1",
      "filemaker-uuid-2",
      "..."
    ],
    "skipped_customers": [
      {
        "index": 10,
        "id": "filemaker-uuid-10",
        "reason": "DUPLICATE_EMAIL",
        "details": {
          "email": "duplicate@example.com",
          "existing_customer_id": "existing-uuid"
        }
      }
    ],
    "errors": [],
    "processing_time_ms": 1234
  }
}
```

**Response Partial Success (207 Multi-Status)**:
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_submitted": 50,
      "created": 40,
      "skipped": 5,
      "failed": 5
    },
    "created_customer_ids": [...],
    "skipped_customers": [...],
    "errors": [
      {
        "index": 25,
        "id": "filemaker-uuid-25",
        "error": {
          "code": "VALIDATION_ERROR",
          "message": "Business name is required",
          "details": {}
        }
      }
    ],
    "processing_time_ms": 1500
  }
}
```

**Business Logic**:
1. Validate batch size (max 200)
2. Validate each customer individually
3. Build transaction for all valid customers
4. For each customer:
   - Check for duplicate emails/phones (within batch and existing data)
   - If skip_duplicates=true and duplicate found → Skip
   - If skip_duplicates=false and duplicate found → Add to errors
   - Insert customer + related tables atomically
5. Commit transaction (all-or-nothing if skip_duplicates=false)
6. Return detailed results with created/skipped/failed counts

**Batch Processing Strategy**:
- Process in chunks of `batch_size` (default 50)
- Each chunk is a separate transaction
- Allows partial success (some chunks succeed, some fail)
- Progress tracking via batch processing queue

**Migration Use Case**:
```javascript
// Migration script
const fileMakerCustomers = await fetchAllFromFileMaker();
const batches = chunk(fileMakerCustomers, 50);

for (const batch of batches) {
  const response = await api.post('/api/customers/batch', {
    customers: batch,
    options: { skip_duplicates: true, return_errors: true }
  });
  console.log(`Batch: ${response.data.summary.created} created, ${response.data.summary.skipped} skipped`);
}
```

---

### 9. Get Customer Statistics

**Endpoint**: `GET /api/customers/stats`

**Purpose**: Get aggregate statistics for customers in organization

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `period` | string | No | "all" | Time period: "all", "month", "quarter", "year" |

**Request Example**:
```http
GET /api/customers/stats?period=month
Authorization: Bearer {hmac_signature}.{timestamp}
```

**Response Success (200 OK)**:
```json
{
  "success": true,
  "data": {
    "total_customers": 127,
    "active_customers": 98,
    "inactive_customers": 29,
    "new_customers_this_period": 5,
    "customers_by_type": {
      "CUSTOMER": 120,
      "PROSPECT": 5,
      "FAMILY": 1,
      "FRIEND": 1
    },
    "customers_with_emails": 115,
    "customers_with_phones": 110,
    "customers_with_addresses": 90,
    "average_projects_per_customer": 2.3,
    "total_revenue": 125000.00,
    "period": {
      "start": "2025-12-10T00:00:00.000Z",
      "end": "2026-01-10T23:59:59.999Z"
    }
  }
}
```

**Business Logic**:
1. Extract organization_id from JWT
2. Aggregate customers table:
   - COUNT(*) for totals
   - COUNT(*) WHERE is_active = true for active
   - COUNT(*) GROUP BY type for type breakdown
3. Join counts for related tables (emails, phones, addresses)
4. Aggregate customer_sales for revenue
5. Filter by period if specified
6. Return statistics object

---

## Error Handling

### Standard Error Response Format

All errors follow consistent structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "additional context",
      "...": "..."
    }
  }
}
```

### Error Codes Reference

| Code | HTTP Status | Description | Recovery Action |
|------|-------------|-------------|-----------------|
| `INVALID_PARAMETER` | 400 | Query parameter invalid/missing | Check parameter name and format |
| `INVALID_UUID` | 400 | ID parameter is not valid UUID | Validate UUID format |
| `VALIDATION_ERROR` | 400 | Request body validation failed | Fix validation errors in details |
| `BUSINESS_NAME_REQUIRED` | 400 | Business name is empty | Provide non-empty business_name |
| `INVALID_EMAIL_FORMAT` | 400 | Email format is invalid | Validate email format |
| `INVALID_PHONE_FORMAT` | 400 | Phone format is invalid | Validate phone format |
| `MULTIPLE_PRIMARY_EMAILS` | 400 | More than one email marked primary | Set only one email as primary |
| `MULTIPLE_PRIMARY_PHONES` | 400 | More than one phone marked primary | Set only one phone as primary |
| `ADDRESS_CITY_REQUIRED` | 400 | City missing when creating address | Provide city for address |
| `ADDRESS_STATE_REQUIRED` | 400 | State missing when creating address | Provide state for address |
| `INVALID_CUSTOMER_TYPE` | 400 | Type is not valid enum value | Use valid customertype enum |
| `INVALID_SEARCH_QUERY` | 400 | Search query too short | Provide query with min 2 chars |
| `UNAUTHORIZED` | 403 | User lacks permission | Check user role and permissions |
| `FORBIDDEN` | 403 | Operation not allowed | Contact administrator |
| `CUSTOMER_NOT_FOUND` | 404 | Customer ID not found | Verify customer exists |
| `DUPLICATE_EMAIL` | 409 | Email already registered | Use different email or update existing customer |
| `DUPLICATE_PHONE` | 409 | Phone already registered | Use different phone or update existing customer |
| `DUPLICATE_CUSTOMER` | 409 | Business name already exists | Use different name or update existing |
| `UPDATE_CONFLICT` | 409 | Concurrent modification detected | Refresh data and retry |
| `DELETE_CONFLICT` | 409 | Cannot delete due to dependencies | Resolve dependencies or use force=true |
| `PRECONDITION_FAILED` | 412 | If-Unmodified-Since check failed | Refresh data and retry |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Wait and retry after rate limit reset |
| `INTERNAL_ERROR` | 500 | Server-side error | Retry, contact support if persists |
| `DATABASE_ERROR` | 500 | Database operation failed | Retry, contact support if persists |

### Rate Limiting

**Limits per User**:
- List operations: 100 requests/minute
- Search operations: 50 requests/minute
- Create operations: 20 requests/minute
- Update operations: 50 requests/minute
- Delete operations: 10 requests/minute

**Response Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1704900000
```

**Rate Limit Error (429)**:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 30 seconds.",
    "details": {
      "retry_after": 30,
      "limit": 100,
      "period": "1 minute"
    }
  }
}
```

---

## Edge Cases

### 1. Duplicate Email/Phone Handling

**Scenario**: User attempts to create customer with email that exists in another customer

**Current Behavior** (FileMaker):
- FileMaker allows duplicate emails (no unique constraint)
- Supabase enforces unique constraint on customer_email.email

**Target Behavior**:
- Return 409 Conflict with existing customer ID
- Frontend can prompt: "Email already exists. Did you mean to update Customer XYZ?"
- Option to link email to multiple customers (requires schema change)

**Schema Consideration**:
- Change unique constraint from `email` to `(customer_id, email)`
- Allows same email for multiple customers (e.g., shared family email)
- Frontend must handle multiple results when searching by email

---

### 2. Concurrent Updates (Optimistic Locking)

**Scenario**: Two users edit same customer simultaneously

**Problem**:
- User A fetches customer at 10:00am (updated_at: 9:00am)
- User B fetches customer at 10:01am (updated_at: 9:00am)
- User A saves changes at 10:05am (updated_at → 10:05am)
- User B saves changes at 10:06am (overwrites User A's changes)

**Solution**: Use If-Unmodified-Since header

**Request with Optimistic Locking**:
```http
PATCH /api/customers/:id
If-Unmodified-Since: Fri, 10 Jan 2026 09:00:00 GMT
Content-Type: application/json
Authorization: Bearer {hmac_signature}.{timestamp}

{"business_name": "Updated Name"}
```

**Backend Logic**:
```javascript
if (request.headers['if-unmodified-since']) {
  const ifUnmodifiedSince = new Date(request.headers['if-unmodified-since']);
  const lastModified = customer.updated_at;

  if (lastModified > ifUnmodifiedSince) {
    return {
      success: false,
      error: {
        code: 'PRECONDITION_FAILED',
        message: 'Resource modified since fetch',
        details: {
          if_unmodified_since: ifUnmodifiedSince,
          last_modified: lastModified
        }
      }
    };
  }
}
```

**Frontend Handling**:
```javascript
try {
  await updateCustomer(id, data, {
    ifUnmodifiedSince: customer.updated_at
  });
} catch (error) {
  if (error.code === 'PRECONDITION_FAILED') {
    // Fetch latest data
    const latestCustomer = await fetchCustomerById(id);
    // Show merge dialog
    showMergeDialog(localChanges, latestCustomer);
  }
}
```

---

### 3. Partial Update Failures

**Scenario**: Update customer succeeds, but related table update fails

**Problem**:
- Customer name updated successfully
- Email update fails (duplicate email constraint)
- Database in inconsistent state

**Solution**: Use database transactions

**Backend Implementation**:
```javascript
await db.transaction(async (trx) => {
  // Update customer
  await trx('customers')
    .where({ id: customerId, organization_id: orgId })
    .update({ business_name, updated_at: now() });

  // Update emails
  for (const email of emails) {
    if (email.id) {
      await trx('customer_email')
        .where({ id: email.id, customer_id: customerId })
        .update({ email: email.email });
    } else {
      await trx('customer_email')
        .insert({ customer_id: customerId, email: email.email, is_primary: email.is_primary });
    }
  }

  // If any operation fails, entire transaction rolls back
});
```

---

### 4. Address Validation Edge Cases

**Scenario**: FileMaker has partial addresses (City without State, or vice versa)

**Problem**:
- Supabase customer_address requires both city AND state (NOT NULL)
- FileMaker may have customers with only City or only State

**Detection Query** (FileMaker):
```sql
SELECT __ID, Name, City, State
FROM devCustomers
WHERE (City IS NOT NULL AND State IS NULL)
   OR (City IS NULL AND State IS NOT NULL);
```

**Resolution Strategies**:

1. **Skip Address Creation** (recommended):
   - If City or State is missing, don't create customer_address record
   - Customer has no address in Supabase
   - Frontend shows "No address on file"

2. **Use Placeholder Values**:
   - If City is missing → Use "Unknown"
   - If State is missing → Use "N/A"
   - Preserves partial data but introduces dirty data

3. **Schema Change**:
   - Make City and State nullable in Supabase
   - Requires backend change request

**Backend Implementation** (Strategy 1):
```javascript
// Only create address if both city AND state are provided
if (addressData.city && addressData.state) {
  await trx('customer_address').insert({
    customer_id: customerId,
    address_line1: addressData.address_line1,
    city: addressData.city,
    state: addressData.state,
    postal_code: addressData.postal_code,
    country: addressData.country
  });
}
```

---

### 5. Organization Assignment for Migrated Customers

**Scenario**: FileMaker customers have no organization_id

**Problem**:
- Supabase customers.organization_id is nullable
- RLS policies require organization_id for data isolation
- Migrated customers with NULL organization_id are invisible

**Resolution Strategies**:

1. **Default Organization**:
   - Create "Legacy FileMaker Customers" organization
   - Assign all migrated customers to this organization
   - Users can reassign later

2. **User-Based Assignment**:
   - Assign to organization of user performing migration
   - Assumes single organization per FileMaker instance

3. **Mapping Table**:
   - Create `filemaker_customer_org_mapping` table
   - Map FileMaker customers to Supabase organizations based on external criteria

**Recommended Approach**: Strategy #1 (Default Organization)

**Migration Script**:
```javascript
// Create default organization
const defaultOrg = await db('organizations').insert({
  id: uuid(),
  name: 'Legacy FileMaker Customers',
  created_at: now()
}).returning('id');

// Assign all migrated customers to default org
await db('customers')
  .whereNull('organization_id')
  .update({ organization_id: defaultOrg.id });
```

---

### 6. FileMaker ID Reconciliation

**Scenario**: FileMaker uses two IDs (__ID and recordId), Supabase uses one (id)

**Problem**:
- FileMaker __ID (UUID) → Supabase customers.id
- FileMaker recordId (internal) → No Supabase equivalent
- Frontend code inconsistently uses __ID vs recordId

**Current Usage**:
- `fetchCustomerById(customerId)` expects __ID
- `updateCustomer(customerId, data)` expects recordId
- `deleteCustomer(customerId)` expects recordId

**Resolution**:
- Supabase API uses only UUID (customers.id)
- Update frontend to use consistent ID (always UUID)
- Remove recordId references from frontend code

**Migration Mapping** (optional):
```sql
CREATE TABLE filemaker_id_mapping (
  supabase_customer_id UUID PRIMARY KEY REFERENCES customers(id),
  filemaker_uuid TEXT NOT NULL,      -- FileMaker __ID
  filemaker_record_id TEXT NOT NULL, -- FileMaker recordId
  migrated_at TIMESTAMPTZ DEFAULT now()
);
```

**Frontend Refactor**:
```javascript
// Before (inconsistent)
fetchCustomerById(customer.__ID);
updateCustomer(customer.recordId, data);

// After (consistent)
fetchCustomerById(customer.id);
updateCustomer(customer.id, data);
```

---

## Migration-Specific Endpoints

### 10. Validate Customer Data

**Endpoint**: `POST /api/customers/validate`

**Purpose**: Validate customer data without creating record (dry-run for migration)

**Request Body**:
```json
{
  "customers": [
    {
      "id": "filemaker-uuid-1",
      "business_name": "Customer 1",
      "emails": [{"email": "customer1@example.com"}],
      "phones": [{"phone": "+14035551234"}]
    }
  ]
}
```

**Response Success (200 OK)**:
```json
{
  "success": true,
  "data": {
    "valid_customers": 48,
    "invalid_customers": 2,
    "errors": [
      {
        "index": 10,
        "id": "filemaker-uuid-10",
        "errors": {
          "business_name": ["Business name is required"],
          "emails[0].email": ["Invalid email format"]
        }
      }
    ],
    "warnings": [
      {
        "index": 25,
        "id": "filemaker-uuid-25",
        "warnings": {
          "addresses[0]": ["Missing city and state - address will be skipped"]
        }
      }
    ]
  }
}
```

**Use Case**:
```javascript
// Pre-migration validation
const fileMakerCustomers = await fetchAllFromFileMaker();
const validation = await api.post('/api/customers/validate', {
  customers: fileMakerCustomers
});

if (validation.data.invalid_customers > 0) {
  console.error('Validation failed:', validation.data.errors);
  // Fix errors in FileMaker before proceeding
} else {
  // Proceed with migration
  await api.post('/api/customers/batch', { customers: fileMakerCustomers });
}
```

---

### 11. Migration Status Tracking

**Endpoint**: `GET /api/customers/migration/status`

**Purpose**: Track progress of ongoing batch migration

**Response Success (200 OK)**:
```json
{
  "success": true,
  "data": {
    "migration_id": "migration-uuid-123",
    "status": "in_progress",
    "started_at": "2026-01-10T10:00:00.000Z",
    "estimated_completion": "2026-01-10T10:15:00.000Z",
    "progress": {
      "total_customers": 500,
      "processed": 350,
      "created": 340,
      "skipped": 5,
      "failed": 5,
      "percentage": 70
    },
    "current_batch": 7,
    "total_batches": 10
  }
}
```

---

## Frontend Integration Guide

### Example: Refactor fetchCustomers()

**Before (FileMaker)**:
```javascript
// src/api/customers.js
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
// src/api/customers.js
import { backendAPI } from './backendAPI';

export async function fetchCustomers(options = {}) {
  const response = await backendAPI.get('/api/customers', {
    params: {
      active: options.activeOnly ?? null,
      search: options.search ?? null,
      limit: options.limit ?? 50,
      offset: options.offset ?? 0,
      sort: options.sort ?? 'business_name',
      order: options.order ?? 'asc',
      include_related: options.includeRelated ?? true,
      include_stats: options.includeStats ?? false
    }
  });

  if (!response.success) {
    throw new Error(response.error.message);
  }

  return response.data;
}
```

### Example: Refactor createCustomer()

**Before (FileMaker Only)**:
```javascript
export async function createCustomer(data) {
  const formattedData = formatCustomerForFileMaker(data);
  return handleFileMakerOperation(async () => {
    return await fetchDataFromFileMaker({
      layout: Layouts.CUSTOMERS,
      action: Actions.CREATE,
      fieldData: formattedData
    });
  });
}
```

**After (Backend API with Dual-Write Removal)**:
```javascript
export async function createCustomer(customerData) {
  const response = await backendAPI.post('/api/customers', {
    business_name: customerData.name,
    primary_contact_name: customerData.contactPerson,
    is_active: customerData.isActive ?? true,
    emails: customerData.email ? [{ email: customerData.email, is_primary: true }] : [],
    phones: customerData.phone ? [{ phone: customerData.phone, is_primary: true }] : [],
    addresses: customerData.city && customerData.state ? [{
      address_line1: customerData.address,
      city: customerData.city,
      state: customerData.state,
      postal_code: customerData.postalCode,
      country: customerData.country
    }] : [],
    financial_data: {
      charge_rate: customerData.chargeRate,
      currencies: {
        usd: customerData.f_USD,
        eur: customerData.f_EUR
      },
      prepay_amount: customerData.f_prePay,
      funds_available: customerData.fundsAvailable
    },
    database_credentials: customerData.dbPath ? {
      path: customerData.dbPath,
      username: customerData.dbUserName,
      password_encrypted: await encryptPassword(customerData.dbPasword) // Note: typo in FileMaker field name
    } : null,
    obsi_client_no: customerData.OBSI_ClientNo,
    contact_person_name: customerData.ContactPerson
  });

  if (!response.success) {
    throw new Error(response.error.message);
  }

  return response.data;
}
```

### Example: Error Handling

```javascript
// src/hooks/useCustomer.js
const handleCustomerCreate = async (customerData) => {
  setLoading(true);
  setError(null);

  try {
    const newCustomer = await createCustomer(customerData);
    setCustomers(prev => [...prev, newCustomer]);
    showSnackbar('Customer created successfully', 'success');
    return newCustomer;
  } catch (error) {
    // Handle specific error codes
    if (error.code === 'DUPLICATE_EMAIL') {
      setError({
        message: `Email ${error.details.email} is already registered`,
        action: {
          label: 'View Existing Customer',
          onClick: () => handleCustomerSelect(error.details.existing_customer_id)
        }
      });
    } else if (error.code === 'VALIDATION_ERROR') {
      setError({
        message: 'Please correct the following errors:',
        details: error.details
      });
    } else {
      setError({
        message: error.message || 'Failed to create customer'
      });
    }

    showSnackbar('Failed to create customer', 'error');
    throw error;
  } finally {
    setLoading(false);
  }
};
```

---

## Implementation Priorities

### Phase 1: MVP (Core CRUD)

1. ✅ List Customers (GET /api/customers)
2. ✅ Get Customer by ID (GET /api/customers/:id)
3. ✅ Create Customer (POST /api/customers)
4. ✅ Update Customer (PATCH /api/customers/:id)
5. ✅ Toggle Status (PATCH /api/customers/:id/status)

**Target Completion**: Week 1-2

### Phase 2: Enhanced Operations

6. ✅ Delete Customer (DELETE /api/customers/:id) - soft delete only
7. ✅ Search Customers (GET /api/customers/search)
8. ✅ Get Statistics (GET /api/customers/stats)

**Target Completion**: Week 3-4

### Phase 3: Migration Support

9. ✅ Batch Create (POST /api/customers/batch)
10. ✅ Validate Data (POST /api/customers/validate)
11. ✅ Migration Status (GET /api/customers/migration/status)

**Target Completion**: Week 5-6

### Phase 4: Advanced Features (Future)

12. Webhooks (customer.created, customer.updated, customer.deleted)
13. Advanced filtering/aggregations
14. Customer activity logs
15. Restore deleted customers (POST /api/customers/:id/restore)
16. Export customers (GET /api/customers/export?format=csv|json)

---

## Testing Requirements

### Unit Tests

Each endpoint must have unit tests covering:
- ✅ Success scenarios (200, 201, 204)
- ✅ Validation errors (400)
- ✅ Authentication errors (401, 403)
- ✅ Not found errors (404)
- ✅ Conflict errors (409)
- ✅ Rate limiting (429)
- ✅ Server errors (500)

### Integration Tests

- ✅ End-to-end customer lifecycle (create → update → toggle → delete)
- ✅ Concurrent update handling (optimistic locking)
- ✅ Batch operations (create 100 customers)
- ✅ Transaction rollback scenarios
- ✅ RLS policy enforcement (cross-organization access attempts)
- ✅ Pagination edge cases (large datasets)

### Performance Tests

- ✅ List customers with 10,000+ records (< 500ms)
- ✅ Search customers with fuzzy matching (< 200ms)
- ✅ Batch create 200 customers (< 5 seconds)
- ✅ Concurrent updates from 10 users (no lost updates)

---

## Security Checklist

- ✅ HMAC authentication on all endpoints
- ✅ Organization scoping via RLS policies
- ✅ Input validation and sanitization
- ✅ SQL injection prevention (parameterized queries)
- ✅ Rate limiting per user
- ✅ CORS configuration
- ✅ Sensitive data encryption (database_credentials)
- ✅ Audit logging (who changed what, when)
- ✅ No PII in error messages
- ✅ HTTPS only (no HTTP)

---

## Document Status

**Status**: Requirements Complete - Ready for Backend Implementation
**Next Steps**:
1. Backend team reviews API contracts
2. Create OpenAPI/Swagger specification from these contracts
3. Implement endpoints in backend API
4. Create Supabase RPC functions (if RPC approach chosen)
5. Write integration tests
6. Update frontend to use new endpoints
7. Run migration scripts on staging environment
8. Validate data integrity post-migration

**Related Documents**:
- [Data Model Mapping](./data-model-mapping.md) - Field mappings and transformations
- [Supabase Schema](./supabase-schema.md) - Database structure and constraints
- [Current Implementation](../../requirements/customers/current-implementation.md) - FileMaker integration details

---

**Document Version**: 1.0
**Last Updated**: 2026-01-10
**Author**: Claude Code (Autonomous Agent)
**Approved By**: Pending Backend Team Review
