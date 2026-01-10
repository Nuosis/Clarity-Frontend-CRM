# Links - API Contracts

## Overview

This document specifies the backend API endpoints or PostgreSQL functions required to support the Links feature after migration to Supabase.

## API Style Recommendation

**Recommended Approach**: REST API endpoints for consistency with existing backend patterns

**Alternative**: PostgreSQL RPC functions if preferred by backend team

## REST API Endpoints

### Base URL

```
https://api.claritybusinesssolutions.ca/links
```

### Authentication

All requests require HMAC-SHA256 authentication:
```
Authorization: Bearer {signature}.{timestamp}
```

Handled automatically by `dataService.generateBackendAuthHeader()` in frontend.

---

### 1. List Links by Parent Entity

**Endpoint**: `GET /links`

**Description**: Retrieves all links associated with a specific parent entity

**Query Parameters**:
- `customer_id` (UUID, optional) - Filter by customer
- `project_id` (UUID, optional) - Filter by project
- `task_id` (UUID, optional) - Filter by task
- `organization_id` (UUID, optional) - Filter by organization

**Validation**:
- Exactly one filter parameter must be provided
- UUID must be valid format
- Parent entity must exist

**Request Example**:
```http
GET /links?project_id=a1b2c3d4-e5f6-7890-abcd-ef1234567890
Authorization: Bearer abc123...
```

**Response 200 OK**:
```json
{
  "data": [
    {
      "id": "f1e2d3c4-b5a6-7890-abcd-1234567890ef",
      "project_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "customer_id": null,
      "task_id": null,
      "organization_id": null,
      "link": "https://github.com/owner/repo",
      "created_at": "2026-01-10T19:00:00Z",
      "updated_at": "2026-01-10T19:00:00Z",
      "created_by": "user-uuid-here",
      "updated_by": null
    }
  ],
  "count": 1
}
```

**Response 400 Bad Request**:
```json
{
  "error": "Exactly one filter parameter (customer_id, project_id, task_id, organization_id) must be provided"
}
```

**Response 404 Not Found**:
```json
{
  "error": "Parent entity not found"
}
```

---

### 2. Get Link by ID

**Endpoint**: `GET /links/{id}`

**Description**: Retrieves a single link by its ID

**Path Parameters**:
- `id` (UUID, required) - Link ID

**Request Example**:
```http
GET /links/f1e2d3c4-b5a6-7890-abcd-1234567890ef
Authorization: Bearer abc123...
```

**Response 200 OK**:
```json
{
  "id": "f1e2d3c4-b5a6-7890-abcd-1234567890ef",
  "project_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "customer_id": null,
  "task_id": null,
  "organization_id": null,
  "link": "https://github.com/owner/repo",
  "created_at": "2026-01-10T19:00:00Z",
  "updated_at": "2026-01-10T19:00:00Z",
  "created_by": "user-uuid-here",
  "updated_by": null
}
```

**Response 404 Not Found**:
```json
{
  "error": "Link not found"
}
```

---

### 3. Create Link

**Endpoint**: `POST /links`

**Description**: Creates a new link associated with a parent entity

**Request Body**:
```json
{
  "link": "https://example.com",
  "project_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Alternative Bodies** (exactly one parent):
```json
{
  "link": "https://example.com",
  "task_id": "task-uuid-here"
}
```

```json
{
  "link": "https://example.com",
  "customer_id": "customer-uuid-here"
}
```

**Validation Rules**:
- `link` (required, string, max 2048 chars)
  - Must be valid URL format
  - Must start with `http://` or `https://`
- Exactly one of `customer_id`, `project_id`, `task_id`, `organization_id` must be provided
- Parent entity UUID must reference existing record

**Request Example**:
```http
POST /links
Authorization: Bearer abc123...
Content-Type: application/json

{
  "link": "https://github.com/owner/repo",
  "project_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Response 201 Created**:
```json
{
  "id": "f1e2d3c4-b5a6-7890-abcd-1234567890ef",
  "project_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "customer_id": null,
  "task_id": null,
  "organization_id": null,
  "link": "https://github.com/owner/repo",
  "created_at": "2026-01-10T19:00:00Z",
  "updated_at": "2026-01-10T19:00:00Z",
  "created_by": "user-uuid-here",
  "updated_by": null
}
```

**Response 400 Bad Request** (invalid URL):
```json
{
  "error": "Invalid URL format",
  "details": "URL must start with http:// or https://"
}
```

**Response 400 Bad Request** (URL too long):
```json
{
  "error": "URL exceeds maximum length of 2048 characters"
}
```

**Response 400 Bad Request** (no parent):
```json
{
  "error": "Exactly one parent entity (customer_id, project_id, task_id, organization_id) must be provided"
}
```

**Response 400 Bad Request** (multiple parents):
```json
{
  "error": "Only one parent entity can be specified"
}
```

**Response 404 Not Found** (parent doesn't exist):
```json
{
  "error": "Parent entity not found"
}
```

**Response 409 Conflict** (duplicate link - if uniqueness enforced):
```json
{
  "error": "Link already exists for this entity"
}
```

---

### 4. Update Link

**Endpoint**: `PATCH /links/{id}`

**Description**: Updates an existing link's URL

**Path Parameters**:
- `id` (UUID, required) - Link ID

**Request Body**:
```json
{
  "link": "https://new-url.com"
}
```

**Validation Rules**:
- `link` (required, string, max 2048 chars)
  - Must be valid URL format
  - Must start with `http://` or `https://`
- Cannot change parent entity associations
- `updated_at` and `updated_by` automatically set

**Request Example**:
```http
PATCH /links/f1e2d3c4-b5a6-7890-abcd-1234567890ef
Authorization: Bearer abc123...
Content-Type: application/json

{
  "link": "https://updated-url.com"
}
```

**Response 200 OK**:
```json
{
  "id": "f1e2d3c4-b5a6-7890-abcd-1234567890ef",
  "project_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "customer_id": null,
  "task_id": null,
  "organization_id": null,
  "link": "https://updated-url.com",
  "created_at": "2026-01-10T19:00:00Z",
  "updated_at": "2026-01-10T19:15:00Z",
  "created_by": "user-uuid-here",
  "updated_by": "user-uuid-here"
}
```

**Response 400 Bad Request**:
```json
{
  "error": "Invalid URL format"
}
```

**Response 404 Not Found**:
```json
{
  "error": "Link not found"
}
```

---

### 5. Delete Link

**Endpoint**: `DELETE /links/{id}`

**Description**: Deletes a link permanently

**Path Parameters**:
- `id` (UUID, required) - Link ID

**Request Example**:
```http
DELETE /links/f1e2d3c4-b5a6-7890-abcd-1234567890ef
Authorization: Bearer abc123...
```

**Response 204 No Content**:
```
(empty body)
```

**Response 404 Not Found**:
```json
{
  "error": "Link not found"
}
```

---

## PostgreSQL RPC Functions (Alternative)

If backend team prefers PostgreSQL functions over REST endpoints:

### 1. get_links_by_project

```sql
CREATE OR REPLACE FUNCTION get_links_by_project(p_project_id UUID)
RETURNS TABLE (
  id UUID,
  project_id UUID,
  link VARCHAR,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.project_id,
    l.link,
    l.created_at,
    l.updated_at,
    l.created_by,
    l.updated_by
  FROM links l
  WHERE l.project_id = p_project_id
  ORDER BY l.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage from Frontend**:
```javascript
const { data, error } = await supabase.rpc('get_links_by_project', {
  p_project_id: 'project-uuid-here'
});
```

### 2. get_links_by_task

```sql
CREATE OR REPLACE FUNCTION get_links_by_task(p_task_id UUID)
RETURNS TABLE (
  id UUID,
  task_id UUID,
  link VARCHAR,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.task_id,
    l.link,
    l.created_at,
    l.updated_at,
    l.created_by,
    l.updated_by
  FROM links l
  WHERE l.task_id = p_task_id
  ORDER BY l.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3. create_link

```sql
CREATE OR REPLACE FUNCTION create_link(
  p_link VARCHAR,
  p_customer_id UUID DEFAULT NULL,
  p_project_id UUID DEFAULT NULL,
  p_task_id UUID DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  link VARCHAR,
  customer_id UUID,
  project_id UUID,
  task_id UUID,
  organization_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID
)
AS $$
DECLARE
  v_link_id UUID;
  v_parent_count INT;
BEGIN
  -- Validate exactly one parent
  v_parent_count := (
    (CASE WHEN p_customer_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN p_project_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN p_task_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN p_organization_id IS NOT NULL THEN 1 ELSE 0 END)
  );

  IF v_parent_count != 1 THEN
    RAISE EXCEPTION 'Exactly one parent entity must be specified';
  END IF;

  -- Validate URL length
  IF LENGTH(p_link) > 2048 THEN
    RAISE EXCEPTION 'URL exceeds maximum length of 2048 characters';
  END IF;

  -- Insert link
  INSERT INTO links (
    link,
    customer_id,
    project_id,
    task_id,
    organization_id,
    created_by
  )
  VALUES (
    p_link,
    p_customer_id,
    p_project_id,
    p_task_id,
    p_organization_id,
    COALESCE(p_created_by, auth.uid())
  )
  RETURNING links.id INTO v_link_id;

  -- Return created link
  RETURN QUERY
  SELECT
    l.id,
    l.link,
    l.customer_id,
    l.project_id,
    l.task_id,
    l.organization_id,
    l.created_at,
    l.updated_at,
    l.created_by
  FROM links l
  WHERE l.id = v_link_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage from Frontend**:
```javascript
const { data, error } = await supabase.rpc('create_link', {
  p_link: 'https://example.com',
  p_project_id: 'project-uuid-here'
});
```

### 4. update_link

```sql
CREATE OR REPLACE FUNCTION update_link(
  p_link_id UUID,
  p_new_link VARCHAR,
  p_updated_by UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  link VARCHAR,
  updated_at TIMESTAMPTZ,
  updated_by UUID
)
AS $$
BEGIN
  -- Validate URL length
  IF LENGTH(p_new_link) > 2048 THEN
    RAISE EXCEPTION 'URL exceeds maximum length of 2048 characters';
  END IF;

  -- Update link
  UPDATE links
  SET
    link = p_new_link,
    updated_at = now(),
    updated_by = COALESCE(p_updated_by, auth.uid())
  WHERE links.id = p_link_id;

  -- Return updated link
  RETURN QUERY
  SELECT
    l.id,
    l.link,
    l.updated_at,
    l.updated_by
  FROM links l
  WHERE l.id = p_link_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 5. delete_link

```sql
CREATE OR REPLACE FUNCTION delete_link(p_link_id UUID)
RETURNS BOOLEAN
AS $$
DECLARE
  v_deleted BOOLEAN;
BEGIN
  DELETE FROM links WHERE id = p_link_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage from Frontend**:
```javascript
const { data, error } = await supabase.rpc('delete_link', {
  p_link_id: 'link-uuid-here'
});
```

## Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | INVALID_URL | URL format invalid |
| 400 | URL_TOO_LONG | URL exceeds 2048 characters |
| 400 | MISSING_PARENT | No parent entity specified |
| 400 | MULTIPLE_PARENTS | More than one parent specified |
| 400 | INVALID_UUID | UUID format invalid |
| 401 | UNAUTHORIZED | Missing or invalid authentication |
| 403 | FORBIDDEN | User lacks permission to access entity |
| 404 | NOT_FOUND | Link or parent entity not found |
| 409 | DUPLICATE | Link already exists (if enforced) |
| 500 | INTERNAL_ERROR | Server error |

## Frontend Integration

### Environment Detection

Frontend should detect environment and route accordingly:

```javascript
// src/services/dataService.js
if (isFileMakerEnvironment()) {
  // Use FileMaker bridge (legacy)
  return fetchDataFromFileMaker({ layout: 'devLinks', ... });
} else {
  // Use Supabase/Backend API (new)
  return fetch('/api/links', { ... });
}
```

### Example Frontend Implementation

```javascript
// src/api/links.js (after migration)

export async function createLink(data) {
  const authHeader = await generateBackendAuthHeader();

  const body = {
    link: data.url || data.link,
    project_id: data.project_id,
    task_id: data.task_id,
    customer_id: data.customer_id
  };

  // Remove null/undefined parent IDs
  Object.keys(body).forEach(key => {
    if (body[key] === null || body[key] === undefined) {
      delete body[key];
    }
  });

  const response = await fetch('/api/links', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create link');
  }

  return await response.json();
}

export async function fetchLinksByProject(projectId) {
  const authHeader = await generateBackendAuthHeader();

  const response = await fetch(`/api/links?project_id=${projectId}`, {
    headers: {
      'Authorization': authHeader
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch links');
  }

  const result = await response.json();
  return { data: result.data, count: result.count };
}
```

## Performance Requirements

- **List Links**: < 100ms response time for typical queries
- **Create Link**: < 200ms including validation
- **Update Link**: < 150ms
- **Delete Link**: < 100ms
- **Concurrent Creates**: Support 10+ simultaneous link creations
- **Pagination**: Not required (links per entity typically < 50)

## Caching Strategy

- **Frontend**: No caching, always fetch fresh
- **Backend**: Optional query result caching (5-minute TTL)
- **Invalidation**: On create/update/delete, invalidate parent entity cache

## Idempotency

- **Create**: NOT idempotent - duplicate requests create duplicate links (unless uniqueness enforced)
- **Update**: Idempotent - same URL update has no effect
- **Delete**: Idempotent - deleting non-existent link returns 404 but is safe

## Rate Limiting

Recommended limits per user:
- Create: 20 requests/minute
- Read: 100 requests/minute
- Update: 10 requests/minute
- Delete: 20 requests/minute

## CORS Configuration

```javascript
Access-Control-Allow-Origin: https://app.claritybusinesssolutions.ca
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 3600
```

## Webhooks (Future)

Consider emitting events for:
- `link.created` - New link added
- `link.updated` - Link URL changed
- `link.deleted` - Link removed

Payload:
```json
{
  "event": "link.created",
  "link_id": "uuid",
  "parent_type": "project",
  "parent_id": "uuid",
  "link": "https://example.com",
  "created_by": "uuid",
  "timestamp": "2026-01-10T19:00:00Z"
}
```
