# API Contracts

This document defines the required backend endpoints/RPCs for the Projects feature migration to Supabase, including request/response formats, validation rules, and business logic requirements.

## Overview

All endpoints should be implemented as Supabase RPC functions or backend API endpoints with HMAC authentication. The frontend will call these through the backend API proxy.

**Base URL**: `https://api.claritybusinesssolutions.ca`

**Authentication**: HMAC-SHA256 (handled by `dataService.generateBackendAuthHeader()`)

## ⚠️ Current Schema Status (Verified 2025-01-10)

**Existing Tables** (✅ Ready):
- `projects` - Main projects table with customer relationship
- `links` - Shared links table (supports project_id, customer_id, organization_id)

**Missing Tables** (❌ Require Backend Changes):
- `project_objectives` - NOT CREATED (see data-model-mapping.md for proposed schema)
- `project_objective_steps` - NOT CREATED (see data-model-mapping.md for proposed schema)
- `project_images` - NOT CREATED (see data-model-mapping.md for proposed schema)
- `notes` - NOT CREATED (see data-model-mapping.md for proposed schema)

**Schema Gaps in Existing Tables**:
- `projects` table missing: `team_id`, `is_fixed_price`, `is_subscription`, `organization_id`, `time_estimate`
- `links` table missing: `title` column (frontend derives from URL hostname)

**Implications**:
- Endpoints 7-17 (objectives/steps) require `project_objectives` and `project_objective_steps` tables to be created first
- Endpoints 18-19 (images) require `project_images` table to be created first
- Notes functionality requires `notes` table to be created first
- Core project operations (endpoints 1-6) can be implemented with current schema BUT have limited fields

## Core Project Operations

### 1. List Projects by Customer

**Endpoint**: `POST /rpc/get_projects_by_customer`

**Description**: Fetch all projects for a specific customer, with optional filtering

**Current Schema** (Verified fields from Supabase projects table):
- ✅ `id`, `customer_id`, `name`, `description`, `status`, `start_date`, `target_end_date`, `actual_end_date`
- ✅ `budget`, `github_repo_url`, `project_link`, `created_at`, `updated_at`, `created_by`
- ❌ Missing: `team_id`, `organization_id`, `time_estimate`, `is_fixed_price`, `is_subscription`

**Request**:
```json
{
  "customer_id": "uuid-customer-123",
  "include_related": false,
  "status_filter": null
}
```

**Response** (Based on ACTUAL Supabase schema):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-project-456",
      "name": "Website Redesign",
      "customer_id": "uuid-customer-123",
      "description": "Complete overhaul of corporate website",
      "status": "active",
      "start_date": "2024-01-15",
      "target_end_date": "2024-03-31",
      "actual_end_date": null,
      "budget": 5000.00,
      "github_repo_url": "https://github.com/client/website",
      "project_link": "https://example.com",
      "created_at": "2024-01-10T10:00:00Z",
      "updated_at": "2024-01-15T14:30:00Z",
      "created_by": "user@example.com"
    }
  ]
}
```

**Field Mapping** (FileMaker → Supabase):
- `projectName` → `name`
- `_custID` → `customer_id`
- `status` ("Open"/"Active"/"On Hold"/"Completed"/"Cancelled") → `status` ("active"/"pending"/"on_hold"/"completed"/"cancelled")
- `dateStart` → `start_date`
- `dateEnd` → `target_end_date`
- `value` → `budget` (stored in budget field, pricing logic handled via customer_sales table)
- `estOfTime` → ❌ NOT IN SCHEMA (requires backend change to add `time_estimate` column)
- `_teamID` → ❌ NOT IN SCHEMA (requires backend change to add `team_id` column)
- `f_fixedPrice`, `f_subscription` → ❌ NOT IN SCHEMA (pricing logic handled via customer_sales table)

**Validation**:
- `customer_id` required (VARCHAR(255) format - accepts UUIDs or text IDs)
- User must have access to customer's organization (organization_id must be derived from customer relationship)
- Status filter (if provided) must be valid: "active", "pending", "on_hold", "completed", "cancelled"

**Errors**:
- 400: Invalid customer_id format
- 403: User not authorized for customer's organization
- 404: Customer not found

---

### 2. Get Project Detail

**Endpoint**: `POST /rpc/get_project_detail`

**Description**: Fetch complete project details with optionally all related data

**⚠️ Implementation Status**:
- ✅ Project base data: Available with current schema
- ❌ Objectives/Steps: Requires `project_objectives` and `project_objective_steps` tables
- ❌ Images: Requires `project_images` table
- ✅ Links: Available (using existing `links` table with `project_id` filter)
- ❌ Notes: Requires `notes` table
- ❌ Stats: Requires objectives/steps tables for calculation

**Request**:
```json
{
  "project_id": "uuid-project-456",
  "include_objectives": true,
  "include_images": true,
  "include_links": true,
  "include_notes": true,
  "include_time_records": false
}
```

**Response** (Based on ACTUAL Supabase schema - limited by missing tables):
```json
{
  "success": true,
  "data": {
    "project": {
      "id": "uuid-project-456",
      "name": "Website Redesign",
      "customer_id": "uuid-customer-123",
      "description": "Complete overhaul of corporate website",
      "status": "active",
      "start_date": "2024-01-15",
      "target_end_date": "2024-03-31",
      "actual_end_date": null,
      "budget": 5000.00,
      "github_repo_url": "https://github.com/client/website",
      "project_link": "https://example.com",
      "created_at": "2024-01-10T10:00:00Z",
      "updated_at": "2024-01-15T14:30:00Z",
      "created_by": "user@example.com"
    },
    "objectives": [],
    "images": [],
    "links": [
      {
        "id": "uuid-link-123",
        "project_id": "uuid-project-456",
        "customer_id": "uuid-customer-123",
        "organization_id": "uuid-org-001",
        "link": "https://github.com/client/website",
        "created_at": "2024-01-10T11:00:00Z",
        "updated_at": "2024-01-10T11:00:00Z"
      }
    ],
    "notes": [],
    "stats": {
      "completion_percentage": 0,
      "total_objectives": 0,
      "completed_objectives": 0,
      "total_steps": 0,
      "completed_steps": 0
    }
  }
}
```

**Notes**:
- `objectives` will be empty array until `project_objectives` table is created
- `images` will be empty array until `project_images` table is created
- `links` CAN be populated using existing `links` table (filter by `project_id`)
- `notes` will be empty array until `notes` table is created
- `stats` will show zeros until objectives/steps data is available
- Frontend currently derives link titles from URL hostname (links table has no `title` column)

**Validation**:
- `project_id` required (UUID format)
- User must have access to project's organization (derived from customer relationship)

**Errors**:
- 400: Invalid project_id format
- 403: User not authorized for project's organization
- 404: Project not found

---

### 3. Create Project

**Endpoint**: `POST /rpc/create_project`

**Description**: Create a new project with automatic business logic execution (fixed-price or subscription sales generation)

**⚠️ Schema Limitations**:
- ❌ `team_id`: NOT in current schema (requires backend change to add column)
- ❌ `organization_id`: NOT in current schema (must be derived from customer or requires backend change)
- ❌ `time_estimate`: NOT in current schema (requires backend change to add column)
- ❌ `is_fixed_price`, `is_subscription`: NOT in current schema (pricing logic uses `customer_sales` table instead)
- ✅ `budget`: Can store project value (maps to FileMaker `value` field)
- ✅ `github_repo_url`, `project_link`: Available for storing URLs

**Request** (Based on ACTUAL available fields):
```json
{
  "name": "Mobile App Development",
  "customer_id": "uuid-customer-123",
  "description": "iOS and Android mobile application",
  "status": "pending",
  "budget": 15000.00,
  "start_date": "2024-02-01",
  "target_end_date": "2024-05-31",
  "github_repo_url": "https://github.com/client/mobile-app",
  "project_link": "https://app.example.com",
  "created_by": "user@example.com"
}
```

**Response** (Based on ACTUAL Supabase schema):
```json
{
  "success": true,
  "data": {
    "project": {
      "id": "uuid-project-new",
      "name": "Mobile App Development",
      "customer_id": "uuid-customer-123",
      "description": "iOS and Android mobile application",
      "status": "pending",
      "budget": 15000.00,
      "start_date": "2024-02-01",
      "target_end_date": "2024-05-31",
      "actual_end_date": null,
      "github_repo_url": "https://github.com/client/mobile-app",
      "project_link": "https://app.example.com",
      "created_at": "2024-01-20T10:00:00Z",
      "updated_at": "2024-01-20T10:00:00Z",
      "created_by": "user@example.com"
    },
    "sales_entries_created": []
  }
}
```

**Validation**:
- `name` required, non-empty string, max 255 chars (VARCHAR(255) constraint)
- `customer_id` required (VARCHAR(255) - accepts UUIDs or text IDs), must exist and user must have access
- `description` optional, TEXT type (no length limit)
- `status` must be one of: "active", "pending", "on_hold", "completed", "cancelled" (CHECK constraint)
- `budget` optional, DECIMAL(10,2) - max value 99,999,999.99
- Dates must be valid YYYY-MM-DD format (DATE type)
- `target_end_date` must be >= `start_date` if both provided
- `github_repo_url`, `project_link` must be valid URLs if provided (TEXT type, no length limit)

**Business Logic** (Fixed-Price/Subscription - REQUIRES CUSTOM IMPLEMENTATION):
- Current Supabase schema does NOT have `is_fixed_price` or `is_subscription` flags
- Pricing logic must be handled separately via `customer_sales` table
- Frontend code (projectService.js:508-596) expects pricing flags but they don't exist in DB
- **OPTION 1**: Add pricing flags to projects table (backend change request)
- **OPTION 2**: Use convention (e.g., if budget > 0 and start_date exists, treat as fixed-price)
- **OPTION 3**: Store pricing metadata in JSONB column (backend change request)
- See "Business Logic Requirements" section for detailed pricing logic

**Errors**:
- 400: Validation failure (name missing, invalid status, invalid dates, etc.)
- 403: User not authorized for customer's organization
- 404: Customer not found
- 422: Status CHECK constraint violation (invalid status value)

---

### 4. Update Project

**Endpoint**: `POST /rpc/update_project`

**Description**: Update project fields, with automatic business logic re-execution if pricing fields change

**Request**:
```json
{
  "project_id": "uuid-project-456",
  "name": "Website Redesign (Phase 2)",
  "status": "Active",
  "description": "Updated scope with additional features",
  "end_date": "2024-04-30"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "project": {
      "id": "uuid-project-456",
      "name": "Website Redesign (Phase 2)",
      "customer_id": "uuid-customer-123",
      "team_id": "uuid-team-789",
      "organization_id": "uuid-org-001",
      "status": "Active",
      "description": "Updated scope with additional features",
      "time_estimate": "40h",
      "value": 5000.00,
      "is_fixed_price": true,
      "is_subscription": false,
      "start_date": "2024-01-15",
      "end_date": "2024-04-30",
      "created_at": "2024-01-10T10:00:00Z",
      "updated_at": "2024-01-22T11:30:00Z"
    },
    "sales_entries_created": []
  }
}
```

**Validation**:
- `project_id` required (UUID format)
- Same validation rules as create for updated fields
- Cannot change `customer_id` or `organization_id`
- Cannot change pricing type (fixed-price → subscription or vice versa) without explicit confirmation

**Business Logic**:
- If `is_fixed_price` or `is_subscription` changed: Re-run sales generation logic
- If `value`, `start_date`, or `end_date` changed: May trigger new sales entries
- Idempotent: Don't duplicate existing sales entries

**Errors**:
- 400: Validation failure
- 403: User not authorized for project's organization
- 404: Project not found
- 422: Cannot change pricing type, cannot change customer_id

---

### 5. Delete Project

**Endpoint**: `POST /rpc/delete_project`

**Description**: Delete project and all related data (objectives, steps, images, links, notes) with cascading deletes

**Request**:
```json
{
  "project_id": "uuid-project-456",
  "confirm": true
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "project_id": "uuid-project-456",
    "deleted_related_records": {
      "objectives": 4,
      "steps": 12,
      "images": 3,
      "links": 5,
      "notes": 8
    }
  }
}
```

**Validation**:
- `project_id` required (UUID format)
- `confirm` must be true (safety check)
- User must have delete permission for project's organization

**Business Logic**:
- Cascade delete objectives, steps, images, links, notes
- SET NULL on time_records.project_id (preserve time records but remove project association)
- Optionally: Delete sales entries created by this project (if identified by project_id)

**Errors**:
- 400: Validation failure, confirm not true
- 403: User not authorized to delete project
- 404: Project not found

---

### 6. Update Project Status

**Endpoint**: `POST /rpc/update_project_status`

**Description**: Update project status with optional status-specific business logic

**Request**:
```json
{
  "project_id": "uuid-project-456",
  "status": "Completed"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "project": {
      "id": "uuid-project-456",
      "status": "Completed",
      "updated_at": "2024-03-31T16:00:00Z"
    },
    "sales_entries_created": [
      {
        "id": "uuid-sale-002",
        "customer_id": "uuid-customer-123",
        "amount": 2500.00,
        "date": "2024-03-31",
        "description": "Fixed price project (Website Redesign) - 50% on completion",
        "type": "sales"
      }
    ]
  }
}
```

**Validation**:
- `project_id` required (UUID format)
- `status` required, must be one of: "Open", "Planning", "Active", "On Hold", "Completed", "Cancelled"
- User must have edit permission for project's organization

**Business Logic**:
- If status changes to "Completed" and `is_fixed_price = true`: Create final 50% sales entry
- If status changes to "Cancelled": Optionally handle refunds or reversals
- Status transitions may affect billable hours calculations

**Errors**:
- 400: Invalid status value
- 403: User not authorized to update project
- 404: Project not found

---

## Objectives and Steps Operations

### 7. List Objectives by Project

**Endpoint**: `POST /rpc/get_project_objectives`

**Description**: Fetch all objectives for a project with optional steps

**Request**:
```json
{
  "project_id": "uuid-project-456",
  "include_steps": true
}
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-obj-123",
      "project_id": "uuid-project-456",
      "objective": "Complete homepage design",
      "status": "Open",
      "order_num": 1,
      "completed": false,
      "created_at": "2024-01-10T10:05:00Z",
      "updated_at": "2024-01-10T10:05:00Z",
      "steps": [
        {
          "id": "uuid-step-789",
          "objective_id": "uuid-obj-123",
          "step": "Create wireframes",
          "order_num": 1,
          "completed": true,
          "created_at": "2024-01-10T10:06:00Z",
          "updated_at": "2024-01-12T09:00:00Z"
        }
      ]
    }
  ]
}
```

**Validation**:
- `project_id` required (UUID format)
- User must have access to project's organization

**Errors**:
- 400: Invalid project_id format
- 403: User not authorized
- 404: Project not found

---

### 8. Create Objective

**Endpoint**: `POST /rpc/create_project_objective`

**Description**: Create a new objective for a project

**Request**:
```json
{
  "project_id": "uuid-project-456",
  "objective": "Implement payment gateway integration",
  "status": "Open",
  "order_num": 5
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid-obj-new",
    "project_id": "uuid-project-456",
    "objective": "Implement payment gateway integration",
    "status": "Open",
    "order_num": 5,
    "completed": false,
    "created_at": "2024-01-22T14:00:00Z",
    "updated_at": "2024-01-22T14:00:00Z"
  }
}
```

**Validation**:
- `project_id` required, must exist
- `objective` required, non-empty string, max 500 chars
- `order_num` optional, defaults to max(existing orders) + 1
- User must have edit permission for project's organization

**Errors**:
- 400: Validation failure
- 403: User not authorized
- 404: Project not found

---

### 9. Update Objective

**Endpoint**: `POST /rpc/update_project_objective`

**Description**: Update objective fields

**Request**:
```json
{
  "objective_id": "uuid-obj-123",
  "objective": "Complete homepage design (revised)",
  "status": "In Progress",
  "completed": false
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid-obj-123",
    "project_id": "uuid-project-456",
    "objective": "Complete homepage design (revised)",
    "status": "In Progress",
    "order_num": 1,
    "completed": false,
    "created_at": "2024-01-10T10:05:00Z",
    "updated_at": "2024-01-22T15:00:00Z"
  }
}
```

**Validation**:
- `objective_id` required (UUID format)
- Same validation as create for updated fields

**Errors**:
- 400: Validation failure
- 403: User not authorized
- 404: Objective not found

---

### 10. Delete Objective

**Endpoint**: `POST /rpc/delete_project_objective`

**Description**: Delete objective and all its steps (cascade)

**Request**:
```json
{
  "objective_id": "uuid-obj-123"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "objective_id": "uuid-obj-123",
    "deleted_steps": 3
  }
}
```

**Validation**:
- `objective_id` required (UUID format)
- User must have delete permission for project's organization

**Errors**:
- 400: Invalid objective_id
- 403: User not authorized
- 404: Objective not found

---

### 11. Toggle Objective Completion

**Endpoint**: `POST /rpc/toggle_objective_completion`

**Description**: Toggle objective completed flag

**Request**:
```json
{
  "objective_id": "uuid-obj-123",
  "completed": true
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid-obj-123",
    "completed": true,
    "updated_at": "2024-01-22T16:00:00Z"
  }
}
```

**Errors**:
- 400: Invalid objective_id
- 403: User not authorized
- 404: Objective not found

---

### 12. Reorder Objectives

**Endpoint**: `POST /rpc/reorder_project_objectives`

**Description**: Update order of objectives within a project

**Request**:
```json
{
  "project_id": "uuid-project-456",
  "objective_orders": [
    { "objective_id": "uuid-obj-123", "order_num": 1 },
    { "objective_id": "uuid-obj-456", "order_num": 2 },
    { "objective_id": "uuid-obj-789", "order_num": 3 }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "updated_count": 3
  }
}
```

**Validation**:
- `project_id` required
- `objective_orders` required, non-empty array
- All objectives must belong to specified project
- Order numbers should be unique and sequential (not enforced)

**Errors**:
- 400: Validation failure, objectives don't belong to project
- 403: User not authorized
- 404: Project or objective not found

---

### 13. List Steps by Objective

**Endpoint**: `POST /rpc/get_objective_steps`

**Description**: Fetch all steps for a specific objective, ordered by order_num

**Request**:
```json
{
  "objective_id": "uuid-obj-123"
}
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-step-789",
      "objective_id": "uuid-obj-123",
      "step": "Create wireframes",
      "order_num": 1,
      "completed": true,
      "created_at": "2024-01-10T10:06:00Z",
      "updated_at": "2024-01-12T09:00:00Z"
    },
    {
      "id": "uuid-step-456",
      "objective_id": "uuid-obj-123",
      "step": "Get client approval on wireframes",
      "order_num": 2,
      "completed": false,
      "created_at": "2024-01-10T10:07:00Z",
      "updated_at": "2024-01-10T10:07:00Z"
    }
  ]
}
```

**Validation**:
- `objective_id` required (UUID format)
- User must have access to project's organization (derived from objective → project → customer relationship)

**Errors**:
- 400: Invalid objective_id format
- 403: User not authorized
- 404: Objective not found

**Notes**:
- Results ordered by `order_num ASC` by default
- Returns empty array if objective has no steps
- Can also retrieve steps via endpoint 7 (get_project_objectives) with `include_steps: true`

---

### 14. Create Objective Step

**Endpoint**: `POST /rpc/create_objective_step`

**Description**: Create a new step within an objective

**Request**:
```json
{
  "objective_id": "uuid-obj-123",
  "step": "Get client approval on wireframes",
  "order_num": 2
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid-step-new",
    "objective_id": "uuid-obj-123",
    "step": "Get client approval on wireframes",
    "order_num": 2,
    "completed": false,
    "created_at": "2024-01-22T17:00:00Z",
    "updated_at": "2024-01-22T17:00:00Z"
  }
}
```

**Validation**:
- `objective_id` required, must exist
- `step` required, non-empty string, max 500 chars
- `order_num` optional, defaults to max(existing orders) + 1

**Errors**:
- 400: Validation failure
- 403: User not authorized
- 404: Objective not found

---

### 15. Update Objective Step

**Endpoint**: `POST /rpc/update_objective_step`

**Description**: Update step fields

**Request**:
```json
{
  "step_id": "uuid-step-789",
  "step": "Create high-fidelity wireframes",
  "completed": true
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid-step-789",
    "objective_id": "uuid-obj-123",
    "step": "Create high-fidelity wireframes",
    "order_num": 1,
    "completed": true,
    "created_at": "2024-01-10T10:06:00Z",
    "updated_at": "2024-01-22T17:30:00Z"
  }
}
```

**Errors**:
- 400: Validation failure
- 403: User not authorized
- 404: Step not found

---

### 16. Delete Objective Step

**Endpoint**: `POST /rpc/delete_objective_step`

**Description**: Delete a step

**Request**:
```json
{
  "step_id": "uuid-step-789"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "step_id": "uuid-step-789"
  }
}
```

**Errors**:
- 400: Invalid step_id
- 403: User not authorized
- 404: Step not found

---

### 17. Toggle Step Completion

**Endpoint**: `POST /rpc/toggle_step_completion`

**Description**: Toggle step completed flag

**Request**:
```json
{
  "step_id": "uuid-step-789",
  "completed": true
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid-step-789",
    "completed": true,
    "updated_at": "2024-01-22T18:00:00Z"
  }
}
```

**Errors**:
- 400: Invalid step_id
- 403: User not authorized
- 404: Step not found

---

### 18. Reorder Objective Steps

**Endpoint**: `POST /rpc/reorder_objective_steps`

**Description**: Update order of steps within an objective

**Request**:
```json
{
  "objective_id": "uuid-obj-123",
  "step_orders": [
    { "step_id": "uuid-step-789", "order_num": 1 },
    { "step_id": "uuid-step-456", "order_num": 2 }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "updated_count": 2
  }
}
```

**Errors**:
- 400: Validation failure, steps don't belong to objective
- 403: User not authorized
- 404: Objective or step not found

---

## Images, Links, and Notes Operations

### 19. Create Project Image

**Endpoint**: `POST /rpc/create_project_image`

**Request**:
```json
{
  "project_id": "uuid-project-456",
  "url": "https://example.com/mockup.png",
  "title": "Homepage Mockup",
  "description": "Initial design concept"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid-img-new",
    "project_id": "uuid-project-456",
    "url": "https://example.com/mockup.png",
    "title": "Homepage Mockup",
    "description": "Initial design concept",
    "created_at": "2024-01-22T19:00:00Z",
    "updated_at": "2024-01-22T19:00:00Z"
  }
}
```

**Validation**:
- `project_id` required
- `url` required, must be valid URL format

**Errors**: 400, 403, 404

---

### 20. Delete Project Image

**Endpoint**: `POST /rpc/delete_project_image`

**Request**:
```json
{
  "image_id": "uuid-img-123"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "image_id": "uuid-img-123"
  }
}
```

**Errors**: 400, 403, 404

---

### 21. Create Project Link

**Endpoint**: `POST /rpc/create_project_link`

**Request**:
```json
{
  "project_id": "uuid-project-456",
  "url": "https://github.com/client/repo",
  "title": "GitHub Repository"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid-link-new",
    "project_id": "uuid-project-456",
    "url": "https://github.com/client/repo",
    "title": "GitHub Repository",
    "created_at": "2024-01-22T20:00:00Z",
    "updated_at": "2024-01-22T20:00:00Z"
  }
}
```

**Validation**:
- `project_id` required
- `url` required, must be valid URL format
- `title` optional, derived from URL if not provided

**Errors**: 400, 403, 404

---

### 22. Delete Project Link

**Endpoint**: `POST /rpc/delete_project_link`

**Request**:
```json
{
  "link_id": "uuid-link-123"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "link_id": "uuid-link-123"
  }
}
```

**Errors**: 400, 403, 404

---

## Business Logic Requirements

### Fixed-Price Project Sales Generation

**Trigger**: Project creation or update with `is_fixed_price = true`

**Logic**:
1. Check if `start_date` exists and is <= today:
   - Create sales entry:
     - `customer_id`: from project
     - `amount`: `value / 2`
     - `date`: `start_date`
     - `description`: "Fixed price project ({project.name}) - 50% on start"
     - `type`: "sellable"
     - `project_id`: project UUID
   - **Idempotency**: Check if sales entry already exists for this project + date + type before creating

2. Check if `end_date` exists and is <= today:
   - Create sales entry:
     - `customer_id`: from project
     - `amount`: `value / 2`
     - `date`: `end_date`
     - `description`: "Fixed price project ({project.name}) - 50% on completion"
     - `type`: "sales"
     - `project_id`: project UUID
   - **Idempotency**: Check if sales entry already exists for this project + date + type before creating

3. Update all time records for project:
   - Set `is_billed = false` (fixed-price projects have non-billable hours)
   - Note: This may be handled separately via time tracking system

**Edge Cases**:
- If `start_date` is in the future: Do NOT create sales entry yet (requires background job or manual trigger)
- If `end_date` is in the future: Do NOT create final sales entry yet
- If project value changes: Re-calculate sales entries (may require manual adjustment or versioning)
- If project changes from fixed-price to non-fixed-price: Handle existing sales entries (reverse? leave?)

---

### Subscription Project Sales Generation

**Trigger**: Project creation or update with `is_subscription = true`

**Logic**:
1. Validate: `start_date` is required for subscription projects
2. Calculate months between `start_date` and today (or `end_date` if set and < today):
   ```
   months = 0
   currentDate = start_date
   while currentDate <= min(today, end_date):
       if currentDate.day == start_date.day:
           months++
       currentDate = currentDate + 1 month
   ```
3. For each month (0 to months):
   - Calculate monthDate = `start_date + i months`
   - Skip if monthDate > `end_date` (if end_date is set)
   - Create sales entry:
     - `customer_id`: from project
     - `amount`: `value`
     - `date`: monthDate (first day of billing period)
     - `description`: "Subscription project ({project.name}) - Month {i+1}"
     - `type`: "sales"
     - `project_id`: project UUID
   - **Idempotency**: Check if sales entry already exists for this project + date before creating

**Edge Cases**:
- If `start_date` is in the future: Do NOT create any sales entries yet
- If no `end_date`: Subscription is perpetual, generate entries up to today only (requires monthly background job to continue)
- If `end_date` is updated: Generate new entries for extended period, or stop generating if shortened
- If project value changes: Future entries use new value, past entries remain unchanged (or require manual adjustment)

**Background Job Requirement**:
- Monthly cron job to generate new subscription sales entries for active subscription projects
- Query all projects where `is_subscription = true` and (`end_date IS NULL` OR `end_date >= today`)
- For each project, check if sales entry exists for current month, create if not

---

### Team Assignment

**Endpoint**: `POST /rpc/update_project_team`

**Description**: Update project team assignment

**Request**:
```json
{
  "project_id": "uuid-project-456",
  "team_id": "uuid-team-new"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "project_id": "uuid-project-456",
    "team_id": "uuid-team-new",
    "updated_at": "2024-01-22T21:00:00Z"
  }
}
```

**Validation**:
- `project_id` required
- `team_id` can be null (remove team assignment) or valid team UUID
- If team_id provided, team must exist and belong to same organization as project

**Errors**:
- 400: Validation failure, team not in same organization
- 403: User not authorized
- 404: Project or team not found

---

## Error Response Format

All errors follow standard format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Project name is required",
    "details": {
      "field": "name",
      "constraint": "required"
    }
  }
}
```

**Error Codes**:
- `VALIDATION_ERROR`: Input validation failure
- `AUTHORIZATION_ERROR`: User not authorized
- `NOT_FOUND`: Resource not found
- `BUSINESS_LOGIC_ERROR`: Business rule violation
- `CONFLICT`: Duplicate or conflicting data
- `INTERNAL_ERROR`: Server error

---

## Performance Requirements

- List projects by customer: < 500ms (for customers with < 100 projects)
- Get project detail with all related data: < 1s
- Create/update/delete operations: < 200ms (excluding business logic)
- Business logic execution (sales generation): < 500ms (should be async if possible)

---

## Pagination and Filtering (Future Enhancement)

Current implementation returns all records. Future API should support:
- Pagination: `limit`, `offset` parameters
- Filtering: Status, date range, team, pricing type
- Sorting: By name, status, start_date, created_at
- Search: Full-text search on project name and description

---

## Implementation Notes

### UUID Handling

**FileMaker → Supabase Migration**:
- FileMaker uses `__ID` field (UUID) as primary identifier
- Supabase uses `id` field (UUID) as primary key
- **CRITICAL**: Preserve UUIDs during migration (`__ID` → `id`, same value)
- FileMaker `recordId` (internal FileMaker ID) is DISCARDED - not needed in Supabase

**UUID Generation**:
- FileMaker: UUID generated by FileMaker or frontend before create (src/hooks/useProject.js:200)
- Supabase: UUID auto-generated by `gen_random_uuid()` if not provided
- **Frontend Practice**: Generate UUID client-side before calling create endpoint
  ```javascript
  import { v4 as uuidv4 } from 'uuid';
  const projectId = uuidv4();
  ```

**Foreign Key Relationships**:
- All relationship fields use UUIDs (customer_id, project_id, objective_id, etc.)
- Supabase enforces foreign key constraints (FileMaker does not)
- Invalid UUIDs will cause insertion failures (404 errors)

### Code References

**Frontend Services** (src/services/):
- `projectService.js` - Business logic and data processing
  - Line 25-56: `processProjectData()` - Processes FileMaker responses
  - Line 213-259: `validateProjectData()` - Validation rules
  - Line 508-596: `processProjectValue()` - Fixed-price/subscription business logic
  - Line 292-305: `formatProjectForFileMaker()` - Data formatting for FileMaker API

**Frontend API Layer** (src/api/):
- `projects.js` - FileMaker API calls
  - Line 8-20: `deleteProject()` - Delete operation
  - Line 27-38: `fetchProjectsForCustomer()` - List by customer
  - Line 47-59: `fetchProjectNotes()` - Fetch project notes
  - Line 61-84: `fetchProjectRelatedData()` - Objectives, steps, images, links
  - Line 92-104: `updateProjectStatus()` - Status update
  - Line 112-124: `createProject()` - Create new project
  - Line 132-144: `updateProject()` - Update project
  - Line 152-172: `fetchAllProjectData()` - Fetch complete project with all related data

**Frontend Hooks** (src/hooks/):
- `useProject.js` - React hook for project operations
  - Line 91-128: `loadProjectDetails()` - Fetch project and related data
  - Line 186-264: `handleCreateProject()` - Create with dual-write (FileMaker + Supabase)
  - Line 315-415: `handleUpdateProject()` - Update with dual-write
  - Line 520-552: `addObjective()` - Create objective (FileMaker only currently)

**FileMaker Layouts** (Referenced in code):
- `devProjects` - Main projects table (src/api/fileMaker.js:413)
- `devProjectObjectives` - Objectives (src/api/fileMaker.js:414)
- `devProjectObjSteps` - Objective steps (src/api/fileMaker.js:415)
- `devProjectImages` - Project images (src/api/fileMaker.js:416)
- `devProjectLinks` - Project links (src/api/fileMaker.js:417)
- `devNotes` - Notes (polymorphic, src/api/fileMaker.js:418)
- `dapiRecords` - Time tracking (src/api/fileMaker.js:420)

### Status Value Mapping

**FileMaker → Supabase Conversion** (Code: src/hooks/useProject.js:222-232):

```javascript
const mapStatus = (fmStatus) => {
  const statusMap = {
    'Open': 'active',
    'Active': 'active',
    'Pending': 'pending',
    'On Hold': 'on_hold',
    'Completed': 'completed',
    'Complete': 'completed',
    'Closed': 'completed',
    'Cancelled': 'cancelled'
  };
  return statusMap[fmStatus] || 'active';
};
```

**Supabase CHECK Constraint**:
```sql
CHECK (status IN ('active', 'pending', 'on_hold', 'completed', 'cancelled'))
```

### Date Format Conversion

**FileMaker Format**: `MM/DD/YYYY` (e.g., "01/15/2024")
**Supabase Format**: `YYYY-MM-DD` (e.g., "2024-01-15")

**Conversion Functions** (Code: src/services/projectService.js:10-17, 289-305):

```javascript
// FileMaker → Supabase
function convertFromFileMakerDate(fmDate) {
  // Input: "01/15/2024"
  // Output: "2024-01-15"
  const [month, day, year] = fmDate.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Supabase → FileMaker
function convertToFileMakerDate(isoDate) {
  // Input: "2024-01-15"
  // Output: "01/15/2024"
  const date = new Date(isoDate);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}
```

### Boolean Flag Conversion

**FileMaker Format**: String "1" (true) or "0" (false)
**Supabase Format**: Boolean `true` or `false`

**Conversion** (Code: src/services/projectService.js:38-39, 121, 145):

```javascript
// FileMaker → Supabase
const isFixedPrice = fieldData.f_fixedPrice === "1" || fieldData.f_fixedPrice === 1;
const isSubscription = fieldData.f_subscription === "1" || fieldData.f_subscription === 1;
const completed = fieldData.f_completed === "1" || fieldData.f_completed === 1;

// Supabase → FileMaker
const fmFixedPrice = isFixedPrice ? "1" : "0";
const fmSubscription = isSubscription ? "1" : "0";
```

**Fields Using This Pattern**:
- `f_fixedPrice` / `is_fixed_price`
- `f_subscription` / `is_subscription`
- `f_completed` / `completed`
- `f_billed` / `is_billed`

### Error Handling Patterns

**FileMaker API Errors** (Code: src/api/fileMaker.js:125-152):
```javascript
// FileMaker returns messages array
{
  messages: [{ code: '401', message: 'Record Missing' }]
}

// Frontend checks code !== '0'
if (response.messages[0].code !== '0') {
  throw new Error(response.messages[0].message);
}
```

**Supabase Errors** (Standard PostgreSQL errors):
```javascript
// Foreign key violation
{ code: '23503', message: 'violates foreign key constraint' }

// Check constraint violation
{ code: '23514', message: 'violates check constraint "projects_status_check"' }

// Unique violation
{ code: '23505', message: 'duplicate key value violates unique constraint' }
```

**Frontend Error Handling** (Code: src/hooks/useProject.js:256-264):
```javascript
try {
  await createProject(data);
} catch (error) {
  console.error('Project creation failed:', error);
  // Show error to user via SnackBar
  showSnackBar('Failed to create project: ' + error.message, 'error');
}
```

### Missing Schema Elements (Require Backend Changes)

**Tables** (See data-model-mapping.md for proposed schemas):
1. `project_objectives` - Stores project objectives/milestones
2. `project_objective_steps` - Stores steps within objectives
3. `project_images` - Stores project image URLs
4. `notes` - Stores project notes (polymorphic entity_type + entity_id)

**Columns** (projects table):
1. `team_id` - UUID foreign key to teams table
2. `organization_id` - UUID foreign key to organizations table (CRITICAL for multi-tenancy)
3. `time_estimate` - TEXT field for time estimates (e.g., "40h", "2h 30m")
4. `is_fixed_price` - BOOLEAN flag for fixed-price projects
5. `is_subscription` - BOOLEAN flag for subscription projects

**Columns** (links table):
1. `title` - TEXT field for custom link descriptions (currently derived from URL)

### Dual-Write Pattern (Current Implementation)

**Current Approach** (Code: src/hooks/useProject.js:218-259):
1. Create project in FileMaker first (source of truth)
2. If successful, sync to Supabase for web app access
3. If Supabase sync fails, log error but don't roll back FileMaker

```javascript
// 1. Create in FileMaker
const fmResponse = await createProject(fileMakerData);
const projectId = fmResponse.response.data[0].fieldData.__ID;

// 2. Sync to Supabase
try {
  await insert('projects', {
    id: projectId,
    name: projectData.name,
    customer_id: projectData.customerId,
    status: mapStatus(projectData.status),
    // ... other fields
  });
} catch (error) {
  console.error('Supabase sync failed:', error);
  // FileMaker record still exists
}
```

**Future Migration Approach**:
1. Write to Supabase ONLY (web app)
2. FileMaker becomes read-only data source
3. Eventually deprecate FileMaker layouts

### Query Performance Considerations

**Indexes** (Current Supabase schema):
```sql
CREATE INDEX idx_projects_customer_id ON projects(customer_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at);
```

**Recommended Queries**:
```sql
-- Efficient: Uses idx_projects_customer_id
SELECT * FROM projects WHERE customer_id = 'uuid-123';

-- Efficient: Uses idx_projects_status
SELECT * FROM projects WHERE status = 'active';

-- Efficient: Uses idx_projects_created_at
SELECT * FROM projects WHERE created_at >= '2024-01-01' ORDER BY created_at DESC;

-- Inefficient: Full table scan (no index on name)
SELECT * FROM projects WHERE name LIKE '%Website%';
```

**Future Indexes** (Recommended):
```sql
-- Full-text search on name and description
CREATE INDEX idx_projects_search ON projects USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Composite index for customer + status queries
CREATE INDEX idx_projects_customer_status ON projects(customer_id, status);
```

### Integration Testing Checklist

Before deploying backend endpoints, verify:

**Core Operations**:
- [ ] List projects by customer_id returns correct projects
- [ ] Get project detail returns complete data (with empty arrays for missing tables)
- [ ] Create project generates valid UUID and sets defaults
- [ ] Update project modifies only specified fields
- [ ] Delete project removes record (cascade behavior verified)
- [ ] Update project status changes status and triggers business logic

**Data Validation**:
- [ ] Invalid customer_id returns 404 error
- [ ] Invalid status value returns 422 error (CHECK constraint)
- [ ] Missing required fields return 400 error
- [ ] target_end_date < start_date returns 400 error
- [ ] Excessively long name (>255 chars) returns 400 error

**UUID Handling**:
- [ ] FileMaker UUIDs are preserved during migration
- [ ] Auto-generated UUIDs are valid v4 UUIDs
- [ ] Foreign key constraints reject invalid UUIDs

**Date Handling**:
- [ ] Dates stored as DATE type (not timestamp)
- [ ] Date format YYYY-MM-DD enforced
- [ ] Invalid date formats return 400 error

**Status Handling**:
- [ ] Status values are lowercase with underscores
- [ ] FileMaker status "Open" maps to "active"
- [ ] Invalid status values rejected by CHECK constraint

**Links Integration**:
- [ ] Links query by project_id returns project links
- [ ] Links require customer_id and organization_id
- [ ] Link URLs ≤ 2048 characters
- [ ] Link titles derived from URL hostname when missing

**Error Responses**:
- [ ] All errors return standard format with success: false
- [ ] Error codes match documented values
- [ ] Error messages are descriptive and user-friendly

### Related Documentation

- `data-model-mapping.md` - Complete field-by-field mapping between FileMaker and Supabase
- `current-implementation.md` - Detailed analysis of existing FileMaker integration
- `migration-plan.md` - Step-by-step migration strategy
- `authorization.md` - Access control and RLS policies
- `acceptance-criteria.md` - Feature requirements and testing criteria
