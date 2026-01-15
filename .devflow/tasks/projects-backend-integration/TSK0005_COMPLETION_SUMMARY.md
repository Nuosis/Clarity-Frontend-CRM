# TSK0005 Completion Summary: Update Service Layer for Related Entities

**Status**: ✅ Complete
**Completed**: 2026-01-15

## Overview

Updated transformation functions in `src/services/projectService.js` to handle both FileMaker and backend API data formats for project-related entities (objectives, steps, images, links). Added environment-aware data processing with proper nesting and schema mapping.

## Changes Made

### 1. processProjectImages()

**Enhanced**: Added `source` parameter to handle both FileMaker and backend formats.

**Backend Schema Mapping**:
```javascript
// Backend API Response
{
  id: UUID,
  project_id: UUID,           // Maps from FileMaker _fkID
  url: TEXT,
  title: TEXT,
  description: TEXT,
  file_name: TEXT,
  storage_provider: TEXT,
  created_at: TIMESTAMPTZ,
  updated_at: TIMESTAMPTZ,
  created_by: TEXT
}
```

**FileMaker Schema**:
```javascript
// FileMaker Response
{
  fieldData: {
    __ID: UUID,
    _fkID: UUID,              // Polymorphic foreign key
    url: TEXT,
    title: TEXT,
    description: TEXT
  },
  recordId: "42"
}
```

**Key Changes**:
- Fixed FileMaker bug: Changed filter from `_projectID` to `_fkID` (correct polymorphic FK)
- Backend processes additional fields: `file_name`, `storage_provider`, `created_by`, timestamps
- Maintains backward compatibility with FileMaker format

---

### 2. processProjectLinks()

**Enhanced**: Added `source` parameter with backend-specific handling.

**Backend Schema Mapping**:
```javascript
// Backend API Response
{
  id: UUID,
  project_id: UUID,           // Maps from FileMaker _fkID
  customer_id: UUID,          // REQUIRED (NOT NULL)
  organization_id: UUID,      // REQUIRED (NOT NULL)
  link: VARCHAR(2048),        // URL with length limit
  created_at: TIMESTAMPTZ,
  updated_at: TIMESTAMPTZ
}
```

**Important Schema Differences**:
- ❌ Backend has **NO `title` column** - derived from URL hostname
- ✅ Uses explicit foreign keys (`project_id`, `customer_id`, `organization_id`)
- ⚠️ `customer_id` and `organization_id` are NOT NULL - must be populated
- ⚠️ `link` field limited to 2048 characters (FileMaker has no limit)

**Title Derivation** (Backend):
```javascript
title: link.title || (link.link ? new URL(link.link).hostname : '')
// Example: "https://github.com/user/repo" → "github.com"
```

**FileMaker Handling**:
- Uses `_fkID` polymorphic foreign key (no entity type indicator)
- Title stored directly in FileMaker (will be lost in migration if backend has no title)
- No length limit on URLs

---

### 3. processProjectObjectives()

**Enhanced**: Added `source` parameter with proper nesting support for objectives→steps.

**Backend Schema Mapping**:
```javascript
// Backend API Response
{
  id: UUID,
  project_id: UUID,           // Maps from FileMaker _projectID
  objective: TEXT,            // Maps from FileMaker projectObjective
  status: TEXT,
  order_num: INTEGER,         // Maps from FileMaker order
  completed: BOOLEAN,         // Maps from FileMaker f_completed ("1"/"0")
  created_at: TIMESTAMPTZ,
  updated_at: TIMESTAMPTZ,
  steps: [...]                // Nested steps array (optional)
}
```

**Field Mappings**:
| FileMaker              | Backend API         | Conversion                     |
|------------------------|---------------------|--------------------------------|
| `projectObjective`     | `objective`         | Direct (TEXT)                  |
| `_projectID`           | `project_id`        | UUID → UUID                    |
| `order`                | `order_num`         | Number → INTEGER               |
| `f_completed`          | `completed`         | "1"/"0" → true/false (BOOLEAN) |
| `status`               | `status`            | Direct (TEXT)                  |

**Nesting Logic**:
- Backend can return nested steps in `objective.steps` OR separate steps array
- Function checks for nested steps first, falls back to separate array
- Calls `processObjectiveSteps()` with correct source parameter
- Maintains sort order by `order_num` (FileMaker `order`)

---

### 4. processObjectiveSteps()

**Enhanced**: Added `source` parameter with smart filtering for nested vs separate arrays.

**Backend Schema Mapping**:
```javascript
// Backend API Response
{
  id: UUID,
  objective_id: UUID,         // Maps from FileMaker _objectiveID
  step: TEXT,                 // Maps from FileMaker projectObjectiveStep
  order_num: INTEGER,         // Maps from FileMaker order
  completed: BOOLEAN,         // Maps from FileMaker f_completed ("1"/"0")
  created_at: TIMESTAMPTZ,
  updated_at: TIMESTAMPTZ
}
```

**Field Mappings**:
| FileMaker               | Backend API      | Conversion                     |
|-------------------------|------------------|--------------------------------|
| `projectObjectiveStep`  | `step`           | Direct (TEXT)                  |
| `_objectiveID`          | `objective_id`   | UUID → UUID                    |
| `order`                 | `order_num`      | Number → INTEGER               |
| `f_completed`           | `completed`      | "1" → true, "0" → false        |

**Smart Filtering**:
```javascript
// Check if steps already filtered (nested in objective)
const needsFilter = stepsArray.some(step => step.objective_id !== objectiveId);
const filteredSteps = needsFilter ?
    stepsArray.filter(step => step.objective_id === objectiveId) :
    stepsArray;
```

**Why Smart Filtering**:
- Backend can return steps pre-filtered (nested) or mixed array (all steps for project)
- Avoids unnecessary filtering when steps already scoped to objective
- Prevents empty results if filtering pre-filtered nested arrays

---

### 5. processBackendProject()

**Updated**: Now passes `source='backend'` to all related data processors.

**Related Data Processing**:
```javascript
// Images
images: project.images ?
    processProjectImages(project.images, projectId, 'backend') :
    (relatedData.images ? processProjectImages(relatedData.images, projectId, 'backend') : []),

// Links
links: project.links ?
    processProjectLinks(project.links, projectId, 'backend') :
    (relatedData.links ? processProjectLinks(relatedData.links, projectId, 'backend') : []),

// Objectives (with nested steps)
objectives: project.objectives ?
    processProjectObjectives(project.objectives, projectId, project.steps || relatedData.steps, 'backend') :
    (relatedData.objectives ? processProjectObjectives(relatedData.objectives, projectId, relatedData.steps, 'backend') : []),
```

**Nesting Strategy**:
- Prioritizes nested data in project object (`project.images`, `project.objectives`)
- Falls back to separate `relatedData` object if nested data not present
- Passes steps to objectives processor (handles both nested and separate)

---

## FileMaker Bug Fixes

### Image Filter Bug
**Before** (Incorrect):
```javascript
.filter(img => img.fieldData._projectID === projectId)
```

**After** (Correct):
```javascript
.filter(img => img.fieldData._fkID === projectId)
```

**Issue**: FileMaker uses polymorphic `_fkID` field for images, NOT `_projectID`. Previous code would filter out all images.

**Verification**: Checked requirements documentation:
- `requirements/projects/data-model-mapping.md:546` confirms `_fkID` is correct field
- FileMaker layout: `devProjectImages` uses `_fkID` as foreign key

---

## Backend Schema Gaps Identified

### 1. Links Table Missing `title` Column
**Impact**: Link titles from FileMaker will be lost in migration.

**Workaround**: Frontend derives title from URL hostname:
```javascript
title: new URL(link).hostname  // "github.com"
```

**Recommendation**: Add `title TEXT` column to backend `links` table OR accept derived titles.

---

### 2. Links Require `customer_id` and `organization_id`
**Impact**: Migration complexity - every link needs customer + org association.

**Solution**:
```sql
-- Lookup from project relationship
customer_id = project.customer_id
organization_id = customer.organization_id
```

**Migration**: Requires JOINs with `projects` and `customers` tables.

---

### 3. Link URL Length Limit
**Backend**: `VARCHAR(2048)` max length
**FileMaker**: No explicit limit (TEXT field)

**Migration**: Validate all URLs ≤ 2048 characters before migration.

---

## Testing Verification

### Build Compilation
```bash
npm run build
✓ 1128 modules transformed
✓ built in 2.30s
```

**Result**: ✅ Build compiles successfully with no errors related to our changes.

**Warnings**: Unrelated proposal service warnings (pre-existing).

---

## Backward Compatibility

All changes maintain **full backward compatibility** with FileMaker:

1. **Default Parameter**: `source = 'filemaker'` - existing code works without changes
2. **FileMaker Path Preserved**: All FileMaker-specific logic remains intact
3. **Field Mappings**: Frontend format unchanged (uses FileMaker field names)
4. **No Breaking Changes**: Existing calls to these functions continue to work

**Example**:
```javascript
// Old code (still works)
processProjectImages(images, projectId);

// New code (backend support)
processProjectImages(images, projectId, 'backend');
```

---

## Data Flow

### Backend API → Frontend

```
Backend Response (project with nested data)
  ↓
processBackendProject()
  ↓
processProjectImages(project.images, projectId, 'backend')
  ↓
{
  id: UUID,
  url: TEXT,
  title: TEXT,
  description: TEXT,
  fileName: TEXT,           // Backend-specific
  storageProvider: TEXT,    // Backend-specific
  createdAt: TIMESTAMPTZ,   // Backend-specific
  createdBy: TEXT           // Backend-specific
}
```

### FileMaker API → Frontend

```
FileMaker Response (response.data with fieldData)
  ↓
processProjectData()
  ↓
processProjectImages(relatedData.images, projectId, 'filemaker')
  ↓
{
  id: UUID,
  recordId: String,         // FileMaker-specific
  url: TEXT,
  title: TEXT,
  description: TEXT
}
```

---

## Schema Summary

### Objectives & Steps

**Relationship**: Projects → Objectives (1:many) → Steps (1:many)

**Nesting**:
```javascript
{
  id: "project-uuid",
  objectives: [
    {
      id: "objective-uuid",
      objective: "Complete homepage design",
      order: 1,
      completed: false,
      steps: [
        { id: "step-uuid", step: "Create wireframes", order: 1, completed: true },
        { id: "step-uuid", step: "Get approval", order: 2, completed: false }
      ]
    }
  ]
}
```

### Images

**Storage**: URL references (NOT binary data in database)

**Providers**: FileMaker, Supabase Storage, AWS S3, Cloudflare R2, external CDN

### Links

**Foreign Keys**:
- FileMaker: Polymorphic `_fkID` (no type indicator)
- Backend: Explicit `project_id`, `customer_id`, `organization_id`

**URL Length**: Backend limited to 2048 characters

---

## Next Steps

1. **TSK0006**: Update `useProject` hook to use new API methods
2. **TSK0007**: Update CRUD operations in `useProject` hook
3. **TSK0008**: Update objective/step management in `useProject` hook
4. **TSK0010-TSK0013**: Update UI components to use new data structure

---

## Related Files

**Modified**:
- `src/services/projectService.js` - All transformation functions updated

**Documentation**:
- `requirements/projects/data-model-mapping.md` - Schema reference
- `requirements/projects/api-contracts.md` - API endpoint specifications

**Dependencies**:
- None - these are pure transformation functions with no external dependencies

---

## Validation Checklist

- ✅ processProjectImages() handles both FileMaker and backend formats
- ✅ processProjectLinks() handles both FileMaker and backend formats
- ✅ processProjectObjectives() handles both FileMaker and backend formats
- ✅ processObjectiveSteps() handles both FileMaker and backend formats
- ✅ processBackendProject() passes source='backend' to all processors
- ✅ Fixed FileMaker bug (_projectID → _fkID for images)
- ✅ Proper nesting of objectives → steps
- ✅ Smart filtering for pre-nested vs mixed arrays
- ✅ Backward compatibility maintained (default source='filemaker')
- ✅ Build compiles successfully with no errors
- ✅ Field mappings documented for all entities
- ✅ Schema gaps identified (links title, customer_id requirements)
- ✅ Task JSON updated with completion notes

---

## Notes for Backend Team

### Missing Backend Features

1. **Links Table Title Column**:
   - Current: No `title` column in `links` table
   - Impact: Link titles from FileMaker will be lost
   - Recommendation: Add `title TEXT` column to preserve custom descriptions
   - Workaround: Frontend derives title from URL hostname

2. **Links Endpoints**:
   - Status: Not found in API contracts document (as of TSK0001 review)
   - May need to add CRUD endpoints for links if not already implemented
   - Frontend currently falls back to FileMaker for links operations

### Migration Considerations

1. **Image URLs**: Validate all image URLs are accessible before migration
2. **Link URLs**: Check length ≤ 2048 characters (backend constraint)
3. **Links Foreign Keys**: Must populate `customer_id` and `organization_id` from project relationships
4. **Objectives Order**: Preserve `order` field as `order_num` (display order critical for UX)
5. **Steps Nesting**: Backend should return objectives with nested steps for efficiency

---

**End of TSK0005 Completion Summary**
