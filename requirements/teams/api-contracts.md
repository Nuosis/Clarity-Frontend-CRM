# Teams - API Contracts

## Overview

This document specifies the backend API endpoints and database functions (RPCs) required for the Teams feature. These will replace the current FileMaker-based operations.

## Backend Implementation Requirements

**Backend Repository:** https://github.com/your-org/clarity-backend (or similar)

**API Base URL:** `https://api.claritybusinesssolutions.ca`

**Authentication:** All endpoints require organization-scoped authentication via HMAC or JWT tokens.

**Content-Type:** `application/json`

## Team CRUD Endpoints

### List Teams

Get all teams for the authenticated user's organization.

**Endpoint:** `GET /api/teams`

**Authentication:** Required (organization-scoped)

**Query Parameters:**
- `include_stats` (optional, boolean): Include team statistics (default: false)
- `include_members` (optional, boolean): Include team members count (default: false)

**Request Example:**
```http
GET /api/teams?include_stats=true
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "team-uuid-001",
      "organization_id": "org-uuid",
      "name": "Development Team",
      "created_at": "2024-01-15T15:30:00Z",
      "updated_at": "2024-01-20T19:45:00Z",
      "stats": {
        "total_members": 5,
        "total_projects": 12,
        "active_projects": 8
      }
    }
  ],
  "count": 1
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or missing authentication
- `500 Internal Server Error`: Database error

### Get Team by ID

Retrieve detailed information about a specific team.

**Endpoint:** `GET /api/teams/:teamId`

**Authentication:** Required (organization-scoped)

**Query Parameters:**
- `include_members` (optional, boolean): Include team members array (default: false)
- `include_projects` (optional, boolean): Include team projects array (default: false)

**Request Example:**
```http
GET /api/teams/team-uuid-001?include_members=true&include_projects=true
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "team-uuid-001",
    "organization_id": "org-uuid",
    "name": "Development Team",
    "created_at": "2024-01-15T15:30:00Z",
    "updated_at": "2024-01-20T19:45:00Z",
    "members": [
      {
        "id": "member-uuid-001",
        "staff_id": "staff-uuid-001",
        "role": "Lead Developer",
        "staff": {
          "id": "staff-uuid-001",
          "name": "John Doe",
          "title": "Senior Developer",
          "profile_image_url": "https://..."
        }
      }
    ],
    "projects": [
      {
        "id": "project-uuid-001",
        "name": "Website Redesign",
        "status": "Open"
      }
    ]
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or missing authentication
- `404 Not Found`: Team not found or not in user's organization
- `500 Internal Server Error`: Database error

### Create Team

Create a new team.

**Endpoint:** `POST /api/teams`

**Authentication:** Required (organization-scoped)

**Request Body:**
```json
{
  "name": "Marketing Team"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "team-uuid-002",
    "organization_id": "org-uuid",
    "name": "Marketing Team",
    "created_at": "2024-01-22T10:00:00Z",
    "updated_at": "2024-01-22T10:00:00Z"
  }
}
```

**Validation Rules:**
- `name`: Required, 1-255 characters, unique within organization

**Error Responses:**
- `400 Bad Request`: Validation error (missing name, duplicate name)
- `401 Unauthorized`: Invalid or missing authentication
- `500 Internal Server Error`: Database error

### Update Team

Update an existing team.

**Endpoint:** `PATCH /api/teams/:teamId`

**Authentication:** Required (organization-scoped)

**Request Body:**
```json
{
  "name": "Product Development Team"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "team-uuid-001",
    "organization_id": "org-uuid",
    "name": "Product Development Team",
    "created_at": "2024-01-15T15:30:00Z",
    "updated_at": "2024-01-22T11:30:00Z"
  }
}
```

**Validation Rules:**
- `name`: Optional, 1-255 characters, unique within organization if provided

**Error Responses:**
- `400 Bad Request`: Validation error (duplicate name, invalid data)
- `401 Unauthorized`: Invalid or missing authentication
- `404 Not Found`: Team not found or not in user's organization
- `500 Internal Server Error`: Database error

### Delete Team

Delete a team and its member assignments.

**Endpoint:** `DELETE /api/teams/:teamId`

**Authentication:** Required (organization-scoped)

**Request Example:**
```http
DELETE /api/teams/team-uuid-001
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Team deleted successfully"
}
```

**Cascade Behavior:**
- Deletes all `team_members` records for this team (CASCADE)
- Sets `projects.team_id` to NULL for assigned projects (SET NULL)

**Error Responses:**
- `401 Unauthorized`: Invalid or missing authentication
- `404 Not Found`: Team not found or not in user's organization
- `500 Internal Server Error`: Database error

## Staff Management Endpoints

### List All Staff

Get all staff members for the authenticated user's organization.

**Endpoint:** `GET /api/staff`

**Authentication:** Required (organization-scoped)

**Query Parameters:**
- `is_active` (optional, boolean): Filter by active status (default: all)
- `search` (optional, string): Search by name

**Request Example:**
```http
GET /api/staff?is_active=true&search=john
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "staff-uuid-001",
      "organization_id": "org-uuid",
      "name": "John Doe",
      "title": "Senior Developer",
      "email": "john@example.com",
      "phone": "+1-555-0100",
      "profile_image_url": "https://...",
      "is_active": true,
      "created_at": "2024-01-10T14:00:00Z",
      "updated_at": "2024-01-10T14:00:00Z"
    }
  ],
  "count": 1
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or missing authentication
- `500 Internal Server Error`: Database error

### Get Team Staff

Get all staff members assigned to a specific team.

**Endpoint:** `GET /api/teams/:teamId/members`

**Authentication:** Required (organization-scoped)

**Request Example:**
```http
GET /api/teams/team-uuid-001/members
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "member-uuid-001",
      "team_id": "team-uuid-001",
      "staff_id": "staff-uuid-001",
      "role": "Lead Developer",
      "created_at": "2024-01-15T16:00:00Z",
      "updated_at": "2024-01-15T16:00:00Z",
      "staff": {
        "id": "staff-uuid-001",
        "name": "John Doe",
        "title": "Senior Developer",
        "profile_image_url": "https://...",
        "is_active": true
      }
    }
  ],
  "count": 1
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or missing authentication
- `404 Not Found`: Team not found or not in user's organization
- `500 Internal Server Error`: Database error

### Assign Staff to Team

Add one or more staff members to a team.

**Endpoint:** `POST /api/teams/:teamId/members`

**Authentication:** Required (organization-scoped)

**Request Body (Single):**
```json
{
  "staff_id": "staff-uuid-001",
  "role": "Lead Developer"
}
```

**Request Body (Multiple):**
```json
{
  "members": [
    {
      "staff_id": "staff-uuid-001",
      "role": "Lead Developer"
    },
    {
      "staff_id": "staff-uuid-002",
      "role": "Designer"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "member-uuid-001",
      "team_id": "team-uuid-001",
      "staff_id": "staff-uuid-001",
      "role": "Lead Developer",
      "created_at": "2024-01-22T12:00:00Z",
      "updated_at": "2024-01-22T12:00:00Z",
      "staff": {
        "id": "staff-uuid-001",
        "name": "John Doe",
        "title": "Senior Developer"
      }
    }
  ],
  "count": 1
}
```

**Validation Rules:**
- `staff_id`: Required, must exist in organization
- `role`: Optional, max 100 characters
- Duplicate (team_id, staff_id) rejected

**Error Responses:**
- `400 Bad Request`: Validation error (invalid staff_id, duplicate assignment)
- `401 Unauthorized`: Invalid or missing authentication
- `404 Not Found`: Team or staff not found or not in user's organization
- `500 Internal Server Error`: Database error

### Update Team Member Role

Update the role of a team member.

**Endpoint:** `PATCH /api/teams/:teamId/members/:memberId`

**Authentication:** Required (organization-scoped)

**Request Body:**
```json
{
  "role": "Senior Developer"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "member-uuid-001",
    "team_id": "team-uuid-001",
    "staff_id": "staff-uuid-001",
    "role": "Senior Developer",
    "updated_at": "2024-01-22T13:00:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Validation error
- `401 Unauthorized`: Invalid or missing authentication
- `404 Not Found`: Team member not found or not in user's organization
- `500 Internal Server Error`: Database error

### Remove Staff from Team

Remove a staff member from a team.

**Endpoint:** `DELETE /api/teams/:teamId/members/:memberId`

**Authentication:** Required (organization-scoped)

**Request Example:**
```http
DELETE /api/teams/team-uuid-001/members/member-uuid-001
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Team member removed successfully"
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or missing authentication
- `404 Not Found`: Team member not found or not in user's organization
- `500 Internal Server Error`: Database error

## Project Assignment Endpoints

### Get Team Projects

Get all projects assigned to a team.

**Endpoint:** `GET /api/teams/:teamId/projects`

**Authentication:** Required (organization-scoped)

**Request Example:**
```http
GET /api/teams/team-uuid-001/projects
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "project-uuid-001",
      "name": "Website Redesign",
      "status": "Open",
      "team_id": "team-uuid-001",
      "customer_id": "customer-uuid-001"
    }
  ],
  "count": 1
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or missing authentication
- `404 Not Found`: Team not found or not in user's organization
- `500 Internal Server Error`: Database error

### Assign Project to Team

Assign a project to a team.

**Endpoint:** `PATCH /api/projects/:projectId`

**Authentication:** Required (organization-scoped)

**Request Body:**
```json
{
  "team_id": "team-uuid-001"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "project-uuid-001",
    "name": "Website Redesign",
    "team_id": "team-uuid-001",
    "updated_at": "2024-01-22T14:00:00Z"
  }
}
```

**Validation Rules:**
- `team_id`: Must be valid team ID in same organization, or null to remove

**Error Responses:**
- `400 Bad Request`: Invalid team_id
- `401 Unauthorized`: Invalid or missing authentication
- `404 Not Found`: Project or team not found or not in user's organization
- `500 Internal Server Error`: Database error

### Remove Project from Team

Remove a project from its assigned team.

**Endpoint:** `PATCH /api/projects/:projectId`

**Authentication:** Required (organization-scoped)

**Request Body:**
```json
{
  "team_id": null
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "project-uuid-001",
    "name": "Website Redesign",
    "team_id": null,
    "updated_at": "2024-01-22T15:00:00Z"
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or missing authentication
- `404 Not Found`: Project not found or not in user's organization
- `500 Internal Server Error`: Database error

## Statistics and Aggregation Endpoints

### Get Team Statistics

Get aggregated statistics for a team.

**Endpoint:** `GET /api/teams/:teamId/stats`

**Authentication:** Required (organization-scoped)

**Request Example:**
```http
GET /api/teams/team-uuid-001/stats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "team_id": "team-uuid-001",
    "total_members": 5,
    "total_projects": 12,
    "active_projects": 8,
    "completed_projects": 4,
    "total_tasks": 145,
    "completed_tasks": 89
  }
}
```

**Calculated Fields:**
- `total_members`: COUNT of team_members for this team
- `total_projects`: COUNT of projects with this team_id
- `active_projects`: COUNT of projects where status = 'Open'
- `completed_projects`: COUNT of projects where status = 'Closed'
- `total_tasks`: COUNT of tasks belonging to team's projects
- `completed_tasks`: COUNT of completed tasks in team's projects

**Error Responses:**
- `401 Unauthorized`: Invalid or missing authentication
- `404 Not Found`: Team not found or not in user's organization
- `500 Internal Server Error`: Database error

## Database RPC Functions

These PostgreSQL functions can be called directly via Supabase RPC or used internally by API endpoints.

### rpc_get_team_statistics

Get comprehensive team statistics.

**Function Signature:**
```sql
rpc_get_team_statistics(
  p_team_id UUID,
  p_organization_id UUID
) RETURNS JSON
```

**Usage Example (Supabase JS):**
```javascript
const { data, error } = await supabase
  .rpc('rpc_get_team_statistics', {
    p_team_id: 'team-uuid-001',
    p_organization_id: 'org-uuid'
  });
```

**Returns:**
```json
{
  "team_id": "team-uuid-001",
  "total_members": 5,
  "total_projects": 12,
  "active_projects": 8,
  "completed_projects": 4,
  "total_tasks": 145,
  "completed_tasks": 89
}
```

**Implementation:**
```sql
CREATE OR REPLACE FUNCTION rpc_get_team_statistics(
  p_team_id UUID,
  p_organization_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stats JSON;
BEGIN
  -- Verify organization access
  IF NOT EXISTS (
    SELECT 1 FROM teams
    WHERE id = p_team_id AND organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'Team not found or access denied';
  END IF;

  -- Calculate statistics
  SELECT json_build_object(
    'team_id', p_team_id,
    'total_members', (
      SELECT COUNT(*) FROM team_members
      WHERE team_id = p_team_id
    ),
    'total_projects', (
      SELECT COUNT(*) FROM projects
      WHERE team_id = p_team_id
    ),
    'active_projects', (
      SELECT COUNT(*) FROM projects
      WHERE team_id = p_team_id AND status = 'Open'
    ),
    'completed_projects', (
      SELECT COUNT(*) FROM projects
      WHERE team_id = p_team_id AND status = 'Closed'
    ),
    'total_tasks', (
      SELECT COUNT(*) FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE p.team_id = p_team_id
    ),
    'completed_tasks', (
      SELECT COUNT(*) FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE p.team_id = p_team_id AND t.completed = true
    )
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;
```

### rpc_assign_staff_to_team_bulk

Assign multiple staff members to a team in a single transaction.

**Function Signature:**
```sql
rpc_assign_staff_to_team_bulk(
  p_team_id UUID,
  p_organization_id UUID,
  p_members JSONB
) RETURNS JSON
```

**Usage Example:**
```javascript
const { data, error } = await supabase
  .rpc('rpc_assign_staff_to_team_bulk', {
    p_team_id: 'team-uuid-001',
    p_organization_id: 'org-uuid',
    p_members: [
      { staff_id: 'staff-uuid-001', role: 'Lead' },
      { staff_id: 'staff-uuid-002', role: 'Member' }
    ]
  });
```

**Returns:**
```json
{
  "success": true,
  "added": 2,
  "members": [
    {
      "id": "member-uuid-001",
      "team_id": "team-uuid-001",
      "staff_id": "staff-uuid-001",
      "role": "Lead"
    }
  ]
}
```

## Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Team name is required",
    "details": {
      "field": "name",
      "constraint": "not_null"
    }
  }
}
```

### Error Codes

- `VALIDATION_ERROR`: Request validation failed
- `NOT_FOUND`: Resource not found
- `UNAUTHORIZED`: Missing or invalid authentication
- `FORBIDDEN`: User lacks permission for this operation
- `DUPLICATE`: Unique constraint violation
- `DATABASE_ERROR`: Internal database error

## Rate Limiting

All endpoints subject to rate limiting:
- **Limit:** 100 requests per minute per organization
- **Header:** `X-RateLimit-Remaining`
- **Response on exceed:** `429 Too Many Requests`

## Backend Change Request

See `BACKEND_CHANGE_REQUEST_001_TEAMS_MIGRATION.md` for complete backend implementation requirements including:
- Database schema SQL
- RPC function implementations
- RLS policies
- Migration scripts
- Testing requirements

---

**Related Documents:**
- `data-model-mapping.md`: Database schema details
- `authorization.md`: RLS policies and permissions
- `current-implementation.md`: Current FileMaker API usage
- `BACKEND_CHANGE_REQUEST_001_TEAMS_MIGRATION.md`: Backend implementation spec
