# Marketing System Backend Specification

## Overview
This document outlines the database schema and API requirements for the Marketing Management System based on the frontend wireframe implementation.

## Database Schema

### 1. Marketing Domains Table
**Table Name:** `marketing_domains`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| name | VARCHAR(255) | NOT NULL | Domain name (e.g., "Social Media", "Email Marketing") |
| description | TEXT | | Detailed description of the domain |
| icon | VARCHAR(100) | | Icon identifier for UI display |
| color | VARCHAR(7) | | Hex color code for UI theming |
| is_active | BOOLEAN | DEFAULT true | Whether domain is active |
| sort_order | INTEGER | DEFAULT 0 | Display order in UI |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |
| created_by | UUID | REFERENCES users(id) | User who created the domain |

**Indexes:**
- `idx_marketing_domains_active` ON (is_active)
- `idx_marketing_domains_sort_order` ON (sort_order)

### 2. Marketing Focus Areas Table
**Table Name:** `marketing_focus_areas`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| domain_id | UUID | NOT NULL, REFERENCES marketing_domains(id) ON DELETE CASCADE | Parent domain |
| name | VARCHAR(255) | NOT NULL | Focus area name |
| description | TEXT | | Detailed description |
| is_active | BOOLEAN | DEFAULT true | Whether focus is active |
| sort_order | INTEGER | DEFAULT 0 | Display order within domain |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |
| created_by | UUID | REFERENCES users(id) | User who created the focus |

**Indexes:**
- `idx_marketing_focus_domain` ON (domain_id)
- `idx_marketing_focus_active` ON (is_active)
- `idx_marketing_focus_sort_order` ON (sort_order)

### 3. Marketing Content Pillars Table
**Table Name:** `marketing_content_pillars`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| focus_area_id | UUID | NOT NULL, REFERENCES marketing_focus_areas(id) ON DELETE CASCADE | Parent focus area |
| name | VARCHAR(255) | NOT NULL | Pillar name |
| description | TEXT | | Detailed description |
| color | VARCHAR(7) | | Hex color code for UI theming |
| target_percentage | DECIMAL(5,2) | CHECK (target_percentage >= 0 AND target_percentage <= 100) | Target content percentage |
| is_active | BOOLEAN | DEFAULT true | Whether pillar is active |
| sort_order | INTEGER | DEFAULT 0 | Display order |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |
| created_by | UUID | REFERENCES users(id) | User who created the pillar |

**Indexes:**
- `idx_marketing_content_pillars_focus` ON (focus_area_id)
- `idx_marketing_content_pillars_active` ON (is_active)
- `idx_marketing_content_pillars_sort_order` ON (sort_order)

### 4. Marketing Content Categories Table
**Table Name:** `marketing_content_categories`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| focus_area_id | UUID | NOT NULL, REFERENCES marketing_focus_areas(id) ON DELETE CASCADE | Parent focus area |
| name | VARCHAR(255) | NOT NULL | Category name |
| description | TEXT | | Detailed description |
| category_type | VARCHAR(50) | NOT NULL | Type of category (e.g., 'content_type', 'audience', 'format') |
| color | VARCHAR(7) | | Hex color code for UI theming |
| is_active | BOOLEAN | DEFAULT true | Whether category is active |
| sort_order | INTEGER | DEFAULT 0 | Display order |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |
| created_by | UUID | REFERENCES users(id) | User who created the category |

**Indexes:**
- `idx_marketing_content_categories_focus` ON (focus_area_id)
- `idx_marketing_content_categories_type` ON (category_type)
- `idx_marketing_content_categories_active` ON (is_active)
- `idx_marketing_content_categories_sort_order` ON (sort_order)

### 5. Marketing Content Table
**Table Name:** `marketing_content`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| focus_area_id | UUID | NOT NULL, REFERENCES marketing_focus_areas(id) ON DELETE CASCADE | Parent focus area |
| pillar_id | UUID | REFERENCES marketing_content_pillars(id) ON DELETE SET NULL | Associated content pillar |
| title | VARCHAR(500) | NOT NULL | Content title |
| description | TEXT | | Content description |
| content_type | VARCHAR(100) | NOT NULL | Type of content (post, video, article, etc.) |
| status | VARCHAR(50) | DEFAULT 'draft' | Content status (draft, scheduled, published, archived) |
| scheduled_date | TIMESTAMP | | When content is scheduled for publication |
| published_date | TIMESTAMP | | When content was actually published |
| platform | VARCHAR(100) | | Target platform (if applicable) |
| url | TEXT | | Published content URL |
| performance_metrics | JSONB | | Performance data (views, likes, shares, etc.) |
| tags | TEXT[] | | Content tags for categorization |
| is_active | BOOLEAN | DEFAULT true | Whether content is active |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |
| created_by | UUID | REFERENCES users(id) | User who created the content |

**Indexes:**
- `idx_marketing_content_focus` ON (focus_area_id)
- `idx_marketing_content_pillar` ON (pillar_id)
- `idx_marketing_content_status` ON (status)
- `idx_marketing_content_type` ON (content_type)
- `idx_marketing_content_scheduled` ON (scheduled_date)
- `idx_marketing_content_published` ON (published_date)
- `idx_marketing_content_tags` USING GIN (tags)
- `idx_marketing_content_performance` USING GIN (performance_metrics)

### 6. Marketing Content Category Associations Table
**Table Name:** `marketing_content_category_associations`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| content_id | UUID | NOT NULL, REFERENCES marketing_content(id) ON DELETE CASCADE | Content reference |
| category_id | UUID | NOT NULL, REFERENCES marketing_content_categories(id) ON DELETE CASCADE | Category reference |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

**Indexes:**
- `idx_marketing_content_category_assoc_content` ON (content_id)
- `idx_marketing_content_category_assoc_category` ON (category_id)
- `unique_marketing_content_category` UNIQUE (content_id, category_id)

## API Endpoints

### Clarity Backend Supabase Integration
The backend uses customized Supabase endpoints that follow the pattern `/supabase/{table}/{operation}`:

#### Marketing Domains
- `GET /supabase/marketing_domains/select` - List all domains
  - Query params: `columns=*`, `filters={"is_active": true}`
- `POST /supabase/marketing_domains/insert` - Create new domain
  - Body: `{"data": {"name": "...", "description": "...", ...}}`
- `PATCH /supabase/marketing_domains/update` - Update domain
  - Body: `{"filters": {"id": "uuid"}, "data": {"name": "...", ...}}`
- `DELETE /supabase/marketing_domains/delete` - Delete domain
  - Body: `{"id": "uuid"}` or set `is_active: false`

#### Marketing Focus Areas
- `GET /supabase/marketing_focus_areas/select` - List all focus areas
  - Query params: `filters={"domain_id": "uuid", "is_active": true}`
- `POST /supabase/marketing_focus_areas/insert` - Create new focus area
- `PATCH /supabase/marketing_focus_areas/update` - Update focus area
- `DELETE /supabase/marketing_focus_areas/delete` - Delete focus area

#### Marketing Content Pillars
- `GET /supabase/marketing_content_pillars/select` - List all pillars
  - Query params: `filters={"focus_area_id": "uuid", "is_active": true}`
- `POST /supabase/marketing_content_pillars/insert` - Create new pillar
- `PATCH /supabase/marketing_content_pillars/update` - Update pillar
- `DELETE /supabase/marketing_content_pillars/delete` - Delete pillar

#### Marketing Content Categories
- `GET /supabase/marketing_content_categories/select` - List all categories
  - Query params: `filters={"focus_area_id": "uuid", "is_active": true}`
- `POST /supabase/marketing_content_categories/insert` - Create new category
- `PATCH /supabase/marketing_content_categories/update` - Update category
- `DELETE /supabase/marketing_content_categories/delete` - Delete category

#### Marketing Content
- `GET /supabase/marketing_content/select` - List all content
  - Query params: `filters={"focus_area_id": "uuid"}` or `filters={"pillar_id": "uuid"}`
- `POST /supabase/marketing_content/insert` - Create new content
- `PATCH /supabase/marketing_content/update` - Update content
- `DELETE /supabase/marketing_content/delete` - Delete content

#### Marketing Content Category Associations
- `GET /supabase/marketing_content_category_associations/select` - List associations
- `POST /supabase/marketing_content_category_associations/insert` - Create association
- `DELETE /supabase/marketing_content_category_associations/delete` - Remove association

## Authentication

All marketing system endpoints require authentication using the Clarity Backend's HMAC-SHA256 Bearer token system:

**Format**: `Bearer {signature}.{timestamp}`

Where:
- `signature`: HMAC-SHA256 hash of `{timestamp}.{payload}` using the SECRET_KEY environment variable
- `timestamp`: Unix timestamp of the request
- `payload`: The request body (empty string for GET requests)

**Example**:
```
Authorization: Bearer 79d24ce74c40e3ece50ea60b85aea99c194cf4ac87e6c799b4d57ecf3528bcfe.1748500870
```

### Custom API Endpoints (if needed)

#### 1. Marketing Dashboard Data
**Endpoint:** `GET /api/marketing/dashboard/{domain_id}`
**Purpose:** Get comprehensive dashboard data for a specific domain
**Authentication:** Required (HMAC Bearer token)
**Response:**
```json
{
  "domain": {
    "id": "uuid",
    "name": "string",
    "description": "string",
    "icon": "string",
    "color": "string"
  },
  "focus_areas": [
    {
      "id": "uuid",
      "name": "string",
      "description": "string",
      "pillars": [
        {
          "id": "uuid",
          "name": "string",
          "description": "string",
          "target_percentage": "number",
          "current_percentage": "number"
        }
      ],
      "categories": {
        "content_type": [
          {
            "id": "uuid",
            "name": "string",
            "description": "string",
            "content_count": "number"
          }
        ],
        "audience": [...]
      },
      "content_summary": {
        "total_content": "number",
        "published_content": "number",
        "scheduled_content": "number",
        "draft_content": "number"
      }
    }
  ]
}
```

#### 2. Content Performance Analytics
**Endpoint:** `GET /api/marketing/analytics/{focus_area_id}`
**Purpose:** Get performance analytics for content in a focus area
**Authentication:** Required (HMAC Bearer token)
**Query Parameters:**
- `start_date` (optional): Start date for analytics
- `end_date` (optional): End date for analytics
- `pillar_id` (optional): Filter by specific pillar

**Response:**
```json
{
  "summary": {
    "total_views": "number",
    "total_engagement": "number",
    "avg_performance": "number"
  },
  "by_pillar": [
    {
      "pillar_id": "uuid",
      "pillar_name": "string",
      "content_count": "number",
      "total_views": "number",
      "avg_engagement": "number"
    }
  ],
  "by_category": [
    {
      "category_id": "uuid",
      "category_name": "string",
      "content_count": "number",
      "performance_metrics": "object"
    }
  ],
  "timeline": [
    {
      "date": "string",
      "views": "number",
      "engagement": "number"
    }
  ]
}
```

#### 3. Content Calendar
**Endpoint:** `GET /api/marketing/calendar/{focus_area_id}`
**Purpose:** Get content calendar data
**Authentication:** Required (HMAC Bearer token)
**Query Parameters:**
- `start_date`: Start date for calendar
- `end_date`: End date for calendar
- `status`: Filter by content status

**Response:**
```json
{
  "calendar_items": [
    {
      "date": "string",
      "content": [
        {
          "id": "uuid",
          "title": "string",
          "content_type": "string",
          "status": "string",
          "pillar": {
            "id": "uuid",
            "name": "string",
            "color": "string"
          },
          "scheduled_time": "string"
        }
      ]
    }
  ]
}
```

## Row Level Security (RLS) Policies

### Marketing Domains
```sql
-- Users can view all active domains
CREATE POLICY "marketing_domains_select" ON marketing_domains
  FOR SELECT USING (is_active = true);

-- Users can insert domains if they have marketing_admin role
CREATE POLICY "marketing_domains_insert" ON marketing_domains
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'marketing_admin');

-- Users can update domains they created or if they have marketing_admin role
CREATE POLICY "marketing_domains_update" ON marketing_domains
  FOR UPDATE USING (
    created_by = auth.uid() OR 
    auth.jwt() ->> 'role' = 'marketing_admin'
  );
```

### Marketing Focus Areas
```sql
-- Users can view focus areas for active domains
CREATE POLICY "marketing_focus_areas_select" ON marketing_focus_areas
  FOR SELECT USING (
    is_active = true AND 
    EXISTS (
      SELECT 1 FROM marketing_domains 
      WHERE id = domain_id AND is_active = true
    )
  );

-- Users can insert focus areas if they have marketing_manager role or higher
CREATE POLICY "marketing_focus_areas_insert" ON marketing_focus_areas
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'role' IN ('marketing_manager', 'marketing_admin')
  );
```

### Content Pillars & Categories
```sql
-- Similar RLS patterns for pillars and categories
-- Users can view active items
-- Users with appropriate roles can create/edit
-- Content creators can edit items they created
```

### Marketing Content
```sql
-- Users can view published content and their own drafts
CREATE POLICY "marketing_content_select" ON marketing_content
  FOR SELECT USING (
    status = 'published' OR 
    created_by = auth.uid() OR
    auth.jwt() ->> 'role' IN ('marketing_manager', 'marketing_admin')
  );

-- Users can insert content
CREATE POLICY "marketing_content_insert" ON marketing_content
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- Users can update their own content or managers can update any
CREATE POLICY "marketing_content_update" ON marketing_content
  FOR UPDATE USING (
    created_by = auth.uid() OR 
    auth.jwt() ->> 'role' IN ('marketing_manager', 'marketing_admin')
  );
```

## Database Functions

### 1. Get Marketing Domain Structure
```sql
CREATE OR REPLACE FUNCTION get_marketing_domain_structure(domain_uuid UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'domain', row_to_json(d.*),
    'focus_areas', (
      SELECT json_agg(
        json_build_object(
          'focus_area', row_to_json(fa.*),
          'pillars', (
            SELECT json_agg(row_to_json(p.*))
            FROM marketing_content_pillars p
            WHERE p.focus_area_id = fa.id AND p.is_active = true
            ORDER BY p.sort_order
          ),
          'categories', (
            SELECT json_object_agg(
              c.category_type,
              json_agg(row_to_json(c.*) ORDER BY c.sort_order)
            )
            FROM marketing_content_categories c
            WHERE c.focus_area_id = fa.id AND c.is_active = true
          )
        )
      )
      FROM marketing_focus_areas fa
      WHERE fa.domain_id = d.id AND fa.is_active = true
      ORDER BY fa.sort_order
    )
  ) INTO result
  FROM marketing_domains d
  WHERE d.id = domain_uuid AND d.is_active = true;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

### 2. Update Content Performance Metrics
```sql
CREATE OR REPLACE FUNCTION update_content_performance(
  content_uuid UUID,
  metrics JSONB
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE marketing_content
  SET 
    performance_metrics = COALESCE(performance_metrics, '{}'::jsonb) || metrics,
    updated_at = NOW()
  WHERE id = content_uuid;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;
```

## Implementation Notes

1. **Clarity Backend Integration**: Use the existing Clarity Backend's customized Supabase endpoints (`/supabase/{table}/{operation}`) for all CRUD operations.

2. **Authentication**: All endpoints require HMAC-SHA256 Bearer token authentication as implemented in the Clarity Backend.

3. **Custom Endpoints**: Only implement custom API endpoints for complex aggregations or business logic that can't be efficiently handled through the standard Supabase endpoints.

4. **Performance**: Use appropriate indexes and consider materialized views for frequently accessed aggregated data.

5. **Audit Trail**: All tables include `created_at`, `updated_at`, and `created_by` fields for audit purposes.

6. **Soft Deletes**: Use `is_active` flags instead of hard deletes to maintain data integrity and audit trails.

7. **Extensibility**: The schema is designed to be extensible - new content types, categories, and metrics can be added without schema changes.

8. **Data Validation**: Use database constraints and check constraints to ensure data integrity.

9. **Permissions**: Implement role-based access control through RLS policies and JWT claims.

10. **Backend Structure**: Follow the existing Clarity Backend patterns:
    - Use FastAPI for custom endpoints
    - Implement proper error handling and response schemas
    - Add endpoints to the OpenAPI specification
    - Use the existing authentication middleware

## Migration Strategy

1. Create tables in dependency order (domains → focus areas → pillars/categories → content)
2. Set up RLS policies
3. Create database functions
4. Insert seed data for initial domains and focus areas
5. Test with sample content data

This specification provides a solid foundation for the marketing system backend while leveraging Supabase's built-in capabilities for most operations.