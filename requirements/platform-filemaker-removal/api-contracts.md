# Backend API Endpoint Contracts

**Generated:** 2026-01-10
**Purpose:** Specify all required backend endpoints with request/response examples for FileMaker removal
**Status:** Requirements Definition (Phase 1)

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Response Format Standards](#response-format-standards)
4. [Customer Endpoints](#customer-endpoints)
5. [Project Endpoints](#project-endpoints)
6. [Task Endpoints](#task-endpoints)
7. [Time Entry Endpoints](#time-entry-endpoints)
8. [Team Endpoints](#team-endpoints)
9. [Note Endpoints](#note-endpoints)
10. [Link Endpoints](#link-endpoints)
11. [Project Related Endpoints](#project-related-endpoints)
12. [Special Operations](#special-operations)
13. [Error Handling](#error-handling)

---

## Overview

This document defines the exact API contracts for all backend endpoints that will replace FileMaker operations. Each endpoint includes:

- HTTP method and URL pattern
- Request headers
- Request body schema with examples
- Response body schema with examples
- Status codes and error responses
- Query parameters
- Edge cases and validation rules

**Base URL:** `https://api.claritybusinesssolutions.ca`

**API Version:** Current (no versioning in URLs yet)

**Design Principle:** Maintain FileMaker-compatible response format initially for easier frontend migration, then transition to REST standards in Phase 3.

---

## Authentication

All API requests require HMAC-SHA256 authentication.

### HMAC Authentication Header

**Header Name:** `Authorization`

**Format:** `Bearer {signature}.{timestamp}`

**Generation Algorithm:**
```javascript
// Frontend implementation (src/services/dataService.js:383-453)
const timestamp = Math.floor(Date.now() / 1000);
const payload = JSON.stringify(requestBody) || '';
const message = `${timestamp}.${payload}`;

// HMAC-SHA256 signature
const encoder = new TextEncoder();
const keyData = encoder.encode(VITE_SECRET_KEY);
const messageData = encoder.encode(message);

const cryptoKey = await crypto.subtle.importKey(
  'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
);

const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
const signatureArray = new Uint8Array(signature);
const signatureHex = Array.from(signatureArray)
  .map(b => b.toString(16).padStart(2, '0'))
  .join('');

return `Bearer ${signatureHex}.${timestamp}`;
```

**Example Header:**
```
Authorization: Bearer a3f8c9d2e1b4f7a6c5d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0.1704902400
```

**Validation Window:** ±5 minutes from timestamp

**Secret Key:** Shared between frontend and backend (stored in `VITE_SECRET_KEY` environment variable)

---

## Response Format Standards

### FileMaker-Compatible Format (Phase 2)

To minimize frontend changes, backend should initially wrap responses in FileMaker-compatible format:

**Successful Response:**
```json
{
  "response": {
    "recordId": "uuid-of-record",
    "data": {
      "__ID": "uuid-of-record",
      "field1": "value1",
      "field2": "value2"
    },
    "dataInfo": {
      "count": 1,
      "totalCount": 1
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**List Response:**
```json
{
  "response": {
    "data": [
      {
        "__ID": "uuid-1",
        "field1": "value1"
      },
      {
        "__ID": "uuid-2",
        "field1": "value2"
      }
    ],
    "dataInfo": {
      "count": 2,
      "totalCount": 100,
      "foundCount": 2
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Error Response:**
```json
{
  "messages": [
    {
      "code": "401",
      "message": "No records match the request"
    }
  ],
  "response": {}
}
```

### Standard REST Format (Phase 3 Target)

Future format after frontend migration:

**Single Resource:**
```json
{
  "id": "uuid",
  "field1": "value1",
  "field2": "value2",
  "created_at": "2026-01-10T12:00:00Z",
  "updated_at": "2026-01-10T12:00:00Z"
}
```

**Collection:**
```json
{
  "data": [...],
  "meta": {
    "count": 2,
    "total": 100,
    "limit": 50,
    "offset": 0
  }
}
```

---

## Customer Endpoints

### List All Customers

**Endpoint:** `GET /filemaker/devCustomers/records`

**Auth Required:** Yes (HMAC)

**Query Parameters:**
- `limit` (optional, integer, default: 50) - Maximum records to return
- `offset` (optional, integer, default: 0) - Number of records to skip
- `sort` (optional, string) - Field name to sort by (prefix with `-` for descending)
- `query` (optional, JSON string) - FileMaker-style query filter

**Request Example:**
```bash
GET /filemaker/devCustomers/records?limit=50&offset=0&sort=-created_at
Authorization: Bearer {signature}.{timestamp}
```

**Query Filter Example:**
```bash
# Get all active customers
GET /filemaker/devCustomers/records?query=[{"f_active":"1"}]

# Get all customers (FileMaker wildcard)
GET /filemaker/devCustomers/records?query=[{"__ID":"*"}]
```

**Response (200 OK):**
```json
{
  "response": {
    "data": [
      {
        "__ID": "550e8400-e29b-41d4-a716-446655440000",
        "recordId": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Acme Corporation",
        "email": "contact@acme.com",
        "phone": "555-0123",
        "address": "123 Main St",
        "city": "Toronto",
        "province": "ON",
        "postalCode": "M5V 3A8",
        "f_active": true,
        "customerType": "Corporate",
        "industry": "Technology",
        "created_at": "2025-01-01T10:00:00Z",
        "updated_at": "2026-01-10T12:00:00Z"
      },
      {
        "__ID": "661e9511-f3ac-52e5-b827-557766551111",
        "recordId": "661e9511-f3ac-52e5-b827-557766551111",
        "name": "TechStart Inc",
        "email": "info@techstart.com",
        "phone": "555-0456",
        "f_active": true,
        "created_at": "2025-02-15T14:30:00Z",
        "updated_at": "2026-01-09T09:15:00Z"
      }
    ],
    "dataInfo": {
      "count": 2,
      "totalCount": 47,
      "foundCount": 2
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation Notes:**
```sql
-- Supabase query
SELECT * FROM customers
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 50 OFFSET 0;

-- With active filter
SELECT * FROM customers
WHERE deleted_at IS NULL
  AND f_active = true
ORDER BY created_at DESC
LIMIT 50 OFFSET 0;
```

**Reference:** `src/api/customers.js:8-23`

---

### Get Customer by ID

**Endpoint:** `GET /filemaker/devCustomers/records/{customer_id}`

**Auth Required:** Yes (HMAC)

**Path Parameters:**
- `customer_id` (required, UUID) - Customer ID or recordId

**Request Example:**
```bash
GET /filemaker/devCustomers/records/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {signature}.{timestamp}
```

**Alternative Query Format (legacy):**
```bash
GET /filemaker/devCustomers/records?query=[{"__ID":"550e8400-e29b-41d4-a716-446655440000"}]
```

**Response (200 OK):**
```json
{
  "response": {
    "recordId": "550e8400-e29b-41d4-a716-446655440000",
    "data": {
      "__ID": "550e8400-e29b-41d4-a716-446655440000",
      "recordId": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Acme Corporation",
      "email": "contact@acme.com",
      "phone": "555-0123",
      "address": "123 Main St",
      "city": "Toronto",
      "province": "ON",
      "postalCode": "M5V 3A8",
      "country": "Canada",
      "f_active": true,
      "customerType": "Corporate",
      "industry": "Technology",
      "website": "https://acme.com",
      "notes": "Key enterprise customer",
      "created_at": "2025-01-01T10:00:00Z",
      "updated_at": "2026-01-10T12:00:00Z"
    },
    "dataInfo": {
      "count": 1,
      "totalCount": 1
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Error Response (404 Not Found):**
```json
{
  "messages": [
    {
      "code": "401",
      "message": "No records match the request"
    }
  ],
  "response": {}
}
```

**Backend Implementation:**
```sql
SELECT * FROM customers
WHERE (id = $1 OR __ID = $1 OR recordId = $1)
  AND deleted_at IS NULL
LIMIT 1;
```

**Reference:** `src/api/customers.js:25-40`

---

### Create Customer

**Endpoint:** `POST /filemaker/devCustomers/records`

**Auth Required:** Yes (HMAC)

**Content-Type:** `application/json`

**Request Body Schema:**
```json
{
  "fields": {
    "name": "string (required, max 255)",
    "email": "string (optional, valid email)",
    "phone": "string (optional)",
    "address": "string (optional)",
    "city": "string (optional)",
    "province": "string (optional)",
    "postalCode": "string (optional)",
    "country": "string (optional, default: 'Canada')",
    "f_active": "boolean (optional, default: true)",
    "customerType": "string (optional)",
    "industry": "string (optional)",
    "website": "string (optional, valid URL)",
    "notes": "string (optional)"
  }
}
```

**Request Example:**
```bash
POST /filemaker/devCustomers/records
Authorization: Bearer {signature}.{timestamp}
Content-Type: application/json

{
  "fields": {
    "name": "New Customer Inc",
    "email": "contact@newcustomer.com",
    "phone": "555-9876",
    "address": "456 King St W",
    "city": "Toronto",
    "province": "ON",
    "postalCode": "M5H 1A1",
    "f_active": true,
    "customerType": "Small Business",
    "industry": "Retail"
  }
}
```

**Response (201 Created):**
```json
{
  "response": {
    "recordId": "772f0622-g4bd-63f6-c938-668877662222",
    "data": {
      "__ID": "772f0622-g4bd-63f6-c938-668877662222",
      "recordId": "772f0622-g4bd-63f6-c938-668877662222",
      "name": "New Customer Inc",
      "email": "contact@newcustomer.com",
      "phone": "555-9876",
      "address": "456 King St W",
      "city": "Toronto",
      "province": "ON",
      "postalCode": "M5H 1A1",
      "country": "Canada",
      "f_active": true,
      "customerType": "Small Business",
      "industry": "Retail",
      "created_at": "2026-01-10T15:30:00Z",
      "updated_at": "2026-01-10T15:30:00Z"
    },
    "dataInfo": {
      "count": 1
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Validation Errors (400 Bad Request):**
```json
{
  "messages": [
    {
      "code": "500",
      "message": "Validation failed: name is required"
    }
  ],
  "response": {}
}
```

**Backend Implementation:**
```sql
INSERT INTO customers (
  id, __ID, recordId, name, email, phone,
  address, city, province, postalCode, country,
  f_active, customerType, industry,
  created_at, updated_at
) VALUES (
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  $1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'Canada'),
  COALESCE($9, true), $10, $11,
  NOW(), NOW()
)
RETURNING *;
```

**Validation Rules:**
- `name`: Required, non-empty, max 255 characters
- `email`: Optional, must be valid email format if provided
- `phone`: Optional, sanitize special characters
- `postalCode`: Optional, validate format for country
- `website`: Optional, must be valid URL if provided

**Reference:** `src/api/customers.js:42-58`

---

### Update Customer

**Endpoint:** `PATCH /filemaker/devCustomers/records/{record_id}`

**Auth Required:** Yes (HMAC)

**Path Parameters:**
- `record_id` (required, UUID) - Customer record ID

**Content-Type:** `application/json`

**Request Body Schema:**
```json
{
  "fields": {
    "name": "string (optional)",
    "email": "string (optional)",
    "phone": "string (optional)",
    "address": "string (optional)",
    "city": "string (optional)",
    "province": "string (optional)",
    "postalCode": "string (optional)",
    "country": "string (optional)",
    "f_active": "boolean (optional)",
    "customerType": "string (optional)",
    "industry": "string (optional)",
    "website": "string (optional)",
    "notes": "string (optional)"
  }
}
```

**Request Example:**
```bash
PATCH /filemaker/devCustomers/records/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {signature}.{timestamp}
Content-Type: application/json

{
  "fields": {
    "email": "newemail@acme.com",
    "phone": "555-1111",
    "notes": "Updated contact information"
  }
}
```

**Response (200 OK):**
```json
{
  "response": {
    "recordId": "550e8400-e29b-41d4-a716-446655440000",
    "data": {
      "__ID": "550e8400-e29b-41d4-a716-446655440000",
      "recordId": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Acme Corporation",
      "email": "newemail@acme.com",
      "phone": "555-1111",
      "notes": "Updated contact information",
      "updated_at": "2026-01-10T16:45:00Z"
    },
    "dataInfo": {
      "count": 1
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation:**
```sql
UPDATE customers
SET
  email = COALESCE($2, email),
  phone = COALESCE($3, phone),
  notes = COALESCE($4, notes),
  updated_at = NOW()
WHERE recordId = $1
  AND deleted_at IS NULL
RETURNING *;
```

**Reference:** `src/api/customers.js:60-76`

---

### Toggle Customer Status

**Endpoint:** `PATCH /filemaker/devCustomers/records/{record_id}`

**Auth Required:** Yes (HMAC)

**Request Example:**
```bash
PATCH /filemaker/devCustomers/records/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {signature}.{timestamp}
Content-Type: application/json

{
  "fields": {
    "f_active": false
  }
}
```

**Response (200 OK):**
```json
{
  "response": {
    "recordId": "550e8400-e29b-41d4-a716-446655440000",
    "data": {
      "__ID": "550e8400-e29b-41d4-a716-446655440000",
      "f_active": false,
      "updated_at": "2026-01-10T17:00:00Z"
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation:**
```sql
UPDATE customers
SET f_active = $2, updated_at = NOW()
WHERE recordId = $1
RETURNING *;
```

**Reference:** `src/api/customers.js:78-90`

---

### Delete Customer (Soft Delete)

**Endpoint:** `DELETE /filemaker/devCustomers/records/{record_id}`

**Auth Required:** Yes (HMAC)

**Request Example:**
```bash
DELETE /filemaker/devCustomers/records/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {signature}.{timestamp}
```

**Response (200 OK):**
```json
{
  "response": {},
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation:**
```sql
-- Soft delete (preferred)
UPDATE customers
SET deleted_at = NOW()
WHERE recordId = $1
RETURNING recordId;

-- Hard delete (alternative)
DELETE FROM customers
WHERE recordId = $1
RETURNING recordId;
```

**Business Rule:** Prefer soft delete to maintain referential integrity with projects, tasks, and time entries.

**Reference:** `src/api/customers.js:92-104`

---

## Project Endpoints

### List Projects for Customer

**Endpoint:** `GET /filemaker/devProjects/records`

**Auth Required:** Yes (HMAC)

**Query Parameters:**
- `query` (required, JSON string) - FileMaker-style query filter

**Request Example:**
```bash
# Single customer
GET /filemaker/devProjects/records?query=[{"_custID":"550e8400-e29b-41d4-a716-446655440000"}]
Authorization: Bearer {signature}.{timestamp}

# Multiple customers (OR query)
GET /filemaker/devProjects/records?query=[{"_custID":"550e8400-e29b-41d4-a716-446655440000"},{"_custID":"661e9511-f3ac-52e5-b827-557766551111"}]
```

**Response (200 OK):**
```json
{
  "response": {
    "data": [
      {
        "__ID": "883g1733-h5ce-74g7-d049-779988773333",
        "recordId": "883g1733-h5ce-74g7-d049-779988773333",
        "name": "Website Redesign",
        "_custID": "550e8400-e29b-41d4-a716-446655440000",
        "customer_id": "550e8400-e29b-41d4-a716-446655440000",
        "status": "In Progress",
        "startDate": "2026-01-01",
        "endDate": "2026-03-31",
        "_teamID": "994h2844-i6df-85h8-e15a-88aa99884444",
        "team_id": "994h2844-i6df-85h8-e15a-88aa99884444",
        "budget": 50000.00,
        "description": "Complete website overhaul with new design system",
        "created_at": "2025-12-15T10:00:00Z",
        "updated_at": "2026-01-10T14:00:00Z"
      },
      {
        "__ID": "aa5i3955-j7eg-96i9-f26b-99bbaa995555",
        "name": "Mobile App Development",
        "_custID": "550e8400-e29b-41d4-a716-446655440000",
        "status": "Planning",
        "created_at": "2026-01-05T11:30:00Z"
      }
    ],
    "dataInfo": {
      "count": 2,
      "totalCount": 2
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation:**
```sql
-- Single customer
SELECT * FROM projects
WHERE customer_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC;

-- Multiple customers (OR)
SELECT * FROM projects
WHERE customer_id IN ($1, $2, ...)
  AND deleted_at IS NULL
ORDER BY created_at DESC;
```

**Reference:** `src/api/projects.js:9-27`

---

### Get Project by ID

**Endpoint:** `GET /filemaker/devProjects/records/{project_id}`

**Auth Required:** Yes (HMAC)

**Request Example:**
```bash
GET /filemaker/devProjects/records/883g1733-h5ce-74g7-d049-779988773333
Authorization: Bearer {signature}.{timestamp}
```

**Alternative Query Format:**
```bash
GET /filemaker/devProjects/records?query=[{"__ID":"883g1733-h5ce-74g7-d049-779988773333"}]
```

**Response (200 OK):**
```json
{
  "response": {
    "recordId": "883g1733-h5ce-74g7-d049-779988773333",
    "data": {
      "__ID": "883g1733-h5ce-74g7-d049-779988773333",
      "recordId": "883g1733-h5ce-74g7-d049-779988773333",
      "name": "Website Redesign",
      "_custID": "550e8400-e29b-41d4-a716-446655440000",
      "customer_id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "In Progress",
      "startDate": "2026-01-01",
      "endDate": "2026-03-31",
      "_teamID": "994h2844-i6df-85h8-e15a-88aa99884444",
      "team_id": "994h2844-i6df-85h8-e15a-88aa99884444",
      "budget": 50000.00,
      "actualCost": 12500.50,
      "description": "Complete website overhaul with new design system",
      "projectType": "Development",
      "priority": "High",
      "completionPercent": 35,
      "created_at": "2025-12-15T10:00:00Z",
      "updated_at": "2026-01-10T14:00:00Z"
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation:**
```sql
SELECT * FROM projects
WHERE (id = $1 OR __ID = $1 OR recordId = $1)
  AND deleted_at IS NULL
LIMIT 1;
```

**Reference:** `src/api/projects.js:29-45`

---

### Create Project

**Endpoint:** `POST /filemaker/devProjects/records`

**Auth Required:** Yes (HMAC)

**Request Body Schema:**
```json
{
  "fields": {
    "name": "string (required, max 255)",
    "_custID": "UUID (required) - customer ID",
    "status": "string (optional, default: 'Planning')",
    "startDate": "string (optional, ISO date)",
    "endDate": "string (optional, ISO date)",
    "_teamID": "UUID (optional) - team ID",
    "budget": "number (optional)",
    "description": "string (optional)",
    "projectType": "string (optional)",
    "priority": "string (optional)"
  }
}
```

**Request Example:**
```bash
POST /filemaker/devProjects/records
Authorization: Bearer {signature}.{timestamp}
Content-Type: application/json

{
  "fields": {
    "name": "E-commerce Integration",
    "_custID": "550e8400-e29b-41d4-a716-446655440000",
    "status": "Planning",
    "startDate": "2026-02-01",
    "endDate": "2026-05-31",
    "budget": 75000,
    "description": "Integrate Shopify with existing CRM",
    "projectType": "Integration",
    "priority": "Medium"
  }
}
```

**Response (201 Created):**
```json
{
  "response": {
    "recordId": "bb6j4a66-k8fh-a7j0-g37c-aaccbbaa6666",
    "data": {
      "__ID": "bb6j4a66-k8fh-a7j0-g37c-aaccbbaa6666",
      "recordId": "bb6j4a66-k8fh-a7j0-g37c-aaccbbaa6666",
      "name": "E-commerce Integration",
      "_custID": "550e8400-e29b-41d4-a716-446655440000",
      "customer_id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "Planning",
      "startDate": "2026-02-01",
      "endDate": "2026-05-31",
      "budget": 75000.00,
      "description": "Integrate Shopify with existing CRM",
      "projectType": "Integration",
      "priority": "Medium",
      "created_at": "2026-01-10T17:30:00Z",
      "updated_at": "2026-01-10T17:30:00Z"
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation:**
```sql
INSERT INTO projects (
  id, __ID, recordId, name, customer_id, _custID,
  status, startDate, endDate, budget, description,
  projectType, priority, created_at, updated_at
) VALUES (
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  $1, $2, $2, COALESCE($3, 'Planning'), $4, $5, $6, $7,
  $8, $9, NOW(), NOW()
)
RETURNING *;
```

**Validation Rules:**
- `name`: Required, non-empty
- `_custID`: Required, must reference valid customer
- `endDate`: Must be after `startDate` if both provided
- `budget`: Must be non-negative if provided

**Reference:** `src/api/projects.js:87-106`

---

### Update Project

**Endpoint:** `PATCH /filemaker/devProjects/records/{record_id}`

**Auth Required:** Yes (HMAC)

**Request Example:**
```bash
PATCH /filemaker/devProjects/records/883g1733-h5ce-74g7-d049-779988773333
Authorization: Bearer {signature}.{timestamp}
Content-Type: application/json

{
  "fields": {
    "status": "Completed",
    "completionPercent": 100,
    "actualCost": 48500.00
  }
}
```

**Response (200 OK):**
```json
{
  "response": {
    "recordId": "883g1733-h5ce-74g7-d049-779988773333",
    "data": {
      "__ID": "883g1733-h5ce-74g7-d049-779988773333",
      "status": "Completed",
      "completionPercent": 100,
      "actualCost": 48500.00,
      "updated_at": "2026-01-10T18:00:00Z"
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation:**
```sql
UPDATE projects
SET
  status = COALESCE($2, status),
  completionPercent = COALESCE($3, completionPercent),
  actualCost = COALESCE($4, actualCost),
  updated_at = NOW()
WHERE recordId = $1
  AND deleted_at IS NULL
RETURNING *;
```

**Reference:** `src/api/projects.js:108-124`

---

### Delete Project

**Endpoint:** `DELETE /filemaker/devProjects/records/{record_id}`

**Auth Required:** Yes (HMAC)

**Request Example:**
```bash
DELETE /filemaker/devProjects/records/883g1733-h5ce-74g7-d049-779988773333
Authorization: Bearer {signature}.{timestamp}
```

**Response (200 OK):**
```json
{
  "response": {},
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation:**
```sql
-- Soft delete (preferred)
UPDATE projects
SET deleted_at = NOW()
WHERE recordId = $1;

-- Also cascade to related records
UPDATE tasks SET deleted_at = NOW() WHERE project_id = $1;
UPDATE notes SET deleted_at = NOW() WHERE foreign_key_id = $1;
UPDATE links SET deleted_at = NOW() WHERE foreign_key_id = $1;
```

**Reference:** `src/api/projects.js:126-138`

---

## Task Endpoints

### List Tasks for Project

**Endpoint:** `GET /filemaker/devTasks/records`

**Auth Required:** Yes (HMAC)

**Query Parameters:**
- `query` (required, JSON string) - FileMaker-style query filter

**Request Examples:**
```bash
# All tasks for project
GET /filemaker/devTasks/records?query=[{"_projectID":"883g1733-h5ce-74g7-d049-779988773333"}]

# Active tasks only
GET /filemaker/devTasks/records?query=[{"_projectID":"883g1733-h5ce-74g7-d049-779988773333","f_completed":false}]

# Tasks assigned to staff member
GET /filemaker/devTasks/records?query=[{"_staffID":"cc7k5b77-l9gi-b8k1-h48d-bbddccbb7777"}]
```

**Response (200 OK):**
```json
{
  "response": {
    "data": [
      {
        "__ID": "dd8l6c88-m0hj-c9l2-i59e-cceeddcc8888",
        "recordId": "dd8l6c88-m0hj-c9l2-i59e-cceeddcc8888",
        "name": "Design homepage mockups",
        "_projectID": "883g1733-h5ce-74g7-d049-779988773333",
        "project_id": "883g1733-h5ce-74g7-d049-779988773333",
        "_staffID": "cc7k5b77-l9gi-b8k1-h48d-bbddccbb7777",
        "staff_id": "cc7k5b77-l9gi-b8k1-h48d-bbddccbb7777",
        "description": "Create wireframes and high-fidelity mockups for homepage",
        "status": "In Progress",
        "priority": "High",
        "f_completed": false,
        "dueDate": "2026-01-15",
        "estimatedHours": 16,
        "actualHours": 8.5,
        "created_at": "2026-01-02T09:00:00Z",
        "updated_at": "2026-01-10T11:30:00Z"
      },
      {
        "__ID": "ee9m7d99-n1ik-d0m3-j6af-ddffeedd9999",
        "name": "Implement responsive layout",
        "_projectID": "883g1733-h5ce-74g7-d049-779988773333",
        "f_completed": false,
        "priority": "Medium",
        "created_at": "2026-01-05T14:00:00Z"
      }
    ],
    "dataInfo": {
      "count": 2,
      "totalCount": 2
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation:**
```sql
-- Tasks for project
SELECT * FROM tasks
WHERE project_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC;

-- Active tasks only
SELECT * FROM tasks
WHERE project_id = $1
  AND completed = false
  AND deleted_at IS NULL
ORDER BY priority DESC, created_at DESC;

-- Tasks for staff member
SELECT * FROM tasks
WHERE staff_id = $1
  AND deleted_at IS NULL
ORDER BY dueDate ASC NULLS LAST, created_at DESC;
```

**Reference:** `src/api/tasks.js:8-31`

---

### Get Task by ID

**Endpoint:** `GET /filemaker/devTasks/records/{task_id}`

**Auth Required:** Yes (HMAC)

**Request Example:**
```bash
GET /filemaker/devTasks/records/dd8l6c88-m0hj-c9l2-i59e-cceeddcc8888
Authorization: Bearer {signature}.{timestamp}
```

**Response (200 OK):**
```json
{
  "response": {
    "recordId": "dd8l6c88-m0hj-c9l2-i59e-cceeddcc8888",
    "data": {
      "__ID": "dd8l6c88-m0hj-c9l2-i59e-cceeddcc8888",
      "recordId": "dd8l6c88-m0hj-c9l2-i59e-cceeddcc8888",
      "name": "Design homepage mockups",
      "_projectID": "883g1733-h5ce-74g7-d049-779988773333",
      "project_id": "883g1733-h5ce-74g7-d049-779988773333",
      "_staffID": "cc7k5b77-l9gi-b8k1-h48d-bbddccbb7777",
      "staff_id": "cc7k5b77-l9gi-b8k1-h48d-bbddccbb7777",
      "description": "Create wireframes and high-fidelity mockups for homepage",
      "status": "In Progress",
      "priority": "High",
      "f_completed": false,
      "dueDate": "2026-01-15",
      "estimatedHours": 16,
      "actualHours": 8.5,
      "notes": "Using Figma for mockups",
      "created_at": "2026-01-02T09:00:00Z",
      "updated_at": "2026-01-10T11:30:00Z"
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation:**
```sql
SELECT * FROM tasks
WHERE (id = $1 OR __ID = $1 OR recordId = $1)
  AND deleted_at IS NULL
LIMIT 1;
```

**Reference:** `src/api/tasks.js:33-48`

---

### Create Task

**Endpoint:** `POST /filemaker/devTasks/records`

**Auth Required:** Yes (HMAC)

**Request Body Schema:**
```json
{
  "fields": {
    "name": "string (required, max 255)",
    "_projectID": "UUID (required) - project ID",
    "_staffID": "UUID (optional) - assigned staff member",
    "description": "string (optional)",
    "status": "string (optional, default: 'To Do')",
    "priority": "string (optional, default: 'Medium')",
    "dueDate": "string (optional, ISO date)",
    "estimatedHours": "number (optional)",
    "notes": "string (optional)"
  }
}
```

**Request Example:**
```bash
POST /filemaker/devTasks/records
Authorization: Bearer {signature}.{timestamp}
Content-Type: application/json

{
  "fields": {
    "name": "Write unit tests",
    "_projectID": "883g1733-h5ce-74g7-d049-779988773333",
    "_staffID": "cc7k5b77-l9gi-b8k1-h48d-bbddccbb7777",
    "description": "Write comprehensive unit tests for all components",
    "priority": "High",
    "dueDate": "2026-01-20",
    "estimatedHours": 12
  }
}
```

**Response (201 Created):**
```json
{
  "response": {
    "recordId": "ff0n8e00-o2jl-e1n4-k7bg-eeffggee0000",
    "data": {
      "__ID": "ff0n8e00-o2jl-e1n4-k7bg-eeffggee0000",
      "recordId": "ff0n8e00-o2jl-e1n4-k7bg-eeffggee0000",
      "name": "Write unit tests",
      "_projectID": "883g1733-h5ce-74g7-d049-779988773333",
      "project_id": "883g1733-h5ce-74g7-d049-779988773333",
      "_staffID": "cc7k5b77-l9gi-b8k1-h48d-bbddccbb7777",
      "staff_id": "cc7k5b77-l9gi-b8k1-h48d-bbddccbb7777",
      "description": "Write comprehensive unit tests for all components",
      "status": "To Do",
      "priority": "High",
      "f_completed": false,
      "dueDate": "2026-01-20",
      "estimatedHours": 12,
      "created_at": "2026-01-10T19:00:00Z",
      "updated_at": "2026-01-10T19:00:00Z"
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation:**
```sql
INSERT INTO tasks (
  id, __ID, recordId, name, project_id, _projectID,
  staff_id, _staffID, description, status, priority,
  f_completed, dueDate, estimatedHours,
  created_at, updated_at
) VALUES (
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  $1, $2, $2, $3, $3, $4,
  COALESCE($5, 'To Do'), COALESCE($6, 'Medium'),
  false, $7, $8, NOW(), NOW()
)
RETURNING *;
```

**Validation Rules:**
- `name`: Required, non-empty
- `_projectID`: Required, must reference valid project
- `_staffID`: Optional, must reference valid staff if provided
- `estimatedHours`: Must be positive if provided

**Reference:** `src/api/tasks.js:50-71`

---

### Update Task

**Endpoint:** `PATCH /filemaker/devTasks/records/{record_id}`

**Auth Required:** Yes (HMAC)

**Request Example:**
```bash
PATCH /filemaker/devTasks/records/dd8l6c88-m0hj-c9l2-i59e-cceeddcc8888
Authorization: Bearer {signature}.{timestamp}
Content-Type: application/json

{
  "fields": {
    "f_completed": true,
    "status": "Completed",
    "actualHours": 14.5,
    "notes": "Completed ahead of schedule"
  }
}
```

**Response (200 OK):**
```json
{
  "response": {
    "recordId": "dd8l6c88-m0hj-c9l2-i59e-cceeddcc8888",
    "data": {
      "__ID": "dd8l6c88-m0hj-c9l2-i59e-cceeddcc8888",
      "f_completed": true,
      "completed": true,
      "status": "Completed",
      "actualHours": 14.5,
      "notes": "Completed ahead of schedule",
      "updated_at": "2026-01-10T20:00:00Z"
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation:**
```sql
UPDATE tasks
SET
  completed = COALESCE($2, completed),
  f_completed = COALESCE($2, f_completed),
  status = COALESCE($3, status),
  actualHours = COALESCE($4, actualHours),
  notes = COALESCE($5, notes),
  updated_at = NOW()
WHERE recordId = $1
  AND deleted_at IS NULL
RETURNING *;
```

**Reference:** `src/api/tasks.js:73-94`

---

## Time Entry Endpoints

### Create Time Entry (Start Timer)

**Endpoint:** `POST /filemaker/dapiRecords/records`

**Auth Required:** Yes (HMAC)

**Request Body Schema:**
```json
{
  "fields": {
    "_taskID": "UUID (required) - task ID",
    "_projectID": "UUID (required) - project ID",
    "_custID": "UUID (required) - customer ID",
    "_staffID": "UUID (required) - staff member ID",
    "TimeStart": "string (required, HH:MM:SS format)",
    "DateStart": "string (required, MM/DD/YYYY format)"
  }
}
```

**Request Example:**
```bash
POST /filemaker/dapiRecords/records
Authorization: Bearer {signature}.{timestamp}
Content-Type: application/json

{
  "fields": {
    "_taskID": "dd8l6c88-m0hj-c9l2-i59e-cceeddcc8888",
    "_projectID": "883g1733-h5ce-74g7-d049-779988773333",
    "_custID": "550e8400-e29b-41d4-a716-446655440000",
    "_staffID": "cc7k5b77-l9gi-b8k1-h48d-bbddccbb7777",
    "TimeStart": "09:30:00",
    "DateStart": "01/10/2026"
  }
}
```

**Response (201 Created):**
```json
{
  "response": {
    "recordId": "gg1o9f11-p3km-f2o5-l8ch-ffgghh ff1111",
    "data": {
      "__ID": "gg1o9f11-p3km-f2o5-l8ch-ffgghhff1111",
      "recordId": "gg1o9f11-p3km-f2o5-l8ch-ffgghhff1111",
      "~recordId": "gg1o9f11-p3km-f2o5-l8ch-ffgghhff1111",
      "_taskID": "dd8l6c88-m0hj-c9l2-i59e-cceeddcc8888",
      "task_id": "dd8l6c88-m0hj-c9l2-i59e-cceeddcc8888",
      "_projectID": "883g1733-h5ce-74g7-d049-779988773333",
      "project_id": "883g1733-h5ce-74g7-d049-779988773333",
      "_custID": "550e8400-e29b-41d4-a716-446655440000",
      "customer_id": "550e8400-e29b-41d4-a716-446655440000",
      "_staffID": "cc7k5b77-l9gi-b8k1-h48d-bbddccbb7777",
      "staff_id": "cc7k5b77-l9gi-b8k1-h48d-bbddccbb7777",
      "TimeStart": "09:30:00",
      "time_start": "09:30:00",
      "DateStart": "01/10/2026",
      "date_start": "2026-01-10",
      "TimeEnd": null,
      "f_billed": false,
      "billed": false,
      "created_at": "2026-01-10T09:30:00Z",
      "updated_at": "2026-01-10T09:30:00Z"
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation:**
```sql
INSERT INTO time_entries (
  id, __ID, recordId, "~recordId",
  task_id, _taskID, project_id, _projectID,
  customer_id, _custID, staff_id, _staffID,
  time_start, TimeStart, date_start, DateStart,
  billed, f_billed, created_at, updated_at
) VALUES (
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  $1, $1, $2, $2, $3, $3, $4, $4,
  $5::time, $5, $6::date, $6,
  false, false, NOW(), NOW()
)
RETURNING *;
```

**Note:** `~recordId` field is used for special FileMaker queries (see "Get Record by RecordId" section).

**Reference:** `src/api/financialRecords.js:8-46`

---

### Stop Timer (Update Time Entry)

**Endpoint:** `PATCH /filemaker/dapiRecords/records/{record_id}`

**Auth Required:** Yes (HMAC)

**Request Body Schema:**
```json
{
  "fields": {
    "TimeEnd": "string (required, HH:MM:SS format)",
    "Work Performed": "string (optional) - work description",
    "TimeAdjust": "number (optional) - manual time adjustment in hours"
  }
}
```

**Request Example:**
```bash
PATCH /filemaker/dapiRecords/records/gg1o9f11-p3km-f2o5-l8ch-ffgghhff1111
Authorization: Bearer {signature}.{timestamp}
Content-Type: application/json

{
  "fields": {
    "TimeEnd": "13:45:00",
    "Work Performed": "Completed homepage mockup designs",
    "TimeAdjust": 0.25
  }
}
```

**Response (200 OK):**
```json
{
  "response": {
    "recordId": "gg1o9f11-p3km-f2o5-l8ch-ffgghhff1111",
    "data": {
      "__ID": "gg1o9f11-p3km-f2o5-l8ch-ffgghhff1111",
      "TimeEnd": "13:45:00",
      "time_end": "13:45:00",
      "Work Performed": "Completed homepage mockup designs",
      "description": "Completed homepage mockup designs",
      "TimeAdjust": 0.25,
      "adjustment": 0.25,
      "duration": 4.5,
      "updated_at": "2026-01-10T13:45:00Z"
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation:**
```sql
UPDATE time_entries
SET
  time_end = $2::time,
  TimeEnd = $2,
  description = $3,
  "Work Performed" = $3,
  adjustment = COALESCE($4, 0),
  TimeAdjust = COALESCE($4, 0),
  duration = EXTRACT(EPOCH FROM ($2::time - time_start)) / 3600 + COALESCE($4, 0),
  updated_at = NOW()
WHERE recordId = $1
RETURNING *;
```

**Validation Rules:**
- `TimeEnd`: Must be after `TimeStart`
- `TimeAdjust`: Can be negative (reduce time) or positive (add time)
- `duration`: Automatically calculated from start/end times plus adjustment

**Reference:** `src/api/financialRecords.js:48-74`

---

### Get Time Entries by Timeframe

**Endpoint:** `GET /filemaker/dapiRecords/records`

**Auth Required:** Yes (HMAC)

**Query Parameters:**
- `query` (required, JSON string) - FileMaker-style query filter

**Request Examples:**

**Today's Entries:**
```bash
GET /filemaker/dapiRecords/records?query=[{"DateStart":"01/10/2026"}]
```

**This Week's Entries:**
```bash
GET /filemaker/dapiRecords/records?query=[{"weekNo":"2","year":"2026"}]
```

**This Month's Entries:**
```bash
GET /filemaker/dapiRecords/records?query=[{"month":"1","year":"2026"}]
```

**Unpaid Entries:**
```bash
GET /filemaker/dapiRecords/records?query=[{"f_billed":"0"}]
```

**Date Range:**
```bash
GET /filemaker/dapiRecords/records?query=[{"DateStart":"01/01/2026...01/31/2026"}]
```

**Response (200 OK):**
```json
{
  "response": {
    "data": [
      {
        "__ID": "gg1o9f11-p3km-f2o5-l8ch-ffgghhff1111",
        "recordId": "gg1o9f11-p3km-f2o5-l8ch-ffgghhff1111",
        "_taskID": "dd8l6c88-m0hj-c9l2-i59e-cceeddcc8888",
        "_projectID": "883g1733-h5ce-74g7-d049-779988773333",
        "_custID": "550e8400-e29b-41d4-a716-446655440000",
        "_staffID": "cc7k5b77-l9gi-b8k1-h48d-bbddccbb7777",
        "TimeStart": "09:30:00",
        "TimeEnd": "13:45:00",
        "DateStart": "01/10/2026",
        "date_start": "2026-01-10",
        "Work Performed": "Completed homepage mockup designs",
        "duration": 4.5,
        "f_billed": false,
        "weekNo": 2,
        "month": 1,
        "year": 2026
      }
    ],
    "dataInfo": {
      "count": 1,
      "totalCount": 1
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation:**

**Today:**
```sql
SELECT * FROM time_entries
WHERE date_start = $1::date
ORDER BY time_start DESC;
```

**This Week:**
```sql
SELECT * FROM time_entries
WHERE EXTRACT(WEEK FROM date_start) = $1
  AND EXTRACT(YEAR FROM date_start) = $2
ORDER BY date_start DESC, time_start DESC;
```

**This Month:**
```sql
SELECT * FROM time_entries
WHERE EXTRACT(MONTH FROM date_start) = $1
  AND EXTRACT(YEAR FROM date_start) = $2
ORDER BY date_start DESC, time_start DESC;
```

**Unpaid:**
```sql
SELECT * FROM time_entries
WHERE billed = false
ORDER BY date_start DESC, time_start DESC;
```

**Date Range:**
```sql
SELECT * FROM time_entries
WHERE date_start BETWEEN $1::date AND $2::date
ORDER BY date_start DESC, time_start DESC;
```

**Note:** Backend should auto-populate `weekNo`, `month`, and `year` fields from `date_start` on INSERT/UPDATE.

**Reference:** `src/api/financialRecords.js:76-195`

---

### Get Time Entry by Record ID

**Endpoint:** `GET /filemaker/dapiRecords/records`

**Auth Required:** Yes (HMAC)

**Special Query Format:**

**By `~recordId`:**
```bash
GET /filemaker/dapiRecords/records?query=[{"~recordId":"gg1o9f11-p3km-f2o5-l8ch-ffgghhff1111"}]
```

**By `__ID`:**
```bash
GET /filemaker/dapiRecords/records?query=[{"__ID":"gg1o9f11-p3km-f2o5-l8ch-ffgghhff1111"}]
```

**Response (200 OK):**
```json
{
  "response": {
    "data": [
      {
        "__ID": "gg1o9f11-p3km-f2o5-l8ch-ffgghhff1111",
        "recordId": "gg1o9f11-p3km-f2o5-l8ch-ffgghhff1111",
        "~recordId": "gg1o9f11-p3km-f2o5-l8ch-ffgghhff1111",
        "_taskID": "dd8l6c88-m0hj-c9l2-i59e-cceeddcc8888",
        "_projectID": "883g1733-h5ce-74g7-d049-779988773333",
        "TimeStart": "09:30:00",
        "TimeEnd": "13:45:00",
        "duration": 4.5
      }
    ],
    "dataInfo": {
      "count": 1
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation:**
```sql
-- By ~recordId
SELECT * FROM time_entries
WHERE "~recordId" = $1
LIMIT 1;

-- By __ID
SELECT * FROM time_entries
WHERE __ID = $1 OR id = $1
LIMIT 1;
```

**Note:** The `~recordId` field is a special FileMaker convention that must be preserved in Supabase schema.

**Reference:** `src/api/financialRecords.js:197-225`

---

### Update Billed Status (Bulk)

**Endpoint:** Multiple `PATCH /filemaker/dapiRecords/records/{record_id}` calls

**Auth Required:** Yes (HMAC)

**Current Implementation:** Batches of 10 records per request

**Request Example (Single):**
```bash
PATCH /filemaker/dapiRecords/records/gg1o9f11-p3km-f2o5-l8ch-ffgghhff1111
Authorization: Bearer {signature}.{timestamp}
Content-Type: application/json

{
  "fields": {
    "f_billed": true
  }
}
```

**Response (200 OK):**
```json
{
  "response": {
    "recordId": "gg1o9f11-p3km-f2o5-l8ch-ffgghhff1111",
    "data": {
      "__ID": "gg1o9f11-p3km-f2o5-l8ch-ffgghhff1111",
      "f_billed": true,
      "billed": true,
      "updated_at": "2026-01-10T21:00:00Z"
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation (Single):**
```sql
UPDATE time_entries
SET
  billed = $2,
  f_billed = $2,
  updated_at = NOW()
WHERE recordId = $1
RETURNING *;
```

**Recommended: Bulk Update Endpoint (BCR-005)**

**Endpoint:** `PATCH /filemaker/dapiRecords/records/bulk-update`

**Request Body:**
```json
{
  "record_ids": [
    "gg1o9f11-p3km-f2o5-l8ch-ffgghhff1111",
    "hh2p0g22-q4ln-g3p6-m9di-gghhiihh2222",
    "ii3q1h33-r5mo-h4q7-n0ej-hhiijjii3333"
  ],
  "fields": {
    "f_billed": true
  }
}
```

**Response:**
```json
{
  "response": {
    "success_count": 3,
    "error_count": 0,
    "updated_ids": [
      "gg1o9f11-p3km-f2o5-l8ch-ffgghhff1111",
      "hh2p0g22-q4ln-g3p6-m9di-gghhiihh2222",
      "ii3q1h33-r5mo-h4q7-n0ej-hhiijjii3333"
    ],
    "errors": []
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation (Bulk):**
```sql
UPDATE time_entries
SET
  billed = $1,
  f_billed = $1,
  updated_at = NOW()
WHERE recordId = ANY($2::uuid[])
RETURNING recordId;
```

**Reference:** `src/api/financialRecords.js:398-455`

---

## Team Endpoints

### List All Teams

**Endpoint:** `GET /filemaker/devTeams/records`

**Auth Required:** Yes (HMAC)

**Request Example:**
```bash
GET /filemaker/devTeams/records?query=[{"__ID":"*"}]
Authorization: Bearer {signature}.{timestamp}
```

**Response (200 OK):**
```json
{
  "response": {
    "data": [
      {
        "__ID": "994h2844-i6df-85h8-e15a-88aa99884444",
        "recordId": "994h2844-i6df-85h8-e15a-88aa99884444",
        "name": "Frontend Development Team",
        "description": "Handles all React and UI development",
        "teamLead": "John Smith",
        "created_at": "2025-06-01T10:00:00Z",
        "updated_at": "2026-01-05T14:00:00Z"
      },
      {
        "__ID": "aa5i3955-j7eg-96i9-f26b-99bbaa995555",
        "name": "Backend Development Team",
        "description": "API and database development"
      }
    ],
    "dataInfo": {
      "count": 2,
      "totalCount": 2
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation:**
```sql
SELECT * FROM teams
WHERE deleted_at IS NULL
ORDER BY name ASC;
```

**Reference:** `src/api/teams.js:8-23`

---

### Get Team Members

**Endpoint:** `GET /filemaker/devTeamMembers/records`

**Auth Required:** Yes (HMAC)

**Query Parameters:**
- `query` (required, JSON string) - Filter by team ID

**Request Example:**
```bash
GET /filemaker/devTeamMembers/records?query=[{"_teamID":"994h2844-i6df-85h8-e15a-88aa99884444"}]
Authorization: Bearer {signature}.{timestamp}
```

**Response (200 OK):**
```json
{
  "response": {
    "data": [
      {
        "__ID": "jj4r2i44-s6np-i5r8-o1fk-iijjkkjj4444",
        "recordId": "jj4r2i44-s6np-i5r8-o1fk-iijjkkjj4444",
        "_teamID": "994h2844-i6df-85h8-e15a-88aa99884444",
        "team_id": "994h2844-i6df-85h8-e15a-88aa99884444",
        "_staffID": "cc7k5b77-l9gi-b8k1-h48d-bbddccbb7777",
        "staff_id": "cc7k5b77-l9gi-b8k1-h48d-bbddccbb7777",
        "role": "Senior Developer",
        "name": "Jane Doe",
        "created_at": "2025-06-15T11:00:00Z"
      },
      {
        "__ID": "kk5s3j55-t7oq-j6s9-p2gl-jjkkllkk5555",
        "_teamID": "994h2844-i6df-85h8-e15a-88aa99884444",
        "_staffID": "dd8l6c88-m0hj-c9l2-i59e-cceeddcc8888",
        "role": "Developer",
        "name": "Bob Johnson"
      }
    ],
    "dataInfo": {
      "count": 2,
      "totalCount": 2
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation:**
```sql
SELECT * FROM team_members
WHERE team_id = $1
  AND deleted_at IS NULL
ORDER BY role ASC, name ASC;
```

**Reference:** `src/api/teams.js:96-113`

---

### Get Staff for Team (Joined Query)

**Endpoint:** `GET /filemaker/devStaff/records`

**Auth Required:** Yes (HMAC)

**Current Implementation:** Multi-step query (get team_members, extract staff IDs, query staff with OR)

**Alternative:** New joined endpoint (recommended)

**Request Example (Current):**
```bash
# Step 1: Get team members
GET /filemaker/devTeamMembers/records?query=[{"_teamID":"994h2844-i6df-85h8-e15a-88aa99884444"}]

# Step 2: Query staff with extracted IDs
GET /filemaker/devStaff/records?query=[{"__ID":"cc7k5b77-l9gi-b8k1-h48d-bbddccbb7777"},{"__ID":"dd8l6c88-m0hj-c9l2-i59e-cceeddcc8888"}]
```

**Recommended: New Joined Endpoint**

**Endpoint:** `GET /teams/{team_id}/staff`

**Request Example:**
```bash
GET /teams/994h2844-i6df-85h8-e15a-88aa99884444/staff
Authorization: Bearer {signature}.{timestamp}
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "staff_id": "cc7k5b77-l9gi-b8k1-h48d-bbddccbb7777",
      "name": "Jane Doe",
      "email": "jane@clarity.com",
      "role_in_team": "Senior Developer",
      "position": "Full Stack Developer",
      "active": true
    },
    {
      "staff_id": "dd8l6c88-m0hj-c9l2-i59e-cceeddcc8888",
      "name": "Bob Johnson",
      "email": "bob@clarity.com",
      "role_in_team": "Developer",
      "position": "Frontend Developer",
      "active": true
    }
  ],
  "meta": {
    "count": 2
  }
}
```

**Backend Implementation:**
```sql
SELECT
  tm.id as team_member_id,
  tm.role as role_in_team,
  s.*
FROM team_members tm
JOIN staff s ON tm.staff_id = s.id
WHERE tm.team_id = $1
  AND tm.deleted_at IS NULL
  AND s.deleted_at IS NULL
ORDER BY tm.role ASC, s.name ASC;
```

**Reference:** `src/api/teams.js:115-180`

---

### Assign Staff to Team

**Endpoint:** `POST /filemaker/devTeamMembers/records`

**Auth Required:** Yes (HMAC)

**Request Body Schema:**
```json
{
  "fields": {
    "_teamID": "UUID (required) - team ID",
    "_staffID": "UUID (required) - staff member ID",
    "role": "string (required) - role in team",
    "name": "string (optional) - staff member name"
  }
}
```

**Request Example:**
```bash
POST /filemaker/devTeamMembers/records
Authorization: Bearer {signature}.{timestamp}
Content-Type: application/json

{
  "fields": {
    "_teamID": "994h2844-i6df-85h8-e15a-88aa99884444",
    "_staffID": "ee9m7d99-n1ik-d0m3-j6af-ddffeedd9999",
    "role": "Junior Developer",
    "name": "Alice Williams"
  }
}
```

**Response (201 Created):**
```json
{
  "response": {
    "recordId": "ll6t4k66-u8pr-k7t0-q3hm-kkllmmll6666",
    "data": {
      "__ID": "ll6t4k66-u8pr-k7t0-q3hm-kkllmmll6666",
      "recordId": "ll6t4k66-u8pr-k7t0-q3hm-kkllmmll6666",
      "_teamID": "994h2844-i6df-85h8-e15a-88aa99884444",
      "team_id": "994h2844-i6df-85h8-e15a-88aa99884444",
      "_staffID": "ee9m7d99-n1ik-d0m3-j6af-ddffeedd9999",
      "staff_id": "ee9m7d99-n1ik-d0m3-j6af-ddffeedd9999",
      "role": "Junior Developer",
      "name": "Alice Williams",
      "created_at": "2026-01-10T22:00:00Z"
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation:**
```sql
INSERT INTO team_members (
  id, __ID, recordId, team_id, _teamID,
  staff_id, _staffID, role, name, created_at
) VALUES (
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  $1, $1, $2, $2, $3, $4, NOW()
)
RETURNING *;
```

**Validation Rules:**
- `_teamID`: Required, must reference valid team
- `_staffID`: Required, must reference valid staff
- Prevent duplicate assignments (same staff+team combination)

**Reference:** `src/api/teams.js:182-203`

---

### Remove Staff from Team

**Endpoint:** `DELETE /filemaker/devTeamMembers/records/{record_id}`

**Auth Required:** Yes (HMAC)

**Request Example:**
```bash
DELETE /filemaker/devTeamMembers/records/jj4r2i44-s6np-i5r8-o1fk-iijjkkjj4444
Authorization: Bearer {signature}.{timestamp}
```

**Response (200 OK):**
```json
{
  "response": {},
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation:**
```sql
DELETE FROM team_members
WHERE recordId = $1
RETURNING recordId;
```

**Reference:** `src/api/teams.js:205-220`

---

## Note Endpoints

### Get Notes for Entity

**Endpoint:** `GET /filemaker/devNotes/records`

**Auth Required:** Yes (HMAC)

**Query Parameters:**
- `query` (required, JSON string) - Filter by foreign key ID

**Request Example:**
```bash
# Notes for project
GET /filemaker/devNotes/records?query=[{"_fkID":"883g1733-h5ce-74g7-d049-779988773333"}]

# Notes for task
GET /filemaker/devNotes/records?query=[{"_fkID":"dd8l6c88-m0hj-c9l2-i59e-cceeddcc8888"}]
```

**Response (200 OK):**
```json
{
  "response": {
    "data": [
      {
        "__ID": "mm7u5l77-v9qs-l8u1-r4in-llmmnmm7777",
        "recordId": "mm7u5l77-v9qs-l8u1-r4in-llmmnmm7777",
        "_fkID": "883g1733-h5ce-74g7-d049-779988773333",
        "foreign_key_id": "883g1733-h5ce-74g7-d049-779988773333",
        "note": "Client requested additional features for homepage",
        "type": "project_note",
        "created_at": "2026-01-08T15:30:00Z",
        "updated_at": "2026-01-08T15:30:00Z"
      },
      {
        "__ID": "nn8v6m88-w0rt-m9v2-s5jo-mmnnoonn8888",
        "_fkID": "883g1733-h5ce-74g7-d049-779988773333",
        "note": "Design review scheduled for next week",
        "type": "project_note",
        "created_at": "2026-01-09T10:15:00Z"
      }
    ],
    "dataInfo": {
      "count": 2,
      "totalCount": 2
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation:**
```sql
SELECT * FROM notes
WHERE foreign_key_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC;
```

**Reference:** `src/api/notes.js:8-24`, `src/api/projects.js:47-58`, `src/api/tasks.js:243-260`

---

### Create Note

**Endpoint:** `POST /filemaker/devNotes/records`

**Auth Required:** Yes (HMAC)

**Request Body Schema:**
```json
{
  "fields": {
    "note": "string (required) - note content",
    "_fkID": "UUID (required) - foreign key ID (project/task/customer)",
    "type": "string (optional) - note type classification"
  }
}
```

**Request Example:**
```bash
POST /filemaker/devNotes/records
Authorization: Bearer {signature}.{timestamp}
Content-Type: application/json

{
  "fields": {
    "note": "Meeting notes: Discussed timeline and budget constraints",
    "_fkID": "883g1733-h5ce-74g7-d049-779988773333",
    "type": "meeting_note"
  }
}
```

**Response (201 Created):**
```json
{
  "response": {
    "recordId": "oo9w7n99-x1su-n0w3-t6kp-nnooppoo9999",
    "data": {
      "__ID": "oo9w7n99-x1su-n0w3-t6kp-nnooppoo9999",
      "recordId": "oo9w7n99-x1su-n0w3-t6kp-nnooppoo9999",
      "note": "Meeting notes: Discussed timeline and budget constraints",
      "_fkID": "883g1733-h5ce-74g7-d049-779988773333",
      "foreign_key_id": "883g1733-h5ce-74g7-d049-779988773333",
      "type": "meeting_note",
      "created_at": "2026-01-10T23:00:00Z",
      "updated_at": "2026-01-10T23:00:00Z"
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation:**
```sql
INSERT INTO notes (
  id, __ID, recordId, note, foreign_key_id, _fkID,
  type, created_at, updated_at
) VALUES (
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  $1, $2, $2, $3, NOW(), NOW()
)
RETURNING *;
```

**Validation Rules:**
- `note`: Required, non-empty, max 10000 characters
- `_fkID`: Required, valid UUID format

**Reference:** `src/api/notes.js:8-24`

---

## Link Endpoints

### Get Links for Entity

**Endpoint:** `GET /filemaker/devLinks/records` or `GET /filemaker/devProjectLinks/records`

**Auth Required:** Yes (HMAC)

**Query Parameters:**
- `query` (required, JSON string) - Filter by foreign key ID

**Request Example:**
```bash
# Links for project
GET /filemaker/devLinks/records?query=[{"_fkID":"883g1733-h5ce-74g7-d049-779988773333"}]

# Alternative layout
GET /filemaker/devProjectLinks/records?query=[{"_fkID":"883g1733-h5ce-74g7-d049-779988773333"}]
```

**Response (200 OK):**
```json
{
  "response": {
    "data": [
      {
        "__ID": "pp0x8o00-y2tv-o1x4-u7lq-ooppqqpp0000",
        "recordId": "pp0x8o00-y2tv-o1x4-u7lq-ooppqqpp0000",
        "_fkID": "883g1733-h5ce-74g7-d049-779988773333",
        "foreign_key_id": "883g1733-h5ce-74g7-d049-779988773333",
        "link": "https://www.figma.com/file/abc123/Homepage-Design",
        "url": "https://www.figma.com/file/abc123/Homepage-Design",
        "title": "Homepage Design Mockup",
        "description": "Figma design file",
        "created_at": "2026-01-03T14:00:00Z"
      },
      {
        "__ID": "qq1y9p11-z3uw-p2y5-v8mr-ppqqrrqq1111",
        "_fkID": "883g1733-h5ce-74g7-d049-779988773333",
        "link": "https://github.com/acme/website-redesign",
        "url": "https://github.com/acme/website-redesign",
        "title": "GitHub Repository"
      }
    ],
    "dataInfo": {
      "count": 2,
      "totalCount": 2
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation:**
```sql
SELECT * FROM links
WHERE foreign_key_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC;
```

**Reference:** `src/api/links.js:8-30`, `src/api/projects.js:61-84`

---

### Create Link

**Endpoint:** `POST /filemaker/devLinks/records`

**Auth Required:** Yes (HMAC)

**Request Body Schema:**
```json
{
  "fields": {
    "link": "string (required, valid URL)",
    "_fkID": "UUID (required) - foreign key ID",
    "title": "string (optional) - link title",
    "description": "string (optional) - link description"
  }
}
```

**Request Example:**
```bash
POST /filemaker/devLinks/records
Authorization: Bearer {signature}.{timestamp}
Content-Type: application/json

{
  "fields": {
    "link": "https://docs.google.com/document/d/xyz789",
    "_fkID": "883g1733-h5ce-74g7-d049-779988773333",
    "title": "Project Requirements Document",
    "description": "Detailed requirements and specifications"
  }
}
```

**Response (201 Created):**
```json
{
  "response": {
    "recordId": "rr2z0q22-a4vx-q3z6-w9ns-qqrrssrr2222",
    "data": {
      "__ID": "rr2z0q22-a4vx-q3z6-w9ns-qqrrssrr2222",
      "recordId": "rr2z0q22-a4vx-q3z6-w9ns-qqrrssrr2222",
      "link": "https://docs.google.com/document/d/xyz789",
      "url": "https://docs.google.com/document/d/xyz789",
      "_fkID": "883g1733-h5ce-74g7-d049-779988773333",
      "foreign_key_id": "883g1733-h5ce-74g7-d049-779988773333",
      "title": "Project Requirements Document",
      "description": "Detailed requirements and specifications",
      "created_at": "2026-01-10T23:30:00Z"
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Backend Implementation:**
```sql
INSERT INTO links (
  id, __ID, recordId, url, link, foreign_key_id, _fkID,
  title, description, created_at
) VALUES (
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  $1, $1, $2, $2, $3, $4, NOW()
)
RETURNING *;
```

**Validation Rules:**
- `link`: Required, must be valid URL format
- `_fkID`: Required, valid UUID format

**Reference:** `src/api/links.js:8-30`

---

## Project Related Endpoints

### Project Images (BCR-003)

**Status:** ⚠️ Needs table verification

**Endpoint:** `GET /filemaker/devProjectImages/records` (if table exists)

**Query Example:**
```bash
GET /filemaker/devProjectImages/records?query=[{"_fkID":"883g1733-h5ce-74g7-d049-779988773333"}]
```

**Expected Response Format:**
```json
{
  "response": {
    "data": [
      {
        "__ID": "ss3a1r33-b5wy-r4a7-x0ot-rrssttrr3333",
        "recordId": "ss3a1r33-b5wy-r4a7-x0ot-rrssttrr3333",
        "_fkID": "883g1733-h5ce-74g7-d049-779988773333",
        "foreign_key_id": "883g1733-h5ce-74g7-d049-779988773333",
        "image_url": "https://storage.claritybusinesssolutions.ca/projects/883g1733/homepage-sketch.png",
        "title": "Homepage Sketch",
        "description": "Initial concept sketch",
        "created_at": "2026-01-05T16:00:00Z"
      }
    ],
    "dataInfo": {
      "count": 1,
      "totalCount": 1
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Required Actions:**
1. Verify if `project_images` or similar table exists in Supabase
2. If not, create table (see BCR-003 in BACKEND_API_REQUIREMENTS.md)
3. Define storage strategy (Supabase Storage vs CDN)

**Reference:** `src/api/projects.js:152-163`

---

### Project Objectives (BCR-003)

**Status:** ⚠️ Needs table verification

**Endpoint:** `GET /filemaker/devProjectObjectives/records` (if table exists)

**Query Example:**
```bash
GET /filemaker/devProjectObjectives/records?query=[{"_projectID":"883g1733-h5ce-74g7-d049-779988773333"}]
```

**Expected Response Format:**
```json
{
  "response": {
    "data": [
      {
        "__ID": "tt4b2s44-c6xz-s5b8-y1pu-ssttuu ss4444",
        "recordId": "tt4b2s44-c6xz-s5b8-y1pu-ssttuu ss4444",
        "_projectID": "883g1733-h5ce-74g7-d049-779988773333",
        "project_id": "883g1733-h5ce-74g7-d049-779988773333",
        "objective": "Improve homepage conversion rate by 25%",
        "status": "In Progress",
        "priority": "High",
        "created_at": "2026-01-01T12:00:00Z"
      }
    ],
    "dataInfo": {
      "count": 1
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Required Actions:**
1. Verify if `project_objectives` table exists
2. If not, create table with schema from BCR-003

**Reference:** `src/api/projects.js:152-163`, `src/api/projects.js:201-212`

---

### Project Objective Steps (BCR-003)

**Status:** ⚠️ Needs table verification

**Endpoint:** `GET /filemaker/devProjectObjSteps/records` (if table exists)

**Query Example:**
```bash
GET /filemaker/devProjectObjSteps/records?query=[{"_projectID":"883g1733-h5ce-74g7-d049-779988773333"}]
```

**Expected Response Format:**
```json
{
  "response": {
    "data": [
      {
        "__ID": "uu5c3t55-d7ya-t6c9-z2qv-ttuuvvtt5555",
        "recordId": "uu5c3t55-d7ya-t6c9-z2qv-ttuuvvtt5555",
        "_projectID": "883g1733-h5ce-74g7-d049-779988773333",
        "_objectiveID": "tt4b2s44-c6xz-s5b8-y1pu-ssttuu ss4444",
        "step": "Analyze current conversion funnel",
        "completed": true,
        "order": 1,
        "created_at": "2026-01-01T12:30:00Z"
      }
    ],
    "dataInfo": {
      "count": 1
    }
  },
  "messages": [
    {
      "code": "0",
      "message": "OK"
    }
  ]
}
```

**Required Actions:**
1. Verify if `project_objective_steps` table exists
2. If not, create table with schema from BCR-003

**Reference:** `src/api/projects.js:152-163`

---

## Special Operations

### QuickBooks Time Entry Sync (BCR-004)

**Status:** ⚠️ Requires new endpoint

**Current Implementation:**
```javascript
// src/api/fileMaker.js:447-500
FileMaker.PerformScript("Initialize QB via JS", payload);
```

**Required New Endpoint:** `POST /quickbooks/sync-time-entries`

**Auth Required:** Yes (HMAC)

**Request Body Schema:**
```json
{
  "customerId": "UUID (required) - customer ID",
  "recordsByProject": {
    "project_id_1": ["record_id_1", "record_id_2"],
    "project_id_2": ["record_id_3", "record_id_4"]
  }
}
```

**Request Example:**
```bash
POST /quickbooks/sync-time-entries
Authorization: Bearer {signature}.{timestamp}
Content-Type: application/json

{
  "customerId": "550e8400-e29b-41d4-a716-446655440000",
  "recordsByProject": {
    "883g1733-h5ce-74g7-d049-779988773333": [
      "gg1o9f11-p3km-f2o5-l8ch-ffgghhff1111",
      "hh2p0g22-q4ln-g3p6-m9di-gghhiihh2222"
    ],
    "bb6j4a66-k8fh-a7j0-g37c-aaccbbaa6666": [
      "ii3q1h33-r5mo-h4q7-n0ej-hhiijjii3333"
    ]
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "invoice_ids": [
    "QB-INV-12345",
    "QB-INV-12346"
  ],
  "updated_records": 3,
  "errors": []
}
```

**Error Response (Partial Success):**
```json
{
  "success": false,
  "invoice_ids": ["QB-INV-12345"],
  "updated_records": 2,
  "errors": [
    {
      "project_id": "bb6j4a66-k8fh-a7j0-g37c-aaccbbaa6666",
      "record_ids": ["ii3q1h33-r5mo-h4q7-n0ej-hhiijjii3333"],
      "error": "QuickBooks API timeout",
      "code": "QB_TIMEOUT"
    }
  ]
}
```

**Backend Business Logic:**
1. Fetch time entries for specified record IDs
2. Group by project
3. For each project:
   - Calculate total hours
   - Calculate total cost (hours × rate)
   - Create QB invoice with line items
4. Mark successfully invoiced records as `f_billed = true`
5. Return invoice IDs and any errors
6. On failure, rollback billed status changes

**Rollback Handling:**
- If QB API fails, do not mark records as billed
- Provide detailed error messages for retry
- Support idempotency (same request can be retried safely)

**Reference:** `src/api/fileMaker.js:447-500`

---

### Mailjet Configuration

**Status:** ✅ Already handled via environment variables

**Current Implementation:** Fetches config from FileMaker script

**Required Change:** Use environment variables instead

**Environment Variables:**
```
VITE_MAILJET_API_KEY=your-api-key
VITE_MAILJET_SECRET_KEY=your-secret-key
```

**Frontend Code Change:**
```javascript
// Remove FileMaker script call
// const configJson = await FMGofer.PerformScript('JS * Fetch Data', payload);

// Use environment variables directly
const apiKey = import.meta.env.VITE_MAILJET_API_KEY;
const secretKey = import.meta.env.VITE_MAILJET_SECRET_KEY;
```

**No backend endpoint needed** - configuration is environment-based.

**Reference:** `src/services/mailjetService.js:6-178`

---

### User Context Loading

**Status:** ⚠️ Needs replacement strategy

**Current Implementation:**
```javascript
// src/services/initializationService.js:37
const userContext = await fetchDataFromFileMaker({
  layout: 'devCustomers',
  action: 'read',
  callBackName: 'returnContext'
});
```

**Required Change:** Use Supabase authentication context

**Option A: Supabase User Metadata (Recommended)**
```javascript
const { data: { user }, error } = await supabase.auth.getUser();

const userContext = {
  id: user.id,
  email: user.email,
  name: user.user_metadata.full_name,
  role: user.user_metadata.role,
  organizationId: user.user_metadata.organization_id
};
```

**Option B: Backend User Context Endpoint**

**Endpoint:** `GET /users/me`

**Auth Required:** Yes (Supabase JWT or HMAC)

**Request Example:**
```bash
GET /users/me
Authorization: Bearer {supabase_jwt_token}
```

**Response (200 OK):**
```json
{
  "id": "user-uuid",
  "email": "user@clarity.com",
  "name": "John Doe",
  "role": "admin",
  "organization_id": "org-uuid",
  "preferences": {
    "theme": "dark",
    "defaultView": "customers"
  }
}
```

**Recommendation:** Use Option A (Supabase user metadata) for simplicity and performance.

**Reference:** `src/services/initializationService.js:1-37`

---

### Prospect to Customer Conversion

**Status:** ✅ Standard customer creation operation

**Current Implementation:**
```javascript
// src/api/prospects.js:473-477
const fileMakerResponse = await fetchDataFromFileMaker({
  layout: Layouts.CUSTOMERS,
  action: Actions.CREATE,
  fieldData: fileMakerData
});
```

**Required Change:** Use customer creation endpoint directly

**Endpoint:** `POST /filemaker/devCustomers/records` (same as "Create Customer")

**Request Example:**
```bash
POST /filemaker/devCustomers/records
Authorization: Bearer {signature}.{timestamp}
Content-Type: application/json

{
  "fields": {
    "name": "Converted Prospect Corp",
    "email": "contact@converted.com",
    "phone": "555-1234",
    "f_active": true,
    "customerType": "Converted Prospect"
  }
}
```

**Frontend Code Change:**
```javascript
// Remove FileMaker import
// const { fetchDataFromFileMaker, Layouts, Actions } = await import('./fileMaker.js');

// Use direct API call
import { createCustomer } from './customers';

const customer = await createCustomer({
  name: prospectData.name,
  email: prospectData.email,
  phone: prospectData.phone,
  ...additionalFields
});
```

**No special backend handling needed** - standard customer creation.

**Reference:** `src/api/prospects.js:473-477`

---

## Error Handling

### Standard Error Codes

FileMaker-compatible error codes for consistency:

| Code | Meaning | HTTP Status |
|------|---------|-------------|
| 0 | OK | 200 |
| 401 | No records match the request | 404 |
| 500 | Validation error | 400 |
| 802 | Unable to open file (database error) | 500 |
| 803 | File is locked or in use | 423 |
| 952 | Database session timed out | 401 |

### Error Response Format

**Validation Error (400):**
```json
{
  "messages": [
    {
      "code": "500",
      "message": "Validation failed: name is required"
    }
  ],
  "response": {}
}
```

**Not Found (404):**
```json
{
  "messages": [
    {
      "code": "401",
      "message": "No records match the request"
    }
  ],
  "response": {}
}
```

**Authentication Error (401):**
```json
{
  "messages": [
    {
      "code": "952",
      "message": "Database session timed out"
    }
  ],
  "response": {}
}
```

**Server Error (500):**
```json
{
  "messages": [
    {
      "code": "802",
      "message": "Unable to open file"
    }
  ],
  "response": {}
}
```

### Validation Rules Summary

**All Endpoints:**
- UUIDs must be valid format
- Required fields cannot be null or empty strings
- String fields respect max length constraints
- Numeric fields must be valid numbers
- Date fields must be valid ISO 8601 or MM/DD/YYYY format
- URLs must be valid format
- Emails must be valid format

**Soft Delete:**
- Prefer `deleted_at` timestamp over hard deletes
- Queries should filter `WHERE deleted_at IS NULL`
- Maintains referential integrity

**Field Name Mapping:**
- Backend should support both FileMaker-style (`_custID`) and native (`customer_id`) field names
- Response should include both for compatibility
- Queries should accept either format

---

## Summary

### Endpoint Coverage

**Total Endpoints Specified:** 40+

**By Resource:**
- Customers: 6 operations (list, get, create, update, toggle status, delete)
- Projects: 5 operations (list, get, create, update, delete)
- Tasks: 5 operations (list, get, create, update, toggle completion)
- Time Entries: 7 operations (create, update, list by timeframe, get by ID, bulk update)
- Teams: 6 operations (list, get members, get staff, create, assign, remove)
- Notes: 2 operations (list, create)
- Links: 2 operations (list, create)
- Project Related: 3 operations (images, objectives, steps) - needs verification
- Special: 3 operations (QB sync, Mailjet config, user context)

**Implementation Status:**
- ✅ Ready to implement: 34 endpoints (existing FileMaker proxy endpoints)
- ⚠️ Needs verification: 3 endpoints (project images, objectives, steps)
- ⚠️ Needs new endpoint: 3 operations (QB sync, bulk update, user context)

### Next Steps

1. **Backend Team:** Review and implement BCR-001 through BCR-005 from BACKEND_API_REQUIREMENTS.md
2. **Backend Team:** Answer critical questions about table mappings (see BACKEND_API_REQUIREMENTS.md)
3. **Backend Team:** Implement FileMaker-compatible response format wrapper
4. **Backend Team:** Add field name mapping support (`_custID` ↔ `customer_id`)
5. **Frontend Team:** Test all operations against updated backend
6. **Frontend Team:** Proceed with FileMaker code removal (Phase 2)

### Critical Dependencies

- All endpoints depend on BCR-001 (Update FileMaker Proxy to Supabase)
- Time entries depend on BCR-002 (Clarify financial records table)
- Project operations depend on BCR-003 (Verify project related tables)
- QB sync depends on BCR-004 (QuickBooks integration update)
- Bulk updates depend on BCR-005 (Bulk update optimization)

---

**Document Status:** Complete - Ready for Backend Implementation
**Last Updated:** 2026-01-10
**Related Documents:**
- BACKEND_API_REQUIREMENTS.md (Backend change requests and migration strategy)
- architecture.md (Current FileMaker bridge architecture)
- inventory.md (Complete FileMaker integration inventory)

**References:**
- OpenAPI Spec: https://api.claritybusinesssolutions.ca/openapi.json
- Supabase Tables: `.roo/rules/SUPABASE_DATABASE_VERIFICATION.md`
- Frontend API Layer: `src/api/*.js` files
- Data Service: `src/services/dataService.js`
