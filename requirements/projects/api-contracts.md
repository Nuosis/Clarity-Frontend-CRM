# API Contracts

This document defines the required backend endpoints/RPCs for the Projects feature migration to Supabase, including request/response formats, validation rules, and business logic requirements.

## Overview

All endpoints should be implemented as Supabase RPC functions or backend API endpoints with HMAC authentication. The frontend will call these through the backend API proxy.

**Base URL**: `https://api.claritybusinesssolutions.ca`

**Authentication**: HMAC-SHA256 (handled by `dataService.generateBackendAuthHeader()`)

## Core Project Operations

### 1. List Projects by Customer

**Endpoint**: `POST /rpc/get_projects_by_customer`

**Description**: Fetch all projects for a specific customer, with optional filtering

**Request**:
```json
{
  "customer_id": "uuid-customer-123",
  "include_related": false,
  "status_filter": null
}
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-project-456",
      "name": "Website Redesign",
      "customer_id": "uuid-customer-123",
      "team_id": "uuid-team-789",
      "organization_id": "uuid-org-001",
      "status": "Active",
      "description": "Complete overhaul of corporate website",
      "time_estimate": "40h",
      "value": 5000.00,
      "is_fixed_price": true,
      "is_subscription": false,
      "start_date": "2024-01-15",
      "end_date": "2024-03-31",
      "created_at": "2024-01-10T10:00:00Z",
      "updated_at": "2024-01-15T14:30:00Z"
    }
  ]
}
```

**Validation**:
- `customer_id` required (UUID format)
- User must have access to customer's organization
- Status filter (if provided) must be valid status value

**Errors**:
- 400: Invalid customer_id format
- 403: User not authorized for customer's organization
- 404: Customer not found

---

### 2. Get Project Detail

**Endpoint**: `POST /rpc/get_project_detail`

**Description**: Fetch complete project details with optionally all related data

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

**Response**:
```json
{
  "success": true,
  "data": {
    "project": {
      "id": "uuid-project-456",
      "name": "Website Redesign",
      "customer_id": "uuid-customer-123",
      "team_id": "uuid-team-789",
      "organization_id": "uuid-org-001",
      "status": "Active",
      "description": "Complete overhaul of corporate website",
      "time_estimate": "40h",
      "value": 5000.00,
      "is_fixed_price": true,
      "is_subscription": false,
      "start_date": "2024-01-15",
      "end_date": "2024-03-31",
      "created_at": "2024-01-10T10:00:00Z",
      "updated_at": "2024-01-15T14:30:00Z"
    },
    "objectives": [
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
    ],
    "images": [],
    "links": [],
    "notes": [],
    "stats": {
      "completion_percentage": 25,
      "total_objectives": 4,
      "completed_objectives": 1,
      "total_steps": 12,
      "completed_steps": 3
    }
  }
}
```

**Validation**:
- `project_id` required (UUID format)
- User must have access to project's organization

**Errors**:
- 400: Invalid project_id format
- 403: User not authorized for project's organization
- 404: Project not found

---

### 3. Create Project

**Endpoint**: `POST /rpc/create_project`

**Description**: Create a new project with automatic business logic execution (fixed-price or subscription sales generation)

**Request**:
```json
{
  "name": "Mobile App Development",
  "customer_id": "uuid-customer-123",
  "team_id": "uuid-team-789",
  "status": "Planning",
  "description": "iOS and Android mobile application",
  "time_estimate": "120h",
  "value": 15000.00,
  "is_fixed_price": true,
  "is_subscription": false,
  "start_date": "2024-02-01",
  "end_date": "2024-05-31"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "project": {
      "id": "uuid-project-new",
      "name": "Mobile App Development",
      "customer_id": "uuid-customer-123",
      "team_id": "uuid-team-789",
      "organization_id": "uuid-org-001",
      "status": "Planning",
      "description": "iOS and Android mobile application",
      "time_estimate": "120h",
      "value": 15000.00,
      "is_fixed_price": true,
      "is_subscription": false,
      "start_date": "2024-02-01",
      "end_date": "2024-05-31",
      "created_at": "2024-01-20T10:00:00Z",
      "updated_at": "2024-01-20T10:00:00Z"
    },
    "sales_entries_created": [
      {
        "id": "uuid-sale-001",
        "customer_id": "uuid-customer-123",
        "amount": 7500.00,
        "date": "2024-02-01",
        "description": "Fixed price project (Mobile App Development) - 50% on start",
        "type": "sellable"
      }
    ]
  }
}
```

**Validation**:
- `name` required, non-empty string, max 255 chars
- `customer_id` required, must exist and user must have access
- `team_id` optional, must exist if provided
- `value` required if `is_fixed_price` or `is_subscription` is true
- `value` must be > 0 if provided
- Cannot have both `is_fixed_price` and `is_subscription` as true
- `start_date` required if `is_subscription` is true
- Dates must be valid YYYY-MM-DD format
- `end_date` must be >= `start_date` if both provided

**Business Logic** (see "Business Logic Requirements" section below):
- If `is_fixed_price = true` and `start_date <= today`: Create 50% sales entry
- If `is_fixed_price = true` and `end_date <= today`: Create 50% sales entry
- If `is_subscription = true`: Create monthly sales entries from start to end/today

**Errors**:
- 400: Validation failure (name missing, invalid dates, both pricing flags true, etc.)
- 403: User not authorized for customer's organization
- 404: Customer or team not found
- 422: Business logic failure (sales entry creation failed)

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

### 13. Create Objective Step

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

### 14. Update Objective Step

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

### 15. Delete Objective Step

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

### 16. Toggle Step Completion

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

### 17. Reorder Objective Steps

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

### 18. Create Project Image

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

### 19. Delete Project Image

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

### 20. Create Project Link

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

### 21. Delete Project Link

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
